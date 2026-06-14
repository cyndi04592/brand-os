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
    default: 'A person [Image1] {VERB}, the product shown in [Image2] held naturally in hand and clearly visible in frame at a realistic true-to-life size, neither tiny nor exaggerated, integrated naturally into the action, speaks directly to camera with natural warmth',
  };

  /**
   * 組合 prompt · 核心(取代 kol.html composeSeedancePrompt)
   */
  // 🆕 B版 劇情注入解析:把劇情框拆成「動作」+「台詞」雙軌。
  // Seedance 2.0 原生會講話:引號內的句子會被當台詞對嘴唸出來。
  //   - 抓出所有中/英引號內的句子 → 當台詞(speaks in Mandarin: "...")
  //   - 引號外的字 → 當動作描述
  //   回傳 { action, speechLine }。沒台詞 → speechLine 為 ''。
  function parseSituation(raw) {
    const situation = (raw || '').trim();
    if (!situation) return { action: '', speechLine: '' };

    // 同時支援中文引號「」『』 與英文 " " 和 ' '
    const quoteRe = /[「『"']([^「『"'』」]{1,40})[」』"']/g;
    const lines = [];
    let m;
    while ((m = quoteRe.exec(situation)) !== null) {
      const t = (m[1] || '').trim();
      if (t) lines.push(t);
    }

    // 動作 = 把引號連同內容拿掉後剩下的字
    const action = situation.replace(quoteRe, ' ').replace(/\s+/g, ' ').trim();

    let speechLine = '';
    if (lines.length) {
      // FAL 規矩:短句最佳(5-10字),標語言。多句用逗號接成一段。
      const quoted = lines.map(s => `"${s}"`).join(', ');
      speechLine = `She speaks in natural Taiwanese Mandarin, clear lip-sync, saying: ${quoted}. No background music.`;
    }
    return { action, speechLine };
  }

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

    const actionLine = buildActionLine(brandId, scene, brand);

    const ctx = {
      brandId, brand,
      sceneId, scene,
      locationId,
      movementId,
      duration: String(duration || '10'),
      persona,
      storyArc,
      episode: opts.episode || null,
    };

    // 15 秒多鏡頭(接片模式強制單鏡頭,不要每段又切三刀)
    if (String(duration) === '15' && !opts.forceSingleShot) {
      return composeMultiShotPrompt(ctx, actionLine);
    }

    // 🆕 B版 劇情注入:動作 + 台詞雙軌。
    // ⚠️ 修正:劇情動作只「補充」不「取代」actionLine —— actionLine 裝著商品放大 + [Image2]引用,
    //    被丟掉的話,一填劇情商品就不見了(跟「商品要大」的核心需求打架)。
    const { action: sitAction, speechLine } = parseSituation(opts.episode?.situation);

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
      action = action.replace('{PRODUCT_CONTEXT}', productCtx);
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
    const { action: sitAction, speechLine } = parseSituation(ctx.episode?.situation);
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

  // 🔥 關鍵:取代 kol.html 裡的 composeSeedancePrompt
  window.composeSeedancePrompt = composePrompt;

  console.log('[CrewDirector] 🎬 v5.12 Full 版就緒 · 組 prompt 責任已接管');
})();
