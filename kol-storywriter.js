// ⚠️⚠️ 這個檔案的正確檔名是:kol-storywriter.js  (編劇 KolStorywriter)  ⚠️⚠️
// 上傳前請核對檔名 —— 2026-08-23 曾發生兩檔互相覆蓋
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
  //  🗣 2026-09-13 v5.20:SPEAK_RATE 4.2 → 6.0(治「每段最後都在發呆」)
  //  ★ 病史:3.5 → 4.2 也是為了治「尾段空窗 7 秒」,結果今天實測【還是空 7-9 秒】。
  //    同一個病治兩次沒治好,因為【量錯對象】——
  //    4.5 是量「欣怡真人講話」,但影片裡發聲的是引擎 TTS,速度完全不同。
  //  ★ 2026-09-13 實測(45 秒三段,對照分鏡卡實際字數):
  //      段1  39 字 / 講 7.7 秒 = 5.0 字/秒 · 發呆 7.3 秒
  //      段2  43 字 / 講 5.8 秒 = 7.4 字/秒 · 發呆 9.2 秒
  //      段3  45 字 / 講 6.7 秒 = 6.7 字/秒 · 發呆 8.3 秒
  //    平均 6.4 字/秒 —— 系統用 4.2,【低估了 50%】,所以每段都配不夠台詞。
  //  ★ 取 6.0 而非 6.4:引擎語速有變異(5.0-7.4),取略保守值,
  //    讓甜蜜區(0.80)在【最慢的 5.0 字/秒】下仍塞得進去:
  //      15 秒 × 0.80 × 6.0 = 72 字 → 最慢情況 72/5.0 = 14.4 秒 < 15 秒 ✅
  //  ⚠️ 這個數字要再量:目前只有一支片三段的樣本,不同 KOL 語速設定可能不同。
  //  🗣 2026-09-13:曾試算 9.0(實測語速確實是 9.0-9.7 字/秒),但 RA 決定【維持 6.0】——
  //    9.0 換算 15 秒要寫 108 字,密度過高會變連珠砲,失去自然的說話節奏。
  //    RA 判斷:寧可尾巴留幾秒安靜,也不要講到喘不過氣。
  //    ⚠️ 所以「發呆 3-4 秒」是【刻意保留的呼吸】,不是待修的 bug,後人不要再自作主張調高。
  const SPEAK_RATE = 6.0;

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
  //  📏 2026-09-13 v5.19:把「建議值」與「硬擋線」統一成同一組常數。
  //  ★ 病(RA 2026-09-13 實測):
  //    建議值 = seconds × 0.95 × 4.2 → 15 秒建議 60 字
  //    硬擋線 = estSec ≤ seconds × 0.90 → 15 秒 57 字就擋
  //    【建議值比硬擋線還高 3 字】—— 照著建議寫必定被紅字擋下,按不了確認。
  //    而 Worker 第 12 條規定「15 秒寫 58-62 字」,整個區間全部被前端擋掉。
  //    所以 AI 每次只能寫 42-48 字 —— 不是它不聽話,是寫對了送不出去。
  //  ★ 甜蜜區用實測定,不用猜:
  //    鞋店那支有聲佔比 67%(RA 評 100 分);咖啡段1 講滿 100%(RA 評「像唸稿」)。
  //    → 目標 SWEET(0.80),上限 MAX(0.92,真的塞不下才擋)。
  //  ★ 兩個值都從這裡出,前端建議與硬擋不可能再打架。
  const FIT_SWEET = 0.80;   // 建議目標:15 秒 → 50 字(講 12 秒,留 3 秒呼吸)
  const FIT_MAX   = 0.92;   // 硬擋上限:15 秒 → 57 字

  function checkDialogueFit(text, beatSeconds = SECONDS_PER_BEAT) {
    const chars = (text || '').replace(/\s/g, '').length;
    const estSec = +(chars / SPEAK_RATE).toFixed(1);
    return {
      chars, estSec,
      fits: estSec <= beatSeconds * FIT_MAX,
      sweetChars: Math.round(beatSeconds * FIT_SWEET * SPEAK_RATE),
      maxChars: Math.round(beatSeconds * FIT_MAX * SPEAK_RATE),
    };
  }

  /**
   * 🆕 打包 AI 編修請求 → 給 api('storyboard_expand') 用的 payload(純函式)
   * @param {object} inputs - { duration, outline, lockedLines, persona, product, sceneLabel }
   */
  function buildExpandRequest({
    duration, outline, lockedLines,
    persona = {}, product = {}, sceneLabel = '',
    recentEpisodes = [],   // 🧠 2026-08-23 劇情記憶
  }) {
    const joinList = (v) => Array.isArray(v) ? v.join('、') : (v || '');

    // ⚖️ 2026-08-19 合規守門:把行業禁詞併進去。
    //   影片比靜態圖危險 —— 靜態圖的字由版型控制,KOL 講的台詞是 AI 自己寫的。
    //   2026-05 南投判例:用 AI 生成水晶手鍊文案宣稱「緩解心臟病、預防高血壓」,
    //   依藥事法罰 60 萬(業者辯稱不知違法照罰)。KOL 台詞是同一個模式。
    //   ★ 沿用既有的 kolTabooWords 欄位,不用改 Worker、不用改架構。
    //   ★ 查不到行業 → 回空字串 → 舊商品行為完全不變。
    let _compTaboo = '', _compBrief = '';
    try {
      if (window.KolCompliance) {
        _compTaboo = window.KolCompliance.tabooFor(product) || '';
        _compBrief = window.KolCompliance.briefFor(product) || '';
      }
    } catch (e) {}
    const _taboo = [joinList(persona.taboo_words), _compTaboo].filter(Boolean).join('、');

    // ═══════════════════════════════════════════════════════════
    //  🧠 2026-08-23 劇情記憶:讓 KOL 讀自己的日記
    //   現況(本次修正前):每一集都存進 KOL_Episodes,月曆與記憶列表都讀得到,
    //     但【生下一集時完全沒有人把它餵回去】—— KOL 有日記卻不會翻開來看。
    //   ★ 只送「主題 + 故事框 + 情緒」三個欄位的極短摘要,最多 6 集。
    //     絕不整包丟:episodes 一列有 31 欄(含 prompt_final、reference_images_json),
    //     整包塞進去會把 token 吃光,而且對「別重複」這件事一點幫助也沒有。
    //   ★ 空陣列 → 完全不送這個欄位 → 舊行為一字不變。
    // ═══════════════════════════════════════════════════════════
    let _memo = '';
    try {
      const eps = Array.isArray(recentEpisodes) ? recentEpisodes : [];
      // 🩹 2026-08-23 二修:欄位挑錯了。
      //   實測(米禾 8/03 那集)發現:
      //     calendar_topic → 只有從月曆格子點進來才會填,平常是空的(畫面顯示「主題:-」)
      //     emotion        → 情緒基調下拉預設「不指定」,也是空的
      //     story_frame    → 只有場景名(「廚房晨光」)
      //   → 舊寫法組出來只剩四個字的場景名,那不是記憶,是場景。
      //     AI 只知道「上次在廚房」,不知道上次演了什麼 → 照樣重複橋段。
      //   ★ 真正裝著劇情的是 scenario(每集必填,就是那一集的故事情境)。
      //     現在以它為主,前面掛日期/商品/場景當索引。
      const lines = eps.slice(0, 6).map(function (ep) {
        if (!ep) return '';
        const d = String(ep.calendar_date || '').slice(5, 10).replace('-', '/');   // 2026-08-03 → 08/03
        const t = String(ep.calendar_topic || ep.topic || '').trim();
        const pd = String(ep.product_name || '').trim();
        const f = String(ep.story_frame || '').trim().slice(0, 20);
        const m = String(ep.emotion || '').trim();
        // 故事本體:去掉換行、砍到 70 字(6 集 × 約 90 字 ≈ 540 字,遠低於 Worker 端 1200 上限)
        const sc = String(ep.scenario || '').replace(/\s+/g, ' ').trim().slice(0, 70);
        const head = [d, t, pd, f, m].filter(Boolean).join(' · ');
        if (!head && !sc) return '';
        return '・' + head + (sc ? ' — ' + sc : '');
      }).filter(Boolean);
      if (lines.length) _memo = lines.join('\n');
    } catch (e) {}

    //  📏 2026-09-13 v5.21 字數規格同步(治「前端建議 72,AI 只寫 50」)
    //  ★ 病(RA 2026-09-13 實測):前端建議值改成 72 字後,AI 還是只寫 50-53 字。
    //    因為 AI 看的是 Worker 第 12 條寫死的「15 秒 58-62 字」,
    //    而那個數字是用【舊語速 4.2】算的 —— 前端改了、Worker 沒改,兩邊規格不一致。
    //    實測語速是 6.0,58-62 字只講 10 秒,15 秒的片必定發呆 5 秒。
    //  ★ 修法:不改 Worker(手上那份是舊的,改下去會洗掉別人的規則),
    //    改走 outline 這條現成通道 —— 合規禁詞(_compBrief)早就是這樣做的,
    //    註解明寫「不用改 Worker、不用改架構」。字數規格用同一條路帶過去。
    //  ★ 規格由同一組常數算出:FIT_SWEET / FIT_MAX / SPEAK_RATE,
    //    所以前端顯示、前端硬擋、AI 被要求的字數,三者永遠同步。
    const _beatPlan = planBeats(duration);
    const _specLines = (Array.isArray(_beatPlan) ? _beatPlan : [])
      .map(function (b) {
        const sec = (b && (b.seconds || b.durationSec)) || 15;
        return sec + ' 秒的段落寫 ' + Math.round(sec * FIT_SWEET * SPEAK_RATE)
          + '-' + Math.round(sec * FIT_MAX * SPEAK_RATE) + ' 字';
      });
    const _uniqSpec = _specLines.filter(function (x, i, a) { return a.indexOf(x) === i; });
    const _charSpec = _uniqSpec.length
      ? ('\n\n【台詞字數規格 · 必須遵守】每一段的台詞字數:' + _uniqSpec.join('、')
         + '。這是依實測語速 ' + SPEAK_RATE + ' 字/秒換算的 —— 字數不足的話,'
         + '影片後段會出現好幾秒沒有人說話的空白,畫面會變成乾等。'
         + '寧可把事情講得更具體、多給一個細節,也不要讓段落講不滿。')
      : '';

    return {
      recentEpisodes: _memo,   // 🧠 純文字摘要,Worker 端直接貼進提示詞
      durationSec: duration,
      beats: _beatPlan,
      outline: (outline || '') + _compBrief + _charSpec,
      lockedLines: Array.isArray(lockedLines) ? lockedLines : [],
      kolName: persona.persona_name || persona.name || '',
      kolBackground: persona.background || '',
      kolPersonality: persona.personality || '',
      kolSpeakingStyle: persona.speaking_style || '',
      kolNationality: persona.nationality || 'tw',
      kolCatchphrases: joinList(persona.catchphrases),
      kolTabooWords: _taboo,   // ⚖️ 人設禁語 + 行業合規禁詞
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
  // ══════════════════════════════════════════════════════════════════
  //  🔁 2026-09-11 · 接棒句中性化(RA 現場抓到:後半段又轉了一圈)
  //  ────────────────────────────────────────────────────────────────
  //  ★ 病:AI 分鏡很愛在鏡頭描述裡回頭指涉上一段的動作 ——
  //      「她順著【剛才的旋轉】慣性停下來,雙手垂在身側微微喘氣」
  //    人類讀得懂那是「前一刻的殘留狀態」,模型讀不懂:
  //    它只看到「旋轉」這個動作詞,然後【再轉一次】。
  //    Beat 2 明明要她停下來喘氣,結果又轉了一圈。
  //
  //  ★ 這不是新病:kol-stitch.js:1070 的 v7.1 就為了同樣的理由
  //    關掉系統自動接棒(「she has just …」被當成要演的動作 → 連開好幾次箱)。
  //    系統那條關掉了,但【AI 分鏡自己在寫接棒句】—— 換個地方又長出來。
  //
  //  ★ 只洗鏡頭描述,【台詞一個字都不動】:
  //    台詞裡的「剛剛轉三圈」是她在講話,是對的內容,改掉反而錯。
  //  ★ 做法是把回指詞拿掉、保留身體狀態:
  //      「順著剛才的旋轉慣性停下來」→「慣性停下來」
  //    留住「慣性」這種殘留感的字,只砍掉會被當指令的動作詞。
  // ══════════════════════════════════════════════════════════════════
  //   回指詞:剛才/剛剛/方才/前一秒/上一個鏡頭…… 後面常接動作名詞
  const _CARRY_REF = '(剛才|剛剛|方才|前一刻|前一秒|上一段|上一個鏡頭|前面)';
  function sanitizeCarryOver(t){
    if(!t) return t;
    let s = String(t);
    //  ①「順著剛才的旋轉慣性停下來」→「慣性停下來」
    s = s.replace(new RegExp('(順著|接著|延續|承接)\\s*' + _CARRY_REF + '\\s*(的)?\\s*[\\u4e00-\\u9fa5]{1,6}?(慣性|餘勢|動作|節奏)','g'),'$4');
    //  ②「順著剛才的旋轉停下來」(沒有慣性兩字)→「停下來」
    s = s.replace(new RegExp('(順著|接著|延續|承接)\\s*' + _CARRY_REF + '\\s*(的)?\\s*[\\u4e00-\\u9fa5]{1,6}?(?=停|站|坐|靠|垂|收)','g'),'');
    //  ③ 單純的回指:「剛才的旋轉」「剛剛的動作」→ 整段拿掉
    s = s.replace(new RegExp(_CARRY_REF + '\\s*(的)?\\s*[\\u4e00-\\u9fa5]{1,4}(之後|後)?','g'),'');
    //  ④ 收尾標點
    s = s.replace(/，\s*，+/g,'，').replace(/,\s*,+/g,',')
         .replace(/^[，,、。\s]+/,'')
         .trim();
    return s;
  }

  function sanitizeShotDesc(t){
    if(!t) return t;
    let s = sanitizeCarryOver(String(t));
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

  console.log('[KolStorywriter] 📖 v5.21 就緒 · 📏字數規格同步前端↔AI(走 outline 通道·治「建議72字·AI只寫50」) · 🔁接棒句中性化 ·(語速6.0實測校準 · 分鏡 + AI 編修前端 · 🧠劇情記憶摘要最多6集·以scenario為主)');
})();
