/* ═══════════════════════════════════════════════════════════════
 *  Brand OS · KOL 人設面板 v1.0
 *
 *  功能：
 *   • 品牌選擇器（URL 帶 ?brand=la 會自動選中）
 *   • KOL 人設選擇器 + 管理
 *   • 人設編輯 modal（完整 13 欄）
 *   • AI 生成腳本 v2（吃品牌 + 人設）
 *
 *  使用方式：
 *   在 kol.html 的 </body> 前面加一行：
 *   <script src="kol-persona-panel.js"></script>
 *
 *  不修改任何現有 code，以 overlay 方式注入 UI。
 *  它會自動找到「影片主題 / 賣點」區域，在上方加入：
 *   • 品牌選擇器
 *   • 人設選擇器 + 編輯按鈕
 *  並劫持 ✨ AI 生成 按鈕，改用 v2 API
 * ═══════════════════════════════════════════════════════════════ */
(function() {
'use strict';

// 🔵 設定（如果 Worker URL 或密碼要改，只改這裡）
const WORKER_URL = 'https://kol-proxy.calm-sunset-6b66.workers.dev';
const GAS_URL = 'https://script.google.com/macros/s/AKfycbzJgPVlBS6qJV9zmxJQyPTrwn_jHY11AKOHfwiKVPhtHLUWJNjEVsFpWMd-Mk-RtZhy5w/exec';
const PASSWORD = 'raby2026';

// ─── 狀態 ──────────────────────────────────────────────────
const State = {
  brands: [],
  personas: [],
  currentBrandId: '',
  currentPersonaId: '',
  editingPersonaId: null,    // null = 新增，有值 = 編輯中
};

// ─── 啟動 ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
if (document.readyState !== 'loading') init();

let _initialized = false;
function init() {
  if (_initialized) return;
  _initialized = true;
  injectCSS();
  injectPanel();
  injectModal();
  bindHijackAIButton();
  loadBrands();
  autoPickBrandFromURL();
}

// ─── CSS 注入 ──────────────────────────────────────────────
function injectCSS() {
  const css = `
    .kpp-panel {
      background: rgba(124, 109, 250, 0.04);
      border: 1px solid rgba(124, 109, 250, 0.25);
      border-radius: 12px;
      padding: 16px 18px;
      margin-bottom: 16px;
    }
    .kpp-head {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
    }
    .kpp-title {
      font-size: 13px;
      font-weight: 700;
      color: #b5abff;
      letter-spacing: 0.5px;
    }
    .kpp-badge {
      font-size: 9px;
      font-family: 'Syne', sans-serif;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 10px;
      background: linear-gradient(135deg, #7c6dfa, #fa6d9b);
      color: #fff;
      letter-spacing: 0.05em;
    }
    .kpp-row {
      display: grid;
      grid-template-columns: 1fr 1fr auto;
      gap: 10px;
      align-items: end;
    }
    @media (max-width: 680px) {
      .kpp-row { grid-template-columns: 1fr; }
    }
    .kpp-field label {
      display: block;
      font-size: 11px;
      color: rgba(255,255,255,0.6);
      margin-bottom: 5px;
      font-weight: 500;
    }
    .kpp-field select {
      width: 100%;
      padding: 10px 14px;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 8px;
      color: #fff;
      font-size: 13px;
      outline: none;
      font-family: 'Noto Sans TC', sans-serif;
      cursor: pointer;
      appearance: none;
      background-image: url("data:image/svg+xml;charset=US-ASCII,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23888' d='M6 9L1 4h10z'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 10px center;
      padding-right: 32px;
    }
    .kpp-field select:focus { border-color: #7c6dfa; }
    .kpp-field select option { background: #111118; color: #fff; }
    .kpp-btn {
      padding: 10px 16px;
      background: linear-gradient(135deg, rgba(124,109,250,0.2), rgba(250,109,155,0.15));
      border: 1px solid rgba(124,109,250,0.4);
      border-radius: 8px;
      color: #b5abff;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      font-family: 'Noto Sans TC', sans-serif;
      white-space: nowrap;
      transition: all 0.2s;
    }
    .kpp-btn:hover {
      background: linear-gradient(135deg, rgba(124,109,250,0.3), rgba(250,109,155,0.22));
      color: #fff;
      border-color: #7c6dfa;
      transform: translateY(-1px);
    }
    .kpp-hint {
      margin-top: 10px;
      font-size: 11px;
      color: rgba(255,255,255,0.5);
      line-height: 1.6;
    }
    .kpp-hint .tag {
      display: inline-block;
      padding: 1px 7px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 700;
      margin-right: 4px;
    }
    .kpp-hint .tag-independent { background: rgba(109,250,194,0.15); color: #6dfac2; }
    .kpp-hint .tag-brand_owner { background: rgba(232,160,50,0.15); color: #E8A032; }

    /* Modal */
    .kpp-modal {
      position: fixed; inset: 0;
      background: rgba(5,5,10,0.85);
      backdrop-filter: blur(12px);
      z-index: 2000;
      display: none;
      align-items: center;
      justify-content: center;
      animation: kppFadeIn 0.2s ease;
    }
    .kpp-modal.open { display: flex; }
    @keyframes kppFadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    .kpp-card {
      background: #111118;
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 16px;
      width: 92%;
      max-width: 720px;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 30px 80px rgba(0,0,0,0.6);
      animation: kppSlideUp 0.25s ease;
    }
    @keyframes kppSlideUp {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .kpp-card-head {
      padding: 20px 24px;
      border-bottom: 1px solid rgba(255,255,255,0.06);
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: sticky;
      top: 0;
      background: rgba(17,17,24,0.97);
      backdrop-filter: blur(10px);
      z-index: 1;
    }
    .kpp-card-head h3 {
      font-family: 'Syne', sans-serif;
      font-size: 16px;
      font-weight: 800;
      color: #fff;
    }
    .kpp-card-close {
      width: 34px; height: 34px;
      border-radius: 50%;
      border: 1px solid rgba(255,255,255,0.1);
      background: transparent;
      color: rgba(255,255,255,0.6);
      cursor: pointer;
      font-size: 18px;
    }
    .kpp-card-close:hover { border-color: #fa6d9b; color: #fa6d9b; }
    .kpp-card-body { padding: 20px 24px; }
    .kpp-form-field {
      margin-bottom: 16px;
    }
    .kpp-form-field label {
      display: block;
      font-size: 12px;
      color: rgba(255,255,255,0.7);
      margin-bottom: 6px;
      font-weight: 600;
    }
    .kpp-form-field .kpp-hint-inline {
      font-size: 10px;
      color: rgba(255,255,255,0.4);
      margin-top: 3px;
      line-height: 1.5;
    }
    .kpp-form-field input[type=text],
    .kpp-form-field textarea,
    .kpp-form-field select {
      width: 100%;
      padding: 10px 12px;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 8px;
      color: #fff;
      font-size: 13px;
      outline: none;
      font-family: 'Noto Sans TC', sans-serif;
      box-sizing: border-box;
    }
    .kpp-form-field textarea {
      min-height: 70px;
      resize: vertical;
      line-height: 1.6;
    }
    .kpp-form-field input:focus,
    .kpp-form-field textarea:focus,
    .kpp-form-field select:focus { border-color: #7c6dfa; }
    .kpp-type-radio {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    .kpp-type-opt {
      padding: 14px;
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 10px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .kpp-type-opt.on {
      background: linear-gradient(135deg, rgba(124,109,250,0.15), rgba(250,109,155,0.08));
      border-color: #7c6dfa;
    }
    .kpp-type-opt-title {
      font-size: 13px;
      font-weight: 700;
      color: #fff;
      margin-bottom: 4px;
    }
    .kpp-type-opt-desc {
      font-size: 10px;
      color: rgba(255,255,255,0.5);
      line-height: 1.5;
    }
    .kpp-card-foot {
      padding: 16px 24px;
      border-top: 1px solid rgba(255,255,255,0.06);
      display: flex;
      gap: 10px;
      justify-content: flex-end;
      position: sticky;
      bottom: 0;
      background: rgba(17,17,24,0.97);
    }
    .kpp-btn-primary {
      padding: 10px 24px;
      background: linear-gradient(135deg, #7c6dfa, #fa6d9b);
      border: none;
      border-radius: 8px;
      color: #fff;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      font-family: 'Noto Sans TC', sans-serif;
    }
    .kpp-btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
    .kpp-btn-ghost {
      padding: 10px 20px;
      background: transparent;
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 8px;
      color: rgba(255,255,255,0.7);
      font-size: 13px;
      cursor: pointer;
      font-family: 'Noto Sans TC', sans-serif;
    }
    .kpp-btn-danger {
      padding: 10px 16px;
      background: transparent;
      border: 1px solid rgba(250,109,155,0.4);
      border-radius: 8px;
      color: #fa6d9b;
      font-size: 12px;
      cursor: pointer;
      font-family: 'Noto Sans TC', sans-serif;
      margin-right: auto;
    }
    .kpp-status {
      padding: 12px;
      border-radius: 8px;
      margin-top: 12px;
      font-size: 12px;
      display: none;
    }
    .kpp-status.show { display: block; }
    .kpp-status.ok { background: rgba(109,250,194,0.1); color: #6dfac2; border: 1px solid rgba(109,250,194,0.3); }
    .kpp-status.err { background: rgba(250,109,155,0.1); color: #fa6d9b; border: 1px solid rgba(250,109,155,0.3); }
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
}

// ─── 面板注入 ──────────────────────────────────────────────
function injectPanel() {
  // 找到「影片主題 / 賣點」的輸入框，把面板插在它上面
  const topicInput = findTopicInput();
  if (!topicInput) {
    // 如果找不到，找「口播影片設定」區塊
    const sections = document.querySelectorAll('h3, [class*="title"], [class*="head"]');
    let anchor = null;
    for (const s of sections) {
      if (s.textContent && s.textContent.includes('口播影片設定')) {
        anchor = s.parentElement;
        break;
      }
    }
    if (!anchor) {
      console.warn('[KPP] 找不到合適的插入點，面板將插在 body 頂端');
      anchor = document.body;
    }
    anchor.insertAdjacentHTML('afterbegin', buildPanelHTML());
  } else {
    // 找到這個 input 的 containing group（往上找 label 所在的區塊）
    const parent = topicInput.closest('[class*="field"], [class*="group"], [class*="block"]')
      || topicInput.parentElement;
    parent.insertAdjacentHTML('beforebegin', buildPanelHTML());
  }

  bindPanelEvents();
}

function findTopicInput() {
  // 嘗試多種選擇器找到「影片主題」輸入框
  const candidates = [
    document.querySelector('input[placeholder*="MOZ"]'),
    document.querySelector('input[placeholder*="主題"]'),
    document.querySelector('input[placeholder*="賣點"]'),
    document.querySelector('input[id*="topic" i]'),
    document.querySelector('input[name*="topic" i]'),
  ];
  for (const c of candidates) { if (c) return c; }
  return null;
}

function buildPanelHTML() {
  return `
    <div class="kpp-panel" id="kpp-panel">
      <div class="kpp-head">
        <span class="kpp-title">🎭 KOL 人設系統</span>
        <span class="kpp-badge">Phase 1</span>
      </div>
      <div class="kpp-row">
        <div class="kpp-field">
          <label>選擇品牌</label>
          <select id="kpp-brand-select">
            <option value="">— 載入中 —</option>
          </select>
        </div>
        <div class="kpp-field">
          <label>選擇 KOL 人設</label>
          <select id="kpp-persona-select">
            <option value="">— 先選品牌 —</option>
          </select>
        </div>
        <div>
          <button class="kpp-btn" id="kpp-btn-edit" title="編輯或新增 KOL 人設">
            ✏️ 人設管理
          </button>
        </div>
      </div>
      <div class="kpp-hint" id="kpp-hint">
        選品牌與 KOL 人設後，按下方「✨ AI 生成」會套用人設生成腳本。
      </div>
    </div>
  `;
}

function bindPanelEvents() {
  document.getElementById('kpp-brand-select')?.addEventListener('change', onBrandChange);
  document.getElementById('kpp-persona-select')?.addEventListener('change', onPersonaChange);
  document.getElementById('kpp-btn-edit')?.addEventListener('click', openPersonaModal);
}

// ─── Modal 注入 ────────────────────────────────────────────
function injectModal() {
  const html = `
    <div class="kpp-modal" id="kpp-modal">
      <div class="kpp-card">
        <div class="kpp-card-head">
          <h3 id="kpp-modal-title">新增 KOL 人設</h3>
          <button class="kpp-card-close" id="kpp-modal-close">✕</button>
        </div>
        <div class="kpp-card-body">
          ${buildFormHTML()}
          <div class="kpp-status" id="kpp-save-status"></div>
        </div>
        <div class="kpp-card-foot">
          <button class="kpp-btn-danger" id="kpp-btn-delete" style="display:none;">🗑 刪除此人設</button>
          <button class="kpp-btn-ghost" id="kpp-btn-cancel">取消</button>
          <button class="kpp-btn-primary" id="kpp-btn-save">💾 儲存</button>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', html);

  document.getElementById('kpp-modal-close')?.addEventListener('click', closePersonaModal);
  document.getElementById('kpp-btn-cancel')?.addEventListener('click', closePersonaModal);
  document.getElementById('kpp-btn-save')?.addEventListener('click', savePersona);
  document.getElementById('kpp-btn-delete')?.addEventListener('click', deletePersona);

  // 類型切換
  document.querySelectorAll('.kpp-type-opt').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('.kpp-type-opt').forEach(o => o.classList.remove('on'));
      opt.classList.add('on');
      document.getElementById('kpp-f-persona_type').value = opt.dataset.type;
    });
  });
}

function buildFormHTML() {
  return `
    <div class="kpp-form-field">
      <label>KOL 名稱 *</label>
      <input type="text" id="kpp-f-persona_name" placeholder="例：Misaki" maxlength="30">
      <div class="kpp-hint-inline">用純個人名字，不要帶品牌字樣</div>
    </div>

    <div class="kpp-form-field">
      <label>身份類型 *</label>
      <div class="kpp-type-radio">
        <div class="kpp-type-opt on" data-type="independent">
          <div class="kpp-type-opt-title">🎯 獨立 KOL</div>
          <div class="kpp-type-opt-desc">消費者視角，與品牌無利害關係（推薦用這種，信任度高）</div>
        </div>
        <div class="kpp-type-opt" data-type="brand_owner">
          <div class="kpp-type-opt-title">👑 品牌創辦人</div>
          <div class="kpp-type-opt-desc">品牌方本人，可講品牌故事與理念</div>
        </div>
      </div>
      <input type="hidden" id="kpp-f-persona_type" value="independent">
    </div>

    <div class="kpp-form-field">
      <label>身世背景</label>
      <textarea id="kpp-f-background" placeholder="例：日本母親+台灣父親，日本長大..."></textarea>
    </div>

    <div class="kpp-form-field">
      <label>個性特質</label>
      <textarea id="kpp-f-personality" placeholder="例：溫柔但堅持、真誠直接..."></textarea>
    </div>

    <div class="kpp-form-field">
      <label>說話風格</label>
      <textarea id="kpp-f-speaking_style" placeholder="例：日文腔的繁體中文，避開日文漢字..."></textarea>
      <div class="kpp-hint-inline">⚠️ HeyGen 會把日文漢字（本当に、これ）當中文字唸，建議只用純假名語氣詞（欸〜、うん）</div>
    </div>

    <div class="kpp-form-field">
      <label>招牌口頭禪（用 / 分隔多個）</label>
      <input type="text" id="kpp-f-catchphrases" placeholder="欸〜 / うん / 就是...那個...">
    </div>

    <div class="kpp-form-field">
      <label>避用詞彙（用 / 分隔多個）</label>
      <input type="text" id="kpp-f-taboo_words" placeholder="CP值 / 超誇張 / 狂">
      <div class="kpp-hint-inline">這些詞彙絕對不會出現在生成的腳本中</div>
    </div>

    <div class="kpp-form-field">
      <label>擅長主題（用 / 分隔多個）</label>
      <textarea id="kpp-f-signature_topics" placeholder="穿搭心得 / 日常穿感分享 / ..."></textarea>
    </div>

    <div class="kpp-form-field">
      <label>禁忌主題（用 / 分隔多個）</label>
      <textarea id="kpp-f-forbidden_topics" placeholder="工廠內部 / 品牌理念 / ..."></textarea>
      <div class="kpp-hint-inline">獨立 KOL 類型建議禁談「工廠」「品牌理念」「自稱品牌方」</div>
    </div>

    <div class="kpp-form-field">
      <label>角色身份聲明</label>
      <textarea id="kpp-f-role_relationship" placeholder="例：我在台灣當 Model，因為拍攝認識 LACEZ..."></textarea>
    </div>

    <input type="hidden" id="kpp-f-persona_id" value="">
  `;
}

// ─── 載入資料 ──────────────────────────────────────────────
async function loadBrands() {
  try {
    const res = await gasGet('getBrandOS');
    if (!res.ok) throw new Error(res.error || '品牌載入失敗');
    State.brands = res.data?.brands || [];
    renderBrandSelect();
  } catch (e) {
    console.error('[KPP] loadBrands:', e);
    document.getElementById('kpp-brand-select').innerHTML = '<option>載入失敗</option>';
  }
}

function renderBrandSelect() {
  const sel = document.getElementById('kpp-brand-select');
  if (!sel) return;
  sel.innerHTML = '<option value="">— 請選擇品牌 —</option>'
    + State.brands.map(b => `<option value="${esc(b.id)}">${esc(b.icon || '🏷️')} ${esc(b.name)}</option>`).join('');

  // 如果已有 currentBrandId，選回去
  if (State.currentBrandId) {
    sel.value = State.currentBrandId;
    loadPersonas(State.currentBrandId);
  }
}

function autoPickBrandFromURL() {
  const params = new URLSearchParams(window.location.search);
  const urlBrand = params.get('brand');
  if (!urlBrand) return;
  // 等 brands 載入完再設定
  const checkAndSet = () => {
    if (State.brands.length === 0) {
      setTimeout(checkAndSet, 300);
      return;
    }
    const found = State.brands.find(b => b.id === urlBrand);
    if (found) {
      State.currentBrandId = urlBrand;
      document.getElementById('kpp-brand-select').value = urlBrand;
      loadPersonas(urlBrand);
    }
  };
  checkAndSet();
}

async function loadPersonas(brandId) {
  if (!brandId) {
    State.personas = [];
    renderPersonaSelect();
    return;
  }
  try {
    const res = await gasGet('getKolPersonas', { brandId });
    if (!res.ok) throw new Error(res.error || '人設載入失敗');
    State.personas = res.personas || [];
    renderPersonaSelect();
  } catch (e) {
    console.error('[KPP] loadPersonas:', e);
    State.personas = [];
    renderPersonaSelect();
  }
}

function renderPersonaSelect() {
  const sel = document.getElementById('kpp-persona-select');
  if (!sel) return;
  if (State.personas.length === 0) {
    sel.innerHTML = '<option value="">— 此品牌尚無人設，請按「人設管理」新增 —</option>';
    updateHint('ℹ️ 此品牌還沒有 KOL 人設，按右邊「✏️ 人設管理」新增一個。');
    return;
  }
  sel.innerHTML = '<option value="">— 請選擇 KOL —</option>'
    + State.personas.map(p => {
      const typeIcon = p.persona_type === 'brand_owner' ? '👑' : '🎯';
      return `<option value="${esc(p.persona_id)}">${typeIcon} ${esc(p.persona_name)}</option>`;
    }).join('');
  updateHint('');
}

function onBrandChange(e) {
  State.currentBrandId = e.target.value;
  State.currentPersonaId = '';
  loadPersonas(State.currentBrandId);
}

function onPersonaChange(e) {
  State.currentPersonaId = e.target.value;
  if (!State.currentPersonaId) {
    updateHint('');
    return;
  }
  const persona = State.personas.find(p => p.persona_id === State.currentPersonaId);
  if (persona) {
    const typeTag = persona.persona_type === 'brand_owner'
      ? '<span class="tag tag-brand_owner">品牌創辦人</span>'
      : '<span class="tag tag-independent">獨立 KOL</span>';
    updateHint(`${typeTag}${esc(persona.persona_name)}：${esc(persona.personality || persona.background || '').slice(0, 60)}`);
  }
}

function updateHint(html) {
  const el = document.getElementById('kpp-hint');
  if (!el) return;
  el.innerHTML = html || '選品牌與 KOL 人設後，按下方「✨ AI 生成」會套用人設生成腳本。';
}

// ─── 人設 Modal 開關 ───────────────────────────────────────
function openPersonaModal() {
  if (!State.currentBrandId) {
    alert('請先選擇品牌');
    return;
  }
  // 如果目前有選中的人設，開編輯模式；否則開新增模式
  if (State.currentPersonaId) {
    const persona = State.personas.find(p => p.persona_id === State.currentPersonaId);
    if (persona) {
      State.editingPersonaId = persona.persona_id;
      fillForm(persona);
      document.getElementById('kpp-modal-title').textContent = '編輯 KOL 人設';
      document.getElementById('kpp-btn-delete').style.display = 'inline-block';
    }
  } else {
    State.editingPersonaId = null;
    clearForm();
    document.getElementById('kpp-modal-title').textContent = '新增 KOL 人設';
    document.getElementById('kpp-btn-delete').style.display = 'none';
  }
  document.getElementById('kpp-save-status').classList.remove('show');
  document.getElementById('kpp-modal').classList.add('open');
}

function closePersonaModal() {
  document.getElementById('kpp-modal').classList.remove('open');
}

function clearForm() {
  document.getElementById('kpp-f-persona_id').value = '';
  document.getElementById('kpp-f-persona_name').value = '';
  document.getElementById('kpp-f-persona_type').value = 'independent';
  document.getElementById('kpp-f-background').value = '';
  document.getElementById('kpp-f-personality').value = '';
  document.getElementById('kpp-f-speaking_style').value = '';
  document.getElementById('kpp-f-catchphrases').value = '';
  document.getElementById('kpp-f-taboo_words').value = '';
  document.getElementById('kpp-f-signature_topics').value = '';
  document.getElementById('kpp-f-forbidden_topics').value = '';
  document.getElementById('kpp-f-role_relationship').value = '';
  // 類型 radio 重置為 independent
  document.querySelectorAll('.kpp-type-opt').forEach(o => {
    o.classList.toggle('on', o.dataset.type === 'independent');
  });
}

function fillForm(persona) {
  document.getElementById('kpp-f-persona_id').value = persona.persona_id || '';
  document.getElementById('kpp-f-persona_name').value = persona.persona_name || '';
  document.getElementById('kpp-f-persona_type').value = persona.persona_type || 'independent';
  document.getElementById('kpp-f-background').value = persona.background || '';
  document.getElementById('kpp-f-personality').value = persona.personality || '';
  document.getElementById('kpp-f-speaking_style').value = persona.speaking_style || '';
  document.getElementById('kpp-f-catchphrases').value = (persona.catchphrases || []).join(' / ');
  document.getElementById('kpp-f-taboo_words').value = (persona.taboo_words || []).join(' / ');
  document.getElementById('kpp-f-signature_topics').value = (persona.signature_topics || []).join(' / ');
  document.getElementById('kpp-f-forbidden_topics').value = (persona.forbidden_topics || []).join(' / ');
  document.getElementById('kpp-f-role_relationship').value = persona.role_relationship || '';
  // 類型 radio 對應
  document.querySelectorAll('.kpp-type-opt').forEach(o => {
    o.classList.toggle('on', o.dataset.type === (persona.persona_type || 'independent'));
  });
}

// ─── 儲存人設 ──────────────────────────────────────────────
async function savePersona() {
  const name = document.getElementById('kpp-f-persona_name').value.trim();
  if (!name) {
    showStatus('❌ KOL 名稱必填', 'err');
    return;
  }

  const data = {
    persona_id: document.getElementById('kpp-f-persona_id').value || '',
    persona_name: name,
    persona_type: document.getElementById('kpp-f-persona_type').value || 'independent',
    brand_id: State.currentBrandId,
    talking_photo_id: '',
    voice_id: '',
    background: document.getElementById('kpp-f-background').value.trim(),
    personality: document.getElementById('kpp-f-personality').value.trim(),
    speaking_style: document.getElementById('kpp-f-speaking_style').value.trim(),
    catchphrases: splitTags(document.getElementById('kpp-f-catchphrases').value),
    taboo_words: splitTags(document.getElementById('kpp-f-taboo_words').value),
    signature_topics: splitTags(document.getElementById('kpp-f-signature_topics').value),
    forbidden_topics: splitTags(document.getElementById('kpp-f-forbidden_topics').value),
    role_relationship: document.getElementById('kpp-f-role_relationship').value.trim(),
  };

  const btn = document.getElementById('kpp-btn-save');
  btn.disabled = true;
  btn.textContent = '💾 儲存中...';

  try {
    const res = await gasPost('saveKolPersona', { data });
    if (!res.ok) throw new Error(res.error || '儲存失敗');
    showStatus('✅ 已儲存！（' + (res.action === 'created' ? '新增' : '更新') + '）', 'ok');
    // 重新載入人設清單
    await loadPersonas(State.currentBrandId);
    // 自動選中剛儲存的人設
    State.currentPersonaId = res.persona_id;
    const sel = document.getElementById('kpp-persona-select');
    if (sel) sel.value = res.persona_id;
    onPersonaChange({ target: sel });
    setTimeout(() => closePersonaModal(), 800);
  } catch (e) {
    showStatus('❌ ' + e.message, 'err');
  } finally {
    btn.disabled = false;
    btn.textContent = '💾 儲存';
  }
}

async function deletePersona() {
  const id = document.getElementById('kpp-f-persona_id').value;
  if (!id) return;
  if (!confirm('確定要刪除這個 KOL 人設嗎？此動作無法復原。')) return;

  try {
    const res = await gasPost('deleteKolPersona', { persona_id: id });
    if (!res.ok) throw new Error(res.error || '刪除失敗');
    showStatus('✅ 已刪除', 'ok');
    State.currentPersonaId = '';
    await loadPersonas(State.currentBrandId);
    setTimeout(() => closePersonaModal(), 600);
  } catch (e) {
    showStatus('❌ ' + e.message, 'err');
  }
}

function showStatus(msg, type) {
  const el = document.getElementById('kpp-save-status');
  el.textContent = msg;
  el.className = 'kpp-status show ' + type;
}

function splitTags(str) {
  if (!str) return [];
  return str.split(/[\/,，；;]/).map(s => s.trim()).filter(Boolean);
}

// ─── 劫持 ✨ AI 生成 按鈕 ─────────────────────────────────
function bindHijackAIButton() {
  // 延遲綁定，讓原生 kol.html 的按鈕先 render 完
  setTimeout(() => {
    // 找所有包含「AI 生成」字樣的按鈕
    const btns = Array.from(document.querySelectorAll('button')).filter(b => {
      const t = b.textContent || '';
      return t.includes('AI 生成') || t.includes('AI生成');
    });

    btns.forEach(btn => {
      // 用 capturing phase 攔截，比 kol.html 原本的 handler 更先跑
      btn.addEventListener('click', handleAIGenerate, true);
    });

    if (btns.length > 0) {
      console.log('[KPP] 已劫持', btns.length, '個 AI 生成按鈕');
    }
  }, 500);
}

async function handleAIGenerate(e) {
  // 只有在「品牌 + 人設都選了」時才啟用 v2，否則放行原本的 v1 邏輯
  if (!State.currentBrandId || !State.currentPersonaId) {
    // 讓原本的 handler 跑，不劫持
    return;
  }

  // 攔截原事件
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();

  // 取得 topic
  const topicInput = findTopicInput();
  const topic = topicInput?.value?.trim() || '';
  if (!topic) {
    alert('請先填「影片主題 / 賣點」');
    return;
  }

  // 取得 scene（選中的場景卡）
  const scene = guessSelectedScene();

  // 取得 duration（如果有可以選，不然預設 30）
  const duration = 30;

  // 找到腳本輸出框
  const scriptOutput = findScriptTextarea();
  if (!scriptOutput) {
    alert('找不到「口播腳本」輸入框，無法寫入結果');
    return;
  }

  // UI feedback
  const btn = e.currentTarget;
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = '🎭 人設生成中...';
  scriptOutput.value = '';
  scriptOutput.placeholder = '🎭 用 ' + getCurrentPersonaName() + ' 的人設生成中...';

  try {
    const res = await workerPost('ai_generate_script_v2', {
      brandId: State.currentBrandId,
      personaId: State.currentPersonaId,
      topic,
      scene,
      duration,
    });

    if (!res.ok) throw new Error(res.error || '生成失敗');

    scriptOutput.value = res.script || '';
    scriptOutput.placeholder = '點 AI 生成，或直接輸入口播稿…';
    // 觸發原生 input 事件讓字數統計之類的 UI 更新
    scriptOutput.dispatchEvent(new Event('input', { bubbles: true }));
  } catch (err) {
    alert('❌ 人設腳本生成失敗：' + err.message);
    scriptOutput.placeholder = '點 AI 生成，或直接輸入口播稿…';
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

function guessSelectedScene() {
  // 找到被選中的場景卡（有 on / active / selected class）
  const scenes = document.querySelectorAll('[class*="scene" i]');
  for (const s of scenes) {
    if (s.classList.contains('on') || s.classList.contains('active') || s.classList.contains('selected')) {
      const t = s.textContent || '';
      if (t.includes('開箱')) return 'product';
      if (t.includes('心得')) return 'review';
      if (t.includes('優惠')) return 'promo';
      if (t.includes('知識') || t.includes('教育')) return 'edu';
    }
  }
  return 'review';  // 預設
}

function findScriptTextarea() {
  const candidates = [
    document.querySelector('textarea[placeholder*="AI 生成"]'),
    document.querySelector('textarea[placeholder*="口播"]'),
    document.querySelector('textarea[placeholder*="腳本"]'),
    document.querySelector('textarea[id*="script" i]'),
    document.querySelector('textarea[name*="script" i]'),
  ];
  for (const c of candidates) { if (c) return c; }
  // Fallback: 找最大的 textarea
  const allTextareas = Array.from(document.querySelectorAll('textarea'));
  return allTextareas.sort((a, b) =>
    (b.offsetWidth * b.offsetHeight) - (a.offsetWidth * a.offsetHeight)
  )[0] || null;
}

function getCurrentPersonaName() {
  const p = State.personas.find(p => p.persona_id === State.currentPersonaId);
  return p?.persona_name || 'KOL';
}

// ─── API 呼叫 ──────────────────────────────────────────────
async function gasGet(action, params = {}) {
  const qs = new URLSearchParams({ action, password: PASSWORD, ...params }).toString();
  const resp = await fetch(`${GAS_URL}?${qs}`, { method: 'GET' });
  return resp.json();
}

async function gasPost(action, extra = {}) {
  const resp = await fetch(GAS_URL, {
    method: 'POST',
    body: JSON.stringify({ action, password: PASSWORD, ...extra }),
    redirect: 'follow',
  });
  return resp.json();
}

async function workerPost(action, extra = {}) {
  const resp = await fetch(WORKER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, password: PASSWORD, ...extra }),
  });
  return resp.json();
}

// ─── 工具 ──────────────────────────────────────────────────
function esc(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

})();
