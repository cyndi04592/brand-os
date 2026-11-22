/* ══════════════════════════════════════════════════════════════
   Brand OS · monitor-intl.js · v1.0(2026-11-22)
   廣告監控頁「大品牌還會看的 5 件事」(國際對標;老闆 11/22 15:57「國際型大品牌跟我們還差哪些」)
   研究全文:主機 depts\radar\國際對標\廣告監控差距.md、對標品牌與市場範圍.md

   五張卡,每張最下面一句白話「怎麼看」(= 該加錢 / 減錢 / 換素材):
   ① 賺不賺   打平線、POAS(毛利 ÷ 廣告費)、新客成本        ← 現有資料就算得出來
   ② 歸因並排  點了 1 天內買 / 點了 2–7 天才買 / 只看過沒點   ← 完整版要 Worker v2.9;舊版先給兩段
   ③ 年齡 × 性別  哪一格花最多但最差                        ← 要 Worker v2.9
   ④ 國家、平台 × 裝置                                      ← 要 Worker v2.9
   ⑤ 素材節奏與疲勞  幾支在跑、幾天沒上新、每支 14 天走勢      ← 節奏用現有資料;走勢要 Worker v2.9

   資料:MON.state.data(現有 dashboard)+ MON.intl()(Worker ads-monitor v2.9 action 'intl',只讀 Meta、不改廣告)
   Worker 還沒上 v2.9(回「不認得的動作」)→ 需要它的卡寫「等後端新版上線」,不藏、不填 0。
   客戶類型(純電商 / 門市加電商 / 高客單諮詢 / 餐廳在地):只換卡片順序和最上面那句「這類先看什麼」,存這台電腦。
   網址加 ?intldemo=1(購物)或 ?intldemo=msg(訊息)→ 用寫死的示範數字畫一次(畫面標「示範資料」,只給驗收截圖用)。
   規則:這一區的數字一律完整顯示,不准用「…」截掉;名稱太長就換行。
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (!window.MON) { console.error('[intl] 要先載 monitor-data.js'); return; }
  var M = window.MON, F = M.fmt;
  var DEMO = (location.search.match(/[?&]intldemo=([a-z0-9]+)/) || [])[1] || '';

  var CSS = ''
    + '#mon-intl{display:flex;flex-direction:column;gap:14px}'
    + '.in-top{display:flex;flex-wrap:wrap;gap:8px;align-items:center;font-size:12.5px;color:var(--t2,#c8c8d8);line-height:1.7}'
    + '.in-type{padding:6px 12px;border-radius:999px;border:1px solid rgba(255,255,255,.18);background:transparent;color:var(--t2,#c8c8d8);font-size:12px;cursor:pointer;font-family:inherit;min-height:34px}'
    + '.in-type.on{border-color:var(--gold,#7C6DFA);color:#fff;background:rgba(124,109,250,.16);font-weight:700}'
    + '.in-first{flex:1 1 100%;font-size:12.5px;color:var(--t2,#c8c8d8)}.in-first b{color:#fff}'
    + '.in-demo{display:inline-block;font-size:11px;font-weight:700;color:#111;background:#FAC85A;border-radius:6px;padding:1px 7px;margin-right:6px}'
    + '.in-sub{font-size:12px;color:var(--t3,#8a8aa0);line-height:1.7;margin:-6px 0 12px}'
    + '.in-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}'
    + '.in-kpi{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:11px;padding:11px 12px;min-width:0}'
    + '.in-kpi .t{font-size:12px;color:var(--t3,#8a8aa0)}'
    + '.in-kpi .v{font-size:20px;font-weight:800;color:#fff;margin:3px 0 2px;font-variant-numeric:tabular-nums;overflow-wrap:anywhere;line-height:1.25}'
    + '.in-kpi .s{font-size:12px;color:var(--t2,#c8c8d8);line-height:1.55}'
    + '.in-kpi.good{border-color:rgba(109,250,194,.45)}.in-kpi.bad{border-color:rgba(250,109,155,.55)}.in-kpi.none .v{font-size:14px;font-weight:600;color:var(--t2,#c8c8d8)}'
    + '.in-how{margin-top:14px;padding:11px 13px;border-left:3px solid var(--gold,#7C6DFA);background:rgba(255,255,255,.04);font-size:13.5px;line-height:1.75;color:#fff}'
    + '.in-how.good{border-left-color:var(--mint,#6DFAC2)}.in-how.bad{border-left-color:var(--pink,#FA6D9B)}.in-how.warn{border-left-color:#FAC85A}'
    + '.in-how b{font-weight:800}.in-how small{display:block;font-size:12px;color:var(--t3,#8a8aa0);margin-top:4px;line-height:1.65}'
    + '.in-wait{padding:14px;border:1px dashed rgba(255,255,255,.2);font-size:12.5px;color:var(--t2,#c8c8d8);line-height:1.75}'
    + '.in-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}'
    + '.in-tbl{width:100%;border-collapse:collapse;font-size:12.5px;margin-top:6px}'
    + '.in-tbl th{text-align:right;font-weight:600;color:var(--t3,#8a8aa0);padding:7px 8px;border-bottom:1px solid rgba(255,255,255,.1);white-space:nowrap}'
    + '.in-tbl td{text-align:right;padding:8px;border-bottom:1px solid rgba(255,255,255,.05);color:var(--t2,#c8c8d8);white-space:nowrap;font-variant-numeric:tabular-nums}'
    + '.in-tbl th:first-child,.in-tbl td:first-child{text-align:left;white-space:normal;overflow-wrap:anywhere;min-width:96px;color:#fff}'
    + '.in-tbl tr.flag td{background:rgba(250,109,155,.08)}.in-tbl tr.star td{background:rgba(109,250,194,.07)}'
    + '.in-g{color:var(--mint,#6DFAC2)!important;font-weight:700}.in-b{color:var(--pink,#FA6D9B)!important;font-weight:700}.in-dim{color:var(--t3,#8a8aa0)!important}'
    + '.in-split{display:flex;height:26px;margin:4px 0 10px;border:1px solid rgba(255,255,255,.12)}'
    + '.in-split i{display:block;height:100%;min-width:2px}.in-split .a{background:var(--mint,#6DFAC2)}.in-split .b{background:var(--gold,#7C6DFA)}.in-split .c{background:var(--pink,#FA6D9B)}'
    + '.in-sw.a{background:var(--mint,#6DFAC2)}.in-sw.b{background:var(--gold,#7C6DFA)}.in-sw.c{background:var(--pink,#FA6D9B)}'
    + '.in-leg{display:flex;flex-wrap:wrap;gap:6px 16px;font-size:12px;color:var(--t2,#c8c8d8);margin-bottom:8px}'
    + '.in-leg i{display:inline-block;width:10px;height:10px;margin-right:6px;vertical-align:-1px}'
    + '.in-grid{display:grid;grid-template-columns:auto 1fr 1fr;gap:6px;align-items:stretch;font-size:12.5px}'
    + '.in-grid .hd{font-size:12px;color:var(--t3,#8a8aa0);padding:2px 4px;text-align:center}.in-grid .ag{display:flex;align-items:center;color:#fff;font-weight:700;padding-right:6px;white-space:nowrap}'
    + '.in-cell{position:relative;border:1px solid rgba(255,255,255,.1);padding:8px 9px;background:rgba(255,255,255,.03);min-width:0;overflow:hidden}'
    + '.in-cell u{position:absolute;left:0;top:0;bottom:0;background:rgba(124,109,250,.2);text-decoration:none;z-index:0}'
    + '.in-cell.good u{background:rgba(109,250,194,.2)}.in-cell.bad u{background:rgba(250,109,155,.24)}'
    + '.in-cell.bad{border-color:rgba(250,109,155,.6)}.in-cell.good{border-color:rgba(109,250,194,.5)}'
    + '.in-cell b,.in-cell span{position:relative;z-index:1;display:block;font-variant-numeric:tabular-nums}'
    + '.in-cell b{color:#fff;font-size:14px;font-weight:800}.in-cell span{font-size:12px;color:var(--t2,#c8c8d8);line-height:1.5}'
    + '.in-two{display:grid;grid-template-columns:1fr 1fr;gap:18px}'
    + '.in-two h4{font-size:12.5px;font-weight:700;color:#fff;margin:0 0 2px}'
    + '.in-ads{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px;margin-top:12px}'
    + '.in-ad{border:1px solid rgba(255,255,255,.1);padding:10px 11px;background:rgba(255,255,255,.03);min-width:0}'
    + '.in-ad.bad{border-color:rgba(250,109,155,.6)}'
    + '.in-ad .nm{font-size:12.5px;color:#fff;font-weight:700;line-height:1.5;overflow-wrap:anywhere}'
    + '.in-ad svg{display:block;width:100%;height:54px;margin:6px 0 4px}'
    + '.in-ad .tx{font-size:12px;color:var(--t2,#c8c8d8);line-height:1.6}'
    + '.in-mg{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;color:var(--t2,#c8c8d8);margin-left:auto}'
    + '.in-mg input{width:64px;padding:6px 8px;border:1px solid rgba(255,255,255,.25);background:#000;color:#fff;font-size:16px;font-family:inherit;text-align:right}'
    + 'html.sp .in-type,html.sp .in-kpi,html.sp .in-demo{border-radius:0}'
    + 'html.sp .in-kpi{background:#000;border-color:rgba(255,255,255,.14)}'
    + 'html.sp .in-kpi .v{font-family:"Barlow",sans-serif;font-weight:600}'
    + 'html.sp.sp-monitor #sec-intl::before{content:"BENCHMARK"}'
    + '@media(max-width:640px){.in-two{grid-template-columns:1fr}.in-kpis{grid-template-columns:1fr 1fr}.in-kpi .v{font-size:18px}.in-mg{margin-left:0;flex:1 1 100%}.in-grid{gap:5px}.in-cell{padding:7px}.in-type{min-height:44px;padding:8px 14px}.in-mg input{min-height:44px}}';
  function css() {
    if (document.getElementById('in-css')) return;
    var s = document.createElement('style'); s.id = 'in-css'; s.textContent = CSS; document.head.appendChild(s);
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function pct(n, d) { return (n || 0).toFixed(d == null ? 0 : d) + '%'; }
  function sum(a, f) { var t = 0; (a || []).forEach(function (x) { t += f(x) || 0; }); return t; }

  // ── 客戶類型:只換順序和第一句 ────────────────────────────
  var TYPES = {
    ec:      { name: '純電商', order: ['profit', 'attrib', 'creative', 'demo', 'geo'], say: '<b>先看賺不賺</b>(ROAS 對打平線)和新客成本,再看素材有沒有疲勞。' },
    omni:    { name: '門市加電商', order: ['geo', 'profit', 'demo', 'creative', 'attrib'], say: '這裡只看得到<b>線上成交</b>;門市成交還沒有資料來源(要 POS 或發票資料)。先看地區和打平線,線上 ROAS 偏低不一定代表廣告沒用。' },
    consult: { name: '高客單 / 諮詢', order: ['demo', 'geo', 'creative', 'attrib', 'profit'], say: '成交不在線上,<b>不要用 ROAS 判斷</b>;看每一筆詢問花多少、是不是打到對的年齡和地區。' },
    local:   { name: '餐廳 / 在地', order: ['geo', 'demo', 'creative', 'attrib', 'profit'], say: '<b>先看地區和裝置</b>(是不是打到附近的人)、每一筆詢問或訂位的成本;ROAS 不適用。' }
  };
  function typeOf(d) {
    var t = M.state.cfg['type_' + d.brand];
    if (TYPES[t]) return { key: t, set: true };
    return { key: M.goal(d) === 'purchase' ? 'ec' : 'consult', set: false };
  }

  // ── 共用:這個品牌的「成果」是什麼 ─────────────────────────
  function ctx(d) {
    var g = M.goal(d), W = M.W(d), t = d.totals || {};
    var conv = function (r) { return g === 'message' ? (r.messages || 0) : g === 'lead' ? (r.leads || 0) : (r.purchases || 0); };
    return { g: g, W: W, buy: g === 'purchase', conv: conv, t: t,
      roas: t.roas || 0, cpa: t.cpa || 0, margin: parseFloat(M.state.cfg['margin_' + d.brand]) || 0 };
  }
  function card(title, tag, sub, body, how) {
    return '<div class="mo-card"><div class="mo-h">' + title + (tag || '') + '</div><div class="in-sub">' + sub + '</div>' + body
      + (how ? '<div class="in-how ' + (how.k || '') + '"><b>怎麼看:</b>' + how.t + (how.s ? '<small>' + how.s + '</small>' : '') + '</div>' : '') + '</div>';
  }
  function kpi(t, v, s, k) { return '<div class="in-kpi ' + (k || '') + '"><div class="t">' + t + '</div><div class="v">' + v + '</div><div class="s">' + (s || '') + '</div></div>'; }
  function wait(what) {
    return '<div class="in-wait">' + what + '這一塊要等後端新版(ads-monitor v2.9)上線才有資料;預覽站現在連的是正式後端,所以先空著,<b>不是 0</b>。</div>';
  }
  function tagOf(k, txt) { return ' <span class="mo-tag ' + k + '">' + txt + '</span>'; }

  // ── ① 賺不賺 ────────────────────────────────────────────
  function cProfit(d, x) {
    var c = ctx(d), body, how, tag = '';
    if (!c.buy) {
      //  訊息 / 名單品牌:一筆詢問最多能花多少(總覽右上角填的 單價 × 成交率)
      var cap = M.cap(d), n = c.t.purchases || 0;
      body = '<div class="in-kpis">'
        + kpi(c.W.cpaLong, n ? F.money(c.cpa) : '還沒有' + c.W.conv, '這段期間 ' + F.num(n) + ' ' + c.W.unit)
        + (cap ? kpi(c.W.per + '最多能花', F.money(cap), '單價 × 成交率(總覽右上角填的)', c.cpa && c.cpa <= cap ? 'good' : 'bad')
               : kpi(c.W.per + '最多能花', '還沒填', '到「總覽」右上角填單價和成交率,才知道' + c.W.per + '花多少算划算', 'none'))
        + kpi('觸及人數', F.num(c.t.reach), '平均每人看到 ' + (c.t.frequency || 0).toFixed(1) + ' 次')
        + '</div>';
      if (!cap) how = { k: 'warn', t: '還沒填「單價」和「成交率」,所以只知道' + c.W.per + '花 ' + F.money(c.cpa) + ',不知道划不划算。填了之後這裡會直接告訴你該加還是該減。' };
      else if (!n) how = { k: 'warn', t: '這段期間還沒有' + c.W.conv + ',先看下面的素材和受眾。' };
      else if (c.cpa <= cap * 0.7) { how = { k: 'good', t: c.W.per + '花 ' + F.money(c.cpa) + ',離上限 ' + F.money(cap) + ' 還有 ' + pct((1 - c.cpa / cap) * 100) + ' 空間 → <b>可以加預算</b>。' }; tag = tagOf('good', '可以加'); }
      else if (c.cpa <= cap) { how = { k: '', t: c.W.per + '花 ' + F.money(c.cpa) + ',已經接近上限 ' + F.money(cap) + ' → <b>先維持</b>,加預算前先換一輪素材。' }; tag = tagOf('warn', '維持'); }
      else { how = { k: 'bad', t: c.W.per + '花 ' + F.money(c.cpa) + ',超過上限 ' + F.money(cap) + ' → 每一' + c.W.unit + '都在倒貼,<b>先減預算或換素材</b>。' }; tag = tagOf('bad', '該減'); }
      return card('① 一筆詢問划不划算', tag, '高客單、要諮詢才成交的品牌不看 ROAS,看每一筆詢問的成本有沒有超過「這筆詢問值多少」。', body, how);
    }
    var mg = c.margin, be = mg ? 100 / mg : 0, poas = mg ? c.roas * mg / 100 : 0;
    //  新客成本:ASC 的受眾分段(現有 dashboard 就有)
    var seg = Array.isArray(d.segments) ? d.segments : null, nc = null;
    if (seg && seg.length) {
      var isNew = function (s) { return s.key === 'prospecting' || s.key === 'new_customers'; };
      var ns = sum(seg.filter(isNew), function (s) { return s.spend; }), np = sum(seg.filter(isNew), function (s) { return s.purchases; }), ap = sum(seg, function (s) { return s.purchases; });
      nc = { spend: ns, n: np, cac: np ? ns / np : 0, share: ap ? np / ap * 100 : 0 };
    }
    var mgBox = '<label class="in-mg">這個品牌的毛利率 <input id="inMargin" inputmode="decimal" value="' + (mg || '') + '" placeholder="例 45">%</label>';
    body = '<div class="in-kpis">'
      + kpi('現在的 ROAS', F.x(c.roas), 'Meta 回報營收 ÷ 廣告費' + (d.hasSmr ? ';這個品牌 Meta 數字偏高,真實看 SMR' : ''))
      + (mg ? kpi('打平線', F.x(be), '毛利率 ' + mg + '% → ROAS 要過這條才不賠', c.roas >= be ? 'good' : 'bad')
            : kpi('打平線', '還沒填毛利率', '右上角填一次就記住(存在這台電腦)', 'none'))
      + (mg ? kpi('毛利後回報(POAS)', poas.toFixed(2), '每花 100 元廣告,賺回 ' + F.num(poas * 100) + ' 元毛利;1.00 = 剛好打平', poas >= 1 ? 'good' : 'bad')
            : kpi('毛利後回報(POAS)', '還沒填毛利率', '毛利 ÷ 廣告費', 'none'))
      + (nc ? (nc.n ? kpi('拿一個新客花多少', F.money(nc.cac), '新客 ' + F.num(nc.n) + ' 單,佔全部購買 ' + pct(nc.share) + '(只算 ASC 活動)')
                    : kpi('拿一個新客花多少', '這段期間新客 0 單', 'ASC 花在新客 ' + F.money(nc.spend), 'bad'))
            : kpi('拿一個新客花多少', '沒有這項資料', '只有在跑 ASC / Advantage+ 的品牌 Meta 才分得出新客', 'none'))
      + kpi('整體營收 ÷ 全部行銷費(MER)', d.hasSmr ? '看 SMR' : '還沒有資料來源', d.hasSmr ? '全站真實營收在 SMR,這頁還沒接進來' : '要全站營收(官網後台),這個品牌還沒接', 'none')
      + '</div>';
    if (!mg) how = { k: 'warn', t: '還沒填毛利率,所以只知道 ROAS 是 ' + F.x(c.roas) + ',不知道有沒有賺。同樣 ROAS 4,毛利 60% 的商品是大賺、毛利 18% 的是賠錢。<b>右上角填一次毛利率</b>,這裡就會直接講該加還是該減。' };
    else if (poas >= 1.3) { how = { k: 'good', t: 'ROAS ' + F.x(c.roas) + ' 比打平線 ' + F.x(be) + ' 高 ' + pct((c.roas / be - 1) * 100) + ':每花 100 元廣告,扣掉商品成本還賺回 ' + F.num(poas * 100) + ' 元 → <b>可以加預算</b>。' }; tag = tagOf('good', '可以加'); }
    else if (poas >= 1) { how = { k: '', t: 'ROAS ' + F.x(c.roas) + ' 只比打平線 ' + F.x(be) + ' 高 ' + pct((c.roas / be - 1) * 100) + ',賺得很薄 → <b>先維持,不要加</b>;一打折或運費一漲就會跌破。' }; tag = tagOf('warn', '維持'); }
    else { how = { k: 'bad', t: 'ROAS ' + F.x(c.roas) + ' 低於打平線 ' + F.x(be) + ':每花 100 元廣告只賺回 ' + F.num(poas * 100) + ' 元毛利,<b>等於賠錢在跑 → 先減預算或換素材</b>。' }; tag = tagOf('bad', '該減'); }
    if (how && nc && nc.n && mg) how.s = '新客那一單的毛利大約 ' + F.money((c.t.purchases ? c.t.revenue / c.t.purchases : 0) * mg / 100) + ',拿一個新客花 ' + F.money(nc.cac) + (nc.cac > (c.t.purchases ? c.t.revenue / c.t.purchases : 0) * mg / 100 ? ' → 第一單是虧的,要靠回購賺回來。' : ' → 第一單就有賺。');
    return card('① 賺不賺:打平線與毛利後回報', tag + mgBox, '純電商品牌不只看 ROAS,會先算「ROAS 要多少才不賠」,再看扣掉商品成本後每一塊廣告費賺回多少。', body, how);
  }

  // ── ② 歸因窗口並排 ───────────────────────────────────────
  function cAttrib(d, x) {
    var c = ctx(d), k = c.buy ? 'purchases' : c.g === 'message' ? 'messages' : 'leads';
    var w = x && x.ok && x.windows && x.windows.total, full = !!w, a1, a7, v1, r1 = 0, r7 = 0, rv = 0, spend = c.t.spend || 0;
    if (full) { a1 = w['1d_click'][k]; a7 = w['7d_click'][k]; v1 = w['1d_view'][k]; r1 = w['1d_click'].revenue; r7 = w['7d_click'].revenue; rv = w['1d_view'].revenue; spend = w.spend || spend; }
    else if (d.attrib && c.buy) { a1 = null; a7 = d.attrib.click; v1 = d.attrib.view; r7 = d.attrib.clickRev; rv = d.attrib.viewRev; }
    else return card('② 成交是怎麼算進來的(歸因並排)', '', 'Meta 會把「點了廣告之後買」和「只是滑過廣告、之後自己來買」都算成廣告的功勞。大品牌會把這幾種並排看。', wait('歸因並排'), null);
    var tot = (a7 || 0) + (v1 || 0);
    if (!tot) return card('② 成交是怎麼算進來的(歸因並排)', '', '把「點了才' + c.W.conv + '」和「只看過沒點」分開看。', '<div class="in-wait">這段期間還沒有' + c.W.conv + ',沒有東西可以拆。</div>', null);
    var late = full ? Math.max(0, a7 - a1) : 0, sh = function (n) { return n / tot * 100; };
    var rows = [];
    if (full) {
      rows.push(['a', '點了廣告,1 天內' + c.W.conv, a1, r1]);
      rows.push(['b', '點了廣告,第 2–7 天才' + c.W.conv, late, Math.max(0, r7 - r1)]);
    } else rows.push(['a', '點了廣告,7 天內' + c.W.conv, a7, r7]);
    rows.push(['c', '只看過廣告沒點,1 天內' + c.W.conv, v1, rv]);
    var body = '<div class="in-split">' + rows.map(function (r) { return '<i class="' + r[0] + '" style="width:' + sh(r[2]).toFixed(1) + '%"></i>'; }).join('') + '</div>'
      + '<div class="in-scroll"><table class="in-tbl"><thead><tr><th>怎麼算進來的</th><th>' + c.W.conv + '</th><th>佔比</th>' + (c.buy ? '<th>營收</th>' : '') + '</tr></thead><tbody>'
      + rows.map(function (r) {
        return '<tr><td><i style="display:inline-block;width:10px;height:10px;margin-right:6px" class="in-sw ' + r[0] + '"></i>' + r[1] + '</td><td>' + F.num(r[2]) + '</td><td>' + pct(sh(r[2])) + '</td>' + (c.buy ? '<td>' + F.money(r[3]) + '</td>' : '') + '</tr>';
      }).join('') + '</tbody></table></div>';
    var vs = sh(v1 || 0), how, tag;
    if (c.buy) {
      var roasAll = spend ? (r7 + rv) / spend : 0, roasClick = spend ? r7 / spend : 0, roas1 = spend && full ? r1 / spend : 0;
      body += '<div class="in-kpis" style="margin-top:12px">'
        + kpi('Meta 預設算法的 ROAS', F.x(roasAll), '點擊 7 天 + 瀏覽 1 天,全部算')
        + kpi('只算有點廣告的 ROAS', F.x(roasClick), '拿掉「只看過沒點」', vs >= 40 ? 'bad' : '')
        + (full ? kpi('最嚴格:點了 1 天內買', F.x(roas1), '最保守的算法') : kpi('最嚴格:點了 1 天內買', '等後端新版', '現在的後端只分得出兩段', 'none'))
        + '</div>';
      if (vs >= 40) { how = { k: 'bad', t: '有 <b>' + pct(vs) + '</b> 的成交是「只看過廣告沒點」算進來的,這些人很多本來就會買。<b>決定加不加錢請看「只算有點的 ROAS ' + F.x(roasClick) + '」</b>,不要看 ' + F.x(roasAll) + '。' }; tag = tagOf('bad', '數字偏樂觀'); }
      else if (vs >= 20) { how = { k: 'warn', t: '「只看過沒點」佔 ' + pct(vs) + ',算正常範圍,但加預算前用「只算有點的 ROAS ' + F.x(roasClick) + '」再確認一次有沒有過打平線。' }; tag = tagOf('warn', '留意'); }
      else { how = { k: 'good', t: '成交有 ' + pct(100 - vs) + ' 是真的點了廣告才買,<b>數字很紮實</b>,可以直接照 ROAS 做決定。' }; tag = tagOf('good', '紮實'); }
    } else {
      if (vs >= 40) { how = { k: 'bad', t: '有 ' + pct(vs) + ' 的' + c.W.conv + '是「只看過沒點」算進來的,實際由廣告帶來的沒有報表上那麼多。' }; tag = tagOf('bad', '數字偏樂觀'); }
      else { how = { k: 'good', t: c.W.conv + '有 ' + pct(100 - vs) + ' 是真的點了廣告才來的,數字可信。' }; tag = tagOf('good', '紮實'); }
    }
    if (full && late / tot >= 0.3) how.s = '有 ' + pct(late / tot * 100) + ' 的人點了之後隔 2–7 天才' + c.W.conv + ':新上的廣告至少放滿 7 天再判斷,不要 3 天就關。';
    //  哪個行銷活動最靠「看過沒點」
    if (full && x.windows.campaigns && x.windows.campaigns.length > 1) {
      var cs = x.windows.campaigns.slice(0, 6);
      body += '<div class="in-scroll"><table class="in-tbl"><thead><tr><th>行銷活動(花費前 6)</th><th>花費</th><th>' + (c.buy ? '只算點擊的 ROAS' : '點擊帶來的' + c.W.conv) + '</th><th>看過沒點佔比</th></tr></thead><tbody>'
        + cs.map(function (m) {
          var ck = m['7d_click'][k], vw = m['1d_view'][k], t2 = ck + vw, s2 = t2 ? vw / t2 * 100 : 0;
          return '<tr' + (s2 >= 60 && t2 >= 5 ? ' class="flag"' : '') + '><td>' + esc(m.name) + '</td><td>' + F.money(m.spend) + '</td><td>' + (c.buy ? F.x(m.spend ? m['7d_click'].revenue / m.spend : 0) : F.num(ck)) + '</td><td class="' + (s2 >= 60 && t2 >= 5 ? 'in-b' : '') + '">' + (t2 ? pct(s2) : '—') + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    }
    if (!full) body += '<div class="in-wait" style="margin-top:10px">現在的後端只分得出「點擊 7 天」和「瀏覽 1 天」兩段;「點了 1 天內」和各行銷活動的拆法要等後端新版(ads-monitor v2.9)上線。</div>';
    return card('② 成交是怎麼算進來的(歸因並排)', tag, 'Meta 會把「點了廣告之後' + c.W.conv + '」和「只是滑過廣告、之後自己來' + c.W.conv + '」都算成廣告的功勞。大品牌會把幾種算法並排,避免被報表數字騙。', body, how);
  }

  // ── ③ 年齡 × 性別 ────────────────────────────────────────
  function eff(c, r) {   // 效率:購物看 ROAS(越高越好),其他看每筆成本(越低越好)→ 都轉成「越大越好」的倍數(對整體平均)
    var n = c.conv(r);
    if (c.buy) { var ro = r.spend ? r.revenue / r.spend : 0; return { v: ro, txt: 'ROAS ' + ro.toFixed(2), rel: c.roas ? ro / c.roas : 0, n: n }; }
    var cp = n ? r.spend / n : 0; return { v: cp, txt: n ? c.W.per + ' ' + F.money(cp) : '0 ' + c.W.unit, rel: n && c.cpa ? c.cpa / cp : 0, n: n };
  }
  function cDemo(d, x) {
    var c = ctx(d), rows = x && x.ok && x.demo;
    var title = '③ 錢花在誰身上(年齡 × 性別)', sub = '同一筆預算,不同年齡性別的成效可以差好幾倍。大品牌每週看一次「哪一格花最多但最差」。';
    if (!rows) return card(title, '', sub, wait('年齡 × 性別'), null);
    var tot = sum(rows, function (r) { return r.spend; });
    if (!tot) return card(title, '', sub, '<div class="in-wait">這段期間沒有花費。</div>', null);
    var G = { female: '女', male: '男' }, ages = [], map = {}, unk = 0;
    rows.forEach(function (r) {
      if (!G[r.gender]) { unk += r.spend; return; }
      if (ages.indexOf(r.age) < 0) ages.push(r.age);
      map[r.age + '|' + r.gender] = r;
    });
    ages.sort();
    var cells = [], worst = null, best = null;
    ages.forEach(function (a) { ['female', 'male'].forEach(function (g) {
      var r = map[a + '|' + g]; if (!r) return;
      var e = eff(c, r), share = r.spend / tot * 100, o = { a: a, g: g, r: r, e: e, share: share, label: a + ' 歲' + G[g] + '性' };
      cells.push(o);
      var enough = c.buy ? r.spend >= 300 : true;
      if (share >= 10 && enough && e.rel < 0.7 && (!worst || share > worst.share)) worst = o;
      if (share >= 4 && e.n >= 3 && e.rel > 1.25 && (!best || e.rel > best.e.rel)) best = o;
    }); });
    var mx = Math.max.apply(null, cells.map(function (o) { return o.share; }).concat([1]));
    var body = '<div class="in-grid"><div class="hd"></div><div class="hd">女性</div><div class="hd">男性</div>'
      + ages.map(function (a) {
        return '<div class="ag">' + esc(a) + '</div>' + ['female', 'male'].map(function (g) {
          var o = cells.filter(function (z) { return z.a === a && z.g === g; })[0];
          if (!o) return '<div class="in-cell"><span class="in-dim">沒投到</span></div>';
          var k = o === worst ? 'bad' : o === best ? 'good' : '';
          return '<div class="in-cell ' + k + '"><u style="width:' + (o.share / mx * 100).toFixed(0) + '%"></u><b>' + pct(o.share) + ' 預算</b><span>' + o.e.txt + (o.e.n < 3 ? '(樣本少)' : '') + '</span></div>';
        }).join('');
      }).join('') + '</div>'
      + '<div class="in-leg" style="margin-top:10px"><span>每格:佔這段期間花費幾 % ／ ' + (c.buy ? 'ROAS(整體 ' + F.x(c.roas) + ')' : c.W.cpaLong + '(整體 ' + F.money(c.cpa) + ')') + '</span><span><i style="background:var(--pink,#FA6D9B)"></i>花很多但明顯比整體差</span><span><i style="background:var(--mint,#6DFAC2)"></i>明顯比整體好</span></div>';
    var how, tag = '';
    if (worst && best) { how = { k: 'bad', t: '<b>' + worst.label + '</b>吃掉 ' + pct(worst.share) + ' 預算,' + worst.e.txt + ',明顯比整體差;<b>' + best.label + '</b> ' + best.e.txt + ' 卻只花 ' + pct(best.share) + '。→ 給' + worst.label + '換一支專門的素材,或把預算往' + best.label + '移。' }; tag = tagOf('bad', '有一格在漏錢'); }
    else if (worst) { how = { k: 'bad', t: '<b>' + worst.label + '</b>吃掉 ' + pct(worst.share) + ' 預算,' + worst.e.txt + ',明顯比整體差 → 先幫這群人換素材;換了還是差,再考慮在受眾設定排除。' }; tag = tagOf('bad', '有一格在漏錢'); }
    else if (best) { how = { k: 'good', t: '沒有哪一格花很多又特別差。<b>' + best.label + '</b> ' + best.e.txt + ' 是最好的一群,只花 ' + pct(best.share) + ' → 下一支素材可以專門做給這群人。' }; tag = tagOf('good', '分配正常'); }
    else { how = { k: 'good', t: '各年齡性別的成效差不多,預算分配沒有明顯問題,這一項不用動。' }; tag = tagOf('good', '分配正常'); }
    if (unk / tot >= 0.05) how.s = '另有 ' + pct(unk / tot * 100) + ' 的花費 Meta 分不出性別,沒畫在格子裡。';
    return card(title, tag, sub, body, how);
  }

  // ── ④ 國家、平台 × 裝置 ──────────────────────────────────
  var CN = { TW: '台灣', HK: '香港', JP: '日本', MO: '澳門', SG: '新加坡', MY: '馬來西亞', US: '美國', CN: '中國大陸', KR: '韓國', TH: '泰國', VN: '越南', PH: '菲律賓', ID: '印尼', AU: '澳洲', CA: '加拿大', GB: '英國' };
  var PF = { facebook: 'Facebook', instagram: 'Instagram', audience_network: '聯播網', messenger: 'Messenger', threads: 'Threads' };
  function devName(s) { s = String(s || ''); return /iphone|ipod/.test(s) ? 'iPhone' : /android_smartphone/.test(s) ? 'Android 手機' : /ipad|tablet/.test(s) ? '平板' : /desktop/.test(s) ? '電腦' : '其他'; }
  function tbl(c, list, tot, head) {
    var flagged = null, star = null;
    list.forEach(function (o) {
      o.e = eff(c, o.r); o.share = o.r.spend / tot * 100;
      if (o.share >= 10 && o.e.rel < 0.7 && (!flagged || o.share > flagged.share)) flagged = o;
      if (o.share >= 4 && o.e.n >= 3 && o.e.rel > 1.25 && (!star || o.e.rel > star.e.rel)) star = o;
    });
    var h = '<div class="in-scroll"><table class="in-tbl"><thead><tr><th>' + head + '</th><th>佔花費</th><th>' + (c.buy ? 'ROAS' : c.W.per + '成本') + '</th><th>千次曝光成本</th></tr></thead><tbody>'
      + list.map(function (o) {
        return '<tr class="' + (o === flagged ? 'flag' : o === star ? 'star' : '') + '"><td>' + esc(o.name) + '</td><td>' + pct(o.share) + '</td><td class="' + (o === flagged ? 'in-b' : o === star ? 'in-g' : '') + '">'
          + (c.buy ? o.e.v.toFixed(2) : (o.e.n ? F.money(o.e.v) : '0 ' + c.W.unit)) + '</td><td>' + (o.r.impressions ? F.money(o.r.spend / o.r.impressions * 1000) : '—') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
    return { html: h, flagged: flagged, star: star };
  }
  function cGeo(d, x) {
    var c = ctx(d), title = '④ 錢花在哪裡(國家、平台 × 裝置)', sub = '有海外客人或經銷的品牌,每個國家要各算各的;同一支廣告在 Instagram 手機和 Facebook 電腦上的成效也常差很多。';
    if (!x || !x.ok || (!x.country && !x.device)) return card(title, '', sub, wait('國家和裝置'), null);
    var parts = [], says = [], bad = false;
    if (x.country) {
      var ct = sum(x.country, function (r) { return r.spend; });
      var cl = x.country.filter(function (r) { return r.spend > 0; }).slice(0, 8).map(function (r) { return { name: CN[r.country] || r.country, r: r }; });
      if (cl.length) {
        var t1 = tbl(c, cl, ct, '國家');
        parts.push('<div><h4>國家</h4>' + t1.html + '</div>');
        if (cl.length === 1) says.push('廣告只投在' + cl[0].name + ',沒有跨國家的問題');
        else if (t1.flagged) { bad = true; says.push('<b>' + esc(t1.flagged.name) + '</b>佔 ' + pct(t1.flagged.share) + ' 花費、' + t1.flagged.e.txt + ',比整體差很多 → 這個國家要另外開一組廣告、用當地的素材和語言,不要跟其他國家混在一起跑'); }
        else if (t1.star) says.push('<b>' + esc(t1.star.name) + '</b> ' + t1.star.e.txt + ' 是最好的市場,只佔 ' + pct(t1.star.share) + ' 花費 → 可以多給');
        else says.push('各國家成效差不多');
      }
    } else parts.push('<div><h4>國家</h4><div class="in-wait">國家這一項 Meta 沒回資料' + (x.errors && x.errors.country ? '(' + esc(x.errors.country) + ')' : '') + '。</div></div>');
    if (x.device) {
      var mm = {};
      x.device.forEach(function (r) {
        var nm = (PF[r.platform] || r.platform) + ' · ' + devName(r.device), o = mm[nm] || (mm[nm] = { name: nm, r: { spend: 0, impressions: 0, clicks: 0, purchases: 0, revenue: 0, messages: 0, leads: 0 } });
        Object.keys(o.r).forEach(function (k2) { o.r[k2] += r[k2] || 0; });
      });
      var dl = Object.keys(mm).map(function (k2) { return mm[k2]; }).filter(function (o) { return o.r.spend > 0; }).sort(function (p, q) { return q.r.spend - p.r.spend; }).slice(0, 8);
      var dt = sum(dl, function (o) { return o.r.spend; });
      if (dl.length) {
        var t2 = tbl(c, dl, dt, '平台 · 裝置');
        parts.push('<div><h4>平台 × 裝置</h4>' + t2.html + '</div>');
        if (t2.flagged) { bad = true; says.push('<b>' + esc(t2.flagged.name) + '</b>佔 ' + pct(t2.flagged.share) + ' 花費、' + t2.flagged.e.txt + ',明顯拖累 → 檢查素材在這個版面的尺寸、還有這種裝置開官網順不順'); }
        else if (t2.star) says.push('<b>' + esc(t2.star.name) + '</b> ' + t2.star.e.txt + ' 最好');
        else says.push('各平台裝置成效差不多');
      }
    } else parts.push('<div><h4>平台 × 裝置</h4><div class="in-wait">裝置這一項 Meta 沒回資料(部分帳號要先在廣告管理員開啟這個分析項目)。</div></div>');
    var how = { k: bad ? 'bad' : 'good', t: says.join(';') + '。', s: '縣市的成交數 Meta 不提供(只給花費和點擊),縣市請看上面「' + (c.buy ? 'CPA' : c.W.conv + '成本') + '診斷」那一區。' };
    return card(title, tagOf(bad ? 'bad' : 'good', bad ? '有一塊在拖累' : '正常'), sub, '<div class="in-two">' + parts.join('') + '</div>', how);
  }

  // ── ⑤ 素材節奏與疲勞 ─────────────────────────────────────
  function spark(days) {
    var W = 220, H = 54, n = days.length; if (n < 2) return '';
    var mxC = Math.max.apply(null, days.map(function (z) { return z.ctr; }).concat([0.01])), mxF = Math.max.apply(null, days.map(function (z) { return z.freq; }).concat([1.01]));
    var line = function (f, mx, lo) { return days.map(function (z, i) { return (i ? 'L' : 'M') + (i / (n - 1) * (W - 4) + 2).toFixed(1) + ' ' + (H - 4 - (f(z) - lo) / ((mx - lo) || 1) * (H - 10)).toFixed(1); }).join(''); };
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none"><path d="' + line(function (z) { return z.ctr; }, mxC, 0) + '" fill="none" stroke="#6DFAC2" stroke-width="2"/><path d="' + line(function (z) { return z.freq; }, mxF, 1) + '" fill="none" stroke="#FA6D9B" stroke-width="2" stroke-dasharray="4 3"/></svg>';
  }
  function half(days, f) {   // 前半 vs 後半(用曝光加權)
    var h = Math.floor(days.length / 2), w = function (arr) { var s = 0, i = 0; arr.forEach(function (z) { s += f(z) * z.impressions; i += z.impressions; }); return i ? s / i : 0; };
    return [w(days.slice(0, h)), w(days.slice(h))];
  }
  function cCreative(d, x) {
    var c = ctx(d), ads = (d.ads || []).filter(function (a) { return a.spend > 0; });
    var title = '⑤ 素材夠不夠新(測試節奏與疲勞)', sub = '大品牌不是等素材爛掉才換,而是固定補新的:看現在幾支在跑、多久沒上新、哪幾支開始「越播越多次、越來越少人點」。';
    if (!ads.length) return card(title, '', sub, '<div class="in-wait">這段期間沒有在花錢的廣告。</div>', null);
    var tot = sum(ads, function (a) { return a.spend; }), aged = ads.filter(function (a) { return a.ageDays != null; });
    var newest = aged.length ? Math.min.apply(null, aged.map(function (a) { return a.ageDays; })) : null;
    var new7 = aged.filter(function (a) { return a.ageDays <= 7; }), old30 = aged.filter(function (a) { return a.ageDays >= 30; });
    var oldShare = sum(old30, function (a) { return a.spend; }) / tot * 100, top3 = sum(ads.slice().sort(function (p, q) { return q.spend - p.spend; }).slice(0, 3), function (a) { return a.spend; }) / tot * 100;
    var body = '<div class="in-kpis">'
      + kpi('在花錢的素材', ads.length + ' 支', '前 3 支吃掉 ' + pct(top3) + ' 花費', ads.length < 4 ? 'bad' : '')
      + kpi('最新一支上線', newest == null ? '讀不到' : newest === 0 ? '今天' : newest + ' 天前', '近 7 天上新 ' + new7.length + ' 支', newest != null && newest > 14 ? 'bad' : newest != null && newest <= 7 ? 'good' : '')
      + kpi('上線超過 30 天的', old30.length + ' 支', '吃掉 ' + pct(oldShare) + ' 花費', oldShare >= 70 ? 'bad' : '')
      + '</div>';
    //  每支 14 天走勢(要 Worker v2.9)
    var tired = [], cr = x && x.ok && x.creatives;
    if (cr && cr.ads && cr.ads.length) {
      body += '<div class="in-leg" style="margin-top:14px"><span>花費前 ' + Math.min(6, cr.ads.length) + ' 支,近 14 天每天:</span><span><i style="background:#6DFAC2"></i>點擊率</span><span><i style="background:#FA6D9B"></i>每人每天看到幾次(虛線)</span></div><div class="in-ads">'
        + cr.ads.slice(0, 6).map(function (a) {
          var ds = a.days.filter(function (z) { return z.impressions >= 200; });
          if (ds.length < 6) return '<div class="in-ad"><div class="nm">' + esc(a.name) + '</div><div class="tx">上線天數或曝光還不夠,先不判斷。</div></div>';
          var ct = half(ds, function (z) { return z.ctr; }), fq = half(ds, function (z) { return z.freq; });
          var dc = ct[0] ? (ct[1] / ct[0] - 1) * 100 : 0, df = fq[0] ? (fq[1] / fq[0] - 1) * 100 : 0, bad = dc <= -15 && df >= 5;
          if (bad) tired.push(a.name);
          return '<div class="in-ad' + (bad ? ' bad' : '') + '"><div class="nm">' + esc(a.name) + '</div>' + spark(ds)
            + '<div class="tx">點擊率 ' + pct(ct[0], 2) + ' → <span class="' + (dc <= -15 ? 'in-b' : dc >= 10 ? 'in-g' : '') + '">' + pct(ct[1], 2) + '</span>;每天看到 ' + fq[0].toFixed(2) + ' → ' + fq[1].toFixed(2) + ' 次'
            + (bad ? '<br><span class="in-b">越播越多次、越來越少人點 → 該換了</span>' : '') + '</div></div>';
        }).join('') + '</div>';
    } else body += '<div style="margin-top:12px">' + wait('每支素材近 14 天的走勢圖') + '</div>';
    //  2026-11-23 交代 0110:跟素材疲勞黃燈同一顆按鈕(monitor-fatigue.js 接 data-fatgo;疲乏度用「進行中廣告」那一欄)
    body += '<div style="margin-top:12px"><button type="button" class="fg-btn" data-fatgo="intl">看每支素材疲乏度 →</button></div>';
    var says = [], k = 'good', tag = tagOf('good', '節奏正常');
    if (ads.length < 4) { says.push('在花錢的素材只有 <b>' + ads.length + ' 支</b>,太少,系統沒得挑 → 至少補到 4–6 支不同角度的'); k = 'bad'; }
    if (newest != null && newest > 14) { says.push('已經 <b>' + newest + ' 天</b>沒上新素材 → 這週該補新的了'); k = 'bad'; }
    else if (newest != null && newest > 7 && k !== 'bad') { says.push('最新一支是 ' + newest + ' 天前上的,下週前要再補'); k = 'warn'; }
    if (oldShare >= 70 && ads.length >= 2) { says.push(pct(oldShare) + ' 的錢花在 30 天以上的老素材,新的沒接上來'); if (k === 'good') k = 'warn'; }
    if (tired.length) { says.push('<b>' + tired.length + ' 支</b>出現「越播越多次、越來越少人點」(框起來的),<b>優先換掉</b>'); k = 'bad'; }
    if (!says.length) says.push('素材數量夠、近期有上新、沒有明顯疲勞的,<b>這一項不用動</b>');
    if (k === 'bad') tag = tagOf('bad', '該換素材'); else if (k === 'warn') tag = tagOf('warn', '該準備新素材');
    return card(title, tag, sub, body, { k: k === 'warn' ? 'warn' : k, t: says.join(';') + '。', s: '「1–2 週補一次新素材」「同時 4 支以上」是代理商常見做法,不是 Meta 官方規定;只算得到現在開著的廣告,這期間開了又關掉的測試不在裡面。' });
  }

  // ── 畫 ─────────────────────────────────────────────────
  var BUILD = { profit: cProfit, attrib: cAttrib, demo: cDemo, geo: cGeo, creative: cCreative };
  var last = { d: null, x: null, key: '' };
  function draw() {
    var box = document.getElementById('mon-intl'), d = last.d; if (!box || !d || !d.totals) return;
    css();
    var ty = typeOf(d), T = TYPES[ty.key], x = last.x;
    var h = '<div class="mo-card"><div class="in-top">' + (d.demo ? '<span class="in-demo">示範資料</span>' : '') + '<span>客戶類型:</span>'
      + Object.keys(TYPES).map(function (k) { return '<button class="in-type' + (k === ty.key ? ' on' : '') + '" data-ty="' + k + '">' + TYPES[k].name + '</button>'; }).join('')
      + (ty.set ? '' : '<span class="in-dim">(還沒設,先照廣告目標猜)</span>')
      + '<div class="in-first">這類客戶:' + T.say + '</div></div></div>';
    T.order.forEach(function (k) {
      try { h += BUILD[k](d, x).replace('<div class="mo-card"', '<div class="mo-card" data-fd="intl-' + k + '"'); } catch (e) { /* data-fd = 折疊用的名字(monitor-fold.js) */ console.error('[intl] ' + k, e); h += '<div class="mo-card"><div class="in-wait">這一張卡畫不出來(' + esc(e && e.name) + '),其他不受影響。</div></div>'; }
    });
    h += '<div class="mo-note" style="border:0;margin:0;padding:0 2px">這一區只讀 Meta 的數字,不會改任何廣告、預算、受眾。還沒做的:增量測試結果、門市成交、每個商品的成效、蝦皮等其他平台(缺資料來源)。</div>';
    box.innerHTML = h;   // 這一區的字已經照品牌目標寫好,不再套 MON.T 換字(會把「成交不在線上」這種句子換壞)
  }
  function fetchX() {
    var d = last.d; if (!d || d.demo) return;
    var key = d.brand + '|' + (d.range ? d.range.since + '~' + d.range.until : '');
    if (last.key === key && last.x) return;
    last.key = key; last.x = null;
    M.intl().then(function (j) {
      if (last.key !== key) return;
      last.x = j && j.ok ? j : { ok: false };
      draw();
    });
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.in-type'); if (!b || !last.d) return;
    if (last.d.demo) { M.state.cfg['type_' + last.d.brand] = b.dataset.ty; draw(); return; }
    var p = {}; p['type_' + last.d.brand] = b.dataset.ty; M.setCfg(p);
  });
  document.addEventListener('change', function (e) {
    if (e.target.id !== 'inMargin' || !last.d) return;
    var v = parseFloat(e.target.value), p = {}; p['margin_' + last.d.brand] = v > 0 && v < 100 ? v : 0;
    if (last.d.demo) { M.state.cfg['margin_' + last.d.brand] = p['margin_' + last.d.brand]; draw(); return; }
    M.setCfg(p);
  });

  //  捲到附近才抓(跟 CPA 診斷同做法,不拖慢主畫面)
  var near = false;
  function watch() {
    var box = document.getElementById('mon-intl'); if (!box) return;
    if (!('IntersectionObserver' in window)) { near = true; fetchX(); return; }
    new IntersectionObserver(function (es) { es.forEach(function (en) { if (en.isIntersecting) { near = true; fetchX(); } }); }, { rootMargin: '700px' }).observe(box);
  }
  M.on('data', function (d) { if (DEMO) return; last.d = d; draw(); if (near) fetchX(); });

  // ── 示範資料(只給驗收截圖;全是假數字)────────────────────
  function demo(kind) {
    var msg = kind === 'msg', i, days = function (c0, c1, f0, f1) { var a = []; for (i = 0; i < 14; i++) { var p = i / 13; a.push({ date: '2026-11-' + ('0' + (8 + i)).slice(-2), spend: 900, impressions: 5200, reach: 4000, freq: f0 + (f1 - f0) * p + (i % 3) * 0.01, ctr: c0 + (c1 - c0) * p + ((i * 7) % 5 - 2) * 0.03 }); } return a; };
    var d = { demo: true, brand: msg ? 'demo_msg' : 'demo_buy', goal: msg ? 'message' : 'purchase', hasSmr: false, range: { since: '2026-11-15', until: '2026-11-21' },
      totals: msg ? { spend: 21400, reach: 96500, frequency: 1.9, purchases: 86, cpa: 249, roas: 0, revenue: 0 } : { spend: 48200, reach: 142000, frequency: 2.4, purchases: 212, revenue: 163900, roas: 3.4, cpa: 227 },
      attrib: { click: 141, view: 71, clickRev: 109800, viewRev: 54100 },
      segments: msg ? null : [{ key: 'new_customers', spend: 23100, purchases: 62, revenue: 44800, roas: 1.94 }, { key: 'engaged_customers', spend: 9800, purchases: 51, revenue: 40200, roas: 4.1 }, { key: 'existing_customers', spend: 6300, purchases: 58, revenue: 47600, roas: 7.56 }],
      ads: [{ name: '示範|開箱影片 A', spend: 15200, ageDays: 41 }, { name: '示範|節慶主視覺', spend: 11800, ageDays: 33 }, { name: '示範|使用情境輪播', spend: 9400, ageDays: 19 }, { name: '示範|老客見證', spend: 6900, ageDays: 52 }, { name: '示範|新品預告', spend: 4900, ageDays: 16 }] };
    var R = function (sp, imp, p, rev, m) { return { spend: sp, impressions: imp, reach: Math.round(imp * 0.6), clicks: Math.round(imp * 0.017), purchases: msg ? 0 : p, revenue: msg ? 0 : rev, messages: msg ? m : 0, leads: 0 }; };
    var x = { ok: true, demo: true, errors: {},
      demo: [['18-24', 'female', R(2100, 14000, 6, 4300, 9)], ['18-24', 'male', R(900, 6200, 2, 1500, 3)], ['25-34', 'female', R(9800, 52000, 58, 46100, 31)], ['25-34', 'male', R(3900, 21000, 14, 10200, 8)],
        ['35-44', 'female', R(8900, 41000, 61, 49800, 22)], ['35-44', 'male', R(4100, 20000, 19, 13900, 6)], ['45-54', 'female', R(11200, 47000, 24, 17300, 4)], ['45-54', 'male', R(2600, 12000, 12, 8900, 2)],
        ['55-64', 'female', R(3100, 13000, 11, 8200, 1)], ['55-64', 'male', R(1600, 7000, 5, 3700, 0)]].map(function (a) { return Object.assign({ age: a[0], gender: a[1] }, a[2]); }),
      country: [Object.assign({ country: 'TW' }, R(39600, 196000, 189, 148700, 80)), Object.assign({ country: 'HK' }, R(7100, 29000, 17, 11400, 5)), Object.assign({ country: 'JP' }, R(1500, 8000, 6, 3800, 1))],
      device: [Object.assign({ platform: 'instagram', device: 'iphone' }, R(19800, 92000, 104, 84200, 44)), Object.assign({ platform: 'facebook', device: 'android_smartphone' }, R(12400, 71000, 52, 38100, 21)),
        Object.assign({ platform: 'instagram', device: 'android_smartphone' }, R(7300, 36000, 33, 24900, 14)), Object.assign({ platform: 'facebook', device: 'iphone' }, R(4100, 19000, 18, 13600, 6)),
        Object.assign({ platform: 'facebook', device: 'desktop' }, R(3600, 9000, 4, 2600, 1)), Object.assign({ platform: 'audience_network', device: 'android_smartphone' }, R(1000, 6000, 1, 500, 0))],
      windows: { total: { spend: 48200, '1d_click': { purchases: 96, revenue: 75200, messages: 61, leads: 0 }, '7d_click': { purchases: 141, revenue: 109800, messages: 74, leads: 0 }, '1d_view': { purchases: 71, revenue: 54100, messages: 12, leads: 0 } },
        campaigns: [{ name: '示範|ASC 新客', spend: 23100, '7d_click': { purchases: 70, revenue: 55400, messages: 40 }, '1d_view': { purchases: 18, revenue: 13800, messages: 4 } },
          { name: '示範|CIBS 超額', spend: 15300, '7d_click': { purchases: 52, revenue: 40100, messages: 26 }, '1d_view': { purchases: 14, revenue: 10700, messages: 3 } },
          { name: '示範|再行銷', spend: 9800, '7d_click': { purchases: 19, revenue: 14300, messages: 8 }, '1d_view': { purchases: 39, revenue: 29600, messages: 5 } }] },
      creatives: { count: 5, ads: [{ name: '示範|開箱影片 A', spend: 15200, days: days(2.1, 1.35, 1.12, 1.31) }, { name: '示範|節慶主視覺', spend: 11800, days: days(1.7, 1.65, 1.1, 1.13) }, { name: '示範|使用情境輪播', spend: 9400, days: days(1.4, 1.75, 1.08, 1.1) },
        { name: '示範|老客見證', spend: 6900, days: days(1.9, 1.3, 1.15, 1.34) }, { name: '示範|新品預告', spend: 4900, days: days(1.6, 1.62, 1.05, 1.07) }] } };
    if (!msg && M.state.cfg['margin_demo_buy'] == null) M.state.cfg['margin_demo_buy'] = 45;
    if (kind === 'old') x = { ok: false };   // 模擬「正式後端還沒上 v2.9」:只剩現有資料算得出來的部分
    if (msg && !M.state.cfg['price_demo_msg']) { M.state.cfg['price_demo_msg'] = 12000; M.state.cfg['close_demo_msg'] = 4; }
    last.d = d; last.x = x; draw();
  }

  function boot() { if (DEMO) { demo(DEMO); return; } watch(); if (M.state.data) { last.d = M.state.data; draw(); } }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();

  window.MON_INTL = { version: 'monitor-intl v1.0', render: draw, demo: demo };
})();
