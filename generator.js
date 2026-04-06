// ════════════════════════════════════════════════════════════════
// generator.js — Brand OS v6 文案生成 + 記憶功能
// 負責：生成腳本、記憶讀寫、TOP5 記憶顯示
// ════════════════════════════════════════════════════════════════

// ── 記憶模組 ──────────────────────────────────────────────────

let currentMemories = []; // 目前品牌+商品的記憶快取

/**
 * 從 GAS 讀取該品牌+商品的記憶
 * @param {string} brandId
 * @param {string} productId
 * @returns {Promise<Array>}
 */
async function loadMemories(brandId, productId) {
  try {
    const url = `${GAS_URL}?action=getMemory&password=${GAS_PASSWORD}&brandId=${encodeURIComponent(brandId)}&productId=${encodeURIComponent(productId)}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.ok) {
      currentMemories = data.memories || [];
    } else {
      currentMemories = [];
    }
  } catch (e) {
    console.warn('記憶載入失敗:', e);
    currentMemories = [];
  }
  return currentMemories;
}

/**
 * 把一組腳本存入記憶（點加入交付時呼叫）
 * @param {object} combo - 腳本物件 {id, hook, core, cta}
 * @param {object} brand - 品牌物件
 * @param {object} product - 商品物件
 */
async function saveMemory(combo, brand, product) {
  try {
    const payload = {
      brandId: brand.id,
      productId: product.id,
      brandName: brand.name + (brand.subName ? ' › ' + brand.subName : ''),
      productName: product.name,
      hookMethod: combo.hook?.method || '',
      hookScript: combo.hook?.script || '',
      coreType: combo.core?.type || '',
      ctaScript: combo.cta?.script || '',
      adId: combo.id || ''
    };

    const encoded = encodeURIComponent(JSON.stringify(payload));
    const url = `${GAS_URL}?action=addMemory&password=${GAS_PASSWORD}&data=${encoded}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.ok) {
      // 本地也加進快取
      currentMemories.unshift({
        ...payload,
        id: data.id,
        timestamp: data.timestamp,
        score: 1
      });
      if (currentMemories.length > 10) currentMemories = currentMemories.slice(0, 10);
      renderMemoryPanel(); // 更新顯示
      return true;
    }
  } catch (e) {
    console.warn('記憶儲存失敗:', e);
  }
  return false;
}

// ── 記憶面板渲染 ──────────────────────────────────────────────

/**
 * 在腳本區上方渲染 TOP5 記憶卡
 */
function renderMemoryPanel() {
  const container = document.getElementById('memoryPanel');
  if (!container) return;

  if (currentMemories.length === 0) {
    container.innerHTML = `
      <div class="mem-empty">
        <span class="mem-empty-icon">🧠</span>
        <span>尚無文案記憶，點「加入交付」後自動存入</span>
      </div>`;
    return;
  }

  const top5 = currentMemories.slice(0, 5);
  const scoreMax = Math.max(...top5.map(m => m.score || 1), 1);

  container.innerHTML = `
    <div class="mem-header">
      <span class="mem-title">🧠 文案記憶庫</span>
      <span class="mem-subtitle">TOP ${top5.length} 鉤子 — 幫 AI 產出不重複風格</span>
      <span class="mem-count">${currentMemories.length} 筆記憶</span>
    </div>
    <div class="mem-cards">
      ${top5.map((m, i) => {
        const scoreBar = Math.round((m.score / scoreMax) * 5);
        const bars = '█'.repeat(scoreBar) + '░'.repeat(5 - scoreBar);
        const timeAgo = getTimeAgo(m.timestamp);
        return `
          <div class="mem-card" style="--rank:${i + 1}">
            <div class="mem-rank">#${i + 1}</div>
            <div class="mem-body">
              <div class="mem-method">${m.hookMethod || '未分類'}</div>
              <div class="mem-hook">${m.hookScript}</div>
              <div class="mem-meta">
                <span class="mem-cta">${m.ctaScript}</span>
                <span class="mem-score" title="效益分數">${bars} ${m.score}</span>
                <span class="mem-time">${timeAgo}</span>
              </div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

/**
 * 時間轉「幾天前」
 */
function getTimeAgo(timestamp) {
  if (!timestamp) return '';
  const diff = Date.now() - new Date(timestamp).getTime();
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor(diff / 3600000);
  if (days > 30) return `${Math.floor(days / 30)}個月前`;
  if (days > 0) return `${days}天前`;
  if (hours > 0) return `${hours}小時前`;
  return '剛才';
}

// ── 記憶面板 CSS ──────────────────────────────────────────────

function injectMemoryCSS() {
  if (document.getElementById('memory-css')) return;
  const style = document.createElement('style');
  style.id = 'memory-css';
  style.textContent = `
    /* 記憶面板 */
    #memoryPanel {
      margin: 0 0 16px 0;
      background: linear-gradient(135deg, rgba(228,184,74,0.04) 0%, rgba(20,20,38,0.8) 100%);
      border: 1px solid rgba(228,184,74,0.15);
      border-radius: 12px;
      padding: 14px 16px;
      transition: all 0.3s;
    }
    #memoryPanel:empty { display: none; }

    .mem-empty {
      display: flex; align-items: center; gap: 8px;
      color: rgba(144,144,187,0.5); font-size: 12px;
    }
    .mem-empty-icon { font-size: 16px; opacity: 0.4; }

    .mem-header {
      display: flex; align-items: center; gap: 8px;
      margin-bottom: 12px; flex-wrap: wrap;
    }
    .mem-title {
      font-size: 12px; font-weight: 700; color: #E4B84A;
      letter-spacing: 0.5px;
    }
    .mem-subtitle {
      font-size: 10px; color: rgba(144,144,187,0.6);
      flex: 1;
    }
    .mem-count {
      font-size: 10px; background: rgba(228,184,74,0.1);
      color: #E4B84A; border: 1px solid rgba(228,184,74,0.2);
      border-radius: 20px; padding: 2px 8px;
    }

    .mem-cards {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 8px;
    }

    .mem-card {
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 8px;
      padding: 10px 12px;
      position: relative;
      transition: all 0.2s;
      cursor: default;
    }
    .mem-card:hover {
      border-color: rgba(228,184,74,0.25);
      background: rgba(228,184,74,0.04);
      transform: translateY(-1px);
    }
    .mem-card[style*="--rank:1"] { border-color: rgba(228,184,74,0.3); }
    .mem-card[style*="--rank:2"] { border-color: rgba(192,192,192,0.2); }

    .mem-rank {
      position: absolute; top: 8px; right: 10px;
      font-size: 9px; color: rgba(228,184,74,0.4);
      font-weight: 700;
    }

    .mem-method {
      font-size: 9px; color: #4DC8F0;
      text-transform: uppercase; letter-spacing: 0.5px;
      margin-bottom: 4px;
    }

    .mem-hook {
      font-size: 12px; color: #F0F0FF;
      line-height: 1.4; margin-bottom: 8px;
      font-weight: 500;
    }

    .mem-meta {
      display: flex; align-items: center; gap: 6px;
      flex-wrap: wrap;
    }
    .mem-cta {
      font-size: 10px; color: rgba(77,200,240,0.7);
      background: rgba(77,200,240,0.08);
      border-radius: 4px; padding: 1px 6px;
      white-space: nowrap; overflow: hidden;
      text-overflow: ellipsis; max-width: 100px;
    }
    .mem-score {
      font-size: 9px; color: #3DD68C;
      font-family: 'DM Mono', monospace;
      letter-spacing: -1px;
    }
    .mem-time {
      font-size: 9px; color: rgba(144,144,187,0.4);
      margin-left: auto;
    }

    /* 加入交付按鈕：成功動畫 */
    .deliver-btn.saved {
      background: rgba(61,214,140,0.15) !important;
      border-color: #3DD68C !important;
      color: #3DD68C !important;
    }
    .deliver-btn.saved::before {
      content: '✅ ';
    }
  `;
  document.head.appendChild(style);
}

// ── 生成腳本（整合記憶）──────────────────────────────────────

/**
 * 主要生成函式（替換原本的 doGenerate）
 * 在 prompt 中帶入記憶，讓 AI 產出不重複風格
 */
async function doGenerate() {
  if (!S.brandId) { alert('請先選擇品牌！'); return; }
  if (!S.prod) { alert('請先選擇商品！'); return; }

  const brand = BRANDS.find(b => b.id === S.brandId);
  const sub = brand?.subs?.find(s => s.id === S.subId);
  const soul = sub?.soul || brand?.soul || '';
  const style = sub?.adStyle || brand?.adStyle || '';
  const tags = sub?.hashtags || brand?.hashtags || '';
  const aud = document.getElementById('selAud')?.value || '25-44歲女性';
  const count = parseInt(document.getElementById('selN')?.value) || 20;
  const copyLength = document.getElementById('selCopyLength')?.value || 'medium';
  const brandDisplay = `${brand.name}${sub && sub.id !== brand.id ? ' › ' + sub.name : ''}`;

  const btn = document.getElementById('genBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spin"></span>生成中';

  const prog = document.getElementById('prog');
  const fill = document.getElementById('progFill');
  const progPctEl = document.getElementById('progPct');
  prog.style.display = 'block';

  let progVal = 0;
  const progInterval = setInterval(() => {
    if (progVal >= 85) return;
    progVal = Math.min(85, progVal + (progVal < 30 ? 2.5 : progVal < 60 ? 1.2 : 0.5));
    fill.style.width = progVal + '%';
    if (progPctEl) progPctEl.textContent = Math.round(progVal) + '%';
  }, 300);

  // ① 先讀取記憶
  btn.innerHTML = '<span class="spin"></span>載入記憶...';
  await loadMemories(S.brandId, S.prod.id);
  renderMemoryPanel();
  fill.style.width = '15%';

  // ② 組裝記憶提示詞
  const memoryContext = currentMemories.length > 0
    ? `
━━━ 🧠 歷史記憶（已驗證有效的鉤子，請勿重複，要超越）━━━
以下是這個品牌/商品過去使用過的優質鉤子，分數越高代表效果越好。
新腳本的鉤子方向必須與以下所有記憶【完全不同】，要有全新角度：

${currentMemories.slice(0, 5).map((m, i) =>
  `[記憶${i + 1}] 方向:${m.hookMethod} | 分數:${m.score}
  Hook: ${m.hookScript}
  CTA: ${m.ctaScript}`
).join('\n')}

❌ 禁止：重複上面任何一個鉤子方向或相似說法
✅ 要求：在上述基礎上突破，找出全新的切入角度`
    : '（尚無歷史記憶，這是品牌首批廣告，自由發揮）';

  const copyLengthGuide = {
    short: '核心段落2-4行，精煉有力',
    medium: '核心段落5-8行，清楚說明',
    long: '核心段落10-15行，深度說服'
  }[copyLength];

  const prompt = `你是台灣頂尖FB廣告策略師，精通 Alex Hormozi 廣告矩陣。

【品牌】${brandDisplay}
【品牌靈魂】${soul}
【廣告風格】${style}
【商品】${S.prod.name}（${S.prod.tag || ''}）
【目標受眾】${aud}
【Hashtag】${tags}
【文案規格】${copyLengthGuide}

${memoryContext}

━━━ ⚠️ 字數鐵則（違反不接受）━━━
‣ hook.script：繁體中文字數【硬性上限 25 字】，只能 1 句話
‣ cta.script：繁體中文字數【硬性上限 20 字】，只能 1 句話
‣ core.script：按照 ${copyLengthGuide} 規格即可

━━━ HORMOZI 三段式廣告框架 ━━━

1. 【黃金3秒鉤子 hook】
   - 目的：讓人停止滑動，在3秒內被抓住
   - 方向：痛點洞察、好奇心、衝突感、數字震撼、反直覺陳述
   - 長度：≤ 25 字，1 句話
   - ❌ 禁止：冗長、解釋性語句、與歷史記憶重複

2. 【核心價值段落 core】
   - 目的：說清楚商品「為什麼能幫你解決問題」
   - 內容：產品利益 + 社會證明/故事/數據 + 情感共鳴
   - 長度：${copyLengthGuide}
   - 類型：產品展示型 / 客戶見證型 / 教育型 / 故事型 / 純素材型

3. 【行動呼籲 CTA】
   - 目的：驅動立即行動
   - 方向：限時優惠、稀缺性、簡單指令、問句引導
   - 長度：≤ 20 字，1 句話

━━━ 輸出規則 ━━━
- 生成剛好 ${count} 組，combos 陣列必須剛好 ${count} 個
- 繁體中文台灣用語，每組風格截然不同
- 只回傳純 JSON，不加任何說明文字：

{"combos":[{"id":"AD001","hook":{"method":"方向名稱（痛點洞察/好奇心/數字震撼/反直覺/衝突感）","script":"鉤子文字≤25字","visual":"畫面建議"},"core":{"type":"廣告類型","script":"核心段落完整文字","solve":"解決什麼問題"},"cta":{"style":"CTA風格","script":"CTA文字≤20字"}}]}`;

  try {
    fill.style.width = '40%';
    btn.innerHTML = '<span class="spin"></span>AI生成中...';

    const res = await fetch(CF_WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'claude_generate', password: GAS_PASSWORD, prompt })
    });

    fill.style.width = '80%';
    btn.innerHTML = '<span class="spin"></span>整理中...';

    const data = await res.json();
    if (!data.ok) throw new Error(data.error || JSON.stringify(data));

    const raw = data.text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(raw);
    S.scripts = parsed.combos || [];

    const brandColor = sub?.color || brand?.navColor;
    renderScripts(brandDisplay, brandColor);

    // 更新 badge
    const sb = document.getElementById('scriptBadge');
    if (sb) sb.textContent = S.scripts.length;

    const lenLabel = { short: '短文案', medium: '中文案', long: '長文案' }[copyLength];
    const tabBtn = document.querySelector('[data-tab="scripts"]');
    if (tabBtn) tabBtn.innerHTML = `• 廣告腳本 <span class="badge">${S.scripts.length}</span> <span style="font-size:8px;background:rgba(232,96,58,0.15);color:#E8603A;padding:1px 5px;border-radius:3px;">${lenLabel}</span>`;

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

// ── 加入交付（整合記憶儲存）──────────────────────────────────

/**
 * 加入交付 + 自動存入記憶
 * @param {object} combo - 要加入的腳本物件
 * @param {HTMLElement} btnEl - 按鈕元素（用於動畫）
 */
async function addToDeliverWithMemory(combo, btnEl) {
  const brand = BRANDS.find(b => b.id === S.brandId);
  const sub = brand?.subs?.find(s => s.id === S.subId);
  const product = S.prod;

  if (!brand || !product) return;

  // 原本的加入交付邏輯
  addToDeliver(combo); // 呼叫原有函式

  // 存入記憶
  if (btnEl) {
    btnEl.disabled = true;
    btnEl.textContent = '存入記憶中...';
  }

  const brandForMemory = sub ? { ...brand, id: sub.id || brand.id, name: brand.name, subName: sub.name } : brand;
  const saved = await saveMemory(combo, brandForMemory, product);

  if (btnEl) {
    btnEl.disabled = false;
    if (saved) {
      btnEl.classList.add('saved');
      btnEl.textContent = '已加入交付';
      setTimeout(() => {
        btnEl.classList.remove('saved');
        btnEl.textContent = '+ 加入交付';
      }, 2000);
    } else {
      btnEl.textContent = '+ 加入交付';
    }
  }
}

// ── 初始化 ────────────────────────────────────────────────────

// 注入 CSS（在 DOMContentLoaded 時呼叫）
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectMemoryCSS);
} else {
  injectMemoryCSS();
}
