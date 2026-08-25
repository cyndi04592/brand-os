// ══════════════════════════════════════════
//  assets.js — Drive素材庫、智慧快取、素材選取
// ══════════════════════════════════════════

// ══ 智慧快取：每個品牌只抓一次（記憶體層）══
const _assetCache = {};

// ══ 🆕 WIN1 持久快取（localStorage）：刷新後切品牌也秒開 ══
//    只存「清單文字」(檔名/driveId/縮圖網址)，絕不存 full/canvasRes 原圖(MB 級)
//    10 分鐘 TTL；「重新抓取」按鈕會連這層一起清
// ⚠️ 2026-08-21 前綴改版 → 舊的本地快取自動失效。
//   不改的話,瀏覽器裡存著昨天的 Drive 清單,新程式根本不會被執行到
//   —— 今天就踩到:改完部署了,畫面完全沒變、Console 一行都沒印。
const _ASSET_LS_PREFIX = 'bs_assets_lib1_';
const _ASSET_LS_TTL = 10 * 60 * 1000; // 10 分鐘

// 🩹 2026-08-11 切品牌競速防護(RA 實測:選巧福卻跑出旺味的香腸照)
//   病灶:fetchFromWorker / fetchFromDriveAPI / fetchFromGAS 都是直接 push 進
//   全域的 window.S.photos / videos,而且「完全不檢查現在是哪個品牌」。
//   → 從旺味切到巧福時,旺味那筆還在路上;巧福先清空陣列、開始抓,
//     旺味的回應晚幾百毫秒回來,就 push 進巧福的清單裡。
//   → 更慘的是接著 _saveAssetCacheLS 把「混到的清單」存進 localStorage,
//     10 分鐘內怎麼重整都還是錯的,客戶只會覺得系統在亂給素材。
//   修法:每次發動抓取就給一個流水號;回應回來時流水號對不上 = 已經切走了,整包丟掉。
let _assetReqSeq = 0;

// 🩹 2026-08-11 素材庫不再抓/顯示影片。
//   病灶:Drive 的「影片」資料夾裝的是 Brand OS「生成完的成品」(saveVideoToDrive 存回去的),
//   不是可以拿來做廣告的素材。素材庫把成品當素材列出來,邏輯是反的,客戶會困惑。
//   而且 window.S.selVideo 全站沒有任何地方在讀 —— 點了不會發生任何事,是死功能。
//   附帶好處:每次切品牌少打一次 Drive,載入更快。
//   要恢復的話把這個改回 true 即可(渲染與抓取都吃這個旗標)。
const SHOW_VIDEO_ASSETS = false;
// ═══════════════════════════════════════════════════════════════
//  🩹 2026-08-24 競速防護改判準:流水號 → 品牌 ID
//   現場(RA 回報):香港福臨門(ff)員工在素材庫看得到 55 張,
//     主站「品牌素材庫」卻是空的。實測 API 正常回 55 筆、篩選後 45 張,
//     但 fetchFromLibrary(brandId, undefined) 關掉這道防護就立刻進來 ——
//     ★ 資料一直都在,是被【我們自己的防護】丟掉的。
//   ★ 病灶:_assetReqSeq 在 4 個地方 ++,而切品牌時有【兩個入口】
//     都會先 ++ 再發請求。先發的那個回來時號碼已被推進 → 判定「過期」→ 整包丟。
//     商品照最多的品牌回應最慢,所以【最慢的那個最容易被自己判死】。
//     而且它丟得很安靜:不報錯、不提示,畫面只是空的。
//   ★ 修法:號碼會因為重複觸發而失準,但【品牌 ID 不會騙人】。
//     只要回來的資料就是「當前品牌」的,就該收下,管它是第幾次請求。
//     這樣既保住原本的防護目的(2026-08-19 那次 HH 素材區混進浟意褌舞的照片),
//     又不會誤殺自己人 —— 而且比流水號更精準,因為它擋的正是「別的品牌」。
//   ⚠️ 沒帶 brandId 的舊呼叫點(Drive 那三條路)自動退回流水號判斷,行為不變。
// ═══════════════════════════════════════════════════════════════
function _assetReqStale(reqId, brandId) {
  if (brandId !== undefined && brandId !== null && brandId !== '') {
    const _cur = (window.S && (window.S.brandId || window.S.currentBrandId)) || '';
    return String(brandId) !== String(_cur);
  }
  return reqId !== undefined && reqId !== _assetReqSeq;
}

function _slimAsset(p) {
  return {
    driveId: p.driveId, name: p.name, thumb: p.thumb || '',
    src: p.src || '', hiRes: p.hiRes || '', driveUrl: p.driveUrl || '', type: p.type
  };
}
function _saveAssetCacheLS(brandId, photos, videos) {
  try {
    const payload = { t: Date.now(),
      photos: (photos || []).map(_slimAsset),
      videos: (videos || []).map(_slimAsset) };
    localStorage.setItem(_ASSET_LS_PREFIX + brandId, JSON.stringify(payload));
  } catch (e) { /* 滿或被禁用 → 靜默略過，不影響功能 */ }
}
function _loadAssetCacheLS(brandId) {
  try {
    const raw = localStorage.getItem(_ASSET_LS_PREFIX + brandId);
    if (!raw) return null;
    const payload = JSON.parse(raw);
    if (!payload || (Date.now() - payload.t) > _ASSET_LS_TTL) {
      localStorage.removeItem(_ASSET_LS_PREFIX + brandId);
      return null; // 過期
    }
    return payload;
  } catch (e) { return null; }
}
function _clearAssetCacheLS(brandId) {
  try { localStorage.removeItem(_ASSET_LS_PREFIX + brandId); } catch (e) {}
}
// 記憶體沒有就從本地補進來(刷新後第一次切該品牌會用到)
function _hydrateFromLS(brandId) {
  if (_assetCache[brandId]?.loaded) return;
  const ls = _loadAssetCacheLS(brandId);
  // 🩹 2026-08-11:舊快取裡可能還存著影片清單 → 關閉影片素材時一律不還原,免得舊資料又冒出來
  if (ls) _assetCache[brandId] = { loaded: true, photos: ls.photos, videos: SHOW_VIDEO_ASSETS ? ls.videos : [] };
}

// ═══════════════════════════════════════════════════════════════
//  📚 2026-08-24 v2.0 · Google Drive 全面退場,素材庫成為唯一來源
//   RA 決策:「要直接根治」。
//   ★ 病灶(RA 現場實測):主站品牌素材庫空白,而素材庫頁面看得到 55 張。
//     追進去發現舊版 autoFetchAssets 第一行就是:
//         if (!window._driveToken) return;      ← Drive 時代的【入場券】
//     沒有 Drive token 就掉頭走人,連自家素材庫都不去問 ——
//     所以 S.photos 一次都沒動、Console 一則 [assets] 都沒有。
//   ★ 為什麼今天才爆:Google 登入早就改走 _workerDriveMode(零 Drive 權限),
//     只要那個旗標因任何原因沒還原(換分頁 / session 不完整),就會掉進這條死路。
//     KOL 那條線今天已經拆掉 Drive,廣告圖這條【還留著整套】—— 漏了半邊。
//   ★ 新架構:不再有「兩種模式」,不再有入場券。
//     一律 快取 → 素材庫。拿不到就是空的,誠實顯示,不再繞去 Google。
//   ⚠️ ensureFullRes 保留:admaker.js 用它 3 次。素材庫的照片沒有 driveId,
//     它會直接 return,admaker 走 hiRes(原檔網址)—— 行為不變。
// ═══════════════════════════════════════════════════════════════
async function autoFetchAssets(brandId) {
  if (!brandId) return;

  _hydrateFromLS(brandId);                       // 先看本地快取
  if (_assetCache[brandId]?.loaded) {
    window.S.photos   = _assetCache[brandId].photos;
    window.S.videos   = _assetCache[brandId].videos || [];
    window.S.selPhoto = null;
    window.S.selVideo = null;
    renderAssets();
    setDriveStatus('ok');
    return;
  }

  window.S.photos   = [];
  window.S.videos   = [];
  window.S.selPhoto = null;
  window.S.selVideo = null;

  setDriveStatus('busy');
  const _req = ++_assetReqSeq;
  const n = await fetchFromLibrary(brandId, _req);
  if (n === -1) return;                          // 已切走 → 這包不算數

  if (_assetReqStale(_req, brandId)) return;     // 🩹 以品牌為準,不用流水號
  if (n > 0) console.log('[assets] 📚 素材庫供圖 ' + n + ' 張');
  else       console.log('[assets] 📚 這個品牌的素材庫是空的');

  _assetCache[brandId] = { photos: window.S.photos, videos: [], loaded: true };
  _saveAssetCacheLS(brandId);
  renderAssets();
  setDriveStatus(n > 0 ? 'ok' : 'empty');
}

// 🔁 舊名保留:brands.js 以外若還有人叫這個名字,一律導到上面那支
async function autoFetchAssetsWorker(brandId) { return autoFetchAssets(brandId); }

async function _retryFetchJson(makeReq, label, tries) {
  tries = tries || 4;
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const resp = await makeReq();
      return await resp.json();   // ★ 讀 body 也納入重試:QUIC「假 200 壞 body」會在這裡 throw → 觸發重試
    } catch (e) {
      lastErr = e;
      if (i < tries - 1) {
        const wait = Math.min(1600, 250 * Math.pow(2, i)) + Math.floor(Math.random() * 400);
        console.warn(`[retryFetch] ${label || 'req'} 第 ${i + 1}/${tries} 次傳輸中斷,${wait}ms 後重試:`, (e && e.message) ? e.message : e);
        await new Promise(r => setTimeout(r, wait));
      }
    }
  }
  throw lastErr;
}

// ═══════════════════════════════════════════════════════════════
//  🆕 2026-08-21 從自家素材庫讀照片(拆掉 Google Drive 的一環)
//   為什麼:這一頁的素材一直是「去 Google Drive 要」——
//     中國/香港客戶打不開、Drive API 有額度上限、一千個客戶會撐不住,
//     而且同一批照片我們早就搬進自家倉庫了,等於白繞一圈。
//   ★ 素材庫優先、Drive 保底:
//     素材庫拿得到就用素材庫;拿不到(還沒搬、剛建的品牌)自動退回 Drive,
//     客戶不會因為這個改動而看不到素材。
//   ★ 回傳形狀跟 Drive 那條完全一致 —— 後面的渲染、選圖、生圖一行都不用改。
//   🗑 等 Drive 全面退場後,連同 fetchFromWorker / fetchFromGAS 一起移除。
// ═══════════════════════════════════════════════════════════════
const _libCache = {};   // brandId → 照片陣列(切回來秒開,不重打後端)
async function fetchFromLibrary(brandId, reqId, force) {
  // ⚡ 命中快取就直接用 —— 沒有這層,每切一次品牌就重打一次後端,
  //    體感會比 Drive 還慢(Drive 那邊前端本來就有 _assetCache)。
  if (!force && _libCache[brandId]) {
    if (_assetReqStale(reqId, brandId)) return -1;
    // ⚠️ 2026-08-21 修:這裡原本是「往現有清單加」,切品牌時舊的沒清掉
    //    → 兩個品牌的素材會疊在一起。客戶會看到別家的照片,
    //    做圖時也可能選錯。改成「只留這個品牌的」。
    window.S.photos = _libCache[brandId].slice();
    return _libCache[brandId].length;
  }
  try {
    const KOL_URL = (typeof KOL_WORKER_URL !== 'undefined' && KOL_WORKER_URL)
      ? KOL_WORKER_URL : 'https://kol-proxy.calm-sunset-6b66.workers.dev';
    const tk = (function () {
      try { return sessionStorage.getItem('bs_auth_token') || localStorage.getItem('bs_auth_token') || ''; }
      catch (e) { return ''; }
    })();
    const em = (function () {
      try { return localStorage.getItem('bs_sso_email') || ''; } catch (e) { return ''; }
    })();

    const data = await _retryFetchJson(() => fetch(KOL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'list_assets', password: GAS_PASSWORD,
        brandId: brandId, limit: 300, email: em, token: tk
      })
    }), 'list_assets');

    if (!data || !data.ok) { console.warn('[assets] 素材庫讀取失敗,改走 Drive:', data && data.error); return 0; }
    if (_assetReqStale(reqId, brandId)) { console.warn('[assets] 已切換品牌,丟棄過期的素材回應(brandId=' + brandId + ')'); return -1; }
    // 🛡 只留這個品牌的:上一個品牌的殘留清掉,否則兩家素材會混在一起
    window.S.photos = (window.S.photos || []).filter(function (x) { return x._src !== 'library'; });

    // 只收「可以拿來做圖的素材」
    //   ❌ 成品(廣告圖/短影片):不該拿成品當素材
    //   ❌ LOGO:那是疊圖用的,不是背景素材(2026-08-21 RA 指正)
    //   ❌ KOL:人物照走 KOL 工作室那條線
    const OK_CATS = ['照片素材', '商品/服務照', '商品照'];
    let n = 0;
    const _fresh = [];
    (data.items || []).forEach(function (it) {
      if (OK_CATS.indexOf(it.category) === -1) return;
      if (!it.url) return;
      if (window.S.photos.find(function (x) { return x.libUrl === it.url; })) return;
      // 縮圖走同網域的即時轉換:列表小圖、生圖用原檔(鐵律:縮圖絕不餵引擎)
      const thumb = /cdn\.raby\.com\.tw/.test(it.url)
        ? it.url.replace(/^(https:\/\/cdn\.raby\.com\.tw)(\/.*)$/, '$1/cdn-cgi/image/width=400,quality=80,format=auto$2')
        : it.url;
      const _row = {
        driveId: it.drive_id || null,
        libUrl:  it.url,
        name:    it.name || '',
        thumb:   thumb,
        hiRes:   it.url,        // ★ 生圖用原檔,不是縮圖
        driveUrl: it.url,
        src:     thumb,
        type:    'photo',
        _src:    'library'
      };
      window.S.photos.push(_row);
      _fresh.push(_row);
      n++;
    });
    _libCache[brandId] = _fresh;
    return n;
  } catch (e) {
    console.warn('[assets] 素材庫讀取錯誤,改走 Drive:', e.message);
    return 0;
  }
}

// ══ 手動重抓(index.html 右上角「重新抓取」按鈕)══
//  🩹 2026-08-24 v2.0:整支改走素材庫。
//   舊版這裡還有三條活的 Drive 呼叫(driveLogin / fetchFromDriveAPI / parseDriveId),
//   Drive 拆掉後按下去會直接 ReferenceError —— 這是拆檔最容易漏的地方:
//   【被 HTML onclick 直接呼叫的函式,拆內部實作時一定要一起改】。
async function fetchBoth() {
  const bid = window.S.brandId;
  if (!bid) { console.warn('[assets] 還沒選品牌'); return; }
  // 手動重抓 = 連本地快取一起清,強制回源
  delete _assetCache[bid];
  _clearAssetCacheLS(bid);
  _libCache[bid] = null;
  window.S.photos = [];
  window.S.videos = [];
  await autoFetchAssets(bid);
}

async function ensureFullRes(photo, thumb) {
  if (!photo || !photo.driveId) return;
  const key = thumb ? 'canvasRes' : 'full';   // canvas 縮圖與 FAL 原圖分開存,絕不互蓋
  if (photo[key]) return;                       // 已抓過就用快取
  try {
    // ★ 走 Worker（服務帳號讀 Drive→base64）。thumb=true → s1600 縮圖(canvas 用);否則原圖(FAL 用)
    const data = await _retryFetchJson(() => fetch(CF_WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get_asset_base64', password: GAS_PASSWORD, driveFileId: photo.driveId, thumb: !!thumb })
    }), 'get_asset_base64');
    if (data.ok && data.dataUrl) photo[key] = data.dataUrl;
    else console.warn('ensureFullRes Worker error:', data.error);
  } catch (e) { console.warn('ensureFullRes error', e); }
}

// ══ 渲染素材列表 ══
function renderAssets() {
  const grid = document.getElementById('assetGrid');
  let html = '';
  if (window.S.photos.length) {
    html += `<div class="asset-sec">
      <div class="asset-sec-lbl">圖 照片素材 <span class="asset-count" style="color:var(--sky)">${window.S.photos.length}</span></div>
      ${window.S.photos.map((f, i) => assetItemHtml(f, i, 'photo', window.S.selPhoto === i)).join('')}
    </div>`;
  }
  if (SHOW_VIDEO_ASSETS && window.S.videos.length) {
    html += `<div class="asset-sec">
      <div class="asset-sec-lbl">影 影片素材 <span class="asset-count" style="color:var(--peach)">${window.S.videos.length}</span></div>
      ${window.S.videos.map((f, i) => assetItemHtml(f, i, 'video', window.S.selVideo === i)).join('')}
    </div>`;
  }
  if (!html) html = '<div class="empty"><div class="empty-ico">·</div><div class="empty-p">切換品牌自動載入素材<br>或點「重新抓取素材」</div></div>';
  grid.innerHTML = html;
}

// ══ 素材項目 HTML ══
function assetItemHtml(f, i, type, sel) {
  const fallback = type === 'photo' ? '圖' : '影';
  const errHandler = 'this.parentNode.innerHTML=\'' + fallback + '\'';
  let thumb;
  if (f.src)        thumb = '<img loading="lazy" src="' + f.src   + '" onerror="' + errHandler + '">';
  else if (f.thumb) thumb = '<img loading="lazy" src="' + f.thumb + '" onerror="' + errHandler + '">';
  else              thumb = fallback;
  return `<div class="asset-item ${sel?'on':''} ${type}" onclick="selectAsset('${type}',${i})">
    <div class="ai-thumb">${thumb}</div>
    <div class="ai-info">
      <div class="ai-name">${f.name}</div>
      <div class="ai-meta">品牌素材</div>
    </div>
    <span class="ai-check">✓</span>
  </div>`;
}

// ══ 選取素材 ══
function selectAsset(type, i) {
  if (type === 'photo') window.S.selPhoto = window.S.selPhoto === i ? null : i;
  else                  window.S.selVideo = window.S.selVideo === i ? null : i;
  renderAssets();
  // 選到照片就背景暖機,抓好自動重畫預覽 → 從縮圖變清晰
  // 🩹 2026-08-11 預覽變慢的真兇:這裡原本呼叫 ensureFullRes(photo)「不帶 thumb」,
  //   等於每點一張就把「完整原圖」轉 base64 拉回瀏覽器(乾淨原圖動輒數 MB,base64 再脹 1.4 倍)。
  //   而那份 photo.full 全站沒有任何地方真的用到 —— 預覽與合成讀的都是 canvasRes(s1600),
  //   photo.full 只排在 `canvasRes || full || ...` 的後備位,但前一行早就把 canvasRes 抓好了,永遠輪不到。
  //   這是之前「改抓 s1600 治 QUIC 斷線」那次改版的遺留物:主線改小圖了,這支預抓沒跟著改。
  //   修法:改抓 s1600(跟預覽/合成同一份)→ 一次請求解決,體積剩零頭,還省一次來回。
  if (type === 'photo' && window.S.selPhoto !== null) {
    const sel = window.S.selPhoto;
    // 防 LAG:記憶體只留正在用的這一張,其餘的大圖一律釋放
    window.S.photos.forEach((p, idx) => { if (idx !== sel) { p.full = ''; p.canvasRes = ''; } });
    ensureFullRes(window.S.photos[sel], true).then(() => {
      if (typeof renderAdCanvas === 'function') renderAdCanvas();
    });
  }
  if (window.S.scripts.length > 0) {
    const brand = window.BRANDS.find(b => b.id === window.S.brandId);
    const sub   = brand?.subs.find(s => s.id === window.S.subId);
    renderScripts(`${brand?.name||''}${sub?' › '+sub.name:''}`, sub?.color || brand?.navColor);
  }
}

// ══ Drive 上傳廣告圖（只有 Google 模式才能用）══
