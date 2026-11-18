// ═══════════════════════════════════════════════════════════════
//  📶 onboard-net-guard.js v1.0(2026-11-18)品牌入駐書「生成靈魂書」防斷線
//  起因:2026-11-18 客人在中國用台灣 eSIM 漫遊,按生成後等 40 秒,
//        後台其實寫完了(200 OK),但手機連線中途斷掉 → 畫面「Load failed」。
//
//  這支只做三件事,不改 onboard.html 的生成流程:
//   1. 生成時螢幕保持亮著(Wake Lock),避免等待中自動鎖螢幕把連線斷掉
//   2. 生成畫面加一行提示:約 40 秒,請不要離開此頁
//   3. 只針對「claude_generate」:網路斷線(Load failed / Failed to fetch)或 90 秒沒回應
//      → 等畫面回到前景後自動重試,最多 2 次。後台回的錯誤(點數不足等)不重試。
//  ⚠️ 重試可能多呼叫一次 AI(API 費用),不扣客人點數。
//  根治版(交件取件、背景生成)另案處理,見 Wishlist。
//  onboard.html 已 1,511 行,這支獨立成檔,onboard.html 只多一行 <script>。
// ═══════════════════════════════════════════════════════════════
(function () {
  'use strict';
  if (window.__onbNetGuard) return;
  window.__onbNetGuard = true;
  var VERSION = '1.0';
  var MAX_RETRY = 2, TIMEOUT_MS = 90000;

  function lang() {
    var l = window.BOS_LANG;
    if (!l) { try { l = localStorage.getItem('bos_lang'); } catch (e) {} }
    return (l === 'ja' || l === 'en') ? l : 'zh';
  }
  function T(zh, ja, en) { var l = lang(); return l === 'ja' ? ja : l === 'en' ? en : zh; }

  // ── 生成畫面上的提示 ─────────────────────────────────────────
  function note(text, warn) {
    var ov = document.getElementById('genOverlay'); if (!ov) return;
    var n = document.getElementById('genNetNote');
    if (!n) {
      n = document.createElement('div');
      n.id = 'genNetNote'; n.setAttribute('data-i18n-skip', '');
      n.style.cssText = 'max-width:86vw;text-align:center;font-size:13px;line-height:1.6;padding:0 16px;';
      ov.appendChild(n);
    }
    n.style.color = warn ? '#ff8a8a' : 'rgba(255,255,255,.62)';
    n.textContent = text;
  }
  function baseNote() {
    note(T('大約需要 40 秒,請停留在這個畫面,不要切換 App 或鎖螢幕。',
           '約 40 秒かかります。この画面のまま、アプリの切り替えや画面ロックをしないでください。',
           'This takes about 40 seconds. Please stay on this screen — don\'t switch apps or lock your phone.'), false);
  }

  // ── 1. 螢幕保持亮著 ──────────────────────────────────────────
  var lock = null;
  function overlayOn() { var o = document.getElementById('genOverlay'); return !!(o && o.classList.contains('show')); }
  function wake() {
    if (lock || !('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
    navigator.wakeLock.request('screen').then(function (l) {
      lock = l; l.addEventListener('release', function () { lock = null; });
    }).catch(function () {});
  }
  function unwake() { if (lock) { try { lock.release(); } catch (e) {} lock = null; } }
  function watchOverlay() {
    var o = document.getElementById('genOverlay');
    if (!o) return setTimeout(watchOverlay, 500);
    new MutationObserver(function () {
      if (overlayOn()) { baseNote(); wake(); } else unwake();
    }).observe(o, { attributes: true, attributeFilter: ['class'] });
  }
  document.addEventListener('visibilitychange', function () { if (overlayOn()) wake(); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watchOverlay); else watchOverlay();

  // ── 3. claude_generate 斷線自動重試 ───────────────────────────
  var raw = window.fetch;
  function isGen(url, opts) {
    try {
      return String(url).indexOf('photoroom-proxy') >= 0 && opts && typeof opts.body === 'string' &&
        /"action"\s*:\s*"claude_generate"/.test(opts.body);
    } catch (e) { return false; }
  }
  function isNetErr(e) { return e && (e.name === 'TypeError' || e.name === 'AbortError'); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function untilVisible() {
    return new Promise(function (r) {
      if (document.visibilityState === 'visible') return r();
      function h() { if (document.visibilityState === 'visible') { document.removeEventListener('visibilitychange', h); r(); } }
      document.addEventListener('visibilitychange', h);
    });
  }
  function once(url, opts) {
    var ctl = ('AbortController' in window) ? new AbortController() : null;
    var o = {}; for (var k in opts) o[k] = opts[k];
    if (ctl && !o.signal) o.signal = ctl.signal;
    var tm = ctl ? setTimeout(function () { ctl.abort(); }, TIMEOUT_MS) : 0;
    return raw.call(window, url, o).then(function (r) { clearTimeout(tm); return r; },
                                          function (e) { clearTimeout(tm); throw e; });
  }
  window.fetch = function (url, opts) {
    if (!isGen(url, opts)) return raw.apply(window, arguments);
    var n = 0;
    function attempt() {
      return once(url, opts).catch(function (e) {
        if (!isNetErr(e) || n >= MAX_RETRY) throw e;
        n++;
        console.warn('[onboard-net-guard] 連線中斷,自動重試 ' + n + '/' + MAX_RETRY, e && e.message);
        note(T('網路中斷了,正在自動重試(' + n + '/' + MAX_RETRY + ')… 請停留在這個畫面。',
               '通信が切れました。自動で再試行中(' + n + '/' + MAX_RETRY + ')… この画面のままお待ちください。',
               'Connection lost — retrying automatically (' + n + '/' + MAX_RETRY + ')… please stay on this screen.'), true);
        return untilVisible().then(function () { wake(); return sleep(1500); }).then(attempt);
      });
    }
    return attempt();
  };

  console.log('[onboard-net-guard] 📶 v' + VERSION + ' 靈魂書生成防斷線');
})();
