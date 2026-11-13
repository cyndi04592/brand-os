/* ═══════════════════════════════════════════════════════════════
   admin-adbind.js v1.3(2026-11-13)v1.3 綁定可以不選品牌(只做廣告監控),名稱自動用廣告帳號名稱;v1.2 廣告帳號清單每次都抓最新(剛分給系統帳號的馬上看得到);v1.1 登入通行證過期自動換新的再試;v1.0後台「廣告監控綁定」分頁
   ・哪個品牌對到哪個 Meta 廣告帳號、主要看什麼目標(購物 / 訊息 / 名單),在這裡設,不用再改程式
   ・資料來源:ads-monitor v2.0 bind_list / bind_set / bind_off + accounts(系統帳號看得到的廣告帳號)
   ・只有 RA 本人(owner)看得到這個分頁;Worker 也會擋
   ・流程:員工從芮比 BM 申請存取 → 廠商同意 → 芮比 BM 把廣告帳號分給系統帳號 RB Brand OS Publisher
          → 這頁「還沒綁的廣告帳號」就會出現 → 選品牌、選目標、按綁定
   ・一個檔案一個職責:admin.html 已 4,000+ 行,這支自己掛分頁,由 admin-consent.js 順便載入
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const API = 'https://ads-monitor.calm-sunset-6b66.workers.dev';
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function isOwner() { try { return typeof ADMIN_USER_ROLE !== 'undefined' && ADMIN_USER_ROLE === 'owner'; } catch (e) { return false; } }
  function token() {
    try { if (window._bsAuthToken) return window._bsAuthToken(); } catch (e) {}
    try { return sessionStorage.getItem('bs_auth_token') || localStorage.getItem('bs_auth_token') || ''; } catch (e) { return ''; }
  }
  function osBrands() { try { return (typeof DB !== 'undefined' && DB.brands) ? DB.brands : []; } catch (e) { return []; } }
  async function call(action, extra) {
    const send = async (tk) => {
      const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.assign({ action: action, token: tk }, extra || {})) });
      return { r: r, j: await r.json().catch(() => ({ ok: false, error: '回應格式不對' })) };
    };
    let { r, j } = await send(token());
    //  v1.1 分頁裡的通行證過期、這台電腦存的是新的 → 換新的再問一次
    if (j && j.code === 'NEED_LOGIN') {
      let ls = ''; try { ls = localStorage.getItem('bs_auth_token') || ''; } catch (e) {}
      if (ls && ls !== token()) ({ r, j } = await send(ls));
    }
    if (!j.ok && !j.accounts) throw new Error(j.error || ('HTTP ' + r.status));
    return j;
  }

  let S = { brands: [], off: [], goals: { purchase: '購物', message: '訊息', lead: '名單' }, accounts: [], canEdit: false };

  // ── 掛分頁 ──
  function mount() {
    const tabs = document.querySelector('.tabs');
    const anySec = document.querySelector('.section');
    if (!tabs || !anySec || $('tab-adbind')) return !!$('tab-adbind');
    const t = document.createElement('div');
    t.className = 'tab'; t.id = 'tab-adbind'; t.textContent = '廣告監控綁定';
    t.style.display = isOwner() ? '' : 'none';
    t.onclick = show;
    tabs.appendChild(t);
    const sec = document.createElement('div');
    sec.className = 'section'; sec.id = 'sec-adbind';
    sec.innerHTML = '<div id="adbindRoot"></div>';
    anySec.parentNode.appendChild(sec);
    tabs.addEventListener('click', function (e) {
      const tb = e.target.closest('.tab');
      if (tb && tb !== t) { t.classList.remove('active'); sec.classList.remove('active'); }
    });
    return true;
  }
  function show() {
    if (!isOwner()) return;
    document.querySelectorAll('.tab').forEach(x => x.classList.toggle('active', x.id === 'tab-adbind'));
    document.querySelectorAll('.section').forEach(s => s.classList.toggle('active', s.id === 'sec-adbind'));
    load(false);
  }

  function goalSel(id, cur, dis) {
    return '<select class="field-input" id="' + id + '" style="padding:6px 8px;min-width:90px"' + (dis ? ' disabled' : '') + '>'
      + Object.keys(S.goals).map(k => '<option value="' + k + '"' + (k === cur ? ' selected' : '') + '>' + esc(S.goals[k]) + '</option>').join('') + '</select>';
  }
  function brandSel(id) {
    const used = new Set(S.brands.map(b => b.id));
    const opts = osBrands().filter(b => b && b.id && !used.has(String(b.id).toLowerCase()))
      .map(b => '<option value="' + esc(String(b.id).toLowerCase()) + '" data-name="' + esc(b.name || b.id) + '">' + esc(b.name || b.id) + '(' + esc(b.id) + ')</option>').join('');
    return '<select class="field-input" id="' + id + '" style="padding:6px 8px;min-width:170px"><option value="">不用選(只做廣告監控)</option>' + opts + '<option value="__new">其他:自己取名稱和代號</option></select>';
  }

  function shell(msg) {
    $('adbindRoot').innerHTML = `
      <div class="section-header" style="flex-wrap:wrap;gap:10px;"><h2>廣告監控綁定</h2>
        <button class="btn-refresh" onclick="AdminAdBind.load(true)">重新整理</button></div>
      <div style="font-size:12px;color:var(--t3);margin-bottom:14px;line-height:1.8;">
        新客戶的流程:員工從芮比 BM 申請廠商的粉專 / 廣告帳號存取,廠商同意後,在芮比 BM 把廣告帳號分給系統帳號 RB Brand OS Publisher
        (勾「管理行銷活動、查看成效」)。分好之後,下面「還沒綁的廣告帳號」就會出現,選品牌、選主要目標、按綁定,廣告監控頁就看得到。<br>
        主要目標:<b>購物</b> 看訂單和營收;<b>訊息</b> 看私訊對話數(賣課程、預約類);<b>名單</b> 看留資料的人數。
      </div>
      <div id="abMsg" style="font-size:12px;margin-bottom:10px;color:var(--t2)">${esc(msg || '')}</div>
      <h3 style="font-size:14px;margin:6px 0 8px">已綁定</h3>
      <div class="table-wrap" id="abBound"><div class="empty-state"><p>載入中...</p></div></div>
      <h3 style="font-size:14px;margin:22px 0 8px">還沒綁的廣告帳號(系統帳號看得到的)</h3>
      <div class="table-wrap" id="abFree"><div class="empty-state"><p>載入中...</p></div></div>
      <div id="abOffWrap"></div>`;
  }

  async function load(fresh) {
    if (!$('adbindRoot')) return;
    shell(fresh ? '重新讀取中,廣告帳號清單要問 Meta,大約 5 秒...' : '');
    try {
      const [b, a] = await Promise.all([call('bind_list'), call('accounts', { fresh: true }).catch(e => ({ accounts: [], _err: e.message }))]);
      S.brands = b.brands || []; S.off = b.off || []; S.goals = b.goals || S.goals; S.canEdit = !!b.canEdit;
      S.accounts = (a.data && a.data.accounts) || a.accounts || [];
      $('abMsg').textContent = a._err ? '廣告帳號清單讀取失敗:' + a._err : '';
      render();
    } catch (e) {
      $('abBound').innerHTML = '<div class="empty-state"><p>讀取失敗:' + esc(e.message) + '</p></div>';
      $('abFree').innerHTML = '';
    }
  }

  function render() {
    const ed = S.canEdit;
    const acName = {}; S.accounts.forEach(x => { acName[x.id] = x.name; });
    $('abBound').innerHTML = !S.brands.length ? '<div class="empty-state"><p>還沒有綁定任何品牌</p></div>'
      : '<table><thead><tr><th>品牌</th><th>代號</th><th>廣告帳號</th><th>主要目標</th><th></th></tr></thead><tbody>'
      + S.brands.map((b, i) => '<tr>'
        + '<td>' + esc(b.name) + '</td><td style="font-family:var(--font-mono);font-size:12px">' + esc(b.id) + '</td>'
        + '<td>' + esc(acName[b.account] || '') + '<div style="font-size:11px;color:var(--t3);font-family:var(--font-mono)">' + esc(b.account) + '</div></td>'
        + '<td>' + goalSel('abG' + i, b.goal, !ed) + '</td>'
        + '<td style="white-space:nowrap">' + (ed ? '<button class="btn-refresh" onclick="AdminAdBind.saveGoal(' + i + ')">存目標</button> '
          + '<button class="btn-refresh" onclick="AdminAdBind.off(' + i + ')">停用</button>' : '') + '</td>'
        + '</tr>').join('') + '</tbody></table>';

    const bound = new Set(S.brands.map(b => b.account));
    const free = S.accounts.filter(x => !bound.has(x.id));
    $('abFree').innerHTML = !free.length ? '<div class="empty-state"><p>系統帳號看得到的廣告帳號都綁好了。新客戶的帳號要先在芮比 BM 分給系統帳號,才會出現在這裡。</p></div>'
      : '<table><thead><tr><th>廣告帳號</th><th>所屬企業管理平台</th><th>綁到品牌</th><th>主要目標</th><th></th></tr></thead><tbody>'
      + free.map((x, i) => '<tr>'
        + '<td>' + esc(x.name) + '<div style="font-size:11px;color:var(--t3);font-family:var(--font-mono)">' + esc(x.id) + (x.status && x.status !== 1 ? ' · 帳號停用中' : '') + '</div></td>'
        + '<td>' + esc(x.business || '') + '</td>'
        + '<td>' + (ed ? brandSel('abB' + i) : '') + '</td>'
        + '<td>' + (ed ? goalSel('abF' + i, 'purchase', false) : '') + '</td>'
        + '<td>' + (ed ? '<button class="btn-refresh" onclick="AdminAdBind.bind(' + i + ',\'' + esc(x.id) + '\')">綁定</button>' : '') + '</td>'
        + '</tr>').join('') + '</tbody></table>';

    $('abOffWrap').innerHTML = !S.off.length ? '' : '<h3 style="font-size:14px;margin:22px 0 8px">已停用</h3><div class="table-wrap"><table><tbody>'
      + S.off.map((b, i) => '<tr><td>' + esc(b.name) + '</td><td style="font-family:var(--font-mono);font-size:12px">' + esc(b.account) + '</td><td>'
        + (ed ? '<button class="btn-refresh" onclick="AdminAdBind.on(' + i + ')">重新啟用</button>' : '') + '</td></tr>').join('') + '</tbody></table></div>';
  }

  function say(t, bad) { const m = $('abMsg'); if (m) { m.textContent = t; m.style.color = bad ? '#e5487d' : 'var(--t2)'; } }
  async function run(label, fn) {
    say(label + '中...');
    try { await fn(); say(label + '完成,廣告監控頁重新整理就看得到(最多約 30 秒生效)'); await load(false); say(label + '完成,廣告監控頁重新整理就看得到(最多約 30 秒生效)'); }
    catch (e) { say(label + '失敗:' + e.message, true); }
  }

  async function bind(i, account) {
    const sel = $('abB' + i); if (!sel) return;
    let brand = sel.value, name = brand ? (sel.options[sel.selectedIndex].getAttribute('data-name') || brand) : '';
    //  v1.3 不選品牌 = 只做廣告監控:名稱用廣告帳號名稱(去掉 Shopline- / 廣告帳號 這類字),代號自動取 ad + 帳號末 6 碼
    if (!brand) {
      const acc = S.accounts.filter(x => x.id === account)[0] || {};
      name = String(acc.name || account).replace(/^Shopline[-\s]*/i, '').replace(/[-\s]*廣告帳號\s*$/, '').trim() || account;
      brand = 'ad' + String(account).slice(-6);
    }
    if (brand === '__new') {
      name = (prompt('品牌名稱(監控頁上顯示的名字)') || '').trim(); if (!name) return;
      brand = (prompt('品牌代號(英文小寫或數字,例:ww;客戶帳號白名單要填同一個代號)') || '').trim().toLowerCase(); if (!brand) return;
    }
    const goal = ($('abF' + i) || {}).value || 'purchase';
    await run('綁定', () => call('bind_set', { brand: brand, name: name, account: account, goal: goal }));
  }
  async function saveGoal(i) {
    const b = S.brands[i]; if (!b) return;
    await run('儲存目標', () => call('bind_set', { brand: b.id, name: b.name, account: b.account, goal: $('abG' + i).value }));
  }
  async function off(i) {
    const b = S.brands[i]; if (!b) return;
    if (!confirm('停用「' + b.name + '」的廣告監控?之後在「已停用」可以重新啟用,資料不會刪掉。')) return;
    await run('停用', () => call('bind_off', { brand: b.id }));
  }
  async function on(i) {
    const b = S.off[i]; if (!b) return;
    await run('重新啟用', () => call('bind_set', { brand: b.id, name: b.name, account: b.account, goal: b.goal }));
  }

  //  登入完成前 .tabs 可能還沒好、角色也還沒確定 → 盯著補掛、補顯示
  let _t = 0;
  function tick() {
    mount();
    const t = $('tab-adbind'); const want = isOwner() ? '' : 'none';
    if (t && t.style.display !== want) t.style.display = want;
  }
  new MutationObserver(function () { clearTimeout(_t); _t = setTimeout(tick, 200); }).observe(document.documentElement, { childList: true, subtree: true });
  let _n = 0; const _iv = setInterval(function () { tick(); if (++_n > 120 || isOwner()) clearInterval(_iv); }, 1000);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tick); else tick();

  window.AdminAdBind = { load: load, show: show, bind: bind, saveGoal: saveGoal, off: off, on: on, version: '1.3' };
})();
