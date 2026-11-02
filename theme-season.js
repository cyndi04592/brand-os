/* ═══════════════════════════════════════════════════════════════
   🎄 admin-season.js v1.0(2026-11-02)後台「節慶」分頁
   ・RA:「後續可以讓我在 ADMIN 設定?」→ 節慶換膚的開關、開始/結束日期在這裡改,不用再改程式
   ・存到 kol-proxy v7.61(season_save,只限 RA 本人);全站 theme-season.js v1.5 讀 /season.json
   ・生效時間:你這台電腦存好馬上生效;客人那邊最慢 10 分鐘(換頁後套用)
   ・一個檔案一個職責:admin.html 已 4,000+ 行,這支自己掛分頁(按鈕 + 內容區),admin.html 只多一行 <script>
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const KOL = 'https://kol-proxy.calm-sunset-6b66.workers.dev';
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function isOwner() { try { return typeof ADMIN_USER_ROLE !== 'undefined' && ADMIN_USER_ROLE === 'owner'; } catch (e) { return false; } }
  function tok() { try { return window._bsAuthToken ? window._bsAuthToken() : ''; } catch (e) { return ''; } }
  async function call(action, extra) {
    const r = await fetch(KOL, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ action: action, password: (typeof PASSWORD !== 'undefined' ? PASSWORD : ''), token: tok() }, extra || {})) });
    return r.json();
  }

  let _rows = [], _themes = [{ key: 'xmas', name: '🎄 聖誕節' }], _updated = '';

  function mount() {
    const tabs = document.querySelector('.tabs');
    const anySec = document.querySelector('.section');
    if (!tabs || !anySec || $('tab-season')) return !!$('tab-season');
    const t = document.createElement('div');
    t.className = 'tab'; t.id = 'tab-season'; t.textContent = '🎄 節慶';
    t.style.display = isOwner() ? '' : 'none';
    t.onclick = show;
    tabs.appendChild(t);
    const sec = document.createElement('div');
    sec.className = 'section'; sec.id = 'sec-season';
    sec.innerHTML = '<div id="seasonRoot"></div>';
    anySec.parentNode.appendChild(sec);
    tabs.addEventListener('click', function (e) {
      const tb = e.target.closest('.tab');
      if (tb && tb !== t) { t.classList.remove('active'); sec.classList.remove('active'); }
    });
    return true;
  }
  function show() {
    if (!isOwner()) return;
    document.querySelectorAll('.tab').forEach(x => x.classList.toggle('active', x.id === 'tab-season'));
    document.querySelectorAll('.section').forEach(s => s.classList.toggle('active', s.id === 'sec-season'));
    load();
  }

  function shell() {
    $('seasonRoot').innerHTML = `
      <div class="section-header" style="flex-wrap:wrap;gap:10px;"><h2>🎄 節慶換膚</h2>
        <button class="btn-refresh" onclick="AdminSeason.load()">重新整理</button></div>
      <div style="font-size:12px;color:var(--t3);margin-bottom:14px;line-height:1.9;">
        在日期範圍內,全站自動換成節慶配色(酒紅＋金色像素聖誕樹＋飄雪),時間到自動換回原樣,每年都會自己來。<br>
        日期寫「月-日」,頭尾都算(例 11-02 到 12-26)。跨年的檔期也可以(例 12-28 到 01-05)。<br>
        存好後:<b>你這台電腦馬上生效</b>;客人那邊最慢 <b>10 分鐘</b>、換頁後套用。
        想先看效果:<a href="/?theme=xmas" target="_blank" rel="noopener" style="color:#d9b25f">預覽聖誕版</a>
        (看完開 <a href="/?theme=auto" target="_blank" rel="noopener" style="color:#d9b25f">這個連結</a> 恢復自動)
      </div>
      <div class="table-wrap" id="ssBody"><div class="empty-state"><p>載入中...</p></div></div>
      <div style="display:flex;gap:10px;align-items:center;margin-top:14px;flex-wrap:wrap;">
        <button class="btn-refresh" onclick="AdminSeason.add()">＋ 加一個檔期</button>
        <button class="btn-refresh" style="background:#d9b25f;color:#1a1a1a;font-weight:700;border-color:#d9b25f" onclick="AdminSeason.save()">💾 儲存</button>
        <span id="ssMsg" style="font-size:12px;color:var(--t3)"></span>
      </div>`;
  }

  function render() {
    const opt = (k) => _themes.map(t => '<option value="' + esc(t.key) + '"' + (t.key === k ? ' selected' : '') + '>' + esc(t.name) + '</option>').join('');
    const inp = 'class="field-input" style="width:90px;padding:6px 8px"';
    $('ssBody').innerHTML = !_rows.length
      ? '<div class="empty-state"><p>目前沒有任何檔期(全站都是原本的樣子)。按「＋ 加一個檔期」新增。</p></div>'
      : '<table><thead><tr><th>開啟</th><th>主題</th><th>開始(月-日)</th><th>結束(月-日)</th><th>今天</th><th></th></tr></thead><tbody>' +
        _rows.map((x, i) => '<tr>' +
          '<td><input type="checkbox" data-i="' + i + '" data-f="on"' + (x.on ? ' checked' : '') + '></td>' +
          '<td><select data-i="' + i + '" data-f="key" class="field-input" style="padding:6px 8px">' + opt(x.key) + '</select></td>' +
          '<td><input ' + inp + ' data-i="' + i + '" data-f="from" value="' + esc(x.from) + '" placeholder="11-02"></td>' +
          '<td><input ' + inp + ' data-i="' + i + '" data-f="to" value="' + esc(x.to) + '" placeholder="12-26"></td>' +
          '<td style="white-space:nowrap">' + (x.on && inRange(x.from, x.to) ? '✅ 進行中' : '—') + '</td>' +
          '<td><button class="btn-refresh" data-del="' + i + '">刪除</button></td>' +
          '</tr>').join('') + '</tbody></table>';
    $('ssBody').querySelectorAll('[data-f]').forEach(el => {
      el.addEventListener(el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input', function () {
        const r = _rows[+el.getAttribute('data-i')], f = el.getAttribute('data-f');
        r[f] = el.type === 'checkbox' ? el.checked : el.value.trim();
        if (el.type === 'checkbox') render();
      });
    });
    $('ssBody').querySelectorAll('[data-del]').forEach(b => { b.onclick = function () { _rows.splice(+b.getAttribute('data-del'), 1); render(); }; });
    msg(_updated ? '上次儲存:' + _updated.slice(0, 16).replace('T', ' ') + '(UTC)' : '');
  }

  function md(d) { return ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function inRange(from, to) { const t = md(new Date()); return from <= to ? (t >= from && t <= to) : (t >= from || t <= to); }
  function msg(t, bad) { const m = $('ssMsg'); if (m) { m.textContent = t; m.style.color = bad ? '#ff8a8a' : 'var(--t3)'; } }

  async function load() {
    if (!$('seasonRoot')) return;
    shell();
    try {
      const r = await call('season_get');
      if (!r || !r.ok) throw new Error((r && r.error) || '讀取失敗');
      _rows = (r.seasons || []).map(x => Object.assign({}, x)); _themes = r.themes || _themes; _updated = r.updated || '';
      render();
    } catch (e) {
      $('ssBody').innerHTML = '<div class="empty-state"><p>讀取失敗:' + esc(e.message) + '</p></div>';
    }
  }
  function add() { _rows.push({ key: (_themes[0] || {}).key || 'xmas', from: '', to: '', on: true }); render(); }
  async function save() {
    const ok = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
    const bad = _rows.find(x => !ok.test(x.from) || !ok.test(x.to));
    if (bad) { msg('⚠️ 日期要寫成「月-日」,例 11-02、12-26', true); return; }
    msg('儲存中…');
    try {
      const r = await call('season_save', { seasons: _rows });
      if (!r || !r.ok) throw new Error((r && r.error) || '儲存失敗');
      _rows = (r.seasons || []).map(x => Object.assign({}, x)); _updated = r.updated || '';
      //  這台電腦馬上生效(全站 theme-season.js 讀同一個記憶)
      try { localStorage.setItem('bs_season_cfg', JSON.stringify({ seasons: r.seasons, at: Date.now() })); } catch (_) {}
      render(); msg('✅ 已儲存。你這台電腦換頁就看得到;客人最慢 10 分鐘套用。');
    } catch (e) { msg('❌ ' + e.message, true); }
  }

  let _t = 0;
  function tick() {
    mount();
    const t = $('tab-season'); const want = isOwner() ? '' : 'none';
    if (t && t.style.display !== want) t.style.display = want;
  }
  new MutationObserver(function () { clearTimeout(_t); _t = setTimeout(tick, 200); }).observe(document.documentElement, { childList: true, subtree: true });
  let _n = 0; const _iv = setInterval(function () { tick(); if (++_n > 120 || isOwner()) clearInterval(_iv); }, 1000);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tick); else tick();

  window.AdminSeason = { load: load, show: show, add: add, save: save, version: '1.0' };
})();
