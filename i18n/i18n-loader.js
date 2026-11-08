/* ═══════════════════════════════════════════════════════════════════
   Brand OS 語言包載入器 i18n-loader.js  v1.0(2026-11-08)
   ───────────────────────────────────────────────────────────────────
   像 Adobe 的語言包:主系統(kol.html、index.html…)照舊寫中文,
   這支只在「日文 / 英文」客人身上把畫面上的字換掉。
     · 中文客人:判斷完立刻結束,什麼都不載、什麼都不改。
     · 日文 / 英文客人:載入 /i18n/{ja|en}/{頁面}.json,把畫面上的中文換掉,
       之後跳出來的提示、彈窗、新卡片也會跟著換(MutationObserver)。
   語言怎麼決定(順序):
     1. 網址 ?lang=ja / ?lang=en / ?lang=zh(會記住)
     2. 之前選過的(localStorage bos_lang)
     3. 自動判別:瀏覽器語言或時區是台灣/香港/中國 → 中文;
                 日文或日本時區 → 日文;其他 → 英文
   不翻的地方:輸入框/文字框裡客人自己打的內容、script/style、
              加了 data-i18n-skip 的區塊。
   退回:網址加 ?lang=zh 就回中文。
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var VER = '1.1';
  var SUP = ['zh', 'ja', 'en'];

  function detect() {
    try {
      var q = new URLSearchParams(location.search).get('lang');
      if (q && SUP.indexOf(q) >= 0) { try { localStorage.setItem('bos_lang', q); } catch (_) {} return q; }
    } catch (_) {}
    try {
      var s = localStorage.getItem('bos_lang');
      if (s && SUP.indexOf(s) >= 0) return s;
    } catch (_) {}
    var langs = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language || ''];
    langs = Array.prototype.map.call(langs, function (x) { return String(x || '').toLowerCase(); });
    var tz = '';
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (_) {}
    if (langs.some(function (l) { return l.indexOf('zh') === 0; })) return 'zh';
    if (/^Asia\/(Taipei|Hong_Kong|Macau|Shanghai|Chongqing|Urumqi)$/.test(tz)) return 'zh';
    if (langs[0].indexOf('ja') === 0 || tz === 'Asia/Tokyo') return 'ja';
    return 'en';
  }

  var LANG = detect();
  window.BOS_LANG = LANG;
  if (LANG === 'zh') return;   // ★ 中文客人到此結束,主系統完全照舊

  // 頁面 → 語言包檔名
  var path = location.pathname.replace(/\/+$/, '') || '/index';
  var page = (path.split('/').pop() || 'index').replace(/\.html$/, '') || 'index';
  var BASE = '/i18n/' + LANG + '/';

  // 載入前先遮住,避免中文閃一下(最多 2.5 秒,載不到就照常顯示)
  var hide = document.createElement('style');
  hide.id = 'bos-i18n-hide';
  hide.textContent = 'body{visibility:hidden!important}';
  (document.head || document.documentElement).appendChild(hide);
  function reveal() { var h = document.getElementById('bos-i18n-hide'); if (h) h.remove(); }
  var revealTimer = setTimeout(reveal, 2500);

  var CJK = /[㐀-鿿]/;
  var DICT = {};      // 原始字典(整段完全相同時用)
  var TD = {};        // 去頭尾空白後的字典(句子裡局部比對用)
  var TRIE = {};
  var done = new WeakMap();   // node → 我們設過的字(避免日文漢字又被拿去比對)
  var UNIT_RE = /(\d\s*)([點秒張段支個位字分次件集])/g;
  var SPACE_LANG = LANG === 'en';

  function build(d) {
    DICT = d || {};
    TD = {}; TRIE = {};
    Object.keys(DICT).forEach(function (k) {
      var v = DICT[k], kt = k.trim();
      if (!v || kt.length < 2 || !CJK.test(kt)) return;   // 單字只做整段完全相同(數字單位另外處理)
      if (TD[kt]) return;
      TD[kt] = v.trim();
      var node = TRIE;
      for (var i = 0; i < kt.length; i++) { var c = kt[i]; node = node[c] || (node[c] = {}); }
      node.$ = kt;
    });
  }

  //  句子裡局部比對:用「蓋住最多中文字」的切法(動態規劃),
  //  避免先碰到短的片段(例如「秒。」)把後面整句長的翻譯搶走
  function segment(s) {
    var n = s.length, best = new Array(n + 1), pick = new Array(n + 1);
    best[n] = 0;
    for (var i = n - 1; i >= 0; i--) {
      best[i] = best[i + 1]; pick[i] = null;
      var node = TRIE, j = i;
      while (j < n && (node = node[s[j]])) {
        j++;
        if (node.$ && j - i + best[j] > best[i]) { best[i] = j - i + best[j]; pick[i] = node.$; }
      }
    }
    var out = '', k = 0, prevWord = false;
    segment.covered = best[0];
    while (k < n) {
      var key = pick[k];
      if (key) {
        var v = TD[key];
        if (SPACE_LANG && out && /[A-Za-z0-9)]$/.test(out) && /^[A-Za-z0-9(]/.test(v)) out += ' ';
        out += v; k += key.length; prevWord = true;
      } else {
        var ch = s[k];
        if (SPACE_LANG && prevWord && /[A-Za-z0-9]/.test(ch) && /[A-Za-z]$/.test(out)) out += ' ';
        out += ch; k++; prevWord = false;
      }
    }
    return out;
  }

  function tr(text) {
    if (!text || !CJK.test(text)) return text;
    var t = text.trim();
    if (DICT[t]) return text.replace(t, function () { return DICT[t]; });
    var lead = text.match(/^\s*/)[0], tail = text.match(/\s*$/)[0];
    var seg = segment(t);
    //  ★ 蓋不到大部分中文就整句不動(避免客人自己的品牌名、人名、檔名被翻一半,變成「Hong Kong福临门」)
    //  引號裡、冒號後面那一小段多半是客人自己的名字(已選定:晴天、切換到「芮比」),不算進要蓋住的字數
    var core = t.replace(/「[^」]*」|“[^”]*”|"[^"]*"|[:：]\s*[^\s:：,，。]{1,12}$/g, '');
    var han = (core.match(/[\u3400-\u9fff]/g) || []).length;
    var cov = segment.covered || 0;
    if (!han || (han <= 6 ? cov < han : cov / han < 0.6)) { if (window.BOS_I18N_MISS) window.BOS_I18N_MISS.add(t); return text; }
    var out = lead + seg + tail;
    // 數字後面的單字單位(500 點、15 秒、3 張…):單字只在緊跟數字時換,避免「重點」被拆開
    return out.replace(UNIT_RE, function (all, num, u) { var v = DICT[u]; if (!v) return all; return (/\s$/.test(num) && /^\s/.test(v)) ? num + v.replace(/^\s+/, '') : num + v; });
  }

  var SKIP_TAG = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, NOSCRIPT: 1, CODE: 1 };
  function skipEl(el) {
    for (var e = el; e && e.nodeType === 1; e = e.parentElement) {
      if (SKIP_TAG[e.tagName]) return true;
      if (e.isContentEditable || e.hasAttribute('data-i18n-skip')) return true;
    }
    return false;
  }

  function doText(n) {
    var v = n.nodeValue;
    if (!v || done.get(n) === v || !CJK.test(v)) return;
    if (n.parentElement && skipEl(n.parentElement)) return;
    var out = tr(v);
    done.set(n, out);
    if (out !== v) n.nodeValue = out;
  }

  var ATTRS = ['placeholder', 'title', 'aria-label', 'alt', 'data-tip'];
  function doAttrs(el) {
    if (el.nodeType !== 1 || skipEl(el)) return;
    for (var i = 0; i < ATTRS.length; i++) {
      var a = el.getAttribute(ATTRS[i]);
      if (a && CJK.test(a)) { var o = tr(a); if (o !== a) el.setAttribute(ATTRS[i], o); }
    }
    if (el.tagName === 'INPUT' && /^(button|submit|reset)$/i.test(el.type) && CJK.test(el.value)) el.value = tr(el.value);
    if (el.tagName === 'OPTION' && CJK.test(el.label || '')) { /* 文字節點會處理 */ }
  }

  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) { doText(root); return; }
    if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
    if (root.nodeType === 1) { if (skipEl(root)) return; doAttrs(root); }
    var tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, null);
    var n;
    while ((n = tw.nextNode())) {
      if (n.nodeType === 3) doText(n);
      else doAttrs(n);
    }
  }

  // 原生跳窗也換(alert / confirm / prompt)
  ['alert', 'confirm', 'prompt'].forEach(function (k) {
    var orig = window[k];
    if (typeof orig !== 'function') return;
    window[k] = function (msg) {
      var args = Array.prototype.slice.call(arguments);
      if (typeof msg === 'string') args[0] = tr(msg);
      return orig.apply(window, args);
    };
  });

  function start() {
    walk(document.body);
    if (document.title) document.title = tr(document.title);
    document.documentElement.lang = LANG === 'ja' ? 'ja' : 'en';
    new MutationObserver(function (list) {
      for (var i = 0; i < list.length; i++) {
        var m = list[i];
        if (m.type === 'characterData') doText(m.target);
        else if (m.type === 'attributes') doAttrs(m.target);
        else for (var j = 0; j < m.addedNodes.length; j++) walk(m.addedNodes[j]);
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    switcher();
    clearTimeout(revealTimer);
    reveal();
  }

  // 右下角語言按鈕(只有日文/英文客人看得到)
  function switcher() {
    if (document.getElementById('bos-lang-sw')) return;
    var box = document.createElement('div');
    box.id = 'bos-lang-sw';
    box.setAttribute('data-i18n-skip', '');
    box.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:99998;display:flex;gap:4px;background:rgba(20,20,24,.85);border:1px solid rgba(255,255,255,.15);border-radius:999px;padding:4px;font:600 12px/1 system-ui,sans-serif';
    [['ja', '日本語'], ['en', 'EN'], ['zh', '中文']].forEach(function (p) {
      var b = document.createElement('button');
      b.textContent = p[1];
      b.style.cssText = 'border:0;border-radius:999px;padding:6px 10px;cursor:pointer;color:#fff;background:' + (p[0] === LANG ? '#e2456b' : 'transparent');
      b.onclick = function () { try { localStorage.setItem('bos_lang', p[0]); } catch (_) {} location.reload(); };
      box.appendChild(b);
    });
    document.body.appendChild(box);
  }

  window.BOS_I18N = { VER: VER, lang: LANG, page: page, tr: tr, set: function (l) { try { localStorage.setItem('bos_lang', l); } catch (_) {} location.reload(); } };

  fetch(BASE + page + '.json?v=' + VER, { cache: 'no-cache' })
    .then(function (r) { return r.ok ? r.json() : {}; })
    .catch(function () { return {}; })
    .then(function (d) {
      build(d);
      if (document.body) start();
      else document.addEventListener('DOMContentLoaded', start);
    });
})();
