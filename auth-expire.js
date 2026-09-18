/* ═══════════════════════════════════════════════════════════════
   🔑 auth-expire.js v1.4(2026-09-18)登入過期 → 全站統一處理
   v1.4:沒有憑證的人【不跳過期視窗】,直接送去登入畫面(治 Allan 手機「點了還是跳來跳去」:
        手機瀏覽器清掉憑證 = 還沒登入,不是過期;舊版照跳 → 按重新登入 → 清空 → 回首頁
        → 還是沒登入 → 又 401 → 又跳,無限循環)。另外剛按過重新登入的 10 秒內也不跳。
   RA:「先修好,不然要到下一個出現才會改。」
   病:身分證(session token)過期時,每個功能各自跳自己的訊息 ——
      AI 編修跳「AI 編修失敗:請重新登入」、素材庫顯示空白、抓色系跳別的話。
      客人只會覺得「這個功能壞了」,不會知道要重新登入。
      (Safari 會自動清掉久沒開的網站資料,手機特別容易發生)
   修:任何打我們 Worker 的請求,只要回 401 或 NEED_LOGIN,一律走這裡:
      ① 同一次只跳一個視窗(不管同時有幾個請求失敗)
      ② 話講清楚:不是功能壞掉,是登入過期
      ③ 按鈕直接清掉失效的憑證並回登入畫面,客人不用自己找登出鍵
   ⚠️ 只認我們自己的 Worker 網域,別人的 401 不會誤觸發。
   ═══════════════════════════════════════════════════════════════ */
(function () {
  if (window.BSAuthExpire) return;
  var shown = false;

  function isOurs(url) {
    var u = String(url || '');
    return u.indexOf('kol-proxy.calm-sunset-6b66.workers.dev') !== -1
        || u.indexOf('photoroom-proxy.calm-sunset-6b66.workers.dev') !== -1;
  }
  function looksExpired(status, body) {
    if (status === 401) return true;
    if (!body || typeof body !== 'object') return false;
    if (body.code === 'NEED_LOGIN') return true;
    return /請重新登入|NEED_LOGIN|登入已過期|身分驗證/.test(String(body.error || '') + String(body.message || ''));
  }
  //  🩹 v1.3(2026-09-18)RA 實測:按了重新登入還是一直跳。
  //   原因:只清 token 不夠 —— 頁面看到 localStorage 還記著 email(bs_sso_email / 記住登入),
  //   就當作「已登入」直接開始打 Worker,但手上沒有有效的證 → 又 401 → 又跳視窗,無限循環。
  //   改成跟正式登出清一樣的東西(含記住登入與品牌快取),再回登入頁重走 Google 登入。
  function clearAndReload() {
    try { sessionStorage.setItem('bs_relogin_at', String(Date.now())); } catch (e) {}   // 🔑 v1.4 標記:剛按過重新登入
    try {
      ['bs_auth_token', 'bs_token', 'bs_email', 'bs_worker_mode'].forEach(function (k) { sessionStorage.removeItem(k); });
      ['bs_auth_token', 'bs_sso_token', 'bs_sso_email', 'bs_email', 'bs_worker_mode'].forEach(function (k) { localStorage.removeItem(k); });
      var dead = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && (k.indexOf('bs_brandos_') === 0 || k.indexOf('bs_assets_') === 0)) dead.push(k);
      }
      dead.forEach(function (k) { try { localStorage.removeItem(k); } catch (e) {} });
    } catch (e) {}
    try { window._driveToken = null; window._workerDriveMode = false; } catch (e) {}
    //  Google 那邊也放掉,不然瀏覽器會直接用舊的授權靜默登入、又拿不到新的證
    try { if (window.google && google.accounts && google.accounts.oauth2) google.accounts.oauth2.revoke('', function () {}); } catch (e) {}
    //  回主站登入頁(KOL 工作室自己沒有登入畫面)
    try { location.href = 'index.html'; } catch (e) { location.reload(); }
  }
  //  🔑 v1.4(2026-09-18)Allan 手機實測:點了「重新登入」還是跳來跳去。
  //   病灶:【手上根本沒有憑證的人也會被跳視窗】—— 手機瀏覽器(尤其 Safari)
  //   會自己清掉存的登入資料,那個狀態等於「還沒登入」,不是「登入過期」。
  //   舊版照樣跳視窗 → 按重新登入 → 清空 → 回首頁 → 還是沒登入 → 打 API → 又 401
  //   → 又跳 …… 無限循環,客戶只會覺得系統壞掉。
  //  ★ 修法一:沒有任何憑證 → 不跳視窗,直接把人送到登入畫面(該登入就登入,不要嚇他)。
  //  ★ 修法二:剛按過「重新登入」的那 10 秒內不跳(清空到回首頁之間會有零星 401)。
  function _hasCred() {
    try {
      var keys = ['bs_auth_token', 'bs_token', 'bs_sso_token'];
      for (var i = 0; i < keys.length; i++) {
        if (sessionStorage.getItem(keys[i]) || localStorage.getItem(keys[i])) return true;
      }
    } catch (e) { return true; }   // 讀不到就當作有,寧可跳視窗也不要靜默失敗
    return false;
  }
  function _justReloggedIn() {
    try { return (Date.now() - Number(sessionStorage.getItem('bs_relogin_at') || 0)) < 10000; } catch (e) { return false; }
  }
  var boxEl = null;
  function show() {
    //  🔑 v1.4:沒憑證 = 還沒登入(不是過期)→ 不跳視窗,直接帶去登入頁
    if (!_hasCred()) {
      try { console.log('[AuthExpire] 沒有登入憑證 → 不跳過期視窗,直接前往登入'); } catch (e) {}
      try {
        if (location.pathname.indexOf('index') < 0 && location.pathname !== '/') location.href = 'index.html';
      } catch (e) {}
      return;
    }
    if (_justReloggedIn()) return;   // 剛按過重新登入,清空過程中的零星 401 不要再跳
    //  🩹 v1.2(2026-09-18)RA 實測「一直閃」:主站有些畫面會整塊重畫,
    //   把視窗連同 body 內容一起洗掉 → 下一個 401 又貼一次 → 看起來一閃一閃。
    //   改成:記住這個節點,被洗掉就接回去;還在畫面上就什麼都不做。
    if (boxEl && boxEl.isConnected) return;
    if (boxEl && !boxEl.isConnected) { (document.body || document.documentElement).appendChild(boxEl); return; }
    if (shown && boxEl) return;
    shown = true;
    var box = document.createElement('div');
    box.setAttribute('style', 'position:fixed;inset:0;z-index:2147483000;background:rgba(6,6,12,0.82);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:24px;font-family:-apple-system,"PingFang TC","Noto Sans TC",sans-serif;');
    box.innerHTML = '<div style="max-width:380px;width:100%;background:linear-gradient(135deg,#14141c,#1b1b26);border:1px solid rgba(124,109,250,0.35);border-radius:18px;padding:26px 24px;color:#F0F0F5;box-shadow:0 24px 60px rgba(0,0,0,0.6);">'
      + '<div style="font-size:30px;margin-bottom:8px;">🔑</div>'
      + '<div style="font-size:17px;font-weight:800;margin-bottom:8px;">登入已過期</div>'
      + '<div style="font-size:13px;line-height:1.9;color:#A0A0B0;margin-bottom:18px;">不是功能壞掉,是這台裝置的登入時間到了(手機瀏覽器會自動清除)。<br>重新登入一次就能繼續,剛剛的操作再按一次即可。</div>'
      + '<button id="bsReloginBtn" style="width:100%;padding:12px;border:none;border-radius:11px;font-size:14px;font-weight:800;color:#fff;cursor:pointer;background:linear-gradient(135deg,#7C6DFA,#FA6D9B);">重新登入</button>'
      + '</div>';
    boxEl = box;
    (document.body || document.documentElement).appendChild(box);
    var btn = document.getElementById('bsReloginBtn');
    if (btn) btn.onclick = clearAndReload;
    //  被整塊重畫洗掉時自動貼回去(每 1.5 秒看一眼,按下重新登入就停)
    var keep = setInterval(function () {
      if (!boxEl) { clearInterval(keep); return; }
      if (!boxEl.isConnected) { try { (document.body || document.documentElement).appendChild(boxEl); } catch (e) {} }
    }, 1500);
    if (btn) btn.addEventListener('click', function () { clearInterval(keep); });
  }

  //  給各頁攔截器呼叫:回應是我們的 Worker 且看起來過期 → 跳統一視窗
  //  回傳 true 代表「已接手處理」,呼叫端可以安靜結束,不用再跳自己的 alert
  function check(url, status, body) {
    if (!isOurs(url) || !looksExpired(status, body)) return false;
    show();
    return true;
  }
  window.BSAuthExpire = { check: check, show: show, isOurs: isOurs, looksExpired: looksExpired };

  //  🛡 v1.1:自己也掛一層 fetch —— 不依賴各頁攔截器有沒有接上。
  //   RA 2026-09-18 實測:頁面載到了這支(typeof = object),但 401 還是只跳舊的 alert,
  //   因為有些請求是繞過頁面攔截器直送的(重試層、各模組自己包的 fetch)。
  //   這一層掛在最外面,不改請求內容、不擋流程,只「看回應」。
  try {
    var _of = window.fetch.bind(window);
    window.fetch = function (input, init) {
      var p = _of(input, init);
      try {
        var url = (typeof input === 'string') ? input : ((input && input.url) || '');
        if (isOurs(url)) {
          p.then(function (resp) {
            try {
              if (resp.status === 401) { check(url, 401, null); return; }
              resp.clone().json().then(function (j) { check(url, resp.status, j); }).catch(function () {});
            } catch (e) {}
          }).catch(function () {});
        }
      } catch (e) {}
      return p;
    };
  } catch (e) {}
})();
