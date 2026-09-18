// ════════════════════════════════════════════════════════════════════
//  kol-cinematographer.js · v5.28
//
//  v5.28 變更(抓拍感六槓桿補完·⑤光不完美 ⑥保留微光):
//   • RA 實測證據:2026-08-02 那支「像手機藏鏡人拍的」測試片,跑的是
//     跟現在完全相同的 code,她只在「劇情/情境」欄貼了一段文字,
//     裡面就含「窗光從單側灑進來一邊臉稍暗」+「自然膚質保留一點點光澤」
//     —— 結果不油、不烤肉紋。
//     ★結論:⑤⑥ 早就跟 REALISM_BASE 的 gentle low-contrast 同時存在過,
//       不互斥、不會變油。所以可以進程式,客戶不必手打。
//   • 用法上刻意「只加不減」:REALISM_BASE 一字不改(防油光/防烤肉紋的
//     既有措辭全部保留),只把 RA 驗證過的那兩句直譯加進 CANDID_FRAME。
//     不自己另外發明講法 —— 措辭本身就是被驗證過的資產。
//
//  v5.27 變更(抓拍感·手持不完美):
//   • 新增 CANDID_FRAME:把「手持感」從抽象形容詞升級成具體指令。
//     原本 REALISM_BASE 只寫 handheld iPhone vlog aesthetic / candid
//     unscripted moments —— 那是「形容詞」,引擎不會真的把畫面拍歪,
//     結果就是完美置中、腳架級穩定 = 一眼 AI 廣告。
//     這條給的是可執行的指令:略偏中心、輕微手持漂移、不刻意對稱。
//   • ⚠️ 只加「取景」層,絕不碰膚質/光線。防油光的錨在 kol-stitch v6.20,
//     不在這支(v5.26 為打 422 已把膚質句拔掉)——別在這裡重複。
//   • 🔌 保險絲 window.KOL_CANDID:預設 true;設 false 立刻回到工整取景
//     (例如給不懂「刻意拍歪」的審核方看時)。
//  
//  📷 攝影師 — 鏡頭、自然光、運鏡、電影寫實
//
//  💡 2026-09-13 v5.33:拿掉「那盞不存在的燈」(治割裂感·RA 定調)
//
//  🩳 2026-09-13 v5.34:砍重複(RA 指出:都看到重複了還不改)
//   ★ 背景:實測單段 prompt 3762 字,其中【五鎖骨架 1381 字佔 37%】,
//     而真正在講「她要做什麼」的分鏡動作只有 421 字(11%)。
//     規則把內容擠掉了 —— 商品鐵律 10 條只送出 4 條,被丟掉的正是
//     「環境要活著」那組。加規則不只自己沒力,還會把別條擠出預算。
//   ★ 砍的標準只有一條:【能用圖鎖的,就不要用字鎖】(資產永遠贏過提示詞)。
//   ① not a 3D render / not CGI / not a video-game environment(50字)
//      → 三句同一件事,而且第 1 句已經說了 genuine real-world location。
//        併成 not CGI or a game render。
//   ② 家具窗戶位置固定、不准移動消失(188字)→ 整條刪。
//      九宮格 [SCENE_IMG] 圖已經在鎖結構;今天 crew-director v5.38 才因為
//      同樣理由砍掉 'the room stays fixed' —— 這裡是同一句話的第二份。
//   ③ 'its furniture, fixtures, lights and the street beyond the window'(75字)
//      → 是前一句「背景柔但完全可讀」的破碎重複,而且又寫死了【窗外街道】,
//        跟 v5.38 砍掉的那條犯同一個錯(無塵室/地下室沒有窗)。
//   ⚠️ 光源同源那組(v5.33)、色調統一、邊緣融合、主體清晰、無人群 —— 全部保留。
//     v5.33 實測有效:人比環境暖 0.92 → 0.55,禁止在瘦身時誤砍。
//   ★ 病灶不是色溫差多少,是【光源根本不同源】——
//     她臉上那層光,在畫面裡找不到任何一盞燈對應得上。
//     所以不是「站在咖啡廳」,是「被放在咖啡廳前面」。
//   ★ 兇手是 SCENE_REALISM 第 5 句 'soft diffused natural lighting':
//     它叫模型【先給她一層通用柔光】,不管房間是什麼光;
//     第 6、7 句才補「要跟房間一樣」—— 兩句打架,而且第 5 句排在前面權重更高。
//     結果:她自帶一盞燈,房間的光只在上面刷一下。實測色溫落差 +0.92(鞋店基準 +0.40)。
//   ★ 修法是【拿掉打架的那一方】,不是再加一條規則(RA 規律)。
//     改成指定來源:只能被這個房間裡看得見的燈和窗照到,沒有第二組光源,
//     它們打在牆上桌上的顏色,就是打在她臉上的顏色;
//     她臉上不該有任何在畫面裡找不到來源的光。
//   ★ 黃燈就黃燈、白光就白光、夕陽就夕陽 —— 環境是什麼光,人就是什麼光。
//   ⚠️ 全程只用色彩/光源詞,不碰 contact shadow / light field / optical depth /
//     spilling —— 那些是 v5.17 驗過的烤肉紋兇手,禁止復活。
//   ⚠️ 仍有殘留衝突:kol-stitch 的防油光鐵律(v5.22 原文)也含
//     'soft diffused natural light'。那是鐵律不得改寫 —— 若本版效果不足,
//     下一步是把鐵律那句【搬到末尾】(詞序法),不是刪字。
//   ★ 驗收:她臉上的每一塊光,都要能在畫面裡指出是哪個光源造成的。
//  
//  v5.26 變更(prompt 減重·打 422):
//   • 三處瘦身共省 ~300 字元,語意零犧牲:AUDIO_REALISM 濃縮、
//     手機色彩縮句、拔 REALISM_BASE 與眼神塊/劇組打光線重複的膚質句
//     (霧面/無油光在 stitch 眼神塊仍完整存在;柔光在 crew ③打光仍在)
//   • 動機:單段 prompt ~6400 字元撞引擎上限(422),今日+390 是壓垮稻草
//
//  v5.25 變更(⑤ RIIV 寫實·fal 官方 UGC anti-slop 植入):
//   • REALISM_BASE 補「手機色彩性格」:the warm faintly oversaturated
//     color of a good phone camera + no studio polish
//     → 給畫面「好手機隨拍」的色彩指紋,打「乾淨到假」。
//     ⚠️ 是色調性格,不是微觀紋理、不是硬光 → 不碰烤肉紋雷區。
//   • 🆕 AUDIO_REALISM 音訊反罐頭層(fal 官方 anti-slop 核心):
//     只要現場音 + 室內底噪 + 乾淨人聲,明確禁 BGM/配樂/jingle。
//     模型自動配的罐頭廣告樂 = 最大 AI 味來源之一。
//     ⚠️ 全域生效:STEP2 單鏡頭也吃到(分鏡 Rule 21 只護 STEP3)。
//     ⚠️ 以後若要做「純氛圍配樂片」,回來拔這層。
//
//  v5.24 變更(⑤ RIIV 寫實·打「背景假假的」):
//   • 新增 SCENE_REALISM 場景落地錨,跟 REALISM_BASE 分開管:
//       REALISM_BASE = 管「人/膚質/不修圖」
//       SCENE_REALISM = 管「場景不假 + 人落進場景 + 整支統一色調」
//   • 三因對症:
//       (a)場景太理想化 → real-world location / not CGI / not 3D render
//       (b)貼上去感   → 人和背景「共用同一套色調+環境色溫」讓她落進場景,
//                       ⚠️ 用色調+環境光「氛圍」整合,不是硬光打臉 → 不破壞防烤肉紋
//       (c)兩張圖合成感 → one continuous photographic frame / unified grade
//   • 借 Riiv:no crowd / no stylized CGI / premium cinematic realism / 統一色調。
//   • contribute() 現在同時吐 REALISM_BASE + SCENE_REALISM。
//   ⚠️ 嚴守:不加任何微觀紋理(pores/peach fuzz/film grain/hair strands)、
//      不加邊緣融合(contact shadows/light field/optical depth/spilling/motion blur)、
//      不加 perfect/flawless/studio/commercial —— 這些是你驗過的烤肉紋兇手。
//
//  v5.19 變更(室內烤肉紋根因):
//   • 拔掉「正向瑕疵詞」realistic uneven skin tone / slight blemishes /
//     skin imperfections —— 室內硬光會放大成一條一條。改成「照參考照」+ 負向。
//  v5.18:Taiwanese Mandarin accent 放回(誤拔造成又晴中國腔)。
//  v5.17:拔掉整包「光學/光場/邊緣融合」干擾(烤肉網主兇)。
// ════════════════════════════════════════════════════════════════════

(function () {
  'use strict';

  // 🎯 攝影風格基底 — 管「人/膚質/不修圖」(靈魂留、干擾拔)
  //   v5.25:尾段補手機色彩性格(warm faintly oversaturated)+ no studio polish
  // 🤳 抓拍感·手持不完美(v5.27)— 只管「取景」,不含任何膚質/光線詞
  //   刻意極簡:prompt 長度是稀缺資源(v5.26 才為 422 減重),
  //   所以只留三個引擎真的吃得動的具體指令,不寫抽象形容詞。
  //  ⑤ 光不完美 + ⑥ 保留微光 一起放進來(v5.28)——
  //    兩句都是 RA 2026-08-02 那支成功測試片用過的原話直譯,不是新發明。
  //    ⚠️ 絕不寫 oily / specular / shine highlight 這類字,那會把防油光推翻;
  //      「faint natural sheen」是 UGC 圈驗證過的講法:留真皮膚的微光澤,
  //      不是留油光。全平面霧面反而更假(RA 鐵律:只拔油光·別把光全消)。
  // 🎥 2026-09-12 v5.30:取景是【攝影師的職責】,分鏡卡的景別只決定遠近,
  //   不決定「正不正」。RA 實測:前 15 秒偏移有生活感,後 15 秒置中正面像形象照 ——
  //   差別在分鏡卡寫了「中景」之後,模型把人擺回畫面正中央對稱構圖。
  //   ★ 補一句把兩層的分工講明:景別可以由分鏡卡決定,
  //     但【不對稱、不置中、手持漂移】在任何景別下都成立。
  const CANDID_FRAME = // 📱 2026-09-12 v5.31:手持從「微小漂移」改成【有人拿手機跟拍】
  //   ★ 病(RA 指出):她要的 iPhone 是「像真人手持、會移動會晃」,
  //     舊寫法只有 tiny handheld drift(微小漂移),模型理解成「幾乎不動」,
  //     結果 15 秒固定機位 = 視訊鏡頭。
  //   ★ 對照基準片(鞋店):鏡頭在移動、被貨架切掉、失焦再對到,
  //     那是【跟拍】不是【架著微微抖】,差一個量級。
  //   ★ 改法:第一句先宣告「有人拿手機跟著她拍」——
  //     跟九宮格 v5.28 同一招:先定類型,再講細節。
  //   ⚠️ 不寫具體運鏡指令(推軌/環繞/變焦)。Seedance 官方指南明寫
  //     「只下一個主要運鏡指令」,多條會互相衝突造成畫面抖動變形。
  'someone is filming her on a phone, walking with her and keeping up \u2014 '
    + 'the frame breathes and drifts, tilts a little, reframes to catch her, '
    + 'focus slips for a moment and settles again; she is off-centre and often clipped by the frame edge, never symmetrical'
    + ', this off-centre handheld framing holds at every shot size, close or wide, she is never centred and squared to the lens'
    //  💡 v5.27:單側光那句【保留】—— 它是段2平光(光差 0.6)的解藥,
    //     而且跟 SCENE_REALISM 的「亮側朝向光源」同源,不是重複是同一條鏈的兩端。
    //     ⚠️ 但 crew-director 裡還有一句 'keep the light on her face soft and even'
    //        正面否定它(要均勻 vs 要不均勻),那句已在 v6.53/v6.54 被 kol-stitch 殺過兩次,
    //        crew-director 是第三份 —— 那是【另一個檔】,要一起處理才會生效。
    + ', window light from one side only so one side of her face falls slightly darker, not evenly lit'
    //  🧴 v5.27:刪 'visible pores' —— RA 2026-09-13 定調:毛孔是【具體物件】,
    //     模型會去【畫】,畫出來規律均勻 → 3D 建模/遊戲角色感(v5.17/v5.19 實測是烤肉紋兇手)。
    //     只能寫【紋理】(表面性質,模型只會保留),不能寫毛孔。這裡是漏網的那一份。
    + ', her skin carrying its own texture rather than reading as one smooth film, small imperfections';

  //  ═══════════════════════════════════════════════════════════════
  //  🧹 v5.27(2026-09-14)逐句盤點後瘦身 —— 砍的是【打架】與【被別句涵蓋】,機制一條不少。
  //   ★ 刪 'warm slightly saturated phone-camera color':
  //     它要求偏暖偏飽和,正面抵銷色板師的 muted understated / nothing boosted。
  //     RA 實測飽和度 30-35%,客戶真實短影音只有 18.9-27.7% —— 這句是其中一個來源。
  //   ★ 邊緣四句(soft edges / no hard cutout / no over-sharpened / not pasted-on)
  //     講的是同一件事,併成一句。
  //   ★ 'Taiwanese Mandarin accent, natural lip sync' 移除:對嘴行每段都寫一次,
  //     這裡是第二份(RA 鐵律①:同一件事兩份,改一份等於沒改)。
  //   ★ 保留不動:照原圖不磨皮那五句(防油光鐵律,RA 2026-09-13 量過證明無罪,不得改寫)。
  //  ═══════════════════════════════════════════════════════════════
  const REALISM_BASE = 'handheld iPhone vlog aesthetic, 35mm equivalent lens, natural available light, keep her skin exactly like the reference photo, absolutely no beauty filter, no smoothing, no skin retouching, an ordinary real person not a polished model or commercial, authentic documentary realism, her edges soft and lit into the scene rather than cut out or sharpened, gentle low-contrast natural lighting, no studio polish, Taiwanese Mandarin accent, candid unscripted moments';

  // 🎬 場景落地錨 — 管「場景不假 + 人落進場景 + 統一色調」(⑤ 打背景假假的)
  //   ⚠️ 全程不碰微觀紋理 / 邊緣融合 / 硬光 → 不會長烤肉紋。整合靠「色調+環境色溫」。
  // 🚶 2026-09-12 v5.32 💡光要同方向+眼球映出房間的窗燈形狀+邊緣要被光照到(治割裂/貼上去) · v5.31 📱手持改「有人拿手機跟拍」(治固定機位15秒=視訊鏡頭) · v5.30 🔍背景柔但讀得懂(治鏡頭一近背景就糊成色塊)+🎥取景不對稱在任何景別都成立(治置中正面像形象照) · v5.29:範圍縮小,不是拿掉。
  //   ★ 病:舊寫法 'no crowd, no extra background people' ——
  //     第二半把【所有】背景人物禁死了。而 kol-crew-director 同時在另一層
  //     叫模型加遠景客人 —— 兩層直接對打,禁止那句又短又明確,模型聽它的。
  //     RA 2026-09-12:「以前早期影片咖啡廳會有其他人、窗外還有車」——
  //     這句就是後來消失的原因。今天在 crew-director 加了兩輪規則都沒用,
  //     因為病灶根本不在那個檔案。
  //   ★ 保留的:不要人擠人(會蓋掉 KOL)、不要有人靠近她或看鏡頭。
  //   ★ 放行的:遠景、失焦、做自己事的店員與客人。
  //   ⚠️ 微觀紋理與邊緣融合一個字不動 —— v5.17/v5.19 驗過的烤肉紋兩個兇手。
  // 🔍 2026-09-12 v5.30:背景不再「減少細節」,改「柔但讀得懂」。
  //   ★ 病(RA 2026-09-12 兩段對照實測):同一支影片,前 15 秒背景讀得懂
  //     (木桌、椅子、吊燈、櫃檯、窗外的街)→ 真;後 15 秒鏡頭推近,
  //     背景糊成色塊 → 假、像形象照。
  //   ★ 病因就是這句自己下的指令:'shallow depth-of-field with reduced detail'。
  //     她站得遠時這條作用有限;鏡頭一近,它就全面接管 ——
  //     把生活痕跡、光的層次、剛放行的背景人物【全部一起糊掉】。
  //     等於我在同一行前半放行路人,後半又把他們糊成一團。
  //   ★ 改法:主體仍最清楚(不搶焦點的目的保留),但背景要 readable ——
  //     「柔」跟「看不出是什麼」是兩件事,以前混在一起講。
  //   ⚠️ 不寫 bokeh / blur 強度詞,也不碰微觀紋理與邊緣融合(烤肉紋兇手)。
  // 💡 2026-09-12 v5.32:光要【同方向】,不只是同色溫(治「人像貼上去的」)
  //   ★ 病(RA 同事 2026-09-12):人跟背景像兩層疊上去的。
  //     放大看:她臉上的光是正面均勻的暖光,背景的暖光卻來自左後方檯燈 ——
  //     【光源方向對不上】。色溫接近但方向不同,大腦一眼就看得出是兩張圖。
  //   ★ 舊寫法只鎖 colour temperature + colour grade,沒有鎖【方向】。
  //     方向比色溫更關鍵:色溫差一點像調色,方向差一點就是兩個空間。
  //   ★ 同時補上眼球反射 —— 眼睛裡該映出這個房間的窗和燈的【形狀】,
  //     而不是隨機亮點。這跟 kol-ai-generator v3.44 是同一件事的兩端:
  //     那邊決定臉圖的光,這邊要求影片把她重新打進場景的光裡。
  //   ★ 最後一句管邊緣:貼上去的痕跡就在輪廓,要求邊緣是被光照到的,不是切出來的。
  //  ═══════════════════════════════════════════════════════════════
  //  💡 v5.27:光學核心【全留】—— 這是 RA 2026-09-13 量出來治「粉感」的那一條鏈:
  //     光可追溯到畫面裡的光源 → 多光源各自把顏色打在她臉上 → 膚色色相散布上去 → 粉感消失。
  //     驗收數字:膚色色相散布 1.69 → 2.3(鞋店 2.348);膚色與環境色偏差 1.02 → 0.4。
  //   ★ 公版化:'in this room' → 'in this place'(RA 拍板 2026-09-14)。
  //     機制一字未改,只把場所寫死的字換成中性詞 —— 夜市、車上、無塵室都要成立。
  //   ★ 刪 'the subject is the sharpest thing in frame while the background stays gently soft':
  //     那是景深描述,kol-stitch 明文禁止寫景深/虛化(寫了會跟攝影設定打架)。同檔兩條互相否定。
  //   ★ 刪 'no crowd and nobody close to her or facing the lens':tail 已有同義句,第二份。
  //   ★ 刪 'and where she meets the background the edge is soft and lit, never cut out':
  //     REALISM_BASE 的邊緣句已涵蓋。
  //  ═══════════════════════════════════════════════════════════════
  const SCENE_REALISM = 'a genuine real-world location with authentic materials surfaces and natural imperfections, not CGI or a game render, natural everyday documentary look, she is lit only by the lamps and windows that are actually visible in this place and by nothing else, there is no separate light on her alone, whatever colour those lamps and windows cast on the walls surfaces and floor is the same colour they cast on her face and hands, no light may appear on her that cannot be traced to something visible in the frame, the lit side of her face turned toward wherever the light in this place comes from and the shadow side away from it, the windows and lamps of this place reflected in her eyes as the same shapes they really are; she and the background share one colour grade, no stylized or exaggerated artificial elements';

  // 🔊 音訊反罐頭層 — v5.25 新增(fal 官方 anti-slop:罐頭配樂 = 最大 AI 味來源之一)
  //   只要「這個畫面裡真的會有的聲音」:現場動作音 + 環境底噪 + 乾淨人聲。
  //   明確禁配樂 —— 不寫,模型就自動配一首廣告罐頭樂壓在台詞上。
  //   ⚠️ 全域生效;之後若要做純氛圍配樂片,把 contribute() 裡這行拔掉即可。
  //  🔉 v5.27:'no background music / no soundtrack / no jingle' 是同一件事講三次 → 留一句。
  const AUDIO_REALISM = 'only the natural ambient sound of the location, her voice clear and upfront, absolutely no background music of any kind';

  // 🎥 運鏡元資料
  const CAMERA_MOVEMENTS = {
    static: {
      label: '📷 靜態說話',
      hint: '站在原地講話',
      duration_suggest: 5,
      fallback: 'static tripod framing with subtle handheld breathing, subject speaks directly to camera in place',
    },
    walk_through: {
      label: '🚶 走動轉場',
      hint: '空間移動 · 生活感',
      duration_suggest: 10,
      fallback: 'subject walks slowly through the space, camera performs a smooth handheld tracking shot following her movement, subject turns to face camera mid-walk',
    },
    dolly_in: {
      label: '🎥 慢速推鏡',
      hint: '拉近情緒',
      duration_suggest: 10,
      fallback: 'slow dolly-in toward subject from medium shot to close-up, background softly blurs as camera approaches',
    },
    orbit: {
      label: '🔄 環繞鏡頭',
      hint: '360° 氛圍',
      duration_suggest: 10,
      fallback: 'smooth orbital camera movement around subject, 180-degree arc, subject stays in frame but off-centre',
    },
    pullback_reveal: {
      label: '↖️ 拉鏡揭示',
      hint: '空間感建立',
      duration_suggest: 10,
      fallback: 'camera starts close on subject and slowly pulls back to reveal the entire environment and atmosphere',
    },
  };

  /**
   * 產出攝影段落 = 運鏡(有 movementId 才加)+ 寫實基底 + 場景落地錨 + 音訊反罐頭
   */
  // ═══════════════════════════════════════════════════════════════
  //  🌙 v5.29(2026-09-18)【真的暗的場景才套】夜景曝光 —— RA 對照真人夜露營影片後定調:
  //   病:規則裡從來沒有「夜景該有多暗」這件事。攝影師只寫了「只被現場的燈照亮、
  //     不另外打燈」,但沒說暗部可以暗 → 引擎預設把主角打亮到「看得清楚」為止,
  //     臉比環境亮一截 = 夜間打光感。而 v5.27 又把 film grain 刪了(白天會變髒),
  //     夜景反而需要噪點 —— 真人手機夜拍一定有。
  //   ★ 真人數據(RA 提供的兩支夜露營):主體區亮度 24.6% 與 39.9%,
  //     AI 這支 40.1% —— 不是全錯,是臉太乾淨、暗部沒層次。
  //   ★ RA 定調的啟動條件(不能無差別套,不然白天的片會變髒):
  //     只有【戶外夜晚 / 半夜 / 凌晨 / 沒開燈的室內】才套;
  //     晚上在室內【有開燈】就不套 —— 那跟白天的曝光是一樣的。
  //   ★ 寫法照鐵律:只講事實(暗部是暗的、亮的地方只有那幾盞燈、暗處有噪點),
  //     不寫「不要打光」那種否定句。
  //  ★ v5.29b RA 修正判準:「辦公室加班到半夜,只有一盞燈也要有噪點,因為【光源不足】」——
  //    所以判的不是室內室外,是【這個場景的光夠不夠】。
  const DIM_SCENE = /(夜間|夜晚|晚上|深夜|半夜|凌晨|星空|月光|營火|篝火|燈串|霓虹|檯燈|小夜燈|燭光|螢幕光|只剩一盞|一盞|沒開燈|未開燈|關燈|摸黑|停電|昏暗|微光|night|midnight|dawn|moonlit|candle|lamp-lit)/i;
  const BRIGHT_SCENE = /(明亮|燈火通明|大燈全開|日光燈|白天|晨光|午後|陽光|正午|採光|bright|daylight|sunlit)/i;
  function _isDarkScene(ctx) {
    try {
      const t = [
        ctx && ctx.sceneLabel, ctx && ctx.sceneText, ctx && ctx.sceneName,
        ctx && ctx.scene && (ctx.scene.label || ctx.scene.name || ctx.scene.setting || ctx.scene.env_prompt),
        ctx && ctx.shotDesc, ctx && ctx.beatText,
      ].filter(Boolean).join(' ');
      if (!t) return false;
      return DIM_SCENE.test(t) && !BRIGHT_SCENE.test(t);
    } catch (e) { return false; }
  }
  //  ★ 一句話講完(RA:「提示詞別寫廢話」):光只有現場那幾盞、臉不比周圍亮、暗處有手機噪點。
  const NIGHT_LOOK = 'Low light: only the lamps and fire actually in the scene light this, her face no brighter than what is around her, most of the frame left dark, fine phone sensor noise in the shadows.';

  function contribute(ctx) {
    const parts = [];

    // 運鏡(接片分鏡模式 movementId=null → 不加,交給分鏡卡)
    if (ctx.movementId) {
      const movement = ctx.scene?.movements?.[ctx.movementId]
        || CAMERA_MOVEMENTS[ctx.movementId]?.fallback;
      if (movement) parts.push(movement);
    }

    //  🌙 v5.29:真的暗的場景才加夜景曝光(白天、有燈的室內完全不受影響)
    if (_isDarkScene(ctx)) {
      parts.push(NIGHT_LOOK);
      try { console.log('[Cine] 🌙 夜景曝光已套用(暗部保留 + 手機噪點)'); } catch (e) {}
    }

    // 寫實基底(一定加)· 口音吃 nationality(預設台灣腔,守鐵律)
    const _accent = (typeof window !== 'undefined' && window.natToAccent)
      ? window.natToAccent(ctx.persona?.nationality)
      : 'Taiwanese Mandarin';
    //  🗣 v5.28(2026-09-14)口音錨點補回 + 防呆。
    //   ★ v5.27 的錯:把 'Taiwanese Mandarin accent' 當成「跟對嘴行重複」刪掉了,
    //     但它不只是一句規則 —— 它同時是【這一行 replace 的掛鉤點】。
    //     錨點一刪 → replace 找不到目標 → 整條換口音的路【靜默空轉】,
    //     口音只剩對嘴行那一份在撐。不報錯、看起來正常,正是最難抓的那種壞法。
    //   ★ RA 鐵律:台灣腔錨點絕不可拔(拔了會掉回大陸腔),預設永遠 Taiwanese Mandarin,
    //     非台灣的 KOL 是【換成】他的口音,不是【拿掉】錨點。
    //   ★ 防呆:錨點不在就把口音補在句尾,並在 DEBUG 出聲 —— 以後誰再動 REALISM_BASE,
    //     都不會再變成安靜地不做事。
    const _ANCHOR = 'Taiwanese Mandarin accent';
    let _rb;
    if (REALISM_BASE.indexOf(_ANCHOR) >= 0) {
      _rb = REALISM_BASE.replace(_ANCHOR, _accent);
    } else {
      _rb = REALISM_BASE + ', ' + _accent;
      if (typeof window !== 'undefined' && window.KOL_DEBUG === true) {
        console.log('[KolCinematographer] ⚠️ REALISM_BASE 少了口音錨點「' + _ANCHOR
          + '」→ 已自動把「' + _accent + '」補在句尾。請把錨點加回去,不要靠這個補丁過日子。');
      }
    }
    parts.push(_rb);

    // 🤳 抓拍感取景(v5.27)· 保險絲 window.KOL_CANDID(未設=開)
    //   關掉的方法:Console 打 window.KOL_CANDID = false,或改這支預設值。
    const _candid = (typeof window === 'undefined') || (window.KOL_CANDID !== false);
    if (_candid) parts.push(CANDID_FRAME);

    // 🎬 場景落地錨(一定加)— ⑤ 打背景假假的
    parts.push(SCENE_REALISM);

    // 🔊 音訊反罐頭(一定加)— v5.25 fal anti-slop:禁罐頭配樂,只留現場音
    parts.push(AUDIO_REALISM);

    return parts.join(', ');
  }

  function getMovement(id) {
    return CAMERA_MOVEMENTS[id] || null;
  }

  function listMovements() {
    return CAMERA_MOVEMENTS;
  }

  function suggestDuration(movementId) {
    return CAMERA_MOVEMENTS[movementId]?.duration_suggest || 5;
  }

  // ─── 導出 + 自動向總導演註冊 ─────────────────────────
  window.KolCinematographer = {
    REALISM_BASE,
    CANDID_FRAME,
    SCENE_REALISM,
    AUDIO_REALISM,
    CAMERA_MOVEMENTS,
    contribute,
    getMovement,
    listMovements,
    suggestDuration,
  };

  if (typeof window.REALISM_BASE === 'undefined') {
    window.REALISM_BASE = REALISM_BASE;
  }
  if (typeof window.CAMERA_MOVEMENTS === 'undefined') {
    window.CAMERA_MOVEMENTS = CAMERA_MOVEMENTS;
  }

  if (window.CrewDirector?.register) {
    window.CrewDirector.register('cinematographer', window.KolCinematographer);
  }

  console.log('[KolCinematographer] 📷 v5.29 🌙光源不足才套(判的是光夠不夠,不是室內室外:半夜只有一盞燈的辦公室也算;白天/明亮場景不套)·一句話:光只有現場那幾盞、臉不比周圍亮、暗處有手機噪點 · v5.28 就緒 · 🗣口音錨點補回(v5.27 誤刪→換口音整條空轉·預設永遠台灣腔)+ 找不到錨點自動補句尾並出聲 · v5.27 · 🧹逐句瘦身(刪:偏飽和句/毛孔/景深句/重複邊緣句/重複無配樂/重複台灣腔·全是打架或被涵蓋) · 🌏公版化 in this room→in this place · 💡光學核心與防油光鐵律一字未動 · v5.26 · 瘦身版(去重複句·防撞prompt上限) · REALISM_BASE + SCENE_REALISM + AUDIO_REALISM(禁罐頭配樂) + 台灣腔');
})();
