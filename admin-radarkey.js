/* admin-radarkey.js — 後台「產生 RADAR 唯讀鑰匙」(2026-11-23 交代 0132)
   起因:01:30 主機開的登入視窗被 Google 擋(程式控制的瀏覽器不給登入)→ 改成老闆在後台按一下產生鑰匙。
   ・只有管理員(owner)看得到按鈕;真正的權限在 ads-monitor Worker(radar_key_* 只認 owner)。
   ・鑰匙只在產生當下顯示一次(旁邊「複製」),關掉就再也看不到;再按一次 = 舊的作廢、換新的。
   ・這把鑰匙只能讀廣告監控,所有寫入動作 Worker 一律拒絕;有效 180 天,可以按「作廢」。
   ・按鈕放在「廣告監控綁定」分頁標題列;那個分頁還沒畫出來就放「員工白名單」標題列。 */
(function () {
  'use strict';
  if (window.AdminRadarKey) return;
  //  預覽站(preview-*.pages.dev)接預覽後端;正式站接正式後端
  const ADS = /(^|\.)preview-[^.]*\.brand-os-1xn\.pages\.dev$/.test(location.hostname)
    ? 'https://ads-monitor-preview.calm-sunset-6b66.workers.dev' : 'https://ads-monitor.calm-sunset-6b66.workers.dev';
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function isOwner() { try { return typeof ADMIN_USER_ROLE !== 'undefined' && ADMIN_USER_ROLE === 'owner'; } catch (e) { return false; } }
  function token() {
    try { if (window._bsAuthToken) return window._bsAuthToken(); } catch (e) {}
    try { return sessionStorage.getItem('bs_auth_token') || localStorage.getItem('bs_auth_token') || ''; } catch (e) { return ''; }
  }
  async function call(action) {
    try {
      const r = await fetch(ADS, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: action, token: token() }) });
      return await r.json();
    } catch (e) { return { ok: false, error: '連線失敗' }; }
  }
  const day = (ms) => { if (!ms) return '—'; const d = new Date(ms); return d.getFullYear() + '/' + (d.getMonth() + 1) + '/' + d.getDate(); };

  function mountBtn() {
    if ($('radarKeyBtn')) return true;
    const sec = $('sec-adbind') || $('sec-staff'); if (!sec) return false;
    const hd = sec.querySelector('.section-header'); if (!hd) return false;
    const b = document.createElement('button');
    b.id = 'radarKeyBtn'; b.className = 'btn-refresh'; b.type = 'button';
    b.textContent = '🔑 產生 RADAR 唯讀鑰匙';
    b.title = '給主機每天自動看廣告監控用:只能讀、不能改';
    b.style.cssText = 'margin-right:8px;border-color:#7C6DFA;color:#B7AEFF;' + (isOwner() ? '' : 'display:none;');
    b.onclick = open;
    hd.insertBefore(b, hd.querySelector('.btn-refresh'));
    return true;
  }

  function say(html, color) { const m = $('rkMsg'); if (m) { m.style.color = color || 'var(--t2,#ddd)'; m.innerHTML = html; } }

  function statusLine(k) {
    if (!k || !k.has) return k && k.revoked ? '目前沒有可用的鑰匙(上一把已作廢)。' : '目前還沒有鑰匙。';
    return '目前有一把:' + day(k.at) + ' 產生,' + (k.expired ? '<b style="color:#FA6D6D">已過期</b>' : '到 ' + day(k.exp) + ' 有效')
      + (k.tail ? ',結尾 …' + esc(k.tail) : '') + '。';
  }

  async function open() {
    if (!isOwner()) return;
    const old = $('rkMask'); if (old) old.remove();
    const mask = document.createElement('div');
    mask.id = 'rkMask';
    mask.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';
    mask.innerHTML =
      '<div style="background:var(--bg2,#16161d);border:1px solid var(--line,#2e2e3a);border-radius:14px;max-width:560px;width:100%;max-height:88vh;overflow:auto;padding:20px;">'
      + '<div style="font-size:16px;font-weight:700;color:#B7AEFF;margin-bottom:6px;">RADAR 唯讀鑰匙</div>'
      + '<div style="font-size:12px;color:var(--t3);line-height:1.8;margin-bottom:12px;">給主機每天自動看廣告監控(互搶比對、RADAR 日報)用。<br>'
      + '・只能讀,改綁定、改規則、標記這些動作一律被擋<br>・有效 180 天;再產生一次,舊的馬上作廢</div>'
      + '<div id="rkStatus" style="font-size:13px;margin-bottom:12px;color:var(--t2,#ddd)">讀取中…</div>'
      + '<div id="rkKeyBox" style="display:none;margin-bottom:12px;">'
      + '<div style="font-size:12px;color:#FAD46D;margin-bottom:6px;">⚠ 這串只顯示這一次,關掉就看不到了。按「複製」,回主機黑視窗按右鍵貼上、再按 Enter。</div>'
      + '<div style="display:flex;gap:8px;align-items:center;"><input id="rkKey" class="field-input" readonly style="flex:1;font-family:monospace;font-size:12px;" data-no-dirty>'
      + '<button id="rkCopy" type="button" style="padding:9px 14px;border-radius:8px;border:none;background:#6DFAC2;color:#0b0b12;font-weight:700;cursor:pointer;">複製</button></div></div>'
      + '<div id="rkMsg" style="font-size:13px;line-height:1.7;min-height:20px;margin-bottom:12px;"></div>'
      + '<div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;">'
      + '<button id="rkRevoke" type="button" style="padding:10px 14px;border-radius:8px;border:1px solid #FA6D6D;background:none;color:#FA6D6D;cursor:pointer;font-size:13px;">作廢</button>'
      + '<button id="rkClose" type="button" style="padding:10px 16px;border-radius:8px;border:1px solid var(--line);background:none;color:var(--t3);cursor:pointer;font-size:13px;">關閉</button>'
      + '<button id="rkNew" type="button" style="padding:10px 20px;border-radius:8px;border:none;background:linear-gradient(135deg,#7C6DFA,#6DFAC2);color:#0b0b12;font-weight:700;cursor:pointer;font-size:13px;">產生鑰匙</button>'
      + '</div></div>';
    document.body.appendChild(mask);
    const close = () => { const k = $('rkKey'); if (k) k.value = ''; mask.remove(); };
    mask.onclick = (e) => { if (e.target === mask) close(); };
    $('rkClose').onclick = close;
    $('rkCopy').onclick = async () => {
      const v = $('rkKey').value; if (!v) return;
      try { await navigator.clipboard.writeText(v); say('✅ 已複製。回主機黑視窗按右鍵貼上,再按 Enter。', '#6DFAC2'); }
      catch (e) { $('rkKey').select(); say('瀏覽器不讓自動複製,已幫您選好,請按 Ctrl+C。', '#FAD46D'); }
    };
    $('rkNew').onclick = async () => {
      const st = $('rkStatus').dataset.has === '1';
      if (st && !confirm('已經有一把鑰匙了。產生新的,舊的會馬上作廢,主機要重存一次。確定?')) return;
      say('產生中…');
      const j = await call('radar_key_new');
      if (!j || !j.ok || !j.key) { say('產生失敗:' + esc((j && j.error) || '沒有回應'), '#FA6D6D'); return; }
      $('rkKeyBox').style.display = ''; $('rkKey').value = j.key; $('rkNew').textContent = '再產生一把(舊的作廢)';
      $('rkStatus').innerHTML = statusLine(j.info); $('rkStatus').dataset.has = '1';
      say('產生好了。');
    };
    $('rkRevoke').onclick = async () => {
      if (!confirm('作廢後主機每天的自動比對會停,要重新產生、重存才會恢復。確定作廢?')) return;
      const j = await call('radar_key_revoke');
      if (!j || !j.ok) { say('作廢失敗:' + esc((j && j.error) || '沒有回應'), '#FA6D6D'); return; }
      $('rkKeyBox').style.display = 'none'; $('rkKey').value = '';
      $('rkStatus').innerHTML = statusLine(j.key); $('rkStatus').dataset.has = '0';
      say('已作廢。', '#FAD46D');
    };
    const s = await call('radar_key_status');
    const box = $('rkStatus'); if (!box) return;
    if (!s || !s.ok) { box.innerHTML = '讀不到鑰匙狀態(' + esc((s && s.error) || '沒有回應') + ')'; return; }
    box.innerHTML = statusLine(s.key); box.dataset.has = s.key && s.key.has ? '1' : '0';
    if (s.key && s.key.has) $('rkNew').textContent = '再產生一把(舊的作廢)';
  }

  let tries = 0;
  (function boot() {
    const ok = mountBtn();
    const b = $('radarKeyBtn'); if (b) b.style.display = isOwner() ? '' : 'none';
    if ((!ok || !isOwner() || !$('sec-adbind')) && tries++ < 60) {   // 綁定分頁晚畫出來 → 搬過去
      if (ok && $('sec-adbind') && b && !$('sec-adbind').contains(b)) { b.remove(); mountBtn(); }
      setTimeout(boot, 1000);
    }
  })();

  window.AdminRadarKey = { open: open, version: '1.0' };
})();
