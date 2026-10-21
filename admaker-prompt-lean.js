// ═══════════════════════════════════════════════════════════════════════
//  admaker-prompt-lean.js · v2.6 (2026-10-22)
//  廣告圖「精簡提示詞引擎」—— 取代 admaker.js 的 buildPosterPrompt(約 7,000 字)
//
//  為什麼:RA 2026-10-22 實測同一張 MOZ 外套照 / 德訓鞋照
//    · 舊版 ~7,000 字 → 姿勢被改、補畫腿和球鞋、背景亂、像 AI 圖
//    · 短版 ~600~1,000 字(C2 範本)→ 「超好看就對了」
//    病根:十幾段規則把每句權重稀釋到沒有。跟 KOL 影片線 9/15、9/18 的鐵律一樣:
//    字數是一把尺、只寫事實、每段長度平均。
//
//  結構(照真的攝影師拍攝,每段一句):
//    ① 主體:照原圖(商品長相 / 模特兒同臉同姿勢)
//    ② 在哪裡拍 + 光從哪來 + 影子落在哪(人和背景被同一道光照到 → 真實感的關鍵)
//    ③ 構圖:主體佔大部分畫面、大膽裁切
//    ④ 情境 / 客人補充:各一句
//    ⑤ 字:字型口氣跟著品牌 Logo 走;品牌字為主、一行小字、不擋主體
//    ⑥ Logo 角落 + 配色 + 質感
//
//  範圍(第一期):類型 = 商品實拍 / 服飾穿搭(有模特兒)/ 未選;
//    版型 = 白棚攝影 / 極簡海報 / 情境寫真 / 雜誌封面 / 手持實拍 / 未選。
//    其他類型(美業、醫美、課程…有法規段)與圖解型版型(規格分解、多格…)照舊走原版。
//
//  保險絲:Console 輸入 window.AD_LEAN = false → 立刻退回舊版 buildPosterPrompt。
//  依賴 admaker.js 的全域:SELECTED_* / LAYOUT_TEMPLATES / REGIONAL_FLAVORS / CONTEXT_THEMES /
//    getBrandContext / detectBrandPack / _adSize / _dropPriceTalk / _dropLogoTalk / _stripPriceFigures
//  載入順序:index.html 在 admaker.js 之後。
// ═══════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  if (typeof window.buildPosterPrompt !== 'function') { console.warn('[AD_LEAN] 找不到 buildPosterPrompt,略過'); return; }
  if (window._buildPosterPromptOrig) return;   // 重複載入保護

  var ORIG = window.buildPosterPrompt;
  window._buildPosterPromptOrig = ORIG;
  if (window.AD_LEAN === undefined) window.AD_LEAN = true;

  var LEAN_TYPES   = ['', 'physical', 'apparel', 'apparel_keep', 'physical_reshoot'];
  var LEAN_LAYOUTS = ['', 'white_studio', 'minimal_poster', 'scene_lifestyle', 'magazine_cover', 'hand_hold'];

  // 真實光源(一個光源 + 方向),每張抽一個
  // v1.1:只留「硬光+具體影子圖案」—— RA 實測:柔光箱/陰天光出來平平的,
  //   55 分 / 超好看那幾張都是直射陽光 + 窗框影子同時落在牆上和主體上({S}=主體)
  var LIGHTS = [
    'afternoon sun through a window on the left',
    'low golden sun through tall windows on the right',
    'morning sun through half-open blinds on the left',
    'sunlight through leaves from the upper left',
  ];
  // v2.0 拍攝企劃(RA 2026-10-22:法則只能保證不出錯,好照片要「一個具體的畫面主意」放最前面)
  //   量尺結果(ruler.py):好圖 = 有顏色的中間調背景 + 硬光 → 飽和 25~35;
  //   壞圖 = 白/灰背景配深色主體 → 飽和 10~20、黑白兩極(明暗範圍 86~91),型錄感。
  //   {S}=主體、{P}=所有格(their/its)
  var CONCEPTS = {
    neutral: [
      'a warm beige plaster wall; hard late-afternoon sun comes through a window, the window-frame shadow falls across the wall and across {S}, and {P} own shadow lies on the wall beside',
      'a sand-coloured stucco wall outdoors; low golden sun rakes across its texture and across {S}, drawing long soft-edged shadows',
      'a pale sage-green painted wall; morning sun through leaves scatters dappled light and shade across the wall and across {S}',
    ],
    cool: [
      'a clear blue sky with a few soft clouds as the only background, seen from slightly below; strong direct sun from the upper left gives {S} crisp highlights and short shadows',
      'a clear powder-blue painted wall; hard sun from the right throws a crisp shadow of {S} onto the wall',
    ],
    warm: [
      'a terracotta-orange painted wall; hard midday sun from the right throws a crisp shadow of {S} onto the wall',
      'a soft pink plaster wall; hard sun from the left lays a long shadow of {S} across it',
    ],
  };
  function conceptFor(colourTxt) {
    var c = String(colourTxt || '').toLowerCase(), pool = CONCEPTS.neutral.slice();
    if (/blue|navy|sky|teal|nordic|aqua/.test(c)) pool = pool.concat(CONCEPTS.cool);
    if (/red|pink|orange|coral|terracotta|peach|magenta/.test(c)) pool = pool.concat(CONCEPTS.warm);
    if (!c) pool = pool.concat(CONCEPTS.cool, CONCEPTS.warm);
    return pick(pool);
  }

  // v2.1 重拍模式(RA 2026-10-22 實測「超屌,就是這個」):服飾 = 商品是衣服,不是原圖的模特兒。
  //   衣服照原樣,模特兒/姿勢/角度/場景全部重新設計 —— 跟 KOL 線一樣是「重新拍」,不是「改圖」。
  //   每一則 = 場景 + 姿勢/動作 + 機位 + 光(Pinterest 那種有一個主意的畫面)
  var RESHOOTS = [
    'shot from very low, looking up at the model against a clear saturated blue sky with a few white clouds; the model sits on top of a sunlit concrete wall, one knee up, hair blown by the wind, laughing toward the camera; strong direct afternoon sun from the left',
    'the model reaches one open hand toward the lens, the hand large and soft in the foreground, the face sharp behind it with a confident half-smile; bright midday sun on a city street, shallow depth of field',
    'the model crouches on a sunny rooftop edge, forearms resting on the knees, looking down into the lens; shot from below against a deep blue sky; hard sun from behind rims the hair',
    'the model leans against a saturated terracotta wall in hard late-afternoon sun, glancing sideways past the camera; a crisp shadow of the model falls on the wall',
    'the model walks toward the camera along an empty sunlit street, mid-stride, hair moving, caught candidly on a long lens; golden low sun from behind',
    'the model sits cross-legged on the floor of a pale yellow seamless studio, one hand in the hair, a hard beam of sunlight from a window cutting across the backdrop and the model',
  ];


  // 沒選風格、品牌也沒寫場景時的實景(都是「一面背景」,人和商品都站得進去)
  var PLACES = [
    'a plain warm plaster wall with a pale floor',
    'a seamless paper backdrop in a soft tone taken from the brand palette',
    'a clean light-wood surface against a smooth off-white wall',
    'a quiet corner of a bright room with one plain wall behind',
  ];

  // v1.2 攝影師層(RA:「拍攝要跟真的攝影師一樣 —— ISO、光圈、富士/NIKON/SONY 拍出來都不一樣」)
  //   每一套 = 機身 + 鏡頭 + 光圈/ISO + 色彩科學/底片。照風格自動挑家族,家族裡隨機一套。
  //   機位與距離一律照原圖(真人模特兒換角度=AI 重畫人、臉會跑;商品換角度=會被放倒)。
  var CAMS = {
    jp:    ['Fujifilm X-T5 with a 35mm f/1.4 lens at f/2, ISO 200, Classic Chrome film simulation: muted teal shadows, soft warm highlights, gentle contrast',
            'Fujifilm GFX 100S with a 63mm lens at f/2.8, ISO 100, Pro Neg Std colour: soft, airy, true-to-life skin'],
    film:  ['Kodak Portra 400 35mm film with a Contax-style 35mm lens, visible fine grain, warm honest skin tones, slightly lifted blacks',
            'Kodak Gold 200 35mm film, natural grain, warm golden cast, real film halation in the highlights'],
    clean: ['Sony A7R V with an 85mm GM lens at f/1.8, ISO 100, 1/500s: crisp clean commercial colour, smooth creamy background falloff',
            'Sony A7 III with a 55mm f/1.8 lens at f/2, ISO 200: natural everyday colour, true-to-life tones',
            'Canon EOS R5 with an RF 50mm f/1.2 at f/2, ISO 100: clean bright colour, natural skin, gentle separation'],
    rich:  ['Nikon Z9 with a NIKKOR Z 50mm f/1.2 S at f/2, ISO 100, 1/400s: rich natural contrast and deep true colour',
            'Leica M11 with a Summilux 35mm at f/2, ISO 200: punchy contrast, dense blacks, editorial bite'],
    studio:['Hasselblad X2D with an 80mm lens at f/5.6, ISO 64: pristine medium-format tones and fine detail',
            'Phase One medium-format back with a 110mm lens at f/8, ISO 50: razor detail, smooth tonal gradation'],
  };
  // v1.7:挑相機看三個來源 —— ① 客人選的風格 ② 沒選風格就看品牌包的攝影風格+氛圍 ③ 版型(白棚=中片幅)
  function camFor(flKey, ly, brandHint) {
    var k = String(flKey && flKey !== 'none' ? flKey : '') || String(brandHint || '');
    if (ly === 'white_studio') return pick(CAMS.studio);
    if (/^jp_|japan|muji|kinfolk|showa|wabi|zen/i.test(k)) return pick(CAMS.jp);
    if (/vintage|retro|americana|film|nostalg|heritage|70s|80s|90s|tw_/i.test(k)) return pick(CAMS.film);
    if (/^kr_|korea|k_|clean|minimal|scandi|nordic|bright|airy|fresh/i.test(k)) return pick(CAMS.clean);
    return pick(CAMS.rich.concat(CAMS.clean));
  }

  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function cut(s, n) { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n).replace(/[,;\s]+\S*$/, '') : s; }
  // v1.10 精華(RA:「不能只抓前面的字,要簡化成大綱/簡介式的精華」)
  //   ① 先拿掉括號裡的補充說明(用途、舉例、對標) ② 去重 ③ 還太長才以「一個完整項目」為單位收,
  //   每一項只留前半(冒號前的名稱),不在字中間截斷。
  function essence(t, n) {
    t = String(t || '').replace(/[(（][^)）]*[)）]/g, '').replace(/\s+([,;，；、.])/g, '$1').replace(/\s+/g, ' ').trim();
    if (t.length <= n) return t.replace(/[,;，；、\s]+$/, '');
    var items = t.split(/\s*[;；\n]\s*|\s*[,，、]\s*/).filter(Boolean), seen = {}, out = [];
    items.forEach(function (x) { var k = x.toLowerCase(); if (!seen[k]) { seen[k] = 1; out.push(x); } });
    var res = out.join(', ');
    if (res.length <= n) return res;
    res = out.map(function (x) { return x.split(/[:：]|\s—\s/)[0].trim(); }).filter(Boolean).join(', ');
    if (res.length <= n) return res;
    var acc = [];
    for (var i = 0; i < out.length; i++) { var h = out[i].split(/[:：]|\s—\s/)[0].trim(); if ((acc.join(', ') + ', ' + h).length > n) break; acc.push(h); }
    return acc.join(', ');
  }
  function val(id) { var el = document.getElementById(id); return (el && el.value || '').trim(); }

  // 品牌包 DNA:配色、字型、場景、光質、氛圍
  function packBits() {
    var out = { colour: '', type: '', scene: '', photo: '', mood: '' };
    try {
      var dna = String((detectBrandPack() || {}).dna || '');
      dna.split('\n').forEach(function (l) {
        var m = l.trim().match(/^-\s*([^:]+):\s*(.*)$/); if (!m || !m[2]) return;
        var k = m[1].toLowerCase(), v = m[2].trim();
        if (/primary brand colou?r|secondary palette|palette/.test(k)) out.colour += (out.colour ? '; ' : '') + v;
        else if (/^typography/.test(k)) out.type = v;
        else if (/background scenes?|^scenes?|setting/.test(k)) out.scene = v;
        else if (/photography style|lighting/.test(k)) out.photo = v;
        else if (/^mood/.test(k)) out.mood = v;
      });
    } catch (_) {}
    if (typeof _dropLogoTalk === 'function') { out.colour = _dropLogoTalk(out.colour) || ''; out.type = _dropLogoTalk(out.type) || ''; }
    // 光質去掉寫死的方向(方向由本次的光源決定)
    out.photo = out.photo.replace(/\b(from\s+)?(the\s+)?(upper|top|lower|bottom)?[-\s]?(left|right)\b/gi, '').replace(/\s{2,}/g, ' ');
    return out;
  }

  // 風格:去掉「Add … flavor:」與相機句,只留「場景與造型」
  function flavorSet(f) {
    var t = String((f && f.flavor) || '');
    if (!t) return '';
    t = t.replace(/^Add\s+/i, '').replace(/\s*flavou?r\s*:/i, ':').replace(/\s*Shot on[\s\S]*$/i, '').replace(/[\s,;.]+$/, '');
    return essence(typeof _dropPriceTalk === 'function' ? _dropPriceTalk(t) : t, 220);
  }

  // 版型:每個版型壓成一句「骨架」(原本 300~1,400 字的版面說明,留住它要的那件事)
  var LAYOUT_ESSENCE = {
    '':              'one photograph built around the subject, with calm open space where words can rest',
    white_studio:    'a studio portrait of the subject on a seamless sweep, the empty space around it giving it room to breathe',
    minimal_poster:  'a poster where the subject and a few words are all there is, held together by generous empty space',
    scene_lifestyle: 'a moment from real life, the subject sitting naturally among the things it lives with, the background softly out of focus',
    magazine_cover:  'a magazine cover, the subject close and confident, the top of the frame open for the title',
    hand_hold:       'a hand bringing the subject toward the camera, the subject sharp up front, the world soft behind',
  };

  function lean() {
    var pt = (typeof SELECTED_PRODTYPE !== 'undefined' && SELECTED_PRODTYPE) || '';
    var ly = (typeof SELECTED_LAYOUT !== 'undefined' && SELECTED_LAYOUT) || '';
    var flavor = (REGIONAL_FLAVORS[SELECTED_FLAVOR] || {});
    var ctxTheme = (CONTEXT_THEMES[SELECTED_CONTEXT] || {});
    var ctx = getBrandContext();
    var pb = packBits();
    var isReshoot = (pt === 'apparel');            // 服飾:重拍(新模特兒、新姿勢)
    var isProdReshoot = (pt === 'physical_reshoot'); // 商品:重拍(新場景、新角度)
    // v2.2 重拍兩種都會在出圖後走「商品校正」第二步(admaker.js 讀這個旗標)
    window._amReshoot = isReshoot || isProdReshoot;
    var isApparel = (pt === 'apparel_keep');       // 服飾:保留原模特兒(只換光與背景)
    var S = isApparel ? 'the people' : 'the product';

    var headline = val('gptHeadline'), sub = val('gptSubHeadline'), note = val('gptStyleDesc');
    var lockColor = (document.getElementById('lockBrandColor') || {}).checked !== false;
    var showMark  = (document.getElementById('showBrandMark') || {}).checked !== false;
    var strip = function (t) { return typeof _stripPriceFigures === 'function' ? _stripPriceFigures(t) : t; };
    var name = String(ctx.product || '').replace(/\b[A-Za-z]{1,5}[-\s]?\d{2,6}[A-Za-z]{0,3}\b/g, '').replace(/\s{2,}/g, ' ').trim();
    var spec = essence(strip(ctx.spec), 160), feat = essence(strip(ctx.feature), 160);
    var sz = (typeof _adSize === 'function') ? _adSize() : { w: 1080, h: 1080 };
    var p = [];

    // v2.0 結構:① 拍攝企劃(具體畫面主意,權重最大,放最前)② 主體一句 ③ 構圖一句
    //   ④ 風格+品牌一句 ⑤ 物理法則兩句(保險)⑥ 相機一句 ⑦ 字一句。約 900~1,300 字。
    if (isProdReshoot) {
      var fsP = flavorSet(flavor);
      var bfP = [essence(pb.mood, 80), essence(ctx.adStyle, 70)].filter(Boolean).join('; ');
      // v2.3:實測只剩一雙(原圖兩雙一黑一黃)→ 明講「照片裡的每一件都在,數量、顏色組合一樣」
      // v2.6 回到 v2.2 的寫法(RA:「我要這個版本」—— 鼠尾草綠牆樹影+駝鹿馬克杯那張)。
      //   v2.3/2.4 加了「照片裡每一件都要在」「舊道具留在原地」→ AI 反而照抄原圖構圖、場景變死板。
      //   數量交給第二步「商品校正」去補(校正會對著原圖把每一件對回來)。
      p.push('The product is the real one in this photo' + (name ? ' (' + name + ')' : '') + ': it keeps its exact shape, panels, colours, materials and logos; small labels and lettering stay exactly as photographed, and where a label is too small to read it stays plain.');
      p.push('A new product campaign photograph: the product stands on a real surface in front of ' + conceptFor(pb.colour).replace(/\{S\}/g, 'the product').replace(/\{P\}/g, 'its') + '. Low camera at product height, the product fills most of the frame.');
      if (fsP || bfP) p.push((fsP ? 'Styling: ' + essence(fsP, 120) + '. ' : '') + (bfP ? 'Brand feel: ' + bfP + '.' : ''));
      if (ctxTheme.context) p.push('Occasion, told through one small real sign: ' + essence(typeof _dropPriceTalk === 'function' ? _dropPriceTalk(ctxTheme.context) : ctxTheme.context, 100) + '.');
      if (note) p.push('Client note: ' + essence(note, 180));
      p.push('Light travels in straight lines from its real source: what faces it is bright, what faces away falls into shadow, and whatever stands in its path casts its shadow onto what lies behind. Things that touch rest on each other under gravity and darken where they meet.');
      p.push('Shot on ' + camFor(SELECTED_FLAVOR, ly, pb.photo + ' ' + pb.mood) + '. Real material texture; ' + sz.w + 'x' + sz.h + ', edge to edge.');
      // v2.4:實測 AI 在標題上方多畫一個品牌字標 → 明講「加上去的字只有這幾個」(logo 由系統之後疊)
      if (headline || sub) p.push("The only words added to the photograph are these, in the brand's own type style" + (pb.type ? ' (' + essence(pb.type, 80) + ')' : '') + ', one compact block on the wall beside the product: ' +
        (headline ? '"' + headline + '"' : '') + (headline && sub ? ', and a small line beneath, ' : '') + (sub ? '"' + sub + '"' : '') + '.');
      return p.join('\n');
    }
    if (isReshoot) {
      var fsR = flavorSet(flavor);
      var bfR = [essence(pb.mood, 80), essence(ctx.adStyle, 70)].filter(Boolean).join('; ');
      p.push('The product is the garment in this photo: same cut, fabric, colour, zips, drawstrings and every logo or embroidery exactly as it is.');
      p.push('A new fashion campaign photograph of a young model wearing this garment: ' + pick(RESHOOTS) + '.');
      p.push('Everything else the model wears is plain, unbranded everyday basics, so the garment is the only branded piece in the picture.');
      if (fsR || bfR) p.push((fsR ? 'Styling: ' + essence(fsR, 120) + '. ' : '') + (bfR ? 'Brand feel: ' + bfR + '.' : ''));
      if (ctxTheme.context) p.push('Occasion, told through one small real sign: ' + essence(typeof _dropPriceTalk === 'function' ? _dropPriceTalk(ctxTheme.context) : ctxTheme.context, 100) + '.');
      if (note) p.push('Client note: ' + essence(note, 180));
      p.push('Light travels in straight lines from its real source: what faces it is bright, what faces away falls into shadow, and nearby surfaces bounce their colour onto the model. It is one moment through one lens.');
      p.push('Shot on ' + pick(CAMS.film.concat(CAMS.clean)) + '. Real skin texture, real fabric folds; ' + sz.w + 'x' + sz.h + ', edge to edge.');
      if (headline || sub) p.push("Words in the brand's own type style" + (pb.type ? ' (' + essence(pb.type, 80) + ')' : '') + ', one compact block on the sky or wall beside the model: ' +
        (headline ? '"' + headline + '"' : '') + (headline && sub ? ', and a small line beneath, ' : '') + (sub ? '"' + sub + '"' : '') + '.');
      return p.join('\n');
    }
    var P = isApparel ? 'their' : 'its';
    var concept;
    if (ly === 'white_studio') concept = 'a smooth warm-white studio wall; hard sun from a tall window on one side draws the window-frame shadow across the wall and across {S}';
    else if (ly === 'minimal_poster') concept = 'a plain backdrop painted in ' + (pb.colour ? essence(pb.colour, 50) : 'one calm colour') + '; hard sun from one side throws a crisp shadow of {S} onto it';
    else concept = conceptFor(pb.colour);
    concept = concept.replace(/\{S\}/g, S).replace(/\{P\}/g, P);
    p.push('A real ' + (isApparel ? 'fashion campaign' : 'product campaign') + ' photograph: ' + concept + '.');

    // ② 主體
    p.push(isApparel
      ? 'The people are the real models from this photo: same faces, expressions, pose, hair movement and clothes, now standing in this light.'
      : 'The product is the real one from this photo' + (name ? ' (' + name + ')' : '') + ': same form, colours, materials and markings' + ((spec || feat) ? ' — ' + essence([spec, feat].filter(Boolean).join('; '), 120) : '') + ', now standing in this light.');

    // ③ 構圖
    p.push((LAYOUT_ESSENCE[ly] || LAYOUT_ESSENCE['']).replace(/^./, function (c) { return c.toUpperCase(); }) + '; ' + S + (isApparel ? ' fill' : ' fills') + ' most of the frame' + (isApparel ? ', cropped where the source photo is cropped' : '') + '; ' + sz.w + 'x' + sz.h + ', edge to edge.');

    // ④ 風格 + 品牌
    var fs = flavorSet(flavor);
    var brandFeel = [essence(pb.mood, 80), essence(ctx.adStyle, 70), lockColor && pb.colour ? essence(pb.colour, 90) : ''].filter(Boolean).join('; ');
    if (fs || brandFeel) p.push((fs ? 'Styling: ' + essence(fs, 130) + '. ' : '') + (brandFeel ? 'Brand feel: ' + brandFeel + '.' : ''));
    if (ctxTheme.context) p.push('Occasion, told through one small real sign: ' + essence(typeof _dropPriceTalk === 'function' ? _dropPriceTalk(ctxTheme.context) : ctxTheme.context, 100) + '.');
    if (note) p.push('Client note: ' + essence(note, 180));

    // ⑤ 物理法則(保險,兩句)
    p.push('Light travels in straight lines from that one source: what faces it is bright, what faces away falls into shadow, and whatever stands in its path casts its shadow onto what lies behind; nearby coloured surfaces bounce their colour onto ' + S + '. ' +
      (isApparel ? '' : 'Things that touch rest on each other under gravity and darken where they meet. ') +
      'It is one moment through one lens, everything at its true scale.');

    // ⑥ 相機
    p.push('Shot on ' + camFor(SELECTED_FLAVOR, ly, pb.photo + ' ' + pb.mood) + ', from where the camera stood in the source photo.');

    // ⑦ 字
    if (headline || sub) {
      p.push('Words in the brand\'s own type style' + (pb.type ? ' (' + essence(pb.type, 80) + ')' : '') + ', one compact block on the background beside ' + S + ': ' +
        (headline ? '"' + headline + '"' : '') + (headline && sub ? ', and a small line beneath, ' : '') + (sub ? '"' + sub + '"' : '') + '.');
    }

    var out = p.join('\n');
    // v1.10 3,000 字牆(KOL 線定的):超過時先收「風格造型」與「客人補充」的細項,整層不拿掉
    if (out.length > 3000) { out = out.replace(/(Styling: )([^\n]*)/, function (m, a, b) { return a + essence(b, 90); }); }
    if (out.length > 3000) { out = out.replace(/(Client note: )([^\n]*)/, function (m, a, b) { return a + essence(b, 120); }); }
    return out;
  }

  window.buildPosterPromptLean = lean;
  window.buildPosterPrompt = function () {
    var pt = (typeof SELECTED_PRODTYPE !== 'undefined' && SELECTED_PRODTYPE) || '';
    var ly = (typeof SELECTED_LAYOUT !== 'undefined' && SELECTED_LAYOUT) || '';
    var fl = (REGIONAL_FLAVORS[SELECTED_FLAVOR] || {}).flavor || '';
    var use = window.AD_LEAN !== false && LEAN_TYPES.indexOf(pt) !== -1 && LEAN_LAYOUTS.indexOf(ly) !== -1 && !/ILLUSTRATION OVERLAY/i.test(fl);
    if (!use) { window._amReshoot = false; return ORIG.apply(this, arguments); }
    try {
      var out = lean();
      console.log('[AD_LEAN] 精簡提示詞 ' + out.length + ' 字(舊版保險絲:window.AD_LEAN=false)');
      return out;
    } catch (e) {
      console.warn('[AD_LEAN] 精簡版出錯,改用舊版:', e.message);
      return ORIG.apply(this, arguments);
    }
  };
  console.log('[AD_LEAN] v2.6 精簡廣告圖提示詞已載入');
})();
