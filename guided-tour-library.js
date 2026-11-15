// ═══════════════════════════════════════════════════════════════
//  🧭 guided-tour-library.js v1.1(2026-11-15)素材庫 新手導覽
//  需要先載入 guided-tour.js(提供 BosTour:黃框 + 白卡 + 紅字建議/注意)
//
//  兩段導覽:
//   · lib     素材庫本身:品牌 → 上傳按鈕 → 分類 → 你的素材和成品 → 搜尋
//   · lib-up  打開「＋ 上傳素材」之後:放到哪一類 → 選擇檔案
//  第一次自動跑一次;左下角「? 教學」可以重看。只放導覽,不碰素材庫任何功能。
// ═══════════════════════════════════════════════════════════════
(function () {
  'use strict';
  if (window.__bosTourLib) return;
  window.__bosTourLib = true;
  var VERSION = '1.1';

  function TIP(t) { return '<div class="bt-r"><i>建議</i>' + t + '</div>'; }
  function PIT(t) { return '<div class="bt-r"><i>注意</i>' + t + '</div>'; }

  function shown(id) {
    var e = document.getElementById(id); if (!e) return false;
    var r = e.getBoundingClientRect();
    return r.width > 4 && r.height > 4 && window.getComputedStyle(e).display !== 'none' &&
      window.getComputedStyle(e).visibility !== 'hidden';
  }
  function done(n) { try { return !!localStorage.getItem('bos_tour_done_' + n); } catch (e) { return true; } }

  function registerAll() {
    BosTour.register('lib', [
      { t: '#brandSel', title: '先選品牌',
        body: '這裡選<b>要看哪個品牌</b>的素材。' +
          PIT('上傳前一定先確認品牌,放錯品牌,照片會跑到別家的素材庫。') },
      { t: '#upToggle', title: '上傳照片按這裡',
        body: '按<b>「＋ 上傳素材」</b>,就能把商品照、場景照、LOGO 放進來。' },
      { m: '#libHamburger', title: '上傳照片在右上角選單',
        body: '手機版按右上角 <b>☰</b>,裡面有<b>「＋ 上傳素材」</b>,就能把商品照、場景照、LOGO 放進來。' },
      { t: '#tabs', title: '分類',
        body: '素材會照<b>分類</b>放好:商品照、人物照、未分類…;做好的<b>廣告圖、短影片</b>也都存在這裡。' +
          PIT('廣告圖產生器只會列出「商品照」。放在「未分類」的照片,做廣告圖時找不到。') },
      { t: ['#body .grid > :first-child', '#body'], title: '你的素材和成品',
        body: '上面選哪一類,下面就顯示哪一類的照片和影片,往下滑看更多。' },
      { t: '#q', title: '找不到照片?',
        body: '在這裡<b>打檔名</b>就能搜尋。' +
          TIP('剛上傳完沒看到,按右上角「重新整理」。') }
    ]);

    BosTour.register('lib-up', [
      { t: '#upCat', title: '先選「放到哪一類」',
        body: '<b>商品照</b>:要拍廣告的商品。<b>場景照</b>:門市、店面、教室的實景。<br><b>人物照</b>:代言人或你自己。<b>LOGO</b>:品牌標誌。' +
          PIT('LOGO 一定要選「LOGO」,放成商品照會被當成照片拿去拍!') +
          PIT('商品照沒選「商品照」,做廣告圖時會找不到。') },
      { t: '#upPick', title: '選照片',
        body: '按<b>「選擇檔案」</b>,一次可以選好幾張;電腦也可以直接把圖片拖進這個框。' +
          TIP('照片越清楚、主角越大,做出來的廣告圖越好。') }
    ]);
  }

  // ── 左下角「? 教學」──────────────────────────────────────────
  function pill() {
    var p = document.getElementById('bt-tour-pill-lib');
    if (!p) {
      p = document.createElement('button');
      p.id = 'bt-tour-pill-lib'; p.type = 'button'; p.setAttribute('data-i18n-skip', '');
      p.textContent = '? 教學';
      p.style.cssText = 'position:fixed;z-index:99997;left:calc(12px + env(safe-area-inset-left,0px));' +
        'bottom:calc(54px + env(safe-area-inset-bottom,0px));' +
        'border:1px solid rgba(255,255,255,.18);background:rgba(20,20,24,.85);color:#f5c542;' +
        'font:800 13px/1 "Noto Sans TC",system-ui,sans-serif;border-radius:999px;padding:9px 13px;cursor:pointer';
      p.onclick = function () { BosTour.start(shown('upPanel') ? 'lib-up' : 'lib', true); };
      document.body.appendChild(p);
    }
    p.style.display = shown('tabs') ? '' : 'none';      // 還沒登入、沒選品牌時不出現
  }

  // ── 什麼時候自動跑 ───────────────────────────────────────────
  var registered = false, tried = {};
  function tryStart(name) {
    if (tried[name]) return;
    var c = document.querySelector('.bt-card');
    if (c && c.style.display !== 'none') return;          // 別的導覽還在跑,等它跑完
    tried[name] = true;
    setTimeout(function () { BosTour.start(name, false); }, 1000);
  }
  setInterval(function () {
    if (!(window.BosTour && window.BosTour.register)) return;
    if (!registered) { registerAll(); registered = true; }
    pill();
    if (shown('upPanel')) { if (!done('lib-up')) tryStart('lib-up'); }
    else if (shown('tabs') && !done('lib')) tryStart('lib');
  }, 800);

  console.log('[BosTour] 🧭 素材庫導覽 v' + VERSION + ' 就緒(左下「? 教學」重看)');
})();
