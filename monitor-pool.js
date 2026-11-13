/* ══════════════════════════════════════════════════════════════
   Brand OS · monitor-pool.js · v1.0(2026-11-13)
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
    function bar(key, tot) {
      return '<div class="mp-split">' + LAYERS.map(function (L) {
        var v = sum[L.k][key], p = tot ? v / tot * 100 : 0;
        return p > 0 ? '<i style="width:' + p.toFixed(1) + '%;background:' + L.color + '" title="' + L.name + ' ' + p.toFixed(0) + '%">' + (p >= 9 ? p.toFixed(0) + '%' : '') + '</i>' : '';
      }).join('') + '</div>';
    }
    var legend = '<div class="mo-legend">' + LAYERS.map(function (L) { return '<span><i style="background:' + L.color + '"></i>' + L.name + '</span>'; }).join('') + '</div>';
    var html = '<div class="mp-row2"><span>每日預算</span>' + bar('b', totB) + '</div>'
      + '<div class="mp-row2"><span>實際花費</span>' + bar('s', totS) + '</div>'
      + '<div class="mp-row2"><span>撈到的單</span>' + bar('p', totP) + '</div>' + legend;

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
    return '<div class="mo-card"><div class="mo-h">各層怎麼撒網 <small>' + list.length + ' 個進行中的行銷活動 · 期間 ' + rangeDays(d) + ' 天</small></div>' + html
      + '<div class="mo-note"><b>怎麼看:</b>上面三條是同一個帳號的錢怎麼分:每天預算放在哪一層、實際花在哪一層、單是哪一層撈到的。'
      + '「平均每天花」÷「日預算」= 網子撐開了幾成。「出價門檻」= 這張網只撈多划算的魚(ROAS ≥ 3 = 每花 1 元至少要賺回 3 元;CPA ≤ 800 = 一單成本超過 800 就不搶)。'
      + '門檻越嚴,單越便宜但量越少;花費、單數只算進行中的廣告。</div></div>';
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
    el.innerHTML = layerBlock(list, d) + quadBlock(list);
  }

  M.on('data', render);
  if (M.state.data) render(M.state.data);
  window.MON_POOL = { version: 'monitor-pool v1.0' };
})();
