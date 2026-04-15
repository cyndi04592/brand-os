// ══════════════════════════════════════════
//  admaker.js — AD Maker 素材製作系統 v4.1
//  ✅ AI 電商場景：去背 → Bria Product Shot（全自動串接）
//  ✅ 真人 MD 試穿：Kling kolors
//  ✅ 影片生成：Kling v3 Pro / Seedance 2.0
//  ✅ 影片 poll 超時不報錯，自動再查一次拿結果
// ══════════════════════════════════════════

let AM = { w:1080, h:1080, scriptIdx:null };
let PR_BG_IMG  = null;
let PR_MODE    = 'product_shot';
let TEXT_ALIGN = 'left';

// ── Bria Product Shot 場景 prompt 庫（必須英文）──
const PRODUCT_SCENES = {
  studio:    'clean white studio backdrop, professional soft lighting, minimal shadows',
  lifestyle: 'warm Scandinavian living room, natural window light, wooden surfaces',
  nature:    'lush green outdoor nature setting, golden hour sunlight, soft bokeh',
  camping:   'outdoor camping setting, warm campfire glow, forest background at dusk',
  kitchen:   'premium kitchen counter, warm professional lighting, culinary atmosphere',
  marble:    'elegant Italian marble surface, dark premium backdrop, dramatic golden rim light',
  minimal:   'light grey gradient backdrop, soft diffused lighting, minimalist clean style',
  dark_gold: 'deep black background, dramatic golden accent lighting, luxury brand aesthetic',
  beach:     'tropical beach setting, golden sand, blue ocean in background, warm sunset',
  garden:    'beautiful blooming garden, soft morning sunlight, colorful flowers',
  night:     'city nightscape background, neon bokeh lights, premium evening atmosphere',
  office:    'modern minimalist office interior, clean architectural lines, professional',
};

// ══ 開啟 AD Maker ══
function openAdMaker(idx) {
  PR_BG_IMG = null; PR_MODE = 'product_shot';
  setPrStatus('', '');
  document.querySelectorAll('.pr-mode-btn').forEach(b => b.classList.remove('on'));
  document.querySelector('.pr-mode-btn')?.classList.add('on');
  ['prSceneSection','prVirtualSection','prVideoSection'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = id === 'prSceneSection' ? 'block' : 'none';
  });
  const s = window.S.scripts[idx];
  AM.scriptIdx = idx;
  document.getElementById('amTitle').value = s.hook?.script || '';
  document.getElementById('prCustomPrompt').value = '';
  renderAmPhotoRow();
  document.getElementById('adMakerModal').style.display = 'block';
  renderAdCanvas();
}

function closeAdMaker() { document.getElementById('adMakerModal').style.display = 'none'; }

// ══ 照片縮圖列 ══
function renderAmPhotoRow() {
  const row = document.getElementById('amPhotoThumbRow');
  const nameEl = document.getElementById('amPhotoName');
  if (!row) return;
  if (!window.S.photos.length) {
    row.innerHTML = '<span style="font-size:10px;color:var(--t3);">請先到右側抓取照片</span>';
    if (nameEl) nameEl.textContent = '⚠️ 尚未選擇';
    return;
  }
  row.innerHTML = window.S.photos.map((f, i) => {
    const isSelected = window.S.selPhoto === i;
    const thumb = f.src || f.thumb;
    const imgHtml = thumb
      ? `<img src="${thumb}" style="width:100%;height:100%;object-fit:contain;border-radius:3px;">`
      : '<span style="font-size:16px;">🖼️</span>';
    return `<div onclick="selectPhotoInAM(${i})" title="${f.name}"
      style="width:36px;height:36px;border-radius:5px;overflow:hidden;flex-shrink:0;cursor:pointer;
             border:2px solid ${isSelected?'#5BC8C8':'rgba(255,255,255,0.1)'};background:var(--bg4);
             display:flex;align-items:center;justify-content:center;">${imgHtml}</div>`;
  }).join('');
  if (nameEl) nameEl.textContent = window.S.selPhoto !== null
    ? ('✅ ' + window.S.photos[window.S.selPhoto].name)
    : '← 點選上方照片';
}

function selectPhotoInAM(i) {
  window.S.selPhoto = i; PR_BG_IMG = null;
  renderAmPhotoRow(); renderAssets(); renderAdCanvas();
}

// ══ MD 照片上傳 ══
function onMdPhotoSelected(input) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      const MAX = 1500;
      let w = img.width, h = img.height;
      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round(h*MAX/w); w = MAX; }
        else { w = Math.round(w*MAX/h); h = MAX; }
      }
      const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      const mdImg = document.getElementById('mdPhotoImg');
      const placeholder = document.getElementById('mdPhotoPlaceholder');
      if (mdImg) { mdImg.src = canvas.toDataURL('image/jpeg',0.85); mdImg.style.display = 'block'; }
      if (placeholder) placeholder.style.display = 'none';
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// ══ Mode 切換 ══
function setPrMode(btn, mode) {
  document.querySelectorAll('.pr-mode-btn').forEach(b => b.classList.remove('on'));
  btn.classList.add('on'); PR_MODE = mode;
  document.getElementById('prSceneSection').style.display   = mode === 'product_shot'   ? 'block' : 'none';
  document.getElementById('prVirtualSection').style.display = mode === 'kling_tryon'    ? 'block' : 'none';
  document.getElementById('prVideoSection').style.display   = mode === 'seedance_video' ? 'block' : 'none';
}

function setPrScene(btn, scene) {
  document.querySelectorAll('#prSceneSection .pr-scene-btn').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  document.getElementById('prSceneSection').dataset.scene = scene;
}

function setTextAlign(align, btn) {
  TEXT_ALIGN = align;
  ['alignLeft','alignCenter','alignRight'].forEach(id => document.getElementById(id)?.classList.remove('on'));
  btn.classList.add('on'); renderAdCanvas();
}

function setPrStatus(msg, color) {
  const el = document.getElementById('prStatus');
  if (el) { el.textContent = msg; el.style.color = color || 'var(--t3)'; }
}

// ══ 進度條 ══
function startProgress(totalMs) {
  const prBar  = document.getElementById('prProgBar');
  const prFill = document.getElementById('prProgFill');
  const prPct  = document.getElementById('prPct');
  if (prBar) prBar.style.display = 'block';
  let pctVal = 0;
  const msgs = ['📤 上傳中...','✂️ AI 去背...','🎨 生成場景...','🖌️ 光影融合...','⚡ 最終輸出...'];
  const interval = setInterval(() => {
    if (pctVal >= 90) return;
    pctVal = Math.min(90, pctVal + (pctVal < 30 ? 2 : pctVal < 60 ? 1 : 0.4));
    if (prFill) prFill.style.width = pctVal + '%';
    if (prPct) prPct.textContent = Math.round(pctVal) + '%';
    setPrStatus(msgs[Math.min(Math.floor(pctVal/20), msgs.length-1)], 'var(--t3)');
  }, totalMs / 100);
  return interval;
}

function finishProgress(interval) {
  clearInterval(interval);
  const prBar  = document.getElementById('prProgBar');
  const prFill = document.getElementById('prProgFill');
  const prPct  = document.getElementById('prPct');
  const btn    = document.getElementById('prApplyBtn');
  if (prFill) prFill.style.width = '100%';
  if (prPct) prPct.textContent = '100%';
  setTimeout(() => { if(prBar) prBar.style.display='none'; if(prPct) prPct.textContent=''; }, 2000);
  if (btn) { btn.disabled = false; btn.textContent = '✨ 套用 AI 效果'; }
}

function failProgress(interval, errMsg) {
  clearInterval(interval);
  const prBar = document.getElementById('prProgBar');
  const prPct = document.getElementById('prPct');
  const btn   = document.getElementById('prApplyBtn');
  if (prBar) prBar.style.display = 'none';
  if (prPct) prPct.textContent = '';
  setPrStatus('❌ ' + errMsg, 'var(--red)');
  if (btn) { btn.disabled = false; btn.textContent = '✨ 套用 AI 效果'; }
}

// ══ Worker 呼叫 ══
async function callWorker(params) {
  const resp = await fetch(CF_WORKER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...params, password: GAS_PASSWORD })
  });
  return resp.json();
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── 取得圖片 URL（優先 Google CDN）──
function getImageUrl(photo) {
  return photo?.thumbnailLink
    ? photo.thumbnailLink.replace(/=s\d+$/, '=s1200')
    : null;
}

// ── 上傳圖片到 fal storage ──
async function uploadToFal(base64) {
  const match = base64.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!match) throw new Error('base64 格式錯誤');
  const mimeType = match[1];
  const urlData = await callWorker({ action: 'fal_get_upload_url', mimeType });
  if (!urlData.ok) throw new Error('取得上傳URL失敗: ' + (urlData.error || ''));
  const binaryStr = atob(match[2]);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
  const putResp = await fetch(urlData.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': mimeType },
    body: bytes
  });
  if (!putResp.ok) throw new Error('圖片上傳失敗: ' + putResp.status);
  return urlData.fileUrl;
}

// ══ Poll Loop
// ✅ 超時不 throw，改成 return { status:'TIMEOUT' }
// ✅ 讓影片任務可以超時後自動再查一次
// ══
async function pollUntilDone(requestId, endpoint, maxMs = 300000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    await sleep(5000);
    try {
      const pollData = await callWorker({ action:'fal_poll', requestId, endpoint });
      if (pollData.status === 'COMPLETED') return pollData;
      if (pollData.status === 'FAILED') return { status:'FAILED', error: pollData.error || '任務失敗' };
      // 更新進度
      const elapsed = Date.now() - start;
      const pct = Math.min(88, Math.round(15 + elapsed / maxMs * 73));
      const prFill = document.getElementById('prProgFill');
      const prPct  = document.getElementById('prPct');
      if (prFill) prFill.style.width = pct + '%';
      if (prPct) prPct.textContent = pct + '%';
    } catch(e) {
      // 單次 poll 失敗不中斷，繼續等
      console.warn('poll 單次失敗，繼續:', e.message);
    }
  }
  // 超時：return 而不是 throw，讓外層自行處理
  return { status:'TIMEOUT' };
}

// ══ 更新影片時長選項 ══
function updateVideoDurationOptions() {
  const model = document.getElementById('videoModel')?.value;
  const sel = document.getElementById('videoDuration');
  if (!sel) return;
  if (model === 'kling') {
    sel.innerHTML = `
      <option value="5" selected>5 秒（$0.56）</option>
      <option value="10">10 秒（$1.12）</option>`;
  } else {
    sel.innerHTML = `
      <option value="4">4 秒（$0.96）</option>
      <option value="5" selected>5 秒（$1.20）</option>
      <option value="8">8 秒（$1.92）</option>
      <option value="10">10 秒（$2.40）</option>`;
  }
}

// ══ 套用 AI 效果（統一入口）══
async function applyPhotoroomBg() {
  if (PR_MODE === 'seedance_video') { await applySeedanceVideo(); return; }

  const photo = window.S.selPhoto !== null ? window.S.photos[window.S.selPhoto] : null;
  if (!photo) { setPrStatus('⚠️ 請先選擇照片！', 'var(--red)'); return; }
  const imgSrc = photo.src || photo.thumb;
  if (!imgSrc) { setPrStatus('⚠️ 照片尚未載入', 'var(--red)'); return; }

  const btn = document.getElementById('prApplyBtn');
  btn.disabled = true; btn.textContent = '⏳ AI 處理中...';

  // ── MD 試穿 ──
  if (PR_MODE === 'kling_tryon') {
    const interval = startProgress(60000);
    try {
      const blob = await urlToBlob(imgSrc);
      const base64 = await blobToBase64(blob);
      const compressed = await compressImageBase64(base64, 1500, 0.90);
      const mdImg = document.getElementById('mdPhotoImg');
      if (!mdImg || !mdImg.src || mdImg.style.display === 'none') throw new Error('請先上傳 MD 照片！');
      setPrStatus('📤 送出試穿任務...', 'var(--t3)');
      const submitData = await callWorker({
        action: 'kling_tryon_submit',
        humanImageBase64: mdImg.src,
        garmentImageBase64: compressed
      });
      if (!submitData.ok) throw new Error(submitData.error || '提交失敗');
      setPrStatus('⏳ Kling 試穿中（約30-90秒）...', 'var(--t3)');
      const result = await pollUntilDone(submitData.requestId, submitData.endpoint, 120000);
      if (result.status === 'FAILED') throw new Error(result.error || '試穿失敗');
      if (result.status === 'TIMEOUT' || !result.imageBase64) throw new Error('試穿超時，請再試一次');
      PR_BG_IMG = result.imageBase64;
      await renderAdCanvasWithPR();
      finishProgress(interval);
      setPrStatus('✅ MD 試穿完成！', 'var(--mint)');
    } catch(e) { failProgress(interval, e.message); }
    return;
  }

  // ── AI 電商場景：去背 → Bria Product Shot 全自動串接 ──
  if (PR_MODE === 'product_shot') {
    const interval = startProgress(35000);
    try {
      const blob = await urlToBlob(imgSrc);
      const base64 = await blobToBase64(blob);
      const compressed = await compressImageBase64(base64, 1500, 0.90);
      const imageUrl = getImageUrl(photo) || await uploadToFal(compressed);

      // Step 1：Bria 去背
      setPrStatus('✂️ Step 1/2：AI 去背中...', 'var(--t3)');
      const removeBgData = await callWorker({
        action: 'fal_submit',
        endpoint: 'fal-ai/bria/background/remove',
        payload: { image_url: imageUrl }
      });
      if (!removeBgData.ok) throw new Error('去背失敗: ' + (removeBgData.error || ''));

      // 去背結果上傳到 fal storage
      setPrStatus('📤 上傳去背圖...', 'var(--t3)');
      const cutoutUrl = await uploadToFal(removeBgData.imageBase64);

      // Step 2：Bria Product Shot
      const sceneKey = document.getElementById('prSceneSection')?.dataset?.scene || 'studio';
      const customPrompt = document.getElementById('prCustomPrompt')?.value?.trim();
      const sceneDescription = customPrompt || PRODUCT_SCENES[sceneKey] || PRODUCT_SCENES.studio;

      setPrStatus('🎨 Step 2/2：生成電商場景中...', 'var(--t3)');
      const shotData = await callWorker({
        action: 'fal_submit',
        endpoint: 'fal-ai/bria/product-shot',
        payload: {
          image_url: cutoutUrl,
          scene_description: sceneDescription,
          optimize_description: true,
          num_results: 1,
          fast: true,
          placement_type: 'original',
          shot_size: [1080, 1080]
        }
      });
      if (!shotData.ok) throw new Error('場景生成失敗: ' + (shotData.error || ''));

      PR_BG_IMG = shotData.imageBase64;
      await renderAdCanvasWithPR();
      finishProgress(interval);
      setPrStatus('✅ AI 電商場景完成！', 'var(--mint)');
    } catch(e) { failProgress(interval, e.message); }
    return;
  }
}

// ══ 影片生成（Seedance 2.0 / Kling v3）
// ✅ 關鍵修正：poll 超時後自動再打一次查詢，不直接報錯
// ✅ 拿到 videoUrl 才顯示播放器＋下載按鈕
// ══
async function applySeedanceVideo() {
  const photo = window.S.selPhoto !== null ? window.S.photos[window.S.selPhoto] : null;
  if (!photo) { setPrStatus('⚠️ 請先選擇照片！', 'var(--red)'); return; }
  const imgSrc = photo.src || photo.thumb;
  if (!imgSrc) { setPrStatus('⚠️ 照片尚未載入', 'var(--red)'); return; }

  const btn = document.getElementById('prApplyBtn');
  btn.disabled = true; btn.textContent = '⏳ 影片生成中...';
  const interval = startProgress(120000);

  const videoPrompt   = document.getElementById('videoPrompt')?.value?.trim() || '';
  const videoDuration = parseInt(document.getElementById('videoDuration')?.value || 5);
  const videoRatio    = document.getElementById('videoRatio')?.value || '9:16';
  const videoAudio    = document.getElementById('videoAudio')?.checked !== false;
  const brand         = window.BRANDS.find(b => b.id === window.S.brandId);
  const defaultPrompt = `cinematic smooth camera movement, professional advertising, high quality commercial video, ${brand?.adStyle||'elegant lifestyle'}, soft natural lighting`;

  try {
    const blob = await urlToBlob(imgSrc);
    const base64 = await blobToBase64(blob);
    const compressed = await compressImageBase64(base64, 1200, 0.88);
    const imageUrlVideo = getImageUrl(photo) || await uploadToFal(compressed);

    const videoModel    = document.getElementById('videoModel')?.value || 'seedance';
    const isKling       = videoModel === 'kling';
    const videoEndpoint = isKling
      ? 'fal-ai/kling-video/v3/pro/image-to-video'
      : 'bytedance/seedance-2.0/image-to-video';

    setPrStatus(`📤 送出 ${isKling ? 'Kling v3' : 'Seedance 2.0'} 任務...`, 'var(--t3)');
    const submitData = await callWorker({
      action: 'fal_video_submit',
      endpoint: videoEndpoint,
      payload: {
        image_url: imageUrlVideo,
        prompt: videoPrompt || defaultPrompt,
        duration: String(videoDuration),
        aspect_ratio: videoRatio,
        generate_audio: videoAudio,
        resolution: '720p'
      }
    });
    if (!submitData.ok) throw new Error(submitData.error || '提交失敗');

    const requestId = submitData.requestId;

    // Kling 10秒影片約需 550 秒，設 15 分鐘上限
    const maxWait = isKling && videoDuration >= 10 ? 900000 : 600000;
    setPrStatus(`🎬 ${isKling ? 'Kling v3' : 'Seedance 2.0'} 生成中...`, 'var(--t3)');
    let result = await pollUntilDone(requestId, videoEndpoint, maxWait);

    // ✅ 超時後自動再查一次（影片可能已生成完，只是前端 timer 被節流）
    if (result.status === 'TIMEOUT') {
      setPrStatus('🔄 超時，最後查詢一次...', 'var(--t3)');
      // 連續查 3 次，每次間隔 5 秒
      for (let i = 0; i < 3; i++) {
        await sleep(5000);
        result = await callWorker({ action:'fal_poll', requestId, endpoint: videoEndpoint });
        if (result.status === 'COMPLETED' && result.videoUrl) break;
      }
    }

    if (result.status === 'FAILED') throw new Error(result.error || '影片生成失敗');

    if (result.videoUrl) {
      finishProgress(interval);
      showVideoResult(result.videoUrl);
      setPrStatus('✅ 影片生成完成！', 'var(--mint)');
    } else {
      // 還是沒有：顯示友善提示，不是報錯
      finishProgress(interval);
      setPrStatus('⏳ 影片仍在生成，請稍後重新開啟廣告圖功能再試', 'var(--gold)');
      if (btn) btn.textContent = '✨ 套用 AI 效果';
    }

  } catch(e) { failProgress(interval, e.message); }
}

// ══ 顯示影片結果（播放器 + 下載按鈕）══
function showVideoResult(videoUrl) {
  // 隱藏 canvas，顯示影片
  const canvas = document.getElementById('adCanvas');
  if (canvas) canvas.style.display = 'none';

  let videoEl = document.getElementById('adVideoPreview');
  if (!videoEl) {
    videoEl = document.createElement('video');
    videoEl.id = 'adVideoPreview';
    videoEl.controls = true; videoEl.loop = true; videoEl.autoplay = true;
    videoEl.style.cssText = 'border-radius:10px;width:100%;max-width:560px;height:auto;box-shadow:0 8px 40px rgba(0,0,0,0.6);display:block;';
    canvas?.parentNode?.insertBefore(videoEl, canvas);
  }
  videoEl.src = videoUrl; videoEl.style.display = 'block';

  // ✅ 更新下載按鈕變成「下載影片」
  const dlBtn = document.getElementById('adDownloadBtn');
  if (dlBtn) {
    dlBtn.textContent = '⬇️ 下載影片';
    dlBtn.onclick = () => {
      const a = document.createElement('a');
      a.href = videoUrl;
      a.download = `video_${Date.now()}.mp4`;
      a.click();
    };
  }
}

// ══ Canvas 渲染 ══
async function renderAdCanvas() {
  const videoEl = document.getElementById('adVideoPreview');
  if (videoEl) videoEl.style.display = 'none';
  const canvas = document.getElementById('adCanvas');
  if (canvas) canvas.style.display = 'block';
  if (PR_BG_IMG) { await renderAdCanvasWithPR(); return; }
  if (!canvas) return;
  canvas.width = AM.w; canvas.height = AM.h;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  const title = document.getElementById('amTitle')?.value || '';
  const photo = window.S.selPhoto !== null ? window.S.photos[window.S.selPhoto] : null;
  if (photo && (photo.src || photo.thumb)) {
    await new Promise(resolve => {
      const img = new Image(); img.crossOrigin = 'anonymous';
      img.onload = () => {
        ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, AM.w, AM.h);
        const scale = Math.min(AM.w/img.width, AM.h/img.height);
        ctx.drawImage(img,
          Math.round((AM.w-img.width*scale)/2),
          Math.round((AM.h-img.height*scale)/2),
          img.width*scale, img.height*scale);
        resolve();
      };
      img.onerror = () => { drawBgFallback(ctx); resolve(); };
      img.src = photo.src || photo.thumb;
    });
  } else drawBgFallback(ctx);
  drawOverlay(ctx, title, getAccentColor());
}

async function renderAdCanvasWithPR() {
  const canvas = document.getElementById('adCanvas');
  if (!canvas) return;
  canvas.width = AM.w; canvas.height = AM.h;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  const title = document.getElementById('amTitle')?.value || '';
  const isTryon = PR_MODE === 'kling_tryon';
  ctx.fillStyle = '#1a1a1a'; ctx.fillRect(0, 0, AM.w, AM.h);
  await new Promise(resolve => {
    const img = new Image(); img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (isTryon) {
        const scaleCover   = Math.max(AM.w/img.width, AM.h/img.height);
        const scaleContain = Math.min(AM.w/img.width, AM.h/img.height);
        if (1 - scaleContain/scaleCover <= 0.20) {
          ctx.drawImage(img,
            Math.round((AM.w-img.width*scaleCover)/2),
            Math.round((AM.h-img.height*scaleCover)/2),
            img.width*scaleCover, img.height*scaleCover);
        } else {
          ctx.filter = 'blur(18px)';
          ctx.drawImage(img,
            Math.round((AM.w-img.width*scaleCover)/2),
            Math.round((AM.h-img.height*scaleCover)/2),
            img.width*scaleCover, img.height*scaleCover);
          ctx.filter = 'none';
          ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0,0,AM.w,AM.h);
          ctx.drawImage(img,
            Math.round((AM.w-img.width*scaleContain)/2),
            Math.round((AM.h-img.height*scaleContain)/2),
            img.width*scaleContain, img.height*scaleContain);
        }
      } else {
        const scale = Math.min(AM.w/img.width, AM.h/img.height);
        ctx.drawImage(img,
          Math.round((AM.w-img.width*scale)/2),
          Math.round((AM.h-img.height*scale)/2),
          img.width*scale, img.height*scale);
      }
      resolve();
    };
    img.onerror = () => { drawBgFallback(ctx); resolve(); };
    img.src = PR_BG_IMG;
  });
  drawOverlay(ctx, title, getAccentColor());
}

function getAccentColor() {
  const brand = window.BRANDS.find(b => b.id === window.S.brandId);
  return { gold:'#E8603A', red:'#E8603A', sky:'#5BC8C8', mint:'#7ED4B0', purple:'#B89ED4', brown:'#C8A870' }[brand?.navColor] || '#E8603A';
}

function drawBgFallback(ctx) {
  const grad = ctx.createLinearGradient(0,0,AM.w,AM.h);
  grad.addColorStop(0,'#1a1020'); grad.addColorStop(1,'#0d0d1a');
  ctx.fillStyle = grad; ctx.fillRect(0,0,AM.w,AM.h);
}

function autoLines(ctx, text, maxWidth) {
  const chars=text.split(''), lines=[]; let cur='';
  for (const c of chars) {
    if (ctx.measureText(cur+c).width > maxWidth && cur) { lines.push(cur); cur=c; }
    else cur += c;
  }
  if (cur) lines.push(cur);
  return lines;
}

function drawOverlay(ctx, title, accent) {
  const W=AM.w, H=AM.h;
  const gradStartPct = (parseInt(document.getElementById('amGradStart')?.value||38))/100;
  const gradStrength = (parseInt(document.getElementById('amGradStrength')?.value||85))/100;
  const grad = ctx.createLinearGradient(0, H*gradStartPct, 0, H);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(0.35, `rgba(0,0,0,${Math.round(gradStrength*0.65*100)/100})`);
  grad.addColorStop(1, `rgba(0,0,0,${gradStrength})`);
  ctx.fillStyle = grad; ctx.fillRect(0,0,W,H);
  if (!title) return;
  const baseFontSize = parseInt(document.getElementById('amFontSize')?.value||94);
  const textYPct = parseInt(document.getElementById('amTextY')?.value||80)/100;
  const align = TEXT_ALIGN||'left';
  ctx.font = `900 ${baseFontSize}px 'Noto Sans TC',sans-serif`;
  ctx.textAlign = align;
  const tx = align==='left' ? Math.round(W*0.07) : align==='right' ? Math.round(W*0.93) : Math.round(W/2);
  const lines = autoLines(ctx, title, W*0.86);
  const lineH = baseFontSize*1.18;
  const ty = Math.round(H*textYPct) - (lines.length-1)*lineH;
  lines.forEach((line, i) => {
    ctx.shadowColor='rgba(0,0,0,0.85)'; ctx.shadowBlur=20; ctx.shadowOffsetY=4;
    ctx.fillStyle='#FFFFFF'; ctx.fillText(line, tx, ty+i*lineH);
  });
  ctx.shadowColor='transparent'; ctx.shadowBlur=0;
}

// ══ 下載廣告圖 ══
function downloadAd() {
  const canvas = document.getElementById('adCanvas');
  const brand = window.BRANDS.find(b => b.id === window.S.brandId);
  const filename = `${brand?.name||'ad'}_${window.S.prod?.name||'img'}.jpg`.replace(/[^\w\u4e00-\u9fff\-_.]/g,'_');
  const link = document.createElement('a');
  link.download = filename;
  link.href = canvas.toDataURL('image/jpeg', 0.92);
  link.click();
  if (window._driveToken) uploadAdToDrive(canvas, filename);
}

// ══ 工具函式 ══
async function compressImageBase64(base64, maxSize, quality) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      let w=img.width, h=img.height;
      if (w>maxSize||h>maxSize) {
        if (w>h) { h=Math.round(h*maxSize/w); w=maxSize; }
        else { w=Math.round(w*maxSize/h); h=maxSize; }
      }
      const canvas = document.createElement('canvas');
      canvas.width=w; canvas.height=h;
      canvas.getContext('2d').drawImage(img,0,0,w,h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.src = base64;
  });
}

async function urlToBlob(src) {
  if (src.startsWith('data:')) { const res = await fetch(src); return res.blob(); }
  const res = await fetch(src);
  if (!res.ok) throw new Error('圖片載入失敗');
  return res.blob();
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
