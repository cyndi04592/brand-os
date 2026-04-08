// ══════════════════════════════════════════
//  auth.js — Google登入、Drive授權、白名單、登出
// ══════════════════════════════════════════

let tokenClient = null;
let _userEmail = null;
let _isInitializing = false;

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
    lbl.textContent = 'Drive 未連結';
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

      const isRelogin = !!window._driveToken; // 已經登入過，這次是重新連結
      window._driveToken = resp.access_token;
      sessionStorage.setItem('bs_token', resp.access_token);

      // ★ 重新連結 Drive 時：只更新 token 並重新抓素材，不重跑整個流程
      if (isRelogin) {
        setDriveStatus('ok');
        // 清除快取讓素材重新抓取
        Object.keys(_assetCache || {}).forEach(k => delete _assetCache[k]);
        // 重新抓取當前品牌素材
        if (window.S?.brandId) {
          await autoFetchAssets(window.S.brandId);
        }
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

// ══ 登入成功後更新 UI ══
function _onLoginSuccess() {
  document.getElementById('loginOverlay').style.display = 'none';
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

// ══ Drive 重新連結（★ 修正：重新連結後直接刷新素材）══
function driveLogin() {
  if (!tokenClient) { alert('Google 授權尚未載入'); return; }
  tokenClient.requestAccessToken({});
}

// ══ 白名單檢查 ══
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

// ══ 登出 ══
function doLogout() {
  if (!confirm('確定要登出嗎？')) return;
  window._driveToken = null;
  _userEmail = null;
  sessionStorage.removeItem('bs_token');
  sessionStorage.removeItem('bs_email');
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

// ══ 系統啟動（含 session 還原）══
async function startSystem() {
  // 嘗試從 session 還原 token
  if (!window._driveToken) {
    const t = sessionStorage.getItem('bs_token');
    if (t) {
      window._driveToken = t;
      _userEmail = sessionStorage.getItem('bs_email') || '';
      _onLoginSuccess();
    }
  }

  const overlay = document.getElementById('initOverlay');
  if (overlay && overlay.style.display === 'flex') return;
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
    document.getElementById('initMsg').textContent = '✅ 系統就緒！';
  }

  await new Promise(r => setTimeout(r, 600));
  document.getElementById('initOverlay').style.display = 'none';

  renderNavBrands();
  renderBrandTree();
}
