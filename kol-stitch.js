// ==========================================================================
// kol-stitch.js — 自動接片引擎 v6.4
// v6.2：照分鏡秒數切 15 秒 chunk + 每個 chunk 用自己的角度圖 + beat 當 Shot(對齊 STEP2/STEP3 的 plan)。每段 = 多鏡頭 reference-to-video,原始 KOL 照當 [Image1] 鎖臉
//       Seedance 2.0 reference-to-video,臉由模型層鎖死 → 跨段同一個又晴本人(不重畫、不換臉)。
//         · [Image1] = 又晴原圖   → 鎖臉(這是她舊片臉永遠對的原因)
//         · [SCENE_IMG]→[ImageN]  → 鎖家具/背景(空場景參考圖)
//         · [OUTFIT_IMG]→[ImageN] → 鎖服裝(無臉假人圖)
//         · 商品照            → 一起餵,鎖商品
//       走 seedance_submit(Worker 既有 reference-to-video action)+ webhook(episode_result)。
//       ⛔ 棄用:v5.x 的 nanobanana compose / image-to-video / 定裝照 anchor / pixverse 換臉 ——
//          那條會「每段重畫臉」→ 變不同人/第三個人(本場實測全失敗)。臉永遠交給原圖,不重畫。
// --------------------------------------------------------------------------
// v4.1：口音鐵律鎖 —— 在所有分段的唯一出海口送 fal 前,自動補口音(擋大陸腔)。
// v4.0：webhook 背景生成。v3.0：平行 —— 每段彼此不依賴 → 全部同時送、同時跑。
// --------------------------------------------------------------------------
// 設計原則:底層一次做對,半自動 / 全自動共用同一套。UI 只是薄薄一層。
// ==========================================================================
window.KolStitch = (function () {
  'use strict';

  // 🎯 v6.8:B(精簡敘事)定案為唯一預設路徑 —— 沒人手動關,接片就一律走 B。
  //   kol.html 那兩處 _shared 讀的是 window.LEAN_STITCH;這裡載入時補上預設 = true,
  //   所以 kol.html 一個字都不用改。(臨時要退回 A 版除錯才在 Console 設 window.LEAN_STITCH = false)
  if (typeof window !== 'undefined' && window.LEAN_STITCH === undefined) window.LEAN_STITCH = true;

  // ---- 設定 ---------------------------------------------------------------
  const cfg = {
    workerUrl: 'https://kol-proxy.calm-sunset-6b66.workers.dev',
    password: 'raby2026', // Worker 每個 POST 都驗密碼,少了會被擋「密碼錯誤」
    pollIntervalMs: 5000,
    pollMaxTries: 240,    // 5s × 240 = 20 分鐘上限
    pollTask: null,
  };
  function init(options) { Object.assign(cfg, options || {}); return cfg; }

  // ---- 底層工具 -----------------------------------------------------------

  // 打 Worker(所有 action 共用同一條)
  async function api(action, params) {
    const payload = Object.assign({ action }, params || {});
    payload.password = cfg.password;   // 每個請求都要帶密碼
    const res = await fetch(cfg.workerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    let data;
    try { data = await res.json(); }
    catch (e) { throw new Error(`[${action}] 回應不是 JSON（HTTP ${res.status}）`); }
    if (data && data.ok === false) throw new Error(`[${action}] ${data.error || '未知錯誤'}`);
    return data;
  }

  // 從任意回傳撈 URL：fal_poll 對不同任務用不同欄位（videoUrl / imageUrl / rawResult）
  function pickUrl(r) {
    if (!r) return null;
    var u = r.videoUrl || r.imageUrl ||
            (r.video && r.video.url) || r.video_url ||
            (r.images && r.images[0] && r.images[0].url) ||
            (r.image && r.image.url) ||
            (r.output && r.output.video && r.output.video.url) ||
            r.url || null;
    if (u) return u;
    if (r.rawResult) {
      try {
        var o = JSON.parse(r.rawResult);
        return o.video_url ||
               (o.video && o.video.url) ||
               (o.images && o.images[0] && o.images[0].url) ||
               (o.image && o.image.url) || null;
      } catch (e) {}
    }
    return null;
  }

  // webhook 輪詢 —— 問 episode_result(seedance_submit / video_compose 路徑用)。
  async function pollEpisode(reqId, brandId, onTick) {
    if (!reqId) throw new Error('pollEpisode 缺少 reqId');
    const brand = brandId || 'unknown';
    for (let i = 0; i < cfg.pollMaxTries; i++) {
      try {
        const r = await api('episode_result', { brandId: brand, reqId });
        const st = String(r.status || 'pending').toLowerCase();
        if (st === 'done' && r.videoUrl) return r.videoUrl;
        if (st === 'failed') throw new Error('生成失敗：' + (r.error || '未知'));
        if (onTick) onTick(i, st);
      } catch (e) {
        if (String((e && e.message) || '').indexOf('生成失敗') !== -1) throw e;
      }
      await new Promise(res => setTimeout(res, cfg.pollIntervalMs));
    }
    throw new Error('等待逾時(超過 ' + (cfg.pollMaxTries * cfg.pollIntervalMs / 60000) + ' 分鐘還沒回來)');
  }

  // fal_poll 輪詢 —— 舊路徑/extractLastFrame 用(v5.1 的 i2v 已改 webhook,這條保留不刪)。
  async function defaultPoll(submitResult, onTick) {
    const { requestId, endpoint, statusUrl, responseUrl } = submitResult;
    for (let i = 0; i < cfg.pollMaxTries; i++) {
      const s = await api('fal_poll', { requestId, endpoint, statusUrl, responseUrl });
      const url = pickUrl(s);
      if (url) return Object.assign({}, s, { _url: url });
      const status = String(s.status || '').toUpperCase();
      if (status === 'FAILED' || status === 'ERROR')
        throw new Error('生成失敗：' + JSON.stringify(s).slice(0, 300));
      if (onTick) onTick(i, status || 'IN_PROGRESS');
      await new Promise(r => setTimeout(r, cfg.pollIntervalMs));
    }
    throw new Error('輪詢逾時（超過 ' + (cfg.pollMaxTries * cfg.pollIntervalMs / 60000) + ' 分鐘）');
  }
  function poll(submitResult, onTick) {
    return (cfg.pollTask || defaultPoll)(submitResult, onTick);
  }

  // ---- 積木 ---------------------------------------------------------------

  // 抽尾幀（舊路徑用,保留）
  async function extractLastFrame(videoUrl, onTick) {
    const sub = await api('extract_frame', { videoUrl, frameType: 'last' });
    const done = await poll(sub, onTick);
    const url = pickUrl(done);
    if (!url) throw new Error('抽尾幀沒拿到圖片 URL');
    return url;
  }

  // v6.2 多鏡頭 prompt:一次生成、內含多個 Shot(角度切換),家具/臉跨鏡頭鎖。
  //   beats = [{prompt, durationSec}] 或字串陣列;timecode 照每個 beat 的真實秒數排(尊重分鏡)。
  //   [Image1]=KOL角度圖(臉錨)· [SCENE_IMG]=同一間房 · [OUTFIT_IMG]=同一件衣服(Worker 換成真 [ImageN])。
  // 🆕 分段綁圖:從 beats 收集「每段各自的商品圖」,去重保序,回傳 url→[ImageN] 對照。
  //   [Image1] 固定是臉 → 商品從 [Image2] 起算,順位 k 的商品 = [Image(k+2)]。
  //   沒有 beat 帶 productUrl → 走原本「全片一個商品」舊路(向後相容)。
  function collectBeatProducts(beats) {
    const list = (beats || []).map(function (b) { return (typeof b === 'string') ? {} : (b || {}); });
    const urls = []; const idx = {};
    list.forEach(function (b) {
      const u = b.productUrl;
      if (u && idx[u] === undefined) { idx[u] = urls.length; urls.push(u); }
    });
    return {
      urls: urls,
      has: urls.length > 0,
      tagOf: function (u) { return (u && idx[u] !== undefined) ? ('[Image' + (idx[u] + 2) + ']') : ''; }
    };
  }

  function buildMultiShotPrompt(beats, totalSec, shared, continuityFrom) {
    const list = beats.map(function (b) { return (typeof b === 'string') ? { prompt: b } : b; });
    const n = Math.max(1, list.length);
    const dur = totalSec || 15;
    const pad = function (x) { return String(Math.round(x)).padStart(2, '0'); };
    const bp = collectBeatProducts(list);   // 🆕 分段綁圖

    const carry = continuityFrom
      ? ('Continuing seamlessly from the previous moment — she has just ' + continuityFrom
         + '. Pick up the action naturally from exactly that point; do NOT restart, reset or re-establish the scene.\n\n')
      : '';

    if (shared && shared.front) {
      const prodRule = bp.has
        ? 'in each shot she holds the specific product image referenced in that shot, kept at a consistent real-world size and the same scale relative to her hand within that shot — do not zoom or resize the product inside a shot; different shots deliberately show different products exactly as specified; '
        : 'the snack package she holds is the exact same physical object kept at the exact same real-world size and the same scale relative to her hand in every single shot — never bigger or smaller, never zoomed or resized between cuts, do not change the product size anywhere across the video; ';
      let bodyB = shared.front + '\n'
        + 'Across all shots: the SAME woman [Image1], the same location [SCENE_IMG], the same outfit [OUTFIT_IMG], '
        + prodRule
        + 'one unified colour grade and the same lighting across every cut — no change of person, scene, outfit or lighting, '
        + 'no smoothing or beautifying, no crowd.\n\n'
        + carry;
      let tb = 0;
      for (let i = 0; i < n; i++) {
        const bSecB = list[i].durationSec || Math.max(1, Math.round(dur / n));
        const tb0 = tb, tb1 = (i === n - 1) ? dur : Math.min(dur, tb + bSecB);
        const markerB = (i === 0) ? 'Shot 1' : ('Hard cut to Shot ' + (i + 1));
        const _tagB = bp.tagOf(list[i].productUrl);
        const _prodB = _tagB ? (' She is holding ' + _tagB + ' — this exact product in this shot.') : '';
        bodyB += '[00:' + pad(tb0) + '-00:' + pad(tb1) + '] ' + markerB + ': [Image1] ' + (list[i].prompt || '') + _prodB + '\n';
        tb = tb1;
      }
      bodyB += '\nHer face has natural matte skin with no oily shine, no greasy T-zone and no hot specular highlights — the light on her face is soft, even and gentle, exactly as understated as the light on her hands and arms, never glossy or over-lit. While speaking she looks directly into the camera lens and makes genuine eye contact, with bright lively expressive eyes that have clear catchlights and real sparkle — her gaze is warm, alert and emotionally present, subtly brightening and widening on the words she emphasises, with natural blinking and tiny lifelike micro-expressions around the eyes and cheeks, never a blank dead fish-eyed stare and never empty or unfocused; her gaze flows and shifts naturally with what she is saying — small natural eye movements that drift briefly and return to the lens, NOT a rigid fixed stare locked on a single spot. Her expression flows and changes continuously like a real person — any emotion such as surprise, delight or excitement appears only as a brief fleeting beat that immediately transitions naturally into the next expression, word or action; she NEVER holds one exaggerated frozen expression, never freezes or locks her face into a static pose, and never keeps the same surprised or wide-eyed look for more than about a second. She delivers the written line naturally and lets it land on its own; the written line inside the quotes is the COMPLETE and ONLY speech for the whole shot; the instant those quoted words end, her speech is finished and there is NO further voice, NO extra words, NO improvised prices, NO mumbling and NO filler syllables of any kind for the rest of the shot — silence except natural ambient sound.';
      if (shared.tail) bodyB += '\n' + shared.tail;
      return bodyB;
    }

    let body = 'candid realistic vertical UGC video, natural daylight, true-to-life skin.\n'
      + "Use [Image1] for the woman's face and identity. She is in the exact location of [SCENE_IMG], "
      + 'wearing the exact outfit of [OUTFIT_IMG], naturally holding and showing the product.\n\n'
      + carry;
    let t = 0;
    for (let i = 0; i < n; i++) {
      const bSec = list[i].durationSec || Math.max(1, Math.round(dur / n));
      const t0 = t;
      const t1 = (i === n - 1) ? dur : Math.min(dur, t + bSec);
      const marker = (i === 0) ? 'Shot 1' : ('Hard cut to Shot ' + (i + 1));
      const _tagA = bp.tagOf(list[i].productUrl);
      const _prodA = _tagA ? (' She is holding ' + _tagA + ' — this exact product in this shot.') : '';
      body += '[00:' + pad(t0) + '-00:' + pad(t1) + '] ' + marker
        + ': the SAME woman [Image1] in the SAME location [SCENE_IMG] with the SAME background, wearing [OUTFIT_IMG]. '
        + (list[i].prompt || '') + _prodA + '\n';
      t = t1;
    }
    body += '\nGlobal: it is the same woman, the same location and the same background across all shots; '
      + 'keep the exact same lighting in every shot — the same light direction, intensity and colour temperature, matching the setting (indoor or outdoor) — and do not change the lighting between cuts; '
      + 'camera mostly steady; realistic unretouched skin with real texture; '
      + 'keep her face exactly [Image1]; do not change her face, the location, the background or the outfit between cuts. '
      + 'No change of setting, no different person, no smoothing or beautifying, no crowd.';
    return body;
  }

  // 🆕 分段綁圖 1a 自測(不花錢):console 打 _testMultiShoe()
  window._testMultiShoe = function () {
    const fake = [
      { prompt: 'shows the shoe: "太好穿了!"', durationSec: 5, productUrl: 'FILA.jpg' },
      { prompt: 'picks up another: "這雙也是!"', durationSec: 5, productUrl: 'CHAMPION.jpg' },
      { prompt: 'smiles at camera', durationSec: 5, productUrl: 'FILA.jpg' }
    ];
    const bp = collectBeatProducts(fake);
    const p = buildMultiShotPrompt(fake, 15, { front: 'TEST realism anchor.' });
    console.log('=== 送 Seedance 的商品圖順序([Image1]=臉,之後才是商品)===');
    bp.urls.forEach(function (u, i) { console.log('  [Image' + (i + 2) + '] = ' + u); });
    console.log('=== 生成的 prompt ===\n' + p);
    return { productUrls: bp.urls, prompt: p };
  };

  // 生一段(v6.2:一次生成多鏡頭 reference-to-video。chunk 內含多個 beat(Shot),
  //   每個 beat 帶自己的動作+秒數;chunk 總長 = 各 beat 秒數加總(封頂 15)。
  //   臉=[Image1](該 chunk 的 KOL 角度圖,模型層鎖)+ 場景圖 + 服裝圖 + 商品。不重畫、不換臉。
  //   相容:opts.beats(物件陣列,STEP2/STEP3 用)> opts.shots(字串陣列)> opts.prompt(單一)。
  // 🚦 v7.0 提交序列化(根治 10058):所有 seedance_submit「一段一段送」,不是同時送。
  //   根因=Worker 把同一批參考圖搬 R2,用「內容固定檔名」去重;6 段同時送 → 同一瞬間都看到
  //   「檔名還沒存」→ 6 個一起 PUT 同一個 R2 物件 → R2 回「同物件並發太高」(10058)。
  //   序列化後:第 1 段把共用圖搬好,第 2~6 段去重直接 head 命中、跳過 PUT → 又快又不可能撞。
  //   只序列化「送出」這一下;送出拿到 requestId 後的輪詢(pollEpisode)照樣全部平行 → 生成總時間幾乎不變。
  let _submitChain = Promise.resolve();
  // ---- 🆕 v6.5 多角度臉參考表(攝影師② Kling 鎖臉用)-------------------------
  //  Drive「已處理」子夾裡的 {KOL名}_sheet_{角度}_{日期}.jpg
  //    · _sheet_front_ → 正臉(首幀 + Element1 正面)
  //    · 其餘 _sheet_  → 多角度 reference(profile / q34 …)→ 這是解「臉漂移」的關鍵
  //  ⚠️ 只回 file_id,不回 thumbnail_url:listKolPhotos 對「已處理」夾只給 w400 縮圖,
  //     縮圖絕不能餵引擎(鐵律)。file_id → Worker transferDriveToR2 才拿得到乾淨原圖。
  const _sheetCache = {};
  async function resolveKolSheet(brandId, kolName) {
    if (!brandId || !kolName) throw new Error('resolveKolSheet 缺少 brandId 或 kolName');
    const key = brandId + '::' + kolName;
    if (_sheetCache[key]) return _sheetCache[key];

    const d = await api('gas_cached', { gasAction: 'listKolPhotos', gasParams: { brandId: brandId } });
    const p = (d.personas || []).find(function (x) { return x.persona_name === kolName; });
    if (!p) throw new Error('在品牌「' + brandId + '」的相片夾找不到 KOL「' + kolName + '」');

    const all = [].concat(p.photos || [], p.processed_photos || []);
    const sheets = all.filter(function (x) { return x.name && x.name.indexOf('_sheet_') !== -1; });
    if (!sheets.length) {
      throw new Error('KOL「' + kolName + '」還沒有多角度臉參考表(檔名需含 _sheet_)。'
        + '沒有多角度圖時 Kling 的臉會在講話/動作中漂移 → 請先生成參考表再用攝影師②。');
    }
    const front = sheets.find(function (x) { return x.name.indexOf('_sheet_front') !== -1; }) || sheets[0];
    const angles = sheets.filter(function (x) { return x !== front; }).slice(0, 4);   // 不過載:最多 4 張

    const out = {
      faceId: front.file_id,
      angleIds: angles.map(function (x) { return x.file_id; }),
      _names: { front: front.name, angles: angles.map(function (x) { return x.name; }) }
    };
    _sheetCache[key] = out;
    return out;
  }

  function queuedSubmit(fn) {
    const p = _submitChain.then(function () { return fn(); });
    _submitChain = p.then(function () {}, function () {});   // 一段送出失敗也不卡住後面那幾段
    return p;
  }

  async function generateSegment(opts, onTick) {
    if (!opts.kolImageUrl) throw new Error('generateSegment 缺少 kolImageUrl（KOL 角度圖）');
    let beats = (Array.isArray(opts.beats) && opts.beats.length) ? opts.beats
              : (Array.isArray(opts.shots) && opts.shots.length) ? opts.shots.map(function (s) { return { prompt: s }; })
              : (opts.prompt ? [{ prompt: opts.prompt }] : null);
    if (!beats) throw new Error('generateSegment 缺少 beats/shots/prompt（這個 chunk 的動作）');

    // chunk 總長 = 各 beat 秒數加總,封頂 15(Seedance 單次上限);沒給秒數 → 預設每 beat 5 秒。
    let totalSec = beats.reduce(function (a, b) {
      return a + ((typeof b === 'object' && b.durationSec) ? b.durationSec : 5);
    }, 0);
    totalSec = Math.max(3, Math.min(15, totalSec || 15));

    // ═══ 🆕 v6.5 引擎切換層 ═══════════════════════════════════════════════
    //  一個攝影師一個檔:opts.engine 指定 → 交給 window.KolEngines[engine].submitSegment。
    //  沒指定(或找不到模組)→ 原封不動走下面的 Seedance 老路(攝影師①,一個字沒改)。
    //  輪詢/接片共用:pollEpisode 走 webhook + reqId,與引擎無關。
    if (opts.engine && opts.engine !== 'seedance') {
      const _eng = window.KolEngines && window.KolEngines[opts.engine];
      if (!_eng || typeof _eng.submitSegment !== 'function') {
        throw new Error('找不到攝影師模組「' + opts.engine + '」,請確認 kol-engine-' + opts.engine + '.js 已載入');
      }
      // 多角度臉參考表 → Element1 鎖臉(解臉漂移)。撈不到會 throw,不會默默退回單圖。
      if (onTick) onTick(0, '讀取多角度臉參考表…');
      const _sheet = await resolveKolSheet(opts.brandId, opts.kolName);

      if (onTick) onTick(0, (_eng.label || opts.engine) + '(多角度鎖臉)');
      const _bp = collectBeatProducts(beats);
      const _sub = await queuedSubmit(function () {
        return _eng.submitSegment({
          kolFaceDriveId: _sheet.faceId,          // 正臉(首幀 + Element1)
          kolAngleDriveIds: _sheet.angleIds,      // 多角度 → reference,鎖臉關鍵
          kolImageUrl: opts.kolImageUrl,          // fallback:沒 driveId 時才用
          productImageUrls: _bp.has ? _bp.urls : (Array.isArray(opts.productImageUrls) ? opts.productImageUrls : []),
          outfitImageUrl: opts.outfitImageUrl || undefined,   // MVP 暫不塞 element(資產不過載),保留欄位
          sceneImageUrl: opts.sceneImageUrl || undefined,
          beats: beats,
          totalSec: totalSec,
          aspectRatio: opts.aspectRatio || '9:16',
          resolution: opts.resolution || '720p',
          generateAudio: opts.generateAudio === true,
          seed: opts.seed,
          brandId: opts.brandId,
          kolName: opts.kolName,
          nationality: opts.nationality,
        });
      });
      const _url = await pollEpisode(_sub.requestId, opts.brandId, onTick);
      if (!_url) throw new Error('攝影師「' + opts.engine + '」沒拿到影片 URL');
      return _url;
    }
    // ═══ 以下 = 攝影師① Seedance 原路(未更動)═════════════════════════════

    let prompt = buildMultiShotPrompt(beats, totalSec, opts.shared, opts.continuityFrom);

    // 🔒 口音 + 口型鐵律(v6.4):開語音時,只有「有台詞的鏡頭」才說話+對嘴;
    //   沒台詞的鏡頭(吃/咀嚼/拿商品/純反應)→ 不講話、嘴不動、只有環境音 → 解決「邊吃邊有人聲」desync。
    if (opts.generateAudio === true && !/lip-sync/i.test(prompt)) {
      const _nat = opts.nationality
        || (window.S && window.S.selectedKol && window.S.selectedKol.persona && window.S.selectedKol.persona.nationality)
        || 'tw';
      const _accent = (typeof window.natToAccent === 'function') ? window.natToAccent(_nat) : 'Taiwanese Mandarin';
      prompt += '\nAudio & lip-sync: she speaks ONLY the spoken dialogue explicitly written in a shot, in natural ' + _accent
        +  ' at a natural conversational speaking pace — she does NOT stretch words, slow down unnaturally, or insert pauses between individual words just to fill the shot duration; the speech stays smooth and continuous as if a real person is talking normally. Every syllable is articulated clearly and distinctly — brand names, product names and numbers are pronounced precisely and cleanly, never slurred, blended or mumbled — with brief natural pauses of 200-400 milliseconds between phrases, subtle natural mouth movements, and absolutely no exaggerated or mechanical robotic delivery. She says EXACTLY the written dialogue word for word and nothing else — do NOT improvise, invent, add, drop, repeat or alter any words, numbers or prices, and do NOT generate any speech that was not written. With clear lip-sync. In any shot with NO written dialogue (eating, chewing, tasting, holding or showing the product, or simply reacting) she does NOT speak — her mouth does not form words, there is no voice-over, only natural ambient sound. After her final spoken line ends she does NOT freeze, stiffen or stand still — she keeps natural closing body language (a warm smile, a small nod, casually showing the product, or turning back to what she was doing) flowing until the very last frame of the shot.'
      prompt += '\nLiving-body realism: she is never statue-still. While speaking, her body talks with her — free hand gestures naturally with the rhythm of her words, weight shifts subtly from foot to foot, small head nods and tilts follow her sentences, eyebrows and eyes react to what she is saying. Her gaze behaves like a real person on camera: glancing down at the product, back up to the lens, briefly aside while thinking, with natural relaxed blinking — never a fixed unblinking stare into the camera. Any walking or turning follows real human gait mechanics: shoulders sway gently with each step, hips alternate weight, arms swing slightly, and each movement carries momentum into the next (natural inertia, no robotic stops).';
    }

    // reference-to-video:KOL臉=[Image1] 鎖身份 + 商品 + 服裝 + 場景(最多9張)。
    //   Worker 自動把 [OUTFIT_IMG]/[SCENE_IMG] 換成真實 [ImageN]。
    if (onTick) onTick(0, 'reference-to-video(多鏡頭)');
    const _segProducts = collectBeatProducts(beats);   // 🆕 分段綁圖:beats 帶鞋 → 用它組圖(順序對齊 prompt)
    const sub = await queuedSubmit(function () { return api('seedance_submit', {
      kolImageUrl: opts.kolImageUrl,                                       // → [Image1] 臉錨(該 chunk 的角度圖)
      productImageUrls: _segProducts.has ? _segProducts.urls : (Array.isArray(opts.productImageUrls) ? opts.productImageUrls : []),
      outfitImageUrl: opts.outfitImageUrl || undefined,                    // → [OUTFIT_IMG]→[ImageN]
      sceneImageUrl: opts.sceneImageUrl || undefined,                      // → [SCENE_IMG]→[ImageN]
      prompt: prompt,
      brandId: opts.brandId,
      kolName: opts.kolName,
      duration: String(totalSec),                                          // v6.2:照分鏡秒數加總(封頂 15)
      aspectRatio: opts.aspectRatio || '9:16',
      resolution: opts.resolution || '720p',
      generateAudio: opts.generateAudio === true,
      tier: opts.tier || 'fast',
      seed: opts.seed,
      // 不傳 episodeId → 每段 keyed by 自己 reqId,平行不撞 key
    }); });

    const videoUrl = await pollEpisode(sub.requestId, opts.brandId, onTick);
    if (!videoUrl) throw new Error('reference-to-video 沒拿到影片 URL');
    return videoUrl;
  }

  // 接片：多段 → 一條(webhook,不變)
  async function composeSegments(segments, brandId, onTick) {
    if (typeof brandId === 'function') { onTick = brandId; brandId = undefined; }
    if (!Array.isArray(segments) || segments.length < 2)
      throw new Error('composeSegments 至少要 2 段');
    const sub = await api('video_compose', { segments, brandId: brandId });
    const url = await pollEpisode(sub.requestId, brandId, onTick);
    if (!url) throw new Error('接片沒拿到影片 URL');
    return url;
  }

  // 成品搬 R2(不變)
  async function toR2(videoUrl, brandId, nameHint) {
    try {
      const r = await api('video_to_r2', {
        videoUrl,
        brandId: brandId || 'stitch',
        nameHint: nameHint || 'final',
      });
      return (r && r.url) ? r.url : videoUrl;
    } catch (e) {
      console.warn('[KolStitch] R2 存檔失敗,改用原網址', e);
      return videoUrl;
    }
  }

  // ---- 流程控制：半自動 / 全自動共用 ---------------------------------------
  // plan: [{ prompt(這段動作), durationSec?, seed?, kolImageUrl? }, ...]
  async function runStitchFlow(plan, opts) {
    opts = opts || {};
    const log = opts.onProgress || function () {};
    const kolImg = opts.kolImageUrl || opts.startImageUrl;
    if (!kolImg) throw new Error('缺少 kolImageUrl(原始 KOL 照,每段都當錨點)');
    if (!Array.isArray(plan) || plan.length < 1) throw new Error('plan 至少要 1 段');

    // v6.2:把分鏡整理成 chunks —— 照「累積秒數 ≤15s 且 Shot 數 ≤maxShots」切,每個 chunk = 一次多鏡頭生成。
    //   傳 [{shots:[...]}] 直接用;傳一串 beat 物件(STEP2/STEP3:{prompt,durationSec,kolImageUrl,...})→ 照秒數併。
    const MAX_CHUNK_SEC = opts.maxChunkSec || 15;   // 一個 chunk 上限 15 秒(Seedance 單次上限)
    const MAX_SHOTS = opts.shotsPerChunk || 4;      // 一個 chunk 最多幾個 Shot(避免太碎)
    let chunks;
    if (plan[0] && Array.isArray(plan[0].shots)) {
      chunks = plan.map(function (c) {
        return { beats: c.shots.map(function (s) { return (typeof s === 'string') ? { prompt: s } : s; }), kolImageUrl: c.kolImageUrl, seed: c.seed };
      });
    } else {
      const beatObjs = plan.map(function (p) { return (typeof p === 'string') ? { prompt: p } : p; })
                           .filter(function (b) { return b && b.prompt; });
      chunks = [];
      let cur = [], curSec = 0;
      beatObjs.forEach(function (b) {
        const bSec = b.durationSec || 5;
        if (cur.length && (curSec + bSec > MAX_CHUNK_SEC || cur.length >= MAX_SHOTS)) {
          chunks.push({ beats: cur }); cur = []; curSec = 0;
        }
        cur.push(b); curSec += bSec;
      });
      if (cur.length) chunks.push({ beats: cur });
    }

    // 🛡️ v6.4 防呆:分鏡未確認前,先攤開「要生幾段·幾秒·每段開頭」給看,留一次喊停的機會(擋掉誤燒 90 秒=6 段 fal 額度)。
    //    程式化呼叫(無 UI)可傳 opts.confirmed = true 略過此檢查。
    if (!opts.confirmed && typeof window !== 'undefined' && typeof window.confirm === 'function') {
      const _segSec = chunks.map(function (c) {
        return (c.beats || []).reduce(function (a, b) { return a + (b.durationSec || 5); }, 0) || 0;
      });
      const _totalSec = _segSec.reduce(function (a, b) { return a + b; }, 0);
      const _lines = chunks.map(function (c, i) {
        const _head = (((c.beats && c.beats[0] && c.beats[0].prompt) || '(空)') + '').slice(0, 30);
        return '  第' + (i + 1) + '段(' + _segSec[i] + 's):' + _head + '…';
      }).join('\n');
      const _ok = window.confirm(
        '⚠️ 確認分鏡再生成(會消耗 fal 額度)\n\n' +
        '共 ' + chunks.length + ' 段、約 ' + _totalSec + ' 秒:\n' + _lines +
        '\n\n確定用這個分鏡開始生成嗎?'
      );
      if (!_ok) {
        log('🛑 已取消:分鏡未確認,沒有送出任何生成。');
        throw new Error('STORYBOARD_NOT_CONFIRMED');  // 呼叫端 try/catch 接住 → 顯示「已取消」即可
      }
      log('✅ 分鏡已確認,開始生成。');
    }

    const total = chunks.length;
    let doneCount = 0;
    log(`${total} 段 × 15 秒多鏡頭同時生成中…(平行,reference-to-video · 臉=[Image1] 原圖鎖 · 場景圖鎖家具)`);

    // 整支共用同一 seed → 6 張 keyframe 彼此更一致
    const stitchSeed = (opts.seed != null && opts.seed !== '')
      ? parseInt(opts.seed)
      : ((chunks[0] && chunks[0].seed != null && chunks[0].seed !== '')
          ? parseInt(chunks[0].seed)
          : Math.floor(Math.random() * 2000000000));
    log('本支共用 seed:' + stitchSeed);

    // 服裝參考圖(整支生一次,當 compose 的輸入之一)
    let outfitImageUrl = opts.outfitImageUrl || null;
    try {
      if (!outfitImageUrl && window.KolWardrobe && typeof window.KolWardrobe.generateOutfitRefImage === 'function') {
        const outfitCtx = opts.outfitCtx || {
          outfitBrand: (window.S && window.S.selectedOutfitBrand) || '',
          sceneId: (window.S && window.S.selectedSceneId) || '',
        };
        log('生成服裝參考圖中…(當 compose 輸入,鎖跨段衣服)');
        outfitImageUrl = await window.KolWardrobe.generateOutfitRefImage(outfitCtx);
      }
    } catch (e) { outfitImageUrl = null; }

    // 場景參考圖(整支生一次,當 compose 的輸入之一)
    let sceneImageUrl = opts.sceneImageUrl || null;
    try {
      if (!sceneImageUrl && window.KolEnvironment && typeof window.KolEnvironment.generateSceneRefImage === 'function') {
        const sceneCtx = opts.sceneCtx || {
          brandId: opts.brandId || (window.S && window.S.currentBrandId) || '',
          sceneId: (window.S && window.S.selectedSceneId) || '',
          locationId: (window.S && window.S.selectedLocationId) || 'none',
        };
        log('生成場景參考圖中…(當 compose 輸入,鎖跨段背景)');
        sceneImageUrl = await window.KolEnvironment.generateSceneRefImage(sceneCtx);
      }
    } catch (e) { sceneImageUrl = null; }

    log(`參考圖鎖定完成 ✓ · ${total} 段 × 15 秒多鏡頭生成中…(臉=[Image1]原圖 · 家具=同一張場景圖跨段鎖)`);

    // 🔗 v6.8 接棒:取某 chunk 最後一個 beat 的「動作摘要」(來自分鏡文字),餵給下一段開頭。
    function lastActionText(chunk) {
      if (!chunk || !Array.isArray(chunk.beats) || !chunk.beats.length) return null;
      const b = chunk.beats[chunk.beats.length - 1];
      let t = (typeof b === 'string') ? b : (b.action || b.situation || b.shotDesc || b.prompt || '');
      t = String(t).replace(/\s+/g, ' ').trim();
      if (t.length > 120) t = t.slice(0, 120);   // 只取動作摘要,別把整段塞進去
      return t || null;
    }

    const tasks = chunks.map(function (chunk, i) {
      const beats = chunk.beats || [];
      const continuityFrom = null;   // 🔗 v7.1 接棒關閉:文字接棒「she has just …上一段動作」會被模型當成「要演的動作」→ 連續重演(連開好幾次箱)。連貫改靠「分鏡本身是連續故事 + 視覺鎖定(同人/同景/同服裝/同seed)」。lastActionText 保留待日後改成「狀態接棒」再開。
      const chunkSec = Math.min(15, Math.max(3, beats.reduce(function (a, b) { return a + (b.durationSec || 5); }, 0) || 15));
      // 該 chunk 的 KOL 圖:用第一個 beat 的角度圖(STEP2/STEP3 已挑好)→ 沒有才退 chunk/全域
      const chunkKol = (beats[0] && beats[0].kolImageUrl) || chunk.kolImageUrl || kolImg;
      return generateSegment({
        engine: opts.engine,                       // 🆕 v6.5 攝影師選擇(未傳 → Seedance 原路)
        shared: opts.shared,                       // 🆕 B 版共用區塊(front/tail);沒傳就走 A 版
        continuityFrom: continuityFrom,            // 🔗 v6.8 接棒:上一段結尾動作 → 這段接著演(不從頭)
        kolImageUrl: chunkKol,                     // v6.2:用該 chunk 的角度圖當 [Image1](臉錨)
        productImageUrls: opts.productImageUrls,
        beats: beats,                              // v6.2:整個 chunk 的 beat 物件(含動作+秒數)→ 多 Shot
        aspectRatio: opts.aspectRatio,
        resolution: opts.resolution,
        generateAudio: opts.generateAudio,
        tier: opts.tier,
        seed: stitchSeed,
        brandId: opts.brandId,
        kolName: opts.kolName,
        nationality: opts.nationality || (beats[0] && beats[0].nationality),
        outfitImageUrl: outfitImageUrl,            // → [OUTFIT_IMG](整支共用,鎖同一件衣服)
        sceneImageUrl: sceneImageUrl,              // → [SCENE_IMG](整支共用,鎖同一間房 → 跨段家具一致)
      }, function () {}).then(function (segUrl) {
        doneCount++;
        log(`${doneCount}/${total} 段完成…`);
        if (opts.onSegmentDone) opts.onSegmentDone(i, segUrl);
        return { url: segUrl, durationSec: chunkSec };
      });
    });

    const segments = await Promise.all(tasks);   // 順序照 plan 保留

    if (segments.length === 1) {
      log('只有一段,免接片。存檔…');
      const only = await toR2(segments[0].url, opts.brandId, (opts.kolName || 'stitch') + '-1seg');
      log('完成!');
      return { finalUrl: only, segmentUrls: [segments[0].url] };
    }

    log('全部完成,接片中…');
    let finalUrl = await composeSegments(segments, opts.brandId, function (n, st) { log(`接片中…(${st})`); });
    log('成品存檔到 R2…');
    finalUrl = await toR2(finalUrl, opts.brandId, (opts.kolName || 'stitch') + '-' + segments.length + 'seg');
    log('完成!');
    return { finalUrl, segmentUrls: segments.map(function (s) { return s.url; }) };
  }

  console.log('[KolStitch] 🎬 v6.5(引擎切換層)· 🎥攝影師分流:opts.engine → window.KolEngines[id](未傳=Seedance原路·零改動)· 📐多角度臉參考表 resolveKolSheet(_sheet_ → driveId 乾淨原圖·不走w400縮圖)· v7.7 · 多鏡頭 reference-to-video(已驗證五鎖) · 照分鏡秒數切chunk + 每chunk角度圖 + beat當Shot · 場景圖跨段鎖 + 光向鎖(通用) + 📦商品尺度跨段鎖(同物件同大小·不放大縮小) · 口型綁台詞(沒台詞不講話·只環境音) · 共用seed · 🛡️分鏡防呆 · 🎬精簡敘事B版(shared front/tail·真實度擺最前) · 🫀生命感層(手勢/重心/視線/眨眼/步態骨骼) · 🔗接棒暫關(文字接棒會讓模型重演上一段動作→連貫改靠分鏡順序+視覺鎖定) · 🚦提交序列化(submit一段一段送·根治Worker同物件並發10058·輪詢仍全平行)');

  // ---- 對外 ---------------------------------------------------------------
  return {
    init,
    extractLastFrame,
    generateSegment,
    composeSegments,
    runStitchFlow,
    pickUrl,
    pollEpisode,
    resolveKolSheet,     // 🆕 v6.5:Console 可單獨驗多角度表(不送 fal、不燒點數)
    _api: api,
  };
})();
