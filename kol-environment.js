// ════════════════════════════════════════════════════════════════════
//  kol-environment.js · v5.19
//  
//  🌆 環境組 — 場景 × 地標 × 環境音
//  
//  (取代 v5.11 的 kol-locations.js,概念升級)
//  
//  職責:
//   • 地標庫(22 個真實地標 · 未來可從 GAS 動態載入)
//   • 環境音描述(讓 KOL 有反應對象)
//   • 輕量「防貼上去感」規則
//  
//  設計哲學(RA · 2026-06 修訂):
//   環境只負責「她在哪 + 環境音 + 不要像貼上去」,
//   ⚠️ 不再把環境光「打到臉上 / 反射到皮膚」——
//      那是烤肉網(臉部規則網格)的幫兇之一。
//   臉部打光、膚質交給「參考照本身」,環境只給背景與氛圍。
//
//  v5.17 變更:
//   • SCENE_HUMAN_INTEGRATION 縮短:只保留「自然融入場景、不是貼上去」,
//     拔掉「light must fall on her skin / hair catches reflections」(打臉)。
//   • contribute 移除「環境光打到臉上」那段(地標 light_character 不再餵入)。
//   • 22 個地標資料原封不動;light_character / light_interaction 變休眠欄位
//     (留著供 UI 或未來用,但不進 prompt)。
// ════════════════════════════════════════════════════════════════════

(function () {
  'use strict';

  // ─── 地標庫 ────────────────────────────────────────────
  //  註:light_character 目前為休眠欄位(v5.17 起不餵進 prompt,避免打臉烤肉網)
  const LOCATIONS = {
    none: { label: '— 不指定地標 —', keywords: null, ambient: null },

    // 🇯🇵 日本東京
    jp_shibuya_scramble: {
      label: '🇯🇵 東京涉谷 · Scramble 十字路口',
      keywords: 'the famous Shibuya Scramble Crossing in Tokyo, massive LED billboards on tall buildings, crowds of pedestrians, TSUTAYA building visible, iconic neon signs above',
      ambient: 'ambient crowd chatter, distant traffic, occasional car horns, crosswalk signal beeps',
      light_character: 'mixed LED billboard light casting colorful reflections onto her face, shifting color temperature',
      compatible: ['outdoor'],
    },
    jp_shibuya_109: {
      label: '🇯🇵 東京涉谷 · 109 百貨前',
      keywords: 'in front of Shibuya 109 department store Tokyo, distinctive cylindrical building with the 109 logo, busy street-level view',
      ambient: 'soft K-pop music from storefronts, chatter of young shoppers, distant announcements',
      light_character: 'cool white facade light with pink neon accents on skin',
      compatible: ['outdoor'],
    },
    jp_harajuku_takeshita: {
      label: '🇯🇵 東京原宿 · 竹下通',
      keywords: 'on Takeshita Street in Harajuku Tokyo, narrow pedestrian shopping street, colorful crêpe shops and youth fashion stores, kawaii pastel signage',
      ambient: 'upbeat J-pop from shops, laughter of teenagers, street food sizzling',
      light_character: 'bright pastel reflections from storefronts, warm afternoon sun filtering between buildings',
      compatible: ['outdoor'],
    },
    jp_omotesando: {
      label: '🇯🇵 東京表參道',
      keywords: 'the tree-lined Omotesando boulevard in Tokyo, zelkova trees overhead, upscale fashion storefronts, European-style promenade',
      ambient: 'quiet upscale atmosphere, distant fashion boutique music, soft footsteps on wide sidewalk',
      light_character: 'dappled sunlight through zelkova leaves creating natural spots on her face and shoulders',
      compatible: ['outdoor'],
    },
    jp_ginza: {
      label: '🇯🇵 東京銀座 · 中央通',
      keywords: 'Ginza Chuo-dori in Tokyo, luxury flagship stores lining the street, Wako clock tower in background, elegant urban atmosphere',
      ambient: 'refined quiet atmosphere, occasional taxi passing, muffled luxury store interiors',
      light_character: 'luxury storefront warm light reflecting on her face, creating soft golden highlights',
      compatible: ['outdoor'],
    },
    jp_daikanyama: {
      label: '🇯🇵 東京代官山 · T-Site',
      keywords: 'Daikanyama T-Site in Tokyo, iconic Tsutaya bookstore complex, tree-lined quiet street, literary and stylish cafés nearby',
      ambient: 'quiet bookish atmosphere, distant café chatter, birds chirping in trees',
      light_character: 'soft natural daylight filtered through trees, gentle shadows playing on her face',
      compatible: ['outdoor'],
    },
    jp_asakusa_kaminarimon: {
      label: '🇯🇵 東京淺草 · 雷門',
      keywords: 'Kaminarimon Gate in Asakusa Tokyo, giant red paper lantern with Japanese characters, traditional Japanese architecture, Nakamise shopping street behind',
      ambient: 'temple bells in distance, tourist chatter in multiple languages, traditional festival ambience',
      light_character: 'warm red lantern glow casting amber tint on her cheek, traditional architectural shadows',
      compatible: ['outdoor'],
    },
    jp_shinjuku_kabukicho: {
      label: '🇯🇵 東京新宿 · 歌舞伎町',
      keywords: 'Kabukicho in Shinjuku Tokyo at night, dense neon signs stacked vertically, red Kabukicho gate in view, cyberpunk-like atmosphere',
      ambient: 'neon buzz, distant karaoke music, drunk laughter, urban night energy',
      light_character: 'intense neon sign reflections — pink, red, blue — shifting across her face, cyberpunk color bath',
      compatible: ['outdoor'],
    },

    // 🇹🇼 台灣
    tw_taipei_101: {
      label: '🇹🇼 台北 · 101 大樓前',
      keywords: 'in front of Taipei 101 in Xinyi District, iconic bamboo-shaped skyscraper towering in background, modern plaza with granite flooring',
      ambient: 'city breeze through plaza, distant MRT announcements, occasional plaza events',
      light_character: 'glass facade reflections creating bright highlights on her face from 101 tower',
      compatible: ['outdoor'],
    },
    tw_taipei_yongkang: {
      label: '🇹🇼 台北 · 永康街',
      keywords: 'Yongkang Street in Taipei, quaint lane with independent cafés and teahouses, brick-paved sidewalk, vintage Taiwan charm',
      ambient: 'quiet café murmur, tea brewing sounds, scooter passing occasionally, Taiwanese chatter',
      light_character: 'warm afternoon light bouncing off vintage brick, soft amber reflection on skin',
      compatible: ['outdoor'],
    },
    tw_taichung_shenji: {
      label: '🇹🇼 台中 · 審計新村',
      keywords: 'Shenji New Village in Taichung, refurbished former government dormitories now a creative market, pastel-painted walls, small craft shops',
      ambient: 'indie music from craft shops, casual chatter, crafters working on pottery',
      light_character: 'soft pastel wall reflections tinting her skin with gentle pink and mint hues',
      compatible: ['outdoor'],
    },
    tw_tainan_shennong: {
      label: '🇹🇼 台南 · 神農街',
      keywords: 'Shennong Street in Tainan, narrow historic street with traditional red-brick Qing-era buildings, wooden shutters, ancient capital atmosphere',
      ambient: 'quiet historical ambience, distant temple prayer, traditional market sounds',
      light_character: 'golden hour light streaming between old buildings, red brick reflecting warm tones onto face',
      compatible: ['outdoor'],
    },

    // 🇭🇰 香港
    hk_central_ifc: {
      label: '🇭🇰 香港中環 · IFC',
      keywords: 'IFC Mall area in Central Hong Kong, modern glass skyscraper facade, Star Ferry pier nearby, Victoria Harbour in distance',
      ambient: 'harbor breeze, distant ferry horn, financial district foot traffic, Cantonese conversation',
      light_character: 'glass tower reflections cast cool blue highlights on her skin, harbor light bouncing',
      compatible: ['outdoor'],
    },
    hk_tsimshatsui: {
      label: '🇭🇰 尖沙咀 · 星光大道',
      keywords: 'Tsim Sha Tsui Avenue of Stars in Hong Kong, Victoria Harbour view with Hong Kong Island skyline across the water, waterfront promenade',
      ambient: 'harbor water lapping, distant ferry sounds, mixed tourist languages, soft wind',
      light_character: 'harbor water reflecting shimmering light patterns onto her face, backlit skyline glow',
      compatible: ['outdoor'],
    },
    hk_hollywood_road: {
      label: '🇭🇰 中環 · 荷李活道',
      keywords: 'Hollywood Road in Central Hong Kong, steep sloped street with antique shops, colonial-era buildings, blend of old and new',
      ambient: 'quiet antique shops, distant tram bell, vintage Cantopop drifting from shops',
      light_character: 'warm antique shop window light, aged wood reflections on her face',
      compatible: ['outdoor'],
    },

    // 🇫🇷 歐洲
    fr_paris_eiffel: {
      label: '🇫🇷 巴黎 · 艾菲爾鐵塔',
      keywords: 'in front of the Eiffel Tower in Paris, iron lattice tower towering in background, Champ de Mars lawn, Parisian atmosphere',
      ambient: 'park breeze, distant accordion music, mixed European languages, occasional pigeons',
      light_character: 'soft Parisian daylight with iron tower casting intricate shadow patterns onto her',
      compatible: ['outdoor'],
    },
    fr_paris_marais: {
      label: '🇫🇷 巴黎 · 瑪黑區',
      keywords: 'Le Marais district in Paris, medieval cobblestone streets, wrought-iron balconies, boutique storefronts, 17th century architecture',
      ambient: 'French café chatter, distant church bells, footsteps on cobblestone, boutique bells',
      light_character: 'warm stone wall reflections and narrow street light creating dramatic half-shadow on her face',
      compatible: ['outdoor'],
    },
    it_milano_duomo: {
      label: '🇮🇹 米蘭 · Duomo 大教堂',
      keywords: 'Piazza del Duomo in Milan, gothic marble cathedral facade with intricate spires, open plaza with pigeons, European elegance',
      ambient: 'cathedral bells, pigeons flapping, Italian chatter, grand plaza ambience',
      light_character: 'bright Italian sun bouncing off white marble, creating soft fill light on her face',
      compatible: ['outdoor'],
    },

    // 🇺🇸 美國
    us_ny_brooklyn_bridge: {
      label: '🇺🇸 紐約 · 布魯克林大橋',
      keywords: 'Brooklyn Bridge in New York, stone arches and steel cables, Manhattan skyline visible in background, pedestrian walkway',
      ambient: 'wind over East River, distant traffic, cyclist bells, NYC urban hum',
      light_character: 'golden hour backlight through cable structure, warm halo around her hair',
      compatible: ['outdoor'],
    },
    us_ny_soho: {
      label: '🇺🇸 紐約 · SoHo',
      keywords: 'SoHo district Manhattan New York, cast-iron architecture facades, cobblestone streets, fashion boutiques, industrial chic',
      ambient: 'NYC street ambience, yellow cab passing, distant construction, chic boutique door chimes',
      light_character: 'reflective cast-iron facades bouncing directional light, creating editorial fashion lighting on her',
      compatible: ['outdoor'],
    },
    us_sf_golden_gate: {
      label: '🇺🇸 舊金山 · 金門大橋',
      keywords: 'Golden Gate Bridge in San Francisco, iconic international orange suspension bridge in background, bay waters, Marin headlands',
      ambient: 'bay wind, distant fog horn, seagulls, Pacific ocean sounds',
      light_character: 'bridge orange color reflecting warm glow on her skin, sea mist softening light',
      compatible: ['outdoor'],
    },
  };

  // ─── 場景預設環境音(沒選地標時用)────────────────────
  //  註:light_interaction 為休眠欄位(v5.17 起不餵進 prompt)
  const DEFAULT_AMBIENT_BY_SCENE_TYPE = {
    indoor: {
      light_interaction: 'window light spilling onto her face from one side, soft shadow cast behind her on the wall, skin tone naturally shifting with indoor color temperature',
      ambient_sound: 'soft indoor ambience, distant household sounds, subtle room tone',
    },
    outdoor: {
      light_interaction: 'natural daylight interacting with her face and hair, environmental shadows from surroundings, skin color reflecting environment tones',
      ambient_sound: 'natural outdoor ambience, subtle wind, distant environmental sounds',
    },
  };

  // ─── 防貼上去感 + 接地陰影(不打臉)──────────────────
  //  v5.18:加回「腳/手/商品 與 地板/桌面 的接觸陰影」——避免商品或人浮空、貼上去感。
  //         但刻意只「接地」、不碰臉(臉部打光才是烤肉網來源,維持拔除)。
  const SCENE_HUMAN_INTEGRATION = 'the subject is naturally part of the scene, lit consistently with the surroundings, with soft natural contact shadows where her feet, hands, and any product or object touch the ground or surfaces, so nothing looks like it is floating or pasted on top';

  // ─── 🔧 濾除「會在臉上畫紋理/網格/紅斑」的詞 ──────────
  //  場景庫(kol-universal-scenes.js)很多 env_prompt 內建了
  //  film grain / ISO / visible skin pores / peach fuzz / skin texture / skin details,
  //  fast 模型會把這些畫成烤肉網或臉部紅斑。在組裝時統一清掉,
  //  不必逐一改 19 個場景,且新場景也自動受保護。
  function stripSkinTextureNoise(text) {
    if (!text) return text;
    return text
      .replace(/\s*,?\s*(?:35mm\s+)?film grain/gi, '')
      .replace(/\s*,?\s*ISO\s?\d+(?:-\d+)?/gi, '')
      .replace(/\s*,?\s*(?:visible\s+|natural\s+)?skin\s+pores(?:\s+and\s+peach\s+fuzz)?(?:\s+visible)?/gi, '')
      .replace(/\s*,?\s*(?:visible\s+|natural\s+)?skin\s+(?:texture|details?)/gi, '')
      .replace(/\s*,?\s*peach\s+fuzz/gi, '')
      // 收尾:清掉殘留的雙逗號 / 頭尾逗號 / 多空格
      .replace(/\s*,(\s*,)+/g, ',')
      .replace(/^\s*,\s*/, '')
      .replace(/\s*,\s*$/, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  /**
   * 產出環境段落
   */
  function contribute(ctx) {
    const parts = [];
    const scene = ctx.scene || {};
    const sceneType = scene.type || (scene.indoor ? 'indoor' : 'outdoor');

    // 1. 基礎場景設定
    let settingText = scene.setting || scene.env_prompt || '';

    // 2. 🆕 地標組合式:疊在場景 setting 後面(室內外都吃 → 辦公室+東京=東京的辦公室)
    if (ctx.locationId && ctx.locationId !== 'none') {
      const ovLoc = LOCATIONS[ctx.locationId];
      if (ovLoc?.keywords) {
        settingText = settingText ? (settingText + ', ' + ovLoc.keywords) : ovLoc.keywords;
      }
    }

    // 🔧 v5.19:統一濾掉場景內建的「膚質/顆粒詞」
    //    (烤肉網 + 臉部紅斑兇手 —— 19 個場景的 env_prompt 都藏著
    //     visible skin pores / peach fuzz / skin texture / film grain / ISO)
    //    在這裡一次擋住,所有場景(連以後新加的)都自動乾淨,不用改場景庫。
    settingText = stripSkinTextureNoise(settingText);

    if (settingText) parts.push('in ' + settingText);

    // 3. 場景光線特徵(scene.light 現有)
    if (scene.light) parts.push(scene.light);

    // 4. ⚠️ v5.17 移除「環境光打到臉上」
    //    地標 light_character / 預設 light_interaction 全是 "on her face/skin",
    //    是烤肉網幫兇 → 不再餵入。setting + scene.light 已足夠建立光線,臉交給參考照。
    //    (loc 仍保留,給下面第 5 段環境音用)
    const loc = ctx.locationId && ctx.locationId !== 'none' ? LOCATIONS[ctx.locationId] : null;

    // 5. 環境音(讓 KOL 有反應對象)
    const ambientSound = loc?.ambient
      || DEFAULT_AMBIENT_BY_SCENE_TYPE[sceneType]?.ambient_sound;
    if (ambientSound) parts.push('ambient audio includes ' + ambientSound);

    // 6. 防貼上去感(輕量,不打臉)
    parts.push(SCENE_HUMAN_INTEGRATION);

    // 7. 場景 extra(e.g. 特殊 props)
    if (scene.extra) parts.push(scene.extra);

    return parts.join(', ');
  }

  /**
   * 取得地標資料(UI 下拉用)
   */
  function get(id) {
    return LOCATIONS[id] || null;
  }

  function list() {
    return LOCATIONS;
  }

  function filterCompatible(sceneType) {
    const filtered = { none: LOCATIONS.none };
    for (const [id, loc] of Object.entries(LOCATIONS)) {
      if (id === 'none') continue;
      if (loc.compatible?.includes(sceneType)) {
        filtered[id] = loc;
      }
    }
    return filtered;
  }

  // ─── 導出 + 自動向總導演註冊 ─────────────────────────
  window.KolEnvironment = {
    LOCATIONS,
    SCENE_HUMAN_INTEGRATION,
    contribute,
    get,
    list,
    filterCompatible,
  };

  // 向後相容:kol.html 仍會用到 window.LOCATIONS
  window.LOCATIONS = LOCATIONS;

  if (window.CrewDirector?.register) {
    // 用 'environment' 取代舊的 'locations' key
    window.CrewDirector.register('environment', window.KolEnvironment);
  }

  console.log('[KolEnvironment] 🌆 v5.19 就緒 · ' + Object.keys(LOCATIONS).length + ' 個地標 · 環境光不打臉 + 接地陰影 + 濾膚質詞');
})();
