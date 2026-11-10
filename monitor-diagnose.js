/* ══════════════════════════════════════════════════════════════
   Brand OS · monitor-diagnose.js · v1.0(2026-11-11)
   新版廣告監控頁「🩺 CPA 為什麼變貴」診斷區。資料:MON.state.data(主畫面)+ MON.diag()(診斷包)

   核心:CPA = CPM ÷ 1000 ÷ 點擊率 ÷ 購買率(點進來的人有幾 % 買)
   → CPA 變貴只有三條路,每條要動的地方不一樣,不用一個一個猜:
      CPM 漲   = 買曝光變貴(旺季搶量、受眾太窄)→ 動預算 / 出價 / 受眾
      點擊率掉 = 人看到不想點(素材疲乏)        → 換素材、換開頭
      購買率掉 = 點進來不買(價格、優惠、網站、需求)→ 動商品頁、優惠、檔期
   再加三個「其實沒壞」的檢查:單數太少(正常起伏)、最近 2 天還在補單、期間內改過設定(學習期重來)
   往下拆:每個行銷活動、年齡、地區(地區 Meta 不給購買數,只看 CPM / 點擊率)、變更紀錄

   掛載點:<div id="mon-diag"></div>(共用 overview 的 .mo-* 樣式)
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (!window.MON) { console.error('[diag] 要先載 monitor-data.js'); return; }
  var M = window.MON, F = M.fmt;

  var CSS = ''
    + '#mon-diag{display:flex;flex-direction:column;gap:14px}'
    + '.dg-verdict{font-size:14px;font-weight:800;color:var(--t1,#fff);line-height:1.6;margin:2px 0 12px}'
    + '.dg-verdict small{display:block;font-size:11px;font-weight:500;color:var(--t3,#8a8aa0)}'
    + '.dg-parts{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:10px}'
    + '.dg-part{background:rgba(255,255,255,0.03);border-radius:11px;padding:12px 13px;border:1px solid transparent}'
    + '.dg-part.main{border-color:var(--pink,#FA6D9B);background:rgba(250,109,155,0.06)}'
    + '.dg-part .t{font-size:10.5px;color:var(--t3,#8a8aa0)}'
    + '.dg-part .v{font-size:17px;font-weight:800;color:var(--t1,#fff);margin:3px 0}'
    + '.dg-part .a{font-size:10.5px;color:var(--t2,#c8c8d8);line-height:1.6;margin-top:5px}'
    + '.dg-bar{height:8px;border-radius:4px;background:rgba(255,255,255,0.05);overflow:hidden;margin-top:6px}'
    + '.dg-bar i{display:block;height:100%;border-radius:4px}'
    + '.dg-checks{display:flex;flex-direction:column;gap:6px;margin-top:12px}'
    + '.dg-check{font-size:11px;color:var(--t2,#c8c8d8);padding:8px 10px;border-radius:9px;background:rgba(124,109,250,0.07);border-left:3px solid var(--gold,#7C6DFA);line-height:1.6}'
    + '.dg-check.ok{background:rgba(109,250,194,0.06);border-left-color:var(--mint,#6DFAC2)}'
    + '.dg-check.bad{background:rgba(250,109,155,0.07);border-left-color:var(--pink,#FA6D9B)}'
    + '.dg-tbl{width:100%;border-collapse:collapse;font-size:11px}'
    + '.dg-tbl th{text-align:right;font-weight:600;color:var(--t3,#8a8aa0);padding:6px 8px;border-bottom:1px solid var(--line,rgba(255,255,255,0.08));white-space:nowrap}'
    + '.dg-tbl th:first-child,.dg-tbl td:first-child{text-align:left}'
    + '.dg-tbl td{padding:7px 8px;border-bottom:1px solid rgba(255,255,255,0.04);color:var(--t2,#c8c8d8);text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}'
    + '.dg-tbl td.nm{max-width:260px;overflow:hidden;text-overflow:ellipsis}'
    + '.dg-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}'
    + '.dg-ev{display:flex;flex-direction:column;gap:4px;max-height:260px;overflow:auto}'
    + '.dg-ev div{font-size:10.5px;color:var(--t2,#c8c8d8);display:flex;gap:8px}'
    + '.dg-ev b{color:var(--t3,#8a8aa0);font-weight:500;min-width:78px}'
    + '.dg-wait{font-size:11px;color:var(--t3,#8a8aa0);padding:8px 0}';
  function injectCss() {
    if (document.getElementById('dg-css')) return;
    var s = document.createElement('style'); s.id = 'dg-css'; s.textContent = CSS;
    document.head.appendChild(s);
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function pctTxt(r) { var p = (r - 1) * 100; return (p >= 0 ? '▲' : '▼') + Math.abs(p).toFixed(1) + '%'; }

  // ── CPA 拆三段 ──────────────────────────────────────────
  //  傳入 {spend, impressions, clicks, purchases} 兩期 → 三段各自變化與佔比
  function decompose(c, p) {
    if (!c || !p || !c.purchases || !p.purchases || !c.clicks || !p.clicks || !c.impressions || !p.impressions) return null;
    var cpm1 = c.spend / c.impressions, cpm0 = p.spend / p.impressions;
    var ctr1 = c.clicks / c.impressions, ctr0 = p.clicks / p.impressions;
    var cvr1 = c.purchases / c.clicks, cvr0 = p.purchases / p.clicks;
    var cpa1 = c.spend / c.purchases, cpa0 = p.spend / p.purchases;
    var lt = Math.log(cpa1 / cpa0);
    //  對 CPA 的影響(正 = 讓 CPA 變貴)
    var parts = [
      { k: 'cpm', name: 'CPM(買曝光的價錢)', ratio: cpm1 / cpm0, effect: Math.log(cpm1 / cpm0), cur: cpm1 * 1000, prev: cpm0 * 1000, fmt: 'money' },
      { k: 'ctr', name: '點擊率(看到會不會點)', ratio: ctr1 / ctr0, effect: -Math.log(ctr1 / ctr0), cur: ctr1 * 100, prev: ctr0 * 100, fmt: 'pct' },
      { k: 'cvr', name: '購買率(點進來會不會買)', ratio: cvr1 / cvr0, effect: -Math.log(cvr1 / cvr0), cur: cvr1 * 100, prev: cvr0 * 100, fmt: 'pct' }
    ];
    var up = lt >= 0;
    var main = parts.slice().sort(function (a, b) { return up ? b.effect - a.effect : a.effect - b.effect; })[0];
    return { cpa1: cpa1, cpa0: cpa0, ratio: cpa1 / cpa0, lt: lt, parts: parts, main: main, up: up };
  }
  var ADVICE = {
    cpm: '買曝光變貴了。常見原因:旺季大家搶量、受眾太窄、預算一次加太多。可以動預算節奏 / 出價 / 放寬受眾;<b>素材和網站先不用動</b>。',
    ctr: '人看到不想點了 = 素材疲乏或不吸引人。換素材、換影片開頭前 3 秒、換主圖;<b>受眾和網站先不用動</b>。(看下面「進行中廣告」的疲乏指數找是哪幾支)',
    cvr: '點進來的人不買了。看價格 / 優惠有沒有變、商品頁、運費門檻、缺貨、競品在打折,或季節需求下降;<b>換素材不一定有用</b>。'
  };

  //  單數是不是太少(兩期購買數換算到同花費,差距在 2 個標準差內 = 正常起伏)
  function noise(c, p) {
    var n = Math.min(c.purchases || 0, p.purchases || 0);
    var exp = p.spend ? p.purchases * (c.spend / p.spend) : 0;   // 照上期效率,這期「應該」有幾單
    var within = exp > 0 && Math.abs(c.purchases - exp) <= 2 * Math.sqrt(exp);
    return { small: n < 20, within: within, exp: exp };
  }

  // ── ① 總結 ──────────────────────────────────────────────
  function headBlock(d, g) {
    var t = d.totals, p = d.previous;
    var c = { spend: t.spend, impressions: t.impressions, clicks: t.linkClicks, purchases: t.purchases };
    var q = { spend: p.spend, impressions: p.impressions, clicks: p.linkClicks, purchases: p.purchases };
    var x = decompose(c, q);
    if (!x) return '<div class="mo-card"><div class="mo-h">🩺 CPA 為什麼變貴</div><div class="dg-wait">這期或上一期沒有購買,拆不出來。</div></div>';
    var nz = noise(c, q);
    var verdict;
    if (Math.abs(x.ratio - 1) < 0.05) verdict = 'CPA 跟上一期差不多(' + pctTxt(x.ratio) + '),沒有明顯變貴。';
    else verdict = 'CPA ' + (x.up ? '變貴' : '變便宜') + ' ' + pctTxt(x.ratio).slice(1) + '(' + F.money(x.cpa0) + ' → ' + F.money(x.cpa1) + '),'
      + '主因是<span style="color:var(--pink,#FA6D9B)">' + x.main.name.replace(/(.*)/, '$1') + (x.main.ratio >= 1 ? ' 漲 ' : ' 掉 ') + Math.abs((x.main.ratio - 1) * 100).toFixed(0) + '%</span>';

    var maxEff = Math.max.apply(null, x.parts.map(function (z) { return Math.abs(z.effect); })) || 1;
    var parts = x.parts.map(function (z) {
      var isMain = z === x.main && Math.abs(x.ratio - 1) >= 0.05;
      var hurt = z.effect > 0;
      return '<div class="dg-part' + (isMain ? ' main' : '') + '"><div class="t">' + z.name + '</div>'
        + '<div class="v">' + (z.fmt === 'money' ? F.money(z.prev) + ' → ' + F.money(z.cur) : z.prev.toFixed(2) + '% → ' + z.cur.toFixed(2) + '%') + '</div>'
        + '<span class="' + (hurt ? 'mo-down' : 'mo-up') + '">' + pctTxt(z.ratio) + ' · ' + (hurt ? '讓 CPA 變貴' : '讓 CPA 變便宜') + '</span>'
        + '<div class="dg-bar"><i style="width:' + (Math.abs(z.effect) / maxEff * 100).toFixed(0) + '%;background:' + (hurt ? 'var(--pink,#FA6D9B)' : 'var(--mint,#6DFAC2)') + '"></i></div>'
        + (isMain && x.up ? '<div class="a">' + ADVICE[z.k] + '</div>' : '') + '</div>';
    }).join('');

    //  三個「其實沒壞」檢查
    var checks = [];
    if (nz.small) checks.push(['bad', '🎲 <b>單數太少,先別急著改:</b>這期 ' + c.purchases + ' 單、上期 ' + q.purchases + ' 單。少於 20 單時,一天 3 單、隔天 1 單是正常起伏,不代表廣告壞了。建議看 14 或 30 天再判斷。']);
    else if (nz.within) checks.push(['ok', '🎲 <b>在正常起伏內:</b>照上一期的效率,這期花的錢「應該」有約 ' + Math.round(nz.exp) + ' 單,實際 ' + c.purchases + ' 單,差距還在統計上的正常範圍。']);
    else checks.push(['', '🎲 單數夠多(' + c.purchases + ' 單),這次的變化不是隨機起伏,是真的變了。']);

    var yest = new Date(Date.now() + 8 * 3600 * 1000 - 86400000).toISOString().slice(0, 10);
    if (d.range && d.range.until >= yest) checks.push(['', '⏳ <b>最近 2 天還在補單:</b>Meta 把購買算回「看到廣告那天」,點擊後 7 天內的購買都會回補。區間包含昨天、今天時,最後兩天的 CPA 通常偏高,過兩三天會變好看。']);

    var resets = g && g.events ? g.events.filter(function (e) { return /budget|bid_strategy|bid_amount|optimization_goal|target_spec|create_ad_set/.test(e.type) && e.time.slice(0, 10) >= d.range.since; }) : [];
    if (resets.length) checks.push(['bad', '🔄 <b>這期有 ' + resets.length + ' 次「會讓學習期重來」的修改</b>(預算 / 出價 / 受眾 / 最佳化目標 / 新廣告組合),改完幾天內 CPA 偏高是正常的。明細看最下面的變更紀錄。']);
    else if (g && g.events) checks.push(['ok', '🔄 這期沒有改預算、出價、受眾——CPA 變化不是學習期重來造成的。']);

    return '<div class="mo-card"><div class="mo-h">🩺 CPA 為什麼變貴 <small>這期 vs 上一期 · 整個帳號</small></div>'
      + '<div class="dg-verdict">' + verdict + '<small>CPA = CPM ÷ 點擊率 ÷ 購買率。CPA 變貴只有這三條路,先看是哪一條,再決定動什麼。</small></div>'
      + '<div class="dg-parts">' + parts + '</div>'
      + '<div class="dg-checks">' + checks.map(function (z) { return '<div class="dg-check ' + z[0] + '">' + z[1] + '</div>'; }).join('') + '</div></div>';
  }

  // ── ② 每個行銷活動 ──────────────────────────────────────
  function campBlock(g) {
    var rows = (g.campaigns || []).filter(function (r) { return r.cur && r.cur.spend > 0; });
    var tot = rows.reduce(function (s, r) { return s + r.cur.spend; }, 0);
    rows = rows.filter(function (r) { return r.cur.spend >= tot * 0.03; }).sort(function (a, b) { return b.cur.spend - a.cur.spend; });
    if (!rows.length) return '';
    var NAME = { cpm: 'CPM 漲', ctr: '點擊率掉', cvr: '購買率掉' };
    var body = rows.map(function (r) {
      var x = decompose(r.cur, r.prev), nz = r.prev ? noise(r.cur, r.prev) : { small: true };
      var cause = !r.prev ? '<span class="mo-flat">上一期沒跑</span>' : !x ? '<span class="mo-flat">有一期沒成交</span>'
        : Math.abs(x.ratio - 1) < 0.08 ? '<span class="mo-flat">持平</span>'
        : nz.small ? '<span class="mo-flat">單數太少,看不準</span>'
        : (x.up ? '<span class="mo-down">' + NAME[x.main.k] + ' ' + Math.abs((x.main.ratio - 1) * 100).toFixed(0) + '%</span>' : '<span class="mo-up">變便宜</span>');
      return '<tr><td class="nm" title="' + esc(r.name) + '">' + esc(r.name) + '</td>'
        + '<td>' + F.money(r.cur.spend) + '</td>'
        + '<td>' + (r.prev && r.prev.purchases ? F.money(r.prev.spend / r.prev.purchases) : '—') + '</td>'
        + '<td>' + (r.cur.purchases ? F.money(r.cur.spend / r.cur.purchases) : '—') + '</td>'
        + '<td>' + (x ? '<span class="' + (x.up ? 'mo-down' : 'mo-up') + '">' + pctTxt(x.ratio) + '</span>' : '—') + '</td>'
        + '<td>' + (r.prev ? r.prev.purchases : 0) + ' → ' + r.cur.purchases + '</td>'
        + '<td>' + cause + '</td></tr>';
    }).join('');
    return '<div class="mo-card"><div class="mo-h">🎯 是哪個行銷活動在拖 <small>花費佔 3% 以上的</small></div>'
      + '<div class="dg-scroll"><table class="dg-tbl"><thead><tr><th>行銷活動</th><th>這期花費</th><th>上期 CPA</th><th>這期 CPA</th><th>變化</th><th>購買數</th><th>主因</th></tr></thead><tbody>' + body + '</tbody></table></div>'
      + '<div class="mo-note"><b>怎麼看:</b>整個帳號 CPA 變貴,常常只是其中一兩個行銷活動在拖。先找花最多、變最多的那個,看它的主因,再對症下藥。「單數太少」的先別動。</div></div>';
  }

  // ── ③ 年齡 ──────────────────────────────────────────────
  function ageBlock(g) {
    var rows = (g.age || []).filter(function (r) { return r.key !== 'Unknown' && r.cur && r.cur.spend > 0; });
    if (!rows.length) return '';
    var tot = rows.reduce(function (s, r) { return s + r.cur.spend; }, 0);
    var worst = null;
    var body = rows.map(function (r) {
      var c1 = r.cur.purchases ? r.cur.spend / r.cur.purchases : 0, c0 = r.prev && r.prev.purchases ? r.prev.spend / r.prev.purchases : 0;
      var ch = c1 && c0 ? c1 / c0 : 0, sh = r.cur.spend / tot * 100;
      if (ch > 1.15 && sh >= 10 && r.cur.purchases >= 10 && (!worst || ch * sh > worst.score)) worst = { key: r.key, ch: ch, score: ch * sh };
      return '<tr><td>' + esc(r.key) + ' 歲</td><td>' + F.pct(sh, 0) + '</td><td>' + (c0 ? F.money(c0) : '—') + '</td><td>' + (c1 ? F.money(c1) : '—') + '</td>'
        + '<td>' + (ch ? '<span class="' + (ch > 1 ? 'mo-down' : 'mo-up') + '">' + pctTxt(ch) + '</span>' : '—') + '</td><td>' + (r.prev ? r.prev.purchases : 0) + ' → ' + r.cur.purchases + '</td></tr>';
    }).join('');
    return '<div class="mo-card"><div class="mo-h">👥 是哪個年齡層變貴 <small>整個帳號</small></div>'
      + '<div class="dg-scroll"><table class="dg-tbl"><thead><tr><th>年齡</th><th>花費佔比</th><th>上期 CPA</th><th>這期 CPA</th><th>變化</th><th>購買數</th></tr></thead><tbody>' + body + '</tbody></table></div>'
      + '<div class="mo-note">' + (worst ? '<b>' + esc(worst.key) + ' 歲變貴最多(' + pctTxt(worst.ch) + ')而且花費不小。</b>' : '<b>各年齡層沒有特別突出的變貴。</b>— 所以「調整年齡」不是這次的解法。')
      + ' 提醒:ASC / Advantage+ 受眾是系統自動分配年齡,<b>通常不建議手動鎖年齡</b>;這張表是用來確認「是不是某個年齡層在拖」,不是要你去改設定。</div></div>';
  }

  // ── ④ 地區 ──────────────────────────────────────────────
  var CITY = { 'Taipei': '台北市', 'New Taipei City': '新北市', 'Taoyuan City': '桃園市', 'Taichung': '台中市', 'Tainan': '台南市', 'Kaohsiung': '高雄市',
    'Keelung City': '基隆市', 'Hsinchu City': '新竹市', 'Hsinchu': '新竹縣', 'Miaoli': '苗栗縣', 'Changhua': '彰化縣', 'Nantou': '南投縣', 'Yunlin': '雲林縣',
    'Chiayi': '嘉義', 'Pingtung': '屏東縣', 'Yilan': '宜蘭縣', 'Hualien': '花蓮縣', 'Taitung': '台東縣', 'Penghu': '澎湖縣', 'Kinmen': '金門縣', 'Lienchiang': '連江縣', 'Unknown': '不明' };
  function regionBlock(g) {
    var rows = (g.region || []).filter(function (r) { return r.cur && r.cur.spend > 0 && r.key !== 'Unknown'; });
    if (!rows.length) return '';
    var tot = rows.reduce(function (s, r) { return s + r.cur.spend; }, 0);
    rows.sort(function (a, b) { return b.cur.spend - a.cur.spend; });
    var body = rows.slice(0, 10).map(function (r) {
      var m1 = r.cur.impressions ? r.cur.spend / r.cur.impressions * 1000 : 0, m0 = r.prev && r.prev.impressions ? r.prev.spend / r.prev.impressions * 1000 : 0;
      var t1 = r.cur.impressions ? r.cur.clicks / r.cur.impressions * 100 : 0, t0 = r.prev && r.prev.impressions ? r.prev.clicks / r.prev.impressions * 100 : 0;
      return '<tr><td>' + esc(CITY[r.key] || r.key) + '</td><td>' + F.pct(r.cur.spend / tot * 100, 0) + '</td>'
        + '<td>' + F.money(m1) + (m0 ? ' <span class="' + (m1 > m0 ? 'mo-down' : 'mo-up') + '">' + pctTxt(m1 / m0) + '</span>' : '') + '</td>'
        + '<td>' + t1.toFixed(2) + '%' + (t0 ? ' <span class="' + (t1 < t0 ? 'mo-down' : 'mo-up') + '">' + pctTxt(t1 / t0) + '</span>' : '') + '</td></tr>';
    }).join('');
    return '<div class="mo-card"><div class="mo-h">🗺 各縣市 <small>前 10 名 · 只看 CPM 與點擊率</small></div>'
      + '<div class="dg-scroll"><table class="dg-tbl"><thead><tr><th>縣市</th><th>花費佔比</th><th>CPM(vs 上期)</th><th>點擊率(vs 上期)</th></tr></thead><tbody>' + body + '</tbody></table></div>'
      + '<div class="mo-note"><b>為什麼沒有各縣市 CPA:</b>Meta 的地區拆解不回報網站購買數(隱私限制),只能看哪個城市變貴、變不愛點。之後會把<b>氣象</b>(例如寒流)和 <b>Google 搜尋熱度</b>疊在這張表上,判斷是「需求變了」還是「廣告變差」。</div></div>';
  }

  // ── ⑤ 變更紀錄 ──────────────────────────────────────────
  function eventsBlock(g) {
    if (g.events === null) return '<div class="mo-card"><div class="mo-h">📝 期間內改了什麼</div><div class="dg-wait">這個帳號的權杖讀不到變更紀錄。</div></div>';
    var ev = g.events || [];
    if (!ev.length) return '<div class="mo-card"><div class="mo-h">📝 期間內改了什麼</div><div class="dg-wait">上一期到今天沒有任何預算、出價、受眾或開關的修改。</div></div>';
    var RESET = /budget|bid_strategy|bid_amount|optimization_goal|target_spec|create_ad_set/;
    var list = ev.map(function (e) {
      var t = new Date(e.time), tw = new Date(t.getTime() + 8 * 3600 * 1000).toISOString();
      return '<div><b>' + tw.slice(5, 10).replace('-', '/') + ' ' + tw.slice(11, 16) + '</b><span>' + (RESET.test(e.type) ? '🔄 ' : '') + esc(e.label) + ' · ' + esc(e.object) + '</span></div>';
    }).join('');
    var nReset = ev.filter(function (e) { return RESET.test(e.type); }).length;
    return '<div class="mo-card"><div class="mo-h">📝 期間內改了什麼 <small>從上一期開始到今天 · ' + ev.length + ' 筆 · 🔄 會讓學習期重來 ' + nReset + ' 筆</small></div>'
      + '<div class="dg-ev">' + list + '</div>'
      + '<div class="mo-note"><b>對照用:</b>CPA 哪天開始變貴,就往上找那幾天改了什麼。預算一次加太多(一般建議一次不超過 2 成)、換出價方式、改受眾,都會讓學習期重來,前幾天 CPA 偏高是正常的。</div></div>';
  }

  // ── 畫 ──────────────────────────────────────────────────
  var seq = 0;
  function render(d) {
    var el = document.getElementById('mon-diag'); if (!el || !d) return;
    var my = ++seq;
    el.innerHTML = headBlock(d, null) + '<div class="mo-skel" style="height:160px"></div>';
    M.diag().then(function (g) {
      if (my !== seq) return;
      if (!g || !g.ok) { el.innerHTML = headBlock(d, null) + '<div class="mo-card"><div class="dg-wait">⚠️ 診斷細項讀不到:' + esc((g && g.error) || '請稍後再試') + '</div></div>'; return; }
      el.innerHTML = headBlock(d, g) + campBlock(g) + ageBlock(g) + regionBlock(g) + eventsBlock(g);
    });
  }
  function skeleton() {
    var el = document.getElementById('mon-diag'); if (!el) return;
    el.innerHTML = '<div class="mo-skel" style="height:200px"></div>';
  }

  injectCss();
  M.on('loading', skeleton);
  M.on('data', render);
  if (M.state.data) render(M.state.data);

  window.MON_DIAG = { version: 'monitor-diagnose v1.0.1', render: render, decompose: decompose };
})();
