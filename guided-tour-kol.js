// ═══════════════════════════════════════════════════════════════
//  🧭 guided-tour-kol.js v2.0(2026-11-15)KOL 數字人工作室 新手導覽
//  需要先載入 guided-tour.js v2.0+(提供 BosTour:黃框 + 白卡 + 紅字建議/注意 + 中/日/英)
//
//  三段導覽:
//   · kol1   剛進來:品牌 → 形象庫(已經選好 KOL 時,連人設、參考照、拍片鈕一起教)
//   · kol1b  點了某位 KOL 之後:人設 → 多角度參考照 → 用這位角色拍片
//   · kol2   拍電影鏡頭(STEP 2):主角 → 風格 → AI 分鏡 → 商品照 → 呈現方式 → 場景 → 規格 → 生成
//  文字跟著網站語言(中文 / 日本語 / English)。第一次自動跑一次;左下角按鈕可以重看。
//  只放導覽,不碰 kol.html 任何功能(kol.html 已超過 1,500 行,不往裡面塞)。
// ═══════════════════════════════════════════════════════════════
(function () {
  'use strict';
  if (window.__bosTourKol) return;
  window.__bosTourKol = true;
  var VERSION = '2.0';

  function shown(id) {
    var e = document.getElementById(id); if (!e) return false;
    var r = e.getBoundingClientRect();
    if (!(r.width > 4 && r.height > 4 && window.getComputedStyle(e).display !== 'none')) return false;
    //  底部那條平常滑在畫面外藏著,露出來才算
    if (window.getComputedStyle(e).position === 'fixed' && (r.top >= window.innerHeight - 1 || r.bottom <= 1)) return false;
    return true;
  }
  function ready() { return !!(window.BosTour && window.BosTour.register && window.BosTour.T); }

  function registerAll() {
    var T = BosTour.T, TIP = BosTour.TIP, PIT = BosTour.PIT;

    function picked() { return [
      { t: ['#rs-persona-panel', '#rs-ab-edit'],
        title: T('人設:決定他怎麼講話', 'キャラ設定:話し方が決まる', 'Persona: how they talk'),
        body: T('年紀、住哪、做什麼工作、在意什麼。<br>AI 寫台詞時會照這個人設說話。',
                '年齢、住まい、仕事、大切にしていること。<br>AI はこの設定どおりにセリフを書きます。',
                'Age, where they live, their job, what they care about.<br>The AI writes lines in this persona\'s voice.') +
          TIP('人設寫得越具體,台詞越像真人,不像在念廣告。要改按「編輯人設」。',
              '設定が具体的なほど、広告っぽくない自然なセリフになります。変更は「キャラ設定を編集」から。',
              'The more specific the persona, the more natural the lines sound. Change it with "Edit persona".') },
      { t: '#look-picker',
        title: T('多角度參考照', 'マルチアングル参考写真', 'Multi-angle reference photos'),
        body: T('正臉、側臉這幾張是<b>拍影片時自動用的參考照</b>,讓每一個鏡頭都是同一張臉。',
                '正面・横顔などの写真は<b>撮影時に自動で使う参考写真</b>です。どのカットでも同じ顔になります。',
                'Front and side shots are <b>used automatically when filming</b>, so every shot has the same face.') +
          TIP('系統會自己挑,不用動它。', 'システムが自動で選ぶので、触らなくてOKです。', 'The system picks them for you — no need to touch.') },
      { t: '#rs-actionbar',
        title: T('選好就按「用這位角色拍片 →」', '決まったら「このキャラで撮影 →」', 'Then tap "Shoot with this character →"'),
        body: T('按右邊那顆,就會進到 <b>STEP 2 拍電影鏡頭</b>。',
                '右のボタンで <b>STEP 2 シネマ撮影</b>に進みます。',
                'The button on the right takes you to <b>STEP 2: cinematic shoot</b>.') }
    ]; }

    // ── STEP 1:建立 KOL 角色 ──────────────────────────────────
    BosTour.register('kol1', function () { return [
      { t: '#brand-switcher',
        title: T('先選品牌', 'まずブランドを選ぶ', 'Pick your brand'),
        body: T('這裡選<b>要拍哪個品牌</b>,下面會自動載入這個品牌的 KOL 和素材。',
                'ここで<b>撮影するブランド</b>を選ぶと、そのブランドの KOL と素材が読み込まれます。',
                'Choose <b>which brand you\'re shooting for</b>; its KOLs and assets load below.') +
          PIT('選錯品牌,角色和商品照都會是別家的。', 'ブランドを間違えると、キャラも商品写真も別ブランドのものになります。', 'Pick the wrong brand and you get another brand\'s characters and product photos.') },
      { t: '#rs-roster',
        title: T('選一位 KOL 當主角', 'KOL を1人選ぶ', 'Pick a KOL as the lead'),
        body: T('這是品牌的 <b>KOL 形象庫</b>,點一位就選好了,選好會繼續教你下一步。<br>沒有合適的人選,按<b>「＋ 建新角色」</b>讓 AI 做一位新面孔。',
                'ブランドの <b>KOL キャラライブラリ</b>です。1人タップすれば選択完了、続けて次の手順をご案内します。<br>合う人がいなければ<b>「＋ 新しいキャラを作成」</b>で AI が新しい顔を作ります。',
                'This is the brand\'s <b>KOL library</b>. Tap one to select — the guide continues from there.<br>No one fits? Tap <b>"+ New character"</b> and the AI creates a new face.') +
          TIP('「＋ 使用自己建立」是用你自己的照片,當品牌代言人最有說服力。',
              '「＋ 自分の写真で作成」はあなた自身の写真を使います。ブランドの顔として一番説得力があります。',
              '"+ Use my own" builds from your own photo — the most convincing brand ambassador.') }
    ].concat(picked()); });

    // ── 點了某位 KOL 之後 ───────────────────────────────────────
    BosTour.register('kol1b', picked);

    // ── STEP 2:拍電影鏡頭 ─────────────────────────────────────
    BosTour.register('kol2', function () { return [
      { t: '#kol-list-cine',
        title: T('主角', '主役', 'Lead character'),
        body: T('這支影片的<b>主角</b>,第一個選的就是他。', 'この動画の<b>主役</b>です。最初に選んだ人が主役になります。', 'The <b>lead</b> of this video — whoever you picked first.') },
      { t: '#kolmode',
        title: T('影片風格', '動画スタイル', 'Video style'),
        body: T('<b>寫實真人</b>:跟真的拍的一樣。<br><b>動畫</b>:選了才會展開動畫風格。',
                '<b>リアル</b>:実写そのもの。<br><b>アニメ</b>:選ぶとアニメのスタイルが開きます。',
                '<b>Realistic</b>: looks like real footage.<br><b>Animation</b>: opens the animation styles.') +
          TIP('第一次拍,先用「寫實真人」。', '初めての撮影は「リアル」がおすすめです。', 'First time? Start with "Realistic".') },
      { t: '#cine-sbp-entry',
        title: T('第一步:用 AI 分鏡寫腳本', 'まず AI 絵コンテで台本を作る', 'First: write the script with AI storyboard'),
        body: T('把想講的內容丟進去,AI 會寫成<b>有台詞、時間對得上</b>的腳本,也可以自己在分鏡卡上改。',
                '伝えたい内容を入れると、AI が<b>セリフ付きで尺の合った</b>台本にします。絵コンテカードで自分で直すこともできます。',
                'Drop in what you want to say; the AI turns it into a script <b>with lines that fit the timing</b>. You can edit the storyboard cards yourself.') +
          PIT('自己硬塞很長的台詞,影片時間不夠會被切掉。用 AI 分鏡,系統會自動鎖好時長。',
              '長いセリフを無理に入れると、時間が足りず途中で切れます。AI 絵コンテなら尺を自動で合わせます。',
              'Cram in long lines yourself and they get cut off. The AI storyboard locks the timing for you.') +
          TIP('有字唸錯(例如「抽屜」),換個說法或用別的詞就好。',
              '読み間違える言葉があれば、言い方や単語を変えれば直ります。',
              'If a word is mispronounced, just rephrase or use a different word.') },
      { t: ['#ref-panel-drive', '#ref-tab-drive'],
        title: T('選商品照', '商品写真を選ぶ', 'Pick product photos'),
        body: T('從素材庫點<b>這支要推的商品照</b>。', '素材ライブラリから<b>今回宣伝する商品の写真</b>をタップ。', 'Tap the <b>photos of the product you\'re promoting</b> from the library.') +
          TIP('外包裝和內容物都放,AI 才知道打開長什麼樣子。', 'パッケージと中身の両方を入れると、開けた時の見た目も AI が分かります。', 'Add both the package and what\'s inside so the AI knows how it looks opened.') +
          PIT('商品尺寸要在後台填對,填錯 AI 就會把商品畫太大或太小。', '商品サイズは管理画面で正しく入力を。間違えると大きすぎ・小さすぎに描かれます。', 'Enter the correct product size in admin, or the AI draws it too big or too small.') },
      { t: '#product-mode-s2',
        title: T('商品呈現方式', '商品の見せ方', 'How the product appears'),
        body: T('告訴 AI 你賣的是<b>「東西」還是「體驗」</b>:手拿小物、包裝零食、盛盤料理、穿戴…',
                '売っているのが<b>「モノ」か「体験」か</b>を AI に伝えます:手に持つ小物、袋菓子、盛り付け料理、身につける物…',
                'Tell the AI whether you sell <b>a "thing" or an "experience"</b>: handheld items, packaged snacks, plated food, wearables…') +
          PIT('選錯,拿法和擺法就會錯(例如把衣服拿在手上晃)。不確定就選「自動」。',
              '間違えると持ち方・置き方がおかしくなります(服を手に持って振る等)。迷ったら「自動」。',
              'Pick wrong and it\'s held or placed oddly (like waving clothes around). Unsure? Choose "Auto".') },
      { t: ['#scene-grid-cine', '#scn-lib-s2'],
        title: T('場景:在哪裡拍', 'シーン:どこで撮る?', 'Scene: where to shoot'),
        body: T('點一個<b>場景</b>,例如客廳、門市、教室。', '<b>シーン</b>を1つ選びます(リビング、店舗、教室など)。', 'Pick a <b>scene</b>, e.g. living room, shop, classroom.') +
          TIP('上傳自己門市、店面的實景照當場景,影片會直接用真的背景,最有說服力。',
              '自分のお店の実景写真をアップすると、本物の背景で撮影でき、一番説得力があります。',
              'Upload real photos of your own shop and the video uses your actual space — most convincing.') },
      { t: '#cine-lock-zone',
        title: T('解析度、秒數、比例', '解像度・秒数・比率', 'Resolution, length, ratio'),
        body: T('IG / 抖音用 <b>9:16</b>;YouTube 用 16:9。', 'Instagram / TikTok は <b>9:16</b>、YouTube は 16:9。', 'Instagram / TikTok: <b>9:16</b>; YouTube: 16:9.') +
          PIT('「生成聲音」關掉,影片完全沒聲音,連台詞都不會唸!', '「音声を生成」をオフにすると、無音になりセリフも読まれません!', 'Turn off "Generate audio" and the video is silent — not even the lines are spoken!') +
          PIT('解析度越高、秒數越長,等越久、扣的點數也越多。', '解像度が高く秒数が長いほど、時間もポイントも多くかかります。', 'Higher resolution and longer clips take longer and cost more points.') },
      { t: '#create-seedance-btn',
        title: T('最後:按這顆開始拍', '最後:このボタンで撮影開始', 'Last step: tap to shoot'),
        body: T('大約 <b>5–10 分鐘</b>出片,可以先去做別的事。', '完成まで約 <b>5〜10 分</b>。その間ほかの作業をしていて大丈夫です。', 'Takes about <b>5–10 minutes</b> — feel free to do something else.') +
          PIT('一按就扣點,按之前先往上看一遍:主角、商品照、場景、聲音都對了。',
              '押した時点でポイントが消費されます。主役・商品写真・シーン・音声をもう一度確認してから。',
              'Points are used the moment you tap. Check the lead, product photos, scene and audio first.') }
    ]; });
  }

  // ── 左下角「? 教學」──────────────────────────────────────────
  function pill() {
    var p = document.getElementById('bt-tour-pill-kol');
    if (!p) {
      p = document.createElement('button');
      p.id = 'bt-tour-pill-kol'; p.type = 'button'; p.setAttribute('data-i18n-skip', '');
      p.textContent = BosTour.ui().pill;
      p.style.cssText = 'position:fixed;z-index:99997;left:calc(12px + env(safe-area-inset-left,0px));' +
        'border:1px solid rgba(255,255,255,.18);background:rgba(20,20,24,.85);color:#f5c542;' +
        'font:800 13px/1 "Noto Sans TC",system-ui,sans-serif;border-radius:999px;padding:9px 13px;cursor:pointer';
      p.onclick = function () { BosTour.start(shown('main-layout-cinematic') ? 'kol2' : (shown('rs-actionbar') ? 'kol1b' : 'kol1'), true); };
      document.body.appendChild(p);
    }
    //  底下那條「已選定 · 用這位角色拍片」出現時,往上讓開
    var ab = document.getElementById('rs-actionbar');
    var abH = (ab && shown('rs-actionbar')) ? ab.getBoundingClientRect().height : 0;
    p.style.bottom = 'calc(' + (54 + abH) + 'px + env(safe-area-inset-bottom,0px))';
    p.style.display = shown('main-layout-cinematic') || shown('main-layout-talking') ? '' : 'none';
  }

  // ── 什麼時候自動跑 ───────────────────────────────────────────
  var registered = false, tried = {};
  function done(n) { try { return !!localStorage.getItem('bos_tour_done_' + n); } catch (e) { return true; } }
  function setDone(n) { try { localStorage.setItem('bos_tour_done_' + n, '1'); } catch (e) {} }
  function tryStart(name) {
    if (tried[name]) return;
    var c = document.querySelector('.bt-card');
    if (c && c.style.display !== 'none') return;          // 別的導覽還在跑,等它跑完
    tried[name] = true;
    setTimeout(function () { BosTour.start(name, false); }, 1200);
  }
  setInterval(function () {
    if (!ready()) return;
    if (!registered) { registerAll(); registered = true; }
    pill();
    var roster = document.getElementById('rs-roster');
    if (shown('main-layout-cinematic')) tryStart('kol2');
    else if (shown('main-layout-talking') && roster && roster.children.length) {
      //  先跑完整的 kol1;那時已經選好 KOL(人設、拍片鈕都在)就一起教,kol1b 不再重複
      if (!done('kol1')) { if (!tried.kol1 && shown('rs-actionbar')) setDone('kol1b'); tryStart('kol1'); }
      else if (shown('rs-actionbar') && !done('kol1b')) tryStart('kol1b');
    }
  }, 800);

  console.log('[BosTour] 🧭 KOL 導覽 v' + VERSION + ' 就緒');
})();
