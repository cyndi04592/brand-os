/* ═══════════════════════════════════════════════════════════════
   bs-identity-guard.js v1.0(2026-11-14)換人登入 → 清掉上一個人的瀏覽器暫存
   病:各頁為了秒開,把品牌、KOL、素材、監控數據存在瀏覽器裡。同一台電腦換帳號登入,
       有些頁的暫存沒有認人 → 看到上一個人的品牌。
   根治:每一頁最先跑這支(放在 <head> 第一個 script,同步載入,不能加 async / defer):
     ① 從登入身分證讀出「現在是誰」(以這台電腦最後一次登入的為準)
     ② 跟上次記的「是誰在用」比
     ③ 不一樣 → 除了保留名單,這個網站存在瀏覽器的東西全部清掉,再讓頁面繼續載入
   用「保留名單」不是「清除名單」:以後哪一頁新增暫存,不用改這支也會被清到。
   同一個人一直用 → 什麼都不動,速度跟以前一樣。
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var OWNER_KEY = 'bs_owner';
  //  換人時保留:登入本身(屬於剛登入的人)、跟誰登入無關的裝置偏好
  var KEEP = ['bs_owner', 'bs_auth_token', 'bs_sso_email', 'bs_sso_token',
    'bos_lang', 'bs_theme_force', 'kolSubStyle.v1', 'kolAnimMode'];
  var KEEP_PREFIX = ['_claude_', '__'];

  function ls() { try { return window.localStorage; } catch (e) { return null; } }
  function ss() { try { return window.sessionStorage; } catch (e) { return null; } }
  function emailOfToken(t) {
    //  身分證格式 v1.<內容>.<簽章>,內容是 base64url 的 {"e":email,...};這裡只讀不驗(驗章在 Worker)
    try {
      var p = String(t || '').split('.')[1]; if (!p) return '';
      p = p.replace(/-/g, '+').replace(/_/g, '/'); while (p.length % 4) p += '=';
      var o = JSON.parse(decodeURIComponent(escape(atob(p))));
      return String(o.e || '').toLowerCase();
    } catch (e) { return ''; }
  }
  //  現在是誰:以這台電腦最後一次登入的為準(登入時兩邊都會寫)。
  //  分頁裡留著另一個人的舊身分 → 那份是舊的,先丟掉,免得各頁拿錯人。
  function whoNow(L, S) {
    var le = L ? emailOfToken(L.getItem('bs_auth_token')) : '';
    var se = S ? emailOfToken(S.getItem('bs_auth_token')) : '';
    if (le && se && le !== se) { try { S.removeItem('bs_auth_token'); } catch (e) {} se = ''; }
    var e = le || se;
    if (!e && L) e = String(L.getItem('bs_sso_email') || '').toLowerCase();
    return e;
  }
  function keep(k) {
    if (KEEP.indexOf(k) !== -1) return true;
    for (var i = 0; i < KEEP_PREFIX.length; i++) if (k.indexOf(KEEP_PREFIX[i]) === 0) return true;
    return false;
  }
  function wipe(L, me, all) {
    var n = 0, keys = [];
    for (var i = 0; i < L.length; i++) keys.push(L.key(i));
    keys.forEach(function (k) {
      if (k == null || keep(k)) return;
      //  all=false(第一次跑、不知道上一個是誰):只清名字裡帶著「別人 email」的
      if (!all) { var m = k.match(/[^\s_:@]+@[^\s_:]+\.[a-z]{2,}/i); if (!m || m[0].toLowerCase() === me) return; }
      try { L.removeItem(k); n++; } catch (e) {}
    });
    return n;
  }

  var L = ls(), S = ss(), result = { me: '', prev: '', cleared: 0 };
  try {
    if (L) {
      var me = whoNow(L, S), prev = String(L.getItem(OWNER_KEY) || '').toLowerCase();
      result.me = me ? 'yes' : ''; result.prev = prev ? 'yes' : '';
      if (me) {
        if (prev && prev !== me) result.cleared = wipe(L, me, true);   // 換人了 → 全清(保留名單除外)
        else if (!prev && wipe(L, me, false) > 0) result.cleared = wipe(L, me, true);   // 第一次跑:有別人 email 的暫存 = 這台有別人用過 → 全清
        L.setItem(OWNER_KEY, me);
      }
    }
  } catch (e) {}
  window.BSGuard = { version: '1.0', last: result };
})();
