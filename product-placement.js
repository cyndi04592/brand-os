/* ═══════════════════════════════════════════════════════════════
   📦 product-placement.js v1.0(2026-10-27)商品「擺放方式」
   病灶(RA 實測):巧福「大巴士收納櫃」被縮小放上餐桌、塞進櫃子 ——
     AI 只拿到一張去背圖,看不出商品多大;我們的場景又寫「放在桌上」,它就把櫃子縮到放得上桌。
   做法:
     ① 每個商品存一個「擺放方式」(8 選 1)+ 選填「補充說明」(裡面裝什麼、怎麼用)
     ② 客人第一次拿這個商品做廣告圖時跳小視窗選一次,存回商品(kol-proxy v6.58 product_placement_set)
     ③ 廣告圖(photoroom-proxy /adlean.js)、商品運鏡(kol-proxy AdMotion)都讀這裡的同一份句子
        → 提示詞只多「一句尺寸」+(有填才有)「一句補充」,不佔字數
   一個檔案一個職責:index.html / config.js 不再長肉,這支自己掛
   🎯 v1.3(2026-10-27)「這是哪一類」點一下 → 自動帶入驗證過的專業說明(RA:Red hammer 那段要烙印,
     以後生存遊戲的客人進來點「生存遊戲」就有,不用自己寫長文)。說明照樣存進補充說明 → 廣告圖、影片都吃得到。
     ⚠️ 只放【實測過有效】的類別;每做好一個新行業就加一條 KNOW。
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const KOL = 'https://kol-proxy.calm-sunset-6b66.workers.dev';

  //  8 個選項(跟 kol-proxy PLACEMENTS 同一份代號;畫面顯示中文)
  const OPTS = [
    { key: 'tip',     label: '指尖小物',        hint: '兩根手指捏得起來:一顆糖、一塊巧克力、膠囊' },
    { key: 'palm',    label: '手掌大小',        hint: '一隻手握得住:一包零食、一瓶保養品、手機' },
    { key: 'table',   label: '桌上型',          hint: '放在桌面上:文件架、咖啡機、禮盒、一盤菜' },
    { key: 'floor',   label: '落地型',          hint: '放在地上,大約到大人膝蓋～胸口:收納櫃、桑拿機、電風扇' },
    { key: 'large',   label: '大型設備・家具',   hint: '比人高:衣櫃、書櫃、CNC 機台' },
    { key: 'flat',    label: '鋪地型',          hint: '平鋪在地上:地墊、圍欄、地毯' },
    { key: 'wear',    label: '穿戴・做在人身上', hint: '衣服、鞋、包、內衣、飾品、美睫、髮型' },
    { key: 'service', label: '服務・課程',      hint: '沒有實體商品:顧問、課程、買賣服務' },
  ];

  //  給提示詞的「一句尺寸」:正面事實、用日常東西比,不寫公分(RA:公分 AI 用不上)
  const SCALE = {
    tip:   'It is a tiny piece, small enough to pinch between two fingers, shown at that true size.',
    palm:  'It is a hand-sized piece that fits in one hand, shown at that true size.',
    table: 'It is a tabletop piece that sits on a table or counter, shown at that true size.',
    floor: 'It is a floor-standing piece about knee-to-chest height of an adult, standing on the floor at that true size.',
    large: 'It is a large floor-standing piece taller than an adult, standing on the floor at that true size.',
    flat:  'It lies flat on the floor, covering a patch of floor about the size of a rug.',
  };
  //  落地 / 大型 / 鋪地:桌面場景全部不適用 → 換成「人能走進去的房間」,旁邊有大家知道多大的東西當比例
  const SETS = {
    floor: [
      'standing on the floor of a bright living room, a sofa beside it',
      'standing on the floor of a child\'s bedroom, a low bed and a rug beside it',
      'standing on the floor of a sunlit hallway near the front door',
      'standing on the floor in a quiet bedroom corner by the window, a chair beside it',
      'standing on the floor in a calm home corner, a floor lamp and a potted plant beside it',
      'standing on the tiled floor of a covered balcony, a folding chair beside it',
      // ── 2026-10-27 Pinterest「2026質感 家具 拍攝 空間」「2026質感 兒童房」 ──
      'standing on the floor of an airy white room, floor-length sheer curtains and an arched floor lamp beside it',
      'standing on the floor of a seventies living room, a round walnut coffee table and a shag rug beside it',
      'standing on the floor of a cream living room, a tan leather sofa and a big leafy plant beside it',
      'standing on a woven rattan mat against a textured lime-plaster wall, a low stool beside it',
      'standing on the floor of a children\'s room with arched built-in shelves, a round rug and a small wooden chair beside it',
      'standing on the floor of a children\'s room with a sage-green panelled wall, a low bed and a soft pouf beside it',
      'standing on the warm wooden floor of a light hallway with framed prints, a pair of shoes beside it',
      'standing on the floor of a bare putty-coloured room, one hard line of sun across the floor, a single chair beside it',
    ],
    large: [
      'standing on the floor of a spacious bright showroom, a person walking past it',
      'standing on a clean workshop floor, a worker standing beside it',
      'standing against a wide living-room wall, a sofa in front of it',
      'standing in a calm grey living room with tall sheer curtains, a person walking past in the background',
      'standing in a bright open-plan apartment, a dining table and chairs in front of it',
      'standing against a textured plaster wall in a spacious room, a person standing a few steps away',
      'standing on a polished concrete floor in a quiet design studio, a long work table beside it',
    ],
    flat: [
      'laid flat on the floor of a bright living room, seen from a high angle, a sofa edge and a few toys at its side',
      'laid flat on a sunny playroom floor, seen from above, a pair of small slippers at its edge',
      'laid flat on a pale wooden floor by a big window, seen from a high angle, a cushion beside it',
      'laid flat in a children\'s room with arched built-in shelves, seen from a high angle, a small wooden chair at its edge',
      'laid flat on a sage-green room floor, seen from above, a soft toy and a pouf at its side',
      'laid flat in a sunny living room with sheer curtains, seen from a high angle, a low sofa behind it',
    ],
  };
  //  🎯 v1.3 行業知識庫:點一下帶入。文字寫【正面事實】,不寫「禁止/不要」
  //   生存遊戲:實測 2026-10-27 Red hammer 瞄具蓋(提示詞全程不提「槍」,寫 replica / 生存遊戲 → 圖片模型不擋)
  const KNOW = [
    { key: 'airsoft', label: '🎯 生存遊戲配件',
      note: '生存遊戲(airsoft)配件:畫面裡它裝在金屬 replica 上的正確位置,或放在生存遊戲場地、戰術裝備旁;玩家戴戰術手套使用' },
  ];
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

  function tok() { try { return sessionStorage.getItem('bs_auth_token') || localStorage.getItem('bs_auth_token') || ''; } catch (e) { return ''; } }
  function curProd() { return (window.S && window.S.prod) || null; }
  function keyOf(p) { return String((p && p.placement) || ''); }

  //  ── 給提示詞用的三個小工具(沒選 = 回空字串,行為跟以前一模一樣)──
  //  📏 v1.2 大小用「點一下」選,不用打字(RA:1000 個客人不可能一個一個跟我聊多高)
  //   存在補充說明最前面「【大小】到大人的腰。」→ 不用動資料庫、後台也看得到改得到
  const SIZES = {
    floor: [['到大人的膝蓋', 'about knee height of an adult'], ['到大人的腰', 'about waist height of an adult'], ['到大人的胸口', 'about chest height of an adult'], ['跟大人差不多高', 'about as tall as an adult']],
    large: [['跟大人差不多高', 'about as tall as an adult'], ['比大人高一個頭', 'about a head taller than an adult'], ['快碰到天花板', 'almost reaching the ceiling']],
    flat:  [['一張小地墊大小', 'about the size of a small doormat'], ['一張客廳地毯大小', 'about the size of a living-room rug'], ['鋪滿半個房間', 'covering about half the floor of a room']],
    table: [['比 A4 紙小', 'smaller than a sheet of A4 paper'], ['像一個鞋盒', 'about the size of a shoebox'], ['像一台微波爐', 'about the size of a microwave oven']],
    palm:  [['握在手心', 'small enough to close inside one palm'], ['像一支手機', 'about the size of a phone'], ['像一瓶 500ml 的水', 'about the size of a 500 ml water bottle']],
  };
  const SIZE_RE = /^【大小】([^。]+)。\s*/;
  function sizeOf(p) { const m = String((p && p.placeNote) || '').match(SIZE_RE); return m ? m[1] : ''; }
  function restNote(p) { return String((p && p.placeNote) || '').replace(SIZE_RE, '').trim(); }
  function needsSize(p) { return /^(floor|large|flat)$/.test(keyOf(p)) && !sizeOf(p); }
  function sizeEn(p) { const k = keyOf(p), zh = sizeOf(p), row = (SIZES[k] || []).find(x => x[0] === zh); return row ? row[1] : ''; }
  function scaleLine(p) {
    p = p || curProd(); const k = keyOf(p), en = sizeEn(p);
    if (!en) return SCALE[k] || '';
    if (k === 'floor') return 'It is a floor-standing piece ' + en + ', standing on the floor at that true size.';
    if (k === 'large') return 'It is a large floor-standing piece, ' + en + ', standing on the floor at that true size.';
    if (k === 'flat')  return 'It lies flat on the floor, ' + en + '.';
    return (SCALE[k] || '') + ' It is ' + en + '.';
  }
  function isFloorish(p) { return /^(floor|large|flat)$/.test(keyOf(p || curProd())); }
  function setting(p) { const s = SETS[keyOf(p || curProd())]; return s ? pick(s) : ''; }
  function noteLine(p) {
    const n = restNote(p || curProd()).replace(/\s+/g, ' ').trim();
    return n ? 'About the product: ' + n.slice(0, 160) + '.' : '';
  }

  // ── 小視窗 ─────────────────────────────────────────────────────
  function css() {
    if (document.getElementById('ppl-css')) return;
    const st = document.createElement('style'); st.id = 'ppl-css';
    st.textContent = '#ppl-mask{position:fixed;inset:0;background:rgba(5,5,10,.72);backdrop-filter:blur(6px);z-index:100000;display:flex;align-items:center;justify-content:center;padding:12px}' +
      '#ppl-box{background:var(--surface,#16161d);color:var(--text,#f0f0f8);border:1px solid rgba(255,255,255,.08);border-radius:14px;max-width:460px;width:100%;max-height:92vh;overflow:auto;padding:20px;font-size:14px;line-height:1.6;box-sizing:border-box;font-family:inherit}' +
      '#ppl-box h3{margin:0 0 2px;font-size:17px}#ppl-box .sub{color:rgba(240,240,248,.5);font-size:12px;margin-bottom:12px}' +
      '#ppl-box .opt{padding:9px 11px;border-radius:9px;cursor:pointer;border:1.5px solid #2e2e3a;margin-bottom:6px}' +
      '#ppl-box .opt.on{border-color:#7c6dfa;background:rgba(124,109,250,.15)}#ppl-box .opt b{font-size:13px}#ppl-box .opt div{font-size:11px;color:#9a9aa8;margin-top:1px}' +
      '#ppl-box textarea{width:100%;box-sizing:border-box;min-height:62px;background:#1f1f29;color:#f0f0f8;border:1px solid #2e2e3a;border-radius:8px;padding:8px 10px;font:inherit;font-size:13px;margin-top:4px}' +
      '#ppl-box .row{display:flex;gap:8px;margin-top:14px}#ppl-box button{flex:1;padding:10px;border-radius:8px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.04);color:#f0f0f8;font:inherit;font-size:14px;cursor:pointer}' +
      '#ppl-box button.pri{background:linear-gradient(135deg,#7c6dfa,#fa6d9b);border-color:transparent;font-weight:700}#ppl-box button:disabled{opacity:.4;cursor:not-allowed}' +
      '#ppl-st{font-size:12px;color:#fa6d9b;min-height:16px;margin-top:6px}' +
      '.ppl-chip{display:flex;align-items:center;gap:6px;font-size:11px;color:rgba(240,240,248,.7);margin:0 0 8px;padding:6px 9px;border:1px dashed rgba(124,109,250,.45);border-radius:8px}' +
      '.ppl-chip a{color:#a99cff;cursor:pointer;text-decoration:underline;margin-left:auto}';
    document.head.appendChild(st);
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  //  open(prod) → Promise<true 已存 / false 取消>
  function open(prod) {
    prod = prod || curProd();
    return new Promise(function (done) {
      if (!prod) { done(false); return; }
      css();
      const old = document.getElementById('ppl-mask'); if (old) old.remove();
      let sel = keyOf(prod), size = sizeOf(prod);
      const m = document.createElement('div'); m.id = 'ppl-mask';
      m.innerHTML = '<div id="ppl-box"><h3>這個商品怎麼擺?</h3>' +
        '<div class="sub">「' + esc(prod.name) + '」· 只要選一次,之後廣告圖、影片都照這個大小拍</div>' +
        '<div id="ppl-opts"></div><div id="ppl-size"></div>' +
        '<div style="font-size:12px;font-weight:700;margin-top:10px">補充說明(選填)</div>' +
        '<div style="font-size:11px;color:#9a9aa8">裡面裝什麼、怎麼用。例:一盒 6 包海苔 / 兩隻腳伸進去 / 可以掛在帳篷上</div>' +
        '<div id="ppl-know" style="display:flex;flex-wrap:wrap;gap:6px;margin:6px 0 2px"></div>' +
        '<textarea id="ppl-note" maxlength="300">' + esc(restNote(prod)) + '</textarea>' +
        '<div id="ppl-st"></div><div class="row"><button id="ppl-cancel">取消</button><button id="ppl-save" class="pri">存好,繼續</button></div></div>';
      document.body.appendChild(m);
      const box = m.querySelector('#ppl-opts'), btn = m.querySelector('#ppl-save'), st = m.querySelector('#ppl-st');
      function paint() {
        box.innerHTML = OPTS.map(o => '<div class="opt' + (o.key === sel ? ' on' : '') + '" data-k="' + o.key + '"><b>' + o.label + '</b><div>' + o.hint + '</div></div>').join('');
        box.querySelectorAll('.opt').forEach(el => el.onclick = function () { const k = el.getAttribute('data-k'); if (k !== sel) size = ''; sel = k; paint(); });
        //  📏 選了有大小差別的 → 下面接一排「大約多大」,點一下就好(落地/大型/鋪地必選)
        const sz = m.querySelector('#ppl-size'), rows = SIZES[sel] || [], must = /^(floor|large|flat)$/.test(sel);
        if (size && !rows.some(x => x[0] === size)) size = '';
        sz.innerHTML = rows.length ? '<div style="font-size:12px;font-weight:700;margin:10px 0 6px">大約多大?' + (must ? '<span style="color:#fa6d9b"> (必選)</span>' : '(選填)') + '</div><div style="display:flex;flex-wrap:wrap;gap:6px">' +
          rows.map(x => '<div class="opt' + (x[0] === size ? ' on' : '') + '" data-s="' + x[0] + '" style="margin:0;padding:7px 10px;font-size:13px">' + x[0] + '</div>').join('') + '</div>' : '';
        sz.querySelectorAll('[data-s]').forEach(el => el.onclick = function () { const v = el.getAttribute('data-s'); size = (size === v && !must) ? '' : v; paint(); });
        btn.disabled = !sel || (must && !size);
      }
      paint();
      //  🎯 v1.3 行業按鈕:點了就把那段專業說明放進補充說明最前面(已有就拿掉 = 再點一次取消)
      const kb = m.querySelector('#ppl-know'), ta = m.querySelector('#ppl-note');
      function paintKnow() {
        kb.innerHTML = '<span style="font-size:11px;color:#9a9aa8;width:100%">是這一類嗎?點一下,系統自動補上專業說明:</span>' +
          KNOW.map(k => '<div class="opt' + (ta.value.indexOf(k.note) > -1 ? ' on' : '') + '" data-kn="' + k.key + '" style="margin:0;padding:6px 10px;font-size:12px">' + k.label + '</div>').join('');
        kb.querySelectorAll('[data-kn]').forEach(el => el.onclick = function () {
          const k = KNOW.find(x => x.key === el.getAttribute('data-kn')); if (!k) return;
          const v = ta.value;
          ta.value = v.indexOf(k.note) > -1 ? v.replace(k.note, '').replace(/^[;;。\s]+/, '').trim() : (k.note + (v.trim() ? ';' + v.trim() : ''));
          paintKnow();
        });
      }
      ta.addEventListener('input', paintKnow);
      paintKnow();
      m.querySelector('#ppl-cancel').onclick = function () { m.remove(); done(false); };
      btn.onclick = async function () {
        if (!sel) return;
        btn.disabled = true; st.textContent = '儲存中...';
        const note = (size ? '【大小】' + size + '。' : '') + m.querySelector('#ppl-note').value.trim().replace(SIZE_RE, '');
        try {
          const r = await fetch(KOL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
            action: 'product_placement_set', password: (typeof GAS_PASSWORD !== 'undefined' ? GAS_PASSWORD : ''),
            token: tok(),
            brandId: (window.S && window.S.brandId) || '', subId: (window.S && window.S.subId) || '', prodId: prod.id,
            placement: sel, placeNote: note }) }).then(x => x.json());
          if (!r || !r.ok) throw new Error((r && r.error) || '儲存失敗');
          prod.placement = sel; prod.placeNote = note;
          m.remove(); paintChip(); done(true);
        } catch (e) { st.textContent = '⚠️ ' + e.message; btn.disabled = false; }
      };
    });
  }

  // ── 廣告圖頁:生成前沒選過就先問;設定區上方顯示目前選的 ──
  function paintChip() {
    const sec = document.getElementById('prGptPosterSection'); if (!sec) return;
    let c = document.getElementById('ppl-chip');
    const p = curProd();
    if (!p) { if (c) c.remove(); return; }
    css();
    if (!c) { c = document.createElement('div'); c.id = 'ppl-chip'; c.className = 'ppl-chip'; sec.insertBefore(c, sec.firstChild); }
    const o = OPTS.find(x => x.key === keyOf(p));
    const zs = sizeOf(p);
    c.innerHTML = '📦 擺放方式:' + (o ? '<b>' + o.label + '</b>' + (zs ? ' · ' + esc(zs) : (needsSize(p) ? ' · <span style="color:#fa6d9b">還沒選大小</span>' : '')) : '<span style="color:#fa6d9b">還沒選</span>') + '<a>' + (o ? '改' : '選') + '</a>';
    c.querySelector('a').onclick = function () { open(p); };
  }
  function hook() {
    if (typeof window.generateGptPoster !== 'function' || window.generateGptPoster._ppl) return false;
    const orig = window.generateGptPoster;
    const wrapped = async function () {
      const p = curProd();
      if (p && (!keyOf(p) || needsSize(p))) { const ok = await open(p); if (!ok) return; }   // 📏 v1.2 落地/大型/鋪地還沒選大小 → 也問一次
      return orig.apply(this, arguments);
    };
    wrapped._ppl = true;
    window.generateGptPoster = wrapped;
    return true;
  }
  let _n = 0; const _iv = setInterval(function () { if (hook() || ++_n > 60) clearInterval(_iv); }, 500);
  //  編輯器開著時,換了商品 / 改了擺放方式才重畫 chip(不盯整頁的變動,省電)
  let _sig = '';
  setInterval(function () {
    const md = document.getElementById('adMakerModal');
    if (!md || md.style.display === 'none') { _sig = ''; return; }
    const p = curProd(), sig = p ? (p.id + '|' + keyOf(p) + '|' + sizeOf(p)) : '-';
    if (sig !== _sig) { _sig = sig; paintChip(); }
  }, 800);

  window.ProductPlace = { OPTS, open, scaleLine, isFloorish, setting, noteLine, version: '1.3', KNOW: KNOW, sizeOf: sizeOf, needsSize: needsSize };
})();
