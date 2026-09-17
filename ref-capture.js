/* ═══════════════════════════════════════════════════════════════
   🤝 ref-capture.js v1.0(2026-09-17)推薦碼自動記住
   ・網址帶 ?ref=AMY20(或 ?r=AMY20)→ 存在這台瀏覽器 90 天
   ・客人之後不管從哪一頁去買方案,結帳時自動帶上,不用自己打碼
   ・已經有推薦碼時,新的連結【不覆蓋】—— 第一個推薦人算數(跟後端綁定規則一致)
   ・只負責「記住」,真正的綁定與分潤在 Worker(v5.57)
   ═══════════════════════════════════════════════════════════════ */
(function () {
  var KEY = 'raby_ref', DAYS = 90;
  function norm(v) { var c = String(v || '').trim().toUpperCase(); return /^[A-Z0-9_-]{2,20}$/.test(c) ? c : ''; }
  function read() {
    try {
      var o = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (!o || !o.code) return '';
      if (Date.now() - Number(o.at || 0) > DAYS * 86400000) { localStorage.removeItem(KEY); return ''; }
      return o.code;
    } catch (e) { return ''; }
  }
  function save(code, force) {
    try { if (code && (force || !read())) localStorage.setItem(KEY, JSON.stringify({ code: code, at: Date.now() })); } catch (e) {}
  }
  try {
    var q = new URLSearchParams(location.search);
    save(norm(q.get('ref') || q.get('r')), false);
  } catch (e) {}
  window.RabyRef = { get: read, set: function (v) { save(norm(v), true); return read(); }, norm: norm };
})();
