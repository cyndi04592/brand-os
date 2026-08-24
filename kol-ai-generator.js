/* ═══════════════════════════════════════════════════════════════
 *  Brand OS · KOL AI 人像生成器(Tab 3 Phase 1)
 *  v3.17 · 2026-05-25  (= 昨天 v3.16 代理版 + 今天品牌同步修補)
 *
 *  功能:
 *   • 選品牌 + 選/新增 Persona + 人設參數(中文下拉)
 *   • 反 AI 美學 prompt 自動合成(真人感配方)
 *   • fal.ai Flux 1.1 Pro Ultra 串接(走 Cloudflare proxy,金鑰留後端)
 *   • 3 張結果挑臉 + Seed 鎖定
 *   • 一鍵存進雲端倉庫(2026-08-22 起改走 Worker saveKolPhoto,不再寫 Google)
 *
 *  v3.17 新增:品牌自我校正(ensureBrandSynced)
 *   — 不管先選品牌還先載入面板,都會自己追上「當前品牌」,不再卡「請先選品牌」
 *
 *  使用方式:
 *   在 kol.html 的 </body> 前面加一行:
 *     <script src="kol-ai-generator.js"></script>
 *
 *  不動 kol.html 本體,overlay 注入新面板
 *  回滾:刪掉那行 script tag 即可
 * ═══════════════════════════════════════════════════════════════ */
(function() {
'use strict';

// ── 設定 ───────────────────────────────────────────────────
// v3.16: FAL_ENDPOINT / FAL_KEY 已移除 — 改走 Cloudflare proxy(見下方 WORKER_URL)
// 金鑰現在安全存在 Worker env.FAL_KEY,前端不再持有

const GAS_URL = 'https://script.google.com/macros/s/AKfycbzJgPVlBS6qJV9zmxJQyPTrwn_jHY11AKOHfwiKVPhtHLUWJNjEVsFpWMd-Mk-RtZhy5w/exec';
const PASSWORD = 'raby2026';
// v3.16: 改走 Cloudflare proxy 保護 FAL_KEY,不再前端寫死金鑰
const WORKER_URL = 'https://kol-proxy.calm-sunset-6b66.workers.dev';

// ═══════════════════════════════════════════════════════════════
//  🔐 2026-08-19 自己帶身分證(修 401 NEED_LOGIN)
//
//  踩到的坑:kol.html 有一個全域 fetch 攔截器,會自動幫每個送往 Worker 的
//    請求塞 token + email。但那個攔截器裝在 kol.html 第 1657 行,
//    而本檔在第 1654 行就被載入了 —— 差三行,順序卻是死的。
//    本檔在自己執行期間打出去的請求用的是「原生 fetch」,沒人幫忙塞證,
//    Worker 看不到身分 → 回 401 NEED_LOGIN。
//    (載入當下 gasGet('getBrandOS') 就中招,Console 一片紅字。)
//
//  為什麼不搬 script 順序:kol.html 裡本檔被載入兩次(1654 與 7734),
//    搬哪一個都要重新驗整條線,而且下一次有人動順序又會壞。
//    讓它自己帶證,跟載入順序脫鉤,一勞永逸。
//
//  ⚠️ 三個打 Worker 的出口都要包:fal_image_submit(花錢類,不帶必被擋)、
//     gas_cached(讀個人資料)、gas_write(寫入)。日後新增出口記得也包。
// ═══════════════════════════════════════════════════════════════
function _authToken() {
  try { return sessionStorage.getItem('bs_auth_token') || localStorage.getItem('bs_auth_token') || ''; }
  catch (e) { return ''; }
}
function _withAuth(o) {
  o = o || {};
  try {
    if (!o.token) { const t = _authToken(); if (t) o.token = t; }
    if (!o.email) { const e = localStorage.getItem('bs_sso_email') || ''; if (e) o.email = e; }
  } catch (e) { /* 讀不到 storage 就照原樣送,行為跟改造前一樣 */ }
  return o;
}

const COST_PER_IMAGE_USD = 0.06;

// ── 狀態 ──────────────────────────────────────────────────
const S = {
  brands: [],
  personas: [],
  currentBrandId: '',
  currentPersonaName: '',
  lockedSeed: null,
  lastImages: [],       // [{url, width, height, saved_to_drive}]
  lastPrompt: '',
  generating: false,
  saving: {},           // index => bool
};

// ── 反 AI 美學 Prompt 配方庫 ─────────────────────────────
// ═══════════════════════════════════════════════════════════════
//  🆕 v3.38(2026-08-23)版面主從修正:「建立新角色」提為主要動作(整排大按鈕),
//     既有角色下拉降為「或者…」次要路徑;區塊標題改「AI 生成角色形象照」
//  🆕 v3.37(2026-08-23)文案修正:角色下拉標題不再誤導成「創建」;
//     清掉最後兩處 Google 雲端硬碟殘留文案(/KOL/{品牌}/ 與「資料夾」)
//  🆕 v3.36(2026-08-23)臉部品質四道防呆
//
//  ★ 為什麼要在【生成端】治,不能等影片:
//    這張臉是每一段影片都要餵給 Seedance 當 @Image1 的錨點。
//    來源有鬥雞眼 → 每一段都鬥雞眼。引擎放大缺陷,不會修正缺陷。
//    資產優先:資產負責穩定性,資產壞了後面全壞。
//
//  ⚠️ 這裡【不做】獨立的 negative_prompt 欄位:
//    Worker 走的是 fal-ai/flux-pro/v1.1-ultra,那支 API 沒有這個參數。
//    硬加會被靜默丟掉 —— 看起來有防護實際什麼都沒做,比沒有更糟
//    (日後排查會誤以為已經擋過)。FLUX 對句中的 no / never 有反應,
//    所以否定詞直接寫進正向句子。
//
//  三個現場實例(2026-08-23):
//   ① 鬥雞眼 —— 側身回頭 + "friendly eye contact" 指令衝突,
//      模型硬要兩眼都看鏡頭,一隻轉過去另一隻沒跟上。
//   ② 遺照感 / 油畫感 —— 正面平光 + 深色背景 + 中性表情 + 無環境層次。
//      光平 → 對比壓縮 → 皮膚失去高低起伏 → 塑膠或油畫。
//   ③ 痣太整齊 —— "skin texture" 被理解成規律紋理貼圖,痣呈均勻分布、
//      大小一致。真人的痣是隨機叢聚、大小不一。
// ═══════════════════════════════════════════════════════════════
const FACE_GUARD =
  // ① 眼睛幾何
  'both eyes looking at exactly the same single focal point with perfectly aligned parallel gaze, ' +
  'no crossed eyes no wandering eye no divergent gaze, pupils centered consistently in both eyes, ' +
  // ③ 瑕疵的隨機性
  'any moles freckles or blemishes are few, irregular and randomly scattered in loose uneven clusters, ' +
  'varying in size and depth, never evenly spaced never symmetrical never a uniform pattern, ' +
  // ② 立體感與環境
  'clear three-dimensional facial modeling with real depth, natural environmental context visible behind her, ' +
  'never a flat dark empty backdrop, never a memorial portrait look, never an oil-painting or illustrated look';

// ═══ ④ 眼神 ════════════════════════════════════════════════
//  RA:「眼神流轉很吃眼球,眼球呆滯很不行,我要連 AI 都以為是真人照片。」
//
//  ★ 這跟 ① 是兩件不同的事,不能混:
//    ① 鬥雞眼 = 幾何問題(兩眼沒對齊)
//    ④ 呆滯   = 生命感問題(對齊了但沒有人在裡面)
//    只修 ① 會得到一雙「對得很整齊的死魚眼」。
//
//  呆滯的五個來源,逐項對治:
//   ⑴ 沒有反光點 —— 真人眼球是濕的,一定有環境光源的 catchlight,
//      左右眼位置一致(同一個光源),形狀是光源的形狀。
//   ⑵ 瞳孔沒有對焦對象 —— 寫「看鏡頭」模型只會畫「朝向鏡頭」不是「聚焦」。
//      要明講聚焦在一個【有距離的具體對象】上。
//   ⑶ 眼白太乾淨 —— 真人有極細血絲、下眼瞼濕潤反光、內眼角淚阜。
//   ⑷ 左右眼完全對稱 —— 真人雙眼皮寬度、上眼瞼高度天生略有差異。
//      完美對稱是模型預設,也是最刺眼的假。
//   ⑸ 沒有「正在想事情」—— 生命感來自眼周肌肉極輕微的收縮,
//      那是真笑與假笑的差別。
const EYE_GUARD =
  'alive expressive eyes with a real sense of a thinking person behind them, ' +
  'wet glossy eyeballs with clear sharp specular catchlights from the actual light source in the scene, ' +
  'the catchlight sits in the same matching position in both eyes, ' +
  'pupils genuinely focused on one specific object at a real distance, not vacantly aimed at the lens, ' +
  'natural moist lower lash line with a faint wet reflection, visible tear duct and a few very fine blood vessels in the whites, ' +
  'slight natural asymmetry between the two eyelids and eyelid crease widths, ' +
  'subtle engagement of the muscles around the eyes as in a real unforced expression, ' +
  'eyes never glassy never vacant never doll-like never dead-fish, ' +
  'never a blank stare, never flat matte pupils, never identical mirrored eyes';

// 骨幹模板(所有情境共用的「真人感」基底)
const BACKBONES = {
  // 素人 candid:生活感、有瑕疵、親切(食品/生活類/又晴)
  candid:
    'Candid head-and-shoulders portrait photograph of {AGE} {NATIONALITY} {GENDER} shot on 50mm film, natural framing with the face clearly visible, ' +
    '{PERSONA}, ' +
    'a real ordinary everyday person, natural and relatable, not a polished influencer, ' +
    'beautiful but completely real raw unretouched skin with clearly visible skin pores and fine pore texture all over the cheeks nose and forehead, every fine line and skin detail visible, strong skin texture and grain, no beauty filter no skin smoothing no airbrushing, natural sub-surface scattering, ' +
    'mostly matte complexion with only faint natural shine in the T-zone, slightly uneven real skin tone, slight natural asymmetry, minimal natural makeup, ' +
    'natural hair with loose flyaway strands, individual real hairs and slight frizz, ' +
    'directional natural light raking across the face from the side, revealing skin pores and texture through gentle real shadows, slightly muted understated film colors, not bright not glossy, ' +
    'wearing {OUTFIT}, {SCENE}, relaxed candid unposed moment, ' +
    'strong natural 35mm film grain and Kodak Gold film tonality, raw unedited photo, ' +
    'authentic {NATIONALITY} aesthetic',

  // 攝影級 editorial:美但真、單側方向光、真皮膚(內衣/Misaki)
  editorial:
    'Professional editorial studio portrait photograph of {AGE} {NATIONALITY} {GENDER}, ' +
    '{PERSONA}, ' +
    'beautiful but completely real raw unretouched skin clearly showing every pore and fine line, strong visible skin texture and grain across the whole face, no beauty filter no skin smoothing no airbrushing, natural sub-surface scattering, ' +
    'bare matte complexion with soft non-shiny cheeks and nose, only very faint natural shine in the T-zone, fine visible skin texture over the cheekbones, slightly uneven real skin tone, light natural makeup, realistic catchlights in the eyes, ' +
    'slight natural asymmetry, natural hair with loose flyaway strands, individual real hairs and slight frizz, ' +
    'soft directional natural light coming from one side, gentle realistic shadow falloff across the face with a soft natural shadow on the opposite side, real light modeling the facial structure with depth, shallow depth of field, shot on medium format film with an 85mm f/1.4 lens, fine natural film grain and subtle Kodak Portra 400 tonality, ' +
    'wearing {OUTFIT}, against a clean seamless studio backdrop in soft neutral tones, ' +
    'high-end editorial photography, true-to-life photorealistic detail with real untouched skin, ' +
    'authentic {NATIONALITY} aesthetic',
};

// 變數對應表
const GENDER_MAP = {
  female: 'woman',
  male:   'man',
};

const AGE_MAP = {
  young:    'a 22-year-old',
  standard: 'a 26-year-old',
  mature:   'a 31-year-old',
  elder:    'a 37-year-old',
  kid:      'a 7-year-old',
};

// ═══════════════════════════════════════════════════════════════
//  🆕 v3.32(2026-08-19)年齡自由選 1–99
//
//  舊做法:AGE_MAP 只有 5 檔(7/22/26/31/37),跳空嚴重 ——
//    想要 28 歲沒有、想要 45 歲更沒有,而美業/醫美/專業服務
//    很吃「看起來有幾年經驗」這件事,26 跟 31 差很多。
//
//  ★ 不可能為 99 個年齡各寫一句提示詞,所以拆成兩層:
//    ① 數字直接組進句子(a 28-year-old)
//    ② 老化特徵照「年齡帶」自動補
//  ★ 第 ② 層是必要的,不是裝飾:模型的訓練資料嚴重偏年輕,
//    只給數字它會把 50 歲畫成 30 歲。要明講皺紋、白髮、鬆弛,它才會做。
// ═══════════════════════════════════════════════════════════════
function ageNum(v) {
  const n = parseInt(v, 10);
  return (isFinite(n) && n >= 1 && n <= 99) ? n : null;
}
function ageBandTraits(n) {
  if (n <= 3)  return 'chubby toddler cheeks, very soft baby skin, big curious eyes, fine wispy baby hair';
  if (n <= 9)  return 'natural healthy child skin, soft round features, bright innocent expression, slightly messy child hair';
  if (n <= 17) return 'fresh adolescent skin with a few natural blemishes, youthful softening jawline, clean simple hair';
  if (n <= 25) return 'young firm skin with full collagen, a few natural small blemishes and visible pores, bright clear eyes';
  if (n <= 34) return 'mature natural adult skin with real texture, faint expression lines starting around the eyes, settled confident features';
  if (n <= 44) return 'visible fine lines around the eyes and mouth, faint nasolabial folds, slightly less taut jawline, composed grown-up presence, a few grey hairs at the temples';
  if (n <= 59) return 'clear laugh lines and crow\'s feet, softening jawline with mild skin laxity, uneven mature skin tone with some age spots, noticeably greying hair, warm seasoned presence';
  return 'deep set wrinkles across forehead and around the eyes, visibly loose crepey skin, age spots on the skin, thinning white or silver hair, gentle dignified elderly presence';
}
// ⚠️ 未成年一律強制加保護詞,不看客戶選了什麼服裝或風格。
//    這條不可以做成開關,也不可以被其他設定覆蓋。
const MINOR_GUARD = 'fully clothed in modest age-appropriate everyday clothing, wholesome innocent child portrait, ' +
                    'no makeup, no adult styling, no suggestive posing, no revealing clothing';
function ageClause(v, gender) {
  const n = ageNum(v);
  if (n === null) return null;
  const noun = (n <= 12) ? (gender === 'male' ? 'boy' : 'girl')
             : (n <= 17) ? (gender === 'male' ? 'teenage boy' : 'teenage girl')
             : (gender === 'male' ? 'man' : 'woman');
  return { n, phrase: 'a ' + n + '-year-old', noun, traits: ageBandTraits(n), minor: n < 18 };
}

const NATIONALITY_MAP = {
  tw: 'Taiwanese',
  jp: 'Japanese',
  kr: 'Korean',
  jpmix: 'Japanese-Taiwanese mixed',
  hk: 'Hong Kong Chinese',
  my: 'Malaysian Chinese',
};

const PERSONA_MAP = {
  girl_next_door: 'girl-next-door type with intellectual warmth, soft gentle smile, natural skin with light freckles and visible texture',
  professional:   'confident intellectual professional woman, composed and poised, natural skin with subtle fine lines and real texture',
  nordic_cool:    'Nordic-inspired cool minimalist vibe, defined features, calm distant gaze, natural skin with visible pores and real texture',
  warm_mama:      'warm maternal aura, cozy homebody vibe, caring expression, slightly tired warm eyes, natural skin with visible pores and faint under-eye shadows',
  sweet_college:  'sweet college student vibe, cheerful and natural, youthful energy, real young skin with a few light blemishes and visible texture',
  edgy_fashion:   'edgy alternative individual style, striking candid unposed look, natural skin with visible pores and real texture',
  // ── v5.13 男性類型(outdoor_man 是真實度黃金樣板,不要動)──
  outdoor_man:    'rugged outdoor adventurer vibe, weathered tan skin, light stubble, athletic build, confident mountain-guide presence, The North Face technical aesthetic',
  sporty_man:     'energetic sporty guy, fit athletic build, friendly approachable grin, light sweat sheen, sun-tanned skin with natural texture',
  pro_man:        'confident professional man, composed trustworthy expression, smart-casual presence, natural skin with visible texture and faint stubble shadow',
  uncle_warm:     'warm friendly middle-aged man, approachable everyman charm, genuine relatable smile, natural aging skin with laugh lines and visible texture',
  foodie:         'enthusiastic food lover savoring a meal, warm delighted relatable expression, natural skin with visible pores and real texture',
  nutritionist:   'clean wholesome health-conscious professional, friendly reassuring smile, natural fresh skin with visible texture',
  chef:           'focused professional chef with calm culinary confidence, natural skin with visible pores and real texture',
  doctor:         'trustworthy composed medical professional, calm reassuring presence, natural skin with subtle texture',
  lawyer:         'sharp composed legal professional, confident reliable expression, natural skin with visible texture',
  athlete:        'energetic athlete with sporty vitality, healthy sun-kissed skin, determined friendly look, light natural sheen',
  reporter:       'capable on-location reporter, articulate engaged expression, natural professional skin with visible texture',
  shopper:        'relaxed cheerful shopper browsing casually, light easy everyday smile, natural skin with real texture',
  appliance_guru: 'friendly practical product reviewer, approachable explaining expression, natural skin with visible texture',
  snacker:        'casual relatable snack lover with a happy easygoing munching vibe, natural skin with visible pores and real texture',
  salesperson:    'friendly energetic retail salesperson, approachable enthusiastic helpful smile, natural skin with real texture',
  couple_warm:    'warm affectionate partner-next-door vibe, gentle loving gaze and soft tender smile, natural skin with real texture',
  kid_cute:       'an innocent cheerful young child with a bright natural smile, soft round features, natural healthy child skin',
  // ── 🆕 v3.33 美業與服務業(2026-08-19)──
  //   共同要求:手一定會入鏡,指甲乾淨修短;神情專注不諂媚;不做誇張手勢。
  lash_artist:    'focused lash technician with calm steady hands, gentle attentive gaze, short clean unpainted nails, natural skin with visible pores and real texture',
  nail_artist:    'precise nail artist with well-groomed hands, relaxed creative confidence, tidy short nails on the working hand, natural skin with real texture',
  hair_stylist:   'stylish hair professional with effortless personal styling, easy approachable confidence, natural skin with visible texture',
  aesthetic_consultant: 'composed clinic consultant with a reassuring unhurried manner, clean minimal grooming, trustworthy calm gaze, natural skin with subtle real texture',
  yoga_teacher:   'calm centred yoga instructor with relaxed upright posture, serene unforced smile, bare fresh face, natural skin with visible texture',
  fitness_coach:  'encouraging personal training coach, fit practical build, direct motivating eye contact, light natural sheen on the skin, real skin texture',
  tarot_reader:   'contemplative tarot reader with a quiet knowing presence, soft steady gaze, understated jewellery, natural skin with real texture',
  tour_guide:     'friendly experienced tour guide, weather-tanned outdoor skin, easy welcoming smile, practical unfussy grooming, natural skin texture',
  ip_attorney:    'meticulous trademark and patent professional, precise composed expression, quietly authoritative, natural skin with visible texture and faint fine lines',
  // ── 🆕 v3.33 行銷代操與系統服務(芮比自己推 Brand OS 用)──
  //   ⚠️ 氣質要「一人公司」不是「大公司主管」:專業但不端架子,忙但不慌。
  marketing_consultant: 'practical marketing consultant with a candid down-to-earth manner, thinking-out-loud expression, smart-casual and unfussy, natural skin with real texture',
  content_operator:     'hands-on content operator mid-work, focused unposed concentration with a slight tired-but-satisfied look, minimal grooming, natural skin with visible pores and real texture',
  solo_founder:         'one-person-company founder, self-reliant grounded presence, quietly determined and unpolished, no corporate gloss, natural skin with real texture and faint under-eye shadows',
};

const LIGHTING_MAP = {
  window_day:  'natural daylight from a window, overcast soft diffused lighting',
  cafe_side:   'golden hour side light from cafe window, warm amber tones',
  studio_flat: 'soft studio light with gentle directional shadows that reveal skin texture',
  outdoor_day: 'natural outdoor afternoon sunlight, slight lens flare',
  indoor_warm: 'warm indoor tungsten lighting, cozy ambient mood',
  bright_clean:  'bright clean even lighting, fresh crisp and professional',
  bright_midday: 'bright natural midday sunlight, vivid energetic outdoor light',
  evening_warm:  'warm evening lamp light, intimate cozy glow',
  moody_side:    'moody low-key directional side lighting, dramatic shadow falloff',
  // ── 🆕 v3.33 行業佈光 ──
  //   ⚠️ 全部維持「柔、散、無油光」,不加戲劇性硬光 —— 硬光會在臉上打出高光斑,
  //      那正是「AI 油臉」的來源(見 kol-cinematographer 的教訓)。
  salon_soft:    'soft even beauty-salon lighting from a large diffused source, clean shadowless falloff, flattering but not glamorous',
  clinic_white:  'clean bright clinical lighting, neutral white balance, even and reassuring with no harsh shadows',
  classroom_day: 'bright natural daylight filling a studio classroom, soft and open with gentle directional falloff',
  candle_warm:   'low warm candle and lamp light, intimate hushed glow, gentle shadows with no hard specular highlights',
  office_day:    'plain office daylight from a nearby window, neutral and unglamorous, soft even fill on the face',
};

const OUTFIT_MAP = {
  beige_knit:    'a soft beige ribbed knit sweater',
  white_tshirt:  'a simple white cotton t-shirt',
  silk_blouse:   'a silky ivory blouse with delicate drape',
  oversized_shirt: 'an oversized pastel button-down shirt',
  turtleneck:    'a fitted black turtleneck',
  summer_dress:  'a light cotton summer dress in muted tone',
  // ── v5.13 男裝 ──
  tech_jacket:   'a functional outdoor technical shell jacket, The North Face style',
  flannel_shirt: 'a rugged plaid flannel shirt, sleeves rolled up',
  mens_tshirt:   'a plain heather-grey crew-neck t-shirt',
  polo_shirt:    'a clean navy polo shirt, smart-casual',
  chef_jacket:   'a clean white double-breasted chef jacket',
  white_coat:    'a white medical coat over a collared shirt',
  dark_suit:     'a tailored dark business suit',
  jersey:        'a sporty athletic team jersey',
  blazer:        'a smart professional blazer',
  hoodie:        'a casual cotton hoodie',
  trendy_casual: 'a trendy casual everyday outfit',
  // ── 🆕 v3.33 行業服裝 ──
  salon_uniform: 'a clean fitted beauty-salon work tunic in a soft neutral tone',
  apron:         'a simple canvas work apron over a plain long-sleeve top',
  yoga_set:      'a fitted matte yoga set in a muted tone, no logos',
  sportswear:    'functional matte athletic training wear, breathable and unbranded',
  suit_blouse:   'a crisp tailored blouse with a structured collar, business-formal',
  cardigan_knit: 'an open knit cardigan over a plain tee, soft and unfussy',
  guide_casual:  'practical lightweight outdoor casual wear, comfortable for walking all day',
  oriental_top:  'an understated oriental-style top with a mandarin collar in a deep muted tone',
  rolled_shirt:  'a plain white shirt with the sleeves rolled to the forearm, worn without a tie',
};

const SCENE_MAP = {
  apartment:  'sitting casually in a lived-in minimalist apartment, a houseplant and soft furniture slightly out of focus behind, shot from a natural candid angle, 35mm documentary feel, real depth of field',
  cafe:       'at a cafe window seat with a coffee cup and a few everyday things on the wooden table, blurred street greenery through the window, candid unposed moment, 35mm documentary feel',
  studio:     'in a calm Japandi-style room with soft natural window light, simple wooden furniture softly out of focus behind, relaxed candid feel',
  restaurant:   'at a restaurant table with beautifully plated dishes softly out of focus, warm ambient light, candid dining moment, 35mm documentary feel',
  clinic:       'in a clean modern clinic consultation room, soft medical-white tones softly out of focus behind, even bright light, candid professional moment',
  health_studio:'in a bright airy health studio with fresh produce and plants softly out of focus, clean natural light, candid wellness moment',
  law_office:   'in a refined law office with a wall of legal books softly out of focus behind, warm professional light, composed candid moment',
  campus:       'on a relaxed university campus with greenery and buildings softly out of focus, natural afternoon light, candid student moment, 35mm',
  sports_field: 'on an outdoor sports field with a blurred stadium background, bright natural daylight, candid athletic moment',
  street_live:  'reporting on location on a city street with blurred urban background, natural daylight, candid on-the-scene moment, 35mm',
  mall:         'inside a bright modern shopping mall with blurred store displays behind, soft retail lighting, candid shopping moment',
  shoe_store:   'inside a bright shoe store or outlet with rows of shoe shelves softly out of focus behind, clean retail lighting, candid friendly moment, 35mm',
  outdoor_city: 'on a quiet city street with blurred shopfronts and passers-by behind, natural afternoon light, candid street-photography feel, 35mm',
  bedroom:    'relaxed on a bed with slightly rumpled linen sheets, soft morning light through the curtains, intimate candid snapshot of a real lived-in room',
  kitchen:    'in a cozy home kitchen, everyday utensils and ingredients softly out of focus on the counter behind, warm natural light, candid lifestyle moment',
  living_room: 'relaxed on a sofa in a lived-in living room with cushions and a throw blanket, soft warm lamp light, candid at-home moment',
  // ── v5.13 戶外場景 ──
  mountain:   'on a mountain trail with misty forest peaks behind, a little wind in the hair, candid hiking snapshot, natural outdoor light',
  campsite:   'at an outdoor campsite with tents and gear scattered around, warm golden hour light, candid relaxed moment',
  // ── 🆕 v3.33 行業場域(2026-08-19)──
  //   ⚠️ 全部寫成「她正在那個空間裡工作/生活」,不是「站在背景前面」,
  //      而且環境物件一律 softly out of focus —— 背景搶戲會壓掉主角的臉。
  lash_room:    'in a small tidy lash studio beside a treatment bed with a ring light and neat tools softly out of focus, calm clean light, candid working moment',
  nail_desk:    'at a nail artist work desk with polish bottles and small tools arranged softly out of focus, warm clean light, candid close working moment',
  aesthetic_room: 'in a quiet aesthetic clinic consultation room, soft neutral tones and a mirror softly out of focus behind, even reassuring light, composed candid moment',
  meeting_room: 'in a small professional meeting room with a plain table and a wall of files softly out of focus, warm even light, composed candid moment',
  yoga_room:    'in a bright airy yoga studio with mats and plants softly out of focus, soft natural floor-level light, calm candid moment',
  tarot_table:  'at a small draped table with cards and a candle softly out of focus, low warm intimate light, quiet contemplative candid moment',
  scenic_trail: 'on a scenic travel trail with a landmark landscape softly out of focus behind, natural outdoor light, candid travelling moment',
  classroom:    'at the front of a small teaching room with a board and seats softly out of focus behind, bright natural daylight, candid teaching moment',
  // ── 🆕 v3.33 一人公司(芮比自己推 Brand OS 用)──
  //   ⚠️ 不要拍成大公司會議室 —— 故事是「一個人把整條線跑完」,
  //      空間要小、要有生活痕跡、要看得出真的在工作,不是形象照。
  solo_desk:    'at a single work desk in a small home studio, notebooks and a coffee cup and a little real clutter softly out of focus, plain daylight from a window, candid mid-work moment',
  dual_screen:  'in front of a two-monitor workstation in a compact studio room, screens softly out of focus and unreadable, plain office daylight, candid unposed working moment',
  client_table: 'across a small table from a client, printed material and a laptop between them softly out of focus, warm even indoor light, candid discussion moment',
};

// ═══════════════════════════════════════════════════════════════════
//  ✨ v3.34 神韻預設 —— 選好人設就自動帶,客戶不用自己想
//   為什麼要有:「自由補充」原本是一個空白框,提示寫「例:眼神有故事感」。
//     客戶根本不知道該寫什麼,九成的人會留白 —— 留白的結果是 AI 自由發揮,
//     同一個人設每次生出來的神韻都不一樣(有時甜美、有時嚴肅)。
//   ★ 這正是「不教客戶做對的事,讓預設就是對的事」:
//     他選了「行銷顧問」,系統就知道那該長什麼樣子。
//   ★ 客戶想改照樣能改 —— 這是預設值,不是鎖死。
//   ⚠️ 寫英文:自由補充是直接串進英文 prompt 的,中文會讓模型解讀不穩。
//   ⚠️ 只寫「神韻/眼神/姿態」,不碰服裝場景光線 —— 那些欄位自己有得選,
//      重複描述會打架(例如這裡寫 warm light、佈光卻選了診間白光)。
const KAI_VIBE = {
  professional:         'sharp composed gaze, poised upright posture, quietly authoritative, not overly sweet',
  nordic_cool:          'calm distant gaze, minimalist restrained posture, cool composed presence',
  warm_mama:            'caring warm expression, soft unhurried posture, gentle attentive eyes',
  marketing_consultant: 'composed confident gaze, relaxed but focused posture, the look of someone who has just made a clear point, not overly sweet',
  content_operator:     'quick alert eyes, hands-on energy, mid-task focus, natural unposed expression',
  solo_founder:         'grounded self-reliant expression, slight tiredness that reads as real, quietly determined',
  girl_next_door:       'warm approachable smile, relaxed natural posture, friendly eye contact',
  pro_woman:            'poised professional bearing, calm direct gaze, subtle confident smile',
  pro_man:              'steady professional bearing, calm direct gaze, composed posture',
  nordic_model:         'cool composed expression, elegant restrained posture, distant editorial gaze',
  sweet_college:        'bright youthful smile, lively relaxed posture, open friendly eyes',
  edgy_fashion:         'bold assured gaze, strong fashion-forward posture, confident attitude',
  outdoor_man:          'weathered easy-going expression, relaxed outdoor posture, natural squint',
  sporty_man:           'energetic open expression, athletic upright posture, healthy vitality',
  uncle_warm:           'kind crinkled eyes, warm unhurried presence, gentle approachable smile',
  foodie:               'delighted anticipating expression, leaning-in curiosity, genuine enjoyment',
  nutritionist:         'reassuring professional warmth, attentive listening posture, clear honest gaze',
  chef:                 'focused craftsman expression, confident hands, practised composure',
  doctor:               'calm reassuring authority, attentive eye contact, composed steady posture',
  lawyer:               'precise composed expression, upright authoritative posture, measured gaze',
  athlete:              'determined focused expression, strong ready posture, controlled intensity',
  reporter:             'alert engaged expression, clear articulate posture, direct camera presence',
  shopper:              'curious browsing expression, relaxed casual posture, natural interest',
  appliance_guru:       'knowledgeable explaining expression, demonstrative hands, friendly authority',
  snacker:              'relaxed indulgent expression, casual comfortable posture, easy enjoyment',
  salesperson:          'warm persuasive presence, open inviting posture, confident friendly gaze',
  couple_warm:          'affectionate soft expression, relaxed intimate posture, gentle warmth',
  kid_cute:             'bright innocent expression, playful natural posture, unguarded joy',
  lash_artist:          'delicate focused expression, steady precise hands, gentle professional care',
  nail_artist:          'attentive detailed focus, careful steady hands, calm artistry',
  hair_stylist:         'creative assured expression, expressive hands, stylish confident presence',
  aesthetic_consultant: 'polished reassuring expression, attentive consulting posture, refined calm',
  yoga_teacher:         'serene centred expression, balanced grounded posture, quiet presence',
  fitness_coach:        'motivating energetic expression, strong encouraging posture, positive drive',
  tarot_reader:         'thoughtful mysterious calm, unhurried deliberate gestures, quiet knowing gaze',
  tour_guide:           'cheerful welcoming expression, open guiding gesture, easy enthusiasm',
  ip_attorney:          'meticulous composed expression, precise professional bearing, trustworthy calm',
};

// 中文顯示對應
const LABEL = {
  gender: {
    female: '女性',
    male:   '男性',
  },
  age: {
    kid:      '7 歲兒童',
    young:    '22 歲',
    standard: '26 歲',
    mature:   '31 歲',
    elder:    '37 歲',
  },
  nationality: {
    tw: '台灣',
    jp: '日本',
    kr: '韓國',
    jpmix: '日混台',
    hk: '香港',
    my: '馬來西亞',
  },
  persona: {
    girl_next_door: '知性親和鄰家姐姐',
    professional:   '專業銳利職場',
    nordic_cool:    '北歐冷感模特',
    warm_mama:      '溫暖媽媽家居',
    sweet_college:  '甜美大學生',
    edgy_fashion:   '前衛時尚',
    outdoor_man:    '戶外型男',
    sporty_man:     '運動陽光男',
    pro_man:        '專業職場男',
    uncle_warm:     '親和大叔',
    foodie:         '美食老饕',
    nutritionist:   '營養師',
    chef:           '大廚',
    doctor:         '醫生',
    lawyer:         '律師',
    athlete:        '運動員',
    reporter:       '記者',
    shopper:        '逛街客人',
    appliance_guru: '家電達人',
    snacker:        '零食嘴饞',
    salesperson:    '銷售員',
    couple_warm:    '情侶感',
    kid_cute:       '小朋友',
    // 🆕 v3.33 美業與服務業
    lash_artist:          '美睫師',
    nail_artist:          '美甲師',
    hair_stylist:         '髮型師',
    aesthetic_consultant: '醫美諮詢師',
    yoga_teacher:         '瑜伽老師',
    fitness_coach:        '健身教練',
    tarot_reader:         '塔羅師',
    tour_guide:           '導遊',
    ip_attorney:          '商標專利師',
    // 🆕 v3.33 行銷與系統服務
    marketing_consultant: '行銷顧問',
    content_operator:     '內容操盤手',
    solo_founder:         '一人公司創辦人',
  },
  lighting: {
    window_day:  '室內日光',
    cafe_side:   '咖啡廳側光',
    studio_flat: '棚內平光',
    outdoor_day: '戶外午後',
    indoor_warm: '室內暖光',
    bright_clean:  '明亮乾淨',
    bright_midday: '正午陽光',
    evening_warm:  '暖夜燈光',
    moody_side:    '戲劇側光',
    // 🆕 v3.33 行業佈光
    salon_soft:    '美容室柔光',
    clinic_white:  '診間潔淨白光',
    classroom_day: '教室自然光',
    candle_warm:   '命理暖燭光',
    office_day:    '辦公室日光',
  },
  outfit: {
    beige_knit:      '米色針織',
    white_tshirt:    '白色 T 恤',
    silk_blouse:     '絲質襯衫',
    oversized_shirt: '寬版襯衫',
    turtleneck:      '黑色高領',
    summer_dress:    '夏日洋裝',
    tech_jacket:     '機能外套',
    flannel_shirt:   '格紋法蘭絨',
    mens_tshirt:     '男士素T',
    polo_shirt:      'POLO 衫',
    chef_jacket:     '廚師服',
    white_coat:      '白袍',
    dark_suit:       '深色西裝',
    jersey:          '運動球衣',
    blazer:          '西裝外套',
    hoodie:          '連帽休閒',
    trendy_casual:   '時髦休閒',
    // 🆕 v3.33 行業服裝
    salon_uniform:   '美容師工作服',
    apron:           '工作圍裙',
    yoga_set:        '瑜伽服',
    sportswear:      '運動機能服',
    suit_blouse:     '套裝襯衫',
    cardigan_knit:   '針織開襟',
    guide_casual:    '導遊輕便裝',
    oriental_top:    '東方風上衣',
    rolled_shirt:    '白襯衫捲袖',
  },
  scene: {
    apartment:    '簡約公寓',
    cafe:         '咖啡廳窗邊',
    studio:       'Japandi 棚',
    outdoor_city: '城市街頭',
    bedroom:      '臥室晨光',
    kitchen:      '居家廚房',
    living_room:  '客廳沙發',
    mountain:     '山林步道',
    campsite:     '戶外營地',
    restaurant:   '餐廳餐桌',
    clinic:       '診間',
    health_studio:'健康工作室',
    law_office:   '律所書牆',
    campus:       '校園',
    sports_field: '球場',
    street_live:  '街頭連線',
    mall:         '商場店內',
    shoe_store:   '鞋店/賣場',
    // 🆕 v3.33 行業場域
    lash_room:      '美睫工作室',
    nail_desk:      '美甲工作桌',
    aesthetic_room: '醫美諮詢室',
    meeting_room:   '事務所會議室',
    yoga_room:      '瑜伽教室',
    tarot_table:    '塔羅桌',
    scenic_trail:   '景點步道',
    classroom:      '教室講台',
    // 🆕 v3.33 一人公司
    solo_desk:      '一人工作室書桌',
    dual_screen:    '雙螢幕工作區',
    client_table:   '與客戶討論',
  },
};

// 品牌預設配方(之後可擴充)
const BRAND_DEFAULTS = {
  ly: { // LACEZ(內衣)→ 攝影級
    age: 'standard', nationality: 'tw', persona: 'girl_next_door',
    lighting: 'window_day', outfit: 'beige_knit', scene: 'apartment',
    realism: 'editorial',
  },
  moz: { // → 攝影級
    age: 'standard', nationality: 'tw', persona: 'nordic_cool',
    lighting: 'studio_flat', outfit: 'turtleneck', scene: 'studio',
    realism: 'editorial',
  },
};

// ── 啟動 ──────────────────────────────────────────────────
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

let _initialized = false;
function init() {
  if (_initialized) return;
  _initialized = true;
  injectStyle();
  injectPanel();
  hookBrandSwitcher();
  console.log('[kol-ai-generator v3.38] 已載入(+window.KAI 人物表共用 +gasPost +年齡1~99拉桿 +未成年閘門)');
}

// ── CSS 注入(貼合 kol.html v4.1 視覺) ──────────────────
function injectStyle() {
  const css = `
  .kai-panel {
    background: linear-gradient(135deg, rgba(109,250,194,0.04) 0%, rgba(124,109,250,0.04) 100%);
    border: 1px solid rgba(109,250,194,0.2);
    border-radius: 14px;
    padding: 20px 22px;
    margin-top: 16px;
    position: relative;
    overflow: hidden;
  }
  .kai-panel::before {
    content: '';
    position: absolute; top: 0; left: 0; right: 0; height: 2px;
    background: linear-gradient(90deg, #6dfac2, #7c6dfa, #fa6d9b);
  }
  .kai-head {
    display: flex; align-items: center; gap: 10px;
    margin-bottom: 16px; flex-wrap: wrap;
  }
  .kai-title {
    font-family: 'Syne', sans-serif; font-size: 13px; font-weight: 800;
    letter-spacing: .08em; color: #6dfac2; text-transform: uppercase;
  }
  .kai-badge {
    font-size: 9px; font-family: 'Syne', sans-serif; font-weight: 700;
    padding: 2px 7px; border-radius: 10px;
    background: linear-gradient(135deg, #6dfac2, #7c6dfa); color: #0a0a0f;
  }
  .kai-row {
    display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;
  }
  .kai-row-3 {
    display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 10px;
  }
  .kai-row-persona {
    display: grid; grid-template-columns: 1fr auto; gap: 8px; margin-bottom: 10px;
  }
  /* 🆕 2026-08-09 RWD:手機「保持」兩欄 —— 舊寫法在 680px 以下改成一欄,
     八個下拉直直排下來太冗長(RA 實測回饋)。390px 寬兩欄放下拉綽綽有餘。 */
  @media (max-width: 680px) {
    .kai-row   { grid-template-columns: 1fr 1fr; }
    .kai-row-3 { grid-template-columns: 1fr 1fr; }
    .kai-prompt-preview { max-height: 92px; }
  }
  .kai-field { display: flex; flex-direction: column; gap: 5px; }
  .kai-label {
    font-size: 10.5px; color: rgba(255,255,255,0.55);
    font-family: 'Syne', sans-serif; font-weight: 600;
    text-transform: uppercase; letter-spacing: .05em;
  }
  .kai-select, .kai-input {
    width: 100%; padding: 9px 11px; background: rgba(10,10,15,0.6);
    border: 1px solid rgba(255,255,255,0.08); border-radius: 7px;
    color: #f0f0f8; font-size: 12.5px; font-family: 'Noto Sans TC', sans-serif;
    outline: none; transition: border-color .2s;
  }
  .kai-select:focus, .kai-input:focus { border-color: #6dfac2; }
  .kai-select option { background: #1a1a24; }
  .kai-textarea {
    width: 100%; padding: 9px 11px; background: rgba(10,10,15,0.6);
    border: 1px solid rgba(255,255,255,0.08); border-radius: 7px;
    color: #f0f0f8; font-size: 12.5px; font-family: 'Noto Sans TC', sans-serif;
    outline: none; resize: vertical; min-height: 56px; line-height: 1.5;
    margin-bottom: 10px;
  }
  .kai-textarea:focus { border-color: #6dfac2; }
  .kai-btn-add {
    padding: 9px 14px; background: rgba(124,109,250,0.1);
    border: 1px solid rgba(124,109,250,0.35); border-radius: 7px;
    color: #b5abff; font-size: 12px; font-weight: 600;
    cursor: pointer; font-family: 'Noto Sans TC', sans-serif;
    white-space: nowrap; transition: all .2s;
  }
  .kai-btn-add:hover { background: rgba(124,109,250,0.2); color: #fff; }
  .kai-folder-hint {
    font-size: 10.5px; color: rgba(109,250,194,0.75);
    font-family: 'JetBrains Mono', monospace;
    margin-bottom: 14px; padding: 6px 10px;
    background: rgba(109,250,194,0.05);
    border-left: 2px solid rgba(109,250,194,0.4);
    border-radius: 0 4px 4px 0;
  }
  .kai-adv {
    border-top: 1px dashed rgba(255,255,255,0.08);
    padding-top: 12px; margin-top: 12px;
  }
  .kai-adv-head {
    font-size: 11px; color: rgba(255,255,255,0.5);
    font-family: 'Syne', sans-serif; font-weight: 600;
    cursor: pointer; user-select: none; margin-bottom: 8px;
    display: flex; align-items: center; gap: 6px;
  }
  .kai-adv-head .triangle { transition: transform .2s; display: inline-block; font-size: 9px; }
  .kai-adv.open .kai-adv-head .triangle { transform: rotate(90deg); }
  .kai-adv-body { display: none; }
  .kai-adv.open .kai-adv-body { display: block; }
  .kai-seed-row {
    display: grid; grid-template-columns: 1fr 1fr 1fr auto; gap: 8px;
    align-items: end; margin-top: 8px;
  }
  .kai-seed-lock {
    padding: 8px 12px; background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.1); border-radius: 7px;
    font-size: 11px; font-family: 'JetBrains Mono', monospace;
    cursor: pointer; color: rgba(255,255,255,0.5);
    transition: all .2s;
  }
  .kai-seed-lock.locked {
    background: rgba(109,250,194,0.15); color: #6dfac2;
    border-color: rgba(109,250,194,0.4);
  }
  .kai-prompt-preview {
    background: rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.06);
    border-radius: 7px; padding: 10px 12px;
    font-family: 'JetBrains Mono', monospace; font-size: 10.5px;
    color: rgba(181,171,255,0.85); line-height: 1.55;
    max-height: 120px; overflow-y: auto;
    margin-bottom: 12px; white-space: pre-wrap;
  }
  .kai-prompt-head {
    font-size: 10px; color: rgba(255,255,255,0.4);
    font-family: 'Syne', sans-serif; font-weight: 600;
    text-transform: uppercase; letter-spacing: .1em;
    margin-bottom: 5px; display: flex; justify-content: space-between;
  }
  .kai-prompt-head .edit-link {
    color: #7c6dfa; cursor: pointer; font-weight: 700;
  }
  .kai-gen-row {
    display: flex; gap: 10px; align-items: center; flex-wrap: wrap;
    margin-top: 10px;
  }
  .kai-btn-gen {
    flex: 1; min-width: 200px;
    padding: 12px 20px;
    background: linear-gradient(135deg, #6dfac2, #4ecdc4);
    color: #0a0a0f; border: none; border-radius: 8px;
    font-size: 13px; font-weight: 800;
    font-family: 'Noto Sans TC', sans-serif; cursor: pointer;
    display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    transition: all .2s; box-shadow: 0 4px 16px rgba(109,250,194,0.25);
  }
  .kai-btn-gen:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 8px 24px rgba(109,250,194,0.4);
  }
  .kai-btn-gen:disabled { opacity: .5; cursor: not-allowed; transform: none; }
  .kai-cost {
    font-size: 11px; color: rgba(255,255,255,0.5);
    font-family: 'JetBrains Mono', monospace;
  }
  .kai-cost .num { color: #6dfac2; font-weight: 700; }

  .kai-results {
    margin-top: 16px; padding-top: 14px;
    border-top: 1px solid rgba(255,255,255,0.06);
  }
  .kai-results-head {
    font-size: 11px; color: rgba(255,255,255,0.55);
    font-family: 'Syne', sans-serif; font-weight: 700;
    text-transform: uppercase; letter-spacing: .1em;
    margin-bottom: 10px; display: flex; justify-content: space-between;
    align-items: center;
  }
  .kai-gallery {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;
  }
  @media (max-width: 680px) {
    .kai-gallery { grid-template-columns: 1fr; }
  }
  .kai-img-card {
    border-radius: 8px;
    background: rgba(0,0,0,0.4); position: relative;
    border: 2px solid transparent; transition: all .2s;
    animation: kaiFadeIn .5s ease both;
    display: flex; flex-direction: column;
  }
  .kai-img-thumb {
    position: relative; aspect-ratio: 3/4; overflow: hidden;
    border-radius: 8px 8px 0 0; cursor: zoom-in;
  }
  .kai-img-thumb:hover img { transform: scale(1.04); }
  @keyframes kaiFadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .kai-img-thumb img {
    width: 100%; height: 100%; object-fit: cover; display: block;
    transition: transform .25s;
  }
  .kai-img-idx {
    position: absolute; top: 6px; left: 6px;
    background: rgba(0,0,0,0.7); color: #6dfac2;
    padding: 3px 8px; border-radius: 4px;
    font-family: 'JetBrains Mono', monospace; font-size: 10px;
    font-weight: 700; letter-spacing: .05em;
    backdrop-filter: blur(6px);
  }
  .kai-img-actions {
    display: flex; gap: 6px; padding: 8px;
  }
  .kai-lightbox {
    position: fixed; inset: 0; z-index: 3000;
    background: rgba(0,0,0,0.92); backdrop-filter: blur(6px);
    display: none; align-items: center; justify-content: center;
    cursor: zoom-out; padding: 24px;
  }
  .kai-lightbox.open { display: flex; }
  .kai-lightbox img {
    max-width: 95%; max-height: 95%; object-fit: contain;
    border-radius: 10px; box-shadow: 0 20px 60px rgba(0,0,0,0.6);
  }
  .kai-lightbox-close {
    position: fixed; top: 18px; right: 24px;
    width: 46px; height: 46px;
    display: flex; align-items: center; justify-content: center;
    background: rgba(255,255,255,0.14); color: #fff;
    border-radius: 50%; font-size: 22px; cursor: pointer;
    backdrop-filter: blur(6px); transition: background .2s; z-index: 3001;
  }
  .kai-lightbox-close:hover { background: rgba(255,255,255,0.3); }
  .kai-img-btn {
    flex: 1; padding: 10px 8px;
    background: rgba(10,10,15,0.92); color: #f0f0f8;
    border: 1px solid rgba(255,255,255,0.2); border-radius: 6px;
    font-size: 13px; font-family: 'Noto Sans TC', sans-serif;
    font-weight: 700; cursor: pointer;
    backdrop-filter: blur(10px);
    transition: all .15s;
    letter-spacing: .02em;
    box-shadow: 0 2px 8px rgba(0,0,0,0.4);
  }
  .kai-img-btn.view-btn {
    flex: 0 0 44px; padding: 10px 0; font-size: 16px;
  }
  .kai-img-btn:hover:not(:disabled) {
    background: rgba(124,109,250,0.4);
    border-color: #7c6dfa;
    transform: translateY(-1px);
  }
  .kai-img-btn:disabled { opacity: .6; cursor: not-allowed; }
  .kai-img-btn.saved {
    background: rgba(109,250,194,0.25); color: #6dfac2;
    border-color: rgba(109,250,194,0.5);
  }
  .kai-img-card.picked {
    border-color: #6dfac2;
    box-shadow: 0 0 0 2px rgba(109,250,194,0.3);
  }
  .kai-status {
    padding: 10px 12px; border-radius: 6px; font-size: 12px;
    margin-top: 10px; font-family: 'Noto Sans TC', sans-serif;
  }
  .kai-status.info { background: rgba(124,109,250,0.1); color: #b5abff; border: 1px solid rgba(124,109,250,0.2); }
  .kai-status.ok   { background: rgba(109,250,194,0.1); color: #6dfac2; border: 1px solid rgba(109,250,194,0.2); }
  .kai-status.err  { background: rgba(250,109,155,0.1); color: #fa6d9b; border: 1px solid rgba(250,109,155,0.2); }
  .kai-status.warn { background: rgba(255,169,77,0.1); color: #ffa94d; border: 1px solid rgba(255,169,77,0.2); }
  .kai-spinner {
    display: inline-block; width: 12px; height: 12px;
    border: 2px solid rgba(10,10,15,0.2); border-top-color: #0a0a0f;
    border-radius: 50%; animation: kaiSpin .8s linear infinite;
  }
  @keyframes kaiSpin { to { transform: rotate(360deg); } }
  .kai-empty {
    padding: 40px 20px; text-align: center;
    color: rgba(255,255,255,0.4); font-size: 12px;
    background: rgba(0,0,0,0.2); border-radius: 8px;
    border: 1px dashed rgba(255,255,255,0.08);
  }
  .kai-empty .emoji { font-size: 28px; margin-bottom: 8px; display: block; }

  /* 新增 persona modal */
  .kai-modal-wrap {
    position: fixed; inset: 0; background: rgba(5,5,10,0.85);
    backdrop-filter: blur(10px); z-index: 2000;
    display: none; align-items: center; justify-content: center;
    animation: kaiFadeIn .2s ease;
  }
  .kai-modal-wrap.open { display: flex; }
  .kai-modal {
    background: #111118; border: 1px solid rgba(109,250,194,0.2);
    border-radius: 14px; padding: 22px 26px; width: 92%; max-width: 400px;
    box-shadow: 0 30px 80px rgba(0,0,0,0.6);
  }
  .kai-modal h3 {
    font-family: 'Syne', sans-serif; font-size: 15px; font-weight: 800;
    color: #6dfac2; margin-bottom: 6px;
  }
  .kai-modal .sub {
    font-size: 12px; color: rgba(255,255,255,0.5); margin-bottom: 14px;
    line-height: 1.5;
  }
  .kai-modal-foot {
    display: flex; gap: 8px; justify-content: flex-end; margin-top: 14px;
  }
  .kai-btn-ghost {
    padding: 9px 16px; background: transparent;
    border: 1px solid rgba(255,255,255,0.15); border-radius: 7px;
    color: rgba(255,255,255,0.7); font-size: 12px;
    cursor: pointer; font-family: 'Noto Sans TC', sans-serif;
  }
  .kai-btn-primary {
    padding: 9px 16px; background: linear-gradient(135deg, #6dfac2, #4ecdc4);
    color: #0a0a0f; border: none; border-radius: 7px;
    font-size: 12px; font-weight: 700;
    cursor: pointer; font-family: 'Noto Sans TC', sans-serif;
  }
  .kai-btn-primary:disabled { opacity: .5; cursor: not-allowed; }
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
}

// ── 面板注入 ──────────────────────────────────────────────
function injectPanel() {
  // 找「KOL 形象庫」的 panel(左欄),在它底下插入
  const anchor = findLeftPanelAnchor();
  const html = buildPanelHTML();

  if (anchor) {
    anchor.insertAdjacentHTML('beforeend', html);
  } else {
    // Fallback:插到 main 底部
    document.querySelector('main.main')?.insertAdjacentHTML('beforeend',
      '<div style="max-width:1100px;margin:0 auto;padding:0 24px 40px;">' + html + '</div>'
    );
  }

  // Modal
  document.body.insertAdjacentHTML('beforeend', buildModalHTML());

  bindEvents();
  renderPromptPreview();
  updateCostEstimate();
}

function findLeftPanelAnchor() {
  const panels = document.querySelectorAll('.panel');
  for (const p of panels) {
    const title = p.querySelector('.panel-title');
    if (title && title.textContent && title.textContent.includes('KOL 形象庫')) {
      return p;
    }
  }
  return null;
}

function buildPanelHTML() {
  const genOpts = renderOptions(LABEL.gender, 'female');
  const ageOpts = renderOptions(LABEL.age, 'standard');
  const natOpts = renderOptions(LABEL.nationality, 'tw');
  const perOpts = renderOptions(LABEL.persona, 'girl_next_door');
  const ligOpts = renderOptions(LABEL.lighting, 'window_day');
  const outOpts = renderOptions(LABEL.outfit, 'beige_knit');
  const scnOpts = renderOptions(LABEL.scene, 'apartment');

  return `
    <div class="kai-panel" id="kai-panel">
      <div class="kai-head">
        <span class="kai-title">AI 生成角色形象照</span>
      </div>

      <!-- ═══════════════════════════════════════════════════════════
           🩹 2026-08-23 主從關係修正(同事實測:一看就困惑)
           病灶:整塊標題寫「AI 生成 KOL 角色」→ 同事以為是【建新角色】,
             結果第一個欄位是下拉、裡面全是【已經建好的】又晴/米禾/橘子,
             「我要建新的,為什麼叫我選舊的?」→ 當場卡住。
           真相:這塊其實同時做兩件事 ——
             ① 建一位全新角色(「＋ 建立新角色」)
             ② 幫已建好的角色再生一張形象照(下拉)
             舊版把②放最前面又放大,①擠在旁邊當附屬 → 主從反了。
           ★ 修法:把①提到最前面當主要動作,②降成「或者…」的次要路徑,
             並在標題下用一句話講清楚這塊在幹嘛。
           ★ 只動版面與文案,id 與事件完全不變(kai-persona / kai-btn-new-persona
             在 onPersonaChange、syncBrandAndLoadPersonas、建立流程都有引用)。
           ═══════════════════════════════════════════════════════════ -->
      <div style="font-size:11.5px;color:#8a8a99;line-height:1.75;margin:-4px 0 12px">
        建立一位全新的 AI KOL,或幫已經建好的角色再生一張形象照。
      </div>

      <div style="margin-bottom:12px">
        <button class="kai-btn-add" id="kai-btn-new-persona"
                style="width:100%;padding:11px;font-size:13px;font-weight:800;letter-spacing:.5px"
                title="從零建立一位全新的 AI KOL">＋ 建立新角色</button>
      </div>

      <div class="kai-row-persona">
        <div class="kai-field">
          <label class="kai-label">或者 · 生給已建立的角色</label>
          <select class="kai-select" id="kai-persona">
            <option value="">— 先選品牌 —</option>
          </select>
        </div>
      </div>

      <div class="kai-folder-hint" id="kai-folder-hint" style="display:none"></div>

      <div class="kai-row">
        <div class="kai-field">
          <label class="kai-label">性別</label>
          <select class="kai-select kai-param" data-k="gender">${genOpts}</select>
        </div>
        <div class="kai-field">
          <label class="kai-label">年齡 · <span id="kai-age-num" style="color:#6dfac2;font-weight:700">26</span> 歲</label>
          <input type="range" class="kai-param kai-age-range" data-k="age" min="1" max="99" step="1" value="26"
                 style="width:100%;accent-color:#7c6dfa;height:22px;cursor:pointer;">
          <div style="display:flex;justify-content:space-between;font-size:10px;color:#6a6a78;margin-top:-2px">
            <span>1</span><span>兒童</span><span>青年</span><span>熟齡</span><span>99</span>
          </div>
        </div>
      </div>

      <!-- 🆕 v3.32 未成年確認:選到 18 歲以下才出現,沒勾不准生成。
           童裝、兒童食品、學習用品是正當需求,不該砍掉;
           但不可逆的兒少風險要有一道摩擦 + 一筆客戶自己的確認紀錄。 -->
      <div id="kai-minor-box" style="display:none;margin:-4px 0 12px;padding:10px 12px;border:1px solid rgba(255,169,77,.45);background:rgba(255,169,77,.08);border-radius:10px;">
        <label style="display:flex;gap:8px;align-items:flex-start;cursor:pointer;font-size:12px;line-height:1.6;color:#ffc98a">
          <input type="checkbox" id="kai-minor-ok" style="margin-top:2px;accent-color:#ffa94d;flex:0 0 auto">
          <span>我確認這是商品或服務情境的實際需要(例:童裝、兒童食品、學習用品),且不會用於任何不當用途。<br>
          <span style="color:#c89a5e">系統會自動加上服裝與情境的保護限制。</span></span>
        </label>
      </div>

      <div class="kai-row">
        <div class="kai-field">
          <label class="kai-label">國籍氣質</label>
          <select class="kai-select kai-param" data-k="nationality">${natOpts}</select>
        </div>
        <div class="kai-field">
          <label class="kai-label">人設風格</label>
          <select class="kai-select kai-param" data-k="persona">${perOpts}</select>
        </div>
      </div>

      <div class="kai-row">
        <div class="kai-field">
          <label class="kai-label">佈光氛圍</label>
          <select class="kai-select kai-param" data-k="lighting">${ligOpts}</select>
        </div>
        <div class="kai-field">
          <label class="kai-label">服裝</label>
          <select class="kai-select kai-param" data-k="outfit">${outOpts}</select>
        </div>
      </div>

      <div class="kai-row">
        <div class="kai-field">
          <label class="kai-label">角色場域</label>
          <select class="kai-select kai-param" data-k="scene">${scnOpts}</select>
        </div>
        <div class="kai-field"></div>
      </div>

      <div class="kai-field">
        <label class="kai-label">神韻補充 · <span style="color:#5eead4;font-weight:400">已依人設自動帶入,可直接改</span></label>
        <textarea class="kai-textarea" id="kai-free-text"
          placeholder="選好人設後會自動帶入神韻描述"></textarea>
      </div>

      <div class="kai-prompt-head">
        <span>生成 Prompt 預覽</span>
        <span class="edit-link" id="kai-edit-prompt">手動編輯</span>
      </div>
      <div class="kai-prompt-preview" id="kai-prompt-preview"></div>

      <div class="kai-adv" id="kai-adv">
        <div class="kai-adv-head" id="kai-adv-head">
          <span class="triangle">▶</span>
          <span>進階設定</span>
        </div>
        <div class="kai-adv-body">
          <div class="kai-row-3">
            <div class="kai-field">
              <label class="kai-label">張數</label>
              <select class="kai-select" id="kai-num">
                <option value="1">1 張</option>
                <option value="3" selected>3 張</option>
                <option value="4">4 張</option>
              </select>
            </div>
            <div class="kai-field">
              <label class="kai-label">比例</label>
              <select class="kai-select" id="kai-ratio">
                <option value="3:4" selected>3:4 人像</option>
                <option value="1:1">1:1 方形</option>
                <option value="9:16">9:16 手機直</option>
                <option value="4:3">4:3 橫式</option>
              </select>
            </div>
            <div class="kai-field">
              <label class="kai-label">Safety</label>
              <select class="kai-select" id="kai-safety">
                <option value="2" selected>2 標準</option>
                <option value="3">3</option>
                <option value="4">4</option>
                <option value="5">5 寬</option>
                <option value="6">6 最寬</option>
              </select>
            </div>
          </div>
          <div class="kai-seed-row">
            <div class="kai-field">
              <label class="kai-label">Raw 反 AI 美學</label>
              <select class="kai-select" id="kai-raw">
                <option value="true" selected>ON(真人感必開)</option>
                <option value="false">OFF 標準美學</option>
              </select>
            </div>
            <div class="kai-field" style="grid-column: span 2;">
              <label class="kai-label">Seed(挑臉後會自動填)</label>
              <input class="kai-input" id="kai-seed" type="text" placeholder="(留空隨機)" />
            </div>
            <div class="kai-seed-lock" id="kai-seed-lock">未鎖</div>
          </div>
        </div>
      </div>

      <div class="kai-gen-row">
        <button class="kai-btn-gen" id="kai-btn-gen">
          生成 AI KOL
        </button>
        <!-- 🚫 2026-08-14:拿掉美金預估。這是我們付給上游的【進價】,
             不是客戶的價格 —— 讓客戶看到等於公開成本結構,
             而且跟他實際被扣的點數是兩套數字,只會造成誤會。
             版位保留(空的 span),之後要改成「消耗點數」直接填這裡即可。 -->
        <span class="kai-cost" id="kai-cost-num"></span>
      </div>

      <div class="kai-results" id="kai-results" style="display:none">
        <div class="kai-results-head">
          <span id="kai-results-title">生成結果</span>
          <span style="font-family:'JetBrains Mono',monospace;font-size:10px;color:rgba(255,255,255,0.4);" id="kai-results-meta"></span>
        </div>
        <div class="kai-gallery" id="kai-gallery"></div>
        <div id="kai-status-area"></div>
      </div>
    </div>
  `;
}

function buildModalHTML() {
  return `
    <div class="kai-modal-wrap" id="kai-modal-wrap">
      <div class="kai-modal">
        <h3>建立 KOL 角色</h3>
        <div class="sub">
          <!-- 🩹 2026-08-23:舊文案印的是 Google 雲端硬碟路徑 /KOL/{品牌}/,
               但照片從 v4.45 起就直接存進自家素材庫,那條路徑早就不存在。
               (updateFolderHint 8/22 已改,這裡是漏網的第二處。) -->
          這位角色的照片會收進本品牌的素材庫。<br>
          名字請用純個人名(例如「柚子」「小晴」),不要加品牌字樣。
        </div>
        <input class="kai-input" id="kai-new-name" type="text"
          placeholder="輸入新 KOL 名字" maxlength="20" style="margin-bottom:0" />
        <div class="kai-modal-foot">
          <button class="kai-btn-ghost" id="kai-modal-cancel">取消</button>
          <button class="kai-btn-primary" id="kai-modal-confirm">✅ 建立</button>
        </div>
      </div>
    </div>
  `;
}

function renderOptions(map, defaultKey) {
  return Object.entries(map).map(([k, v]) =>
    `<option value="${k}"${k === defaultKey ? ' selected' : ''}>${escapeHtml(v)}</option>`
  ).join('');
}

// ── 事件綁定 ──────────────────────────────────────────────
function bindEvents() {
  // 品牌切換監聽(監聽 kol.html 原生切換)
  document.getElementById('kai-btn-new-persona')?.addEventListener('click', openNewPersonaModal);
  document.getElementById('kai-modal-cancel')?.addEventListener('click', closeModal);
  document.getElementById('kai-modal-confirm')?.addEventListener('click', confirmNewPersona);

  document.getElementById('kai-persona')?.addEventListener('change', onPersonaChange);

  // Prompt 自動重算
  document.querySelectorAll('.kai-param').forEach(el => {
    el.addEventListener('change', renderPromptPreview);
  });

  // ✨ v3.34 選好人設 → 自動帶入神韻,客戶不用自己想該寫什麼。
  //   ⚠️ 只有在「客戶沒有自己改過」時才覆蓋 —— 他打了字就是他的決定,
  //      切個下拉選單就把他寫的東西洗掉,是很惱人的體驗。
  const _vibeEl = document.getElementById('kai-free-text');
  const _personaSel = document.querySelector('.kai-param[data-k="persona"]');
  if (_vibeEl && _personaSel) {
    const _applyVibe = function (force) {
      const v = KAI_VIBE[_personaSel.value] || '';
      if (!v) return;
      if (force || !_vibeEl.value.trim() || _vibeEl.dataset.auto === '1') {
        _vibeEl.value = v;
        _vibeEl.dataset.auto = '1';
        renderPromptPreview();
      }
    };
    _personaSel.addEventListener('change', function () { _applyVibe(false); });
    // 客戶自己動手改 → 從此不再自動覆蓋
    _vibeEl.addEventListener('input', function () { this.dataset.auto = ''; });
    _applyVibe(true);          // 面板一開就先帶好預設
  }
  // 🆕 v3.32 年齡拉桿:拖動時即時更新數字 + 未成年確認框連動。
  //   ⚠️ range 要聽 'input' 不是 'change' —— 只聽 change 會等到放開滑鼠才更新,
  //      拖的過程中數字不動,使用者會以為壞掉。
  const _ageEl = document.querySelector('.kai-age-range');
  if (_ageEl) {
    const _syncAge = () => {
      const n = parseInt(_ageEl.value, 10) || 26;
      const numEl = document.getElementById('kai-age-num');
      if (numEl) numEl.textContent = n;
      const box = document.getElementById('kai-minor-box');
      if (box) {
        const wasHidden = box.style.display === 'none';
        box.style.display = (n < 18) ? '' : 'none';
        // 從未成年切回成年 → 把勾選清掉,免得下次又偷偷帶著上次的同意
        if (n >= 18) { const c = document.getElementById('kai-minor-ok'); if (c) c.checked = false; }
        void wasHidden;
      }
      renderPromptPreview();
    };
    _ageEl.addEventListener('input', _syncAge);
    _syncAge();
  }
  document.getElementById('kai-free-text')?.addEventListener('input', debounce(renderPromptPreview, 400));
  document.getElementById('kai-edit-prompt')?.addEventListener('click', toggleManualPrompt);

  // Advanced panel
  document.getElementById('kai-adv-head')?.addEventListener('click', () => {
    document.getElementById('kai-adv').classList.toggle('open');
  });

  // 張數變化 → 重算成本
  document.getElementById('kai-num')?.addEventListener('change', updateCostEstimate);

  // Seed 鎖定
  document.getElementById('kai-seed-lock')?.addEventListener('click', toggleSeedLock);
  // 🆕 手打/清空 seed 時即時刷新標籤(別再卡在「未鎖」騙人)
  document.getElementById('kai-seed')?.addEventListener('input', refreshSeedLockLabel);

  // 主按鈕
  document.getElementById('kai-btn-gen')?.addEventListener('click', generate);

  // 新 persona modal Enter 鍵提交
  document.getElementById('kai-new-name')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') confirmNewPersona();
  });
}

function hookBrandSwitcher() {
  // 監聽 kol.html 原生的品牌切換器
  const brandSwitcher = document.getElementById('brand-switcher');
  if (!brandSwitcher) {
    // 可能還沒載入,等一下重試
    setTimeout(hookBrandSwitcher, 500);
    return;
  }

  brandSwitcher.addEventListener('change', async () => {
    const brandId = brandSwitcher.value;
    S.currentBrandId = brandId;
    S.currentPersonaName = '';
    await syncBrandAndLoadPersonas(brandId);
    applyBrandDefaults(brandId);
    renderPromptPreview();
  });

  // v3.17: 立即同步一次,並每 0.8 秒自我校正
  // 修:若使用者「先選品牌、AI 生人像才載入」,會漏接那次切換 → 永遠卡「先選品牌」。
  // 改成自動跟上面的品牌對一下,不一致就自己補上。
  ensureBrandSynced();
  setInterval(ensureBrandSynced, 800);
}

// v3.17: 自我校正 — 把 AI 生人像的品牌追上上面的「當前品牌」選擇器
function ensureBrandSynced() {
  const bs = document.getElementById('brand-switcher');
  if (!bs || !bs.value) return;
  if (bs.value !== S.currentBrandId) {
    S.currentBrandId = bs.value;
    S.currentPersonaName = '';
    syncBrandAndLoadPersonas(bs.value);
    applyBrandDefaults(bs.value);
    if (typeof renderPromptPreview === 'function') renderPromptPreview();
  }
}

async function syncBrandAndLoadPersonas(brandId) {
  const personaSel = document.getElementById('kai-persona');
  if (!personaSel) return;

  if (!brandId) {
    personaSel.innerHTML = '<option value="">— 先選品牌 —</option>';
    personaSel.style.color = '';
    updateFolderHint();
    return;
  }

  personaSel.innerHTML = '<option value="">載入中...</option>';
  personaSel.style.color = '';

  try {
    const res = await gasGet('getKolPersonas', { brandId });
    S.personas = res.personas || [];

    if (S.personas.length === 0) {
      personaSel.innerHTML = '<option value="" style="color:#ff6b6b">尚未創建KOL</option>';
      personaSel.style.color = '#ff6b6b';   // 紅字警示:這是待辦事項,不是普通選項
    } else {
      personaSel.style.color = '';
      personaSel.innerHTML = '<option value="">— 選擇角色 —</option>' +
        S.personas.map(p =>
          `<option value="${escapeHtml(p.persona_name)}">${escapeHtml(p.persona_name)}</option>`
        ).join('');
    }
    updateFolderHint();
  } catch (e) {
    console.error('[kai] loadPersonas failed:', e);
    personaSel.innerHTML = '<option value="" style="color:#ff6b6b">載入失敗</option>';
    personaSel.style.color = '#ff6b6b';
  }
}

function applyBrandDefaults(brandId) {
  const defaults = BRAND_DEFAULTS[brandId];
  if (!defaults) return;

  document.querySelectorAll('.kai-param').forEach(el => {
    const k = el.dataset.k;
    if (defaults[k]) el.value = defaults[k];
  });
}

function onPersonaChange() {
  S.currentPersonaName = document.getElementById('kai-persona').value;
  updateFolderHint();
}

function updateFolderHint() {
  const hint = document.getElementById('kai-folder-hint');
  if (!hint) return;

  const brandId = S.currentBrandId;
  const persona = S.currentPersonaName;
  const brand = S.brands.find(b => b.id === brandId);
  const brandName = brand?.name || brandId || '(未選)';

  // 還沒選到角色 → 整條不顯示(路徑對客戶沒意義,而且會露出內部術語)
  //   選好角色後才顯示,那時它是有用的資訊:檔案會存到哪。
  if (!brandId || !persona) {
    hint.style.display = 'none';
    hint.textContent = '';
    return;
  }
  hint.style.display = '';
  // ⚠️ 2026-08-22:舊文案印的是 Google 雲端硬碟的資料夾路徑。
  //   照片從 v4.45 起就直接存進自家素材庫了,那條路徑早就不存在。
  hint.textContent = '將存進素材庫 · KOL · ' + persona;
}

// ── 新 Persona Modal ──────────────────────────────────────
function openNewPersonaModal() {
  ensureBrandSynced();
  if (!S.currentBrandId) {
    alert('請先選品牌');
    return;
  }
  document.getElementById('kai-new-name').value = '';
  document.getElementById('kai-modal-wrap').classList.add('open');
  setTimeout(() => document.getElementById('kai-new-name')?.focus(), 100);
}

function closeModal() {
  document.getElementById('kai-modal-wrap').classList.remove('open');
}

async function confirmNewPersona() {
  const name = document.getElementById('kai-new-name').value.trim();
  if (!name) {
    alert('請輸入 KOL 名字');
    return;
  }
  if (name.length > 20) {
    alert('名字請在 20 字以內');
    return;
  }
  // 避免特殊字元(Drive 資料夾限制)
  if (/[\/\\:*?"<>|]/.test(name)) {
    alert('名字不能包含 / \\ : * ? " < > | 這些符號');
    return;
  }

  const btn = document.getElementById('kai-modal-confirm');
  btn.disabled = true;
  btn.textContent = '建立中...';

  try {
    const res = await gasPost('ensurePersonaFolder', {
      brandId: S.currentBrandId,
      personaName: name,
    });

    if (!res.ok) throw new Error(res.error || '建立失敗');

    // 重新載入 persona 列表
    await syncBrandAndLoadPersonas(S.currentBrandId);

    // 自動選中新建的
    const personaSel = document.getElementById('kai-persona');
    // 如果 getKolPersonas 還沒收到(因為 persona 還沒存進 Sheet,只是建了資料夾),
    // 手動塞一個選項
    if (!Array.from(personaSel.options).find(o => o.value === name)) {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name + ' (新建)';
      personaSel.appendChild(opt);
    }
    personaSel.value = name;
    S.currentPersonaName = name;
    updateFolderHint();

    closeModal();
    showStatus('✅ 已建立角色「' + name + '」', 'ok');   // 🩹 2026-08-23:拿掉「資料夾」(Google 雲端時代的說法)
  } catch (e) {
    alert('❌ 建立失敗:' + e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = '✅ 建立';
  }
}

// ── Prompt 合成 ────────────────────────────────────────────
let _manualPromptMode = false;
let _manualPromptValue = '';

function toggleManualPrompt() {
  const preview = document.getElementById('kai-prompt-preview');
  const link = document.getElementById('kai-edit-prompt');
  if (!_manualPromptMode) {
    // 切換到手動編輯
    _manualPromptMode = true;
    _manualPromptValue = buildPrompt();
    preview.contentEditable = 'true';
    preview.textContent = _manualPromptValue;
    preview.style.cursor = 'text';
    preview.style.outline = '1px solid #7c6dfa';
    link.textContent = '自動合成';
    preview.focus();
  } else {
    _manualPromptMode = false;
    _manualPromptValue = preview.textContent;
    preview.contentEditable = 'false';
    preview.style.cursor = 'default';
    preview.style.outline = 'none';
    link.textContent = '手動編輯';
    renderPromptPreview();
  }
}

function buildPrompt() {
  const params = {};
  document.querySelectorAll('.kai-param').forEach(el => {
    params[el.dataset.k] = el.value;
  });

  const freeText = document.getElementById('kai-free-text')?.value.trim() || '';

 // 攝影級品牌:用品牌「名字」判斷(避免代號對不上)。LACEZ 等精緻品牌走 editorial,其餘走素人 candid
  const _brand = S.brands.find(b => b.id === S.currentBrandId);
  const _brandName = ((_brand && _brand.name) || '').toUpperCase();
  const EDITORIAL_BRANDS = ['LACEZ', 'MOZ'];
  const mode = EDITORIAL_BRANDS.some(n => _brandName.includes(n)) ? 'editorial' : 'candid';
  // 🆕 v3.32:年齡若是數字(拉桿)→ 走新路;仍是舊 key(young/kid…)→ 完全照舊,不影響既有角色
  const _age = ageClause(params.age, params.gender);
  let prompt = (BACKBONES[mode] || BACKBONES.candid)
    .replace('{AGE}', _age ? _age.phrase : (AGE_MAP[params.age] || AGE_MAP.standard))
    .replace(/\{NATIONALITY\}/g, NATIONALITY_MAP[params.nationality] || NATIONALITY_MAP.tw)
    .replace('{GENDER}', _age ? _age.noun : (params.age === 'kid' ? (params.gender === 'male' ? 'boy' : 'girl') : (GENDER_MAP[params.gender] || GENDER_MAP.female)))
    .replace('{PERSONA}', PERSONA_MAP[params.persona] || PERSONA_MAP.girl_next_door)
    .replace('{LIGHTING}', LIGHTING_MAP[params.lighting] || LIGHTING_MAP.window_day)
    .replace('{OUTFIT}', OUTFIT_MAP[params.outfit] || OUTFIT_MAP.beige_knit)
    .replace('{SCENE}', SCENE_MAP[params.scene] || SCENE_MAP.apartment);

// v3.18: Korean 反 K-beauty 防護 ──
  //  flux 對「Korean」的訓練資料壓倒性是 K-beauty 玻璃肌/偶像,會把臉拉向塑膠網美。
  //  只針對 kr 做平衡:加普通人錨點 + 拔掉 "authentic Korean aesthetic" 尾巴。
  //  不動 PROMPT_BACKBONE,不影響台/日 KOL。
if (params.nationality === 'kr') {
    prompt = prompt.replace(', authentic Korean aesthetic', '');
    if (mode === 'candid') {
      prompt = prompt
        .replace('Korean woman', 'Korean woman with a plain ordinary everyday face, not a model')
        .replace('Korean man', 'Korean man with a plain ordinary everyday face, not a model');
    }
  }

  if (freeText) {
    prompt += ', ' + freeText;
  }

  // 🆕 v3.36:臉部四道防呆。
  //   位置在【年齡特徵之前】—— 年齡特徵必須留在更後面壓過模型的
  //   「畫年輕」傾向(見下方 v3.32 註解),而這四道是結構性要求,
  //   擺這裡兩者都保得住。
  //   FACE_GUARD 先於 EYE_GUARD:先把幾何講清楚(兩眼對齊)再談生命感;
  //   順序反過來,「對齊」會被一長串眼神描述稀釋,容易變回鬥雞眼。
  prompt += ', ' + FACE_GUARD + ', ' + EYE_GUARD;

  // 🆕 v3.32 年齡特徵接在最後(自由補充之後)——
  //   放最後是刻意的:老化特徵必須壓過前面的通用「年輕漂亮」傾向,
  //   放前面會被後面的形容詞稀釋掉,50 歲又被畫回 30 歲。
  if (_age) {
    prompt += ', ' + _age.traits;
    // ⚠️ 未成年保護詞放「最最後」,任何設定都不能覆蓋它
    if (_age.minor) prompt += ', ' + MINOR_GUARD;
  }

  return prompt;
}

// 🆕 v3.32 未成年閘門:未滿 18 且沒勾確認 → 回 false
function minorGateOk() {
  try {
    const el = document.querySelector('.kai-age-range');
    if (!el) return true;                       // 還是舊下拉 → 不擋(維持既有行為)
    const n = parseInt(el.value, 10);
    if (!isFinite(n) || n >= 18) return true;
    const c = document.getElementById('kai-minor-ok');
    return !!(c && c.checked);
  } catch (e) { return true; }                  // 判斷不出來就不擋,避免擋死正常客戶
}

function renderPromptPreview() {
  if (_manualPromptMode) return;
  const prompt = buildPrompt();
  S.lastPrompt = prompt;
  const preview = document.getElementById('kai-prompt-preview');
  if (preview) preview.textContent = prompt;
}

function updateCostEstimate() {
  // 🚫 2026-08-14:不再對客戶顯示美金成本(那是進價,不是售價)。
  //   函式保留不刪 —— 它有兩個呼叫點(初始化 + 張數改變),
  //   直接刪掉會噴 ReferenceError 讓整個面板掛掉。
  //   之後要顯示「消耗點數」時,改這裡就好,呼叫點不用動。
  const el = document.getElementById('kai-cost-num');
  if (el) el.textContent = '';
}

// ── Seed 鎖定 ──────────────────────────────────────────────
// 🆕 依輸入框內容刷新標籤:有 seed 值=會沿用、空=未鎖(手動鎖了不動)
function refreshSeedLockLabel() {
  const input = document.getElementById('kai-seed');
  const lock  = document.getElementById('kai-seed-lock');
  if (!input || !lock) return;
  if (lock.classList.contains('locked')) return; // 手動鎖了維持「✓ 已鎖」
  const v = input.value.trim();
  lock.textContent = (v && /^\d+$/.test(v)) ? '🔒 會沿用' : '未鎖';
}
function toggleSeedLock() {
  const input = document.getElementById('kai-seed');
  const lock = document.getElementById('kai-seed-lock');
  const v = input.value.trim();

  if (lock.classList.contains('locked')) {
    lock.classList.remove('locked');
    S.lockedSeed = null;
    refreshSeedLockLabel();   // 🆕 解鎖後依輸入框內容顯示(空=未鎖、有值=會沿用)
  } else {
    if (!v) {
      alert('Seed 輸入框是空的,先輸入 seed 數字再鎖');
      return;
    }
    if (!/^\d+$/.test(v)) {
      alert('Seed 必須是整數');
      return;
    }
    lock.classList.add('locked');
    lock.textContent = '✓ 已鎖';
    S.lockedSeed = parseInt(v);
  }
}

// ── 核心:生成 ─────────────────────────────────────────────
async function generate() {
  // 參數檢查
  ensureBrandSynced();
  if (!S.currentBrandId) {
    alert('請先選品牌');
    return;
  }
  if (!S.currentPersonaName) {
    alert('請先選擇或建立 KOL 角色');
    return;
  }
  // 🆕 v3.32 未成年閘門:沒勾確認就不准生成。
  //   放在最前面、擋在扣點之前 —— 這是不可逆的兒少風險,不能事後補救。
  if (!minorGateOk()) {
    alert('這位角色未滿 18 歲。\n請先勾選上方的確認框,再開始生成。');
    const _b = document.getElementById('kai-minor-box');
    if (_b) _b.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  const prompt = _manualPromptMode
    ? document.getElementById('kai-prompt-preview').textContent.trim()
    : buildPrompt();

  if (!prompt) {
    alert('Prompt 為空');
    return;
  }

  const numImages = parseInt(document.getElementById('kai-num').value);
  const ratio = document.getElementById('kai-ratio').value;
  const safety = document.getElementById('kai-safety').value;
  const raw = document.getElementById('kai-raw').value === 'true';

  const payload = {
    prompt,
    aspect_ratio: ratio,
    num_images: numImages,
    safety_tolerance: safety,
    output_format: 'jpeg',
    raw,
    enable_safety_checker: true,
  };

  const seedInput = document.getElementById('kai-seed').value.trim();
  if (S.lockedSeed !== null) {
    payload.seed = S.lockedSeed;
  } else if (seedInput && /^\d+$/.test(seedInput)) {
    payload.seed = parseInt(seedInput);
  }

  // UI 狀態
  S.generating = true;
  const btn = document.getElementById('kai-btn-gen');
  btn.disabled = true;
  btn.innerHTML = '<span class="kai-spinner"></span> 生成中...';

  const results = document.getElementById('kai-results');
  const gallery = document.getElementById('kai-gallery');
  const meta = document.getElementById('kai-results-meta');
  const statusArea = document.getElementById('kai-status-area');

  results.style.display = 'block';
  gallery.innerHTML = '<div class="kai-empty" style="grid-column:1/-1"><span class="emoji">⏳</span>生成中,預計 10-25 秒...</div>';
  statusArea.innerHTML = '';
  meta.textContent = '';

  const t0 = performance.now();
  try {
    // v3.16: 改走 Cloudflare proxy(action=fal_image_submit),金鑰留後端
    const res = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(_withAuth({
        password: PASSWORD,
        action: 'fal_image_submit',
        ...payload,
      })),
    });

    const latency = ((performance.now() - t0) / 1000).toFixed(1);
    const data = await res.json();

    if (!data.ok) {
      throw new Error(data.error || ('HTTP ' + res.status));
    }

    if (!data.images || data.images.length === 0) {
      throw new Error('回應無 images');
    }

    S.lastImages = data.images.map((img, i) => ({
      ...img,
      seed: data.seed,
      nsfw: Array.isArray(data.has_nsfw_concepts) ? data.has_nsfw_concepts[i] : false,
      saved: false,
      driveFileId: null,
    }));

    renderGallery();

    // 自動填 seed 到輸入框
    const seedInp = document.getElementById('kai-seed');
    if (data.seed != null) {
      seedInp.value = data.seed;
      refreshSeedLockLabel();   // 🆕 自動填 seed 後標籤改「🔒 會沿用」,不再卡「未鎖」
    }

    meta.textContent = data.images.length + ' 張 · seed=' + data.seed + ' · ' + latency + 's';
    showStatus('✅ 生成完成,挑一張點「選這張」', 'ok');

  } catch (e) {
    console.error('[kai] generate failed:', e);
    gallery.innerHTML = '';
    showStatus('❌ 生成失敗:' + e.message, 'err');
  } finally {
    S.generating = false;
    btn.disabled = false;
    btn.innerHTML = '生成 AI KOL';
  }
}

function renderGallery() {
  const gallery = document.getElementById('kai-gallery');
  if (!gallery) return;

  gallery.innerHTML = S.lastImages.map((img, i) => {
    const nsfw = img.nsfw ? '<div style="position:absolute;top:6px;right:6px;background:rgba(250,109,155,0.85);color:#fff;padding:2px 6px;border-radius:4px;font-size:9px;font-weight:700;">NSFW</div>' : '';
    return `
      <div class="kai-img-card${img.saved ? ' picked' : ''}" data-idx="${i}">
        <div class="kai-img-thumb" data-act="zoom" data-idx="${i}" title="點擊放大看原圖">
          <span class="kai-img-idx">#${i + 1}</span>
          ${nsfw}
          <img src="${escapeHtml(img.url)}" alt="AI KOL ${i + 1}" loading="lazy" />
        </div>
        <div class="kai-img-actions">
          <button class="kai-img-btn${img.saved ? ' saved' : ''}" data-act="save" data-idx="${i}"
            ${img.saved ? 'disabled' : ''}>
            ${img.saved ? '✅ 已選用' : '✓ 選這張'}
          </button>
        </div>
      </div>
    `;
  }).join('');

  // 綁定:點圖放大 + 選用存檔
  gallery.querySelectorAll('[data-act]').forEach(el => {
    el.addEventListener('click', handleImgAction);
  });
}

async function handleImgAction(e) {
  const act = e.currentTarget.dataset.act;
  const idx = parseInt(e.currentTarget.dataset.idx);
  const img = S.lastImages[idx];
  if (!img) return;

  if (act === 'zoom') {
    openLightbox(img.url);
    return;
  }

  if (act === 'save') {
    await saveKolImageToLibrary(idx);
  }
}

function openLightbox(url) {
  let box = document.getElementById('kai-lightbox');
  if (!box) {
    box = document.createElement('div');
    box.id = 'kai-lightbox';
    box.className = 'kai-lightbox';
    box.innerHTML = '<span class="kai-lightbox-close" title="關閉 (Esc)">✕</span><img alt="原圖預覽" />';
    box.addEventListener('click', (e) => {
      if (e.target.tagName !== 'IMG') box.classList.remove('open');
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') box.classList.remove('open');
    });
    document.body.appendChild(box);
  }
  box.querySelector('img').src = url;
  box.classList.add('open');
}
// 2026-08-22 v4.45:落地點從 Google 雲端硬碟改成自家倉庫。
//   ★ 舊名 saveImageToDrive 已改名 —— 名字要說實話,
//     不然三個月後看到「Drive」會以為還在存 Google。
//   ★ 存完會自動寫進素材庫(category='KOL'),KOL 照片庫立刻看得到。
async function saveKolImageToLibrary(idx) {
  const img = S.lastImages[idx];
  if (!img) return;
  if (img.saved) return;

  if (!S.currentBrandId || !S.currentPersonaName) {
    alert('尚未選擇品牌或 KOL 角色');
    return;
  }

  const btn = document.querySelector(`.kai-img-btn[data-act="save"][data-idx="${idx}"]`);
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="kai-spinner" style="border-top-color:#7c6dfa;"></span> 存中';
  }

  const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const filename = S.currentPersonaName + '_ai_' + img.seed + '_' + timestamp + '_' + (idx + 1) + '.jpg';

  // 把創角選的服裝一起存進 persona(以後免手填 outfit)
  const _outfitSel = document.querySelector('.kai-param[data-k="outfit"]');
  const _outfitText = _outfitSel ? (OUTFIT_MAP[_outfitSel.value] || '') : '';

  try {
    const res = await gasPost('saveKolPhoto', {
      brandId: S.currentBrandId,
      personaName: S.currentPersonaName,
      imageUrl: img.url,
      filename,
      outfit: _outfitText,
      metadata: {
        seed: img.seed,
        source: 'flux_1.1_pro_ultra',
        prompt: S.lastPrompt.slice(0, 500),
        generated_at: new Date().toISOString(),
        index: idx + 1,
      },
    });

    if (!res.ok) throw new Error(res.error || '儲存失敗');

    img.saved = true;
    img.driveFileId = res.file_id;
    renderGallery();

    showStatus('✅ 已存進雲端倉庫:' + res.filename + ' — 左欄 Gallery 請點「重新載入」', 'ok');

    // 嘗試自動刷新左欄(如果 kol.html 有暴露)
    if (typeof window.refreshAll === 'function') {
      try {
        await window.refreshAll();
      } catch (e) {
        console.warn('[kai] auto refresh failed:', e);
      }
    }

  } catch (e) {
    console.error('[kai] 存進雲端倉庫失敗:', e);
    showStatus('❌ 存檔失敗:' + e.message, 'err');
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '✓ 選這張';
    }
  }
}

function showStatus(msg, type) {
  const area = document.getElementById('kai-status-area');
  if (!area) return;
  area.innerHTML = `<div class="kai-status ${type}">${escapeHtml(msg)}</div>`;
  if (type === 'ok') {
    setTimeout(() => {
      if (area.innerHTML.includes(msg)) area.innerHTML = '';
    }, 6000);
  }
}

// ── API helpers ───────────────────────────────────────────
// 🆕 韌性核心:GAS 抽風自動重試(指數退避 + jitter)。
//    傳輸/解析失敗 + 假性「密碼錯誤」→ 重試;真正業務 ok:false → 直接回不重試。
async function gasFetch(doFetch, action) {
  function wait(attempt) {
    const base = [600, 1500, 3500][attempt - 1];
    const jitter = Math.floor(Math.random() * 400); // 打散多客戶同時重試
    return new Promise(r => setTimeout(r, base + jitter));
  }
  let lastErr;
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) await wait(attempt);
    try {
      const res = await doFetch();
      if (!res.ok) throw new Error('GAS_HTTP_' + res.status);
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); }
      catch (_) { throw new Error('GAS_NON_JSON'); }
      if (data && data.ok === false && data.error === '密碼錯誤') throw new Error('GAS_FALSE_PWD');
      return data;
    } catch (e) {
      lastErr = e;
      console.warn('[kai] GAS ' + action + ' 第 ' + (attempt + 1) + ' 次失敗:' + e.message);
    }
  }
  const err = new Error('系統忙碌中,請稍候再試');
  err.code = 'GAS_UNAVAILABLE';
  throw err;
}

// 🆕 第2期補漏:讀取分流走 Worker(D1 毫秒級 + KV 快取 + GAS 抽風出陳貨)。
//    這支檔原本自己直打 GAS,繞過了 kol.html 早就鋪好的分流 → 客戶會吃到 GAS_HTTP_404 重試等待。
//    白名單只列「Worker gas_cached ALLOW 有的唯讀 action」;Worker 有任何問題會自動落回下方直打 GAS 原路
//    (含既有 gasFetch 重試),最壞行為跟改造前完全一樣。
//    ⚠️ 寫入類永遠不准列進來(會被快取 → 重複下單/重複扣點)。
const GAS_CACHED_READS = { getBrandOS: 1, getKolPersonas: 1 };
async function gasGet(action, params = {}) {
  if (GAS_CACHED_READS[action]) {
    try {
      const r = await fetch(WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(_withAuth({ action: 'gas_cached', password: PASSWORD, gasAction: action, gasParams: params })),
      });
      const out = await r.json();
      if (out && out.ok !== false) return out;   // fresh / miss / stale 都是可用資料
    } catch (_) { /* Worker 連不上 → 落回原路 */ }
  }
  const qs = new URLSearchParams({ action, password: PASSWORD, ...params }).toString();
  return gasFetch(() => fetch(GAS_URL + '?' + qs), action);
}

// ═══════════════════════════════════════════════════════════════
//  🚚 2026-08-12 寫入改走 Worker(照抄 kol.html 的 WRITE_VIA_WORKER 寫法)
//
//  為什麼一定要搬:GAS 整個 Google 帳號同時只能跑 30 個執行,是硬上限。
//    ensurePersonaFolder 是「每建一個 KOL 就觸發一次」的高頻動作,
//    人一多就會跟生影片、生圖搶那 30 個名額 —— 而且塞車時不報錯,
//    只是轉圈圈轉到逾時,客戶會以為系統壞了。Worker 沒有這個限制。
//
//  ⚠️ kol.html 的 WRITE_VIA_WORKER 早在 2026-08-06 就把 ensurePersonaFolder
//     切過去了,但這支檔案漏接,一直還在直撥 GAS —— 同一個動作兩條路。
//
//  ⚠️ 讀取類永遠不准列進來(那是 GAS_CACHED_READS 的事)。
//     寫入類也不准放進快取,會造成重複建立。
// ═══════════════════════════════════════════════════════════════
const WRITE_VIA_WORKER = {
  ensurePersonaFolder: 1,          // Drive 建 KOL 資料夾(kol.html 同步)
  // 🚚 2026-08-13:一鍵存 Drive 也切過來(Worker v4.14 補上這支寫入器)。
  //   ⚠️ Worker 端已把它列進 NO_GAS_MIRROR —— 若讓它照常回寫 GAS,
  //      GAS 會把同一張圖再存一次到同一個資料夾(跟 saveAiImage 同款地雷)。
  //   🚚 2026-08-22:Worker v4.45 起這支已改寫進自家倉庫,不再碰 Google。
  //      新名 saveKolPhoto 才是誠實的名字;舊名先留著,
  //      因為 kol-character-sheet.js 還在用它 —— 那支改完再讓舊名退休。
  saveAiKolPhotoToDrive: 1,
  saveKolPhoto: 1,
};

async function gasPost(action, extra = {}) {
  if (WRITE_VIA_WORKER[action]) {
    const r = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(_withAuth({ password: PASSWORD, action: 'gas_write', gasAction: action, payload: extra })),
    });
    return r.json();
  }
  return gasFetch(() => fetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action, password: PASSWORD, ...extra }),
    redirect: 'follow',
  }), action);
}

// ── 同步載入 brands(給 folder hint 顯示品牌中文名)──
(async function preloadBrands() {
  try {
    // ⚠️ getBrandOS 一定要帶 email —— 後端靠它做品牌隔離,沒帶會回空清單
    //   而且 ok:true 不報錯(所以「品牌中文名顯示不出來」一直查不到原因)。
    const res = await gasGet('getBrandOS', { email: localStorage.getItem('bs_sso_email') || '' });
    S.brands = res.data?.brands || [];
    updateFolderHint();
  } catch (e) {
    console.warn('[kai] preloadBrands failed:', e);
  }
})();

// ── 工具 ──────────────────────────────────────────────────
function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function debounce(fn, ms) {
  let t;
  return function(...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), ms);
  };
}

// 🆕 v3.29:對外暴露配方 + 連線 + 狀態,給 kol-character-sheet.js(多角度人物表)共用,單一真相來源
window.KAI = {
  GENDER_MAP, AGE_MAP, NATIONALITY_MAP, PERSONA_MAP, OUTFIT_MAP,
  WORKER_URL, PASSWORD, S,
  gasPost, GAS_URL,
  getParams: function () {
    var p = {};
    document.querySelectorAll('.kai-param').forEach(function (el) { p[el.dataset.k] = el.value; });
    p.freeText = (document.getElementById('kai-free-text') ? document.getElementById('kai-free-text').value : '').trim();
    return p;
  },
};

})();
