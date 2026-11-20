// ══════════════════════════════════════════
//  brands.js — 左側品牌樹、商品列表、Nav品牌按鈕
//  v8.8: 📱 品牌只有一個系列 → 點品牌就直接選好系列、商品馬上出現;商品卡小字跟系列同名就不重複寫
//  v8.7: 📱 手機改成由上往下三步(品牌 → 系列 → 商品大卡片),桌機不變
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

// ══════════════════════════════════════════
//  📱 v8.7(2026-11-15 RA:手機選商品不直覺,重新設計)
//   以前手機上是「橫向滑軌」:品牌、系列、商品擠在同一條往右長,商品長在螢幕外面,
//   客人不知道要往右滑,系列名稱也被切掉。
//   現在手機改成「由上往下三步」:
//     ① 品牌(一排小膠囊,可左右滑)→ ② 系列(膠囊自動換行)→ ③ 商品(整排大卡片,一列一個,好點)
//   最上面一行顯示「目前選到哪裡」。點擊照用原本的 clickBrand / clickSub / clickProd,其他程式不用改。
//   桌機(> 768px)完全照舊。
// ══════════════════════════════════════════
function _btIsMobile() {
  try { return !!(window.matchMedia && window.matchMedia('(max-width: 768px)').matches); } catch (e) { return false; }
}
function _btCss() {
  if (document.getElementById('bt-m-css')) return;
  var s = document.createElement('style');
  s.id = 'bt-m-css';
  s.textContent = '@media (max-width:768px){'
    + '#brandTree{display:block!important;overflow:visible!important;white-space:normal!important;width:100%!important}'
    + '.btm{display:flex;flex-direction:column;gap:10px;width:100%}'
    + '.btm-path{font-size:13px;color:var(--t2,#b9b9c8);line-height:1.5;padding:2px 2px 4px}'
    + '.btm-path b{color:var(--t1,#fff)}'
    + '.btm-lbl{font-size:12px;font-weight:700;letter-spacing:1px;color:var(--t3,#8a8aa0);margin-top:4px}'
    + '.btm-chips{display:flex;gap:8px;overflow-x:auto;padding:2px 2px 6px;-webkit-overflow-scrolling:touch;scrollbar-width:none}'
    + '.btm-chips::-webkit-scrollbar{display:none}'
    + '.btm-chips.wrap{flex-wrap:wrap;overflow:visible}'
    + '.btm-chip{flex:0 0 auto;padding:9px 14px;border-radius:999px;border:1px solid var(--line,rgba(255,255,255,.12));background:rgba(255,255,255,.03);color:var(--t1,#f0f0f8);font:600 14px "Noto Sans TC",sans-serif;cursor:pointer;white-space:nowrap}'
    + '.btm-chip span{margin-left:6px;font-size:12px;color:var(--t3,#8a8aa0)}'
    + '.btm-chip.on{border-color:var(--accent,#7c6dfa);background:rgba(124,109,250,.16);color:#fff}'
    + '.btm-list{display:flex;flex-direction:column;gap:8px}'
    + '.btm-prod{display:flex;align-items:center;gap:10px;width:100%;text-align:left;padding:13px 14px;border-radius:12px;border:1px solid var(--line,rgba(255,255,255,.12));background:rgba(255,255,255,.03);color:var(--t1,#f0f0f8);cursor:pointer;font-family:"Noto Sans TC",sans-serif}'
    + '.btm-prod .tx{flex:1;min-width:0}'
    + '.btm-prod .n{display:block;font-size:15px;font-weight:700;line-height:1.4}'
    + '.btm-prod .t{display:block;font-size:12.5px;color:var(--t3,#8a8aa0);margin-top:2px}'
    + '.btm-prod .ck{flex:0 0 22px;height:22px;border-radius:50%;border:1.5px solid var(--line,rgba(255,255,255,.25));display:flex;align-items:center;justify-content:center;font-size:13px;color:transparent}'
    + '.btm-prod.on{border-color:rgba(91,200,200,.6);background:rgba(91,200,200,.10)}'
    + '.btm-prod.on .ck{background:#5bc8c8;border-color:#5bc8c8;color:#0a0a0b}'
    + '.btm-hint{font-size:13px;color:var(--t3,#8a8aa0);padding:4px 2px}'
    + '}';
  document.head.appendChild(s);
}
function renderBrandTreeMobile() {
  _btCss();
  var S = window.S, list = window.BRANDS || [];
  var brand = list.find(function (b) { return b.id === S.brandId; });
  var sub = brand && brand.subs.find(function (s) { return s.id === S.subId; });
  var h = '<div class="btm">';
  h += '<div class="btm-path">' + (brand
        ? brand.name + (sub ? ' › ' + sub.name : '') + (S.prod ? ' › <b>' + S.prod.name + '</b>' : '')
        : '先選品牌') + '</div>';
  h += '<div class="btm-lbl">① 品牌</div><div class="btm-chips" id="btmBrands">'
     + list.map(function (b) {
         return '<button type="button" class="btm-chip' + (S.brandId === b.id ? ' on' : '') + '" onclick="clickBrandM(\'' + b.id + '\')">' + b.name + '</button>';
       }).join('') + '</div>';
  if (brand) {
    h += '<div class="btm-lbl">② 系列</div><div class="btm-chips wrap">'
       + brand.subs.map(function (sb) {
           return '<button type="button" class="btm-chip' + (S.subId === sb.id ? ' on' : '') + '" onclick="clickSub(\'' + brand.id + '\',\'' + sb.id + '\')">' + sb.name + '<span>' + ((sb.prods || []).length) + '</span></button>';
         }).join('') + '</div>';
    if (sub) {
      h += '<div class="btm-lbl">③ 商品</div><div class="btm-list">'
         + (sub.prods || []).map(function (p) {
             var on = S.prod && S.prod.id === p.id;
             return '<button type="button" class="btm-prod' + (on ? ' on' : '') + '" onclick="clickProd(\'' + sub.id + '\',\'' + p.id + '\')">'
               + '<span class="tx"><span class="n">' + p.name + '</span>' + (p.tag && p.tag !== sub.name ? '<span class="t">' + p.tag + '</span>' : '') + '</span>'
               + '<span class="ck">✓</span></button>';
           }).join('') + '</div>';
    } else {
      h += '<div class="btm-hint">選一個系列,商品就會出現在下面</div>';
    }
  }
  h += '</div>';
  document.getElementById('brandTree').innerHTML = h;
  try {   // 選到的品牌滑進畫面(品牌多時)
    var on = document.querySelector('#btmBrands .btm-chip.on');
    if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest', inline: 'center' });
  } catch (e) {}
  updateCtx();
}
//  手機上點已選的品牌 → 維持選取(桌機那邊是「再點一次收合」,手機不需要收合)
function clickBrandM(id) {
  if (window.S.brandId === id) { renderBrandTree(); return; }
  clickBrand(id);
  //  v8.8 只有一個系列 → 不用再多點一次,直接選好
  try {
    var b = (window.BRANDS || []).find(function (x) { return x.id === id; });
    if (b && b.subs && b.subs.length === 1 && window.S.brandId === id && !window.S.subId) clickSub(id, b.subs[0].id);
  } catch (e) {}
}
//  轉螢幕 / 視窗大小跨過 768 時重畫一次
try {
  if (window.matchMedia) {
    var _btMq = window.matchMedia('(max-width: 768px)');
    var _btRe = function () { try { if (window.BRANDS && window.S) renderBrandTree(); } catch (e) {} };
    if (_btMq.addEventListener) _btMq.addEventListener('change', _btRe); else if (_btMq.addListener) _btMq.addListener(_btRe);
  }
} catch (e) {}

function renderBrandTree() {
  if (_btIsMobile()) { renderBrandTreeMobile(); return; }
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
      ${prodRows ? `<div class="prod-stack">${prodRows}</div>` : ''}`;
    }).join('') : '';

    return `<div>
      <div class="brand-row ${window.S.brandId===b.id&&!window.S.subId?'on':''}" data-bid="${b.id}"
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
  try { window.AdShootBadge && window.AdShootBadge.paint(); } catch (_) {}
}

// 🎬 2026-11-21 RA:「有美術指導的品牌要有一層框框,我一眼就知道它有沒有」
//   判斷標準只有一個:正式站上有沒有這個品牌的拍法檔(/shoots/<品牌ID>.json)而且裡面定了頂級拍攝類型(genre)。
//   有 → 品牌卡加金框 + 小標「🎬 拍攝類型｜N 樣商品有專屬拍法」;沒有 → 維持原樣(新品牌當晚補好、23:15 上線後自動出現)。
//   每個品牌一小時只問一次,結果記在這次開頁的記憶裡,不會每次重畫都重抓。
window.AdShootBadge = (function () {
  var C = {}, Q = [], busy = 0;
  function css() {
    if (document.getElementById('adShootBadgeCss')) return;
    var st = document.createElement('style'); st.id = 'adShootBadgeCss';
    st.textContent = '.brand-row.has-ad{border-color:#e6be5a !important;box-shadow:0 0 0 1px rgba(230,190,90,.55),0 0 14px rgba(230,190,90,.18)}'
      + '.br-ad{margin-top:3px;font-size:10.5px;line-height:1.35;color:#e6be5a;letter-spacing:.2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:220px}';
    document.head.appendChild(st);
  }
  function apply(row, info) {
    if (!row || !info) return;
    row.classList.add('has-ad');
    var box = row.querySelector('.br-info'); if (!box || box.querySelector('.br-ad')) return;
    var d = document.createElement('div'); d.className = 'br-ad';
    d.textContent = '🎬 ' + info.zh + (info.n ? '｜' + info.n + ' 樣商品有專屬拍法' : '');
    d.title = '美術指導已定這個品牌的頂級拍攝類型:' + info.zh + (info.n ? '(' + info.n + ' 樣商品有專屬拍法)' : '');
    box.appendChild(d);
  }
  function pump() {
    while (busy < 4 && Q.length) {
      (function (bid) {
        busy++;
        fetch('/shoots/' + encodeURIComponent(bid) + '.json?v=' + Math.floor(Date.now() / 3600000))
          .then(function (r) { return r.ok ? r.json() : null; })
          .then(function (j) {
            var g = j && j.genre;
            C[bid] = (g && g.en) ? { zh: String(g.zh || g.en).split(/[(\uFF08]/)[0].trim().slice(0, 18), n: Object.keys(j.products || {}).length } : false;
          })
          .catch(function () { C[bid] = false; })
          .then(function () { busy--; paint(); pump(); });
      })(Q.shift());
    }
  }
  function paint() {
    css();
    var rows = document.querySelectorAll('.brand-row[data-bid]');
    for (var i = 0; i < rows.length; i++) {
      var bid = rows[i].getAttribute('data-bid');
      if (C[bid] === undefined) { C[bid] = null; Q.push(bid); }
      else if (C[bid]) apply(rows[i], C[bid]);
    }
    pump();
  }
  return { paint: paint, cache: C };
})();

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
  _mobileReveal('.sub-brand-row');
}

//  📱 2026-10-07 手機巡站(Claude 從 RA 的 Chrome 用 390 寬實測):
//   手機上品牌是橫向滑軌。點了品牌之後,系列和商品是長在【螢幕右邊外面】(實測 x=396、488,螢幕才 390),
//   畫面看起來什麼都沒變 —— 客人不知道要往右滑,以為點了沒反應。
//   ★ 修法:手機上點完品牌/系列,自動把下一步要點的東西滑進畫面。桌機完全不動。
function _mobileReveal(sel) {
  try {
    if (!window.matchMedia || !window.matchMedia('(max-width: 768px)').matches) return;
    setTimeout(function () {
      var tree = document.getElementById('brandTree') || document;
      var el = tree.querySelector(sel);
      if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
    }, 60);
  } catch (e) {}
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
  if (window.S.subId) _mobileReveal('.prod-stack');
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
