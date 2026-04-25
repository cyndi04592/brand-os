// ════════════════════════════════════════════════════════════════════
//  kol-persona.js · v5.12
//  
//  🎭 KOL 本人 — 角色人設模組
//  
//  職責:
//   • 管理 KOL 的個性、口頭禪、住哪、生活習慣、禁用詞、關心話題
//   • 把 persona 資料轉成 prompt 片段(subject personality / speaking style / topics)
//   • 提供「這句話她會怎麼說」的風格轉換介面
//  
//  資料來源:
//   • GAS kol_personas 表(欄位:background / personality / speaking_style /
//     role_relationship / catchphrases / taboo_words / signature_topics /
//     forbidden_topics)
//  
//  v5.12 狀態:骨架版 — contribute() 已定義,尚未接通到 composePrompt
//  下一版:把 buildEpisodeOverlay 裡的 persona 段落搬進來
// ════════════════════════════════════════════════════════════════════

(function () {
  'use strict';

  /**
   * 產出 KOL 人設的 prompt 片段
   * @param {Object} ctx - 劇組 context
   * @returns {string} prompt 片段
   */
  function contribute(ctx) {
    if (!ctx?.persona) return '';
    const p = ctx.persona;
    const parts = [];

    // 外貌描述(text2video 需要腦補長相)
    if (ctx.portraitMode === 'natural' && p.persona_name) {
      const appearance = guessAppearance(p.persona_name);
      if (appearance) parts.push(appearance);
    }

    if (p.personality) parts.push('subject personality: ' + p.personality);
    if (p.speaking_style) parts.push('speaking style: ' + p.speaking_style);
    if (p.role_relationship) parts.push('character role: ' + p.role_relationship);
    if (p.signature_topics?.length) parts.push('topics she typically cares about: ' + p.signature_topics.join(', '));
    if (p.taboo_words?.length) parts.push('MUST AVOID these words/phrases: ' + p.taboo_words.join(', '));
    if (p.forbidden_topics?.length) parts.push('MUST NOT discuss: ' + p.forbidden_topics.join(', '));

    return parts.join('. ');
  }

  /**
   * 依 persona_name 猜外貌(natural mode 用)
   * 未來接通 KOL 照片 vision API 後可移除
   */
  function guessAppearance(personaName) {
    const name = String(personaName || '').toLowerCase();
    if (name.includes('misaki')) {
      return 'appearance: East Asian woman in late 20s, natural mixed Japanese-Taiwanese features, shoulder-length dark hair, soft approachable face';
    }
    if (name.includes('elaine')) {
      return 'appearance: Taiwanese woman in late 20s, straight shoulder-length dark hair, warm gentle face, natural makeup, authentic girl-next-door aesthetic';
    }
    return 'appearance: East Asian woman in late 20s, natural everyday look, no heavy makeup';
  }

  /**
   * 檢查 persona 人設書是否完整
   */
  function isComplete(persona) {
    if (!persona) return false;
    return !!(persona.background && persona.personality && persona.speaking_style);
  }

  /**
   * 取得 persona 完成度百分比(0-100)
   */
  function completeness(persona) {
    if (!persona) return 0;
    const fields = [
      'background', 'personality', 'speaking_style', 'role_relationship',
      'catchphrases', 'taboo_words', 'signature_topics', 'forbidden_topics',
    ];
    const filled = fields.filter(f => {
      const v = persona[f];
      return Array.isArray(v) ? v.length > 0 : !!v;
    });
    return Math.round(filled.length / fields.length * 100);
  }

  // ─── 導出 + 自動向總導演註冊 ─────────────────────────
  window.KolPersona = {
    contribute,
    guessAppearance,
    isComplete,
    completeness,
  };

  if (window.CrewDirector?.register) {
    window.CrewDirector.register('persona', window.KolPersona);
  }

  console.log('[KolPersona] 🎭 v5.12 就緒');
})();
