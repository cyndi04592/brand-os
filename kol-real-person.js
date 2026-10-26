/* ═══════════════════════════════════════════════════════════════════
   kol-real-person.js — 創建真人 KOL(v1.4 · 2026-10-26)
   ───────────────────────────────────────────────────────────────────
   職責(只有這一件事):讓客戶用【本人錄影(或照片+錄音)+ 手寫簽名授權書】建一位 KOL。
   v1.4 主路:拍一支 25 秒的本人影片(畫面上有念稿提詞)
     0~15 秒 看鏡頭念稿 → 聲音(取 15 秒,引擎上限)+ 正臉
     15~25 秒 臉慢慢轉向側邊再轉回 → 3/4 側臉 + 側臉
     → 三個角度都是本人,不再讓 AI 去想像側臉(破綻最大的來源)
     影片只在客戶自己的瀏覽器裡處理,不上傳整支影片;只送出截圖與聲音。
   備用路:沒辦法錄影 → 照片 + 錄音(側臉改由 AI 補,同 v1.3)
   授權書 → 全文由 Worker 產生(kol_consent_doc),客戶勾選 + 手指/滑鼠簽名,
     Worker 把簽好的那份連同時間、帳號、IP、檔案指紋存檔(kol_real_create,需 kol-proxy v6.43)。
   入口(都由這支自己掛,kol.html 只要一行 <script>):
     ① 新品牌引導卡的「用真人照片建立」按鈕   ② 「＋建新角色」旁邊的「創建真人」卡
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.KolRealPerson) return;

  const MAX_SEC = 15, MIN_SEC = 4;
  //  錄影時間軸(提詞、截圖、自動停都照這張表)
  const T_READ = 15, T_TOTAL = 25, PICK = { front: 1.0, q34: 17.5, profile: 20.0 };
  //  念稿:四種語氣各一句,讓引擎學到開心 / 介紹 / 提問 / 驚喜的聲音(約 13~15 秒)
  function scriptLines(name) {
    return [
      { tone: '開心打招呼', text: '大家好,我是' + (name || '＿＿') + '!' },
      { tone: '自然介紹', text: '今天想跟你們分享一個我最近超愛的好東西。' },
      { tone: '好奇提問', text: '你們有沒有遇過這種狀況?' },
      { tone: '驚喜', text: '真的沒想到,效果這麼好!' },
      { tone: '熱情收尾', text: '記得留言告訴我喔!' },
    ];
  }

  function workerUrl() { return (window.KAI && window.KAI.WORKER_URL) || (typeof WORKER !== 'undefined' ? WORKER : '') || ''; }
  function password() { return (window.KAI && window.KAI.PASSWORD) || (typeof PASSWORD !== 'undefined' ? PASSWORD : '') || ''; }
  function token() { try { return sessionStorage.getItem('bs_auth_token') || localStorage.getItem('bs_auth_token') || ''; } catch (e) { return ''; } }
  function brandId() {
    try { return (window.S && window.S.currentBrandId) || (typeof S !== 'undefined' && S.currentBrandId) || (window.KAI && KAI.S && KAI.S.currentBrandId) || ''; } catch (e) { return ''; }
  }
  function brandName() {   // 授權書上要寫客戶看得懂的品牌名(例:RADESIGN),不是代號 ra
    try { const sel = document.getElementById('brand-switcher'); const o = sel && sel.selectedOptions && sel.selectedOptions[0]; return (o && o.text || '').trim(); } catch (e) { return ''; }
  }
  function say(msg, kind) { try { if (typeof toast === 'function') return toast(msg, kind || 'info'); } catch (e) {} alert(msg); }
  async function call(action, extra) {
    let em = ''; try { em = localStorage.getItem('bs_sso_email') || ''; } catch (e) {}
    const body = Object.assign({ password: password(), action: action, token: token(), email: em }, extra || {});
    const r = await fetch(workerUrl(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return r.json();
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  // ── 圖:長邊最多 1536(壓縮)、短邊至少 512(放大)、轉 JPG(照片與錄影截圖共用)──
  function drawToJpeg(src, w, h) {
    if (Math.min(w, h) < 200) throw new Error('畫面太小太模糊,請用原圖或換一台裝置');
    let k = Math.min(1, 1536 / Math.max(w, h));
    if (Math.min(w, h) * k < 512) k = 512 / Math.min(w, h);
    const c = document.createElement('canvas');
    c.width = Math.round(w * k); c.height = Math.round(h * k);
    const g = c.getContext('2d'); g.imageSmoothingQuality = 'high';
    g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    g.drawImage(src, 0, 0, c.width, c.height);
    let q = 0.9, out = c.toDataURL('image/jpeg', q);
    while (out.length > 2.6e6 && q > 0.5) { q -= 0.1; out = c.toDataURL('image/jpeg', q); }
    return out;
  }
  function loadImg(file) {
    return new Promise(function (ok, bad) {
      const im = new Image();
      im.onload = function () { ok(im); };
      im.onerror = function () { bad(new Error('這張照片讀不出來,換一張試試')); };
      im.src = URL.createObjectURL(file);
    });
  }
  async function photoToB64(file) { const im = await loadImg(file); return drawToJpeg(im, im.naturalWidth, im.naturalHeight); }

  // ── 聲音:任何格式(含影片檔)→ 跳過開頭靜音 → 單聲道 22050Hz WAV,最多 15 秒 ──
  async function audioToWavB64(blob, maxFrom) {
    const buf = await blob.arrayBuffer();
    const AC = window.AudioContext || window.webkitAudioContext;
    const ac = new AC();
    let dec;
    try { dec = await new Promise(function (ok, bad) { const p = ac.decodeAudioData(buf, ok, bad); if (p && p.then) p.then(ok, bad); }); }
    catch (e) { throw new Error('讀不到聲音,請確認影片/錄音有收到聲音'); }
    finally { try { ac.close(); } catch (e) {} }
    //  找開口講話的位置(音量到最大音量的 15%),往前留 0.2 秒
    const ch = dec.getChannelData(0), sr = dec.sampleRate, win = Math.floor(sr * 0.05);
    let peak = 0; const rms = [];
    for (let i = 0; i + win <= ch.length; i += win) { let s = 0; for (let j = i; j < i + win; j++) s += ch[j] * ch[j]; const v = Math.sqrt(s / win); rms.push(v); if (v > peak) peak = v; }
    if (peak < 0.01) throw new Error('幾乎沒有收到聲音,請靠近麥克風再錄一次');
    let k0 = rms.findIndex(function (v) { return v > peak * 0.15; }); if (k0 < 0) k0 = 0;
    let start = Math.max(0, k0 * 0.05 - 0.2);
    if (maxFrom != null) start = Math.min(start, maxFrom);
    const sec = Math.min(dec.duration - start, MAX_SEC);
    if (sec < MIN_SEC) throw new Error('聲音太短,請錄 ' + MIN_SEC + '~' + MAX_SEC + ' 秒');
    const rate = 22050, len = Math.floor(sec * rate);
    const oc = new OfflineAudioContext(1, len, rate);
    const src = oc.createBufferSource(); src.buffer = dec; src.connect(oc.destination); src.start(0, start, sec);
    const out = (await oc.startRendering()).getChannelData(0);
    const ab = new ArrayBuffer(44 + len * 2), v = new DataView(ab);
    function str(o, s) { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); }
    str(0, 'RIFF'); v.setUint32(4, 36 + len * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    str(36, 'data'); v.setUint32(40, len * 2, true);
    for (let i = 0; i < len; i++) { const x = Math.max(-1, Math.min(1, out[i])); v.setInt16(44 + i * 2, x < 0 ? x * 0x8000 : x * 0x7fff, true); }
    const bytes = new Uint8Array(ab); let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return { b64: btoa(bin), sec: Math.round(sec) };
  }

  // ── 上傳的影片:每 0.5 秒截一張(錄影的則是邊錄邊截,因為瀏覽器錄的檔案常常不能跳時間)──
  async function framesFromFile(file, onProg) {
    const vid = document.createElement('video');
    vid.muted = true; vid.playsInline = true; vid.preload = 'auto'; vid.src = URL.createObjectURL(file);
    await new Promise(function (ok, bad) { vid.onloadeddata = ok; vid.onerror = function () { bad(new Error('這支影片讀不出來,請用手機一般錄影的 MP4 / MOV')); }; });
    const dur = Math.min(vid.duration || 0, 40);
    if (!(dur >= 8)) throw new Error('影片太短,請照念稿錄滿約 25 秒');
    const out = [];
    for (let t = 0.2; t < dur; t += 0.5) {
      vid.currentTime = t;
      await new Promise(function (ok) { vid.onseeked = ok; setTimeout(ok, 1500); });
      out.push({ t: t, url: drawToJpeg(vid, vid.videoWidth, vid.videoHeight) });
      if (onProg) onProg(Math.round(t / dur * 100));
    }
    return out;
  }
  function nearest(frames, t) {
    let best = 0;
    for (let i = 0; i < frames.length; i++) if (Math.abs(frames[i].t - t) < Math.abs(frames[best].t - t)) best = i;
    return best;
  }

  // ── 簽名板(手指 / 觸控筆 / 滑鼠都可以)──
  function makePad(cv) {
    const ratio = Math.max(1, window.devicePixelRatio || 1);
    const W = cv.clientWidth || 360, H = cv.clientHeight || 160;
    cv.width = W * ratio; cv.height = H * ratio;
    const g = cv.getContext('2d'); g.scale(ratio, ratio);
    g.lineWidth = 2.6; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = '#111';
    let down = false, last = null, len = 0;
    function pt(e) { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    cv.style.touchAction = 'none';
    cv.addEventListener('pointerdown', function (e) { down = true; last = pt(e); try { cv.setPointerCapture(e.pointerId); } catch (_) {} e.preventDefault(); });
    cv.addEventListener('pointermove', function (e) {
      if (!down) return; const p = pt(e);
      g.beginPath(); g.moveTo(last.x, last.y); g.lineTo(p.x, p.y); g.stroke();
      len += Math.hypot(p.x - last.x, p.y - last.y); last = p; if (pad.onchange) pad.onchange(); e.preventDefault();
    });
    function up() { down = false; }
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up); cv.addEventListener('pointerleave', up);
    const pad = {
      onchange: null,
      signed: function () { return len > 80; },
      clear: function () { g.clearRect(0, 0, cv.width, cv.height); len = 0; if (pad.onchange) pad.onchange(); },
      png: function () {   // 白底 PNG(存檔看得清楚)
        const c2 = document.createElement('canvas'); c2.width = cv.width; c2.height = cv.height;
        const g2 = c2.getContext('2d'); g2.fillStyle = '#fff'; g2.fillRect(0, 0, c2.width, c2.height); g2.drawImage(cv, 0, 0);
        return c2.toDataURL('image/png');
      },
    };
    return pad;
  }

  // ── 畫面(配色跟 KOL 工作室同一套;只有簽名框維持白底)──
  const V = function (n, f) { return 'var(--' + n + ',' + f + ')'; };
  const C = { surf: V('surface', '#111118'), surf2: V('surface2', '#1a1a24'), bd: V('border', 'rgba(255,255,255,.07)'), tx: V('text', '#f0f0f8'),
    dim: V('text-dim', 'rgba(240,240,248,.45)'), mid: V('text-mid', 'rgba(240,240,248,.72)'), ac: V('accent', '#7c6dfa'), ac2: V('accent2', '#fa6d9b'), ac3: V('accent3', '#6dfac2'),
    r: V('radius', '14px'), rs: V('radius-sm', '8px') };
  const CSS = '#krp-mask{position:fixed;inset:0;background:rgba(5,5,10,.72);backdrop-filter:blur(6px);z-index:99999;display:flex;align-items:center;justify-content:center;padding:12px}' +
    '#krp-box{background:' + C.surf + ';color:' + C.tx + ';border:1px solid ' + C.bd + ';border-radius:' + C.r + ';max-width:500px;width:100%;max-height:94vh;overflow:auto;padding:22px;font-size:14px;line-height:1.6;box-shadow:0 20px 60px rgba(0,0,0,.6);box-sizing:border-box;font-family:inherit}' +
    '#krp-box h3{margin:0 0 4px;font-size:18px;color:' + C.tx + '}#krp-box .sub{color:' + C.dim + ';font-size:12px;margin-bottom:12px}' +
    '#krp-box .stp{font-size:11px;font-weight:700;letter-spacing:.06em;color:' + C.ac + ';margin-bottom:6px}' +
    '#krp-box label{color:' + C.mid + '}#krp-box label.f{display:block;font-weight:600;margin:14px 0 4px;color:' + C.tx + '}' +
    '#krp-box input[type=text]{width:100%;padding:9px 11px;border:1px solid ' + C.bd + ';border-radius:' + C.rs + ';font-size:15px;box-sizing:border-box;background:' + C.surf2 + ';color:' + C.tx + ';font-family:inherit}' +
    '#krp-box input[type=text]:focus{outline:none;border-color:' + C.ac + '}#krp-box input[type=radio],#krp-box input[type=checkbox]{accent-color:' + C.ac + '}' +
    '#krp-box input[type=file]{color:' + C.mid + ';font-size:13px}' +
    '#krp-box .row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}' +
    '#krp-box .btn{padding:9px 16px;border-radius:' + C.rs + ';border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.04);cursor:pointer;font-size:14px;color:' + C.tx + ';font-family:inherit;transition:all .2s}' +
    '#krp-box .btn:hover{background:rgba(255,255,255,.1)}' +
    '#krp-box .btn.pri{background:linear-gradient(135deg,' + C.ac + ',' + C.ac2 + ');border-color:transparent;color:#fff;font-weight:700}' +
    '#krp-box .btn:disabled{opacity:.35;cursor:not-allowed}#krp-box .btn.rec{background:#e53935;color:#fff;border-color:#e53935}' +
    '#krp-box .lnk{background:none;border:none;color:' + C.dim + ';text-decoration:underline;cursor:pointer;font-size:12px;padding:0;font-family:inherit}' +
    '#krp-prev{width:120px;height:150px;object-fit:cover;border-radius:10px;background:' + C.surf2 + ';display:none;margin-top:8px}' +
    '#krp-box .hint{color:' + C.dim + ';font-size:12px}' +
    '#krp-box .ok{color:' + C.ac3 + ';font-size:13px}#krp-box .req{color:' + C.ac2 + '}' +
    //  念稿卡
    '#krp-box .scr{margin-top:8px;border:1px solid rgba(124,109,250,.35);background:rgba(124,109,250,.08);border-radius:12px;padding:12px 14px}' +
    '#krp-box .scr .ln{display:flex;gap:8px;align-items:baseline;margin:4px 0}#krp-box .scr .tn{flex:none;font-size:11px;color:' + C.ac + ';border:1px solid rgba(124,109,250,.4);border-radius:20px;padding:0 8px;line-height:18px}' +
    '#krp-box .scr .tx{font-size:15px;color:' + C.tx + ';font-weight:600}' +
    '#krp-box .tl{display:flex;margin-top:10px;border-radius:8px;overflow:hidden;font-size:11px;text-align:center}#krp-box .tl div{padding:6px 4px;line-height:1.4}' +
    '#krp-box .tl .a{flex:15;background:rgba(124,109,250,.25)}#krp-box .tl .b{flex:10;background:rgba(250,109,155,.2)}' +
    //  錄影畫面
    '#krp-cam{position:relative;border-radius:12px;overflow:hidden;background:#000;margin-top:8px}' +
    '#krp-cam video{width:100%;display:block;transform:scaleX(-1);max-height:56vh;object-fit:cover}' +
    '#krp-cam .ov{position:absolute;left:0;right:0;bottom:0;padding:12px 14px;background:linear-gradient(transparent,rgba(0,0,0,.85));color:#fff}' +
    '#krp-cam .ph{font-size:12px;color:' + C.ac3 + ';font-weight:700}#krp-cam .big{font-size:20px;font-weight:700;line-height:1.5;text-shadow:0 1px 4px #000}' +
    '#krp-cam .cd{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:80px;font-weight:800;color:#fff;text-shadow:0 2px 12px #000}' +
    '#krp-cam .bar{position:absolute;left:0;top:0;height:4px;background:' + C.ac2 + ';width:0}' +
    //  三個角度
    '#krp-box .angs{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:8px}#krp-box .ang{text-align:center}' +
    '#krp-box .ang img{width:100%;aspect-ratio:3/4;object-fit:cover;border-radius:8px;background:' + C.surf2 + ';display:block}' +
    '#krp-box .ang .nm{font-size:12px;color:' + C.mid + ';margin:4px 0 2px}#krp-box .ang .st{display:flex;justify-content:center;gap:4px}' +
    '#krp-box .ang .st button{padding:2px 10px;font-size:13px}' +
    '#krp-doc{border:1px solid ' + C.bd + ';border-radius:10px;padding:12px 14px;background:' + C.surf2 + ';color:' + C.mid + ';max-height:38vh;overflow:auto;font-size:13px}' +
    '#krp-doc h4{margin:0 0 8px;text-align:center;font-size:15px;color:' + C.tx + '}#krp-doc ol{margin:0;padding-left:20px}#krp-doc li{margin-bottom:6px}' +
    '#krp-sig{width:100%;height:160px;border:1.5px dashed ' + C.ac + ';border-radius:10px;background:#fff;display:block;margin-top:6px}' +
    '#krp-box .consent{display:flex;gap:8px;align-items:flex-start;margin-top:12px;padding:10px 12px;background:rgba(124,109,250,.1);border:1px solid rgba(124,109,250,.3);border-radius:' + C.rs + ';color:' + C.tx + '}' +
    '#krp-box audio{color-scheme:dark}' +
    '#krp-st{margin-top:10px;font-size:13px;color:' + C.mid + ';min-height:18px}' +
    '.rs-card.krp-card{display:flex;align-items:center;justify-content:center;cursor:pointer}';

  let st = null;

  function stopCam() {
    try { if (st && st.rec && st.rec.state !== 'inactive') st.rec.stop(); } catch (e) {}
    try { if (st && st.stream) st.stream.getTracks().forEach(function (x) { x.stop(); }); } catch (e) {}
    if (st) { st.stream = null; if (st.timer) clearInterval(st.timer); st.timer = 0; }
  }

  function open() {
    if (!brandId()) { say('請先選擇品牌', 'warn'); return; }
    const nk = document.getElementById('rs-new-kol');
    if (nk && nk.getAttribute('data-bos-lock')) { say('🔒 ' + (nk.title || '已達方案 KOL 上限') + ' · 到價目表升級即可新增', 'error'); return; }
    close();
    if (!document.getElementById('krp-css')) { const s = document.createElement('style'); s.id = 'krp-css'; s.textContent = CSS; document.head.appendChild(s); }
    st = { mode: 'video', frames: [], pick: {}, photoB64: '', voiceB64: '', rec: null, stream: null, chunks: [], pad: null, timer: 0 };
    const m = document.createElement('div'); m.id = 'krp-mask';
    m.innerHTML =
      '<div id="krp-box">' +
      // ── 第 1 頁:名字 + 錄影(或備用:照片+錄音)──
      '<div id="krp-p1">' +
      '<div class="stp">步驟 1 / 3</div><h3>創建真人 KOL</h3>' +
      '<div class="sub">拍一支 25 秒的本人影片,系統會從影片取出你的臉(正面、斜側、側面)和聲音,影片就是你的臉、你的聲音。</div>' +
      '<label class="f">角色名字 <span class="req">*</span></label><input type="text" id="krp-name" maxlength="30" placeholder="例如:小芮">' +
      '<label class="f">性別</label><div class="row"><label><input type="radio" name="krp-g" value="female" checked> 女</label><label><input type="radio" name="krp-g" value="male"> 男</label></div>' +
      '<div id="krp-vmode">' +
      '<label class="f">錄影時照著念這段 <span class="req">*</span></label>' +
      '<div class="scr" id="krp-scr"></div>' +
      '<div class="tl"><div class="a">0~15 秒<br>看著鏡頭,照稿念</div><div class="b">15~25 秒<br>停下來,臉慢慢轉向右邊<br>停 2 秒再轉回來</div></div>' +
      '<div class="hint" style="margin-top:8px">小提醒:安靜的地方、臉朝窗戶或燈光、手機直拿和眼睛同高、離臉約一個手臂遠、只拍到你一個人。</div>' +
      '<div class="row" style="margin-top:10px"><button type="button" class="btn pri" id="krp-cam-go">開始錄影(畫面會顯示稿子)</button>' +
      '<label class="btn" style="margin:0">上傳已錄好的影片<input type="file" id="krp-vid" accept="video/*" style="display:none"></label></div>' +
      '<div id="krp-camwrap" style="display:none"><div id="krp-cam"><video id="krp-live" playsinline muted autoplay></video><div class="bar" id="krp-bar"></div><div class="cd" id="krp-cd"></div>' +
      '<div class="ov"><div class="ph" id="krp-ph"></div><div class="big" id="krp-big"></div></div></div>' +
      '<div class="row" style="justify-content:flex-end;margin-top:6px"><button type="button" class="btn" id="krp-cam-stop">取消錄影</button></div></div>' +
      '<div id="krp-res" style="display:none">' +
      '<label class="f">取出的臉(用 ◀ ▶ 微調成最清楚的一張)</label><div class="angs" id="krp-angs"></div>' +
      '<label class="f">取出的聲音</label><div id="krp-vst" class="hint"></div><audio id="krp-play" controls style="width:100%;margin-top:4px"></audio>' +
      '<div class="row" style="margin-top:6px"><button type="button" class="btn" id="krp-redo">重錄</button></div></div>' +
      '<div style="margin-top:12px"><button type="button" class="lnk" id="krp-tophoto">沒辦法錄影?改用照片 + 錄音</button></div>' +
      '</div>' +
      '<div id="krp-pmode" style="display:none">' +
      '<label class="f">正面照片 <span class="req">*</span></label><div class="hint">清楚正臉、光線亮、只有他一個人,最好看得到肩膀。大張小張都可以,系統會自動處理。側臉會由 AI 補。</div>' +
      '<input type="file" id="krp-photo" accept="image/*"><br><img id="krp-prev" alt="">' +
      '<label class="f">本人聲音 <span class="req">*</span></label><div class="hint">照上面那段稿子念,安靜的地方錄 12~15 秒。</div>' +
      '<div class="scr" id="krp-scr2"></div>' +
      '<div class="row" style="margin-top:6px"><button type="button" class="btn" id="krp-rec">開始錄音</button>' +
      '<label class="btn" style="margin:0">上傳聲音檔<input type="file" id="krp-vfile" accept="audio/*,video/*" style="display:none"></label></div>' +
      '<div id="krp-vst2" class="hint"></div><audio id="krp-play2" controls style="display:none;width:100%;margin-top:6px"></audio>' +
      '<div style="margin-top:12px"><button type="button" class="lnk" id="krp-tovideo">改回錄影(效果比較好)</button></div>' +
      '</div>' +
      '<div class="row" style="justify-content:flex-end;margin-top:16px"><button type="button" class="btn" data-x="1">取消</button><button type="button" class="btn pri" id="krp-next" disabled>下一步:簽署授權書</button></div>' +
      '</div>' +
      // ── 第 2 頁:授權書 + 簽名 ──
      '<div id="krp-p2" style="display:none">' +
      '<div class="stp">步驟 2 / 3</div><h3>肖像及聲音授權</h3>' +
      '<label class="f">肖像本人姓名 <span class="req">*</span></label><input type="text" id="krp-pn" maxlength="30" placeholder="照片和聲音的本人真實姓名">' +
      '<div class="row" style="margin-top:8px"><label><input type="radio" name="krp-ag" value="self" checked> 我就是本人</label><label><input type="radio" name="krp-ag" value="agent"> 我代本人上傳(已取得同意)</label></div>' +
      '<div id="krp-doc" style="margin-top:12px">載入授權書…</div>' +
      '<label class="consent"><input type="checkbox" id="krp-ok"><span>我已閱讀並同意上述授權書全部內容。</span></label>' +
      '<label class="f">簽名 <span class="req">*</span> <span class="hint">(用手指或滑鼠在框內簽名)</span></label>' +
      '<canvas id="krp-sig"></canvas><div class="row" style="justify-content:flex-end"><button type="button" class="btn" id="krp-clr" style="padding:4px 10px;font-size:12px;margin-top:4px">重簽</button></div>' +
      '<div id="krp-st"></div>' +
      '<div class="row" style="justify-content:space-between;margin-top:10px"><button type="button" class="btn" id="krp-back">上一步</button><button type="button" class="btn pri" id="krp-go" disabled>簽署並建立</button></div>' +
      '</div>' +
      '</div>';
    document.body.appendChild(m);
    const $ = function (id) { return document.getElementById(id); };
    m.querySelectorAll('[data-x]').forEach(function (b) { b.onclick = close; });
    //  只有「按下」和「放開」都在灰色背景上才關(簽名拉出框外不能把視窗關掉)
    let _downOnMask = false;
    m.addEventListener('pointerdown', function (e) { _downOnMask = (e.target === m); });
    m.addEventListener('click', function (e) { if (e.target === m && _downOnMask) close(); _downOnMask = false; });

    // ── 念稿(名字打進去就跟著變)──
    function renderScript() {
      const html = scriptLines($('krp-name').value.trim()).map(function (l) {
        return '<div class="ln"><span class="tn">' + esc(l.tone) + '</span><span class="tx">' + esc(l.text) + '</span></div>';
      }).join('');
      $('krp-scr').innerHTML = html; $('krp-scr2').innerHTML = html;
    }
    renderScript();

    function check1() {
      const okMedia = st.mode === 'video' ? !!(st.voiceB64 && st.pick.front != null && st.frames.length) : !!(st.photoB64 && st.voiceB64);
      $('krp-next').disabled = !($('krp-name').value.trim() && okMedia);
    }
    $('krp-name').addEventListener('input', function () { renderScript(); check1(); });

    // ── 錄影 / 上傳影片 → 三個角度 + 聲音 ──
    function showResult() {
      $('krp-camwrap').style.display = 'none'; $('krp-res').style.display = 'block';
      const ANG = [['front', '正面'], ['q34', '斜側'], ['profile', '側面']];
      $('krp-angs').innerHTML = ANG.map(function (a) {
        return '<div class="ang"><img id="krp-a-' + a[0] + '"><div class="nm">' + a[1] + '</div><div class="st"><button type="button" class="btn" data-a="' + a[0] + '" data-d="-1">◀</button><button type="button" class="btn" data-a="' + a[0] + '" data-d="1">▶</button></div></div>';
      }).join('');
      ANG.forEach(function (a) { st.pick[a[0]] = nearest(st.frames, PICK[a[0]]); $('krp-a-' + a[0]).src = st.frames[st.pick[a[0]]].url; });
      $('krp-angs').querySelectorAll('button[data-a]').forEach(function (b) {
        b.onclick = function () {
          const a = b.dataset.a; st.pick[a] = Math.max(0, Math.min(st.frames.length - 1, st.pick[a] + Number(b.dataset.d)));
          $('krp-a-' + a).src = st.frames[st.pick[a]].url;
        };
      });
      check1();
    }
    async function takeVideoAudio(blob) {
      $('krp-vst').textContent = '取出聲音中…';
      try {
        const r = await audioToWavB64(blob, 3);   // 開口最晚算到第 3 秒,避免後面轉頭的雜音被當成開頭
        st.voiceB64 = r.b64;
        $('krp-vst').innerHTML = '<span class="ok">✓ 取出 ' + r.sec + ' 秒聲音(按播放聽聽看)</span>' + (r.sec < 12 ? '<br>念得有點短,建議重錄念完整段' : '');
        $('krp-play').src = 'data:audio/wav;base64,' + r.b64;
      } catch (e) { st.voiceB64 = ''; $('krp-vst').textContent = e.message; }
      check1();
    }
    $('krp-vid').onchange = async function () {
      const f = this.files && this.files[0]; if (!f) return;
      if (f.size > 400 * 1024 * 1024) { say('影片太大,請錄 30 秒內', 'warn'); return; }
      $('krp-res').style.display = 'block'; $('krp-angs').innerHTML = '<div class="hint">讀取影片中…</div>';
      st.voiceB64 = ''; st.frames = []; st.pick = {}; check1();
      try {
        st.frames = await framesFromFile(f, function (p) { $('krp-angs').innerHTML = '<div class="hint">讀取影片中… ' + p + '%</div>'; });
        showResult();
        await takeVideoAudio(f);
      } catch (e) { $('krp-angs').innerHTML = '<div class="hint">' + esc(e.message) + '</div>'; }
    };
    $('krp-cam-go').onclick = async function () {
      try {
        st.stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 1280 } } });
      } catch (e) { say('沒有相機或麥克風權限,可以改用「上傳已錄好的影片」', 'warn'); return; }
      st.frames = []; st.pick = {}; st.voiceB64 = ''; check1();
      $('krp-res').style.display = 'none'; $('krp-camwrap').style.display = 'block';
      const live = $('krp-live'); live.srcObject = st.stream; await live.play().catch(function () {});
      $('krp-camwrap').scrollIntoView({ block: 'center' });
      const lines = scriptLines($('krp-name').value.trim());
      $('krp-ph').textContent = '準備好了嗎?看著鏡頭'; $('krp-big').textContent = lines[0].text;
      for (let n = 3; n > 0; n--) { if (!st.stream) return; $('krp-cd').textContent = n; await sleep(1000); }
      if (!st.stream) return;
      $('krp-cd').textContent = '';
      st.chunks = [];
      //  只錄聲音就好:臉是邊錄邊截圖(瀏覽器錄的影片檔常常不能跳時間,也不用上傳整支影片)
      const rec = new MediaRecorder(new MediaStream(st.stream.getAudioTracks())); st.rec = rec;
      rec.ondataavailable = function (e) { if (e.data && e.data.size) st.chunks.push(e.data); };
      const t0 = Date.now(); let nextShot = 0.2;
      rec.onstop = async function () {
        const ok = st.frames.length && (Date.now() - t0) / 1000 >= T_TOTAL - 1;
        stopCam();
        if (!ok) { $('krp-camwrap').style.display = 'none'; return; }
        showResult();
        await takeVideoAudio(new Blob(st.chunks, { type: rec.mimeType || 'audio/webm' }));
      };
      rec.start(500);
      st.timer = setInterval(function () {
        const t = (Date.now() - t0) / 1000;
        $('krp-bar').style.width = Math.min(100, t / T_TOTAL * 100) + '%';
        if (t >= nextShot && live.videoWidth) { try { st.frames.push({ t: t, url: drawToJpeg(live, live.videoWidth, live.videoHeight) }); } catch (e) {} nextShot += 0.5; }
        if (t < T_READ) {
          const i = Math.min(lines.length - 1, Math.floor(t / (T_READ / lines.length)));
          $('krp-ph').textContent = '● 錄影中 ' + Math.floor(t) + ' 秒 · ' + lines[i].tone;
          $('krp-big').textContent = lines[i].text;
        } else if (t < T_TOTAL) {
          $('krp-ph').textContent = '● 錄影中 ' + Math.floor(t) + ' 秒';
          $('krp-big').textContent = t < 21 ? '停下來,臉慢慢轉向右邊 →' : '停 2 秒…再慢慢轉回來';
        } else { clearInterval(st.timer); st.timer = 0; if (rec.state !== 'inactive') rec.stop(); }
      }, 100);
    };
    $('krp-cam-stop').onclick = function () { st.frames = []; stopCam(); $('krp-camwrap').style.display = 'none'; check1(); };
    $('krp-redo').onclick = function () { st.frames = []; st.pick = {}; st.voiceB64 = ''; $('krp-res').style.display = 'none'; check1(); $('krp-cam-go').scrollIntoView({ block: 'center' }); };

    // ── 備用:照片 + 錄音 ──
    $('krp-tophoto').onclick = function () { stopCam(); st.mode = 'photo'; st.voiceB64 = ''; $('krp-vmode').style.display = 'none'; $('krp-pmode').style.display = 'block'; check1(); };
    $('krp-tovideo').onclick = function () { st.mode = 'video'; st.voiceB64 = ''; $('krp-pmode').style.display = 'none'; $('krp-vmode').style.display = 'block'; check1(); };
    $('krp-photo').onchange = async function () {
      const f = this.files && this.files[0]; if (!f) return;
      try { st.photoB64 = await photoToB64(f); $('krp-prev').src = st.photoB64; $('krp-prev').style.display = 'block'; }
      catch (e) { st.photoB64 = ''; $('krp-prev').style.display = 'none'; say(e.message, 'warn'); }
      check1();
    };
    async function takeVoice(blob) {
      $('krp-vst2').textContent = '處理中…';
      try {
        const r = await audioToWavB64(blob);
        st.voiceB64 = r.b64;
        $('krp-vst2').innerHTML = '<span class="ok">✓ 已收到 ' + r.sec + ' 秒聲音(可以按播放聽聽看)</span>';
        $('krp-play2').src = 'data:audio/wav;base64,' + r.b64; $('krp-play2').style.display = 'block';
      } catch (e) { st.voiceB64 = ''; $('krp-vst2').textContent = e.message || '聲音讀不出來,換一個檔案試試'; $('krp-play2').style.display = 'none'; }
      check1();
    }
    $('krp-vfile').onchange = function () { const f = this.files && this.files[0]; if (f) takeVoice(f); };
    $('krp-rec').onclick = async function () {
      const b = this;
      if (st.rec && st.rec.state === 'recording') { st.rec.stop(); return; }
      let stream;
      try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
      catch (e) { say('沒有麥克風權限,可以改用「上傳聲音檔」', 'warn'); return; }
      st.chunks = [];
      const rec = new MediaRecorder(stream); st.rec = rec;
      let t = 0; const tick = setInterval(function () { t++; b.textContent = '停止錄音(' + t + ' 秒)'; if (t >= MAX_SEC) rec.stop(); }, 1000);
      rec.ondataavailable = function (e) { if (e.data && e.data.size) st.chunks.push(e.data); };
      rec.onstop = function () {
        clearInterval(tick); stream.getTracks().forEach(function (x) { x.stop(); });
        b.className = 'btn'; b.textContent = '重新錄音';
        takeVoice(new Blob(st.chunks, { type: rec.mimeType || 'audio/webm' }));
      };
      rec.start(); b.className = 'btn rec'; b.textContent = '停止錄音(0 秒)';
    };

    // ── 第 2 頁:授權書 + 簽名 ──
    let _docT = 0;
    async function loadDoc() {
      const my = ++_docT;
      try {
        const r = await call('kol_consent_doc', {
          brandId: brandId(), brandName: brandName(), personaName: $('krp-name').value.trim(),
          personName: $('krp-pn').value.trim(), agent: agentOn(),
        });
        if (my !== _docT) return;
        if (!r || !r.ok) throw new Error((r && r.error) || '授權書載入失敗');
        $('krp-doc').innerHTML = '<h4>' + esc(r.title) + '</h4><ol>' + r.items.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ol>';
      } catch (e) { if (my === _docT) $('krp-doc').textContent = e.message || '授權書載入失敗,請重開視窗'; }
    }
    function agentOn() { return ((document.querySelector('input[name=krp-ag]:checked') || {}).value) === 'agent'; }
    function check2() { $('krp-go').disabled = !($('krp-pn').value.trim() && $('krp-ok').checked && st.pad && st.pad.signed()); }
    let _pnT = 0;
    $('krp-pn').addEventListener('input', function () { check2(); clearTimeout(_pnT); _pnT = setTimeout(loadDoc, 500); });
    m.querySelectorAll('input[name=krp-ag]').forEach(function (r) { r.addEventListener('change', loadDoc); });
    $('krp-ok').addEventListener('change', check2);
    $('krp-next').onclick = function () {
      stopCam();
      $('krp-p1').style.display = 'none'; $('krp-p2').style.display = 'block';
      if (!st.pad) { st.pad = makePad($('krp-sig')); st.pad.onchange = check2; }
      $('krp-box').scrollTop = 0; loadDoc(); check2();
    };
    $('krp-back').onclick = function () { $('krp-p2').style.display = 'none'; $('krp-p1').style.display = 'block'; };
    $('krp-clr').onclick = function () { if (st.pad) st.pad.clear(); };

    // ── 送出 → 建角色 → 綁定(跟 AI 建角色同一個結果)──
    $('krp-go').onclick = async function () {
      const go = this; go.disabled = true;
      const name = $('krp-name').value.trim();
      const g = (document.querySelector('input[name=krp-g]:checked') || {}).value || 'female';
      const video = st.mode === 'video';
      $('krp-st').textContent = '上傳中…(約 10~20 秒,請不要關閉)';
      try {
        const r = await call('kol_real_create', {
          brandId: brandId(), brandName: brandName(), personaName: name, gender: g, consent: true,
          personName: $('krp-pn').value.trim(), agent: agentOn(),
          signatureBase64: st.pad.png(), source: video ? 'video' : 'photo',
          photoBase64: video ? st.frames[st.pick.front].url : st.photoB64,
          photoQ34Base64: video ? st.frames[st.pick.q34].url : undefined,
          photoProfileBase64: video ? st.frames[st.pick.profile].url : undefined,
          voiceBase64: st.voiceB64, voiceExt: 'wav'
        });
        if (!r || !r.ok) throw new Error((r && r.error) || '建立失敗,請再試一次');
        $('krp-st').textContent = '✓ 已建立,完成最後設定中…';
        try { if (window.KAI && window.KAI.S) window.KAI.S.currentPersonaName = name; } catch (e) {}
        if (r.sheets && r.sheets.front) {
          //  三個角度都是本人 → 不跑 AI 補臉,直接完成建立角色
          try { if (typeof loadPersonas === 'function') await loadPersonas(brandId(), true); } catch (e) {}
          try { if (typeof window.autoBindPersona === 'function') await window.autoBindPersona(name, r.sheets.front); } catch (e) { console.warn('[krp] bind', e); }
          close();
          say('✓ 真人 KOL「' + name + '」建立完成(正面、斜側、側面都是本人),授權書已存檔', 'success');
        } else {
          close();
          say('✓ 真人 KOL「' + name + '」建立完成,授權書已存檔', 'success');
          try { if (window.KCS && typeof window.KCS.autoRun === 'function') await window.KCS.autoRun(r.photoUrl); } catch (e) { console.warn('[krp] autoRun', e); }
        }
        try { if (typeof window.refreshAll === 'function') window.refreshAll(); else if (typeof refreshAll === 'function') refreshAll(); } catch (e) {}
      } catch (e) {
        $('krp-st').textContent = e.message || String(e); go.disabled = false;
      }
    };
  }
  function close() {
    stopCam();
    const m = document.getElementById('krp-mask'); if (m) m.remove();
  }

  // ── 入口 ①:引導卡按鈕 ──
  function hookOnboard() {
    document.querySelectorAll('#kol-onboard-card .onb-opt').forEach(function (b) {
      if (b.dataset.krp || !/真人照片/.test(b.textContent)) return;
      b.dataset.krp = '1'; b.disabled = false; b.removeAttribute('title');
      const t = b.querySelector('.t'); if (t) t.innerHTML = '創建真人<span class="tag">新</span>';
      const d = b.querySelector('.d'); if (d) d.textContent = '拍一支 25 秒的自拍影片,影片就是你的臉、你的聲音。';
      b.addEventListener('click', open);
    });
  }
  // ── 入口 ②:「＋建新角色」旁邊的「創建真人」卡(角色列表會重畫,所以盯著補) ──
  function hookCard() {
    const nk = document.getElementById('rs-new-kol');
    if (!nk || document.getElementById('rs-new-real')) return;
    const c = document.createElement('div');
    c.className = 'rs-card rs-new krp-card'; c.id = 'rs-new-real'; c.tabIndex = 0;
    c.innerHTML = '<span>創建真人</span>';
    c.addEventListener('click', open);
    c.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    nk.parentNode.insertBefore(c, nk.nextSibling);
  }
  function hookAll() { try { hookOnboard(); hookCard(); } catch (e) {} }
  let _t = 0;
  new MutationObserver(function () { clearTimeout(_t); _t = setTimeout(hookAll, 150); }).observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hookAll); else hookAll();

  window.KolRealPerson = { open: open, close: close, version: '1.4' };
})();
