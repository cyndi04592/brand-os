// ════════════════════════════════════════════════════════════════════
//  Brand OS · KOL Studio v5.11.1 — Universal Scenes
//  通用場景庫(全品牌共用)+ 品牌專屬場景(cf/ka/flm/la/moz)
//
//  結構:
//   ▸ UNIVERSAL_POOL   : 5 個通用場景(所有品牌都能用)
//   ▸ BRAND_SCENES     : 品牌專屬場景(la/cf/ka/flm/moz)
//   ▸ BRAND_TYPE_ACTIONS : 15 類品牌動作模板
//
//  LACEZ DNA 設計原則:
//   1. 反 AI 完美:毛孔、底片顆粒、ISO 400-1600、35mm、手持 vlog
//   2. 禁用:perfect / flawless / studio / professional
//   3. 商品動作抽象化:用 {BRAND_ACTION} 變數
//
//  載入要求:kol.html 主 script 之前必須載入此檔
// ════════════════════════════════════════════════════════════════════

// 🌐 通用場景 pool(5 個 · 所有品牌共用)
const UNIVERSAL_POOL = {
  kitchen_morning: {
    label: '🥞 廚房晨光',
    hint: '晨光感 · 早起儀式',
    indoor: true, type: 'indoor',
    env_prompt: 'cozy home kitchen in early morning, soft natural sunlight through the window, wooden countertop with subtle lived-in clutter, 35mm film grain, handheld vlog feel, ISO 800, visible skin pores and peach fuzz',
    product_context_template: '{BRAND_ACTION} naturally placed on the kitchen counter while preparing the morning',
    mood_default: 'warm and unhurried', duration_default: 10,
  },
  cafe_afternoon: {
    label: '☕ 咖啡廳午後',
    hint: '文青氛圍 · me time',
    indoor: true, type: 'indoor',
    env_prompt: 'quiet independent cafe in afternoon, warm amber ambient lighting, wooden table with coffee cup and small notebook, soft background blur, handheld vlog feel, 35mm film grain, visible skin texture',
    product_context_template: '{BRAND_ACTION} casually on the cafe table while enjoying coffee alone',
    mood_default: 'relaxed and thoughtful', duration_default: 10,
  },
  outdoor_garden: {
    label: '🌿 戶外綠意',
    hint: '公園 / 花園 · 陽光感',
    indoor: false, type: 'outdoor',
    env_prompt: 'lush urban park or garden in golden hour, dappled sunlight through leaves, green foliage background, handheld vlog style, 35mm film grain',
    product_context_template: '{BRAND_ACTION} while taking a peaceful walk outdoors',
    mood_default: 'peaceful and refreshing', duration_default: 10,
  },
  urban_night: {
    label: '🌃 夜間街頭',
    hint: '霓虹城市 · 下班氛圍',
    indoor: false, type: 'outdoor',
    env_prompt: 'urban street at night, soft neon and shop lights reflecting on wet pavement, hint of passing cars bokeh, moody cinematic lighting, handheld vlog feel, 35mm, ISO 1600',
    product_context_template: 'carrying {BRAND_ACTION} after finishing work, neon reflecting on the bag',
    mood_default: 'cinematic and contemplative', duration_default: 10,
  },
  home_unboxing: {
    label: '📦 居家開箱',
    hint: '🌟 黃金樣本 · 走進→開箱→展示',
    indoor: true, type: 'indoor',
    env_prompt: 'modern minimal home living room with soft white curtains and natural window light, wooden desk or white sofa, package delivered on the surface, candid at-home vibe, handheld vlog feel, 35mm film grain, ISO 800, skin pores visible',
    product_context_template: 'walking in, sitting down, gently unboxing the package and revealing {BRAND_ACTION} with genuine excitement',
    mood_default: 'genuine and unhurried', duration_default: 15,
  },
  mountain_trail: {
    label: '⛰️ 登山步道',
    hint: '深山 / 熊出沒 · 戶外安全',
    indoor: false, type: 'outdoor',
    env_prompt: 'remote mountain hiking trail deep in dense forest wilderness, tall coniferous trees, misty rugged terrain, distant mountain peaks, isolated backcountry atmosphere where wildlife roams, overcast natural daylight, handheld documentary vlog style, 35mm film grain, ISO 400',
    product_context_template: 'pausing on the trail to {BRAND_ACTION}, alert and prepared in the wilderness',
    mood_default: 'alert and adventurous', duration_default: 10,
  },
  dept_store: {
    label: '🛍️ 精品百貨',
    hint: '明亮櫥窗 · 大理石高級感',
    indoor: true, type: 'indoor',
    env_prompt: 'upscale department store interior, polished marble floors, bright elegant display windows, soft luxury lighting, escalators and glossy counters in soft background bokeh, no visible brand logos or signage, handheld vlog feel, 35mm film grain, ISO 400',
    product_context_template: 'browsing through the store and {BRAND_ACTION} with a refined relaxed mood',
    mood_default: 'elegant and leisurely', duration_default: 10,
  },
  airport: {
    label: '✈️ 機場',
    hint: '航廈 · 登機 · 旅行感',
    indoor: true, type: 'indoor',
    env_prompt: 'modern airport terminal interior, wide windows with planes on tarmac outside, sleek check-in area and seating, travelers with luggage in soft background bokeh, bright daylight, no visible brand logos, handheld travel vlog feel, 35mm film grain, ISO 400',
    product_context_template: 'waiting at the terminal and {BRAND_ACTION} before a trip',
    mood_default: 'excited and travel-ready', duration_default: 10,
  },
  bedroom: {
    label: '🛏️ 臥室',
    hint: '柔光 · 居家私密感',
    indoor: true, type: 'indoor',
    env_prompt: 'cozy bedroom with soft natural window light, neatly made bed with linen sheets, warm intimate atmosphere, plants and soft textures, candid at-home vibe, handheld vlog feel, 35mm film grain, ISO 800, skin pores visible',
    product_context_template: 'relaxing in the bedroom and {BRAND_ACTION} in a private cozy moment',
    mood_default: 'intimate and relaxed', duration_default: 10,
  },
  beach: {
    label: '🏖️ 海邊',
    hint: '沙灘 · 海浪 · 陽光',
    indoor: false, type: 'outdoor',
    env_prompt: 'sunny sandy beach with gentle ocean waves, clear blue sky, soft sunlight and sea breeze, distant horizon, relaxed coastal atmosphere, handheld vlog feel, 35mm film grain, ISO 200',
    product_context_template: 'enjoying the seaside and {BRAND_ACTION} with a carefree vibe',
    mood_default: 'carefree and sunny', duration_default: 10,
  },
  sports_field: {
    label: '🏃 運動場',
    hint: '跑道 · 球場 · 戶外運動',
    indoor: false, type: 'outdoor',
    env_prompt: 'outdoor sports field with running track and green turf, bright daylight, open athletic atmosphere, distant stands in soft bokeh, energetic vibe, handheld vlog feel, 35mm film grain, ISO 400',
    product_context_template: 'taking a break during exercise to {BRAND_ACTION}, energetic and sweaty',
    mood_default: 'energetic and active', duration_default: 10,
  },
  living_room: {
    label: '🛋️ 客廳',
    hint: '沙發 · 居家放鬆',
    indoor: true, type: 'indoor',
    env_prompt: 'comfortable modern living room with a sofa, soft warm lighting, TV and plants in soft background, relaxed homey atmosphere, candid at-home vibe, handheld vlog feel, 35mm film grain, ISO 800, skin pores visible',
    product_context_template: 'relaxing on the sofa and {BRAND_ACTION} in a casual home moment',
    mood_default: 'relaxed and homey', duration_default: 10,
  },
  office: {
    label: '🏢 辦公室',
    hint: '辦公桌 · 職場情境',
    indoor: true, type: 'indoor',
    env_prompt: 'modern office workspace with desk, laptop and documents, large windows with city view, clean professional lighting, colleagues in soft background bokeh, no visible brand logos, handheld vlog feel, 35mm film grain, ISO 400',
    product_context_template: 'at the desk taking a short break to {BRAND_ACTION}, professional and composed',
    mood_default: 'focused and professional', duration_default: 10,
  },
  restaurant: {
    label: '🍽️ 餐廳用餐',
    hint: '餐桌 · 美食 · 用餐情境',
    indoor: true, type: 'indoor',
    env_prompt: 'warm cozy restaurant interior, set dining table with plates and soft candle-like lighting, blurred diners and decor in background bokeh, inviting culinary atmosphere, no visible brand logos, handheld vlog feel, 35mm film grain, ISO 800',
    product_context_template: 'seated at the table and {BRAND_ACTION} while enjoying the meal',
    mood_default: 'warm and appetizing', duration_default: 10,
  },
  clinic: {
    label: '🏥 診間 / 專業',
    hint: '診療室 · 醫療專業白色調',
    indoor: true, type: 'indoor',
    env_prompt: 'clean modern clinic or consultation room, white and light tones, professional medical setting with subtle equipment in background, bright even lighting, trustworthy calm atmosphere, no visible brand logos, handheld vlog feel, 35mm film grain, ISO 400',
    product_context_template: 'in the consultation room calmly explaining while {BRAND_ACTION}, professional and reassuring',
    mood_default: 'trustworthy and calm', duration_default: 10,
  },
  campsite: {
    label: '🏕️ 露營營地',
    hint: '帳篷 · 營火 · 戶外生活',
    indoor: false, type: 'outdoor',
    env_prompt: 'outdoor campsite with tents and a campfire, surrounded by trees and nature, warm golden hour light or cozy evening glow, relaxed outdoor living atmosphere, handheld vlog feel, 35mm film grain, ISO 400',
    product_context_template: 'at the campsite by the tent and {BRAND_ACTION} enjoying outdoor life',
    mood_default: 'cozy and adventurous', duration_default: 10,
  },
  gym: {
    label: '💪 健身房',
    hint: '器材 · 落地鏡 · 訓練',
    indoor: true, type: 'indoor',
    env_prompt: 'modern indoor gym with exercise equipment, large floor-to-ceiling mirrors, moody industrial lighting, racks and machines in background bokeh, energetic fitness atmosphere, no visible brand logos, handheld vlog feel, 35mm film grain, ISO 800',
    product_context_template: 'taking a break between sets to {BRAND_ACTION}, energetic and focused',
    mood_default: 'energetic and determined', duration_default: 10,
  },
  warehouse_store: {
    label: '🛒 量販賣場',
    hint: '貨架 · 寬走道 · 選購',
    indoor: true, type: 'indoor',
    env_prompt: 'large warehouse-style retail store, tall stocked shelves and wide aisles, bright even overhead lighting, shopping carts and products in background bokeh, no visible brand logos or signage, candid handheld vlog feel, 35mm film grain, ISO 400',
    product_context_template: 'pushing a cart through the aisles and {BRAND_ACTION} while shopping',
    mood_default: 'casual and practical', duration_default: 10,
  },
  farm: {
    label: '🌾 農場 / 田園',
    hint: '作物 · 食材溯源',
    indoor: false, type: 'outdoor',
    env_prompt: 'rural farm field with crops and greenery, rustic countryside atmosphere, warm natural sunlight, distant barn or rolling hills, fresh wholesome vibe, handheld vlog feel, 35mm film grain, ISO 200',
    product_context_template: 'walking through the farm and {BRAND_ACTION}, showcasing freshness at the source',
    mood_default: 'wholesome and fresh', duration_default: 10,
  },
};

// 🎯 品牌專屬場景
const BRAND_SCENES = {
  // ═══ 👙 LACEZ · 內衣(保留原 5 個,RA 個人品牌)═══
  la: {
    la_kitchen_morning: {
      label: '🥞 廚房晨光', hint: 'LACEZ · 晨光內衣搭配',
      indoor: true, type: 'indoor',
      env_prompt: 'cozy home kitchen in early morning, soft sunlight through window, wooden countertop with coffee mug and small plant, 35mm film grain, ISO 800, visible skin pores and peach fuzz, candid handheld vlog feel',
      product_context: 'LACEZ lingerie naturally placed on the kitchen counter beside a coffee mug, not worn, just present as part of the morning routine',
      mood_default: 'warm and gentle', duration_default: 10,
    },
    la_cafe_afternoon: {
      label: '☕ 咖啡廳午後', hint: 'LACEZ · 手機展示不實拿',
      indoor: true, type: 'indoor',
      env_prompt: 'independent cafe in warm afternoon light, wooden table with latte and phone, handheld vlog feel, 35mm, visible skin pores',
      product_context: 'showing LACEZ lingerie product page on phone screen, not physically holding the garment',
      mood_default: 'relaxed and thoughtful', duration_default: 10,
    },
    la_outdoor_garden: {
      label: '🌿 戶外綠意', hint: 'LACEZ · 純氛圍 vlog 不出現商品',
      indoor: false, type: 'outdoor',
      env_prompt: 'lush green urban park, golden hour dappled sunlight, fresh air feeling, handheld vlog, 35mm film grain',
      product_context: 'no product shown, pure atmospheric vlog focusing on comfortable lifestyle mood',
      mood_default: 'peaceful and refreshing', duration_default: 10,
    },
    la_urban_night: {
      label: '🌃 夜間街頭', hint: 'LACEZ · 紙袋拎手剛買完',
      indoor: false, type: 'outdoor',
      env_prompt: 'urban street at night, neon shop lights reflecting on wet pavement, moody cinematic, handheld, 35mm, ISO 1600',
      product_context: 'carrying a LACEZ paper shopping bag after shopping, neon reflections on the bag',
      mood_default: 'cinematic', duration_default: 10,
    },
    la_home_unboxing: {
      label: '📦 居家開箱', hint: '🌟 LACEZ 黃金樣本',
      indoor: true, type: 'indoor',
      env_prompt: 'modern minimal home living room with white curtains and soft window light, wooden desk with LACEZ package, candid at-home vibe, handheld vlog, 35mm, ISO 800, skin pores visible',
      product_context: 'walking into the room, sitting down, gently opening the LACEZ paper bag, revealing the lingerie piece with genuine soft excitement',
      mood_default: 'genuine and unhurried', duration_default: 15,
    },
  },

  // ═══ 🍳 cf 巧福 · 家電(原 ka kitchen_demo/breakfast_morning 搬家)═══
  cf: {
    cf_kitchen_demo: {
      label: '🍳 廚房示範', hint: '巧福 · 家電操作',
      indoor: true, type: 'indoor',
      env_prompt: 'bright home kitchen with wooden countertop, natural daylight, clean but lived-in feel, 35mm film grain, handheld vlog perspective, visible skin pores',
      product_context: 'demonstrating the Chofu appliance in natural kitchen use, showing how it fits into daily life',
      mood_default: 'warm and practical', duration_default: 10,
    },
    cf_breakfast_morning: {
      label: '🌅 早餐煮食', hint: '巧福 · 晨間家電使用',
      indoor: true, type: 'indoor',
      env_prompt: 'morning kitchen with soft sunlight, breakfast items on the counter, casual at-home vibe, handheld feel, 35mm, natural skin texture',
      product_context: 'using the Chofu appliance while preparing breakfast, steam and morning light',
      mood_default: 'cozy and caring', duration_default: 10,
    },
    cf_living_relax: {
      label: '🛋️ 客廳放鬆', hint: '巧福 · 遠紅外線居家療癒',
      indoor: true, type: 'indoor',
      env_prompt: 'warm minimalist living room, soft lamp light, comfortable sofa, evening wind-down atmosphere, 35mm, handheld, visible skin details',
      product_context: 'using the Chofu health appliance on the sofa, relaxing at the end of the day',
      mood_default: 'healing and calm', duration_default: 10,
    },
  },

  // ═══ 🧘 ka 空瑪那 · 瑜珈療癒(全新專屬場景)═══
  ka: {
    ka_yoga_studio_morning: {
      label: '🧘 瑜珈教室晨光', hint: '空瑪那 · 早晨瑜珈課',
      indoor: true, type: 'indoor',
      env_prompt: 'serene yoga studio with wooden floor, morning sunlight streaming through tall windows, yoga mats laid out, clean minimal aesthetic, handheld vlog feel, 35mm film grain, natural skin tones',
      product_context_template: '{BRAND_ACTION} during morning yoga practice in a studio',
      mood_default: 'calm and focused', duration_default: 10,
    },
    ka_meditation_cushion: {
      label: '🪷 冥想坐墊', hint: '空瑪那 · 冥想靜心',
      indoor: true, type: 'indoor',
      env_prompt: 'quiet meditation room with soft natural light, single meditation cushion on wooden floor, minimal zen aesthetic, subtle incense smoke, 35mm, handheld, visible skin texture',
      product_context_template: '{BRAND_ACTION} during meditation, eyes softly closed, peaceful breath',
      mood_default: 'peaceful and centered', duration_default: 10,
    },
    ka_sound_bowl_healing: {
      label: '🎵 頌缽療癒', hint: '空瑪那 · 宸甄老師招牌',
      indoor: true, type: 'indoor',
      env_prompt: 'sound bowl healing room, warm ambient candle light, brass sound bowls and ritual tools on natural wood, quiet spiritual atmosphere, 35mm film grain, handheld contemplative vlog feel',
      product_context_template: '{BRAND_ACTION} surrounded by sound bowls during a healing session',
      mood_default: 'sacred and gentle', duration_default: 15,
    },
    ka_outdoor_yoga: {
      label: '🌳 戶外瑜珈', hint: '空瑪那 · 自然練習',
      indoor: false, type: 'outdoor',
      env_prompt: 'outdoor yoga practice in a peaceful park at golden hour, green grass, dappled sunlight, handheld vlog feel, 35mm film grain',
      product_context_template: '{BRAND_ACTION} practicing yoga poses outdoors, connecting with nature',
      mood_default: 'free and grounded', duration_default: 10,
    },
  },

  // ═══ 🥢 flm 香港福臨門 · 高端粵菜 ═══
  flm: {
    flm_dim_sum_morning: {
      label: '🥟 茶樓點心', hint: '福臨門 · 港式早茶',
      indoor: true, type: 'indoor',
      env_prompt: 'elegant Hong Kong Cantonese tea house interior, morning light, traditional round dining tables, bamboo steamer baskets, warm ambient lighting, 35mm film grain, handheld vlog feel',
      product_context_template: 'enjoying {BRAND_ACTION} dim sum with traditional Chinese tea in an authentic Cantonese setting',
      mood_default: 'nostalgic and refined', duration_default: 10,
    },
    flm_fine_dining: {
      label: '🍽️ 高端擺盤', hint: '福臨門 · 精緻粵菜',
      indoor: true, type: 'indoor',
      env_prompt: 'upscale Cantonese restaurant with warm golden lighting, immaculate white tablecloth, artistic plating, hint of red and gold Chinese aesthetic, 35mm handheld, visible food texture',
      product_context_template: 'savoring {BRAND_ACTION} fine Cantonese cuisine with appreciation for the plating',
      mood_default: 'sophisticated and celebratory', duration_default: 10,
    },
    flm_chef_craft: {
      label: '👨‍🍳 主廚手路菜', hint: '福臨門 · 廚房烹飪',
      indoor: true, type: 'indoor',
      env_prompt: 'professional Cantonese kitchen, flames leaping from wok, chef hands moving skillfully, dynamic cooking action, warm kitchen lighting, handheld, 35mm film grain',
      product_context_template: 'chef skillfully preparing {BRAND_ACTION} signature Cantonese dish with wok technique',
      mood_default: 'dynamic and masterful', duration_default: 10,
    },
  },

  // ═══ 👕 moz 瑞典駝鹿 · 保留原 2 個 ═══
  moz: {
    moz_cafe_weekend: {
      label: '☕ 週末咖啡廳', hint: 'MOZ · 北歐穿搭感',
      indoor: true, type: 'indoor',
      env_prompt: 'cozy Nordic-style cafe on weekend morning, light wood interior, soft daylight, minimalist aesthetic, 35mm film grain, handheld vlog feel',
      product_context_template: 'wearing MOZ {BRAND_ACTION} casually in a weekend cafe moment',
      mood_default: 'relaxed Nordic vibe', duration_default: 10,
    },
    moz_commute_train: {
      label: '🚇 通勤列車', hint: 'MOZ · 城市通勤',
      indoor: false, type: 'outdoor',
      env_prompt: 'modern city metro station during commute hours, natural daylight, dynamic urban background, handheld vlog style, 35mm film grain',
      product_context_template: 'MOZ {BRAND_ACTION} during daily urban commute',
      mood_default: 'everyday and real', duration_default: 10,
    },
  },
};

// 🎭 品牌類型動作模板(15 類)
const BRAND_TYPE_ACTIONS = {
  fashion_lingerie:   'the lingerie piece placed naturally or worn comfortably under loungewear',
  fashion_apparel:    'the garment worn with natural styling',
  fashion_shoes:      'the shoes worn or placed beside, showing the design',
  beauty_skincare:    'the skincare product applied gently, light touch on face',
  beauty_makeup:      'the makeup product applied with natural everyday look',
  food_snack:         'the snack opened and tasted, genuine enjoyment',
  food_beverage:      'the beverage being sipped, savoring the flavor',
  appliance_kitchen:  'the kitchen appliance demonstrated in natural use',
  appliance_beauty:   'the beauty device being used on face or body',
  jewelry_accessory:  'the accessory subtly worn, catching the light',
  health_supplement:  'the supplement held or taken with water',
  home_lifestyle:     'the home product used naturally in everyday setting',
  yoga_wellness:      'wearing comfortable yoga attire, grounded and centered',
  food_cuisine:       'the dish presented and tasted with appreciation',
  default:            'the product held or interacted with naturally',
};

// 🏷️ 品牌類型中文標籤(給 onboard.html 下拉用)
const BRAND_TYPE_LABELS = {
  fashion_lingerie:   '👙 內衣 / 貼身衣物',
  fashion_apparel:    '👚 服飾',
  fashion_shoes:      '👟 鞋 / 包',
  beauty_skincare:    '🧴 保養品',
  beauty_makeup:      '💄 彩妝',
  food_snack:         '🍪 零食 / 食品',
  food_beverage:      '🍹 飲料',
  appliance_kitchen:  '🍳 廚房家電',
  appliance_beauty:   '💆 美容家電',
  jewelry_accessory:  '💍 珠寶 / 配件',
  health_supplement:  '💊 保健品',
  home_lifestyle:     '🏠 居家生活',
  yoga_wellness:      '🧘 瑜珈 / 身心靈',
  food_cuisine:       '🥢 餐飲 / 料理',
  default:            '📦 其他',
};

// 🎯 核心函式:拿某品牌可用的場景
// LACEZ (la) → 只用自家 5 個
// 其他有專屬的 → 專屬 + 通用 pool
// 沒專屬的 → 只用通用 pool
window.getScenesForBrand = function(brandId) {
  if (!brandId) return { ...UNIVERSAL_POOL };
  const brandSpecific = BRAND_SCENES[brandId] || {};
  const hasBrandScenes = Object.keys(brandSpecific).length > 0;
  if (brandId === 'la') return { ...brandSpecific };
  if (hasBrandScenes) return { ...brandSpecific, ...UNIVERSAL_POOL };
  return { ...UNIVERSAL_POOL };
};

// 🎭 拿品牌類型對應的動作模板
window.getBrandActionTemplate = function(brand) {
  if (!brand) return BRAND_TYPE_ACTIONS.default;
  const brandType = brand.brand_type || brand.type || 'default';
  return BRAND_TYPE_ACTIONS[brandType] || BRAND_TYPE_ACTIONS.default;
};

// 🎨 把場景 template 裡的 {BRAND_ACTION} 替換成實際動作
window.resolveSceneProductContext = function(scene, brand) {
  if (!scene) return '';
  if (scene.product_context && !scene.product_context_template) {
    return scene.product_context;
  }
  const template = scene.product_context_template || '';
  const brandAction = window.getBrandActionTemplate(brand);
  return template.replace('{BRAND_ACTION}', brandAction);
};

// 📦 匯出
window.UNIVERSAL_POOL = UNIVERSAL_POOL;
window.BRAND_SCENES = BRAND_SCENES;
window.BRAND_TYPE_ACTIONS = BRAND_TYPE_ACTIONS;
window.BRAND_TYPE_LABELS = BRAND_TYPE_LABELS;
// 相容舊 SCENE_LIBRARY 名稱
window.SCENE_LIBRARY = BRAND_SCENES;

console.log('KOL Universal Scenes loaded:', Object.keys(UNIVERSAL_POOL).length + ' universal + ' + Object.keys(BRAND_SCENES).length + ' brands with specifics');
