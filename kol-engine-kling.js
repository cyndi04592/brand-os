// ==========================================================================
// kol-engine-kling.js — 攝影師② Kling v3 Pro adapter  v1.5
// --------------------------------------------------------------------------
// v1.3 變更(對齊 Seedance 那條已打磨的路,連踩過的坑一起搬過來):
//   🐛 修 bug:seed 沒傳給 Worker → 跨段用不同 seed → 一致性直接崩。Seedance 有共用 seed。
//   ➕ 接共用資產:服裝 @ElementN(資產②)、場景 @ElementN(資產④)
//      ★ 藍圖鐵律:「資產庫生一次 → 三位攝影師都能吃」。服裝/場景不是 Seedance 專屬。
//      ⚠️ @ElementN 編號是「動態」的:沒商品時服裝就變 @Element2。寫死必錯。
//   ➕ 分段綁圖:不同 shot 綁不同商品(對齊 Seedance collectBeatProducts)
//   ➕ Seedance 的「Global 跨段鎖定條款」搬進 negative_prompt(反向表達,不佔 512):
//        Seedance「keep the exact same lighting in every shot」→ neg「lighting change between shots」
//        Seedance「one unified colour grade」                  → neg「colour grade shift」
//        Seedance「no change of person, scene, outfit」         → neg「different person / background / outfit」
//        Seedance「no crowd」                                   → neg「crowd, bystanders」
//   ➕ 眼神塊(catchlights / 不死魚眼 / 視線流動 / 不定格表情)—— Seedance 有,補上
//   ➕ shared.front / shared.tail 支援(B 版精簡敘事)
// --------------------------------------------------------------------------
// ★ 硬事實(fal 官方 + 我們實測):
//   · multi_prompt 每 shot 上限 512 字元(單 prompt 模式才 2500)
//   · 每個 element 必須「frontal_image_url AND reference_image_urls」成對,只給 frontal → 422
//     → 單張資產(商品/服裝/場景)由 Worker v3.51 自動用 frontal 補 reference
//     ⚠️ 已知代價:單張商品在 shot2 會變形(模型不知道側面)→ 需要資產⑤ 商品三視圖
//   · duration 只吃 5 / 8 / 10 / 15(Seedance 吃任意秒數 → 必須 snap,否則 422)
//   · elements 上限 4(Worker slice(0,4))
//   · aspect_ratio 被模型忽略,比例由 start_image 決定
//   · Kling v3/o3 並發上限 1/user → 多段排隊跑,非 bug
// --------------------------------------------------------------------------
// 超額處理 = 「按塊丟棄」(assemble),絕不 slice 腰斬句子破壞語意。
//   優先級:動作(絕不丟) > 口音/音訊(鐵律) > 商品 > 服裝 > 場景 > 寫實 > 眼神/生命感
// 🔒 Taiwanese Mandarin 永不裸奔(v5.18 誤拔 → 又晴變中國腔)
// ==========================================================================
(function () {
  'use strict';

  const ENDPOINT = 'fal-ai/kling-video/v3/pro/image-to-video';
  const MAX_SHOTS = 6;
  const MAX_ELEMENTS = 4;   // Worker slice(0,4)
  const SHOT_LIMIT = 512;
  const CFG_SCALE = 0.6;
  // ⚠️ Kling 只吃這四個秒數(fal 官方:5 / 8 / 10 / 15)。給 7 或 12 會被拒。
  //    Seedance 吃任意秒數 → 分鏡秒數直接照抄過來會炸,必須 snap 到最近的合法值。
  const LEGAL_SEC = [5, 8, 10, 15];
  function snapSec(n) {
    const v = parseInt(n, 10) || 5;
    return LEGAL_SEC.reduce(function (best, cur) {
      return Math.abs(cur - v) < Math.abs(best - v) ? cur : best;
    }, LEGAL_SEC[0]);
  }

  // ── 負向詞:全域欄位,不佔 512。= RA REALISM_BASE 負向半邊 + Seedance Global 跨段鎖定條款(反向)
  //    ⚠️ 嚴守雷區:不寫 pores / film grain / contact shadows / perfect / studio(驗過的烤肉紋兇手)
  const NEGATIVE = [
    // 膚質/修圖(REALISM_BASE 負向半邊)
    'beauty filter', 'skin smoothing', 'skin retouching', 'oily shine', 'greasy T-zone',
    'hot specular highlights', 'plastic skin', 'studio polish', 'glossy commercial look',
    'polished fashion model', 'CGI', '3D render', 'pasted-on composited look', 'hard cutout outline',
    // 生命感負向(眼神塊/生命感層的反面)
    'statue-still frozen pose', 'blank fixed stare', 'dead fish eyes', 'frozen exaggerated expression',
    // 語音負向(AUDIO_REALISM)
    'robotic delivery', 'slurred speech', 'invented or extra words', 'repeated words',
    'background music', 'soundtrack', 'jingle',
    // 🆕 v1.3 Seedance Global 跨段鎖定條款(反向表達 → 全 shot 生效,0 字元成本)
    'lighting change between shots', 'inconsistent light direction', 'colour grade shift',
    'different person', 'different background', 'changed outfit', 'changed scene',
    'crowd', 'bystanders', 'extra people',
    // 通用
    'blur', 'distort', 'low quality'
  ].join(', ');

  // ── 正向錨(必須留在 prompt)
  const B_REALISM = ' Handheld phone vlog, natural available light, her skin exactly like the reference, an ordinary real person.';
  // 眼神塊(Seedance 有,補上;已把負向部分搬 negative_prompt,這裡只留「要什麼」)
  const B_EYES    = ' Bright lively eyes with clear catchlights, warm and present; gaze drifts naturally and returns to the lens, relaxed blinking, expressions flow and change like a real person.';
  const bAudio    = (accent) => ' She speaks only the written line, in natural ' + accent + ', brand names and numbers clear and unhurried; with no written line she stays silent.';
  const bProduct  = (tag) => ' Holding ' + tag + ', the same physical product at a consistent real-world size.';
  const bOutfit   = (tag) => ' Wearing ' + tag + ', the same outfit in every shot.';
  const bScene    = (tag) => ' In ' + tag + ', the same location and background throughout.';

  function callWorker(action, params) {
    if (!window.KolStitch || typeof window.KolStitch._api !== 'function') {
      throw new Error('KolEngine(kling):找不到 KolStitch._api,請確認 kol-stitch.js 已載入');
    }
    return window.KolStitch._api(action, params);
  }

  function accentOf(seg) {
    const nat = seg.nationality
      || (window.S && window.S.selectedKol && window.S.selectedKol.persona && window.S.selectedKol.persona.nationality)
      || 'tw';
    return (typeof window.natToAccent === 'function') ? window.natToAccent(nat) : 'Taiwanese Mandarin';
  }

  // ═══ 512 預算的三層保護(v1.5)══════════════════════════════════════════
  //  ① 台詞(引號內)  → 🔒 絕對不動。少一個字 = 她會漏念/亂念。
  //  ② 動作描述        → 🔒 不切字。真的超長 → 從尾端「整句」丟(以 。,、!? 為界)
  //  ③ 錨詞(本檔加的) → ✅ 可整塊丟(優先級由低到高)
  //  ★ 永遠不在句子/字詞中間切斷。
  //  ⚠️ v1.4 的 bug:用 lastIndexOf(' ') 找詞邊界 —— 中文沒有空格 → 直接砍在字中間,
  //     「撿到這100元的鞋子」被切成「撿到這10」。中文絕不能用空格當邊界。
  // ═══════════════════════════════════════════════════════════════════════

  // 抓出所有引號台詞(中英雙引號都認),這些片段絕對不可被截斷。
  const QUOTE_RE = /[「『"“”][^「『"“”」』]*[」』"“”]/g;
  function quotedParts(text) { return String(text).match(QUOTE_RE) || []; }

  // 依中文/英文句讀切句(保留標點),用來「整句丟棄」而不是切字。
  function splitSentences(text) {
    const out = [];
    let buf = '';
    for (const ch of String(text)) {
      buf += ch;
      if ('。!?!?;;\n'.indexOf(ch) !== -1) { out.push(buf); buf = ''; }
    }
    if (buf) out.push(buf);
    return out;
  }

  // 動作太長 → 從尾端整句丟,但含台詞的句子永不丟。丟到底還是超長就回 null(讓上層 throw)。
  function trimActionBySentence(action, budget) {
    if (action.length <= budget) return action;
    let sents = splitSentences(action);
    const dropped = [];
    while (sents.join('').length > budget && sents.length > 1) {
      const last = sents[sents.length - 1];
      if (quotedParts(last).length) break;          // 🔒 含台詞的句子不丟
      dropped.push(last.trim());
      sents.pop();
    }
    const joined = sents.join('').trim();
    if (dropped.length) console.warn('[KolEngine:kling] 分鏡過長,整句丟棄(未切字):', dropped.join(' / '));
    return (joined.length <= budget) ? joined : null;
  }

  // 🫀 RIIV⑤ 鐵律預警:情緒要「演出來」,不是「講出來」。模型看不懂「她很開心」。
  const TELL_WORDS = ['心裡', '心理', '雀躍', '很開心', '非常開心', '覺得', '感到', '感覺', '內心', '興奮不已', '她很', '他很'];
  function warnTellNotShow(action) {
    const hit = TELL_WORDS.filter(function (w) { return action.indexOf(w) !== -1; });
    if (hit.length) {
      console.warn('[KolEngine:kling] 🫀 這句用「講」的描述情緒(' + hit.join('、') + '),模型看不懂。'
        + '建議改成看得見的動作 —— ❌「她很開心」→ ✅「眼睛一亮,抓起鞋轉一圈」');
    }
  }

  // ★ 組裝:動作(不可切) + 錨詞(可整塊丟)
  function assemble(action, blocks) {
    warnTellNotShow(action);

    // 動作本身就爆 512 → 先試整句丟;還是不行 → throw(絕不偷偷砍台詞)
    if (action.length > SHOT_LIMIT) {
      const trimmed = trimActionBySentence(action, SHOT_LIMIT);
      if (trimmed === null) {
        throw new Error('這個鏡頭的分鏡文字太長(' + action.length + ' 字元,上限 ' + SHOT_LIMIT + ')'
          + ',而且含台詞不能截斷。請縮短分鏡或把台詞拆成兩個鏡頭。');
      }
      action = trimmed;
    }

    let out = action;
    const dropped = [];
    for (const b of blocks) {                 // blocks 已依優先級由高到低
      if (!b.text) continue;
      if ((out + b.text).length <= SHOT_LIMIT) out += b.text;
      else dropped.push(b.name);
    }
    // 到這裡 out 一定 <= SHOT_LIMIT(action 已保證合法,錨詞塞不下就不塞)
    if (dropped.length) console.warn('[KolEngine:kling] 512 預算不足,整塊丟棄:', dropped.join(' / '), '| 長度', out.length);
    return { text: out, dropped: dropped };
  }

  // ── 一個 beat → 一個 Kling shot 的 prompt。tags = 動態算好的 @ElementN 對照表。
  function buildShotPrompt(beat, opts, tags) {
    const action = ((typeof beat === 'string') ? beat : (beat.prompt || '')).trim();
    // 分段綁圖:這個 shot 綁哪一件商品(對齊 Seedance collectBeatProducts)
    const prodTag = tags.productOf ? tags.productOf(beat) : null;
    const r = assemble('@Element1 ' + action, [
      { name: '口音/音訊錨', text: opts.audioOn ? bAudio(opts.accent) : '' },   // 🔒 鐵律,優先級最高
      { name: '商品錨',     text: prodTag ? bProduct(prodTag) : '' },
      { name: '服裝錨',     text: tags.outfit ? bOutfit(tags.outfit) : '' },
      { name: '場景錨',     text: tags.scene ? bScene(tags.scene) : '' },
      { name: '寫實錨',     text: B_REALISM },
      { name: '眼神/生命感錨', text: B_EYES },
    ]);
    return r.text;
  }

  // ── 組 elements + 算 @ElementN 動態編號(沒商品時服裝就變 @Element2)
  function buildElements(seg) {
    const els = [];
    const tags = { outfit: null, scene: null, productTagByUrl: {} };

    // Element1 = 臉(正臉 + 多角度 reference)→ 解臉漂移,已驗證
    const faceEl = {};
    if (seg.kolFaceDriveId) faceEl.frontal_drive_id = seg.kolFaceDriveId;
    else faceEl.frontal_image_url = seg.kolImageUrl;
    const angleIds = Array.isArray(seg.kolAngleDriveIds) ? seg.kolAngleDriveIds.filter(Boolean).slice(0, 4) : [];
    const angleUrls = Array.isArray(seg.kolAngleUrls) ? seg.kolAngleUrls.filter(Boolean).slice(0, 4) : [];
    if (angleIds.length) faceEl.reference_drive_ids = angleIds;
    else if (angleUrls.length) faceEl.reference_image_urls = angleUrls;
    els.push(faceEl);

    // 商品(可多件 → 分段綁圖)。⚠️ elements 上限 4 → 臉+服裝+場景已佔 3,商品最多 1~3 件視情況。
    const prodIds = Array.isArray(seg.productDriveIds) ? seg.productDriveIds.filter(Boolean) : [];
    const prodUrls = Array.isArray(seg.productImageUrls) ? seg.productImageUrls.filter(Boolean) : [];
    const wantOutfit = !!(seg.outfitDriveId || seg.outfitImageUrl);
    const wantScene = !!(seg.sceneDriveId || seg.sceneImageUrl);
    const prodBudget = Math.max(0, MAX_ELEMENTS - 1 - (wantOutfit ? 1 : 0) - (wantScene ? 1 : 0));

    const prodList = prodIds.length
      ? prodIds.slice(0, prodBudget).map(function (id) { return { drive: id }; })
      : prodUrls.slice(0, prodBudget).map(function (u) { return { url: u }; });

    prodList.forEach(function (p, i) {
      const el = {};
      if (p.drive) el.frontal_drive_id = p.drive; else el.frontal_image_url = p.url;
      els.push(el);
      const key = p.drive || p.url;
      tags.productTagByUrl[key] = '@Element' + els.length;   // 動態編號
    });
    // 第一件商品固定是 @Element2(臉永遠 @Element1)
    tags.firstProductTag = prodList.length ? '@Element2' : null;

    // 服裝(共用資產②)
    if (wantOutfit) {
      const el = {};
      if (seg.outfitDriveId) el.frontal_drive_id = seg.outfitDriveId; else el.frontal_image_url = seg.outfitImageUrl;
      els.push(el);
      tags.outfit = '@Element' + els.length;
    }
    // 場景(共用資產④)
    if (wantScene) {
      const el = {};
      if (seg.sceneDriveId) el.frontal_drive_id = seg.sceneDriveId; else el.frontal_image_url = seg.sceneImageUrl;
      els.push(el);
      tags.scene = '@Element' + els.length;
    }

    // 分段綁圖:beat.productUrl / beat.productDriveId → 對應到它自己的 @ElementN
    tags.productOf = function (beat) {
      if (!prodList.length) return null;
      if (typeof beat !== 'object') return tags.firstProductTag;
      const key = beat.productDriveId || beat.productUrl;
      if (key && tags.productTagByUrl[key]) return tags.productTagByUrl[key];
      return (beat.productUrl || beat.productDriveId) ? tags.firstProductTag : null;
    };
    return { elements: els, tags: tags };
  }

  async function submitSegment(seg) {
    if (!seg.kolFaceDriveId && !seg.kolImageUrl) throw new Error('KolEngine(kling):缺少 kolFaceDriveId 或 kolImageUrl');

    let beats = (Array.isArray(seg.beats) && seg.beats.length)
      ? seg.beats.map(function (b) { return (typeof b === 'string') ? { prompt: b } : b; })
      : (seg.prompt ? [{ prompt: seg.prompt }] : null);
    if (!beats) throw new Error('KolEngine(kling):缺少 beats/prompt(這段的動作)');
    if (beats.length > MAX_SHOTS) beats = beats.slice(0, MAX_SHOTS);

    const accent = accentOf(seg);
    const audioOn = seg.generateAudio === true;
    const built = buildElements(seg);
    const opts = { accent: accent, audioOn: audioOn };

    const multiPrompt = beats.map(function (b) {
      const dur = (typeof b === 'object' && b.durationSec)
        ? b.durationSec
        : Math.max(1, Math.round((seg.totalSec || 5) / beats.length));
      let p = buildShotPrompt(b, opts, built.tags);
      return { prompt: p, duration: String(snapSec(dur)) };   // ⚠️ snap 到 5/8/10/15
    });

    // shared.front / shared.tail(B 版精簡敘事):塞不進 512 就自動被 assemble 擋掉,不會壞。
    if (seg.shared && seg.shared.front && multiPrompt[0]) {
      const merged = seg.shared.front + ' ' + multiPrompt[0].prompt;
      if (merged.length <= SHOT_LIMIT) multiPrompt[0].prompt = merged;
      else console.warn('[KolEngine:kling] shared.front 塞不進 512,已略過');
    }

    const sub = await callWorker('kling_submit', {
      endpoint: ENDPOINT,
      startDriveId: seg.kolFaceDriveId || undefined,
      startImageUrl: seg.kolFaceDriveId ? undefined : seg.kolImageUrl,
      elements: built.elements,
      multiPrompt: multiPrompt,
      shotType: 'customize',
      totalSec: String(snapSec(seg.totalSec || 5)),        // ⚠️ snap 到 5/8/10/15
      aspectRatio: seg.aspectRatio || '9:16',       // ⚠️ 模型忽略;比例由首幀圖決定
      resolution: seg.resolution || '720p',
      generateAudio: audioOn,
      negativePrompt: seg.negativePrompt || NEGATIVE,
      cfgScale: (typeof seg.cfgScale === 'number') ? seg.cfgScale : CFG_SCALE,
      seed: seg.seed,                                // 🐛 v1.3 修:跨段共用 seed(對齊 Seedance)
      brandId: seg.brandId,
      kolName: seg.kolName
    });

    if (!sub || !sub.requestId) throw new Error('KolEngine(kling):Worker 沒回 requestId(' + JSON.stringify(sub).slice(0, 300) + ')');
    return { requestId: sub.requestId, engine: 'kling', endpoint: ENDPOINT, r2Refs: sub.r2Refs };
  }

  window.KolEngines = window.KolEngines || {};
  window.KolEngines.kling = {
    id: 'kling',
    label: '敘事寫實 · 真人臉動作鎖',   // 客戶前台的風格化名稱(不露引擎名)
    endpoint: ENDPOINT,
    submitSegment: submitSegment,
    negativePrompt: NEGATIVE,
    // 除錯:看每 shot prompt、字數、@Element 對照。不送 fal、不燒點數。
    _preview: function (beats, seg) {
      seg = seg || {};
      const built = buildElements(Object.assign({ kolFaceDriveId: 'FACE' }, seg));
      const accent = accentOf(seg);
      const list = (Array.isArray(beats) ? beats : [beats]).map(function (b) { return (typeof b === 'string') ? { prompt: b } : b; });
      console.log('elements 數:', built.elements.length,
        '| 服裝=', built.tags.outfit || '無', '| 場景=', built.tags.scene || '無',
        '| 商品=', built.tags.firstProductTag || '無');
      return list.map(function (b, i) {
        const p = buildShotPrompt(b, { accent: accent, audioOn: seg.generateAudio === true }, built.tags);
        return { shot: i + 1, len: p.length, ok: p.length <= SHOT_LIMIT, prompt: p };
      });
    }
  };

  console.log('[KolEngine] 🎥 攝影師② Kling v1.5 已註冊 · window.KolEngines.kling · '
    + '🐛修seed共用 · 👗服裝+🌆場景 element(共用資產·動態@ElementN編號) · 📦分段綁圖 · '
    + '🔒Seedance跨段鎖定條款搬negative_prompt(光向/色調/不換人場衣/no crowd·0字元成本) · 👁眼神塊 · '
    + '📏每shot上限512→三層保護(🔒台詞絕不動·動作整句丟不切字·錨詞整塊丟) · 🫀情緒要演不要講(RIIV⑤預警) · cfg_scale=' + CFG_SCALE + ' · 口音鐵律(Taiwanese Mandarin) · '
    + '⏱duration自動snap(5/8/10/15) · ⚠️elements上限4 · ⚠️單張資產element會在轉向時變形(需三視圖) · ⚠️Kling並發=1→排隊跑');
})();
