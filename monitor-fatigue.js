/* monitor-fatigue.js v1.0(2026-11-23,交代 20261123-0110;老闆 01:09「亮素材疲勞黃燈時,要引導她去看每支素材的疲乏度數字」)
   互搶成本異常配方(Worker action cpm_recipe,cpmrecipe.js v2.1)最新一天 kind='fatigue' → 這一區出現黃燈卡:
     1. 一句白話:點擊率比大盤多掉 X%、頻率多升 Y%,比較像素材看膩了,不是被搶。
     2. 按鈕「看每支素材疲乏度」→ 打開「進行中廣告」、依疲乏由高到低排、前 3 支加框(monitor-ads.js focus)
     3. 卡片直接列前 3 支:名稱、疲乏度、頻率、點擊率近 3 天比前 7 天掉多少 +「先換這 3 支的開頭和主圖」
     4. 疲乏度一律拿「進行中廣告」那一欄(MON_ADS.top),不另算
   「⑤ 素材夠不夠新」也有同一顆按鈕(data-fatgo,monitor-intl.js)。全程只讀。
   ?fgdemo=1:示範資料(VegiWell 10/21 模擬回測那天的配方結果＋假廣告;畫面標「示範資料」)。
   後端還沒有 cpm_recipe(或讀不到)→ 這一區不出現,不會亂亮燈。 */
(function () {
  'use strict';
  if (!window.MON) { console.error('[fatigue] 要先載 monitor-data.js'); return; }
  var M = window.MON, DEMO = /[?&]fgdemo=1/.test(location.search), last = { key: '', j: null };

  var CSS = ''
    + '.fg-card .fg-say{font-size:14px;color:var(--t1,#fff);line-height:1.6;margin:6px 0 4px}'
    + '.fg-card .fg-sub{font-size:11.5px;color:var(--t3,#8a8aa0);line-height:1.55}'
    + '.fg-btn{margin-top:10px;padding:10px 16px;min-height:42px;border-radius:10px;border:1px solid #FFC45A;background:rgba(255,196,90,0.14);color:#FFD889;font-weight:800;font-size:13px;cursor:pointer}'
    + '.fg-btn:hover{background:rgba(255,196,90,0.24)}'
    + '.fg-top{margin-top:12px;display:flex;flex-direction:column;gap:6px}'
    + '.fg-top .it{display:grid;grid-template-columns:auto 1fr auto;gap:4px 10px;align-items:center;padding:8px 10px;border-radius:9px;background:rgba(255,196,90,0.06);border-left:3px solid #FFC45A;font-size:12px;color:var(--t2,#c8c8d8)}'
    + '.fg-top .no{font-weight:800;color:#FFC45A}.fg-top .nm{color:var(--t1,#fff);font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
    + '.fg-top .ft{font-weight:800;color:var(--pink,#FA6D9B);white-space:nowrap}.fg-top .mt{grid-column:2 / -1;font-size:11px;color:var(--t3,#8a8aa0)}'
    + '.fg-tip{margin-top:8px;font-size:12.5px;color:#FFD889;font-weight:700}'
    + '.fg-demo{display:inline-block;margin-left:6px;padding:1px 7px;border-radius:6px;background:rgba(255,255,255,0.08);font-size:10px;color:var(--t3,#8a8aa0)}';
  function css() { if (document.getElementById('fg-css')) return; var s = document.createElement('style'); s.id = 'fg-css'; s.textContent = CSS; document.head.appendChild(s); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function pc(v) { return Math.round(Math.abs(v || 0) * 100) + '%'; }
  function md(d) { var p = String(d || '').split('-'); return p.length === 3 ? (+p[1]) + '/' + (+p[2]) : ''; }

  function secEl() { return document.getElementById('mon-fatigue-sec'); }
  function hide() { var s = secEl(); if (s) s.style.display = 'none'; }

  //  最新一天是素材疲勞才出卡(配方回測的 me.days 最後一天)
  function pickDay(j) {
    var me = j && j.me, days = me && me.days; if (!days || !days.length) return null;
    var d = days[days.length - 1];
    return d && d.kind === 'fatigue' && d.light === 'yellow' ? d : null;
  }
  function startOf(j, day) {   // 這一段素材疲勞從哪天開始(連續 kind=fatigue 往回找)
    var days = j.me.days, i = days.indexOf(day), s = day.date;
    for (; i >= 0 && days[i].kind === 'fatigue'; i--) s = days[i].date;
    return s;
  }
  function topHtml() {
    var t = window.MON_ADS && window.MON_ADS.top ? window.MON_ADS.top(3) : [];
    if (!t.length) return '<div class="fg-top"><div class="mt" style="font-size:11.5px">進行中廣告還算不出疲乏度(曝光太少或還在讀資料),按上面按鈕看全部。</div></div>';
    return '<div class="fg-top">' + t.map(function (r, i) {
      return '<div class="it"><span class="no">' + (i + 1) + '</span><span class="nm" title="' + esc(r.name) + '">' + esc(r.name) + '</span><span class="ft">疲乏 ' + r.fat + '</span>'
        + '<span class="mt">頻率 ' + (r.frequency || 0).toFixed(1) + ' · 點擊率近 3 天比前 7 天' + (r.ctrDrop > 0 ? '掉 ' + pc(r.ctrDrop) : (r.ctrDrop < 0 ? '升 ' + pc(r.ctrDrop) : '持平')) + '</span></div>';
    }).join('') + '</div><div class="fg-tip">建議:先換這 ' + t.length + ' 支的開頭和主圖。</div>';
  }
  function draw() {
    var s = secEl(), box = document.getElementById('mon-fatigue'), j = last.j;
    var day = pickDay(j);
    if (!s || !box || !day) { hide(); return; }
    var ex = day.ex || {}, ctr = ex.ctr, fq = ex.freq;
    var say = '點擊率比大盤多掉 ' + pc(ctr) + '、頻率多升 ' + pc(fq) + ',比較像素材看膩了,不是被搶。';
    if (ctr == null || fq == null) say = '連結點擊率跌、頻率升,比較像素材看膩了,不是被搶。';
    var st = startOf(j, day);
    box.innerHTML = '<div class="mo-card fg-card yellow"><div class="mo-h">素材疲勞 <span class="mo-tag warn">黃燈</span>' + (j.demo ? '<span class="fg-demo">示範資料</span>' : '') + '</div>'
      + '<div class="fg-say">' + say + '</div>'
      + '<div class="fg-sub">從 ' + md(st) + ' 開始(判斷日 ' + md(day.date) + ',跟其他品牌同一段時間比)。這不是互搶紅燈,不用合併帳號;要處理的是素材。</div>'
      + '<button type="button" class="fg-btn" data-fatgo="card">看每支素材疲乏度 →</button>'
      + topHtml()
      + '<div class="fg-sub" style="margin-top:8px">疲乏度跟下面「進行中廣告」的「疲乏」欄同一套算法(近 3 天比前 7 天:點擊率掉、CPM 漲、頻率高);≥60 該換、35~59 注意。</div>'
      + '</div>';
    s.style.display = '';
  }

  //  按鈕:打開「進行中廣告」→ 依疲乏排序 → 前 3 支加框 → 捲過去
  function goAds() {
    var h2 = document.getElementById('sec-ads'), sec = h2 && h2.parentNode; if (!sec) return;
    if (sec.classList.contains('fd') && !sec.classList.contains('fd-on')) { var bar = sec.querySelector(':scope > .fd-bar'); if (bar) bar.click(); }
    if (window.MON_ADS && window.MON_ADS.focus) window.MON_ADS.focus(3);
    setTimeout(function () {
      var row = document.querySelector('#mon-ads tr.md-hl'), el = row || sec;
      var top = document.querySelector('.mn-top'), off = (top ? top.getBoundingClientRect().height : 0) + 70;
      window.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + window.pageYOffset - off), behavior: 'smooth' });
    }, 80);
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-fatgo]'); if (!b) return;
    e.preventDefault(); goAds();
  });

  function fetchJ(d) {
    if (!d || d.demo || !M.cpmRecipe) return;
    var key = d.brand + '|' + new Date().toISOString().slice(0, 10);
    if (last.key === key) { draw(); return; }
    last.key = key; last.j = null; hide();
    M.cpmRecipe().then(function (j) { if (last.key !== key) return; last.j = j; draw(); });
  }

  // ── 示範資料(只給驗收截圖;配方結果＝cpmrecipe.js v2.1 跑 tmp\cpmrecipe 模擬資料 VegiWell 10/21 那天;廣告是假的)──
  function demoAds() {
    function ad(name, spend, freq, age, c7, c3, m7, m3) {
      var imp = Math.round(spend / m3 * 1000);
      return { id: 'demo_' + name, name: name, campaign: '示範|VegiWell 常態', adset: '示範|廣泛', spend: spend, impressions: imp, reach: Math.round(imp / freq), frequency: freq, ctr: c3, cpm: m3,
        purchases: Math.round(spend / 420), cpa: 420, roas: 2.2, ageDays: age, linkClicks: Math.round(imp * c3 / 100), format: 'image',
        trend: { last3: { impressions: Math.round(imp * 0.35), ctr: c3, cpm: m3, cpa: 460 }, prev7: { impressions: Math.round(imp * 0.65), ctr: c7, cpm: m7, cpa: 380 } } };
    }
    return { demo: true, brand: 'demo_vw', goal: 'purchase', range: { since: '2026-10-15', until: '2026-10-21' },
      totals: { spend: 41200, purchases: 98, cpa: 420, roas: 2.2, revenue: 90600, reach: 120000, frequency: 2.6 },
      ads: [ad('示範|蔬果汁開箱影片', 12800, 4.1, 46, 1.9, 1.1, 150, 205), ad('示範|早餐情境主圖', 9600, 3.8, 38, 1.6, 1.05, 140, 182), ad('示範|營養師推薦', 7400, 3.3, 33, 1.5, 1.12, 145, 170),
        ad('示範|新口味預告', 5200, 1.9, 9, 1.4, 1.36, 150, 152), ad('示範|會員回購', 3900, 2.6, 21, 1.7, 1.55, 160, 168), ad('示範|限時組合', 2300, 1.6, 5, 1.2, 1.25, 155, 150)] };
  }
  var DEMO_J = { ok: true, demo: true, brand: 'demo_vw', me: { days: [
    { date: '2026-10-17', kind: '', light: 'green', hits: 1 },
    { date: '2026-10-18', kind: 'fatigue', light: 'yellow', hits: 3 },
    { date: '2026-10-19', kind: 'fatigue', light: 'yellow', hits: 4 },
    { date: '2026-10-20', kind: 'fatigue', light: 'yellow', hits: 4 },
    { date: '2026-10-21', hits: 5, hitKeys: ['freq', 'ppk', 'cpa', 'roas', 'ctr'], ex: { cpm: 0.03, rpk: -0.21, freq: 0.24, ppk: -0.41, cpa: 0.79, roas: -0.41, ctr: -0.36, div: [0.05, -0.19] }, streak: 4, hot: 0, self: [], light: 'yellow', kind: 'fatigue',
      text: '從 10 月 18 日 起,連結點擊率跌、頻率升,比較像素材看膩了(素材疲勞),不是被搶:建議換素材。' }] } };
  function demo() {
    var d = demoAds(); M.state.data = d;
    if (window.MON_ADS) window.MON_ADS.render(d);
    last.j = DEMO_J; draw();
  }

  css();
  if (DEMO) {
    var go = function () { demo(); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(go, 300); }); else setTimeout(go, 300);
    M.on('error', function () { setTimeout(go, 50); }); M.on('loading', function () { setTimeout(go, 50); });
  } else {
    M.on('data', function (d) { fetchJ(d); });
    M.on('brand', function () { last.key = ''; last.j = null; hide(); });
    if (M.state.data) fetchJ(M.state.data);
  }
  window.MON_FATIGUE = { version: 'monitor-fatigue v1.0', draw: draw, go: goAds, demo: demo };
})();
