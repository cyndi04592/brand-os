// ════════════════════════════════════════════════════════════════════
//  kol-persona.js · v5.15
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
//     forbidden_topics / voice_style)
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

    // 🆕 v5.14:聲音特質(voice_style)—— 一定放在【最後】。
    //   ★ 詞序黃金律:錨點在前、抽象風格濾鏡在尾。
    //   ⚠️ 絕不能靠近 accent。speechLine 裡的
    //      「speaks in natural Taiwanese Mandarin」是口音錨點,
    //      兩個相鄰的聲音描述會互相競爭、稀釋錨點權重 ——
    //      那是「又晴變中國腔」事故的軟性版本(沒刪除,但削弱)。
    //      所以聲音特質只在這裡出現一次,而且擺在整串的最尾端。
    //   voice_style 的內容只寫語速 / 音高 / 力度 / 情緒,
    //   前端已保證不含任何地區或國家字眼。
    if (p.voice_style) parts.push('voice quality: ' + p.voice_style);

    // 🆕 v5.15:年齡聲線。擺在 voice_style 之後、整串最尾端。
    //   為什麼不加 DB 欄位:AI 寫的 background 開頭一定帶年齡
    //   (「陳建達,42歲,台中人」「昱瑄,27歲,台北信義區」),
    //   直接抽即可 —— 不動 D1、不動 Worker、不動 UI,一個檔案解決。
    //   抽不到就完全不輸出,維持舊行為(讓模型看參考照自行判斷)。
    //
    //   為什麼需要它:speechLine 只吃 pronoun + accent,年齡從來沒進過聲音那條線。
    //   結果是童聲/老成全靠參考照的長相碰運氣,客戶沒有任何開關。
    //
    //   ⚠️ 只寫【聲線的年齡感】,不重複描述外貌(外貌已由 resolveAppearance 負責),
    //      也絕不含任何地區或國家字眼 —— 口音由 natToAccent 單獨鎖定。
    const ageVoice = resolveAgeVoice(p);
    if (ageVoice) parts.push(ageVoice);

    // 🎙 v5.13:聲音指紋。擺在整串最尾端(詞序黃金律:抽象風格在後),
    //   而且【只在客戶沒自己設 voice_style 時】才補 —— 客戶說了算。
    const vFinger = resolveVoiceFingerprint(p);
    if (vFinger) parts.push(vFinger);

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
  /**
   * v5.15:從 persona 推出「聲線的年齡感」描述
   * @param {Object} p - persona 資料
   * @returns {string} 'voice age: ...' 片段,推不出來則回空字串
   */
  // ═══════════════════════════════════════════════════════════════
  //  🎙 v5.13(2026-08-23)聲音指紋 —— 讓每位 KOL 的聲音自動不一樣
  //
  //  【為什麼要有】RA 現場聽出來的:「女生聽起來都好像同一個人」。
  //    追下去發現送給引擎的聲音描述【逐字相同】——
  //      ・年齡聲線:20-34 歲共用一句(又晴31/米禾29/昱瑄27 全中)
  //      ・四軸(語速/音高/力度/情緒)客戶不會去動,全是預設值
  //    描述一樣,引擎照著生,當然像同一個人。
  //
  //  【設計原則·三層優先序】
  //    ① 客戶手動調的 voice_style  → 最高,原樣照送,這裡完全不介入
  //    ② 人設決定的方向(年齡/性別/個性) → 該是童聲就童聲,不會亂配
  //    ③ 人設沒講到的 → 用 persona_id 算出固定一組,讓同條件的人彼此分散
  //
  //  【為什麼「用 id 算」不是「隨機」】
  //    隨機 = 同一位 KOL 每一集聲音都變 —— 那是災難,比撞聲更糟。
  //    用 id 算 = 同一人永遠同一組(跨集穩定)、不同人一定不同組。
  //
  //  【守住的線】
  //    ・絕不寫任何地區/國家字眼 —— 口音由 natToAccent 單獨鎖定(又晴變中國腔的教訓)
  //    ・絕不描述外貌 —— 那是 resolveAppearance 的職責
  //    ・字數壓在 ~70 字內 —— 1700 牆很緊(實測 1604/1655)
  // ═══════════════════════════════════════════════════════════════
  function _vHash(str) {
    let h = 0;
    const t = String(str || 'x');
    for (let i = 0; i < t.length; i++) { h = ((h << 5) - h + t.charCodeAt(i)) | 0; }
    return Math.abs(h);
  }

  function resolveVoiceFingerprint(p) {
    if (!p) return '';
    // ① 客戶已經自己設過 voice_style → 完全不介入(他說了算)
    if (p.voice_style && String(p.voice_style).trim()) return '';

    // 取年齡(同 resolveAgeVoice 的來源)
    let n = parseInt(p.age, 10);
    if (!Number.isFinite(n)) {
      const m = String(p.background || '').match(/(\d{1,2})\s*歲/);
      if (m) n = parseInt(m[1], 10);
    }
    const male = /^(m|male|男|man)/i.test(String(p.gender || ''));
    const seed = _vHash(p.persona_id || p.persona_name || p.name || 'kol');

    // ② 人設先決定「可用的音色範圍」——
    //    小孩絕不可能配到沙啞低沉,長者也不會配到清脆如鈴。
    let timbres;
    if (Number.isFinite(n) && n <= 12) {
      timbres = ['light and airy', 'bright and clear', 'small and chirpy', 'soft and rounded'];
    } else if (Number.isFinite(n) && n >= 55) {
      timbres = ['warm and chesty', 'slightly grainy', 'soft and rounded', 'quiet and dry'];
    } else if (male) {
      timbres = ['warm and chesty', 'clear and forward', 'slightly husky', 'low and steady',
                 'soft and rounded', 'bright and open', 'slightly grainy', 'even and dry'];
    } else {
      timbres = ['clear and forward', 'light and airy', 'warm and rounded', 'bright and bell-like',
                 'soft and breathy', 'slightly husky', 'smooth and even', 'crisp and thin'];
    }

    // ③ 共鳴:性別給大方向,細節由編號決定
    const res = male
      ? ['chest-forward resonance', 'balanced resonance', 'chest-forward resonance']
      : ['balanced resonance', 'head-forward resonance', 'balanced resonance'];

    // ④ 小癖性:個性有線索就照個性,沒有才用編號
    const per = String(p.personality || '') + String(p.speaking_style || '');
    let quirk;
    if (/古靈精怪|活潑|俏皮|跳|鬼靈精/.test(per))      quirk = 'a small upward lilt at the end of phrases';
    else if (/務實|直接|理性|冷靜|嚴謹|不拐彎/.test(per)) quirk = 'phrase endings settling flat and even';
    else if (/溫柔|療癒|沉穩|慢/.test(per))            quirk = 'a soft breath before longer sentences';
    else quirk = ['a small upward lilt at the end of phrases',
                  'phrase endings settling gently downward',
                  'an even unhurried delivery with little pitch swing',
                  'a soft breath before longer sentences'][seed % 4];

    const t = timbres[seed % timbres.length];
    const r = res[(seed >> 3) % res.length];
    return 'voice character: ' + t + ' timbre, ' + r + ', ' + quirk;
  }

  function resolveAgeVoice(p) {
    if (!p) return '';
    // 來源優先序:明確的 age 欄位(日後若真的加了) → background 裡的「NN 歲」
    let n = parseInt(p.age, 10);
    if (!Number.isFinite(n)) {
      const m = String(p.background || '').match(/(\d{1,2})\s*歲/);
      if (m) n = parseInt(m[1], 10);
    }
    if (!Number.isFinite(n) || n < 1 || n > 99) return '';

    //  🩹 2026-08-23 分段細化 —— 原本「20-34 歲共用一句」是聲音撞臉的主因之一。
    //   實測:又晴 31 / 米禾 29 / 昱瑄 27 三個人全落在同一格,
    //     送給引擎的年齡聲線【逐字相同】,加上四軸都是預設 → 描述整串一樣 → 聲音當然像同一個人。
    //   ★ 20-34 拆成三段、35-49 拆成兩段;其餘維持原樣(童聲/青少年/年長本來就分得開)。
    let v;
    if (n <= 6)       v = 'a small child voice, very light and high, unpolished, with clear childish diction';
    else if (n <= 12) v = 'a young child voice, light and small in timbre, unpolished and natural';
    else if (n <= 19) v = 'a teenage voice, bright and thin in timbre, still youthful and unsettled';
    else if (n <= 24) v = 'a very young adult voice, bright and light, still carrying a youthful edge';
    else if (n <= 29) v = 'a young adult voice, clear and supple in timbre, easy and unforced';
    else if (n <= 34) v = 'a young adult voice, rounder and a little more settled, still fresh but composed';
    else if (n <= 42) v = 'an early middle-aged voice, fuller in body, assured and comfortable';
    else if (n <= 49) v = 'a middle-aged voice, fuller and steadier in timbre, settled and experienced';
    else if (n <= 64) v = 'a mature voice, slightly weathered in timbre, unhurried and seasoned';
    else              v = 'an elderly voice, thinner and gently rougher in timbre, slower with a soft tremor';
    return 'voice age: ' + v + ' (about ' + n + ' years old)';
  }

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
      'voice_style',   // 🆕 v5.14
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

  console.log('[KolPersona] 🎭 v5.13 就緒 · 🎙聲音指紋(人設優先→編號分散·同人跨集穩定) · 年齡聲線細分 10 段');
})();
