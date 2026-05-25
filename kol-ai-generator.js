/* ═══════════════════════════════════════════════════════════════
 *  Brand OS · KOL AI 人像生成器(Tab 3 Phase 1)
 *  v3.17 · 2026-05-25  (= 昨天 v3.16 代理版 + 今天品牌同步修補)
 *
 *  功能:
 *   • 選品牌 + 選/新增 Persona + 人設參數(中文下拉)
 *   • 反 AI 美學 prompt 自動合成(真人感配方)
 *   • fal.ai Flux 1.1 Pro Ultra 串接(走 Cloudflare proxy,金鑰留後端)
 *   • 3 張結果挑臉 + Seed 鎖定
 *   • 一鍵存 Drive(走新 GAS action saveAiKolPhotoToDrive)
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
// 骨幹模板(所有情境共用的「真人感」基底)
const BACKBONES = {
  // 素人 candid:生活感、有瑕疵、親切(食品/生活類/又晴)
  candid:
    'Casual unretouched iPhone 15 Pro portrait photo of {AGE} {NATIONALITY} {GENDER}, ' +
    '{PERSONA}, ' +
    'mostly matte skin with only a little natural T-zone shine, real visible pores and uneven skin texture, ' +
    'natural sub-surface scattering, fine vellus peach fuzz, subtle skin imperfections and faint freckles, ' +
    'slight asymmetry in face, natural minimal makeup, ' +
    'realistic hair with a few loose flyaway strands and slight natural frizz, individual unstyled hair strands, ' +
    '{LIGHTING}, wearing {OUTFIT}, {SCENE}, ' +
    'amateur candid unposed snapshot feel, raw unedited photo, ' +
    'authentic {NATIONALITY} aesthetic',

  // 攝影級 editorial:美但真、棚拍、真實皮膚物理(內衣/美妝/Misaki)
  editorial:
    'Professional editorial studio portrait photograph of {AGE} {NATIONALITY} {GENDER}, ' +
    '{PERSONA}, ' +
    'beautiful but completely real skin with fine pores and visible micro-texture across the whole face, natural sub-surface scattering, ' +
    'bare matte complexion with an even soft finish and only very faint natural shine, slightly uneven real skin tone, light natural makeup, realistic catchlights in the eyes, ' +
    'slight natural asymmetry, natural hair with loose flyaway strands, individual real hairs and slight frizz, ' +
    'soft flat evenly-diffused light spread gently across the whole face, no hot shiny highlights on the nose or cheekbones, shallow depth of field, shot on medium format with an 85mm f/1.4 lens, ' +
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
};

const NATIONALITY_MAP = {
  tw: 'Taiwanese',
  jp: 'Japanese',
  kr: 'Korean',
  jpmix: 'Japanese-Taiwanese mixed',
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
};

const LIGHTING_MAP = {
  window_day:  'natural daylight from a window, overcast soft diffused lighting',
  cafe_side:   'golden hour side light from cafe window, warm amber tones',
  studio_flat: 'soft studio light with gentle directional shadows that reveal skin texture',
  outdoor_day: 'natural outdoor afternoon sunlight, slight lens flare',
  indoor_warm: 'warm indoor tungsten lighting, cozy ambient mood',
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
};

const SCENE_MAP = {
  apartment:  'sitting casually in a lived-in minimalist apartment, a houseplant and soft furniture slightly out of focus behind, shot from a natural candid angle, 35mm documentary feel, real depth of field',
  cafe:       'at a cafe window seat with a coffee cup and a few everyday things on the wooden table, blurred street greenery through the window, candid unposed moment, 35mm documentary feel',
  studio:     'in a calm Japandi-style room with soft natural window light, simple wooden furniture softly out of focus behind, relaxed candid feel',
  outdoor_city: 'on a quiet city street with blurred shopfronts and passers-by behind, natural afternoon light, candid street-photography feel, 35mm',
  bedroom:    'relaxed on a bed with slightly rumpled linen sheets, soft morning light through the curtains, intimate candid snapshot of a real lived-in room',
  kitchen:    'in a cozy home kitchen, everyday utensils and ingredients softly out of focus on the counter behind, warm natural light, candid lifestyle moment',
  living_room: 'relaxed on a sofa in a lived-in living room with cushions and a throw blanket, soft warm lamp light, candid at-home moment',
  // ── v5.13 戶外場景 ──
  mountain:   'on a mountain trail with misty forest peaks behind, a little wind in the hair, candid hiking snapshot, natural outdoor light',
  campsite:   'at an outdoor campsite with tents and gear scattered around, warm golden hour light, candid relaxed moment',
};

// 中文顯示對應
const LABEL = {
  gender: {
    female: '女性',
    male:   '男性',
  },
  age: {
    young:    '22 歲青春',
    standard: '26 歲單身專業',
    mature:   '31 歲年輕媽媽',
    elder:    '37 歲熟齡知性',
  },
  nationality: {
    tw: '台灣',
    jp: '日本',
    kr: '韓國',
    jpmix: '日混台',
  },
  persona: {
    girl_next_door: '知性親和鄰家姐姐',
    professional:   '專業銳利職場',
    nordic_cool:    '北歐冷感模特',
    warm_mama:      '溫暖媽媽家居',
    sweet_college:  '甜美大學生',
    edgy_fashion:   '前衛時尚',
    outdoor_man:    '🏔 戶外型男(TNF感)',
    sporty_man:     '運動陽光男',
    pro_man:        '專業職場男',
    uncle_warm:     '親和大叔',
  },
  lighting: {
    window_day:  '室內日光',
    cafe_side:   '咖啡廳側光',
    studio_flat: '棚內平光',
    outdoor_day: '戶外午後',
    indoor_warm: '室內暖光',
  },
  outfit: {
    beige_knit:      '米色針織',
    white_tshirt:    '白色 T 恤',
    silk_blouse:     '絲質襯衫',
    oversized_shirt: '寬版襯衫',
    turtleneck:      '黑色高領',
    summer_dress:    '夏日洋裝',
    tech_jacket:     '🧥 機能外套(TNF)',
    flannel_shirt:   '格紋法蘭絨',
    mens_tshirt:     '男士素T',
    polo_shirt:      'POLO 衫',
  },
  scene: {
    apartment:    '簡約公寓',
    cafe:         '咖啡廳窗邊',
    studio:       'Japandi 棚',
    outdoor_city: '城市街頭',
    bedroom:      '臥室晨光',
    kitchen:      '🍳 居家廚房',
    living_room:  '🛋 客廳沙發',
    mountain:     '🏔 山林步道',
    campsite:     '🏕 戶外營地',
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
  console.log('[kol-ai-generator v3.21] 已載入');
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
  @media (max-width: 680px) {
    .kai-row, .kai-row-3 { grid-template-columns: 1fr; }
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
        <span class="kai-title">🎨 AI KOL 人像生成</span>
        <span class="kai-badge">Tab 3 · Phase 1</span>
      </div>

      <div class="kai-row-persona">
        <div class="kai-field">
          <label class="kai-label">目標 KOL (Persona)</label>
          <select class="kai-select" id="kai-persona">
            <option value="">— 先選品牌 —</option>
          </select>
        </div>
        <div style="display:flex;align-items:end;">
          <button class="kai-btn-add" id="kai-btn-new-persona">+ 新 KOL</button>
        </div>
      </div>

      <div class="kai-folder-hint" id="kai-folder-hint">
        📁 將存到:(請先選品牌和 Persona)
      </div>

      <div class="kai-row">
        <div class="kai-field">
          <label class="kai-label">性別</label>
          <select class="kai-select kai-param" data-k="gender">${genOpts}</select>
        </div>
        <div class="kai-field">
          <label class="kai-label">年齡</label>
          <select class="kai-select kai-param" data-k="age">${ageOpts}</select>
        </div>
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
          <label class="kai-label">光源場景</label>
          <select class="kai-select kai-param" data-k="lighting">${ligOpts}</select>
        </div>
        <div class="kai-field">
          <label class="kai-label">服裝</label>
          <select class="kai-select kai-param" data-k="outfit">${outOpts}</select>
        </div>
      </div>

      <div class="kai-row">
        <div class="kai-field">
          <label class="kai-label">場景背景</label>
          <select class="kai-select kai-param" data-k="scene">${scnOpts}</select>
        </div>
        <div class="kai-field"></div>
      </div>

      <div class="kai-field">
        <label class="kai-label">自由補充(中文,選填)</label>
        <textarea class="kai-textarea" id="kai-free-text"
          placeholder="例:眼神有故事感、嘴角微微上揚、戴珍珠耳環"></textarea>
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
          🎨 生成 AI KOL
        </button>
        <span class="kai-cost">
          預估 <span class="num" id="kai-cost-num">$0.18</span>
        </span>
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
        <h3>🆕 新增 AI KOL Persona</h3>
        <div class="sub">
          系統會在 <code style="color:#6dfac2;">/🎭 KOL/{品牌}/</code> 下建立新的子資料夾。<br>
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
    updateFolderHint();
    return;
  }

  personaSel.innerHTML = '<option value="">載入中...</option>';

  try {
    const res = await gasGet('getKolPersonas', { brandId });
    S.personas = res.personas || [];

    if (S.personas.length === 0) {
      personaSel.innerHTML = '<option value="">— 此品牌尚無 persona,點 + 新增 —</option>';
    } else {
      personaSel.innerHTML = '<option value="">— 選擇 persona —</option>' +
        S.personas.map(p =>
          `<option value="${escapeHtml(p.persona_name)}">${escapeHtml(p.persona_name)}</option>`
        ).join('');
    }
    updateFolderHint();
  } catch (e) {
    console.error('[kai] loadPersonas failed:', e);
    personaSel.innerHTML = '<option value="">載入失敗</option>';
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

  if (!brandId) {
    hint.textContent = '📁 將存到:(請先選品牌)';
  } else if (!persona) {
    hint.textContent = '📁 將存到:/🎭 KOL/' + brandName + '/(請選或新增 persona)';
  } else {
    hint.textContent = '📁 將存到:/🎭 KOL/' + brandName + '/' + persona + '/';
  }
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
    showStatus('✅ 已建立 persona「' + name + '」資料夾', 'ok');
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
  let prompt = (BACKBONES[mode] || BACKBONES.candid)
    .replace('{AGE}', AGE_MAP[params.age] || AGE_MAP.standard)
    .replace(/\{NATIONALITY\}/g, NATIONALITY_MAP[params.nationality] || NATIONALITY_MAP.tw)
    .replace('{GENDER}', GENDER_MAP[params.gender] || GENDER_MAP.female)
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

  return prompt;
}

function renderPromptPreview() {
  if (_manualPromptMode) return;
  const prompt = buildPrompt();
  S.lastPrompt = prompt;
  const preview = document.getElementById('kai-prompt-preview');
  if (preview) preview.textContent = prompt;
}

function updateCostEstimate() {
  const num = parseInt(document.getElementById('kai-num')?.value || '3');
  const cost = (num * COST_PER_IMAGE_USD).toFixed(2);
  const el = document.getElementById('kai-cost-num');
  if (el) el.textContent = '$' + cost;
}

// ── Seed 鎖定 ──────────────────────────────────────────────
function toggleSeedLock() {
  const input = document.getElementById('kai-seed');
  const lock = document.getElementById('kai-seed-lock');
  const v = input.value.trim();

  if (lock.classList.contains('locked')) {
    lock.classList.remove('locked');
    lock.textContent = '未鎖';
    S.lockedSeed = null;
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
    alert('請先選或新增 persona');
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
      body: JSON.stringify({
        password: PASSWORD,
        action: 'fal_image_submit',
        ...payload,
      }),
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
    }

    meta.textContent = data.images.length + ' 張 · seed=' + data.seed + ' · ' + latency + 's';
    showStatus('✅ 生成完成,挑一張點「📁 存 Drive」', 'ok');

  } catch (e) {
    console.error('[kai] generate failed:', e);
    gallery.innerHTML = '';
    showStatus('❌ 生成失敗:' + e.message, 'err');
  } finally {
    S.generating = false;
    btn.disabled = false;
    btn.innerHTML = '🎨 生成 AI KOL';
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

  // 綁定:點圖放大 + 存 Drive
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
    await saveImageToDrive(idx);
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
async function saveImageToDrive(idx) {
  const img = S.lastImages[idx];
  if (!img) return;
  if (img.saved) return;

  if (!S.currentBrandId || !S.currentPersonaName) {
    alert('品牌或 persona 未選');
    return;
  }

  const btn = document.querySelector(`.kai-img-btn[data-act="save"][data-idx="${idx}"]`);
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="kai-spinner" style="border-top-color:#7c6dfa;"></span> 存中';
  }

  const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const filename = S.currentPersonaName + '_ai_' + img.seed + '_' + timestamp + '_' + (idx + 1) + '.jpg';

  try {
    const res = await gasPost('saveAiKolPhotoToDrive', {
      brandId: S.currentBrandId,
      personaName: S.currentPersonaName,
      imageUrl: img.url,
      filename,
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

    showStatus('✅ 已存入 Drive:' + res.filename + ' — 👈 左欄 Gallery 請點「🔄 重新載入」', 'ok');

    // 嘗試自動刷新左欄(如果 kol.html 有暴露)
    if (typeof window.refreshAll === 'function') {
      try {
        await window.refreshAll();
      } catch (e) {
        console.warn('[kai] auto refresh failed:', e);
      }
    }

  } catch (e) {
    console.error('[kai] saveToDrive failed:', e);
    showStatus('❌ 存 Drive 失敗:' + e.message, 'err');
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '📁 存 Drive';
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
async function gasGet(action, params = {}) {
  const qs = new URLSearchParams({ action, password: PASSWORD, ...params }).toString();
  const res = await fetch(GAS_URL + '?' + qs);
  return res.json();
}

async function gasPost(action, extra = {}) {
  const res = await fetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action, password: PASSWORD, ...extra }),
    redirect: 'follow',
  });
  return res.json();
}

// ── 同步載入 brands(給 folder hint 顯示品牌中文名)──
(async function preloadBrands() {
  try {
    const res = await gasGet('getBrandOS');
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

})();
