// ═══════════════════════════════════════════════════════════════
//  🏷 ad-logotap.js v1.3(2026-11-04)
//  v1.3:點完 LOGO,系統先自己讀 LOGO 字、幫客人填好(kol-proxy v7.81 logo_read,不扣點)
//   實測:帶品牌名當對照 → MOZ 小刺繡讀對「MOZ sweden」;不帶 → 讀成「MVPZ ARMY」還自稱確定
//   → 一律帶品牌名;AI 的「確定」不可信 → 一律請客人看一眼確認(不對直接改)
//   客人自己打過字就不覆蓋;同品牌記住的字直接用,不重讀
//  v1.2:LOGO 字對不上 → 加「LOGO 上寫的字」+「局部放大修 LOGO」
//   RA 11/04 實測:MOZ 外套重拍後 LOGO 變 New Balance / Jeep;
//   點了 LOGO 校正後還是「WHOZ / micafon」—— 原圖 LOGO 是很小的刺繡,AI(連 Claude)都讀不出是 MOZ。
//   ★ 試過:只換更近的近景 → 還是 WHOZ;近景 + 告訴 AI「MOZ / sweden」→ 拼對 ✅(接縫看不出來)
//   做法:① 視窗多一格「LOGO 上寫的字」(選填,同品牌記住)
//        ② 出圖後找到 LOGO 位置(兩次定位,Claude 單次會偏 ~200px)
//        ③ 只切 LOGO 附近一塊、放大給 AI 照字重繡 → 縮回原位、邊緣漸層融合,其他地方一個像素都不動
//   沒填字 → 跟 v1.1 一樣(只做整張商品校正)
//  v1.1:切 LOGO 近景改用 urlToBlob 讀商品照(v1.0 實測:cdn 商品照被瀏覽器擋讀 → 近景沒切出來,校正少了那張)
//  v1.0 廣告圖生成前「點一下商品 LOGO」
//  RA:跟商品運鏡影片同一個做法 —— 人眼點的位置比 AI 自己找的準(AI 曾把 moz 讀成 ITDC)。
//   ① 按「生成廣告圖」→ 先跳視窗:在商品照上點一下品牌 LOGO(可跳過)
//   ② 從原商品照以那一點為中心切一張 LOGO 近景(原圖真實像素)
//   ③ 生成後的「商品校正」多帶這張近景,請 AI 把商品上的 LOGO 對回近景那樣
//   同一張商品照點過就記住,不再每次問;視窗裡可以重點或跳過
//  對外:window._amLogoTap = { crop, tight, text, x, y } 或 null(admaker.js 商品校正讀)
//        AdLogoTap.fixLogo(imageUrl, lt, isApparel) → 修好的圖網址 或 null(失敗就用原圖,不擋出圖)
//  掛載:index.html 在 admaker.js 後面一行;包住 window.generateGptPoster(精簡引擎 adlean.js 也會包,順序不影響)
// ═══════════════════════════════════════════════════════════════
(function () {
  'use strict';
  if (window.AdLogoTap) return;
  var VERSION = '1.3';
  var memo = {};            // 商品照 → { x, y, text } 或 'skip'

  function photoNow() {
    try { var S = window.S || {}; return (S.selPhoto !== null && S.selPhoto !== undefined) ? S.photos[S.selPhoto] : null; } catch (e) { return null; }
  }
  function srcOf(p) { return p && (p.canvasRes || p.full || p.hiRes || p.src || p.thumb) || ''; }
  function keyOf(p) { return p && (p.id || p.full || p.src || p.thumb) || ''; }
  function brandNow() { try { return (window.S && window.S.brandId) || ''; } catch (e) { return ''; } }
  function brandName() {
    try { var id = brandNow(), b = (window.BRANDS || []).find(function (x) { return x.id === id; }); return (b && b.name) || ''; } catch (e) { return ''; }
  }

  //  LOGO 字記憶:同一張商品照優先,沒有就用同品牌上次填的
  function lsGet(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }
  function lsSet(k, v) { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch (e) {} }
  function cleanText(t) { return String(t || '').replace(/["“”「」]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40); }

  function css() {
    if (document.getElementById('lt-css')) return;
    var s = document.createElement('style'); s.id = 'lt-css';
    s.textContent =
      '.lt-wrap{position:fixed;inset:0;z-index:99990;background:rgba(6,6,10,.9);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:16px;font-family:"Noto Sans TC",sans-serif;color:#eee;overflow:auto}' +
      '.lt-wrap h3{margin:0;font-size:16px}' +
      '.lt-hint{font-size:13px;color:#cdb4ff;text-align:center;line-height:1.6;max-width:520px}' +
      '.lt-box{position:relative;max-width:min(520px,92vw)}' +
      '.lt-box img{display:block;max-width:100%;max-height:50vh;border-radius:10px;cursor:crosshair;background:#fff}' +
      '.lt-dot{position:absolute;width:56px;height:56px;margin:-28px 0 0 -28px;border:3px solid #ff3b5c;border-radius:50%;box-shadow:0 0 0 3px rgba(255,255,255,.7);pointer-events:none}' +
      '.lt-txt{width:min(520px,92vw);display:flex;flex-direction:column;gap:6px}' +
      '.lt-txt label{font-size:13px;font-weight:800;color:#eee}' +
      '.lt-txt label small{font-weight:400;color:#9a9aae}' +
      '.lt-txt input{background:#14141c;border:1.5px solid #8b7bff;border-radius:10px;color:#fff;padding:10px 12px;font-size:15px;font-family:inherit;outline:none}' +
      '.lt-txt .lt-tip{font-size:12px;color:#9a9aae;line-height:1.5}' +
      '.lt-txt .lt-ai{font-size:13px;color:#ffd479;line-height:1.5;min-height:18px}' +
      '.lt-row{display:flex;gap:10px;flex-wrap:wrap;justify-content:center}' +
      '.lt-b{border:1.5px solid #555;background:#1b1b24;color:#eee;border-radius:10px;padding:10px 16px;font-size:14px;font-weight:800;cursor:pointer;font-family:inherit}' +
      '.lt-b.go{border-color:#8b7bff;background:linear-gradient(135deg,#7c6dfa,#a78bfa);color:#fff}' +
      '.lt-b:disabled{opacity:.45;cursor:not-allowed}';
    document.head.appendChild(s);
  }

  // 視窗:回傳 {x,y,text}(0~1)或 'skip';關掉視窗 = null(不生成)
  function ask(src, prev, key) {
    return new Promise(function (resolve) {
      css();
      var w = document.createElement('div'); w.className = 'lt-wrap';
      w.innerHTML =
        '<h3>🏷 商品上的 LOGO 在哪裡?</h3>' +
        '<div class="lt-hint">在商品照上<b>點一下品牌 LOGO</b>,生出來的廣告圖會照這裡把 LOGO 對準。<br>商品上沒有 LOGO 就按「跳過」。</div>' +
        '<div class="lt-box"><img alt=""><div class="lt-dot" style="display:none"></div></div>' +
        '<div class="lt-txt" style="display:none">' +
        '  <label>LOGO 上寫的字 <small>(選填,填了字最準)</small></label>' +
        '  <input type="text" maxlength="40" placeholder="例如:MOZ sweden">' +
        '  <div class="lt-ai"></div>' +
        '  <div class="lt-tip">照商品上的大小寫打,兩行就用空格分開。LOGO 很小、AI 看不清楚的時候,靠這一格把字寫對。</div>' +
        '</div>' +
        '<div class="lt-row">' +
        '  <button class="lt-b" data-lt="skip">跳過</button>' +
        '  <button class="lt-b go" data-lt="ok" disabled>確定,開始生成</button>' +
        '  <button class="lt-b" data-lt="cancel">取消</button>' +
        '</div>';
      document.body.appendChild(w);
      var img = w.querySelector('img'), dot = w.querySelector('.lt-dot'), ok = w.querySelector('[data-lt="ok"]');
      var txtBox = w.querySelector('.lt-txt'), inp = w.querySelector('.lt-txt input');
      inp.value = (prev && prev.text) || lsGet('lt_txt_' + key) || lsGet('lt_txt_b_' + brandNow());
      var pt = (prev && prev.x != null) ? { x: prev.x, y: prev.y } : null;
      //  🤖 v1.3 自動讀 LOGO 字:格子空的才讀;客人自己打過字(typed)就不覆蓋
      var aiLine = w.querySelector('.lt-ai'), typed = !!inp.value, autoVal = '', seq = 0, rt = null;
      inp.addEventListener('input', function () { if (inp.value !== autoVal) typed = true; });
      function readSoon() {
        if (typed || !pt) return;
        clearTimeout(rt);
        rt = setTimeout(async function () {
          var my = ++seq;
          aiLine.textContent = '🤖 讀取 LOGO 上的字中…';
          var r = null;
          try {
            var tight = await cropAt(src, pt, 0.075, 160), wide = await cropAt(src, pt, 0.18, 240);
            var u1 = await put(tight), u2 = await put(wide);
            r = await kp({ action: 'logo_read', urls: [u1, u2], brandName: brandName() });
          } catch (e) { r = null; }
          if (my !== seq || typed || !document.body.contains(w)) return;
          if (r && r.ok && r.text) {
            autoVal = r.text; inp.value = r.text;
            aiLine.textContent = '🤖 AI 讀到「' + r.text + '」—— 請看一眼對不對,不對直接改';
          } else {
            aiLine.textContent = '🤖 AI 看不清楚這個 LOGO,請自己填上面的字(不填也能生成)';
          }
        }, 350);
      }
      function place() {
        if (!pt) return;
        dot.style.display = 'block';
        dot.style.left = (pt.x * img.clientWidth) + 'px';
        dot.style.top = (pt.y * img.clientHeight) + 'px';
        txtBox.style.display = 'flex';
        ok.disabled = false;
        readSoon();
      }
      img.onload = place;
      img.src = src;
      img.addEventListener('click', function (e) {
        var r = img.getBoundingClientRect();
        pt = { x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)) };
        place();
      });
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter' && pt) ok.click(); });
      w.addEventListener('click', function (e) {
        var b = e.target.closest('[data-lt]'); if (!b) return;
        var k = b.getAttribute('data-lt');
        if (k === 'ok' && !pt) return;
        w.remove();
        if (k === 'ok') {
          var t = cleanText(inp.value);
          lsSet('lt_txt_' + key, t);
          if (t) lsSet('lt_txt_b_' + brandNow(), t);
          resolve({ x: pt.x, y: pt.y, text: t });
        } else resolve(k === 'skip' ? 'skip' : null);
      });
    });
  }

  //  同一張商品照只下載一次(點 LOGO 視窗裡每點一次都要切近景)
  var _bmSrc = '', _bmP = null;
  function bitmapOf(src) {
    if (src !== _bmSrc || !_bmP) {
      _bmSrc = src;
      _bmP = (async function () {
        var blob = (typeof urlToBlob === 'function') ? await urlToBlob(src) : await (await fetch(src, { cache: 'no-store' })).blob();
        return createImageBitmap(blob);
      })();
      _bmP.catch(function () { _bmSrc = ''; _bmP = null; });
    }
    return _bmP;
  }

  // 從原商品照切 LOGO 近景(真實像素,輸出 512 見方)
  //  sizeFrac:近景佔商品照短邊的比例。一般 0.18(帶到 LOGO 周圍);tight 0.075(LOGO 塞滿,局部修字用)
  async function cropAt(src, pt, sizeFrac, minSide) {
    //  v1.1 用 admaker 的 urlToBlob 讀檔(它會避開「畫面上 <img> 先載過 → 快取少了跨網域許可」那個坑);
    //   v1.0 用 loadImageSmart → 圖被瀏覽器標成不能讀 → 切不出近景(實測 cdn 商品照)
    var im = await bitmapOf(src);
    var W = im.width, H = im.height, m = Math.min(W, H);
    var side = Math.round(Math.min(m, Math.max(minSide || 240, m * (sizeFrac || 0.18))));
    var sx = Math.round(Math.max(0, Math.min(W - side, pt.x * W - side / 2)));
    var sy = Math.round(Math.max(0, Math.min(H - side, pt.y * H - side / 2)));
    var c = document.createElement('canvas'); c.width = 512; c.height = 512;
    var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 512, 512);
    x.imageSmoothingQuality = 'high';
    x.drawImage(im, sx, sy, side, side, 0, 0, 512, 512);
    return c.toDataURL('image/jpeg', 0.92);
  }

  // ─────────────────────────────────────────────────────────────
  //  🔧 v1.2 局部放大修 LOGO
  // ─────────────────────────────────────────────────────────────
  //  kol-proxy(素材那台):找 LOGO 位置 product_detail_boxes、暫存小圖 ad_touchup_put
  //   ⚠️ 不能用 callWorker(它打 photoroom-proxy)—— 2026-08-11 踩過「打錯台 → 未知的 action」
  async function kp(body) {
    var url = (typeof KOL_WORKER_URL !== 'undefined' && KOL_WORKER_URL) ? KOL_WORKER_URL : 'https://kol-proxy.calm-sunset-6b66.workers.dev';
    var tk = ''; try { tk = sessionStorage.getItem('bs_auth_token') || localStorage.getItem('bs_auth_token') || ''; } catch (e) {}
    body.password = (typeof GAS_PASSWORD !== 'undefined') ? GAS_PASSWORD : '';
    body.token = tk;
    var r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return r.json();
  }
  function cut(im, sx, sy, side, out) {
    var c = document.createElement('canvas'); c.width = out; c.height = out;
    var x = c.getContext('2d'); x.imageSmoothingQuality = 'high';
    x.drawImage(im, sx, sy, side, side, 0, 0, out, out);
    return c.toDataURL('image/jpeg', 0.93);
  }
  function square(W, H, cx, cy, side) {
    return [Math.round(Math.max(0, Math.min(W - side, cx - side / 2))), Math.round(Math.max(0, Math.min(H - side, cy - side / 2)))];
  }
  async function put(dataUrl) {
    var r = await kp({ action: 'ad_touchup_put', brandId: brandNow() || 'ad', base64: dataUrl });
    if (!r || !r.ok || !r.url) throw new Error('暫存失敗:' + (r && r.error));
    return r.url;
  }
  function brandBox(r) { return r && r.ok && Array.isArray(r.boxes) ? r.boxes.find(function (b) { return b.kind === 'brand'; }) : null; }

  async function fixLogo(imageUrl, lt, isApp) {
    if (!imageUrl || !lt || !lt.text) return null;
    var t0 = Date.now();
    try {
      var im = await createImageBitmap(await urlToBlob(imageUrl));
      var W = im.width, H = im.height, m = Math.min(W, H);
      //  ① 第一次定位(整張圖)
      var b = brandBox(await kp({ action: 'product_detail_boxes', url: imageUrl }));
      if (!b) { console.warn('[LOGO 修字] 成品上找不到 LOGO,跳過'); return null; }
      var cx = (b.x + b.w / 2) * W, cy = (b.y + b.h / 2) * H;
      //  ② 第二次定位(切 6 成大的一塊放大再找)—— 實測單次會偏 ~200px,兩次縮到 ~60px
      var s2 = Math.round(m * 0.6), p2 = square(W, H, cx, cy, s2);
      var b2 = brandBox(await kp({ action: 'product_detail_boxes', url: await put(cut(im, p2[0], p2[1], s2, 1024)) }));
      if (b2) { cx = p2[0] + (b2.x + b2.w / 2) * s2; cy = p2[1] + (b2.y + b2.h / 2) * s2; }
      //  ③ 修字的那塊:短邊 32%(偏 60px 也一定包得到 LOGO),放大到 1024 給 AI
      var s3 = Math.round(m * 0.32), p3 = square(W, H, cx, cy, s3);
      var patchUrl = await put(cut(im, p3[0], p3[1], s3, 1024));
      var what = isApp ? 'garment' : 'product';
      var how = isApp ? 'stitched into this same fabric' : 'applied to this same surface the same way as in image 2';
      var txt = cleanText(lt.text);
      var prompt =
        'Image 1 is a magnified close-up cut from a finished campaign photograph of a ' + what + '. ' +
        'Image 2 is a close-up of the real brand mark on that ' + what + ', which reads "' + txt + '". ' +
        'In image 1, the brand mark on the ' + what + ' is rewritten so it reads exactly "' + txt + '" like image 2 — ' +
        'the same letters, spelling, letter shapes, line breaks, proportions and colour — ' + how + ' at the same spot and the same size, ' +
        'following its folds, grain, light and shadow, with the same softness and focus as the surface around it. ' +
        'Everything else in image 1 — the ' + (isApp ? 'fabric, seams, zipper, collar, skin' : 'product surface, edges, hands') + ', background, light and framing — stays exactly as it is.';
      var fix = await callWorker({
        action: 'fal_submit',
        endpoint: 'openai/gpt-image-2/edit',
        payload: { prompt: prompt, image_urls: [patchUrl, lt.tight || lt.crop], image_size: { width: 1024, height: 1024 }, quality: 'high', num_images: 1 }
      });
      if (!fix || !fix.ok || !fix.imageUrl) { console.warn('[LOGO 修字] AI 失敗,用原圖:', fix && fix.error); return null; }
      //  ④ 縮回原位,邊緣 12% 漸層融合(看不到切線),其他像素原封不動
      var pim = await createImageBitmap(await urlToBlob(fix.imageUrl));
      var f = Math.round(s3 * 0.12);
      var pc = document.createElement('canvas'); pc.width = s3; pc.height = s3;
      var px = pc.getContext('2d'); px.imageSmoothingQuality = 'high'; px.drawImage(pim, 0, 0, s3, s3);
      var mc = document.createElement('canvas'); mc.width = s3; mc.height = s3;
      var mx = mc.getContext('2d'); mx.filter = 'blur(' + Math.round(f / 2) + 'px)'; mx.fillStyle = '#000'; mx.fillRect(f, f, s3 - 2 * f, s3 - 2 * f);
      px.globalCompositeOperation = 'destination-in'; px.drawImage(mc, 0, 0);
      var out = document.createElement('canvas'); out.width = W; out.height = H;
      var ox = out.getContext('2d'); ox.drawImage(im, 0, 0); ox.drawImage(pc, p3[0], p3[1]);
      var finalUrl = await put(out.toDataURL('image/jpeg', 0.95));
      console.log('[LOGO 修字] ✅「' + txt + '」· ' + Math.round((Date.now() - t0) / 1000) + ' 秒 · 修的區塊', p3[0], p3[1], s3);
      return finalUrl;
    } catch (e) {
      console.warn('[LOGO 修字] 例外,用原圖(不擋出圖):', e.message);
      return null;
    }
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
            got = await ask(src, null, key);
            if (got === null) return;                 // 取消 → 不生成
            memo[key] = got;
          }
          if (got && got !== 'skip') {
            try {
              var crop = await cropAt(src, got, 0.18, 240);
              var tight = null; try { tight = await cropAt(src, got, 0.075, 160); } catch (e2) {}
              if (crop) window._amLogoTap = { crop: crop, tight: tight, text: got.text || '', x: got.x, y: got.y };
            } catch (e) { console.warn('[LOGO 點選] 切近景失敗(照常生成,不影響):', e.message); }
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
  window.AdLogoTap = { version: VERSION, reset: function () { memo = {}; }, fixLogo: fixLogo, _ask: ask };
  console.log('[AdLogoTap] 🏷 v' + VERSION + ' 就緒 · 生成廣告圖前點一下商品 LOGO(AI 先讀字、客人確認)· 出圖後局部放大修字');
})();
