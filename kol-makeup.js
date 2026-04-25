// ════════════════════════════════════════════════════════════════════
//  kol-makeup.js · v5.12
//  
//  🎨 化妝師 — 妝容、膚況、風格
//  
//  職責:
//   • 決定 KOL 當集妝容(濃 / 淡 / 素顏 / 特殊)
//   • 膚況管理(痘痘、淡斑、素顏感)
//   • 與攝影師協作(不能塗掉 REALISM_BASE 要求的毛孔質感)
//  
//  v5.12 狀態:純骨架 — contribute 先返回空字串
//  下一版(v5.13):依品牌定位建立妝容基底
//   - LACEZ:裸妝、素顏感
//   - MOZ:自然淡妝
//   - Chifu:清新無妝
// ════════════════════════════════════════════════════════════════════

(function () {
  'use strict';

  // 妝容預設(之後擴充)
  const MAKEUP_PRESETS = {
    bare: 'no makeup appearance, natural skin with visible pores',
    natural: 'very light natural makeup, barely there foundation, preserving skin texture',
    soft: 'soft daytime makeup, gentle blush and nude lips, natural eye definition',
    evening: 'elegant evening makeup, subtle smoky eyes, defined lips',
  };

  /**
   * 產出妝容段落
   * v5.12:暫時返回空(避免和 REALISM_BASE 衝突)
   */
  function contribute(ctx) {
    // TODO v5.13: 依 ctx.persona.makeup_preference 或品牌 DNA 決定
    return '';
  }

  function getPreset(name) {
    return MAKEUP_PRESETS[name] || '';
  }

  // ─── 導出 + 自動向總導演註冊 ─────────────────────────
  window.KolMakeup = {
    MAKEUP_PRESETS,
    contribute,
    getPreset,
  };

  if (window.CrewDirector?.register) {
    window.CrewDirector.register('makeup', window.KolMakeup);
  }

  console.log('[KolMakeup] 🎨 v5.12 就緒(骨架)');
})();
