// ═══════════════════════════════════════════════════════════════════════
//  admaker-prompt-lean.js · v1.0 (2026-10-22)
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
  var LIGHTS = [
    'hard afternoon sun coming from the left through a window',
    'soft overcast daylight from a large window on the right',
    'low golden late-day sun from behind and to the left',
    'clean morning sun from the right, crisp and slightly cool',
    'one large softbox from the front-left, like a real studio key light',
  ];
  // 沒選風格、品牌也沒寫場景時的實景(都是「一面背景」,人和商品都站得進去)
  var PLACES = [
    'a plain warm plaster wall with a pale floor',
    'a seamless paper backdrop in a soft tone taken from the brand palette',
    'a clean light-wood surface against a smooth off-white wall',
    'a quiet corner of a bright room with one plain wall behind',
  ];

  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function cut(s, n) { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n).replace(/[,;\s]+\S*$/, '') : s; }
  function val(id) { var el = document.getElementById(id); return (el && el.value || '').trim(); }

  // 品牌包 DNA:只拿配色、字型、場景三行
  function packBits() {
    var out = { colour: '', type: '', scene: '' };
    try {
      var dna = String((detectBrandPack() || {}).dna || '');
      dna.split('\n').forEach(function (l) {
        var m = l.trim().match(/^-\s*([^:]+):\s*(.*)$/); if (!m || !m[2]) return;
        var k = m[1].toLowerCase(), v = m[2].trim();
        if (/primary brand colou?r|secondary palette|palette/.test(k)) out.colour += (out.colour ? '; ' : '') + v;
        else if (/^typography/.test(k)) out.type = v;
        else if (/background scenes?|^scenes?|setting/.test(k)) out.scene = v;
      });
    } catch (_) {}
    if (typeof _dropLogoTalk === 'function') { out.colour = _dropLogoTalk(out.colour) || ''; out.type = _dropLogoTalk(out.type) || ''; }
    return out;
  }

  // 風格:把形容詞清單去掉「Add … flavor:」與相機句,只留「場景與造型」那段
  function flavorSet(f) {
    var t = String((f && f.flavor) || '');
    if (!t) return '';
    t = t.replace(/^Add\s+/i, '').replace(/\s*flavou?r\s*:/i, ':').replace(/\s*Shot on[\s\S]*$/i, '').replace(/[\s,;.]+$/, '');
    return cut(typeof _dropPriceTalk === 'function' ? _dropPriceTalk(t) : t, 260);
  }

  function lean() {
    var pt = (typeof SELECTED_PRODTYPE !== 'undefined' && SELECTED_PRODTYPE) || '';
    var ly = (typeof SELECTED_LAYOUT !== 'undefined' && SELECTED_LAYOUT) || '';
    var flavor = (REGIONAL_FLAVORS[SELECTED_FLAVOR] || {});
    var ctxTheme = (CONTEXT_THEMES[SELECTED_CONTEXT] || {});
    var ctx = getBrandContext();
    var pb = packBits();
    var isApparel = (pt === 'apparel');

    var headline = val('gptHeadline'), sub = val('gptSubHeadline'), note = val('gptStyleDesc');
    var lockColor = (document.getElementById('lockBrandColor') || {}).checked !== false;
    var showMark  = (document.getElementById('showBrandMark') || {}).checked !== false;
    var name = String(ctx.product || '').replace(/\b[A-Za-z]{1,5}[-\s]?\d{2,6}[A-Za-z]{0,3}\b/g, '').replace(/\s{2,}/g, ' ').trim();
    var spec = cut(typeof _stripPriceFigures === 'function' ? _stripPriceFigures(ctx.spec) : ctx.spec, 160);
    var brand = ctx.brand || 'the brand';
    var p = [];

    // ① 主體
    if (isApparel) {
      p.push('The people are the real models in this photo: same faces, same pose, same hair movement, wearing the real garment' + (name ? ' (' + name + ')' : '') + ' with its exact colour, cut, fabric and logo.');
    } else {
      p.push('The product is the real one in this photo' + (name ? ' — ' + name : '') + ': same shape, proportions, colours, materials and printed markings as the source photo' + (spec ? '; ' + spec : '') + '.');
    }

    // ② 在哪裡拍 + 光 + 影子
    var place;
    if (ly === 'white_studio')        place = 'a seamless white-to-warm-grey studio cove';
    else if (ly === 'minimal_poster') place = 'a plain single-colour backdrop' + (pb.colour ? ' in a tone from ' + cut(pb.colour, 60) : '');
    else if (pb.scene && !flavor.flavor) place = cut(pb.scene.split(/,\s*or\s+|\bor\b/)[0], 120);
    else place = pick(PLACES);
    var light = pick(LIGHTS);
    p.push('A real ' + (isApparel ? 'fashion campaign' : 'product campaign') + ' photograph: ' + place + ', ' + light + ', the light and its shadows falling across the background and across the ' + (isApparel ? 'people' : 'product') + ' alike, ' + (isApparel ? 'their own shadows on the wall beside them.' : 'its own shadow cast on the surface beside it.'));
    var fs = flavorSet(flavor);
    if (fs) p.push('Set and styling of this shoot: ' + fs + '.');

    // ③ 構圖
    p.push(isApparel
      ? 'Tight editorial crop: the frame cuts their bodies where the source photo does, and the people fill most of the frame.'
      : 'The product fills most of the frame with a confident crop, standing exactly as it is used, the background calm behind it.');

    // ④ 情境 / 客人補充
    if (ctxTheme.context) p.push('One small cue of the occasion: ' + cut(typeof _dropPriceTalk === 'function' ? _dropPriceTalk(ctxTheme.context) : ctxTheme.context, 140) + '.');
    if (note) p.push('Client note: ' + cut(note, 200));

    // ⑤ 字
    if (headline || sub) {
      p.push('All typography speaks in the same voice as the ' + brand + ' wordmark' + (pb.type ? ': ' + cut(pb.type, 140) : '') + '.');
      p.push('A compact text block about a third of the frame wide, placed on the background area, leaving the ' + (isApparel ? 'faces' : 'product') + ' clear: ' +
        (headline ? 'headline "' + headline + '"' : '') + (headline && sub ? ', and beneath it ' : '') +
        (sub ? 'one small line with generous letter-spacing "' + sub + '"' : '') + '.');
    } else {
      p.push('The only lettering in the image is what is printed on the ' + (isApparel ? 'garment' : 'product') + ' itself; the upper third stays calm for type added later.');
    }

    // ⑥ Logo 角落 + 配色 + 畫布 + 質感
    if (showMark) p.push('The bottom-right corner stays calm and plain for the brand logo added afterwards.');
    if (lockColor && pb.colour) p.push('Palette: ' + cut(pb.colour, 150) + '.');
    var sz = (typeof _adSize === 'function') ? _adSize() : { w: 1080, h: 1080 };
    p.push('Canvas ' + sz.w + 'x' + sz.h + ', the photograph runs to all four edges.');
    p.push(isApparel
      ? 'Real skin and fabric texture, 85mm lens, international fashion brand campaign quality.'
      : 'Real material texture, 100mm lens, premium brand campaign quality.');

    return p.join('\n');
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
  console.log('[AD_LEAN] v1.0 精簡廣告圖提示詞已載入');
})();
