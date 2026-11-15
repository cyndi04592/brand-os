// ═══════════════════════════════════════════════════════════════
//  🧭 guided-tour-library.js v2.1(2026-11-15)素材庫 新手導覽
//  需要先載入 guided-tour.js v2.0+(提供 BosTour:黃框 + 白卡 + 紅字建議/注意 + 中/日/英)
//
//  兩段導覽:
//   · lib     素材庫本身:品牌 → 上傳在哪(電腦按鈕 / 手機右上 ☰)→ 分類 → 素材和成品 → 搜尋
//   · lib-up  打開「＋ 上傳素材」之後:放到哪一類 → 選擇檔案
//  文字跟著網站語言(中文 / 日本語 / English)。第一次自動跑一次;左下角按鈕可以重看。
//  只放導覽,不碰素材庫任何功能。
// ═══════════════════════════════════════════════════════════════
(function () {
  'use strict';
  if (window.__bosTourLib) return;
  window.__bosTourLib = true;
  var VERSION = '2.1';

  function shown(id) {
    var e = document.getElementById(id); if (!e) return false;
    var r = e.getBoundingClientRect();
    return r.width > 4 && r.height > 4 && window.getComputedStyle(e).display !== 'none' &&
      window.getComputedStyle(e).visibility !== 'hidden';
  }
  function done(n) { try { return !!localStorage.getItem('bos_tour_done_' + n); } catch (e) { return true; } }

  function registerAll() {
    var T = BosTour.T, TIP = BosTour.TIP, PIT = BosTour.PIT;
    var UPLOAD_BODY = function () {
      return T('就能把商品照、場景照、LOGO 放進來。', '商品写真・シーン写真・ロゴを追加できます。', 'to add product photos, scene photos and your logo.');
    };

    BosTour.register('lib', function () { return [
      { t: '#brandSel',
        title: T('先選品牌', 'まずブランドを選ぶ', 'Pick your brand'),
        body: T('這裡選<b>要看哪個品牌</b>的素材。', 'ここで<b>どのブランド</b>の素材を見るか選びます。', 'Choose <b>which brand\'s</b> assets to view.') +
          PIT('上傳前一定先確認品牌,放錯品牌,照片會跑到別家的素材庫。',
              'アップロード前に必ずブランドを確認。間違えると別ブランドのライブラリに入ります。',
              'Always check the brand before uploading — the wrong one puts photos in another brand\'s library.') },
      { t: '#upToggle',
        title: T('上傳照片按這裡', '写真のアップロードはここ', 'Upload photos here'),
        body: T('按<b>「＋ 上傳素材」</b>,', '<b>「＋ 素材をアップロード」</b>で', 'Tap <b>"+ Upload assets"</b> ') + UPLOAD_BODY() },
      { m: '#libHamburger',
        title: T('上傳照片在右上角選單', 'アップロードは右上のメニュー', 'Upload is in the top-right menu'),
        body: T('手機版按右上角 <b>☰</b>,裡面有<b>「＋ 上傳素材」</b>,', 'スマホでは右上の <b>☰</b> に<b>「＋ 素材をアップロード」</b>があり、', 'On mobile, tap <b>☰</b> at the top right — <b>"+ Upload assets"</b> is inside, ') + UPLOAD_BODY() },
      { t: '#tabs',
        title: T('分類', 'カテゴリ', 'Categories'),
        body: T('素材會照<b>分類</b>放好:商品照、人物照、未分類…;做好的<b>廣告圖、短影片</b>也都存在這裡。',
                '素材は<b>カテゴリ</b>ごとに整理されます(商品写真、人物写真、未分類…)。作った<b>広告画像やショート動画</b>もここに保存されます。',
                'Assets are sorted by <b>category</b>; your finished <b>ad images and videos</b> are here too.') +
          PIT('廣告圖產生器只會列出「商品照」。放在「未分類」的照片,做廣告圖時找不到。',
              '広告作成に出るのは「商品写真」だけ。「未分類」は表示されません。',
              'The ad maker only lists "Product photos" — "Uncategorized" ones won\'t appear.') },
      { t: ['#body .grid > :first-child', '#body'],
        title: T('你的素材和成品', '素材と完成品', 'Your assets and results'),
        body: T('上面選哪一類,下面就顯示哪一類的照片和影片,往下滑看更多。',
                '上で選んだカテゴリの写真・動画が下に表示されます。スクロールでもっと見られます。',
                'Whatever category you pick above shows here — scroll down for more.') },
      { t: '#q',
        title: T('找不到照片?', '写真が見つからない?', 'Can\'t find a photo?'),
        body: T('在這裡<b>打檔名</b>就能搜尋。', 'ここに<b>ファイル名</b>を入れて検索できます。', 'Type a <b>file name</b> here to search.') +
          TIP('剛上傳完沒看到,按右上角「重新整理」。', 'アップロード直後に見えなければ、右上の「再読み込み」を。', 'Just uploaded and don\'t see it? Tap "Refresh" at the top right.') }
    ]; });

    BosTour.register('lib-up', function () { return [
      { t: '#upCat',
        title: T('先選「放到哪一類」', 'まず「どこに入れるか」を選ぶ', 'First choose where it goes'),
        body: T('<b>商品照</b>:要拍廣告的商品。<b>場景照</b>:門市、店面、教室的實景。<br><b>人物照</b>:代言人或你自己。<b>LOGO</b>:品牌標誌。',
                '<b>商品写真</b>:広告の商品 <b>シーン写真</b>:店舗の実景<br><b>人物写真</b>:本人・アンバサダー <b>LOGO</b>:ロゴ',
                '<b>Product</b>: what you advertise. <b>Scene</b>: your real shop.<br><b>People</b>: you or your ambassador. <b>LOGO</b>: your logo.') +
          PIT('LOGO 一定要選「LOGO」,放成商品照會被當成照片拿去拍!',
              'ロゴは必ず「LOGO」へ。商品写真にすると撮影に使われます!',
              'Logos go under "LOGO", or they get shot as a photo!') },
      { t: '#upPick',
        title: T('選照片', '写真を選ぶ', 'Choose photos'),
        body: T('按<b>「選擇檔案」</b>,一次可以選好幾張;電腦也可以直接把圖片拖進這個框。',
                '<b>「ファイルを選択」</b>で複数枚まとめて選べます。パソコンならこの枠にドラッグしてもOK。',
                'Tap <b>"Choose files"</b> to pick several at once; on a computer you can also drag images into this box.') +
          TIP('照片越清楚、主角越大,做出來的廣告圖越好。', '写真が鮮明で主役が大きいほど、広告画像の仕上がりが良くなります。', 'Sharper photos with a bigger subject make better ad images.') }
    ]; });
  }

  // ── 左下角「? 教學」──────────────────────────────────────────
  function pill() {
    var p = document.getElementById('bt-tour-pill-lib');
    if (!p) {
      p = document.createElement('button');
      p.id = 'bt-tour-pill-lib'; p.type = 'button'; p.setAttribute('data-i18n-skip', '');
      p.textContent = BosTour.ui().pill;
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
    if (!(window.BosTour && window.BosTour.register && window.BosTour.T)) return;
    if (!registered) { registerAll(); registered = true; }
    pill();
    if (shown('upPanel')) { if (!done('lib-up')) tryStart('lib-up'); }
    else if (shown('tabs') && !done('lib')) tryStart('lib');
  }, 800);

  console.log('[BosTour] 🧭 素材庫導覽 v' + VERSION + ' 就緒');
})();
