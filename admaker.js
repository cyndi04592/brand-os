// ══════════════════════════════════════════════════════════════
//  BRAND OS · AD Maker  (v9.1)
//  變更紀錄:
//    [v9.1] 字體系統: 4 種風格 (精品Serif/粗黑/文青Sans/手寫裝飾)
//    [v9.1] 場景調整: 刪 spa_morning, 新增 okinawa_beach + bali_sunrise
//    [v9.1] 新增 3 個內衣/泳裝安全場景
//    [v8.4] 黑圖偵測 + 自動重試 + Softening prompt
//    [v8.3] fetch+blob 載入圖片避免 canvas CORS 污染
//    [v8.2] 三重 fallback / 下載容錯 / 修 undefined bug
//    [v8.1] 強化 FACE LOCK + 徹底關中文
//    [v8]   新增 7 個場景 + 修 3 bug
// ══════════════════════════════════════════════════════════════

const PRESERVE_SUBJECT =
  'CRITICAL: Do NOT modify any product, person body proportions, clothing details, or accessories. Keep all subjects pixel-perfect identical to the original. Only modify the background, environment, and ambient lighting.';

const FACE_LOCK =
  ' ULTRA CRITICAL FACE LOCK: The person face must be 100% identical to the original - preserve exact eye shape and position, nose shape, mouth shape, jawline, cheekbones, face proportions, skin tone, freckles, moles, eyebrows, and all micro facial features. Treat the face as a protected frozen region that MUST NOT be regenerated or altered in any way. The person must look like the exact same individual.';

const NO_ASIAN_TEXT =
  ' STRICTLY NO Chinese, Japanese, Korean, or any East Asian characters anywhere in the image. Use ONLY English letters, numbers, or pure abstract neon shapes and glowing light patterns. Any visible signage must be in clear English only or be non-textual light glows.';

const COMMERCIAL_CONTEXT =
  'Professional commercial product advertisement, mainstream retail catalog photography, ' +
  'acceptable for major retailers and department stores. ';

const CAM_DEFAULT = 'Shot on Nikon Z9 NIKKOR Z 24-70mm f/2.8 S.';
const CAM_PORTRAIT = 'Shot on Nikon Z9 NIKKOR Z 85mm f/1.4 S, f/2.8.';
const CAM_MACRO = 'Shot on Nikon Z9 NIKKOR Z 50mm f/1.2 S.';

const PRODUCT_SCENES = {
  studio_white:
    `${COMMERCIAL_CONTEXT}Replace the entire background with a clean seamless white studio backdrop, subtle gradient from bright white at top to soft grey shadow at base. Professional commercial product photography lighting with soft directional key light from upper left. ${PRESERVE_SUBJECT}${FACE_LOCK} ${CAM_DEFAULT} f/8, studio strobe.`,

  dark_luxury:
    `${COMMERCIAL_CONTEXT}Replace the background with a rich deep charcoal-to-black gradient (NOT pure black void - keep it visible and atmospheric). Add strong warm golden rim lighting wrapping around the product and subject edges, plus a soft key light from upper left to keep the subject clearly illuminated and well-exposed. The overall image must remain BRIGHT and READABLE - the face and product must be clearly visible. Luxury magazine advertisement aesthetic with rich golden highlights. ${PRESERVE_SUBJECT}${FACE_LOCK} ${CAM_DEFAULT} f/4, dramatic but well-lit.`,

  marble_premium:
    `${COMMERCIAL_CONTEXT}Replace the scene: foreground surface becomes polished Italian Calacatta marble with natural grey veining, background becomes dark charcoal gradient wall. Add warm golden accent rim lighting from upper right. Luxury product photography aesthetic. ${PRESERVE_SUBJECT}${FACE_LOCK} ${CAM_DEFAULT}`,

  minimal_grey:
    `${COMMERCIAL_CONTEXT}Replace the background with a smooth light-to-medium grey seamless gradient, no texture. Soft diffused softbox lighting from above creating gentle shadow beneath product. Minimalist Scandinavian aesthetic. ${PRESERVE_SUBJECT}${FACE_LOCK} ${CAM_DEFAULT}`,

  forest_outdoor:
    `${COMMERCIAL_CONTEXT}Replace the background with a lush atmospheric forest scene. Choose a natural variation: either Japanese cedar with morning mist, or temperate deciduous forest with autumn light, or tropical jungle with dense green foliage. Dappled golden sunlight filtering through canopy creating bokeh highlights. Visible depth with blurred trees in far background. ${PRESERVE_SUBJECT}${FACE_LOCK} ${CAM_DEFAULT} f/2.8, shallow depth of field.`,

  night_city:
    `${COMMERCIAL_CONTEXT}Replace the background with a cinematic futuristic night cityscape. Blurred abstract neon light streaks and glowing orbs in warm orange, cool blue, electric magenta, and cyan creating rich bokeh. Wet reflective street surface if visible. Cyberpunk atmospheric haze with colored fog. Neon rim light naturally illuminating product and subject edges.${NO_ASIAN_TEXT} ${PRESERVE_SUBJECT}${FACE_LOCK} Shot on Nikon Z9 NIKKOR Z 50mm f/1.2 S, f/1.4, heavy bokeh.`,

  lifestyle_home:
    `${COMMERCIAL_CONTEXT}Replace the scene with a warm Scandinavian home interior. Aged light oak wooden surface in foreground, soft-focus background showing white linen curtains with morning sunlight filtering through, hint of potted green plants. Warm 4000K natural lighting, cozy hygge atmosphere. ${PRESERVE_SUBJECT}${FACE_LOCK} Shot on Nikon Z9 NIKKOR Z 35mm f/1.8 S, f/2.8.`,

  tech_space:
    `${COMMERCIAL_CONTEXT}Replace the background with a deep space atmosphere. Earth curvature softly glowing at lower horizon, dark cosmic backdrop with subtle star field, purple-to-blue atmospheric gradient rim light. Flagship tech product photography aesthetic, clean futuristic. ${PRESERVE_SUBJECT}${FACE_LOCK} ${CAM_DEFAULT}`,

  fashion_minimal:
    `${COMMERCIAL_CONTEXT}Replace the background with clean off-white to warm beige seamless studio gradient. Soft natural light from large window on the left creating gentle falloff. High-end fashion editorial aesthetic. ${PRESERVE_SUBJECT}${FACE_LOCK} ${CAM_PORTRAIT}`,

  fashion_outdoor:
    `${COMMERCIAL_CONTEXT}Replace the background with a golden hour urban or natural street scene. Choose a natural variation: either European cobblestone alley, or New York SoHo brownstone, or Parisian boulevard, or London South Bank, or California palm-lined street. Warm backlight creating natural halo, bokeh environment.${NO_ASIAN_TEXT} Editorial lifestyle fashion aesthetic. ${PRESERVE_SUBJECT}${FACE_LOCK} Shot on Nikon Z9 NIKKOR Z 85mm f/1.4 S, f/2, shallow depth.`,

  pet_home:
    `${COMMERCIAL_CONTEXT}Replace the scene with a warm cozy home interior. Light wood floor with natural grain, soft-focus background of white walls with hanging green plants, morning window light from the side creating warm highlights. Gentle 4500K ambient atmosphere. ${PRESERVE_SUBJECT}${FACE_LOCK} Shot on Nikon Z9 NIKKOR Z 35mm f/1.8 S, f/2.8.`,

  pet_outdoor:
    `${COMMERCIAL_CONTEXT}Replace the background with a sunny outdoor park scene. Fresh bright green grass foreground, blurred trees and soft sunlight flares in background, natural daylight from upper left. ${PRESERVE_SUBJECT}${FACE_LOCK} Shot on Nikon Z9 NIKKOR Z 85mm f/1.4 S, f/2.8, bokeh background.`,

  yoga_zen:
    `${COMMERCIAL_CONTEXT}Replace the scene with a serene Japanese zen environment. Choose a variation: either a tatami room with shoji paper screens and soft diffused morning light, or an outdoor bamboo garden with stone path, or a minimal rock garden with raked sand. Peaceful atmospheric. ${PRESERVE_SUBJECT}${FACE_LOCK} Shot on Nikon Z9 NIKKOR Z 35mm f/1.8 S.`,

  wellness_bright:
    `${COMMERCIAL_CONTEXT}Replace the scene with a bright airy wellness studio. Large floor-to-ceiling windows with soft natural morning sunlight streaming in, white walls with subtle shadow of green plants, light wood or white floor. Fresh minimalist wellness aesthetic. ${PRESERVE_SUBJECT}${FACE_LOCK} ${CAM_DEFAULT}`,

  snack_playful:
    `${COMMERCIAL_CONTEXT}Replace the background with a bold colorful flat surface. Choose a variation: either bright warm yellow, or coral pink, or mint green, or vibrant turquoise. Add playful scattered ingredient props (nuts, fruit slices, splashes) arranged artistically. Bright fun commercial food photography. ${PRESERVE_SUBJECT}${FACE_LOCK} ${CAM_MACRO}`,

  sport_energy:
    `${COMMERCIAL_CONTEXT}Replace the background with a bold dynamic gradient. Choose a variation: deep navy to electric orange, or black to neon green, or crimson to gold. Add subtle motion blur lines, energetic atmospheric haze. Athletic commercial photography aesthetic. ${PRESERVE_SUBJECT}${FACE_LOCK} Shot on Nikon Z9 NIKKOR Z 70-200mm f/2.8 S.`,

  jewelry_dark:
    `${COMMERCIAL_CONTEXT}Replace the background with pure black velvet texture. Add single dramatic overhead spotlight creating strong focused beam, subtle teal-blue reflection on dark polished glass surface below. Luxury jewelry photography aesthetic. Keep the product EXACTLY unchanged. Shot on Nikon Z9 NIKKOR Z 85mm f/1.4 S, f/5.6, high-key contrast.`,

  design_editorial:
    `${COMMERCIAL_CONTEXT}Replace the scene with a minimalist editorial design magazine aesthetic. Soft off-white paper-textured background with subtle beige and sage green tones, warm natural window light from the side. Add subtle design elements like thin decorative lines and delicate paper grain texture. Clean asymmetric composition with generous negative space, Kinfolk magazine aesthetic, Japanese editorial design influence. Muted desaturated color palette.${NO_ASIAN_TEXT} ${PRESERVE_SUBJECT}${FACE_LOCK} ${CAM_PORTRAIT}`,

  summer_hot:
    `${COMMERCIAL_CONTEXT}Replace the background with a vibrant hot summer scene. Choose a natural variation: either a sunny tropical beach with turquoise water and palm tree shadows, or a poolside with crystal blue water and bright white tiles, or a bright summer garden with cicada-loud greenery and flare highlights. Intense golden sunlight creating strong warm highlights, visible sun flare, shimmering heat haze. Saturated tropical color palette with azure blues, sun yellows, and coral pinks. Refreshing atmospheric feel. ${PRESERVE_SUBJECT}${FACE_LOCK} ${CAM_DEFAULT} f/4, bright summer daylight.`,

  tropical_resort:
    `${COMMERCIAL_CONTEXT}Swimwear and beach lifestyle photography. Replace the background with a luxurious tropical resort beach scene. Choose from: Maldives overwater villa deck with crystal turquoise water, or Bali private beach with white sand and coconut palms, or Phuket infinity pool edge with ocean horizon. Warm golden afternoon sunlight, gentle ocean breeze atmosphere, soft palm shadow patterns. Sophisticated resort wear catalog aesthetic, similar to Victoria's Secret Swim campaign or Seafolly lookbook. Saturated azure and teal ocean tones, warm sand neutrals. ${PRESERVE_SUBJECT}${FACE_LOCK} ${CAM_DEFAULT} f/4, bright resort daylight.`,

  poolside_luxe:
    `${COMMERCIAL_CONTEXT}Poolside swimwear editorial photography. Replace the background with a modern luxury villa poolside scene. Choose from: Beverly Hills modernist villa pool with white stone deck and tropical plants, or Miami Art Deco hotel poolside with pastel blue tiles, or LA Hollywood Hills pool with city view in background. Bright midday sunlight creating sparkling water reflections and crisp shadows, clean minimal architecture, turquoise pool water. High-end swimwear campaign aesthetic like La Perla or Eres catalog. ${PRESERVE_SUBJECT}${FACE_LOCK} ${CAM_DEFAULT} f/5.6, sharp bright daylight.`,

  okinawa_beach:
    `${COMMERCIAL_CONTEXT}Okinawa beach resort morning lifestyle photography, swimwear and beachwear aesthetic. Replace the background with an authentic Okinawa beach scene. Choose from: Okinawa main island Emerald Beach with white coral sand and turquoise ocean at sunrise, or Ishigaki Island beach with coconut palm trees silhouettes against pastel morning sky, or Miyakojima beach with crystal clear shallow water reflecting soft pink dawn clouds. Gentle morning sunlight with soft warm glow, tropical sea breeze atmosphere, subtle pastel color palette (pale blue, coral pink, warm cream). Luxury Japanese resort magazine aesthetic like LEON or CLASSY, or Ryokan Rinka-Iwa campaign. Include subtle props: a white beach towel on pale wood deck, a shell. ${PRESERVE_SUBJECT}${FACE_LOCK} ${CAM_DEFAULT} f/4, soft morning daylight.`,

  bali_sunrise:
    `${COMMERCIAL_CONTEXT}Bali sunrise beach resort swimwear lifestyle photography. Replace the background with a picturesque Bali beach scene. Choose from: Uluwatu cliff edge with infinity ocean view and golden sunrise rays, or Nusa Dua private beach with white sand and distant palm grove silhouettes, or Seminyak beach deck with sea-facing daybed and early morning golden haze. Warm tropical golden hour lighting, lens flare from rising sun, saturated warm tones (amber gold, teal ocean, coral sky). High-end tropical resort campaign aesthetic like COMO Shambhala or Bulgari Bali lookbook. Soft atmospheric haze, palm frond shadows. ${PRESERVE_SUBJECT}${FACE_LOCK} ${CAM_DEFAULT} f/4, warm sunrise light.`,

  japan_premium:
    `${COMMERCIAL_CONTEXT}Transform the entire scene into premium Japanese wabi-sabi aesthetic. Replace surface with aged hinoki cypress wood or dark charcoal stone slate, replace background with soft washi paper texture or blurred shoji screen with warm interior light behind. Add subtle Japanese design elements: a small ceramic tea cup in the far background bokeh, a single dried branch or bamboo leaf. Soft diffused side lighting 4000K, low saturation, muted earth tones (beige, sumi black, soft green), contemplative mono-no-aware atmosphere.${NO_ASIAN_TEXT} ${PRESERVE_SUBJECT}${FACE_LOCK} Shot on Nikon Z9 NIKKOR Z 50mm f/1.2 S, f/2.`,

  kpop_korea:
    `${COMMERCIAL_CONTEXT}Transform the entire scene into trendy Korean K-POP music video aesthetic. Replace background with a dreamy gradient of pastel pink, lavender purple, and soft sky blue, with subtle sparkle bokeh and soft neon light streaks. Add Y2K-inspired elements: subtle holographic light flares, soft pink and blue rim lighting on product and subject edges, dreamy atmospheric glow. High-key bright exposure, glossy aesthetic, youthful Seoul fashion magazine vibe.${NO_ASIAN_TEXT} ${PRESERVE_SUBJECT}${FACE_LOCK} Shot on Nikon Z9 NIKKOR Z 50mm f/1.2 S, f/1.8, dreamy bokeh.`,

  american_wild:
    `${COMMERCIAL_CONTEXT}Transform the entire scene into American wild west / Route 66 aesthetic. Replace background with a vast dramatic landscape: choose from either Arizona red rock desert at golden hour, or Texas highway with dusty horizon and lens flare, or Californian canyon with rugged cliffs. Warm amber-orange sunset lighting with long dramatic shadows, slight dust haze atmosphere, vintage film grain texture. Masculine rugged aesthetic, Marlboro campaign influence, cinematic wide depth. Slightly desaturated cinematic color grade (teal shadows, orange highlights). ${PRESERVE_SUBJECT}${FACE_LOCK} Shot on Nikon Z9 NIKKOR Z 35mm f/1.8 S, f/5.6, sweeping landscape.`,

  hk_banquet_gold:
    `${COMMERCIAL_CONTEXT}Transform the entire scene into Hong Kong top-tier Cantonese banquet aesthetic (Fook Lam Moon / Lung King Heen level). Replace surface with pristine white tablecloth with delicate gold trim embroidery, replace background with softly blurred warm amber interior showing hints of gold filigree wall panels and red lacquered details. Add an elegant Chinese porcelain tea set and a pair of ivory chopsticks with gold tips as subtle props. Warm golden chandelier lighting from above (3000K), creating a bright luxurious atmosphere - the dish must be clearly lit and visible, NOT dark or moody. Rich gold and deep red color palette, Michelin banquet magazine aesthetic, business-entertainment dining class. ${PRESERVE_SUBJECT}${FACE_LOCK} ${CAM_DEFAULT} f/4, bright and luxurious.`,

  tw_retro_ad:
    `${COMMERCIAL_CONTEXT}Transform the entire scene into authentic 1970s-1980s Taiwanese print advertisement aesthetic. Replace background with a warmly-lit vintage Taiwanese living room scene: floral-patterned fabric sofa in soft focus, terrazzo floor tiles, wooden venetian blinds with late afternoon golden sunlight creating dappled dramatic shadows, a glass of iced barley tea on a round wooden side table as prop. Warm sepia-amber color grading with slightly faded highlights, visible paper grain texture overlay, subtle film halation, Kodachrome film tones, soft edge vignetting. Looks like a scanned vintage magazine page from 1975 Taiwan. Nostalgic warm mood. ${PRESERVE_SUBJECT}${FACE_LOCK} ${CAM_DEFAULT} f/2.8, warm vintage film look.`,

  food_drama:
    `${COMMERCIAL_CONTEXT}Transform the scene into a Michelin 3-star restaurant advertisement. Replace background with deep charcoal gradient (not pure black), replace surface with dark slate. Add dramatic single overhead spotlight from above, atmospheric steam wisps rising from food, warm golden rim light on dish edges. The food must remain BRIGHT and clearly visible. Keep all food, dishes, and hands EXACTLY unchanged in position and details. ${CAM_DEFAULT} f/4, dramatic but well-lit.`,

  food_japanese:
    `${COMMERCIAL_CONTEXT}Transform the scene into Japanese kappo fine dining aesthetic. Replace surface with dark charcoal aged stone slate with rough texture, replace background with deep shadowed wood wall. Soft single-source cool side lighting 4000K, wabi-sabi minimal atmosphere. Keep all food, dishes, and hands EXACTLY unchanged. ${CAM_MACRO}`,

  food_cantonese:
    `${COMMERCIAL_CONTEXT}Transform the scene into Hong Kong Cantonese banquet aesthetic. Replace surface with dark lacquered rosewood table, replace background with deep red-gold wall with subtle abstract pattern. Warm amber pendant light from above creating rich golden glow, traditional opulent atmosphere. Keep all food, dishes, and hands EXACTLY unchanged. ${CAM_DEFAULT}`,

  food_korean:
    `${COMMERCIAL_CONTEXT}Transform the scene into Korean BBQ restaurant atmosphere. Replace surface with dark volcanic stone or cast iron plate, replace background with moody dark wood with hint of charcoal grill glow. Dramatic warm backlight from behind creating orange-red rim glow on food edges, atmospheric steam. Keep all food, dishes, and hands EXACTLY unchanged. Shot on Nikon Z9 NIKKOR Z 35mm f/1.8 S.`,

  food_taiwanese:
    `${COMMERCIAL_CONTEXT}Transform the scene into Taiwanese traditional comfort food aesthetic. Replace surface with warm aged teak wood table with natural grain, replace background with blurred vintage tile wall or wooden partition. Soft 3800K tungsten overhead light creating warm nostalgic glow, traditional ceramic tea cup and chopsticks as props. Keep all food, dishes, and hands EXACTLY unchanged. Shot on Nikon Z9 NIKKOR Z 35mm f/1.8 S.`,

  food_french:
    `${COMMERCIAL_CONTEXT}Transform the scene into French fine dining editorial. Replace surface with deep navy blue linen tablecloth, replace background with soft blurred restaurant ambience. Add silver cutlery and crystal glassware as props, soft cool natural window light 5500K creating clean elegant atmosphere. Keep all food, dishes, and hands EXACTLY unchanged. ${CAM_MACRO}`,

  food_outdoor:
    `${COMMERCIAL_CONTEXT}Transform the scene into an outdoor golden hour picnic. Replace surface with rustic wooden board or checkered cloth on grass, replace background with natural green meadow with warm sunset backlight creating halo. Rustic wooden utensil props. Keep all food, dishes, and hands EXACTLY unchanged. Shot on Nikon Z9 NIKKOR Z 85mm f/1.4 S, f/2, shallow depth.`,

  food_bright:
    `${COMMERCIAL_CONTEXT}Transform the scene into bright Nordic brunch aesthetic. Replace surface with clean white Carrara marble, replace background with bright white wall with soft natural morning window light 6000K streaming from the side. Add fresh herb sprigs and citrus slice props. Keep all food, dishes, and hands EXACTLY unchanged. Shot on Nikon Z9 NIKKOR Z 35mm f/1.8 S.`,
};

// ══ 狀態 ══
let AM = { w:1080, h:1080, scriptIdx:null };
let PR_BG_IMG  = null;
let PR_MODE    = 'product_shot';
let TEXT_ALIGN = 'left';
let TEXT_FONT  = 'bold';  // v9.1: bold / serif / light / script
let CANVAS_TAINTED = false;
let LAST_BLOB_SIZE = 0;

const BLACK_IMAGE_THRESHOLD = 30000;

function openAdMaker(idx) {
  PR_BG_IMG = null; PR_MODE = 'product_shot';
  CANVAS_TAINTED = false;
  setPrStatus('', '');
  document.querySelectorAll('.pr-mode-btn').forEach(b => b.classList.remove('on'));
  document.querySelector('.pr-mode-btn')?.classList.add('on');
  ['prSceneSection','prVirtualSection'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = id === 'prSceneSection' ? 'block' : 'none';
  });

  let initialTitle = '';
  if (idx === -1 || idx == null || !window.S.scripts?.[idx]) {
    AM.scriptIdx = -1;
  } else {
    const s = window.S.scripts[idx];
    AM.scriptIdx = idx;
    initialTitle = s.hook?.script || '';
  }

  document.getElementById('amTitle').value = initialTitle;
  document.getElementById('prCustomPrompt').value = '';
  renderAmPhotoRow();
  document.getElementById('adMakerModal').style.display = 'block';
  renderAdCanvas();
}

function closeAdMaker() {
  document.getElementById('adMakerModal').style.display = 'none';
}

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
             border:2px solid ${isSelected?'#C9A665':'rgba(255,255,255,0.1)'};background:var(--bg4);
             display:flex;align-items:center;justify-content:center;">${imgHtml}</div>`;
  }).join('');
  if (nameEl) nameEl.textContent = window.S.selPhoto !== null
    ? ('✅ ' + window.S.photos[window.S.selPhoto].name)
    : '← 點選上方照片';
}

function selectPhotoInAM(i) {
  window.S.selPhoto = i; PR_BG_IMG = null;
  CANVAS_TAINTED = false;
  renderAmPhotoRow(); renderAssets(); renderAdCanvas();
}

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

// v9.1: 字體風格切換
function setTextFont(fontKey, btn) {
  TEXT_FONT = fontKey;
  ['fontBold','fontSerif','fontLight','fontScript'].forEach(id => document.getElementById(id)?.classList.remove('on'));
  btn.classList.add('on');
  renderAdCanvas();
}

// v9.1: 字體風格對應 CSS font-family + 粗細
function getFontStyle() {
  switch(TEXT_FONT) {
    case 'serif':
      // 精品細 Serif (LACEZ/RADESIGN/精品內衣)
      return {
        family: "'Playfair Display', 'Cormorant Garamond', 'Noto Serif TC', serif",
        weight: 500,
        letterSpacing: 0.02
      };
    case 'light':
      // 文青細 Sans (MOZ/設計家電)
      return {
        family: "'Inter', 'Noto Sans TC', sans-serif",
        weight: 300,
        letterSpacing: 0.05
      };
    case 'script':
      // 手寫裝飾 (古早味/手作)
      return {
        family: "'Caveat', 'Noto Serif TC', cursive",
        weight: 700,
        letterSpacing: 0
      };
    case 'bold':
    default:
      // 粗黑體 (電商/快消/巧福/旺味)
      return {
        family: "'Noto Sans TC', sans-serif",
        weight: 900,
        letterSpacing: 0
      };
  }
}

function setPrStatus(msg, color) {
  const el = document.getElementById('prStatus');
  if (el) { el.textContent = msg; el.style.color = color || 'var(--t3)'; }
}

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

async function submitFluxAndCheckBlob(scenePrompt, paddedBase64) {
  const imageUrl = await uploadToFal(paddedBase64);

  const submitData = await callWorker({
    action: 'flux_kontext_submit',
    imageUrl,
    prompt: scenePrompt
  });
  if (!submitData.ok) throw new Error(submitData.error || '提交失敗');

  const result = await pollUntilDone(submitData.requestId, submitData.endpoint, 120000, submitData.responseUrl, submitData.statusUrl);

  if (result.status === 'TIMEOUT' || result.status === 'FAILED') {
    throw new Error(result.error || '生成失敗');
  }

  const falUrl = result.imageBase64 || result.imageUrl;
  if (!falUrl) throw new Error('未回傳圖片資料');

  if (falUrl.startsWith('data:')) {
    return { ok: true, imageUrl: falUrl, blobSize: 0 };
  }

  try {
    const resp = await fetch(falUrl, { mode: 'cors' });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const blob = await resp.blob();
    console.log('[v9.1] 下載圖片, size:', blob.size, 'type:', blob.type);
    LAST_BLOB_SIZE = blob.size;

    if (blob.size < BLACK_IMAGE_THRESHOLD) {
      console.warn('[v9.1] ⚠️ 偵測到黑圖! size:', blob.size, '< 門檻', BLACK_IMAGE_THRESHOLD);
      return { ok: false, reason: 'BLACK_IMAGE', blobSize: blob.size };
    }

    const blobUrl = URL.createObjectURL(blob);
    return { ok: true, imageUrl: blobUrl, blobSize: blob.size, originalUrl: falUrl };
  } catch(fetchErr) {
    console.warn('[v9.1] fetch 檢查失敗,使用原 URL:', fetchErr.message);
    return { ok: true, imageUrl: falUrl, blobSize: -1 };
  }
}

async function applyPhotoroomBg() {
  const photo = window.S.selPhoto !== null ? window.S.photos[window.S.selPhoto] : null;
  if (!photo) { setPrStatus('⚠️ 請先選擇照片！', 'var(--red)'); return; }
  const imgSrc = photo.src || photo.thumb;
  if (!imgSrc) { setPrStatus('⚠️ 照片尚未載入', 'var(--red)'); return; }

  const btn = document.getElementById('prApplyBtn');
  btn.disabled = true; btn.textContent = '⏳ AI 處理中...';

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
      CANVAS_TAINTED = false;
      await renderAdCanvasWithPR();
      finishProgress(interval);
      setPrStatus('✅ MD 試穿完成！', 'var(--mint)');
    } catch(e) { failProgress(interval, e.message); }
    return;
  }

  if (PR_MODE === 'product_shot') {
    const interval = startProgress(30000);
    try {
      const blob = await urlToBlob(imgSrc);
      const base64 = await blobToBase64(blob);
      const paddedBase64 = await padImageTo1080(base64);

      const sceneKey = document.getElementById('prSceneSection')?.dataset?.scene || 'studio_white';
      const customPrompt = document.getElementById('prCustomPrompt')?.value?.trim();
      const scenePrompt = customPrompt || PRODUCT_SCENES[sceneKey] || PRODUCT_SCENES.studio_white;

      setPrStatus('🎨 AI 情境生成中...', 'var(--t3)');

      let result = await submitFluxAndCheckBlob(scenePrompt, paddedBase64);

      if (!result.ok && result.reason === 'BLACK_IMAGE') {
        console.warn('[v9.1] 第一次被擋,自動重試中...');
        setPrStatus('🔄 內容審查擋下,重試中...', '#E8C878');
        result = await submitFluxAndCheckBlob(scenePrompt, paddedBase64);
      }

      if (!result.ok && result.reason === 'BLACK_IMAGE') {
        console.error('[v9.1] 兩次都被擋,顯示警示');
        finishProgress(interval);
        setPrStatus('⚠️ AI 內容審查擋下,請改用真人試穿或換場景', 'var(--red)');
        showBlackImageWarning(result.blobSize);
        return;
      }

      PR_BG_IMG = result.imageUrl;
      CANVAS_TAINTED = false;
      await renderAdCanvasWithPR();
      finishProgress(interval);

      if (result.blobSize > 0) {
        setPrStatus(`✅ AI 情境生成完成！(${Math.round(result.blobSize/1024)} KB)`, 'var(--mint)');
      } else {
        setPrStatus('✅ AI 情境生成完成！', 'var(--mint)');
      }
    } catch(e) { failProgress(interval, e.message); }
  }
}

function showBlackImageWarning(blobSize) {
  const canvas = document.getElementById('adCanvas');
  if (!canvas) return;
  canvas.width = AM.w; canvas.height = AM.h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  const grad = ctx.createLinearGradient(0,0,0,AM.h);
  grad.addColorStop(0, '#1A1510');
  grad.addColorStop(1, '#0A0A0B');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, AM.w, AM.h);

  ctx.fillStyle = '#C9A665';
  ctx.font = '900 140px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('⚠️', AM.w/2, AM.h/2 - 150);

  ctx.fillStyle = '#FAFAFA';
  ctx.font = '900 44px "Noto Sans TC",sans-serif';
  ctx.fillText('AI 內容審查擋下了這張圖', AM.w/2, AM.h/2 - 50);

  ctx.fillStyle = '#B8B4A8';
  ctx.font = '500 22px "Noto Sans TC",sans-serif';
  const kbSize = blobSize > 0 ? `（Flux 回傳 ${Math.round(blobSize/1024)} KB 黑圖）` : '';
  if (kbSize) ctx.fillText(kbSize, AM.w/2, AM.h/2 - 10);

  ctx.fillStyle = '#C9A665';
  ctx.font = '900 26px "Noto Sans TC",sans-serif';
  ctx.fillText('建議改用:', AM.w/2, AM.h/2 + 60);

  ctx.fillStyle = '#E8C878';
  ctx.font = '500 22px "Noto Sans TC",sans-serif';
  const suggestions = [
    '👗  改用「AI 真人試穿」(內衣類推薦)',
    '🏝️  換海邊場景: 炎熱夏日/熱帶渡假/沖繩海邊',
    '🔄  或換一張商品照再試'
  ];
  suggestions.forEach((s, i) => {
    ctx.fillText(s, AM.w/2, AM.h/2 + 110 + i * 42);
  });

  ctx.fillStyle = '#6A6860';
  ctx.font = '400 16px "Noto Sans TC",sans-serif';
  ctx.fillText('已自動重試一次,AI 仍判定此組合為敏感內容', AM.w/2, AM.h - 60);
}

async function loadImageSmart(src) {
  if (src.startsWith('data:') || src.startsWith('blob:')) {
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = () => {
        if (img.naturalWidth === 0) reject(new Error('圖片大小為 0'));
        else resolve();
      };
      img.onerror = () => reject(new Error('img 載入失敗'));
      img.src = src;
    });
    return { img, tainted: false };
  }

  try {
    const response = await fetch(src, { mode: 'cors' });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const blob = await response.blob();
    if (blob.size < 500) throw new Error('圖片太小');
    const blobUrl = URL.createObjectURL(blob);
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = () => {
        if (img.naturalWidth === 0) {
          URL.revokeObjectURL(blobUrl);
          reject(new Error('naturalWidth 為 0'));
        } else resolve();
      };
      img.onerror = () => {
        URL.revokeObjectURL(blobUrl);
        reject(new Error('blob img 載入失敗'));
      };
      img.src = blobUrl;
    });
    return { img, tainted: false, blobUrl };
  } catch(e) {
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = () => {
        if (img.naturalWidth === 0) reject(new Error('naturalWidth 為 0'));
        else resolve();
      };
      img.onerror = () => reject(new Error('img 直接載入也失敗'));
      img.src = src;
    });
    return { img, tainted: true };
  }
}

async function renderAdCanvas() {
  const canvas = document.getElementById('adCanvas');
  if (canvas) canvas.style.display = 'block';
  if (PR_BG_IMG) { await renderAdCanvasWithPR(); return; }
  if (!canvas) return;
  canvas.width = AM.w; canvas.height = AM.h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  const title = document.getElementById('amTitle')?.value || '';
  const photo = window.S.selPhoto !== null ? window.S.photos[window.S.selPhoto] : null;

  if (photo && (photo.src || photo.thumb)) {
    try {
      const { img, tainted } = await loadImageSmart(photo.src || photo.thumb);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, AM.w, AM.h);
      const scale = Math.min(AM.w/img.width, AM.h/img.height);
      ctx.drawImage(img,
        Math.round((AM.w-img.width*scale)/2),
        Math.round((AM.h-img.height*scale)/2),
        img.width*scale, img.height*scale);
      if (tainted) CANVAS_TAINTED = true;
    } catch(e) {
      drawBgFallback(ctx);
    }
  } else {
    drawBgFallback(ctx);
  }
  drawOverlay(ctx, title, getAccentColor());
}

async function renderAdCanvasWithPR() {
  const canvas = document.getElementById('adCanvas');
  if (!canvas) return;
  canvas.width = AM.w; canvas.height = AM.h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  const title = document.getElementById('amTitle')?.value || '';
  const isTryon = PR_MODE === 'kling_tryon';
  ctx.fillStyle = '#1a1a1a'; ctx.fillRect(0, 0, AM.w, AM.h);

  try {
    const { img, tainted } = await loadImageSmart(PR_BG_IMG);
    if (tainted) CANVAS_TAINTED = true;

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
  } catch(e) {
    console.error('[v9.1] render 失敗:', e.message);
    drawBgFallback(ctx);
    ctx.fillStyle = '#C9A665';
    ctx.font = '900 32px "Noto Sans TC",sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⚠️ 圖片載入失敗', AM.w/2, AM.h/2 - 20);
    ctx.font = '400 20px "Noto Sans TC",sans-serif';
    ctx.fillStyle = '#F0E0D0';
    ctx.fillText('請重新生成或重新整理頁面', AM.w/2, AM.h/2 + 30);
  }

  drawOverlay(ctx, title, getAccentColor());
}

function getAccentColor() {
  const brand = window.BRANDS.find(b => b.id === window.S.brandId);
  return { gold:'#C9A665', red:'#E8603A', sky:'#5BC8C8', mint:'#7ED4B0', purple:'#B89ED4', brown:'#C8A870' }[brand?.navColor] || '#C9A665';
}

function drawBgFallback(ctx) {
  const grad = ctx.createLinearGradient(0,0,AM.w,AM.h);
  grad.addColorStop(0,'#14141a'); grad.addColorStop(1,'#0a0a0b');
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

  // v9.1: 使用字體風格
  const fontStyle = getFontStyle();
  ctx.font = `${fontStyle.weight} ${baseFontSize}px ${fontStyle.family}`;
  ctx.textAlign = align;

  const tx = align==='left' ? Math.round(W*0.07) : align==='right' ? Math.round(W*0.93) : Math.round(W/2);
  const lines = autoLines(ctx, title, W*0.86);
  const lineH = baseFontSize * (TEXT_FONT === 'script' ? 1.1 : 1.18);
  const ty = Math.round(H*textYPct) - (lines.length-1)*lineH;
  lines.forEach((line, i) => {
    ctx.shadowColor='rgba(0,0,0,0.85)'; ctx.shadowBlur=20; ctx.shadowOffsetY=4;
    ctx.fillStyle='#FFFFFF';
    // v9.1: Serif/Light 字體加字距
    if (fontStyle.letterSpacing > 0 && ctx.letterSpacing !== undefined) {
      ctx.letterSpacing = `${fontStyle.letterSpacing}em`;
    }
    ctx.fillText(line, tx, ty+i*lineH);
  });
  ctx.shadowColor='transparent'; ctx.shadowBlur=0;
  if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '0em';
}

function downloadAd() {
  const canvas = document.getElementById('adCanvas');
  const brand = window.BRANDS.find(b => b.id === window.S.brandId);
  const filename = `${brand?.name||'ad'}_${window.S.prod?.name||'img'}.jpg`.replace(/[^\w\u4e00-\u9fff\-_.]/g,'_');

  try {
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    link.click();
    if (window._driveToken) uploadAdToDrive(canvas, filename);
  } catch(e) {
    if (PR_BG_IMG && !PR_BG_IMG.startsWith('data:')) {
      const msg = '因瀏覽器安全限制無法直接下載\n將開啟圖片,請右鍵「另存圖片」';
      if (confirm(msg)) window.open(PR_BG_IMG, '_blank');
    } else {
      alert('下載失敗,請稍後重新生成一次');
    }
  }
}

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

async function padImageTo1080(base64) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const w0 = img.width, h0 = img.height;
      const ratio = w0 / h0;

      if (ratio >= 0.85 && ratio <= 1.15 && Math.min(w0, h0) >= 1000) {
        resolve(base64);
        return;
      }

      const SIZE = 1080;
      const canvas = document.createElement('canvas');
      canvas.width = SIZE; canvas.height = SIZE;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      let fillColor = '#ffffff';
      try {
        const tmpCanvas = document.createElement('canvas');
        tmpCanvas.width = w0; tmpCanvas.height = h0;
        const tmpCtx = tmpCanvas.getContext('2d', { willReadFrequently: true });
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
