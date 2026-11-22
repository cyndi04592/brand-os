/* ══════════════════════════════════════════════════════════════
   Brand OS · monitor-recon.js · v1.0(2026-11-22)
   廣告監控頁「跟真實訂單對帳」:Meta 報的購買數 vs 真實訂單數 → Meta 多算了幾成;
   有一邊帳號關掉時,關掉前 7 天 vs 後 7 天:真正的訂單有沒有變多,還是只是功勞換一個帳號算。
   (老闆 11/22 16:02「小店的刀口」第 2 項;共用像素時兩個帳號會把同一筆訂單各算一次)
   資料:MON.recon()(Worker ads-monitor action 'recon',只讀 Meta、不改廣告)
        MON.ordersSet(rows)(action 'orders_set':把客戶後台的訂單數存起來;現在只有人工貼這一種來源)
   掛載點:<section id="mon-recon-sec"><div id="mon-recon"></div></section>
   - Worker 還沒有這個動作、讀不到、或品牌目標不是購買 → 整段不顯示,不擋其他區塊
   - 網址加 ?rcdemo=1 → 用寫死的示範數字畫一次(畫面會標「示範資料」,只給驗收截圖用)
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (!window.MON) { console.error('[recon] 要先載 monitor-data.js'); return; }
  var M = window.MON, F = M.fmt;
  var DEMO = /[?&]rcdemo=1/.test(location.search);

  var CSS = ''
    + '#mon-recon{min-width:0;max-width:100%}.rc-card{box-sizing:border-box;max-width:100%;overflow:hidden;border-radius:14px;padding:14px 16px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08)}'
    + '.rc-card.red{border-color:rgba(250,109,155,0.55);background:rgba(250,109,155,0.07)}'
    + '.rc-card.yellow,.rc-card.need{border-color:rgba(250,200,90,0.5);background:rgba(250,200,90,0.06)}'
    + '.rc-head{display:flex;gap:10px;align-items:flex-start}'
    + '.rc-dot{flex:0 0 12px;width:12px;height:12px;border-radius:50%;margin-top:5px;background:#6DFAC2}'
    + '.red .rc-dot,.rc-dot.red{background:#FA6D9B;box-shadow:0 0 10px #FA6D9B}.yellow .rc-dot,.need .rc-dot,.rc-dot.yellow,.rc-dot.need{background:#FAC85A;box-shadow:none}.rc-dot.green{background:#6DFAC2;box-shadow:none}'
    + '.rc-say{font-size:14px;font-weight:700;line-height:1.7;color:var(--t1,#fff);min-width:0}'
    + '.rc-demo{display:inline-block;font-size:11px;font-weight:700;color:#111;background:#FAC85A;border-radius:6px;padding:1px 7px;margin-right:6px}'
    + '.rc-kpis{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;margin:14px 0 4px}'
    + '.rc-kpi{background:rgba(255,255,255,0.04);border-radius:11px;padding:10px 12px;min-width:0}'
    + '.rc-kpi .t{font-size:12px;color:var(--t3,#8a8aa0)}.rc-kpi .v{font-size:18px;font-weight:800;color:var(--t1,#fff);margin-top:2px}'
    + '.rc-kpi .s{font-size:12px;color:var(--t2,#c8c8d8);margin-top:2px;line-height:1.5}'
    + '.rc-h{font-size:13px;font-weight:700;color:var(--t1,#fff);margin:18px 0 0}'
    + '.rc-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch;margin-top:8px}'
    + '.rc-tbl{width:100%;border-collapse:collapse;font-size:12.5px}'
    + '.rc-tbl th{text-align:right;font-weight:600;color:var(--t3,#8a8aa0);padding:7px 8px;border-bottom:1px solid rgba(255,255,255,0.08);white-space:nowrap}'
    + '.rc-tbl td{text-align:right;padding:8px;border-bottom:1px solid rgba(255,255,255,0.04);color:var(--t2,#c8c8d8);white-space:nowrap;font-variant-numeric:tabular-nums}'
    + '.rc-tbl th:first-child,.rc-tbl td:first-child{text-align:left;white-space:normal;min-width:110px}'
    + '.rc-tbl tr.sum td{font-weight:800;color:var(--t1,#fff)}'
    + '.rc-note{font-size:12px;color:var(--t3,#8a8aa0);line-height:1.7;margin-top:10px}'
    + '.rc-in{margin-top:14px;border-top:1px solid rgba(255,255,255,0.08);padding-top:10px}'
    + '.rc-in summary{cursor:pointer;font-size:13px;font-weight:700;color:var(--t1,#fff);min-height:44px;display:flex;align-items:center}'
    + '.rc-in textarea{box-sizing:border-box;width:100%;min-height:120px;border-radius:10px;border:1px solid rgba(255,255,255,0.15);background:rgba(0,0,0,0.25);color:var(--t1,#fff);padding:10px;font-size:14px;font-family:inherit;line-height:1.6}'
    + '.rc-row{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-top:10px}'
    + '.rc-btn{min-height:44px;padding:0 18px;border-radius:11px;border:0;background:#7C6DFA;color:#fff;font-size:14px;font-weight:700;cursor:pointer}'
    + '.rc-btn.ghost{background:rgba(255,255,255,0.08)}.rc-btn:disabled{opacity:.5;cursor:default}'
    + '.rc-in input[type=date]{min-height:44px;border-radius:10px;border:1px solid rgba(255,255,255,0.15);background:rgba(0,0,0,0.25);color:var(--t1,#fff);padding:0 10px;font-size:14px}'
    + '.rc-msg{font-size:13px;color:var(--t2,#c8c8d8);line-height:1.6}';
  function css() {
    if (document.getElementById('rc-css')) return;
    var s = document.createElement('style'); s.id = 'rc-css'; s.textContent = CSS; document.head.appendChild(s);
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function num(n) { return n == null ? '—' : String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function md(d) { return d ? d.slice(5).replace('-', '/') : ''; }
  function pct(p) { return p == null ? '' : '(' + (p >= 0 ? '+' : '') + p + '%)'; }

  //  貼進來的文字 → 列。一行一筆:「2026-11-01, 12」「11/1 12」或一段日期的總數「11/1~11/7 85」
  function p2(n) { return (n < 10 ? '0' : '') + n; }
  function oneDate(s, today) {
    var m = s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})$/);
    if (m) return m[1] + '-' + p2(+m[2]) + '-' + p2(+m[3]);
    m = s.match(/^(\d{1,2})[-\/.](\d{1,2})$/);
    if (!m) return '';
    var y = +today.slice(0, 4), d = y + '-' + p2(+m[1]) + '-' + p2(+m[2]);
    return d > today ? (y - 1) + d.slice(4) : d;
  }
  function parse(text, today) {
    var rows = [], bad = [];
    String(text || '').split(/\r?\n/).forEach(function (ln) {
      ln = ln.replace(/[,，、\t]/g, ' ').replace(/[～〜至到]/g, '~').replace(/\s*~\s*/g, '~').replace(/單|筆/g, '').trim();
      if (!ln) return;
      var p = ln.split(/\s+/);
      var n = p.length >= 2 ? p[p.length - 1] : '';
      if (!/^\d{1,7}$/.test(n)) { bad.push(ln); return; }
      var dd = p[0].split('~'), a = oneDate(dd[0], today), b = dd[1] ? oneDate(dd[1], today) : '';
      if (!a || (dd[1] && (!b || b < a))) { bad.push(ln); return; }
      rows.push(b ? { from: a, to: b, n: +n } : { date: a, n: +n });
    });
    return { rows: rows, bad: bad };
  }

  function demoData() {
    return { ok: true, demo: true, since: '2026-11-08', until: '2026-11-14', light: 'green',
      sentence: 'Meta 報了 41 單,實際 62 單(Meta 認領了 66%)。沒有超過真實訂單,總數上看不出多算。每張真實訂單攤到的廣告費是 129 元。',
      over: { meta: 41, real: 62, nAcc: 1, spend: 8000, metaCpa: 195, realCpo: 129, overPct: null, sharePct: 66 },
      accounts: [{ name: '示範:這個帳號', mine: true, spend: 8000, meta: 41 }], sharedN: 1,
      beforeAfter: { cut: '2026-11-07', complete: true, light: 'green', closedName: '示範:品牌自己另外開的帳號', realPct: 24, spendPct: -33, metaPct: -47, cpoBefore: 240, cpoAfter: 129,
        sentence: '真實訂單從 50 單變 62 單(+24%),廣告費從 12000 變 8000。是真的變多,不只是功勞換一個帳號算。每張真實訂單的廣告費從 240 元變 129 元。',
        before: { since: '2026-11-01', until: '2026-11-07', spend: 12000, meta: 77, metaMine: 42, real: 50 },
        after: { since: '2026-11-08', until: '2026-11-14', spend: 8000, meta: 41, metaMine: 41, real: 62 } },
      orders: { source: '人工貼進來', dayCount: 0, rangeCount: 2, last: '' },
      notes: ['真實訂單包含不是廣告帶來的,所以 Meta 加總超過真實訂單才算「一定多算」', '只加得到系統帳號看得到、共用同一個像素的廣告帳號(掃了 12 個)', 'Meta 的購買和真實訂單記在哪一天會差一兩天;7 天的比較只能看方向'] };
  }

  var cutPick = '';
  function draw(j) {
    var sec = document.getElementById('mon-recon-sec'), box = document.getElementById('mon-recon');
    if (!sec || !box) return;
    if (!j || !j.ok || j.light === 'na') { sec.style.display = 'none'; return; }
    css(); sec.style.display = '';
    var o = j.over || {}, h = '<div class="rc-card ' + esc(j.light) + '"><div class="rc-head"><span class="rc-dot"></span><div class="rc-say">'
      + (j.demo ? '<span class="rc-demo">示範資料</span>' : '') + esc(j.sentence) + '</div></div>';
    h += '<div class="rc-kpis">'
      + '<div class="rc-kpi"><div class="t">Meta 報的購買</div><div class="v">' + num(o.meta) + ' 單</div><div class="s">' + (o.nAcc >= 2 ? o.nAcc + ' 個共用像素的帳號加起來' : '這個廣告帳號') + ';' + md(j.since) + '~' + md(j.until) + '</div></div>'
      + '<div class="rc-kpi"><div class="t">真實訂單</div><div class="v">' + (o.real == null ? '還沒填' : num(o.real) + ' 單') + '</div><div class="s">' + (j.orders && j.orders.source ? '來源:' + esc(j.orders.source) : '在下面「填真實訂單數」貼進來') + '</div></div>'
      + '<div class="rc-kpi"><div class="t">' + (o.overPct != null ? 'Meta 多算' : 'Meta 認領') + '</div><div class="v">' + (o.overPct != null ? '+' + o.overPct + '%' : o.sharePct != null ? o.sharePct + '%' : '—') + '</div><div class="s">' + (o.overPct != null ? '至少;真實訂單還含自然單' : o.sharePct != null ? '真實訂單裡 Meta 說是它帶來的' : '填了真實訂單才算得出來') + '</div></div>'
      + '<div class="rc-kpi"><div class="t">每張真實訂單的廣告費</div><div class="v">' + (o.realCpo ? F.money(o.realCpo) : '—') + '</div><div class="s">Meta 自己算的每單成本 ' + (o.metaCpa ? F.money(o.metaCpa) : '—') + '</div></div>'
      + '</div>';
    var ac = j.accounts || [];
    if (ac.length >= 2) {
      h += '<div class="rc-scroll"><table class="rc-tbl"><tr><th>共用同一個像素的廣告帳號</th><th>這段花費</th><th>Meta 報的購買</th></tr>'
        + ac.map(function (a) { return '<tr><td>' + esc(a.name || a.account) + (a.mine ? '<br><small>監控的這個帳號</small>' : '') + (a.readFail ? '<br><small>數字讀不到</small>' : '') + '</td><td>' + F.money(a.spend) + '</td><td>' + num(a.meta) + ' 單</td></tr>'; }).join('')
        + '<tr class="sum"><td>加起來</td><td>' + F.money(o.spend) + '</td><td>' + num(o.meta) + ' 單</td></tr>'
        + '<tr class="sum"><td>真實訂單</td><td></td><td>' + (o.real == null ? '還沒填' : num(o.real) + ' 單') + '</td></tr></table></div>';
    }
    var b = j.beforeAfter;
    if (b) {
      h += '<div class="rc-h">關掉一邊的前後 7 天' + (b.closedName ? '(' + esc(b.closedName) + ' ' + md(b.cut) + ' 之後沒有花費)' : '(以 ' + md(b.cut) + ' 為界' + (b.manual ? ',手動指定' : '') + ')') + '</div>'
        + '<div class="rc-head" style="margin-top:8px"><span class="rc-dot ' + esc(b.light) + '"></span><div class="rc-say" style="font-size:13px">' + esc(b.sentence) + '</div></div>';
      if (b.before && b.after) {
        var row = function (t, x, y, p, money) { var f = money ? F.money : function (v) { return v == null ? '還沒填' : num(v) + ' 單'; }; return '<tr><td>' + t + '</td><td>' + f(x) + '</td><td>' + f(y) + '</td><td>' + (x == null || y == null ? '—' : pct(p).replace(/[()]/g, '') || '—') + '</td></tr>'; };
        h += '<div class="rc-scroll"><table class="rc-tbl"><tr><th></th><th>前 7 天<br>' + md(b.before.since) + '~' + md(b.before.until) + '</th><th>後 ' + (b.complete ? 7 : b.after.days) + ' 天<br>' + md(b.after.since) + '~' + md(b.after.until) + '</th><th>變化</th></tr>'
          + row('廣告費(兩邊加起來)', b.before.spend, b.after.spend, b.spendPct, 1)
          + row('Meta 報的購買(兩邊加起來)', b.before.meta, b.after.meta, b.metaPct)
          + row('其中留下來的這個帳號', b.before.metaMine, b.after.metaMine, b.before.metaMine ? Math.round((b.after.metaMine / b.before.metaMine - 1) * 100) : null)
          + '<tr class="sum"><td>真實訂單</td><td>' + (b.before.real == null ? '還沒填' : num(b.before.real) + ' 單') + '</td><td>' + (b.after.real == null ? '還沒填' : num(b.after.real) + ' 單') + '</td><td>' + (b.realPct == null ? '—' : (b.realPct >= 0 ? '+' : '') + b.realPct + '%') + '</td></tr>'
          + (b.cpoBefore ? row('每張真實訂單的廣告費', b.cpoBefore, b.cpoAfter, b.cpoBefore ? Math.round((b.cpoAfter / b.cpoBefore - 1) * 100) : null, 1) : '')
          + '</table></div>';
      }
    }
    if (j.notes) h += '<div class="rc-note">' + j.notes.map(esc).join(';') + '。</div>';
    //  填真實訂單數
    h += '<details class="rc-in"' + (o.real == null || (b && b.light === 'need' && b.complete) ? ' open' : '') + '><summary>填真實訂單數(客戶後台的訂單數)'
      + (j.orders && (j.orders.dayCount || j.orders.rangeCount) ? '・已有 ' + j.orders.dayCount + ' 天' + (j.orders.rangeCount ? '＋' + j.orders.rangeCount + ' 段總數' : '') : '') + '</summary>'
      + '<div class="rc-msg">一行一筆,日期和單數中間空一格。可以填每天的:<b>11/1 12</b>;也可以只填一段日期的總數:<b>11/1~11/7 85</b>。同一天再填一次會蓋掉舊的。只存單數,不存客人資料。</div>'
      + '<textarea id="rc-text" placeholder="11/1~11/7 50&#10;11/8~11/14 62"></textarea>'
      + '<div class="rc-row"><button class="rc-btn" id="rc-save">存起來並重算</button><span class="rc-msg" id="rc-out"></span></div>'
      + '<div class="rc-row"><span class="rc-msg">系統找不到或找錯「哪一天關掉」時,自己指定:</span><input type="date" id="rc-cut" value="' + esc(cutPick) + '"><button class="rc-btn ghost" id="rc-cutgo">用這一天比前後 7 天</button></div>'
      + '</details></div>';
    box.innerHTML = h;
    var sv = document.getElementById('rc-save'), out = document.getElementById('rc-out');
    if (sv) sv.onclick = function () {
      var p = parse(document.getElementById('rc-text').value, new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10));
      if (!p.rows.length) { out.textContent = '沒有讀到可以存的列' + (p.bad.length ? ';看不懂:' + p.bad.slice(0, 3).join(' / ') : '') + '。'; return; }
      if (DEMO) { out.textContent = '示範畫面不會真的存(讀到 ' + p.rows.length + ' 列' + (p.bad.length ? '、看不懂 ' + p.bad.length + ' 列' : '') + ')。'; return; }
      sv.disabled = true; out.textContent = '存檔中…';
      M.ordersSet(p.rows).then(function (r) {
        sv.disabled = false;
        if (!r || !r.ok) { out.textContent = (r && r.error) || '沒存成功,請再試一次。'; return; }
        out.textContent = '存了 ' + r.saved + ' 列' + (p.bad.length ? ';看不懂沒存的:' + p.bad.slice(0, 3).join(' / ') : '') + '。重算中…';
        last = ''; run();
      });
    };
    var cg = document.getElementById('rc-cutgo');
    if (cg) cg.onclick = function () { cutPick = document.getElementById('rc-cut').value || ''; if (DEMO) return; last = ''; run(); };
  }

  var last = '';
  function run() {
    if (DEMO) { draw(demoData()); return; }
    var k = M.state.brand + '|' + JSON.stringify(M.state.range || {}) + '|' + cutPick;
    if (k === last) return;
    last = k;
    M.recon(cutPick).then(function (j) { if (k === last) draw(j); }).catch(function () { draw(null); });
  }
  M.on('data', run);
  if (DEMO) { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run(); }

  window.MON_RECON = { version: 'monitor-recon v1.0', draw: draw, parse: parse };
})();
