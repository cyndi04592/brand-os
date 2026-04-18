/* ═══════════════════════════════════════════════════════════════
 *  Voice Modal — Artlist 風語音選擇器
 *  使用方式：
 *    VoiceModal.init({ workerUrl, password, onSelect: v => {...} });
 *    VoiceModal.open();                 // 打開 modal
 *    VoiceModal.getSelected();          // 取得當前選中的 voice
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
  currentTab: 'library',    // 'library' | 'mine' | 'design' | 'clone'
  voices: { library: [], mine: [] },
  loading: { library: false, mine: false },
  loaded:  { library: false, mine: false },

  search: '',
  filterLang: 'all',
  filterGender: 'all',
  filterEngine: 'all',

  playing: null,             // 當前播放中的 voice
  tentative: null,           // 暫時選中（還沒按「選用此語音」）
  confirmed: null,           // 已確認選中（最終回傳給主頁）
  favorites: new Set(),      // 收藏的 voice_id

  audio: new Audio(),
  audioRAF: null,

  designCandidates: [],      // voice design 結果暫存
};

const LS_FAV = 'bos_voice_favorites_v1';
const LS_CONFIRMED = 'bos_voice_confirmed_v1';

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

    // audio 事件
    State.audio.addEventListener('ended', () => stopPlayback());
    State.audio.addEventListener('timeupdate', updateProgress);

    // 鍵盤快捷鍵
    document.addEventListener('keydown', handleKey);
  },

  open() {
    if (!State.rootEl) return;
    State.tentative = State.confirmed;  // 開啟時以已確認的為預選
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
        <div class="vm-subtitle">全球數百款 AI 語音，客製你的 KOL 聲音</div>
      </div>
      <button class="vm-close" id="vm-close" aria-label="關閉">✕</button>
    </div>

    <div class="vm-tabs">
      <button class="vm-tab active" data-tab="library">
        🌏 HeyGen 語音庫 <span class="vm-tab-count" id="vm-count-library">—</span>
      </button>
      <button class="vm-tab" data-tab="mine">
        🎤 我的語音 <span class="vm-tab-count" id="vm-count-mine">—</span>
      </button>
      <button class="vm-tab" data-tab="clone">
        ➕ 建立語音複製
      </button>
      <button class="vm-tab" data-tab="design">
        ✨ AI 設計語音
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
      <div class="vm-chip-select">
        <select id="vm-favorite">
          <option value="all">全部</option>
          <option value="fav">⭐ 只看收藏</option>
        </select>
      </div>
    </div>

    <div class="vm-list-container" id="vm-list"></div>

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
    renderList();
  }, 200));
  root.querySelector('#vm-lang').addEventListener('change', e => {
    State.filterLang = e.target.value; renderList();
  });
  root.querySelector('#vm-gender').addEventListener('change', e => {
    State.filterGender = e.target.value; renderList();
  });
  root.querySelector('#vm-engine').addEventListener('change', e => {
    State.filterEngine = e.target.value; renderList();
  });
  root.querySelector('#vm-favorite').addEventListener('change', e => {
    State.filterFav = e.target.value === 'fav'; renderList();
  });

  // 底部播放器
  root.querySelector('#vm-player-toggle').addEventListener('click', togglePlayback);
  root.querySelector('#vm-progress').addEventListener('click', seekPlayback);
  root.querySelector('#vm-confirm-btn').addEventListener('click', confirmSelection);
}

function handleKey(e) {
  if (!State.rootEl?.classList.contains('open')) return;
  if (e.key === 'Escape') { VoiceModal.close(); return; }
  // 只有在非輸入框時響應空白鍵
  const tag = e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  if (e.key === ' ') { e.preventDefault(); togglePlayback(); }
  if (e.key === 'ArrowDown') { e.preventDefault(); playNextInList(+1); }
  if (e.key === 'ArrowUp')   { e.preventDefault(); playNextInList(-1); }
}

// ─── Tab 切換 ────────────────────────────────────────────────
function switchTab(tab) {
  State.currentTab = tab;
  const root = State.rootEl;
  root.querySelectorAll('.vm-tab').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });

  // 篩選器僅對 library / mine 顯示
  root.querySelector('#vm-filterbar').style.display =
    (tab === 'library' || tab === 'mine') ? 'flex' : 'none';

  // 底部播放器僅對列表頁顯示
  root.querySelector('#vm-player').classList.toggle(
    'show', (tab === 'library' || tab === 'mine') && !!State.tentative
  );

  if (tab === 'library') {
    if (!State.loaded.library) loadLibraryVoices();
    else renderList();
  } else if (tab === 'mine') {
    if (!State.loaded.mine) loadMyVoices();
    else renderList();
  } else if (tab === 'clone') {
    renderCloneUI();
  } else if (tab === 'design') {
    renderDesignUI();
  }
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
  renderList();
  try {
    const res = await api('heygen_list_voices');
    if (res.ok) {
      State.voices.library = res.voices || [];
      State.loaded.library = true;
      document.getElementById('vm-count-library').textContent = State.voices.library.length;
    }
  } catch (e) {}
  State.loading.library = false;
  renderList();
}

async function loadMyVoices() {
  State.loading.mine = true;
  renderList();
  try {
    const res = await api('heygen_list_my_voices');
    if (res.ok) {
      State.voices.mine = res.voices || [];
      State.loaded.mine = true;
      document.getElementById('vm-count-mine').textContent = State.voices.mine.length;
    }
  } catch (e) {}
  State.loading.mine = false;
  renderList();
}

// ─── 渲染列表 ────────────────────────────────────────────────
function renderList() {
  const tab = State.currentTab;
  const container = document.getElementById('vm-list');
  if (!container) return;

  if (tab !== 'library' && tab !== 'mine') return;

  if (State.loading[tab]) {
    container.innerHTML = '<div class="vm-loading">載入語音中…</div>';
    return;
  }

  const rawList = State.voices[tab] || [];
  if (rawList.length === 0) {
    container.innerHTML = tab === 'library'
      ? '<div class="vm-empty"><div class="vm-empty-icon">🎤</div><div class="vm-empty-title">找不到語音</div><div class="vm-empty-desc">請檢查 Worker 設定或 HeyGen API 狀態</div></div>'
      : '<div class="vm-empty"><div class="vm-empty-icon">🎤</div><div class="vm-empty-title">你還沒有自己的語音</div><div class="vm-empty-desc">切換到「建立語音複製」或「AI 設計語音」開始建立</div></div>';
    return;
  }

  const filtered = filterVoices(rawList);

  if (filtered.length === 0) {
    container.innerHTML = '<div class="vm-empty"><div class="vm-empty-icon">🔍</div><div class="vm-empty-title">沒有符合條件的語音</div><div class="vm-empty-desc">試試調整篩選條件或搜尋關鍵字</div></div>';
    return;
  }

  container.innerHTML = filtered.map((v, idx) => rowHTML(v, idx)).join('');

  // 綁定列事件
  container.querySelectorAll('.vm-row').forEach(row => {
    const id = row.dataset.id;
    const v = filtered.find(x => x.id === id);
    if (!v) return;
    row.addEventListener('click', (e) => {
      if (e.target.closest('.vm-star')) return;
      if (e.target.closest('.vm-play-btn')) {
        playVoice(v);
        return;
      }
      // 點整列：暫選 + 播放
      State.tentative = v;
      playVoice(v);
    });
    row.querySelector('.vm-star')?.addEventListener('click', e => {
      e.stopPropagation();
      toggleFavorite(v.id);
    });
  });
}

function filterVoices(list) {
  let out = list.filter(v => {
    if (State.search && !v.name?.toLowerCase().includes(State.search)) return false;
    if (State.filterLang !== 'all' && !langMatch(v.language, State.filterLang)) return false;
    if (State.filterGender !== 'all' && v.gender?.toLowerCase() !== State.filterGender) return false;
    if (State.filterEngine !== 'all' && v.engine !== State.filterEngine) return false;
    if (State.filterFav && !State.favorites.has(v.id)) return false;
    return true;
  });
  // 排序：收藏優先 → 繁中優先 → 有 preview_url 優先
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

  return `
    <div class="vm-row ${playing ? 'playing' : ''} ${selected ? 'selected' : ''}"
         data-id="${esc(v.id)}"
         style="animation-delay:${Math.min(idx * 20, 400)}ms">
      <button class="vm-play-btn" aria-label="試聽">${playing ? '❚❚' : '▶'}</button>
      <div class="vm-info">
        <div class="vm-name">
          ${esc(v.name || '未命名')}
          <span class="vm-engine-badge ${engine}">${esc(v.engine || 'HeyGen')}</span>
        </div>
        <div class="vm-tags">${esc(tagText)}</div>
      </div>
      <div class="vm-waveform">${waveformHTML(v.id)}</div>
      <span class="vm-flag" title="${esc(v.language || '')}">${flag}</span>
      ${v.gender ? `<span class="vm-gender-badge ${v.gender.toLowerCase()}">${v.gender.toUpperCase()}</span>` : '<span></span>'}
      <button class="vm-star ${fav ? 'starred' : ''}" aria-label="收藏">${fav ? '★' : '☆'}</button>
    </div>
  `;
}

// 生成偽隨機但穩定的波形（用 id hash 當 seed）
function waveformHTML(id) {
  const bars = 24;
  let seed = 0;
  for (let i = 0; i < id.length; i++) seed = (seed * 31 + id.charCodeAt(i)) >>> 0;
  let html = '';
  for (let i = 0; i < bars; i++) {
    seed = (seed * 1103515245 + 12345) >>> 0;
    const h = 20 + (seed % 70);  // 20-90% 高度
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

// ─── 播放控制 ────────────────────────────────────────────────
function playVoice(v) {
  if (!v.preview_url) {
    toast('這個語音沒有試聽檔', 'warn');
    return;
  }
  if (State.playing?.id === v.id && !State.audio.paused) {
    State.audio.pause();
    State.playing = null;
    updatePlayingUI();
    return;
  }

  State.audio.src = v.preview_url;
  State.audio.play().then(() => {
    State.playing = v;
    State.tentative = v;
    updatePlayingUI();
    updateConfirmButton();
  }).catch(err => {
    toast('試聽失敗：' + err.message, 'error');
  });
}

function togglePlayback() {
  if (!State.audio.src) return;
  if (State.audio.paused) {
    State.audio.play();
    document.getElementById('vm-player-toggle').textContent = '❚❚';
  } else {
    State.audio.pause();
    document.getElementById('vm-player-toggle').textContent = '▶';
  }
}

function stopPlayback() {
  State.audio.pause();
  State.playing = null;
  updatePlayingUI();
}

function updatePlayingUI() {
  // 更新列表高亮
  document.querySelectorAll('.vm-row').forEach(row => {
    const isPlaying = row.dataset.id === State.playing?.id;
    const isSelected = row.dataset.id === State.tentative?.id;
    row.classList.toggle('playing', isPlaying);
    row.classList.toggle('selected', isSelected);
    const btn = row.querySelector('.vm-play-btn');
    if (btn) btn.textContent = isPlaying ? '❚❚' : '▶';
  });
  // 底部播放器
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

function updateProgress() {
  const cur = State.audio.currentTime;
  const dur = State.audio.duration || 0;
  if (!dur) return;
  const pct = (cur / dur) * 100;
  document.getElementById('vm-progress-fill').style.width = pct + '%';
  document.getElementById('vm-time').textContent = fmtTime(cur) + ' / ' + fmtTime(dur);

  // 波形進度（只改播放中那列）
  const row = document.querySelector(`.vm-row[data-id="${State.playing?.id}"]`);
  if (row) {
    const bars = row.querySelectorAll('.vm-waveform-bar');
    const activeCount = Math.floor((cur / dur) * bars.length);
    bars.forEach((b, i) => b.classList.toggle('active', i < activeCount));
  }
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
  const v = (State.voices[State.currentTab] || []).find(x => x.id === nextId);
  if (v) { playVoice(v); rows[idx].scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
}

// ─── 收藏 ────────────────────────────────────────────────────
function toggleFavorite(id) {
  if (State.favorites.has(id)) State.favorites.delete(id);
  else State.favorites.add(id);
  localStorage.setItem(LS_FAV, JSON.stringify([...State.favorites]));
  renderList();
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

// ─── Voice Clone UI ─────────────────────────────────────────
function renderCloneUI() {
  const container = document.getElementById('vm-list');
  container.innerHTML = `
    <div class="vm-action-panel">
      <div class="vm-action-card">
        <div class="vm-action-title">🎤 建立語音複製</div>
        <div class="vm-action-desc">
          上傳 30 秒～5 分鐘的清晰人聲錄音，AI 會 60 秒內複製這個聲音。<br>
          建議：安靜環境、近距離錄、有抑揚頓挫、包含你常用的語尾助詞（例如「對啊」「欸～」）。
        </div>

        <div class="vm-field">
          <label>語音名稱 *</label>
          <input type="text" id="vm-clone-name" placeholder="例：樂樂（日混台甜美）" maxlength="40">
        </div>

        <div class="vm-field">
          <label>音檔（mp3 / wav / m4a，≤ 25MB）*</label>
          <div class="vm-upload-drop" id="vm-clone-drop">
            <div class="vm-upload-icon">📁</div>
            <p><strong style="color:#b5abff">點擊上傳</strong> 或拖曳音檔進來</p>
            <small>建議至少 30 秒清晰錄音</small>
          </div>
          <input type="file" id="vm-clone-file" accept="audio/*" style="display:none">
          <div id="vm-clone-file-info" style="font-size:12px;color:rgba(255,255,255,0.5);margin-top:6px"></div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div class="vm-field">
            <label>性別</label>
            <select id="vm-clone-gender">
              <option value="Female">女性</option>
              <option value="Male">男性</option>
            </select>
          </div>
          <div class="vm-field">
            <label>年齡段</label>
            <select id="vm-clone-age">
              <option value="Young Adult">年輕（20-30）</option>
              <option value="Adult">成熟（30-50）</option>
              <option value="Mature">中年（50+）</option>
              <option value="Teenager">青少年</option>
            </select>
          </div>
        </div>

        <div class="vm-field">
          <label>口音描述（可選）</label>
          <input type="text" id="vm-clone-accent" placeholder="例：台灣國語、日文口音、港式華語" maxlength="60">
        </div>

        <button class="vm-btn-primary" id="vm-clone-submit" disabled>
          🪄 建立語音複製
        </button>
        <div id="vm-clone-status" style="font-size:12px;color:rgba(255,255,255,0.6);margin-top:10px;text-align:center"></div>
      </div>
    </div>
  `;
  bindCloneUI();
}

function bindCloneUI() {
  const drop = document.getElementById('vm-clone-drop');
  const file = document.getElementById('vm-clone-file');
  const info = document.getElementById('vm-clone-file-info');
  const submit = document.getElementById('vm-clone-submit');
  let chosenFile = null;

  drop.addEventListener('click', () => file.click());
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('drag'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('drag'));
  drop.addEventListener('drop', e => {
    e.preventDefault(); drop.classList.remove('drag');
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith('audio/')) { chosenFile = f; showFile(f); }
  });
  file.addEventListener('change', e => {
    const f = e.target.files[0]; if (f) { chosenFile = f; showFile(f); }
  });

  function showFile(f) {
    info.innerHTML = `✓ 已選：<strong style="color:#6dfac2">${esc(f.name)}</strong> (${(f.size/1024/1024).toFixed(2)} MB)`;
    updateSubmit();
  }

  document.getElementById('vm-clone-name').addEventListener('input', updateSubmit);
  function updateSubmit() {
    const hasName = document.getElementById('vm-clone-name').value.trim();
    submit.disabled = !(hasName && chosenFile);
  }

  submit.addEventListener('click', async () => {
    if (!chosenFile) return;
    submit.disabled = true;
    const status = document.getElementById('vm-clone-status');
    status.textContent = '📤 上傳音檔中…';

    try {
      // Step 1: 上傳音檔到 Worker，取得 asset_url
      const up = await fetch(State.workerUrl + '/voice_upload', {
        method: 'POST',
        headers: { 'Content-Type': chosenFile.type, 'X-Password': State.password },
        body: chosenFile,
      });
      const upRes = await up.json();
      if (!upRes.ok) throw new Error(upRes.error || '上傳失敗');

      status.textContent = '🪄 建立語音複製中（約 30 秒）…';

      // Step 2: 觸發 clone
      const res = await api('heygen_clone_voice', {
        name: document.getElementById('vm-clone-name').value.trim(),
        asset_url: upRes.asset_url || upRes.asset_id,
        gender: document.getElementById('vm-clone-gender').value,
        age: document.getElementById('vm-clone-age').value,
        accent: document.getElementById('vm-clone-accent').value.trim(),
      });

      if (!res.ok) throw new Error(res.error);

      status.innerHTML = `✅ 建立成功！語音 ID: <code style="color:#b5abff">${res.voice_id.slice(0,12)}…</code><br>切回「我的語音」查看`;
      State.loaded.mine = false;  // 強制下次 reload
      setTimeout(() => switchTab('mine'), 1500);
    } catch (e) {
      status.innerHTML = `<span style="color:#fa6d9b">❌ ${e.message}</span>`;
      submit.disabled = false;
    }
  });
}

// ─── Voice Design UI ────────────────────────────────────────
function renderDesignUI() {
  const container = document.getElementById('vm-list');
  container.innerHTML = `
    <div class="vm-action-panel">
      <div class="vm-action-card">
        <div class="vm-action-title">✨ AI 設計語音</div>
        <div class="vm-action-desc">
          用文字描述你想要的聲音，AI 會生成 3 款候選讓你試聽挑選。<br>
          越具體效果越好：性別、年齡、情緒、口音、使用場景都可以寫進去。
        </div>

        <div class="vm-field">
          <label>語音名稱</label>
          <input type="text" id="vm-design-name" placeholder="例：日混台甜美女聲" maxlength="40">
        </div>

        <div class="vm-field">
          <label>聲音描述 *（至少 20 字，建議 50-150 字）</label>
          <textarea id="vm-design-prompt" placeholder="年輕女性，台灣國語帶一點日文口音，親切健談，像在日本長大的台灣女生。語氣有活力但不吵，說話節奏偏慢，尾音會微微上揚。適合講生活、美妝、旅遊類的內容。" maxlength="500"></textarea>
          <div class="vm-template-chips">
            <span class="vm-template-chip" data-tpl="tw-jp-sweet">日混台甜美</span>
            <span class="vm-template-chip" data-tpl="tw-jp-smart">日混台知性</span>
            <span class="vm-template-chip" data-tpl="hk-warm">香港溫柔</span>
            <span class="vm-template-chip" data-tpl="tw-mom">台灣媽媽</span>
            <span class="vm-template-chip" data-tpl="tw-gz">台灣女孩鄰家</span>
            <span class="vm-template-chip" data-tpl="m-biz">商務男性沉穩</span>
          </div>
        </div>

        <button class="vm-btn-primary" id="vm-design-submit">
          ✨ 生成 3 款候選語音
        </button>
        <div id="vm-design-status" style="font-size:12px;color:rgba(255,255,255,0.6);margin-top:10px;text-align:center"></div>
        <div id="vm-design-result" style="margin-top:16px"></div>
      </div>
    </div>
  `;
  bindDesignUI();
}

const DESIGN_TEMPLATES = {
  'tw-jp-sweet': '年輕女性，台灣國語帶一點日文口音，親切甜美，像在日本長大後回台灣的女生。聲音清亮有活力，說話時偶爾會有日文語助詞的輕微尾音（ね、よ）。適合講美妝保養、日系時尚、生活 Vlog。',
  'tw-jp-smart': '30 歲女性，台灣國語但帶日文口音，聲音知性成熟，說話節奏沉穩清晰。像是日本長大的台灣留學生，說話時偶爾會不自覺地加入日文習慣的停頓。適合講品牌故事、產品開箱、職場分享。',
  'hk-warm': '30 多歲香港女性，說話溫柔但有自信，國語帶粵語腔，尾音常上揚。像鄰家姊姊，說話時給人安心感。適合講育兒、家居生活、療癒系內容。',
  'tw-mom': '35 歲台灣媽媽，說話親切自然，有點隨性，像在跟朋友分享家庭生活。聲音帶有溫暖的笑意，偶爾會因為興奮而語速加快。適合講親子育兒、家庭料理、生活雜物開箱。',
  'tw-gz': '25 歲台灣女生，說話甜美自然，像大學同學，偶爾會用「欸欸」「真的假的」開場。聲音年輕有活力，尾音會微微拉長。適合講穿搭、聚餐、旅遊分享。',
  'm-biz': '40 歲男性，低沉磁性的嗓音，說話穩重但不死板，吐字清晰。像是成功的商務人士，說話時有一種讓人信服的氣場。適合講品牌理念、產品專業解說、財經內容。',
};

function bindDesignUI() {
  const promptEl = document.getElementById('vm-design-prompt');
  document.querySelectorAll('.vm-template-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      promptEl.value = DESIGN_TEMPLATES[chip.dataset.tpl] || '';
    });
  });

  document.getElementById('vm-design-submit').addEventListener('click', async () => {
    const prompt = promptEl.value.trim();
    const name = document.getElementById('vm-design-name').value.trim() || `Designed ${Date.now()}`;
    if (prompt.length < 10) { toast('描述太短，至少 10 字', 'warn'); return; }

    const btn = document.getElementById('vm-design-submit');
    const status = document.getElementById('vm-design-status');
    btn.disabled = true;
    status.textContent = '✨ 生成中（約 30-60 秒）…';

    try {
      const res = await api('heygen_design_voice', { prompt, name, num_candidates: 3 });
      if (!res.ok) throw new Error(res.error);

      status.textContent = '✅ 生成完成！試聽 3 款候選：';
      State.designCandidates = res.candidates || [];
      renderDesignCandidates();
    } catch (e) {
      status.innerHTML = `<span style="color:#fa6d9b">❌ ${e.message}</span>`;
    }
    btn.disabled = false;
  });
}

function renderDesignCandidates() {
  const result = document.getElementById('vm-design-result');
  if (!result) return;
  result.innerHTML = State.designCandidates.map((c, i) => `
    <div class="vm-row" data-id="${esc(c.id)}" style="margin-top:10px">
      <button class="vm-play-btn" data-url="${esc(c.preview_url || '')}">▶</button>
      <div class="vm-info">
        <div class="vm-name">候選 ${i + 1}：${esc(c.name || '—')}</div>
        <div class="vm-tags">Voice ID: ${esc(c.id?.slice(0, 16) || '—')}…</div>
      </div>
      <div></div><div></div><div></div>
      <button class="vm-select-btn" data-select="${esc(c.id)}" style="padding:8px 14px;font-size:12px">使用此候選</button>
    </div>
  `).join('');

  result.querySelectorAll('.vm-play-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const url = btn.dataset.url;
      if (!url) { toast('沒有試聽檔', 'warn'); return; }
      State.audio.src = url;
      State.audio.play();
    });
  });
  result.querySelectorAll('[data-select]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.select;
      const c = State.designCandidates.find(x => x.id === id);
      if (!c) return;
      State.confirmed = {
        id: c.id, name: c.name, preview_url: c.preview_url,
        language: 'Designed', gender: '', engine: 'HeyGen',
      };
      localStorage.setItem(LS_CONFIRMED, JSON.stringify(State.confirmed));
      State.onSelect(State.confirmed);
      VoiceModal.close();
    });
  });
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
  // 延用主頁的 toast（如果有）
  if (typeof window.toast === 'function') return window.toast(msg, type);
  // 否則用原生 alert fallback
  console.log('[Voice Modal]', type, msg);
}

})(window);
