/* admaker-motion.js · v1.0 — 廣告圖「商品運鏡影片」(取代舊的「變 5 秒影片」)
   ─────────────────────────────────────────────────────────────────────
   2026-10-25 RA 拍板:
     · 廣告圖做好後,直接讓它變成一支有運鏡的商品影片(範本:MOZ 皮革方包 Reels)
     · 引擎從 Kling(fal)換成 Seedance 2.0 —— 走 Worker 現成的 seedance_submit,不動 Worker
     · 長度 10 秒為主、可選 15 秒;點數跟 KOL 影片同一套(每秒 60 點 → 600 / 900)
       (舊的 Kling 5 秒反而收 960 點)
   做法:
     · [Image1] = 剛做好的廣告圖(場景、光、商品樣子全部以它為準)
     · [Image2] = 客人原本的商品照(只用來把商品形狀/logo/標籤/顏色校正回來)
     · 運鏡用預設組合(6 種),提示詞只寫「鏡頭怎麼走」與「商品的事實」,不寫禁止句
     · v1.7:RA 選 A 版 → 回到 v1.0 運鏡與提示詞(1 張商品照、無裁切)。已知取捨:拉近拍品牌標時字可能不準。
     · v1.6:運鏡分鏡移到提示詞最前面、參考圖說明縮短(RA:加了裁切後運鏡變弱。方法庫 C7「鏡頭寫在最前面」;
       參考圖段落太長會把鏡頭的份量擠掉,模型就只顧著把商品照抄好、鏡頭不敢動)
     · v1.5(RA 點子):做廣告圖的那張原始商品照,系統自動切成「近、中」好幾張裁切圖一起送 ——
       客人不用多拍、不用多勾,特寫時品牌標、車線都有真圖可抄。裁切是原圖真實像素,不是 AI 補的。
     · v1.4:客人可以在視窗裡多勾幾張同商品的照片(細節、不同角度,最多 5 張)當參考;
       勾了 2 張以上,質感棚拍就會拉近拍品牌標,並寫明「照商品照原樣」→ 有真圖可抄,標才不會被亂寫(RA:拉近本身就是質感,參考圖要變多)
     · v1.3:分鏡不再點名 logo(實測微距拍 logo 會被 AI 亂寫成別的字;廣告圖那邊同一條鐵律:提示詞不提 logo)
     · 一律走 PiAPI 的 Seedance 2.0(RA 2026-10-25 拍板;fal 那條實測排隊 20 分鐘以上還沒好)
   依賴(都在 admaker.js,全域可取):
     LAST_POSTER_URL · SELECTED_PRODTYPE · startProgress
     finishProgress · failProgress · setPrStatus · showVideoInCanvas · saveVideoSilently · _adSize
   載入:index.html 在 admaker.js / admaker-prompt-lean.js 之後載入本檔。
   v1.1(同日實測修):callWorker 打的是 photoroom-proxy(廣告圖那支),那邊沒有 seedance_submit
        → 送出與查進度一律直接打 kol-proxy(KOL 影片同一支),帶 email + 登入通行證(扣點要認人)。
   退回舊版:Console 打 window.AD_MOTION = false → 「變影片」按鈕走回 admaker.js 原本的 Kling 流程。
*/
(function () {
  'use strict';
  var VER = 'v2.1';
  //  v2.1(RA 選「兩個都做」,實測後調整):
  //   · 客人在視窗裡的商品照上「點一下 logo」(可跳過)→ 從原圖以那一點為中心切兩張(近、中)→ 分鏡拍品牌標時指名照那張
  //   · 沒點 → 退回 v1.8 四格裁切
  //   · AI 自動定位/讀字實測不準(把 moz 讀成 ITDC、FROST,框也偏)→ 先不用,detailCrops 留著
  //  v2.0(RA:logo 又跑了 → 要抓原商品放大、每個鏡位都有精準參考圖)
  //   先請 AI 看原商品照,找出「品牌標/字」與招牌細節在照片的哪裡(Worker v6.35 product_detail_boxes),
  //   再把那幾個位置從原圖精準放大裁切;分鏡拍品牌標時直接指名「照 [ImageK] 一模一樣」。
  //   AI 定位失敗才退回 v1.8 的四格裁切。
  //  v1.9:A 版的「旋轉」原本是抽到的(同提示詞不一定有)→ 質感棚拍明寫鏡頭微傾斜、退出時邊轉邊回正,每次都有
  //  v1.7(RA 2026-10-25 看完 A/B/C 三版拍板「A 版」—— 會旋轉、停得夠久,就是她拍片的風格)
  //   → 回到 v1.0 那套:只送 1 張原商品照、提示詞順序與寫法照 v1.0。
  //   裁切圖(v1.5)與加照片(v1.4)會讓運鏡變保守,先關掉;程式留著,開關在下面。
  var USE_CROPS = true, USE_EXTRA = false, A_STYLE = true;
  //  v1.8(RA:要 A 的運鏡,但 logo 不能跑)→ A 版提示詞一字不改,只多送裁切圖,說明只用一句短句(長說明會吃掉運鏡的份量,見 v1.6)

  var SEC_COST = 60;                 // 每秒點數(跟 Worker seedance_submit 同一套)
  var BTN_LABEL = '🎬 商品運鏡影片(10 / 15 秒)';

  // 畫面裡通常有人的類型 → PiAPI;其餘 → fal
  var PEOPLE_TYPES = { apparel: 1, apparel_keep: 1, beauty: 1, medical: 1, course: 1, pro: 1, travel: 1 };

  // ── 運鏡預設 ──────────────────────────────────────────────────────
  //   每個預設給 10 秒與 15 秒兩套分鏡(時間碼寫死,Seedance 照時間走最穩)
  var MOVES = [
    { key: 'luxe', label: '質感棚拍(推薦)', hint: '亮相 → 材質特寫 → 細節 → 回到全景,像 MOZ 那支',
      s10: [
        '[00:00-00:02] The product in full from a slightly tilted angle, the camera easing slowly toward it.',
        '[00:02-00:05] An extreme close-up glides across its main material, the surface texture crisp as light slides over it.',
        '[00:05-00:07] {{DETAIL}}',
        '[00:07-00:10] The camera arcs back out around the product while rolling smoothly from a tilted angle to level, a soft band of light passing across it, settling on a clean hero frame.'
      ],
      s15: [
        '[00:00-00:03] The product in full from a slightly tilted angle, the camera easing slowly toward it.',
        '[00:03-00:06] An extreme close-up glides across its main material, the surface texture crisp as light slides over it.',
        '[00:06-00:08] {{DETAIL}}',
        '[00:08-00:11] A low angle from the side, the product rising tall in frame.',
        '[00:11-00:15] The camera arcs back out around the product while rolling smoothly from a tilted angle to level, a soft band of light passing across it, settling on a clean hero frame.'
      ] },
    { key: 'sweep', label: '光影掃過', hint: '商品不動,一道光慢慢掃過去',
      s10: [
        '[00:00-00:10] The camera holds still on the product. A soft band of light travels slowly across it from one side to the other, each surface brightening as the light reaches it and easing back after, then the light settles into an even glow.'
      ],
      s15: [
        '[00:00-00:08] The camera holds still on the product. A soft band of light travels slowly across it from one side to the other, each surface brightening as the light reaches it and easing back after.',
        '[00:08-00:15] The camera eases in a little closer while the light returns more slowly, settling into an even glow on a clean hero frame.'
      ] },
    { key: 'pushin', label: '慢慢推近', hint: '從全景一路推到細節',
      s10: [
        '[00:00-00:10] One continuous slow dolly-in from the full set to a close detail of the product, smooth and steady, the focus staying on the product the whole way.'
      ],
      s15: [
        '[00:00-00:10] One continuous slow dolly-in from the full set to a close detail of the product, smooth and steady, the focus staying on the product the whole way.',
        '[00:10-00:15] The camera holds on the detail as light drifts gently across it.'
      ] },
    { key: 'orbit', label: '環繞展示', hint: '鏡頭繞著商品轉,看到不同面',
      s10: [
        '[00:00-00:10] The camera travels in a slow, smooth arc of about sixty degrees around the product at its own height; the product stays exactly in place while its sides turn into view and the light shifts across its surfaces.'
      ],
      s15: [
        '[00:00-00:10] The camera travels in a slow, smooth arc of about sixty degrees around the product at its own height; the product stays exactly in place while its sides turn into view and the light shifts across its surfaces.',
        '[00:10-00:15] The camera rises slightly and settles on a three-quarter hero frame.'
      ] },
    { key: 'reveal', label: '空景登場', hint: '先是空的場景,商品再出現',
      s10: [
        '[00:00-00:02] The same set and surface with the product absent, the light already in place.',
        '[00:02-00:05] The product lowers gently into its place and settles with real weight, a soft contact shadow forming under it.',
        '[00:05-00:10] The camera eases slowly toward it and finishes on a clean hero frame.'
      ],
      s15: [
        '[00:00-00:03] The same set and surface with the product absent, the light already in place.',
        '[00:03-00:06] The product lowers gently into its place and settles with real weight, a soft contact shadow forming under it.',
        '[00:06-00:11] The camera eases slowly toward it, light gliding across its surfaces.',
        '[00:11-00:15] A close detail of its signature part, then a clean hero frame.'
      ] },
    { key: 'macro', label: '材質特寫', hint: '微距鏡頭在商品表面慢慢滑過',
      s10: [
        '[00:00-00:06] A macro camera glides slowly along the product surface, close enough to read the material: grain, weave, stitching or finish, sharp where the focus lands and softly blurred beyond.',
        '[00:06-00:10] The camera pulls back to reveal the whole product in the set.'
      ],
      s15: [
        '[00:00-00:05] A macro camera glides slowly along the product surface, close enough to read the material: grain, weave, stitching or finish, sharp where the focus lands and softly blurred beyond.',
        '[00:05-00:10] The macro moves on to a second part of the product, its edges and details catching the light.',
        '[00:10-00:15] The camera pulls back to reveal the whole product in the set.'
      ] }
  ];

  // ── 直接打 kol-proxy(seedance_submit / fal_poll 都在這支)────────────
  var KOL_PROXY = 'https://kol-proxy.calm-sunset-6b66.workers.dev';
  function kolPost(body) {
    var em = '', tk = '';
    try { em = localStorage.getItem('bs_sso_email') || sessionStorage.getItem('bs_email') || (typeof _userEmail === 'string' ? _userEmail : '') || ''; } catch (e) {}
    try { tk = sessionStorage.getItem('bs_auth_token') || localStorage.getItem('bs_auth_token') || ''; } catch (e) {}
    var pw = (typeof GAS_PASSWORD !== 'undefined') ? GAS_PASSWORD : '';
    var payload = Object.assign({}, body, { password: pw, email: em, token: tk });
    return fetch(KOL_PROXY, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      .then(function (r) { return r.json(); });
  }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  async function pollKol(reqId, endpoint, maxMs) {
    var t0 = Date.now();
    while (Date.now() - t0 < maxMs) {
      await wait(8000);
      try {
        var d = await kolPost({ action: 'fal_poll', requestId: reqId, endpoint: endpoint });
        var st = String((d && d.status) || '').toUpperCase();
        if (d && d.videoUrl && (st === 'COMPLETED' || st === '')) return { status: 'COMPLETED', videoUrl: d.videoUrl };
        if (st === 'FAILED') return { status: 'FAILED', error: d.error || '任務失敗' };
      } catch (e) { console.warn('[商品運鏡] 查進度單次失敗,繼續:', e.message); }
    }
    return { status: 'TIMEOUT' };
  }

  // ── 小工具 ────────────────────────────────────────────────────────
  function el(tag, css, html) { var e = document.createElement(tag); if (css) e.style.cssText = css; if (html != null) e.innerHTML = html; return e; }

  function nearestRatio() {
    var w = 1088, h = 1088;
    try { var s = _adSize(); w = s.w; h = s.h; } catch (e) {}
    var r = w / h;
    var opts = [['21:9', 21 / 9], ['16:9', 16 / 9], ['4:3', 4 / 3], ['1:1', 1], ['3:4', 3 / 4], ['9:16', 9 / 16]];
    var best = opts[3], bd = 9;
    opts.forEach(function (o) { var d = Math.abs(Math.log(r / o[1])); if (d < bd) { bd = d; best = o; } });
    return best[0];
  }

  function _photoUrl(p) {
    if (!p) return '';
    var u = p.full || p.hiRes || p.canvasRes || p.src || '';
    // 只送真的網址;data:/blob:/縮圖都不能餵引擎
    if (!/^https:\/\//.test(u)) return '';
    if (/\/thumbnail|=w\d{2,3}\b|sz=w\d{2,3}/.test(u)) return '';
    return u;
  }
  function _photoThumb(p) { return (p && (p.thumb || p.canvasRes || p.src || p.full)) || ''; }
  // 品牌照片庫(含做這張廣告圖的那張);回傳 [{idx, url, thumb}]
  function libraryPhotos() {
    try {
      var S = window.S || {}, out = [];
      (S.photos || []).forEach(function (p, i) { var u = _photoUrl(p); if (u) out.push({ idx: i, url: u, thumb: _photoThumb(p) }); });
      return out;
    } catch (e) { return []; }
  }
  function mainPhotoIdx() {
    try { var S = window.S || {}; return (S.selPhoto !== null && S.selPhoto !== undefined) ? S.selPhoto : -1; } catch (e) { return -1; }
  }

  // v2.1 以客人點的那一點為中心,從原圖切「近、中」兩張(原圖真實像素)
  async function tapCrops(url, tap) {
    var out = [];
    try {
      var blob = await fetch(url, { mode: 'cors', cache: 'no-store' }).then(function (x) { if (!x.ok) throw new Error('HTTP ' + x.status); return x.blob(); });
      var bmp = await createImageBitmap(blob);
      var W = bmp.width, H = bmp.height, m = Math.min(W, H);
      var cx = tap.x * W, cy = tap.y * H;
      var sizes = [[Math.max(260, m * 0.14), 'brand', 'brand mark, seen up close'], [Math.max(480, m * 0.30), 'detail', 'brand mark and the area around it']];
      for (var k = 0; k < sizes.length; k++) {
        var side = Math.round(Math.min(sizes[k][0], m));
        var sx = Math.round(Math.max(0, Math.min(W - side, cx - side / 2)));
        var sy = Math.round(Math.max(0, Math.min(H - side, cy - side / 2)));
        var cv = document.createElement('canvas'); cv.width = side; cv.height = side;
        cv.getContext('2d').drawImage(bmp, sx, sy, side, side, 0, 0, side, side);
        try { out.push({ url: await uploadToFal(cv.toDataURL('image/jpeg', 0.95)), kind: sizes[k][1], label: sizes[k][2] }); }
        catch (e) { console.warn('[商品運鏡] logo 裁切上傳失敗(略過):', e.message); }
      }
    } catch (e) { console.warn('[商品運鏡] 原圖讀不到,logo 裁切略過:', e.message); }
    return out;
  }

  // v2.0 請 AI 找出品牌標與招牌細節的位置,從原圖精準放大裁切(原圖真實像素)
  async function detailCrops(url) {
    var out = [];
    try {
      var r = await kolPost({ action: 'product_detail_boxes', url: url });
      var boxes = (r && r.ok && Array.isArray(r.boxes)) ? r.boxes : [];
      if (!boxes.length) return out;
      var blob = await fetch(url, { mode: 'cors', cache: 'no-store' }).then(function (x) { if (!x.ok) throw new Error('HTTP ' + x.status); return x.blob(); });
      var bmp = await createImageBitmap(blob);
      var W = bmp.width, H = bmp.height;
      for (var k = 0; k < boxes.length && out.length < 4; k++) {
        var b = boxes[k];
        // 框放大 1.8 倍留邊、至少 360 像素見方,中心不動
        var cx = (b.x + b.w / 2) * W, cy = (b.y + b.h / 2) * H;
        var side = Math.max(360, Math.max(b.w * W, b.h * H) * 1.8);
        side = Math.min(side, Math.min(W, H));
        var sx = Math.round(Math.max(0, Math.min(W - side, cx - side / 2)));
        var sy = Math.round(Math.max(0, Math.min(H - side, cy - side / 2)));
        side = Math.round(side);
        var cv = document.createElement('canvas'); cv.width = side; cv.height = side;
        cv.getContext('2d').drawImage(bmp, sx, sy, side, side, 0, 0, side, side);
        try { out.push({ url: await uploadToFal(cv.toDataURL('image/jpeg', 0.95)), kind: b.kind, label: b.label }); }
        catch (e) { console.warn('[商品運鏡] 細節圖上傳失敗(略過):', e.message); }
      }
    } catch (e) { console.warn('[商品運鏡] 細節定位失敗,改用四格裁切:', e.message); }
    return out;
  }

  // v1.5 把原始商品照切成「中景 + 四個角落近景」(原圖真實像素,不放大不重畫)
  async function makeCrops(url) {
    var out = [];
    try {
      var blob = await fetch(url, { mode: 'cors', cache: 'no-store' })   // no-store:瀏覽器快取裡那份是 <img> 抓的、沒有跨網域許可,直接用會失敗(實測)
        .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.blob(); });
      var bmp = await createImageBitmap(blob);
      var W = bmp.width, H = bmp.height;
      if (Math.min(W, H) < 900) return out;        // 原圖太小,切了也沒細節 → 不切
      var boxes = [
        [0.15, 0.15, 0.70, 0.70],                    // 中景
        [0.00, 0.00, 0.55, 0.55], [0.45, 0.00, 0.55, 0.55],
        [0.00, 0.45, 0.55, 0.55], [0.45, 0.45, 0.55, 0.55]   // 四個角落近景
      ];
      for (var k = 0; k < boxes.length; k++) {
        var b = boxes[k], sx = Math.round(b[0] * W), sy = Math.round(b[1] * H), sw = Math.round(b[2] * W), sh = Math.round(b[3] * H);
        var cv = document.createElement('canvas'); cv.width = sw; cv.height = sh;
        cv.getContext('2d').drawImage(bmp, sx, sy, sw, sh, 0, 0, sw, sh);
        var b64 = cv.toDataURL('image/jpeg', 0.92);
        try { out.push(await uploadToFal(b64)); } catch (e) { console.warn('[商品運鏡] 裁切圖上傳失敗(略過這張):', e.message); }
      }
    } catch (e) { console.warn('[商品運鏡] 原圖讀不到,不切裁切圖(照常生成):', e.message); }
    return out;
  }

  function hasPeople() {
    try { return !!PEOPLE_TYPES[String(SELECTED_PRODTYPE || '')]; } catch (e) { return false; }
  }

  //  refs = { orig: 0|1, crops: n, extra: n }(舊呼叫傳數字也相容:數字 = 原圖+其他照片張數)
  function refLines(refs) {
    var i = 2, out = '';
    if (refs.orig) { out += A_STYLE ? ' [Image' + i + '] is the same product as a plain photo, used only to keep its exact shape, logo, label and colours.' : ' [Image' + i + '] is the real product photo: its exact shape, markings and colours.'; i++; }
    if (refs.details && refs.details.length) {
      refs.details.forEach(function (d) {
        out += ' [Image' + i + '] is a close-up of its ' + (d.label || (d.kind === 'brand' ? 'brand mark' : 'detail')) + ', cut straight from the real photo.';
        d.idx = i; i++;
      });
    }
    if (refs.crops) {
      var a = i, b = i + refs.crops - 1;
      out += ' ' + (a === b ? '[Image' + a + '] is a close-up crop' : '[Image' + a + '] to [Image' + b + '] are close-up crops')
        + (A_STYLE ? ' of that same photo.' : ' of that same photo, for exact detail in close-ups.');
      i = b + 1;
    }
    if (refs.extra) {
      var c = i, d = i + refs.extra - 1;
      out += ' ' + (c === d ? '[Image' + c + '] is another real photo' : '[Image' + c + '] to [Image' + d + '] are more real photos') + ' of the same product from other angles.';
    }
    return out;
  }

  function buildPrompt(move, sec, refs, people) {
    if (typeof refs !== 'object' || !refs) { var n = (refs === true) ? 1 : (refs || 0); refs = { orig: n ? 1 : 0, crops: 0, extra: Math.max(0, n - 1) }; }
    var nProd = (refs.orig || 0) + ((refs.details && refs.details.length) || 0) + (refs.crops || 0) + (refs.extra || 0);
    var _dl = (refs && refs.details) || [], _br = _dl.filter(function (d) { return d.kind === 'brand'; })[0] || _dl[0];
    var detail = (A_STYLE && _br) ? ('A close detail of its ' + (_br.kind === 'brand' ? 'brand mark' : (_br.label || 'signature detail')) + ', exactly as in [Image' + (2 + (refs.orig ? 1 : 0) + _dl.indexOf(_br)) + '], held steady.')
      : A_STYLE ? 'A close detail of its logo, hardware or signature part, held steady.'
      : nProd >= 2
      ? 'A close detail of its signature marking and stitching, every letter and line exactly as in the product photos, held steady.'
      : 'A close detail of its stitching, seams or hardware, held steady.';
    var shots = (sec >= 15 ? move.s15 : move.s10).join('\n').replace('{{DETAIL}}', detail);
    var refs = '[Image1] is the finished ad photo: the set, its light, its colours and the product exactly as they look there.'
      + refLines(refs);
    var subject = people
      ? 'Anyone in [Image1] keeps the same face, hair, clothing and pose style, moving only slightly and naturally.'
      : 'The product is the only subject; the set stays exactly as in [Image1].';
    var truth = A_STYLE
      ? 'The product keeps its true shape, proportions, colours, logo and printed details in every frame, at its real size, resting with real weight and a soft contact shadow.'
      : 'The product keeps its true shape, proportions, colours and markings exactly as in the photos in every frame, at its real size, resting with real weight and a soft contact shadow.';
    var light = 'All light comes from the set in [Image1]; highlights glide over surfaces as the camera moves, and the product\'s whites stay as bright as the other whites around it.';
    var look = A_STYLE
      ? 'A high-end product commercial filmed on a real camera: smooth stabilised moves, natural depth of field, clean frames showing only what is in [Image1].'
      : 'A high-end product commercial filmed on a real cinema camera with bold, confident, smooth camera moves and natural depth of field; every frame shows only what is in [Image1].';
    return (A_STYLE ? [refs, subject, truth, light, look, shots] : [look, shots, refs, subject, truth, light]).join('\n');
  }

  // ── 選單視窗 ──────────────────────────────────────────────────────
  function openPicker() {
    if (!LAST_POSTER_URL) { setPrStatus('⚠️ 請先生成廣告圖', 'var(--red)'); return; }
    if (!/^https:\/\//.test(String(LAST_POSTER_URL))) { setPrStatus('⚠️ 這張廣告圖還沒存成網址,請重新生成一次再做影片', 'var(--red)'); return; }
    var old = document.getElementById('amMotionModal'); if (old) old.remove();

    var pick = { move: MOVES[0], sec: 10 };
    var mask = el('div', 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:16px;');
    mask.id = 'amMotionModal';
    var box = el('div', 'width:100%;max-width:440px;max-height:90vh;overflow:auto;background:#16161d;border:1px solid #2e2e3a;border-radius:14px;padding:18px;color:#e8e8f0;font-family:"Noto Sans TC",sans-serif;');
    box.appendChild(el('div', 'font-size:16px;font-weight:900;margin-bottom:4px;', '🎬 商品運鏡影片'));
    box.appendChild(el('div', 'font-size:12px;color:#9a9aa8;margin-bottom:12px;line-height:1.6;', '用剛做好的廣告圖拍成一支有運鏡的商品影片。選一種動法:'));

    var list = el('div', 'display:flex;flex-direction:column;gap:6px;margin-bottom:14px;');
    function paintMoves() {
      list.innerHTML = '';
      MOVES.forEach(function (m) {
        var on = m.key === pick.move.key;
        var it = el('div', 'padding:9px 11px;border-radius:9px;cursor:pointer;border:1.5px solid ' + (on ? '#7c6dfa' : '#2e2e3a') + ';background:' + (on ? 'rgba(124,109,250,.15)' : 'transparent') + ';',
          '<div style="font-size:13px;font-weight:800;">' + m.label + '</div><div style="font-size:11px;color:#9a9aa8;margin-top:2px;">' + m.hint + '</div>');
        it.onclick = function () { pick.move = m; paintMoves(); };
        list.appendChild(it);
      });
    }
    paintMoves();
    box.appendChild(list);

    // v1.4 多勾幾張同商品的照片(細節/角度)→ 特寫更準
    var lib = libraryPhotos(), mainIdx = mainPhotoIdx();
    // v2.1 點一下 logo 位置(可跳過)
    pick.tap = null;
    var mainPh = lib.filter(function (x) { return x.idx === mainIdx; })[0];
    if (mainPh) {
      box.appendChild(el('div', 'font-size:12px;color:#cdb4ff;font-weight:800;margin:2px 0 4px;', '在商品照上點一下品牌 logo(可跳過)'));
      box.appendChild(el('div', 'font-size:11px;color:#9a9aa8;margin-bottom:6px;line-height:1.5;', '點了之後,影片拉近拍 logo 時會照原圖放大,字不會跑掉。'));
      var tapWrap = el('div', 'position:relative;width:100%;margin-bottom:14px;border-radius:9px;overflow:hidden;cursor:crosshair;border:1px solid #2e2e3a;');
      var tapImg = el('img', 'width:100%;height:auto;display:block;');
      tapImg.src = mainPh.thumb; tapImg.referrerPolicy = 'no-referrer';
      var dot = el('div', 'position:absolute;width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50%;border:3px solid #fa6d9b;box-shadow:0 0 0 2px #fff;display:none;pointer-events:none;');
      tapWrap.appendChild(tapImg); tapWrap.appendChild(dot);
      tapWrap.onclick = function (e) {
        var r = tapImg.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        if (x < 0 || x > 1 || y < 0 || y > 1) return;
        pick.tap = { x: x, y: y };
        dot.style.left = (x * 100) + '%'; dot.style.top = (y * 100) + '%'; dot.style.display = 'block';
      };
      box.appendChild(tapWrap);
    }
    pick.photos = {};
    if (mainIdx >= 0 && lib.some(function (x) { return x.idx === mainIdx; })) pick.photos[mainIdx] = 1;
    if (USE_EXTRA && lib.length) {
      box.appendChild(el('div', 'font-size:12px;color:#cdb4ff;font-weight:800;margin:2px 0 4px;', '(選填)再加幾張同一個商品的其他角度照'));
      box.appendChild(el('div', 'font-size:11px;color:#9a9aa8;margin-bottom:8px;line-height:1.5;', '系統已自動把這張商品照切成近、中景細節一起送。如果還有<b>同一個商品</b>的其他角度照,可以多勾幾張。'));
      var grid = el('div', 'display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px;max-height:170px;overflow:auto;');
      var paintGrid = function () {
        grid.innerHTML = '';
        lib.forEach(function (ph) {
          var on = !!pick.photos[ph.idx];
          var t = el('div', 'width:62px;height:62px;border-radius:8px;overflow:hidden;cursor:pointer;position:relative;border:2px solid ' + (on ? '#7c6dfa' : '#2e2e3a') + ';opacity:' + (on ? 1 : .75) + ';');
          var im = el('img', 'width:100%;height:100%;object-fit:cover;display:block;');
          im.src = ph.thumb; im.referrerPolicy = 'no-referrer';
          t.appendChild(im);
          if (on) t.appendChild(el('div', 'position:absolute;top:2px;right:4px;font-size:12px;color:#fff;text-shadow:0 0 3px #000;', '✓'));
          t.onclick = function () {
            if (pick.photos[ph.idx]) { delete pick.photos[ph.idx]; }
            else if (Object.keys(pick.photos).length < 5) { pick.photos[ph.idx] = 1; }
            paintGrid();
          };
          grid.appendChild(t);
        });
      };
      paintGrid();
      box.appendChild(grid);
    }

    var secRow = el('div', 'display:flex;gap:8px;margin-bottom:14px;');
    function paintSec() {
      secRow.innerHTML = '';
      [10, 15].forEach(function (s) {
        var on = s === pick.sec;
        var b = el('button', 'flex:1;padding:9px;border-radius:9px;cursor:pointer;font-weight:800;font-size:13px;color:#e8e8f0;border:1.5px solid ' + (on ? '#7c6dfa' : '#2e2e3a') + ';background:' + (on ? 'rgba(124,109,250,.15)' : 'transparent') + ';',
          s + ' 秒 · ' + (s * SEC_COST) + ' 點');
        b.onclick = function () { pick.sec = s; paintSec(); };
        secRow.appendChild(b);
      });
    }
    paintSec();
    box.appendChild(secRow);

    var acts = el('div', 'display:flex;gap:8px;');
    var cancel = el('button', 'flex:1;padding:10px;border-radius:9px;border:1px solid #3a3a4a;background:transparent;color:#bbb;cursor:pointer;', '取消');
    var go = el('button', 'flex:2;padding:10px;border-radius:9px;border:none;background:linear-gradient(135deg,#7c6dfa,#fa6d9b);color:#fff;font-weight:900;cursor:pointer;', '開始生成');
    cancel.onclick = function () { mask.remove(); };
    go.onclick = function () {
      var urls = lib.filter(function (x) { return pick.photos[x.idx]; }).map(function (x) { return x.url; });
      // 做廣告圖的那張排第一
      var mainUrl = (lib.filter(function (x) { return x.idx === mainIdx; })[0] || {}).url;
      if (mainUrl && urls.indexOf(mainUrl) > 0) { urls.splice(urls.indexOf(mainUrl), 1); urls.unshift(mainUrl); }
      mask.remove(); runMotion(pick.move, pick.sec, urls.slice(0, 5), pick.tap);
    };
    acts.appendChild(cancel); acts.appendChild(go);
    box.appendChild(acts);

    mask.appendChild(box);
    mask.onclick = function (e) { if (e.target === mask) mask.remove(); };
    document.body.appendChild(mask);
  }

  // ── 送出與等待 ────────────────────────────────────────────────────
  async function runMotion(move, sec, prodUrls, tap) {
    var btn = document.getElementById('posterToVideoBtn');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ 商品運鏡生成中...'; }
    var interval = startProgress(sec >= 15 ? 420000 : 300000);
    try {
      var picked = (prodUrls || []).slice(0, 5);
      var mainUrl = picked[0] || '';
      if (USE_CROPS) setPrStatus(tap ? '從原圖放大 logo...' : '準備商品細節圖...', 'var(--t3)');
      var details = (USE_CROPS && mainUrl && tap) ? await tapCrops(mainUrl, tap) : [];
      var cropUrls = (USE_CROPS && mainUrl && !details.length) ? await makeCrops(mainUrl) : [];
      //  9 張上限:廣告圖 1 + 原圖 1 + 裁切 ≤5 + 其他照片(剩幾格給幾格)
      var extra = USE_EXTRA ? picked.slice(1, 1 + Math.max(0, 9 - 2 - details.length - cropUrls.length)) : [];
      var prods = (mainUrl ? [mainUrl] : []).concat(details.map(function (d) { return d.url; }), cropUrls, extra);
      var refs = { orig: mainUrl ? 1 : 0, details: details.map(function (d) { return { kind: d.kind, label: d.label }; }), crops: cropUrls.length, extra: extra.length };
      var people = hasPeople();
      var prompt = buildPrompt(move, sec, refs, people);
      var brandId = (window.S && window.S.brandId) || '';
      setPrStatus('送出影片任務...', 'var(--t3)');
      var payload = {
        action: 'seedance_submit',
        kolImageUrl: LAST_POSTER_URL,                 // → [Image1] 廣告圖
        productImageUrls: prods,                       // → [Image2]… 同商品的真實照片(校正/特寫用)
        prompt: prompt,
        resolution: '720p',
        duration: String(sec),
        aspectRatio: nearestRatio(),
        generateAudio: false,
        tier: 'fast',
        brandId: brandId,
        kolName: '商品運鏡_' + move.key,
        provider: 'piapi'
      };
      console.log('[商品運鏡] ' + VER + ' · ' + move.label + ' · ' + sec + ' 秒 · ' + payload.aspectRatio
        + ' · 引擎 ' + payload.provider + ' · 商品參考 原圖' + refs.orig + '+細節' + refs.details.length + '(' + refs.details.map(function (d) { return d.kind; }).join('/') + ')+裁切' + refs.crops + '+其他' + refs.extra + ' · 提示詞 ' + prompt.length + ' 字');
      var sub = await kolPost(payload);
      if (sub && sub.error === 'INSUFFICIENT_BITS') {
        if (typeof showInsufficientBits === 'function') { try { showInsufficientBits(sec * SEC_COST); } catch (e) {} }
        throw new Error('點數不足');
      }
      if (!sub || !sub.ok) throw new Error((sub && sub.error) || '提交失敗');

      setPrStatus('⏳ 商品運鏡生成中(約 3-8 分鐘,可以先做別的)...', 'var(--t3)');
      var reqId = sub.requestId || sub.taskId;
      var ep = sub.endpoint || 'piapi';
      if (!reqId) throw new Error('沒有拿到任務編號');
      var result = await pollKol(reqId, ep, 900000);
      if (result.status === 'TIMEOUT') throw new Error('等太久了,影片可能還在生成,稍後到素材庫看看');
      if (result.status === 'FAILED') throw new Error(result.error || '影片生成失敗(失敗會自動退點)');
      if (!result.videoUrl) throw new Error('未取得影片網址');

      showVideoInCanvas(result.videoUrl);
      finishProgress(interval);
      setPrStatus('✅ 商品運鏡影片完成!可右鍵下載', 'var(--mint)');
      if (btn) { btn.textContent = '✅ 已生成 · 再做一支'; btn.disabled = false; }
      saveVideoSilently(result.videoUrl);
      if (typeof window.refreshBits === 'function') { try { window.refreshBits(); } catch (e) {} }
    } catch (e) {
      failProgress(interval, e.message);
      if (btn) { btn.disabled = false; btn.textContent = BTN_LABEL + ' — 失敗,重試'; }
    }
  }

  // ── 接上按鈕 ──────────────────────────────────────────────────────
  var _oldPosterToVideo = window.posterToVideo;
  window.posterToVideo = function () {
    if (window.AD_MOTION === false && typeof _oldPosterToVideo === 'function') return _oldPosterToVideo();
    openPicker();
  };

  // admaker.js 每次出圖會把按鈕字改回「變 5 秒影片」→ 換成新名字
  function relabel() {
    var b = document.getElementById('posterToVideoBtn');
    if (b && /變 ?5 ?秒影片/.test(b.textContent) && window.AD_MOTION !== false) {
      b.textContent = b.textContent.replace(/變 ?5 ?秒影片/, BTN_LABEL);
    }
  }
  function watch() {
    var b = document.getElementById('posterToVideoBtn');
    if (!b) { setTimeout(watch, 800); return; }
    relabel();
    new MutationObserver(relabel).observe(b, { childList: true, characterData: true, subtree: true });
  }
  watch();

  window.AdMotion = { VER: VER, flags: function () { return { USE_CROPS: USE_CROPS, USE_EXTRA: USE_EXTRA, A_STYLE: A_STYLE }; }, MOVES: MOVES, buildPrompt: buildPrompt, openPicker: openPicker };
  console.log('[商品運鏡] ' + VER + ' 就緒 · 「變影片」改走 Seedance 2.0 運鏡(Console 打 window.AD_MOTION=false 退回 Kling)');
})();
