/* ══════════════════════════════════════════════════════════════
   Brand OS · monitor-asc.js · v1.4(2026-11-13)v1.4 加「ASC 的錢花在誰身上」(新客 / 舊客,Meta 依帳號的現有顧客設定分);v1.3(2026-11-13)v1.3 訊息 / 名單品牌:只留「今天的行銷活動」和「學習期」(換字),素材與版位(看 ROAS)不出;v1.2(2026-11-13)
   v1.2:重讀整份簡報 —— 兩個數字都對、講的是不同東西:一般 ASC「不少於 20 則」(彈性廣告那段,給系統挑);
        CIBS 測試「新素材 10 則左右、越多元越好」(CIBS 那段)。v1.1 把兩個混成 10,改回分開判斷。
   新版廣告監控頁「ASC / CIBS 策略」區塊。資料一律跟 window.MON 拿。
   規則全部照 Meta 台灣香港電商團隊「ASC 高效推廣 - 測試進階策略」簡報:

   ① 今天各行銷活動:花了日預算幾 %、跑得太快還太慢、預算是 CPA 的幾倍
      · CIBS 花不出去 = 官方說的正常行為(under-delivery 是設計),標「待命中」不標警告
      · 日預算 ≥ CPA × 10 才跑得完學習期;CIBS 建議 CPA × 20~50
      · 花滿了而且 CPA 還在目標內 = 「預算卡住」,這就是 CIBS 要解的問題
   ② 學習期:每個廣告組合一週要 50 次轉換,差幾次一起算
   ③ 素材:一般 ASC 不少於 20 則;CIBS 新素材 10 則左右、越多元越好;新素材有沒有分到錢(沒分到 → 先預熱)
   ④ 9:16 直式版位 + 影片/圖片 花費佔比與 ROAS

   掛載點:<div id="mon-asc"></div>
   共用 monitor-overview.js 的 .mo-card / .mo-h / .mo-note / .mo-tag 樣式
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (!window.MON) { console.error('[asc] 要先載 monitor-data.js'); return; }
  var M = window.MON, F = M.fmt;

  var CSS = ''
    + '#mon-asc{display:flex;flex-direction:column;gap:14px}'
    + '.ma-tbl{width:100%;border-collapse:collapse;font-size:11px}'
    + '.ma-tbl th{text-align:left;font-weight:600;color:var(--t3,#8a8aa0);padding:6px 8px;border-bottom:1px solid var(--line,rgba(255,255,255,0.08));white-space:nowrap}'
    + '.ma-tbl td{padding:8px;border-bottom:1px solid rgba(255,255,255,0.04);color:var(--t2,#c8c8d8);vertical-align:middle}'
    + '.ma-tbl td.num{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}'
    + '.ma-grp td{background:rgba(124,109,250,0.07);color:var(--t1,#fff);font-weight:800;font-size:11.5px}'
    + '.ma-name{max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
    + '.ma-pace{position:relative;height:14px;min-width:120px;border-radius:7px;background:rgba(255,255,255,0.05);overflow:hidden}'
    + '.ma-pace i{position:absolute;left:0;top:0;bottom:0;border-radius:7px;background:var(--gold,#7C6DFA)}'
    + '.ma-pace i.hot{background:var(--pink,#FA6D9B)}.ma-pace i.full{background:var(--mint,#6DFAC2)}'
    + '.ma-pace b{position:absolute;top:-2px;bottom:-2px;width:2px;background:#fff;opacity:.7}'
    + '.ma-pace span{position:relative;z-index:1;font-size:9.5px;line-height:14px;padding-left:6px;color:#fff;font-weight:700}'
    + '.ma-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}'
    + '.ma-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px}'
    + '.ma-box{background:rgba(255,255,255,0.03);border-radius:11px;padding:12px 13px;font-size:11px;color:var(--t2,#c8c8d8);line-height:1.6}'
    + '.ma-box .t{font-size:10.5px;color:var(--t3,#8a8aa0)}'
    + '.ma-box .v{font-size:18px;font-weight:800;color:var(--t1,#fff);margin:2px 0 4px}'
    + '.ma-split{display:flex;height:16px;border-radius:8px;overflow:hidden;margin:6px 0}'
    + '.ma-split i{display:block;height:100%}'
    + '.ma-empty{font-size:11px;color:var(--t3,#8a8aa0);padding:6px 0}';
  function injectCss() {
    if (document.getElementById('ma-css')) return;
    var s = document.createElement('style'); s.id = 'ma-css'; s.textContent = CSS;
    document.head.appendChild(s);
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var PLAT = { facebook: 'FB', instagram: 'IG', threads: 'Threads', messenger: 'Messenger', audience_network: '聯播網' };
  var POS = { feed: '動態消息', facebook_reels: 'Reels', instagram_reels: 'Reels', instagram_stories: '限時動態', facebook_stories: '限時動態',
    threads_feed: '動態', instream_video: '影片插播', marketplace: 'Marketplace', search: '搜尋', video_feeds: '影片動態', explore: '探索',
    explore_home: '探索首頁', profile_feed: '個人檔案', right_hand_column: '右欄', facebook_reels_overlay: 'Reels 疊加廣告', an_classic: '原生/橫幅', rewarded_video: '獎勵影片', messenger_inbox: '收件匣' };
  function placeName(p) { return (PLAT[p.platform] || p.platform) + ' ' + (POS[p.position] || p.position); }
  function tag(cls, txt) { return '<span class="mo-tag ' + cls + '">' + txt + '</span>'; }

  //  今天過了幾 %(台北時間)
  function dayFraction() {
    var t = new Date(Date.now() + 8 * 3600 * 1000);
    return Math.max(0.02, (t.getUTCHours() * 60 + t.getUTCMinutes()) / 1440);
  }

  //  進行中廣告 → 依行銷活動 / 廣告組合 加總(區間數據)
  function sumBy(ads, keyFn) {
    var out = {};
    ads.forEach(function (a) {
      var k = keyFn(a); if (!k) return;
      var o = out[k] || (out[k] = { n: 0, spend: 0, purchases: 0, revenue: 0, learning: {}, fresh: 0 });
      o.n++; o.spend += a.spend; o.purchases += a.purchases; o.revenue += a.revenue;
      if (a.learning) o.learning[a.learning] = (o.learning[a.learning] || 0) + 1;
      if (a.ageDays != null && a.ageDays <= 7) o.fresh++;
    });
    return out;
  }

  // ── ① 今天各行銷活動 ────────────────────────────────────
  function campaignBlock(d) {
    var camps = d.campaigns || [];
    if (!camps.length) return '<div class="mo-card"><div class="mo-h">今天的行銷活動</div><div class="ma-empty">目前沒有進行中的行銷活動。</div></div>';
    var cfg = M.state.cfg, frac = dayFraction();
    var byCamp = sumBy(d.ads || [], function (a) { return a.campaign; });
    var groups = { asc: [], cibs: [], rt: [], other: [] };
    camps.forEach(function (c) { groups[M.campaignGroup(c)].push(c); });

    var flags = { constrained: [], thin: [], fewAds: [], cibsAds: [], cibsIdle: [] };
    var rows = '';
    ['asc', 'cibs', 'rt', 'other'].forEach(function (g) {
      if (!groups[g].length) return;
      var gSpend = groups[g].reduce(function (s, c) { return s + c.todaySpend; }, 0);
      rows += '<tr class="ma-grp"><td colspan="7">' + M.GROUP_LABEL[g] + ' · ' + groups[g].length + ' 個 · 今天已花 ' + F.money(gSpend) + '</td></tr>';
      groups[g].forEach(function (c) {
        var agg = byCamp[c.name] || { n: 0, spend: 0, purchases: 0 };
        var rangeCpa = agg.purchases ? agg.spend / agg.purchases : 0;
        var used = c.dailyBudget ? c.todaySpend / c.dailyBudget : 0;
        var pace = used / frac;     // >1 = 跑得比時間快
        var barCls = used >= 0.9 ? 'full' : (pace > 1.4 ? 'hot' : '');
        var paceTxt = !c.dailyBudget ? tag('warn', '預算在廣告組合') :
          used >= 0.9 ? tag('good', '今天花滿了') :
          pace > 1.4 ? tag('bad', '跑太快,會提早花完') :
          (g === 'cibs' && used < 0.05 && frac > 0.15) ? tag('good', '待命中(正常)') :
          pace < 0.35 && frac > 0.3 ? tag('warn', '花不出去') : tag('good', '正常');
        if (g === 'cibs' && c.dailyBudget && used < 0.05 && frac > 0.15) flags.cibsIdle.push(c.name);

        //  日預算 ÷ CPA 倍數(用這段期間的 CPA)
        var mult = (c.dailyBudget && rangeCpa) ? c.dailyBudget / rangeCpa : 0, multTxt = '—';
        if (mult) {
          var need = g === 'cibs' ? 20 : 10;
          multTxt = mult.toFixed(1) + ' 倍 ' + (mult >= need ? tag('good', '夠') : g === 'rt' ? tag('warn', '再行銷受眾小,可接受') : tag('bad', '低於 ' + need + ' 倍'));
          if (mult < 10 && g !== 'rt') flags.thin.push(c.name);
        }
        //  預算卡住:花滿 + CPA 在目標內(有設 CPA 警戒就用它,沒有就用區間 CPA)
        var target = cfg.cpaWarn || rangeCpa;
        if (used >= 0.9 && c.todayPurchases && c.todayCpa <= target) flags.constrained.push(c.name);
        if (g === 'asc' && agg.n && agg.n < 20) flags.fewAds.push(c.name + '(' + agg.n + ' 則)');
        if (g === 'cibs' && agg.n && (agg.n < 6 || agg.n > 20)) flags.cibsAds.push(c.name + '(' + agg.n + ' 則)');

        rows += '<tr><td><div class="ma-name" title="' + esc(c.name) + '">' + esc(c.name) + '</div></td>'
          + '<td><div class="ma-pace"><i class="' + barCls + '" style="width:' + Math.min(100, used * 100).toFixed(0) + '%"></i><b style="left:' + (frac * 100).toFixed(0) + '%"></b><span>'
          + (c.dailyBudget ? Math.round(used * 100) + '% · ' + F.money(c.todaySpend) + ' / ' + F.money(c.dailyBudget) : F.money(c.todaySpend)) + '</span></div></td>'
          + '<td>' + paceTxt + '</td>'
          + '<td class="num">' + (c.todayPurchases ? F.money(c.todayCpa) + '<br><span class="mo-flat">' + c.todayPurchases + ' 筆</span>' : '<span class="mo-flat">還沒成交</span>') + '</td>'
          + '<td class="num">' + (rangeCpa ? F.money(rangeCpa) : '—') + '</td>'
          + '<td class="num">' + multTxt + '</td>'
          + '<td class="num">' + agg.n + '</td></tr>';
      });
    });

    var notes = [];
    if (flags.constrained.length) notes.push('<b>預算卡住了:</b>' + flags.constrained.map(esc).join('、') + ' 今天已花滿,而且 CPA 還在目標內——這就是簡報說的「受限於預算」。可以考慮改用 CIBS(設 CPA 目標 + 日預算拉高到 CPA 的 20~50 倍)。');
    if (flags.thin.length) notes.push('<b>日預算太小:</b>' + flags.thin.map(esc).join('、') + ' 的日預算不到 CPA 的 10 倍,一週湊不滿 50 次轉換,學習期很難跑完。');
    if (flags.cibsIdle.length) notes.push('<b>CIBS 待命中:</b>' + flags.cibsIdle.map(esc).join('、') + ' 今天幾乎沒花——<b>這是設計,不是故障</b>。Meta 官方:CIBS = 成本目標 + 超額預算,轉換率穩定時花不出去是正常的,平日自動縮、旺日(週末 / 檔期)才放量。只有<b>連旺日都放不出量</b>,才代表目標設得比盈虧平衡點還嚴,這時再小步調整(一次一點、等學習)。');
    if (flags.fewAds.length) notes.push('<b>ASC 素材太少:</b>' + flags.fewAds.map(esc).join('、') + '。Meta 建議每個 ASC 行銷活動<b>不少於 20 則</b>廣告,系統才有得挑;素材多可用「彈性廣告」把相似的分組。');
    if (flags.cibsAds.length) notes.push('<b>CIBS 素材數:</b>' + flags.cibsAds.map(esc).join('、') + '。CIBS 建議用<b>新素材 10 則左右、越多元越好</b>(避免素材疲乏;旺季大家加預算推高競價,多元素材能拉高轉換率)。');

    return '<div class="mo-card"><div class="mo-h">今天的行銷活動 <small>白線 = 現在時間(一天過了 ' + Math.round(frac * 100) + '%)</small></div>'
      + '<div class="ma-scroll"><table class="ma-tbl"><thead><tr><th>行銷活動</th><th>今日花費 / 日預算</th><th>速度</th><th>今日 CPA</th><th>期間 CPA</th><th>日預算是 CPA 幾倍</th><th>廣告數</th></tr></thead><tbody>' + rows + '</tbody></table></div>'
      + '<div class="mo-note">' + (notes.length ? notes.join('<br>') + '<br>' : '')
      + '<b>怎麼看:</b>紫條比白線短很多 = 錢花不出去(出價太低或受眾太窄);粉紅 = 跑太快,下午就會停。分組照行銷活動名稱的【ASC/】【CIBS/】【再行銷】判斷。「期間 CPA」與「廣告數」只算進行中的廣告。</div></div>';
  }

  // ── ② 學習期 ────────────────────────────────────────────
  function learningBlock(d) {
    var ads = d.ads || [];
    if (!ads.length) return '';
    var days = (d.range && d.range.days) || 7;
    var bySet = sumBy(ads, function (a) { return a.campaign + ' › ' + a.adset; });
    var sets = Object.keys(bySet).map(function (k) {
      var o = bySet[k], wk = o.purchases / days * 7;
      var st = o.learning.FAIL ? 'FAIL' : (o.learning.LEARNING ? 'LEARNING' : 'SUCCESS');
      return { name: k, weekly: wk, st: st, spend: o.spend };
    }).sort(function (a, b) { return b.spend - a.spend; });
    var nFail = sets.filter(function (s) { return s.st === 'FAIL'; }).length;
    var nLearn = sets.filter(function (s) { return s.st === 'LEARNING'; }).length;
    var rows = sets.slice(0, 12).map(function (s) {
      var pct = Math.min(100, s.weekly / 50 * 100);
      var stTxt = s.st === 'FAIL' ? tag('bad', '學習受限') : s.st === 'LEARNING' ? tag('warn', '學習中') : tag('good', '已完成');
      return '<tr><td><div class="ma-name" title="' + esc(s.name) + '">' + esc(s.name) + '</div></td><td>' + stTxt + '</td>'
        + '<td><div class="ma-pace"><i class="' + (pct >= 100 ? 'full' : '') + '" style="width:' + pct.toFixed(0) + '%"></i><span>' + s.weekly.toFixed(0) + ' / 50</span></div></td>'
        + '<td class="num">' + (s.weekly >= 50 ? '<span class="mo-up">夠了</span>' : s.st === 'SUCCESS' ? '<span class="mo-flat">Meta 判定已學完</span>' : '還差 ' + Math.ceil(50 - s.weekly)) + '</td></tr>';
    }).join('');
    return '<div class="mo-card"><div class="mo-h">學習期進度 <small>' + sets.length + ' 個廣告組合 · 受限 ' + nFail + ' · 學習中 ' + nLearn + '</small></div>'
      + '<div class="ma-scroll"><table class="ma-tbl"><thead><tr><th>行銷活動 › 廣告組合</th><th>狀態</th><th>一週轉換(換算)</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>'
      + '<div class="mo-note"><b>怎麼看:</b>Meta 要每個廣告組合<b>一週 50 次轉換</b>才算學完。「學習受限」= 系統判斷湊不到 50 次,成效會一直不穩。解法:合併相似的廣告組合、放寬受眾,或把日預算拉到 CPA 的 10 倍以上。學習中不要頻繁改預算——簡報原話:計畫的重要性遠大於調整。</div></div>';
  }

  // ── ③ 素材 + ④ 版位 / 格式 ──────────────────────────────
  function creativeBlock(d) {
    var ads = d.ads || [], tot = ads.reduce(function (s, a) { return s + a.spend; }, 0);
    var boxes = [];

    //  新素材預熱
    var fresh = ads.filter(function (a) { return a.ageDays != null && a.ageDays <= 7; });
    var fSpend = fresh.reduce(function (s, a) { return s + a.spend; }, 0);
    var fShare = tot ? fSpend / tot * 100 : 0, cShare = ads.length ? fresh.length / ads.length * 100 : 0;
    var fTag, fTxt;
    if (!fresh.length) { fTag = tag('warn', '近 7 天沒上新素材'); fTxt = '舊素材遲早會疲乏。旺季前建議每週補新素材;開 CIBS 時用新素材 10 則左右。'; }
    else if (fShare < cShare * 0.5) { fTag = tag('bad', '新素材分不到錢'); fTxt = '新素材佔廣告數 ' + cShare.toFixed(0) + '%,卻只分到 ' + fShare.toFixed(0) + '% 花費——系統一直推舊的。建議先放「預熱行銷活動」小預算跑到約 50 次轉換,表現好的再複製進 ASC。'; }
    else { fTag = tag('good', '新素材有在跑'); fTxt = '新素材佔廣告數 ' + cShare.toFixed(0) + '%,分到 ' + fShare.toFixed(0) + '% 花費。'; }
    boxes.push('<div class="ma-box"><div class="t">新素材(7 天內)</div><div class="v">' + fresh.length + ' 則 · ' + F.pct(fShare, 0) + ' 花費</div>' + fTag + '<div style="margin-top:6px">' + fTxt + '</div></div>');

    //  9:16 直式版位
    var pl = d.placements || [], pTot = pl.reduce(function (s, p) { return s + p.spend; }, 0);
    var v = { s: 0, r: 0 }, h = { s: 0, r: 0 };
    pl.forEach(function (p) { var g = p.vertical ? v : h; g.s += p.spend; g.r += p.revenue; });
    if (pTot) {
      var vs = v.s / pTot * 100, vr = v.s ? v.r / v.s : 0, hr = h.s ? h.r / h.s : 0;
      var vTag = vr && hr ? (vr >= hr * 1.1 ? tag('good', '直式比較會賣') : vr < hr * 0.8 ? tag('warn', '直式比較差') : tag('good', '差不多')) : '';
      boxes.push('<div class="ma-box"><div class="t">9:16 直式版位(Reels / 限動)</div><div class="v">' + F.pct(vs, 0) + ' 花費</div>'
        + '<div class="ma-split"><i style="width:' + vs.toFixed(1) + '%;background:var(--pink,#FA6D9B)"></i><i style="width:' + (100 - vs).toFixed(1) + '%;background:rgba(124,109,250,0.5)"></i></div>'
        + '直式 ROAS ' + vr.toFixed(2) + ' / 其他 ' + hr.toFixed(2) + ' ' + vTag
        + '<div style="margin-top:6px">直式素材要:9:16、有聲音、主要文字在安全區。直式佔比低,通常是缺直式影片,不是系統不給。</div></div>');
      var top = pl.slice(0, 5).map(function (p) {
        return '<tr><td>' + esc(placeName(p)) + (p.vertical ? ' ' : '') + '</td><td class="num">' + F.money(p.spend) + '</td><td class="num">' + (p.spend ? (p.revenue / p.spend).toFixed(2) : '—') + '</td></tr>';
      }).join('');
      boxes.push('<div class="ma-box"><div class="t">花最多錢的版位</div><table class="ma-tbl" style="margin-top:4px"><tbody>' + top + '</tbody></table></div>');
    }

    //  影片 vs 圖片
    var fm = {};
    ads.forEach(function (a) { var k = a.format === 'video' ? '影片' : '圖片/其他'; var o = fm[k] || (fm[k] = { n: 0, s: 0, r: 0 }); o.n++; o.s += a.spend; o.r += a.revenue; });
    var fmRows = Object.keys(fm).map(function (k) {
      var o = fm[k];
      return k + ' ' + o.n + ' 則 · 花費 ' + F.pct(tot ? o.s / tot * 100 : 0, 0) + ' · ROAS ' + (o.s ? (o.r / o.s).toFixed(2) : '—');
    }).join('<br>');
    if (fmRows) boxes.push('<div class="ma-box"><div class="t">素材格式</div><div style="margin-top:4px">' + fmRows + '</div><div style="margin-top:6px">素材越多元越好(不同格式、不同角度),彈性廣告格式也是靠素材量取勝。</div></div>');

    return '<div class="mo-card"><div class="mo-h">素材與版位 <small>只算進行中的廣告 · 這段期間</small></div><div class="ma-grid">' + boxes.join('') + '</div>'
      + '<div class="mo-note"><b>為什麼重要:</b>簡報重點——預估轉換率(eCVR)才是影響成效最重要的因素,而素材多元化是拉高它最直接的方法。旺季大家都加預算、競價變貴,素材是唯一不用多花錢就能贏的地方。</div></div>';
  }

  //  v1.4 ASC 的錢花在誰身上(Meta 依帳號設定的「現有顧客」分;沒設定就全部是 unknown)
  function segBlock(d) {
    var sg = d.segments; if (!sg) return '';
    var head = '<div class="mo-card"><div class="mo-h">ASC 的錢花在誰身上 <small>ASC / CIBS 行銷活動 · 這段期間</small></div>';
    if (!Array.isArray(sg)) return head + '<div class="mo-note" style="margin-top:0;border:0;padding:0">Meta 這次沒給新客 / 舊客的數字(' + esc(sg.error || '') + '),晚點再看。</div></div>';
    var NAME = { prospecting: ['新客', '從沒買過'], new_customers: ['新客', '從沒買過'], engaged: ['有互動過', '看過粉專、加過購物車'], engaged_customers: ['有互動過', '看過粉專、加過購物車'],
      existing: ['舊客', '已經買過'], existing_customers: ['舊客', '已經買過'], unknown: ['分不出來', 'Meta 沒辦法判斷'] };
    var tot = sg.reduce(function (s, x) { return s + x.spend; }, 0) || 1;
    var known = sg.filter(function (x) { return x.key !== 'unknown'; });
    if (!known.length || known.reduce(function (s, x) { return s + x.spend; }, 0) < tot * 0.05) {
      return head + '<div style="padding:14px;border-radius:10px;background:rgba(250,109,155,.07);border:1px dashed rgba(250,109,155,.35);font-size:11.5px;line-height:1.8">'
        + '這個廣告帳號還沒告訴 Meta「誰是你的舊客」,Meta 分不出來。<br>設定一次就好:廣告管理員 → 廣告帳號設定 → <b style="color:#fff">受眾區隔</b> → 選「已購買的人」(像素購買事件)或上傳顧客名單。設定後隔天開始有數字,以前的分不回來。</div></div>';
    }
    var order = ['prospecting', 'new_customers', 'engaged', 'engaged_customers', 'existing', 'existing_customers', 'unknown'];
    sg = sg.slice().sort(function (a, b) { return order.indexOf(a.key) - order.indexOf(b.key); });
    var oldShare = 0;
    var rows = sg.map(function (x) {
      var nm = NAME[x.key] || [x.key, ''], sh = x.spend / tot * 100;
      if (nm[0] === '舊客') oldShare += sh;
      return '<tr><td><b>' + nm[0] + '</b> <span style="font-size:10px;color:var(--t3,#8a8aa0)">' + nm[1] + '</span></td><td>' + F.money(x.spend) + '</td><td>' + sh.toFixed(0) + '%</td><td>' + F.num(x.purchases) + '</td><td><b>' + (x.spend ? x.roas.toFixed(2) : '—') + '</b></td></tr>';
    }).join('');
    var tg = oldShare > 25 ? '<span class="mo-tag bad">舊客花費偏多</span>' : '<span class="mo-tag good">主要在拓新客</span>';
    return head.replace('</small></div>', '</small>' + tg + '</div>')
      + '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:11.5px"><thead><tr style="color:var(--t3,#8a8aa0)"><th style="text-align:left;padding:6px 4px">對象</th><th>花費</th><th>佔比</th><th>購買</th><th>ROAS</th></tr></thead><tbody>'
      + rows.replace(/<td>/g, '<td style="text-align:right;padding:7px 4px;border-top:1px solid rgba(255,255,255,.04)">').replace(/<tr><td style="text-align:right;/g, '<tr><td style="text-align:left;') + '</tbody></table></div>'
      + '<div class="mo-note">舊客 ROAS 通常最漂亮,但他們本來就會回來買。舊客花費超過 25% 標紅:ASC 在撿現成的,不是在拓客,可以在 Meta 設「舊客預算上限」。舊客 ' + oldShare.toFixed(0) + '%。</div></div>';
  }

  // ── 畫 ──────────────────────────────────────────────────
  function render(d) {
    var el = document.getElementById('mon-asc'); if (!el || !d) return;
    if (M.goal && M.goal(d) !== 'purchase') {
      var w = M.W(d);
      el.innerHTML = M.T(campaignBlock(d) + learningBlock(d), d).split(' 筆</span>').join(' ' + w.unit + '</span>')
        + '<div class="mo-note" style="margin-top:0">這個品牌的主要目標是「' + w.name + '」,ASC / CIBS 是購物用的策略,這區只看預算節奏和學習期(學習期一樣要一週 50 ' + w.unit + w.conv + ')。</div>';
      return;
    }
    el.innerHTML = campaignBlock(d) + segBlock(d) + learningBlock(d) + creativeBlock(d);
  }
  function skeleton() {
    var el = document.getElementById('mon-asc'); if (!el) return;
    el.innerHTML = '<div class="mo-skel" style="height:220px"></div><div class="mo-skel"></div>';
  }

  injectCss();
  M.on('loading', skeleton);
  M.on('data', render);
  if (M.state.data) render(M.state.data);

  window.MON_ASC = { version: 'monitor-asc v1.4', render: render };
})();
