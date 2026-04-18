/* ═══════════════════════════════════════════════════════════════
 *  Voice Modal v2 — 收藏模式 + 手動新增 voice_id
 *
 *  v2 重大改動（2026-04）：
 *    • 移除不可用的 3 個 Tab（我的語音/Clone/Design 都沒 API）
 *    • 改成 2 個 Tab：[⭐ 我的收藏]  [🌏 HeyGen 語音庫 2305]
 *    • 新增「手動新增 voice_id」功能
 *      → 可以把 HeyGen 網頁上的 ElevenLabs 匯入語音（如 Morioki）
 *        手動輸入 voice_id 加進收藏
 *    • 修 bug：連選兩個語音會卡住（先 pause 再換 src）
 *    • 修 bug：進度條頓頓的（改用 requestAnimationFrame）
 *
 *  使用方式：
 *    VoiceModal.init({ workerUrl, password, onSelect: v => {...} });
 *    VoiceModal.open();
 *    VoiceModal.getSelected();
 *  依賴：voice-modal.css
 * ═══════════════════════════════════════════════════════════════ */
(function (global) {
'use strict';

// ─── 狀態 ─────────────────────────────────────────────────────
const State = {
  workerUrl: '',
  password: '',
  onSelect: null,

  rootEl: null,
  currentTab: 'favorites',   // 'favorites' | 'library'
  voices: { library: [] },
  loading: { library: false },
  loaded:  { library: false },

  search: '',
  filterLang: 'all',
  filterGender: 'all',
  filterEngine: 'all',
  filterFav: false,

  playing: null,
  tentative: null,
  confirmed: null,
  favorites: new Set(),          // 收藏的 voice_id
  customVoices: [],              // 🆕 使用者手動輸入的語音（附完整資訊）

  audio: new Audio(),
  audioRAF: null,                // 🆕 requestAnimationFrame id

  // 🚀 v2.1 效能優化
  pageSize: 50,                  // 每頁顯示幾個
  pageCount: 1,                  // 目前顯示到第幾頁
  lastPlayingRowEl: null,        // 上一次播放的 row DOM 引用（精準更新用）
  lastSelectedRowEl: null,       // 上一次選中的 row DOM 引用
  lastProgressRowEl: null,       // 上一次進度條更新的 row
};

const LS_FAV = 'bos_voice_favorites_v1';
const LS_CONFIRMED = 'bos_voice_confirmed_v1';
const LS_CUSTOM = 'bos_voice_custom_v1';    // 🆕

// ─── Public API ───────────────────────────────────────────────
const VoiceModal = {
  init(opts) {
    State.workerUrl = opts.workerUrl;
    State.password  = opts.password;
    State.onSelect  = opts.onSelect || function () {};

    // 載入本地收藏
    try {
      const saved = JSON.parse(localStorage.getItem(LS_FAV) || '[]');
      State.favorites = new Set(saved);
    } catch {}

    // 載入上次確認的語音
    try {
      const saved = JSON.parse(localStorage.getItem(LS_CONFIRMED) || 'null');
      if (saved && saved.id) State.confirmed = saved;
    } catch {}

    // 🆕 載入手動新增的自訂語音
    try {
      const saved = JSON.parse(localStorage.getItem(LS_CUSTOM) || '[]');
      if (Array.isArray(saved)) State.customVoices = saved;
    } catch {}

    // 建立 modal DOM（只建一次）
    if (!document.getElementById('vm-root')) {
      const root = document.createElement('div');
      root.id = 'vm-root';
      root.className = 'vm-modal';
      root.innerHTML = buildModalHTML();
      document.body.appendChild(root);
      State.rootEl = root;
      bindEvents();
    }

    // audio 事件（🔧 v2: 改用 RAF 跑進度，不綁 timeupdate）
    State.audio.addEventListener('ended', () => {
      stopProgressLoop();
      State.playing = null;
      updatePlayingUI();
    });
    State.audio.addEventListener('play', startProgressLoop);
    State.audio.addEventListener('pause', stopProgressLoop);

    // 鍵盤快捷鍵
    document.addEventListener('keydown', handleKey);
  },

  open() {
    if (!State.rootEl) return;
    State.tentative = State.confirmed;
    State.rootEl.classList.add('open');
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
};

global.VoiceModal = VoiceModal;

// ─── Modal HTML 結構 ──────────────────────────────────────────
function buildModalHTML() {
  return `
    <div class="vm-header">
      <div>
        <h2>選擇口播語音</h2>
        <div class="vm-subtitle">收藏常用語音 · 手動輸入 HeyGen 網頁的自訂 voice_id</div>
      </div>
      <button class="vm-close" id="vm-close" aria-label="關閉">✕</button>
    </div>

    <div class="vm-tabs">
      <button class="vm-tab active" data-tab="favorites">
        ⭐ 我的收藏 <span class="vm-tab-count" id="vm-count-favorites">—</span>
      </button>
      <button class="vm-tab" data-tab="library">
        🌏 HeyGen 語音庫 <span class="vm-tab-count" id="vm-count-library">—</span>
      </button>
    </div>

    <div class="vm-filterbar" id="vm-filterbar">
      <div class="vm-search">
        <input type="text" id="vm-search" placeholder="搜尋語音名稱..." autocomplete="off">
      </div>
      <div class="vm-chip-select">
        <select id="vm-lang">
          <option value="all">全部語言</option>
          <option value="zh-tw">🇹🇼 繁體中文</option>
          <option value="cantonese">🇭🇰 粵語</option>
          <option value="japanese">🇯🇵 日文</option>
          <option value="chinese">🇨🇳 簡體中文</option>
          <option value="english">🇺🇸 英文</option>
          <option value="multilingual">🌏 多國語言</option>
        </select>
      </div>
      <div class="vm-chip-select">
        <select id="vm-gender">
          <option value="all">全部性別</option>
          <option value="female">女聲</option>
          <option value="male">男聲</option>
        </select>
      </div>
      <div class="vm-chip-select">
        <select id="vm-engine">
          <option value="all">全部引擎</option>
          <option value="ElevenLabs">ElevenLabs（最擬真）</option>
          <option value="Azure">Azure（穩定）</option>
          <option value="HeyGen">HeyGen 自研</option>
          <option value="Fish">Fish</option>
        </select>
      </div>
      <button class="vm-add-btn" id="vm-add-custom-btn" title="手動新增 voice_id">
        ➕ 手動新增
      </button>
    </div>

    <div class="vm-list-container" id="vm-list"></div>

    <!-- 🆕 手動新增 voice_id Modal -->
    <div class="vm-sub-modal" id="vm-custom-modal" style="display:none">
      <div class="vm-sub-card">
        <div class="vm-sub-header">
          <h3>手動新增 voice_id</h3>
          <button class="vm-sub-close" id="vm-custom-close">✕</button>
        </div>
        <div class="vm-sub-body">
          <div class="vm-info-box">
            💡 從 HeyGen 網頁複製你自己建立的 voice_id（例如 ElevenLabs 匯入的語音）。
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
                <option value="English">英文</option>
                <option value="Japanese">日文</option>
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
                <option value="ElevenLabs">ElevenLabs</option>
                <option value="HeyGen">HeyGen</option>
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

  // Tab 切換
  root.querySelectorAll('.vm-tab').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // 篩選器
  root.querySelector('#vm-search').addEventListener('input', debounce(e => {
    State.search = e.target.value.trim().toLowerCase();
    State.pageCount = 1;   // 🚀 重設分頁
    renderList();
  }, 200));
  root.querySelector('#vm-lang').addEventListener('change', e => {
    State.filterLang = e.target.value; State.pageCount = 1; renderList();
  });
  root.querySelector('#vm-gender').addEventListener('change', e => {
    State.filterGender = e.target.value; State.pageCount = 1; renderList();
  });
  root.querySelector('#vm-engine').addEventListener('change', e => {
    State.filterEngine = e.target.value; State.pageCount = 1; renderList();
  });

  // 🆕 手動新增
  root.querySelector('#vm-add-custom-btn').addEventListener('click', openCustomModal);
  root.querySelector('#vm-custom-close').addEventListener('click', closeCustomModal);
  root.querySelector('#vm-custom-submit').addEventListener('click', submitCustomVoice);

  // 底部播放器
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
  State.pageCount = 1;   // 🚀 切換 tab 時重設分頁
  const root = State.rootEl;
  root.querySelectorAll('.vm-tab').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });

  // 兩個 Tab 都有篩選器
  root.querySelector('#vm-filterbar').style.display = 'flex';

  // 底部播放器：有暫選才顯示
  root.querySelector('#vm-player').classList.toggle(
    'show', !!State.tentative
  );

  if (tab === 'library') {
    if (!State.loaded.library) loadLibraryVoices();
    else renderList();
  } else {
    // favorites Tab
    renderList();
    // 如果收藏要顯示語音，library 必須先載入（才能拿到 name/preview 等）
    if (!State.loaded.library && State.favorites.size > 0) {
      loadLibraryVoices();
    }
  }
  updateCountChips();
}

function updateCountChips() {
  // 收藏數：favorites set 的大小 + customVoices（已自動加入收藏）
  const favCount = getFavoriteVoices().length;
  const favEl = document.getElementById('vm-count-favorites');
  if (favEl) favEl.textContent = favCount;
  const libEl = document.getElementById('vm-count-library');
  if (libEl) libEl.textContent = State.voices.library.length || '—';
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
    const res = await api('heygen_list_voices');
    if (res.ok) {
      State.voices.library = res.voices || [];
      State.loaded.library = true;
      updateCountChips();
    }
  } catch (e) {}
  State.loading.library = false;
  renderList();
}

// 🆕 拿到所有「我的收藏」完整資訊（library + custom 都查）
function getFavoriteVoices() {
  const libMap = {};
  State.voices.library.forEach(v => { libMap[v.id] = v; });

  const favList = [];
  State.favorites.forEach(id => {
    // 先從 library 找
    if (libMap[id]) {
      favList.push(libMap[id]);
      return;
    }
    // 再從 customVoices 找
    const custom = State.customVoices.find(v => v.id === id);
    if (custom) favList.push(custom);
  });
  return favList;
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
    // favorites
    rawList = getFavoriteVoices();
  }

  if (rawList.length === 0) {
    if (tab === 'favorites') {
      container.innerHTML = `
        <div class="vm-empty">
          <div class="vm-empty-icon">⭐</div>
          <div class="vm-empty-title">還沒有收藏的語音</div>
          <div class="vm-empty-desc">
            切換到「HeyGen 語音庫」按 ☆ 收藏喜歡的<br>
            或點上方「➕ 手動新增」把自己建立的 voice_id 加進來
          </div>
        </div>
      `;
    } else {
      container.innerHTML = '<div class="vm-empty"><div class="vm-empty-icon">🎤</div><div class="vm-empty-title">找不到語音</div><div class="vm-empty-desc">請檢查 Worker 設定或 HeyGen API 狀態</div></div>';
    }
    return;
  }

  const filtered = filterVoices(rawList);

  if (filtered.length === 0) {
    container.innerHTML = '<div class="vm-empty"><div class="vm-empty-icon">🔍</div><div class="vm-empty-title">沒有符合條件的語音</div><div class="vm-empty-desc">試試調整篩選條件或搜尋關鍵字</div></div>';
    return;
  }

  // 🚀 v2.1 分頁優化：預設只渲染前 N 個，避免 2305 個 DOM 同時存在
  // 收藏 tab 通常不會超過 50 個，不做分頁也沒關係
  const isLibrary = tab === 'library';
  const total = filtered.length;
  const shownCount = isLibrary ? Math.min(State.pageCount * State.pageSize, total) : total;
  const shown = isLibrary ? filtered.slice(0, shownCount) : filtered;

  let html = shown.map((v, idx) => rowHTML(v, idx)).join('');

  // 底部「載入更多」按鈕
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

  // 「載入更多」點擊
  const loadMoreBtn = container.querySelector('#vm-load-more');
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', () => {
      State.pageCount++;
      renderList();
    });
  }

  // 🚀 v2.1: 清掉舊的 DOM 引用（避免指向已不存在的節點）
  State.lastPlayingRowEl = null;
  State.lastSelectedRowEl = null;
  State.lastProgressRowEl = null;

  // 綁定列事件（只綁 shown 那些，不是 filtered 全部）
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

  // 渲染完立即同步播放狀態（避免切 tab 或載入更多時 UI 不同步）
  syncRowPlayingState();
}

function filterVoices(list) {
  let out = list.filter(v => {
    if (State.search && !v.name?.toLowerCase().includes(State.search)) return false;
    if (State.filterLang !== 'all' && !langMatch(v.language, State.filterLang)) return false;
    if (State.filterGender !== 'all' && v.gender?.toLowerCase() !== State.filterGender) return false;
    if (State.filterEngine !== 'all' && v.engine !== State.filterEngine) return false;
    return true;
  });
  // 排序：收藏優先 → 繁中優先
  out.sort((a, b) => {
    const favA = State.favorites.has(a.id) ? 0 : 1;
    const favB = State.favorites.has(b.id) ? 0 : 1;
    if (favA !== favB) return favA - favB;
    const zhA = langMatch(a.language, 'zh-tw') ? 0 : 1;
    const zhB = langMatch(b.language, 'zh-tw') ? 0 : 1;
    if (zhA !== zhB) return zhA - zhB;
    return 0;
  });
  return out;
}

function langMatch(voiceLang, filter) {
  const L = (voiceLang || '').toLowerCase();
  if (filter === 'all') return true;
  if (filter === 'zh-tw') return L.includes('chinese') || L.includes('taiwan') || L.includes('mandarin');
  if (filter === 'chinese') return L.includes('chinese') || L.includes('mandarin');
  if (filter === 'cantonese') return L.includes('cantonese');
  if (filter === 'japanese') return L.includes('japanese');
  if (filter === 'english') return L.includes('english');
  if (filter === 'multilingual') return L.includes('multilingual');
  return true;
}

// ─── Row HTML ────────────────────────────────────────────────
function rowHTML(v, idx) {
  const playing = State.playing?.id === v.id;
  const selected = State.tentative?.id === v.id;
  const fav = State.favorites.has(v.id);
  const flag = flagForLang(v.language);
  const engine = (v.engine || 'HeyGen').toLowerCase();
  const tagText = [v.tags?.slice(0, 3).join(' · ')].filter(Boolean).join(' · ') || v.language || '';
  const isCustom = !!v._custom;

  return `
    <div class="vm-row ${playing ? 'playing' : ''} ${selected ? 'selected' : ''}"
         id="vm-row-${cssSafeId(v.id)}"
         data-id="${esc(v.id)}"
         style="animation-delay:${Math.min(idx * 20, 400)}ms">
      <button class="vm-play-btn" aria-label="試聽">${playing ? '❚❚' : '▶'}</button>
      <div class="vm-info">
        <div class="vm-name">
          ${esc(v.name || '未命名')}
          <span class="vm-engine-badge ${engine}">${esc(v.engine || 'HeyGen')}</span>
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

function flagForLang(lang = '') {
  const L = lang.toLowerCase();
  if (L.includes('cantonese')) return '🇭🇰';
  if (L.includes('japanese')) return '🇯🇵';
  if (L.includes('taiwan')) return '🇹🇼';
  if (L.includes('chinese') || L.includes('mandarin')) return '🇨🇳';
  if (L.includes('english')) return '🇺🇸';
  if (L.includes('korean')) return '🇰🇷';
  if (L.includes('multilingual')) return '🌏';
  return '🌐';
}

// ─── 播放控制（v2: 修 bug）──────────────────────────────────
function playVoice(v) {
  if (!v.preview_url) {
    toast('這個語音沒有試聽檔', 'warn');
    return;
  }

  // 如果點的是正在播放的同一個，切換暫停/播放
  if (State.playing?.id === v.id && !State.audio.paused) {
    State.audio.pause();
    // 保留 State.playing 讓 UI 顯示暫停狀態
    updatePlayingUI();
    return;
  }

  // 🔧 v2 修 bug：換語音前先完全停掉舊的，避免卡住
  try {
    State.audio.pause();
    State.audio.currentTime = 0;
    // 不清 src，直接覆蓋（清了某些瀏覽器會多一次 load 延遲）
  } catch {}

  State.audio.src = v.preview_url;
  State.audio.load();  // 🔧 v2: 明確要求重新載入

  State.audio.play().then(() => {
    State.playing = v;
    State.tentative = v;
    updatePlayingUI();
    updateConfirmButton();
  }).catch(err => {
    if (err.name === 'AbortError') return;  // 用戶快速連點造成的取消，忽略
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
  // 🚀 v2.1 效能優化：不再 querySelectorAll 掃 2305 個 row
  // 只動「上一次」和「這一次」相關的 2-3 個 row，從 O(N) 降到 O(1)
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

// 🚀 v2.1 新增：精準同步 row 狀態（只動 3 個以內的 DOM）
function syncRowPlayingState() {
  const playingId = State.playing?.id;
  const selectedId = State.tentative?.id;
  const isAudioPlaying = playingId && !State.audio.paused;

  // 清掉舊的 playing row（如果換人了）
  if (State.lastPlayingRowEl && State.lastPlayingRowEl.dataset.id !== playingId) {
    State.lastPlayingRowEl.classList.remove('playing');
    const oldBtn = State.lastPlayingRowEl.querySelector('.vm-play-btn');
    if (oldBtn) oldBtn.textContent = '▶';
    State.lastPlayingRowEl = null;
  }

  // 清掉舊的 selected row（如果換人了）
  if (State.lastSelectedRowEl && State.lastSelectedRowEl.dataset.id !== selectedId) {
    State.lastSelectedRowEl.classList.remove('selected');
    State.lastSelectedRowEl = null;
  }

  // 設定新的 playing row（getElementById 一次，不掃全部）
  if (playingId) {
    const row = document.getElementById('vm-row-' + cssSafeId(playingId));
    if (row) {
      row.classList.toggle('playing', isAudioPlaying);
      const btn = row.querySelector('.vm-play-btn');
      if (btn) btn.textContent = isAudioPlaying ? '❚❚' : '▶';
      if (isAudioPlaying) State.lastPlayingRowEl = row;
    }
  }

  // 設定新的 selected row
  if (selectedId) {
    const row = document.getElementById('vm-row-' + cssSafeId(selectedId));
    if (row) {
      row.classList.add('selected');
      State.lastSelectedRowEl = row;
    }
  }
}

// 把 voice_id 變成 HTML id 安全字串（voice_id 理論上都是 hex，但防呆）
function cssSafeId(s) {
  return String(s).replace(/[^a-zA-Z0-9_-]/g, '_');
}

// 🔧 v2 修 bug：進度條改用 requestAnimationFrame 流暢更新
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

  // 🚀 v2.1 效能優化：波形更新改用快取 row 引用
  // 每 16ms 跑一次，不能每次都 querySelector
  const playingId = State.playing?.id;
  if (!playingId) return;

  // 快取失效（換人或首次）→ 重找一次
  if (!State.lastProgressRowEl || State.lastProgressRowEl.dataset.id !== playingId) {
    State.lastProgressRowEl = document.getElementById('vm-row-' + cssSafeId(playingId));
  }
  const row = State.lastProgressRowEl;
  if (!row) return;

  const bars = row.querySelectorAll('.vm-waveform-bar');
  if (!bars.length) return;
  const activeCount = Math.floor((cur / dur) * bars.length);
  // 只更新跨界的那根（大部分情況 1 根），避免每次 toggle 24 根
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
  // 從當前 tab 的資料源找
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

// ─── 🆕 手動新增 voice_id ──────────────────────────────────
function openCustomModal() {
  const m = document.getElementById('vm-custom-modal');
  m.style.display = 'flex';
  // 清空表單
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

  // 檢查重複
  if (State.customVoices.some(v => v.id === id)) {
    status.innerHTML = '<span style="color:#ffa94d">⚠️ 這個 voice_id 已經新增過了</span>';
    return;
  }

  const newVoice = {
    id,
    name,
    language,
    gender,
    engine,
    preview_url,
    tags: [],
    _custom: true,  // 標記是自訂的
  };

  State.customVoices.push(newVoice);
  localStorage.setItem(LS_CUSTOM, JSON.stringify(State.customVoices));

  // 自動加入收藏
  State.favorites.add(id);
  localStorage.setItem(LS_FAV, JSON.stringify([...State.favorites]));

  status.innerHTML = '<span style="color:#6dfac2">✅ 已新增並加入收藏</span>';
  setTimeout(() => {
    closeCustomModal();
    // 切到收藏 Tab 給用戶看結果
    switchTab('favorites');
  }, 800);
}

function deleteCustomVoice(id) {
  if (!confirm('刪除這個自訂語音？')) return;
  State.customVoices = State.customVoices.filter(v => v.id !== id);
  localStorage.setItem(LS_CUSTOM, JSON.stringify(State.customVoices));
  // 同時從收藏移除
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
