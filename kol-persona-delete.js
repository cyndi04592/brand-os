/* ═══════════════════════════════════════════════════════════════════
 *  kol-persona-delete.js · v1.0(2026-11-02)客人自己刪除 KOL 角色
 * ───────────────────────────────────────────────────────────────────
 *  RA 11/02:客人建錯角色刪不掉,只能找管理員;刪了照片還留著 → 形象庫多一張「還沒建立」空卡。
 *  ★ 按鈕在哪:KOL 工作室「人設書編輯」視窗左下角「🗑 刪除這個角色」。
 *  ★ 防手滑:按下去不會馬上刪,要再按一次紅色「確定刪除」(3 秒內沒按就自動取消)。
 *  ★ 刪什麼:角色本身 + 這個角色在形象庫的照片(Worker v7.60:照片是「藏起來」不是真刪,刪錯可請管理員救回)。
 *    已經拍好的影片、廣告圖不會被刪。
 *  ★ 權限:Worker 只准客人刪自己品牌的角色(v5.87 品牌隔離)。
 *  用到 kol.html 的:gasPost / S / systemSelectedPersonaId / refreshAll / toast(都是頁面上原本就有的)
 *  載入:loader.js 只在 KOL 工作室(/kol)載入這支。
 * ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.__kolPersonaDelete) return;
  window.__kolPersonaDelete = 'v1.0';

  var CSS = '.kpd-btn{margin-right:auto;background:none;border:1px solid rgba(255,110,110,.35);color:#ff8a8a;border-radius:8px;padding:6px 12px;font-size:12px;cursor:pointer}'
    + '.kpd-btn:hover{background:rgba(255,110,110,.1)}'
    + '.kpd-btn.kpd-sure{background:#c93a3a;border-color:#c93a3a;color:#fff;font-weight:700}'
    + '.kpd-btn:disabled{opacity:.6;cursor:default}';

  function say(msg, kind) { try { if (typeof toast === 'function') return toast(msg, kind); } catch (_) {} alert(msg); }
  function curPersona() {
    try { return (S.personas || []).find(function (x) { return x.persona_id === systemSelectedPersonaId; }) || null; } catch (_) { return null; }
  }

  async function doDelete(p, btn) {
    btn.disabled = true; btn.textContent = '刪除中…';
    try {
      var res = await gasPost('deleteKolPersona', { persona_id: p.persona_id });
      if (!res || res.ok === false) throw new Error((res && res.error) || '刪除失敗');
      // 畫面上的資料一起清:名單、目前選中的角色、照片快取
      try { S.personas = (S.personas || []).filter(function (x) { return x.persona_id !== p.persona_id; }); } catch (_) {}
      try { if (S.selectedKol && String(S.selectedKol.name || '') === String(p.persona_name || '')) S.selectedKol = null; } catch (_) {}
      try { var b = S.currentBrandId; if (S._libKolCache) delete S._libKolCache[b]; if (S._drivePhotoCache) delete S._drivePhotoCache[b]; } catch (_) {}
      try { if (typeof closePersonaEditor === 'function') closePersonaEditor(); } catch (_) {}
      say('🗑 已刪除「' + p.persona_name + '」' + (res.photosHidden ? '(形象照 ' + res.photosHidden + ' 張已一起移除)' : ''), 'success');
      try { if (typeof refreshAll === 'function') await refreshAll(); } catch (_) {}
    } catch (e) {
      say('❌ ' + ((e && e.message) || e), 'error');
      btn.disabled = false; reset(btn);
    }
  }

  function reset(btn) { btn.classList.remove('kpd-sure'); btn.textContent = '🗑 刪除這個角色'; btn._armed = false; }

  function mount() {
    var foot = document.querySelector('#persona-editor-modal .persona-modal-foot');
    if (!foot || foot.querySelector('.kpd-btn')) return;
    if (!document.getElementById('kpd-css')) {
      var st = document.createElement('style'); st.id = 'kpd-css'; st.textContent = CSS; document.head.appendChild(st);
    }
    var btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'kpd-btn';
    reset(btn);
    btn.onclick = function () {
      var p = curPersona();
      if (!p) { say('找不到這個角色,請重新整理再試', 'warn'); return; }
      if (!btn._armed) {
        //  第一次按:變成紅色「確定刪除」,3 秒內再按一次才會真的刪
        btn._armed = true; btn.classList.add('kpd-sure');
        btn.textContent = '確定刪除「' + String(p.persona_name || '').slice(0, 8) + '」?再按一次';
        clearTimeout(btn._t); btn._t = setTimeout(function () { if (!btn.disabled) reset(btn); }, 3000);
        return;
      }
      clearTimeout(btn._t);
      doDelete(p, btn);
    };
    foot.insertBefore(btn, foot.firstChild);
    // 換人編輯時把按鈕恢復原狀
    var modal = document.getElementById('persona-editor-modal');
    if (modal && window.MutationObserver) new MutationObserver(function () { if (!btn.disabled) reset(btn); }).observe(modal, { attributes: true, attributeFilter: ['style'] });
  }

  function start() { mount(); if (!document.querySelector('#persona-editor-modal .kpd-btn')) setTimeout(start, 1000); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
