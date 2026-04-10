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
    scope: GOOG_SCOPE + ' https://www.googleapis.com/auth/userinfo.email',
    callback: async (resp) => {
      if (!resp.access_token) return;

      const isRelogin = !!window._driveToken;
      window._driveToken = resp.access_token;
      window._workerDriveMode = false; // Google 登入用原本流程
      sessionStorage.setItem('bs_token', resp.access_token);
      sessionStorage.removeItem('bs_worker_mode');

      if (isRelogin) {
        setDriveStatus('ok');
        Object.keys(_assetCache || {}).forEach(k => delete _assetCache[k]);
        if (window.S?.brandId) await autoFetchAssets(window.S.brandId);
        return;
      }

      if (_isInitializing) return;
      _isInitializing = true;
      try {
        const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: 'Bearer ' + resp.access_token }
        });
        const info = await r.json();
        _userEmail = info.email || '';
        sessionStorage.setItem('bs_email', _userEmail);
        const ok = await checkWhitelist(_userEmail);
        if (ok) {
          _onLoginSuccess();
          await startSystem();
        } else {
          document.getElementById('loginErr').textContent = '❌ 此帳號無使用權限';
          document.getElementById('loginBtn').disabled = false;
          document.getElementById('loginBtn').textContent = '使用 Google 帳號登入';
          window._driveToken = null;
          sessionStorage.removeItem('bs_token');
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

  _onLoginSuccess(_userEmail, account.name);
  await startSystem();
}

// ══ 登入成功後更新 UI ══
function _onLoginSuccess(email, displayName) {
  document.getElementById('loginOverlay').style.display = 'none';

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

// ══ 白名單檢查 ══
async function checkWhitelist(email) {
  if (!email) return false;
  if (email === ADMIN_EMAIL) return true;
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

  if (_systemStarted) return;
  _systemStarted = true;

  const overlay = document.getElementById('initOverlay');
  overlay.style.display = 'flex';
  document.getElementById('initMsg').textContent = '初始化 Brand OS 系統...';

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${GAS_URL}?action=getBrandOS&password=${GAS_PASSWORD}`, { signal: controller.signal });
    clearTimeout(timer);
    const json = await res.json();
    if (!json.ok) throw new Error(json.error);
    buildDataFromSheets(json.data);
    document.getElementById('initMsg').textContent = '✅ 系統就緒！';
  } catch (e) {
    console.warn('fallback:', e.message);
    buildDataFromSheets(LOCAL_FALLBACK_DATA);
    document.getElementById('initMsg').textContent = '✅ 系統就緒！（本地資料）';
  }

  await new Promise(r => setTimeout(r, 600));
  document.getElementById('initOverlay').style.display = 'none';

  renderNavBrands();
  renderBrandTree();
}
