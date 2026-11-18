// ═══════════════════════════════════════════════════════════════
//  📷 onboard-menu-scan.js v1.0(2026-11-18)品牌入駐書「拍菜單 / 價目表,AI 幫你填商品」
//  起因:RA —— 開餐廳的品項很多,商品名稱、價格、多大一列一列打太累。
//
//  · 商品表上方多一顆按鈕:選菜單、價目表、型錄的照片或 PDF(一次最多 6 個檔)
//  · AI 讀出每個品項的名稱、是什麼、價格,能判斷大小的順便選好「多大」
//  · 直接填進原本的商品表(先填空白列,不夠再加),客人可以照常改、刪
//  · 已經在表上的同名品項不重複加
//  走入駐書原本就在用的 claude_generate(訪客可用、不扣點、每天 20 次上限跟靈魂書共用),
//  Worker 不用改。照片先在手機上縮小再送(省流量、漫遊也送得動)。
//  onboard.html 已超過 1,500 行,這支獨立成檔,onboard.html 只多一行 <script>。
// ═══════════════════════════════════════════════════════════════
(function () {
  'use strict';
  if (window.__onbMenuScan) return;
  window.__onbMenuScan = true;
  var VERSION = '1.0';
  var MAX_FILES = 6, PER_CALL = 3, MAX_SIDE = 1800, MAX_PDF = 8 * 1024 * 1024, MAX_TOKENS = 2000;
  var SIZE_KEYS = ['finger', 'half', 'p1', 'p15', 'p2', 'p3', 'knee', 'waist', 'chest', 'human', 'taller'];

  function lang() {
    var l = window.BOS_LANG;
    if (!l) { try { l = localStorage.getItem('bos_lang'); } catch (e) {} }
    return (l === 'ja' || l === 'en') ? l : 'zh';
  }
  function T(zh, ja, en) { var l = lang(); return l === 'ja' ? ja : l === 'en' ? en : zh; }
  function $(id) { return document.getElementById(id); }

  // ── 介面 ─────────────────────────────────────────────────────
  var box, btn, msg, pick, busy = false;
  function label() {
    return T('📷 上傳菜單 / 價目表,AI 幫你填', '📷 メニュー・価格表から AI が自動入力', '📷 Upload a menu / price list — AI fills it in');
  }
  function mount() {
    var pt = $('prodTable');
    if (!pt || !(window.__pt && __pt.add)) return setTimeout(mount, 600);
    if ($('menuScanBox')) return;
    box = document.createElement('div');
    box.id = 'menuScanBox'; box.setAttribute('data-i18n-skip', '');
    box.style.cssText = 'margin:0 0 12px;padding:12px 14px;border:1px dashed rgba(245,197,66,.55);border-radius:12px;background:rgba(245,197,66,.06)';
    btn = document.createElement('button');
    btn.type = 'button'; btn.id = 'menuScanBtn';
    btn.style.cssText = 'width:100%;padding:11px 12px;border-radius:10px;border:0;cursor:pointer;background:#f5c542;color:#1a1a1d;font:800 14px/1.4 "Noto Sans TC",system-ui,sans-serif';
    btn.textContent = label();
    var hint = document.createElement('div');
    hint.style.cssText = 'margin-top:8px;font-size:12px;line-height:1.6;color:rgba(255,255,255,.62)';
    hint.textContent = T('品項很多(例如餐廳)時用這個:拍清楚的菜單照片或 PDF,一次最多 6 個檔。填好之後請再檢查一次名稱和價格。',
                         '品数が多い場合(飲食店など)に。鮮明なメニュー写真か PDF を最大 6 ファイルまで。入力後、名称と価格を確認してください。',
                         'Great for long lists (e.g. restaurants): clear photos or PDFs, up to 6 files. Please double-check names and prices afterwards.');
    msg = document.createElement('div');
    msg.style.cssText = 'margin-top:8px;font-size:13px;line-height:1.6;display:none';
    pick = document.createElement('input');
    pick.type = 'file'; pick.accept = 'image/*,application/pdf'; pick.multiple = true; pick.style.display = 'none';
    btn.onclick = function () { if (!busy) pick.click(); };
    pick.onchange = function () { var fs = [].slice.call(pick.files || []); pick.value = ''; if (fs.length) run(fs); };
    box.appendChild(btn); box.appendChild(hint); box.appendChild(msg); box.appendChild(pick);
    pt.parentNode.insertBefore(box, pt);
  }
  function say(text, kind) {
    msg.style.display = text ? '' : 'none';
    msg.style.color = kind === 'err' ? '#ff8a8a' : kind === 'ok' ? '#7ee2a8' : 'rgba(255,255,255,.75)';
    msg.textContent = text || '';
  }
  function setBusy(b, text) {
    busy = b; btn.disabled = b; btn.style.opacity = b ? '.6' : '1';
    btn.textContent = b ? text : label();
  }

  // ── 檔案 → 給 AI 的內容 ─────────────────────────────────────
  function readAsDataURL(f) {
    return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(r.result); }; r.onerror = rej; r.readAsDataURL(f); });
  }
  function shrink(f) {
    return readAsDataURL(f).then(function (url) {
      return new Promise(function (res) {
        var img = new Image();
        img.onload = function () {
          var w = img.naturalWidth, h = img.naturalHeight, s = Math.min(1, MAX_SIDE / Math.max(w, h));
          var c = document.createElement('canvas'); c.width = Math.round(w * s); c.height = Math.round(h * s);
          var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
          res(c.toDataURL('image/jpeg', 0.85));
        };
        img.onerror = function () { res(null); };                  // HEIC 等瀏覽器讀不了的格式
        img.src = url;
      });
    });
  }
  function toBlock(f) {
    if (/pdf$/i.test(f.type) || /\.pdf$/i.test(f.name)) {
      if (f.size > MAX_PDF) return Promise.resolve({ skip: T('PDF 太大(超過 8MB):', 'PDF が大きすぎます(8MB 超):', 'PDF too large (over 8MB): ') + f.name });
      return readAsDataURL(f).then(function (u) {
        return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: String(u).split(',')[1] } };
      });
    }
    return shrink(f).then(function (u) {
      if (!u) return { skip: T('這張照片格式讀不了,請改成 JPG 或截圖:', 'この画像は読み込めません。JPG かスクリーンショットに:', 'Can\'t read this image — try JPG or a screenshot: ') + f.name };
      return { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: u.split(',')[1] } };
    });
  }

  // ── 問 AI ───────────────────────────────────────────────────
  function existingNames() {
    var s = {};
    document.querySelectorAll('#prodTable .pt-name').forEach(function (e) { var v = e.value.trim(); if (v) s[v] = 1; });
    return s;
  }
  function instruction(brand) {
    return '這是一個品牌的菜單 / 價目表 / 型錄(照片或 PDF)。' + (brand ? '品牌名稱:' + brand + '。' : '') + '\n' +
      '請把上面看得到的每一個品項都列出來,一行一個,格式固定(用全形直線「｜」分隔,共四欄):\n' +
      '名稱｜這是什麼、怎麼用(15 字內)｜價格｜大小代號\n\n' +
      '規則:\n' +
      '1. 名稱照菜單上寫的,包含口味、規格、份量(例:招牌牛肉麵(大)、米香腸原味 280g)。\n' +
      '2. 同一品項有不同尺寸或價格,拆成不同行。\n' +
      '3. 第二欄寫它是什麼:例如 主餐、湯品、飲料、甜點、套餐內容,菜單上有描述就濃縮成 15 字內。\n' +
      '4. 價格寫成 NT$數字(外幣照原幣別寫,例 HK$48);菜單上沒寫就留空。\n' +
      '5. 大小代號只能從這些挑一個,看不出來就留空(大部分餐點留空即可):\n' +
      '   finger=一根手指、half=半個手掌、p1=1個手掌、p15=1.5個手掌、p2=2個手掌、p3=3個手掌、knee=到大人膝蓋、waist=到大人腰、chest=到胸口、human=跟大人一樣高、taller=比大人高\n' +
      '6. 看不清楚的字不要猜,寧可少列。分類標題、店家地址電話、促銷說明不要列。\n' +
      '7. 只輸出品項行,不要標題、不要編號、不要任何說明文字。';
  }
  function ask(blocks) {
    var brand = ($('f_name') && $('f_name').value.trim()) || '';
    var content = blocks.concat([{ type: 'text', text: instruction(brand) }]);
    var body = { action: 'claude_generate', prompt: content, max_tokens: MAX_TOKENS };
    try { body.password = GAS_PASSWORD; } catch (e) {}
    try { body.token = guestToken; } catch (e) {}
    try { body.email = userEmail; } catch (e) {}
    var url = '';
    try { url = CF_WORKER_URL; } catch (e) {}
    return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json(); });
  }
  function parse(text) {
    var out = [];
    String(text || '').split(/\r?\n/).forEach(function (line) {
      var l = line.replace(/^\s*(?:[-*•]|\d+[.、)])\s+/, '').trim();   // 只拿掉清單編號,「3杯雞」的 3 要留著
      if (!l || l.indexOf('｜') < 0) return;
      var p = l.split('｜').map(function (x) { return x.trim(); });
      var n = p[0] || ''; if (!n || n.length > 60) return;
      var k = (p[3] || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      out.push({ n: n, u: (p[1] || '').slice(0, 40), p: (p[2] || '').slice(0, 30), k: SIZE_KEYS.indexOf(k) >= 0 ? k : '' });
    });
    return out;
  }

  // ── 填進商品表 ───────────────────────────────────────────────
  function fire(el) { ['input', 'change'].forEach(function (t) { el.dispatchEvent(new Event(t, { bubbles: true })); }); }
  function fill(items) {
    var have = existingNames(), added = 0;
    items.forEach(function (x) {
      if (have[x.n]) return;
      var row = null;
      document.querySelectorAll('#prodTable .pt-row').forEach(function (r) {
        if (row) return;
        var a = r.querySelector('.pt-name'), b = r.querySelector('.pt-use'), c = r.querySelector('.pt-price');
        if (a && !a.value.trim() && !(b && b.value.trim()) && !(c && c.value.trim())) row = r;
      });
      if (!row) { __pt.add('', '', false, ''); var all = document.querySelectorAll('#prodTable .pt-row'); row = all[all.length - 1]; }
      if (!row) return;
      var set = function (cls, v) { var e = row.querySelector(cls); if (e) { e.value = v || ''; fire(e); } };
      set('.pt-use', x.u); set('.pt-price', x.p);
      try { if (x.k && row._cell && row._cell.set) row._cell.set(x.k); } catch (e) {}
      set('.pt-name', x.n);                                        // 最後填名稱 → 觸發同步
      have[x.n] = 1; added++;
    });
    return added;
  }

  // ── 主流程 ───────────────────────────────────────────────────
  function run(files) {
    var notes = [];
    if (files.length > MAX_FILES) {
      notes.push(T('一次最多 ' + MAX_FILES + ' 個檔,只讀前 ' + MAX_FILES + ' 個。', '一度に最大 ' + MAX_FILES + ' ファイルまで。最初の ' + MAX_FILES + ' 件のみ読み込みます。', 'Up to ' + MAX_FILES + ' files at once — reading the first ' + MAX_FILES + '.'));
      files = files.slice(0, MAX_FILES);
    }
    setBusy(true, T('AI 正在讀菜單…(約 20~40 秒,請停留在這頁)', 'AI がメニューを読み取り中…(20〜40 秒、このページのままで)', 'AI is reading your menu… (20–40 s, please stay on this page)'));
    say('', '');
    var total = 0, cut = false, errs = [];
    Promise.all(files.map(toBlock)).then(function (blocks) {
      var good = [];
      blocks.forEach(function (b) { if (b.skip) notes.push(b.skip); else good.push(b); });
      var groups = [];
      for (var i = 0; i < good.length; i += PER_CALL) groups.push(good.slice(i, i + PER_CALL));
      var chain = Promise.resolve();
      groups.forEach(function (g, gi) {
        chain = chain.then(function () {
          if (groups.length > 1) btn.textContent = T('AI 正在讀菜單…(' + (gi + 1) + '/' + groups.length + ')', 'AI 読み取り中…(' + (gi + 1) + '/' + groups.length + ')', 'Reading… (' + (gi + 1) + '/' + groups.length + ')');
          return ask(g).then(function (d) {
            if (!d || d.ok === false || !d.text) { errs.push((d && (d.message || d.error)) || T('讀取失敗', '読み取り失敗', 'Failed')); return; }
            if (d.usage && Number(d.usage.output_tokens) >= MAX_TOKENS - 30) cut = true;
            total += fill(parse(d.text));
          }).catch(function (e) { errs.push(e && e.message || 'network'); });
        });
      });
      return chain;
    }).then(function () {
      setBusy(false);
      var parts = [];
      if (total) parts.push(T('已填入 ' + total + ' 個品項,請往下檢查名稱和價格。', total + ' 品目を入力しました。名称と価格を確認してください。', 'Added ' + total + ' items — please check names and prices below.'));
      else if (!errs.length) parts.push(T('沒有讀到新的品項。請換一張更清楚、正面拍的照片。', '新しい品目を読み取れませんでした。より鮮明な写真でお試しください。', 'No new items found. Try a clearer, straight-on photo.'));
      if (cut) parts.push(T('品項太多,可能沒讀完:可以把菜單分成幾張拍,再上傳一次。', '品目が多く、途中までの可能性があります。数枚に分けて再度アップロードしてください。', 'Long list — some items may be missing. Upload it in smaller parts.'));
      if (errs.length) parts.push(T('有部分沒讀成功:', '一部読み取れませんでした:', 'Some parts failed: ') + errs[0]);
      parts = parts.concat(notes);
      say(parts.join(' '), (total && !errs.length) ? 'ok' : (total ? '' : 'err'));
    }).catch(function (e) {
      setBusy(false);
      say(T('讀取失敗:', '読み取り失敗:', 'Failed: ') + (e && e.message || ''), 'err');
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
  window.BosMenuScan = { version: VERSION, parse: parse };
  console.log('[onboard-menu-scan] 📷 v' + VERSION + ' 菜單 / 價目表自動填商品');
})();
