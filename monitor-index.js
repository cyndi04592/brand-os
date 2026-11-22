/* ══════════════════════════════════════════════════════════════
   Brand OS · monitor-index.js · v1.0(2026-11-22)
   廣告監控頁「芮比大盤」:所有綁定品牌的 CPM / CPC / 點擊率 / 轉換率 / ROAS 指數(中位數),
   這個品牌的線畫在大盤旁邊(個股對大盤)。(老闆 11/22 16:07「帳號越多越可以有自己的大盤,類似股票」)
     大盤一起變差 → 大環境,不要亂動;只有自己變差 → 自己的問題,要處理。
   資料:MON.rabyIndex()(Worker ads-monitor action 'raby_index',只讀 Meta、不改廣告)
   掛載點:<section id="mon-index-sec"><div id="mon-index"></div></section>
   - 只畫指數(100 = 平常),不顯示任何別家的實際數字;品牌不到 3 個 → 只出一行說明
   - 產業小盤不到 3 個品牌不顯示
   - 氣溫參考線:Open-Meteo 台北 / 台中 / 高雄每日最高溫平均(公開資料,不帶任何帳號資訊);抓不到就不畫
   - Worker 還沒有這個動作 → 整段不顯示
   - 網址加 ?idxdemo=1 → 用寫死的示範數字畫一次(畫面會標「示範資料」,只給驗收截圖用)
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (!window.MON) { console.error('[index] 要先載 monitor-data.js'); return; }
  var M = window.MON;
  var DEMO = /[?&]idxdemo=1/.test(location.search);
  var KEYS = ['cpm', 'cpc', 'ctr', 'cvr', 'roas'];
  var NAME = { cpm: 'CPM(買曝光的價錢)', cpc: 'CPC(一次點擊多少錢)', ctr: '點擊率', cvr: '轉換率', roas: 'ROAS' };
  var SHORT = { cpm: 'CPM', cpc: 'CPC', ctr: '點擊率', cvr: '轉換率', roas: 'ROAS' };
  var UP_BAD = { cpm: 1, cpc: 1, ctr: 0, cvr: 0, roas: 0 };
  var TAG = { market: ['大環境', 'mk'], self: ['只有你', 'sf'], mixed: ['你比大盤差', 'sf'], resist: ['你撐住了', 'ok'], calm: ['平穩', 'ok'] };

  var CSS = ''
    + '#mon-index{min-width:0;max-width:100%}.ix-card{box-sizing:border-box;max-width:100%;overflow:hidden;border-radius:14px;padding:14px 16px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08)}'
    + '.ix-card.self{border-color:rgba(250,109,155,0.55);background:rgba(250,109,155,0.07)}'
    + '.ix-card.market,.ix-card.mixed{border-color:rgba(250,200,90,0.5);background:rgba(250,200,90,0.06)}'
    + '.ix-head{display:flex;gap:10px;align-items:flex-start}'
    + '.ix-dot{flex:0 0 12px;width:12px;height:12px;border-radius:50%;margin-top:5px;background:#6DFAC2}'
    + '.self .ix-dot{background:#FA6D9B;box-shadow:0 0 10px #FA6D9B}.market .ix-dot,.mixed .ix-dot{background:#FAC85A}'
    + '.ix-say{font-size:14px;font-weight:700;line-height:1.7;color:var(--t1,#fff)}'
    + '.ix-say small{display:block;font-weight:400;font-size:12.5px;color:var(--t2,#c8c8d8)}'
    + '.ix-demo{display:inline-block;font-size:11px;font-weight:700;color:#111;background:#FAC85A;border-radius:6px;padding:1px 7px;margin-right:6px}'
    + '.ix-leg{font-size:12px;color:var(--t3,#8a8aa0);margin:12px 0 2px;line-height:2}'
    + '.ix-leg b{display:inline-block;width:16px;height:0;border-top:3px solid #fff;margin:0 5px 0 12px;vertical-align:middle}'
    + '.ix-leg b:first-child{margin-left:0}'
    + '.ix-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(250px,100%),1fr));gap:10px;margin-top:8px}'
    + '.ix-box{background:rgba(255,255,255,0.04);border-radius:11px;padding:10px 12px;min-width:0}'
    + '.ix-box .t{display:flex;justify-content:space-between;gap:8px;align-items:center;font-size:12.5px;color:var(--t2,#c8c8d8);font-weight:600}'
    + '.ix-box .v{font-size:12px;color:var(--t3,#8a8aa0);margin-top:3px;font-variant-numeric:tabular-nums}.ix-box .v b{color:var(--t1,#fff);font-size:15px}'
    + '.ix-tag{font-size:11px;font-weight:700;border-radius:6px;padding:1px 7px;white-space:nowrap}'
    + '.ix-tag.mk{background:rgba(250,200,90,0.2);color:#FAC85A}.ix-tag.sf{background:rgba(250,109,155,0.2);color:#FA6D9B}.ix-tag.ok{background:rgba(109,250,194,0.14);color:#6DFAC2}'
    + '.ix-box svg{display:block;width:100%;height:auto;margin-top:6px}'
    + '.ix-note{font-size:12px;color:var(--t3,#8a8aa0);line-height:1.7;margin-top:10px}';
  function css() {
    if (document.getElementById('ix-css')) return;
    var s = document.createElement('style'); s.id = 'ix-css'; s.textContent = CSS; document.head.appendChild(s);
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function pct(n) { return (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n) + '%'; }

  // ── 氣溫參考線(公開天氣,不帶任何帳號資訊;一次開頁抓一次)──
  var wx = null, wxAsked = false;
  function loadWx(cb) {
    if (wxAsked) return; wxAsked = true;
    var u = 'https://api.open-meteo.com/v1/forecast?latitude=25.04,24.15,22.63&longitude=121.56,120.67,120.31&daily=temperature_2m_max&past_days=70&forecast_days=1&timezone=Asia%2FTaipei';
    fetch(u).then(function (r) { return r.json(); }).then(function (a) {
      if (!Array.isArray(a)) a = [a];
      var m = {}, c = {};
      a.forEach(function (x) {
        var d = x && x.daily; if (!d || !d.time) return;
        d.time.forEach(function (t, i) { var v = d.temperature_2m_max[i]; if (v == null) return; m[t] = (m[t] || 0) + v; c[t] = (c[t] || 0) + 1; });
      });
      Object.keys(m).forEach(function (t) { m[t] = m[t] / c[t]; });
      if (Object.keys(m).length) { wx = m; cb(); }
    }).catch(function () {});
  }

  function demoData() {
    var dates = [], i, mk = {}, me = {}, sec = {}, n = [];
    KEYS.forEach(function (k) { mk[k] = []; me[k] = []; sec[k] = []; });
    for (i = 0; i < 60; i++) {
      dates.push(new Date(Date.UTC(2026, 8, 23 + i)).toISOString().slice(0, 10));
      var w = Math.sin(i / 6) * 3, hot = i > 45 ? (i - 45) * 1.6 : 0;   // 最後兩週大盤 CPM 一起漲(檔期)
      mk.cpm.push(100 + w + hot); me.cpm.push(98 + Math.cos(i / 5) * 4 + hot * 1.05);
      mk.cpc.push(100 + w * 0.8 + hot * 0.7); me.cpc.push(101 + Math.sin(i / 4) * 5 + hot * 0.8);
      mk.ctr.push(100 - w * 0.6); me.ctr.push(i > 46 ? 104 - (i - 46) * 2.1 : 104 + Math.sin(i / 7) * 3);   // 只有自己的點擊率在掉
      mk.cvr.push(100 + Math.cos(i / 8) * 4); me.cvr.push(99 + Math.sin(i / 9) * 5);
      mk.roas.push(100 - hot * 0.5 + Math.cos(i / 6) * 3); me.roas.push(102 - hot * 0.6 + Math.sin(i / 5) * 4);
      KEYS.forEach(function (k) { sec[k].push(mk[k][i] + Math.sin(i / 3 + 1) * 2.5); });
      n.push(7);
    }
    mk.n = n;
    return { ok: true, demo: true, dates: dates, minBrands: 3, enough: true, brands: 7, market: mk, me: me,
      sector: Object.assign({ name: '示範產業', hidden: false }, sec),
      verdict: { headline: 'self', which: ['ctr'], metrics: {
        cpm: { me: 12, market: 11, code: 'market' }, cpc: { me: 9, market: 8, code: 'market' }, ctr: { me: -14, market: -1, code: 'self' },
        cvr: { me: 2, market: -1, code: 'calm' }, roas: { me: -6, market: -5, code: 'calm' } } },
      notes: ['每個點是近 7 天合計;100 = 自己這 60 天的平常', '大盤 = 各品牌指數的中位數,不含任何一家的實際數字', '轉換率 = 各品牌主要目標(購物 / 訊息 / 名單)÷ 連結點擊;ROAS 只算購物型品牌'] };
  }

  function path(vals, X, Y) {
    var d = '', pen = false;
    vals.forEach(function (v, i) { if (v == null) { pen = false; return; } d += (pen ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1); pen = true; });
    return d;
  }
  function lastOf(a) { for (var i = (a || []).length - 1; i >= 0; i--) if (a[i] != null) return a[i]; return null; }

  function chart(j, k) {
    var W = 320, H = 150, pl = 30, pr = 26, pt = 8, pb = 18;
    var mk = j.market[k], me = j.me[k] || [], sc = j.sector && !j.sector.hidden ? j.sector[k] : null, n = j.dates.length;
    var all = mk.concat(me, sc || []).filter(function (v) { return v != null; });
    if (!all.length) return '';
    var lo = Math.min.apply(null, all.concat([95])), hi = Math.max.apply(null, all.concat([105]));
    var pad = (hi - lo) * 0.08; lo -= pad; hi += pad;
    var X = function (i) { return pl + (W - pl - pr) * i / Math.max(1, n - 1); };
    var Y = function (v) { return pt + (H - pt - pb) * (1 - (v - lo) / (hi - lo)); };
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + SHORT[k] + ' 指數走勢">';
    //  氣溫(右邊刻度,自己的範圍)
    if (wx) {
      var t = j.dates.map(function (d) { return wx[d] == null ? null : wx[d]; }), tv = t.filter(function (v) { return v != null; });
      if (tv.length > 10) {
        var tl = Math.min.apply(null, tv), th = Math.max.apply(null, tv), TY = function (v) { return pt + (H - pt - pb) * (1 - (v - tl) / Math.max(1, th - tl)); };
        s += '<path d="' + path(t, X, TY) + '" fill="none" stroke="#FAC85A" stroke-opacity="0.38" stroke-width="1" stroke-dasharray="2 3"/>'
          + '<text x="' + (W - 2) + '" y="' + (pt + 8) + '" text-anchor="end" font-size="9" fill="#FAC85A" fill-opacity="0.75">' + Math.round(th) + '°</text>'
          + '<text x="' + (W - 2) + '" y="' + (H - pb) + '" text-anchor="end" font-size="9" fill="#FAC85A" fill-opacity="0.75">' + Math.round(tl) + '°</text>';
      }
    }
    s += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + Y(100) + '" y2="' + Y(100) + '" stroke="rgba(255,255,255,0.18)" stroke-dasharray="3 3"/>'
      + '<text x="' + (pl - 4) + '" y="' + (Y(100) + 3) + '" text-anchor="end" font-size="9" fill="#8a8aa0">100</text>'
      + '<text x="' + (pl - 4) + '" y="' + (pt + 8) + '" text-anchor="end" font-size="9" fill="#8a8aa0">' + Math.round(hi) + '</text>'
      + '<text x="' + (pl - 4) + '" y="' + (H - pb) + '" text-anchor="end" font-size="9" fill="#8a8aa0">' + Math.round(lo) + '</text>'
      + '<text x="' + pl + '" y="' + (H - 4) + '" font-size="9" fill="#8a8aa0">' + j.dates[0].slice(5) + '</text>'
      + '<text x="' + (W - pr) + '" y="' + (H - 4) + '" text-anchor="end" font-size="9" fill="#8a8aa0">' + j.dates[n - 1].slice(5) + '</text>';
    if (sc) s += '<path d="' + path(sc, X, Y) + '" fill="none" stroke="#6DFAC2" stroke-opacity="0.8" stroke-width="1.3" stroke-dasharray="5 3"/>';
    s += '<path d="' + path(mk, X, Y) + '" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="2"/>'
      + '<path d="' + path(me, X, Y) + '" fill="none" stroke="#9B8CFF" stroke-width="2.2"/>';
    //  滑過去看那一天
    var bw = (W - pl - pr) / n;
    j.dates.forEach(function (d, i) {
      s += '<rect x="' + (X(i) - bw / 2).toFixed(1) + '" y="' + pt + '" width="' + bw.toFixed(1) + '" height="' + (H - pt - pb) + '" fill="transparent"><title>' + d
        + ' 大盤 ' + (mk[i] == null ? '—' : Math.round(mk[i])) + '、你 ' + (me[i] == null ? '—' : Math.round(me[i]))
        + (sc ? '、產業 ' + (sc[i] == null ? '—' : Math.round(sc[i])) : '') + (wx && wx[d] != null ? '、氣溫 ' + Math.round(wx[d]) + '°' : '') + '</title></rect>';
    });
    return s + '</svg>';
  }

  function say(j) {
    var v = j.verdict || {}, m = v.metrics || {}, w = v.which || [];
    var list = w.map(function (k) { return SHORT[k] + ' 你 ' + pct(m[k].me) + '、大盤 ' + pct(m[k].market); }).join(';');
    if (v.headline === 'market') return ['大盤一起變差,是大環境(檔期大家搶量、Meta 調整),先不要亂動。', '這週比上週:' + list + '。等大盤回來;這段靠素材和網站撐。'];
    if (v.headline === 'self') return ['只有你變差、大盤沒事,問題在自己,要處理。', '這週比上週:' + list + '。先看素材疲乏、帳號互搶、網站。'];
    if (v.headline === 'mixed') return ['大盤有點變差,但你掉得比大盤多。', '這週比上週:' + list + '。一部分是大環境,一部分是自己,先看素材和受眾。'];
    if (v.headline === 'resist') return ['大盤變差,但你撐住了。', '這週比上週:' + list + '。照現在的做法就好。'];
    if (v.headline === 'calm') return ['你跟大盤這週都平穩。', '五個指標這週比上週都沒有明顯變差。'];
    return ['這個品牌的資料還不夠跟大盤比。', '要有 14 天以上、每週 2,000 次以上曝光才畫得出自己的線。'];
  }

  var cur = null;
  function draw(j) {
    var sec = document.getElementById('mon-index-sec'), box = document.getElementById('mon-index');
    if (!sec || !box) return;
    if (!j || !j.ok) { sec.style.display = 'none'; return; }
    cur = j; css(); sec.style.display = '';
    if (!j.enough || !j.market) {
      box.innerHTML = '<div class="ix-card"><div class="ix-head"><span class="ix-dot" style="background:#8a8aa0"></span><div class="ix-say">大盤暫時不顯示<small>有資料的品牌還不到 ' + (j.minBrands || 3)
        + ' 個。少於 ' + (j.minBrands || 3) + ' 個時不畫,避免從大盤反推出單一品牌的數字。</small></div></div></div>';
      return;
    }
    var hl = (j.verdict && j.verdict.headline) || 'unknown', sy = say(j);
    var h = '<div class="ix-card ' + esc(hl) + '"><div class="ix-head"><span class="ix-dot"></span><div class="ix-say">'
      + (j.demo ? '<span class="ix-demo">示範資料</span>' : '') + esc(sy[0]) + '<small>' + esc(sy[1]) + '</small></div></div>';
    h += '<div class="ix-leg"><b style="border-color:rgba(255,255,255,0.85)"></b>芮比大盤(' + j.brands + ' 個品牌的中位數)<b style="border-color:#9B8CFF"></b>這個品牌'
      + (j.sector && !j.sector.hidden ? '<b style="border-top:2px dashed #6DFAC2"></b>' + esc(j.sector.name) + '小盤' : '')
      + (wx ? '<b style="border-top:2px dotted #FAC85A"></b>氣溫(右邊刻度)' : '') + '</div>';
    h += '<div class="ix-grid">' + KEYS.map(function (k) {
      var c = chart(j, k); if (!c) return '';
      var a = lastOf(j.market[k]), b = lastOf(j.me[k]), vm = j.verdict && j.verdict.metrics && j.verdict.metrics[k], tg = vm && TAG[vm.code];
      return '<div class="ix-box"><div class="t"><span>' + NAME[k] + '</span>' + (tg ? '<span class="ix-tag ' + tg[1] + '">' + tg[0] + '</span>' : '') + '</div>'
        + '<div class="v">大盤 <b>' + (a == null ? '—' : Math.round(a)) + '</b>　你 <b>' + (b == null ? '—' : Math.round(b)) + '</b>　' + (UP_BAD[k] ? '越高越貴' : '越高越好') + '</div>' + c + '</div>';
    }).join('') + '</div>';
    var nt = (j.notes || []).slice();
    if (j.sector && j.sector.hidden) nt.push('「' + j.sector.name + '」小盤的品牌還不到 ' + (j.minBrands || 3) + ' 個,先不顯示');
    if (wx) nt.push('氣溫 = 台北、台中、高雄每日最高溫平均,只當參考');
    if (j.boss && j.boss.sectors) nt.push('(只有管理員看得到)各產業品牌數:' + j.boss.sectors.map(function (s) { return s.name + ' ' + s.brands; }).join('、'));
    h += '<div class="ix-note">' + nt.map(esc).join(';') + '。</div></div>';
    box.innerHTML = h;
  }

  var last = '';
  function run() {
    loadWx(function () { if (cur) draw(cur); });
    if (DEMO) { draw(demoData()); return; }
    var k = String(M.state.brand);
    if (k === last) return;
    last = k;
    if (!M.rabyIndex) { draw(null); return; }
    M.rabyIndex().then(function (j) { if (k === last) draw(j); }).catch(function () { draw(null); });
  }
  M.on('data', run);
  if (DEMO) { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run(); }

  window.MON_INDEX = { version: 'monitor-index v1.0', draw: draw };
})();
