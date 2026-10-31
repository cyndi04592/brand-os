// ═══════════════════════════════════════════════════════════════
//  🏷 ad-logotap.js v1.1(2026-10-31)
//  v1.1:切 LOGO 近景改用 urlToBlob 讀商品照(v1.0 實測:cdn 商品照被瀏覽器擋讀 → 近景沒切出來,校正少了那張)— 廣告圖生成前「點一下商品 LOGO」
//  RA:跟商品運鏡影片同一個做法 —— 人眼點的位置比 AI 自己找的準(AI 曾把 moz 讀成 ITDC)。
//   ① 按「生成廣告圖」→ 先跳視窗:在商品照上點一下品牌 LOGO(可跳過)
//   ② 從原商品照以那一點為中心切一張 LOGO 近景(原圖真實像素)
//   ③ 生成後的「商品校正」多帶這張近景,請 AI 把商品上的 LOGO 對回近景那樣
//      (admaker.js 只改一個條件:原本只有重拍模式才校正 → 有點 LOGO 也校正)
//   同一張商品照點過就記住,不再每次問;視窗裡可以重點或跳過
//  對外:window._amLogoTap = { crop: dataURL, x, y } 或 null(admaker.js 商品校正讀)
//  掛載:index.html 在 admaker.js 後面一行;包住 window.generateGptPoster(精簡引擎 adlean.js 也會包,順序不影響)
// ═══════════════════════════════════════════════════════════════
(function () {
  'use strict';
  if (window.AdLogoTap) return;
  var VERSION = '1.1';
  var memo = {};            // 商品照 → { x, y } 或 'skip'

  function photoNow() {
    try { var S = window.S || {}; return (S.selPhoto !== null && S.selPhoto !== undefined) ? S.photos[S.selPhoto] : null; } catch (e) { return null; }
  }
  function srcOf(p) { return p && (p.canvasRes || p.full || p.hiRes || p.src || p.thumb) || ''; }
  function keyOf(p) { return p && (p.id || p.full || p.src || p.thumb) || ''; }

  function css() {
    if (document.getElementById('lt-css')) return;
    var s = document.createElement('style'); s.id = 'lt-css';
    s.textContent =
      '.lt-wrap{position:fixed;inset:0;z-index:99990;background:rgba(6,6,10,.9);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:16px;font-family:"Noto Sans TC",sans-serif;color:#eee}' +
      '.lt-wrap h3{margin:0;font-size:16px}' +
      '.lt-hint{font-size:13px;color:#cdb4ff;text-align:center;line-height:1.6;max-width:520px}' +
      '.lt-box{position:relative;max-width:min(520px,92vw)}' +
      '.lt-box img{display:block;max-width:100%;max-height:58vh;border-radius:10px;cursor:crosshair;background:#fff}' +
      '.lt-dot{position:absolute;width:56px;height:56px;margin:-28px 0 0 -28px;border:3px solid #ff3b5c;border-radius:50%;box-shadow:0 0 0 3px rgba(255,255,255,.7);pointer-events:none}' +
      '.lt-row{display:flex;gap:10px;flex-wrap:wrap;justify-content:center}' +
      '.lt-b{border:1.5px solid #555;background:#1b1b24;color:#eee;border-radius:10px;padding:10px 16px;font-size:14px;font-weight:800;cursor:pointer;font-family:inherit}' +
      '.lt-b.go{border-color:#8b7bff;background:linear-gradient(135deg,#7c6dfa,#a78bfa);color:#fff}' +
      '.lt-b:disabled{opacity:.45;cursor:not-allowed}';
    document.head.appendChild(s);
  }

  // 視窗:回傳 {x,y}(0~1)或 'skip';關掉視窗 = null(不生成)
  function ask(src, prev) {
    return new Promise(function (resolve) {
      css();
      var w = document.createElement('div'); w.className = 'lt-wrap';
      w.innerHTML =
        '<h3>🏷 商品上的 LOGO 在哪裡?</h3>' +
        '<div class="lt-hint">在商品照上<b>點一下品牌 LOGO</b>,生出來的廣告圖會照這裡把 LOGO 對準。<br>商品上沒有 LOGO 就按「跳過」。</div>' +
        '<div class="lt-box"><img alt=""><div class="lt-dot" style="display:none"></div></div>' +
        '<div class="lt-row">' +
        '  <button class="lt-b" data-lt="skip">跳過</button>' +
        '  <button class="lt-b go" data-lt="ok" disabled>確定,開始生成</button>' +
        '  <button class="lt-b" data-lt="cancel">取消</button>' +
        '</div>';
      document.body.appendChild(w);
      var img = w.querySelector('img'), dot = w.querySelector('.lt-dot'), ok = w.querySelector('[data-lt="ok"]');
      var pt = (prev && prev.x != null) ? { x: prev.x, y: prev.y } : null;
      function place() {
        if (!pt) return;
        dot.style.display = 'block';
        dot.style.left = (pt.x * img.clientWidth) + 'px';
        dot.style.top = (pt.y * img.clientHeight) + 'px';
        ok.disabled = false;
      }
      img.onload = place;
      img.src = src;
      img.addEventListener('click', function (e) {
        var r = img.getBoundingClientRect();
        pt = { x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)) };
        place();
      });
      w.addEventListener('click', function (e) {
        var b = e.target.closest('[data-lt]'); if (!b) return;
        var k = b.getAttribute('data-lt');
        if (k === 'ok' && !pt) return;
        w.remove();
        resolve(k === 'ok' ? pt : (k === 'skip' ? 'skip' : null));
      });
    });
  }

  // 從原商品照切 LOGO 近景(真實像素,輸出 512 見方)
  async function cropAt(src, pt) {
    //  v1.1 用 admaker 的 urlToBlob 讀檔(它會避開「畫面上 <img> 先載過 → 快取少了跨網域許可」那個坑);
    //   v1.0 用 loadImageSmart → 圖被瀏覽器標成不能讀 → 切不出近景(實測 cdn 商品照)
    var blob = (typeof urlToBlob === 'function') ? await urlToBlob(src) : await (await fetch(src, { cache: 'no-store' })).blob();
    var im = await createImageBitmap(blob);
    var W = im.width, H = im.height, m = Math.min(W, H);
    var side = Math.round(Math.min(m, Math.max(240, m * 0.18)));
    var sx = Math.round(Math.max(0, Math.min(W - side, pt.x * W - side / 2)));
    var sy = Math.round(Math.max(0, Math.min(H - side, pt.y * H - side / 2)));
    var c = document.createElement('canvas'); c.width = 512; c.height = 512;
    var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 512, 512);
    x.imageSmoothingQuality = 'high';
    x.drawImage(im, sx, sy, side, side, 0, 0, 512, 512);
    return c.toDataURL('image/jpeg', 0.92);
  }

  function wrap() {
    var orig = window.generateGptPoster;
    if (typeof orig !== 'function' || orig.__lt) return false;
    var wrapped = async function () {
      var args = arguments, self = this;
      window._amLogoTap = null;
      var p = photoNow();
      if (p) {
        try { if (typeof ensureFullRes === 'function') await ensureFullRes(p, true); } catch (e) {}
        var src = srcOf(p), key = keyOf(p);
        if (src) {
          var got = memo[key];
          if (got === undefined) {
            got = await ask(src, null);
            if (got === null) return;                 // 取消 → 不生成
            memo[key] = got;
          }
          if (got && got !== 'skip') {
            try { var crop = await cropAt(src, got); if (crop) window._amLogoTap = { crop: crop, x: got.x, y: got.y }; }
            catch (e) { console.warn('[LOGO 點選] 切近景失敗(照常生成,不影響):', e.message); }
          }
        }
      }
      return orig.apply(self, args);
    };
    wrapped.__lt = true;
    window.generateGptPoster = wrapped;
    return true;
  }
  // admaker.js 已載入 → 立刻包;精簡引擎之後再包一層也沒關係(它最後會呼叫到這層)
  if (!wrap()) { var n = 0, t = setInterval(function () { if (wrap() || ++n > 40) clearInterval(t); }, 250); }

  //  重點 LOGO 位置:Console 或之後的按鈕可用 AdLogoTap.reset()
  window.AdLogoTap = { version: VERSION, reset: function () { memo = {}; } };
  console.log('[AdLogoTap] 🏷 v' + VERSION + ' 就緒 · 生成廣告圖前點一下商品 LOGO(可跳過)· 商品校正對準那一塊');
})();
