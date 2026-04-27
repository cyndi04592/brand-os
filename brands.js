// ══════════════════════════════════════════
//  brands.js — 左側品牌樹、商品列表、Nav品牌按鈕
//  v8.6: ★ 商品改成「子系列下方展開」(3 層樹狀:品牌 › 系列 › 商品)
//  v8.5: 點品牌自動收合其他品牌(這版保留)
//  v8.4: 移除 emoji icon 渲染(試算表 icon 欄位保留不動)
// ══════════════════════════════════════════

function renderNavBrands() {
  const el = document.getElementById('navBrands');
  if (!el) return;
  el.innerHTML = window.BRANDS.map(b =>
    `<button class="nb ${b.navColor||'gold'} ${window.S.brandId===b.id?'on':''}"
      onclick="clickBrand('${b.id}')">${b.name}</button>`
  ).join('');
}

function renderBrandTree() {
  document.getElementById('brandTree').innerHTML = window.BRANDS.map(b => {
    const isOpen = window.S.openBrand === b.id;

    const subRows = isOpen ? b.subs.map(sb => {
      const isSubOpen = window.S.subId === sb.id;
      const sc = getColor(sb.color);

      let prodRows = '';
      if (isSubOpen) {
        prodRows = sb.prods.map(p =>
          `<div class="prod-row-inline ${window
