// ══════════════════════════════════════════
//  assets.js — Drive素材庫、智慧快取、素材選取
// ══════════════════════════════════════════

// ══ 智慧快取：每個品牌只抓一次 ══
const _assetCache = {}; // { brandId: { photos:[], videos:[], loaded:true } }

async function autoFetchAssets(brandId) {
  if (!window._driveToken) return;
  if (_assetCache[brandId]?.loaded) {
    // 已載入過 → 直接從快取還原
    window.S.photos   = _assetCache[brandId].photos;
    window.S.videos   = _assetCache[brandId].videos;
    window.S.selPhoto = null;
    window.S.selVideo = null;
    renderAssets();
    return;
  }
  // 還沒載入過 → 去 Drive 抓
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

  // 存入快取
  _assetCache[brandId] = {
    loaded: true,
    photos: [...window.S.photos],
    videos: [...window.S.videos]
  };

  renderAssets();
  setDriveStatus('ok');
}

// ══ 手動抓取（按鈕觸發）══
async function fetchDriveAssets(type) {
  if (!window._driveToken) {
    document.getElementById('assetGrid').innerHTML = `
      <div style="margin:12px;padding:14px;background:rgba(212,24,46,0.12);border:1.5px solid #D4182E;border-radius:10px;text-align:center;">
        <div style="font-size:13px;font-weight:900;color:#FF4D6A;">· 尚未連結 Google Drive！</div>
        <button onclick="driveLogin()" style="margin-top:10px;padding:8px 20px;background:#D4182E;border:none;border-radius:8px;color:#fff;font-family:'Noto Sans TC',sans-serif;font-size:12px;font-weight:900;cursor:pointer;">· 立即連結 Drive</button>
      </div>`;
    return;
  }
  const inputId = type === 'photo' ? 'inPhotoFolder' : 'inVideoFolder';
  const btnId   = type === 'photo' ? 'fetchPhotoBtn' : 'fetchVideoBtn';
  const raw     = document.getElementById(inputId)?.value?.trim();
  const folderId = parseDriveId(raw);
  const btn     = document.getElementById(btnId);
  if (!raw) { alert('請先貼上 Drive 資料夾連結'); return; }
  if (btn) { btn.disabled = true; btn.textContent = '載入中…'; }
  setDriveStatus('busy');
  if (window._driveToken && folderId) await fetchFromDriveAPI(folderId, type, window._driveToken);
  if (btn) { btn.disabled = false; btn.textContent = type === 'photo' ? '抓照片' : '抓影片'; }
  renderAssets();
  setDriveStatus('ok');
}

async function fetchBoth() {
  if (!window._driveToken) { alert('請先連結 Google Drive'); return; }
  const photoRaw = document.getElementById('inPhotoFolder')?.value?.trim();
  const videoRaw = document.getElementById('inVideoFolder')?.value?.trim();
  if (!photoRaw && !videoRaw) { alert('請先填入照片或影片資料夾連結'); return; }
  if (photoRaw) await fetchDriveAssets('photo');
  if (videoRaw) await fetchDriveAssets('video');
  // 更新快取
  const bid = window.S.brandId;
  if (bid) {
    _assetCache[bid] = { loaded:true, photos:[...window.S.photos], videos:[...window.S.videos] };
  }
}

// ══ Drive API 實際抓取 ══
async function fetchFromDriveAPI(folderId, type, token) {
  const mimeFilter = type === 'photo' ? "mimeType contains 'image/'" : "mimeType contains 'video/'";
  const q = encodeURIComponent(`'${folderId}' in parents and (${mimeFilter}) and trashed=false`);
  try {
    const r = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,mimeType,thumbnailLink,webViewLink)&pageSize=100`,
      { headers: { Authorization: 'Bearer ' + token } }
    );
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
          // 背景載入實際圖片
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
  if (!html) html = '<div class="empty"><div class="empty-ico">·</div><div class="empty-p">切換品牌自動載入素材<br>或點「一鍵抓全部素材」</div></div>';
  grid.innerHTML = html;
}

// ══ 素材項目 HTML ══
function assetItemHtml(f, i, type, sel) {
  const fallback = type === 'photo' ? '圖' : '影';
  const errHandler = 'this.parentNode.innerHTML=\'' + fallback + '\'';
  let thumb;
  if (f.src)        thumb = '<img src="' + f.src   + '" onerror="' + errHandler + '">';
  else if (f.thumb) thumb = '<img src="' + f.thumb + '" onerror="' + errHandler + '">';
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
  // 如果已有腳本，同步更新腳本區提示
  if (window.S.scripts.length > 0) {
    const brand = window.BRANDS.find(b => b.id === window.S.brandId);
    const sub   = brand?.subs.find(s => s.id === window.S.subId);
    renderScripts(`${brand?.name||''}${sub?' › '+sub.name:''}`, sub?.color || brand?.navColor);
  }
}

// ══ Drive 上傳廣告圖 ══
async function uploadAdToDrive(canvas, filename) {
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
