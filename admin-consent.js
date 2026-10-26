/* ═══════════════════════════════════════════════════════════════
   📜 admin-consent.js v1.0(2026-10-26)後台「授權書」分頁
   ・「使用自己建立 KOL」每簽一份肖像及聲音授權書,這裡就看得到:
     哪個品牌、哪位角色、肖像本人是誰、誰簽的、幾點、IP、素材來源;點「開啟」看完整授權書(可列印/存 PDF)
   ・資料來源:kol-proxy v6.44 kol_consent_list(只限 RA 本人;審核員看不到這個分頁,Worker 也會擋)
   ・一個檔案一個職責:admin.html 已 4,000+ 行,這支自己掛分頁(按鈕 + 內容區),admin.html 只多一行 <script>
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const KOL = 'https://kol-proxy.calm-sunset-6b66.workers.dev';
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const LB = 'font-size:11px;color:var(--t3);display:block;margin-bottom:5px;font-weight:600;letter-spacing:0.5px;';
  function tw(ts) { try { return new Date(new Date(ts).getTime() + 8 * 3600e3).toISOString().slice(0, 16).replace('T', ' '); } catch (e) { return ts || ''; } }
  function isOwner() { try { return typeof ADMIN_USER_ROLE !== 'undefined' && ADMIN_USER_ROLE === 'owner'; } catch (e) { return false; } }

  let _rows = [], _total = 0, _q = '';

  // ── 掛分頁:按鈕放在最後,內容區放在其他 section 旁邊 ──
  function mount() {
    const tabs = document.querySelector('.tabs');
    const anySec = document.querySelector('.section');
    if (!tabs || !anySec || $('tab-consent')) return !!$('tab-consent');
    const t = document.createElement('div');
    t.className = 'tab'; t.id = 'tab-consent'; t.textContent = '📜 授權書';
    t.setAttribute('data-owner-only', '');
    t.style.display = isOwner() ? '' : 'none';
    t.onclick = show;
    tabs.appendChild(t);
    const sec = document.createElement('div');
    sec.className = 'section'; sec.id = 'sec-consent';
    sec.innerHTML = '<div id="consentRoot"></div>';
    anySec.parentNode.appendChild(sec);
    //  別的分頁被點時,把這頁收起來(admin.html 的 switchTab 只認它自己清單裡的分頁)
    tabs.addEventListener('click', function (e) {
      const tb = e.target.closest('.tab');
      if (tb && tb !== t) { t.classList.remove('active'); sec.classList.remove('active'); }
    });
    return true;
  }
  function show() {
    if (!isOwner()) return;
    document.querySelectorAll('.tab').forEach(x => x.classList.toggle('active', x.id === 'tab-consent'));
    document.querySelectorAll('.section').forEach(s => s.classList.toggle('active', s.id === 'sec-consent'));
    load();
  }

  function shell() {
    $('consentRoot').innerHTML = `
      <div class="section-header" style="flex-wrap:wrap;gap:10px;"><h2>📜 授權書</h2>
        <button class="btn-refresh" onclick="AdminConsent.load()">重新整理</button></div>
      <div style="font-size:12px;color:var(--t3);margin-bottom:14px;line-height:1.8;">
        客人用「使用自己建立」建 KOL 時簽的肖像及聲音授權書。每份都留著全文、手寫簽名、簽署時間、帳號、IP,
        以及照片與聲音的數位指紋。點「開啟」看完整授權書,可以直接列印或存成 PDF。只有你看得到這一頁。
      </div>
      <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end;margin-bottom:16px;">
        <div><label style="${LB}">搜尋(品牌 / 角色 / 本人姓名 / Email)</label>
          <input id="csQ" class="field-input" value="${esc(_q)}" placeholder="例:RADESIGN" style="min-width:240px;"></div>
        <div id="csCount" style="font-size:12px;color:var(--t3);padding-bottom:8px;"></div>
      </div>
      <div class="table-wrap" id="csBody"><div class="empty-state"><p>載入中...</p></div></div>`;
    $('csQ').addEventListener('input', function () { _q = this.value.trim(); render(); });
  }

  async function load() {
    if (!$('consentRoot')) return;
    shell();
    try {
      const r = await fetch(KOL, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: (typeof PASSWORD !== 'undefined' ? PASSWORD : ''), action: 'kol_consent_list', limit: 200 }) }).then(x => x.json());
      if (!r || !r.ok) throw new Error((r && r.error) || '讀取失敗');
      _rows = r.rows || []; _total = r.total || _rows.length;
      render();
    } catch (e) {
      $('csBody').innerHTML = '<div class="empty-state"><p>讀取失敗:' + esc(e.message) + '</p></div>';
    }
  }

  function render() {
    const q = _q.toLowerCase();
    const rows = !q ? _rows : _rows.filter(x => [x.brand_name, x.brand_id, x.persona_name, x.person_name, x.signed_by_email]
      .some(v => String(v || '').toLowerCase().indexOf(q) !== -1));
    $('csCount').textContent = '共 ' + _total + ' 份' + (q ? ',符合 ' + rows.length + ' 份' : '') + (_total > _rows.length ? '(顯示最新 ' + _rows.length + ' 份)' : '');
    if (!rows.length) { $('csBody').innerHTML = '<div class="empty-state"><p>' + (q ? '沒有符合的授權書' : '還沒有人簽過授權書') + '</p></div>'; return; }
    $('csBody').innerHTML = '<table><thead><tr><th>簽署時間</th><th>品牌</th><th>KOL 角色</th><th>肖像本人</th><th>簽署帳號</th><th>IP</th><th>素材</th><th></th></tr></thead><tbody>' +
      rows.map(x => '<tr>' +
        '<td style="white-space:nowrap">' + esc(tw(x.signed_at)) + '</td>' +
        '<td>' + esc(x.brand_name && x.brand_name !== x.brand_id ? x.brand_name : x.brand_id) + '</td>' +
        '<td>' + esc(x.persona_name) + '</td>' +
        '<td>' + esc(x.person_name) + '<div style="font-size:11px;color:var(--t3)">' + (x.agent ? '由他人代為上傳' : '本人簽署') + '</div></td>' +
        '<td>' + esc(x.signed_by_email) + '</td>' +
        '<td style="white-space:nowrap">' + esc(x.ip) + (x.country ? ' (' + esc(x.country) + ')' : '') + '</td>' +
        '<td style="white-space:nowrap">' + (x.source === 'video' ? '本人錄影' : '照片 + 錄音') + '</td>' +
        '<td><a class="btn-refresh" href="' + esc(x.url) + '" target="_blank" rel="noopener" style="text-decoration:none;white-space:nowrap">開啟</a></td>' +
        '</tr>').join('') + '</tbody></table>';
  }

  //  登入完成前 .tabs 可能還沒好、角色也還沒確定 → 盯著補掛、補顯示
  let _t = 0;
  function tick() {
    mount();
    const t = $('tab-consent'); const want = isOwner() ? '' : 'none';
    if (t && t.style.display !== want) t.style.display = want;
  }
  new MutationObserver(function () { clearTimeout(_t); _t = setTimeout(tick, 200); }).observe(document.documentElement, { childList: true, subtree: true });
  let _n = 0; const _iv = setInterval(function () { tick(); if (++_n > 120 || isOwner()) clearInterval(_iv); }, 1000);   // 登入身分確定前每秒看一次(最多 2 分鐘)
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tick); else tick();

  window.AdminConsent = { load: load, show: show, version: '1.0' };
})();
