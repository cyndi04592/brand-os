/* monitor-ovmark.js · v1.0(2026-11-22 交代 20261122-2106)
   互搶區「我知道有別的帳號在用同一個像素」——自動判讀讀不到時的最後備案(老闆 21:05:巧福這兩週有另一個帳號在用同一個像素,沒抓到)。
   只在互搶區(#mon-overlap)畫好之後,接在最下面加一塊;不改 monitor-overlap.js(那支別條線在改)。
   資料:MON.ovMark() / MON.ovMarkSet()(Worker action 'ov_mark' / 'ov_mark_set';只存 KV,不碰 Meta 設定)。
   只有管理員(老闆 / 審核員)看得到按鈕;客戶只看得到「已標記」那一行。
   ?ovdemo=1 示範:用假標記畫一次。
*/
(function () {
  'use strict';
  if (!window.MON) return;
  var M = window.MON;
  var demo = /[?&]ovdemo=1/.test(location.search);
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function css() {
    if (document.getElementById('ovm-css')) return;
    var s = document.createElement('style'); s.id = 'ovm-css';
    s.textContent = '.ovm{margin-top:12px;padding:10px 12px;border:1px dashed rgba(255,255,255,.25);border-radius:10px;font-size:14px;line-height:1.6}'
      + '.ovm b{color:#ffb36b}.ovm button{margin:6px 6px 0 0;padding:7px 12px;border-radius:8px;border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.06);color:inherit;font-size:14px;cursor:pointer}'
      + '.ovm .f{display:grid;grid-template-columns:1fr;gap:6px;margin-top:8px}.ovm input{padding:7px 9px;border-radius:7px;border:1px solid rgba(255,255,255,.25);background:rgba(0,0,0,.25);color:inherit;font-size:14px;max-width:100%}'
      + '.ovm .msg{color:#ff8a8a}.ovm .sub{opacity:.75;font-size:13px}@media(min-width:720px){.ovm .f{grid-template-columns:repeat(4,1fr)}}';
    document.head.appendChild(s);
  }
  var info = null, busy = false, lastBrand = '';
  function today() { var d = new Date(Date.now() + 8 * 3600e3); return d.toISOString().slice(0, 10); }
  function html(form, msg) {
    var m = info && info.mark, h = '<div class="ovm" id="ovm">';
    if (m) {
      h += '已標記:<b>' + esc(m.rival) + '</b> ' + esc(m.since) + (m.until ? ' 到 ' + esc(m.until) : ' 起') + ' 也在用同一個像素' + (m.note ? '(' + esc(m.note) + ')' : '') + '。'
        + '<div class="sub">系統讀不到這個帳號,燈號和 CPM 對照照這個標記算;廣告檔案庫每天自動比一次粉專上不是我們投的廣告。</div>';
    } else {
      h += '<div class="sub">自動判讀只看得到我們有權限的帳號。知道客戶另外有帳號在用同一個像素,可以在這裡標記,系統會照日期比對 CPM。</div>';
    }
    if (info && info.canEdit) {
      if (form) {
        h += '<div class="f"><input id="ovm-r" placeholder="對方帳號名稱(不知道就留空)" value="' + esc(m ? m.rival : '') + '">'
          + '<input id="ovm-s" type="date" value="' + esc(m ? m.since : '') + '" title="大約從哪天開始投">'
          + '<input id="ovm-u" type="date" value="' + esc(m ? m.until : '') + '" title="哪天停(還在投就留空)">'
          + '<input id="ovm-n" placeholder="備註(可留空)" value="' + esc(m ? m.note : '') + '"></div>'
          + '<button data-a="save">存起來</button><button data-a="cancel">取消</button>';
      } else {
        h += '<button data-a="open">' + (m ? '改標記' : '我知道有別的帳號在用同一個像素') + '</button>' + (m ? '<button data-a="clear">撤掉標記</button>' : '');
      }
    }
    if (msg) h += '<div class="msg">' + esc(msg) + '</div>';
    return h + '</div>';
  }
  function paint(form, msg) {
    var box = document.getElementById('mon-overlap'); if (!box || !info) return;
    var old = document.getElementById('ovm'); if (old) old.remove();
    box.insertAdjacentHTML('beforeend', html(form, msg));
  }
  function refresh() {   // 標記改了 → 互搶區重抓一次(monitor-overlap.js 的 draw 會重畫,我們再接上)
    M.overlap().then(function (j) { if (window.MON_OVERLAP && j) window.MON_OVERLAP.draw(j); });
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('#ovm button'); if (!b || busy) return;
    var a = b.getAttribute('data-a');
    if (a === 'open') return paint(true);
    if (a === 'cancel') return paint(false);
    if (a === 'clear' && !confirm('撤掉這個標記?(紀錄會留著,只是不再套用)')) return;
    var body = a === 'clear' ? { clear: true } : {
      rival: document.getElementById('ovm-r').value, since: document.getElementById('ovm-s').value,
      until: document.getElementById('ovm-u').value, note: document.getElementById('ovm-n').value };
    if (a === 'save' && !body.since) return paint(true, '請填對方大約從哪一天開始投');
    if (a === 'save' && body.since > today()) return paint(true, '開始日期不能是未來');
    if (demo) { info.mark = a === 'clear' ? null : body; return paint(false); }
    busy = true;
    M.ovMarkSet(body).then(function (j) {
      busy = false;
      if (!j || !j.ok) return paint(true, (j && j.error) || '存不起來,請再試一次');
      info.mark = j.mark; paint(false); refresh();
    }, function () { busy = false; paint(true, '連不到伺服器,請再試一次'); });
  });
  function load() {
    var b = M.state.brand;
    if (demo) { info = info || { mark: { rival: '客戶公司帳號', since: '2026-11-08', until: '', note: '示範' }, canEdit: true }; return paint(false); }
    if (b !== lastBrand || !info) {
      lastBrand = b; info = null;
      M.ovMark().then(function (j) { if (M.state.brand === b && j) { info = j; paint(false); } });
    } else paint(false);
  }
  css();
  var box = document.getElementById('mon-overlap');
  if (!box) return;
  new MutationObserver(function () { if (!document.getElementById('ovm') && box.children.length) load(); }).observe(box, { childList: true });
  window.MON_OVMARK = { version: 'monitor-ovmark v1.0' };
})();
