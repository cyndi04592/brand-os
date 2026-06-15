// kol-product.js · v1.1 · 道具師(Prop / Product Director)
// 讓「她手上的商品」形狀/包裝/內容物/比例穩定,但克制、不搶主體 KOL。
// v1.1 改:① 比例改錨「臉」(臉被 @Image1 鎖死=穩定尺規,手是生成的不可靠)
//          ② 加防鏡像:品牌文字正向可讀、不可翻轉
//          ③ 比例文字精簡(Seedance 2.0 吃導演式指令,不吃形容詞堆疊)
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
  // 🎯 v1.1:比例錨「臉/身體」這種被參考照鎖死的部位,而非「手」(手是生成的,當尺規會飄)
  function sizeToScale(realSize) {
    const nums = (String(realSize || '').match(/\d+(?:\.\d+)?/g) || []).map(Number).filter(n => n > 0);
    if (!nums.length) return '';
    const cm = Math.max(...nums);
    if (cm <= 8)  return 'roughly the size of her palm or smaller';
    if (cm <= 20) return 'roughly as tall as her face';
    if (cm <= 40) return 'roughly the length of her forearm';
    return 'roughly as wide as her torso';
  }
  function contribute(ctx) {
    const prod = findProduct(ctx);
    const bits = [];
    if (prod) {
      const hasPack = isYes(prod.hasPackaging);
      const desc = [(prod.packShape || '').trim(), (prod.productLook || '').trim()].filter(Boolean).join('、');
      if (hasPack && desc) {
        bits.push('the product held in [Image2] is ' + desc + ', keep its packaging shape, color and label consistent and undistorted, its printed brand text reading correctly and never mirrored, reversed or flipped, matching [Image2] exactly');
      } else {
        bits.push('keep the product in [Image2] consistent in shape, proportions and color, never mirrored or flipped, do not distort or morph it');
      }
      if (isYes(prod.showContents) && (prod.contentsLook || '').trim()) {
        bits.push('when its contents are shown they look like ' + prod.contentsLook.trim() + ', keep this shape, count and texture stable, do not morph');
      }
      const scale = sizeToScale(prod.realSize);
      if (scale) bits.push('the product is ' + scale + ', shown at that true size against her body');
    } else {
      bits.push('keep the product in [Image2] consistent in shape, proportions and color, never mirrored or flipped, at a believable real-world scale, do not distort or morph it');
    }
    bits.push('held steadily with its printed front facing the camera, minimal rotation so it stays clearly recognizable');
    return 'PROP (a supporting object she is holding — keep it subtle and natural, do NOT let it overpower the subject): ' + bits.join('; ');
  }
  window.KolProduct = { contribute, isYes, sizeToScale, version: 'v1.1' };
  console.log('[KolProduct] 🎒 v1.1 就緒 · 道具師(比例錨臉+防鏡像+精簡)');
})();
