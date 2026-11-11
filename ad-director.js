// ═══════════════════════════════════════════════════════════════
//  🎬 ad-director.js v1.0(2026-11-12)廣告圖「AI 美術指導」
//  RA:「規則擋不完 —— 鞋子很輕想拍太空無重力、雪紡要飄、泳圈要浮。
//       要跟 KOL 數字人 AI 分鏡一樣:先吸收再轉換,轉出來的提示詞簡短有力很明確。」
//
//  流程(客人按「生成廣告圖」):
//   ① 照舊由精簡引擎(photoroom-proxy /adlean.js)抽一份「草稿」(拍法 / 光 / 地點 / 保護句)
//   ② 把【商品照】+ 商品名 / 規格 / 特色 + 客人選的類型 / 版型 / 風格 / 情境 / 補充說明 / 標題 + 草稿
//      一起交給 Claude(photoroom-proxy 既有的 claude_generate,不用改 Worker)
//   ③ Claude 看懂商品後決定這張怎麼拍,改寫成 5~7 句、每句一件事的最終提示詞
//   ④ 生圖用最終提示詞;Claude 失敗 / 超過 25 秒 → 直接用草稿(不擋出圖)
//
//  判斷全部交給美術指導,不寫死關鍵字規則:
//   · 主角永遠是商品 / 模特兒;畫面裡多的東西都要替它加分
//   · 東西照重力擺好 —— 除非商品本身會飛 / 會浮 / 會飄,或客人自己要(例如「太空無重力」)→ 那就整張做到位
//   · 跟商品無關的飄浮道具不加
//   · 標題原字照抄;草稿裡「商品長相照原圖」「畫面上的字」兩句保護句一字不改
//
//  只處理精簡引擎的照片類;多格 / 前後對比 / 清單這類排版圖(草稿 > 2,600 字)不動
//  保險絲:Console 輸入 window.AD_DIRECTOR = false → 立刻停用,回到原本流程
//  掛載:loader.js 只在首頁載入;包住 window.generateGptPoster 與 window.buildPosterPrompt
//  對外:window._adDirectorLast = { draft, final, ms, used }(後台生成紀錄 / 除錯用)
// ═══════════════════════════════════════════════════════════════
(function () {
  'use strict';
  if (window.AdDirector) return;
  var VERSION = '1.0';
  var WORKER = 'https://photoroom-proxy.calm-sunset-6b66.workers.dev';
  var TIMEOUT_MS = 25000;
  var MAX_DRAFT = 2600;     // 草稿超過這個長度 = 舊引擎的排版圖,不改寫
  var pending = null;       // 這一次生成要用的最終提示詞(只用一次)

  function val(id) { var el = document.getElementById(id); return (el && el.value || '').trim(); }
  function label(map, key) { try { return (key && map && map[key] && map[key].label) || ''; } catch (e) { return ''; } }

  //  商品照縮成 640px JPEG(base64)給 Claude 看 —— 雲端硬碟網址 Claude 讀不到,一律自己帶圖
  function photoBase64() {
    return new Promise(function (resolve) {
      try {
        var S = window.S || {}, p = (S.selPhoto !== null && S.selPhoto !== undefined) ? S.photos[S.selPhoto] : null;
        var src = p && (p.canvasRes || p.full || p.hiRes || p.src || p.thumb);
        if (!src || typeof window.urlToBlob !== 'function') return resolve(null);
        window.urlToBlob(src).then(function (blob) { return createImageBitmap(blob); }).then(function (bmp) {
          var k = Math.min(1, 640 / Math.max(bmp.width, bmp.height));
          var c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
          c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
          resolve(c.toDataURL('image/jpeg', 0.82).split(',')[1]);
        }).catch(function () { resolve(null); });
      } catch (e) { resolve(null); }
    });
  }

  function brief(draft) {
    var bc = {};
    try { bc = (typeof getBrandContext === 'function') ? (getBrandContext() || {}) : {}; } catch (e) {}
    var pt = '';
    try { var o = (typeof PRODTYPE_OPTIONS !== 'undefined' ? PRODTYPE_OPTIONS : []).find(function (x) { return x.value === (typeof SELECTED_PRODTYPE !== 'undefined' ? SELECTED_PRODTYPE : ''); }); pt = (o && o.label.split(' — ')[0]) || ''; } catch (e) {}
    var lines = [
      '品牌:' + (bc.brand || '') + (bc.subBrand ? ' / ' + bc.subBrand : ''),
      '商品:' + (bc.product || '(未命名)'),
      bc.spec ? '規格:' + bc.spec : '',
      bc.feature ? '特色:' + bc.feature : '',
      '客人選的類型:' + (pt || '(沒選)'),
      '版型:' + (safeLabel('LAYOUT_TEMPLATES', 'SELECTED_LAYOUT') || '(沒選)'),
      '風格:' + (safeLabel('REGIONAL_FLAVORS', 'SELECTED_FLAVOR') || '(沒選)'),
      '情境:' + (safeLabel('CONTEXT_THEMES', 'SELECTED_CONTEXT') || '(沒選)'),
      '客人補充說明:' + (val('gptStyleDesc') || '(沒有)'),
      '標題:' + (val('gptHeadline') || '(沒有)') + (val('gptSubHeadline') ? ' / 副標:' + val('gptSubHeadline') : '')
    ].filter(Boolean).join('\n');
    return [
      '你是頂尖商業攝影的美術指導。附圖是客人的真實商品照。先看懂這個商品:它是什麼、多大、怎麼用、材質輕重、賣點在哪;再讀客人的選擇與補充說明;最後讀系統抽給你的拍攝草稿。',
      '',
      '【商品與客人的選擇】',
      lines,
      '',
      '【系統草稿】(英文,是生圖模型要讀的提示詞)',
      draft,
      '',
      '【你的工作】把草稿改寫成一份最終提示詞,原則:',
      '1. 主角永遠是這個商品(有模特兒就是穿著商品的模特兒)。畫面裡每一樣多出來的東西都要替商品加分;搶戲、跟商品無關的道具或特效整個拿掉。',
      '2. 物理:東西照重力擺好、站穩、有影子。只有兩種情況可以漂浮 / 飛 / 飄:商品本身就是會飛、會浮、會飄的東西(看照片與商品名判斷),或客人在補充說明裡要了那個概念(例如太空、無重力)。決定要做,就整張照那個概念做到位,光影和影子一起合理。',
      '3. 輕柔布料的衣服,可以讓布料本身在微風裡自然擺動;外加的布、絲巾、彩帶、紙花不要。',
      '4. 草稿裡跟商品或客人選擇衝突的句子刪掉或改掉;合理的拍法、地點、光線保留。客人的補充說明優先於草稿。',
      '5. 下面兩類句子一字不改照抄:描述「商品保持照片原樣(形狀、顏色、標籤、LOGO)」的句子,以及描述「畫面上所有的字」的句子(標題引號裡的字原樣保留)。',
      '6. 拍法照我們驗證過的高質感標準(MOZ 那套):真的攝影師重新拍一張,不是改圖;一個具體的畫面主意放最前面;光寫成物理過程(光從哪來、照到哪、影子落在哪、牆和地板反射補光),人、商品、背景被同一道光照到,商品吃場景的光、白色部位霧面只留一道細高光;有顏色的中間調背景配直射硬光;商品放在三分線,另一側留一面乾淨的牆給字;生活痕跡最多 3 件且有因果;構圖稍微偏離中心。',
      '7. 促銷、節慶、檔期(例如雙 11)一樣照第 6 點拍成一張真的照片:節慶感只用配色、材質、光來表現;畫面上的促銷訊息只有一則、放在一處,由客人給的標題字負責。',
      '8. 刪掉畫質堆疊詞(8K、超清、perfect、cinematic lighting、golden hour、soft glow 這類),它們會讓畫面變塑膠感。',
      '9. 輸出英文,5 到 7 句,每句只講一件事,具體、肯定、不寫否定句,總長 1,200 字元以內。',
      '',
      '只輸出最終提示詞本身,不要標題、不要解釋、不要引號包住。'
    ].join('\n');
  }
  //  admaker.js 的 const / let 不在 window 上,直接用名字讀(讀不到就空白)
  function safeLabel(mapName, keyName) {
    try {
      var maps = { LAYOUT_TEMPLATES: typeof LAYOUT_TEMPLATES !== 'undefined' ? LAYOUT_TEMPLATES : null, REGIONAL_FLAVORS: typeof REGIONAL_FLAVORS !== 'undefined' ? REGIONAL_FLAVORS : null, CONTEXT_THEMES: typeof CONTEXT_THEMES !== 'undefined' ? CONTEXT_THEMES : null };
      var keys = { SELECTED_LAYOUT: typeof SELECTED_LAYOUT !== 'undefined' ? SELECTED_LAYOUT : '', SELECTED_FLAVOR: typeof SELECTED_FLAVOR !== 'undefined' ? SELECTED_FLAVOR : '', SELECTED_CONTEXT: typeof SELECTED_CONTEXT !== 'undefined' ? SELECTED_CONTEXT : '' };
      return label(maps[mapName], keys[keyName]);
    } catch (e) { return ''; }
  }

  function direct(draft) {
    var t0 = Date.now();
    return photoBase64().then(function (b64) {
      var content = [];
      if (b64) content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } });
      content.push({ type: 'text', text: brief(draft) });
      var ctl = new AbortController(), tm = setTimeout(function () { ctl.abort(); }, TIMEOUT_MS);
      return fetch(WORKER, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctl.signal,
        body: JSON.stringify({ action: 'claude_generate', password: (typeof GAS_PASSWORD !== 'undefined' ? GAS_PASSWORD : 'raby2026'), prompt: content, max_tokens: 900 })
      }).then(function (r) { return r.json(); }).then(function (j) {
        clearTimeout(tm);
        var out = String((j && j.ok && j.text) || '').trim().replace(/^["「]|["」]$/g, '');
        var ok = out.length >= 200 && out.length <= 2200;
        window._adDirectorLast = { draft: draft, final: ok ? out : '', ms: Date.now() - t0, used: ok, hadPhoto: !!b64, error: ok ? '' : ((j && j.error) || 'too short/long') };
        return ok ? out : null;
      }).catch(function (e) {
        clearTimeout(tm);
        window._adDirectorLast = { draft: draft, final: '', ms: Date.now() - t0, used: false, error: String(e && e.message || e) };
        return null;
      });
    });
  }

  function install(force) {
    if (typeof window.generateGptPoster !== 'function' || typeof window.buildPosterPrompt !== 'function') return false;
    //  一定要包在精簡引擎(adlean.js)外面:它先換掉 buildPosterPrompt,我們再包它 —— 反過來會被它繞過
    if (!window.buildPosterPromptLean && !force) return false;
    if (window.generateGptPoster.__director) return true;
    var origGen = window.generateGptPoster, origBuild = window.buildPosterPrompt;

    //  生圖那一刻拿到的就是美術指導改好的版本(只用一次)
    window.buildPosterPrompt = function () {
      if (pending) { var p = pending; pending = null; return p; }
      return origBuild.apply(this, arguments);
    };
    window.buildPosterPrompt.__director = true;

    window.generateGptPoster = async function () {
      pending = null;
      if (window.AD_DIRECTOR !== false) {
        try {
          var draft = origBuild();     // 精簡引擎抽一份(同時設好重拍 / 校正旗標)
          if (draft && draft.length <= MAX_DRAFT) {
            if (typeof setPrStatus === 'function') setPrStatus('🎬 AI 美術指導看商品、定拍法中…', 'var(--t3)');
            var fin = await direct(draft);
            pending = fin || draft;    // 失敗就用草稿,不重抽(旗標保持一致)
            console.log('[AdDirector v' + VERSION + '] ' + (fin ? '改寫完成 ' + fin.length + ' 字' : '改寫失敗,用草稿') + ' · ' + ((window._adDirectorLast || {}).ms || 0) + 'ms');
          }
        } catch (e) { pending = null; console.warn('[AdDirector] 略過:', e && e.message); }
      }
      return origGen.apply(this, arguments);
    };
    window.generateGptPoster.__director = true;
    return true;
  }

  //  等 admaker.js / adlean.js / ad-logotap.js 都掛好再包(最多等 15 秒)
  var tries = 0;
  (function wait() {
    tries++;
    if (install(tries > 60)) return;            // 15 秒還沒等到精簡引擎 → 直接包舊引擎
    if (tries > 80) { console.warn('[AdDirector] 找不到廣告圖函式,未啟用'); return; }
    setTimeout(wait, 250);
  })();

  window.AdDirector = { version: VERSION, direct: direct, brief: brief };
  console.log('[AdDirector] v' + VERSION + ' AI 美術指導已載入(關閉:window.AD_DIRECTOR = false)');
})();
