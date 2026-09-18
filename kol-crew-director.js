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

  //  ═══════════════════════════════════════════════════════════════
  //  🗣 v5.36(2026-09-14)台詞【直接傳】,不再從文字裡用正則猜回來
  //   病灶(RA 現場指出):台詞本來是分鏡卡上的獨立欄位,
  //     kol.html 卻先把它併成「shotDesc + 『台詞』」一整串,
  //     這裡再用全域正則把每一組「」掃出來當台詞 —— 結構化資料先壓成文字、再猜回去。
  //     後果一:鏡頭欄裡【任何】一組引號都會被她唸出來。
  //       實測 2026-09-14:AI 在鏡頭欄寫了朋友的問句「欸妳那件是…」,
  //       她就真的把朋友那句也念了一遍。客戶自己在鏡頭欄打引號同理。
  //     後果二:同一句台詞在 prompt 裡出現兩次(分鏡行 + 對嘴行),白付一次字數。
  //       實測:兩句台詞 118 字 → 實際吃掉約 240 字,直接把 4000 牆的餘裕吃光。
  //   ★ 修法:第三個參數 dialogue 傳進來就【只認它】,一個引號都不掃。
  //   ★ 沒傳 → 完全走舊路(正則掃引號)。kol.html 還沒改之前行為一字不差,
  //     所以這一版可以單獨部署,不會壞。
  //   ⚠️ 同源提醒:kol.html 兩處(STEP2 約 7552 / STEP3 約 11089)把台詞併進 sit,
  //     那兩處改成「不併、改傳第三參數」之後,分鏡行才會真的省下那份字。
  //  ═══════════════════════════════════════════════════════════════
  function parseSituation(raw, persona, dialogue) {
    //  🗣 v5.36:台詞欄直接給了 → 只認這一份,鏡頭欄寫什麼都不會被念出來
    const _dia = String(dialogue == null ? '' : dialogue).trim();
    if (_dia) {
      //  🎙 v5.50(2026-09-17)分鏡 AI 寫的「聲音:…」那句搬到台詞行,鏡頭描述裡拿掉(不重複付字數)
      const _vm = String(raw || '').match(/聲音\s*[::]\s*([^。]*)。?/);
      //   聲音句裡的「」一律拿掉 —— 引號是 Seedance 的台詞觸發符號,留著她會把那兩個字另外念出來
      const _voiceDelivery = _vm ? _vm[1].replace(/[「」『』"“”]/g, '').trim() : '';
      const action0 = String(raw || '').replace(/聲音\s*[::]\s*[^。]*。?/, '').replace(/\s+/g, ' ').trim();
      const pronoun0 = persona?.gender === 'male' ? 'He' : 'She';
      const accent0  = natToAccent(persona?.nationality);
      //  ═══════════════════════════════════════════════════════════════════
      //  🎬 v5.43(2026-09-16)改用 Seedance【原生對白語法】。
      //   RA 2026-09-16 問「引號是不是開始講話的觸發符號」→ 去查官方寫法,是的。
      //   官方分鏡格式(火山/即夢 Seedance 2.0 提示詞指南):
      //     畫面(0-5秒):特寫角色通紅的眼眶,手指死死指著對方…
      //     台詞1(角色A,哽咽怒吼):「你到底想騙我什麼?」
      //   —— ①引號是台詞的觸發 ②括號裡寫【語氣】 ③畫面與台詞【配對出現】
      //      ④超過 8 秒官方建議用【分時段】寫法(0-3秒/3-6秒…)
      //   ★ 我們原本送的是英文描述句,模型讀得懂但不是原生格式,
      //     而且它排在兩百多字動作描述的【後面】—— 模型先演動作、第 3~8 秒才開口,
      //     語音卻從第 0 秒播 → 那幾秒就是旁白(RA 連續實測三支)。
      //   ★ 改法:用原生格式,時間段本身就宣告「這句話從第 0 秒講到最後」,
      //     不必再去管 AI 的中文用詞(對嘴閘可以因此放寬)。
      //  ═══════════════════════════════════════════════════════════════════
      const _sec0  = (typeof window !== 'undefined' && window.__KOL_BEAT_SEC) || 15;
      //  ⏱ v5.44:台詞的時間段優先用 AI 給的 dialogueTime(例如 "5-15"),
      //    沒給就退回整格 0-N。格式只認「數字-數字」,其餘一律當沒給。
      //  ⏱ v5.45(2026-09-16)說話視窗【從 shotDesc 自己抓】,不用另外要 AI 給欄位。
      //   RA 指出台詞也要有時間段。但 AI 寫的分時段裡,那個講話的段落本來就標好了:
      //     「(8-15秒)她一邊把包裝往自己這邊拉,一邊開口,語氣…」
      //   → 掃出含「開口/說/講/聊」的那一段,它的時間範圍就是說話視窗。
      //   ★ 這樣不必叫 AI 多填一個欄位(少一個它會忘記填的東西),
      //     也不必在提示詞裡多寫規則(RA:加秒數會讓字數又被壓縮)。
      //   ★ 呼叫端若有明確傳 dialogueTime 就優先用它;都沒有才退回整格。
      const _dtRaw = (typeof window !== 'undefined' && window.__KOL_DIA_TIME) || '';
      const _dt    = /^\d{1,2}\s*[-–~]\s*\d{1,2}$/.test(_dtRaw)
        ? _dtRaw.replace(/\s/g, '').replace(/[–~]/, '-')
        : (_speakSegOf(action0) || ('0-' + _sec0));
      const _who0  = pronoun0 === 'He' ? '他' : '她';
      //  🎙 v5.50 台詞行的聲音描述 = 【基礎聲線】(人設,每集固定) + 【這一格怎麼講】(分鏡 AI 的「聲音:」)
      //   RA 重大發現:換了好幾個 KOL 講話方式都一樣 ——
      //     舊版台詞行只有「她、語氣」,基礎聲線(聲音指紋/年齡)在接片流程從來沒送出去。
      //   刺蝟星球:情緒形容詞模型不理解,要寫結構(聲線、處境、語速、音量、重音、停頓、尾音、呼吸)。
      //   分鏡 AI 沒寫「聲音:」→ 退回舊的語氣抓取,不會空。
      const _base0 = (typeof window !== 'undefined' && window.KolPersona && typeof window.KolPersona.voiceBaseZh === 'function')
        ? (window.KolPersona.voiceBaseZh(persona) || '') : '';
      const _tone0 = _voiceDelivery || _toneOf(action0);
      //  ✂️ v5.45:砍掉跟 tail 重複的 162 字尾巴。
      //   舊尾巴:「— spoken aloud in … audio only; no subtitles, no captions,
      //            no on-screen text anywhere in the frame. No background music.」
      //   ★ 無字幕 tail 已經有(no subtitles, no captions, no on-screen text, no watermark);
      //     無配樂 AUDIO_REALISM 也有(禁罐頭配樂)。每一格白付 162 字 ——
      //     RA:「我們寫給自己爽的塞進去沒用」。
      //   ★ 留下的只有 tail 沒講的:口音 + 對嘴 + 這是聲音不是字幕。
      const speech0 = '台詞(' + _dt + '秒,' + (_base0 || _who0) + (_tone0 ? ';' + _tone0 : '') + '):「' + _dia + '」'
        + ' — spoken aloud in ' + accent0 + ', accurate lip-sync, audio only.';
      if (typeof window !== 'undefined' && window.KOL_DEBUG === true) {
        console.log('[CrewDirector] 🗣 台詞走【直傳】路徑(' + _dia.length + ' 字)· 鏡頭欄的引號一律不當台詞');
      }
      return { action: action0, speechLine: speech0 };
    }
    return _parseSituationByQuotes(raw, persona);
  }

  //  🎭 v5.43:從動作描述裡撈出【語氣】放進台詞的括號 —— 官方格式:台詞(角色,語氣):「…」
  //    分鏡本來就會寫「語氣是那種剛拆到東西的小興奮」「語氣慢下來、比較篤定」,
  //    把它搬到括號裡,對白的情緒就有了著落,不用另外要求 AI 多寫什麼。
  //    撈不到就留空,格式照樣成立。
  //  ⏱ v5.45:掃出「她開口說話」的那一個時間段 —— 回傳 "8-15",找不到回 ''。
  //    分時段格式:(0-2秒)… (2-5秒)… (8-15秒)她一邊…一邊開口…
  //    有多段含說話動詞時取【最早的那一段】—— 那才是她開始講的時間。
  //  ⏱ v5.46(2026-09-16)改成【第一段開口 → 最後一段還在講】,不再只取第一段。
  //    RA 實測:(0-4秒)一邊說 … (8-15秒)繼續講 → 舊邏輯送出「台詞(0-4秒)」,
  //    算力機只在前 4 秒放語音,後面 11 秒她在講卻沒有聲音。
  //    ⚠️ 與 kol-proxy 的 _winOf、面板的 speakRange/speakWindow 同一套,三邊一起改。
  function _speakSegOf(action) {
    const t = String(action || '');
    const re = /[((]\s*(\d{1,2})\s*[-–~]\s*(\d{1,2})\s*秒?\s*[))]([^((]*)/g;
    let m, a = null, z = null;
    while ((m = re.exec(t)) !== null) {
      //  🗣 v5.52(2026-09-17)「開口處」是袋子的開口,不是她開口說話 —— 排除 開口處/開口部/開口朝…(三邊同步)
      if (/(?<![從自])開口(?![處部朝邊側捏拿取夾伸抽])|說|講|聊|問|答|唸|念/.test(m[3])) {
        const s0 = Number(m[1]), e0 = Number(m[2]);
        if (e0 > s0) { if (a === null || s0 < a) a = s0; if (z === null || e0 > z) z = e0; }
      }
    }
    return (a === null) ? '' : a + '-' + z;
  }

  function _toneOf(action) {
    const m = String(action || '').match(/語氣[是]?([^,,。;;]{2,14})/);
    if (m) return m[1].replace(/^那種/, '').trim();
    const m2 = String(action || '').match(/(笑著說|篤定|興奮|小聲|放鬆|認真|無奈|得意|驚訝|不好意思)/);
    return m2 ? m2[1] : '';
  }

  function _parseSituationByQuotes(raw, persona) {
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
    //  🔧 2026-09-13 v5.35:60 → 95(RA 實測 68 字與 63 字的台詞【整句被忽略】,那兩鏡沒有對嘴指令)
    //  ★ 這個數字不是 PiAPI 的限制,是我們自己的煞車。
    //    v5.30 當時寫 60 是為了「對齊面板」:語速 4.2 × 15 秒 × 0.9 ≒ 56.7,取 60 留餘裕。
    //    今天語速實測校準成 6.0,面板的硬擋線變成 15 × 0.92 × 6.0 = 83 字 ——
    //    面板放行 83,這裡只認 60 → 61-83 字又變成新的死亡地帶,而且【靜默失敗】。
    //  ★ 上次沒爆是因為台詞只有 44-48 字,碰不到 60;今天把字數調對才暴露出來。
    //  ★ 取 95 不取 83:面板算字數會扣空白,這裡的正則不會,留餘裕免得標點把合法台詞擠出去。
    //    真正的煞車在面板端(超過 83 會跳紅字擋確認),這裡只負責【抓得到】。
    //  ⚠️ 同源提醒:面板 FIT_MAX × SPEAK_RATE 一改,這個數字要跟著改。
    const DIALOGUE_MAX = 95;
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
    //  🩳 v5.40:原本 182 字把「從桌面→手上→目的地→手指全程接觸→放下時底部先碰再放手」
  //    一步一步寫成流水帳。機制只有一個:物件移動要連續、接觸要真實。
  'the product never teleports \u2014 it travels visibly and stays in contact with the hand the whole way, and is set down before the fingers release it';

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
    //  💡 v5.37(2026-09-14)「均勻光」拿掉,只留「不要死白熱點」。
    //   ★ 病:這句要求【臉上的光均勻】,正面否定攝影師的
    //     'window light from one side only so one side of her face falls slightly darker, not evenly lit'
    //     —— 一句要有方向、一句要抹平,模型每次挑一邊,所以光差時好時壞。
    //   ★ RA 實測(2026-09-13/14):段1 光差 27-31(有方向)、段2 掉到 0.6-1.8(被抹平),
    //     而且光沒有方向 → 環境的顏色打不到臉上 → 臉上只剩一種顏色 → 粉感/美圖 App 感。
    //     驗收:臉左右光差回到 13-21;膚色色相散布 1.69 → 2.3(鞋店 2.348)。
    //   ★ 同一句話 kol-stitch 已經殺過兩次(v6.53 _leanFront、v6.54 _lookFront),
    //     這裡是第三份 —— RA 鐵律①:同一件事多份,只改一份等於沒改。
    //   ★ 保留的是「不要死白熱點」:那治的是油光/過曝,跟「要不要有方向」無關,兩者不衝突。
    parts.push('no harsh overhead glare and no hot blown-out specular highlights on her skin');
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
  //  💡 v5.37(2026-09-14)「均勻光」拿掉,只留「不要死白熱點」。
  //   ★ 病:這句要求【臉上的光均勻】,正面否定攝影師的
  //   'window light from one side only so one side of her face falls slightly darker, not evenly lit'
  //   —— 一句要有方向、一句要抹平,模型每次挑一邊,所以光差時好時壞。
  //   ★ RA 實測(2026-09-13/14):段1 光差 27-31(有方向)、段2 掉到 0.6-1.8(被抹平),
  //   而且光沒有方向 → 環境的顏色打不到臉上 → 臉上只剩一種顏色 → 粉感/美圖 App 感。
  //   驗收:臉左右光差回到 13-21;膚色色相散布 1.69 → 2.3(鞋店 2.348)。
  //   ★ 同一句話 kol-stitch 已經殺過兩次(v6.53 _leanFront、v6.54 _lookFront),
  //   這裡是第三份 —— RA 鐵律①:同一件事多份,只改一份等於沒改。
  //   ★ 保留的是「不要死白熱點」:那治的是油光/過曝,跟「要不要有方向」無關,兩者不衝突。
  front.push('no harsh overhead glare and no hot blown-out specular highlights on her skin');
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

  //  ═══════════════════════════════════════════════════════════════
  //  2️⃣ v5.39(2026-09-15)內衣安全鎖【拿掉】—— 它跟商品本身打架,而且是純禁令。
  //   舊句:'she is fully dressed in everyday outerwear, modest and tasteful,
  //         no exposed undergarments, no revealing clothing'(113 字)
  //   ★ 病灶一(打架):商品【就是內衣】。這句說「不准露出內衣」,
  //     而道具師那邊又要求商品要被看見 —— 模型要同時滿足兩邊,
  //     只能把商品當成外衣直接穿在最外層。RA 實測:內衣穿在外面、
  //     或跟外層融合成一件,連續多支都這樣。
  //   ★ 病灶二(點名即召喚):兩個 no(no exposed undergarments / no revealing
  //     clothing)把「露出內衣」「暴露」這兩個畫面直接餵給模型。RA 鐵律。
  //   ★ 替代方案已經存在,而且更精確:kol-product v5.35 的
  //     'she is wearing it underneath the outfit shown in the outfit reference
  //      image, which stays on her throughout'
  //     —— 正面陳述、指向服裝參考圖、外層全程在身上,同樣擋住風險,
  //     而且不跟商品衝突。合規由那一句負責,這裡不再疊第二份。
  //   ⚠️ 不要因為「怕出事」就把舊句加回來 —— 兩份規則各講各的,
  //     結果是模型兩邊都不照做。要調整就調 kol-product 那一句。
  //  ═══════════════════════════════════════════════════════════════

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
  //  🚚 v5.37 🌬背景生活改從場所推導(蒸氣/熱氣/光斑/風扇/店員·不再寫死人與車·車明確在玻璃外) · v5.36 🚶背景生活赦免(桌椅照鎖·人與車不受跨段一致性鎖管·治「早期有路人現在沒有」) · v5.35 🔇動作描述去引號(治鏡頭欄被念出來) · v5.34 壓縮成關鍵詞串，意思不變。
  //  🪑 2026-09-12 v5.36:管轄範圍限定,強度不變。
  //     舊寫法 'same objects' 太寬 —— 它把「桌椅吧檯」和「窗外的車」
  //     劃進同一個籃子,模型只好全部鎖死,活的東西一起陪葬。
  //     ★ 桌椅一顆都不准動,這點一個字不放鬆;只是不再連「人與車」一起管。
  //  ✂️ v5.40(2026-09-15)空間一致:八個詞 → 一句。
  //   舊句列了 furniture / fixtures / structures / materials / surfaces(五種東西)
  //   + same count / same colours / same places(三種一致),八個詞講同一件事。
  //   機制其實只有後半那句:同一個空間,只有機位在動。前半是它的展開,是廢話。
  tail.push('the place stays exactly as it is between shots; one continuous space, only the camera angle changes');

  // ═══════════════════════════════════════════════════════════════
  //  🧍 2026-09-11 · 公共場所要有人(RA 拍板)
  //  ───────────────────────────────────────────────────────────────
  //  ★ 病:咖啡廳、店面、街上空無一人 = 打烊或樣品屋,一眼就假。
  //    RA 給的真實參考照(鞋店/咖啡館)裡都有客人與店員在做自己的事。
  //  ★ 為什麼不是在九宮格加人:九宮格是【空間資產】,參考圖裡有人的話
  //    每一格的人都不一樣,一致性直接崩,而且會跟 KOL 打架。
  //    → 資產保持乾淨,生活由【影片這一層】加上去。
  //  ★ 寫法用【正面描述】,不用否定句:本檔 541 行的教訓
  //    「影片模型對否定句極不敏感,點名即召喚」。所以不是說「不要有人」
  //    或「要有人」,而是寫死他們【長什麼樣、在哪、在幹嘛】:
  //    遠、失焦、背對或側身、做自己的事、不看鏡頭。
  //
  //  ★ 三種情境,判斷順序不能換:
  //    ① 客戶實景照 → 一個人都不加。那條路的鐵律是
  //       「Invent NOTHING that is not in the source photograph」——
  //       憑空生出員工是最嚴重的 invent,客戶會問「這些人是誰」。
  //    ② 公共場所(有選地標,或場景文字含店家/街道字眼)→ 加遠景路人。
  //    ③ 其他(家裡等私人空間)→ 只有她一個人。
  //
  //  ★ 🚫 不加寵物(RA 拍板):寵物【沒有資產】—— 人有人物表、商品有商品照、
  //    場景有九宮格,只有寵物每次都是模型即興:這集橘貓下集賓士貓,
  //    毛長、品種、花色全會變,而且會動、會搶焦點,比路人更難控。
  //    沒有資產的東西就不要讓它進畫面。
  // ═══════════════════════════════════════════════════════════════
  const _hasRealShot = !!String(opts.sceneImageUrl || '').trim();
  if (!_hasRealShot) {
    const _envTxt = String((ctx.scene && (ctx.scene.setting || ctx.scene.env_prompt)) || '').toLowerCase();
    const _hasLandmark = !!(ctx.locationId && ctx.locationId !== 'none');
    //  ⚠️ 私人字眼【優先判定】,而且要先擋假陽性:
    //     「living room with a coffee table」含 coffee → 會被誤判成咖啡廳,
    //     結果客戶家裡憑空冒出路人。先把家具名裡的陷阱字消掉再比對。
    //  🏷 v5.37:抓一個場所名詞當推導錨點(cafe / gym / bakery…),
    //     讓「這裡會有什麼在動」有依據,而不是套咖啡廳的答案。
    const _envNoun = (_envTxt.match(/(cafe|caf\u00e9|coffee shop|bakery|restaurant|diner|bar|salon|gym|clinic|office|lobby|bookstore|market|supermarket|shop|store)/) || [])[0] || '';
    const _envSafe = _envTxt
      .replace(/coffee\s*table/g, ' ')      // 茶几不是咖啡廳
      .replace(/bar\s*stool/g, ' ')         // 吧檯椅不是酒吧
      .replace(/kitchen\s*island/g, ' ');   // 中島不是店面
    const _privateWords = /(home|house|apartment|flat|bedroom|living room|kitchen|bathroom|balcony|study|dorm|indoor.{0,12}home)/;
    const _publicWords = /(cafe|caf\u00e9|coffee shop|coffee bar|shop|store|market|supermarket|mall|restaurant|diner|street|sidewalk|plaza|station|salon|gym|clinic|office|lobby|bookstore|bakery|arcade)/;
    if (_privateWords.test(_envSafe)) {
      tail.push('she is the only person in frame throughout');
    } else if (_hasLandmark || _publicWords.test(_envSafe)) {
      //  🚚 2026-09-12 v5.34：403 字 → ~150 字。本條一直是 tail 裡最肥的，
      //     而 fitRules 是「放不下的整條跳過」—— 最肥的第一個死。
      //     對照組：私人空間版只有 42 字，永遠活著；公共版 403 字，永遠被丟。
      //     → 這就是 RA 2026-09-12 實拍咖啡廳【零個路人】的結構性原因。
      //  ★ 寫法改關鍵詞逗號串（刺茑星球規格：不寫完整句、不堆形容詞），
      //     意思一字不減：遠、失焦、背對或側身、做自己的事、不看鏡頭。
      //  🚶 v5.36:補上【他們會動】的許可。
      //     RA 2026-09-12 指出早期影片咖啡廳有客人、窗外有車經過,現在沒有了。
      //     病因不是這條規則不夠用力,是它在跟三條規則對打而且必輸:
      //       ① 九宮格參考圖本身是空的(nobody in frame)—— 而且這是對的,
      //          資產保持乾淨、生活由影片層加,見本檔 472 行。
      //       ② [SCENE_IMG] 標註叫模型照抄 layout/structures/materials。
      //       ③ 跨段一致性鎖叫它「only the camera angle changes」。
      //     一個會走路的客人、一台開過去的車,本身就是「變了」——
      //     而鎖那邊有一張真的圖當依據,路人這邊只有文字。資產永遠贏過提示詞。
      //     ★ 所以要明講【這些是唯一允許變動的東西】,把它從鎖裡赦免出來。
      //  🌬 v5.37 RA 修正:v5.36 把背景生活寫死成「人和車」——
      //     ① 車是【窗外】的事,跟人寫在同一句會讓模型以為車開進店裡。
      //     ② 咖啡廳真正會動的遠不止這兩樣:咖啡機的蒸氣、杯口熱氣、
      //        雲飄過造成地上光斑移動、吊燈輕晃、櫃檯後面有人在忙。
      //     ③ 寫死「人和車」等於把它綁在咖啡廳 —— 健身房是風扇與毛巾,
      //        辦公室是螢幕與雲影,夜市是煙與火光。換場景就錯。
      //     ★ 改成【讓模型自己從這個場所推導】,跟九宮格痕跡那條同一個邏輯:
      //       先想清楚這裡會有什麼在動,再讓那些東西動起來。
      //  🌬 2026-09-13 v5.38 RA 修正(承 v5.37 未完成的部分)· 364→319 字,4 條→3 條:
      //   ★ 病① 前半句叫模型「自己推導這個場所會有什麼在動」,
      //     後半句卻塞了一整串【咖啡廳專用範例】(蒸氣/雲影/吧台店員/遠桌客人)。
      //     兩句打架,而且範例比指令具體 —— 模型會照抄範例。
      //     健身房不會有吧台店員,無塵室不會有遠桌客人。
      //   ★ 病② 'outside the glass the street carries on' 寫死了【有對外窗】。
      //     無塵室、地下室、攝影棚、內側包廂全部不成立,
      //     而且它把「背景要活著」綁在窗戶上 —— 沒窗就整條失效。
      //     RA 原話:重點是背景要在運作,例如有人煮東西的煙,跟窗沒關係。
      //   ★ 病③ 'the room stays fixed' 是用文字重做一次九宮格圖已經做好的事。
      //     資產永遠贏過提示詞,這句純屬佔字 —— 而它佔的字正在把
      //     「背景要活著」自己擠出預算(實測 10 條只送出 4 條)。
      //   ★ 修法:只留「自己推導 + 讓它動」,拿掉所有寫死的範例與窗戶假設。
      //     結構鎖交給九宮格圖,這裡只負責【把生活從鎖裡赦免出來】。
      tail.push('work out what actually moves in a working ' + (_envNoun || 'place') + ' and let it move — '
        + 'steam, air, light, machinery, or staff and bystanders busy with their own tasks, small, soft-focus, '
        + 'backs or profiles, never near her or toward the lens; if it opens onto anywhere else, life carries on there too. '
        + 'Only this movement changes between shots');
    } else {
      tail.push('she is the only person in frame throughout');
    }
  }

  // 5️⃣ 道具師其餘子句 —— 形狀鎖、尺寸鎖、接地、正面朝鏡頭…有多少放多少
  pushIfNonEmpty(tail, _prodRest);

  // 6️⃣ 品牌調性 —— RA 拍板:色板/調性可犧牲,排最後
  pushIfNonEmpty(tail, C.brandSoul?.contribute(ctx));

  //  🥇 2026-09-13 v5.39 tail 優先序(RA:根治「永遠砍同一條」)
  //  ★ 病:kol-stitch 的 fitRules 是【從第一條開始塞,塞不下就整條跳過】,
  //    所以 tail 的【推入順序 = 優先級】。而「背景要活著」原本排第 5,
  //    前面吃完才輪到它 —— 實測連兩支片「保留 3/9」「4/10」,
  //    被丟掉的每次都包含這組,等於它從來沒有真正送出去過。
  //  ★ 為什麼不直接把 tail.push 搬到前面:那段用到 _envNoun,
  //    而 _envNoun 宣告在後面的 if 區塊【裡面】—— 搬過去會 ReferenceError,
  //    整支片生不出來(2026-09-13 差點踩到)。
  //  ★ 正解:不動程式碼位置,只在【出口】依關鍵字重排,作用域完全不受影響。
  //  ★ 排序理由:
  //    ① 合規/法律(內衣安全鎖)— 出事成本最高
  //    ② 商品定義(PROP/HERO…)— 沒有它後面的子句失去主詞
  //    ③ 背景要活著 — 唯一防「死背板」的規則,而且最常被砍
  //    ④ 無字幕 — 只有 58 字,CP 值最高
  //    ⑤ 其餘結構鎖 — 九宮格圖已經在扛一部分
  //  ═══════════════════════════════════════════════════════════════
  //  📐 v5.38(2026-09-14)_TAIL_RANK 改依【詞序黃金法則】分類(RA 拍板)
  //   公式:[主體] + [動作/商品互動] + [中段光影/環境] + [末尾抽象風格]
  //   ★ 病(RA 原話):「很像收回扣排到前面但破壞了規則。收回扣的人越多,
  //     後面本該發揮作用的等於沒用。」
  //     舊表排的是【重要性】:合規 → 商品定義 → 背景要活著(環境) → 無字幕(抽象) → 其餘。
  //     結果商品群被環境與抽象切成兩半:PROP 在第 2,而同屬商品的去背邊/形狀鎖
  //     掉到第 5 之後,被稀釋掉一級;抽象的無字幕反而插到商品前面。
  //   ★ 新表排的是【類別】,同類連在一起、不准被別類切開:
  //       ① 商品互動(合規鎖 → 商品定義 → 商品其餘子句)
  //       ② 環境(空間一致 / 背景要活著 / 路人)
  //       ③ 抽象(無字幕 → 品牌調性,墊底只微調氛圍)
  //   ⚠️ 這張表同時是【讓位順序】(不夠字時從後面砍)。改完最先被犧牲的
  //     由「商品其餘子句」變成「無字幕/品牌調性」。現況餘裕 267 不會觸發;
  //     若哪天常態貼牆,無字幕要移到 kol-stitch 的抽象區(front 永遠送),
  //     不是搬回中段插隊 —— 插隊就是收回扣。
  //  ═══════════════════════════════════════════════════════════════
  const _TAIL_RANK = [
    // ── ① 商品互動群 ──────────────────────────────────────────
    /wearing it underneath the outfit shown|which stays on her throughout/i,   // v5.39 合規改由 kol-product 的正面陳述負責,排序位置保留
    /^(PROP|HERO PRODUCT|PRODUCT IN USE|NO PHYSICAL PRODUCT)/i,        // 商品定義
    /cutout of the item itself|white halo|ragged matting edge/i,       // 去背邊(商品)
    /never zoomed or resized|same real-world size|hand-scale/i,        // 尺寸/形狀鎖(商品)
    /which hand and fingers grip|travels visibly in her hand/i,        // 接觸鏈(商品)
    // ── ② 環境群 ────────────────────────────────────────────
    /identical across all shots|one continuous space/i,                // 空間一致
    /work out what actually moves|life carries on there too|Only this movement/i, // 背景要活著
    /only person in frame|background people|out of focus/i,            // 路人
    // ── ③ 抽象群(末尾全局潤色)────────────────────────────────
    /no subtitles|no captions|no on-screen text/i,                     // 無字幕
  ];
  function _tailRank(t) {
    for (let i = 0; i < _TAIL_RANK.length; i++) if (_TAIL_RANK[i].test(t)) return i;
    return _TAIL_RANK.length;                                          // 其餘維持原相對順序
  }
  const _tailSorted = tail.filter(Boolean)
    .map(function (t, i) { return { t: t, r: _tailRank(t), i: i }; })
    .sort(function (a, b) { return (a.r - b.r) || (a.i - b.i); })
    .map(function (x) { return x.t; });

  return { front: front.filter(Boolean).join('. '), tail: _tailSorted.join('. ') };
}

// 每段只放「這一格獨一無二」的靈魂:動作+payoff(原封不動,絕不砍)+ 台詞
// ═══════════════════════════════════════════════════════════════════════════
//  🗣 v5.32 發音易錯字表(_PRON_MAP)· 2026-09-05
//  ─────────────────────────────────────────────────────────────────────────
//  ★ 為什麼要有:Seedance 的聲音是【影片模型自己生的】,不是 TTS ——
//    沒有發音字典、沒有 SSML、沒有注音標記可以下。它只吃文字。
//    所以唯一能控制發音的手段,就是【把字換成不容易念錯的字】。
//    這是官方提示詞指南自己給的方法(把唸錯的詞寫成同音字)。
//  ★ 為什麼放在這裡:composeStitchBeat 是 STEP2 與 STEP3 共同的必經點,
//    而且在送出生成【之前】。原本的 speechFriendly 只在「AI 編修」那一瞬間跑,
//    RA 手改過的台詞、按鎖的台詞【永遠不會跑到】—— 而 RA 每次都手改。
//  ★ 只改引號【裡面】的台詞,動作描述一個字不動(動作描述不會被念出來)。
//  ★ 觀眾看不到文字(全站禁字幕),所以換成同音字沒有任何副作用。
//
//  📌 怎麼維護:踩到一個念錯的就加一行。左邊是原字,右邊是同音替代字。
//     ⚠️ 只放【同音】替換。要換意思的詞(例:鋼圈→鋼絲)請先問客戶,
//        因為那會改到品牌用語,不是發音問題。
// ═══════════════════════════════════════════════════════════════════════════
const _PRON_MAP = [
  ['誇張', '誇章'],   // 實測念成「誇光」
  ['尷尬', '乾尬'],   // 實測念成「阿沙」
  ['緊繃', '緊崩'],   // 實測念成「緊頂」
  ['視覺', '視爵'],   // 實測念成「視館」
  //  👙「無鋼圈」實測念成「無鋼換」。
  //  ⚠️ RA 拍板:【絕對不可以換詞】——「無鋼圈內衣」是消費者聽得懂的產業用語,
  //     換成「無鋼絲內衣」沒人聽得懂,那是砸品牌不是修發音。
  //  ★ 改用「換說法不換詞」:「無鋼圈」是文言縮寫,音節少、容易被吞;
  //    「沒有鋼圈」意思一模一樣、口語、音節完整,模型比較不會抽錯。
  //    消費者聽到的還是「鋼圈」兩個字,品牌用語零損失。
  ['無鋼圈', '沒有鋼圈'],
  //  🗣 v5.41(2026-09-15)「種類」實測念成「種雷」(RA 聽出來的)。
  //    同樣走「換說法不換詞」:「款式」是同義的口語說法,音節清楚,
  //    而且在內衣/服飾這個情境裡比「種類」更自然。
  ['種類', '款式'],
  //  🗣 v5.47(2026-09-16)AI 分鏡寫出罕見字「囤」(本意是「屯貨」的「屯」),模型不會念。錯字修正,不是換詞。
  ['囤', '屯'],
  //  🗣 v5.49(2026-09-17)「韌性」念成「韌書」(RA 聽出來的)。換成意思相近、不會念錯的「彈性」。
  ['韌性', '彈性'],
];

//  🗣 v5.47(2026-09-16)語助詞「啦」後面直接接字 → 念成上揚的「ㄌㄚˊ」(RA 聽出來的:「好啦可以繼續了」)
//   ★ 「啦」在口語裡是句尾收音,本來就該往下落;後面黏著下一個字,模型就把它當句中字、往上揚。
//   ★ 走「換說法不換詞」:字不換,只在「啦」後面補一個逗號,讓它變回句尾 →「好啦,可以繼續了」。
//     後面本來就是標點(啦,/啦。/啦!)或台詞結尾的,一律不動。
//   ⚠️ 還沒實測:下一支聽「啦」有沒有往下落,沒改善就撤掉。
//   「好啦好啦的感覺」這種當形容用的(後面接 的/地/得/好啦)不補。
const _PARTICLE_RE = /(啦)(?=[\u4e00-\u9fff])(?![的地得]|好啦)/g;

//  只清洗引號內的台詞(中文「」『』與英文 " '),動作描述不動
function _pronFix(situation) {
  if (!situation) return situation;
  let hits = [];
  const out = String(situation).replace(/([「『"'])([^「『"'』」]*)([」』"'])/g, function (m, a, body, b) {
    let t = body;
    _PRON_MAP.forEach(function (p) {
      if (t.indexOf(p[0]) > -1) { hits.push(p[0] + '→' + p[1]); t = t.split(p[0]).join(p[1]); }
    });
    if (_PARTICLE_RE.test(t)) { hits.push('啦→啦,'); _PARTICLE_RE.lastIndex = 0; t = t.replace(_PARTICLE_RE, '$1,'); }
    _PARTICLE_RE.lastIndex = 0;
    return a + t + b;
  });
  if (hits.length && typeof window !== 'undefined' && window.KOL_DEBUG === true) {
    console.log('[CrewDirector] 🗣 發音替換 ' + hits.length + ' 處:', hits.join('、'));
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════
//  🔇 2026-09-12 v5.35 動作描述去引號(治「鏡頭欄被念出來」)
//  ─────────────────────────────────────────────────────────────────────────
//  ★ 病(RA 2026-09-12 實拍抓到):分鏡卡鏡頭欄寫
//      「嘴角微微勾起那種『發現一件對的事』的笑」
//    結果影片裡她真的把「發現一件對的事」念了出來,而且還念錯成
//    「發現一對的事」—— 因為那本來就不是給人念的句子。
//  ★ 病因:parseSituation 已經正確把真台詞拆進 speechLine,
//    但鏡頭描述裡【那組引號原封不動留在 action 裡】,兩半又被接回同一段文字。
//    中文引號在影片模型眼裡就是「這是有人在說話」的信號 ——
//    它看到兩組引號,就念兩句。提示詞寫「只念寫好的台詞」擋不住,
//    因為模型認的是符號不是規則。
//  ★ 修法:只拿掉 action 那半的引號【符號】,字一個不刪 ——
//    「發現一件對的事」的笑 → 發現一件對的事的笑
//    語意完全不變,但不再是說話信號。speechLine 一個字不動。
//  ★ 為什麼裝在這裡:composeStitchBeat 是 STEP2 與 STEP3 共同的必經點,
//    而且在送出生成【之前】—— 跟 _PRON_MAP 同一個收口。
//    RA 手改過的鏡頭、按鎖的卡片一樣會經過,不會漏。
//  ★ 不去改 Worker 的分鏡規則叫 AI「不要用引號」:那是靠 AI 自覺,
//    今天已經證明第 8 條(禁「欸」開頭)AI 根本沒遵守。保險絲要在程式碼裡。
// ═══════════════════════════════════════════════════════════════════════════
function _deQuoteAction(t) {
  //  只拿掉成對的引號符號,不動 ASCII 撇號(don't 之類)
  return String(t || '').replace(/[「」『』“”]/g, '');
}

function composeStitchBeat(situation, persona, dialogue, seconds, dialogueTime) {
  //  ═══════════════════════════════════════════════════════════════════
  //  ⏱ v5.44(2026-09-16)【分時段】改由 AI 分鏡自己寫,這裡不再硬加 0-N 秒。
  //   RA 2026-09-16 指正:「(0-15秒) 寫在唯一一顆鏡頭上等於沒寫 ——
  //     分時段的價值是控制【第幾秒發生什麼】」。她要的是這樣:
  //       (0-3秒)中景:她在桌邊坐著…雙手抱著紙箱
  //       (3-5秒)她掀開最上面一層氣泡紙,眉頭微微挑起
  //       (5-15秒)她邊看邊開口,語氣帶著好奇
  //       台詞(5-15秒):「欸,這個我上禮拜訂的…」
  //   ★ 這樣引擎就知道語音從第 5 秒才開始 ——
  //     前 5 秒本來就沒有聲音要對,旁白感從根本消失。
  //   ★ shotDesc 的分時段由 Worker v5.39 的規則叫 AI 寫;
  //     台詞的時間段走新的 dialogueTime 欄(例如 "5-15")。
  //     AI 沒給就退回整格(0-N),行為跟之前一樣。
  //  ═══════════════════════════════════════════════════════════════════
  if (typeof window !== 'undefined') {
    window.__KOL_BEAT_SEC  = Number(seconds) || 15;
    window.__KOL_DIA_TIME  = String(dialogueTime || '').trim();
  }
  //  🗣 v5.36:第三參數 dialogue —— kol.html 改成分開傳之後,
  //     這裡就不會再去掃鏡頭欄的引號(治「她會迸出鏡頭欄裡那句話」)。
  //     沒傳 → 舊行為不變。發音修正 _pronFix 兩條路都要過。
  //  🐛 v5.50(2026-09-17)台詞欄直傳時【沒有引號】,_pronFix 只處理引號裡的字 →
  //    發音表(囤→屯、韌性→彈性、啦後補逗號)對直傳台詞【從來沒生效過】。包一層引號再拆掉。
  const _diaFixed = dialogue ? _pronFix('「' + String(dialogue) + '」').replace(/^「/, '').replace(/」$/, '') : '';
  const { action, speechLine } = parseSituation(_pronFix(situation), persona, _diaFixed);
  const cleanAction = _deQuoteAction(action);
  if (cleanAction !== action && typeof window !== 'undefined' && window.KOL_DEBUG === true) {
    console.log('[CrewDirector] 🔇 動作描述已去引號(防被念出來)');
  }
  //  ═══════════════════════════════════════════════════════════════════
  //  ⏱ v5.42(2026-09-16)【說話排到動作前面】—— RA 想出來的做法。
  //   病灶:送出去的順序是「兩百多字的中文動作描述 → 最後才 She speaks…」。
  //     模型先讀完一大串動作,最後才知道她在說話 —— 所以它先演動作,
  //     第 3~8 秒才開口,而語音從第 0 秒就播,那幾秒聽起來就是旁白。
  //   ★ 之前的解法是去管 AI 的中文用詞(對嘴閘擋「然後說/說到這裡」),
  //     RA 指出那又是在限制 AI。正解是【改我們自己的組裝順序】:
  //     說話先講,動作接在後面當成「她講話的同時在做的事」。
  //     AI 中文怎麼寫都行,送出去的時候說話永遠在最前面。
  //   ★ 這也符合詞序黃金法則:主體與動作排前面,細節排後面。
  //  ═══════════════════════════════════════════════════════════════════
  if (speechLine && cleanAction) {
    //  🔪 現場音那一句要留在最後 —— 它是聲音設計,不是「她講話時在做的事」。
    //    景別(中景/特寫…)要留在最前面 —— 那是鏡頭指令,先講才對。
    //  🎬 v5.43:畫面也用原生格式 —— 官方是【畫面(時間段):… + 台詞(時間段,角色,語氣):「…」】配對出現。
    //    時間段本身就宣告了這一格從第 0 秒開始,所以不必再把台詞硬推到最前面
    //    (v5.42 那招是沒有原生格式時的替代方案,現在由時間段接手)。
    //    現場音留在最後 —— 它是聲音設計,不是畫面內容。
    //  ⏱ v5.44:AI 分鏡【自己已經分好時段】(開頭有 (0-3秒) 這種標記)就照原樣送,
    //    這裡不再硬包一層 0-N —— 那等於把它分好的段落又蓋掉。
    //    只有 AI 沒分段時才補上整格的時間標記,當作最低保障。
    const _sec = (typeof window !== 'undefined' && window.__KOL_BEAT_SEC) || 15;
    const _amb = cleanAction.match(/(現場音[::][^。]*。?)\s*$/);
    const _body = _amb ? cleanAction.slice(0, _amb.index).trim() : cleanAction;
    const _hasSeg = /[((]\s*\d{1,2}\s*[-–~]\s*\d{1,2}\s*秒?\s*[))]/.test(_body);
    return [
      _hasSeg ? _body : ('(0-' + _sec + '秒)' + _body),
      speechLine,
      _amb ? _amb[1] : '',
    ].filter(Boolean).join(' ');
  }
  return [cleanAction, speechLine].filter(Boolean).join('. ');
}
window.composeStitchShared = composeStitchShared;
window.composeStitchBeat   = composeStitchBeat;
  // ════════════════════════════════════════════════════════════════
  //  🆕 無臉模式 prompt 配方 · v5.13-faceless
  //  商品 = 主角([Image1]),不寫臉/妝/衣服/人設。
  //  動作:cooking(做菜手)/ shoes(試穿腳)/ hold(手持展示)
  // ════════════════════════════════════════════════════════════════
  //  🧹 v5.52(2026-09-18)拿掉 premium cinematic commercial quality —— 那是廣告感字眼,
  //    跟有臉那條線一路在殺的同一類(「明亮/HDR/低噪點」「質感」)。
  //  🧴 v5.54(2026-09-18)無臉也要有【真人的皮膚】—— RA 對照兩支後指出:
  //    新版那支腿太完美、太乾淨,像修過圖;有臉那條線早就在治這件事
  //    (kol-cinematographer:「skin carrying its own texture rather than one smooth film,
  //     small imperfections」;廣告圖層:「visible pores, fine hairs, knuckle creases,
  //     slight redness at the joints, faint veins — living skin」)。
  //   ★ 無臉拍的是手、腳、小腿 —— 那些部位本來就有:膚色不均、關節處偏紅、
  //     細小疤痕與痘疤、毛孔、汗毛、靜脈、指節紋路、鞋子壓出來的痕跡。
  //   ★ 寫成正面事實(有什麼),不寫「不要磨皮」那種否定句(點名即召喚);
  //     只保留一句 no beauty filter —— 那是對「修圖」這個動作的直接關閉,實測有效。
  //  🧴 v5.55(2026-09-18)RA 實測第三支:「腳很像男生的腳」。
  //   病:v5.54 那句寫了 faint veins under the skin + darker on the outside of the limb,
  //     模型把這兩樣做過頭 → 小腿肌肉線條明顯、血管浮出來。
  //   ★ 拿掉靜脈與「外側偏深」,保留真正有效的:膚色不均、關節偏紅、毛孔汗毛、舊痕、壓痕。
  //   ★ 另外補一句【這是誰的身體】—— 無臉模式沒有 KOL、沒有人設,
  //     整份 prompt 從來沒說過那雙腿是誰的,模型就自己決定(於是生出男生的腿)。
  //     預設成年女性、日常體型;之後要拍男性商品時由 opts.gender 覆蓋。
  const FACELESS_SKIN = "The visible skin is real human skin: slightly uneven tone, a little redder at the knuckles, ankles and pressure points, visible pores and fine downy hair, small old marks, natural nail shape with the cuticle line showing, and the faint pressure marks a sock or strap leaves — an ordinary person photographed on an ordinary day, no beauty filter.";
  const FACELESS_BODY_F = "The hands, feet and legs in frame belong to one adult woman with an ordinary everyday build — slim natural calves and ankles without pronounced muscle definition, small hands with slender fingers.";
  const FACELESS_BODY_M = "The hands, feet and legs in frame belong to one adult man with an ordinary everyday build.";
  //  🚶 v5.55 走路與站姿:RA 鐵律「動作的發動點在身體,不在四肢」——
  //   這條本來只寫在有臉那條線的分鏡規則裡,無臉完全沒有,所以模型只動腳踝與膝蓋,
  //   上半身沒有重心轉移 → 像木偶在平移(RA:走不自然)。
  //   ★ 畫面只有膝蓋以下,但【動作的來源】要寫出來:骨盆先轉、重心先移,
  //     膝蓋帶著腳跟落地再滾到腳尖,另一腳離地時腳跟先起。
  const FACELESS_WALK = "Any step or shift of stance starts from the pelvis and a transfer of weight — the hip rotates slightly first, the knee leads, the heel lands and rolls through to the toe while the other heel peels off the ground, and the standing leg takes the weight with a small natural sway; even though only the lower legs are in frame, the movement reads as a whole body moving, never as feet sliding on their own.";
  const WALK_ACTIONS = { shoes: 1, matfeet: 1, mop: 1, silhouette: 1 };
  //  ✂️ v5.56(2026-09-18)盤點去重(RA:「照我邏輯精簡化,不失語意」)——
  //   同一件事被講 2-3 次:框線鎖 3 次、不浮空 2 次、接觸陰影 2 次、自然光 2 次(還一個沒方向、
  //   跟單側光打架)、背景虛化 2 次。而皮膚與身體是【主體】的屬性,卻被放在抽象詞群。
  //   ★ 每件事只留一處,放在它該在的群:
  //     主體群 = 鏡位+鎖線+商品+分時段+情境+接觸+身體+皮膚
  //     光影群 = 場景+單側光+接觸陰影+景深(全部在這裡講完一次)
  //     抽象群 = 寫實基底+無聲無字(最短,墊底)
  const FACELESS_REALISM = "Extreme realism, no stylized CGI, no cartoon look, realistic textures, subtle handheld micro-movement. 9:16 vertical.";
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

  // ═══════════════════════════════════════════════════════════════
  //  🎬 v5.52(2026-09-18)無臉模式重構 —— 詞序黃金法則 + 分時段 + 拿掉寫死場地
  //   RA 盤查後定調:「全部一起改,並且維持目前無臉出片的等級」。
  //   ★ 保住品質的錨 = 鏡位那一段(機位高度、距離、只框到什麼、鎖死不上搖)一字不動。
  //     那是無臉片畫面穩定、不會亂跑的原因,動它等於把好東西拆掉。
  //   ★ 改的是三件事:
  //     ① 【詞序】主體詞 → 光影詞 → 抽象詞(跟有臉那條線的 tail 排序同一套法則)
  //        舊版是:鏡位 → 動作 → 情境 → 接觸點 → 寫實 → 無字幕,抽象詞卡在中間。
  //     ② 【分時段】把動作句拆成 2-3 段並標上秒數(0-2秒 / 2-4秒 / 4-5秒)——
  //        有臉那條線靠這個治好旁白感;無臉沒有語音,但分時段一樣能控制
  //        「第幾秒發生什麼」,不會整段都在做同一個動作或急著做完。
  //     ③ 【拿掉寫死場地】clean table / light wood floor / countertop 這類字 ——
  //        同一個動作生 10 支會長得一模一樣,而且 clean 正是樣品屋感的來源。
  //        改成中性的表面描述,場地交給模型照商品與動作自己合理生成。
  //   ★ 順手拿掉共用寫實句裡的 premium cinematic commercial quality(廣告感字眼),
  //     並讓接觸點那段認得腳:拍鞋、瑜珈墊時不再叫它交代「哪根手指握住」。
  //  ═══════════════════════════════════════════════════════════════
  //  🦶 用腳的動作 —— 接觸點與情境句要改用腳的說法
  const FOOT_ACTIONS = { shoes: 1, matfeet: 1 };
  //  🧹 場地去寫死:只換掉「地點名詞」,鏡位的距離與框線一字不動
  const PLACE_FIX = [
    [/on a clean light wood floor near a bright window/gi, 'on the floor'],
    [/a clean light wood floor/gi, 'the floor'],
    [/a clean table/gi, 'the surface below'],
    [/a clean surface/gi, 'the surface below'],
    [/a clean soft-lit background/gi, 'a simple background'],
    [/an? (?:hot )?frying pan on a countertop/gi, 'a hot pan'],
    [/on a countertop/gi, 'on the surface below'],
    [/Countertop macro shot/gi, 'Macro shot at working height'],
    [/a simmering pot on a stove/gi, 'a simmering pot'],
    [/a hot wok on a stove/gi, 'a hot wok'],
    [/an air fryer on a countertop/gi, 'an air fryer'],
    [/an open wardrobe rail/gi, 'a hanging rail'],
    [/\ba clean\b/gi, 'a'],
    [/\bclean /gi, ''],
  ];
  function _fPlace(t) { let x = String(t || ''); PLACE_FIX.forEach(function (p) { x = x.replace(p[0], p[1]); }); return x; }
  //  ⏱ 動作分時段:照原本寫好的動作順序切,不改字、不加戲
  //    切點用原句既有的「, then」「then」「and then」與分號,切不出來就整段給主時段。
  function _fSegs(motion, sec) {
    const n = Math.max(3, parseInt(sec, 10) || 5);
    const raw = String(motion || '').trim();
    let parts = raw.split(/,?\s+then\s+|;\s+/i).map(function (x) { return x.trim().replace(/^and\s+/i, ''); }).filter(Boolean);
    if (parts.length < 2) {
      parts = raw.split(/,\s+(?=(?:the|one|both|a|an|her|his|it)\b)/i).map(function (x) { return x.trim(); }).filter(Boolean);
    }
    //  再切不開就用「, 動名詞」當接點(例:「…toward the lens, turning it slowly…」)
    if (parts.length < 2) {
      parts = raw.split(/,\s+(?=\w+ing\b)/i).map(function (x) { return x.trim(); }).filter(Boolean);
    }
    if (parts.length < 2) return '(0-' + n + 's) ' + raw;
    if (parts.length > 3) parts = [parts[0], parts.slice(1, -1).join(', then '), parts[parts.length - 1]];
    //  前段短、主段長、收尾短 —— 跟真人拍東西的節奏一樣
    const cuts = parts.length === 2 ? [0, Math.round(n * 0.4), n] : [0, Math.round(n * 0.3), Math.round(n * 0.75), n];
    return parts.map(function (t, i) { return '(' + cuts[i] + '-' + cuts[i + 1] + 's) ' + t; }).join(' ');
  }

  function composeFacelessPrompt(action, opts) {
    opts = opts || {};
    const core = FACELESS_ACTIONS[action] || FACELESS_ACTIONS.hold;
    const isFoot = !!FOOT_ACTIONS[action];
    const sec = opts.duration || opts.seconds || 5;

    //  鏡位與動作拆開:鏡位在 FACELESS_CAMERA 之前,動作在之後(結尾的 KEEP 另外處理)
    const idx = core.indexOf(FACELESS_CAMERA);
    let cam = idx > -1 ? core.slice(0, idx).trim() : core;
    let motion = idx > -1 ? core.slice(idx + FACELESS_CAMERA.length).trim() : '';
    const keepIdx = motion.indexOf(FACELESS_KEEP.trim());
    if (keepIdx > -1) motion = motion.slice(0, keepIdx).trim();
    const hasScreenRule = core.indexOf(SCREEN_RULE) > -1;

    //  ① 主體詞 —— 拍什麼、在哪個機位、第幾秒做什麼、東西長什麼樣
    const subject = [
      _fPlace(cam),
      FACELESS_CAMERA,
      hasScreenRule ? SCREEN_RULE : '',
      _fSegs(_fPlace(motion), sec),
      FACELESS_KEEP.trim(),
      //  客戶自己寫的情境(框線鎖前面已經講過一次,這裡不重複)
      (opts.situation || '').trim()
        ? 'Within that framing, expressed only through the ' + (isFoot ? 'feet' : 'hands') + ' and the product: ' + String(opts.situation).trim()
        : '',
      //  接觸點:拍腳的時候不要再問「哪根手指」
      isFoot
        ? 'it stays in real contact with the foot and the ground, taking her weight'
        : CONTACT_CHAIN,
      //  身體與皮膚 = 主體的屬性,排在主體群(v5.55 誤放在抽象群)
      (String(opts.gender || '').toLowerCase().startsWith('m')) ? FACELESS_BODY_M : FACELESS_BODY_F,
      WALK_ACTIONS[action] ? FACELESS_WALK : '',
      FACELESS_SKIN,
    ].filter(Boolean).join(' ');

    //  ② 光影詞 —— 光線給方向就好(跟有臉那條線同一個原則:單側光、不死白)
    //  🏢 v5.53(2026-09-18)無臉也吃場景參考圖(RA 要 B 案):
    //   有實景照時,用 [SCENE_IMG] 佔位(Worker 會換成真正的 [ImageN]),
    //   只叫模型照抄【材質、色調、光從哪來】,不叫它照抄構圖 ——
    //   因為無臉是特寫,背景本來就糊,照抄構圖會跟鎖死的鏡位打架。
    //   沒有實景照 → 這一句不出現,行為跟 v5.52 一字不差。
    const scene = opts.hasScene
      ? 'The space, its materials, colours and where the light comes from follow [SCENE_IMG] — it sets the place and the light only, not the framing.'
      : '';
    //  光影群:單側光、接觸陰影、景深,三件事在這裡各講一次
    const light = 'Natural daylight from one side with gentle falloff, soft contact shadows where things touch, '
      + 'shallow depth of field with the background softly out of focus, no harsh overhead glare and no blown-out highlights.';

    //  ③ 抽象詞 —— 寫實基底與無聲無字,最短、墊底
    return [subject, scene, light, FACELESS_REALISM, FACELESS_NOTEXT].filter(Boolean).join(' ');
  }
  window.composeFacelessPrompt = composeFacelessPrompt;
  window.FACELESS_ACTIONS = FACELESS_ACTIONS;

  // 🔥 關鍵:取代 kol.html 裡的 composeSeedancePrompt
  window.composeSeedancePrompt = composePrompt;

  console.log('[CrewDirector] 🎬 v5.56 ✂️無臉盤點去重(框線鎖3次→1次·不浮空/接觸陰影/自然光/背景虛化各2次→1次)+身體與皮膚移回主體群 · v5.55 🚶無臉補上【走路發動點在骨盆與重心】(治腳自己滑動的木偶感)+【這是誰的身體】(預設成年女性·治生出男生的腿)·皮膚句拿掉靜脈與外側偏深(做過頭變肌肉腿) · v5.54 🧴無臉補上真人皮膚(膚色不均/關節偏紅/毛孔汗毛/靜脈/舊疤/襪子壓痕·RA:腳太完美像修過圖) · v5.53 🏢無臉也能吃場景參考圖([SCENE_IMG]·只鎖材質色調與光向,不鎖構圖) · v5.52 🎬無臉重構:詞序(主體→光影→抽象)+動作分時段(0-2s/2-4s/4-5s)+拿掉寫死場地與 clean+腳的動作不再問哪根手指+拿掉廣告感字眼;鏡位一字不動 · v5.51 🗣「從開口捏起」不算說話(三邊同步) · v5.50 🐛發音表對直傳台詞補上(之前只處理引號裡的字,直傳台詞沒引號 → 從沒生效) · 🎙台詞行 = 基礎聲線(KolPersona.voiceBaseZh)+這一格的「聲音:」結構描述(刺蝟星球) · v5.49 🗣發音:韌性→彈性 · v5.48 🗣「開口處」(袋子開口)不算說話(三邊同步) · v5.47 🗣發音:囤→屯、「啦」後面黏字補逗號(治念成上揚ㄌㄚˊ) · v5.46 ⏱台詞時間段改成第一段開口→最後一段還在講(三邊同步) · v5.45 ⏱說話視窗從 shotDesc 自己抓(掃含「開口/說/講」的那一段,不用叫 AI 多填欄位、也不用在提示詞加規則) · ✂️台詞尾巴 162→約40字(無字幕/無配樂 tail 都已經有,每格白付) · v5.44 ⏱分時段改由 AI 分鏡自己寫(RA:「(0-15秒)寫在唯一一顆鏡頭上等於沒寫,分時段是控制第幾秒發生什麼」)。shotDesc 已分段就照原樣送、不再硬包一層;台詞時間走 dialogueTime 欄(例:5-15)→ 引擎知道語音從第5秒才開始,前面本來就安靜 · v5.43 🎬改用 Seedance【原生對白語法】:畫面(0-15秒):… 台詞(0-15秒,她、語氣):「…」(RA 去查官方寫法:引號是台詞觸發符號、括號寫語氣、畫面與台詞配對、超過8秒用分時段)。時間段本身就宣告「從第0秒講到最後」,不必再管 AI 的中文用詞;語氣從動作描述自動擷取 · v5.42 ⏱說話排到動作前面(舊順序是「兩百多字中文動作→最後才 She speaks」,模型先演動作、第3~8秒才開口,語音卻從第0秒播=旁白。改組裝順序比去管 AI 用詞自然,AI 中文怎麼寫都行) · v5.41 🗣發音表加「種類→款式」(實測念成「種雷」) · v5.40 ✂️空間一致八個詞→一句(121→98字·機制只有「同一個空間只有機位在動」,前半是展開) · v5.39 👙拿掉內衣安全鎖 113 字(no exposed undergarments/no revealing clothing —— 商品就是內衣,這句跟「商品要被看見」打架,模型只能把內衣穿到最外層;而且兩個 no 等於點名召喚)。合規改由 kol-product v5.35 的正面陳述負責(穿在服裝參考圖底下·外層全程在身上) · v5.38 📐tail 排序改依詞序黃金法則(商品群→環境群→抽象群·同類不被切開·治「插隊收回扣→後面等於沒用」)· v5.37 💡拿掉「臉上光要均勻」兩份(正面否定攝影師的單側光·治段2平光0.6與粉感·kol-stitch已殺過兩份這是第三份)· v5.36 🗣台詞【直傳】不再掃引號(治「鏡頭欄寫什麼引號她就念什麼」+ 台詞不再重複付兩次字數)·kol.html 未改前自動走舊路 · v5.35 🗣台詞上限 60→95(治「68字台詞被整句忽略→該鏡沒有對嘴指令」·語速6.0後面板放行83) · v5.34 🚚 tail規則壓縮成關鍵詞串(路人403→1xx字·治「最肥的規則永遠第一個被 fitRules 整條丟掉」) · v5.33 就緒 · 🧍公共場所背景有人(實景照不加·無寵物) · · 🗣發音易錯字表(送出前攔截·手改/鎖定台詞也會過) · v5.21-dialogue60 · 🗣台詞上限對齊面板(40→60,治「抓不到台詞→旁白代念」) · 🏢有實景照略過場景光線(不與真照片競圖) · 🩳tail優先序重排(無字幕/跨段道具鎖提前·品牌調性墊底) · 組 prompt 責任已接管 · 無臉模式 prompt 已載入(含💻電腦·數位工作6條+螢幕鐵律)');
})();
