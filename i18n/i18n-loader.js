/* ═══════════════════════════════════════════════════════════════════
   Brand OS 語言包載入器 i18n-loader.js  v1.0(2026-11-08)· v1.12(2026-11-14)手機語言鈕縮成圓鈕＋捲動自動躲開
   ───────────────────────────────────────────────────────────────────
   像 Adobe 的語言包:主系統(kol.html、index.html…)照舊寫中文,
   這支只在「日文 / 英文」客人身上把畫面上的字換掉。
     · 中文客人:只在左下角放一顆浮動的 🌐 語言按鈕(v1.9),其他什麼都不載、什麼都不改。
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
  var VER = '1.17';
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
    //  v1.16 瀏覽器【第一語言】最優先:日本人瀏覽器若另外加了中文當第二語言,以前會被判成中文
    var p0 = langs[0] || '';
    if (p0.indexOf('zh') === 0) return 'zh';
    if (p0.indexOf('ja') === 0) return 'ja';
    if (/^Asia\/(Taipei|Hong_Kong|Macau|Shanghai|Chongqing|Urumqi)$/.test(tz)) return 'zh';
    if (tz === 'Asia/Tokyo') return 'ja';
    if (langs.some(function (l) { return l.indexOf('zh') === 0; })) return 'zh';
    if (langs.some(function (l) { return l.indexOf('ja') === 0; })) return 'ja';
    return 'en';
  }

  var LANG = detect();
  window.BOS_LANG = LANG;

  //  ★ v1.17 日文/英文一律把語言寫進網址(?lang=ja / ?lang=en)
  //   RA 11-12 實測:在系統裡切成日文 → 點「品牌入駐書」→ 網址只有 /onboard,語言只記在這個瀏覽器裡。
  //   從 LINE 打開時入駐頁會請 LINE 換 Safari/Chrome 開(Google 不准在 LINE 裡登入),換了瀏覽器語言就不見了;
  //   直接給 ?lang=ja 的網址則一路都對。→ 語言跟著網址走:換瀏覽器、跳轉、複製網址給客人都不會掉。
  //   中文不加(網址保持乾淨);這行在入駐頁「LINE 偵測」之前執行,所以跳出去的網址也會帶著語言。
  if (LANG !== 'zh') {
    try {
      var _u = new URL(location.href);
      if (_u.searchParams.get('lang') !== LANG) { _u.searchParams.set('lang', LANG); history.replaceState(history.state, '', _u.toString()); }
    } catch (_) {}
  }

  // 左下角語言按鈕(v1.8:每個人都看得到,台灣人也能切日文/英文)
  //   平常只是一顆浮動的小按鈕「🌐 中文」,點了才展開三個語言;KOL 頁底部確認列跳出來時自動藏起來,不擋按鈕
  //   手機(≤768 寬)縮小一號、避開 iPhone 底部橫條(safe-area)
  //  ★ v1.11 切語言:網址上的 ?lang= 優先權最高,只改記憶再重整會被網址蓋回去(RA 實測「切換都沒反應」)
  //   → 記住 + 網址的 lang 一起換成新的再開
  function goLang(l) {
    try { localStorage.setItem('bos_lang', l); } catch (_) {}
    try {
      var u = new URL(location.href);
      u.searchParams.set('lang', l);
      location.replace(u.toString());
    } catch (_) { location.reload(); }
  }

  function switcher() {
    if (document.getElementById('bos-lang-sw') || !document.body) return;
    var NAMES = { zh: '中文', ja: '日本語', en: 'EN' };
    var box = document.createElement('div');
    box.id = 'bos-lang-sw';
    box.setAttribute('data-i18n-skip', '');
    box.style.cssText = 'position:fixed;left:calc(12px + env(safe-area-inset-left,0px));bottom:calc(12px + env(safe-area-inset-bottom,0px));z-index:99998;display:flex;gap:4px;align-items:center;background:rgba(20,20,24,.85);border:1px solid rgba(255,255,255,.15);border-radius:999px;padding:3px;font:600 12px/1 system-ui,sans-serif;max-width:calc(100vw - 24px);box-sizing:border-box';
    var st = document.createElement('style');
    st.textContent = 'body:has(.rs-actionbar.show) #bos-lang-sw{display:none!important}' +
      '#bos-lang-pad{display:none}@media(max-width:768px){#bos-lang-pad{display:block;height:calc(52px + env(safe-area-inset-bottom,0px))}}' +
      '@media(max-width:768px){#bos-lang-sw{left:calc(8px + env(safe-area-inset-left,0px))!important;bottom:calc(8px + env(safe-area-inset-bottom,0px))!important;font-size:11px!important;gap:2px!important;opacity:.9}#bos-lang-sw button{padding:5px 8px!important;font-size:11px!important}' +
        '#bos-lang-sw .bos-lang-name{display:none}#bos-lang-sw .bos-lang-main{width:34px;height:34px;padding:0!important;font-size:16px!important;display:flex;align-items:center;justify-content:center}' +
        '#bos-lang-sw{transition:transform .25s ease,opacity .25s ease}#bos-lang-sw.bos-lang-away{transform:translateY(140%);opacity:0;pointer-events:none}}';
    box.appendChild(st);
    function btn(txt, on, fn) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = txt;
      b.style.cssText = 'border:0;border-radius:999px;padding:6px 10px;cursor:pointer;color:#fff;background:' + (on ? '#e2456b' : 'transparent');
      b.onclick = fn;
      box.appendChild(b);
      return b;
    }
    var main = btn('🌐 ' + NAMES[LANG], false, function () {
      main.remove();
      ['zh', 'ja', 'en'].forEach(function (l) {
        btn(NAMES[l], l === LANG, function () {
          if (l === LANG) { box.remove(); switcher(); return; }   // 點到同一個語言 = 收起來
          goLang(l);
        });
      });
    });
    //  v1.12 手機:收起時只剩一顆 🌐 圓鈕(名字藏起來),捲動往下時先躲開、停下或往上捲再回來 —— 不再蓋住頁面內容
    main.textContent = '';
    main.className = 'bos-lang-main';
    main.appendChild(document.createTextNode('🌐'));
    var nm = document.createElement('span');
    nm.className = 'bos-lang-name';
    nm.textContent = ' ' + NAMES[LANG];
    main.appendChild(nm);
    main.title = 'Language / 言語 / 語言';
    document.body.appendChild(box);
    if (!window.__bosLangScroll) {
      window.__bosLangScroll = true;
      var lastY = window.scrollY || 0, idle = null;
      window.addEventListener('scroll', function () {
        var sw = document.getElementById('bos-lang-sw');
        if (!sw || window.innerWidth > 768) return;
        var y = window.scrollY || 0;
        if (y > lastY + 4 && y > 80) sw.classList.add('bos-lang-away');
        else if (y < lastY - 4) sw.classList.remove('bos-lang-away');
        lastY = y;
        clearTimeout(idle);
        idle = setTimeout(function () { var s = document.getElementById('bos-lang-sw'); if (s) s.classList.remove('bos-lang-away'); }, 1200);
      }, { passive: true });
    }
    //  手機:頁面最底下多留一條空白,捲到底時頁尾版權那行不會被按鈕蓋住(電腦版不顯示)
    if (document.getElementById('bos-lang-pad')) return;
    var pad = document.createElement('div');
    pad.id = 'bos-lang-pad';
    pad.setAttribute('aria-hidden', 'true');
    document.body.appendChild(pad);
  }

  if (LANG === 'zh') {   // ★ 中文客人:只放語言按鈕,其他什麼都不載、什麼都不改
    if (document.body) switcher(); else document.addEventListener('DOMContentLoaded', switcher);
    return;
  }

  // 頁面 → 語言包檔名
  var path = location.pathname.replace(/\/+$/, '') || '/index';
  var page = (path.split('/').pop() || 'index').replace(/\.html$/, '') || 'index';
  var BASE = '/i18n/' + LANG + '/';

  //  ⚡ v1.15 速度(RA:切成日文/英文比較慢、有延遲)
  //   以前每次開頁都要先下載語言包(KOL 頁 150KB)、整頁遮住等它回來,才開始換字 → 每頁多等半秒到一秒。
  //   現在:語言包存在這台電腦(localStorage),第二次開始直接拿來用,一邊載入頁面一邊換字,不遮畫面;
  //   背景照樣去拿最新版,有更新就存起來並重換一次。只有第一次開某頁才會短暫遮住。
  var CKEY = 'bos_i18n:' + LANG + ':' + page, CACHED = null, CRAW = '';
  try { CRAW = localStorage.getItem(CKEY) || ''; if (CRAW) CACHED = JSON.parse(CRAW); } catch (_) { CACHED = null; CRAW = ''; }

  // 第一次(沒有存檔)才遮住,避免中文閃一下(最多 2.5 秒,載不到就照常顯示)
  var hide = document.createElement('style');
  hide.id = 'bos-i18n-hide';
  hide.textContent = 'body{visibility:hidden!important}';
  if (!CACHED) (document.head || document.documentElement).appendChild(hide);
  function reveal() { var h = document.getElementById('bos-i18n-hide'); if (h) h.remove(); }
  var revealTimer = setTimeout(reveal, 2500);

  var CJK = /[㐀-鿿]/;
  var DICT = {};      // 原始字典(整段完全相同時用)
  var TD = {};        // 去頭尾空白後的字典(句子裡局部比對用)
  var TRIE = {};
  var done = new WeakMap();   // node → 我們設過的字(避免日文漢字又被拿去比對)
  var UNIT_RE = /(\d\s*)([點秒張段支個位字分次件集歲])/g;
  var SPACE_LANG = LANG === 'en';

  //  ★ v1.12 字典是從 HTML 原始碼抽出來的,裡面有「&amp;」「&gt;」這種寫法,畫面上的字卻是「&」「>」
  //   → 對不到整句,只好拆字硬翻(出現「芮比Ad行銷」),而且翻出來的字會直接秀「&amp;」。載入時一律還原成真正的符號
  var ENT = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': '\u00a0' };
  function unEnt(x) { return String(x).replace(/&(amp|lt|gt|quot|#39|nbsp);/g, function (m) { return ENT[m]; }); }
  function build(d) {
    DICT = {};
    Object.keys(d || {}).forEach(function (k) {
      var v = unEnt(d[k]);
      DICT[k] = v;
      var k2 = unEnt(k);
      if (k2 !== k && !(k2 in d)) DICT[k2] = v;
      var k3 = k2.replace(/\u00a0/g, ' ');
      if (k3 !== k2 && !(k3 in DICT)) DICT[k3] = v;
    });
    TD = {}; TRIE = {};
    Object.keys(DICT).forEach(function (k) {
      var v = DICT[k], kt = k.trim();
      if (!v || kt.length < 2 || !CJK.test(kt)) return;   // 單字只做整段完全相同(數字單位另外處理)
      if (TD[kt]) return;
      TD[kt] = v.trim();
      var node = TRIE;
      for (var i = 0; i < kt.length; i++) { var c = kt[i]; node = node[c] || (node[c] = {}); }
      node['$k'] = kt;   // ★ v1.6 結尾記號用兩個字的鍵:字典裡有含「$」的字串時,單字「$」會跟結尾記號撞在一起,畫面出現 undefined
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
        if (node['$k'] && j - i + best[j] > best[i]) { best[i] = j - i + best[j]; pick[i] = node['$k']; }
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

  //  ★ v1.13 英文介面:單獨一顆中文標點(例:標題最後被 <span> 隔開的「。」)換成英文標點
  var PUNC_EN = { '。': '.', '，': ',', '、': ',', '！': '!', '？': '?', '：': ':', '；': ';' };
  function tr(text) {
    if (SPACE_LANG && text) { var pt = text.trim(); if (PUNC_EN[pt]) return text.replace(pt, PUNC_EN[pt]); }
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
    t.replace(UNIT_RE, function (all, num, u) { if (DICT[u]) cov++; return all; });   // 數字後的單位(15 秒、33 歲)也算蓋到
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

  var ORIG = new WeakMap(), FORCE = false;   // v1.15:記住換字前的中文,語言包更新時從中文重換(不會拿日文漢字去比對)
  function doText(n) {
    var v = n.nodeValue;
    if (v && FORCE && done.get(n) === v && ORIG.has(n)) v = ORIG.get(n);
    else if (v && FORCE && done.get(n) === v) { /* 之前沒換到的中文:再試一次 */ }
    else if (!v || done.get(n) === v) return;
    if (!(CJK.test(v) || (SPACE_LANG && PUNC_EN[v.trim()]))) return;   // v1.14:單獨的中文標點也要進來換
    if (n.parentElement && skipEl(n.parentElement)) return;
    // 手動用 <br> 斷行的短字(例「使用自己<br>建立」):整段合起來查,查得到就整段換掉、拿掉 <br>
    var p = n.parentElement;
    if (p && p.childNodes.length > 1 && p.childNodes.length <= 7) {
      var ok = true, whole = '';
      for (var i = 0; i < p.childNodes.length; i++) {
        var c = p.childNodes[i];
        if (c.nodeType === 3) whole += c.nodeValue; else if (c.nodeName !== 'BR') { ok = false; break; }
      }
      var wk = whole.trim();
      if (ok && DICT[wk]) {
        var tn = document.createTextNode(DICT[wk]);
        done.set(tn, DICT[wk]);
        ORIG.set(tn, wk);
        p.textContent = '';
        p.appendChild(tn);
        return;
      }
    }
    var out = tr(v);
    done.set(n, out);
    if (out !== v) ORIG.set(n, v);
    if (out !== n.nodeValue) n.nodeValue = out;
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

  var started = false;
  function start() {
    if (started) { walk(document.body); return; }
    started = true;
    walk(document.body);
    if (document.title) document.title = tr(document.title);
    document.documentElement.lang = LANG === 'ja' ? 'ja' : 'en';
    // 保險絲:萬一跟頁面上別的程式互相改字(你改我、我改你),1 秒內處理太多次就先停 3 秒,不讓頁面卡死
    var burst = 0, burstT = Date.now(), paused = false;
    var mo = new MutationObserver(function (list) {
      if (paused) return;
      var now = Date.now();
      if (now - burstT > 1000) { burst = 0; burstT = now; }
      if (document.readyState !== 'loading') burst += list.length;   // 頁面還在載入時的大量新增是正常的,不算
      if (burst > 4000) {
        paused = true;
        console.warn('[i18n] 太多變動,暫停翻譯 3 秒');
        setTimeout(function () { paused = false; burst = 0; burstT = Date.now(); walk(document.body); }, 3000);
        return;
      }
      for (var i = 0; i < list.length; i++) {
        var m = list[i];
        if (m.type === 'characterData') doText(m.target);
        else if (m.type === 'attributes') doAttrs(m.target);
        else for (var j = 0; j < m.addedNodes.length; j++) walk(m.addedNodes[j]);
      }
    });
    mo.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    function finish() {
      if (document.title) document.title = tr(document.title);
      switcher();
      legalNote();
      clearTimeout(revealTimer);
      reveal();
    }
    if (document.body && document.readyState !== 'loading') finish();
    else document.addEventListener('DOMContentLoaded', function () { walk(document.body); finish(); });
  }

  // 條款、隱私權這類法律文件:翻譯只供參考,以中文版為準(頁首加一行說明)
  function legalNote() {
    if (!/^(terms|privacy|data-deletion|meta-privacy|meta-terms)$/.test(page)) return;
    if (document.getElementById('bos-legal-note')) return;
    var n = document.createElement('div');
    n.id = 'bos-legal-note';
    n.setAttribute('data-i18n-skip', '');
    n.style.cssText = 'margin:0;padding:10px 16px;background:#2a2230;color:#f3e9c8;font:500 13px/1.5 system-ui,sans-serif;text-align:center';
    n.textContent = LANG === 'ja'
      ? 'この日本語訳は参考用です。内容に相違がある場合は、繁体字中国語版が優先されます。'
      : 'This English translation is provided for reference only. If there is any discrepancy, the Traditional Chinese version prevails.';
    document.body.insertBefore(n, document.body.firstChild);
  }

  window.BOS_I18N = { VER: VER, lang: LANG, page: page, tr: tr, set: goLang };

  if (CACHED) { build(CACHED); start(); }   // 有存檔:馬上開始,頁面邊載入邊換字

  fetch(BASE + page + '.json?v=' + VER, { cache: 'no-cache' })
    .then(function (r) { return r.ok ? r.text() : ''; })
    .catch(function () { return ''; })
    .then(function (raw) {
      var d = null;
      try { d = raw ? JSON.parse(raw) : null; } catch (_) { d = null; }
      if (!d) { if (!CACHED) { build({}); start(); } return; }
      if (raw === CRAW) return;                       // 跟存檔一樣 → 不用動
      try { localStorage.setItem(CKEY, raw); } catch (_) {}
      build(d);
      if (CACHED && started) { FORCE = true; walk(document.body); FORCE = false; return; }   // 語言包有更新 → 整頁從中文重換一次
      start();
    });
})();
