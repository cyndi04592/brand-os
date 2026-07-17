// ════════════════════════════════════════════════════════════════════
//  kol-wardrobe.js · v5.18
//
//  👗 服裝師 — 穿搭、品牌調性鎖、服裝 DNA(服裝師 v2 · 一支一鎖)
//
//  v5.18(服裝鎖定·解抽卡):
//   ★ 新增 resolveLockedOutfitUrl(ctx) + generateOutfitRefImage() 最前面加「鎖定優先」判斷。
//     有「釘住的固定服裝圖」就直接回傳那張、完全不現生 → 根治「同一句『牛仔褲』每次抽不同款」。
//     沒釘 → 照舊走 v5.15 文字現生(零破壞、向下相容)。
//   ★ 鎖定來源優先序:
//       1) Console 保險絲 window.KOL_OUTFIT_LOCK = '圖網址'(=false 明確關閉鎖定,退回現生·方便 A/B)
//       2) 呼叫端 ctx.lockedOutfitImageUrl
//       3) persona.outfit_image_url / persona.outfitImageUrl(釘一次,以後都用)
//   ⚠️ 釘「乾淨白底/去背」服裝圖最佳(避免背景漏進影片,同 v5.17 顧慮);
//      建議用 R2/公開網址或 fal 圖網址,Drive 原圖 Worker 可能抓不到(同素材規則)。
//
//  v5.17:服裝參考圖 prompt 收乾淨 — 背景完全清空(無花瓶/植物/籃子/道具),
//         避免參考圖背景小物之後漏進 Seedance 影片。模特用「無臉素白模特」。
//
//  v5.15 重點(Riiv 優化①·服裝參考圖):
//   ★ 新增 generateOutfitRefImage(ctx) — 拿「同一套衣服文字」用 flux 自動生
//     一張「無臉/無頭乾淨衣服展示圖」,之後當參考圖餵 Seedance,鎖死布料
//     圖案/剪裁/顏色,解「衣服跨段變不同件」。臉不靠這張(交給 [Image1])→
//     刻意無臉,避免第二張臉跟 KOL 打架。
//   ★ 新增 resolveOutfitText(ctx) — 抽出 contribute() 用的同一套衣服文字
//     (去掉 'wearing ' 前綴),確保「參考圖」與「prompt 文字」描述同一件。
//   ★ Worker 呼叫比照 kol-stitch.js 自包(不依賴 kol.html 全域 api)。
//   ★ 失敗容錯:生不出圖回 null,呼叫端照舊用純文字,不會卡住生成。
//
//  v5.14 重點:
//   ★ contribute = 單一真相來源,服裝優先序:
//       1) 品牌風格(outfitBrand)→ 換造型,最優先
//       2) persona.outfit(KOL 招牌穿搭)→ 沒選品牌就穿這套
//       3) 場景自帶 outfit(向下相容)
//       4) 場景泛用(fallback)
//     永遠只吐「一套」wearing,接片端不再補第二套 → 解決雙套打架。
//   ★ persona 後備:實測 composeSeedancePrompt 的 ctx 沒帶 persona(ctx.persona=null),
//     所以直接從 window.S.selectedKol.persona 補抓(跟口音鎖同套路,全站共用同一顆)。
//   ★ 順手修舊洞:以前場景自帶 outfit 會 early-return 跳過內衣安全鎖;現在都會經過。
// ════════════════════════════════════════════════════════════════════

(function () {
  'use strict';

  const BRAND_STYLE_LIBRARY = {
    uniqlo:    { base: 'Japanese minimalist basics, solid muted colors, clean tailored fit, lifewear simplicity',
                 casual: 'soft cotton tee and relaxed pants', refined: 'fine knit and tailored trousers' },
    gu:        { base: 'young Japanese fast-fashion, trendy affordable styling, casual playful pieces',
                 casual: 'oversized tee and wide pants', refined: 'trendy layered casual look' },
    niko_and:  { base: 'Japanese zakka literary style, natural earthy tones, relaxed artsy layering, lifestyle ease',
                 casual: 'loose linen layers and comfy silhouette', refined: 'curated artsy ensemble with texture' },
    tnewties:  { base: 'Japanese vintage girl style, 1920s-meets-2020s retro fashion, pintuck blouses, houndstooth and embroidery details',
                 casual: 'retro blouse and pleated skirt', refined: 'vintage-inspired dress with delicate details' },
    human_made: { base: 'Japanese retro streetwear, vintage casual, cartoon-style graphic prints, relaxed loose fit',
                 casual: 'graphic sweatshirt and relaxed denim', refined: 'retro varsity layering' },
    aape:      { base: 'urban streetwear, camo patterns, sporty street style, youthful edgy fit',
                 casual: 'camo hoodie and joggers', refined: 'street-luxe layered look' },
    mardi:     { base: 'Korean French-leisure style, daisy floral print sweatshirt, sweet-cool casual vibe',
                 casual: 'floral sweatshirt and relaxed bottoms', refined: 'minimal logo knit with clean lines' },
    mallothi:  { base: 'French romantic vintage, pleated and gingham dresses, literary slow-living elegance, soft pastel tones',
                 casual: 'soft pastel cotton dress', refined: 'pleated romantic midi dress' },
    pazzo:     { base: 'Taiwanese good-life casual, Japanese-Korean versatile styling, flattering slim fit, comfortable quality fabric',
                 casual: 'comfy versatile tee and slimming pants', refined: 'elegant flattering dress' },
    caco:      { base: 'Taiwanese casual everyday, cute graphic print tops, slimming relaxed urban fit',
                 casual: 'cute graphic-print tee and casual bottoms', refined: 'clean casual layered look' },
    lv:        { base: 'luxury fashion-house elegance, refined tailoring, premium leather accents, timeless sophisticated silhouette',
                 casual: 'understated luxe knit and tailored pants', refined: 'elegant designer ensemble' },
    chanel:    { base: 'French haute-couture elegance, tweed jacket, pearl details, classic refined silhouette',
                 casual: 'refined tweed-trimmed casual', refined: 'elegant tweed ensemble with pearls' },
    hermes:    { base: 'understated ultra-luxury, impeccable craftsmanship, refined neutral palette, quiet elegance',
                 casual: 'quiet-luxury knit and tailored trousers', refined: 'impeccably tailored elegant look' },
    gucci:     { base: 'eclectic luxury, bold prints, vintage-glam maximalist styling, statement pieces',
                 casual: 'bold-print relaxed luxe', refined: 'glamorous statement ensemble' },
    diesel:    { base: 'Italian denim streetwear, distressed washed denim, Y2K rebellious edge',
                 casual: 'washed denim and graphic tee', refined: 'edgy denim-layered look' },
    on:        { base: 'Swiss performance sportswear, clean technical minimal design, athletic streamlined fit',
                 casual: 'sleek athleisure set', refined: 'minimal sporty-chic layering' },
  };

  function sceneTone(sceneId) {
    const id = String(sceneId || '').toLowerCase();
    if (id.includes('night') || id.includes('urban') || id.includes('evening')) return 'refined';
    return 'casual';
  }

  const OUTFIT_LIBRARY = {
    cozy_home:    'cozy oversized knit sweater, soft loungewear, relaxed at-home comfort',
    morning_casual: 'light comfortable cotton dress or soft pajama top, just-woke-up casual ease',
    everyday_chic: 'effortless everyday outfit, soft linen dress or knit top with simple bottoms, natural girl-next-door style',
    cafe_smart:   'smart casual outfit, light blouse or fine knit, understated and tasteful',
    outdoor_relaxed: 'relaxed outdoor wear, breathable casual dress or light layers, comfortable for walking',
    evening_refined: 'refined evening casual, elegant simple silhouette in muted tones, understated sophistication',
  };

  const LINGERIE_BRAND_TYPES = ['fashion_lingerie', 'lingerie', 'underwear'];

  const BRAND_ALIASES = {
    uniqlo: 'uniqlo', gu: 'gu',
    niko_and: 'niko_and', niko: 'niko_and', 'niko_and___': 'niko_and',
    tnewties: 'tnewties', '20s_tnewties': 'tnewties', '20s': 'tnewties',
    human_made: 'human_made', humanmade: 'human_made', human: 'human_made',
    aape: 'aape',
    mardi: 'mardi', mardi_mercredi: 'mardi', mardimercredi: 'mardi',
    mallothi: 'mallothi', pazzo: 'pazzo', caco: 'caco',
    lv: 'lv', louis_vuitton: 'lv', louisvuitton: 'lv',
    chanel: 'chanel', hermes: 'hermes', 'herm_s': 'hermes',
    gucci: 'gucci', diesel: 'diesel', on: 'on',
  };
  function resolveBrandKey(raw) {
    if (!raw) return '';
    const norm = String(raw).toLowerCase().trim()
      .replace(/[\s.\-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
    if (norm === 'auto') return 'auto';
    if (BRAND_STYLE_LIBRARY[norm]) return norm;
    if (BRAND_ALIASES[norm]) return BRAND_ALIASES[norm];
    const first = norm.split('_')[0];
    if (BRAND_STYLE_LIBRARY[first]) return first;
    if (BRAND_ALIASES[first]) return BRAND_ALIASES[first];
    return '';
  }

  function pickOutfitByScene(sceneId) {
    const id = String(sceneId || '').toLowerCase();
    if (id.includes('morning') || id.includes('kitchen')) return 'morning_casual';
    if (id.includes('home') || id.includes('unboxing')) return 'cozy_home';
    if (id.includes('cafe') || id.includes('afternoon')) return 'cafe_smart';
    if (id.includes('outdoor') || id.includes('garden')) return 'outdoor_relaxed';
    if (id.includes('night') || id.includes('urban') || id.includes('evening')) return 'evening_refined';
    return 'everyday_chic';
  }

  /**
   * 產出服裝段落 — v5.14 單一真相來源(永遠只一套)
   *   優先序:品牌 > persona.outfit > 場景自帶 > 場景泛用
   */
  function contribute(ctx) {
    if (!ctx) return '';

    const sceneId    = ctx.sceneId || ctx.scene?.id || '';
    const brandType  = ctx.brand?.brand_type || '';
    const isLingerie = LINGERIE_BRAND_TYPES.includes(brandType);

    // 🔑 persona 後備:ctx 沒帶 persona(實測 null)→ 從全域 window.S 補抓(全站共用同一顆)
    const persona = ctx.persona
      || (window.S && window.S.selectedKol && window.S.selectedKol.persona)
      || null;

    let outfitText = '';

    // 1) 品牌風格(outfitBrand 或 persona 綁定的品牌)× 場景時段變體
    const chosenBrand = resolveBrandKey(ctx.outfitBrand || persona?.outfit_brand || '');
    if (chosenBrand && chosenBrand !== 'auto' && BRAND_STYLE_LIBRARY[chosenBrand]) {
      const b = BRAND_STYLE_LIBRARY[chosenBrand];
      const tone = sceneTone(sceneId);
      outfitText = b.base + ', ' + (tone === 'refined' ? b.refined : b.casual);
    }
    // 2) 沒選品牌 → KOL 招牌穿搭(人設預設)
    else if (persona?.outfit) {
      outfitText = persona.outfit;
    }
    // 3) 場景自帶 outfit(向下相容)
    else if (ctx.scene?.outfit) {
      outfitText = ctx.scene.outfit;
    }
    // 4) 都沒有 → 依場景時段選泛用穿搭
    else {
      outfitText = OUTFIT_LIBRARY[pickOutfitByScene(sceneId)] || '';
    }

    if (!outfitText) return '';

    // 內衣品牌安全鎖(不論哪個來源都會套上)
    if (isLingerie) {
      outfitText += ', fully dressed in everyday outerwear, modest and tasteful, no exposed undergarments, no revealing clothing';
    }

    return 'wearing ' + outfitText;
  }

  function suggestOutfit(brandId, sceneId, mood) {
    const key = pickOutfitByScene(sceneId);
    return OUTFIT_LIBRARY[key] || null;
  }

  // ══════════════════════════════════════════════════════════════════
  //  🆕 v5.15:服裝參考圖(Riiv 優化①)
  // ══════════════════════════════════════════════════════════════════

  // Worker 設定 — 比照 kol-stitch.js 自包(模組不依賴 kol.html 全域 api)
  const WD_WORKER_URL = 'https://kol-proxy.calm-sunset-6b66.workers.dev';
  const WD_WORKER_PW  = 'raby2026';
  async function wdCallWorker(action, params) {
    const res = await fetch(WD_WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ action, password: WD_WORKER_PW }, params || {})),
    });
    let data;
    try { data = await res.json(); }
    catch (e) { throw new Error(`[${action}] 回應不是 JSON(HTTP ${res.status})`); }
    if (data && data.ok === false) throw new Error(`[${action}] ${data.error || '未知錯誤'}`);
    return data;
  }

  // 抽「衣服文字」— 跟 contribute() 同一套真相,去掉 'wearing ' 前綴
  //   → 確保「參考圖」跟「prompt 文字」描述的是同一件衣服
  function resolveOutfitText(ctx) {
    const full = contribute(ctx);                 // 'wearing X' 或 ''
    return full ? full.replace(/^wearing\s+/i, '').trim() : '';
  }

  // ══════════════════════════════════════════════════════════════════
  //  🔒 v5.18:服裝鎖定 — 回傳「已釘住的固定服裝圖 URL」(有就用、不現生)
  //    根治「同一句衣服文字每次現生一張新圖 → 每次款式不一樣 → 抽卡、跨段飄」。
  //    優先序:Console 保險絲 > ctx 傳入 > persona 綁定。
  //    ⚠️ 釘乾淨白底/去背圖最佳;建議 R2/公開網址或 fal 圖網址(Drive 原圖 Worker 可能抓不到)。
  // ══════════════════════════════════════════════════════════════════
  function resolveLockedOutfitUrl(ctx) {
    // 1) Console 保險絲(臨時覆蓋 / A-B 測試):
    //    window.KOL_OUTFIT_LOCK = '網址'  → 強制用這張
    //    window.KOL_OUTFIT_LOCK = false   → 明確關閉鎖定,退回文字現生
    const sw = (typeof window !== 'undefined') ? window.KOL_OUTFIT_LOCK : undefined;
    if (sw === false) return '';
    if (typeof sw === 'string' && sw.trim()) return sw.trim();

    // 2) 呼叫端明確指定
    if (ctx && typeof ctx.lockedOutfitImageUrl === 'string' && ctx.lockedOutfitImageUrl.trim()) {
      return ctx.lockedOutfitImageUrl.trim();
    }

    // 3) persona 綁定的固定服裝圖(釘一次,以後都用)
    const persona = (ctx && ctx.persona)
      || (typeof window !== 'undefined' && window.S && window.S.selectedKol && window.S.selectedKol.persona)
      || null;
    const pinned = persona && (persona.outfit_image_url || persona.outfitImageUrl);
    if (typeof pinned === 'string' && pinned.trim()) return pinned.trim();

    return '';
  }

  /**
   * 👗 自動生「無臉衣服平拍圖」當參考(Phase 1:鎖布料,不搶臉)
   *   - 🔒 v5.18:先看有沒有「釘住的固定服裝圖」→ 有就直接回傳、完全不現生(解抽卡)
   *   - 沒釘 → flux 純文字出圖 → 生「無頭/無臉乾淨服裝展示圖」,臉交給 [Image1]
   *   - 刻意無臉:避免第二張臉跟 KOL 打架
   *   - 回傳 圖 URL;生不出來回 null(呼叫端容錯,照舊純文字)
   * @param {object} ctx  跟 contribute 同一個 ctx(outfitBrand / sceneId / persona…)
   *                       可額外帶 ctx.lockedOutfitImageUrl 直接指定固定服裝圖
   * @returns {Promise<string|null>}
   */
  async function generateOutfitRefImage(ctx) {
    // 🔒 v5.18 服裝鎖定:有釘住的固定服裝圖 → 直接用,不現生
    const lockedUrl = resolveLockedOutfitUrl(ctx);
    if (lockedUrl) {
      console.log('[KolWardrobe] 🔒 服裝鎖定:使用釘住的固定服裝圖(不現生)→', lockedUrl);
      return lockedUrl;
    }

    const outfitText = resolveOutfitText(ctx);
    if (!outfitText) { console.warn('[KolWardrobe] 沒有衣服文字,跳過服裝參考圖'); return null; }

    const prompt =
      'Clean cut-out e-commerce product listing photo. ' +
      'A single outfit worn on a plain white featureless faceless mannequin (no face, no identity). ' +
      'The outfit is: ' + outfitText + '. ' +
      'Full-length front view, the mannequin centered and completely isolated on a flat solid pure white background. ' +
      'The mannequin wearing the outfit is the only object in the entire frame, surrounded on all sides by empty plain white space, ' +
      'like an isolated product cut-out with no environment whatsoever. ' +
      'Soft even studio lighting, sharp realistic fabric texture, true accurate colors, minimal clean studio photography.';

    try {
      const r = await wdCallWorker('fal_image_submit', {
        prompt,
        aspect_ratio: '3:4',     // 直幅:看得到完整上下身比例
        num_images: 1,
        output_format: 'jpeg',
      });
      const url = (r && r.images && r.images[0] && r.images[0].url) || null;
      if (url) console.log('[KolWardrobe] 👗 服裝參考圖已生成 →', url);
      else     console.warn('[KolWardrobe] 影像引擎回應無圖:', JSON.stringify(r).slice(0, 200));
      return url;
    } catch (e) {
      console.warn('[KolWardrobe] 服裝參考圖生成失敗(照舊純文字):', e.message);
      return null;
    }
  }

  window.KolWardrobe = {
    BRAND_STYLE_LIBRARY,
    OUTFIT_LIBRARY,
    contribute,
    suggestOutfit,
    pickOutfitByScene,
    resolveOutfitText,          // 🆕 v5.15
    generateOutfitRefImage,     // 🆕 v5.15
    resolveLockedOutfitUrl,     // 🆕 v5.18(除錯用:看目前會鎖到哪張)
  };

  if (window.CrewDirector?.register) {
    window.CrewDirector.register('wardrobe', window.KolWardrobe);
  }

  console.log('[KolWardrobe] 👗 v5.18 就緒 · 服裝鎖定(釘住固定服裝圖→不現生·解抽卡·保險絲 window.KOL_OUTFIT_LOCK)+ 單一真相來源 + persona 後備 + 內衣安全鎖 + 服裝參考圖');
})();
