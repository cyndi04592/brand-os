/* ══════════════════════════════════════════════════════════════
   Brand OS · monitor-overview.js · v1.5(2026-11-13)v1.5 趨勢可切換指標(含影片 3 秒留住率)、購物漏斗加「頁面真的打開」;v1.4(2026-11-13)v1.4 主要目標是訊息 / 名單的品牌:六大數字、直客指標、漏斗、趨勢整套換成私訊(名單)版;v1.0(2026-11-11)
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
      ['曝光', t.impressions], ['點連結', t.linkClicks], ['頁面真的打開', t.landingViews || 0], ['看商品', t.viewContent],
      ['加購物車', t.addToCart], ['結帳', t.checkout], ['購買', t.purchases]
    ].filter(function (s, i) { return i < 2 || s[1] > 0 || i === 6; });
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
        '頁面真的打開': '點了廣告、卻沒等到網頁載完就走 → 網站太慢(圖太大、外掛太多),問題在網站不在廣告。',
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

  // ══ v1.4 訊息 / 名單版(Worker v2.1 已把 purchases / cpa 換成私訊數 / 一則成本)══
  function kpiBlockG(d, w) {
    var t = d.totals, p = d.previous;
    var rate = t.linkClicks ? t.purchases / t.linkClicks * 100 : 0, rateP = p.linkClicks ? p.purchases / p.linkClicks * 100 : 0;
    var items = [
      ['花費', F.money(t.spend), deltaHtml(t.spend, p.spend, true), ''],
      [w.conv + '數', F.num(t.purchases) + ' ' + w.unit, deltaHtml(t.purchases, p.purchases, true), ''],
      [w.cpaLong, t.purchases ? F.money(t.cpa) : '—', deltaHtml(t.cpa, p.cpa, false), '花費 ÷ ' + w.conv + '數,越低越好'],
      ['看到廣告', F.num(t.reach) + ' 人', deltaHtml(t.reach, p.reach, true), '觸及人數'],
      ['點進來', F.num(t.linkClicks) + ' 次', deltaHtml(t.linkClicks, p.linkClicks, true), '點擊率 ' + F.pct(t.ctr)],
      [w.rateLong, t.linkClicks ? F.pct(rate, 1) : '—', deltaHtml(rate, rateP, true), w.conv + '數 ÷ 點進來']
    ];
    return '<div class="mo-card"><div class="mo-h">這段期間成績 <small>' + esc(rangeText(d.range)) + ' · 主要目標:' + w.name + '</small></div>'
      + '<div class="mo-kpis">' + items.map(function (x) {
        return '<div class="mo-kpi"><div class="l">' + x[0] + '</div><div class="v">' + x[1] + '</div><div class="d">' + x[2] + '</div>'
          + (x[3] ? '<div class="s">' + x[3] + '</div>' : '') + '</div>';
      }).join('') + '</div>'
      + '<div class="mo-note"><b>怎麼看:</b>「上一期」= 往前推同樣天數。這個品牌的主要目標是「' + w.name + '」(後台設定),所以不看營收和 ROAS,看'
      + w.conv + '數和' + w.per + '多少錢。' + w.cpaLong + '漲了,往下看「' + w.cpa.replace('成本', '') + '為什麼變貴」。</div></div>';
  }
  function insiderBlockG(d, w) {
    var t = d.totals, p = d.previous, cfg = M.state.cfg, cards = [];
    var pr = parseFloat(cfg['price_' + d.brand]) || 0, cr = parseFloat(cfg['close_' + d.brand]) || 0, cap = M.cap(d);
    //  多花的錢換到幾則
    var dS = t.spend - p.spend, dC = t.purchases - p.purchases, mTxt, mTag, mExp;
    if (!p.spend || Math.abs(dS) < Math.max(1000, t.spend * 0.05)) {
      mTxt = '—'; mTag = '<span class="mo-tag warn">花費變化太小,算不準</span>'; mExp = '兩期花費差不到 5%,看不出加減預算的效果。';
    } else if (dS > 0) {
      var per1k = dC / dS * 1000, avg1k = t.spend ? t.purchases / t.spend * 1000 : 0;
      mTxt = (per1k >= 0 ? '多 ' : '少 ') + Math.abs(per1k).toFixed(1) + ' ' + w.unit;
      mTag = per1k >= avg1k * 0.7 ? '<span class="mo-tag good">加的錢有換到' + w.conv + '</span>' : (per1k > 0 ? '<span class="mo-tag warn">加的錢效率變差</span>' : '<span class="mo-tag bad">加的錢沒換到' + w.conv + '</span>');
      mExp = '每多花 1,000 元。這期比上期多花 ' + F.money(dS) + ',' + w.conv + (dC >= 0 ? '多了 ' + dC : '反而少了 ' + (-dC)) + ' ' + w.unit + '。';
    } else {
      mTxt = '少花 ' + F.money(-dS); mTag = dC >= 0 ? '<span class="mo-tag good">砍的是沒效率的錢</span>' : '<span class="mo-tag warn">' + w.conv + '也跟著少</span>';
      mExp = '這期比上期少花 ' + F.money(-dS) + ',' + w.conv + (dC >= 0 ? '反而多了 ' + dC : '少了 ' + (-dC)) + ' ' + w.unit + '。';
    }
    cards.push(['多花的錢換到幾' + w.unit, mTxt, mTag, mExp]);
    //  一則最多能花(= 購物版的損益兩平)
    var cTxt, cTag, cExp;
    if (cap) {
      cTxt = F.money(cap);
      cTag = !t.purchases ? '' : t.cpa <= cap * 0.6 ? '<span class="mo-tag good">還有空間加預算</span>' : t.cpa <= cap ? '<span class="mo-tag warn">接近上限</span>' : '<span class="mo-tag bad">' + w.per + '太貴,在虧</span>';
      cExp = '單價 ' + F.money(pr) + ' × 成交率 ' + cr + '%。目前' + w.per + ' ' + (t.purchases ? F.money(t.cpa) : '—') + '。';
    } else {
      cTxt = '—'; cTag = '<span class="mo-tag warn">右上角填單價和成交率</span>';
      cExp = '填了課程 / 服務單價和' + w.conv + '後的成交率,才算得出' + w.per + '最多能花多少才不虧。';
    }
    cards.push([w.per + '最多能花', cTxt, cTag, cExp]);
    //  千次曝光換到幾則
    var k = t.impressions ? t.purchases / t.impressions * 1000 : 0, kp = p.impressions ? p.purchases / p.impressions * 1000 : 0;
    cards.push(['每千次曝光換到', k.toFixed(2) + ' ' + w.unit, k ? deltaHtml(k, kp, true) : '', '每被看 1000 次換到幾' + w.unit + w.conv + '。CPM 漲(旺季搶量)它沒跟著漲,' + w.per + '就會變貴。CPM 成本 ' + F.money(t.cpm) + '。']);
    return { cards: cards, pr: pr, cr: cr };
  }
  function funnelBlockG(d, w) {
    var t = d.totals;
    var steps = [['看到廣告', t.reach], ['點進來', t.linkClicks], [w.conv, t.purchases]];
    var top = steps[0][1] || 1, worst = 1, worstRate = 2;
    for (var i = 1; i < steps.length; i++) { var r = steps[i - 1][1] ? steps[i][1] / steps[i - 1][1] : 0; if (i > 1 && r < worstRate) { worstRate = r; worst = i; } }
    var rows = steps.map(function (s, i) {
      var wd = Math.max(4, Math.sqrt(s[1] / top) * 100), drop = '<div class="mo-drop"></div>';
      if (i > 0) { var pv = steps[i - 1][1], keep = pv ? s[1] / pv * 100 : 0; drop = '<div class="mo-drop' + (i === worst ? ' worst' : '') + '">留下 ' + keep.toFixed(keep < 1 ? 2 : 1) + '%</div>'; }
      return '<div class="mo-step"><div class="n">' + s[0] + '</div><div class="mo-bar"><i style="width:' + wd.toFixed(1) + '%"></i><span>' + F.num(s[1]) + '</span></div>' + drop + '</div>';
    }).join('');
    rows += '<div class="mo-step"><div class="n">' + w.conv + '後成交</div><div class="mo-bar"><span class="mo-flat" style="color:var(--t3,#8a8aa0)">待接</span></div><div class="mo-drop">Meta 看不到</div></div>';
    var rate = t.linkClicks ? t.purchases / t.linkClicks * 100 : 0;
    var hint = w.key === 'message'
      ? '點進來會私訊的比例 ' + rate.toFixed(1) + '%。偏低時先看自動回覆、開場白、回覆速度,以及粉專上的課程資訊有沒有寫清楚。'
      : '點進來會留資料的比例 ' + rate.toFixed(1) + '%。偏低時先看表單欄位是不是太多、誘因夠不夠。';
    return '<div class="mo-card"><div class="mo-h">客人在哪一步跑掉 <small>看到 → 點進來 → ' + w.conv + '</small></div><div class="mo-funnel">' + rows + '</div>'
      + '<div class="mo-note"><b>怎麼看:</b>' + hint + '最後一關「' + w.conv + '後成交」Meta 拿不到,之後可以接 LINE 或手動回填。</div></div>';
  }
  function trendBlockG(d, w) {
    var today = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
    var days = (d.days || []).filter(function (x) { return x.date !== today; });
    if (!days.length) return '';
    var W_ = 760, H = 190, pl = 44, pr = 46, pt = 12, pb = 26, iw = W_ - pl - pr, ih = H - pt - pb, n = days.length, bw = iw / n;
    var maxS = Math.max.apply(null, days.map(function (x) { return x.spend; })) || 1;
    var costs = days.map(function (x) { return x.purchases ? x.spend / x.purchases : null; });
    var maxC = Math.max(1, Math.max.apply(null, costs.filter(function (c) { return c != null; }).concat([1])));
    var svg = '<svg viewBox="0 0 ' + W_ + ' ' + H + '" preserveAspectRatio="none">';
    days.forEach(function (x, i) {
      var wd = new Date(x.date + 'T00:00:00+08:00').getDay();
      if (wd === 0 || wd === 6) svg += '<rect x="' + (pl + i * bw) + '" y="' + pt + '" width="' + bw + '" height="' + ih + '" fill="rgba(109,250,194,0.06)"/>';
      var h = x.spend / maxS * ih;
      svg += '<rect x="' + (pl + i * bw + bw * 0.18) + '" y="' + (pt + ih - h) + '" width="' + (bw * 0.64) + '" height="' + h + '" rx="2" fill="rgba(124,109,250,0.55)"><title>'
        + x.date + '(' + F.weekday(x.date) + ')花費 ' + F.money(x.spend) + ' · ' + w.conv + ' ' + x.purchases + ' ' + w.unit + (x.purchases ? ' · ' + w.per + ' ' + F.money(x.spend / x.purchases) : '') + '</title></rect>';
      if (i % Math.ceil(n / 7) === 0 || i === n - 1) svg += '<text x="' + (pl + i * bw + bw / 2) + '" y="' + (H - 8) + '" font-size="10" fill="#8a8aa0" text-anchor="middle">' + x.date.slice(5) + '</text>';
    });
    var pts = [];
    costs.forEach(function (c, i) { if (c != null) pts.push((pl + i * bw + bw / 2).toFixed(1) + ',' + (pt + ih - c / maxC * ih).toFixed(1)); });
    if (pts.length > 1) svg += '<polyline points="' + pts.join(' ') + '" fill="none" stroke="#FA6D9B" stroke-width="2.2" stroke-linejoin="round"/>';
    svg += '<text x="' + (pl - 6) + '" y="' + (pt + 9) + '" font-size="10" fill="#8a8aa0" text-anchor="end">' + (maxS >= 1000 ? Math.round(maxS / 1000) + 'K' : Math.round(maxS)) + '</text>';
    svg += '<text x="' + (W_ - pr + 6) + '" y="' + (pt + 9) + '" font-size="10" fill="#FA6D9B">' + Math.round(maxC) + '</text></svg>';
    var we = { s: 0, p: 0 }, wk = { s: 0, p: 0 };
    days.forEach(function (x) { var wd = new Date(x.date + 'T00:00:00+08:00').getDay(), g = (wd === 0 || wd === 6 || wd === 5) ? we : wk; g.s += x.spend; g.p += x.purchases; });
    var line = '';
    if (we.p && wk.p) {
      var a = we.s / we.p, b = wk.s / wk.p;
      line = '<b>五六日' + w.per + ' ' + F.money(a) + ' / 平日 ' + F.money(b) + '(' + (a < b * 0.9 ? '五六日比較便宜' : b < a * 0.9 ? '平日比較便宜' : '週末平日差不多') + ')。</b>';
    }
    return '<div class="mo-card mo-trend"><div class="mo-h">近 28 天走勢 <small>不含今天(還沒跑完)· 滑鼠移到柱子看當天</small></div>' + svg
      + '<div class="mo-legend"><span><i style="background:rgba(124,109,250,0.55)"></i>每日花費</span><span><i style="background:#FA6D9B"></i>' + w.cpaLong + '(線往上 = 變貴)</span><span><i style="background:rgba(109,250,194,0.25)"></i>週末</span></div>'
      + '<div class="mo-note">' + line + ' 固定看 28 天,不跟著上面的日期變,才看得出週期。</div></div>';
  }
  function renderG(el, d, w) {
    //  直客指標:前 3 格換成訊息版,後面三格(花費集中度 / 月花費級距 / 頻率)跟購物版一樣,直接借購物版算好的
    var buy = insiderBlock(d), g = insiderBlockG(d, w);
    var tmp = document.createElement('div'); tmp.innerHTML = buy;
    var kp = tmp.querySelectorAll('.mo-kpi'), keep = '';
    for (var i = 4; i < kp.length; i++) keep += kp[i].outerHTML;
    var ins = '<div class="mo-card"><div class="mo-h">直客經理才會算的數字'
      + '<label class="mo-margin">單價 <input id="mo-price" type="number" min="1" step="1" value="' + (g.pr || '') + '" placeholder="NT$" style="width:76px"> 成交率 <input id="mo-close" type="number" min="0.1" max="100" step="0.1" value="' + (g.cr || '') + '" placeholder="%"> %</label></div>'
      + '<div class="mo-kpis">' + g.cards.map(function (x) {
        return '<div class="mo-kpi"><div class="l">' + x[0] + '</div><div class="v">' + x[1] + '</div><div class="d">' + x[2] + '</div><div class="s">' + x[3] + '</div></div>';
      }).join('') + keep + '</div>'
      + '<div class="mo-note"><b>為什麼重要:</b>Meta 後台只給你平均,這區算的是變化與底線。右上角填課程 / 服務單價和' + w.conv + '後的成交率(例:100 個' + w.conv + '有 8 個報名 = 8%),就算得出' + w.per + '最多能花多少,下面「進行中廣告」也會用它標出太貴的素材。</div></div>';
    el.innerHTML = kpiBlockG(d, w) + ins + funnelBlockG(d, w) + trendWrap(d, trendBlockG(d, w));
    bindTrend(d, function () { return trendBlockG(d, w); });
    ['price', 'close'].forEach(function (k) {
      var inp = document.getElementById('mo-' + k);
      if (inp) inp.addEventListener('change', function () { var v = parseFloat(inp.value), patch = {}; patch[k + '_' + d.brand] = v > 0 ? v : 0; M.setCfg(patch); });
    });
  }

  // ══ v1.5 趨勢可切換:柱子固定每天花費,線可以換 ══
  var trendKey = 'base';
  function trendOpts(d) {
    var w = M.W ? M.W(d) : null, g = !w || w.key === 'purchase';
    return [['base', g ? '花費 + ROAS' : '花費 + ' + w.cpaLong], ['purchases', g ? '購買數' : w.conv + '數']]
      .concat(g ? [['addToCart', '加購']] : [])
      .concat([['ctr', '點擊率 CTR'], ['cpm', 'CPM'], ['impressions', '曝光'], ['reach', '觸及'], ['hook', '影片 3 秒留住率']]);
  }
  function trendVal(x, k) {
    if (k === 'hook') return x.impressions ? (x.views3s || 0) / x.impressions * 100 : 0;
    return x[k] || 0;
  }
  function trendFmt(v, k) {
    return k === 'ctr' || k === 'hook' ? v.toFixed(2) + '%' : k === 'cpm' ? F.money(v) : F.num(v);
  }
  function trendGeneric(d, k, label) {
    var today = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
    var days = (d.days || []).filter(function (x) { return x.date !== today; });
    if (!days.length) return '';
    var W_ = 760, H = 190, pl = 44, pr = 46, pt = 12, pb = 26, iw = W_ - pl - pr, ih = H - pt - pb, n = days.length, bw = iw / n;
    var maxS = Math.max.apply(null, days.map(function (x) { return x.spend; })) || 1;
    var vals = days.map(function (x) { return trendVal(x, k); }), maxV = Math.max.apply(null, vals) || 1;
    var svg = '<svg viewBox="0 0 ' + W_ + ' ' + H + '" preserveAspectRatio="none">';
    days.forEach(function (x, i) {
      var wd = new Date(x.date + 'T00:00:00+08:00').getDay();
      if (wd === 0 || wd === 6) svg += '<rect x="' + (pl + i * bw) + '" y="' + pt + '" width="' + bw + '" height="' + ih + '" fill="rgba(109,250,194,0.06)"/>';
      var h = x.spend / maxS * ih;
      svg += '<rect x="' + (pl + i * bw + bw * 0.18) + '" y="' + (pt + ih - h) + '" width="' + (bw * 0.64) + '" height="' + h + '" rx="2" fill="rgba(124,109,250,0.55)"><title>'
        + x.date + '(' + F.weekday(x.date) + ')花費 ' + F.money(x.spend) + ' · ' + label + ' ' + trendFmt(vals[i], k) + '</title></rect>';
      if (i % Math.ceil(n / 7) === 0 || i === n - 1) svg += '<text x="' + (pl + i * bw + bw / 2) + '" y="' + (H - 8) + '" font-size="10" fill="#8a8aa0" text-anchor="middle">' + x.date.slice(5) + '</text>';
    });
    svg += '<polyline points="' + vals.map(function (v, i) { return (pl + i * bw + bw / 2).toFixed(1) + ',' + (pt + ih - v / maxV * ih).toFixed(1); }).join(' ') + '" fill="none" stroke="#FA6D9B" stroke-width="2.2" stroke-linejoin="round"/>';
    svg += '<text x="' + (pl - 6) + '" y="' + (pt + 9) + '" font-size="10" fill="#8a8aa0" text-anchor="end">' + (maxS >= 1000 ? Math.round(maxS / 1000) + 'K' : Math.round(maxS)) + '</text>';
    svg += '<text x="' + (W_ - pr + 6) + '" y="' + (pt + 9) + '" font-size="10" fill="#FA6D9B">' + trendFmt(maxV, k) + '</text></svg>';
    var tip = { ctr: '點擊率一路往下 = 素材疲乏,該換素材了。', cpm: 'CPM 一路往上 = 市場在搶量(檔期、旺季),不一定是你的廣告變差。',
      hook: '影片前 3 秒留住率往下 = 開頭看膩了,換開頭就好,不用整支重拍。沒有影片的日子是 0。', impressions: '曝光跟著花費走是正常的;花費沒變、曝光掉 = CPM 變貴。',
      reach: '觸及往下、頻率往上 = 一直打同一群人,受眾快用完了。' }[k] || '';
    return '<div class="mo-card mo-trend"><div class="mo-h">近 28 天走勢 <small>不含今天(還沒跑完)· 滑鼠移到柱子看當天</small></div>' + svg
      + '<div class="mo-legend"><span><i style="background:rgba(124,109,250,0.55)"></i>每日花費</span><span><i style="background:#FA6D9B"></i>' + label + '</span><span><i style="background:rgba(109,250,194,0.25)"></i>週末</span></div>'
      + '<div class="mo-note">' + tip + ' 固定看 28 天,不跟著上面的日期變,才看得出週期。</div></div>';
  }
  function trendWrap(d, baseHtml) {
    var opts = trendOpts(d);
    if (!opts.some(function (o) { return o[0] === trendKey; })) trendKey = 'base';
    var chips = '<div class="mo-tchips" style="display:flex;gap:6px;flex-wrap:wrap;margin:0 0 8px">' + opts.map(function (o) {
      return '<button data-tk="' + o[0] + '" style="padding:5px 12px;border-radius:999px;font-size:11px;cursor:pointer;font-family:inherit;'
        + (o[0] === trendKey ? 'border:0;background:linear-gradient(90deg,var(--gold,#7C6DFA),var(--pink,#FA6D9B));color:#fff' : 'border:1px solid rgba(255,255,255,0.12);background:transparent;color:var(--t2,#c8c8d8)') + '">' + o[1] + '</button>';
    }).join('') + '</div>';
    var lab = opts.filter(function (o) { return o[0] === trendKey; })[0][1];
    return '<div id="mo-trendbox">' + chips + (trendKey === 'base' ? baseHtml : trendGeneric(d, trendKey, lab)) + '</div>';
  }
  function bindTrend(d, baseFn) {
    var box = document.getElementById('mo-trendbox'); if (!box) return;
    box.onclick = function (e) {
      var b = e.target.closest('[data-tk]'); if (!b) return;
      trendKey = b.dataset.tk;
      box.outerHTML = trendWrap(d, baseFn());
      bindTrend(d, baseFn);
    };
  }

  // ── 畫 ──────────────────────────────────────────────────
  function mount() { return document.getElementById('mon-overview'); }
  function render(d) {
    var el = mount(); if (!el || !d) return;
    if (M.goal && M.goal(d) !== 'purchase') { renderG(el, d, M.W(d)); return; }
    el.innerHTML = kpiBlock(d) + insiderBlock(d) + funnelBlock(d) + trendWrap(d, trendBlock(d));
    bindTrend(d, function () { return trendBlock(d); });
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

  window.MON_OVERVIEW = { version: 'monitor-overview v1.5', render: render };
})();
