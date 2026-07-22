// ══════════════════════════════════════════
//  auth.js — Google登入、Drive授權、白名單、登出
// ══════════════════════════════════════════

let tokenClient = null;
let _userEmail = null;
let _isInitializing = false;
let _systemStarted = false;

// ══ Drive 狀態顯示 ══
function setDriveStatus(state) {
  const dot = document.getElementById('driveDot');
  const lbl = document.getElementById('driveLabel');
  dot.className = 'drive-dot ' + state;
  if (state === 'ok') {
    lbl.textContent = 'Drive 已連結';
    lbl.style.color = 'var(--mint)';
    lbl.classList.remove('drive-warning-text');
  } else if (state === 'busy') {
    lbl.textContent = '載入中…';
    lbl.style.color = 'var(--gold)';
  } else {
    lbl.textContent = '· 請連結 Drive';
    lbl.style.color = 'var(--t3)';
  }
}

// ══ 初始化 Google Auth ══
function initGoogleAuth() {
  if (!window.google) return;
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GOOG_CLIENT_ID,
    scope: 'https://www.googleapis.com/auth/userinfo.email',
    callback: async (resp) => {
      if (!resp.access_token) return;

      if (_isInitializing) return;
      _isInitializing = true;
      try {
        // 用 email-scope token 只讀一次 email,不留作 Drive token
        const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: 'Bearer ' + resp.access_token }
        });
        const info = await r.json();
        _userEmail = info.email || '';
        sessionStorage.setItem('bs_email', _userEmail);
        const ok = await checkWhitelist(_userEmail);
        if (ok) {
          // ★ Google 登入改走 Worker Drive 模式(零 Drive 權限、零警告)
          window._driveToken = null;
          window._workerDriveMode = true;
          sessionStorage.setItem('bs_worker_mode', '1');
          sessionStorage.removeItem('bs_token');
          try { localStorage.setItem('bs_sso_email', _userEmail); } catch(e){}
          _onLoginSuccess(_userEmail);
          await startSystem();
        } else {
          document.getElementById('loginErr').textContent = '❌ 此帳號無使用權限';
          document.getElementById('loginBtn').disabled = false;
          document.getElementById('loginBtn').textContent = '使用 Google 帳號登入';
        }
      } catch (e) {
        document.getElementById('loginErr').textContent = '❌ 驗證失敗，請重試';
        document.getElementById('loginBtn').disabled = false;
      } finally {
        _isInitializing = false;
      }
    }
  });
}

// ══ 帳密登入（★ 新增）══
// 帳密對照表：帳號 → 對應顯示名稱
const _PWD_ACCOUNTS = {
  'test': { pass: 'Abc12345', name: 'Fook Lam Moon' },
};

function showPasswordLogin() {
  const overlay = document.getElementById('loginOverlay');
  const existing = document.getElementById('pwdLoginForm');
  if (existing) { existing.style.display = existing.style.display === 'none' ? 'block' : 'none'; return; }

  // 動態插入帳密表單
  const form = document.createElement('div');
  form.id = 'pwdLoginForm';
  form.style.cssText = 'margin-top:16px;';
  form.innerHTML = `
    <div style="border-top:1px solid rgba(255,255,255,0.1);padding-top:14px;margin-top:4px;">
      <div style="font-size:10px;color:var(--t3);letter-spacing:1px;text-transform:uppercase;margin-bottom:10px;text-align:center;">帳號密碼登入</div>
      <input id="pwdUser" type="text" placeholder="帳號" autocomplete="username"
        style="width:100%;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);border-radius:8px;padding:10px 12px;color:#e8e0d0;font-size:13px;outline:none;box-sizing:border-box;margin-bottom:8px;font-family:inherit;">
      <input id="pwdPass" type="password" placeholder="密碼" autocomplete="current-password"
        style="width:100%;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);border-radius:8px;padding:10px 12px;color:#e8e0d0;font-size:13px;outline:none;box-sizing:border-box;margin-bottom:10px;font-family:inherit;"
        onkeydown="if(event.key==='Enter')doPwdLogin()">
      <button onclick="doPwdLogin()"
        style="width:100%;padding:10px;border-radius:8px;border:none;background:rgba(91,200,200,0.15);color:var(--sky);font-family:'Noto Sans TC',sans-serif;font-size:13px;font-weight:700;cursor:pointer;border:1px solid rgba(91,200,200,0.4);">
        登入
      </button>
      <div id="pwdErr" style="font-size:11px;color:#f44336;text-align:center;margin-top:8px;min-height:16px;"></div>
    </div>`;

  // 插入到 loginErr 後面
  const loginErr = overlay.querySelector('#loginErr');
  loginErr.parentNode.insertBefore(form, loginErr.nextSibling);
}

async function doPwdLogin() {
  const user = document.getElementById('pwdUser')?.value?.trim().toLowerCase();
  const pass = document.getElementById('pwdPass')?.value;
  const errEl = document.getElementById('pwdErr');
  if (!user || !pass) { if(errEl) errEl.textContent = '請輸入帳號和密碼'; return; }

  const account = _PWD_ACCOUNTS[user];
  if (!account || account.pass !== pass) {
    if(errEl) errEl.textContent = '❌ 帳號或密碼錯誤';
    return;
  }

  // 驗證成功
  if(errEl) errEl.textContent = '';
  _userEmail = user + '@brandos.internal';
  window._workerDriveMode = true; // ★ 走 Worker Drive 模式
  window._driveToken = null;       // 不用 Google token
  sessionStorage.setItem('bs_worker_mode', '1');
  sessionStorage.setItem('bs_email', _userEmail);
  sessionStorage.removeItem('bs_token');

 try { localStorage.setItem('bs_sso_email', _userEmail); } catch(e){}
  _onLoginSuccess(_userEmail, account.name);
  _systemStarted = false;
  await startSystem();
}

// ══ 登入成功後更新 UI ══
function _onLoginSuccess(email, displayName) {
  document.getElementById('loginOverlay').style.display = 'none';

  // 🆕 登入當下就同步右上角帳號 email(修:同瀏覽器換帳號沒重整時顯示舊 email)
  const _navEmail = document.getElementById('userEmailNav');
  if (_navEmail && (email || _userEmail)) _navEmail.textContent = email || _userEmail;

  // Worker mode 不顯示 Drive 連結按鈕
  if (window._workerDriveMode) {
    setDriveStatus('ok');
    const btn = document.getElementById('driveLoginBtn');
    if (btn) btn.style.display = 'none';
    const warn = document.getElementById('driveWarningBanner');
    if (warn) warn.style.display = 'none';
    const lbl = document.getElementById('driveLabel');
    if (lbl) { lbl.classList.remove('drive-warning-text'); lbl.textContent = displayName || 'Drive 已連結'; }
  } else {
    setDriveStatus('ok');
    const btn = document.getElementById('driveLoginBtn');
    if (btn) {
      btn.textContent = '✅ ' + (_userEmail || '已連結');
      btn.style.borderColor = 'var(--mint)';
      btn.style.color = 'var(--mint)';
      btn.style.background = 'var(--mint2)';
    }
    const warn = document.getElementById('driveWarningBanner');
    if (warn) warn.style.display = 'none';
    const lbl = document.getElementById('driveLabel');
    if (lbl) { lbl.classList.remove('drive-warning-text'); lbl.textContent = 'Drive 已連結'; }
  }

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.style.display = 'block';
}

// ══ 觸發 Google 登入 ══
function doGoogleLogin() {
  const btn = document.getElementById('loginBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spin" style="border-top-color:#fff"></span> 登入中...';
  document.getElementById('loginErr').textContent = '';
  if (!tokenClient) {
    setTimeout(() => {
      if (tokenClient) tokenClient.requestAccessToken({ prompt: 'select_account' });
      else {
        document.getElementById('loginErr').textContent = '❌ Google 載入失敗';
        btn.disabled = false;
      }
    }, 1500);
    return;
  }
  tokenClient.requestAccessToken({ prompt: 'select_account' });
}

// ══ Drive 重新連結 ══
function driveLogin() {
  if (window._workerDriveMode) return; // worker mode 不需要
  if (!tokenClient) { alert('Google 授權尚未載入'); return; }
  tokenClient.requestAccessToken({ prompt: '' });
}

// 🆕 讀取分流:高頻讀取先走 Worker(D1 毫秒級 + KV 快取 + GAS 抽風出陳貨);Worker 有任何問題自動退回直打 GAS 原路
const AUTH_WORKER_URL = 'https://kol-proxy.calm-sunset-6b66.workers.dev';
async function authCachedGet(gasAction, params, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs || 6000);
  try {
    const r = await fetch(AUTH_WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'gas_cached', password: GAS_PASSWORD, gasAction, gasParams: params || {} }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    const out = await r.json();
    if (out && out.ok !== false) return out;
    return null;
  } catch (e) { clearTimeout(timer); return null; }
}

// ══ 白名單檢查 ══
async function checkWhitelist(email) {
  if (!email) return false;
  if (email === ADMIN_EMAIL) return true;
  const fast = await authCachedGet('checkWhitelist', { email });
  if (fast) return !!(fast.ok && fast.allowed);
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const r = await fetch(`${GAS_URL}?action=checkWhitelist&email=${encodeURIComponent(email)}&password=${GAS_PASSWORD}`, { signal: controller.signal });
    clearTimeout(timer);
    const j = await r.json();
    return j.ok && j.allowed;
  } catch (e) { return false; }
}

// ══ 登出 ══
function doLogout() {
  if (!confirm('確定要登出嗎？')) return;
  window._driveToken = null;
  window._workerDriveMode = false;
  _userEmail = null;
  _systemStarted = false;
  sessionStorage.removeItem('bs_token');
  sessionStorage.removeItem('bs_email');
  sessionStorage.removeItem('bs_worker_mode');
  try { localStorage.removeItem('bs_sso_token'); localStorage.removeItem('bs_sso_email'); } catch(e){}
  window.S = { brandId:null, subId:null, prod:null, photos:[], videos:[], selPhoto:null, selVideo:null, scripts:[], delivers:[], openBrand:null };
  _isInitializing = false;
  if (window.google?.accounts?.oauth2) {
    try { google.accounts.oauth2.revoke('', () => {}); } catch(e) {}
  }
  window.location.href = 'index.html';
}

// ══ 後台按鈕 ══
function goAdmin() {
  if (_userEmail === ADMIN_EMAIL) {
    window.open('admin.html', '_blank');
  } else {
    alert('⚠️ 後台僅限管理員\n目前帳號：' + (_userEmail || '未登入'));
  }
}

// ══ 系統啟動 ══
async function startSystem() {
  // 還原 worker mode session
  if (sessionStorage.getItem('bs_worker_mode') === '1') {
    window._workerDriveMode = true;
    window._driveToken = null;
    _userEmail = sessionStorage.getItem('bs_email') || '';
    _onLoginSuccess(_userEmail);
  } else if (!window._driveToken) {
    // 還原一般 Google token
    const t = sessionStorage.getItem('bs_token');
    if (t) {
      window._driveToken = t;
      window._workerDriveMode = false;
      _userEmail = sessionStorage.getItem('bs_email') || '';
      _onLoginSuccess();
    }
  }

  // 🆕 修「進站要按 F5 品牌才出來」:sessionStorage 沒 email 時,用上次登入的 localStorage email 補上
  if (!_userEmail) {
    try { _userEmail = localStorage.getItem('bs_sso_email') || ''; } catch(e) {}
  }

  if (_systemStarted) return;
  _systemStarted = true;

  const overlay = document.getElementById('initOverlay');
  const _brandKey = 'bs_brandos_' + (_userEmail || '_anon'); // 🆕 WIN2：依帳號分開存,避免 A 看到 B 的品牌

  // 🆕 WIN2：先用本地快取的品牌樹「秒開」,背景再去 GAS 拉最新(stale-while-revalidate)
  let _shownFromCache = false;
  try {
    const cached = localStorage.getItem(_brandKey);
    if (cached) {
      buildDataFromSheets(JSON.parse(cached));
      renderNavBrands();
      renderBrandTree();
      overlay.style.display = 'none';   // 不卡初始化畫面
      _shownFromCache = true;
    }
  } catch (e) {}

  if (!_shownFromCache) {
    overlay.style.display = 'flex';
    document.getElementById('initMsg').textContent = '初始化 Brand OS 系統...';
  }

  try {
    let json = await authCachedGet('getBrandOS', { email: _userEmail || '' }, 8000);
    if (!json || !(json.data?.brands || []).length) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(`${GAS_URL}?action=getBrandOS&password=${GAS_PASSWORD}&email=${encodeURIComponent(_userEmail||'')}`, { signal: controller.signal });
      clearTimeout(timer);
      json = await res.json();
    }
    if (!json.ok) throw new Error(json.error);
    buildDataFromSheets(json.data);
    try { localStorage.setItem(_brandKey, JSON.stringify(json.data)); } catch(e) {} // 🆕 WIN2：存快取給下次秒開
    if (!_shownFromCache) document.getElementById('initMsg').textContent = '✅ 系統就緒！';
    // 背景刷新後,只有使用者還沒點任何品牌時才重畫(避免打斷操作)
    if (_shownFromCache && !window.S.brandId) { renderNavBrands(); renderBrandTree(); }
  } catch (e) {
    console.warn('fallback:', e.message);
    if (!_shownFromCache) {
      buildDataFromSheets(LOCAL_FALLBACK_DATA);
      document.getElementById('initMsg').textContent = '✅ 系統就緒！（本地資料）';
    }
  }

  if (!_shownFromCache) {
    await new Promise(r => setTimeout(r, 300)); // 🆕 WIN2：600→300,只留一下下讓「就緒」閃過
    document.getElementById('initOverlay').style.display = 'none';
    renderNavBrands();
    renderBrandTree();
  }
}
