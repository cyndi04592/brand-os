/* ═══════════════════════════════════════════════════════════════════
 *  ad-textlayer.js · v1.1(2026-11-13)廣告圖「系統壓字」
 *  v1.1 實測 19 款:07/15/17 字疊到 LOGO → 先猜 LOGO 會放的角,字避開;05 字靠左把右邊讓給 LOGO;28 小字改壓在人前面
 *  RA 11-13:「客人打大標跟小標,就能精準地畫字」→ 字不再交給 AI 畫,改由系統用真字型壓上去
 *           (跟 KOL 字幕燒字機同一個道理)。排法 = RA 從 Pinterest 研究 32 款裡挑的 20 款。
 *  RA 定的規則:
 *   · 不預約空位:AI 只管把照片拍好看,構圖自由;生完圖系統自己找空位壓字
 *   · 找空位:去背拿主體輪廓(fal birefnet,不扣客人點數)+ 量畫面亂不亂 → 字不壓到人與商品
 *   · 找不到空位 → 改用自帶底的排法(05 毛玻璃橫條 / 25 底部色帶),字永遠讀得到
 *   · 字旁邊不放短橫線(RA:會被看成「一」)
 *   · 28 款「字在主體後面」用去背遮罩把人疊回字的前面
 *   · 先壓字、再疊 LOGO:LOGO 量四角時會把字當成「有東西」自動避開
 *  做法(不動 admaker.js):
 *   ① 包 applyPhotoroomBg:懶人廣告圖生成期間,大標/副標欄位對程式回傳空字串 → 提示詞變成無字乾淨照片
 *      (客人畫面上的字照樣在,不會被清掉)
 *   ② 包 compositeBrandLogo:畫布畫好照片後、疊 LOGO 前,把字壓上去
 *  緊急關閉:Console 打 window.AD_TEXTLAYER = false → 回到 AI 畫字(原本行為)
 *  載入:loader.js(只在首頁)
 * ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.AdTextLayer) return;
  var VERSION = '1.1';
  var ON = function () { return window.AD_TEXTLAYER !== false; };
  var SANS = '"Noto Sans TC", sans-serif', SERIF = '"Noto Serif TC", serif';
  var INK = '#1a1a1c', WHITE = '#ffffff';

  // ── 排法清單(RA 11-13 定案 20 款)───────────────────────────────
  var NAMES = { 1: '極簡細字', 2: '底部置中小字', 3: '長細線+直排小字', 4: '括號標題', 5: '毛玻璃橫條', 6: '瑞士格線大字',
    7: '兩行大標', 9: '白邊框留白', 10: '底部巨大字', 11: '大字+說明', 12: '明體大標', 15: '明體直排+細線', 16: '雜誌跳字',
    17: '單側巨字直排', 18: '左右分字', 20: '直排小字', 21: '巨大數字折扣', 25: '底部色帶', 26: '斜貼標籤', 28: '字在主體後面' };
  var PROMO = /double11|double12|promo_sale|year_end_sale|black_friday|limited_stock|brand_anniversary|nye_countdown/;
  var ZEN = /ink_zen|craft_ceramic|brand_muji|japan_kinfolk|japan_minimal|jp_vintage_craft/;
  var BOLD = /big_statement|magazine_cover|dramatic/;

  // ── 小工具 ─────────────────────────────────────────────────────
  function g(n) { try { return eval(n); } catch (e) { return undefined; } }   // 讀 admaker 的 let 全域(SELECTED_* / PR_BG_IMG …)
  var realVal = {};      // 欄位真正的值(生成期間程式讀到空字串,這裡拿得到真的)
  function title() {
    var h = document.getElementById('gptHeadline'), s = document.getElementById('gptSubHeadline');
    return { h: String(h ? (realVal.h ? realVal.h.call(h) : h.value) : '').trim(), s: String(s ? (realVal.s ? realVal.s.call(s) : s.value) : '').trim() };
  }
  function font(w, px, serif) { return w + ' ' + Math.round(px) + 'px ' + (serif ? SERIF : SANS); }
  function tw(ctx, s, f, tr) { ctx.font = f; var w = 0; for (var i = 0; i < s.length; i++) w += ctx.measureText(s[i]).width + (tr || 0); return s.length ? w - (tr || 0) : 0; }
  function put(ctx, x, y, s, f, col, tr) {   // y = 字的上緣
    ctx.font = f; ctx.fillStyle = col; ctx.textBaseline = 'top'; ctx.textAlign = 'left';
    for (var i = 0; i < s.length; i++) { ctx.fillText(s[i], x, y); x += ctx.measureText(s[i]).width + (tr || 0); }
  }
  function vert(ctx, x, y, s, size, f, col, gap) {
    var step = size * (gap || 1.12); ctx.font = f; ctx.fillStyle = col; ctx.textBaseline = 'top'; ctx.textAlign = 'left';
    for (var i = 0; i < s.length; i++) {
      var c = s[i];
      if (/[，、。,]/.test(c)) { ctx.fillText('，', x + size * 0.55, y - size * 0.55); y += step * 0.35; continue; }
      if (c === ' ') { y += step * 0.5; continue; }
      ctx.fillText(c, x, y); y += step;
    }
    return y;
  }
  function vlen(s) { var n = 0; for (var i = 0; i < s.length; i++) n += /[，、。,]/.test(s[i]) ? 0.35 : (s[i] === ' ' ? 0.5 : 1); return n; }
  // 把標題拆成幾行:先照標點拆,沒有標點就從中間拆
  function split(h, n) {
    var parts = h.split(/(?<=[，,、。！!？?\s])/).map(function (x) { return x.trim(); }).filter(Boolean);
    if (parts.length >= 2) return parts.slice(0, n - 1).concat(parts.length >= n ? [parts.slice(n - 1).join('')] : []);
    if (n === 2 && h.length >= 4) { var m = Math.ceil(h.length / 2); return [h.slice(0, m), h.slice(m)]; }
    if (n >= 3 && h.length >= 6) { var a = Math.ceil(h.length / 3); return [h.slice(0, a), h.slice(a, a * 2), h.slice(a * 2)]; }
    return [h];
  }
  function lum(ctx, x, y, w, h) {
    try {
      var d = ctx.getImageData(Math.max(0, x | 0), Math.max(0, y | 0), Math.max(1, w | 0), Math.max(1, h | 0)).data, s = 0, n = 0;
      for (var i = 0; i < d.length; i += 16) { s += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; n++; }
      return s / n;
    } catch (e) { return 128; }
  }

  // ── 畫面分析:主體遮罩 + 邊緣密度(縮小到 96 格寬來算,快)───────────
  var maskCache = {};
  async function getMask(src) {
    if (!src) return null;
    if (maskCache[src] !== undefined) return maskCache[src];
    maskCache[src] = null;
    try {
      if (typeof callWorker !== 'function' || /^blob:/.test(src)) return null;
      var r = await Promise.race([
        callWorker({ action: 'fal_submit', endpoint: 'fal-ai/birefnet', payload: { image_url: src } }),
        new Promise(function (res) { setTimeout(function () { res(null); }, 30000); })
      ]);
      var url = r && r.ok && r.imageUrl;
      if (!url) { console.warn('[壓字] 去背沒拿到,改用畫面判斷', r && r.error); return null; }
      var li = await loadImageSmart(url);
      if (li.tainted) return null;
      maskCache[src] = li.img;
      return li.img;
    } catch (e) { console.warn('[壓字] 去背失敗,改用畫面判斷:', e.message); return null; }
  }
  function analyse(ctx, W, H, maskImg, imgRect) {
    var GW = 96, GH = Math.max(24, Math.round(96 * H / W)), cw = W / GW, ch = H / GH;
    var A = { GW: GW, GH: GH, cw: cw, ch: ch, mask: null, edge: null };
    // 邊緣
    try {
      var c = document.createElement('canvas'); c.width = GW; c.height = GH;
      var x = c.getContext('2d'); x.drawImage(ctx.canvas, 0, 0, GW, GH);
      var d = x.getImageData(0, 0, GW, GH).data, L = new Float32Array(GW * GH), E = new Float32Array(GW * GH);
      for (var i = 0; i < GW * GH; i++) L[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
      for (var yy = 1; yy < GH - 1; yy++) for (var xx = 1; xx < GW - 1; xx++) {
        var k = yy * GW + xx; E[k] = Math.min(1, (Math.abs(L[k + 1] - L[k - 1]) + Math.abs(L[k + GW] - L[k - GW])) / 90);
      }
      A.edge = E;
    } catch (e) {}
    // 主體
    if (maskImg) {
      try {
        var mc = document.createElement('canvas'); mc.width = GW; mc.height = GH;
        var mx = mc.getContext('2d'); mx.drawImage(maskImg, imgRect.x / cw, imgRect.y / ch, imgRect.w / cw, imgRect.h / ch);
        var md = mx.getImageData(0, 0, GW, GH).data, M = new Float32Array(GW * GH);
        for (var j = 0; j < GW * GH; j++) M[j] = md[j * 4 + 3] / 255;
        // 主體外擴 1 格(字跟人之間留一點呼吸)
        var M2 = new Float32Array(M);
        for (var y2 = 1; y2 < GH - 1; y2++) for (var x2 = 1; x2 < GW - 1; x2++) {
          var q = y2 * GW + x2; M2[q] = Math.max(M[q], M[q - 1], M[q + 1], M[q - GW], M[q + GW]);
        }
        A.mask = M2;
      } catch (e) {}
    }
    return A;
  }
  function score(A, x, y, w, h) {   // 越小越好;回傳 {s, m(壓到主體比例)}
    var x0 = Math.max(0, Math.floor(x / A.cw)), y0 = Math.max(0, Math.floor(y / A.ch));
    var x1 = Math.min(A.GW, Math.ceil((x + w) / A.cw)), y1 = Math.min(A.GH, Math.ceil((y + h) / A.ch));
    var n = 0, m = 0, e = 0;
    for (var yy = y0; yy < y1; yy++) for (var xx = x0; xx < x1; xx++) { var k = yy * A.GW + xx; n++; if (A.mask) m += A.mask[k]; if (A.edge) e += A.edge[k]; }
    if (!n) return { s: 9, m: 1 };
    m /= n; e /= n;
    return { s: m * 8 + e * 2, m: m, e: e };
  }

  // ── 20 款排法:各自量好大小,回傳 {w,h,draw(ctx,x,y,col)} 或整張畫的 full(ctx) ──
  function makeBlock(n, ctx, W, H, u, T) {
    var h = T.h, s = T.s, B;
    switch (n) {
      case 1: {
        var f1 = font(300, 44 * u), f2 = font(300, 24 * u), w1 = tw(ctx, h, f1, 12 * u), w2 = s ? tw(ctx, s, f2, 6 * u) : 0;
        return { w: Math.max(w1, w2), h: 60 * u + (s ? 44 * u : 0), draw: function (c, x, y, col) { put(c, x, y, h, f1, col, 12 * u); if (s) put(c, x, y + 66 * u, s, f2, col, 6 * u); } };
      }
      case 2: {
        var f1b = font(300, 40 * u), f2b = font(300, 22 * u), wa = tw(ctx, h, f1b, 16 * u), wb = s ? tw(ctx, s, f2b, 8 * u) : 0, ww = Math.max(wa, wb);
        return { w: ww, h: 56 * u + (s ? 40 * u : 0), pref: 'bottom', draw: function (c, x, y, col) { put(c, x + (ww - wa) / 2, y, h, f1b, col, 16 * u); if (s) put(c, x + (ww - wb) / 2, y + 60 * u, s, f2b, col, 8 * u); } };
      }
      case 3: {
        var sz = 34 * u, hh = vlen(h) * sz * 1.12;
        return { w: 70 * u + (s ? 34 * u : 0), h: hh + 20 * u, draw: function (c, x, y, col) {
          c.fillStyle = col; c.fillRect(x, y, Math.max(1, u), hh + 10 * u);
          vert(c, x + 22 * u, y, h, sz, font(400, sz, true), col);
          if (s) vert(c, x + 22 * u + sz * 1.3, y + sz * 0.4, s, 20 * u, font(400, 20 * u, true), col);
        } };
      }
      case 4: {
        var t4 = '( ' + h + ' )', f4 = font(300, 46 * u), f4b = font(300, 22 * u), w4 = tw(ctx, t4, f4, 4 * u), w4b = s ? tw(ctx, s, f4b, 6 * u) : 0, W4 = Math.max(w4, w4b);
        return { w: W4, h: 64 * u + (s ? 40 * u : 0), draw: function (c, x, y, col) { put(c, x + (W4 - w4) / 2, y, t4, f4, col, 4 * u); if (s) put(c, x + (W4 - w4b) / 2, y + 70 * u, s, f4b, col, 6 * u); } };
      }
      case 6: {
        var L6 = split(h, 3), f6 = font(500, 76 * u), w6 = Math.max.apply(null, L6.map(function (l) { return tw(ctx, l, f6); }));
        var f6b = font(400, 22 * u), w6b = s ? tw(ctx, s, f6b) : 0, W6 = Math.max(w6, w6b, 260 * u);
        return { w: W6, h: L6.length * 92 * u + (s ? 50 * u : 0), draw: function (c, x, y, col) {
          L6.forEach(function (l, i) { put(c, x, y + i * 92 * u, l, f6, col); });
          var yl = y + L6.length * 92 * u + 8 * u; c.fillStyle = col; c.fillRect(x, yl, W6, Math.max(1, u));
          if (s) put(c, x, yl + 14 * u, s, f6b, col);
        } };
      }
      case 7: {
        var L7 = split(h, 2), f7 = font(500, 84 * u), w7 = Math.max.apply(null, L7.map(function (l) { return tw(ctx, l, f7, 6 * u); }));
        var f7b = font(400, 24 * u), w7b = s ? tw(ctx, s, f7b) : 0;
        return { w: Math.max(w7, w7b), h: L7.length * 100 * u + (s ? 44 * u : 0), draw: function (c, x, y, col) {
          L7.forEach(function (l, i) { put(c, x, y + i * 100 * u, l, f7, col, 6 * u); }); if (s) put(c, x, y + L7.length * 100 * u + 12 * u, s, f7b, col);
        } };
      }
      case 10: {
        var sz10 = Math.min(150 * u, (W * 0.88) / Math.max(1, h.length)), f10 = font(900, sz10), w10 = tw(ctx, h, f10, 4 * u);
        var f10b = font(500, 32 * u), w10b = s ? tw(ctx, s, f10b, 8 * u) : 0, W10 = Math.max(w10, w10b);
        return { w: W10, h: sz10 * 1.25 + (s ? 50 * u : 0), pref: 'bottom', draw: function (c, x, y, col) {
          if (s) put(c, x + (W10 - w10b) / 2, y, s, f10b, col, 8 * u);
          put(c, x + (W10 - w10) / 2, y + (s ? 50 * u : 0), h, f10, col, 4 * u);
        } };
      }
      case 11: {
        var L11 = split(h, 2), f11 = font(900, 84 * u), f11b = font(400, 24 * u);
        var ws = L11.map(function (l) { return tw(ctx, l, f11); }), w11 = Math.max.apply(null, ws.concat([s ? tw(ctx, s, f11b) : 0]));
        return { w: w11, h: L11.length * 102 * u + (s ? 44 * u : 0), pref: 'right', draw: function (c, x, y, col) {
          L11.forEach(function (l, i) { put(c, x + w11 - ws[i], y + i * 102 * u, l, f11, col); });
          if (s) put(c, x + w11 - tw(c, s, f11b), y + L11.length * 102 * u + 14 * u, s, f11b, col);
        } };
      }
      case 12: {
        var f12 = font(700, 42 * u, true), f12b = font(400, 22 * u, true), w12 = tw(ctx, h, f12, 4 * u), w12b = s ? tw(ctx, s, f12b, 4 * u) : 0, W12 = Math.max(w12, w12b);
        return { w: W12, h: 60 * u + (s ? 40 * u : 0), draw: function (c, x, y, col) { put(c, x + (W12 - w12) / 2, y, h, f12, col, 4 * u); if (s) put(c, x + (W12 - w12b) / 2, y + 66 * u, s, f12b, col, 4 * u); } };
      }
      case 15: {
        var sz15 = Math.min(78 * u, (H * 0.62) / Math.max(1, vlen(h))), hh15 = vlen(h) * sz15 * 1.12;
        return { w: sz15 + 34 * u + (s ? 40 * u : 0), h: hh15 + 10 * u, draw: function (c, x, y, col) {
          c.fillStyle = col; c.fillRect(x, y + 8 * u, Math.max(1, 2 * u), hh15 - 10 * u);
          vert(c, x + 30 * u, y, h, sz15, font(500, sz15, true), col);
          if (s) vert(c, x + 30 * u + sz15 * 1.2, y + sz15 * 0.6, s, 22 * u, font(400, 22 * u, true), col);
        } };
      }
      case 16: {
        var L16 = split(h, 3); if (L16.length < 2) return null;
        var big = font(900, 120 * u), thin = font(300, 76 * u), f16b = font(400, 22 * u), offs = [0, 70 * u, 10 * u];
        var w16 = Math.max.apply(null, L16.map(function (l, i) { return tw(ctx, l, i % 2 ? thin : big) + offs[i % 3]; }));
        var rowH = [140 * u, 100 * u, 140 * u];
        var h16 = L16.reduce(function (a, l, i) { return a + rowH[i % 3]; }, 0);
        return { w: Math.max(w16, s ? tw(ctx, s, f16b, 4 * u) : 0), h: h16 + (s ? 40 * u : 0), draw: function (c, x, y, col) {
          var yy = y; L16.forEach(function (l, i) { put(c, x + offs[i % 3], yy + (i % 2 ? 12 * u : 0), l, i % 2 ? thin : big, col); yy += rowH[i % 3]; });
          if (s) put(c, x, yy + 6 * u, s, f16b, col, 4 * u);
        } };
      }
      case 17: {
        var hz = h.replace(/[，,、。\s]/g, ''); if (hz.length > 6) return null;
        var sz17 = Math.min(190 * u, (H * 0.78) / hz.length);
        return { w: sz17 * 1.05, h: hz.length * sz17, pref: 'side', draw: function (c, x, y, col) { vert(c, x, y, hz, sz17, font(900, sz17), col, 1.0); } };
      }
      case 20: {
        var sz20 = 54 * u, hh20 = vlen(h) * sz20 * 1.12;
        return { w: sz20 + (s ? 50 * u : 0), h: hh20, draw: function (c, x, y, col) {
          vert(c, x + (s ? 50 * u : 0), y, h, sz20, font(400, sz20, true), col);
          if (s) vert(c, x, y + 20 * u, s, 28 * u, font(400, 28 * u, true), col);
        } };
      }
      case 21: {
        var m21 = h.match(/(\d+(?:\.\d+)?)\s*(折|%|％|off|OFF)?/); if (!m21) return null;
        var num = m21[1], unit = m21[2] || '', rest = (h.replace(m21[0], ' ').replace(/\s+/g, ' ').trim() + (s ? ' · ' + s : '')).trim();
        var fN = font(900, 300 * u), fU = font(900, 110 * u), fR = font(700, 32 * u);
        var wN = tw(ctx, num, fN), wU = unit ? tw(ctx, unit, fU) : 0, wR = rest ? tw(ctx, rest, fR) : 0;
        return { w: Math.max(wN + wU + 10 * u, wR), h: 330 * u + (rest ? 50 * u : 0), draw: function (c, x, y, col) {
          put(c, x, y, num, fN, col); if (unit) put(c, x + wN + 10 * u, y + 150 * u, unit, fU, col); if (rest) put(c, x + 10 * u, y + 340 * u, rest, fR, col);
        } };
      }
      case 26: {
        var L26 = split(h, 2), f26 = font(900, 70 * u);
        var ws26 = L26.map(function (l) { return tw(ctx, l, f26) + 40 * u; });
        return { w: Math.max.apply(null, ws26) + 30 * u, h: L26.length * 120 * u + 20 * u, draw: function (c, x, y) {
          L26.forEach(function (l, i) {
            c.save(); c.translate(x + 15 * u + ws26[i] / 2, y + 60 * u + i * 115 * u); c.rotate((i % 2 ? -4 : 6) * Math.PI / 180);
            c.fillStyle = '#fafafa'; c.fillRect(-ws26[i] / 2, -52 * u, ws26[i], 104 * u);
            put(c, -ws26[i] / 2 + 20 * u, -44 * u, l, f26, INK); c.restore();
          });
        } };
      }
    }
    return null;
  }
  // 整張畫的款(不需要找位置)
  function drawFull(n, ctx, W, H, u, T, A, maskImg, imgRect) {
    var h = T.h, s = T.s;
    if (n === 5 || n === 25) {
      var top = false;
      if (A.mask) top = score(A, 0, H * 0.8, W, H * 0.2).m > score(A, 0, 0, W, H * 0.2).m + 0.1;   // 下面被主體佔滿 → 改放上面
      var bh = Math.round(H * (n === 5 ? 0.165 : 0.16)), by = top ? 0 : H - bh;
      if (n === 5) {
        var tmp = document.createElement('canvas'); tmp.width = W; tmp.height = bh;
        var tx = tmp.getContext('2d'); tx.filter = 'blur(' + Math.round(18 * u) + 'px)'; tx.drawImage(ctx.canvas, 0, by, W, bh, 0, 0, W, bh);
        ctx.drawImage(tmp, 0, by); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(0, by, W, bh);
        var f1 = font(300, 50 * u); put(ctx, 64 * u, by + bh * 0.2, h, f1, INK, 14 * u);   // 靠左:右邊留給 LOGO
        if (s) { var f2 = font(300, 24 * u); put(ctx, 66 * u, by + bh * 0.62, s, f2, INK, 6 * u); }
      } else {
        ctx.fillStyle = 'rgba(28,28,30,0.9)'; ctx.fillRect(0, by, W, bh);
        var f3 = font(900, Math.min(76 * u, bh * 0.5)); put(ctx, 64 * u, by + bh * 0.24, h, f3, WHITE);
        if (s) { var f4 = font(700, 30 * u); put(ctx, W - 64 * u - tw(ctx, s, f4), by + bh * 0.42, s, f4, WHITE); }
      }
      return { style: n, pos: top ? 'top' : 'bottom' };
    }
    if (n === 9) {
      var tmp9 = document.createElement('canvas'); tmp9.width = W; tmp9.height = H; tmp9.getContext('2d').drawImage(ctx.canvas, 0, 0);
      var sc = 0.754, iw = W * sc, ih = H * sc, ix = (W - iw) / 2, iy = H * 0.064;
      ctx.fillStyle = '#f6f3ee'; ctx.fillRect(0, 0, W, H); ctx.drawImage(tmp9, ix, iy, iw, ih);
      var ly = iy + ih + 26 * u; ctx.fillStyle = INK; ctx.fillRect(ix, ly, iw, Math.max(1, u));
      var f9 = font(300, Math.min(46 * u, (H - ly) * 0.38)); put(ctx, ix, ly + 22 * u, h, f9, INK, 10 * u);
      if (s) { var f9b = font(300, 22 * u); put(ctx, ix + iw - tw(ctx, s, f9b, 4 * u), ly + 36 * u, s, f9b, INK, 4 * u); }
      return { style: 9, pos: 'frame' };
    }
    if (n === 18) {
      var hz = h.replace(/[，,、。\s]/g, ''); if (hz.length < 2 || hz.length > 6 || !A.mask) return null;
      var half = Math.ceil(hz.length / 2), Lt = hz.slice(0, half), Rt = hz.slice(half);
      var sz = Math.min(220 * u, (H * 0.6) / Math.max(Lt.length, Rt.length)), xl = W * 0.04, xr = W - W * 0.04 - sz, yy = H * 0.24;
      var sl = score(A, xl, yy, sz, sz * Lt.length), sr = score(A, xr, yy, sz, sz * Rt.length);
      if (sl.m > 0.04 || sr.m > 0.04) return null;
      var cl = lum(ctx, xl, yy, sz, sz * Lt.length) > 140 ? INK : WHITE, cr = lum(ctx, xr, yy, sz, sz * Rt.length) > 140 ? INK : WHITE;
      vert(ctx, xl, yy, Lt, sz, font(700, sz, true), cl, 1.0); vert(ctx, xr, yy, Rt, sz, font(700, sz, true), cr, 1.0);
      if (s) { var f18 = font(400, 24 * u), w18 = tw(ctx, s, f18, 6 * u); put(ctx, W - 64 * u - w18, H - 70 * u, s, f18, lum(ctx, W - 64 * u - w18, H - 70 * u, w18, 30 * u) > 140 ? INK : WHITE, 6 * u); }
      return { style: 18, pos: 'split' };
    }
    if (n === 28) {
      if (!maskImg) return null;
      var parts = split(h, 2), bigT = parts[0].replace(/[，,、。\s]/g, ''), rest = (parts.slice(1).join('') + (s ? '  ' + s : '')).trim();
      if (bigT.length > 4) return null;
      var szB = Math.min(360 * u, (W * 0.86) / bigT.length), fB = font(900, szB), wB = tw(ctx, bigT, fB);
      var yB = H * 0.1, colB = lum(ctx, (W - wB) / 2, yB, wB, szB) > 150 ? INK : WHITE;
      put(ctx, (W - wB) / 2, yB, bigT, fB, colB);
      // 把人疊回字的前面
      var cut = document.createElement('canvas'); cut.width = W; cut.height = H; var cx = cut.getContext('2d');
      cx.drawImage(maskImg, imgRect.x, imgRect.y, imgRect.w, imgRect.h); cx.globalCompositeOperation = 'source-in';
      cx.drawImage(window.__atlBase || ctx.canvas, 0, 0);
      ctx.drawImage(cut, 0, 0);
      if (rest) {   // 小字壓在人的前面,一定讀得到;放在主體旁邊空的那一側
        var fr = font(500, 30 * u), wr = tw(ctx, rest, fr, 8 * u), yr = H * 0.86;
        var xr = score(A, W - 64 * u - wr, yr, wr, 40 * u).m < score(A, 64 * u, yr, wr, 40 * u).m ? W - 64 * u - wr : 64 * u;
        put(ctx, xr, yr, rest, fr, lum(ctx, xr, yr, wr, 40 * u) > 140 ? INK : WHITE, 8 * u);
      }
      return { style: 28, pos: 'behind' };
    }
    return null;
  }

  //  LOGO 會放哪(跟 admaker 量四角同一套:先猜好,字就不放那裡;字畫完 LOGO 再量一次也會選回那個角)
  function predictLogo(ctx, W, H, u) {
    try {
      if (document.getElementById('showBrandMark') && document.getElementById('showBrandMark').checked === false) return null;
      if (typeof getBrandLogoUrls === 'function' && !getBrandLogoUrls()) return null;
      var k = (document.getElementById('logoSize') || {}).value || 'normal', sz = g('LOGO_SIZES'), mg = g('LOGO_MARGIN');
      var bw = W * ((sz && sz[k]) || 0.14), bh = bw * 0.55, m = W * (mg || 0.045);
      var sp = pickLogoSpot(ctx, bw, bh, m);
      return sp ? { x: sp.x, y: sp.y, w: bw, h: bh } : null;
    } catch (e) { return null; }
  }
  function hitLogo(A, x, y, w, h, pad) {
    var L = A.logo; if (!L) return false;
    return x < L.x + L.w + pad && x + w > L.x - pad && y < L.y + L.h + pad && y + h > L.y - pad;
  }

  // ── 自動挑款(之後 AI 美術指導會直接指定)────────────────────────
  var suggested = null, lastStyle = null;
  try { lastStyle = Number(localStorage.getItem('bos_textlayer_last')) || null; } catch (e) {}
  function candidates(T) {
    var ctxK = String(g('SELECTED_CONTEXT') || ''), fl = String(g('SELECTED_FLAVOR') || ''), ly = String(g('SELECTED_LAYOUT') || ''), pt = String(g('SELECTED_PRODTYPE') || '');
    var brand = (window.S && window.S.brandId) || '';
    if (PROMO.test(ctxK) || /\d+\s*(折|%|％|off)/i.test(T.h)) return [21, 25, 7, 11, 17, 10];
    if (ZEN.test(fl) || /wellness|mystic/.test(pt) || brand === 'ka') return [15, 20, 3, 16, 12];
    if (BOLD.test(ly)) return [7, 28, 10, 17, 11, 16, 18];
    return [1, 2, 4, 6, 12, 7, 1, 2];
  }
  function pickOrder(T) {
    var c = candidates(T).slice();
    if (suggested && NAMES[suggested]) c.unshift(suggested);
    // 同一組裡打散,避免每張都同一款;上一張用過的往後放
    var head = suggested ? [c.shift()] : [];
    for (var i = c.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = c[i]; c[i] = c[j]; c[j] = t; }
    c.sort(function (a, b) { return (a === lastStyle) - (b === lastStyle); });
    return head.concat(c).filter(function (v, i, a) { return a.indexOf(v) === i; });
  }

  // ── 主流程:畫好照片之後、疊 LOGO 之前 ─────────────────────────────
  var planCache = {};   // 同一張圖重畫(換 LOGO 大小)時用同一款同一個位置
  async function drawText(ctx) {
    var T = title(); if (!T.h) return null;                 // 沒打字 = 美編要乾淨素材,不壓
    var W = ctx.canvas.width, H = ctx.canvas.height, u = Math.min(W, H) / 1088;
    var src = g('PR_BG_IMG') || '';
    try { await Promise.all([300, 400, 500, 700, 900].map(function (w) { return document.fonts.load(w + ' 40px "Noto Sans TC"', T.h + T.s + '()0123456789%'); })
      .concat([400, 500, 700].map(function (w) { return document.fonts.load(w + ' 40px "Noto Serif TC"', T.h + T.s); }))); } catch (e) {}
    if (typeof setPrStatus === 'function') setPrStatus('✍️ 系統壓字中(找空位、避開主體)...', 'var(--t3)');
    var maskImg = await getMask(src);
    // 照片在畫布上的位置(renderGptPosterCanvas 是等比置中)
    var imgRect = { x: 0, y: 0, w: W, h: H };
    if (maskImg) { var sc = Math.min(W / maskImg.naturalWidth, H / maskImg.naturalHeight); imgRect = { w: maskImg.naturalWidth * sc, h: maskImg.naturalHeight * sc }; imgRect.x = (W - imgRect.w) / 2; imgRect.y = (H - imgRect.h) / 2; }
    var base = document.createElement('canvas'); base.width = W; base.height = H; base.getContext('2d').drawImage(ctx.canvas, 0, 0); window.__atlBase = base;
    var A = analyse(ctx, W, H, maskImg, imgRect);
    A.logo = predictLogo(ctx, W, H, u);
    var key = src + '|' + T.h + '|' + T.s + '|' + W + 'x' + H, plan = planCache[key];
    var order = plan ? [plan.style] : pickOrder(T), M = 48 * u, done = null;
    for (var oi = 0; oi < order.length && !done; oi++) {
      var n = order[oi];
      if ([5, 9, 18, 25, 28].indexOf(n) >= 0) { done = drawFull(n, ctx, W, H, u, T, A, maskImg, imgRect); continue; }
      var b = makeBlock(n, ctx, W, H, u, T); if (!b || b.w > W - 2 * M || b.h > H - 2 * M) continue;
      var xs = [W - M - b.w, M, (W - b.w) / 2], ys = [H * 0.2, (H - b.h) / 2, H * 0.58, M + 70 * u, H - M - b.h];
      if (b.pref === 'bottom') ys = [H - M - b.h, H * 0.72, M];
      if (b.pref === 'right') xs = [W - M - b.w, M];
      if (b.pref === 'side') { xs = [W - M - b.w, M]; ys = [(H - b.h) / 2, M + 40 * u]; }
      var best = plan && plan.style === n ? { x: plan.x, y: plan.y, r: { m: 0, s: 0 } } : null;
      if (!best) xs.forEach(function (x) { ys.forEach(function (y) {
        if (y < M || y + b.h > H - M) return;
        if (hitLogo(A, x, y, b.w, b.h, 24 * u)) return;
        var r = score(A, x, y, b.w, b.h); if (!best || r.s < best.r.s) best = { x: x, y: y, r: r };
      }); });
      if (!best || best.r.m > 0.03 || (!A.mask && best.r.e > 0.35)) continue;   // 會壓到主體 / 太花 → 換下一款
      var col = lum(ctx, best.x, best.y, b.w, b.h) > 140 ? INK : WHITE;
      b.draw(ctx, best.x, best.y, col);
      done = { style: n, x: best.x, y: best.y, m: best.r.m, e: best.r.e };
    }
    if (!done) done = drawFull(25, ctx, W, H, u, T, A, maskImg, imgRect);   // 全都放不下 → 底部色帶,保證讀得到
    planCache[key] = done;
    try { localStorage.setItem('bos_textlayer_last', String(done.style)); } catch (e) {}
    window._adTextLast = { at: Date.now(), style: done.style, name: NAMES[done.style], mask: !!maskImg, plan: done, suggested: suggested };
    console.log('[壓字] ' + done.style + ' ' + NAMES[done.style] + (maskImg ? ' · 有主體輪廓' : ' · 沒有輪廓(只看畫面)'), done);
    return done;
  }

  // ── 接到 admaker:① 生成期間讓程式讀不到大標/副標 ② 疊 LOGO 前壓字 ──
  var suppress = false;
  function hookInputs() {
    [['gptHeadline', 'h'], ['gptSubHeadline', 's']].forEach(function (p) {
      var el = document.getElementById(p[0]); if (!el || el.__atl) return;
      var d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
      realVal[p[1]] = d.get;
      Object.defineProperty(el, 'value', { configurable: true,
        get: function () { return (suppress && ON()) ? '' : d.get.call(this); },
        set: function (v) { d.set.call(this, v); } });
      el.__atl = true;
    });
  }
  function install() {
    var ap = window.applyPhotoroomBg, cl = window.compositeBrandLogo;
    if (typeof ap !== 'function' || typeof cl !== 'function') return false;
    hookInputs();
    if (!ap.__atl) {
      var w1 = async function () {
        hookInputs();
        var lazy = (g('PR_MODE') === 'gpt_poster') && ON();
        if (lazy) { suppress = true; suggested = null; }
        try { return await ap.apply(this, arguments); } finally { suppress = false; }
      };
      w1.__atl = true; window.applyPhotoroomBg = w1;
    }
    if (!cl.__atl) {
      var w2 = async function (ctx) {
        try { if (ON() && g('PR_MODE') === 'gpt_poster' && ctx && ctx.canvas) await drawText(ctx); }
        catch (e) { console.warn('[壓字] 失敗,照原樣出圖:', e && e.message); }
        return cl.apply(this, arguments);
      };
      w2.__atl = true; window.compositeBrandLogo = w2;
    }
    return true;
  }
  var tries = 0;
  (function wait() { if (install() || ++tries > 120) return; setTimeout(wait, 250); })();
  setInterval(function () { try { install(); } catch (e) {} }, 3000);   // 被別的檔案換掉時再包回來

  window.AdTextLayer = {
    version: VERSION, names: NAMES, title: title,
    suggest: function (n) { n = Number(n); suggested = NAMES[n] ? n : null; return suggested; },   // AI 美術指導指定排法
    isOn: ON, drawText: drawText
  };
  try { console.log('[AdTextLayer] v' + VERSION + ' 就緒 · 系統壓字 20 款 · 去背找空位 · 關閉:window.AD_TEXTLAYER = false'); } catch (e) {}
})();
