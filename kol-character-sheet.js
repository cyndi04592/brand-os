/* kol-character-sheet.js · v0.4 — 多角度人物表(Kontext 鎖臉轉頭 + 存 Drive)
   依賴 window.KAI(kol-ai-generator v3.30+ 提供 WORKER_URL / PASSWORD / S / gasPost / GAS_URL)
   機制:餵「同一張真實正臉」給 flux Kontext,各轉一次角度
        → 編輯真圖、只換角度 → 不磨皮、不換人(非重生成)
   每個角度都餵「原始正臉」,不連續編輯,避免累積飄移。
   v0.4:「用這組」→ 同 AI KOL 那條管線(saveAiKolPhotoToDrive)把三張存進 Drive 變永久資產;按鈕本身顯示狀態。
*/
(function () {
  'use strict';
  var VER = 'v0.4-kontext';

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
      '挑一張滿意的<b>正臉</b> → 一鍵用 Kontext「鎖臉轉頭」生 3/4 + 側臉。<br>是<b>編輯真圖換角度</b>、不是重生成 → 不磨皮、不換人。「用這組」會把三張<b>存進 Drive</b>(永久,不怕網址過期)。'));

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

    var btnUse = el('button', btnCss('#1f9d57', true), '✅ 用這組當人物表(存 Drive)');
    btnUse.style.display = 'none'; btnUse.style.marginTop = '10px';
    box.appendChild(btnUse);

    panel.appendChild(box);

    function setFront(url) {
      FRONT = url;
      picked.textContent = url ? '✅ 已選正臉:…' + url.slice(-26) : '';
      btnGen.disabled = !url; btnGen.style.opacity = url ? 1 : .5;
    }

    btnLoad.onclick = function () {
      thumbs.innerHTML = '';
      var imgs = [];
      var st = K() && K().S;
      if (st && st.lastImages && st.lastImages.length) imgs = st.lastImages.map(function (x) { return x.url || x; });
      if (!imgs.length) {
        imgs = [].slice.call(document.querySelectorAll('.kai-panel img'))
          .filter(function (i) { return !i.closest('#cs-box'); })
          .map(function (i) { return i.src; })
          .filter(function (s) { return s && (s.indexOf('fal.media') > -1 || s.indexOf('r2.dev') > -1); });
        imgs = imgs.filter(function (v, i) { return imgs.indexOf(v) === i; });
      }
      if (!imgs.length) { status.textContent = '上面還沒有結果 → 先生一批正臉,或直接貼網址。'; return; }
      status.textContent = '點一張當正臉:';
      imgs.forEach(function (u) {
        var t = el('img', 'width:70px;height:90px;object-fit:cover;border-radius:8px;cursor:pointer;border:2px solid transparent;');
        t.src = u;
        t.onclick = function () {
          [].forEach.call(thumbs.children, function (c) { c.style.borderColor = 'transparent'; });
          t.style.borderColor = '#7ee0a0';
          setFront(u);
        };
        thumbs.appendChild(t);
      });
    };

    inUrl.oninput = function () { var v = inUrl.value.trim(); if (v.indexOf('http') === 0) setFront(v); };

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
      btnUse.disabled = false; btnUse.style.background = '#1f9d57'; btnUse.textContent = '✅ 用這組當人物表(存 Drive)';
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
      var brandId = kai && kai.S && kai.S.currentBrandId;
      var persona = kai && kai.S && kai.S.currentPersonaName;
      if (!brandId || !persona) { btnUse.textContent = '⚠️ 上面先選好品牌+persona(米禾)再存'; return; }
      if (typeof kai.gasPost !== 'function') { btnUse.textContent = '⚠️ 需更新 kol-ai-generator → v3.30'; return; }

      btnUse.disabled = true;
      btnUse.style.background = '#3a3a4a';
      btnUse.textContent = '💾 存進 Drive 中…(0/3)';

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
          btnUse.textContent = '✅ 已存 Drive · 人物表鎖定(' + saved.length + '/3)';
          if (typeof window.refreshAll === 'function') { try { window.refreshAll(); } catch (e) {} }
          return;
        }
        var a = set[i];
        kai.gasPost('saveAiKolPhotoToDrive', {
          brandId: brandId,
          personaName: persona,
          imageUrl: a.url,
          filename: persona + '_sheet_' + a.angle + '_' + ts + '.jpg',
          outfit: '',
          metadata: { source: 'flux_kontext', angle: a.angle, generated_at: new Date().toISOString() }
        }).then(function (res) {
          if (res && res.ok) saved.push({ angle: a.angle, file_id: res.file_id, filename: res.filename });
          btnUse.textContent = '💾 存進 Drive 中…(' + (i + 1) + '/3)';
          next(i + 1);
        }).catch(function (e) {
          btnUse.textContent = '❌ 存 Drive 失敗:' + e.message;
          btnUse.disabled = false; btnUse.style.background = '#1f9d57';
        });
      })(0);
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();

  console.log('[character-sheet] 🎬 ' + VER + ' 就緒(Kontext 鎖臉 + 存 Drive)');
})();
