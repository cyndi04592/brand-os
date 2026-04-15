// ══════════════════════════════════════════
//  admaker.js — AD Maker 素材製作系統 v4.3
//  ✅ AI 電商場景：去背 → Bria Product Shot（全自動串接）
//  ✅ 真人 MD 試穿：Kling kolors（超時自動再查3次）
//  ✅ 影片生成：Kling v3 Pro / Seedance 2.0（超時自動再查）
//  ✅ 修正：全部改用 imageUrl / videoUrl，不再等 imageBase64
// ══════════════════════════════════════════

let AM = { w:1080, h:1080, scriptIdx:null };
let PR_BG_IMG  = null;
let PR_MODE    = 'product_shot';
let TEXT_ALIGN = 'left';

// ── Flux Pro Kontext 場景 prompt 庫（直接改原圖，不去背）──
// 核心原則：保留所有人物/商品/前景，只改背景/光線/氛圍
// 攝影設備基準：Nikon Z9 + NIKKOR Z 24-70mm f/2.8 S
const PRODUCT_SCENES = {

  // ══ 通用場景 ══
  studio_white:
    'Change ONLY the background to a premium seamless white studio backdrop with subtle gradient shadow at base. Add professional soft box lighting matching product existing light direction. Product reflected on white acrylic surface. Keep ALL subjects products people EXACTLY unchanged. Shot on Nikon Z9 NIKKOR Z 24-70mm f/2.8 S.',

  dark_luxury:
    'Change ONLY the background to deep matte black. Add dramatic single-source side lighting with golden rim light complementing product color. Seamless light integration. Keep ALL subjects products people EXACTLY unchanged. Shot on Nikon Z9 NIKKOR Z 24-70mm f/2.8 S.',

  marble_premium:
    'Change surface and background to Italian Calacatta marble with dark charcoal upper background. Add dramatic golden accent rim lighting complementing product. Keep ALL subjects products people EXACTLY unchanged. Shot on Nikon Z9 NIKKOR Z 24-70mm f/2.8 S.',

  minimal_grey:
    'Change background to light grey seamless gradient. Add diffused soft box lighting matching product light direction. No harsh shadows. Keep ALL subjects products people EXACTLY unchanged. Shot on Nikon Z9 NIKKOR Z 24-70mm f/2.8 S.',

  forest_outdoor:
    'Change background to lush Japanese cedar forest with dappled golden morning light filtering through trees. Green forest ambient light reflects naturally onto product. Keep ALL subjects products people EXACTLY unchanged. Shot on Nikon Z9 NIKKOR Z 24-70mm f/2.8 S.',

  night_city:
    'Change background to beautiful night cityscape with warm neon bokeh lights. City glow reflects naturally onto product surface edges. Keep ALL subjects products people EXACTLY unchanged. Shot on Nikon Z9 NIKKOR Z 24-70mm f/2.8 S.',

  lifestyle_home:
    'Change background to warm Scandinavian home interior with large window soft natural morning light, aged oak surface. Warm 5500K ambient light wraps product matching existing light direction. Keep ALL subjects products people EXACTLY unchanged. Shot on Nikon Z9 NIKKOR Z 24-70mm f/2.8 S.',

  // ══ 科技/3C ══
  tech_dark_stage:
    'Change background to pure deep black studio with single dramatic overhead spotlight creating perfect circular light pool on product, subtle dark grey floor reflection, product appears to float in darkness. Style like Apple or Sony product launch photography. No colored lights, only pure white spotlight. Keep ALL subjects products people EXACTLY unchanged. Shot on Nikon Z9 NIKKOR Z 24-70mm f/2.8 S.',

  tech_space:
    'Change background to deep space atmosphere with Earth curvature glow at horizon, dark cosmic backdrop, subtle blue-purple atmospheric rim light wrapping product edges naturally like OnePlus or Samsung flagship photography. Keep ALL subjects products people EXACTLY unchanged. Shot on Nikon Z9 NIKKOR Z 24-70mm f/2.8 S.',

  tech_mirror_stage:
    'Change background to dark architectural stage with tall dark mirror panels creating infinite reflection corridors, single dramatic downward spotlight on product like eufy or Dyson brand photography, polished dark floor with subtle product reflection. Keep ALL subjects products people EXACTLY unchanged. Shot on Nikon Z9 NIKKOR Z 24-70mm f/2.8 S.',

  // ══ 服飾/鞋子 ══
  fashion_minimal:
    'Change background to clean off-white or light warm beige seamless studio, soft natural light from left window, fashion editorial aesthetic, minimal negative space. Keep ALL subjects products people EXACTLY unchanged. Shot on Nikon Z9 NIKKOR Z 24-70mm f/2.8 S.',

  fashion_outdoor:
    'Change background to golden hour urban street or park setting, bokeh city or nature background, warm lifestyle fashion photography aesthetic. Keep ALL subjects products people EXACTLY unchanged. Shot on Nikon Z9 NIKKOR Z 24-70mm f/2.8 S.',

  shoe_floating:
    'Change background to pure deep black with single overhead spotlight, shoe or product appears to float with perfect shadow below, ultra-clean product launch aesthetic like Nike or Adidas campaign. Keep ALL subjects products people EXACTLY unchanged. Shot on Nikon Z9 NIKKOR Z 24-70mm f/2.8 S.',

  // ══ 寵物 ══
  pet_home_warm:
    'Change background to warm cozy home interior with soft morning window light, wood floor, soft-focus green plants and simple furniture. Warm 4500K ambient light. Approachable domestic atmosphere. Keep ALL subjects products people animals EXACTLY unchanged. Shot on Nikon Z9 NIKKOR Z 24-70mm f/2.8 S.',

  pet_outdoor_grass:
    'Change background to sunny outdoor park with fresh green grass, soft natural sunlight, bokeh trees in background, happy energetic outdoor atmosphere. Keep ALL subjects products people animals EXACTLY unchanged. Shot on Nikon Z9 NIKKOR Z 24-70mm f/2.8 S.',

  pet_studio_clean:
    'Change background to clean white or light grey seamless studio with soft professional lighting, pet product photography style, clean and bright. Keep ALL subjects products people animals EXACTLY unchanged. Shot on Nikon Z9 NIKKOR Z 24-70mm f/2.8 S.',

  // ══ 健康/瑜珈/課程 ══
  yoga_zen:
    'Change background to serene Japanese zen interior or outdoor bamboo garden with soft diffused morning light, peaceful minimal atmosphere, warm neutral tones, wellness brand aesthetic. Keep ALL subjects products people EXACTLY unchanged. Shot on Nikon Z9 NIKKOR Z 24-70mm f/2.8 S.',

  wellness_bright:
    'Change background to bright airy studio with large windows and natural morning light, white walls with subtle plant shadow, clean wellness lifestyle aesthetic. Keep ALL subjects products people EXACTLY unchanged. Shot on Nikon Z9 NIKKOR Z 24-70mm f/2.8 S.',

  // ══ 零食/飲料 ══
  snack_playful:
    'Change background to bold colorful flat lay surface in warm yellow or coral, playful scattered ingredients or props matching product theme, bright fun commercial food photography. Keep ALL subjects products people EXACTLY unchanged. Shot on Nikon Z9 NIKKOR Z 24-70mm f/2.8 S.',

  snack_dark_premium:
    'Change background to deep dark moody surface with single dramatic spotlight and subtle steam or particles, premium snack brand aesthetic, dramatic food photography. Keep ALL subjects products people EXACTLY unchanged. Shot on Nikon Z9 NIKKOR Z 24-70mm f/2.8 S.',

  // ══ 運動感 ══
  sport_energy:
    'Change background to bold gradient deep navy and electric orange, dynamic motion energy atmosphere, athletic lifestyle photography. Keep ALL subjects products people EXACTLY unchanged. Shot on Nikon Z9 NIKKOR Z 24-70mm f/2.8 S.',

  // ══ 珠寶/精品 ══
  jewelry_dark:
    'Change background to pure black velvet with single dramatic spotlight and subtle teal reflection on dark glass surface. Spotlight direction matches product existing highlight exactly. Keep ALL subjects products EXACTLY unchanged. Shot on Nikon Z9 NIKKOR Z 85mm f/1.4.',

  // ══ 美食升級（保留擺盤）══
  food_drama:
    'Transform into Michelin 3-star advertisement. Change background to pure black, add dramatic single spotlight from above matching dish existing highlight direction, add atmospheric steam wisps, warm golden rim light complementing food color. Keep ALL food dishes hands EXACTLY unchanged. Shot on Nikon Z9 NIKKOR Z 24-70mm f/2.8 S.',

  food_japanese:
    'Transform into Japanese kappo cuisine. Change surface to dark charcoal aged stone slate, soft single-source cool side lighting 4000K matching dish light direction. Wabi-sabi minimal aesthetic. Keep ALL food dishes hands EXACTLY unchanged. Shot on Nikon Z9 NIKKOR Z 24-70mm f/2.8 S.',

  food_cantonese:
    'Transform into Hong Kong Cantonese banquet. Change surface to dark lacquered rosewood, add warm amber pendant light matching dish existing highlight. Gold and red tones reflect warmly onto dish. Keep ALL food dishes hands EXACTLY unchanged. Shot on Nikon Z9 NIKKOR Z 24-70mm f/2.8 S.',

  food_korean:
    'Transform into Korean BBQ atmosphere. Change surface to dark volcanic stone, add dramatic warm backlight from behind matching food existing highlight. Orange-red glow reflects onto food surface edges. Keep ALL food dishes hands EXACTLY unchanged. Shot on Nikon Z9 NIKKOR Z 24-70mm f/2.8 S.',

  food_taiwanese:
    'Transform into Taiwanese comfort food. Change surface to warm aged teak wood, add soft 3800K tungsten overhead light matching dish light direction. Traditional ceramic tea cup props. Keep ALL food dishes hands EXACTLY unchanged. Shot on Nikon Z9 NIKKOR Z 24-70mm f/2.8 S.',

  food_french:
    'Transform into French fine dining editorial. Change surface to deep navy blue linen tablecloth, silver cutlery props, soft cool natural window light 5500K. Keep ALL food dishes hands EXACTLY unchanged. Shot on Nikon Z9 NIKKOR Z 24-70mm f/2.8 S.',

  food_outdoor:
    'Transform into outdoor golden hour picnic. Change background to natural green grass meadow with warm golden sunset light. Rustic wooden props. Keep ALL food dishes hands EXACTLY unchanged. Shot on Nikon Z9 NIKKOR Z 24-70mm f/2.8 S.',

  food_bright:
    'Transform into bright Nordic brunch. Change surface to clean white marble, soft natural morning window light 6000K. Fresh herb and lemon slice props. Keep ALL food dishes hands EXACTLY unchanged. Shot on Nikon Z9 NIKKOR Z 24-70mm f/2.8 S.',
};══════════════════════════════════════════
//  admaker.js — AD Maker 素材製作系統 v4.3
//  ✅ AI 電商場景：去背 → Bria Product Shot（全自動串接）
//  ✅ 真人 MD 試穿：Kling kolors（超時自動再查3次）
//  ✅ 影片生成：Kling v3 Pro / Seedance 2.0（超時自動再查）
//  ✅ 修正：全部改用 imageUrl / videoUrl，不再等 imageBase64
// ══════════════════════════════════════════

let AM = { w:1080, h:1080, scriptIdx:null };
let PR_BG_IMG  = null;
let PR_MODE    = 'product_shot';
let TEXT_ALIGN = 'left';

// ── Flux Pro Kontext 場景 prompt 庫（直接改原圖，不去背）──
// 核心原則：保留所有人物/商品/前景，只改背景/光線/氛圍
// 自動擴展至 1080x1080，光影與商品色調對應
// 攝影設備基準：Nikon Z9 + NIKKOR Z 24-70mm f/2.8 S
const PRODUCT_SCENES = {

  // ══ 通用場景 ══
  studio_white:
    'Expand the canvas to a perfect 1080x1080 square by extending the background seamlessly. Change background to premium seamless white studio backdrop with subtle gradient shadow at base. Add soft directional key light matching the product existing light source direction, gentle fill light. Product on reflective white acrylic surface. Match lighting color temperature to product tones. Environment should feel cohesive with the product. Keep ALL subjects products people EXACTLY unchanged. Shot on Nikon Z9 NIKKOR Z 24-70mm f/2.8 S.',

  dark_luxury:
    'Expand the canvas to a perfect 1080x1080 square by extending the background seamlessly. Change background to deep matte black. Add dramatic single-source side lighting direction matching the product existing highlights, golden rim light complementing product color tones. Seamless light integration between product and background. Keep ALL subjects products people EXACTLY unchanged. Shot on Nikon Z9 NIKKOR Z 24-70mm f/2.8 S.',

  marble_premium:
    'Expand the canvas to a perfect 1080x1080 square by extending the background seamlessly. Change surface and background to Italian Calacatta marble with dark charcoal upper background. Add dramatic golden accent rim lighting that complements product color palette. Environment accent colors match product tones naturally. Keep ALL subjects products people EXACTLY unchanged. Shot on Nikon Z9 NIKKOR Z 24-70mm f/2.8 S.',

  minimal_grey:
    'Expand the canvas to a perfect 1080x1080 square by extending the background seamlessly. Change background to light grey seamless gradient. Add diffused soft box lighting matching product existing light direction. No harsh shadows. Environment neutral tones complement product naturally. Keep ALL subjects products people EXACTLY unchanged. Shot on Nikon Z9 NIKKOR Z 24-70mm f/2.8 S.',

  forest_outdoor:
    'Expand the canvas to a perfect 1080x1080 square by extending the background seamlessly. Change background to lush Japanese cedar forest with dappled golden morning light. Match lighting color temperature and direction to product existing light source. Green forest ambient color reflects naturally onto product surface. Seamless integration. Keep ALL subjects products people EXACTLY unchanged. Shot on Nikon Z9 NIKKOR Z 24-70mm f/2.8 S.',

  night_city:
    'Expand the canvas to a perfect 1080x1080 square by extending the background seamlessly. Change background to beautiful night cityscape with neon bokeh lights. Neon colors should complement and reflect onto product surface edges naturally. Match light direction from city glow to product existing highlights. Seamless light integration. Keep ALL subjects products people EXACTLY unchanged. Shot on Nikon Z9 NIKKOR Z 24-70mm f/2.8 S.',

  lifestyle_warm:
    'Expand the canvas to a perfect 1080x1080 square by extending the background seamlessly. Change background to warm Scandinavian home interior with large window soft natural morning light. Warm 5500K ambient light wraps around product naturally matching its existing light direction. Wood and linen tones complement product color palette. Keep ALL subjects products people EXACTLY unchanged. Shot on Nikon Z9 NIKKOR Z 24-70mm f/2.8 S.',

  tech_futuristic:
    'Expand the canvas to a perfect 1080x1080 square by extending the background seamlessly. Change background to dark carbon fiber with cool blue and purple LED accent lighting. Tech light colors reflect subtly onto product surface edges matching product contours. Holographic light streaks direction aligned with product highlights. Keep ALL subjects products people EXACTLY unchanged. Shot on Nikon Z9 NIKKOR Z 24-70mm f/2.8 S.',

  sport_energy:
    'Expand the canvas to a perfect 1080x1080 square by extending the background seamlessly. Change background to bold gradient deep navy and electric orange. Dynamic lighting energy direction matches product existing light source. Background gradient colors complement product color tones. Keep ALL subjects products people EXACTLY unchanged. Shot on Nikon Z9 NIKKOR Z 24-70mm f/2.8 S.',

  pet_natural:
    'Expand the canvas to a perfect 1080x1080 square by extending the background seamlessly. Change background to warm natural home setting with soft morning window light and wood floor with soft-focus green plants. Warm natural light wraps product seamlessly matching existing light direction. Keep ALL subjects products people animals EXACTLY unchanged. Shot on Nikon Z9 NIKKOR Z 24-70mm f/2.8 S.',

  jewelry_dark:
    'Expand the canvas to a perfect 1080x1080 square by extending the background seamlessly. Change background to pure black velvet with single dramatic spotlight. Spotlight direction matches product existing highlight position exactly. Subtle teal reflection on dark glass surface complements product metal tones. Keep ALL subjects products EXACTLY unchanged. Shot on Nikon Z9 NIKKOR Z 85mm f/1.4.',

  // ══ 美食場景（強化氛圍，保留擺盤，自動補滿畫面）══
  food_drama:
    'Expand the canvas to a perfect 1080x1080 square by extending the background and table surface seamlessly. Transform into Michelin 3-star advertisement. Change background to pure black, add dramatic single spotlight from above matching dish existing highlight direction, add atmospheric steam wisps, warm golden rim light that complements food color tones. Environment dark tones make food colors pop vividly. Keep ALL food dishes hands EXACTLY unchanged. Shot on Nikon Z9 NIKKOR Z 24-70mm f/2.8 S.',

  food_japanese:
    'Expand the canvas to a perfect 1080x1080 square by extending the background and surface seamlessly. Transform into Japanese kappo cuisine. Change surface to dark charcoal aged stone slate, soft single-source cool side lighting 4000K matching dish existing light direction. Cool grey environment tones complement ceramic and food colors naturally. Wabi-sabi minimal. Keep ALL food dishes hands EXACTLY unchanged. Shot on Nikon Z9 NIKKOR Z 24-70mm f/2.8 S.',

  food_cantonese:
    'Expand the canvas to a perfect 1080x1080 square by extending the background and surface seamlessly. Transform into Hong Kong Cantonese banquet. Change surface to dark lacquered rosewood, add warm amber pendant light matching dish existing highlight direction. Gold and red environment tones reflect warmly onto dish rim and food surface. Elegant dynasty atmosphere. Keep ALL food dishes hands EXACTLY unchanged. Shot on Nikon Z9 NIKKOR Z 24-70mm f/2.8 S.',

  food_korean:
    'Expand the canvas to a perfect 1080x1080 square by extending the background and surface seamlessly. Transform into Korean BBQ atmosphere. Change surface to dark volcanic stone with scattered sesame and chili props. Add dramatic warm backlight from behind matching food existing highlight. Orange-red environment glow reflects onto food surface edges naturally. Keep ALL food dishes hands EXACTLY unchanged. Shot on Nikon Z9 NIKKOR Z 24-70mm f/2.8 S.',

  food_taiwanese:
    'Expand the canvas to a perfect 1080x1080 square by extending the background and surface seamlessly. Transform into Taiwanese comfort food. Change surface to warm aged teak wood table, add soft 3800K tungsten overhead light matching dish existing light direction. Warm golden-brown environment tones complement food color naturally. Traditional ceramic tea cup props. Keep ALL food dishes hands EXACTLY unchanged. Shot on Nikon Z9 NIKKOR Z 24-70mm f/2.8 S.',

  food_french:
    'Expand the canvas to a perfect 1080x1080 square by extending the background and surface seamlessly. Transform into French fine dining editorial. Change surface to deep navy blue linen tablecloth, add silver cutlery props, soft cool natural window light 5500K matching dish existing light direction. Cool blue environment tones create elegant contrast with warm food colors. Keep ALL food dishes hands EXACTLY unchanged. Shot on Nikon Z9 NIKKOR Z 24-70mm f/2.8 S.',

  food_outdoor:
    'Expand the canvas to a perfect 1080x1080 square by extending the background seamlessly. Transform into outdoor golden hour picnic. Change background to natural green grass meadow with warm golden sunset light matching dish existing highlight direction. Warm golden environment light wraps onto dish and food surface naturally. Rustic wooden props. Keep ALL food dishes hands EXACTLY unchanged. Shot on Nikon Z9 NIKKOR Z 24-70mm f/2.8 S.',

  food_bright:
    'Expand the canvas to a perfect 1080x1080 square by extending the background and surface seamlessly. Transform into bright Nordic brunch. Change surface to clean white marble table, add soft natural morning window light 6000K from upper left matching dish existing light direction. Clean bright environment enhances food colors vibrancy. Fresh herb and lemon slice props. Keep ALL food dishes hands EXACTLY unchanged. Shot on Nikon Z9 NIKKOR Z 24-70mm f/2.8 S.',
};// ══ 開啟 AD Maker ══
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
// ✅ 讓影片/試穿任務可以超時後自動再查
// ══
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

      // ✅ poll 3分鐘，超時自動再查3次
      let result = await pollUntilDone(submitData.requestId, submitData.endpoint, 180000, submitData.responseUrl, submitData.statusUrl);
      if (result.status === 'TIMEOUT') {
        setPrStatus('🔄 超時，最後查詢一次...', 'var(--t3)');
        for (let i = 0; i < 3; i++) {
          await sleep(5000);
          result = await callWorker({ action:'fal_poll', requestId: submitData.requestId, endpoint: submitData.endpoint, responseUrl: submitData.responseUrl, statusUrl: submitData.statusUrl });
          // ✅ 修正：改用 imageUrl（Worker 回傳 URL，不再是 base64）
          if (result.status === 'COMPLETED' && (result.imageUrl || result.imageBase64)) break;
        }
      }
      if (result.status === 'FAILED') throw new Error(result.error || '試穿失敗');
      // ✅ 修正：改用 imageUrl
      if (!result.imageUrl && !result.imageBase64) throw new Error('試穿超時，請再試一次');

      // ✅ 修正：優先用 URL（fal.ai CDN 直接顯示，不需下載）
      PR_BG_IMG = result.imageUrl || result.imageBase64;
      await renderAdCanvasWithPR();
      finishProgress(interval);
      setPrStatus('✅ MD 試穿完成！', 'var(--mint)');
    } catch(e) { failProgress(interval, e.message); }
    return;
  }

  // ── Flux Pro Kontext：直接改原圖，不去背 ──
  if (PR_MODE === 'product_shot') {
    const interval = startProgress(30000);
    try {
      // ✅ 先把原圖 pad 成 1080x1080（居中，空白補黑），再送給 Flux 擴展背景
      const blob = await urlToBlob(imgSrc);
      const base64 = await blobToBase64(blob);
      const paddedBase64 = await padImageTo1080(base64);
      const imageUrl = await uploadToFal(paddedBase64);

      const sceneKey = document.getElementById('prSceneSection')?.dataset?.scene || 'studio_white';
      const customPrompt = document.getElementById('prCustomPrompt')?.value?.trim();
      const scenePrompt = customPrompt || PRODUCT_SCENES[sceneKey] || PRODUCT_SCENES.studio_white;

      setPrStatus('🎨 Flux Kontext 改圖中...', 'var(--t3)');
      const submitData = await callWorker({
        action: 'flux_kontext_submit',
        imageUrl,
        prompt: scenePrompt
      });
      if (!submitData.ok) throw new Error(submitData.error || '提交失敗');

      setPrStatus('⏳ 生成中（約10-15秒）...', 'var(--t3)');
      let result = await pollUntilDone(submitData.requestId, submitData.endpoint, 120000, submitData.responseUrl, submitData.statusUrl);

      if (result.status === 'TIMEOUT' || result.status === 'FAILED') {
        throw new Error(result.error || '生成失敗，請再試一次');
      }

      PR_BG_IMG = result.imageUrl;
      if (!PR_BG_IMG) throw new Error('未回傳圖片 URL');

      await renderAdCanvasWithPR();
      finishProgress(interval);
      setPrStatus('✅ AI 電商場景完成！', 'var(--mint)');
    } catch(e) { failProgress(interval, e.message); }
    return;
  }
}

// ══ 影片生成（Seedance 2.0 / Kling v3）══
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
    const maxWait = isKling && videoDuration >= 10 ? 900000 : 600000;
    setPrStatus(`🎬 ${isKling ? 'Kling v3' : 'Seedance 2.0'} 生成中...`, 'var(--t3)');
    let result = await pollUntilDone(requestId, videoEndpoint, maxWait, submitData.responseUrl, submitData.statusUrl);

    // ✅ 超時後自動再查 3 次
    if (result.status === 'TIMEOUT') {
      setPrStatus('🔄 超時，最後查詢一次...', 'var(--t3)');
      for (let i = 0; i < 3; i++) {
        await sleep(5000);
        result = await callWorker({ action:'fal_poll', requestId, endpoint: videoEndpoint, responseUrl: submitData.responseUrl, statusUrl: submitData.statusUrl });
        if (result.status === 'COMPLETED' && result.videoUrl) break;
      }
    }

    if (result.status === 'FAILED') throw new Error(result.error || '影片生成失敗');

    if (result.videoUrl) {
      finishProgress(interval);
      showVideoResult(result.videoUrl);
      setPrStatus('✅ 影片生成完成！', 'var(--mint)');
    } else if (result.imageUrl || result.imageBase64) {
      // 萬一影片 endpoint 回傳圖片（不應發生，但防呆）
      finishProgress(interval);
      setPrStatus('⚠️ 收到圖片而非影片，請重試', 'var(--gold)');
      if (btn) btn.textContent = '✨ 套用 AI 效果';
    } else {
      finishProgress(interval);
      setPrStatus('⏳ 影片仍在生成，請稍後重新開啟廣告圖功能再試', 'var(--gold)');
      if (btn) btn.textContent = '✨ 套用 AI 效果';
    }

  } catch(e) { failProgress(interval, e.message); }
}

// ══ 顯示影片結果（播放器 + 下載按鈕）══
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

// ══ 把圖片 pad 成 1080x1080 正方形（居中，空白補黑）══
async function padImageTo1080(base64) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const SIZE = 1080;
      const canvas = document.createElement('canvas');
      canvas.width = SIZE; canvas.height = SIZE;
      const ctx = canvas.getContext('2d');
      // 黑色底
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, SIZE, SIZE);
      // 縮放原圖到最大 1080，居中放
      const scale = Math.min(SIZE / img.width, SIZE / img.height);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
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
