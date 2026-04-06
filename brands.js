// ══════════════════════════════════════════
//  brands.js — 左側品牌樹、商品列表、Nav品牌按鈕
// ══════════════════════════════════════════

// ══ Nav 品牌按鈕 ══
function renderNavBrands() {
  document.getElementById('navBrands').innerHTML = window.BRANDS.map(b =>
    `<button class="nb ${b.navColor||'gold'} ${window.S.brandId===b.id?'on':''}"
      onclick="clickBrand('${b.id}')">${b.name}</button>`
  ).join('');
}

// ══ 左側品牌樹（accordion）══
function renderBrandTree() {
  document.getElementById('brandTree').innerHTML = window.BRANDS.map(b => {
    const isOpen = window.S.openBrand === b.id;
    const subRows = isOpen ? b.subs.map(sb =>
      `<div class="sub-brand-row ${window.S.subId===sb.id?'on':''}"
        onclick="clickSub('${b.id}','${sb.id}')">
        <div class="dot"></div>${sb.name}
      </div>`
    ).join('') : '';
    return `<div>
      <div class="brand-row ${window.S.brandId===b.id&&!window.S.subId?'on':''}"
        onclick="clickBrand('${b.id}')">
        <span class="br-icon">${b.icon}</span>
        <div class="br-info">
          <div class="br-name">${b.name}</div>
          <div class="br-sub">${b.subs.length}個系列</div>
        </div>
        <span style="color:var(--t3);font-size:11px;${isOpen?'transform:rotate(90deg);display:inline-block':''}">›</span>
      </div>
      ${subRows}
    </div>`;
  }).join('');
}

// ══ 商品列表 ══
function renderProds() {
  const el = document.getElementById('prodList');
  const brand = window.BRANDS.find(b => b.id === window.S.brandId);
  if (!brand) {
    el.innerHTML = '<div class="empty" style="padding:24px 10px;"><div class="empty-ico">·</div><div class="empty-p">← 先選品牌</div></div>';
    return;
  }
  const subs = window.S.subId ? brand.subs.filter(s => s.id === window.S.subId) : brand.subs;
  let html = '';
  subs.forEach(sb => {
    const sc = getColor(sb.color);
    html += `<div style="margin-bottom:12px;">
      <div class="prod-grp-label" style="color:${sc.c}">${sb.name}</div>
      ${sb.prods.map(p =>
        `<div class="prod-row ${window.S.prod?.id===p.id?'on':''}"
          onclick="clickProd('${sb.id}','${p.id}')">
          <div class="prod-dot"></div>
          <div>
            <div class="prod-name">${p.name}</div>
            <div class="prod-tag">${p.tag}</div>
          </div>
        </div>`
      ).join('')}
    </div>`;
  });
  el.innerHTML = html;
}

// ══ 點選品牌 ══
function clickBrand(id) {
  window.S.openBrand = window.S.openBrand === id ? null : id;
  window.S.brandId = id;
  window.S.subId = null;
  window.S.prod = null;

  renderNavBrands();
  renderBrandTree();
  renderProds();
  updateCtx();

  // 自動填入資料夾（隱藏輸入框用）
  const f = window.BRAND_FOLDERS[id];
  if (f) {
    const photoInput = document.getElementById('inPhotoFolder');
    const videoInput = document.getElementById('inVideoFolder');
    if (photoInput) photoInput.value = f.photo || '';
    if (videoInput) videoInput.value = f.video || '';
  }

  // 智慧快取：切換品牌時自動載入素材（只抓一次）
  autoFetchAssets(id);
}

// ══ 點選子系列 ══
function clickSub(brandId, subId) {
  window.S.brandId = brandId;
  window.S.subId = subId;
  window.S.prod = null;
  window.S.openBrand = brandId;
  renderNavBrands();
  renderBrandTree();
  renderProds();
  updateCtx();
}

// ══ 點選商品 ══
function clickProd(subId, prodId) {
  const brand = window.BRANDS.find(b => b.id === window.S.brandId);
  const sub   = brand?.subs.find(s => s.id === subId);
  const prod  = sub?.prods.find(p => p.id === prodId);
  if (!prod) return;
  window.S.subId = subId;
  window.S.prod  = prod;
  renderBrandTree();
  renderProds();
  updateCtx();
}

// ══ 更新中間品牌/商品顯示 ══
function updateCtx() {
  const brand = window.BRANDS.find(b => b.id === window.S.brandId);
  const sub   = brand?.subs.find(s => s.id === window.S.subId);
  const sc    = getColor(sub?.color || brand?.navColor);
  const bEl   = document.getElementById('gbBrand');
  const pEl   = document.getElementById('gbProd');
  if (!brand) {
    bEl.textContent = '尚未選擇品牌'; bEl.style.color = 'var(--t3)';
    pEl.textContent = '← 先選商品';   pEl.style.color = 'var(--t3)';
    return;
  }
  bEl.style.color = sc.c;
  bEl.textContent = `${brand.icon} ${brand.name}${sub ? ' › ' + sub.name : ''}`;
  pEl.style.color   = window.S.prod ? 'var(--t1)' : 'var(--t3)';
  pEl.textContent   = window.S.prod ? window.S.prod.name : '← 先選商品';
}
