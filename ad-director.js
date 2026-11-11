// ═══════════════════════════════════════════════════════════════
//  🎬 ad-director.js v1.5(2026-11-12)廣告圖「AI 美術指導」—— 每一張廣告圖都經過美術指導
//  v1.5 全選項清查(類型×版型 91 組、風格 91 × 情境 28):
//   · 主角照草稿認定(商品 / 模特兒 / 美業作品 / 專業人士 / 螢幕),人臉、作品、螢幕內容的保護句也一字不改
//   · 字型一律 MOZ 黑體:9 種風格在排版圖會帶明朝 / 書法 / 手寫 / Didot / 變形大字 → 一律換掉
//  RA:「規則擋不完 —— 鞋子很輕想拍太空無重力、雪紡要飄、泳圈要浮。
//       要跟 KOL 數字人 AI 分鏡一樣:先吸收再轉換,轉出來的提示詞簡短有力很明確。」
//
//  流程(客人按「生成廣告圖」):
//   ① 照舊由精簡引擎(photoroom-proxy /adlean.js)抽一份「草稿」(拍法 / 光 / 地點 / 保護句)
//   ② 把【商品照】+ 商品名 / 規格 / 特色 + 客人選的類型 / 版型 / 風格 / 情境 / 補充說明 / 標題 + 草稿
//      一起交給 Claude(photoroom-proxy 既有的 claude_generate,不用改 Worker)
//   ③ Claude 看懂商品後決定這張怎麼拍,改寫成 5~7 句、每句一件事的最終提示詞
//   ④ 生圖用最終提示詞;第一次失敗 / 逾時 → 自動再試一次;兩次都失敗才用草稿,並在畫面上說明
//
//  判斷全部交給美術指導,不寫死關鍵字規則:
//   · 主角永遠是商品 / 模特兒;畫面裡多的東西都要替它加分
//   · 東西照重力擺好 —— 除非商品本身會飛 / 會浮 / 會飄,或客人自己要(例如「太空無重力」)→ 那就整張做到位
//   · 跟商品無關的飄浮道具不加
//   · 標題原字照抄;草稿裡「商品長相照原圖」「畫面上的字」兩句保護句一字不改
//
//  v1.4 RA 11-12「全部都要美術指導,根治」:
//   · 照片類(精簡引擎)與排版圖(前後對比 / 多格 / 清單,舊引擎)都改寫;排版圖保留格數、前後、條列與所有字
//   · 等待 40 秒 + 自動重試一次(v1.3 只等 25 秒,大照片會逾時、默默用草稿)
//   · 每次生成都重新抓「當下的」提示詞函式(v1.3 安裝時鎖定:精簡引擎晚載入就會繞過美術指導)
//  保險絲:Console 輸入 window.AD_DIRECTOR = false → 立刻停用,回到原本流程
//  掛載:loader.js 只在首頁載入;包住 window.generateGptPoster 與 window.buildPosterPrompt
//  對外:window._adDirectorLast = { draft, final, ms, used }(後台生成紀錄 / 除錯用)
// ═══════════════════════════════════════════════════════════════
(function () {
  'use strict';
  if (window.AdDirector) return;
  var VERSION = '1.5';
  var WORKER = 'https://photoroom-proxy.calm-sunset-6b66.workers.dev';
  var TIMEOUT_MS = 40000;    // 單次等待(排版圖 60 秒);失敗會再試一次
  //  v1.3 舊引擎(前後對比 / 多格 / 清單排版圖)的提示詞有「=== 區塊標題 ===」→ 看標記判斷,不看長度
  //   (v1.0 用 2600 字當界線,新引擎草稿常常 2610~2640 字 → 被誤判跳過,RA 11-11 實測抓到)
  var OLD_ENGINE = /^===\s*[A-Z][A-Z &]+===/m;
  var MAX_DRAFT = 30000;    // 只防異常(舊引擎排版圖草稿約 9,000~11,000 字)
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

  function brief(draft, hasPhoto, layout) {
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
      hasPhoto
        ? '你是頂尖商業攝影的美術指導。附圖是客人的真實商品照。先看懂這個商品:它是什麼、多大、怎麼用、材質輕重、賣點在哪;再讀客人的選擇與補充說明;最後讀系統抽給你的拍攝草稿。'
        : '你是頂尖商業攝影的美術指導。這次沒有附圖,商品照會直接交給生圖模型;請從商品名稱、規格、特色判斷它是什麼、多大、怎麼用、材質輕重、賣點在哪;再讀客人的選擇與補充說明;最後讀系統抽給你的拍攝草稿。',
      '',
      '【商品與客人的選擇】',
      lines,
      '',
      '【系統草稿】(英文,是生圖模型要讀的提示詞)',
      draft,
      '',
      '【你的工作】把草稿改寫成一份最終提示詞,原則:',
      '1. 主角就是草稿裡的主體:商品、穿著商品的模特兒、客人身上做好的作品(美睫 / 美甲 / 髮型…)、專業人士本人、或螢幕畫面 —— 照草稿認定,不換主角。畫面裡每一樣多出來的東西都要替主角加分;搶戲、跟主角無關的道具或特效整個拿掉。',
      '2. 物理:東西照重力擺好、站穩、有影子。只有兩種情況可以漂浮 / 飛 / 飄:商品本身就是會飛、會浮、會飄的東西(看照片與商品名判斷),或客人在補充說明裡要了那個概念(例如太空、無重力)。決定要做,就整張照那個概念做到位,光影和影子一起合理。',
      '3. 輕柔布料的衣服,可以讓布料本身在微風裡自然擺動;外加的布、絲巾、彩帶、紙花不要。',
      '4. 草稿裡跟商品或客人選擇衝突的句子刪掉或改掉;合理的拍法、地點、光線保留。客人的補充說明優先於草稿。',
      '5. 下面這幾類句子一字不改照抄:描述「主體保持照片原樣」的句子(商品的形狀、顏色、標籤、LOGO;人物的臉、五官、膚色、髮型、年紀;做好的作品;螢幕上的每個字與畫面);描述「其他衣物或物品是無品牌基本款、這個商品是畫面裡唯一有品牌的東西」的句子;描述「畫面上所有的字」的句子(引號裡的字原樣保留)。唯一要改的是字型:見第 10 點。',
      '6. 拍法照我們驗證過的高質感標準(MOZ 那套):真的攝影師重新拍一張,不是改圖;一個具體的畫面主意放最前面;光寫成物理過程(光從哪來、照到哪、影子落在哪、牆和地板反射補光),人、商品、背景被同一道光照到,商品吃場景的光、白色部位霧面只留一道細高光;有顏色的中間調背景配直射硬光;主體放在三分線,另一側留一面乾淨的牆給字;生活痕跡最多 3 件且有因果;構圖稍微偏離中心。',
      '7. 促銷、節慶、檔期(例如雙 11)一樣照第 6 點拍成一張真的照片:節慶感只用配色、材質、光來表現;畫面上的促銷訊息只有一則、放在一處,由客人給的標題字負責。',
      '8. 刪掉畫質堆疊詞(8K、超清、perfect、cinematic lighting、golden hour、soft glow 這類),它們會讓畫面變塑膠感。',
      layout
        ? '9. 這是一張「排版圖」(' + (safeLabel('LAYOUT_TEMPLATES', 'SELECTED_LAYOUT') || '多格 / 前後對比 / 清單') + '):草稿裡的版面結構完整保留 —— 畫布尺寸、幾格、哪一格放什麼、前後對比的左右或上下、條列幾點與順序、字放在哪裡。每一格裡的照片照第 6 點的拍法。草稿裡的 AVOID / 禁止清單改寫成正面的描述(要什麼),重複的句子合併。輸出英文,一個段落講版面、每一格各一句,具體、肯定、不寫否定句,總長 2,400 字元以內 —— 這點很重要:越長,生圖模型越抓不到重點;寫不下就刪最不重要的細節,字、格數、商品保護句一定留。'
        : '9. 輸出英文,5 到 7 句,每句只講一件事,具體、肯定、不寫否定句,總長 1,200 字元以內 —— 越長生圖模型越抓不到重點。',
      '10. 字型一律用 MOZ 那套:畫面上所有的字都是乾淨的無襯線黑體(Inter / 思源黑體 Regular)、字距收斂。草稿或風格裡寫的其他字型(襯線、明朝、宋體、書法、手寫、斜體、變形或超大的實驗字)都換成這個;風格的味道改用配色、材質、光與道具表現。',
      '',
      '你的回覆會原封不動交給生圖模型,所以第一個字就是提示詞的第一個字:只輸出最終提示詞本身,一段文字,不加標題、說明、前言或引號。'
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

  //  保險:就算 Claude 多講了一句前言 / 標題,也只留提示詞那一段(這些字會被生圖模型當成畫面內容)
  var META = /^(i |i'm |i'll |i need|i can|let me|here is|here's|since |note|based on|okay|sure|final prompt|prompt\s*:|this prompt|the prompt above|explanation|changes made|---)/i;
  function clean(t) {
    var paras = String(t).replace(/\r/g, '').split(/\n\s*\n/).map(function (x) {
      return x.replace(/^#+\s.*$/gm, '').replace(/^\s*(final prompt|prompt)\s*[:：]\s*/i, '').trim();
    }).filter(function (x) { return x && !META.test(x); });
    //  v1.4.1 全部保留(排版圖會分段:版面一段、每一格一段)—— v1.4 只留最長一段,排版圖被砍到剩一格
    return paras.join('\n\n').replace(/^["「“]|["」”]$/g, '').trim();
  }

  function once(content, layout) {
    var ctl = new AbortController(), tm = setTimeout(function () { ctl.abort(); }, layout ? TIMEOUT_MS * 1.5 : TIMEOUT_MS);
    return fetch(WORKER, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctl.signal,
      body: JSON.stringify({ action: 'claude_generate', password: (typeof GAS_PASSWORD !== 'undefined' ? GAS_PASSWORD : 'raby2026'), prompt: content, max_tokens: layout ? 2000 : 900 })
    }).then(function (r) { return r.json(); }).then(function (j) {
      clearTimeout(tm);
      var out = clean((j && j.ok && j.text) || '');
      //  v1.4.1 長度只防「壞掉」(空白 / 被截斷),不拿來淘汰好結果 —— 排版圖實測 4,700~5,200 字,v1.4 的 3,600 上限會把它丟掉
      var whole = /[.!?"”」』)）。]\s*$/.test(out);   // 沒有句尾 = 字數用完被截斷 → 當失敗,自動重試
      var ok = whole && out.length >= 200 && out.length <= (layout ? 8000 : 4000);
      return { out: ok ? out : null, error: ok ? '' : ((j && j.error) || (!whole && out ? '回覆被截斷' : '長度不對 ' + out.length + ' 字')) };
    }).catch(function (e) { clearTimeout(tm); return { out: null, error: (e && e.name === 'AbortError') ? '逾時' : String(e && e.message || e) }; });
  }

  function direct(draft) {
    var t0 = Date.now(), layout = OLD_ENGINE.test(draft);
    return photoBase64().then(function (b64) {
      var content = [];
      if (b64) content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } });
      content.push({ type: 'text', text: brief(draft, !!b64, layout) });
      return once(content, layout).then(function (r1) {
        if (r1.out) return { r: r1, tries: 1 };
        console.warn('[AdDirector] 第一次失敗(' + r1.error + '),自動再試一次');
        if (typeof setPrStatus === 'function') setPrStatus('🎬 AI 美術指導再想一次…', 'var(--t3)');
        return once(content, layout).then(function (r2) { return { r: r2, tries: 2, first: r1.error }; });
      }).then(function (x) {
        window._adDirectorLast = { draft: draft, final: x.r.out || '', ms: Date.now() - t0, used: !!x.r.out, hadPhoto: !!b64, mode: layout ? 'layout' : 'photo', tries: x.tries, error: x.r.out ? '' : ((x.first ? x.first + ' / ' : '') + x.r.error) };
        return x.r.out;
      });
    });
  }

  //  v1.4 不在安裝時鎖死提示詞函式:每次用之前看一眼,被別的檔案(例如晚載入的精簡引擎)換掉了就重新包
  function ensureBuild() {
    var b = window.buildPosterPrompt;
    if (b && b.__director) return b;
    var inner = b;
    var w = function () {
      if (pending) { var p = pending; pending = null; return p; }   // 生圖那一刻拿到美術指導改好的版本(只用一次)
      return inner.apply(this, arguments);
    };
    w.__director = true; w.__inner = function () { return inner.apply(window, arguments); };
    window.buildPosterPrompt = w;
    return w;
  }

  function install(force) {
    if (typeof window.generateGptPoster !== 'function' || typeof window.buildPosterPrompt !== 'function') return false;
    //  一定要包在精簡引擎(adlean.js)外面:它先換掉 buildPosterPrompt,我們再包它 —— 反過來會被它繞過
    if (!window.buildPosterPromptLean && !force) return false;
    if (window.generateGptPoster.__director) return true;
    var origGen = window.generateGptPoster;
    ensureBuild();

    window.generateGptPoster = async function () {
      pending = null;
      if (window.AD_DIRECTOR !== false) {
        try {
          var draft = ensureBuild().__inner();     // 當下的引擎抽一份(同時設好重拍 / 校正旗標)
          if (draft && draft.length <= MAX_DRAFT) {
            var isLayout = OLD_ENGINE.test(draft);
            if (typeof setPrStatus === 'function') setPrStatus(isLayout ? '🎬 AI 美術指導看商品、整理排版中…' : '🎬 AI 美術指導看商品、定拍法中…', 'var(--t3)');
            var fin = await direct(draft);
            pending = fin || draft;    // 兩次都失敗才用草稿,不重抽(旗標保持一致)
            var L = window._adDirectorLast || {};
            console.log('[AdDirector v' + VERSION + '] ' + (isLayout ? '排版圖 ' : '照片 ') + (fin ? '改寫完成 ' + draft.length + ' → ' + fin.length + ' 字' : '兩次都失敗,用草稿(' + L.error + ')') + ' · ' + (L.ms || 0) + 'ms · 試 ' + (L.tries || 0) + ' 次');
            if (!fin && typeof setPrStatus === 'function') setPrStatus('⚠️ AI 美術指導這次沒回應,改用標準拍法生成', 'var(--t3)');
          } else {
            console.warn('[AdDirector v' + VERSION + '] 草稿異常(' + (draft ? draft.length : 0) + ' 字),不改寫');
          }
        } catch (e) { pending = null; console.warn('[AdDirector] 略過:', e && e.message); }
      }
      return origGen.apply(this, arguments);
    };
    window.generateGptPoster.__director = true;
    return true;
  }

  //  ✍️ v1.2 字型一律用 MOZ 那套(RA 2026-11-11「MOZ 好看的也是壓字的,就照他」)
  //   MOZ 沒有專屬品牌包 → 用預設的乾淨黑體;其他品牌包寫了明朝 / 宋體 / 草寫 / 斜體襯線,AI 畫中文最容易變形
  //   做法:品牌包被讀出來的那一刻,把「Typography」那一行換成 MOZ 的,配色等其他設定照舊(精簡引擎與舊引擎都讀這裡)
  var MOZ_TYPE = 'clean Sans Serif (Inter / 思源黑體 Regular), restrained letter-spacing';
  function mozType(pack) {
    if (!pack || !pack.dna || window.AD_MOZ_TYPE === false) return pack;
    var dna = String(pack.dna).replace(/^-\s*Typography[^:\n]*:.*$/gim, '- Typography: ' + MOZ_TYPE);
    return dna === pack.dna ? pack : Object.assign({}, pack, { dna: dna });
  }
  function installType() {
    if (typeof window.detectBrandPack !== 'function') return false;
    if (window.detectBrandPack.__mozType) return true;
    var orig = window.detectBrandPack;
    window.detectBrandPack = function () { return mozType(orig.apply(this, arguments)); };
    window.detectBrandPack.__mozType = true;
    return true;
  }
  var tt = 0;
  (function waitType() { if (installType() || ++tt > 80) return; setTimeout(waitType, 250); })();

  //  等 admaker.js / adlean.js / ad-logotap.js 都掛好再包(最多等 15 秒)
  var tries = 0;
  (function wait() {
    tries++;
    if (install(tries > 60)) return;            // 15 秒還沒等到精簡引擎 → 直接包舊引擎
    if (tries > 80) { console.warn('[AdDirector] 找不到廣告圖函式,未啟用'); return; }
    setTimeout(wait, 250);
  })();

  //  精簡引擎晚載入時也立刻重新包上(不用等到下一次生成)
  setInterval(function () { if (typeof window.buildPosterPrompt === 'function' && !window.buildPosterPrompt.__director && window.generateGptPoster && window.generateGptPoster.__director) { ensureBuild(); console.log('[AdDirector] 提示詞函式被換掉 → 已重新包上'); } }, 2000);

  window.AdDirector = { version: VERSION, direct: direct, brief: brief, mozType: mozType, ensureBuild: ensureBuild };
  console.log('[AdDirector] v' + VERSION + ' AI 美術指導已載入(關閉:window.AD_DIRECTOR = false)');
})();
