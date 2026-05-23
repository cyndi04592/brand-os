// ════════════════════════════════════════════════════════════════════
//  kol-wardrobe.js · v5.13
//
//  👗 服裝師 — 穿搭、品牌調性鎖、服裝 DNA
//
//  職責:
//   • 依品牌類型 + 場景時段,決定 KOL 當集的「外出服/日常穿搭」
//   • 支援「指定服飾品牌風格」(打品牌名 → 對應風格特徵)
//   • 用「風格特徵」描述,不寫品牌名(避 Seedance 商標審核 + 效果穩)
//      ※ 查證:Seedance 2.0 會擋商標/品牌名(prompt 文字掃描),
//        寫品牌名可能被拒絕/影片變異。官方建議:描述視覺特徵不指名。
//   • 🛑 內衣類品牌:服裝師只管外出服,內衣呈現交給品牌靈魂(不裸露)
//
//  設計哲學(RA 2026-05-23 定調):
//   「寫風格特徵不寫品牌名」(同攝影師寫 35mm 不寫 Sony)
//   「選品牌後仍依場景時段微調」(早上穿該品牌的休閒版)
//
//  v5.13 狀態:啟用 contribute — 品牌風格庫 + 場景時段微調
// ════════════════════════════════════════════════════════════════════

(function () {
  'use strict';

  // ─── 服飾品牌風格庫(寫風格特徵,不寫品牌名給 AI)────────────
  //  key = 品牌代號(顧客選的),value = { style: 風格特徵, casual/refined: 場景變體 }
  //  RA 對照表(自己看的,系統送 AI 的是 style 文字):
  //    uniqlo / gu / niko_and / tnewties / human_made / aape /
  //    mardi / mallothi / pazzo / caco / lv / chanel / hermes / gucci / diesel / on
  const BRAND_STYLE_LIBRARY = {
    // ── 日系基本 ──
    uniqlo:    { base: 'Japanese minimalist basics, solid muted colors, clean tailored fit, lifewear simplicity',
                 casual: 'soft cotton tee and relaxed pants', refined: 'fine knit and tailored trousers' },
    gu:        { base: 'young Japanese fast-fashion, trendy affordable styling, casual playful pieces',
                 casual: 'oversized tee and wide pants', refined: 'trendy layered casual look' },
    niko_and:  { base: 'Japanese zakka literary style, natural earthy tones, relaxed artsy layering, lifestyle ease',
                 casual: 'loose linen layers and comfy silhouette', refined: 'curated artsy ensemble with texture' },
    // ── 日系復古 ──
    tnewties:  { base: 'Japanese vintage girl style, 1920s-meets-2020s retro fashion, pintuck blouses, houndstooth and embroidery details',
                 casual: 'retro blouse and pleated skirt', refined: 'vintage-inspired dress with delicate details' },
    // ── 日系街頭 ──
    human_made: { base: 'Japanese retro streetwear, vintage casual, cartoon-style graphic prints, relaxed loose fit',
                 casual: 'graphic sweatshirt and relaxed denim', refined: 'retro varsity layering' },
    aape:      { base: 'urban streetwear, camo patterns, sporty street style, youthful edgy fit',
                 casual: 'camo hoodie and joggers', refined: 'street-luxe layered look' },
    // ── 韓系 ──
    mardi:     { base: 'Korean French-leisure style, daisy floral print sweatshirt, sweet-cool casual vibe',
                 casual: 'floral sweatshirt and relaxed bottoms', refined: 'minimal logo knit with clean lines' },
    // ── 台灣女裝 ──
    mallothi:  { base: 'French romantic vintage, pleated and gingham dresses, literary slow-living elegance, soft pastel tones',
                 casual: 'soft pastel cotton dress', refined: 'pleated romantic midi dress' },
    pazzo:     { base: 'Taiwanese good-life casual, Japanese-Korean versatile styling, flattering slim fit, comfortable quality fabric',
                 casual: 'comfy versatile tee and slimming pants', refined: 'elegant flattering dress' },
    caco:      { base: 'Taiwanese casual everyday, cute graphic print tops, slimming relaxed urban fit',
                 casual: 'cute graphic-print tee and casual bottoms', refined: 'clean casual layered look' },
    // ── 精品 ──
    lv:        { base: 'luxury fashion-house elegance, refined tailoring, premium leather accents, timeless sophisticated silhouette',
                 casual: 'understated luxe knit and tailored pants', refined: 'elegant designer ensemble' },
    chanel:    { base: 'French haute-couture elegance, tweed jacket, pearl details, classic refined silhouette',
                 casual: 'refined tweed-trimmed casual', refined: 'elegant tweed ensemble with pearls' },
    hermes:    { base: 'understated ultra-luxury, impeccable craftsmanship, refined neutral palette, quiet elegance',
                 casual: 'quiet-luxury knit and tailored trousers', refined: 'impeccably tailored elegant look' },
    // ── 輕奢潮 ──
    gucci:     { base: 'eclectic luxury, bold prints, vintage-glam maximalist styling, statement pieces',
                 casual: 'bold-print relaxed luxe', refined: 'glamorous statement ensemble' },
    diesel:    { base: 'Italian denim streetwear, distressed washed denim, Y2K rebellious edge',
                 casual: 'washed denim and graphic tee', refined: 'edgy denim-layered look' },
    // ── 機能運動 ──
    on:        { base: 'Swiss performance sportswear, clean technical minimal design, athletic streamlined fit',
                 casual: 'sleek athleisure set', refined: 'minimal sporty-chic layering' },
  };

  // ─── 場景時段 → 偏 casual 還是 refined ──────────────────
  function sceneTone(sceneId) {
    const id = String(sceneId || '').toLowerCase();
    // 夜間/精緻場景 → refined;其餘日常 → casual
    if (id.includes('night') || id.includes('urban') || id.includes('evening')) return 'refined';
    return 'casual';
  }

  // ─── 無品牌時的泛用穿搭庫(fallback / auto)──────────────
  const OUTFIT_LIBRARY = {
    cozy_home:    'cozy oversized knit sweater, soft loungewear, relaxed at-home comfort',
    morning_casual: 'light comfortable cotton dress or soft pajama top, just-woke-up casual ease',
    everyday_chic: 'effortless everyday outfit, soft linen dress or knit top with simple bottoms, natural girl-next-door style',
    cafe_smart:   'smart casual outfit, light blouse or fine knit, understated and tasteful',
    outdoor_relaxed: 'relaxed outdoor wear, breathable casual dress or light layers, comfortable for walking',
    evening_refined: 'refined evening casual, elegant simple silhouette in muted tones, understated sophistication',
  };

  const LINGERIE_BRAND_TYPES = ['fashion_lingerie', 'lingerie', 'underwear'];

  // ─── 品牌名容錯對應(處理多字/別名/大小寫)──────────────
  //  顧客可能打 "Mardi Mercredi" / "mardi" / "MARDI",都要對到 key 'mardi'
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
    // 正規化:小寫、空白/點/橫線→底線、去頭尾底線
    const norm = String(raw).toLowerCase().trim()
      .replace(/[\s.\-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
    if (norm === 'auto') return 'auto';
    if (BRAND_STYLE_LIBRARY[norm]) return norm;       // 直接命中
    if (BRAND_ALIASES[norm]) return BRAND_ALIASES[norm]; // 別名命中
    // 寬鬆:取第一個字試(Mardi Mercredi → mardi)
    const first = norm.split('_')[0];
    if (BRAND_STYLE_LIBRARY[first]) return first;
    if (BRAND_ALIASES[first]) return BRAND_ALIASES[first];
    return '';  // 對不到 → 走泛用
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
   * 產出服裝段落
   * v5.13:
   *   1. 場景自帶 outfit → 尊重(向下相容)
   *   2. 有指定服飾品牌(ctx.outfitBrand / persona.outfit_brand)→ 品牌風格 × 場景變體
   *   3. 否則(含 auto)→ 依場景時段選泛用穿搭
   *   4. 內衣類品牌 → 加安全鎖(正常外出服、不裸露)
   */
  function contribute(ctx) {
    if (!ctx) return '';

    // 1) 場景自帶 outfit,尊重它
    if (ctx.scene?.outfit) {
      return 'wearing ' + ctx.scene.outfit;
    }

    const sceneId = ctx.sceneId || ctx.scene?.id || '';
    const brandType = ctx.brand?.brand_type || '';
    const isLingerie = LINGERIE_BRAND_TYPES.includes(brandType);

    // 2) 有指定服飾品牌風格?(顧客選的,非 auto)
    const chosenBrand = resolveBrandKey(ctx.outfitBrand || ctx.persona?.outfit_brand || '');
    let outfitText;

    if (chosenBrand && chosenBrand !== 'auto' && BRAND_STYLE_LIBRARY[chosenBrand]) {
      // 品牌風格 × 場景時段變體(早上穿該品牌休閒版,夜間穿精緻版)
      const b = BRAND_STYLE_LIBRARY[chosenBrand];
      const tone = sceneTone(sceneId);
      const variant = tone === 'refined' ? b.refined : b.casual;
      outfitText = b.base + ', ' + variant;
    } else {
      // 3) 無品牌 / auto → 依場景時段選泛用穿搭
      const outfitKey = pickOutfitByScene(sceneId);
      outfitText = OUTFIT_LIBRARY[outfitKey];
    }

    if (!outfitText) return '';

    // 4) 內衣品牌安全鎖
    if (isLingerie) {
      outfitText = outfitText + ', fully dressed in everyday outerwear, modest and tasteful, no exposed undergarments, no revealing clothing';
    }

    return 'wearing ' + outfitText;
  }

  function suggestOutfit(brandId, sceneId, mood) {
    const key = pickOutfitByScene(sceneId);
    return OUTFIT_LIBRARY[key] || null;
  }

  // ─── 導出 + 自動向總導演註冊 ─────────────────────────
  window.KolWardrobe = {
    BRAND_STYLE_LIBRARY,
    OUTFIT_LIBRARY,
    contribute,
    suggestOutfit,
    pickOutfitByScene,
  };

  if (window.CrewDirector?.register) {
    window.CrewDirector.register('wardrobe', window.KolWardrobe);
  }

  console.log('[KolWardrobe] 👗 v5.13 就緒 · 14 品牌風格庫(風格特徵·非品牌名)+ 內衣安全鎖');
})();
