// ═══════════════════════════════════════════════════════════════════════
//  admaker-prompt-lean.js · v2.9 (2026-10-24)  v2.9:重拍場景改由「版型×風格×情境」組出來 + 動作/機位/光各自抽(不再只有 6 張)
//                                     + RA 參考大片手法庫(16 人像/8 靜物)+ 28 個情境全部改成配色/材質/光,不擺節慶道具
//                                     v2.8:重拍的字只剩商品印刷+標題(治 AI 自編價格牌)
//  廣告圖「精簡提示詞引擎」—— 取代 admaker.js 的 buildPosterPrompt(約 7,000 字)
//
//  為什麼:RA 2026-10-22 實測同一張 MOZ 外套照 / 德訓鞋照
//    · 舊版 ~7,000 字 → 姿勢被改、補畫腿和球鞋、背景亂、像 AI 圖
//    · 短版 ~600~1,000 字(C2 範本)→ 「超好看就對了」
//    病根:十幾段規則把每句權重稀釋到沒有。跟 KOL 影片線 9/15、9/18 的鐵律一樣:
//    字數是一把尺、只寫事實、每段長度平均。
//
//  結構(照真的攝影師拍攝,每段一句):
//    ① 主體:照原圖(商品長相 / 模特兒同臉同姿勢)
//    ② 在哪裡拍 + 光從哪來 + 影子落在哪(人和背景被同一道光照到 → 真實感的關鍵)
//    ③ 構圖:主體佔大部分畫面、大膽裁切
//    ④ 情境 / 客人補充:各一句
//    ⑤ 字:字型口氣跟著品牌 Logo 走;品牌字為主、一行小字、不擋主體
//    ⑥ Logo 角落 + 配色 + 質感
//
//  範圍(第一期):類型 = 商品實拍 / 服飾穿搭(有模特兒)/ 未選;
//    版型 = 白棚攝影 / 極簡海報 / 情境寫真 / 雜誌封面 / 手持實拍 / 未選。
//    其他類型(美業、醫美、課程…有法規段)與圖解型版型(規格分解、多格…)照舊走原版。
//
//  保險絲:Console 輸入 window.AD_LEAN = false → 立刻退回舊版 buildPosterPrompt。
//  依賴 admaker.js 的全域:SELECTED_* / LAYOUT_TEMPLATES / REGIONAL_FLAVORS / CONTEXT_THEMES /
//    getBrandContext / detectBrandPack / _adSize / _dropPriceTalk / _dropLogoTalk / _stripPriceFigures
//  載入順序:index.html 在 admaker.js 之後。
// ═══════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  if (typeof window.buildPosterPrompt !== 'function') { console.warn('[AD_LEAN] 找不到 buildPosterPrompt,略過'); return; }
  if (window._buildPosterPromptOrig) return;   // 重複載入保護

  var ORIG = window.buildPosterPrompt;
  window._buildPosterPromptOrig = ORIG;
  if (window.AD_LEAN === undefined) window.AD_LEAN = true;

  var LEAN_TYPES   = ['', 'physical', 'apparel', 'apparel_keep', 'physical_reshoot'];
  var LEAN_LAYOUTS = ['', 'white_studio', 'minimal_poster', 'scene_lifestyle', 'magazine_cover', 'hand_hold'];

  // 真實光源(一個光源 + 方向),每張抽一個
  // v1.1:只留「硬光+具體影子圖案」—— RA 實測:柔光箱/陰天光出來平平的,
  //   55 分 / 超好看那幾張都是直射陽光 + 窗框影子同時落在牆上和主體上({S}=主體)
  var LIGHTS = [
    'afternoon sun through a window on the left',
    'low golden sun through tall windows on the right',
    'morning sun through half-open blinds on the left',
    'sunlight through leaves from the upper left',
  ];
  // v2.0 拍攝企劃(RA 2026-10-22:法則只能保證不出錯,好照片要「一個具體的畫面主意」放最前面)
  //   量尺結果(ruler.py):好圖 = 有顏色的中間調背景 + 硬光 → 飽和 25~35;
  //   壞圖 = 白/灰背景配深色主體 → 飽和 10~20、黑白兩極(明暗範圍 86~91),型錄感。
  //   {S}=主體、{P}=所有格(their/its)
  var CONCEPTS = {
    neutral: [
      'a warm beige plaster wall; hard late-afternoon sun comes through a window, the window-frame shadow falls across the wall and across {S}, and {P} own shadow lies on the wall beside',
      'a sand-coloured stucco wall outdoors; low golden sun rakes across its texture and across {S}, drawing long soft-edged shadows',
      'a pale sage-green painted wall; morning sun through leaves scatters dappled light and shade across the wall and across {S}',
    ],
    cool: [
      'a clear blue sky with a few soft clouds as the only background, seen from slightly below; strong direct sun from the upper left gives {S} crisp highlights and short shadows',
      'a clear powder-blue painted wall; hard sun from the right throws a crisp shadow of {S} onto the wall',
    ],
    warm: [
      'a terracotta-orange painted wall; hard midday sun from the right throws a crisp shadow of {S} onto the wall',
      'a soft pink plaster wall; hard sun from the left lays a long shadow of {S} across it',
    ],
  };
  function conceptFor(colourTxt) {
    var c = String(colourTxt || '').toLowerCase(), pool = CONCEPTS.neutral.slice();
    if (/blue|navy|sky|teal|nordic|aqua/.test(c)) pool = pool.concat(CONCEPTS.cool);
    if (/red|pink|orange|coral|terracotta|peach|magenta/.test(c)) pool = pool.concat(CONCEPTS.warm);
    if (!c) pool = pool.concat(CONCEPTS.cool, CONCEPTS.warm);
    return pick(pool);
  }

  // v2.1 重拍模式(RA 2026-10-22 實測「超屌,就是這個」):服飾 = 商品是衣服,不是原圖的模特兒。
  //   衣服照原樣,模特兒/姿勢/角度/場景全部重新設計 —— 跟 KOL 線一樣是「重新拍」,不是「改圖」。
  //   每一則 = 場景 + 姿勢/動作 + 機位 + 光(Pinterest 那種有一個主意的畫面)
  var RESHOOTS = [
    'shot from very low, looking up at the model against a clear saturated blue sky with a few white clouds; the model sits on top of a sunlit concrete wall, one knee up, hair blown by the wind, laughing toward the camera; strong direct afternoon sun from the left',
    'the model reaches one open hand toward the lens, the hand large and soft in the foreground, the face sharp behind it with a confident half-smile; bright midday sun on a city street, shallow depth of field',
    'the model crouches on a sunny rooftop edge, forearms resting on the knees, looking down into the lens; shot from below against a deep blue sky; hard sun from behind rims the hair',
    'the model leans against a saturated terracotta wall in hard late-afternoon sun, glancing sideways past the camera; a crisp shadow of the model falls on the wall',
    'the model walks toward the camera along an empty sunlit street, mid-stride, hair moving, caught candidly on a long lens; golden low sun from behind',
    'the model sits cross-legged on the floor of a pale yellow seamless studio, one hand in the hair, a hard beam of sunlight from a window cutting across the backdrop and the model',
  ];

  // ═══════════════════════════════════════════════════════════════════
  // v2.9 重拍場景「組出來」,不再從固定 6 張裡抽(RA 2026-10-24:
  //   「國際品牌 MOZ 過一陣子就會發現永遠都這 6 個;巧福每樣商品都好像一樣」
  //   「排版、風格、情境怎麼調都沒用?」)
  //   病:v2.1~2.8 重拍的第一句(權重最大)是固定清單,排版完全沒讀、風格只剩一句 Styling。
  //   修:照 RA 的分工 —— 版型管構圖(白棚/極簡海報連地點也管)、風格管世界(地點、色、質感)、
  //       情境只放一個細節;再各自從「機位 × 動作 × 光的時刻」抽 → 組合數上千,
  //       而且同一個客人換選項,畫面一定跟著換。
  //   ★ 6 張舊清單(RESHOOTS)保留,只在「沒選風格、品牌也沒寫場景」時當備案。
  // ═══════════════════════════════════════════════════════════════════
  // 服飾:模特兒在做什麼(動作的發動點在身體 —— 重心、呼吸、注意力,四肢自己跟上)
  //   背對鏡頭的動作保留(RA 2026-10-24:「那才是國際質感」)。
  //   胸前 logo 跑到背後的問題,用一句「布料的事實」解決(見下方 GARMENT_FACT),不寫禁止。
  var POSES = [
    'mid-stride toward the camera, weight rolling onto the front foot, hair lifting with the step',
    'leaning a shoulder against a wall, weight on one hip, glancing past the camera',
    'sitting on low steps, elbows on knees, leaning toward the lens with a relaxed half-smile',
    'standing square to the camera, hands in pockets, chin slightly up, calm and sure',
    'laughing mid-turn, the garment swinging out with the twist of the waist',
    'crouching low, forearms on knees, looking straight down the lens',
    'reaching one open hand toward the lens, the hand soft in the foreground, the face sharp behind',
    'perched on a ledge, one knee drawn up, gazing out of frame into the light',
    'adjusting the collar with both hands, eyes down, caught between moments',
    'sitting backwards on a simple chair, arms folded over its back, direct gaze',
    'stretching tall with arms overhead, the fabric pulling and folding with the body',
    'stepping off a kerb, one foot in the air, caught candidly on a long lens',
    'turning back over one shoulder as if someone just called, the body still facing away',
    'walking away then glancing back over the shoulder, hair swinging',
    'mid-laugh, one hand pushing hair back, facing the camera in three-quarter view',
    'sitting on a wide windowsill, legs stretched along it, turned toward the lens',
  ];
  // 機位(服飾)
  var ANGLES_M = [
    'shot from very low, looking up, sky or ceiling behind',
    'eye level on a long lens, the background compressed and soft',
    'slightly above, looking down at the model',
    'a close half-body crop, the garment filling the frame',
    'full body with space around, a wide environmental frame',
    'a three-quarter angle from the side, light raking across the fabric',
  ];
  // 機位(商品)—— 低機位是 RA 認可那幾張的做法,所以在清單裡出現兩次(機率較高)
  var ANGLES_P = [
    'low camera at product height, the product fills most of the frame',
    'low camera at product height, the product fills most of the frame',
    'eye level and close, the product large and sharp, the background melting away',
    'a three-quarter view from slightly above, showing top and front together',
    'a tight crop on the product with the setting just readable around it',
  ];
  // 商品:站在什麼表面上(風格沒寫表面時用)
  var SURFACES = [
    'a slab of pale travertine', 'a weathered oak table', 'a block of raw concrete', 'a fold of washed linen',
    'a terrazzo step', 'a sun-warmed stone ledge', 'a low plinth painted in the brand colour', 'a polished walnut shelf',
    'a sheet of ribbed glass over a coloured board', 'a stack of two simple wooden crates',
  ];
  // 光的時刻(都是一個真實光源、有方向,硬光為主 —— 量尺好圖都是直射光)
  var MOMENTS = [
    'hard late-afternoon sun from one side, long crisp shadows',
    'bright midday sun straight down, short dark shadows',
    'low golden-hour sun behind, rim light on the edges',
    'morning sun through a window, the frame shadow falling across everything',
    'sun through leaves, dappled light and shade',
    'sun through half-open blinds, stripes of light across the scene',
    'soft blue hour outdoors with one warm lamp glowing nearby',
    'bright overcast sky with one strong break of sun, crisp edges returning to the shadows',
  ];
  // 沒選風格時的備案世界(品牌包也沒寫場景時才用)
  var WORLDS = [
    'a quiet city street of pale stone buildings', 'a sunny rooftop with a low concrete parapet', 'a small seaside town lane',
    'a minimalist gallery with white walls and a polished floor', 'an old brick courtyard with climbing plants',
    'a modern apartment with big windows and a few plants', 'a neighbourhood café terrace', 'a park path lined with trees',
    'a tiled stairwell with a big window', 'a warm wooden studio with a single coloured wall',
  ];
  // 版型 → 構圖(重拍用)。白棚/極簡海報連「地點」也由版型決定(RA:版型管地點與構圖)
  var LAYOUT_SHOT = {
    white_studio:    { place: 'on a seamless studio sweep in a soft tone from the brand palette', frame: '', words: 'small and quiet in the empty studio space' },
    minimal_poster:  { place: 'in front of one plain wall painted in a single colour', frame: 'lots of empty wall around the subject', words: 'set in the empty wall space' },
    magazine_cover:  { place: '', frame: 'a magazine-cover frame: the subject centred, close and confident, the top third of the frame open', words: 'across the open top of the frame like a cover title' },
    scene_lifestyle: { place: '', frame: 'a candid moment from real life, the background softly out of focus', words: 'in a calm corner of the frame' },
    hand_hold:       { place: '', frame: 'a hand bringing the subject toward the camera, the subject sharp up front, the world soft behind', words: 'in a calm corner of the frame' },
    '':              { place: '', frame: '', words: 'beside the subject' },
  };
  // 這個風格自己有沒有寫光(有就不再加光的時刻,免得兩道光打架)
  // 風格文字裡有沒有寫「地點」(很多風格只寫衣服、色、光 —— 沒地點時補一個真實地點,免得 AI 自己縮回素面棚)
  function styleHasPlace(t) { return /\b(street|store|shop|caf[eé]|room|interior|studio|wall|beach|sea|park|campus|office|kitchen|garden|shelving|shelves|fixtures|market|alley|rooftop|forest|city|town|home|library|courtyard|terrace|table|counter|restaurant|bar|hotel|temple|field|mountain|desert|pool|gym|salon|window)\b/i.test(String(t || '')); }
  // 品牌包場景常寫成「A, or B」→ 每次挑其中一個(多一層變化)
  function oneOf(t) { var parts = String(t || '').split(/\s*(?:;|\bor\b)\s*/i).map(function (x) { return x.replace(/^[,\s]+|[,\s]+$/g, ''); }).filter(function (x) { return x.length > 6; }); return parts.length ? pick(parts) : String(t || ''); }


  // ═══════════════════════════════════════════════════════════════════
  // v2.9 RA 給的參考大片(2026-10-24,17 張:小米、三星、ELLE、VOGUE、Champion、JORYA…)
  //   不抄品牌,只抽「拍攝手法」:姿勢 × 佈景 × 光,寫成一句完整的拍攝企劃。
  //   studio:true = 在棚裡/素面牆也成立(白棚、極簡海報版型可用)
  // ═══════════════════════════════════════════════════════════════════
  var REF_SHOTS = [
    { studio: true,  t: 'the model holds one hand up beside the face as if showing something to the lens, chin tilted, a knowing half-smile, hair flying from a fan, against a seamless backdrop' },
    { studio: true,  t: 'the model leans forward on a tall clear stool, forearms on the knees, one hand resting at the chin, eyes straight into the lens, clean pale seamless backdrop' },
    { studio: false, t: 'the model peeks around a thick velvet-textured column, one arm wrapped around it, one eye closed in a wink, the column and backdrop in one saturated tone' },
    { studio: true,  t: 'a head-and-shoulders portrait from slightly above, the model eyes closed and smiling, both hands raised to the head, a large soft circle of colour behind' },
    { studio: true,  t: 'the model lies across an oversized glossy inflatable cushion, arms folded under the chin, looking at the lens from very close' },
    { studio: true,  t: 'the model is wedged into a soft padded corner of pastel fabric, the body following the diagonal of the corner, shot from directly above' },
    { studio: true,  t: 'the model lies on the stomach on a seamless floor, chin on stacked hands, legs crossed up in the air behind, the camera at floor level' },
    { studio: true,  t: 'the model sits on the floor in the corner of a tonal room, knees drawn up, looking back over the shoulder at the lens' },
    { studio: false, t: 'the model peers through venetian blinds, one hand parting the slats, hard sun cutting stripes of light and shadow across the face' },
    { studio: true,  t: 'the model lounges across a row of simple chairs in a set where floor, walls and chairs are one single colour, one arm over the backrest' },
    { studio: true,  t: 'a profile portrait half hidden behind a pane of reeded glass, one side of the face sharp, the other side refracted into vertical streaks' },
    { studio: true,  t: 'the model stands hands in pockets before a smooth sky-like gradient backdrop, hard side light raking across the fabric' },
    { studio: true,  t: 'the whole frame washed in one coloured gel light, the model in profile, the face falling into soft coloured shadow' },
    { studio: true,  t: 'a tight portrait, the model adjusting sunglasses toward the lens with both gloved hands, direct and confident' },
    { studio: true,  t: 'a long flowing drape of fabric in one bold colour falls behind the model and pools on the floor, the model standing tall and still beside it' },
    { studio: true,  t: 'the model points a small retro camcorder at the viewer with one hand, bright clean white seamless background' },
  ];
  // 商品(靜物)的參考手法 —— Clarins 紅底金緞帶、護手霜紅緞帶纏繞、單色堆疊…
  var REF_STILLS = [
    'the product stands on stacked colour blocks against a backdrop of the very same colour, one tone-on-tone world',
    'a ribbon of satin winds around the product and runs off the frame, catching the light',
    'the product stands behind a pane of reeded glass, its edge sharp where it rises above the glass and refracted below',
    'hard sun through venetian blinds draws stripes of light across the product and the wall behind',
    'the whole set is washed in one coloured gel light, the product glowing at its edges',
    'a long fold of fabric in one bold colour sweeps behind and under the product',
    'the product rises from a plinth against a smooth sky-like colour gradient',
    'a large soft circle of colour sits behind the product like a halo, everything else clean and pale',
  ];
  // 情境的美術設計表(每個情境 2~3 種講法:配色 / 材質 / 光)—— 全部 28 個情境都有,不擺節慶道具
  var CONTEXT_ART = {
    jp_direct:        { c: ['crisp white and pale paper tones with one clean accent colour'], m: ['fresh paper, cardboard edges and clean cotton'], l: 'bright clean morning daylight' },
    jp_drugstore_haul:{ c: ['clean white with one fresh mint or coral accent'], m: ['neat rows of repeated colour blocks behind'], l: 'bright even retail light' },
    duty_free:        { c: ['cool stone grey, brushed metal and champagne'], m: ['polished marble and mirrored surfaces'], l: 'cool architectural light with long reflections' },
    limited_stock:    { c: ['deep dark tones around one bright pool of light'], m: ['matte black surfaces'], l: 'one hard spotlight falling away into darkness' },
    daily_supplement: { c: ['soft morning whites and warm neutrals'], m: ['linen, a glass of water and pale stone'], l: 'early sun through a window' },
    gift_choice:      { c: ['one rich tone-on-tone colour across the whole set'], m: ['satin ribbon and heavy paper folded around the set'], l: 'a warm soft glow' },
    summer:           { c: ['saturated sky blue, sun yellow and white'], m: ['glass, water ripples and light cotton'], l: 'hard high midday sun with crisp short shadows' },
    winter_cozy:      { c: ['warm oatmeal, cream and caramel'], m: ['chunky knit, wool and misted glass'], l: 'a warm low tungsten glow against a cold blue evening' },
    festive_cny:      { c: ['tone-on-tone lucky red with a touch of gold', 'deep crimson against soft grey'], m: ['flowing red silk drapery and lacquer surfaces'], l: 'clean warm studio light' },
    back_to_school:   { c: ['fresh autumn navy, ivory and leaf tones'], m: ['paper, canvas and pale wood'], l: 'crisp early-autumn morning sun' },
    unboxing:         { c: ['the brand colour carried across the backdrop'], m: ['tissue paper and the open inside of a box'], l: 'soft top light, as if a lid has just lifted' },
    daily_use:        { c: ['natural lived-in home colours'], m: ['real everyday surfaces'], l: 'ordinary daylight from a window' },
    promo_sale:       { c: ['one bold punchy colour flooding the set'], m: ['glossy colour-blocked plinths'], l: 'bright hard studio light' },
    gift_giving:      { c: ['a warm tone-on-tone set'], m: ['ribbon and wrapping paper wound around and beneath the product'], l: 'a warm soft glow' },
    year_end_sale:    { c: ['bold red and gold'], m: ['glossy lacquer blocks'], l: 'bright hard light' },
    double11:         { c: ['vivid red and magenta colour blocks'], m: ['glossy acrylic blocks'], l: 'hard punchy light' },
    valentines:       { c: ['blush, rose and deep red tone-on-tone'], m: ['satin and velvet'], l: 'a low candle-warm glow' },
    zhongyuan_pudu:   { c: ['the warm red and gold of a temple table'], m: ['red cloth and generous stacks of packs'], l: 'warm amber light' },
    mid_autumn:       { c: ['deep night blue with warm amber'], m: ['wood, silk and paper-lantern glow'], l: 'a soft moonlit night with one warm lamp' },
    national_day:     { c: ['crisp blue, white and red'], m: ['clean modern surfaces'], l: 'bright clear daylight' },
    halloween:        { c: ['deep purple and burnt orange'], m: ['velvet and smoke-dark surfaces'], l: 'low warm side light with deep shadows' },
    black_friday:     { c: ['matte black with one sharp highlight'], m: ['black glossy surfaces'], l: 'a hard directional spotlight' },
    double12:         { c: ['warm orange and gold'], m: ['glossy colour blocks'], l: 'hard punchy light' },
    christmas:        { c: ['deep green, red and gold', 'snow white with one red accent', 'an all-red tone-on-tone set'], m: ['satin ribbon, knit wool and soft snow'], l: 'a warm tungsten glow' },
    nye_countdown:    { c: ['midnight navy with champagne gold'], m: ['sequins and glass'], l: 'sparkling points of light on a dark night' },
    weiya:            { c: ['warm red and gold'], m: ['banquet linen and lacquer'], l: 'warm festive light' },
    brand_anniversary:{ c: ['the brand colour with champagne gold'], m: ['satin ribbon and heavy paper'], l: 'clean premium light' },
  };
  // ═══════════════════════════════════════════════════════════════════
  // v2.9 情境的表現方式(RA 2026-10-24:「萬聖節就放南瓜、中秋節就放柚子、聖誕節 —— 只會顯得 AI 很爛」
  //   她給的 7 張聖誕廣告:同一個節日,有的靠配色(整片紅底、紅綠)、有的靠材質(緞帶繞在商品上、
  //   雪地、毛線)、有的靠造型(模特兒的穿搭配件)—— 季節是「整張照片的美術設計」,不是旁邊擺一個象徵物。
  //   做法:從情境描述裡抽出「配色」與「材質」,每張隨機用其中一種方式講;道具名詞(南瓜、柚子、月餅…)不帶進來。
  // ═══════════════════════════════════════════════════════════════════
  var COLOUR_RE = /(red|green|gold|golden|silver|white|ivory|cream|blush|rose|pink|purple|orange|amber|navy|blue|teal|burgundy|champagne|black|copper|magenta|pastel|palette|tones?|accents?)/i;
  var MATERIAL_RE = /(knit|wool|satin|ribbon|velvet|linen|paper|tissue|snow|frost|glass|candle|lantern|fairy-light|light bokeh|petal|silk|felt|wood|marble|confetti)/i;
  function _occasion(raw, people) {
    var t = String(raw || ''), name = (t.match(/^([^:]+?)\s+context/i) || [])[1] || '';
    var art = CONTEXT_ART[(typeof SELECTED_CONTEXT !== 'undefined' && SELECTED_CONTEXT) || ''];
    if (art) {
      var w = [];
      art.c.forEach(function (c) { w.push('the whole set, backdrop and styling are built from ' + c + ', the way a seasonal campaign is art-directed'); });
      art.m.forEach(function (m) { w.push('the materials of the set itself carry it — ' + m + (people ? ' — woven into the scene and the styling' : ' — around and beneath the product')); });
      w.push('the light carries it: ' + art.l);
      if (people) w.push('the model\'s styling and accessories carry it, in ' + art.c[0]);
      return 'The ' + (name ? name.toLowerCase() : 'occasion') + ' feeling: ' + pick(w) + '.';
    }
    var bits = t.replace(/^[^:]*:\s*/, '').replace(/\([^)]*\)/g, '').split(/\s*[,;—]\s*/).filter(function (x) { return !/pair of|two |hands|gesture|card|NOT |keep it/i.test(x); });
    var colours = bits.filter(function (x) { return COLOUR_RE.test(x) && !/badge|numeral|tag|typography|price|sale/i.test(x); }).slice(0, 2).join(', ');
    var mats = bits.filter(function (x) { return MATERIAL_RE.test(x) && !COLOUR_RE.test(x); }).map(function (x) { return x.replace(/\b(a|an|the)\s+/gi, '').replace(/\s*(as (a )?props?|textures?|in the background bokeh)\b.*$/i, ''); }).slice(0, 2).join(' and ');
    var ways = [];
    if (colours) ways.push('the whole set, backdrop and styling are built from ' + colours + ', the way a seasonal campaign is art-directed');
    if (mats) ways.push('the materials of the set itself carry it — ' + mats + ' — woven into the scene' + (people ? ' and the styling' : ' and wrapped around or under the product'));
    if (people) ways.push('the model\'s styling and accessories carry it' + (colours ? ', in ' + colours : ''));
    if (!ways.length) ways.push('the colour and light of the whole picture carry it');
    return 'The ' + (name ? name.toLowerCase() : 'occasion') + ' feeling: ' + pick(ways) + '.';
  }
  function styleHasLight(t) { return /\b(sun|sunlight|daylight|light|lighting|lamp|neon|glow|shadow)\b/i.test(String(t || '')); }


  // 沒選風格、品牌也沒寫場景時的實景(都是「一面背景」,人和商品都站得進去)
  var PLACES = [
    'a plain warm plaster wall with a pale floor',
    'a seamless paper backdrop in a soft tone taken from the brand palette',
    'a clean light-wood surface against a smooth off-white wall',
    'a quiet corner of a bright room with one plain wall behind',
  ];

  // v1.2 攝影師層(RA:「拍攝要跟真的攝影師一樣 —— ISO、光圈、富士/NIKON/SONY 拍出來都不一樣」)
  //   每一套 = 機身 + 鏡頭 + 光圈/ISO + 色彩科學/底片。照風格自動挑家族,家族裡隨機一套。
  //   機位與距離一律照原圖(真人模特兒換角度=AI 重畫人、臉會跑;商品換角度=會被放倒)。
  var CAMS = {
    jp:    ['Fujifilm X-T5 with a 35mm f/1.4 lens at f/2, ISO 200, Classic Chrome film simulation: muted teal shadows, soft warm highlights, gentle contrast',
            'Fujifilm GFX 100S with a 63mm lens at f/2.8, ISO 100, Pro Neg Std colour: soft, airy, true-to-life skin'],
    film:  ['Kodak Portra 400 35mm film with a Contax-style 35mm lens, visible fine grain, warm honest skin tones, slightly lifted blacks',
            'Kodak Gold 200 35mm film, natural grain, warm golden cast, real film halation in the highlights'],
    clean: ['Sony A7R V with an 85mm GM lens at f/1.8, ISO 100, 1/500s: crisp clean commercial colour, smooth creamy background falloff',
            'Sony A7 III with a 55mm f/1.8 lens at f/2, ISO 200: natural everyday colour, true-to-life tones',
            'Canon EOS R5 with an RF 50mm f/1.2 at f/2, ISO 100: clean bright colour, natural skin, gentle separation'],
    rich:  ['Nikon Z9 with a NIKKOR Z 50mm f/1.2 S at f/2, ISO 100, 1/400s: rich natural contrast and deep true colour',
            'Leica M11 with a Summilux 35mm at f/2, ISO 200: punchy contrast, dense blacks, editorial bite'],
    studio:['Hasselblad X2D with an 80mm lens at f/5.6, ISO 64: pristine medium-format tones and fine detail',
            'Phase One medium-format back with a 110mm lens at f/8, ISO 50: razor detail, smooth tonal gradation'],
  };
  // v1.7:挑相機看三個來源 —— ① 客人選的風格 ② 沒選風格就看品牌包的攝影風格+氛圍 ③ 版型(白棚=中片幅)
  function camFor(flKey, ly, brandHint) {
    var k = String(flKey && flKey !== 'none' ? flKey : '') || String(brandHint || '');
    if (ly === 'white_studio') return pick(CAMS.studio);
    if (/^jp_|japan|muji|kinfolk|showa|wabi|zen/i.test(k)) return pick(CAMS.jp);
    if (/vintage|retro|americana|film|nostalg|heritage|70s|80s|90s|tw_/i.test(k)) return pick(CAMS.film);
    if (/^kr_|korea|k_|clean|minimal|scandi|nordic|bright|airy|fresh/i.test(k)) return pick(CAMS.clean);
    return pick(CAMS.rich.concat(CAMS.clean));
  }

  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function cap(t) { t = String(t || ''); return t.charAt(0).toUpperCase() + t.slice(1); }
  function cut(s, n) { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n).replace(/[,;\s]+\S*$/, '') : s; }
  // v1.10 精華(RA:「不能只抓前面的字,要簡化成大綱/簡介式的精華」)
  //   ① 先拿掉括號裡的補充說明(用途、舉例、對標) ② 去重 ③ 還太長才以「一個完整項目」為單位收,
  //   每一項只留前半(冒號前的名稱),不在字中間截斷。
  function essence(t, n) {
    t = String(t || '').replace(/[(（][^)）]*[)）]/g, '').replace(/\s+([,;，；、.])/g, '$1').replace(/\s+/g, ' ').trim();
    if (t.length <= n) return t.replace(/[,;，；、\s]+$/, '');
    var items = t.split(/\s*[;；\n]\s*|\s*[,，、]\s*/).filter(Boolean), seen = {}, out = [];
    items.forEach(function (x) { var k = x.toLowerCase(); if (!seen[k]) { seen[k] = 1; out.push(x); } });
    var res = out.join(', ');
    if (res.length <= n) return res;
    res = out.map(function (x) { return x.split(/[:：]|\s—\s/)[0].trim(); }).filter(Boolean).join(', ');
    if (res.length <= n) return res;
    var acc = [];
    for (var i = 0; i < out.length; i++) { var h = out[i].split(/[:：]|\s—\s/)[0].trim(); if ((acc.join(', ') + ', ' + h).length > n) break; acc.push(h); }
    return acc.join(', ');
  }
  function val(id) { var el = document.getElementById(id); return (el && el.value || '').trim(); }

  // 品牌包 DNA:配色、字型、場景、光質、氛圍
  function packBits() {
    var out = { colour: '', type: '', scene: '', photo: '', mood: '' };
    try {
      var dna = String((detectBrandPack() || {}).dna || '');
      dna.split('\n').forEach(function (l) {
        var m = l.trim().match(/^-\s*([^:]+):\s*(.*)$/); if (!m || !m[2]) return;
        var k = m[1].toLowerCase(), v = m[2].trim();
        if (/primary brand colou?r|secondary palette|palette/.test(k)) out.colour += (out.colour ? '; ' : '') + v;
        else if (/^typography/.test(k)) out.type = v;
        else if (/background scenes?|^scenes?|setting/.test(k)) out.scene = v;
        else if (/photography style|lighting/.test(k)) out.photo = v;
        else if (/^mood/.test(k)) out.mood = v;
      });
    } catch (_) {}
    if (typeof _dropLogoTalk === 'function') { out.colour = _dropLogoTalk(out.colour) || ''; out.type = _dropLogoTalk(out.type) || ''; }
    // 光質去掉寫死的方向(方向由本次的光源決定)
    out.photo = out.photo.replace(/\b(from\s+)?(the\s+)?(upper|top|lower|bottom)?[-\s]?(left|right)\b/gi, '').replace(/\s{2,}/g, ' ');
    return out;
  }

  // 風格:去掉「Add … flavor:」與相機句,只留「場景與造型」
  function flavorSet(f) {
    var t = String((f && f.flavor) || '');
    if (!t) return '';
    t = t.replace(/^Add\s+/i, '').replace(/\s*flavou?r\s*:/i, ':').replace(/\s*Shot on[\s\S]*$/i, '').replace(/[\s,;.]+$/, '');
    return essence(typeof _dropPriceTalk === 'function' ? _dropPriceTalk(t) : t, 220);
  }

  // 版型:每個版型壓成一句「骨架」(原本 300~1,400 字的版面說明,留住它要的那件事)
  var LAYOUT_ESSENCE = {
    '':              'one photograph built around the subject, with calm open space where words can rest',
    white_studio:    'a studio portrait of the subject on a seamless sweep, the empty space around it giving it room to breathe',
    minimal_poster:  'a poster where the subject and a few words are all there is, held together by generous empty space',
    scene_lifestyle: 'a moment from real life, the subject sitting naturally among the things it lives with, the background softly out of focus',
    magazine_cover:  'a magazine cover, the subject close and confident, the top of the frame open for the title',
    hand_hold:       'a hand bringing the subject toward the camera, the subject sharp up front, the world soft behind',
  };

  function lean() {
    var pt = (typeof SELECTED_PRODTYPE !== 'undefined' && SELECTED_PRODTYPE) || '';
    var ly = (typeof SELECTED_LAYOUT !== 'undefined' && SELECTED_LAYOUT) || '';
    var flavor = (REGIONAL_FLAVORS[SELECTED_FLAVOR] || {});
    var ctxTheme = (CONTEXT_THEMES[SELECTED_CONTEXT] || {});
    var ctx = getBrandContext();
    var pb = packBits();
    var isReshoot = (pt === 'apparel');            // 服飾:重拍(新模特兒、新姿勢)
    var isProdReshoot = (pt === 'physical_reshoot'); // 商品:重拍(新場景、新角度)
    // v2.2 重拍兩種都會在出圖後走「商品校正」第二步(admaker.js 讀這個旗標)
    window._amReshoot = isReshoot || isProdReshoot;
    var isApparel = (pt === 'apparel_keep');       // 服飾:保留原模特兒(只換光與背景)
    var S = isApparel ? 'the people' : 'the product';

    var headline = val('gptHeadline'), sub = val('gptSubHeadline'), note = val('gptStyleDesc');
    var lockColor = (document.getElementById('lockBrandColor') || {}).checked !== false;
    var showMark  = (document.getElementById('showBrandMark') || {}).checked !== false;
    var strip = function (t) { return typeof _stripPriceFigures === 'function' ? _stripPriceFigures(t) : t; };
    var name = String(ctx.product || '').replace(/\b[A-Za-z]{1,5}[-\s]?\d{2,6}[A-Za-z]{0,3}\b/g, '').replace(/\s{2,}/g, ' ').trim();
    var spec = essence(strip(ctx.spec), 160), feat = essence(strip(ctx.feature), 160);
    var sz = (typeof _adSize === 'function') ? _adSize() : { w: 1080, h: 1080 };
    var p = [];

    // v2.0 結構:① 拍攝企劃(具體畫面主意,權重最大,放最前)② 主體一句 ③ 構圖一句
    //   ④ 風格+品牌一句 ⑤ 物理法則兩句(保險)⑥ 相機一句 ⑦ 字一句。約 900~1,300 字。
    // v2.8 重拍共用:畫面上所有的字只有「商品自己印的」+「客人給的標題」;貨架、招牌、卡片都是素面
    function _letteringLine(headline, sub, pb, where, subj) {
      var t = 'All the lettering in the whole photograph is the printing on ' + subj;
      if (headline || sub) t += ' plus these words, in the brand\'s own type style' + (pb.type ? ' (' + essence(pb.type, 80) + ')' : '') + ', ' + where + ': ' +
        (headline ? '"' + headline + '"' : '') + (headline && sub ? ', and a small line beneath, ' : '') + (sub ? '"' + sub + '"' : '');
      return t + '. Shelves, signs, cards and props around it are plain, wordless surfaces.';
    }
    // v2.9 重拍的「世界」與「構圖」由客人的選項組出來(詳見上方 POSES/ANGLES/LAYOUT_SHOT 說明)
    //  回傳一整段「介系詞 + 地點」:版型有地點(白棚/極簡海報)→ 版型的地點 + 風格的色與質感;
    //  否則 → 風格的世界(風格沒寫地點就補一個真實地點)→ 品牌包場景(挑其中一個)→ 備案
    //  people=true(服飾):品牌包場景常是「商品擺拍」(flat-lay、木桌…),人站不進去 → 一律用人能待的真實地點
    //  風格文字裡有些是「平面設計」的詞(字體、疊圖紋理、插畫)—— 那是排版不是攝影,放進場景會被畫成疊圖,拿掉
    function _photoOnly(t) {
      t = String(t || ''); var m = t.match(/^([^:]{2,60}):\s*([\s\S]*)$/), head = m ? m[1] : '', body = m ? m[2] : t;
      var keep = body.split(/\s*,\s*/).filter(function (x) { return !/overlay|serif|sans-serif|font|typograph|mincho|letter|illustrat|graphic|poster|layout/i.test(x); }).join(', ');
      return head ? head + (keep ? ': ' + keep : '') : keep;
    }
    function _world(fs, fallback, people) {
      var L = LAYOUT_SHOT[ly] || LAYOUT_SHOT[''];
      var scene = people ? '' : pb.scene;
      fs = _photoOnly(fs);
      if (L.place) return L.place + (fs ? ', in the colour and texture of ' + essence(fs, 160) : '');
      if (fs) return 'in the world of ' + essence(fs, 200) + (styleHasPlace(fs) ? '' : ', on location ' + (scene ? 'in ' + cut(oneOf(scene), 90) : 'in ' + pick(WORLDS)));
      if (scene) return 'in ' + cut(oneOf(scene), 140);
      return fallback ? 'in ' + fallback : '';
    }
    //  動作要跟地點合得來:棚內/素面牆不放「下路緣、坐台階、坐矮牆」這類戶外動作
    //  版型跟機位要合得來:極簡海報要留白 → 不用大特寫;雜誌封面要近而有自信 → 不用全身大遠景
    function _angle(pool) {
      var bad = ly === 'minimal_poster' ? /close|tight/ : ly === 'magazine_cover' ? /full body|wide/ : null;
      return pick(bad ? pool.filter(function (x) { return !bad.test(x); }) : pool);
    }
    function _pose() { var L = LAYOUT_SHOT[ly] || LAYOUT_SHOT['']; var pool = L.place ? POSES.filter(function (x) { return !/kerb|ledge|steps/.test(x); }) : POSES; return pick(pool); }
    function _light(fs) { return styleHasLight(fs) ? '' : pick(MOMENTS); }
    if (isProdReshoot) {
      var fsP = flavorSet(flavor);
      var bfP = [essence(pb.mood, 80), essence(ctx.adStyle, 70)].filter(Boolean).join('; ');
      var LP = LAYOUT_SHOT[ly] || LAYOUT_SHOT[''];
      // v2.6 認可的商品句一字不動(RA:「我要這個版本」);數量交給第二步「商品校正」
      p.push('The product is the real one in this photo' + (name ? ' (' + name + ')' : '') + ': it keeps its exact shape, panels, colours, materials and logos; small labels and lettering stay exactly as photographed, and where a label is too small to read it stays plain.');
      var lP = _light(fsP);
      var placeP = (fsP || pb.scene || LP.place)
        ? 'the product stands on ' + pick(SURFACES) + ' ' + _world(fsP, '') + (lP ? '; ' + lP : '')
        : 'the product stands on a real surface in front of ' + conceptFor(pb.colour).replace(/\{S\}/g, 'the product').replace(/\{P\}/g, 'its');
      if (Math.random() < 0.35) placeP += '; ' + pick(REF_STILLS);
      p.push('A new product campaign photograph: ' + placeP + '. ' + (LP.frame ? cap(LP.frame.replace(/the subject/g, 'the product')) + '; ' + _angle(ANGLES_P) : cap(_angle(ANGLES_P))) + '.');
      if (bfP) p.push('Brand feel: ' + bfP + '.');
      if (ctxTheme.context) p.push(_occasion(ctxTheme.context, false));
      if (note) p.push('Client note: ' + essence(note, 180));
      p.push('Light travels in straight lines from its real source: what faces it is bright, what faces away falls into shadow, and whatever stands in its path casts its shadow onto what lies behind. Things that touch rest on each other under gravity and darken where they meet.');
      p.push('Shot on ' + camFor(SELECTED_FLAVOR, ly, pb.photo + ' ' + pb.mood) + '. Real material texture; ' + sz.w + 'x' + sz.h + ', edge to edge.');
      // v2.8:整張照片的字 = 商品本身印的字 + 客人給的標題,周圍道具是素面(治 AI 自編價格牌)
      p.push(_letteringLine(headline, sub, pb, 'one compact block ' + LP.words.replace(/the subject/g, 'the product'), 'the product'));
      return p.join('\n');
    }
    if (isReshoot) {
      var fsR = flavorSet(flavor);
      var bfR = [essence(pb.mood, 80), essence(ctx.adStyle, 70)].filter(Boolean).join('; ');
      var LR = LAYOUT_SHOT[ly] || LAYOUT_SHOT[''];
      p.push('The product is the garment in this photo: same cut, fabric, colour, zips, drawstrings and every logo or embroidery exactly as it is. Each print and embroidery stays on the panel where it sits in the photo, so the camera sees it only when that panel faces the lens.');
      //  沒選風格、品牌包也沒寫場景、版型也沒指定地點 → 用舊的 6 張完整場景當備案(RA 認可過的等級)
      if (!fsR && !LR.place && !LR.frame) {
        p.push('A new fashion campaign photograph of a young model wearing this garment: ' + (Math.random() < 0.5 ? pick(RESHOOTS) : 'in ' + pick(WORLDS) + ', ' + pick(POSES) + '; ' + pick(ANGLES_M) + '; ' + pick(MOMENTS)) + '.');
      } else {
        var refPool = LR.place ? REF_SHOTS.filter(function (x) { return x.studio; }) : REF_SHOTS;
        if (Math.random() < 0.5 && refPool.length) {
          //  參考大片手法:一整句拍攝企劃(姿勢+佈景+光),風格只給色與質感
          p.push('A new fashion campaign photograph of a young model wearing this garment: ' + pick(refPool).t + (fsR ? ', in the colour and texture of ' + essence(_photoOnly(fsR), 160) : '') + '.' + (LR.frame ? ' ' + cap(LR.frame.replace(/the subject/g, 'the model')) + '.' : ''));
        } else {
          var wR = _world(fsR, pick(WORLDS), true), lR = _light(fsR);
          p.push('A new fashion campaign photograph of a young model wearing this garment, ' + wR + (lR ? '; ' + lR : '') + '. The model is ' + _pose() + '. ' + (LR.frame ? cap(LR.frame.replace(/the subject/g, 'the model')) + '; ' : '') + cap(_angle(ANGLES_M)) + '.');
        }
      }
      p.push('Everything else the model wears is plain, unbranded everyday basics, so the garment is the only branded piece in the picture.');
      if (bfR) p.push('Brand feel: ' + bfR + '.');
      if (ctxTheme.context) p.push(_occasion(ctxTheme.context, true));
      if (note) p.push('Client note: ' + essence(note, 180));
      p.push('Light travels in straight lines from its real source: what faces it is bright, what faces away falls into shadow, and nearby surfaces bounce their colour onto the model. It is one moment through one lens.');
      p.push('Shot on ' + (fsR ? camFor(SELECTED_FLAVOR, ly, pb.photo + ' ' + pb.mood) : pick(CAMS.film.concat(CAMS.clean))) + '. Real skin texture, real fabric folds; ' + sz.w + 'x' + sz.h + ', edge to edge.');
      p.push(_letteringLine(headline, sub, pb, 'one compact block ' + LR.words.replace(/the subject/g, 'the model'), 'the garment'));
      return p.join('\n');
    }
    var P = isApparel ? 'their' : 'its';
    var concept;
    if (ly === 'white_studio') concept = 'a smooth warm-white studio wall; hard sun from a tall window on one side draws the window-frame shadow across the wall and across {S}';
    else if (ly === 'minimal_poster') concept = 'a plain backdrop painted in ' + (pb.colour ? essence(pb.colour, 50) : 'one calm colour') + '; hard sun from one side throws a crisp shadow of {S} onto it';
    else concept = conceptFor(pb.colour);
    concept = concept.replace(/\{S\}/g, S).replace(/\{P\}/g, P);
    p.push('A real ' + (isApparel ? 'fashion campaign' : 'product campaign') + ' photograph: ' + concept + '.');

    // ② 主體
    p.push(isApparel
      ? 'The people are the real models from this photo: same faces, expressions, pose, hair movement and clothes, now standing in this light.'
      : 'The product is the real one from this photo' + (name ? ' (' + name + ')' : '') + ': same form, colours, materials and markings' + ((spec || feat) ? ' — ' + essence([spec, feat].filter(Boolean).join('; '), 120) : '') + ', now standing in this light.');

    // ③ 構圖
    p.push((LAYOUT_ESSENCE[ly] || LAYOUT_ESSENCE['']).replace(/^./, function (c) { return c.toUpperCase(); }) + '; ' + S + (isApparel ? ' fill' : ' fills') + ' most of the frame' + (isApparel ? ', cropped where the source photo is cropped' : '') + '; ' + sz.w + 'x' + sz.h + ', edge to edge.');

    // ④ 風格 + 品牌
    var fs = flavorSet(flavor);
    var brandFeel = [essence(pb.mood, 80), essence(ctx.adStyle, 70), lockColor && pb.colour ? essence(pb.colour, 90) : ''].filter(Boolean).join('; ');
    if (fs || brandFeel) p.push((fs ? 'Styling: ' + essence(fs, 130) + '. ' : '') + (brandFeel ? 'Brand feel: ' + brandFeel + '.' : ''));
    if (ctxTheme.context) p.push(_occasion(ctxTheme.context, isApparel));
    if (note) p.push('Client note: ' + essence(note, 180));

    // ⑤ 物理法則(保險,兩句)
    p.push('Light travels in straight lines from that one source: what faces it is bright, what faces away falls into shadow, and whatever stands in its path casts its shadow onto what lies behind; nearby coloured surfaces bounce their colour onto ' + S + '. ' +
      (isApparel ? '' : 'Things that touch rest on each other under gravity and darken where they meet. ') +
      'It is one moment through one lens, everything at its true scale.');

    // ⑥ 相機
    p.push('Shot on ' + camFor(SELECTED_FLAVOR, ly, pb.photo + ' ' + pb.mood) + ', from where the camera stood in the source photo.');

    // ⑦ 字
    if (headline || sub) {
      p.push('Words in the brand\'s own type style' + (pb.type ? ' (' + essence(pb.type, 80) + ')' : '') + ', one compact block on the background beside ' + S + ': ' +
        (headline ? '"' + headline + '"' : '') + (headline && sub ? ', and a small line beneath, ' : '') + (sub ? '"' + sub + '"' : '') + '.');
    }

    var out = p.join('\n');
    // v1.10 3,000 字牆(KOL 線定的):超過時先收「風格造型」與「客人補充」的細項,整層不拿掉
    if (out.length > 3000) { out = out.replace(/(Styling: )([^\n]*)/, function (m, a, b) { return a + essence(b, 90); }); }
    if (out.length > 3000) { out = out.replace(/(Client note: )([^\n]*)/, function (m, a, b) { return a + essence(b, 120); }); }
    return out;
  }

  window.buildPosterPromptLean = lean;
  window.buildPosterPrompt = function () {
    var pt = (typeof SELECTED_PRODTYPE !== 'undefined' && SELECTED_PRODTYPE) || '';
    var ly = (typeof SELECTED_LAYOUT !== 'undefined' && SELECTED_LAYOUT) || '';
    var fl = (REGIONAL_FLAVORS[SELECTED_FLAVOR] || {}).flavor || '';
    var use = window.AD_LEAN !== false && LEAN_TYPES.indexOf(pt) !== -1 && LEAN_LAYOUTS.indexOf(ly) !== -1 && !/ILLUSTRATION OVERLAY/i.test(fl);
    if (!use) { window._amReshoot = false; return ORIG.apply(this, arguments); }
    try {
      var out = lean();
      console.log('[AD_LEAN] 精簡提示詞 ' + out.length + ' 字(舊版保險絲:window.AD_LEAN=false)');
      return out;
    } catch (e) {
      console.warn('[AD_LEAN] 精簡版出錯,改用舊版:', e.message);
      return ORIG.apply(this, arguments);
    }
  };
  console.log('[AD_LEAN] v2.9 精簡廣告圖提示詞已載入');
})();
