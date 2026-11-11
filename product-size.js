/* ═══════════════════════════════════════════════════════════════════
 *  product-size.js · v1.9(2026-11-12)商品尺寸點選器(KOL 工作室 / 廣告圖 / 入駐 共用)
 *  v1.9 RA:入駐商品表格加必填欄「這是什麼、怎麼用」(雲朵水餃包其實是眼鏡包,AI 從名字猜不到);售價改選填(廣告圖與文案都會刻意刪掉價格,沒用到)
 *       送出格式:「名稱｜用途:一句話｜尺寸:…」→ kol-proxy 核准時拆進商品的「特色」(feature)
 *  v1.8 RA:「先縮起來要再展開,這裡也是要必選」→ 存好的尺寸縮成一行(點「改」才展開);
 *       廣告圖頁標「必選」:實體商品沒存尺寸就不能生成(展開面板、捲過去、紅字提醒,不跳視窗)
 *  v1.5 RA:「給客戶選的那端簡單一點、有設計感一點」(圖示定案:白卡片 + 黑描邊 + 卡通圓手 + 金色量尺/商品箱)→ 主選項只留 6 顆(配小圖示),其他收進「更細 ▾」;
 *       入駐問卷每個商品平常只露一顆「多大?」小按鈕,選好縮成一行。存的格式完全沒變(Worker 照舊讀得懂)
 *  v1.7c 手套改實心連指手套(塗滿、不畫五指)、圖示再放大 + 顏色直接寫在圖上(不受頁面其他樣式影響)
 *  v1.7b 手指/手掌那幾張圖示局部放大(上半身+手,手看得清楚)
 *  v1.7 RA:「這裡 UIX 很醜」+ 參考圖(深色玻璃卡、青粉漸層框、白色太空人)→ 6 張卡換新圖示;卡片最窄 88px,窄欄自動變 3 欄,字不再被擠成兩三行
 *  v1.6 RA:「商品變成表格,一列一個商品,可以選尺寸、售價,按 + 多一列」 → 新增 mountTable(入駐問卷的商品表格)、mountCell(表格裡的尺寸按鈕)、composeLine(組出「名稱｜尺寸:…」)
 * ───────────────────────────────────────────────────────────────────
 *  RA 11/02:「客戶去哪裡填尺寸?只有入駐填一次,懶的人一定沒填」
 *          「用手掌這招(刺蝟星球)更準,讓客戶點選幾個手掌大」
 *  ★ 為什麼要尺寸:系統拿這個數字把包裝照做成「真手 / 160cm 女生站旁邊」的尺寸參考照
 *    (kol-proxy v7.51+),影片只吃那張照片 —— 沒填就只能讓 AI 自己猜大小。
 *  ★ 存到哪:products.realSize(+ placement / placeNote),用 Worker 既有的 product_placement_set,
 *    廣告圖、KOL 影片讀同一筆,填一次全站都用。
 *  ★ 存的格式(kol-proxy _sizeSpec 讀得懂):
 *      手拿得起 → realSize「最長約27cm」;精準填 → 「寬18×高25cm」
 *      大件     → realSize「高約100cm」+ placeNote 開頭「【大小】到大人的腰。」
 *      裡面一件 → placeNote 開頭「內容物單件長約9cm。」
 *  用法:
 *    自動:KOL 工作室有 #ref-list / #ep-ref-list 就自己掛在「商品照分槽」下面。
 *    手動:ProductSize.mount(容器元素, { getProduct: () => 商品物件, brandId: '...' })
 * ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.ProductSize) return;
  var VERSION = 'v1.9';
  var HAND = 18;   // 一個手掌 = 手腕到指尖約 18cm

  var PACK = [
    { k: 'finger', t: '一根手指', cm: 7 },
    { k: 'half', t: '半個手掌', cm: 9 },
    { k: 'p1', t: '1 個手掌', cm: 18 },
    { k: 'p15', t: '1.5 個手掌', cm: 27 },
    { k: 'p2', t: '2 個手掌', cm: 36 },
    { k: 'p3', t: '3 個手掌', cm: 54 },
    { k: 'knee', t: '到大人膝蓋', cm: 50, big: '到大人的膝蓋', pl: 'floor' },
    { k: 'waist', t: '到大人腰', cm: 100, big: '到大人的腰', pl: 'floor' },
    { k: 'chest', t: '到胸口', cm: 130, big: '到大人的胸口', pl: 'floor' },
    { k: 'human', t: '跟大人一樣高', cm: 165, big: '跟大人差不多高', pl: 'large' },
    { k: 'taller', t: '比大人高', cm: 200, big: '比大人高一個頭', pl: 'large' },
  ];
  var PIECE = [
    { k: 'nail', t: '指甲大', cm: 1.5 },
    { k: 'finger', t: '一根手指', cm: 7 },
    { k: 'half', t: '半個手掌', cm: 9 },
    { k: 'p1', t: '1 個手掌', cm: 18 },
  ];
  var PHYSICAL = /^(tip|palm|table|floor|large|flat|)$/;
  //  v1.2 這些呈現方式不需要尺寸(沒有實體商品 / 穿在身上由身體當比例尺)—— 跟 kol-proxy v7.57 同一份清單
  var NO_SIZE_MODES = /^(service|equip|screen|pro|digital|medical|course|mystic|travel|agency|worn|innerwear)$/;

  //  v1.3 大件(到膝蓋以上、落地/大型/鋪地):「裡面一件」用不到 → 不顯示
  function _isBig(packKey, p) {
    var o = null; PACK.forEach(function (x) { if (x.k === packKey) o = x; });
    if (o) return !!o.big;
    return /^(floor|large|flat)$/.test(String((p && p.placement) || ''));
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function num(s, re) { var m = String(s || '').match(re); return m ? parseFloat(m[1]) : 0; }

  // ── 讀現況:商品上已經存的尺寸 → 對應到哪一顆
  function readState(p) {
    var rs = String((p && p.realSize) || ''), note = String((p && p.placeNote) || '');
    var w = num(rs, /寬[^\d]{0,3}(\d+(?:\.\d+)?)/), h = num(rs, /[高長][^\d]{0,3}(\d+(?:\.\d+)?)/);
    var bigZh = (note.match(/【大小】([^。]+)/) || [])[1] || '';
    var piece = num(note, /內容物單件長約(\d+(?:\.\d+)?)\s*cm/) || num(note + ' ' + ((p && p.contentsLook) || ''), /長[^\d]{0,3}(\d+(?:\.\d+)?)\s*(?:cm|公分)/i);
    var pieceOnly = /單條|單片|單顆|單塊|單支|單根|單個|一口|每片|每條|每顆|每塊|內容物/.test(rs) && !(w && h);
    var packKey = '';
    if (bigZh) PACK.forEach(function (o) { if (o.big === bigZh) packKey = o.k; });
    var mx = pieceOnly ? 0 : Math.max(w, h);
    //  v1.1 只在「剛好等於」那顆時才亮 —— 用最接近的那顆會讓按存檔時把精準數字改成約略值(海苔單片 14.5 → 18)
    if (!packKey && mx && !(w && h)) PACK.forEach(function (o) { if (!o.big && o.cm === mx) packKey = o.k; });
    var pieceKey = '';
    if (piece) PIECE.forEach(function (o) { if (o.cm === piece) pieceKey = o.k; });
    return { w: w, h: h, mx: mx, packKey: packKey, piece: piece, pieceKey: pieceKey, bigZh: bigZh, filled: !!(mx || bigZh) };
  }

  // ── 存:沿用 Worker 的 product_placement_set(要帶 placement)
  async function save(p, brandId, pack, exact, piece, ids) {
    var cfg = window.KAI || {};
    var url = cfg.WORKER_URL || 'https://kol-proxy.calm-sunset-6b66.workers.dev';
    var place = String(p.placement || '');
    var note = String(p.placeNote || '');
    if (pack || exact) note = note.replace(/【大小】[^。]*。?/g, '');                       // 只有這次有點整包大小才換掉舊的
    if (piece) note = note.replace(/內容物單件長約\d+(?:\.\d+)?\s*cm。?/g, '');      // 只有這次有點裡面一件才換掉舊的
    note = note.trim();
    var rs;
    if (exact && exact.w && exact.h) rs = '寬' + exact.w + '×高' + exact.h + 'cm';
    else if (pack && pack.big) rs = '高約' + pack.cm + 'cm';
    else if (pack) rs = '最長約' + pack.cm + 'cm';
    else rs = String(p.realSize || '');
    if (pack && pack.big) {
      if (!/^(floor|large|flat)$/.test(place)) place = pack.pl;
      note = '【大小】' + pack.big + '。' + note;
    } else if (pack || (exact && exact.w)) {
      var cm = pack ? pack.cm : Math.max(exact.w, exact.h);
      if (!/^(tip|palm|table)$/.test(place)) place = cm <= HAND ? 'palm' : 'table';
    }
    if (!place) place = 'palm';
    if (piece) note = '內容物單件長約' + piece + 'cm。' + note;
    var _id = ids || {};
    var body = { action: 'product_placement_set', password: cfg.PASSWORD || (typeof GAS_PASSWORD !== 'undefined' ? GAS_PASSWORD : ''),
      token: (function () { try { return sessionStorage.getItem('bs_auth_token') || localStorage.getItem('bs_auth_token') || ''; } catch (_) { return ''; } })(),
      brandId: _id.brandId || brandId || p.brandId, subId: (_id.subId != null ? _id.subId : (p.subId || '')), prodId: _id.prodId || p.prodId || p.id || '',
      placement: place, placeNote: note.slice(0, 300), realSize: rs };
    var r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    var d = await r.json().catch(function () { return { ok: false, error: '回應不是 JSON' }; });
    if (!d || d.ok === false) throw new Error((d && d.error) || '存檔失敗');
    // 畫面上的商品物件同步改(下一支影片馬上用到新尺寸)
    p.placement = d.placement || place; p.placeNote = d.placeNote != null ? d.placeNote : note; p.realSize = rs;
    try {
      ((window.S && window.S.products) || []).forEach(function (x) {
        if (x !== p && x.brandId === body.brandId && x.prodId === body.prodId && (x.subId || '') === (body.subId || '')) { x.placement = p.placement; x.placeNote = p.placeNote; x.realSize = rs; }
      });
    } catch (_) {}
    return rs;
  }

  // ── 畫面
  //  v1.5 主選項 6 顆(一根手指 / 1 個手掌 / 2 個手掌 / 到膝蓋 / 到腰 / 跟人一樣高),其他收進「更細 ▾」
  var MAIN = ['finger', 'p1', 'p2', 'knee', 'waist', 'human'];
  var SHORT = { finger: '一根手指', half: '半個手掌', p1: '1 個手掌', p15: '1.5 個手掌', p2: '2 個手掌', p3: '3 個手掌',
    knee: '到膝蓋', waist: '到腰', chest: '到胸口', human: '跟人一樣高', taller: '比人高' };
  //  小圖示 v1.7(RA 11/02 參考圖:深色玻璃卡 + 青→粉漸層邊框 + 白色太空人,青色光點標出「多大」)—— 原創圖形
  //   ★ 手拿得起:太空人舉手,舉起來的手 = 一個單位(一根手指 / 一個手掌 / 兩個手掌)
  //   ★ 大件:太空人站著,青色光環套在膝蓋 / 腰 / 胸口;跟人一樣高 = 旁邊一根青色量尺
  var GLOVE = 'M3.6 21.5C3.4 18.5 2.6 16.8 1.6 15.2C.6 13.6 1.8 12.2 3.2 13.2L4.4 14.2C4 10.5 3.8 7.4 4 6C4.2 4.4 6.4 4.4 6.4 6L6.6 10'
    + 'C6.6 6.6 6.6 4 6.8 3C7 1.4 9.2 1.4 9.3 3L9.4 9.8C9.6 6.8 9.8 5 10 4.2C10.3 2.8 12.3 3 12.2 4.6L12 10.4'
    + 'C12.4 8.6 12.8 7.6 13.2 7.2C14.2 6.4 15.4 7.2 14.9 8.6C14.2 11 14 13.4 13.6 15.6C13.2 18 12 19.6 11.6 21.5Z';
  function f(n) { return (+n).toFixed(2); }
  function icon(k) {
    //  太空人:cx = 身體中線;arms = { l: 'down'|'up', r: 'down'|'up' }
    function astro(cx, arms) {
      arms = arms || {};
      var g = '<circle class="halo" cx="' + f(cx + 1.6) + '" cy="5.6" r="4.8"/>'
        + '<ellipse class="glow" cx="' + f(cx) + '" cy="22.5" rx="6.5" ry=".55"/>'
        + '<rect class="pk2" x="' + f(cx - 3.6) + '" y="9.2" width="7.2" height="5.6" rx="1.4"/>'                 // 背包
        + '<rect class="su" x="' + f(cx - 3) + '" y="9.4" width="6" height="6.6" rx="1.5"/>'                     // 身體
        + '<rect class="su" x="' + f(cx - 2.7) + '" y="15.4" width="2.4" height="5.4" rx=".7"/>'                 // 左腿
        + '<rect class="su" x="' + f(cx + .3) + '" y="15.4" width="2.4" height="5.4" rx=".7"/>'                  // 右腿
        + '<rect class="su" x="' + f(cx - 3) + '" y="20.2" width="2.9" height="1.8" rx=".6"/>'                   // 鞋
        + '<rect class="su" x="' + f(cx + .1) + '" y="20.2" width="2.9" height="1.8" rx=".6"/>'
        + '<rect class="scr" x="' + f(cx - 1.3) + '" y="11" width="2.6" height="2" rx=".3"/>';                    // 胸口小螢幕
      g += arms.l === 'up' ? '<path class="arm" d="M' + f(cx - 2.6) + ' 10.6L' + f(cx - 5.2) + ' 7.4"/>' : '<rect class="su" x="' + f(cx - 4.5) + '" y="9.8" width="1.6" height="5.4" rx=".8"/>';
      g += arms.r === 'up' ? '<path class="arm" d="M' + f(cx + 2.6) + ' 10.6L' + f(cx + 5.2) + ' 7.4"/>' : '<rect class="su" x="' + f(cx + 2.9) + '" y="9.8" width="1.6" height="5.4" rx=".8"/>';
      g += '<circle class="su" cx="' + f(cx) + '" cy="6" r="3.4"/>'                                               // 頭盔
        + '<rect class="vz" x="' + f(cx - 2.4) + '" y="4.9" width="4.8" height="2.6" rx="1.3"/>'                 // 面罩
        + '<path class="shine" d="M' + f(cx - 1.4) + ' 5.7Q' + f(cx) + ' 5.1 ' + f(cx + 1.3) + ' 5.5"/>';
      return g;
    }
    //  手套 v1.7c RA:「五指不清楚,直接一個手套就行、塗滿」→ 實心連指手套(拇指一根 + 其他四指包成一塊)+ 青色袖口
    //   手腕在 (wx, wy),高 h;thumb = 拇指朝哪邊(1 右 / -1 左)
    function glove(wx, wy, h, thumb) {
      var t = thumb || 1, w = h * .62;
      function X(u) { return f(wx + u * w * t); } function Y(v) { return f(wy - v * h); }
      return '<path class="gl" style="fill:#f4f7fc;stroke:#3fd8ff;stroke-width:.4" d="M' + X(-.5) + ' ' + Y(.16) + 'V' + Y(.62) + 'Q' + X(-.5) + ' ' + Y(1) + ' ' + X(0) + ' ' + Y(1)
        + 'Q' + X(.5) + ' ' + Y(1) + ' ' + X(.5) + ' ' + Y(.62) + 'V' + Y(.5) + 'Q' + X(.62) + ' ' + Y(.66) + ' ' + X(.82) + ' ' + Y(.6)
        + 'Q' + X(1) + ' ' + Y(.52) + ' ' + X(.86) + ' ' + Y(.36) + 'L' + X(.5) + ' ' + Y(.16) + 'Z"/>'
        + '<rect style="fill:#3fd8ff" x="' + f(wx - .56 * w) + '" y="' + Y(.2) + '" width="' + f(1.12 * w) + '" height="' + f(.2 * h) + '" rx="' + f(.06 * h) + '"/>';
    }
    function finger(wx, wy) {
      return '<path class="gl" style="fill:#f4f7fc;stroke:#3fd8ff;stroke-width:.4" d="M' + f(wx - 1.3) + ' ' + f(wy) + 'V' + f(wy - 2) + 'Q' + f(wx - 1.3) + ' ' + f(wy - 2.6) + ' ' + f(wx - .7) + ' ' + f(wy - 2.6)
        + 'H' + f(wx - .5) + 'V' + f(wy - 5.6) + 'Q' + f(wx - .5) + ' ' + f(wy - 6.3) + ' ' + f(wx + .1) + ' ' + f(wy - 6.3) + 'Q' + f(wx + .7) + ' ' + f(wy - 6.3) + ' ' + f(wx + .7) + ' ' + f(wy - 5.6)
        + 'V' + f(wy - 2.6) + 'H' + f(wx + .8) + 'Q' + f(wx + 1.4) + ' ' + f(wy - 2.6) + ' ' + f(wx + 1.4) + ' ' + f(wy - 2) + 'V' + f(wy - .5) + 'Q' + f(wx + 1.4) + ' ' + f(wy) + ' ' + f(wx + .8) + ' ' + f(wy) + 'Z"/>';
    }
    function spark(x, y, side) {   // 手旁邊三道光
      var d = side < 0
        ? 'M' + f(x - 1.8) + ' ' + f(y + .4) + 'h-1M' + f(x - 1.3) + ' ' + f(y - 1.1) + 'l-.8-.8M' + f(x) + ' ' + f(y - 1.7) + 'v-1'
        : 'M' + f(x + 1.8) + ' ' + f(y + .4) + 'h1M' + f(x + 1.3) + ' ' + f(y - 1.1) + 'l.8-.8M' + f(x) + ' ' + f(y - 1.7) + 'v-1';
      return '<path class="sp" d="' + d + '"/>';
    }
    function ring(y) {
      return '<ellipse class="rg" cx="12" cy="' + f(y) + '" rx="5.4" ry="1.1"/>'
        + '<path class="sp" d="M4.6 ' + f(y) + 'h1.1M18.3 ' + f(y) + 'h1.1M5 ' + f(y - 1.4) + 'l.7.5M19 ' + f(y - 1.4) + 'l-.7.5"/>';
    }
    function bar(top) { return '<path class="rg" d="M19.6 ' + f(top) + 'V22M18.6 ' + f(top) + 'h2M18.6 22h2"/>'; }
    var g = '';
    if (k === 'finger') g = astro(14, { l: 'up' }) + finger(8.8, 7.6) + spark(8.9, 1.3, -1);
    else if (k === 'half') g = astro(14, { l: 'up' }) + glove(8.8, 7.6, 3.8) + spark(8.6, 3.6, -1);
    else if (k === 'p1') g = astro(14, { l: 'up' }) + glove(8.8, 7.6, 5.6) + spark(8.6, 1.8, -1);
    else if (k === 'p15') g = astro(13, { l: 'up', r: 'up' }) + glove(7.8, 7.6, 5.6) + glove(18.2, 7.6, 3.6, -1) + spark(7.6, 1.8, -1);
    else if (k === 'p2') g = astro(12, { l: 'up', r: 'up' }) + glove(6.8, 7.6, 5.6) + glove(17.2, 7.6, 5.6, -1) + spark(6.6, 1.8, -1) + spark(17.4, 1.8, 1);
    else if (k === 'p3') g = astro(12, { l: 'up', r: 'up' }) + glove(6.8, 7.6, 5.6) + glove(17.2, 7.6, 5.6, -1) + glove(12, 2.2, 3.4) + spark(6.6, 1.8, -1) + spark(17.4, 1.8, 1);
    else if (k === 'knee') g = astro(12) + ring(18.2);
    else if (k === 'waist') g = astro(12) + ring(14.6);
    else if (k === 'chest') g = astro(12) + ring(11.6);
    else if (k === 'human') g = astro(11) + bar(2.4);
    else if (k === 'taller') g = astro(11) + bar(.2) + '<path class="sp" d="M19.6 -.9v-.6"/>';
    //  v1.7b RA:「一根手指、一個手掌、兩個手掌能用局部放大嗎?」→ 手的那幾張把鏡頭拉近到上半身+手(腿出框),手看得清楚
    var VB = { finger: '4.6 -0.6 14 14', half: '4.6 -0.6 14 14', p1: '4.6 -0.6 14 14', p15: '3.6 -0.6 16 16', p2: '3.6 -0.6 16.8 16.8', p3: '3.6 -0.6 16.8 16.8' }[k] || '0 0 24 24';
    return '<svg class="ic' + (VB.charAt(0) === '0' ? '' : ' zm') + '" viewBox="' + VB + '" aria-hidden="true">' + g + '</svg>';
  }
  var RULER = '<svg class="ic sm" viewBox="0 0 24 24" aria-hidden="true"><rect class="ac" x="2" y="7.5" width="20" height="9" rx="1.6"/><path class="ink" d="M6.5 7.5v3.4M10.5 7.5v4.6M14.5 7.5v3.4M18.5 7.5v4.6"/></svg>';
  function tiles(selKey) {
    var more = !!selKey && MAIN.indexOf(selKey) < 0;
    function t(o) { return '<button type="button" class="c' + (selKey === o.k ? ' on' : '') + '" data-k="' + o.k + '" title="' + o.t + '">' + icon(o.k) + '<span>' + SHORT[o.k] + '</span></button>'; }
    return '<div class="tiles">' + PACK.filter(function (o) { return MAIN.indexOf(o.k) > -1; }).map(t).join('') + '</div>'
      + '<button type="button" class="mo">' + (more ? '收起 ▴' : '更細一點 ▾') + '</button>'
      + '<div class="tiles more"' + (more ? '' : ' style="display:none"') + '>' + PACK.filter(function (o) { return MAIN.indexOf(o.k) < 0; }).map(t).join('') + '</div>';
  }
  function wireMore(scope) {
    scope.querySelectorAll('.mo').forEach(function (m) {
      m.onclick = function () { var mm = m.nextElementSibling; var open = mm.style.display === 'none'; mm.style.display = open ? '' : 'none'; m.textContent = open ? '收起 ▴' : '更細一點 ▾'; };
    });
  }
  var CSS = '.psz{--pa:var(--accent,#8b7cf6);--pg:var(--accent2,#d9b25f);margin-top:12px;padding:12px 14px;border:1px solid rgba(255,255,255,.08);border-radius:12px;background:rgba(255,255,255,.025);font-size:12px}'
    + '.psz h4 .req{font-size:10px;font-weight:700;color:#fa6d9b;margin-left:2px}.psz.mini{padding:9px 14px}.psz.mini .st{margin:0}.psz .ed{margin-left:6px;color:var(--pa);cursor:pointer;text-decoration:underline;font-weight:600}.psz.need{border-color:#fa6d9b;box-shadow:0 0 0 2px rgba(250,109,155,.25)}'
    + '.psz h4{margin:0 0 4px;font-size:13px;font-weight:600;display:flex;align-items:center;gap:6px}.psz .st{font-size:11.5px;margin:0 0 10px;opacity:.65;line-height:1.5}.psz .st.warn{color:#f5b041;opacity:1}'
    + '.psz .row{display:flex;flex-wrap:wrap;gap:6px;margin:4px 0 8px}.psz .lb{font-size:11.5px;opacity:.72;margin-top:12px;font-weight:600}'
    + '.psz .ic{width:68px;height:68px;overflow:visible}.psz .ic .su{fill:#eef1f7}.psz .ic .pk2{fill:#9aa3b5}.psz .ic .vz{fill:#141a2a}.psz .ic .shine{fill:none;stroke:#fff;stroke-width:.45;stroke-linecap:round;opacity:.7}.psz .ic .scr{fill:#3fd8ff}.psz .ic .arm{fill:none;stroke:#eef1f7;stroke-width:1.6;stroke-linecap:round}.psz .ic .gl{fill:#fff;stroke:#3fd8ff;stroke-width:.55;stroke-linejoin:round}.psz .ic .sp{fill:none;stroke:#3fd8ff;stroke-width:.6;stroke-linecap:round}.psz .ic .rg{fill:none;stroke:#3fd8ff;stroke-width:.75;stroke-linecap:round;filter:drop-shadow(0 0 1.2px #3fd8ff)}.psz .ic .halo{fill:#a46bd8;opacity:.22}.psz .ic .glow{fill:#3fd8ff;opacity:.45;filter:blur(.5px)}.psz .ic.zm{overflow:hidden;border-radius:10px}.psz .ic.sm{width:16px;height:16px}.psz .ic.sm .ink{fill:none;stroke:#1f2230;stroke-width:1.6;stroke-linecap:round}.psz .ic.sm .ac{fill:#3fd8ff;stroke:#1f2230;stroke-width:1.2}'
    + '.psz .tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(88px,1fr));gap:8px;margin:8px 0 6px}'
    + '.psz .tiles button.c{display:flex;flex-direction:column;align-items:center;gap:6px;padding:12px 4px 10px;border:1px solid transparent;border-radius:16px;'
    + 'background:linear-gradient(165deg,#161d30,#0c1120) padding-box,linear-gradient(135deg,rgba(63,216,255,.55),rgba(200,107,255,.55)) border-box;'
    + 'color:#dfe6f3;cursor:pointer;font-size:12px;font-weight:600;line-height:1.25;white-space:nowrap;box-shadow:0 0 10px rgba(63,216,255,.08);transition:transform .15s,box-shadow .15s}'
    + '.psz .tiles button.c:hover{transform:translateY(-2px);box-shadow:0 0 16px rgba(63,216,255,.22)}'
    + '.psz .tiles button.c.on{border-width:2px;padding:11px 3px 9px;background:linear-gradient(165deg,#1b2540,#0e1528) padding-box,linear-gradient(135deg,#3fd8ff,#c86bff) border-box;color:#fff;box-shadow:0 0 0 1px rgba(63,216,255,.25),0 0 20px rgba(63,216,255,.35),0 0 30px rgba(200,107,255,.2)}'
    + '.psz .mo{background:none;border:0;color:inherit;opacity:.55;font-size:11px;cursor:pointer;padding:2px 0;margin:0 0 4px}.psz .mo:hover{opacity:.9}'
    + '.psz .row button.c{border:1px solid rgba(255,255,255,.12);background:transparent;color:inherit;border-radius:14px;padding:4px 10px;font-size:12px;cursor:pointer}'
    + '.psz .row button.c.on{border-color:var(--pa);background:color-mix(in srgb,var(--pa) 18%,transparent)}.psz input{width:58px;background:transparent;border:1px solid rgba(255,255,255,.14);border-radius:6px;color:inherit;padding:3px 6px;font-size:12px}'
    + '.psz .ex{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin:4px 0 8px}.psz .sv{border:0;border-radius:8px;padding:7px 16px;background:var(--pa);color:#fff;cursor:pointer;font-size:12px}'
    + '.psz .sv:disabled{opacity:.5;cursor:default}.psz .msg{font-size:11px;margin-left:8px}'
    // 入駐問卷:每個商品一行
    + '.psz .it{border-top:1px solid rgba(255,255,255,.06);padding:8px 0}.psz .it:first-of-type{border-top:0}'
    + '.psz .lr{display:flex;align-items:center;justify-content:space-between;gap:10px}.psz .nm{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12.5px}'
    + '.psz .pk{display:inline-flex;align-items:center;gap:5px;flex-shrink:0;border:1px dashed rgba(255,255,255,.25);border-radius:999px;background:transparent;color:inherit;opacity:.75;padding:4px 11px 4px 8px;font-size:11.5px;cursor:pointer}'
    + '.psz .pk:hover{opacity:1;border-color:var(--pa)}.psz .pk.ok{border-style:solid;border-color:var(--pa);opacity:1;background:color-mix(in srgb,var(--pa) 14%,transparent)}.psz .pk .ic{width:22px;height:22px;background:#111727;border-radius:50%;padding:1px}.psz h4 .ic.sm,.psz .pk .ic.sm{background:none}'
    + '.psz .dr{padding-top:4px}'
    + '.psz.psz-cell{display:inline-block;margin:0;padding:0;border:0;background:none}.psz.psz-drawer{margin-top:6px;padding:8px 10px}'
    // v1.6 商品表格
    + '.pt{border:1px solid var(--line,rgba(255,255,255,.1));border-radius:10px;padding:8px}'
    + '.pt-head,.pt-row{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1.7fr) minmax(0,.8fr) auto 26px;gap:8px;align-items:center}'
    + '.pt-head{font-size:10px;opacity:.55;padding:2px 4px 6px;letter-spacing:.5px}'
    + '.pt-row{padding:6px 0;border-top:1px solid var(--line,rgba(255,255,255,.08))}.pt-row:first-child{border-top:0}.pt-row input{margin:0}'
    + '.pt-drawer{grid-column:1/-1}.pt-del{background:none;border:0;color:inherit;opacity:.45;cursor:pointer;font-size:13px;padding:4px}.pt-del:hover{opacity:1;color:#ff8a8a}'
    + '.pt-add{margin-top:8px;width:100%;background:none;border:1px dashed var(--line,rgba(255,255,255,.18));color:inherit;opacity:.8;border-radius:8px;padding:8px 14px;font-size:12px;cursor:pointer}.pt-add:hover{opacity:1}'
    + '@media (max-width:600px){.pt-head{display:none}.pt-row{grid-template-columns:minmax(0,1fr) auto 26px}.pt-row .pt-name,.pt-row .pt-use{grid-column:1/-1}}';
  function ensureCss() {
    if (document.getElementById('psz-css')) return;
    var st = document.createElement('style'); st.id = 'psz-css'; st.textContent = CSS; document.head.appendChild(st);
  }

  function mount(box, opts) {
    if (!box) return;
    ensureCss();
    opts = opts || {};
    var getP = opts.getProduct || function () { return (typeof window.getCurrentRotationProduct === 'function') ? window.getCurrentRotationProduct() : null; };
    var lastSig = null, sel = { pack: '', piece: '', w: '', h: '', pc: '' };
    var open = false, need = false;   // v1.8 open = 已存也展開(按了「改」);need = 生成時被擋下(紅框)
    var REQ = opts.required ? '<span class="req">必選</span>' : '';

    function render(force) {
      var p = getP();
      var sig = p ? [p.brandId, p.prodId, p.realSize, p.placeNote, p.placement, p.productMode, open, need].join('|') : '';
      if (!force && sig === lastSig) return;
      lastSig = sig;
      if (!p || !PHYSICAL.test(String(p.placement || '')) || NO_SIZE_MODES.test(String(p.productMode || ''))) { box.innerHTML = ''; box.style.display = 'none'; return; }
      box.style.display = '';
      var s = readState(p);
      sel = { pack: s.packKey, piece: s.pieceKey, w: s.w && s.h ? s.w : '', h: s.w && s.h ? s.h : '', pc: (s.piece && !s.pieceKey) ? String(s.piece) : '' };
      var name = esc(p.name || p.prodName || '這個商品');
      //  v1.8 存好了 → 縮成一行;點「改」才展開
      if (s.filled && !open) {
        box.innerHTML = '<div class="psz mini"><h4>' + RULER + '商品實際大小' + REQ + '</h4><p class="st">✅ 已存:' + esc(p.realSize || s.bigZh || '') + (s.piece && !_isBig(s.packKey, p) ? ' · 裡面一件約 ' + s.piece + ' cm' : '') + '<a class="ed">改</a></p></div>';
        box.querySelector('.ed').onclick = function () { open = true; render(true); };
        return;
      }
      var status = s.filled
        ? '<p class="st">✅ 已存:' + esc(p.realSize || s.bigZh || '') + (s.piece && !_isBig(s.packKey, p) ? ' · 裡面一件約 ' + s.piece + ' cm' : '') + ' —— 系統會照這個大小做尺寸參考照</p>'
        : '<p class="st warn">⚠️ 「' + name + '」還沒填尺寸 —— ' + (opts.required ? '選好按「存起來」才能生成。' : '影片裡商品大小有機會不準(偏大或偏小)。') + '點一下就好:</p>';
      box.innerHTML = '<div class="psz' + (need && !s.filled ? ' need' : '') + '"><h4>' + RULER + '商品實際大小' + REQ + (s.filled ? '<a class="ed" data-x="1">收起</a>' : '') + '</h4>' + status
        + '<div class="lb">整包(整件)大概多大?</div><div data-g="pack">' + tiles(sel.pack) + '</div>'
        + '<div class="ex"><span class="lb" style="margin:0">想填準一點(公分):</span>寬 <input data-f="w" inputmode="decimal" value="' + esc(sel.w) + '"> × 高 <input data-f="h" inputmode="decimal" value="' + esc(sel.h) + '"> cm</div>'
        + '<div class="psz-piece"' + (_isBig(sel.pack, p) ? ' style="display:none"' : '') + '><div class="lb">裡面一件大概多大?(沒有內容物就不用點)</div><div class="row" data-g="piece">'
        + PIECE.map(function (o) { return '<button type="button" class="c' + (sel.piece === o.k ? ' on' : '') + '" data-k="' + o.k + '">' + o.t + '</button>'; }).join('')
        + ' <span class="lb" style="margin:0">或</span> <input data-f="pc" inputmode="decimal" placeholder="長" value="' + esc(sel.pc) + '"> cm</div></div>'
        + '<button type="button" class="sv">存起來</button><span class="msg"></span></div>';
      wireMore(box);
      var cl = box.querySelector('h4 .ed[data-x]'); if (cl) cl.onclick = function () { open = false; render(true); };
      box.querySelectorAll('[data-g] button.c').forEach(function (b) {
        b.onclick = function () {
          var gp = b.closest('[data-g]'), g = gp.getAttribute('data-g'), k = b.getAttribute('data-k');
          sel[g] = (sel[g] === k) ? '' : k;
          if (g === 'pack' && sel[g]) { sel.w = ''; sel.h = ''; box.querySelectorAll('input[data-f=w],input[data-f=h]').forEach(function (x) { x.value = ''; }); }
          if (g === 'pack') { var pw = box.querySelector('.psz-piece'); if (pw) pw.style.display = _isBig(sel.pack, p) ? 'none' : ''; }
          if (g === 'piece' && sel[g]) { sel.pc = ''; var pi = box.querySelector('input[data-f=pc]'); if (pi) pi.value = ''; }
          gp.querySelectorAll('button.c').forEach(function (x) { x.classList.toggle('on', x.getAttribute('data-k') === sel[g]); });
        };
      });
      box.querySelectorAll('input').forEach(function (i) { i.oninput = function () { sel[i.getAttribute('data-f')] = i.value.trim(); }; });
      var btn = box.querySelector('.sv'), msg = box.querySelector('.msg');
      btn.onclick = async function () {
        var pack = null; PACK.forEach(function (o) { if (o.k === sel.pack) pack = o; });
        var w = parseFloat(sel.w), h = parseFloat(sel.h);
        var exact = (w > 0 && h > 0) ? { w: w, h: h } : null;
        var pc = parseFloat(sel.pc); if (!(pc > 0)) { PIECE.forEach(function (o) { if (o.k === sel.piece) pc = o.cm; }); }
        if (!pack && !exact && !readState(p).filled) { msg.textContent = '先點整包大概多大,或填寬和高'; return; }
        btn.disabled = true; msg.textContent = '存檔中…';
        try {
          if (pack && pack.big) pc = 0;
          await save(p, opts.brandId || (window.S && window.S.currentBrandId) || p.brandId, pack, exact, pc > 0 ? pc : 0, typeof opts.ids === 'function' ? opts.ids() : null);
          msg.textContent = '✅ 存好了';
          setTimeout(function () { open = false; need = false; render(true); }, 900);
        } catch (e) { msg.textContent = '❌ ' + ((e && e.message) || e); btn.disabled = false; }
      };
    }
    render(true);
    var t = setInterval(function () { if (!document.body.contains(box)) { clearInterval(t); return; } render(false); }, 1500);
    return {
      refresh: function () { render(true); },
      //  v1.8 必選:面板有顯示(實體商品)而且還沒存 → 算缺
      missing: function () { var p = getP(); return !!(p && box.style.display !== 'none' && box.innerHTML && !readState(p).filled); },
      remind: function () { need = true; open = true; render(true); try { box.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {} }
    };
  }

  // ── KOL 工作室自動掛:#ref-list(STEP2)/ #ep-ref-list(STEP3)那一區的下面
  function autoMount() {
    ['ref-list', 'ep-ref-list'].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el || !el.parentNode) return;
      var host = el.parentNode;
      if (host.querySelector(':scope > .psz-host')) return;
      var box = document.createElement('div'); box.className = 'psz-host';
      host.appendChild(box);
      mount(box);
    });
  }
  //  v1.3 廣告圖頁:掛在「📦 擺放方式」那條(#ppl-chip,product-placement.js 畫的)下面
  function autoMountAd() {
    var chip = document.getElementById('ppl-chip');
    if (!chip || !chip.parentNode) return;
    if (chip.nextElementSibling && chip.nextElementSibling.classList.contains('psz-host')) return;
    var box = document.createElement('div'); box.className = 'psz-host';
    chip.parentNode.insertBefore(box, chip.nextSibling);
    _adSize = mount(box, {
      required: true,
      getProduct: function () { return (window.S && window.S.prod) || null; },
      ids: function () { var S0 = window.S || {}; return { brandId: S0.brandId || '', subId: S0.subId || '', prodId: (S0.prod && S0.prod.id) || '' }; },
      brandId: (window.S && window.S.brandId) || '',
    });
  }
  //  v1.8 廣告圖「必選」:按生成時,實體商品還沒存尺寸 → 不生成,面板展開 + 紅框 + 狀態列提醒
  var _adSize = null;
  function hookAdGen() {
    var g = window.generateGptPoster;
    if (typeof g !== 'function' || g.__sizeReq) return;
    var req = async function () {
      if (_adSize && document.body.contains(document.querySelector('.psz-host')) && _adSize.missing()) {
        _adSize.remind();
        if (typeof setPrStatus === 'function') setPrStatus('📏 請先選「商品實際大小」並按「存起來」,再按生成', '#ff9d9d');
        return;
      }
      return g.apply(this, arguments);
    };
    req.__sizeReq = true;
    Object.keys(g).forEach(function (k) { try { req[k] = g[k]; } catch (e) {} });   // 保留其他檔案掛的旗標(__director / _ppl…)
    window.generateGptPoster = req;
  }
  if (!/\/kol(\.html)?$/.test(location.pathname)) { setInterval(autoMountAd, 1500); setInterval(hookAdGen, 1500); }
  if (/\/kol(\.html)?$/.test(location.pathname)) {
    setInterval(autoMount, 2000);
    if (document.readyState !== 'loading') autoMount(); else document.addEventListener('DOMContentLoaded', autoMount);
  }

  // ══════════════════════════════════════════════════════════════
  //  v1.4 入駐問卷用:商品還沒建檔(沒有商品編號)→ 每一行商品各點一個大小,
  //   送出時接在行尾「｜尺寸:最長約27cm」/「｜尺寸:高約100cm(到大人的腰)」,核准時 Worker v7.59 拆回商品資料
  //   用法:var L = ProductSize.mountList(容器, { textarea: 商品欄位 }); 送出時用 L.compose(原文)
  // ══════════════════════════════════════════════════════════════
  function mountList(box, opts) {
    ensureCss();
    opts = opts || {};
    var ta = opts.textarea, picks = {}, last = '';
    function lines() { return String((ta && ta.value) || '').split('\n').map(function (x) { return x.trim(); }).filter(Boolean); }
    var openNm = '';
    function pickLabel(nm) {
      var o = null; PACK.forEach(function (x) { if (x.k === picks[nm]) o = x; });
      return o ? '<button type="button" class="pk ok">' + icon(o.k) + SHORT[o.k] + '</button>'
               : '<button type="button" class="pk">' + RULER + '多大?</button>';
    }
    function render(force) {
      var ls = lines(), sig = ls.join('\n') + '§' + openNm;
      if (!force && sig === last) return; last = sig;
      if (!ls.length) { box.innerHTML = ''; return; }
      box.innerHTML = '<div class="psz"><h4>' + RULER + '商品大概多大?<span style="font-weight:400;opacity:.55;font-size:11px">選填</span></h4>'
        + '<p class="st">點一下選大小,AI 影片裡商品的比例會更準。服務、課程不用選。</p>'
        + ls.map(function (nm, i) {
          return '<div class="it" data-i="' + i + '"><div class="lr"><span class="nm">' + esc(nm) + '</span>' + pickLabel(nm) + '</div>'
            + (openNm === nm ? '<div class="dr">' + tiles(picks[nm] || '') + '</div>' : '') + '</div>';
        }).join('') + '</div>';
      wireMore(box);
      box.querySelectorAll('.it[data-i]').forEach(function (it) {
        var nm = ls[+it.getAttribute('data-i')];
        it.querySelector('.pk').onclick = function () { openNm = (openNm === nm) ? '' : nm; render(true); };
        it.querySelectorAll('.tiles button.c').forEach(function (b) {
          b.onclick = function () {
            var k = b.getAttribute('data-k');
            picks[nm] = (picks[nm] === k) ? '' : k;
            if (picks[nm]) openNm = '';      // 選好就收起來,縮成一行
            render(true);
          };
        });
      });
    }
    function compose(text) {
      return String(text || '').split('\n').map(function (ln) {
        var nm = ln.trim(); if (!nm) return ln;
        var o = null; PACK.forEach(function (x) { if (x.k === picks[nm]) o = x; });
        if (!o) return ln;
        return nm + '｜尺寸:' + (o.big ? '高約' + o.cm + 'cm(' + o.big + ')' : '最長約' + o.cm + 'cm');
      }).join('\n');
    }
    render();
    if (ta) ta.addEventListener('input', render);
    var t = setInterval(function () { if (!document.body.contains(box)) { clearInterval(t); return; } render(); }, 2000);
    return { compose: compose, picks: picks };
  }

  // ══════════════════════════════════════════════════════════════
  //  v1.6 表格用:一格放「多大?」按鈕,點開的圖示卡片放在另一個容器(通常是該列下方整列寬)
  //   用法:var c = ProductSize.mountCell(按鈕容器, { drawer: 抽屜容器, value: 'p1', onChange: function (key) {} });
  //         c.get() → 'p1' / '' ; c.set('waist'); ProductSize.composeLine('電動機車', c.get())
  // ══════════════════════════════════════════════════════════════
  function composeLine(name, key) {
    var nm = String(name || '').trim(); if (!nm) return '';
    var o = null; PACK.forEach(function (x) { if (x.k === key) o = x; });
    if (!o) return nm;
    return nm + '｜尺寸:' + (o.big ? '高約' + o.cm + 'cm(' + o.big + ')' : '最長約' + o.cm + 'cm');
  }
  function mountCell(host, opts) {
    ensureCss();
    opts = opts || {};
    var key = opts.value || '', open = false, drawer = opts.drawer || null;
    function render() {
      var o = null; PACK.forEach(function (x) { if (x.k === key) o = x; });
      host.innerHTML = '<span class="psz psz-cell">' + (o
        ? '<button type="button" class="pk ok">' + icon(o.k) + SHORT[o.k] + '</button>'
        : '<button type="button" class="pk">' + RULER + '多大?</button>') + '</span>';
      host.querySelector('.pk').onclick = function () { open = !open; render(); };
      if (drawer) {
        drawer.innerHTML = open ? '<div class="psz psz-drawer">' + tiles(key) + '</div>' : '';
        drawer.style.display = open ? '' : 'none';
        if (open) {
          wireMore(drawer);
          drawer.querySelectorAll('.tiles button.c').forEach(function (b) {
            b.onclick = function () {
              var k = b.getAttribute('data-k');
              key = (key === k) ? '' : k;
              if (key) open = false;
              render();
              if (typeof opts.onChange === 'function') opts.onChange(key);
            };
          });
        }
      }
    }
    render();
    return { get: function () { return key; }, set: function (k) { key = k || ''; open = false; render(); } };
  }

  // ══════════════════════════════════════════════════════════════
  //  v1.6 入駐問卷商品表格:一列 = 名稱 + 售價 + 尺寸,按「+」多一列,預設 1 列
  //   用法:var T = ProductSize.mountTable(容器, { products: 隱藏的名稱欄(textarea), price: 隱藏的售價欄(input) });
  //         T.compose() → 送出用「名稱｜尺寸:…」一行一個;T.check() → { ok, msg, el }
  //   隱藏欄自動同步:products = 名稱一行一個;price = 「名稱 售價；名稱 售價」—— 靈魂書與舊欄位照常讀
  // ══════════════════════════════════════════════════════════════
  function mountTable(box, opts) {
    ensureCss();
    opts = opts || {};
    box.innerHTML = '<div class="pt"><div class="pt-head"><span>商品名稱 *</span><span>這是什麼、怎麼用 *</span><span>售價(選填)</span><span>大概多大</span><span></span></div><div class="pt-rows"></div></div>'
      + '<button type="button" class="pt-add">＋ 再加一個商品</button>';
    var rowsEl = box.querySelector('.pt-rows');
    function rows() { return Array.prototype.slice.call(rowsEl.querySelectorAll('.pt-row')); }
    function data() {
      return rows().map(function (r) { return { r: r, n: r.querySelector('.pt-name').value.trim(), u: r.querySelector('.pt-use').value.trim().replace(/[｜|]/g, '/'), p: r.querySelector('.pt-price').value.trim(), k: r._cell ? r._cell.get() : '' }; });
    }
    function sync() {
      var named = data().filter(function (x) { return x.n; });
      if (opts.products) opts.products.value = named.map(function (x) { return x.n + (x.u ? '(' + x.u + ')' : ''); }).join('\n');   // 靈魂書讀這欄:名稱後面帶用途
      if (opts.price) opts.price.value = named.filter(function (x) { return x.p; }).map(function (x) { return x.n + ' ' + x.p; }).join('；');
      var rs = rows(); rs.forEach(function (r) { r.querySelector('.pt-del').style.visibility = rs.length > 1 ? '' : 'hidden'; });
      if (typeof opts.onChange === 'function') opts.onChange();
    }
    function add(name, price, focus, use) {
      var row = document.createElement('div'); row.className = 'pt-row';
      row.innerHTML = '<input type="text" class="pt-name" placeholder="例:米香腸原味 280g"><input type="text" class="pt-use" placeholder="例:眼鏡收納包,可掛在胸前"><input type="text" class="pt-price" placeholder="例:NT$280">'
        + '<span class="pt-size"></span><button type="button" class="pt-del" title="刪除這一列">✕</button><div class="pt-drawer" style="display:none"></div>';
      rowsEl.appendChild(row);
      row.querySelector('.pt-name').value = name || ''; row.querySelector('.pt-use').value = use || ''; row.querySelector('.pt-price').value = price || '';
      row.querySelectorAll('input').forEach(function (i) { i.addEventListener('input', sync); });
      row.querySelector('.pt-del').onclick = function () { row.remove(); sync(); };
      row._cell = mountCell(row.querySelector('.pt-size'), { drawer: row.querySelector('.pt-drawer'), onChange: sync });
      sync();
      if (focus) row.querySelector('.pt-name').focus();
    }
    box.querySelector('.pt-add').onclick = function () { add('', '', true); };
    add('', '', false);
    return {
      add: add,
      compose: function () { return data().filter(function (x) { return x.n; }).map(function (x) { return composeLine(x.n + (x.u ? '｜用途:' + x.u : ''), x.k); }).join('\n'); },
      check: function () {
        var rs = data().filter(function (x) { return x.n; });
        if (!rs.length) return { ok: false, msg: '至少填一個商品名稱,寫完整一點(例:米香腸原味 280g),AI 出圖才抓得準。', el: box.querySelector('.pt-name') };
        for (var i = 0; i < rs.length; i++) {
          if (rs[i].n.length < 2) return { ok: false, msg: '「' + rs[i].n + '」太短了,寫完整商品名(例:米香腸原味 280g)。', el: rs[i].r.querySelector('.pt-name') };
          if (rs[i].u.length < 2) return { ok: false, msg: '「' + rs[i].n + '」還沒寫「這是什麼、怎麼用」。一句話就好,例:眼鏡收納包,可掛在胸前', el: rs[i].r.querySelector('.pt-use') };
        }
        return { ok: true };
      },
    };
  }

  window.ProductSize = { version: VERSION, mount: mount, readState: readState, mountList: mountList, mountCell: mountCell, composeLine: composeLine, mountTable: mountTable };
})();
