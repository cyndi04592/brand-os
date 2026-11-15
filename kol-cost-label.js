// ═══════════════════════════════════════════════════════════════
//  💰 kol-cost-label.js v1.0(2026-11-15)「生成電影鏡頭」按鈕直接寫扣幾點
//  RA:畫面上寫的點數 = 實際扣的點數。首頁廣告圖按鈕早就有「扣 N 點」,KOL 拍片這顆沒有。
//
//  算法跟 kol-proxy Worker 扣點關卡一模一樣(2026-11-15 讀 live 確認):
//    每秒 60 點;本人真人角色(有存本人聲音)每秒 80 點;1080P 三倍。
//    有確認過的分鏡 → 秒數 = 分鏡卡秒數加總;沒有 → 時長按鈕(auto 照 Worker 算 5 秒)。
//    無臉模式不用 KOL,一律每秒 60 點。
//  跟「生成前確認視窗」(kol.html _pgcCostLine)同一套,只是提早寫在按鈕上。
//  只改按鈕上的字,不碰生成流程;按鈕在「生成中…」等其他狀態時不動它。
//  kol.html 已超過 1,500 行,這支獨立成檔。
// ═══════════════════════════════════════════════════════════════
(function () {
  'use strict';
  if (window.__kolCostLabel) return;
  window.__kolCostLabel = true;
  var VERSION = '1.0';

  var BASE = { zh: '生成電影鏡頭', ja: 'シネマショットを生成', en: 'Generate cinematic shot' };
  function lang() {
    var l = window.BOS_LANG;
    if (!l) { try { l = localStorage.getItem('bos_lang'); } catch (e) {} }
    return (l === 'ja' || l === 'en') ? l : 'zh';
  }
  function fmt(n) {
    var s = n.toLocaleString(), l = lang();
    return l === 'ja' ? s + ' ポイント' : l === 'en' ? s + ' pts' : '扣 ' + s + ' 點';
  }

  //  本人真人角色查一次就記住(kol_voice_info 是查詢,不扣點)
  var voice = {};
  function rate(faceless) {
    if (faceless) return 60;
    try {
      var bid = S.currentBrandId, nm = S.selectedKol && S.selectedKol.name;
      if (!bid || !nm) return 60;
      var k = bid + '|' + nm;
      if (voice[k] === true) return 80;
      if (voice[k] === undefined && typeof api === 'function') {
        voice[k] = 'pending';
        api('kol_voice_info', { brandId: bid, personaName: nm })
          .then(function (v) { voice[k] = !!(v && v.hasVoice); })
          .catch(function () { voice[k] = false; });
      }
    } catch (e) {}
    return 60;
  }

  function cost() {
    try {
      if (typeof S === 'undefined' || !S.seedanceParams) return 0;
      var p = S.seedanceParams;
      var ft = document.getElementById('faceless-toggle');
      var faceless = !!(ft && ft.classList.contains('on'));
      var secs = 0, sb = S.cineStoryboard;
      if (sb && sb.length) secs = sb.reduce(function (a, x) { return a + (Number(x && x.seconds) || 0); }, 0);
      if (!secs) secs = parseInt(p.duration, 10) || 5;          // auto → Worker 照 5 秒扣
      var hi = /1080|1k|2k|4k/i.test(String(p.resolution || '720p'));
      return secs * rate(faceless) * (hi ? 3 : 1);
    } catch (e) { return 0; }
  }

  function tick() {
    var b = document.getElementById('create-seedance-btn');
    if (!b) return;
    var t = (b.textContent || '').trim(), isBase = false;
    for (var k in BASE) if (t.indexOf(BASE[k]) === 0) isBase = true;
    if (!isBase) return;                                          // 生成中…等狀態不動
    var c = cost();
    var want = c > 0 ? BASE[lang()] + ' · ' + fmt(c) : BASE[lang()];
    if (t !== want) { b.setAttribute('data-i18n-skip', ''); b.textContent = want; }
  }
  setInterval(tick, 600);

  console.log('[kol-cost-label] 💰 v' + VERSION + ' 拍片按鈕顯示扣點');
})();
