// ==========================================================================
// kol-stitch.js — 自動接片引擎 v6.18
// v6.18:🎯 智能資產選配器 Phase 1b(臉角度)— 保險絲 window.KOL_FACEANGLES(預設關=單張正臉不變)。
//        開啟:讀 beats 的 angle → resolveKolSheet 挑對應角度臉 → 傳 kolFaceDriveIds(Worker 排最後幾格·9格自動停);
//        每 beat 臉前綴 [Image1]→[FACE_角度]佔位(Worker 換真 [ImageN],沒對應退 [Image1])。殺抽卡:角度有真圖可抄。
//        🔴 商品(collectBeatProducts)/場景(自傳優先)一律不動。沒 _sheet 的 KOL 自動退單張。
// v6.17:🗺️ 場景九宮格接線 — 保險絲 window.KOL_SCENEGRID(預設關=生產走單張場景圖不變)。
//        開啟時:runStitchFlow 改叫 environment.generateSceneGrid(藍圖→8角度空間庫),失敗自動退單張;
//        [SCENE_IMG] 標註升級成「多角度空間庫·提取佈局·別把格線畫進畫面」。修「場景跨段飄」。
//        ⚠️ 標註較長,PiAPI 主力路開九宮格會貼/爆牆 → 測九宮格建議走 fal 路(provider=fal,無牆)。
// v6.16:🎬 結尾停+硬切(match cut)— 保險絲 window.KOL_MATCHCUT(預設關=生產零影響)。
//        開啟時:分鏡標記 Hard cut→Match cut + 交棒句「同一瞬間·換角度·不重演·結尾停settled」;
//        且 look 上限自動降 200→150 讓位交棒句(不撞牆)。解「動作趕/硬切跳」,match cut=同一
//        故事瞬間兩視角(非舊接棒的「繼續做動作」→不會重演)。付費批次 A/B 驗,建議先在 ly(短look)測。
// v6.15:🎨 色板師 A案2.0 — 品牌 look 改「當 front 取代 generic realism」(不再塞色板行到 LOCKED 後)。
//        取代≠疊加 → 省字;look 來源=brand_packs.photography_style(沒設→iPhone 原生預設)。
//        固定加膚色護欄(業界:膚色另一道,防高對比款把臉搞油);look 上限 200 字(字界切)防撞牆。
//        呼叫 KolColorboard.resolveLookLine。保險絲 KOL_COLORBOARD=false → 退回 generic。
// v6.14:🩳 1700 牆瘦身 — 色板師接線後 PiAPI(開語音)真實送出 ~2046 字已爆牆。
//        瘦 4 處固定開銷:LOCKED 標註區塊(-145)/prodRule(-116)/PiAPI 語音行(-78)/
//        台詞封鎖行(-44),含色板落 ~1663 字(距牆 ~37)。鐵律意思全保留(各參考圖角色鎖、
//        只講台詞、沒台詞不講話、不定格、同物件同尺度、口音 _accent 不動)。
//        ⚠️ 餘裕不寬:真實分鏡台詞很長那段仍可能貼牆 → 保險絲 window.KOL_COLORBOARD=false
//        當場 A/B;若常態貼牆再瘦 kol-colorboard.js 色板行(-36,下一檔)或走 B 案(色板圖當參考圖)。
// v6.13:🎨 色板師接線 — generateSegment 內 await KolColorboard.resolveColorLine(brandId 直綁 brand_packs)
//        → 塞 opts.shared.colorLine → buildMultiShotPrompt(A/B 兩路)插入「整體色調傾向品牌色卡」一行
//        (soft/natural·不加對比·不招烤肉紋)。PiAPI lean 重組補帶 colorLine 不掉色板。
//        保險絲 window.KOL_COLORBOARD=false。⚠️ 色板行 ~241 字 → 注意總 prompt 撞 1700 牆,爆牆換標註瘦身版。
//        (檔頭版本先前 lag 在 v6.4,實際內容已到 v6.12 鎖臉;本次一併更正)
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
    if (data && data.ok === false) {
      // 🔬 v6.12.5 診斷:把 PiAPI 真正的原因(logs/detail)「單獨抽出來印一行」。
      //   之前 error 字串太長(含整段 prompt),logs 被擠到後面看不到 → 抽出來就短、會完整顯示。
      try { console.log('[KolStitch] 🔬 完整錯誤物件:', data); } catch (_) {}
      try {
        var _s = String(data.error || '');
        var _at = _s.indexOf('{');
        if (_at >= 0) {
          var _pi = JSON.parse(_s.slice(_at));
          var _d = (_pi && _pi.data) || {};
          console.log('%c[KolStitch] 🔬🔬 PiAPI 真正原因 logs =', 'color:#e11;font-weight:bold', _d.logs);
          console.log('[KolStitch] 🔬🔬 PiAPI detail =', _d.detail, '· code =', _pi.code, '· status =', _d.status);
        }
      } catch (_e) { console.log('[KolStitch] 🔬 抽 PiAPI logs 失敗(把上面完整錯誤物件截圖即可):', _e); }
      try { console.log('[KolStitch] 🔬🔬 r2Refs(PiAPI 實際去抓的圖) =', data.r2Refs); } catch (_e2) {}
      throw new Error(`[${action}] ${data.error || '未知錯誤'}`);
    }
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

  // webhook 輪詢 —— 問 episode_result(seedance_submit / kling_submit / video_compose 共用)。
  // 🆕 v6.7:R2 還沒結果時,每 4 輪順手問一次 fal_poll 拿真實狀態,把「pending」翻成人話。
  //   動機:客戶只看到 pending×100 會以為壞了(Wishlist⑤ STEP2 生成無回饋 = 最高商業風險)。
  //   ⚠️ 不露引擎名(商業鐵律):只講「排隊中/生成中」,不講 fal / Kling / Seedance。
  const _STATUS_TEXT = {
    IN_QUEUE: '排隊中…(前面還有工作)',
    IN_PROGRESS: '生成中…',
    COMPLETED: '收尾中…',
  };
  async function pollEpisode(reqId, brandId, onTick, endpoint) {
    if (!reqId) throw new Error('pollEpisode 缺少 reqId');
    const brand = brandId || 'unknown';
    let lastReal = '';
    for (let i = 0; i < cfg.pollMaxTries; i++) {
      try {
        const r = await api('episode_result', { brandId: brand, reqId });
        const st = String(r.status || 'pending').toLowerCase();
        if (st === 'done' && r.videoUrl) return r.videoUrl;
        if (st === 'failed') throw new Error('生成失敗：' + (r.error || '未知'));

        // 每 4 輪問一次真實狀態(輕量查詢,不燒點數);查失敗就沿用上一次的字。
        if (endpoint && i % 4 === 0) {
          try {
            const fp = await api('fal_poll', { requestId: reqId, endpoint: endpoint });
            const raw = String((fp && fp.status) || '').toUpperCase();
            if (raw) lastReal = _STATUS_TEXT[raw] || raw;
          } catch (_) {}
        }
        if (onTick) onTick(i, lastReal || '準備中…');
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
        ? 'she holds the product referenced in each shot at a consistent real-world size and hand-scale; do not zoom or resize it within a shot; different shots show the specified products; '
        : 'the product she holds is the exact same object at the same real-world size and hand-scale in every shot — never bigger, smaller, zoomed or resized between cuts; ';
      const _mc = (typeof window !== 'undefined' && window.KOL_MATCHCUT === true);  // 🎬 v6.16 結尾停+硬切(match cut)保險絲,預設關
      const _sg = (typeof window !== 'undefined' && window.KOL_SCENEGRID === true);  // 🗺️ v6.17 場景九宮格保險絲,預設關(標註用)
      const _fa = (typeof window !== 'undefined' && window.KOL_FACEANGLES === true);  // 🎯 v6.18 多角度臉選配保險絲,預設關(每 beat 臉前綴用)
      let bodyB = shared.front + '\n'
        + 'Reference images are LOCKED assets, each the single source of truth for its element — keep identical in every shot: '
        + '[Image1] = identity (same face, hair, body proportions, vibe; one person). '
        + (_sg
           ? '[SCENE_IMG] = one location shown from multiple angles; lock its layout, structures, materials and colours, pull the right camera angle per shot; never draw the grid, panels or dividing lines into the video. '
           : '[SCENE_IMG] = location (same background and layout; do not rearrange). ')
        + '[OUTFIT_IMG] = outfit (same garment: fabric, pattern, colour, cut; do not restyle). '
        + 'Also keep the product locked: '
        + prodRule
        + 'no change of person, scene, outfit, no crowd.'
        + (_mc ? ' Match cuts only — same moment, new angle, no re-perform; shots end settled and still.' : '')
        + '\n\n'
        + (shared.colorLine ? shared.colorLine + '\n\n' : '')
        + carry;
      let tb = 0;
      for (let i = 0; i < n; i++) {
        const bSecB = list[i].durationSec || Math.max(1, Math.round(dur / n));
        const tb0 = tb, tb1 = (i === n - 1) ? dur : Math.min(dur, tb + bSecB);
        const markerB = (i === 0) ? 'Shot 1' : ((_mc ? 'Match cut to Shot ' : 'Hard cut to Shot ') + (i + 1));
        const _tagB = bp.tagOf(list[i].productUrl);
        const _prodB = _tagB ? (' She is holding ' + _tagB + ' — this exact product in this shot.') : '';
        bodyB += '[00:' + pad(tb0) + '-00:' + pad(tb1) + '] ' + markerB + ': ' + ((_fa && list[i].angle && String(list[i].angle).toLowerCase() !== 'front') ? ('[FACE_' + String(list[i].angle).toUpperCase().replace(/[^A-Z0-9]/g, '') + ']') : '[Image1]') + ' ' + (list[i].prompt || '') + _prodB + '\n';
        tb = tb1;
      }
      bodyB += '\nThe quoted line is her COMPLETE and ONLY speech per shot — no extra words or improvised prices after it, only ambient sound.';
      if (shared.tail) bodyB += '\n' + shared.tail;
      return bodyB;
    }

    let body = 'candid realistic vertical UGC video.\n'
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
    body += '\nGlobal: the same woman [Image1], the same location [SCENE_IMG], the same background and outfit [OUTFIT_IMG] across all shots; steady camera; do not change her face, the location, the background or the outfit; no different person, no crowd.';
    if (shared && shared.colorLine) body += '\n' + shared.colorLine;
    return body;
  }

  // 🆕 分段綁圖 1a 自測(不花錢):console 打 _testMultiShoe()
  //   🎨 v6.13:可傳色板行免費驗色板 →
  //     _testMultiShoe(await window.KolColorboard.resolveColorLine({brandId:'ra'}))
  //     對比 _testMultiShoe() 的長度差 = 色板行實際佔字,並看色板行插在 LOCKED 段之後。
  window._testMultiShoe = function (colorLine) {
    const fake = [
      { prompt: 'shows the shoe: "太好穿了!"', durationSec: 5, productUrl: 'FILA.jpg' },
      { prompt: 'picks up another: "這雙也是!"', durationSec: 5, productUrl: 'CHAMPION.jpg' },
      { prompt: 'smiles at camera', durationSec: 5, productUrl: 'FILA.jpg' }
    ];
    const bp = collectBeatProducts(fake);
    const shared = { front: 'TEST realism anchor.' };
    if (colorLine) shared.colorLine = colorLine;
    const p = buildMultiShotPrompt(fake, 15, shared);
    console.log('=== 送 Seedance 的商品圖順序([Image1]=臉,之後才是商品)===');
    bp.urls.forEach(function (u, i) { console.log('  [Image' + (i + 2) + '] = ' + u); });
    console.log('=== 生成的 prompt(' + p.length + ' 字' + (colorLine ? ' · 含色板' : ' · 無色板') + ')===\n' + p);
    return { productUrls: bp.urls, prompt: p, length: p.length };
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
    // 🆕 v6.6:kolImageUrl 是「Seedance 的 [Image1] 臉錨」前置條件,不是通用條件。
    //   攝影師② Kling 走 kolFaceDriveId(Drive 多角度 sheet → R2 乾淨原圖),不需要 kolImageUrl。
    //   ⚠️ 檢查若擋在分流之前,Kling 永遠走不進去(D 接片測試就是死在這裡)。
    const _isSeedance = !opts.engine || opts.engine === 'seedance';
    if (_isSeedance && !opts.kolImageUrl) throw new Error('generateSegment 缺少 kolImageUrl（KOL 角度圖）');
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
      // 🆕 v6.7:印出 reqId → 視窗關掉/斷線也能用 pollEpisode(reqId) 撈回,不必重生(省錢)。
      console.log('[KolStitch] 🎫 本段 reqId:', _sub.requestId, '(關掉視窗可用它撈回,不用重生)');
      const _url = await pollEpisode(_sub.requestId, opts.brandId, onTick, _sub.endpoint);
      if (!_url) throw new Error('攝影師「' + opts.engine + '」沒拿到影片 URL');
      return _url;
    }
    // ═══ 以下 = 攝影師① Seedance 原路(未更動)═════════════════════════════

    // 🎨 v6.15 色板師 A案2.0:讀品牌 look → 當 front 的「品牌調色」(取代 generic realism,不再塞色板行到 LOCKED 後)。
    //   look 來源:brand_packs.photography_style(每品牌手填);沒設 → colorboard 回 iPhone 原生預設。
    //   ① 長度上限 200 字(字界切)→ 不管 photography_style 填多長都不撞 1700 牆。
    //   ② 膚色護欄固定加(業界:膚色永遠另一道)→ 任何 look(含高對比款)都不會把臉搞油。
    //   保險絲 window.KOL_COLORBOARD=false → _lookFront 為空 → 退回原本 generic realism(A/B、爆牆時)。
    let _lookFront = '';
    if (window.KOL_COLORBOARD !== false && window.KolColorboard && typeof window.KolColorboard.resolveLookLine === 'function') {
      try {
        let _look = (await window.KolColorboard.resolveLookLine({ brandId: opts.brandId })) || '';
        const _capLen = (typeof window !== 'undefined' && window.KOL_MATCHCUT === true) ? 150 : 200;  // 🎬 match cut 開啟→look 讓位給交棒句
        if (_look.length > _capLen) {
          _look = _look.slice(0, _capLen).replace(/\S*$/, '').trim();   // 切到最後一個完整字,不砍半字
          console.log('[KolStitch] 🎨 look 過長,截到 ' + _look.length + ' 字(避 1700 牆)');
        }
        if (_look) _lookFront = _look + ' Skin natural and matte, no oily specular on the face. No text, subtitles or music.';
      } catch (_) {}
    }
    // look 當 front:兩路都吃 opts.shared.front(Seedance 完整敘述路 & piapi lean 路)
    if (_lookFront) { opts.shared = opts.shared || {}; opts.shared.front = _lookFront; }

    let prompt = buildMultiShotPrompt(beats, totalSec, opts.shared, opts.continuityFrom);

    // 🩳 v6.10 PiAPI 硬上限修正:realism 冗字散在多模組 → shared.front 太長會撞 PiAPI prompt 上限。
    //   對 piapi 路線改用「精簡骨架」:五鎖錨 + 分鏡台詞 + 一句真實度;長篇 realism 交給參考圖扛。fal 路線維持完整敘述不動。
    //   ⚠️ v6.15:front 現在就是 look(或沒 look 時的 generic);lean 重組直接沿用 _lookFront,不再帶 colorLine。
    if ((opts.provider || 'piapi') === 'piapi' && opts.shared && opts.shared.front) {
      const _leanFront = _lookFront
        || 'Realistic vertical UGC video, no on-screen text or subtitles, no background music.';
      prompt = buildMultiShotPrompt(beats, totalSec, { front: _leanFront }, opts.continuityFrom);
    }

    // 🔒 口音 + 口型鐵律(v6.4):開語音時,只有「有台詞的鏡頭」才說話+對嘴;
    //   沒台詞的鏡頭(吃/咀嚼/拿商品/純反應)→ 不講話、嘴不動、只有環境音 → 解決「邊吃邊有人聲」desync。
    if (opts.generateAudio === true && !/lip-sync/i.test(prompt)) {
      const _nat = opts.nationality
        || (window.S && window.S.selectedKol && window.S.selectedKol.persona && window.S.selectedKol.persona.nationality)
        || 'tw';
      const _accent = (typeof window.natToAccent === 'function') ? window.natToAccent(_nat) : 'Taiwanese Mandarin';
      if ((opts.provider || 'piapi') === 'piapi') {
        // 🩳 v6.10 PiAPI 超短語音行(省字避開 prompt 上限;鐵律照留:只講台詞/台灣腔/對嘴/沒台詞不講話/不定格)
        prompt += '\nVoice & lip-sync: she speaks ONLY the written dialogue word for word in natural ' + _accent + ' — no improvising, changing words, numbers or prices; accurate lip-sync. Shots with no line: silent, mouth still, ambient only. Never statue-still; still moving on the last frame.';
      } else {
        prompt += '\nVoice & body: she speaks ONLY the written dialogue, word for word in natural ' + _accent + ' — never improvise, add, drop, repeat or change any words, numbers or prices; clear articulation, accurate lip-sync, natural conversational pace. In any shot with no written line (eating, tasting, holding or showing the product, reacting) she stays silent, mouth still, only ambient sound. She is never statue-still — natural hand gestures, weight shifts, small head nods, relaxed blinking and shifting gaze, moving naturally through the last frame.';
      }
    }

    // reference-to-video:KOL臉=[Image1] 鎖身份 + 商品 + 服裝 + 場景(最多9張)。
    //   Worker 自動把 [OUTFIT_IMG]/[SCENE_IMG] 換成真實 [ImageN]。
    var _provNow = (typeof window !== 'undefined' && window.KOL_PROVIDER) ? window.KOL_PROVIDER : (opts.provider || 'piapi');
    console.log('[KolStitch] 📏 送出 prompt 長度 =', prompt.length, '字 · provider=' + _provNow + (_provNow !== 'piapi' ? ' 🔬(已切換引擎)' : ''));
    console.log('[KolStitch] 🔬 診斷 · 本段送出 [Image1] 臉圖 =', opts.kolImageUrl,
      '· outfit=', opts.outfitImageUrl || '(無)', '· scene=', opts.sceneImageUrl || '(無)',
      '· 商品數=', (Array.isArray(opts.productImageUrls) ? opts.productImageUrls.length : 0));
    if (onTick) onTick(0, 'reference-to-video(多鏡頭)');
    const _segProducts = collectBeatProducts(beats);   // 🆕 分段綁圖:beats 帶鞋 → 用它組圖(順序對齊 prompt)
    console.log('[KolStitch] 🔬 診斷 · 本段實送商品圖 =',
      _segProducts.has ? _segProducts.urls : (Array.isArray(opts.productImageUrls) ? opts.productImageUrls : []));
    // 🎯 v6.18 選配器 Phase 1b:多角度臉選配(fuse window.KOL_FACEANGLES 預設關)
    //   讀這段 beats 的 angle → 從 resolveKolSheet 挑對應角度臉 → 傳 kolFaceDriveIds(Worker 排最後幾格)。
    //   沒 _sheet / 沒 brandId+kolName / fuse 關 → 空陣列 → 走原本單張正臉 [Image1](向下相容)。
    //   9 格預算:臉角度排最後,Worker 到 9 張自動停 → 超額時角度臉先被丟(商品/場景優先),殘留 [FACE_*] 退 [Image1]。
    let _faceDriveIds = [];
    if (window.KOL_FACEANGLES === true && opts.brandId && opts.kolName) {
      try {
        const _wantAngles = [];
        beats.forEach(function (b) {
          const a = (b && typeof b === 'object' && b.angle) ? String(b.angle).toLowerCase() : '';
          if (a && a !== 'front' && _wantAngles.indexOf(a) === -1) _wantAngles.push(a);
        });
        if (_wantAngles.length) {
          const _sheet = await resolveKolSheet(opts.brandId, opts.kolName);
          const _angleMap = {};
          ((_sheet._names && _sheet._names.angles) || []).forEach(function (nm, k) {
            const m = /_sheet_([a-z0-9]+)/i.exec(nm || '');
            if (m && _sheet.angleIds[k]) _angleMap[m[1].toLowerCase()] = _sheet.angleIds[k];
          });
          _wantAngles.forEach(function (a) {
            if (_angleMap[a]) _faceDriveIds.push({ driveId: _angleMap[a], angle: a });
          });
          if (_faceDriveIds.length) console.log('[KolStitch] 🎯 本段裝角度臉:', _faceDriveIds.map(function (f) { return f.angle; }).join('/'));
        }
      } catch (e) { console.warn('[KolStitch] 多角度臉選配略過(退單張正臉):', e.message); _faceDriveIds = []; }
    }
    const sub = await queuedSubmit(function () { return api('seedance_submit', {
      kolImageUrl: opts.kolImageUrl,                                       // → [Image1] 臉錨(整支同一張身份臉錨·v6.12鎖臉)
      productImageUrls: _segProducts.has ? _segProducts.urls : (Array.isArray(opts.productImageUrls) ? opts.productImageUrls : []),
      outfitImageUrl: opts.outfitImageUrl || undefined,                    // → [OUTFIT_IMG]→[ImageN]
      sceneImageUrl: opts.sceneImageUrl || undefined,                      // → [SCENE_IMG]→[ImageN]
      kolFaceDriveIds: _faceDriveIds.length ? _faceDriveIds : undefined,   // 🎯 v6.18 多角度臉 → [FACE_角度]→[ImageN]
      prompt: prompt,
      brandId: opts.brandId,
      kolName: opts.kolName,
      duration: String(totalSec),                                          // v6.2:照分鏡秒數加總(封頂 15)
      aspectRatio: opts.aspectRatio || '9:16',
      resolution: opts.resolution || '720p',
      generateAudio: opts.generateAudio === true,
      tier: opts.tier || 'fast',
      seed: opts.seed,
      provider: (typeof window !== 'undefined' && window.KOL_PROVIDER) ? window.KOL_PROVIDER : (opts.provider || 'piapi'),   // 🆕 v6.9 畫質主力預設 PiAPI(側門·吃真人臉);🔬 Console 設 window.KOL_PROVIDER='fal' 切官方 fal 引擎(測 PiAPI 側門 500 是否引擎專屬)
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
    // 🆕 v6.6:同上 — 只有 Seedance 需要 kolImageUrl 當每段錨點;Kling 用 resolveKolSheet 的 driveId。
    if (!kolImg && (!opts.engine || opts.engine === 'seedance')) {
      throw new Error('缺少 kolImageUrl(原始 KOL 照,每段都當錨點)');
    }
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
    // 🆕 v6.7 引擎中性文案(不露 reference-to-video / [Image1] / 平行 等後端術語)
    log(`共 ${total} 段,開始生成…(臉部鎖定 · 場景鎖定 · 服裝鎖定)`);

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
        log('生成服裝參考圖中…(鎖跨段衣服,整支只生一次)');
        outfitImageUrl = await window.KolWardrobe.generateOutfitRefImage(outfitCtx);
      }
    } catch (e) { outfitImageUrl = null; }

    // 場景參考圖(整支生一次,當 compose 的輸入之一)
    // 🔬 診斷開關:Console 設 window.KOL_DROP_SCENE = true → 這支不帶場景圖。
    //   用途:外部圖床(ibb.co)場景圖被 PiAPI 伺服器抓取擋掉 → 提交 500。
    //   跳過場景可隔離該問題、純驗鎖臉(臉仍鎖 [Image1],背景不鎖而已)。場景之後系統性搬 R2 再開回。
    let sceneImageUrl = opts.sceneImageUrl || null;
    const _dropScene = (typeof window !== 'undefined' && window.KOL_DROP_SCENE === true);
    if (_dropScene) {
      sceneImageUrl = null;
      log('🔬 診斷:本支跳過場景圖(KOL_DROP_SCENE=on)→ 純驗鎖臉,背景暫不鎖');
    }
    try {
      if (!_dropScene && !sceneImageUrl && window.KolEnvironment) {
        const sceneCtx = opts.sceneCtx || {
          brandId: opts.brandId || (window.S && window.S.currentBrandId) || '',
          sceneId: (window.S && window.S.selectedSceneId) || '',
          locationId: (window.S && window.S.selectedLocationId) || 'none',
        };
        // 🗺️ v6.17 場景九宮格保險絲(預設關):on → 生九宮格(多角度空間庫);失敗或關 → 退回單張場景圖
        const _wantGrid = (typeof window !== 'undefined' && window.KOL_SCENEGRID === true);
        if (_wantGrid && typeof window.KolEnvironment.generateSceneGrid === 'function') {
          log('生成場景九宮格中…(藍圖→8角度空間庫,整支只生一次)');
          sceneImageUrl = await window.KolEnvironment.generateSceneGrid(sceneCtx);
        }
        if (!sceneImageUrl && typeof window.KolEnvironment.generateSceneRefImage === 'function') {
          log(_wantGrid ? '九宮格未生成,退回單張場景圖…' : '生成場景參考圖中…(鎖跨段背景,整支只生一次)');
          sceneImageUrl = await window.KolEnvironment.generateSceneRefImage(sceneCtx);
        }
      }
    } catch (e) { sceneImageUrl = null; }

    log(`參考圖鎖定完成 ✓ · ${total} 段生成中…(同一張臉 · 同一件衣服 · 同一個場景 · 跨段不飄)`);

    // 🔗 v6.8 接棒:取某 chunk 最後一個 beat 的「動作摘要」(來自分鏡文字),餵給下一段開頭。
    function lastActionText(chunk) {
      if (!chunk || !Array.isArray(chunk.beats) || !chunk.beats.length) return null;
      const b = chunk.beats[chunk.beats.length - 1];
      let t = (typeof b === 'string') ? b : (b.action || b.situation || b.shotDesc || b.prompt || '');
      t = String(t).replace(/\s+/g, ' ').trim();
      if (t.length > 120) t = t.slice(0, 120);   // 只取動作摘要,別把整段塞進去
      return t || null;
    }

    // 🔒 v6.12.1 鎖臉:整支共用「同一張身份臉錨」當 [Image1](修「兩段臉不一樣」)。
    //   病根:v6.2 讓每個 chunk 各挑各的「角度圖」當 [Image1] → Seedance 各段獨立生成 → 每段臉不同。
    //   修法:整支鎖「第一個有角度圖的 beat」那張——它是 STEP2/STEP3 挑好、PiAPI 已證明能送的 URL。
    //         哲學同 v6.11「相信臉圖」——只是確保每段相信的是「同一張」臉;鏡頭角度照樣由 prompt 的 Shot 描述決定。
    //   ⚠️ v6.12 舊版誤鎖 opts.kolImageUrl(主肖像·多為 Drive/縮圖)→ PiAPI auto_upload 抓不到 → 提交 500。
    //      本版改鎖「第一段角度圖」根治;想自訂可傳 opts.identityImageUrl。
    //   保險絲:Console 打 window.KOL_LOCK_FACE = false → 退回 v6.2 逐段角度圖(除錯用)。
    const _lockFace = (typeof window === 'undefined' || window.KOL_LOCK_FACE !== false);
    let _identityFace = opts.identityImageUrl || '';
    if (!_identityFace) {
      for (let _ci = 0; _ci < chunks.length && !_identityFace; _ci++) {
        const _cb = chunks[_ci].beats && chunks[_ci].beats[0];
        _identityFace = (_cb && _cb.kolImageUrl) || chunks[_ci].kolImageUrl || '';
      }
    }
    if (!_identityFace) _identityFace = kolImg;   // 最後退路(無角度圖時,行為同 v6.2 全域圖)
    if (_lockFace) {
      log('🔒 鎖臉:整支統一用同一張臉錨(跨段同一張臉)');
      console.log('[KolStitch] 🔬 診斷 · 鎖臉錨 [Image1] =', _identityFace,
        '· 是否退回主肖像 kolImg(=可能抓不到的 Drive 圖):', (_identityFace === kolImg));
    }

    const tasks = chunks.map(function (chunk, i) {
      const beats = chunk.beats || [];
      const continuityFrom = null;   // 🔗 v7.1 接棒關閉:文字接棒「she has just …上一段動作」會被模型當成「要演的動作」→ 連續重演(連開好幾次箱)。連貫改靠「分鏡本身是連續故事 + 視覺鎖定(同人/同景/同服裝/同seed)」。lastActionText 保留待日後改成「狀態接棒」再開。
      const chunkSec = Math.min(15, Math.max(3, beats.reduce(function (a, b) { return a + (b.durationSec || 5); }, 0) || 15));
      // 🔒 v6.12.7 鎖臉:整支鎖「同一張臉」,但每段加不同的 query 尾巴讓「網址不同」。
      //   病根(RA 實測定位):PiAPI 側門對「兩段幾乎同時、指向完全相同的圖片網址」會當成重複資產
      //     → auto_upload 撞在一起 → 提交 500。舊做法每段圖網址不同所以沒事;一鎖成同一網址就踩雷。
      //   修法:鎖同一張臉(臉一致)+ 每段 ?lockseg=i(R2 忽略未知 query、仍回同一張圖 → 網址不撞、臉不變)。
      //   _lockFace=false(Console 設 window.KOL_LOCK_FACE=false)→ 退回 v6.2 逐段角度圖。
      const _lockedFace = _identityFace + (_identityFace.indexOf('?') >= 0 ? '&' : '?') + 'lockseg=' + i;
      const chunkKol = _lockFace
        ? _lockedFace
        : ((beats[0] && beats[0].kolImageUrl) || chunk.kolImageUrl || kolImg);
      return generateSegment({
        engine: opts.engine,                       // 🆕 v6.5 攝影師選擇(未傳 → Seedance 原路)
        shared: opts.shared,                       // 🆕 B 版共用區塊(front/tail);沒傳就走 A 版
        continuityFrom: continuityFrom,            // 🔗 v6.8 接棒:上一段結尾動作 → 這段接著演(不從頭)
        kolImageUrl: chunkKol,                     // 🔒 v6.12:整支同一張身份臉錨當 [Image1](鎖臉;原 v6.2 為逐段角度圖)
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

  console.log('[KolStitch] 🎬 v6.18 🎯選配器Phase1b臉角度(保險絲window.KOL_FACEANGLES預設關·讀beats.angle→resolveKolSheet挑角度→kolFaceDriveIds排最後·[FACE_角度]佔位·商品/場景不動·殺抽卡) · v6.17 🗺️場景九宮格接線(保險絲window.KOL_SCENEGRID預設關·開→generateSceneGrid多角度空間庫+標註防畫格線·失敗退單張·測建議走fal路) · v6.16 🎬結尾停+硬切match cut · v6.15 🎨色板師A案2.0 · v6.14 🩳1700牆瘦身(LOCKED/prodRule/語音行/台詞封鎖行精簡·含色板落~1663字·鐵律意思全保留) · v6.13 🎨色板師接線(整體色調傾向品牌色卡·soft/natural·不加對比·brandId直綁brand_packs·保險絲window.KOL_COLORBOARD=false·_testMultiShoe(colorLine)可免費驗) · v6.12.7 🔒鎖臉修正(鎖同一張臉+每段?lockseg=i讓網址不撞·根治PiAPI側門「兩段同網址→重複資產→提交500」·臉一致又能生)· 🔀引擎開關window.KOL_PROVIDER · 場景隔離window.KOL_DROP_SCENE · window.KOL_LOCK_FACE=false退回逐段角度圖(整支共用同一張身份臉錨當[Image1]=第一段角度圖;window.KOL_LOCK_FACE=false退回v6.2逐段角度圖)· v6.11(引擎切換層·🆕provider預設PiAPI畫質主力·可傳provider=fal切回)· 🆕真實狀態顯示(排隊中/生成中·不再只印pending) · 🎫每段印reqId(斷線可撈回免重生) · 🏷進度文案引擎中性化(不露[Image1]/reference-to-video) · kolImageUrl檢查改Seedance專屬(Kling走driveId) · 🎥攝影師分流:opts.engine → window.KolEngines[id](未傳=Seedance原路·零改動)· 📐多角度臉參考表 resolveKolSheet(_sheet_ → driveId 乾淨原圖·不走w400縮圖)· v7.7 · 🩳精簡prompt v6.11(拔光影/膚質浮動形容詞·對齊5秒自然光·相信臉圖·色板師之前的過渡)·📏送出長度探針·修400 prompt exceeds · 多鏡頭 reference-to-video(已驗證五鎖) · 照分鏡秒數切chunk + beat當Shot · 場景圖跨段鎖 + 光向鎖(通用) + 📦商品尺度跨段鎖(同物件同大小·不放大縮小) · 口型綁台詞(沒台詞不講話·只環境音) · 共用seed · 🛡️分鏡防呆 · 🎬精簡敘事B版(shared front/tail·真實度擺最前) · 🫀生命感層(手勢/重心/視線/眨眼/步態骨骼) · 🔗接棒暫關(文字接棒會讓模型重演上一段動作→連貫改靠分鏡順序+視覺鎖定) · 🚦提交序列化(submit一段一段送·根治Worker同物件並發10058·輪詢仍全平行)');

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
