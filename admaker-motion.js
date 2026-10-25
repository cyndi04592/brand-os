/* admaker-motion.js · v1.0 — 廣告圖「商品運鏡影片」(取代舊的「變 5 秒影片」)
   ─────────────────────────────────────────────────────────────────────
   2026-10-25 RA 拍板:
     · 廣告圖做好後,直接讓它變成一支有運鏡的商品影片(範本:MOZ 皮革方包 Reels)
     · 引擎從 Kling(fal)換成 Seedance 2.0 —— 走 Worker 現成的 seedance_submit,不動 Worker
     · 長度 10 秒為主、可選 15 秒;點數跟 KOL 影片同一套(每秒 60 點 → 600 / 900)
       (舊的 Kling 5 秒反而收 960 點)
   做法:
     · [Image1] = 剛做好的廣告圖(場景、光、商品樣子全部以它為準)
     · [Image2] = 客人原本的商品照(只用來把商品形狀/logo/標籤/顏色校正回來)
     · 運鏡用預設組合(6 種),提示詞只寫「鏡頭怎麼走」與「商品的事實」,不寫禁止句
     · 畫面有人的類型(服飾穿搭、美業、醫美、課程…)走 PiAPI(真人臉才不會被擋);
       純商品走 fal(PiAPI 主體參考模式會自己補一個人進畫面,2026-08-11 實測)
   依賴(都在 admaker.js,全域可取):
     LAST_POSTER_URL · SELECTED_PRODTYPE · callWorker · pollUntilDone · startProgress
     finishProgress · failProgress · setPrStatus · showVideoInCanvas · saveVideoSilently · _adSize
   載入:index.html 在 admaker.js / admaker-prompt-lean.js 之後載入本檔。
   退回舊版:Console 打 window.AD_MOTION = false → 「變影片」按鈕走回 admaker.js 原本的 Kling 流程。
*/
(function () {
  'use strict';
  var VER = 'v1.0';

  var SEC_COST = 60;                 // 每秒點數(跟 Worker seedance_submit 同一套)
  var BTN_LABEL = '🎬 商品運鏡影片(10 / 15 秒)';

  // 畫面裡通常有人的類型 → PiAPI;其餘 → fal
  var PEOPLE_TYPES = { apparel: 1, apparel_keep: 1, beauty: 1, medical: 1, course: 1, pro: 1, travel: 1 };

  // ── 運鏡預設 ──────────────────────────────────────────────────────
  //   每個預設給 10 秒與 15 秒兩套分鏡(時間碼寫死,Seedance 照時間走最穩)
  var MOVES = [
    { key: 'luxe', label: '質感棚拍(推薦)', hint: '亮相 → 材質特寫 → 細節 → 回到全景,像 MOZ 那支',
      s10: [
        '[00:00-00:02] The product in full, the camera easing slowly toward it.',
        '[00:02-00:05] An extreme close-up glides across its main material, the surface texture crisp as light slides over it.',
        '[00:05-00:07] A close detail of its logo, hardware or signature part, held steady.',
        '[00:07-00:10] The camera arcs gently back out to the full product, a soft band of light passing across it, settling on a clean hero frame.'
      ],
      s15: [
        '[00:00-00:03] The product in full, the camera easing slowly toward it.',
        '[00:03-00:06] An extreme close-up glides across its main material, the surface texture crisp as light slides over it.',
        '[00:06-00:08] A close detail of its logo, hardware or signature part, held steady.',
        '[00:08-00:11] A low angle from the side, the product rising tall in frame.',
        '[00:11-00:15] The camera arcs gently back out to the full product, a soft band of light passing across it, settling on a clean hero frame.'
      ] },
    { key: 'sweep', label: '光影掃過', hint: '商品不動,一道光慢慢掃過去',
      s10: [
        '[00:00-00:10] The camera holds still on the product. A soft band of light travels slowly across it from one side to the other, each surface brightening as the light reaches it and easing back after, then the light settles into an even glow.'
      ],
      s15: [
        '[00:00-00:08] The camera holds still on the product. A soft band of light travels slowly across it from one side to the other, each surface brightening as the light reaches it and easing back after.',
        '[00:08-00:15] The camera eases in a little closer while the light returns more slowly, settling into an even glow on a clean hero frame.'
      ] },
    { key: 'pushin', label: '慢慢推近', hint: '從全景一路推到細節',
      s10: [
        '[00:00-00:10] One continuous slow dolly-in from the full set to a close detail of the product, smooth and steady, the focus staying on the product the whole way.'
      ],
      s15: [
        '[00:00-00:10] One continuous slow dolly-in from the full set to a close detail of the product, smooth and steady, the focus staying on the product the whole way.',
        '[00:10-00:15] The camera holds on the detail as light drifts gently across it.'
      ] },
    { key: 'orbit', label: '環繞展示', hint: '鏡頭繞著商品轉,看到不同面',
      s10: [
        '[00:00-00:10] The camera travels in a slow, smooth arc of about sixty degrees around the product at its own height; the product stays exactly in place while its sides turn into view and the light shifts across its surfaces.'
      ],
      s15: [
        '[00:00-00:10] The camera travels in a slow, smooth arc of about sixty degrees around the product at its own height; the product stays exactly in place while its sides turn into view and the light shifts across its surfaces.',
        '[00:10-00:15] The camera rises slightly and settles on a three-quarter hero frame.'
      ] },
    { key: 'reveal', label: '空景登場', hint: '先是空的場景,商品再出現',
      s10: [
        '[00:00-00:02] The same set and surface with the product absent, the light already in place.',
        '[00:02-00:05] The product lowers gently into its place and settles with real weight, a soft contact shadow forming under it.',
        '[00:05-00:10] The camera eases slowly toward it and finishes on a clean hero frame.'
      ],
      s15: [
        '[00:00-00:03] The same set and surface with the product absent, the light already in place.',
        '[00:03-00:06] The product lowers gently into its place and settles with real weight, a soft contact shadow forming under it.',
        '[00:06-00:11] The camera eases slowly toward it, light gliding across its surfaces.',
        '[00:11-00:15] A close detail of its signature part, then a clean hero frame.'
      ] },
    { key: 'macro', label: '材質特寫', hint: '微距鏡頭在商品表面慢慢滑過',
      s10: [
        '[00:00-00:06] A macro camera glides slowly along the product surface, close enough to read the material: grain, weave, stitching or finish, sharp where the focus lands and softly blurred beyond.',
        '[00:06-00:10] The camera pulls back to reveal the whole product in the set.'
      ],
      s15: [
        '[00:00-00:05] A macro camera glides slowly along the product surface, close enough to read the material: grain, weave, stitching or finish, sharp where the focus lands and softly blurred beyond.',
        '[00:05-00:10] The macro moves on to a second part of the product, its edges and details catching the light.',
        '[00:10-00:15] The camera pulls back to reveal the whole product in the set.'
      ] }
  ];

  // ── 小工具 ────────────────────────────────────────────────────────
  function el(tag, css, html) { var e = document.createElement(tag); if (css) e.style.cssText = css; if (html != null) e.innerHTML = html; return e; }

  function nearestRatio() {
    var w = 1088, h = 1088;
    try { var s = _adSize(); w = s.w; h = s.h; } catch (e) {}
    var r = w / h;
    var opts = [['21:9', 21 / 9], ['16:9', 16 / 9], ['4:3', 4 / 3], ['1:1', 1], ['3:4', 3 / 4], ['9:16', 9 / 16]];
    var best = opts[3], bd = 9;
    opts.forEach(function (o) { var d = Math.abs(Math.log(r / o[1])); if (d < bd) { bd = d; best = o; } });
    return best[0];
  }

  function productPhotoUrl() {
    try {
      var S = window.S || {};
      var p = (S.selPhoto !== null && S.photos) ? S.photos[S.selPhoto] : null;
      if (!p) return '';
      var u = p.full || p.hiRes || p.canvasRes || p.src || '';
      // 只送真的網址;data:/blob:/縮圖都不能餵引擎
      if (!/^https:\/\//.test(u)) return '';
      if (/\/thumbnail|=w\d{2,3}\b|sz=w\d{2,3}/.test(u)) return '';
      return u;
    } catch (e) { return ''; }
  }

  function hasPeople() {
    try { return !!PEOPLE_TYPES[String(SELECTED_PRODTYPE || '')]; } catch (e) { return false; }
  }

  function buildPrompt(move, sec, withProduct, people) {
    var shots = (sec >= 15 ? move.s15 : move.s10).join('\n');
    var refs = '[Image1] is the finished ad photo: the set, its light, its colours and the product exactly as they look there.'
      + (withProduct ? ' [Image2] is the same product as a plain photo, used only to keep its exact shape, logo, label and colours.' : '');
    var subject = people
      ? 'Anyone in [Image1] keeps the same face, hair, clothing and pose style, moving only slightly and naturally.'
      : 'The product is the only subject; the set stays exactly as in [Image1].';
    var truth = 'The product keeps its true shape, proportions, colours, logo and printed details in every frame, at its real size, resting with real weight and a soft contact shadow.';
    var light = 'All light comes from the set in [Image1]; highlights glide over surfaces as the camera moves, and the product\'s whites stay as bright as the other whites around it.';
    var look = 'A high-end product commercial filmed on a real camera: smooth stabilised moves, natural depth of field, clean frames showing only what is in [Image1].';
    return [refs, subject, truth, light, look, shots].join('\n');
  }

  // ── 選單視窗 ──────────────────────────────────────────────────────
  function openPicker() {
    if (!LAST_POSTER_URL) { setPrStatus('⚠️ 請先生成廣告圖', 'var(--red)'); return; }
    if (!/^https:\/\//.test(String(LAST_POSTER_URL))) { setPrStatus('⚠️ 這張廣告圖還沒存成網址,請重新生成一次再做影片', 'var(--red)'); return; }
    var old = document.getElementById('amMotionModal'); if (old) old.remove();

    var pick = { move: MOVES[0], sec: 10 };
    var mask = el('div', 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:16px;');
    mask.id = 'amMotionModal';
    var box = el('div', 'width:100%;max-width:440px;max-height:90vh;overflow:auto;background:#16161d;border:1px solid #2e2e3a;border-radius:14px;padding:18px;color:#e8e8f0;font-family:"Noto Sans TC",sans-serif;');
    box.appendChild(el('div', 'font-size:16px;font-weight:900;margin-bottom:4px;', '🎬 商品運鏡影片'));
    box.appendChild(el('div', 'font-size:12px;color:#9a9aa8;margin-bottom:12px;line-height:1.6;', '用剛做好的廣告圖拍成一支有運鏡的商品影片。選一種動法:'));

    var list = el('div', 'display:flex;flex-direction:column;gap:6px;margin-bottom:14px;');
    function paintMoves() {
      list.innerHTML = '';
      MOVES.forEach(function (m) {
        var on = m.key === pick.move.key;
        var it = el('div', 'padding:9px 11px;border-radius:9px;cursor:pointer;border:1.5px solid ' + (on ? '#7c6dfa' : '#2e2e3a') + ';background:' + (on ? 'rgba(124,109,250,.15)' : 'transparent') + ';',
          '<div style="font-size:13px;font-weight:800;">' + m.label + '</div><div style="font-size:11px;color:#9a9aa8;margin-top:2px;">' + m.hint + '</div>');
        it.onclick = function () { pick.move = m; paintMoves(); };
        list.appendChild(it);
      });
    }
    paintMoves();
    box.appendChild(list);

    var secRow = el('div', 'display:flex;gap:8px;margin-bottom:14px;');
    function paintSec() {
      secRow.innerHTML = '';
      [10, 15].forEach(function (s) {
        var on = s === pick.sec;
        var b = el('button', 'flex:1;padding:9px;border-radius:9px;cursor:pointer;font-weight:800;font-size:13px;color:#e8e8f0;border:1.5px solid ' + (on ? '#7c6dfa' : '#2e2e3a') + ';background:' + (on ? 'rgba(124,109,250,.15)' : 'transparent') + ';',
          s + ' 秒 · ' + (s * SEC_COST) + ' 點');
        b.onclick = function () { pick.sec = s; paintSec(); };
        secRow.appendChild(b);
      });
    }
    paintSec();
    box.appendChild(secRow);

    var acts = el('div', 'display:flex;gap:8px;');
    var cancel = el('button', 'flex:1;padding:10px;border-radius:9px;border:1px solid #3a3a4a;background:transparent;color:#bbb;cursor:pointer;', '取消');
    var go = el('button', 'flex:2;padding:10px;border-radius:9px;border:none;background:linear-gradient(135deg,#7c6dfa,#fa6d9b);color:#fff;font-weight:900;cursor:pointer;', '開始生成');
    cancel.onclick = function () { mask.remove(); };
    go.onclick = function () { mask.remove(); runMotion(pick.move, pick.sec); };
    acts.appendChild(cancel); acts.appendChild(go);
    box.appendChild(acts);

    mask.appendChild(box);
    mask.onclick = function (e) { if (e.target === mask) mask.remove(); };
    document.body.appendChild(mask);
  }

  // ── 送出與等待 ────────────────────────────────────────────────────
  async function runMotion(move, sec) {
    var btn = document.getElementById('posterToVideoBtn');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ 商品運鏡生成中...'; }
    var interval = startProgress(sec >= 15 ? 420000 : 300000);
    try {
      var prod = productPhotoUrl();
      var people = hasPeople();
      var prompt = buildPrompt(move, sec, !!prod, people);
      var brandId = (window.S && window.S.brandId) || '';
      setPrStatus('送出影片任務...', 'var(--t3)');
      var payload = {
        action: 'seedance_submit',
        kolImageUrl: LAST_POSTER_URL,                 // → [Image1] 廣告圖
        productImageUrls: prod ? [prod] : [],          // → [Image2] 原商品照(校正用)
        prompt: prompt,
        resolution: '720p',
        duration: String(sec),
        aspectRatio: nearestRatio(),
        generateAudio: false,
        tier: 'fast',
        brandId: brandId,
        kolName: '商品運鏡_' + move.key,
        provider: people ? 'piapi' : 'fal'
      };
      console.log('[商品運鏡] ' + VER + ' · ' + move.label + ' · ' + sec + ' 秒 · ' + payload.aspectRatio
        + ' · 引擎 ' + payload.provider + ' · 商品照 ' + (prod ? '有' : '無') + ' · 提示詞 ' + prompt.length + ' 字');
      var sub = await callWorker(payload);
      if (sub && sub.error === 'INSUFFICIENT_BITS') {
        if (typeof showInsufficientBits === 'function') { try { showInsufficientBits(sec * SEC_COST); } catch (e) {} }
        throw new Error('點數不足');
      }
      if (!sub || !sub.ok) throw new Error((sub && sub.error) || '提交失敗');

      setPrStatus('⏳ 商品運鏡生成中(約 3-8 分鐘,可以先做別的)...', 'var(--t3)');
      var reqId = sub.requestId || sub.taskId;
      var ep = sub.endpoint || (people ? 'piapi' : '');
      var result = await pollUntilDone(reqId, ep, 900000, sub.responseUrl, sub.statusUrl);
      if (result.status === 'TIMEOUT') throw new Error('等太久了,影片可能還在生成,稍後到素材庫看看');
      if (result.status === 'FAILED') throw new Error(result.error || '影片生成失敗(失敗會自動退點)');
      if (!result.videoUrl) throw new Error('未取得影片網址');

      showVideoInCanvas(result.videoUrl);
      finishProgress(interval);
      setPrStatus('✅ 商品運鏡影片完成!可右鍵下載', 'var(--mint)');
      if (btn) { btn.textContent = '✅ 已生成 · 再做一支'; btn.disabled = false; }
      saveVideoSilently(result.videoUrl);
      if (typeof window.refreshBits === 'function') { try { window.refreshBits(); } catch (e) {} }
    } catch (e) {
      failProgress(interval, e.message);
      if (btn) { btn.disabled = false; btn.textContent = BTN_LABEL + ' — 失敗,重試'; }
    }
  }

  // ── 接上按鈕 ──────────────────────────────────────────────────────
  var _oldPosterToVideo = window.posterToVideo;
  window.posterToVideo = function () {
    if (window.AD_MOTION === false && typeof _oldPosterToVideo === 'function') return _oldPosterToVideo();
    openPicker();
  };

  // admaker.js 每次出圖會把按鈕字改回「變 5 秒影片」→ 換成新名字
  function relabel() {
    var b = document.getElementById('posterToVideoBtn');
    if (b && /變 ?5 ?秒影片/.test(b.textContent) && window.AD_MOTION !== false) {
      b.textContent = b.textContent.replace(/變 ?5 ?秒影片/, BTN_LABEL);
    }
  }
  function watch() {
    var b = document.getElementById('posterToVideoBtn');
    if (!b) { setTimeout(watch, 800); return; }
    relabel();
    new MutationObserver(relabel).observe(b, { childList: true, characterData: true, subtree: true });
  }
  watch();

  window.AdMotion = { VER: VER, MOVES: MOVES, buildPrompt: buildPrompt, openPicker: openPicker };
  console.log('[商品運鏡] ' + VER + ' 就緒 · 「變影片」改走 Seedance 2.0 運鏡(Console 打 window.AD_MOTION=false 退回 Kling)');
})();
