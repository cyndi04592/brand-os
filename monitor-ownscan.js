/* monitor-ownscan.js — 帳號互搶「自動掃描所有看得到的帳號」(2026-11-23 交代 0104)
   資料:MON.overlap() 回傳的 own(Worker ownscan.js:只讀 Meta,不改廣告)
   - 抓到不是我們操作的帳號在用品牌粉專 / 像素 → 卡片最上面一張紅色表:帳號、用了什麼、投放期間、花費、觸及
   - 老闆 / 審核員看得到「我們操作的帳號」設定(MON.ovOurs / ovOursSet)
   - 不改 monitor-overlap.js:那支畫完卡片後,這支把結果插在第一句下面
   - ?ovdemo=1 時用示範數字(畫面標「示範資料」)
*/
(function () {
  var M = window.MON, last = null, DEMO = /[?&]ovdemo=1/.test(location.search);
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function md(s) { return s ? (+s.slice(5, 7)) + '/' + (+s.slice(8, 10)) : '?'; }
  function money(n, c) { return (c && c !== 'TWD' ? c + ' ' : 'NT$') + Math.round(n || 0).toLocaleString('en-US'); }
  function css() {
    if (document.getElementById('osc-css')) return;
    var s = document.createElement('style'); s.id = 'osc-css';
    s.textContent = '.osc{margin:10px 0;padding:10px 12px;border-radius:10px;background:rgba(250,109,155,.10);border:1px solid rgba(250,109,155,.45)}'
      + '.osc.ok{background:rgba(255,255,255,.03);border-color:rgba(255,255,255,.12)}.osc-t{font-weight:700;margin-bottom:6px}'
      + '.osc table{width:100%;border-collapse:collapse;font-size:13px}.osc th,.osc td{padding:5px 6px;border-bottom:1px solid rgba(255,255,255,.08);text-align:left;vertical-align:top}'
      + '.osc small{opacity:.7}.osc-set{margin-top:8px;font-size:13px}.osc-set input{width:100%;max-width:420px;padding:6px;border-radius:6px;border:1px solid rgba(255,255,255,.2);background:rgba(0,0,0,.25);color:inherit}'
      + '.osc-set button{margin-top:6px;padding:6px 12px;border-radius:6px;border:0;background:#7C6DFA;color:#fff;cursor:pointer}.osc-scroll{overflow-x:auto}';
    document.head.appendChild(s);
  }
  function html(o) {
    if (!o) return '';
    if (o.error) return '<div class="osc ok"><div class="osc-t">自動掃描所有帳號:這次讀不到(' + esc(o.error) + '),燈號照其他判讀</div></div>';
    var f = o.found || [], h = '<div class="osc' + (f.length ? '' : ' ok') + '">';
    h += '<div class="osc-t">' + (o.demo ? '<span class="ov-demo">示範資料</span> ' : '') + (f.length ? '🔴 ' : '') + '自動掃描:看得到的 ' + o.scanned + ' 個廣告帳號、最近 ' + o.days + ' 天'
      + (f.length ? ',有 ' + f.length + ' 個不是我們操作的帳號在用這個品牌' : ',沒有別的帳號用這個品牌的粉專或像素') + '</div>';
    if (f.length) {
      h += '<div class="osc-scroll"><table><tr><th>廣告帳號</th><th>用了</th><th>投放期間</th><th>花費</th><th>觸及</th></tr>' + f.map(function (x) {
        return '<tr><td>' + esc(x.name || x.account) + '<br><small>' + esc(x.account) + (x.src && x.src.length ? '・' + esc(x.src.join('、')) : '') + '</small></td><td>' + esc((x.via || []).join('＋')) + '<br><small>' + x.ads + ' 則廣告</small></td>'
          + '<td>' + (x.first ? md(x.first) + '～' + md(x.last) : '—') + '</td><td>' + money(x.spend, x.currency) + '</td><td>' + (x.reach || 0).toLocaleString('en-US') + '</td></tr>';
      }).join('') + '</table></div>';
      h += '<div style="font-size:13px;margin-top:6px">兩邊在搶同一批人,建議合併成一個帳號,或請對方停掉 / 分開受眾。</div>';
    }
    if (o.unreadable && o.unreadable.length) h += '<div style="font-size:12px;opacity:.8;margin-top:6px">另外 ' + o.unreadable.length + ' 個帳號列得出來但讀不到廣告,沒算進去:' + o.unreadable.slice(0, 6).map(function (x) { return esc(x.name || x.id); }).join('、') + '</div>';
    h += '<div style="font-size:12px;opacity:.7;margin-top:4px">我們操作的帳號:' + esc((o.ours || []).join('、')) + (o.oursSet ? '' : '(沒設定 = 這個品牌綁定的帳號)') + '。CPM、像素事件只當參考,不影響這個燈號。</div>';
    h += '<div class="osc-set" id="osc-set"></div></div>';
    return h;
  }
  function setBox() {
    var el = document.getElementById('osc-set'); if (!el || !M || !M.ovOurs || DEMO) return;
    M.ovOurs().then(function (j) {
      if (!j || !j.canEdit) return;
      el.innerHTML = '<details><summary>設定「我們操作的帳號」(只有管理員看得到)</summary>廣告帳號編號,用逗號隔開:<br><input id="osc-acc" value="' + esc(j.ours.accounts.join(', ')) + '">'
        + '<br>另外的品牌粉專編號(可不填):<br><input id="osc-pg" value="' + esc((j.ours.pages || []).join(', ')) + '"><br><button id="osc-save">存</button> <span id="osc-msg"></span></details>';
      document.getElementById('osc-save').onclick = function () {
        var msg = document.getElementById('osc-msg'); msg.textContent = '存檔中…';
        M.ovOursSet({ accounts: document.getElementById('osc-acc').value, pages: document.getElementById('osc-pg').value }).then(function (r) {
          msg.textContent = r && r.ok ? '存好了,重新掃描中…' : '沒存成功:' + ((r && r.error) || '');
          if (r && r.ok && M.refresh) setTimeout(function () { location.reload(); }, 800);
        });
      };
    });
  }
  function inject() {
    var box = document.getElementById('mon-overlap'); if (!box || !last || !last.own) return;
    var card = box.querySelector('.ov-card'); if (!card || card.querySelector('.osc')) return;
    css();
    if (last.own.found && last.own.found.length) {   // 抓到就是紅燈(Worker 已經改過;示範模式這裡補)
      card.className = 'ov-card red';
      var say = card.querySelector('.ov-say');
      if (say && last.own.sentence) say.innerHTML = (last.own.demo ? '<span class="ov-demo">示範資料</span>' : '') + esc(last.own.sentence);
    }
    var head = card.querySelector('.ov-head'), d = document.createElement('div'); d.innerHTML = html(last.own);
    if (head && head.nextSibling) card.insertBefore(d.firstChild, head.nextSibling); else card.appendChild(d.firstChild);
    setBox();
  }
  function demo() {
    return { ok: true, light: 'red', demo: true, own: { demo: true, sentence: '自動掃描抓到 1 個不是我們操作的廣告帳號在用這個品牌的粉專:「優程工業」11/1～11/21 花了 NT$12,606、觸及 98,566 人。', scanned: 14, days: 60, ours: ['566452034785926'], oursSet: false, unreadable: [{ id: '3333333333', name: '某客戶舊帳號' }],
      found: [{ account: '3483907081758982', name: '優程工業', src: ['芮比 BM 客戶'], via: ['粉專'], ads: 6, first: '2026-11-01', last: '2026-11-21', spend: 12606, reach: 98566, currency: 'TWD' }] } };
  }
  if (M && M.overlap) {
    var orig = M.overlap;
    M.overlap = function () { return orig.apply(this, arguments).then(function (j) { last = j; setTimeout(inject, 0); return j; }); };
  }
  if (DEMO) last = demo();
  new MutationObserver(function () { inject(); }).observe(document.documentElement, { childList: true, subtree: true });
})();
