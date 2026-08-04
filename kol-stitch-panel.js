// ==========================================================================
// kol-stitch-panel.js — STEP 2 長影片接片 v3.2
// --------------------------------------------------------------------------
// 設計：Seedance 單次最長約 15 秒。要更長 → 接片（多段串接）。
//   STEP 2「生成電影鏡頭」下方放一顆「需要 15 秒以上？」按鈕，
//   點了才展開接片區塊。區塊內：顯示目前主角(防呆) + 目標長度 + 生成。
//   讀 S.selectedKol / S.seedanceProductUrls / composeSeedancePrompt
//   → 完全跟著你選的品牌/KOL/商品/場景走，不再亂抓。
//
//   🆕 v3.1 改動（只動 runStitch）：
//     1. 補傳 duration + opts → 劇情(cine-situation)終於進得去（原本漏傳）
//     2. 預設鎖臉（比照 STEP2 主按鈕，不再只靠開關）
//     3. 第一段加「商品 hero 開場特寫」，後段照劇情走
//     （商品變大已由 kol.html 的 BRAND_ACTIONS.default 統一處理，所有品牌一視同仁）
//
//   🆕 v3.2 改動（配合 kol-stitch.js v2.0 reference-to-video）：
//     1. 文案更新：不再是「尾幀接首幀」，改為「回錨原始照片＋接住前一段影片」
//     2. 第 2 段起 prompt 自動帶 [Video1] 延續句 → 情緒/表情接住、不重生
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
  if (!ST || !composeFn) { console.warn('[Stitch/STEP2] 抓不到必要函式'); return; }

  // 每段秒數 = 沿用上面「時長(秒)」選的 5/10/15。選 auto 或抓不到 → 預設 10。
  function segSec() {
    var d = ST.seedanceParams && ST.seedanceParams.duration;
    var n = parseInt(d, 10);
    return (n && n > 0) ? n : 10;
  }

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
      + '  <div style="font-size:11px;color:#9a9ab0;line-height:1.55;">單段最長約 15 秒。接片會自動生多段、每段<b style="color:#c8c8d8;">回錨原始照片＋接住前一段影片</b>（reference-to-video），臉、商品、情緒都不斷。<b style="color:#c8c8d8;">商品照、場景、畫質都沿用你上面選的。</b></div>'
      + '  <div id="ks-hero" style="font-size:12px;background:#0e0e16;border:1px solid #2a2a3a;border-radius:9px;padding:8px 10px;"></div>'
      + '  <div style="display:flex;gap:8px;align-items:center;">'
      + '    <label style="font-size:12px;color:#9a9ab0;white-space:nowrap;">目標長度</label>'
      + '    <select id="ks-target" style="flex:1;background:#0e0e16;border:1px solid #2a2a3a;border-radius:8px;color:#e8e8f0;padding:8px;font-size:12px;">'
      + '      <option value="2">2 段</option>'
      + '      <option value="3" selected>3 段</option>'
      + '      <option value="4">4 段</option>'
      + '    </select>'
      + '  </div>'
      + '  <div id="ks-cost" style="font-size:11px;color:#9a9ab0;"></div>'
      + '  <button id="ks-go" class="btn btn-primary">生成接片</button>'
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
        heroTimer = setInterval(function () { refreshHero(); updateCost(); }, 600);
      } else if (heroTimer) {
        clearInterval(heroTimer); heroTimer = null;
      }
    };
    document.getElementById('ks-target').onchange = updateCost;
    document.getElementById('ks-go').onclick = runStitch;
    console.log('[Stitch/STEP2] 接片已長進 STEP 2 · v3.2 reference-to-video');
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
    var seg = segSec();
    var total = n * seg;
    var tier = (ST.seedanceParams && ST.seedanceParams.tier) || 'standard';
    var rate = tier === 'standard' ? 0.30 : 0.24;
    var el = document.getElementById('ks-cost');
    if (!el) return;
    var autoNote = (ST.seedanceParams && String(ST.seedanceParams.duration) === 'auto')
      ? '（上面選 auto，接片每段預設 10 秒）' : '';
    el.textContent = n + ' 段 × ' + seg + ' 秒 ≈ 總長 ' + total + ' 秒 · 畫質 '
      + (tier === 'standard' ? '標準' : '快速') + ' · 預估 $' + (total * rate).toFixed(1) + ' USD ' + autoNote;
  }

  async function runStitch() {
    if (!ST.selectedKol) { toastFn('請先選定 KOL 形象', 'error'); refreshHero(); return; }
    if (!ST.selectedSceneId) { toastFn('請先選一個場景', 'error'); return; }

    var products = ST.seedanceProductUrls || [];
    if (products.length === 0 && !confirm('沒加商品照，接片裡的商品可能不準。要繼續嗎？')) return;

    var look = (ST.availableLooks || []).find(function (l) { return l.id === ST.selectedLookId; });
    var lookImage = (look && look.image_url) || ST.selectedKol.image_url;
    if (!lookImage) { toastFn('KOL 肖像 URL 取不到', 'error'); return; }

    // 🆕 讀 STEP2 劇情框(跟「生成電影鏡頭」主按鈕共用同一個 cine-situation)
    var cineSituation = (document.getElementById('cine-situation') || {}).value || '';
    cineSituation = String(cineSituation).trim();

    // 🆕 組 opts — 比照主按鈕:帶 outfitBrand + 劇情。原本漏傳 opts → 劇情整段沒進 prompt。
    //    ⚠️ 絕不傳 portraitMode='natural'，否則會破壞已鎖好的臉
    var opts = { outfitBrand: ST.selectedOutfitBrand || 'auto' };
    if (cineSituation) opts.episode = { situation: cineSituation };

    // 🆕 補上 duration(第5參) + opts(第6參) → 劇情/場景吃得進去。
    //    商品變大已由 kol.html 的 BRAND_ACTIONS.default 統一處理(所有品牌一視同仁)。
    var segDur = String(segSec());
    var basePrompt = composeFn(ST.currentBrandId, ST.selectedSceneId, ST.selectedLocationId, ST.selectedMovementId, segDur, opts);
    if (!basePrompt) { toastFn('組 prompt 失敗', 'error'); return; }

    // 🆕 預設鎖臉(比照主按鈕,不再只靠開關)
    if (!/consistent facial features/i.test(basePrompt)) {
      basePrompt += ', consistent facial features and identity preserved from reference image, same person throughout';
    }

    // 🆕 第一段先給商品一個清楚的開場特寫(hero),後段照劇情走
    var heroOpening = (products.length > 0)
      ? 'The shot opens with a brief clear close-up of the product package, large and front-facing toward the camera, then continues naturally: '
      : '';

    var nSeg = parseInt(document.getElementById('ks-target').value, 10) || 3;

    // 🆕 v3.2：第 2 段起加「延續前一段影片 [Video1]」→ 情緒/表情接住、不重生
    //    (引擎 kol-stitch.js v2.0 會把前一段整支影片當 video_urls 餵進來，這裡是叫模型「用」它)
    var continueLead = 'This shot continues directly from the previous video [Video1]: the same person with the exact same face, the same expression and emotion flowing on naturally without any reset or restart. ';

    var plan = [];
    for (var i = 0; i < nSeg; i++) {
      var segPrompt;
      if (i === 0) {
        segPrompt = heroOpening ? (heroOpening + basePrompt) : basePrompt;   // 第一段：商品開場 + 劇情
      } else {
        segPrompt = continueLead + basePrompt;                                // 後段：延續 [Video1]
      }
      plan.push({ prompt: segPrompt });
    }

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
        durationSec: segSec(),
        onProgress: function (m) { statusEl.textContent = '▶ ' + m; },
        onSegmentDone: function (idx) { statusEl.textContent = '✅ 第 ' + (idx + 1) + ' / ' + nSeg + ' 段完成'; },
      });
      statusEl.textContent = '接片完成！';
      resultEl.innerHTML =
        '<video src="' + result.finalUrl + '" controls autoplay loop style="width:100%;border-radius:10px;margin-top:10px;background:#000;"></video>'
        + '<div style="margin-top:6px;"><a href="' + result.finalUrl + '" target="_blank" style="color:#a78bfa;font-size:12px;word-break:break-all;">↗ 開新分頁 / 下載</a></div>';
      toastFn('接片完成！', 'success');
    } catch (e) {
      statusEl.textContent = '❌ ' + e.message;
      toastFn('接片失敗：' + e.message, 'error');
    } finally {
      btn.disabled = false; btn.textContent = '生成接片';
    }
  }

  if (!mount()) {
    var n = 0, t = setInterval(function () { if (mount() || ++n > 40) clearInterval(t); }, 500);
  }
})();
