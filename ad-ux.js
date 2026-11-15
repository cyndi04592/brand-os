// ═══════════════════════════════════════════════════════════════
//  🧭 ad-ux.js v1.1(2026-11-15)廣告圖產生器的操作順暢度(index.html 用)
//  v1.1 RA 11-15 手機實測(長榮桂冠):
//   ⑤ 左下角語言切換鈕(🌐)蓋住產生器底部的進度與「完成」文字 → 產生器開著時先藏起來,關掉再出現
//   ⑥ 從外面換照片(素材庫點選)後,產生器裡照片列下的檔名還是上一張 → 換照片時順便重畫產生器的照片列
//  RA 11-15 用手機當客人走一遍「做廣告圖」,抓到這幾個卡點:
//   ① 「套用 AI 效果」沒寫要扣幾點 → 按鈕直接寫「套用 AI 效果 · 扣 240 點」(換尺寸會跟著變)
//   ② 沒選照片就按「做廣告圖」→ 畫面跳到最底下素材庫;選完照片什麼都沒發生,要自己滑回去再按一次
//      → 從「做廣告圖」被帶去選照片的,點完照片就自動打開廣告圖產生器
//   ③ 手機上預覽圖黏在最上面、佔掉快半個螢幕 → 手機上預覽縮到約 1/4 螢幕高
//   ④ 還沒生成就看得到「⬇ 下載廣告圖」→ 生成出圖之後才出現
//  為什麼另開一個檔:index.html、admaker.js 都已超過 1,500 行紅線,新東西不再塞進去。
//  做法:只「包住」既有的全域函式(_guideToAssets、selectAsset),不改它們任何一行。
//  載入順序:index.html 在 admaker.js / assets.js 之後。
// ═══════════════════════════════════════════════════════════════
(function () {
  'use strict';
  if (window._adUx) return;
  window._adUx = '1.1';

  //  ③ 手機預覽縮小(index.html 原本的手機規則讓預覽 sticky 在頂端,這裡只限制它的高度)
  var s = document.createElement('style');
  s.id = 'ad-ux-css';
  s.textContent = '@media (max-width:768px){'
    + '#adMakerModal > div > div:last-child{padding-top:6px!important;padding-bottom:6px!important}'
    + '#adMakerModal #adCanvas{max-height:26vh!important;width:auto!important;max-width:100%!important;margin:0 auto}'
    + '#adMakerModal #previewLabel{font-size:10px!important}'
    + '}';
  document.head.appendChild(s);

  //  ② 從「做廣告圖」被帶去選照片 → 記一個旗標;點到照片就自動打開
  var wantOpen = false;
  function hook() {
    var ok = 0;
    if (typeof window._guideToAssets === 'function' && !window._guideToAssets.__ux) {
      var g = window._guideToAssets;
      window._guideToAssets = function () {
        wantOpen = true;
        var r = g.apply(this, arguments);
        var tip = document.getElementById('assetGuideTip');
        if (tip) tip.textContent = '👇 點一張照片,廣告圖產生器就會自動打開';
        return r;
      };
      window._guideToAssets.__ux = true;
    }
    if (window._guideToAssets && window._guideToAssets.__ux) ok++;
    if (typeof window.selectAsset === 'function' && !window.selectAsset.__ux) {
      var sa = window.selectAsset;
      window.selectAsset = function (type, i) {
        var r = sa.apply(this, arguments);
        //  ⑥ 產生器開著 → 照片列與檔名跟著更新
        try { var mm = document.getElementById('adMakerModal'); if (mm && mm.style.display !== 'none' && typeof window.renderAmPhotoRow === 'function') window.renderAmPhotoRow(); } catch (e) {}
        try {
          if (wantOpen && type === 'photo' && window.S && window.S.selPhoto !== null && window.S.selPhoto !== undefined) {
            wantOpen = false;
            setTimeout(function () { if (typeof window.openAdMakerDirect === 'function') window.openAdMakerDirect(); }, 350);
          }
        } catch (e) {}
        return r;
      };
      window.selectAsset.__ux = true;
    }
    if (window.selectAsset && window.selectAsset.__ux) ok++;
    return ok === 2;
  }
  if (!hook()) { var n = 0, t = setInterval(function () { if (hook() || ++n > 40) clearInterval(t); }, 250); }

  //  ① 按鈕寫點數 + ④ 下載鈕出圖後才出現(視窗開著才檢查,關著不做事)
  function cost() {
    try { if (typeof _adCost === 'function') { var n = Number(_adCost()); if (n > 0) return n; } } catch (e) {}
    return 0;
  }
  function hasResult() {
    try { return typeof PR_BG_IMG !== 'undefined' && !!PR_BG_IMG; } catch (e) { return false; }
  }
  setInterval(function () {
    var m = document.getElementById('adMakerModal');
    var open = !!(m && m.style.display !== 'none');
    //  ⑤ 產生器開著就藏語言鈕(關掉就恢復)
    var sw = document.getElementById('bos-lang-sw');
    if (sw) { if (open && sw.style.visibility !== 'hidden') sw.style.visibility = 'hidden'; else if (!open && sw.style.visibility === 'hidden') sw.style.visibility = ''; }
    if (!open) return;
    var b = document.getElementById('prApplyBtn');
    if (b && !b.disabled && /^套用 AI 效果/.test(b.textContent)) {
      var c = cost(), want = '套用 AI 效果' + (c ? ' · 扣 ' + c + ' 點' : '');
      if (b.textContent !== want) b.textContent = want;
    }
    var d = document.getElementById('adDownloadBtn');
    if (d) { var show = hasResult(); if ((d.style.display === 'none') === show) d.style.display = show ? '' : 'none'; }
  }, 500);

  console.log('[ad-ux] v1.1 就緒 · 產生器開著藏語言鈕 · 換照片更新檔名 · 按鈕寫點數 · 選完照片自動開產生器 · 手機預覽縮小 · 出圖才顯示下載');
})();
