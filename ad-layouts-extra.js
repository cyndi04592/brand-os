// ═══════════════════════════════════════════════════════════════════════
//  ad-layouts-extra.js · v1.1 (2026-11-12)
//  v1.1 RA 11-12「前後對比、多格、條列這三種排版圖,不如刪除」→ 從 ① 選單收起(程式仍認得,要恢復把 key 從 HIDE 拿掉)
//       以前存過這三種的選擇也一併清掉,不會在畫面空白時偷偷生出舊排版圖
//  廣告圖「新增照片版型」—— 參考韓國醫美 / 日本旅遊 / IG 大品牌常見拍法補進 ① 版型選單
//
//  為什麼另開一個檔:admaker.js 已約 4,880 行(紅線 1,500),新功能一律不塞進去。
//  做法:只往 admaker.js 的兩個全域加東西,不改它任何一行:
//    · LAYOUT_TEMPLATES   → 每個新版型的名字 / 說明 / 一段最簡短的備用構圖
//    · LAYOUT_BY_PRODTYPE → 把新版型放進各行業的分組
//  真正的拍攝提示詞在 photoroom-proxy Worker(v11.42 起)的 SVC 設定裡;
//  這裡的 composition 只在 Console 關掉精簡引擎(window.AD_LEAN=false)時才會用到。
//
//  載入順序:index.html 在 ad-logotap.js 之後、adlean.js 之前。
//  要收起某個版型:把它的 key 從下面 GROUPS 拿掉即可(程式仍認得)。
// ═══════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  if (typeof LAYOUT_TEMPLATES === 'undefined' || typeof LAYOUT_BY_PRODTYPE === 'undefined') {
    console.warn('[版型+] 找不到 admaker.js 的版型表,略過');
    return;
  }
  if (window._adLayoutsExtra) return;   // 重複載入保護
  window._adLayoutsExtra = '1.1';

  var NO_TEXT = '\n- Photograph only; no lettering is added to the image (the customer types any text later).';
  function T(label, desc, comp) { return { label: label, desc: desc, composition: comp + NO_TEXT }; }

  // ── 版型名字與說明(客人在 ① 看到的字)────────────────────────────
  Object.assign(LAYOUT_TEMPLATES, {
    // 💅 美業
    bt_hand_result: T('手部成果型', '指尖、手勢帶出成果(美甲、手部保養)', 'A close beauty shot of the hands showing the finished work, an elegant natural gesture, soft daylight.'),
    bt_profile:     T('側臉輪廓型', '側臉看眉型、睫毛翹度最清楚', 'A close side profile from brow to chin, the finished brows and lashes reading clearly, soft daylight.'),
    bt_studio:      T('工作室氛圍', '上傳工作室照片 → 拍出店裡的質感', 'An architectural photograph of the same studio, kept exactly as it is, soft daylight, tidy and calm.'),
    // 🏥 醫美(參考韓國)
    med_hands:  T('醫師手部型', '醫師的手輕觸肌膚,不露臉也有信任感', 'The doctor\'s hand gently checking the client\'s skin in a calm clinic room, faces mostly out of frame.'),
    med_device: T('儀器細節型', '上傳儀器照片 → 拍出高級感特寫', 'The same treatment device kept exactly as it is, photographed close in a calm clinic room.'),
    med_room:   T('療程室型', '上傳療程室照片 → 韓系乾淨質感', 'An architectural photograph of the same treatment room, kept exactly as it is, soft daylight.'),
    // 🧘 課程
    co_tools: T('器材靜物型', '頌缽、瑜珈墊、蠟燭 —— 上課的器材', 'The same class tools kept exactly as they are, a calm still life in the studio, soft daylight.'),
    co_after: T('課後片刻型', '課後喝茶、聊天、放鬆的片刻', 'A quiet moment after class: students resting with tea in the studio, soft daylight.'),
    // 🔮 命理
    my_tea:   T('茶席與香型', '茶具、香、桌面的安靜氛圍', 'The same tea set and incense kept exactly as they are, a quiet still life on the reading table.'),
    my_after: T('諮詢後片刻', '諮詢完放鬆、安心的神情', 'A calm moment after a reading: the client relaxed with a cup of tea, the room softly lit.'),
    // ✈️ 旅遊(參考日本)
    tr_breakfast: T('住宿早餐型', '旅宿的早餐 / 晚餐,日系旅宿最愛拍', 'The same lodging\'s breakfast laid out by the window, morning light, the place kept real.'),
    tr_back:      T('旅人背影型', '旅人走進風景的背影', 'A traveller walking away into the same real place, soft daylight.'),
    tr_market:    T('在地市集型', '市集、小店、街邊攤的在地感', 'The same real local market or street stalls, lively but calm, natural light.'),
    // 🏭 機台
    eq_operator: T('工程師操作型', '工程師操作機台,看得出專業', 'An engineer operating the same machine, kept exactly as it is, in a clean factory.'),
    eq_qc:       T('品管檢測型', '量測、檢查細節,強調品質', 'A close quality-check moment on the same machine, kept exactly as it is.'),
    // 💻 螢幕畫面
    sc_in_use: T('有人在用型', '有人正在用你的畫面,生活感', 'A person using the same screen content on a laptop, the screen unchanged and readable.'),
    sc_multi:  T('多裝置型', '電腦 + 手機一起秀', 'The same screen content on a laptop with a phone beside it, both unchanged and readable.'),
    // ⚖️ 專業(參考國際 / 日本事務所)
    pr_meeting: T('客戶洽談型', '跟客戶討論中的自然瞬間', 'The same professional in a calm meeting with a client, faces natural, soft window light.'),
    pr_daily:   T('工作日常型', '看資料、寫字、走在辦公室', 'The same professional at work in their office, a natural unposed moment, soft window light.'),
    pr_object:  T('靈魂物件型', '鋼筆、印章、書本 —— 不露臉的質感照', 'A still life of the tools of this profession on a desk, soft window light.'),
  });

  // ── 放進各行業的分組 ─────────────────────────────────────────────
  //   [行業, 分組名(已存在就接在後面,沒有就新增一組), [新版型]]
  var GROUPS = [
    ['beauty',  '成果呈現',   ['bt_hand_result', 'bt_profile']],
    ['beauty',  '信任感',     ['bt_studio']],
    ['medical', '信任感',     ['med_hands', 'med_room']],
    ['medical', '療程細節',   ['med_device']],
    ['course',  '練習與環境', ['co_tools', 'co_after']],
    ['mystic',  '諮詢現場',   ['my_tea']],
    ['mystic',  '人與空間',   ['my_after']],
    ['travel',  '目的地',     ['tr_breakfast']],
    ['travel',  '旅途中',     ['tr_back', 'tr_market']],
    ['equip',   '實績與場域', ['eq_operator', 'eq_qc']],
    ['screen',  '裝置外框',   ['sc_multi']],
    ['screen',  '生活情境',   ['sc_in_use']],
    ['pro',     '人物',       ['pr_meeting', 'pr_daily']],
    ['pro',     '空間',       ['pr_object']],
  ];
  GROUPS.forEach(function (g) {
    var list = LAYOUT_BY_PRODTYPE[g[0]];
    if (!Array.isArray(list)) return;
    var grp = list.find(function (x) { return x.group === g[1]; });
    if (!grp) { grp = { group: g[1], keys: [] }; list.push(grp); }
    g[2].forEach(function (k) { if (LAYOUT_TEMPLATES[k] && grp.keys.indexOf(k) === -1) grp.keys.push(k); });
  });

  // ✂️ v1.1 收起三種排版圖(舊引擎、多格多字,質感達不到 MOZ 標準)
  var HIDE = ['before_after', 'grid_showcase', 'checklist_info'];
  Object.keys(LAYOUT_BY_PRODTYPE).forEach(function (pt) {
    var list = LAYOUT_BY_PRODTYPE[pt];
    if (!Array.isArray(list)) return;
    list.forEach(function (g) { if (g && Array.isArray(g.keys)) g.keys = g.keys.filter(function (k) { return HIDE.indexOf(k) === -1; }); });
  });
  //  以前選過 / 從紀錄還原成這三種 → 清成「還沒選」,客人重選一次(生成前的必選檢查會提醒)
  setInterval(function () {
    try {
      if (typeof SELECTED_LAYOUT !== 'undefined' && HIDE.indexOf(SELECTED_LAYOUT) !== -1) {
        SELECTED_LAYOUT = '';
        if (typeof _syncSteps === 'function') _syncSteps();
        console.log('[版型+] 這個版型已收起,請重選 ① 排版');
      }
    } catch (e) {}
  }, 800);

  // 選單若已畫過,讓它下次重畫(admaker 用 dataset.pt 記住畫過哪一類)
  var sel = document.getElementById('layoutSel');
  if (sel) delete sel.dataset.pt;

  console.log('[版型+] v1.1 已載入:新增 20 種照片版型 · 收起前後對比 / 多格展示 / 重點條列');
})();
