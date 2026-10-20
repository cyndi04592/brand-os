// ═══════════════════════════════════════════════════════════════
//  🧯 errlog.js · 錯誤紀錄表(前端收集器)· 2026-10-21
//  ─────────────────────────────────────────────────────────────
//  客人畫面上出錯時,自動送一筆到 kol-proxy(client_error → D1 client_errors):
//    誰(登入身分由 Worker 用通行證認,不信前端)、哪一頁、剛剛按了什麼、
//    做什麼動作(action)、看到什麼錯誤。後台「🧯 錯誤紀錄」查看。
//
//  收哪些:
//    ① 兩支 Worker 回 ok:false(或 HTTP 5xx、連不上)
//    ② 跳出來的錯誤提示(alert 內容含「失敗/錯誤/無法/不足/過期/忙碌…」)
//    ③ 網頁本身的程式錯誤(JS error / 未處理的 Promise 錯誤)
//
//  鐵則:
//    ★ 只「看」不「改」:不改任何請求或回應,不擋任何流程,自己出錯一律吞掉。
//    ★ 不送密碼、通行證、提示詞全文;只送動作名稱與錯誤字串。
//    ★ 同一個錯誤 60 秒內只送一次;一頁最多送 30 筆(Worker 另有每人每小時 60 筆上限)。
//    ★ 只載一次(重複載入自動略過)。
// ═══════════════════════════════════════════════════════════════
(function () {
  if (window.__bsErrlog) return;
  window.__bsErrlog = true;

  var WORKER = 'https://kol-proxy.calm-sunset-6b66.workers.dev';
  var PASS = 'raby2026';                      // 公開密碼(本來就隨網頁下發),身分看通行證
  var OURS = /(kol-proxy|photoroom-proxy)\.calm-sunset-6b66\.workers\.dev/;
  var SKIP_ACT = /^(client_error|ping|gate_acquire|gate_release|gate_status|gate_wait)$/;
  var ERR_TXT = /失敗|錯誤|無法|不足|過期|忙碌|滿載|請重新|請先登入|連線|逾時|error|fail/i;

  var baseFetch = window.fetch ? window.fetch.bind(window) : null;
  var sent = 0, recent = {};
  var lastClick = '', lastClickAt = 0;

  function cut(v, n) { try { return String(v == null ? '' : v).slice(0, n); } catch (e) { return ''; } }
  function token() {
    try { return sessionStorage.getItem('bs_auth_token') || localStorage.getItem('bs_auth_token') || ''; } catch (e) { return ''; }
  }

  // ── 記住「剛剛按了什麼」(只記 2 分鐘內的那一下)──
  document.addEventListener('click', function (ev) {
    try {
      var el = ev.target && ev.target.closest
        ? ev.target.closest('button,a,[role="button"],.btn,label,input[type="checkbox"],input[type="radio"],select')
        : null;
      if (!el) return;
      var t = (el.getAttribute('aria-label') || el.innerText || el.value || el.title || el.id || '').replace(/\s+/g, ' ').trim();
      if (t) { lastClick = cut(t, 60); lastClickAt = Date.now(); }
    } catch (e) {}
  }, true);

  function send(kind, msg, act, detail) {
    try {
      if (!baseFetch) return;
      msg = cut(msg, 500);
      if (!msg) return;
      var key = kind + '|' + act + '|' + msg;
      var now = Date.now();
      if (recent[key] && now - recent[key] < 60000) return;
      recent[key] = now;
      if (++sent > 30) return;
      var body = {
        action: 'client_error', password: PASS, token: token(),
        page: cut(location.pathname, 120),
        click: (now - lastClickAt < 120000) ? lastClick : '',
        act: cut(act, 60), kind: kind, msg: msg, detail: cut(detail, 1500),
        ua: cut(navigator.userAgent, 200),
      };
      baseFetch(WORKER, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body), keepalive: true,
      }).catch(function () {});
    } catch (e) {}
  }
  window.bsLogError = function (msg, act, detail) { send('manual', msg, act || '', detail || ''); };

  // ── ① 兩支 Worker 的錯誤回應 ──
  if (baseFetch) {
    window.fetch = function (input, init) {
      var p = baseFetch(input, init);
      try {
        var url = (typeof input === 'string') ? input : ((input && input.url) || '');
        if (!OURS.test(url)) return p;
        var act = '';
        try {
          var o = (init && typeof init.body === 'string') ? JSON.parse(init.body) : null;
          if (o) act = String(o.gasAction || o.action || '');
        } catch (e) {}
        if (SKIP_ACT.test(act)) return p;
        var host = /photoroom/.test(url) ? 'photoroom' : 'kol';
        return p.then(function (resp) {
          try {
            var ct = (resp.headers && resp.headers.get('content-type')) || '';
            if (ct.indexOf('json') !== -1) {
              resp.clone().json().then(function (j) {
                if (j && j.ok === false) {
                  var m = j.message || j.error || j.code || '(沒有錯誤訊息)';
                  send('api', typeof m === 'string' ? m : JSON.stringify(m), act,
                    host + ' · HTTP ' + resp.status + (j.code ? ' · code=' + j.code : '') + (j.error && j.message ? ' · ' + cut(j.error, 200) : ''));
                }
              }).catch(function () {});
            } else if (resp.status >= 500) {
              send('api', 'HTTP ' + resp.status, act, host);
            }
          } catch (e) {}
          return resp;
        }, function (err) {
          send('network', (err && err.message) || '連線失敗', act, host);
          throw err;
        });
      } catch (e) { return p; }
    };
  }

  // ── ② 跳出來的錯誤提示 ──
  try {
    var baseAlert = window.alert;
    window.alert = function (m) {
      try { var s = String(m == null ? '' : m); if (ERR_TXT.test(s)) send('alert', s, '', ''); } catch (e) {}
      return baseAlert.apply(window, arguments);
    };
  } catch (e) {}

  // ── ③ 網頁程式錯誤 ──
  window.addEventListener('error', function (ev) {
    try {
      if (!ev || !ev.message) return;                                  // 圖片載入失敗之類,不算
      if (/^Script error\.?$/.test(ev.message)) return;                // 跨網域看不到內容
      if (/ResizeObserver loop/.test(ev.message)) return;              // 瀏覽器正常雜訊
      var f = String(ev.filename || '');
      if (/^(chrome|moz|safari)-extension:/.test(f)) return;           // 客人裝的擴充功能
      send('js', ev.message, '', f.split('/').pop() + ':' + (ev.lineno || 0) + ':' + (ev.colno || 0));
    } catch (e) {}
  });
  window.addEventListener('unhandledrejection', function (ev) {
    try {
      var r = ev && ev.reason;
      var m = (r && (r.message || r.toString && r.toString())) || '未處理的錯誤';
      if (/AbortError|The user aborted/i.test(m)) return;              // 客人自己取消的
      send('promise', m, '', r && r.stack ? cut(r.stack, 600) : '');
    } catch (e) {}
  });
})();
