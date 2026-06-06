// ════════════════════════════════════════════════════════════════════
//  kol-storyboard-panel.js · v1.0
//
//  🎬 分鏡產生器面板 — 大綱 → AI 編修 → 可編輯分鏡卡片 → 確認生成
//
//  職責:純 UI 面板。不碰 kol.html 內部狀態。
//   • open(ctx) 由 kol.html 餵進 { persona, product, brandId, sceneLabel, onGenerate }
//   • AI 編修走 KolStorywriter.buildExpandRequest + api('storyboard_expand') + mergeExpandResult
//   • 確認生成時呼叫 ctx.onGenerate(beats, duration)(生成怎麼做由 kol.html 決定)
//
//  依賴:window.KolStorywriter、window.api(都在 kol.html 先載入)
// ════════════════════════════════════════════════════════════════════

(function () {
  'use strict';

  const DURATIONS = [15, 30, 45, 60, 90];

  let rootEl = null;
  let ctx = null;
  const state = { duration: 15, outline: '', beats: [], busy: false };

  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  // ─── 樣式(注入一次,scoped 在 .sbp-)──────────────
  function ensureStyles() {
    if (document.getElementById('sbp-styles')) return;
    const css = `
.sbp-wrap{font-size:13px;color:var(--text,#e8e8ef)}
.sbp-head{font-size:15px;font-weight:600;margin-bottom:10px}
.sbp-head .sbp-sub{font-size:12px;font-weight:400;color:var(--text-dim,#8a8a99);margin-left:8px}
.sbp-label{display:block;font-size:12px;color:var(--text-dim,#8a8a99);margin:10px 0 4px}
.sbp-row{display:flex;align-items:center;gap:8px;margin:8px 0}
.sbp-select,.sbp-textarea{width:100%;background:var(--bg-2,#15151c);color:var(--text,#e8e8ef);
  border:1px solid var(--border,#2c2c38);border-radius:8px;padding:8px 10px;font-size:13px;font-family:inherit}
.sbp-textarea{resize:vertical;line-height:1.55}
.sbp-actions{margin-top:10px}
.sbp-card{background:var(--bg-2,#15151c);border:1px solid var(--border,#2c2c38);
  border-radius:12px;padding:12px 14px;margin-top:12px}
.sbp-badge{display:inline-block;font-size:12px;font-weight:500;background:#241f3a;color:#b9aaff;
  border-radius:7px;padding:3px 10px}
.sbp-sec{font-size:12px;color:var(--text-dim,#8a8a99);margin-left:8px}
.sbp-lockbtn{margin-left:auto;font-size:12px;background:transparent;color:var(--text-dim,#8a8a99);
  border:1px solid var(--border,#2c2c38);border-radius:7px;padding:3px 9px;cursor:pointer}
.sbp-lockbtn.on{color:#f5c451;border-color:#5a4d1f;background:#221d0c}
.sbp-cardhead{display:flex;align-items:center;margin-bottom:8px}
.sbp-mini{font-size:11px;color:var(--text-dim,#8a8a99);margin:8px 0 3px}
.sbp-fit{font-size:11px;margin-top:4px;color:var(--text-dim,#8a8a99)}
.sbp-fit.over{color:#ff6b6b}
.sbp-empty{color:var(--text-dim,#8a8a99);font-size:12px;padding:14px 0;text-align:center}
.sbp-genrow{margin-top:14px;display:flex;align-items:center;gap:10px}
.sbp-note{font-size:11px;color:var(--text-dim,#8a8a99);flex:1}`;
    const el = document.createElement('style');
    el.id = 'sbp-styles';
    el.textContent = css;
    document.head.appendChild(el);
  }

  // ─── 對外 API ──────────────────────────────────
  function mount(containerId) {
    rootEl = document.getElementById(containerId);
    if (!rootEl) { console.warn('[sbp] 找不到容器', containerId); return; }
    ensureStyles();
    render();
  }

  function open(newCtx) {
    ctx = newCtx || {};
    state.beats = [];
    state.outline = '';
    state.busy = false;
    render();
    rootEl?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }

  // ─── 內部:把目前 DOM 的編輯抓回 state ──────────
  function syncDom() {
    state.beats.forEach(b => {
      const sd = document.getElementById('sbp-shot-' + b.index);
      if (sd) b.shotDesc = sd.value;
      const dl = document.getElementById('sbp-dlg-' + b.index);
      if (dl) {
        b.dialogue = dl.value;
        b.fit = window.KolStorywriter.checkDialogueFit(b.dialogue, b.seconds);
        b.overflow = !b.fit.fits;
      }
    });
  }

  function collectLocked() {
    return state.beats
      .filter(b => b.dialogueLocked && b.dialogue)
      .map(b => ({ index: b.index, text: b.dialogue }));
  }

  // ─── AI 編修 ──────────────────────────────────
  async function expand() {
    if (state.busy) return;
    if (!window.KolStorywriter) { alert('KolStorywriter 未載入'); return; }
    if (typeof api !== 'function') { alert('api() 未載入'); return; }
    if (state.beats.length) syncDom(); // 重編修時保留已鎖台詞

    const lockedLines = collectLocked();
    const payload = window.KolStorywriter.buildExpandRequest({
      duration: state.duration,
      outline: state.outline,
      lockedLines,
      persona: ctx?.persona || {},
      product: ctx?.product || {},
      sceneLabel: ctx?.sceneLabel || '',
    });

    state.busy = true;
    const btn = document.getElementById('sbp-expand-btn');
    if (btn) { btn.disabled = true; btn.textContent = '編修中…'; }

    try {
      const res = await api('storyboard_expand', payload);
      if (!res || !res.ok) {
        alert('AI 編修失敗:' + (res?.error || '未知錯誤'));
      } else {
        const skeleton = window.KolStorywriter.planBeats(state.duration);
        state.beats = window.KolStorywriter.mergeExpandResult(skeleton, res.beats, lockedLines);
      }
    } catch (e) {
      alert('AI 編修錯誤:' + e.message);
    }

    state.busy = false;
    if (btn) { btn.disabled = false; btn.textContent = '✨ AI 編修成分鏡'; }
    renderCards();
  }

  // ─── 編輯事件 ──────────────────────────────────
  function outlineInput(v) { state.outline = v; }
  function shotInput(idx, v) { const b = state.beats.find(x => x.index === idx); if (b) b.shotDesc = v; }
  function dialogueInput(idx, v) {
    const b = state.beats.find(x => x.index === idx);
    if (!b) return;
    b.dialogue = v;
    b.fit = window.KolStorywriter.checkDialogueFit(v, b.seconds);
    b.overflow = !b.fit.fits;
    const fitEl = document.getElementById('sbp-fit-' + idx);
    if (fitEl) {
      fitEl.textContent = `${b.fit.chars} 字 · 約 ${b.fit.estSec} 秒` + (b.overflow ? ' ⚠️ 太長,塞不進 15 秒' : '');
      fitEl.className = 'sbp-fit' + (b.overflow ? ' over' : '');
    }
  }
  function lock(idx) {
    syncDom();
    const b = state.beats.find(x => x.index === idx);
    if (b) b.dialogueLocked = !b.dialogueLocked;
    renderCards();
  }
  function durationChange(v) {
    state.duration = parseInt(v);
    state.beats = []; // 段數變了,要重編修
    renderCards();
  }

  function generate() {
    if (!state.beats.length) { alert('請先按「AI 編修」產生分鏡'); return; }
    syncDom();
    if (typeof ctx?.onGenerate === 'function') ctx.onGenerate(state.beats, state.duration);
    else alert('尚未接上生成流程(onGenerate)');
  }

  // ─── 渲染 ──────────────────────────────────────
  function render() {
    if (!rootEl) return;
    rootEl.innerHTML = `
<div class="sbp-wrap">
  <div class="sbp-head">🎬 分鏡產生器<span class="sbp-sub">大綱 → AI 編修 → 分鏡卡片</span></div>
  <div class="sbp-row">
    <label class="sbp-label" style="margin:0">長度</label>
    <select id="sbp-duration" class="sbp-select" style="width:auto" onchange="KolStoryboardPanel.durationChange(this.value)">
      ${DURATIONS.map(d => `<option value="${d}" ${d === state.duration ? 'selected' : ''}>${d} 秒 · ${window.KolStorywriter.planBeats(d).length} beat</option>`).join('')}
    </select>
  </div>
  <label class="sbp-label">大綱(可留空,AI 自己想)</label>
  <textarea id="sbp-outline" class="sbp-textarea" rows="3"
    placeholder="例:健一今天到富士山爬山,隨身帶著防熊噴霧,最近新聞一直報熊出沒攻擊遊客..."
    oninput="KolStoryboardPanel.outlineInput(this.value)">${esc(state.outline)}</textarea>
  <div class="sbp-actions">
    <button id="sbp-expand-btn" class="btn btn-primary btn-sm" onclick="KolStoryboardPanel.expand()">✨ AI 編修成分鏡</button>
  </div>
  <div id="sbp-cards"></div>
</div>`;
    renderCards();
  }

  function cardHtml(b) {
    const overCls = b.overflow ? ' over' : '';
    const fitTxt = b.dialogue
      ? `${b.fit?.chars ?? 0} 字 · 約 ${b.fit?.estSec ?? 0} 秒` + (b.overflow ? ' ⚠️ 太長,塞不進 15 秒' : '')
      : '';
    return `
<div class="sbp-card">
  <div class="sbp-cardhead">
    <span class="sbp-badge">Beat ${b.index} · ${esc(b.zhLabel)}</span>
    <span class="sbp-sec">${b.seconds} 秒</span>
    <button class="sbp-lockbtn${b.dialogueLocked ? ' on' : ''}" onclick="KolStoryboardPanel.lock(${b.index})">
      ${b.dialogueLocked ? '🔒 已鎖' : '🔓 鎖台詞'}
    </button>
  </div>
  <div class="sbp-mini">鏡頭</div>
  <textarea id="sbp-shot-${b.index}" class="sbp-textarea" rows="2"
    oninput="KolStoryboardPanel.shotInput(${b.index}, this.value)">${esc(b.shotDesc)}</textarea>
  <div class="sbp-mini">台詞「」</div>
  <textarea id="sbp-dlg-${b.index}" class="sbp-textarea" rows="2"
    oninput="KolStoryboardPanel.dialogueInput(${b.index}, this.value)">${esc(b.dialogue)}</textarea>
  <div id="sbp-fit-${b.index}" class="sbp-fit${overCls}">${fitTxt}</div>
</div>`;
  }

  function renderCards() {
    const box = document.getElementById('sbp-cards');
    if (!box) return;
    if (!state.beats.length) {
      box.innerHTML = `<div class="sbp-empty">填好大綱、按「AI 編修」,這裡會出現 ${window.KolStorywriter.planBeats(state.duration).length} 張分鏡卡片</div>`;
      return;
    }
    const multi = state.beats.length > 1;
    box.innerHTML = state.beats.map(cardHtml).join('') + `
<div class="sbp-genrow">
  <span class="sbp-note">${multi ? '⚠️ 多段需接片管線(demo 後上線),目前先打通 15 秒單段' : '✅ 15 秒單段,可直接生成'}</span>
  <button class="btn btn-primary btn-sm" onclick="KolStoryboardPanel.generate()">確認 → 生成</button>
</div>`;
  }

  // ─── 導出 ──────────────────────────────────────
  window.KolStoryboardPanel = {
    mount, open, expand, lock, generate,
    durationChange, outlineInput, shotInput, dialogueInput,
    getBeats: () => state.beats,
  };

  console.log('[KolStoryboardPanel] 🎬 v1.0 就緒');
})();
