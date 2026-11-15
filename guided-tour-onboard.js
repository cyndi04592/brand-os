// ═══════════════════════════════════════════════════════════════
//  🧭 guided-tour-onboard.js v1.0(2026-11-15)品牌入駐書 新手導覽
//  需要先載入 guided-tour.js v2.0+(提供 BosTour:黃框 + 白卡 + 紅字建議/注意 + 中/日/英)
//
//  表單本身已有步驟條和灰字說明,這裡只補「會影響 AI 品質的坑」,每一頁第一次出現時跑一次:
//   · onb1  第 1 頁:總共幾步、哪些欄位最重要
//   · onb2  第 2 頁:為什麼創立、跟別家比好在哪(寫具體)
//   · onb3  第 3 頁:類別(服務業別選賣東西的)、主力商品(完整名稱、尺寸)
//   · onb5  最後一頁:送出後會發生什麼
//  還在登入畫面時不跑。左下角按鈕可重看目前這一頁。只放導覽,不碰表單任何功能。
// ═══════════════════════════════════════════════════════════════
(function () {
  'use strict';
  if (window.__bosTourOnb) return;
  window.__bosTourOnb = true;
  var VERSION = '1.0';

  function shown(id) {
    var e = document.getElementById(id); if (!e) return false;
    var r = e.getBoundingClientRect();
    return r.width > 4 && r.height > 4 && window.getComputedStyle(e).display !== 'none' &&
      window.getComputedStyle(e).visibility !== 'hidden';
  }
  function done(n) { try { return !!localStorage.getItem('bos_tour_done_' + n); } catch (e) { return true; } }
  function loggedIn() { return !shown('loginOverlay'); }
  //  目前在第幾頁(sec1 / sec2 / sec3 / sec4 / sec46 / sec5)
  function curSec() {
    var a = document.querySelector('.section.active');
    return a ? a.id : '';
  }
  var TOUR_OF = { sec1: 'onb1', sec2: 'onb2', sec3: 'onb3', sec5: 'onb5' };

  function registerAll() {
    var T = BosTour.T, TIP = BosTour.TIP, PIT = BosTour.PIT;

    BosTour.register('onb1', function () { return [
      { t: '#stepsBar',
        title: T('一共 6 步', '全部で 6 ステップ', '6 steps in total'),
        body: T('上面這條會顯示你填到哪。<br>標著<b>「AI 最常用」</b>的欄位最重要,AI 寫廣告、拍影片都靠它。',
                '上のバーで進み具合が分かります。<br><b>「AIがよく使う項目」</b>が一番大事。広告も動画もここを元に作ります。',
                'This bar shows your progress.<br>Fields marked <b>"AI uses this most"</b> matter most — ads and videos are built from them.') +
          TIP('沒有的欄位可以先跳過,之後都能補。', 'ない項目は飛ばしてOK。後から追加できます。', 'Skip what you don\'t have — you can add it later.') }
    ]; });

    BosTour.register('onb2', function () { return [
      { t: '#f_story',
        title: T('為什麼創立這個品牌', 'ブランドを始めた理由', 'Why you started the brand'),
        body: T('用你自己的話寫,<b>真實的小故事</b>最好用。', '自分の言葉で。<b>実際のエピソード</b>が一番効きます。', 'Use your own words — a <b>real story</b> works best.') +
          TIP('寫「什麼事讓你決定做」,不要只寫「想給大家好產品」。',
              '「何がきっかけか」を書きましょう。「良い商品を届けたい」だけでは弱いです。',
              'Say what made you start — not just "we want to offer great products".') },
      { t: '#f_pros',
        title: T('跟別家比,你們好在哪', '他社との違い', 'What makes you better'),
        body: T('這段會變成廣告裡的<b>「為什麼選我們」</b>。', 'ここが広告の<b>「選ばれる理由」</b>になります。', 'This becomes the <b>"why choose us"</b> in your ads.') +
          PIT('寫空泛,廣告就空泛。要寫具體:用什麼原料、怎麼做、服務哪裡不一樣。',
              '曖昧に書くと広告も曖昧に。原料・作り方・サービスの違いを具体的に。',
              'Vague here = vague ads. Be specific: ingredients, process, how your service differs.') }
    ]; });

    BosTour.register('onb3', function () { return [
      { t: '#catGroup',
        title: T('品牌屬於哪個類別', 'ブランドのカテゴリ', 'Brand category'),
        body: T('選最接近的一個,找不到按<b>「看更多類別」</b>。', '一番近いものを1つ。なければ<b>「他のカテゴリを表示」</b>。', 'Pick the closest one; tap <b>"Show more categories"</b> if needed.') +
          PIT('飯店、課程、美業、診所這類<b>服務</b>,要選服務類,不要選賣東西的類別,不然 AI 會把它當商品拍。',
              'ホテル・講座・美容・クリニックなど<b>サービス業</b>は、物販のカテゴリを選ばないで。商品として撮られてしまいます。',
              'Hotels, courses, beauty, clinics are <b>services</b> — don\'t pick a product category, or they\'re shot like goods.') },
      { t: '#prodTable',
        title: T('主力商品 / 服務', '主力商品・サービス', 'Main products / services'),
        body: T('一列一個,寫<b>完整名稱</b>和它是什麼、怎麼用。', '1行に1つ。<b>正式名称</b>と、何に使う物かを書きます。', 'One per row: the <b>full name</b>, what it is and how it\'s used.') +
          PIT('有實體商品的,尺寸要填對,填錯 AI 會畫太大或太小。',
              '実物の商品はサイズを正しく。間違えると大きさがおかしく描かれます。',
              'For physical products, enter the right size, or the AI draws it wrong.') }
    ]; });

    BosTour.register('onb5', function () { return [
      { t: '#btnGenerate',
        title: T('最後:送出', '最後:送信', 'Last step: submit'),
        body: T('按下去會先產生你的<b>「品牌靈魂書」</b>,再送給我們審核。<br>審核通過後,會開通你的素材庫和品牌頁。',
                '押すと<b>ブランドソウルブック</b>を作り、審査へ送ります。<br>承認後に素材ライブラリが使えます。',
                'This creates your <b>Brand Soul Book</b> and sends it for review.<br>Once approved, your asset library and brand page open up.') +
          TIP('送出前往上檢查一次,AI 寫得好不好全看這些資料。',
              '送信前に見直しを。AI の仕上がりが決まります。',
              'Check everything once more — the AI\'s output depends on it.') }
    ]; });
  }

  // ── 左下角「? 教學」──────────────────────────────────────────
  function pill() {
    var p = document.getElementById('bt-tour-pill-onb');
    if (!p) {
      p = document.createElement('button');
      p.id = 'bt-tour-pill-onb'; p.type = 'button'; p.setAttribute('data-i18n-skip', '');
      p.textContent = BosTour.ui().pill;
      p.style.cssText = 'position:fixed;z-index:99997;left:calc(12px + env(safe-area-inset-left,0px));' +
        'bottom:calc(54px + env(safe-area-inset-bottom,0px));' +
        'border:1px solid rgba(255,255,255,.18);background:rgba(20,20,24,.85);color:#f5c542;' +
        'font:800 13px/1 "Noto Sans TC",system-ui,sans-serif;border-radius:999px;padding:9px 13px;cursor:pointer';
      p.onclick = function () { BosTour.start(TOUR_OF[curSec()] || 'onb1', true); };
      document.body.appendChild(p);
    }
    p.style.display = (loggedIn() && TOUR_OF[curSec()]) ? '' : 'none';
  }

  // ── 什麼時候自動跑:每一頁第一次出現時 ───────────────────────────
  var registered = false, tried = {};
  function tryStart(name) {
    if (tried[name]) return;
    var c = document.querySelector('.bt-card');
    if (c && c.style.display !== 'none') return;          // 上一段還在跑,等它跑完
    tried[name] = true;
    setTimeout(function () { if (TOUR_OF[curSec()] === name) BosTour.start(name, false); }, 900);
  }
  setInterval(function () {
    if (!(window.BosTour && window.BosTour.register && window.BosTour.T)) return;
    if (!registered) { registerAll(); registered = true; }
    pill();
    if (!loggedIn()) return;
    var name = TOUR_OF[curSec()];
    if (name && !done(name)) tryStart(name);
  }, 800);

  console.log('[BosTour] 🧭 入駐書導覽 v' + VERSION + ' 就緒');
})();
