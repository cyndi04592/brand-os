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
  };

  /**
   * 組合 prompt · 核心(取代 kol.html composeSeedancePrompt)
   */
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

    // 15 秒多鏡頭
    if (String(duration) === '15') {
      return composeMultiShotPrompt(ctx, actionLine);
    }

    // 🆕 劇情注入:使用者劇情框(episode.situation)是「畫面在做什麼」的最高指令。
    // 有填 → 用它當開頭動作句(蓋過品牌罐頭動作),並關掉「對鏡頭講話」的預設,
    // 讓 AI 演動作而不是站著瞎掰台詞。沒填 → 退回原本的罐頭 actionLine。
    const situation = (opts.episode?.situation || '').trim();
    let openingAction = actionLine;
    if (situation) {
      openingAction = 'The woman performs this specific action: ' + situation
        + ' — show her actually doing it as the main on-screen action, '
        + 'natural and unscripted, not speaking to the camera.';
    }

    // 單鏡頭:按角色順序組裝
    const parts = [openingAction];

    pushIfNonEmpty(parts, CrewMembers.environment?.contribute(ctx));
    pushIfNonEmpty(parts, CrewMembers.wardrobe?.contribute(ctx));
    pushIfNonEmpty(parts, CrewMembers.makeup?.contribute(ctx));
    pushIfNonEmpty(parts, CrewMembers.cinematographer?.contribute(ctx));

    if (persona) {
      const personaLine = CrewMembers.persona?.contribute(ctx);
      if (personaLine) parts.push('CHARACTER: ' + personaLine);
    }

    pushIfNonEmpty(parts, CrewMembers.storywriter?.contribute(ctx));

    if (opts.episode?.product) {
      parts.push('the product subtly featured is: ' + opts.episode.product.name +
        ' (' + (opts.episode.product.tag || 'casual wear') +
        '), integrate naturally without mentioning brand name');
    }

    return parts.filter(Boolean).join('. ');
  }

  function buildActionLine(brandId, scene, brand) {
    let action = (BRAND_ACTIONS[brandId] || BRAND_ACTIONS.la)
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

    // 🆕 劇情注入(15秒多鏡頭):有填劇情 → 用它當三鏡頭的主軸動作,
    // 蓋過罐頭 actionLine,讓她照劇情演(撕→吃→滿足的節奏由 AI 依 situation 分配)。
    const situation = (ctx.episode?.situation || '').trim();
    let shot1, shot2, shot3;
    if (situation) {
      const act = 'She performs this action naturally as the main on-screen action (not speaking to camera): ' + situation;
      shot1 = `Shot 1 (0-5s): ${subjectDesc}. ${act} — beginning of the action. ${shotSequence[0].text}, ${envText}, ${lightText}`;
      shot2 = `Shot 2 (5-10s): Natural cut transition, same woman same scene. Continue the same action: ${situation}. ${shotSequence[1].text}, ${lightText}`;
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

    const footer = [
      scene.extra,
      cineText,
      arcLine,
      personaLine ? 'CHARACTER: ' + personaLine : '',
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
