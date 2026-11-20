// ═══════════════════════════════════════════════════════════════
//  🎬 ad-director.js v1.5(2026-11-12)廣告圖「AI 美術指導」—— 每一張廣告圖都經過美術指導
//  v2.9.4 RA 11-19「全部品牌都要 MOZ 高規格」:比對後台 33 張成品 —— MOZ 張張主角大、一道硬光有影子圖案、有色中間調背景、一個主意;
//       其他品牌常見:商品小小一個在大房間(巧福風扇)、昏暗夜景(旺味)、象徵物(夏天放西瓜)、平光型錄感(巧福桑拿)
//       → 廣告圖美術指導第 10 條「MOZ 等級」五件事 + 思考第 6 項逐一確認
//  v2.9.3 RA 11-18 鱸魚青醬麵疙瘩＋氣泡酒影片「湯匙跟湯汁很假」:湯匙一動就彎、融進盤子;醬汁被拍成一根硬梆梆的綠棍立在食物上
//       整套查(kol-proxy v7.87 /admotion.js v3.3):22 招商品運鏡全是為鞋、包、家電這類「硬的單一物件」設計,
//       沒有一招認得「盤裡的料理」;預設招式每次隨機(v3.1),料理會抽到聚攏成形、懸浮落定、手推、換景、微距滑過醬汁這類做不到的;
//       廣告圖本身又會擺湯匙、刀叉、酒杯當道具(FOOD_CRAFT、food_french),影片模型最不會畫的正是「細長的東西動」和「液體流動」。
//       → 運鏡導演第 7 點(所有商品):細長物與液體整支影片不動,動感交給鏡頭、光、蒸氣,特寫與環繞避開餐具和玻璃杯,標籤保持正面
//       → 第 8 點(RA:「不是只有美食,我的品牌這麼多」):依材質分八類寫清楚「一動就會假」的地方與替代動作 ——
//         料理飲料(旺味、琉宇、福臨門、VegiWell)、玻璃金屬水晶(酒杯、醬罐、頌缽、家電)、字標籤包裝螢幕(真空包、禮盒、網站)、
//         人手臉蕾絲布料(LACE&Z、MOZ 服飾、美業、洳意禪舞)、會動零件(巧福電風扇)、細碎自然物(Every Hay 牧草、串珠)、
//         看不見的效果(頌缽聲波、能量)、硬的單一物件(MOZ 鞋包、機台);不寫死品牌名,由 AI 導演看商品自己判斷屬於哪一類
//       → 思考多一項「哪些東西一動就會假」
//  v2.9.2 RA 11-15「美術指導不另外扣點」:兆亨實測做一張圖畫面寫 240、實際扣 480(美術指導 2 次 × 120 被當成生成文案扣)
//       → 每次呼叫帶 purpose:'ad_director',photoroom-proxy 看到就不扣(只放行 max_tokens ≤ 3000,生成文案照扣)
//  v2.9.1 生成紀錄記下美術指導挑的壓字排法(params.director.textStyle,例如「7 兩行大標」;思考第 7 項也看得到)
//  v2.9 RA 11-13 系統壓字(ad-textlayer.js):照片裡不畫字、不替字留白;美術指導從 RA 定案的 20 款排法挑一款(思考第 7 項寫編號)交給壓字模組
//  v2.8.1 RA 11-13「LOGO 也是自己判斷,你才是智能」→ 拿掉「右下角先留給 LOGO」的預約;構圖自由,LOGO 由 admaker 生完圖量四角挑最乾淨的
//  v2.8 RA 11-12「後台生成紀錄要看得到影片的導演思考」→ 商品運鏡寫進 gen_log 時(admaker_motion)一起存
//       AI 導演的思考、真正送出的運鏡、系統草稿與客人選的運鏡/秒數/光線;後台「看詳細」直接看得到
//  v2.7.4 實測 HH 美睫:簡報寫「沒寫,用 MOZ 黑體」→ 美術指導把「MOZ Gothic」寫進別的品牌的提示詞(不存在的字型 + 別家品牌名)
//         → 簡報直接給字型的描述(乾淨黑體 Inter / 思源黑體),不再出現 MOZ 這個字
//  v2.4 RA 11-12「不是事後品管,是送出提示詞前就要想過 —— 眼鏡包被當一般包包、商品照拍很大但其實才裝得下一副眼鏡」
//       → 美術指導先寫【思考】(是什麼 / 實際多大跟人比 / 材質姿態 / 照片拍到哪些面 / 風格世界 / 畫面主意 / 字與 LOGO)再寫【提示詞】
//       → 商品實際大小(product-size.js 存的 realSize)第一次交給美術指導;思考內容存在 _adDirectorLast.think 給後台查
//  v2.7.3 實測眼鏡包落地回彈:Claude 把「[Image3] to [Image7]」改了寫法 → 驗收不過、用原本運鏡(600 點白扣)
//         → 參考圖與保護句由系統原樣保留,AI 導演只改寫有時間碼的分鏡;時間碼與段數一樣才收
//  v2.7.2 實測:fetch 被晚載入的檔案再包一層 → 客人開商品運鏡視窗時再確認一次接手;同一筆只想一次
//  v2.7.1 實測眼鏡包選「落地回彈」:AI 導演想對了(硬殼改成沉穩落定、扣蓋微顫),但寫了 1,610 字 > 原本 1,356 被丟掉
//         → 太長先再壓一次(保留時間碼與 [Image]),壓完重新驗收
//  v2.7 RA 11-12「商品影片也要跟照片、KOL 影片一樣先思考」→ 商品運鏡影片送給 Seedance 前,AI 導演先看廣告圖 + 商品照想清楚
//       (是什麼、多大、軟硬、哪些部分真的會動、看得到哪幾面、客人選的運鏡做不做得到)再改寫運鏡提示詞。
//       線上運鏡引擎在 kol-proxy /admotion.js(不在 repo)→ 這裡在送出 seedance_submit 的那一刻接手,不改 Worker。
//       時間碼與 [ImageN] 一個不能少、長度不能變長,不合格 / 逾時就用原本的運鏡。保險絲:window.MOTION_DIRECTOR = false
//  v2.6 RA 11-12「後台要清楚知道客人點了哪些、怎麼生出這張圖,我們固定時間去查」
//       → 廣告圖寫進既有的生成紀錄(D1 gen_log)時,一起存美術指導的思考、最終提示詞、系統草稿與客人的標題/補充/大小/擺放
//       (包住 admaker.js 的 _kolPost,只在 action=gen_log 且是廣告圖時加料;不改 admaker.js、不改 Worker)
//  v2.5.3 實測眼鏡包:美術指導寫了 1,782 字被 1,600 上限擋掉,兩次都擋 → 退回 2,500 字草稿(更長、沒經過美術指導)
//       → 長度上限只擋壞掉的;超過 1,300 字就請美術指導再壓一次(意思保留、字變少),壓不成功才用原本那段
//  v2.5.2 RA 10-22 鐵律「廣告圖提示詞完全不提 logo」:第 8 點改成只描述右下角是什麼背景,不寫 LOGO
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
  var VERSION = '2.20.1';   // 2.20.1 ⓪-3 照片俯拍的平放商品,新畫面也要俯拍(齊漁實測:真空包和牛被立起來);包裝照原樣不拆;   // 2.20.0 照片核對:照片不是客人選的商品 → 出圖扣點前先問(共用照片庫、幾千家廠商都適用,不用存資料);   // 2.19.4 ⓪-2 長相只認照片,名字只是標籤(請請實測:照菜名重畫成另一道菜);   // 2.19.3 RA:海苔飄浮是參考圖刻意的拍法 → 刻意飄浮保留(要一看就是故意的),只擋不上不下的浮在桌上;   // 2.19.2 重力優先於商品照角度(實測琉宇海苔片直立浮在盤子上);   // 2.19.1 自查加物理常識(實測旺味真空包裝放在烤網上);   // 2.19.0 照片裡的真人可保留(去 AI 感,RA:刺蝟星球說要抓真人與生活感參考);   // 2.18.0 RA 11-20 巧福那張有 AI 感:⑥-1 去 AI 感(真實瞬間不擺拍、普通真實長相、生活痕跡、不完美構圖、紀實底片感、不要米色濾鏡);   // 2.17.0 RA 11-20 致命缺點「商品個別打光」:⑥-0 一起打光(色溫、陰影、銳利度、顆粒跟周圍一樣),自查加一項;   // 2.16.0 一萬家進駐:還沒定頂級類型的品牌,美術指導看品牌靈魂替它定一次、存起來(同品牌每張同調性),每晚再固定進 shoots;   // 2.15.0 RA 11-20 每個品牌一個「它那個世界最頂級的拍攝類型」(shoots/<品牌>.json genre),美術指導照那一類攝影師的眼光拍;不能太爛也不能太完美;   // 2.14.0 RA 11-20 鏡頭距離:客人選遠景/中景/近景/超近特寫,美術指導照選的寫;自動時照主意決定、不預設近拍(主角是第一眼看到,不一定大);   // 2.13.2 類型選生存遊戲一律電影劇照;生存遊戲消焰器 = 仿真冒火光(RA:跟真槍相反);   // 2.13.1 RA 11-20 BCS 生存遊戲一直被擋:槍類寫成電影劇照 / 片場道具,槍口朝下、不寫 weapon/shoot,過審句照抄;   // 2.13.0 RA 11-20「高級但文不對題」:⓪ 對題 —— 場景只來自商品真正的世界(誰買、在哪用),高級感只靠光、構圖、色彩、主意;思考第 2 項列出它絕不會出現的地方、自查第一項查對題;   // 2.12.5 貼身衣物露膚度要低:外穿薄紗罩衫/絲襯衫/開衫拉攏、下身長褲長裙;   // 2.12.4 貼身衣物有模特兒:外披敞開襯衫或拍背面(正面只穿內衣被擋三次);   // 2.12.3 貼身衣物用時裝目錄講法(實測臥室、皮膚、剛穿上被擋);   // 2.12.2 版型要求的動作照做(實測手持版沒有手);   // 2.12.1 貼身衣物的「主角大」= 整個人腰上半身(實測內衣胸口特寫被安全審查擋下);   // 2.12.0 RA 11-20「70 分、不讓人驚豔」:找回 MOZ 等級五件事(主角大、硬方向光的光影圖案、有決定的背景色、一個意想不到的主意)+ 思考第 6 項自查;   // 2.11.3 版型決定的地點(白棚、極簡海報、雜誌封面)不換場景
  var WORKER = 'https://photoroom-proxy.calm-sunset-6b66.workers.dev';
  var TIMEOUT_MS = 55000;    // 單次等待(排版圖 60 秒);失敗會再試一次
  //  v1.3 舊引擎(前後對比 / 多格 / 清單排版圖)的提示詞有「=== 區塊標題 ===」→ 看標記判斷,不看長度
  //   (v1.0 用 2600 字當界線,新引擎草稿常常 2610~2640 字 → 被誤判跳過,RA 11-11 實測抓到)
  var OLD_ENGINE = /^===\s*[A-Z][A-Z &]+===/m;
  var MAX_DRAFT = 30000;    // 只防異常(舊引擎排版圖草稿約 9,000~11,000 字)
  var pending = null;       // 這一次生成要用的最終提示詞(只用一次)

  //  v2.14 鏡頭距離(RA 11-20「想拍遠景呢?想超近距離呢?MOZ 套用不對,直接硬控」)→ 客人自己選,美術指導照選的寫,沒選才自動
  var SHOTS = { far: '遠景(主角小、地點講故事)', mid: '中景(主角和環境各一半)', near: '近景(主角佔畫面一半以上)', macro: '超近特寫(貼近材質與做工)' };
  var SHOT_EN = { far: 'Camera distance: a wide establishing shot — the setting fills the frame and the product is small but the first thing the eye finds, isolated by light, contrast and open space.',
                  mid: 'Camera distance: a medium shot — the product and its surroundings share the frame about half and half.',
                  near: 'Camera distance: a close shot — the product fills more than half of the frame.',
                  macro: 'Camera distance: an extreme close-up macro shot — the lens almost touches the product, one detail of its material, texture and craftsmanship fills the frame, very shallow depth of field.' };
  window.AD_SHOT_EN = SHOT_EN;
  function mountShot() {
    var d = document.getElementById('gptStyleDesc');
    if (!d || document.getElementById('adShotRow')) return;
    var row = document.createElement('div'); row.id = 'adShotRow';
    row.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;align-items:center;margin:6px 0 2px;font-size:10px;color:var(--t2);';
    row.innerHTML = '<span style="margin-right:2px">📷 鏡頭距離</span>';
    [['', '自動'], ['far', '遠景'], ['mid', '中景'], ['near', '近景'], ['macro', '超近特寫']].forEach(function (o) {
      var b = document.createElement('button'); b.type = 'button'; b.textContent = o[1]; b.dataset.k = o[0];
      b.style.cssText = 'padding:3px 8px;border-radius:10px;border:1px solid rgba(255,255,255,0.15);background:var(--bg4);color:var(--t1);font-size:10px;cursor:pointer;';
      b.onclick = function () { window.AD_SHOT = o[0]; paint(); };
      row.appendChild(b);
    });
    function paint() { [].forEach.call(row.querySelectorAll('button'), function (b) { var on = (b.dataset.k || '') === (window.AD_SHOT || ''); b.style.background = on ? 'var(--accent, #7C6DFA)' : 'var(--bg4)'; b.style.color = on ? '#fff' : 'var(--t1)'; }); }
    d.parentNode.insertBefore(row, d); paint();
  }
  setInterval(mountShot, 1500);
  //  v2.16 頂級拍攝類型的來源:① shoots/<品牌>.json(每晚定好上線)② 這台電腦上次美術指導替這個品牌定的(進駐第一天就固定,同一品牌每張同一調性)
  function genreNow() {
    try {
      var bid = (window.S || {}).brandId; if (!bid) return '';
      var c = window.AdLeanShoots && window.AdLeanShoots.cache[bid];
      if (c && c.genre && c.genre.en) return c.genre.zh + ' —— ' + c.genre.en;
      return localStorage.getItem('bs_genre_' + bid) || '';
    } catch (e) { return ''; }
  }
  function keepGenre(think) {
    try {
      var bid = (window.S || {}).brandId; if (!bid || genreNow()) return;
      var m = String(think || '').match(/類型[::]\s*([^\n]{2,120}?[—-]+\s*[A-Za-z][^\n]{8,300})/);
      if (m) { var g = m[1].replace(/^類型[::]\s*/, '').trim(); localStorage.setItem('bs_genre_' + bid, g); window._adGenreNew = { brandId: bid, genre: g }; }
    } catch (e) {}
  }
  function val(id) { var el = document.getElementById(id); return (el && el.value || '').trim(); }
  //  v2.9 系統壓字(ad-textlayer.js)開著時:生成期間大標欄位對程式是空的 → 從壓字模組拿客人真正打的字
  function tl() { var t = window.AdTextLayer; return (t && t.isOn && t.isOn()) ? t : null; }
  function headT() { var t = tl(); return t ? t.title().h : val('gptHeadline'); }
  function subT() { var t = tl(); return t ? t.title().s : val('gptSubHeadline'); }
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
      '風格指定的字型:' + (styleType() || '(沒寫,用乾淨黑體:' + MOZ_TYPE + ')'),
      '情境:' + (safeLabel('CONTEXT_THEMES', 'SELECTED_CONTEXT') || '(沒選)'),
      '看齊的頂級拍攝類型(這個品牌的世界裡最好看的那一類照片):' + (function () { var g = genreNow(); return g ? g : '(這個品牌還沒定 —— 你看【品牌靈魂】和商品,替它的世界選一個最頂級的攝影類型,寫在【思考】第 0 項)'; })(),
      '品牌靈魂:' + (function () { try { var b = (window.BRANDS || []).find(function (x) { return x.id === (window.S || {}).brandId; }); return String((b && b.soul) || '(沒有)').replace(/\s+/g, ' ').slice(0, 300); } catch (e) { return ''; } })(),
      '照片裡的真人:' + (window._amKeepPerson ? '客人選了保留 —— 同一個真人(臉、五官、髮型、皮膚紋理、身形、衣服都照原樣),只是換到新場景、在做一件真實的事;草稿裡講這個人的那句一字不改照抄' : '(沒有,或客人選了只拍商品)'),
      '鏡頭距離(客人選的):' + (SHOTS[window.AD_SHOT || ''] || '自動(你照這張的主意決定,不要每張都是近拍)'),
      '客人補充說明:' + (val('gptStyleDesc') || '(沒有)'),
      (tl() ? '標題(系統出圖後用真字型壓上;照片裡不畫任何字,也不用替字留白,構圖照你的判斷):' : '標題:') + (headT() || '(沒有)') + (subT() ? ' / 副標:' + subT() : '')
    ].filter(Boolean).join('\n');
    return [
      hasPhoto
        ? '你是頂尖商業攝影的美術指導。附圖是客人的真實商品照。先看懂這個商品:它是什麼、多大、怎麼用、材質輕重、賣點在哪;再讀客人的選擇與補充說明;最後讀系統抽給你的拍攝草稿。'
        : '你是頂尖商業攝影的美術指導。這次沒有附圖,商品照會直接交給生圖模型;請從商品名稱、規格、特色判斷它是什麼、多大、怎麼用、材質輕重、賣點在哪;再讀客人的選擇與補充說明;最後讀系統抽給你的拍攝草稿。',
      '',
      '【商品與客人的選擇】',
      lines,
      '',
      (function () { try { var L = window.AdLeanLib ? window.AdLeanLib(8) : []; return L.length ? '【拍法庫】(從你那套 Pinterest 頂級作品整理出來的通用拍法,隨機抽 8 個給你參考;看懂商品後挑最適合的一個改寫進 ① 畫面主意,都不適合就用草稿的)\n' + L.map(function (x, k) { return (k + 1) + '. ' + x; }).join('\n') + '\n' : ''; } catch (e) { return ''; } })(),
      '【系統草稿】(英文,是生圖模型要讀的提示詞)',
      draft,
      '',
      '【你的工作】把草稿改寫成最終提示詞。方法照 MOZ 那次做出來的(RA 2026-10-22 實測:同一張照片,7,000 字的版本被改壞,600~1,300 字、每段一句的版本「超好看」):提示詞不是越多越好、也不是越少越好 —— 字數是一把尺、只寫事實、每段長度平均;順序就是權重,越重要的越前面。',
      '先看懂商品(看照片,不被商品名騙):它是什麼、實際多大(照【商品實際大小】)、什麼材質、怎麼用、賣點在哪、在真實世界裡會出現在什麼地方、被怎麼拿怎麼用。',
      '再照這個順序寫,每段一句、長度差不多:',
      '⓪-1 頂級類型(RA 11-20:MOZ 好看不是因為五條規則,是借到「北歐生活型錄」這個本來就頂級的攝影類型;BCS 寫成電影劇照也是同一招):整張照【看齊的頂級拍攝類型】那一類攝影師的眼光去拍 —— 第一句就寫出這個類型,場景、光、構圖、人物都照那一類最好的作品;質感要真:有生活感、看得出真實材質,不能太爛也不能太完美(太乾淨、太亮、像 CGI 的 AI 感也不行);提示詞同樣不能太長也不能太短。',
      '⓪ 對題(比高級更重要,RA 11-20:「生存遊戲的槍拿去專櫃或辦公室拍,高級沒錯但文不對題」):先想這件商品真正的世界 —— 誰買、在哪裡用、用的那一刻長什麼樣(生存遊戲槍 = 野戰場、樹林、掩體、戰術裝備;登山鞋 = 山徑岩石;海苔 = 零食時刻;鍋具 = 爐火與餐桌;寵物草 = 寵物身邊)。場景、道具、人物穿著都只能來自這個世界;高級感只靠光、構圖、色彩和一個好主意做出來,不靠把商品搬進精品店、專櫃、大理石檯面、豪宅或辦公室。拍法庫或草稿的場景不屬於它的世界就不用。 生存遊戲槍、玩具槍、漆彈槍這類(RA:跟內衣一樣會被安全審查擋,鏡頭蓋那位客人用野戰場寫法有過):整張寫成電影劇照或片場的一刻 —— 開頭寫 a cinematic film still,商品稱 airsoft sport replica / film prop,不寫 weapon、gun fight、shoot、kill、target、aim 這些字;槍口一律朝下或朝外、不對著任何人或鏡頭;人物是戴護目鏡面罩的演員或球員、站姿放鬆;沒有受傷、血、爆炸、真實軍警或戰爭場面;草稿裡的過審句一字不改照抄。客人選的類型是「生存遊戲」時一律這樣拍。生存遊戲的消焰器 / 火光模擬器跟真槍相反:它是讓槍口仿真冒出火光的配件,拍它裝在槍口、在暗一點的場景冒出橘白色仿真火光的那一刻。',
      '⓪-2 長相只認照片(RA 11-20 請請實測:商品叫青醬鱸魚疙瘩、照片是另一道橘色的菜,被照名字重畫成青醬):商品長什麼樣只看附上的商品照,名字只是標籤;名字跟照片不一樣時照照片。食物就是照片裡那一盤 —— 同樣的食材、顏色、塊數、醬汁、擺盤,不准照菜名重煮一盤;寫提示詞時不要用菜名去描述食物的內容。',
      '⓪-3 照片是從哪個方向拍的,新畫面就從同一個方向看它(RA 11-21 齊漁實測:真空包和牛的照片是從正上方拍它平放,提示詞寫「平放在砧板上」卻用平視鏡頭,模型為了讓貼標籤那一面朝鏡頭,把一整塊冷凍肉立在桌上):先看商品照是從上往下拍的平放、還是平視拍的站立。照片是俯拍平放的東西(真空包、肉、魚、平放的衣服、盤子裡的菜、書、卡片)→ 新畫面一定寫明鏡頭從上方往下看(正俯拍或斜上方四十五度以上),商品平躺在檯面上、照片裡那一面朝上朝鏡頭;不准寫平視、低角度。照片是平視拍站立的東西 → 才用平視。另外,包裝照原樣:照片裡有包裝(真空袋、盒子、瓶罐、標籤)就連包裝一起拍,不准寫「拆開」「取出」「打開包裝」。',
      '① 畫面主意(權重最大):一個這件商品在真實世界會發生的瞬間或擺法 —— 參考草稿裡的拍法,換成最適合這件商品的那一個。客人選的版型如果自己決定了地點(白棚 = 無縫棚、極簡海報 = 一面單色牆加大片留白、雜誌封面 = 上方留給標題),畫面主意只能發生在那個地點裡,不換成廚房、街景之類的別的場景;版型要求的動作也照做(手持實拍 = 畫面裡一定有一隻手拿著商品、情境寫真 = 真實生活的一刻、戲劇飛濺 = 被高速快門凍住的動態)。',
      '② 主體:它是什麼、佔畫面多少(直接寫比例,例如 two-thirds of the frame);大小照草稿裡那句尺寸句原樣保留(那句來自客人點選的【商品實際大小】,系統已經寫好),不另外加比例參照物。',
      '③ 場景與光:在哪裡拍(真實地點與材質);背景是一個有決定的顏色 —— 跟商品或品牌同色系的中間調(鼠尾草綠、赭紅、霧藍、芥末黃這種),不是米白、淺灰、平平的木色;一道有方向的硬光(直射陽光、窗光、百葉窗或樹葉的光影、窄束聚光),寫出它從哪邊來、照亮主體哪一側、另一側落進陰影,影子同時落在主體和背景上形成看得見的光影圖案。客人選了柔和的風格或空間類(客房、物件)才用柔光,但光仍然要有方向。',
      '④ 構圖與機位(RA 11-20:「MOZ 不是每張都近拍 —— 要遠景、也要超近」):主角一定是第一眼看到的,但大小照【鏡頭距離】:遠景 = 地點把故事講完,主角在畫面裡小小的、靠光、對比和大片留白讓人第一眼找到它;中景 = 主角和環境各一半;近景 = 主角佔畫面一半以上;超近特寫 = 鏡頭貼到材質、紋理、做工,只拍商品最有賣點的一小塊、淺景深。客人選了就照選的,寫在這段第一句;沒選(自動)就照畫面主意決定,場景本身好看就拉遠、材質是賣點就貼近,不要預設近拍;寫出鏡頭高度和主體在畫面哪裡、哪邊留白。貼身衣物(內衣、泳裝、睡衣)的「主角大」指的是整個人:腰上半身、看得到臉、像時裝雜誌那樣,不寫胸口或身體部位的特寫、不寫視線看向自己胸前;用時裝目錄的講法 —— 寫「穿著」不寫「剛穿上」,地點用攝影棚、客廳、陽台、更衣間,不寫臥室和床,光寫照在布料、蕾絲和牆上,不寫照在皮膚上;有模特兒時露膚度要低(RA:之前的經驗,內衣不能太裸露)—— 外面穿一件半透明薄紗罩衫、絲質襯衫或針織開衫,扣到胸下或拉攏,只露出內衣的蕾絲邊、肩帶和一部分罩杯,下身穿高腰長褲或長裙;衣服不滑落肩膀、不寫只穿內衣;或拍背面、側背面(實測:只穿內衣的半身照、外衣滑落肩膀、鏡子照出正面,連續被生圖安全審查擋下四次)。',
      '⑤ 風格、情境與品牌色:照客人的選擇,一句說完(節慶只用配色、材質、光)。',
      '⑥-0 一起打光(RA 11-20 致命缺點:商品看起來是個別打光、像貼上去 —— 跟 KOL 以前的坑一樣):寫一句「商品被這個場景同一道光照到」—— 光從哪邊來就照亮商品的哪一側、另一側落進跟旁邊的手 / 桌面一樣深的陰影;商品帶著場景的色溫(暖光就偏暖)、同樣的對比、同樣的銳利度和顆粒,反光裡映著周圍的顏色;商品絕不能比周圍更亮、更乾淨、更清楚或更平均受光。草稿裡「One light for the whole picture」那句一字不改照抄。',
      '⑥-1 去 AI 感(RA 11-20:巧福那張有 AI 感):人物在做事、不擺拍 —— 不對鏡頭外空笑、不正襟危坐,是一個被抓到的真實瞬間(低頭喝茶、調整毯子、跟家人說話);長相是普通真實的人(皮膚有紋理、毛孔、髮絲不完美),不是偶像臉;環境有生活痕跡(毯子皺褶、隨手放的杯子、一點點亂),不是樣品屋;構圖不完美對稱、主體稍微偏一邊;寫真實相機與底片(35mm 紀實、輕微顆粒、真實景深),不要整片米色暖棕的濾鏡色、不要每個表面都乾淨發亮。',
      '⑥ 草稿裡的保護句一字不改照抄(商品照原樣、人臉不換、畫面上的字原樣)。',
      tl() ? '⑦ 字:照片裡不畫任何字,標題由系統出圖後壓上;背景的招牌與道具是素面。'
           : '⑦ 字:畫面上只有客人給的標題(字型照【風格指定的字型】,沒寫就用乾淨黑體,不用書法字);背景的招牌與道具是素面。',
      '其他:客人的選擇優先(補充說明 > 擺放方式 > 風格與情境 > 草稿);提示詞全文不提 logo 這個字(系統出圖後自己疊);重力、材質、光照都照真實世界。',
      layout
        ? '這是一張「排版圖」(' + (safeLabel('LAYOUT_TEMPLATES', 'SELECTED_LAYOUT') || '多格 / 前後對比 / 清單') + '):草稿的版面結構完整保留,每格照片照上面的順序各寫一句。輸出英文、肯定句,總長 2,400 字元以內。'
        : '輸出英文、肯定句,總長 900 到 1,300 字元(很重要)。',
      '',
      '回覆固定兩段:',
      '【思考】(中文,每項一句)0. 頂級拍攝類型:照這個格式一行寫「類型:中文名稱 —— English description」(已經定好就照抄定好的) 1. 這是什麼、多大、什麼材質、怎麼用、賣點 2. 它真正的世界:誰買、在哪用、用的那一刻;哪些地方它絕不會出現(精品店?辦公室?)—— 場景只能從前者選 3. 畫面主意(一句) 4. 光從哪來、照亮哪一側、影子落哪、背景什麼顏色 5. ' + (tl() && headT() ? '標題用哪一款排法(寫編號):1 極簡細字 / 2 底部置中小字 / 3 細線直排小字 / 4 括號標題 / 5 毛玻璃橫條 / 6 瑞士格線大字 / 7 兩行大標 / 9 白邊框 / 10 底部巨大字 / 11 大字加說明 / 12 明體大標 / 15 明體直排 / 16 雜誌跳字 / 17 單側巨字直排 / 18 左右分字 / 20 直排小字 / 21 巨大數字折扣 / 25 底部色帶 / 26 斜貼標籤 / 28 字在主體後面' : '標題放哪、怎麼排'),
      '6. MOZ 等級自查(RA:目前出圖 70 分、MOZ 是 90 分,差在「不讓人驚豔」):場景是不是這件商品真正的世界(文不對題就算再高級也重寫)、物理常識對不對(重力:除非畫面主意本來就是「飄浮」—— RA 的參考圖有海苔飄在天空、MOZ 鞋子懸空,這是刻意的拍法要保留 —— 否則薄的、扁的、軟的東西平放或靠著東西;刻意飄浮時要一看就是故意的:商品在天空或乾淨背景前懸空當主角、下方有柔和影子,不能不上不下地浮在桌面或盤子上方一點點;包裝、塑膠袋、紙盒不會放在烤網或火上,冰品不放在烈日下,商品放的位置是現實中真的會放的地方 —— 不對就改位置)、整張有沒有 AI 感(擺拍空笑、偶像臉、樣品屋、太乾淨、米色濾鏡 —— 有就改成真實瞬間)、商品是不是跟周圍同一道光(色溫、陰影深淺、銳利度一樣,不像貼上去)、主角是不是第一眼就看到(遠景靠光與留白、近景靠大小)、鏡頭距離有沒有照客人選的、有沒有一道看得到影子圖案的方向光、背景是不是一個有決定的顏色(不是米白淺灰)、整張是不是只有一個具體又意想不到的主意;哪一項沒有,回頭改提示詞到有。',
      '【思考】的最後一行固定寫「照片核對:」(RA 11-21:品牌的照片庫是所有商品共用的,客人選了電風扇卻挑到桑拿機的照片,會白花點數做錯商品):照片的主角跟上面寫的商品是同一樣東西 → 寫「照片核對:相符」;照片的主角【明顯是另一樣商品】(商品是電風扇、照片是桑拿機;商品是鞋、照片是外套)→ 寫「照片核對:不符 —— 照片裡是 XXX」(XXX 用中文寫照片裡的東西,十個字以內)。只有非常確定才寫不符:看不出來、同一類商品的不同款式或顏色、服務/課程/空間/人物的照片、沒有附照片,一律寫相符。不管相不相符,提示詞照常寫(長相一律照照片)。',
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
      body: JSON.stringify({ action: 'claude_generate', purpose: 'ad_director', password: (typeof GAS_PASSWORD !== 'undefined' ? GAS_PASSWORD : 'raby2026'), prompt: content, max_tokens: layout ? 3000 : 1700 })
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
      keepGenre(think);
      var out = cut > 0 ? clean(raw.slice(cut + mk).replace(/^\s*[(（][^)）\n]*[)）]\s*/, '')) : '';
      //  v1.4.1 長度只防「壞掉」(空白 / 被截斷),不拿來淘汰好結果 —— 排版圖實測 4,700~5,200 字,v1.4 的 3,600 上限會把它丟掉
      var whole = /[.!?"”」』)）。]\s*$/.test(out);   // 沒有句尾 = 字數用完被截斷 → 當失敗,自動重試
      var ok = whole && out.length >= 200 && out.length <= (layout ? 8000 : 4000);
      return { out: ok ? out : null, think: think, error: ok ? '' : ((j && j.error) || (cut < 0 && raw ? '沒有照「先思考再寫提示詞」的格式' : (!whole && out ? '回覆被截斷' : '長度不對 ' + out.length + ' 字'))) };
    }).catch(function (e) { clearTimeout(tm); return { out: null, error: (e && e.name === 'AbortError') ? '逾時' : String(e && e.message || e) }; });
  }

  function squeeze(text, layout, tgt) {
    var target = tgt || (layout ? 2400 : 1100);
    var ask = '下面是一段要交給' + (tgt ? '影片' : '生圖') + '模型的英文提示詞,太長了。把它壓縮到 ' + target + ' 字元以內:每一句的意思都保留、改成更短的說法,先刪最不重要的形容;描述商品保持照片原樣、畫面上的字的句子一字不改' + (tgt ? ';時間碼 [00:00-00:00] 與 [Image] 標記全部保留、順序不變' : '') + '。只輸出壓縮後的提示詞本身,不加任何說明。\n\n' + text;
    var ctl = new AbortController(), tm = setTimeout(function () { ctl.abort(); }, TIMEOUT_MS);
    return fetch(WORKER, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctl.signal,
      body: JSON.stringify({ action: 'claude_generate', purpose: 'ad_director', password: (typeof GAS_PASSWORD !== 'undefined' ? GAS_PASSWORD : 'raby2026'), prompt: [{ type: 'text', text: ask }], max_tokens: layout ? 1500 : 800 })
    }).then(function (r) { return r.json(); }).then(function (j) {
      clearTimeout(tm);
      var o = clean((j && j.ok && j.text) || '');
      return (/[.!?"”」』)）。\]]\s*$/.test(o) && o.length >= 200 && o.length < text.length) ? o : null;
    }).catch(function () { clearTimeout(tm); return null; });
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
        //  v2.5.3 太長不丟掉(丟掉會退回 2,500 字的草稿,更長、也沒經過美術指導)→ 再請它壓一次,意思保留、字變少
        var lim = layout ? 2600 : 1300;
        if (!x.r.out || x.r.out.length <= lim) return x;
        if (typeof setPrStatus === 'function') setPrStatus('🎬 AI 美術指導精簡提示詞…', 'var(--t3)');
        return squeeze(x.r.out, layout).then(function (sq) { if (sq) { x.long = x.r.out.length; x.r.out = sq; } return x; });
      }).then(function (x) {
        var _ts = 0; try { var _t = tl(); if (_t) { var _m = String(x.r.think || '').match(/(?:^|\n)\s*7[.、．][^\n]*?(\d{1,2})/); if (_m) _ts = Number(_t.suggest(_m[1])) || 0; } } catch (e) {}
        window._adDirectorLast = { textStyle: _ts, at: Date.now(), longBefore: x.long || 0, draft: draft, think: x.r.think || '', final: x.r.out || '', ms: Date.now() - t0, used: !!x.r.out, hadPhoto: !!b64, mode: layout ? 'layout' : 'photo', tries: x.tries, error: x.r.out ? '' : ((x.first ? x.first + ' / ' : '') + x.r.error) };
        return x.r.out;
      });
    });
  }

  //  v2.6 生成紀錄加料:客人當下的輸入 + 美術指導怎麼想 + 送出的提示詞 + 系統草稿
  function logRow(row) {
    if (!row || !/^admaker_/.test(String(row.action || ''))) return row;
    if (row.action === 'admaker_motion') return row;   // 商品運鏡的紀錄由 motionLogRow 加料(v2.8)
    var L = window._adDirectorLast;
    if (!L || !L.at || Date.now() - L.at > 20 * 60000 || L.logged) return row;   // 只用這一次生成的,不拿舊的
    L.logged = true;
    var p = {}; try { p = JSON.parse(row.params || '{}') || {}; } catch (e) {}
    var pr = (window.S && window.S.prod) || {}, ph = (window.S && window.S.photos && window.S.photos[window.S.selPhoto]) || {};
    p.director = {
      ver: VERSION, used: !!L.used, tries: L.tries || 0, error: L.error || '', ms: L.ms || 0,
      draftLen: (L.draft || '').length, finalLen: (L.final || '').length, longBefore: L.longBefore || 0,
      headline: headT(), sub: subT(), note: val('gptStyleDesc'), textLayer: tl() ? 'system' : 'ai',
      textStyle: L.textStyle ? (L.textStyle + ' ' + ((tl() && tl().names[L.textStyle]) || '')) : '',
      realSize: String(pr.realSize || ''), placement: placeLabel(), photo: ph.name || '',
      think: L.think || ''
    };
    row.params = JSON.stringify(p);
    var head = String(row.prompt || '').split('\n\n')[0];
    row.prompt = (/^【客人選擇】/.test(head) ? head + '\n\n' : '')
      + '【美術指導 v' + VERSION + (L.used ? '' : ' ⚠️沒用上:' + (L.error || '')) + '】\n' + (L.think || '(沒有思考紀錄)')
      + '\n\n【送給生圖的提示詞】' + (L.final || '(用系統草稿)') + '\n\n【系統草稿】' + (L.draft || '');
    return row;
  }
  function hookLog() {
    var k = window._kolPost;
    if (typeof k !== 'function') return false;
    if (k.__dirLog) return true;
    var w = function (payload) {
      try { if (payload && payload.action === 'gen_log' && payload.row) payload.row = logRow(payload.row); } catch (e) {}
      return k.apply(this, arguments);
    };
    w.__dirLog = true;
    window._kolPost = w;
    return true;
  }
  var lt = 0;
  (function waitLog() { if (hookLog() || ++lt > 80) return; setTimeout(waitLog, 250); })();

  //  ═══ v2.7 商品運鏡影片的 AI 導演 ═══
  function img64(url) {
    return new Promise(function (resolve) {
      try {
        if (!url || typeof window.urlToBlob !== 'function') return resolve(null);
        window.urlToBlob(url).then(function (b) { return createImageBitmap(b); }).then(function (bmp) {
          var k = Math.min(1, 640 / Math.max(bmp.width, bmp.height)), c = document.createElement('canvas');
          c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
          c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
          resolve(c.toDataURL('image/jpeg', 0.82).split(',')[1]);
        }).catch(function () { resolve(null); });
      } catch (e) { resolve(null); }
    });
  }
  function motionBrief(draft, mv, sec) {
    var bc = {}; try { bc = (typeof getBrandContext === 'function') ? (getBrandContext() || {}) : {}; } catch (e) {}
    var p = (window.S && window.S.prod) || {};
    return [
      '你是頂尖商品廣告影片的導演。第一張圖是已經做好的廣告圖(影片的第一格與場景),第二張是客人的原始商品照。',
      '',
      '【商品與客人的選擇】',
      '商品:' + (bc.product || p.name || '(未命名)') + (bc.spec ? ' / 規格:' + bc.spec : '') + (bc.feature ? ' / 特色:' + bc.feature : ''),
      '實際大小:' + (p.realSize || '(客人沒填,從照片判斷)') + (placeLabel() ? ' / 擺放方式:' + placeLabel() : ''),
      '客人選的運鏡:' + (mv.label || mv.key || '') + (mv.hint ? '(' + mv.hint + ')' : '') + ',' + sec + ' 秒',
      '',
      '【系統的運鏡提示詞】(英文,要交給影片模型)',
      draft,
      '',
      '【你的工作】把它改寫成這支商品真的拍得出來的版本。原則:',
      '1. 看懂商品:它是什麼、實際多大、材質軟或硬、哪些部分真的會動(蓋子、掀蓋、拉鍊、扣子、鞋帶、布料),哪些是一體成形不會動。',
      '2. 客人選的運鏡要做到;動作需要商品沒有的條件時(例如沒有蓋子卻要開蓋、硬殼卻要壓縮回彈),換成同一段時間裡、最接近而且這個商品做得到的動作。',
      '3. 鏡頭只帶到廣告圖與商品照裡看得到的面;環繞或轉動的幅度停在看得到的範圍內。',
      '4. 你只改寫有時間碼的那幾行分鏡(其他行是參考圖與商品保護句,系統會原樣保留,你不用輸出);時間碼與段數不變,每段的鏡頭動作寫在最前面,[Image] 標記照原本的寫法。',
      '5. 萬物照重力與材質:有重量、有接觸陰影,軟的會服貼、硬的不變形。畫面裡只有廣告圖裡本來就有的東西。',
      '6. 輸出英文、肯定句,分鏡總長不超過原本分鏡的字數(等量交換:加一句就刪一句)。',
      '7. 動作照物理寫,這是影片看起來真或假的分界:硬的東西動的時候還是硬的(湯匙、筷子、刀、杯腳、扇葉不彎不扭);液體受重力只往下走,倒的時候是一條連續的流柱、落下積成一灘、表面晃動越來越小,不會往上飄、不會憑空變多;蒸氣與煙往上飄、越飄越淡;布料與頭髮跟著動作的方向晚一拍擺動。寫每個動作前先想:這個動作在真實世界會怎麼發生、需要什麼力(誰的手、從哪個方向);寫不出真實的物理過程,就不寫這個動作,動感改交給鏡頭移動與光線移動。影片模型做細長硬物與液體最容易破功,所以這兩類只在畫面主意真的需要時才動,而且動作要慢、要寫清楚物理過程;酒瓶與包裝的標籤保持正面、不繞到背面。',
      '8. 依商品材質想清楚「一動就會假」的地方,換成做得到的動作(所有品牌、所有類型通用):',
      '   · 料理、飲料、醬料:料理與盤、杯留在原位樣子不變;會讓它自己移動、組成、落下、被手推、換場景、微距貼著醬汁滑的,換成慢慢推近、光線移動或前景拉焦。',
      '   · 玻璃、金屬、水晶、鍍鉻(瓶罐、酒杯、頌缽、家電面板):輪廓不扭曲,反光只跟著光源移動;不繞到照片沒拍到的背面。',
      '   · 字、標籤、包裝、螢幕畫面(真空包、禮盒、罐標、面板字、網站):保持正面原樣,不翻面、不推近到要看清每個字、螢幕內容不捲動不重畫;軟包裝照原本的姿態放著。',
      '   · 人、手、臉、蕾絲與細緻布料(內衣、服飾、美業、課程、專業形象):動作慢、幅度小,手指不碰細節,臉不換人、表情只有小變化,蕾絲與花紋照原圖不重畫。',
      '   · 會動的零件(扇葉、按摩頭、蓋子、拉鍊):只有照片裡真的有的零件才動,扇葉整片一起轉不變形;沒有的蓋子不打開。',
      '   · 細碎的自然物與串飾(牧草、香草、花瓣、串珠、手串):一根一顆都留在原位,不重新排列、不飄散。',
      '   · 敲擊、聲音、震動、水波、氣場這類看不見的效果(頌缽、能量商品、命理):不畫出來,用光線變化與淡淡的煙或蒸氣帶出氛圍。',
      '   · 硬的單一物件(鞋、包、家電、機台):照原本的招式拍,鏡頭只到照片看得到的面,縫線車線與外型照原圖。',
      '',
      '回覆固定兩段:',
      '【思考】(中文,每項一句)1. 這是什麼、多大、軟硬 2. 哪些部分會動 3. 廣告圖看得到哪幾面 4. 客人選的運鏡做不做得到、要怎麼調 5. 每個會動的東西,真實世界裡是怎麼動的(力從哪來、重力往哪拉、硬的軟的各怎麼反應);寫不出物理過程的動作換成鏡頭或光 6. 這支影片的主意',
      '【提示詞】  ← 這一行標記一定要寫',
      '(只寫改好的分鏡,一段一行,每行以時間碼開頭)'
    ].join('\n');
  }
  async function directMotion(draft, mv, sec, mainUrl, posterUrl) {
    var t0 = Date.now(), L = { draft: draft, at: t0, move: mv.key || '' };
    window._motionDirectorLast = L;
    try {
      var a = await img64(posterUrl), b = await img64(mainUrl), content = [];
      if (a) content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: a } });
      if (b) content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b } });
      content.push({ type: 'text', text: motionBrief(draft, mv, sec) });
      var ctl = new AbortController(), tm = setTimeout(function () { ctl.abort(); }, TIMEOUT_MS);
      var r = await fetch(WORKER, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctl.signal,
        body: JSON.stringify({ action: 'claude_generate', purpose: 'ad_director', password: (typeof GAS_PASSWORD !== 'undefined' ? GAS_PASSWORD : 'raby2026'), prompt: content, max_tokens: 1800 }) });
      clearTimeout(tm);
      var j = await r.json(), raw = String((j && j.ok && j.text) || ''), cut = raw.lastIndexOf('【提示詞】');
      L.think = cut > 0 ? raw.slice(0, cut).replace(/^[\s\S]*?【思考】/, '').trim() : '';
      //  v2.7.3 只收時間碼開頭的分鏡行;參考圖與保護句由系統原樣保留(實測 Claude 會把 [Image3] to [Image7] 改寫法 → 標記不見)
      var TC = /^\[\d\d:\d\d-\d\d:\d\d\]/;
      var dl = draft.split('\n'), oldShots = dl.filter(function (x) { return TC.test(x); });
      var newShots = (cut > 0 ? raw.slice(cut + 5) : '').split('\n').map(function (x) { return x.trim(); }).filter(function (x) { return TC.test(x); });
      var oldLen = oldShots.join('\n').length, newLen = newShots.join('\n').length;
      var codesOk = newShots.length === oldShots.length && oldShots.every(function (x, i) { return newShots[i].slice(0, 13) === x.slice(0, 13); });
      if (codesOk && newLen > oldLen + 80) {   // 太長 → 再壓一次,壓完重新驗收
        if (typeof setPrStatus === 'function') setPrStatus('🎬 AI 導演精簡運鏡…', 'var(--t3)');
        L.longBefore = newLen;
        var sq = await squeeze(newShots.join('\n'), false, oldLen);
        var sqShots = sq ? sq.split('\n').map(function (x) { return x.trim(); }).filter(function (x) { return TC.test(x); }) : [];
        if (sqShots.length === oldShots.length && oldShots.every(function (x, i) { return sqShots[i].slice(0, 13) === x.slice(0, 13); })) { newShots = sqShots; newLen = sqShots.join('\n').length; }
      }
      var out = '';
      if (!newShots.length) L.error = '沒有照格式回覆';
      else if (!codesOk) L.error = '分鏡段數或時間碼不對(' + newShots.length + '/' + oldShots.length + ')';
      else if (newLen > oldLen + 200) L.error = '分鏡太長 ' + newLen + ' > ' + oldLen;
      else { var si = 0; out = dl.map(function (x) { return TC.test(x) ? newShots[si++] : x; }).join('\n'); }
      L.ms = Date.now() - t0;
      if (L.error) { console.warn('[AI 導演 · 商品運鏡] 沒用上(' + L.error + '),用原本的運鏡'); return draft; }
      L.final = out; L.used = true;
      console.log('[AI 導演 · 商品運鏡] ' + draft.length + ' → ' + out.length + ' 字 · 思考:\n' + L.think);
      return out;
    } catch (e) { L.error = (e && e.name === 'AbortError') ? '逾時' : String(e && e.message || e); console.warn('[AI 導演 · 商品運鏡] 略過:', L.error); return draft; }
  }
  //  v2.8 商品運鏡的生成紀錄加料:AI 導演怎麼想 + 真正送出的運鏡 + 系統草稿(後台「看詳細」跟廣告圖同一個畫面)
  function motionLogRow(row) {
    var L = window._motionDirectorLast;
    if (!row || row.action !== 'admaker_motion' || !L || !L.at || Date.now() - L.at > 30 * 60000 || L.logged) return row;
    L.logged = true;
    var p = (row.params && typeof row.params === 'object') ? row.params : {};
    if (typeof row.params === 'string') { try { p = JSON.parse(row.params) || {}; } catch (e) { p = {}; } }
    p.director = {
      ver: VERSION, kind: 'motion', used: !!L.used, tries: 1, error: L.error || '', ms: L.ms || 0,
      draftLen: (L.draft || '').length, finalLen: (L.final || '').length, longBefore: L.longBefore || 0, think: L.think || ''
    };
    row.params = (typeof row.params === 'string') ? JSON.stringify(p) : p;
    var lt = { ad: '照廣告圖' }[p.light] || p.light || '照廣告圖';
    row.prompt = '【客人選擇】運鏡:' + (p.label || p.move || L.move || '') + ' · ' + (p.sec || '') + ' 秒 · 光線:' + lt
      + '\n\n【美術指導 v' + VERSION + ' · 商品運鏡' + (L.used ? '' : ' ⚠️沒用上:' + (L.error || '')) + '】\n' + (L.think || '(沒有思考紀錄)')
      + '\n\n【送給生圖的提示詞】' + (L.final || L.draft || row.prompt || '')
      + '\n\n【系統草稿】' + (L.draft || '');
    return row;
  }
  //  送出那一刻接手:只動 kol-proxy 的 seedance_submit、而且是商品運鏡(kolName 開頭「商品運鏡_」)
  function hookMotion() {
    if (window.fetch && window.fetch.__motionDir) return;
    var orig = window.fetch;
    var w = async function (input, init) {
      try {
        var u = (typeof input === 'string') ? input : ((input && input.url) || '');
        var body = init && typeof init.body === 'string' ? init.body : '';
        if (/kol-proxy/.test(u) && body.indexOf('admaker_motion') >= 0 && body.indexOf('gen_log') >= 0) {
          var g = JSON.parse(body);
          if (g.action === 'gen_log' && g.row && g.row.action === 'admaker_motion') { g.row = motionLogRow(g.row); init = Object.assign({}, init, { body: JSON.stringify(g) }); }
        }
        if (window.MOTION_DIRECTOR !== false && /kol-proxy/.test(u) && body.indexOf('seedance_submit') >= 0 && body.indexOf('商品運鏡_') >= 0) {
          var b = JSON.parse(body);
          if (b.action === 'seedance_submit' && /^商品運鏡_/.test(String(b.kolName || '')) && b.prompt && !b._md) {
            b._md = 1;   // 同一筆只想一次(fetch 被別的檔案再包一層時,不會重複)
            var key = String(b.kolName).replace(/^商品運鏡_/, '');
            var mv = (((window.AdMotion && window.AdMotion.MOVES) || []).filter(function (m) { return m.key === key; })[0]) || { key: key };
            if (typeof setPrStatus === 'function') setPrStatus('🎬 AI 導演看商品、調整運鏡中…', 'var(--t3)');
            b.prompt = await directMotion(b.prompt, mv, Number(b.duration) || 10, (b.productImageUrls || [])[0], b.kolImageUrl);
            if (typeof setPrStatus === 'function') setPrStatus('送出影片任務...', 'var(--t3)');
            init = Object.assign({}, init, { body: JSON.stringify(b) });
          }
        }
      } catch (e) { console.warn('[AI 導演 · 商品運鏡] 接手失敗,照原樣送出:', e && e.message); }
      return orig.call(window, input, init);
    };
    w.__motionDir = true;
    window.fetch = w;
  }
  hookMotion();
  //  v2.7.2 實測:Errlog.js 等檔案晚一步再包 fetch,我們被包在裡面看不出來 → 客人按「商品運鏡」那一刻再確認一次,保證走得到
  (function hookPicker() {
    var f = window.posterToVideo;
    if (typeof f !== 'function') { setTimeout(hookPicker, 800); return; }
    if (f.__motionDir) return;
    var g = function () { hookMotion(); return f.apply(this, arguments); };
    g.__motionDir = true;
    window.posterToVideo = g;
    setTimeout(hookPicker, 3000);   // 被別的檔案換掉時再包回來
  })();

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

  //  v2.20 照片跟商品對不上時的確認框(不用瀏覽器內建的 confirm:那個會卡住頁面,手機上也醜)
  //   同一個商品按過「照這張做」→ 這次開頁不再問(餐廳常把整本菜單的照片放在同一個商品底下,每張都問會很煩)
  function photoMismatchAsk(what) {
    return new Promise(function (resolve) {
      var p = (window.S && window.S.prod) || {}, key = 'bs_pm_ok_' + ((window.S || {}).brandId || '') + '_' + (p.id || p.name || '');
      try { if (sessionStorage.getItem(key)) return resolve(true); } catch (e) {}
      var old = document.getElementById('adPhotoMismatch'); if (old) old.remove();
      var w = document.createElement('div'); w.id = 'adPhotoMismatch';
      w.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;padding:16px';
      var esc = function (t) { return String(t || '').replace(/[<>&"]/g, function (c) { return { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]; }); };
      w.innerHTML = '<div style="max-width:420px;width:100%;background:#16161f;border:1px solid #7c6dfa;border-radius:14px;padding:18px 18px 14px;color:#e8e8f0;font-size:14px;line-height:1.6;box-shadow:0 0 24px rgba(124,109,250,.35)">'
        + '<div style="font-weight:700;font-size:15px;margin-bottom:8px">⚠️ 這張照片好像不是這個商品</div>'
        + '<div>您選的商品是「<b>' + esc(p.name || '(未命名)') + '</b>」,但這張照片看起來是「<b>' + esc(what) + '</b>」。</div>'
        + '<div style="color:#9a9aa8;font-size:12.5px;margin-top:6px">廣告圖會照「照片裡的東西」做。還沒扣點。</div>'
        + '<div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">'
        + '<button id="adPmBack" style="flex:1;min-width:140px;padding:10px;border-radius:10px;border:0;background:linear-gradient(90deg,#7c6dfa,#fa6d9b);color:#fff;font-weight:700;cursor:pointer">換一張照片</button>'
        + '<button id="adPmGo" style="flex:1;min-width:140px;padding:10px;border-radius:10px;border:1px solid #3a3a4a;background:transparent;color:#e8e8f0;cursor:pointer">照這張照片做</button>'
        + '</div></div>';
      document.body.appendChild(w);
      var done = function (v) { try { if (v) sessionStorage.setItem(key, '1'); } catch (e) {} w.remove(); resolve(v); };
      document.getElementById('adPmBack').onclick = function () { done(false); };
      document.getElementById('adPmGo').onclick = function () { done(true); };
    });
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
            //  v2.20 照片核對:美術指導看出照片不是客人選的那個商品 → 出圖、扣點之前先問一次
            try {
              var _pm = String(L.think || '').match(/照片核對\s*[:\uFF1A]\s*不符[\s—\-–,,:\uFF1A]*(?:照片裡是)?\s*[「『"]?([^\n。」』"]{1,24})/);
              if (_pm && !(await photoMismatchAsk(_pm[1]))) {
                pending = null;
                if (typeof setPrStatus === 'function') setPrStatus('已取消:請在上面換一張這個商品的照片再生成(沒有扣點)', 'var(--t3)');
                return;
              }
            } catch (_e) {}
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

  window.AdDirector = { directMotion: directMotion, logRow: logRow, version: VERSION, direct: direct, brief: brief, mozType: mozType, ensureBuild: ensureBuild, styleType: styleType };
  console.log('[AdDirector] v' + VERSION + ' AI 美術指導已載入(關閉:window.AD_DIRECTOR = false)');
})();
