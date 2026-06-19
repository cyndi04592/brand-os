// ══════════════════════════════════════════
//  assets.js — Drive素材庫、智慧快取、素材選取
// ══════════════════════════════════════════

// ══ 智慧快取：每個品牌只抓一次 ══
const _assetCache = {};

async function autoFetchAssets(brandId) {
  // ★ Worker Drive 模式（帳密登入）
  if (window._workerDriveMode) {
    await autoFetchAssetsWorker(brandId);
    return;
  }
  // 原本 Google OAuth 模式
  if (!window._driveToken) return;
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
  const photoInput = document.getElementById('inPhotoFolder');
  const videoInput = document.getElementById('inVideoFolder');

  const promises = [];
  if (f.photo && photoInput) {
    photoInput.value = f.photo;
    promises.push(fetchFromDriveAPI(f.photo, 'photo', window._driveToken));
  }
  if (f.video && videoInput) {
    videoInput.value = f.video;
    promises.push(fetchFromDriveAPI(f.video, 'video', window._driveToken));
  }
  await Promise.all(promises);

  _assetCache[brandId] = {
    loaded: true,
    photos: [...window.S.photos],
    videos: [...window.S.videos]
  };

  renderAssets();
  setDriveStatus('ok');
}

// ★ Worker Drive 模式：透過小號 Refresh Token 抓圖
async function autoFetchAssetsWorker(brandId) {
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

  const photoInput = document.getElementById('inPhotoFolder');
  const videoInput = document.getElementById('inVideoFolder');

  const promises = [];
  if (f.photo) {
    if (photoInput) photoInput.value = f.photo;
    promises.push(fetchFromWorker(f.photo, 'photo'));
  }
  if (f.video) {
    if (videoInput) videoInput.value = f.video;
    promises.push(fetchFromWorker(f.video, 'video'));
  }
  await Promise.all(promises);

  _assetCache[brandId] = {
    loaded: true,
    photos: [...window.S.photos],
    videos: [...window.S.videos]
  };

  renderAssets();
  setDriveStatus('ok');
}

// ★ 透過 Cloudflare Worker 抓 Drive 檔案
async function fetchFromWorker(folderId, type) {
  if (!folderId) return;
  try {
    const resp = await fetch(CF_WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'drive_files',
        password: GAS_PASSWORD,
        folderId,
        type: type === 'photo' ? 'photo' : 'video'
      })
    });
    const data = await resp.json();
    if (!data.ok) { console.warn('Worker Drive error:', data.error); return; }

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
  if (window._driveToken && folderId) await fetchFromDriveAPI(folderId, type, window._driveToken);
  renderAssets();
  setDriveStatus('ok');
}

async function fetchBoth() {
  const bid = window.S.brandId;
  if (bid) delete _assetCache[bid];
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
  if (vRaw) promises.push(fetchFromDriveAPI(parseDriveId(vRaw) || vRaw, 'video', window._driveToken));
  await Promise.all(promises);

  if (bid) {
    _assetCache[bid] = { loaded: true, photos: [...window.S.photos], videos: [...window.S.videos] };
  }
  renderAssets();
  setDriveStatus('ok');
}

// ══ Drive API 實際抓取（原本 Google OAuth 流程，不動）══
async function fetchFromDriveAPI(folderId, type, token) {
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
    if (d.files) {
      d.files.forEach(f => {
        const arr = type === 'photo' ? window.S.photos : window.S.videos;
        if (!arr.find(x => x.driveId === f.id)) {
          const item = {
            driveId: f.id, name: f.name, thumb: f.thumbnailLink || '',
            driveUrl: f.webViewLink || `https://drive.google.com/file/d/${f.id}/view`,
            src: '', type
          };
          arr.push(item);
          fetch(`https://www.googleapis.com/drive/v3/files/${f.id}?alt=media`, {
            headers: { Authorization: 'Bearer ' + token }
          }).then(r => r.blob()).then(blob => {
            const reader = new FileReader();
            reader.onload = () => { item.src = reader.result; renderAssets(); };
            reader.readAsDataURL(blob);
          }).catch(() => {});
        }
      });
    }
  } catch (e) { console.warn('Drive API error', e); }
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
  if (window.S.videos.length) {
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
