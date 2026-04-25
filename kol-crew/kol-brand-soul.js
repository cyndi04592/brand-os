// ════════════════════════════════════════════════════════════════════
//  kol-brand-soul.js · v5.12
//  
//  📚 品牌靈魂書 — 廠商入駐時寫的品牌 DNA
//  
//  職責:
//   • 從 GAS brands 表撈靈魂書資料(name / soul / adStyle / hashtags / tagline)
//   • 把品牌 DNA 轉成 prompt 片段(帶出品牌調性但不出品牌名)
//   • brand_type 分類映射(fashion_lingerie / apparel / appliance_kitchen...)
//  
//  設計哲學:
//   商品要不經意露出,不是硬塞廣告
//   消費者看 KOL 以為是真人,產品只是她生活的一部分
//  
//  v5.12 狀態:骨架版 — contribute 先從現有 BRAND_ACTIONS 接回
//  下一版(v5.13):品牌自動入駐 — 新品牌填一次 GAS,8 個 brand_type action 自動套用
// ════════════════════════════════════════════════════════════════════

(function () {
  'use strict';

  // 品類動作模板(brand_type → 商品互動方式)
  // 下一版會從 kol-universal-scenes.js 整合 BRAND_TYPE_ACTIONS
  const BRAND_TYPE_ACTIONS = {
    fashion_lingerie: 'wearing the garment naturally under everyday outfit, shown subtly through clothing',
    apparel: 'wearing the clothing piece as daily outfit, naturally moving and interacting',
    appliance_kitchen: 'using the kitchen appliance naturally during daily cooking',
    food: 'enjoying the food or drink naturally as part of meal time',
    wellness: 'using the wellness product as part of self-care routine',
    design_agency: 'showcasing the design work in creative working context',
    restaurant_cantonese: 'dining at the restaurant, enjoying authentic Cantonese dishes',
    pet_supplies: 'using the pet product naturally with a pet in daily life',
    default: 'the product held or interacted with naturally',
  };

  /**
   * 產出品牌調性段落
   */
  function contribute(ctx) {
    // v5.12:品牌靈魂注入先留給 scene.product_context / storyArc.productHint 處理
    // 這裡只提供輔助查詢,不重複塞入 prompt
    return '';
  }

  /**
   * 從品牌資料提取 tagline(第一個「」括號裡的句子)
   */
  function extractTagline(soul) {
    if (!soul) return '';
    const m = soul.match(/[「『"]([^」』"]{4,40})[」』"]/);
    return m ? m[1] : '';
  }

  /**
   * 依 brand_type 取得動作模板
   */
  function getActionForBrandType(brandType) {
    return BRAND_TYPE_ACTIONS[brandType] || BRAND_TYPE_ACTIONS.default;
  }

  /**
   * 品牌資料完整度檢查(decide 要不要跳「請補品牌資料」)
   */
  function isComplete(brand) {
    if (!brand) return false;
    return !!(brand.name && brand.soul);
  }

  // ─── 導出 + 自動向總導演註冊 ─────────────────────────
  window.KolBrandSoul = {
    BRAND_TYPE_ACTIONS,
    contribute,
    extractTagline,
    getActionForBrandType,
    isComplete,
  };

  if (window.CrewDirector?.register) {
    window.CrewDirector.register('brandSoul', window.KolBrandSoul);
  }

  console.log('[KolBrandSoul] 📚 v5.12 就緒(骨架)');
})();
