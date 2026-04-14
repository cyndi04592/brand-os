// ══════════════════════════════════════════
//  admaker.js — AD Maker 素材製作系統 v3
//  圖片：FLUX.1 Kontext [pro]（去背+換背景+光影一體）
//  試穿：fal.ai Kling kolors
//  影片：Seedance 2.0
// ══════════════════════════════════════════

let AM = { w:1080, h:1080, scriptIdx:null };
let PR_BG_IMG  = null;  // AI 處理結果（base64）
let PR_MODE    = 'ai_bg';
let PR_SCENE   = 'studio';
let TEXT_ALIGN = 'left';

// Kontext prompt 場景庫
const KONTEXT_PROMPTS = {
  studio:    'Replace the background with a clean professional studio, pure white or light grey seamless backdrop, soft diffused lighting, subtle product shadow, keep subject position and proportions exactly',
  lifestyle: 'Replace the background with a warm modern home interior, natural daylight from window, Scandinavian minimal aesthetics, wooden floor or marble surface, match subject lighting perfectly',
  outdoor:   'Replace the background with a beautiful outdoor nature scene, soft golden hour sunlight, blurred bokeh greenery or beach, subject in foreground with perfect lighting integration',
  camping:   'Replace the background with a cozy camping scene, campfire warm glow, night sky stars, rustic outdoor atmosphere, wooden table, keep subject perfectly lit and integrated',
  food:      'Replace the background with a professional food photography setting, marble or wooden surface, soft natural side lighting, clean minimal restaurant aesthetic, subject perfectly preserved',
  fashion:   'Replace the background with a high-fashion editorial backdrop, minimal light gradient, premium campaign aesthetic, soft directional lighting, maintain model/clothing perfectly',
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

function closeAdMaker() {
  document.getElementById('adMakerModal').style.display = 'none';
}

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
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      const MAX = 1500;
      let w = img.width, h = img.height;
      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round(h*MAX/w); w = MAX; }
        else        { w = Math.round(w*MAX/h); h = MAX; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      const mdImg = document.getElementById('mdPhotoImg');
      const placeholder = document.getElementById('mdPhotoPlaceholder');
      if (mdImg)       { mdImg.src = canvas.toDataURL('image/jpeg',0.85); mdImg.style.display = 'block'; }
      if (placeholder) placeholder.style.display = 'none';
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// ══ Mode 按鈕切換 ══
function setPrMode(btn, mode) {
  document.querySelectorAll('.pr-mode-btn').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  PR_MODE = mode;
  document.getElementById('prSceneSection').style.display    = ['ai_bg','white_bg','transparent_bg','ghost_mannequin','clothing','ad_visual'].includes(mode) ? 'block' : 'none';
  document.getElementById('prVirtualSection').style.display  = mode === 'kling_tryon' ? 'block' : 'none';
  document.getElementById('prVideoSection').style.display    = mode === 'seedance_video' ? 'block' : 'none';
  const sceneGrid = document.getElementById('prSceneGrid');
  if (sceneGrid) sceneGrid.style.display = ['ai_bg','clothing','ad_visual'].includes(mode) ? 'block' : 'none';
  const customPromptRow = document.getElementById('prCustomPromptRow');
  if (customPromptRow) customPromptRow.style.display = ['ai_bg','clothing','ad_visual'].includes(mode) ? 'block' : 'none';
  const videoOptions = document.getElementById('prVideoOptions');
  if (videoOptions) videoOptions.style.display = mode === 'seedance_video' ? 'block' : 'none';
}

function setPrScene(btn, scene) {
  document.querySelectorAll('#prSceneSection .pr-scene-btn').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  PR_SCENE = scene;
}

function setTextAlign(align, btn) {
  TEXT_ALIGN = align;
  ['alignLeft','alignCenter','alignRight'].forEach(id => document.getElementById(id)?.classList.remove('on'));
  btn.classList.add('on');
  renderAdCanvas();
}

function setPrStatus(msg, color) {
  const el = document.getElementById('prStatus');
  if (el) { el.textContent = msg; el.style.color = color || 'var(--t3)'; }
}

// ══ 進度條輔助 ══
function startProgress(estimatedMs) {
  const prBar = document.getElementById('prProgBar');
  const prFill = document.getElementById('prProgFill');
  const prPct = document.getElementById('prPct');
  if (prBar) prBar.style.display = 'block';
  let pctVal = 0;
  const msgs = ['📤 上傳圖片...','✂️ 分析主體...','🎨 生成背景...','🖌️ 光影融合...','⚡ 最終輸出...'];
  const interval = setInterval(() => {
    if (pctVal >= 90) return;
    pctVal = Math.min(90, pctVal + (pctVal < 30 ? 2.5 : pctVal < 60 ? 1.2 : 0.5));
    if (prFill) prFill.style.width = pctVal + '%';
    if (prPct) prPct.textContent = Math.round(pctVal) + '%';
    setPrStatus(msgs[Math.min(Math.floor(pctVal/20), msgs.length-1)], 'var(--t3)');
  }, estimatedMs / 100);
  return interval;
}

function finishProgress(interval) {
  clearInterval(interval);
  const prBar = document.getElementById('prProgBar');
  const prFill = document.getElementById('prProgFill');
  const prPct = document.getElementById('prPct');
  const btn = document.getElementById('prApplyBtn');
  if (prFill) prFill.style.width = '100%';
  if (prPct) prPct.textContent = '100%';
  setTimeout(() => { if (prBar) prBar.style.display = 'none'; if (prPct) prPct.textContent = ''; }, 2000);
  if (btn) { btn.disabled = false; btn.textContent = '✨ 套用 AI 效果'; }
}

function failProgress(interval, errMsg) {
  clearInterval(interval);
  const prBar = document.getElementById('prProgBar');
  const prPct = document.getElementById('prPct');
  const btn = document.getElementById('prApplyBtn');
  if (prBar) prBar.style.display = 'none';
  if (prPct) prPct.textContent = '';
  setPrStatus('❌ ' + errMsg, 'var(--red)');
  if (btn) { btn.disabled = false; btn.textContent = '✨ 套用 AI 效果'; }
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

  // 試穿：30秒，其他：15秒
  const estimatedMs = PR_MODE === 'kling_tryon' ? 30000 : 15000;
  const interval = startProgress(estimatedMs);

  try {
    const blob = await urlToBlob(imgSrc);
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    const compressed = await compressImageBase64(base64, 1500, 0.90);

    // ── Kling 試穿 ──
    if (PR_MODE === 'kling_tryon') {
      const mdImg = document.getElementById('mdPhotoImg');
      if (!mdImg || !mdImg.src || mdImg.style.display === 'none') throw new Error('請先上傳 MD 照片！');
      const compressedGarment = await compressImageBase64(base64, 1500, 0.90);
      setPrStatus('📤 送出任務中...', 'var(--t3)');
      const submitData = await callWorker({ action:'kling_tryon_submit', humanImageBase64:mdImg.src, garmentImageBase64:compressedGarment });
      if (!submitData.ok) throw new Error(submitData.error || '任務提交失敗');
      const { requestId, statusUrl, responseUrl } = submitData;
      for (let i = 0; i < 60; i++) {
        await sleep(5000);
        const pollData = await callWorker({ action:'kling_tryon_poll', requestId, statusUrl, responseUrl });
        if (pollData.status === 'COMPLETED' && pollData.imageBase64) {
          PR_BG_IMG = pollData.imageBase64;
          await renderAdCanvasWithPR();
          finishProgress(interval);
          setPrStatus('✅ MD試穿完成！', 'var(--mint)');
          return;
        }
        if (pollData.status === 'FAILED') throw new Error(pollData.error || 'Try-On 失敗');
      }
      throw new Error('Try-On 超時，請稍後再試');
    }

    // ── FLUX.1 Kontext：AI 換背景 / 廣告主視覺 / 服裝換背景 ──
    if (['ai_bg', 'clothing', 'ad_visual'].includes(PR_MODE)) {
      const customInput = document.getElementById('prCustomPrompt')?.value?.trim();
      // 傳 scene 到 worker 讓它選對應 prompt
      const data = await callWorker({
        action: 'fal_image_process',
        imageBase64: compressed,
        mode: PR_MODE,
        bgPrompt: customInput || KONTEXT_PROMPTS[PR_SCENE] || '',
        width: AM.w, height: AM.h
      });
      if (!data.ok) throw new Error(data.error || 'AI 處理失敗');
      PR_BG_IMG = data.imageBase64;
      await renderAdCanvasWithPR();
      finishProgress(interval);
      setPrStatus('✅ AI 換背景完成！', 'var(--mint)');
      return;
    }

    // ── 純去背（白底 / 透明 / 鬼手）──
    if (['white_bg','transparent_bg','ghost_mannequin'].includes(PR_MODE)) {
      const data = await callWorker({ action:'fal_image_process', imageBase64:compressed, mode:PR_MODE, width:AM.w, height:AM.h });
      if (!data.ok) throw new Error(data.error || '去背失敗');
      PR_BG_IMG = data.imageBase64;
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

// ══ Worker 呼叫輔助 ══
async function callWorker(params) {
  const resp = await fetch(CF_WORKER_URL, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...params, password: GAS_PASSWORD })
  });
  return resp.json();
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ══ Seedance 2.0 影片生成（等 5 分鐘）══
async function applySeedanceVideo() {
  const photo = window.S.selPhoto !== null ? window.S.photos[window.S.selPhoto] : null;
  if (!photo) { setPrStatus('⚠️ 請先選擇照片！', 'var(--red)'); return; }
  const imgSrc = photo.src || photo.thumb;
  if (!imgSrc) { setPrStatus('⚠️ 照片尚未載入', 'var(--red)'); return; }

  const btn = document.getElementById('prApplyBtn');
  btn.disabled = true; btn.textContent = '⏳ 影片生成中...';
  const interval = startProgress(90000);

  const videoPrompt   = document.getElementById('videoPrompt')?.value?.trim() || '';
  const videoDuration = parseInt(document.getElementById('videoDuration')?.value || 5);
  const videoRatio    = document.getElementById('videoRatio')?.value || '9:16';
  const videoAudio    = document.getElementById('videoAudio')?.checked !== false;
  const brand = window.BRANDS.find(b => b.id === window.S.brandId);
  const defaultPrompt = `cinematic smooth camera movement, professional advertising, high quality commercial video, ${brand?.adStyle||'elegant lifestyle'}, soft natural lighting`;

  try {
    const blob = await urlToBlob(imgSrc);
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob);
    });
    const compressed = await compressImageBase64(base64, 1200, 0.88);

    // Submit
    const submitData = await callWorker({ action:'fal_video_submit', imageBase64:compressed, prompt:videoPrompt||defaultPrompt, duration:videoDuration, aspectRatio:videoRatio, generateAudio:videoAudio });
    if (!submitData.ok) throw new Error(submitData.error || '影片任務提交失敗');
    const { requestId, statusUrl, responseUrl } = submitData;

    // Poll（最多 5 分鐘 = 60次×5秒）
    setPrStatus('🎬 Seedance 2.0 生成中，約 1-3 分鐘...', 'var(--t3)');
    for (let i = 0; i < 60; i++) {
      await sleep(5000);
      const pollData = await callWorker({ action:'fal_video_poll', requestId, statusUrl, responseUrl });
      if (pollData.status === 'COMPLETED' && pollData.videoUrl) {
        finishProgress(interval);
        showVideoResult(pollData.videoUrl);
        setPrStatus('✅ 影片生成完成！', 'var(--mint)');
        return;
      }
      if (pollData.status === 'FAILED') throw new Error(pollData.error || '影片生成失敗');
      const pct = Math.min(88, 15 + i * 1.5);
      const prFill = document.getElementById('prProgFill');
      const prPct = document.getElementById('prPct');
      if (prFill) prFill.style.width = pct + '%';
      if (prPct) prPct.textContent = Math.round(pct) + '%';
    }
    throw new Error('影片生成超時（5分鐘），請稍後再試');

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
    videoEl.id = 'adVideoPreview';
    videoEl.controls = true; videoEl.loop = true; videoEl.autoplay = true;
    videoEl.style.cssText = 'border-radius:10px;width:100%;max-width:560px;height:auto;box-shadow:0 8px 40px rgba(0,0,0,0.6);display:block;';
    canvas?.parentNode?.insertBefore(videoEl, canvas);
  }
  videoEl.src = videoUrl; videoEl.style.display = 'block';
  const dlBtn = document.getElementById('adDownloadBtn');
  if (dlBtn) {
    dlBtn.textContent = '⬇️ 下載影片';
    dlBtn.onclick = () => { const a = document.createElement('a'); a.href = videoUrl; a.download = `seedance_${Date.now()}.mp4`; a.click(); };
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
  const accentColor = getAccentColor();
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
  drawOverlay(ctx, title, accentColor);
}

async function renderAdCanvasWithPR() {
  const canvas = document.getElementById('adCanvas');
  if (!canvas) return;
  canvas.width = AM.w; canvas.height = AM.h;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  const title = document.getElementById('amTitle')?.value || '';
  const accentColor = getAccentColor();

  // Kontext 回傳已經是完整融合好的圖，直接填滿 canvas
  // 試穿 / 純去背：maintain aspect ratio
  const needContain = ['ghost_mannequin','white_bg','transparent_bg'].includes(PR_MODE);
  const needCover   = PR_MODE === 'kling_tryon';

  ctx.fillStyle = needContain ? '#FFFFFF' : '#1a1a1a';
  ctx.fillRect(0, 0, AM.w, AM.h);

  await new Promise(resolve => {
    const img = new Image(); img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (needCover) {
        // 試穿直式圖：模糊背景填滿 + contain 主圖
        const scaleCover   = Math.max(AM.w/img.width, AM.h/img.height);
        const scaleContain = Math.min(AM.w/img.width, AM.h/img.height);
        if (1 - scaleContain/scaleCover <= 0.20) {
          ctx.drawImage(img, Math.round((AM.w-img.width*scaleCover)/2), Math.round((AM.h-img.height*scaleCover)/2), img.width*scaleCover, img.height*scaleCover);
        } else {
          ctx.filter = 'blur(18px)';
          ctx.drawImage(img, Math.round((AM.w-img.width*scaleCover)/2), Math.round((AM.h-img.height*scaleCover)/2), img.width*scaleCover, img.height*scaleCover);
          ctx.filter = 'none';
          ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, 0, AM.w, AM.h);
          ctx.drawImage(img, Math.round((AM.w-img.width*scaleContain)/2), Math.round((AM.h-img.height*scaleContain)/2), img.width*scaleContain, img.height*scaleContain);
        }
      } else if (needContain) {
        ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, AM.w, AM.h);
        const scale = Math.min(AM.w/img.width, AM.h/img.height);
        ctx.drawImage(img, Math.round((AM.w-img.width*scale)/2), Math.round((AM.h-img.height*scale)/2), img.width*scale, img.height*scale);
      } else {
        // Kontext / bria 已輸出正確融合圖，直接填滿
        ctx.drawImage(img, 0, 0, AM.w, AM.h);
      }
      resolve();
    };
    img.onerror = () => { drawBgFallback(ctx); resolve(); };
    img.src = PR_BG_IMG;
  });
  drawOverlay(ctx, title, accentColor);
}

function getAccentColor() {
  const brand = window.BRANDS.find(b => b.id === window.S.brandId);
  const colorMap = { gold:'#E8603A', red:'#E8603A', sky:'#5BC8C8', mint:'#7ED4B0', purple:'#B89ED4', brown:'#C8A870' };
  return colorMap[brand?.navColor] || '#E8603A';
}

function drawBgFallback(ctx) {
  const grad = ctx.createLinearGradient(0, 0, AM.w, AM.h);
  grad.addColorStop(0, '#1a1020'); grad.addColorStop(1, '#0d0d1a');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, AM.w, AM.h);
}

function autoLines(ctx, text, maxWidth) {
  const chars = text.split(''); const lines = []; let cur = '';
  for (const c of chars) {
    if (ctx.measureText(cur+c).width > maxWidth && cur) { lines.push(cur); cur = c; }
    else cur += c;
  }
  if (cur) lines.push(cur);
  return lines;
}

function drawOverlay(ctx, title, accent) {
  const W = AM.w, H = AM.h;
  const gradStartPct = (parseInt(document.getElementById('amGradStart')?.value||38))/100;
  const gradStrength = (parseInt(document.getElementById('amGradStrength')?.value||85))/100;
  const grad = ctx.createLinearGradient(0, H*gradStartPct, 0, H);
  grad.addColorStop(0,'rgba(0,0,0,0)');
  grad.addColorStop(0.35,`rgba(0,0,0,${Math.round(gradStrength*0.65*100)/100})`);
  grad.addColorStop(1,`rgba(0,0,0,${gradStrength})`);
  ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
  if (!title) return;
  const baseFontSize = parseInt(document.getElementById('amFontSize')?.value||94);
  const textYPct     = parseInt(document.getElementById('amTextY')?.value||80)/100;
  const align = TEXT_ALIGN || 'left';
  ctx.font = `900 ${baseFontSize}px 'Noto Sans TC',sans-serif`;
  ctx.textAlign = align;
  let tx = align === 'left' ? Math.round(W*0.07) : align === 'right' ? Math.round(W*0.93) : Math.round(W/2);
  const lines = autoLines(ctx, title, W*0.86);
  const lineH = baseFontSize * 1.18;
  const ty = Math.round(H*textYPct) - (lines.length-1)*lineH;
  lines.forEach((line, i) => {
    ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 4;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(line, tx, ty + i*lineH);
  });
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
}

// ══ 下載廣告圖 ══
function downloadAd() {
  const canvas = document.getElementById('adCanvas');
  const brand  = window.BRANDS.find(b => b.id === window.S.brandId);
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
      let w = img.width, h = img.height;
      if (w > maxSize || h > maxSize) {
        if (w > h) { h = Math.round(h*maxSize/w); w = maxSize; }
        else        { w = Math.round(w*maxSize/h); h = maxSize; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
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
