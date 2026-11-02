/* ═══════════════════════════════════════════════════════════════════
 *  product-size.js · v1.5(2026-11-02)商品尺寸點選器(KOL 工作室 / 廣告圖 / 入駐 共用)
 *  v1.5 RA:「給客戶選的那端簡單一點、有設計感一點」(圖示定案:白卡片 + 黑描邊 + 卡通圓手 + 金色量尺/商品箱)→ 主選項只留 6 顆(配小圖示),其他收進「更細 ▾」;
 *       入駐問卷每個商品平常只露一顆「多大?」小按鈕,選好縮成一行。存的格式完全沒變(Worker 照舊讀得懂)
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
  var VERSION = 'v1.5';
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
  //  小圖示 v1.5d/e(RA 參考圖:黑色粗描邊插畫 + 實心黑髮 + 一個亮色 + 淡灰,放在白色圓角卡片上)—— 原創圖形
  //   ★ 手 = 一個單位;旁邊亮色量尺上的刻度 = 幾個手掌長
  //   ★ 大件:小人站在地上,旁邊一個亮色商品箱,箱子高度 = 到膝蓋 / 腰 / 胸口 / 跟人一樣高
  //  v1.5e RA 參考圖(卡通圓胖手線條 icon):手改成圓滾滾的卡通手,手腕開口、掌心一道弧線;背後一顆淡金色圓
  var HAND_D = 'M3.6 21.5C3.4 18.5 2.6 16.8 1.6 15.2C.6 13.6 1.8 12.2 3.2 13.2L4.4 14.2C4 10.5 3.8 7.4 4 6C4.2 4.4 6.4 4.4 6.4 6L6.6 10'
    + 'C6.6 6.6 6.6 4 6.8 3C7 1.4 9.2 1.4 9.3 3L9.4 9.8C9.6 6.8 9.8 5 10 4.2C10.3 2.8 12.3 3 12.2 4.6L12 10.4'
    + 'C12.4 8.6 12.8 7.6 13.2 7.2C14.2 6.4 15.4 7.2 14.9 8.6C14.2 11 14 13.4 13.6 15.6C13.2 18 12 19.6 11.6 21.5';
  var HAND_IN = 'M6.8 15.2C8 16.3 9.9 16.3 11.1 15.2';   // 掌心弧線
  function icon(k) {
    var FLOOR = '<path class="ink" d="M1 22.2H23"/>';
    function hand(sc) {
      var y0 = (22.2 - 21.5 * sc).toFixed(2), x0 = (14 - 15 * sc).toFixed(2), tf = 'translate(' + x0 + ' ' + y0 + ') scale(' + sc + ')', sw = (1.35 / sc).toFixed(2);
      return '<circle class="sun" cx="' + (14 - 15 * sc + 6 * sc).toFixed(2) + '" cy="' + (22.2 - 21.5 * sc + 6 * sc).toFixed(2) + '" r="' + (6.5 * sc).toFixed(2) + '"/>'
        + '<path class="wf" transform="' + tf + '" style="stroke-width:' + sw + '" d="' + HAND_D + '"/>'
        + (sc > .6 ? '<path class="ink" transform="' + tf + '" style="stroke-width:' + sw + '" d="' + HAND_IN + '"/>' : '');
    }
    function bar(top, n) {   // 亮色量尺 + 刻度(n 個單位)
      var h = 22.2 - top, d = '';
      for (var i = 1; i < n; i++) d += 'M15.6 ' + (22.2 - h * i / n).toFixed(2) + 'H17.6';
      return '<rect class="ac" x="15.6" y="' + top.toFixed(2) + '" width="3.6" height="' + h.toFixed(2) + '" rx="1.2"/>' + (d ? '<path class="ink" d="' + d + '"/>' : '');
    }
    function person(top) {
      var box = 22.2 - top;
      return '<circle class="sun" cx="5.6" cy="5.4" r="4.6"/><ellipse class="gy" cx="7.2" cy="22.2" rx="4.6" ry=".9"/>'
        + '<rect class="ink-f" x="5.3" y="14" width="1.9" height="8" rx=".9"/><rect class="ink-f" x="7.5" y="14" width="1.9" height="8" rx=".9"/>'
        + '<path class="wf" d="M4.5 7.4Q7.3 6 10.1 7.4L10.6 14.6H4Z"/>'
        + '<circle class="wf" cx="7.3" cy="4.1" r="2"/>'
        + '<path class="ink-f" d="M5.2 4.6C4.8 2.3 6.1 1.5 7.4 1.5C9 1.5 9.8 2.6 9.5 4.9C8.8 3.9 7.6 3.4 6.2 3.7C5.8 3.9 5.5 4.2 5.2 4.6Z"/>'
        + '<rect class="ac" x="14" y="' + top.toFixed(2) + '" width="7" height="' + box.toFixed(2) + '" rx="1.3"/>'
        + (box > 4 ? '<rect class="wh" x="15.3" y="' + (top + 1.3).toFixed(2) + '" width="4.4" height="1.3" rx=".65"/>' : '');
    }
    var g = '';
    if (k === 'finger') g = FLOOR + '<circle class="sun" cx="8.6" cy="7" r="5"/><path class="wf" d="M8.4 22.2V6.2C8.4 3.4 12 3.4 12 6.2V22.2Z"/><path class="gy" d="M9.4 6.6C9.4 5.2 11 5.2 11 6.6V8.4H9.4Z"/>' + bar(3.8, 1);
    else if (k === 'half') g = FLOOR + hand(0.95) + bar(22.2 - 20.1 * 0.95 / 2, 1);
    else if (k === 'p1') g = FLOOR + hand(0.95) + bar(22.2 - 20.1 * 0.95, 1);
    else if (k === 'p15') g = FLOOR + hand(0.66) + bar(2, 3);   // 小圖太小時手不縮,改用量尺上的刻度表示「幾個手掌」
    else if (k === 'p2') g = FLOOR + hand(0.62) + bar(1.4, 2);
    else if (k === 'p3') g = FLOOR + hand(0.58) + bar(0.8, 3);
    else if (k === 'knee') g = FLOOR + person(16);
    else if (k === 'waist') g = FLOOR + person(12.6);
    else if (k === 'chest') g = FLOOR + person(8.4);
    else if (k === 'human') g = FLOOR + person(2);
    else if (k === 'taller') g = FLOOR + person(-0.6);
    return '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">' + g + '</svg>';
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
    + '.psz h4{margin:0 0 4px;font-size:13px;font-weight:600;display:flex;align-items:center;gap:6px}.psz .st{font-size:11.5px;margin:0 0 10px;opacity:.65;line-height:1.5}.psz .st.warn{color:#f5b041;opacity:1}'
    + '.psz .row{display:flex;flex-wrap:wrap;gap:6px;margin:4px 0 8px}.psz .lb{font-size:11px;opacity:.6;margin-top:4px}'
    + '.psz .ic{width:42px;height:42px;overflow:visible;--ink:#1f2230}.psz .ic .ink{fill:none;stroke:var(--ink);stroke-width:1.35;stroke-linecap:round}.psz .ic .ink-f{fill:var(--ink)}.psz .ic .wf{fill:#fff;stroke:var(--ink);stroke-width:1.35;stroke-linejoin:round;stroke-linecap:round}.psz .ic .ac{fill:var(--pg);stroke:var(--ink);stroke-width:1.35;stroke-linejoin:round}.psz .ic .gy{fill:#d9dce4}.psz .ic .sun{fill:var(--pg);opacity:.38}.psz .ic .wh{fill:#fff;opacity:.85}.psz .ic.sm{width:16px;height:16px}.psz .ic.sm .ink{stroke-width:1.6}'
    + '.psz .tiles{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:6px;margin:6px 0 4px}'
    + '.psz .tiles button.c{display:flex;flex-direction:column;align-items:center;gap:5px;padding:10px 2px 8px;border:2px solid transparent;border-radius:14px;background:#f5f6fa;color:#2a2d3a;cursor:pointer;font-size:11.5px;font-weight:600;line-height:1.2;box-shadow:0 2px 0 rgba(0,0,0,.25);transition:transform .15s,box-shadow .15s,border-color .15s}'
    + '.psz .tiles button.c:hover{transform:translateY(-2px);box-shadow:0 5px 12px rgba(0,0,0,.3)}'
    + '.psz .tiles button.c.on{border-color:var(--pa);background:#fff;box-shadow:0 0 0 3px color-mix(in srgb,var(--pa) 35%,transparent)}'
    + '.psz .mo{background:none;border:0;color:inherit;opacity:.55;font-size:11px;cursor:pointer;padding:2px 0;margin:0 0 4px}.psz .mo:hover{opacity:.9}'
    + '.psz .row button.c{border:1px solid rgba(255,255,255,.12);background:transparent;color:inherit;border-radius:14px;padding:4px 10px;font-size:12px;cursor:pointer}'
    + '.psz .row button.c.on{border-color:var(--pa);background:color-mix(in srgb,var(--pa) 18%,transparent)}.psz input{width:58px;background:transparent;border:1px solid rgba(255,255,255,.14);border-radius:6px;color:inherit;padding:3px 6px;font-size:12px}'
    + '.psz .ex{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin:4px 0 8px}.psz .sv{border:0;border-radius:8px;padding:7px 16px;background:var(--pa);color:#fff;cursor:pointer;font-size:12px}'
    + '.psz .sv:disabled{opacity:.5;cursor:default}.psz .msg{font-size:11px;margin-left:8px}'
    // 入駐問卷:每個商品一行
    + '.psz .it{border-top:1px solid rgba(255,255,255,.06);padding:8px 0}.psz .it:first-of-type{border-top:0}'
    + '.psz .lr{display:flex;align-items:center;justify-content:space-between;gap:10px}.psz .nm{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12.5px}'
    + '.psz .pk{display:inline-flex;align-items:center;gap:5px;flex-shrink:0;border:1px dashed rgba(255,255,255,.25);border-radius:999px;background:transparent;color:inherit;opacity:.75;padding:4px 11px 4px 8px;font-size:11.5px;cursor:pointer}'
    + '.psz .pk:hover{opacity:1;border-color:var(--pa)}.psz .pk.ok{border-style:solid;border-color:var(--pa);opacity:1;background:color-mix(in srgb,var(--pa) 14%,transparent)}.psz .pk .ic{width:20px;height:20px;background:#f5f6fa;border-radius:50%;padding:1px}.psz h4 .ic.sm,.psz .pk .ic.sm{background:none}'
    + '.psz .dr{padding-top:4px}'
    + '@media (max-width:560px){.psz .tiles{grid-template-columns:repeat(3,minmax(0,1fr))}}';
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

    function render(force) {
      var p = getP();
      var sig = p ? [p.brandId, p.prodId, p.realSize, p.placeNote, p.placement, p.productMode].join('|') : '';
      if (!force && sig === lastSig) return;
      lastSig = sig;
      if (!p || !PHYSICAL.test(String(p.placement || '')) || NO_SIZE_MODES.test(String(p.productMode || ''))) { box.innerHTML = ''; box.style.display = 'none'; return; }
      box.style.display = '';
      var s = readState(p);
      sel = { pack: s.packKey, piece: s.pieceKey, w: s.w && s.h ? s.w : '', h: s.w && s.h ? s.h : '', pc: (s.piece && !s.pieceKey) ? String(s.piece) : '' };
      var name = esc(p.name || p.prodName || '這個商品');
      var status = s.filled
        ? '<p class="st">✅ 已存:' + esc(p.realSize || s.bigZh || '') + (s.piece && !_isBig(s.packKey, p) ? ' · 裡面一件約 ' + s.piece + ' cm' : '') + ' —— 系統會照這個大小做尺寸參考照</p>'
        : '<p class="st warn">⚠️ 「' + name + '」還沒填尺寸 —— 影片裡商品大小有機會不準(偏大或偏小)。點一下就好:</p>';
      box.innerHTML = '<div class="psz"><h4>' + RULER + '商品實際大小</h4>' + status
        + '<div class="lb">整包(整件)大概多大?</div><div data-g="pack">' + tiles(sel.pack) + '</div>'
        + '<div class="ex"><span class="lb" style="margin:0">想填準一點(公分):</span>寬 <input data-f="w" inputmode="decimal" value="' + esc(sel.w) + '"> × 高 <input data-f="h" inputmode="decimal" value="' + esc(sel.h) + '"> cm</div>'
        + '<div class="psz-piece"' + (_isBig(sel.pack, p) ? ' style="display:none"' : '') + '><div class="lb">裡面一件大概多大?(沒有內容物就不用點)</div><div class="row" data-g="piece">'
        + PIECE.map(function (o) { return '<button type="button" class="c' + (sel.piece === o.k ? ' on' : '') + '" data-k="' + o.k + '">' + o.t + '</button>'; }).join('')
        + ' <span class="lb" style="margin:0">或</span> <input data-f="pc" inputmode="decimal" placeholder="長" value="' + esc(sel.pc) + '"> cm</div></div>'
        + '<button type="button" class="sv">存起來</button><span class="msg"></span></div>';
      wireMore(box);
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
          setTimeout(function () { render(true); }, 900);
        } catch (e) { msg.textContent = '❌ ' + ((e && e.message) || e); btn.disabled = false; }
      };
    }
    render(true);
    var t = setInterval(function () { if (!document.body.contains(box)) { clearInterval(t); return; } render(false); }, 1500);
    return { refresh: function () { render(true); } };
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
    mount(box, {
      getProduct: function () { return (window.S && window.S.prod) || null; },
      ids: function () { var S0 = window.S || {}; return { brandId: S0.brandId || '', subId: S0.subId || '', prodId: (S0.prod && S0.prod.id) || '' }; },
      brandId: (window.S && window.S.brandId) || '',
    });
  }
  if (!/\/kol(\.html)?$/.test(location.pathname)) setInterval(autoMountAd, 1500);
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

  window.ProductSize = { version: VERSION, mount: mount, readState: readState, mountList: mountList };
})();
