/* ══════════════════════════════════════════════════════════════
   Brand OS · monitor-overlap.js · v1.0(2026-11-22)
   廣告監控頁「帳號互搶」:同一個像素 / 粉專在兩個以上廣告帳號同時投放、受眾重疊 → 亮燈。
   (老闆 11/22 16:02「小店的刀口」;巧福案例:關掉重複的那個帳號後花費變少、轉單變多)
   資料:MON.overlap()(Worker ads-monitor v2.8 action 'overlap',只讀 Meta、不改廣告)
   掛載點:<section id="mon-overlap-sec"><div id="mon-overlap"></div></section>
   - Worker 還沒上 v2.8(回「不認得的動作」)或讀不到 → 整段不顯示,不擋其他區塊
   - 綠燈只出一行;紅 / 黃才展開對照表
   - 網址加 ?ovdemo=1 → 用寫死的示範數字畫一次(畫面會標「示範資料」,只給驗收截圖用)
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (!window.MON) { console.error('[overlap] 要先載 monitor-data.js'); return; }
  var M = window.MON, F = M.fmt;
  var DEMO = /[?&]ovdemo=1/.test(location.search);

  var CSS = ''
    + '#mon-overlap{min-width:0;max-width:100%}.ov-card{box-sizing:border-box;max-width:100%;overflow:hidden;border-radius:14px;padding:14px 16px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08)}'
    + '.ov-card.red{border-color:rgba(250,109,155,0.55);background:rgba(250,109,155,0.07)}'
    + '.ov-card.yellow{border-color:rgba(250,200,90,0.5);background:rgba(250,200,90,0.06)}'
    + '.ov-head{display:flex;gap:10px;align-items:flex-start}'
    + '.ov-dot{flex:0 0 12px;width:12px;height:12px;border-radius:50%;margin-top:5px;background:#6DFAC2}'
    + '.red .ov-dot{background:#FA6D9B;box-shadow:0 0 10px #FA6D9B}.yellow .ov-dot{background:#FAC85A}'
    + '.ov-say{font-size:14px;font-weight:700;line-height:1.7;color:var(--t1,#fff)}'
    + '.ov-demo{display:inline-block;font-size:11px;font-weight:700;color:#111;background:#FAC85A;border-radius:6px;padding:1px 7px;margin-right:6px}'
    + '.ov-kpis{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin:14px 0 4px}'
    + '.ov-kpi{background:rgba(255,255,255,0.04);border-radius:11px;padding:10px 12px}'
    + '.ov-kpi .t{font-size:12px;color:var(--t3,#8a8aa0)}.ov-kpi .v{font-size:18px;font-weight:800;color:var(--t1,#fff);margin-top:2px}'
    + '.ov-kpi .s{font-size:12px;color:var(--t2,#c8c8d8);margin-top:2px;line-height:1.5}'
    + '.ov-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch;margin-top:10px}'
    + '.ov-tbl{width:100%;border-collapse:collapse;font-size:12.5px}'
    + '.ov-tbl th{text-align:right;font-weight:600;color:var(--t3,#8a8aa0);padding:7px 8px;border-bottom:1px solid rgba(255,255,255,0.08);white-space:nowrap}'
    + '.ov-tbl td{text-align:right;padding:8px;border-bottom:1px solid rgba(255,255,255,0.04);color:var(--t2,#c8c8d8);white-space:nowrap;font-variant-numeric:tabular-nums}'
    + '.ov-tbl th:first-child,.ov-tbl td:first-child{text-align:left;white-space:normal;min-width:120px}'
    + '.ov-bars{display:flex;align-items:flex-end;gap:2px;height:64px;margin-top:12px}'
    + '.ov-bars span{flex:1;display:flex;flex-direction:column;justify-content:flex-end;gap:1px;height:100%}'
    + '.ov-bars i{display:block;border-radius:2px 2px 0 0;background:#7C6DFA;min-height:0}.ov-bars i.r{background:#FA6D9B}'
    + '.ov-leg{font-size:12px;color:var(--t3,#8a8aa0);margin-top:6px}'
    + '.ov-leg b{display:inline-block;width:9px;height:9px;border-radius:2px;margin:0 4px 0 10px;vertical-align:middle}'
    + '.ov-note{font-size:12px;color:var(--t3,#8a8aa0);line-height:1.7;margin-top:10px}'
    + '.ov-card.gray{border-color:rgba(160,160,180,0.45)}.gray .ov-dot{background:#8a8aa0}'
    + '.ov-auto{margin-top:12px;padding-top:10px;border-top:1px dashed rgba(255,255,255,0.1)}.ov-auto-t{font-size:12px;font-weight:700;color:var(--t2,#c8c8d8);margin-bottom:4px}'
    + '.ov-al{display:flex;gap:8px;align-items:flex-start;font-size:13px;line-height:1.7;color:var(--t2,#c8c8d8);margin:3px 0}.ov-al i{flex:0 0 9px;width:9px;height:9px;border-radius:50%;margin-top:7px}'
    + '.ov-shot{display:block;max-width:100%;width:360px;margin-top:8px;border-radius:8px;border:1px solid rgba(255,255,255,0.1)}'
    + '.ov-partner{margin-top:8px;font-size:12.5px;color:var(--t2,#c8c8d8);line-height:1.7}.ov-partner summary{cursor:pointer}.ov-partner ol{margin:4px 0 0 20px;padding:0}';
  function css() {
    if (document.getElementById('ov-css')) return;
    var s = document.createElement('style'); s.id = 'ov-css'; s.textContent = CSS; document.head.appendChild(s);
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var AUD = { high: '高', mid: '中', low: '低', none: '沒有重疊', unknown: '判斷不出來' };

  function demoData() {
    var daily = [], i, d;
    for (i = 0; i < 28; i++) {
      d = new Date(Date.UTC(2026, 9, 26 + i)).toISOString().slice(0, 10);
      daily.push({ date: d, mine: i < 14 ? 620 : 410, rival: i < 14 ? 480 : 0, cpm: i < 14 ? 310 : 215 });
    }
    return { ok: true, demo: true, light: 'red',
      sentence: '兩邊在搶同一批人,建議合併成一個帳號,或分開受眾。兩邊同時投的日子,這個帳號的 CPM 比自己單獨投的日子貴 44%。',
      mine: { spend: 2870, frequency: 2.1, cpm: 215 },
      rivals: [{ name: '示範:品牌自己另外開的帳號', via: ['像素'], live: true, audience: 'high', audienceWhy: '兩邊都是同國家的廣泛受眾', bothDays: 14, spend: 0, frequency: 0, cpm: 0 }],
      compare: { bothDays: 14, soloDays: 14, cpmBoth: 310, cpmSolo: 215, enough: true, diffPct: 44 }, daily: daily, hidden: [], scanned: 12,
      auto: { method: 'count', lines: [
        { k: 'adlib', light: 'red', text: '這個品牌粉專上有 2 則廣告不是從我們帳號投的,從 11/12 開始(廣告檔案庫刊登中 5 則、我們帳號 3 則)。' }],
        adlib: { status: 'found', cpm: { before: 215, after: 310, pct: 44 } },
        series: (function () { var o = []; for (var i = 0; i < 28; i++) { var dd = new Date(Date.UTC(2026, 9, 26 + i)).toISOString().slice(0, 10), on = dd >= '2026-11-12'; o.push({ d: dd, lib: on ? 5 : 3, ours: 3, diff: on ? 2 : 0, src: i > 25 ? 'snap' : 'back', cpm: on ? 310 : 215 }); } return o; })(),
        partnerTip: '請客戶把像素以「夥伴」身分分享給芮比的企業管理平台(只要檢視權限)。加了之後,系統就能直接讀到這個像素還分享給哪些帳號、對方什麼時候在投,不用再猜。',
        partnerSteps: ['用管理員身分登入客戶自己的企業管理平台,左邊選「企業設定」。', '「資料來源」→「資料集」,點這個品牌網站用的那一個。', '按「指派合作夥伴」,輸入芮比企業管理平台編號。', '權限只勾「檢視」,按確認。', '完成後跟芮比說一聲。'] },
      notes: ['受眾重疊是照受眾設定推估,Meta 不提供跨帳號實際重疊人數', '頻率是各帳號自己算的,同一個人被兩邊各打幾次不會合併', '只掃得到系統帳號有權限的廣告帳號(這次掃了 12 個)'] };
  }

  function draw(j) {
    var sec = document.getElementById('mon-overlap-sec'), box = document.getElementById('mon-overlap');
    if (!sec || !box) return;
    if (!j || !j.ok || j.light === 'unknown') { sec.style.display = 'none'; return; }
    css(); sec.style.display = '';
    var h = '<div class="ov-card ' + esc(j.light) + '"><div class="ov-head"><span class="ov-dot"></span><div class="ov-say">'
      + (j.demo ? '<span class="ov-demo">示範資料</span>' : '') + esc(j.sentence) + '</div></div>';
    var rv = j.rivals || [], c = j.compare;
    if (rv.length && c) {
      h += '<div class="ov-kpis">'
        + '<div class="ov-kpi"><div class="t">同一天都在投</div><div class="v">' + c.bothDays + ' 天</div><div class="s">近 28 天;只有這個帳號在投 ' + c.soloDays + ' 天</div></div>'
        + '<div class="ov-kpi"><div class="t">CPM:同時投的日子</div><div class="v">' + (c.cpmBoth ? F.money(c.cpmBoth) : '—') + '</div><div class="s">單獨投的日子 ' + (c.cpmSolo ? F.money(c.cpmSolo) : '—')
        + (c.enough ? '(' + (c.diffPct >= 0 ? '貴 ' : '便宜 ') + Math.abs(c.diffPct) + '%)' : '(天數不夠,先不比)') + '</div></div>'
        + '<div class="ov-kpi"><div class="t">頻率:這個帳號</div><div class="v">' + (j.mine && j.mine.frequency ? j.mine.frequency.toFixed(2) : '—') + '</div><div class="s">'
        + rv.filter(function (r) { return r.frequency; }).map(function (r) { return esc(r.name) + ' ' + r.frequency.toFixed(2); }).join('、')
        + (rv.some(function (r) { return r.frequency; }) ? ';同一個人兩邊各算各的' : '另一邊這段期間沒有投') + '</div></div>'
        + '</div>';
      h += '<div class="ov-scroll"><table class="ov-tbl"><tr><th>共用的廣告帳號</th><th>共用什麼</th><th>受眾重疊</th><th>同時投</th><th>這段花費</th><th>CPM</th><th>頻率</th></tr>'
        + rv.map(function (r) {
          return '<tr><td>' + esc(r.name || r.account) + (r.inBrandOs ? '<br><small>監控裡的「' + esc(r.inBrandOs) + '」</small>' : '') + (r.readFail ? '<br><small>數字讀不到</small>' : '') + '</td>'
            + '<td>' + esc((r.via || []).join('＋')) + '</td>'
            + '<td title="' + esc(r.audienceWhy) + '">' + (AUD[r.audience] || '—') + '<br><small>' + esc(r.audienceWhy) + '</small></td>'
            + '<td>' + r.bothDays + ' 天</td><td>' + F.money(r.spend) + '</td><td>' + (r.cpm ? F.money(r.cpm) : '—') + '</td><td>' + (r.frequency ? r.frequency.toFixed(2) : '—') + '</td></tr>';
        }).join('') + '</table></div>';
      var dl = j.daily || [], mx = 1;
      dl.forEach(function (d) { mx = Math.max(mx, d.mine + d.rival); });
      if (dl.length) {
        h += '<div class="ov-bars">' + dl.map(function (d) {
          return '<span title="' + d.date + ' 這個帳號 ' + d.mine + '、另一邊 ' + d.rival + '、CPM ' + d.cpm + '"><i class="r" style="height:' + (d.rival / mx * 100).toFixed(1) + '%"></i><i style="height:' + (d.mine / mx * 100).toFixed(1) + '%"></i></span>';
        }).join('') + '</div><div class="ov-leg">近 28 天每日花費<b style="background:#7C6DFA"></b>這個帳號<b style="background:#FA6D9B"></b>共用的另一邊</div>';
      }
    }
    if (j.hidden && j.hidden.length) {
      h += '<div class="ov-note">這個像素還分享給我們看不到的帳號:' + j.hidden.map(function (x) { return esc(x.name || x.id); }).join('、') + '</div>';
    }
    if (j.light !== 'green' && j.notes) h += '<div class="ov-note">' + j.notes.map(esc).join(';') + '。為什麼會搶:同一個粉專的廣告要進同一場拍賣時,Meta 只留一則,其他不參加。</div>';
    /* 老闆 11/22 20:52:固定說明,綠燈也要顯示,不要讓客戶以為什麼都看得到 */
    h += autoHtml(j.auto);   /* 交代 2108:三層自動判讀(廣告檔案庫/像素事件/成本)+ 夥伴分享步驟 */
    h += '<div class="ov-note ov-msig" id="ov-msig"></div>';   /* 交代 2109:Meta 自己的拍賣重疊訊號,由 msig() 填 */
    h += '<div class="ov-note ov-scope">這一區只看得到我們有權限的帳號和公開資料,客戶自己另外投的廣告不一定抓得到。</div>';
    h += '</div>';
    box.innerHTML = h;
    msig();
  }

  //  三層自動判讀(交代 2108,資料在 Worker autodetect.js):每層一個燈+一句;廣告檔案庫抓到的列前幾則+截圖;夥伴分享步驟收在 details
  var LDOT = { red: '#FA6D9B', yellow: '#FAC85A', green: '#6DFAC2', gray: '#8a8aa0' };
  function autoHtml(a) {
    if (!a || !a.lines) return '';
    var h = '<div class="ov-auto"><div class="ov-auto-t">自動判讀(每天一次)</div>' + a.lines.map(function (l) {
      return '<div class="ov-al"><i style="background:' + (LDOT[l.light] || LDOT.gray) + '"></i><span>' + esc(l.text) + '</span></div>';
    }).join('');
    h += cntChart(a.series, a.adlib || {});   /* 交代 2110:廣告檔案庫數量差值線 × 我們的 CPM */    var ad = a.adlib || {};
    if (ad.status === 'found' && ad.notOurs && ad.notOurs.length) {
      h += '<div class="ov-scroll"><table class="ov-tbl"><tr><th>不是我們投的廣告</th><th>開始刊登</th><th>幾則</th></tr>' + ad.notOurs.map(function (c) {
        return '<tr><td>' + esc(c.text || '(只有圖或影片)') + (c.adv ? '<br><small>' + esc(c.adv) + ' · 檔案庫編號 ' + esc(c.id) + '</small>' : '') + '</td><td>' + esc(c.start || '—') + '</td><td>' + (c.n || 1) + '</td></tr>';
      }).join('') + '</table></div>';
      if (ad.shot) h += '<a href="' + esc(ad.shot) + '" target="_blank" rel="noopener"><img class="ov-shot" src="' + esc(ad.shot) + '" alt="廣告檔案庫截圖"></a>';
    }
    if (a.partnerTip) {
      h += '<details class="ov-partner"><summary>' + esc(a.partnerTip) + '</summary><ol>' + (a.partnerSteps || []).map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol></details>';
    }
    return h + '</div>';
  }

  //  交代 2110:差值(檔案庫刊登中 − 我們帳號)每天一根柱子,疊我們的 CPM 線;虛線框＝往回推的(下限)
  function cntChart(s, ad) {
    if (!s || !s.length || !s.some(function (x) { return x.diff != null; })) return '';
    var W = 600, H = 120, P = 18, n = s.length, bw = (W - 2 * P) / n;
    var dmax = Math.max(1, Math.max.apply(null, s.map(function (x) { return x.diff || 0; })));
    var cp = s.map(function (x) { return x.cpm || 0; }), cmax = Math.max.apply(null, cp) || 1;
    var g = '';
    s.forEach(function (x, i) {
      if (x.diff == null) return;
      var v = Math.max(0, x.diff), bh = v / dmax * (H - 2 * P), X = P + i * bw + 1, Y = H - P - bh;
      g += '<rect x="' + X.toFixed(1) + '" y="' + Y.toFixed(1) + '" width="' + Math.max(1, bw - 2).toFixed(1) + '" height="' + Math.max(v ? 2 : 0, bh).toFixed(1) + '" fill="' + (v ? '#FA6D9B' : '#6DFAC2') + '" opacity="' + (x.src === 'snap' ? 0.95 : 0.5) + '"><title>' + esc(x.d) + ' 檔案庫 ' + x.lib + '、我們 ' + x.ours + '、差 ' + x.diff + (x.src === 'back' ? '(往回推,下限)' : '') + (x.cpm ? '、CPM ' + x.cpm : '') + '</title></rect>';
    });
    var pts = s.map(function (x, i) { return x.cpm ? (P + i * bw + bw / 2).toFixed(1) + ',' + (H - P - x.cpm / cmax * (H - 2 * P)).toFixed(1) : null; }).filter(Boolean);
    if (pts.length > 1) g += '<polyline points="' + pts.join(' ') + '" fill="none" stroke="#4FA8FF" stroke-width="1.6"/>';
    g += '<text x="' + P + '" y="' + (H - 4) + '" font-size="10" fill="#8a8aa0">' + esc(s[0].d.slice(5)) + '</text><text x="' + (W - P) + '" y="' + (H - 4) + '" font-size="10" fill="#8a8aa0" text-anchor="end">' + esc(s[n - 1].d.slice(5)) + '</text>';
    var cap = '<div style="font-size:11px;color:var(--t2,#a8a8c0);margin-top:2px">粉紅柱＝別的帳號在跑的則數(廣告檔案庫刊登中 − 我們帳號);藍線＝我們的 CPM。淡色＝用現在還在跑的廣告往回推的,只是下限。'
      + (ad.cpm && ad.cpm.pct != null ? ' 對方開始投之後 7 天我們的 CPM ' + ad.cpm.before + ' → ' + ad.cpm.after + '(' + (ad.cpm.pct >= 0 ? '+' : '') + ad.cpm.pct + '%,只是對照、不當證據)。' : '') + '</div>';
    return '<div class="ov-scroll"><svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;min-width:320px;height:auto;display:block" role="img" aria-label="廣告檔案庫數量差值">' + g + '</svg>' + cap + '</div>';
  }
  //  Meta 自己的拍賣重疊訊號(交代 2109):找到＝最準的紅燈;沒找到＝照實說 API 拿不到、請問 Meta 直客代表;Worker 沒這個動作＝不顯示
  function msigDraw(m) {
    var el = document.getElementById('ov-msig');
    if (!el) return;
    if (!m) { el.style.display = 'none'; return; }
    el.style.display = '';
    var h = 'ℹ️ ' + esc(m.sentence);   /* 交代 2110:Meta 建議只當參考,不亮紅燈 */
    if (m.hits && m.hits.length) {
      h += '<ul style="margin:4px 0 0 18px;padding:0">' + m.hits.slice(0, 6).map(function (x) {
        return '<li>' + esc(x.name || x.id) + ':' + esc(x.title || x.code || '') + ' ' + esc(x.message || '') + '</li>';
      }).join('') + '</ul>';
    }
    el.innerHTML = h;
  }
  function msig() {
    if (DEMO) { msigDraw({ light: 'none', sentence: 'Meta 開放給 API 的建議、問題裡沒有提到拍賣重疊。Meta 內部的跨帳號重疊資料不開放 API,要確認請問 Meta 直客代表。(示範)', hits: [] }); return; }
    if (!M.metaSignals) { msigDraw(null); return; }
    var b = M.state.brand;
    M.metaSignals().then(function (m) { if (M.state.brand === b) msigDraw(m); }).catch(function () { msigDraw(null); });
  }

  var last = '';
  function run() {
    if (DEMO) { draw(demoData()); return; }
    var k = M.state.brand + '|' + JSON.stringify(M.state.range || {});
    if (k === last) return;
    last = k;
    M.overlap().then(function (j) { if (k === last) draw(j); }).catch(function () { draw(null); });
  }
  M.on('data', run);
  if (DEMO) { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run(); }

  window.MON_OVERLAP = { version: 'monitor-overlap v1.0', draw: draw };
})();
