// kol-product.js · v1.0 · 道具師(Prop / Product Director)
// 讓「她手上的商品」形狀/包裝/內容物/比例穩定,但克制、不搶主體 KOL。
// 讀 products 表:hasPackaging/packShape/productLook/showContents/contentsLook/realSize
(function () {
  'use strict';
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

  function sizeToScale(realSize) {
    const nums = (String(realSize || '').match(/\d+(?:\.\d+)?/g) || []).map(Number).filter(n => n > 0);
    if (!nums.length) return '';
    const cm = Math.max(...nums);
    if (cm <= 8)  return 'small, smaller than her palm, easily pinched between her fingers';
    if (cm <= 20) return 'hand-sized, held comfortably in one hand';
    if (cm <= 40) return 'medium-sized, about a forearm long, held firmly in one or both hands';
    return 'large, bigger than her torso, handled with both hands';
  }

  function contribute(ctx) {
    const prod = findProduct(ctx);
    const bits = [];
    if (prod) {
      const hasPack = isYes(prod.hasPackaging);
      const desc = [(prod.packShape || '').trim(), (prod.productLook || '').trim()].filter(Boolean).join('、');
      if (hasPack && desc) {
        bits.push('the product held in [Image2] is ' + desc + ', keep its packaging shape, color and label consistent and undistorted throughout');
      } else {
        bits.push('keep the product in [Image2] consistent in shape, proportions and color throughout, do not distort or morph it');
      }
      if (isYes(prod.showContents) && (prod.contentsLook || '').trim()) {
        bits.push('when its contents are shown they look like ' + prod.contentsLook.trim() + ', keep this shape, count and texture stable, do not morph');
      }
      const scale = sizeToScale(prod.realSize);
      if (scale) bits.push('the product is ' + scale + ', shown at believable real-world scale relative to her body, neither oversized nor shrunken');
    } else {
      bits.push('keep the product in [Image2] consistent in shape, proportions and color throughout, at a believable real-world scale, do not distort or morph it');
    }
    bits.push('held with a steady natural grip, front of the product facing the camera, minimal rotation so it stays clearly recognizable');
    return 'PROP (a supporting object she is holding — keep it subtle and natural, do NOT let it overpower the subject): ' + bits.join('; ');
  }

  window.KolProduct = { contribute, isYes, sizeToScale, version: 'v1.0' };
  console.log('[KolProduct] 🎒 v1.0 就緒 · 道具師(商品穩定+比例尺·克制不搶主體)');
})();
