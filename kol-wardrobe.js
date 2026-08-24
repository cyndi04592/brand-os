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

  // ═══════════════════════════════════════════════════════════════
  //  👗 v5.19(2026-08-24)全面改寫「有品牌名」版 —— 實測驅動,不是猜的
  //
  //  【兩組 A/B 實測(RA 用服裝參考圖跑,一張 100 點)】
  //   ① The North Face
  //      🅰 寫品牌名 → LOGO 畫得完全正確、三色拼接、機能布反光、細節豐富 ✅
  //      🅱 純風格描述 → 單色平版像制服,而且褲子上冒出一個【亂碼假 LOGO】❌
  //   ② AAPE
  //      🅰 保留 camo patterns → 黑白灰迷彩全套,結構清楚,就是 AAPE ✅
  //      🅱 改成「材質色調」(拿掉迷彩)→ 變成卡其工裝外套,好看但【根本不是那個品牌】❌
  //
  //  【結論】
  //   ・寫具體的東西 > 寫抽象風格。模型認得品牌,不寫它就【自己編一個假標】,那才醜。
  //   ・「好看」和「對」是兩件事 —— 客戶選 AAPE 是要迷彩街頭,拿到日系工裝就是錯的。
  //   ・所以:品牌名 + 招牌特徵(圖案/材質/版型)全部寫清楚,不迴避。
  //
  //  【商標考量】RA 拍板:我們賣的是商品(防熊噴霧/海苔),衣服只是穿搭 ——
  //   跟明星穿名牌上節目一樣是「使用」不是「販售」。不加禁 LOGO 規則。
  //
  //  ★ casual / refined 兩版由 sceneTone() 依場景自動選(白天休閒 / 夜間精緻)。
  //  ★ 每一條都保留「品牌名 + 該品牌真正的識別特徵」,不寫空泛形容詞。
  // ═══════════════════════════════════════════════════════════════
  const BRAND_STYLE_LIBRARY = {
    // ── 日系 ──────────────────────────────────────────────
    uniqlo:    { base: 'UNIQLO lifewear, Japanese minimalist basics, solid muted colors, clean tailored fit, quality everyday fabric',
                 casual: 'UNIQLO soft cotton tee and relaxed easy pants', refined: 'UNIQLO fine merino knit and tailored trousers' },
    gu:        { base: 'GU by UNIQLO young Japanese fast-fashion, trendy affordable styling, casual playful pieces',
                 casual: 'GU oversized tee and wide-leg pants', refined: 'GU trendy layered casual look' },
    niko_and:  { base: 'niko and... Japanese zakka literary style, natural earthy tones, relaxed artsy layering, lifestyle store aesthetic',
                 casual: 'niko and... loose linen layers and comfy silhouette', refined: 'niko and... curated artsy ensemble with natural texture' },
    tnewties:  { base: '20s tnewties Japanese vintage girl style, 1920s-meets-2020s retro fashion, pintuck blouses, houndstooth and embroidery details',
                 casual: '20s tnewties retro blouse and pleated skirt', refined: '20s tnewties vintage-inspired dress with delicate details' },
    human_made: { base: 'HUMAN MADE by NIGO Japanese retro streetwear, signature heart and duck cartoon graphic prints, vintage americana casual, relaxed loose fit',
                 casual: 'HUMAN MADE graphic sweatshirt and relaxed denim', refined: 'HUMAN MADE retro varsity jacket layering' },
    aape:      { base: 'AAPE by A Bathing Ape streetwear, signature AAPE camo print, ape-head logo detail, sporty urban street style, youthful edgy fit',
                 casual: 'AAPE camo hoodie and joggers', refined: 'AAPE street-luxe layered look with camo accents' },
    beams:     { base: 'BEAMS Japanese select-shop styling, refined casual mix, quality basics with a touch of trend, effortless Tokyo city look',
                 casual: 'BEAMS relaxed shirt and easy trousers', refined: 'BEAMS smart-casual jacket over knit' },
    muji:      { base: 'MUJI no-brand quality, ultra-simple unadorned design, natural undyed cotton and linen, soft neutral palette, zero logos',
                 casual: 'MUJI plain cotton tee and drawstring pants', refined: 'MUJI simple linen shirt and straight trousers' },

    // ── 韓系 ──────────────────────────────────────────────
    mardi:     { base: 'Mardi Mercredi Korean French-leisure style, signature Flowermardi daisy print sweatshirt, sweet-cool casual vibe',
                 casual: 'Mardi Mercredi daisy floral sweatshirt and relaxed bottoms', refined: 'Mardi Mercredi minimal logo knit with clean lines' },

    // ── 台灣女裝 ──────────────────────────────────────────
    mallothi:  { base: 'Mallothi French romantic vintage, pleated and gingham dresses, literary slow-living elegance, soft pastel tones',
                 casual: 'Mallothi soft pastel cotton dress', refined: 'Mallothi pleated romantic midi dress' },
    pazzo:     { base: 'PAZZO Taiwanese good-life casual, Japanese-Korean versatile styling, flattering slim fit, comfortable quality fabric',
                 casual: 'PAZZO comfy versatile tee and slimming pants', refined: 'PAZZO elegant flattering dress' },
    caco:      { base: 'CACO Taiwanese casual everyday, cute graphic print tops, slimming relaxed urban fit',
                 casual: 'CACO cute graphic-print tee and casual bottoms', refined: 'CACO clean casual layered look' },

    // ── 精品 ──────────────────────────────────────────────
    lv:        { base: 'Louis Vuitton luxury fashion house, monogram canvas accents, refined tailoring, premium leather trim, timeless sophisticated silhouette',
                 casual: 'Louis Vuitton understated luxe knit and tailored pants', refined: 'Louis Vuitton elegant designer ensemble with monogram detail' },
    chanel:    { base: 'CHANEL French haute couture, signature tweed jacket with braided trim, camellia and pearl details, classic refined silhouette',
                 casual: 'CHANEL refined tweed-trimmed casual set', refined: 'CHANEL elegant tweed ensemble with pearl accessories' },
    hermes:    { base: 'HERMES understated ultra-luxury, impeccable saddle-stitch craftsmanship, refined neutral palette, quiet elegance without visible branding',
                 casual: 'HERMES quiet-luxury cashmere knit and tailored trousers', refined: 'HERMES impeccably tailored elegant look with silk scarf' },

    // ── 輕奢潮牌 ──────────────────────────────────────────
    gucci:     { base: 'GUCCI eclectic luxury, GG monogram and green-red web stripe, bold vintage-glam maximalist prints, statement pieces',
                 casual: 'GUCCI bold-print relaxed luxe with web stripe detail', refined: 'GUCCI glamorous statement ensemble' },
    diesel:    { base: 'DIESEL Italian denim streetwear, heavily distressed washed denim, Y2K rebellious edge, bold logo treatment',
                 casual: 'DIESEL washed distressed denim and graphic tee', refined: 'DIESEL edgy denim-layered look' },

    // ── 機能運動 / 戶外(v5.19 大幅補強:PROTEX 防熊噴霧、登山嚮導這類客戶需要)──
    on:        { base: 'On Running Swiss performance sportswear, CloudTec sole, clean technical minimal design, athletic streamlined fit',
                 casual: 'On Running sleek athleisure set', refined: 'On Running minimal sporty-chic layering' },
    tnf:       { base: 'The North Face outdoor apparel, technical shell jacket with the half-dome logo, contrast colour-block panels, performance mountain styling',
                 casual: 'The North Face fleece jacket and hiking pants', refined: 'The North Face technical shell layered over base layer' },
    patagonia: { base: 'Patagonia outdoor apparel, Synchilla fleece texture, earthy muted colour palette, understated eco-conscious mountain styling',
                 casual: 'Patagonia retro pile fleece and hiking shorts', refined: 'Patagonia weatherproof shell over merino base layer' },
    arcteryx:  { base: 'ARC TERYX technical alpine apparel, minimal seam-taped GORE-TEX shell, dead-bird logo, precision-engineered athletic cut',
                 casual: 'ARC TERYX lightweight windshell and technical pants', refined: 'ARC TERYX hardshell alpine layering system' },
    salomon:   { base: 'Salomon trail running and outdoor apparel, technical mesh panels, trail-ready streamlined fit, sporty outdoor-tech aesthetic',
                 casual: 'Salomon trail running tee and lightweight shorts', refined: 'Salomon technical windbreaker and trail pants' },
    columbia:  { base: 'Columbia outdoor sportswear, practical multi-pocket construction, approachable everyday outdoor styling, durable weatherproof fabric',
                 casual: 'Columbia fishing shirt and cargo hiking pants', refined: 'Columbia insulated jacket over fleece mid-layer' },
    montbell:  { base: 'mont-bell Japanese lightweight outdoor gear, superlight packable nylon, bright accent colours on muted base, functional minimal design',
                 casual: 'mont-bell packable windbreaker and light trekking pants', refined: 'mont-bell down inner layered under shell' },
    snowpeak:  { base: 'Snow Peak Japanese outdoor lifestyle apparel, refined camping aesthetic, natural muted tones, relaxed technical tailoring',
                 casual: 'Snow Peak flexible camp shirt and tapered pants', refined: 'Snow Peak insulated haori jacket over layers' },

    // ── 工裝 ──────────────────────────────────────────────
    dickies:   { base: 'Dickies workwear, 874 work pants silhouette, sturdy twill fabric, classic American blue-collar utility styling',
                 casual: 'Dickies work shirt and 874 straight-leg pants', refined: 'Dickies Eisenhower jacket over work shirt' },
    carhartt:  { base: 'Carhartt WIP heavy-duty workwear, Detroit jacket with corduroy collar, rugged duck canvas, boxy utilitarian fit',
                 casual: 'Carhartt duck canvas chore coat and double-knee pants', refined: 'Carhartt Detroit jacket layered over hooded sweat' },

    // ── 運動 ──────────────────────────────────────────────
    nike:      { base: 'Nike sportswear, swoosh logo, Tech Fleece and Dri-FIT materials, bold athletic silhouette, street-sport crossover',
                 casual: 'Nike Tech Fleece hoodie and joggers', refined: 'Nike sleek windrunner jacket and training pants' },
    adidas:    { base: 'adidas Originals sportswear, three-stripe detail, trefoil logo, retro track-suit silhouette, sporty heritage styling',
                 casual: 'adidas three-stripe track jacket and track pants', refined: 'adidas sleek performance layering with stripe accents' },
    lululemon: { base: 'lululemon athletic apparel, Luon and Nulu buttery-soft technical fabric, sculpted seamless fit, refined athleisure aesthetic',
                 casual: 'lululemon Align leggings and cropped tank', refined: 'lululemon Define jacket over technical top' },
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
    // 🆕 v5.19 新增
    beams: 'beams', muji: 'muji', mujirushi: 'muji',
    tnf: 'tnf', north_face: 'tnf', thenorthface: 'tnf', the_north_face: 'tnf',
    patagonia: 'patagonia', pata: 'patagonia',
    arcteryx: 'arcteryx', arc_teryx: 'arcteryx', 'arc\'teryx': 'arcteryx',
    salomon: 'salomon', columbia: 'columbia',
    montbell: 'montbell', 'mont_bell': 'montbell', 'mont-bell': 'montbell',
    snowpeak: 'snowpeak', snow_peak: 'snowpeak',
    dickies: 'dickies', carhartt: 'carhartt', carhartt_wip: 'carhartt',
    nike: 'nike', adidas: 'adidas', lululemon: 'lululemon',
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

  console.log('[KolWardrobe] 👗 v5.19 就緒 · 服裝鎖定(釘住固定服裝圖→不現生·解抽卡·保險絲 window.KOL_OUTFIT_LOCK)+ 單一真相來源 + persona 後備 + 內衣安全鎖 + 服裝參考圖');
})();
