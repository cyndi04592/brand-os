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
          `<div class="prod-row-inline ${window.S.prod?.id===p.id?'on':''}"
            onclick="event.stopPropagation();clickProd('${sb.id}','${p.id}')"
            style="margin:3px 0 3px 36px;padding:6px 10px;border-radius:6px;cursor:pointer;
                   background:${window.S.prod?.id===p.id?'rgba(91,200,200,0.10)':'transparent'};
                   border:1px solid ${window.S.prod?.id===p.id?'rgba(91,200,200,0.35)':'transparent'};
                   transition:all 0.15s;">
            <div style="display:flex;align-items:flex-start;gap:7px;">
              <div style="width:5px;height:5px;border-radius:50%;background:${sc.c};margin-top:6px;flex-shrink:0;"></div>
              <div style="flex:1;min-width:0;">
                <div style="font-size:11px;font-weight:600;color:#FAFAFA;letter-spacing:0.3px;line-height:1.4;">${p.name}</div>
                <div style="font-size:9px;color:#6A6860;margin-top:1px;letter-spacing:0.3px;">${p.tag}</div>
              </div>
            </div>
          </div>`
        ).join('');
      }

      return `<div class="sub-brand-row ${isSubOpen?'on':''}"
        onclick="clickSub('${b.id}','${sb.id}')">
        <div class="dot"></div>${sb.name}
      </div>
      ${prodRows}`;
    }).join('') : '';

    return `<div>
      <div class="brand-row ${window.S.brandId===b.id&&!window.S.subId?'on':''}"
        onclick="clickBrand('${b.id}')">
        <div class="br-info">
          <div class="br-name">${b.name}</div>
          <div class="br-sub">${b.subs.length}個系列</div>
        </div>
        <span style="color:var(--t3);font-size:11px;${isOpen?'transform:rotate(90deg);display:inline-block':''}">›</span>
      </div>
      ${subRows}
    </div>`;
  }).join('');

  // 🩹 2026-08-08 修正:頁面剛載入時 updateCtx() 從來沒被呼叫過
  //   (它原本只掛在「點品牌／點子品牌／點商品」三個事件上),
  //   所以 need-brand 這個狀態 class 根本沒機會加上去 —— 一進站是全亮的,
  //   等於狀態引導完全沒作用。
  //   renderBrandTree() 是初始化一定會跑到的地方(auth.js 三處都會呼叫),
  //   在這裡補叫一次,進站當下就會正確判斷該亮還是該暗。
  updateCtx();
}

function renderProds() {
  const el = document.getElementById('prodList');
  if (!el) return;
  el.innerHTML = '';
}

function clickBrand(id) {
  window.S.openBrand = window.S.openBrand === id ? null : id;
  window.S.brandId = id;
  window.S.subId = null;
  window.S.prod = null;

  renderNavBrands();
  renderBrandTree();
  renderProds();
  updateCtx();

  const f = window.BRAND_FOLDERS[id];
  if (f) {
    const photoInput = document.getElementById('inPhotoFolder');
    const videoInput = document.getElementById('inVideoFolder');
    if (photoInput) photoInput.value = f.photo || '';
    if (videoInput) videoInput.value = f.video || '';
  }

  autoFetchAssets(id);
}

function clickSub(brandId, subId) {
  if (window.S.subId === subId && window.S.brandId === brandId) {
    window.S.subId = null;
    window.S.prod = null;
  } else {
    window.S.brandId = brandId;
    window.S.subId = subId;
    window.S.prod = null;
    window.S.openBrand = brandId;
  }
  renderNavBrands();
  renderBrandTree();
  renderProds();
  updateCtx();
}

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

function updateCtx() {
  const brand = window.BRANDS.find(b => b.id === window.S.brandId);
  const sub   = brand?.subs.find(s => s.id === window.S.subId);
  const sc    = getColor(sub?.color || brand?.navColor);
  const bEl   = document.getElementById('gbBrand');
  const pEl   = document.getElementById('gbProd');
  // 🆕 2026-08-08:這兩個顯示元素已從 index.html 移除
  //   (客戶登入只看得到自己的品牌,「尚未選擇品牌」是多餘的提示)。
  //   ⚠️ 原本這裡是裸的 bEl.textContent = ... —— 元素不在就會噴 null,
  //     而 updateCtx() 每次切品牌都會跑,等於整頁功能連鎖失效。
  //   保留賦值邏輯是為了「哪天想把狀態列加回來」時不用再改這裡。
  // 🆕 2026-08-08:狀態引導。沒選品牌時,中間欄與右欄整片暗掉、不可點,
  //   客戶自然只會去點左邊亮著的品牌 —— 比寫「① 選品牌 → ②…」有效得多,
  //   而且不佔版面。選了品牌就自動亮回來。
  //   ★ 用 class 開關,樣式全在 style.css;這裡只負責「現在該亮還是暗」。
  //   ★ 預設不加 class → 萬一這段沒跑到,畫面是正常的(不會把客戶鎖在外面)。
  document.body.classList.toggle('need-brand', !brand);

  if (!bEl || !pEl) return;
  if (!brand) {
    bEl.textContent = '尚未選擇品牌'; bEl.style.color = 'var(--t3)';
    pEl.textContent = '← 先選商品';   pEl.style.color = 'var(--t3)';
    return;
  }
  bEl.style.color = sc.c;
  bEl.textContent = `${brand.name}${sub ? ' › ' + sub.name : ''}`;
  pEl.style.color   = window.S.prod ? 'var(--t1)' : 'var(--t3)';
  pEl.textContent   = window.S.prod ? window.S.prod.name : '← 先選商品';
}
