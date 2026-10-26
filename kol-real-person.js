/* ═══════════════════════════════════════════════════════════════════
   kol-real-person.js — 創建真人 KOL(v1.1 · 2026-10-26)
   ───────────────────────────────────────────────────────────────────
   職責(只有這一件事):讓客戶用【本人正面照 + 本人聲音 + 手寫簽名授權書】建一位 KOL。
     照片 → 角色照片(之後影片用他的臉;太大自動壓縮、太小自動放大)
     聲音 4~15 秒(必錄)→ 之後影片講話自動用他的聲音
       (Worker kol-proxy v6.42 的 seedance_submit 會自己帶上,這支不用管影片)
     授權書 → 全文由 Worker 產生(kol_consent_doc),客戶勾選 + 手指/滑鼠簽名,
       Worker 把簽好的那份連同時間、帳號、IP、檔案指紋存檔(kol_real_create)。
   建好之後跟 AI 建角色同一條路:KCS.autoRun 補側臉 → 自動綁定 → refreshAll。
   入口(都由這支自己掛,kol.html 只要多一行 <script>):
     ① 新品牌引導卡的「用真人照片建立」按鈕(原本 disabled)
     ② 「＋建新角色」卡片旁邊多一張「創建真人」卡
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.KolRealPerson) return;

  const MAX_SEC = 15, MIN_SEC = 4;

  function workerUrl() { return (window.KAI && window.KAI.WORKER_URL) || (typeof WORKER !== 'undefined' ? WORKER : '') || ''; }
  function password() { return (window.KAI && window.KAI.PASSWORD) || (typeof PASSWORD !== 'undefined' ? PASSWORD : '') || ''; }
  function token() { try { return sessionStorage.getItem('bs_auth_token') || localStorage.getItem('bs_auth_token') || ''; } catch (e) { return ''; } }
  function brandId() {
    try { return (window.S && window.S.currentBrandId) || (typeof S !== 'undefined' && S.currentBrandId) || (window.KAI && KAI.S && KAI.S.currentBrandId) || ''; } catch (e) { return ''; }
  }
  function say(msg, kind) { try { if (typeof toast === 'function') return toast(msg, kind || 'info'); } catch (e) {} alert(msg); }
  async function call(action, extra) {
    let em = ''; try { em = localStorage.getItem('bs_sso_email') || ''; } catch (e) {}
    const body = Object.assign({ password: password(), action: action, token: token(), email: em }, extra || {});
    const r = await fetch(workerUrl(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return r.json();
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  // ── 照片:長邊最多 1536(壓縮)、短邊至少 512(放大)、轉 JPG ──
  function loadImg(file) {
    return new Promise(function (ok, bad) {
      const im = new Image();
      im.onload = function () { ok(im); };
      im.onerror = function () { bad(new Error('這張照片讀不出來,換一張試試')); };
      im.src = URL.createObjectURL(file);
    });
  }
  async function photoToB64(file) {
    const im = await loadImg(file);
    const w = im.naturalWidth, h = im.naturalHeight;
    if (Math.min(w, h) < 200) throw new Error('照片太小太模糊,請用原圖');
    let k = Math.min(1, 1536 / Math.max(w, h));
    if (Math.min(w, h) * k < 512) k = 512 / Math.min(w, h);
    const c = document.createElement('canvas');
    c.width = Math.round(w * k); c.height = Math.round(h * k);
    const g = c.getContext('2d'); g.imageSmoothingQuality = 'high';
    g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    g.drawImage(im, 0, 0, c.width, c.height);
    let q = 0.88, out = c.toDataURL('image/jpeg', q);
    while (out.length > 2.6e6 && q > 0.5) { q -= 0.1; out = c.toDataURL('image/jpeg', q); }
    return out;
  }

  // ── 聲音:任何格式 → 單聲道 22050Hz WAV,最多 15 秒 ──
  async function audioToWavB64(blob) {
    const buf = await blob.arrayBuffer();
    const AC = window.AudioContext || window.webkitAudioContext;
    const ac = new AC();
    let dec;
    try { dec = await new Promise(function (ok, bad) { const p = ac.decodeAudioData(buf, ok, bad); if (p && p.then) p.then(ok, bad); }); }
    finally { try { ac.close(); } catch (e) {} }
    const sec = Math.min(dec.duration, MAX_SEC);
    if (sec < MIN_SEC) throw new Error('聲音太短,請錄 ' + MIN_SEC + '~' + MAX_SEC + ' 秒');
    const rate = 22050, len = Math.floor(sec * rate);
    const oc = new OfflineAudioContext(1, len, rate);
    const src = oc.createBufferSource(); src.buffer = dec; src.connect(oc.destination); src.start(0);
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

  // ── 畫面 ──
  const CSS = '#krp-mask{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:99999;display:flex;align-items:center;justify-content:center;padding:12px}' +
    '#krp-box{background:#fff;color:#222;border-radius:14px;max-width:480px;width:100%;max-height:94vh;overflow:auto;padding:20px;font-size:14px;line-height:1.6;box-shadow:0 10px 40px rgba(0,0,0,.3);box-sizing:border-box}' +
    '#krp-box h3{margin:0 0 4px;font-size:18px}#krp-box .sub{color:#777;font-size:12px;margin-bottom:12px}#krp-box .stp{font-size:12px;color:#999;margin-bottom:6px}' +
    '#krp-box label.f{display:block;font-weight:600;margin:12px 0 4px}#krp-box input[type=text]{width:100%;padding:8px 10px;border:1px solid #ccc;border-radius:8px;font-size:15px;box-sizing:border-box}' +
    '#krp-box .row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}#krp-box .btn{padding:9px 14px;border-radius:8px;border:1px solid #ccc;background:#f6f6f6;cursor:pointer;font-size:14px;color:#222}' +
    '#krp-box .btn.pri{background:#111;color:#fff;border-color:#111}#krp-box .btn:disabled{opacity:.4;cursor:not-allowed}#krp-box .btn.rec{background:#e53935;color:#fff;border-color:#e53935}' +
    '#krp-prev{width:120px;height:150px;object-fit:cover;border-radius:10px;background:#eee;display:none;margin-top:8px}#krp-box .hint{color:#888;font-size:12px}' +
    '#krp-box .ok{color:#2e7d32;font-size:13px}#krp-box .req{color:#e53935}' +
    '#krp-doc{border:1px solid #ddd;border-radius:10px;padding:12px 14px;background:#fafafa;max-height:38vh;overflow:auto;font-size:13px}#krp-doc h4{margin:0 0 8px;text-align:center;font-size:15px}#krp-doc ol{margin:0;padding-left:20px}#krp-doc li{margin-bottom:6px}' +
    '#krp-sig{width:100%;height:160px;border:1.5px dashed #999;border-radius:10px;background:#fff;display:block;margin-top:6px}' +
    '#krp-box .consent{display:flex;gap:8px;align-items:flex-start;margin-top:12px;padding:10px;background:#fff8e1;border-radius:8px}' +
    '#krp-st{margin-top:10px;font-size:13px;color:#555;min-height:18px}' +
    '.rs-card.krp-card{display:flex;align-items:center;justify-content:center;cursor:pointer}';

  let st = null;

  function open() {
    if (!brandId()) { say('請先選擇品牌', 'warn'); return; }
    const nk = document.getElementById('rs-new-kol');
    if (nk && nk.getAttribute('data-bos-lock')) { say('🔒 ' + (nk.title || '已達方案 KOL 上限') + ' · 到價目表升級即可新增', 'error'); return; }
    close();
    if (!document.getElementById('krp-css')) { const s = document.createElement('style'); s.id = 'krp-css'; s.textContent = CSS; document.head.appendChild(s); }
    st = { photoB64: '', voiceB64: '', rec: null, chunks: [], pad: null };
    const m = document.createElement('div'); m.id = 'krp-mask';
    m.innerHTML =
      '<div id="krp-box">' +
      // ── 第 1 頁:照片 + 聲音 ──
      '<div id="krp-p1">' +
      '<div class="stp">步驟 1 / 2</div><h3>創建真人 KOL</h3>' +
      '<div class="sub">上傳本人正面照,影片就是他的臉;錄一段聲音,影片講話就是他的聲音。</div>' +
      '<label class="f">角色名字 <span class="req">*</span></label><input type="text" id="krp-name" maxlength="30" placeholder="例如:小芮">' +
      '<label class="f">性別</label><div class="row"><label><input type="radio" name="krp-g" value="female" checked> 女</label><label><input type="radio" name="krp-g" value="male"> 男</label></div>' +
      '<label class="f">正面照片 <span class="req">*</span></label><div class="hint">清楚正臉、光線亮、只有他一個人,最好看得到肩膀。大張小張都可以,系統會自動處理。</div>' +
      '<input type="file" id="krp-photo" accept="image/*"><br><img id="krp-prev" alt="">' +
      '<label class="f">本人聲音 <span class="req">*</span></label><div class="hint">找安靜的地方,用平常講話的語氣說 ' + MIN_SEC + '~' + MAX_SEC + ' 秒,聊什麼都可以。</div>' +
      '<div class="row" style="margin-top:6px"><button type="button" class="btn" id="krp-rec">開始錄音</button>' +
      '<label class="btn" style="margin:0">上傳聲音檔<input type="file" id="krp-vfile" accept="audio/*,video/*" style="display:none"></label></div>' +
      '<div id="krp-vst" class="hint"></div><audio id="krp-play" controls style="display:none;width:100%;margin-top:6px"></audio>' +
      '<div class="row" style="justify-content:flex-end;margin-top:16px"><button type="button" class="btn" data-x="1">取消</button><button type="button" class="btn pri" id="krp-next" disabled>下一步:簽署授權書</button></div>' +
      '</div>' +
      // ── 第 2 頁:授權書 + 簽名 ──
      '<div id="krp-p2" style="display:none">' +
      '<div class="stp">步驟 2 / 2</div><h3>肖像及聲音授權</h3>' +
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
    m.addEventListener('click', function (e) { if (e.target === m) close(); });

    // 第 1 頁
    function check1() { $('krp-next').disabled = !($('krp-name').value.trim() && st.photoB64 && st.voiceB64); }
    $('krp-name').addEventListener('input', check1);
    $('krp-photo').onchange = async function () {
      const f = this.files && this.files[0]; if (!f) return;
      try { st.photoB64 = await photoToB64(f); $('krp-prev').src = st.photoB64; $('krp-prev').style.display = 'block'; }
      catch (e) { st.photoB64 = ''; $('krp-prev').style.display = 'none'; say(e.message, 'warn'); }
      check1();
    };
    async function takeVoice(blob) {
      $('krp-vst').textContent = '處理中…';
      try {
        const r = await audioToWavB64(blob);
        st.voiceB64 = r.b64;
        $('krp-vst').innerHTML = '<span class="ok">✓ 已收到 ' + r.sec + ' 秒聲音(可以按播放聽聽看)</span>';
        $('krp-play').src = 'data:audio/wav;base64,' + r.b64; $('krp-play').style.display = 'block';
      } catch (e) { st.voiceB64 = ''; $('krp-vst').textContent = e.message || '聲音讀不出來,換一個檔案試試'; $('krp-play').style.display = 'none'; }
      check1();
    }
    $('krp-vfile').onchange = function () { const f = this.files && this.files[0]; if (f) takeVoice(f); };
    $('krp-rec').onclick = async function () {
      const b = this;
      if (st.rec) { st.rec.stop(); return; }
      let stream;
      try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
      catch (e) { say('沒有麥克風權限,可以改用「上傳聲音檔」', 'warn'); return; }
      st.chunks = [];
      const rec = new MediaRecorder(stream); st.rec = rec;
      let t = 0; const tick = setInterval(function () { t++; b.textContent = '停止錄音(' + t + ' 秒)'; if (t >= MAX_SEC) rec.stop(); }, 1000);
      rec.ondataavailable = function (e) { if (e.data && e.data.size) st.chunks.push(e.data); };
      rec.onstop = function () {
        clearInterval(tick); stream.getTracks().forEach(function (x) { x.stop(); });
        st.rec = null; b.className = 'btn'; b.textContent = '重新錄音';
        takeVoice(new Blob(st.chunks, { type: rec.mimeType || 'audio/webm' }));
      };
      rec.start(); b.className = 'btn rec'; b.textContent = '停止錄音(0 秒)';
    };

    // 第 2 頁
    let _docT = 0;
    async function loadDoc() {
      const my = ++_docT;
      try {
        const r = await call('kol_consent_doc', {
          brandId: brandId(), personaName: $('krp-name').value.trim(),
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
      $('krp-p1').style.display = 'none'; $('krp-p2').style.display = 'block';
      if (!st.pad) { st.pad = makePad($('krp-sig')); st.pad.onchange = check2; }
      $('krp-box').scrollTop = 0; loadDoc(); check2();
    };
    $('krp-back').onclick = function () { $('krp-p2').style.display = 'none'; $('krp-p1').style.display = 'block'; };
    $('krp-clr').onclick = function () { if (st.pad) st.pad.clear(); };

    $('krp-go').onclick = async function () {
      const go = this; go.disabled = true;
      const name = $('krp-name').value.trim();
      const g = (document.querySelector('input[name=krp-g]:checked') || {}).value || 'female';
      $('krp-st').textContent = '上傳中…(約 10~20 秒,請不要關閉)';
      try {
        const r = await call('kol_real_create', {
          brandId: brandId(), personaName: name, gender: g, consent: true,
          personName: $('krp-pn').value.trim(), agent: agentOn(),
          signatureBase64: st.pad.png(),
          photoBase64: st.photoB64, voiceBase64: st.voiceB64, voiceExt: 'wav'
        });
        if (!r || !r.ok) throw new Error((r && r.error) || '建立失敗,請再試一次');
        close();
        say('✓ 真人 KOL「' + name + '」建立完成,授權書已存檔', 'success');
        try { if (window.KAI && window.KAI.S) window.KAI.S.currentPersonaName = name; } catch (e) {}
        try { if (window.KCS && typeof window.KCS.autoRun === 'function') await window.KCS.autoRun(r.photoUrl); }
        catch (e) { console.warn('[krp] autoRun', e); }
        try { if (typeof window.refreshAll === 'function') window.refreshAll(); else if (typeof refreshAll === 'function') refreshAll(); } catch (e) {}
      } catch (e) {
        $('krp-st').textContent = e.message || String(e); go.disabled = false;
      }
    };
  }
  function close() {
    try { if (st && st.rec) st.rec.stop(); } catch (e) {}
    const m = document.getElementById('krp-mask'); if (m) m.remove();
  }

  // ── 入口 ①:引導卡按鈕 ──
  function hookOnboard() {
    document.querySelectorAll('#kol-onboard-card .onb-opt').forEach(function (b) {
      if (b.dataset.krp || !/真人照片/.test(b.textContent)) return;
      b.dataset.krp = '1'; b.disabled = false; b.removeAttribute('title');
      const t = b.querySelector('.t'); if (t) t.innerHTML = '創建真人<span class="tag">新</span>';
      const d = b.querySelector('.d'); if (d) d.textContent = '上傳本人照片、錄一段聲音,影片就是你的臉、你的聲音。';
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

  window.KolRealPerson = { open: open, close: close, version: '1.1' };
})();
