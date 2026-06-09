// ==========================================================================
// kol-stitch.js — 自動接片引擎 v2.0
// v2.0：砍掉「尾幀接首幀」，改成 reference-to-video（每段回錨原始 KOL 照 + 商品照，
//       前一段「整支影片」當 @Video1 延續）→ 內心戲/表情會接住、畫質不再逐段衰退。
// --------------------------------------------------------------------------
// 設計原則：底層一次做對，半自動(mode:'semi') / 全自動(mode:'auto') 共用同一套。
// UI 只是薄薄一層蓋上去；換 UI 不用動這支。
//
// 依賴的 Worker action（都回傳 seedance_submit 同款格式 → 共用 fal_poll）：
//   seedance_image2video_submit  生一段（尾幀當第一幀，鎖臉）
//   extract_frame                抽幀（frame_type:'last' 抽尾幀）
//   video_compose                多段硬切接成一條
//   fal_poll                     輪詢（你現成的，沿用）
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
    password: 'raby2026', // Worker 每個 POST 都驗密碼，少了會被擋「密碼錯誤」
    pollIntervalMs: 5000,
    pollMaxTries: 180,    // 5s × 180 = 15 分鐘上限
    pollTask: null,       // 想用 kol.html 現成的輪詢，就 init({ pollTask: 你的函式 }) 換掉
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

  // 內建輪詢：拿 submit 回來的資料去打 fal_poll，直到出 URL
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

  // 抽尾幀：影片 URL → 最後一幀圖片 URL（伺服器端抽，繞過 CORS）
  async function extractLastFrame(videoUrl, onTick) {
    const sub = await api('extract_frame', { videoUrl, frameType: 'last' });
    const done = await poll(sub, onTick);
    const url = pickUrl(done);
    if (!url) throw new Error('抽尾幀沒拿到圖片 URL');
    return url;
  }

  // 生一段：永遠用「原始 KOL 照 + 商品照」當錨點，前一段「整支影片」當延續參考
  //（reference-to-video）。不再抽尾幀 → 內心戲/表情會接住，畫質也不會一段比一段爛。
  async function generateSegment(opts, onTick) {
    if (!opts.kolImageUrl) throw new Error('generateSegment 缺少 kolImageUrl（原始 KOL 照）');
    if (!opts.prompt) throw new Error('generateSegment 缺少 prompt');

    const sub = await api('seedance_submit', {
      kolImageUrl: opts.kolImageUrl,                  // ← 永遠原始照，不是尾幀（@Image1）
      productImageUrls: opts.productImageUrls,        // 商品照（@Image2…）
      productDriveFileIds: opts.productDriveFileIds,
      videoUrls: opts.videoUrls,                      // ← 前一段整支影片（@Video1）；第一段為空
      brandId: opts.brandId,
      kolName: opts.kolName,
      prompt: opts.prompt,
      duration: String(opts.durationSec || 5),
      aspectRatio: opts.aspectRatio || '9:16',
      resolution: opts.resolution || '720p',
      generateAudio: opts.generateAudio === true,     // 預設關，避免 AI 亂掰台詞
      tier: opts.tier || 'fast',
      seed: opts.seed,
    });
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
  //   onProgress(msg, segIndex),     // 進度回報
  //   onSegmentDone(segIndex, url),  // 每段完成
  //   waitForUserConfirm(i, url),    // 半自動：回一個 Promise，使用者按「下一步」才 resolve
  // }
  // 🆕 成品搬 R2:永久留存,不靠會過期的 fal 網址;失敗就退回原網址、不擋流程
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
    log(`${total} 段同時生成中…(平行)`);

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
        seed: step.seed,
        brandId: opts.brandId,
        kolName: opts.kolName,
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
    let finalUrl = await composeSegments(segments, function (n, st) { log(`接片中…(${st})`); });
    log('成品存檔到 R2…');
    finalUrl = await toR2(finalUrl, opts.brandId, (opts.kolName || 'stitch') + '-' + segments.length + 'seg');
    log('完成!');
    return { finalUrl, segmentUrls: segments.map(function (s) { return s.url; }) };
  }
  console.log('[KolStitch] 🎬 v3.0 · 平行(每段錨原始照,同時跑)');

  // ---- 對外 ---------------------------------------------------------------
  return {
    init,
    extractLastFrame,
    generateSegment,
    composeSegments,
    runStitchFlow,
    pickUrl,
    _api: api,   // debug 用
  };
})();
