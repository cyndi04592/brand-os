// ═══════════════════════════════════════════════════════════════════════
//  admaker-prompt-lean.js · v1.10 (2026-10-22)
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

  var LEAN_TYPES   = ['', 'physical', 'apparel'];
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
    film:  ['shot on Kodak Portra 400 35mm film with a Contax-style 35mm lens, visible fine grain, warm honest skin tones, slightly lifted blacks',
            'shot on Kodak Gold 200 35mm film, natural grain, warm golden cast, real film halation in the highlights'],
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
    var isApparel = (pt === 'apparel');
    var S = isApparel ? 'the people' : 'the product';

    var headline = val('gptHeadline'), sub = val('gptSubHeadline'), note = val('gptStyleDesc');
    var lockColor = (document.getElementById('lockBrandColor') || {}).checked !== false;
    var showMark  = (document.getElementById('showBrandMark') || {}).checked !== false;
    var strip = function (t) { return typeof _stripPriceFigures === 'function' ? _stripPriceFigures(t) : t; };
    var name = String(ctx.product || '').replace(/\b[A-Za-z]{1,5}[-\s]?\d{2,6}[A-Za-z]{0,3}\b/g, '').replace(/\s{2,}/g, ' ').trim();
    var spec = essence(strip(ctx.spec), 160), feat = essence(strip(ctx.feature), 160);
    var sz = (typeof _adSize === 'function') ? _adSize() : { w: 1080, h: 1080 };
    var p = [];

    // v1.5 每層寫成「物理/真實世界的法則」(學 KOL kol-stitch _LIGHT_SOURCE 的寫法):
    //   不列細節、不寫禁令,只講法則,AI 自己推得出正確結果,也涵蓋沒列到的情況。
    // ① 主體
    p.push(isApparel
      ? 'These are the real people from this photo, photographed again in a new place. A person carries their identity with them: face, expression, pose, hair movement and the clothes they wear stay as they are. What changes is how the new light meets them — skin warms and cools with the light around it, and fabric shows its weave wherever light grazes across it.'
      : 'This is the real product from this photo' + (name ? ' (' + name + ')' : '') + ', photographed again in a new place. An object carries its identity with it: form, proportions, colours, materials and printed markings stay as they are. What changes is how the new light meets its surfaces — matte materials take light softly, glossy ones mirror the room around them, translucent ones glow from within.');
    if (!isApparel && (spec || feat)) p.push('It is ' + [spec, feat].filter(Boolean).join('; ') + '.');

    // ② 骨架
    p.push('The subject is the reason this photograph exists: ' + (LAYOUT_ESSENCE[ly] || LAYOUT_ESSENCE['']) + '. The eye lands first on the brightest, sharpest point and then travels along lines and light through the frame; the subject holds that first point, and the space around it stays calm enough to let it breathe. ' + sz.w + 'x' + sz.h + ', the photograph filling the whole canvas' + (isApparel ? ', the frame cutting the bodies where the source photo cuts them.' : '.'));

    // ③ 場景
    var place;
    if (ly === 'white_studio')        place = 'a smooth warm-white studio wall';
    else if (ly === 'minimal_poster') place = 'a plain backdrop' + (pb.colour ? ' in a tone from ' + essence(pb.colour, 60) : '');
    else if (pb.scene && !flavor.flavor) place = essence(pb.scene.split(/,\s*or\s+|\bor\b/)[0], 110);
    else place = isApparel ? 'a plain warm plaster wall' : pick(PLACES);
    var fs = flavorSet(flavor);
    p.push('Place: ' + place + '. A real place is built from real materials — plaster, wood, stone, fabric, paper — each with its own texture and signs of use, and it holds only what would be there for a reason. It has depth: something near, the subject, and space receding behind.');
    if (fs) p.push('The chosen style is a way of living, and it shows in what the place is made of, what is worn and used there, and the colour of the air: ' + essence(fs, 170) + '.');

    // ④ 光影(命脈)—— 光遵守場景的物理,和整個空間、主體成為一體
    p.push('Light obeys the physics of this place and becomes one with the whole space and ' + S + '. It comes from a real source belonging to the place, strong and directional enough to draw clear shapes of light and shadow' + (pb.photo ? ', ' + essence(pb.photo, 90) : '') +
      '. It travels in straight lines: surfaces facing it are bright, surfaces facing away fall into shadow, and whatever stands in its path casts its shadow onto what lies behind. Light adds: where lights overlap they blend, and nearby surfaces bounce their colour back onto ' + S + '.');

    // ⑤ 一張照片 + 接觸
    p.push('A camera records one moment through one lens: everything shares one viewpoint and one perspective, focus falls off smoothly with distance from the focal plane, one colour grade and one grain run across the whole frame, and everything stands at its true size beside everything else.' +
      (isApparel ? '' : ' Things that touch rest on each other under gravity and darken where they meet.'));

    // ⑥ 手(只有真的有手)
    if (ly === 'hand_hold' || /\b(hand|holding|unboxing)\b/i.test(String(ctxTheme.context || ''))) p.push('A hand holding something carries its weight.');

    // ⑦ 氛圍配色
    // v1.10 補回舊版的「品牌方向」(brand.adStyle,例 MOZ:北歐輕鬆感、顏值日常、戶外露營風…)—— 精簡版漏掉了
    var mood = [essence(pb.mood, 110), essence(ctx.adStyle, 90)].filter(Boolean).join('; ');
    if (mood || (lockColor && pb.colour)) p.push('A brand is felt before it is read: its mood and colours run quietly through the surfaces, the light and the objects of this photograph — ' + [mood, lockColor && pb.colour ? essence(pb.colour, 130) : ''].filter(Boolean).join('; ') + '.');

    // ⑧ 情境 / 客人補充
    if (ctxTheme.context) p.push('An occasion is told through one small, real sign inside the scene, the way it would appear in life: ' + essence(typeof _dropPriceTalk === 'function' ? _dropPriceTalk(ctxTheme.context) : ctxTheme.context, 120) + '.');
    if (note) p.push('The client asks: ' + essence(note, 200));

    // ⑨ 攝影師
    p.push('Every camera and film renders light and colour in its own way; this one is ' + camFor(SELECTED_FLAVOR, ly, pb.photo + ' ' + pb.mood) + '. It stands where it stood in the source photo.');

    // ⑩ 字 + Logo
    if (headline || sub) {
      p.push('Words belong to the brand: they speak in its own type style' + (pb.type ? ' (' + essence(pb.type, 90) + ')' : '') + ' and sit as one compact block on the background beside ' + S + ', placed the way a designer would place them: ' +
        (headline ? '"' + headline + '"' : '') + (headline && sub ? ', with a small line beneath, ' : '') + (sub ? '"' + sub + '"' : '') + '.');
    }
    // v1.8:提示詞完全不提 logo(RA:系統本來就有壓 logo 的程式 —— compositeBrandLogo 生完圖後
    //   自己量四個角、挑最乾淨的那角貼真 logo 檔;提示詞一提,AI 就會自己畫一個)

    var out = p.join('\n');
    // v1.10 3,000 字牆(KOL 線定的):超過時先收「風格造型」與「客人補充」的細項,整層不拿掉
    if (out.length > 3000) { out = out.replace(/(and the colour of the air: )([^\n]*)/, function (m, a, b) { return a + essence(b, 90); }); }
    if (out.length > 3000) { out = out.replace(/(The client asks: )([^\n]*)/, function (m, a, b) { return a + essence(b, 120); }); }
    return out;
  }

  window.buildPosterPromptLean = lean;
  window.buildPosterPrompt = function () {
    var pt = (typeof SELECTED_PRODTYPE !== 'undefined' && SELECTED_PRODTYPE) || '';
    var ly = (typeof SELECTED_LAYOUT !== 'undefined' && SELECTED_LAYOUT) || '';
    var fl = (REGIONAL_FLAVORS[SELECTED_FLAVOR] || {}).flavor || '';
    var use = window.AD_LEAN !== false && LEAN_TYPES.indexOf(pt) !== -1 && LEAN_LAYOUTS.indexOf(ly) !== -1 && !/ILLUSTRATION OVERLAY/i.test(fl);
    if (!use) return ORIG.apply(this, arguments);
    try {
      var out = lean();
      console.log('[AD_LEAN] 精簡提示詞 ' + out.length + ' 字(舊版保險絲:window.AD_LEAN=false)');
      return out;
    } catch (e) {
      console.warn('[AD_LEAN] 精簡版出錯,改用舊版:', e.message);
      return ORIG.apply(this, arguments);
    }
  };
  console.log('[AD_LEAN] v1.10 精簡廣告圖提示詞已載入');
})();
