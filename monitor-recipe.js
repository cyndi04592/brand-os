/* v1.3(2026-11-24 交代 0126／0215:燈號改單日、系統自動判斷疑似被搶開始／結束;3 天平均只當參考;?rpdemo=5 自動已結束、6 自動還在被搶)
 monitor-recipe.js v1.2(2026-11-24,交代 20261124-0120:老闆按「對方已停」→ 互搶收進過去紀錄、之後成本沒回來改藍色「互搶已結束，成本還沒回來」;每天一列多列單日實際值;Worker v2.14)
   v1.1(2026-11-23,交代 20261123-1525:對方關掉後卡片要會顯示「回穩中／已結束」;Worker v2.13 cpmrecipe v2.3 的 status、today)
   v1.0(2026-11-23,交代 20261123-0210 第 3 件:「互搶區看不到配方結果」)
   資料:MON.cpmRecipe()(Worker action cpm_recipe,cpmrecipe.js;只讀 Meta、不改廣告)
   放在「帳號互搶」區、互搶卡下面一張「成本異常配方(跟大盤比)」卡:
     1. 一句白話:最新一天的燈號＋配方自己寫的說明(紅燈＝疑似被搶、黃燈＝疑似／素材疲勞、灰＝數字不夠)
     2. 每天一個色點(最近 30 天),點了跳到那一天
     3. 每天一列(新的在上):燈號、中幾項、中哪幾項＋比大盤多變幾 %、那幾天我們自己有沒有動
   不改 monitor-overlap.js:另放 <div id="mon-recipe">(在 #mon-overlap 旁邊,互搶卡重畫不會蓋掉)。
   MON.cpmRecipe 加 10 分鐘暫存:這支和 monitor-fatigue.js 共用同一次讀取,不多問 Meta。
   燈號只照 Worker 給的,前端不自己判斷;配方沒資料 → 這張卡不出現(不會亂亮綠)。
   ?rpdemo=1:示範資料(畫面標「示範資料」)。 */
(function () {
  'use strict';
  var M = window.MON; if (!M) { console.error('[recipe] 要先載 monitor-data.js'); return; }
  var DM = location.search.match(/[?&]rpdemo=(\d)/), DEMO = !!DM, last = { key: '', j: null }, SHOW = 7;

  //  共用暫存:同品牌同區間 10 分鐘內只讀一次(fatigue 卡也是呼叫 MON.cpmRecipe)
  if (M.cpmRecipe && !M.cpmRecipe._memo) {
    var orig = M.cpmRecipe, memo = {};
    M.cpmRecipe = function (since, until) {
      var k = (M.state && M.state.brand) + '|' + (since || '') + '|' + (until || ''), now = Date.now(), c = memo[k];
      if (c && now - c.t < 600000) return c.p;
      var p = orig.call(M, since, until).then(function (j) { if (!j) delete memo[k]; return j; });
      memo[k] = { t: now, p: p }; return p;
    };
    M.cpmRecipe._memo = true;
  }

  var LC = { red: '#FA6D9B', yellow: '#FAC85A', green: '#6DFAC2', gray: '#8a8aa0', blue: '#6DB4FA' };
  var LN = { red: '紅燈', yellow: '黃燈', green: '綠燈', gray: '數字不夠', blue: '互搶已結束' };
  var CSS = ''
    + '#mon-recipe{min-width:0;max-width:100%;margin-top:12px}'
    + '.rp-card{box-sizing:border-box;max-width:100%;overflow:hidden;border-radius:14px;padding:14px 16px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.12)}'
    + '.rp-card.red{border-color:rgba(250,109,155,.55);background:rgba(250,109,155,.07)}.rp-card.yellow{border-color:rgba(250,200,90,.5);background:rgba(250,200,90,.06)}'
    + '.rp-card.blue{border-color:rgba(109,180,250,.5);background:rgba(109,180,250,.06)}'
    + '.rp-end{margin-top:10px;display:flex;flex-wrap:wrap;gap:8px;align-items:center;font-size:12.5px;color:var(--t2,#c8c8d8)}'
    + '.rp-end input{min-height:44px;padding:4px 8px;border-radius:8px;border:1px solid rgba(255,255,255,.25);background:rgba(0,0,0,.25);color:var(--t1,#fff);font-size:15px}'
    + '.rp-end button{min-height:44px;padding:6px 14px;border-radius:9px;border:1px solid rgba(109,180,250,.6);background:rgba(109,180,250,.12);color:var(--t1,#fff);cursor:pointer;font-size:14px;font-weight:700}'
    + '.rp-end .msg{width:100%;font-size:12px;color:var(--t3,#8a8aa0)}'
    + '.rp-1d{grid-column:1 / -1;font-size:11.5px;color:var(--t2,#c8c8d8);line-height:1.5;overflow-wrap:anywhere}'
    + '.rp-h{font-weight:800;font-size:14px;color:var(--t1,#fff);display:flex;flex-wrap:wrap;gap:6px;align-items:center}'
    + '.rp-tag{padding:1px 8px;border-radius:6px;font-size:11px;font-weight:800;color:#111}'
    + '.rp-say{font-size:13.5px;line-height:1.6;color:var(--t1,#fff);margin:8px 0 6px}'
    + '.rp-sub{font-size:11.5px;line-height:1.55;color:var(--t3,#8a8aa0)}'
    + '.rp-strip{display:flex;flex-wrap:wrap;gap:3px;margin:10px 0 4px}.rp-strip a{width:14px;height:14px;border-radius:4px;display:block;opacity:.9}'
    + '.rp-strip a:hover{outline:2px solid #fff;opacity:1}'
    + '.rp-days{display:flex;flex-direction:column;gap:6px;margin-top:10px}'
    + '.rp-d{display:grid;grid-template-columns:auto 1fr;gap:4px 10px;align-items:start;padding:8px 10px;border-radius:9px;background:rgba(255,255,255,.03);border-left:3px solid #8a8aa0;font-size:12.5px;color:var(--t2,#c8c8d8)}'
    + '.rp-d.hl{outline:2px solid #fff}.rp-d .dt{font-weight:800;color:var(--t1,#fff);white-space:nowrap}.rp-d .lt{font-weight:800;white-space:nowrap}'
    + '.rp-d .hk{grid-column:1 / -1;min-width:0;overflow-wrap:anywhere;line-height:1.55}.rp-d .hk b{color:var(--t1,#fff)}.rp-d .tx{grid-column:1 / -1;font-size:11.5px;color:var(--t3,#8a8aa0);line-height:1.5;overflow-wrap:anywhere}'
    + '.rp-more{margin-top:8px;padding:8px 14px;min-height:38px;border-radius:9px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.05);color:var(--t1,#fff);cursor:pointer;font-size:12.5px}'
    + '.rp-demo{display:inline-block;padding:1px 7px;border-radius:6px;background:rgba(255,255,255,0.08);font-size:10px;color:var(--t3,#8a8aa0)}';
  function css() { if (document.getElementById('rp-css')) return; var s = document.createElement('style'); s.id = 'rp-css'; s.textContent = CSS; document.head.appendChild(s); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function md(d) { var p = String(d || '').split('-'); return p.length === 3 ? (+p[1]) + '/' + (+p[2]) : ''; }
  function pct(v) { return Math.round(Math.abs(v) * 100) + '%'; }

  //  中的每一項 → 「CPM 比大盤多漲 45%」(方向照 Worker 給的 metrics.bad)
  function hitText(j, d) {
    var ms = {}; (j.metrics || []).forEach(function (m) { ms[m.key] = m; });
    var ex = d.ex || {};
    return (d.hitKeys || []).map(function (k) {
      if (k === 'div') {
        var dv = ex.div || [];
        return '<b>花費跟觸及背離</b>' + (dv.length === 2 && dv[0] != null ? '(花費比大盤多 ' + (dv[0] >= 0 ? '+' : '−') + pct(dv[0]) + '、觸及多掉 ' + pct(dv[1]) + ')' : '');
      }
      var m = ms[k] || { name: k, bad: 1 }, e = ex[k];
      if (e == null) return '<b>' + esc(m.name) + '</b>';
      return '<b>' + esc(m.name) + '</b> 比大盤多' + (e >= 0 ? '漲 ' : '跌 ') + pct(e);
    }).join('、');
  }
  function kindWord(d) {
    if (d.light === 'red') return '疑似被搶';
    if (d.light === 'yellow') return d.kind === 'fatigue' ? '素材疲勞' : d.kind === 'cost' ? '成本異常・不像被搶' : d.kind === 'self' ? '我們自己有改' : (d.start ? '疑似被搶' : '單日異常');
    if (d.light === 'gray') return '數字不夠';
    if (d.light === 'blue') return '成本還沒回到大盤';
    return '正常';
  }
  function dayRow(j, d, prev) {   // prev＝前一天(較舊);說明跟前一天一樣就不重複寫
    var c = LC[d.light] || LC.gray, hk = d.hits ? hitText(j, d) : (d.light === 'gray' ? '' : '沒有一項比大盤差到門檻');
    return '<div class="rp-d" id="rp-' + esc(d.date) + '" style="border-left-color:' + c + '">'
      + '<span class="dt">' + md(d.date) + '</span><span class="lt" style="color:' + c + '">' + (LN[d.light] || '') + (d.hits ? ' · 中 ' + d.hits + ' 項' : '') + '</span>'
      + '<span class="hk">' + (d.hits ? '單日：' : '') + hk + '</span>' + oneLine(d)
      + (d.avg ? '<span class="rp-1d">3 天平均(只當參考、不決定燈號)：' + (d.avg.hits ? '中 ' + d.avg.hits + ' 項' : '沒有一項比大盤差到門檻') + '</span>' : '')
      + (d.text && !(prev && prev.text === d.text) ? '<span class="tx">' + esc(d.text) + '</span>' : '')
      + ((d.self && d.self.length && d.text && d.text.indexOf('自己有動') < 0) ? '<span class="tx">開始那天前後我們自己有動:' + esc(d.self.join('、')) + '</span>' : '')
      + '</div>';
  }

  //  v1.2 單日那一行:這個品牌那天的實際值＋比平常、大盤比平常(只有 %)
  function sg(v) { return v == null ? '—' : (v >= 0 ? '+' : '−') + pct(v); }
  function oneLine(d) {
    var o = d.one; if (!o || !o.raw) return '';
    var r = o.raw, c = o.chg || {}, k = o.mkt || {}, p = [];
    if (r.cpm != null) p.push('CPM NT$' + Math.round(r.cpm) + '(比平常 ' + sg(c.cpm) + '／大盤 ' + sg(k.cpm) + ')');
    if (r.reach) p.push('觸及 ' + Number(r.reach).toLocaleString());
    if (r.freq != null) p.push('頻率 ' + r.freq + '(比平常 ' + sg(c.freq) + '／大盤 ' + sg(k.freq) + ')');
    p.push(r.cpa != null ? 'CPA NT$' + r.cpa + '(比平常 ' + sg(c.cpa) + '／大盤 ' + sg(k.cpa) + ')' : '購買 ' + (r.pur == null ? '讀不到' : r.pur) + ' 筆');
    return '<span class="rp-1d">單日：' + p.join('、') + ';單日' + (o.hits ? '中 ' + o.hits + ' 項' : '沒有一項比大盤差到門檻') + '</span>';
  }
  //  v1.2 老闆確認「對方已停」:canEdit(老闆、審核員)才出按鈕;一般帳號只看結果
  function endBox(j) {
    var e = last.end, c = j.confirmed;
    if (c && c.end) {
      return '<div class="rp-end">已確認對方 ' + md(c.end) + ' 底停了(' + esc(c.by || '老闆') + '確認' + (c.seed ? ',系統先替老闆寫進去' : '') + ')。'
        + ((e && e.canEdit) || DEMO ? '<button type="button" data-rpend="edit">改日期</button><button type="button" data-rpend="clear">撤銷確認</button>' : '') + '<span class="msg" id="rp-end-msg"></span></div>';
    }
    if (!(e && e.canEdit) && !DEMO) return '';
    return '<div class="rp-end"><button type="button" data-rpend="open">對方已停（填日期）</button><span class="msg" id="rp-end-msg"></span></div>';
  }
  function endForm(def) {
    return '<div class="rp-end" id="rp-end-form">對方哪一天底停的?<input type="date" id="rp-end-d" value="' + esc(def) + '">'
      + '<button type="button" data-rpend="save">確認</button><button type="button" data-rpend="cancel">取消</button>'
      + '<span class="msg">按下後這段互搶收進過去紀錄,卡片不再寫疑似互搶;之後成本還沒回來改寫「互搶已結束，成本還沒回來」。只存在廣告監控,不改任何廣告。</span><span class="msg" id="rp-end-msg"></span></div>';
  }
  function box() {
    var sec = document.getElementById('mon-overlap-sec'); if (!sec) return null;
    var b = document.getElementById('mon-recipe');
    if (!b) { b = document.createElement('div'); b.id = 'mon-recipe'; sec.appendChild(b); }
    return b;
  }
  function draw() {
    var j = last.j, sec = document.getElementById('mon-overlap-sec');
    var days = j && j.me && j.me.days;
    var b = box(); if (!b) return;
    if (!days || !days.length) { b.innerHTML = ''; return; }
    css();
    if (sec.style.display === 'none') sec.style.display = '';   // 互搶卡讀不到也要讓配方卡看得到
    var d = days[days.length - 1], all = days.slice().reverse(), n = 0;
    days.forEach(function (x) { if (x.light === 'red') n++; });
    var c = LC[d.light] || LC.gray;
    //  v1.1:Worker 給 status(回穩中／已結束)就用它當大標,3 天窗燈號降成小字;沒給(舊 Worker)照 v1.0
    var st = j.status && (j.status.state === 'active' || j.status.state === 'recovering' || j.status.state === 'ended' || j.status.state === 'post') ? j.status : null;
    var h;
    if (st) {
      var stC = st.state === 'post' ? 'blue' : st.state === 'active' ? (d.light === 'red' ? 'red' : 'yellow') : 'green';
      h = '<div class="rp-card ' + stC + '"><div class="rp-h">成本異常配方(跟大盤比)'
        + '<span class="rp-tag" style="background:' + LC[stC] + '">' + (st.state === 'active' ? '🟠 疑似被搶(系統自動判斷)' : st.state === 'recovering' ? '✅ 回穩中' : st.state === 'post' ? '🔵 互搶已結束・成本還沒回來' : '✅ 已結束') + '</span>'
        + (j.demo ? '<span class="rp-demo">示範資料</span>' : '') + '</div>';
      h += '<div class="rp-say">' + esc(st.text) + '</div>';
      h += '<div class="rp-sub">最新完整一天 ' + md(d.date) + ' 單日燈號：' + (LN[d.light] || '') + (d.hits ? '(中 ' + d.hits + ' 項)' : '') + '。燈號只看單日;連 2 天單日異常自動算開始、連 2 天回到大盤自動算結束,看不到對方帳號也會判斷。</div>';
    } else {
      h = '<div class="rp-card ' + esc(d.light) + '"><div class="rp-h">成本異常配方(跟大盤比)'
        + '<span class="rp-tag" style="background:' + c + '">' + md(d.date) + ' ' + (LN[d.light] || '') + '・' + kindWord(d) + '</span>'
        + (j.demo ? '<span class="rp-demo">示範資料</span>' : '') + '</div>';
      h += '<div class="rp-say">' + (d.text ? esc(d.text) : (d.light === 'green' ? '最近一天沒有一項比大盤差到門檻。' : '')) + '</div>';
    }
    if (j.today && j.today.text) h += '<div class="rp-say" style="font-size:12.5px;margin-top:0">' + esc(j.today.text) + '</div>';
    if (j.stale && j.ageSec > 1800) h += '<div class="rp-sub">這是 ' + Math.round(j.ageSec / 3600 * 10) / 10 + ' 小時前算的,背景正在重算(超過 6 小時會當場重算)。</div>';
    var hs = (j.status && j.status.history) || [];
    if (hs.length && !(st && st.state === 'ended' && hs.length === 1)) h += '<div class="rp-sub">過去紀錄:' + hs.slice().reverse().map(function (e) { return esc(e.text); }).join(';') + '</div>';
    h += '<div class="rp-sub">' + md(days[0].date) + '～' + md(d.date) + ' 共 ' + days.length + ' 天:紅燈 ' + n + ' 天、黃燈 '
      + days.filter(function (x) { return x.light === 'yellow'; }).length + ' 天'
      + (j.me.firstRed ? ',第一次紅燈 ' + md(j.me.firstRed) : '') + '。每天單日跟同一天的其他品牌比(那一天比前 28 天;3 天平均只當參考),「多變幾 %」＝這個品牌的變化減掉大盤的變化。</div>';
    h += '<div class="rp-strip" aria-label="每天燈號">' + days.slice(-30).map(function (x) {
      return '<a href="#rp-' + esc(x.date) + '" data-rpday="' + esc(x.date) + '" title="' + md(x.date) + ' ' + (LN[x.light] || '') + (x.hits ? ' 中 ' + x.hits + ' 項' : '') + '" style="background:' + (LC[x.light] || LC.gray) + '"></a>';
    }).join('') + '</div>';
    h += '<div class="rp-days">' + all.slice(0, SHOW).map(function (x, i) { return dayRow(j, x, all[i + 1]); }).join('') + '</div>';
    if (all.length > SHOW) h += '<button type="button" class="rp-more" data-rpmore="1">看更早的 ' + (all.length - SHOW) + ' 天</button><div class="rp-days" id="rp-older" style="display:none">'
      + all.slice(SHOW).map(function (x, i) { return dayRow(j, x, all[SHOW + i + 1]); }).join('') + '</div>';
    if (j.selfLog && j.selfLog.length) h += '<div class="rp-sub" style="margin-top:8px">我們自己的變動紀錄共 ' + j.selfLog.length + ' 筆(預算改超過 30%、開關活動、同一天換素材 3 次以上才會讓紅燈降成黃燈)。</div>';
    if (j.activitiesRead === false) h += '<div class="rp-sub" style="margin-top:4px">這次讀不到廣告帳號的變動紀錄,沒辦法排除我們自己改設定造成的變化。</div>';
    h += endBox(j);
    h += '<div class="rp-sub" style="margin-top:6px">這個配方只看數字像不像被搶;真的抓到別的帳號在投,看上面的帳號掃描。</div></div>';
    b.innerHTML = h;
  }
  document.addEventListener('click', function (e) {
    var be = e.target.closest && e.target.closest('[data-rpend]');
    if (be) { e.preventDefault(); endClick(be.getAttribute('data-rpend'), be); return; }
    var t = e.target.closest && e.target.closest('[data-rpday],[data-rpmore]'); if (!t) return;
    e.preventDefault();
    if (t.getAttribute('data-rpmore')) { var o = document.getElementById('rp-older'); if (o) o.style.display = ''; t.style.display = 'none'; return; }
    var row = document.getElementById('rp-' + t.getAttribute('data-rpday'));
    if (!row) return;
    var ol = document.getElementById('rp-older');
    if (ol && ol.contains(row) && ol.style.display === 'none') { ol.style.display = ''; var mb = document.querySelector('[data-rpmore]'); if (mb) mb.style.display = 'none'; }
    Array.prototype.forEach.call(document.querySelectorAll('.rp-d.hl'), function (r) { r.classList.remove('hl'); });
    row.classList.add('hl');
    var top = document.querySelector('.mn-top'), off = (top ? top.getBoundingClientRect().height : 0) + 70;
    window.scrollTo({ top: Math.max(0, row.getBoundingClientRect().top + window.pageYOffset - off), behavior: 'smooth' });
  });

  function endMsg(s) { var m = document.getElementById('rp-end-msg'); if (m) m.textContent = s; }
  function endClick(k, btn) {
    var wrap = btn.closest('.rp-end');
    if (k === 'open' || k === 'edit') { var c = last.j && last.j.confirmed; wrap.outerHTML = endForm(c && c.end ? c.end : ''); return; }
    if (k === 'cancel') { draw(); return; }
    if (DEMO) { endMsg('示範資料:不會真的存。'); return; }
    var body = k === 'clear' ? { clear: true } : { end: (document.getElementById('rp-end-d') || {}).value || '' };
    if (k === 'clear' && !confirm('撤銷後這段互搶會回到系統自己判斷(可能又顯示疑似)。確定嗎?')) return;
    btn.disabled = true; endMsg('存檔中…');
    M.ovEndSet(body).then(function (r) {
      if (!r || !r.ok) { btn.disabled = false; endMsg((r && r.error) || '存不進去,請稍後再試'); return; }
      endMsg('已存,重新計算中(約 10–30 秒)…');
      (M.cpmRecipeFresh ? M.cpmRecipeFresh() : M.cpmRecipe()).then(function (j) { if (j) last.j = j; draw(); });
    }, function () { btn.disabled = false; endMsg('存不進去,請稍後再試'); });
  }
  function fetchJ(d) {
    if (!d || d.demo || !M.cpmRecipe) return;
    var key = d.brand + '|' + new Date().toISOString().slice(0, 10);
    if (last.key === key) { draw(); return; }
    last.key = key; last.j = null; draw();
    last.end = null; if (M.ovEnd) M.ovEnd().then(function (r) { if (last.key !== key) return; last.end = r; draw(); });
    M.cpmRecipe().then(function (j) { if (last.key !== key) return; last.j = j; draw(); });
  }

  //  示範:照雲端 0210 回測描述排的樣子(11/5 起 4～6 項、11/7 起紅燈);數字是假的
  function demoJ() {
    var ds = [], metrics = [{ key: 'cpm', name: 'CPM', bad: 1 }, { key: 'rpk', name: '每千元觸及', bad: -1 }, { key: 'freq', name: '頻率', bad: 1 },
      { key: 'ppk', name: '每千元購買數', bad: -1 }, { key: 'cpa', name: 'CPA', bad: 1 }, { key: 'roas', name: 'ROAS', bad: -1 }, { key: 'ctr', name: '連結點擊率', bad: -1 }];
    for (var i = 1; i <= 22; i++) {
      var dt = '2026-11-' + (i < 10 ? '0' + i : i), x = { date: dt, hits: 0, hitKeys: [], ex: {}, self: [], light: 'green', kind: '', text: '' };
      if (i >= 5) {
        x.hitKeys = i < 7 ? ['cpm', 'rpk', 'ppk', 'cpa'] : ['cpm', 'rpk', 'freq', 'ppk', 'cpa', 'roas'];
        x.ex = { cpm: 0.52, rpk: -0.31, freq: 0.14, ppk: -0.38, cpa: 0.61, roas: -0.33, ctr: -0.04 };
        x.hits = x.hitKeys.length; x.light = i < 7 ? 'yellow' : 'red'; x.kind = 'compete';
        x.text = i < 7 ? '從 11 月 5 日 起，中了 ' + x.hits + ' 項；中 4 項以上才連續 ' + (i - 4) + ' 天(紅燈要 3 天)' : '從 11 月 5 日 起，中了 ' + x.hits + ' 項。疑似有別的帳號在搶同一群人';
      }
      ds.push(x);
    }
    var J = { ok: true, demo: true, metrics: metrics, activitiesRead: true, selfLog: [], me: { days: ds, firstRed: '2026-11-07' } };
    //  v1.1 示範:rpdemo=2 回穩中(最新完整日 11/23,3 天窗還黃)、rpdemo=3 已結束(到 11/24)
    var mode = DM ? +DM[1] : 1;
    if (mode >= 2 && mode <= 3) {
      var addDay = function (dt, light, hits) { ds.push({ date: dt, hits: hits, hitKeys: hits ? ['cpm', 'rpk', 'freq'] : [], ex: { cpm: 0.98, rpk: -0.78, freq: 0.19 }, self: [], light: light, kind: hits ? 'compete' : '', text: hits ? '從 11 月 7 日 起，中了 3 項；只中 3 項(紅燈要 4 項)' : '', one: { hits: 0, keys: [] } }); };
      addDay('2026-11-23', 'yellow', 3);
      if (mode === 2) {
        J.status = { state: 'recovering', text: '✅ 回穩中：從 11 月 23 日 起成本回到大盤水準（單日沒有一項比大盤差到門檻）；前面 11 月 7 日 起那段疑似被搶，再 1 天正常就算結束。燈號還要等 3 天窗滑過去才會變。', history: [] };
        J.today = { date: '2026-11-24', partial: true, text: '今天到目前為止：CPM NT$152（比平常 +2%）／大盤 CPM 比平常 +1%；沒有一項比大盤差到門檻（還沒跑完的數字，不算燈號）' };
      } else {
        addDay('2026-11-24', 'yellow', 2);
        var ep = { start: '2026-11-07', end: '2026-11-22', days: 16, text: '已結束：11/7–11/22，共 16 天（疑似被搶）' };
        J.status = { state: 'ended', episode: ep, history: [ep], text: '✅ 已結束：11/7–11/22，共 16 天（疑似被搶）；從 11 月 23 日 起成本回到大盤水準。' };
        J.today = { date: '2026-11-25', partial: true, text: '今天到目前為止：CPM NT$148（比平常 −1%）／大盤 CPM 比平常 +0%；沒有一項比大盤差到門檻（還沒跑完的數字，不算燈號）' };
      }
    }
    if (mode === 5) {   // v1.3 系統自動判斷(沒有老闆確認):11/7 開始、11/22 結束
      ds.forEach(function (x, i) { if (i >= 6) { x.start = '2026-11-07'; x.avg = { hits: 5 }; } });
      ds.push({ date: '2026-11-23', hits: 0, hitKeys: [], ex: {}, self: [], light: 'green', kind: '', text: '單日回到大盤水準(中 0 項)；再 1 天正常就自動算結束。', avg: { hits: 4 } });
      ds.push({ date: '2026-11-24', hits: 1, hitKeys: ['freq'], ex: { freq: 0.11 }, self: [], light: 'green', kind: '', text: '連 2 天單日回到大盤水準：已結束：11/7–11/22，共 16 天（疑似被搶，系統自動判斷）。', avg: { hits: 2 } });
      var ep5 = { start: '2026-11-07', end: '2026-11-22', text: '已結束：11/7–11/22，共 16 天（疑似被搶，系統自動判斷）' };
      J.status = { state: 'ended', episode: ep5, history: [ep5], text: '✅ 已結束：11/7–11/22，共 16 天（疑似被搶，系統自動判斷）；從 11 月 23 日 起單日回到大盤水準。' };
    }
    if (mode === 6) {   // v1.3 系統自動判斷:還在被搶
      J.status = { state: 'active', history: [], text: '🟠 疑似被搶（客戶可能有別的帳號在投同一群人）：從 11 月 5 日 起單日連續異常，到 11 月 22 日 共 18 天。系統看不到對方帳號，是用我們自己的數字跟同一天大盤比的；連 2 天單日回到大盤水準會自動算結束。' };
    }
    if (mode === 4) {
      ds.push({ date: '2026-11-23', hits: 3, hitKeys: ['cpm', 'rpk', 'freq'], ex: { cpm: 1.26, rpk: -0.7, freq: 0.18 }, self: [], light: 'blue', kind: 'post', start: '2026-11-07',
        text: '互搶已結束（老闆確認對方 11 月 22 日 底已停），但成本還沒回到大盤水準（3 天窗還中 3 項）：可能是自家廣告在重新學習、預算有變動，或 3 天窗還含著對方在投的那幾天；不算互搶。',
        one: { hits: 2, keys: ['cpm', 'rpk'], raw: { spend: 2600, imp: 12000, reach: 7400, cpm: 216.7, freq: 1.62, pur: 7, cpa: 371 }, chg: { cpm: 0.45, freq: 0.02, cpa: -0.1 }, mkt: { cpm: 0.03, freq: 0.01, cpa: 0.02 } } });
      J.confirmed = { start: '2026-11-07', end: '2026-11-22', by: '老闆', seed: true };
      J.status = { state: 'post', history: [{ text: '已結束：11/7–11/22（老闆確認）' }], text: '🔵 互搶已結束：11/7–11/22（老闆確認）。但到 11 月 23 日 成本還沒回到大盤水準（單日還中 2 項）：可能是自家廣告在重新學習、預算有變動；這不算互搶。' };
      J.today = { date: '2026-11-24', partial: true, text: '今天到目前為止：CPM NT$190（比平常 +27%）／大盤 CPM 比平常 +2%；有 1 項比大盤差到門檻（還沒跑完的數字，不算燈號）' };
    }
    return J;
  }

  if (DEMO) {
    var go = function () { last.j = demoJ(); draw(); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(go, 300); }); else setTimeout(go, 300);
  } else {
    M.on('data', function (d) { fetchJ(d); });
    M.on('brand', function () { last.key = ''; last.j = null; draw(); });
    if (M.state.data) fetchJ(M.state.data);
  }
  //  互搶卡讀不到時 monitor-overlap.js 會把整區藏起來;配方有資料就再打開
  var sec0 = document.getElementById('mon-overlap-sec');
  if (sec0) new MutationObserver(function () {
    if (sec0.style.display === 'none' && last.j && last.j.me && last.j.me.days && last.j.me.days.length) sec0.style.display = '';
  }).observe(sec0, { attributes: true, attributeFilter: ['style'] });
  window.MON_RECIPE = { version: 'monitor-recipe v1.1', draw: draw };
})();
