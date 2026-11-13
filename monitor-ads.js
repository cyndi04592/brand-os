/* ══════════════════════════════════════════════════════════════
   Brand OS · monitor-ads.js · v1.0(2026-11-11)
   新版廣告監控頁「進行中廣告」列表 + 素材疲乏指數。資料一律跟 window.MON 拿。
   只列 ACTIVE(進行中)的廣告——關掉的不列。

   疲乏指數(0~100)——不是只看平均,是看「變化」(需要 ads-monitor v1.1 的 trend):
     點擊率:近 3 天比前 7 天掉 ≥30% → +40;掉 ≥15% → +20
     頻率:  ≥ 警戒值(預設 3.5)→ +25;≥ 警戒值 × 0.8 → +12
     CPM:   近 3 天比前 7 天漲 ≥30% → +20;漲 ≥15% → +10
     老素材:上線 ≥30 天且點擊率在掉 → +15
     ≥60 = 該換素材;35~59 = 注意;曝光太少不評分
   掛載點:<div id="mon-ads"></div>
   共用 monitor-overview.js 的 .mo-card / .mo-h / .mo-note / .mo-tag 樣式
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (!window.MON) { console.error('[ads] 要先載 monitor-data.js'); return; }
  var M = window.MON, F = M.fmt;

  var CSS = ''
    + '#mon-ads{display:flex;flex-direction:column;gap:14px}'
    + '.md-bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px}'
    + '.md-chip{padding:5px 11px;border-radius:999px;border:1px solid var(--line,rgba(255,255,255,0.12));background:transparent;color:var(--t2,#c8c8d8);font-size:11px;cursor:pointer}'
    + '.md-chip.on{background:var(--gold,#7C6DFA);border-color:var(--gold,#7C6DFA);color:#fff;font-weight:700}'
    + '.md-search{margin-left:auto;padding:5px 10px;border-radius:8px;border:1px solid var(--line,rgba(255,255,255,0.12));background:rgba(0,0,0,0.25);color:#fff;font-size:11px;min-width:160px}'
    + '.md-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}'
    + '.md-tbl{width:100%;border-collapse:collapse;font-size:11px;min-width:860px}'
    + '.md-tbl th{text-align:right;font-weight:600;color:var(--t3,#8a8aa0);padding:7px 8px;border-bottom:1px solid var(--line,rgba(255,255,255,0.08));white-space:nowrap;cursor:pointer;user-select:none}'
    + '.md-tbl th:first-child{text-align:left}.md-tbl th.on{color:var(--t1,#fff)}'
    + '.md-tbl td{padding:8px;border-bottom:1px solid rgba(255,255,255,0.04);color:var(--t2,#c8c8d8);text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums;vertical-align:middle}'
    + '.md-tbl td:first-child{text-align:left;white-space:normal}'
    + '.md-ad{display:flex;gap:9px;align-items:center;min-width:220px;max-width:320px}'
    + '.md-ad img,.md-ad .ph{width:38px;height:38px;border-radius:7px;object-fit:cover;flex-shrink:0;background:rgba(255,255,255,0.06)}'
    + '.md-ad .nm{color:var(--t1,#fff);font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
    + '.md-ad .cp{color:var(--t3,#8a8aa0);font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
    + '.md-tr{font-size:10px;display:block}'
    + '.md-fat{display:inline-block;min-width:44px;text-align:center;padding:3px 8px;border-radius:7px;font-weight:800;font-size:11px}'
    + '.md-fat.hi{background:rgba(250,109,155,0.16);color:var(--pink,#FA6D9B)}'
    + '.md-fat.mid{background:rgba(124,109,250,0.16);color:var(--gold,#7C6DFA)}'
    + '.md-fat.ok{background:rgba(109,250,194,0.12);color:var(--mint,#6DFAC2)}'
    + '.md-fat.na{background:rgba(255,255,255,0.05);color:var(--t3,#8a8aa0)}'
    + '.md-why{font-size:9.5px;color:var(--t3,#8a8aa0);margin-top:3px;white-space:normal;max-width:170px;margin-left:auto;line-height:1.45}'
    + '.md-alert{display:flex;flex-direction:column;gap:6px}'
    + '.md-alert div{font-size:11px;color:var(--t2,#c8c8d8);padding:8px 10px;border-radius:9px;background:rgba(250,109,155,0.07);border-left:3px solid var(--pink,#FA6D9B)}'
    + '.md-more{margin-top:10px;text-align:center}'
    + '.md-more button{padding:6px 16px;border-radius:8px;border:1px solid var(--line,rgba(255,255,255,0.15));background:transparent;color:var(--t2,#c8c8d8);cursor:pointer;font-size:11px}';
  function injectCss() {
    if (document.getElementById('md-css')) return;
    var s = document.createElement('style'); s.id = 'md-css'; s.textContent = CSS;
    document.head.appendChild(s);
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  // ── 疲乏指數 ────────────────────────────────────────────
  function fatigue(a, cfg) {
    var t = a.trend, why = [], s = 0;
    var fw = cfg.freqWarn || 3.5;
    var enough = t && t.last3.impressions >= 1000 && t.prev7.impressions >= 2000;
    var ctrDrop = 0, cpmRise = 0;
    if (enough) {
      ctrDrop = t.prev7.ctr ? (t.prev7.ctr - t.last3.ctr) / t.prev7.ctr : 0;
      cpmRise = t.prev7.cpm ? (t.last3.cpm - t.prev7.cpm) / t.prev7.cpm : 0;
      if (ctrDrop >= 0.3) { s += 40; why.push('點擊率掉 ' + Math.round(ctrDrop * 100) + '%'); }
      else if (ctrDrop >= 0.15) { s += 20; why.push('點擊率掉 ' + Math.round(ctrDrop * 100) + '%'); }
      if (cpmRise >= 0.3) { s += 20; why.push('CPM 漲 ' + Math.round(cpmRise * 100) + '%'); }
      else if (cpmRise >= 0.15) { s += 10; why.push('CPM 漲 ' + Math.round(cpmRise * 100) + '%'); }
      if (a.ageDays >= 30 && ctrDrop >= 0.15) { s += 15; why.push('上線 ' + a.ageDays + ' 天'); }
    }
    if (a.frequency >= fw) { s += 25; why.push('頻率 ' + a.frequency.toFixed(1)); }
    else if (a.frequency >= fw * 0.8) { s += 12; why.push('頻率 ' + a.frequency.toFixed(1)); }
    if (!enough && a.impressions < 3000) return { score: null, why: ['曝光太少,先不評'], ctrDrop: 0, cpmRise: 0 };
    return { score: Math.min(100, s), why: why, ctrDrop: ctrDrop, cpmRise: cpmRise };
  }

  // ── 狀態 ────────────────────────────────────────────────
  var view = { filter: 'all', sort: 'spend', dir: -1, q: '', limit: 30 };
  var rows = [];

  function prep(d) {
    var cfg = M.state.cfg, mg = parseFloat(cfg['margin_' + d.brand]) || 0;
    var be = mg > 0 && mg < 100 ? 100 / mg : (cfg.roasTarget || 0);   // 有毛利率用損益兩平,沒有用 ROAS 目標
    rows = (d.ads || []).map(function (a) {
      var f = fatigue(a, cfg);
      return Object.assign({}, a, { fat: f.score, why: f.why, ctrDrop: f.ctrDrop, cpmRise: f.cpmRise, be: be,
        losing: be && a.spend >= 500 && a.roas < be });
    });
  }

  function filtered() {
    var q = view.q.trim().toLowerCase();
    var list = rows.filter(function (r) {
      if (q && (r.name + ' ' + r.campaign + ' ' + r.adset).toLowerCase().indexOf(q) < 0) return false;
      if (view.filter === 'tired') return r.fat != null && r.fat >= 35;
      if (view.filter === 'win') return r.be ? r.roas >= r.be : r.roas >= 1;
      if (view.filter === 'lose') return r.losing;
      if (view.filter === 'nosale') return r.spend >= 500 && !r.purchases;
      return true;
    });
    var k = view.sort, dir = view.dir;
    list.sort(function (x, y) {
      var a = k === 'fat' ? (x.fat == null ? -1 : x.fat) : k === 'ctrDrop' ? x.ctrDrop : x[k];
      var b = k === 'fat' ? (y.fat == null ? -1 : y.fat) : k === 'ctrDrop' ? y.ctrDrop : y[k];
      return ((a || 0) - (b || 0)) * dir;
    });
    return list;
  }

  // ── 畫 ──────────────────────────────────────────────────
  function trendCell(cur, prev, goodWhenUp, fmtFn) {
    if (!prev) return '';
    var d = (cur - prev) / prev * 100;
    if (Math.abs(d) < 5) return '<span class="md-tr mo-flat">近3天 持平</span>';
    var good = (d > 0) === goodWhenUp;
    return '<span class="md-tr ' + (good ? 'mo-up' : 'mo-down') + '">近3天 ' + (d > 0 ? '▲' : '▼') + Math.abs(d).toFixed(0) + '%</span>';
  }

  function tableHtml(list) {
    var cols = [['name', '廣告'], ['spend', '花費'], ['roas', 'ROAS'], ['cpa', 'CPA'], ['purchases', '購買'], ['ctr', 'CTR'], ['frequency', '頻率'], ['cpm', 'CPM'], ['ageDays', '上線'], ['fat', '疲乏']];
    var head = '<tr>' + cols.map(function (c) {
      var on = view.sort === c[0];
      return '<th data-k="' + c[0] + '" class="' + (on ? 'on' : '') + '">' + c[1] + (on ? (view.dir < 0 ? ' ▼' : ' ▲') : '') + '</th>';
    }).join('') + '</tr>';
    var body = list.slice(0, view.limit).map(function (r) {
      var t = r.trend;
      var fatCls = r.fat == null ? 'na' : r.fat >= 60 ? 'hi' : r.fat >= 35 ? 'mid' : 'ok';
      var fatTxt = r.fat == null ? '—' : (r.fat >= 60 ? '換 ' : r.fat >= 35 ? '注意 ' : '') + r.fat;
      var learn = r.learning === 'FAIL' ? ' · <span class="mo-down">學習受限</span>' : r.learning === 'LEARNING' ? ' · 學習中' : '';
      var fmtIcon = r.format === 'video' ? '' : '';
      return '<tr>'
        + '<td><div class="md-ad">' + (r.thumb ? '<img loading="lazy" src="' + esc(r.thumb) + '" alt="">' : '<div class="ph"></div>')
        + '<div style="min-width:0"><div class="nm" title="' + esc(r.name) + '">' + fmtIcon + ' ' + esc(r.name) + '</div><div class="cp" title="' + esc(r.campaign + ' › ' + r.adset) + '">' + esc(r.campaign) + learn + '</div></div></div></td>'
        + '<td>' + F.money(r.spend) + '</td>'
        + '<td class="' + (r.losing ? 'mo-down' : '') + '">' + (r.spend ? r.roas.toFixed(2) : '—') + '</td>'
        + '<td>' + (r.purchases ? F.money(r.cpa) : '—') + (t && t.prev7.cpa && t.last3.cpa ? trendCell(t.last3.cpa, t.prev7.cpa, false) : '') + '</td>'
        + '<td>' + F.num(r.purchases) + '</td>'
        + '<td>' + F.pct(r.ctr) + (t ? trendCell(t.last3.ctr, t.prev7.ctr, true) : '') + '</td>'
        + '<td class="' + (r.frequency >= (M.state.cfg.freqWarn || 3.5) ? 'mo-down' : '') + '">' + r.frequency.toFixed(2) + '</td>'
        + '<td>' + F.money(r.cpm) + (t ? trendCell(t.last3.cpm, t.prev7.cpm, false) : '') + '</td>'
        + '<td>' + (r.ageDays == null ? '—' : r.ageDays + ' 天') + '</td>'
        + '<td><span class="md-fat ' + fatCls + '">' + fatTxt + '</span>' + (r.why.length ? '<div class="md-why">' + r.why.map(esc).join(' · ') + '</div>' : '') + '</td>'
        + '</tr>';
    }).join('');
    return '<div class="md-scroll"><table class="md-tbl"><thead>' + head + '</thead><tbody>' + (body || '<tr><td colspan="10" class="mo-flat" style="text-align:center;padding:18px">沒有符合條件的廣告</td></tr>') + '</tbody></table></div>'
      + (list.length > view.limit ? '<div class="md-more"><button data-more="1">再顯示 30 則(共 ' + list.length + ' 則)</button></div>' : '');
  }

  function alertHtml() {
    var tired = rows.filter(function (r) { return r.fat != null && r.fat >= 60; }).sort(function (a, b) { return b.spend - a.spend; });
    var lose = rows.filter(function (r) { return r.losing; }).sort(function (a, b) { return b.spend - a.spend; });
    var items = [];
    tired.slice(0, 3).forEach(function (r) { items.push('<div><b>' + esc(r.name) + '</b> 疲乏 ' + r.fat + '(' + r.why.map(esc).join('、') + ')——準備接棒素材,或先放預熱活動。</div>'); });
    if (lose.length) {
      var lost = lose.reduce(function (s, r) { return s + r.spend; }, 0);
      items.push('<div>有 <b>' + lose.length + '</b> 則廣告 ROAS 低於 ' + (lose[0].be || 0).toFixed(2) + '(' + (parseFloat(M.state.cfg['margin_' + M.state.brand]) ? '損益兩平' : 'ROAS 目標') + '),共花了 ' + F.money(lost) + '。點上方「虧錢的」看是哪幾則。</div>');
    }
    if (!items.length) return '';
    return '<div class="mo-card"><div class="mo-h">現在該處理的廣告</div><div class="md-alert">' + items.join('') + '</div></div>';
  }

  function render(d) {
    var el = document.getElementById('mon-ads'); if (!el || !d) return;
    prep(d);
    var counts = {
      all: rows.length,
      tired: rows.filter(function (r) { return r.fat != null && r.fat >= 35; }).length,
      win: rows.filter(function (r) { return r.be ? r.roas >= r.be : r.roas >= 1; }).length,
      lose: rows.filter(function (r) { return r.losing; }).length,
      nosale: rows.filter(function (r) { return r.spend >= 500 && !r.purchases; }).length
    };
    var chips = [['all', '全部'], ['tired', '疲乏的'], ['win', '賺錢的'], ['lose', '虧錢的'], ['nosale', '花了錢沒成交']].map(function (c) {
      return '<button class="md-chip' + (view.filter === c[0] ? ' on' : '') + '" data-f="' + c[0] + '">' + c[1] + ' ' + counts[c[0]] + '</button>';
    }).join('');
    el.innerHTML = alertHtml()
      + '<div class="mo-card"><div class="mo-h">進行中的廣告 <small>' + rows.length + ' 則 · 關掉的不列 · 點欄位標題排序</small></div>'
      + '<div class="md-bar">' + chips + '<input class="md-search" id="md-q" placeholder="搜尋廣告 / 行銷活動名稱" value="' + esc(view.q) + '"></div>'
      + '<div id="md-tblwrap">' + tableHtml(filtered()) + '</div>'
      + '<div class="mo-note"><b>疲乏怎麼算:</b>看「近 3 天 vs 前 7 天」的變化,不是只看平均——點擊率掉 + CPM 漲 + 頻率高,三個一起出現就是同一群人看膩了。<b>≥60 該換素材、35~59 注意。</b>「上線」是廣告建立到今天幾天。'
      + '「虧錢的」= ROAS 低於' + (parseFloat(M.state.cfg['margin_' + d.brand]) ? '損益兩平點(總覽填的毛利率算出來)' : ' ROAS 目標(總覽填毛利率會改用損益兩平點)') + ',而且花費超過 NT$500。'
      + '<br>Meta 簡報提醒:舊素材分到大部分預算、新素材跑不動時,先用小預算預熱新素材(約 50 次轉換)再放進 ASC。</div></div>';
    bind(el);
  }
  function redrawTable() {
    var w = document.getElementById('md-tblwrap'); if (w) w.innerHTML = tableHtml(filtered());
  }
  function bind(el) {
    el.onclick = function (e) {
      var t = e.target.closest('[data-f],[data-k],[data-more]'); if (!t) return;
      if (t.dataset.f) { view.filter = t.dataset.f; view.limit = 30; if (M.state.data) render(M.state.data); return; }
      if (t.dataset.k) {
        var k = t.dataset.k; if (k === 'name') return;
        if (view.sort === k) view.dir = -view.dir; else { view.sort = k; view.dir = -1; }
        if (M.state.data) render(M.state.data); return;
      }
      if (t.dataset.more) { view.limit += 30; redrawTable(); }
    };
    var q = document.getElementById('md-q');
    if (q) q.oninput = function () { view.q = q.value; view.limit = 30; redrawTable(); };
  }
  function skeleton() {
    var el = document.getElementById('mon-ads'); if (!el) return;
    el.innerHTML = '<div class="mo-skel" style="height:260px"></div>';
  }

  injectCss();
  M.on('loading', skeleton);
  M.on('data', render);
  M.on('brand', function () { view.filter = 'all'; view.q = ''; view.limit = 30; });
  if (M.state.data) render(M.state.data);

  window.MON_ADS = { version: 'monitor-ads v1.0', render: render };
})();
