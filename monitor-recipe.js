/* monitor-recipe.js v1.0 — 2026-11-23 老闆 01:58「巧福還是沒有搶的符號」
   把後端 cpm_recipe(多指標配方,跟大盤比)的結果畫成一張卡,放在「帳號互搶」區最上面。
   只讀;素材疲勞(kind=fatigue)交給 monitor-fatigue.js,這裡只顯示疑似互搶。 */
(function () {
  var M = window.MON; if (!M || !M.on) return;
  var CSS = '.rc-card{border:1px solid rgba(160,160,180,.35);border-radius:12px;padding:14px 16px;margin:0 0 12px;background:rgba(255,255,255,.03)}'
    + '.rc-card.red{border-color:rgba(250,109,155,.75);background:rgba(250,109,155,.07)}.rc-card.yellow{border-color:rgba(250,200,90,.7);background:rgba(250,200,90,.06)}'
    + '.rc-h{display:flex;align-items:center;gap:8px;font-weight:700;font-size:15px}.rc-dot{width:12px;height:12px;border-radius:50%;flex:none}'
    + '.rc-say{margin:8px 0 10px;font-size:13px;line-height:1.6;color:var(--t1,#e8e8f0)}'
    + '.rc-strip{display:flex;gap:2px;flex-wrap:wrap;margin:6px 0}.rc-strip b{width:10px!important;height:22px!important;border-radius:2px;display:inline-block!important;flex:none}'
    + '.rc-hits{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}.rc-hits span{font-size:12px;padding:2px 8px;border-radius:10px;background:rgba(255,255,255,.08)}'
    + '.rc-note{font-size:11px;color:var(--t2,#a8a8c0);margin-top:8px;line-height:1.5}';
  var COL = { red: '#FA6D9B', yellow: '#FAC85A', green: '#6DFAC2', gray: '#8a8aa0' };
  var last = { key: '', j: null };
  function css() { if (document.getElementById('rc-css')) return; var s = document.createElement('style'); s.id = 'rc-css'; s.textContent = CSS; document.head.appendChild(s); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function md(d) { var p = String(d || '').split('-'); return p.length === 3 ? (+p[1]) + '/' + (+p[2]) : d; }
  function box() {
    var host = document.getElementById('mon-overlap'); if (!host) return null;
    var el = document.getElementById('mon-recipe-card');
    if (!el) { el = document.createElement('div'); el.id = 'mon-recipe-card'; host.insertBefore(el, host.firstChild); }
    else if (el.parentNode !== host || host.firstChild !== el) host.insertBefore(el, host.firstChild);
    return el;
  }
  function name(j, k) {
    if (k === 'div') return '花更多、觸及反少';
    var m = (j.metrics || []).filter(function (x) { return x.key === k; })[0]; return m ? m.name : k;
  }
  function draw() {
    var j = last.j, el = box(); if (!el) return;
    if (!j || !j.ok || !j.me || !j.me.days || !j.me.days.length) { el.innerHTML = ''; return; }
    css();
    var days = j.me.days.slice(-45);
    // 只看疑似互搶;素材疲勞的天當作沒中
    function lt(d) { return d.kind === 'fatigue' ? 'gray' : (d.light || 'green'); }
    var recent = days.slice(-30), worst = 'green', firstBad = null, lastBad = null, badN = 0;
    recent.forEach(function (d) {
      var l = lt(d);
      if (l === 'red' || l === 'yellow') { badN++; if (!firstBad) firstBad = d; lastBad = d; }
      if (l === 'red') worst = 'red'; else if (l === 'yellow' && worst !== 'red') worst = 'yellow';
    });
    var strip = days.map(function (d) {
      var l = lt(d), c = l === 'red' ? COL.red : l === 'yellow' ? COL.yellow : 'rgba(255,255,255,.12)';
      return '<b style="background:' + c + '" title="' + esc(md(d.date) + ' ' + (d.hitKeys || []).map(function (k) { return name(j, k); }).join('、')) + '"></b>';
    }).join('');
    var head, say;
    if (worst === 'green') {
      head = '成本異常:近 30 天正常';
      say = '跟其他品牌同期比,CPM、觸及、購買、CPA、ROAS、點擊率都沒有明顯比大盤差。';
    } else {
      var d = lastBad, hits = (d.hitKeys || []).filter(function (k) { return k !== 'ctr'; });
      head = (worst === 'red' ? '🚨 疑似有別的帳號在搶同一群人' : '⚠️ 疑似被搶(成本比大盤異常)');
      say = '從 ' + md(firstBad.date) + ' 起,近 30 天有 ' + badN + ' 天成本比其他品牌同期明顯變差;最近一次 ' + md(d.date) + ' 中了 ' + hits.length + ' 項。'
        + ((d.self && d.self.length) ? ' 這幾天我們自己也有 ' + d.self.length + ' 筆預算/活動變動,所以先亮黃燈。' : '');
    }
    var chips = '';
    if (lastBad) chips = '<div class="rc-hits">' + (lastBad.hitKeys || []).map(function (k) {
      var v = lastBad.ex && Array.isArray(lastBad.ex[k]) ? null : (lastBad.ex ? lastBad.ex[k] : null);
      return '<span>' + esc(name(j, k)) + (typeof v === 'number' ? ' ' + (v > 0 ? '+' : '') + Math.round(v * 100) + '%' : '') + '</span>';
    }).join('') + '</div>';
    el.innerHTML = '<div class="rc-card ' + worst + '"><div class="rc-h"><span class="rc-dot" style="background:' + COL[worst] + '"></span>' + esc(head) + '</div>'
      + '<div class="rc-say">' + esc(say) + '</div>'
      + '<div class="rc-strip">' + strip + '</div>' + chips
      + '<div class="rc-note">每一格是一天(近 45 天),粉紅＝疑似互搶、黃＝疑似、灰＝正常;滑鼠移上去看中了哪幾項。每個指標都扣掉其他品牌同期的變化,雙 11 大家一起漲的部分不算。點擊率掉＋頻率升算「素材疲勞」,看下面素材疲勞區。</div></div>';
  }
  function fetchJ(d) {
    if (!d || d.demo || !M.cpmRecipe) return;
    var key = (M.state && M.state.brand) || '';
    if (last.key === key && last.j) { draw(); return; }
    last.key = key;
    M.cpmRecipe().then(function (j) { if (last.key !== key) return; last.j = j; draw(); }, function () {});
  }
  M.on('data', function (d) { fetchJ(d); setTimeout(draw, 1500); });
  M.on('brand', function () { last.key = ''; last.j = null; var el = document.getElementById('mon-recipe-card'); if (el) el.innerHTML = ''; });
  // 互搶區自己重畫時會清掉內容,補回來
  try { new MutationObserver(function () { var h = document.getElementById('mon-overlap'); if (h && last.j && !document.getElementById('mon-recipe-card')) draw(); })
    .observe(document.body, { childList: true, subtree: true }); } catch (e) {}
})();
