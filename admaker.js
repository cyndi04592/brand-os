// ══════════════════════════════════════════
//  admaker.js — AD Maker 素材製作系統 v2（全 fal.ai）
//  三層模式：電商快速圖 / 廣告主視覺 / 短影音素材
// ══════════════════════════════════════════

let AM = { w:1080, h:1080, scriptIdx:null };
let PR_BG_IMG  = null;  // 圖片結果（base64 或 URL）
let PR_BG_DATA = null;  // ad_visual 模式專用（{nobgUrl, bgUrl}）
let PR_MODE    = 'ai_bg';
let PR_SCENE   = 'studio';
let TEXT_ALIGN = 'left';

// ══ 開啟 AD Maker ══
function openAdMaker(idx) {
  PR_BG_IMG = null; PR_BG_DATA = null; PR_MODE = 'ai_bg';
  setPrStatus('', '');
  document.querySelectorAll('.pr-mode-btn').forEach(b => b.classList.remove('on'));
  document.querySelector('.pr-mode-btn')?.classList.add('on');
  document.getElementById('prSceneSection').style.display   = 'block';
  document.getElementById('prVirtualSection').style.display = 'none';
  document.getElementById('prVideoSection').style.display   = 'none';

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
  const row    = document.getElementById('amPhotoThumbRow');
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
    const border  = isSelected ? '#5BC8C8' : 'rgba(255,255,255,0.1)';
    return `<div onclick="selectPhotoInAM(${i})" title="${f.name}"
      style="width:36px;height:36px;border-radius:5px;overflow:hidden;flex-shrink:0;cursor:pointer;
             border:2px solid ${border};background:var(--bg4);display:flex;align-items:center;justify-content:center;">
      ${imgHtml}</div>`;
  }).join('');
  if (nameEl) nameEl.textContent = window.S.selPhoto !== null ? ('✅ ' + window.S.photos[window.S.selPhoto].name) : '← 點選上方照片';
}

function selectPhotoInAM(i) {
  window.S.selPhoto = i;
  PR_BG_IMG = null; PR_BG_DATA = null;
  renderAmPhotoRow();
  renderAssets();
  renderAdCanvas();
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
        if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
        else        { w = Math.round(w * MAX / h); h = MAX; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      const compressed = canvas.toDataURL('image/jpeg', 0.85);
      const mdImg = document.getElementById('mdPhotoImg');
      const placeholder = document.getElementById('mdPhotoPlaceholder');
      if (mdImg)       { mdImg.src = compressed; mdImg.style.display = 'block'; }
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

  // 顯示對應區塊
  document.getElementById('prSceneSection').style.display    = ['ai_bg','white_bg','transparent_bg','relight','shadow_only','remove_text','expand','beautify','ghost_mannequin','clothing','ad_visual'].includes(mode) ? 'block' : 'none';
  document.getElementById('prVirtualSection').style.display  = mode === 'kling_tryon' ? 'block' : 'none';
  document.getElementById('prVideoSection').style.display    = mode === 'seedance_video' ? 'block' : 'none';

  // 場景選項只在換背景相關模式顯示
  const sceneGrid = document.getElementById('prSceneGrid');
  if (sceneGrid) {
    sceneGrid.style.display = ['ai_bg','clothing','ad_visual'].includes(mode) ? 'block' : 'none';
  }

  // 自訂 prompt 只在換背景模式顯示
  const customPromptRow = document.getElementById('prCustomPromptRow');
  if (customPromptRow) {
    customPromptRow.style.display = ['ai_bg','clothing','ad_visual'].includes(mode) ? 'block' : 'none';
  }

  // 影片選項
  const videoOptions = document.getElementById('prVideoOptions');
  if (videoOptions) {
    videoOptions.style.display = mode === 'seedance_video' ? 'block' : 'none';
  }
}

function setPrScene(btn, scene) {
  document.querySelectorAll('#prSceneSection .pr-scene-btn').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  PR_SCENE = scene;
}

function setTextAlign(align, btn) {
  TEXT_ALIGN = align;
  ['alignLeft','alignCenter','alignRight'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('on');
  });
  btn.classList.add('on');
  renderAdCanvas();
}

function setPrStatus(msg, color) {
  const el = document.getElementById('prStatus');
  if (el) { el.textContent = msg; el.style.color = color || 'var(--t3)'; }
}

// ══ 套用 AI 效果（統一入口）══
async function applyPhotoroomBg() {
  const photo = window.S.selPhoto !== null ? window.S.photos[window.S.selPhoto] : null;

  // 影片模式不需要選照片（用選取的照片生成影片）
  if (PR_MODE === 'seedance_video') {
    await applySeedanceVideo();
    return;
  }

  if (!photo) { setPrStatus('⚠️ 請先選擇照片！', 'var(--red)'); return; }
  const imgSrc = photo.src || photo.thumb;
  if (!imgSrc) { setPrStatus('⚠️ 照片尚未載入', 'var(--red)'); return; }

  const btn    = document.getElementById('prApplyBtn');
  btn.disabled = true; btn.textContent = '⏳ AI 處理中...';

  const prBar  = document.getElementById('prProgBar');
  const prFill = document.getElementById('prProgFill');
  const prPct  = document.getElementById('prPct');
  if (prBar) prBar.style.display = 'block';

  // 預估時間（秒）
  const estimatedMs = PR_MODE === 'kling_tryon' ? 30000 : PR_MODE === 'ad_visual' ? 20000 : 8000;
  let prPctVal = 0;
  const prInterval = setInterval(() => {
    if (prPctVal >= 90) return;
    prPctVal = Math.min(90, prPctVal + (prPctVal < 30 ? 2.5 : prPctVal < 60 ? 1.2 : 0.5));
    if (prFill) prFill.style.width = prPctVal + '%';
    if (prPct)  prPct.textContent  = Math.round(prPctVal) + '%';
    const msgs = ['📤 上傳圖片...','✂️ AI 去背中...','🎨 生成背景中...','🖌️ 光影融合中...','⚡ 最終處理中...'];
    setPrStatus(msgs[Math.min(Math.floor(prPctVal / 20), msgs.length - 1)], 'var(--t3)');
  }, estimatedMs / 100);

  const finishProgress = () => {
    clearInterval(prInterval);
    if (prFill) prFill.style.width = '100%';
    if (prPct)  prPct.textContent  = '100%';
    setTimeout(() => { if (prBar) prBar.style.display = 'none'; if (prPct) prPct.textContent = ''; }, 2000);
    btn.disabled = false; btn.textContent = '✨ 套用 AI 效果';
  };

  try {
    const blob   = await urlToBlob(imgSrc);
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    // ── Kling 試穿（保留原有邏輯）──
    if (PR_MODE === 'kling_tryon') {
      const mdImg = document.getElementById('mdPhotoImg');
      if (!mdImg || !mdImg.src || mdImg.style.display === 'none') throw new Error('請先上傳 MD 照片！');
      const compressedGarment = await compressImageBase64(base64, 1500, 0.90);
      setPrStatus('📤 送出任務中...', 'var(--t3)');
      const submitResp = await fetch(CF_WORKER_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action:'kling_tryon_submit', password:GAS_PASSWORD, humanImageBase64:mdImg.src, garmentImageBase64:compressedGarment })
      });
      const submitData = await submitResp.json();
      if (!submitData.ok) throw new Error(submitData.error || '任務提交失敗');
      const { requestId, statusUrl, responseUrl } = submitData;
      setPrStatus('⏳ AI 試穿中，請稍候...', 'var(--t3)');
      for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, 5000));
        const pollResp = await fetch(CF_WORKER_URL, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action:'kling_tryon_poll', password:GAS_PASSWORD, requestId, statusUrl, responseUrl })
        });
        const pollData = await pollResp.json();
        if (pollData.status === 'COMPLETED' && pollData.imageBase64) {
          PR_BG_IMG = pollData.imageBase64;
          await renderAdCanvasWithPR();
          finishProgress();
          setPrStatus('✅ MD試穿完成！', 'var(--mint)');
          return;
        }
        if (pollData.status === 'FAILED') throw new Error(pollData.error || 'Try-On 失敗');
        const pct = Math.min(90, 10 + i * 1.5);
        if (prFill) prFill.style.width = pct + '%';
        if (prPct)  prPct.textContent  = Math.round(pct) + '%';
      }
      throw new Error('Try-On 超時，請稍後再試');
    }

    // ── 廣告主視覺模式（Flux Pro 生成背景）──
    if (PR_MODE === 'ad_visual') {
      const customInput = document.getElementById('prCustomPrompt')?.value?.trim();
      const prompt = customInput || getBrandScenePrompt(PR_SCENE);
      setPrStatus('🎨 Flux Pro 生成電影級背景中...', 'var(--t3)');
      const compressed = await compressImageBase64(base64, 1500, 0.90);
      const resp = await fetch(CF_WORKER_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action:'fal_image_process', password:GAS_PASSWORD, imageBase64:compressed, mode:'ad_visual', bgPrompt:prompt, width:AM.w, height:AM.h })
      });
      const data = await resp.json();
      if (!data.ok) throw new Error(data.error || 'Flux Pro 失敗');
      // ad_visual 回傳 nobgUrl + bgUrl，前端合成
      PR_BG_DATA = { nobgUrl: data.nobgUrl, bgUrl: data.bgUrl };
      PR_BG_IMG = null;
      await renderAdCanvasWithPR();
      finishProgress();
      setPrStatus('✅ 廣告主視覺生成完成！', 'var(--mint)');
      return;
    }

    // ── 其他 fal.ai 圖片處理模式 ──
    const customInput = document.getElementById('prCustomPrompt')?.value?.trim();
    let prompt = customInput;
    if (!prompt && ['ai_bg','clothing'].includes(PR_MODE)) {
      prompt = getBrandScenePrompt(PR_SCENE);
    }

    setPrStatus('🤖 fal.ai 處理中...', 'var(--t3)');
    const compressed = await compressImageBase64(base64, 1500, 0.90);
    const resp = await fetch(CF_WORKER_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action:'fal_image_process', password:GAS_PASSWORD, imageBase64:compressed, mode:PR_MODE, bgPrompt:prompt, width:AM.w, height:AM.h })
    });
    const prData = await resp.json();
    if (!prData.ok) throw new Error(prData.error || 'AI 處理失敗');

    PR_BG_IMG = prData.imageBase64;
    PR_BG_DATA = null;
    await renderAdCanvasWithPR();
    finishProgress();
    setPrStatus('✅ AI 處理成功！', 'var(--mint)');

  } catch (e) {
    clearInterval(prInterval);
    if (prBar) prBar.style.display = 'none';
    if (prPct) prPct.textContent = '';
    setPrStatus('❌ ' + e.message, 'var(--red)');
    btn.disabled = false; btn.textContent = '✨ 套用 AI 效果';
  }
}

// ══ Seedance 2.0 影片生成 ══
async function applySeedanceVideo() {
  const photo = window.S.selPhoto !== null ? window.S.photos[window.S.selPhoto] : null;
  if (!photo) { setPrStatus('⚠️ 請先選擇照片！', 'var(--red)'); return; }
  const imgSrc = photo.src || photo.thumb;
  if (!imgSrc) { setPrStatus('⚠️ 照片尚未載入', 'var(--red)'); return; }

  const btn    = document.getElementById('prApplyBtn');
  btn.disabled = true; btn.textContent = '⏳ 影片生成中...';

  const prBar  = document.getElementById('prProgBar');
  const prFill = document.getElementById('prProgFill');
  const prPct  = document.getElementById('prPct');
  if (prBar) prBar.style.display = 'block';

  const videoPrompt   = document.getElementById('videoPrompt')?.value?.trim() || '';
  const videoDuration = parseInt(document.getElementById('videoDuration')?.value || 5);
  const videoRatio    = document.getElementById('videoRatio')?.value || '9:16';
  const videoAudio    = document.getElementById('videoAudio')?.checked !== false;

  // 預設提示詞：根據品牌自動生成
  const brand = window.BRANDS.find(b => b.id === window.S.brandId);
  const defaultPrompt = `cinematic smooth camera movement, professional advertising, high quality commercial video, ${brand?.adStyle || 'elegant lifestyle'}, soft natural lighting, photorealistic`;
  const finalPrompt = videoPrompt || defaultPrompt;

  let pctVal = 0;
  const interval = setInterval(() => {
    if (pctVal >= 88) return;
    pctVal = Math.min(88, pctVal + 0.8);
    if (prFill) prFill.style.width = pctVal + '%';
    if (prPct)  prPct.textContent  = Math.round(pctVal) + '%';
    const msgs = ['📤 上傳圖片...','🎬 Seedance 2.0 生成中...','🎞️ 渲染影格...','🔊 同步音效...','⚡ 最終輸出...'];
    setPrStatus(msgs[Math.min(Math.floor(pctVal / 20), msgs.length - 1)], 'var(--t3)');
  }, 1500);

  try {
    const blob   = await urlToBlob(imgSrc);
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    const compressed = await compressImageBase64(base64, 1200, 0.88);

    // Step 1: Submit
    setPrStatus('📤 送出 Seedance 2.0 任務...', 'var(--t3)');
    const submitResp = await fetch(CF_WORKER_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'fal_video_submit', password: GAS_PASSWORD,
        imageBase64: compressed,
        prompt: finalPrompt,
        duration: videoDuration,
        aspectRatio: videoRatio,
        generateAudio: videoAudio
      })
    });
    const submitData = await submitResp.json();
    if (!submitData.ok) throw new Error(submitData.error || '影片任務提交失敗');
    const { requestId, statusUrl, responseUrl } = submitData;

    // Step 2: Poll（最多等 3 分鐘）
    setPrStatus('🎬 Seedance 2.0 生成中，約 1-2 分鐘...', 'var(--t3)');
    for (let i = 0; i < 36; i++) {
      await new Promise(r => setTimeout(r, 5000));
      const pollResp = await fetch(CF_WORKER_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action:'fal_video_poll', password:GAS_PASSWORD, requestId, statusUrl, responseUrl })
      });
      const pollData = await pollResp.json();

      if (pollData.status === 'COMPLETED' && pollData.videoUrl) {
        clearInterval(interval);
        if (prFill) prFill.style.width = '100%';
        if (prPct)  prPct.textContent  = '100%';
        setTimeout(() => { if (prBar) prBar.style.display = 'none'; if (prPct) prPct.textContent = ''; }, 2000);

        // 顯示影片預覽
        showVideoResult(pollData.videoUrl);
        setPrStatus('✅ 影片生成完成！', 'var(--mint)');
        btn.disabled = false; btn.textContent = '✨ 套用 AI 效果';
        return;
      }

      if (pollData.status === 'FAILED') throw new Error(pollData.error || '影片生成失敗');

      const pct = Math.min(88, 15 + i * 2);
      if (prFill) prFill.style.width = pct + '%';
      if (prPct)  prPct.textContent  = Math.round(pct) + '%';
    }
    throw new Error('影片生成超時，請稍後再試');

  } catch(e) {
    clearInterval(interval);
    if (prBar) prBar.style.display = 'none';
    if (prPct) prPct.textContent = '';
    setPrStatus('❌ ' + e.message, 'var(--red)');
    btn.disabled = false; btn.textContent = '✨ 套用 AI 效果';
  }
}

// ══ 顯示影片結果 ══
function showVideoResult(videoUrl) {
  // 在 AD Maker 右側顯示影片預覽（取代 canvas）
  const canvas = document.getElementById('adCanvas');
  if (canvas) canvas.style.display = 'none';

  let videoEl = document.getElementById('adVideoPreview');
  if (!videoEl) {
    videoEl = document.createElement('video');
    videoEl.id = 'adVideoPreview';
    videoEl.controls = true;
    videoEl.loop = true;
    videoEl.autoplay = true;
    videoEl.style.cssText = 'border-radius:10px;width:100%;max-width:560px;height:auto;box-shadow:0 8px 40px rgba(0,0,0,0.6);display:block;';
    canvas?.parentNode?.insertBefore(videoEl, canvas);
  }
  videoEl.src = videoUrl;
  videoEl.style.display = 'block';

  // 下載按鈕
  const dlBtn = document.getElementById('adDownloadBtn');
  if (dlBtn) {
    dlBtn.textContent = '⬇️ 下載影片';
    dlBtn.onclick = () => {
      const a = document.createElement('a');
      a.href = videoUrl;
      a.download = `seedance_${Date.now()}.mp4`;
      a.click();
    };
  }
}

// ══ Canvas 渲染 ══
async function renderAdCanvas() {
  // 如果有影片預覽，切回 canvas 模式
  const videoEl = document.getElementById('adVideoPreview');
  if (videoEl) videoEl.style.display = 'none';
  const canvas = document.getElementById('adCanvas');
  if (canvas) canvas.style.display = 'block';

  if (PR_BG_IMG || PR_BG_DATA) { await renderAdCanvasWithPR(); return; }
  if (!canvas) return;
  canvas.width = AM.w; canvas.height = AM.h;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  const title  = document.getElementById('amTitle')?.value || '';
  const brand  = window.BRANDS.find(b => b.id === window.S.brandId);
  const colorMap = { gold:'#E8603A', red:'#E8603A', sky:'#5BC8C8', mint:'#7ED4B0', purple:'#B89ED4', brown:'#C8A870' };
  const accentColor = colorMap[brand?.navColor] || '#E8603A';
  const photo  = window.S.selPhoto !== null ? window.S.photos[window.S.selPhoto] : null;

  if (photo && (photo.src || photo.thumb)) {
    await new Promise(resolve => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, AM.w, AM.h);
        const scale = Math.min(AM.w / img.width, AM.h / img.height);
        ctx.drawImage(img, Math.round((AM.w - img.width*scale)/2), Math.round((AM.h - img.height*scale)/2), img.width*scale, img.height*scale);
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
  const title  = document.getElementById('amTitle')?.value || '';
  const brand  = window.BRANDS.find(b => b.id === window.S.brandId);
  const colorMap = { gold:'#E8603A', red:'#E8603A', sky:'#5BC8C8', mint:'#7ED4B0', purple:'#B89ED4', brown:'#C8A870' };
  const accentColor = colorMap[brand?.navColor] || '#E8603A';

  const needContain = ['ghost_mannequin','white_bg','transparent_bg','clothing'].includes(PR_MODE);
  const needCover   = PR_MODE === 'kling_tryon';

  // ── 廣告主視覺模式：前端合成去背圖 + 生成背景 ──
  if (PR_BG_DATA && PR_BG_DATA.bgUrl) {
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, AM.w, AM.h);

    // 先畫背景
    await new Promise(resolve => {
      const bgImg = new Image();
      bgImg.crossOrigin = 'anonymous';
      bgImg.onload = () => {
        ctx.drawImage(bgImg, 0, 0, AM.w, AM.h);
        resolve();
      };
      bgImg.onerror = () => resolve();
      bgImg.src = PR_BG_DATA.bgUrl;
    });

    // 再疊去背產品圖
    if (PR_BG_DATA.nobgUrl) {
      await new Promise(resolve => {
        const nobgImg = new Image();
        nobgImg.crossOrigin = 'anonymous';
        nobgImg.onload = () => {
          const scale = Math.min(AM.w * 0.8 / nobgImg.width, AM.h * 0.8 / nobgImg.height);
          ctx.drawImage(nobgImg,
            Math.round((AM.w - nobgImg.width*scale)/2),
            Math.round((AM.h - nobgImg.height*scale)/2),
            nobgImg.width*scale, nobgImg.height*scale
          );
          resolve();
        };
        nobgImg.onerror = () => resolve();
        nobgImg.src = PR_BG_DATA.nobgUrl;
      });
    }
    drawOverlay(ctx, title, accentColor);
    return;
  }

  // ── 一般模式 ──
  ctx.fillStyle = needContain ? '#FFFFFF' : '#1a1a1a';
  ctx.fillRect(0, 0, AM.w, AM.h);

  await new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (needCover) {
        const scaleCover   = Math.max(AM.w / img.width, AM.h / img.height);
        const scaleContain = Math.min(AM.w / img.width, AM.h / img.height);
        const cropRatio    = 1 - (scaleContain / scaleCover);
        if (cropRatio <= 0.20) {
          ctx.drawImage(img, Math.round((AM.w - img.width*scaleCover)/2), Math.round((AM.h - img.height*scaleCover)/2), img.width*scaleCover, img.height*scaleCover);
        } else {
          ctx.filter = 'blur(18px)';
          ctx.drawImage(img, Math.round((AM.w - img.width*scaleCover)/2), Math.round((AM.h - img.height*scaleCover)/2), img.width*scaleCover, img.height*scaleCover);
          ctx.filter = 'none';
          ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, 0, AM.w, AM.h);
          ctx.drawImage(img, Math.round((AM.w - img.width*scaleContain)/2), Math.round((AM.h - img.height*scaleContain)/2), img.width*scaleContain, img.height*scaleContain);
        }
      } else if (needContain) {
        ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, AM.w, AM.h);
        const scale = Math.min(AM.w / img.width, AM.h / img.height);
        ctx.drawImage(img, Math.round((AM.w - img.width*scale)/2), Math.round((AM.h - img.height*scale)/2), img.width*scale, img.height*scale);
      } else {
        ctx.drawImage(img, 0, 0, AM.w, AM.h);
      }
      resolve();
    };
    img.onerror = () => { drawBgFallback(ctx); resolve(); };
    img.src = PR_BG_IMG;
  });
  drawOverlay(ctx, title, accentColor);
}

function drawBgFallback(ctx) {
  const grad = ctx.createLinearGradient(0, 0, AM.w, AM.h);
  grad.addColorStop(0, '#1a1020'); grad.addColorStop(1, '#0d0d1a');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, AM.w, AM.h);
}

function autoLines(ctx, text, maxWidth) {
  const chars = text.split('');
  const lines = []; let cur = '';
  for (const c of chars) {
    if (ctx.measureText(cur + c).width > maxWidth && cur) { lines.push(cur); cur = c; }
    else cur += c;
  }
  if (cur) lines.push(cur);
  return lines;
}

function drawOverlay(ctx, title, accent) {
  const W = AM.w, H = AM.h;
  const gradStartPct  = (parseInt(document.getElementById('amGradStart')?.value  || 38)) / 100;
  const gradStrength  = (parseInt(document.getElementById('amGradStrength')?.value || 85)) / 100;
  const grad = ctx.createLinearGradient(0, H * gradStartPct, 0, H);
  grad.addColorStop(0,    'rgba(0,0,0,0)');
  grad.addColorStop(0.35, `rgba(0,0,0,${Math.round(gradStrength*0.65*100)/100})`);
  grad.addColorStop(1,    `rgba(0,0,0,${gradStrength})`);
  ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
  if (!title) return;
  const baseFontSize = parseInt(document.getElementById('amFontSize')?.value || 94);
  const textYPct     = parseInt(document.getElementById('amTextY')?.value    || 80) / 100;
  const align = TEXT_ALIGN || 'left';
  ctx.font = `900 ${baseFontSize}px 'Noto Sans TC',sans-serif`;
  ctx.textAlign = align;
  let tx;
  if (align === 'left')  tx = Math.round(W * 0.07);
  else if (align === 'right') tx = Math.round(W * 0.93);
  else tx = Math.round(W / 2);
  const lines  = autoLines(ctx, title, W * 0.86);
  const lineH  = baseFontSize * 1.18;
  const ty     = Math.round(H * textYPct) - (lines.length - 1) * lineH;
  lines.forEach((line, i) => {
    ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 4;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(line, tx, ty + i * lineH);
  });
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
}

// ══ 下載廣告圖 ══
function downloadAd() {
  const canvas   = document.getElementById('adCanvas');
  const brand    = window.BRANDS.find(b => b.id === window.S.brandId);
  const filename = `${brand?.name||'ad'}_${window.S.prod?.name||'img'}.jpg`.replace(/[^\w\u4e00-\u9fff\-_.]/g, '_');
  const link     = document.createElement('a');
  link.download  = filename;
  link.href      = canvas.toDataURL('image/jpeg', 0.92);
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
        if (w > h) { h = Math.round(h * maxSize / w); w = maxSize; }
        else        { w = Math.round(w * maxSize / h); h = maxSize; }
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
