// ════════════════════════════════════════════════════════════════════
//  kol-cinematographer.js · v5.25
//  
//  📷 攝影師 — 鏡頭、自然光、運鏡、電影寫實
//  
//  v5.25 變更(⑤ RIIV 寫實·fal 官方 UGC anti-slop 植入):
//   • REALISM_BASE 補「手機色彩性格」:the warm faintly oversaturated
//     color of a good phone camera + no studio polish
//     → 給畫面「好手機隨拍」的色彩指紋,打「乾淨到假」。
//     ⚠️ 是色調性格,不是微觀紋理、不是硬光 → 不碰烤肉紋雷區。
//   • 🆕 AUDIO_REALISM 音訊反罐頭層(fal 官方 anti-slop 核心):
//     只要現場音 + 室內底噪 + 乾淨人聲,明確禁 BGM/配樂/jingle。
//     模型自動配的罐頭廣告樂 = 最大 AI 味來源之一。
//     ⚠️ 全域生效:STEP2 單鏡頭也吃到(分鏡 Rule 21 只護 STEP3)。
//     ⚠️ 以後若要做「純氛圍配樂片」,回來拔這層。
//
//  v5.24 變更(⑤ RIIV 寫實·打「背景假假的」):
//   • 新增 SCENE_REALISM 場景落地錨,跟 REALISM_BASE 分開管:
//       REALISM_BASE = 管「人/膚質/不修圖」
//       SCENE_REALISM = 管「場景不假 + 人落進場景 + 整支統一色調」
//   • 三因對症:
//       (a)場景太理想化 → real-world location / not CGI / not 3D render
//       (b)貼上去感   → 人和背景「共用同一套色調+環境色溫」讓她落進場景,
//                       ⚠️ 用色調+環境光「氛圍」整合,不是硬光打臉 → 不破壞防烤肉紋
//       (c)兩張圖合成感 → one continuous photographic frame / unified grade
//   • 借 Riiv:no crowd / no stylized CGI / premium cinematic realism / 統一色調。
//   • contribute() 現在同時吐 REALISM_BASE + SCENE_REALISM。
//   ⚠️ 嚴守:不加任何微觀紋理(pores/peach fuzz/film grain/hair strands)、
//      不加邊緣融合(contact shadows/light field/optical depth/spilling/motion blur)、
//      不加 perfect/flawless/studio/commercial —— 這些是你驗過的烤肉紋兇手。
//
//  v5.19 變更(室內烤肉紋根因):
//   • 拔掉「正向瑕疵詞」realistic uneven skin tone / slight blemishes /
//     skin imperfections —— 室內硬光會放大成一條一條。改成「照參考照」+ 負向。
//  v5.18:Taiwanese Mandarin accent 放回(誤拔造成又晴中國腔)。
//  v5.17:拔掉整包「光學/光場/邊緣融合」干擾(烤肉網主兇)。
// ════════════════════════════════════════════════════════════════════

(function () {
  'use strict';

  // 🎯 攝影風格基底 — 管「人/膚質/不修圖」(靈魂留、干擾拔)
  //   v5.25:尾段補手機色彩性格(warm faintly oversaturated)+ no studio polish
  const REALISM_BASE = 'handheld iPhone vlog aesthetic, 35mm equivalent lens, natural available light, keep her skin exactly like the reference photo, absolutely no beauty filter, no smoothing, no skin retouching, an ordinary real person not a polished model or commercial, authentic documentary realism, soft natural subject edges that blend into the scene, no hard cutout outline, no over-sharpened subject edge, not a pasted-on composited look, soft diffused even light on her face, natural matte skin with no oily shine and no hot specular highlights on the skin, gentle low-contrast natural lighting, the warm faintly oversaturated color of a good phone camera, no studio polish, Taiwanese Mandarin accent, natural lip sync, candid unscripted moments';

  // 🎬 場景落地錨 — 管「場景不假 + 人落進場景 + 統一色調」(⑤ 打背景假假的)
  //   ⚠️ 全程不碰微觀紋理 / 邊緣融合 / 硬光 → 不會長烤肉紋。整合靠「色調+環境色溫」。
  const SCENE_REALISM = 'a genuine real-world location with authentic materials surfaces and natural imperfections, not a 3D render, not CGI, not a video-game environment, natural everyday documentary look with soft diffused natural lighting, the subject and the background share the same ambient color temperature and one gentle natural color grade so she genuinely belongs inside the scene and never looks pasted on, no glossy commercial polish, the background layout stays consistent across the whole video with all furniture, windows and fixtures kept in the same fixed positions and not moving appearing or disappearing between shots, the subject stays in sharp focus while the background falls into soft shallow depth-of-field with reduced detail so all visual attention stays on her, no crowd, no extra background people, no stylized or exaggerated artificial elements';

  // 🔊 音訊反罐頭層 — v5.25 新增(fal 官方 anti-slop:罐頭配樂 = 最大 AI 味來源之一)
  //   只要「這個畫面裡真的會有的聲音」:現場動作音 + 環境底噪 + 乾淨人聲。
  //   明確禁配樂 —— 不寫,模型就自動配一首廣告罐頭樂壓在台詞上。
  //   ⚠️ 全域生效;之後若要做純氛圍配樂片,把 contribute() 裡這行拔掉即可。
  const AUDIO_REALISM = 'natural diegetic ambient sound only, real room tone and everyday environmental sounds of the location, her voice clear and upfront, no background music, no soundtrack, no jingle, no musical score';

  // 🎥 運鏡元資料
  const CAMERA_MOVEMENTS = {
    static: {
      label: '📷 靜態說話',
      hint: '站在原地講話',
      duration_suggest: 5,
      fallback: 'static tripod framing with subtle handheld breathing, subject speaks directly to camera in place',
    },
    walk_through: {
      label: '🚶 走動轉場',
      hint: '空間移動 · 生活感',
      duration_suggest: 10,
      fallback: 'subject walks slowly through the space, camera performs a smooth handheld tracking shot following her movement, subject turns to face camera mid-walk',
    },
    dolly_in: {
      label: '🎥 慢速推鏡',
      hint: '拉近情緒',
      duration_suggest: 10,
      fallback: 'slow dolly-in toward subject from medium shot to close-up, background softly blurs as camera approaches',
    },
    orbit: {
      label: '🔄 環繞鏡頭',
      hint: '360° 氛圍',
      duration_suggest: 10,
      fallback: 'smooth orbital camera movement around subject, 180-degree arc, subject remains relatively centered',
    },
    pullback_reveal: {
      label: '↖️ 拉鏡揭示',
      hint: '空間感建立',
      duration_suggest: 10,
      fallback: 'camera starts close on subject and slowly pulls back to reveal the entire environment and atmosphere',
    },
  };

  /**
   * 產出攝影段落 = 運鏡(有 movementId 才加)+ 寫實基底 + 場景落地錨 + 音訊反罐頭
   */
  function contribute(ctx) {
    const parts = [];

    // 運鏡(接片分鏡模式 movementId=null → 不加,交給分鏡卡)
    if (ctx.movementId) {
      const movement = ctx.scene?.movements?.[ctx.movementId]
        || CAMERA_MOVEMENTS[ctx.movementId]?.fallback;
      if (movement) parts.push(movement);
    }

    // 寫實基底(一定加)· 口音吃 nationality(預設台灣腔,守鐵律)
    const _accent = (typeof window !== 'undefined' && window.natToAccent)
      ? window.natToAccent(ctx.persona?.nationality)
      : 'Taiwanese Mandarin';
    parts.push(REALISM_BASE.replace('Taiwanese Mandarin accent', _accent));

    // 🎬 場景落地錨(一定加)— ⑤ 打背景假假的
    parts.push(SCENE_REALISM);

    // 🔊 音訊反罐頭(一定加)— v5.25 fal anti-slop:禁罐頭配樂,只留現場音
    parts.push(AUDIO_REALISM);

    return parts.join(', ');
  }

  function getMovement(id) {
    return CAMERA_MOVEMENTS[id] || null;
  }

  function listMovements() {
    return CAMERA_MOVEMENTS;
  }

  function suggestDuration(movementId) {
    return CAMERA_MOVEMENTS[movementId]?.duration_suggest || 5;
  }

  // ─── 導出 + 自動向總導演註冊 ─────────────────────────
  window.KolCinematographer = {
    REALISM_BASE,
    SCENE_REALISM,
    AUDIO_REALISM,
    CAMERA_MOVEMENTS,
    contribute,
    getMovement,
    listMovements,
    suggestDuration,
  };

  if (typeof window.REALISM_BASE === 'undefined') {
    window.REALISM_BASE = REALISM_BASE;
  }
  if (typeof window.CAMERA_MOVEMENTS === 'undefined') {
    window.CAMERA_MOVEMENTS = CAMERA_MOVEMENTS;
  }

  if (window.CrewDirector?.register) {
    window.CrewDirector.register('cinematographer', window.KolCinematographer);
  }

  console.log('[KolCinematographer] 📷 v5.25 就緒 · REALISM_BASE(人+手機色彩) + SCENE_REALISM(場景落地) + AUDIO_REALISM(禁罐頭配樂·只留現場音) + 台灣腔');
})();
