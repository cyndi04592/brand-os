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
    // v5.13: 優先讀人設書 appearance 欄位,讀不到才退回猜名字(往下相容)
    if (ctx.portraitMode === 'natural') {
      const appearance = resolveAppearance(p);
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
   * v5.13: 決定外貌描述的來源(優先順序)
   *   1. 人設書 appearance 欄位(GAS 表新欄位,最理想)
   *   2. background 欄位裡若含外貌關鍵字,直接拿來用
   *   3. 都沒有 → 退回 guessAppearance 猜名字(舊行為,往下相容)
   * @param {Object} p - persona 資料
   * @returns {string} 'appearance: ...' 片段
   */
  function resolveAppearance(p) {
    if (!p) return '';

    // 1. 明確的 appearance 欄位(最優先,你在人設書填什麼就生什麼)
    if (p.appearance && String(p.appearance).trim()) {
      const a = String(p.appearance).trim();
      // 若使用者已自帶 "appearance:" 前綴就不重複加
      return a.toLowerCase().startsWith('appearance')
        ? a
        : 'appearance: ' + a;
    }

    // 2. 沒有 appearance 欄位時,才退回猜名字(舊 KOL 不受影響)
    if (p.persona_name) {
      return guessAppearance(p.persona_name);
    }

    return '';
  }

  /**
   * 依 persona_name 猜外貌(natural mode 用 · fallback)
   * 註:這是「沒填 appearance 欄位」時的備援,優先請用人設書 appearance 欄位
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
    resolveAppearance,
    guessAppearance,
    isComplete,
    completeness,
  };

  if (window.CrewDirector?.register) {
    window.CrewDirector.register('persona', window.KolPersona);
  }

  console.log('[KolPersona] 🎭 v5.12 就緒');
})();
