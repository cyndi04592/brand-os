/* ══════════════════════════════════════════════════════════════
   Brand OS · monitor-pool.js · v1.3(2026-11-13)
   v1.3:魚的大小補回三條魚 + 比例欄(沒接 SMR 顯示「待接」);單數圓圈依位數縮字不再爆框;右側文字改直排不再被切
   v1.2:RA 選定「漏斗一張圖」取代魚池剖面:左 = 網子(高度照飼料、深淺照 1 元換回)、中 = 看到→買單漏斗、右 = 客人花的錢;手機改直式
   v1.1:RA「長條看不懂,要一眼看出魚在哪、用什麼網子、網子多少錢、撈出來客人花多少」→ 最上面改成魚池剖面圖
        (照 Meta 簡報『出價 × 預算』圖的畫法:一圈 = 一批成交的客人),明細表留在下面
   新版廣告監控頁「魚池地圖」區塊:一眼看懂這個品牌的廣告帳號是怎麼「撒網」的。
   資料一律跟 window.MON 拿(需要 ads-monitor v1.8:廣告帶出價方式 / CPA 目標 / ROAS 下限 / 廣告組合預算)。

   RA 11-13:「ASC 在哪一層?流量、觸及在哪?轉換在哪?CIBS 在哪?CPA 800 限制、CPA 1200 限制在哪撈多少?」
   邏輯照 Meta「ASC 高效推廣 - 測試進階策略」簡報第 13~17 頁的「出價 × 預算」圖:
     · 橫軸 = 預算(網子多寬)、直軸 = 出價門檻(網子多深);圓圈 = 成交機會
     · 出價線以上的機會:門檻太嚴撈不到;出價線以下、預算外的機會:錢花完了撈不到(預算受限)
     · CIBS = 預算放很大(網子撐開)+ CPA 目標 / ROAS 下限(只撈划算的魚)

   ① 魚池分層(由淺到深):觸及 → 流量 / 互動 → 轉換・自動出價(ASC 等,不設門檻)→ 轉換・有門檻(CIBS / CPA 上限 / ROAS 下限,
      門檻由鬆到嚴排)→ 再行銷(回撈池)。每層:日預算佔比、花了多少、撈到幾單 / 觸及多少人。
   ② 每個轉換活動放進四格(花滿沒 × 有沒有達標),附一句建議。

   掛載點:<div id="mon-pool"></div>
   共用 monitor-overview.js 的 .mo-card / .mo-h / .mo-note / .mo-tag 樣式
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (!window.MON) { console.error('[pool] 要先載 monitor-data.js'); return; }
  var M = window.MON, F = M.fmt;

  var CSS = ''
    + '#mon-pool{display:flex;flex-direction:column;gap:14px}'
    + '.mp-split{display:flex;height:22px;border-radius:8px;overflow:hidden;margin:4px 0 2px}'
    + '.mp-split i{display:flex;align-items:center;justify-content:center;height:100%;font-style:normal;font-size:9.5px;font-weight:800;color:#0b0b12;white-space:nowrap;overflow:hidden}'
    + '.mp-row2{display:grid;grid-template-columns:72px 1fr;gap:8px;align-items:center;font-size:10.5px;color:var(--t3,#8a8aa0)}'
    + '.mp-layer{border-radius:12px;padding:10px 12px;margin-top:10px;border:1px solid rgba(255,255,255,0.06)}'
    + '.mp-lh{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;font-size:12px;font-weight:800;color:var(--t1,#fff)}'
    + '.mp-lh small{font-weight:500;font-size:10.5px;color:var(--t3,#8a8aa0)}'
    + '.mp-tbl{width:100%;border-collapse:collapse;font-size:11px;margin-top:6px}'
    + '.mp-tbl th{text-align:left;font-weight:600;color:var(--t3,#8a8aa0);padding:5px 6px;border-bottom:1px solid rgba(255,255,255,0.08);white-space:nowrap}'
    + '.mp-tbl td{padding:7px 6px;border-bottom:1px solid rgba(255,255,255,0.04);color:var(--t2,#c8c8d8);vertical-align:middle}'
    + '.mp-tbl td.num{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}'
    + '.mp-name{max-width:230px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
    + '.mp-bid{display:inline-block;padding:2px 8px;border-radius:6px;font-size:10px;font-weight:800;background:rgba(255,255,255,0.07);color:var(--t1,#fff);white-space:nowrap}'
    + '.mp-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}'
    + '.mp-quad{display:grid;grid-template-columns:1fr 1fr;gap:8px}'
    + '.mp-q{border-radius:11px;padding:10px 12px;min-height:84px;font-size:10.5px;line-height:1.6;color:var(--t3,#8a8aa0);background:rgba(255,255,255,0.03)}'
    + '.mp-q b.t{display:block;font-size:12px;color:var(--t1,#fff);margin-bottom:2px}'
    + '.mp-q .c{margin-top:6px;display:flex;flex-direction:column;gap:3px}'
    + '.mp-q .c span{color:var(--t2,#c8c8d8);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
    + '.mp-axis{display:flex;justify-content:space-between;font-size:10px;color:var(--t3,#8a8aa0);margin-top:4px}'
    + '@media (max-width:640px){.mp-quad{grid-template-columns:1fr}}';
  function injectCss() {
    if (document.getElementById('mp-css')) return;
    var s = document.createElement('style'); s.id = 'mp-css'; s.textContent = CSS;
    document.head.appendChild(s);
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function tag(cls, t) { return '<span class="mo-tag ' + cls + '">' + t + '</span>'; }

  //  魚池分層(由淺到深)
  var LAYERS = [
    { k: 'reach',  name: '觸及 / 知名度', color: '#7FD6FF', desc: '撒大網,讓沒聽過的人先認識品牌;不看單數,看觸及人數' },
    { k: 'traffic', name: '流量 / 互動',   color: '#B9A8FF', desc: '把人帶進網站或粉專;看點擊、互動,單數只是順便' },
    { k: 'auto',   name: '轉換・不設門檻', color: '#6DFAC2', desc: '自動出價,預算內能撈的都撈(ASC 大多在這層)' },
    { k: 'gate',   name: '轉換・有門檻',   color: '#FFD36D', desc: 'CIBS / CPA 上限 / ROAS 下限:網子撐大,但只撈划算的魚' },
    { k: 'rt',     name: '再行銷(回撈池)', color: '#FA6D9B', desc: '看過、加過購物車的人再撈一次,池子小、轉換率高' }
  ];
  var BID = {
    LOWEST_COST_WITHOUT_CAP: '自動出價(不設門檻)', COST_CAP: 'CPA 上限', LOWEST_COST_WITH_BID_CAP: '出價上限',
    LOWEST_COST_WITH_MIN_ROAS: 'ROAS 下限', TARGET_COST: '目標成本'
  };

  function rangeDays(d) {
    var r = d.range || {};
    if (!r.since || !r.until) return 1;
    return Math.max(1, Math.round((new Date(r.until + 'T00:00:00+08:00') - new Date(r.since + 'T00:00:00+08:00')) / 86400000) + 1);
  }

  //  每個行銷活動:合併「活動本身」+「底下進行中的廣告」
  function build(d) {
    var byCamp = {};
    (d.ads || []).forEach(function (a) {
      var o = byCamp[a.campaign] || (byCamp[a.campaign] = { n: 0, spend: 0, purchases: 0, revenue: 0, reach: 0, clicks: 0, imp: 0, bids: {}, amt: 0, floor: 0, adsets: {} });
      o.n++; o.spend += a.spend || 0; o.purchases += a.purchases || 0; o.revenue += a.revenue || 0;
      o.reach += a.reach || 0; o.clicks += a.linkClicks || 0; o.imp += a.impressions || 0;
      if (a.bidStrategy) o.bids[a.bidStrategy] = 1;
      if (a.bidAmount) o.amt = o.amt ? Math.min(o.amt, a.bidAmount) : a.bidAmount;
      if (a.roasFloor) o.floor = Math.max(o.floor, a.roasFloor);
      if (a.adsetId && a.adsetBudget) o.adsets[a.adsetId] = a.adsetBudget;
    });
    var days = rangeDays(d);
    return (d.campaigns || []).map(function (c) {
      var x = byCamp[c.name] || { n: 0, spend: 0, purchases: 0, revenue: 0, reach: 0, clicks: 0, imp: 0, bids: {}, amt: 0, floor: 0, adsets: {} };
      var strat = c.bidStrategy || Object.keys(x.bids)[0] || '';
      var budget = c.dailyBudget || Object.keys(x.adsets).reduce(function (s, k) { return s + x.adsets[k]; }, 0);
      var obj = String(c.objective || ''), grp = M.campaignGroup(c), layer;
      if (/AWARENESS|REACH|BRAND/.test(obj)) layer = 'reach';
      else if (/TRAFFIC|ENGAGEMENT|LINK_CLICKS|VIDEO|POST|PAGE_LIKES|MESSAGES/.test(obj)) layer = 'traffic';
      else if (grp === 'rt') layer = 'rt';
      else if (grp === 'cibs' || strat === 'COST_CAP' || strat === 'LOWEST_COST_WITH_MIN_ROAS' || strat === 'LOWEST_COST_WITH_BID_CAP' || x.amt || x.floor) layer = 'gate';
      else layer = 'auto';
      var gate = '';
      if (x.floor) gate = 'ROAS ≥ ' + x.floor.toFixed(x.floor % 1 ? 1 : 0);
      else if (x.amt && strat === 'LOWEST_COST_WITH_BID_CAP') gate = '出價 ≤ ' + F.money(x.amt);
      else if (x.amt) gate = 'CPA ≤ ' + F.money(x.amt);
      else if (strat === 'LOWEST_COST_WITH_MIN_ROAS') gate = 'ROAS 下限';
      else if (strat === 'COST_CAP') gate = 'CPA 上限';
      return {
        name: c.name, grp: grp, layer: layer, strat: strat, gate: gate, floor: x.floor, cap: x.amt,
        budget: budget, avgDaily: x.spend / days, spend: x.spend, purchases: x.purchases, revenue: x.revenue,
        cpa: x.purchases ? x.spend / x.purchases : 0, roas: x.spend ? x.revenue / x.spend : 0,
        reach: x.reach, clicks: x.clicks, imp: x.imp, n: x.n, todaySpend: c.todaySpend || 0
      };
    });
  }

  //  ① 分層
  function layerBlock(list, d) {
    var totB = list.reduce(function (s, c) { return s + (c.budget || 0); }, 0);
    var totS = list.reduce(function (s, c) { return s + c.spend; }, 0);
    var totP = list.reduce(function (s, c) { return s + c.purchases; }, 0);
    var sum = {};
    LAYERS.forEach(function (L) { sum[L.k] = { b: 0, s: 0, p: 0, items: [] }; });
    list.forEach(function (c) { var o = sum[c.layer]; o.b += c.budget || 0; o.s += c.spend; o.p += c.purchases; o.items.push(c); });
    var html = '';

    LAYERS.forEach(function (L) {
      var o = sum[L.k]; if (!o.items.length) return;
      var top = L.k === 'reach' || L.k === 'traffic';
      if (L.k === 'gate') o.items.sort(function (a, b) {   // 門檻由鬆到嚴:ROAS 低→高、CPA 高→低
        var ka = a.floor ? a.floor : (a.cap ? 100000 / a.cap : 0), kb = b.floor ? b.floor : (b.cap ? 100000 / b.cap : 0);
        return ka - kb;
      });
      else o.items.sort(function (a, b) { return b.spend - a.spend; });
      var rows = o.items.map(function (c) {
        var use = c.budget ? c.avgDaily / c.budget : 0;
        var useTxt = c.budget ? Math.round(use * 100) + '%' : '—';
        var catchTxt = top
          ? (c.reach ? F.num(c.reach) + ' 人' : '—') + '<br><span class="mo-flat">點擊 ' + F.num(c.clicks) + (c.purchases ? ' · ' + c.purchases + ' 單' : '') + '</span>'
          : (c.purchases ? '<b>' + c.purchases + ' 單</b>' : '<span class="mo-flat">0 單</span>') + '<br><span class="mo-flat">' + (c.cpa ? 'CPA ' + F.money(c.cpa) : '') + (c.roas ? ' · ROAS ' + c.roas.toFixed(2) : '') + '</span>';
        return '<tr><td><div class="mp-name" title="' + esc(c.name) + '">' + esc(c.name) + '</div></td>'
          + '<td><span class="mp-bid">' + esc(c.gate || BID[c.strat] || '自動出價') + '</span></td>'
          + '<td class="num">' + (c.budget ? F.money(c.budget) : '<span class="mo-flat">—</span>') + '</td>'
          + '<td class="num">' + F.money(c.avgDaily) + '<br><span class="mo-flat">用掉 ' + useTxt + '</span></td>'
          + '<td class="num">' + F.money(c.spend) + '</td>'
          + '<td class="num">' + catchTxt + '</td></tr>';
      }).join('');
      html += '<div class="mp-layer" style="background:linear-gradient(90deg,' + L.color + '14,transparent 70%)">'
        + '<div class="mp-lh"><span style="color:' + L.color + '">' + L.name + '</span><small>' + o.items.length + ' 個活動 · 日預算 ' + F.money(o.b)
        + (totB ? '(' + Math.round(o.b / totB * 100) + '%)' : '') + ' · 花 ' + F.money(o.s) + (top ? '' : ' · 撈到 ' + o.p + ' 單' + (totP ? '(' + Math.round(o.p / totP * 100) + '%)' : '')) + '</small></div>'
        + '<div style="font-size:10.5px;color:var(--t3,#8a8aa0);margin-top:2px">' + L.desc + '</div>'
        + '<div class="mp-scroll"><table class="mp-tbl"><thead><tr><th>行銷活動</th><th>出價門檻</th><th>日預算</th><th>平均每天花</th><th>期間花費</th><th>' + (top ? '觸及 / 點擊' : '撈到') + '</th></tr></thead><tbody>' + rows + '</tbody></table></div></div>';
    });
    return '<div class="mo-card"><div class="mo-h">各層明細 <small>' + list.length + ' 個進行中的行銷活動 · 期間 ' + rangeDays(d) + ' 天</small></div>' + html
      + '<div class="mo-note"><b>怎麼看:</b>「平均每天花」÷「日預算」= 網子撐開了幾成。「出價門檻」= 這張網只撈多划算的魚(ROAS ≥ 3 = 每花 1 元至少要賺回 3 元;CPA ≤ 800 = 一單成本超過 800 就不搶)。'
      + '門檻越嚴,單越便宜但量越少;花費、單數只算進行中的廣告。</div></div>';
  }

  //  ⓪ 漏斗一張圖(v1.2,RA 11-13 選定):左 = 網子(高度照飼料、顏色深淺照 1 元換回)→ 中 = 客人一路往下掉 → 右 = 客人花的錢
  //   寬畫面橫的、手機直的;淺色底卡片(照 RA 給的參考圖)
  var FB = { bg: '#f5f6fb', ink: '#1e2140', sub: '#7a7f9a', b1: '#2a3bdc', b15: '#4555e3', b2: '#6d7cf0', b3: '#c8cdfa', off: '#eef0fd' };
  function short(n, k) { n = String(n || ''); var m = n.match(/^【([^】]+)】/); if (m) n = m[1]; return n.length > k ? n.slice(0, k) + '…' : n; }   // 【ASC/包】1008>… → ASC/包
  function wan(n) { return n >= 10000 ? (n / 10000).toFixed(1).replace(/\.0$/, '') + ' 萬' : F.num(n); }
  function netColor(c) {
    if (!c.spend) return [FB.off, '#a9aed0'];
    var r = c.roas; return r >= 3 ? [FB.b1, '#fff'] : r >= 2 ? [FB.b15, '#fff'] : r >= 1.2 ? [FB.b2, '#fff'] : [FB.b3, FB.b1];
  }
  function stages(t) {
    return [['看到廣告', wan(t.reach || 0) + '人'], ['點進網站', wan(t.linkClicks || 0) + '人'], ['看商品', wan(t.viewContent || 0) + '次'],
      ['加購物車', wan(t.addToCart || 0) + '次'], ['結帳', wan(t.checkout || 0) + '次']];
  }
  //  魚的大小:三條魚 + 比例(d.orderSizes = {big, mid, small} 百分比,接 SMR 後才有)
  function fishIcon(x, y, L, fill) {
    var h = L * 0.52;
    return '<path d="M' + (x - L / 2 + 2) + ' ' + y + ' L' + (x - L / 2 - L * 0.34) + ' ' + (y - h * 0.48) + ' L' + (x - L / 2 - L * 0.34) + ' ' + (y + h * 0.48) + ' Z" fill="' + fill + '"/>'
      + '<ellipse cx="' + x + '" cy="' + y + '" rx="' + L / 2 + '" ry="' + h / 2 + '" fill="' + fill + '"/>';
  }
  function sizeRows(d, x, y, xr, gap, big) {
    var os = d.orderSizes || null, s = '';
    [['大魚', 'NT$3,000 以上', 'big', 26], ['小魚', 'NT$1,000–2,999', 'mid', 18], ['幼魚', 'NT$1,000 以下', 'small', 12]].forEach(function (r, i) {
      var yy = y + i * gap, has = os && os[r[2]] != null;
      s += fishIcon(x + 16, yy, r[3], FB.b2)
        + '<text x="' + (x + 44) + '" y="' + (yy + 5) + '" font-size="' + (big ? 14 : 13) + '" font-weight="800" fill="' + FB.ink + '">' + r[0] + '</text>'
        + '<text x="' + (x + 84) + '" y="' + (yy + 5) + '" font-size="' + (big ? 12.5 : 11.5) + '" fill="' + FB.sub + '">' + r[1] + '</text>'
        + '<text x="' + xr + '" y="' + (yy + 7) + '" font-size="' + (has ? (big ? 21 : 18) : (big ? 14 : 12)) + '" font-weight="900" fill="' + (has ? FB.b1 : '#b4b9d6') + '" text-anchor="end">' + (has ? Math.round(os[r[2]]) + '%' : '待接') + '</text>';
    });
    if (!os) s += '<text x="' + x + '" y="' + (y + gap * 2 + 34) + '" font-size="' + (big ? 12 : 10.5) + '" fill="' + FB.b2 + '">比例要接上 SMR / 電商後台的每筆訂單才算得出來</text>';
    return s;
  }
  function orderCircle(cx, cy, n) {
    var txt = F.num(n || 0), fs = txt.length >= 6 ? 14 : txt.length === 5 ? 16 : txt.length === 4 ? 18 : 20;
    return '<circle cx="' + cx + '" cy="' + cy + '" r="40" fill="' + FB.b1 + '" stroke="#fff" stroke-width="6"/>'
      + '<text x="' + cx + '" y="' + (cy + 2) + '" font-size="' + fs + '" font-weight="900" fill="#fff" text-anchor="middle">' + txt + '</text>'
      + '<text x="' + cx + '" y="' + (cy + 19) + '" font-size="11" fill="#dfe3ff" text-anchor="middle">單</text>';
  }
  function dots(n, fn) { var s = '', seed = 7; for (var i = 0; i < n; i++) { seed = (seed * 9301 + 49297) % 233280; var a = seed / 233280; seed = (seed * 9301 + 49297) % 233280; var b = seed / 233280; s += fn(Math.pow(a, 1.6) * 0.93, b * 2 - 1); } return s; }
  function netsOrdered(list) {
    var order = { reach: 0, traffic: 1, auto: 2, gate: 3, rt: 4 };
    var out = list.slice().sort(function (a, b) { return (order[a.layer] - order[b.layer]) || (b.spend - a.spend); });
    ['reach', 'traffic'].forEach(function (k, i) { if (!list.some(function (c) { return c.layer === k; })) out.splice(i, 0, { name: k === 'reach' ? '觸及網' : '流量網', spend: 0, purchases: 0, revenue: 0, roas: 0, ghost: true }); });
    return out;
  }
  function funnelWide(list, d) {
    var t = d.totals || {}, W = 1600, H = 960, X0 = 70, X1 = 330, Y0 = 190, Y1 = 800, PX = 1130, PY = (Y0 + Y1) / 2, cx0 = X1 + 30;
    var nets = netsOrdered(list), tot = nets.reduce(function (s, c) { return s + c.spend; }, 0) || 1;
    var gap = 6, usable = (Y1 - Y0) - gap * (nets.length - 1), alloc = nets.map(function (c) { return Math.max(30, usable * c.spend / tot * 0.82); });
    var k = usable / alloc.reduce(function (a, b) { return a + b; }, 0); alloc = alloc.map(function (a) { return a * k; });
    var s = '<rect width="' + W + '" height="' + H + '" fill="' + FB.bg + '"/>'
      + '<text x="70" y="62" font-size="24" font-weight="900" fill="' + FB.ink + '">' + esc(d.brandName || '') + ' 這 ' + rangeDays(d) + ' 天:飼料撒進哪些網,最後撈回多少客人的錢</text>'
      + '<text x="70" y="94" font-size="14" fill="' + FB.sub + '">左邊每一塊是一張網(廣告設計),越高 = 花越多飼料、顏色越深 = 1 元換回越多;中間是客人一路從「看到」到「買單」,右邊是客人花的錢。</text>'
      + '<rect x="' + (X0 - 10) + '" y="' + (Y0 - 12) + '" width="' + (X1 - X0 + 20) + '" height="' + (Y1 - Y0 + 24) + '" rx="20" fill="#e3e6fb"/>'
      + '<text x="' + (X0 + X1) / 2 + '" y="' + (Y0 - 26) + '" font-size="14" fill="' + FB.sub + '" text-anchor="middle">網子(飼料撒在哪)</text>';
    var y = Y0;
    nets.forEach(function (c, i) {
      var h = alloc[i], col = netColor(c);
      s += '<g><title>' + esc(c.name) + (c.spend ? '\n飼料 ' + F.money(c.spend) + '\n撈到 ' + c.purchases + ' 單 · 客人花 ' + F.money(c.revenue) + '\n1 元換回 ' + c.roas.toFixed(2) : '\n沒開') + '</title>'
        + '<rect x="' + X0 + '" y="' + y.toFixed(1) + '" width="' + (X1 - X0) + '" height="' + h.toFixed(1) + '" rx="10" fill="' + col[0] + '"/>';
      if (h >= 46) s += '<text x="' + (X0 + X1) / 2 + '" y="' + (y + h / 2 - 3).toFixed(1) + '" font-size="14" font-weight="900" fill="' + col[1] + '" text-anchor="middle">' + esc(short(c.name, 16)) + '</text>'
        + '<text x="' + (X0 + X1) / 2 + '" y="' + (y + h / 2 + 16).toFixed(1) + '" font-size="12" fill="' + col[1] + '" text-anchor="middle">飼料 ' + F.money(c.spend) + ' · 1 元換 ' + c.roas.toFixed(2) + '</text>';
      else s += '<text x="' + (X0 + 14) + '" y="' + (y + h / 2 + 5).toFixed(1) + '" font-size="12.5" font-weight="800" fill="' + col[1] + '">' + esc(short(c.name, 9)) + '</text>'
        + '<text x="' + (X1 - 14) + '" y="' + (y + h / 2 + 5).toFixed(1) + '" font-size="11.5" fill="' + col[1] + '" text-anchor="end">' + (c.spend ? F.money(c.spend) + ' · ' + c.roas.toFixed(2) : '沒開') + '</text>';
      s += '</g>'; y += h + gap;
    });
    s += '<line x1="40" y1="' + Y0 + '" x2="40" y2="' + Y1 + '" stroke="' + FB.b3 + '" stroke-width="4" stroke-linecap="round"/>'
      + '<text x="30" y="' + PY + '" font-size="13" fill="' + FB.sub + '" text-anchor="middle" transform="rotate(-90 30 ' + PY + ')">這些網共花 ' + F.money(tot) + '</text>';
    //  錐形
    s += '<path d="M' + cx0 + ' ' + Y0 + ' L' + PX + ' ' + PY + ' L' + cx0 + ' ' + Y1 + ' Z" fill="url(#mpCone)"/>';
    s += dots(240, function (tt, u) { var x = cx0 + (PX - cx0) * tt, half = (Y1 - Y0) / 2 * (1 - tt) * 0.9; return '<circle cx="' + x.toFixed(0) + '" cy="' + (PY + u * half).toFixed(0) + '" r="2.6" fill="#fff" fill-opacity="' + (0.35 + 0.5 * tt).toFixed(2) + '"/>'; });
    var T = [0, 0.22, 0.42, 0.62, 0.8];
    stages(t).forEach(function (st, i) {
      var x = cx0 + (PX - cx0) * T[i], pcx = i ? x : x + 56;
      if (i) s += '<line x1="' + x.toFixed(0) + '" y1="' + (Y0 - 30) + '" x2="' + x.toFixed(0) + '" y2="' + (Y1 + 30) + '" stroke="' + FB.b2 + '" stroke-opacity="0.45" stroke-dasharray="5 6"/>';
      s += '<rect x="' + (pcx - 52).toFixed(0) + '" y="' + (Y1 + 40) + '" width="104" height="44" rx="10" fill="' + (i ? '#3d4fe0' : FB.b1) + '"/>'
        + '<text x="' + pcx.toFixed(0) + '" y="' + (Y1 + 58) + '" font-size="12" fill="#dfe3ff" text-anchor="middle">' + st[0] + '</text>'
        + '<text x="' + pcx.toFixed(0) + '" y="' + (Y1 + 77) + '" font-size="14" font-weight="900" fill="#fff" text-anchor="middle">' + st[1] + '</text>';
    });
    var per = t.purchases ? Math.round((t.reach || 0) / t.purchases) : 0;
    s += '<path d="M' + cx0 + ' ' + (Y0 - 40) + ' v-12 H' + PX + ' v12" fill="none" stroke="' + FB.b2 + '" stroke-width="2"/>'
      + '<text x="' + (cx0 + PX) / 2 + '" y="' + (Y0 - 62) + '" font-size="15" font-weight="900" fill="' + FB.b1 + '" text-anchor="middle">' + (per ? '客人一路往下掉:每 ' + F.num(per) + ' 個看到的人,有 1 個買' : '這段期間還沒有人買') + '</text>'
      + orderCircle(PX, PY, t.purchases)
      + '<rect x="' + (PX - 52) + '" y="' + (Y1 + 40) + '" width="104" height="44" rx="10" fill="' + FB.b1 + '"/>'
      + '<text x="' + PX + '" y="' + (Y1 + 58) + '" font-size="12" fill="#dfe3ff" text-anchor="middle">買單</text>'
      + '<text x="' + PX + '" y="' + (Y1 + 77) + '" font-size="14" font-weight="900" fill="#fff" text-anchor="middle">' + F.num(t.purchases || 0) + ' 單</text>';
    //  右:客人花的錢
    var FX = 1560, aov = t.purchases ? (t.revenue || 0) / t.purchases : 0;
    s += '<path d="M' + PX + ' ' + PY + ' L' + FX + ' ' + (PY - 170) + ' L' + FX + ' ' + (PY + 170) + ' Z" fill="url(#mpFan)" opacity="0.55"/>'
      + '<path d="M' + (PX + 40) + ' ' + (PY - 12) + ' h64 M' + (PX + 40) + ' ' + (PY + 12) + ' h64" stroke="#fff" stroke-width="5"/>'
      + '<text x="' + (PX + 130) + '" y="' + (Y0 + 10) + '" font-size="15" font-weight="900" fill="' + FB.ink + '">客人花的錢</text>'
      + '<text x="' + (PX + 130) + '" y="' + (Y0 + 52) + '" font-size="34" font-weight="900" fill="' + FB.b1 + '">' + F.money(t.revenue || 0) + '</text>'
      + '<text x="' + (PX + 130) + '" y="' + (Y0 + 78) + '" font-size="13" fill="' + FB.sub + '">1 元飼料換回 ' + (t.roas || 0).toFixed(2) + ' 元 · 平均一單 ' + F.money(aov) + '</text>'
      + '<text x="' + (PX + 130) + '" y="' + (PY + 90) + '" font-size="15" font-weight="900" fill="' + FB.ink + '">魚的大小(一單花多少)</text>'
      + sizeRows(d, PX + 130, PY + 132, FX - 20, 46, true);
    //  色階
    [[FB.b1, '1 元換回 3 以上'], [FB.b15, '2 ~ 3'], [FB.b2, '1.2 ~ 2'], [FB.b3, '1.2 以下'], [FB.off, '沒開']].forEach(function (c, i) {
      s += '<rect x="' + (70 + i * 130) + '" y="' + (H - 42) + '" width="14" height="14" rx="3" fill="' + c[0] + '" stroke="#d5d8f0"/><text x="' + (70 + i * 130 + 20) + '" y="' + (H - 30) + '" font-size="12" fill="' + FB.sub + '">' + c[1] + '</text>';
    });
    return { W: W, H: H, svg: s };
  }
  function funnelNarrow(list, d) {
    var t = d.totals || {}, W = 390, s = '', y = 20, nets = netsOrdered(list);
    s += '<text x="16" y="' + (y + 18) + '" font-size="19" font-weight="900" fill="' + FB.ink + '">' + esc(d.brandName || '') + ' 這 ' + rangeDays(d) + ' 天</text>'
      + '<text x="16" y="' + (y + 40) + '" font-size="12" fill="' + FB.sub + '">飼料撒進哪些網,最後撈回多少客人的錢</text>'; y += 62;
    [['飼料', wan(t.spend || 0), '#b8862f'], ['客人花', wan(t.revenue || 0), FB.b1], ['1 元換回', (t.roas || 0).toFixed(2) + ' 元', FB.b1]].forEach(function (b, i) {
      var x = 16 + i * 122;
      s += '<rect x="' + x + '" y="' + y + '" width="114" height="58" rx="12" fill="#fff"/><text x="' + (x + 12) + '" y="' + (y + 20) + '" font-size="11" fill="' + FB.sub + '">' + b[0] + '</text>'
        + '<text x="' + (x + 12) + '" y="' + (y + 45) + '" font-size="19" font-weight="900" fill="' + b[2] + '">' + b[1] + '</text>';
    }); y += 76;
    s += '<text x="16" y="' + (y + 12) + '" font-size="13" font-weight="900" fill="' + FB.ink + '">網子(飼料撒在哪)</text><text x="' + (W - 16) + '" y="' + (y + 12) + '" font-size="11" fill="' + FB.sub + '" text-anchor="end">越大 = 花越多 · 越深 = 越划算</text>'; y += 24;
    var y0 = y, top = nets.reduce(function (m, c) { return Math.max(m, c.spend); }, 1);
    var big = nets.filter(function (c) { return c.spend >= top * 0.25; }), small = nets.filter(function (c) { return c.spend < top * 0.25; }), inner = '';
    big.forEach(function (c) {
      var h = 34 + 70 * c.spend / top, col = netColor(c);
      inner += '<rect x="16" y="' + y + '" width="' + (W - 32) + '" height="' + h.toFixed(0) + '" rx="10" fill="' + col[0] + '"/>'
        + '<text x="' + W / 2 + '" y="' + (y + h / 2 - 3).toFixed(0) + '" font-size="14" font-weight="900" fill="' + col[1] + '" text-anchor="middle">' + esc(short(c.name, 18)) + '</text>'
        + '<text x="' + W / 2 + '" y="' + (y + h / 2 + 15).toFixed(0) + '" font-size="11.5" fill="' + col[1] + '" text-anchor="middle">飼料 ' + F.money(c.spend) + ' · 撈到 ' + c.purchases + ' 單 · 1 元換 ' + c.roas.toFixed(2) + '</text>';
      y += h + 6;
    });
    var cw = (W - 38) / 2;
    small.forEach(function (c, i) {
      var x = 16 + (i % 2) * (cw + 6), yy = y + Math.floor(i / 2) * 50, col = netColor(c);
      inner += '<rect x="' + x.toFixed(0) + '" y="' + yy + '" width="' + cw.toFixed(0) + '" height="44" rx="10" fill="' + col[0] + '"/>'
        + '<text x="' + (x + 10).toFixed(0) + '" y="' + (yy + 19) + '" font-size="12.5" font-weight="900" fill="' + col[1] + '">' + esc(short(c.name, 11)) + '</text>'
        + '<text x="' + (x + 10).toFixed(0) + '" y="' + (yy + 35) + '" font-size="10.5" fill="' + col[1] + '">' + (c.spend ? F.money(c.spend) + ' · ' + c.purchases + ' 單 · ' + c.roas.toFixed(2) : '沒開') + '</text>';
    });
    y += Math.ceil(small.length / 2) * 50 + 14;
    s += '<rect x="10" y="' + (y0 - 8) + '" width="' + (W - 20) + '" height="' + (y - y0) + '" rx="16" fill="#e3e6fb"/>' + inner;
    var per = t.purchases ? Math.round((t.reach || 0) / t.purchases) : 0;
    s += '<text x="' + W / 2 + '" y="' + (y + 16) + '" font-size="13" font-weight="900" fill="' + FB.b1 + '" text-anchor="middle">' + (per ? '每 ' + F.num(per) + ' 個看到的人,有 1 個買' : '這段期間還沒有人買') + '</text>'; y += 30;
    var CT = y, CB = y + 420, L = 16, R = W - 16, PX = W / 2;
    s += '<path d="M' + L + ' ' + CT + ' L' + R + ' ' + CT + ' L' + PX + ' ' + CB + ' Z" fill="url(#mpConeV)"/>';
    s += dots(150, function (tt, u) { var yy = CT + (CB - CT) * tt, half = (R - L) / 2 * (1 - tt) * 0.9; return '<circle cx="' + (PX + u * half).toFixed(0) + '" cy="' + yy.toFixed(0) + '" r="2" fill="#fff" fill-opacity="' + (0.35 + 0.5 * tt).toFixed(2) + '"/>'; });
    var T = [0.02, 0.22, 0.42, 0.62, 0.8];
    stages(t).forEach(function (st, i) {
      var yy = CT + (CB - CT) * T[i] + 22, tx = PX, anc = 'middle', tc = T[i] < 0.5 ? FB.ink : '#fff';
      if (i) s += '<line x1="' + L + '" y1="' + (yy - 22).toFixed(0) + '" x2="' + R + '" y2="' + (yy - 22).toFixed(0) + '" stroke="#fff" stroke-opacity=".5" stroke-dasharray="4 5"/>';
      if (T[i] >= 0.6) { tx = PX + (R - L) / 2 * (1 - T[i] - 0.06) + 14; anc = 'start'; tc = FB.ink; }
      s += '<text x="' + tx.toFixed(0) + '" y="' + yy.toFixed(0) + '" font-size="11" fill="' + tc + '" text-anchor="' + anc + '" opacity=".85">' + st[0] + '</text>'
        + '<text x="' + tx.toFixed(0) + '" y="' + (yy + 19).toFixed(0) + '" font-size="15" font-weight="900" fill="' + tc + '" text-anchor="' + anc + '">' + st[1] + '</text>';
    });
    s += orderCircle(PX, CB, t.purchases);
    y = CB + 56;
    var aov = t.purchases ? (t.revenue || 0) / t.purchases : 0;
    s += '<rect x="16" y="' + y + '" width="' + (W - 32) + '" height="' + (d.orderSizes ? 232 : 254) + '" rx="16" fill="#fff"/>'
      + '<text x="32" y="' + (y + 28) + '" font-size="13" font-weight="900" fill="' + FB.ink + '">客人花的錢</text>'
      + '<text x="32" y="' + (y + 64) + '" font-size="30" font-weight="900" fill="' + FB.b1 + '">' + F.money(t.revenue || 0) + '</text>'
      + '<text x="32" y="' + (y + 86) + '" font-size="11.5" fill="' + FB.sub + '">1 元飼料換回 ' + (t.roas || 0).toFixed(2) + ' 元 · 平均一單 ' + F.money(aov) + '</text>'
      + '<text x="32" y="' + (y + 120) + '" font-size="12.5" font-weight="900" fill="' + FB.ink + '">魚的大小(一單花多少)</text>'
      + sizeRows(d, 32, y + 150, W - 32, 34, false);
    y += (d.orderSizes ? 232 : 254) + 20;
    return { W: W, H: Math.ceil(y), svg: '<rect width="' + W + '" height="' + Math.ceil(y) + '" fill="' + FB.bg + '"/>' + s };
  }
  function funnelBlock(list, d, narrow) {
    var f = narrow ? funnelNarrow(list, d) : funnelWide(list, d);
    var defs = '<defs><linearGradient id="mpCone" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#e6e9ff"/><stop offset="0.55" stop-color="#7b8bf5"/><stop offset="1" stop-color="' + FB.b1 + '"/></linearGradient>'
      + '<linearGradient id="mpConeV" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e6e9ff"/><stop offset="0.55" stop-color="#7b8bf5"/><stop offset="1" stop-color="' + FB.b1 + '"/></linearGradient>'
      + '<linearGradient id="mpFan" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#9aa1c4"/><stop offset="1" stop-color="' + FB.bg + '" stop-opacity="0"/></linearGradient></defs>';
    return '<div style="border-radius:16px;overflow:hidden;background:' + FB.bg + '"><svg viewBox="0 0 ' + f.W + ' ' + f.H + '" width="100%" style="display:block" font-family="Noto Sans TC, sans-serif">' + defs + f.svg + '</svg></div>'
      + '<div class="mo-note" style="border-top:0">滑鼠移到左邊的網子上看完整數字。花費、單數只算進行中的廣告;客人花的錢是 Meta 回報的營收,有接 SMR 的品牌以 SMR 為準。</div>';
  }

  //  ② 四格(只看轉換層)
  function quadBlock(list) {
    var cfg = M.state.cfg, brand = M.state.brand;
    var mg = parseFloat(cfg['margin_' + brand]) || 0, beRoas = mg ? 100 / mg : 0;
    var conv = list.filter(function (c) { return (c.layer === 'auto' || c.layer === 'gate' || c.layer === 'rt') && c.budget && c.spend > 0; });
    if (!conv.length) return '';
    var Q = { a: [], b: [], c: [], d: [] };
    conv.forEach(function (c) {
      var full = c.avgDaily / c.budget >= 0.85, good, yard;
      if (c.floor) { good = c.roas >= c.floor; yard = 'ROAS ' + c.roas.toFixed(2) + ' / 門檻 ' + c.floor; }
      else if (c.cap && c.strat !== 'LOWEST_COST_WITH_BID_CAP') { good = c.cpa && c.cpa <= c.cap; yard = 'CPA ' + F.money(c.cpa) + ' / 門檻 ' + F.money(c.cap); }
      else { var tgt = beRoas || cfg.roasTarget || 3; good = c.roas >= tgt; yard = 'ROAS ' + c.roas.toFixed(2) + ' / ' + (beRoas ? '損益兩平 ' : '目標 ') + tgt.toFixed(2); }
      var line = '<span title="' + esc(c.name) + '">• ' + esc(c.name.slice(0, 22)) + '<span class="mo-flat">(' + yard + ',撐開 ' + Math.round(c.avgDaily / c.budget * 100) + '%)</span></span>';
      (full ? (good ? Q.a : Q.b) : (good ? Q.c : Q.d)).push(line);
    });
    function box(k, title, txt, color) {
      return '<div class="mp-q" style="border-left:3px solid ' + color + '"><b class="t">' + title + '</b>' + txt
        + '<div class="c">' + (Q[k].length ? Q[k].join('') : '<span class="mo-flat">目前沒有</span>') + '</div></div>';
    }
    return '<div class="mo-card"><div class="mo-h">每張網卡在哪一格 <small>Meta 簡報「出價 × 預算」圖 · 只看轉換活動</small></div>'
      + '<div class="mp-quad">'
      + box('a', '錢花滿了、還達標 = 預算受限', '魚還很多、網子太小。可以加預算,或改用 CIBS(預算放大 + 設門檻)把多的魚撈回來。', '#6DFAC2')
      + box('b', '錢花滿了、沒達標 = 魚不咬', '預算夠,是轉換率不夠。先換多元素材、換開頭與主圖,不是加預算。', '#FA6D9B')
      + box('c', '沒花滿、但達標 = 門檻卡住', '有設門檻的(CIBS):平日待命是正常的,週末 / 檔期才放量。連旺日都放不出來,才代表門檻比盈虧平衡點還嚴。不設門檻的:受眾太小或素材不夠。', '#FFD36D')
      + box('d', '沒花滿、也沒達標 = 還在找魚', '多半是學習期還沒過,或受眾太窄。學習中先別頻繁改預算;一週湊不到 50 單就合併相似的活動。', '#B9A8FF')
      + '</div><div class="mp-axis"><span>← 沒花滿</span><span>花滿了 →</span></div>'
      + '<div class="mo-note"><b>標準:</b>平均每天花到日預算 85% 以上算「花滿」。有設門檻的活動用它自己的門檻判斷;沒設門檻的用'
      + (beRoas ? '這個品牌的損益兩平 ROAS ' + beRoas.toFixed(2) + '(總覽右上角填的毛利率算出來的)' : '目標 ROAS ' + (cfg.roasTarget || 3) + '(在總覽右上角填毛利率,會改用損益兩平 ROAS)') + '。</div></div>';
  }

  function render(d) {
    var el = document.getElementById('mon-pool'); if (!el) return;
    injectCss();
    var list = build(d);
    if (!list.length) { el.innerHTML = '<div class="mo-card"><div class="mo-h">魚池地圖</div><div class="mo-flat" style="font-size:11px">目前沒有進行中的行銷活動。</div></div>'; return; }
    var narrow = el.clientWidth && el.clientWidth < 640; el.__narrow = narrow;
    el.innerHTML = funnelBlock(list, d, narrow) + quadBlock(list) + layerBlock(list, d);
  }
  //  手機 / 電腦切換時重畫(橫的 ↔ 直的)
  var rt = null;
  window.addEventListener('resize', function () {
    clearTimeout(rt); rt = setTimeout(function () {
      var el = document.getElementById('mon-pool'); if (!el || !M.state.data) return;
      if ((el.clientWidth < 640) !== !!el.__narrow) render(M.state.data);
    }, 250);
  });

  M.on('data', render);
  if (M.state.data) render(M.state.data);
  window.MON_POOL = { version: 'monitor-pool v1.3' };
})();
