// ══════════════════════════════════════════
//  admaker.js — AD Maker 素材製作系統 v3.1
//  ✅ Poll loop 全在前端，Worker 只做單次 HTTP
//  ✅ Kontext：換背景（30秒~2分鐘）
//  ✅ Seedance 2.0：影片生成（1~5分鐘）
//  ✅ Kling kolors：試穿（30~90秒）
// ══════════════════════════════════════════

let AM = { w:1080, h:1080, scriptIdx:null };
let PR_BG_IMG  = null;
let PR_MODE    = 'ai_bg';
let PR_SCENE   = 'studio';
let TEXT_ALIGN = 'left';

// ── Kontext prompt 場景庫（前端帶過去）──
const KONTEXT_PROMPTS = {
  // 所有 prompt 必須保留原圖主體！KEY 對應 index.html 的 setPrScene() 值
  studio:    'Change ONLY the background to a pure white seamless studio backdrop with soft diffused lighting. Keep ALL subjects, people, products, and foreground objects EXACTLY unchanged.',
  lifestyle: 'Change ONLY the background to a warm Scandinavian living room with wooden floor and natural daylight. Keep ALL subjects, people, products, and foreground objects EXACTLY unchanged.',
  natural:   'Change ONLY the background to a fresh outdoor nature scene with green trees and golden sunlight. Keep ALL subjects, people, products, and foreground objects EXACTLY unchanged.',
  forest:    'Change ONLY the background to a lush dark forest at dusk with atmospheric fog and filtered light. Keep ALL subjects, people, products, and foreground objects EXACTLY unchanged.',
  food:      'Change ONLY the background to a marble surface with professional food photography lighting. Keep ALL subjects, people, products, and foreground objects EXACTLY unchanged.',
  kitchen:   'Change ONLY the background to a warm cozy kitchen interior with soft warm lighting. Keep ALL subjects, people, products, and foreground objects EXACTLY unchanged.',
  dark_gold: 'Change ONLY the background to a premium dark luxury backdrop with golden accent lighting. Keep ALL subjects, people, products, and foreground objects EXACTLY unchanged.',
  marble:    'Change ONLY the background to an elegant marble texture surface with subtle luxury feel. Keep ALL subjects, people, products, and foreground objects EXACTLY unchanged.',
  city:      'Change ONLY the background to a modern city street at golden hour with blurred urban buildings. Keep ALL subjects, people, products, and foreground objects EXACTLY unchanged.',
  beach:     'Change ONLY the background to a tropical beach with golden sand and blue ocean sunset. Keep ALL subjects, people, products, and foreground objects EXACTLY unchanged.',
  minimal:   'Change ONLY the background to a clean minimal light grey gradient backdrop. Keep ALL subjects, people, products, and foreground objects EXACTLY unchanged.',
  night:     'Change ONLY the background to a beautiful night cityscape with neon lights and bokeh glow. Keep ALL subjects, people, products, and foreground objects EXACTLY unchanged.',
  garden:    'Change ONLY the background to a beautiful blooming garden with colorful flowers and soft sunlight. Keep ALL subjects, people, products, and foreground objects EXACTLY unchanged.',
  camping:   'Change ONLY the background to a cozy camping scene at night with campfire, tent, and starry sky. Keep ALL subjects, people, products, and foreground objects EXACTLY unchanged.',
  office:    'Change ONLY the background to a modern minimalist office interior with clean lines. Keep ALL subjects, people, products, and foreground objects EXACTLY unchanged.',
  random:    'Change ONLY the background to a creative and unexpected scene with dramatic lighting. Keep ALL subjects, people, products, and foreground objects EXACTLY unchanged.',
  ad_visual: 'Change ONLY the background to a cinematic advertising scene with dramatic professional lighting. Keep ALL subjects, people, products, and foreground objects EXACTLY unchanged.',
  // 補充 index.html 用到的 key
  nature:    'Change ONLY the background to a fresh outdoor nature scene with green trees and golden sunlight. Keep ALL subjects, people, products, and foreground objects EXACTLY unchanged.',
  luxury:    'Change ONLY the background to a premium dark luxury backdrop with golden accent lighting. Keep ALL subjects, people, products, and foreground objects EXACTLY unchanged.',
  outdoor:   'Change ONLY the background to a modern city street at golden hour with blurred urban buildings. Keep ALL subjects, people, products, and foreground objects EXACTLY unchanged.',
};

// ══ 開啟 AD Maker ══
function openAdMaker(idx) {
  PR_BG_IMG = null; PR_MODE = 'ai_bg'; PR_SCENE = 'studio';
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
    const imgHtml = thumb ? `<img src="${thumb}" style="width:100%;height:100%;object-fit:contain;border-radius:3px;">` : '<span style="font-size:16px;">🖼️</span>';
    return `<div onclick="selectPhotoInAM(${i})" title="${f.name}"
      style="width:36px;height:36px;border-radius:5px;overflow:hidden;flex-shrink:0;cursor:pointer;
             border:2px solid ${isSelected?'#5BC8C8':'rgba(255,255,255,0.1)'};background:var(--bg4);
             display:flex;align-items:center;justify-content:center;">${imgHtml}</div>`;
  }).join('');
  if (nameEl) nameEl.textContent = window.S.selPhoto !== null ? ('✅ ' + window.S.photos[window.S.selPhoto].name) : '← 點選上方照片';
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
      if (w > MAX || h > MAX) { if (w > h) { h = Math.round(h*MAX/w); w = MAX; } else { w = Math.round(w*MAX/h); h = MAX; } }
      const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      const mdImg = document.getElementById('mdPhotoImg'), placeholder = document.getElementById('mdPhotoPlaceholder');
      if (mdImg) { mdImg.src = canvas.toDataURL('image/jpeg',0.85); mdImg.style.display = 'block'; }
      if (placeholder) placeholder.style.display = 'none';
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// ══ Mode / Scene 切換 ══
function setPrMode(btn, mode) {
  document.querySelectorAll('.pr-mode-btn').forEach(b => b.classList.remove('on'));
  btn.classList.add('on'); PR_MODE = mode;
  document.getElementById('prSceneSection').style.display    = ['ai_bg','white_bg','transparent_bg','ghost_mannequin','clothing','ad_visual'].includes(mode) ? 'block' : 'none';
  document.getElementById('prVirtualSection').style.display  = mode === 'kling_tryon' ? 'block' : 'none';
  document.getElementById('prVideoSection').style.display    = mode === 'seedance_video' ? 'block' : 'none';
  document.getElementById('prSceneGrid')?.style && (document.getElementById('prSceneGrid').style.display = ['ai_bg','clothing','ad_visual'].includes(mode) ? 'block' : 'none');
  document.getElementById('prCustomPromptRow')?.style && (document.getElementById('prCustomPromptRow').style.display = ['ai_bg','clothing','ad_visual'].includes(mode) ? 'block' : 'none');
  document.getElementById('prVideoOptions')?.style && (document.getElementById('prVideoOptions').style.display = mode === 'seedance_video' ? 'block' : 'none');
}

function setPrScene(btn, scene) {
  document.querySelectorAll('#prSceneSection .pr-scene-btn').forEach(b => b.classList.remove('on'));
  btn.classList.add('on'); PR_SCENE = scene;
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
  const prBar=document.getElementById('prProgBar'), prFill=document.getElementById('prProgFill'), prPct=document.getElementById('prPct');
  if (prBar) prBar.style.display = 'block';
  let pctVal = 0;
  const msgs = ['📤 上傳中...','✂️ 分析主體...','🎨 生成背景...','🖌️ 光影融合...','⚡ 最終輸出...'];
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
  const prBar=document.getElementById('prProgBar'), prFill=document.getElementById('prProgFill'), prPct=document.getElementById('prPct'), btn=document.getElementById('prApplyBtn');
  if (prFill) prFill.style.width = '100%';
  if (prPct) prPct.textContent = '100%';
  setTimeout(() => { if(prBar) prBar.style.display='none'; if(prPct) prPct.textContent=''; }, 2000);
  if (btn) { btn.disabled = false; btn.textContent = '✨ 套用 AI 效果'; }
}

function failProgress(interval, errMsg) {
  clearInterval(interval);
  const prBar=document.getElementById('prProgBar'), prPct=document.getElementById('prPct'), btn=document.getElementById('prApplyBtn');
  if (prBar) prBar.style.display = 'none';
  if (prPct) prPct.textContent = '';
  setPrStatus('❌ ' + errMsg, 'var(--red)');
  if (btn) { btn.disabled = false; btn.textContent = '✨ 套用 AI 效果'; }
}

// ══ Worker 呼叫 ══
async function callWorker(params) {
  const resp = await fetch(CF_WORKER_URL, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ ...params, password: GAS_PASSWORD }) });
  return resp.json();
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── 上傳圖片到 fal storage（前端直接 PUT presigned URL，不受 Worker 30秒限制）──
async function uploadToFal(base64) {
  // Step 1: Worker 取得 presigned URL（< 1秒）
  const match = base64.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!match) throw new Error('base64 格式錯誤');
  const mimeType = match[1];
  const urlData = await callWorker({ action: 'fal_get_upload_url', mimeType });
  if (!urlData.ok) throw new Error('取得上傳URL失敗: ' + (urlData.error || ''));

  // Step 2: 前端直接 PUT 到 presigned URL（不經過 Worker）
  const binaryStr = atob(match[2]);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
  const putResp = await fetch(urlData.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': mimeType },
    body: bytes
  });
  if (!putResp.ok) throw new Error('圖片上傳 PUT 失敗: ' + putResp.status);
  return urlData.fileUrl;
}

// ══ 前端 Poll Loop（不走 Worker，直接查 fal.ai）══
// fal.ai 的 status URL 是公開的，只需要 Authorization header
// 但瀏覽器不能帶自訂 header → 必須還是走 Worker 的 fal_poll
async function pollUntilDone(requestId, endpoint, maxMs = 300000) {
  const start = Date.now();
  const interval_ms = 4000;
  while (Date.now() - start < maxMs) {
    await sleep(interval_ms);
    const pollData = await callWorker({ action:'fal_poll', requestId, endpoint });
    if (!pollData.ok && pollData.status !== 'IN_QUEUE' && pollData.status !== 'IN_PROGRESS') {
      throw new Error(pollData.error || '任務失敗');
    }
    if (pollData.status === 'COMPLETED') return pollData;
    // 更新進度百分比顯示
    const elapsed = Date.now() - start;
    const pct = Math.min(88, Math.round(15 + elapsed / maxMs * 73));
    const prFill = document.getElementById('prProgFill');
    const prPct = document.getElementById('prPct');
    if (prFill) prFill.style.width = pct + '%';
    if (prPct) prPct.textContent = pct + '%';
  }
  throw new Error('任務超時，請稍後再試');
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
  const estimatedMs = PR_MODE === 'kling_tryon' ? 60000 : 25000;
  const interval = startProgress(estimatedMs);

  try {
    const blob = await urlToBlob(imgSrc);
    const base64 = await blobToBase64(blob);
    const compressed = await compressImageBase64(base64, 1500, 0.90);

    // ── Kling 試穿 ──
    if (PR_MODE === 'kling_tryon') {
      const mdImg = document.getElementById('mdPhotoImg');
      if (!mdImg || !mdImg.src || mdImg.style.display === 'none') throw new Error('請先上傳 MD 照片！');
      setPrStatus('📤 送出試穿任務...', 'var(--t3)');
      const submitData = await callWorker({ action:'kling_tryon_submit', humanImageBase64:mdImg.src, garmentImageBase64:compressed });
      if (!submitData.ok) throw new Error(submitData.error || '提交失敗');
      setPrStatus('⏳ Kling 試穿中...', 'var(--t3)');
      const result = await pollUntilDone(submitData.requestId, submitData.endpoint, 120000);
      PR_BG_IMG = result.imageBase64;
      await renderAdCanvasWithPR();
      finishProgress(interval);
      setPrStatus('✅ MD試穿完成！', 'var(--mint)');
      return;
    }

    // ── AI 換背景 / 廣告主視覺 / 服裝（Kontext）──
    if (['ai_bg','clothing','ad_visual'].includes(PR_MODE)) {
      const customInput = document.getElementById('prCustomPrompt')?.value?.trim();
      const prompt = customInput || KONTEXT_PROMPTS[PR_SCENE] || KONTEXT_PROMPTS.studio;
      // 優先用 thumbnailLink（Google CDN 公開 URL，fal.ai 可直接存取，不需上傳）
      // thumbnailLink 已是縮圖 URL，改成更高解析度
      const photo = window.S.photos[window.S.selPhoto];
      const imageUrl = photo?.thumbnailLink
        ? photo.thumbnailLink.replace(/=s\d+$/, '=s1200')
        : await uploadToFal(compressed);
      setPrStatus('🎨 Kontext 換背景中（約10-15秒）...', 'var(--t3)');
      const submitData = await callWorker({
        action: 'fal_submit',
        endpoint: 'fal-ai/flux-pro/kontext',
        payload: { image_url: imageUrl, prompt, guidance_scale: 3.5, num_inference_steps: 28 }
      });
      if (!submitData.ok) throw new Error(submitData.error || '換背景失敗');
      // 同步呼叫直接回傳結果，不需要 poll
      PR_BG_IMG = submitData.imageBase64;
      await renderAdCanvasWithPR();
      finishProgress(interval);
      setPrStatus('✅ AI 換背景完成！', 'var(--mint)');
      return;
    }

    // ── 純去背 ──
    if (['white_bg','transparent_bg','ghost_mannequin'].includes(PR_MODE)) {
      const photo2 = window.S.photos[window.S.selPhoto];
      const imageUrl2 = photo2?.thumbnailLink
        ? photo2.thumbnailLink.replace(/=s\d+$/, '=s1200')
        : await uploadToFal(compressed);
      setPrStatus('✂️ 去背中（約5-10秒）...', 'var(--t3)');
      const submitData = await callWorker({
        action: 'fal_submit',
        endpoint: 'fal-ai/bria/background/removal',
        payload: { image_url: imageUrl2 }
      });
      if (!submitData.ok) throw new Error(submitData.error || '去背失敗');
      PR_BG_IMG = submitData.imageBase64;
      await renderAdCanvasWithPR();
      finishProgress(interval);
      setPrStatus('✅ 去背完成！', 'var(--mint)');
      return;
    }

    throw new Error('未知的處理模式: ' + PR_MODE);

  } catch(e) {
    failProgress(interval, e.message);
  }
}

// ══ Seedance 2.0 影片生成 ══
async function applySeedanceVideo() {
  const photo = window.S.selPhoto !== null ? window.S.photos[window.S.selPhoto] : null;
  if (!photo) { setPrStatus('⚠️ 請先選擇照片！', 'var(--red)'); return; }
  const imgSrc = photo.src || photo.thumb;
  if (!imgSrc) { setPrStatus('⚠️ 照片尚未載入', 'var(--red)'); return; }

  const btn = document.getElementById('prApplyBtn');
  btn.disabled = true; btn.textContent = '⏳ 影片生成中...';
  const interval = startProgress(120000);

  const videoPrompt = document.getElementById('videoPrompt')?.value?.trim() || '';
  const videoDuration = parseInt(document.getElementById('videoDuration')?.value || 5);
  const videoRatio = document.getElementById('videoRatio')?.value || '9:16';
  const videoAudio = document.getElementById('videoAudio')?.checked !== false;
  const brand = window.BRANDS.find(b => b.id === window.S.brandId);
  const defaultPrompt = `cinematic smooth camera movement, professional advertising, high quality commercial video, ${brand?.adStyle||'elegant lifestyle'}, soft natural lighting`;

  try {
    const blob = await urlToBlob(imgSrc);
    const base64 = await blobToBase64(blob);
    const compressed = await compressImageBase64(base64, 1200, 0.88);

    const photoV = window.S.photos[window.S.selPhoto];
    const imageUrlVideo = photoV?.thumbnailLink
      ? photoV.thumbnailLink.replace(/=s\d+$/, '=s1200')
      : await uploadToFal(compressed);
    setPrStatus('📤 送出 Seedance 任務...', 'var(--t3)');
    const submitData = await callWorker({
      action: 'fal_submit',
      endpoint: 'bytedance/seedance-2.0/image-to-video',
      payload: { image_url: imageUrlVideo, prompt: videoPrompt || defaultPrompt, duration: String(videoDuration), aspect_ratio: videoRatio, generate_audio: videoAudio, resolution: '720p' }
    });
    if (!submitData.ok) throw new Error(submitData.error || '提交失敗');

    // 影片最多等 8 分鐘
    setPrStatus('🎬 Seedance 2.0 生成中，約 2-5 分鐘...', 'var(--t3)');
    const result = await pollUntilDone(submitData.requestId, 'bytedance/seedance-2.0/image-to-video', 480000);

    if (result.videoUrl) {
      finishProgress(interval);
      showVideoResult(result.videoUrl);
      setPrStatus('✅ 影片生成完成！', 'var(--mint)');
    } else {
      throw new Error('無影片 URL');
    }

  } catch(e) {
    failProgress(interval, e.message);
  }
}

// ══ 顯示影片結果 ══
function showVideoResult(videoUrl) {
  const canvas = document.getElementById('adCanvas');
  if (canvas) canvas.style.display = 'none';
  let videoEl = document.getElementById('adVideoPreview');
  if (!videoEl) {
    videoEl = document.createElement('video');
    videoEl.id = 'adVideoPreview'; videoEl.controls = true; videoEl.loop = true; videoEl.autoplay = true;
    videoEl.style.cssText = 'border-radius:10px;width:100%;max-width:560px;height:auto;box-shadow:0 8px 40px rgba(0,0,0,0.6);display:block;';
    canvas?.parentNode?.insertBefore(videoEl, canvas);
  }
  videoEl.src = videoUrl; videoEl.style.display = 'block';
  const dlBtn = document.getElementById('adDownloadBtn');
  if (dlBtn) {
    dlBtn.textContent = '⬇️ 下載影片';
    dlBtn.onclick = () => { const a=document.createElement('a'); a.href=videoUrl; a.download=`seedance_${Date.now()}.mp4`; a.click(); };
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
        ctx.drawImage(img, Math.round((AM.w-img.width*scale)/2), Math.round((AM.h-img.height*scale)/2), img.width*scale, img.height*scale);
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
  const needContain = ['ghost_mannequin','white_bg','transparent_bg'].includes(PR_MODE);
  const needCover   = PR_MODE === 'kling_tryon';
  ctx.fillStyle = needContain ? '#FFFFFF' : '#1a1a1a';
  ctx.fillRect(0, 0, AM.w, AM.h);
  await new Promise(resolve => {
    const img = new Image(); img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (needCover) {
        const scaleCover = Math.max(AM.w/img.width, AM.h/img.height);
        const scaleContain = Math.min(AM.w/img.width, AM.h/img.height);
        if (1 - scaleContain/scaleCover <= 0.20) {
          ctx.drawImage(img, Math.round((AM.w-img.width*scaleCover)/2), Math.round((AM.h-img.height*scaleCover)/2), img.width*scaleCover, img.height*scaleCover);
        } else {
          ctx.filter = 'blur(18px)';
          ctx.drawImage(img, Math.round((AM.w-img.width*scaleCover)/2), Math.round((AM.h-img.height*scaleCover)/2), img.width*scaleCover, img.height*scaleCover);
          ctx.filter = 'none';
          ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0,0,AM.w,AM.h);
          ctx.drawImage(img, Math.round((AM.w-img.width*scaleContain)/2), Math.round((AM.h-img.height*scaleContain)/2), img.width*scaleContain, img.height*scaleContain);
        }
      } else if (needContain) {
        ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0,0,AM.w,AM.h);
        const scale = Math.min(AM.w/img.width, AM.h/img.height);
        ctx.drawImage(img, Math.round((AM.w-img.width*scale)/2), Math.round((AM.h-img.height*scale)/2), img.width*scale, img.height*scale);
      } else {
        // Kontext 回傳圖保持原始比例（contain），避免拉長
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, AM.w, AM.h);
        const scale = Math.min(AM.w / img.width, AM.h / img.height);
        const x = Math.round((AM.w - img.width * scale) / 2);
        const y = Math.round((AM.h - img.height * scale) / 2);
        ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
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
  for (const c of chars) { if (ctx.measureText(cur+c).width>maxWidth&&cur){lines.push(cur);cur=c;}else cur+=c; }
  if (cur) lines.push(cur);
  return lines;
}

function drawOverlay(ctx, title, accent) {
  const W=AM.w, H=AM.h;
  const gradStartPct = (parseInt(document.getElementById('amGradStart')?.value||38))/100;
  const gradStrength = (parseInt(document.getElementById('amGradStrength')?.value||85))/100;
  const grad = ctx.createLinearGradient(0,H*gradStartPct,0,H);
  grad.addColorStop(0,'rgba(0,0,0,0)');
  grad.addColorStop(0.35,`rgba(0,0,0,${Math.round(gradStrength*0.65*100)/100})`);
  grad.addColorStop(1,`rgba(0,0,0,${gradStrength})`);
  ctx.fillStyle = grad; ctx.fillRect(0,0,W,H);
  if (!title) return;
  const baseFontSize = parseInt(document.getElementById('amFontSize')?.value||94);
  const textYPct = parseInt(document.getElementById('amTextY')?.value||80)/100;
  const align = TEXT_ALIGN||'left';
  ctx.font = `900 ${baseFontSize}px 'Noto Sans TC',sans-serif`;
  ctx.textAlign = align;
  const tx = align==='left'?Math.round(W*0.07):align==='right'?Math.round(W*0.93):Math.round(W/2);
  const lines = autoLines(ctx, title, W*0.86);
  const lineH = baseFontSize*1.18;
  const ty = Math.round(H*textYPct)-(lines.length-1)*lineH;
  lines.forEach((line,i) => {
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
  const link = document.createElement('a'); link.download = filename;
  link.href = canvas.toDataURL('image/jpeg', 0.92); link.click();
  if (window._driveToken) uploadAdToDrive(canvas, filename);
}

// ══ 工具函式 ══
async function compressImageBase64(base64, maxSize, quality) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      let w=img.width, h=img.height;
      if (w>maxSize||h>maxSize) { if(w>h){h=Math.round(h*maxSize/w);w=maxSize;}else{w=Math.round(w*maxSize/h);h=maxSize;} }
      const canvas = document.createElement('canvas'); canvas.width=w; canvas.height=h;
      canvas.getContext('2d').drawImage(img,0,0,w,h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.src = base64;
  });
}

async function urlToBlob(src) {
  if (src.startsWith('data:')) { const res = await fetch(src); return res.blob(); }
  const res = await fetch(src); if (!res.ok) throw new Error('圖片載入失敗'); return res.blob();
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob);
  });
}
