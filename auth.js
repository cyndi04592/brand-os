// ══════════════════════════════════════════
//  auth.js — Google登入、Drive授權、白名單、登出
// ══════════════════════════════════════════
//  🔐 2026-08-14 P0 資安·第 4 步:登入改成「跟 Worker 換身分證」
//   舊做法的兩個問題:
//    ① 帳密明碼寫在這個檔裡,而這個 repo 是公開的 → 誰都看得到
//    ② 「你是誰」由瀏覽器自己說了算(sessionStorage 填什麼就是誰),
//       後端無從查證 → 改一行就能冒充任何人
//   新做法:帳號密碼交給 Worker 驗(密碼雜湊存在 D1),Google token 也交給
//   Worker 向 Google 查證,驗過才發一張有簽章的 token 回來。
//   這個檔只負責「收好那張證」,證的內容改不動也偽造不出來。
//   ⚠️ 這一版 Worker 還沒開始強制查驗 → 就算證沒帶好,功能一切照舊。
//     真正上鎖在下一步,所以這一版可以放心上。

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
        // 🔐 改把 Google 的 token 交給 Worker 驗:Worker 會向 Google 查證這張票
        //   ①是不是發給我們這個應用程式的(擋別人家網站的 token 拿來換身分)
        //   ②屬於哪個 email,再查白名單,通過才簽一張我們自己的身分證回來。
        //   Worker 異常時自動退回舊路(瀏覽器自己讀 email + checkWhitelist),
        //   登入不會整條壞掉;只有「明確被拒絕」才擋人。
        let ok = false;
        const a = await _authGoogleLogin(resp.access_token);
        if (a && a.ok && a.token) {
          _saveAuthToken(a.token);
          _userEmail = String(a.email || '').toLowerCase();
          ok = true;
        } else if (a && a.denied) {
          _userEmail = String(a.email || '') || _userEmail || '';
          ok = false;
        } else {
          // 退路:Worker 沒回應/沒設定 → 沿用原本流程,行為與改版前一致
          const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: 'Bearer ' + resp.access_token }
          });
          const info = await r.json();
          _userEmail = info.email || '';
          ok = await checkWhitelist(_userEmail);
        }
        sessionStorage.setItem('bs_email', _userEmail);
        if (ok) {
          // ★ Google 登入改走 Worker Drive 模式(零 Drive 權限、零警告)
          window._driveToken = null;
          window._workerDriveMode = true;
          sessionStorage.setItem('bs_worker_mode', '1');
          sessionStorage.removeItem('bs_token');
          _purgeOtherBrandCaches(_userEmail);   // 🆕 換帳號 → 先清他人品牌快取,避免吃到別人/空的殘留
          try { localStorage.setItem('bs_sso_email', _userEmail); } catch(e){}
          _rememberSession(_userEmail);   // 🔒 記住登入:關掉分頁/瀏覽器再開不用重登
          _onLoginSuccess(_userEmail);
          // 🆕 真兇根治「切帳號品牌空白、非按 F5 不可」:
          //    startSystem() 開頭有 `if (_systemStarted) return;` 守衛。這條 Google 登入路徑
          //    先前漏了重設旗標,若同一個分頁內已經跑過一次(例如切帳號),旗標仍是 true →
          //    startSystem 直接 return → buildDataFromSheets 從未執行 → window.DATA undefined、
          //    S.brands = 0 → 畫面空白;重整才好是因為整頁重載會把旗標歸零。
          //    (另一條 SSO 路徑本來就有重設,兩條行為現在一致)
          _systemStarted = false;
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

// ══ 帳密登入 ══
// 🔐 原本這裡有一張「帳號 → 密碼」對照表,明碼寫死在公開 repo 裡。
//   已整張移除:帳號現在存在 D1 的 app_users,密碼只存雜湊(加獨立的鹽),
//   驗證在 Worker 端做。要新增帳號請用 auth_user_upsert(需 ADMIN_KEY),
//   不要再把任何密碼寫回這個檔案。

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

  // 🔐 密碼一律送去 Worker 驗,前端不知道也不該知道正確答案是什麼
  if (errEl) errEl.textContent = '驗證中…';
  let out = null;
  try {
    const r = await fetch(AUTH_WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: GAS_PASSWORD, action: 'auth_pwd_login', user, pass }),
    });
    out = await r.json();
  } catch (e) {
    if (errEl) errEl.textContent = '❌ 連線失敗,請重試';
    return;
  }
  if (!out || !out.ok || !out.token) {
    if (errEl) errEl.textContent = '❌ ' + ((out && out.error) || '帳號或密碼錯誤');
    return;
  }

  // 驗證成功
  if(errEl) errEl.textContent = '';
  _saveAuthToken(out.token);
  const account = { name: out.name || '' };
  _userEmail = String(out.email || '').toLowerCase();
  window._workerDriveMode = true; // ★ 走 Worker Drive 模式
  window._driveToken = null;       // 不用 Google token
  sessionStorage.setItem('bs_worker_mode', '1');
  sessionStorage.setItem('bs_email', _userEmail);
  sessionStorage.removeItem('bs_token');

 _purgeOtherBrandCaches(_userEmail);   // 🆕 換帳號 → 先清他人品牌快取,避免吃到別人/空的殘留
 try { localStorage.setItem('bs_sso_email', _userEmail); } catch(e){}
 _rememberSession(_userEmail);   // 🔒 記住登入
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

// ═══════════════════════════════════════════════════════════════
//  🔐 身分證(session token)工具箱
//   token 由 Worker 用只有它知道的鑰匙簽章,內容是 email + 角色 + 到期時間。
//   我們這邊只負責「收好、帶著、登出時丟掉」,不解讀也不信任內容
//   —— 真正的判讀永遠在 Worker 那一端。
//   存 localStorage:關掉分頁再開不用重登(跟既有的「記住登入」同步)。
//   ⚠️ key 用 bs_auth_token,不要跟舊的 bs_token(Google Drive token)搞混。
// ═══════════════════════════════════════════════════════════════
const AUTH_TOKEN_KEY = 'bs_auth_token';

function _saveAuthToken(token) {
  if (!token) return;
  try { localStorage.setItem(AUTH_TOKEN_KEY, token); } catch (e) {}
  try { sessionStorage.setItem(AUTH_TOKEN_KEY, token); } catch (e) {}
}
function _clearAuthToken() {
  try { localStorage.removeItem(AUTH_TOKEN_KEY); } catch (e) {}
  try { sessionStorage.removeItem(AUTH_TOKEN_KEY); } catch (e) {}
}
// 給其他檔案取用(kol.html 的全域攔截器之後會用這支把證夾帶進每個請求)
window._bsAuthToken = function () {
  try { return sessionStorage.getItem(AUTH_TOKEN_KEY) || localStorage.getItem(AUTH_TOKEN_KEY) || ''; }
  catch (e) { return ''; }
};

// Google 登入:把 access_token 交給 Worker 換身分證
//   回 { ok:true, token, email }      → 換到了
//   回 { denied:true, error, email }  → Worker 明確說「這個帳號沒權限」→ 該擋
//   回 null                            → Worker 連不上/沒設定 → 呼叫端走舊路
async function _authGoogleLogin(accessToken) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const r = await fetch(AUTH_WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: GAS_PASSWORD, action: 'auth_google_login', access_token: accessToken }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    const out = await r.json();
    if (out && out.ok && out.token) return out;
    // 403 = 驗過了但不在白名單 → 這是「明確拒絕」,不能靠退路放行
    if (r.status === 403) return { denied: true, error: (out && out.error) || '此帳號無使用權限', email: (out && out.email) || '' };
    return null;
  } catch (e) { return null; }
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

// ══ 🆕 換帳號防呆:登入時若與上次登入的 email 不同,清掉「不屬於這個帳號」的品牌樹快取 ══
//    根治「切帳號品牌不見、要按 F5」的第二條路徑:客戶沒點登出、直接換帳號登入時 doLogout 不會跑,
//    舊快取殘留會讓開機那段「先拿快取秒開」顯示錯誤/空白畫面。
function _purgeOtherBrandCaches(email) {
  try {
    const keep = 'bs_brandos_' + (email || '');
    const prev = localStorage.getItem('bs_sso_email') || '';
    if (prev && prev === email) return;          // 同一個帳號 → 快取可留,維持秒開
    const dead = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.indexOf('bs_brandos_') === 0 && k !== keep) dead.push(k);
    }
    dead.forEach(k => { try { localStorage.removeItem(k); } catch(e){} });
    if (dead.length) console.log('[login] 換帳號 → 已清他人品牌快取 ' + dead.length + ' 筆');
  } catch(e){}
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
  _clearAuthToken();   // 🔐 身分證一併作廢,不然登出後那張證還能用
  try { localStorage.removeItem('bs_sso_token'); localStorage.removeItem('bs_sso_email'); } catch(e){}
  try { localStorage.removeItem('bs_email'); localStorage.removeItem('bs_worker_mode'); } catch(e){}   // 🔒 一併清掉「記住登入」
  // 🆕 根治「切帳號品牌不見、要按 F5」:登出時把所有帳號的品牌樹快取(bs_brandos_*)一併清掉
  //    原因:品牌快取 key 是 'bs_brandos_'+email,登出只清 token/email 時這些快取會留著,
  //    換帳號登入時開機那段「先拿快取秒開」會吃到殘留/空的資料 → 畫面空白要手動硬重整。
  try {
    const _dead = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.indexOf('bs_brandos_') === 0) _dead.push(k);
    }
    _dead.forEach(k => { try { localStorage.removeItem(k); } catch(e){} });
    if (_dead.length) console.log('[logout] 已清品牌快取 ' + _dead.length + ' 筆');
  } catch(e){}
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
// ═══════════════════════════════════════════════════════════════
//  🔒 記住登入(worker 模式)
//  原本身分只存 sessionStorage → 關掉分頁就消失 → 每次都要重登。
//  worker 模式不需要 Google token(Drive 走服務帳號),身分只是 email,
//  因此可安全地複製一份到 localStorage,開機時回填。
//  ⚠️ 登出會一併清除;白名單驗證仍在伺服器端,記住的只是「我是誰」。
// ═══════════════════════════════════════════════════════════════
function _rememberSession(email) {
  try {
    if (!email) return;
    localStorage.setItem('bs_email', email);
    localStorage.setItem('bs_worker_mode', '1');
  } catch (e) {}
}
function _restoreSession() {
  try {
    if (sessionStorage.getItem('bs_email')) return;              // 這個分頁已有身分 → 不動
    const em = localStorage.getItem('bs_email') || '';
    const wm = localStorage.getItem('bs_worker_mode') || '';
    if (em && wm === '1') {
      sessionStorage.setItem('bs_email', em);
      sessionStorage.setItem('bs_worker_mode', '1');
      // 🔐 身分證也一起還原(localStorage 有、這個分頁沒有 → 補回來)
      try {
        const tk = localStorage.getItem(AUTH_TOKEN_KEY) || '';
        if (tk && !sessionStorage.getItem(AUTH_TOKEN_KEY)) sessionStorage.setItem(AUTH_TOKEN_KEY, tk);
      } catch (e) {}
      console.log('[login] 已還原上次登入:' + em);
    }
  } catch (e) {}
}

async function startSystem() {
  _restoreSession();   // 🔒 先把記住的身分放回 sessionStorage,再走原本流程
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
  // 🆕 根治「切帳號品牌空白要按 F5」:
  //    ① 舊 bug:開機時 _userEmail 還沒讀到 → key 變 bs_brandos__anon,若那份是空的([]),
  //       秒開會把畫面洗成空品牌且標記已顯示,後端明明回 10 個品牌也救不回來。
  //    ② 兩道鎖:(a) 沒 email 時完全不吃快取 (b) 快取內品牌為空一律不採用,並順手刪掉那份髒快取。
  let _shownFromCache = false;
  try {
    const cached = _userEmail ? localStorage.getItem(_brandKey) : null;   // (a) 沒 email → 不吃快取
    if (cached) {
      const _cd = JSON.parse(cached);
      if (((_cd && _cd.brands) || []).length) {                            // (b) 只有真的有品牌才秒開
        buildDataFromSheets(_cd);
        renderNavBrands();
        renderBrandTree();
        overlay.style.display = 'none';   // 不卡初始化畫面
        _shownFromCache = true;
      } else {
        try { localStorage.removeItem(_brandKey); } catch(e) {}            // 空快取 = 髒的,直接清掉
        console.log('[boot] 忽略並清除空的品牌快取:' + _brandKey);
      }
    }
  } catch (e) {}

  // 🆕 順手清掉歷史遺留的 _anon 空快取(舊版寫進去的元凶)
  try { const _a = localStorage.getItem('bs_brandos__anon');
    if (_a && !((JSON.parse(_a) || {}).brands || []).length) localStorage.removeItem('bs_brandos__anon');
  } catch(e) {}

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
    // 🆕 資安:後端說 ok 但品牌是空的,也視為「這次沒拿到」→ 走下面的錯誤處理,
    //    不要靜靜畫出空白畫面讓客戶以為系統壞了。
    if (!((json.data && json.data.brands) || []).length) throw new Error('後端未回傳任何品牌');
    buildDataFromSheets(json.data);
    // 🆕 只在「有 email + 真的有品牌」時才寫快取:避免寫出 bs_brandos__anon 或空清單這種髒快取
    try {
      if (_userEmail && ((json.data && json.data.brands) || []).length) {
        localStorage.setItem(_brandKey, JSON.stringify(json.data));
      }
    } catch(e) {}
    if (!_shownFromCache) document.getElementById('initMsg').textContent = '✅ 系統就緒！';
    // 背景刷新後,只有使用者還沒點任何品牌時才重畫(避免打斷操作)
    if (_shownFromCache && !window.S.brandId) { renderNavBrands(); renderBrandTree(); }
  } catch (e) {
    console.warn('fallback:', e.message);
    // 🆕🔒 資安根治:LOCAL_FALLBACK_DATA 是「寫死的全部品牌」離線備援。
    //    舊行為:只要跟後端拿品牌失敗(GAS 抽風/超時/Worker 異常),就無條件把全部品牌塞給畫面
    //           → 客戶帳號(如 test)會看到不屬於他的所有品牌 = 跨帳號資料外洩。
    //    新行為:只有管理員本人可用這份離線備援;其他帳號一律顯示「載入失敗」。
    //           寧可什麼都不給,也絕不把別人的品牌給錯的人看。
    if (!_shownFromCache) {
      const _isOwner = _userEmail && (_userEmail === ADMIN_EMAIL);
      if (_isOwner) {
        buildDataFromSheets(LOCAL_FALLBACK_DATA);
        document.getElementById('initMsg').textContent = '✅ 系統就緒！（本地資料）';
      } else {
        buildDataFromSheets({ brands: [], products: [], folders: [] });   // 明確清空,不留任何他人資料
        document.getElementById('initMsg').textContent = '⚠️ 資料載入失敗,請重新整理頁面';
        console.warn('[安全] 非管理員帳號不套用本地備援品牌清單,已清空。');
      }
    }
  }

  if (!_shownFromCache) {
    await new Promise(r => setTimeout(r, 300)); // 🆕 WIN2：600→300,只留一下下讓「就緒」閃過
    document.getElementById('initOverlay').style.display = 'none';
    renderNavBrands();
    renderBrandTree();
  }
}
