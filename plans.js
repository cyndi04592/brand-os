/* ═══════════════════════════════════════════════════════════════
 *  Brand OS · 方案資料 + 卡片渲染(共用)
 *  v1 · 2026-06
 *  訂閱選單(index.html)與 入駐書(onboard.html)共用同一份卡片細項。
 *  本檔自帶 scoped style(.bos-plans),include 即可,不依賴外部 CSS。
 *
 *  公開 API:
 *    BRANDOS_PLANS                 方案資料(small / ent 兩組)= 單一真實來源
 *    BRANDOS_PLAN_MAX              產能條基準(旗艦圖量)
 *    findBrandosPlan(key)          跨組查單一方案
 *    ensureBrandosPlanStyle()      注入 scoped 樣式(冪等)
 *    renderBrandosHeroStat()       15× / 零 / 24h 數據列
 *    renderBrandosCore()           技術內核硬核名詞 band
 *    renderBrandosPlanCards(group, cycle, opts)  卡片網格 HTML
 *      opts.selFn       點卡呼叫的全域函式名(預設 'buyPlan')
 *      opts.selectedKey 高亮已選方案(入駐書用)
 *      opts.ctaLabel    function(plan)->字串,自訂按鈕文字
 *
 *  ⚠️ 方案 key(entry/growth/pro/ent/flag)對齊 GAS SUB_PLANS,不可改。
 * ═══════════════════════════════════════════════════════════════ */

const BRANDOS_PLAN_MAX = 2083; // 旗艦每月圖量,作為產能條 100%

const BRANDOS_PLANS = {
  small: [
    { key:'entry',  name:'入門', who:'小品牌 · 商品起步', rep:'一組 8 人外拍製作團隊',
      grade:'標準雜誌級', comp:'標準運算佇列', bits:70000,  price:35000, promo:30000,
      imgs:290,  vids:72,  kol:'1 隻日更 / 3 隻週更 / 12 隻月更' },
    { key:'growth', name:'成長', who:'穩定出圖的品牌', rep:'一個 15 人內容部',
      grade:'雜誌級 + 進階修圖', comp:'優先運算佇列', bits:125000, price:50000, promo:0,
      imgs:416,  vids:104, kol:'2 隻日更 / 5 隻週更 / 18 隻月更' },
    { key:'pro',    name:'專業', who:'高頻投放 · 多商品線', rep:'一間 25 人製作公司',
      grade:'高階雜誌級 + 商品保真', comp:'高速運算佇列', bits:185000, price:80000, promo:0,
      imgs:666,  vids:166, kol:'3 隻日更 / 8 隻週更 / 30 隻月更', hot:true },
  ],
  ent: [
    { key:'ent',  name:'企業', who:'多品牌 · 連鎖', rep:'一個 50 人行銷中心',
      grade:'頂級算圖 + 多代理並行', comp:'企業級運算', bits:300000, price:150000, promo:0,
      imgs:1250, vids:312, kol:'6 隻日更 / 15 隻週更 / 60 隻月更' },
    { key:'flag', name:'旗艦', who:'國際品牌 · MCN', rep:'一個 100+ 人行銷集團',
      grade:'最高級 + 地端混合運算', comp:'極速專屬佇列', bits:500000, price:250000, promo:0,
      imgs:2083, vids:520, kol:'10 隻日更 / 26 隻週更 / 100 隻月更', top:true },
    { key:'custom', custom:true },
  ]
};

function findBrandosPlan(key) {
  for (const g of Object.keys(BRANDOS_PLANS)) {
    const f = BRANDOS_PLANS[g].find(p => p.key === key);
    if (f) return f;
  }
  return null;
}

function ensureBrandosPlanStyle() {
  if (document.getElementById('bos-plan-style')) return;
  const css = `
.bos-plans{ --bp-purple:#7c6cff; --bp-pink:#ff7ac3; --bp-gold:#ffce6b; --bp-amber:#ff9d4d;
  --bp-line:rgba(255,255,255,.08); --bp-t2:rgba(255,255,255,.62); --bp-t3:rgba(255,255,255,.4);
  font-family:'Noto Sans TC',sans-serif; }
.bos-plans .num{font-variant-numeric:tabular-nums;}
.bos-core{max-width:760px;margin:0 auto 22px;background:linear-gradient(180deg,rgba(124,108,255,.06),rgba(255,122,195,.03));
  border:1px solid rgba(124,108,255,.2);border-radius:16px;padding:18px 22px;}
.bos-core .h{text-align:center;font-size:13px;font-weight:900;color:#d4ccff;letter-spacing:.3px;line-height:1.5;}
.bos-core .s{text-align:center;font-size:11px;color:var(--bp-t3);margin:4px 0 14px;}
.bos-core .terms{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;}
.bos-core .term{font-size:12.5px;font-weight:700;color:var(--bp-t2);padding:6px 13px;border:1px solid var(--bp-line);border-radius:8px;background:rgba(255,255,255,.02);cursor:pointer;transition:border-color .16s,color .16s,background .16s;}
.bos-core .term:hover{border-color:rgba(124,108,255,.5);color:#fff;}
.bos-core .term.on{border-color:rgba(124,108,255,.85);background:linear-gradient(135deg,rgba(124,108,255,.24),rgba(255,122,195,.16));color:#fff;}
.bos-termdesc{max-height:0;overflow:hidden;opacity:0;transition:max-height .24s,opacity .24s,margin .24s,padding .24s;
  font-size:12.5px;color:#ded9ff;line-height:1.65;text-align:center;margin-top:0;border-radius:10px;}
.bos-termdesc.show{max-height:140px;opacity:1;margin-top:14px;padding:11px 16px;border:1px dashed rgba(124,108,255,.32);background:rgba(124,108,255,.05);}
.bos-hstat{display:flex;justify-content:center;gap:30px;margin-bottom:20px;flex-wrap:wrap;}
.bos-hstat .b{text-align:center;}
.bos-hstat .v{font-size:26px;font-weight:700;line-height:1;
  background:linear-gradient(120deg,var(--bp-purple),var(--bp-pink));-webkit-background-clip:text;background-clip:text;color:transparent;}
.bos-hstat .l{font-size:11px;color:var(--bp-t3);margin-top:5px;letter-spacing:.3px;}
.bos-toggles{display:flex;flex-direction:column;align-items:center;gap:10px;margin-bottom:22px;}
.bos-seg{display:inline-flex;background:rgba(255,255,255,.05);border:1px solid var(--bp-line);border-radius:999px;padding:4px;}
.bos-seg button{font-family:inherit;border:none;cursor:pointer;border-radius:999px;padding:8px 22px;font-size:13px;font-weight:700;color:var(--bp-t2);background:transparent;transition:.18s;}
.bos-seg.grp button.on{background:linear-gradient(135deg,var(--bp-purple),var(--bp-pink));color:#fff;}
.bos-seg.cyc button.on{background:linear-gradient(135deg,var(--bp-amber),var(--bp-gold));color:#13131c;}
.bos-seg .save{font-size:10px;opacity:.85;}
.bos-grid{display:grid;gap:14px;grid-template-columns:repeat(3,1fr);align-items:stretch;}
@media(max-width:720px){.bos-grid{grid-template-columns:1fr;}}
.bos-card{position:relative;display:flex;flex-direction:column;background:#16161f;border:1.5px solid var(--bp-line);
  border-radius:16px;padding:22px 18px;transition:transform .18s,border-color .2s;}
.bos-card:hover{transform:translateY(-4px);border-color:rgba(255,255,255,.18);}
.bos-card.hot{border-color:rgba(124,108,255,.55);box-shadow:0 0 0 1px rgba(124,108,255,.25),0 18px 44px -20px rgba(124,108,255,.5);}
.bos-card.top{border-color:rgba(255,206,107,.5);box-shadow:0 0 0 1px rgba(255,206,107,.22),0 18px 44px -20px rgba(255,157,77,.45);}
.bos-card.sel{border-color:#7CFFB2;box-shadow:0 0 0 1px rgba(124,255,178,.45);}
.bos-badge{position:absolute;top:-11px;left:50%;transform:translateX(-50%);white-space:nowrap;font-size:11px;font-weight:900;padding:3px 13px;border-radius:999px;color:#13131c;letter-spacing:.3px;}
.bos-badge.hot{background:linear-gradient(135deg,var(--bp-purple),var(--bp-pink));color:#fff;}
.bos-badge.top{background:linear-gradient(135deg,var(--bp-amber),var(--bp-gold));}
.bos-who{font-size:11.5px;color:var(--bp-gold);font-weight:700;letter-spacing:.2px;}
.bos-pname{font-size:20px;font-weight:900;margin:3px 0 14px;color:#fff;}
.bos-replbl{font-size:11px;color:var(--bp-t3);letter-spacing:.5px;font-weight:700;}
.bos-rep{font-size:19px;font-weight:900;line-height:1.25;margin:5px 0 2px;
  background:linear-gradient(120deg,var(--bp-purple),var(--bp-pink));-webkit-background-clip:text;background-clip:text;color:transparent;}
.bos-card.top .bos-rep{background:linear-gradient(120deg,var(--bp-amber),var(--bp-gold));-webkit-background-clip:text;background-clip:text;}
.bos-bar{height:7px;border-radius:999px;background:rgba(255,255,255,.08);overflow:hidden;margin:12px 0;}
.bos-bar>i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,var(--bp-purple),var(--bp-pink));}
.bos-card.top .bos-bar>i{background:linear-gradient(90deg,var(--bp-amber),var(--bp-gold));}
.bos-spec{font-size:12.5px;color:var(--bp-t2);line-height:1.5;}
.bos-spec .r{display:flex;gap:8px;margin-top:7px;}
.bos-spec .k{color:var(--bp-t3);flex-shrink:0;width:58px;}
.bos-spec .vv{color:#fff;}
.bos-spec .vv.grade{color:var(--bp-gold);font-weight:700;}
.bos-meta{margin-top:auto;padding-top:14px;border-top:1px dashed var(--bp-line);}
.bos-mrow{display:flex;justify-content:space-between;align-items:baseline;font-size:13px;color:var(--bp-t2);margin:10px 0 6px;}
.bos-mrow b{color:#fff;font-weight:700;}
.bos-price{display:flex;align-items:baseline;gap:6px;}
.bos-price .amt{font-size:24px;font-weight:900;color:#fff;}
.bos-price .per{font-size:12px;color:var(--bp-t3);}
.bos-promo{font-size:12px;color:#ff8cae;text-decoration:line-through;margin-right:2px;}
.bos-yhint{font-size:11px;color:var(--bp-gold);margin-top:3px;}
.bos-cta{margin-top:15px;text-align:center;font-size:14px;font-weight:900;color:#fff;border-radius:11px;padding:11px;cursor:pointer;border:none;font-family:inherit;
  background:linear-gradient(135deg,var(--bp-amber),#ff7a59);transition:filter .2s;width:100%;}
.bos-card.hot .bos-cta{background:linear-gradient(135deg,var(--bp-purple),var(--bp-pink));}
.bos-cta:hover{filter:brightness(1.08);}
.bos-cta.ghost{background:transparent;border:1px solid var(--bp-line);color:var(--bp-t2);}
.bos-custom{justify-content:center;align-items:center;text-align:center;border-style:dashed;
  background:linear-gradient(180deg,rgba(255,255,255,.03),rgba(255,255,255,.01));}
.bos-custom .big{font-size:19px;font-weight:900;margin:8px 0;color:#fff;}
.bos-custom p{font-size:12px;color:var(--bp-t2);line-height:1.7;margin-bottom:16px;}
.bos-foot{text-align:center;color:var(--bp-t3);font-size:11px;margin-top:20px;line-height:1.85;}
/* 專利認證鋼印(金色官章) */
.bos-patent{display:flex;justify-content:center;margin:0 auto 22px;}
.bos-seal{display:inline-flex;align-items:center;gap:15px;padding:13px 24px 13px 16px;border-radius:15px;
  background:linear-gradient(135deg,rgba(255,206,107,.13),rgba(255,157,77,.045));
  border:1px solid rgba(255,206,107,.5);
  box-shadow:0 0 0 1px rgba(255,206,107,.1) inset,0 1px 0 rgba(255,255,255,.07) inset,0 12px 34px -16px rgba(255,157,77,.6);}
.bos-seal .emblem{width:52px;height:52px;flex-shrink:0;filter:drop-shadow(0 2px 5px rgba(0,0,0,.45));}
.bos-seal .tx{display:flex;flex-direction:column;line-height:1.18;text-align:left;}
.bos-seal .t1{font-size:14.5px;font-weight:900;letter-spacing:2.5px;
  background:linear-gradient(135deg,#fff0c9,#ffce6b,#ff9d4d);-webkit-background-clip:text;background-clip:text;color:transparent;}
.bos-seal .t2{font-size:10.5px;font-weight:700;color:rgba(255,255,255,.58);letter-spacing:1.2px;margin-top:4px;}
.bos-seal .t2 b{color:#ffd98a;font-weight:900;letter-spacing:1.8px;}
/* 零門檻金句 */
.bos-tagline{text-align:center;font-size:13px;font-weight:700;color:#e8e3ff;margin:-4px auto 22px;letter-spacing:.3px;line-height:1.6;}
.bos-tagline b{color:var(--bp-gold);font-weight:900;}
`;
  const el = document.createElement('style');
  el.id = 'bos-plan-style';
  el.textContent = css;
  document.head.appendChild(el);
}

function renderBrandosHeroStat() {
  return '<div class="bos-hstat">'
    + '<div class="b"><div class="v num">15×</div><div class="l">人力產能放大</div></div>'
    + '<div class="b"><div class="v">零</div><div class="l">提示詞 · 零技術門檻</div></div>'
    + '<div class="b"><div class="v num">24h</div><div class="l">不停工的製作團隊</div></div>'
    + '</div>';
}

function renderBrandosCore() {
  const terms = [
    ['品牌靈魂核', '全產線唯一語意中樞,圖文影同源同調,品牌不走鐘'],
    ['AI 創意總監編制', '攝影·燈光·場景·造型·文案·剪輯·數字人·投放,一聲令下整組到位'],
    ['攝影指導級鏡頭語言', '依主體自動選鏡:35mm 敘事 · 50mm 寫真 · 85mm f/1.4 人像 · 望遠/微距特寫'],
    ['A-Roll／B-Roll 雙線運鏡', '主述鏡 + 空鏡氛圍,影片自帶導演分鏡'],
    ['電影級三點布光', '主光塑形 · 輔光柔影 · 輪廓光勾邊,黃金構圖 + 情境色溫(3000–6000K)'],
    ['日韓秀場級彩妝參數庫', '頂尖彩妝師調校:半霧光底妝 · 骨相修容 · 偏光打亮,妝感直逼伸展台'],
    ['七階數字人鑄造引擎', '骨相 · 膚質 · 毛流 · 神態,七道工藝煉出會說話的品牌代言人'],
    ['主體保真鎖核', '商品與臉部 DNA 級鎖定,換景千變、主體不變形,杜絕 AI 錯置'],
    ['形體一致性引擎', '虛擬試衣零變形,換衣不換人,身形姿態神態完整保留'],
    ['物理級質感渲染', '毛孔 · 織紋 · 景深都真,徹底杜絕 AI 塑膠油光'],
    ['模型中立矩陣', '六大頂尖 AI 各司其職,不綁單一引擎、不因任何模型改版而失效'],
    ['品牌自學習引擎', '記住每一次成效、自動演化新方向,像越用越懂你品牌的 AI 操盤手'],
    ['億級投放實戰診斷', '操盤數億廣告金的 META 代理商實戰判讀,把冷數據翻成老闆一看就懂的決策'],
  ];
  const chips = terms.map(t =>
    '<span class="term" data-desc="' + t[1].replace(/"/g, '&quot;') + '" onclick="bosShowTerm(this)">' + t[0] + '</span>'
  ).join('');
  return '<div class="bos-core">'
    + '<div class="h">每一張圖、每一支片,背後是一整組 AI 創意團隊在運轉</div>'
    + '<div class="s">不是單一工具 —— 是一座以品牌靈魂核驅動的多代理人創意中樞 · 點任一項看說明</div>'
    + '<div class="terms">' + chips + '</div>'
    + '<div class="bos-termdesc" id="bosTermDesc"></div>'
    + '</div>';
}

function bosShowTerm(el) {
  const box = document.getElementById('bosTermDesc');
  if (!box) return;
  const wrap = el.parentElement;
  const wasOn = el.classList.contains('on');
  wrap.querySelectorAll('.term.on').forEach(x => x.classList.remove('on'));
  if (wasOn) { box.classList.remove('show'); box.textContent = ''; return; } // 再點同一顆 = 收起
  el.classList.add('on');
  box.textContent = el.getAttribute('data-desc');
  box.classList.add('show');
}

function renderBrandosPatent() {
  const svg =
    '<svg class="emblem" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">'
    + '<defs><linearGradient id="bosGold" x1="0" y1="0" x2="1" y2="1">'
    +   '<stop offset="0" stop-color="#fff0c9"/><stop offset=".5" stop-color="#ffce6b"/><stop offset="1" stop-color="#ff9d4d"/>'
    + '</linearGradient></defs>'
    + '<g fill="none" stroke="url(#bosGold)" stroke-linecap="round">'
    // 月桂左
    +   '<g transform="translate(15,49)"><path d="M0 0 C-6 -8 -6 -20 1 -28" stroke-width="1.6"/>'
    +     '<g fill="url(#bosGold)" stroke="none">'
    +       '<path d="M-1 -4 c-4 -1 -6 -3 -6 -6 c3 0 5 2 6 6z"/>'
    +       '<path d="M-2 -12 c-4 -1 -6 -3 -6 -6 c3 0 5 2 6 6z"/>'
    +       '<path d="M-1 -20 c-4 -1 -5 -3 -5 -6 c3 0 4 2 5 6z"/>'
    +     '</g></g>'
    // 月桂右(鏡像)
    +   '<g transform="translate(49,49) scale(-1,1)"><path d="M0 0 C-6 -8 -6 -20 1 -28" stroke-width="1.6"/>'
    +     '<g fill="url(#bosGold)" stroke="none">'
    +       '<path d="M-1 -4 c-4 -1 -6 -3 -6 -6 c3 0 5 2 6 6z"/>'
    +       '<path d="M-2 -12 c-4 -1 -6 -3 -6 -6 c3 0 5 2 6 6z"/>'
    +       '<path d="M-1 -20 c-4 -1 -5 -3 -5 -6 c3 0 4 2 5 6z"/>'
    +     '</g></g>'
    // 外環 + 地球
    +   '<circle cx="32" cy="31" r="15" stroke-width="2.2"/>'
    +   '<circle cx="32" cy="31" r="10.5" stroke-width="1.2"/>'
    +   '<ellipse cx="32" cy="31" rx="4.4" ry="10.5" stroke-width="1.1"/>'
    +   '<line x1="21.5" y1="31" x2="42.5" y2="31" stroke-width="1.1"/>'
    +   '<path d="M24 24.5 H40 M24 37.5 H40" stroke-width=".9" stroke-opacity=".65"/>'
    + '</g>'
    // 頂部星
    + '<path d="M32 6 l1.7 3.5 3.8.5 -2.8 2.6 .7 3.8 -3.4 -1.9 -3.4 1.9 .7 -3.8 -2.8 -2.6 3.8 -.5z" fill="url(#bosGold)"/>'
    + '</svg>';
  return '<div class="bos-patent"><div class="bos-seal">'
    + svg
    + '<div class="tx"><span class="t1">多國專利技術</span>'
    + '<span class="t2">WIPO · 台灣 · 中國 · <b>PATENT PENDING</b></span></div>'
    + '</div></div>';
}

function renderBrandosTagline() {
  return '<div class="bos-tagline">連菜市場的阿公阿嬤都會用 · 路人點一點就完成 · 提示詞?<b>完全不用</b></div>';
}

function renderBrandosPlanCards(group, cycle, opts) {
  opts = opts || {};
  const selFn = opts.selFn || 'buyPlan';
  const selectedKey = opts.selectedKey || '';
  const ctaLabel = opts.ctaLabel || null;
  const yr = (cycle === 'year');
  const fmt = n => Number(n).toLocaleString();
  let html = '<div class="bos-grid">';
  (BRANDOS_PLANS[group] || []).forEach(p => {
    if (p.custom) {
      html += '<div class="bos-card bos-custom">'
        + '<div class="bos-who">更大規模 / 專屬需求</div>'
        + '<div class="big">客製方案</div>'
        + '<p>多品牌中控、超量產能、地端混合運算與專屬導入。<br>依規模一對一報價。</p>'
        + '<button class="bos-cta ghost" onclick="' + selFn + '(\'custom\')">聯絡我們</button>'
        + '</div>';
      return;
    }
    const hot = !!p.hot, top = !!p.top, sel = (selectedKey === p.key);
    const monthPrice = p.promo > 0 ? p.promo : p.price;
    const show = yr ? p.price * 12 : monthPrice;
    const pct = Math.max(8, Math.round(p.imgs / BRANDOS_PLAN_MAX * 100));
    const badge = hot ? '<div class="bos-badge hot">最多人選</div>'
                : top ? '<div class="bos-badge top">頂規</div>' : '';
    const cls = (hot ? ' hot' : top ? ' top' : '') + (sel ? ' sel' : '');
    const promo = (!yr && p.promo > 0) ? '<span class="bos-promo num">NT$' + fmt(p.price) + '</span>' : '';
    const yhint = yr ? '<div class="bos-yhint">付 12 個月 · 開通 13 個月</div>' : '';
    const cta = ctaLabel ? ctaLabel(p) : ('選 ' + p.name + ' 方案');
    html += '<div class="bos-card' + cls + '">'
      + badge
      + '<div class="bos-who">' + p.who + '</div>'
      + '<div class="bos-pname">' + p.name + '</div>'
      + '<div class="bos-replbl">這個方案 ≈</div>'
      + '<div class="bos-rep">取代 ' + p.rep + '</div>'
      + '<div class="bos-bar"><i style="width:' + pct + '%"></i></div>'
      + '<div class="bos-spec">'
        + '<div class="r"><span class="k">算圖等級</span><span class="vv grade">' + p.grade + '</span></div>'
        + '<div class="r"><span class="k">運算檔次</span><span class="vv">' + p.comp + '</span></div>'
        // 🔢 2026-08-18:分隔號從「·」改成「或」。
        //   原本「290 張圖 · 72 支片」中間一個點,看起來像「兩個都給」,
        //   但這兩個數字其實是各自單獨算的(配點全拿去生圖 / 全拿去生片),
        //   加起來會超出配點。改成「或」才是真的,數字一個都不用動。
        //   並標明計價基準 —— 影片點數依秒數計,不講清楚客戶算不出來。
        + '<div class="r"><span class="k">每月產能</span><span class="vv">約 <b class="num">' + fmt(p.imgs) + '</b> 張圖 <span style="opacity:.5">或</span> <b class="num">' + fmt(p.vids) + '</b> 支片<div style="font-size:10.5px;opacity:.45;margin-top:3px;font-weight:400;letter-spacing:.3px">720P · 15 秒短影音計</div></span></div>'
        + '<div class="r"><span class="k">KOL數字人</span><span class="vv">' + p.kol + '</span></div>'
      + '</div>'
      + '<div class="bos-meta">'
        + '<div class="bos-mrow"><span>每月點數</span><b class="num">' + fmt(p.bits) + ' 點</b></div>'
        + '<div class="bos-price">' + promo + '<span class="amt num">NT$' + fmt(show) + '</span><span class="per num"> / ' + (yr ? '年' : '月') + '</span></div>'
        + yhint
        + '<button class="bos-cta" onclick="' + selFn + '(\'' + p.key + '\')">' + cta + '</button>'
      + '</div>'
      + '</div>';
  });
  html += '</div>';
  return html;
}
