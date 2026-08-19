// ══════════════════════════════════════════
//  config.js — 常數、URLs、品牌資料、顏色對照
//  v10.5: CMAP 動態擴充 + getColor warning
//    [v10.5] 新增 registerBrandPackColors()  
//             - brand_packs 的 primary_color 自動註冊進 CMAP
//             - 規則:CMAP[`brand_${pack_key}`] = { c: HEX, bg: HEX+22 }
//    [v10.5] getColor() 找不到 key 改 console.warn 不再靜默 fallback
//    [v10.5] 福臨門 navColor 改成 brand_flm(對應 brand_packs.pack_key)
// ══════════════════════════════════════════

// ★ 修正 GAS_URL
const GAS_URL = 'https://script.google.com/macros/s/AKfycbzJgPVlBS6qJV9zmxJQyPTrwn_jHY11AKOHfwiKVPhtHLUWJNjEVsFpWMd-Mk-RtZhy5w/exec';
const GAS_PASSWORD = 'raby2026';
const CF_WORKER_URL = 'https://photoroom-proxy.calm-sunset-6b66.workers.dev';
const GOOG_CLIENT_ID = '513919357376-g34jg6d1bqkj6pg8t27nsdrj3vd93d3e.apps.googleusercontent.com';
const GOOG_SCOPE = 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file';
const ADMIN_EMAIL = 'cyndi04592@gmail.com';

// ══ 共用狀態(所有模組共享)══
window.S = {
  brandId: null, subId: null, prod: null,
  photos: [], videos: [],
  selPhoto: null, selVideo: null,
  scripts: [], delivers: [],
  openBrand: null
};

window.BRANDS = [];
window.BRAND_FOLDERS = {};

// ══ 顏色對照表(v10.5: 改成 let 讓 brand_packs 可動態注入)══
let CMAP = {
  gold:   { c:'var(--gold)',   bg:'var(--gold2)' },
  red:    { c:'#FF8099',       bg:'var(--red2)' },
  sky:    { c:'var(--sky)',    bg:'var(--sky2)' },
  mint:   { c:'var(--mint)',   bg:'var(--mint2)' },
  purple: { c:'var(--purple)', bg:'var(--purple2)' },
  brown:  { c:'#C8A870',       bg:'rgba(200,168,112,0.15)' }
};

// 🩹 2026-08-19:把 onboard 的 12 個預設色系一起註冊進 CMAP。
//   病灶(這才是根治點):COLOR_PRESETS 是「我們自己」定義的 12 個色系,
//   每個都有中文名 + 三個色碼。但 onboard 存進資料庫的是「中文名」
//   (夜幕深藍 / MUJI米白),而 CMAP 用的是英文 key(navy / muji)——
//   兩套命名從來沒有對接,系統於是認不得自己給出去的選項。
//   → 客戶明明是「從我們的色票裡挑一個」,結果一律變成金色。
//   ★ 這裡把中文名、英文 key、色碼三者一次接起來,色碼直接沿用
//     onboard.html 的 COLOR_PRESETS,不是我另外猜的。
const ONBOARD_PRESETS = [
  { name: '品牌金',      key: 'gold',     hex: '#E8A03A' },
  { name: '珊瑚橙',      key: 'coral',    hex: '#FF6B6B' },
  { name: '蒂芬妮藍',    key: 'tiffany',  hex: '#00B5AD' },
  { name: '愛馬仕橙',    key: 'hermes',   hex: '#E8603A' },
  { name: '夜幕深藍',    key: 'navy',     hex: '#1B2A4A' },
  { name: '香奈兒黑',    key: 'chanel',   hex: '#1A1A1A' },
  { name: '玫瑰粉',      key: 'rose',     hex: '#FF8FAB' },
  { name: '抹茶綠',      key: 'matcha',   hex: '#6B8F5A' },
  { name: '薰衣草紫',    key: 'lavender', hex: '#9B7FD4' },
  { name: 'Apple銀',    key: 'apple',    hex: '#8D8D93' },
  { name: 'MUJI米白',   key: 'muji',     hex: '#C8B89A' },
  { name: '中國紅',      key: 'red',      hex: '#C0392B' },
];
(function registerOnboardPresets() {
  ONBOARD_PRESETS.forEach(function (p) {
    const v = { c: p.hex, bg: p.hex + '22' };
    // 中文名、英文 key、小寫 key 三種寫法都收,存進去哪一種都查得到
    if (!CMAP[p.name]) CMAP[p.name] = v;
    if (!CMAP[p.key]) CMAP[p.key] = v;
  });
})();

// ★ v10.5:把 brand_packs 的 primary_color 動態註冊成 CMAP key
//   呼叫時機:admaker.js 從 GAS 撈完 brand_packs 後立刻註冊
//   規則:CMAP[`brand_${pack_key}`] = { c: HEX, bg: HEX+'22'(透明度 13%) }
//   範例:brand_packs sheet 有 pack_key='chiaofu', primary_color='#3D5A3F'
//        → CMAP['brand_chiaofu'] = { c:'#3D5A3F', bg:'#3D5A3F22' }
//        → brands sheet 寫 navColor='brand_chiaofu' 就會生效
function registerBrandPackColors(packs) {
  if (!Array.isArray(packs)) return 0;
  let registered = 0;
  for (const p of packs) {
    if (!p.pack_key || !p.primary_color) continue;
    
    // 從 primary_color 字串中找出 HEX(可能是純 HEX 或長字串內含 HEX)
    const hexMatch = String(p.primary_color).match(/#[0-9A-Fa-f]{6}/);
    if (!hexMatch) {
      // 🩹 2026-08-19:註冊失敗的 pack 要「記下來」,不能只是跳過。
      //   病灶:舊寫法只 continue,那個 pack_key 就永遠查不到 ——
      //   但資料裡仍有品牌指向它,於是每次渲染都噴一次「不是有效顏色」。
      //   ★ 記進 _deadPacks 之後,_pickBrandColor 認得它是「已知的壞 pack」,
      //     直接給金色、不重複警告,並且訊息說得出「要去哪裡修」。
      _deadPacks[p.pack_key] = String(p.primary_color || '(空白)');
      if (!_warnedColors['pack:' + p.pack_key]) {
        _warnedColors['pack:' + p.pack_key] = 1;
        console.warn(
          `[CMAP] brand_packs 的「${p.pack_key}」沒有色碼,這個品牌會顯示金色。\n` +
          `  目前填的是:${p.primary_color || '(空白)'}\n` +
          `  請到 brand_packs 把 primary_color 改成色碼(例 #8B7355)。`
        );
      }
      continue;
    }
    const hex = hexMatch[0];
    const key = `brand_${p.pack_key}`;
    CMAP[key] = {
      c: hex,
      bg: hex + '22',  // 加透明度 alpha=0x22 = 13%
    };
    registered++;
  }
  if (registered > 0) {
    window.__CMAP_PACKS_READY = true;
    console.log(`[CMAP] ✅ 從 brand_packs 動態註冊了 ${registered} 個品牌專屬色:`,
      Object.keys(CMAP).filter(k => k.startsWith('brand_')));
    // 🩹 2026-08-14:顏色是晚到的,晚到就要重畫。
    //   不重畫的話,側邊欄第一次已經拿 fallback 的金色畫完了,
    //   之後畫面不會自己更新 → 品牌色永遠是金色,而且看不出哪裡錯。
    //   包 try:重繪函式還沒定義(載入順序)也不能拖垮註冊流程。
    try { if (typeof renderNavBrands === 'function') renderNavBrands(); } catch (_) {}
    try { if (typeof renderBrandTree === 'function') renderBrandTree(); } catch (_) {}
    try { if (typeof updateCtx === 'function') updateCtx(); } catch (_) {}
  }
  return registered;
}

// ★ v10.5:getColor 加 warning,不再靜默 fallback 到 gold
//   防止 GAS 寫了不存在的 navColor 卻看不出來
// 🩹 2026-08-19:把 CSS 色名換成色碼。
//   做法:丟給瀏覽器自己解析 —— 認得就回傳 rgb(...),認不得會維持原樣或空字串。
//   這樣 navy / coral / beige / ivory / teal / salmon … 全部自動支援,
//   而且不必在程式裡維護一份會寫錯的色表。
const _cssNameCache = {};
function _cssColorToHex(name) {
  const key = String(name || '').trim().toLowerCase();
  // 只放行「純英文字母」的色名,避免把中文形容詞也丟進去試
  if (!key || !/^[a-z]+$/.test(key)) return null;
  if (key in _cssNameCache) return _cssNameCache[key];
  let hex = null;
  try {
    const probe = document.createElement('span');
    probe.style.color = '';
    probe.style.color = key;
    // 瀏覽器不認得的色名會讓賦值失敗,style.color 仍是空字串
    if (probe.style.color) {
      document.body ? document.body.appendChild(probe) : null;
      const rgb = (window.getComputedStyle
        ? getComputedStyle(probe).color
        : probe.style.color) || '';
      if (probe.parentNode) probe.parentNode.removeChild(probe);
      const m = rgb.match(/(\d{1,3})\D+(\d{1,3})\D+(\d{1,3})/);
      if (m) {
        hex = '#' + [m[1], m[2], m[3]]
          .map(function (n) { return parseInt(n, 10).toString(16).padStart(2, '0'); })
          .join('');
      }
    }
  } catch (_) { hex = null; }
  _cssNameCache[key] = hex;
  return hex;
}

// 🩹 2026-08-19:挑出「真的能用」的品牌色。
//   優先順序:能用的 navColor → 色碼欄位(colorHex/color_hex/primaryColor)→ 金色。
//   ★ 「自訂色」「自訂」「custom」這類是佔位字,不是顏色,一律略過。
// 🩹 2026-08-19:品牌預設色票表(與 admin.html 的 BRAND_COLOR_PRESETS 同一份)。
//   病灶:這些配色一直躺在 admin.html 裡(而且是用心配過的 —— 巧福暖橘、
//   空瑪那靈性紫、福臨門粵式紅),但前端 window.BRANDS 從來沒帶 primaryColor,
//   所以側邊欄讀不到,全部退回金色。
//   ★ 優先序:資料庫的 primaryColor(後台改的)> 這張表 > navColor > 金色。
//     後台改過就以後台為準,沒改過就用這裡的預設,不會互相蓋掉。
const BRAND_COLOR_PRESETS = {
  cf:  '#D86E3C',  // 巧福 · 暖橘
  ww:  '#D9B96B',  // 旺味 · 米香金
  ly:  '#2C2522',  // 琉宇 · 墨黑
  ka:  '#4A3A6B',  // 空瑪那 · 靈性紫
  la:  '#9B7BC9',  // LACEZ · 紫藤
  moz: '#4A6B8A',  // MOZ · 北歐藍
  ra:  '#7C6DFA',  // RADESIGN
  kol_8072:  '#B8302E',  // 香港福臨門 · 粵式紅
  ever_7011: '#C9B584',  // Every Hay · 草本米
  // 🆕 後進駐、admin 預設表裡沒有的品牌
  protex: '#FF6B6B',  // PROTEX · 珊瑚橙(原 navColor=coral)
  ti:     '#1B2A4A',  // 大東專利 · 夜幕深藍
  hh:     '#C8B89A',  // HH美學 · MUJI米白
  ry:     '#6B8F5A',  // 洳意褌舞 · 抹茶綠
};

const _warnedColors = {};   // 🩹 同一個壞值只警告一次,避免刷版
const _deadPacks = {};      // 🩹 brand_packs 裡沒填色碼的 pack_key(查得到但沒顏色)
const _COLOR_PLACEHOLDERS = ['自訂色', '自訂', '自定色', 'custom', 'customcolor', '其他'];
function _pickBrandColor(b) {
  if (!b) return 'gold';
  // 後台改過的 primaryColor 最優先(那是客戶/管理員實際設定的)
  const own = String(b.primaryColor || b.primary_color || b.colorHex || b.color_hex || '').match(/#?[0-9A-Fa-f]{6}/);
  if (own) return own[0].startsWith('#') ? own[0] : '#' + own[0];

  // 🩹 2026-08-19:'gold' 是「從沒設定過」的系統預設,不是客戶選的顏色。
  //   若這個品牌在色票表裡有專屬色,應該用專屬色而不是金色 ——
  //   否則 HH美學、洳意褌舞這種 navColor='gold' 的品牌永遠是金色,
  //   而它們其實是有指定配色的。
  if (String(b.navColor || '').trim().toLowerCase() === 'gold'
      && b.id && BRAND_COLOR_PRESETS[b.id]) {
    return BRAND_COLOR_PRESETS[b.id];
  }
  const nav = String(b.navColor || '').trim();
  // 🩹 2026-08-19:brand_xxx 一律直接放行,不做任何判定。
  //   ⚠️ 我上一版在這裡加了「不是有效顏色」的警告,結果把原本正常的
  //   brand_chiaofu / brand_ww / brand_ly 全部誤判成壞值 ——
  //   因為品牌包色是 async 抓回來的,第一次渲染時 CMAP 裡還沒有它們。
  //   這件事舊註解早就寫過(「顏色是晚到的,晚到就要重畫」),我沒讀進去。
  //   ★ brand_ 開頭的交給 getColor 自己處理,它已經有「還沒註冊完就安靜
  //     fallback」的邏輯,重複判定只會製造假警報。
  if (nav.startsWith('brand_')) return nav;
  // 已知是「brand_packs 裡沒色碼」的 pack → 安靜給金色,不重複警告
  if (_deadPacks[nav]) return 'gold';

  // 🩹 2026-08-19:onboard 抓色時會把「網站名 + 色」存成顏色名
  //   (例:「MH Selections色」)。那是網站名稱不是顏色,一律當佔位字。
  //   ★ 判準:結尾是「色」而且前面不是已知的預設色系名 → 就是這種產物。
  const isSiteNameColor = /色$/.test(nav) && !CMAP[nav];
  const isPlaceholder = _COLOR_PLACEHOLDERS.includes(nav.toLowerCase()) || isSiteNameColor;
  // navColor 本身就能用(預設色名 / brand_xxx / 色碼)就直接用
  if (nav && !isPlaceholder && (
        CMAP[nav] ||
        /#?[0-9A-Fa-f]{6}|^rgba?\(/.test(nav) ||
        _cssColorToHex(nav)          // navy / coral 這類 CSS 色名也算可用
      )) return nav;
  // 否則去色碼欄位撈(欄位名在不同來源不一致,全都試一遍)
  const hex = b.colorHex || b.color_hex || b.primaryColor || b.primary_color || b.color;
  const m = String(hex || '').match(/#?[0-9A-Fa-f]{6}/);
  if (m) return m[0].startsWith('#') ? m[0] : '#' + m[0];
  // 🩹 2026-08-19:救不回來就直接回 gold,不要把認不得的字往下傳。
  //   舊寫法是 `nav && !isPlaceholder ? nav : 'gold'` —— 但「MUJI米白」
  //   這種中文形容詞不在佔位字清單裡,於是被原樣傳給 getColor,
  //   結果每畫一次就噴一條紅字。這裡已經確定救不回來了,
  //   往下傳只會製造噪音,不會讓顏色變對。
  //   ★ 真的填錯字的情況,onboard 那邊已經在源頭擋掉了。
  // 🩹 救不回來之前,先看預設色票表有沒有這個品牌
  if (b.id && BRAND_COLOR_PRESETS[b.id]) return BRAND_COLOR_PRESETS[b.id];

  // 只有「真的認不得的字」才提示一次,而且不重複同一個值
  if (nav && !isPlaceholder && !_warnedColors[nav]) {
    _warnedColors[nav] = 1;
    console.warn('[CMAP] 品牌色「' + nav + '」不是有效顏色,已改用金色。請在後台改填色碼(例 #8B7355)。');
  }
  return 'gold';
}

function getColor(key) {
  if (!key) return CMAP.gold;
  if (CMAP[key]) return CMAP[key];

  // 🩹 2026-08-19:直接吃色碼。
  //   病灶:getColor 原本只認「預設色名」或「已註冊的 brand_xxx」,
  //   完全不接受色碼 —— 但客戶在後台填的往往就是從網頁吸下來的 HEX,
  //   或乾脆打「自訂色」「MUJI米白」這種形容詞。
  //   結果:客戶明明設了顏色,系統卻一路 fallback 到金色,
  //   而且畫面上看不出哪裡錯,只有 Console 一直噴紅字。
  //   ★ 這裡把三種常見寫法都收下:#RRGGBB / #RGB / rgb(r,g,b)
  const raw = String(key).trim();
  const hex6 = raw.match(/^#?([0-9A-Fa-f]{6})$/);
  if (hex6) { const h = '#' + hex6[1]; return { c: h, bg: h + '22' }; }
  const hex3 = raw.match(/^#?([0-9A-Fa-f]{3})$/);
  if (hex3) {
    const h = '#' + hex3[1].split('').map(function (x) { return x + x; }).join('');
    return { c: h, bg: h + '22' };
  }
  const rgb = raw.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i);
  if (rgb) {
    const h = '#' + [rgb[1], rgb[2], rgb[3]]
      .map(function (n) { return Math.min(255, parseInt(n, 10)).toString(16).padStart(2, '0'); })
      .join('');
    return { c: h, bg: h + '22' };
  }
  // 字串裡「夾著」色碼也收(例如「米白 #F5F0E8」)
  const embedded = raw.match(/#[0-9A-Fa-f]{6}/);
  if (embedded) { const h = embedded[0]; return { c: h, bg: h + '22' }; }

  // 🩹 2026-08-19:認得 CSS 標準色名(navy / coral / beige / ivory …約 140 個)。
  //   病灶:系統原本只認六個公版色名,但客戶很自然會打 navy、coral 這種常見色名,
  //   一打就查不到 → 全部退回金色。實測線上 13 個品牌,PROTEX(coral)與
  //   大東專利事務所(navy)就是卡在這裡。
  //   ★ 不自己編色表:交給瀏覽器解析,它本來就認得這一整套,也不會被我寫錯。
  const named = _cssColorToHex(raw);
  if (named) return { c: named, bg: named + '22' };
  // 🩹 2026-08-14:brand_xxx 開頭 + 品牌色「還沒註冊完」→ 安靜 fallback。
  //   紅字原本是為了抓「navColor 打錯字」而加的,立意正確,
  //   但它連「顏色還在路上」也一起罵 —— 品牌色是 async 抓回來的,
  //   側邊欄第一次渲染時必定還沒到,於是每次開站都噴一輪假警報,
  //   久了就沒人相信這行字了。等註冊完成後才恢復告警,真打錯字才叫。
  if (!(String(key).startsWith('brand_') && !window.__CMAP_PACKS_READY)) {
    // 🩹 2026-08-19:訊息要說得出「怎麼修」,不然看到也不知道要做什麼。
    console.warn(
      `[CMAP] 認不得顏色「${key}」,先用金色代替。\n` +
      `  可接受的寫法:色碼 #8B7355、rgb(139,115,85)、預設色名(gold/red/sky/mint/purple/brown),\n` +
      `  或已註冊的品牌色 key(brand_xxx)。\n` +
      `  「自訂色」「MUJI米白」這類形容詞不是顏色,請改填實際色碼。`
    );
  }
  return CMAP.gold;
}
// ★ 根治 CMAP 時序問題:config.js 載入時自己先 fetch brand_packs 註冊 CMAP
//   原本 registerBrandPackColors 只在開 AdMaker 時跑,導致主畫面載入時
//   brand_xxx 還沒註冊 → getColor 噴 warning + fallback gold
//   這段讓 CMAP 一開始就齊全,不依賴任何其他檔的 init 流程
(async function autoRegisterBrandPackColors() {
  try {
    // 🚚 2026-08-14:改向 kol-proxy 要 brand_packs(D1 正本)。
    //   舊路是 photoroom-proxy → GAS 的 brand_packs 分頁。那張分頁還在、
    //   還會回 9 筆,但它是「後台已經不再寫入」的舊資料 ——
    //   於是後台改品牌色 → D1 變了、畫面沒變,而且完全不報錯。
    //   這種「有回應但是舊的」比 404 難查太多,404 至少會叫。
    const _bpUrl = (typeof KOL_WORKER_URL !== 'undefined' && KOL_WORKER_URL)
      ? KOL_WORKER_URL : 'https://kol-proxy.calm-sunset-6b66.workers.dev';
    const resp = await fetch(_bpUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'gas_cached', password: GAS_PASSWORD, gasAction: 'getBrandPacks', gasParams: {} }),
    });
    const data = await resp.json();
    if (data && data.ok && Array.isArray(data.packs) && data.packs.length > 0) {
      registerBrandPackColors(data.packs);
      console.log('[CMAP] config.js 啟動時已預先註冊品牌色');
    }
  } catch (e) {
    console.warn('[CMAP] config.js 啟動預註冊失敗(不影響功能,AdMaker 開啟時會再註冊):', e.message);
  }
})();

// ★ 品牌資料(含新增香港福臨門)
//   v10.5: 福臨門 navColor 改成 brand_flm(對應未來 brand_packs)
const LOCAL_FALLBACK_DATA = {
  brands: [
    { id:'cf',  name:'巧福健康家電', icon:'', navColor:'gold',   soul:'溫暖居家、守護家人健康、實用親切、台灣品牌精神。', adStyle:'溫暖生活感、家人守護、療癒放鬆、痛點直擊', hashtags:'#居家健康 #巧福 #台灣品牌' },
    { id:'ww',  name:'旺味米香腸',   icon:'', navColor:'red',    soul:'全台首創米香腸,傳承阿公家訓。', adStyle:'台灣古早味、手工真材實料、烤肉聚餐場景', hashtags:'#旺味米香腸 #米香腸 #台灣豬' },
    { id:'ly',  name:'琉宇醬選',     icon:'', navColor:'mint',   soul:'琉宇醬選主理頂級進口醬料。', adStyle:'精緻質感、食材溯源、料理升級', hashtags:'#琉宇醬選 #好滋好滋 #PASSERI' },
    { id:'moz', name:'MOZ瑞典駝鹿',  icon:'', navColor:'sky',    soul:'瑞典駝鹿DNA,用北歐色彩與趣味設計讓日常更輕鬆愉快。', adStyle:'北歐輕鬆感、顏值日常、戶外露營風、多色搭配', hashtags:'#MOZ瑞典駝鹿 #北歐設計 #洞洞鞋 #雲朵包' },
    { id:'ka',  name:'空瑪那',        icon:'', navColor:'purple', soul:'空瑪那是台灣頂尖身心靈國際學院,由宸甄老師創立。', adStyle:'療癒禪意、國際專業、身心靈覺醒、名人背書', hashtags:'#空瑪那 #頌缽療癒 #瑜珈師資 #冥想' },
    { id:'la',  name:'LACEZ',         icon:'', navColor:'mint',   soul:'LACEZ是台灣MIT內衣品牌,工廠直接賣給消費者。', adStyle:'閨蜜親切、精品感平價、MIT驕傲、穿出自信', hashtags:'#LACEZ #台灣MIT #好內衣不貴 #無鋼圈' },
    { id:'ra',  name:'RADESIGN',      icon:'', navColor:'gold',   soul:'RADESIGN專營正版品牌鞋Outlet,百分百原廠授權。', adStyle:'直白促銷、正版保證、超值撿漏、蝦皮熱銷', hashtags:'#RADESIGN #正版outlet #品牌鞋特賣 #蝦皮' },
    // ★ v10.5:福臨門 navColor 改 brand_flm(對應 brand_packs 的 pack_key)
    { id:'flm', name:'香港福臨門',    icon:'', navColor:'brand_flm',
      soul:'1948年創立於香港灣仔,近八十載粵菜傳承。米其林一星連續七年、富豪飯堂、中餐少林寺。每日新鮮食材、傳統手工烹製、百道工序成就每一味。',
      adStyle:'高端粵菜質感、傳承匠心、米其林星級、香港在地情懷、簡體中文為主(小紅書/抖音)、港味文案風格、不涉及家族歷史',
      hashtags:'#福臨門 #FookLamMoon #香港美食 #米其林 #粵菜 #富豪飯堂 #香港必吃' }
  ],
  products: [],
  folders: [
    { brandId:'cf',  photoFolderId:'1tHV_loHiUcZx8MVrpnUwTWUge74GIwE7', videoFolderId:'132xtz0XebJV-gGXObV4UtanmwyZd9Awc' },
    { brandId:'ww',  photoFolderId:'1dhCLr4tKrfV0RLHp454pzyJjytZFb92m', videoFolderId:'12LsKHCZQkDhT_FhzYWFw7rN4KJyvAD46' },
    { brandId:'ly',  photoFolderId:'1u9n-NpnQjjzU3GnpT15ERanCEky_m6bP', videoFolderId:'1lSvqYV28lgqN2xZ6640glMTssYhUKMoD' },
    { brandId:'moz', photoFolderId:'1qEsp9ifgBlYhAViOYBiou0u0mbABs1CE', videoFolderId:'1FYErl24zN_Cp2I7T3hSiv0pxqxU6QbYa' },
    { brandId:'ka',  photoFolderId:'1FX3-68mUz84tmWXI0BGnoQhKKv8JkpPW', videoFolderId:'13xC4onSRLQTB9J9wTot24bdPI9Yc2kj4' },
    { brandId:'la',  photoFolderId:'1Yt3NoT_ryBlj-jVvG7-sWm-UCGYQchxy', videoFolderId:'18LPs4wV2kcnT8pcJRUtm7hDax7nId5pD' },
    { brandId:'ra',  photoFolderId:'1ZJ1KVG6ae0WNG55eF4kwVsycozT6NmJM', videoFolderId:'1kUT_a5AKn71UgU1bD0-t_HR3W9OhqMY6' },
    { brandId:'flm', photoFolderId:'', videoFolderId:'' }
  ]
};

// ══ AD Maker 場景 Prompts ══
const BRAND_SCENE_PROMPTS = {
  lacez: {
    studio:    'pure white seamless studio backdrop, soft professional lighting, high-end lingerie product photography, minimal elegant, luxury intimate apparel brand',
    lifestyle: 'luxury boutique boudoir interior, soft morning light, silk sheets, premium feminine atmosphere, elegant intimate setting',
    nature:    'ethereal white garden, soft natural light, delicate flowers, romantic feminine atmosphere, premium quality feeling',
    forest:    'misty morning forest, dappled sunlight, dreamy soft bokeh, romantic natural setting, premium intimate brand',
    food:      'elegant marble vanity table, perfume bottles, rose petals, luxury feminine product styling',
    kitchen:   'luxury fashion boutique interior, white marble floor, rose gold accents, elegant fitting room, premium intimate apparel brand, soft warm lighting',
    luxury:    'deep navy velvet background, gold accent lighting, premium luxury product shot, high-end intimate fashion',
    marble:    'white Carrara marble surface, soft diffused studio light, minimal luxury lingerie photography, premium brand',
    outdoor:   'upscale rooftop terrace, city skyline blur, golden hour light, premium lifestyle brand atmosphere',
    beach:     'pristine white sand beach, turquoise water, soft golden light, luxury coastal lifestyle, premium intimate brand',
    minimal:   'soft gradient grey background, clean minimal studio, premium product photography, high-end fashion brand',
    night:     'candlelit luxury interior, warm intimate glow, premium boutique atmosphere, elegant feminine brand',
    garden:    'romantic English rose garden, soft afternoon light, delicate floral bokeh, luxury intimate brand lifestyle',
    camping:   'luxury spa interior, white towels, candles, soft ambient light, premium feminine wellness brand, serene elegant atmosphere',
    office:    'elegant vanity dressing table, perfume bottles, soft mirror lighting, luxury feminine brand, premium intimate apparel lifestyle',
    random:    null
  },
  cf: {
    studio:    'clean white studio, soft product photography lighting, minimal background, professional',
    lifestyle: 'cozy taiwanese family living room, warm evening lamp light, family atmosphere, soft bokeh',
    nature:    'fresh outdoor garden at dusk, green plants, warm sunset glow, natural breeze',
    forest:    'quiet forest path, moonlight filtering through trees, peaceful atmosphere',
    food:      'warm family dining table, evening meal setting, cozy home atmosphere',
    kitchen:   'cozy home kitchen, warm light, family cooking together, homey taiwanese interior',
    luxury:    'modern premium apartment interior, dark elegant tones, gold accent lighting',
    marble:    'clean marble surface, soft studio light, minimalist product photography',
    outdoor:   'suburban neighborhood at dusk, warm street lights, family community',
    beach:     'outdoor summer evening, open air, warm ambient light, relaxing family setting',
    minimal:   'soft gray gradient, minimal clean background, neutral tones',
    night:     'taiwanese bedroom at night, dim warm light, peaceful sleeping atmosphere',
    garden:    'taiwanese home garden, potted plants, warm porch light, summer evening',
    camping:   'outdoor camping at night, campfire glow, starry sky, family gathering',
    office:    'modern home office, clean desk setup, natural window light',
    random:    null
  },
  ww: {
    studio:    'clean white background, traditional taiwanese food photography, warm natural lighting',
    lifestyle: 'taiwanese family BBQ gathering, outdoor grill, joyful atmosphere',
    nature:    'outdoor picnic, sunny day, taiwanese countryside, fresh air food scene',
    forest:    'outdoor forest barbecue, campfire grill, rustic wooden table',
    food:      'sizzling grill plate, charcoal BBQ, smoke rising, authentic taiwanese street food',
    kitchen:   'traditional taiwanese kitchen, wooden cutting board, rustic home cooking',
    luxury:    'premium food presentation, elegant dark plate, fine dining interpretation',
    marble:    'white marble surface, artisan food styling, fresh ingredients',
    outdoor:   'vibrant taiwan night market, colorful vendor lights, busy food stalls',
    beach:     'outdoor beach BBQ, seaside grill party, summer evening',
    minimal:   'clean white plate, minimal food photography, soft natural light',
    night:     'taiwan night market at night, glowing lanterns, busy stalls',
    garden:    'outdoor garden barbecue, wooden deck, string lights',
    camping:   'camping BBQ scene, outdoor fire grill, nature background',
    office:    'casual office lunch, taiwanese takeout, warm approachable',
    random:    null
  },
  ly: {
    studio:    'elegant white studio, premium product photography, soft diffused lighting',
    lifestyle: 'upscale home dining, wine glass, sophisticated meal setting',
    nature:    'fresh herb garden, morning light, organic premium food sourcing',
    forest:    'dark forest, earthy tones, premium ingredient atmosphere',
    food:      'fine dining presentation, truffle, elegant restaurant style',
    kitchen:   'luxury kitchen, marble countertop, professional chef setup',
    luxury:    'black marble surface, gold spoon, dark moody lighting, premium',
    marble:    'white marble with gold veining, premium sauce bottle, elegant minimal',
    outdoor:   'upscale outdoor dining terrace, city view, evening ambiance',
    beach:     'mediterranean coastal dining, white tablecloth, sea view',
    minimal:   'pure white background, dramatic side lighting, luxury minimal',
    night:     'candlelit dinner, dark romantic atmosphere, fine dining',
    garden:    'flower garden dining, afternoon tea, elegant outdoor table',
    camping:   'glamping setup, premium outdoor dining, sophisticated',
    office:    'modern kitchen counter, premium sauce styling, food blogger',
    random:    null
  },
  flm: {
    studio:    'classic chinese restaurant interior, red lacquer and gold accents, elegant Hong Kong fine dining, professional food photography, dark moody background',
    lifestyle: 'hong kong luxury private dining room, round table, traditional chinese setting, warm chandelier light, VIP atmosphere',
    nature:    'hong kong harbour view at golden hour, victoria peak backdrop, upscale outdoor dining terrace',
    forest:    'chinese garden courtyard, bamboo, stone lanterns, traditional elegant atmosphere',
    food:      'authentic cantonese fine dining table setting, ivory chopsticks, premium porcelain, warm light, traditional chinese restaurant ambiance',
    kitchen:   'professional cantonese kitchen, wok fire blazing, traditional chinese cooking, authentic hong kong restaurant',
    luxury:    'dark black lacquer surface, gold chopsticks, premium cantonese cuisine plating, michelin star restaurant vibes, elegant and prestigious',
    marble:    'white jade marble surface, traditional chinese porcelain bowl, soft elegant studio lighting, premium hongkong brand',
    outdoor:   'hong kong city skyline blur, peak tram view, upscale rooftop terrace dining, golden hour',
    beach:     'hong kong aberdeen harbour, traditional fishing boats bokeh, upscale waterfront dining',
    minimal:   'pure black background, dramatic single spotlight, premium cantonese dish presentation, michelin star plating',
    night:     'hong kong neon night, wanchai atmosphere, classic chinese restaurant glowing facade, iconic hongkong',
    garden:    'traditional chinese garden, peonies, koi pond, elegant scholar rock, premium setting',
    camping:   'private yacht deck, hong kong harbour, sunset, luxury cantonese dining experience',
    office:    'hong kong business lunch setting, private room, premium chopsticks, formal cantonese hospitality',
    random:    null
  }
};

const PR_SCENE_PROMPTS = {
  studio:    'clean white studio background, minimal, professional product photography',
  lifestyle: 'cozy home interior, warm living room, natural light',
  nature:    'lush green nature, fresh botanical background, outdoor light',
  forest:    'dense forest path, morning light filtering through trees',
  food:      'elegant dining table, wooden surface, soft food photography lighting',
  kitchen:   'warm cozy kitchen interior, wooden countertop, soft morning light',
  luxury:    'black marble surface, gold accents, luxury dark background, premium',
  marble:    'white marble texture background, elegant veining, soft studio lighting',
  outdoor:   'urban city street background, modern architecture, outdoor natural light',
  beach:     'tropical beach, golden sand, turquoise ocean water, bright sunny day',
  minimal:   'soft gray gradient background, minimal clean studio, neutral tones',
  night:     'city night scene, neon lights, bokeh background, urban atmosphere',
  garden:    'beautiful flower garden, cherry blossoms, soft bokeh, spring light',
  camping:   'outdoor camping scene, campfire, forest trees, starry night sky',
  office:    'modern office interior, clean desk, professional environment',
  random:    null
};

const PR_RANDOM_PROMPTS = ['bright kitchen counter, morning light, fresh and clean'];

const FOOD_SCENE_PROMPTS = {
  bbq:           'sizzling BBQ grill background, charcoal fire, outdoor grilling, warm smoky tones',
  night_market:  'vibrant night market stall, colorful lights, lively street food',
  wooden_table:  'rustic wooden table, warm natural light, cozy food photography',
  white_plate:   'clean white plate, minimal white background, professional food photography',
  outdoor_picnic:'outdoor picnic, green grass, natural sunlight, casual food scene',
  street_food:   'busy street food scene, urban background, authentic local food culture'
};

function getBrandScenePrompt(scene) {
  const brandId = window.S.brandId || 'cf';
  const brandPrompts = BRAND_SCENE_PROMPTS[brandId] || BRAND_SCENE_PROMPTS.cf;
  if (scene === 'random') {
    const scenes = Object.keys(brandPrompts).filter(k => k !== 'random' && brandPrompts[k]);
    return brandPrompts[scenes[Math.floor(Math.random() * scenes.length)]];
  }
  return brandPrompts[scene] || PR_SCENE_PROMPTS[scene];
}

// ══ 工具函式 ══
function parseDriveId(raw) {
  if (!raw) return null;
  const m = raw.match(/(?:folders\/|id=)([a-zA-Z0-9_\-]{15,})/);
  if (m) return m[1];
  if (/^[a-zA-Z0-9_\-]{15,}$/.test(raw.trim())) return raw.trim();
  return null;
}

function buildDataFromSheets(data) {
  // ★ 相容兩種格式:GAS 回的是 { ok, data:{ brands } },舊呼叫端可能直接傳 { brands }
  //   收到外層帶 .data.brands 就自動挖一層,避免拿不到資料掉進 LOCAL_FALLBACK_DATA
  if (data && data.data && data.data.brands && !data.brands) {
    data = data.data;
  }
  const { brands, products, folders } = data;
  window.BRAND_FOLDERS = {};
  (folders || []).forEach(f => {
    window.BRAND_FOLDERS[f.brandId] = { photo: f.photoFolderId, video: f.videoFolderId };
  });
  const prodByBrand = {};
  (products || []).forEach(p => {
    if (!prodByBrand[p.brandId]) prodByBrand[p.brandId] = {};
    const key = p.subId;
    if (!prodByBrand[p.brandId][key]) prodByBrand[p.brandId][key] = {
      // 🩹 2026-08-19:系列色也要過 _pickBrandColor。
      //   病灶(這才是紅字的真正來源):品牌的 navColor 早就修好了,
      //   但「商品系列」自己也有一個 color 欄位(subColor),裡面存的
      //   同樣是「自訂色」「MUJI米白」這種字,而 brands.js 第 23 行
      //   getColor(sb.color) 每畫一個系列就呼叫一次 ——
      //   香港福臨門有四個系列,點一次就噴四條紅字。
      //   ★ 之前只修品牌層、沒修系列層,所以永遠修不乾淨。
      id: p.subId, name: p.subName,
      color: _pickBrandColor({ navColor: p.subColor, colorHex: p.subColorHex, primaryColor: p.subPrimaryColor }),
      soul: p.subSoul, adStyle: p.subAdStyle, hashtags: p.subHashtags, prods: []
    };
    if (p.prodId) {
      prodByBrand[p.brandId][key].prods.push({ id: p.prodId, name: p.prodName, tag: p.prodTag, spec: p.spec || '', feature: p.feature || '' });
    }
  });
  window.BRANDS = (brands || []).map(b => ({
    // 🩹 2026-08-19:navColor 若是「自訂色」這類形容詞,改用真正的色碼欄位。
    //   onboard 舊版把 f_color 寫死成「自訂色」,色碼另外存在 colorHex,
    //   而畫面讀的是 navColor → 舊客戶(已經註冊完的)品牌色一律變金色。
    //   前端修好只救得了新客戶,這行是救「已經存在資料庫裡」的舊資料。
    // 🩹 2026-08-19:primaryColor 一定要帶出來,否則後台改了色票前端讀不到。
    id: b.id, name: b.name, icon: '',
    primaryColor: b.primaryColor || b.primary_color || '',
    navColor: _pickBrandColor(b),   // 🆕 商業化:品牌不再用 emoji 圖示,一律純文字
    soul: b.soul || '', adStyle: b.adStyle || '', hashtags: b.hashtags || '',
    subs: Object.values(prodByBrand[b.id] || {})
  }));
}

// ═══════════════════════════════════════════════════════════════
//  🔐 2026-08-14 P0·6a:身分證(session token)全域夾帶
//  ─────────────────────────────────────────────────────────────
//  為什麼放在 config.js:
//   index.html / plans.html / monitor.html 這三頁都載入本檔,而且都在
//   最前面 → 一個檔就能覆蓋三頁,不用逐頁改。
//   (kol.html 與 admin.html 各自有攔截器,已在 5a / 5b 處理。)
//
//  做什麼:所有打 kol-proxy 的 POST,自動補上 token 欄位。
//   GAS_PASSWORD 那把是公開的(隨網頁下發給每位訪客),只能證明
//   「從我們網站來」;而請求裡的 email 是前端自己填的,後端無從查證。
//   token 由 Worker 簽章,改內容就對不上章 —— 那才是真的身分。
//
//  ⚠️ 沒有 token 時(還沒登入)什麼都不做,原樣送出 —— 登入畫面本身
//   要能運作,不能把人鎖在門外。
// ═══════════════════════════════════════════════════════════════
(function () {
  if (window.__bsTokenShim) return;          // 防重複掛載(頁面若同時載兩次)
  window.__bsTokenShim = true;

  window._bsAuthToken = function () {
    try { return sessionStorage.getItem('bs_auth_token') || localStorage.getItem('bs_auth_token') || ''; }
    catch (e) { return ''; }
  };

  const _origFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    try {
      const url = (typeof input === 'string') ? input : ((input && input.url) || '');
      // 🔐 2026-08-18:兩支 Worker 都要夾帶身分證。
      //   原本只認 kol-proxy → 打 photoroom-proxy 的請求(廣告圖 240 點、
      //   試穿 120 點、影片 960 點)全都沒帶證。photoroom 上鎖後那些功能會全掛,
      //   所以先讓前端一律帶著。
      if ((url.indexOf('kol-proxy.calm-sunset-6b66.workers.dev') !== -1
           || url.indexOf('photoroom-proxy.calm-sunset-6b66.workers.dev') !== -1)
          && init && String(init.method || '').toUpperCase() === 'POST'
          && typeof init.body === 'string') {
        const o = JSON.parse(init.body);
        if (o && typeof o === 'object' && !o.token) {
          const tk = window._bsAuthToken();
          if (tk) { o.token = tk; init = Object.assign({}, init, { body: JSON.stringify(o) }); }
        }
      }
    } catch (e) { /* 夾帶失敗絕不擋請求 */ }
    return _origFetch(input, init);
  };
})();
