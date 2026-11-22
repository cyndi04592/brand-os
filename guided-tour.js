// ═══════════════════════════════════════════════════════════════
//  🧭 guided-tour.js v2.1(2026-11-15)新手導覽(一步一步教學)
//  RA 11-15:參考她做過的表單教學 —— 把「現在要做的那一格」框起來,
//   下面一張白卡片寫「第 X 步,共 Y 步」+ 白話說明 +「下一步 →」。
//
//  RWD 怎麼處理(RA:「有 RWD,做邊應該會失敗」):
//   ① 每一步可以分手機版(m)/ 電腦版(d)各寫要框的東西,依螢幕寬度自動選
//   ② 一步可以給好幾個候選,第一個「看得到」的才框;全部看不到 → 這步自動跳過,不卡住
//   ③ 黃框每一格畫面都重新對位(捲動、轉橫向、選單展開都跟得上)
//   ④ 被框的東西在畫面下半部 → 卡片改貼上面,不擋住要點的地方
//   ⑤ 導覽不擋操作:框起來的那格照樣可以點、可以打字
//
//  兩段導覽:
//   · lab     品牌投放實驗室(首頁):選品牌 → 系列商品 → 受眾 → 做廣告圖 → 素材庫 → 生成文案
//   · admaker 廣告圖產生器(第一次打開產生器時):照片 → ⓪ → ① → ② → ③ → 文字 → 尺寸 → 套用(扣點)
//   第一次來自動跑一次;左下角「教學」可以重看。
//
//  另開一支檔:index.html、kol.html 都超過 1,500 行,新功能不塞進去。
//  要加別頁:BosTour.register('名字', [步驟...]) 再呼叫 BosTour.start('名字')。
// ═══════════════════════════════════════════════════════════════
(function () {
  'use strict';
  if (window.BosTour) return;
  var VERSION = '2.1';
  var MOBILE = '(max-width: 768px)';
  var TOURS = {};
  var cur = null;          // { name, steps, i, el }
  var ui = null;           // { ring, card }
  var raf = 0;

  function isMobile() { try { return window.matchMedia(MOBILE).matches; } catch (e) { return window.innerWidth <= 768; } }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }
  function doneKey(name) { return 'bos_tour_done_' + name; }

  //  v2.0:跟著網站語言走(右下角 🌐 切換,i18n-loader 存在 BOS_LANG / localStorage bos_lang;切換會重新整理頁面)
  function lang() {
    var l = window.BOS_LANG; if (!l) l = lsGet('bos_lang');
    return (l === 'ja' || l === 'en') ? l : 'zh';
  }
  var UI = {
    zh: { step: function (i, n) { return '第 ' + i + ' 步,共 ' + n + ' 步'; }, prev: '← 上一步', next: '下一步 →', done: '知道了 ✓', close: '關閉', pill: '教學', tip: '建議', pit: '注意' },
    ja: { step: function (i, n) { return 'ステップ ' + i + ' / ' + n; }, prev: '← 戻る', next: '次へ →', done: 'わかった ✓', close: '閉じる', pill: '使い方', tip: 'ヒント', pit: '注意' },
    en: { step: function (i, n) { return 'Step ' + i + ' of ' + n; }, prev: '← Back', next: 'Next →', done: 'Got it ✓', close: 'Close', pill: 'Guide', tip: 'Tip', pit: 'Heads-up' }
  };
  function U() { return UI[lang()]; }
  function T(zh, ja, en) { var l = lang(); return l === 'ja' ? (ja || zh) : l === 'en' ? (en || zh) : zh; }
  function TIP(zh, ja, en) { return '<div class="bt-r"><i>' + U().tip + '</i>' + T(zh, ja, en) + '</div>'; }
  function PIT(zh, ja, en) { return '<div class="bt-r"><i>' + U().pit + '</i>' + T(zh, ja, en) + '</div>'; }

  function visible(el) {
    if (!el || !el.getBoundingClientRect) return false;
    var r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return false;
    //  v1.7:固定在畫面邊緣、但被滑出畫面外藏起來的(例如 KOL 頁底部那條)= 看不到
    if (r.bottom <= 1 || r.top >= window.innerHeight - 1 || r.right <= 1 || r.left >= window.innerWidth - 1) {
      for (var p = el; p && p !== document.body; p = p.parentElement) {
        if (window.getComputedStyle(p).position === 'fixed') return false;
      }
    }
    var cs = window.getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.05;
  }
  //  一步的目標:手機 m / 電腦 d / 共用 t,每個都可以是字串或陣列(第一個看得到的勝出)
  function findTarget(step) {
    var list = (isMobile() ? (step.m || step.t) : (step.d || step.t)) || step.t || step.m || step.d;
    if (!Array.isArray(list)) list = [list];
    for (var i = 0; i < list.length; i++) {
      var el = null; try { el = document.querySelector(list[i]); } catch (e) {}
      if (visible(el)) return el;
    }
    return null;
  }

  function css() {
    if (document.getElementById('bt-tour-css')) return;
    var s = document.createElement('style'); s.id = 'bt-tour-css';
    s.textContent =
      '.bt-ring{position:fixed;z-index:100001;pointer-events:none;border:3px solid #f5c542;border-radius:12px;' +
      'box-shadow:0 0 0 4px rgba(245,197,66,.25),0 0 0 9999px rgba(8,8,14,.55);transition:all .18s ease}' +
      '.bt-card{position:fixed;z-index:100002;left:12px;right:12px;margin:0 auto;max-width:520px;box-sizing:border-box;' +
      'background:#fff;color:#1d1d24;border-radius:18px;padding:20px 20px 16px;box-shadow:0 18px 50px rgba(0,0,0,.45);' +
      'font-family:"Noto Sans TC",system-ui,sans-serif}' +
      '.bt-card .bt-n{font-size:14px;font-weight:800;color:#b8860b;letter-spacing:.5px;margin-bottom:6px}' +
      '.bt-card .bt-t{font-size:20px;font-weight:900;color:#1f5f63;margin:0 0 10px;line-height:1.35}' +
      '.bt-card .bt-b{font-size:15.5px;line-height:1.75;color:#2a2a33}' +
      '.bt-card .bt-b b{font-weight:900;color:#111}' +
      '.bt-card .bt-r{margin-top:10px;padding:8px 10px;border-radius:10px;background:#fdecea;color:#c62828;font-weight:800;font-size:15px;line-height:1.6}' +
      '.bt-card .bt-r i{font-style:normal;display:inline-block;background:#c62828;color:#fff;border-radius:6px;padding:0 7px;margin-right:6px;font-size:13px}' +
      '.bt-card .bt-r b{color:#b71c1c}' +
      //  v1.9:手機卡片縮小,少蓋一點畫面
      '@media (max-width:768px){.bt-card{padding:14px 16px 12px}.bt-card .bt-n{font-size:13px;margin-bottom:4px}' +
      '.bt-card .bt-t{font-size:18px;margin-bottom:6px}.bt-card .bt-b{font-size:14.5px;line-height:1.6}' +
      '.bt-card .bt-r{font-size:14px;padding:6px 9px;margin-top:8px}.bt-card .bt-row{margin-top:10px}' +
      '.bt-card .bt-next{padding:11px 22px;font-size:16px;min-width:130px}}' +
      '.bt-card .bt-x{position:absolute;top:10px;right:12px;width:34px;height:34px;border:none;background:none;font-size:22px;color:#888;cursor:pointer;line-height:1}' +
      '.bt-card .bt-row{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:16px}' +
      '.bt-card .bt-prev{border:none;background:none;color:#777;font-size:15px;font-weight:700;padding:10px 4px;cursor:pointer}' +
      '.bt-card .bt-next{border:none;background:#1f5f63;color:#fff;font-size:17px;font-weight:900;border-radius:12px;padding:14px 26px;cursor:pointer;min-width:150px}' +
      '.bt-pill{position:fixed;z-index:99997;left:calc(12px + env(safe-area-inset-left,0px));bottom:calc(54px + env(safe-area-inset-bottom,0px));' +
      'border:1px solid rgba(255,255,255,.18);background:rgba(20,20,24,.85);color:#f5c542;font:800 13px/1 "Noto Sans TC",system-ui,sans-serif;' +
      'border-radius:999px;padding:9px 13px;cursor:pointer}';
    document.head.appendChild(s);
  }

  function build() {
    if (ui) return ui;
    css();
    var ring = document.createElement('div'); ring.className = 'bt-ring';
    var card = document.createElement('div'); card.className = 'bt-card'; card.setAttribute('data-i18n-skip', '');
    card.innerHTML = '<button class="bt-x" aria-label="' + U().close + '">✕</button><div class="bt-n"></div><h3 class="bt-t"></h3>' +
      '<div class="bt-b"></div><div class="bt-row"><button class="bt-prev">' + U().prev + '</button><button class="bt-next">' + U().next + '</button></div>';
    document.body.appendChild(ring); document.body.appendChild(card);
    card.querySelector('.bt-x').onclick = function () { stop(true); };
    card.querySelector('.bt-next').onclick = function () { go(1); };
    card.querySelector('.bt-prev').onclick = function () { go(-1); };
    ui = { ring: ring, card: card };
    return ui;
  }

  //  每一格畫面重新對位(捲動 / 轉向 / 選單展開都跟得上)
  function place() {
    if (!cur || !ui) return;
    var el = cur.el;
    if (!el || !document.body.contains(el) || !visible(el)) {
      var again = findTarget(cur.steps[cur.i]);
      if (again) cur.el = el = again;
    }
    if (el && visible(el)) {
      var r = el.getBoundingClientRect(), pad = 6;
      ui.ring.style.display = 'block';
      ui.ring.style.left = (r.left - pad) + 'px'; ui.ring.style.top = (r.top - pad) + 'px';
      ui.ring.style.width = (r.width + pad * 2) + 'px'; ui.ring.style.height = (r.height + pad * 2) + 'px';
      //  v1.1:卡片放到「框外空間比較大」的那一邊(手機卡片高,不能只看中心點)
      var lower = r.top > (window.innerHeight - r.bottom);
      ui.card.style.top = lower ? 'calc(12px + env(safe-area-inset-top,0px))' : 'auto';
      ui.card.style.bottom = lower ? 'auto' : 'calc(14px + env(safe-area-inset-bottom,0px))';
      //  v1.5:卡片還是蓋到框(卡片變高時)→ 等捲動停了,把內容再推開一點(每步最多 3 次)
      //  捲動還在跑就不要推(會把捲動打斷);框連續 12 格畫面沒動才算停好
      if (Math.abs(r.top - (cur.lastTop == null ? -1e9 : cur.lastTop)) < 0.5) cur.still = (cur.still || 0) + 1; else cur.still = 0;
      cur.lastTop = r.top;
      if (cur.adj < 3 && cur.still > 12 && Date.now() - cur.t0 > 400) {
        var cr = ui.card.getBoundingClientRect();
        var ov = lower ? (cr.bottom + 10 - (r.top - pad)) : ((r.bottom + pad) + 10 - cr.top);
        if (ov > 2 && cr.height + r.height + 40 < window.innerHeight) {
          var sc = scroller(el); cur.adj++; cur.still = 0;
          sc.scrollTop += lower ? -ov : ov;
        }
      }
    } else {
      ui.ring.style.display = 'none';
      ui.card.style.top = 'auto'; ui.card.style.bottom = 'calc(14px + env(safe-area-inset-bottom,0px))';
    }
    raf = requestAnimationFrame(place);
  }

  function scroller(el) {
    for (var p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      var oy = window.getComputedStyle(p).overflowY;
      if ((oy === 'auto' || oy === 'scroll') && p.scrollHeight > p.clientHeight + 2) return p;
    }
    return document.scrollingElement || document.documentElement;
  }

  //  v1.6:頁面上方固定的導覽列有多高(KOL 頁手機約 100px),框要捲到它下面,不能被蓋住
  function headerBottom() {
    var b = 0;
    try {
      var e = document.elementFromPoint(window.innerWidth / 2, 4);
      for (var p = e; p && p !== document.body; p = p.parentElement) {
        var ps = window.getComputedStyle(p).position;
        if (ps === 'fixed' || ps === 'sticky') { b = p.getBoundingClientRect().bottom; break; }
      }
    } catch (x) {}
    return (b > 0 && b < window.innerHeight * 0.4) ? b : 0;
  }

  function show() {
    var st = cur.steps[cur.i];
    var el = findTarget(st);
    cur.el = el; cur.adj = 0; cur.t0 = Date.now(); cur.still = 0; cur.lastTop = null;
    //  v1.2:手機卡片很高 → 首頁的框捲到畫面上方(卡片在下面);產生器視窗裡維持置中
    var top = el && isMobile() && !(el.closest && el.closest('#adMakerModal'));
    if (top) { document.body.style.paddingBottom = '70vh'; el.style.scrollMarginTop = (headerBottom() + 16) + 'px'; }
    //  v1.8:不用 smooth(KOL 頁的平滑捲動會被打斷,停在半路)
    if (el) { try { el.scrollIntoView({ block: top ? 'start' : 'center' }); } catch (e) { el.scrollIntoView(); } }
    var c = ui.card;
    c.querySelector('.bt-n').textContent = U().step(cur.i + 1, cur.steps.length);
    c.querySelector('.bt-t').textContent = st.title;
    c.querySelector('.bt-b').innerHTML = st.body;
    c.querySelector('.bt-prev').style.visibility = cur.i > 0 ? 'visible' : 'hidden';
    c.querySelector('.bt-next').textContent = cur.i === cur.steps.length - 1 ? U().done : U().next;
  }

  //  往前 / 往後;看不到的步驟自動跳過(手機、電腦版面不同時不會卡住)
  function go(dir) {
    if (!cur) return;
    var i = cur.i + dir;
    while (i >= 0 && i < cur.steps.length && !findTarget(cur.steps[i]) && !cur.steps[i].always) i += dir;
    if (i >= cur.steps.length) { stop(true); return; }
    if (i < 0) return;
    cur.i = i; show();
  }

  function start(name, force) {
    var steps = TOURS[name];
    if (typeof steps === 'function') steps = steps();      // v2.0:開始時才依語言產生文字
    if (!steps || !steps.length) return false;
    if (!force && lsGet(doneKey(name))) return false;
    if (cur) stop(false);
    //  只留「這個螢幕上看得到」或 always 的步驟,算出正確的「共 Y 步」
    var live = steps.filter(function (s) { return s.always || findTarget(s); });
    if (!live.length) return false;
    build();
    cur = { name: name, steps: live, i: 0, el: null };
    ui.ring.style.display = 'block'; ui.card.style.display = 'block';
    show();
    cancelAnimationFrame(raf); raf = requestAnimationFrame(place);
    return true;
  }

  function stop(markDone) {
    if (cur && markDone) lsSet(doneKey(cur.name), '1');
    cur = null;
    document.body.style.paddingBottom = '';
    cancelAnimationFrame(raf);
    if (ui) { ui.ring.style.display = 'none'; ui.card.style.display = 'none'; }
  }
  document.addEventListener('keydown', function (e) { if (cur && e.key === 'Escape') stop(true); });

  function register(name, steps) { TOURS[name] = steps; }

  // ── 品牌投放實驗室(首頁)────────────────────────────────────
  register('lab', function () { return [
    { m: '#btmBrands', d: '#brandTree',
      title: T('先選品牌', 'まずブランドを選ぶ', 'Pick your brand'),
      body: T('這裡是你的<b>品牌</b>。點一下要做廣告的那個品牌,下面就會出現它的系列和商品。',
              'ここが<b>ブランド</b>一覧です。広告を作るブランドをタップすると、下にシリーズと商品が出てきます。',
              'These are your <b>brands</b>. Tap the one you want to advertise and its series and products appear below.') },
    { t: '#brandTree',
      title: T('再選系列和商品', 'シリーズと商品を選ぶ', 'Pick a series and product'),
      body: T('點<b>系列</b>,再點<b>要推的那個商品</b>。<br>選好的會打勾,最上面那行會顯示你選到哪裡。',
              '<b>シリーズ</b>→<b>宣伝する商品</b>の順にタップ。選ぶとチェックが付きます。',
              'Tap a <b>series</b>, then the <b>product</b> to promote. It gets a check mark.') +
        PIT('選錯商品,AI 會照錯的商品資料寫字,一定要確認打勾的是這次要推的。',
            '商品を間違えると、AI が別の商品について書きます。必ず確認を。',
            'Wrong product = the AI writes about the wrong one. Double-check.') },
    { t: '#selAud',
      title: T('這次要給誰看?', '誰に見せる?', 'Who is it for?'),
      body: T('選<b>目標受眾</b>,AI 會照這群人的口味寫字、選畫面。',
              '<b>ターゲット</b>を選ぶと、AI がその人たちに合わせて文章と画面を決めます。',
              'Choose a <b>target audience</b>; the AI writes and picks visuals for them.') +
        TIP('沒有剛好的,選最接近的就好,不用想太久。',
            'ぴったりのものがなければ、一番近いものでOKです。',
            'No exact match? The closest one is fine.') },
    { t: '#adBtn',
      title: T('按「做廣告圖」', '「広告画像を作る」を押す', 'Tap "Make an ad image"'),
      body: T('商品選好就按這顆。<br>如果還沒選照片,畫面會帶你到素材庫,<b>點一張照片就會自動打開廣告圖產生器</b>。',
              '商品を選んだらこのボタン。<br>写真をまだ選んでいなければ素材ライブラリに移動します。<b>写真を1枚タップすると広告画像ジェネレーターが自動で開きます</b>。',
              'Tap this once your product is chosen.<br>If no photo is picked yet you\'ll be taken to the asset library — <b>tap a photo and the ad image generator opens automatically</b>.') },
    { t: ['.right .drive-cfg', '.right'],
      title: T('素材庫:你的照片都在這', '素材ライブラリ:写真はここ', 'Asset library: your photos'),
      body: T('這裡是這個品牌的<b>商品照、場景照</b>。<br>做廣告圖前先<b>點一張</b>;要加新照片,按上面的「+ 商品照」。',
              'このブランドの<b>商品・シーン写真</b>です。広告を作る前に<b>1枚タップ</b>。追加は「＋ 商品写真」から。',
              'This brand\'s <b>product and scene photos</b>. <b>Tap one</b> first; add more with "+ Product photo".') +
        PIT('LOGO 請放「+ LOGO」,不要放成商品照,不然會被當成照片拿去拍。',
            'ロゴは「＋ LOGO」へ。商品写真にすると撮影に使われます。',
            'Put logos under "+ LOGO", not product photos, or they get shot as photos.') },
    { t: '#genBtn',
      title: T('只要文案也可以', 'コピーだけでもOK', 'Just need copy?'),
      body: T('不做圖、只要廣告文案,按<b>「生成文案」</b>。<br>長度、語言(中文 / 日本語 / English)在上面選。',
              '画像なしで広告コピーだけ欲しいときは<b>「コピーを生成」</b>。<br>長さと言語(中文 / 日本語 / English)は上で選べます。',
              'Want ad copy without an image? Tap <b>"Generate copy"</b>.<br>Length and language (中文 / 日本語 / English) are set above.') }
  ]; });

  // ── 廣告圖產生器(第一次打開時)──────────────────────────────
  register('admaker', function () { return [
    { t: '#amPhotoThumbRow',
      title: T('確認用哪張照片', '使う写真を確認', 'Check your photo'),
      body: T('有<b>金色框</b>的就是這次要用的照片,想換就點別張。',
              '<b>金色の枠</b>が付いた写真が今回使う写真です。変えたいときは別の写真をタップ。',
              'The photo with the <b>gold frame</b> is the one being used. Tap another to switch.') +
        TIP('選主角最清楚、最大的那張。', '主役が一番はっきり大きく写っている写真を選びましょう。', 'Choose the shot where the subject is clearest and largest.') },
    { t: '#prodTypeSel',
      title: T('⓪ 我要拍的是什麼?', '⓪ 何を撮る?', '⓪ What are you shooting?'),
      body: T('先選你的<b>行業</b>(商品、服飾、汽車、飯店婚宴…)。',
              'まず<b>業種</b>を選びます(商品・アパレル・自動車・ホテル/ウェディング…)。',
              'First pick your <b>industry</b> (products, fashion, cars, hotels & weddings…).') +
        PIT('飯店、婚宴、汽車、美業這類<b>服務</b>,不要選「商品」!選商品,AI 會把它當成擺在桌上的東西拍。',
            'ホテル・ウェディング・自動車・美容などの<b>サービス業</b>は「商品」を選ばないで!テーブルに置いた物として撮られます。',
            'Hotels, weddings, cars, beauty are <b>services</b> — don\'t pick "Products", or it\'s shot like an object on a table.') },
    { t: ['#layoutSel', '#layoutLock'],
      title: T('① 排版:要什麼畫面', '① レイアウト:どんな画面?', '① Layout: what scene?'),
      body: T('選一種<b>畫面</b>,例如客房實景、新人入場、估價檢車。<br>選完 ⓪ 這格才會出現。',
              '<b>画面</b>を1つ選びます(客室、入場シーン、査定など)。⓪ の後に表示。',
              'Choose a <b>scene</b>, e.g. guest room, couple\'s entrance, car inspection.<br>This appears after you pick ⓪.') +
        PIT('畫面要跟你選的照片對得上:客房照就選客房類,不要選婚宴場地。',
            '写真に合う画面を。客室の写真なら客室系を。',
            'Match the scene to your photo: a guest-room photo needs a room layout, not a banquet hall.') },
    { t: ['#flavorSel', '#flavorLock'],
      title: T('② 設計風格', '② デザインスタイル', '② Design style'),
      body: T('想要什麼<b>感覺</b>,選一個就好。', 'どんな<b>雰囲気</b>にしたいか、1つ選ぶだけ。', 'Pick the <b>mood</b> you want — just one.') +
        TIP('不想指定就選「無」,交給 AI 美術指導判斷。', '指定しないなら「なし」を選んで、AI アートディレクターに任せましょう。', 'No preference? Choose "None" and let the AI art director decide.') },
    { t: ['#contextSel', '#contextLock'],
      title: T('③ 情境', '③ シーン設定', '③ Occasion'),
      body: T('有檔期(中秋、聖誕、週年慶…)就選。', 'キャンペーン(中秋節、クリスマス、周年祭…)があれば選びます。', 'Running a campaign (Mid-Autumn, Christmas, anniversary sale…)? Pick it.') +
        PIT('沒有檔期就選「無」,亂選節日,圖上會多出不相干的節慶裝飾。',
            'キャンペーンがなければ「なし」。適当に行事を選ぶと、関係ない飾りが入ってしまいます。',
            'No campaign? Choose "None" — a random holiday adds unrelated decorations.') },
    { t: '#gptHeadline',
      title: T('④ 圖上要寫的字', '④ 画像に入れる文字', '④ Text on the image'),
      body: T('打一句<b>主標</b>,系統會用真字型壓上去,不會歪。<br><b>留空</b> = 給你一張乾淨沒字的圖,自己上字。',
              '<b>メインコピー</b>を1行。本物のフォントで載せるので崩れません。<br><b>空欄</b>なら文字なしのきれいな画像になります。',
              'Type one <b>headline</b>; it\'s set in a real font, so no warped letters.<br><b>Leave blank</b> for a clean image without text.') +
        TIP('主標越短越好看,太長字會被縮小。', 'コピーは短いほどきれい。長いと文字が小さくなります。', 'Shorter headlines look better; long ones get shrunk.') },
    { t: '#gptAdSize',
      title: T('⑤ 尺寸', '⑤ サイズ', '⑤ Size'),
      body: T('投廣告用<b>正方形</b>就好;IG 直式、限動、FB 橫式也都有。',
              '広告なら<b>正方形</b>でOK。Instagram 縦長・ストーリーズ・Facebook 横長もあります。',
              'For ads, <b>square</b> is fine; Instagram portrait, Stories and Facebook landscape are also available.') +
        PIT('尺寸越大,扣的點數越多。', 'サイズが大きいほど消費ポイントが増えます。', 'Bigger sizes cost more points.') },
    { t: '#prApplyBtn',
      title: T('最後:按這顆開始生成', '最後:このボタンで生成', 'Last step: tap to generate'),
      body: T('按鈕上<b>直接寫著要扣幾點</b>,約 2 分鐘出圖。<br>出圖後才會出現「下載廣告圖」。',
              'ボタンに<b>消費ポイント</b>が出ています。約2分で完成し、「ダウンロード」が表示されます。',
              'The button <b>shows the points used</b>. About 2 minutes, then "Download" appears.') +
        PIT('一按就扣點,按之前先往上看一遍 ⓪~⑤ 都選對了。',
            '押すとすぐポイント消費。⓪〜⑤ を先に確認。',
            'Points are used on tap — recheck ⓪–⑤ first.') }
  ]; });

  // ── 什麼時候自動跑 ────────────────────────────────────────
  function modalOpen() { var m = document.getElementById('adMakerModal'); return !!(m && m.style.display !== 'none' && visible(m)); }
  var labTried = false;
  setInterval(function () {
    if (!document.getElementById('adBtn')) return;          // 只在品牌投放實驗室
    var pill = document.getElementById('bt-tour-pill');
    if (!pill) {
      css();
      pill = document.createElement('button'); pill.id = 'bt-tour-pill'; pill.className = 'bt-pill'; pill.type = 'button';
      pill.setAttribute('data-i18n-skip', '');
      pill.textContent = U().pill;
      pill.onclick = function () { lsSet(doneKey('admaker'), null); start('lab', true); };
      document.body.appendChild(pill);
    }
    var open = modalOpen();
    pill.style.display = open ? 'none' : '';
    if (cur) return;
    if (open) { start('admaker', false); return; }
    //  首頁第一次:等品牌清單畫好再跑(只試一次)
    var tree = document.getElementById('brandTree');
    if (!labTried && tree && tree.children.length && window.BRANDS && window.BRANDS.length) {
      labTried = true;
      setTimeout(function () { if (!cur && !modalOpen()) start('lab', false); }, 1200);
    }
  }, 700);

  window.BosTour = { version: VERSION, register: register, start: start, stop: stop, T: T, TIP: TIP, PIT: PIT, ui: U, lang: lang, reset: function (n) { lsSet(doneKey(n || 'lab'), null); lsSet(doneKey('admaker'), null); } };
  console.log('[BosTour] 🧭 v' + VERSION + ' 新手導覽就緒(重看:左下「教學」;BosTour.reset() 清除看過紀錄)');
})();
