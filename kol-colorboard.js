// ════════════════════════════════════════════════════════════════════
//  kol-colorboard.js · v0.1
//
//  🎨 色板師 — 把 Brand OS 品牌色卡轉成一行「柔和統一打光色調」塞進 prompt
//
//  職責(單一):讀 brand_packs 色卡 → 吐「一行」英文色調指令。
//    不生圖、不打 Worker、不改 prompt 組裝 —— 只提供那一行,由 stitch/crew
//    -director 之後接線塞入(本版尚未接線,可先 Console 免費驗字)。
//
//  來源(直綁·RA 定調 A):brand_packs.matchKeywords 填入該品牌 brandId
//    → 色板師用 brandId exact-match 抓對應 pack。不靠名字猜,系統不配錯。
//    (在 brand_packs sheet 對應列的 matchKeywords 補上 brandId 即綁定)
//
//  鐵律:全程 soft / even / natural / cohesive 用詞,
//    ❌ 禁 cinematic / high contrast / specular(=招烤肉紋、油光臉)。
//    色板師是「統一色調 → 高端感」,不是「加對比」。
//
//  三層對齊規劃文件:高光受光面(key/highlights)、暗部(shadows)、
//    皮膚受光面(skin warm)、主色(primary)全涵蓋。
//
//  ⚠️ 1700 字牆:標註紀律長版真實 prompt 已 ~1690,逼近牆。加色板行後
//    務必重量 `📏 送出 prompt 長度`;爆牆時用 window.KOL_COLORBOARD 關掉,
//    或改用標註「瘦身版」騰空間。本檔色板行已刻意精簡(只用 primary 帶 hex
//    定主調,~180 字;secondary 逐色鎖與 avoid 內容鎖 = 有餘裕再加·Wishlist)。
//
//  保險絲 window.KOL_COLORBOARD:
//    • undefined(預設)→ 正常運作
//    • false            → 明確關閉,回空字串(A/B、爆牆時)
//    • '任意字串'        → 直接用這串當色板行(手動覆蓋測試)
//
//  向下相容:沒 brandId / 找不到 pack / GAS 失敗 → 一律回 '' → 不影響
//    原本 prompt、不卡生成。
// ════════════════════════════════════════════════════════════════════

(function () {
  'use strict';

  // ── 去掉色碼片語裡的用途括號,留「色名 + hex」──
  //   'deep forest green #3D5A3F (used for headlines…)' → 'deep forest green #3D5A3F'
  function cleanColorPhrase(raw) {
    return String(raw || '')
      .replace(/\([^)]*\)/g, ' ')   // 拔掉 (…用途…)
      .replace(/\s+/g, ' ')
      .trim();
  }

  // ── 核心(純函式·可 Console 免費測):pack 色卡 → 一行英文色調 ──
  //   v0.1 刻意精簡守牆:只用 primary(帶 hex)當主調錨點,其餘三層語意帶過。
  //   secondary 逐色鎖 / avoid 內容鎖 = 有餘裕再加(Wishlist);avoid 本屬
  //   environment/product 的畫面內容職責,不放色板師。
  function buildColorGradeLine(pack) {
    if (!pack) return '';
    const primary = cleanColorPhrase(pack.primary_color);
    if (!primary) return '';   // 沒主色就不吐色板(避免空泛)

    return 'Brand colour tone: soft, even, natural light; '
      + 'key light and highlights lean ' + primary + '; '
      + 'shadows fall into the deeper brand tones; '
      + 'skin stays warm with gentle falloff; '
      + 'one cohesive tone, no clashing cast.';
  }

  // ── 直綁:用 brandId exact-match matchKeywords 找 pack ──
  function findPackForBrand(brandId, packs) {
    if (!brandId || !Array.isArray(packs)) return null;
    const bid = String(brandId).trim().toLowerCase();
    return packs.find(p =>
      Array.isArray(p.matchKeywords) &&
      p.matchKeywords.some(k => String(k).trim().toLowerCase() === bid)
    ) || null;
  }

  // ── 讀 brand_packs(公開 GET·session 快取)──
  //   getBrandPacks 是無密碼 GET;複用 window.KAI 的 GAS_URL/PASSWORD,不重複寫死金鑰。
  async function loadBrandPacks() {
    if (Array.isArray(window._brandPacksCache)) return window._brandPacksCache;
    const KAI = window.KAI || {};
    const gasUrl = KAI.GAS_URL;
    if (!gasUrl) {
      console.warn('[KolColorboard] 找不到 GAS_URL(window.KAI 未就緒)→ 略過色板');
      return [];
    }
    const pwd = KAI.PASSWORD || 'raby2026';
    const qs = new URLSearchParams({ action: 'getBrandPacks', password: pwd }).toString();
    try {
      const res = await fetch(gasUrl + '?' + qs).then(r => r.json());
      const packs = (res && Array.isArray(res.packs)) ? res.packs : [];
      window._brandPacksCache = packs;   // 同 session 不重打
      return packs;
    } catch (e) {
      console.warn('[KolColorboard] 讀 brand_packs 失敗(略過色板):', e.message);
      return [];
    }
  }

  // ── 整合:ctx → 色板行(async·給 stitch/crew-director 之後接線用)──
  async function resolveColorLine(ctx) {
    ctx = ctx || {};

    // 保險絲
    const fuse = window.KOL_COLORBOARD;
    if (fuse === false) return '';                          // 明確關閉
    if (typeof fuse === 'string' && fuse) return fuse;      // 手動覆蓋

    const brandId = ctx.brandId
      || (window.S && (window.S.currentBrandId || window.S.selectedBrandId))
      || '';
    if (!brandId) {
      console.warn('[KolColorboard] 沒有 brandId → 略過色板');
      return '';
    }

    const packs = await loadBrandPacks();
    const pack = findPackForBrand(brandId, packs);
    if (!pack) {
      console.warn('[KolColorboard] brandId「' + brandId + '」在 brand_packs.matchKeywords 找不到綁定 pack '
        + '→ 略過色板(去 brand_packs sheet 該列 matchKeywords 補上此 brandId 即綁定)');
      return '';
    }

    const line = buildColorGradeLine(pack);
    console.log('[KolColorboard] 🎨 品牌「' + brandId + '」→ pack「' + pack.pack_key + '」· 色板行 ' + line.length + ' 字');
    return line;
  }

  window.KolColorboard = {
    buildColorGradeLine,   // 純函式(Console 免費測用)
    findPackForBrand,      // 直綁配對
    loadBrandPacks,        // 讀 brand_packs + 快取
    resolveColorLine,      // 整合(之後 stitch 接這個)
  };

  if (window.CrewDirector && window.CrewDirector.register) {
    window.CrewDirector.register('colorboard', window.KolColorboard);
  }

  console.log('[KolColorboard] 🎨 v0.1 就緒 · 品牌色卡→柔和統一色調一行(直綁 brand_packs.matchKeywords · 保險絲 window.KOL_COLORBOARD · 尚未接線 stitch)');
})();
