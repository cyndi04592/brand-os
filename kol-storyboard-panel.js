// ⚠️⚠️ 這個檔案的正確檔名是:kol-storyboard-panel.js  (分鏡面板 KolStoryboardPanel)  ⚠️⚠️
// 上傳前請核對檔名 —— 2026-08-23 曾發生兩檔互相覆蓋
// ════════════════════════════════════════════════════════════════════
//  kol-storyboard-panel.js · v1.6
//  分鏡產生器面板 — 大綱 → AI 編修 → 分鏡卡片 → 確認分鏡(鎖定)/ 重新編輯(解鎖)
//   • open(ctx): { containerId, persona, product, sceneLabel, onConfirm, onEdit }
//   • 確認分鏡 → ctx.onConfirm(beats, duration)(填劇情+鎖設定,不生成)
//   • 重新編輯 → ctx.onEdit()(解鎖)
// ════════════════════════════════════════════════════════════════════

(function () {
  'use strict';

  const DURATIONS = [15, 30, 45, 60, 90];

  let rootEl = null;
  let ctx = null;
  const state = { duration: 15, outline: '', beats: [], busy: false, confirmed: false };
  let prodCache = [];   // 🆕 1b 分段綁圖:商品照縮圖清單(每次 renderCards 從 ctx.getProductImages() 重讀)

  // v1.3 修:本面板同時掛在 STEP2(sbp-cine-mount)+ STEP3(sbp-episode-mount)兩個容器,
  //   固定 ID 在頁面上會「重複」→ document.getElementById 永遠抓到第一個(STEP2)→ STEP3 按 AI 編修
  //   請求有送、200 有回,但卡片被畫進 STEP2 的隱藏容器,STEP3 看起來「沒反應」。
  //   解法:面板內部一律「只在當前掛載的 rootEl 裡找元素」,兩個容器各自獨立。
  function $el(id) { return (rootEl && rootEl.querySelector) ? rootEl.querySelector('#' + id) : document.getElementById(id); }

  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  function ensureStyles() {
    if (document.getElementById('sbp-styles')) return;
    const css = `
.sbp-wrap{font-size:13px;color:var(--text,#e8e8ef)}
.sbp-head{font-size:15px;font-weight:600;margin-bottom:10px}
.sbp-head .sbp-sub{font-size:12px;font-weight:400;color:var(--text-dim,#8a8a99);margin-left:8px}
.sbp-label{display:block;font-size:12px;color:var(--text-dim,#8a8a99);margin:10px 0 4px}
.sbp-row{display:flex;align-items:center;gap:8px;margin:8px 0}
.sbp-select,.sbp-textarea{width:100%;background:var(--bg-2,#15151c);color:var(--text,#e8e8ef);
  border:1px solid var(--border,#2c2c38);border-radius:8px;padding:8px 10px;font-size:13px;font-family:inherit}
.sbp-textarea{resize:vertical;line-height:1.55}
/* 🧾 2026-09-11:大綱區跟分鏡卡【視覺分家】——
   病:兩者用同一個 .sbp-textarea、同一塊底色、緊貼在一起,
   客戶一律把大綱誤認成「Beat 1 的鏡頭欄」(現場已踩過)。
   實際上大綱是【餵給 AI 的素材】,按下編修後會被改寫成下面的分鏡,
   它自己不會出現在影片裡。所以要一眼看得出不是同一種東西。 */
/* 🪧 2026-09-11 v2.1:整個面板切成【兩個編號階段】——
   病(客戶持續反映):上一版只把大綱框用虛線框起來,但「AI 幫你寫」跟
   「你要拍的分鏡」仍然在同一張卡片裡一路往下,中間只有一條細線。
   客戶看不出哪裡是 AI 區、哪裡是成品區,以為大綱就是第一段。
   解法:兩個階段各自有底色、編號、標題,第二階段左側加一條強調色直線,
   視覺上是「兩塊」而不是「一條」。 */
.sbp-stage{border-radius:12px;padding:12px 14px;margin:12px 0}
.sbp-stage-a{background:rgba(124,109,250,.07);border:1px dashed rgba(124,109,250,.45)}
.sbp-stage-b{background:var(--bg-2,#15151c);border:1px solid var(--border,#2c2c38);
  border-left:3px solid var(--accent,#7c6dfa)}
.sbp-stage-num{display:inline-block;font-size:11px;font-weight:700;letter-spacing:.5px;
  padding:2px 8px;border-radius:99px;margin-bottom:6px}
.sbp-stage-a .sbp-stage-num{background:rgba(124,109,250,.22);color:#c4b8ff}
.sbp-stage-b .sbp-stage-num{background:rgba(124,109,250,.18);color:#a99bff}
.sbp-stage-t{font-size:13px;font-weight:700;margin-bottom:2px}
.sbp-stage-d{font-size:11px;color:var(--text-dim,#8a8a99);line-height:1.55;margin-bottom:8px}
.sbp-outline-box{border:1px dashed var(--border,#33334a);border-radius:10px;
  padding:10px 12px;margin:10px 0 4px;background:rgba(124,109,250,.05)}
.sbp-outline-box .sbp-label{margin-top:0}
.sbp-outline-title{font-size:12px;font-weight:700;color:#a99bff;margin-bottom:2px}
.sbp-outline-note{font-size:11px;color:var(--text-dim,#8a8a99);line-height:1.5;margin-top:6px}
.sbp-arrow{text-align:center;font-size:11px;color:var(--text-dim,#8a8a99);margin:8px 0 2px}
.sbp-actions{margin-top:10px}
.sbp-card{background:var(--bg-2,#15151c);border:1px solid var(--border,#2c2c38);
  border-radius:12px;padding:12px 14px;margin-top:12px}
.sbp-badge{display:inline-block;font-size:12px;font-weight:500;background:#241f3a;color:#b9aaff;
  border-radius:7px;padding:3px 10px}
.sbp-sec{font-size:12px;color:var(--text-dim,#8a8a99);margin-left:8px}
.sbp-lockbtn{margin-left:auto;font-size:12px;background:transparent;color:var(--text-dim,#8a8a99);
  border:1px solid var(--border,#2c2c38);border-radius:7px;padding:3px 9px;cursor:pointer}
.sbp-lockbtn.on{color:#f5c451;border-color:#5a4d1f;background:#221d0c}
.sbp-cardhead{display:flex;align-items:center;margin-bottom:8px}
.sbp-mini{font-size:11px;color:var(--text-dim,#8a8a99);margin:8px 0 3px}
.sbp-fit{font-size:11px;margin-top:4px;color:var(--text-dim,#8a8a99)}
.sbp-fit.over{color:#ff6b6b}
.sbp-fit.short{color:#f5c542}
.sbp-empty{color:var(--text-dim,#8a8a99);font-size:12px;padding:14px 0;text-align:center}
.sbp-genrow{margin-top:14px;display:flex;align-items:center;gap:10px}
.sbp-chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:4px;align-items:center}
.sbp-chip{width:46px;height:46px;object-fit:cover;border-radius:8px;border:2px solid var(--border,#2c2c38);cursor:pointer;opacity:.7;background:#0e0e14}
.sbp-chip.on{border-color:#b9aaff;opacity:1;box-shadow:0 0 0 2px #241f3a}
.sbp-chip-clear{font-size:11px;color:var(--text-dim,#8a8a99);border:1px dashed var(--border,#2c2c38);border-radius:7px;padding:3px 8px;cursor:pointer;background:transparent}
.sbp-note{font-size:11px;color:var(--text-dim,#8a8a99);flex:1}`;
    const el = document.createElement('style');
    el.id = 'sbp-styles';
    el.textContent = css;
    document.head.appendChild(el);
  }

  // ════════════════════════════════════════════════════════════════
  //  🎬 2026-09-07 v1.9 · 導演模式:選長度就開空白卡
  //  ───────────────────────────────────────────────────────────────
  //  ★ 為什麼:分鏡產生器以前是「AI 產完才有卡片」,想自己寫的導演
  //    只能退回情境框 —— 而情境框只有 1 段、沒有台詞欄,
  //    等於繞過導演組(服裝/道具/場景/發音修正全掉)。
  //  ★ 修:卡片改成【永遠存在】。planBeats() 本來就會回空白骨架,
  //    直接鋪出來就好,AI 編修從「必經之路」降級成「選配的填字工具」。
  // ════════════════════════════════════════════════════════════════
  function blankBeats() {
    try { return window.KolStorywriter.planBeats(state.duration) || []; }
    catch (_) { return []; }
  }

  //  卡片上有沒有人打過字(換長度 / AI 重寫之前要問,不能默默清空)
  function hasContent() {
    return state.beats.some(b => (b.shotDesc || '').trim() || (b.dialogue || '').trim());
  }

  function mount(containerId) {
    rootEl = document.getElementById(containerId);
    if (!rootEl) { console.warn('[sbp] 找不到容器', containerId); return; }
    ensureStyles();
    render();
  }

  function open(newCtx) {
    ctx = newCtx || {};
    if (ctx.containerId) {
      rootEl = document.getElementById(ctx.containerId);
      ensureStyles();
    }
    state.beats = [];
    state.outline = '';
    state.busy = false;
    state.confirmed = false;
    render();
    rootEl?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }

  function syncDom() {
    state.beats.forEach(b => {
      const sd = $el('sbp-shot-' + b.index);
      if (sd) b.shotDesc = sd.value;
      const dl = $el('sbp-dlg-' + b.index);
      if (dl) {
        b.dialogue = dl.value;
        b.fit = window.KolStorywriter.checkDialogueFit(b.dialogue, b.seconds);
        b.overflow = !b.fit.fits;
      }
    });
  }

  function collectLocked() {
    return state.beats
      .filter(b => b.dialogueLocked && b.dialogue)
      .map(b => ({ index: b.index, text: b.dialogue }));
  }

  function unlockIfConfirmed() {
    if (state.confirmed) {
      state.confirmed = false;
      if (typeof ctx?.onEdit === 'function') ctx.onEdit();
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  🗺 2026-09-12 v2.2 場景名保底(治「分鏡 AI 自己編地點」)
  //  ─────────────────────────────────────────────────────────────────────
  //  ★ 病(RA 2026-09-12 實測):場景明明選了咖啡廳,AI 卻寫
  //    「她站在一面落地鏡前,背後的層架虛掉」—— 那是服飾店試衣間,不是咖啡廳。
  //  ★ 病因:kol.html 第 7160 行 openStoryboardForCine() 把 sceneLabel 寫死成 ''。
  //    分鏡 AI 完全不知道要拍哪裡,只好自己編一個。
  //    編出來的地點會跟場景鎖打架 —— 而場景鎖有九宮格參考圖撐腰,
  //    最後畫面是咖啡廳、台詞動作卻是照試衣間寫的,兩邊對不上。
  //  ★ 修法放在這裡而不是 kol.html:sceneLabel 是在 expand() 這一刻才讀的,
  //    而 expand() 是所有呼叫端的必經點。在這裡保底 = 一次修好全部入口,
  //    包括 STEP2、STEP3 和之後任何新的呼叫端。
  //  ★ 呼叫端有給就用呼叫端的(不搶),沒給才自己去 window.S 抓當下選中的場景。
  // ═══════════════════════════════════════════════════════════════════════
  function _currentSceneLabel() {
    try {
      const S = window.S || {};
      const id = S.selectedSceneId;
      if (!id) return '';
      if (typeof window.getScenesForBrand === 'function') {
        const scenes = window.getScenesForBrand(S.currentBrandId) || {};
        const sc = scenes[id];
        const label = (sc && (sc.label || sc.name)) || '';
        if (label) return String(label).replace(/^[^\u4e00-\u9fffA-Za-z]+/, '').trim();
      }
      return String(id);
    } catch (e) { return ''; }
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  🚦 2026-09-12 v2.3 選場景防呆(RA 拍板 A 案)
  //  ─────────────────────────────────────────────────────────────────────
  //  ★ 病:RA 的實際操作順序是【先按 AI 編修成分鏡 → 之後才選場景】。
  //    按下去那一刻 S.selectedSceneId 還是空的,v2.2 的保底抓不到東西,
  //    分鏡 AI 只好自己編地點(實測編出「落地鏡前、背後層架」= 試衣間)。
  //    之後才選咖啡廳 → 畫面是咖啡廳、動作台詞照試衣間寫 → 兩邊對不上。
  //  ★ 為什麼是順序問題:場景是【資產】,它決定空間、光、她能做什麼動作;
  //    分鏡是【調度】,調度必須建立在已知空間上。
  //    先寫走位再決定房間,寫出來的走位當然對不上。
  //  ★ A 案(小改):版面不動,只在這裡擋一下,把順序糾正過來。
  //    B 案(把場景區塊搬到 STEP1 上面)要動 kol.html 的 DOM,
  //    kol.html 已 11,412 行遠超紅線,留到 UI 打磨那輪再做。
  //  ★ 呼叫端有明確給 sceneLabel 的(例:STEP3)一律放行,不擋。
  // ═══════════════════════════════════════════════════════════════════════
  async function expand() {
    if (!ctx?.sceneLabel && !_currentSceneLabel()) {
      const msg = '請先在下面選一個場景,再按「AI 編修成分鏡」——\n分鏡要知道在哪裡拍,才寫得出對的動作與走位。';
      if (typeof window.toast === 'function') window.toast('請先選場景,再編修分鏡', 'warn');
      else alert(msg);
      return;
    }

    if (state.busy) return;
    if (!window.KolStorywriter) { alert('KolStorywriter 未載入'); return; }
    if (typeof api !== 'function') { alert('api() 未載入'); return; }
    // 🆕 v1.9:先把畫面上的字收回 state,才問得準
    if (state.beats.length) syncDom();
    //  ⚠️ 開放自己打之後,這一步變成必要 ——
    //     以前卡片只能由 AI 生,沒東西可洗;現在導演可能已經打了半小時。
    if (hasContent() && !confirm('AI 編修會用新的內容蓋掉卡片上已經寫好的字。\n\n(按過「🔒 鎖台詞」的台詞會保住,鏡頭描述不會)\n\n確定要讓 AI 重寫嗎?')) return;
    unlockIfConfirmed();

    const lockedLines = collectLocked();
    const payload = window.KolStorywriter.buildExpandRequest({
      duration: state.duration,
      outline: state.outline,
      lockedLines,
      persona: ctx?.persona || {},
      product: ctx?.product || {},
      sceneLabel: ctx?.sceneLabel || _currentSceneLabel(),
      // 🧠 2026-08-23 劇情記憶:ctx.getRecentEpisodes 由 kol.html 掛上(可能沒有 → 空陣列 = 舊行為)
      //   🩹 改 await:取用器現在會「沒有就自己去撈」,不再依賴使用者先逛過劇情記憶頁。
      //      舊寫法只讀快取 → 直接進 STEP2 的人永遠沒有記憶,而且安靜地沒有。
      recentEpisodes: (typeof ctx?.getRecentEpisodes === 'function') ? (await ctx.getRecentEpisodes() || []) : [],
    });

    state.busy = true;
    const btn = $el('sbp-expand-btn');
    if (btn) { btn.disabled = true; btn.textContent = '編修中…'; }

    try {
      const res = await api('storyboard_expand', payload);
      if (!res || !res.ok) {
        alert('AI 編修失敗:' + (res?.error || '未知錯誤'));
      } else {
        // 🩹 v1.9:骨架改用【現有卡片】,不要重產一份空的。
        //   ★ 舊寫法的病:mergeExpandResult 裡有一段「AI 沒回就保留原本 s.shotDesc」
        //     的保護,但傳進去的一定是全新空骨架 → 那段保護【從來沒生效過】。
        //     以前沒人踩到是因為卡片只能由 AI 生;開放自己打之後就會咬人。
        const skeleton = state.beats.length ? state.beats : window.KolStorywriter.planBeats(state.duration);
        state.beats = window.KolStorywriter.mergeExpandResult(skeleton, res.beats, lockedLines, ctx && ctx.persona && ctx.persona.nationality);
      }
    } catch (e) {
      alert('AI 編修錯誤:' + e.message);
    }

    state.busy = false;
    if (btn) { btn.disabled = false; btn.textContent = 'AI 編修成分鏡'; }
    renderCards();
  }

  function outlineInput(v) { state.outline = v; }
  function shotInput(idx, v) { const b = state.beats.find(x => x.index === idx); if (b) b.shotDesc = v; }
  function dialogueInput(idx, v) {
    const b = state.beats.find(x => x.index === idx);
    if (!b) return;
    b.dialogue = v;
    b.fit = window.KolStorywriter.checkDialogueFit(v, b.seconds);
    b.overflow = !b.fit.fits;
    const fitEl = $el('sbp-fit-' + idx);
    if (fitEl) {
      const _si = shortInfo(b);
      //  🆕 v2.5:完全沒台詞的長段落,卡片上就要紅字講清楚(不要等按確認才發現)
      const _mute1 = (b.seconds || 0) >= 10 && !String(b.dialogue || '').trim();
      fitEl.textContent = _mute1
        ? `沒有台詞 · 這 ${b.seconds} 秒全程沒有人說話(要拍空鏡請把長度改成 5 秒)`
        : (`${b.fit.chars} 字 · 約 ${b.fit.estSec} 秒`
           + (b.overflow ? (' ⚠️ 太長,塞不進 ' + b.seconds + ' 秒(最多約 ' + ((b.fit && b.fit.maxChars) || 0) + ' 字)') : '')
           + (_si ? ` 台詞偏短,結尾約空 ${_si.gap} 秒(建議補到約 ${_si.target} 字)` : ''));
      fitEl.className = 'sbp-fit' + ((b.overflow || _mute1) ? ' over' : (_si ? ' short' : ''));
    }
  }
  function lock(idx) {
    syncDom();
    const b = state.beats.find(x => x.index === idx);
    if (b) b.dialogueLocked = !b.dialogueLocked;
    renderCards();
  }
  // 🆕 1b 分段綁圖:點縮圖 = 這段配這張商品照;再點一下 = 取消(取消 = 該段回到「整批一起餵」)
  function pickProduct(beatIdx, pIdx) {
    syncDom();
    const b = state.beats.find(x => x.index === beatIdx);
    const u = prodCache[pIdx];
    if (!b || !u) return;
    b.productUrl = (b.productUrl === u) ? '' : u;
    renderCards();
  }
  function clearProduct(beatIdx) {
    syncDom();
    const b = state.beats.find(x => x.index === beatIdx);
    if (b) b.productUrl = '';
    renderCards();
  }
  function durationChange(v) {
    const nv = parseInt(v);
    if (nv === state.duration) return;
    if (state.beats.length) syncDom();
    // 🆕 v1.9:換長度 = 換段數 = 卡片重排,寫好的字會沒。先問。
    //   ⚠️ 按取消時要把下拉【拉回原值】,否則畫面顯示新長度、實際還是舊的。
    if (hasContent() && !confirm('換長度會重新排段數,卡片上寫好的內容會清空。\n\n確定要換嗎?')) {
      const sel = $el('sbp-duration');
      if (sel) sel.value = String(state.duration);
      return;
    }
    state.duration = nv;
    state.beats = [];        // 清空 → renderCards 會自動鋪上新段數的空白卡
    unlockIfConfirmed();
    renderCards();
  }

  function confirmToggle() {
    if (!state.beats.length) { alert('分鏡卡片還沒準備好,請重選一次長度'); return; }
    if (!state.confirmed) {
      syncDom();
      // 🆕 v1.9:卡片現在永遠存在,守門要改看【有沒有寫東西】,不是看有沒有卡片。
      //   ★ 不擋的話會送出一支什麼都沒寫的空片 —— 錢照扣。
      const _blank = state.beats.filter(b => !(b.shotDesc || '').trim());
      if (_blank.length === state.beats.length) {
        alert('分鏡卡片還是空的唷。\n\n你可以自己在「鏡頭」欄寫,或填好上面的大綱按「AI 編修成分鏡」讓 AI 幫你寫。');
        return;
      }
      if (_blank.length) {
        alert('第 ' + _blank.map(b => b.index).join('、') + ' 段的「鏡頭」還是空的。\n\n空的段落一樣會照秒數生成、照樣扣點,但畫面沒人指揮。請補寫,或改短長度減少段數。');
        return;
      }
      // 🆕 v1.5 防呆:任何一段台詞超長(紅字)就擋下確認,不讓超長台詞進生成(超長=引擎趕戲吃字)
      const _over = state.beats.filter(b => b.overflow);
      if (_over.length) {
        alert('還不能確認唷:第 ' + _over.map(b => b.index + 1).join('、') + ' 段的台詞太長,講不完會被趕戲。\n\n請把該段台詞刪短一點(看卡片下方的字數提示,變回灰色就 OK),或再按一次「AI 編修」重寫。');
        return;
      }
      // 🆕 v2.5 防呆:長段落完全沒台詞 → 硬擋。
      //  ★ 病(RA 2026-09-13 實測):Beat 2「收·收尾」被 AI 判成 B-roll,dialogue 整段留空,
      //    於是 15 秒全是肩帶極特寫、零人聲。客戶付 30 秒的錢,拿到 15 秒說話 + 15 秒空鏡。
      //  ★ B-roll 本身沒錯,錯在【顆粒】:Worker 第 14 條允許 dialogue 留空且沒有長度上限,
      //    而 beat 最小單位是 15 秒 → 一判 B-roll 就吃掉半支影片。
      //  ★ 這裡是【經營 KOL 頻道】的公版:人一直在講,商品偶爾入鏡。
      //    所以 10 秒以上的段落必須有台詞;真的要拍空鏡,把那一段改成 5 秒。
      //  ★ 為什麼是硬擋不是黃字:黃字「台詞偏短」早就有了,而客戶照樣按下去(RA 現場驗證)。
      //    提醒治不了「看不懂分鏡的人」,只有擋得住。
      const _mute = state.beats.filter(b => (b.seconds || 0) >= 10 && !String(b.dialogue || '').trim());
      if (_mute.length) {
        alert('還不能確認唷:第 ' + _mute.map(b => b.index).join('、') + ' 段完全沒有台詞。\n\n'
          + '這幾段會生成 ' + _mute.map(b => b.seconds).join('、') + ' 秒的純畫面,全程沒有人說話 —— 客戶會覺得影片後半是空的。\n\n'
          + '三種做法:\n'
          + '① 直接在台詞欄補上要講的話(建議補到約 ' + Math.round((_mute[0].seconds || 15) * 0.80 * 4.2) + ' 字)\n'
          + '② 再按一次「AI 編修成分鏡」讓它重寫\n'
          + '③ 真的要拍商品空鏡,把那一段的長度改成 5 秒就好,不要用整整 ' + (_mute[0].seconds || 15) + ' 秒');
        return;
      }
      state.confirmed = true;
      if (typeof ctx?.onConfirm === 'function') ctx.onConfirm(state.beats, state.duration);
      else alert('尚未接上確認流程(onConfirm)');
    } else {
      state.confirmed = false;
      if (typeof ctx?.onEdit === 'function') ctx.onEdit();
    }
    renderCards();
  }

  function render() {
    if (!rootEl) return;
    rootEl.innerHTML = `
<div class="sbp-wrap">
  <div class="sbp-head">分鏡產生器<span class="sbp-sub">自己打 · 或讓 AI 編修</span></div>
  <div class="sbp-row">
    <label class="sbp-label" style="margin:0">長度</label>
    <select id="sbp-duration" class="sbp-select" style="width:auto" onchange="KolStoryboardPanel.durationChange(this.value)">
      ${DURATIONS.map(d => `<option value="${d}" ${d === state.duration ? 'selected' : ''}>${d} 秒 · ${window.KolStorywriter.planBeats(d).length} beat</option>`).join('')}
    </select>
  </div>
  <div class="sbp-stage sbp-stage-a">
    <span class="sbp-stage-num">STEP 1</span>
    <div class="sbp-stage-t">🤖 AI 幫你寫腳本</div>
    <div class="sbp-stage-d">這一區是【給 AI 看的】。寫完按按鈕,AI 會把它拆成下面 STEP 2 的分鏡。<br>不想用 AI 就整區跳過,直接到下面自己打字。</div>
  <div class="sbp-outline-box">
    <div class="sbp-outline-title">📝 給 AI 的素材 · 這不是第一段</div>
    <textarea id="sbp-outline" class="sbp-textarea" rows="3"
      placeholder="用一兩句話講這支影片想說什麼就好,例:健一在登山步道休息,隨身帶著防熊噴霧,最近熊出沒新聞變多..."
      oninput="KolStoryboardPanel.outlineInput(this.value)">${esc(state.outline)}</textarea>
    <div class="sbp-outline-note">按下面的按鈕之後,這段話會被 AI 改寫成下面的分鏡卡 —— 它自己不會出現在影片裡。<br>可以留空,AI 會自己想;想自己寫分鏡的話,直接跳過這格、在下面的卡片上打字。</div>
    <div class="sbp-actions" style="margin-top:8px">
      <button id="sbp-expand-btn" class="btn btn-primary btn-sm" onclick="KolStoryboardPanel.expand()">AI 編修成分鏡</button>
    </div>
  </div>
  </div>

  <div class="sbp-stage sbp-stage-b">
    <span class="sbp-stage-num">STEP 2</span>
    <div class="sbp-stage-t">🎬 真正會拍出來的分鏡</div>
    <div class="sbp-stage-d">影片只拍下面這些卡片的內容。可以直接改,也可以自己從頭打。</div>
    <div id="sbp-cards"></div>
  </div>
</div>`;
    renderCards();
  }

  // 🆕 v1.6:台詞偏短判斷(對稱防線:紅=太長硬擋,黃=偏短提醒不擋)
  function shortInfo(b) {
    if (!b?.fit || b.overflow || !b.seconds) return null;
    const est = +b.fit.estSec || 0;
    //  v2.7:甜蜜區本來就留約 3 秒呼吸,容忍放寬到 4 秒 ——
    //  否則剛好寫到建議值的人還是會看到「偏短」,等於永遠有黃字。
    if (est >= b.seconds - 4) return null;
    const gap = Math.max(1, Math.round(b.seconds - est - 1)); // 估空秒(扣 1 秒開場呼吸)
    // ═══════════════════════════════════════════════════════════════════
    //  📏 2026-09-12 v2.4:建議字數 0.78 → 0.95(治「台詞天生就短 3 秒」)
    //  ★ 病(RA 2026-09-12 實測):15 秒的 beat,建議值算出來是 49 字。
    //    49 ÷ 4.2 = 11.7 秒 —— 照著建議寫,【必定空 3 秒】。
    //    那 3 秒她的嘴不動、聲音卻在跑,聽起來變旁白(RA:「像旁白在講但
    //    音調是 KOL 的」),畫面上只剩眼睛能動 = 發呆傻笑。
    //    等於系統一邊提示「台詞偏短」,一邊給一個本來就會短的目標。
    //  ★ 為什麼不是縮影片:客戶按秒數付費,收 15 秒交 10 秒會被客訴。
    //    正解是把台詞寫滿,不是把片子剪短。
    //  ★ 0.95 而非 1.0:留 5% 給換氣與尾音收束,15 秒 → 60 字。
    //    (0.78 → 49 字、0.95 → 60 字,兩者差 11 字 ≈ 2.6 秒空白)
    // ═══════════════════════════════════════════════════════════════════
    //  📏 v2.7:建議值不再自己算 —— 直接用 checkDialogueFit 回傳的 sweetChars。
    //    舊寫法 0.95 算出 60 字,但硬擋線是 seconds×0.90 = 57 字
    //    → 【照著建議寫必定被紅字擋下,按不了確認】(RA 2026-09-13 實測)。
    //    而 Worker 第 12 條規定「15 秒寫 58-62 字」,整個區間全被前端擋掉,
    //    所以 AI 每次只能寫 42-48 字 —— 不是它不聽話,是寫對了送不出去。
    //    現在建議與硬擋共用 kol-storywriter 的 FIT_SWEET / FIT_MAX,不可能再打架。
    const target = (b.fit && b.fit.sweetChars) || Math.round(b.seconds * 0.80 * 4.2);
    return { gap, target };
  }

  // 🆕 1b:此段商品縮圖列 —— 只有 2 張以上商品照才出現(1 張綁不綁都一樣,不干擾)
  function productChipsHtml(b) {
    if (prodCache.length < 2) return '';
    const chips = prodCache.map((u, i) => {
      const on = b.productUrl === u;
      return `<img src="${esc(u)}" class="sbp-chip${on ? ' on' : ''}" title="商品照 ${i + 1}" loading="lazy"
        onclick="KolStoryboardPanel.pickProduct(${b.index}, ${i})">`;
    }).join('');
    const clearBtn = b.productUrl
      ? `<span class="sbp-chip-clear" onclick="KolStoryboardPanel.clearProduct(${b.index})">✕ 不指定</span>` : '';
    return `<div class="sbp-mini">此段商品(點選指定 · 不選 = 整批一起餵)</div>
  <div class="sbp-chips">${chips}${clearBtn}</div>`;
  }

  function cardHtml(b) {
    const overCls = b.overflow ? ' over' : '';
    const fitTxt = b.dialogue
      ? `${b.fit?.chars ?? 0} 字 · 約 ${b.fit?.estSec ?? 0} 秒` + (b.overflow ? (' ⚠️ 太長,塞不進 ' + b.seconds + ' 秒(最多約 ' + ((b.fit && b.fit.maxChars) || 0) + ' 字)') : '') + (shortInfo(b) ? ` 台詞偏短,結尾約空 ${shortInfo(b).gap} 秒(建議補到約 ${shortInfo(b).target} 字)` : '')
      : '';
    return `
<div class="sbp-card">
  <div class="sbp-cardhead">
    <span class="sbp-badge">Beat ${b.index} · ${esc(b.zhLabel)}</span>
    <span class="sbp-sec">${b.seconds} 秒</span>
    <button class="sbp-lockbtn${b.dialogueLocked ? ' on' : ''}" onclick="KolStoryboardPanel.lock(${b.index})">
      ${b.dialogueLocked ? '🔒 已鎖' : '🔓 鎖台詞'}
    </button>
  </div>
  <div class="sbp-mini">鏡頭</div>
  <textarea id="sbp-shot-${b.index}" class="sbp-textarea" rows="2"
    oninput="KolStoryboardPanel.shotInput(${b.index}, this.value)">${esc(b.shotDesc)}</textarea>
  ${productChipsHtml(b)}
  <div class="sbp-mini">台詞「」</div>
  <textarea id="sbp-dlg-${b.index}" class="sbp-textarea" rows="2"
    oninput="KolStoryboardPanel.dialogueInput(${b.index}, this.value)">${esc(b.dialogue)}</textarea>
  <div id="sbp-fit-${b.index}" class="sbp-fit${overCls}${shortInfo(b) ? ' short' : ''}">${fitTxt}</div>
</div>`;
  }

  function renderCards() {
    const box = $el('sbp-cards');
    if (!box) return;
    // 🆕 1b:每次重畫都重讀一次商品照(妳在下面商品區加選後,鎖台詞/點縮圖等任何動作都會刷新這排)
    prodCache = (typeof ctx?.getProductImages === 'function') ? (ctx.getProductImages() || []).filter(Boolean) : [];
    // 🆕 v1.9:沒有卡片就先鋪空白骨架 —— 這是「導演自己打」的入口。
    //   放在 renderCards 而不是 open(),是因為 mount / open / durationChange
    //   三個入口都會走到這裡,一處收口就三處同步(場景清單那條教訓)。
    if (!state.beats.length) state.beats = blankBeats();
    if (!state.beats.length) {
      box.innerHTML = `<div class="sbp-empty">分鏡卡片載入失敗,請重選一次長度</div>`;
      return;
    }
    const multi = state.beats.length > 1;
    const note = state.confirmed
      ? (multi
          ? `✅ 已確認 · ${state.beats.length} 段會自動接成 ≈ ${state.duration} 秒長片,挑好設定按生成`
          : '✅ 分鏡已確認 · 單段,挑好設定按生成')
      : (!hasContent()
          ? `直接在卡片上寫,或填好上面的大綱按「AI 編修成分鏡」 · 共 ${state.beats.length} 段`
          : multi
            ? `${state.beats.length} 段分鏡 → 按「確認分鏡」後會自動接成 ≈ ${state.duration} 秒長片`
            : '確認後會鎖定下面設定');
    box.innerHTML = state.beats.map(cardHtml).join('') + `
<div class="sbp-genrow">
  <span class="sbp-note">${note}</span>
  <button class="btn ${state.confirmed ? 'btn-ghost' : 'btn-primary'} btn-sm" onclick="KolStoryboardPanel.confirmToggle()">${state.confirmed ? '重新編輯(解鎖)' : '✅ 確認分鏡'}</button>
</div>`;
  }

  window.KolStoryboardPanel = {
    mount, open, expand, lock, confirmToggle,
    durationChange, outlineInput, shotInput, dialogueInput,
    pickProduct, clearProduct,
    getBeats: () => state.beats,
  };

  console.log('[KolStoryboardPanel] v2.7 就緒 · 📏建議值與硬擋線統一(治「叫你補到60字·補到59又說太長」) · 🔇長段落無台詞硬擋(治「B-roll 吃掉整個15秒·客戶付30秒拿到一半空鏡」·要空鏡請改5秒) · 📏建議字數0.78→0.95(15秒49字→60字·治「照建議寫必定空3秒變旁白」) · 🚦選場景防呆(沒選場景不給編修·治順序顛倒) · 🗺場景名保底(呼叫端沒給就自己抓當下選中的場景·治分鏡AI自己編地點) · v2.1 · 🪧兩階段區塊(STEP1 AI區 / STEP2 成品區·治「分不出哪裡是AI」) · · 🧾大綱區視覺分家(治「誤認成Beat1」) ·(🆕導演模式:選長度就開空白卡 · AI編修降級為選配 · 覆蓋前確認 · 空卡擋確認)');
})();
