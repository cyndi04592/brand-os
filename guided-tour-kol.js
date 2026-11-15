// ═══════════════════════════════════════════════════════════════
//  🧭 guided-tour-kol.js v1.1(2026-11-15)KOL 數字人工作室 新手導覽
//  需要先載入 guided-tour.js(提供 BosTour:黃框 + 白卡 + 紅字建議/注意)
//
//  兩段導覽:
//   · kol1  建立 KOL 角色(STEP 1):品牌 → 形象庫 → 人設 → 參考照 → 用這位角色拍片
//   · kol2  拍電影鏡頭(STEP 2):主角 → 影片風格 → AI 分鏡 → 商品照 → 呈現方式 → 場景 → 規格 → 生成
//  第一次進到那一頁自動跑一次;左下角「? 教學」可以重看。
//  只放導覽,不碰 kol.html 任何功能(kol.html 已超過 1,500 行,不往裡面塞)。
// ═══════════════════════════════════════════════════════════════
(function () {
  'use strict';
  if (window.__bosTourKol) return;
  window.__bosTourKol = true;
  var VERSION = '1.1';

  function TIP(t) { return '<div class="bt-r"><i>建議</i>' + t + '</div>'; }
  function PIT(t) { return '<div class="bt-r"><i>注意</i>' + t + '</div>'; }

  function shown(id) {
    var e = document.getElementById(id); if (!e) return false;
    var r = e.getBoundingClientRect();
    return r.width > 4 && r.height > 4 && window.getComputedStyle(e).display !== 'none';
  }
  function ready() { return !!(window.BosTour && window.BosTour.register); }

  function registerAll() {
    // ── STEP 1:建立 KOL 角色 ──────────────────────────────────
    BosTour.register('kol1', [
      { t: '#brand-switcher', title: '先選品牌',
        body: '這裡選<b>要拍哪個品牌</b>,下面會自動載入這個品牌的 KOL 和素材。' +
          PIT('選錯品牌,角色和商品照都會是別家的。') },
      { t: '#rs-roster', title: '選一位 KOL 當主角',
        body: '這是品牌的 <b>KOL 形象庫</b>,點一位就選好了,選好會繼續教你下一步。<br>沒有合適的人選,按<b>「＋ 建新角色」</b>讓 AI 做一位新面孔。' +
          TIP('「＋ 使用自己建立」是用你自己的照片,當品牌代言人最有說服力。') }
    ]);

    // ── 點選一位 KOL 之後(人設、參考照、拍片按鈕這時才出現)──────
    BosTour.register('kol1b', [
      { t: '#rs-persona-panel', title: '人設:決定他怎麼講話',
        body: '年紀、住哪、做什麼工作、在意什麼。<br>AI 寫台詞時會照這個人設說話。' +
          TIP('人設寫得越具體,台詞越像真人,不像在念廣告。要改按下面「編輯人設」。') },
      { t: '#look-picker', title: '多角度參考照',
        body: '正臉、側臉這幾張是<b>拍影片時自動用的參考照</b>,讓每一個鏡頭都是同一張臉。' +
          TIP('系統會自己挑,不用動它。') },
      { t: '#rs-actionbar', title: '選好就按「用這位角色拍片 →」',
        body: '按右邊那顆,就會進到 <b>STEP 2 拍電影鏡頭</b>。' }
    ]);

    // ── STEP 2:拍電影鏡頭 ─────────────────────────────────────
    BosTour.register('kol2', [
      { t: '#kol-list-cine', title: '主角',
        body: '這支影片的<b>主角</b>,第一個選的就是他。' },
      { t: '#kolmode', title: '影片風格',
        body: '<b>寫實真人</b>:跟真的拍的一樣。<br><b>動畫</b>:選了才會展開動畫風格。' +
          TIP('第一次拍,先用「寫實真人」。') },
      { t: '#cine-sbp-entry', title: '第一步:用 AI 分鏡寫腳本',
        body: '把想講的內容丟進去,AI 會寫成<b>有台詞、時間對得上</b>的腳本,也可以自己在分鏡卡上改。' +
          PIT('自己硬塞很長的台詞,影片時間不夠會被切掉。用 AI 分鏡,系統會自動鎖好時長。') +
          TIP('有字唸錯(例如「抽屜」),換個說法或用別的詞就好。') },
      { t: ['#ref-panel-drive', '#ref-tab-drive'], title: '選商品照',
        body: '從素材庫點<b>這支要推的商品照</b>。' +
          TIP('外包裝和內容物都放,AI 才知道打開長什麼樣子。') +
          PIT('商品尺寸要在後台填對,填錯 AI 就會把商品畫太大或太小。') },
      { t: '#product-mode-s2', title: '商品呈現方式',
        body: '告訴 AI 你賣的是<b>「東西」還是「體驗」</b>:手拿小物、包裝零食、盛盤料理、穿戴…' +
          PIT('選錯,拿法和擺法就會錯(例如把衣服拿在手上晃)。不確定就選「自動」。') },
      { t: ['#scene-grid-cine', '#scn-lib-s2'], title: '場景:在哪裡拍',
        body: '點一個<b>場景</b>,例如客廳、門市、教室。' +
          TIP('上傳自己門市、店面的實景照當場景,影片會直接用真的背景,最有說服力。') },
      { t: '#cine-lock-zone', title: '解析度、秒數、比例',
        body: 'IG / 抖音用 <b>9:16</b>;YouTube 用 16:9。' +
          PIT('「生成聲音」關掉,影片完全沒聲音,連台詞都不會唸!') +
          PIT('解析度越高、秒數越長,等越久、扣的點數也越多。') },
      { t: '#create-seedance-btn', title: '最後:按這顆開始拍',
        body: '大約 <b>5–10 分鐘</b>出片,可以先去做別的事。' +
          PIT('一按就扣點,按之前先往上看一遍:主角、商品照、場景、聲音都對了。') }
    ]);
  }

  // ── 左下角「? 教學」──────────────────────────────────────────
  function pill() {
    var p = document.getElementById('bt-tour-pill-kol');
    if (!p) {
      p = document.createElement('button');
      p.id = 'bt-tour-pill-kol'; p.type = 'button'; p.setAttribute('data-i18n-skip', '');
      p.textContent = '? 教學';
      p.style.cssText = 'position:fixed;z-index:99997;left:calc(12px + env(safe-area-inset-left,0px));' +
        'border:1px solid rgba(255,255,255,.18);background:rgba(20,20,24,.85);color:#f5c542;' +
        'font:800 13px/1 "Noto Sans TC",system-ui,sans-serif;border-radius:999px;padding:9px 13px;cursor:pointer';
      p.onclick = function () { BosTour.start(shown('main-layout-cinematic') ? 'kol2' : (shown('rs-actionbar') ? 'kol1b' : 'kol1'), true); };
      document.body.appendChild(p);
    }
    //  底下那條「已選定 · 用這位角色拍片」出現時,往上讓開
    var ab = document.getElementById('rs-actionbar');
    var abH = (ab && shown('rs-actionbar')) ? ab.getBoundingClientRect().height : 0;
    p.style.bottom = 'calc(' + (54 + abH) + 'px + env(safe-area-inset-bottom,0px))';
    p.style.display = shown('main-layout-cinematic') || shown('main-layout-talking') ? '' : 'none';
  }

  // ── 什麼時候自動跑 ───────────────────────────────────────────
  var registered = false, tried = {};
  function tryStart(name) {
    if (tried[name]) return;
    var c = document.querySelector('.bt-card');
    if (c && c.style.display !== 'none') return;          // 別的導覽還在跑,等它跑完
    tried[name] = true;
    setTimeout(function () { BosTour.start(name, false); }, 1200);
  }
  setInterval(function () {
    if (!ready()) return;
    if (!registered) { registerAll(); registered = true; }
    pill();
    var roster = document.getElementById('rs-roster');
    if (shown('main-layout-cinematic')) tryStart('kol2');
    else if (shown('main-layout-talking') && roster && roster.children.length) {
      if (shown('rs-actionbar')) tryStart('kol1b'); else tryStart('kol1');
    }
  }, 800);

  console.log('[BosTour] 🧭 KOL 導覽 v' + VERSION + ' 就緒(左下「? 教學」重看)');
})();
