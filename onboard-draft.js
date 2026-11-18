// ═══════════════════════════════════════════════════════════════
//  💾 onboard-draft.js v1.0(2026-11-18)品牌入駐書 自動存草稿
//  起因:入駐書沒存草稿,客人重新整理、關掉分頁、手機把頁面回收 → 填的全部不見。
//
//  · 每打一個字、每點一個選項,就存到「這支手機/這台電腦」的瀏覽器裡(不上傳)
//  · 下次登入同一個 email 回來,自動填回去,並跳回上次那一步(最多到「選擇方案」)
//  · 品牌靈魂書不存:回來要重新按一次生成(內容可能改過,舊的不該沿用)
//  · 送出成功 → 草稿自動刪除;14 天沒動也自動作廢;畫面上可按「清除重新填」
//  · 頁面上已經有填東西時不覆蓋
//  只讀寫表單欄位 + 呼叫 onboard.html 原有的 selectRadio / selectPreset / setColor / goStep,
//  不改送出與生成流程。onboard.html 已超過 1,500 行,這支獨立成檔。
// ═══════════════════════════════════════════════════════════════
(function () {
  'use strict';
  if (window.__onbDraft) return;
  window.__onbDraft = true;
  var VERSION = '1.0';
  var PREFIX = 'bos_onb_draft_v1:', MAX_AGE = 14 * 864e5;
  var STEPS = [1, 2, 3, 4, 46];                       // 第 5 步(靈魂書)不還原
  var SKIP = { f_category: 1, f_style: 1, f_buyer: 1, f_products: 1, f_price: 1, f_color: 1, f_colorHex: 1 };
  var RADIO_FIELD = { cat: 'f_category', style: 'f_style', buyer: 'f_buyer' };

  function lang() {
    var l = window.BOS_LANG;
    if (!l) { try { l = localStorage.getItem('bos_lang'); } catch (e) {} }
    return (l === 'ja' || l === 'en') ? l : 'zh';
  }
  function T(zh, ja, en) { var l = lang(); return l === 'ja' ? ja : l === 'en' ? en : zh; }
  function $(id) { return document.getElementById(id); }
  function shown(id) {
    var e = $(id); if (!e) return false;
    var r = e.getBoundingClientRect(), cs = getComputedStyle(e);
    return r.width > 4 && r.height > 4 && cs.display !== 'none' && cs.visibility !== 'hidden';
  }
  function loggedIn() { return !!$('sec1') && !shown('loginOverlay'); }
  function who() {
    var e = '';
    try { e = (typeof userEmail === 'string' && userEmail) || ''; } catch (x) {}          // onboard.html 登入後放這裡
    if (!e) { var n = $('navEmail'); e = (n && n.textContent) || ''; }
    if (!e) { try { e = sessionStorage.getItem('bs_email') || localStorage.getItem('bs_sso_email') || ''; } catch (x) {} }
    if (!e) { var i = $('emInput'); e = (i && i.value) || ''; }
    return String(e).trim().toLowerCase() || 'anon';
  }
  function key() { return PREFIX + who(); }
  function curStep() {
    var a = document.querySelector('.section.active');
    var n = a ? parseInt(String(a.id).replace('sec', ''), 10) : 1;
    return STEPS.indexOf(n) >= 0 ? n : (n === 5 ? 46 : 1);
  }
  function submitted() { return shown('successSection'); }

  // ── 收集 ─────────────────────────────────────────────────────
  function collect() {
    var f = {};
    document.querySelectorAll('.section input[id], .section textarea[id], .section select[id]').forEach(function (el) {
      if (SKIP[el.id] || el.type === 'file' || el.type === 'password') return;
      f[el.id] = (el.type === 'checkbox' || el.type === 'radio') ? !!el.checked : el.value;
    });
    var radio = {};
    for (var g in RADIO_FIELD) { var h = $(RADIO_FIELD[g]); if (h && h.value) radio[g] = h.value; }
    var rows = [];
    document.querySelectorAll('#prodTable .pt-row').forEach(function (r) {
      var q = function (c) { var e = r.querySelector(c); return e ? e.value : ''; };
      var k = ''; try { k = r._cell ? r._cell.get() : ''; } catch (e) {}
      if (q('.pt-name') || q('.pt-use') || q('.pt-price') || k) rows.push({ n: q('.pt-name'), u: q('.pt-use'), p: q('.pt-price'), k: k });
    });
    var pres = -1;
    document.querySelectorAll('.color-preset').forEach(function (el, i) { if (el.classList.contains('on')) pres = i; });
    var color = { preset: pres, extra: [] };
    try { color.extra = (typeof extraColors !== 'undefined' && extraColors) ? extraColors.slice() : []; } catch (e) {}
    var plan = {};
    try { plan = { p: desiredPlan, g: _pickGroup, c: _pickCycle }; } catch (e) {}
    return { v: 1, t: Date.now(), step: curStep(), f: f, radio: radio, rows: rows, color: color, plan: plan };
  }
  function hasContent(d) {
    if (!d) return false;
    for (var k in d.f) if (typeof d.f[k] === 'string' && d.f[k].trim() && k !== 'f_phoneCode') return true;
    return d.rows.length > 0 || Object.keys(d.radio).length > 0;
  }

  // ── 存 ───────────────────────────────────────────────────────
  var ready = false, timer = 0, last = '';
  function save() {
    if (!ready || !loggedIn()) return;
    if (submitted()) { clear(); return; }
    var d = collect();
    if (!hasContent(d)) return;
    var s = JSON.stringify(d);
    if (s === last) return;
    try { localStorage.setItem(key(), s); last = s; } catch (e) {}
  }
  function soon() { clearTimeout(timer); timer = setTimeout(save, 500); }
  function clear() { try { localStorage.removeItem(key()); } catch (e) {} last = ''; }

  // ── 還原 ─────────────────────────────────────────────────────
  function load() {
    try {
      var d = JSON.parse(localStorage.getItem(key()) || 'null');
      if (!d || d.v !== 1 || Date.now() - d.t > MAX_AGE) { clear(); return null; }
      return d;
    } catch (e) { return null; }
  }
  function formEmpty() {
    var n = $('f_name'), s = $('f_story');
    return !(n && n.value.trim()) && !(s && s.value.trim());
  }
  function fire(el) {
    ['input', 'change'].forEach(function (t) { el.dispatchEvent(new Event(t, { bubbles: true })); });
  }
  function restore(d) {
    // 1. 一般欄位
    for (var id in d.f) {
      var el = $(id); if (!el) continue;
      if (el.type === 'checkbox' || el.type === 'radio') { if (el.checked !== !!d.f[id]) { el.checked = !!d.f[id]; fire(el); } }
      else if (el.value !== d.f[id]) { el.value = d.f[id]; fire(el); }
    }
    // 2. 單選按鈕(類別 / 客人類型 / 風格):點同名按鈕,走原本的 selectRadio
    for (var g in d.radio) {
      var want = d.radio[g];
      var btns = document.querySelectorAll('[onclick^="selectRadio"]');
      for (var i = 0; i < btns.length; i++) {
        var oc = btns[i].getAttribute('onclick') || '';
        if (oc.indexOf("'" + g + "'") >= 0 && btns[i].textContent.trim() === want) { btns[i].click(); break; }
      }
    }
    // 3. 商品表
    if (d.rows.length && window.__pt && __pt.add) {
      var rowsEl = document.querySelector('#prodTable .pt-rows');
      var cur = document.querySelectorAll('#prodTable .pt-row');
      while (cur.length < d.rows.length) { __pt.add('', '', false, ''); cur = document.querySelectorAll('#prodTable .pt-row'); }
      d.rows.forEach(function (x, i) {
        var r = cur[i]; if (!r) return;
        var set = function (c, v) { var e = r.querySelector(c); if (e) { e.value = v || ''; fire(e); } };
        set('.pt-use', x.u); set('.pt-price', x.p);
        try { if (x.k && r._cell && r._cell.set) r._cell.set(x.k); } catch (e) {}
        set('.pt-name', x.n);                                   // 最後填名稱 → 觸發同步到 f_products
      });
      void rowsEl;
    }
    // 4. 品牌色
    try {
      if (d.color && d.color.extra && d.color.extra.length && typeof setColor === 'function') {
        extraColors = d.color.extra.slice();
        document.querySelectorAll('.color-preset').forEach(function (el) { el.classList.remove('on'); });
        setColor(extraColors[0].hex, extraColors.map(function (c) { return c.hex; }).join(', '));
      } else if (d.color && d.color.preset >= 0 && typeof selectPreset === 'function') {
        selectPreset(d.color.preset);
      }
    } catch (e) { console.warn('[onboard-draft] 品牌色還原失敗', e); }
    // 5. 方案
    try {
      if (d.plan) {
        if (typeof d.plan.g === 'string' && d.plan.g) _pickGroup = d.plan.g;
        if (typeof d.plan.c === 'string' && d.plan.c) _pickCycle = d.plan.c;
        if (typeof d.plan.p === 'string') desiredPlan = d.plan.p;
      }
    } catch (e) {}
    // 6. 跳回上次那一步(一步一步走,原本的檢查照跑;缺資料就停在缺的那步)
    try {
      var target = STEPS.indexOf(d.step) >= 0 ? d.step : 1;
      for (var s = 1; s < STEPS.length && STEPS[s - 1] !== target; s++) {
        goStep(STEPS[s]);
        var a = document.querySelector('.section.active');
        if (!a || a.id !== 'sec' + STEPS[s]) break;
      }
    } catch (e) {}
    toast();
  }

  // ── 提示條 ───────────────────────────────────────────────────
  function toast() {
    var b = document.createElement('div');
    b.id = 'onbDraftToast'; b.setAttribute('data-i18n-skip', '');
    b.style.cssText = 'position:fixed;z-index:99998;left:50%;transform:translateX(-50%);' +
      'top:calc(14px + env(safe-area-inset-top,0px));max-width:calc(100vw - 32px);box-sizing:border-box;' +
      'background:rgba(20,20,24,.95);color:#fff;border:1px solid rgba(245,197,66,.45);border-radius:12px;' +
      'padding:10px 14px;font:600 13px/1.5 "Noto Sans TC",system-ui,sans-serif;display:flex;gap:12px;align-items:center;' +
      'box-shadow:0 8px 24px rgba(0,0,0,.35)';
    var t = document.createElement('span');
    t.textContent = T('已幫你填回上次填到一半的資料。', '前回の途中までの入力を復元しました。', 'We restored what you filled in last time.');
    var x = document.createElement('button');
    x.type = 'button';
    x.textContent = T('清除重新填', 'クリアしてやり直す', 'Start over');
    x.style.cssText = 'flex:none;background:none;border:1px solid rgba(255,255,255,.3);color:#f5c542;border-radius:999px;padding:5px 10px;font:inherit;cursor:pointer';
    x.onclick = function () {
      if (!window.confirm(T('確定要清除所有已填的資料,重新開始嗎?', '入力内容をすべて消して最初からやり直しますか?', 'Clear everything and start over?'))) return;
      clear(); ready = false;
      try { location.reload(); } catch (e) {}
    };
    b.appendChild(t); b.appendChild(x);
    document.body.appendChild(b);
    setTimeout(function () { if (b.parentNode) b.parentNode.removeChild(b); }, 12000);
  }

  // ── 啟動:登入後才還原、才開始存 ───────────────────────────────
  function boot() {
    if (!loggedIn() || !(window.__pt && __pt.add)) return setTimeout(boot, 700);
    setTimeout(function () {                                    // 等原本的登入流程把欄位準備好
      var d = load();
      if (d && formEmpty() && hasContent(d)) {
        try { restore(d); } catch (e) { console.warn('[onboard-draft] 還原失敗', e); }
      }
      ready = true; save();
    }, 600);
  }
  document.addEventListener('input', soon, true);
  document.addEventListener('change', soon, true);
  document.addEventListener('click', function () { setTimeout(soon, 50); }, true);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') save(); });
  window.addEventListener('pagehide', save);
  setInterval(function () { if (ready && submitted()) clear(); else save(); }, 5000);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();

  window.BosOnbDraft = { version: VERSION, save: save, clear: clear, load: load };
  console.log('[onboard-draft] 💾 v' + VERSION + ' 入駐書自動存草稿');
})();
