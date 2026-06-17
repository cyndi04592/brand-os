/* ═══════════════════════════════════════════════════════════════
 *  Brand OS · KOL 多角度人物表(Character Reference Sheet)· v0.2
 *  Phase 1 (POC):SEED 鎖定法 —— 拿「選中正臉的 seed + prompt」,
 *    只換頭的角度、分開各生一張 → 同 seed 鎖身分,跨角度同一張臉、不漂。
 *    (放棄「三角度塞同一張圖」:flux in-image 一致性差,實測一定跑)
 *    全程「第一次生成」,不走參考圖重生成 → 避開磨皮牆。
 *
 *  本檔為 overlay,掛在 kol-ai-generator.js 之後,共用 window.KAI(連線/狀態)。
 *  使用:kol.html 的 kol-ai-generator.js 那行「之後」加:
 *     <script src="kol-character-sheet.js"></script>
 *  回滾:刪掉那一行 script tag 即可。
 * ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var busy = false;

  // 角度組:正臉 / 3-4 / 側臉。只改「頭的角度」,其餘 prompt 與 seed 完全不動 → 鎖身分
  var ANGLES = [
    { key: 'front',   label: '正臉',  txt: 'front view, head facing the camera directly, looking straight ahead' },
    { key: 'q34',     label: '3/4',  txt: 'three-quarter view, head turned about 30 to 40 degrees to one side, the face still clearly visible' },
    { key: 'profile', label: '側臉',  txt: 'clean side profile view, head turned 90 degrees to the side, sharp jawline silhouette' },
  ];
  var ANGLE_LOCK = ', the exact same individual with identical facial features, identical hair, identical skin and identical proportions — only the head angle changes, fully consistent identity';

  function K() { return window.KAI || null; }

  function readBase() {
    var k = K();
    var base = (k && k.S && k.S.lastPrompt) ? k.S.lastPrompt : '';
    if (!base) {
      var prev = document.getElementById('kai-prompt-preview');
      base = prev ? (prev.textContent || '').trim() : '';
    }
    return base.trim();
  }

  async function genOne(k, prompt, seed, ratio, safety, raw) {
    var res = await fetch(k.WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        password: k.PASSWORD,
        action: 'fal_image_submit',
        prompt: prompt,
        aspect_ratio: ratio,
        num_images: 1,
        seed: seed,                 // ★ 三個角度共用同一個 seed
        safety_tolerance: safety,
        output_format: 'jpeg',
        raw: raw,
        enable_safety_checker: true,
      }),
    });
    var data = await res.json();
    if (!data.ok) throw new Error(data.error || ('HTTP ' + res.status));
    if (!data.images || !data.images.length) throw new Error('回應無 images');
    return data.images[0].url;
  }

  async function generateAngles() {
    var k = K();
    if (!k) { alert('人物表:找不到 window.KAI(請確認 kol-ai-generator.js 已是 v3.29 新版且在本檔之前載入)'); return; }
    if (busy) return;
    if (!k.S.currentBrandId)     { alert('請先選品牌'); return; }
    if (!k.S.currentPersonaName) { alert('請先選或新增 persona'); return; }

    var seedStr = (document.getElementById('kai-seed') && document.getElementById('kai-seed').value || '').trim();
    if (!/^\d+$/.test(seedStr)) {
      alert('多角度要鎖定一張正臉的 seed。\n\n請先在上面「🎨 生成 AI KOL」生一批、挑一張你滿意的正臉(seed 會自動填進來),再按這顆。');
      return;
    }
    var seed = parseInt(seedStr, 10);

    var base = readBase();
    if (!base) { alert('讀不到正臉的 prompt,請先在上面生成一張正臉'); return; }

    var ratio  = (document.getElementById('kai-ratio')  && document.getElementById('kai-ratio').value)  || '3:4';
    var safety = (document.getElementById('kai-safety') && document.getElementById('kai-safety').value) || '2';
    var raw    = (document.getElementById('kai-raw')    && document.getElementById('kai-raw').value === 'true') || false;

    busy = true;
    var btn = document.getElementById('cs-btn-gen');
    var gallery = document.getElementById('cs-gallery');
    var meta = document.getElementById('cs-meta');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="cs-spin"></span> 鎖 seed 轉角度中...'; }
    if (gallery) gallery.innerHTML = '<div class="cs-empty">⏳ 用 seed=' + seed + ' 生 ' + ANGLES.length + ' 個角度中,約 20-40 秒...</div>';
    if (meta) meta.textContent = '';

    var t0 = performance.now();
    try {
      var results = await Promise.all(ANGLES.map(function (a) {
        var prompt = base + ', ' + a.txt + ANGLE_LOCK;
        return genOne(k, prompt, seed, ratio, safety, raw)
          .then(function (url) { return { label: a.label, key: a.key, url: url }; })
          .catch(function (e) { return { label: a.label, key: a.key, url: null, err: e.message }; });
      }));
      var latency = ((performance.now() - t0) / 1000).toFixed(1);
      renderAngles(results, seed);
      var okCount = results.filter(function (r) { return r.url; }).length;
      if (meta) meta.textContent = okCount + '/' + ANGLES.length + ' 角度 · seed=' + seed + ' · ' + latency + 's · 看三張是不是「同一張臉只轉頭」';
    } catch (e) {
      console.error('[character-sheet] 失敗:', e);
      if (gallery) gallery.innerHTML = '<div class="cs-empty cs-err">❌ ' + (e.message || '生成失敗') + '</div>';
    } finally {
      busy = false;
      if (btn) { btn.disabled = false; btn.innerHTML = '🎬 鎖定 seed 生多角度人物表'; }
    }
  }

  function renderAngles(results, seed) {
    var gallery = document.getElementById('cs-gallery');
    if (!gallery) return;
    gallery.innerHTML = '';
    var row = document.createElement('div');
    row.className = 'cs-row';
    results.forEach(function (r) {
      var card = document.createElement('div');
      card.className = 'cs-card';
      card.innerHTML =
        '<div class="cs-label">' + r.label + '</div>' +
        (r.url
          ? '<a href="' + r.url + '" target="_blank" rel="noopener"><img src="' + r.url + '" alt="' + r.label + '" /></a>'
          : '<div class="cs-empty cs-err" style="padding:20px">✗ ' + (r.err || '失敗') + '</div>');
      row.appendChild(card);
    });
    gallery.appendChild(row);

    var ok = results.filter(function (r) { return r.url; });
    var bar = document.createElement('div');
    bar.className = 'cs-actbar';
    bar.innerHTML =
      '<button class="cs-use" ' + (ok.length === ANGLES.length ? '' : 'disabled') + '>✓ 用這組當人物表(seed=' + seed + ')</button>' +
      '<button class="cs-reroll">↻ 重生(同 seed)</button>';
    gallery.appendChild(bar);

    bar.querySelector('.cs-use').addEventListener('click', function () {
      var set = { seed: String(seed), persona: (K() && K().S.currentPersonaName) || '' };
      results.forEach(function (r) { set[r.key] = r.url; });
      window.KOL_CHARACTER_SHEET = set;
      var meta = document.getElementById('cs-meta');
      if (meta) meta.textContent = '✅ 已選定這組多角度人物表(seed=' + seed + ')。Phase 2 會把它接成 Seedance 的「人」參考、並把 seed 存進 persona。';
      console.log('[character-sheet] 選定人物表組:', window.KOL_CHARACTER_SHEET);
    });
    bar.querySelector('.cs-reroll').addEventListener('click', generateAngles);
  }

  function injectStyle() {
    if (document.getElementById('cs-style')) return;
    var css = document.createElement('style');
    css.id = 'cs-style';
    css.textContent =
      '.cs-wrap{margin-top:14px;padding:12px;border:1px solid rgba(255,255,255,.12);border-radius:12px;background:rgba(255,255,255,.03);}' +
      '.cs-head{display:flex;align-items:center;gap:8px;font-weight:600;font-size:13px;margin-bottom:4px;color:#e8e8ee;}' +
      '.cs-sub{font-size:11px;color:#9aa3b2;opacity:.85;margin-bottom:10px;line-height:1.6;}' +
      '.cs-btn{width:100%;padding:10px;border:none;border-radius:10px;cursor:pointer;font-weight:600;font-size:13px;color:#fff;background:linear-gradient(135deg,#7c5cff,#5b8cff);}' +
      '.cs-btn:disabled{opacity:.6;cursor:not-allowed;}' +
      '.cs-spin{display:inline-block;width:12px;height:12px;border:2px solid rgba(255,255,255,.4);border-top-color:#fff;border-radius:50%;animation:cs-rot .7s linear infinite;vertical-align:middle;}' +
      '@keyframes cs-rot{to{transform:rotate(360deg);}}' +
      '.cs-meta{font-size:11px;color:#9aa3b2;margin:8px 2px;line-height:1.5;}' +
      '.cs-row{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:8px;}' +
      '.cs-card{border:1px solid rgba(255,255,255,.1);border-radius:10px;overflow:hidden;background:#000;}' +
      '.cs-label{font-size:11px;font-weight:600;color:#cdd;text-align:center;padding:4px;background:rgba(255,255,255,.05);}' +
      '.cs-card img{width:100%;display:block;}' +
      '.cs-actbar{display:flex;gap:8px;margin-top:10px;}' +
      '.cs-use{flex:1;padding:9px;border:none;border-radius:9px;cursor:pointer;font-size:12px;font-weight:700;color:#fff;background:linear-gradient(135deg,#3ec98a,#2fa8c9);}' +
      '.cs-use:disabled{opacity:.5;cursor:not-allowed;}' +
      '.cs-reroll{padding:9px 12px;border:1px solid rgba(255,255,255,.2);border-radius:9px;cursor:pointer;font-size:12px;color:#cdd;background:transparent;}' +
      '.cs-empty{padding:24px;text-align:center;color:#9aa3b2;font-size:13px;}' +
      '.cs-err{color:#ff7a7a;}';
    document.head.appendChild(css);
  }

  function injectPanel() {
    if (document.getElementById('cs-wrap')) return true;
    var panel = document.querySelector('.kai-panel');
    if (!panel) return false;
    var wrap = document.createElement('div');
    wrap.className = 'cs-wrap';
    wrap.id = 'cs-wrap';
    wrap.innerHTML =
      '<div class="cs-head">🎬 多角度人物表 <span style="font-size:10px;opacity:.6;font-weight:400;">SEED 鎖定 · Phase 1</span></div>' +
      '<div class="cs-sub">先在上面挑一張滿意的<b>正臉</b>(seed 會自動填),再按下面 → 用<b>同一個 seed</b> 把那張臉轉成正臉/3-4/側臉(只轉頭、不換人)。三張同一張臉 = 可餵 Seedance 鎖人。建議用在<b>新角色</b>。</div>' +
      '<button class="cs-btn" id="cs-btn-gen">🎬 鎖定 seed 生多角度人物表</button>' +
      '<div class="cs-meta" id="cs-meta"></div>' +
      '<div class="cs-gallery" id="cs-gallery"></div>';
    panel.appendChild(wrap);
    var btn = document.getElementById('cs-btn-gen');
    if (btn) btn.addEventListener('click', generateAngles);
    console.log('[character-sheet] 🎬 v0.2 就緒 · 多角度人物表(SEED 鎖定·Phase 1)');
    return true;
  }

  function boot() {
    injectStyle();
    if (injectPanel()) return;
    var tries = 0;
    var timer = setInterval(function () {
      tries++;
      if (injectPanel() || tries > 40) clearInterval(timer);
    }, 500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
