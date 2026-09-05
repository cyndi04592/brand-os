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
  // ═══════════════════════════════════════════════════════════════════════
  //  🪣🔒 2026-09-05 白標:場景圖轉存自家 R2 + 內部診斷收進保險絲
  //  ─────────────────────────────────────────────────────────────────────
  //  ★ 破口一(Network):單張場景圖原本直接回傳影像引擎的網址,
  //    瀏覽器一載入,Network 分頁就列出供應商網域。九宮格那條路徑早就有轉存,
  //    但【單張這條沒有】—— 而它正是九宮格關閉或失敗時的退路。
  //  ★ 破口二(Console):這支檔案多處 console.log 直接印圖片網址,沒有保險絲。
  //  ★ 沿用既有 scene_grid 動作,不動 Worker;失敗沿用原網址,不擋生成。
  // ═══════════════════════════════════════════════════════════════════════
  function _evdbg() {
    if (typeof window === 'undefined' || window.KOL_DEBUG !== true) return;
    try { console.log.apply(console, arguments); } catch (_) {}
  }
  function _evKey(brandId, sceneId, tag) {
    const raw = String(brandId || 'b') + '|' + String(sceneId || '') + '|' + String(tag || '');
    let h = 0;
    for (let i = 0; i < raw.length; i++) h = ((h << 5) - h + raw.charCodeAt(i)) | 0;
    return 'scene1_' + (h >>> 0).toString(36);
  }
  async function _evToR2(ctx, url, tag) {
    if (!url || /cdn\.raby\.com\.tw/.test(url)) return url;
    try {
      const st = await evCallWorker('scene_grid', {
        brandId: (ctx && ctx.brandId) || 'b',
        sceneKey: _evKey(ctx && ctx.brandId, (ctx && (ctx.sceneId || ctx.locationId)) || '', tag),
        storeUrl: url,
      });
      if (st && st.ok && st.url) return st.url;
    } catch (e) { _evdbg('[KolEnvironment] 🪣 轉存失敗,沿用原網址:', e.message); }
    return url;
  }

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
    if (!sceneText) { _evdbg('[KolEnvironment] 沒有場景文字,跳過場景參考圖'); return null; }

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
      if (!url) { _evdbg('[KolEnvironment] 影像引擎回應無圖:', JSON.stringify(r).slice(0, 200)); return null; }
      const durable = await _evToR2(ctx, url, 'single');   // 🪣 白標 + 不過期
      _evdbg('[KolEnvironment] 🏠 場景參考圖已生成 →', durable);
      return durable;
    } catch (e) {
      _evdbg('[KolEnvironment] 場景參考圖生成失敗(照舊純文字):', e.message);
      return null;
    }
  }

  /**
   * 🗺️ v5.23 場景九宮格(場景飄的治本):兩步生一張「多角度空間庫」
   *   ① nano-banana-pro t2i 生平面藍圖(定義窗/門/櫃/架/家具位置 = 空間骨架)
   *   ② nano-banana-pro edit 依藍圖生一張九宮格(8 角度 + 平面圖),每個 Shot 從中取一角度
   *   → 牆面大結構跨格鎖死;獨立家具會微飄(模型天花板),故 prompt 點名鎖形狀+數量壓到最小。
   *   session 快取:同 brand+scene 一次 session 不重生(省 $0.45)。失敗回 null → stitch 退回單張場景圖。
   *   ⚠️ 資產級 pro,一次性生、影片重用。durable 跨 session 持久化 = 驗過再補(Worker scene_grid)。
   *   Console 可單獨驗:await window.KolEnvironment.generateSceneGrid({ brandId, sceneId, locationId })
   * @param {object} ctx  { brandId, sceneId, locationId } 或 { scene, locationId }
   * @returns {Promise<string|null>}  九宮格圖網址
   */
  // 把實景照網址壓成短雜湊,當快取鍵的一部分(換照片就換一格快取)
  function _hash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) { h = ((h << 5) - h + str.charCodeAt(i)) | 0; }
    return Math.abs(h).toString(36);
  }

  async function generateSceneGrid(ctx) {
    ctx = ctx || {};
    const sceneText = resolveSceneText(ctx);

    // 🆕 2026-08-23:實景照為輸入的 image-to-image 路徑。
    //   背景:舊版只吃「場景卡的文字」→ 叫 AI 從無到有畫一個想像的空間,
    //   完全用不到客戶上傳的實景照,而且回傳值會【覆蓋】sceneImageUrl ——
    //   等於客戶上傳了自家門市,系統卻用一個假空間蓋掉它,與需求正好相反。
    //   ★ 客戶要的是「用我的真實空間,生出其他角度」,不是「生一個假的」。
    //   ★ Worker 的 nanobanana_pro 傳 image_urls 就會自動切
    //     fal-ai/nano-banana-pro/edit(image-to-image),上限 10 張,不用改後端。
    const realShot = String(ctx.sceneImageUrl || '').trim();

    //   快取鍵要含實景照 —— 否則同一個 sceneId 下,
    //   「想像空間」與「客戶真實空間」會共用同一格快取而互相污染。
    const cacheKey = (ctx.brandId || 'b') + '|' + (ctx.sceneId || ctx.locationId || 'default')
      + (realShot ? '|real' + _hash(realShot) : '');
    window._sceneGridCache = window._sceneGridCache || {};
    if (window._sceneGridCache[cacheKey]) {
      _evdbg('[KolEnvironment] 🗺️ 九宮格快取命中(不重生)→', window._sceneGridCache[cacheKey]);
      return window._sceneGridCache[cacheKey];
    }

    // 🆕 v5.25 durable:先查 R2 有沒有這場景的九宮格(生一次·之後所有影片秒回·不即時生=不 524、不重花)
    try {
      const q = await evCallWorker('scene_grid', { brandId: ctx.brandId || 'b', sceneKey: cacheKey });
      if (q && q.url) {
        _evdbg('[KolEnvironment] 🗺️ 九宮格 R2 命中(不重生·秒回)→', q.url);
        window._sceneGridCache[cacheKey] = q.url;
        return q.url;
      }
    } catch (e) { _evdbg('[KolEnvironment] 九宮格 R2 查詢略過:', e.message); }

    try {
      // ═══ 路徑 A:有客戶實景照 → 直接用真照生多角度(image-to-image)═══
      //   刻意【跳過藍圖】:藍圖是為了「無中生有」而存在的骨架,
      //   已經有真實空間照時再過一次藍圖,反而會把真實細節洗成示意圖。
      if (realShot) {
        _evdbg('[KolEnvironment] 🗺️ 走實景照多角度(image-to-image)→', realShot);
        const realPrompt =
          'This photograph is the REAL location. Reproduce THIS EXACT SPACE — same walls, same colours, ' +
          'same furniture, same fixtures, same signage, same flooring, same lighting character. ' +
          'Output ONE image: a clean 3x3 grid of 9 panels, all showing this IDENTICAL empty place from different angles ' +
          '(no people, no person in any panel). ' +
          'Panel 1: the original wide establishing view. Panel 2: left side. Panel 3: right side. ' +
          'Panel 4: reverse angle looking back. Panel 5: high overhead corner view. ' +
          'Panel 6: close view of a key fixture visible in the photo. Panel 7: close view of the main desk or table surface, ' +
          'showing exactly the objects that are really on it. Panel 8: view toward the entrance. ' +
          'Panel 9: wider context of the same room. ' +
          '★ Invent NOTHING that is not in the source photograph — do not add, remove, restyle or recolour ' +
          'any furniture, monitor, keyboard, plant or decoration. Keep the count of every object identical across panels. ' +
          'Photorealistic, consistent, evenly lit, no text overlays, no grid lines drawn on the image.';
        const rR = await evCallWorker('nanobanana_pro', {
          image_urls: [realShot], prompt: realPrompt, aspect_ratio: '1:1', resolution: '2K',
        });
        const rUrl = (rR && rR.images && rR.images[0] && rR.images[0].url) || null;
        if (!rUrl) {
          //   失敗就退回客戶原本那張真照 —— 絕不退回「AI 想像的空間」,
          //   那會讓客戶的門市消失,比沒有九宮格更糟。
          _evdbg('[KolEnvironment] 實景多角度生成無圖 → 退回原實景照');
          return realShot;
        }
        _evdbg('[KolEnvironment] 🗺️ 實景多角度已生成 →', rUrl);
        let realFinal = rUrl;
        try {
          const st = await evCallWorker('scene_grid', { brandId: ctx.brandId || 'b', sceneKey: cacheKey, storeUrl: rUrl });
          if (st && st.url) { realFinal = st.url; _evdbg('[KolEnvironment] 🗺️ 已存 R2(之後重用)→', realFinal); }
        } catch (e) { _evdbg('[KolEnvironment] 存 R2 略過(用原網址):', e.message); }
        window._sceneGridCache[cacheKey] = realFinal;
        return realFinal;
      }

      // ═══ 路徑 B:沒有實景照 → 舊路,文字 → 藍圖 → 九宮格 ═══
      //   這條才需要場景文字(要靠它無中生有);路徑 A 有真照就不需要。
      if (!sceneText) { _evdbg('[KolEnvironment] 沒有場景文字也沒有實景照,跳過九宮格'); return null; }
      // ① 平面藍圖 = 空間骨架
      const bpPrompt =
        'Top-down architectural floor-plan blueprint of this location: ' + sceneText + '. ' +
        'Clean black-line blueprint on white. Clearly place and label the main fixed structures ' +
        '(entrance, windows, wall shelving or cabinets, counter) and the freestanding furniture, ' +
        'with simple text labels. Simple, precise, readable.';
      const bpR = await evCallWorker('nanobanana_pro', {
        prompt: bpPrompt, aspect_ratio: '1:1', resolution: '2K',
      });
      const bpUrl = (bpR && bpR.images && bpR.images[0] && bpR.images[0].url) || null;
      if (!bpUrl) { _evdbg('[KolEnvironment] 藍圖生成無圖:', JSON.stringify(bpR).slice(0, 200)); return null; }
      _evdbg('[KolEnvironment] 🗺️ 藍圖已生成 →', bpUrl);

      // ② 依藍圖生九宮格(點名鎖獨立家具,壓漂移)
      const gridPrompt =
        'Use this floor plan as the EXACT spatial layout of the location described as: ' + sceneText + '. ' +
        'Output ONE image: a clean 3x3 grid of 9 panels, all showing the IDENTICAL empty place (no people, no person), ' +
        'the same fixed structures, materials, colours and lighting across every panel. ' +
        'Panel 1: wide front establishing view. Panel 2: left side. Panel 3: right side. ' +
        'Panel 4: reverse angle looking back toward the entrance. Panel 5: high overhead corner view. ' +
        'Panel 6: close view of a key fixture. Panel 7: close view of the central furniture. ' +
        'Panel 8: entrance or doorway view from inside. Panel 9: the top-down floor plan. ' +
        'IMPORTANT — keep every freestanding item identical in shape and count across all panels ' +
        '(same benches, same number of stools or chairs, same tables); do not add, remove or reshape furniture between panels. ' +
        'Photorealistic, consistent, evenly lit, no text overlays.';
      const gR = await evCallWorker('nanobanana_pro', {
        image_urls: [bpUrl], prompt: gridPrompt, aspect_ratio: '1:1', resolution: '2K',
      });
      const gUrl = (gR && gR.images && gR.images[0] && gR.images[0].url) || null;
      if (!gUrl) { _evdbg('[KolEnvironment] 九宮格生成無圖:', JSON.stringify(gR).slice(0, 200)); return null; }
      _evdbg('[KolEnvironment] 🗺️ 九宮格已生成 →', gUrl);

      // 🆕 v5.25 durable:生完存進 R2,回 durable 網址(下次起秒回·不重生不重花)
      let finalUrl = gUrl;
      try {
        const st = await evCallWorker('scene_grid', { brandId: ctx.brandId || 'b', sceneKey: cacheKey, storeUrl: gUrl });
        if (st && st.url) { finalUrl = st.url; _evdbg('[KolEnvironment] 🗺️ 九宮格已存 R2(之後重用)→', finalUrl); }
      } catch (e) { _evdbg('[KolEnvironment] 九宮格存 R2 略過(用原網址):', e.message); }

      window._sceneGridCache[cacheKey] = finalUrl;
      return finalUrl;
    } catch (e) {
      _evdbg('[KolEnvironment] 九宮格生成失敗(退回單張場景圖):', e.message);
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
    generateSceneGrid,       // 🆕 v5.23 場景九宮格(多角度空間庫)
  };

  // 向後相容:kol.html 仍會用到 window.LOCATIONS
  window.LOCATIONS = LOCATIONS;

  if (window.CrewDirector?.register) {
    // 用 'environment' 取代舊的 'locations' key
    window.CrewDirector.register('environment', window.KolEnvironment);
  }

  console.log('[KolEnvironment] 🌆 v5.26 就緒 · 🪣單張場景圖轉存R2(白標·不過期) · 🔒診斷收進KOL_DEBUG · v5.25 · ' + Object.keys(LOCATIONS).length + ' 個地標 · 環境光不打臉 + 物理接地 + 濾膚質詞 + 場景參考圖(單張) + 🗺️九宮格(generateSceneGrid·藍圖→8角度空間庫·2K避6000px·durable R2(生一次重用·治524逾時+不重花)·點名鎖家具)');
})();
