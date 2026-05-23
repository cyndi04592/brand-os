// ════════════════════════════════════════════════════════════════════
//  kol-makeup.js · v5.13
//
//  🎨 化妝師 — 妝容、膚況、風格(濃縮韓國造型團隊的彩妝/保養職責)
//
//  職責:
//   • 決定 KOL 當集妝容(濃 / 淡 / 素顏 / 特殊)
//   • 用「妝效特徵」描述,不寫品牌名(同攝影師寫 35mm 不寫機型)
//   • 與攝影師協作(只補妝感,皮膚真實度交給 REALISM_BASE,不重複)
//
//  設計哲學(RA 2026-05-23 定調):
//   「妝效像光圈一樣是可調參數」— 寫效果不寫品牌
//   例:濕潤睫毛膏 → glossy defined lashes(不寫 YSL)
//       自然光澤粉底 → dewy luminous skin(不寫品牌)
//   品牌對應效果的映射,放 FINISH_LIBRARY 註解,未來擴充
//
//  v5.13 狀態:啟用 contribute — 品牌基調 × 場景時段微調
//   分工:化妝師只管「妝感風格」,皮膚真實度(毛孔/汗毛)由 REALISM_BASE 管
// ════════════════════════════════════════════════════════════════════

(function () {
  'use strict';

  // ─── 妝效特徵庫(寫效果,不寫品牌名)─────────────────────
  // 未來品牌映射範例(你自己對照,系統送的是右邊的效果):
  //   YSL 水光粉底   → dewy_glow
  //   3CE 霧面唇     → matte_lip
  //   某濕潤睫毛膏    → wet_lashes
  const FINISH_LIBRARY = {
    // 底妝
    bare:        'no foundation, bare natural skin, slightly uneven skin tone for realism',
    dewy_glow:   'dewy luminous foundation with natural glow, lightweight sheer coverage, healthy skin radiance',
    natural_matte: 'natural skin-like foundation, soft semi-matte finish, lightweight and breathable',
    // 眼妝
    soft_eyes:   'soft natural eye definition, subtle warm-toned eyeshadow, lightly defined lashes',
    wet_lashes:  'glossy wet-look lashes, individually separated and defined, no clumping',
    smoky_subtle: 'subtle smoky eye in soft brown tones, gently smudged, not heavy',
    // 唇
    nude_lip:    'natural nude lips with soft tint, slightly glossy',
    matte_lip:   'velvet matte lips in muted rose tone',
    tinted_lip:  'fresh lip tint, just-bitten gradient effect, natural moisture',
    // 頰
    soft_blush:  'soft natural flush on cheeks, blended seamlessly',
  };

  // ─── 妝容基底(品牌定 + 場景微調的組合結果)──────────────
  const MAKEUP_PRESETS = {
    // 全素顏(晨間剛起床)
    bare_morning: [FINISH_LIBRARY.bare, FINISH_LIBRARY.tinted_lip].join(', '),
    // 裸妝(日間鄰家感)
    natural_day:  [FINISH_LIBRARY.dewy_glow, FINISH_LIBRARY.soft_eyes, FINISH_LIBRARY.nude_lip, FINISH_LIBRARY.soft_blush].join(', '),
    // 提氣色(夜間,稍微精緻但不濃)
    soft_evening: [FINISH_LIBRARY.natural_matte, FINISH_LIBRARY.smoky_subtle, FINISH_LIBRARY.tinted_lip].join(', '),
    // 韓系玻璃肌(特殊,可選)
    glass_skin:   'korean glass skin effect, dewy translucent base, ' + FINISH_LIBRARY.soft_eyes + ', ' + FINISH_LIBRARY.tinted_lip,
  };

  // ─── 場景時段 → 妝容基底 對應 ─────────────────────────
  // 用 sceneId 的時段線索(morning/afternoon/night)判斷
  function pickPresetByScene(sceneId, brandType) {
    const id = String(sceneId || '').toLowerCase();

    // 晨間 → 素顏感(剛起床的真實)
    if (id.includes('morning') || id.includes('kitchen')) return 'bare_morning';
    // 夜間 → 提氣色(但不濃妝)
    if (id.includes('night') || id.includes('evening')) return 'soft_evening';
    // 其餘(午後/戶外/開箱)→ 裸妝鄰家感
    return 'natural_day';
  }

  /**
   * 產出妝容段落
   * v5.13:品牌基調 × 場景時段微調
   * 關鍵:只描述「妝感風格」,不碰皮膚真實度(那是 REALISM_BASE 的事)
   *       不寫 perfect/flawless,不寫品牌名
   */
  function contribute(ctx) {
    if (!ctx) return '';

    const sceneId = ctx.sceneId || ctx.scene?.id || '';
    const brandType = ctx.brand?.brand_type || '';

    // 1) 人設若有指定妝容偏好,優先(未來擴充)
    if (ctx.persona?.makeup_preference && MAKEUP_PRESETS[ctx.persona.makeup_preference]) {
      return 'makeup: ' + MAKEUP_PRESETS[ctx.persona.makeup_preference];
    }

    // 2) 依場景時段選妝容基底
    const presetKey = pickPresetByScene(sceneId, brandType);
    const makeupText = MAKEUP_PRESETS[presetKey];
    if (!makeupText) return '';

    // 3) 加自然不完美的收尾(呼應「不要 100%」),但輕微
    //    注意:不重複 REALISM_BASE 的毛孔/汗毛,只加「妝會自然的小細節」
    return 'makeup: ' + makeupText + ', makeup looks naturally worn not freshly applied, slight authentic imperfection';
  }

  function getPreset(name) {
    return MAKEUP_PRESETS[name] || FINISH_LIBRARY[name] || '';
  }

  // ─── 導出 + 自動向總導演註冊 ─────────────────────────
  window.KolMakeup = {
    FINISH_LIBRARY,
    MAKEUP_PRESETS,
    contribute,
    getPreset,
    pickPresetByScene,
  };

  if (window.CrewDirector?.register) {
    window.CrewDirector.register('makeup', window.KolMakeup);
  }

  console.log('[KolMakeup] 🎨 v5.13 就緒 · 妝效特徵庫(品牌基調×場景微調)');
})();
