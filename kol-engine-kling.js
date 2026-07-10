// ==========================================================================
// kol-engine-kling.js — 攝影師② Kling v3 Pro adapter  v1.2
// --------------------------------------------------------------------------
// v1.2 變更(打 422「Prompt must not exceed 512 characters」):
//   ★ 硬事實(fal 官方):multi_prompt 每個 shot 的 prompt 上限 = 512 字元
//     (2500 是「單 prompt 模式」的上限,不適用 multi_prompt)。
//   ★ 修法照 RA 的 kol-cinematographer v5.26 壓縮法則,不自創:
//       ①去跨模組重複句 ②濃縮同義句 ③保留不可拔靈魂
//     再加一招:負向詞 → negative_prompt(Kling 獨立欄位,不佔 512)= 「不是刪掉,是搬家」。
//   ★ 超額處理 = 「按塊丟棄」(dropBlock),絕不 slice 腰斬句子破壞語意。
//     優先級:動作(絕不丟) > 商品錨 > 音訊/口音錨 > 寫實錨 > 生命感錨
//   · 新增 negative_prompt / cfg_scale(0.6,比官方 0.5 更貼分鏡)
//
// 逐句去向(語意零犧牲,可追溯):
//   no beauty filter / no smoothing / no retouching        → negative_prompt
//   no oily shine / greasy T-zone / specular highlights     → negative_prompt(三句同義,合一)
//   not a polished model / no studio polish                 → negative_prompt
//   never statue-still / blank fixed stare                   → negative_prompt(負向)
//   do NOT invent / add / drop / repeat words                → negative_prompt
//   no background music / soundtrack / jingle (AUDIO_REALISM)→ negative_prompt(Kling 版原本漏,補上)
//   handheld phone vlog / natural light / skin like ref      → 留 prompt(正向錨)
//   gestures / weight shifts / blinking / gaze               → 留 prompt(生命感正向錨)
//   🔒 Taiwanese Mandarin                                    → 留 prompt(鐵律·v5.18 誤拔過)
// --------------------------------------------------------------------------
// 引擎切換層:一個攝影師一個檔。載入時 self-register 到 window.KolEngines.kling。
//   · 鎖臉:elements[0] = { 正臉 + 多角度 reference } → prompt 用 @Element1(解臉漂移,已驗證)
//   · 商品:elements[1] → @Element2(⚠️ fal 規定 frontal + reference 成對,Worker v3.51 自動補)
//   · 分鏡:multi_prompt: [{prompt, duration}] + shot_type:'customize'(1~6 shot)
//   · 首幀:start_image = KOL 正臉。⚠️ aspect_ratio 被模型忽略,實際比例由首幀圖決定
//     (欣怡 sheet_front = 1000×1321 → 輸出 3:4。要 9:16 得先裁圖 → Wishlist)
//   · 場景/服裝:MVP 先不塞 element(踩「資產不過載」鐵律)
// --------------------------------------------------------------------------
// ⚠️ Kling v3/o3 全系列並發上限預設 1/user → 多段排隊跑,非 bug。
// ==========================================================================
(function () {
  'use strict';

  const ENDPOINT = 'fal-ai/kling-video/v3/pro/image-to-video';
  const MAX_SHOTS = 6;      // Kling multi_prompt 上限
  const SHOT_LIMIT = 512;   // ★ 硬上限:每個 shot 的 prompt 字元數
  const CFG_SCALE = 0.6;    // 官方預設 0.5;RA 分鏡要精確 → 0.6

  // ── 負向詞:獨立欄位,不佔 512。RA REALISM_BASE / AUDIO_REALISM 的負向半邊全搬這裡。
  //    ⚠️ 嚴守雷區:不寫 pores / film grain / contact shadows / perfect / studio(烤肉紋兇手)。
  const NEGATIVE = [
    'beauty filter', 'skin smoothing', 'skin retouching', 'oily shine', 'greasy T-zone',
    'hot specular highlights', 'plastic skin', 'studio polish', 'glossy commercial look',
    'polished fashion model', 'CGI', '3D render', 'pasted-on composited look', 'hard cutout outline',
    'statue-still frozen pose', 'blank fixed stare', 'robotic delivery', 'slurred speech',
    'invented or extra words', 'repeated words', 'background music', 'soundtrack', 'jingle',
    'blur', 'distort', 'low quality'
  ].join(', ');

  // ── 正向錨(必須留在 prompt;負向部分已搬走,這裡只留「要什麼」)
  const B_REALISM = ' Handheld phone vlog, natural available light, her skin exactly like the reference, an ordinary real person.';
  const B_ALIVE   = ' Natural gestures, subtle weight shifts, relaxed blinking, gaze drifts to the product and back to the lens.';
  const B_PRODUCT = ' Holding @Element2, the same physical product at a consistent real-world size.';
  const bAudio = (accent) => ' She speaks only the written line, in natural ' + accent + ', brand names and numbers clear and unhurried; with no written line she stays silent.';

  function callWorker(action, params) {
    if (!window.KolStitch || typeof window.KolStitch._api !== 'function') {
      throw new Error('KolEngine(kling):找不到 KolStitch._api,請確認 kol-stitch.js 已載入');
    }
    return window.KolStitch._api(action, params);
  }

  // 口音鐵律:台灣 KOL 一律 Taiwanese Mandarin,永不裸奔成大陸腔。
  function accentOf(seg) {
    const nat = seg.nationality
      || (window.S && window.S.selectedKol && window.S.selectedKol.persona && window.S.selectedKol.persona.nationality)
      || 'tw';
    return (typeof window.natToAccent === 'function') ? window.natToAccent(nat) : 'Taiwanese Mandarin';
  }

  // ★ 按塊丟棄:超過 512 就整塊拿掉最低優先級的,絕不 slice 腰斬句子。
  //   動作永遠留(那是 RA 的分鏡內容);真的連動作都超過 512 才在「詞邊界」截,並記警告。
  function assemble(action, blocks) {
    let out = action;
    const dropped = [];
    for (const b of blocks) {                       // blocks 已依優先級由高到低排好
      if (!b.text) continue;
      if ((out + b.text).length <= SHOT_LIMIT) out += b.text;
      else dropped.push(b.name);
    }
    if (out.length > SHOT_LIMIT) {                  // 極端:分鏡動作本身就超過 512
      const cut = out.lastIndexOf(' ', SHOT_LIMIT); // 在詞邊界斷,不切字中間
      out = out.slice(0, cut > 400 ? cut : SHOT_LIMIT);
      dropped.push('⚠️動作被截斷(分鏡文字過長)');
    }
    if (dropped.length) console.warn('[KolEngine:kling] 512 預算不足,已整塊丟棄:', dropped.join(' / '), '| 長度', out.length);
    return out;
  }

  function buildShotPrompt(beat, opts) {
    const action = ((typeof beat === 'string') ? beat : (beat.prompt || '')).trim();
    const hasProd = opts.hasProduct && (beat.productUrl || beat.productDriveId || opts.forceProductEveryShot);
    // 優先級:動作(基底,絕不丟)→ 商品錨 → 音訊/口音錨 → 寫實錨 → 生命感錨
    return assemble('@Element1 ' + action, [
      { name: '商品錨', text: hasProd ? B_PRODUCT : '' },
      { name: '口音/音訊錨', text: opts.audioOn ? bAudio(opts.accent) : '' },
      { name: '寫實錨', text: B_REALISM },
      { name: '生命感錨', text: B_ALIVE },
    ]);
  }

  async function submitSegment(seg) {
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

    const prodIds = Array.isArray(seg.productDriveIds) ? seg.productDriveIds.filter(Boolean) : [];
    const prodUrls = Array.isArray(seg.productImageUrls) ? seg.productImageUrls.filter(Boolean) : [];
    const hasProduct = prodIds.length > 0 || prodUrls.length > 0;

    const opts = { accent: accent, audioOn: audioOn, hasProduct: hasProduct };

    const multiPrompt = beats.map(function (b) {
      const dur = (typeof b === 'object' && b.durationSec)
        ? b.durationSec
        : Math.max(1, Math.round((seg.totalSec || 5) / beats.length));
      return { prompt: buildShotPrompt(b, opts), duration: String(Math.max(3, Math.min(15, dur))) };
    });

    // elements:@Element1 = 臉(正臉 + 多角度 → 鎖臉);@Element2 = 商品
    //   ⚠️ fal 規定每個 element 必須 frontal + reference 成對 → 單張商品圖由 Worker v3.51 自動補。
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

    const sub = await callWorker('kling_submit', {
      endpoint: ENDPOINT,
      startDriveId: faceId || undefined,
      startImageUrl: faceId ? undefined : faceUrl,
      elements: elements,
      multiPrompt: multiPrompt,
      shotType: 'customize',
      totalSec: String(Math.max(3, Math.min(15, seg.totalSec || 5))),
      aspectRatio: seg.aspectRatio || '9:16',   // ⚠️ 模型會忽略;實際比例由首幀圖決定
      resolution: seg.resolution || '720p',
      generateAudio: audioOn,
      negativePrompt: seg.negativePrompt || NEGATIVE,   // 🆕 負向詞搬家,不佔 512
      cfgScale: (typeof seg.cfgScale === 'number') ? seg.cfgScale : CFG_SCALE,
      brandId: seg.brandId,
      kolName: seg.kolName
    });

    if (!sub || !sub.requestId) throw new Error('KolEngine(kling):Worker 沒回 requestId(' + JSON.stringify(sub).slice(0, 300) + ')');
    return { requestId: sub.requestId, engine: 'kling', endpoint: ENDPOINT, r2Refs: sub.r2Refs };
  }

  window.KolEngines = window.KolEngines || {};
  window.KolEngines.kling = {
    id: 'kling',
    label: '敘事寫實 · 真人臉動作鎖',   // 客戶前台的風格化名稱(不露引擎名)
    endpoint: ENDPOINT,
    submitSegment: submitSegment,
    negativePrompt: NEGATIVE,
    // 除錯:Console 看每個 shot 的 prompt 與字數,不送 fal、不燒點數。
    //   用法:KolEngines.kling._preview([{prompt:'...',productUrl:'x'}], {generateAudio:true})
    _preview: function (beats, seg) {
      seg = seg || {};
      const accent = accentOf(seg);
      const hasProduct = !!((seg.productDriveIds && seg.productDriveIds.length) || (seg.productImageUrls && seg.productImageUrls.length) || seg.hasProduct);
      const list = (Array.isArray(beats) ? beats : [beats]).map(function (b) { return (typeof b === 'string') ? { prompt: b } : b; });
      return list.map(function (b, i) {
        const p = buildShotPrompt(b, { accent: accent, audioOn: seg.generateAudio === true, hasProduct: hasProduct });
        return { shot: i + 1, len: p.length, ok: p.length <= SHOT_LIMIT, prompt: p };
      });
    }
  };

  console.log('[KolEngine] 🎥 攝影師② Kling v1.2 已註冊 · window.KolEngines.kling · '
    + '📏每shot上限512字元→按塊丟棄不腰斬 · 🚫負向詞搬 negative_prompt(語意零犧牲) · cfg_scale=' + CFG_SCALE + ' · '
    + 'driveId 乾淨原圖 · elements 多角度鎖臉(已驗證) · 口音鐵律(Taiwanese Mandarin) · '
    + '⚠️aspect_ratio被模型忽略(比例=首幀圖) · ⚠️Kling並發=1→排隊跑');
})();
