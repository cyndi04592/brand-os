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
  const s = str.replace(/[，。！？、；：「」『』【】〔〕…—·\s]/g, ' ');   // 換成空白(以前直接刪掉 → 英文單字黏在一起,整句算成 1 個字)
  //  🌐 2026-11-08 日文假名(ひらがな/カタカナ)也一個字算一字
  const zhChars = (s.match(/[\u4e00-\u9fff\u3400-\u4dbf\u3040-\u30ff]/g) || []).length;
  const enWords = (s.replace(/[\u4e00-\u9fff\u3400-\u4dbf\u3040-\u30ff]/g, ' ').match(/[a-zA-Z0-9]+/g) || []).length;
  return zhChars + enWords;
}

function charBadge(len, limit) {
  const over  = len > limit;
  const color = over ? '#FF4D6A' : '#7ED4B0';
  const icon  = over ? '⚠️ 超字數！' : '✅';
  const unit  = (window.S && window.S.copyLang === 'en') ? ' words' : '字';
  return `<span style="font-size:10px;font-weight:900;color:${color};font-family:'DM Mono';margin-left:6px;">${len}${unit} ${icon}</span>`;
}

// ══ 🌐 2026-11-08 文案語言(RA:日本客人用,文案卻都是中文很奇怪)══
//   客人在「文案長度」旁邊選:繁體中文 / 日本語 / English。
//   預設跟著介面語言(中文介面→繁中、日文→日文、英文→英文),客人改過就記住。
//   ★ 繁體中文那條提示詞跟以前一字不差,中文客人完全不受影響。
//   字數上限各語言各自一套(日文假名比中文長、英文算單字)。
const COPY_LANG = {
  zh: { label: '繁體中文', hook: 25, cta: 20 },
  ja: { label: '日本語',   hook: 32, cta: 25 },
  en: { label: 'English',  hook: 12, cta: 8  },
};
//  🌐 2026-11-08 RA:客人進駐書(品牌/商品資料)是日文就產日文、英文就產英文
//   順序:① 客人在這個品牌手動選過的 → ② 看品牌/商品資料是什麼語言 → ③ 介面語言 → ④ 中文
function _copyLangKey() { return 'bos_copy_lang:' + (window.S?.brandId || ''); }
function detectBrandLang() {
  const S = window.S || {};
  const brand = (window.BRANDS || []).find(b => b.id === S.brandId);
  if (!brand) return '';
  const sub = brand.subs?.find(x => x.id === S.subId);
  const txt = [brand.name, brand.soul, brand.adStyle, brand.hashtags, sub?.name, sub?.soul, sub?.adStyle,
               S.prod?.name, S.prod?.tag, S.prod?.spec, S.prod?.feature].filter(Boolean).join(' ');
  const kana  = (txt.match(/[\u3040-\u30ff]/g) || []).length;
  const han   = (txt.match(/[\u3400-\u9fff]/g) || []).length;
  const words = (txt.match(/[A-Za-z]{2,}/g) || []).length;
  if (kana >= 3 && kana >= han * 0.15) return 'ja';   // 有假名 → 日文(日文漢字多,假名比例抓 15%)
  if (words >= 3 && words * 2 >= han) return 'en';     // 英文為主(品牌名、系列名夾幾個中文字也算英文;1 個英文字 ≈ 2 個中文字)
  if (han >= 3) return 'zh';
  return '';
}
function getCopyLang() {
  let v = '';
  try { if (window.S?.brandId) v = localStorage.getItem(_copyLangKey()) || ''; } catch (_) {}
  if (COPY_LANG[v]) return v;
  v = detectBrandLang();
  if (COPY_LANG[v]) return v;
  return COPY_LANG[window.BOS_LANG] ? window.BOS_LANG : 'zh';
}
function syncCopyLangSelect() {
  const el = document.getElementById('selCopyLang');
  if (el) el.value = getCopyLang();
}
function injectCopyLangSelect() {
  if (document.getElementById('selCopyLang')) return;
  const len = document.getElementById('selCopyLength');
  const box = len && len.parentElement;
  if (!box || !box.parentElement) return;
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;gap:3px;';
  const cur = getCopyLang();
  wrap.innerHTML = '<div class="sel-lbl">文案語言</div>' +
    '<select class="sel" id="selCopyLang" style="width:96px" data-i18n-skip>' +
    Object.keys(COPY_LANG).map(k => `<option value="${k}"${k === cur ? ' selected' : ''}>${COPY_LANG[k].label}</option>`).join('') +
    '</select>';
  box.parentElement.insertBefore(wrap, box.nextSibling);
  //  手動選 = 只記在這個品牌(換品牌會回到自動判斷)
  wrap.querySelector('select').addEventListener('change', function () {
    try { if (window.S?.brandId) localStorage.setItem(_copyLangKey(), this.value); } catch (_) {}
  });
  //  點品牌/系列/商品後(brands.js 會呼叫 updateCtx)→ 選單跟著換成這個品牌的語言
  if (typeof window.updateCtx === 'function' && !window.updateCtx._copyLang) {
    const _orig = window.updateCtx;
    window.updateCtx = function () { const r = _orig.apply(this, arguments); try { syncCopyLangSelect(); } catch (_) {} return r; };
    window.updateCtx._copyLang = true;
  }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injectCopyLangSelect);
else injectCopyLangSelect();

// ════════════════════════════════════════════════════════════════
// ★ 記憶模組
// ════════════════════════════════════════════════════════════════

let currentMemories = [];

async function loadMemories(brandId, productId) {
  try {
    let data = (typeof authCachedGet === 'function') ? await authCachedGet('getMemory', { brandId, productId }) : null;
    if (!data) {
      const url  = `${GAS_URL}?action=getMemory&password=${GAS_PASSWORD}&brandId=${encodeURIComponent(brandId)}&productId=${encodeURIComponent(productId)}`;
      const res  = await fetch(url);
      data = await res.json();
    }
    currentMemories = data.ok ? (data.memories || []) : [];
  } catch (e) {
    console.warn('記憶載入失敗:', e);
    currentMemories = [];
  }
  return currentMemories;
}

// 🧠 2026-11-03 物理記憶比對:鉤子跟記憶(或同批前面的)太像 → 拿掉;不夠 count 組時,拿最不像的補回
function _memNorm(s) { return String(s || '').replace(/[\s\p{P}\p{S}]/gu, '').toLowerCase(); }
function _memSim(a, b) {   // 兩兩字組(bigram)重疊率:0 = 完全不同,1 = 一模一樣
  a = _memNorm(a); b = _memNorm(b);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const g = s => { const m = new Map(); for (let i = 0; i < s.length - 1; i++) { const k = s.slice(i, i + 2); m.set(k, (m.get(k) || 0) + 1); } return m; };
  const A = g(a), B = g(b); let hit = 0, na = 0, nb = 0;
  A.forEach(v => { na += v; }); B.forEach(v => { nb += v; });
  A.forEach((v, k) => { if (B.has(k)) hit += Math.min(v, B.get(k)); });
  return (na + nb) ? (2 * hit) / (na + nb) : 0;
}
// 🧠 2026-11-04 改比「意思」(Worker memory_check,Cloudflare 語意模型):「我今天吃一碗飯」跟「你昨天喝兩碗湯」字不同但同一個梗
//   Worker 回每組鉤子跟記憶最像多少(worst)+ 同一批彼此多像(pair)+ 門檻(limit);Worker 連不上 → 退回在這裡比字
async function _memScores(hooks, past) {
  try {
    const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 8000);
    const r = await fetch(CF_WORKER_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctl.signal,
      body: JSON.stringify({ action: 'memory_check', password: GAS_PASSWORD, items: hooks, past: past }) });
    clearTimeout(tm);
    const d = await r.json();
    if (d && d.ok && Array.isArray(d.worst) && d.worst.length === hooks.length) return d;
  } catch (e) {}
  return { mode: 'chars', limit: 0.5,
    worst: hooks.map(h => past.reduce((m, p) => Math.max(m, _memSim(h, p)), 0)),
    pair: hooks.map(x => hooks.map(y => _memSim(x, y))) };
}
async function _memFilter(combos, count) {
  combos = combos || [];
  const past = (currentMemories || []).map(m => m.hookScript).filter(Boolean);
  const hooks = combos.map(c => String((c && c.hook && c.hook.script) || ''));
  let sc = null;
  if (combos.length) sc = await _memScores(hooks, past);
  const MAX = (sc && sc.limit) || 0.5;
  const keep = [], drop = [];
  combos.forEach((c, i) => {
    const worst = (sc && sc.worst && past.length) ? sc.worst[i] : 0;
    const dupBatch = keep.some(k => sc && sc.pair && sc.pair[i] && sc.pair[i][k.i] > MAX);
    (worst > MAX || dupBatch ? drop : keep).push({ c, i, worst });
  });
  drop.sort((a, b) => a.worst - b.worst);
  while (keep.length < count && drop.length) keep.push(drop.shift());   // 不夠就拿最不像的補,絕不給空白
  const out = keep.slice(0, count).map(x => x.c);
  out.forEach((c, i) => { c.id = 'AD' + String(i + 1).padStart(3, '0'); });
  console.log('[記憶] ' + ((sc && sc.mode) || '-') + ' 比對 ' + past.length + ' 筆記憶,' + combos.length + ' 組裡拿掉 ' + Math.max(0, combos.length - out.length) + ' 組太像的');
  return out;
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
    // 🔀 2026-08-06 第4批:記憶庫寫入改走 Worker(D1 正本 + 背景補寫 GAS)
    //   好處:① 存完立刻生效 ② GAS 抽風時照樣存得進去
    //   Worker 掛掉才落回原本直打 GAS,行為不變。
    let data;
    try {
      const wr = await fetch('https://kol-proxy.calm-sunset-6b66.workers.dev', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: GAS_PASSWORD, action: 'gas_write',
                               gasAction: 'addMemory', payload: { data: payload } })
      });
      data = await wr.json();
    } catch (_) { data = null; }
    if (!data || data.ok !== true) {
      const res = await fetch(GAS_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'text/plain' },
        body:    JSON.stringify(payload)
      });
      data = await res.json();
    }
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
// ══ 🩹 2026-11-06 文案 JSON 修復(RA 實測 MOZ 德訓鞋連生 3 次都失敗、每次照扣 120 點)══
//   病:AI 在文案裡用了英文雙引號 "(例:她說"好穿")沒有跳脫 → JSON.parse 在第 5376 字爆掉
//       → 跳「生成失敗」,但 AI 已經寫完、點數已經扣了。
//   修:先照常 parse;失敗才逐字掃一次:在字串裡遇到 " ,如果後面接的不是 , } ] : 這種結構符號,
//       它就是文案裡的引號 → 換成「」的樣子,其他一個字不動。再失敗才報錯(行為跟以前一樣)。
function _safeJsonParse(raw) {
  try { return JSON.parse(raw); } catch (e1) {
    let out = '', inStr = false, open = true;
    for (let i = 0; i < raw.length; i++) {
      const c = raw[i];
      if (inStr && c === '\\') { out += c + (raw[i + 1] || ''); i++; continue; }
      if (c === '"') {
        if (!inStr) { inStr = true; out += c; continue; }
        let j = i + 1; while (j < raw.length && /\s/.test(raw[j])) j++;
        const nx = raw[j];
        if (nx === undefined || nx === ',' || nx === '}' || nx === ']' || nx === ':') { inStr = false; out += c; continue; }
        out += open ? '「' : '」'; open = !open; continue;
      }
      if (inStr && (c === '\n' || c === '\r')) { out += '\\n'; continue; }
      out += c;
    }
    try { const r = JSON.parse(out); console.log('[文案] 🩹 JSON 修好了(文案裡的引號換成「」)'); return r; }
    catch (e2) {
      //  ✂️ 被截斷(RA 2026-11-06 實測:20 組中等文案寫到第 12 組就被字數上限切斷,5362 字停在半句)
      //   → 只留「已經寫完整的那幾組」,不要整批丟掉(點數已經扣了)
      const cut = _cutToLastCombo(out);
      if (cut) { try { const r = JSON.parse(cut); console.log('[文案] ✂️ 回應被截斷,保留寫完的 ' + ((r.combos || []).length) + ' 組'); return r; } catch (e3) {} }
      throw e1;
    }
  }
}

//  找 combos 陣列裡最後一個「完整收尾」的物件,截到那裡再補上 ]} 收尾
function _cutToLastCombo(txt) {
  const k = txt.indexOf('"combos"'); if (k < 0) return '';
  const a = txt.indexOf('[', k); if (a < 0) return '';
  let depth = 0, inStr = false, last = -1;
  for (let i = a + 1; i < txt.length; i++) {
    const c = txt[i];
    if (inStr) { if (c === '\\') { i++; continue; } if (c === '"') inStr = false; continue; }
    if (c === '"') { inStr = true; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) last = i; }
    else if (c === ']' && depth === 0) break;
  }
  return last > 0 ? txt.slice(0, last + 1) + ']}' : '';
}

async function doGenerate() {
  if (!window.S.brandId) { alert('請先選擇品牌！'); return; }
  if (!window.S.prod)    { alert('請先選擇商品！'); return; }

  const brand = window.BRANDS.find(b => b.id === window.S.brandId);
  const sub   = brand?.subs.find(s => s.id === window.S.subId);
  const soul  = sub?.soul    || brand?.soul    || '';
  const style = sub?.adStyle || brand?.adStyle || '';
  const tags  = sub?.hashtags|| brand?.hashtags|| '';
  const aud   = document.getElementById('selAud').value;
  const count = Math.min(5, parseInt(document.getElementById('selN').value) || 5);   // ✂️ 2026-11-06 RA:最多 5 組
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

  // 🧠 2026-11-03 記憶改成「物理記憶」(RA:不要把舊文案塞進提示詞叫 AI 別重複,那很白癡)
  //   舊做法:最近 5 筆記憶貼進提示詞 +「禁止重複以上方向」→ 佔字數、AI 反而照抄字句、也沒人檢查有沒有避開。
  //   新做法:提示詞完全不提記憶;有記憶時多要 3 組,生成完由程式逐組比對鉤子,太像的直接拿掉。
  //   ★ 不會多扣點:還是一次生成,只是多要幾組來挑。
  const _extra = currentMemories.length > 0 ? Math.min(3, Math.max(1, Math.round(count * 0.15))) : 0;
  const _ask = count + _extra;

  // 🧾 2026-10-18 商品資料(RA:文案常把「UC-856A」這種型號寫出來,但 iPhone 8 Plus、RTX 5080 Ti 這種客人會搜的型號又要寫)
  //   ① 商品名照原樣給(拆字會拆壞名字),只在偵測到型號時多給一行,寫不寫交給 AI 依品類判斷
  //   ② 商品規格 / 特色帶進來(去價格、200 字內)—— 以前文案完全看不到規格
  const _CODE_RE = /\b[A-Z]{1,5}-\d{2,6}[A-Z]{0,3}\b|\b[A-Z]{2,5}\s?\d{3,6}[A-Z]{0,3}\b/g;
  const _pn = String(window.S.prod.name || '');
  const _codes = _pn.match(_CODE_RE) || [];
  //  🔤 2026-10-19 英文系列名(RA 實測:巧福「Twin-Heating Pro 溫感雙癒按摩器」→ 文案照抄英文名)
  //   中文商品名裡夾的英文字,跟型號一樣交給 AI 判斷;品牌 / 子品牌名本身(巧福、Golden Fox)不算
  const _brandTxt = String(brandDisplay || '').toLowerCase();
  const _enNames = /[\u4e00-\u9fff]/.test(_pn)
    ? (_pn.replace(_CODE_RE, '|').match(/[A-Za-z][A-Za-z\-']*(?:\s+[A-Za-z][A-Za-z\-']*)*/g) || [])
        .map(t => t.trim()).filter(t => t.length >= 3 && _brandTxt.indexOf(t.toLowerCase()) === -1)
    : [];
  const _marks = _codes.concat(_enNames);
  const _noPrice = (t) => String(t || '')
    .replace(/(售價|價格|定價|特價|原價)?\s*(約|大約)?\s*((NT|HK|US)?\$|HKD|NTD)\s*[\d,]+(\.\d+)?(\s*\/\s*\S{1,2})?/gi, '')
    .replace(/(售價|價格|定價|特價|原價)?\s*[\d,]+\s*元(\s*\/\s*\S{1,2})?/g, '')
    .replace(/\s+/g, ' ').trim();
  const _facts = [_noPrice(window.S.prod.spec), _noPrice(window.S.prod.feature)].filter(Boolean).join('；').slice(0, 200);

  injectCopyLangSelect();
  const _lang = (document.getElementById('selCopyLang') || {}).value || getCopyLang();
  const _L = COPY_LANG[_lang];
  const _intro = {
    zh: '你是台灣頂尖FB廣告策略師，精通 Alex Hormozi 廣告矩陣。',
    ja: '你是日本頂尖的 Meta(FB/IG)廣告策略師,精通 Alex Hormozi 廣告矩陣,熟悉日本消費者的語感與廣告用語。',
    en: '你是美國頂尖的 Meta(FB/IG)廣告策略師,精通 Alex Hormozi 廣告矩陣,熟悉美國消費者的語感與廣告用語。',
  }[_lang];
  const _rules = _lang === 'zh' ? `‣ hook.script：繁體中文字數【硬性上限 25 字】，只能 1 句話，禁止用句號切兩句
‣ cta.script：繁體中文字數【硬性上限 20 字】，只能 1 句話
‣ 計算規則：每個中文字算 1 字，英文單字整體算 1 字，標點符號不計入字數` : _lang === 'ja' ? `‣ 語言:所有欄位(method、script、visual、type、solve、style)一律用自然的日文書寫,讀起來像日本廣告公司寫的原生文案
‣ hook.script：日文【上限 ${_L.hook} 字】(漢字、平假名、片假名各算 1 字),1 句話
‣ cta.script：日文【上限 ${_L.cta} 字】,1 句話
‣ 品牌名、商品名照原樣保留;Hashtag 改成日本人會搜尋的日文 hashtag` : `‣ Language: write every field (method, script, visual, type, solve, style) in natural American English, like native copy from a US agency
‣ hook.script: max ${_L.hook} words, one sentence
‣ cta.script: max ${_L.cta} words, one sentence
‣ Keep brand and product names exactly as given; turn hashtags into English hashtags people in the US search for`;
  const prompt = `${_intro}

【品牌】${brandDisplay}
【品牌靈魂】${soul}
【廣告風格】${style}
【商品】${window.S.prod.name}（${window.S.prod.tag}）
${_marks.length ? `【型號】商品名裡的「${_marks.join('、')}」是型號或英文系列名 —— 消費者會拿來搜尋、比較的商品(例:手機、顯示卡、電腦、機械設備)就寫進文案;一般家電、食品、生活用品,文案只用中文品名稱呼\n` : ''}${_facts ? `【商品事實】${_facts}(文案裡的規格、數字以這裡為準)\n` : ''}【目標受眾】${aud}
【Hashtag】${tags}
【文案規格】${copyLengthGuide}
━━━ ⚠️ 字數鐵則（違反不接受，生成前必須自我驗算）━━━
${_rules}

生成「剛好 ${_ask} 組」，只回傳純 JSON（文案內容裡要用引號一律用「」，不可用英文雙引號）：
{"combos":[{"id":"AD001","hook":{"method":"方向名稱","script":"鉤子文字≤${_L.hook}${_lang === 'en' ? ' words' : '字'}","visual":"畫面建議"},"core":{"type":"廣告類型","script":"核心段落","solve":"解決什麼核心問題"},"cta":{"style":"CTA風格","script":"CTA文字≤${_L.cta}${_lang === 'en' ? ' words' : '字'}"}}]}`;

  try {
    const res = await fetch(CF_WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'claude_generate', password: GAS_PASSWORD, prompt, max_tokens: 8000, email: (localStorage.getItem('bs_sso_email') || '') })
    });
    fill.style.width = '80%';
    btn.innerHTML = '<span class="spin"></span>整理中...';
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || JSON.stringify(data));
    let raw = data.text.replace(/```json|```/g, '').trim();
    // 🆕 模型偶爾會在 JSON 前後多講說明(例:「我先進行字數驗算:」)→ 只抽第一個 { 到最後一個 } 再 parse
    const _s = raw.indexOf('{'), _e = raw.lastIndexOf('}');
    if (_s >= 0 && _e > _s) raw = raw.slice(_s, _e + 1);
    const parsed = _safeJsonParse(raw);
    btn.innerHTML = '<span class="spin"></span>比對記憶...';
    window.S.scripts = await _memFilter(parsed.combos || [], count);
    window.S.copyLang = _lang;
    renderScripts(brandDisplay, sub?.color || brand?.navColor);

    const sb = document.getElementById('scriptBadge');
    if (sb) sb.textContent = window.S.scripts.length;

    const lenLabel = { short:'短文案', medium:'中文案', long:'長文案' }[copyLength];
    const tabBtn   = document.querySelector('[data-tab="scripts"]');
    if (tabBtn) tabBtn.innerHTML = `廣告文案 <span class="badge">${window.S.scripts.length}</span> <span style="font-size:8px;background:rgba(232,96,58,0.15);color:#E8603A;padding:1px 5px;border-radius:3px;">${lenLabel}</span>`;

    clearInterval(progInterval);
    fill.style.width = '100%';
    if (progPctEl) progPctEl.textContent = '✅';
    // 🆕 樂觀更新:生成成功=已扣 120,先讓 header 數字立刻跳(refreshBits 隨後對帳)
    bumpBitsDisplay(-120);
    setTimeout(() => { prog.style.display = 'none'; if (progPctEl) progPctEl.textContent = ''; }, 800);

  } catch (e) {
    clearInterval(progInterval);
    prog.style.display = 'none';
    if (progPctEl) progPctEl.textContent = '';
    if (String(e.message).includes('INSUFFICIENT_BITS')) {
      alert('⚡ Bits 不足，無法生成。請儲值或聯繫管理員。');
    } else {
      alert('生成失敗：' + e.message);
    }
  } finally {
    btn.disabled = false;
    btn.innerHTML = '⚡ 生成文案';
    refreshBits();
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
      const _lim = COPY_LANG[window.S.copyLang] || COPY_LANG.zh;
      return `<div class="ad-card" style="animation-delay:${i * 18}ms">
        <div class="ac-top">
          <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0;">
            <span class="ac-id">${s.id}</span>
            <span class="ac-pill" data-i18n-skip style="background:${sc.bg};color:${sc.c};">${window.S.prod?.name}</span>
            <span data-i18n-skip style="font-size:9px;color:var(--t3);">${s.core?.type||''}</span>
          </div>
          <div class="ac-btns">
            <button class="tbtn tbtn-s" onclick="addDeliver(${i})">＋ 加入記憶學習區</button>
            <button class="tbtn" style="border-color:var(--purple);color:var(--purple);background:var(--purple2)" onclick="openAdMaker(${i})">廣告圖</button>
          </div>
        </div>
        <div class="ac-body">
          <div class="seg">
            <div class="seg-lbl" style="color:var(--sky)">· 黃金3秒鉤子</div>
            <div class="seg-txt" data-i18n-skip style="font-size:14px;font-weight:700;line-height:1.6;color:#F5F5F5;">${s.hook?.script||''}</div>
            <div style="display:flex;align-items:center;flex-wrap:wrap;gap:4px;margin-top:4px;">
              <span class="seg-badge" data-i18n-skip style="background:var(--sky2);color:var(--sky)">${s.hook?.method||''}</span>
              ${charBadge(hookLen, _lim.hook)}
            </div>
            <div class="seg-hint" data-i18n-skip>· ${s.hook?.visual||''}</div>
          </div>
          <div class="seg">
            <div class="seg-lbl" style="color:var(--mint)">· 核心段落</div>
            <div class="seg-txt" data-i18n-skip style="white-space:pre-line">${s.core?.script||''}</div>
            <span class="seg-badge" data-i18n-skip style="background:var(--mint2);color:var(--mint)">${s.core?.type||''}</span>
            <div class="seg-hint" data-i18n-skip>· ${s.core?.solve||''}</div>
          </div>
          <div class="seg">
            <div class="seg-lbl" style="color:var(--peach)">· 行動呼籲 CTA</div>
            <div class="seg-txt" data-i18n-skip style="font-size:14px;font-weight:700;line-height:1.6;color:#F5F5F5;">${s.cta?.script||''}</div>
            <div style="display:flex;align-items:center;flex-wrap:wrap;gap:4px;margin-top:4px;">
              <span class="seg-badge" data-i18n-skip style="background:var(--peach2);color:var(--peach)">${s.cta?.style||''}</span>
              ${charBadge(ctaLen, _lim.cta)}
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
// 🆕 雙池能量條狀態:cap=月配額上限 / monthly=月配額剩餘 / total=總額(月+加購)
let _bitsCap = 0, _bitsMonthly = 0, _bitsTotal = 0;

// 🆕 畫能量條:數字=總額;條只反映「月配額池 monthly ÷ cap」(加購不算進條)
//   顏色:足→紫粉 / ≤30%→橘 / ≤10%→紅(見底發光)
function renderBitsBar(total, monthly, monthlyBits) {
  if (monthlyBits !== undefined && monthlyBits !== null && Number(monthlyBits) > 0) _bitsCap = Number(monthlyBits);
  if (total   !== undefined && total   !== null) _bitsTotal   = Math.max(0, Number(total)   || 0);
  if (monthly !== undefined && monthly !== null) _bitsMonthly = Math.max(0, Number(monthly) || 0);
  const num  = document.getElementById('bitsBalance');
  const fill = document.getElementById('bitsBarFill');
  const chip = document.getElementById('bitsChip');
  if (num) num.textContent = _bitsTotal.toLocaleString();
  if (!fill) return;
  const pct = _bitsCap > 0 ? Math.max(0, Math.min(100, (_bitsMonthly / _bitsCap) * 100)) : 100;
  fill.style.width = pct + '%';
  let grad = 'linear-gradient(90deg,#7c6cff,#ff7ac3)', glow = '';
  if (pct <= 10)      { grad = 'linear-gradient(90deg,#ff4d4d,#ff7a3d)'; glow = '0 0 10px rgba(255,77,77,0.55)'; }
  else if (pct <= 30) { grad = 'linear-gradient(90deg,#ff9a3d,#ffc46b)'; }
  fill.style.background = grad;
  if (chip) {
    chip.style.borderColor = pct <= 10 ? 'rgba(255,77,77,0.6)' : 'rgba(124,108,255,0.35)';
    chip.style.boxShadow   = glow;
  }
}

// 🆕 樂觀更新:扣點 → 總額 -120、月配額先扣(與後端「先扣月配」一致),條跟著縮
function bumpBitsDisplay(delta) {
  renderBitsBar(Math.max(0, _bitsTotal + delta), Math.max(0, _bitsMonthly + delta));
}
// 🆕 刷新 Bits 餘額顯示(header 右上)— 帶月配額畫能量條
async function refreshBits() {
  try {
    const email = localStorage.getItem('bs_sso_email') || '';
    if (!email) return;
    let j = (typeof authCachedGet === 'function') ? await authCachedGet('getBits', { email }) : null;
    if (!j) {
      const res = await fetch(`${GAS_URL}?action=getBits&password=${GAS_PASSWORD}&email=${encodeURIComponent(email)}`);
      j = await res.json();
    }
    if (j && j.ok) {
      const chip = document.getElementById('bitsChip');
      if (chip) chip.style.display = 'inline-flex';
      renderBitsBar(j.balance, j.monthly, j.monthlyBits);
    }
  } catch (e) { console.warn('refreshBits 失敗:', e); }
}
window.addEventListener('load', () => setTimeout(refreshBits, 1800));
