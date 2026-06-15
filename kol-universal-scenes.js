// ════════════════════════════════════════════════════════════════════
//  Brand OS · KOL Studio v5.11.2 — Universal Scenes（場景固定化版）
//  通用場景庫(全品牌共用)+ 品牌專屬場景(cf/ka/flm/la/moz)
//
//  🔧 v5.11.2 固定化:每個通用場景的 env_prompt 改寫為「具體、小、固定」——
//     ▸ 拿掉會把空間吹大的詞(城市落地窗 / 背景同事 / 開放式)
//     ▸ 換成固定家具/定點當錨(因為接片沒有背景參考照,只能靠文字夠具體)
//     ▸ 每段補「same … kept consistent in every shot」→ 6 段同一個空間
//     ▸ 保留 LACEZ 反 AI DNA 尾巴(handheld vlog / 35mm / film grain / ISO / 毛孔)
//
//  結構:
//   ▸ UNIVERSAL_POOL   : 通用場景(所有品牌都能用)
//   ▸ BRAND_SCENES     : 品牌專屬場景(la/cf/ka/flm/moz)
//   ▸ BRAND_TYPE_ACTIONS : 品牌動作模板
//
//  LACEZ DNA 設計原則:
//   1. 反 AI 完美:毛孔、底片顆粒、ISO 400-1600、35mm、手持 vlog
//   2. 禁用:perfect / flawless / studio / professional
//   3. 商品動作抽象化:用 {BRAND_ACTION} 變數
//
//  載入要求:kol.html 主 script 之前必須載入此檔
// ════════════════════════════════════════════════════════════════════

// 🌐 通用場景 pool(所有品牌共用 · 已固定化)
const UNIVERSAL_POOL = {
  kitchen_morning: {
    label: '🥞 廚房晨光',
    hint: '晨光感 · 早起儀式',
    indoor: true, type: 'indoor',
    env_prompt: 'a small cozy home kitchen in early morning, one wooden countertop along the wall with a few everyday items and subtle lived-in clutter, a single window above the counter with soft natural sunlight, warm wood and cream tones, a compact homey galley space — the same kitchen, counter and layout kept consistent in every shot, 35mm film grain, handheld vlog feel, ISO 800, visible skin pores and peach fuzz',
    product_context_template: '{BRAND_ACTION} naturally placed on the kitchen counter while preparing the morning',
    mood_default: 'warm and unhurried', duration_default: 10,
  },
  cafe_afternoon: {
    label: '☕ 咖啡廳午後',
    hint: '文青氛圍 · me time',
    indoor: true, type: 'indoor',
    env_prompt: 'a quiet small independent cafe in the afternoon, seated at one wooden table beside a window with a coffee cup and a small notebook, warm amber ambient lighting, a counter and a few empty tables softly blurred behind, an intimate corner — the same cafe corner and seat kept consistent in every shot, handheld vlog feel, 35mm film grain, visible skin texture',
    product_context_template: '{BRAND_ACTION} casually on the cafe table while enjoying coffee alone',
    mood_default: 'relaxed and thoughtful', duration_default: 10,
  },
  outdoor_garden: {
    label: '🌿 戶外綠意',
    hint: '公園 / 花園 · 陽光感',
    indoor: false, type: 'outdoor',
    env_prompt: 'standing at one leafy corner of an urban park in golden hour, beside a particular tree and a low hedge on a garden path, dappled warm sunlight through the leaves, green foliage close around — the same spot in the park kept consistent in every shot, handheld vlog style, 35mm film grain',
    product_context_template: '{BRAND_ACTION} while taking a peaceful walk outdoors',
    mood_default: 'peaceful and refreshing', duration_default: 10,
  },
  urban_night: {
    label: '🌃 夜間街頭',
    hint: '霓虹城市 · 下班氛圍',
    indoor: false, type: 'outdoor',
    env_prompt: 'standing at the same quiet urban street corner at night, soft neon and small shop signs reflecting on the wet pavement nearby, a hint of passing-car bokeh far in the distance, moody cinematic lighting — the same street spot kept consistent in every shot, handheld vlog feel, 35mm, ISO 1600',
    product_context_template: 'carrying {BRAND_ACTION} after finishing work, neon reflecting on the bag',
    mood_default: 'cinematic and contemplative', duration_default: 10,
  },
  home_unboxing: {
    label: '📦 居家開箱',
    hint: '🌟 黃金樣本 · 走進→開箱→展示',
    indoor: true, type: 'indoor',
    env_prompt: 'a small modern minimal home living room, soft white curtains over one window with natural light, one wooden desk with a delivered package on its surface, a low shelf with plants behind, a compact cozy room — the same room, furniture and layout kept consistent in every shot, candid at-home vibe, handheld vlog feel, 35mm film grain, ISO 800, skin pores visible',
    product_context_template: 'walking in, sitting down, gently unboxing the package and revealing {BRAND_ACTION} with genuine excitement',
    mood_default: 'genuine and unhurried', duration_default: 15,
  },
  mountain_trail: {
    label: '⛰️ 登山步道',
    hint: '深山 / 熊出沒 · 戶外安全',
    indoor: false, type: 'outdoor',
    env_prompt: 'on the same stretch of a remote mountain hiking trail deep in dense forest wilderness, tall coniferous trees close on both sides, misty rugged terrain underfoot, distant mountain peaks beyond, isolated backcountry atmosphere where wildlife roams, overcast natural daylight — the same patch of trail kept consistent in every shot, handheld documentary vlog style, 35mm film grain, ISO 400',
    product_context_template: 'pausing on the trail to {BRAND_ACTION}, alert and prepared in the wilderness',
    mood_default: 'alert and adventurous', duration_default: 10,
  },
  dept_store: {
    label: '🛍️ 精品百貨',
    hint: '明亮櫥窗 · 大理石高級感',
    indoor: true, type: 'indoor',
    env_prompt: 'standing at the same spot inside an upscale department store, polished marble floor underfoot, one elegant display window and a glossy counter close by, soft luxury lighting, a few shoppers far in the background bokeh, no visible brand logos or signage — the same location kept consistent in every shot, handheld vlog feel, 35mm film grain, ISO 400',
    product_context_template: 'browsing through the store and {BRAND_ACTION} with a refined relaxed mood',
    mood_default: 'elegant and leisurely', duration_default: 10,
  },
  airport: {
    label: '✈️ 機場',
    hint: '航廈 · 登機 · 旅行感',
    indoor: true, type: 'indoor',
    env_prompt: 'at the same spot in a modern airport terminal, one large window beside with planes on the tarmac outside, a row of seating and a sleek counter nearby, a few travelers with luggage in soft background bokeh, bright daylight, no visible brand logos — the same terminal spot kept consistent in every shot, handheld travel vlog feel, 35mm film grain, ISO 400',
    product_context_template: 'waiting at the terminal and {BRAND_ACTION} before a trip',
    mood_default: 'excited and travel-ready', duration_default: 10,
  },
  bedroom: {
    label: '🛏️ 臥室',
    hint: '柔光 · 居家私密感',
    indoor: true, type: 'indoor',
    env_prompt: 'a small cozy bedroom, one neatly made bed with linen sheets against the wall, a single window with soft natural light beside it, plants and warm soft textures around, an intimate compact room — the same bedroom, bed and layout kept consistent in every shot, candid at-home vibe, handheld vlog feel, 35mm film grain, ISO 800, skin pores visible',
    product_context_template: 'relaxing in the bedroom and {BRAND_ACTION} in a private cozy moment',
    mood_default: 'intimate and relaxed', duration_default: 10,
  },
  beach: {
    label: '🏖️ 海邊',
    hint: '沙灘 · 海浪 · 陽光',
    indoor: false, type: 'outdoor',
    env_prompt: 'on the same stretch of a sunny sandy beach, gentle ocean waves breaking just behind, clear blue sky, soft sunlight and sea breeze, the same horizon line and spot on the sand kept consistent in every shot, relaxed coastal atmosphere, handheld vlog feel, 35mm film grain, ISO 200',
    product_context_template: 'enjoying the seaside and {BRAND_ACTION} with a carefree vibe',
    mood_default: 'carefree and sunny', duration_default: 10,
  },
  sports_field: {
    label: '🏃 運動場',
    hint: '跑道 · 球場 · 戶外運動',
    indoor: false, type: 'outdoor',
    env_prompt: 'at the same spot on an outdoor sports field, a running track lane and green turf underfoot, bright daylight, distant empty stands in soft bokeh, the same patch of field kept consistent in every shot, energetic open-air vibe, handheld vlog feel, 35mm film grain, ISO 400',
    product_context_template: 'taking a break during exercise to {BRAND_ACTION}, energetic and sweaty',
    mood_default: 'energetic and active', duration_default: 10,
  },
  living_room: {
    label: '🛋️ 客廳',
    hint: '沙發 · 居家放鬆',
    indoor: true, type: 'indoor',
    env_prompt: 'a small comfortable modern living room, one fabric sofa against the wall, a low coffee table in front, soft warm lamp light, a plant and a shelf in the background, a compact homey room — the same living room, sofa and layout kept consistent in every shot, candid at-home vibe, handheld vlog feel, 35mm film grain, ISO 800, skin pores visible',
    product_context_template: 'relaxing on the sofa and {BRAND_ACTION} in a casual home moment',
    mood_default: 'relaxed and homey', duration_default: 10,
  },
  office: {
    label: '🏢 辦公室',
    hint: '辦公桌 · 職場情境',
    indoor: true, type: 'indoor',
    env_prompt: 'a small cozy private office room, one wooden desk against the wall with a laptop and a few papers, an ergonomic chair, a low shelf with plants and folders on the wall directly behind, a single window on the left with soft natural daylight, warm neutral walls close around, an enclosed intimate workspace — not an open-plan floor, no distant city skyline, no other people in view — the exact same room, furniture and layout kept consistent in every shot, no visible brand logos, handheld vlog feel, 35mm film grain, ISO 400',
    product_context_template: 'at the desk taking a short break to {BRAND_ACTION}, professional and composed',
    mood_default: 'focused and professional', duration_default: 10,
  },
  restaurant: {
    label: '🍽️ 餐廳用餐',
    hint: '餐桌 · 美食 · 用餐情境',
    indoor: true, type: 'indoor',
    env_prompt: 'seated at the same one table in a warm cozy restaurant, plates and soft candle-like lighting on the table, a few blurred diners and warm decor in background bokeh, inviting culinary atmosphere, no visible brand logos — the same table and seat kept consistent in every shot, handheld vlog feel, 35mm film grain, ISO 800',
    product_context_template: 'seated at the table and {BRAND_ACTION} while enjoying the meal',
    mood_default: 'warm and appetizing', duration_default: 10,
  },
  clinic: {
    label: '🏥 診間 / 專業',
    hint: '診療室 · 醫療專業白色調',
    indoor: true, type: 'indoor',
    env_prompt: 'in the same clean modern consultation room, white and light tones, one desk and subtle medical equipment on a shelf behind, bright even lighting, a small enclosed professional space, trustworthy calm atmosphere, no visible brand logos — the same room and layout kept consistent in every shot, handheld vlog feel, 35mm film grain, ISO 400',
    product_context_template: 'in the consultation room calmly explaining while {BRAND_ACTION}, professional and reassuring',
    mood_default: 'trustworthy and calm', duration_default: 10,
  },
  campsite: {
    label: '🏕️ 露營營地',
    hint: '帳篷 · 營火 · 戶外生活',
    indoor: false, type: 'outdoor',
    env_prompt: 'at the same campsite spot beside one tent and a small campfire, surrounded by trees and nature close around, warm golden-hour light or cozy evening glow, relaxed outdoor living atmosphere — the same campsite layout kept consistent in every shot, handheld vlog feel, 35mm film grain, ISO 400',
    product_context_template: 'at the campsite by the tent and {BRAND_ACTION} enjoying outdoor life',
    mood_default: 'cozy and adventurous', duration_default: 10,
  },
  gym: {
    label: '💪 健身房',
    hint: '器材 · 落地鏡 · 訓練',
    indoor: true, type: 'indoor',
    env_prompt: 'at the same corner of a modern indoor gym, one piece of exercise equipment and a large floor-to-ceiling mirror beside, moody industrial lighting, a few racks and machines in background bokeh, energetic fitness atmosphere, no visible brand logos — the same gym corner kept consistent in every shot, handheld vlog feel, 35mm film grain, ISO 800',
    product_context_template: 'taking a break between sets to {BRAND_ACTION}, energetic and focused',
    mood_default: 'energetic and determined', duration_default: 10,
  },
  warehouse_store: {
    label: '🛒 量販賣場',
    hint: '貨架 · 寬走道 · 選購',
    indoor: true, type: 'indoor',
    env_prompt: 'standing in the same one aisle of a large warehouse-style retail store, tall stocked shelves on both sides, bright even overhead lighting, a shopping cart nearby and products in background bokeh, no visible brand logos or signage — the same aisle kept consistent in every shot, candid handheld vlog feel, 35mm film grain, ISO 400',
    product_context_template: 'pushing a cart through the aisles and {BRAND_ACTION} while shopping',
    mood_default: 'casual and practical', duration_default: 10,
  },
  farm: {
    label: '🌾 農場 / 田園',
    hint: '作物 · 食材溯源',
    indoor: false, type: 'outdoor',
    env_prompt: 'standing at the same spot in a rural farm field with crops and greenery close around, rustic countryside atmosphere, warm natural sunlight, a distant barn or rolling hills beyond — the same field spot kept consistent in every shot, fresh wholesome vibe, handheld vlog feel, 35mm film grain, ISO 200',
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
