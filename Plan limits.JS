/* ═══════════════════════════════════════════════════════════════
 *  Brand OS · 方案限制(前端顯示層)plan-limits.js
 *  v1 · 2026-10-16
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
 *    BOSPlan.limits          → 目前讀到的限制(null = 不限)
 *  需要:config.js 先載入(fetch 會自動夾帶登入證、GAS_PASSWORD 在那裡)
 * ═══════════════════════════════════════════════════════════════ */
(function () {
  const WORKER = 'https://kol-proxy.calm-sunset-6b66.workers.dev';
  const NOTE_CLS = 'bos-plan-lock-note';

  const BOSPlan = { plan: '', limits: null, loaded: false };

  BOSPlan.load = function () {
    return fetch(WORKER, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'plan_limits', password: (typeof GAS_PASSWORD !== 'undefined' ? GAS_PASSWORD : '') })
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

  //  頁面載入後自動跑:登入證可能晚幾秒才到 → 讀不到就每 4 秒重試,最多 8 次
  function _boot() {
    let tries = 0;
    (function once() {
      BOSPlan.load().then(function (r) {
        if (r.ok) { BOSPlan.applyBrandOS(); return; }
        if (++tries < 8) setTimeout(once, 4000);
      });
    })();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _boot);
  else _boot();

  window.BOSPlan = BOSPlan;
})();
