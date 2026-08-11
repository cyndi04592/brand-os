// ══════════════════════════════════════════
//  assets.js — Drive素材庫、智慧快取、素材選取
// ══════════════════════════════════════════

// ══ 智慧快取：每個品牌只抓一次（記憶體層）══
const _assetCache = {};

// ══ 🆕 WIN1 持久快取（localStorage）：刷新後切品牌也秒開 ══
//    只存「清單文字」(檔名/driveId/縮圖網址)，絕不存 full/canvasRes 原圖(MB 級)
//    10 分鐘 TTL；「重新抓取」按鈕會連這層一起清
const _ASSET_LS_PREFIX = 'bs_assets_';
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
function _assetReqStale(reqId) { return reqId !== undefined && reqId !== _assetReqSeq; }

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

async function autoFetchAssets(brandId) {
  // ★ Worker Drive 模式（帳密登入）
  if (window._workerDriveMode) {
    await autoFetchAssetsWorker(brandId);
    return;
  }
  // 原本 Google OAuth 模式
  if (!window._driveToken) return;
  _hydrateFromLS(brandId); // 🆕 WIN1：刷新後先看本地有沒有
  if (_assetCache[brandId]?.loaded) {
    window.S.photos   = _assetCache[brandId].photos;
    window.S.videos   = _assetCache[brandId].videos;
    window.S.selPhoto = null;
    window.S.selVideo = null;
    renderAssets();
    return;
  }
  const f = window.BRAND_FOLDERS[brandId];
  if (!f) return;

  window.S.photos   = [];
  window.S.videos   = [];
  window.S.selPhoto = null;
  window.S.selVideo = null;

  setDriveStatus('busy');
  const _req = ++_assetReqSeq;   // 🩹 2026-08-11:這一輪的流水號
  const photoInput = document.getElementById('inPhotoFolder');
  const videoInput = document.getElementById('inVideoFolder');

  const promises = [];
  if (f.photo && photoInput) {
    photoInput.value = f.photo;
    promises.push(fetchFromDriveAPI(f.photo, 'photo', window._driveToken, _req));
  }
  if (SHOW_VIDEO_ASSETS && f.video && videoInput) {
    videoInput.value = f.video;
    promises.push(fetchFromDriveAPI(f.video, 'video', window._driveToken, _req));
  }
  await Promise.all(promises);
  // 🩹 抓完才發現已經切走 → 不准寫進快取,也不准重畫(否則會把別的品牌的清單存成這個品牌的)
  if (_assetReqStale(_req)) return;

  _assetCache[brandId] = {
    loaded: true,
    photos: [...window.S.photos],
    videos: [...window.S.videos]
  };
  _saveAssetCacheLS(brandId, window.S.photos, window.S.videos); // 🆕 WIN1

  renderAssets();
  setDriveStatus('ok');
}

// ★ Worker Drive 模式：透過小號 Refresh Token 抓圖
async function autoFetchAssetsWorker(brandId) {
  _hydrateFromLS(brandId); // 🆕 WIN1：刷新後先看本地有沒有
  if (_assetCache[brandId]?.loaded) {
    window.S.photos   = _assetCache[brandId].photos;
    window.S.videos   = _assetCache[brandId].videos;
    window.S.selPhoto = null;
    window.S.selVideo = null;
    renderAssets();
    return;
  }
  const f = window.BRAND_FOLDERS[brandId];
  if (!f) return;

  window.S.photos   = [];
  window.S.videos   = [];
  window.S.selPhoto = null;
  window.S.selVideo = null;
  setDriveStatus('busy');
  const _req = ++_assetReqSeq;   // 🩹 2026-08-11:這一輪的流水號

  const photoInput = document.getElementById('inPhotoFolder');
  const videoInput = document.getElementById('inVideoFolder');

  const promises = [];
  if (f.photo) {
    if (photoInput) photoInput.value = f.photo;
    promises.push(fetchFromWorker(f.photo, 'photo', _req));  // 🆕 Worker 直讀 Drive(Service Account+重試),不走 GAS 抽風
  }
  if (SHOW_VIDEO_ASSETS && f.video) {
    if (videoInput) videoInput.value = f.video;
    promises.push(fetchFromWorker(f.video, 'video', _req));  // 🆕 同上,走 Worker
  }
  await Promise.all(promises);
  // 🩹 抓完才發現已經切走 → 不准寫進快取,也不准重畫
  if (_assetReqStale(_req)) return;

  _assetCache[brandId] = {
    loaded: true,
    photos: [...window.S.photos],
    videos: [...window.S.videos]
  };
  _saveAssetCacheLS(brandId, window.S.photos, window.S.videos); // 🆕 WIN1

  renderAssets();
  setDriveStatus('ok');
}

// ══ 🆕 傳輸層自動重試:對付 Cloudflare QUIC/HTTP3 間歇性斷線 ══
//    QUIC 斷線會讓 fetch 直接 throw「TypeError: Failed to fetch」(即使伺服器已回 200 OK)
//    → 自動重打:指數退避 + jitter(跟 GAS gasFetch 同款抗性)
//    ⚠️ 只用於「讀取類、可重複安全」的請求;上傳/建檔等寫入絕不可套(會重複)
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

// ★ 透過 Cloudflare Worker 抓 Drive 檔案
async function fetchFromWorker(folderId, type, reqId) {
  if (!folderId) return;
  try {
    const data = await _retryFetchJson(() => fetch(CF_WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'drive_files',
        password: GAS_PASSWORD,
        folderId,
        type: type === 'photo' ? 'photo' : 'video'
      })
    }), 'drive_files');
    if (!data.ok) { console.warn('Worker Drive error:', data.error); return; }
    // 🩹 回應回來時已經切到別的品牌 → 整包丟掉,絕不 push(否則會污染新品牌的素材庫)
    if (_assetReqStale(reqId)) { console.warn('[assets] 已切換品牌,丟棄過期的素材回應'); return; }

    (data.files || []).forEach(f => {
      const arr = type === 'photo' ? window.S.photos : window.S.videos;
      if (!arr.find(x => x.driveId === f.id)) {
        arr.push({
          driveId: f.id,
          name: f.name,
          thumb: f.thumbnailLink || '',
          hiRes: (f.thumbnailLink || '').replace(/=s\d+/, '=s1600'),  // 🆕 生圖用高解析(s1600)
          driveUrl: f.viewUrl,
          src: (f.thumbnailLink || '').replace(/=s\d+/, '=s400'),     // 🆕 列表強制縮成 s400(載入快)
          type
        });
      }
    });
  } catch (e) { console.warn('fetchFromWorker error:', e); }
}

// ★ 透過 GAS（owner 帳號）抓 Drive 檔案 —— 不靠服務帳號金鑰，最穩（跟 KOL 同一條路）
async function fetchFromGAS(folderId, type, reqId) {
  if (!folderId) return;
  try {
    const url = `${GAS_URL}?action=listBrandAssets&password=${GAS_PASSWORD}&folderId=${encodeURIComponent(folderId)}&type=${type === 'photo' ? 'photo' : 'video'}`;
    const resp = await fetch(url);
    const data = await resp.json();
    if (!data.ok) { console.warn('GAS Drive error:', data.error); return; }
    if (_assetReqStale(reqId)) { console.warn('[assets] 已切換品牌,丟棄過期的素材回應'); return; }   // 🩹 2026-08-11 競速防護

    (data.files || []).forEach(f => {
      const arr = type === 'photo' ? window.S.photos : window.S.videos;
      if (!arr.find(x => x.driveId === f.id)) {
        arr.push({
          driveId: f.id,
          name: f.name,
          thumb:    `https://drive.google.com/thumbnail?id=${f.id}&sz=w400`,
          hiRes:    `https://drive.google.com/uc?id=${f.id}`,   // 生圖用原圖（跟 KOL 一樣）
          driveUrl: `https://drive.google.com/file/d/${f.id}/view`,
          src:      `https://drive.google.com/thumbnail?id=${f.id}&sz=w400`,  // 列表用縮圖（載入快）
          type
        });
      }
    });
  } catch (e) { console.warn('fetchFromGAS error:', e); }
}

// ══ 手動抓取（按鈕觸發）══
async function fetchDriveAssets(type) {
  if (window._workerDriveMode) {
    await fetchBoth();
    return;
  }
  if (!window._driveToken) {
    document.getElementById('assetGrid').innerHTML = `
      <div style="margin:12px;padding:14px;background:rgba(212,24,46,0.12);border:1.5px solid #D4182E;border-radius:10px;text-align:center;">
        <div style="font-size:13px;font-weight:900;color:#FF4D6A;">· 尚未連結 Google Drive！</div>
        <button onclick="driveLogin()" style="margin-top:10px;padding:8px 20px;background:#D4182E;border:none;border-radius:8px;color:#fff;font-family:'Noto Sans TC',sans-serif;font-size:12px;font-weight:900;cursor:pointer;">· 立即連結 Drive</button>
      </div>`;
    return;
  }
  const inputId  = type === 'photo' ? 'inPhotoFolder' : 'inVideoFolder';
  const raw      = document.getElementById(inputId)?.value?.trim();
  const folderId = parseDriveId(raw);
  if (!raw) { alert('請先貼上 Drive 資料夾連結'); return; }
  setDriveStatus('busy');
  const _req = ++_assetReqSeq;   // 🩹 2026-08-11:單獨抓某一類也算新的一輪
  if (window._driveToken && folderId) await fetchFromDriveAPI(folderId, type, window._driveToken, _req);
  renderAssets();
  setDriveStatus('ok');
}

async function fetchBoth() {
  ++_assetReqSeq;   // 🩹 2026-08-11:手動重抓 = 新的一輪,先讓所有在路上的舊回應失效
  const bid = window.S.brandId;
  if (bid) { delete _assetCache[bid]; _clearAssetCacheLS(bid); } // 🆕 WIN1：手動重抓連本地一起清
  window.S.photos = [];
  window.S.videos = [];

  // ★ Worker Drive 模式
  if (window._workerDriveMode) {
    await autoFetchAssetsWorker(bid);
    return;
  }

  if (!window._driveToken) { driveLogin(); return; }

  const photoRaw = document.getElementById('inPhotoFolder')?.value?.trim();
  const videoRaw = document.getElementById('inVideoFolder')?.value?.trim();

  if (!photoRaw && !videoRaw) {
    const f = window.BRAND_FOLDERS[bid];
    if (f?.photo) document.getElementById('inPhotoFolder').value = f.photo;
    if (f?.video) document.getElementById('inVideoFolder').value = f.video;
  }

  setDriveStatus('busy');
  const pRaw = document.getElementById('inPhotoFolder')?.value?.trim();
  const vRaw = document.getElementById('inVideoFolder')?.value?.trim();

  const promises = [];
  if (pRaw) promises.push(fetchFromDriveAPI(parseDriveId(pRaw) || pRaw, 'photo', window._driveToken));
  if (SHOW_VIDEO_ASSETS && vRaw) promises.push(fetchFromDriveAPI(parseDriveId(vRaw) || vRaw, 'video', window._driveToken));
  await Promise.all(promises);

  if (bid) {
    _assetCache[bid] = { loaded: true, photos: [...window.S.photos], videos: [...window.S.videos] };
  }
  renderAssets();
  setDriveStatus('ok');
}

// ══ Drive API 實際抓取（原本 Google OAuth 流程，不動）══
async function fetchFromDriveAPI(folderId, type, token, reqId) {
  const mimeFilter = type === 'photo' ? "mimeType contains 'image/'" : "mimeType contains 'video/'";
  const q = encodeURIComponent(`'${folderId}' in parents and (${mimeFilter}) and trashed=false`);
  try {
    const r = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,mimeType,thumbnailLink,webViewLink)&pageSize=100`,
      { headers: { Authorization: 'Bearer ' + token } }
    );

    if (r.status === 401) {
      console.warn('Drive token 過期，清除快取重新授權');
      sessionStorage.removeItem('bs_token');
      window._driveToken = null;
      setDriveStatus('err');
      document.getElementById('assetGrid').innerHTML = `
        <div style="margin:12px;padding:14px;background:rgba(212,24,46,0.12);border:1.5px solid #D4182E;border-radius:10px;text-align:center;">
          <div style="font-size:13px;font-weight:900;color:#FF4D6A;margin-bottom:6px;">· Drive 授權已過期</div>
          <div style="font-size:11px;color:#FF8099;margin-bottom:10px;">請重新連結 Google Drive</div>
          <button onclick="driveLogin()" style="padding:8px 20px;background:#D4182E;border:none;border-radius:8px;color:#fff;font-family:'Noto Sans TC',sans-serif;font-size:12px;font-weight:900;cursor:pointer;">· 重新連結 Drive</button>
        </div>`;
      return;
    }

    const d = await r.json();
    if (_assetReqStale(reqId)) { console.warn('[assets] 已切換品牌,丟棄過期的素材回應'); return; }   // 🩹 2026-08-11 競速防護
    if (d.files) {
      d.files.forEach(f => {
        const arr = type === 'photo' ? window.S.photos : window.S.videos;
        if (!arr.find(x => x.driveId === f.id)) {
          // 🆕 列表只用縮圖(s400):切品牌秒開,不再每張載原圖 base64
          //    原圖等「生圖時」才靠 driveId 抓那一張(見 ensureFullRes)
          const thumb400 = (f.thumbnailLink || '').replace(/=s\d+/, '=s400');
          arr.push({
            driveId: f.id, name: f.name, thumb: thumb400,
            driveUrl: f.webViewLink || `https://drive.google.com/file/d/${f.id}/view`,
            src: '', full: '', type
          });
        }
      });
      renderAssets();
    }
  } catch (e) { console.warn('Drive API error', e); }
}

// ══ 🆕 生圖前才抓「那一張」原圖 base64(避開列表全載的 324MB)══
//    列表只有縮圖,真正生圖/合成才用 driveId 重新抓原檔 → 畫質一樣、不踩 CORS/tainted 坑
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
      <div class="ai-meta">Drive 素材</div>
    </div>
    <span class="ai-check">✓</span>
  </div>`;
}

// ══ 選取素材 ══
function selectAsset(type, i) {
  if (type === 'photo') window.S.selPhoto = window.S.selPhoto === i ? null : i;
  else                  window.S.selVideo = window.S.selVideo === i ? null : i;
  renderAssets();
  // 🆕 選到照片就背景偷抓原圖(暖機);原圖一到自動重畫預覽 → 從縮圖變清晰
  if (type === 'photo' && window.S.selPhoto !== null) {
    const sel = window.S.selPhoto;
    // 防 LAG:記憶體永遠只留正在用的這一張原圖,其餘還原成縮圖
    window.S.photos.forEach((p, idx) => { if (idx !== sel) p.full = ''; });
    ensureFullRes(window.S.photos[sel]).then(() => {
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
async function uploadAdToDrive(canvas, filename) {
  if (window._workerDriveMode) return; // worker mode 不支援上傳
  const dlBtn = document.getElementById('adDownloadBtn');
  const origText = dlBtn?.textContent || '';
  if (dlBtn) { dlBtn.textContent = '· 上傳中...'; dlBtn.disabled = true; }
  try {
    const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.92));
    let folderId = window.DRIVE_OUTPUT_FOLDER_ID;
    if (!folderId) { folderId = await getOrCreateAdFolder(); window.DRIVE_OUTPUT_FOLDER_ID = folderId; }
    const meta = JSON.stringify({ name: filename, parents: folderId ? [folderId] : [] });
    const form = new FormData();
    form.append('metadata', new Blob([meta], { type: 'application/json' }));
    form.append('file', blob, filename);
    const resp = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + window._driveToken },
      body: form
    });
    if (!resp.ok) throw new Error('上傳失敗');
    if (dlBtn) { dlBtn.textContent = '· 已存到 Drive！'; setTimeout(() => { dlBtn.textContent = origText; dlBtn.disabled = false; }, 3000); }
  } catch (e) {
    if (dlBtn) { dlBtn.textContent = origText; dlBtn.disabled = false; }
  }
}

async function getOrCreateAdFolder() {
  const token = window._driveToken;
  const search = await fetch(
    "https://www.googleapis.com/drive/v3/files?q=name%3D'Brand+OS+廣告圖'+and+mimeType%3D'application%2Fvnd.google-apps.folder'+and+trashed%3Dfalse&fields=files(id)",
    { headers: { 'Authorization': 'Bearer ' + token } }
  );
  const sdata = await search.json();
  if (sdata.files?.length > 0) return sdata.files[0].id;
  const create = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Brand OS 廣告圖', mimeType: 'application/vnd.google-apps.folder' })
  });
  return (await create.json()).id;
}

// ══ Drive ID 解析 ══
function parseDriveId(raw) {
  if (!raw) return '';
  const m = raw.match(/folders\/([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  if (/^[a-zA-Z0-9_-]{25,}$/.test(raw)) return raw;
  return raw;
}
