// ════════════════════════════════════════════════════════════════════
//  kol-storywriter.js · v5.14
//
//  📖 編劇 — 故事弧、情緒基調、分鏡 beat 產生器 + AI 編修前端
//
//  職責:
//   • 管理故事弧(storyArc = theme / tone / productHint)
//   • 單集故事情境(situation)
//   • 分鏡 beat 產生器(秒數 → beat 結構)
//   • 台詞秒數守門
//   • 🆕 v5.14:AI 編修前端(打包請求 buildExpandRequest / 合併結果 mergeExpandResult)
//
//  ⚠️ 本檔只負責「結構、骨架、打包、合併」,全是純函式、不碰網路。
//     網路(api('storyboard_expand'))發生在 kol.html;最終 prompt 組裝由 crew-director 負責。
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
  const SPEAK_RATE = 4.2; // 2026-07-03 實測校準:欣怡 36字/8秒≈4.5字/秒,取保守4.2(舊值3.5低估→台詞配太少→尾段空窗7秒)

  /**
   * 依秒數產生 beat 骨架(純函式、無網路)
   */
  function planBeats(durationSec) {
    let roles = DURATION_TEMPLATES[durationSec];
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
      shotDesc: '',
      dialogue: '',
      dialogueLocked: false,
    }));
  }

  /**
   * 台詞秒數守門:這句話塞不塞得進一個 beat?
   */
  function checkDialogueFit(text, beatSeconds = SECONDS_PER_BEAT) {
    const chars = (text || '').replace(/\s/g, '').length;
    const estSec = +(chars / SPEAK_RATE).toFixed(1);
    return { chars, estSec, fits: estSec <= beatSeconds * 0.9 };
  }

  /**
   * 🆕 打包 AI 編修請求 → 給 api('storyboard_expand') 用的 payload(純函式)
   * @param {object} inputs - { duration, outline, lockedLines, persona, product, sceneLabel }
   */
  function buildExpandRequest({
    duration, outline, lockedLines,
    persona = {}, product = {}, sceneLabel = '',
  }) {
    const joinList = (v) => Array.isArray(v) ? v.join('、') : (v || '');
    return {
      durationSec: duration,
      beats: planBeats(duration),
      outline: outline || '',
      lockedLines: Array.isArray(lockedLines) ? lockedLines : [],
      kolName: persona.persona_name || persona.name || '',
      kolBackground: persona.background || '',
      kolPersonality: persona.personality || '',
      kolSpeakingStyle: persona.speaking_style || '',
      kolNationality: persona.nationality || 'tw',
      kolCatchphrases: joinList(persona.catchphrases),
      kolTabooWords: joinList(persona.taboo_words),
      productName: product.name || '',
      productTag: product.tag || '',
      sceneLabel: sceneLabel || '',
    };
  }

  // 🆕 發音友善化:台詞送去生語音前,清掉會害引擎念歪的雷(只清發音,不改語意/口氣)
  //   ⚠️ 看國籍:香港/廣東(講粵語)→ 跳過粵語轉換,保留他的腔;其餘(台灣/大陸/日本講國語)才套。
  //   ⚠️ 只用在「非鎖定」台詞;使用者手鎖的台詞一字不改。
  const _CANTO_MAP = [
    ['呢個','這個'], ['嗰個','那個'], ['咁樣','這樣'], ['乜嘢','什麼'],
    ['係','是'], ['唔','不'], ['咁','這樣'], ['嘅','的'], ['喺','在'],
    ['畀','給'], ['乜','什麼'], ['冇','沒'], ['嘢','東西'],
  ];
  function speechFriendly(t, nationality){
    if(!t) return t;
    let s = String(t);
    const nat = String(nationality || '').toLowerCase();
    const isCantonese = (nat==='hk' || nat==='gd' || nat==='canton' || nat==='guangdong' || nat==='hkcanton');
    if(!isCantonese){
      _CANTO_MAP.forEach(function(p){ s = s.split(p[0]).join(p[1]); });
    }
    s = s.replace(/[。.]{2,}/g,'，').replace(/[…⋯]+/g,'，').replace(/[~～]+/g,'');
    s = s.replace(/(欸){2,}/g,'欸').replace(/(啊){2,}/g,'啊');
    s = s.replace(/，{2,}/g,'，').replace(/,{2,}/g,',')
         .replace(/^[，,、\s]+/,'').replace(/[，,、\s]+$/,'').trim();
    return s;
  }

  /**
   * 🆕 合併 AI 回來的 beats 進骨架(純函式)
   *   - 把 shotDesc / dialogue 填進原骨架(保留 zhLabel / seconds / role 給 UI)
   *   - 鎖定台詞逐字蓋回(雙保險)
   *   - 每格跑一次 checkDialogueFit,標出爆秒的(overflow)
   */
  // 🆕 地點防呆清洗器:把 shotDesc 偷渡的地點/家具字自動中性化(避免跟使用者選的場景打架)
  //   只洗地點/家具,保留鏡頭詞(定場遠景/極特寫等)與動作、台詞。
  const _BANNED_PLACES = ['廚房','客廳','臥室','臥房','浴室','廁所','洗手間','辦公室','書房','餐廳','中島','流理台','流理臺','料理台','料理檯','吧台','吧檯','餐桌','書桌','梳妝台','梳妝臺','沙發','茶几','陽台','陽臺','玄關','咖啡廳','咖啡店','店裡','店內','房間','櫥櫃','廚櫃','洗手台','洗手臺'];
  function sanitizeShotDesc(t){
    if(!t) return t;
    let s = String(t);
    const B = '(' + _BANNED_PLACES.join('|') + ')';
    s = s.replace(new RegExp('站在\\s*'+B+'\\s*(的)?\\s*(旁邊|邊|旁|前方|前)?','g'),'站著');
    s = s.replace(new RegExp('坐在\\s*'+B+'\\s*(的)?\\s*(旁邊|邊|旁|前方|前)?','g'),'坐著');
    s = s.replace(new RegExp('(靠在|倚在|趴在)\\s*'+B+'\\s*(的)?\\s*(旁邊|邊|旁|前方|前|上)?','g'),'$1一旁');
    s = s.replace(new RegExp('(走向|走進|走到|走去|走回)\\s*'+B,'g'),'轉身');
    s = s.replace(new RegExp('在\\s*'+B+'\\s*(的)?\\s*(裡|內|中|上|旁|邊)?','g'),'');
    s = s.replace(new RegExp(B,'g'),'');
    s = s.replace(/，\s*，+/g,'，').replace(/,\s*,+/g,',')
         .replace(/^[，,、。\s]+/,'')
         .replace(/，(的)/g,'，')
         .trim();
    return s;
  }
  function mergeExpandResult(skeleton, llmBeats, lockedLines = [], nationality = '') {
    const lockMap = {};
    (lockedLines || []).forEach(l => {
      if (l && l.index != null && l.text) lockMap[l.index] = String(l.text);
    });
    const llmMap = {};
    (llmBeats || []).forEach(b => { if (b && b.index != null) llmMap[b.index] = b; });

    return skeleton.map(s => {
      const got = llmMap[s.index] || {};
      const locked = lockMap[s.index];
      let dialogue = locked || got.dialogue || '';
      if (!locked) dialogue = speechFriendly(dialogue, nationality);
      const fit = checkDialogueFit(dialogue, s.seconds);
      return {
        ...s,
        shotDesc: sanitizeShotDesc(got.shotDesc || s.shotDesc || ''),
        angle: got.angle || s.angle || 'front',   // 🆕 AI 導演選的鏡位,帶進 beat
        dialogue,
        dialogueLocked: !!locked,
        fit,
        overflow: !fit.fits,
      };
    });
  }

  /**
   * 把一個填好的 beat 轉成現有 pipeline 吃的 episode 設定
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
    if (false && arc.productHint) arcParts.push('subtle product emphasis: ' + arc.productHint);
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
   * 多鏡頭故事拆分 — v5.13 起委派 planBeats(原本回 null、無人呼叫)
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
    buildExpandRequest,
    mergeExpandResult,
    beatToEpisode,
    BEAT_ROLES,
    DURATION_TEMPLATES,
  };

  if (window.CrewDirector?.register) {
    window.CrewDirector.register('storywriter', window.KolStorywriter);
  }

  console.log('[KolStorywriter] 📖 v5.16 就緒(語速4.2實測校準 · 分鏡 + AI 編修前端)');
})();
