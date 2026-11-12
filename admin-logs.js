/* ═══════════════════════════════════════════════════════════════
   🧯 admin-logs.js v1.2(2026-11-12)後台「🧯 紀錄」分頁
   ・v1.2 RA 11-12「後台要清楚知道客人點了哪些、怎麼生出這張圖」:廣告圖每筆加「看詳細」
     → 成品圖 + 客人選擇 / 標題 / 補充 / 大小 / 擺放 + 美術指導的思考 + 送給生圖的提示詞 + 系統草稿
     (資料由 ad-director.js v2.6 寫進 gen_log;整筆用 kol-proxy 既有的 gen_log_get 讀,只限 RA 本人;
      其他管理員/審核員讀不到整筆時,顯示列表裡那 400 字)
   ・v1.1 加第三區「修改紀錄」:品牌/商品/資料夾每一格是誰、幾點、從什麼改成什麼,可一鍵還原
     (資料來源:kol-proxy v6.20 admin_changes;listAdminChanges / adminRevert,管理員/審核員才叫得動)
   ・一個檔案一個職責:admin.html 已 4,000+ 行,紀錄查看獨立成這支,admin.html 只掛分頁殼
   ・兩區:
       ① 錯誤紀錄 —— 客人畫面上出錯的那一刻:誰、哪一頁、剛按了什麼、做什麼動作、看到什麼錯誤
          (資料來源:前端 Errlog.js → kol-proxy client_error → D1 client_errors,保留 90 天)
       ② 生成紀錄 —— 客人生成了什麼:影片、廣告圖、場景圖、腳本分鏡…成功/失敗、成品網址、花多久
          (資料來源:既有 D1 gen_log)
   ・只讀:用 admin.html 既有的 workerWrite() 與 ADMIN_USER_EMAIL;權限由 Worker 端 _d1IsStaff 把關
     (kol-proxy v6.17 listClientErrors / v6.18 listGenLog),客人拿不到
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const call = (act, payload) => workerWrite(act, Object.assign({ email: ADMIN_USER_EMAIL }, payload || {}));
  const LB = 'font-size:11px;color:var(--t3);display:block;margin-bottom:5px;font-weight:600;letter-spacing:0.5px;';

  //  動作代號 → 白話(後台自己看,但一樣講人話)
  const ACT = {
    seedance_submit: 'KOL 影片(送出)', video_done: 'KOL 影片(完成)', kling_submit: '影片(舊引擎)',
    seedance_image2video_submit: '圖轉影片', heygen_create_video: '口播影片',
    fal_image_submit: 'KOL 照片', flux_kontext: '換場景 / 多角度照', nanobanana_pro: '場景圖 / 藍圖',
    nanobanana_compose: '合成圖', scene_grid: '場景九宮格', storyboard_expand: 'AI 分鏡',
    ai_generate_persona: 'AI 人設', ai_generate_script: 'AI 腳本', ai_generate_script_v2: 'AI 腳本',
    ai_generate_social_posts: '社群貼文', faceless_situation: '無臉模式 AI 動作', subtitle_burn: '加字幕',
    admaker_poster: '廣告圖', admaker_video: '廣告圖變 5 秒影片',
    gpt_poster_edit_submit: '廣告圖', flux_kontext_submit: '換場景', kling_tryon_submit: '真人試穿',
    kling_poster_video_submit: '廣告圖變 5 秒影片', claude_generate: 'AI 文案',
    createSubOrder: '建立訂閱訂單', createTopupOrder: '建立加購訂單', ecpay_create: '前往付款',
    getBits: '讀取點數', saveBrandOS: '存檔',
  };
  const actName = (a) => ACT[a] || a || '—';
  const KIND = { video: '影片', image: '圖片', scene: '場景圖', text: '文字', talking: '口播' };
  const ERRK = { api: '系統回覆失敗', network: '連不上', alert: '跳出的錯誤提示', js: '網頁程式錯誤', promise: '網頁程式錯誤', manual: '手動紀錄' };
  const PAGE = { '/': '首頁', '/index.html': '首頁', '/kol': 'KOL 工作室', '/kol.html': 'KOL 工作室', '/plans': '方案頁', '/plans.html': '方案頁', '/admin': '後台', '/admin.html': '後台', '/library.html': '素材庫', '/onboard.html': '品牌入駐' };
  const pageName = (p) => PAGE[p] || p || '—';
  function tw(ts) {
    try { const d = new Date(new Date(ts).getTime() + 8 * 3600e3); return d.toISOString().slice(5, 16).replace('T', ' '); } catch (e) { return ts || ''; }
  }
  function sec(ms) { const n = Number(ms) || 0; if (!n) return '—'; return n < 60000 ? Math.round(n / 1000) + ' 秒' : Math.round(n / 60000) + ' 分'; }
  function who(e) { return String(e || '').replace(/@gmail\.com$/i, ''); }

  let _view = 'err';            // err | gen | chg
  const TBL = { brands: '品牌', products: '商品', folders: '資料夾' };
  const FLD = { name: '品牌名稱', icon: '圖示', navColor: '顏色', soul: '品牌靈魂', adStyle: '廣告風格', hashtags: 'Hashtags',
    audience: '受眾', colorHex: '色碼', ownerTone: '語氣', subName: '系列名稱', subColor: '系列顏色', subSoul: '系列靈魂',
    subAdStyle: '系列廣告風格', subHashtags: '系列 Hashtags', prodName: '商品名稱', prodTag: '標籤', spec: '規格', feature: '特色',
    photoFolderId: '照片資料夾', videoFolderId: '影片資料夾', kolFolderId: 'KOL 資料夾', productFolderId: '商品資料夾' };
  const OP = { update: '修改', insert: '新增', delete: '刪除', revert: '還原' };
  let _f = { days: 7, who: '', kind: '' };

  function shell() {
    const tabBtn = (k, label) => `<button class="btn-refresh" data-lv="${k}" onclick="AdminLogs.view('${k}')" style="${_view === k ? 'border-color:var(--accent,#7c6cff);color:#fff;background:rgba(124,108,255,.18);' : ''}">${label}</button>`;
    $('logsRoot').innerHTML = `
      <div class="section-header" style="flex-wrap:wrap;gap:10px;">
        <h2>🧯 紀錄</h2>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">${tabBtn('err', '錯誤紀錄')}${tabBtn('gen', '生成紀錄')}${tabBtn('chg', '修改紀錄')}</div>
      </div>
      <div style="font-size:12px;color:var(--t3);margin-bottom:14px;line-height:1.8;">
        ${_view === 'err'
          ? '客人畫面上出錯的那一刻會自動記一筆:哪一頁、剛按了什麼、做什麼動作、看到什麼錯誤。保留 90 天。'
          : _view === 'gen'
          ? '客人每次生成都會記一筆:生成了什麼、用哪位 KOL、成功或失敗、成品網址(點了可開)、花多久。'
          : '後台品牌、商品、資料夾每改一格都會記一筆:誰、幾點、從什麼改成什麼。改錯了按「還原」就回到舊的(還原本身也會記一筆)。'}
      </div>
      <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end;margin-bottom:16px;">
        <div><label style="${LB}">期間</label>
          <select id="lgDays" class="field-input" style="min-width:110px;">
            ${[1, 7, 30, 90].concat(_view === 'chg' ? [365] : []).map(d => `<option value="${d}" ${_f.days === d ? 'selected' : ''}>最近 ${d} 天</option>`).join('')}
          </select></div>
        <div><label style="${LB}">${_view === 'chg' ? '誰改的(Email 打一部分就好)' : '客人 Email(打一部分就好)'}</label>
          <input id="lgWho" class="field-input" value="${esc(_f.who)}" placeholder="例:joannetsao" style="min-width:200px;"></div>
        ${_view === 'chg' ? `<div><label style="${LB}">品牌 / 商品名稱</label>
          <input id="lgQ" class="field-input" value="${esc(_f.q || '')}" placeholder="例:巧福" style="min-width:160px;"></div>` : ''}
        ${_view === 'gen' ? `<div><label style="${LB}">類型</label>
          <select id="lgKind" class="field-input" style="min-width:110px;">
            <option value="">全部</option>
            ${Object.keys(KIND).map(k => `<option value="${k}" ${_f.kind === k ? 'selected' : ''}>${KIND[k]}</option>`).join('')}
          </select></div>` : ''}
        <button class="btn-refresh" onclick="AdminLogs.search()">查詢</button>
      </div>
      <div id="lgSum"></div>
      <div class="table-wrap" id="lgBody"><div class="empty-state"><p>載入中...</p></div></div>`;
    const w = $('lgWho'); if (w) w.onkeydown = (e) => { if (e.key === 'Enter') search(); };
  }

  function readFilters() {
    _f.days = Number(($('lgDays') || {}).value) || 7;
    _f.who = String(($('lgWho') || {}).value || '').trim();
    _f.kind = String(($('lgKind') || {}).value || '');
    _f.q = String(($('lgQ') || {}).value || '').trim();
  }

  function chips(list, label, onPick) {
    if (!list || !list.length) return '';
    return `<div style="margin-bottom:14px;"><div style="${LB}">${label}</div><div style="display:flex;gap:6px;flex-wrap:wrap;">`
      + list.map(x => `<button class="btn-refresh" style="padding:5px 10px;font-size:12px;" onclick="AdminLogs.pick(${esc(JSON.stringify(x.email))})">${esc(who(x.email))} · ${x.n}${x.fail ? ' <span style="color:#ff6d9b;">(失敗 ' + x.fail + ')</span>' : ''}</button>`).join('')
      + '</div></div>';
  }

  async function loadErr() {
    const j = await call('listClientErrors', { days: _f.days, who: _f.who, limit: 300 });
    if (!j || !j.ok) { $('lgBody').innerHTML = '<div class="empty-state"><p>載入失敗:' + esc((j && (j.message || j.error)) || '連線錯誤') + '</p></div>'; return; }
    $('lgSum').innerHTML = chips(j.byUser, '依客人(點名字只看他)');
    const rows = j.rows || [];
    if (!rows.length) { $('lgBody').innerHTML = '<div class="empty-state"><p>這段期間沒有錯誤紀錄 🎉</p></div>'; return; }
    $('lgBody').innerHTML = '<table><thead><tr><th>時間</th><th>客人</th><th>頁面</th><th>剛剛按了</th><th>在做什麼</th><th>錯誤類型</th><th>看到的錯誤</th><th>補充</th></tr></thead><tbody>'
      + rows.map(r => `<tr>
          <td>${esc(tw(r.time))}</td>
          <td title="${esc(r.email)}">${esc(who(r.email))}</td>
          <td>${esc(pageName(r.page))}</td>
          <td>${esc(r.click || '—')}</td>
          <td>${esc(r.act ? actName(r.act) : '—')}</td>
          <td>${esc(ERRK[r.kind] || r.kind || '—')}</td>
          <td style="white-space:normal;min-width:220px;color:#ff9fb8;">${esc(r.msg)}</td>
          <td style="white-space:normal;min-width:160px;font-size:11px;color:var(--t3);">${esc(String(r.detail || '').slice(0, 200))}</td>
        </tr>`).join('') + '</tbody></table>';
  }

  async function loadGen() {
    const j = await call('listGenLog', { days: _f.days, who: _f.who, kind: _f.kind, limit: 300 });
    if (!j || !j.ok) { $('lgBody').innerHTML = '<div class="empty-state"><p>載入失敗:' + esc((j && (j.message || j.error)) || '連線錯誤') + '</p></div>'; return; }
    const kinds = (j.byKind || []).map(k => `<span style="display:inline-block;margin:0 10px 6px 0;font-size:12px;color:var(--t2);">${esc(actName(k.action))} <b style="color:#fff;">${k.n}</b></span>`).join('');
    $('lgSum').innerHTML = chips(j.byUser, '依客人(點名字只看他)')
      + (kinds ? `<div style="margin-bottom:14px;"><div style="${LB}">生成了什麼</div>${kinds}</div>` : '');
    const rows = j.rows || [];
    _genRows = {}; rows.forEach(r => { _genRows[r.id] = r; });
    if (!rows.length) { $('lgBody').innerHTML = '<div class="empty-state"><p>這段期間沒有生成紀錄</p></div>'; return; }
    $('lgBody').innerHTML = '<table><thead><tr><th>時間</th><th>客人</th><th>品牌</th><th>生成了什麼</th><th>KOL</th><th>結果</th><th>成品</th><th>花多久</th></tr></thead><tbody>'
      + rows.map(r => {
          const okTxt = (r.ok === 1) ? '<span style="color:#7CFFB2;">成功</span>'
            : (r.ok === 0) ? `<span style="color:#ff6d9b;" title="${esc(r.err)}">失敗${r.err ? ':' + esc(String(r.err).slice(0, 40)) : ''}</span>` : '<span style="color:var(--t3);">已送出</span>';
          const u = String(r.result_url || '');
          const link = /^https?:\/\//.test(u) ? `<a href="${esc(u)}" target="_blank" rel="noopener" style="color:#5BC8E8;">開啟</a>` : '—';
          return `<tr>
            <td>${esc(tw(r.ts))}</td>
            <td title="${esc(r.email)}">${esc(who(r.email))}</td>
            <td>${esc(r.brand_id || '—')}</td>
            <td title="${esc(r.prompt)}" style="white-space:normal;min-width:160px;">${esc(actName(r.action))}${selLine(r.prompt)}${/^admaker/.test(String(r.action || '')) ? `<div style="margin-top:4px;"><button class="btn-refresh" style="padding:3px 9px;font-size:11px;" onclick="AdminLogs.detail(${Number(r.id)})">看詳細</button></div>` : ''}</td>
            <td>${esc(r.kol_name || '—')}</td>
            <td style="white-space:normal;min-width:90px;">${okTxt}</td>
            <td>${link}</td>
            <td>${esc(sec(r.ms))}</td>
          </tr>`;
        }).join('') + '</tbody></table>';
  }

  // 🔎 v1.2 廣告圖「看詳細」
  let _genRows = {};
  function sect(p, name) {
    const m = new RegExp('【' + name + '[^】]*】([\\s\\S]*?)(?=\\n\\n【|$)').exec(String(p || ''));
    return m ? m[1].trim() : '';
  }
  function box(title, body, mono) {
    if (!body) return '';
    return `<div style="margin-bottom:12px;"><div style="${LB}">${esc(title)}</div><div style="white-space:pre-wrap;font-size:12px;line-height:1.7;color:var(--t1);background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:10px 12px;${mono ? 'font-family:ui-monospace,Menlo,monospace;font-size:11px;' : ''}">${esc(body)}</div></div>`;
  }
  async function detail(id) {
    const old = document.getElementById('lgDetail'); if (old) old.remove();
    const wrap = document.createElement('div');
    wrap.id = 'lgDetail';
    wrap.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.72);display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:30px 14px;';
    wrap.onclick = (e) => { if (e.target === wrap) wrap.remove(); };
    wrap.innerHTML = '<div id="lgDetailBox" style="width:100%;max-width:1100px;background:#14141b;border:1px solid #2e2e3a;border-radius:14px;padding:18px;color:#e8e8f0;"><p style="color:var(--t3);">載入中...</p></div>';
    document.body.appendChild(wrap);
    let row = null, full = false;
    try {
      const r = await fetch(KOL_WORKER, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'gen_log_get', password: PASSWORD, email: ADMIN_USER_EMAIL, token: (window._bsAuthToken ? window._bsAuthToken() : ''), ids: [Number(id)] }) });
      const j = await r.json();
      const list = (j && (j.rows || j.results || j.items)) || [];
      if (j && j.ok && list.length) { row = list[0]; full = true; }
    } catch (_) {}
    if (!row) row = _genRows[id] || {};
    let P = {}; try { P = JSON.parse(row.params || '{}') || {}; } catch (_) {}
    const D = P.director || {};
    const prompt = String(row.prompt || '');
    const sel = (/^【客人選擇】([^\n]*)/.exec(prompt) || [])[1] || '';
    const think = D.think || sect(prompt, '美術指導');
    const fin = sect(prompt, '送給生圖的提示詞') || (sel ? prompt.replace(/^【客人選擇】[^\n]*\n\n/, '') : prompt);
    const draft = sect(prompt, '系統草稿');
    const u = String(row.result_url || '');
    const img = /^https?:\/\//.test(u) ? `<a href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(u)}" style="width:100%;border-radius:10px;display:block;"></a>` : '<div style="color:var(--t3);">(沒有成品網址)</div>';
    const facts = [
      ['客人選擇', sel], ['標題', D.headline], ['副標', D.sub], ['補充說明', D.note],
      ['商品實際大小', D.realSize || (D.ver ? '(客人沒填)' : '')], ['擺放方式', D.placement], ['用的商品照', D.photo || P.filename],
      ['美術指導', D.ver ? ('v' + D.ver + (D.used ? ' · 有用上' : ' · ⚠️ 沒用上:' + (D.error || '')) + ' · 試 ' + (D.tries || 0) + ' 次 · ' + Math.round((D.ms || 0) / 1000) + ' 秒 · 提示詞 ' + (D.finalLen || 0) + ' 字' + (D.longBefore ? '(原本 ' + D.longBefore + ' 字,壓過一次)' : '') + ' · 草稿 ' + (D.draftLen || 0) + ' 字') : '(這筆是美術指導 v2.6 之前的紀錄)']
    ].filter(x => x[1]).map(x => `<div style="font-size:12px;line-height:1.8;"><span style="color:var(--t3);display:inline-block;min-width:92px;">${esc(x[0])}</span>${esc(x[1])}</div>`).join('');
    $('lgDetailBox').innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
        <div style="font-size:15px;font-weight:700;">${esc(actName(row.action))} · ${esc(tw(row.ts))} · ${esc(who(row.email))} · ${esc(row.brand_id || '')}</div>
        <button class="btn-refresh" style="padding:4px 12px;" onclick="document.getElementById('lgDetail').remove()">關閉</button>
      </div>
      <div style="display:flex;gap:18px;flex-wrap:wrap;">
        <div style="flex:1 1 320px;max-width:420px;">${img}<div style="margin-top:12px;">${facts}</div></div>
        <div style="flex:2 1 420px;min-width:0;">
          ${box('美術指導的思考', think)}
          ${box('送給生圖的提示詞', fin, true)}
          ${draft ? `<details><summary style="cursor:pointer;font-size:12px;color:var(--t3);margin-bottom:8px;">系統原本的草稿(${draft.length} 字)</summary>${box('', draft, true)}</details>` : ''}
          ${full ? '' : '<div style="font-size:11px;color:var(--t4);">只看得到前 400 字:整筆紀錄只有 RA 本人的帳號讀得到。</div>'}
        </div>
      </div>`;
  }

  // 🧾 2026-10-22 廣告圖:顯示客人當時選了什麼(admaker.js 寫在 prompt 第一行「【客人選擇】…」)
  function selLine(p) {
    const m = /^【客人選擇】([^\n]*)/.exec(String(p || ''));
    if (!m) return '';
    return '<div style="font-size:11px;line-height:1.6;color:var(--t2);margin-top:3px;">' + esc(m[1]) + '</div>';
  }

  function brief(v) {
    const t = String(v == null ? '' : v);
    if (!t) return '<span style="color:var(--t4);">(空白)</span>';
    return esc(t.length > 80 ? t.slice(0, 80) + '…' : t);
  }
  async function loadChg() {
    const j = await call('listAdminChanges', { days: _f.days, who: _f.who, q: _f.q, limit: 300 });
    if (!j || !j.ok) { $('lgBody').innerHTML = '<div class="empty-state"><p>載入失敗:' + esc((j && (j.message || j.error)) || '連線錯誤') + '</p></div>'; return; }
    const rows = j.rows || [];
    if (!rows.length) { $('lgBody').innerHTML = '<div class="empty-state"><p>這段期間沒有修改紀錄</p></div>'; return; }
    $('lgBody').innerHTML = '<table><thead><tr><th>時間</th><th>誰改的</th><th>哪一頁</th><th>哪一筆</th><th>動作</th><th>哪一格</th><th>原本</th><th>改成</th><th></th></tr></thead><tbody>'
      + rows.map(r => {
          const isRow = (r.op === 'insert' || r.op === 'delete');
          const oldTxt = isRow ? (r.op === 'delete' ? '(整筆商品)' : '—') : brief(r.old_val);
          const newTxt = isRow ? (r.op === 'insert' ? '(整筆商品)' : '—') : brief(r.new_val);
          const btn = r.reverted_by
            ? '<span style="color:var(--t3);font-size:12px;">已還原</span>'
            : `<button class="btn-refresh" style="padding:4px 10px;font-size:12px;" onclick="AdminLogs.revert(${Number(r.id)})">還原</button>`;
          return `<tr>
            <td>${esc(tw(r.time))}</td>
            <td title="${esc(r.email)}">${esc(who(r.email))}</td>
            <td>${esc(TBL[r.tbl] || r.tbl)}</td>
            <td>${esc(r.label || '—')}</td>
            <td>${esc(OP[r.op] || r.op)}</td>
            <td>${esc(isRow ? '—' : (FLD[r.field] || r.field))}</td>
            <td style="white-space:normal;min-width:140px;color:var(--t3);" title="${esc(r.old_val)}">${oldTxt}</td>
            <td style="white-space:normal;min-width:140px;" title="${esc(r.new_val)}">${newTxt}</td>
            <td>${btn}</td>
          </tr>`;
        }).join('') + '</tbody></table>';
  }
  async function revert(id) {
    if (!confirm('要把這一筆改回原本的樣子嗎?')) return;
    let j = await call('adminRevert', { changeId: id });
    if (j && j.code === 'CONFLICT') {
      if (!confirm('這一格之後又被改過了,現在內容是:\n\n' + String(j.current || '(空白)').slice(0, 300) + '\n\n還是要還原嗎?')) return;
      j = await call('adminRevert', { changeId: id, force: true });
    }
    if (!j || !j.ok) { alert('還原失敗:' + ((j && (j.message || j.error)) || '連線錯誤')); return; }
    try { if (typeof bootAdmin === 'function') bootAdmin(); } catch (_) {}   // 品牌/商品頁的資料一起更新
    search();
  }

  async function search() {
    readFilters();
    $('lgBody').innerHTML = '<div class="empty-state"><p>載入中...</p></div>';
    $('lgSum').innerHTML = '';
    try { if (_view === 'err') await loadErr(); else if (_view === 'gen') await loadGen(); else await loadChg(); }
    catch (e) { $('lgBody').innerHTML = '<div class="empty-state"><p>連線錯誤</p></div>'; }
  }

  function load() { if (!$('logsRoot')) return; shell(); search(); }
  function view(v) { readFilters(); _view = (v === 'gen' || v === 'chg') ? v : 'err'; shell(); search(); }
  function pick(email) { const w = $('lgWho'); if (w) w.value = String(email || ''); search(); }

  window.AdminLogs = { load, view, search, pick, revert, detail };
})();
