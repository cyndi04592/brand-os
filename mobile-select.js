/* ════════════════════════════════════════════════════════════════════
 *  mobile-select.js · v1.0 (2026-08-23)
 *
 *  手機長下拉挑選層(全站共用)
 *
 *  ── 為什麼需要 ────────────────────────────────────────────────
 *  現場實測(iPhone Safari):選項一多,原生 <select> 的彈出清單會被
 *  系統裁掉,滑不到最後幾項。那是 iOS 系統層的行為,改 CSS 沒有用
 *  (容器本身沒有 overflow 問題,查過了)。
 *
 *  全檔排查後發現中招的不只一個:
 *    index.html   flavorSel 86 項 · contextSel 29 · selAud 22 · layoutSel 11
 *    kol.html     faceless-action 31 · ep-scene 20+ · outfit-brand 17 ·
 *                 brand-switcher 10+ · location-picker(動態)
 *    onboard.html f_phoneCode 10
 *
 *  ── 為什麼做成共用檔案 ────────────────────────────────────────
 *  一個一個頁面複製貼上 = 兩份實作,遲早漂移。
 *  (2026-08-23 當天已經吃過三次「兩邊各寫一套」的虧:
 *   STEP2/STEP3 商品照讀取、場景守門、進度顯示。)
 *
 *  ── 設計原則 ──────────────────────────────────────────────────
 *  ① 資料只讀原生 <select> 的 options,不另外重組一份
 *  ② 選完改 select.value → 派發原生 change 事件
 *     → onchange="" 與 addEventListener 兩種寫法都吃得到,既有邏輯零改動
 *  ③ 用事件委派(capture)攔截 → 連【動態產生】的 select 也蓋得到
 *     (ep-scene / location-picker 都是 innerHTML 之後才存在的)
 *  ④ 桌機完全不碰,原生 select 照舊 —— 桌機沒這問題,別為修 A 弄壞 B
 *  ⑤ 想排除某個 select:加 data-bp-skip="1"
 * ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.__mobileSelectReady) return;      // 兩個頁面都載到也只跑一次
  window.__mobileSelectReady = true;

  var MIN_OPTIONS = 8;        // 8 項以下原生就夠用,不必攔
  var SEARCH_FROM = 14;       // 14 項以上才顯示搜尋框(免得一開就跳鍵盤擋畫面)
  var target = null;

  function isMobile() {
    return window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
  }
  function esc(t) {
    return String(t == null ? '' : t)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ── 樣式(注入一次)──────────────────────────────────────
  function injectCss() {
    if (document.getElementById('bp-style')) return;
    var css = ''
      + '.bp-sheet{position:fixed;inset:0;z-index:9000;display:none;background:rgba(5,5,10,.72);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);}'
      + '.bp-sheet.on{display:block;}'
      + '.bp-panel{position:absolute;left:0;right:0;bottom:0;max-height:82vh;display:flex;flex-direction:column;'
      + 'background:#111118;border-radius:18px 18px 0 0;border-top:1px solid rgba(255,255,255,.08);'
      + 'animation:bpUp .22s cubic-bezier(.4,0,.2,1);font-family:"Noto Sans TC",system-ui,sans-serif;}'
      + '@keyframes bpUp{from{transform:translateY(100%);}to{transform:translateY(0);}}'
      + '.bp-head{padding:14px 18px 10px;border-bottom:1px solid rgba(255,255,255,.08);flex:none;}'
      + '.bp-head .t{font-weight:800;font-size:15px;margin-bottom:9px;color:#f0f0f8;}'
      + '.bp-search{width:100%;box-sizing:border-box;padding:10px 12px;border-radius:10px;background:#1a1a24;'
      + 'border:1px solid rgba(255,255,255,.1);color:#f0f0f8;font-size:16px;font-family:inherit;outline:none;}'
      + '.bp-search:focus{border-color:#7c6dfa;}'
      + '.bp-list{overflow-y:auto;-webkit-overflow-scrolling:touch;padding:6px 10px 26px;flex:1;}'
      + '.bp-item{padding:13px 14px;border-radius:10px;font-size:15px;color:rgba(240,240,248,.72);'
      + 'cursor:pointer;display:flex;align-items:center;gap:9px;}'
      + '.bp-item:active{background:#1a1a24;}'
      + '.bp-item.on{background:rgba(124,109,250,.18);color:#f0f0f8;font-weight:700;}'
      + '.bp-item .tk{color:#6dfac2;font-size:13px;width:14px;flex:none;}'
      + '.bp-close{position:absolute;top:-46px;right:16px;width:36px;height:36px;border-radius:50%;'
      + 'background:rgba(255,255,255,.16);border:none;color:#fff;font-size:17px;cursor:pointer;}';
    var st = document.createElement('style');
    st.id = 'bp-style'; st.textContent = css;
    document.head.appendChild(st);
  }

  // ── 挑選層 DOM(建一次)──────────────────────────────────
  function ensureSheet() {
    var sh = document.getElementById('bp-sheet');
    if (sh) return sh;
    injectCss();
    sh = document.createElement('div');
    sh.className = 'bp-sheet'; sh.id = 'bp-sheet';
    sh.innerHTML = ''
      + '<div class="bp-panel">'
      +   '<button class="bp-close" type="button">✕</button>'
      +   '<div class="bp-head"><div class="t">選擇</div>'
      +     '<input class="bp-search" type="search" placeholder="輸入關鍵字搜尋…" autocomplete="off">'
      +   '</div>'
      +   '<div class="bp-list"></div>'
      + '</div>';
    document.body.appendChild(sh);
    sh.addEventListener('click', function (e) { if (e.target === sh) close(); });
    sh.querySelector('.bp-close').addEventListener('click', close);
    sh.querySelector('.bp-search').addEventListener('input', function () { render(this.value); });
    return sh;
  }

  function render(kw) {
    var sh = ensureSheet();
    var box = sh.querySelector('.bp-list');
    if (!target || !box) return;
    var q = String(kw || '').trim().toLowerCase();
    var cur = target.value;
    var opts = Array.prototype.filter.call(target.options, function (o) {
      if (o.disabled) return false;
      if (!q) return true;
      return (o.textContent || '').toLowerCase().indexOf(q) !== -1;
    });
    box.innerHTML = opts.length
      ? opts.map(function (o) {
          var on = o.value === cur;
          return '<div class="bp-item' + (on ? ' on' : '') + '" data-v="' + esc(o.value) + '">'
               + '<span class="tk">' + (on ? '✓' : '') + '</span>' + esc(o.textContent) + '</div>';
        }).join('')
      : '<div style="padding:28px 14px;text-align:center;color:rgba(240,240,248,.45);font-size:13px">找不到符合的項目</div>';
    Array.prototype.forEach.call(box.querySelectorAll('.bp-item'), function (el) {
      el.addEventListener('click', function () {
        target.value = el.getAttribute('data-v');
        var t = target;
        close();
        // 原生事件 → onchange="" 與 addEventListener 都收得到
        t.dispatchEvent(new Event('change', { bubbles: true }));
      });
    });
  }

  function labelOf(sel) {
    // 找不到就回空字串 —— 絕不讓「取標題」這種小事炸掉整個挑選層
    try {
      if (sel.id) {
        var lf = document.querySelector('label[for="' + sel.id + '"]');
        if (lf && lf.textContent.trim()) return lf.textContent.trim();
      }
      var box = sel.closest('.ep-field,.form-group,.kai-field,.brand-switcher,.field,.row,label,div');
      var el = box && box.querySelector('label,.form-label,.brand-switcher-label,.kai-label,.lbl');
      if (el && el.textContent.trim()) return el.textContent.trim().slice(0, 20);
    } catch (e) {}
    return '';
  }

  function open(sel) {
    var sh = ensureSheet();
    target = sel;
    var t = sh.querySelector('.bp-head .t');
    if (t) t.textContent = labelOf(sel) || '選擇';
    var inp = sh.querySelector('.bp-search');
    if (inp) {
      inp.value = '';
      inp.style.display = sel.options.length >= SEARCH_FROM ? '' : 'none';
    }
    render('');
    sh.classList.add('on');
    document.body.style.overflow = 'hidden';   // 背景不要跟著捲
  }

  function close() {
    var sh = document.getElementById('bp-sheet');
    if (sh) sh.classList.remove('on');
    document.body.style.overflow = '';
    target = null;
  }

  // ── 全域攔截 ──────────────────────────────────────────────
  //   用 capture 事件委派:動態產生的 select 也蓋得到,
  //   逐一 addEventListener 一定會漏。
  function handler(e) {
    if (!isMobile()) return;                                  // 桌機照舊
    var sel = e.target && e.target.closest && e.target.closest('select');
    if (!sel || sel.disabled || sel.multiple) return;
    if (sel.getAttribute('data-bp-skip') === '1') return;
    if (sel.options.length < MIN_OPTIONS) return;             // 短下拉原生就好
    e.preventDefault();
    sel.blur();
    open(sel);
  }
  document.addEventListener('mousedown', handler, true);
  document.addEventListener('touchstart', handler, { capture: true, passive: false });

  window.MobileSelect = { open: open, close: close, MIN_OPTIONS: MIN_OPTIONS };
  console.log('[mobile-select] v1.0 就緒 · 手機 ≥' + MIN_OPTIONS + ' 項的下拉自動接管(桌機不變)');
})();
