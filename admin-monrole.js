/* ═══════════════════════════════════════════════════════════════
   admin-monrole.js v1.0(2026-11-22)後台「開監控客戶帳號」
   ・監控客戶(白名單 role = monitor)= 代操客戶:只看得到自己被綁定品牌的廣告監控(只讀),
     Brand OS / KOL 可以登入逛,但不送點、不開配額;要生成得自己買方案或 Bits。後台進不去。
   ・這支只做三件事:
       ① 員工白名單分頁多一顆「＋ 開監控客戶帳號」:填 Email、勾品牌 → 加白名單(role=monitor)→ 寄設定密碼信(setpwd.html)
       ② 名單上監控客戶那張卡:牌子寫「監控客戶」、拿掉「⚡ 配額」(免得手滑送點)、多一顆「重寄設定信」
       ③ 品牌清單只列「廣告監控有綁的品牌」(ads-monitor bind_list);讀不到才退回全部品牌並寫明
   ・權限不靠這支:誰看得到哪個品牌 = ads-monitor Worker 每次現查白名單 brands;後台 = kol-proxy 只認管理員 / 審核員。
     這支只是幫 RA 少按幾下。只有 RA 本人(owner)看得到按鈕。
   ・用到的後端都是現成的:kol-proxy gas_write addWhitelist / updateWhitelist、auth_setpwd_send;ads-monitor bind_list
   ・admin.html 沒改:由 admin-consent.js 順便載入(同 admin-adbind.js)
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.AdminMonRole) return;
  const ADS = 'https://ads-monitor.calm-sunset-6b66.workers.dev';
  const ROLE = 'monitor';
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function isOwner() { try { return typeof ADMIN_USER_ROLE !== 'undefined' && ADMIN_USER_ROLE === 'owner'; } catch (e) { return false; } }
  function staff() { try { return (typeof STAFF !== 'undefined' && STAFF) ? STAFF : []; } catch (e) { return []; } }
  function osBrands() { try { return (typeof DB !== 'undefined' && DB.brands) ? DB.brands : []; } catch (e) { return []; } }
  function me() { try { return ADMIN_USER_EMAIL || ''; } catch (e) { return ''; } }
  function token() {
    try { if (window._bsAuthToken) return window._bsAuthToken(); } catch (e) {}
    try { return sessionStorage.getItem('bs_auth_token') || localStorage.getItem('bs_auth_token') || ''; } catch (e) { return ''; }
  }
  function roleOf(s) { return String((s && s.role) || '').toLowerCase(); }
  function find(email) { const e = String(email || '').toLowerCase(); return staff().find(x => String(x.email || '').toLowerCase() === e) || null; }

  //  廣告監控有綁的品牌(讀不到 → null,畫面退回全部品牌並寫明)
  async function boundBrands() {
    try {
      const r = await fetch(ADS, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'bind_list', token: token() }) });
      const j = await r.json();
      if (j && j.ok && Array.isArray(j.brands)) return j.brands.map(b => ({ id: String(b.id), name: String(b.name || b.id) }));
    } catch (e) {}
    return null;
  }
  async function sendSetPwd(email) {
    try {
      const r = await fetch(KOL_WORKER, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: PASSWORD, action: 'auth_setpwd_send', email: email }) });
      const j = await r.json();
      return (j && j.ok) ? { ok: true } : { ok: false, error: (j && j.error) || '寄送失敗' };
    } catch (e) { return { ok: false, error: '連線失敗' }; }
  }

  // ── ① 按鈕 ──
  function mountBtn() {
    const sec = $('sec-staff'); if (!sec) return false;
    if ($('monRoleBtn')) return true;
    const hd = sec.querySelector('.section-header'); if (!hd) return false;
    const b = document.createElement('button');
    b.id = 'monRoleBtn'; b.className = 'btn-refresh'; b.type = 'button';
    b.textContent = '＋ 開監控客戶帳號';
    b.title = '代操客戶專用:只看得到自己品牌的廣告監控,不送點';
    b.style.cssText = 'margin-right:8px;border-color:#6DFAC2;color:#6DFAC2;' + (isOwner() ? '' : 'display:none;');
    b.onclick = open;
    hd.insertBefore(b, hd.querySelector('.btn-refresh'));
    return true;
  }

  // ── ① 視窗 ──
  async function open() {
    if (!isOwner()) return;
    const old = $('monRoleMask'); if (old) old.remove();
    const mask = document.createElement('div');
    mask.id = 'monRoleMask';
    mask.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';
    mask.innerHTML =
      '<div style="background:var(--bg2,#16161d);border:1px solid var(--line,#2e2e3a);border-radius:14px;max-width:560px;width:100%;max-height:88vh;overflow:auto;padding:20px;">'
      + '<div style="font-size:16px;font-weight:700;color:#6DFAC2;margin-bottom:6px;">開監控客戶帳號</div>'
      + '<div style="font-size:12px;color:var(--t3);line-height:1.8;margin-bottom:14px;">給代操客戶用。他登入後:<br>'
      + '・廣告監控只看得到下面勾的品牌,只能看、不能動廣告<br>'
      + '・Brand OS、KOL 可以進來逛;不送點,要生成得自己買方案或 Bits<br>'
      + '・後台進不去</div>'
      + '<label style="font-size:11px;color:var(--t3);display:block;margin-bottom:5px;font-weight:600;">客戶 Email(之後用這個信箱登入)</label>'
      + '<input class="field-input" id="monRoleEmail" type="email" placeholder="client@example.com" style="width:100%;margin-bottom:12px;" data-no-dirty>'
      + '<label style="font-size:11px;color:var(--t3);display:block;margin-bottom:5px;font-weight:600;">稱呼(選填,只有後台看得到)</label>'
      + '<input class="field-input" id="monRoleName" placeholder="例:巧福 王小姐" style="width:100%;margin-bottom:12px;" data-no-dirty>'
      + '<label style="font-size:11px;color:var(--t3);display:block;margin-bottom:5px;font-weight:600;">他可以看哪個品牌的廣告監控(至少勾一個)</label>'
      + '<div id="monRoleBrands" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:6px;"><span style="font-size:12px;color:var(--t3)">讀取中…</span></div>'
      + '<div id="monRoleNote" style="font-size:11px;color:var(--t4);margin-bottom:12px;"></div>'
      + '<div id="monRoleMsg" style="font-size:13px;line-height:1.7;min-height:20px;margin-bottom:12px;"></div>'
      + '<div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;">'
      + '<button id="monRoleCancel" type="button" style="padding:10px 16px;border-radius:8px;border:1px solid var(--line);background:none;color:var(--t3);cursor:pointer;font-size:13px;">關閉</button>'
      + '<button id="monRoleGo" type="button" style="padding:10px 20px;border-radius:8px;border:none;background:linear-gradient(135deg,#7C6DFA,#6DFAC2);color:#0b0b12;font-weight:700;cursor:pointer;font-size:13px;">開帳號並寄設定密碼信</button>'
      + '</div></div>';
    document.body.appendChild(mask);
    const close = () => mask.remove();
    mask.onclick = (e) => { if (e.target === mask) close(); };
    $('monRoleCancel').onclick = close;
    $('monRoleGo').onclick = submit;

    const bound = await boundBrands();
    const box = $('monRoleBrands'); if (!box) return;
    const list = bound || osBrands().map(b => ({ id: String(b.id), name: String(b.name || b.id) }));
    box.innerHTML = list.length
      ? list.map(b => '<label class="brand-chk" style="cursor:pointer;"><input type="checkbox" value="' + esc(b.id) + '"> ' + esc(b.name) + '</label>').join('')
      : '<span style="font-size:12px;color:var(--t3)">目前沒有品牌可選</span>';
    $('monRoleNote').textContent = bound
      ? '只列出「廣告監控綁定」分頁裡有綁的品牌。'
      : '⚠ 讀不到廣告監控的綁定清單,先列出全部品牌;沒綁廣告帳號的品牌,客戶登入後會是空的。';
  }

  function say(html, color) { const m = $('monRoleMsg'); if (m) { m.style.color = color || 'var(--t2,#ddd)'; m.innerHTML = html; } }

  async function submit() {
    const email = ($('monRoleEmail').value || '').trim().toLowerCase();
    const name = ($('monRoleName').value || '').trim();
    const picked = [...document.querySelectorAll('#monRoleBrands input:checked')].map(c => c.value);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { say('請輸入正確的 Email', '#ff6b6b'); return; }
    if (!picked.length) { say('請至少勾一個品牌', '#ff6b6b'); return; }
    const had = find(email);
    if (had && roleOf(had) !== ROLE) {
      say('這個信箱已經在名單裡,身分是「' + esc(roleLabel(roleOf(had))) + '」,本來就能進廣告監控;不會把它改成監控客戶。要改他看得到的品牌請用名單上的「🏷 品牌」。', '#ffb454');
      return;
    }
    const go = $('monRoleGo'); go.disabled = true; go.style.opacity = '.6';
    try {
      let j;
      if (had) {   // 已經是監控客戶 → 只更新品牌,再寄一次信
        say('這個信箱已經是監控客戶,更新品牌中…');
        j = await workerWrite('updateWhitelist', { email: me(), targetEmail: email, brands: picked.join(',') });
      } else {
        say('開帳號中…');
        j = await workerWrite('addWhitelist', { email: me(), targetEmail: email, name: name, role: ROLE, brands: picked.join(',') });
      }
      if (!j || !j.ok) { say('沒開成功:' + esc((j && j.error) || '連線問題,再試一次'), '#ff6b6b'); return; }
      say('帳號好了,寄設定密碼信中…');
      const m = await sendSetPwd(email);
      if (m.ok) {
        say('✅ 完成。設定密碼的信已寄到 ' + esc(email) + '(連結 72 小時內有效,請他也看垃圾信匣)。<br>他設好密碼後,從 ai.raby.com.tw 登入,選單進「廣告監控」。', '#6DFAC2');
      } else {
        say('帳號已開好,但設定密碼信沒寄出(' + esc(m.error) + ')。等一分鐘後在名單上那張卡按「重寄設定信」。', '#ffb454');
      }
      try { if (typeof loadStaff === 'function') loadStaff(); } catch (e) {}
    } catch (e) {
      say('連線失敗,請再試一次', '#ff6b6b');
    } finally { go.disabled = false; go.style.opacity = ''; }
  }

  function roleLabel(r) { return r === 'owner' ? '管理員' : r === 'reviewer' ? '審核員' : r === ROLE ? '監控客戶' : '客戶/員工'; }

  // ── ② 名單上的卡片 ──
  function decorate() {
    const grid = $('staffGrid'); if (!grid) return;
    const list = staff();
    const cards = grid.querySelectorAll('.staff-card');
    if (cards.length !== list.length) return;      // 對不上就不動,寧可不標
    cards.forEach((card, i) => {
      const s = list[i];
      if (roleOf(s) !== ROLE || card.getAttribute('data-monrole')) return;
      card.setAttribute('data-monrole', '1');
      const badge = card.querySelector('.staff-badge');
      if (badge) { badge.textContent = '監控客戶'; badge.title = '只看得到綁定品牌的廣告監控;不送點'; badge.style.cssText += ';background:rgba(109,250,194,.12);color:#6DFAC2;border:1px solid rgba(109,250,194,.4);'; }
      card.querySelectorAll('button').forEach(b => {
        if (/setStaffQuota/.test(b.getAttribute('onclick') || '')) b.style.display = 'none';   // 監控客戶不開配額
      });
      const em = card.querySelectorAll('.staff-email');
      if (em[1]) em[1].innerHTML = em[1].innerHTML.replace('可看:', '廣告監控可看:');
      const del = card.querySelector('.btn-row-del');
      if (isOwner()) {
        const rb = document.createElement('button');
        rb.type = 'button'; rb.textContent = '✉ 重寄設定信'; rb.title = '重寄設定密碼的信給這位客戶';
        rb.style.cssText = 'background:none;border:1px solid var(--line);border-radius:6px;color:var(--t3);cursor:pointer;font-size:12px;padding:3px 8px;margin-left:8px;white-space:nowrap;';
        rb.onclick = async () => {
          rb.disabled = true; rb.textContent = '寄送中…';
          const m = await sendSetPwd(String(s.email));
          rb.textContent = m.ok ? '✅ 已寄出' : ('沒寄出:' + m.error);
          setTimeout(() => { rb.disabled = false; rb.textContent = '✉ 重寄設定信'; }, 6000);
        };
        card.insertBefore(rb, del || null);
      }
    });
  }
  function hook() {
    if (typeof window.renderStaff !== 'function' || window.renderStaff.__mon) return;
    const orig = window.renderStaff;
    const wrap = function () { const r = orig.apply(this, arguments); try { mountBtn(); decorate(); } catch (e) {} return r; };
    wrap.__mon = true;
    window.renderStaff = wrap;
  }

  let tries = 0;
  (function boot() {
    hook();
    const ok = mountBtn();
    try { decorate(); } catch (e) {}
    const b = $('monRoleBtn'); if (b) b.style.display = isOwner() ? '' : 'none';
    if ((!ok || !isOwner()) && tries++ < 60) setTimeout(boot, 1000);   // 登入驗完身分前按鈕先藏著
  })();

  window.AdminMonRole = { open: open, decorate: decorate, version: '1.0' };
})();
