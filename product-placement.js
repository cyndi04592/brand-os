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
    ],
    large: [
      'standing on the floor of a spacious bright showroom, a person walking past it',
      'standing on a clean workshop floor, a worker standing beside it',
      'standing against a wide living-room wall, a sofa in front of it',
    ],
    flat: [
      'laid flat on the floor of a bright living room, seen from a high angle, a sofa edge and a few toys at its side',
      'laid flat on a sunny playroom floor, seen from above, a pair of small slippers at its edge',
      'laid flat on a pale wooden floor by a big window, seen from a high angle, a cushion beside it',
    ],
  };
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

  function tok() { try { return sessionStorage.getItem('bs_auth_token') || localStorage.getItem('bs_auth_token') || ''; } catch (e) { return ''; } }
  function curProd() { return (window.S && window.S.prod) || null; }
  function keyOf(p) { return String((p && p.placement) || ''); }

  //  ── 給提示詞用的三個小工具(沒選 = 回空字串,行為跟以前一模一樣)──
  function scaleLine(p) { return SCALE[keyOf(p || curProd())] || ''; }
  function isFloorish(p) { return /^(floor|large|flat)$/.test(keyOf(p || curProd())); }
  function setting(p) { const s = SETS[keyOf(p || curProd())]; return s ? pick(s) : ''; }
  function noteLine(p) {
    const n = String(((p || curProd()) || {}).placeNote || '').replace(/\s+/g, ' ').trim();
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
      let sel = keyOf(prod);
      const m = document.createElement('div'); m.id = 'ppl-mask';
      m.innerHTML = '<div id="ppl-box"><h3>這個商品怎麼擺?</h3>' +
        '<div class="sub">「' + esc(prod.name) + '」· 只要選一次,之後廣告圖、影片都照這個大小拍</div>' +
        '<div id="ppl-opts"></div>' +
        '<div style="font-size:12px;font-weight:700;margin-top:10px">補充說明(選填)</div>' +
        '<div style="font-size:11px;color:#9a9aa8">裡面裝什麼、怎麼用。例:一盒 6 包海苔 / 兩隻腳伸進去 / 可以掛在帳篷上</div>' +
        '<textarea id="ppl-note" maxlength="300">' + esc(prod.placeNote || '') + '</textarea>' +
        '<div id="ppl-st"></div><div class="row"><button id="ppl-cancel">取消</button><button id="ppl-save" class="pri">存好,繼續</button></div></div>';
      document.body.appendChild(m);
      const box = m.querySelector('#ppl-opts'), btn = m.querySelector('#ppl-save'), st = m.querySelector('#ppl-st');
      function paint() {
        box.innerHTML = OPTS.map(o => '<div class="opt' + (o.key === sel ? ' on' : '') + '" data-k="' + o.key + '"><b>' + o.label + '</b><div>' + o.hint + '</div></div>').join('');
        box.querySelectorAll('.opt').forEach(el => el.onclick = function () { sel = el.getAttribute('data-k'); paint(); });
        btn.disabled = !sel;
      }
      paint();
      m.querySelector('#ppl-cancel').onclick = function () { m.remove(); done(false); };
      btn.onclick = async function () {
        if (!sel) return;
        btn.disabled = true; st.textContent = '儲存中...';
        const note = m.querySelector('#ppl-note').value.trim();
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
    c.innerHTML = '📦 擺放方式:' + (o ? '<b>' + o.label + '</b>' : '<span style="color:#fa6d9b">還沒選</span>') + '<a>' + (o ? '改' : '選') + '</a>';
    c.querySelector('a').onclick = function () { open(p); };
  }
  function hook() {
    if (typeof window.generateGptPoster !== 'function' || window.generateGptPoster._ppl) return false;
    const orig = window.generateGptPoster;
    const wrapped = async function () {
      const p = curProd();
      if (p && !keyOf(p)) { const ok = await open(p); if (!ok) return; }
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
    const p = curProd(), sig = p ? (p.id + '|' + keyOf(p)) : '-';
    if (sig !== _sig) { _sig = sig; paintChip(); }
  }, 800);

  window.ProductPlace = { OPTS, open, scaleLine, isFloorish, setting, noteLine, version: '1.0' };
})();
