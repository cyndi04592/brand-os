// ════════════════════════════════════════════════════════════════════
//  kol-cinematographer.js · v5.12
//  
//  📷 攝影師 — 鏡頭、光圈、ISO、燈光、運鏡
//  
//  職責:
//   • 管理攝影風格基底(REALISM_BASE)
//   • 管理運鏡庫(CAMERA_MOVEMENTS)
//   • 產出攝影段落(光影 / 鏡頭 / 運鏡 / 底片顆粒等)
//  
//  設計哲學(RA 2026-04-23):
//   「連 AI 都騙得過的真實感」— 不是完美畫面,是真實瑕疵
//   - 禁用:perfect / flawless / studio / professional model / commercial
//   - 必加:底片顆粒、手持抖動、毛孔質感、35mm、自然光、真實背景
//  
//  v5.12 狀態:骨架版
//   • REALISM_BASE 和 CAMERA_MOVEMENTS 已搬進來(雙向同步 window)
//   • kol.html 裡的原版常數仍保留,避免衝突
//   • 下一版(v5.13)把 kol.html 原版刪掉,全改用這裡
// ════════════════════════════════════════════════════════════════════

(function () {
  'use strict';

  // 🎯 攝影風格基底 — 臉部細節保留 + 真實肢體細節
  const REALISM_BASE = 'handheld iPhone vlog aesthetic, 35mm equivalent lens, subtle film grain ISO 400-800, visible natural skin texture with pores and peach fuzz, preserve original face features and skin imperfections from reference, absolutely no beauty filter smoothing, no skin retouching, visible hand details with knuckles and fingernails, authentic documentary realism, Taiwanese Mandarin accent, natural lip sync, candid unscripted moments';

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
    parts.push(REALISM_BASE);

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

  // v5.12:同時掛在 window 讓 kol.html 的舊程式碼能用(雙向相容)
  // ⚠️ kol.html 如果還定義 REALISM_BASE / CAMERA_MOVEMENTS,會以 kol.html 為準
  // 下一版(v5.13)把 kol.html 原版刪掉
  if (typeof window.REALISM_BASE === 'undefined') {
    window.REALISM_BASE = REALISM_BASE;
  }
  if (typeof window.CAMERA_MOVEMENTS === 'undefined') {
    window.CAMERA_MOVEMENTS = CAMERA_MOVEMENTS;
  }

  if (window.CrewDirector?.register) {
    window.CrewDirector.register('cinematographer', window.KolCinematographer);
  }

  console.log('[KolCinematographer] 📷 v5.12 就緒');
})();
