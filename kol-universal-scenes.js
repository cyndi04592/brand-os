// ════════════════════════════════════════════════════════════════════
//  Brand OS · KOL Studio v5.11 — Universal Scenes & Brand Type Actions
//  通用場景庫(全品牌共用)+ 品牌類型動作模板
//
//  載入順序要求:此檔必須在 kol.html 主 script 之前載入
//  使用方式:kol.html 用 getScenesForBrand(brandId) 取得合併後場景
// ════════════════════════════════════════════════════════════════════

// ── 10 個通用場景(全品牌共用)─────────────────────────────────
// 設計原則:
//   1. 場景 = 物理環境 + 氛圍(不綁任何品牌屬性)
//   2. product_context 用 {BRAND_ACTION} 變數,由品牌動作模板填入
//   3. REALISM_BASE 反完美元素:底片顆粒、手持抖動、毛孔、35mm 鏡頭
const UNIVERSAL_SCENES = {
  // 1. 廚房晨光(室內 · 溫暖)
  u_kitchen_morning: {
    label: '🌅 廚房晨光',
    hint: '早晨自然光 · 溫暖居家感',
    indoor: true,
    env_prompt: 'cozy home kitchen in the morning, soft natural sunlight streaming through window, warm wooden countertop, casual lived-in atmosphere',
    mood_default: 'warm and gentle',
    product_context_template: '{BRAND_ACTION} on the kitchen counter while preparing morning routine',
    duration_default: 10,
    universal: true,
  },

  // 2. 咖啡廳午後(室內 · 文青)
  u_cafe_afternoon: {
    label: '☕ 咖啡廳午後',
    hint: '慵懶 me time · 文青氛圍',
    indoor: true,
    env_prompt: 'quiet independent cafe in afternoon, warm amber lighting, wooden table with coffee cup and notebook, soft background blur of other patrons',
    mood_default: 'relaxed and thoughtful',
    product_context_template: '{BRAND_ACTION} while enjoying coffee alone',
    duration_default: 10,
    universal: true,
  },

  // 3. 戶外綠意(戶外 · 自然)
  u_outdoor_garden: {
    label: '🌿 戶外綠意',
    hint: '公園 / 花園 · 陽光感',
    indoor: false,
    env_prompt: 'lush urban park or garden in golden hour, dappled sunlight through leaves, green foliage background, fresh outdoor air feeling',
    mood_default: 'peaceful and refreshing',
    product_context_template: '{BRAND_ACTION} while taking a walk outdoors',
    duration_default: 10,
    universal: true,
  },

  // 4. 夜間街頭(戶外 · 城市)
  u_urban_night: {
    label: '🌃 夜間街頭',
    hint: '霓虹城市 · 下班氛圍',
    indoor: false,
    env_prompt: 'urban street at night, soft neon and shop lights reflecting on wet pavement, hint of passing cars bokeh, moody atmospheric lighting',
    mood_default: 'cinematic and contemplative',
    product_context_template: 'carrying a paper bag with {BRAND_ACTION} after finishing work',
    duration_default: 10,
    universal: true,
  },

  // 5. 居家開箱(室內 · 開箱儀式感)
  u_home_unboxing: {
    label: '📦 居家開箱',
    hint: '開箱 → 展示 → 分享',
    indoor: true,
    env_prompt: 'modern minimal home living room, soft overhead lighting, white sofa or wooden desk with a package delivered on it, candid at-home vibe',
    mood_default: 'excited but natural',
    product_context_template: 'unboxing the package, gently revealing and showing {BRAND_ACTION}',
    duration_default: 15,  // 開箱建議 15s 走敘事
    universal: true,
  },

  // 6. 臥室放鬆(室內 · 私密)
  u_bedroom_cozy: {
    label: '🛏️ 臥室放鬆',
    hint: '床邊 / 晚安 / 私密感',
    indoor: true,
    env_prompt: 'cozy bedroom with soft bedside lamp, neutral bedding, evening wind-down atmosphere, intimate personal space feeling',
    mood_default: 'calm and intimate',
    product_context_template: '{BRAND_ACTION} during evening wind-down routine',
    duration_default: 10,
    universal: true,
  },

  // 7. 辦公桌(室內 · 工作)
  u_office_workdesk: {
    label: '💼 辦公桌',
    hint: '工作場景 / 午休',
    indoor: true,
    env_prompt: 'modern home office or workplace desk, laptop and stationery, soft daylight from side window, professional but relaxed setting',
    mood_default: 'focused but human',
    product_context_template: '{BRAND_ACTION} during a short break between tasks',
    duration_default: 10,
    universal: true,
  },

  // 8. 健身 / Wellness(室內 · 活力)
  u_gym_wellness: {
    label: '🧘 健身 Wellness',
    hint: '運動 / 瑜伽 / 健康',
    indoor: true,
    env_prompt: 'bright wellness studio or home gym corner, yoga mat on wooden floor, soft morning light from tall windows, active but not sweaty feeling',
    mood_default: 'energetic and refreshed',
    product_context_template: '{BRAND_ACTION} after a wellness session',
    duration_default: 10,
    universal: true,
  },

  // 9. 餐廳聚餐(室內/戶外 · 社交)
  u_restaurant_meal: {
    label: '🍽️ 餐廳聚餐',
    hint: '和朋友吃飯 · 分享感',
    indoor: true,
    env_prompt: 'warm restaurant interior or outdoor terrace dining, ambient dinner lighting, plates and glasses on table, social but intimate setting',
    mood_default: 'happy and shared',
    product_context_template: '{BRAND_ACTION} while dining with friends',
    duration_default: 10,
    universal: true,
  },

  // 10. 通勤路上(戶外 · 過場)
  u_commute_transit: {
    label: '🚇 通勤路上',
    hint: '捷運 / 公車 / 路上',
    indoor: false,
    env_prompt: 'metro station or city street during commute hours, dynamic background of people walking, natural urban lighting, vlog-style handheld feel',
    mood_default: 'everyday and real',
    product_context_template: '{BRAND_ACTION} during daily commute',
    duration_default: 10,
    universal: true,
  },
};

// ── 品牌類型動作模板 ──────────────────────────────────────────
// 當品牌使用通用場景時,{BRAND_ACTION} 會被替換成以下對應動作
const BRAND_TYPE_ACTIONS = {
  fashion_lingerie:   'wearing the lingerie naturally under comfortable loungewear, adjusting the strap subtly',
  fashion_apparel:    'wearing the outfit, showing off the fit with a natural twirl',
  beauty_skincare:    'applying the skincare product gently, touching face afterward',
  beauty_makeup:      'applying the makeup, checking the mirror',
  food_snack:         'opening the snack package, taking a bite, smiling at camera',
  food_beverage:      'taking a sip from the beverage, enjoying the flavor',
  appliance_kitchen:  'demonstrating the kitchen appliance, showing it in use',
  appliance_beauty:   'using the beauty device on face or body, showing the effect',
  jewelry_accessory:  'wearing the accessory, it catches the light subtly',
  health_supplement:  'holding the supplement bottle, taking it with water',
  home_lifestyle:     'using the home product naturally in the space',
  default:            'holding the product, interacting with it naturally',
};

// ── 品牌類型中文標籤(給 onboard.html 下拉用)───────────────────
const BRAND_TYPE_LABELS = {
  fashion_lingerie:   '👙 內衣 / 貼身衣物',
  fashion_apparel:    '👚 服飾 / 鞋包',
  beauty_skincare:    '🧴 保養品',
  beauty_makeup:      '💄 彩妝',
  food_snack:         '🍪 零食 / 食品',
  food_beverage:      '🍹 飲料',
  appliance_kitchen:  '🍳 廚房家電',
  appliance_beauty:   '💆 美容家電',
  jewelry_accessory:  '💍 珠寶 / 配件',
  health_supplement:  '💊 保健品',
  home_lifestyle:     '🏠 居家生活',
  default:            '📦 其他',
};

// ── 組合函式:拿某品牌可用的全部場景 ─────────────────────────
// 邏輯:
//   1. 先取通用場景(10 個)
//   2. 再疊上品牌專屬場景(la / moz / ka 原有的)
//   3. 同 key 的話品牌專屬覆蓋通用(保留你已驗證好的)
window.getScenesForBrand = function(brandId) {
  const universal = UNIVERSAL_SCENES || {};
  const brandSpecific = (typeof SCENE_LIBRARY !== 'undefined' && SCENE_LIBRARY[brandId]) || {};
  const merged = { ...universal, ...brandSpecific };
  
  // 🆕 自動補齊 type 欄位,讓 Tab 2 的 scene-type-pill 能正確顯示
  Object.keys(merged).forEach(key => {
    const s = merged[key];
    if (!s.type) {
      s.type = s.indoor === false ? 'outdoor' : 'indoor';
    }
  });
  
  return merged;
};

// ── 組合函式:拿某品牌的動作模板 ────────────────────────────────
// 邏輯:讀 brand.brand_type(GAS 那邊要在 brands sheet 補這欄)
window.getBrandActionTemplate = function(brand) {
  if (!brand) return BRAND_TYPE_ACTIONS.default;
  const brandType = brand.brand_type || brand.type || 'default';
  return BRAND_TYPE_ACTIONS[brandType] || BRAND_TYPE_ACTIONS.default;
};

// ── 組合函式:給通用場景填上品牌動作 ────────────────────────────
window.resolveSceneProductContext = function(scene, brand) {
  if (!scene) return '';
  const template = scene.product_context_template || scene.product_context || '';
  const brandAction = window.getBrandActionTemplate(brand);
  return template.replace('{BRAND_ACTION}', brandAction);
};

// ── 匯出(給 debug 用)─────────────────────────────────────────
window.UNIVERSAL_SCENES = UNIVERSAL_SCENES;
window.BRAND_TYPE_ACTIONS = BRAND_TYPE_ACTIONS;
window.BRAND_TYPE_LABELS = BRAND_TYPE_LABELS;

console.log('[KOL v5.11] Universal scenes loaded:', Object.keys(UNIVERSAL_SCENES).length, 'scenes');
