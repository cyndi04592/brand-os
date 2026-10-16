/* ═══════════════════════════════════════════════════════════════
 *  Brand OS · 方案限制(前端顯示層)plan-limits.js
 *  v1 · 2026-10-16 · v2 · 2026-10-17 加 KOL 頁(人數上限 / 分鏡長度)、KOL 頁密碼名稱不同的修正
 *
 *  職責(只做這一件事):跟 kol-proxy 讀「我的方案限制」(action: plan_limits),
 *  把畫面上「這個方案用不到」的按鈕變灰、加上「升級解鎖」提示。
 *
 *  ⚠️ 這裡只是【提醒】。花錢的項目(KOL 數、影片秒數、補給包、商品數)由 kol-proxy v5.87 擋;
 *    文案組數 / 廣告尺寸 / Logo 疊圖只在前端鎖 —— 客人硬繞過也是照用量扣點,不會讓你虧錢
 *    (photoroom-proxy 刻意不改)。
 *  ⚠️ 讀不到(沒登入、Worker 掛了、管理員/員工授權)一律「不鎖」——
 *    寧可多給,也不可把付費客人的按鈕鎖死。
 *
 *  公開 API:
 *    BOSPlan.load()          → Promise<{plan, limits}>(limits = null 代表不限)
 *    BOSPlan.applyBrandOS()  → 主站:文案組數 / 文案長度 / 廣告圖尺寸 / Logo 疊圖
 *    BOSPlan.applyKOL()      → KOL 頁:「＋建新角色」到上限變灰 / 分鏡長度超過方案秒數變灰
 *    BOSPlan.limits          → 目前讀到的限制(null = 不限)
 *  需要:主站 config.js / KOL 頁 kol.html 本身先載入(密碼 + 攔截器);本檔放在頁尾
 * ═══════════════════════════════════════════════════════════════ */
(function () {
  const WORKER = 'https://kol-proxy.calm-sunset-6b66.workers.dev';
  const NOTE_CLS = 'bos-plan-lock-note';

  const BOSPlan = { plan: '', limits: null, loaded: false };

  //  v2:主站用 GAS_PASSWORD(config.js)、KOL 頁用 PASSWORD(kol.html 自己的)—— 兩邊名字不同
  //   ⚠️ 兩頁的攔截器都是「有 password 才夾帶登入證」→ 密碼空白 = 沒帶證 = 讀不到方案 = 全部不鎖
  function _pw() {
    try { if (typeof GAS_PASSWORD !== 'undefined' && GAS_PASSWORD) return GAS_PASSWORD; } catch (_) {}
    try { if (typeof PASSWORD !== 'undefined' && PASSWORD) return PASSWORD; } catch (_) {}
    return '';
  }
  function _tk() {
    try { return sessionStorage.getItem('bs_auth_token') || localStorage.getItem('bs_auth_token') || ''; } catch (_) { return ''; }
  }

  BOSPlan.load = function () {
    const body = { action: 'plan_limits', password: _pw() };
    const t = _tk(); if (t) body.token = t;   // 自己也帶一份,不靠攔截器
    return fetch(WORKER, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (r) { return r.json(); })
      .then(function (j) {
        if (j && j.ok) {
          BOSPlan.plan = j.plan || '';
          BOSPlan.limits = j.limits || null;
          BOSPlan.loaded = true;
        }
        return { plan: BOSPlan.plan, limits: BOSPlan.limits, ok: !!(j && j.ok) };
      })
      .catch(function () { return { plan: '', limits: null, ok: false }; });
  };

  //  緊貼在控制項正後方加一行小字「🔒 …升級解鎖」
  //   ⚠️ 每個控制項各一行(用 key 分):尺寸選單跟 Logo 開關在同一個框裡,共用一行會互相蓋掉
  function _note(el, text, key) {
    if (!el || !el.parentNode) return;
    let n = document.querySelector('.' + NOTE_CLS + '[data-for="' + key + '"]');
    if (!n) {
      n = document.createElement('div');
      n.className = NOTE_CLS;
      n.setAttribute('data-for', key);
      n.style.cssText = 'font-size:10.5px;color:#ffce6b;margin-top:3px;line-height:1.5;font-weight:700;';
      el.insertAdjacentElement('afterend', n);
    }
    n.innerHTML = '🔒 ' + text + ' · <a href="plans.html" style="color:#ffce6b;text-decoration:underline;">升級解鎖</a>';
  }

  BOSPlan.applyBrandOS = function () {
    const L = BOSPlan.limits;
    if (!L) return;   // 不限

    //  ① 文案組數(滑桿 #selN)
    const n = document.getElementById('selN');
    const nMax = Number(L.copy_groups_max || 0);
    if (n && nMax > 0) {
      n.max = String(nMax);
      if (Number(n.value) > nMax) n.value = String(nMax);
      const v = document.getElementById('selNVal'); if (v) v.textContent = n.value;
      if (nMax === 1) { n.disabled = true; n.style.opacity = '0.45'; }
      _note(n, '您的方案一次 ' + nMax + ' 組', 'copyN');
    }

    //  ② 文案長度(#selCopyLength):最長「中等」→ 長文案變灰
    const len = document.getElementById('selCopyLength');
    if (len && L.copy_len_max && L.copy_len_max !== 'long') {
      Array.prototype.forEach.call(len.options, function (o) {
        if (o.value === 'long') { o.disabled = true; o.textContent = '長文案(升級解鎖)'; }
      });
      if (len.value === 'long') len.value = 'medium';
    }

    //  ③ 廣告圖尺寸(#gptAdSize):只出正方
    const sz = document.getElementById('gptAdSize');
    if (sz && Number(L.poster_square_only) === 1) {
      Array.prototype.forEach.call(sz.options, function (o) {
        if (o.value !== 'square') { o.disabled = true; if (o.textContent.indexOf('升級') === -1) o.textContent += '(升級解鎖)'; }
      });
      if (sz.value !== 'square') {
        sz.value = 'square';
        if (typeof onSelAdSize === 'function') { try { onSelAdSize('square'); } catch (_) {} }
      }
      _note(sz, '您的方案廣告圖為 1080×1080 正方', 'adSize');
    }

    //  ④ 疊上品牌 Logo(#showBrandMark):關閉並鎖住
    const lg = document.getElementById('showBrandMark');
    if (lg && Number(L.logo_overlay) === 0) {
      lg.checked = false;
      lg.disabled = true;
      try { lg.dispatchEvent(new Event('change', { bubbles: true })); } catch (_) {}
      const row = lg.closest('label, .sw-row') || lg.parentNode;
      if (row) { row.style.opacity = '0.5'; row.style.pointerEvents = 'none'; }
      if (row && row.parentNode) _note(row, '您的方案不含 Logo 疊圖', 'logo');
    }
  };

  // ═══ KOL 數字人頁(kol.html)═══════════════════════════════════
  //  ① KOL 人數到上限:「＋建新角色」卡變灰;按下去跳提示、不開取名字視窗
  //  ② 分鏡長度下拉(#sbp-duration):超過方案秒數的選項變灰
  //   ⚠️ 這兩個東西都是 kol.html 動態畫的(切品牌、開分鏡面板都會重畫)→ 每 1.5 秒補鎖一次
  function _kolCount() {
    const S = window.S; if (!S) return 0;
    const ids = {};
    const add = function (p) { if (p) { const k = p.persona_id || p.id || p.persona_name; if (k) ids[k] = 1; } };
    (S.personas || []).forEach(add);
    const c = S._personaCache || {};
    Object.keys(c).forEach(function (b) { (c[b] || []).forEach(add); });
    return Object.keys(ids).length;
  }
  function _kolFull() {
    const L = BOSPlan.limits;
    const m = L ? Number(L.kol_max || 0) : 0;
    return m > 0 && _kolCount() >= m ? m : 0;
  }
  function _wrapNewPersona() {
    const f = window.openNewPersonaModal;
    if (typeof f !== 'function' || f._bosWrapped) return;
    const w = function () {
      const m = _kolFull();
      if (m) {
        const msg = '🔒 您的方案最多 ' + m + ' 位 KOL,已達上限 · 到價目表升級即可新增';
        if (typeof window.toast === 'function') window.toast(msg, 'error'); else console.warn(msg);
        return;
      }
      return f.apply(this, arguments);
    };
    w._bosWrapped = true;
    window.openNewPersonaModal = w;
  }
  function _scanKOL() {
    const L = BOSPlan.limits; if (!L) return;
    _wrapNewPersona();
    //  ①「＋建新角色」卡
    const card = document.getElementById('rs-new-kol');
    if (card) {
      const m = _kolFull();
      if (m && !card.getAttribute('data-bos-lock')) {
        card.setAttribute('data-bos-lock', '1');
        card.style.opacity = '0.45';
        card.title = '您的方案最多 ' + m + ' 位 KOL';
        const sp = card.querySelector('span'); if (sp) sp.textContent = '已達 ' + m + ' 位上限';
      } else if (!m && card.getAttribute('data-bos-lock')) {
        card.removeAttribute('data-bos-lock'); card.style.opacity = ''; card.title = '';
        const sp = card.querySelector('span'); if (sp) sp.textContent = '建新角色';
      }
    }
    //  ② 分鏡長度(面板可能同時掛在兩個地方 → 全部都鎖)
    const secMax = Number(L.video_sec_max || 0);
    if (secMax > 0) {
      document.querySelectorAll('select#sbp-duration').forEach(function (sel, i) {
        if (sel.getAttribute('data-bos-lock')) return;
        sel.setAttribute('data-bos-lock', '1');
        let any = false;
        Array.prototype.forEach.call(sel.options, function (o) {
          if (Number(o.value) > secMax) { o.disabled = true; o.textContent += '(升級解鎖)'; any = true; }
        });
        if (any) _note(sel, '您的方案單支影片最長 ' + secMax + ' 秒', 'kolSec' + i);
      });
    }
  }
  BOSPlan.applyKOL = function () {
    if (!BOSPlan.limits) return;   // 不限
    _scanKOL();
    if (!BOSPlan._kolTimer) BOSPlan._kolTimer = setInterval(_scanKOL, 1500);
  };

  //  頁面載入後自動跑:登入證可能晚幾秒才到 → 讀不到就每 4 秒重試,最多 8 次
  //   哪一頁就跑哪一頁的(看頁面上有沒有 KOL 頁才有的東西)
  function _isKolPage() { return /\/kol(\.html)?$/i.test(location.pathname); }
  function _boot() {
    let tries = 0;
    (function once() {
      BOSPlan.load().then(function (r) {
        if (r.ok) { if (_isKolPage()) BOSPlan.applyKOL(); else BOSPlan.applyBrandOS(); return; }
        if (++tries < 8) setTimeout(once, 4000);
      });
    })();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _boot);
  else _boot();

  window.BOSPlan = BOSPlan;
})();
