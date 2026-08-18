// kol-product.js · v3.2 · 道具師(Prop / Product Director)
// 🆕 v3.2 服務型商品四模式(2026-08-18)
//   問題:系統原本假設「畫面中央一定有一個實體商品」。給它一張美睫成果照,
//   它找不到「商品」,就自己發明一盒假睫毛還印上品牌名;給它律師事務所,
//   連編都編不出來,直接空白。實測踩過(HH美學工作室 → AI 生出不存在的假睫毛盒)。
//   解法:沿用既有的 productMode 機制加四種,每一種都寫死「禁止捏造實體商品」。
//     service  服務成果(美睫/美甲/美髮/醫美/健身)→ 拍「做完的樣子」,不是產品
//     equip    設備製程(CNC/半導體/工廠)      → 拍機台與加工件
//     screen   螢幕成果(軟體/網站/廣告代操)     → 裝置外觀=包裝、真實截圖=內容物
//     pro      專業服務(律師/醫生/顧問)        → 拍人與專業情境,零實體
//   ★ screen 沿用海苔的「外包裝+內容物」邏輯:螢幕內容必須用客戶給的真實截圖,
//     絕不讓 AI 自己想像畫面內容(跟「不准自己想像海苔長怎樣」同一條規矩)。
// 依 productType 驅動「鎖定句」,克制不搶主體 KOL。
//   packaged 包裝商品(海苔/香腸)→ [Image2]外包裝 + [Image3]內容物(showContents)
//   dish     餐點料理(福臨門)   → [Image2]成品菜+盤,狀態鎖:已上桌·絕不下鍋
//   object   獨立物件(電扇/3C)  → [Image2]主體,形狀鎖
// 讀 products 表:productType/hasPackaging/packShape/productLook/showContents/contentsLook/realSize
// 🆕 v2.1:物理錨 GROUNDED — 給商品重量+真實接觸+重力 → 殺「魔術漂浮」,且不卡拋/放/遞動作
(function () {
  'use strict';
  // 🆕 v2.1 物理錨:有重量、與手/桌面真實接觸、遵守重力 → 殺「魔術漂浮」。
  //   刻意不寫「握緊/不准動」,所以拋球、放下、遞出等動作不會被卡死
  //   (飛出去也是「有重量的拋物線」,不是飄)。
  var GROUNDED = 'the product has real weight and makes genuine physical contact with her hand or the surface it rests on, obeying gravity so it never floats, drifts or looks weightlessly pasted onto the scene';
  function isYes(v) { return /^(是|有|y|yes|true|1)/i.test(String(v || '').trim()); }
  function findProduct(ctx) {
    if (ctx && ctx.episode && ctx.episode.product) return ctx.episode.product;
    try {
      if (typeof window.getCurrentRotationProduct === 'function') {
        const p = window.getCurrentRotationProduct();
        if (p) return p;
      }
    } catch (e) {}
    return null;
  }
  // 比例錨「臉/身體」(被參考照鎖死的部位),不錨「手」(手是生成的會飄)
  function sizeToScale(realSize) {
    const nums = (String(realSize || '').match(/\d+(?:\.\d+)?/g) || []).map(Number).filter(n => n > 0);
    if (!nums.length) return '';
    const cm = Math.max(...nums);
    if (cm <= 8)  return 'small, roughly half the height of her face';
    if (cm <= 20) return 'roughly as tall as her face';
    if (cm <= 40) return 'roughly the height of her head and neck together';
    return 'roughly as wide as her torso';
  }
  // 🆕 v3.0 大物尺度:落地家具/家電用「站在她旁邊的相對高度」,不套手持錨
  function sizeToScaleLarge(realSize) {
    const nums = (String(realSize || '').match(/\d+(?:\.\d+)?/g) || []).map(Number).filter(n => n > 0);
    if (!nums.length) return '';
    const cm = Math.max(...nums);
    if (cm <= 65)  return 'a small piece, about knee height beside her';
    if (cm <= 135) return 'about waist-to-chest height beside her, low enough for her to sit on or rest a hand on';
    if (cm <= 190) return 'roughly her own standing height';
    return 'a large piece taller than her that she stands beside';
  }
  // 決定類型:優先 productType,沒填則 hasPackaging 推(dish 推不出,必須明填)
  function resolveType(prod) {
    const t = String(prod.productType || '').trim().toLowerCase();
    if (t === 'packaged' || t === 'dish' || t === 'object') return t;
    if (/餐點|料理|菜|dish|food/.test(t)) return 'dish';
    if (/包裝|packaged/.test(t))           return 'packaged';
    if (/物件|object|電器|appliance/.test(t)) return 'object';
    return isYes(prod.hasPackaging) ? 'packaged' : 'object';
  }

  // 🆕 v3.0 模式驅動:商品「主模式」決定擺法。只有「明設 productMode」才走新模式;
  //   沒設 → resolveMode 回 null → 落到下面 v2.2 原本的 packaged/dish/object 分支(海苔等舊商品輸出一字不變)。
  function resolveMode(prod) {
    const m = String(prod.productMode || '').trim().toLowerCase();
    if (m === 'held' || m === 'worn' || m === 'hero' || m === 'demo' || m === 'digital') return m;
    // 🆕 v3.2 服務型四模式
    if (m === 'service' || m === 'equip' || m === 'screen' || m === 'pro') return m;
    if (/美睫|美甲|美髮|醫美|護膚|成果|service/.test(m)) return 'service';
    if (/機台|設備|加工|製程|工廠|CNC|半導體|equip/i.test(m)) return 'equip';
    if (/螢幕|畫面|截圖|軟體|網站|後台|screen/.test(m)) return 'screen';
    if (/律師|醫生|顧問|專業|事務所|pro\b/.test(m)) return 'pro';
    if (/手持|小物|held/.test(m)) return 'held';
    if (/穿戴|wear|worn/.test(m)) return 'worn';
    if (/主角|大物|家具|家電|hero|furniture|appliance/.test(m)) return 'hero';
    if (/示範|使用|操作|噴|擦|塗|demo|spray|apply/.test(m)) return 'demo';
    if (/數位|服務|軟體|課程|體驗|digital|service|software/.test(m)) return 'digital';
    return null;
  }
  function contributeNewMode(prod, mode, scale) {
    const sz = scale ? '; it is ' + scale + ', at that true size' : '';
    if (mode === 'held') {
      return 'PROP (a small product she is holding — keep it subtle and natural, do NOT overpower the subject): keep the product in [Image2] consistent in shape, proportions, color and any printed text, never mirrored or flipped, do not distort or morph it' + sz + '; ' + GROUNDED + ', its front kept toward the camera and recognizable while held; it may also rest naturally on a clean surface, never scattered messily';
    }
    if (mode === 'worn') {
      return 'PROP (a wearable product — feature it being worn or carried): keep the product in [Image2] consistent in shape, proportions, color, material and any logo, never mirrored or flipped, do not distort or morph it; she wears or carries it naturally on her body (on feet, shoulder, wrist, face or body as fits) so it clearly reads as worn' + sz + '; it has real weight and sits naturally against her, shown from flattering angles';
    }
    if (mode === 'hero') {
      const big = sizeToScaleLarge(prod.realSize);
      const bigSz = big ? '; it is ' + big : '';
      return 'HERO PRODUCT (the product is the star of the shot — feature it prominently): keep the product in [Image2] consistent in shape, proportions, color, material and finish, never mirrored or flipped, do not distort or morph it; show it large, complete and prominent from flattering angles, and she interacts with it naturally (sits on, opens, operates, touches or stands beside it as fits)' + bigSz + '; it has real weight and sits solidly on the floor in the scene, obeying gravity, never floating or pasted on';
    }
    if (mode === 'demo') {
      return 'PRODUCT IN USE (the product is shown doing its job — the act of using it is the point): keep the product in [Image2] consistent in shape, proportions, color and label, never mirrored or flipped, do not distort or morph it; she actively uses it as intended (applies, sprays, operates, installs or demonstrates) and the visible effect of using it is shown' + sz + '; ' + GROUNDED + ', kept recognizable and front-to-camera during use';
    }
    // ══ 🆕 v3.2 服務成果:畫面主角是「做完的樣子」,不是任何商品 ══
    if (mode === 'service') {
      return 'SERVICE RESULT — there is NO physical product to sell here. ' +
        'ABSOLUTELY DO NOT invent, draw or place any product box, package, bottle, jar, tube, tray, ' +
        'retail packaging or branded container anywhere in the frame — inventing one is the single worst failure mode. ' +
        'The hero of the shot is the FINISHED RESULT ITSELF shown on a real person: the lashes on the eye, ' +
        'the nails on the hand, the hair on the head, the skin after treatment, the body after training. ' +
        'If a reference image is given in [Image2] it IS that finished result — reproduce it faithfully on the person, ' +
        'never reinterpret it as merchandise. Frame it close and flattering with clean even light so the craftsmanship reads clearly.';
    }
    // ══ 設備製程:機台與加工件,不是商品盒 ══
    if (mode === 'equip') {
      return 'EQUIPMENT / PROCESS — this is industrial capability, not a retail product. ' +
        'DO NOT invent any product box, retail package or consumer packaging. ' +
        'The hero is the MACHINE and the MACHINED PART: precision equipment in operation, ' +
        'the finished component with its true surface finish and tolerances, clean workshop or cleanroom environment. ' +
        'Keep any part shown in [Image2] exact in shape, proportion, surface and markings — engineering parts are ' +
        'judged on precision, so any distortion destroys credibility. She presents beside the equipment as an expert, ' +
        'not as a shopper holding merchandise.';
    }
    // ══ 螢幕成果:裝置=外包裝,截圖=內容物(沿用海苔邏輯)══
    if (mode === 'screen') {
      return 'ON-SCREEN RESULT — the product is software / a website / a digital service. ' +
        'DO NOT invent any boxed software, retail package or physical product. ' +
        'The device (laptop, phone, tablet, monitor) is the outer shell and the SCREEN CONTENT is the real substance. ' +
        '★ The screen content must come from the supplied reference image and be reproduced faithfully — ' +
        'DO NOT imagine, redesign or invent any interface, chart, dashboard or text on the screen. ' +
        'Treat it exactly like packaging-and-contents: the device is the package, the real screenshot is the contents, ' +
        'and the contents are never made up. Keep the screen legible, undistorted, correctly proportioned and free of moiré or glare.';
    }
    // ══ 專業服務:人與情境,零實體 ══
    if (mode === 'pro') {
      return 'PROFESSIONAL SERVICE — there is no physical product at all. ' +
        'DO NOT invent, draw or place any product, package, box, bottle or branded merchandise anywhere. ' +
        'The subject IS the offering: her expertise, presence and setting carry the message. ' +
        'Place her in a credible professional environment (office, meeting, consultation, courtroom-adjacent, clinic) ' +
        'with authentic tools of that trade only where natural (documents, screen, notes) and never as a hero object. ' +
        'Lighting is clean and trustworthy; posture and framing convey competence and calm authority rather than sales energy.';
    }
    if (mode === 'digital') {
      return 'NO PHYSICAL PRODUCT — this is a digital product or service: she does NOT hold any physical item and no fake package is invented. She presents it through a device she is using (laptop, phone or tablet) or through the visible real-world outcome and experience it delivers, talking naturally to camera about its value; if a logo or screen is given in [Image2] it appears on the device screen, kept clean, correct and undistorted';
    }
    return null;
  }

  function contribute(ctx) {
    const prod = findProduct(ctx);
    if (!prod) {
      return 'PROP (a supporting object she is holding — keep it subtle, do NOT overpower the subject): keep the product in [Image2] consistent in shape, proportions and color, never mirrored or flipped, at a believable real-world scale, do not distort or morph it; ' + GROUNDED + ', its front kept toward the camera and recognizable while held, moving on a natural weighted arc if the action calls for it';
    }
    // 🆕 v3.0:有明設 productMode → 走新模式;沒設(海苔等舊商品)→ 往下走 v2.2 原本邏輯,一字不變
    const mode = resolveMode(prod);
    if (mode) {
      const mc = contributeNewMode(prod, mode, sizeToScale(prod.realSize));
      if (mc) return mc;
    }
    const type = resolveType(prod);
    const scale = sizeToScale(prod.realSize);
    const bits = [];

    if (type === 'dish') {
      const look = (prod.productLook || prod.prodName || '').trim();
      bits.push('the product in [Image2] is a FINISHED, fully plated dish served on its plate' + (look ? ' (' + look + ')' : '') + ', shown as a completed appetizing dish matching [Image2]');
      bits.push('it appears ONLY as a finished plated dish — the chef presents, serves, plates or lightly garnishes it; the plated dish is NEVER placed into a pan, wok or pot, never fried, boiled, cooked or shown raw, the plate stays intact and never goes on a stove');
      bits.push('the plate and the food on it are the FINAL SERVED RESULT and are never an ingredient; if any cooking action appears it uses only loose raw ingredients in the cookware, while THIS plated dish and its plate are never tossed, dropped, poured or placed into any pan, wok, pot or onto any stove or flame, and the plate is never treated as food to be cooked');
      if (scale) bits.push('the plated dish is ' + scale + ', at that true size');
      bits.push('presented appetizing and intact, the plate facing the camera, minimal movement so it stays recognizable');
      return 'PROP (the plated dish she is presenting — keep it natural, do NOT overpower the subject): ' + bits.join('; ');
    }

    if (type === 'packaged') {
      const desc = [(prod.packShape || '').trim(), (prod.productLook || '').trim()].filter(Boolean).join('、');
      bits.push(desc
        ? 'the packaged product in [Image2] is ' + desc + ', keep its packaging shape, color and label consistent and undistorted, its printed brand text reading correctly and never mirrored, reversed or flipped, matching [Image2] exactly'
        : 'keep the packaging in [Image2] consistent in shape, proportions, color and label, printed text never mirrored or flipped, do not distort or morph it');
      if (isYes(prod.showContents) && (prod.contentsLook || '').trim()) {
        bits.push('its contents shown in [Image3] look like ' + prod.contentsLook.trim() + ', keep this shape, count and texture natural and stable, do not morph (loose pieces may vary naturally)');
      }
      if (scale) bits.push('the product is ' + scale + ', shown at that true size against her body');
      bits.push(GROUNDED + ', its printed front and label kept toward the camera and recognizable while held, moving on a natural weighted arc if the action calls for it');
      return 'PROP (a supporting product she is holding — keep it subtle and natural, do NOT overpower the subject): ' + bits.join('; ');
    }

    // object
    const look = (prod.productLook || '').trim();
    bits.push('keep the product in [Image2] consistent in shape, proportions and color' + (look ? ' (' + look + ')' : '') + ', never mirrored or flipped, do not distort or morph it');
    if (scale) bits.push('the product is ' + scale + ', shown at that true size');
    bits.push(GROUNDED + ', its front kept toward the camera and recognizable while held, moving on a natural weighted arc if the action calls for it');
    return 'PROP (the product she is using or showing — keep it subtle and natural, do NOT overpower the subject): ' + bits.join('; ');
  }

  window.KolProduct = { contribute, isYes, sizeToScale, resolveType, version: 'v3.1', resolveMode };
  console.log('[KolProduct] 🎒 v3.1 就緒 · 道具師·模式驅動(7模式:手持/包裝/盛盤/穿戴/主角大物/操作示範/數位服務 · 只有設productMode才走新模式·海苔等舊商品原樣不變) + 物理錨 + 尺度錨臉身體 + 🍽盤子絕不下鍋鎖強化');
})();
