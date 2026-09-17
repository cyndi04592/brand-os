/* ═══════════════════════════════════════════════════════════════
   🔑 auth-expire.js v1.0(2026-09-18)登入過期 → 全站統一處理
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
  function clearAndReload() {
    try {
      ['bs_auth_token', 'bs_token', 'bs_email', 'bs_worker_mode'].forEach(function (k) { sessionStorage.removeItem(k); });
      ['bs_auth_token'].forEach(function (k) { localStorage.removeItem(k); });
    } catch (e) {}
    location.reload();
  }
  function show() {
    if (shown) return;                     // 同一次只跳一個
    shown = true;
    var box = document.createElement('div');
    box.setAttribute('style', 'position:fixed;inset:0;z-index:2147483000;background:rgba(6,6,12,0.82);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:24px;font-family:-apple-system,"PingFang TC","Noto Sans TC",sans-serif;');
    box.innerHTML = '<div style="max-width:380px;width:100%;background:linear-gradient(135deg,#14141c,#1b1b26);border:1px solid rgba(124,109,250,0.35);border-radius:18px;padding:26px 24px;color:#F0F0F5;box-shadow:0 24px 60px rgba(0,0,0,0.6);">'
      + '<div style="font-size:30px;margin-bottom:8px;">🔑</div>'
      + '<div style="font-size:17px;font-weight:800;margin-bottom:8px;">登入已過期</div>'
      + '<div style="font-size:13px;line-height:1.9;color:#A0A0B0;margin-bottom:18px;">不是功能壞掉,是這台裝置的登入時間到了(手機瀏覽器會自動清除)。<br>重新登入一次就能繼續,剛剛的操作再按一次即可。</div>'
      + '<button id="bsReloginBtn" style="width:100%;padding:12px;border:none;border-radius:11px;font-size:14px;font-weight:800;color:#fff;cursor:pointer;background:linear-gradient(135deg,#7C6DFA,#FA6D9B);">重新登入</button>'
      + '</div>';
    (document.body || document.documentElement).appendChild(box);
    var btn = document.getElementById('bsReloginBtn');
    if (btn) btn.onclick = clearAndReload;
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
