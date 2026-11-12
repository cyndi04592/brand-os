// ═══════════════════════════════════════════════════════════════
//  🎬 ad-director.js v1.5(2026-11-12)廣告圖「AI 美術指導」—— 每一張廣告圖都經過美術指導
//  v2.4 RA 11-12「不是事後品管,是送出提示詞前就要想過 —— 眼鏡包被當一般包包、商品照拍很大但其實才裝得下一副眼鏡」
//       → 美術指導先寫【思考】(是什麼 / 實際多大跟人比 / 材質姿態 / 照片拍到哪些面 / 風格世界 / 畫面主意 / 字與 LOGO)再寫【提示詞】
//       → 商品實際大小(product-size.js 存的 realSize)第一次交給美術指導;思考內容存在 _adDirectorLast.think 給後台查
//  v2.5.1 RA 11-12「選真空外包裝絕對是要給顧客看真實收到的樣貌;要內容物會自己選內容物照」→ 寫進第 2 點
//  v2.5 RA 11-12「怕疊加一堆送出好幾萬字」→ 16 條規則(4,100 字、一堆例子)收斂成 9 條原則(約 1,900 字);
//       最終提示詞上限 1,100 字並真的擋:照片超過 1,600 字 / 排版超過 3,000 字 = 失敗重寫(v2.4 實測寫到 1,592 字沒被擋)
//       順便拿掉 v1.7 殘留的「真空包讓人看到煮好的食物」(跟 RA 11-12 決定衝突)
//  v2.4.1 實測 Claude 想完常直接寫英文提示詞、沒寫【提示詞】標記 → 沒標記時,從【思考】後第一段英文開始切
//       + 巧福「怕每張都一樣風格,復古風扇選別的風格也是復古」:第 12 點的商品類型拍法降成「沒選風格時的預設」,有選風格就照風格
//       + 頌缽「書法字好醜,書法字都砍了」:風格寫書法也不用,水墨禪意風格的字一樣用 MOZ 黑體
//       + 米香腸真空包被拍成硬挺地立著:第 2 點加「姿態跟著材質走」—— 軟包平放或斜靠、硬盒瓶罐才站著(所有商品通用,不只食品)
//  v2.3 RA 11-12 眼鏡包「LOGO 有機會跟字撞到」:系統事後疊 LOGO 會挑最乾淨的角,右下優先;
//       細字距的標題邊緣淡、偵測不到,右下又有影子線條 → LOGO 跑去右上壓到標題。第 16 點:右下角固定留給 LOGO
//  v2.2 RA 11-12「煮好的,客人會自己選煮好的照片當參考圖」→ 包裝照不再自己加煮好的成品盤
//  v2.1 RA 11-12「冷凍真空包裝不要改成煮好的食物,客戶需要外包裝,怕亂拆」→ 包裝照原樣封好當主角,煮好的成品只當旁邊的小配角
//  v2.0 RA 11-12 Pinterest(2026 冷凍食品包裝拍攝 / 2026 頌缽 / 2026 復古拍攝 + 電風扇三張日系參考):
//       包裝食品分「好看包裝」與「透明素面包裝」兩種拍法;頌缽三種拍法;復古家電與生活家電拍法;字加直排雜誌式與細手寫線
//  v1.9 RA 11-12 重測鞋「兩隻一樣的鞋並排漂浮很搞笑、字完全沒質感」+ RA Pinterest(ASICS 繩索登山扣吊鞋、CORBY 穿在腳上配長襪 NEW ARRIVAL)
//       → 鞋改成一隻主角＋說故事的道具或動作;第 15 點:字的排法對標國際品牌海報(細、字距拉開、貼齊網格、克制)
//  v1.8 RA 11-12 重測:眼鏡包選了「穿戴・戴在人身上」卻拍成地板靜物 —— 擺放方式從沒交給美術指導(精簡引擎也只讀落地/大型)
//       → 擺放方式交給美術指導;選「穿戴」就一定拍成戴在人身上(第 14 點)
//  v1.7 RA 11-12 抽查 8 張回饋:先看懂商品用途(雲朵水餃包其實是眼鏡包)、對標 Nike/NB/精品/高級食品禮盒的拍法、
//       畫面不准出現客人以外的字(燈籠「香腸」、印章)、背景招牌 LOGO 不照抄、撞色避開國旗配色、手入鏡要自然
//  v1.6 字型:客人選的風格有寫字型就照風格(歐美雜誌 Didot、日系雅致明朝、水墨書法…共 13 種);沒寫才用 MOZ 黑體
//  v1.5 全選項清查(類型×版型 91 組、風格 91 × 情境 28):
//   · 主角照草稿認定(商品 / 模特兒 / 美業作品 / 專業人士 / 螢幕),人臉、作品、螢幕內容的保護句也一字不改
//   · 品牌包寫死的字型一律換 MOZ 黑體(風格字型的規則見 v1.6)
//  RA:「規則擋不完 —— 鞋子很輕想拍太空無重力、雪紡要飄、泳圈要浮。
//       要跟 KOL 數字人 AI 分鏡一樣:先吸收再轉換,轉出來的提示詞簡短有力很明確。」
//
//  流程(客人按「生成廣告圖」):
//   ① 照舊由精簡引擎(photoroom-proxy /adlean.js)抽一份「草稿」(拍法 / 光 / 地點 / 保護句)
//   ② 把【商品照】+ 商品名 / 規格 / 特色 + 客人選的類型 / 版型 / 風格 / 情境 / 補充說明 / 標題 + 草稿
//      一起交給 Claude(photoroom-proxy 既有的 claude_generate,不用改 Worker)
//   ③ Claude 看懂商品後決定這張怎麼拍,改寫成 5~7 句、每句一件事的最終提示詞
//   ④ 生圖用最終提示詞;第一次失敗 / 逾時 → 自動再試一次;兩次都失敗才用草稿,並在畫面上說明
//
//  判斷全部交給美術指導,不寫死關鍵字規則:
//   · 主角永遠是商品 / 模特兒;畫面裡多的東西都要替它加分
//   · 東西照重力擺好 —— 除非商品本身會飛 / 會浮 / 會飄,或客人自己要(例如「太空無重力」)→ 那就整張做到位
//   · 跟商品無關的飄浮道具不加
//   · 標題原字照抄;草稿裡「商品長相照原圖」「畫面上的字」兩句保護句一字不改
//
//  v1.4 RA 11-12「全部都要美術指導,根治」:
//   · 照片類(精簡引擎)與排版圖(前後對比 / 多格 / 清單,舊引擎)都改寫;排版圖保留格數、前後、條列與所有字
//   · 等待 40 秒 + 自動重試一次(v1.3 只等 25 秒,大照片會逾時、默默用草稿)
//   · 每次生成都重新抓「當下的」提示詞函式(v1.3 安裝時鎖定:精簡引擎晚載入就會繞過美術指導)
//  保險絲:Console 輸入 window.AD_DIRECTOR = false → 立刻停用,回到原本流程
//  掛載:loader.js 只在首頁載入;包住 window.generateGptPoster 與 window.buildPosterPrompt
//  對外:window._adDirectorLast = { draft, final, ms, used }(後台生成紀錄 / 除錯用)
// ═══════════════════════════════════════════════════════════════
(function () {
  'use strict';
  if (window.AdDirector) return;
  var VERSION = '2.5.1';
  var WORKER = 'https://photoroom-proxy.calm-sunset-6b66.workers.dev';
  var TIMEOUT_MS = 55000;    // 單次等待(排版圖 60 秒);失敗會再試一次
  //  v1.3 舊引擎(前後對比 / 多格 / 清單排版圖)的提示詞有「=== 區塊標題 ===」→ 看標記判斷,不看長度
  //   (v1.0 用 2600 字當界線,新引擎草稿常常 2610~2640 字 → 被誤判跳過,RA 11-11 實測抓到)
  var OLD_ENGINE = /^===\s*[A-Z][A-Z &]+===/m;
  var MAX_DRAFT = 30000;    // 只防異常(舊引擎排版圖草稿約 9,000~11,000 字)
  var pending = null;       // 這一次生成要用的最終提示詞(只用一次)

  function val(id) { var el = document.getElementById(id); return (el && el.value || '').trim(); }
  function label(map, key) { try { return (key && map && map[key] && map[key].label) || ''; } catch (e) { return ''; } }

  //  商品照縮成 640px JPEG(base64)給 Claude 看 —— 雲端硬碟網址 Claude 讀不到,一律自己帶圖
  function photoBase64() {
    return new Promise(function (resolve) {
      try {
        var S = window.S || {}, p = (S.selPhoto !== null && S.selPhoto !== undefined) ? S.photos[S.selPhoto] : null;
        var src = p && (p.canvasRes || p.full || p.hiRes || p.src || p.thumb);
        if (!src || typeof window.urlToBlob !== 'function') return resolve(null);
        window.urlToBlob(src).then(function (blob) { return createImageBitmap(blob); }).then(function (bmp) {
          var k = Math.min(1, 640 / Math.max(bmp.width, bmp.height));
          var c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
          c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
          resolve(c.toDataURL('image/jpeg', 0.82).split(',')[1]);
        }).catch(function () { resolve(null); });
      } catch (e) { resolve(null); }
    });
  }

  function brief(draft, hasPhoto, layout) {
    var bc = {};
    try { bc = (typeof getBrandContext === 'function') ? (getBrandContext() || {}) : {}; } catch (e) {}
    var pt = '';
    try { var o = (typeof PRODTYPE_OPTIONS !== 'undefined' ? PRODTYPE_OPTIONS : []).find(function (x) { return x.value === (typeof SELECTED_PRODTYPE !== 'undefined' ? SELECTED_PRODTYPE : ''); }); pt = (o && o.label.split(' — ')[0]) || ''; } catch (e) {}
    var lines = [
      '品牌:' + (bc.brand || '') + (bc.subBrand ? ' / ' + bc.subBrand : ''),
      '商品:' + (bc.product || '(未命名)'),
      prodTag() ? '商品標籤:' + prodTag() : '',
      realSize() ? '商品實際大小(客人量的):' + realSize() : '商品實際大小:(客人沒填,從照片與規格判斷)',
      bc.adStyle ? '品牌調性:' + bc.adStyle : '',
      placeLabel() ? '客人選的擺放方式:' + placeLabel() : '',
      bc.spec ? '規格:' + bc.spec : '',
      bc.feature ? '特色:' + bc.feature : '',
      '客人選的類型:' + (pt || '(沒選)'),
      '版型:' + (safeLabel('LAYOUT_TEMPLATES', 'SELECTED_LAYOUT') || '(沒選)'),
      '風格:' + (safeLabel('REGIONAL_FLAVORS', 'SELECTED_FLAVOR') || '(沒選)'),
      '風格指定的字型:' + (styleType() || '(沒寫,用 MOZ 黑體)'),
      '情境:' + (safeLabel('CONTEXT_THEMES', 'SELECTED_CONTEXT') || '(沒選)'),
      '客人補充說明:' + (val('gptStyleDesc') || '(沒有)'),
      '標題:' + (val('gptHeadline') || '(沒有)') + (val('gptSubHeadline') ? ' / 副標:' + val('gptSubHeadline') : '')
    ].filter(Boolean).join('\n');
    return [
      hasPhoto
        ? '你是頂尖商業攝影的美術指導。附圖是客人的真實商品照。先看懂這個商品:它是什麼、多大、怎麼用、材質輕重、賣點在哪;再讀客人的選擇與補充說明;最後讀系統抽給你的拍攝草稿。'
        : '你是頂尖商業攝影的美術指導。這次沒有附圖,商品照會直接交給生圖模型;請從商品名稱、規格、特色判斷它是什麼、多大、怎麼用、材質輕重、賣點在哪;再讀客人的選擇與補充說明;最後讀系統抽給你的拍攝草稿。',
      '',
      '【商品與客人的選擇】',
      lines,
      '',
      '【系統草稿】(英文,是生圖模型要讀的提示詞)',
      draft,
      '',
      '【你的工作】把草稿改寫成最終提示詞。原則只有這九條,其餘交給你的專業判斷:',
      '1. 看懂商品:它是什麼、怎麼用(看照片判斷,商品名常是行銷暱稱)、實際多大(照【商品實際大小】;照片是近拍不代表它大)。提示詞第一句寫清楚它是什麼、真實尺寸,並給一個比例參照(手、身體、家具)。',
      '2. 照片為準:商品只用照片拍到的面與角度;形狀、顏色、包裝、標籤、LOGO 照原樣,包裝封好。客人選的照片就是要拍的東西:選了包裝照 = 要讓顧客看到收到時的真實樣子,拍包裝本身;選了內容物或料理照,才拍食物。軟的東西(真空包、布、皮件)平放或斜靠、有皺摺與重量,硬的東西才站著。萬物照重力擺好、有影子;商品本身會飛會飄、或客人補充說明要了(例如無重力)才漂浮,而且整張做到位。',
      '3. 主角照草稿認定(商品 / 模特兒 / 作品 / 專業人士 / 螢幕)。擺放方式是「穿戴」→ 戴在人身上,鏡頭裁在身體局部、臉在畫面外,衣服是素面基本款、與商品同色系。手入鏡時從邊緣自然伸進來、手腕完整。多出來的東西都要替主角加分,無關的道具與特效拿掉。',
      '4. 客人的選擇優先:補充說明 > 擺放方式 > 風格與情境 > 草稿。選了風格,場景、年代、色調、道具照風格走;沒選風格,才自己挑國際品牌廣告(Nike、精品配件、高級食品禮盒)等級的拍法。節慶檔期只用配色、材質、光來表現。',
      '5. 草稿裡的保護句一字不改照抄:主體保持照片原樣(商品、人臉、作品、螢幕內容);其他衣物與物品是無品牌基本款;畫面上的字(引號裡的字原樣保留)。',
      '6. 拍法:真的攝影師重拍一張。一個具體的畫面主意放最前面;光寫成物理過程(從哪來、照到哪、影子落哪、牆與地反射補光),主體吃場景的光;構圖稍偏、留一塊乾淨的地方給字;生活痕跡最多 3 件。8K、超清、cinematic lighting、golden hour 這類堆疊詞拿掉。',
      '7. 字:畫面上只有客人給的標題;背景的招牌、燈籠、道具都是素面,LOGO 只在商品原本印的位置。字型:【風格指定的字型】有寫就用,沒寫就用乾淨的無襯線黑體(Inter / 思源黑體);書法、毛筆字一律換成印刷字體。排法像國際品牌海報:字級克制、細字重、字距拉開、貼齊網格,可以直排;純色,沒有框、陰影、描邊。',
      '8. 右下角約寬三分之一、高六分之一,留一塊平整乾淨的背景給系統疊品牌 LOGO,主體與標題都避開這裡。',
      layout
        ? '9. 這是一張「排版圖」(' + (safeLabel('LAYOUT_TEMPLATES', 'SELECTED_LAYOUT') || '多格 / 前後對比 / 清單') + '):草稿的版面結構完整保留(畫布、格數、每格放什麼、前後左右、條列順序、字的位置),每格照片照第 6 點拍。禁止清單改寫成正面描述,重複合併。輸出英文,版面一段、每格一句,肯定句,總長 2,400 字元以內(很重要:越長生圖模型越抓不到重點)。'
        : '9. 輸出英文,5 到 7 句,每句只講一件事,肯定句,總長 1,100 字元以內(很重要:越長生圖模型越抓不到重點;寫不下就刪最不重要的細節,保護句一定留)。',
      '',
      '開拍前先想清楚,再寫提示詞。回覆固定兩段:',
      '【思考】(中文,每項一句,像攝影師開拍前跟自己確認)',
      '1. 這是什麼、怎麼用(看照片判斷,不被商品名騙)',
      '2. 實際多大、跟人的身體比是多大;畫面裡用什麼讓人一看就懂它的大小',
      '3. 材質軟或硬,自然的擺放姿態',
      '4. 照片拍到它的哪幾面、什麼角度(新畫面只用這些面)',
      '5. 客人選的類型、風格、情境、擺放方式,要我拍成什麼樣的畫面',
      '6. 這張的畫面主意(一句話)',
      '7. 標題放哪、怎麼排;右下角留給 LOGO',
      '【提示詞】  ← 這一行標記一定要寫',
      '(這一段原封不動交給生圖模型:只寫最終提示詞本身,不加標題、說明、前言或引號)'
    ].join('\n');
  }
  //  v1.6 RA 11-12「Didot 字型幫他用回來」:客人選的風格自己有寫字型 → 照風格(90 種裡有 13 種,逐一讀過原文)
  //   精簡引擎會把風格裡的字型描述拿掉(避免畫成排版),所以這裡直接從風格原文抽出來交給美術指導
  //   品牌包寫死的字型(明朝 / 宋體…)不在這裡,照舊換成 MOZ 黑體
  var TYPE_WORDS = /typograph|font|serif|lettering|headline|\bletters?\b|\btype\b|typeface|calligraph|handwrit|\bscript\b|glyph|\btext\b|wordmark/i;
  //  v2.3 RA 11-12「書法字好醜,把書法字都砍了」→ 風格裡寫書法 / 毛筆 / 筆刷字的句子不交給美術指導(等於沒寫,用 MOZ 黑體)
  var NO_BRUSH = /calligraph|brush|ink[- ]?script|sumi|書法|毛筆|筆刷/i;
  function styleType() {
    try {
      var f = (typeof REGIONAL_FLAVORS !== 'undefined' && typeof SELECTED_FLAVOR !== 'undefined') ? (REGIONAL_FLAVORS[SELECTED_FLAVOR] || {}) : {};
      return String(f.flavor || '').split(/(?<=[.;])\s+|,\s+/).filter(function (x) { return TYPE_WORDS.test(x) && !NO_BRUSH.test(x); })
        .map(function (x) { return x.replace(/^Add [^:]*:\s*/i, '').replace(/[.;]\s*$/, '').trim(); }).join(', ');
    } catch (e) { return ''; }
  }
  //  v1.8 擺放方式(product-placement.js 存在商品上的 placement)→ 中文標籤
  function placeLabel() {
    try {
      var p = (window.S && window.S.prod) || {}, k = String(p.placement || ''); if (!k) return '';
      var o = ((window.ProductPlace && window.ProductPlace.OPTS) || []).find(function (x) { return x.key === k; });
      return (o && o.label) || k;
    } catch (e) { return ''; }
  }
  function realSize() { try { var p = (window.S && window.S.prod) || {}; return String(p.realSize || '').trim(); } catch (e) { return ''; } }
  function prodTag() { try { var p = (window.S && window.S.prod) || {}; return [p.tag, p.placeNote].filter(Boolean).join(' / '); } catch (e) { return ''; } }
  //  admaker.js 的 const / let 不在 window 上,直接用名字讀(讀不到就空白)
  function safeLabel(mapName, keyName) {
    try {
      var maps = { LAYOUT_TEMPLATES: typeof LAYOUT_TEMPLATES !== 'undefined' ? LAYOUT_TEMPLATES : null, REGIONAL_FLAVORS: typeof REGIONAL_FLAVORS !== 'undefined' ? REGIONAL_FLAVORS : null, CONTEXT_THEMES: typeof CONTEXT_THEMES !== 'undefined' ? CONTEXT_THEMES : null };
      var keys = { SELECTED_LAYOUT: typeof SELECTED_LAYOUT !== 'undefined' ? SELECTED_LAYOUT : '', SELECTED_FLAVOR: typeof SELECTED_FLAVOR !== 'undefined' ? SELECTED_FLAVOR : '', SELECTED_CONTEXT: typeof SELECTED_CONTEXT !== 'undefined' ? SELECTED_CONTEXT : '' };
      return label(maps[mapName], keys[keyName]);
    } catch (e) { return ''; }
  }

  //  保險:就算 Claude 多講了一句前言 / 標題,也只留提示詞那一段(這些字會被生圖模型當成畫面內容)
  var META = /^(i |i'm |i'll |i need|i can|let me|here is|here's|since |note|based on|okay|sure|final prompt|prompt\s*:|this prompt|the prompt above|explanation|changes made|---)/i;
  function clean(t) {
    var paras = String(t).replace(/\r/g, '').split(/\n\s*\n/).map(function (x) {
      return x.replace(/^#+\s.*$/gm, '').replace(/^\s*(final prompt|prompt)\s*[:：]\s*/i, '').trim();
    }).filter(function (x) { return x && !META.test(x); });
    //  v1.4.1 全部保留(排版圖會分段:版面一段、每一格一段)—— v1.4 只留最長一段,排版圖被砍到剩一格
    return paras.join('\n\n').replace(/^["「“]|["」”]$/g, '').trim();
  }

  function once(content, layout) {
    var ctl = new AbortController(), tm = setTimeout(function () { ctl.abort(); }, layout ? TIMEOUT_MS * 1.5 : TIMEOUT_MS);
    return fetch(WORKER, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctl.signal,
      body: JSON.stringify({ action: 'claude_generate', password: (typeof GAS_PASSWORD !== 'undefined' ? GAS_PASSWORD : 'raby2026'), prompt: content, max_tokens: layout ? 3000 : 1700 })
    }).then(function (r) { return r.json(); }).then(function (j) {
      clearTimeout(tm);
      var raw = String((j && j.ok && j.text) || ''), cut = raw.lastIndexOf('【提示詞】'), mk = 5;
      if (cut < 0 && raw.indexOf('【思考】') >= 0) {   // 沒寫標記 → 找【思考】後第一行「大半是英文」的地方
        var lines = raw.split('\n'), pos = 0, seen = false;
        for (var li = 0; li < lines.length; li++) {
          var ln = lines[li], lat = (ln.match(/[A-Za-z]/g) || []).length, cjk = (ln.match(/[\u4e00-\u9fff]/g) || []).length;
          if (ln.indexOf('【思考】') >= 0) seen = true;
          else if (seen && ln.trim().length > 40 && lat > cjk * 3) { cut = pos; mk = 0; break; }
          pos += ln.length + 1;
        }
      }
      //  v2.4 一定要先有【思考】再有【提示詞】;沒照格式 = 沒想過 → 當失敗重試
      var think = cut > 0 ? raw.slice(0, cut).replace(/^[\s\S]*?【思考】/, '').trim() : '';
      var out = cut > 0 ? clean(raw.slice(cut + mk).replace(/^\s*[(（][^)）\n]*[)）]\s*/, '')) : '';
      //  v1.4.1 長度只防「壞掉」(空白 / 被截斷),不拿來淘汰好結果 —— 排版圖實測 4,700~5,200 字,v1.4 的 3,600 上限會把它丟掉
      var whole = /[.!?"”」』)）。]\s*$/.test(out);   // 沒有句尾 = 字數用完被截斷 → 當失敗,自動重試
      var ok = whole && out.length >= 200 && out.length <= (layout ? 3000 : 1600);
      return { out: ok ? out : null, think: think, error: ok ? '' : ((j && j.error) || (cut < 0 && raw ? '沒有照「先思考再寫提示詞」的格式' : (!whole && out ? '回覆被截斷' : '長度不對 ' + out.length + ' 字'))) };
    }).catch(function (e) { clearTimeout(tm); return { out: null, error: (e && e.name === 'AbortError') ? '逾時' : String(e && e.message || e) }; });
  }

  function direct(draft) {
    var t0 = Date.now(), layout = OLD_ENGINE.test(draft);
    return photoBase64().then(function (b64) {
      var content = [];
      if (b64) content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } });
      content.push({ type: 'text', text: brief(draft, !!b64, layout) });
      return once(content, layout).then(function (r1) {
        if (r1.out) return { r: r1, tries: 1 };
        console.warn('[AdDirector] 第一次失敗(' + r1.error + '),自動再試一次');
        if (typeof setPrStatus === 'function') setPrStatus('🎬 AI 美術指導再想一次…', 'var(--t3)');
        return once(content, layout).then(function (r2) { return { r: r2, tries: 2, first: r1.error }; });
      }).then(function (x) {
        window._adDirectorLast = { draft: draft, think: x.r.think || '', final: x.r.out || '', ms: Date.now() - t0, used: !!x.r.out, hadPhoto: !!b64, mode: layout ? 'layout' : 'photo', tries: x.tries, error: x.r.out ? '' : ((x.first ? x.first + ' / ' : '') + x.r.error) };
        return x.r.out;
      });
    });
  }

  //  v1.4 不在安裝時鎖死提示詞函式:每次用之前看一眼,被別的檔案(例如晚載入的精簡引擎)換掉了就重新包
  function ensureBuild() {
    var b = window.buildPosterPrompt;
    if (b && b.__director) return b;
    var inner = b;
    var w = function () {
      if (pending) { var p = pending; pending = null; return p; }   // 生圖那一刻拿到美術指導改好的版本(只用一次)
      return inner.apply(this, arguments);
    };
    w.__director = true; w.__inner = function () { return inner.apply(window, arguments); };
    window.buildPosterPrompt = w;
    return w;
  }

  function install(force) {
    if (typeof window.generateGptPoster !== 'function' || typeof window.buildPosterPrompt !== 'function') return false;
    //  一定要包在精簡引擎(adlean.js)外面:它先換掉 buildPosterPrompt,我們再包它 —— 反過來會被它繞過
    if (!window.buildPosterPromptLean && !force) return false;
    if (window.generateGptPoster.__director) return true;
    var origGen = window.generateGptPoster;
    ensureBuild();

    window.generateGptPoster = async function () {
      pending = null;
      if (window.AD_DIRECTOR !== false) {
        try {
          var draft = ensureBuild().__inner();     // 當下的引擎抽一份(同時設好重拍 / 校正旗標)
          if (draft && draft.length <= MAX_DRAFT) {
            var isLayout = OLD_ENGINE.test(draft);
            if (typeof setPrStatus === 'function') setPrStatus(isLayout ? '🎬 AI 美術指導看商品、整理排版中…' : '🎬 AI 美術指導看商品、定拍法中…', 'var(--t3)');
            var fin = await direct(draft);
            pending = fin || draft;    // 兩次都失敗才用草稿,不重抽(旗標保持一致)
            var L = window._adDirectorLast || {};
            console.log('[AdDirector v' + VERSION + '] ' + (isLayout ? '排版圖 ' : '照片 ') + (fin ? '改寫完成 ' + draft.length + ' → ' + fin.length + ' 字' : '兩次都失敗,用草稿(' + L.error + ')') + ' · ' + (L.ms || 0) + 'ms · 試 ' + (L.tries || 0) + ' 次');
            if (L.think) console.log('[AdDirector] 美術指導的思考:\n' + L.think);
            if (!fin && typeof setPrStatus === 'function') setPrStatus('⚠️ AI 美術指導這次沒回應,改用標準拍法生成', 'var(--t3)');
          } else {
            console.warn('[AdDirector v' + VERSION + '] 草稿異常(' + (draft ? draft.length : 0) + ' 字),不改寫');
          }
        } catch (e) { pending = null; console.warn('[AdDirector] 略過:', e && e.message); }
      }
      return origGen.apply(this, arguments);
    };
    window.generateGptPoster.__director = true;
    return true;
  }

  //  ✍️ v1.2 字型一律用 MOZ 那套(RA 2026-11-11「MOZ 好看的也是壓字的,就照他」)
  //   MOZ 沒有專屬品牌包 → 用預設的乾淨黑體;其他品牌包寫了明朝 / 宋體 / 草寫 / 斜體襯線,AI 畫中文最容易變形
  //   做法:品牌包被讀出來的那一刻,把「Typography」那一行換成 MOZ 的,配色等其他設定照舊(精簡引擎與舊引擎都讀這裡)
  var MOZ_TYPE = 'clean Sans Serif (Inter / 思源黑體 Regular), restrained letter-spacing';
  function mozType(pack) {
    if (!pack || !pack.dna || window.AD_MOZ_TYPE === false) return pack;
    var dna = String(pack.dna).replace(/^-\s*Typography[^:\n]*:.*$/gim, '- Typography: ' + MOZ_TYPE);
    return dna === pack.dna ? pack : Object.assign({}, pack, { dna: dna });
  }
  function installType() {
    if (typeof window.detectBrandPack !== 'function') return false;
    if (window.detectBrandPack.__mozType) return true;
    var orig = window.detectBrandPack;
    window.detectBrandPack = function () { return mozType(orig.apply(this, arguments)); };
    window.detectBrandPack.__mozType = true;
    return true;
  }
  var tt = 0;
  (function waitType() { if (installType() || ++tt > 80) return; setTimeout(waitType, 250); })();

  //  等 admaker.js / adlean.js / ad-logotap.js 都掛好再包(最多等 15 秒)
  var tries = 0;
  (function wait() {
    tries++;
    if (install(tries > 60)) return;            // 15 秒還沒等到精簡引擎 → 直接包舊引擎
    if (tries > 80) { console.warn('[AdDirector] 找不到廣告圖函式,未啟用'); return; }
    setTimeout(wait, 250);
  })();

  //  精簡引擎晚載入時也立刻重新包上(不用等到下一次生成)
  setInterval(function () { if (typeof window.buildPosterPrompt === 'function' && !window.buildPosterPrompt.__director && window.generateGptPoster && window.generateGptPoster.__director) { ensureBuild(); console.log('[AdDirector] 提示詞函式被換掉 → 已重新包上'); } }, 2000);

  window.AdDirector = { version: VERSION, direct: direct, brief: brief, mozType: mozType, ensureBuild: ensureBuild, styleType: styleType };
  console.log('[AdDirector] v' + VERSION + ' AI 美術指導已載入(關閉:window.AD_DIRECTOR = false)');
})();
