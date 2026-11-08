// ⚠️⚠️ 這個檔案的正確檔名是:kol-evidence.js  (證據圖 KolEvidence)  ⚠️⚠️
// ═════════════════════════════════════════════════════════════════
//  kol-evidence.js · v1.0(2026-11-09)
//  🖼 講者 + 證據圖(RA:參考 wetracked 那種影片 —— KOL 講話,畫面下半部彈出客人自己的方形廣告圖)
//
//  職責(只做這一件事):
//   ① 分鏡面板選「講者 + 證據圖」時,列出這個品牌的廣告圖讓客人勾(勾的順序 = 出場順序)
//   ② 張數決定片長:每 15 秒 2 張(15 秒 2 張、30 秒 4 張 … 90 秒 12 張)
//   ③ AI 編修時把勾的圖交給 Worker(storyboard_expand 的 evidence)→ 編劇 AI 看圖、一張圖寫一句
//   ④ 記下 Worker 回的出場表(每張圖對到哪句台詞)→ 加字幕時一起交給燒字機(subtitle_burn 的 cards)
//
//  ★ 證據圖是【拍完才疊上去】的,不送進 Seedance → 不佔 9 張參考圖的名額
//  ★ 證據圖不另外收點:跟字幕同一次合成
//  掛載:kol-storyboard-panel.js(影片類型下拉)· kol-subtitle.js(加字幕時帶 cards)
// ═════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  const PER_BEAT = 2;                          // 每 15 秒 2 張(RA 2026-11-09 定案)
  const MAX = 12;                              // 90 秒 × 每 15 秒 2 張
  const DURATIONS = [15, 30, 45, 60, 90];      // 跟分鏡面板同一組長度
  const PLAN_KEY = 'bos_evidence_plan.v1';

  const st = { brandId: '', ads: [], loading: false, err: '', picked: [], plan: null };

  function _brand() {
    const S = window.S || {};
    return String(S.currentBrandId || S.selectedBrandId || '').trim();
  }
  function _esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function _thumb(u) {
    return /^https:\/\/cdn\.raby\.com\.tw\//.test(u) && !/\/cdn-cgi\//.test(u)
      ? u.replace(/^(https:\/\/cdn\.raby\.com\.tw)(\/.*)$/, '$1/cdn-cgi/image/width=200,quality=75,format=auto$2') : u;
  }

  //  張數 → 片長(取最短的、裝得下的那個長度)
  function durationFor(n) {
    const need = Math.max(1, Math.ceil(Math.max(1, n) / PER_BEAT)) * 15;
    return DURATIONS.find(d => d >= need) || DURATIONS[DURATIONS.length - 1];
  }
  function capFor(dur) { return Math.min(MAX, Math.round((Number(dur) || 15) / 15) * PER_BEAT); }

  async function _load() {
    const b = _brand();
    if (!b || typeof window.api !== 'function') { st.err = '先選品牌'; return; }
    if (b === st.brandId && st.ads.length) return;
    if (b !== st.brandId) { st.picked = []; st.ads = []; }
    st.brandId = b; st.loading = true; st.err = '';
    try {
      const r = await window.api('list_assets', { brandId: b, limit: 300 });
      if (b !== st.brandId) return;   // 已經切品牌
      st.ads = ((r && r.items) || []).filter(it => it && it.url && /廣告/.test(String(it.category || '')))
        .map(it => ({ url: it.url, name: it.name || '' }));
      if (!st.ads.length) st.err = '這個品牌還沒有廣告圖 —— 先到「廣告圖產生器」做幾張,這裡就會出現';
    } catch (e) {
      st.err = '廣告圖讀不到,請重新整理再試一次';
    }
    st.loading = false;
  }

  //  分鏡面板呼叫:選了「講者 + 證據圖」才畫,其他類型清空
  async function render(box, opts) {
    if (!box) return;
    const on = !!(opts && opts.on);
    if (!on) { box.innerHTML = ''; box.style.display = 'none'; return; }
    box.style.display = '';
    box._opts = opts;
    if (_brand() !== st.brandId || (!st.ads.length && !st.loading)) {
      box.innerHTML = '<div style="color:#999;font-size:12px;padding:8px 0;">⏳ 讀取這個品牌的廣告圖…</div>';
      await _load();
    }
    _paint(box);
  }

  function _paint(box) {
    const n = st.picked.length, dur = durationFor(n);
    const grid = st.ads.map(a => {
      const k = st.picked.indexOf(a.url);
      return '<div data-u="' + _esc(a.url) + '" title="' + _esc(a.name) + '" style="position:relative;width:72px;height:72px;border-radius:8px;overflow:hidden;cursor:pointer;flex:0 0 auto;'
        + 'border:2px solid ' + (k >= 0 ? '#a78bfa' : 'transparent') + ';background:#222;">'
        + '<img src="' + _esc(_thumb(a.url)) + '" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block;' + (k >= 0 ? '' : 'opacity:.75;') + '">'
        + (k >= 0 ? '<span style="position:absolute;top:3px;left:3px;min-width:20px;height:20px;border-radius:10px;background:#a78bfa;color:#fff;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;">' + (k + 1) + '</span>' : '')
        + '</div>';
    }).join('');
    box.innerHTML = '<div style="margin:8px 0 4px;padding:10px 12px;border-radius:10px;border:1px solid #a78bfa44;background:#a78bfa0d;">'
      + '<div style="font-size:13px;font-weight:600;color:#e8e8f0;margin-bottom:4px;">🖼 勾證據圖(勾的順序 = 出場順序)</div>'
      + '<div style="font-size:12px;color:#aaa;line-height:1.6;margin-bottom:8px;">她講到哪一句,那張圖就從畫面下半部彈出來。每 15 秒放 2 張,最多 ' + MAX + ' 張(90 秒)。'
      + '圖是拍完才疊上去的,不佔 9 張參考圖的名額。</div>'
      + (st.err ? '<div style="color:#ffb86b;font-size:12px;margin-bottom:6px;">' + _esc(st.err) + '</div>' : '')
      + '<div class="kev-grid" style="display:flex;gap:6px;overflow-x:auto;padding-bottom:4px;">' + grid + '</div>'
      + '<div style="font-size:12px;margin-top:6px;color:' + (n ? '#c4b5fd' : '#888') + ';">'
      + (n ? ('已勾 ' + n + ' 張 → 影片 ' + dur + ' 秒(' + (dur / 15) + ' 段)· 加字幕時會一起把圖疊上去') : '還沒勾 · 至少勾 1 張')
      + (n ? ' <a href="javascript:void 0" class="kev-clear" style="color:#a78bfa;margin-left:6px;">清除</a>' : '')
      + '</div></div>';
    box.querySelectorAll('[data-u]').forEach(el => { el.onclick = function () { _toggle(box, el.getAttribute('data-u')); }; });
    const c = box.querySelector('.kev-clear');
    if (c) c.onclick = function () { st.picked = []; _paint(box); };
  }

  function _toggle(box, url) {
    const k = st.picked.indexOf(url);
    if (k >= 0) st.picked.splice(k, 1);
    else {
      if (st.picked.length >= MAX) { if (typeof window.toast === 'function') window.toast('最多 ' + MAX + ' 張(90 秒)', 'warn'); return; }
      st.picked.push(url);
    }
    _paint(box);
    const o = box._opts || {};
    if (st.picked.length && typeof o.onDuration === 'function') o.onDuration(durationFor(st.picked.length));
  }

  //  AI 編修時:分鏡面板拿這個塞進 payload.evidence(張數超過這個長度裝得下的就截掉)
  function payload(dur) {
    return st.picked.slice(0, capFor(dur || durationFor(st.picked.length))).map(u => ({ url: u }));
  }
  function count() { return st.picked.length; }

  //  Worker 回的出場表 [{url, img, beat, say}](已照她講的先後排好)
  function setPlan(ev) {
    st.plan = Array.isArray(ev) && ev.length ? ev.filter(x => x && x.url).map(x => ({ url: x.url, say: String(x.say || '') })) : null;
    try {
      if (st.plan) localStorage.setItem(PLAN_KEY, JSON.stringify({ at: Date.now(), brandId: st.brandId || _brand(), cards: st.plan }));
      else localStorage.removeItem(PLAN_KEY);
    } catch (_) {}
  }

  //  加字幕時:這支片的台詞對得上出場表才帶(別支片的圖不能亂疊)
  function cardsFor(script) {
    let plan = st.plan;
    if (!plan) { try { const o = JSON.parse(localStorage.getItem(PLAN_KEY) || 'null'); if (o && Date.now() - o.at < 3 * 86400000) plan = o.cards; } catch (_) {} }
    if (!Array.isArray(plan) || !plan.length) return null;
    const norm = t => String(t || '').replace(/[\s，,。.!！?？;；:：、…⋯~～「」『』（）()"“”'’—-]/g, '').toLowerCase();
    const ns = norm(script);
    const hit = plan.filter(c => c.say && ns.includes(norm(c.say))).length;
    if (!ns || hit < Math.ceil(plan.length / 2)) return null;   // 台詞改太多 / 不是這支片 → 不疊
    return plan.slice(0, MAX).map(c => ({ url: c.url, say: c.say }));
  }

  window.KolEvidence = { render, payload, count, setPlan, cardsFor, durationFor, PER_BEAT, MAX };
  try { console.log('[KolEvidence] v1.0 就緒 · 🖼 講者 + 證據圖(每 15 秒 2 張 · 最多 12 張 · 加字幕時一起疊)'); } catch (_) {}
})();
