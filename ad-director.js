// ═══════════════════════════════════════════════════════════════
//  🎬 ad-director.js v1.5(2026-11-12)廣告圖「AI 美術指導」—— 每一張廣告圖都經過美術指導
//  v1.7 RA 11-12 抽查 8 張回饋:先看懂商品用途(雲朵水餃包其實是眼鏡包)、對標 Nike/NB/精品/高級食品禮盒的拍法、
//       畫面不准出現客人以外的字(燈籠「香腸」、印章)、背景招牌 LOGO 不照抄、撞色避開國旗配色、手入鏡要自然
//  v1.6 字型:客人選的風格有寫字型就照風格(歐美雜誌 Didot、日系雅致明朝、水墨書法…共 13 種);沒寫才用 MOZ 黑體
//  v1.5 全選項清查(類型×版型 91 組、風格 91 × 情境 28):
//   · 主角照草稿認定(商品 / 模特兒 / 美業作品 / 專業人士 / 螢幕),人臉、作品、螢幕內容的保護句也一字不改
//   · 品牌包寫死的字型一律換 MOZ 黑體(風格字型的規則見 v1.6)
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
  var VERSION = '1.7';
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
      prodTag() ? '商品標籤:' + prodTag() : '',
      bc.adStyle ? '品牌調性:' + bc.adStyle : '',
      bc.spec ? '規格:' + bc.spec : '',
      bc.feature ? '特色:' + bc.feature : '',
      '客人選的類型:' + (pt || '(沒選)'),
      '版型:' + (safeLabel('LAYOUT_TEMPLATES', 'SELECTED_LAYOUT') || '(沒選)'),
      '風格:' + (safeLabel('REGIONAL_FLAVORS', 'SELECTED_FLAVOR') || '(沒選)'),
      '風格指定的字型:' + (styleType() || '(沒寫,用 MOZ 黑體)'),
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
      '10. 字型:【風格指定的字型】有寫 → 畫面上所有的字都用那個風格的字型(例如歐美雜誌風用 Didot 那種高反差銳利襯線),字形正確、筆畫乾淨、好讀;沒寫 → 一律用 MOZ 那套乾淨的無襯線黑體(Inter / 思源黑體 Regular)、字距收斂。草稿裡其他的字型描述(品牌包寫的明朝、宋體、書法、斜體等)都換成上面決定的這一個。',
      '11. 先看懂商品「是什麼、怎麼用」再決定拍法:商品名常是行銷暱稱(例如「雲朵水餃包」講的是形狀,實際可能是眼鏡包),要從照片的形狀、開口、尺寸、標籤與規格判斷真正的用途;畫面要讓人一眼看懂用途(眼鏡包就讓眼鏡收在裡面、掛在身上;真空包食品就讓人看到裡面的食物煮好有多好吃)。最終提示詞第一句就寫清楚這是什麼商品。',
      '12. 等級對標國際品牌廣告(Nike、New Balance、精品配件、高級食品禮盒)。依商品類型選最對的拍法:鞋與運動用品 → 深色或漸層的無縫攝影棚、側逆光把輪廓勾出來、用煙塵或粉末等材質效果呼應賣點,要「漂浮」就拍成棚內懸浮(有棚燈、有輪廓光、地面有倒影);隨身配件與包款 → 戴在人身上的局部特寫(胸口、腰間、手上),服裝與配件同色系,柔和側窗光;包裝食品(真空包、冷凍、禮盒) → 深色石板或深灰底、禮盒打開露出排列整齊的包裝,旁邊用盤子擺出實物(生鮮的油花紋理或料理好的油亮光澤),側光把包裝的透明感與食物的質地打出來,也可以是雙手捧著禮盒送出去的瞬間;療癒器物(頌缽、香氛、水晶) → 人正在使用的瞬間(手拿木槌敲缽、人躺著接受音浴、捧在掌心),或黃銅與材質的近距離特寫,大地色系(米、駝、棕、鼠尾草綠)、溫暖的自然側光、一點點霧氣,生活感與療癒感,畫面裡沒有宗教符號;工藝品與器物 → 當代藝術靜物,洞石或木石材質、自然光、大量留白;撞色風格 → 用高級的配色組合(紅＋橘＋薄荷、單一飽和色、酒紅＋米),硬光投影,避開像國旗的純紅純藍。',
      '13. 畫面上的字只有客人給的標題。招牌、燈籠、海報、印章、包裝以外的道具全部是素面沒有字;品牌 LOGO 只出現在商品本身原本印 LOGO 的位置,原照片背景裡的牆面招牌或 LOGO 不帶進新畫面(系統之後會另外疊上品牌 LOGO)。手入鏡時從畫面邊緣自然伸進來,手腕與前臂完整、姿勢優雅。',
      '',
      '你的回覆會原封不動交給生圖模型,所以第一個字就是提示詞的第一個字:只輸出最終提示詞本身,一段文字,不加標題、說明、前言或引號。'
    ].join('\n');
  }
  //  v1.6 RA 11-12「Didot 字型幫他用回來」:客人選的風格自己有寫字型 → 照風格(90 種裡有 13 種,逐一讀過原文)
  //   精簡引擎會把風格裡的字型描述拿掉(避免畫成排版),所以這裡直接從風格原文抽出來交給美術指導
  //   品牌包寫死的字型(明朝 / 宋體…)不在這裡,照舊換成 MOZ 黑體
  var TYPE_WORDS = /typograph|font|serif|lettering|headline|\bletters?\b|\btype\b|typeface|calligraph|handwrit|\bscript\b|glyph|\btext\b|wordmark/i;
  function styleType() {
    try {
      var f = (typeof REGIONAL_FLAVORS !== 'undefined' && typeof SELECTED_FLAVOR !== 'undefined') ? (REGIONAL_FLAVORS[SELECTED_FLAVOR] || {}) : {};
      return String(f.flavor || '').split(/(?<=[.;])\s+|,\s+/).filter(function (x) { return TYPE_WORDS.test(x); })
        .map(function (x) { return x.replace(/^Add [^:]*:\s*/i, '').replace(/[.;]\s*$/, '').trim(); }).join(', ');
    } catch (e) { return ''; }
  }
  function prodTag() { try { var p = (window.S && window.S.prod) || {}; return [p.tag, p.placeNote].filter(Boolean).join(' / '); } catch (e) { return ''; } }
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

  window.AdDirector = { version: VERSION, direct: direct, brief: brief, mozType: mozType, ensureBuild: ensureBuild, styleType: styleType };
  console.log('[AdDirector] v' + VERSION + ' AI 美術指導已載入(關閉:window.AD_DIRECTOR = false)');
})();
