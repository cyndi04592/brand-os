// ==========================================================================
// kol-engine-kling.js — 攝影師② Kling v3 Pro adapter  v2.2「場景當首幀 · 四鎖全開」
// ==========================================================================
// v2.0 是一次重構,不是打補丁。目標:Kling 的語意 = Seedance 的語意,一句不漏。
//
// ★ 核心矛盾(先講清楚,這決定了整個設計):
//     Seedance:shared.front(949 字元)+ shared.tail 寫「一次」,分攤給 6 個 shot。
//     Kling   :multi_prompt 每個 shot 獨立,上限 512 字元。
//     → 一比一照搬「物理上不可能」。RA 說「Seedance 也像硬裝的」——正確。
//
// ★ 解法:同一句話,換一個承載位置。語意零損失。
//     ① 負向句(no / not / never …)  → negative_prompt(全域欄位,0 字元成本,全 shot 生效)
//     ② 視覺已定調的正向             → start_image + elements 承擔(不必用文字重申)
//     ③ 「要她怎麼演/怎麼拿」的正向  → 留在每 shot 的 512(negative_prompt 表達不了)
//
// ★ 來源逐檔對齊(挖過 12,961 行,不是憑印象):
//     kol-cinematographer.js  REALISM_BASE / SCENE_REALISM / AUDIO_REALISM
//     kol-crew-director.js    composeStitchShared 的 front(化妝真實度/打光/接地)+ tail(無字幕)
//     kol-product.js          道具師 contribute 的 7 模式 + 物理錨 + 尺度錨
//     kol-stitch.js           五鎖 / 跨段鎖定條款 / 眼神塊 / 表情塊 / 台詞邊界
//
// ⚠️ 已知系統內部矛盾(RA 未裁決,不擅自決定):
//     kol-cinematographer v5.24 雷區註解:「不加 contact shadows(烤肉紋兇手)」
//     kol-crew-director   front[4]:      「soft natural contact shadows …」有加
//     → 本檔採「低優先級正向錨」,512 不夠時最先丟。RA 若裁決,改 CONTACT_SHADOWS 常數即可。
//
// ⚠️ 硬事實(fal 官方 + 實測):
//     · multi_prompt 每 shot prompt ≤ 512 字元(官方文件沒寫,是我們用 422 測出來的)
//     · 每個 element 必須 frontal_image_url AND reference_image_urls 成對,否則 422
//     · elements 上限 3(fal 原文:"Maximum three image elements are allowed.")
//
// ★ v2.2 的核心修正:start_image_url 放「場景圖」,不放 KOL 的臉。
//   【症狀】v2.1 實測 30 秒成品:臉✅ 衣服✅ 商品✅ 無字幕✅ 笑不浮誇✅,但「背景在室內暗牆與賣場之間來回跳」。
//   【根因】start_image_url = 欣怡的 sheet_front,那張照片的背景是室內暗牆+鼓。
//           Kling 是 image-to-video → 首幀 = 那張圖 → 每段都從「室內」開始。
//           @Element3 的賣場空景圖只是「參考」,打不過首幀的既成事實 → 模型在兩者間拉扯。
//   【三方證據都指向同一件事:首幀該是場景,不是人】
//     ① fal 官方 v3 multi_prompt 範例:start_image_url: "scene.png",角色靠 @Element 進場
//     ② RA 藍圖:「場景平面布局圖當第 9 張 → AI 參考規劃空間 → 解背景假、跨段場景飄」(RA 標超需)
//     ③ 刺蝟星球方法論:「資產 + 提示詞」—— 場景是「資產」,要先做出來當錨
//   【順帶解掉三個問題】
//     · 場景不再飄(首幀就是賣場)
//     · 服裝 element 空位回來 → 臉 + 商品 + 服裝 = 四鎖全開
//     · 輸出變真 9:16(場景圖是直幅;sheet_front 是 1000×1321 的 3:4)
//   【首幀無人的處理】官方範例就是這樣拍的(shot1 空景 → 角色進場)。分鏡第一拍建議寫「她走進畫面」。
//     · 元素必須在 prompt 裡以 @ElementN 引用才生效 → 引用句不可被丟
//     · duration 3~15 任意整數秒(不是 5/8/10/15,那是第三方誤傳)
//     · aspect_ratio 被模型忽略,實際比例由 start_image 決定
//     · Kling v3/o3 並發上限 1/user(可向 fal 申請 override)
//
// 🔒 不可動:台詞(引號內)一字不改;Taiwanese Mandarin 永不裸奔(v5.18 誤拔 → 又晴變中國腔)
// ⏸ 未對齊(獨立入口,不走 runStitchFlow):composeFacelessPrompt 無臉模式 → Wishlist
// ==========================================================================
(function () {
  'use strict';

  const ENDPOINT = 'fal-ai/kling-video/v3/pro/image-to-video';
  const MAX_SHOTS = 6;
  const MAX_ELEMENTS = 3;   // fal 硬限制:Maximum three image elements are allowed
  const SHOT_LIMIT = 512;
  const CFG_SCALE = 0.6;
  const CONTACT_SHADOWS = true;   // ⚠️ 見上方矛盾註記;false = 依 cinematographer 雷區

  function clampSec(n) { return Math.max(3, Math.min(15, parseInt(n, 10) || 5)); }

  // ══════════════════════════════════════════════════════════════════════
  //  negative_prompt —— CrewDirector 全部負向句的新家(全域,0 字元成本)
  //  每一條都標來源,可追溯。刪任何一條前先確認它在 prompt 正向側有沒有替身。
  // ══════════════════════════════════════════════════════════════════════
  const NEGATIVE = [
    // ── REALISM_BASE 負向半邊(kol-cinematographer.js)
    'beauty filter', 'skin smoothing', 'skin retouching', 'studio polish',
    'hard cutout outline', 'over-sharpened subject edge', 'pasted-on composited look',
    // ── SCENE_REALISM 負向半邊(kol-cinematographer.js)★ 這組是「背景假、貼上去感」的解藥
    '3D render', 'CGI', 'video-game environment', 'glossy commercial polish',
    'crowd', 'extra background people', 'stylized or exaggerated artificial element',
    'mismatched colour temperature between subject and background',
    'furniture moving between shots', 'objects appearing or disappearing between shots',
    // ── AUDIO_REALISM 負向半邊(kol-cinematographer.js)
    'background music', 'soundtrack', 'jingle', 'canned music',
    // ── crew-director front[3] 打光負向
    'harsh overhead glare', 'hot specular highlights on skin', 'oily shine', 'greasy T-zone',
    // ── crew-director tail 無字幕(★ v1.x 完全漏掉 → Kling 會把字幕燒進畫面)
    'subtitles', 'captions', 'on-screen text', 'burned-in text', 'watermark',
    // ── 道具師一致性約束(kol-product.js:never mirrored / do not distort or morph)
    'mirrored product', 'flipped product', 'distorted product', 'morphed product',
    'changed product proportions', 'changed product colour', 'altered printed text on product',
    'floating product', 'product pasted on', 'product scattered messily',
    'product overpowering the subject', 'unrecognizable product',
    // ── 化妝真實度負向(crew-director front[2])
    'makeup that smooths or replaces real skin', 'freshly applied heavy makeup', 'plastic skin',
    // ── Seedance Global 跨段鎖定條款(kol-stitch.js)
    'lighting change between shots', 'inconsistent light direction', 'colour grade shift',
    'different person', 'different background', 'changed outfit', 'changed scene',
    // ── 眼神塊 / 表情塊負向半邊(kol-stitch.js,RA 打磨過的反浮誇/反空洞)
    'statue-still frozen pose', 'blank fixed stare', 'dead fish eyes', 'unfocused empty eyes',
    'rigid fixed stare', 'frozen exaggerated expression', 'held exaggerated grin', 'frozen smile',
    'wide-eyed look held too long', 'same expression for the whole shot', 'locked static face pose',
    // ── 台詞邊界負向半邊
    'robotic delivery', 'slurred speech', 'invented or extra words', 'repeated words',
    'improvised prices', 'improvised numbers',
    // ── 通用
    'blur', 'distort', 'low quality'
  ].join(', ');

  // ══════════════════════════════════════════════════════════════════════
  //  正向錨 —— 只留 negative_prompt 表達不了的「要她怎麼做」
  //  (視覺已由 start_image + elements 定調的,不再用文字重申)
  // ══════════════════════════════════════════════════════════════════════

  // 🔒 台詞邊界 + 口音鐵律(REALISM_BASE 的 Taiwanese Mandarin accent + natural lip sync)
  const bAudio = (accent) => ' Speaks only the written line, natural ' + accent
    + ', natural lip sync, brand names clear; no line = silent.';

  // 🎭 表情塊 + 眼神塊(kol-stitch.js 打磨版的正向半邊,六錨全留)
  const B_EYES = ' Expression flows; delight is a brief passing beat. Eyes catchlit, brightening on stressed words;'
    + ' natural blinking, micro-expressions, gaze drifts and returns.';

  // 🎬 SCENE_REALISM 正向半邊:景深構圖(negative 表達不了「注意力在她身上」)
  const B_DOF = ' She stays sharp; background falls into soft shallow focus.';

  // 🌍 接地真實(crew-director front[4])⚠️ 見檔頭矛盾註記
  const B_GROUND = CONTACT_SHADOWS
    ? ' Soft contact shadows where hands and product touch surfaces, physically grounded.'
    : '';

  // 📷 REALISM_BASE 正向半邊(最低優先級:首幀圖已定調這些,文字只是保險)
  const B_REALISM = ' Handheld iPhone vlog, 35mm, natural available light, an ordinary real person, candid unscripted.';

  // 🎒 道具師 7 模式(kol-product.js)—— 一致性約束已搬 negative,這裡只留「她怎麼跟商品互動」
  //    [Image2] → @ElementN 的 token 轉譯,由 tag 帶入。
  const PROP_BY_MODE = {
    held:    (t, sz) => ' Holding ' + t + ' naturally' + sz + ', front to camera.',
    worn:    (t, sz) => ' Wearing ' + t + ' on her body' + sz + ', real weight.',
    hero:    (t, sz) => ' ' + t + ' is the star: large, prominent, solidly grounded; she interacts naturally.',
    demo:    (t, sz) => ' Actively using ' + t + ' as intended' + sz + '; its effect visible, front to camera.',
    digital: (t)     => ' No physical item: she presents it on a device screen showing ' + t + '.',
    dish:    (t, sz) => ' Presenting ' + t + ' plated' + sz + ', front to camera; never returned to the pan.',
    packaged:(t, sz) => ' Holding ' + t + ' package' + sz + ', label front to camera.',
    _default:(t, sz) => ' Holding ' + t + ' naturally' + sz + ', front to camera.',
  };
  function bProduct(tag, mode, scale) {
    const fn = PROP_BY_MODE[mode] || PROP_BY_MODE._default;
    const sz = scale ? ' at true size (' + scale + ')' : ', true size';
    return fn(tag, sz);
  }

  const bOutfit = (tag) => ' Wearing ' + tag + ', same outfit.';
  const bScene  = (tag) => ' In ' + tag + ', same background.';
  // v2.2:場景當首幀時沒有 @ElementN 可引用 → 改成「延續首幀的那個地方」。
  //   跨段一致靠:同一張首幀 + 共用 seed + negative(different background / furniture moving)。
  const B_SCENE_FRAME = ' Same location as the first frame; the background layout never changes.';

  // ══════════════════════════════════════════════════════════════════════
  //  512 的三層保護:① 台詞絕不動 ② 動作整句丟不切字 ③ 錨詞整塊丟
  //  ⚠️ 中文沒有空格 → 絕不可用 lastIndexOf(' ') 找邊界(v1.4 的 bug:「一百元」→「一百」)
  // ══════════════════════════════════════════════════════════════════════
  const QUOTE_RE = /[「『"“”][^「『"“”」』]*[」』"“”]/g;
  const quotedParts = (t) => String(t).match(QUOTE_RE) || [];

  function splitSentences(text) {
    const out = []; let buf = '';
    for (const ch of String(text)) {
      buf += ch;
      if ('。!?!?;;\n'.indexOf(ch) !== -1) { out.push(buf); buf = ''; }
    }
    if (buf) out.push(buf);
    return out;
  }

  function trimActionBySentence(action, budget) {
    if (action.length <= budget) return action;
    let sents = splitSentences(action);
    const dropped = [];
    while (sents.join('').length > budget && sents.length > 1) {
      const last = sents[sents.length - 1];
      if (quotedParts(last).length) break;          // 🔒 含台詞的句子永不丟
      dropped.push(last.trim()); sents.pop();
    }
    const joined = sents.join('').trim();
    if (dropped.length) console.warn('[KolEngine:kling] 分鏡過長,整句丟棄(未切字):', dropped.join(' / '));
    return (joined.length <= budget) ? joined : null;
  }

  // 🫀 RIIV⑤ 鐵律:情緒要「演出來」,不是「講出來」。只提醒,不改 RA 的字。
  const TELL_WORDS = ['心裡', '心理', '雀躍', '很開心', '非常開心', '覺得', '感到', '感覺', '內心', '興奮不已', '她很', '他很'];
  function warnTellNotShow(action) {
    const hit = TELL_WORDS.filter((w) => action.indexOf(w) !== -1);
    if (hit.length) {
      console.warn('[KolEngine:kling] 🫀 這句用「講」的描述情緒(' + hit.join('、') + '),模型看不懂。'
        + '❌「她很開心」→ ✅「眼睛一亮,抓起鞋轉一圈」');
    }
  }

  function assemble(action, blocks) {
    warnTellNotShow(action);
    if (action.length > SHOT_LIMIT) {
      const trimmed = trimActionBySentence(action, SHOT_LIMIT);
      if (trimmed === null) {
        throw new Error('這個鏡頭的分鏡文字太長(' + action.length + ' 字元,上限 ' + SHOT_LIMIT
          + '),且含台詞不能截斷。請縮短分鏡,或把台詞拆成兩個鏡頭。');
      }
      action = trimmed;
    }
    let out = action; const dropped = [];
    for (const b of blocks) {
      if (!b.text) continue;
      if ((out + b.text).length <= SHOT_LIMIT) out += b.text;
      else dropped.push(b.name);
    }
    if (dropped.length) console.warn('[KolEngine:kling] 512 預算不足,整塊丟棄:', dropped.join(' / '), '| 長度', out.length);
    return { text: out, dropped: dropped };
  }

  function callWorker(action, params) {
    if (!window.KolStitch || typeof window.KolStitch._api !== 'function') {
      throw new Error('KolEngine(kling):找不到 KolStitch._api,請確認 kol-stitch.js 已載入');
    }
    return window.KolStitch._api(action, params);
  }

  // 🔒 口音鐵律:台灣 KOL 一律 Taiwanese Mandarin,永不裸奔成大陸腔。
  function accentOf(seg) {
    const nat = seg.nationality
      || (window.S && window.S.selectedKol && window.S.selectedKol.persona && window.S.selectedKol.persona.nationality)
      || 'tw';
    return (typeof window.natToAccent === 'function') ? window.natToAccent(nat) : 'Taiwanese Mandarin';
  }

  // 從 kol-product.js 拿商品模式(7 模式驅動,沒設就 held)
  function productModeOf(seg) {
    if (seg.productMode) return seg.productMode;
    try {
      const prod = (typeof window.getCurrentRotationProduct === 'function') ? window.getCurrentRotationProduct() : null;
      const ov = prod && window.S && (window.S.productModeOverride || {})[prod.prodName || prod.name];
      return ov || (prod && prod.productMode) || null;
    } catch (_) { return null; }
  }

  // ══════════════════════════════════════════════════════════════════════
  //  elements 組裝 + @ElementN 動態編號
  //  ★ 兩種「多張商品圖」語意完全不同(RA 指出的設計錯誤,v2.0 修正):
  //     ① 同一件商品的多面向(海苔外包裝 + 內容物 / 鞋子三視圖)
  //        → 一個 element:frontal = 主圖,reference_image_urls = 其餘面向
  //     ② 不同商品分段綁圖(這 shot 拿 FILA,下 shot 拿 Champion)
  //        → 各自一個 element
  //     判斷:任一 beat 帶 productUrl/productDriveId → ② 分段綁圖;否則 → ① 多面向
  // ══════════════════════════════════════════════════════════════════════
  function buildElements(seg, beats) {
    const els = [];
    const tags = { outfit: null, scene: null, byKey: {}, first: null };
    const mk = (drive, url) => (drive ? { frontal_drive_id: drive } : { frontal_image_url: url });

    // @Element1 = 臉(正臉 + 多角度 reference)→ 解臉漂移,已驗證。永遠佔位。
    const faceEl = {};
    if (seg.kolFaceDriveId) faceEl.frontal_drive_id = seg.kolFaceDriveId;
    else faceEl.frontal_image_url = seg.kolImageUrl;
    const angleIds = (seg.kolAngleDriveIds || []).filter(Boolean).slice(0, 4);
    const angleUrls = (seg.kolAngleUrls || []).filter(Boolean).slice(0, 4);
    if (angleIds.length) faceEl.reference_drive_ids = angleIds;
    else if (angleUrls.length) faceEl.reference_image_urls = angleUrls;
    els.push(faceEl);

    const prodIds = (seg.productDriveIds || []).filter(Boolean);
    const prodUrls = (seg.productImageUrls || []).filter(Boolean);
    const hasProduct = !!(prodIds.length || prodUrls.length);
    const hasOutfit = !!(seg.outfitDriveId || seg.outfitImageUrl);
    const hasScene = !!(seg.sceneDriveId || seg.sceneImageUrl);
    const perBeat = (beats || []).some((b) => b && (b.productUrl || b.productDriveId));

    // ★ v2.2:場景已升格為 start_image_url(空間錨),不再佔用 element 名額。
    //   elements 上限 3,臉佔 1 → 剩 2 格給 商品 + 服裝 = 四鎖全開。
    //   ⚠️ 只有「沒有場景圖」時,場景才退回搶 element(那時它只是參考,效果差很多)。
    const sceneIsStartFrame = hasScene;
    const priority = Array.isArray(seg.elementPriority) && seg.elementPriority.length
      ? seg.elementPriority : ['product', 'outfit', 'scene'];
    const available = { product: hasProduct, scene: hasScene && !sceneIsStartFrame, outfit: hasOutfit };
    const slots = MAX_ELEMENTS - 1;                       // = 2
    const chosen = priority.filter((k) => available[k]).slice(0, slots);
    const skipped = priority.filter((k) => available[k] && chosen.indexOf(k) === -1);

    if (skipped.length) {
      const why = {
        outfit: '服裝(靠 start_image 首幀 + 共用 seed + negative「changed outfit」鎖住)',
        scene:  '場景(靠 negative「different background / changed scene / furniture moving」鎖住)',
        product:'商品',
      };
      console.warn('[KolEngine:kling] ⚠️ fal 硬限制:最多 3 個 image element(臉已佔 1)。'
        + '本次未帶入:' + skipped.map((k) => why[k] || k).join('、')
        + '。要改順序請傳 elementPriority,例如 [\'product\',\'outfit\']。');
    }

    chosen.forEach((kind) => {
      if (kind === 'product') {
        if (perBeat) {
          // ② 分段綁圖:不同商品各自一個 element(但只剩這一格 → 只放得下 1 件)
          const list = prodIds.length ? prodIds : prodUrls;
          const one = prodIds.length ? mk(list[0], null) : mk(null, list[0]);
          els.push(one);
          tags.first = '@Element' + els.length;
          list.forEach((v) => { tags.byKey[v] = tags.first; });   // 全部指向同一格
          if (list.length > 1) {
            console.warn('[KolEngine:kling] ⚠️ 分段綁圖有 ' + list.length + ' 件商品,但 element 只剩 1 格 → '
              + '全部 shot 共用第一件。若要真正分段換商品,請拆成不同 chunk 生成。');
          }
        } else {
          // ① 同一件商品的多面向(海苔外包裝 + 內容物 / 鞋子三視圖)→ 合成「一個」element
          const el = prodIds.length ? mk(prodIds[0], null) : mk(null, prodUrls[0]);
          const rest = prodIds.length ? prodIds.slice(1, 5) : prodUrls.slice(1, 5);
          if (rest.length) {
            if (prodIds.length) el.reference_drive_ids = rest; else el.reference_image_urls = rest;
          }
          els.push(el);
          tags.first = '@Element' + els.length;
          (prodIds.length ? prodIds : prodUrls).forEach((v) => { tags.byKey[v] = tags.first; });
        }
      } else if (kind === 'outfit') {
        els.push(seg.outfitDriveId ? mk(seg.outfitDriveId, null) : mk(null, seg.outfitImageUrl));
        tags.outfit = '@Element' + els.length;
      } else if (kind === 'scene') {
        els.push(seg.sceneDriveId ? mk(seg.sceneDriveId, null) : mk(null, seg.sceneImageUrl));
        tags.scene = '@Element' + els.length;
      }
    });

    tags.of = function (beat) {
      if (!tags.first) return null;
      if (typeof beat !== 'object') return tags.first;
      const key = beat.productDriveId || beat.productUrl;
      if (key && tags.byKey[key]) return tags.byKey[key];
      return key ? tags.first : (perBeat ? null : tags.first);
    };
    return { elements: els, tags: tags };
  }

  // ══════════════════════════════════════════════════════════════════════
  //  一個 beat → 一個 Kling shot。優先級 = 「negative 表達不了的」排前面。
  // ══════════════════════════════════════════════════════════════════════
  function buildShotPrompt(beat, opts, tags) {
    const action = ((typeof beat === 'string') ? beat : (beat.prompt || '')).trim();
    const prodTag = tags.of ? tags.of(beat) : null;
    const r = assemble('@Element1 ' + action, [
      // 🔒 鐵律:口音 + 台詞邊界。永遠第一(v5.18 誤拔 → 又晴變中國腔)
      { name: '口音/台詞邊界🔒', text: opts.audioOn ? bAudio(opts.accent) : '' },
      // @ElementN 引用句:被丟 = 那張圖白傳(fal:元素必須被 @ 引用才生效)
      { name: '商品錨(道具師)', text: prodTag ? bProduct(prodTag, opts.productMode, opts.productScale) : '' },
      { name: '服裝錨@E', text: tags.outfit ? bOutfit(tags.outfit) : '' },
      { name: '場景錨', text: tags.scene ? bScene(tags.scene) : (opts.sceneIsStartFrame ? B_SCENE_FRAME : '') },
      // 🎭 「怎麼演」只能正向講,negative 表達不了
      { name: '表情/眼神🎭', text: B_EYES },
      // 以下三塊:負向已在 negative_prompt / 視覺已由 start_image 定調 → 最先犧牲
      { name: '景深構圖', text: B_DOF },
      { name: '接地真實', text: B_GROUND },
      { name: '真實度錨', text: B_REALISM },
    ]);
    return r.text;
  }

  async function submitSegment(seg) {
    if (!seg.kolFaceDriveId && !seg.kolImageUrl) throw new Error('KolEngine(kling):缺少 kolFaceDriveId 或 kolImageUrl');

    let beats = (Array.isArray(seg.beats) && seg.beats.length)
      ? seg.beats.map((b) => (typeof b === 'string' ? { prompt: b } : b))
      : (seg.prompt ? [{ prompt: seg.prompt }] : null);
    if (!beats) throw new Error('KolEngine(kling):缺少 beats/prompt(這段的動作)');
    if (beats.length > MAX_SHOTS) beats = beats.slice(0, MAX_SHOTS);

    const built = buildElements(seg, beats);
    const opts = {
      accent: accentOf(seg),
      audioOn: seg.generateAudio === true,
      productMode: productModeOf(seg),
      productScale: seg.productScale || '',
      sceneIsStartFrame: !!(seg.sceneDriveId || seg.sceneImageUrl),
    };

    const multiPrompt = beats.map((b) => {
      const dur = (typeof b === 'object' && b.durationSec) ? b.durationSec
        : Math.max(1, Math.round((seg.totalSec || 5) / beats.length));
      return { prompt: buildShotPrompt(b, opts, built.tags), duration: String(clampSec(dur)) };
    });

    // shared.front(CrewDirector B 版):塞得下才加,塞不下就靠 negative_prompt(語意已覆蓋)
    if (seg.shared && seg.shared.front && multiPrompt[0]) {
      const merged = multiPrompt[0].prompt + ' ' + seg.shared.front;
      if (merged.length <= SHOT_LIMIT) multiPrompt[0].prompt = merged;
      else console.warn('[KolEngine:kling] shared.front(' + seg.shared.front.length + ' 字元)塞不進 512,'
        + '其負向語意已在 negative_prompt 全域生效,正向已由 start_image + elements 承擔。');
    }

    // ★ v2.2 首幀 = 空間錨。優先用場景圖(決定背景 + 9:16 比例);沒有場景圖才退回 KOL 臉。
    //   ⚠️ 用 KOL 臉當首幀 = 把她照片的背景也帶進來 → 跨段場景飄(v2.1 實測踩過)。
    const startDriveId = seg.sceneDriveId || (seg.sceneImageUrl ? undefined : seg.kolFaceDriveId);
    const startImageUrl = seg.sceneDriveId ? undefined
      : (seg.sceneImageUrl || (seg.kolFaceDriveId ? undefined : seg.kolImageUrl));
    if (!seg.sceneDriveId && !seg.sceneImageUrl) {
      console.warn('[KolEngine:kling] ⚠️ 沒有場景圖 → 首幀退回 KOL 照片,'
        + '該照片的背景會變成影片起點(可能跨段飄)。建議傳 sceneCtx 讓系統生場景參考圖。');
    }

    const sub = await callWorker('kling_submit', {
      endpoint: ENDPOINT,
      startDriveId: startDriveId || undefined,
      startImageUrl: startImageUrl || undefined,
      elements: built.elements,
      multiPrompt: multiPrompt,
      shotType: 'customize',
      totalSec: String(clampSec(seg.totalSec || 5)),
      aspectRatio: seg.aspectRatio || '9:16',   // ⚠️ 模型忽略,比例由首幀圖決定
      resolution: seg.resolution || '720p',
      generateAudio: opts.audioOn,
      negativePrompt: seg.negativePrompt || NEGATIVE,
      cfgScale: (typeof seg.cfgScale === 'number') ? seg.cfgScale : CFG_SCALE,
      seed: seg.seed,                            // 跨段共用 seed(對齊 Seedance)
      brandId: seg.brandId,
      kolName: seg.kolName
    });

    if (!sub || !sub.requestId) throw new Error('KolEngine(kling):Worker 沒回 requestId(' + JSON.stringify(sub).slice(0, 300) + ')');
    return { requestId: sub.requestId, engine: 'kling', endpoint: ENDPOINT, r2Refs: sub.r2Refs };
  }

  window.KolEngines = window.KolEngines || {};
  window.KolEngines.kling = {
    id: 'kling',
    label: '敘事寫實 · 真人臉動作鎖',   // 客戶前台的風格化名稱(商業鐵律:不露引擎名)
    endpoint: ENDPOINT,
    submitSegment: submitSegment,
    negativePrompt: NEGATIVE,
    // 除錯:看每 shot prompt / 字數 / @Element 對照 / elements 分組。不送 fal、不燒點數。
    _preview: function (beats, seg) {
      seg = seg || {};
      const list = (Array.isArray(beats) ? beats : [beats]).map((b) => (typeof b === 'string' ? { prompt: b } : b));
      const built = buildElements(Object.assign({ kolFaceDriveId: 'FACE' }, seg), list);
      const opts = { accent: accentOf(seg), audioOn: seg.generateAudio === true, productMode: seg.productMode, productScale: seg.productScale, sceneIsStartFrame: !!(seg.sceneDriveId || seg.sceneImageUrl) };
      console.log('首幀', opts.sceneIsStartFrame ? '場景圖(空間錨)★' : '⚠️KOL照片(背景會帶進來)',
        '| elements', built.elements.length, '| 商品', built.tags.first || '無',
        '| 服裝', built.tags.outfit || '無', '| 場景', opts.sceneIsStartFrame ? '首幀' : (built.tags.scene || '無'),
        '| 模式', opts.productMode || 'held(預設)',
        '| negative_prompt', NEGATIVE.split(', ').length, '條');
      return list.map((b, i) => {
        const p = buildShotPrompt(b, opts, built.tags);
        return { shot: i + 1, len: p.length, ok: p.length <= SHOT_LIMIT, prompt: p };
      });
    }
  };

  console.log('[KolEngine] 🎥 攝影師② Kling v2.2「完整對齊 CrewDirector」· window.KolEngines.kling · '
    + '📚語意來源:cinematographer(REALISM/SCENE/AUDIO) + crew-director(化妝/打光/接地/無字幕) + product(道具師7模式) + stitch(五鎖/眼神/表情/台詞) · '
    + '🚫negative_prompt ' + NEGATIVE.split(', ').length + ' 條(負向全搬·0字元成本·含無字幕+反貼上去感+道具一致性) · '
    + '📦商品多面向合一element(海苔包裝+內容物) vs 分段綁圖多element · '
    + '📏512三層保護(🔒台詞絕不動·動作整句丟不切字·錨詞整塊丟) · 🫀情緒要演不要講 · '
    + '🔒Taiwanese Mandarin · ⏱duration照抄3~15 · ⚠️elements上限4 · ⚠️並發=1排隊跑');
})();
