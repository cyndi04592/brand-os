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
    + '.ov-note{font-size:12px;color:var(--t3,#8a8aa0);line-height:1.7;margin-top:10px}';
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
    h += '</div>';
    box.innerHTML = h;
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
