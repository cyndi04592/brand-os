// ══════════════════════════════════════════
//  generator.js — 生成腳本、腳本卡片、交付表 + 記憶功能
// ══════════════════════════════════════════

// ══ Tab 切換 ══
function switchTab(btn) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('on'));
  document.querySelectorAll('.pane').forEach(p => p.classList.remove('on'));
  btn.classList.add('on');
  document.getElementById('pane-' + btn.dataset.tab).classList.add('on');
}

// ══ 字數計算 ══
function countWords(str) {
  if (!str) return 0;
  const s = str.replace(/[，。！？、；：「」『』【】〔〕…—·\s]/g, '');
  const zhChars = (s.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
  const enWords = (s.replace(/[\u4e00-\u9fff\u3400-\u4dbf]/g, ' ').match(/[a-zA-Z0-9]+/g) || []).length;
  return zhChars + enWords;
}

function charBadge(len, limit) {
  const over  = len > limit;
  const color = over ? '#FF4D6A' : '#7ED4B0';
  const icon  = over ? '⚠️ 超字數！' : '✅';
  return `<span style="font-size:10px;font-weight:900;color:${color};font-family:'DM Mono';margin-left:6px;">${len}字 ${icon}</span>`;
}

// ════════════════════════════════════════════════════════════════
// ★ 記憶模組
// ════════════════════════════════════════════════════════════════

let currentMemories = [];

async function loadMemories(brandId, productId) {
  try {
    const url  = `${GAS_URL}?action=getMemory&password=${GAS_PASSWORD}&brandId=${encodeURIComponent(brandId)}&productId=${encodeURIComponent(productId)}`;
    const res  = await fetch(url);
    const data = await res.json();
    currentMemories = data.ok ? (data.memories || []) : [];
  } catch (e) {
    console.warn('記憶載入失敗:', e);
    currentMemories = [];
  }
  return currentMemories;
}

async function saveMemory(combo, brandId, subId, brandName, productName) {
  try {
    const hookScript = combo.hook?.script || '';
    const productId  = window.S.prod?.id || subId || '';

    // ★ 存入前重新拉最新記憶（防跨 session / 重整頁面後重複）
    await loadMemories(brandId, productId);

    // 防重複：同 hookScript 已存在就跳過
    const isDuplicate = currentMemories.some(m => m.hookScript === hookScript);
    if (isDuplicate) {
      console.log('記憶已存在，跳過重複存入');
      return 'duplicate';
    }

    const payload = {
      action:      'addMemory',
      password:    GAS_PASSWORD,
      brandId,
      productId,
      brandName,
      productName,
      hookMethod:  combo.hook?.method || '',
      hookScript,
      coreType:    combo.core?.type   || '',
      ctaScript:   combo.cta?.script  || '',
      adId:        combo.id           || ''
    };
    const res  = await fetch(GAS_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'text/plain' },
      body:    JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.ok) {
      currentMemories.unshift({ ...payload, id: data.id, timestamp: data.timestamp, score: 1 });
      if (currentMemories.length > 10) currentMemories = currentMemories.slice(0, 10);
      renderMemoryPanel();
      return true;
    }
  } catch (e) { console.warn('記憶儲存失敗:', e); }
  return false;
}

function renderMemoryPanel() {
  const container = document.getElementById('memoryPanel');
  if (!container) return;
  if (currentMemories.length === 0) {
    container.innerHTML = `<div class="mem-empty"><span style="opacity:0.4;font-size:16px;">🧠</span><span>尚無文案記憶，點「＋加入記憶學習區」後自動存入</span></div>`;
    return;
  }
  const top5     = currentMemories.slice(0, 5);
  const scoreMax = Math.max(...top5.map(m => m.score || 1), 1);
  container.innerHTML = `
    <div class="mem-header">
      <span class="mem-title">🧠 文案記憶庫</span>
      <span class="mem-subtitle">TOP ${top5.length} 鉤子 — AI 下次產出不重複風格</span>
      <span class="mem-count">${currentMemories.length} 筆</span>
    </div>
    <div class="mem-cards">
      ${top5.map((m, i) => {
        const filled = Math.round((m.score / scoreMax) * 5);
        const bars   = '█'.repeat(filled) + '░'.repeat(5 - filled);
        const diff   = Date.now() - new Date(m.timestamp).getTime();
        const ago    = diff > 86400000*30 ? `${Math.floor(diff/86400000/30)}個月前`
                     : diff > 86400000    ? `${Math.floor(diff/86400000)}天前`
                     : diff > 3600000     ? `${Math.floor(diff/3600000)}小時前` : '剛才';
        return `<div class="mem-card">
          <div class="mem-rank">#${i+1}</div>
          <div class="mem-method">${m.hookMethod||'未分類'}</div>
          <div class="mem-hook">${m.hookScript}</div>
          <div class="mem-meta">
            <span class="mem-cta">${m.ctaScript}</span>
            <span class="mem-score">${bars} ${m.score}</span>
            <span class="mem-time">${ago}</span>
          </div>
        </div>`;
      }).join('')}
    </div>`;
}

function injectMemoryCSS() {
  if (document.getElementById('memory-css')) return;
  const style = document.createElement('style');
  style.id = 'memory-css';
  style.textContent = `
    #memoryPanel { margin:0 0 12px 0; background:linear-gradient(135deg,rgba(228,184,74,0.04),rgba(20,20,38,0.8)); border:1px solid rgba(228,184,74,0.15); border-radius:10px; padding:12px 14px; }
    #memoryPanel:empty { display:none; }
    .mem-empty { display:flex; align-items:center; gap:8px; color:rgba(144,144,187,0.5); font-size:11px; }
    .mem-header { display:flex; align-items:center; gap:8px; margin-bottom:10px; flex-wrap:wrap; }
    .mem-title { font-size:11px; font-weight:700; color:#E4B84A; }
    .mem-subtitle { font-size:10px; color:rgba(144,144,187,0.6); flex:1; }
    .mem-count { font-size:10px; background:rgba(228,184,74,0.1); color:#E4B84A; border:1px solid rgba(228,184,74,0.2); border-radius:20px; padding:1px 8px; }
    .mem-cards { display:grid; grid-template-columns:repeat(auto-fill,minmax(180px,1fr)); gap:7px; }
    .mem-card { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); border-radius:8px; padding:9px 11px; position:relative; }
    .mem-rank { position:absolute; top:7px; right:9px; font-size:9px; color:rgba(228,184,74,0.4); font-weight:700; }
    .mem-method { font-size:9px; color:#4DC8F0; letter-spacing:0.5px; margin-bottom:3px; }
    .mem-hook { font-size:12px; color:#F0F0FF; line-height:1.4; margin-bottom:6px; font-weight:500; }
    .mem-meta { display:flex; align-items:center; gap:5px; flex-wrap:wrap; }
    .mem-cta { font-size:10px; color:rgba(77,200,240,0.7); background:rgba(77,200,240,0.08); border-radius:4px; padding:1px 6px; max-width:100px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .mem-score { font-size:9px; color:#3DD68C; font-family:'DM Mono',monospace; letter-spacing:-1px; }
    .mem-time { font-size:9px; color:rgba(144,144,187,0.4); margin-left:auto; }
  `;
  document.head.appendChild(style);
}

// ════════════════════════════════════════════════════════════════
// 主生成函式（加入記憶讀取）
// ════════════════════════════════════════════════════════════════
async function doGenerate() {
  if (!window.S.brandId) { alert('請先選擇品牌！'); return; }
  if (!window.S.prod)    { alert('請先選擇商品！'); return; }

  const brand = window.BRANDS.find(b => b.id === window.S.brandId);
  const sub   = brand?.subs.find(s => s.id === window.S.subId);
  const soul  = sub?.soul    || brand?.soul    || '';
  const style = sub?.adStyle || brand?.adStyle || '';
  const tags  = sub?.hashtags|| brand?.hashtags|| '';
  const aud   = document.getElementById('selAud').value;
  const count = parseInt(document.getElementById('selN').value) || 20;
  const brandDisplay = `${brand.name}${sub && sub.id !== brand.id ? ' › ' + sub.name : ''}`;

  const btn  = document.getElementById('genBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spin"></span>生成中';

  const prog      = document.getElementById('prog');
  const fill      = document.getElementById('progFill');
  const progPctEl = document.getElementById('progPct');
  prog.style.display = 'block';
  let progVal = 0;

  const progInterval = setInterval(() => {
    if (progVal >= 92) return;
    progVal = Math.min(92, progVal + (progVal < 30 ? 2.5 : progVal < 60 ? 1.2 : 0.5));
    fill.style.width = progVal + '%';
    if (progPctEl) progPctEl.textContent = Math.round(progVal) + '%';
  }, 300);

  const copyLength = document.getElementById('selCopyLength')?.value || 'medium';
  const copyLengthGuide = {
    short:  '核心段落2-4行，精煉有力',
    medium: '核心段落5-8行，清楚說明',
    long:   '核心段落10-15行，深度說服'
  }[copyLength];

  btn.innerHTML = '<span class="spin"></span>載入記憶...';
  await loadMemories(window.S.brandId, window.S.prod.id);

  const memoryContext = currentMemories.length > 0
    ? `\n━━━ 🧠 歷史記憶（已用過，新腳本必須完全不同方向）━━━\n` +
      currentMemories.slice(0, 5).map((m, i) =>
        `[記憶${i+1}] 方向:${m.hookMethod} 分數:${m.score}\n  Hook: ${m.hookScript}\n  CTA: ${m.ctaScript}`
      ).join('\n') + `\n❌ 禁止重複以上方向 ✅ 必須全新切入角度\n`
    : '';

  const prompt = `你是台灣頂尖FB廣告策略師，精通 Alex Hormozi 廣告矩陣。

【品牌】${brandDisplay}
【品牌靈魂】${soul}
【廣告風格】${style}
【商品】${window.S.prod.name}（${window.S.prod.tag}）
【目標受眾】${aud}
【Hashtag】${tags}
【文案規格】${copyLengthGuide}
${memoryContext}
━━━ ⚠️ 字數鐵則（違反不接受，生成前必須自我驗算）━━━
‣ hook.script：繁體中文字數【硬性上限 25 字】，只能 1 句話，禁止用句號切兩句
‣ cta.script：繁體中文字數【硬性上限 20 字】，只能 1 句話
‣ 計算規則：每個中文字算 1 字，英文單字整體算 1 字，標點符號不計入字數

生成「剛好 ${count} 組」，只回傳純 JSON：
{"combos":[{"id":"AD001","hook":{"method":"方向名稱","script":"鉤子文字≤25字","visual":"畫面建議"},"core":{"type":"廣告類型","script":"核心段落","solve":"解決什麼核心問題"},"cta":{"style":"CTA風格","script":"CTA文字≤20字"}}]}`;

  try {
    const res = await fetch(CF_WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'claude_generate', password: GAS_PASSWORD, prompt, max_tokens: 4000 })
    });
    fill.style.width = '80%';
    btn.innerHTML = '<span class="spin"></span>整理中...';
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || JSON.stringify(data));
    const raw    = data.text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(raw);
    window.S.scripts = parsed.combos || [];
    renderScripts(brandDisplay, sub?.color || brand?.navColor);

    const sb = document.getElementById('scriptBadge');
    if (sb) sb.textContent = window.S.scripts.length;

    const lenLabel = { short:'短文案', medium:'中文案', long:'長文案' }[copyLength];
    const tabBtn   = document.querySelector('[data-tab="scripts"]');
    if (tabBtn) tabBtn.innerHTML = `廣告文案 <span class="badge">${window.S.scripts.length}</span> <span style="font-size:8px;background:rgba(232,96,58,0.15);color:#E8603A;padding:1px 5px;border-radius:3px;">${lenLabel}</span>`;

    clearInterval(progInterval);
    fill.style.width = '100%';
    if (progPctEl) progPctEl.textContent = '✅';
    setTimeout(() => { prog.style.display = 'none'; if (progPctEl) progPctEl.textContent = ''; }, 800);

  } catch (e) {
    clearInterval(progInterval);
    prog.style.display = 'none';
    if (progPctEl) progPctEl.textContent = '';
    alert('生成失敗：' + e.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '⚡ 生成腳本';
  }
}

// ══ 渲染腳本卡片 ══
function renderScripts(brandDisplay, colorKey) {
  const sc = getColor(colorKey);
  const selPhotoName = window.S.selPhoto !== null ? window.S.photos[window.S.selPhoto]?.name : null;
  const selVideoName = window.S.selVideo !== null ? window.S.videos[window.S.selVideo]?.name : null;

  document.getElementById('scriptsOut').innerHTML =
    `<div id="memoryPanel"></div>` +
    `<div style="background:rgba(91,200,200,0.08);border:1px dashed rgba(91,200,200,0.3);border-radius:8px;padding:8px 12px;margin-bottom:10px;font-size:11px;color:var(--sky);line-height:1.8;">
      · 點「＋加入記憶學習區」讓 AI 記住這組文案方向，下次生成不重複<br>
      · 選中：${selPhotoName ? `<span style="color:var(--sky)">圖 ${selPhotoName}</span>` : '<span style="color:var(--t3)">未選</span>'}
      &nbsp;&nbsp;${selVideoName ? `<span style="color:var(--peach)">影 ${selVideoName}</span>` : '<span style="color:var(--t3)">未選</span>'}
    </div>` +
    window.S.scripts.map((s, i) => {
      const hookLen = countWords(s.hook?.script || '');
      const ctaLen  = countWords(s.cta?.script  || '');
      return `<div class="ad-card" style="animation-delay:${i * 18}ms">
        <div class="ac-top">
          <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0;">
            <span class="ac-id">${s.id}</span>
            <span class="ac-pill" style="background:${sc.bg};color:${sc.c};">${window.S.prod?.name}</span>
            <span style="font-size:9px;color:var(--t3);">${s.core?.type||''}</span>
          </div>
          <div class="ac-btns">
            <button class="tbtn tbtn-s" onclick="addDeliver(${i})">＋ 加入記憶學習區</button>
            <button class="tbtn" style="border-color:var(--purple);color:var(--purple);background:var(--purple2)" onclick="openAdMaker(${i})">廣告圖</button>
          </div>
        </div>
        <div class="ac-body">
          <div class="seg">
            <div class="seg-lbl" style="color:var(--sky)">· 黃金3秒鉤子</div>
            <div class="seg-txt" style="font-size:14px;font-weight:700;line-height:1.6;color:#F5F5F5;">${s.hook?.script||''}</div>
            <div style="display:flex;align-items:center;flex-wrap:wrap;gap:4px;margin-top:4px;">
              <span class="seg-badge" style="background:var(--sky2);color:var(--sky)">${s.hook?.method||''}</span>
              ${charBadge(hookLen, 25)}
            </div>
            <div class="seg-hint">· ${s.hook?.visual||''}</div>
          </div>
          <div class="seg">
            <div class="seg-lbl" style="color:var(--mint)">· 核心段落</div>
            <div class="seg-txt" style="white-space:pre-line">${s.core?.script||''}</div>
            <span class="seg-badge" style="background:var(--mint2);color:var(--mint)">${s.core?.type||''}</span>
            <div class="seg-hint">· ${s.core?.solve||''}</div>
          </div>
          <div class="seg">
            <div class="seg-lbl" style="color:var(--peach)">· 行動呼籲 CTA</div>
            <div class="seg-txt" style="font-size:14px;font-weight:700;line-height:1.6;color:#F5F5F5;">${s.cta?.script||''}</div>
            <div style="display:flex;align-items:center;flex-wrap:wrap;gap:4px;margin-top:4px;">
              <span class="seg-badge" style="background:var(--peach2);color:var(--peach)">${s.cta?.style||''}</span>
              ${charBadge(ctaLen, 20)}
            </div>
          </div>
        </div>
      </div>`;
    }).join('');

  renderMemoryPanel();
}

// ══ 複製單組腳本 ══
function copyOne(i, btn) {
  const s = window.S.scripts[i];
  const t = `【${s.id}】${window.S.prod?.name}\n鉤子 ${s.hook?.method}：${s.hook?.script}\n畫面：${s.hook?.visual}\n\n核心 ${s.core?.type}：\n${s.core?.script}\n解決：${s.core?.solve}\n\nCTA ${s.cta?.style}：${s.cta?.script}`;
  navigator.clipboard.writeText(t).then(() => { btn.textContent = '✅ 已複製'; setTimeout(() => btn.textContent = '複製腳本', 2000); });
}

// ══ 加入記憶學習區（存入前重新拉記憶防重複）══
async function addDeliver(scriptIdx) {
  const s = window.S.scripts[scriptIdx];
  const brand     = window.BRANDS.find(b => b.id === window.S.brandId);
  const sub       = brand?.subs.find(sb => sb.id === window.S.subId);
  const brandName = brand ? `${brand.name}${sub ? ' › ' + sub.name : ''}` : '';

  const btn = document.querySelector(`[onclick="addDeliver(${scriptIdx})"]`);
  if (btn) { btn.disabled = true; btn.textContent = '檢查中...'; }

  const result = await saveMemory(s, window.S.brandId, window.S.subId, brandName, window.S.prod?.name || '');

  if (btn) {
    if (result === 'duplicate') {
      btn.textContent = '⚠️ 已存在';
    } else if (result) {
      btn.textContent = '✅ 已存入記憶';
    } else {
      btn.textContent = '⚠️ 存入失敗';
    }
    setTimeout(() => { btn.textContent = '＋ 加入記憶學習區'; btn.disabled = false; }, 2000);
  }
}

// ══ 渲染交付列 ══
function renderDeliverRows() {
  const dzSub = document.getElementById('dzSub');
  if (dzSub) dzSub.textContent = window.S.delivers.length + ' 組素材';
  const db = document.getElementById('deliverBadge');
  if (db) db.textContent = window.S.delivers.length;
  const tbody = document.getElementById('deliverRows');
  if (!tbody) return;
  if (!window.S.delivers.length) {
    tbody.innerHTML = '<div style="text-align:center;padding:14px;font-size:10px;color:var(--t3);">尚無素材</div>';
    return;
  }
  tbody.innerHTML = window.S.delivers.map((r, i) => {
    const pLink = r.photoUrl ? `<a class="asset-link al-photo" href="${r.photoUrl}" target="_blank">圖</a>` : `<span class="asset-link al-none">圖</span>`;
    const vLink = r.videoUrl ? `<a class="asset-link al-video" href="${r.videoUrl}" target="_blank">影</a>` : `<span class="asset-link al-none">影</span>`;
    return `<div class="dr ${i === window.S.delivers.length - 1 ? 'new' : ''}">
      <span class="dr-id">${r.id}</span>
      <span class="dr-script" title="${r.hookScript}">${r.hookScript.slice(0, 16)}…</span>
      <span>${pLink}</span><span>${vLink}</span>
      <span class="dr-status ${r.ready ? 'ds-ready' : 'ds-missing'}">${r.ready ? '✅' : '⚠️'}</span>
    </div>`;
  }).join('');
}

// ══ 渲染交付詳細 ══
function renderDeliverOut() {
  const el = document.getElementById('deliverOut');
  if (!el) return;
  if (!window.S.delivers.length) {
    el.innerHTML = '<div class="empty"><div class="empty-p">加入交付後顯示</div></div>';
    return;
  }
  el.innerHTML = window.S.delivers.map((r, i) =>
    `<div style="background:var(--bg2);border:1px solid var(--line);border-radius:8px;padding:11px 13px;margin-bottom:8px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:7px;">
        <span style="font-family:'DM Mono';font-size:11px;color:var(--gold)">${r.id}</span>
        <span style="font-size:10px;color:var(--t3)">${r.product}</span>
        <button class="tbtn tbtn-g" onclick="removeDeliver(${i})" style="font-size:9px">移除</button>
      </div>
      <div style="font-size:11px;line-height:1.8;margin-bottom:8px;">
        <span style="color:var(--sky)">鉤子</span> ${r.hookScript}<br>
        <span style="color:var(--peach)">CTA</span> ${r.ctaScript}
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        ${r.photoUrl ? `<a href="${r.photoUrl}" target="_blank" class="asset-link al-photo">圖 ${r.photoName||'照片'}</a>` : '<span class="asset-link al-none">無照片</span>'}
        ${r.videoUrl ? `<a href="${r.videoUrl}" target="_blank" class="asset-link al-video">影 ${r.videoName||'影片'}</a>` : '<span class="asset-link al-none">無影片</span>'}
        <span class="dr-status ${r.ready ? 'ds-ready' : 'ds-missing'}">${r.ready ? '✅ 備妥' : '⚠️ 缺素材'}</span>
      </div>
    </div>`
  ).join('');
}

function removeDeliver(i) {
  window.S.delivers.splice(i, 1);
  renderDeliverRows();
  renderDeliverOut();
}

function clearAll() {
  if (window.S.delivers.length && confirm(`清空所有${window.S.delivers.length}組？`)) {
    window.S.delivers = [];
    renderDeliverRows();
    renderDeliverOut();
  }
}

function copyTSV(btn) {
  if (!window.S.delivers.length) { alert('尚無素材'); return; }
  const h    = ['編號','商品','黃金3秒','核心段落','CTA','照片檔名','照片連結','影片檔名','影片連結','狀態'];
  const rows = window.S.delivers.map(r =>
    [r.id, r.product, r.hookScript, r.coreScript, r.ctaScript, r.photoName, r.photoUrl, r.videoName, r.videoUrl, r.ready ? '備妥' : '缺素材'].join('\t')
  );
  navigator.clipboard.writeText([h.join('\t'), ...rows].join('\n')).then(() => {
    btn.textContent = '· 已複製！';
    setTimeout(() => btn.textContent = '複製全部 → 貼入 Google Sheet', 3000);
  });
}

// ★ 初始化記憶 CSS
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectMemoryCSS);
} else {
  injectMemoryCSS();
}
