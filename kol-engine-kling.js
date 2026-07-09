// ==========================================================================
// kol-engine-kling.js — 攝影師② Kling v3 Pro adapter  v1.1
// --------------------------------------------------------------------------
// v1.1 變更(對上 Worker v3.50-kling 契約):
//   · elements 改傳 driveId(frontal_drive_id / reference_drive_ids),url 保留為 fallback
//     ★ 為什麼:多角度 sheet 圖放在 Drive「已處理」子夾,listKolPhotos 對該夾只回
//       thumbnail_url(w400 縮圖)。縮圖絕不能餵引擎(鐵律)。走 file_id → Worker
//       transferDriveToR2 才拿得到乾淨原圖。
//   · 新增 startDriveId(首幀也走乾淨原圖)
// --------------------------------------------------------------------------
// 引擎切換層:一個攝影師一個檔。載入時 self-register 到 window.KolEngines.kling。
// kol-stitch.js 只管「切段/送/輪詢/接片」(引擎無關);本檔只管 Kling 方言:
//   · 鎖臉:elements[0] = { 正臉 + 多角度 reference } → prompt 用 @Element1
//           ★ 這就是「用多角度圖走 Elements 鎖臉」→ 解 Phase1 臉漂移(單圖時臉在講話/動作中會飄)
//   · 商品:elements[1] → @Element2
//   · 分鏡:結構化 multi_prompt: [{prompt, duration}] + shot_type:'customize'(1~6 shot)
//   · 首幀:start_image = KOL 正臉(她從第一幀就在畫面 → 講話 KOL 最穩)
//   · 場景/服裝:MVP 先不塞 element(踩「資產不過載」鐵律)→ 先驗臉不漂,驗過再加
// --------------------------------------------------------------------------
// 契約(所有 engine adapter 共用):
//   window.KolEngines[id] = { id, label, async submitSegment(seg) -> { requestId } }
//   seg = {
//     kolFaceDriveId,      // 正臉 sheet_front 的 Drive file_id(首幀 + Element1 正臉)
//     kolAngleDriveIds,    // 其餘角度 sheet 圖 file_id 陣列(profile/q34…)→ 鎖臉關鍵
//     kolImageUrl,         // fallback:沒有 driveId 時才用
//     kolAngleUrls,        // fallback
//     productImageUrls,    // 商品圖(第一張 → Element2)
//     productDriveIds,     // 商品圖 driveId(優先)
//     outfitImageUrl, sceneImageUrl,   // MVP 暫不用(保留欄位,第二刀再接)
//     beats,               // [{prompt, durationSec, productUrl?}] → 每個 beat = 一個 Kling shot
//     totalSec, aspectRatio, resolution, generateAudio, seed,
//     brandId, kolName, nationality
//   }
// --------------------------------------------------------------------------
// ⚠️ Kling v3/o3 全系列並發上限預設 1/user → 多段排隊跑不是平行,總時間會拉長(外部限制,非 bug)。
// ⚠️ 口音鐵律:台灣 KOL 一律 Taiwanese Mandarin(natToAccent),永不裸奔成大陸腔。
// ==========================================================================
(function () {
  'use strict';

  const ENDPOINT = 'fal-ai/kling-video/v3/pro/image-to-video';  // Kling v3 Pro i2v(elements 鎖臉 + multi_prompt)
  const MAX_SHOTS = 6;   // Kling multi_prompt 上限

  // Worker 通道:借 KolStitch 的私有 api()(同一把密碼、同一個 workerUrl)。
  function callWorker(action, params) {
    if (!window.KolStitch || typeof window.KolStitch._api !== 'function') {
      throw new Error('KolEngine(kling):找不到 KolStitch._api,請確認 kol-stitch.js 已載入');
    }
    return window.KolStitch._api(action, params);
  }

  // 口音:照 KOL 國籍轉;台灣預設 Taiwanese Mandarin(鐵律)。
  function accentOf(seg) {
    const nat = seg.nationality
      || (window.S && window.S.selectedKol && window.S.selectedKol.persona && window.S.selectedKol.persona.nationality)
      || 'tw';
    return (typeof window.natToAccent === 'function') ? window.natToAccent(nat) : 'Taiwanese Mandarin';
  }

  // 每 shot 的 realism + 口音 + 生命感尾巴(精簡版,壓在 Kling 單 shot 2500 字上限內)。
  function realismTail(accent, audioOn) {
    let t = ' Photorealistic, natural daylight, true unretouched skin with real texture; '
      + 'soft even light on her face with no oily shine, no greasy T-zone, no hot specular highlights; '
      + 'she is never statue-still — natural hand gestures, subtle weight shifts, small head nods, natural blinking, '
      + 'her gaze drifts to the product and back to the lens, warm and alert, never a blank fixed stare.';
    if (audioOn) {
      t += ' Audio & lip-sync: she speaks ONLY the written dialogue in this shot, in natural ' + accent
        + ' at a normal conversational pace — brand names, product names and numbers pronounced clearly and cleanly, '
        + 'never slurred or mechanical, with natural lip-sync. She says exactly the written words and nothing else — '
        + 'do NOT invent, add, drop or repeat words, numbers or prices. In a shot with NO written dialogue '
        + '(holding, showing, reacting) she does NOT speak — mouth still, only natural ambient sound. '
        + 'After her final line she keeps natural closing body language until the last frame (no freezing).';
    }
    return t;
  }

  // 一個 beat → 一個 Kling shot 的 prompt(用 @Element1 指主角、@Element2 指商品)。
  function buildShotPrompt(beat, opts) {
    const action = ((typeof beat === 'string') ? beat : (beat.prompt || '')).trim();
    let p = '@Element1 ' + action;
    if (opts.hasProduct && (beat.productUrl || opts.forceProductEveryShot)) {
      p += ' She is holding @Element2 — this exact same physical product, kept at a consistent real-world size, '
        + 'not zoomed or resized.';
    }
    p += realismTail(opts.accent, opts.audioOn);
    return p.length > 2400 ? p.slice(0, 2400) : p;   // 防呆:單 shot prompt 上限
  }

  async function submitSegment(seg) {
    // 首幀/正臉:driveId 優先(乾淨原圖),沒有才退 url
    const faceId = seg.kolFaceDriveId || null;
    const faceUrl = seg.kolImageUrl || null;
    if (!faceId && !faceUrl) throw new Error('KolEngine(kling):缺少 kolFaceDriveId 或 kolImageUrl');

    let beats = (Array.isArray(seg.beats) && seg.beats.length)
      ? seg.beats.map(function (b) { return (typeof b === 'string') ? { prompt: b } : b; })
      : (seg.prompt ? [{ prompt: seg.prompt }] : null);
    if (!beats) throw new Error('KolEngine(kling):缺少 beats/prompt(這段的動作)');
    if (beats.length > MAX_SHOTS) beats = beats.slice(0, MAX_SHOTS);

    const accent = accentOf(seg);
    const audioOn = seg.generateAudio === true;

    // 商品:MVP 只綁第一件(@Element2)。多商品/分段換商品 → 第二刀處理(Wishlist)。
    const prodIds = Array.isArray(seg.productDriveIds) ? seg.productDriveIds.filter(Boolean) : [];
    const prodUrls = Array.isArray(seg.productImageUrls) ? seg.productImageUrls.filter(Boolean) : [];
    const hasProduct = prodIds.length > 0 || prodUrls.length > 0;

    const opts = { accent: accent, audioOn: audioOn, hasProduct: hasProduct };

    // multi_prompt:每個 beat 一個 shot,帶自己的秒數;總長由 KolStitch 已封頂 15s。
    const multiPrompt = beats.map(function (b) {
      const dur = (typeof b === 'object' && b.durationSec)
        ? b.durationSec
        : Math.max(1, Math.round((seg.totalSec || 5) / beats.length));
      return { prompt: buildShotPrompt(b, opts), duration: String(Math.max(3, Math.min(15, dur))) };
    });

    // elements:@Element1 = 臉(正臉 + 多角度 reference → 解臉漂移的核心);@Element2 = 商品
    const faceEl = {};
    if (faceId) faceEl.frontal_drive_id = faceId; else faceEl.frontal_image_url = faceUrl;
    const angleIds = Array.isArray(seg.kolAngleDriveIds) ? seg.kolAngleDriveIds.filter(Boolean).slice(0, 4) : [];
    const angleUrls = Array.isArray(seg.kolAngleUrls) ? seg.kolAngleUrls.filter(Boolean).slice(0, 4) : [];
    if (angleIds.length) faceEl.reference_drive_ids = angleIds;
    else if (angleUrls.length) faceEl.reference_image_urls = angleUrls;

    const elements = [faceEl];
    if (hasProduct) {
      const pEl = {};
      if (prodIds[0]) pEl.frontal_drive_id = prodIds[0]; else pEl.frontal_image_url = prodUrls[0];
      elements.push(pEl);
    }

    // 送 Worker:圖一律交給 Worker 走 R2 乾淨管線(鐵律),Worker kling_submit 負責
    //   driveId→transferDriveToR2 / url→transferUrlToR2,再 shrinkIfHuge,組 payload,fal_webhook,submit。
    const sub = await callWorker('kling_submit', {
      endpoint: ENDPOINT,
      startDriveId: faceId || undefined,        // 首幀 = 正臉(乾淨原圖)
      startImageUrl: faceId ? undefined : faceUrl,
      elements: elements,
      multiPrompt: multiPrompt,
      shotType: 'customize',
      totalSec: String(Math.max(3, Math.min(15, seg.totalSec || 5))),
      aspectRatio: seg.aspectRatio || '9:16',
      resolution: seg.resolution || '720p',
      generateAudio: audioOn,
      brandId: seg.brandId,
      kolName: seg.kolName
      // 不傳 episodeId → 每段 keyed by 自己 reqId,平行輪詢不撞 key(同 Seedance 路)
    });

    if (!sub || !sub.requestId) throw new Error('KolEngine(kling):Worker 沒回 requestId(' + JSON.stringify(sub).slice(0, 300) + ')');
    return { requestId: sub.requestId, engine: 'kling', endpoint: ENDPOINT, r2Refs: sub.r2Refs };
  }

  // ---- 註冊 ----------------------------------------------------------------
  window.KolEngines = window.KolEngines || {};
  window.KolEngines.kling = {
    id: 'kling',
    label: '敘事寫實 · 真人臉動作鎖',   // 客戶前台的風格化名稱(不露引擎名);內部 id = kling
    endpoint: ENDPOINT,
    submitSegment: submitSegment,
    // 除錯用:Console 直接看單 shot prompt,不送 fal、不燒點數。
    _preview: function (beats, seg) {
      seg = seg || {};
      const accent = accentOf(seg);
      const list = (Array.isArray(beats) ? beats : [beats]).map(function (b) { return (typeof b === 'string') ? { prompt: b } : b; });
      const hasProduct = !!((seg.productDriveIds && seg.productDriveIds.length) || (seg.productImageUrls && seg.productImageUrls.length));
      return list.map(function (b) { return buildShotPrompt(b, { accent: accent, audioOn: seg.generateAudio === true, hasProduct: hasProduct }); });
    }
  };

  console.log('[KolEngine] 🎥 攝影師② Kling v1.1 已註冊 · window.KolEngines.kling · '
    + 'driveId 乾淨原圖(不走 w400 縮圖) · elements 多角度鎖臉(解臉漂移) + multi_prompt 分鏡 · '
    + '口音鐵律(Taiwanese Mandarin) · ⚠️場景/服裝 MVP 暫不塞element(資產不過載) · ⚠️Kling並發=1→多段排隊跑');
})();
