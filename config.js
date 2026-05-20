// ══════════════════════════════════════════
//  config.js — 常數、URLs、品牌資料、顏色對照
//  v10.5: CMAP 動態擴充 + getColor warning
//    [v10.5] 新增 registerBrandPackColors()  
//             - brand_packs 的 primary_color 自動註冊進 CMAP
//             - 規則:CMAP[`brand_${pack_key}`] = { c: HEX, bg: HEX+22 }
//    [v10.5] getColor() 找不到 key 改 console.warn 不再靜默 fallback
//    [v10.5] 福臨門 navColor 改成 brand_flm(對應 brand_packs.pack_key)
// ══════════════════════════════════════════

// ★ 修正 GAS_URL
const GAS_URL = 'https://script.google.com/macros/s/AKfycbzJgPVlBS6qJV9zmxJQyPTrwn_jHY11AKOHfwiKVPhtHLUWJNjEVsFpWMd-Mk-RtZhy5w/exec';
const GAS_PASSWORD = 'raby2026';
const CF_WORKER_URL = 'https://photoroom-proxy.calm-sunset-6b66.workers.dev';
const GOOG_CLIENT_ID = '513919357376-g34jg6d1bqkj6pg8t27nsdrj3vd93d3e.apps.googleusercontent.com';
const GOOG_SCOPE = 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file';
const ADMIN_EMAIL = 'cyndi04592@gmail.com';

// ══ 共用狀態(所有模組共享)══
window.S = {
  brandId: null, subId: null, prod: null,
  photos: [], videos: [],
  selPhoto: null, selVideo: null,
  scripts: [], delivers: [],
  openBrand: null
};

window.BRANDS = [];
window.BRAND_FOLDERS = {};

// ══ 顏色對照表(v10.5: 改成 let 讓 brand_packs 可動態注入)══
let CMAP = {
  gold:   { c:'var(--gold)',   bg:'var(--gold2)' },
  red:    { c:'#FF8099',       bg:'var(--red2)' },
  sky:    { c:'var(--sky)',    bg:'var(--sky2)' },
  mint:   { c:'var(--mint)',   bg:'var(--mint2)' },
  purple: { c:'var(--purple)', bg:'var(--purple2)' },
  brown:  { c:'#C8A870',       bg:'rgba(200,168,112,0.15)' }
};

// ★ v10.5:把 brand_packs 的 primary_color 動態註冊成 CMAP key
//   呼叫時機:admaker.js 從 GAS 撈完 brand_packs 後立刻註冊
//   規則:CMAP[`brand_${pack_key}`] = { c: HEX, bg: HEX+'22'(透明度 13%) }
//   範例:brand_packs sheet 有 pack_key='chiaofu', primary_color='#3D5A3F'
//        → CMAP['brand_chiaofu'] = { c:'#3D5A3F', bg:'#3D5A3F22' }
//        → brands sheet 寫 navColor='brand_chiaofu' 就會生效
function registerBrandPackColors(packs) {
  if (!Array.isArray(packs)) return 0;
  let registered = 0;
  for (const p of packs) {
    if (!p.pack_key || !p.primary_color) continue;
    
    // 從 primary_color 字串中找出 HEX(可能是純 HEX 或長字串內含 HEX)
    const hexMatch = String(p.primary_color).match(/#[0-9A-Fa-f]{6}/);
    if (!hexMatch) {
      console.warn(`[CMAP] brand_pack "${p.pack_key}" 的 primary_color 找不到 HEX 色碼`, p.primary_color);
      continue;
    }
    const hex = hexMatch[0];
    const key = `brand_${p.pack_key}`;
    CMAP[key] = {
      c: hex,
      bg: hex + '22',  // 加透明度 alpha=0x22 = 13%
    };
    registered++;
  }
  if (registered > 0) {
    console.log(`[CMAP] ✅ 從 brand_packs 動態註冊了 ${registered} 個品牌專屬色:`,
      Object.keys(CMAP).filter(k => k.startsWith('brand_')));
  }
  return registered;
}

// ★ v10.5:getColor 加 warning,不再靜默 fallback 到 gold
//   防止 GAS 寫了不存在的 navColor 卻看不出來
function getColor(key) {
  if (!key) return CMAP.gold;
  if (CMAP[key]) return CMAP[key];
  // 不在 CMAP 裡 → 警告 + fallback
  console.warn(`[CMAP] 找不到顏色 key: "${key}",fallback 到 gold。請檢查 GAS brands.navColor 或 brand_packs.pack_key 是否對得上`);
  return CMAP.gold;
}
// ★ 根治 CMAP 時序問題:config.js 載入時自己先 fetch brand_packs 註冊 CMAP
//   原本 registerBrandPackColors 只在開 AdMaker 時跑,導致主畫面載入時
//   brand_xxx 還沒註冊 → getColor 噴 warning + fallback gold
//   這段讓 CMAP 一開始就齊全,不依賴任何其他檔的 init 流程
(async function autoRegisterBrandPackColors() {
  try {
    const resp = await fetch(CF_WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'gas_brand_packs_fetch', password: GAS_PASSWORD }),
    });
    const data = await resp.json();
    if (data && data.ok && Array.isArray(data.packs) && data.packs.length > 0) {
      registerBrandPackColors(data.packs);
      console.log('[CMAP] config.js 啟動時已預先註冊品牌色');
    }
  } catch (e) {
    console.warn('[CMAP] config.js 啟動預註冊失敗(不影響功能,AdMaker 開啟時會再註冊):', e.message);
  }
})();

// ★ 品牌資料(含新增香港福臨門)
//   v10.5: 福臨門 navColor 改成 brand_flm(對應未來 brand_packs)
const LOCAL_FALLBACK_DATA = {
  brands: [
    { id:'cf',  name:'巧福健康家電', icon:'🏠', navColor:'gold',   soul:'溫暖居家、守護家人健康、實用親切、台灣品牌精神。', adStyle:'溫暖生活感、家人守護、療癒放鬆、痛點直擊', hashtags:'#居家健康 #巧福 #台灣品牌' },
    { id:'ww',  name:'旺味米香腸',   icon:'🌾', navColor:'red',    soul:'全台首創米香腸,傳承阿公家訓。', adStyle:'台灣古早味、手工真材實料、烤肉聚餐場景', hashtags:'#旺味米香腸 #米香腸 #台灣豬' },
    { id:'ly',  name:'琉宇醬選',     icon:'🫙', navColor:'mint',   soul:'琉宇醬選主理頂級進口醬料。', adStyle:'精緻質感、食材溯源、料理升級', hashtags:'#琉宇醬選 #好滋好滋 #PASSERI' },
    { id:'moz', name:'MOZ瑞典駝鹿',  icon:'🦌', navColor:'sky',    soul:'瑞典駝鹿DNA,用北歐色彩與趣味設計讓日常更輕鬆愉快。', adStyle:'北歐輕鬆感、顏值日常、戶外露營風、多色搭配', hashtags:'#MOZ瑞典駝鹿 #北歐設計 #洞洞鞋 #雲朵包' },
    { id:'ka',  name:'空瑪那',        icon:'🎯', navColor:'purple', soul:'空瑪那是台灣頂尖身心靈國際學院,由宸甄老師創立。', adStyle:'療癒禪意、國際專業、身心靈覺醒、名人背書', hashtags:'#空瑪那 #頌缽療癒 #瑜珈師資 #冥想' },
    { id:'la',  name:'LACEZ',         icon:'💎', navColor:'mint',   soul:'LACEZ是台灣MIT內衣品牌,工廠直接賣給消費者。', adStyle:'閨蜜親切、精品感平價、MIT驕傲、穿出自信', hashtags:'#LACEZ #台灣MIT #好內衣不貴 #無鋼圈' },
    { id:'ra',  name:'RADESIGN',      icon:'🏷️', navColor:'gold',   soul:'RADESIGN專營正版品牌鞋Outlet,百分百原廠授權。', adStyle:'直白促銷、正版保證、超值撿漏、蝦皮熱銷', hashtags:'#RADESIGN #正版outlet #品牌鞋特賣 #蝦皮' },
    // ★ v10.5:福臨門 navColor 改 brand_flm(對應 brand_packs 的 pack_key)
    { id:'flm', name:'香港福臨門',    icon:'🏮', navColor:'brand_flm',
      soul:'1948年創立於香港灣仔,近八十載粵菜傳承。米其林一星連續七年、富豪飯堂、中餐少林寺。每日新鮮食材、傳統手工烹製、百道工序成就每一味。',
      adStyle:'高端粵菜質感、傳承匠心、米其林星級、香港在地情懷、簡體中文為主(小紅書/抖音)、港味文案風格、不涉及家族歷史',
      hashtags:'#福臨門 #FookLamMoon #香港美食 #米其林 #粵菜 #富豪飯堂 #香港必吃' }
  ],
  products: [],
  folders: [
    { brandId:'cf',  photoFolderId:'1tHV_loHiUcZx8MVrpnUwTWUge74GIwE7', videoFolderId:'132xtz0XebJV-gGXObV4UtanmwyZd9Awc' },
    { brandId:'ww',  photoFolderId:'1dhCLr4tKrfV0RLHp454pzyJjytZFb92m', videoFolderId:'12LsKHCZQkDhT_FhzYWFw7rN4KJyvAD46' },
    { brandId:'ly',  photoFolderId:'1u9n-NpnQjjzU3GnpT15ERanCEky_m6bP', videoFolderId:'1lSvqYV28lgqN2xZ6640glMTssYhUKMoD' },
    { brandId:'moz', photoFolderId:'1qEsp9ifgBlYhAViOYBiou0u0mbABs1CE', videoFolderId:'1FYErl24zN_Cp2I7T3hSiv0pxqxU6QbYa' },
    { brandId:'ka',  photoFolderId:'1FX3-68mUz84tmWXI0BGnoQhKKv8JkpPW', videoFolderId:'13xC4onSRLQTB9J9wTot24bdPI9Yc2kj4' },
    { brandId:'la',  photoFolderId:'1Yt3NoT_ryBlj-jVvG7-sWm-UCGYQchxy', videoFolderId:'18LPs4wV2kcnT8pcJRUtm7hDax7nId5pD' },
    { brandId:'ra',  photoFolderId:'1ZJ1KVG6ae0WNG55eF4kwVsycozT6NmJM', videoFolderId:'1kUT_a5AKn71UgU1bD0-t_HR3W9OhqMY6' },
    { brandId:'flm', photoFolderId:'', videoFolderId:'' }
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
  },
  flm: {
    studio:    'classic chinese restaurant interior, red lacquer and gold accents, elegant Hong Kong fine dining, professional food photography, dark moody background',
    lifestyle: 'hong kong luxury private dining room, round table, traditional chinese setting, warm chandelier light, VIP atmosphere',
    nature:    'hong kong harbour view at golden hour, victoria peak backdrop, upscale outdoor dining terrace',
    forest:    'chinese garden courtyard, bamboo, stone lanterns, traditional elegant atmosphere',
    food:      'authentic cantonese fine dining table setting, ivory chopsticks, premium porcelain, warm light, traditional chinese restaurant ambiance',
    kitchen:   'professional cantonese kitchen, wok fire blazing, traditional chinese cooking, authentic hong kong restaurant',
    luxury:    'dark black lacquer surface, gold chopsticks, premium cantonese cuisine plating, michelin star restaurant vibes, elegant and prestigious',
    marble:    'white jade marble surface, traditional chinese porcelain bowl, soft elegant studio lighting, premium hongkong brand',
    outdoor:   'hong kong city skyline blur, peak tram view, upscale rooftop terrace dining, golden hour',
    beach:     'hong kong aberdeen harbour, traditional fishing boats bokeh, upscale waterfront dining',
    minimal:   'pure black background, dramatic single spotlight, premium cantonese dish presentation, michelin star plating',
    night:     'hong kong neon night, wanchai atmosphere, classic chinese restaurant glowing facade, iconic hongkong',
    garden:    'traditional chinese garden, peonies, koi pond, elegant scholar rock, premium setting',
    camping:   'private yacht deck, hong kong harbour, sunset, luxury cantonese dining experience',
    office:    'hong kong business lunch setting, private room, premium chopsticks, formal cantonese hospitality',
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
  // ★ 相容兩種格式:GAS 回的是 { ok, data:{ brands } },舊呼叫端可能直接傳 { brands }
  //   收到外層帶 .data.brands 就自動挖一層,避免拿不到資料掉進 LOCAL_FALLBACK_DATA
  if (data && data.data && data.data.brands && !data.brands) {
    data = data.data;
  }
  const { brands, products, folders } = data;
  window.BRAND_FOLDERS = {};
  (folders || []).forEach(f => {
    window.BRAND_FOLDERS[f.brandId] = { photo: f.photoFolderId, video: f.videoFolderId };
  });
  const prodByBrand = {};
  (products || []).forEach(p => {
    if (!prodByBrand[p.brandId]) prodByBrand[p.brandId] = {};
    const key = p.subId;
    if (!prodByBrand[p.brandId][key]) prodByBrand[p.brandId][key] = {
      id: p.subId, name: p.subName, color: p.subColor || 'gold',
      soul: p.subSoul, adStyle: p.subAdStyle, hashtags: p.subHashtags, prods: []
    };
    if (p.prodId) {
      prodByBrand[p.brandId][key].prods.push({ id: p.prodId, name: p.prodName, tag: p.prodTag, spec: p.spec || '', feature: p.feature || '' });
    }
  });
  window.BRANDS = (brands || []).map(b => ({
    id: b.id, name: b.name, icon: b.icon || '🏷️', navColor: b.navColor || 'gold',
    soul: b.soul || '', adStyle: b.adStyle || '', hashtags: b.hashtags || '',
    subs: Object.values(prodByBrand[b.id] || {})
  }));
}
