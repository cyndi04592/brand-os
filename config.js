// ══════════════════════════════════════════
//  config.js — 常數、URLs、品牌資料、顏色對照
// ══════════════════════════════════════════

const GAS_URL = 'https://script.google.com/macros/s/AKfycbwc55f7UYP0_S4I4yhPkBx2_fRfbYY6m42yzzWQHqKeLnSlZ9hMGBBeMoTOI7yFG4kcZg/exec';
const GAS_PASSWORD = 'raby2026';
const CF_WORKER_URL = 'https://photoroom-proxy.calm-sunset-6b66.workers.dev';
const GOOG_CLIENT_ID = '513919357376-g34jg6d1bqkj6pg8t27nsdrj3vd93d3e.apps.googleusercontent.com';
const GOOG_SCOPE = 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file';
const ADMIN_EMAIL = 'cyndi04592@gmail.com';

// ══ 共用狀態（所有模組共享）══
window.S = {
  brandId: null, subId: null, prod: null,
  photos: [], videos: [],
  selPhoto: null, selVideo: null,
  scripts: [], delivers: [],
  openBrand: null
};

window.BRANDS = [];
window.BRAND_FOLDERS = {};

// ══ 顏色對照表 ══
const CMAP = {
  gold:   { c:'var(--gold)',   bg:'var(--gold2)' },
  red:    { c:'#FF8099',       bg:'var(--red2)' },
  sky:    { c:'var(--sky)',    bg:'var(--sky2)' },
  mint:   { c:'var(--mint)',   bg:'var(--mint2)' },
  purple: { c:'var(--purple)', bg:'var(--purple2)' },
  brown:  { c:'#C8A870',       bg:'rgba(200,168,112,0.15)' }
};
function getColor(key) { return CMAP[key] || CMAP.gold; }

// ══ 本地備援資料（GAS 掛掉時使用）══
const LOCAL_FALLBACK_DATA = {
  brands: [
    { id:'cf',  name:'巧福健康家電', icon:'🏠', navColor:'gold',   soul:'溫暖居家、守護家人健康、實用親切、台灣品牌精神。', adStyle:'溫暖生活感、家人守護、療癒放鬆、痛點直擊', hashtags:'#居家健康 #巧福 #台灣品牌' },
    { id:'ww',  name:'旺味米香腸',   icon:'🌾', navColor:'red',    soul:'全台首創米香腸，傳承阿公家訓。', adStyle:'台灣古早味、手工真材實料、烤肉聚餐場景', hashtags:'#旺味米香腸 #米香腸 #台灣豬' },
    { id:'ly',  name:'琉宇醬選',     icon:'🫙', navColor:'mint',   soul:'琉宇醬選主理頂級進口醬料。', adStyle:'精緻質感、食材溯源、料理升級', hashtags:'#琉宇醬選 #好滋好滋 #PASSERI' }
  ],
  products: [],
  folders: [
    { brandId:'cf', photoFolderId:'1tHV_loHiUcZx8MVrpnUwTWUge74GIwE7', videoFolderId:'132xtz0XebJV-gGXObV4UtanmwyZd9Awc' },
    { brandId:'ww', photoFolderId:'1dhCLr4tKrfV0RLHp454pzyJjytZFb92m', videoFolderId:'12LsKHCZQkDhT_FhzYWFw7rN4KJyvAD46' },
    { brandId:'ly', photoFolderId:'1u9n-NpnQjjzU3GnpT15ERanCEky_m6bP', videoFolderId:'1lSvqYV28lgqN2xZ6640glMTssYhUKMoD' }
  ]
};

// ══ AD Maker 場景 Prompts ══
const BRAND_SCENE_PROMPTS = {
  lacez: {
    studio:    'pure white seamless studio backdrop, soft professional lighting, high-end lingerie product photography, minimal elegant, luxury intimate apparel brand',
    lifestyle: 'luxury boutique boudoir interior, soft morning light, silk sheets, premium feminine atmosphere, elegant intimate setting',
    nature:    'ethereal white garden, soft natural light, delicate flowers, romantic feminine atmosphere, premium quality feeling',
    forest:    'misty morning forest, dappled sunlight, dreamy soft bokeh, romantic natural setting, premium intimate brand',
    food:      'elegant marble vanity table, perfume bottles, rose petals, luxury feminine product styling',
    kitchen:   'luxury fashion boutique interior, white marble floor, rose gold accents, elegant fitting room, premium intimate apparel brand, soft warm lighting',
    luxury:    'deep navy velvet background, gold accent lighting, premium luxury product shot, high-end intimate fashion',
    marble:    'white Carrara marble surface, soft diffused studio light, minimal luxury lingerie photography, premium brand',
    outdoor:   'upscale rooftop terrace, city skyline blur, golden hour light, premium lifestyle brand atmosphere',
    beach:     'pristine white sand beach, turquoise water, soft golden light, luxury coastal lifestyle, premium intimate brand',
    minimal:   'soft gradient grey background, clean minimal studio, premium product photography, high-end fashion brand',
    night:     'candlelit luxury interior, warm intimate glow, premium boutique atmosphere, elegant feminine brand',
    garden:    'romantic English rose garden, soft afternoon light, delicate floral bokeh, luxury intimate brand lifestyle',
    camping:   'luxury spa interior, white towels, candles, soft ambient light, premium feminine wellness brand, serene elegant atmosphere',
    office:    'elegant vanity dressing table, perfume bottles, soft mirror lighting, luxury feminine brand, premium intimate apparel lifestyle',
    random:    null
  },
  cf: {
    studio:    'clean white studio, soft product photography lighting, minimal background, professional',
    lifestyle: 'cozy taiwanese family living room, warm evening lamp light, family atmosphere, soft bokeh',
    nature:    'fresh outdoor garden at dusk, green plants, warm sunset glow, natural breeze',
    forest:    'quiet forest path, moonlight filtering through trees, peaceful atmosphere',
    food:      'warm family dining table, evening meal setting, cozy home atmosphere',
    kitchen:   'cozy home kitchen, warm light, family cooking together, homey taiwanese interior',
    luxury:    'modern premium apartment interior, dark elegant tones, gold accent lighting',
    marble:    'clean marble surface, soft studio light, minimalist product photography',
    outdoor:   'suburban neighborhood at dusk, warm street lights, family community',
    beach:     'outdoor summer evening, open air, warm ambient light, relaxing family setting',
    minimal:   'soft gray gradient, minimal clean background, neutral tones',
    night:     'taiwanese bedroom at night, dim warm light, peaceful sleeping atmosphere',
    garden:    'taiwanese home garden, potted plants, warm porch light, summer evening',
    camping:   'outdoor camping at night, campfire glow, starry sky, family gathering',
    office:    'modern home office, clean desk setup, natural window light',
    random:    null
  },
  ww: {
    studio:    'clean white background, traditional taiwanese food photography, warm natural lighting',
    lifestyle: 'taiwanese family BBQ gathering, outdoor grill, joyful atmosphere',
    nature:    'outdoor picnic, sunny day, taiwanese countryside, fresh air food scene',
    forest:    'outdoor forest barbecue, campfire grill, rustic wooden table',
    food:      'sizzling grill plate, charcoal BBQ, smoke rising, authentic taiwanese street food',
    kitchen:   'traditional taiwanese kitchen, wooden cutting board, rustic home cooking',
    luxury:    'premium food presentation, elegant dark plate, fine dining interpretation',
    marble:    'white marble surface, artisan food styling, fresh ingredients',
    outdoor:   'vibrant taiwan night market, colorful vendor lights, busy food stalls',
    beach:     'outdoor beach BBQ, seaside grill party, summer evening',
    minimal:   'clean white plate, minimal food photography, soft natural light',
    night:     'taiwan night market at night, glowing lanterns, busy stalls',
    garden:    'outdoor garden barbecue, wooden deck, string lights',
    camping:   'camping BBQ scene, outdoor fire grill, nature background',
    office:    'casual office lunch, taiwanese takeout, warm approachable',
    random:    null
  },
  ly: {
    studio:    'elegant white studio, premium product photography, soft diffused lighting',
    lifestyle: 'upscale home dining, wine glass, sophisticated meal setting',
    nature:    'fresh herb garden, morning light, organic premium food sourcing',
    forest:    'dark forest, earthy tones, premium ingredient atmosphere',
    food:      'fine dining presentation, truffle, elegant restaurant style',
    kitchen:   'luxury kitchen, marble countertop, professional chef setup',
    luxury:    'black marble surface, gold spoon, dark moody lighting, premium',
    marble:    'white marble with gold veining, premium sauce bottle, elegant minimal',
    outdoor:   'upscale outdoor dining terrace, city view, evening ambiance',
    beach:     'mediterranean coastal dining, white tablecloth, sea view',
    minimal:   'pure white background, dramatic side lighting, luxury minimal',
    night:     'candlelit dinner, dark romantic atmosphere, fine dining',
    garden:    'flower garden dining, afternoon tea, elegant outdoor table',
    camping:   'glamping setup, premium outdoor dining, sophisticated',
    office:    'modern kitchen counter, premium sauce styling, food blogger',
    random:    null
  }
};

const PR_SCENE_PROMPTS = {
  studio:    'clean white studio background, minimal, professional product photography',
  lifestyle: 'cozy home interior, warm living room, natural light',
  nature:    'lush green nature, fresh botanical background, outdoor light',
  forest:    'dense forest path, morning light filtering through trees',
  food:      'elegant dining table, wooden surface, soft food photography lighting',
  kitchen:   'warm cozy kitchen interior, wooden countertop, soft morning light',
  luxury:    'black marble surface, gold accents, luxury dark background, premium',
  marble:    'white marble texture background, elegant veining, soft studio lighting',
  outdoor:   'urban city street background, modern architecture, outdoor natural light',
  beach:     'tropical beach, golden sand, turquoise ocean water, bright sunny day',
  minimal:   'soft gray gradient background, minimal clean studio, neutral tones',
  night:     'city night scene, neon lights, bokeh background, urban atmosphere',
  garden:    'beautiful flower garden, cherry blossoms, soft bokeh, spring light',
  camping:   'outdoor camping scene, campfire, forest trees, starry night sky',
  office:    'modern office interior, clean desk, professional environment',
  random:    null
};

const PR_RANDOM_PROMPTS = ['bright kitchen counter, morning light, fresh and clean'];

const FOOD_SCENE_PROMPTS = {
  bbq:           'sizzling BBQ grill background, charcoal fire, outdoor grilling, warm smoky tones',
  night_market:  'vibrant night market stall, colorful lights, lively street food',
  wooden_table:  'rustic wooden table, warm natural light, cozy food photography',
  white_plate:   'clean white plate, minimal white background, professional food photography',
  outdoor_picnic:'outdoor picnic, green grass, natural sunlight, casual food scene',
  street_food:   'busy street food scene, urban background, authentic local food culture'
};

function getBrandScenePrompt(scene) {
  const brandId = window.S.brandId || 'cf';
  const brandPrompts = BRAND_SCENE_PROMPTS[brandId] || BRAND_SCENE_PROMPTS.cf;
  if (scene === 'random') {
    const scenes = Object.keys(brandPrompts).filter(k => k !== 'random' && brandPrompts[k]);
    return brandPrompts[scenes[Math.floor(Math.random() * scenes.length)]];
  }
  return brandPrompts[scene] || PR_SCENE_PROMPTS[scene];
}

// ══ 工具函式 ══
function parseDriveId(raw) {
  if (!raw) return null;
  const m = raw.match(/(?:folders\/|id=)([a-zA-Z0-9_\-]{15,})/);
  if (m) return m[1];
  if (/^[a-zA-Z0-9_\-]{15,}$/.test(raw.trim())) return raw.trim();
  return null;
}

function buildDataFromSheets(data) {
  const { brands, products, folders } = data;
  window.BRAND_FOLDERS = {};
  folders.forEach(f => {
    window.BRAND_FOLDERS[f.brandId] = { photo: f.photoFolderId, video: f.videoFolderId };
  });
  const prodByBrand = {};
  products.forEach(p => {
    if (!prodByBrand[p.brandId]) prodByBrand[p.brandId] = {};
    const key = p.subId;
    if (!prodByBrand[p.brandId][key]) prodByBrand[p.brandId][key] = {
      id: p.subId, name: p.subName, color: p.subColor || 'gold',
      soul: p.subSoul, adStyle: p.subAdStyle, hashtags: p.subHashtags, prods: []
    };
    prodByBrand[p.brandId][key].prods.push({ id: p.prodId, name: p.prodName, tag: p.prodTag });
  });
  window.BRANDS = brands.map(b => ({
    id: b.id, name: b.name, icon: b.icon || '🏷️', navColor: b.navColor || 'gold',
    soul: b.soul || '', adStyle: b.adStyle || '', hashtags: b.hashtags || '',
    subs: Object.values(prodByBrand[b.id] || {})
  }));
}
