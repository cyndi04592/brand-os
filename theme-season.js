/* ═══════════════════════════════════════════════════════════════════
 *  theme-season.js · v1.4(2026-11-02)節慶換膚(全站共用,由 loader.js 自動載入)
 *  v1.4:首頁(廣告圖頁)LOGO 旁也掛小樹(.nav-logo-wrap);右下角大樹會擋到面板 → 改成「角落是空的才出現」
 *  v1.5:檔期改成 RA 在 Admin 後台「🎄 節慶」分頁設定(kol-proxy v7.61 /season.json)。
 *        記在這台瀏覽器 10 分鐘;讀不到後台就用下面內建的 SEASONS(網站照常,不會壞)。後台關掉 → 下次換頁自動換回原樣
 * ───────────────────────────────────────────────────────────────────
 *  RA 11/02:「先幫我變成聖誕節版,但後面會自動改回來」—— 像遊戲一樣有節慶感
 *  ★ 只換外觀(顏色、背景光暈、飄雪、小裝飾),版面與功能完全不動
 *  ★ 依日期自動開關:時間到就不載入,畫面自動回原本的樣子,不用再改程式
 *  ★ 要加新節慶(農曆年、中秋…)= 在下面 SEASONS 加一筆
 *  ★ 預覽 / 關閉:網址加 ?theme=xmas 強制看;?theme=off 強制關(記在這台瀏覽器,?theme=auto 恢復)
 * ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.__bsSeasonTheme) return;
  window.__bsSeasonTheme = 'v1.5';

  // 日期用「月-日」,含頭含尾;跨年的檔期把 from 寫大於 to 即可(例:12-28 ~ 01-05)
  var SEASONS = [
    { key: 'xmas', from: '11-02', to: '12-26' },   // 🎄 聖誕:今天開始,12/26 自動換回
  ];

  function mmdd(d) { return ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function inRange(today, from, to) { return from <= to ? (today >= from && today <= to) : (today >= from || today <= to); }

  //  v1.5 後台設定:先用這台瀏覽器記住的(10 分鐘內),同時在背景問後台最新的,下次換頁就套用
  var CFG_URL = 'https://kol-proxy.calm-sunset-6b66.workers.dev/season.json';
  function loadCfg() {
    try {
      var c = JSON.parse(localStorage.getItem('bs_season_cfg') || 'null');
      if (c && Array.isArray(c.seasons)) {
        SEASONS = c.seasons.filter(function (x) { return x && x.on; });
        if (Date.now() - (c.at || 0) < 10 * 60 * 1000) return;
      }
    } catch (_) {}
    try {
      fetch(CFG_URL, { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (d) {
        if (!d || !Array.isArray(d.seasons)) return;
        try { localStorage.setItem('bs_season_cfg', JSON.stringify({ seasons: d.seasons, at: Date.now() })); } catch (_) {}
      }).catch(function () {});
    } catch (_) {}
  }

  function pickSeason() {
    loadCfg();
    var force = '';
    try {
      var q = (location.search.match(/[?&]theme=([a-z]+)/) || [])[1] || '';
      if (q === 'auto') localStorage.removeItem('bs_theme_force');
      else if (q) localStorage.setItem('bs_theme_force', q);
      force = localStorage.getItem('bs_theme_force') || '';
    } catch (_) {}
    if (force === 'off') return '';
    if (force) return force;
    var t = mmdd(new Date());
    for (var i = 0; i < SEASONS.length; i++) if (inRange(t, SEASONS[i].from, SEASONS[i].to)) return SEASONS[i].key;
    return '';
  }

  var THEMES = {
    xmas: {
      css:
        // v1.1 RA:酒紅一點
        ':root{--accent:#b8324a;--accent2:#d9b25f;--accent3:#3fbf7f;}' +
        // 背景光暈:紫粉 → 酒紅、綠、金
        'body::before{background:radial-gradient(ellipse 60% 40% at 20% 10%,rgba(150,28,52,.20) 0%,transparent 60%),' +
        'radial-gradient(ellipse 40% 30% at 80% 80%,rgba(63,191,127,.10) 0%,transparent 55%),' +
        'radial-gradient(ellipse 30% 20% at 60% 0%,rgba(242,193,78,.08) 0%,transparent 60%) !important;}' +
        // LOGO 前面一棵點陣小樹(v1.1 RA:不要 emoji,要科技感)
        '.bs-dot-tree-logo{display:inline-block;vertical-align:-4px;margin-right:8px;width:15px;height:20px;}' +
        // 右下角大一點的點陣樹(只在桌機,不擋點擊)
        '.bs-dot-tree-corner{position:fixed;right:28px;bottom:24px;width:130px;height:150px;pointer-events:none;z-index:1;opacity:.9;transition:opacity .3s;}' +
        '.bs-dot-tree-corner.bs-off{opacity:0;}' +
        '.nav-logo-wrap .bs-dot-tree-logo{margin:0 0 0 2px;width:13px;height:18px;vertical-align:-3px;}' +
        '@media (max-width:1100px){.bs-dot-tree-corner{display:none}}' +
        '.bs-dot-tree rect{fill:#d9b25f}.bs-dot-tree rect.d{fill:#9c7a35}.bs-dot-tree rect.b{fill:#ffe39a}' +
        '.bs-dot-tree rect.tw{animation:bsTwinkle 3s ease-in-out infinite}' +
        '@keyframes bsTwinkle{0%,100%{opacity:1}50%{opacity:.2}}' +
        '@media (prefers-reduced-motion:reduce){.bs-dot-tree rect.tw{animation:none}}' +
        // 主要按鈕:酒紅漸層
        '.btn-primary,.kai-btn-primary,.kai-btn-gen{background:linear-gradient(135deg,#a32a40,#7c1b2e) !important;border-color:#a32a40 !important;color:#fff !important;}' +
        // 飄雪
        '.bs-snow{position:fixed;inset:0;pointer-events:none;z-index:1;overflow:hidden;}' +
        '.bs-snow i{position:absolute;top:-12px;width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,.75);' +
        'filter:blur(.5px);animation:bsSnowFall linear infinite;}' +
        '@keyframes bsSnowFall{0%{transform:translate3d(0,-12px,0);opacity:0}10%{opacity:.9}100%{transform:translate3d(30px,105vh,0);opacity:.2}}' +
        '@media (prefers-reduced-motion:reduce){.bs-snow{display:none}}',
      snow: 36,
      tree: true,
    },
  };

  // 像素風金色聖誕樹 v1.2(RA:「要這種像素風、用金色」)—— 程式即時畫的原創圖形:
  //   四層往下垂的枝條,枝尖密、中間疏(抖點/刺繡感),頂端小星、細樹幹,少數像素慢慢閃
  function dotTreeSVG(cls) {
    var seed = 11, W = 90, U = 120 / W, px = '';                 // 90 格寬的細像素
    function rnd() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
    function put(x, y, k) { px += '<rect' + (k ? ' class="' + k + '"' : '') + ' x="' + (x * U).toFixed(2) + '" y="' + (y * U).toFixed(2) + '" width="' + (U * 0.8).toFixed(2) + '" height="' + (U * 0.8).toFixed(2) + '"' + (k && k.indexOf('tw') > -1 ? ' style="animation-delay:-' + (rnd() * 3).toFixed(1) + 's"' : '') + '/>'; }
    var cx = W / 2;
    // 頂端小星
    [[0, 0], [0, 1], [-1, 1], [1, 1], [0, 2], [0, 3], [0, 4]].forEach(function (d) { put(cx + d[0], 3 + d[1], 'b tw'); });
    // 樹身:四層,每層上窄下寬,枝尖密、中間疏,層與層之間留一點暗縫
    var tiers = [[8, 26, 13], [22, 46, 22], [40, 68, 32], [60, 90, 42]];
    tiers.forEach(function (t, ti) {
      var y0 = t[0], y1 = t[1], wmax = t[2];
      for (var y = y0; y <= y1; y++) {
        var f = (y - y0) / (y1 - y0);
        var hw = 1.5 + wmax * Math.pow(f, 0.9) + (rnd() - 0.5) * 3;
        for (var x = Math.floor(cx - hw); x <= Math.ceil(cx + hw); x++) {
          var edge = Math.abs(x - cx) / hw;                 // 0 中間 → 1 枝尖
          var p = 0.08 + 0.8 * Math.pow(edge, 1.8);          // 枝尖密、中間疏
          if (f > 0.8) p += 0.25 * (1 - edge * 0.5);         // 每層下緣一條較亮的枝
          if (f < 0.12 && ti > 0) p *= 0.3;                  // 層頂留暗縫,看得出一層一層
          if (((x + y) & 1) && edge < 0.6) p *= 0.5;          // 棋盤抖點 → 像素刺繡感
          if (rnd() < p) { var c = rnd(); put(x, y, c < 0.04 ? 'b tw' : (c < 0.4 ? 'd' : '')); }
        }
        // 枝尖往下垂
        if (f > 0.55 && rnd() < 0.75) { put(Math.round(cx - hw) - 1, y + 1, 'd'); put(Math.round(cx + hw) + 1, y + 1, 'd'); }
      }
    });
    // 細樹幹:兩條稀疏直線
    for (var ty = 91; ty < 103; ty++) { if (rnd() < 0.8) put(cx - 3, ty, 'd'); if (rnd() < 0.8) put(cx + 3, ty, 'd'); if (rnd() < 0.25) put(cx, ty, 'd'); }
    return '<svg class="bs-dot-tree ' + cls + '" viewBox="0 0 120 138" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" shape-rendering="crispEdges">' + px + '</svg>';
  }

  // LOGO 旁的小樹:尺寸太小,細像素會散掉 → 改用 9×12 粗像素(同一個金色像素風)
  function logoTreeSVG() {
    var rows = ['....*....', '....#....', '...###...', '..##o##..', '...###...', '..#####..', '.##o####.', '..#####..', '.#######.', '####o####', '....#....', '....#....'];
    var px = '';
    rows.forEach(function (r, y) {
      for (var x = 0; x < r.length; x++) {
        var ch = r[x];
        if (ch === '.') continue;
        var k = ch === '*' ? 'b tw' : (ch === 'o' ? 'b tw' : ((x + y) % 3 === 0 ? 'd' : ''));
        px += '<rect' + (k ? ' class="' + k + '"' : '') + ' x="' + x + '" y="' + y + '" width="0.86" height="0.86"' + (k.indexOf('tw') > -1 ? ' style="animation-delay:-' + ((x * 7 + y * 3) % 30 / 10) + 's"' : '') + '/>';
      }
    });
    return '<svg class="bs-dot-tree bs-dot-tree-logo" viewBox="0 0 9 12" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" shape-rendering="crispEdges">' + px + '</svg>';
  }

  function apply(key) {
    var th = THEMES[key];
    if (!th) return;
    document.documentElement.setAttribute('data-season', key);
    var st = document.createElement('style');
    st.id = 'bs-season-css';
    st.textContent = th.css;
    document.head.appendChild(st);
    if (th.tree) {
      try {
        //  LOGO 旁的小樹:KOL 工作室 = .topbar-logo(文字 LOGO);首頁 = .nav-logo-wrap(圖 + 「Brand OS」字)
        var logo = document.querySelector('.topbar-logo');
        if (logo && !logo.querySelector('.bs-dot-tree')) {
          logo.insertAdjacentHTML('afterbegin', logoTreeSVG());
          //  RWD:窄螢幕時 LOGO 文字會被藏起來、換成「←」返回鍵 → 那時小樹也一起藏,免得疊在箭頭上
          var lt = logo.querySelector('.bs-dot-tree-logo');
          var sync = function () { try { lt.style.display = parseFloat(getComputedStyle(logo).fontSize) > 0 ? '' : 'none'; } catch (_) {} };
          sync(); window.addEventListener('resize', sync);
        }
        var nav = document.querySelector('.nav-logo-wrap .nav-brand-text');
        if (nav && !nav.parentNode.querySelector('.bs-dot-tree')) {
          nav.insertAdjacentHTML('beforebegin', logoTreeSVG());
          var nt = nav.parentNode.querySelector('.bs-dot-tree-logo');
          var sync2 = function () { try { nt.style.display = nav.offsetWidth > 0 ? '' : 'none'; } catch (_) {} };   // 手機把「Brand OS」字藏起來時,小樹也藏
          sync2(); window.addEventListener('resize', sync2);
        }
        document.body.insertAdjacentHTML('beforeend', dotTreeSVG('bs-dot-tree-corner'));
        //  v1.4 右下角大樹:角落底下有面板/卡片/按鈕就隱藏(首頁右邊素材面板會被擋到),角落空的才出現
        var ct = document.querySelector('.bs-dot-tree-corner');
        //  首頁(廣告圖實驗室)的 .workspace 會一路延伸到右下角,生成的文案/圖片就出現在那 → 這頁直接不放大樹(LOGO 小樹、雪、配色照常)
        if (document.querySelector('.workspace')) ct.classList.add('bs-off');
        var solid = function (el) {
          for (var e = el; e && e !== document.body && e !== document.documentElement; e = e.parentElement) {
            if (e.offsetWidth >= innerWidth * 0.9 && e.offsetHeight >= innerHeight * 0.9) continue;   // 整頁大底色(版面外框)不算面板
            var cs = getComputedStyle(e), m = (cs.backgroundColor || '').match(/rgba?\(([^)]+)\)/);
            var a = m ? (m[1].split(',')[3] !== undefined ? parseFloat(m[1].split(',')[3]) : 1) : 0;
            if (a > 0.03 || parseFloat(cs.borderTopWidth) > 0 || cs.backgroundImage !== 'none' || /^(BUTTON|INPUT|TEXTAREA|SELECT|IMG|VIDEO|A)$/.test(e.tagName)) return true;
          }
          return false;
        };
        var check = function () {
          try {
            var r = ct.getBoundingClientRect(), hit = false;
            [[.25, .3], [.75, .3], [.5, .6], [.25, .9], [.75, .9]].forEach(function (f) {
              var els = document.elementsFromPoint(r.left + r.width * f[0], r.top + r.height * f[1]) || [];
              for (var i = 0; i < els.length; i++) {
                var el = els[i];
                if (el.closest && (el.closest('.bs-dot-tree') || el.closest('.bs-snow'))) continue;
                if (solid(el)) hit = true;
                break;
              }
            });
            ct.classList.toggle('bs-off', hit || !!document.querySelector('.workspace'));
          } catch (_) {}
        };
        check(); window.addEventListener('resize', check); window.addEventListener('scroll', check, { passive: true }); setInterval(check, 2000);
      } catch (_) {}
    }
    // 飄雪(手機少一半,省電)
    var n = th.snow || 0;
    if (n && window.matchMedia && window.matchMedia('(max-width:768px)').matches) n = Math.round(n / 2);
    if (n) {
      var box = document.createElement('div');
      box.className = 'bs-snow';
      box.setAttribute('aria-hidden', 'true');
      var html = '';
      for (var i = 0; i < n; i++) {
        var size = (3 + Math.random() * 5).toFixed(1);
        html += '<i style="left:' + (Math.random() * 100).toFixed(2) + '%;width:' + size + 'px;height:' + size + 'px;'
          + 'animation-duration:' + (9 + Math.random() * 12).toFixed(1) + 's;animation-delay:-' + (Math.random() * 20).toFixed(1) + 's"></i>';
      }
      box.innerHTML = html;
      document.body.appendChild(box);
    }
  }

  function start() {
    try { var k = pickSeason(); if (k) apply(k); } catch (_) { /* 換膚失敗絕不影響網站 */ }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
