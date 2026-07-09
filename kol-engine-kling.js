// ==========================================================================
// kol-engine-kling.js — 攝影師② Kling v3 Pro adapter  v1.0
// --------------------------------------------------------------------------
// 引擎切換層:一個攝影師一個檔。載入時 self-register 到 window.KolEngines.kling。
// kol-stitch.js 只管「切段/送/輪詢/接片」(引擎無關);本檔只管 Kling 方言:
//   · 鎖臉:elements[0] = { frontal + 多角度 reference_image_urls } → prompt 用 @Element1
//           ★ 這就是「用妳的多角度圖走 Elements 鎖臉」→ 解 Phase1 的臉漂移(單圖時臉在講話/動作中會飄)
//   · 商品:elements[1] = { frontal } → @Element2
//   · 分鏡:結構化 multi_prompt: [{prompt, duration}]  + shot_type:'customize'(1~6 shot,總長 ≤15s)
//   · 首幀:start_image_url = KOL 全身圖(她從第一幀就在畫面 → 講話 KOL 最穩)
//   · 場景/服裝:MVP 先不塞 element(踩「資產不過載」鐵律)→ 先驗臉不漂,驗過再加
// --------------------------------------------------------------------------
// 契約(所有 engine adapter 共用):
//   window.KolEngines[id] = { id, label, async submitSegment(seg) -> { requestId } }
//   seg = {
//     kolImageUrl,            // 該 chunk 的 KOL 圖(當首幀 + Element1 正臉)
//     kolAngleUrls,           // KOL 多角度臉圖陣列(Element1 的 reference_image_urls)→ 鎖臉關鍵
//     productImageUrls,       // 商品圖(第一張 → Element2;MVP 只綁一件)
//     outfitImageUrl, sceneImageUrl,   // MVP 暫不用(保留欄位,第二刀再接)
//     beats,                  // [{prompt, durationSec, productUrl?}] → 每個 beat = 一個 Kling shot
//     totalSec, aspectRatio, resolution, generateAudio, seed,
//     brandId, kolName, nationality
//   }
// --------------------------------------------------------------------------
// ⚠️ Kling v3/o3 全系列並發上限預設 = 1/user → 多段是「排隊跑」不是平行,總時間會拉長(外部限制,非 bug)。
// ⚠️ 口音鐵律:台灣 KOL 一律 Taiwanese Mandarin(natToAccent),永不裸奔成大陸腔。
// ==========================================================================
(function () {
  'use strict';

  const ENDPOINT = 'fal-ai/kling-video/v3/pro/image-to-video';  // Kling v3 Pro i2v(elements 鎖臉 + multi_prompt)
  const MAX_SHOTS = 6;   // Kling multi_prompt 上限;KolStitch 預設每 chunk ≤4,安全

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

  // 每個 shot 的 realism + 口音 + 生命感尾巴(精簡版,遠短於 Seedance 大 prompt,單 shot 內壓在 Kling 2500 字上限內)。
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
    // 這個 shot 有綁商品 → 明確叫她拿 @Element2(同一件實體、尺寸不變)
    if (opts.hasProduct && (beat.productUrl || opts.forceProductEveryShot)) {
      p += ' She is holding @Element2 — this exact same physical product, kept at a consistent real-world size, '
        + 'not zoomed or resized.';
    }
    p += realismTail(opts.accent, opts.audioOn);
    // Kling 單 shot prompt 建議 <2500 字;超了硬切(理論上不會,防呆)。
    return p.length > 2400 ? p.slice(0, 2400) : p;
  }

  async function submitSegment(seg) {
    if (!seg || !seg.kolImageUrl) throw new Error('KolEngine(kling):缺少 kolImageUrl');
    let beats = (Array.isArray(seg.beats) && seg.beats.length)
      ? seg.beats.map(function (b) { return (typeof b === 'string') ? { prompt: b } : b; })
      : (seg.prompt ? [{ prompt: seg.prompt }] : null);
    if (!beats) throw new Error('KolEngine(kling):缺少 beats/prompt(這段的動作)');
    if (beats.length > MAX_SHOTS) beats = beats.slice(0, MAX_SHOTS);   // Kling 上限 6 shot

    const accent = accentOf(seg);
    const audioOn = seg.generateAudio === true;

    // 商品:MVP 只綁第一張(@Element2)。多商品/分段換商品 → 第二刀再處理(先收 Wishlist)。
    const products = Array.isArray(seg.productImageUrls) ? seg.productImageUrls.filter(Boolean) : [];
    const hasProduct = products.length > 0;

    const opts = { accent: accent, audioOn: audioOn, hasProduct: hasProduct };

    // multi_prompt:每個 beat 一個 shot,帶自己的秒數;總長由 KolStitch 已封頂 15s。
    const multiPrompt = beats.map(function (b) {
      const dur = (typeof b === 'object' && b.durationSec) ? b.durationSec : Math.max(1, Math.round((seg.totalSec || 5) / beats.length));
      return { prompt: buildShotPrompt(b, opts), duration: String(Math.max(3, Math.min(15, dur))) };
    });

    // elements:@Element1 = 臉(正臉 + 多角度 reference);@Element2 = 商品。
    //   多角度 reference_image_urls = 解臉漂移的核心(單張圖時臉在動作中會飄 → 多角度鎖住身份)。
    const elements = [{
      frontal_image_url: seg.kolImageUrl,
      reference_image_urls: Array.isArray(seg.kolAngleUrls) ? seg.kolAngleUrls.filter(Boolean).slice(0, 4) : []
    }];
    if (hasProduct) elements.push({ frontal_image_url: products[0], reference_image_urls: [] });

    // 送 Worker:圖交給 Worker 走 R2 乾淨管線(鐵律:餵引擎的圖必須乾淨 JPG,不是 WEBP/base64/縮圖),
    //   Worker kling_submit 負責:R2 中轉 + shrinkIfHuge + 組 payload + fal_webhook + submit。
    const sub = await callWorker('kling_submit', {
      endpoint: ENDPOINT,
      startImageUrl: seg.kolImageUrl,        // 首幀 = KOL 全身圖(她第一幀就在畫面)
      elements: elements,                    // Worker 端每張圖再過 R2;@Element 順序照這裡
      multiPrompt: multiPrompt,              // Kling 結構化分鏡
      shotType: 'customize',
      totalSec: String(Math.max(3, Math.min(15, seg.totalSec || 5))),
      aspectRatio: seg.aspectRatio || '9:16',
      resolution: seg.resolution || '720p',
      generateAudio: audioOn,
      brandId: seg.brandId,
      kolName: seg.kolName,
      // 不傳 episodeId → 每段 keyed by 自己 reqId,平行輪詢不撞 key(同 Seedance 路)
    });

    if (!sub || !sub.requestId) throw new Error('KolEngine(kling):Worker 沒回 requestId(' + JSON.stringify(sub).slice(0, 200) + ')');
    return { requestId: sub.requestId, engine: 'kling', endpoint: ENDPOINT };
  }

  // ---- 註冊 ----------------------------------------------------------------
  window.KolEngines = window.KolEngines || {};
  window.KolEngines.kling = {
    id: 'kling',
    label: '敘事寫實 · 真人臉動作鎖',   // 客戶前台的風格化名稱(不露引擎名);內部 id = kling
    endpoint: ENDPOINT,
    submitSegment: submitSegment,
    // 除錯用:Console 直接看單 shot prompt 長怎樣,不送 fal、不燒點數。
    _preview: function (beats, seg) {
      seg = seg || {};
      const accent = accentOf(seg);
      const list = (Array.isArray(beats) ? beats : [beats]).map(function (b) { return (typeof b === 'string') ? { prompt: b } : b; });
      return list.map(function (b) { return buildShotPrompt(b, { accent: accent, audioOn: seg.generateAudio === true, hasProduct: !!(seg.productImageUrls && seg.productImageUrls.length) }); });
    }
  };

  console.log('[KolEngine] 🎥 攝影師② Kling v1.0 已註冊 · window.KolEngines.kling · '
    + 'elements 多角度鎖臉(解臉漂移) + multi_prompt 分鏡 + start=KOL首幀 · 口音鐵律(Taiwanese Mandarin) · '
    + '⚠️場景/服裝 MVP 暫不塞element(資產不過載) · ⚠️Kling並發=1→多段排隊跑');
})();
