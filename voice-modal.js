/* ═══════════════════════════════════════════════════════════════
 *  Voice Modal v3.1 — 亞洲業務語系精選
 *
 *  v3.1 重大改動（2026-04）：
 *    • Worker v3.6 合作：一次載 116 個（Multilingual 70 + 中文 25 + 日文 21）
 *    • 新增語言 chip 群組（全部 / 多國語言 / 🇹🇼 中文 / 🇯🇵 日文）
 *      切換 chip 純前端過濾，不打 API（毫秒級切換，不 LAG）
 *    • 保留「顯示全部 2305」逃生門
 *    • animation-delay 收緊到 200ms 上限（v3 是 400ms，切換時會卡）
 *
 *  v3 功能完整保留：
 *    • 收藏模式 ⭐
 *    • 手動新增 voice_id ➕
 *    • 自訂語音 _custom 標記
 *    • 音訊播放 / 波形同步 / 分頁渲染
 *    • 鍵盤快捷鍵（Space/Esc/↑↓）
 *
 *  依賴：voice-modal.css v3.1
 * ═══════════════════════════════════════════════════════════════ */
(function (global) {
'use strict';

// ─── 狀態 ─────────────────────────────────────────────────────
const State = {
  workerUrl: '',
  password: '',
  onSelect: null,

  rootEl: null,
  currentTab: 'library',   // 'favorites' | 'library'  — 預設開在語音庫,見 open() 說明
  voices: { library: [], libraryRawTotal: 0 },
  loading: { library: false },
  loaded:  { library: false },

  search: '',
  filterGender: 'all',
  filterLang: 'all',        // 🆕 v3.1: 'all' | 'multilingual' | 'chinese' | 'japanese'

  playing: null,
  tentative: null,
  confirmed: null,
  favorites: new Set(),
  customVoices: [],

  audio: new Audio(),
  audioRAF: null,

  pageSize: 10,   // 首屏只畫 10 張卡(每張含波形圖,畫太多會卡);其餘捲到底自動載入
  pageCount: 1,
  lastPlayingRowEl: null,
  lastSelectedRowEl: null,
  lastProgressRowEl: null,

  // v3.1: 統一用 brandOSFilter 取代 onlyMultilingual
  brandOSFilter: true,      // true = 精選 116 個  false = 全部 2305
};

const LS_FAV = 'bos_voice_favorites_v1';
const LS_CONFIRMED = 'bos_voice_confirmed_v1';
const LS_CUSTOM = 'bos_voice_custom_v1';

// ─── Public API ───────────────────────────────────────────────
const VoiceModal = {
  init(opts) {
    State.workerUrl = opts.workerUrl;
    State.password  = opts.password;
    State.onSelect  = opts.onSelect || function () {};

    try {
      const saved = JSON.parse(localStorage.getItem(LS_FAV) || '[]');
      State.favorites = new Set(saved);
    } catch {}

    try {
      const saved = JSON.parse(localStorage.getItem(LS_CONFIRMED) || 'null');
      if (saved && saved.id) State.confirmed = saved;
    } catch {}

    try {
      const saved = JSON.parse(localStorage.getItem(LS_CUSTOM) || '[]');
      if (Array.isArray(saved)) State.customVoices = saved;
    } catch {}

    if (!document.getElementById('vm-root')) {
      const root = document.createElement('div');
      root.id = 'vm-root';
      root.className = 'vm-modal';
      root.innerHTML = buildModalHTML();
      document.body.appendChild(root);
      State.rootEl = root;
      bindEvents();
    }

    State.audio.addEventListener('ended', () => {
      stopProgressLoop();
      State.playing = null;
      updatePlayingUI();
    });
    State.audio.addEventListener('play', startProgressLoop);
    State.audio.addEventListener('pause', stopProgressLoop);

    document.addEventListener('keydown', handleKey);
  },

  open(gender) {
    if (!State.rootEl) return;
    State.tentative = State.confirmed;
    applyGenderLock(gender);
    State.rootEl.classList.add('open');
    // 🆕 開場分頁:有收藏才進「我的收藏」,沒有就直接進「亞洲業務精選」。
    //    原本一律預設 favorites → 新客戶第一次開就看到「還沒有收藏的語音」大字加空白畫面,
    //    像壞掉的頁面。有東西可選才是好的第一印象。
    try {
      const _favs = (typeof getFavoriteVoices === 'function') ? getFavoriteVoices() : [];
      State.currentTab = (_favs && _favs.length) ? 'favorites' : 'library';
    } catch (_) { State.currentTab = 'library'; }
    switchTab(State.currentTab);
  },

  close() {
    if (!State.rootEl) return;
    State.rootEl.classList.remove('open');
    stopPlayback();
  },

  getSelected() {
    return State.confirmed;
  },

  setSelected(v) {
    State.confirmed = v;
    if (v) localStorage.setItem(LS_CONFIRMED, JSON.stringify(v));
    else   localStorage.removeItem(LS_CONFIRMED);
  },

  // 🆕 依 voice_id 查完整語音資料(名字/性別/語言)。
  //    重登後只從 KOL 人設拿得到 voice_id,沒有名字 → 畫面只能顯示「已綁定語音」。
  //    這裡依序查:已載入的語音庫 → 自訂語音 → 本機記住的那筆。查不到回 null。
  findVoiceById(id) {
    if (!id) return null;
    const key = String(id);
    const pools = [State.voices.library || [], State.customVoices || []];
    for (const pool of pools) {
      const hit = pool.find(v => String(v.id) === key);
      if (hit) return hit;
    }
    try {
      const saved = JSON.parse(localStorage.getItem(LS_CONFIRMED) || 'null');
      if (saved && String(saved.id) === key) return saved;
    } catch (_) {}
    return null;
  },

  // 語音庫載入完成後通知外部重新套用名字(kol.html 會掛這個)
  onLibraryLoaded(fn) { State._onLibLoaded = fn; },
};

global.VoiceModal = VoiceModal;

// ─── Modal HTML 結構 ──────────────────────────────────────────
function buildModalHTML() {
  return `
    <div class="vm-header">
      <div>
        <h2>選擇口播語音</h2>
        <div class="vm-subtitle">亞洲市場精選・多國語言 + 原生中文 + 原生日文</div>
      </div>
      <button class="vm-close" id="vm-close" aria-label="關閉">✕</button>
    </div>

    <div class="vm-tabs">
      <button class="vm-tab active" data-tab="favorites">
        ⭐ 我的收藏 <span class="vm-tab-count" id="vm-count-favorites">—</span>
      </button>
      <button class="vm-tab" data-tab="library">
        亞洲業務精選 <span class="vm-tab-count" id="vm-count-library">—</span>
      </button>
    </div>

    <!-- 🆕 v3.1 語言 chip 群組（library tab 才顯示） -->
    <div class="vm-langbar" id="vm-langbar" style="display:none">
      <button class="vm-lang-chip active" data-lang="all">
        全部 <span class="vm-lang-count" data-count="all">—</span>
      </button>
      <button class="vm-lang-chip" data-lang="multilingual">
        多國語言 <span class="vm-lang-count" data-count="multilingual">—</span>
      </button>
      <button class="vm-lang-chip" data-lang="chinese">
        🇹🇼 中文 <span class="vm-lang-count" data-count="chinese">—</span>
      </button>
      <button class="vm-lang-chip" data-lang="japanese">
        🇯🇵 日文 <span class="vm-lang-count" data-count="japanese">—</span>
      </button>
    </div>

    <div class="vm-filterbar" id="vm-filterbar">
      <div class="vm-search">
        <input type="text" id="vm-search" placeholder="搜尋語音名稱..." autocomplete="off">
      </div>
      <div class="vm-chip-select">
        <select id="vm-gender">
          <option value="all">全部性別</option>
          <option value="female">女聲</option>
          <option value="male">男聲</option>
        </select>
      </div>
      <button class="vm-filter-toggle" id="vm-filter-toggle" title="切換精選 / 全部語音">
        <span id="vm-filter-toggle-label">🔓 顯示全部 2305</span>
      </button>
      <button class="vm-add-btn" id="vm-add-custom-btn" title="手動新增 voice_id">
        ➕ 手動新增
      </button>
    </div>

    <div class="vm-list-container" id="vm-list"></div>

    <div class="vm-sub-modal" id="vm-custom-modal" style="display:none">
      <div class="vm-sub-card">
        <div class="vm-sub-header">
          <h3>手動新增 voice_id</h3>
          <button class="vm-sub-close" id="vm-custom-close">✕</button>
        </div>
        <div class="vm-sub-body">
          <div class="vm-info-box">
            從你的語音平台複製自建的 voice_id（例如自行匯入的多語言語音）。
            <br><strong>建議選擇 Multilingual 多語言引擎</strong>，能講中/日/英等多語言。
            <br>開啟網址：<code style="color:#b5abff">app.heygen.com/settings?nav=API</code> 或在語音編輯頁 URL 中取得。
          </div>
          <div class="vm-field">
            <label>Voice ID（必填）</label>
            <input type="text" id="vm-custom-id" placeholder="例：a1b2c3d4e5f6..." maxlength="64">
          </div>
          <div class="vm-field">
            <label>顯示名稱（必填）</label>
            <input type="text" id="vm-custom-name" placeholder="例：Morioki - 日混台甜美" maxlength="40">
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div class="vm-field">
              <label>語言</label>
              <select id="vm-custom-lang">
                <option value="Multilingual">多國語言</option>
                <option value="Chinese">中文</option>
                <option value="Japanese">日文</option>
                <option value="English">英文</option>
                <option value="Cantonese">粵語</option>
              </select>
            </div>
            <div class="vm-field">
              <label>性別</label>
              <select id="vm-custom-gender">
                <option value="female">女聲</option>
                <option value="male">男聲</option>
              </select>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div class="vm-field">
              <label>引擎</label>
              <select id="vm-custom-engine">
                <option value="ElevenLabs">進階多語言</option>
                <option value="HeyGen">數字人語音</option>
                <option value="Azure">Azure</option>
                <option value="Fish">Fish</option>
              </select>
            </div>
            <div class="vm-field">
              <label>試聽網址（選填）</label>
              <input type="text" id="vm-custom-preview" placeholder="https://..." maxlength="500">
            </div>
          </div>
          <button class="vm-btn-primary" id="vm-custom-submit">➕ 加入收藏</button>
          <div id="vm-custom-status" style="font-size:12px;color:rgba(255,255,255,0.6);margin-top:8px;text-align:center"></div>
        </div>
      </div>
    </div>

    <div class="vm-player" id="vm-player">
      <div class="vm-player-info">
        <div class="vm-player-name" id="vm-player-name">—</div>
        <div class="vm-player-meta" id="vm-player-meta"></div>
      </div>
      <div class="vm-player-ctrl">
        <button class="vm-play-main" id="vm-player-toggle" title="空白鍵暫停/播放">⏸</button>
      </div>
      <div class="vm-progress">
        <div class="vm-progress-bar" id="vm-progress">
          <div class="vm-progress-fill" id="vm-progress-fill"></div>
        </div>
        <div class="vm-time" id="vm-time">00:00 / 00:00</div>
      </div>
      <button class="vm-select-btn" id="vm-confirm-btn" disabled>✓ 選用此語音</button>
    </div>
  `;
}

// ─── 事件綁定 ─────────────────────────────────────────────────
function bindEvents() {
  const root = State.rootEl;

  root.querySelector('#vm-close').addEventListener('click', VoiceModal.close);
  root.addEventListener('click', (e) => {
    if (e.target === root) VoiceModal.close();
  });

  root.querySelectorAll('.vm-tab').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // 🆕 v3.1 語言 chip 切換（純前端，0ms）
  root.querySelectorAll('.vm-lang-chip').forEach(chip => {
    chip.addEventListener('click', () => switchLangFilter(chip.dataset.lang));
  });

  root.querySelector('#vm-search').addEventListener('input', debounce(e => {
    State.search = e.target.value.trim().toLowerCase();
    State.pageCount = 1;
    renderList();
  }, 200));
  root.querySelector('#vm-gender').addEventListener('change', e => {
    if (State.lockedGender) { e.target.value = State.lockedGender; return; }
    State.filterGender = e.target.value; State.pageCount = 1; renderList();
  });

  root.querySelector('#vm-filter-toggle').addEventListener('click', toggleBrandOSFilter);

  root.querySelector('#vm-add-custom-btn').addEventListener('click', openCustomModal);
  root.querySelector('#vm-custom-close').addEventListener('click', closeCustomModal);
  root.querySelector('#vm-custom-submit').addEventListener('click', submitCustomVoice);

  root.querySelector('#vm-player-toggle').addEventListener('click', togglePlayback);
  root.querySelector('#vm-progress').addEventListener('click', seekPlayback);
  root.querySelector('#vm-confirm-btn').addEventListener('click', confirmSelection);
}

function handleKey(e) {
  if (!State.rootEl?.classList.contains('open')) return;
  if (e.key === 'Escape') { VoiceModal.close(); return; }
  const tag = e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  if (e.key === ' ') { e.preventDefault(); togglePlayback(); }
  if (e.key === 'ArrowDown') { e.preventDefault(); playNextInList(+1); }
  if (e.key === 'ArrowUp')   { e.preventDefault(); playNextInList(-1); }
}

// ─── Tab 切換 ────────────────────────────────────────────────
function switchTab(tab) {
  State.currentTab = tab;
  State.pageCount = 1;
  const root = State.rootEl;
  root.querySelectorAll('.vm-tab').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });

  // 🆕 v3.1: 只有 library tab 顯示語言 chip bar
  const langbar = root.querySelector('#vm-langbar');
  if (langbar) langbar.style.display = tab === 'library' ? 'flex' : 'none';

  root.querySelector('#vm-filterbar').style.display = 'flex';

  root.querySelector('#vm-player').classList.toggle(
    'show', !!State.tentative
  );

  if (tab === 'library') {
    if (!State.loaded.library) loadLibraryVoices();
    else renderList();
  } else {
    renderList();
    if (!State.loaded.library && State.favorites.size > 0) {
      loadLibraryVoices();
    }
  }
  updateCountChips();
}

// 🆕 v3.1 語言 chip 切換（純前端過濾，不打 API）
function switchLangFilter(lang) {
  State.filterLang = lang;
  State.pageCount = 1;
  State.rootEl.querySelectorAll('.vm-lang-chip').forEach(chip => {
    chip.classList.toggle('active', chip.dataset.lang === lang);
  });
  renderList();
}

function updateCountChips() {
  const favCount = getFavoriteVoices().length;
  const favEl = document.getElementById('vm-count-favorites');
  if (favEl) favEl.textContent = favCount;
  const libEl = document.getElementById('vm-count-library');
  if (libEl) libEl.textContent = State.voices.library.length || '—';

  // 精選/全部切換按鈕文字
  const toggleLabel = document.getElementById('vm-filter-toggle-label');
  const toggleBtn = document.getElementById('vm-filter-toggle');
  if (toggleLabel) {
    if (State.brandOSFilter) {
      toggleLabel.innerHTML = '🔓 顯示全部' + (State.voices.libraryRawTotal ? ' ' + State.voices.libraryRawTotal : '');
      if (toggleBtn) toggleBtn.title = '切換到完整模式（載入完整語音庫 2305 個語音）';
    } else {
      toggleLabel.innerHTML = '回亞洲精選';
      if (toggleBtn) toggleBtn.title = '切回精選模式（只看多國語言 + 中文 + 日文 共 116 個）';
    }
  }

  // Tab 標題
  const libTab = document.querySelector('.vm-tab[data-tab="library"]');
  if (libTab) {
    const countSpan = libTab.querySelector('.vm-tab-count');
    const firstNode = Array.from(libTab.childNodes).find(n => n.nodeType === 3);
    if (firstNode) {
      firstNode.textContent = State.brandOSFilter
        ? '亞洲業務精選 '
        : '完整語音庫 ';
    }
    // 🆕 載入中顯示「…」而非「—」,讓客戶知道是在跑不是沒東西
    if (countSpan) {
      countSpan.textContent = (State.loading.library || !State.loaded.library)
        ? '…'
        : (State.voices.library.length || '0');
    }
  }

  // 🆕 v3.1 更新每個語言 chip 的數字
  updateLangChipCounts();
}

// 🆕 v3.1 計算每個語言 chip 的數量（考慮 search + gender 過濾後的）
function updateLangChipCounts() {
  // 🆕 載入中就先顯示「…」,不要顯示 0。
  //    原本清單還沒回來時 list 是空陣列 → 每個分類都算出 0,
  //    畫面等於在跟客戶說「一個語音都沒有」,會以為系統壞了。
  if (State.loading.library || !State.loaded.library) {
    document.querySelectorAll('.vm-lang-count').forEach(el => { el.textContent = '…'; });
    return;
  }
  const list = State.voices.library || [];
  const base = list.filter(v => {
    if (State.search && !v.name?.toLowerCase().includes(State.search)) return false;
    if (State.filterGender !== 'all' && v.gender?.toLowerCase() !== State.filterGender) return false;
    return true;
  });
  const counts = {
    all: base.length,
    multilingual: base.filter(v => v.category === 'multilingual').length,
    chinese: base.filter(v => v.category === 'chinese').length,
    japanese: base.filter(v => v.category === 'japanese').length,
  };
  document.querySelectorAll('.vm-lang-count').forEach(el => {
    const key = el.dataset.count;
    el.textContent = counts[key] != null ? counts[key] : '—';
  });
}

// ─── Worker 呼叫 ──────────────────────────────────────────────
async function api(action, extra = {}) {
  const r = await fetch(State.workerUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: State.password, action, ...extra }),
  });
  return r.json();
}

async function loadLibraryVoices() {
  State.loading.library = true;
  if (State.currentTab === 'library') renderList();
  try {
    const res = await api('heygen_list_voices', {
      only_for_brandos: State.brandOSFilter,
    });
    if (res.ok) {
      State.voices.library = res.voices || [];
      State.voices.libraryRawTotal = res._total_raw || 0;
      try { if (typeof State._onLibLoaded === 'function') State._onLibLoaded(); } catch (_) {}
      State.loaded.library = true;
      updateCountChips();
    }
  } catch (e) {}
  State.loading.library = false;
  renderList();
}

// 切換「亞洲精選 / 全部 2305」模式（會重打 API）
function toggleBrandOSFilter() {
  State.brandOSFilter = !State.brandOSFilter;
  State.loaded.library = false;
  State.pageCount = 1;
  // 切到「全部」時，語言 chip 自動切回「全部」避免篩選怪怪
  State.filterLang = 'all';
  State.rootEl.querySelectorAll('.vm-lang-chip').forEach(chip => {
    chip.classList.toggle('active', chip.dataset.lang === 'all');
  });
  loadLibraryVoices();
}

function getFavoriteVoices() {
  const libMap = {};
  State.voices.library.forEach(v => { libMap[v.id] = v; });

  const favList = [];
  State.favorites.forEach(id => {
    if (libMap[id]) {
      favList.push(libMap[id]);
      return;
    }
    const custom = State.customVoices.find(v => v.id === id);
    if (custom) favList.push(custom);
  });
  return favList;
}

// 🔒 性別防呆：依 KOL 性別鎖定語音庫，杜絕男臉配女聲
function applyGenderLock(gender) {
  const g = (gender === 'male' || gender === 'female') ? gender : null;
  State.lockedGender = g;
  const sel = document.getElementById('vm-gender');
  if (g) {
    State.filterGender = g;
    if (sel) {
      sel.value = g;
      sel.disabled = true;
      sel.title = '已依 KOL 性別鎖定，不可更改';
      sel.style.opacity = '0.55';
      sel.style.cursor = 'not-allowed';
    }
  } else {
    State.filterGender = 'all';
    if (sel) {
      sel.value = 'all';
      sel.disabled = false;
      sel.title = '';
      sel.style.opacity = '';
      sel.style.cursor = '';
    }
  }
  State.pageCount = 1;
}

// ─── 渲染列表 ────────────────────────────────────────────────
function renderList() {
  const tab = State.currentTab;
  const container = document.getElementById('vm-list');
  if (!container) return;

  let rawList;
  if (tab === 'library') {
    if (State.loading.library) {
      container.innerHTML = '<div class="vm-loading">載入語音中…</div>';
      return;
    }
    rawList = State.voices.library || [];
  } else {
    rawList = getFavoriteVoices();
  }

  if (rawList.length === 0) {
    if (tab === 'favorites') {
      container.innerHTML = `
        <div class="vm-empty">
          <div class="vm-empty-icon">⭐</div>
          <div class="vm-empty-title">還沒有收藏的語音</div>
          <div class="vm-empty-desc">
            切換到「亞洲業務精選」按 ☆ 收藏喜歡的<br>
            或點上方「➕ 手動新增」把自己建立的 voice_id 加進來
          </div>
        </div>
      `;
    } else {
      container.innerHTML = '<div class="vm-empty"><div class="vm-empty-icon"></div><div class="vm-empty-title">找不到語音</div><div class="vm-empty-desc">請檢查 Worker 設定或語音庫狀態</div></div>';
    }
    updateLangChipCounts();
    return;
  }

  const filtered = filterVoices(rawList);
  updateLangChipCounts();

  if (filtered.length === 0) {
    container.innerHTML = '<div class="vm-empty"><div class="vm-empty-icon"></div><div class="vm-empty-title">沒有符合條件的語音</div><div class="vm-empty-desc">試試調整篩選條件或搜尋關鍵字</div></div>';
    return;
  }

  const isLibrary = tab === 'library';
  const total = filtered.length;
  const shownCount = isLibrary ? Math.min(State.pageCount * State.pageSize, total) : total;
  const shown = isLibrary ? filtered.slice(0, shownCount) : filtered;

  let html = shown.map((v, idx) => rowHTML(v, idx)).join('');

  if (isLibrary && shownCount < total) {
    const remaining = total - shownCount;
    html += `
      <button class="vm-load-more" id="vm-load-more">
        ⬇ 再載入 ${Math.min(State.pageSize, remaining)} 個（剩 ${remaining} 個）
      </button>
    `;
  } else if (isLibrary && total > State.pageSize) {
    html += `<div class="vm-list-footer">✓ 全部 ${total} 個語音已顯示</div>`;
  }

  container.innerHTML = html;

  const loadMoreBtn = container.querySelector('#vm-load-more');
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', () => {
      State.pageCount++;
      renderList();
    });
    // 🆕 捲到底自動載入下一批(按鈕保留當備援,舊瀏覽器沒有 IntersectionObserver 也能用)
    try {
      if (typeof IntersectionObserver !== 'undefined') {
        if (State._io) { try { State._io.disconnect(); } catch (_) {} }
        State._io = new IntersectionObserver((entries) => {
          if (entries.some(e => e.isIntersecting)) {
            try { State._io.disconnect(); } catch (_) {}
            State.pageCount++;
            renderList();
          }
        }, { root: container, rootMargin: '200px' });   // 提早 200px 就開始載,捲動不會頓
        State._io.observe(loadMoreBtn);
      }
    } catch (_) {}
  } else if (State._io) {
    try { State._io.disconnect(); } catch (_) {}
    State._io = null;
  }

  State.lastPlayingRowEl = null;
  State.lastSelectedRowEl = null;
  State.lastProgressRowEl = null;

  container.querySelectorAll('.vm-row').forEach(row => {
    const id = row.dataset.id;
    const v = shown.find(x => x.id === id);
    if (!v) return;
    row.addEventListener('click', (e) => {
      if (e.target.closest('.vm-star')) return;
      if (e.target.closest('.vm-delete-custom')) return;
      if (e.target.closest('.vm-play-btn')) {
        playVoice(v);
        return;
      }
      State.tentative = v;
      playVoice(v);
    });
    row.querySelector('.vm-star')?.addEventListener('click', e => {
      e.stopPropagation();
      toggleFavorite(v.id);
    });
    row.querySelector('.vm-delete-custom')?.addEventListener('click', e => {
      e.stopPropagation();
      deleteCustomVoice(v.id);
    });
  });

  syncRowPlayingState();
}

// v3.1 過濾邏輯：search + gender + 語言 chip
function filterVoices(list) {
  let out = list.filter(v => {
    if (State.search && !v.name?.toLowerCase().includes(State.search)) return false;
    if (State.filterGender !== 'all' && v.gender?.toLowerCase() !== State.filterGender) return false;
    // 🆕 v3.1 語言 chip 過濾（只有 library tab 才套用）
    if (State.currentTab === 'library' && State.filterLang !== 'all') {
      if (v.category !== State.filterLang) return false;
    }
    return true;
  });

  // 排序：收藏優先 → Multilingual 優先 → OpenAI 經典語音優先
  const openaiNames = new Set(['Coral', 'Nova', 'Onyx', 'Shimmer', 'Alloy', 'Echo', 'Fable']);
  out.sort((a, b) => {
    const favA = State.favorites.has(a.id) ? 0 : 1;
    const favB = State.favorites.has(b.id) ? 0 : 1;
    if (favA !== favB) return favA - favB;

    const mlA = a.is_multilingual ? 0 : 1;
    const mlB = b.is_multilingual ? 0 : 1;
    if (mlA !== mlB) return mlA - mlB;

    const oaA = openaiNames.has(a.name) ? 0 : 1;
    const oaB = openaiNames.has(b.name) ? 0 : 1;
    if (oaA !== oaB) return oaA - oaB;

    return 0;
  });
  return out;
}

// ─── Row HTML ────────────────────────────────────────────────
function rowHTML(v, idx) {
  const playing = State.playing?.id === v.id;
  const selected = State.tentative?.id === v.id;
  const fav = State.favorites.has(v.id);
  const flag = flagForLang(v.language, v.category);
  const engine = (v.engine || 'HeyGen').toLowerCase();
  const tagText = [v.tags?.slice(0, 3).join(' · ')].filter(Boolean).join(' · ') || v.language || '';
  const isCustom = !!v._custom;
  const isMulti = !!v.is_multilingual;

  // v3.1 效能：animation-delay 上限從 400ms 收到 200ms
  return `
    <div class="vm-row ${playing ? 'playing' : ''} ${selected ? 'selected' : ''}"
         id="vm-row-${cssSafeId(v.id)}"
         data-id="${esc(v.id)}"
         style="animation-delay:${Math.min(idx * 15, 200)}ms">
      <button class="vm-play-btn" aria-label="試聽">${playing ? '❚❚' : '▶'}</button>
      <div class="vm-info">
        <div class="vm-name">
          ${esc(v.name || '未命名')}
          ${isMulti ? '<span class="vm-multi-badge" title="支援多國語言，能講中/日/英/西等 40+ 種">Multilingual</span>' : ''}
          <span class="vm-engine-badge ${engine}">${esc(v.engine === 'ElevenLabs' ? '進階' : '標準')}</span>
          ${isCustom ? '<span class="vm-custom-badge">自訂</span>' : ''}
        </div>
        <div class="vm-tags">${esc(tagText)}</div>
      </div>
      <div class="vm-waveform">${waveformHTML(v.id)}</div>
      <span class="vm-flag" title="${esc(v.language || '')}">${flag}</span>
      ${v.gender ? `<span class="vm-gender-badge ${v.gender.toLowerCase()}">${v.gender.toUpperCase()}</span>` : '<span></span>'}
      <button class="vm-star ${fav ? 'starred' : ''}" aria-label="收藏">${fav ? '★' : '☆'}</button>
      ${isCustom ? '<button class="vm-delete-custom" title="刪除自訂語音" aria-label="刪除">🗑</button>' : ''}
    </div>
  `;
}

function waveformHTML(id) {
  const bars = 24;
  let seed = 0;
  for (let i = 0; i < id.length; i++) seed = (seed * 31 + id.charCodeAt(i)) >>> 0;
  let html = '';
  for (let i = 0; i < bars; i++) {
    seed = (seed * 1103515245 + 12345) >>> 0;
    const h = 20 + (seed % 70);
    html += `<div class="vm-waveform-bar" style="height:${h}%"></div>`;
  }
  return html;
}

// v3.1: 優先用 category 決定 flag（比 language 字串解析準）
function flagForLang(lang = '', category = '') {
  if (category === 'multilingual') return '';
  if (category === 'chinese') return '🇹🇼';
  if (category === 'japanese') return '🇯🇵';
  const L = lang.toLowerCase();
  if (L.includes('cantonese')) return '🇭🇰';
  if (L.includes('japanese')) return '🇯🇵';
  if (L.includes('taiwan')) return '🇹🇼';
  if (L.includes('chinese') || L.includes('mandarin')) return '🇨🇳';
  if (L.includes('english')) return '🇺🇸';
  if (L.includes('korean')) return '🇰🇷';
  if (L.includes('multilingual')) return '';
  return '';
}

// ─── 播放控制 ────────────────────────────────────────────────
function playVoice(v) {
  if (!v.preview_url) {
    toast('這個語音沒有試聽檔', 'warn');
    return;
  }

  if (State.playing?.id === v.id && !State.audio.paused) {
    State.audio.pause();
    updatePlayingUI();
    return;
  }

  try {
    State.audio.pause();
    State.audio.currentTime = 0;
  } catch {}

  State.audio.src = v.preview_url;
  State.audio.load();

  State.audio.play().then(() => {
    State.playing = v;
    State.tentative = v;
    updatePlayingUI();
    updateConfirmButton();
  }).catch(err => {
    if (err.name === 'AbortError') return;
    toast('試聽失敗：' + err.message, 'error');
  });
}

function togglePlayback() {
  if (!State.audio.src) return;
  if (State.audio.paused) {
    State.audio.play().catch(() => {});
    document.getElementById('vm-player-toggle').textContent = '❚❚';
  } else {
    State.audio.pause();
    document.getElementById('vm-player-toggle').textContent = '▶';
  }
}

function stopPlayback() {
  try { State.audio.pause(); } catch {}
  stopProgressLoop();
  State.playing = null;
  updatePlayingUI();
}

function updatePlayingUI() {
  syncRowPlayingState();

  const player = document.getElementById('vm-player');
  if (!player) return;
  if (State.tentative) {
    player.classList.add('show');
    document.getElementById('vm-player-name').textContent = State.tentative.name || '—';
    document.getElementById('vm-player-meta').textContent =
      [State.tentative.language, State.tentative.engine].filter(Boolean).join(' · ');
    document.getElementById('vm-player-toggle').textContent = State.audio.paused ? '▶' : '❚❚';
  } else {
    player.classList.remove('show');
  }
  updateConfirmButton();
}

function syncRowPlayingState() {
  const playingId = State.playing?.id;
  const selectedId = State.tentative?.id;
  const isAudioPlaying = playingId && !State.audio.paused;

  if (State.lastPlayingRowEl && State.lastPlayingRowEl.dataset.id !== playingId) {
    State.lastPlayingRowEl.classList.remove('playing');
    const oldBtn = State.lastPlayingRowEl.querySelector('.vm-play-btn');
    if (oldBtn) oldBtn.textContent = '▶';
    State.lastPlayingRowEl = null;
  }

  if (State.lastSelectedRowEl && State.lastSelectedRowEl.dataset.id !== selectedId) {
    State.lastSelectedRowEl.classList.remove('selected');
    State.lastSelectedRowEl = null;
  }

  if (playingId) {
    const row = document.getElementById('vm-row-' + cssSafeId(playingId));
    if (row) {
      row.classList.toggle('playing', isAudioPlaying);
      const btn = row.querySelector('.vm-play-btn');
      if (btn) btn.textContent = isAudioPlaying ? '❚❚' : '▶';
      if (isAudioPlaying) State.lastPlayingRowEl = row;
    }
  }

  if (selectedId) {
    const row = document.getElementById('vm-row-' + cssSafeId(selectedId));
    if (row) {
      row.classList.add('selected');
      State.lastSelectedRowEl = row;
    }
  }
}

function cssSafeId(s) {
  return String(s).replace(/[^a-zA-Z0-9_-]/g, '_');
}

function startProgressLoop() {
  stopProgressLoop();
  function loop() {
    updateProgress();
    State.audioRAF = requestAnimationFrame(loop);
  }
  State.audioRAF = requestAnimationFrame(loop);
}

function stopProgressLoop() {
  if (State.audioRAF) {
    cancelAnimationFrame(State.audioRAF);
    State.audioRAF = null;
  }
}

function updateProgress() {
  const cur = State.audio.currentTime;
  const dur = State.audio.duration || 0;
  if (!dur) return;
  const pct = (cur / dur) * 100;
  const fillEl = document.getElementById('vm-progress-fill');
  const timeEl = document.getElementById('vm-time');
  if (fillEl) fillEl.style.width = pct + '%';
  if (timeEl) timeEl.textContent = fmtTime(cur) + ' / ' + fmtTime(dur);

  const playingId = State.playing?.id;
  if (!playingId) return;

  if (!State.lastProgressRowEl || State.lastProgressRowEl.dataset.id !== playingId) {
    State.lastProgressRowEl = document.getElementById('vm-row-' + cssSafeId(playingId));
  }
  const row = State.lastProgressRowEl;
  if (!row) return;

  const bars = row.querySelectorAll('.vm-waveform-bar');
  if (!bars.length) return;
  const activeCount = Math.floor((cur / dur) * bars.length);
  bars.forEach((b, i) => {
    const shouldActive = i < activeCount;
    if (b.classList.contains('active') !== shouldActive) {
      b.classList.toggle('active', shouldActive);
    }
  });
}

function seekPlayback(e) {
  const rect = e.currentTarget.getBoundingClientRect();
  const ratio = (e.clientX - rect.left) / rect.width;
  if (State.audio.duration) {
    State.audio.currentTime = ratio * State.audio.duration;
  }
}

function playNextInList(delta) {
  const rows = Array.from(document.querySelectorAll('.vm-row'));
  if (!rows.length) return;
  let idx = rows.findIndex(r => r.dataset.id === State.playing?.id);
  idx = (idx + delta + rows.length) % rows.length;
  const nextId = rows[idx].dataset.id;
  const source = State.currentTab === 'library' ? State.voices.library : getFavoriteVoices();
  const v = source.find(x => x.id === nextId);
  if (v) { playVoice(v); rows[idx].scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
}

// ─── 收藏 ────────────────────────────────────────────────────
function toggleFavorite(id) {
  if (State.favorites.has(id)) State.favorites.delete(id);
  else State.favorites.add(id);
  localStorage.setItem(LS_FAV, JSON.stringify([...State.favorites]));
  renderList();
  updateCountChips();
}

// ─── 手動新增 voice_id ──────────────────────────────────
function openCustomModal() {
  const m = document.getElementById('vm-custom-modal');
  m.style.display = 'flex';
  ['vm-custom-id', 'vm-custom-name', 'vm-custom-preview'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('vm-custom-status').textContent = '';
  setTimeout(() => document.getElementById('vm-custom-id')?.focus(), 100);
}

function closeCustomModal() {
  document.getElementById('vm-custom-modal').style.display = 'none';
}

function submitCustomVoice() {
  const id = document.getElementById('vm-custom-id').value.trim();
  const name = document.getElementById('vm-custom-name').value.trim();
  const language = document.getElementById('vm-custom-lang').value;
  const gender = document.getElementById('vm-custom-gender').value;
  const engine = document.getElementById('vm-custom-engine').value;
  const preview_url = document.getElementById('vm-custom-preview').value.trim();
  const status = document.getElementById('vm-custom-status');

  if (!id || id.length < 8) {
    status.innerHTML = '<span style="color:#fa6d9b">❌ voice_id 必填，且至少 8 個字</span>';
    return;
  }
  if (!name) {
    status.innerHTML = '<span style="color:#fa6d9b">❌ 顯示名稱必填</span>';
    return;
  }

  if (State.customVoices.some(v => v.id === id)) {
    status.innerHTML = '<span style="color:#ffa94d">⚠️ 這個 voice_id 已經新增過了</span>';
    return;
  }

  // 🆕 v3.1: 自訂語音也給 category 欄位
  let category = 'other';
  if (language === 'Multilingual') category = 'multilingual';
  else if (language === 'Chinese') category = 'chinese';
  else if (language === 'Japanese') category = 'japanese';

  const newVoice = {
    id,
    name,
    language,
    gender,
    engine,
    preview_url,
    tags: [],
    category,
    is_multilingual: category === 'multilingual',
    _custom: true,
  };

  State.customVoices.push(newVoice);
  localStorage.setItem(LS_CUSTOM, JSON.stringify(State.customVoices));

  State.favorites.add(id);
  localStorage.setItem(LS_FAV, JSON.stringify([...State.favorites]));

  status.innerHTML = '<span style="color:#6dfac2">✅ 已新增並加入收藏</span>';
  setTimeout(() => {
    closeCustomModal();
    switchTab('favorites');
  }, 800);
}

function deleteCustomVoice(id) {
  if (!confirm('刪除這個自訂語音？')) return;
  State.customVoices = State.customVoices.filter(v => v.id !== id);
  localStorage.setItem(LS_CUSTOM, JSON.stringify(State.customVoices));
  State.favorites.delete(id);
  localStorage.setItem(LS_FAV, JSON.stringify([...State.favorites]));
  renderList();
  updateCountChips();
}

// ─── 確認選用 ────────────────────────────────────────────────
function updateConfirmButton() {
  const btn = document.getElementById('vm-confirm-btn');
  if (!btn) return;
  btn.disabled = !State.tentative;
}

function confirmSelection() {
  if (!State.tentative) return;
  State.confirmed = State.tentative;
  localStorage.setItem(LS_CONFIRMED, JSON.stringify(State.confirmed));
  State.onSelect(State.confirmed);
  VoiceModal.close();
}

// ─── 工具 ────────────────────────────────────────────────────
function esc(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

function fmtTime(sec) {
  if (!isFinite(sec)) return '00:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function debounce(fn, wait) {
  let t; return function () {
    clearTimeout(t);
    const args = arguments;
    t = setTimeout(() => fn.apply(null, args), wait);
  };
}

function toast(msg, type = '') {
  if (typeof window.toast === 'function') return window.toast(msg, type);
  console.log('[Voice Modal]', type, msg);
}

})(window);
