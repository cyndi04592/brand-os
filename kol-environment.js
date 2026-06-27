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

 // 🏛️ 地標庫(組合式 · 疊在場景 setting 後面,室內外都吃)
const LOCATIONS = {
  none: { label: '— 不指定地標 —', keywords: null },

  // ── 🇯🇵 日本・東京 ──
  jp_shibuya:    { label: '🇯🇵 東京・涉谷',     keywords: 'in Shibuya, Tokyo, Japan, busy neon-lit urban district' },
  jp_ueno:       { label: '🇯🇵 東京・上野',     keywords: 'in Ueno, Tokyo, Japan, traditional downtown shitamachi feel' },
  jp_harajuku:   { label: '🇯🇵 東京・原宿',     keywords: 'in Harajuku, Tokyo, Japan, colorful youthful street-fashion vibe' },
  jp_omotesando: { label: '🇯🇵 東京・表參道',   keywords: 'on Omotesando, Tokyo, Japan, tree-lined upscale boulevard' },
  jp_ginza:      { label: '🇯🇵 東京・銀座',     keywords: 'in Ginza, Tokyo, Japan, elegant high-end shopping streets' },
  jp_asakusa:    { label: '🇯🇵 東京・淺草',     keywords: 'in Asakusa, Tokyo, Japan, old-town temple-district atmosphere' },
  jp_shinjuku:   { label: '🇯🇵 東京・新宿',     keywords: 'in Shinjuku, Tokyo, Japan, dense neon nightlife backdrop' },
  jp_kawagoe:    { label: '🇯🇵 東京近郊・川越', keywords: 'in Kawagoe near Tokyo, Japan, retro little-Edo warehouse streets' },
  jp_asagaya:    { label: '🇯🇵 東京・阿佐谷',   keywords: 'in Asagaya, Tokyo, Japan, cozy local shopping-arcade neighborhood' },
  jp_yamanote:   { label: '🇯🇵 東京・山手線沿線', keywords: 'along the Yamanote line, Tokyo, Japan, everyday train-window cityscape' },
  jp_hakonegasaki: { label: '🇯🇵 東京・箱根崎', keywords: 'in Hakonegasaki, Mizuho, western Tokyo, Japan, quiet suburban local town' },

  // ── 🇯🇵 日本・大阪 ──
  jp_dotonbori:    { label: '🇯🇵 大阪・道頓堀',   keywords: 'in Dotonbori, Osaka, Japan, vivid canal-side neon signboards' },
  jp_shinsaibashi: { label: '🇯🇵 大阪・心齋橋',   keywords: 'in Shinsaibashi, Osaka, Japan, lively covered shopping arcade' },
  jp_osaka_castle: { label: '🇯🇵 大阪・大阪城',   keywords: 'near Osaka Castle, Japan, historic castle-park backdrop' },

  // ── 🇯🇵 日本・京都 ──
  jp_kiyomizu:   { label: '🇯🇵 京都・清水寺',   keywords: 'near Kiyomizu-dera, Kyoto, Japan, traditional wooden temple streets' },
  jp_arashiyama: { label: '🇯🇵 京都・嵐山',     keywords: 'in Arashiyama, Kyoto, Japan, bamboo-grove and riverside scenery' },
  jp_gion:       { label: '🇯🇵 京都・祇園',     keywords: 'in Gion, Kyoto, Japan, old machiya geisha-district lanes' },

  // ── 🇯🇵 日本・沖繩 ──
  jp_kokusai:    { label: '🇯🇵 沖繩・國際通',   keywords: 'on Kokusai Street, Okinawa, Japan, breezy tropical island main street' },
  jp_okinawa_beach: { label: '🇯🇵 沖繩・海濱',  keywords: 'on an Okinawa beach, Japan, turquoise sea and white sand' },

  // ── 🇯🇵 日本・福岡 ──
  jp_tenjin:     { label: '🇯🇵 福岡・天神',     keywords: 'in Tenjin, Fukuoka, Japan, relaxed southern-city shopping district' },
  jp_nakasu:     { label: '🇯🇵 福岡・中洲',     keywords: 'in Nakasu, Fukuoka, Japan, riverside yatai food-stall night scene' },

  // ── 🇯🇵 日本・北海道 ──
  jp_sapporo:    { label: '🇯🇵 北海道・札幌',   keywords: 'in Sapporo, Hokkaido, Japan, clean northern-city streets' },
  jp_otaru:      { label: '🇯🇵 北海道・小樽',   keywords: 'by the Otaru canal, Hokkaido, Japan, nostalgic gaslit warehouse waterfront' },
  jp_furano:     { label: '🇯🇵 北海道・富良野', keywords: 'in Furano, Hokkaido, Japan, rolling flower-field countryside' },

  // ── 🇹🇼 台灣 ──
  tw_taipei_101:     { label: '🇹🇼 台北・信義 101', keywords: 'in Xinyi, Taipei, Taiwan, modern district by Taipei 101 tower' },
  tw_yongkang:       { label: '🇹🇼 台北・永康街',   keywords: 'on Yongkang Street, Taipei, Taiwan, leafy café-and-teahouse lane' },
  tw_jiufen:         { label: '🇹🇼 九份',           keywords: 'in Jiufen, Taiwan, lantern-lit hillside old-street with sea view' },
  tw_shenji:         { label: '🇹🇼 台中・審計新村', keywords: 'in Shenji Village, Taichung, Taiwan, pastel creative-market dormitories' },
  tw_shennong:       { label: '🇹🇼 台南・神農街',   keywords: 'on Shennong Street, Tainan, Taiwan, historic old-capital lane' },
  tw_pier2:          { label: '🇹🇼 高雄・駁二',     keywords: 'at Pier-2 Art Center, Kaohsiung, Taiwan, harborside warehouse art district' },
  tw_hualien:        { label: '🇹🇼 花蓮',           keywords: 'in Hualien, Taiwan, mountain-and-ocean east-coast scenery' },

  // ── 🇭🇰 香港 ──
  hk_central:  { label: '🇭🇰 香港・中環',   keywords: 'in Central, Hong Kong, dense glass-skyscraper financial district' },
  hk_tst:      { label: '🇭🇰 尖沙咀',       keywords: 'in Tsim Sha Tsui, Hong Kong, Victoria Harbour waterfront skyline' },
  hk_mongkok:  { label: '🇭🇰 旺角',         keywords: 'in Mong Kok, Hong Kong, crowded neon street-market energy' },

  // ── 🇨🇳 中國 ──
  cn_bund:     { label: '🇨🇳 上海・外灘',   keywords: 'on the Bund, Shanghai, China, riverfront colonial-and-skyline view' },
  cn_beijing:  { label: '🇨🇳 北京',         keywords: 'in Beijing, China, blend of historic hutong and modern city' },
  cn_chengdu:  { label: '🇨🇳 成都',         keywords: 'in Chengdu, China, laid-back teahouse-and-alley culture' },

  // ── 🇸🇬 新加坡 ──
  sg_marina:   { label: '🇸🇬 新加坡・濱海灣', keywords: 'at Marina Bay, Singapore, iconic waterfront and modern skyline' },
  sg_chinatown:{ label: '🇸🇬 新加坡・牛車水', keywords: 'in Chinatown, Singapore, colorful shophouse streets' },
  sg_orchard:  { label: '🇸🇬 新加坡・烏節路', keywords: 'on Orchard Road, Singapore, upscale tropical shopping boulevard' },

  // ── 🇲🇾 馬來西亞 ──
  my_kl:       { label: '🇲🇾 吉隆坡',       keywords: 'in Kuala Lumpur, Malaysia, by the Petronas Twin Towers skyline' },
  my_penang:   { label: '🇲🇾 檳城',         keywords: 'in George Town, Penang, Malaysia, heritage shophouse-and-street-art town' },
  my_malacca:  { label: '🇲🇾 麻六甲',       keywords: 'in Malacca, Malaysia, historic riverside old-town' },

  // ── 🇺🇸 美國 ──
  us_ny:       { label: '🇺🇸 紐約',         keywords: 'in New York City, USA, iconic Manhattan street energy' },
  us_sf:       { label: '🇺🇸 舊金山',       keywords: 'in San Francisco, USA, hilly streets and bay-area light' },
  us_la:       { label: '🇺🇸 洛杉磯',       keywords: 'in Los Angeles, USA, sunny palm-lined California vibe' },
  us_vegas:    { label: '🇺🇸 拉斯維加斯',   keywords: 'in Las Vegas, USA, dazzling casino-strip nightscape' },

  // ── 🇪🇺 歐洲 ──
  eu_paris:    { label: '🇫🇷 巴黎',         keywords: 'in Paris, France, elegant Haussmann boulevards and café culture' },
  eu_london:   { label: '🇬🇧 倫敦',         keywords: 'in London, UK, classic red-brick streets and grey-sky charm' },
  eu_amsterdam:{ label: '🇳🇱 阿姆斯特丹',   keywords: 'in Amsterdam, Netherlands, canal-side gabled houses and bikes' },
  eu_prague:   { label: '🇨🇿 布拉格',       keywords: 'in Prague, Czechia, fairytale old-town cobblestone squares' },

  // ── 🇮🇹 義大利 ──
  it_rome:     { label: '🇮🇹 羅馬',         keywords: 'in Rome, Italy, ancient ruins and timeless piazzas' },
  it_milan:    { label: '🇮🇹 米蘭',         keywords: 'in Milan, Italy, chic fashion-capital streets' },
  it_venice:   { label: '🇮🇹 威尼斯',       keywords: 'in Venice, Italy, romantic canals and gondolas' },
  it_florence: { label: '🇮🇹 佛羅倫斯',     keywords: 'in Florence, Italy, Renaissance terracotta-roof old town' },
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

  // ─── 物理接地(接觸陰影 · 不打臉)──────────────────
  //  v5.18:加回「腳/手/商品 與 地板/桌面 的接觸陰影」——避免商品或人浮空。
  //         但刻意只「接地」、不碰臉(臉部打光才是烤肉網來源,維持拔除)。
  //  v5.22:只留物理接地。「自然融入場景 / 統一光線 / 不貼上去」交給攝影師
  //         SCENE_REALISM(統一色調整合),這裡不再重複講,去掉語意疊字。
  const SCENE_HUMAN_INTEGRATION = 'soft natural contact shadows where her feet, hands and any product or object touch the ground or surfaces, so she and the product stay physically grounded and never appear to float';
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

  // ════════════════════════════════════════════════════════════════════
  //  🆕 v5.20 · 場景參考圖(Riiv③)— 鎖跨段背景一致
  //  跟 kol-wardrobe 的 generateOutfitRefImage 同一套做法:
  //   • flux 純文字出圖 → 生「空場景(無人)」當背景錨點
  //   • 整支接片共用同一張 → 背景/佈局不再跨段飄
  //   • 回傳圖 URL;生不出來回 null(呼叫端容錯,照舊純文字)
  // ════════════════════════════════════════════════════════════════════
  const EV_WORKER_URL = 'https://kol-proxy.calm-sunset-6b66.workers.dev';
  const EV_WORKER_PW  = 'raby2026';
  async function evCallWorker(action, params) {
    const res = await fetch(EV_WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ action, password: EV_WORKER_PW }, params || {})),
    });
    let data;
    try { data = await res.json(); }
    catch (e) { throw new Error(`[${action}] 回應不是 JSON(HTTP ${res.status})`); }
    if (data && data.ok === false) throw new Error(`[${action}] ${data.error || '未知錯誤'}`);
    return data;
  }

  // 抽「場景文字」— 跟 composeSeedancePrompt 同一套真相(setting/env_prompt + 地標 + 光線)
  //   → 確保「場景參考圖」跟「prompt 文字」描述的是同一個場景
  //   ctx 可給:{ scene:{...} } 直接帶物件,或 { brandId, sceneId } 由這裡自己解析
  function resolveSceneText(ctx) {
    ctx = ctx || {};
    let scene = ctx.scene;
    if (!scene && ctx.sceneId && typeof window.getScenesForBrand === 'function') {
      const scenes = window.getScenesForBrand(ctx.brandId) || {};
      scene = scenes[ctx.sceneId];
    }
    scene = scene || {};
    let settingText = scene.setting || scene.env_prompt || '';
    const locId = ctx.locationId;
    if (locId && locId !== 'none') {
      const loc = LOCATIONS[locId];
      if (loc && loc.keywords) settingText = settingText ? (settingText + ', ' + loc.keywords) : loc.keywords;
    }
    settingText = stripSkinTextureNoise(settingText);
    if (scene.light) settingText = settingText ? (settingText + ', ' + scene.light) : scene.light;
    return (settingText || '').trim();
  }

  /**
   * 🏠 自動生「空場景(無人)參考圖」當背景錨(Phase 1:鎖場景跨段一致)
   *   - 刻意無人:只要環境/佈局,人交給 [Image1] KOL 照
   *   - 室內外通吃(用「location / environment」不用「room」)
   * @param {object} ctx  { brandId, sceneId, locationId } 或 { scene, locationId }
   * @returns {Promise<string|null>}
   */
  async function generateSceneRefImage(ctx) {
    const sceneText = resolveSceneText(ctx);
    if (!sceneText) { console.warn('[KolEnvironment] 沒有場景文字,跳過場景參考圖'); return null; }

    const prompt =
      'Establishing background photograph of a location, clean realistic style. ' +
      'The location is: ' + sceneText + '. ' +
      'A wide full view of the whole environment showing its complete layout, structures and background. ' +
      'The scene is empty with no people, no person and no human anywhere in the frame, just the environment itself. ' +
      'Consistent soft natural lighting, realistic photographic detail, true accurate colors, ' +
      'avoid dense repeating grid patterns: no venetian blinds, no louvre slats, no dense multi-pane window grilles or tight mullion grids; prefer plain simple glass windows and smooth clean surfaces. ' +
      'one single fixed wide establishing shot of the place only.';

    try {
      const r = await evCallWorker('fal_image_submit', {
        prompt,
        aspect_ratio: '9:16',    // 跟直幅影片同比例,背景對得上
        num_images: 1,
        output_format: 'jpeg',
      });
      const url = (r && r.images && r.images[0] && r.images[0].url) || null;
      if (url) console.log('[KolEnvironment] 🏠 場景參考圖已生成 →', url);
      else     console.warn('[KolEnvironment] 影像引擎回應無圖:', JSON.stringify(r).slice(0, 200));
      return url;
    } catch (e) {
      console.warn('[KolEnvironment] 場景參考圖生成失敗(照舊純文字):', e.message);
      return null;
    }
  }

  // ─── 導出 + 自動向總導演註冊 ─────────────────────────
  window.KolEnvironment = {
    LOCATIONS,
    SCENE_HUMAN_INTEGRATION,
    contribute,
    get,
    list,
    filterCompatible,
    resolveSceneText,        // 🆕 v5.20
    generateSceneRefImage,   // 🆕 v5.20
  };

  // 向後相容:kol.html 仍會用到 window.LOCATIONS
  window.LOCATIONS = LOCATIONS;

  if (window.CrewDirector?.register) {
    // 用 'environment' 取代舊的 'locations' key
    window.CrewDirector.register('environment', window.KolEnvironment);
  }

  console.log('[KolEnvironment] 🌆 v5.22 就緒 · ' + Object.keys(LOCATIONS).length + ' 個地標 · 環境光不打臉 + 物理接地(去重·融入交給攝影師) + 濾膚質詞 + 場景參考圖(generateSceneRefImage·鎖跨段背景)');
})();
