/* ═══════════════════════════════════════════════════════════════════
 *  ad-typeguard.js · v1.2(2026-11-13)廣告圖「類型選錯」防呆
 *  v1.2:判斷照片有沒有人最多等 12 秒(Worker 卡住時,客人按生成會永遠停在「先看一下商品照…」)
 *  v1.1:RA 11/04 抓到 —— 推薦改「保留原模特兒」會讓每張都是原照片的姿勢和角度(MOZ 員工 30 天都長一樣);
 *        好看又多變的(低角度藍天、伸手入鏡、聖誕紅牆)都是「服飾穿搭 · 重拍」。改成主推重拍,保留原模特兒已從選單收起(admaker.js 同日),視窗只留「改重拍」和「照原本」。
 * ───────────────────────────────────────────────────────────────────
 *  RA 11/03:MOZ 員工把模特兒照選成「商品實拍 · 重拍」→ 提示詞寫「商品放在胡桃木層架上」
 *           → AI 把整個人當商品,放上木台還配花瓶。客人也一定會選錯。
 *  ★ 做法:按「生成」時,如果選的是「商品實拍」(重拍 / 保留角度),先請 AI 看一眼商品照:
 *          照片裡有人穿著衣服 → 跳一個小視窗問要不要改成「服飾穿搭 · 保留原模特兒」。
 *          沒有人 → 照原本直接生成,客人不會感覺多了一步。
 *  ★ 不扣點(Worker v7.75 photo_person_check,同一張照片判斷過就記 30 天)。判斷失敗 → 照原本生成,不擋客人。
 *  ★ 不動 admaker.js:這支只是在「生成」外面包一層。載入:loader.js 只在首頁(做廣告圖那頁)載入。
 * ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.__adTypeGuard) return;
  window.__adTypeGuard = 'v1.2';
  var KOL = 'https://kol-proxy.calm-sunset-6b66.workers.dev';
  var seen = {};     // 照片網址 → true/false(這次開頁判斷過的)
  var kept = {};     // 照片網址 → 客人選了「照原本」就不再問

  function tok() { try { return sessionStorage.getItem('bs_auth_token') || localStorage.getItem('bs_auth_token') || ''; } catch (e) { return ''; } }
  function mail() { try { return localStorage.getItem('bs_sso_email') || sessionStorage.getItem('bs_email') || ''; } catch (e) { return ''; } }
  function say(msg, color) { try { if (typeof setPrStatus === 'function') setPrStatus(msg, color || 'var(--t3)'); } catch (e) {} }
  function curType() { try { return SELECTED_PRODTYPE || ''; } catch (e) { return ''; } }

  function photoUrl() {
    try {
      var S = window.S; var p = (S && S.selPhoto !== null && S.photos) ? S.photos[S.selPhoto] : null;
      if (!p) return '';
      var c = [p.full, p.hiRes, p.src, p.thumb, p.canvasRes];
      for (var i = 0; i < c.length; i++) if (/^https?:\/\//.test(String(c[i] || ''))) return String(c[i]);
    } catch (e) {}
    return '';
  }

  async function hasPerson(url) {
    if (url in seen) return seen[url];
    var pw = ''; try { pw = (typeof GAS_PASSWORD !== 'undefined') ? GAS_PASSWORD : ''; } catch (e) {}
    //  v1.2 最多等 12 秒:11/13 實測 Worker 判斷卡住沒回 → 客人按生成後整個停在「先看一下商品照…」永遠不動
    //   逾時 = 當作判斷失敗,照原本生成(不擋客人),也不記住結果,下次再判斷
    var ctl = new AbortController(), tm = setTimeout(function () { ctl.abort(); }, 12000);
    var r;
    try {
      r = await fetch(KOL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctl.signal,
        body: JSON.stringify({ action: 'photo_person_check', url: url, password: pw, token: tok(), email: mail() }) }).then(function (x) { return x.json(); });
    } finally { clearTimeout(tm); }
    seen[url] = !!(r && r.ok && r.person);
    return seen[url];
  }

  function ask(onSwitch, onKeep) {
    var old = document.getElementById('adTypeGuardModal'); if (old) old.remove();
    var mask = document.createElement('div');
    mask.id = 'adTypeGuardModal';
    mask.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:16px;';
    mask.innerHTML = '<div style="width:100%;max-width:400px;background:#16161d;border:1px solid #2e2e3a;border-radius:14px;padding:18px;color:#e8e8f0;font-family:\'Noto Sans TC\',sans-serif;">'
      + '<div style="font-size:16px;font-weight:900;margin-bottom:6px;">這張照片裡有模特兒</div>'
      + '<div style="font-size:12.5px;color:#a9a9b8;line-height:1.7;margin-bottom:14px;">「商品實拍」會把照片裡的東西當成商品擺在桌上或層架上,有人的照片會變成人站在台子上。<br>建議改用<b style="color:#e8e8f0">服飾穿搭 · 重拍</b>:衣服照原樣,模特兒換姿勢、角度和場景,每張都不一樣。</div>'
      + '<div style="display:flex;flex-direction:column;gap:8px;">'
      + '<button data-g="re" style="padding:11px;border-radius:9px;border:none;background:linear-gradient(135deg,#7c6dfa,#fa6d9b);color:#fff;font-weight:900;cursor:pointer;">改用服飾穿搭 · 重拍(推薦)</button>'
      + '<button data-g="keep" style="padding:10px;border-radius:9px;border:1px solid #3a3a4a;background:transparent;color:#bbb;cursor:pointer;">照原本的商品實拍(我就是要拍成商品)</button>'
      + '</div></div>';
    mask.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-g]');
      if (!b && e.target === mask) { mask.remove(); return; }
      if (!b) return;
      mask.remove();
      var g = b.getAttribute('data-g');
      if (g === 're') onSwitch('apparel'); else if (g === 'sw') onSwitch('apparel_keep'); else onKeep();
    });
    document.body.appendChild(mask);
  }

  function switchToApparel(to) {
    to = to || 'apparel';
    try { if (typeof _renderProdTypeOptions === 'function') _renderProdTypeOptions(); } catch (e) {}
    var sel = document.getElementById('prodTypeSel');
    if (sel) sel.value = to;
    try { if (typeof onSelProdType === 'function') onSelProdType(to); } catch (e) {}
    say('✅ 已改成「' + (to === 'apparel' ? '服飾穿搭 · 重拍' : '服飾穿搭 · 保留原模特兒') + '」—— 版型要重新選一次,選好再按生成', 'var(--mint)');
    try { if (sel) sel.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
  }

  function wrap() {
    var orig = window.generateGptPoster;
    if (typeof orig !== 'function') return false;
    if (orig.__typeGuard) return true;
    var guarded = async function () {
      var self = this, args = arguments;
      var t = curType();
      if (t === 'physical_reshoot' || t === 'physical') {
        var u = photoUrl();
        if (u && !kept[u]) {
          var person = false;
          try { say('⏳ 先看一下商品照…'); person = await hasPerson(u); } catch (e) { person = false; }   // 判斷失敗 → 不擋
          if (person) {
            say('');
            return ask(switchToApparel, function () { kept[u] = true; orig.apply(self, args); });
          }
        }
      }
      return orig.apply(self, args);
    };
    guarded.__typeGuard = true;
    window.generateGptPoster = guarded;
    return true;
  }

  var n = 0;
  (function tick() { if (wrap() || ++n > 60) return; setTimeout(tick, 1000); })();
})();
