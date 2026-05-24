// ==========================================================================
// kol-stitch-panel.js — STEP 2 長影片接片 v3.0
// --------------------------------------------------------------------------
// 設計：Seedance 單次最長約 15 秒。要更長 → 接片（多段串接）。
//   STEP 2「生成電影鏡頭」下方放一顆「需要 15 秒以上？」按鈕，
//   點了才展開接片區塊。區塊內：顯示目前主角(防呆) + 目標長度 + 生成。
//   讀 S.selectedKol / S.seedanceProductUrls / composeSeedancePrompt
//   → 完全跟著你選的品牌/KOL/商品/場景走，不再亂抓。
//
// 依賴：window.KolStitch（kol-stitch.js，在它之後載入）
// ==========================================================================
(function () {
  'use strict';

  if (!window.KolStitch) { console.warn('[Stitch/STEP2] 需先載入 kol-stitch.js'); return; }

  // 綁定 host 頁面全域（classic script 共用頂層作用域）
  // 先抓頁面內的 const/function（app 真正在 mutate 的那個 S），window 只當備援
  function pick(name) {
    try { var v = eval(name); if (typeof v !== 'undefined' && v !== null) return v; } catch (e) {}
    try { if (typeof window[name] !== 'undefined') return window[name]; } catch (e) {}
    return undefined;
  }
  var ST = pick('S');
  var composeFn = pick('composeSeedancePrompt');
  var toastFn = pick('toast') || function (m) { console.log('[toast]', m); };
  if (!ST || !composeFn) { console.warn('[Stitch/STEP2] 抓不到 S / composeSeedancePrompt'); return; }

  var SEG_SEC = 10; // 接片每段固定 10 秒（POC 驗證過的長度）

  function mount() {
    var baseBtn = document.getElementById('create-seedance-btn');
    if (!baseBtn) return false;
    if (document.getElementById('ks-stitch-wrap')) return true;

    var wrap = document.createElement('div');
    wrap.id = 'ks-stitch-wrap';
    wrap.style.cssText = 'margin-top:10px;';
    wrap.innerHTML = ''
      + '<button id="ks-toggle" style="width:100%;background:#0e0e16;border:1px dashed #3a3a4a;color:#c8c8d8;'
      + 'border-radius:10px;padding:10px;font-size:13px;cursor:pointer;">＋ 需要 15 秒以上？開啟長影片接片</button>'
      + '<div id="ks-box" style="display:none;margin-top:10px;padding:14px;border:1px solid rgba(167,139,250,.30);'
      + 'border-radius:12px;background:#15151f;flex-direction:column;gap:10px;">'
      + '  <div style="font-size:11px;color:#9a9ab0;line-height:1.55;">Seedance 單次最長約 15 秒。接片會自動生多段、用「尾幀接首幀」鎖臉串成長片。<b style="color:#c8c8d8;">商品照、場景、畫質都沿用你上面選的。</b></div>'
      + '  <div id="ks-hero" style="font-size:12px;background:#0e0e16;border:1px solid #2a2a3a;border-radius:9px;padding:8px 10px;"></div>'
      + '  <div style="display:flex;gap:8px;align-items:center;">'
      + '    <label style="font-size:12px;color:#9a9ab0;white-space:nowrap;">目標長度</label>'
      + '    <select id="ks-target" style="flex:1;background:#0e0e16;border:1px solid #2a2a3a;border-radius:8px;color:#e8e8f0;padding:8px;font-size:12px;">'
      + '      <option value="2">約 20 秒（2 段）</option>'
      + '      <option value="3" selected>約 30 秒（3 段）</option>'
      + '      <option value="4">約 40 秒（4 段）</option>'
      + '    </select>'
      + '  </div>'
      + '  <div id="ks-cost" style="font-size:11px;color:#9a9ab0;"></div>'
      + '  <button id="ks-go" class="btn btn-primary">🎬 生成接片</button>'
      + '  <div id="ks-status" style="font-size:12px;color:#8fd9b8;white-space:pre-wrap;"></div>'
      + '  <div id="ks-result"></div>'
      + '</div>';
    baseBtn.parentNode.insertBefore(wrap, baseBtn.nextSibling);

    var heroTimer = null;
    document.getElementById('ks-toggle').onclick = function () {
      var box = document.getElementById('ks-box');
      var open = box.style.display === 'none';
      box.style.display = open ? 'flex' : 'none';
      this.textContent = open ? '－ 收起長影片接片' : '＋ 需要 15 秒以上？開啟長影片接片';
      if (open) {
        refreshHero(); updateCost();
        // 展開期間每 0.6 秒刷新一次「主角」，選了 KOL 立刻反映（修：選了還顯示尚未選定）
        if (heroTimer) clearInterval(heroTimer);
        heroTimer = setInterval(refreshHero, 600);
      } else if (heroTimer) {
        clearInterval(heroTimer); heroTimer = null;
      }
    };
    document.getElementById('ks-target').onchange = updateCost;
    document.getElementById('ks-go').onclick = runStitch;
    console.log('[Stitch/STEP2] 接片已長進 STEP 2');
    return true;
  }

  // 顯示「目前主角」— 防呆，讓使用者一眼確認用對 KOL
  function refreshHero() {
    var el = document.getElementById('ks-hero'); if (!el) return;
    if (ST.selectedKol) {
      el.innerHTML = '主角：<b style="color:#34d399;">' + (ST.selectedKol.name || '未命名')
        + '</b> ｜ 商品照 ' + ((ST.seedanceProductUrls || []).length) + ' 張';
    } else {
      el.innerHTML = '<span style="color:#f0a;">尚未選定 KOL —— 請先在左邊「KOL 形象庫」點一個主角</span>';
    }
  }

  function updateCost() {
    var n = parseInt((document.getElementById('ks-target') || {}).value, 10) || 3;
    var tier = (ST.seedanceParams && ST.seedanceParams.tier) || 'standard';
    var rate = tier === 'standard' ? 0.30 : 0.24;
    var el = document.getElementById('ks-cost');
    if (el) el.textContent = '約 ' + (n * SEG_SEC) + ' 秒成品 · 畫質 ' + (tier === 'standard' ? '標準' : '快速')
      + ' · 預估 $' + (n * SEG_SEC * rate).toFixed(1) + ' USD';
  }

  async function runStitch() {
    if (!ST.selectedKol) { toastFn('請先選定 KOL 形象', 'error'); refreshHero(); return; }
    if (!ST.selectedSceneId) { toastFn('請先選一個場景', 'error'); return; }

    var products = ST.seedanceProductUrls || [];
    if (products.length === 0 && !confirm('沒加商品照，接片裡的商品可能不準。要繼續嗎？')) return;

    var look = (ST.availableLooks || []).find(function (l) { return l.id === ST.selectedLookId; });
    var lookImage = (look && look.image_url) || ST.selectedKol.image_url;
    if (!lookImage) { toastFn('KOL 肖像 URL 取不到', 'error'); return; }

    var basePrompt = composeFn(ST.currentBrandId, ST.selectedSceneId, ST.selectedLocationId, ST.selectedMovementId);
    if (!basePrompt) { toastFn('組 prompt 失敗', 'error'); return; }
    if (ST.seedanceFaceConsistency && !/consistent facial features/i.test(basePrompt)) {
      basePrompt += ', consistent facial features, identity preserved';
    }

    var nSeg = parseInt(document.getElementById('ks-target').value, 10) || 3;
    var plan = [];
    for (var i = 0; i < nSeg; i++) plan.push({ prompt: basePrompt });

    var btn = document.getElementById('ks-go');
    var statusEl = document.getElementById('ks-status');
    var resultEl = document.getElementById('ks-result');
    btn.disabled = true; btn.textContent = '生成中…請勿離開';
    resultEl.innerHTML = ''; statusEl.textContent = '主角：' + ST.selectedKol.name + ' · 開始…';

    try {
      var result = await KolStitch.runStitchFlow(plan, {
        startImageUrl: lookImage,
        productImageUrls: products,
        brandId: ST.currentBrandId,
        kolName: ST.selectedKol.name,
        mode: 'auto',
        resolution: (ST.seedanceParams && ST.seedanceParams.resolution) || '720p',
        aspectRatio: (ST.seedanceParams && ST.seedanceParams.aspectRatio) || '9:16',
        generateAudio: !!(ST.seedanceParams && ST.seedanceParams.generateAudio),
        tier: (ST.seedanceParams && ST.seedanceParams.tier) || 'standard',
        durationSec: SEG_SEC,
        onProgress: function (m) { statusEl.textContent = '▶ ' + m; },
        onSegmentDone: function (idx) { statusEl.textContent = '✅ 第 ' + (idx + 1) + ' / ' + nSeg + ' 段完成'; },
      });
      statusEl.textContent = '🎬 接片完成！';
      resultEl.innerHTML =
        '<video src="' + result.finalUrl + '" controls autoplay loop style="width:100%;border-radius:10px;margin-top:10px;background:#000;"></video>'
        + '<div style="margin-top:6px;"><a href="' + result.finalUrl + '" target="_blank" style="color:#a78bfa;font-size:12px;word-break:break-all;">↗ 開新分頁 / 下載</a></div>';
      toastFn('🎬 接片完成！', 'success');
    } catch (e) {
      statusEl.textContent = '❌ ' + e.message;
      toastFn('接片失敗：' + e.message, 'error');
    } finally {
      btn.disabled = false; btn.textContent = '🎬 生成接片';
    }
  }

  if (!mount()) {
    var n = 0, t = setInterval(function () { if (mount() || ++n > 40) clearInterval(t); }, 500);
  }
})();
