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
  var VER = 'v0.9-library';

  // 🔧 v0.8:記住「這張正臉是誰的」—— 從形象庫勾選讀進來時,persona 跟著圖走,
  //   存 Drive 不再要求去 AI 生成器另外選 persona(那是舊流程的殘留)。
  var PICKED = { persona: '' };

  function K() { return window.KAI || null; }

  var FRONT = null;
  var RESULTS = { front: null, q34: null, profile: null };

  var ANGLES = [
    { key: 'q34', label: '3/4',
      prompt: 'Turn this exact same woman to a three-quarter view, her head rotated about 35 degrees to the side, keeping her identical face, identical facial features, identical hair and identical skin texture — only change the head angle, do NOT beautify or smooth the skin, keep it photographic and real' },
    { key: 'profile', label: '側臉',
      prompt: 'Rotate this exact same woman to a TRUE 90-degree side profile, her face turned fully to the side so we see only one side of her face, the bridge and tip of her nose forming a clear silhouette against the background, only the near eye and cheek visible, NOT a three-quarter view — keep her identical face, identical facial features, identical hair and identical skin texture, do NOT beautify or smooth the skin, keep it photographic and real' }
  ];

  function kontext(imageUrl, prompt) {
    var kai = K();
    return fetch(kai.WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: kai.PASSWORD, action: 'flux_kontext', image_url: imageUrl, prompt: prompt })
    }).then(function (r) { return r.json(); }).then(function (d) {
      if (!d.ok) throw new Error(d.error || 'Kontext 失敗');
      return d.images[0].url;
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
        status.textContent = '❌ Drive 取圖失敗:' + e.message;
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
        // ③ 再沒有 → 生成器面板裡的 fal / R2 圖(原本邏輯)
        if (!items.length) [].slice.call(document.querySelectorAll('.kai-panel img')).forEach(function (i) {
          if (i.closest('#cs-box')) return;
          var s = i.src || '';
          if (s.indexOf('fal.media') > -1 || s.indexOf('r2.dev') > -1) push(s, null, '');
        });
      }

      if (!items.length) {
        status.textContent = '沒有可用的正臉 → 去上面「KOL 形象庫」勾選(✓)一張,或先生一批 AI 正臉,或直接貼網址。';
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
            RESULTS[angleKey] = url2; img.src = url2; rb.textContent = '↻ 重生'; rb.disabled = false;
          }).catch(function (e) { rb.textContent = '❌ 重試'; rb.disabled = false; status.textContent = '❌ ' + e.message; });
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
          status.textContent = '✅ 三角度完成 — 看是不是同一個人、有沒有磨皮。OK 就「用這組」。';
          btnGen.disabled = false; btnGen.style.opacity = 1;
          btnUse.style.display = 'block';
        })
        .catch(function (e) { status.textContent = '❌ ' + e.message; btnGen.disabled = false; btnGen.style.opacity = 1; });
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
      btnUse.textContent = '💾 存進 Drive 中…(0/3)';   // 下方 set 固定三張(正臉+3/4+側臉)

      var ts = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      var set = [
        { angle: 'front', url: RESULTS.front },
        { angle: 'q34', url: RESULTS.q34 },
        { angle: 'profile', url: RESULTS.profile }
      ];
      var saved = [];

      (function next(i) {
        if (i >= set.length) {
          window.KOL_CHARACTER_SHEET = {
            brandId: brandId, persona: persona,
            front: RESULTS.front, threeQuarter: RESULTS.q34, profile: RESULTS.profile,
            drive: saved, ts: Date.now()
          };
          btnUse.style.background = '#0f7a42';
          btnUse.textContent = '✅ 已存進素材庫 · 人物表鎖定(' + saved.length + '/3)';
          if (typeof window.refreshAll === 'function') { try { window.refreshAll(); } catch (e) {} }
          return;
        }
        var a = set[i];
        kai.gasPost('saveKolPhoto', {
          brandId: brandId,
          personaName: persona,
          imageUrl: a.url,
          filename: persona + '_sheet_' + a.angle + '_' + ts + '.jpg',
          outfit: '',
          toProcessed: true,
          metadata: { source: 'flux_kontext', angle: a.angle, generated_at: new Date().toISOString() }
        }).then(function (res) {
          // ⚠️ 2026-08-22 起已無 Drive 編號(file_id 恆為空字串),改記網址才有意義
          if (res && res.ok) saved.push({ angle: a.angle, url: res.url || res.drive_url || '', filename: res.filename });
          btnUse.textContent = '💾 存檔中…(' + (i + 1) + '/3)';
          next(i + 1);
        }).catch(function (e) {
          btnUse.textContent = '❌ 存檔失敗:' + e.message;
          btnUse.disabled = false; btnUse.style.background = '#1f9d57';
        });
      })(0);
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();

  console.log('[character-sheet] 🎬 ' + VER + ' 就緒(Kontext 鎖臉 + 存進素材庫)');
})();
