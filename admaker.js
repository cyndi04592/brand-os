// ══════════════════════════════════════════════════════════════
//  BRAND OS · AD Maker  (v7 瘦身版)
//  變更紀錄:
//    1. 修正白背景 bug: prompt 改用 "Replace" 指令式
//    2. 智能 padding: 採樣邊緣色 + 方形原圖不 padding
//    3. 加入場景 variation 關鍵字,避免每次長一樣
//    4. 砍掉所有影片功能 (Seedance / Kling Video)
//    5. 品牌化命名: Flux / Kling 等字樣從 UI 移除
// ══════════════════════════════════════════════════════════════

// ── AI 情境 場景 prompt 庫 (v2 指令式) ──
const PRODUCT_SCENES = {

  studio_white:
    'Replace the entire background with a clean seamless white studio backdrop, subtle gradient from bright white at top to soft grey shadow at base. Professional commercial product photography lighting with soft directional key light from upper left. Keep the product and all subjects EXACTLY unchanged in position, shape, color, and details. Shot on Nikon Z9 NIKKOR Z 24-70mm f/2.8 S, f/8, studio strobe.',

  dark_luxury:
    'Replace the entire background with pure deep matte black void. Add dramatic single-source side rim lighting with warm golden highlights on product edges, creating strong chiaroscuro contrast. Subtle smoke atmosphere in background. Keep the product and all subjects EXACTLY unchanged. Shot on Nikon Z9 NIKKOR Z 24-70mm f/2.8 S, f/4, dramatic lighting.',

  marble_premium:
    'Replace the entire scene: foreground surface becomes polished Italian Calacatta marble with natural grey veining, background becomes dark charcoal gradient wall. Add warm golden accent rim lighting from upper right. Luxury product photography aesthetic. Keep the product and all subjects EXACTLY unchanged. Shot on Nikon Z9 NIKKOR Z 24-70mm f/2.8 S.',

  minimal_grey:
    'Replace the entire background with a smooth light-to-medium grey seamless gradient, no texture. Soft diffused softbox lighting from above creating gentle shadow beneath product. Minimalist Scandinavian aesthetic. Keep the product and all subjects EXACTLY unchanged. Shot on Nikon Z9 NIKKOR Z 24-70mm f/2.8 S.',

  forest_outdoor:
    'Replace the entire background with a lush atmospheric forest scene. Choose a natural variation: either Japanese cedar with morning mist, or temperate deciduous forest with autumn light, or tropical jungle with dense green foliage. Dappled golden sunlight filtering through canopy creating bokeh highlights. Visible depth with blurred trees in far background. Keep the product and all subjects EXACTLY unchanged. Shot on Nikon Z9 NIKKOR Z 24-70mm f/2.8 S, f/2.8, shallow depth of field.',

  night_city:
    'Replace the entire background with a cinematic night cityscape. Blurred neon signs in warm orange, cool blue, and magenta pink creating rich bokeh circles. Wet street reflections if ground is visible. Cyberpunk atmospheric haze. Neon rim light naturally illuminating product edges. Keep the product and all subjects EXACTLY unchanged. Shot on Nikon Z9 NIKKOR Z 50mm f/1.2 S, f/1.4, heavy bokeh.',

  lifestyle_home:
    'Replace the entire scene with a warm Scandinavian home interior. Aged light oak wooden surface in foreground, soft-focus background showing white linen curtains with morning sunlight filtering through, hint of potted green plants. Warm 4000K natural lighting, cozy hygge atmosphere. Keep the product and all subjects EXACTLY unchanged. Shot on Nikon Z9 NIKKOR Z 35mm f/1.8 S, f/2.8.',

  tech_space:
    'Replace the entire background with a deep space atmosphere. Earth curvature softly glowing at lower horizon, dark cosmic backdrop with subtle star field, purple-to-blue atmospheric gradient rim light. Flagship tech product photography aesthetic, clean futuristic. Keep the product and all subjects EXACTLY unchanged. Shot on Nikon Z9 NIKKOR Z 24-70mm f/2.8 S.',

  fashion_minimal:
    'Replace the entire background with clean off-white to warm beige seamless studio gradient. Soft natural light from large window on the left creating gentle falloff. High-end fashion editorial aesthetic. Keep the subject and all products EXACTLY unchanged. Shot on Nikon Z9 NIKKOR Z 85mm f/1.4 S, f/2.8.',

  fashion_outdoor:
    'Replace the entire background with a golden hour urban or natural street scene. Choose a natural variation: either Tokyo Shibuya crossing, or Paris cobblestone alley, or New York SoHo, or European park path. Warm backlight creating natural halo, bokeh environment. Editorial lifestyle fashion aesthetic. Keep the subject and all products EXACTLY unchanged. Shot on Nikon Z9 NIKKOR Z 85mm f/1.4 S, f/2, shallow depth.',

  pet_home:
    'Replace the entire scene with a warm cozy home interior. Light wood floor with natural grain, soft-focus background of white walls with hanging green plants, morning window light from the side creating warm highlights. Gentle 4500K ambient atmosphere. Keep all subjects, products, and animals EXACTLY unchanged. Shot on Nikon Z9 NIKKOR Z 35mm f/1.8 S, f/2.8.',

  pet_outdoor:
    'Replace the entire background with a sunny outdoor park scene. Fresh bright green grass foreground, blurred trees and soft sunlight flares in background, natural daylight from upper left. Keep all subjects, products, and animals EXACTLY unchanged. Shot on Nikon Z9 NIKKOR Z 85mm f/1.4 S, f/2.8, bokeh background.',

  yoga_zen:
    'Replace the entire scene with a serene Japanese zen environment. Choose a variation: either a tatami room with shoji paper screens and soft diffused morning light, or an outdoor bamboo garden with stone path, or a minimal rock garden with raked sand. Peaceful atmospheric. Keep the subject and all products EXACTLY unchanged. Shot on Nikon Z9 NIKKOR Z 35mm f/1.8 S.',

  wellness_bright:
    'Replace the entire scene with a bright airy wellness studio. Large floor-to-ceiling windows with soft natural morning sunlight streaming in, white walls with subtle shadow of green plants, light wood or white floor. Fresh minimalist wellness aesthetic. Keep the subject and all products EXACTLY unchanged. Shot on Nikon Z9 NIKKOR Z 24-70mm f/2.8 S.',

  snack_playful:
    'Replace the entire background with a bold colorful flat surface. Choose a variation: either bright warm yellow, or coral pink, or mint green, or vibrant turquoise. Add playful scattered ingredient props (nuts, fruit slices, splashes) arranged artistically. Bright fun commercial food photography. Keep the product and all subjects EXACTLY unchanged. Shot on Nikon Z9 NIKKOR Z 50mm f/1.2 S.',

  sport_energy:
    'Replace the entire background with a bold dynamic gradient. Choose a variation: deep navy to electric orange, or black to neon green, or crimson to gold. Add subtle motion blur lines, energetic atmospheric haze. Athletic commercial photography aesthetic. Keep the subject and all products EXACTLY unchanged. Shot on Nikon Z9 NIKKOR Z 70-200mm f/2.8 S.',

  jewelry_dark:
    'Replace the entire background with pure black velvet texture. Add single dramatic overhead spotlight creating strong focused beam, subtle teal-blue reflection on dark polished glass surface below. Luxury jewelry photography aesthetic. Keep the product EXACTLY unchanged. Shot on Nikon Z9 NIKKOR Z 85mm f/1.4 S, f/5.6, high-key contrast.',

  // ══ 美食升級 (保留擺盤) ══
  food_drama:
    'Transform the entire scene into a Michelin 3-star restaurant advertisement. Replace background with pure black void, replace surface with dark slate. Add dramatic single overhead spotlight from above, atmospheric steam wisps rising from food, warm golden rim light on dish edges. Keep all food, dishes, and hands EXACTLY unchanged in position and details. Shot on Nikon Z9 NIKKOR Z 24-70mm f/2.8 S, f/4, dramatic lighting.',

  food_japanese:
    'Transform the entire scene into Japanese kappo fine dining aesthetic. Replace surface with dark charcoal aged stone slate with rough texture, replace background with deep shadowed wood wall. Soft single-source cool side lighting 4000K, wabi-sabi minimal atmosphere. Keep all food, dishes, and hands EXACTLY unchanged. Shot on Nikon Z9 NIKKOR Z 50mm f/1.2 S.',

  food_cantonese:
    'Transform the entire scene into Hong Kong Cantonese banquet aesthetic. Replace surface with dark lacquered rosewood table, replace background with deep red-gold wall with subtle Chinese pattern. Warm amber pendant light from above creating rich golden glow, traditional opulent atmosphere. Keep all food, dishes, and hands EXACTLY unchanged. Shot on Nikon Z9 NIKKOR Z 24-70mm f/2.8 S.',

  food_korean:
    'Transform the entire scene into Korean BBQ restaurant atmosphere. Replace surface with dark volcanic stone or cast iron plate, replace background with moody dark wood with hint of charcoal grill glow. Dramatic warm backlight from behind creating orange-red rim glow on food edges, atmospheric steam. Keep all food, dishes, and hands EXACTLY unchanged. Shot on Nikon Z9 NIKKOR Z 35mm f/1.8 S.',

  food_taiwanese:
    'Transform the entire scene into Taiwanese traditional comfort food aesthetic. Replace surface with warm aged teak wood table with natural grain, replace background with blurred vintage tile wall or wooden partition. Soft 3800K tungsten overhead light creating warm nostalgic glow, traditional ceramic tea cup and chopsticks as props. Keep all food, dishes, and hands EXACTLY unchanged. Shot on Nikon Z9 NIKKOR Z 35mm f/1.8 S.',

  food_french:
    'Transform the entire scene into French fine dining editorial. Replace surface with deep navy blue linen tablecloth, replace background with soft blurred restaurant ambience. Add silver cutlery and crystal glassware as props, soft cool natural window light 5500K creating clean elegant atmosphere. Keep all food, dishes, and hands EXACTLY unchanged. Shot on Nikon Z9 NIKKOR Z 50mm f/1.2 S.',

  food_outdoor:
    'Transform the entire scene into an outdoor golden hour picnic. Replace surface with rustic wooden board or checkered cloth on grass, replace background with natural green meadow with warm sunset backlight creating halo. Rustic wooden utensil props. Keep all food, dishes, and hands EXACTLY unchanged. Shot on Nikon Z9 NIKKOR Z 85mm f/1.4 S, f/2, shallow depth.',

  food_bright:
    'Transform the entire scene into bright Nordic brunch aesthetic. Replace surface with clean white Carrara marble, replace background with bright white wall with soft natural morning window light 6000K streaming from the side. Add fresh herb sprigs and citrus slice props. Keep all food, dishes, and hands EXACTLY unchanged. Shot on Nikon Z9 NIKKOR Z 35mm f/1.8 S.',
};

// ══ 狀態 ══
let AM = { w:1080, h:1080, scriptIdx:null };
let PR_BG_IMG  = null;
let PR_MODE    = 'product_shot';
let TEXT_ALIGN = 'left';

// ══ 開啟 / 關閉 ══
function openAdMaker(idx) {
  PR_BG_IMG = null; PR_MODE = 'product_shot';
  setPrStatus('', '');
  document.querySelectorAll('.pr-mode-btn').forEach(b => b.classList.remove('on'));
  document.querySelector('.pr-mode-btn')?.classList.add('on');
  ['prSceneSection','prVirtualSection'].forEach(id => {
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
  document.getElementById('prSceneSection').style.display   = mode === 'product_shot' ? 'block' : 'none';
  document.getElementById('prVirtualSection').style.display = mode === 'kling_tryon'  ? 'block' : 'none';
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
  const msgs = ['📤 上傳中...','🎨 生成場景...','🖌️ 光影融合...','⚡ 最終輸出...'];
  const interval = setInterval(() => {
    if (pctVal >= 90) return;
    pctVal = Math.min(90, pctVal + (pctVal < 30 ? 2 : pctVal < 60 ? 1 : 0.4));
    if (prFill) prFill.style.width = pctVal + '%';
    if (prPct) prPct.textContent = Math.round(pctVal) + '%';
    setPrStatus(msgs[Math.min(Math.floor(pctVal/25), msgs.length-1)], 'var(--t3)');
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

// ══ Worker / 工具 ══
async function callWorker(params) {
  const resp = await fetch(CF_WORKER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...params, password: GAS_PASSWORD })
  });
  return resp.json();
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

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

async function pollUntilDone(requestId, endpoint, maxMs = 300000, responseUrl = null, statusUrl = null) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    await sleep(5000);
    try {
      const pollData = await callWorker({ action:'fal_poll', requestId, endpoint, responseUrl, statusUrl });
      if (pollData.status === 'COMPLETED') return pollData;
      if (pollData.status === 'FAILED') return { status:'FAILED', error: pollData.error || '任務失敗' };
      const elapsed = Date.now() - start;
      const pct = Math.min(88, Math.round(15 + elapsed / maxMs * 73));
      const prFill = document.getElementById('prProgFill');
      const prPct  = document.getElementById('prPct');
      if (prFill) prFill.style.width = pct + '%';
      if (prPct) prPct.textContent = pct + '%';
    } catch(e) {
      console.warn('poll 單次失敗，繼續:', e.message);
    }
  }
  return { status:'TIMEOUT' };
}

// ══ 主入口:套用 AI 效果 ══
async function applyPhotoroomBg() {
  const photo = window.S.selPhoto !== null ? window.S.photos[window.S.selPhoto] : null;
  if (!photo) { setPrStatus('⚠️ 請先選擇照片！', 'var(--red)'); return; }
  const imgSrc = photo.src || photo.thumb;
  if (!imgSrc) { setPrStatus('⚠️ 照片尚未載入', 'var(--red)'); return; }

  const btn = document.getElementById('prApplyBtn');
  btn.disabled = true; btn.textContent = '⏳ AI 處理中...';

  // ── 真人試穿 ──
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
      setPrStatus('⏳ AI 試穿中（約30-90秒）...', 'var(--t3)');
      let result = await pollUntilDone(submitData.requestId, submitData.endpoint, 180000, submitData.responseUrl, submitData.statusUrl);
      if (result.status === 'TIMEOUT') {
        setPrStatus('🔄 超時，最後查詢一次...', 'var(--t3)');
        for (let i = 0; i < 3; i++) {
          await sleep(5000);
          result = await callWorker({ action:'fal_poll', requestId: submitData.requestId, endpoint: submitData.endpoint, responseUrl: submitData.responseUrl, statusUrl: submitData.statusUrl });
          if (result.status === 'COMPLETED' && (result.imageUrl || result.imageBase64)) break;
        }
      }
      if (result.status === 'FAILED') throw new Error(result.error || '試穿失敗');
      if (!result.imageUrl && !result.imageBase64) throw new Error('試穿超時，請再試一次');
      PR_BG_IMG = result.imageUrl || result.imageBase64;
      await renderAdCanvasWithPR();
      finishProgress(interval);
      setPrStatus('✅ MD 試穿完成！', 'var(--mint)');
    } catch(e) { failProgress(interval, e.message); }
    return;
  }

  // ── AI 情境 (改場景) ──
  if (PR_MODE === 'product_shot') {
    const interval = startProgress(30000);
    try {
      const blob = await urlToBlob(imgSrc);
      const base64 = await blobToBase64(blob);
      const paddedBase64 = await padImageTo1080(base64);
      const imageUrl = await uploadToFal(paddedBase64);

      const sceneKey = document.getElementById('prSceneSection')?.dataset?.scene || 'studio_white';
      const customPrompt = document.getElementById('prCustomPrompt')?.value?.trim();
      const scenePrompt = customPrompt || PRODUCT_SCENES[sceneKey] || PRODUCT_SCENES.studio_white;

      setPrStatus('🎨 AI 情境生成中...', 'var(--t3)');
      const submitData = await callWorker({
        action: 'flux_kontext_submit',
        imageUrl,
        prompt: scenePrompt
      });
      if (!submitData.ok) throw new Error(submitData.error || '提交失敗');

      setPrStatus('⏳ 生成中（約10-20秒）...', 'var(--t3)');
      let result = await pollUntilDone(submitData.requestId, submitData.endpoint, 120000, submitData.responseUrl, submitData.statusUrl);

      if (result.status === 'TIMEOUT' || result.status === 'FAILED') {
        throw new Error(result.error || '生成失敗，請再試一次');
      }

      PR_BG_IMG = result.imageUrl;
      if (!PR_BG_IMG) throw new Error('未回傳圖片 URL');

      await renderAdCanvasWithPR();
      finishProgress(interval);
      setPrStatus('✅ AI 情境生成完成！', 'var(--mint)');
    } catch(e) { failProgress(interval, e.message); }
  }
}

// ══ Canvas 渲染 ══
async function renderAdCanvas() {
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
        // 試穿圖比例可能很長,用 cover + contain 雙層處理
        const scaleCover   = Math.max(AM.w/img.width, AM.h/img.height);
        const scaleContain = Math.min(AM.w/img.width, AM.h/img.height);
        if (1 - scaleContain/scaleCover <= 0.20) {
          // 比例接近方形,直接 cover
          ctx.drawImage(img,
            Math.round((AM.w-img.width*scaleCover)/2),
            Math.round((AM.h-img.height*scaleCover)/2),
            img.width*scaleCover, img.height*scaleCover);
        } else {
          // 比例差距大,先畫模糊底再畫原圖 contain
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

// ══ 影像工具 ══
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

// ── 智能 padding (v2) ──
// 1. 方形原圖(ratio 0.85~1.15)且夠大 → 不 padding,直接用
// 2. 需要 padding 時,採樣四個角落顏色當底色(不再用死黑色)
//    → 避免 Flux 把黑 padding 當成背景保留
async function padImageTo1080(base64) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const w0 = img.width, h0 = img.height;
      const ratio = w0 / h0;

      // 已接近方形 & 夠大 → 直接用
      if (ratio >= 0.85 && ratio <= 1.15 && Math.min(w0, h0) >= 1000) {
        resolve(base64);
        return;
      }

      const SIZE = 1080;
      const canvas = document.createElement('canvas');
      canvas.width = SIZE; canvas.height = SIZE;
      const ctx = canvas.getContext('2d');

      // 採樣四個角落平均色
      let fillColor = '#ffffff';
      try {
        const tmpCanvas = document.createElement('canvas');
        tmpCanvas.width = w0; tmpCanvas.height = h0;
        const tmpCtx = tmpCanvas.getContext('2d');
        tmpCtx.drawImage(img, 0, 0);
        const sampleSize = Math.max(10, Math.floor(Math.min(w0, h0) * 0.02));
        const corners = [
          tmpCtx.getImageData(0, 0, sampleSize, sampleSize).data,
          tmpCtx.getImageData(w0-sampleSize, 0, sampleSize, sampleSize).data,
          tmpCtx.getImageData(0, h0-sampleSize, sampleSize, sampleSize).data,
          tmpCtx.getImageData(w0-sampleSize, h0-sampleSize, sampleSize, sampleSize).data,
        ];
        let r=0, g=0, b=0, n=0;
        corners.forEach(d => {
          for (let i=0; i<d.length; i+=4) { r+=d[i]; g+=d[i+1]; b+=d[i+2]; n++; }
        });
        r = Math.round(r/n); g = Math.round(g/n); b = Math.round(b/n);
        fillColor = `rgb(${r},${g},${b})`;
      } catch(e) {
        // 跨來源圖片可能無法採樣 → 用中性灰
        fillColor = '#888888';
      }

      ctx.fillStyle = fillColor;
      ctx.fillRect(0, 0, SIZE, SIZE);

      const scale = Math.min(SIZE / w0, SIZE / h0);
      const w = Math.round(w0 * scale);
      const h = Math.round(h0 * scale);
      const x = Math.round((SIZE - w) / 2);
      const y = Math.round((SIZE - h) / 2);
      ctx.drawImage(img, x, y, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.92));
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
