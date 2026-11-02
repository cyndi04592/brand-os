/* ═══════════════════════════════════════════════════════════════════
 *  product-size.js · v1.1(2026-11-02)商品尺寸點選器(KOL 工作室 / 廣告圖 / 入駐 共用)
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
  var VERSION = 'v1.1';
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
    return { w: w, h: h, mx: mx, packKey: packKey, piece: piece, pieceKey: pieceKey, filled: !!(mx || bigZh) };
  }

  // ── 存:沿用 Worker 的 product_placement_set(要帶 placement)
  async function save(p, brandId, pack, exact, piece) {
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
    var body = { action: 'product_placement_set', password: cfg.PASSWORD, brandId: brandId || p.brandId, subId: p.subId || '', prodId: p.prodId || '', placement: place, placeNote: note.slice(0, 300), realSize: rs };
    var r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    var d = await r.json().catch(function () { return { ok: false, error: '回應不是 JSON' }; });
    if (!d || d.ok === false) throw new Error((d && d.error) || '存檔失敗');
    // 畫面上的商品物件同步改(下一支影片馬上用到新尺寸)
    p.placement = d.placement || place; p.placeNote = d.placeNote != null ? d.placeNote : note; p.realSize = rs;
    try {
      ((window.S && window.S.products) || []).forEach(function (x) {
        if (x !== p && x.brandId === p.brandId && x.prodId === p.prodId && (x.subId || '') === (p.subId || '')) { x.placement = p.placement; x.placeNote = p.placeNote; x.realSize = rs; }
      });
    } catch (_) {}
    return rs;
  }

  // ── 畫面
  var CSS = '.psz{margin-top:12px;padding:10px 12px;border:1px solid #2a2a2a;border-radius:10px;background:rgba(255,255,255,.02);font-size:12px}'
    + '.psz h4{margin:0 0 6px;font-size:12px;font-weight:600}.psz .st{font-size:11px;margin:0 0 8px;opacity:.8}.psz .st.warn{color:#f5b041;opacity:1}'
    + '.psz .row{display:flex;flex-wrap:wrap;gap:6px;margin:4px 0 8px}.psz .lb{font-size:11px;opacity:.6;margin-top:4px}'
    + '.psz button.c{border:1px solid #3a3a46;background:transparent;color:inherit;border-radius:14px;padding:4px 10px;font-size:12px;cursor:pointer}'
    + '.psz button.c.on{border-color:#8b7cf6;background:rgba(139,124,246,.18)}.psz input{width:58px;background:transparent;border:1px solid #3a3a46;border-radius:6px;color:inherit;padding:3px 6px;font-size:12px}'
    + '.psz .ex{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin:2px 0 8px}.psz .sv{border:0;border-radius:8px;padding:6px 14px;background:#8b7cf6;color:#fff;cursor:pointer;font-size:12px}'
    + '.psz .sv:disabled{opacity:.5;cursor:default}.psz .msg{font-size:11px;margin-left:8px}';
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
      var sig = p ? [p.brandId, p.prodId, p.realSize, p.placeNote, p.placement].join('|') : '';
      if (!force && sig === lastSig) return;
      lastSig = sig;
      if (!p || !PHYSICAL.test(String(p.placement || ''))) { box.innerHTML = ''; box.style.display = 'none'; return; }
      box.style.display = '';
      var s = readState(p);
      sel = { pack: s.packKey, piece: s.pieceKey, w: s.w && s.h ? s.w : '', h: s.w && s.h ? s.h : '', pc: (s.piece && !s.pieceKey) ? String(s.piece) : '' };
      var name = esc(p.name || p.prodName || '這個商品');
      var status = s.filled
        ? '<p class="st">✅ 已存:' + esc(p.realSize || '') + (s.piece ? ' · 裡面一件約 ' + s.piece + ' cm' : '') + ' —— 系統會照這個大小做尺寸參考照</p>'
        : '<p class="st warn">⚠️ 「' + name + '」還沒填尺寸 —— 影片裡商品大小有機會不準(偏大或偏小)。點一下就好:</p>';
      box.innerHTML = '<div class="psz"><h4>📏 商品實際大小</h4>' + status
        + '<div class="lb">整包(整件)大概多大?</div><div class="row" data-g="pack">'
        + PACK.map(function (o) { return '<button type="button" class="c' + (sel.pack === o.k ? ' on' : '') + '" data-k="' + o.k + '">' + o.t + '</button>'; }).join('') + '</div>'
        + '<div class="ex"><span class="lb" style="margin:0">想填準一點(公分):</span>寬 <input data-f="w" inputmode="decimal" value="' + esc(sel.w) + '"> × 高 <input data-f="h" inputmode="decimal" value="' + esc(sel.h) + '"> cm</div>'
        + '<div class="lb">裡面一件大概多大?(沒有內容物就不用點)</div><div class="row" data-g="piece">'
        + PIECE.map(function (o) { return '<button type="button" class="c' + (sel.piece === o.k ? ' on' : '') + '" data-k="' + o.k + '">' + o.t + '</button>'; }).join('')
        + ' <span class="lb" style="margin:0">或</span> <input data-f="pc" inputmode="decimal" placeholder="長" value="' + esc(sel.pc) + '"> cm</div>'
        + '<button type="button" class="sv">存起來</button><span class="msg"></span></div>';
      box.querySelectorAll('.row button.c').forEach(function (b) {
        b.onclick = function () {
          var g = b.parentNode.getAttribute('data-g'), k = b.getAttribute('data-k');
          sel[g] = (sel[g] === k) ? '' : k;
          if (g === 'pack' && sel[g]) { sel.w = ''; sel.h = ''; box.querySelectorAll('input[data-f=w],input[data-f=h]').forEach(function (x) { x.value = ''; }); }
          if (g === 'piece' && sel[g]) { sel.pc = ''; var pi = box.querySelector('input[data-f=pc]'); if (pi) pi.value = ''; }
          b.parentNode.querySelectorAll('button.c').forEach(function (x) { x.classList.toggle('on', x.getAttribute('data-k') === sel[g]); });
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
          await save(p, opts.brandId || (window.S && window.S.currentBrandId) || p.brandId, pack, exact, pc > 0 ? pc : 0);
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
  if (/\/kol(\.html)?$/.test(location.pathname)) {
    setInterval(autoMount, 2000);
    if (document.readyState !== 'loading') autoMount(); else document.addEventListener('DOMContentLoaded', autoMount);
  }

  window.ProductSize = { version: VERSION, mount: mount, readState: readState };
})();
