// ═══════════════════════════════════════════════════════════════
//  👆 need-brand-hint.js v1.0(2026-11-18)首頁「還沒選品牌」時,點下面的功能要有反應
//  起因:RA 2026-11-18 —「上傳商品照的按鈕被擋住點不進去」。
//    原設計:還沒選品牌 → body.need-brand → 中間、右邊整塊變淡且「點不到」(pointer-events:none)。
//    手機上品牌按鈕在最上面,客人滑到下面按「＋ 商品照」完全沒反應,以為壞掉。
//  這支只做兩件事,不改原本的鎖定邏輯:
//    1. 只有一個品牌的帳號(一般客人)→ 自動幫他選好,根本不會被鎖
//    2. 鎖住時點到變淡的區塊 → 跳出提示「先選品牌」,並捲回品牌那排、閃一下
//  文字跟著網站語言(中文 / 日本語 / English)。index.html 已超過 1,500 行,這支獨立成檔。
// ═══════════════════════════════════════════════════════════════
(function () {
  'use strict';
  if (window.__needBrandHint) return;
  window.__needBrandHint = true;
  var VERSION = '1.0';

  function lang() {
    var l = window.BOS_LANG;
    if (!l) { try { l = localStorage.getItem('bos_lang'); } catch (e) {} }
    return (l === 'ja' || l === 'en') ? l : 'zh';
  }
  function T(zh, ja, en) { var l = lang(); return l === 'ja' ? ja : l === 'en' ? en : zh; }
  function locked() { return document.body && document.body.classList.contains('need-brand'); }
  function chips() {
    return [].slice.call(document.querySelectorAll('#btmBrands .btm-chip')).filter(function (b) {
      var r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0;
    });
  }

  // ── 1. 只有一個品牌 → 自動選 ─────────────────────────────────
  var autoTried = false;
  function autoPick() {
    if (autoTried || !locked()) return;
    var c = chips();
    if (c.length === 1) { autoTried = true; try { c[0].click(); } catch (e) {} }
    else if (c.length > 1) autoTried = true;                      // 多品牌(老闆 / 代理商)讓他自己選
  }

  // ── 2. 點到變淡的區塊 → 提示 + 捲回品牌 ──────────────────────
  var tip = null, tipTimer = 0;
  function showTip() {
    if (!tip) {
      tip = document.createElement('div');
      tip.setAttribute('data-i18n-skip', '');
      tip.style.cssText = 'position:fixed;z-index:99998;left:50%;transform:translateX(-50%);' +
        'top:calc(14px + env(safe-area-inset-top,0px));max-width:calc(100vw - 32px);box-sizing:border-box;' +
        'background:rgba(20,20,24,.96);color:#fff;border:1px solid rgba(245,197,66,.6);border-radius:12px;' +
        'padding:10px 14px;font:700 14px/1.5 "Noto Sans TC",system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.4);' +
        'pointer-events:none;transition:opacity .25s';
      document.body.appendChild(tip);
    }
    tip.textContent = T('請先在上面選一個品牌,下面的功能才會打開 👆',
                        'まず上でブランドを選ぶと、下の機能が使えるようになります 👆',
                        'Pick a brand above first — then these tools unlock 👆');
    tip.style.opacity = '1'; tip.style.display = '';
    clearTimeout(tipTimer);
    tipTimer = setTimeout(function () { tip.style.opacity = '0'; setTimeout(function () { tip.style.display = 'none'; }, 260); }, 3200);
    var box = document.getElementById('brandTree') || document.getElementById('btmBrands');
    if (box) {
      try { box.scrollIntoView({ block: 'center' }); } catch (e) { box.scrollIntoView(); }
      box.style.transition = 'box-shadow .3s';
      box.style.boxShadow = '0 0 0 3px #f5c542, 0 0 22px rgba(245,197,66,.55)';
      box.style.borderRadius = box.style.borderRadius || '12px';
      setTimeout(function () { box.style.boxShadow = ''; }, 1600);
    }
  }
  function inLockedArea(x, y) {
    var areas = document.querySelectorAll('.workspace > .mid, .workspace > .right');
    for (var i = 0; i < areas.length; i++) {
      var r = areas[i].getBoundingClientRect();
      if (r.width > 0 && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return true;
    }
    return false;
  }
  document.addEventListener('click', function (ev) {
    if (!locked()) return;
    if (ev.target && ev.target.closest && ev.target.closest('#brandTree, #btmBrands, .bt-card, .bt-tour-pill')) return;
    if (inLockedArea(ev.clientX, ev.clientY)) showTip();
  }, true);

  setInterval(autoPick, 800);
  console.log('[need-brand-hint] 👆 v' + VERSION + ' 未選品牌提示');
})();
