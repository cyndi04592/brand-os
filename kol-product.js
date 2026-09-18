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
  //  🩳 2026-09-13 v3.50 去重(RA:提示詞快滿 4000,客戶多打兩個字就爆)
  //  ★ 病:七個商品模式【每一個都重寫一次】同一句
  //    「keep the product in [Image2] consistent in shape, proportions, color, material
  //     and any logo, never mirrored or flipped, do not distort or morph it」(約 140 字),
  //    而這句跟 kol-stitch 資產標註區的「keep every detail of each identical」完全重複 ——
  //    標註區已經在鎖一致性,這裡等於同一件事講了八遍。
  //  ★ 每個模式真正獨有的只有「她怎麼跟它互動」那半句,以及該品類要特別讀對的細節
  //    (印刷文字 / 布料花紋 / logo / 表面處理 / 標籤),那些保留。
  //  ★ 實測 tail 1216 字 → 約 600,而且一條規則都沒刪。
  //  ★ v3.51:補掉另外兩條漏網的同款重複 —— 包裝模式(435)與通用 fallback(454)。
  //    ⚠️ 教訓:同一句話在這個檔裡有【八份】,只清六份等於沒清乾淨。
  //    改任何字串前先 grep 數量,今天已經因為「只改一份」踩過三次。
  // 🆕 v2.1 物理錨:有重量、與手/桌面真實接觸、遵守重力 → 殺「魔術漂浮」。
  //   刻意不寫「握緊/不准動」,所以拋球、放下、遞出等動作不會被卡死
  //   (飛出去也是「有重量的拋物線」,不是飄)。
  // ══════════════════════════════════════════════════════════════════
  //  ✂️ 2026-09-11 · 去背毛邊(公版 —— RA 拍板:不是只有內衣)
  //  ────────────────────────────────────────────────────────────────
  //  ★ 病:全系統沒有任何一句教模型忽略參考圖的去背殘留。
  //    每個模式都在說「keep the product in [Image2] consistent」,
  //    模型就忠實地把白邊、鋸齒、半透明殘留像素也當成商品的一部分
  //    畫出來 —— 近拍特別明顯。不是渲染爛,是它太聽話。
  //  ★ 客戶上傳的商品圖【幾乎都是去背過的】(電商主圖慣例),
  //    所以這是所有模式的共同問題,不該只補在某一種。
  //  ★ 掛在 contribute() 的【唯一出口】:16 種新模式 + 舊 type 邏輯
  //    全部從那裡回傳,一處掛全部,不用改 16 個地方。
  //  ★ 用 '; ' 接成獨立子句 → fitRules 會當成一條可切的規則。
  //    它排在最後,預算真的爆掉時第一個被犧牲 —— 這是刻意的:
  //    毛邊難看,但比不上「商品被畫成別的東西」嚴重。
  // ══════════════════════════════════════════════════════════════════
  //  ✂️ v5.38(2026-09-15)去背毛邊:列四種毛邊 → 一句正面。
  //   舊句列了 white halo / ragged matting edge / drop shadow / leftover background pixels,
  //   四個詞等於把四種毛邊的樣子餵給模型(RA 鐵律:點名即召喚,而且清單永遠列不完)。
  //   正面版本本來就在句尾了(render clean natural edges lit by the scene),留那一句就夠。
  //   16 個模式共用這條,砍一次全部受惠:199 → 75 字。
  var CUTOUT_EDGE = 'the product reference is a cutout — render its edges clean and lit by the scene';

  //  ✂️ v5.39(2026-09-15)GROUNDED 195 → 105 字。
  //   舊句用四個說法講「不會飄」:never floats / drifts / looks weightlessly pasted /
  //   makes genuine physical contact —— 而「有重量、照重力」本身就涵蓋全部。
  //   16 個模式共用這條,砍一次全部受惠。
  var GROUNDED = 'the product has real weight and rests on her hand or the surface under it, obeying gravity';

  //  ✂️ v5.41(2026-09-15)「不要無中生有商品盒」六個模式各列一份清單:
  //    service: box/package/bottle/jar/tube/tray/retail packaging/branded container(199字)
  //    equip:   product box/retail package/consumer packaging(67)
  //    screen:  boxed software/retail package/physical product(68)
  //    agency:  product box/retail package/disc/branded merchandise/shrink-wrapped(123)
  //    medical: product box/package/ampoule/branded syringe/retail container(87)
  //    course:  product box/kit/boxed set/retail container(89)
  //   —— 全部都在講同一件事,而且每個模式開頭已經明講「這裡沒有實體商品」。
  //   點名那些容器等於把它們餵給模型(RA 鐵律)。改成一句正面陳述,六處共用。
  var NO_BOX = 'nothing here is boxed or packaged';
  //  📏 v5.42(2026-09-16)拿掉五份「keep it subtle / do NOT overpower the subject」
  //   RA 實測:她從箱子拿出來的海苔包比真實尺寸小一截;同一支片裡桌上沒被操作、
  //   背景模糊的那幾包反而是對的大小。差別只在【手上那包吃到了這句】。
  //   ★ 「低調、別搶過主體」對模型來說最直接的做法就是把東西縮小。
  //   ★ 尺寸不靠 realSize(RA:客戶量了公分 AI 也用不上,頭/手當比例尺都試過),
  //     改成一句正面事實 at its real-life size,讓模型用它自己知道的日常尺寸。
  //   ★ 五份一起改(held / fallback / dish / packaged / object),只改一份等於沒改。
  //     worn / hero / demo 本來就沒有這句。
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
    // 🆕 v3.7 貼身衣物守門(在所有判斷之前):
    //   ★ 只覆寫『穿戴』與『沒選/自動』這兩種 —— 因為對內衣而言那兩個一定是錯的。
    //   ★ 客戶若刻意選了 hero/demo 等其他模式,尊重他的選擇,不覆寫。
    //   RA 產品原則:不教客戶做對的事,讓預設就是對的事。
    if (m === 'innerwear') return 'innerwear';
    if (!m || m === 'auto' || m === 'worn') {
      const hay = [prod && prod.name, prod && prod.prodName, prod && prod.tag,
                   prod && prod.subName, prod && prod.productLook].filter(Boolean).join(' ');
      if (hay && INNER_RE.test(hay)) return 'innerwear';
    }
    if (m === 'held' || m === 'worn' || m === 'hero' || m === 'demo' || m === 'digital') return m;
    // 🆕 v3.2 服務型四模式
    if (m === 'service' || m === 'equip' || m === 'screen' || m === 'pro') return m;
    // 🆕 v3.3(2026-08-19)與廣告圖 ⓪ 商品型態對齊,新增五種
    if (m === 'beauty' || m === 'medical' || m === 'course' ||
        m === 'mystic' || m === 'travel'  || m === 'wellness') return m;
    if (/醫美|診所|皮膚科|牙醫|微整|medical/.test(m))                     return 'medical';
    if (/課程|瑜伽|瑜珈|舞蹈|健身|才藝|補習|家教|師資|course/.test(m))     return 'course';
    if (/塔羅|八字|紫微|占卜|命理|風水|mystic/.test(m))                   return 'mystic';
    if (/旅遊|行程|導遊|旅行社|一日遊|自由行|travel/.test(m))              return 'travel';
    if (/水晶|串珠|能量手環|開運|wellness/.test(m))                       return 'wellness';
    if (/美睫|美甲|美髮|醫美|護膚|成果|service/.test(m)) return 'service';
    if (/機台|設備|加工|製程|工廠|CNC|半導體|equip/i.test(m)) return 'equip';
    if (/螢幕|畫面|截圖|軟體|網站|後台|screen/.test(m)) return 'screen';
    // 🆕 v3.4 行銷代操 / 系統服務(要排在 pro 之前,否則「品牌顧問」被 pro 先攔走)
    if (m === 'agency') return 'agency';
    if (/行銷|代操|廣告公司|品牌顧問|社群經營|投放|素材代製|agency/.test(m)) return 'agency';
    if (/律師|醫生|顧問|專業|事務所|商標|專利|pro\b/.test(m)) return 'pro';
    if (/手持|小物|held/.test(m)) return 'held';
    if (/穿戴|wear|worn/.test(m)) return 'worn';
    if (/主角|大物|家具|家電|hero|furniture|appliance/.test(m)) return 'hero';
    if (/示範|使用|操作|噴|擦|塗|demo|spray|apply/.test(m)) return 'demo';
    if (/數位|服務|軟體|課程|體驗|digital|service|software/.test(m)) return 'digital';
    // ═══════════════════════════════════════════════════════════
    //  🆕 v3.5(2026-08-19)自動判斷:沒設 productMode 時,用商品名稱推。
    //   為什麼要有這段:以前「自動 · 依商品判斷」對服務類等於完全沒判斷 ——
    //     客戶打「日式接睫」,畫面層回 null → 落到 object 分支 → 被當成一件實體物品,
    //     AI 很可能就生出一盒假睫毛。那正是這整套型態系統要防的事。
    //   ★ 分類來源只有一個:kol-compliance.js 的 resolveRule。
    //     不在這裡另寫關鍵字表 —— 兩份表遲早會走鐘,變成台詞判美業、畫面判一般商品。
    //   ★ 三個安全閥:
    //     ① 上面的「明設 productMode」永遠先跑,手動選擇壓過自動判斷
    //     ② isProductForm:有包裝的實體商品不轉服務型
    //        (指甲油判成 beauty 是對的,化粧品法要管台詞;但畫面層一轉 service
    //         就變成「不准畫任何瓶罐」,客戶的指甲油會直接消失)
    //     ③ 整段包 try:KolCompliance 沒載入也只是回 null 走舊路,不會壞
    return _autoModeFromName(prod);
  }

  // 台詞層分類 → 畫面層模式。查不到就 null(海苔、炒菜等舊商品走原本邏輯,輸出一字不變)
  const RULE_TO_MODE = {
    beauty: 'service', medical: 'medical', course: 'course',
    mystic: 'mystic',  travel: 'travel',   wellness: 'wellness',
    pro: 'pro',        agency: 'agency',
  };
  // 這幾種畫面模式會寫死「不准畫任何商品盒/瓶罐」,套錯在有包裝的商品上會讓商品消失
  const NO_PRODUCT_MODES = { service: 1, medical: 1, course: 1, mystic: 1, travel: 1, pro: 1, agency: 1 };

  // 🆕 v3.5b 純畫面型態(網站 / 軟體 / 機台 / 訂閱)——這三種「沒有專屬法規」,
  //   所以合規模組那張表不會收它們(那張表管的是法規,不是畫面)。
  //   但它們同樣「沒有實體商品可拍」,漏判的話 AI 會生出盒裝軟體、假機台包裝。
  //   ⚠️ 鐵律:凡是「有法規要管」的行業,一律交給 kol-compliance.js,不准寫在這裡,
  //     否則兩張表會走鐘。這裡只補「法規管不到、但畫面會出事」的那幾種。
  const SCREEN_RE = /官網|網站|網頁|後台|儀表板|軟體|系統平台|線上系統|APP|SaaS/i;
  const EQUIP_RE  = /機台|設備|CNC|半導體|工廠|加工|製程|產線|模具|射出/i;
  const DIGI_RE   = /訂閱制|會員制|線上訂閱|月費方案|年費方案/;
  // 🆕 v3.7 貼身衣物(內衣/胸罩/內褲/NuBra/塑身衣)——這類商品是【內層】,
  //   套到通用 'worn'(『清楚看得出穿著在身上』)會讓模型把內衣畫在襯衫外面。
  //   ⚠️ 泳裝/比基尼【故意不收】:它是單穿的外層,規則不同,另開模式,不要順手塞進來。
  const INNER_RE  = /內衣|內著|胸罩|內褲|無鋼圈|бра|bra|bralette|lingerie|nubra|nu bra|塑身衣|貼身衣物|бюст/i;

  function _autoModeFromName(prod) {
    try {
      const C = window.KolCompliance;
      const hay = [prod && prod.name, prod && prod.prodName, prod && prod.tag]
        .filter(Boolean).join(' ');
      const isProd = (C && typeof C.isProductForm === 'function') ? C.isProductForm(prod) : false;

      // ① 法規行業優先(唯一分類來源:kol-compliance.js)
      if (C && typeof C.resolveRule === 'function') {
        const rule = C.resolveRule(prod);
        const mode = rule ? RULE_TO_MODE[rule] : null;
        if (mode) {
          // 安全閥②:看得到包裝的實體商品,絕不套用「無實體商品」那類畫面守則
          if (NO_PRODUCT_MODES[mode] && isProd) return null;
          return mode;
        }
      }

      // ② 純畫面型態(這三種也都是「沒有實體商品」,有包裝就代表判錯了,不套)
      if (!hay || isProd) return null;
      if (SCREEN_RE.test(hay)) return 'screen';
      if (EQUIP_RE.test(hay))  return 'equip';
      if (DIGI_RE.test(hay))   return 'digital';
      return null;
    } catch (e) { return null; }
  }
  function contributeNewMode(prod, mode, scale) {
    const sz = scale ? '; it is ' + scale + ', at that true size' : '';
    if (mode === 'held') {
      const _hm = materialOf(prod).pack;   // 🧱 v5.44
      return 'PROP (a small product she is holding, at its real-life size): its printed text reads correctly' + sz + (_hm ? '; ' + _hm : '') + '; ' + GROUNDED + ', its front kept toward the camera and recognizable while held; it may also rest naturally on a clean surface, never scattered messily';
    }
    // ══ 🆕 v3.7 貼身衣物:唯一講清楚「內層」的模式 ══
    //   為什麼要獨立一條:通用 'worn' 說的是「清楚看得出穿在身上」,
    //   模型拿到一張內衣平面圖 + 這句話 → 最省事的解法就是貼在最外層。
    //   這條把三件事一次講死:①內層 ②不准穿在衣服外面 ③只從外衣敞開處露出。
    if (mode === 'innerwear') {
      // ⚠️ 全條【不准出現分號或句點+空白】——kol-stitch.js 的 fitRules 用「. 」和「; 」切規則,
      //   只有切完的【第一段】無條件保底。有分號 = 核心句「穿在外衣底下」會被砍掉。
      //   所以這條刻意只用逗號,整條綁在一起,永遠送得出去。
      // ⚠️ 不要再往這條加否定句。『她穿著什麼外衣』由服裝師(kol-wardrobe.js)負責講,
      //   這裡只負責講「內衣在外衣底下」這一件事,講一次就好。
      //  📦 2026-09-05 兩槽點名:內衣需要正面 + 背面才畫得準(肩帶走向、背扣、蕾絲接縫)。
      //    ⚠️ 兩張是【同一件的兩個角度】,不是兩件商品 —— 這句一定要寫,
      //      否則模型會當成兩件不同的衣服,把正反面的特徵混在一起(logo 正反都有、肩帶多一條)。
      //    只有真的給了第二張才寫,沒給不要提,免得模型自己想像一個背面。
      //  🧵 2026-09-11 · 補「材質行為」(RA 現場抓到:內衣拿起來像硬板子)
      //    ★ 病:這條從頭到尾只講【不准變形】——shape / proportions / color /
      //      fabric and lace pattern / never mirrored or flipped,全是約束,
      //      沒有一個字講「它是軟的」。模型收到「照著畫、不准變形」之後,
      //      最安全的解法就是畫成一塊硬板 —— 因為軟的東西會變形,
      //      而「不准變形」是它唯一收到的鐵律。
      //    ★ 隔壁模式早就有這句了,只有 innerwear 漏掉:
      //        worn → 'it has real weight and sits naturally against her'
      //        hero → 'it has real weight and sits solidly on the floor, obeying gravity'
      //    ★ 放在保底條(第一條)裡:材質行為是「這是什麼東西」的一部分,
      //      被砍掉就會退回硬板子。用逗號接,不製造切點。
      //
      //  ✂️ 同日 · 補「忽略去背邊緣」(RA 現場抓到:近拍有毛邊)
      //    ★ 病:全系統沒有任何一句教模型忽略參考圖的去背殘留。
      //      指令只說「照著 [Image2]、保持一致」,模型就忠實地把白邊、
      //      鋸齒、半透明殘留像素也當成商品的一部分畫出來。太聽話而已。
      //    ★ 這句刻意用 '; ' 起頭,讓它獨立成【第二條】——
      //      重要但不是核心,預算真的爆掉時可以犧牲;排第二則幾乎不會被砍到
      //      (fitRules 是照順序留到預算用完為止)。
      //    ⚠️ 目前只掛在 innerwear。毛邊對所有去背商品圖都會發生,
      //      要不要提升成全模式共用,等這次實測看效果再決定。
      //  ✂️ v5.38:拿掉開頭「its fabric and pattern read correctly」——
      //    資產標註區已經鎖了形狀/顏色/材質(Image2 = the product, keep every detail identical),
      //    這句沒有增加任何資訊,是純重複。
      return 'PROP (intimate apparel, worn as the inner layer)'
        + (isYes(prod && prod.showContents) ? ', with [Image3] showing the SAME single garment from the back (same piece, not a second garment) — match its strap routing, back closure and lace seams' : '')
        + ', the fabric is soft and lightweight with natural drape, cups and straps yielding and slightly deformable, folding and creasing where held or worn, never stiff, boardlike or molded plastic'
        //  ═══════════════════════════════════════════════════════════════
        //  👗 v5.34(2026-09-14)拿掉「穿在外出服底下、從敞開的領口被瞥見」那一句。
        //   病灶(RA 2026-09-14 實測,連續兩支):同一份 prompt 裡有兩句在對著幹 ——
        //     Image3 = outfit (same garment throughout; do not restyle)  ← 照服裝圖穿
        //     這一句 = 要讓商品從敞開的領口露出來                        ← 要求露
        //   服裝圖本身又沒有領口可言,模型要同時滿足兩邊,只能【把外層拿掉】,
        //   於是第一段整件外層消失、只剩商品,第二段才照服裝圖穿 —— 兩段穿著不一致。
        //   ★ RA 拍板:穿著只有一個來源 = 服裝圖。文字一個字都不要碰穿著。
        //     這條跟 kol-proxy v4.82「分鏡不寫衣服」是同一條原則,
        //     只是那條只管到分鏡,這句一直在道具師這邊沒被管到。
        //   ★ 道具師只負責【商品本身】:材質、形狀、不變大小、去背毛邊。
        //     「她怎麼穿」是服裝師(kol-wardrobe)＋服裝圖的事。
        //   ⚠️ 不要因為「商品看不到」就把這句加回來 —— 那正是這個 bug 的起點。
        //     商品要被看見,靠的是【沒有台詞的 B-roll 特寫】,不是把她的衣服脫掉。
        //  ═══════════════════════════════════════════════════════════════
        //  👗 v5.35(2026-09-15)把「她身上有外層」這個【事實】補回來,但不指揮怎麼穿。
        //   RA 回報:內衣穿反這件事【以前六次偶爾一次,拿掉那句之後幾乎每次都發生】。
        //   ★ 原因想通了:v5.34 拿掉的那句雖然在指揮「怎麼露」(跟服裝圖打架,該拿掉),
        //     但它同時是【唯一一句宣告「她身上有外層」的話】。拿掉之後,
        //     整份 prompt 沒有任何一句說她穿著外層 —— 而商品本身就是一件可以穿的衣服,
        //     模型就把商品當成她身上唯一那件在穿。
        //   ★ 修法:只留【事實陳述】—— 她穿著服裝參考圖那一套,商品在那一套底下。
        //     不寫「從領口露出來」「敞開」「被瞥見」這類【指揮怎麼露】的字,
        //     那些是服裝圖的工作,寫了就會打架(v5.34 的教訓照樣成立)。
        //   ★ 商品要被看見,還是靠沒有台詞的 B-roll 特寫,不是靠把外層弄開。
        //  ═══════════════════════════════════════════════════════════════
        + ', and she is wearing it underneath the outfit shown in the outfit reference image, which stays on her throughout'
        ;
    }
    if (mode === 'worn') {
      const _wm = materialOf(prod).pack;   // 🧱 2026-09-17 穿戴也教材質(鞋/包/錶/飾品/衣)
      return 'PROP (a wearable product — feature it being worn or carried): its logo reads correctly; she wears or carries it naturally on her body (on feet, shoulder, wrist, face or body as fits) so it clearly reads as worn' + sz + (_wm ? '; ' + _wm : '') + '; it has real weight and sits naturally against her, shown from flattering angles';
    }
    if (mode === 'hero') {
      const big = sizeToScaleLarge(prod.realSize);
      const bigSz = big ? '; it is ' + big : '';
      return 'HERO PRODUCT (the product is the star of the shot — feature it prominently): its finish reads correctly; show it large, complete and prominent from flattering angles, and she interacts with it naturally (sits on, opens, operates, touches or stands beside it as fits)' + bigSz + '; it has real weight and sits solidly on the floor in the scene, obeying gravity, never floating or pasted on';
    }
    if (mode === 'demo') {
      const _dm = materialOf(prod).pack;   // 🧱 2026-09-17 示範也教材質(噴霧瓶/軟管/瓶罐)
      return 'PRODUCT IN USE (the product is shown doing its job — the act of using it is the point): its label reads correctly; she actively uses it as intended (applies, sprays, operates, installs or demonstrates) and the visible effect of using it is shown' + sz + (_dm ? '; ' + _dm : '') + '; ' + GROUNDED + ', kept recognizable and front-to-camera during use';
    }
    // ══ 🆕 v3.2 服務成果:畫面主角是「做完的樣子」,不是任何商品 ══
    if (mode === 'service') {
      //  ✂️ v5.47(2026-09-18)照 RA 的方法盤過這一段,五個問題一次解:
      //   ① 「沒有實體商品要賣」+ NO_BOX 是同一件事講兩次,而且 boxed/packaged
      //      是點名即召喚 → 改成一句正面事實:成果長在人身上。
      //   ② 五種工藝(睫毛/指甲/頭髮/皮膚/身材)每次全送 —— 客戶只做一種,
      //      另外四種是干擾 → 依商品類型只送當下那一種。
      //   ③ 「never reinterpret it as merchandise」是①的第三份 → 刪。
      //   ④ 去背毛邊句重複(v5.38 已在出口統一加 _withEdge)→ 刪。
      //   ⑤ 缺【特徵鎖】—— 只寫「忠實重現」,所以客人要鮑伯頭可能生出龐克頭、
      //      要法式美甲生出彩繪 → 補一句:形狀、長度、顏色、質感照參考圖。
      //      這一句美睫、美甲、美髮、醫美一起受惠。
      //   ⚠️ 保留機制:左右對稱鎖(參考圖只拍一隻眼 ≠ 只做一隻眼)是實測踩過的致命傷。
      const _craftTxt = String((prod && (prod.prodTag || prod.prodName || prod.name)) || '');
      const _craft =
        /睫/.test(_craftTxt)                    ? 'lash extensions on her eyes' :
        /甲|指彩/.test(_craftTxt)               ? 'nail work on her hands' :
        /髮|美髮|染|燙|剪髮/.test(_craftTxt)     ? 'hairstyle on her head' :
        /健身|體態|塑身|重訓/.test(_craftTxt)    ? 'trained body' :
        /醫美|皮膚|臉部|保養|療程/.test(_craftTxt) ? 'skin after the treatment' :
        /眉|霧眉|繡眉/.test(_craftTxt)          ? 'brow work on her face' :
        'finished result';
      return 'SERVICE RESULT — the hero of this shot is the ' + _craft + ', worn by a real person. ' +
        '[Image2] is that finished result and it appears on her exactly as photographed — same shape, length, ' +
        'colour, texture and finish, nothing redesigned. ' +
        'She had the whole service done, so it reads complete on both sides in every shot; ' +
        'a reference showing one eye, one hand or one side is a sample of the craft, not a map of where to apply it. ' +
        'Frame it close enough that the craftsmanship reads clearly';
    }

    if (mode === 'equip') {
      //  ✂️ v5.49:拿掉「not a retail product / nothing boxed / not as a shopper holding merchandise」——
      //   三句否定講同一件事,retail / boxed / merchandise 全是點名。保留機台照與加工件照的鎖。
      return 'EQUIPMENT AND THE PART IT MAKES — the machine in [Image2] keeps its exact shape, proportion, surface and markings, '
        + 'and the component in [Image3] is what this machine produces, with its true surface finish, geometry and markings. '
        + 'Engineering is judged on precision, so both stay dimensionally honest. '
        + 'She stands beside the running equipment as the expert who operates it';
    }

    if (mode === 'screen') {
      //  ✂️ v5.49(2026-09-18)照 RA 的方法精簡:五個否定,而且把 imagine / redesign / invent /
      //   interface / chart / dashboard / logo / moiré / glare 全部點名 —— 點到的東西模型反而會去畫。
      //   ★ 語意一句沒掉:畫面照參考圖、清楚不變形、沒給機型就用中性裝置或整面填滿。
      return 'ON-SCREEN RESULT — the interface in [Image2] is the product itself: it appears on the screen exactly as supplied, '
        + 'same layout, same numbers, same text, legible and square to the lens. '
        + 'It is the screen that emits it, either filling the frame as a clean display or carried by a plain device left soft in the background';
    }

    if (mode === 'pro') {
      //  ✂️ v5.49:舊版一句話點名五樣(product/package/box/bottle/merchandise),等於全召喚出來。
      //   改成正面:主角是她本人與她工作的地方。
      return 'PROFESSIONAL SERVICE — the subject is her and the room she works in: she is already at the desk or table '
        + 'where this work happens, with the papers, screen or notes of that trade lying where they are actually used. '
        + 'Her posture and the framing carry competence and calm rather than sales energy';
    }

    if (mode === 'agency') {
      //  ✂️ v5.49:舊版五個否定,還把 dashboard / chart / graph / metric / logo /
      //   versus split / ranking / scoreboard / crossed-out competitor 一路點名 ——
      //   比較版面就是這樣被叫出來的。法規交給 kol-compliance,這裡只寫畫面。
      //   ★ 語意保留:螢幕要嘛照參考圖、要嘛糊掉;畫面裡只有她自己的工作,沒有第二方可比。
      return 'AGENCY AT WORK — the subject is the working moment: she reviews material, talks it through with a client, '
        + 'or presents at her desk in a real workspace with its ordinary clutter. '
        + 'Any screen in frame either shows the supplied reference image exactly or sits soft and unreadable behind her. '
        + 'Everything in frame is her own work, shown on its own. Advisory and unhurried';
    }

    if (mode === 'medical') {
      //  ⚖️ v5.48(2026-09-18)RA:「法規你不要提醒它什麼能講什麼不行,這樣就跟木偶事件一樣」——
      //   舊版寫「DO NOT construct any before/after comparison — regulation forbids it」,
      //   影片模型對否定句不敏感、對名詞敏感 → 讀到 before/after 反而更容易生出前後對比。
      //   ★ 合規本來就有專屬的一層(kol-compliance 八套行業禁詞,台詞層與畫面層共用)——
      //     商品層【只負責這一行的畫面長什麼樣】,法規交給合規層。
      //   ★ 改成單一正面事實:一個安靜、整齊、正在營運的診間,她是專業人員。
      //     「只有一個當下、沒有兩個時間點」自然排除前後對比,而且沒有點名。
      return 'CLINIC — a calm, orderly medical space that is genuinely in use: tidy surfaces, equipment where it belongs, '
        + 'one single moment in that room with nothing compared against anything else. '
        + 'She is one of the professionals there, explaining something quietly rather than selling; '
        + 'faces keep their real skin and texture as photographed';
    }

    if (mode === 'course') {
      //  ⚖️ v5.48:拿掉「there is NO physical item to sell / never as merchandise」——
      //   兩句否定講同一件事,而且 merchandise 是點名召喚。改成正面:主角是正在發生的課。
      return 'CLASS IN SESSION — the hero is the teaching itself: she demonstrates, guides or corrects, '
        + 'with students around her visibly at different stages, some getting it and some still working at it. '
        + 'Mats, instruments, desks and weights are the tools being used right now. '
        + 'Bodies show real effort and real posture, and the room shows the wear of a place that is used every day';
    }

    if (mode === 'mystic') {
      //  ✂️ v5.49:舊版六個否定,而且 glowing auras / floating objects / light beams / spirits /
      //   magical particles 全部點名 —— 那是把特效唸出來給模型聽。
      //   ★ 改成正面事實:一場安靜的談話,牌與物件照參考圖,光就是屋裡的光。
      return 'CONSULTATION — a quiet session at a table: her hands lay out the cards or objects from [Image2] exactly as supplied, '
        + 'artwork, layout and markings unchanged, and she talks it through calmly. '
        + 'The light is whatever the room has, muted and even, and everything on the table stays a physical object resting on it';
    }

    if (mode === 'travel') {
      //  ⚖️ v5.48:舊版連續三個 DO NOT(invent/relocate/beautify、boxed travel products)——
      //   「boxed travel products」根本是自己把盒子叫出來。改成正面事實:照片裡那個地方就是那個地方。
      return 'REAL PLACE — the location in [Image2] is the actual destination and it appears exactly as photographed: '
        + 'the same building, the same skyline, the same room, the same weather it really has. '
        + 'She is inside that place as a traveller or a guide, with the place clearly readable behind her; '
        + 'daylight and colour stay as honest as an ordinary phone photo taken there';
    }

    if (mode === 'wellness') {
      //  ⚖️ v5.48:舊版「NOT a medical device and NOT a medicine … never as a remedy,
      //   never with any depiction of a bodily or health effect」—— 四個否定,而且把
      //   medical device / medicine / remedy / health effect 全部點名。
      //   ★ 改成正面:它就是一件工藝品,拍它的材質與做工。合規交給 kol-compliance。
      return 'CRAFT OBJECT — the piece in [Image2] is jewellery or homeware and is shown for what it is made of: '
        + 'its stones, beads, grain, metal fittings and any printed text stay exactly as in the photograph, '
        + 'in the same order and the same direction. '
        + 'She wears it or sets it down where she lives, and it has real weight, resting on her hand or on the surface under it';
    }

    if (mode === 'digital') {
      //  ✂️ v5.49:舊版三個否定(no physical product / does NOT hold / no fake package)。
      return 'DIGITAL PRODUCT — she shows it through the device in her hands (laptop, phone or tablet) or through the '
        + 'real-world outcome it produces, talking to camera about what it does for her. '
        + 'If a logo or screen is supplied in [Image2] it appears on that device screen, clean, correct and square to the lens';
    }

    return null;
  }

  //  ✂️ 公版出口包一層:所有回傳值都補上去背指令(見 CUTOUT_EDGE 註解)
  function _withEdge(line) {
    var t = String(line || '').trim();
    if (!t) return t;                                  // 沒有商品就不談邊緣
    if (t.indexOf('cutout') !== -1) return t;          // 已經講過就不重複
    return t.replace(/[;.\s]+$/, '') + '; ' + CUTOUT_EDGE;
  }

  //  🥿 v5.46(2026-09-18)【同一件的不同角度】—— 治「兩雙鞋合成第三雙」
  //   RA 實測:同一個槽放兩雙不同的鞋,模型不知道那是兩雙還是同一雙的兩個角度,
  //     於是取平均,生出市面上沒有的第三雙。整份 prompt 從來沒有一句講過這件事。
  //   ★ 一句正面事實:這些參考圖是【同一件】從不同角度拍的,維持成同一件。
  //   ★ 只在【真的有多張商品圖】時才加(單張不用講,省字數)。
  //   ⚠️ 這是規則不是閘門:真的放兩雙完全不同的鞋還是可能混。
  //     原則仍是「一個商品槽只放同一件的不同角度」。
  function _sameItemLine(ctx) {
    try {
      let n = 0;
      if (ctx && Array.isArray(ctx.productImageUrls)) n = ctx.productImageUrls.length;
      else if (typeof window !== 'undefined' && typeof window.orderedProductUrls === 'function') n = (window.orderedProductUrls() || []).length;
      if (n < 2) return '';
    } catch (e) { return ''; }
    return 'the product reference images are the SAME single item photographed from different angles, not different items — keep it as one consistent item and never blend features from two of them into a new variant';
  }
  function contribute(ctx) {
    const base = _withEdge(_contributeInner(ctx));
    const same = _sameItemLine(ctx);
    return same ? (String(base).replace(/[;.\s]+$/, '') + '; ' + same) : base;
  }

  // ═══════════════════════════════════════════════════════════════
  //  ✂️ v5.45(2026-09-17)材質句照【不失語意的公版簡化】收短:
  //    拿掉跟其他句重複的 —— 正面/印刷字(資產標註區與包裝句已講)、重量與被撐著(GROUNDED 已講)、
  //    「放在包裝裡」(開口句已講)。每句只留 GROUNDED 沒講的:材質＋受力時的樣子。
  //  🧱 v5.44(2026-09-17)materialOf —— 教算力機【這個東西是什麼材質、手上拿起來會怎樣】
  //   RA:「後續商品怎麼拿取、形狀等等,kol-product 應該教給她,跟內衣是一樣的方式。」
  //   ★ 內衣那條早就證明過:只寫「照參考圖、不准變形」→ 模型畫成硬板子;
  //     補一句「布料軟、會垂墜、拿著的地方會折」→ 立刻像真的。其他商品一直沒有這句。
  //   ★ RA 2026-09-17 實測:海苔浮在指尖上像變魔術 —— 整份 prompt 沒有一句講
  //     「一片薄脆的東西怎麼被拿著」,模型只知道要有手、要有海苔。
  //   ★ 材質從客戶填的欄位抓(包裝外型 packShape、商品外觀 productLook、內容物外觀 contentsLook、
  //     商品名、分類),照【先具體後通用】的順序比對,抓不到就不猜(回空字串,不亂寫)。
  //   ★ 只寫事實:材質、重量、受力時的樣子、被什麼撐著。不寫禁止句(點名即召喚)。
  //   ★ 內容物一律補「被手穩穩拿著或放在包裝裡」—— 治浮空,這句不分品項。
  //   ⚠️ 新品類在 PACK_MATERIALS / PIECE_MATERIALS 補一行就好,其他地方不用改。
  // ═══════════════════════════════════════════════════════════════
  const PACK_MATERIALS = [
    [/夾鏈|立袋|包裝袋|零食袋|袋|pouch|bag/i, 'the pouch is soft plastic film that gives slightly under her grip'],
    [/紙盒|禮盒|盒|box/i,                    'the box is firm cardboard that stays square in her hand'],
    [/軟管|tube/i,                           'the tube is soft plastic that dents slightly under her fingers'],
    [/玻璃|瓶|glass|bottle/i,                'the bottle is rigid, her hand wrapped around it'],
    [/鐵罐|鋁罐|罐|can\b|tin\b/i,           'the can is rigid metal, her hand wrapped around it'],
    [/手機|平板|筆電|耳機|3C|電子|device|phone/i, 'the device is rigid, resting in her palm'],
    [/A4|影印紙|紙張|卡片|信封|筆記本|書本|paper|card/i, 'the paper is thin and flexible, its free edges bending gently'],
    [/毛巾|布料|棉|針織|fabric|cloth|towel/i, 'the fabric is soft and drapes, creasing where held'],
    //  🧱 2026-09-17 清查下拉補齊:口紅/保健品(手持)、鞋包錶飾品(穿戴)、噴霧(示範)、飲品(盛盤)
    [/口紅|唇膏|lipstick/i,                  'the lipstick is a small rigid tube'],
    [/保健品|膠囊|錠|藥盒|supplement/i,       'the container is small and rigid'],
    [/噴霧|噴瓶|spray/i,                     'the spray bottle is rigid, a finger resting on the nozzle'],
    [/皮革|包包|手提包|托特|後背包|bag|handbag|backpack/i, 'the bag is structured and hangs with real weight'],
    [/鞋|靴|sneaker|shoe|boot/i,             'the shoes are firm and keep their shape'],
    [/手錶|錶|手環|戒指|項鍊|耳環|飾品|watch|ring|necklace|earring|bracelet/i, 'the piece is small and rigid, catching small highlights'],
    [/上衣|外套|洋裝|襯衫|褲|裙|shirt|jacket|dress|pants|skirt/i, 'the fabric drapes and creases with her body'],
  ];
  //  🥤 盛盤模式的飲品:杯子與液體的物理(盛盤原本只會講「一盤菜」)
  const DRINK_RE = /飲|茶|咖啡|拿鐵|果汁|奶昔|酒|湯|drink|tea|coffee|latte|juice|smoothie/i;
  const PIECE_MATERIALS = [
    [/脆片|海苔|餅乾|洋芋片|薄片|仙貝|chip|cracker|cookie|seaweed/i, 'each piece is thin, light and crisp, held whole between her thumb and fingers'],
    [/軟糖|糖果|巧克力|candy|chocolate/i,                            'each piece is small and solid, held between her fingers'],
    [/堅果|果乾|nut/i,                                               'a few small pieces rest in her palm'],
  ];
  function _hay(prod, keys) { return keys.map(k => prod && prod[k]).filter(Boolean).join(' '); }
  function materialOf(prod) {
    if (!prod) return { pack: '', piece: '' };
    const packHay  = _hay(prod, ['packShape', 'productLook', 'prodName', 'name', 'tag']);
    const pieceHay = _hay(prod, ['contentsLook', 'prodName', 'name', 'tag']);
    const hit = (table, hay) => { for (const [re, txt] of table) if (hay && re.test(hay)) return txt; return ''; };
    const piece = hit(PIECE_MATERIALS, pieceHay);
    return {
      pack: hit(PACK_MATERIALS, packHay),
      piece: piece || 'each piece rests securely in her fingers',
    };
  }

  // ═══════════════════════════════════════════════════════════════
  //  ✋ v5.43(2026-09-17)handProfile —— 【手跟這個商品怎麼互動】由商品模組決定
  //   RA:「應該要透過商品那個程式碼去針對細節去做變化,例如顧客選餅乾的那項目。」
  //   ★ 一個檔案一個職責:商品長什麼樣、怎麼被拿、手可不可以做細部操作,都是商品的事,
  //     不該寫死在 Worker 裡。Worker 只讀這裡給的結果:
  //       fine = true  → 手的細部動作就是商品本身(操作示範、設備、螢幕、美業、醫美、翻牌…),閘門放行
  //       fine = false → 一般商品,撕扯捲折翻點戳這類指尖操作由 Worker 的手部閘拿掉
  //       fact         → 一句中文事實,送給分鏡 AI,讓它【一開始就寫對】,閘門只是保險
  //   ★ 為什麼要分:AI 抓不準手指跟物體的接觸點和力道 —— 撕扯會撕裂、捲折會變形、
  //     指尖點一下或翻面東西會浮在空中(RA 2026-09-17 實測海苔像變魔術)。
  //     整隻手的大動作(拿起、握著、放下、遞出、轉過來給人看)它演得很好。
  //   ★ fact 只寫事實、不寫禁止(點名即召喚);新增模式時在這裡補一行就好。
  // ═══════════════════════════════════════════════════════════════
  const HAND_FACTS = {
    demo:     [true,  '這個商品要示範怎麼用,她的手做實際的使用動作,動作清楚、節奏放慢讓人看得懂。'],
    equip:    [true,  '這是設備,她的手實際操作機台上的按鍵、面板或加工件。'],
    screen:   [true,  '重點是螢幕畫面,她的手指實際在螢幕上操作。'],
    digital:  [true,  '重點是螢幕畫面,她的手指實際在螢幕上操作。'],
    service:  [true,  '這是服務,手的細部動作就是服務本身,照實際流程做。'],
    beauty:   [true,  '這是美業服務,手的細部動作就是服務本身,照實際流程做。'],
    medical:  [true,  '這是醫美服務,手的動作照實際流程,專業、穩定。'],
    mystic:   [true,  '這是命理服務,翻牌、排盤這些手上的動作就是服務本身。'],
    agency:   [true,  '重點是螢幕上的成果,她的手指實際在螢幕上操作。'],
    held:     [false, '她整隻手握著這個東西,跟著手腕和身體一起移動;要讓人看清楚,就把手舉近或轉過來給朋友看。'],
    hero:     [false, '這是大件的東西,她站在旁邊,用整隻手扶著、指著或靠著它。'],
    worn:     [false, '商品穿戴在她身上,跟著她的身體一起動。'],
    innerwear:[false, '商品穿戴在她身上,跟著她的身體一起動。'],
    wellness: [false, '她整隻手拿著或戴著它,跟著手腕和身體一起移動。'],
    course:   [false, '重點是她在做的事,手上的東西整隻手拿著。'],
    pro:      [false, '重點是她在講的專業,手上的東西整隻手拿著。'],
    travel:   [false, '重點是她去的地方,手上的東西整隻手拿著。'],
  };
  function handProfile(ctx) {
    try {
      const prod = (ctx && (ctx.prodName || ctx.productMode || ctx.hasPackaging !== undefined)) ? ctx : findProduct(ctx || {});
      if (!prod) return { fine: false, fact: '她手上的東西整隻手握著,跟著手腕和身體一起移動。' };
      const mode = resolveMode(prod);
      if (mode && HAND_FACTS[mode]) return { fine: HAND_FACTS[mode][0], fact: HAND_FACTS[mode][1], mode: mode };
      const type = resolveType(prod);
      if (type === 'dish') {
        return DRINK_RE.test(_hay(prod, ['prodName', 'name', 'tag', 'productLook']))
          ? { fine: false, fact: '這是一杯飲品,她整隻手握著杯子,或讓它放在桌上;杯子跟著手腕穩穩移動。', mode: 'dish' }
          : { fine: false, fact: '這是一盤做好的菜,她用整隻手端著盤子,或讓它放在桌上、用手指向它。', mode: 'dish' };
      }
      if (type === 'packaged') {
        return isYes(prod.showContents)
          ? { fine: false, fact: '這包商品的包裝已經打開、維持原本的形狀;她從開口伸手拿出一片,整片穩穩拿在手上給人看。', mode: 'packaged' }
          : { fine: false, fact: '她整隻手握著這包商品,轉過來讓人看到正面。', mode: 'packaged' };
      }
      return { fine: false, fact: '她整隻手握著這個東西,跟著手腕和身體一起移動;要讓人看清楚,就把手舉近或轉過來給朋友看。', mode: mode || type };
    } catch (e) {
      return { fine: false, fact: '' };
    }
  }

  function _contributeInner(ctx) {
    const prod = findProduct(ctx);
    if (!prod) {
      return 'PROP (an object she is holding, at its real-life size): ' + GROUNDED + ', its front kept toward the camera and recognizable while held, moving on a natural weighted arc if the action calls for it';
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
      //  ✂️ v5.40(2026-09-15)兩長句都在講「這盤是成品不是食材」,收成一句。
      //   舊版把「不進鍋/不炒/不煮/不生食/不倒進去/不丟進去/不上爐火」列了一長串,
      //   那是同一件事的七種說法(RA 鐵律:點名即召喚,而且清單列不完)。
      bits.push('this plated dish is the finished dish as served — she presents, serves or lightly garnishes it, and it stays on the counter or table away from any heat, never going back into cookware');
      //  🥤 2026-09-17:飲品不是盤子 —— 補杯子與液體的物理
      if (DRINK_RE.test(_hay(prod, ['prodName', 'name', 'tag', 'productLook']))) bits.push('the drink is in a real cup, its liquid staying level');
      if (scale) bits.push('the plated dish is ' + scale + ', at that true size');
      bits.push('presented appetizing and intact, the plate facing the camera, minimal movement so it stays recognizable');
      return 'PROP (the plated dish she is presenting, at its real-life size): ' + bits.join('; ');
    }

    if (type === 'packaged') {
      const desc = [(prod.packShape || '').trim(), (prod.productLook || '').trim()].filter(Boolean).join('、');
      //  ✂️ v5.39(2026-09-15)拿掉跟【資產標註區】重複的那一串。
      //   標註區已經寫過:Image2 = the product (keep its shape, proportions, colour,
      //   material and any logo identical; never mirrored or flipped)。
      //   這裡再寫一次 packaging shape / color / label / undistorted / never mirrored,
      //   reversed or flipped / matching Image2 exactly —— 整句是第二份。
      //   留下的只有標註區沒講的:【包裝長什麼樣】(客戶填的 desc)＋【印刷字要讀得出來】。
      bits.push(desc
        ? 'the packaged product in [Image2] is ' + desc + ', its printed text staying legible'
        : 'its printed label reads correctly');
      //  🧱 v5.44:包裝材質 —— 抓不到就不寫
      { const _m = materialOf(prod); if (_m.pack) bits.push(_m.pack); }
      //  🐛 2026-09-05 修靜默失效:原條件是「勾了顯示內容物 AND 填了內容物長相」,
      //    兩個都要成立 [Image3] 才會被點名。客戶勾了卻沒填描述時 ——
      //    第二張圖照樣送進引擎,但在提示詞裡【沒有名字】,模型不知道那是什麼。
      //    ★ 描述是加分項,不該當成點名的門檻。拆成兩層:
      //      勾了 → 一定點名;有描述 → 再補上長相。
      if (isYes(prod.showContents)) {
        const _cl = (prod.contentsLook || '').trim();
        //  ═══════════════════════════════════════════════════════════════
        //  🔢 v5.36(2026-09-15)片數照參考圖 —— 拿掉自己放掉數量鎖的那句。
        //   病灶(RA 2026-09-15 指出):前半寫 keep this count,
        //     後半又寫 (loose pieces may vary naturally)「散落的片數可以自然變動」——
        //     一句話裡先鎖再放,模型當然照後半做,結果她手上的片數跟參考圖對不上。
        //   ★ RA 要的是:【參考圖幾片,畫面就幾片】。這是可驗證的具體要求,
        //     不是風格偏好,所以直接寫成事實,並給一個對照例子讓它知道尺度。
        //  ═══════════════════════════════════════════════════════════════
        bits.push('its contents are shown in [Image3]'
          + (_cl ? ' and look like ' + _cl : '')
          + ', and the number of pieces on screen matches [Image3] exactly'
          + ', their shape and texture staying stable'
          + ', ' + materialOf(prod).piece);   // 🧱 v5.44:內容物怎麼被拿著(治海苔浮在指尖)
        //  ═══════════════════════════════════════════════════════════════
        //  📦 v5.42(2026-09-16)袋口的【開口狀態】寫成事實 —— 治「整包被撕裂」
        //   RA 實測(好滋好滋 45 秒):第 3 段她把整包像拆餅乾一樣撕開攤平。
        //   ★ 機制:每一段是【獨立生成】,每段收到的商品參考圖都是一包封口的袋子。
        //     第 1 段拆過,第 3 段的算力機不知道;分鏡又叫她「從包裝裡捏出一片」——
        //     要拿東西就得先開,而整份 prompt 沒有一句講袋口狀態,模型只好自己發明開法。
        //   ★ 解法:只要會拿出內容物(showContents),袋口就【已經開著】,
        //     她從開口伸手進去拿,袋子保持整包的形狀。
        //   ★ 刻意不寫「撕 / 不要撕破」(點名即召喚),也不寫夾鏈 ——
        //     公版:不是每種包裝都有夾鏈,客戶可在「包裝外型」自己寫。
        //   ★ 用 '; ' 成獨立一條,排在內容物後面。
        //  ═══════════════════════════════════════════════════════════════
        bits.push('the bag is already open along its top edge, she reaches in through that opening to take a piece, and the bag keeps its whole shape');
      }
      if (scale) bits.push('the product is ' + scale + ', shown at that true size against her body');
      //  ✂️ v5.39:GROUNDED 後面那兩句都是第二份 ——
      //   「正面與標籤朝向鏡頭」上面那句已經在講印刷字要讀得出來;
      //   「自然的重量弧線」GROUNDED 本身就是在講重量與重力。
      bits.push(GROUNDED + ', its printed front kept toward the camera while held');
      return 'PROP (a product she is holding, at its real-life size): ' + bits.join('; ');
    }

    // object
    const look = (prod.productLook || '').trim();
    bits.push('the product reads correctly and is never mirrored' + (look ? ' (' + look + ')' : ''));   /* v3.51:一致性已由資產標註區負責,這裡不再重複 */
    { const _m = materialOf(prod); if (_m.pack) bits.push(_m.pack); }   // 🧱 v5.44
    if (scale) bits.push('the product is ' + scale + ', shown at that true size');
    bits.push(GROUNDED + ', its front kept toward the camera and recognizable while held, moving on a natural weighted arc if the action calls for it');
    return 'PROP (the product she is using or showing, at its real-life size): ' + bits.join('; ');
  }

  window.KolProduct = { contribute, isYes, sizeToScale, resolveType, version: 'v5.49', resolveMode, handProfile, materialOf };
  console.log('[KolProduct] 👗 v5.49:✂️全模式盤點精簡(螢幕5否定/設備3/專業服務點名五樣/數位3/代操5/命理6→全改正面事實,特效與比較版面不再被唸出來;語意一句沒掉) · v5.48:⚖️受法規行業不再在提示詞裡提醒法規(舊版寫 DO NOT before/after、NOT a medicine、never as merchandise=點名即召喚,跟木偶事件同一個病):醫美/課程/旅遊/養生四個模式全改成正面事實,合規交回 kol-compliance 那一層 · v5.47:✂️服務成果盤點(兩句否定講同一件事→一句正面·五種工藝只送當下那一種·去背句重複刪掉)+🔒特徵鎖(形狀長度顏色質感照參考圖·治鮑伯頭變龐克、法式變彩繪) · v5.46:🥿多張商品圖=同一件的不同角度(治兩雙鞋被合成第三雙) · v5.45:🧱 materialOf 材質與拿法(袋/盒/瓶/罐/紙/布/口紅/鞋包/飾品/噴霧/飲品·抓不到就不寫) · ✋ handProfile 手跟商品怎麼互動(細部動作放不放行＋一句事實給分鏡 AI) · v5.42 ✂️拿掉五份「keep it subtle / do NOT overpower」(那句等於叫模型把商品縮小) · v5.40:✂️三個肥模式去重(服務成果四句→兩句·盛盤食物七種說法→一句·養生保健三個DO NOT→正面一句) · v5.39:✂️包裝商品去重三處(包裝句跟資產標註區整句重複/片數例子過長/GROUNDED 後面兩句都是第二份)。RA:「砍了一堆提示詞等於沒砍,字數還是逼近 3900」—— 雙商品時商品鐵律 1416 字,把前面省下的全吃掉了 · v5.38:✂️去背毛邊列四種→一句正面(16模式共用,199→75字)·內衣拿掉「布料與花紋要正確」(標註區已鎖,純重複) · v5.37:🧹服務類模式跨層清理 9 處(指揮光線 even light/clean lighting/studio light/directional light → 跟光的鐵律打架,昨天已在 crew-director 殺過三份;寫死地點 cleanroom/office-meeting-clinic/treatment room/table → 跟實景照打架)。光交給光的鐵律,地點交給實景照,商品層只留「這一行在做什麼」 · v5.36:🔢包裝商品內容物【片數照參考圖】(舊句前半 keep count、後半又寫 loose pieces may vary naturally 把鎖放掉 → 模型照後半做) · v5.35:補回【她穿著服裝參考圖那一套,商品在底下】的事實陳述(v5.34 拿掉那句後,整份 prompt 沒有任何一句說她身上有外層 → 模型把商品當成唯一那件在穿;RA:內衣穿反從六次偶爾一次變成幾乎每次)。仍不寫「從領口露出/敞開/被瞥見」那類指揮穿法的字 · v5.34:拿掉「穿在外出服底下·從敞開領口被瞥見」(與服裝圖打架→模型把外層整件拿掉·兩段穿著不一致)·穿著只由服裝圖決定 · 🎒 v4.0 就緒 · 🧵內衣材質行為(軟/垂墜/可凹陷·治硬板子) · ✂️去背毛邊公版(16模式共用·掛在出口) · · 📦雙槽模式第二張圖全部點名(內衣正/背·設備機台/加工件·螢幕裝置/畫面·養生商品/配戴) · 道具師·模式驅動(16模式) · 🆕 貼身衣物內層模式(265字·無分號·整條受保底保護) · 自動判斷(與合規模組共用分類表) · 🆕 服務成果左右對稱鎖(單眼參考圖不會只做一隻眼·鏡頭間不換邊) · 海苔等舊商品原樣不變');
})();
