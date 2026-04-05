// ════════════════════════════════════════════
// shared.js — Brand OS 共用核心
// 版本：v5 模組化
// 包含：Auth / 品牌資料 / Drive API / 共用工具
// ════════════════════════════════════════════

const GAS_URL = 'https://script.google.com/macros/s/AKfycbwc55f7UYP0_S4I4yhPkBx2_fRfbYY6m42yzzWQHqKeLnSlZ9hMGBBeMoTOI7yFG4kcZg/exec';
const GAS_PASSWORD = 'raby2026';
const CF_WORKER_URL = 'https://photoroom-proxy.calm-sunset-6b66.workers.dev';
const GOOG_CLIENT_ID = '513919357376-g34jg6d1bqkj6pg8t27nsdrj3vd93d3e.apps.googleusercontent.com';
const GOOG_SCOPE = 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email';
const ADMIN_EMAIL = 'cyndi04592@gmail.com';

// ── 全域狀態 ──
window.BS = {
  brandId: null, subId: null, prod: null,
  photos: [], videos: [],
  selPhoto: null, selVideo: null,
  openBrand: null,
  token: null,
  userEmail: null,
};
window.BRANDS = [];
window.BRAND_FOLDERS = {};

// ── 顏色對應 ──
const CMAP = {
  gold:   { c: '#E8603A', bg: 'rgba(232,96,58,0.15)' },
  red:    { c: '#FF8099', bg: 'rgba(232,96,58,0.12)' },
  sky:    { c: '#5BC8C8', bg: 'rgba(91,200,200,0.12)' },
  mint:   { c: '#7ED4B0', bg: 'rgba(126,212,176,0.12)' },
  purple: { c: '#B89ED4', bg: 'rgba(184,158,212,0.12)' },
  brown:  { c: '#C8A870', bg: 'rgba(200,168,112,0.15)' },
};
function getColor(key) { return CMAP[key] || CMAP.gold; }

// ── Fallback 資料（GAS 連不到時用）──
const LOCAL_FALLBACK_DATA = {
  brands: [
    { id: 'cf',  name: '巧福健康家電', icon: '🏠', navColor: 'gold',  soul: '溫暖居家、守護家人健康、實用親切、台灣品牌精神。', adStyle: '溫暖生活感、家人守護、療癒放鬆、痛點直擊', hashtags: '#居家健康 #巧福 #台灣品牌' },
    { id: 'ww',  name: '旺味米香腸',   icon: '🌾', navColor: 'red',   soul: '全台首創米香腸，傳承阿公家訓。', adStyle: '台灣古早味、手工真材實料、烤肉聚餐場景', hashtags: '#旺味米香腸 #米香腸 #台灣豬' },
    { id: 'ly',  name: '琉宇醬選',     icon: '🫙', navColor: 'mint',  soul: '琉宇醬選主理頂級進口醬料。', adStyle: '精緻質感、食材溯源、料理升級', hashtags: '#琉宇醬選 #好滋好滋 #PASSERI' },
  ],
  products: [],
  folders: [
    { brandId: 'cf', photoFolderId: '1tHV_loHiUcZx8MVrpnUwTWUge74GIwE7', videoFolderId: '132xtz0XebJV-gGXObV4UtanmwyZd9Awc' },
    { brandId: 'ww', photoFolderId: '1dhCLr4tKrfV0RLHp454pzyJjytZFb92m', videoFolderId: '12LsKHCZQkDhT_FhzYWFw7rN4KJyvAD46' },
    { brandId: 'ly', photoFolderId: '1u9n-NpnQjjzU3GnpT15ERanCEky_m6bP', videoFolderId: '1lSvqYV28lgqN2xZ6640glMTssYhUKMoD' },
  ]
};

// ════════════════════════════════════════════
// 品牌資料處理
// ════════════════════════════════════════════
function buildDataFromSheets(data) {
  const { brands, products, folders } = data;
  BRAND_FOLDERS = {};
  folders.forEach(f => {
    BRAND_FOLDERS[f.brandId] = { photo: f.photoFolderId, video: f.videoFolderId };
  });
  const prodByBrand = {};
  products.forEach(p => {
    if (!prodByBrand[p.brandId]) prodByBrand[p.brandId] = {};
    const key = p.subId;
    if (!prodByBrand[p.brandId][key]) prodByBrand[p.brandId][key] = {
      id: p.subId, name: p.subName, color: p.subColor || 'gold',
      soul: p.subSoul, adStyle: p.subAdStyle, hashtags: p.subHashtags, prods: []
    };
    prodByBrand[p.brandId][key].prods.push({ id: p.prodId, name: p.prodName, tag: p.prodTag });
  });
  BRANDS = brands.map(b => ({
    id: b.id, name: b.name, icon: b.icon || '🏷️',
    navColor: b.navColor || 'gold', soul: b.soul || '',
    adStyle: b.adStyle || '', hashtags: b.hashtags || '',
    subs: Object.values(prodByBrand[b.id] || {})
  }));
}

async function loadBrandData() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${GAS_URL}?action=getBrandOS&password=${GAS_PASSWORD}`, { signal: controller.signal });
    clearTimeout(timer);
    const json = await res.json();
    if (!json.ok) throw new Error(json.error);
    buildDataFromSheets(json.data);
  } catch (e) {
    console.warn('使用 fallback 資料:', e.message);
    buildDataFromSheets(LOCAL_FALLBACK_DATA);
  }
}

// ════════════════════════════════════════════
// Google Auth
// ════════════════════════════════════════════
let _tokenClient = null;
let _isInitializing = false;

function initGoogleAuth(onLoginSuccess) {
  if (!window.google) return;
  _tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GOOG_CLIENT_ID,
    scope: GOOG_SCOPE,
    callback: async (resp) => {
      if (!resp.access_token) return;
      if (_isInitializing) return;
      _isInitializing = true;
      BS.token = resp.access_token;
      try {
        const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: 'Bearer ' + resp.access_token }
        });
        const info = await r.json();
        BS.userEmail = info.email || '';
        const ok = await checkWhitelist(BS.userEmail);
        if (ok) {
          saveSession(resp.access_token, BS.userEmail);
          if (typeof onLoginSuccess === 'function') await onLoginSuccess();
        } else {
          BS.token = null;
          showLoginError('❌ 此帳號無使用權限');
          resetLoginBtn();
        }
      } catch (e) {
        showLoginError('❌ 驗證失敗，請重試');
        resetLoginBtn();
      } finally {
        _isInitializing = false;
      }
    }
  });
}

function doGoogleLogin() {
  const btn = document.getElementById('loginBtn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spin" style="border-top-color:#fff"></span> 登入中...'; }
  const err = document.getElementById('loginErr');
  if (err) err.textContent = '';
  if (!_tokenClient) {
    setTimeout(() => {
      if (_tokenClient) _tokenClient.requestAccessToken({ prompt: 'select_account' });
      else { showLoginError('❌ Google 載入失敗'); resetLoginBtn(); }
    }, 1500);
    return;
  }
  _tokenClient.requestAccessToken({ prompt: 'select_account' });
}

function doLogout() {
  if (!confirm('確定要登出嗎？')) return;
  clearSession();
  BS.token = null; BS.userEmail = null;
  BS.brandId = null; BS.subId = null; BS.prod = null;
  BS.photos = []; BS.videos = []; BS.selPhoto = null; BS.selVideo = null;
  BS.openBrand = null;
  _isInitializing = false;
  if (window.google?.accounts?.oauth2) {
    try { google.accounts.oauth2.revoke('', () => {}); } catch (e) {}
  }
  window.location.href = 'index.html';
}

function resetLoginBtn() {
  const btn = document.getElementById('loginBtn');
  if (btn) { btn.disabled = false; btn.innerHTML = '使用 Google 帳號登入'; }
}

function showLoginError(msg) {
  const el = document.getElementById('loginErr');
  if (el) el.textContent = msg;
}

async function checkWhitelist(email) {
  if (!email) return false;
  if (email === ADMIN_EMAIL) return true;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const r = await fetch(`${GAS_URL}?action=checkWhitelist&email=${encodeURIComponent(email)}`, { signal: controller.signal });
    clearTimeout(timer);
    const j = await r.json();
    return j.ok && j.allowed;
  } catch (e) { return false; }
}

// ════════════════════════════════════════════
// Session 管理（sessionStorage）
// ════════════════════════════════════════════
function saveSession(token, email) {
  sessionStorage.setItem('bs_token', token);
  sessionStorage.setItem('bs_email', email);
}

function loadSession() {
  const token = sessionStorage.getItem('bs_token');
  const email = sessionStorage.getItem('bs_email');
  if (token && email) {
    BS.token = token;
    BS.userEmail = email;
    return true;
  }
  return false;
}

function clearSession() {
  sessionStorage.removeItem('bs_token');
  sessionStorage.removeItem('bs_email');
}

function requireAuth() {
  if (!loadSession()) {
    window.location.href = 'index.html';
    return false;
  }
  return true;
}

// ════════════════════════════════════════════
// Drive API
// ════════════════════════════════════════════
function parseDriveId(raw) {
  if (!raw) return null;
  const m = raw.match(/(?:folders\/|id=)([a-zA-Z0-9_\-]{15,})/);
  if (m) return m[1];
  if (/^[a-zA-Z0-9_\-]{15,}$/.test(raw.trim())) return raw.trim();
  return null;
}

async function fetchFromDriveAPI(folderId, type) {
  const token = BS.token;
  if (!token) return;
  const mimeFilter = type === 'photo' ? "mimeType contains 'image/'" : "mimeType contains 'video/'";
  const q = encodeURIComponent(`'${folderId}' in parents and (${mimeFilter}) and trashed=false`);
  try {
    const r = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,mimeType,thumbnailLink,webViewLink)&pageSize=100`,
      { headers: { Authorization: 'Bearer ' + token } }
    );
    const d = await r.json();
    if (d.files) {
      const arr = type === 'photo' ? BS.photos : BS.videos;
      d.files.forEach(f => {
        if (!arr.find(x => x.driveId === f.id)) {
          const item = {
            driveId: f.id, name: f.name, thumb: f.thumbnailLink || '',
            driveUrl: f.webViewLink || `https://drive.google.com/file/d/${f.id}/view`,
            src: '', type
          };
          arr.push(item);
          // 非同步載入縮圖
          fetch(`https://www.googleapis.com/drive/v3/files/${f.id}?alt=media`, {
            headers: { Authorization: 'Bearer ' + token }
          }).then(r => r.blob()).then(blob => {
            const reader = new FileReader();
            reader.onload = () => { item.src = reader.result; if (typeof renderAssets === 'function') renderAssets(); };
            reader.readAsDataURL(blob);
          }).catch(() => {});
        }
      });
    }
  } catch (e) { console.warn('Drive API error', e); }
}

async function fetchDriveAssets(type, onDone) {
  if (!BS.token) {
    alert('請先連結 Google Drive');
    return;
  }
  const inputId = type === 'photo' ? 'inPhotoFolder' : 'inVideoFolder';
  const btnId = type === 'photo' ? 'fetchPhotoBtn' : 'fetchVideoBtn';
  const raw = document.getElementById(inputId)?.value.trim();
  const folderId = parseDriveId(raw);
  const btn = document.getElementById(btnId);
  if (!raw) { alert('請先貼上 Drive 資料夾連結'); return; }
  if (btn) { btn.disabled = true; btn.textContent = '載入中…'; }
  setDriveStatus('busy');
  if (folderId) await fetchFromDriveAPI(folderId, type);
  if (btn) { btn.disabled = false; btn.textContent = type === 'photo' ? '抓照片' : '抓影片'; }
  setDriveStatus('ok');
  if (typeof onDone === 'function') onDone();
}

async function fetchBoth(onDone) {
  if (!BS.token) { alert('請先連結 Google Drive'); return; }
  const photoRaw = document.getElementById('inPhotoFolder')?.value.trim();
  const videoRaw = document.getElementById('inVideoFolder')?.value.trim();
  if (!photoRaw && !videoRaw) { alert('請先填入照片或影片資料夾連結'); return; }
  if (photoRaw) await fetchDriveAssets('photo');
  if (videoRaw) await fetchDriveAssets('video');
  if (typeof onDone === 'function') onDone();
}

// ════════════════════════════════════════════
// Drive 狀態 UI
// ════════════════════════════════════════════
function setDriveStatus(state) {
  const dot = document.getElementById('driveDot');
  const lbl = document.getElementById('driveLabel');
  if (!dot || !lbl) return;
  dot.className = 'drive-dot ' + state;
  if (state === 'ok') {
    lbl.textContent = 'Drive 已連結';
    lbl.style.color = 'var(--mint)';
    lbl.classList.remove('drive-warning-text');
    const warn = document.getElementById('driveWarningBanner');
    if (warn) warn.style.display = 'none';
  } else if (state === 'busy') {
    lbl.textContent = '載入中…';
    lbl.style.color = 'var(--gold)';
  } else {
    lbl.textContent = '· 請先連結 Drive';
    lbl.style.color = 'var(--t3)';
  }
}

// ════════════════════════════════════════════
// Nav 共用 UI
// ════════════════════════════════════════════
function renderNavBrands(activePage) {
  const el = document.getElementById('navBrands');
  if (!el) return;
  el.innerHTML = BRANDS.map(b =>
    `<button class="nb ${b.navColor || 'gold'} ${BS.brandId === b.id ? 'on' : ''}" onclick="clickBrand('${b.id}')">${b.name}</button>`
  ).join('');
}

function renderNavRight() {
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.style.display = 'block';
  const driveBtn = document.getElementById('driveLoginBtn');
  if (driveBtn) {
    driveBtn.textContent = '✅ ' + (BS.userEmail || '已連結');
    driveBtn.style.borderColor = 'var(--mint)';
    driveBtn.style.color = 'var(--mint)';
    driveBtn.style.background = 'var(--mint2)';
  }
}

function goAdmin() {
  if (BS.userEmail === ADMIN_EMAIL) window.open('admin.html', '_blank');
  else alert('⚠️ 後台僅限管理員\n目前帳號：' + (BS.userEmail || '未登入'));
}

function driveLogin() {
  if (!_tokenClient) { alert('Google 授權尚未載入'); return; }
  _tokenClient.requestAccessToken({});
}

// ════════════════════════════════════════════
// 品牌 / 商品選擇共用邏輯
// ════════════════════════════════════════════
function clickBrand(id) {
  BS.openBrand = BS.openBrand === id ? null : id;
  BS.brandId = id; BS.subId = null; BS.prod = null;
  BS.photos = []; BS.videos = []; BS.selPhoto = null; BS.selVideo = null;
  if (typeof renderNavBrands === 'function') renderNavBrands();
  if (typeof renderBrandTree === 'function') renderBrandTree();
  if (typeof renderProds === 'function') renderProds();
  if (typeof updateCtx === 'function') updateCtx();
  if (typeof renderAssets === 'function') renderAssets();
  const f = BRAND_FOLDERS[id];
  if (f) {
    const pf = document.getElementById('inPhotoFolder');
    const vf = document.getElementById('inVideoFolder');
    if (pf) pf.value = f.photo || '';
    if (vf) vf.value = f.video || '';
  }
}

function clickSub(brandId, subId) {
  BS.brandId = brandId; BS.subId = subId; BS.prod = null; BS.openBrand = brandId;
  if (typeof renderNavBrands === 'function') renderNavBrands();
  if (typeof renderBrandTree === 'function') renderBrandTree();
  if (typeof renderProds === 'function') renderProds();
  if (typeof updateCtx === 'function') updateCtx();
}

function clickProd(subId, prodId) {
  const brand = BRANDS.find(b => b.id === BS.brandId);
  const sub = brand?.subs.find(s => s.id === subId);
  const prod = sub?.prods.find(p => p.id === prodId);
  if (!prod) return;
  BS.subId = subId; BS.prod = prod;
  if (typeof renderBrandTree === 'function') renderBrandTree();
  if (typeof renderProds === 'function') renderProds();
  if (typeof updateCtx === 'function') updateCtx();
}

// ════════════════════════════════════════════
// 工具函式
// ════════════════════════════════════════════
async function urlToBlob(src) {
  if (src.startsWith('data:')) { const res = await fetch(src); return res.blob(); }
  const res = await fetch(src);
  if (!res.ok) throw new Error('圖片載入失敗');
  return res.blob();
}

function countWords(str) {
  if (!str) return 0;
  const s = str.replace(/[，。！？、；：「」『』【】〔〕…—·\s]/g, '');
  const zhChars = (s.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
  const enWords = (s.replace(/[\u4e00-\u9fff\u3400-\u4dbf]/g, ' ').match(/[a-zA-Z0-9]+/g) || []).length;
  return zhChars + enWords;
}

function charBadge(len, limit) {
  const over = len > limit;
  const color = over ? '#FF4D6A' : '#7ED4B0';
  const icon = over ? '⚠️ 超字數！' : '✅';
  return `<span style="font-size:10px;font-weight:900;color:${color};font-family:'DM Mono';margin-left:6px;">${len}字 ${icon}</span>`;
}

function escHtml(str) {
  return (str || '').toString()
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ════════════════════════════════════════════
// Drive 上傳廣告圖
// ════════════════════════════════════════════
let _driveOutputFolderId = null;

async function uploadAdToDrive(canvas, filename) {
  if (!BS.token) return;
  const dlBtn = document.getElementById('adDownloadBtn');
  const origText = dlBtn?.textContent || '';
  if (dlBtn) { dlBtn.textContent = '· 上傳中...'; dlBtn.disabled = true; }
  try {
    const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.92));
    if (!_driveOutputFolderId) _driveOutputFolderId = await getOrCreateAdFolder();
    const meta = JSON.stringify({ name: filename, parents: _driveOutputFolderId ? [_driveOutputFolderId] : [] });
    const form = new FormData();
    form.append('metadata', new Blob([meta], { type: 'application/json' }));
    form.append('file', blob, filename);
    const resp = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST', headers: { Authorization: 'Bearer ' + BS.token }, body: form
    });
    if (!resp.ok) throw new Error('上傳失敗');
    if (dlBtn) { dlBtn.textContent = '· 已存到 Drive！'; setTimeout(() => { dlBtn.textContent = origText; dlBtn.disabled = false; }, 3000); }
  } catch (e) {
    if (dlBtn) { dlBtn.textContent = origText; dlBtn.disabled = false; }
  }
}

async function getOrCreateAdFolder() {
  const token = BS.token;
  const search = await fetch(
    "https://www.googleapis.com/drive/v3/files?q=name%3D'Brand+OS+廣告圖'+and+mimeType%3D'application%2Fvnd.google-apps.folder'+and+trashed%3Dfalse&fields=files(id)",
    { headers: { Authorization: 'Bearer ' + token } }
  );
  const sdata = await search.json();
  if (sdata.files?.length > 0) return sdata.files[0].id;
  const create = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Brand OS 廣告圖', mimeType: 'application/vnd.google-apps.folder' })
  });
  return (await create.json()).id;
}
