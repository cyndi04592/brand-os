// ════════════════════════════════════════════════════════════════════
//  kol-environment.js · v5.12
//  
//  🌆 環境組 — 場景 × 地標 × 環境光融合 × 環境音
//  
//  (取代 v5.11 的 kol-locations.js,概念升級)
//  
//  職責:
//   • 地標庫(22 個真實地標 · 未來可從 GAS 動態載入)
//   • 🔥 環境光融合規則(光落在臉上、陰影、色溫反射到皮膚)
//   • 🔥 環境音描述(不強制,但生成時自動加入)
//   • 🔥 人景互動強制規則(避免人像 Photoshop 貼上去感)
//  
//  設計哲學(RA 2026-04-25):
//   「環境光與人的互動不要分離」— 人在這個環境裡,不是貼上去的
//   - 光要從場景投到臉上、肩膀
//   - 陰影要落在牆上、地板
//   - 色溫要反射到皮膚
//   - 環境音要讓 KOL 自然反應
// ════════════════════════════════════════════════════════════════════

(function () {
  'use strict';

  // ─── 地標庫 ────────────────────────────────────────────
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

  // ─── 場景預設環境光特徵(當沒選地標時用)────────────
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

  // ─── 🔥 核心:人景融合規則(必加進每個 prompt)──────
  const SCENE_HUMAN_INTEGRATION = 'critically important: the subject must feel physically present in the environment, not composited — environment light must fall on her skin with matching color temperature, shadows from her body must land realistically on nearby surfaces, her hair catches ambient light reflections, no visible Photoshop-layer separation between subject and background';

  /**
   * 產出環境段落(最核心的融合邏輯)
   */
  function contribute(ctx) {
    const parts = [];
    const scene = ctx.scene || {};
    const sceneType = scene.type || (scene.indoor ? 'indoor' : 'outdoor');

    // 1. 基礎場景設定
    let settingText = scene.setting || scene.env_prompt || '';
    // 🔧 拔掉 film grain / ISO(fast 模型會把顆粒畫成烤肉網)
    settingText = settingText
      .replace(/\s*,?\s*(?:35mm\s+)?film grain/gi, '')
      .replace(/\s*,?\s*ISO\s?\d+(?:-\d+)?/gi, '');

    // 2. 戶外場景可用地標 override
    if (sceneType === 'outdoor' && ctx.locationId && ctx.locationId !== 'none') {
      const loc = LOCATIONS[ctx.locationId];
      if (loc?.keywords && loc.compatible?.includes('outdoor')) {
        settingText = loc.keywords;
      }
    }
    if (settingText) parts.push('in ' + settingText);

    // 3. 場景光線特徵(scene.light 現有)
    if (scene.light) parts.push(scene.light);

    // 4. 🔥 環境光與人的互動(地標級 > 場景級 > 預設)
    const loc = ctx.locationId && ctx.locationId !== 'none' ? LOCATIONS[ctx.locationId] : null;
    const lightInteraction = loc?.light_character
      || DEFAULT_AMBIENT_BY_SCENE_TYPE[sceneType]?.light_interaction;
    if (lightInteraction) parts.push(lightInteraction);

    // 5. 🔥 環境音(自然加入讓 KOL 有反應對象)
    const ambientSound = loc?.ambient
      || DEFAULT_AMBIENT_BY_SCENE_TYPE[sceneType]?.ambient_sound;
    if (ambientSound) parts.push('ambient audio includes ' + ambientSound);

    // 6. 🔥 人景融合強制規則(這是關鍵)
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

  console.log('[KolEnvironment] 🌆 v5.12 就緒 · ' + Object.keys(LOCATIONS).length + ' 個地標 + 人景融合');
})();
