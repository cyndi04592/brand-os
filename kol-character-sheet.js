/* kol-character-sheet.js · v0.9 — 多角度人物表(Kontext 鎖臉轉頭 + 存進素材庫)
   依賴 window.KAI(kol-ai-generator v3.30+ 提供 WORKER_URL / PASSWORD / S / gasPost / GAS_URL)
   機制:餵「同一張真實正臉」給 flux Kontext,各轉一次角度
        → 編輯真圖、只換角度 → 不磨皮、不換人(非重生成)
   每個角度都餵「原始正臉」,不連續編輯,避免累積飄移。
   v0.4:「用這組」→ 同 AI KOL 那條管線把三張存成永久資產;按鈕本身顯示狀態。
   v0.5(2026-08-22):落地點從 Google 雲端硬碟改成自家倉庫(Worker saveKolPhoto)。
         三張角度圖會寫進素材庫 category='KOL',KOL 照片庫立刻看得到。
   v0.6(2026-08-09):🔧 修「舊 KOL 只有正面照(存 Drive)→ 讀取不到」——
     ① 讀取來源加上頁面上所有 Drive 相簿縮圖(已處理/形象庫,drive.google.com/thumbnail)
     ② 點 Drive 圖 → 先走 Worker 現成的 drive_to_r2(service account 抓「原始全解析度」
        轉存 R2 乾淨網址)再餵 Kontext —— 縮圖只有 w400,直接餵會糊;Drive 網址 fal 也抓不動
     ③ 網址框貼 Drive 連結(含 id=)也自動轉存
*/
(function () {
  'use strict';
  var VER = 'v1.4-auto';

  // ══════════════════════════════════════════════════════════════════
  //  🩹 2026-09-07 · 錯誤訊息講人話
  //  ────────────────────────────────────────────────────────────────
  //  ★ 病:網路抖一下,客戶看到的是英文的「Failed to fetch」——
  //    看起來像系統壞了,而其實【再按一次就會成功】。
  //    現場實測:RA 按第二次就過了,但沒有任何地方告訴她可以再按。
  //  ★ 為什麼不做自動重試(RA 拍板只改文案):
  //    ERR_CONNECTION_CLOSED 的語意是「連線斷了,不知道伺服器收到沒」。
  //    存照片是【寫入】—— 自動重試可能存進兩張一樣的,
  //    而系統目前【沒有刪除照片的功能】(Worker 沒有 deleteKolPhoto),
  //    存錯了清不掉。要加重試,必須先確認 Worker 端擋不擋重複。
  // ══════════════════════════════════════════════════════════════════
  function friendlyErr(e) {
    var m = String((e && e.message) || e || '');
    if (/Failed to fetch|NetworkError|ERR_CONNECTION|ERR_NETWORK|Load failed/i.test(m))
      return '網路斷了一下,沒送出去 —— 再按一次就好(不會重複扣點)';
    if (/timeout|timed out|AbortError/i.test(m))
      return '等太久逾時了 —— 再按一次試試';
    if (/429|rate.?limit|too many/i.test(m))
      return '同時處理的人太多 —— 等 10 秒再按一次';
    if (/50[0234]|GAS_HTTP_5|GAS_UNAVAILABLE|系統忙碌/i.test(m))
      return '系統忙碌中 —— 等一下再按一次';
    if (/密碼|PWD|401|403/i.test(m))
      return '登入逾時了 —— 請重新整理頁面後再試';
    return m || '出了點問題 —— 再按一次試試';
  }


  // 🔧 v0.8:記住「這張正臉是誰的」—— 從形象庫勾選讀進來時,persona 跟著圖走,
  //   存 Drive 不再要求去 AI 生成器另外選 persona(那是舊流程的殘留)。
  var PICKED = { persona: '' };

  function K() { return window.KAI || null; }

  var FRONT = null;
  var RESULTS = { front: null, q34: null, profile: null };

  // ══════════════════════════════════════════════════════════════════
  //  🗑 2026-09-10 · v1.4「重生 = 覆蓋」的兩個必備零件
  //  ────────────────────────────────────────────────────────────────
  //  ① SAVED_IDS:記住每個角度存進素材庫後拿到的 assetId。
  //     deleteKolPhoto 只吃 assetId —— 傳 brandId+kolName 會把那個 KOL
  //     的照片【全部】刪光(正臉一起死),絕對不能走那條。
  //
  //  ② _stamp():檔名時間戳必須帶到【秒】。
  //     Worker 的去重是 brand_id + kol_name + file_name 三者相同就
  //     「回傳既有那張、不存新的」,而且那句查詢【沒有】過濾 visible=1。
  //     deleteKolPhoto 又是軟刪除(只把 visible 改 0)——
  //     所以舊檔名會永遠卡住重存。只有日期的話,同一天重生就死在這。
  // ══════════════════════════════════════════════════════════════════
  var SAVED_IDS = {};      // { q34: assetId, profile: assetId }
  var AUTO = false;        // autoRun 進來的那一輪,生成完要自動存

  function _stamp() {
    var d = new Date();
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return '' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' +
           p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
  }

  var ANGLES = [
    { key: 'q34', label: '3/4',
      prompt: 'Turn this exact same woman to a three-quarter view, her head rotated about 35 degrees to the side, keeping her identical face, identical facial features, identical hair and identical skin texture — only change the head angle, do NOT beautify or smooth the skin, keep it photographic and real' },
    { key: 'profile', label: '側臉',
      prompt: 'Rotate this exact same woman to a TRUE 90-degree side profile, her face turned fully to the side so we see only one side of her face, the bridge and tip of her nose forming a clear silhouette against the background, only the near eye and cheek visible, NOT a three-quarter view — keep her identical face, identical facial features, identical hair and identical skin texture, do NOT beautify or smooth the skin, keep it photographic and real' }
  ];

  // ═══════════════════════════════════════════════════════════════════════
  //  🪣 2026-09-05 角度圖一律轉存自家 R2 再顯示(白標根治)
  //  ★ 病灶:角度圖原本直接用影像引擎回傳的網址塞進 <img src>(三處預覽都是),
  //    瀏覽器一載入,【Network 分頁就會列出供應商網域】。
  //    ⚠️ Console 保險絲擋不住 Network,只有換掉網址才擋得住。
  //  ★ kontext() 是這支檔案唯一的產圖收口 —— 在這裡包一層,三處預覽全部受惠,
  //    不用分別去改三個 img.src(那正是「同一件事改三個地方」的坑)。
  //  ★ 附帶好處:引擎網址是暫時的,轉存後角度圖不會過期。
  //  ★ 沿用既有 scene_grid 動作,不動 Worker;失敗沿用原網址,不擋流程。
  // ═══════════════════════════════════════════════════════════════════════
  function _csKey(url) {
    var h = 0, t = String(url || '');
    for (var i = 0; i < t.length; i++) h = ((h << 5) - h + t.charCodeAt(i)) | 0;
    return 'csheet_' + (h >>> 0).toString(36) + '_' + Date.now().toString(36);
  }
  function _csToR2(url) {
    if (!url || /cdn\.raby\.com\.tw/.test(url)) return Promise.resolve(url);
    var kai = K();
    return fetch(kai.WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        password: kai.PASSWORD, action: 'scene_grid',
        brandId: (window.S && window.S.currentBrandId) || 'csheet',
        sceneKey: _csKey(url), storeUrl: url
      })
    }).then(function (r) { return r.json(); })
      .then(function (d) { return (d && d.ok && d.url) ? d.url : url; })
      .catch(function () { return url; });
  }

  function kontext(imageUrl, prompt) {
    var kai = K();
    return fetch(kai.WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: kai.PASSWORD, action: 'flux_kontext', image_url: imageUrl, prompt: prompt })
    }).then(function (r) { return r.json(); }).then(function (d) {
      if (!d.ok) throw new Error(d.error || 'Kontext 失敗');
      return _csToR2(d.images[0].url);   // 🪣 顯示之前先轉存自家 R2
    });
  }

  function el(tag, css, html) { var e = document.createElement(tag); if (css) e.style.cssText = css; if (html != null) e.innerHTML = html; return e; }
  function btnCss(bg, big) {
    return 'border:none;border-radius:8px;cursor:pointer;color:#fff;background:' + bg + ';' +
      (big ? 'width:100%;padding:10px;font-weight:700;font-size:13px;' : 'padding:6px 12px;font-size:12px;');
  }

  function build() {
    var panel = document.querySelector('.kai-panel');
    if (!panel) { setTimeout(build, 800); return; }
    if (document.getElementById('cs-box')) return;

    var box = el('div', 'margin-top:18px;padding:14px;border:1px solid #2e2e3a;border-radius:12px;background:#16161d;');
    box.id = 'cs-box';
    box.appendChild(el('div', 'font-weight:700;color:#cdb4ff;margin-bottom:4px;', '🎬 多角度人物表 <span style="font-size:11px;color:#888;">Kontext 鎖臉 · ' + VER + '</span>'));
    box.appendChild(el('div', 'font-size:12px;color:#9a9aa8;line-height:1.6;margin-bottom:10px;',
      '挑一張滿意的<b>正臉</b> → 一鍵用 Kontext「鎖臉轉頭」生 3/4 + 側臉。<br>是<b>編輯真圖換角度</b>、不是重生成 → 不磨皮、不換人。「用這組」會把三張<b>存進素材庫</b>(永久,不怕網址過期)。'));

    var row1 = el('div', 'display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap;');
    var btnLoad = el('button', btnCss('#3a3a4a'), '① 讀取上面的正臉');
    var inUrl = el('input', 'flex:1;min-width:160px;background:#0e0e14;border:1px solid #2e2e3a;border-radius:8px;color:#ddd;padding:6px 8px;font-size:12px;');
    inUrl.placeholder = '或直接貼正臉圖網址';
    row1.appendChild(btnLoad); row1.appendChild(inUrl);
    box.appendChild(row1);

    var thumbs = el('div', 'display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;');
    box.appendChild(thumbs);
    var picked = el('div', 'font-size:12px;color:#7ee0a0;margin-bottom:10px;min-height:16px;');
    box.appendChild(picked);

    var btnGen = el('button', btnCss('#6c4cf0', true), '② 生成 3/4 + 側臉(鎖臉轉頭)');
    btnGen.disabled = true; btnGen.style.opacity = .5;
    box.appendChild(btnGen);

    var status = el('div', 'font-size:12px;color:#9a9aa8;margin:8px 0;');
    box.appendChild(status);
    var cards = el('div', 'display:flex;gap:8px;flex-wrap:wrap;');
    box.appendChild(cards);

    var btnUse = el('button', btnCss('#1f9d57', true), '✅ 用這組當人物表(存進素材庫)');
    btnUse.style.display = 'none'; btnUse.style.marginTop = '10px';
    box.appendChild(btnUse);

    panel.appendChild(box);

    // 品牌與 persona 的來源順位(btnUse 原本寫在自己裡面,現在三處共用)
    function ctx() {
      var kai = K();
      var brandId = (kai && kai.S && kai.S.currentBrandId) ||
                    (window.S && window.S.currentBrandId) || '';
      var persona = PICKED.persona || (kai && kai.S && kai.S.currentPersonaName) || '';
      if (!kai || !brandId || !persona || typeof kai.gasPost !== 'function') return null;
      return { kai: kai, brandId: brandId, persona: persona };
    }

    function saveAngle(angleKey, url) {
      var c = ctx();
      if (!c) return Promise.reject(new Error('讀不到品牌/persona'));
      return c.kai.gasPost('saveKolPhoto', {
        brandId: c.brandId, personaName: c.persona, imageUrl: url,
        filename: c.persona + '_sheet_' + angleKey + '_' + _stamp() + '.jpg',
        outfit: '', toProcessed: true,
        metadata: { source: 'flux_kontext', angle: angleKey, generated_at: new Date().toISOString() }
      });
    }

    //  ⚠️ 順序是「先存新的、成功了才刪舊的」,不能反過來。
    //     反過來(先刪再存)一旦存失敗,客戶手上兩張都沒有 —— 那是照片消失,
    //     比多留一張垃圾嚴重得多。刪失敗只是多一張沒人用的圖。
    function delOld(assetId) {
      var c = ctx();
      if (!c || !assetId) return Promise.resolve(false);
      return c.kai.gasPost('deleteKolPhoto', { assetId: assetId, apply: true })
        .then(function (r) { return !!(r && r.ok && r.applied); })
        .catch(function (e) {
          console.warn('[character-sheet] 舊圖沒刪掉(新圖已存好,不影響使用):', e);
          return false;
        });
    }

    function setFront(url) {
      FRONT = url;
      picked.textContent = url ? '✅ 已選正臉:…' + url.slice(-26) : '';
      btnGen.disabled = !url; btnGen.style.opacity = url ? 1 : .5;
    }

    // 🔧 v0.6:Drive 圖先轉 R2 乾淨網址再當正臉(縮圖只有 w400、fal 抓不動 Drive 網址)
    //   走 Worker 現成的 drive_to_r2(商品照同一條,service account 抓原始全解析度)
    function frontFromDrive(driveId, doneCb) {
      var kai = K();
      var st = kai && kai.S;
      status.textContent = '📥 從 Drive 取原圖轉存中…(第一次約 3–8 秒,之後同一張秒回)';
      fetch(kai.WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: kai.PASSWORD, action: 'drive_to_r2', driveFileId: driveId,
          brandId: (st && st.currentBrandId) || 'unknown', role: 'kolsheet', nameHint: 'sheet_front'
        })
      }).then(function (r) { return r.json(); }).then(function (d) {
        if (!d.ok || !d.url) throw new Error(d.error || 'drive_to_r2 失敗');
        setFront(d.url);
        status.textContent = '✅ 原圖已就緒(全解析度),可以生成了。';
        if (doneCb) doneCb(true);
      }).catch(function (e) {
        status.textContent = '❌ 取原圖失敗:' + friendlyErr(e);
        if (doneCb) doneCb(false);
      });
    }

    // 🔧 v0.7(RA 拍板):讀取邏輯改「你勾哪張、就讀哪張」——
    //   最優先抓上面「KOL 形象庫」已勾選(✓)的照片(.drive-photo.selected 自帶 file-id + persona),
    //   不再把整頁 100 個 KOL 的相簿全倒出來。沒勾選才退回這一輪剛生成的 AI 正臉。
    function renderThumbs(items) {
      items.forEach(function (it) {
        var wrap = el('div', 'position:relative;');
        var t = el('img', 'width:70px;height:90px;object-fit:cover;border-radius:8px;cursor:pointer;border:2px solid transparent;display:block;');
        t.src = it.url;
        if (it.driveId) wrap.appendChild(el('div', 'position:absolute;top:2px;left:2px;font-size:10px;background:rgba(0,0,0,.55);border-radius:4px;padding:0 3px;pointer-events:none;', '📁' + (it.label ? ' ' + it.label : '')));
        t.onclick = function () {
          [].forEach.call(thumbs.querySelectorAll('img'), function (c) { c.style.borderColor = 'transparent'; });
          t.style.borderColor = '#7ee0a0';
          PICKED.persona = it.label || '';   // v0.8:persona 跟著圖走
          if (it.driveId) frontFromDrive(it.driveId);
          else setFront(it.url);
        };
        wrap.appendChild(t);
        thumbs.appendChild(wrap);
        if (it.autoPick) t.onclick();   // 只勾一張 → 免再點,直接取原圖
      });
    }

    btnLoad.onclick = function () {
      thumbs.innerHTML = '';
      var items = [];   // { url: 縮圖/網址, driveId: 有值=Drive 圖要先轉存, label: persona 名 }
      var seen = {};
      function push(u, driveId, label) { var k = driveId || u; if (!k || seen[k]) return; seen[k] = 1; items.push({ url: u, driveId: driveId || null, label: label || '' }); }

      // ① 最優先:形象庫「已勾選 ✓」的照片(跟「加入 Look」同一套勾選)
      [].slice.call(document.querySelectorAll('.drive-photo.selected')).forEach(function (d) {
        var img = d.querySelector('img');
        if (img && img.src) push(img.src, d.getAttribute('data-file-id'), d.getAttribute('data-persona') || '');
      });
      var fromGallery = items.length > 0;

      var fromPicked = false;
      if (!fromGallery) {
        // 🆕 2026-08-19 ②-0 最優先:上面生成器已經按過「✓ 選這張」的那張。
        //   舊行為:直接把整批 lastImages 全撈出來要你「再點一次」——
        //   你上面明明按了 #3「已選用」,下面還是跳出三張,等於白選,
        //   而且很容易點錯一張就拿去生整組多角度(那組會存進 Drive 變成永久的臉)。
        //   判斷依據:kol-ai-generator 在按下「選這張」時把該張標成 saved=true。
        var _st0 = K() && K().S;
        if (_st0 && Array.isArray(_st0.lastImages)) {
          _st0.lastImages.forEach(function (x) {
            if (x && x.saved) { push(x.url || x, null, ''); fromPicked = true; }
          });
        }
        if (fromPicked) {
          // 只有一張已選用 → 直接當正臉,不用再點
          if (items.length === 1) items[0].autoPick = true;
          status.textContent = items.length === 1
            ? '已沿用你上面選的那張,自動取原圖中…'
            : ('已沿用你上面選的 ' + items.length + ' 張,點一張當正臉:');
          renderThumbs(items);
          return;
        }
        // ② 沒勾選也沒選過 → 這一輪剛生成的 AI 正臉(原本邏輯)
        var st = K() && K().S;
        if (st && st.lastImages && st.lastImages.length) st.lastImages.forEach(function (x) { push(x.url || x, null, ''); });
        // ③ 再沒有 → 生成器面板裡的產出圖
        //  ⚠️ 2026-09-05:這裡是靠【網址長相】辨識「這是產出圖」。
        //    白標改動把候選圖轉存自家 CDN 之後,網址不再含舊的網域字樣 ——
        //    若不同步補上 cdn.raby.com.tw,這條偵測會【一張都找不到】,
        //    而且不會報錯,只會顯示「沒有可用的正臉」。舊網域保留當回溯相容。
        if (!items.length) [].slice.call(document.querySelectorAll('.kai-panel img')).forEach(function (i) {
          if (i.closest('#cs-box')) return;
          var s = i.src || '';
          if (s.indexOf('cdn.raby.com.tw') > -1 || s.indexOf('fal.media') > -1 || s.indexOf('r2.dev') > -1) push(s, null, '');
        });

        // ══════════════════════════════════════════════════════════════
        //  ⑤ 2026-09-07:【已經建好的角色】—— 這一條以前完全不存在。
        //  ★ 病灶:上面四個來源全部都要「你剛剛才生成」才有東西
        //    (勾選中 / 剛按選這張 / 這一輪產出 / 生成器面板裡的圖)。
        //    角色建好、重新整理、隔天回來想補角度 → 四個來源全空,
        //    畫面卻叫你「去上面 KOL 形象庫勾選一張」,而客戶勾了也不一定對。
        //    等於【角度表只有一鼓作氣做完才走得通】,中斷就再也接不回去。
        //  ★ 後果不會報錯:接片端抓不到 3/4 與側臉會自動退回正臉,
        //    影片照樣生得出來,只是每一段都同一張臉 —— 品質無聲流失。
        //  ★ 取圖規則【必須】跟 kol.html:4404 一致:
        //    不能拿角色代表照(image_url)當正臉 —— 實測有六位的代表照
        //    被綁成了側臉那張(生完角度照回照片庫綁定時,側臉排最前面)。
        //    真正的正臉是素材庫裡的原始形象照:檔名含 _ai_、且不是 sheet_ 那批。
        //  ⚠️ 改這裡時務必同步看 kol.html:4404 —— 同一條規則寫在兩個地方,
        //    這是已知的重複,先求「兩邊一致」,收口另外排。
        // ══════════════════════════════════════════════════════════════
        if (!items.length) {
          try {
            var _S = window.S || {};
            var _nm = String((_S.selectedKol && (_S.selectedKol.name ||
                      (_S.selectedKol.persona && _S.selectedKol.persona.persona_name))) || '')
                      .replace(/\s+/g, '').toLowerCase();
            var _pl = (_S.drivePhotos && _S.drivePhotos.personas) || [];
            var _pe = _pl.filter(function (x) {
              return String(x.persona_name || '').replace(/\s+/g, '').toLowerCase() === _nm;
            })[0];
            var _isSheet = function (n) { return /sheet_(q34|profile|front)/i.test(n || ''); };
            var _all = (_pe && _pe.photos) || [];
            //  🩹 2026-09-07:這裡【不能只取第一張】——
            //    「✓ 選這張」的語意是「存進照片庫」,不是「設為這個角色的臉」,
            //    所以一個角色本來就可能有好幾張正臉(客戶把三張候選存了兩張)。
            //    只取 [0] 會讓客戶【沒機會選】要拿哪一張去生角度表,而且不出聲。
            //    → 全部撈出來,只有剛好一張時才自動選定。
            var _hits = _all.filter(function (x) { return /_ai_/i.test(x.name || '') && !_isSheet(x.name); });
            if (!_hits.length) _hits = _all.filter(function (x) { return !_isSheet(x.name); });
            if (_hits.length) {
              //  欄位名對齊 kol.html:4794 的實際資料:file_id / url / thumbnail_url
              //  ⚠️ 帶 file_id 進去,renderThumbs 才會去取【全解析度原圖】——
              //     縮圖拿去 Kontext 轉頭會糊掉(縮圖只能顯示,不能餵引擎)。
              _hits.forEach(function (h) {
                push(h.url || h.thumbnail_url, h.file_id || null, _pe.persona_name || '');
              });
            } else {
              // 素材庫裡找不到 → 退回目前選定的造型圖(至少讓客戶有東西可用)
              var _look = (_S.availableLooks || []).filter(function (l) { return l.id === _S.selectedLookId; })[0];
              var _u = (_look && _look.image_url) || (_S.selectedKol && _S.selectedKol.image_url);
              if (_u) push(_u, null, (_S.selectedKol && _S.selectedKol.name) || '');
            }
            if (items.length) {
              var _who = (_S.selectedKol && _S.selectedKol.name) || '這位 KOL';
              if (items.length === 1) {
                items[0].autoPick = true;
                status.textContent = '讀到「' + _who + '」的正臉,取原圖中…';
              } else {
                //  ⚠️ 多張時【不自動選】—— 角度表會拿這張去生 3/4 與側臉並存進素材庫,
                //     選錯等於幫這位角色定了一張不想要的臉,而且要重生一次才救得回來。
                status.textContent = '「' + _who + '」有 ' + items.length + ' 張照片 · 點一張當正臉(角度表會照這張生 3/4 與側臉):';
              }
              renderThumbs(items);
              return;
            }
          } catch (_e) {}
        }
      }

      if (!items.length) {
        status.textContent = '找不到這位 KOL 的正臉照 —— 可能是素材庫還沒載完(等一下再按),或這位角色還沒有形象照。可以去上面「KOL 形象庫」勾選(✓)一張、先生一批 AI 正臉,或直接貼網址。';
        return;
      }

      if (fromGallery && items.length === 1) {
        // 勾了剛好一張 → 最順路:直接當正臉,自動取原圖
        items[0].autoPick = true;
        status.textContent = '讀到你勾選的那張(' + (items[0].label || '') + '),自動取原圖中…';
        renderThumbs(items);
        return;
      }
      status.textContent = fromGallery
        ? ('讀到你勾選的 ' + items.length + ' 張,點一張當正臉:')
        : '點一張當正臉:';
      renderThumbs(items);
    };

    inUrl.oninput = function () {
      var v = inUrl.value.trim();
      if (v.indexOf('http') !== 0) return;
      PICKED.persona = '';   // v0.8:手貼網址不知道是誰的 → 存檔時退回生成器選的 persona
      // 🔧 v0.6:貼的是 Drive 連結 → 抽 fileId 自動轉存;其他網址照舊直接用
      var m = v.match(/drive\.google\.com\/(?:thumbnail\?id=|uc\?id=|file\/d\/|open\?id=)([a-zA-Z0-9_-]+)/) || v.match(/[?&]id=([a-zA-Z0-9_-]{20,})/);
      if (m && v.indexOf('drive.google.com') > -1) frontFromDrive(m[1]);
      else setFront(v);
    };

    function card(label, url, angleKey) {
      var c = el('div', 'width:120px;');
      c.appendChild(el('div', 'font-size:11px;color:#aaa;text-align:center;margin-bottom:3px;', label));
      var img = el('img', 'width:120px;height:160px;object-fit:cover;border-radius:8px;display:block;');
      img.src = url; c.appendChild(img);
      if (angleKey) {
        var rb = el('button', 'width:100%;margin-top:4px;font-size:11px;padding:4px;border:none;border-radius:6px;background:#3a3a4a;color:#ddd;cursor:pointer;', '↻ 重生');
        rb.onclick = function () {
          var ang = ANGLES.filter(function (a) { return a.key === angleKey; })[0];
          rb.textContent = '…生成中'; rb.disabled = true;
          kontext(FRONT, ang.prompt).then(function (url2) {
            RESULTS[angleKey] = url2; img.src = url2;

            var oldId = SAVED_IDS[angleKey];
            // 還沒存過(手動流程、客戶還沒按「用這組」)→ 只換畫面,照舊
            if (!oldId) { rb.textContent = '↻ 重生'; rb.disabled = false; return null; }

            rb.textContent = '…存檔中';
            status.textContent = '💾 新的' + label + '存檔中…';
            return saveAngle(angleKey, url2).then(function (res) {
              if (!res || !res.ok) throw new Error((res && res.error) || '存檔失敗');
              SAVED_IDS[angleKey] = res.assetId || null;
              return delOld(oldId);
            }).then(function (delOk) {
              rb.textContent = '↻ 重生'; rb.disabled = false;
              status.textContent = delOk
                ? ('✅ ' + label + '已換新,舊的那張已從素材庫清掉。')
                : ('✅ ' + label + '已換新 —— 但舊的那張沒刪成功,素材庫會多一張,之後用刪除鍵清。');
              if (typeof window.refreshAll === 'function') { try { window.refreshAll(); } catch (_) {} }
            });
          }).catch(function (e) { rb.textContent = '❌ 重試'; rb.disabled = false; status.textContent = '❌ ' + friendlyErr(e); });
        };
        c.appendChild(rb);
      }
      return c;
    }

    btnGen.onclick = function () {
      if (!FRONT) return;
      btnGen.disabled = true; btnGen.style.opacity = .5;
      status.textContent = '🎬 Kontext 鎖臉轉頭中…(約 10–20 秒)';
      cards.innerHTML = ''; btnUse.style.display = 'none';
      btnUse.disabled = false; btnUse.style.background = '#1f9d57'; btnUse.textContent = '✅ 用這組當人物表(存進素材庫)';
      RESULTS = { front: FRONT, q34: null, profile: null };
      Promise.all(ANGLES.map(function (a) { return kontext(FRONT, a.prompt).then(function (u) { RESULTS[a.key] = u; }); }))
        .then(function () {
          cards.appendChild(card('正臉(原圖)', RESULTS.front, null));
          cards.appendChild(card('3/4', RESULTS.q34, 'q34'));
          cards.appendChild(card('側臉', RESULTS.profile, 'profile'));
          btnGen.disabled = false; btnGen.style.opacity = 1;
          btnUse.style.display = 'block';

          if (AUTO) {
            //  🆕 v1.4:自動流程不再問第二次 —— 客戶按「✓ 選這張」的當下就已經
            //     在三張臉裡挑好了,把關已經發生過。這裡再擋一顆按鈕,
            //     現場實測的結果是客戶直接走人,角色永遠停在只有正臉、拍不了片。
            AUTO = false;
            status.textContent = '💾 三角度完成,存進素材庫中…';
            btnUse.onclick();
          } else {
            status.textContent = '✅ 三角度完成 — 看是不是同一個人、有沒有磨皮。OK 就「用這組」。';
          }
        })
        .catch(function (e) { status.textContent = '❌ ' + friendlyErr(e); btnGen.disabled = false; btnGen.style.opacity = 1; });
    };

    btnUse.onclick = function () {
      var kai = K();
      // 🔧 v0.8:來源順位 —— ①勾選照片自帶的 persona ②AI 生成器選的 persona;
      //   品牌 ID:①生成器的 ②頁面本身選的(window.S)。存誰的臉就進誰的資料夾。
      var brandId = (kai && kai.S && kai.S.currentBrandId) ||
                    (window.S && window.S.currentBrandId) || '';
      var persona = PICKED.persona || (kai && kai.S && kai.S.currentPersonaName) || '';
      if (!brandId || !persona) { btnUse.textContent = '⚠️ 讀不到品牌/persona —— 從形象庫勾一張照片再讀取,或在生成器選 persona'; return; }
      if (typeof kai.gasPost !== 'function') { btnUse.textContent = '⚠️ 需更新 kol-ai-generator → v3.30'; return; }

      btnUse.disabled = true;
      btnUse.style.background = '#3a3a4a';
      btnUse.textContent = '💾 存檔中…(0/2)';   // 只存 3/4 與側臉;正臉已在素材庫

      // 🩹 v1.4:檔名時間戳搬進 saveAngle(),並且從「只有日期」升到「帶秒」——
      //   理由見檔頭 _stamp() 註解(舊檔名會被 Worker 去重永久卡住)。
      // 🩹 2026-08-22 根治「每次生成都有兩張正臉」:
      //   RESULTS.front 就是客戶稍早按「✓ 選這張」存進素材庫的那張原圖 ——
      //   這裡再存一次,等於同一張圖用兩個檔名躺在素材庫裡。
      //   後果不只是難看:建立角色時兩張都被綁進 Look → 造型選單出現雙胞胎 →
      //   系統誤判「這人有多套造型」→ 把多角度卡整批藏起來。
      //   一個重複,連鎖三個症狀。
      //   ★ 3/4 與側臉是 Kontext 新生成的,素材庫沒有,一定要存。
      //   ⚠️ 正臉仍寫進 KOL_CHARACTER_SHEET(下游要拿它當鎖臉錨點),只是不重複落檔。
      var set = [
        { angle: 'q34', url: RESULTS.q34 },
        { angle: 'profile', url: RESULTS.profile }
      ];
      var saved = [{ angle: 'front', url: RESULTS.front, filename: '(已在素材庫,不重複存)' }];

      (function next(i) {
        if (i >= set.length) {
          window.KOL_CHARACTER_SHEET = {
            brandId: brandId, persona: persona,
            front: RESULTS.front, threeQuarter: RESULTS.q34, profile: RESULTS.profile,
            drive: saved, ts: Date.now()
          };
          btnUse.style.background = '#0f7a42';
          btnUse.textContent = '✅ 已存進素材庫 · 人物表鎖定(' + saved.length + '/3)';   // 3 = 正臉(既有)+3/4+側臉
          if (typeof window.refreshAll === 'function') { try { window.refreshAll(); } catch (e) {} }
          return;
        }
        var a = set[i];
        saveAngle(a.angle, a.url).then(function (res) {
          // ⚠️ 2026-08-22 起已無 Drive 編號(file_id 恆為空字串),改記網址才有意義
          if (res && res.ok) {
            saved.push({ angle: a.angle, url: res.url || res.drive_url || '', filename: res.filename });
            // 🆕 v1.4:記住編號 —— 之後按「↻ 重生」要靠它刪掉這一張
            SAVED_IDS[a.angle] = res.assetId || null;
            if (!res.assetId) console.warn('[character-sheet] ⚠ Worker 沒回 assetId(' + a.angle + ')→ 重生時舊圖會刪不掉');
          }
          btnUse.textContent = '💾 存檔中…(' + (i + 1) + '/2)';   // 只存 3/4 與側臉
          next(i + 1);
        }).catch(function (e) {
          //  ⚠️ 這裡是【寫入】失敗 —— 按鈕文字要留住,不能被下一輪蓋掉,
          //     而且必須明講「再按一次會從頭存」,客戶才知道不是白按。
          btnUse.textContent = '❌ 存檔失敗 · 點我再試一次';
          btnUse.title = friendlyErr(e);
          btnUse.disabled = false; btnUse.style.background = '#1f9d57';
          try { status.textContent = '❌ 存檔失敗:' + friendlyErr(e); } catch (_) {}
        });
      })(0);
    };

    // ══════════════════════════════════════════════════════════════════
    //  🆕 2026-09-09 · v1.3 對外自動入口 window.KCS.autoRun(frontUrl)
    //  ────────────────────────────────────────────────────────────────
    //  ★ 為什麼要這個:客戶按完「✓ 選這張」之後,①讀取正臉 / ②生成
    //    這兩顆按鈕其實沒有選擇餘地 —— 正臉只有一張(第 198 行的
    //    autoPick 早就自動勾了),而多角度是五鎖影片的【必經之路】
    //    (沒有 sheet_front/q34/profile 就拍不了片)。兩顆儀式性按鈕。
    //
    //  ★ 為什麼【不】把存檔(btnUse)也自動化:
    //    Kontext 轉頭偶爾會歪臉/磨皮。生成可以重按 ② 重來,
    //    存檔是寫進素材庫、目前清起來很麻煩。
    //    那顆綠色按鈕是唯一的品質關卡,必須留給人。
    //
    //  ★ 這裡【繞過 ① btnLoad】直接 setFront:呼叫端(選這張)手上
    //    已經有存完的 R2 網址了,再去 DOM 撈一次只會多一個失敗點。
    //
    //  ★ 單獨驗證方式(不必改 kol-ai-generator.js):
    //      window.KCS.autoRun('https://…正臉圖網址…')
    // ══════════════════════════════════════════════════════════════════
    window.KCS = window.KCS || {};
    window.KCS.autoRun = function (frontUrl) {
      if (!frontUrl) { console.warn('[character-sheet] autoRun:沒給正臉網址'); return false; }
      // 正在生成中就不要插隊(btnGen 生成期間會被 disable)
      if (btnGen.disabled && FRONT) { console.warn('[character-sheet] autoRun:上一輪還在生成,略過'); return false; }
      try { box.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_) {}
      SAVED_IDS = {};          // 換人了,上一輪的編號不能留(會刪到別人的照片)
      AUTO = true;             // 生成完自動接存檔,見 btnGen 成功分支
      setFront(frontUrl);
      status.textContent = '🎬 已自動帶入正臉,開始生 3/4 + 側臉…';
      btnGen.onclick();
      return true;
    };
    // 呼叫端用這個判斷面板建好了沒(build 有可能還在 setTimeout 重試)
    window.KCS.ready = true;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();

  console.log('[character-sheet] 🎬 ' + VER + ' 就緒(Kontext 鎖臉 + 存進素材庫 + window.KCS.autoRun 自動入口)');
})();
