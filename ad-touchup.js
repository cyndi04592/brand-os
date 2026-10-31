// ═══════════════════════════════════════════════════════════════
//  ✏️ ad-touchup.js v1.0(2026-10-31)— 廣告圖「局部修改」第一版
//  RA:白紙新手、阿公阿嬤也要會用;人眼點的位置比 AI 自己找的準。
//   ① 客人在成品上「塗一下」或「點一下」要改的地方
//   ② 選「把這裡刪掉」或「我自己說」一句話 → kol-proxy ad_touchup(60 點,失敗自動退)
//   ③ AI 每次都拿【第一份原圖】改(不拿改過的再改 → 不會越改越走樣)
//   ④ 改完只取「塗到的範圍」貼到目前這張上,範圍外一個像素都不動
//   ⑤ 客人按「用這張」才換掉;隨時可以「回到第一份」
//  依賴(admaker.js):LAST_POSTER_URL、PR_BG_IMG、renderGptPosterCanvas、loadImageSmart、
//                     saveAdImageSilently、_kolPost、setPrStatus、bumpBitsDisplay(有就用)
//  掛載:index.html 在 admaker.js 後面一行 <script src="ad-touchup.js">;按鈕自己插在「變 5 秒影片」上面
// ═══════════════════════════════════════════════════════════════
(function () {
  'use strict';
  if (window.AdTouchup) return;
  var VERSION = '1.0';
  var COST = 60;

  // 這一張廣告圖的版本紀錄(換新廣告圖就重來)
  var T = { orig: '', origImg: null, cur: null, curUrl: '', known: {}, busy: false };

  function $(id) { return document.getElementById(id); }
  //  admaker.js 的 LAST_POSTER_URL / PR_BG_IMG 是最上層的 let(不掛在 window 上)→ 直接用名字讀寫
  function getPoster() { try { return (typeof LAST_POSTER_URL !== 'undefined' && LAST_POSTER_URL) ? String(LAST_POSTER_URL) : ''; } catch (e) { return ''; } }
  function setPoster(v) { try { LAST_POSTER_URL = v; } catch (e) {} }
  function setBg(v) { try { PR_BG_IMG = v; } catch (e) {} }
  function toast(m, bad) {
    try { if (typeof setPrStatus === 'function') { setPrStatus((bad ? '⚠️ ' : '✅ ') + m, bad ? 'var(--red)' : 'var(--mint)'); return; } } catch (e) {}
    console.log('[局部修改] ' + m);
  }

  // ── 按鈕:有廣告圖才出現,插在「變 5 秒影片」上面 ──
  function mountBtn() {
    var vb = $('posterToVideoBtn');
    if (!vb) return;
    var b = $('touchupBtn');
    if (!b) {
      b = document.createElement('button');
      b.id = 'touchupBtn';
      b.type = 'button';
      b.textContent = '✏️ 局部修改(塗一下要改的地方)';
      b.style.cssText = 'display:none;width:100%;padding:10px;border-radius:8px;background:rgba(124,109,250,0.12);border:1.5px dashed rgba(124,109,250,0.7);color:#E8DCFF;font-family:"Noto Sans TC";font-size:12px;font-weight:900;cursor:pointer;letter-spacing:1px;margin-top:6px;';
      b.onclick = open;
      vb.parentNode.insertBefore(b, vb);
    }
    var url = getPoster();
    b.style.display = (url && /^https?:\/\//.test(url)) ? 'block' : 'none';
    // 換了新的廣告圖(不是我們自己存的修改版)→ 版本紀錄重來
    if (url && /^https?:\/\//.test(url) && !T.known[url] && url !== T.orig) {
      T = { orig: url, origImg: null, cur: null, curUrl: url, known: {}, busy: false };
    }
  }
  setInterval(mountBtn, 800);

  // ── 視窗 ──
  var M = null;   // { wrap, view, vctx, mask, mctx, W, H, tool, size, strokes, drawing, last, after, showBefore }
  function css() {
    if ($('tu-css')) return;
    var s = document.createElement('style');
    s.id = 'tu-css';
    s.textContent =
      '.tu-wrap{position:fixed;inset:0;z-index:99990;background:rgba(6,6,10,.92);display:flex;flex-direction:column;align-items:center;padding:12px;gap:10px;overflow:auto;font-family:"Noto Sans TC",sans-serif;color:#eee}' +
      '.tu-top{width:100%;max-width:760px;display:flex;justify-content:space-between;align-items:center;gap:8px}' +
      '.tu-top b{font-size:15px}' +
      '.tu-x{background:none;border:1px solid #555;color:#ddd;border-radius:8px;padding:6px 12px;cursor:pointer;font-size:13px}' +
      '.tu-stage{position:relative;max-width:760px;width:100%;display:flex;justify-content:center}' +
      '.tu-stage canvas{max-width:100%;max-height:62vh;border-radius:8px;touch-action:none;cursor:crosshair;background:#111}' +
      '.tu-row{width:100%;max-width:760px;display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:center}' +
      '.tu-b{border:1.5px solid #555;background:#1b1b24;color:#eee;border-radius:10px;padding:10px 14px;font-size:14px;font-weight:800;cursor:pointer;font-family:inherit}' +
      '.tu-b.on{border-color:#8b7bff;background:#2a2450;color:#fff}' +
      '.tu-b.go{border-color:#8b7bff;background:linear-gradient(135deg,#7c6dfa,#a78bfa);color:#fff}' +
      '.tu-b:disabled{opacity:.45;cursor:not-allowed}' +
      '.tu-hint{font-size:12px;color:#aab;text-align:center;line-height:1.6;max-width:760px}' +
      '.tu-txt{flex:1;min-width:200px;max-width:520px;background:#14141c;border:1.5px solid #555;color:#fff;border-radius:10px;padding:10px 12px;font-size:14px;font-family:inherit}';
    document.head.appendChild(s);
  }

  async function open() {
    if (T.busy) return;
    var url = getPoster();
    if (!url || !/^https?:\/\//.test(url)) { toast('請先生成廣告圖', true); return; }
    if (!T.orig) T.orig = url;
    css();
    try {
      if (!T.origImg) T.origImg = (await loadImageSmart(T.orig)).img;
      if (!T.cur) T.cur = T.origImg;
    } catch (e) { toast('這張圖暫時讀不到,請稍後再試', true); return; }
    var W = T.origImg.naturalWidth || T.origImg.width, H = T.origImg.naturalHeight || T.origImg.height;
    var sc = Math.min(1, 2048 / Math.max(W, H)); W = Math.round(W * sc); H = Math.round(H * sc);

    var wrap = document.createElement('div');
    wrap.className = 'tu-wrap';
    wrap.innerHTML =
      '<div class="tu-top"><b>✏️ 局部修改</b><button class="tu-x" data-tu="close">✕ 關閉</button></div>' +
      '<div class="tu-hint" data-tu="hint">在圖上<b>塗一下</b>(或<b>點一下</b>)要改的地方,紅色就是會改的範圍,其他地方完全不會動。</div>' +
      '<div class="tu-stage"><canvas data-tu="view"></canvas></div>' +
      '<div class="tu-row" data-tu="tools">' +
      '  <button class="tu-b on" data-tu="brush">🖌 塗抹</button>' +
      '  <button class="tu-b" data-tu="tap">👆 點一下</button>' +
      '  <span style="font-size:12px;color:#aab">筆刷</span><input type="range" min="1" max="10" value="4" data-tu="size" style="width:110px">' +
      '  <button class="tu-b" data-tu="undo">↩ 上一步</button>' +
      '  <button class="tu-b" data-tu="clear">🗑 全部清掉</button>' +
      '</div>' +
      '<div class="tu-row" data-tu="acts">' +
      '  <button class="tu-b" data-tu="remove">🧽 把這裡刪掉</button>' +
      '  <input class="tu-txt" data-tu="text" maxlength="60" placeholder="或寫一句要怎麼改,例如:這裡多一個咖啡杯">' +
      '  <button class="tu-b go" data-tu="send">送出修改 · ' + COST + ' 點</button>' +
      '</div>' +
      '<div class="tu-row" data-tu="result" style="display:none">' +
      '  <button class="tu-b" data-tu="before">👀 按住看修改前</button>' +
      '  <button class="tu-b go" data-tu="use">✅ 用這張</button>' +
      '  <button class="tu-b" data-tu="again">🔄 再試一次 · ' + COST + ' 點</button>' +
      '  <button class="tu-b" data-tu="drop">✖ 不要這次的</button>' +
      '</div>' +
      '<div class="tu-row"><button class="tu-b" data-tu="reset" style="display:' + (T.cur !== T.origImg ? 'inline-block' : 'none') + '">⏮ 回到第一份(免費)</button></div>' +
      '<div class="tu-hint">AI 每次都拿第一份原圖來改,所以不會越改越走樣。失敗會自動退點。</div>';
    document.body.appendChild(wrap);

    var view = wrap.querySelector('[data-tu="view"]');
    view.width = W; view.height = H;
    var mask = document.createElement('canvas'); mask.width = W; mask.height = H;
    M = { wrap: wrap, view: view, vctx: view.getContext('2d'), mask: mask, mctx: mask.getContext('2d'),
          W: W, H: H, tool: 'brush', size: 4, strokes: [], drawing: false, last: null, after: null, afterImg: null, showBefore: false, lastMode: '', lastText: '' };
    bind();
    draw();
  }

  function q(k) { return M && M.wrap.querySelector('[data-tu="' + k + '"]'); }
  function close() { if (M) { M.wrap.remove(); M = null; } }
  function brushPx() { return Math.max(6, Math.round(Math.min(M.W, M.H) * 0.008 * M.size)); }

  // 畫面:目前這張(或修改結果)+ 紅色範圍
  function draw() {
    if (!M) return;
    var c = M.vctx;
    c.globalCompositeOperation = 'source-over';
    c.clearRect(0, 0, M.W, M.H);
    var base = (M.after && !M.showBefore) ? M.after : T.cur;
    c.drawImage(base, 0, 0, M.W, M.H);
    if (!M.after) {
      var t = document.createElement('canvas'); t.width = M.W; t.height = M.H;
      var tc = t.getContext('2d');
      tc.fillStyle = 'rgba(255,40,60,0.45)'; tc.fillRect(0, 0, M.W, M.H);
      tc.globalCompositeOperation = 'destination-in'; tc.drawImage(M.mask, 0, 0);
      c.drawImage(t, 0, 0);
    }
  }

  function redrawMask() {
    var m = M.mctx;
    m.clearRect(0, 0, M.W, M.H);
    m.fillStyle = '#fff'; m.strokeStyle = '#fff'; m.lineCap = 'round'; m.lineJoin = 'round';
    M.strokes.forEach(function (s) {
      if (s.tap) { m.beginPath(); m.arc(s.pts[0][0], s.pts[0][1], s.r, 0, Math.PI * 2); m.fill(); return; }
      m.lineWidth = s.r * 2;
      m.beginPath(); m.moveTo(s.pts[0][0], s.pts[0][1]);
      for (var i = 1; i < s.pts.length; i++) m.lineTo(s.pts[i][0], s.pts[i][1]);
      if (s.pts.length === 1) m.lineTo(s.pts[0][0] + 0.1, s.pts[0][1]);
      m.stroke();
    });
  }

  function pos(e) {
    var r = M.view.getBoundingClientRect();
    return [(e.clientX - r.left) * M.W / r.width, (e.clientY - r.top) * M.H / r.height];
  }

  function bind() {
    var v = M.view;
    v.addEventListener('pointerdown', function (e) {
      if (M.after || T.busy) return;
      e.preventDefault();
      var p = pos(e);
      if (M.tool === 'tap') {
        M.strokes.push({ tap: true, r: Math.round(Math.min(M.W, M.H) * 0.035 * (M.size / 4 + 0.5)), pts: [p] });
      } else {
        M.drawing = true; v.setPointerCapture && v.setPointerCapture(e.pointerId);
        M.strokes.push({ r: brushPx(), pts: [p] });
      }
      redrawMask(); draw();
    });
    v.addEventListener('pointermove', function (e) {
      if (!M || !M.drawing) return;
      e.preventDefault();
      M.strokes[M.strokes.length - 1].pts.push(pos(e));
      redrawMask(); draw();
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) { v.addEventListener(ev, function () { if (M) M.drawing = false; }); });

    M.wrap.addEventListener('click', function (e) {
      var t = e.target.closest('[data-tu]'); if (!t) return;
      var k = t.getAttribute('data-tu');
      if (k === 'close') return close();
      if (k === 'brush' || k === 'tap') { M.tool = k; q('brush').classList.toggle('on', k === 'brush'); q('tap').classList.toggle('on', k === 'tap'); return; }
      if (k === 'undo') { M.strokes.pop(); redrawMask(); draw(); return; }
      if (k === 'clear') { M.strokes = []; redrawMask(); draw(); return; }
      if (k === 'remove') return send('remove', '');
      if (k === 'send') return send('custom', (q('text').value || '').trim());
      if (k === 'again') return send(M.lastMode, M.lastText);
      if (k === 'use') return useIt();
      if (k === 'drop') { M.after = null; M.afterImg = null; showResultRow(false); draw(); return; }
      if (k === 'reset') return resetToFirst();
    });
    q('size').addEventListener('input', function () { M.size = Number(this.value) || 4; });
    var bf = q('before');
    var on = function (e) { e.preventDefault(); M.showBefore = true; draw(); }, off = function () { if (M) { M.showBefore = false; draw(); } };
    bf.addEventListener('pointerdown', on); bf.addEventListener('pointerup', off); bf.addEventListener('pointerleave', off);
  }

  function showResultRow(on) {
    q('result').style.display = on ? 'flex' : 'none';
    q('acts').style.display = on ? 'none' : 'flex';
    q('tools').style.display = on ? 'none' : 'flex';
    q('hint').innerHTML = on
      ? '這是修改後的樣子。<b>按住「看修改前」</b>可以比對;滿意就按「用這張」。'
      : '在圖上<b>塗一下</b>(或<b>點一下</b>)要改的地方,紅色就是會改的範圍,其他地方完全不會動。';
  }

  function maskEmpty() {
    var d = M.mctx.getImageData(0, 0, M.W, M.H).data;
    for (var i = 3; i < d.length; i += 64) if (d[i] > 0) return false;
    return true;
  }

  // 圖 2:原圖 + 紅色範圍(給 AI 看要改哪裡)
  function markedDataUrl() {
    var c = document.createElement('canvas'); c.width = M.W; c.height = M.H;
    var x = c.getContext('2d');
    x.drawImage(T.origImg, 0, 0, M.W, M.H);
    var t = document.createElement('canvas'); t.width = M.W; t.height = M.H;
    var tc = t.getContext('2d');
    tc.fillStyle = 'rgba(255,0,0,0.6)'; tc.fillRect(0, 0, M.W, M.H);
    tc.globalCompositeOperation = 'destination-in'; tc.drawImage(M.mask, 0, 0);
    x.drawImage(t, 0, 0);
    return c.toDataURL('image/jpeg', 0.85);
  }

  // 範圍外貼回:目前這張 + (AI 結果 ∩ 範圍,邊緣柔化)
  function compose(aiImg) {
    var c = document.createElement('canvas'); c.width = M.W; c.height = M.H;
    var x = c.getContext('2d');
    x.drawImage(T.cur, 0, 0, M.W, M.H);
    var soft = document.createElement('canvas'); soft.width = M.W; soft.height = M.H;
    var sc = soft.getContext('2d');
    var f = Math.max(3, Math.round(Math.min(M.W, M.H) * 0.006));
    try { sc.filter = 'blur(' + f + 'px)'; } catch (e) {}
    sc.drawImage(M.mask, 0, 0);
    var t = document.createElement('canvas'); t.width = M.W; t.height = M.H;
    var tc = t.getContext('2d');
    tc.drawImage(aiImg, 0, 0, M.W, M.H);
    tc.globalCompositeOperation = 'destination-in'; tc.drawImage(soft, 0, 0);
    x.drawImage(t, 0, 0);
    return c;
  }

  async function send(mode, text) {
    if (T.busy || !M) return;
    if (maskEmpty()) { toast('先在圖上塗一下要改的地方', true); q('hint').innerHTML = '⚠️ 先在圖上<b>塗一下</b>要改的地方,再按送出。'; return; }
    if (mode === 'custom' && !text) { q('hint').innerHTML = '⚠️ 請在框裡寫一句要怎麼改,或按「把這裡刪掉」。'; q('text').focus(); return; }
    var marked;
    try { marked = markedDataUrl(); } catch (e) { q('hint').textContent = '⚠️ 這張圖暫時不能修改(圖片來源被瀏覽器擋住),請重新生成一次再試。'; return; }
    T.busy = true; M.lastMode = mode; M.lastText = text;
    ['send', 'remove', 'again', 'use', 'drop'].forEach(function (k) { var b = q(k); if (b) b.disabled = true; });
    var msgs = ['AI 正在改…(約 1 分鐘)', 'AI 正在把修改對齊原圖的光線…', '快好了,再等一下…'], mi = 0;
    q('hint').textContent = msgs[0];
    var tick = setInterval(function () { mi = Math.min(mi + 1, msgs.length - 1); if (M) q('hint').textContent = msgs[mi]; }, 25000);
    try { if (typeof bumpBitsDisplay === 'function') bumpBitsDisplay(-COST); } catch (e) {}
    var res = null;
    try {
      res = await _kolPost({ action: 'ad_touchup', imageUrl: T.orig, markedImage: marked, mode: mode, text: text, width: M.W, height: M.H, brandId: (window.S && window.S.brandId) || '' });
    } catch (e) { res = { ok: false, error: '網路斷了一下,點數會自動退還,請再試一次' }; }
    clearInterval(tick);
    T.busy = false;
    if (!M) return;
    ['send', 'remove', 'again', 'use', 'drop'].forEach(function (k) { var b = q(k); if (b) b.disabled = false; });
    if (!res || !res.ok || !res.url) {
      try { if (typeof bumpBitsDisplay === 'function') bumpBitsDisplay(COST); } catch (e) {}
      var err = String((res && (res.error || res.message)) || '');
      q('hint').textContent = /INSUFFICIENT_BITS/i.test(err)
        ? '能量不足:局部修改一次 ' + COST + ' 點' + (res && res.balance != null ? ',目前餘額 ' + res.balance + ' 點' : '') + '。可以到「訂閱方案」加購補給包。'
        : (err || '這次沒有改成功,點數已退還,請再試一次。');
      return;
    }
    try {
      var ai = (await loadImageSmart(res.url)).img;
      M.after = compose(ai);
      showResultRow(true);
      draw();
    } catch (e) {
      q('hint').textContent = '改好了但讀不到圖,請按「再試一次」。';
    }
  }

  async function apply(canvasOrImg, label) {
    var c = canvasOrImg;
    if (!(c instanceof HTMLCanvasElement)) {
      var cc = document.createElement('canvas'); cc.width = M.W; cc.height = M.H; cc.getContext('2d').drawImage(c, 0, 0, M.W, M.H); c = cc;
    }
    var data = c.toDataURL('image/jpeg', 0.92);
    // 畫面先換(含品牌 logo 疊圖),存檔在背景跑
    setBg(data);
    try { await renderGptPosterCanvas(); } catch (e) {}
    try {
      var put = await _kolPost({ action: 'ad_touchup_put', base64: data, brandId: (window.S && window.S.brandId) || '' });
      if (put && put.ok && put.url) {
        T.known[put.url] = 1; T.curUrl = put.url;
        setPoster(put.url);
        try { saveAdImageSilently(put.url, 'poster', 'touchup_' + Date.now()); } catch (e) {}
      }
    } catch (e) { console.warn('[局部修改] 存檔失敗(畫面已更新,可以直接下載):', e.message); }
    toast(label);
  }

  async function useIt() {
    if (!M || !M.after) return;
    try {
      var img = new Image();
      img.src = M.after.toDataURL('image/png');
      await new Promise(function (r) { img.onload = r; });
      T.cur = img;
      var c = M.after;
      close();
      await apply(c, '已套用局部修改 · 可以繼續修,或下載 / 變影片');
    } catch (e) {
      if (M) q('hint').textContent = '⚠️ 這張圖暫時不能套用(圖片來源被瀏覽器擋住),請重新生成一次再試。';
    }
  }

  async function resetToFirst() {
    if (!M || T.busy) return;
    T.cur = T.origImg;
    var img = T.origImg;
    close();
    setBg(T.orig);
    setPoster(T.orig);
    try { await renderGptPosterCanvas(); } catch (e) {}
    toast('已回到第一份');
    void img;
  }

  window.AdTouchup = { version: VERSION, open: open };
  console.log('[AdTouchup] ✏️ v' + VERSION + ' 就緒 · 廣告圖局部修改(塗/點 → 刪掉或一句話)· 範圍外貼回原圖 · 每次都從第一份改');
})();
