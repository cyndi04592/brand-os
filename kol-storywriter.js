// ════════════════════════════════════════════════════════════════════
//  kol-storywriter.js · v5.13
//
//  📖 編劇 — 故事弧、情緒基調、分鏡 beat 產生器
//
//  職責:
//   • 管理故事弧(storyArc = theme / tone / productHint)
//   • 單集故事情境(situation)
//   • 🆕 v5.13:分鏡 beat 產生器(秒數 → beat 結構)
//   • 🆕 v5.13:台詞秒數守門(一句話塞不塞得進一個 15 秒 beat)
//
//  ⚠️ 本檔只負責「結構與骨架」。大綱 → 填好 beat 的 AI 編修走 Worker(下一塊);
//     最終 prompt 組裝仍由 kol-crew-director 負責,本檔只提供 contribute() 內容。
// ════════════════════════════════════════════════════════════════════

(function () {
  'use strict';

  // ─── 分鏡 beat 模板(秒數 → 起承轉收結構)──────────────
  //   每段 = 15 秒 = 1 個 beat = Seedance 一次生成
  const BEAT_ROLES = {
    hook:   { zh: '起 · 開場勾人',  hint: 'opening hook, establish character and setting, draw attention immediately' },
    build:  { zh: '承 · 鋪陳',      hint: 'build context, introduce the situation or need naturally' },
    turn:   { zh: '轉 · 轉折亮點',  hint: 'turning point, the key moment where the product comes into play' },
    turn2:  { zh: '轉² · 強化',     hint: 'second beat of tension or reinforcement, deepen the moment' },
    payoff: { zh: '收 · 收尾',      hint: 'payoff, show the satisfying result or resolution' },
    cta:    { zh: 'CTA · 行動呼籲', hint: 'closing call-to-action or warm sign-off to the viewer' },
  };

  const DURATION_TEMPLATES = {
    15: ['hook'],
    30: ['hook', 'payoff'],
    45: ['hook', 'build', 'payoff'],
    60: ['hook', 'build', 'turn', 'payoff'],
    90: ['hook', 'build', 'turn', 'turn2', 'payoff', 'cta'],
  };

  const SECONDS_PER_BEAT = 15;
  const SPEAK_RATE = 4.5; // 中文每秒約 4-5 字

  /**
   * 依秒數產生 beat 骨架(純函式、無網路)
   * @param {number} durationSec - 15 / 30 / 45 / 60 / 90
   * @returns {Array} beat 骨架陣列
   */
  function planBeats(durationSec) {
    let roles = DURATION_TEMPLATES[durationSec];

    // fallback:非預設秒數 → 用最接近的整數段數推
    if (!roles) {
      const n = Math.max(1, Math.round(durationSec / SECONDS_PER_BEAT));
      const base = ['hook', 'build', 'turn', 'turn2', 'payoff', 'cta'];
      roles = n <= base.length
        ? base.slice(0, n)
        : [...base, ...Array(n - base.length).fill('build')];
    }

    return roles.map((role, i) => ({
      index: i + 1,
      role,
      zhLabel: BEAT_ROLES[role]?.zh || role,
      hint: BEAT_ROLES[role]?.hint || '',
      seconds: SECONDS_PER_BEAT,
      shotDesc: '',          // ← AI 編修 / 使用者填:這格的鏡頭描述
      dialogue: '',          // ← 這格的台詞
      dialogueLocked: false, // ← true = 使用者釘死,AI 不准改
    }));
  }

  /**
   * 台詞秒數守門:這句話塞不塞得進一個 15 秒 beat?
   * @returns {{ chars:number, estSec:number, fits:boolean }}
   */
  function checkDialogueFit(text, beatSeconds = SECONDS_PER_BEAT) {
    const chars = (text || '').replace(/\s/g, '').length;
    const estSec = +(chars / SPEAK_RATE).toFixed(1);
    return { chars, estSec, fits: estSec <= beatSeconds * 0.9 }; // 留 10% 餘裕
  }

  /**
   * 把一個填好的 beat 轉成現有 pipeline 吃的 episode 設定
   *   shotDesc → episode.situation(走既有 contribute / crew 組 prompt)
   *   dialogue 另外傳給 Seedance 當口白腳本(不進視覺 prompt)
   */
  function beatToEpisode(beat, baseEpisode = {}) {
    return {
      ...baseEpisode,
      situation: beat.shotDesc || baseEpisode.situation || '',
      _beatRole: beat.role,
      _beatIndex: beat.index,
    };
  }

  /**
   * 產出故事段落(v5.12 既有行為,完全不動)
   */
  function contribute(ctx) {
    const parts = [];

    const arc = ctx.storyArc || {};
    const arcParts = [];
    if (arc.tone) arcParts.push('emotional tone: ' + arc.tone);
    if (arc.theme) arcParts.push('content theme: ' + arc.theme);
    if (arc.productHint) arcParts.push('subtle product emphasis: ' + arc.productHint);
    if (arcParts.length > 0) {
      parts.push(arcParts.join(', ') + ', no explicit brand name mentioned, natural lifestyle integration');
    }

    if (ctx.episode?.situation) {
      parts.push('scene context: ' + ctx.episode.situation);
    }

    if (ctx.episode?.portraitMode === 'natural') {
      parts.push('IMPORTANT: generate this scene purely from text description, do not anchor to any reference face, let the imagination flow freely for maximum naturalism, authentic imperfect human presence, slight asymmetry in facial features is welcomed');
    }

    return parts.join('. ');
  }

  /**
   * 多鏡頭故事拆分 — v5.13 起改委派 planBeats
   * (保留舊名,內部已升級為 beat 模型;原本回 null、無人呼叫)
   */
  function splitForMultiShot(situation, duration) {
    const beats = planBeats(duration);
    if (beats.length && situation) beats[0].shotDesc = situation;
    return beats;
  }

  // ─── 導出 + 自動向總導演註冊 ─────────────────────────
  window.KolStorywriter = {
    contribute,
    splitForMultiShot,
    planBeats,
    checkDialogueFit,
    beatToEpisode,
    BEAT_ROLES,
    DURATION_TEMPLATES,
  };

  if (window.CrewDirector?.register) {
    window.CrewDirector.register('storywriter', window.KolStorywriter);
  }

  console.log('[KolStorywriter] 📖 v5.13 就緒(分鏡 beat 產生器)');
})();
