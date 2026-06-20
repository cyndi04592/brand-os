// kol-product.js · v2.1 · 道具師(Prop / Product Director)
// 依 productType 驅動「鎖定句」,克制不搶主體 KOL。
//   packaged 包裝商品(海苔/香腸)→ [Image2]外包裝 + [Image3]內容物(showContents)
//   dish     餐點料理(福臨門)   → [Image2]成品菜+盤,狀態鎖:已上桌·絕不下鍋
//   object   獨立物件(電扇/3C)  → [Image2]主體,形狀鎖
// 讀 products 表:productType/hasPackaging/packShape/productLook/showContents/contentsLook/realSize
// 🆕 v2.1:物理錨 GROUNDED — 給商品重量+真實接觸+重力 → 殺「魔術漂浮」,且不卡拋/放/遞動作
(function () {
  'use strict';
  // 🆕 v2.1 物理錨:有重量、與手/桌面真實接觸、遵守重力 → 殺「魔術漂浮」。
  //   刻意不寫「握緊/不准動」,所以拋球、放下、遞出等動作不會被卡死
  //   (飛出去也是「有重量的拋物線」,不是飄)。
  var GROUNDED = 'the product has real weight and makes genuine physical contact with her hand or the surface it rests on, obeying gravity so it never floats, drifts or looks weightlessly pasted onto the scene';
  function isYes(v) { return /^(是|有|y|yes|true|1)/i.test(String(v || '').trim()); }
  function findProduct(ctx) {
    if (ctx && ctx.episode && ctx.episode.product) return ctx.episode.product;
    try {
      if (typeof window.getCurrentRotationProduct === 'function') {
        const p = window.getCurrentRotationProduct();
        if (p) return p;
      }
    } catch (e) {}
    return null;
  }
  // 比例錨「臉/身體」(被參考照鎖死的部位),不錨「手」(手是生成的會飄)
  function sizeToScale(realSize) {
    const nums = (String(realSize || '').match(/\d+(?:\.\d+)?/g) || []).map(Number).filter(n => n > 0);
    if (!nums.length) return '';
    const cm = Math.max(...nums);
    if (cm <= 8)  return 'small, roughly half the height of her face';
    if (cm <= 20) return 'roughly as tall as her face';
    if (cm <= 40) return 'roughly the height of her head and neck together';
    return 'roughly as wide as her torso';
  }
  // 決定類型:優先 productType,沒填則 hasPackaging 推(dish 推不出,必須明填)
  function resolveType(prod) {
    const t = String(prod.productType || '').trim().toLowerCase();
    if (t === 'packaged' || t === 'dish' || t === 'object') return t;
    if (/餐點|料理|菜|dish|food/.test(t)) return 'dish';
    if (/包裝|packaged/.test(t))           return 'packaged';
    if (/物件|object|電器|appliance/.test(t)) return 'object';
    return isYes(prod.hasPackaging) ? 'packaged' : 'object';
  }

  function contribute(ctx) {
    const prod = findProduct(ctx);
    if (!prod) {
      return 'PROP (a supporting object she is holding — keep it subtle, do NOT overpower the subject): keep the product in [Image2] consistent in shape, proportions and color, never mirrored or flipped, at a believable real-world scale, do not distort or morph it; ' + GROUNDED + ', its front kept toward the camera and recognizable while held, moving on a natural weighted arc if the action calls for it';
    }
    const type = resolveType(prod);
    const scale = sizeToScale(prod.realSize);
    const bits = [];

    if (type === 'dish') {
      const look = (prod.productLook || prod.prodName || '').trim();
      bits.push('the product in [Image2] is a FINISHED, fully plated dish served on its plate' + (look ? ' (' + look + ')' : '') + ', shown as a completed appetizing dish matching [Image2]');
      bits.push('it appears ONLY as a finished plated dish — the chef presents, serves, plates or lightly garnishes it; the plated dish is NEVER placed into a pan, wok or pot, never fried, boiled, cooked or shown raw, the plate stays intact and never goes on a stove');
      if (scale) bits.push('the plated dish is ' + scale + ', at that true size');
      bits.push('presented appetizing and intact, the plate facing the camera, minimal movement so it stays recognizable');
      return 'PROP (the plated dish she is presenting — keep it natural, do NOT overpower the subject): ' + bits.join('; ');
    }

    if (type === 'packaged') {
      const desc = [(prod.packShape || '').trim(), (prod.productLook || '').trim()].filter(Boolean).join('、');
      bits.push(desc
        ? 'the packaged product in [Image2] is ' + desc + ', keep its packaging shape, color and label consistent and undistorted, its printed brand text reading correctly and never mirrored, reversed or flipped, matching [Image2] exactly'
        : 'keep the packaging in [Image2] consistent in shape, proportions, color and label, printed text never mirrored or flipped, do not distort or morph it');
      if (isYes(prod.showContents) && (prod.contentsLook || '').trim()) {
        bits.push('its contents shown in [Image3] look like ' + prod.contentsLook.trim() + ', keep this shape, count and texture natural and stable, do not morph (loose pieces may vary naturally)');
      }
      if (scale) bits.push('the product is ' + scale + ', shown at that true size against her body');
      bits.push(GROUNDED + ', its printed front and label kept toward the camera and recognizable while held, moving on a natural weighted arc if the action calls for it');
      return 'PROP (a supporting product she is holding — keep it subtle and natural, do NOT overpower the subject): ' + bits.join('; ');
    }

    // object
    const look = (prod.productLook || '').trim();
    bits.push('keep the product in [Image2] consistent in shape, proportions and color' + (look ? ' (' + look + ')' : '') + ', never mirrored or flipped, do not distort or morph it');
    if (scale) bits.push('the product is ' + scale + ', shown at that true size');
    bits.push(GROUNDED + ', its front kept toward the camera and recognizable while held, moving on a natural weighted arc if the action calls for it');
    return 'PROP (the product she is using or showing — keep it subtle and natural, do NOT overpower the subject): ' + bits.join('; ');
  }

  window.KolProduct = { contribute, isYes, sizeToScale, resolveType, version: 'v2.2' };
  console.log('[KolProduct] 🎒 v2.2 就緒 · 道具師(productType驅動 + 物理錨抗漂浮 + 📏尺度全錨臉/身體不錨手·修小東西變超小)');
})();
