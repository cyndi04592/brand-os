// ==========================================================================
// kol-stitch.js — 自動接片引擎 v1.1
// --------------------------------------------------------------------------
// v1.1 (修臉漂移)：引擎選擇改用「第幾段」決定,不再用「有沒有商品」。
//   段1     → reference-to-video（塞商品照,建立人+商品）
//   段2 起  → image2video（尾幀當第一幀 → 臉鎖死）
//   代價：段2 起不再餵商品照,商品靠段1尾幀延續,後段可能微漂（單引擎天花板）。
//
// 設計原則：底層一次做對,半自動(mode:'semi') / 全自動(mode:'auto') 共用同一套。
// UI 只是薄薄一層蓋上去；換 UI 不用動這支。
//
// 依賴的 Worker action（都回傳 seedance_submit 同款格式 → 共用 fal_poll）：
//   seedance_submit              生段1（reference-to-video，可塞商品照）
//   seedance_image2video_submit  生段2起（尾幀當第一幀,鎖臉）
//   extract_frame                抽幀（frame_type:'last' 抽尾幀）
//   video_compose                多段硬切接成一條
//   fal_poll                     輪詢（你現成的,沿用）
//
// 用法：
//   KolStitch.init({ workerUrl:'https://kol-proxy.calm-sunset-6b66.workers.dev' });
//   const { finalUrl } = await KolStitch.runStitchFlow(plan, opts);
// ==========================================================================
window.KolStitch = (function () {
  'use strict';

  // ---- 設定 ---------------------------------------------------------------
  const cfg = {
    workerUrl: 'https://kol-proxy.calm-sunset-6b66.workers.dev',
    password: 'raby2026', // Worker 每個 POST 都驗密碼,少了會被擋「密碼錯誤」
    pollIntervalMs: 5000,
    pollMaxTries: 180,    // 5s × 180 = 15 分鐘上限
    pollTask: null,       // 想用 kol.html 現成的輪詢,就 init({ pollTask: 你的函式 }) 換掉
  };
  function init(options) { Object.assign(cfg, options || {}); return cfg; }

  // ---- 底層工具 -----------------------------------------------------------

  // 打 Worker（所有 action 共用同一條）
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

  // 內建輪詢：拿 submit 回來的資料去打 fal_poll,直到出 URL
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

  // 抽尾幀：影片 URL → 最後一幀圖片 URL（伺服器端抽,繞過 CORS）
  async function extractLastFrame(videoUrl, onTick) {
    const sub = await api('extract_frame', { videoUrl, frameType: 'last' });
    const done = await poll(sub, onTick);
    const url = pickUrl(done);
    if (!url) throw new Error('抽尾幀沒拿到圖片 URL');
    return url;
  }

  // 🆕 v1.1：段2 起的 prompt。image2video 沒有 [Image1] 參考,
  // 不要再餵段1那套整段場景描述（會跟 image2video 打架）。
  // 重點全壓在「同一個人、同臉、同場景、同商品、自然接續」→ 把臉鎖死。
  function buildContinuationPrompt(originalPrompt) {
    return [
      'Continue seamlessly from the given starting frame.',
      'Exact same woman — identical face, hairstyle, skin texture and outfit as in the frame.',
      'Same room, same lighting, same product held in her hand. Do not change the scene or add new objects.',
      'Natural subtle movement and gestures, handheld iPhone vlog feel, photorealistic.',
      'Absolutely no morphing or re-drawing of the face; keep identity 100% consistent.',
    ].join(' ');
  }

  // 生一段：一張起始幀 → 一段影片
  // 🔑 v1.1：用 opts.useReference 決定引擎,不再用「有沒有商品」。
  //   useReference=true  → reference-to-video（可塞商品照,段1用）
  //   useReference=false → image2video（尾幀當第一幀,鎖臉,段2起用）
  //   未指定時退回舊行為（看有沒有商品）→ 向後相容,不影響其他呼叫者。
  async function generateSegment(opts, onTick) {
    if (!opts.startFrameUrl) throw new Error('generateSegment 缺少 startFrameUrl');
    if (!opts.prompt) throw new Error('generateSegment 缺少 prompt');

    var hasProduct = (opts.productImageUrls && opts.productImageUrls.length) ||
                     (opts.productDriveFileIds && opts.productDriveFileIds.length);
    var useReference = (opts.useReference != null) ? !!opts.useReference : !!hasProduct;

    var sub;
    if (useReference) {
      // reference-to-video：起始幀(人) + 商品照 一起當參考（沿用你現成的 seedance_submit）
      sub = await api('seedance_submit', {
        kolImageUrl: opts.startFrameUrl,
        productImageUrls: opts.productImageUrls,
        productDriveFileIds: opts.productDriveFileIds,
        brandId: opts.brandId,
        kolName: opts.kolName,
        prompt: opts.prompt,
        duration: String(opts.durationSec || 10),
        aspectRatio: opts.aspectRatio || '9:16',
        resolution: opts.resolution || '720p',
        generateAudio: opts.generateAudio === true,
        tier: opts.tier || 'standard',   // 商品線預設標準版,畫質較好
        seed: opts.seed,
      });
    } else {
      // image2video：單圖,尾幀接首幀臉100%（鎖臉關鍵）
      sub = await api('seedance_image2video_submit', {
        imageUrl: opts.startFrameUrl,        // ← 這段的第一幀（鎖臉關鍵）
        prompt: opts.prompt,
        duration: String(opts.durationSec || 10),
        aspectRatio: opts.aspectRatio || '9:16',
        resolution: opts.resolution || '720p',
        generateAudio: opts.generateAudio === true,  // 預設關,避免 AI 亂掰台詞
        tier: opts.tier,
        seed: opts.seed,
        endImageUrl: opts.endImageUrl,        // 選配：指定這段的結束畫面
      });
    }
    const done = await poll(sub, onTick);
    const url = pickUrl(done);
    if (!url) throw new Error('生成段落沒拿到影片 URL');
    return url;
  }

  // 接片：多段 → 一條（硬切；尾幀接首幀本來就接近無縫）
  async function composeSegments(segments, onTick) {
    // segments: [{ url, durationSec }]
    if (!Array.isArray(segments) || segments.length < 2)
      throw new Error('composeSegments 至少要 2 段');
    const sub = await api('video_compose', { segments });
    const done = await poll(sub, onTick);
    const url = pickUrl(done);
    if (!url) throw new Error('接片沒拿到影片 URL');
    return url;
  }

  // ---- 流程控制（狀態機）：半自動 / 全自動共用 ----------------------------
  // plan: [{ prompt, durationSec?, seed? }, ...]   每段要做什麼
  // opts: {
  //   startImageUrl,                 // 第一段的開場畫面（通常是 KOL 人像 URL）
  //   mode: 'semi' | 'auto',         // 半自動會在每段後停下等確認
  //   aspectRatio, resolution, generateAudio, tier, durationSec,
  //   productImageUrls / productDriveFileIds,  // 只有段1會用到
  //   onProgress(msg, segIndex),     // 進度回報
  //   onSegmentDone(segIndex, url),  // 每段完成
  //   waitForUserConfirm(i, url),    // 半自動：回一個 Promise,使用者按「下一步」才 resolve
  // }
  async function runStitchFlow(plan, opts) {
    opts = opts || {};
    const log = opts.onProgress || function () {};
    if (!opts.startImageUrl) throw new Error('缺少 startImageUrl（第一段開場畫面,通常是 KOL 人像）');
    if (!Array.isArray(plan) || plan.length < 1) throw new Error('plan 至少要 1 段');

    const segmentUrls = [];
    const segments = [];
    let prevFrame = opts.startImageUrl;   // 第一段從這張開始

    for (let i = 0; i < plan.length; i++) {
      const step = plan[i];
      const durSec = step.durationSec || opts.durationSec || 10;
      const isFirst = (i === 0);

      // 🔑 v1.1：段1 → reference-to-video（塞商品照）；段2起 → image2video（尾幀鎖臉）
      const segPrompt = isFirst ? step.prompt : buildContinuationPrompt(step.prompt);

      log(`第 ${i + 1}/${plan.length} 段：${isFirst ? '建立人物+商品' : '尾幀接首幀·鎖臉'} 生成中…`, i);
      const segUrl = await generateSegment({
        startFrameUrl: prevFrame,
        prompt: segPrompt,
        durationSec: durSec,
        aspectRatio: opts.aspectRatio,
        resolution: opts.resolution,
        generateAudio: opts.generateAudio,
        tier: opts.tier,
        seed: step.seed,
        useReference: isFirst,                                    // ← 關鍵：只有段1用 reference
        productImageUrls: isFirst ? opts.productImageUrls : null, // 商品照只在段1餵
        productDriveFileIds: isFirst ? opts.productDriveFileIds : null,
        brandId: opts.brandId,
        kolName: opts.kolName,
      }, function (n, st) { log(`第 ${i + 1} 段生成中…（${st}）`, i); });

      segmentUrls.push(segUrl);
      segments.push({ url: segUrl, durationSec: durSec });
      if (opts.onSegmentDone) opts.onSegmentDone(i, segUrl);

      // 不是最後一段 → 抽尾幀餵下一段
      if (i < plan.length - 1) {
        log(`第 ${i + 1} 段：抽尾幀…`, i);
        prevFrame = await extractLastFrame(segUrl);

        // 半自動：停下來等使用者確認再生下一段
        if (opts.mode === 'semi' && opts.waitForUserConfirm) {
          log(`第 ${i + 1} 段完成,等你確認…`, i);
          await opts.waitForUserConfirm(i, segUrl);
        }
      }
    }

    // 全部串起來
    if (segments.length === 1) {
      log('只有一段,免接片。完成！');
      return { finalUrl: segmentUrls[0], segmentUrls };
    }
    log('接片中…');
    const finalUrl = await composeSegments(segments, function (n, st) { log(`接片中…（${st}）`); });
    log('完成！');
    return { finalUrl, segmentUrls };
  }

  // ---- 對外 ---------------------------------------------------------------
  return {
    init,
    extractLastFrame,
    generateSegment,
    composeSegments,
    runStitchFlow,
    buildContinuationPrompt,
    pickUrl,
    _api: api,   // debug 用
  };
})();
