// ════════════════════════════════════════════════════════════════════
//  kol-wardrobe.js · v5.12
//  
//  👗 服裝師 — 穿搭、品牌調性鎖、服裝 DNA
//  
//  職責:
//   • 依品牌 + 場景決定 KOL 當集穿搭
//   • 確保跨集外觀一致(避免今天內衣品牌、明天穿運動服違和)
//   • 處理 scene.outfit(現在寫在場景裡,未來會抽出來)
//  
//  v5.12 狀態:骨架版(contribute 先從 scene.outfit 撈)
//  下一版(v5.13):獨立 WARDROBE_LIBRARY,按品牌 × 場景 × 情境組合
// ════════════════════════════════════════════════════════════════════

(function () {
  'use strict';

  /**
   * 產出服裝段落
   */
  function contribute(ctx) {
    if (!ctx?.scene?.outfit) return '';
    return 'wearing ' + ctx.scene.outfit;
  }

  /**
   * 未來:依品牌 + 場景推薦穿搭(v5.13 計畫)
   */
  function suggestOutfit(brandId, sceneId, mood) {
    // TODO: 抽出品牌 × 場景 × 情緒的穿搭矩陣
    return null;
  }

  // ─── 導出 + 自動向總導演註冊 ─────────────────────────
  window.KolWardrobe = {
    contribute,
    suggestOutfit,
  };

  if (window.CrewDirector?.register) {
    window.CrewDirector.register('wardrobe', window.KolWardrobe);
  }

  console.log('[KolWardrobe] 👗 v5.12 就緒(骨架)');
})();
