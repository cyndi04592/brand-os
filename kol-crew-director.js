// ════════════════════════════════════════════════════════════════════
//  kol-crew-director.js · v5.12 Full
//  
//  🎬 總導演 — 劇組協調中樞(升級版)
//  
//  職責:
//   • 整合 7 個角色模組
//   • 呼叫各角色 .contribute(ctx) 收集 prompt 片段
//   • 組合成最終 Seedance prompt
//   • 取代 kol.html 裡的 composeSeedancePrompt / composeMultiShotPrompt / buildEpisodeOverlay
//  
//  prompt 組裝順序:
//   1. 主角動作(brandType × scene.verb)
//   2. 環境(場景 + 地標 + 光線交互 + 環境音)
//   3. 服裝(scene.outfit)
//   4. 化妝(v5.12 暫空)
//   5. 攝影(運鏡 + REALISM_BASE)
//   6. KOL 人設(personality / speaking / topics / taboos)
//   7. 故事(storyArc + episode.situation)
//   8. 產品暗示(episode.product)
// ════════════════════════════════════════════════════════════════════

(function () {
  'use strict';

  const CrewMembers = {
    persona: null,
    makeup: null,
    wardrobe: null,
    cinematographer: null,
    storywriter: null,
    brandSoul: null,
    environment: null,
    colorboard: null,   // kol-colorboard.js 會自行報到;名冊沒這個 key 會被 register 擋掉並噴「未知角色」
  };

  function register(role, module) {
    if (!CrewMembers.hasOwnProperty(role)) {
      console.warn(`[CrewDirector] 未知角色:${role}`);
      return;
    }
    CrewMembers[role] = module;
  }

  function isReady() {
    return Object.values(CrewMembers).every(m => m !== null);
  }

  function status() {
    const ready = {};
    const pending = {};
    for (const [role, module] of Object.entries(CrewMembers)) {
      if (module) ready[role] = '✅ 就緒';
      else pending[role] = '⏳ 待實作';
    }
    return { ready, pending, isReady: isReady() };
  }

  // ─── 品類動作模板(從 kol.html 搬過來)─────────────────
  const BRAND_ACTIONS = {
    la: 'A woman [Image1] {VERB}, {PRODUCT_CONTEXT}, speaks directly to camera with natural warmth',
    moz: 'A person [Image1] {VERB} the accessory [Image2] naturally in hand, speaks directly to camera with relaxed tone',
    ka: 'A person [Image1] {VERB} the appliance [Image2] with subtle demonstration gestures, speaks directly to camera',
    // 🆕 通用模板:沒有專屬模板的品牌(ly/cf/ww/ra/flm/ever_7011/protex+未來新建)一律走這個,引用[Image2]且商品做大
    default: 'A person [Image1] {VERB}, speaks directly to camera with natural warmth',
  };

  /**
   * 組合 prompt · 核心(取代 kol.html composeSeedancePrompt)
   */
  // 🆕 B版 劇情注入解析:把劇情框拆成「動作」+「台詞」雙軌。
  // Seedance 2.0 原生會講話:引號內的句子會被當台詞對嘴唸出來。
  //   - 抓出所有中/英引號內的句子 → 當台詞(speaks in Mandarin: "...")
  //   - 引號外的字 → 當動作描述
  //   回傳 { action, speechLine }。沒台詞 → speechLine 為 ''。
  // 國籍 → 口音(預設台灣腔,守鐵律:tw/空/未知一律台灣腔)
  function natToAccent(nat) {
    switch (nat) {
      case 'jp':    return 'Mandarin Chinese with a soft Japanese accent';
      case 'kr':    return 'Mandarin Chinese with a Korean accent';
      case 'hk':    return 'Mandarin Chinese with a Hong Kong Cantonese accent';
      case 'my':    return 'Mandarin Chinese with a Malaysian accent';
      case 'jpmix': return 'Taiwanese Mandarin with a subtle Japanese inflection';
      default:      return 'Taiwanese Mandarin';
    }
  }
  if (typeof window !== 'undefined') window.natToAccent = natToAccent;

  function parseSituation(raw, persona) {
    const situation = (raw || '').trim();
    if (!situation) return { action: '', speechLine: '' };

    // 同時支援中文引號「」『」 與英文 " " 和 ' '
    // ═══════════════════════════════════════════════════════════════════
    //  🗣 v5.30 台詞上限對齊 40 → 60(兩道牆講同一個數字)
    //  ─────────────────────────────────────────────────────────────────
    //  ★ 病:分鏡面板放行 56.7 字(4.2字/秒 × 15秒 × 0.9),這裡卻只認 40 字,
    //    而且【完全不出聲】。41–56 字 = 死亡地帶:面板說可以,這裡抓不到。
    //  ★ 連鎖:引號抓不到 → 台詞留在動作描述裡 → speechLine 是空的
    //    → 專用的英文對嘴指令從沒送出過 → 模型改用旁白念。
    //  ★ 修法:40 這個數字是刻意的煞車(防語速太快),【不是拆掉,是對齊】。
    //    煞車完整保留在面板端(超過會跳警告 + 擋確認),這裡只負責抓得到。
    //  ★ 為什麼是 60 不是 56.7:面板算字數時會把空白扣掉,這裡的正則不會,
    //    留一點餘裕,免得標點空格把合法台詞又擠出去。
    // ═══════════════════════════════════════════════════════════════════
    const DIALOGUE_MAX = 60;
    const quoteRe = new RegExp('[「『"\']([^「『"\'』」]{1,' + DIALOGUE_MAX + '})[」』"\']', 'g');
    const lines = [];
    let m;
    while ((m = quoteRe.exec(situation)) !== null) {
      const t = (m[1] || '').trim();
      if (t) lines.push(t);
    }
    //  🔎 超過上限的引號會被整句忽略(靜默失敗)→ 開 KOL_DEBUG 時出聲,不再無聲無息
    try {
      if (typeof window !== 'undefined' && window.KOL_DEBUG === true) {
        const over = (situation.match(/[「『"\']([^「『"\'』」]+)[」』"\']/g) || [])
          .map(function (x) { return x.length - 2; })
          .filter(function (n) { return n > DIALOGUE_MAX; });
        if (over.length) {
          console.log('[CrewDirector] 🗣 有 ' + over.length + ' 句台詞超過 '
            + DIALOGUE_MAX + ' 字上限(' + over.join('/') + ' 字),會被忽略 → 該鏡沒有對嘴指令');
        }
      }
    } catch (_) {}

    // 動作 = 把引號連同內容拿掉後剩下的字
    const action = situation.replace(quoteRe, ' ').replace(/\s+/g, ' ').trim();

    let speechLine = '';
    if (lines.length) {
      // FAL 規矩:短句最佳(5-10字),標語言。多句用逗號接成一段。
      const quoted = lines.map(s => `"${s}"`).join(', ');
      const pronoun = persona?.gender === 'male' ? 'He' : 'She';
      const accent = natToAccent(persona?.nationality);
      speechLine = `${pronoun} speaks in natural ${accent}, clear lip-sync, saying ${quoted} — these words are spoken aloud as audio only and must never be shown as text; no subtitles, no captions and no on-screen text appear anywhere in the frame. No background music.`;
    }
    return { action, speechLine };
  }

  // ════════════════════════════════════════════════════════════════
  //  🤝 公版「接觸鏈」· v5.17(2026-08-11)
  //  病灶:商品會「特異功能飄進嘴巴」—— 海苔、飲料、口紅、鞋,任何品類都會。
  //  真因:舊寫法是 `physically grounded never floating`,又是一句「否定句」。
  //        跟「no face, no person」擋不住人臉一模一樣 —— 影片模型對否定句幾乎無效,
  //        你叫它「不要飄」,它讀到的重點反而是「飄」。
  //  修法:改成「正面描述接觸點」。每一格畫面都告訴模型「東西在哪隻手指之間」,
  //        它就沒有機會讓東西用滑的。
  //  ⚠️ 這四條講的是「物理」,不是某個商品 —— 飲料、口紅、鞋、家電、零食全部通用,
  //     所以放在總導演這裡當公版,9 個品牌與未來新品牌自動繼承,不用逐一補。
  const CONTACT_CHAIN =
    'whenever the product is picked up or used, always show the exact contact points: name which hand and which fingers hold it and where on the product they grip it; ' +
    'the object reacts to real gravity and material — soft things bend under their own weight, liquid visibly shifts inside a container, heavy things make the wrist dip; ' +
    'movement is continuous and never teleports — the product travels visibly from the surface, into the hand, then to its destination, staying in contact with the fingers the whole way; ' +
    'when it is put down, its base touches the surface first and only then do the fingers release it';

  function composePrompt(brandId, sceneId, locationId, movementId, duration, opts) {
    opts = opts || {};

    const scenes = (typeof window.getScenesForBrand === 'function')
      ? window.getScenesForBrand(brandId)
      : (window.SCENE_LIBRARY?.[brandId] || {});
    const scene = scenes[sceneId];
    if (!scene) {
      console.error('[CrewDirector] 找不到場景:', brandId, sceneId);
      return '';
    }

    const brand = (window.S?.brands || []).find(b => b.id === brandId);
    const persona = opts.episode?.persona || null;
    const storyArc = opts.storyArc || window.S?.storyArc || {};

    // 🆕 服飾品牌風格:從下拉撈當前選的值,餵給服裝師(ctx.outfitBrand)
    const outfitBrand = opts.outfitBrand
      || document.getElementById('outfit-brand-picker')?.value
      || window.S?.outfitBrand
      || '';

    const actionLine = buildActionLine(brandId, scene, brand);

    const ctx = {
      brandId, brand,
      sceneId, scene,
      locationId,
      movementId,
      duration: String(duration || '10'),
      persona,
      storyArc,
      outfitBrand,
      episode: opts.episode || null,
    };

    // 15 秒多鏡頭(接片模式強制單鏡頭,不要每段又切三刀)
    if (String(duration) === '15' && !opts.forceSingleShot) {
      return composeMultiShotPrompt(ctx, actionLine);
    }

    // 🆕 B版 劇情注入:動作 + 台詞雙軌。
    // ⚠️ 修正:劇情動作只「補充」不「取代」actionLine —— actionLine 裝著商品放大 + [Image2]引用,
    //    被丟掉的話,一填劇情商品就不見了(跟「商品要大」的核心需求打架)。
    const { action: sitAction, speechLine } = parseSituation(opts.episode?.situation, persona);

    // 單鏡頭:actionLine(商品放大)永遠擺第一,劇情動作/台詞接在後面補充。
    const parts = [actionLine];
    if (sitAction) {
      parts.push('Her specific on-screen action: ' + sitAction
        + ' — show her actually doing this, natural and candid, while keeping the product from [Image2] clearly visible in frame at a natural realistic size, not exaggerated');
    }
    if (speechLine) parts.push(speechLine);
    pushIfNonEmpty(parts, window.KolProduct?.contribute(ctx));
    pushIfNonEmpty(parts, CrewMembers.environment?.contribute(ctx));
    pushIfNonEmpty(parts, CrewMembers.wardrobe?.contribute(ctx));
    pushIfNonEmpty(parts, CrewMembers.makeup?.contribute(ctx));
    // 🔦 全域臉光保險:不管場景多硬,臉光一律柔,擋烤肉紋(2026-06 確認硬光是兇手)
    parts.push('keep the light on her face soft and even regardless of the scene, no harsh overhead glare or hot specular highlights on the skin');
    parts.push(CONTACT_CHAIN);   // 🤝 2026-08-11 公版接觸鏈:單鏡頭/接片這條路以前完全沒有,商品最容易在這裡飄

    // 🎬 ⑤ 攝影師接回單鏡頭路徑:運鏡(單支才有 movementId)+ REALISM_BASE + SCENE_REALISM
    //   ⚠️ 根因:這條原本只在 15 秒多鏡頭加,單鏡頭(接片強制走這條)整包漏掉
    //      → 接片 prompt 一直沒有電影寫實基底 =「背景假假的」根因之一。補回。
    //      接片 movementId=null → 只加寫實基底,不疊運鏡(運鏡交給分鏡卡)。
    pushIfNonEmpty(parts, CrewMembers.cinematographer?.contribute(ctx));

    if (persona) {
      const personaLine = CrewMembers.persona?.contribute(ctx);
      if (personaLine) parts.push('CHARACTER: ' + personaLine);
    }

    pushIfNonEmpty(parts, CrewMembers.storywriter?.contribute(ctx));

    if (false && opts.episode?.product) {
      parts.push('the product subtly featured is: ' + opts.episode.product.name +
        ' (' + (opts.episode.product.tag || 'casual wear') +
        '), integrate naturally without mentioning brand name');
    }
// v5.13:品牌靈魂調性放末尾(詞序黃金法則·克制·不搶主體)
    pushIfNonEmpty(parts, CrewMembers.brandSoul?.contribute(ctx));
    
    parts.push('no subtitles, no captions, no on-screen text, no burned-in text or watermark of any kind');
    return parts.filter(Boolean).join('. ');
  }

  function buildActionLine(brandId, scene, brand) {
    let action = (BRAND_ACTIONS[brandId] || BRAND_ACTIONS.default)
      .replace('{VERB}', scene.verb || 'naturally engages with the scene');

    if (action.includes('{PRODUCT_CONTEXT}')) {
      let productCtx = '';

      if (scene.product_context) {
        productCtx = scene.product_context;
      } else if (scene.product_context_template) {
        if (typeof window.resolveSceneProductContext === 'function') {
          productCtx = window.resolveSceneProductContext(scene, brand);
        } else {
          const brandAction = brand?.brand_type && window.BRAND_TYPE_ACTIONS
            ? (window.BRAND_TYPE_ACTIONS[brand.brand_type] || window.BRAND_TYPE_ACTIONS.default)
            : (CrewMembers.brandSoul?.getActionForBrandType(brand?.brand_type) || 'the product held or interacted with naturally');
          productCtx = scene.product_context_template.replace('{BRAND_ACTION}', brandAction);
        }
      } else {
        productCtx = 'the product is present in the scene naturally';
      }
      action = action.replace(/,?\s*\{PRODUCT_CONTEXT\}/, '');   // 🍖 瘦身:商品退出動作句(詞序),交給 PROP
    }

    return action;
  }

  function composeMultiShotPrompt(ctx, actionLine) {
    const scene = ctx.scene;
    const movements = scene.movements || {};
    const shotSequence = pickThreeShotsForScene(movements, ctx.movementId);

    const envText = CrewMembers.environment?.contribute(ctx) || '';
    const outfitText = scene.outfit ? 'wearing ' + scene.outfit : '';
    const lightText = scene.light || '';

    const subjectDesc = `A woman [Image1] ${outfitText}, consistent facial features and identity across all shots`;

    // 🆕 B版 劇情注入(15秒多鏡頭):動作鋪進三鏡頭,台詞放在中段鏡頭講出來。
    const { action: sitAction, speechLine } = parseSituation(ctx.episode?.situation, ctx.persona);
    let shot1, shot2, shot3;
    if (sitAction) {
      const act = 'She performs this action naturally as the main on-screen action: ' + sitAction;
      const speak = speechLine ? ' ' + speechLine : '';
      shot1 = `Shot 1 (0-5s): ${subjectDesc}. ${act} — beginning of the action. ${shotSequence[0].text}, ${envText}, ${lightText}`;
      shot2 = `Shot 2 (5-10s): Natural cut transition, same woman same scene. Continue: ${sitAction}.${speak} ${shotSequence[1].text}, ${lightText}`;
      shot3 = `Shot 3 (10-15s): Smooth cut. The satisfying closing moment of the action, ${shotSequence[2].text}, emotional closing beat, ${lightText}`;
    } else {
      shot1 = `Shot 1 (0-5s): ${subjectDesc}, ${shotSequence[0].text}, ${envText}, ${lightText}`;
      shot2 = `Shot 2 (5-10s): Natural cut transition. ${actionLine}, ${shotSequence[1].text}, same scene continues, ${lightText}`;
      shot3 = `Shot 3 (10-15s): Smooth cut. ${shotSequence[2].text}, emotional closing beat, ${lightText}`;
    }

    const arc = ctx.storyArc || {};
    const arcParts = [];
    if (arc.tone) arcParts.push('emotional tone throughout: ' + arc.tone);
    if (arc.theme) arcParts.push('overall theme: ' + arc.theme);
    if (arc.productHint) arcParts.push('subtle product emphasis: ' + arc.productHint);
    const arcLine = arcParts.length > 0
      ? arcParts.join(', ') + ', no explicit brand name mentioned, natural lifestyle integration.'
      : '';

    const cineText = CrewMembers.cinematographer?.REALISM_BASE || '';
    const personaLine = ctx.persona ? CrewMembers.persona?.contribute(ctx) : '';

   const soulTone = CrewMembers.brandSoul?.contribute(ctx) || '';
    const footer = [
      scene.extra,
      cineText,
      arcLine,
      personaLine ? 'CHARACTER: ' + personaLine : '',
      soulTone,
      'IMPORTANT: keep subject face and outfit consistent across all three shots, use natural cuts not hard jumps, single-take vlog feeling.',
    ].filter(Boolean).join(' ');

    return [shot1, shot2, shot3, footer].join('. ');
  }

  function pickThreeShotsForScene(movements, baseMovementId) {
    const CAMERA_MOVEMENTS = CrewMembers.cinematographer?.CAMERA_MOVEMENTS || {};
    const allKeys = Object.keys(movements);

    if (allKeys.length === 0) {
      return [
        { id: 'static', text: CAMERA_MOVEMENTS.static?.fallback || 'static shot' },
        { id: 'walk_through', text: CAMERA_MOVEMENTS.walk_through?.fallback || 'walking shot' },
        { id: 'pullback_reveal', text: CAMERA_MOVEMENTS.pullback_reveal?.fallback || 'pullback shot' },
      ];
    }

    const picks = [];
    picks.push({ id: 'static', text: movements.static || CAMERA_MOVEMENTS.static?.fallback || '' });

    const middle = baseMovementId && baseMovementId !== 'static'
      ? baseMovementId
      : (movements.walk_through ? 'walk_through' : allKeys.find(k => k !== 'static'));
    picks.push({ id: middle, text: movements[middle] || CAMERA_MOVEMENTS[middle]?.fallback || '' });

    const ending = movements.pullback_reveal ? 'pullback_reveal'
      : movements.dolly_in ? 'dolly_in'
      : allKeys.find(k => k !== 'static' && k !== middle);
    picks.push({ id: ending, text: movements[ending] || CAMERA_MOVEMENTS[ending]?.fallback || '' });

    return picks;
  }

  function pushIfNonEmpty(arr, val) {
    if (val && val.trim()) arr.push(val);
  }

  // ─── 導出 ────────────────────────────────────────────
  window.CrewDirector = {
    register,
    isReady,
    status,
    composePrompt,
    _members: CrewMembers,
    BRAND_ACTIONS,
  };

// ───────── 接片/參考圖路徑專用:精簡敘事組裝(真實度擺最前留滿)─────────
// 共用區塊只組一次;回 {front: 真實度核心(擺最前), tail: 商品/安全/品牌(擺最後)}
// 接片/參考圖路徑:自己建 ctx(跟 composeSeedancePrompt 同款參數)→ 回 {front, tail}
function composeStitchShared(brandId, sceneId, locationId, duration, opts) {
  opts = opts || {};
  const scenes = (typeof window.getScenesForBrand === 'function')
    ? window.getScenesForBrand(brandId)
    : (window.SCENE_LIBRARY?.[brandId] || {});
  const scene = scenes[sceneId];
  if (!scene) return { front: '', tail: '' };
  const brand = (window.S?.brands || []).find(b => b.id === brandId);
  const persona = opts.episode?.persona || null;
  const ctx = {
    brandId, brand, sceneId, scene, locationId,
    movementId: null,                                   // 接片不疊運鏡(交給角度圖/分鏡)
    duration: String(duration || '15'),
    persona,
    storyArc: opts.storyArc || window.S?.storyArc || {},
    outfitBrand: opts.outfitBrand || document.getElementById('outfit-brand-picker')?.value || window.S?.outfitBrand || '',
    episode: opts.episode || null,
  };

  const C = CrewMembers;
  const front = [];
  // ① 真實度核心 — 攝影師 contribute(自帶正確口音)·命脈全留·擺最前
  pushIfNonEmpty(front, C.cinematographer?.contribute(ctx));
  // ② 化妝只取「不蓋掉真皮 / 自然殘留」這層真實度
  front.push('any makeup is a thin surface finish only that must not smooth or replace the real skin underneath, it looks naturally worn not freshly applied');
  // ③ 打光(doc 說影響最大)
  //  🩹 2026-08-23:有客戶實景照時【不注入場景卡的光線描述】。
  //   病灶(RA 現場提出):場景卡的光線是為「AI 從無到有想像空間」寫的。
  //     客戶鎖了自家辦公室實景照,那張照片本身就帶著它真實的光 ——
  //     再塞一句「廚房晨光 / 咖啡廳午後」的光線描述進去,兩邊【競圖】,
  //     模型會把真照片往那個方向拉,實景就失真了。
  //   ★ RA:「文字自述很重要」—— 正因為文字真的會影響畫面,才更不能讓它打架。
  //   ★ 只拿掉這一句;SCENE_REALISM(通用落地錨)照留,那不綁特定場景。
  //   ★ 沒實景照時行為完全不變。
  if (ctx.scene?.light && !String(opts.sceneImageUrl || '').trim()) {
    front.push(ctx.scene.light);
  } else if (ctx.scene?.light) {
    try { console.log('[CrewDirector] 🏢 有實景照 → 略過場景光線描述(避免與真照片競圖)'); } catch (e) {}
  }
  front.push('keep the light on her face soft and even, no harsh overhead glare or hot specular highlights on the skin');
  // ④ 接地真實 + 🤝 公版接觸鏈(2026-08-11:光靠 never floating 這句否定句擋不住,商品照樣飄)
  front.push('soft natural contact shadows where her hands and the product touch surfaces, physically grounded never floating');
  front.push(CONTACT_CHAIN);

  // ═══════════════════════════════════════════════════════════════
  //  🩳 2026-08-23 tail 優先序重排(實測數字驅動,不是猜的)
  //   現場實測(芮比 30 秒接片):
  //     分鏡本體吃掉 ~1339 字 → front+tail 只剩 ~320 字
  //     → 系統自動把 front 砍到最小,擠出 201 字給 tail
  //     → 「🩳 商品鐵律保留 2/10 條」
  //   而舊順序是 [道具師(多句), 內衣鎖, 跨段道具鎖, 品牌調性, 無字幕],
  //   切開後道具師的子句全排在前面 → 預算用光 →
  //     ★ 跨段道具鎖(8/23 才加的)一次都沒送出去過
  //     ★ 無字幕條款排最後,也從來沒送出去(沒出字幕純屬運氣)
  //   ★ RA 定的優先序:「商品、人臉、背景、服裝最重要,越自然越好,色板還好」
  //     → 短而關鍵的規則往前,長而次要的往後,品牌調性墊底。
  //   ★ 這是零成本改動:只換順序,一個字都沒加。
  // ═══════════════════════════════════════════════════════════════
  const tail = [];

  //  道具師輸出是一整串用「;」串起來的子句。拆成【主句】與【其餘】——
  //  主句定義「這是什麼東西」(PROP / HERO PRODUCT / SERVICE RESULT…),
  //  少了它後面所有子句都失去主詞,所以它必須排第一(fitRules 對第一條無條件保留)。
  const _prodRaw = String(window.KolProduct?.contribute(ctx) || '');
  let _prodHead = '', _prodRest = '';
  if (_prodRaw) {
    const _p = _prodRaw.split(/(?:\.|;)\s+/)
      .map(function (x) { return x.trim().replace(/[.;]+$/, ''); })
      .filter(Boolean);
    _prodHead = _p.shift() || '';
    _prodRest = _p.join('; ');
  }

  // 1️⃣ 道具師主句 —— 再長都送(fitRules 保底)
  pushIfNonEmpty(tail, _prodHead);

  // 2️⃣ 內衣安全鎖(只在內衣品牌才存在)—— 法律風險,有就排前面
  if (['fashion_lingerie', 'lingerie', 'underwear'].includes(ctx.brand?.brand_type || '')) {
    tail.push('she is fully dressed in everyday outerwear, modest and tasteful, no exposed undergarments, no revealing clothing');
  }

  // 3️⃣ 無字幕條款 —— 只有 58 字,CP 值最高,絕不能再排最後
  tail.push('no subtitles, no captions, no on-screen text, no watermark');
  // 🆕 2026-08-23 跨段道具鎖 —— 接片專用,只在 shared 出現一次。
  //   病灶(現場實測 30 秒接片):臉、服裝、場景都鎖住了,
  //   【桌面道具沒有人管】→ 第一段白鍵盤 1 台銀螢幕、
  //   第二段黑鍵盤 2 台黑螢幕,桌上東西整組換掉。
  //   觀眾不會逐格比對臉,但「鍵盤突然從白變黑」一眼就看得出來,
  //   像剪錯片 —— 這比臉的細微漂移更傷。
  //   ★ 寫法刻意用「同一套東西、同樣位置」的正面陳述,
  //     不用 never change 這種否定句 —— 實測否定句擋不住(見 CONTACT_CHAIN 那條教訓)。
  //   ★ ⚠️ 絕不點名具體物件(鍵盤、滑鼠、螢幕)。
  //     RA 2026-08-23:「有時候又不一定是鍵盤滑鼠。」
  //     那三樣只存在於辦公桌;客戶場景可能是咖啡廳、廚房、賣場、診所、教室。
  //     明講不存在的東西,模型反而會【把它們生出來】——
  //     跟「不要想大象」同一個道理,點名即召喚。
  //     ★ 正解:講「畫面裡本來就有的東西」,由模型自己從場景參考圖認定是哪些。
  //   ★ 字數控制在 ~130 字:1700 牆已經很緊(實測 1690),不能再吃太多。
  tail.push('whatever objects appear in the environment stay exactly the same across all shots — '
    + 'same items, same count, same colours and models, resting in the same places; '
    + 'the setting is one continuous unchanged space, only the camera angle changes');

  // 5️⃣ 道具師其餘子句 —— 形狀鎖、尺寸鎖、接地、正面朝鏡頭…有多少放多少
  pushIfNonEmpty(tail, _prodRest);

  // 6️⃣ 品牌調性 —— RA 拍板:色板/調性可犧牲,排最後
  pushIfNonEmpty(tail, C.brandSoul?.contribute(ctx));

  return { front: front.filter(Boolean).join('. '), tail: tail.filter(Boolean).join('. ') };
}

// 每段只放「這一格獨一無二」的靈魂:動作+payoff(原封不動,絕不砍)+ 台詞
function composeStitchBeat(situation, persona) {
  const { action, speechLine } = parseSituation(situation, persona);
  return [action, speechLine].filter(Boolean).join('. ');
}
window.composeStitchShared = composeStitchShared;
window.composeStitchBeat   = composeStitchBeat;
  // ════════════════════════════════════════════════════════════════
  //  🆕 無臉模式 prompt 配方 · v5.13-faceless
  //  商品 = 主角([Image1]),不寫臉/妝/衣服/人設。
  //  動作:cooking(做菜手)/ shoes(試穿腳)/ hold(手持展示)
  // ════════════════════════════════════════════════════════════════
  const FACELESS_REALISM = "Extreme realism, premium cinematic commercial quality, no stylized CGI, no cartoon look, true-to-life skin, soft natural daylight, realistic textures, soft natural contact shadows where things touch surfaces, physically grounded never floating, subtle handheld micro-movement, shallow depth of field. 9:16 vertical.";
  const FACELESS_NOTEXT  = "Silent product footage with ambient sound only — nobody speaks, there is no voice and no dialogue in this shot. No subtitles, no captions, no on-screen text, no watermark.";

  // 🩹 2026-08-11 無臉模式改寫(v5.13 → v5.17-facelessframing)
  //   病灶:舊版靠「no face, no person」這種否定句去擋人。實測(PiAPI Seedance 2.0
  //         omni_reference,2026-08-11 596s 那支)模型完全無視,自己生了一張臉還幫忙配音。
  //   原因:PiAPI 官方文件確認 Seedance 2.0 沒有 negative_prompt 欄位;
  //         影片模型對否定句本來就極不敏感,「不要有人」反而把「人」餵進了注意力。
  //   修法:改用「攝影機位置」做物理排除 —— 俯拍鍋子、鏡頭架在膝蓋以下、桌面微距。
  //         攝影機擺在那個位置,臉根本進不了畫面,不需要拜託模型。
  //   口訣:不要說「不要拍到臉」,要說「鏡頭在哪、框到哪、不准上抬」。
  const FACELESS_CAMERA = "Locked camera position — the camera never tilts up, never pans up, and never widens beyond the framing described. Absolutely nothing above the described crop line ever enters the frame.";

  // 商品外觀一律鎖死在 [Image1],避免模型自己重新設計包裝
  const FACELESS_KEEP = " Keep the product's shape, colour, material, label and proportions identical to [Image1] — do not redesign it.";
  // 💻 2026-08-23 螢幕鐵律:電腦類動作必用。
  //   病灶:客戶上傳的是「螢幕截圖」,模型會把它當成一張實體紙片畫在桌上
  //     (跟海苔被畫成桌上實體物是同一種病)。必須明講:那是螢幕【裡面】的內容,
  //     由螢幕自己發光顯示,不是一張放在桌上的印刷品。
  const SCREEN_RULE = "The screen content shown in [Image1] is the live interface displayed inside the monitor itself — it is emitted by the screen and glows from within the display panel. It is never a printed sheet, never a photograph, never a physical object lying on the desk, and it is never held in a hand. The screen bezel and the display surface stay clearly visible around it, and the interface keeps its exact layout, colours and proportions from [Image1].";
  // 「嘴部特寫」專用裁切:只留下巴到鎖骨,眼睛與上半臉永遠在畫面外(食品/飲料必用)
  const FACELESS_CHINCROP = "Tight close-up cropped from just below the nose down to the collarbone — only the chin, lips and jawline are in frame. The eyes, nose and upper face are always outside the frame and never appear.";

  const FACELESS_ACTIONS = {
    // ══ 料理 · 廚房(旺味 / 福臨門 / 琉宇醬選)══
    cut:      "Overhead top-down macro shot: the camera is directly above a wooden chopping board, roughly 60cm up, pointing straight down. The only things in frame are the board, the food, a knife, and two hands entering from the bottom edge. " + FACELESS_CAMERA + " The hands slice the exact food shown in [Image1] with steady rhythmic cuts, the knife making real contact with the board, slices falling neatly apart to reveal the inner texture." + FACELESS_KEEP,

    pan:      "Overhead top-down macro shot: the camera is directly above a hot frying pan, roughly 60cm up. The only things in frame are the pan, the food, and one hand entering from the bottom edge holding tongs. " + FACELESS_CAMERA + " The exact food shown in [Image1] sizzles in the pan, the tongs turn it over, the surface browning with visible caramelisation and light steam rising toward the lens." + FACELESS_KEEP,

    airfryer: "Macro shot at appliance height, camera about 40cm from an air fryer on a countertop, framing only the appliance and two hands entering from the side edges. " + FACELESS_CAMERA + " The hands slide the basket out, arrange the exact food shown in [Image1] inside, push the basket closed, then later pull it open again with hot steam billowing out and the food visibly crisped." + FACELESS_KEEP,

    soup:     "Overhead top-down macro shot: the camera is directly above a simmering pot on a stove, roughly 70cm up. The only things in frame are the pot, the soup, and hands entering from the bottom edge. " + FACELESS_CAMERA + " One hand lifts the lid and steam rushes toward the lens, then a ladle stirs the exact ingredients shown in [Image1] through the broth, lifting a ladleful so the contents and the clarity of the soup are clearly visible." + FACELESS_KEEP,

    taste:    "Close-up tasting shot. " + FACELESS_CHINCROP + " " + FACELESS_CAMERA + " One hand enters from the bottom edge holding a spoon of the exact dish shown in [Image1], brings it to the lips, blows gently once, then takes a taste — the lips close around the spoon, the jaw moves once, and the corner of the mouth lifts in approval." + FACELESS_KEEP,

    // ── 食品 · 飲料 ──────────────────────────────
    cooking: "Overhead top-down macro shot: the camera is mounted directly above a hot wok on a stove, pointing straight down at the pan, roughly 60cm above the cooking surface. The only things in frame are the wok, the food, and two hands with forearms entering from the bottom edge. " + FACELESS_CAMERA + " [Image1] shows the finished dish; recreate that exact dish — the hands toss and stir-fry the same ingredients, food sizzling with light steam rising toward the lens, ending as a dish identical to [Image1] in ingredients, colour and glaze." + FACELESS_KEEP,

    eat:     "Close-up eating shot. " + FACELESS_CHINCROP + " " + FACELESS_CAMERA + " One hand enters from the bottom edge holding the exact food product shown in [Image1], lifts it to the lips and takes a bite — the fingers keep pinching it the whole way up, the food bends slightly under its own weight, a real crisp bite with visible texture at the break, then the jaw chews once and the corner of the mouth lifts slightly." + FACELESS_KEEP,

    drink:   "Close-up drinking shot. " + FACELESS_CHINCROP + " " + FACELESS_CAMERA + " One hand enters from the bottom edge holding the exact drink shown in [Image1], the fingers wrapped around the body of the container, lifts it to the lips and takes a sip — the liquid visibly moves inside as it tilts, condensation on the surface, then it lowers back down out of frame." + FACELESS_KEEP,

    // ── 手部 · 商品操作 ──────────────────────────
    hold:    "Tabletop macro shot: the camera is at table height, roughly 40cm from the product, framing only the tabletop and two hands with forearms entering from the bottom and side edges. The product fills most of the frame. " + FACELESS_CAMERA + " The hands hold and present the exact product shown in [Image1] toward the lens, turning it slowly to reveal its details." + FACELESS_KEEP,

    unbox:   "Tabletop macro shot from a slight high angle, camera about 50cm above a clean table, framing only the table surface and two hands entering from the bottom edge. " + FACELESS_CAMERA + " The hands open the exact packaging shown in [Image1] — fingers grip the seal, peel or lift it open with real resistance and material sound, then lift the contents out and set them down on the table." + FACELESS_KEEP,

    pour:    "Countertop macro shot: the camera is at counter height, framing only the countertop, the container and two hands entering from the side edges. " + FACELESS_CAMERA + " The hands hold the exact product shown in [Image1] and pour or dispense it into a cup or bowl — the stream or the falling contents are clearly visible, the container tilts with real weight, then it is set back down and the hands release it only after it touches the surface." + FACELESS_KEEP,

    demo:    "Macro shot at product height, roughly 40cm away, framing only the product and two hands entering from the bottom and side edges. " + FACELESS_CAMERA + " The hands operate the exact product shown in [Image1] — pressing, twisting, switching or adjusting it — each contact point between fingers and product clearly visible, the product responding realistically to the action." + FACELESS_KEEP,

    // ── 穿戴 ─────────────────────────────────────
    shoes:   "Ground-level camera: the camera sits on the floor about 30cm away, lens at ankle height, framing only from the knees down on a clean light wood floor near a bright window. The only things in frame are the shoes, the feet, the lower legs and the floor. " + FACELESS_CAMERA + " The feet wear the exact shoes shown in [Image1]. Natural try-on motion: one foot slides into the shoe, a gentle step forward, a small ankle turn that reveals the side profile of the shoe." + FACELESS_KEEP,

    wear:    "Macro shot of hands and wrists only, camera about 30cm away, framing from the mid-forearm to the fingertips against a clean soft-lit background. " + FACELESS_CAMERA + " The hands put on and adjust the exact item shown in [Image1] — a watch, bracelet, ring or glove — fingers fastening or sliding it into place, then the wrist turns slowly so the light travels across the material." + FACELESS_KEEP,

    // ══ 包裝 · 開箱(零食 / 鞋盒 / 禮盒)══
    tear:     "Tabletop macro shot, camera at table height about 35cm from the package, framing only the table surface and two hands entering from the bottom edge. " + FACELESS_CAMERA + " The fingers grip the notch of the exact package shown in [Image1] and tear it open along the seal with real resistance, the film crinkling and separating, then the hands part the opening so the contents inside become visible." + FACELESS_KEEP,

    boxout:   "Tabletop macro shot from a slight high angle, camera about 50cm above a clean table, framing only the table and two hands entering from the bottom edge. " + FACELESS_CAMERA + " The hands lift the lid off the exact box shown in [Image1], fold back the tissue paper, then lift the product out with both hands and set it down gently on the table — the box, the paper and the product all clearly visible." + FACELESS_KEEP,

    // ══ 服飾 · 配件(MOZ / LACEZ / RADESIGN)══
    //   ⚠️ LACEZ 內衣刻意設計成「純商品鏡頭」,不做穿在身上的畫面:
    //      ① Meta / IG / TikTok 對貼身衣物上身的廣告審查嚴格
    //      ② AI 生成的身體極易翻車,精品質感反而被毀
    //      衣架、平放、手拿、抽出包裝這幾種,材質光澤更好看,也更像精品廣告。
    hanger:   "Wardrobe shot: the camera is at chest height about 50cm from an open wardrobe rail, framing only the hanging garments and two hands entering from the side edge. " + FACELESS_CAMERA + " The hands slide the hangers apart, then lift out the exact garment shown in [Image1] on its hanger and hold it up to the light — the fabric falls naturally with its own weight, lace or satin catching a soft highlight as it turns." + FACELESS_KEEP,

    layflat:  "Overhead top-down shot: the camera is directly above a clean surface, roughly 70cm up, framing only the surface, the product and two hands entering from the bottom edge. " + FACELESS_CAMERA + " The hands lay out the exact item shown in [Image1] flat, smooth it with the fingertips, then trace along an edge or a seam so the material, stitching and texture read clearly." + FACELESS_KEEP,

    bag:      "Tabletop macro shot at bag height, camera about 45cm away, framing only the surface, the bag and two hands entering from the side edges. " + FACELESS_CAMERA + " The hands present the exact bag shown in [Image1] — turning it to show the side profile, opening the flap or zip, then holding the strap so the bag hangs and settles with its own weight." + FACELESS_KEEP,

    putin:    "Tabletop macro shot from a slight high angle, camera about 40cm above the surface, framing only the surface, the case and two hands entering from the bottom edge. " + FACELESS_CAMERA + " The hands open the exact case or pouch shown in [Image1], place the item inside, and close it — every contact point between fingers, item and case clearly visible, the closure fastening with a real click or fold." + FACELESS_KEEP,

    // ══ 家電 · 工具 · 器材(巧福 / PROTEX)══
    spray:    "Macro shot at product height, camera about 50cm to the side, framing only the product, the spraying hand and the surface being sprayed. " + FACELESS_CAMERA + " The hand grips the exact product shown in [Image1], the index finger presses the trigger, and a clearly visible mist sprays outward in a fan through backlit air, settling on the target surface." + FACELESS_KEEP,

    mop:      "Low camera near the floor, about 50cm up and angled down at the floor, framing only the floor, the tool and the lower legs and hands operating it. " + FACELESS_CAMERA + " The hands push and pull the exact tool shown in [Image1] across the floor in steady strokes, leaving a visibly clean track behind it, the head of the tool flexing as it changes direction." + FACELESS_KEEP,

    press:    "Macro shot at appliance height, camera about 35cm from the control panel, framing only the appliance and one hand entering from the side edge. " + FACELESS_CAMERA + " The index finger presses a button or turns a dial on the exact appliance shown in [Image1] — the button depresses, an indicator light comes on, and the appliance visibly starts working." + FACELESS_KEEP,

    // ══ 寵物(EVERY HAY)══
    peteat:   "Floor-level camera about 40cm from a pet bowl, lens at bowl height, framing only the bowl, the floor and the pet. " + FACELESS_CAMERA + " A human hand enters from the top edge and pours the exact pet food shown in [Image1] into the bowl, then withdraws; the pet steps in and eats eagerly, tail moving, the individual pieces of food clearly visible." + FACELESS_KEEP,

    // ══ 身心 · 律動(空瑪那 / 禪舞)══
    mudra:    "Close-up macro shot of hands only, camera about 40cm away at chest height against a softly lit calm background. " + FACELESS_CAMERA + " The hands come together slowly into a meditation gesture, fingers settling one by one, breathing rhythm visible in the small natural movement, warm side light grazing across the skin and across the exact item shown in [Image1] resting nearby." + FACELESS_KEEP,

    matfeet:  "Ground-level camera on the floor about 60cm away, lens at mat height, framing only the mat, the feet and the lower legs. " + FACELESS_CAMERA + " The bare feet step onto the exact mat shown in [Image1], the toes spread and grip, then the weight shifts slowly from one foot to the other — the mat surface texture and thickness clearly visible under the pressure." + FACELESS_KEEP,

    bowl:     "Close-up macro shot from a slight high angle, camera about 40cm above a singing bowl on a cloth, framing only the bowl, the mallet and the hands. " + FACELESS_CAMERA + " One hand steadies the exact bowl shown in [Image1] while the other strikes its rim softly and then circles the mallet around the edge, the surface visibly vibrating, incense smoke drifting slowly through the light." + FACELESS_KEEP,

    silhouette: "Backlit silhouette shot: the camera faces a bright window with the subject between camera and light, framing the body from behind and slightly to the side so the figure reads as a dark silhouette with no facial features visible at any point. " + FACELESS_CAMERA + " The silhouette moves slowly and fluidly — arms sweeping, torso turning, fabric trailing — a calm expressive movement sequence, dust motes floating in the backlight." + FACELESS_KEEP,

    // ══ 商務 · 文件(大東國際專利)══
    sign:     "Overhead top-down shot: the camera is directly above a desk, roughly 60cm up, framing only the desk surface, the documents and two hands entering from the bottom edge. " + FACELESS_CAMERA + " One hand steadies the paperwork while the other signs it with a fountain pen in smooth strokes, then presses a seal firmly onto the page and lifts it away to reveal a clean red impression." + FACELESS_KEEP,

    review:   "Overhead top-down shot: the camera is directly above a desk, roughly 55cm up, framing only the desk, the documents and two hands entering from the bottom and side edges. " + FACELESS_CAMERA + " The hands turn the pages of the paperwork, a fingertip traces along a line of text and stops to tap a key clause twice, then slides the page across the desk toward the other side." + FACELESS_KEEP,

    // ══ 💻 電腦 · 數位工作(2026-08-23 新增)══
    //   缺口:整個「桌前工作」的行業(廣告 / 行銷 / 設計 / SaaS / 顧問 / 會計)
    //     在無臉模式裡一個動作都沒有 —— 舊的「商務 · 文件」全是紙本時代的動作。
    //   ★ screen / laptop / handoff 這三條靠 SCREEN_RULE 撐著:
    //     沒有那條,模型會把螢幕截圖畫成「一張平躺在桌上的紙」。
    //     這條規則跟道具師 tail 裡那條是同一件事,這裡自己再講一次,
    //     不依賴 tail 有沒有被送出去(tail 會被 1700 牆砍)。
    mouse:    "Close-up at a shallow 45-degree angle looking down across a desk, roughly 40cm from the surface, framing only the desk mat, a computer mouse and one hand entering from the bottom edge. " + FACELESS_CAMERA + " The hand rests on the mouse, glides it a short distance across the mat, the index finger clicks twice with a clear visible press, then the finger rolls the scroll wheel and the hand settles still." + FACELESS_KEEP,

    typing:   "Overhead top-down shot: the camera is directly above a keyboard, roughly 45cm up, framing only the keyboard, the desk immediately around it, and two hands entering from the bottom edge. " + FACELESS_CAMERA + " The fingers type in a steady natural rhythm, keys visibly depressing under each fingertip, one hand pauses and taps a single key deliberately, then both hands lift slightly and settle back onto the home row." + FACELESS_KEEP,

    screen:   "Medium close-up from slightly off-axis in front of a computer monitor, roughly 50cm away, framing the screen and the desk edge below it, with one hand entering from the bottom or side edge. " + SCREEN_RULE + " " + FACELESS_CAMERA + " The interface on the screen is live and moving — a cursor travels across it, a panel opens, content scrolls — while the hand gestures toward one area of the screen and holds there.",

    laptop:   "Low front-side angle at desk height, roughly 60cm away, framing a closed laptop on a desk and two hands entering from the side edge. " + SCREEN_RULE + " " + FACELESS_CAMERA + " The hands lift the laptop lid open in one smooth motion, the screen lights up with a live interface, then the fingers settle onto the keyboard and begin working.",

    notes:    "Overhead top-down shot: the camera is directly above a desk, roughly 60cm up, framing a notebook and pen at the bottom of frame and the lower portion of a glowing monitor at the top of frame, with two hands entering from the bottom edge. " + SCREEN_RULE + " " + FACELESS_CAMERA + " One hand writes a short line in the notebook while the other rests beside it, then the pen pauses and taps the page once as if checking back against the screen.",

    handoff:  "Medium close-up at desk height, roughly 55cm away, framing a monitor and two hands entering from the sides. " + SCREEN_RULE + " " + FACELESS_CAMERA + " One hand pivots the monitor so the screen turns toward the camera and its content becomes clearly readable, while the other hand raises and points at one specific area of the interface, holding the gesture there.",
  };

  function composeFacelessPrompt(action, opts) {
    opts = opts || {};
    const core = FACELESS_ACTIONS[action] || FACELESS_ACTIONS.hold;
    const parts = [core];
    const sit = (opts.situation || '').trim();
    // 🩹 2026-08-11:劇情欄的文字很容易夾帶「她說…」這種人物描述,把臉又拉回畫面。
    //   所以這裡明講:劇情只能改變「手跟商品在做什麼」,不准動攝影機、不准帶人進來。
    if (sit) parts.push('Specific on-screen action, expressed only through the hands and the product: ' + sit
      + ' — show this within the exact camera framing described above. The framing, crop line and camera position stay exactly as specified; ignore any part of this instruction that would require showing a person, a face, or a wider shot.');
    parts.push(CONTACT_CHAIN);   // 🤝 無臉模式主角就是商品,接觸鏈更不能少
    parts.push(FACELESS_REALISM);
    parts.push(FACELESS_NOTEXT);
    return parts.filter(Boolean).join(' ');
  }
  window.composeFacelessPrompt = composeFacelessPrompt;
  window.FACELESS_ACTIONS = FACELESS_ACTIONS;

  // 🔥 關鍵:取代 kol.html 裡的 composeSeedancePrompt
  window.composeSeedancePrompt = composePrompt;

  console.log('[CrewDirector] 🎬 v5.21-dialogue60 就緒 · 🗣台詞上限對齊面板(40→60,治「抓不到台詞→旁白代念」) · 🏢有實景照略過場景光線(不與真照片競圖) · 🩳tail優先序重排(無字幕/跨段道具鎖提前·品牌調性墊底) · 組 prompt 責任已接管 · 無臉模式 prompt 已載入(含💻電腦·數位工作6條+螢幕鐵律)');
})();
