// ==========================================================================
// kol-stitch.js — 自動接片引擎 v5.0
// v5.0：compose → image-to-video 路徑(RIIV ⑥ 落地)——
//       每段不再「丟 4 張參考圖給 reference-to-video 自己拼」,改成:
//         ① nanobanana 把[臉+商品+服裝+場景+這段動作]合成「這一刻」的一張 keyframe
//            → 鎖人/商品/服裝/場景(全烤進同一張)
//         ② image-to-video 讓那張 keyframe 動起來 → 家具不飄(因為全在起始幀裡)
//       4 個錨整支共用 + 共用同一 seed → 6 張 keyframe 彼此一致(只有動作在變)。
//       臉真實感:compose 用「複製原圖真皮、不製造瑕疵」錨;口音鐵律保留。
//       ✅ v5.1:image-to-video 也帶 webhook(Worker seedance_image2video_submit v3.35)→
//          走 episode_result,跟 seedance_submit 一樣免輪詢 fal。compose 是同步,不需輪詢。
// --------------------------------------------------------------------------
// v4.1：口音鐵律鎖 —— 在所有分段的唯一出海口送 fal 前,自動補口音(擋大陸腔)。
// v4.0：webhook 背景生成(seedance_submit 路徑用;v5.0 的 i2v 路徑改回 fal_poll)。
// v3.0：平行 —— 每段彼此不依賴 → 全部同時送、同時跑。
// --------------------------------------------------------------------------
// 設計原則:底層一次做對,半自動 / 全自動共用同一套。UI 只是薄薄一層。
// ==========================================================================
window.KolStitch = (function () {
  'use strict';

  // ---- 設定 ---------------------------------------------------------------
  const cfg = {
    workerUrl: 'https://kol-proxy.calm-sunset-6b66.workers.dev',
    password: 'raby2026', // Worker 每個 POST 都驗密碼,少了會被擋「密碼錯誤」
    pollIntervalMs: 5000,
    pollMaxTries: 240,    // 5s × 240 = 20 分鐘上限
    pollTask: null,
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
    var u = r.videoUrl || r.imageUrl ||
            (r.video && r.video.url) || r.video_url ||
            (r.images && r.images[0] && r.images[0].url) ||
            (r.image && r.image.url) ||
            (r.output && r.output.video && r.output.video.url) ||
            r.url || null;
    if (u) return u;
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

  // webhook 輪詢 —— 問 episode_result(seedance_submit / video_compose 路徑用)。
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
        if (String((e && e.message) || '').indexOf('生成失敗') !== -1) throw e;
      }
      await new Promise(res => setTimeout(res, cfg.pollIntervalMs));
    }
    throw new Error('等待逾時(超過 ' + (cfg.pollMaxTries * cfg.pollIntervalMs / 60000) + ' 分鐘還沒回來)');
  }

  // fal_poll 輪詢 —— 舊路徑/extractLastFrame 用(v5.1 的 i2v 已改 webhook,這條保留不刪)。
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

  // ---- 積木 ---------------------------------------------------------------

  // 抽尾幀（舊路徑用,保留）
  async function extractLastFrame(videoUrl, onTick) {
    const sub = await api('extract_frame', { videoUrl, frameType: 'last' });
    const done = await poll(sub, onTick);
    const url = pickUrl(done);
    if (!url) throw new Error('抽尾幀沒拿到圖片 URL');
    return url;
  }

  // 🆕 v5.0 compose 用的真實感錨(複製原圖真皮、不製造瑕疵 —— 本場實測驗過的版本)
  function buildComposePrompt(action) {
    return 'This is a real, unretouched iPhone photo of the exact woman in the first reference image. '
      + 'The other reference images show the product, her outfit, and the environment. '
      + 'Reproduce her face and skin EXACTLY as in the first image — identical skin, texture and any existing marks; '
      + 'do NOT beautify, smooth, airbrush, or add/remove/alter any skin detail, nothing invented. '
      + 'She wears the exact outfit and is in the exact environment shown in the reference images, '
      + 'holding or using the product at a realistic small size (about the height of her face), clearly visible but not enlarged. '
      + 'This moment shows: ' + action + ' — render it as a natural candid still photo. '
      + 'Matte natural skin, not glowing or dewy, soft natural daylight, subtle camera grain, true-to-life, not stylized.';
  }

  // 🆕 v5.0 image-to-video 用的動態錨(動作 + 鎖一致 + 抗磨皮)
  function buildAnimPrompt(motion) {
    return 'Animate the starting frame with subtle natural motion only. ' + motion
      + '. Keep her face, skin texture, the product, outfit, furniture and background EXACTLY consistent with the starting frame; '
      + 'do not smooth, beautify or retouch the skin; single continuous shot, one fixed location, camera mostly still, no scene change, no cut; '
      + 'realistic unretouched skin, subtle film grain, true-to-life, not glossy.';
  }

  // 生一段（v5.0：compose keyframe → image-to-video）
  //   opts.prompt = 這段的動作(來自分鏡);臉/商品/服裝/場景由參考圖鎖。
  async function generateSegment(opts, onTick) {
    if (!opts.kolImageUrl) throw new Error('generateSegment 缺少 kolImageUrl（原始 KOL 照）');
    if (!opts.prompt) throw new Error('generateSegment 缺少 prompt（這段動作）');

    const action = opts.prompt;

    // ① 合成 keyframe：[臉(first) + 商品 + 服裝 + 場景] + 這段動作 → 一張
    const refs = [opts.kolImageUrl]
      .concat(Array.isArray(opts.productImageUrls) ? opts.productImageUrls : [])
      .concat(opts.outfitImageUrl ? [opts.outfitImageUrl] : [])
      .concat(opts.sceneImageUrl ? [opts.sceneImageUrl] : [])
      .filter(Boolean);

    if (onTick) onTick(0, 'compose');
    const composed = await api('nanobanana_compose', {
      prompt: buildComposePrompt(action),
      image_urls: refs,
      resolution: '2K',
    });
    const keyframeUrl = (composed && composed.images && composed.images[0] && composed.images[0].url) || null;
    if (!keyframeUrl) throw new Error('compose 沒拿到 keyframe');

    // 🔒 口音鐵律(保留):開了語音且 prompt 還沒鎖口音 → 補(台灣 KOL→台灣國語,擋大陸腔)
    let motion = action;
    if (opts.generateAudio === true && !/Mandarin/i.test(motion)) {
      const _nat = opts.nationality
        || (window.S && window.S.selectedKol && window.S.selectedKol.persona && window.S.selectedKol.persona.nationality)
        || 'tw';
      const _accent = (typeof window.natToAccent === 'function') ? window.natToAccent(_nat) : 'Taiwanese Mandarin';
      motion += `. She speaks in natural ${_accent}, clear lip-sync.`;
    }

    // ② image-to-video：起始幀 = keyframe → 動(家具不飄)
    if (onTick) onTick(0, 'i2v');
    const sub = await api('seedance_image2video_submit', {
      imageUrl: keyframeUrl,
      prompt: buildAnimPrompt(motion),
      duration: String(opts.durationSec || 5),
      aspectRatio: opts.aspectRatio || '9:16',
      resolution: opts.resolution || '720p',
      generateAudio: opts.generateAudio === true,
      tier: opts.tier || 'fast',
      seed: opts.seed,
      brandId: opts.brandId,          // 🆕 webhook 用:fal_hook 以 brand + reqId 寫 R2
      // 不傳 episodeId → 每段 keyed by 自己的 reqId,平行不撞 key
    });

    // 🆕 v5.1:i2v 帶 webhook → 問 episode_result(跟 seedance_submit 一樣,免輪詢 fal)
    const videoUrl = await pollEpisode(sub.requestId, opts.brandId, onTick);
    if (!videoUrl) throw new Error('i2v 沒拿到影片 URL');
    return videoUrl;
  }

  // 接片：多段 → 一條(webhook,不變)
  async function composeSegments(segments, brandId, onTick) {
    if (typeof brandId === 'function') { onTick = brandId; brandId = undefined; }
    if (!Array.isArray(segments) || segments.length < 2)
      throw new Error('composeSegments 至少要 2 段');
    const sub = await api('video_compose', { segments, brandId: brandId });
    const url = await pollEpisode(sub.requestId, brandId, onTick);
    if (!url) throw new Error('接片沒拿到影片 URL');
    return url;
  }

  // 成品搬 R2(不變)
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

  // ---- 流程控制：半自動 / 全自動共用 ---------------------------------------
  // plan: [{ prompt(這段動作), durationSec?, seed?, kolImageUrl? }, ...]
  async function runStitchFlow(plan, opts) {
    opts = opts || {};
    const log = opts.onProgress || function () {};
    const kolImg = opts.kolImageUrl || opts.startImageUrl;
    if (!kolImg) throw new Error('缺少 kolImageUrl(原始 KOL 照,每段都當錨點)');
    if (!Array.isArray(plan) || plan.length < 1) throw new Error('plan 至少要 1 段');

    const total = plan.length;
    let doneCount = 0;
    log(`${total} 段同時生成中…(平行,compose → image-to-video)`);

    // 整支共用同一 seed → 6 張 keyframe 彼此更一致
    const stitchSeed = (opts.seed != null && opts.seed !== '')
      ? parseInt(opts.seed)
      : ((plan[0] && plan[0].seed != null && plan[0].seed !== '')
          ? parseInt(plan[0].seed)
          : Math.floor(Math.random() * 2000000000));
    log('本支共用 seed:' + stitchSeed);

    // 服裝參考圖(整支生一次,當 compose 的輸入之一)
    let outfitImageUrl = opts.outfitImageUrl || null;
    try {
      if (!outfitImageUrl && window.KolWardrobe && typeof window.KolWardrobe.generateOutfitRefImage === 'function') {
        const outfitCtx = opts.outfitCtx || {
          outfitBrand: (window.S && window.S.selectedOutfitBrand) || '',
          sceneId: (window.S && window.S.selectedSceneId) || '',
        };
        log('生成服裝參考圖中…(當 compose 輸入,鎖跨段衣服)');
        outfitImageUrl = await window.KolWardrobe.generateOutfitRefImage(outfitCtx);
      }
    } catch (e) { outfitImageUrl = null; }

    // 場景參考圖(整支生一次,當 compose 的輸入之一)
    let sceneImageUrl = opts.sceneImageUrl || null;
    try {
      if (!sceneImageUrl && window.KolEnvironment && typeof window.KolEnvironment.generateSceneRefImage === 'function') {
        const sceneCtx = opts.sceneCtx || {
          brandId: opts.brandId || (window.S && window.S.currentBrandId) || '',
          sceneId: (window.S && window.S.selectedSceneId) || '',
          locationId: (window.S && window.S.selectedLocationId) || 'none',
        };
        log('生成場景參考圖中…(當 compose 輸入,鎖跨段背景)');
        sceneImageUrl = await window.KolEnvironment.generateSceneRefImage(sceneCtx);
      }
    } catch (e) { sceneImageUrl = null; }

    // ⚠️ v5.0:不再往 prompt 補 [OUTFIT_IMG]/[SCENE_IMG] 文字 pin ——
    //    服裝/場景改成「真的圖」餵進 compose,keyframe 已含,不需文字佔位符。

    log(`參考圖鎖定完成 ✓ · ${total} 段生成中…(每段 compose→動,約幾分鐘)`);

    const tasks = plan.map(function (step, i) {
      const durSec = step.durationSec || opts.durationSec || 5;
      return generateSegment({
        kolImageUrl: step.kolImageUrl || kolImg,   // 每段可帶自己的角度圖,沒帶才退全域
        productImageUrls: opts.productImageUrls,
        prompt: step.prompt,                       // 這段的動作(來自分鏡)
        durationSec: durSec,
        aspectRatio: opts.aspectRatio,
        resolution: opts.resolution,
        generateAudio: opts.generateAudio,
        tier: opts.tier,
        seed: stitchSeed,
        brandId: opts.brandId,
        kolName: opts.kolName,
        nationality: opts.nationality,
        outfitImageUrl: outfitImageUrl,            // → compose 輸入(整支共用)
        sceneImageUrl: sceneImageUrl,              // → compose 輸入(整支共用)
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

  console.log('[KolStitch] 🎬 v5.1 · compose(nanobanana)→image-to-video(webhook) · 4錨+共用seed鎖跨段 · 口音鐵律保留');

  // ---- 對外 ---------------------------------------------------------------
  return {
    init,
    extractLastFrame,
    generateSegment,
    composeSegments,
    runStitchFlow,
    pickUrl,
    pollEpisode,
    _api: api,
  };
})();
