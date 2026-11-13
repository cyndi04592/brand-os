/* ══════════════════════════════════════════════════════════════
   Brand OS · monitor-overview.js · v1.0(2026-11-11)
   新版廣告監控頁「總覽」區塊。資料一律跟 monitor-data.js(window.MON)拿。

   這區不是照抄 Meta 後台——是把直客經理開會才會算給你看的數字算出來:
   ① 六大數字 + 跟上一期比漲跌
   ② 直客內部指標(加減乘除算出來的):
      · 邊際 ROAS   多花的那筆錢,帶回多少營收(判斷「加預算還划不划算」)
      · 損益兩平 ROAS 依毛利率算出「至少要幾倍才不虧」
      · 客單價 / 千次曝光營收 / 花費集中度 / 頻率飽和 / 月花費級距(芮比參考尺)
   ③ 轉換漏斗:每一關剩多少人、掉了幾 %,最大漏洞自動標紅
   ④ 近 28 天趨勢(花費柱 + ROAS 線,週末底色標出來)
   每一塊下面都有一行白話說明(學 SMR 的寫法)。

   掛載點:<div id="mon-overview"></div>
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (!window.MON) { console.error('[overview] 要先載 monitor-data.js'); return; }
  var M = window.MON, F = M.fmt;

  // ── 樣式(只管這一區)────────────────────────────────────
  var CSS = ''
    + '#mon-overview{display:flex;flex-direction:column;gap:14px}'
    + '.mo-card{background:rgba(255,255,255,0.035);border:1px solid var(--line,rgba(255,255,255,0.08));border-radius:14px;padding:16px 18px}'
    + '.mo-h{font-size:13px;font-weight:800;color:var(--t1,#fff);margin:0 0 10px;display:flex;align-items:center;gap:8px}'
    + '.mo-h small{font-weight:500;color:var(--t3,#888);font-size:10.5px}'
    + '.mo-note{margin-top:10px;font-size:10.5px;line-height:1.75;color:var(--t3,#8a8aa0);border-top:1px dashed var(--line,rgba(255,255,255,0.08));padding-top:9px}'
    + '.mo-note b{color:var(--t2,#c8c8d8)}'
    + '.mo-kpis{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px}'
    + '.mo-kpi{background:rgba(255,255,255,0.03);border-radius:11px;padding:12px 13px}'
    + '.mo-kpi .l{font-size:10.5px;color:var(--t3,#8a8aa0)}'
    + '.mo-kpi .v{font-size:19px;font-weight:800;color:var(--t1,#fff);margin:3px 0 2px;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;letter-spacing:-0.3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
    + '.mo-kpi .d{font-size:10.5px;font-weight:700}'
    + '.mo-up{color:var(--mint,#6DFAC2)}.mo-down{color:var(--pink,#FA6D9B)}.mo-flat{color:var(--t3,#8a8aa0)}'
    + '.mo-kpi .s{font-size:10px;color:var(--t3,#8a8aa0);margin-top:4px;line-height:1.5}'
    + '.mo-tag{display:inline-block;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:700}'
    + '.mo-tag.good{background:rgba(109,250,194,0.14);color:var(--mint,#6DFAC2)}'
    + '.mo-tag.warn{background:rgba(124,109,250,0.16);color:var(--gold,#7C6DFA)}'
    + '.mo-tag.bad{background:rgba(250,109,155,0.15);color:var(--pink,#FA6D9B)}'
    + '.mo-funnel{display:flex;flex-direction:column;gap:6px}'
    + '.mo-step{display:grid;grid-template-columns:92px 1fr 110px;align-items:center;gap:10px;font-size:11px}'
    + '.mo-step .n{color:var(--t2,#c8c8d8)}'
    + '.mo-bar{height:22px;border-radius:6px;background:rgba(255,255,255,0.04);position:relative;overflow:hidden}'
    + '.mo-bar i{position:absolute;left:0;top:0;bottom:0;border-radius:6px;background:linear-gradient(90deg,var(--gold,#7C6DFA),var(--pink,#FA6D9B))}'
    + '.mo-bar span{position:relative;z-index:1;padding-left:8px;line-height:22px;font-weight:700;color:#fff;font-size:11px}'
    + '.mo-drop{font-size:10.5px;text-align:right;color:var(--t3,#8a8aa0)}'
    + '.mo-drop.worst{color:var(--pink,#FA6D9B);font-weight:800}'
    + '.mo-trend svg{width:100%;height:190px;display:block}'
    + '.mo-legend{display:flex;gap:14px;font-size:10.5px;color:var(--t3,#8a8aa0);margin-top:6px;flex-wrap:wrap}'
    + '.mo-legend i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:5px;vertical-align:-1px}'
    + '.mo-margin{display:inline-flex;align-items:center;gap:6px;font-size:10.5px;color:var(--t3,#8a8aa0);margin-left:auto}'
    + '.mo-margin input{width:54px;padding:3px 6px;border-radius:6px;border:1px solid var(--line,rgba(255,255,255,0.15));background:rgba(0,0,0,0.25);color:#fff;font-size:11px}'
    + '.mo-skel{height:90px;border-radius:12px;background:linear-gradient(90deg,rgba(255,255,255,0.03),rgba(255,255,255,0.07),rgba(255,255,255,0.03));background-size:200% 100%;animation:moSk 1.2s infinite}'
    + '@keyframes moSk{0%{background-position:200% 0}100%{background-position:-200% 0}}'
    + '@media(max-width:560px){.mo-step{grid-template-columns:70px 1fr 86px}.mo-kpi .v{font-size:17px}}';
  function injectCss() {
    if (document.getElementById('mo-css')) return;
    var s = document.createElement('style'); s.id = 'mo-css'; s.textContent = CSS;
    document.head.appendChild(s);
  }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function deltaHtml(cur, prev, goodWhenUp) {
    var d = F.delta(cur, prev);
    var cls = d.dir === 'flat' ? 'mo-flat' : ((d.dir === 'up') === (goodWhenUp !== false) ? 'mo-up' : 'mo-down');
    return '<span class="' + cls + '">' + d.text + '</span> <span class="mo-flat">vs 上一期</span>';
  }
  function rangeText(r) {
    if (!r) return '';
    return r.since === r.until ? r.since : (r.since + ' ~ ' + r.until + '(' + r.days + ' 天)');
  }

  // ── ① 六大數字 ──────────────────────────────────────────
  function kpiBlock(d) {
    var t = d.totals, p = d.previous;
    var items = [
      ['花費', F.money(t.spend), deltaHtml(t.spend, p.spend, true), ''],
      ['營收(Meta 回報)', F.money(t.revenue), deltaHtml(t.revenue, p.revenue, true), ''],
      ['ROAS', F.x(t.roas), deltaHtml(t.roas, p.roas, true), '每花 1 元帶回 ' + (t.roas || 0).toFixed(2) + ' 元'],
      ['購買數', F.num(t.purchases), deltaHtml(t.purchases, p.purchases, true), ''],
      ['CPA 單次購買成本', t.purchases ? F.money(t.cpa) : '—', deltaHtml(t.cpa, p.cpa, false), '越低越好'],
      ['點擊率 CTR', F.pct(t.ctr), deltaHtml(t.ctr, p.ctr, true), '連結點擊 ÷ 曝光']
    ];
    return '<div class="mo-card"><div class="mo-h">這段期間成績 <small>' + esc(rangeText(d.range)) + '</small></div>'
      + '<div class="mo-kpis">' + items.map(function (x) {
        return '<div class="mo-kpi"><div class="l">' + x[0] + '</div><div class="v">' + x[1] + '</div><div class="d">' + x[2] + '</div>'
          + (x[3] ? '<div class="s">' + x[3] + '</div>' : '') + '</div>';
      }).join('') + '</div>'
      + '<div class="mo-note"><b>怎麼看:</b>「上一期」= 往前推同樣天數(看 7 天就比再前 7 天)。花費漲、ROAS 也漲 = 加預算有效;花費漲、ROAS 跌 = 錢花出去但效率變差,要看下面的「邊際 ROAS」。營收是 Meta 像素回報的,實際入帳請以 SMR / 後台訂單為準。</div></div>';
  }

  // ── ② 直客內部指標 ──────────────────────────────────────
  function insiderBlock(d) {
    var t = d.totals, p = d.previous, cfg = M.state.cfg;
    var cards = [];

    //  邊際 ROAS:(這期營收 − 上期營收) ÷ (這期花費 − 上期花費)
    var dS = t.spend - p.spend, dR = t.revenue - p.revenue, mTxt, mTag, mExp;
    if (!p.spend || Math.abs(dS) < Math.max(1000, t.spend * 0.05)) {
      mTxt = '—'; mTag = '<span class="mo-tag warn">花費變化太小,算不準</span>';
      mExp = '兩期花費差不到 5%,看不出加減預算的效果。';
    } else if (dS > 0) {
      var mr = dR / dS;
      mTxt = F.x(mr);
      mTag = mr >= Math.max(1, t.roas * 0.7) ? '<span class="mo-tag good">加的錢有回來</span>' : (mr >= 1 ? '<span class="mo-tag warn">加的錢回收變差</span>' : '<span class="mo-tag bad">加的錢沒回來</span>');
      mExp = '這期比上期多花 ' + F.money(dS) + ',營收' + (dR >= 0 ? '多了 ' + F.money(dR) : '反而少了 ' + F.money(-dR)) + '。';
    } else {
      var saved = -dS, lost = -dR, mr2 = saved ? lost / saved : 0;
      mTxt = F.x(mr2);
      mTag = mr2 <= t.roas ? '<span class="mo-tag good">砍的是沒效率的錢</span>' : '<span class="mo-tag bad">砍到會賺錢的預算</span>';
      mExp = '這期比上期少花 ' + F.money(saved) + ',營收' + (lost >= 0 ? '少了 ' + F.money(lost) : '反而多了 ' + F.money(-lost)) + '。';
    }
    cards.push(['邊際 ROAS', mTxt, mTag, mExp]);

    //  損益兩平 ROAS = 1 ÷ 毛利率
    var mg = parseFloat(cfg['margin_' + d.brand]) || 0, beTxt, beTag, beExp;   // 毛利率每個品牌分開記
    if (mg > 0 && mg < 100) {
      var be = 100 / mg;
      beTxt = F.x(be);
      beTag = t.roas >= be * 1.2 ? '<span class="mo-tag good">有賺</span>' : (t.roas >= be ? '<span class="mo-tag warn">打平邊緣</span>' : '<span class="mo-tag bad">賣越多虧越多</span>');
      beExp = '毛利 ' + mg + '% → ROAS 至少要 ' + be.toFixed(2) + ' 才不虧廣告費。目前 ' + (t.roas || 0).toFixed(2) + '。';
    } else {
      beTxt = '—'; beTag = '<span class="mo-tag warn">右上角填毛利率</span>';
      beExp = '填了毛利率,才算得出「最低要幾倍才不虧」。';
    }
    cards.push(['損益兩平 ROAS', beTxt, beTag, beExp]);

    //  客單價 AOV
    var aov = t.purchases ? t.revenue / t.purchases : 0, aovP = p.purchases ? p.revenue / p.purchases : 0;
    cards.push(['客單價', aov ? F.money(aov) : '—', aov ? deltaHtml(aov, aovP, true) : '', '營收 ÷ 購買數。ROAS 掉但客單價也掉 = 客人買得少,不一定是廣告變差,可推組合價。']);

    //  千次曝光營收(RPM)vs CPM
    var rpm = t.impressions ? t.revenue / t.impressions * 1000 : 0;
    cards.push(['千次曝光營收', F.money(rpm), '<span class="mo-flat">CPM 成本 ' + F.money(t.cpm) + '</span>',
      '每被看 1000 次帶回多少錢。它比 CPM 高多少倍,就是 ROAS;CPM 漲(旺季搶量)它沒跟著漲,ROAS 就會掉。']);

    //  花費集中度:前 3 則廣告吃掉多少
    var ads = d.ads || [], tot = ads.reduce(function (s, a) { return s + a.spend; }, 0);
    var top3 = ads.slice(0, 3).reduce(function (s, a) { return s + a.spend; }, 0), share = tot ? top3 / tot * 100 : 0;
    cards.push(['花費集中度', tot ? F.pct(share, 0) : '—',
      !tot ? '' : (share >= 70 ? '<span class="mo-tag bad">太集中,風險高</span>' : share >= 45 ? '<span class="mo-tag warn">偏集中</span>' : '<span class="mo-tag good">分散健康</span>'),
      '前 3 則廣告吃掉總花費的比例。超過 7 成 = 那幾支一疲乏整個帳號就掉,要準備接棒素材。']);

    //  月花費級距 —— 依台灣行銷業界公開資料整理(代操接案門檻、自聘投手門檻、加碼型電商上限),
    //  排除灰色產業 / 金融貸款 / 博弈這類高預算特殊行業。Meta 不公開花費分佈,這不是官方排名。
    //  改級距:只要改下面 TIERS 的金額與說明
    var TIERS = [
      { max: 30000,    name: '起步',   tag: 'warn', who: '自己試水溫,每天不到 1,000 元,系統很難學出效果;代操公司通常不接' },
      { max: 100000,   name: '小型',   tag: 'warn', who: '個人投手、小團隊接案的起點;業界普遍說「一個月 3 萬起跳」' },
      { max: 500000,   name: '中型',   tag: 'good', who: '數位代理商的主力客群(月 10 萬以上才接),開始需要完整漏斗與素材輪替' },
      { max: 1500000,  name: '中大型', tag: 'good', who: '月 50 萬以上,品牌通常會自聘投手或固定專人;代操抽成可談到 15% 以下' },
      { max: Infinity, name: '大型',   tag: 'good', who: '成效好、持續加碼的電商品牌上限區(百萬級),或 4A 綜合代理商的客戶' }
    ];
    var days = (d.range && d.range.days) || 7, monthly = t.spend / days * 30;
    var ti = 0; while (ti < TIERS.length - 1 && monthly >= TIERS[ti].max) ti++;
    var tier = TIERS[ti];
    var bar = TIERS.map(function (x, i) {
      return '<span style="flex:1;height:6px;border-radius:3px;background:' + (i === ti ? 'var(--pink,#FA6D9B)' : i < ti ? 'rgba(124,109,250,0.55)' : 'rgba(255,255,255,0.08)') + '"></span>';
    }).join('');
    var fmtW = function (v) { return v >= 10000 ? (v / 10000) + ' 萬' : v; };
    var range = ti === 0 ? '月 3 萬以下' : (TIERS[ti].max === Infinity ? '月 ' + fmtW(TIERS[ti - 1].max) + '以上' : '月 ' + fmtW(TIERS[ti - 1].max) + '~' + fmtW(TIERS[ti].max));
    cards.push(['月花費級距', tier.name,
      '<span class="mo-tag ' + tier.tag + '">' + range + '</span><div style="display:flex;gap:3px;margin-top:6px">' + bar + '</div>',
      '每月約 ' + F.money(Math.round(monthly / 1000) * 1000) + '(這段期間每天平均 × 30)。' + tier.who + '。'
      + '<br>級距:起步 <3 萬 / 小型 3~10 萬 / 中型 10~50 萬 / 中大型 50~150 萬 / 大型 150 萬以上(台灣業界接案與投放門檻整理,不含灰產、金融貸款、博弈;不是 Meta 官方排名)。']);

    //  頻率飽和
    var fq = t.frequency || 0, fw = cfg.freqWarn || 3.5;
    cards.push(['平均頻率', fq.toFixed(2) + ' 次',
      fq >= fw ? '<span class="mo-tag bad">同一群人看太多次</span>' : fq >= fw * 0.75 ? '<span class="mo-tag warn">快飽和</span>' : '<span class="mo-tag good">還有新客可觸及</span>',
      '每個人平均看到幾次 = 曝光 ÷ 觸及人數。超過 ' + fw + ' 次,點擊率通常開始往下掉(疲乏)。']);

    return '<div class="mo-card"><div class="mo-h">直客經理才會算的數字'
      + '<label class="mo-margin">毛利率 <input id="mo-margin" type="number" min="1" max="99" step="1" value="' + (mg || '') + '" placeholder="%"> %</label></div>'
      + '<div class="mo-kpis">' + cards.map(function (x) {
        return '<div class="mo-kpi"><div class="l">' + x[0] + '</div><div class="v">' + x[1] + '</div><div class="d">' + x[2] + '</div><div class="s">' + x[3] + '</div></div>';
      }).join('') + '</div>'
      + '<div class="mo-note"><b>為什麼重要:</b>Meta 後台只給你「平均」,這區算的是「變化」與「底線」。尤其<b>邊際 ROAS</b>:平均 ROAS 3 倍,不代表多加的那筆預算也有 3 倍——旺季加預算前先看這格。</div></div>';
  }

  // ── ③ 轉換漏斗 ──────────────────────────────────────────
  function funnelBlock(d) {
    var t = d.totals;
    var steps = [
      ['曝光', t.impressions], ['點連結', t.linkClicks], ['看商品', t.viewContent],
      ['加購物車', t.addToCart], ['結帳', t.checkout], ['購買', t.purchases]
    ].filter(function (s, i) { return i < 2 || s[1] > 0 || i === 5; });
    var top = steps[0][1] || 1, worst = -1, worstRate = 2;
    for (var i = 2; i < steps.length; i++) {           // 從「點連結→看商品」開始找最大漏洞
      var r = steps[i - 1][1] ? steps[i][1] / steps[i - 1][1] : 0;
      if (steps[i - 1][1] && r <= 1 && r < worstRate) { worstRate = r; worst = i; }
    }
    var rows = steps.map(function (s, i) {
      var w = Math.max(4, Math.sqrt(s[1] / top) * 100);   // 用開根號,不然後面幾關細到看不見
      var drop = '';
      if (i > 0) {
        var prev = steps[i - 1][1], keep = prev ? s[1] / prev * 100 : 0;
        drop = keep > 100
          ? '<div class="mo-drop">每人看 ' + (keep / 100).toFixed(1) + ' 頁</div>'      // 像素每看一頁算一次,會比點擊多
          : '<div class="mo-drop' + (i === worst ? ' worst' : '') + '">留下 ' + keep.toFixed(keep < 1 ? 2 : 1) + '%' + (i === worst ? ' ' : '') + '</div>';
      } else drop = '<div class="mo-drop"></div>';
      return '<div class="mo-step"><div class="n">' + s[0] + '</div><div class="mo-bar"><i style="width:' + w.toFixed(1) + '%"></i><span>' + F.num(s[1]) + '</span></div>' + drop + '</div>';
    }).join('');
    var tip = '';
    if (worst > 0) {
      var a = steps[worst - 1][0], b = steps[worst][0];
      var hint = {
        '看商品': '點了卻沒看到商品頁 → 網頁太慢或落地頁跟廣告講的不一樣。',
        '加購物車': '看了不加購 → 價格、規格說明、評價或主圖說服力不夠。',
        '結帳': '加了不結帳 → 運費門檻、優惠碼欄位、要註冊會員都是常見原因。',
        '購買': '結帳沒完成 → 付款方式少、表單太長、或付款頁出錯。'
      }[b] || '';
      tip = '<b>最大漏洞:</b>「' + a + ' → ' + b + '」只留下 ' + (worstRate * 100).toFixed(1) + '%。' + hint;
    }
    return '<div class="mo-card"><div class="mo-h">客人在哪一步跑掉 <small>以人次計</small></div><div class="mo-funnel">' + rows + '</div>'
      + '<div class="mo-note">' + (tip || '<b>怎麼看:</b>每一列是上一關「留下來的比例」,紅字是掉最多的那一關。') + ' 漏斗後段(加購 → 購買)的問題通常在網站,不在廣告。</div></div>';
  }

  // ── ④ 近 28 天趨勢(手畫 SVG,不用載圖表套件)────────────
  function trendBlock(d) {
    var today = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
    var days = (d.days || []).filter(function (x) { return x.date !== today; });   // 今天還沒跑完,不畫(會把線拉歪)
    if (!days.length) return '';
    var W = 760, H = 190, pl = 44, pr = 40, pt = 12, pb = 26;
    var iw = W - pl - pr, ih = H - pt - pb, n = days.length, bw = iw / n;
    var maxS = Math.max.apply(null, days.map(function (x) { return x.spend; })) || 1;
    var maxR = Math.max(1, Math.max.apply(null, days.map(function (x) { return x.roas; })));
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">';
    days.forEach(function (x, i) {
      var wd = new Date(x.date + 'T00:00:00+08:00').getDay();
      if (wd === 0 || wd === 6) svg += '<rect x="' + (pl + i * bw) + '" y="' + pt + '" width="' + bw + '" height="' + ih + '" fill="rgba(109,250,194,0.06)"/>';
      var h = x.spend / maxS * ih;
      svg += '<rect x="' + (pl + i * bw + bw * 0.18) + '" y="' + (pt + ih - h) + '" width="' + (bw * 0.64) + '" height="' + h + '" rx="2" fill="rgba(124,109,250,0.55)"><title>'
        + x.date + '(' + F.weekday(x.date) + ')花費 ' + F.money(x.spend) + ' · ROAS ' + x.roas.toFixed(2) + ' · 購買 ' + x.purchases + '</title></rect>';
      if (i % Math.ceil(n / 7) === 0 || i === n - 1) svg += '<text x="' + (pl + i * bw + bw / 2) + '" y="' + (H - 8) + '" font-size="10" fill="#8a8aa0" text-anchor="middle">' + x.date.slice(5) + '</text>';
    });
    var pts = days.map(function (x, i) { return (pl + i * bw + bw / 2).toFixed(1) + ',' + (pt + ih - x.roas / maxR * ih).toFixed(1); }).join(' ');
    svg += '<polyline points="' + pts + '" fill="none" stroke="#FA6D9B" stroke-width="2.2" stroke-linejoin="round"/>';
    svg += '<text x="' + (pl - 6) + '" y="' + (pt + 9) + '" font-size="10" fill="#8a8aa0" text-anchor="end">' + (maxS >= 1000 ? Math.round(maxS / 1000) + 'K' : Math.round(maxS)) + '</text>';
    svg += '<text x="' + (W - pr + 6) + '" y="' + (pt + 9) + '" font-size="10" fill="#FA6D9B">' + maxR.toFixed(1) + 'x</text>';
    svg += '</svg>';

    //  週末 vs 平日(給預算排程用)
    var we = { s: 0, r: 0, p: 0 }, wk = { s: 0, r: 0, p: 0 };
    days.forEach(function (x) {
      var wd = new Date(x.date + 'T00:00:00+08:00').getDay(), g = (wd === 0 || wd === 6 || wd === 5) ? we : wk;
      g.s += x.spend; g.r += x.revenue; g.p += x.purchases;
    });
    var weR = we.s ? we.r / we.s : 0, wkR = wk.s ? wk.r / wk.s : 0, line = '';
    if (we.s && wk.s) {
      var better = weR > wkR * 1.1 ? '五六日比較好賣' : wkR > weR * 1.1 ? '平日比較好賣' : '週末平日差不多';
      line = '<b>五六日 ROAS ' + weR.toFixed(2) + ' / 平日 ' + wkR.toFixed(2) + '(' + better + ')。</b>'
        + (weR > wkR * 1.1 ? '可以用 ASC「預算排程」把五~日預算加高、平日降低(一週總額不變),Meta 簡報建議測 2~4 週。' : '');
    }
    return '<div class="mo-card mo-trend"><div class="mo-h">近 28 天走勢 <small>不含今天(還沒跑完)· 滑鼠移到柱子看當天</small></div>' + svg
      + '<div class="mo-legend"><span><i style="background:rgba(124,109,250,0.55)"></i>每日花費</span><span><i style="background:#FA6D9B"></i>ROAS</span><span><i style="background:rgba(109,250,194,0.25)"></i>週末</span></div>'
      + '<div class="mo-note">' + (line || '') + ' 固定看 28 天,不跟著上面的日期變,才看得出週期。</div></div>';
  }

  // ── 畫 ──────────────────────────────────────────────────
  function mount() { return document.getElementById('mon-overview'); }
  function render(d) {
    var el = mount(); if (!el || !d) return;
    el.innerHTML = kpiBlock(d) + insiderBlock(d) + funnelBlock(d) + trendBlock(d);
    var inp = document.getElementById('mo-margin');
    if (inp) inp.addEventListener('change', function () {
      var v = parseFloat(inp.value), patch = {};
      patch['margin_' + d.brand] = v > 0 && v < 100 ? v : 0;
      M.setCfg(patch);
    });
  }
  function skeleton() {
    var el = mount(); if (!el) return;
    el.innerHTML = '<div class="mo-skel"></div><div class="mo-skel"></div><div class="mo-skel" style="height:160px"></div>';
  }

  injectCss();
  M.on('loading', skeleton);
  M.on('data', render);
  if (M.state.data) render(M.state.data);

  window.MON_OVERVIEW = { version: 'monitor-overview v1.3', render: render };
})();
