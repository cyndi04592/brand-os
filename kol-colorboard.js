// ════════════════════════════════════════════════════════════════════
//  kol-colorboard.js · v0.4
//
//  🎨 色板師 — 讀 Brand OS 品牌 look,吐一段「調色/攝影 look」給 stitch 當 front
//
//  【v0.3】客人沒設 / 品牌沒填 / 沒綁定 → 回「預設 look」(Portra 暖調·常數
//    DEFAULT_LOOK,改一行即可換),不再回空。全自動,無需客人選 look 的 UI。
//    只有保險絲 window.KOL_COLORBOARD===false 時才回 ''(A/B:完全無 look)。
//
//  【v0.2 方向修正 · A案2.0】
//   研究結論(2026-07,查 Seedance 2.0 + 真實調色師):AI 影片是「生成當下
//   把調色烤進畫面」,調色靠 prompt 文字、不是餵色塊圖。所以色板師不再用
//   primary_color 拼「色調行」額外塞在 LOCKED 後(會撞 1700 牆),改成:
//     • 直接讀 brand_packs.photography_style(該欄本就是每品牌的攝影 look)
//     • 由 stitch 拿去「取代」front 那句 generic realism(取代≠疊加 → 省字)
//   例:又晴/ly 填「Fujifilm Eterna 日式淡調…」;美式品牌填「bold high-contrast…」。
//
//  職責(單一):讀 brand_packs → 回該品牌 photography_style(clean 過的一段)。
//    不生圖、不打 Worker、不組 prompt。膚色護欄(no oily specular)由 stitch 加。
//
//  來源(直綁·RA 定調 A):brand_packs.matchKeywords 填該品牌 brandId
//    → 用 brandId exact-match 抓對應 pack → 讀 pack.photography_style。
//    (photography_style 沒填 → 回 '' → stitch 退回原本 generic realism,不卡生成)
//
//  保險絲 window.KOL_COLORBOARD:
//    • undefined(預設)→ 正常運作
//    • false            → 明確關閉,回 ''(A/B、爆牆時)
//    • '任意字串'        → 直接用這串當 look(手動覆蓋測試)
//
//  向下相容:函式名 resolveColorLine / buildColorGradeLine 保留為別名,
//    stitch v6.14 舊呼叫不會壞;新名 resolveLookLine / buildLookLine。
// ════════════════════════════════════════════════════════════════════

(function () {
  'use strict';

  // ── 預設 look(客人沒設 / 品牌沒填 / 沒綁定時的 fallback)──
  //   iPhone 原生手機色:短影音 UGC 觀眾眼裡「真實網紅拍的」的樣子。
  //   依 DXOMARK iPhone 17 影片特徵寫:自然渲染、中性白平衡、乾淨低噪、微 HDR、
  //   膚色自然(臉安全)。想要電影質感的品牌 → 填 photography_style 選 15 種 look 之一。
  //   想換全站預設,改這一行即可(不需 UI)。
  const DEFAULT_LOOK = 'Clean modern smartphone video look (iPhone-style): true-to-life natural colours, fairly neutral white balance, bright well-exposed image, gentle natural contrast, subtle HDR pop, crisp low-noise detail, natural healthy skin, authentic short-video UGC feel';

  // ── 清掉多餘空白(photography_style 是自由文字,保險清一下)──
  function cleanLook(raw) {
    return String(raw || '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // ── 核心(純函式·可 Console 免費測):pack → 該品牌 look 一段 ──
  //   直接用 photography_style(RA 每品牌手填的攝影 look)。沒填就回 ''。
  function buildLookLine(pack) {
    if (!pack) return '';
    return cleanLook(pack.photography_style);   // 沒填 → '' → stitch 用 generic
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
      console.warn('[KolColorboard] 找不到 GAS_URL(window.KAI 未就緒)→ 略過 look');
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
      console.warn('[KolColorboard] 讀 brand_packs 失敗(略過 look):', e.message);
      return [];
    }
  }

  // ── 整合:ctx → 品牌 look 一段(async·給 stitch 接線用)──
  async function resolveLookLine(ctx) {
    ctx = ctx || {};

    // 保險絲
    const fuse = window.KOL_COLORBOARD;
    if (fuse === false) return '';                          // 明確關閉
    if (typeof fuse === 'string' && fuse) return fuse;      // 手動覆蓋

    const brandId = ctx.brandId
      || (window.S && (window.S.currentBrandId || window.S.selectedBrandId))
      || '';
    if (!brandId) {
      console.log('[KolColorboard] 🎨 沒 brandId → 用預設 look（' + DEFAULT_LOOK.length + ' 字）');
      return DEFAULT_LOOK;
    }

    const packs = await loadBrandPacks();
    const pack = findPackForBrand(brandId, packs);
    if (!pack) {
      console.log('[KolColorboard] 🎨 brandId「' + brandId + '」未綁定 pack → 用預設 look'
        + '（要換品牌 look:去 brand_packs 該列 matchKeywords 補此 brandId）');
      return DEFAULT_LOOK;
    }

    const look = buildLookLine(pack);
    if (!look) {
      console.log('[KolColorboard] 🎨 品牌「' + brandId + '」pack「' + pack.pack_key
        + '」photography_style 空 → 用預設 look（要換:填該欄 photography_style）');
      return DEFAULT_LOOK;
    }
    console.log('[KolColorboard] 🎨 品牌「' + brandId + '」→ pack「' + pack.pack_key + '」· look ' + look.length + ' 字');
    return look;
  }

  // ── 向下相容別名(stitch v6.14 呼叫 resolveColorLine 不會壞)──
  const buildColorGradeLine = buildLookLine;
  const resolveColorLine = resolveLookLine;

  window.KolColorboard = {
    DEFAULT_LOOK,           // 預設 look(改全站預設看這)
    buildLookLine,          // 純函式(Console 免費測用)
    resolveLookLine,        // 整合(stitch 接這個)
    findPackForBrand,       // 直綁配對
    loadBrandPacks,         // 讀 brand_packs + 快取
    buildColorGradeLine,    // 別名(舊)
    resolveColorLine,       // 別名(舊·stitch v6.14 用)
  };

  if (window.CrewDirector && window.CrewDirector.register) {
    window.CrewDirector.register('colorboard', window.KolColorboard);
  }

  console.log('[KolColorboard] 🎨 v0.4 就緒 · 品牌 look 讀 brand_packs.photography_style,沒設→預設 iPhone 原生手機色(A案2.0·全自動無需客人選·保險絲 window.KOL_COLORBOARD · 待 stitch 接 front)');
})();
