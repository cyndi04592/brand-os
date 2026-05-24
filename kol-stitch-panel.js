// ==========================================================================
// kol-stitch-panel.js — 一鍵接片 UI 面板  v1.0
// --------------------------------------------------------------------------
// 自己浮動掛載一顆按鈕，點開面板就能跑完整接片。
// 依賴 window.KolStitch（kol-stitch.js）。請在 kol-stitch.js 之後載入。
//   <script src="kol-stitch.js"></script>
//   <script src="kol-stitch-panel.js"></script>
// ==========================================================================
(function () {
  'use strict';

  if (!window.KolStitch) {
    console.warn('[StitchPanel] 找不到 KolStitch，請先載入 kol-stitch.js');
    return;
  }
  if (document.getElementById('kstitch-fab')) return; // 避免重複掛載

  // 預設值（PROTEX 防熊噴霧）
  var DEFAULT_FOLDER = '17gwqDoL41x-H3VC1c16R4bYeHDF4enSr'; // PROTEX 商品資料夾
  var DEFAULT_BRAND = 'PROTEX';
  var DEFAULT_KOL = '健一';
  var P1 = '[Image1] is a Japanese mountain guide. He holds [Image2], a can of bear spray, toward the camera and points to the label, calm natural expression, mountain trail background, photorealistic, cinematic.';
  var P2 = '[Image1] the same man raises [Image2], the bear spray, nods confidently and gives a slight smile, same mountain trail background, photorealistic, cinematic.';

  // ---- 樣式（黑底，貼合 Brand OS）-------------------------------------------
  var css = ''
    + '#kstitch-fab{position:fixed;right:22px;bottom:22px;z-index:99998;width:56px;height:56px;border-radius:50%;'
    + 'background:linear-gradient(135deg,#34d399,#a78bfa);border:none;cursor:pointer;font-size:24px;color:#fff;'
    + 'box-shadow:0 6px 22px rgba(0,0,0,.45);transition:transform .15s;}'
    + '#kstitch-fab:hover{transform:scale(1.08);}'
    + '#kstitch-panel{position:fixed;right:22px;bottom:88px;z-index:99999;width:380px;max-height:80vh;overflow-y:auto;'
    + 'display:none;flex-direction:column;gap:12px;padding:18px;border-radius:16px;'
    + 'background:#15151f;border:1px solid rgba(167,139,250,.28);box-shadow:0 12px 40px rgba(0,0,0,.55);'
    + 'color:#e8e8f0;font-family:inherit;font-size:13px;line-height:1.5;}'
    + '#kstitch-panel.open{display:flex;}'
    + '#kstitch-panel h3{margin:0;font-size:15px;font-weight:700;display:flex;align-items:center;justify-content:space-between;}'
    + '#kstitch-panel .ks-close{cursor:pointer;color:#9a9ab0;font-size:18px;line-height:1;background:none;border:none;}'
    + '#kstitch-panel label{display:block;font-size:11px;color:#9a9ab0;margin:0 0 4px;}'
    + '#kstitch-panel input,#kstitch-panel textarea,#kstitch-panel select{width:100%;box-sizing:border-box;background:#0e0e16;'
    + 'border:1px solid #2a2a3a;border-radius:9px;color:#e8e8f0;padding:8px 10px;font-family:inherit;font-size:12px;}'
    + '#kstitch-panel textarea{resize:vertical;min-height:54px;}'
    + '#kstitch-panel .ks-row{display:flex;gap:8px;}'
    + '#kstitch-panel .ks-row>div{flex:1;}'
    + '#kstitch-panel .ks-kol{display:flex;align-items:center;gap:10px;background:#0e0e16;border-radius:9px;padding:8px;border:1px solid #2a2a3a;}'
    + '#kstitch-panel .ks-kol img{width:40px;height:40px;border-radius:8px;object-fit:cover;}'
    + '#kstitch-panel .ks-prods{display:flex;gap:8px;flex-wrap:wrap;}'
    + '#kstitch-panel .ks-prod{width:54px;height:54px;border-radius:9px;object-fit:cover;cursor:pointer;border:2px solid transparent;}'
    + '#kstitch-panel .ks-prod.sel{border-color:#34d399;}'
    + '#kstitch-panel .ks-btn{background:linear-gradient(135deg,#34d399,#a78bfa);color:#fff;border:none;border-radius:10px;'
    + 'padding:11px;font-size:14px;font-weight:700;cursor:pointer;}'
    + '#kstitch-panel .ks-btn:disabled{opacity:.5;cursor:not-allowed;}'
    + '#kstitch-panel .ks-btn2{background:#0e0e16;border:1px solid #2a2a3a;color:#c8c8d8;border-radius:9px;padding:7px;font-size:12px;cursor:pointer;}'
    + '#kstitch-panel .ks-log{background:#0a0a11;border-radius:9px;padding:8px 10px;font-size:11px;color:#8fd9b8;'
    + 'white-space:pre-wrap;max-height:120px;overflow-y:auto;font-family:ui-monospace,monospace;}'
    + '#kstitch-panel video{width:100%;border-radius:9px;background:#000;}'
    + '#kstitch-panel .ks-hint{font-size:11px;color:#9a9ab0;}'
    + '#kstitch-panel a.ks-link{color:#a78bfa;word-break:break-all;font-size:11px;}';
  var styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  // ---- DOM ------------------------------------------------------------------
  var fab = document.createElement('button');
  fab.id = 'kstitch-fab';
  fab.title = '一鍵接片';
  fab.textContent = '🎬';
  document.body.appendChild(fab);

  var panel = document.createElement('div');
  panel.id = 'kstitch-panel';
  panel.innerHTML = ''
    + '<h3>🎬 一鍵接片 <button class="ks-close" title="關閉">×</button></h3>'
    + '<div><label>KOL（自動抓取）</label><div class="ks-kol" id="ks-kol"><span class="ks-hint">尋找中…</span></div></div>'
    + '<div><label>商品照（PROTEX 資料夾）</label>'
    + '  <div class="ks-row"><div><input id="ks-folder" value="' + DEFAULT_FOLDER + '"></div>'
    + '  <button class="ks-btn2" id="ks-load" style="flex:0 0 auto;width:auto;padding:7px 12px;">載入商品</button></div>'
    + '  <div class="ks-prods" id="ks-prods" style="margin-top:8px;"></div></div>'
    + '<div><label>第一段劇情</label><textarea id="ks-p1">' + P1 + '</textarea></div>'
    + '<div><label>第二段劇情（接續）</label><textarea id="ks-p2">' + P2 + '</textarea></div>'
    + '<div class="ks-row">'
    + '  <div><label>每段秒數</label><select id="ks-dur"><option value="10">10 秒</option><option value="5">5 秒</option></select></div>'
    + '  <div><label>畫質</label><select id="ks-tier"><option value="standard">標準（好）</option><option value="fast">快速（省）</option></select></div>'
    + '</div>'
    + '<button class="ks-btn" id="ks-go">🎬 生成接片</button>'
    + '<div class="ks-hint" id="ks-cost"></div>'
    + '<div class="ks-log" id="ks-log" style="display:none;"></div>'
    + '<div id="ks-result"></div>';
  document.body.appendChild(panel);

  var $ = function (id) { return panel.querySelector(id); };

  // ---- 狀態 -----------------------------------------------------------------
  var selectedProduct = null;

  // ---- helpers --------------------------------------------------------------
  function grabKolImage() {
    var imgs = [].slice.call(document.querySelectorAll('img')).map(function (i) { return i.src; });
    return imgs.find(function (s) { return s && s.indexOf('heygen') > -1; }) || '';
  }

  function showKol() {
    var url = grabKolImage();
    var box = $('#ks-kol');
    if (url) {
      box.innerHTML = '<img src="' + url + '"><span>已抓到 ' + DEFAULT_KOL + ' 的照片</span>';
    } else {
      box.innerHTML = '<span class="ks-hint" style="color:#f0a;">沒抓到 KOL 照片，請確認形象庫有顯示健一</span>';
    }
    return url;
  }

  function log(msg) {
    var el = $('#ks-log');
    el.style.display = 'block';
    el.textContent += (msg + '\n');
    el.scrollTop = el.scrollHeight;
  }

  function updateCost() {
    var n = 2; // 兩段
    var per = $('#ks-tier').value === 'standard' ? 3 : 2.4;
    $('#ks-cost').textContent = '預估花費：約 $' + (n * per).toFixed(1) + ' USD（' + n + ' 段）';
  }

  // 載入商品照
  async function loadProducts() {
    var folderId = $('#ks-folder').value.trim();
    if (!folderId) { alert('請填商品資料夾 ID'); return; }
    var box = $('#ks-prods');
    box.innerHTML = '<span class="ks-hint">載入中…</span>';
    try {
      var r = await KolStitch._api('drive_files', { folderId: folderId, type: 'image' });
      var files = (r && r.files) || [];
      if (!files.length) { box.innerHTML = '<span class="ks-hint" style="color:#f0a;">這個資料夾沒有圖片</span>'; return; }
      box.innerHTML = '';
      files.forEach(function (f, idx) {
        var img = document.createElement('img');
        img.className = 'ks-prod';
        img.src = f.thumbnailLink || ('https://drive.google.com/thumbnail?id=' + f.id);
        img.title = f.name;
        img.dataset.id = f.id;
        img.onclick = function () {
          box.querySelectorAll('.ks-prod').forEach(function (e) { e.classList.remove('sel'); });
          img.classList.add('sel');
          selectedProduct = f.id;
        };
        box.appendChild(img);
        if (idx === 0) { img.classList.add('sel'); selectedProduct = f.id; } // 預設選第一張
      });
    } catch (e) {
      box.innerHTML = '<span class="ks-hint" style="color:#f0a;">載入失敗：' + e.message + '</span>';
    }
  }

  // 生成
  async function generate() {
    var startUrl = grabKolImage();
    if (!startUrl) { alert('沒抓到 KOL 照片'); return; }
    if (!selectedProduct) { alert('請先載入並選一張商品照'); return; }

    var go = $('#ks-go');
    go.disabled = true; go.textContent = '生成中…請勿關閉';
    $('#ks-result').innerHTML = '';
    $('#ks-log').textContent = '';

    var plan = [
      { prompt: $('#ks-p1').value.trim() },
      { prompt: $('#ks-p2').value.trim() },
    ];
    var dur = parseInt($('#ks-dur').value, 10);
    var tier = $('#ks-tier').value;

    try {
      var result = await KolStitch.runStitchFlow(plan, {
        startImageUrl: startUrl,
        productDriveFileIds: [selectedProduct],
        brandId: DEFAULT_BRAND,
        kolName: DEFAULT_KOL,
        mode: 'auto',
        aspectRatio: '9:16',
        resolution: '720p',
        generateAudio: false,
        tier: tier,
        durationSec: dur,
        onProgress: function (msg) { log('▶ ' + msg); },
        onSegmentDone: function (i, u) { log('  ✅ 第 ' + (i + 1) + ' 段完成'); },
      });
      log('🎬 完成！');
      $('#ks-result').innerHTML =
        '<video src="' + result.finalUrl + '" controls autoplay loop></video>'
        + '<div style="margin-top:6px;"><a class="ks-link" href="' + result.finalUrl + '" target="_blank">↗ 開新分頁看原始影片</a></div>';
    } catch (e) {
      log('❌ 失敗：' + e.message);
    } finally {
      go.disabled = false; go.textContent = '🎬 生成接片';
    }
  }

  // ---- 事件 -----------------------------------------------------------------
  fab.onclick = function () {
    panel.classList.toggle('open');
    if (panel.classList.contains('open')) { showKol(); updateCost(); }
  };
  $('.ks-close').onclick = function () { panel.classList.remove('open'); };
  $('#ks-load').onclick = loadProducts;
  $('#ks-tier').onchange = updateCost;
  $('#ks-go').onclick = generate;

  console.log('[StitchPanel] 已掛載，點右下角 🎬 開始');
})();
