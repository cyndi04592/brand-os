/* Brand OS 廣告圖精簡引擎 · 由 photoroom-proxy v11.44 提供(唯一一份)*/
(function _AD_LEAN() {
// ═══════════════════════════════════════════════════════════════════════
//  admaker-prompt-lean.js · v2.11 (2026-10-24)  v2.11:選了情境 → 配色讓給情境;v2.10:認品類(餐飲/肉品/家電/手持/睫毛/保健/寵物/親子/戶外/瑜珈/髮型)抽該品類拍法 + 模特兒髮型輪換;v2.9:重拍場景由「版型×風格×情境」組出
//                                     + RA 參考大片手法庫(44 人像/24 靜物,含 Pinterest 2026 MD拍攝)+ 28 個情境全部改成配色/材質/光,不擺節慶道具
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
      'a light-grey smooth concrete wall; hard sun through venetian blinds lays thin parallel stripes of light across the wall and across {S}',   // v2.16
      'a cream-painted brick wall; low sun from the right throws {P} long sharp shadow along the rows of bricks',   // v2.16
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
    return pickFresh(pool, 'concept');
  }

  //  v2.16 棚景輪流(RA 2026-11-04:MOZ 白棚攝影每張都同一面暖白牆+窗框影子)。全部維持硬光+具體影子(v1.1 量尺結論)
  var STUDIO = [
    'a smooth warm-white studio wall; hard sun from a tall window on one side draws the window-frame shadow across the wall and across {S}',
    'a pale-grey seamless studio sweep; one hard spotlight from high on the left makes a crisp oval pool of light on the backdrop behind {S} and a sharp shadow on the floor',
    'an off-white studio wall; sun through venetian blinds lays thin parallel stripes of light across the wall and across {S}',
    'a warm ivory paper backdrop curving into the floor; a single bare hard light from the right, the backdrop falls gently into shadow on the left and {P} shadow lands sharp on the paper',
    'a clean white wall above a pale polished-concrete floor; hard light from directly above leaves a short crisp shadow under {S} and a soft gradient down the wall',
  ];
  //  極簡海報:牆色照品牌色,光線方向與影子樣式輪流
  var POSTER_LIGHT = [
    'hard sun from one side throws a crisp shadow of {S} onto it',
    'hard sun through a window frame lays a sharp grid of light and shadow across it and across {S}',
    'low sun from behind and to the side draws a long thin shadow of {S} across the floor and up the backdrop',
    'one hard spotlight from above makes a bright circle on the backdrop behind {S}',
  ];
  //  v2.16 抽一個「跟這台電腦上一張不一樣」的:記住最近 2 個,下一張避開(記不住就照舊隨機)
  function pickFresh(pool, key) {
    var k = 'adlean_last_' + key, last = [];
    try { last = JSON.parse(window.localStorage.getItem(k) || '[]') || []; } catch (e) { last = []; }
    var fresh = pool.filter(function (x) { return last.indexOf(x) === -1; });
    var v = pick(fresh.length ? fresh : pool);
    try { window.localStorage.setItem(k, JSON.stringify([v].concat(last).slice(0, Math.min(2, pool.length - 1)))); } catch (e) {}
    return v;
  }

  //  v2.17 風格 = 真實拍攝通告單(RA 2026-10-22 定的方向,2026-11-04「直接升級到最高」)
  //   每個風格 2 個實拍場地,各自寫:在哪拍 → 光從哪來 → 影子落在哪。選這個風格就真的換一個拍攝場地,
  //   同一台電腦上一張用過的場地下一張不再抽(pickFresh)。插畫/平面設計類風格不在這裡,照舊用原本的描述。
  //   全部維持硬光+具體影子(v1.1 量尺);不寫 cinematic / glow / golden hour 這類會觸發油光的詞。
  var SHOOTS = {
    food_michelin: [
      'a dark slate table in a quiet fine-dining room; one warm spotlight from above and behind lights the plate rim, the room behind falls into deep soft shadow',
      'a charcoal stone counter at a chef\'s table; a narrow warm lamp from the left rakes across the food, a crisp shadow falls to the right on the stone',
    ],
    food_cantonese: [
      'a dark lacquered rosewood banquet table against a deep red wall with gold trim; warm overhead pendant light pools on the dish, the wall stays rich and dark',
      'a round teak table on a white tablecloth in an old Hong Kong dining hall; warm light from a brass ceiling lamp makes a bright pool, plates cast short shadows',
    ],
    food_kappo: [
      'a rough charcoal stone slab on a pale hinoki counter; low daylight through a paper shoji screen from the left, the dish casts a long soft-edged shadow across the wood',
      'a dark aged wood counter in a small kappo bar; one narrow warm light from above, the wall behind stays in deep shadow and steam catches the light',
    ],
    food_street: [
      'a worn stainless counter at a Taiwanese night-market stall; a bare warm bulb hangs just above the food, steam rises through the light, the busy lane behind is dark and out of focus',
      'a scratched wooden table on a Taipei side street at dusk; light from the stall\'s fluorescent tube and a red lantern, short hard shadows under the bowls',
    ],
    food_chef: [
      'a stainless steel pass in a working restaurant kitchen; hard light from the heat-lamp row above, the chef\'s hands and the plate cast crisp shadows on the steel',
      'a dark wood serving counter in an open kitchen; window light from the left, the chef\'s sleeve and the plate throw one clean shadow to the right',
    ],
    food_ingredient: [
      'a pale linen cloth on a farmhouse wood table; hard morning sun from a window on the left, each herb and ingredient throws its own small sharp shadow',
      'a grey concrete worktop; low sun from the right rakes across it, raw ingredients and the dish cast long crisp shadows toward the camera',
    ],
    japan_kinfolk: [
      'a quiet Japanese room with pale tatami and a washi-paper wall; morning sun through a shoji screen lays a soft grid of light across the wall and the subject',
      'a bare plaster corner with a single old wooden stool; low sun from the left draws a long shadow of the subject across the warm grey floor',
    ],
    korea_oliveyoung: [
      'a clean white tiled bathroom counter with a round mirror; bright daylight from a frosted window on the right, crisp short shadows on the tiles',
      'a pale pink plaster wall with a narrow glass shelf; hard sun from the left throws a sharp shadow of the subject and the shelf edge onto the wall',
    ],
    jp_harajuku_street: [
      'a narrow Harajuku back street with stickered shutters and vending machines; hard afternoon sun from the end of the alley, long shadows along the pavement',
      'a concrete stairway outside a small Ura-Harajuku shop; midday sun from above, the railing throws striped shadows across the steps and the subject',
    ],
    jp_vintage_craft: [
      'a workshop corner with a worn workbench, leather offcuts and old tools on pegboard; hard window sun from the left, tool shadows stretch across the wall',
      'the doorway of an old denim repair shop with indigo jeans hanging; low sun from the street lays a bright stripe across the wooden floor and the subject',
    ],
    jp_workwear_hard: [
      'an old garage with a dark steel roll-up door and a parked motorcycle; hard sun from the open door on the left, a sharp shadow falls across the oily concrete floor',
      'a brick warehouse loading dock; low late sun from the right rakes across the bricks and throws the subject\'s long shadow up the wall',
    ],
    jp_art_graffiti: [
      'a painted concrete wall covered in layered graffiti under a railway bridge; hard sun from the side cuts a diagonal line of light and shadow across the wall and the subject',
      'a rooftop with a mural-covered water tank; strong midday sun, short hard shadows, a clear blue sky above',
    ],
    jp_drugstore: [
      'a bright Japanese drugstore aisle with neatly stacked shelves; even overhead tube light plus a shaft of window sun from the left making a crisp shadow',
      'a white shelf display by a shop window; hard sun through the glass draws a sharp window-frame shadow across the shelf and the subject',
    ],
    jp_konbini: [
      'the front of a Tokyo convenience store at night; the white light from inside spills out across the pavement, the subject lit from the shop side with a hard edge',
      'a convenience-store window counter with stools; afternoon sun through the glass lays a bright rectangle across the counter and the subject',
    ],
    kr_seoul_studio: [
      'a Seoul studio with smooth grey concrete walls and a warm oak bench; hard sun through a tall window on the left draws the window-frame shadow across the wall and the subject',
      'a minimal Seoul apartment corner with a linen curtain half open; a slice of hard sun cuts through the gap and lands across the subject and the pale wood floor',
    ],
    kr_cream_tone: [
      'a cream plaster wall with a curved arch and a beige boucle chair; low sun from the right lays a long arch-shaped shadow across the wall and the subject',
      'a cream-toned café corner with a round marble table; sun through a lace curtain scatters a delicate pattern of light across the wall and the subject',
    ],
    kr_glass_skin: [
      'a white bathroom with a frosted glass block wall; bright sun through the glass blocks lays a soft square pattern of light across the subject',
      'a pale aqua tiled wall beside a window; hard morning sun from the left, water drops on the tiles catch tiny highlights, a crisp shadow of the subject',
    ],
    kr_myeongdong: [
      'a busy Myeongdong shopping street with layered shop signs; hard late-afternoon sun from the end of the street, long shadows, the crowd softly out of focus behind',
      'the glass entrance of a Seoul cosmetics shop; sun reflects off the glass and lays a bright band across the subject, the street behind slightly blurred',
    ],
    kr_leather_minimal: [
      'a dark grey studio wall with a single cognac leather lounge chair; one hard light from the upper left, a crisp shadow of the subject and the chair on the wall',
      'a polished concrete loft with a black steel window; hard sun through the window grid lays sharp lines of light across the floor and the subject',
    ],
    kr_idol_pop: [
      'a pastel pink painted studio wall with a few silver balloons; hard flash-like light from the front left, a sharp shadow of the subject on the wall',
      'a bright rehearsal studio with a mirrored wall and a sprung wood floor; hard sun through high windows makes bright rectangles on the floor',
    ],
    jp_beams_ivy: [
      'the wooden shelving corner of a Tokyo select shop with folded knitwear; hard afternoon sun from a window on the left draws shelf shadows across the wall and the subject',
      'a red-brick campus wall beside a green lawn; low autumn sun from the right throws the subject\'s long shadow across the bricks',
    ],
    jp_nikoand_life: [
      'a lifestyle-goods shop with pale wood shelves of ceramics and baskets; window sun from the left lays bright patches across the shelves and the subject',
      'a small balcony with potted plants and a folding chair; hard morning sun through the leaves scatters dappled light across the wall and the subject',
    ],
    jp_lowrys_sweet: [
      'a soft pink painted bedroom wall with a white iron bed; hard sun through a lace curtain scatters a delicate light pattern across the wall and the subject',
      'a pastel café terrace with a striped awning; midday sun under the awning edge makes a crisp stripe of light and shade across the subject',
    ],
    jp_journal_urban: [
      'a quiet Tokyo apartment with a grey linen sofa and stacked art books; hard sun through tall windows lays long window-frame shadows across the floor and the subject',
      'the stone steps of a modern museum in the city; low sun from the left, the subject\'s shadow falls sharp and long across the pale stone',
    ],
    jp_moussy_denim: [
      'a Tokyo side street with a vending machine and a parked scooter; hard low sun from the end of the street, long shadows across the asphalt',
      'a concrete parking structure with painted lines; sun from the open side cuts sharp bars of light and shadow across the floor and the subject',
    ],
    jp_snidel_romance: [
      'a garden terrace with climbing roses on a pale stone wall; hard sun through the leaves scatters dappled light across the wall and the subject',
      'a white panelled room with a tall French window and sheer curtain; sun through the curtain throws a soft-edged window pattern across the subject',
    ],
    jp_wego_vintage: [
      'a crowded vintage clothing store with racks of old jackets and a neon sign; hard sun from the shop door on the left, a bright stripe across the subject',
      'a Shimokitazawa back alley with old shop shutters and plant pots; low afternoon sun, long shadows across the narrow lane',
    ],
    jp_clane_mode: [
      'a large white gallery room with one dark sculpture on a plinth; hard light from a high window, a long sharp shadow of the subject across the floor',
      'a black-and-white marble lobby; hard sun from the right, the subject\'s shadow falls crisp across the polished floor',
    ],
    jp_coen_natural: [
      'a sunny wooden deck beside a small park; hard midday sun, short crisp shadows, green trees soft behind',
      'a pale wood-panelled room with a big window and a cotton rug; window sun from the left lays a bright rectangle across the floor and the subject',
    ],
    jp_bp_deconstruct: [
      'an artist\'s atelier with raw plaster walls and paint-marked trestle tables; hard sun from a skylight above, a short sharp shadow beneath the subject',
      'a bare concrete room with exposed beams; one hard slice of sun from a high window cuts diagonally across the wall and the subject',
    ],
    kr_glowny_basic: [
      'a white seamless wall in a sunlit Seoul studio; hard sun from a window on the right throws a crisp shadow of the subject onto the wall',
      'a pale grey concrete stairwell with a big window; sun through the glass lays a bright parallelogram across the steps and the subject',
    ],
    kr_marge_leather: [
      'a warm beige studio with a brown leather sofa and a floor lamp; hard sun from the left, a clean shadow of the subject across the sofa and wall',
      'a city café with dark wood and leather banquettes; window sun from the right lays a bright band across the table and the subject',
    ],
    kr_emis_street: [
      'a Seoul basketball court with chain-link fence; hard afternoon sun throws the fence\'s diamond-pattern shadow across the court and the subject',
      'a convenience-store corner on a Seoul street at dusk; light from the shop window and the low sun, long shadows on the pavement',
    ],
    kr_balletcore: [
      'a ballet studio with a wooden barre, a mirror wall and pale pink walls; hard sun through tall windows lays long bright rectangles across the wood floor and the subject',
      'a pale plaster hallway with tall arched windows; low sun throws arched shadows down the floor and across the subject',
    ],
    illust_craft_ceramic: [
      'a potter\'s studio with a wooden wedging table, clay tools and unglazed bowls on shelves; hard window sun from the left, crisp shadows of the pots on the wall',
      'a rough plaster shelf in a craft shop with handmade ceramics; low sun from the right throws each object\'s long shadow across the shelf',
    ],
    showa_retro: [
      'an old Showa-era kissaten café with red vinyl booths and a wood-panelled wall; afternoon sun through a dusty window lays a warm bright patch across the table and the subject',
      'a Japanese shopping arcade with old tin signs; hard sun through the arcade roof gaps makes stripes of light across the floor and the subject',
    ],
    retro_future_y2k: [
      'a silver metallic studio backdrop with a clear inflatable chair; hard light from the front left, a sharp shadow of the subject on the silver',
      'a translucent blue acrylic room set; hard light from behind shines through the acrylic, the subject lit with a crisp edge',
    ],
    bold_clash_2026: [
      'a studio with two painted walls meeting at a corner, one cobalt blue and one tomato red; hard sun from the left throws a sharp shadow across both colours',
      'a bright yellow painted wall beside a green door; hard midday sun, a short crisp shadow of the subject on the yellow',
    ],
    ugly_cute_2026: [
      'a lumpy hand-painted pastel set with oversized foam props; hard light from the front, a crisp funny shadow of the subject and props on the wall',
      'a small kitchen with mismatched colourful tiles; hard window sun from the left, short shadows across the counter',
    ],
    euro_editorial: [
      'a Parisian apartment with tall double doors, herringbone floor and bare plaster walls; hard sun through the tall window lays long window-frame shadows across the floor and the subject',
      'a stone terrace on a European rooftop; hard late sun from the side, the subject\'s long shadow falls across the pale stone',
    ],
    taiwan_nostalgia: [
      'an old Taiwanese house with terrazzo floor, a green iron window grille and a tin biscuit box on the table; sun through the grille lays its pattern across the wall and the subject',
      'a Taipei old-town street with a mosaic-tiled shopfront and a parked scooter; hard afternoon sun, long shadows along the arcade',
    ],
    bauhaus: [
      'a white-and-grey modernist room with a primary-red block shelf; hard sun from a strip window draws a clean straight shadow line across the wall and the subject',
      'a flat-roofed concrete building terrace with a steel railing; midday sun, the railing throws sharp parallel shadows across the floor',
    ],
    chrome_futurism: [
      'a mirror-polished chrome set with curved steel panels; one hard light from the upper left makes clean bright reflections and a crisp shadow of the subject',
      'a dark studio with a brushed-steel floor; a hard spotlight from above makes a bright circle, the subject sharp in its centre',
    ],
    neo_minimal: [
      'a warm plaster room with one low oak bench and nothing else; hard sun from a window on the left draws a long rectangle of light across the floor and the subject',
      'a pale travertine wall and floor; low sun from the right throws a single long shadow of the subject across the stone',
    ],
    architectural_min: [
      'a concrete gallery space with a tall narrow slit window; a hard blade of sun cuts across the wall and the subject',
      'an exterior concrete stairway with deep shadows; midday sun makes sharp geometric light-and-shadow shapes across the steps and the subject',
    ],
    cinematic_light: [
      'a dim hotel corridor with warm wall sconces; one hard light from a half-open doorway falls across the subject, the corridor behind stays dark',
      'a city diner booth at night; hard light from the window neon and an overhead lamp, crisp shadows across the table',
    ],
    gradient_glow: [
      'a smooth backdrop painted in a soft colour gradient; one hard light from the side throws a crisp shadow of the subject across the gradient',
      'a frosted acrylic wall lit from behind in two colours; the subject stands in front, lit by a hard key from the left',
    ],
    blurry_floral: [
      'a flower garden at the edge of a lawn, blossoms in the foreground softly blurred; hard sun from the side lights the subject with a crisp shadow',
      'a florist\'s workbench crowded with buckets of flowers; window sun from the left, petals in the foreground out of focus',
    ],
    geometric_abstract: [
      'a studio set of large painted wooden blocks, arches and circles; hard light from the upper left throws sharp geometric shadows across the set and the subject',
      'a courtyard of tiled geometric steps; midday sun, crisp triangular shadows across the tiles and the subject',
    ],
    mono_contrast: [
      'a bare white wall; one hard light from the far left, the subject half bright and half in deep shadow, a sharp black shadow on the wall',
      'a dark room with a single window; a hard shaft of sun falls across the subject, everything else drops to near black',
    ],
    natural_shadow: [
      'a pale plaster wall in late sun; the shadow of a large leafy plant spreads across the wall and the subject',
      'a linen-covered table by a window; morning sun through tree branches scatters dappled light across the table and the subject',
    ],
    luxury_texture: [
      'a dark green marble wall with a brass ledge; one hard warm light from the upper left, a crisp shadow and a fine highlight along the brass',
      'a cream boucle sofa against walnut panelling; hard sun through a tall window lays a long bright stripe across the sofa and the subject',
    ],
    acid_neon: [
      'a dark studio wall with one bright acid-green neon tube; hard white key light from the front left, the neon colour bounces on the subject\'s side',
      'a night street wall covered in coloured light from a shop sign; a hard streetlamp from above gives a crisp shadow on the pavement',
    ],
    candid_film: [
      'an ordinary apartment kitchen with a fridge covered in magnets; hard window sun from the left, crisp shadows across the counter and the subject',
      'a quiet neighbourhood street with parked bicycles; low late sun, long shadows across the road, a snapshot moment',
    ],
    trinket: [
      'a vintage glass display cabinet with small collected objects on wooden shelves; hard window sun from the left, each object casts a small sharp shadow',
      'a cluttered collector\'s desk with old postcards and small figures; a desk lamp from the right throws crisp shadows across the desk',
    ],
    surveillance: [
      'a fluorescent-lit parking garage seen from a high corner; flat hard overhead tube light, the subject with a short shadow straight below',
      'an empty office lobby at night from a high camera angle; hard light from ceiling panels, a crisp shadow under the subject',
    ],
    future_medieval: [
      'a stone castle hall with a tall narrow arched window and a modern steel bench; a hard shaft of sun through the arch falls across the subject',
      'a rough stone courtyard with iron torches and a sleek modern sculpture; hard low sun throws long shadows across the stones',
    ],
    brand_3coins: [
      'a bright pastel-yellow shop corner with neatly lined small goods; hard light from the front, short crisp shadows, cheerful and tidy',
      'a white kitchen counter with a few colourful household goods; morning sun from the left, small sharp shadows',
    ],
    brand_uniqlo: [
      'a clean white studio wall with a pale wood floor; hard sun from a window on the left throws a crisp simple shadow of the subject',
      'a bright city pavement in front of a glass building; midday sun, a short sharp shadow, the street softly blurred',
    ],
    brand_muji: [
      'a calm room with a pale oak floor, a cotton futon and a plain white wall; hard morning sun through a paper blind lays soft stripes across the wall and the subject',
      'a simple wooden kitchen shelf with white porcelain and linen; window sun from the left, quiet crisp shadows',
    ],
    brand_beams: [
      'a Tokyo select shop with dark wood floors and racks of tailored jackets; hard sun from the shop window draws a bright stripe across the floor and the subject',
      'an old university library staircase with brass handrails; hard sun from a tall window, the handrail shadow falls across the steps and the subject',
    ],
    brand_issey: [
      'a white gallery wall with pleated paper sculptures hanging; one hard light from the side makes every pleat throw a crisp shadow, the subject\'s shadow long on the wall',
      'an open concrete plaza; hard midday sun, the subject\'s shadow short and sharp, pleats catching the light',
    ],
    brand_snowpeak: [
      'a quiet forest campsite with a steel-and-wood camp table and a grey-green tent; hard sun through the trees scatters dappled light across the table and the subject',
      'a riverside gravel bank with a titanium kettle on a stove; low morning sun from the right, long crisp shadows across the stones',
    ],
    brand_plusd: [
      'a white design studio desk with a few clever small objects; hard window sun from the left, each object casting a playful sharp shadow',
      'a pale grey plaster wall with a narrow shelf; hard sun from the right throws a crisp shadow of the subject and the shelf across the wall',
    ],
  };
  var SHOOT_NOW = '';   // 這一張抽到的場地(保留原模特兒那條用來直接當背景)
  function shootFor(key) {
    var pool = SHOOTS[key];
    SHOOT_NOW = (pool && pool.length) ? pickFresh(pool, 'shoot_' + key) : '';
    return SHOOT_NOW;
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
  //  📐 v11.28 只換取景鬆緊,不換機位高度/俯仰(機位一律 = 商品照當初的位置,見 VIEW_P)
  var ANGLES_P = [
    'framed close, the product filling most of the frame',
    'framed close, the product filling most of the frame',
    'framed close and sharp, the background melting away',
    'framed a little wider, the setting reading clearly around the product',
    'a tight crop on the product with the setting just readable around it',
  ];
  var VIEW_P = 'The camera keeps the height and angle of the product photo; table edges, floor lines and horizon follow that same perspective, and the product rests on its surface with a soft contact shadow.';
  // 商品:站在什麼表面上(風格沒寫表面時用)
  var SURFACES = [
    'a slab of pale travertine', 'a weathered oak table', 'a block of raw concrete', 'a fold of washed linen',
    'a terrazzo step', 'a sun-warmed stone ledge', 'a low plinth painted in the brand colour', 'a polished walnut shelf',
    'a sheet of ribbed glass over a coloured board', 'a stack of two simple wooden crates',
  ];
  // 光的時刻(都是一個真實光源、有方向,硬光為主 —— 量尺好圖都是直射光)
  //  💡 v2.20 光的鐵律(RA 2026-11-04:「人要跟背景同步打光 —— 學 KOL 影片」,不是補一句)
  //   KOL 影片 v5.59 早就踩過:舊版只寫「光從哪來」,從沒說【照主體的就是背景那盞光】→ 模型各打各的 → 像貼上去
  //   實例:雜誌封面 × 歐系,巴黎公寓斜陽打在牆上,男模卻是正面棚燈、沒影子 → RA「很像貼上去」
  //   三條線(重拍 / 商品 / 保留原圖)全部共用這一段,不再各寫各的
  function LIGHT_LAW(S, pron) {   // v2.33 同樣的意思壓成一句(刺蝟星球:每段長度平均)
    //  v2.34 再壓一次:意思不變(同方向、同色、不比環境亮、影子同向、帶到反光),長度跟其他段平均
    return 'One light for the whole picture: ' + S + ' is lit only by the light of this place, from the same direction and in the same colour, never brighter than the setting around ' + pron + '; ' +
      S + ' casts its shadow the same way as every other shadow and picks up the colour bounced from nearby surfaces.';
  }
  //  💡 v2.22 光的鐵律・保留版(RA 2026-11-05「切記,後續都不能有這種狀況」)
  //   要照原圖保留的人(美業成果、保留原模特兒)→ 臉上的光是原圖的光,改不了 →【反過來讓場景跟著那道光】
  //   實測 HH 眉睫:工作室斜陽+原圖手機平光 = 「超級假」;窗紗柔光(剛好跟原圖的光一樣)=「很自然」
  function LIGHT_FOLLOW(S, pron) {
    return 'The light follows the photo: this place is lit the way ' + S + ' is already lit in the photo, the same direction, softness and colour, and nothing in the background is brighter, harder or warmer than the light on ' + pron + '; ' +
      'surfaces keep their real photographed texture, and the background sits a little softer in focus.';
  }
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
    // ── 2026-10-27 Pinterest「2026質感 商品攝影 居家」「2026質感 家具 拍攝 空間」 ──
    'a bare putty-coloured room where floor and wall are the same soft tone, one hard line of sun across it',
    'a dim living room at dusk, one lamp glowing on a dark wooden sideboard, plants and shelves falling into shadow',
    'a warm walnut sideboard against a pegboard wall, a pleated paper lamp glowing beside it',
    'a sun-washed cream room with a rattan cabinet and a vase of dried flowers',
    'a bright dining corner by tall venetian blinds, soft grey daylight on a pale wooden table',
    'a bedside on a slow morning: rumpled linen sheets, a mushroom lamp and a short stack of books on a rattan mat',
    'a seventies living room with a round walnut coffee table, a shag rug and one red accent',
    'a green-checked rug in a sunny living room beside a deep green velvet armchair',
    'an airy white room with floor-length sheer curtains and a tall arched floor lamp',
    'a calm kitchen-dining space with wooden floating shelves and a low wooden table',
    'a room with a textured lime-plaster wall and a woven rattan floor mat',
    'a light apartment hallway with framed prints and a warm wooden floor',
    'a cream living room from the eighties with a tan leather sofa, big leafy plants and a wide window',
    'a children\'s room with arched built-in shelves, a sage-green panelled wall and a round rug with a leafy border',
  ];
  // 版型 → 構圖(重拍用)。白棚/極簡海報連「地點」也由版型決定(RA:版型管地點與構圖)
  var LAYOUT_SHOT = {
    white_studio:    { place: 'on a seamless studio sweep in a soft tone from the brand palette', frame: '', words: 'small and quiet in the empty studio space' },
    minimal_poster:  { place: 'in front of one plain wall painted in a single colour', frame: 'lots of empty wall around the subject', words: 'set in the empty wall space' },
    magazine_cover:  { place: '', frame: 'a magazine-cover frame: the subject centred, close and confident, the top third of the frame open', words: 'across the open top of the frame like a cover title' },
    scene_lifestyle: { place: '', frame: 'a candid moment from real life, the subject large and close in the foreground, the background softly out of focus', words: 'in a calm corner of the frame' },
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
    // ── 2026-10-24 第二批:RA 指定 Pinterest「2026 MD拍攝」整頁看過抽出的手法 ──
    { studio: true,  t: 'the model leaps onto a giant flat cut-out prop of a rocking horse, caught mid-air with one knee lifted, against a pale blue seamless backdrop' },
    { studio: true,  t: 'the model sits cross-legged on the studio floor among a casual still life of books, fruit and a paper bag, one hand propping the cheek, a playful sideways glance' },
    { studio: true,  t: 'the model sits on a low stack of books holding a vintage film camera at chest height, glasses on, looking over the camera at the lens' },
    { studio: true,  t: 'the model sits backwards on a simple white chair, a coffee cup held at the chin with both hands, outfit and backdrop in the same soft tone' },
    { studio: true,  t: 'the model leans over a piece of office equipment, hair blown sideways by a fan, one hand pressing something flat on its glass' },
    { studio: false, t: 'the model strides across a styled living room in front of a soft sofa, one bright colour accent at the socks, caught mid-step' },
    { studio: true,  t: 'the model leans on a round table that is the same saturated colour as the floor and wall, a curved set cut-out behind, chin on hand' },
    { studio: true,  t: 'the model sits in an office chair with one knee drawn up, a corded retro telephone at the ear, grey seamless behind' },
    { studio: true,  t: 'the model playfully tugs a long strand of yarn toward the lens, a ball of yarn on the floor, weight thrown back' },
    { studio: true,  t: 'a symmetrical frame: the model sits centred behind a long white table, a neat row of small objects running toward the lens' },
    { studio: true,  t: 'the model sits on the floor beside a retro boombox and scattered photos, legs folded to one side, pastel set' },
    { studio: true,  t: 'a close half-body portrait against a warm orange gradient, the model hugging a bag under one arm, looking off to the side' },
    { studio: true,  t: 'a wide-angle shot with the model\'s open hand thrust toward the lens, exaggerated perspective, the face laughing just behind' },
    { studio: true,  t: 'the model squats on a small stool in a set where floor and wall are one saturated colour, elbows on knees, direct stare' },
    { studio: true,  t: 'the model sits on a wooden chair in a two-tone grey studio, one leg crossed high, a painted floor line running past' },
    { studio: true,  t: 'the model stands beside a giant sculptural paper flower taller than the body, arms lifted lightly, on a pale reflective floor' },
    { studio: false, t: 'the model reclines on a bench sunk among blooming flowers in a lush garden, looking straight at the lens' },
    { studio: true,  t: 'a huge length of bright fabric billows out behind the model like a wing against a single-colour backdrop' },
    { studio: true,  t: 'the model kneels among retro objects — an old television, a typewriter, a rotary phone — head tilted, magazine-editorial calm' },
    { studio: true,  t: 'a shower of confetti falls around the model in front of a saturated backdrop, the model laughing with arms spread' },
    { studio: true,  t: 'the model sits on a clear acrylic chair on a blue seamless set, paper planes caught mid-flight around her' },
    { studio: true,  t: 'shot from directly overhead, the model looking up into the lens, hair spread out, the floor colour filling the frame' },
    { studio: true,  t: 'the model stands with one foot up on an office chair, an oversized blazer falling open, grey seamless behind' },
    { studio: false, t: 'the model stands in a dark doorway beside a vase of flowers, window light falling across one side of the body' },
    { studio: true,  t: 'a dark room, one coloured gel light grazing the side of the face, the rest falling into shadow' },
    { studio: true,  t: 'behind-the-scenes framing: light stands and a tripod visible at the edge of the frame, the model relaxed between shots' },
    { studio: false, t: 'shot from street level looking up, the model framed against tall city buildings and sky' },
    { studio: true,  t: 'the model holds an object up over one eye with one hand, the other eye looking straight at the lens, deep green backdrop' },
    // ➕ v11.43 RA 2026-11-05 Pinterest「2026高質感MD拍攝」補漏的 10 種
    { studio: false, t: 'the model walks past at a slow shutter, the background stretched into soft streaks of colour while the face and the garment stay sharp' },
    { studio: false, t: 'the model stands on a sunlit lawn, a sheer length of fabric lifting in the breeze behind, leaf shadows dappling across the body' },
    { studio: false, t: 'the model stands in a quiet gallery beside a white marble statue, the stone and the garment sharing the same soft skylight' },
    { studio: false, t: 'the model stands in front of a wall of glowing red paper lanterns, the warm colour wrapping the whole frame' },
    { studio: true,  t: 'the model rests the head and folded arms on a glossy mirror-like table, the reflection doubling the pose, eyes to the lens' },
    { studio: true,  t: 'the model is caught mid-run across a clean seamless set, an armful of books, the hem of the garment swinging with the stride' },
    { studio: false, t: 'the model crosses a striped street crossing with a slender dog on a lead, a bus shelter behind, caught mid-step' },
    { studio: true,  t: 'the model sits inside a huge clear glass sphere, its curved surface catching soft highlights around the body' },
    { studio: true,  t: 'a sheer silk scarf drifts across the model in a gust from a fan, half veiling the shoulder, the rest of the garment clear' },
    { studio: false, t: 'the model leans against the side of a dark car at dusk, the last light of the sky reflected along its paint' },
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
    // ── 2026-10-24 第二批:Pinterest「產品攝影 創意 2026」抽出的靜物手法 ──
    // ── 2026-10-27 Pinterest「2027質感 產品拍攝」 ──
    'the product peeks out of an open leather bag lying on its side, a hand reaching in, warm low light',
    'the product leans against rough grey boulders, the whole set in shades of stone grey',
    'the product sits on the shelf of an open green metal locker, headphones and a jacket hanging beside it',
    'the product lies on fluffy pale-blue faux fur scattered with small paper stars, seen from straight above',
    'the product stands among curled sheets of paper and a folded card on a warm yellow backdrop',
    'the product stands on a cluster of dark charcoal rocks, a single low light grazing the stone',
    'the product is tied up with natural twine and set on a sheet of kraft paper, a few seeds scattered around',
    'the product sits on a dark wooden table among loose red ribbon and torn wrapping paper, a paper lantern glowing behind',
    'the product stands on a small tray on soft blue bedding, morning light across the sheets',
    'the product sits on a linen tablecloth beside halved figs and a glass of milk, warm beige morning light',
    'the product balances on top of a playful tower of small objects from the moment it is used — the things that sit beside it in real life — stacked against a pale backdrop',
    'the product rises from a burst of ruffled ribbon on a glass shelf, sculptural and soft',
    'a few small objects from the moment this product is used float mid-air around it above a coloured table, frozen in a single instant',
    'the product rests on smooth sculpted white forms like soft rock, lit by a soft window glow',
    'a hand presses the product against a bare shoulder, skin as the backdrop, warm soft light',
    'the product is held up in front of one eye by a hand, the face behind softly in shadow',
    'the product leans against large geometric letter-like shapes and arches in bold flat colours',
    'the product stands on rugged raw rock, a tiny landscape built around it',
    'the product sits on a saturated table among sculptural tableware, strong colour blocks in red and green',
    'a satin ribbon loops through the air above the product, drawing a shape against a pale backdrop',
    'the product leans on a folded paper triangle backdrop with spools and beads scattered at its feet',
    'the product sits inside a dark glossy set with a precise mechanical rig above it, one sharp beam of light',
    'the product stands among stacks of coloured discs and blocks, playful and graphic',
    'the product is presented on a vintage silver cake stand, slightly raised like a jewel',
    'the product rests on curved, layered sheets of bent paper casting soft shadows',
    'the product sits on a plush fur surface next to a single lit candle, warm and tactile',
    // ➕ v11.43 RA 2026-11-05 Pinterest「2026高質感商品拍攝」補漏的 10 種
    'the product rests on a piece of weathered driftwood half sunk in fine pale sand, one low warm light',
    'the product stands on a cut slice of tree trunk among dry twigs and a few dried flowers, earthy and calm',
    'two hands untie the ribbon of a gift box, the lid lifting off to reveal the product inside',
    'the product sits nestled in an opened shipping box among tissue paper, one hard light falling in from above',
    'the product is lined up on a glass bathroom shelf with a few everyday things around it, soft window light',
    'the product sits on a working desk beside an open laptop and a cup of coffee, a hand at the keyboard just in frame',
    'many identical units of the product are laid out in neat diagonal rows filling the whole frame, seen from straight above',
    'the product and a few everyday things spill out of a canvas tote bag lying on its side',
    'the product stands on a small shelf on a pegboard wall among neat tools and small objects in one bold colour',
    'the product stands on a glossy mirror-like surface, a crisp reflection beneath it',
  ];
  // ═══════════════════════════════════════════════════════════════════
  // v2.10 品類手法(2026-10-24,RA 給的 11 個 Pinterest 品類頁:餐飲、生鮮肉品、家電、手持、睫毛、
  //   保健品、寵物、親子、戶外、瑜珈、髮型)—— 看品牌名/商品名/規格認品類,抽該品類的拍法
  //   s = 商品(靜物)手法;m = 有人(模特兒)的手法;studio:false 的品類在白棚/極簡海報版型不用;wear:true = 服飾重拍也能用(看得到整件衣服)
  // ═══════════════════════════════════════════════════════════════════
  var CAT_RULES = [
    ['airsoft_scope', /(生存遊戲|airsoft).*(瞄準鏡|瞄具|scope)|(瞄準鏡|瞄具|scope).*(生存遊戲|airsoft)/i],   // 🔭 v11.29 先認瞄具類
    ['airsoft',    /生存遊戲|airsoft|漆彈|戰術|tactical|瞄準|射擊運動/i],
    //  v2.30(2026-11-19 RA「每類商品給專屬拍法」)先認商品名、繁簡都認、新增 料理成品/酒飲/醬料罐/包裝食品/內衣蕾絲/療癒器物
    ['packaged',   /真空|禮盒|禮袋|包裝|袋裝|盒裝|罐頭|冷凍包|即食包|料理包|香腸|臘腸|肉乾|米腸|gift ?box|vacuum|packaged|sausage/i],
    ['appliance',  /調理機|调理机|料理機|料理机|破壁|攪拌機|搅拌机|豆漿機|豆浆机|咖啡機|咖啡机|blender|mixer|家電|家电|電器|电器|吹風機|吹风机|吸塵|吸尘|電鍋|电锅|快煮壺|水壺|風扇|风扇|電扇|电扇|暖爐|暖炉|清淨機|净化器|烤箱|氣炸|气炸|果汁機|按摩|appliance|vacuum|kettle|blender|fryer|purifier|dryer|heater|fan\b|massager/i],
    //  v2.34 RA 2026-11-20 西華鍋具 / 水晶飾品:鍋具(電鍋等家電已在上一行先認走)、配戴型飾品(水晶手鍊歸這裡,頌缽、晶洞仍是療癒器物)
    ['cookware',   /鍋|锅|平底|湯鍋|汤锅|炒鍋|炒锅|鑄鐵|铸铁|不鏽鋼|不锈钢|琺瑯|珐琅|砂鍋|砂锅|壓力鍋|压力锅|鍋具|廚具|厨具|刀具|菜刀|砧板|cookware|saucepan|frying pan|skillet|casserole|dutch oven|stockpot|wok\b|knife set/i],
    ['jewelry',    /手鍊|手链|手鏈|手環|手环|項鍊|项链|項鏈|戒指|耳環|耳环|耳針|墜子|吊墜|吊坠|胸針|珠寶|珠宝|飾品|饰品|串珠|bracelet|necklace|pendant|earring|\bring\b|jewel|bead/i],
    ['dish',       /餃|饺|燒賣|烧卖|小籠|小笼|腸粉|肠粉|叉燒|叉烧|蘿蔔糕|萝卜糕|dumpling|dim sum|料理|套餐|主廚|定食|便當|拼盤|前菜|主菜|佐|疙瘩|燉飯|炖饭|義大利麵|意大利面|排餐|點心|点心|港點|港点|煎|燉|炖|焗|蒸|炒|炸|烤|燒|烧|滷|卤|紅燒|红烧|dish|plated|risotto|pasta|gnocchi|dim ?sum|bistro|fillet|confit/i],
    ['drink',      /葡萄酒|紅酒|红酒|白酒|氣泡酒|气泡酒|香檳|香槟|粉紅酒|威士忌|啤酒|調酒|调酒|清酒|梅酒|果汁|茶飲|茶饮|飲品|饮品|拿鐵|拿铁|奶昔|汽水|latte|smoothie|prosecco|wine|champagne|whisk(e)?y|beer|cocktail|sake|juice|soda/i],
    ['jar',        /醬|酱|調味|调味|油膏|橄欖油|橄榄油|松露|醋|蜂蜜|果醬|果酱|抹醬|罐|jar|sauce|condiment|olive oil|honey|jam|vinegar/i],
    ['lingerie',   /內衣|内衣|胸罩|內褲|内裤|蕾絲|蕾丝|睡衣|bralette|bra\b|lingerie|lace|panty|panties/i],
    ['ritual',     /頌缽|颂钵|缽|钵|水晶|晶石|香氛|精油|薰香|熏香|線香|冥想|能量|靈氣|灵气|singing bowl|crystal|incense|aroma|meditation/i],
    ['meat',       /和牛|牛排|牛肉|豬肉|猪肉|雞肉|鸡肉|羊肉|肉品|生鮮|生鲜|海鮮|海鲜|漁|渔|魚|鱼|蝦|虾|蟹|wagyu|beef|pork|steak|lamb|seafood|salmon|fish/i],
    ['pet',        /寵物|宠物|貓|猫|狗|犬|毛孩|飼料|饲料|牧草|pet|dog|cat\b|puppy|kitten|hay/i],
    ['lash',       /睫毛|眼線|眼线|眉|lash|mascara|brow|eyeliner/i],   // v2.34 只留眼周(護唇膏曾被拍成「舉在眼睛旁邊」);唇彩、底妝歸手持保養
    ['hair',       /美髮|美发|髮|发型|理髮|理发|剪髮|barber|hair|salon/i],
    ['yoga',       /瑜珈|瑜伽|皮拉提斯|健身|運動內衣|禪舞|禅舞|舞蹈|yoga|pilates|fitness|gym|leggings|dance/i],
    ['outdoor',    /戶外|户外|露營|露营|登山|野餐|outdoor|camping|hiking|trail/i],
    ['family',     /親子|亲子|兒童|儿童|童裝|童装|寶寶|宝宝|嬰|婴|幼|媽媽|妈妈|kids?\b|baby|toddler|family/i],
    ['supplement', /保健|益生菌|膠原|胶原|維他命|维他命|維生素|维生素|魚油|鱼油|葉黃素|叶黄素|錠|膠囊|胶囊|supplement|vitamin|probiotic|collagen|capsule/i],
    ['food',       /食|餐|麵|面包|飯|饭|甜點|甜点|蛋糕|麵包|茶|咖啡|飲|饮|零食|餅|饼|巧克力|果|food|snack|coffee|tea\b|cake|bakery|chocolate|drink/i],
    ['handheld',   /彩妝|彩妆|美妝|美妆|化妝|化妆|唇|口紅|口红|粉底|粉餅|防曬|防晒|lipstick|lip balm|makeup|cosmetic|sunscreen|保養|保养|精華|精华|乳液|面霜|香水|護手|护手|身體乳|身体乳|serum|cream|lotion|perfume|skincare|fragrance/i]
  ];
  var CAT_ART = {
    //  v2.12 料理成品(餐廳、餐酒館、港點)—— Pinterest fine dining 2026:暗場一束光、整片飽和色桌布、手持刀叉或鑷子正在擺盤的瞬間
    dish: { s: [
      'shot from directly overhead on a deep red tablecloth: two hands with knife and fork poised over the plate, the plate a bright island in the colour',
      'a dark room, one narrow spotlight from above falls on the plate alone, every glaze and crisp edge glowing, the rest falling into black',
      'a hand in a dark sleeve pours sauce from a small copper jug onto the plate, low side light, deep shadows',
      'shot at table height: the plate sharp in front, a glass of wine and a small candle soft behind it, warm evening restaurant light',
      'a gloved hand with tweezers sets the final garnish on the plate, the plate sharp, the hand soft, dark backdrop',
      'the plate on a stone table by a bright window, hard sun cutting one clean shadow across the food and the linen'
    ] },
    //  v2.12 酒與飲品 —— Pinterest wine campaign:酒瓶放在意想不到的表面(絨布沙發)、整片跟酒標同色的背景＋一道斜光、暗場只勾輪廓
    drink: { s: [
      'the bottle lies on a deep velvet sofa cushion, hard window light falling across the velvet and the glass',
      'the bottle stands on a block in front of a backdrop the colour of its label, one hard diagonal beam of light cutting across bottle and wall',
      'pure black backdrop, a single rim light traces only the outline of the bottle and the glass, the drink glowing from behind',
      'the bottle and a filled glass on a sunlit café table, long late-afternoon shadows, the colour of the drink glowing in the light',
      'the bottle lies in a bucket of crushed ice, its label turned to the lens, beads of condensation on the glass',
      'several bottles stand at different heights on coloured blocks in a bright single-colour set, like a shop window'
    ], studio: true },
    //  v2.12 醬料瓶罐 —— Pinterest sauce jar:手把罐子遞向鏡頭、罐子放在一灘自己的醬汁上俯拍、彩色磁磚台面、從冰箱拿出來的那一下
    jar: { s: [
      'two hands in a chunky knit sweater hold the jar toward the lens, the label facing the camera, the person soft behind',
      'shot from directly overhead: the jar stands in a bold splash of its own sauce on a bright single-colour backdrop',
      'the jar on a sunny tiled kitchen counter, a spoonful of its contents resting beside it, hard sun and crisp shadows',
      'a hand pulls the jar out of an open fridge door, cool fridge light on the glass',
      'the jar on a wooden shelf in warm side light, its contents glowing through the glass, the label facing forward'
    ], studio: true },
    //  v2.12 包裝食品(真空包、冷凍包、禮盒)—— Pinterest frozen food packaging:包裝直立＋煮好的成品、整片飽和色背景、冰塊、彩色階梯、整齊重複排列
    packaged: { s: [
      'the pack stands upright exactly as photographed beside a plate of the cooked food from it, a bright single-colour backdrop, hard sun',
      'the pack rests half-buried in clear ice cubes, cold light glinting on the ice and the wrapper',
      'several identical packs line up in a neat repeating row on a bold coloured surface, shot from overhead',
      'the pack stands on a set of colourful stepped blocks, crisp shadows falling down the steps',
      'the pack sits in a wire shopping basket with a few fresh ingredients, bright clean light',
      'a hand holds the pack toward the lens at a backyard barbecue, the cooked food grilling softly behind'
    ] },
    //  v2.12 內衣蕾絲 —— Pinterest lingerie still life:掛在牆上吃樹影、雙色紙平拋、披在燈罩或椅背、從紙袋裡露出來、皺褶床單＋咖啡與書
    lingerie: { s: [
      'the piece hangs from a single hook on a pale wall, hard sun through leaves throwing dappled shadows across the lace and the wall',
      'shot from overhead: the piece laid flat across a two-tone backdrop split diagonally, a single rose and a lipstick beside it',
      'the piece is draped over the shade of a table lamp in a softly lit bedroom corner',
      'the piece spills out of a paper shopping bag tied with ribbon, soft daylight',
      'the piece lies on rumpled white sheets beside a cup of coffee and an open book, morning window light',
      'the piece rests on a silver tray with a string of pearls on a deep red surface'
    ] },
    //  v2.12 療癒器物(頌缽、水晶、香氛)—— Pinterest singing bowl:手掌托著缽與木槌、樹影灑在金屬上、俯拍缽裡浮著花瓣、暗場裡槌子碰著缽緣
    ritual: { s: [
      'an open palm holds the piece with the mallet resting beside it, clean pale backdrop, soft daylight',
      'hard sun through leaves throws dappled light across the piece and the table, its metal glowing warm',
      'shot from directly overhead: the piece holds still water with a few flower petals floating on it',
      'a dark room, one warm side light, a hand rests the wooden mallet against the rim of the piece',
      'the piece on a linen cloth on a low wooden table, a single shaft of window light, one thin wisp of incense smoke drifting in it'
    ], studio: true },
    //  v2.34 鍋具(西華):不鏽鋼會照出周圍一切 → 周圍乾淨、一大片柔光從側面拉出一條長而乾淨的漸層高光、鍋底有接觸影;用起來的蒸氣與燉菜才有溫度
    cookware: { s: [
      'the product on a dark stone counter, one large soft window light along one side drawing a long clean highlight down its polished surface, a thin curl of steam escaping from under the lid',
      'a hand lifts the lid off the product on a stove, a soft cloud of steam rising into low side light, the steel reflecting only the warm kitchen around it',
      'shot from directly overhead: the open pot of a finished stew on a linen cloth, a ladle resting inside, bowls and fresh herbs around it',
      'the product alone on a seamless warm-grey sweep, one big soft light from the side, a clean graded highlight on its body and a soft contact shadow beneath',
      'the product at the centre of a wooden table set for a family dinner, hands reaching in with bowls, warm evening light',
      'the product on a gas hob, a low blue flame beneath it, the kitchen dark and warm behind, the rim catching a thin line of light'
    ], studio: true },
    //  v2.34 水晶 / 串珠飾品:間接柔光(直射會刺眼反光)、微距看得到每顆珠子裡的顏色、天然素材當配角;戴在手上用柔和日光
    jewelry: { s: [
      'the piece resting on a smooth pale stone beside a few dried flowers, soft indirect window light, every bead glowing with its own inner colour',
      'a macro close-up of the piece coiled on raw linen, one soft light from the side giving each bead a small bright highlight',
      'the piece draped over a small piece of driftwood in bright open shade, a shallow depth of field',
      'shot from directly overhead on cream paper: the piece in a loose circle among a few raw crystal chips',
      'the piece on a small ceramic dish on a wooden table, a single shaft of morning light catching it'
    ], m: [
      'a close shot of the wrist wearing the piece, the hand resting on a soft knit sleeve, gentle daylight',
      'a hand wrapped around a cup of tea, the piece on the wrist sharp, the face out of frame',
      'a close side shot of the wrist and collarbone in soft window light, the piece the first thing the eye lands on'
    ], studio: true, wear: true },
    food: { s: [
      'shot from directly overhead on a red cloth, hands reaching in to serve, the table set around the product',
      'a dark moody tabletop with one low side light, deep shadows, every surface of the food glistening',
      'hard sun through window blinds lays stripes of light across the table and the product',
      'a spoon lifts one bite toward the lens, the rest of the table soft behind it',
      'chopsticks lift a portion up into the air against a solid orange backdrop',
      'an overhead table setting where plates, glasses and linen share one warm colour story',
      'the product with a glass of wine and one candle beside it, soft drapery behind, evening warmth',
      'the product sits on a plinth-like block beside a drink, block and backdrop in one tone'
    ] },
    meat: { s: [
      'two hands in dark sleeves hold the product toward the lens against pure black, every line of marbling sharp',
      'the product rests on dark slate beside a hot cast-iron pan, a low backlight catching wisps of smoke from the pan',
      'the product lies on a dark stone plate with fresh herbs, moody side light',
      'the product lies on a wooden board over drifting cold mist, a few small edible flowers',
      'the product sits on a green marble pedestal against a soft sage backdrop',
      'shot from overhead on a pale blue table: the product on a white plate among herbs and little dishes, airy and fresh',
      'a hand sets the product onto a white plate on a dark wooden table, warm low light',
      'the product hangs mid-air against a warm gradient, a few herbs falling around it',
      'the product lies on parchment over white linen with cracked pepper and garlic, soft daylight'
    ] },
    appliance: { s: [
      'the appliance stands on a raw concrete pedestal, a long soft shadow running behind',
      'arched cut-outs in bold flat colours frame the appliance like a stage',
      'the appliance caught in use, its moment of action frozen mid-air — steam, a pour, a breeze',
      'the appliance stands at home in a sunlit living room among real furniture, the light warm and low',
      'the appliance stands on a black glossy floor, its mirror reflection lying beneath it',
      'the appliance sits in a real kitchen, fresh ingredients soft and blurred in the foreground',
      'the appliance stands tall and large in a room painted in its own colour family, low camera at its height, soft window light',
      'a breeze from the appliance lifts a few loose sheets of paper into the air while someone reads nearby, bright airy room'
    ], m: [
      'a model lounges beside the appliance in a colour-blocked set, at ease, the appliance in clear view'
    ], studio: true },
    handheld: { s: [
      'an elegant hand holds the product lightly at the fingertips against a clean backdrop',
      'a hand holds the product up from below into warm light, rising into the frame',
      'the product floats on a diagonal across the frame, its soft shadow far below',
      'the product lies on a fold of draped satin that catches the light',
      'the product rests on a soft snow-white surface under open sky'
    ] },
    lash: { s: [
      'the product held up beside one eye, the lashes in sharp macro just behind it',
      'a thin streak of light falls across the product and the eyes behind it, the rest in soft shadow'
    ], m: [
      'an extreme close-up of one eye, every lash sharp, the skin texture real',
      'the face lies upside down in the frame, eyes open and looking at the lens',
      'the wand held just at the lashes, the eye looking up past it',
      'a thin streak of light falls across the eyes, the rest of the face in soft shadow'
    ], studio: true },
    supplement: { s: [
      'hard sun through blinds lays stripes over the product and the table',
      'a hand pulls one sachet out of a canvas tote',
      'the product floats among rising bubbles in clear water',
      'the product rests in shallow water, rings of ripple spreading around it',
      'a few capsules spill out beside the product under dappled leaf shadow',
      'the product is packed into a gym bag beside a towel and a water bottle',
      'the product stands beside fresh fruit and a glass of water in clear morning light'
    ] },
    pet: { s: [
      'a dog\'s nose leans into the frame toward the product, curious',
      'a cat sits calmly beside the product on a low pedestal',
      'a small dog in sunglasses lies beside the product on a pink backdrop',
      'a minimal set, one small dog sitting still beside the product'
    ], m: [
      'the model and a dog face to face, noses almost touching',
      'a dog leaps mid-air toward a treat in the model\'s raised hand',
      'the model sits on the floor with a cat curled in the lap, both looking at the lens'
    ], studio: true, wear: true },
    family: { s: [
      'small hands reach in toward the product on a sunny table'
    ], m: [
      'a family dressed in one coordinated colour against a single-colour backdrop',
      'shot from directly above: the family lying in a circle on the floor, heads together, laughing',
      'a child hangs from a parent\'s arms, both laughing',
      'parent and child cooking together in a sunny kitchen',
      'mother and child sit on the floor, the child leaning in close'
    ], studio: true, wear: true },
    //  🎯 v11.27 生存遊戲:only = 這個品類的商品只在這些地方出現(一般生活場景、靜物手法都不抽)
    airsoft: { only: true, u: [
      'the product fitted in place on the airsoft replica it is made for, the replica resting across a weathered wooden crate at an outdoor airsoft field, camouflage netting and tyre barricades blurred behind',
      'a gloved hand flips the product open where it sits on the airsoft replica it is made for, at the edge of a sandbag bunker on an airsoft field, dust hanging in the air',
      'the product fitted on the airsoft replica it is made for, the replica laid on a camouflage cloth on a gear-shop workbench, a pegboard of tactical pouches behind',
      'the product fitted on the airsoft replica it is made for, the replica propped against a stack of tyres in a forest airsoft field, dappled light through pine trees',
    ], s: [
      'the product rests on a weathered wooden crate at an outdoor airsoft field, camouflage netting and stacked tyre barricades softly blurred behind',
      'the product lies on a field table among airsoft gear — clear protective goggles, tactical gloves and a patch-covered plate-carrier vest — in morning light',
      'a gloved hand flips the product open at the edge of a sandbag bunker on an airsoft field, dust hanging in the air',
      'the product sits on a dusty wooden plank beside a pair of muddy tactical boots and a coil of paracord, late-afternoon sun',
      'the product sits on an olive-green field storage box in a forest airsoft field, dappled light through pine trees',
      'the product rests on a camouflage cloth over a metal workbench in an airsoft gear shop, a pegboard of tactical pouches behind',
      'the product lies in fine dirt and dry leaves on the ground of a woodland airsoft field, low morning mist behind',
      'the product sits on a concrete ledge in an urban close-quarters airsoft arena, spray-painted plywood walls and team flags behind',
    ] },
    //  🔭 v11.29 瞄具類:場景同 airsoft,使用中多一句「怎麼裝才對」(只有瞄具類才送,護目鏡/背心不會吃到)
    airsoft_scope: null,
    outdoor: { s: [
      'the product sits on a rock in a high mountain meadow under open sky',
      'the product lies on a picnic blanket in long grass, the sun flaring at the edge'
    ], m: [
      'the model sits on a wooden fence in a high meadow, wind in the hair',
      'shot from low in the grass, the model against a deep blue sky',
      'the model lies in long grass among wildflowers, one arm over the eyes, sun on the face',
      'a garden sprinkler arcs water behind the model in a green lawn',
      'the model steps across sea rocks, a bright coastline behind',
      'the model reclines on a sweep of bright fabric spread over a field',
      'the model sits in a small rowing boat on a lake, mountains behind'
    ], studio: false, wear: true },
    yoga: { s: [
      'the product rests on a rolled mat in a sunlit studio, a long window shadow across the floor'
    ], m: [
      'the model holds a long stretch on a pilates reformer in a pale minimal studio',
      'hard sun throws the shadow of the pose onto a warm wall',
      'the model stretches over a large white exercise ball',
      'a balanced handstand on a pale blue curved set',
      'the model sits side-on on the mat, calm profile, a few small bottles before her',
      'the model leans on a white wall holding a water bottle, soft daylight',
      'a deep lunge in front of a dark teal wall, warm side light'
    ], studio: true, wear: true },
    hair: { s: [
      'the product held beside a glossy head of hair, the strands sharp in the light'
    ], m: [
      'a tight profile portrait, the shape of the cut sharp against a plain grey backdrop',
      'the hair flying from a fan while the face stays calm',
      'one hand runs through the hair, its gloss catching the light',
      'a hand holds the hair back to show the shape of the cut, soft white backdrop',
      'a bold red colour block behind, the hair crisp against it'
    ], studio: true }
  };
  // 模特兒髮型(RA:「目前還有髮型!」)—— 每次換一種,同一品牌的模特兒不會永遠同一顆頭
  var HAIRS = [
    'a sleek blunt bob with heavy bangs', 'a slicked-back wet-look style', 'a low sleek bun at the nape',
    'loose voluminous curls', 'a short tousled crop', 'long straight glossy hair tucked behind one ear',
    'a high ponytail with face-framing strands', 'a soft wavy shoulder-length cut', 'short tight curls',
    'a messy half-up bun', 'a sharp asymmetric short cut', 'long hair blown across the face by a fan'
  ];
  //  🔭 v11.29 瞄具類 = 生存遊戲場景 + 一句正確裝法
  CAT_ART.airsoft_scope = { only: true, u: CAT_ART.airsoft.u, s: CAT_ART.airsoft.s,
    fit: 'How it is fitted: a rifle-style scope sits on top of the replica, parallel to the barrel, clamped to the top rail by two scope rings with its adjustment turrets between them; the wide front lens faces the muzzle and the small eyepiece faces the player. The product is pressed onto the very end of the scope tube, its lid swinging open on a hinge at the rim of that end and standing upright beside the lens.' };
  //  v2.31 每個品牌、每個商品自己的拍法(RA 2026-11-20「超過 17 樣板就變白痴」→ 不再靠手寫品類)
  //   來源:/shoots/<品牌ID>.json(雲端每日工作去圖釘網查該商品的頂級拍法、整理成句子後寫進 GitHub)
  //   格式:{ brand:{ s:[...] }, products:{ "商品名":{ s:[...], refs:[...] } } };沒有檔或抓不到 → 照舊用通用品類
  var SHOOTS_CACHE = {};
  function _shootKey(x) { return String(x || '').replace(/\s+/g, '').toLowerCase(); }
  function _loadShoots(bid) {
    if (!bid || SHOOTS_CACHE[bid] !== undefined) return;
    SHOOTS_CACHE[bid] = null;
    try {
      fetch('/shoots/' + encodeURIComponent(bid) + '.json?v=' + Math.floor(Date.now() / 3600000))
        .then(function (r) { return r.ok ? r.json() : false; })
        .then(function (j) { SHOOTS_CACHE[bid] = j || false; })
        .catch(function () { SHOOTS_CACHE[bid] = false; });
    } catch (e) { SHOOTS_CACHE[bid] = false; }
  }
  setInterval(function () { try { _loadShoots(window.S && window.S.brandId); } catch (e) {} }, 1500);
  function _ownShoots(ctx) {
    var j = SHOOTS_CACHE[window.S && window.S.brandId];
    if (!j) return null;
    var ps = j.products || {}, k = _shootKey(ctx && ctx.product);
    for (var n in ps) if (k && _shootKey(n) === k && ps[n] && ps[n].s && ps[n].s.length) return ps[n];
    return (j.brand && j.brand.s && j.brand.s.length) ? j.brand : null;
  }
  window.AdLeanShoots = { cache: SHOOTS_CACHE, own: _ownShoots };
  //  v2.32 通用拍法庫(RA 2026-11-20「第 999 樣商品怎麼辦」):拍法跟商品脫鉤 —— 全部拍法合成一個庫,
  //   交給美術指導看懂商品後自己挑最適合的(不再靠商品名對到哪一類)
  window.AdLeanLib = function (n) {
    var all = [];
    try { for (var k in CAT_ART) { var a = CAT_ART[k]; if (a && a.s && !a.only) all = all.concat(a.s); } } catch (e) {}
    try { if (typeof REF_STILLS !== 'undefined') all = all.concat(REF_STILLS); } catch (e) {}
    var out = [], seen = {};
    for (var i = 0; i < 400 && out.length < (n || 8) && all.length; i++) { var x = all[Math.floor(Math.random() * all.length)]; if (!seen[x]) { seen[x] = 1; out.push(x); } }
    return out;
  };
  function _cat(ctx) {
    //  v2.30:先看商品本身(商品名、規格、特色),都對不到才看品牌名 —— 品牌叫「餐酒館」不代表每樣商品都是酒
    var tp = [ctx.product, ctx.spec, ctx.feature].join(' '), tb = [ctx.brand, ctx.subBrand].join(' ');
    for (var i = 0; i < CAT_RULES.length; i++) if (CAT_RULES[i][1].test(tp)) return CAT_RULES[i][0];
    for (var j = 0; j < CAT_RULES.length; j++) if (CAT_RULES[j][1].test(tb)) return CAT_RULES[j][0];
    return '';
  }

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
    return pick(k ? CAMS.rich.concat(CAMS.clean) : CAMS.rich.concat(CAMS.clean, CAMS.film, CAMS.jp));
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
  function flavorSet(f, raw) {
    //  v2.17 有拍攝通告單的風格 → 直接給「在哪拍/光從哪來/影子落在哪」(raw = 只要原本的顏色質感描述)
    if (!raw && typeof SELECTED_FLAVOR !== 'undefined') { var sh = shootFor(SELECTED_FLAVOR); if (sh) return sh; }
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
    //  v2.12 品牌包只給「品牌色 + 字型」。場景/氛圍/光質留空 → 畫面由風格、情境、輪播決定
    //  (舊行為保險絲:Console window.AD_PACK_SCENE=true)
    if (window.AD_PACK_SCENE !== true) { pb.scene = ''; pb.mood = ''; pb.photo = ''; }
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
    var _noCJK = function (t) { return String(t || '').replace(/[\u2e80-\u9fff\uf900-\ufaff\uff00-\uffef\u3000-\u303f]+/g, ' ').replace(/\s{2,}/g, ' ').replace(/^[\s,;:\-]+|[\s,;:\-]+$/g, ''); };   // v2.34 中文不進提示詞(照片自己會說商品長怎樣,中文只會被畫成字)
    var name = _noCJK(ctx.product).replace(/\b[A-Za-z]{1,5}[-\s]?\d{2,6}[A-Za-z]{0,3}\b/g, '').replace(/\s{2,}/g, ' ').trim();
    var spec = essence(_noCJK(strip(ctx.spec)), 160), feat = essence(_noCJK(strip(ctx.feature)), 160);
    if (name.length < 3 || !/[a-z]{3}/i.test(name)) name = '';   // v2.34 只剩型號碎片或數字 → 不寫
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
      //  v2.11 客人選了情境(節日)→ 配色讓給情境(RA 2026-10-24 測試:首爾工作室的「米灰色」蓋掉了聖誕的紅),風格只留地點、光與質感
      var palRe = ctxTheme.context ? /palette|colou?r|\btones?\b|\bhues?\b|beige|grey|gray|pastel|monochrom/i : null;
      var keep = body.split(/\s*,\s*/).filter(function (x) { return !/overlay|serif|sans-serif|font|typograph|mincho|letter|illustrat|graphic|poster|layout/i.test(x) && !(palRe && palRe.test(x)); }).join(', ');
      return head ? head + (keep ? ': ' + keep : '') : keep;
    }
    function _world(fs, fallback, people) {
      var L = LAYOUT_SHOT[ly] || LAYOUT_SHOT[''];
      var scene = people ? '' : pb.scene;
      //  v2.17 拍攝通告單:版型沒指定地點 → 整個世界就是那個實拍場地;版型有地點(白棚等)→ 只疊風格原本的顏色質感
      if (SHOOT_NOW && fs === SHOOT_NOW) {
        if (!L.place) return 'in ' + SHOOT_NOW.replace(/the subject's/g, people ? 'their' : 'its').replace(/the subject/g, people ? 'the model' : 'the product');
        fs = flavorSet(REGIONAL_FLAVORS[SELECTED_FLAVOR] || {}, true);
      }
      fs = _photoOnly(fs);
      if (L.place) return L.place + (fs ? (ctxTheme.context ? ', in the texture of ' : ', in the colour and texture of ') + essence(fs, 160) : '');
      if (fs) return 'in the world of ' + essence(fs, 200) + (styleHasPlace(fs) ? '' : ', on location ' + (scene ? 'in ' + cut(oneOf(scene), 90) : 'in ' + pick(WORLDS)));
      if (scene) return 'in ' + cut(oneOf(scene), 140);
      return 'in ' + (fallback || pick(WORLDS));
    }
    //  動作要跟地點合得來:棚內/素面牆不放「下路緣、坐台階、坐矮牆」這類戶外動作
    //  版型跟機位要合得來:極簡海報要留白 → 不用大特寫;雜誌封面要近而有自信 → 不用全身大遠景
    function _angle(pool) {
      var bad = ly === 'minimal_poster' ? /close|tight/ : ly === 'magazine_cover' ? /full body|wide/ : null;
      return pick(bad ? pool.filter(function (x) { return !bad.test(x); }) : pool);
    }
    function _pose() { var L = LAYOUT_SHOT[ly] || LAYOUT_SHOT['']; var pool = L.place ? POSES.filter(function (x) { return !/kerb|ledge|steps/.test(x); }) : POSES; return pick(pool); }
    function _brandColour() { return (lockColor && pb.colour && !ctxTheme.context) ? 'Brand colour, carried by a few props or one surface in the set: ' + essence(pb.colour, 90) + '.' : ''; }
    function _light(fs) { if (SHOOT_NOW && fs === SHOOT_NOW && (LAYOUT_SHOT[ly] || {}).place) return pick(MOMENTS); return styleHasLight(fs) ? '' : pick(MOMENTS); }
    if (isProdReshoot) {
      var fsP = flavorSet(flavor);
      var bfP = _brandColour();
      var LP = LAYOUT_SHOT[ly] || LAYOUT_SHOT[''];
      // v2.6 認可的商品句一字不動(RA:「我要這個版本」);數量交給第二步「商品校正」
      var _protP = 'The product is the real one in this photo' + (name ? ' (' + name + ')' : '') + ': it keeps its exact shape, panels, colours, materials and logos; small labels and lettering stay exactly as photographed, and where a label is too small to read it stays plain.';   // v2.33 保護句先存起來,排在畫面主意後面
      var lP = _light(fsP);
      var PP = window.ProductPlace, _big = !!(PP && PP.isFloorish());   // v2.13 落地/大型/鋪地
      var placeP = _big ? 'the product is ' + PP.setting() + (fsP ? (ctxTheme.context ? ', in the texture of ' : ', in the world of ') + essence(_photoOnly(fsP), 160) : '') + (lP ? '; ' + lP : '')
        : (fsP || pb.scene || LP.place || Math.random() < 0.75)
        ? (SHOOT_NOW && fsP === SHOOT_NOW && !LP.place ? 'the product stands in a real setting: ' + SHOOT_NOW.replace(/the subject's/g, 'its').replace(/the subject/g, 'the product') : 'the product stands on ' + pick(SURFACES) + ' ' + _world(fsP, '') + (lP ? '; ' + lP : ''))
        : 'the product stands on a real surface in front of ' + conceptFor(pb.colour).replace(/\{S\}/g, 'the product').replace(/\{P\}/g, 'its');
      //  v2.10 品類手法(一半機率):版型沒指定地點 → 品類手法就是整個場景(風格只給色與質感);白棚/極簡海報 → 疊在棚景上
      var _own = _ownShoots(ctx);   // v2.31 品牌/商品自己的拍法優先(85%),沒有才用通用品類
      //  v2.34 整盤推演抓到:地點句 + 品類拍法 + 參考靜物三句疊在一起 → 一張圖裡兩個桌面、兩道光、兩個機位(鍋子被「貼在肩膀上」)
      //   原則:一張照片只有一個畫面主意。版型自己決定地點(白棚、極簡海報的單色牆)→ 不再疊品類拍法;
      //   其他版型 → 品類拍法就是整個畫面主意(它自帶桌面、光、機位),跟版型動作衝突的拍法(手持版不抽俯拍 / 別的手)先濾掉
      var _clash = { hand_hold: /overhead|directly above|\bhands?\b|floats|mid-air|hangs/i, magazine_cover: /overhead|directly above/i }[ly] || null;
      var _lyFrom = window._leanFrom || ly;   // 客人選的原版型(美食版 / 飛濺借別的版型拍)
      window._leanCatNow = _cat(ctx);
      if (_lyFrom === 'dramatic_splash') _clash = /^(?![\s\S]*(pour|splash|spill|mid-air|falling|floats|steam|smoke|breeze|toss|drifting|lifts|rising))/i;   // 飛濺版:只抽有動態的拍法,沒有就交給版型句
      var catP = _own ? { s: _own.s } : CAT_ART[window._leanCatNow];
      var _pool = catP && catP.s && !LP.place ? catP.s.filter(function (x) { return !_clash || !_clash.test(x); }) : [];
      var catS = _pool.length ? pick(_pool) : '', rP = 0;
      if (_big) { /* 靜物手法(桌面、疊塔、手伸進來)都是給小東西的,大件不用 */ }
      var _useP = false;
      if (_big) { /* 已處理 */ }
      else if (catP && catP.only && catS) { _useP = !!(catP.u && Math.random() < 0.7); placeP = (_useP ? pick(catP.u) : catS) + (fsP ? ', in the colour and texture of ' + essence(_photoOnly(fsP), 160) : ''); }   // v11.28 70% 使用中   // 🎯 v11.27 只屬於這個品類的場景(生存遊戲)
      else if (catS) placeP = catS + (fsP ? (ctxTheme.context ? ', in the texture of ' : ', in the colour and texture of ') + essence(_photoOnly(fsP), 160) : '');  // 品類手法自帶地點和光 = 整個畫面主意(v2.34 不再疊第二個地點 / 參考靜物)
      var _sc = PP ? [PP.scaleLine(), PP.noteLine()].filter(Boolean).join(' ') : '';
      //  📐 v11.28 大件:鏡頭站在商品照當初的位置,房間照這個視角蓋(不抽隨機機位 → 治「貼上去」的透視錯位)
      var angP = _useP ? 'framed close on the product where it is fitted, the product filling most of the frame, only the nearby part of the replica showing' : _angle(ANGLES_P);   // 🔭 v11.30 使用中一律特寫
      //  v2.33 順序就是權重(刺蝟星球):① 畫面主意 ② 主體(保護句+尺寸) ③ 構圖機位 ④ 情境品牌 ⑤ 物理 ⑥ 相機 ⑦ 字
      p.push('A new product campaign photograph: ' + placeP + '.');
      p.push(_protP);
      if (_sc) p.push(_sc);
      p.push(LP.frame ? cap(LP.frame.replace(/the subject/g, 'the product')) + '; ' + angP + '.' : cap(angP) + '.');
      if (_useP && catP.fit) p.push(catP.fit);   // 🔭 v11.29 使用中 → 補一句正確裝法
      p.push(VIEW_P + (_big ? ' Every foot or wheel touches the floor with its own small contact shadow.' : ''));   // 📐 v11.28 一個透視;「一種光」那句併進 LIGHT_LAW(v2.33 不重複)
      if (ctxTheme.context) p.push(_occasion(ctxTheme.context, false));
      if (bfP) p.push(bfP);
      if (note) p.push('Client note: ' + essence(note, 180));
      p.push(LIGHT_LAW('the product', 'it') + ' Things that touch rest on each other under gravity and darken where they meet.');   // 💡 v2.20
      p.push('Shot on ' + camFor(SELECTED_FLAVOR, ly, '') + '. Real material texture; ' + sz.w + 'x' + sz.h + ', edge to edge.');
      // v2.8:整張照片的字 = 商品本身印的字 + 客人給的標題,周圍道具是素面(治 AI 自編價格牌)
      p.push(_letteringLine(headline, sub, pb, 'one compact block ' + LP.words.replace(/the subject/g, 'the product'), 'the product'));
      return p.join('\n');
    }
    if (isReshoot) {
      var fsR = flavorSet(flavor);
      var bfR = _brandColour();
      var LR = LAYOUT_SHOT[ly] || LAYOUT_SHOT[''];
      var _protR = ('The product is the garment in this photo: same cut, fabric, colour, zips, drawstrings and every logo or embroidery exactly as it is. Each print and embroidery stays on the panel where it sits in the photo, so the camera sees it only when that panel faces the lens; a side of the garment the photo does not show, such as the back when only the front is photographed, is plain fabric with no print, logo or embroidery.');   // 🧥 v2.21 RA 11/05:背影沒秀字就不能自己加(照客人給的照片為主)
      //  沒選風格、品牌包也沒寫場景、版型也沒指定地點 → 用舊的 6 張完整場景當備案(RA 認可過的等級)
      var catR = CAT_ART[_cat(ctx)], catM = catR && catR.m && catR.wear && (catR.studio || !LR.place) ? catR.m : null;  // 只用看得到整件衣服的品類(睫毛大特寫、髮型側臉看不到衣服)
      var rR = Math.random();
      if (!fsR && catM && rR < 0.34) {
        p.push('A new campaign photograph of a young model wearing this garment: ' + pick(catM) + (fsR ? (ctxTheme.context ? ', in the texture of ' : ', in the colour and texture of ') + essence(_photoOnly(fsR), 160) : '') + '.' + (LR.frame ? ' ' + cap(LR.frame.replace(/the subject/g, 'the model')) + '.' : ''));
      } else if (!fsR && !LR.place && !LR.frame) {
        p.push('A new fashion campaign photograph of a young model wearing this garment: ' + (Math.random() < 0.5 ? pick(RESHOOTS) : 'in ' + pick(WORLDS) + ', ' + pick(POSES) + '; ' + pick(ANGLES_M) + '; ' + pick(MOMENTS)) + '.');
      } else {
        var refPool = LR.place ? REF_SHOTS.filter(function (x) { return x.studio; }) : REF_SHOTS;
        if (!fsR && refPool.length && rR < 0.67) {
          //  參考大片手法:一整句拍攝企劃(姿勢+佈景+光),風格只給色與質感
          p.push('A new fashion campaign photograph of a young model wearing this garment: ' + pick(refPool).t + (fsR ? (ctxTheme.context ? ', in the texture of ' : ', in the colour and texture of ') + essence(_photoOnly(fsR), 160) : '') + '.' + (LR.frame ? ' ' + cap(LR.frame.replace(/the subject/g, 'the model')) + '.' : ''));
        } else {
          var wR = _world(fsR, pick(WORLDS), true), lR = _light(fsR);
          p.push('A new fashion campaign photograph of a young model wearing this garment, ' + wR + (lR ? '; ' + lR : '') + '. The model is ' + _pose() + '. ' + (LR.frame ? cap(LR.frame.replace(/the subject/g, 'the model')) + '; ' : '') + cap(_angle(ANGLES_M)) + '.');
        }
      }
      p.push(_protR);   // v2.34 保護句排在畫面主意後面(順序 = 權重)
      if (Math.random() < 0.6) p.push('Hair: ' + pick(HAIRS) + '.');
      p.push('Everything else the model wears is plain, unbranded everyday basics, so the garment is the only branded piece in the picture.');
      if (ctxTheme.context) p.push(_occasion(ctxTheme.context, true));
      if (bfR) p.push(bfR);
      if (note) p.push('Client note: ' + essence(note, 180));
      p.push(LIGHT_LAW('the model', 'them'));   // 💡 v2.20
      p.push('Shot on ' + (fsR ? camFor(SELECTED_FLAVOR, ly, '') : pick(CAMS.film.concat(CAMS.clean))) + '. Real skin texture, real fabric folds; ' + sz.w + 'x' + sz.h + ', edge to edge.');
      p.push(_letteringLine(headline, sub, pb, 'one compact block ' + LR.words.replace(/the subject/g, 'the model'), 'the garment'));
      return p.join('\n');
    }
    var P = isApparel ? 'their' : 'its';
    var concept;
    if (ly === 'white_studio') concept = pickFresh(STUDIO, 'studio');   // v2.16 5 種棚景輪流
    else if (ly === 'minimal_poster') concept = 'a plain backdrop painted in ' + (pb.colour ? essence(pb.colour, 50) : 'one calm colour') + '; ' + pickFresh(POSTER_LIGHT, 'poster');
    else concept = conceptFor(pb.colour);
    //  v2.16 調味料疊加(RA 2026-11-04:版型、風格、情境像調味料一樣疊上去,不是誰蓋掉誰)
    //   版型 = 底(哪一種棚/牆 + 硬光影子)→ 風格 = 這個棚的顏色與質感 → 情境 = 場合(下面 _occasion)
    //   都沒選 → 牆色帶一點衣服/商品本身的色調(刺蝟星球 2974:場景跟服裝配色),整張像同一個企劃拍的
    //   光已經由底決定(硬光+影子),風格裡寫光的片段(soft daylight 之類)拿掉,不讓兩道光打架
    var fsK = flavorSet(flavor), fsKw = '';
    if (SHOOT_NOW && ly !== 'white_studio' && ly !== 'minimal_poster') {
      //  v2.17 這個風格有拍攝通告單 → 整個背景就是那個實拍場地(已經寫好光和影子)
      concept = SHOOT_NOW.replace(/the subject's/g, '{P}').replace(/the subject/g, '{S}');
    } else if (fsK) {
      var fsRaw = SHOOT_NOW ? flavorSet(flavor, true) : fsK;   // 白棚/極簡海報:只疊風格的顏色質感
      fsKw = fsRaw ? _photoOnly(fsRaw).split(/\s*,\s*/).filter(function (x) { return !styleHasLight(x); }).join(', ') : '';
    }
    if (fsKw) concept += ', the set carrying the colour and texture of ' + essence(fsKw, 140);
    else if (!fsK && ly !== 'white_studio' && /wall|backdrop/.test(concept) && !ctxTheme.context && !(lockColor && pb.colour)) concept += '; the wall colour picks up a quiet tone from ' + (isApparel ? 'the clothes' : 'the product') + ' so the whole frame feels like one shoot';
    concept = concept.replace(/\{S\}/g, S).replace(/\{P\}/g, P);
    p.push('A real ' + (isApparel ? 'fashion campaign' : 'product campaign') + ' photograph: ' + concept + '.');

    // ② 主體
    p.push(isApparel
      ? 'The people are the real models from this photo: same faces, expressions, pose, hair movement and clothes, now standing in this light.'
      : 'The product is the real one from this photo' + (name ? ' (' + name + ')' : '') + ': same form, colours, materials and markings' + ((spec || feat) ? ' — ' + essence([spec, feat].filter(Boolean).join('; '), 120) : '') + ', now standing in this light.'
        + (window.ProductPlace && window.ProductPlace.scaleLine() ? ' ' + window.ProductPlace.scaleLine() : ''));

    // ③ 構圖
    p.push((LAYOUT_ESSENCE[ly] || LAYOUT_ESSENCE['']).replace(/^./, function (c) { return c.toUpperCase(); }) + '; ' + S + (isApparel ? ' fill' : ' fills') + ' most of the frame' + (isApparel ? ', cropped where the source photo is cropped' : '') + '; ' + sz.w + 'x' + sz.h + ', edge to edge.');

    // ④ 風格 + 品牌
    var fs = fsK;   // v2.16 風格已經疊進背景那句,這裡不再重複一次
    var brandFeel = (lockColor && pb.colour && !ctxTheme.context) ? essence(pb.colour, 90) : '';
    if (brandFeel) p.push('Brand colour: ' + brandFeel + '.');
    if (ctxTheme.context) p.push(_occasion(ctxTheme.context, isApparel));
    if (note) p.push('Client note: ' + essence(note, 180));

    // ⑤ 物理法則 —— 💡 v2.20 跟重拍、商品共用同一段「光的鐵律」
    p.push(LIGHT_FOLLOW(S, isApparel ? 'them' : 'it') + ' ' +   // 💡 v2.22 保留原圖 → 場景跟著原圖的光
      (isApparel ? '' : 'Things that touch rest on each other under gravity and darken where they meet. ') +
      'Everything at its true scale.');

    // ⑥ 相機
    p.push('Shot on ' + camFor(SELECTED_FLAVOR, ly, '') + ', from where the camera stood in the source photo.');

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

  //  v2.18 其他照片類版型 → 借哪一種重拍拍法 + 補一句這個版型要的畫面
  var LEAN_LAYOUT_MAP = {
    food_special:    { to: 'scene_lifestyle', say: 'Food layout: shot close and appetising, the dish the clear hero, real texture you could almost taste.' },
    spec_breakdown:  { to: 'minimal_poster',  say: 'Spec layout: the subject shown whole and clear, with calm open space beside it where short feature notes can sit.' },
    dramatic_splash: { to: 'magazine_cover',  say: 'Energy layout: real motion around the subject caught by a fast shutter (a splash, a toss of fabric, a gust of wind), everything else still sharp and real.' },
    big_statement:   { to: 'minimal_poster',  say: 'Statement layout: one big headline leads the poster; the photograph leaves a wide calm area for it.' },
  };
  // ═══════════════════════════════════════════════════════════════════
  //  💅 v2.22 美業重拍(RA 2026-11-05「我全都要重拍」)
  //   美業賣的是客人身上的手藝(眉毛每一筆、睫毛每一根、指甲花樣、髮型髮色)→ 成果與人照原圖,
  //   換的是「在哪裡拍、怎麼取景、什麼色調」;光一律跟著原圖臉上的光(LIGHT_FOLLOW)。
  //   實測 HH:鏡頭拉遠 → AI 自己補畫整張臉、眉形跑掉 → 取景只能跟原圖一樣近或更近。
  //   照片類版型走這裡;前後對比 / 主圖側格 / 問句標題 / 預約資訊(排版圖、文字圖)照舊。
  // ═══════════════════════════════════════════════════════════════════
  //   RA 2026-11-05 第二輪:「美業客人很多長得不好看所以戴口罩拍,但都嚮往美美自拍的感覺」→ 第三張(拉遠、人更美)才真;
  //   照知名美睫/眉的宣傳拍法:自然窗光、臉微側不正對(避免大頭照感)、往上看/側面看捲翹/閉眼看睫毛扇形、輕修但保留膚質。
  //   → 手藝的「樣式」鎖死(眉形眉峰粗細顏色筆觸、睫毛長度捲度密度),人照同一位、同性別、拍到最好看的樣子;口罩照戴。
  var BEAUTY_FRAMES = {
    '':              'a close beauty portrait from the brow to the chin, the finished work large and sharp',
    result_closeup:  'a close beauty portrait from the brow to the chin, the finished work large and sharp',
    macro_detail:    'a tight close-up of one side of the face, the finished work filling most of the frame, every strand and stroke readable',
    skin_detail:     'a tight close-up, the finished work and the skin around it in fine real detail',
    model_editorial: 'a head-and-shoulders beauty editorial portrait, the finished work the first thing the eye lands on',
    in_session:      'a close portrait of the client resting back in the treatment chair just after the session, the studio soft behind',
    mirror_selfie:   'a mirror selfie: the client holds a phone up to a round mirror, the finished work sharp in the reflection',
    bt_hand_result:  'a close shot of the hands only, the finished work sharp and the first thing the eye lands on, the face out of frame',
    bt_profile:      'a close side profile from the brow to the chin, so the curve of the brow and the curl and length of the lashes read clearly against the soft background',
  };
  //  v2.27 手部成果(韓系美甲 IG 拍法):手拿咖啡杯 / 搭在針織袖口 / 放在亞麻布上 / 翻書
  var BEAUTY_HAND_POSES = [
    'the hands wrapped around a ceramic coffee cup', 'one hand resting on the cuff of a soft knit sleeve', 'the hands resting lightly on a linen cloth beside a small vase',
    'the fingers turning the page of a book', 'one hand holding a single flower stem',
  ];
  var BEAUTY_POSES = [
    'the face turned a little to one side, eyes lifted slightly toward the light',
    'a three-quarter turn, gazing softly out of frame toward the window',
    'in near profile, so the curve of the brow and the curl of the lashes read against the background',
    'eyes gently closed, chin slightly lowered, the lashes fanned out and the brows framing them',
    'looking up past the lens, chin a touch down, one hand resting lightly near the cheek',
    'a loose strand of hair across the cheek, eyes looking straight into the lens with a calm expression',
  ];
  var BEAUTY_PLACES = [
    'a calm beauty studio with pale plaster walls and a linen curtain, soft daylight from a large window',
    'a quiet treatment room with warm wood shelves and a small vase, soft daylight through sheer curtains',
    'a minimal studio corner with a soft-grey wall and a few dried stems, gentle window light from one side',
    'a bright salon with white tiles and a round mirror, soft daylight from a frosted window',
    'a cosy studio with sage-green walls and a rattan chair, soft afternoon window light',
    'a clean modern salon with stone countertops, diffused daylight through frosted glass',
    'a small boutique studio with cream walls and a pleated paper lamp, soft light from a window beside the client',
    'a soft-pink studio with a velvet stool and an arched mirror, calm daylight from one side',
  ];
  function beautyLean(ly) {
    var f = REGIONAL_FLAVORS[SELECTED_FLAVOR] || {};
    var ctxTheme = CONTEXT_THEMES[SELECTED_CONTEXT] || {};
    var headline = val('gptHeadline'), sub = val('gptSubHeadline'), note = val('gptStyleDesc');
    var sz = (typeof _adSize === 'function') ? _adSize() : { w: 1080, h: 1080 };
    var pb = packBits();
    //  風格只拿顏色與質感(美業的光一律是柔和自然窗光)
    var look = f.flavor ? String(f.flavor).replace(/^[^:]{2,60}:\s*/, '').split(/\s*,\s*/).filter(function (x) {
      return !/sun|light|lamp|neon|glow|shadow|window|candle|flash|overlay|font|typograph|illustrat|graphic|poster|layout/i.test(x); }).join(', ') : '';
    var p = [];
    p.push('The subject is the client in this photo and the finished beauty work on them — whatever was done here (brows, lashes, nails, hair): the same shape, arch, thickness, length, curl, colour, finish and stroke style as in the photo; this craft is the selling point. ' +
      'The same person and gender, shown at their most beautiful; a face mask stays on only if the photo shows one, and nothing new is added over the face.');
    p.push('A new beauty campaign photograph of them in ' + pickFresh(BEAUTY_PLACES, 'beauty') + (look ? ', in the colours and textures of ' + essence(look, 140) : '') + '. ' +
      (ly === 'bt_hand_result' ? 'Shown with ' + pickFresh(BEAUTY_HAND_POSES, 'beautyhand') + '. ' : ly === 'bt_profile' ? '' : 'The client is ' + pickFresh(BEAUTY_POSES, 'beautypose') + '. ') + cap(BEAUTY_FRAMES[ly] || BEAUTY_FRAMES['']) + '.');
    if (ctxTheme.context) p.push(_occasion(ctxTheme.context, true));
    var bf = (pb.colour && (document.getElementById('lockBrandColor') || {}).checked !== false && !ctxTheme.context) ? essence(pb.colour, 90) : '';
    if (bf) p.push('Brand colour: ' + bf + '.');
    if (note) p.push('Client note: ' + essence(note, 180));
    p.push(LIGHT_LAW('the client', 'them') + ' The daylight is soft and diffused, with no hard sun patches on the walls.');
    p.push('Shot on ' + camFor(SELECTED_FLAVOR, 'beauty', '') + '. Skin lightly retouched like a beauty editorial — even and glowing, with fine real pores and texture still there; ' + sz.w + 'x' + sz.h + ', edge to edge.');
    var t;
    if (headline || sub) t = 'All the lettering in the whole photograph is these words, in the brand\'s own type style' + (pb.type ? ' (' + essence(pb.type, 80) + ')' : '') + ', set small in a calm open corner: ' +
      (headline ? '"' + headline + '"' : '') + (headline && sub ? ', and a small line beneath, ' : '') + (sub ? '"' + sub + '"' : '') + '; everything else is wordless.';
    else t = 'There is no lettering anywhere in the photograph.';
    p.push(t);
    return p.join('\n');
  }
  // ═══════════════════════════════════════════════════════════════════
  //  🧘 v2.23 課程與體驗重拍(RA 2026-11-05:洳意禪舞 = 心靈課程、瑜珈、頌缽、冥想;「去看 IG 大品牌怎麼做」)
  //   課程賣的是「上課的感覺」→ 像品牌攝影師到現場重拍一組:同一種練習、同一類場地、同樣的衣著色系與器材,
  //   人可以是新的;光一律同一道光(LIGHT_LAW)。
  //   大品牌拍法(身心靈/瑜珈/頌缽工作室):柔和自然光、亞麻與木頭、留白多;
  //   一組裡一定有「手部特寫(頌缽、手印)」「閉眼靜坐」「俯拍圍圈」「戶外流動」「空間本身」。
  // ═══════════════════════════════════════════════════════════════════
  var COURSE_SHOTS = {
    '':               ['the teacher guiding the group, everyone settled in the practice, seen from a low seated height', 'a close moment of the practice: hands resting in the lap or on an instrument, faces calm, shallow depth of field'],
    in_class:         ['the teacher guiding the group, everyone settled in the practice, seen from a low seated height', 'from the back of the room over the participants\' shoulders toward the teacher, the room calm and full', 'a top-down view of the participants arranged in a circle on their mats'],
    instructor_intro: ['a calm portrait of the teacher seated with the tools of the practice, looking softly just past the lens', 'the teacher mid-practice, eyes closed, hands at work, framed from the waist up'],
    group_photo:      ['the group sitting together after the session, relaxed, a few quiet smiles, natural and unposed', 'the group in a loose circle, the moment just after practice, people turning to each other'],
    student_practice: ['one participant deep in the practice, eyes closed, framed close from the chest up', 'a close detail of one participant\'s hands in the practice, the rest of the room soft behind'],
    outdoor_class:    ['the group practising outdoors among trees on a wooden deck, the movement caught mid-flow, loose clothing in motion', 'one participant outdoors, arms open toward the sky, seen from slightly below with leaves around the frame'],
    studio_space:     ['the space itself before the session: mats laid out, cushions and the tools of the practice ready, nobody yet in the room', 'a quiet corner of the space, the tools of the practice arranged with care, a steaming cup nearby'],
  };
  var COURSE_LIGHT = ['soft morning daylight through tall windows', 'calm late-afternoon light through sheer curtains', 'bright, even daylight from an overcast sky', 'the warm low glow of early evening with a few lamps lit'];
  var COURSE_LIGHT_OUT = ['soft morning sun filtered through the trees', 'bright, even daylight from an overcast sky', 'late-afternoon sun low through the leaves'];
  function courseLean(ly) {
    var f = REGIONAL_FLAVORS[SELECTED_FLAVOR] || {};
    var ctxTheme = CONTEXT_THEMES[SELECTED_CONTEXT] || {};
    var headline = val('gptHeadline'), sub = val('gptSubHeadline'), note = val('gptStyleDesc');
    var sz = (typeof _adSize === 'function') ? _adSize() : { w: 1080, h: 1080 };
    var pb = packBits();
    var look = f.flavor ? String(f.flavor).replace(/^[^:]{2,60}:\s*/, '').split(/\s*,\s*/).filter(function (x) {
      return !/sun|light|lamp|neon|glow|shadow|window|candle|flash|overlay|font|typograph|illustrat|graphic|poster|layout/i.test(x); }).join(', ') : '';
    var shots = COURSE_SHOTS[ly] || COURSE_SHOTS[''];
    var p = [];
    p.push('This photo shows the class this business teaches. A brand photographer re-shoots it: the same practice as in the photo (whatever it is — meditation, yoga, sound bowls, dance, movement or a lesson), the same kind of place, the same clothing colours and the same tools of the practice; the people may be new faces of the same kind of group.');
    p.push('A new campaign photograph in ' + (ly === 'outdoor_class' ? 'a calm outdoor setting like the one in the photo' : 'the same kind of place as in the photo, calm and uncluttered, with natural materials and plenty of open space') + (look ? ', in the colours and textures of ' + essence(look, 140) : '') +
      '; ' + (ly === 'outdoor_class' ? pickFresh(COURSE_LIGHT_OUT, 'courselight_o') : pickFresh(COURSE_LIGHT, 'courselight')) + '. ' + cap(pickFresh(shots, 'courseshot_' + (ly || 'd'))) + '.');
    if (ctxTheme.context) p.push(_occasion(ctxTheme.context, true));
    var bf = (pb.colour && (document.getElementById('lockBrandColor') || {}).checked !== false && !ctxTheme.context) ? essence(pb.colour, 90) : '';
    if (bf) p.push('Brand colour: ' + bf + '.');
    if (note) p.push('Client note: ' + essence(note, 180));
    p.push(ly === 'studio_space' ? LIGHT_LAW('everything in the room', 'it') : LIGHT_LAW('everyone in the frame', 'them'));
    p.push('Shot on ' + camFor(SELECTED_FLAVOR, ly, '') + '. Real skin, real fabric folds, natural unposed bodies; ' + sz.w + 'x' + sz.h + ', edge to edge.');
    var t;
    if (headline || sub) t = 'All the lettering in the whole photograph is these words, in the brand\'s own type style' + (pb.type ? ' (' + essence(pb.type, 80) + ')' : '') + ', set in a calm open area: ' +
      (headline ? '"' + headline + '"' : '') + (headline && sub ? ', and a small line beneath, ' : '') + (sub ? '"' + sub + '"' : '') + '; everything else is wordless.';
    else t = 'There is no lettering anywhere in the photograph.';
    p.push(t);
    return p.join('\n');
  }
  // ═══════════════════════════════════════════════════════════════════
  //  ⚖️ v2.24 專業形象重拍(律師 / 醫師 / 顧問 / 事務所;RA 2026-11-05 大東)
  //   專業服務賣的是「這個人、這間事務所可信」→ 人臉與真實空間不能換:
  //    人像 / 團隊 → 同一個人(臉、髮型、眼鏡、膚色)重新拍一張形象照,姿勢、角度、場景可以換;
  //    空間 → 同一間事務所(格局、牆、家具、招牌與 LOGO)由建築攝影師重拍:垂直線拉正、整齊、光好看。
  //   一律同一道光(LIGHT_LAW)。名片資訊型 / 專業觀點型是排版文字圖,照舊。
  // ═══════════════════════════════════════════════════════════════════
  //   v2.25 照國際/日本大型事務所的形象照手法(RA 2026-11-05「去看國際事務所、日本知名事務所怎麼做」):
  //    ① 環境人像為主:真的辦公室、書牆、大片窗景、一幅抽象畫,場景襯人不搶人 ② 姿勢放鬆但穩:坐桌邊、手插口袋、走廊行走、自然微笑不僵笑
  //    ③ 平視拍(權威+親近)④ 自然窗光為主、補光很柔 ⑤ 整組一致的精品感:深色西裝、白/淺藍襯衫、乾淨線條
  //    ⑥ 日系大所:高樓玻璃窗外的城市、明亮留白的白灰空間;歐美精品所:深色木書牆、檯燈、律政劇感 —— 兩種都放,輪流
  var PRO_PLACES = [
    'a high-floor office with floor-to-ceiling glass and the city skyline softly behind', 'a bright, minimal white-and-grey meeting room with a long pale-wood table and one abstract artwork',
    'a quiet office with a wall of dark wood bookshelves and a leather chair', 'a calm glass-walled corridor with white walls and a long view down the office',
    'a library corner with deep green walls, brass lamps and rows of bound volumes', 'a modern meeting room with a long walnut table and floor-to-ceiling glass',
  ];
  var PRO_LIGHT = ['soft daylight from tall windows at one side, gently filled from the room', 'calm late-afternoon light through blinds', 'the warm glow of desk lamps in an evening office, the room around falling into shade', 'bright, even daylight from an overcast sky through large windows'];
  var PRO_SHOTS = {
    pr_portrait: ['a waist-up environmental portrait at eye level, the body turned slightly and the face to the lens, a calm assured look', 'perched on the edge of the desk, relaxed but composed, a natural small smile', 'standing by the window, one hand in a pocket, looking just past the lens', 'walking toward the lens down the corridor, caught mid-step, a natural expression', 'a close head-and-shoulders portrait at eye level, the office soft behind'],
    pr_team:     ['the team standing together in a loose, natural arrangement at eye level, every face visible', 'the team around the meeting table mid-conversation, the lead partner looking to the lens', 'the team walking together down the corridor, caught naturally mid-step'],
  };
  var PRO_OFFICE = ['a straight-on wide view with verticals kept perfectly straight', 'a two-point view from a corner of the room, verticals straight', 'a view from the entrance toward the reception, the sign clearly readable'];
  function proLean(ly) {
    var f = REGIONAL_FLAVORS[SELECTED_FLAVOR] || {};
    var ctxTheme = CONTEXT_THEMES[SELECTED_CONTEXT] || {};
    var headline = val('gptHeadline'), sub = val('gptSubHeadline'), note = val('gptStyleDesc');
    var sz = (typeof _adSize === 'function') ? _adSize() : { w: 1080, h: 1080 };
    var pb = packBits();
    var look = f.flavor ? String(f.flavor).replace(/^[^:]{2,60}:\s*/, '').split(/\s*,\s*/).filter(function (x) {
      return !/sun|light|lamp|neon|glow|shadow|window|candle|flash|overlay|font|typograph|illustrat|graphic|poster|layout/i.test(x); }).join(', ') : '';
    var lt = pickFresh(PRO_LIGHT, 'prolight');
    var p = [];
    if (ly === 'pr_office') {
      p.push('This photo shows the real office of this firm. An architectural photographer re-shoots the same office: the same layout, walls, partitions, furniture, materials and colours, and the firm\'s sign and logo exactly as they are — the same letters, shape and colours, in the same place.');
      p.push('A new brand photograph of this office: ' + pickFresh(PRO_OFFICE, 'prooffice') + '; ' + lt + '; tidy and calm, cables and clutter out of sight' + (look ? ', in the colours and textures of ' + essence(look, 140) : '') + '.');
      p.push('One light for the whole room, as in a real photograph: all light comes from its real sources — the windows and the lamps in the room — so surfaces facing them are bright and the rest falls gently into shade; furniture and partitions cast their soft shadows on the floor in the same direction, and the sign is lit by that same light.');
    } else {
      var team = ly === 'pr_team';
      p.push('This photo shows ' + (team ? 'the real people of this firm' : 'the real professional of this firm') + '. ' + (team ? 'Each of them stays' : 'They stay') +
        ' exactly the same person — face, features, skin tone, hairstyle, glasses and age — and keeps the same kind of professional clothing; a new brand portrait session photographs ' + (team ? 'them' : 'them') + '.');
      p.push('A new professional brand photograph in ' + pickFresh(PRO_PLACES, 'proplace') + (look ? ', in the colours and textures of ' + essence(look, 140) : '') + '; ' + lt + '. ' + cap(pickFresh(PRO_SHOTS[ly] || PRO_SHOTS.pr_portrait, 'proshot_' + ly)) + '.');
      p.push(LIGHT_LAW(team ? 'everyone' : 'the person', 'them'));
    }
    if (ctxTheme.context) p.push(_occasion(ctxTheme.context, ly !== 'pr_office'));
    var bf = (pb.colour && (document.getElementById('lockBrandColor') || {}).checked !== false && !ctxTheme.context) ? essence(pb.colour, 90) : '';
    if (bf) p.push('Brand colour: ' + bf + '.');
    if (note) p.push('Client note: ' + essence(note, 180));
    p.push('Shot on ' + (ly === 'pr_office' ? 'Canon EOS R5 with a TS-E 24mm tilt-shift lens at f/8, ISO 100: straight lines, clean true colour' : camFor(SELECTED_FLAVOR, ly, '')) + '. Real skin, real materials; ' + sz.w + 'x' + sz.h + ', edge to edge.');
    var t;
    if (headline || sub) t = 'All the lettering in the whole photograph is ' + (ly === 'pr_office' ? 'the firm\'s own sign plus ' : '') + 'these words, in the brand\'s own type style' + (pb.type ? ' (' + essence(pb.type, 80) + ')' : '') + ', set in a calm open area: ' +
      (headline ? '"' + headline + '"' : '') + (headline && sub ? ', and a small line beneath, ' : '') + (sub ? '"' + sub + '"' : '') + '; everything else is wordless.';
    else t = ly === 'pr_office' ? 'The only lettering in the photograph is the firm\'s own sign; documents, screens and notices are blank or turned away.' : 'There is no lettering anywhere in the photograph; documents and screens are blank or turned away.';
    p.push(t);
    return p.join('\n');
  }
  // ═══════════════════════════════════════════════════════════════════
  //  🧩 v2.26 其餘 5 種服務類別重拍(RA 2026-11-05「我全都要重拍」;先用網路範例照實測)
  //   規則跟前面一樣,只看「什麼不能換」:
  //    人(醫師/命理師)→ 同一個人重拍形象照;真實空間(診所/諮詢室/飯店)→ 同一個空間建築攝影重拍;
  //    器物(牌卡/機台/零件/餐點)→ 長相一模一樣、換場景換角度;地點(地標)→ 同一個真實地點、換視角換時刻;
  //    螢幕畫面 → 畫面內容一字不改、放進真實的裝置與場景。一律同一道光。
  //   排版文字圖(衛教說明、觀點大字、規格數字、行程多格、大字+截圖、功能區塊)照舊。
  // ═══════════════════════════════════════════════════════════════════
  var SVC = {
    //  v2.27 美業工作室氛圍:客人上傳的工作室實景 → 建築攝影重拍
    beauty: {
      bt_studio: { k: 'space', what: 'the real beauty studio in this photo — its layout, chairs, beds, mirrors, materials and colours' },
    },
    medical: {
      //  v2.27 RA:醫美韓國最盛行 → 參照韓系醫美(江南高端診所)拍法:暖米色、圓弧白色家具、間接照明、乾淨留白
      med_hands:  { k: 'scene', what: 'the treatment this clinic offers', shots: ['a close shot of the doctor\'s gloved hands preparing a treatment tray, the client softly out of focus behind', 'the doctor\'s hand gently checking the client\'s skin under soft light, faces mostly out of frame'] },
      med_device: { k: 'thing', fix: 1, what: 'the same device or equipment in this photo — its exact shape, colours, screen, labels and logo', shots: ['a clean three-quarter view in a calm treatment room, the device the clear hero', 'a close detail of its handpiece and controls, the room softly blurred'] },
      med_room:   { k: 'space', what: 'the real treatment room in this photo — its bed, equipment, furniture, materials and colours' },
      med_doctor_portrait: { k: 'person', who: 'the real doctor of this clinic', shots: ['a waist-up environmental portrait at eye level, a calm reassuring look', 'standing in the consultation room, arms relaxed, a warm natural smile', 'seated at the desk, turned slightly toward the lens, attentive and kind'] },
      med_team:            { k: 'team', who: 'the real medical team of this clinic', shots: ['the team standing together in the clinic at eye level, every face visible', 'the team in the corridor mid-conversation, relaxed and natural'] },
      med_facility:        { k: 'space', what: 'the real clinic in this photo — its rooms, equipment, furniture, materials and colours' },
      med_consult:         { k: 'person', who: 'the real doctor of this clinic', shots: ['in a calm consultation with a client across the desk, the doctor listening closely, seen over the client\'s shoulder', 'explaining something gently with open hands, the client nodding, both seated'] },
      places: ['a premium Korean-style clinic room with warm beige walls, curved white furniture and sheer linen curtains', 'a calm clinic consultation room with pale wood, a round mirror and fresh flowers', 'a serene clinic lounge with stone, cream linen and a single sculptural plant', 'a bright minimal clinic corridor with arched openings and frosted glass'],
    },
    course: {
      //  v2.27 日系身心靈 / 瑜珈工作室:器材靜物、課後喝茶交流
      co_tools: { k: 'thing', what: 'the real tools of this practice in the photo — the same bowls, mats, cushions, instruments and objects', shots: ['a calm still life of the tools arranged on a wooden floor, a soft shaft of daylight', 'a close angle across the tools with a cup of tea and folded linen beside them'] },
      co_after: { k: 'scene', what: 'the class this business teaches', shots: ['the participants sharing tea after the session, relaxed and smiling, cushions still on the floor', 'two participants talking quietly by the window after class, mats rolled up nearby'] },
      places: ['a calm studio with pale wood floors, linen curtains and plenty of open space', 'a quiet Japanese-style room with tatami, paper screens and a low table'],
    },
    mystic: {
      reading_session: { k: 'thing', what: 'the real tools of this practice in the photo — the same cards, their artwork, colours and backs, the same stones and objects', shots: ['two hands laying the cards on a linen-covered table, seen from above at an angle, faces out of frame', 'the reader\'s hands turning one card over, the spread laid out, a cup of tea nearby, faces out of frame'] },
      tool_closeup:    { k: 'thing', what: 'the real tools of this practice in the photo — the same cards, their artwork and colours, the same stones and objects', shots: ['a close still life of the tools resting on dark wood, every detail readable', 'a close angle across the tools on a linen cloth, a small candle glowing behind'] },
      master_portrait: { k: 'person', who: 'the real practitioner of this practice', shots: ['a calm, grounded portrait seated at the reading table, hands resting, a steady kind look', 'a quiet waist-up portrait by the window, looking softly past the lens'] },
      mystic_space:    { k: 'space', what: 'the real consultation room in this photo — its layout, furniture, objects, materials and colours' },
      //  v2.27 日系占卜 / 療癒空間:茶席與香、諮詢後的安心片刻
      my_tea:          { k: 'thing', what: 'the real tools of this practice in the photo — the same cards, stones and objects', shots: ['a calm still life of the tools beside a small tea set and a curl of incense smoke on dark wood', 'a close angle of the tools on a linen cloth, a cup of tea steaming in soft light'] },
      my_after:        { k: 'scene', what: 'the consultation this practice offers', shots: ['the client and the reader sharing tea after the session, the client\'s face relaxed and relieved', 'the client smiling softly while the reader gathers the cards, a calm warm moment'] },
      places: ['a quiet consultation room with dark wood, a linen-covered table, a pot of tea and a plant', 'a calm room with deep blue walls, a brass lamp and a small bookshelf', 'a softly lit room with paper screens, a low wooden table and cushions'],
    },
    travel: {
      landmark_hero:   { k: 'place', what: 'the same real place in this photo — its buildings, landmarks, streets and landscape exactly as they are', shots: ['a fresh wide view from a higher vantage point, the whole place reading clearly', 'a view from a street-level corner with one traveller in the foreground looking out at it', 'a classic postcard composition from a slightly different spot, people small in the scene'] },
      accommodation:   { k: 'space', what: 'the real room or stay in this photo — its layout, furniture, materials, colours and view' },
      activity_scene:  { k: 'place', what: 'the same real place in this photo', shots: ['two travellers experiencing it up close, caught naturally mid-moment, faces lit and happy', 'a traveller pausing to take it in, seen from behind and slightly to the side'] },
      local_food:      { k: 'thing', what: 'the same local dish or food in this photo — its ingredients, shape, colours and serving', shots: ['a close, appetising angle on a table at a local spot, steam or texture catching the light', 'hands reaching in to share it, the local place softly behind'] },
      transport_move:  { k: 'place', what: 'the same kind of landscape or place as in this photo', shots: ['seen through a train window on the way there, a traveller\'s reflection faint in the glass', 'from the open road on the way there, the view opening up ahead'] },
      //  v2.27 RA:旅遊參照日本(JR 海報、日本觀光局):大片天空與留白、人物小小的、季節感
      tr_breakfast:    { k: 'place', what: 'the same stay or place as in this photo', shots: ['a Japanese-style breakfast tray laid by the window of the stay, the view outside softly visible', 'a slow breakfast on a small balcony table, the place spread out beyond'] },
      tr_back:         { k: 'place', what: 'the same real place in this photo — its buildings, landmarks and landscape exactly as they are', shots: ['a traveller seen from behind, small in the frame, looking out at the place, a wide sky above in the style of a Japanese railway poster', 'a traveller walking away down the path into the scene, the place opening up ahead'] },
      tr_market:       { k: 'place', what: 'the same real place in this photo', shots: ['a lively local shopping street of this place, a traveller tasting something from a stall', 'a close angle on a local stall of this place, hands exchanging a small treat'] },
      times: ['in clear early-morning light', 'in late-afternoon sun', 'at blue hour as the lights begin to glow', 'under soft overcast daylight'],
    },
    equip: {
      eq_machine_full:  { k: 'thing', fix: 1, what: 'the same machine in this photo — its exact shape, proportions, colours, panels, labels and logo', shots: ['a clean three-quarter view at eye level, the whole machine in frame, an uncluttered industrial setting behind', 'a straight-on catalogue view, the whole machine sharp, a polished concrete floor and a calm grey wall'] },
      eq_part_macro:    { k: 'thing', fix: 1, what: 'the same machined part or finished workpiece in this photo — its exact shape, surface finish and details', shots: ['a macro close-up, light raking across the machined surface so every edge and tool mark reads', 'a close angle with the part resting on a steel surface, a shallow depth of field'] },
      eq_application:   { k: 'thing', fix: 1, what: 'the same machine in this photo — its exact shape, colours, panels, labels and logo', shots: ['at work in the industry it serves, an operator in workwear beside it, the setting real and busy but tidy'] },
      eq_factory_floor: { k: 'thing', fix: 1, what: 'the same machine in this photo — its exact shape, colours, panels, labels and logo', shots: ['running on a clean factory floor, an operator checking it, a row of the line soft behind', 'seen down a clean aisle of the factory, the machine mid-operation'] },
      eq_exhibition:    { k: 'thing', fix: 1, what: 'the same machine in this photo — its exact shape, colours, panels, labels and logo', shots: ['on a clean exhibition stand, visitors softly blurred around it, the booth calm and premium'] },
      //  v2.27 日系精密加工大廠拍法:工程師的手、量具與精度
      eq_operator:      { k: 'thing', fix: 1, what: 'the same machine in this photo — its exact shape, colours, panels, labels and logo', shots: ['a close shot of an engineer\'s gloved hand on the control panel, the machine filling the frame behind', 'an engineer in clean workwear checking the machine, seen over the shoulder'] },
      eq_qc:            { k: 'thing', fix: 1, what: 'the same machined part or workpiece in this photo — its exact shape, surface finish and details', shots: ['being measured with a micrometer on a granite inspection table, a precise calm close-up', 'on a coordinate measuring machine, the probe touching its surface, the lab clean and bright'] },
    },
    screen: {
      sc_browser_hero: { k: 'screen', shots: ['on a large monitor on a tidy desk, seen at a slight angle, the room soft behind'] },
      sc_laptop_frame: { k: 'screen', shots: ['on an open laptop on a wooden desk, seen from a slightly raised three-quarter angle, a coffee cup and a plant nearby'] },
      sc_phone_angle:  { k: 'screen', shots: ['on a phone held naturally in one hand, tilted a little, a softly blurred café behind'] },
      sc_in_use:       { k: 'screen', shots: ['on a laptop being used by someone, seen over their shoulder, their hand on the trackpad, a calm workspace', 'on a laptop at a café table, a person leaning in to look, coffee beside it'] },
      sc_multi:        { k: 'screen', shots: ['on an open laptop with a phone beside it on a tidy desk, both showing the screen content, seen at a slight angle'] },
    },
    pro: {
      //  v2.27 國際 / 日系大型事務所:客戶洽談、工作日常、靈魂物件(對應大東拍攝企劃 ③④⑩)
      pr_meeting: { k: 'person', who: 'the real professional of this firm', shots: ['in a calm meeting with a client across a long table, listening closely, seen over the client\'s shoulder', 'explaining a point to a client with an open hand, both seated, documents face down'] },
      pr_daily:   { k: 'person', who: 'the real professional of this firm', shots: ['at the desk reviewing papers with a pen in hand, focused, the office soft behind', 'walking through the office holding a folder, caught naturally mid-step'] },
      pr_object:  { k: 'still', what: 'this firm', shots: ['a still life of a fountain pen, a leather notebook and a brass seal on a dark wood desk, soft window light', 'a still life of bound volumes and a pair of reading glasses on the desk, the office softly blurred behind'] },
      places: ['a high-floor office with floor-to-ceiling glass and the city skyline softly behind', 'a quiet office with a wall of dark wood bookshelves and a leather chair', 'a bright, minimal white-and-grey meeting room with a long pale-wood table'],
    },
    //  v2.30 RA 2026-11-15 兆亨車業實測:沒有汽車類,只能選「專業形象」→ 拍成辦公室律師
    //   新增「汽車買賣與服務」(中古車行 / 估價收購 / 交車):員工制服顏色照原圖,客人可以換新面孔(不用到真客人的臉)
    auto: {
      au_appraise: { k: 'scene', what: 'a used-car appraisal at this dealership — a staff member inspecting a customer\'s car', shots: ['a staff member crouching beside a car, checking the tyre and wheel arch with a tablet in hand, the car filling half the frame', 'a staff member reading the dashboard through the open driver\'s door, notes on a clipboard, the cabin softly lit'] },
      au_consult:  { k: 'scene', what: 'a car owner talking the price through with this dealership\'s staff', shots: ['the staff member and a car owner seated at a small round table, a tablet between them, a clean car softly behind', 'the staff member explaining an appraisal sheet to a car owner beside the car, both relaxed, faces partly turned'] },
      au_handover: { k: 'scene', what: 'a car handover at this dealership', shots: ['the staff member placing the car keys in the new owner\'s hand beside a freshly washed car, a warm natural moment', 'a new owner opening the driver\'s door of a freshly washed car while the staff member smiles beside it'] },
      au_car:      { k: 'thing', what: 'the same car in this photo — its exact model, body shape, colour, wheels and badges', shots: ['a low three-quarter front view, the car the clear hero', 'a clean side profile with the wheels turned slightly toward the camera'] },
      au_showroom: { k: 'scene', what: 'this used-car dealership — its storefront and the clean cars lined up outside', shots: ['the dealership front at dusk, the windows glowing, rows of clean cars lined up neatly outside, seen from across the forecourt', 'a wide view down a row of polished cars inside a bright showroom, the space tidy and calm'] },
      places: ['a bright, tidy used-car showroom with polished concrete floors and tall glass walls', 'an open-air dealership forecourt in late-afternoon light, rows of clean cars softly behind', 'a clean covered inspection bay with even white light and a car on a lift softly behind'],
    },
    //  v2.34 RA 2026-11-20「賣房、房屋代管、租屋」—— 圖釘網 / Zillow / Redfin / StreetEasy 頂級物件攝影的共同原則:
    //   空間照原樣(不能美化成不存在的房子,買方會看屋)、相機水平在胸口高度、垂直線全直、廣角但不變形、站角落看到三面牆、
    //   開窗開簾用自然光、窗外景色和室內同時曝光正確、收乾淨去個人化、顏色真實不過度 HDR;外觀拍藍調時刻、窗戶亮燈
    realty: {
      re_room:     { k: 'space', what: 'the real room in this photo — its layout, windows, floor, built-ins, furniture, materials and colours', look: 'shot from a corner at chest height so three walls read, every vertical line perfectly straight, curtains open, tidy and depersonalised, the view through the window as clear as the room' },
      re_kitchen:  { k: 'space', what: 'the real kitchen or bathroom in this photo — its cabinets, counters, fittings, tiles and colours', look: 'counters cleared to one bowl of fruit or a folded towel, the camera level at counter height, cabinet lines straight, surfaces clean and true in colour' },
      re_exterior: { k: 'space', what: 'the real building in this photo — its facade, windows, entrance, materials and surroundings', look: 'the building seen straight and level at blue hour, every window glowing warm from inside against a deep evening sky, the street tidy and calm' },
      re_view:     { k: 'space', what: 'the real room in this photo — its windows, layout, materials and colours', look: 'the window and its view are the subject: the room and the view outside both correctly exposed in soft daylight, the city or greenery outside clear and real' },
      re_agent:    { k: 'person', who: 'the real agent of this agency', shots: ['standing in a bright, empty living room by the window, relaxed and friendly, at eye level', 'holding a folder at the front door of a home, a warm natural smile, the house softly behind'] },
      re_handover: { k: 'scene', what: 'a home handover by this agency', shots: ['the agent placing a set of house keys in the new owner\'s open hand at the front door, faces partly turned, warm daylight', 'a young couple stepping into their new empty living room for the first time, seen from behind, sunlight across the floor'] },
      re_life:     { k: 'scene', what: 'everyday life in this kind of home', shots: ['a family having breakfast at the dining table by the window, faces partly turned, soft morning light', 'someone reading on the sofa with a cup of tea, afternoon sun falling across the floor', 'a tenant unpacking a box of books in a bright room, seen from the side'] },
      re_area:     { k: 'place', what: 'the same real neighbourhood in this photo — its streets, park, shops and transport exactly as they are', shots: ['a quiet tree-lined street of the neighbourhood with a resident walking past, seen at eye level', 'the nearby park in the morning with a parent and child walking, the homes softly behind'] },
      places: ['a bright, tidy apartment living room with pale wood floors and large windows', 'a calm modern home with white walls, soft linen and a few plants'],
      lights: ['soft daylight from the windows, curtains open', 'bright overcast daylight filling the room evenly', 'warm late-afternoon sun falling through the windows onto the floor'],
      mood: 'Real-estate photography rules: the camera is level at chest height, every wall edge and door frame perfectly vertical, a wide view with no fisheye bending, natural light from the windows doing the work, colours true and never over-processed, the space shown exactly as it really is.',
    },
    //  v2.34 RA 2026-11-20「賣演唱會門票」—— 演唱會 / 活動票券宣傳的共同拍法:觀眾背影剪影對著舞台燈、舉手與手機燈海、
    //   手上一張票前景清楚舞台在後面糊、場館外排隊的期待感;不畫任何可辨認的真人藝人(表演者只是遠處光裡的剪影)
    event: {
      ev_crowd:   { k: 'scene', what: 'a live concert this seller has tickets for', shots: ['seen from inside the crowd: a sea of raised hands and phone lights in silhouette against a blaze of stage light, the performer a tiny silhouette far away', 'fans in the front rows cheering with arms up, lit from the front by warm stage light, haze in the beams above'] },
      ev_ticket:  { k: 'still', what: 'a concert ticket', shots: ['a hand holds a plain paper ticket up toward the stage, the ticket sharp in front, the stage lights a glowing blur of colour behind', 'a plain ticket and a wristband resting on a phone on a café table, the evening city lights soft behind'] },
      ev_stage:   { k: 'scene', what: 'the stage of a big live show', shots: ['a wide view of a huge stage washed in coloured beams and haze, the crowd a dark silhouette in the foreground, the performer a tiny figure in the light', 'beams of light fanning out over a packed arena from a high seat at the back'] },
      ev_venue:   { k: 'place', what: 'the same real venue in this photo — its building, entrance and surroundings exactly as they are', shots: ['fans queueing outside the venue at dusk, the entrance glowing, excitement in the air, faces partly turned', 'a wide view of the venue at blue hour, lights on, a stream of people walking toward it'] },
      ev_fans:    { k: 'scene', what: 'fans heading to a concert', shots: ['two friends in matching fan shirts holding up light sticks and laughing outside the venue at dusk, faces partly turned', 'a fan taking a selfie with a friend in the crowd before the show, stage lights glowing behind'] },
      places: ['a packed indoor arena with haze hanging in coloured stage beams', 'an open-air festival ground at dusk with a big lit stage'],
      lights: ['the coloured stage beams and haze are the only light', 'warm amber and magenta stage light from the front, deep darkness above', 'cool blue stage wash with one white spotlight cutting through the haze'],
      mood: 'Live-show photography: the only light comes from the stage and the phones in the crowd, so faces are rim-lit and coloured by the beams, haze makes the light visible; no performer is recognisable, and there are no real artist names, logos or printed words anywhere.',
    },
    //  v2.31 RA 2026-11-15 長榮桂冠(上市公司):要推住房與婚宴 → 新增「飯店住宿與婚宴」
    //   客房 / 宴會廳照片 = 建築攝影重拍(空間原樣保留);婚宴人物 = 新面孔(不用到真新人的臉)
    hotel: {
      ht_room:      { k: 'space', what: 'the real hotel room in this photo — its bed, furniture, materials, colours and window', look: 'the bed freshly made with crisp white linen, curtains drawn back to the city view, a calm five-star hotel room ready for a guest' },
      ht_bath:      { k: 'space', what: 'the real hotel bathroom in this photo — its bathtub, basin, tiles, fittings and colours', look: 'fresh folded towels and the amenities neatly set out, the bath ready to be drawn, a calm five-star hotel bathroom' },
      ht_stay:      { k: 'scene', what: 'a stay at this five-star hotel', shots: ['a couple relaxing in the room in soft robes, one reading by the window, the city view behind', 'a family settling into the room, a child bouncing gently on the big bed while the parents unpack, faces partly turned'] },
      ht_breakfast: { k: 'scene', what: 'breakfast at this five-star hotel', shots: ['a breakfast table by the window with coffee, fresh fruit and pastries, a guest\'s hands reaching for a cup', 'a guest choosing from a bright breakfast buffet, the dishes neatly arranged, faces out of focus'] },
      wd_hall:      { k: 'space', what: 'the real banquet hall in this photo — its ceiling, lights, stage, walls and colours', look: 'dressed for a wedding: round tables set with white cloths and fresh flowers, soft warm stage light, the hall calm just before the guests arrive' },
      wd_couple:    { k: 'scene', what: 'a wedding banquet in this hotel ballroom — a bride and groom', shots: ['the bride and groom walking in hand in hand under the soft stage light, guests at the round tables turning to look', 'the bride and groom raising a toast at the front of the hall, faces partly turned, the room glowing behind them'] },
      wd_table:     { k: 'still', what: 'this hotel\'s wedding banquet', shots: ['a wedding banquet table close up: white cloth, fresh flowers, gold-rimmed plates and a beautifully plated course, the hall softly lit behind', 'a row of champagne glasses and a small floral centrepiece on a banquet table, the stage lights blurred behind'] },
      wd_bridal:    { k: 'scene', what: 'the bridal suite at this hotel on the wedding day', shots: ['the bride in her gown by the suite window, her mother fastening the veil, soft daylight, faces partly turned', 'the wedding gown hanging by the window of the suite, bouquet and shoes on the sofa, quiet morning light'] },
      //  v2.32 RA 11-15 長榮桂冠:新婚之夜房(前一晚入住、隔天在飯店辦婚禮)以前要請攝影師實際佈置一間房拍 → 同一間房原樣,佈置成新婚之夜
      wd_night:     { k: 'space', what: 'the real hotel room in this photo — its bed, furniture, materials, colours and window', look: 'dressed for a wedding night: red rose petals scattered in a heart on the white bed, a bouquet of roses and two champagne glasses on the side table, a few soft white and gold balloons, warm low lamplight and the city lights glowing in the window' },
      //  v2.32 訪台旅客(日本 / 外國旅客):新面孔旅人,台中城市感與在地早餐
      ht_visitor:   { k: 'scene', what: 'travellers from abroad staying at this five-star hotel in Taichung', shots: ['a traveller unfolding a city map on the bed beside an open suitcase, the Taichung skyline in the window, faces partly turned', 'two friends at the breakfast table trying Taiwanese dishes — soy milk, egg crepes and fresh fruit — laughing, faces partly turned'] },
      places: ['a five-star hotel in the heart of a city, warm wood, soft gold light and quiet carpets', 'a grand hotel ballroom with a high ceiling and warm stage lighting', 'a calm hotel room high above the city, floor-to-ceiling window and soft daylight', 'a hotel room at blue hour, warm lamps just switched on and the city lights beginning to glow outside'],
      //  v2.32 RA 11-15「台灣飯店拍得都還好,日本做得很好」(參考 OMO、虹夕諾雅、輕井澤英迪格那一派的日系飯店攝影)
      //   只描述拍法的氣質,不寫別家的名字:安靜、慢、自然光、有在地感、細節有手感、人物不擺拍
      mood: 'Shot in the manner of the finest Japanese hotel photography: quiet and unhurried, natural light doing most of the work, a muted warm palette, generous empty space and stillness, small crafted details (wood grain, linen, ceramics, a single flower) caught in the light, a gentle sense of the city and place just outside; any people are seen from behind or in soft profile, absorbed in the moment, never posing or smiling at the camera.',
    },
  };
  var SVC_LIGHT = ['soft daylight from tall windows at one side', 'calm late-afternoon light through blinds', 'bright, even daylight from an overcast sky', 'the warm glow of evening lamps, the room around falling gently into shade'];
  function svcLean(pt, ly) {
    var c = SVC[pt][ly], cfg = SVC[pt];
    var f = REGIONAL_FLAVORS[SELECTED_FLAVOR] || {};
    var ctxTheme = CONTEXT_THEMES[SELECTED_CONTEXT] || {};
    var headline = val('gptHeadline'), sub = val('gptSubHeadline'), note = val('gptStyleDesc');
    var sz = (typeof _adSize === 'function') ? _adSize() : { w: 1080, h: 1080 };
    var pb = packBits();
    var look = f.flavor ? String(f.flavor).replace(/^[^:]{2,60}:\s*/, '').split(/\s*,\s*/).filter(function (x) {
      return !/sun|light|lamp|neon|glow|shadow|window|candle|flash|overlay|font|typograph|illustrat|graphic|poster|layout/i.test(x); }).join(', ') : '';
    var lk = look ? ', in the colours and textures of ' + essence(look, 140) : '';
    var shot = c.shots ? cap(pickFresh(c.shots, 'svc_' + ly)) : '';
    var place = cfg.places ? pickFresh(cfg.places, 'svcplace_' + pt) : '';
    var lt = pickFresh(cfg.lights || SVC_LIGHT, 'svclight_' + pt);   // v2.34 行業自己的光(演唱會不會出現陰天日光)
    if (c.look && styleHasLight(c.look)) lt = '';
    var p = [];
    if (c.k === 'person' || c.k === 'team') {
      var team = c.k === 'team';
      p.push('This photo shows ' + c.who + '. ' + (team ? 'Each of them stays' : 'They stay') + ' exactly the same person — face, features, skin tone, hairstyle, glasses and age — and keeps the same kind of clothing; a new brand portrait session photographs them.');
      p.push('A new brand photograph in ' + place + lk + '; ' + lt + '. ' + shot + '.');
      p.push(LIGHT_LAW(team ? 'everyone' : 'the person', 'them'));
    } else if (c.k === 'space') {
      p.push('This photo shows ' + c.what.replace(' in this photo', '') + '. An architectural photographer re-shoots the same space, keeping all of it exactly as it is, including any sign or logo — the same letters, shape and colours, in the same place.');
      p.push('A new brand photograph of this space: ' + (c.look || pickFresh(PRO_OFFICE, 'svcspace')) + (lt ? '; ' + lt : '') + '; tidy and calm, clutter out of sight' + lk + '.');
      p.push('One light for the whole room, as in a real photograph: all light comes from its real sources — the windows and the lamps in the room — so surfaces facing them are bright and the rest falls gently into shade; furniture casts its soft shadows on the floor in the same direction.');
    } else if (c.k === 'place') {
      p.push('This photo shows ' + c.what.replace(' in this photo', '') + '. A ' + (pt === 'travel' ? 'travel ' : '') + 'photographer re-shoots it from a fresh viewpoint at a better moment; the place itself stays real and recognisable, nothing invented or moved.');
      p.push('A new ' + (pt === 'travel' ? 'travel ' : '') + 'campaign photograph ' + pickFresh(cfg.times || cfg.lights || SVC_LIGHT, 'svctime_' + pt) + lk + '. ' + shot + '.');
      p.push('One light for the whole picture, as on a real set: the people are lit only by the light of this place — the same direction, the same colour temperature and the same exposure as the place around them. No separate light is added on them, never brighter or cleaner than the place; whatever lights the streets and buildings lights them too, and their shadows fall the same way as every other shadow. One moment through one lens: the far background sits a touch softer in focus.');
    } else if (c.k === 'thing') {
      p.push('The subject is ' + c.what + '. It stays exactly as it is in the photo, nothing redrawn, added or removed; a photographer re-shoots it in a new setting from a new angle.');
      p.push('A new campaign photograph' + (place ? ' in ' + place : '') + lk + '; ' + lt + '. ' + shot + '.');
      p.push(LIGHT_LAW('the subject', 'it') + ' Things that touch rest on each other under gravity and darken where they meet.');
    } else if (c.k === 'scene') {
      p.push('This photo shows ' + c.what + '. A brand photographer re-shoots it: the same kind of place, clothing colours and tools as in the photo; the people may be new faces.');
      p.push('A new brand photograph in ' + (place || 'the same kind of place as in the photo') + lk + '; ' + lt + '. ' + shot + '.');
      p.push(LIGHT_LAW('everyone in the frame', 'them'));
    } else if (c.k === 'still') {
      p.push('A brand still life for ' + c.what + ', in the same colours, materials and mood as the place in the photo.');
      p.push('A new campaign photograph: ' + shot.charAt(0).toLowerCase() + shot.slice(1) + lk + '.');
      p.push(LIGHT_LAW('every object', 'them') + ' Things that touch rest on each other under gravity and darken where they meet.');
    } else if (c.k === 'screen') {
      p.push('The subject is the screen content in this image: it appears on the device exactly as it is — every word, number, icon, colour and layout unchanged, sharp and readable, nothing redrawn or invented.');
      p.push('A new product photograph of that screen ' + pickFresh(c.shots, 'svc_' + ly) + lk + '; ' + lt + '.');
      p.push('One light for the whole picture: the device, desk and room share the same light and shadows; the screen glows at a natural brightness with a faint real reflection of the room on its glass.');
    }
    //  v2.34 順序就是權重(刺蝟星球 / MOZ):畫面主意第一句,主體保護句第二句
    if (c.k !== 'still' && p.length >= 2) { var _t0 = p[0]; p[0] = p[1]; p[1] = _t0; }
    if (cfg.mood) p.push(cfg.mood);   // v2.32 行業整體的拍攝氣質(目前只有飯店婚宴)
    if (ctxTheme.context) p.push(_occasion(ctxTheme.context, c.k === 'person' || c.k === 'team'));
    var bf = (pb.colour && (document.getElementById('lockBrandColor') || {}).checked !== false && !ctxTheme.context && c.k !== 'space' && c.k !== 'place') ? essence(pb.colour, 90) : '';   // v2.34 空間 / 地點照原樣,不刷品牌色
    if (bf) p.push('Brand colour: ' + bf + '.');
    if (note) p.push('Client note: ' + essence(note, 180));
    p.push('Shot on ' + (c.k === 'space' ? 'Canon EOS R5 with a TS-E 24mm tilt-shift lens at f/8, ISO 100: straight lines, clean true colour' : camFor(SELECTED_FLAVOR, ly, '')) + '. Real textures; ' + sz.w + 'x' + sz.h + ', edge to edge.');
    var own = c.k === 'screen' ? 'the screen content' : (c.k === 'thing' || c.k === 'space' || c.k === 'place') ? 'what is printed or signed on the subject itself' : '';
    var t;
    if (headline || sub) t = 'All the lettering in the whole photograph is ' + (own ? own + ' plus ' : '') + 'these words, in the brand\'s own type style' + (pb.type ? ' (' + essence(pb.type, 80) + ')' : '') + ', set in a calm open area: ' +
      (headline ? '"' + headline + '"' : '') + (headline && sub ? ', and a small line beneath, ' : '') + (sub ? '"' + sub + '"' : '') + '; everything else is wordless.';
    else t = own ? 'The only lettering in the photograph is ' + own + '; everything else is wordless.' : 'There is no lettering anywhere in the photograph; documents and screens are blank or turned away.';
    p.push(t);
    //  v2.29 RA 2026-11-05:機台圖 AI 自己加了簡體「当心触电」貼紙 → 照片上原有的標示照原樣;沒有的不加;場景要的安全標示一律英文(國際化)
    if (pt === 'equip') p.push('Labels and signs already on the machine in the photo stay exactly as they are; no new stickers or signs are added, and any safety marking the scene needs is in English.');
    return p.join('\n');
  }
  //  v2.19 哪些舊類型借哪一種重拍(之後美業、醫美…一個一個加進來)
  var WELLNESS_AS = { wellness: 'physical_reshoot' };
  //  v2.34 順序就是權重:保護句(The subject is… / This photo shows…)若排在第一句,跟第二句的畫面主意對調
  function _ideaFirst(t) {
    var L = String(t || '').split('\n');
    if (L.length > 1 && /^(The subject is|This photo shows)/.test(L[0]) && /^A (new|real)/.test(L[1])) { var x = L[0]; L[0] = L[1]; L[1] = x; }
    return L.join('\n');
  }
  window.buildPosterPromptLean = lean;
  window.buildPosterPrompt = function () {
    var pt = (typeof SELECTED_PRODTYPE !== 'undefined' && SELECTED_PRODTYPE) || '';
    var ly = (typeof SELECTED_LAYOUT !== 'undefined' && SELECTED_LAYOUT) || '';
    var fl = (REGIONAL_FLAVORS[SELECTED_FLAVOR] || {}).flavor || '';
    //  v2.18(RA 2026-11-04「我都要有重拍的質感,不能跟客人說只能選這幾樣」)
    //   ① 版型:照片類版型也走重拍 —— 先借最接近的拍法,再補一句這個版型要的畫面
    //   ② 插畫風格:先照重拍拍好真照片,插畫再疊在上面當一層(原本整張退回舊引擎)
    //   只有前後對比 / 多格展示 / 清單資訊這三種「排版圖」照舊(本來就是好幾格+很多字,不是一張照片)
    var lyMap = LEAN_LAYOUTS.indexOf(ly) !== -1 ? ly : (LEAN_LAYOUT_MAP[ly] ? LEAN_LAYOUT_MAP[ly].to : null);
    var overlay = /ILLUSTRATION OVERLAY/i.test(fl);
    //  v2.19 養生能量商品(水晶/串珠/手環/按摩器)= 實體商品 → 直接用「商品實拍 · 重拍」拍(RA:合規與療效字客人自己判斷,不加字)
    var asPt = WELLNESS_AS[pt] || '';
    //  🧩 v2.26 醫美 / 命理 / 旅遊 / 機台 / 螢幕 → 照片類版型走重拍
    if (window.AD_LEAN !== false && SVC[pt] && SVC[pt][ly] && SVC[pt][ly].k) {
      try {
        window._amReshoot = !!SVC[pt][ly].fix;   // 機台類:出圖後走「商品校正」把標籤 / LOGO 對回原圖
        var so = svcLean(pt, ly);
        if (overlay) so += '\nIllustration layer, added on top of the finished photograph: ' + cut(fl.replace(/^[^.]*OVERLAY[^.]*\.\s*/i, '').replace(/\b[A-Z]{3,}\b/g, function (w) { return w.toLowerCase(); }), 260) + '.';
        console.log('[AD_LEAN] 🧩 ' + pt + ' 重拍 ' + so.length + ' 字');
        return so;
      } catch (e) { console.warn('[AD_LEAN] ' + pt + ' 重拍出錯,改用舊版:', e.message); return ORIG.apply(this, arguments); }
    }
    //  ⚖️ v2.24 專業形象 → 人像 / 團隊 / 空間 走重拍(名片資訊、專業觀點照舊)
    if (window.AD_LEAN !== false && pt === 'pro' && /^(pr_portrait|pr_team|pr_office)$/.test(ly)) {
      try {
        window._amReshoot = false;
        var po = _ideaFirst(proLean(ly));
        if (overlay) po += '\nIllustration layer, added on top of the finished photograph: ' + cut(fl.replace(/^[^.]*OVERLAY[^.]*\.\s*/i, '').replace(/\b[A-Z]{3,}\b/g, function (w) { return w.toLowerCase(); }), 260) + '.';
        console.log('[AD_LEAN] ⚖️ 專業形象重拍 ' + po.length + ' 字');
        return po;
      } catch (e) { console.warn('[AD_LEAN] 專業形象重拍出錯,改用舊版:', e.message); return ORIG.apply(this, arguments); }
    }
    //  🧘 v2.23 課程與體驗 → 課程重拍(6 種版型全部)
    if (window.AD_LEAN !== false && pt === 'course' && COURSE_SHOTS.hasOwnProperty(ly)) {
      try {
        window._amReshoot = false;
        var co = _ideaFirst(courseLean(ly));
        if (overlay) co += '\nIllustration layer, added on top of the finished photograph: ' + cut(fl.replace(/^[^.]*OVERLAY[^.]*\.\s*/i, '').replace(/\b[A-Z]{3,}\b/g, function (w) { return w.toLowerCase(); }), 260) + '.';
        console.log('[AD_LEAN] 🧘 課程重拍 ' + co.length + ' 字');
        return co;
      } catch (e) { console.warn('[AD_LEAN] 課程重拍出錯,改用舊版:', e.message); return ORIG.apply(this, arguments); }
    }
    //  💅 v2.22 美業照片類版型 → 美業重拍
    if (window.AD_LEAN !== false && pt === 'beauty' && BEAUTY_FRAMES.hasOwnProperty(ly)) {
      try {
        window._amReshoot = false;
        var bo = _ideaFirst(beautyLean(ly));
        if (overlay) bo += '\nIllustration layer, added on top of the finished photograph: ' + cut(fl.replace(/^[^.]*OVERLAY[^.]*\.\s*/i, '').replace(/\b[A-Z]{3,}\b/g, function (w) { return w.toLowerCase(); }), 260) + '.';
        console.log('[AD_LEAN] 💅 美業重拍 ' + bo.length + ' 字');
        return bo;
      } catch (e) { console.warn('[AD_LEAN] 美業重拍出錯,改用舊版:', e.message); return ORIG.apply(this, arguments); }
    }
    var use = window.AD_LEAN !== false && (LEAN_TYPES.indexOf(pt) !== -1 || !!asPt) && lyMap !== null;
    if (!use) { window._amReshoot = false; return ORIG.apply(this, arguments); }
    var _keepLy = (typeof SELECTED_LAYOUT !== 'undefined') ? SELECTED_LAYOUT : '', _keepFl = (typeof SELECTED_FLAVOR !== 'undefined') ? SELECTED_FLAVOR : '';
    var _keepPt = pt;
    try {
      if (asPt) SELECTED_PRODTYPE = asPt;
      if (lyMap !== ly) SELECTED_LAYOUT = lyMap;
      if (overlay) SELECTED_FLAVOR = 'none';
      window._leanFrom = ly; window._leanCatNow = '';
      var out = lean();
      window._leanFrom = '';
      //  v2.34 美食版只對吃的東西說「這是一道菜」(鍋子、頌缽選到美食版 → 照情境寫真拍,不叫 AI 把它拍成菜)
      var _nonFood = window._leanCatNow && !/^(dish|food|meat|drink|jar|packaged|supplement)$/.test(window._leanCatNow);
      if (lyMap !== ly && !(ly === 'food_special' && _nonFood)) out += '\n' + LEAN_LAYOUT_MAP[ly].say;
      if (overlay) out += '\nIllustration layer, added on top of the finished photograph: ' + cut(fl.replace(/^[^.]*OVERLAY[^.]*\.\s*/i, '').replace(/\b[A-Z]{3,}\b/g, function (w) { return w.toLowerCase(); }), 260) + '.';
      console.log('[AD_LEAN] 精簡提示詞 ' + out.length + ' 字(舊版保險絲:window.AD_LEAN=false)');
      return out;
    } catch (e) {
      console.warn('[AD_LEAN] 精簡版出錯,改用舊版:', e.message);
      SELECTED_LAYOUT = _keepLy; SELECTED_FLAVOR = _keepFl; SELECTED_PRODTYPE = _keepPt;
      return ORIG.apply(this, arguments);
    } finally {
      try { SELECTED_LAYOUT = _keepLy; SELECTED_FLAVOR = _keepFl; SELECTED_PRODTYPE = _keepPt; } catch (_) {}
    }
  };
  console.log('[AD_LEAN] v2.33 ⚖️畫面主意放第一句、光與鏡頭段壓成一句 · v2.32 📚通用拍法庫給美術指導挑 · v2.31 🔎品牌/商品專屬拍法(/shoots/,圖釘網每日自動查) · v2.30 🍽品類專屬拍法 17+ 類(商品名優先、繁簡都認、選了風格也用)、鏡頭靠近 · v2.29 🏭機台標示英文 · v2.28 📌Pinterest補漏(商品 44 手法 · MD 54 手法) · v2.27 ➕各行業新版型(日韓參照) · v2.26 🧩醫美/命理/旅遊/機台/螢幕重拍 · v2.25 ⚖️國際/日本大所形象照手法 · v2.24 ⚖️專業形象重拍 · v2.23 🧘課程重拍 · v2.22 💅美業重拍·💡保留版光的鐵律(場景跟著原圖的光) · v2.21 🧥照片沒拍到的那一面不加字 · v2.20 💡光的鐵律(人和背景同一盞光)· v2.19 精簡廣告圖提示詞已載入(養生能量走重拍·版型與插畫也走重拍·62 種風格拍攝通告單·背景輪流·大件同視角·生存遊戲使用中·擺放方式)');
})();

})();
