/* ══════════════════════════════════════════════════════════════
   Brand OS · monitor-fold.js · v1.0(2026-11-22)
   廣告監控「每一區可折疊」(RA 11/22 16:31:「頁面要設計折疊,進入廣告監控才不會滑到死。」)

   這支只管「收起 / 展開」,不碰任何數字,也不改各區塊自己的程式:
   · 每一區收起時只留一行:標題 + 狀態章 + 那句「怎麼看」的白話(不截字,手機自動換行)
   · 紅燈(有一格在漏錢、該換素材、該減…)的區塊預設打開;其他預設收起;「總覽」預設打開
   · 最上面一排燈號:點了跳到那一區並展開;右邊「全部展開 / 全部收起」
   · 每個人展開過哪些區記在這台裝置(localStorage mon_fold_v1);收起之後那一區才變紅燈,會再自動打開一次

   折疊單位:
   · 「大品牌還會看的 5 件事」裡的每一張卡(monitor-intl.js 在卡片上標 data-fd="intl-…")
   · 其他每一個 <section class="mn-sec">(總覽、帳號互搶、對帳、芮比大盤、魚池、診斷、策略、進行中廣告)
   新區塊要有燈號和白話:在下面 SEC 加一行(say = 找哪個元素當白話,light = 怎麼看燈號)。
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var KEY = 'mon_fold_v1', st = {};
  try { st = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { st = {}; }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} }

  var CSS = ''
    + '.fd-bar{display:grid;grid-template-columns:auto 1fr auto;gap:6px 10px;align-items:center;width:100%;min-height:44px;margin:0;padding:0;border:0;background:transparent;color:#fff;font-family:inherit;text-align:left;cursor:pointer}'
    + '.fd-sec>.fd-bar{padding:13px 16px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.035);border-radius:14px}'
    + '.fd-bar:hover .fd-go,.fd-bar:focus-visible .fd-go{color:#fff}'
    + '.fd-bar:focus-visible,.fd-lamp:focus-visible,.fd-act:focus-visible{outline:2px solid #fff;outline-offset:2px}'
    + '.fd-dot{display:inline-block;width:10px;height:10px;border-radius:50%;border:1.5px solid rgba(255,255,255,.4);flex:none}'
    + '.fd-dot.good{background:#6DFAC2;border-color:#6DFAC2}.fd-dot.warn{background:#FAC85A;border-color:#FAC85A}.fd-dot.bad{background:#FA6D9B;border-color:#FA6D9B;box-shadow:0 0 0 3px rgba(250,109,155,.22)}'
    + '.fd-hd{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;min-width:0}'
    + '.fd-t{font-size:14px;font-weight:800;line-height:1.5}'
    + '.fd-badge{font-size:12px;font-weight:700;padding:2px 9px;border:1px solid rgba(255,255,255,.3);color:#c8c8d8;white-space:nowrap}'
    + '.fd-badge.good{border-color:#6DFAC2;color:#6DFAC2}.fd-badge.warn{border-color:#FAC85A;color:#FAC85A}.fd-badge.bad{border-color:#FA6D9B;color:#fff;background:rgba(250,109,155,.28)}'
    + '.fd-go{font-size:12.5px;color:#a8a8bc;white-space:nowrap}'
    + '.fd-say{grid-column:2 / -1;font-size:13px;line-height:1.7;color:#d6d6e2;overflow-wrap:anywhere}.fd-say b{color:#fff;font-weight:700}'
    + '.fd-on>.fd-bar{display:none}'
    + '.fd-off>:not(.fd-bar):not(h2){display:none!important}'
    + '.fd-off>h2{height:0!important;margin:0!important;padding:0!important;overflow:hidden!important;background:none!important}'
    + '.fd-on>.fd-head{cursor:pointer}'
    + '.fd-on>h2.fd-head{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 14px}'
    + '.fd-on>.fd-head::after{content:"收起 ▲";margin-left:auto;font-size:12.5px;font-weight:400;letter-spacing:0;color:#a8a8bc;white-space:nowrap;-webkit-text-fill-color:#a8a8bc}'
    + '.fd-on>.fd-head:hover::after{color:#fff;-webkit-text-fill-color:#fff}'
    + '.fd-top{display:flex;flex-wrap:wrap;gap:8px;align-items:center}'
    + '.fd-top:empty{display:none}'
    + '.fd-lamp,.fd-act{display:inline-flex;align-items:center;gap:7px;min-height:36px;padding:6px 12px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.03);color:#e4e4ee;font-size:12.5px;font-family:inherit;cursor:pointer;border-radius:999px}'
    + '.fd-lamp:hover,.fd-act:hover{border-color:#fff;color:#fff}'
    + '.fd-lamp.bad{border-color:rgba(250,109,155,.7)}'
    + '.fd-acts{margin-left:auto;display:flex;gap:8px}'
    + 'html.sp .fd-sec>.fd-bar,html.sp .fd-lamp,html.sp .fd-act{border-radius:0}'
    + 'html.sp .fd-sec>.fd-bar{background:#06080b;padding:16px 20px}'
    + 'html.sp .fd-t{font-weight:500;letter-spacing:.08em}'
    + '@media(max-width:640px){.fd-lamp,.fd-act{min-height:44px;font-size:13px}.fd-acts{margin-left:0;flex:1 1 100%}.fd-acts .fd-act{flex:1;justify-content:center}'
    + '.fd-say{grid-column:1 / -1;font-size:13.5px}.fd-sec>.fd-bar{padding:13px 14px}.fd-go{align-self:start;padding-top:3px}}'
    + '.mo-card.fd-off{padding-top:14px!important;padding-bottom:14px!important}';
  function css() {
    if (document.getElementById('fd-css')) return;
    var s = document.createElement('style'); s.id = 'fd-css'; s.textContent = CSS; document.head.appendChild(s);
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  //  把一個元素的字拿出來當白話(拿掉小字補充;只留粗體)
  function sayOf(el, dropFirstB) {
    if (!el) return '';
    var c = el.cloneNode(true), i, x = c.querySelectorAll('small,button,input,select,svg');
    for (i = 0; i < x.length; i++) x[i].parentNode.removeChild(x[i]);
    if (dropFirstB) { var b = c.querySelector('b'); if (b && /怎麼看/.test(b.textContent)) b.parentNode.removeChild(b); }
    var out = '';
    (function walk(n) {
      for (var k = 0; k < n.childNodes.length; k++) {
        var ch = n.childNodes[k];
        if (ch.nodeType === 3) out += esc(ch.textContent);
        else if (ch.nodeType === 1) { if (ch.tagName === 'B' || ch.tagName === 'STRONG') out += '<b>' + esc(ch.textContent) + '</b>'; else walk(ch); }
      }
    })(c);
    return out.replace(/\s+/g, ' ').trim();
  }
  var LWORD = { good: '正常', warn: '留意', bad: '要處理' };

  //  其他區塊:白話怎麼來、燈號怎麼看
  var SEC = {
    'sec-overview': { open: true, text: '花了多少、帶回多少、漏斗和 28 天走勢。' },
    'sec-overlap': { lamp: true, say: '.ov-say', card: '.ov-card', map: { red: 'bad', yellow: 'warn', green: 'good' }, word: { bad: '兩邊在互搶', warn: '留意', good: '沒有互搶' } },
    'sec-recon': { lamp: true, say: '.rc-say', card: '.rc-card', map: { red: 'bad', yellow: 'warn', green: 'good' }, word: { bad: 'Meta 多算了', warn: '留意', good: '對得上' }, none: '要填訂單數' },
    'sec-index': { lamp: true, say: '.ix-say', card: '.ix-card', map: { self: 'bad', mixed: 'warn', market: 'warn', calm: 'good', hold: 'good' }, wordBy: { self: '問題在自己', mixed: '掉得比大盤多', market: '大環境', calm: '平穩', hold: '撐住了' } },
    'sec-fatigue': { lamp: true, open: true, say: '.fg-say', card: '.fg-card', map: { yellow: 'warn' }, word: { warn: '素材疲勞' } },   // 2026-11-23 交代 0110:素材疲勞黃燈(monitor-fatigue.js),預設打開讓按鈕看得到
    'sec-pool': { text: '預算撒在哪一種網子(出價方式)、各撈回多少。' },
    'sec-diag': { text: '成本變貴時點開:拆成曝光變貴、點的人變少、還是成交的人變少。' },
    'sec-asc': { text: '預算有沒有卡住、學習期過了沒、素材夠不夠。' },
    'sec-ads': { text: '每一支進行中的廣告花多少、成效如何、有沒有疲乏。' }
  };

  function unitOfSection(sec) {
    var h2 = sec.querySelector(':scope > h2'); if (!h2 || !h2.id || h2.id === 'sec-intl') return null;
    if (sec.style.display === 'none') { return null; }
    var cf = SEC[h2.id] || {}, u = { el: sec, key: h2.id, head: h2, sec: true, title: h2.textContent.trim(), light: 'none', badge: '', say: cf.text ? esc(cf.text) : '', lamp: !!cf.lamp, defOpen: !!cf.open };
    if (cf.card) {
      var card = sec.querySelector(cf.card);
      if (card) {
        var cls = card.className.split(/\s+/), i, raw = '';
        for (i = 0; i < cls.length; i++) if (cf.map[cls[i]]) { raw = cls[i]; break; }
        if (raw) { u.light = cf.map[raw]; u.badge = (cf.wordBy && cf.wordBy[raw]) || (cf.word && cf.word[u.light]) || LWORD[u.light]; }
        else if (cf.none) u.badge = cf.none;
      }
      var s = sayOf(sec.querySelector(cf.say)); if (s) u.say = s;
    } else {
      var body = sec.querySelector(':scope > div');
      var nb = body ? body.querySelectorAll('.mo-tag.bad').length : 0;
      if (nb) u.say += ' <b>裡面有 ' + nb + ' 個紅色標記。</b>';
    }
    return u;
  }
  function unitOfCard(card) {
    var mh = card.querySelector(':scope > .mo-h'); if (!mh) return null;
    var c = mh.cloneNode(true), x = c.querySelectorAll('.mo-tag,label,input,button'), i;
    for (i = 0; i < x.length; i++) x[i].parentNode.removeChild(x[i]);
    var tag = mh.querySelector('.mo-tag'), how = card.querySelector(':scope > .in-how'), light = 'none';
    ['good', 'warn', 'bad'].forEach(function (k) { if (tag ? tag.classList.contains(k) : (how && how.classList.contains(k))) light = k; });
    if (light === 'none' && how) light = 'warn';
    return { el: card, key: card.getAttribute('data-fd'), head: mh, sec: false, title: c.textContent.trim(), light: light, lamp: true, defOpen: false,
      badge: tag ? tag.textContent.trim() : (how ? LWORD[light] : '等資料'),
      say: how ? sayOf(how, true) : '這一塊還沒有資料,點開看原因。' };
  }

  var units = [];
  function wantOpen(u) {
    var s = st[u.key];
    if (s) { if (!s.o && s.l !== 'bad' && u.light === 'bad') return true; return !!s.o; }
    return u.defOpen || u.light === 'bad';
  }
  function paint(u) {
    var open = wantOpen(u), el = u.el;
    el.classList.add('fd'); if (u.sec) el.classList.add('fd-sec');
    if (el.classList.contains('fd-on') !== open) el.classList.toggle('fd-on', open);
    if (el.classList.contains('fd-off') === open) el.classList.toggle('fd-off', !open);
    if (!u.head.classList.contains('fd-head')) { u.head.classList.add('fd-head'); u.head.setAttribute('title', '點一下收起這一區'); }
    var bar = el.querySelector(':scope > .fd-bar'), sig = [u.title, u.light, u.badge, u.say].join('|');
    if (!bar) {
      bar = document.createElement('button'); bar.type = 'button'; bar.className = 'fd-bar';
      el.insertBefore(bar, u.sec ? u.head.nextSibling : el.firstChild);
    }
    if (bar.getAttribute('data-sig') !== sig) {
      bar.setAttribute('data-sig', sig);
      bar.innerHTML = '<span class="fd-dot ' + u.light + '"></span><span class="fd-hd"><span class="fd-t">' + esc(u.title) + '</span>'
        + (u.badge ? '<span class="fd-badge ' + u.light + '">' + esc(u.badge) + '</span>' : '') + '</span><span class="fd-go">展開 ▼</span>'
        + (u.say ? '<span class="fd-say">' + u.say + '</span>' : '');
    }
    bar.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  function paintTop() {
    var wrap = document.querySelector('.mn-wrap'); if (!wrap) return;
    var top = document.getElementById('fdTop');
    if (!top) { top = document.createElement('div'); top.id = 'fdTop'; top.className = 'fd-top'; wrap.insertBefore(top, wrap.querySelector('section.mn-sec')); }
    var h = '';
    units.forEach(function (u) { if (u.lamp) h += '<button type="button" class="fd-lamp ' + u.light + '" data-go="' + esc(u.key) + '" title="' + esc(u.badge) + '"><i class="fd-dot ' + u.light + '"></i>' + esc(u.title) + '</button>'; });
    if (units.length) h += '<span class="fd-acts"><button type="button" class="fd-act" data-all="1">全部展開</button><button type="button" class="fd-act" data-all="0">全部收起</button></span>';
    if (top.getAttribute('data-sig') !== h) { top.setAttribute('data-sig', h); top.innerHTML = h; }
  }
  function scan() {
    css();
    var list = [], secs = document.querySelectorAll('.mn-wrap > section.mn-sec'), i, j;
    for (i = 0; i < secs.length; i++) {
      var cards = secs[i].querySelectorAll('.mo-card[data-fd]');
      if (cards.length) { for (j = 0; j < cards.length; j++) { var uc = unitOfCard(cards[j]); if (uc) list.push(uc); } continue; }
      var us = unitOfSection(secs[i]); if (us) list.push(us);
    }
    //  燈號排在前面的順序:有燈的新區塊照頁面順序
    units = list;
    units.forEach(paint); paintTop();
  }
  var timer = null;
  function later() { clearTimeout(timer); timer = setTimeout(scan, 60); }

  function find(key) { for (var i = 0; i < units.length; i++) if (units[i].key === key) return units[i]; return null; }
  function setOpen(u, open) {
    st[u.key] = { o: open ? 1 : 0, l: u.light }; paint(u);
    if (open) { try { window.dispatchEvent(new Event('resize')); } catch (e) {} }   // 收著的時候寬度是 0,魚池地圖要重量一次
  }
  function go(el) {
    if (!el) return;
    setTimeout(function () {
      var top = document.querySelector('.mn-top'), off = (top ? top.getBoundingClientRect().height : 0) + 12;
      window.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + window.pageYOffset - off), behavior: 'smooth' });
    }, 30);
  }
  document.addEventListener('click', function (e) {
    var t = e.target, b, u; if (!t.closest) return;
    if ((b = t.closest('.fd-bar'))) { u = find(keyOf(b.parentNode)); if (u) { setOpen(u, true); save(); } return; }
    if ((b = t.closest('.fd-lamp'))) { u = find(b.getAttribute('data-go')); if (u) { setOpen(u, true); save(); go(u.el); } return; }
    if ((b = t.closest('.fd-act'))) { var on = b.getAttribute('data-all') === '1'; units.forEach(function (x) { setOpen(x, on); }); save(); return; }
    if ((b = t.closest('.mn-tab'))) {
      var id = (b.getAttribute('href') || '').slice(1); u = find(id);
      if (u) { e.preventDefault(); setOpen(u, true); save(); go(u.el); }
      return;
    }
    if ((b = t.closest('.fd-head')) && !t.closest('input,button,a,label,select,textarea')) {
      u = find(keyOf(b.parentNode)); if (u && b.parentNode.classList.contains('fd-on')) { setOpen(u, false); save(); }
    }
  });
  function keyOf(el) { if (!el) return ''; var k = el.getAttribute('data-fd'); if (k) return k; var h = el.querySelector(':scope > h2'); return h ? h.id : ''; }

  function boot() {
    var wrap = document.querySelector('.mn-wrap'); if (!wrap) return;
    scan();
    try {
      new MutationObserver(later).observe(wrap, { childList: true, subtree: true, characterData: true });
      var secs = wrap.querySelectorAll('section.mn-sec'), mo = new MutationObserver(later);
      for (var i = 0; i < secs.length; i++) mo.observe(secs[i], { attributes: true, attributeFilter: ['style'] });
    } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();

  window.MON_FOLD = { version: 'monitor-fold v1.0', scan: scan, state: function () { return units.map(function (u) { return { key: u.key, light: u.light, badge: u.badge, open: u.el.classList.contains('fd-on') }; }); } };
})();
