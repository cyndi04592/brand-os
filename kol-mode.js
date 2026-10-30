// ═══════════════════════════════════════════════════════════════
//  🎬 kol-mode.js v1.4(2026-10-30)— KOL 工作室「影片風格」切換鈕
//  v1.5:偶像動漫 3D 卡片換成現在線上真正轉出來的那張(舊卡是改版前偏皮克斯的圖)
//  v1.4:風格 21 → 25(Q 版大頭、黑白漫畫、粉彩水彩動漫、紅黑海報;RA 給的 Pinterest 裡現有沒有的才加)
//  v1.3:動畫模式只在 STEP2 生效;切到 STEP3 單集企劃或其他頁面自動回到寫實(避免角色設計圖對錯 KOL)
//  v1.2:風格 13 → 21 種、重新分 5 組(配合 Worker v6.72);熱血戰鬥標「已測」
//  v1.1:風格卡改成可收合(左欄窄,13 張卡太長)—— 平常只顯示「目前風格」一列,按「更換風格 ▾」才展開,點完卡片自動收起
//  RA 拍板:動畫不是另一個版面,是 KOL 同一條流程上的一顆切換鈕。
//   ① 寫實真人 / 動畫 二選一(寫實 = 跟原本一模一樣)
//   ② 動畫 → 25 種風格卡(卡片圖 = anim-styles/<key>.jpg;v1.4 新 4 種用 CDN 角色設計圖)
//   ③ 角色確認:KOL 照片轉成該風格的角色設計圖(kol_toon,60 點;同一位 KOL 同一風格只轉一次,之後免費)
//   ④ 下面流程照舊;提示詞與分鏡思考由 Worker 食譜依 window.KOL_MODE 自動切換
//  對外:window.KOL_MODE(風格 key,寫實 = '')、window.KOL_TOON_URL(角色設計圖)
//  依賴:window.KolAnim(Worker recipe.js v6.66+)、api()、toast()、S(kol.html)
//  掛載:自己插在 STEP2「KOL 形象庫」清單下面,kol.html 只需要一行 <script>
// ═══════════════════════════════════════════════════════════════
(function () {
  'use strict';
  const VERSION = '1.5';
  const LS_KEY = 'kolAnimMode';
  const IMG_DIR = 'anim-styles/';
  //  v1.4:新 4 種的卡片圖直接用自家 CDN 上那張角色設計圖(裁成 480 正方),不用另外傳 GitHub
  const CDN_CARD = 'https://cdn.raby.com.tw/cdn-cgi/image/width=480,height=480,fit=cover,gravity=0.5x0.3,quality=85,format=auto/ra/toon/';
  const CARD_SRC = {
    anime3d: CDN_CARD + 'anime3d-8c3bf0c04dd0a06f35d5d053be1df1668a3643ea.jpg',
    chibi: CDN_CARD + 'chibi-01716c404e429a83b385cf998a04c42ace0e5035.jpg',
    manga: CDN_CARD + 'manga-1d47680b75fc67f997b393015bd4f39dcc5f9fc6.jpg',
    poster: CDN_CARD + 'poster-db02efb979d7b6ad9ff3bbc6d5c7cb5107603b48.jpg',
    pastelwc: CDN_CARD + 'pastelwc-98dc6b866377a066a2db1511c946061ab518a617.jpg',
  };
  function _card(k) { return CARD_SRC[k] || (IMG_DIR + k + '.jpg'); }

  //  卡片文字(UI 用;畫風本身寫在 Worker 食譜)
  const GROUPS = [
    { name: '3D 動畫', items: [
      ['pixar', '皮克斯 3D', '寫實比例、柔光皮膚、真情表演', '已測'],
      ['fantasy3d', '卡通喜劇 3D', '超圓比例、橡皮筋誇張、糖果高彩'],
      ['anime3d', '偶像動漫 3D', '韓系偶像、改良韓服、漫畫式誇張表情'],
      ['painterly', '油畫筆觸 3D', '會動的油畫、筆觸＋墨線'],
      ['isometric', '3D 微縮街景', '等角視角的可愛小鎮'],
    ] },
    { name: '手作定格', items: [
      ['toy', '潮玩公仔世界', '2 頭身公仔、黏土微縮場景'],
      ['knit', '毛線定格', '針織紋路、手作小房間'],
    ] },
    { name: '日本動畫', items: [
      ['jp_slice', '日式生活動畫', '細線、柔光、安靜留白'],
      ['shonen', '熱血戰鬥動畫', '粗墨線、速度線、爆發', '已測'],
      ['animefood', '動漫商品特寫', '美食與商品的動畫特寫'],
      ['retro90s', '90 年代復古動畫', '賽璐珞、底片顆粒、VHS 感'],
      ['cyberanime', '賽博動漫', '藍色螢幕光、霓虹、未來感'],
      ['lineart', '日系線稿插畫', '細線、淡色、大量留白'],
      ['chibi', 'Q 版大頭', '2 頭半身、超大眼睛、蹦蹦跳跳'],
      ['manga', '黑白漫畫', '黑白線稿＋網點,商品是唯一彩色'],
      ['pastelwc', '粉彩水彩動漫', '粉紅淡紫水彩暈染、夢幻大眼'],
    ] },
    { name: '插畫動畫', items: [
      ['gouache', '手繪水粉 lo-fi', '水粉蠟筆、紙紋、夕陽金光'],
      ['picturebook', '繪本動物', '色鉛筆繪本、變成可愛小動物'],
      ['editorial', '潮流插畫', '粗線條、大色塊、有態度'],
      ['scribble', '塗鴉實拍', '蠟筆塗鴉角色在真實場景'],
      ['neon', '霓虹雙色', '紫＋桃紅、夜色氛圍'],
      ['poster', '紅黑海報', '大紅、黑、米白三色網版印刷'],
    ] },
    { name: '平面設計', items: [
      ['flat', '品牌扁平動畫', '品牌色大色塊、彈跳手腳'],
      ['geo', '幾何說明動畫', '純扁平、圖表自己畫出來'],
      ['pixel', '像素過場', '方塊像素、遊戲過場感'],
    ] },
  ];
  const LABEL = {};
  GROUPS.forEach(function (g) { g.items.forEach(function (it) { LABEL[it[0]] = it[1]; }); });

  let mode = '';          // '' = 寫實
  let toonFor = '';       // 角色設計圖對應的「KOL 照片網址|風格」
  let busy = false;
  let open = false;       // 風格卡展開中

  function _ls(k, v) { try { if (v === undefined) return localStorage.getItem(k) || ''; localStorage.setItem(k, v); } catch (e) { return ''; } }
  function _kolImg() { try { return (window.S && S.selectedKol && S.selectedKol.image_url) || ''; } catch (e) { return ''; } }
  function _kolName() { try { return (window.S && S.selectedKol && S.selectedKol.name) || ''; } catch (e) { return ''; } }
  function _toast(m, t) { try { (window.toast || console.log)(m, t); } catch (e) {} }
  function _esc(x) { return String(x || '').replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  //  v1.3:動畫模式只在 STEP2(電影鏡頭)生效 —— STEP3 單集企劃、其他頁面一律回到寫實
  //   (STEP3 選的 KOL 可能跟 STEP2 不同,角色設計圖會對錯人)
  function _inStep2() {
    const lay = document.getElementById('main-layout-cinematic');
    return !!(lay && getComputedStyle(lay).display !== 'none');
  }
  function _apply() {
    const ok = mode && window.KolAnim && window.KolAnim.STYLES && window.KolAnim.STYLES[mode];
    window.KOL_MODE = (ok && _inStep2()) ? mode : '';
    if (!ok) window.KOL_TOON_URL = '';
    _badge();
  }

  // ── 樣式 ──
  function _css() {
    if (document.getElementById('kolmode-css')) return;
    const st = document.createElement('style');
    st.id = 'kolmode-css';
    st.textContent = ''
      + '#kolmode{margin:14px 0 4px;padding:14px;border:1px solid var(--border,#2a2a3d);border-radius:12px;background:var(--surface2,#14141f)}'
      + '#kolmode .km-t{font-size:13px;font-weight:700;margin-bottom:8px}'
      + '#kolmode .km-seg{display:inline-flex;border:1px solid var(--border,#2a2a3d);border-radius:10px;padding:3px;background:#0b0b12}'
      + '#kolmode .km-seg button{border:0;background:transparent;color:#9a9aab;padding:7px 16px;border-radius:8px;font-size:13px;cursor:pointer}'
      + '#kolmode .km-seg button.on{background:var(--accent,#a99bff);color:#0a0a0f;font-weight:700}'
      + '#kolmode .km-g{font-size:11px;opacity:.6;margin:12px 0 6px}'
      + '#kolmode .km-row{display:flex;gap:8px;flex-wrap:wrap}'
      + '#kolmode .km-c{width:112px;border:1.5px solid var(--border,#2a2a3d);border-radius:10px;overflow:hidden;cursor:pointer;background:#0f0f18}'
      + '#kolmode .km-c img{width:112px;height:112px;object-fit:cover;display:block}'
      + '#kolmode .km-c.on{border-color:var(--accent,#a99bff);box-shadow:0 0 0 2px rgba(169,155,255,.35)}'
      + '#kolmode .km-cn{font-size:12px;font-weight:700;padding:6px 7px 1px}'
      + '#kolmode .km-cd{font-size:10.5px;opacity:.6;padding:0 7px 7px;line-height:1.4}'
      + '#kolmode .km-tag{font-size:9.5px;border-radius:5px;padding:0 5px;margin-left:4px;background:#1f3a2a;color:#7be0a0}'
      + '#kolmode .km-tag.new{background:#2a2540;color:#c9bfff}'
      + '#kolmode .km-char{display:flex;gap:12px;align-items:center;margin-top:12px;padding-top:12px;border-top:1px dashed var(--border,#2a2a3d)}'
      + '#kolmode .km-char img{width:84px;height:84px;border-radius:10px;object-fit:cover;border:1.5px solid var(--accent,#a99bff)}'
      + '#kolmode .km-note{font-size:11.5px;opacity:.65;line-height:1.6}'
      + '#kolmode .km-btns{margin-top:7px;display:flex;gap:6px;flex-wrap:wrap}'
      + '#kolmode .km-cur{display:flex;gap:10px;align-items:center;margin-top:10px;padding:8px;border:1.5px solid var(--accent,#a99bff);border-radius:10px;background:#0f0f18;cursor:pointer}'
      + '#kolmode .km-cur img{width:52px;height:52px;border-radius:8px;object-fit:cover}'
      + '#kolmode .km-cur .km-curt{font-size:13px;font-weight:700}'
      + '#kolmode .km-cur .km-curd{font-size:11px;opacity:.6;margin-top:2px}'
      + '#kolmode .km-cur .km-chg{margin-left:auto;font-size:12px;color:var(--accent,#a99bff);white-space:nowrap}'
      + '.km-badge{display:inline-block;margin-left:8px;font-size:12px;padding:3px 9px;border-radius:7px;background:rgba(169,155,255,.15);color:var(--accent,#a99bff);vertical-align:middle}';
    document.head.appendChild(st);
  }

  // ── 畫面 ──
  function _render() {
    const box = document.getElementById('kolmode');
    if (!box) return;
    let h = '<div class="km-t">🎬 影片風格</div>'
      + '<div class="km-seg"><button data-km="real" class="' + (mode ? '' : 'on') + '">📷 寫實真人</button>'
      + '<button data-km="anim" class="' + (mode ? 'on' : '') + '">🎬 動畫</button></div>';
    if (mode && !open) {
      const it = _item(mode);
      h += '<div class="km-cur" data-km-open="1"><img src="' + _card(mode) + '" alt="">'
        + '<div><div class="km-curt">' + _esc(it ? it[1] : '') + '</div><div class="km-curd">' + _esc(it ? it[2] : '') + '</div></div>'
        + '<span class="km-chg">更換風格 ▾</span></div>';
      h += '<div class="km-char" id="km-char">' + _charHtml() + '</div>';
    } else if (mode) {
      h += '<div class="km-g" style="display:flex;justify-content:space-between;align-items:center"><span>選一種畫風</span><span data-km-close="1" style="cursor:pointer;color:var(--accent,#a99bff)">收起 ▴</span></div>';
      GROUPS.forEach(function (g) {
        h += '<div class="km-g">' + g.name + '</div><div class="km-row">';
        g.items.forEach(function (it) {
          const tag = it[3] ? '<span class="km-tag">' + it[3] + '</span>' : '<span class="km-tag new">新</span>';
          h += '<div class="km-c' + (mode === it[0] ? ' on' : '') + '" data-ks="' + it[0] + '">'
            + '<img loading="lazy" src="' + _card(it[0]) + '" alt="' + _esc(it[1]) + '">'
            + '<div class="km-cn">' + _esc(it[1]) + tag + '</div><div class="km-cd">' + _esc(it[2]) + '</div></div>';
        });
        h += '</div>';
      });
      h += '<div class="km-char" id="km-char">' + _charHtml() + '</div>';
    } else {
      h += '<div class="km-note" style="margin-top:8px">寫實真人 = 跟原本一模一樣。選「動畫」才會展開風格。</div>';
    }
    box.innerHTML = h;
  }

  function _item(k) {
    let f = null;
    GROUPS.forEach(function (g) { g.items.forEach(function (it) { if (it[0] === k) f = it; }); });
    return f;
  }

  function _charHtml() {
    const img = _kolImg(), nm = _esc(_kolName()), lb = _esc(LABEL[mode] || '');
    if (!img) return '<div class="km-note">先在上面選一位 KOL,再轉成「' + lb + '」角色。</div>';
    if (busy) return '<div class="km-note">⏳ 正在把 ' + nm + ' 轉成「' + lb + '」角色…(約 20 秒)</div>';
    if (window.KOL_TOON_URL && toonFor === img + '|' + mode) {
      return '<img src="' + _esc(window.KOL_TOON_URL) + '" alt="">'
        + '<div><div style="font-size:13px;font-weight:700">' + nm + ' · ' + lb + ' 版 ✓</div>'
        + '<div class="km-note">影片裡的人物就用這張。之後再選這個風格直接用,不再扣點。</div>'
        + '<div class="km-btns"><button class="btn btn-ghost btn-sm" data-km-redo="1">↻ 重轉(60 點)</button></div></div>';
    }
    return '<div><div style="font-size:13px;font-weight:700">' + nm + ' 還沒有「' + lb + '」角色</div>'
      + '<div class="km-note">第一次要把 ' + nm + ' 轉成這個風格(60 點),之後直接用。</div>'
      + '<div class="km-btns"><button class="btn btn-primary btn-sm" data-km-make="1">✨ 轉換角色(60 點)</button></div></div>';
  }

  function _refreshChar() { const c = document.getElementById('km-char'); if (c) c.innerHTML = _charHtml(); }

  // ── 角色設計圖 ──
  async function _lookup() {
    const img = _kolImg();
    if (!mode || !img) { window.KOL_TOON_URL = ''; toonFor = ''; _refreshChar(); return; }
    const want = img + '|' + mode;
    if (toonFor === want && window.KOL_TOON_URL) { _refreshChar(); return; }
    window.KOL_TOON_URL = ''; toonFor = '';
    _refreshChar();
    try {
      const r = await api('kol_toon_get', { style: mode, imageUrl: img });
      if (_kolImg() + '|' + mode !== want) return;          // 中途換人/換風格 → 丟掉舊結果
      if (r && r.ok && r.url) { window.KOL_TOON_URL = r.url; toonFor = want; }
    } catch (e) {}
    _refreshChar();
  }

  async function _make(force) {
    const img = _kolImg();
    if (!img || !mode || busy) return;
    const want = img + '|' + mode;
    busy = true; _refreshChar();
    try {
      const r = await api('kol_toon', { style: mode, imageUrl: img, brandId: (window.S && S.currentBrandId) || '', force: !!force });
      if (r && r.ok && r.url && _kolImg() + '|' + mode === want) { window.KOL_TOON_URL = r.url; toonFor = want; }
      else if (!(r && r.ok)) _toast('角色轉換失敗:' + ((r && r.error) || '請再試一次'), 'error');
    } catch (e) { _toast('角色轉換失敗:' + e.message, 'error'); }
    busy = false; _refreshChar();
  }

  // ── 生成按鈕旁的標記 + 沒轉角色先擋 ──
  function _badge() {
    const btn = document.getElementById('create-seedance-btn');
    if (!btn) return;
    let b = document.getElementById('km-badge');
    if (!window.KOL_MODE) { if (b) b.remove(); return; }
    if (!b) { b = document.createElement('span'); b.id = 'km-badge'; b.className = 'km-badge'; btn.insertAdjacentElement('afterend', b); }
    b.textContent = '🎬 ' + (LABEL[window.KOL_MODE] || '動畫');
  }
  document.addEventListener('click', function (e) {
    const t = e.target && e.target.closest && e.target.closest('#create-seedance-btn');
    if (!t || !window.KOL_MODE) return;
    if (!window.KOL_TOON_URL || toonFor !== _kolImg() + '|' + window.KOL_MODE) {
      e.preventDefault(); e.stopImmediatePropagation();
      _toast('動畫模式要先在「影片風格」轉換角色,再生成', 'warn');
      const box = document.getElementById('kolmode'); if (box) box.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, true);

  // ── 事件 ──
  function _bind(box) {
    box.addEventListener('click', function (e) {
      const seg = e.target.closest('[data-km]');
      if (seg) {
        if (seg.dataset.km === 'real') { mode = ''; open = false; }
        else if (!mode) { mode = _ls(LS_KEY) && LABEL[_ls(LS_KEY)] ? _ls(LS_KEY) : 'pixar'; open = !_ls(LS_KEY); }
        _ls(LS_KEY + 'On', mode ? '1' : '');
        _apply(); _render(); _lookup(); return;
      }
      const card = e.target.closest('[data-ks]');
      if (card) { mode = card.dataset.ks; open = false; _ls(LS_KEY, mode); _ls(LS_KEY + 'On', '1'); _apply(); _render(); _lookup(); return; }
      if (e.target.closest('[data-km-open]')) { open = true; _render(); return; }
      if (e.target.closest('[data-km-close]')) { open = false; _render(); _lookup(); return; }
      if (e.target.closest('[data-km-make]')) { _make(false); return; }
      if (e.target.closest('[data-km-redo]')) { _make(true); return; }
    });
  }

  function _mount() {
    if (document.getElementById('kolmode')) return true;
    const list = document.getElementById('kol-list-cine');
    if (!list) return false;
    _css();
    const box = document.createElement('div');
    box.id = 'kolmode';
    list.insertAdjacentElement('afterend', box);
    _bind(box);
    if (_ls(LS_KEY + 'On') === '1' && LABEL[_ls(LS_KEY)]) mode = _ls(LS_KEY);
    _apply(); _render(); _lookup();
    return true;
  }

  //  換 KOL 時重新查角色設計圖(S.selectedKol 由 kol.html 管,這裡只看不改)
  let _lastImg = '';
  setInterval(function () {
    if (!document.getElementById('kolmode')) { _mount(); return; }
    const img = _kolImg();
    if (img !== _lastImg) { _lastImg = img; if (mode) _lookup(); }
    _apply();
  }, 800);

  window.KolMode = { version: VERSION, get: function () { return mode; }, set: function (k) { mode = LABEL[k] ? k : ''; _apply(); _render(); _lookup(); } };
  console.log('[KolMode] 🎬 v' + VERSION + ' 就緒 · 寫實/動畫切換 · ' + Object.keys(LABEL).length + ' 種風格');
})();
