// ==========================================================================
// kol-stitch.js — 自動接片引擎 v6.4
// v6.2：照分鏡秒數切 15 秒 chunk + 每個 chunk 用自己的角度圖 + beat 當 Shot(對齊 STEP2/STEP3 的 plan)。每段 = 多鏡頭 reference-to-video,原始 KOL 照當 [Image1] 鎖臉
//       Seedance 2.0 reference-to-video,臉由模型層鎖死 → 跨段同一個又晴本人(不重畫、不換臉)。
//         · [Image1] = 又晴原圖   → 鎖臉(這是她舊片臉永遠對的原因)
//         · [SCENE_IMG]→[ImageN]  → 鎖家具/背景(空場景參考圖)
//         · [OUTFIT_IMG]→[ImageN] → 鎖服裝(無臉假人圖)
//         · 商品照            → 一起餵,鎖商品
//       走 seedance_submit(Worker 既有 reference-to-video action)+ webhook(episode_result)。
//       ⛔ 棄用:v5.x 的 nanobanana compose / image-to-video / 定裝照 anchor / pixverse 換臉 ——
//          那條會「每段重畫臉」→ 變不同人/第三個人(本場實測全失敗)。臉永遠交給原圖,不重畫。
// --------------------------------------------------------------------------
// v4.1：口音鐵律鎖 —— 在所有分段的唯一出海口送 fal 前,自動補口音(擋大陸腔)。
// v4.0：webhook 背景生成。v3.0：平行 —— 每段彼此不依賴 → 全部同時送、同時跑。
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

  // v6.2 多鏡頭 prompt:一次生成、內含多個 Shot(角度切換),家具/臉跨鏡頭鎖。
  //   beats = [{prompt, durationSec}] 或字串陣列;timecode 照每個 beat 的真實秒數排(尊重分鏡)。
  //   [Image1]=KOL角度圖(臉錨)· [SCENE_IMG]=同一間房 · [OUTFIT_IMG]=同一件衣服(Worker 換成真 [ImageN])。
  function buildMultiShotPrompt(beats, totalSec, shared) {
    const list = beats.map(function (b) { return (typeof b === 'string') ? { prompt: b } : b; });
    const n = Math.max(1, list.length);
    const dur = totalSec || 15;
    const pad = function (x) { return String(Math.round(x)).padStart(2, '0'); };

    // 🆕 B 版(精簡敘事·去重複):有 shared.front 才走這條;真實度核心擺最前、講一次,每段只放靈魂(動作+台詞)。
    //   沒傳 shared → 直接落到下面 A 版(現狀),向後相容、不影響現在生成。
    if (shared && shared.front) {
      let bodyB = shared.front + '\n'
        + 'Across all shots: the SAME woman [Image1], the same location [SCENE_IMG], the same outfit [OUTFIT_IMG], '
        + 'one unified colour grade and the same lighting across every cut — no change of person, scene, outfit or lighting, '
        + 'no smoothing or beautifying, no crowd.\n\n';
      let tb = 0;
      for (let i = 0; i < n; i++) {
        const bSecB = list[i].durationSec || Math.max(1, Math.round(dur / n));
        const tb0 = tb, tb1 = (i === n - 1) ? dur : Math.min(dur, tb + bSecB);
        const markerB = (i === 0) ? 'Shot 1' : ('Hard cut to Shot ' + (i + 1));
        bodyB += '[00:' + pad(tb0) + '-00:' + pad(tb1) + '] ' + markerB + ': [Image1] ' + (list[i].prompt || '') + '\n';
        tb = tb1;
      }
      if (shared.tail) bodyB += '\n' + shared.tail;
      return bodyB;
    }

    let body = 'candid realistic vertical UGC video, natural daylight, true-to-life skin.\n'
      + "Use [Image1] for the woman's face and identity. She is in the exact location of [SCENE_IMG], "
      + 'wearing the exact outfit of [OUTFIT_IMG], naturally holding and showing the product.\n\n';
    let t = 0;
    for (let i = 0; i < n; i++) {
      const bSec = list[i].durationSec || Math.max(1, Math.round(dur / n));
      const t0 = t;
      const t1 = (i === n - 1) ? dur : Math.min(dur, t + bSec);
      const marker = (i === 0) ? 'Shot 1' : ('Hard cut to Shot ' + (i + 1));
      body += '[00:' + pad(t0) + '-00:' + pad(t1) + '] ' + marker
        + ': the SAME woman [Image1] in the SAME location [SCENE_IMG] with the SAME background, wearing [OUTFIT_IMG]. '
        + (list[i].prompt || '') + '\n';
      t = t1;
    }
    body += '\nGlobal: it is the same woman, the same location and the same background across all shots; '
      + 'keep the exact same lighting in every shot — the same light direction, intensity and colour temperature, matching the setting (indoor or outdoor) — and do not change the lighting between cuts; '
      + 'camera mostly steady; realistic unretouched skin with real texture; '
      + 'keep her face exactly [Image1]; do not change her face, the location, the background or the outfit between cuts. '
      + 'No change of setting, no different person, no smoothing or beautifying, no crowd.';
    return body;
  }

  // 生一段(v6.2:一次生成多鏡頭 reference-to-video。chunk 內含多個 beat(Shot),
  //   每個 beat 帶自己的動作+秒數;chunk 總長 = 各 beat 秒數加總(封頂 15)。
  //   臉=[Image1](該 chunk 的 KOL 角度圖,模型層鎖)+ 場景圖 + 服裝圖 + 商品。不重畫、不換臉。
  //   相容:opts.beats(物件陣列,STEP2/STEP3 用)> opts.shots(字串陣列)> opts.prompt(單一)。
  async function generateSegment(opts, onTick) {
    if (!opts.kolImageUrl) throw new Error('generateSegment 缺少 kolImageUrl（KOL 角度圖）');
    let beats = (Array.isArray(opts.beats) && opts.beats.length) ? opts.beats
              : (Array.isArray(opts.shots) && opts.shots.length) ? opts.shots.map(function (s) { return { prompt: s }; })
              : (opts.prompt ? [{ prompt: opts.prompt }] : null);
    if (!beats) throw new Error('generateSegment 缺少 beats/shots/prompt（這個 chunk 的動作）');

    // chunk 總長 = 各 beat 秒數加總,封頂 15(Seedance 單次上限);沒給秒數 → 預設每 beat 5 秒。
    let totalSec = beats.reduce(function (a, b) {
      return a + ((typeof b === 'object' && b.durationSec) ? b.durationSec : 5);
    }, 0);
    totalSec = Math.max(3, Math.min(15, totalSec || 15));

    let prompt = buildMultiShotPrompt(beats, totalSec, opts.shared);

    // 🔒 口音 + 口型鐵律(v6.4):開語音時,只有「有台詞的鏡頭」才說話+對嘴;
    //   沒台詞的鏡頭(吃/咀嚼/拿商品/純反應)→ 不講話、嘴不動、只有環境音 → 解決「邊吃邊有人聲」desync。
    if (opts.generateAudio === true && !/lip-sync/i.test(prompt)) {
      const _nat = opts.nationality
        || (window.S && window.S.selectedKol && window.S.selectedKol.persona && window.S.selectedKol.persona.nationality)
        || 'tw';
      const _accent = (typeof window.natToAccent === 'function') ? window.natToAccent(_nat) : 'Taiwanese Mandarin';
      prompt += '\nAudio & lip-sync: she speaks ONLY the spoken dialogue explicitly written in a shot, in natural ' + _accent
        + ' with clear lip-sync. In any shot with NO written dialogue (eating, chewing, tasting, holding or showing the product, or simply reacting) she does NOT speak — her mouth does not form words, there is no voice-over, only natural ambient sound.';
    }

    // reference-to-video:KOL臉=[Image1] 鎖身份 + 商品 + 服裝 + 場景(最多9張)。
    //   Worker 自動把 [OUTFIT_IMG]/[SCENE_IMG] 換成真實 [ImageN]。
    if (onTick) onTick(0, 'reference-to-video(多鏡頭)');
    const sub = await api('seedance_submit', {
      kolImageUrl: opts.kolImageUrl,                                       // → [Image1] 臉錨(該 chunk 的角度圖)
      productImageUrls: Array.isArray(opts.productImageUrls) ? opts.productImageUrls : [],
      outfitImageUrl: opts.outfitImageUrl || undefined,                    // → [OUTFIT_IMG]→[ImageN]
      sceneImageUrl: opts.sceneImageUrl || undefined,                      // → [SCENE_IMG]→[ImageN]
      prompt: prompt,
      brandId: opts.brandId,
      kolName: opts.kolName,
      duration: String(totalSec),                                          // v6.2:照分鏡秒數加總(封頂 15)
      aspectRatio: opts.aspectRatio || '9:16',
      resolution: opts.resolution || '720p',
      generateAudio: opts.generateAudio === true,
      tier: opts.tier || 'fast',
      seed: opts.seed,
      // 不傳 episodeId → 每段 keyed by 自己 reqId,平行不撞 key
    });

    const videoUrl = await pollEpisode(sub.requestId, opts.brandId, onTick);
    if (!videoUrl) throw new Error('reference-to-video 沒拿到影片 URL');
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

    // v6.2:把分鏡整理成 chunks —— 照「累積秒數 ≤15s 且 Shot 數 ≤maxShots」切,每個 chunk = 一次多鏡頭生成。
    //   傳 [{shots:[...]}] 直接用;傳一串 beat 物件(STEP2/STEP3:{prompt,durationSec,kolImageUrl,...})→ 照秒數併。
    const MAX_CHUNK_SEC = opts.maxChunkSec || 15;   // 一個 chunk 上限 15 秒(Seedance 單次上限)
    const MAX_SHOTS = opts.shotsPerChunk || 4;      // 一個 chunk 最多幾個 Shot(避免太碎)
    let chunks;
    if (plan[0] && Array.isArray(plan[0].shots)) {
      chunks = plan.map(function (c) {
        return { beats: c.shots.map(function (s) { return (typeof s === 'string') ? { prompt: s } : s; }), kolImageUrl: c.kolImageUrl, seed: c.seed };
      });
    } else {
      const beatObjs = plan.map(function (p) { return (typeof p === 'string') ? { prompt: p } : p; })
                           .filter(function (b) { return b && b.prompt; });
      chunks = [];
      let cur = [], curSec = 0;
      beatObjs.forEach(function (b) {
        const bSec = b.durationSec || 5;
        if (cur.length && (curSec + bSec > MAX_CHUNK_SEC || cur.length >= MAX_SHOTS)) {
          chunks.push({ beats: cur }); cur = []; curSec = 0;
        }
        cur.push(b); curSec += bSec;
      });
      if (cur.length) chunks.push({ beats: cur });
    }

    // 🛡️ v6.4 防呆:分鏡未確認前,先攤開「要生幾段·幾秒·每段開頭」給看,留一次喊停的機會(擋掉誤燒 90 秒=6 段 fal 額度)。
    //    程式化呼叫(無 UI)可傳 opts.confirmed = true 略過此檢查。
    if (!opts.confirmed && typeof window !== 'undefined' && typeof window.confirm === 'function') {
      const _segSec = chunks.map(function (c) {
        return (c.beats || []).reduce(function (a, b) { return a + (b.durationSec || 5); }, 0) || 0;
      });
      const _totalSec = _segSec.reduce(function (a, b) { return a + b; }, 0);
      const _lines = chunks.map(function (c, i) {
        const _head = (((c.beats && c.beats[0] && c.beats[0].prompt) || '(空)') + '').slice(0, 30);
        return '  第' + (i + 1) + '段(' + _segSec[i] + 's):' + _head + '…';
      }).join('\n');
      const _ok = window.confirm(
        '⚠️ 確認分鏡再生成(會消耗 fal 額度)\n\n' +
        '共 ' + chunks.length + ' 段、約 ' + _totalSec + ' 秒:\n' + _lines +
        '\n\n確定用這個分鏡開始生成嗎?'
      );
      if (!_ok) {
        log('🛑 已取消:分鏡未確認,沒有送出任何生成。');
        throw new Error('STORYBOARD_NOT_CONFIRMED');  // 呼叫端 try/catch 接住 → 顯示「已取消」即可
      }
      log('✅ 分鏡已確認,開始生成。');
    }

    const total = chunks.length;
    let doneCount = 0;
    log(`${total} 段 × 15 秒多鏡頭同時生成中…(平行,reference-to-video · 臉=[Image1] 原圖鎖 · 場景圖鎖家具)`);

    // 整支共用同一 seed → 6 張 keyframe 彼此更一致
    const stitchSeed = (opts.seed != null && opts.seed !== '')
      ? parseInt(opts.seed)
      : ((chunks[0] && chunks[0].seed != null && chunks[0].seed !== '')
          ? parseInt(chunks[0].seed)
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

    log(`參考圖鎖定完成 ✓ · ${total} 段 × 15 秒多鏡頭生成中…(臉=[Image1]原圖 · 家具=同一張場景圖跨段鎖)`);

    const tasks = chunks.map(function (chunk, i) {
      const beats = chunk.beats || [];
      const chunkSec = Math.min(15, Math.max(3, beats.reduce(function (a, b) { return a + (b.durationSec || 5); }, 0) || 15));
      // 該 chunk 的 KOL 圖:用第一個 beat 的角度圖(STEP2/STEP3 已挑好)→ 沒有才退 chunk/全域
      const chunkKol = (beats[0] && beats[0].kolImageUrl) || chunk.kolImageUrl || kolImg;
      return generateSegment({
        shared: opts.shared,                       // 🆕 B 版共用區塊(front/tail);沒傳就走 A 版
        kolImageUrl: chunkKol,                     // v6.2:用該 chunk 的角度圖當 [Image1](臉錨)
        productImageUrls: opts.productImageUrls,
        beats: beats,                              // v6.2:整個 chunk 的 beat 物件(含動作+秒數)→ 多 Shot
        aspectRatio: opts.aspectRatio,
        resolution: opts.resolution,
        generateAudio: opts.generateAudio,
        tier: opts.tier,
        seed: stitchSeed,
        brandId: opts.brandId,
        kolName: opts.kolName,
        nationality: opts.nationality || (beats[0] && beats[0].nationality),
        outfitImageUrl: outfitImageUrl,            // → [OUTFIT_IMG](整支共用,鎖同一件衣服)
        sceneImageUrl: sceneImageUrl,              // → [SCENE_IMG](整支共用,鎖同一間房 → 跨段家具一致)
      }, function () {}).then(function (segUrl) {
        doneCount++;
        log(`${doneCount}/${total} 段完成…`);
        if (opts.onSegmentDone) opts.onSegmentDone(i, segUrl);
        return { url: segUrl, durationSec: chunkSec };
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

  console.log('[KolStitch] 🎬 v6.7 · 多鏡頭 reference-to-video(已驗證五鎖) · 照分鏡秒數切chunk + 每chunk角度圖 + beat當Shot · 場景圖跨段鎖 + 光向鎖(通用) · 口型綁台詞(沒台詞不講話·只環境音) · 共用seed · 🛡️分鏡防呆 · 🎬精簡敘事B版(shared front/tail·真實度擺最前·無shared則走A版)');

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
