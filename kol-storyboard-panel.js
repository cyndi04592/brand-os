// ════════════════════════════════════════════════════════════════════
//  kol-storyboard-panel.js · v1.2
//  🎬 分鏡產生器面板 — 大綱 → AI 編修 → 分鏡卡片 → 確認分鏡(鎖定)/ 重新編輯(解鎖)
//   • open(ctx): { containerId, persona, product, sceneLabel, onConfirm, onEdit }
//   • 確認分鏡 → ctx.onConfirm(beats, duration)(填劇情+鎖設定,不生成)
//   • 重新編輯 → ctx.onEdit()(解鎖)
// ════════════════════════════════════════════════════════════════════

(function () {
  'use strict';

  const DURATIONS = [15, 30, 45, 60, 90];

  let rootEl = null;
  let ctx = null;
  const state = { duration: 15, outline: '', beats: [], busy: false, confirmed: false };

  // 🛡️ v1.3 修:本面板同時掛在 STEP2(sbp-cine-mount)+ STEP3(sbp-episode-mount)兩個容器,
  //   固定 ID 在頁面上會「重複」→ document.getElementById 永遠抓到第一個(STEP2)→ STEP3 按 AI 編修
  //   請求有送、200 有回,但卡片被畫進 STEP2 的隱藏容器,STEP3 看起來「沒反應」。
  //   解法:面板內部一律「只在當前掛載的 rootEl 裡找元素」,兩個容器各自獨立。
  function $el(id) { return (rootEl && rootEl.querySelector) ? rootEl.querySelector('#' + id) : document.getElementById(id); }

  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

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

  function mount(containerId) {
    rootEl = document.getElementById(containerId);
    if (!rootEl) { console.warn('[sbp] 找不到容器', containerId); return; }
    ensureStyles();
    render();
  }

  function open(newCtx) {
    ctx = newCtx || {};
    if (ctx.containerId) {
      rootEl = document.getElementById(ctx.containerId);
      ensureStyles();
    }
    state.beats = [];
    state.outline = '';
    state.busy = false;
    state.confirmed = false;
    render();
    rootEl?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }

  function syncDom() {
    state.beats.forEach(b => {
      const sd = $el('sbp-shot-' + b.index);
      if (sd) b.shotDesc = sd.value;
      const dl = $el('sbp-dlg-' + b.index);
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

  function unlockIfConfirmed() {
    if (state.confirmed) {
      state.confirmed = false;
      if (typeof ctx?.onEdit === 'function') ctx.onEdit();
    }
  }

  async function expand() {
    if (state.busy) return;
    if (!window.KolStorywriter) { alert('KolStorywriter 未載入'); return; }
    if (typeof api !== 'function') { alert('api() 未載入'); return; }
    unlockIfConfirmed();
    if (state.beats.length) syncDom();

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
    const btn = $el('sbp-expand-btn');
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

  function outlineInput(v) { state.outline = v; }
  function shotInput(idx, v) { const b = state.beats.find(x => x.index === idx); if (b) b.shotDesc = v; }
  function dialogueInput(idx, v) {
    const b = state.beats.find(x => x.index === idx);
    if (!b) return;
    b.dialogue = v;
    b.fit = window.KolStorywriter.checkDialogueFit(v, b.seconds);
    b.overflow = !b.fit.fits;
    const fitEl = $el('sbp-fit-' + idx);
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
    state.beats = [];
    unlockIfConfirmed();
    renderCards();
  }

  function confirmToggle() {
    if (!state.beats.length) { alert('請先按「AI 編修」產生分鏡'); return; }
    if (!state.confirmed) {
      syncDom();
      state.confirmed = true;
      if (typeof ctx?.onConfirm === 'function') ctx.onConfirm(state.beats, state.duration);
      else alert('尚未接上確認流程(onConfirm)');
    } else {
      state.confirmed = false;
      if (typeof ctx?.onEdit === 'function') ctx.onEdit();
    }
    renderCards();
  }

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
    placeholder="例:健一在日本富士山的登山步道休息,隨身帶著防熊噴霧,最近日本熊出沒新聞變多..."
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
    const box = $el('sbp-cards');
    if (!box) return;
    if (!state.beats.length) {
      box.innerHTML = `<div class="sbp-empty">填好大綱、按「AI 編修」,這裡會出現 ${window.KolStorywriter.planBeats(state.duration).length} 張分鏡卡片</div>`;
      return;
    }
    const multi = state.beats.length > 1;
    const note = state.confirmed
      ? (multi
          ? `✅ 已確認 · ${state.beats.length} 段會自動接成 ≈ ${state.duration} 秒長片,挑好設定按生成`
          : '✅ 分鏡已確認 · 單段,挑好設定按生成')
      : (multi
          ? `🎬 ${state.beats.length} 段分鏡 → 按「確認分鏡」後會自動接成 ≈ ${state.duration} 秒長片`
          : '確認後會鎖定下面設定');
    box.innerHTML = state.beats.map(cardHtml).join('') + `
<div class="sbp-genrow">
  <span class="sbp-note">${note}</span>
  <button class="btn ${state.confirmed ? 'btn-ghost' : 'btn-primary'} btn-sm" onclick="KolStoryboardPanel.confirmToggle()">${state.confirmed ? '✏️ 重新編輯(解鎖)' : '✅ 確認分鏡'}</button>
</div>`;
  }

  window.KolStoryboardPanel = {
    mount, open, expand, lock, confirmToggle,
    durationChange, outlineInput, shotInput, dialogueInput,
    getBeats: () => state.beats,
  };

  console.log('[KolStoryboardPanel] 🎬 v1.3 就緒(確認鎖定 / 重新編輯解鎖 · 🛡️雙容器各自獨立·STEP3修)');
})();
