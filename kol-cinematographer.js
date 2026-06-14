// ════════════════════════════════════════════════════════════════════
//  kol-cinematographer.js · v5.19
//  
//  📷 攝影師 — 鏡頭、自然光、運鏡
//  
//  職責:
//   • 管理攝影風格基底(REALISM_BASE)
//   • 管理運鏡庫(CAMERA_MOVEMENTS)
//   • 產出攝影段落(運鏡 + 風格基底)
//  
//  設計哲學(RA · 2026-06 修訂):
//   「連 AI 都騙得過的真實感」— 真實感分兩層:
//     - 微觀(毛孔、膚質細節)→ 交給「參考照本身」,
//       prompt 不要正面叫模型畫(pores / peach fuzz / film grain / 細髮絲),
//       fast 模型畫太密會糊成烤肉網(規則網格)。
//     - 宏觀(不對稱、素顏感、亂髮、不修圖)→ 用人話描述,安全。
//     - 「不漂亮」→ 全用負向句擋(no beauty filter / no smoothing / no retouch /
//       not a model / not commercial),負向句不會長網格。
//   禁用:perfect / flawless / studio / professional model / commercial
//
//  v5.19 變更(室內烤肉紋根因):
//   • 拔掉「正向瑕疵詞」realistic uneven skin tone / slight blemishes /
//     skin imperfections —— 這是叫模型「自己畫皮膚不平」,室內硬光會放大成
//     一條一條(戶外柔光蓋得住,所以 farm 乾淨、office 中)。舊版沒這些字=舊版乾淨。
//   • 改成「keep her skin exactly like the reference photo」+ 負向(不准磨皮/漂亮):
//     真實膚質交給參考照本身,不靠文字畫 → 不過曝成烤肉紋、也不會變太 AI。
//
//  v5.18 變更:
//   • 把 Taiwanese Mandarin accent 放回(v5.17 誤拔造成又晴變中國腔)。
//     ⚠️ 這是暫時解 —— 正解是「每隻 KOL 各自的腔調」(健一=日本腔,
//     台灣品牌=台灣腔)。但健一語音走 HeyGen 口播、不靠 Seedance 音效,
//     現階段 Seedance 出聲的就是台灣 KOL,所以全域放台灣腔是對的。
//
//  v5.17 變更:
//   • REALISM_BASE 拔掉整包「光學/光場/邊緣融合」干擾
//     (optical depth / light field / spilling onto edges / contact shadows /
//      organic soft edges / no cutout / motion blur)—— 烤肉網主兇。
//   • 順手拔掉 Taiwanese Mandarin accent(對非台灣 KOL 是錯的,日後做成每隻各自)。
//   • 微觀紋理詞全清,真實感改靠「照參考照 + 不修圖 + 宏觀瑕疵」。
// ════════════════════════════════════════════════════════════════════

(function () {
  'use strict';

  // 🎯 攝影風格基底 — 精簡版(靈魂留、干擾拔)
  //   留:鏡頭/35mm/vlog、不修圖、不均勻膚色、瑕疵、照參考照、不准漂亮
  //   拔:光學/光場/邊緣/接觸陰影/no-cutout/motion blur(烤肉網來源)
  const REALISM_BASE = 'handheld iPhone vlog aesthetic, 35mm equivalent lens, natural available light, keep her skin exactly like the reference photo, absolutely no beauty filter, no smoothing, no skin retouching, an ordinary real person not a polished model or commercial, authentic documentary realism, Taiwanese Mandarin accent, natural lip sync, candid unscripted moments';

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
   * 產出攝影段落
   */
  function contribute(ctx) {
    const parts = [];

    // 運鏡
    if (ctx.movementId) {
      const movement = ctx.scene?.movements?.[ctx.movementId]
        || CAMERA_MOVEMENTS[ctx.movementId]?.fallback;
      if (movement) parts.push(movement);
    }

    // 攝影風格基底(一定加)
    // 口音吃 nationality(預設 Taiwanese,守鐵律:tw/空一律台灣腔)
    const _accent = (typeof window !== 'undefined' && window.natToAccent)
      ? window.natToAccent(ctx.persona?.nationality)
      : 'Taiwanese Mandarin';
    parts.push(REALISM_BASE.replace('Taiwanese Mandarin accent', _accent));

    return parts.join(', ');
  }

  /**
   * 取得運鏡資料
   */
  function getMovement(id) {
    return CAMERA_MOVEMENTS[id] || null;
  }

  /**
   * 取得所有運鏡(UI 渲染用)
   */
  function listMovements() {
    return CAMERA_MOVEMENTS;
  }

  /**
   * 建議運鏡的影片時長
   */
  function suggestDuration(movementId) {
    return CAMERA_MOVEMENTS[movementId]?.duration_suggest || 5;
  }

  // ─── 導出 + 自動向總導演註冊 ─────────────────────────
  window.KolCinematographer = {
    REALISM_BASE,
    CAMERA_MOVEMENTS,
    contribute,
    getMovement,
    listMovements,
    suggestDuration,
  };

  // 同時掛在 window 讓 kol.html 的舊程式碼能用(雙向相容)
  // ⚠️ 真正餵進 prompt 的是這份(crew module);kol.html 的舊 REALISM_BASE 被 crew-director 蓋掉
  if (typeof window.REALISM_BASE === 'undefined') {
    window.REALISM_BASE = REALISM_BASE;
  }
  if (typeof window.CAMERA_MOVEMENTS === 'undefined') {
    window.CAMERA_MOVEMENTS = CAMERA_MOVEMENTS;
  }

  if (window.CrewDirector?.register) {
    window.CrewDirector.register('cinematographer', window.KolCinematographer);
  }

  console.log('[KolCinematographer] 📷 v5.19 就緒 · 膚質改吃參考照(拔正向瑕疵詞)+ 台灣腔');
})();
