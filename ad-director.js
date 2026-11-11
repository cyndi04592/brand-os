// ═══════════════════════════════════════════════════════════════
//  🎬 ad-director.js v1.5(2026-11-12)廣告圖「AI 美術指導」—— 每一張廣告圖都經過美術指導
//  v2.4 RA 11-12「不是事後品管,是送出提示詞前就要想過 —— 眼鏡包被當一般包包、商品照拍很大但其實才裝得下一副眼鏡」
//       → 美術指導先寫【思考】(是什麼 / 實際多大跟人比 / 材質姿態 / 照片拍到哪些面 / 風格世界 / 畫面主意 / 字與 LOGO)再寫【提示詞】
//       → 商品實際大小(product-size.js 存的 realSize)第一次交給美術指導;思考內容存在 _adDirectorLast.think 給後台查
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
  var VERSION = '2.4.1';
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
      '【你的工作】把草稿改寫成一份最終提示詞,原則:',
      '1. 主角就是草稿裡的主體:商品、穿著商品的模特兒、客人身上做好的作品(美睫 / 美甲 / 髮型…)、專業人士本人、或螢幕畫面 —— 照草稿認定,不換主角。畫面裡每一樣多出來的東西都要替主角加分;搶戲、跟主角無關的道具或特效整個拿掉。',
      '2. 物理:東西照重力擺好、站穩、有影子。只有兩種情況可以漂浮 / 飛 / 飄:商品本身就是會飛、會浮、會飄的東西(看照片與商品名判斷),或客人在補充說明裡要了那個概念(例如太空、無重力)。決定要做,就整張照那個概念做到位,光影和影子一起合理。商品的姿態跟著它的材質走,以商品照為準:軟的東西(真空包、冷凍袋、布、皮件、軟管)照它在照片裡的樣子平放、攤開或微微斜靠,表面服貼內容物、有自然的皺摺與重量感;硬的東西(紙盒、罐、瓶、立袋、家電)才站著擺。',
      '3. 輕柔布料的衣服,可以讓布料本身在微風裡自然擺動;外加的布、絲巾、彩帶、紙花不要。',
      '4. 草稿裡跟商品或客人選擇衝突的句子刪掉或改掉;合理的拍法、地點、光線保留。客人的補充說明優先於草稿。',
      '5. 下面這幾類句子一字不改照抄:描述「主體保持照片原樣」的句子(商品的形狀、顏色、標籤、LOGO;人物的臉、五官、膚色、髮型、年紀;做好的作品;螢幕上的每個字與畫面);描述「其他衣物或物品是無品牌基本款、這個商品是畫面裡唯一有品牌的東西」的句子;描述「畫面上所有的字」的句子(引號裡的字原樣保留)。唯一要改的是字型:見第 10 點。',
      '6. 拍法照我們驗證過的高質感標準(MOZ 那套):真的攝影師重新拍一張,不是改圖;一個具體的畫面主意放最前面;光寫成物理過程(光從哪來、照到哪、影子落在哪、牆和地板反射補光),人、商品、背景被同一道光照到,商品吃場景的光、白色部位霧面只留一道細高光;有顏色的中間調背景配直射硬光;主體放在三分線,另一側留一面乾淨的牆給字;生活痕跡最多 3 件且有因果;構圖稍微偏離中心。',
      '7. 促銷、節慶、檔期(例如雙 11)一樣照第 6 點拍成一張真的照片:節慶感只用配色、材質、光來表現;畫面上的促銷訊息只有一則、放在一處,由客人給的標題字負責。',
      '8. 刪掉畫質堆疊詞(8K、超清、perfect、cinematic lighting、golden hour、soft glow 這類),它們會讓畫面變塑膠感。',
      layout
        ? '9. 這是一張「排版圖」(' + (safeLabel('LAYOUT_TEMPLATES', 'SELECTED_LAYOUT') || '多格 / 前後對比 / 清單') + '):草稿裡的版面結構完整保留 —— 畫布尺寸、幾格、哪一格放什麼、前後對比的左右或上下、條列幾點與順序、字放在哪裡。每一格裡的照片照第 6 點的拍法。草稿裡的 AVOID / 禁止清單改寫成正面的描述(要什麼),重複的句子合併。輸出英文,一個段落講版面、每一格各一句,具體、肯定、不寫否定句,總長 2,400 字元以內 —— 這點很重要:越長,生圖模型越抓不到重點;寫不下就刪最不重要的細節,字、格數、商品保護句一定留。'
        : '9. 輸出英文,5 到 7 句,每句只講一件事,具體、肯定、不寫否定句,總長 1,200 字元以內 —— 越長生圖模型越抓不到重點。',
      '10. 字型:【風格指定的字型】有寫 → 畫面上所有的字都用那個風格的字型(例如歐美雜誌風用 Didot 那種高反差銳利襯線),字形正確、筆畫乾淨、好讀;沒寫 → 一律用 MOZ 那套乾淨的無襯線黑體(Inter / 思源黑體 Regular)、字距收斂。草稿裡其他的字型描述(品牌包寫的明朝、宋體、書法、斜體等)都換成上面決定的這一個。書法字、毛筆字一律不用(水墨、禪意風格也一樣),字一律是印刷字體。',
      '11. 先看懂商品「是什麼、怎麼用」再決定拍法:商品名常是行銷暱稱(例如「雲朵水餃包」講的是形狀,實際可能是眼鏡包),要從照片的形狀、開口、尺寸、標籤與規格判斷真正的用途;畫面要讓人一眼看懂用途(眼鏡包就讓眼鏡收在裡面、掛在身上;真空包食品就讓人看到裡面的食物煮好有多好吃)。最終提示詞第一句就寫清楚這是什麼商品。商品照常是近拍特寫,看起來很大不代表它很大:照【商品實際大小】決定它在畫面裡跟手、身體、家具的比例(例如裝一副眼鏡的收納包只有手掌長,戴在人身上時只佔身體很小一塊),並在提示詞裡寫出它的真實尺寸與一個比例參照。',
      '12. 等級對標國際品牌廣告(Nike、New Balance、精品配件、高級食品禮盒)。依商品類型選最對的拍法(下面是客人沒選風格時的預設;客人選了風格,場景、年代、色調、道具一律照那個風格走,這裡只借用「主角怎麼擺、光怎麼打、用什麼動作講賣點」 —— 例如復古電風扇選了北歐極簡就拍成北歐極簡的房間,不拍老屋):鞋與運動用品 → 一隻鞋當主角、佔滿畫面、斜角三分之四側面(要一雙就一前一後交疊成一組);用一個說故事的道具或動作把賣點講出來:輕 → 穿在腳上踏出去的瞬間(腳踝到鞋的局部、白色羅紋長襪、褲管或膚色收在暗部)、或鞋跟掛在登山扣上用繩索吊在岩壁之間、或一隻手只用兩根手指勾著鞋帶提起來;穩 / 耐 → 踩在岩石或砂礫上;背景是冷灰到藍灰的漸層天空或深色無縫棚,側逆光把輪廓和鞋面材質勾出來,影子與反光跟著主光走;隨身配件與包款 → 戴在人身上的局部特寫(胸口、腰間、手上),服裝與配件同色系,柔和側窗光;包裝食品(真空包、冷凍、調理包、禮盒) → 主角是客人照片裡的包裝本身:照原樣、封好、放在畫面前方最清楚的位置,包裝上的字、圖、透明窗完整看得到;食物只出現照片裡原本有的樣子(客人要拍煮好的樣子,會自己選煮好的照片當商品照),配角是餐桌與食材道具;透明素面的一般包裝 → 側光把包裝的透明感與裡面食物的紋理打亮,用餐桌道具(木桌、陶盤、竹編盤、筷子、醬料小碟)把質感拉上來;背景二選一:溫暖單色紙背景(橘、杏、鼠尾草綠、磚紅)配直射陽光與窗影,或深色石板木桌配側光;禮盒蓋好擺正當主角,或雙手捧著禮盒送出去的瞬間;療癒器物(頌缽、香氛、水晶) → 三種拍法擇一:① 使用中的手 —— 手拿木槌沿著缽緣繞、或捧著缽,白色或米色亞麻衣袖,旁邊一根點燃的線香飄一縷煙、一盞蠟燭;② 一個人盤腿坐在明亮的木地板或亞麻墊上、閉眼、缽在身前,窗光從側面進來,大量留白;③ 黃銅缽的近距離材質特寫,錘紋與金屬光澤,溫暖燭光與暗背景。大地色系(米、駝、棕、鼠尾草綠)、溫暖自然側光、一點霧氣,畫面裡沒有宗教符號;復古家電與生活家電(電風扇、暖爐、收音機) → 拍成有故事的生活片段:日式或台式老屋的木窗邊、木地板或榻榻米、紙拉門透進的午後陽光,一個人背光坐在電扇前吹風、頭髮被風輕輕吹起,或商品單獨放在窗邊的老木桌上、旁邊一盤切好的西瓜或一盤蚊香飄一縷煙;底片顆粒、暖色偏淡的色調、柔和的逆光與窗影;暖爐就是冬天毛毯、熱茶、窗外冷色的對比;工藝品與器物 → 當代藝術靜物,洞石或木石材質、自然光、大量留白;撞色風格 → 用高級的配色組合(紅＋橘＋薄荷、單一飽和色、酒紅＋米),硬光投影,避開像國旗的純紅純藍。',
      '13. 畫面上的字只有客人給的標題。招牌、燈籠、海報、印章、包裝以外的道具全部是素面沒有字;品牌 LOGO 只出現在商品本身原本印 LOGO 的位置,原照片背景裡的牆面招牌或 LOGO 不帶進新畫面(系統之後會另外疊上品牌 LOGO)。手入鏡時從畫面邊緣自然伸進來,手腕與前臂完整、姿勢優雅。',
      '14. 【客人選的擺放方式】是客人對商品的設定,優先於草稿與第 12 點(唯一例外:客人補充說明裡明確要了別的畫面概念,例如鞋子要拍太空無重力漂浮 → 照補充說明):擺放方式是「穿戴」→ 畫面一定是商品戴在、背在、穿在、拿在一個人身上的樣子(依商品用途選最自然的位置,例如眼鏡包掛在胸前或腰間、包包背在肩上、鞋穿在腳上),鏡頭裁在身體局部(肩到腰、手、腳),人的臉在畫面外或只露下巴,衣服是無品牌素面基本款、與商品同色系;商品大小照真實比例,是畫面的焦點。其他擺放方式(桌面、落地、手拿…)照字面安排。',
      '15. 字的排法對標國際品牌海報(Nike、ASICS、精品雜誌):標題字級克制(大約畫面寬度的三分之一以內)、細到中等字重、字距明顯拉開(中文一字一字留空、英文大寫寬字距),貼齊版面的網格 —— 放在上緣置中或靠一側、和畫面邊緣留同樣寬的邊距;字是純色(白、黑或從畫面裡取的一個顏色),乾淨地印在畫面上,沒有底框、外框、陰影、描邊、發光。也可以做成極大的建築感字體放在主體後面、被主體遮住一部分。中文或日文標題可以直排(由上往下一行,像日本雜誌的大標),放在畫面一側的留白裡;生活感、復古的畫面可以用細細的白色鋼筆手寫線條字,像用細筆隨手寫在照片上(筆畫粗細一致,不是毛筆書法)。字只有客人給的標題。',
      '16. 右下角固定留給品牌 LOGO(系統之後會疊上去):畫面右下角約寬三分之一、高六分之一的範圍,是平整單純的背景(一片牆、地面或天空,沒有字、沒有影子邊線、沒有物件),主體與標題都放在這塊以外的地方;標題放在上緣、左側或主體旁的留白,和右下角保持距離。',
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
      var ok = whole && out.length >= 200 && out.length <= (layout ? 8000 : 4000);
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
