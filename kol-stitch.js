// ==========================================================================
// kol-stitch.js — 自動接片引擎 v4.1
// v4.1：口音鐵律鎖 —— 在 generateSegment(所有分段的唯一出海口)送 fal 前,
//       若開了語音且 prompt 還沒鎖口音,自動補上。台灣 KOL→台灣國語(擋大陸腔),
//       健一→日腔、阿福→粵腔(讀 window.natToAccent)。不管 prompt 哪個檔組的都守得到。
// v4.0：改用 webhook 背景生成 —— 不再輪詢 fal(那是 ~197 秒偵測延遲 + 逾時的元兇)。
//       改成問 Worker 的 episode_result(fal 做完主動 webhook → fal_hook 寫進 R2 → 瞬間反映)。
//       → 5 秒影片不再空等 ~190 秒;90 秒接片不再撞瀏覽器輪詢上限。
//       前提(Worker 端,已部署/本次一起部署):
//         · seedance_submit 已帶 fal_webhook,fal_hook 寫 episodes/{requestId}.json
//         · video_compose 也帶 fal_webhook(本次 Patch 2)
//         · extractVideoUrl 已能吃 merge-videos 的扁平 video_url(本次 Patch 1)
//         · episode_result：前端用 requestId 查結果(沒好回 pending、好了回 done+videoUrl)
// v3.0：平行 —— 每段只錨原始 KOL 照 + 商品照,彼此不依賴 → 全部同時送、同時跑。
// v2.0：reference-to-video(砍掉尾幀接首幀)→ 內心戲/表情接得住、畫質不逐段衰退。
// --------------------------------------------------------------------------
// 設計原則：底層一次做對,半自動(mode:'semi') / 全自動(mode:'auto') 共用同一套。
// UI 只是薄薄一層蓋上去;換 UI 不用動這支。
// ==========================================================================
window.KolStitch = (function () {
  'use strict';

  // ---- 設定 ---------------------------------------------------------------
  const cfg = {
    workerUrl: 'https://kol-proxy.calm-sunset-6b66.workers.dev',
    password: 'raby2026', // Worker 每個 POST 都驗密碼,少了會被擋「密碼錯誤」
    pollIntervalMs: 5000,
    pollMaxTries: 240,    // 5s × 240 = 20 分鐘上限。webhook 後輪詢只是輕量讀 R2,給足餘裕、不怕 fal 排隊久
    pollTask: null,       // 想用 kol.html 現成的輪詢,就 init({ pollTask: 你的函式 }) 換掉(只影響舊 fal_poll 路徑)
  };
  function init(options) { Object.assign(cfg, options || {}); return cfg; }

  // ---- 底層工具 -----------------------------------------------------------

  // 打 Worker(所有 action 共用同一條)
  async function api(action, params) {
    const payload = Object.assign({ action }, params || {});
    payload.password = cfg.password;   // 每個請求都要帶密碼
    const res = await fetch(cfg.workerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    let data;
    try { data = await res.json(); }
    catch (e) { throw new Error(`[${action}] 回應不是 JSON（HTTP ${res.status}）`); }
    if (data && data.ok === false) throw new Error(`[${action}] ${data.error || '未知錯誤'}`);
    return data;
  }

  // 從任意回傳撈 URL：fal_poll 對不同任務用不同欄位（videoUrl / imageUrl / rawResult）
  function pickUrl(r) {
    if (!r) return null;
    var u = r.videoUrl || r.imageUrl ||            // fal_poll 正規化後的欄位
            (r.video && r.video.url) || r.video_url ||
            (r.images && r.images[0] && r.images[0].url) ||
            (r.image && r.image.url) ||
            (r.output && r.output.video && r.output.video.url) ||
            r.url || null;
    if (u) return u;
    // fal_poll 偶爾把原始結果塞在 rawResult 字串裡（例如接片 compose 的 video_url）
    if (r.rawResult) {
      try {
        var o = JSON.parse(r.rawResult);
        return o.video_url ||
               (o.video && o.video.url) ||
               (o.images && o.images[0] && o.images[0].url) ||
               (o.image && o.image.url) || null;
      } catch (e) {}
    }
    return null;
  }

  // 🆕 v4.0：webhook 輪詢 —— 問 episode_result(R2 由 fal_hook 即時寫入),不再打 fal_poll。
  //   reqId = seedance_submit / video_compose 回來的 requestId。
  //   fal 做完 → webhook → fal_hook 寫 episodes/{reqId}.json → 這裡就讀到 done,無 197 秒延遲。
  async function pollEpisode(reqId, brandId, onTick) {
    if (!reqId) throw new Error('pollEpisode 缺少 reqId');
    const brand = brandId || 'unknown';
    for (let i = 0; i < cfg.pollMaxTries; i++) {
      try {
        const r = await api('episode_result', { brandId: brand, reqId });
        const st = String(r.status || 'pending').toLowerCase();
        if (st === 'done' && r.videoUrl) return r.videoUrl;
        if (st === 'failed') throw new Error('生成失敗：' + (r.error || '未知'));
        if (onTick) onTick(i, st);
      } catch (e) {
        // 'failed' 要往上拋;網路抖動 / R2 暫時讀不到 → 當還沒好,繼續等
        if (String((e && e.message) || '').indexOf('生成失敗') !== -1) throw e;
      }
      await new Promise(res => setTimeout(res, cfg.pollIntervalMs));
    }
    throw new Error('等待逾時(超過 ' + (cfg.pollMaxTries * cfg.pollIntervalMs / 60000) + ' 分鐘還沒回來)');
  }

  // 舊輪詢保留：extractLastFrame 還在用(平行主路徑用不到,留著不破壞既有呼叫)
  async function defaultPoll(submitResult, onTick) {
    const { requestId, endpoint, statusUrl, responseUrl } = submitResult;
    for (let i = 0; i < cfg.pollMaxTries; i++) {
      const s = await api('fal_poll', { requestId, endpoint, statusUrl, responseUrl });
      const url = pickUrl(s);
      if (url) return Object.assign({}, s, { _url: url });
      const status = String(s.status || '').toUpperCase();
      if (status === 'FAILED' || status === 'ERROR')
        throw new Error('生成失敗：' + JSON.stringify(s).slice(0, 300));
      if (onTick) onTick(i, status || 'IN_PROGRESS');
      await new Promise(r => setTimeout(r, cfg.pollIntervalMs));
    }
    throw new Error('輪詢逾時（超過 ' + (cfg.pollMaxTries * cfg.pollIntervalMs / 60000) + ' 分鐘）');
  }
  function poll(submitResult, onTick) {
    return (cfg.pollTask || defaultPoll)(submitResult, onTick);
  }

  // ---- 五個積木 -----------------------------------------------------------

  // 抽尾幀：影片 URL → 最後一幀圖片 URL（伺服器端抽,繞過 CORS）— 舊路徑用,保留
  async function extractLastFrame(videoUrl, onTick) {
    const sub = await api('extract_frame', { videoUrl, frameType: 'last' });
    const done = await poll(sub, onTick);
    const url = pickUrl(done);
    if (!url) throw new Error('抽尾幀沒拿到圖片 URL');
    return url;
  }

  // 生一段：永遠用「原始 KOL 照 + 商品照」當錨點(@Image1/@Image2…)。
  //   🆕 v4.0：submit 後改問 episode_result(webhook 已把成品寫進 R2),不再輪詢 fal。
  async function generateSegment(opts, onTick) {
    if (!opts.kolImageUrl) throw new Error('generateSegment 缺少 kolImageUrl（原始 KOL 照）');
    if (!opts.prompt) throw new Error('generateSegment 缺少 prompt');

    // 🔒 口音鐵律(接片總關卡):每段送 fal 前,若開了語音且 prompt 還沒鎖口音 → 補上。
    //   台灣 KOL → Taiwanese Mandarin(擋大陸腔);健一→日腔、阿福→粵腔(讀 window.natToAccent)。
    //   這是所有分段的唯一出海口,鎖在這就不管 prompt 是哪個檔組的,一律守得到。
    let finalPrompt = opts.prompt;
    if (opts.generateAudio === true && !/Mandarin/i.test(finalPrompt)) {
      const _nat = opts.nationality
        || (window.S && window.S.selectedKol && window.S.selectedKol.persona && window.S.selectedKol.persona.nationality)
        || 'tw';
      const _accent = (typeof window.natToAccent === 'function') ? window.natToAccent(_nat) : 'Taiwanese Mandarin';
      finalPrompt += `. She speaks in natural ${_accent}, clear lip-sync.`;
    }

    const sub = await api('seedance_submit', {
      kolImageUrl: opts.kolImageUrl,                  // ← 永遠原始照,不是尾幀(@Image1)
      productImageUrls: opts.productImageUrls,        // 商品照(@Image2…)
      productDriveFileIds: opts.productDriveFileIds,
      videoUrls: opts.videoUrls,                      // ← 前一段整支影片(@Video1);平行時為空
      brandId: opts.brandId,
      kolName: opts.kolName,
      prompt: finalPrompt,
      duration: String(opts.durationSec || 5),
      aspectRatio: opts.aspectRatio || '9:16',
      resolution: opts.resolution || '720p',
      generateAudio: opts.generateAudio === true,     // 預設關,避免 AI 亂掰台詞
      tier: opts.tier || 'fast',
      seed: opts.seed,
      outfitImageUrl: opts.outfitImageUrl,   // 🆕 服裝參考圖(Riiv①):排最後一格,Worker 接
      sceneImageUrl: opts.sceneImageUrl,     // 🆕 場景參考圖(Riiv③):再排一格,Worker 接
    });
    // 🆕 webhook 把成品寫進 episodes/{requestId}.json → 問 episode_result 即可(瞬間、免 fal 輪詢延遲)
    const videoUrl = await pollEpisode(sub.requestId, opts.brandId, onTick);
    return videoUrl;
  }

  // 接片：多段 → 一條。🆕 v4.0：video_compose 也帶 webhook,改問 episode_result。
  async function composeSegments(segments, brandId, onTick) {
    // 容錯:相容舊呼叫 composeSegments(segments, onTick)
    if (typeof brandId === 'function') { onTick = brandId; brandId = undefined; }
    if (!Array.isArray(segments) || segments.length < 2)
      throw new Error('composeSegments 至少要 2 段');
    const sub = await api('video_compose', { segments, brandId: brandId });
    // 合成成品同樣由 webhook 寫進 R2 → 問 episode_result(reqId = 合成的 requestId)
    const url = await pollEpisode(sub.requestId, brandId, onTick);
    if (!url) throw new Error('接片沒拿到影片 URL');
    return url;
  }

  // ---- 流程控制（狀態機）：半自動 / 全自動共用 ----------------------------
  // plan: [{ prompt, durationSec?, seed? }, ...]   每段要做什麼
  // opts: {
  //   kolImageUrl / startImageUrl,   // 每段都當錨點的原始 KOL 照
  //   brandId, kolName,
  //   aspectRatio, resolution, generateAudio, tier, durationSec,
  //   productImageUrls / productDriveFileIds,
  //   onProgress(msg), onSegmentDone(segIndex, url),
  // }
  // 🆕 成品搬 R2:webhook 其實已存進 R2,這層是保險/命名;已是 R2 網址會直接短路回傳。
  async function toR2(videoUrl, brandId, nameHint) {
    try {
      const r = await api('video_to_r2', {
        videoUrl,
        brandId: brandId || 'stitch',
        nameHint: nameHint || 'final',
      });
      return (r && r.url) ? r.url : videoUrl;
    } catch (e) {
      console.warn('[KolStitch] R2 存檔失敗,改用原網址', e);
      return videoUrl;
    }
  }

  async function runStitchFlow(plan, opts) {
    opts = opts || {};
    const log = opts.onProgress || function () {};
    const kolImg = opts.kolImageUrl || opts.startImageUrl;
    if (!kolImg) throw new Error('缺少 kolImageUrl(原始 KOL 照,每段都當錨點)');
    if (!Array.isArray(plan) || plan.length < 1) throw new Error('plan 至少要 1 段');

    // v3.0 平行:每段只錨「原始照 + 商品照」、彼此不依賴 → 全部同時送、同時跑。
    //   總時間 ≈ 一段,不再相加。臉靠原始照守,不靠前一段影片。
    const total = plan.length;
    let doneCount = 0;
    log(`${total} 段同時生成中…(平行,背景 webhook 回報)`);
    // 🆕 整支接片共用同一 seed → 衣服/場景/光線跨段穩很多
    const stitchSeed = (opts.seed != null && opts.seed !== '')
      ? parseInt(opts.seed)
      : ((plan[0] && plan[0].seed != null && plan[0].seed !== '')
          ? parseInt(plan[0].seed)
          : Math.floor(Math.random() * 2000000000));
    log('本支共用 seed:' + stitchSeed);

    // 🆕 服裝參考圖(Riiv①):整支生一次(鎖布料跨段一致),每段共用同一張 → 衣服不再跨段變不同件
    let outfitImageUrl = opts.outfitImageUrl || null;
    try {
      if (!outfitImageUrl && window.KolWardrobe && typeof window.KolWardrobe.generateOutfitRefImage === 'function') {
        const outfitCtx = opts.outfitCtx || {
          outfitBrand: (window.S && window.S.selectedOutfitBrand) || '',
          sceneId: (window.S && window.S.selectedSceneId) || '',
        };
        log('生成服裝參考圖中…(鎖跨段衣服)');
        outfitImageUrl = await window.KolWardrobe.generateOutfitRefImage(outfitCtx);
      }
    } catch (e) { outfitImageUrl = null; }
    // 有衣服圖 → 每段 prompt 補 [OUTFIT_IMG] 點名(Worker 會換成真實 [ImageN];沒圖會自動清掉佔位符)
    if (outfitImageUrl) {
      plan = plan.map(function (s) {
        if (s && s.prompt && !/\[OUTFIT_IMG\]/.test(s.prompt)) {
          return Object.assign({}, s, {
            prompt: s.prompt + ', she is wearing the exact same outfit shown in [OUTFIT_IMG], identical garment pattern color and cut in every shot, no clothing change',
          });
        }
        return s;
      });
    }

    // 🆕 場景參考圖(Riiv③):整支生一次(鎖場景跨段一致),每段共用同一張 → 背景不再跨段飄
    let sceneImageUrl = opts.sceneImageUrl || null;
    try {
      if (!sceneImageUrl && window.KolEnvironment && typeof window.KolEnvironment.generateSceneRefImage === 'function') {
        const sceneCtx = opts.sceneCtx || {
          brandId: opts.brandId || (window.S && window.S.currentBrandId) || '',
          sceneId: (window.S && window.S.selectedSceneId) || '',
          locationId: (window.S && window.S.selectedLocationId) || 'none',
        };
        log('生成場景參考圖中…(鎖跨段背景)');
        sceneImageUrl = await window.KolEnvironment.generateSceneRefImage(sceneCtx);
      }
    } catch (e) { sceneImageUrl = null; }
    // 有場景圖 → 每段 prompt 補 [SCENE_IMG] 點名(Worker 會換成真實 [ImageN];沒圖會自動清掉佔位符)
    if (sceneImageUrl) {
      plan = plan.map(function (s) {
        if (s && s.prompt && !/\[SCENE_IMG\]/.test(s.prompt)) {
          return Object.assign({}, s, {
            prompt: s.prompt + ', the background environment and location exactly matches [SCENE_IMG], same setting layout and background in every shot, no scene change',
          });
        }
        return s;
      });
    }

    // 🆕 衣服圖+場景圖都生完了 → 把訊息翻成「段生成中」,別卡在「生成…參考圖中」看起來像當機
    log(`參考圖鎖定完成 ✓ · ${total} 段影片生成中…(背景平行跑,約幾分鐘)`);

    const tasks = plan.map(function (step, i) {
      const durSec = step.durationSec || opts.durationSec || 5;
      return generateSegment({
        kolImageUrl: kolImg,                 // 永遠原始照(臉一致)
        productImageUrls: opts.productImageUrls,
        productDriveFileIds: opts.productDriveFileIds,
        // ⚠️ 不傳 videoUrls → 不依賴前一段 → 才能平行
        prompt: step.prompt,
        durationSec: durSec,
        aspectRatio: opts.aspectRatio,
        resolution: opts.resolution,
        generateAudio: opts.generateAudio,
        tier: opts.tier,
        seed: stitchSeed,
        brandId: opts.brandId,
        kolName: opts.kolName,
        nationality: opts.nationality,       // 🆕 口音用:傳得到就用,傳不到 generateSegment 會自己讀 window.S
        outfitImageUrl: outfitImageUrl,      // 🆕 服裝參考圖:整支共用同一張(鎖跨段)
        sceneImageUrl: sceneImageUrl,        // 🆕 場景參考圖:整支共用同一張(鎖跨段)
      }, function () {}).then(function (segUrl) {
        doneCount++;
        log(`${doneCount}/${total} 段完成…`);
        if (opts.onSegmentDone) opts.onSegmentDone(i, segUrl);
        return { url: segUrl, durationSec: durSec };
      });
    });

    const segments = await Promise.all(tasks);   // 順序照 plan 保留

    if (segments.length === 1) {
      log('只有一段,免接片。存檔…');
      const only = await toR2(segments[0].url, opts.brandId, (opts.kolName || 'stitch') + '-1seg');
      log('完成!');
      return { finalUrl: only, segmentUrls: [segments[0].url] };
    }

    log('全部完成,接片中…');
    let finalUrl = await composeSegments(segments, opts.brandId, function (n, st) { log(`接片中…(${st})`); });
    log('成品存檔到 R2…');
    finalUrl = await toR2(finalUrl, opts.brandId, (opts.kolName || 'stitch') + '-' + segments.length + 'seg');
    log('完成!');
    return { finalUrl, segmentUrls: segments.map(function (s) { return s.url; }) };
  }

  console.log('[KolStitch] 🎬 v4.2 · webhook 背景生成 + 口音鐵律鎖 + 服裝/場景參考圖鎖跨段(接片總關卡)');

  // ---- 對外 ---------------------------------------------------------------
  return {
    init,
    extractLastFrame,
    generateSegment,
    composeSegments,
    runStitchFlow,
    pickUrl,
    pollEpisode,   // 🆕 對外,方便 kol.html 單段背景生成也共用
    _api: api,     // debug 用
  };
})();
