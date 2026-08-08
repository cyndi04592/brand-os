<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Brand OS · 訂閱方案</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preload" as="script" href="config.js"><!-- 🆕 提早並行下載,中間內容更快出現 -->
<link rel="preload" as="script" href="plans.js"><!-- 🆕 同上 -->
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700;900&family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet">
<style>
  :root{ --bg:#0e0e16; --ink:#fff; --t2:rgba(255,255,255,.62); --t3:rgba(255,255,255,.4);
         --purple:#7c6cff; --pink:#ff7ac3; --gold:#ffce6b; }
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Noto Sans TC',sans-serif;color:var(--ink);min-height:100vh;padding:52px 20px 90px;-webkit-font-smoothing:antialiased;
    background:radial-gradient(1200px 600px at 18% -10%,rgba(124,108,255,.10),transparent 60%),
               radial-gradient(1000px 500px at 100% 0%,rgba(255,122,195,.08),transparent 55%),var(--bg);}
  .wrap{max-width:1060px;margin:0 auto;}
  .topbar{max-width:1060px;margin:0 auto 30px;display:flex;justify-content:space-between;align-items:center;}
  .back{display:inline-flex;align-items:center;gap:6px;font-size:13px;color:var(--t2);text-decoration:none;
    padding:8px 15px;border:1px solid rgba(255,255,255,.1);border-radius:999px;transition:.16s;}
  .back:hover{color:#fff;border-color:rgba(255,255,255,.25);}
  .eyebrow{font-size:12px;letter-spacing:4px;color:var(--gold);font-weight:700;text-align:center;margin-bottom:16px;}
  h1{font-size:clamp(28px,4.4vw,46px);font-weight:900;text-align:center;line-height:1.22;letter-spacing:-.5px;}
  h1 .hl{background:linear-gradient(120deg,var(--purple),var(--pink));-webkit-background-clip:text;background-clip:text;color:transparent;}
  .sub{text-align:center;color:var(--t2);font-size:15px;margin-top:16px;line-height:1.8;}
  #planRoot{margin-top:34px;}
</style>
</head>
<body>
  <div class="topbar">
    <a class="back" href="index.html">← 回系統</a>
    <span style="font-size:12px;color:var(--t3);letter-spacing:2px;">BRAND OS</span>
  </div>

  <div class="wrap">
    <div class="eyebrow">BRAND OS · 訂閱方案</div>
    <h1>用一點點人力,<br>做出 <span class="hl">一整間公司的產能</span>。</h1>
    <p class="sub">全功能開好開滿、沒有閹割版。<br>你選的不是「能用哪些功能」,而是「這個月想把產能,放大成幾個人的團隊」。</p>
    <div id="planRoot"></div>
  </div>

<script src="loader.js"></script>
<script src="config.js"></script>
<script src="plans.js"></script>
<script>
  // ══ 整頁訂閱控制器(渲染重用 plans.js,購買流程自帶,不動 index 彈窗)══
  let _grp = 'small', _cyc = 'month';
  let _pendingPlan = '';

  function renderPage() {
    ensureBrandosPlanStyle();
    const g = _grp, yr = (_cyc === 'year');
    const grpToggle =
      '<div class="bos-seg grp">' +
        '<button class="' + (g === 'small' ? 'on' : '') + '" onclick="setGrp(\'small\')">小品牌</button>' +
        '<button class="' + (g === 'ent' ? 'on' : '') + '" onclick="setGrp(\'ent\')">企業 · 集團</button>' +
      '</div>';
    const cycToggle =
      '<div class="bos-seg cyc">' +
        '<button class="' + (!yr ? 'on' : '') + '" onclick="setCyc(\'month\')">月繳</button>' +
        '<button class="' + (yr ? 'on' : '') + '" onclick="setCyc(\'year\')">年繳 <span class="save">送1個月</span></button>' +
      '</div>';
    const note = '<div class="bos-foot">所有方案功能 100% 全開、沒有閹割;分級只在每月產能與算力檔次。<br>所有價格未稅,另計 5% 營業稅 · 點數每月自動配發、月底歸零回滿 · 加購補給包點數永久保留</div>';
    const legalEN = '<div style="text-align:center;font-size:11.5px;color:rgba(255,206,107,.62);letter-spacing:.5px;margin-top:12px;font-weight:600;">Proprietary patent-pending technology — filed under PCT (WIPO), Taiwan IPO &amp; CNIPA.</div>';
    const _ssoEmail = localStorage.getItem('bs_sso_email') || '';
    const accountLinks = _ssoEmail
      ? ''  // 已登入 → 不顯示「登入續約/申請帳號」,避免點了又繞回首頁的死圈
      : '<div style="text-align:center;margin-top:20px;font-size:12.5px;color:rgba(255,255,255,.55);line-height:2.1;">'
        + '已經有帳號? <a href="index.html" style="color:#ffce6b;font-weight:700;text-decoration:none;">點這裡登入續約</a>'
        + '<span style="color:rgba(255,255,255,.25);margin:0 8px;">·</span>'
        + '第一次來? <a href="onboard.html" style="color:#ffce6b;font-weight:700;text-decoration:none;">點這裡申請開通帳號 →</a>'
        + '</div>';
    const payBanner = _pendingPlan
      ? '<div style="background:linear-gradient(135deg,rgba(124,108,255,.18),rgba(255,122,195,.18));border:1px solid rgba(124,108,255,.45);border-radius:14px;padding:16px 20px;margin-bottom:20px;text-align:center;">'
        + '<div style="font-size:15px;font-weight:900;color:#fff;">✅ 您的品牌已通過審核!</div>'
        + '<div style="font-size:13px;color:rgba(255,255,255,.7);margin-top:5px;">下方已幫您選好當初申請的方案,完成付款即可開通系統。</div>'
        + '</div>'
      : '';
    document.getElementById('planRoot').innerHTML =
      '<div class="bos-plans">' +
        payBanner +
        renderBrandosHeroStat() +
        renderBrandosTagline() +
        renderBrandosCore() +
        '<div class="bos-toggles">' + grpToggle + cycToggle + '</div>' +
        renderBrandosPlanCards(g, _cyc, { selFn: 'buyPlan', selectedKey: _pendingPlan, ctaLabel: p => (_pendingPlan === p.key ? '💳 立即付款開通' : '選這個方案') }) +
        accountLinks +
        note +
        legalEN +
      '</div>';
  }
  function setGrp(x) { _grp = x; renderPage(); }
  function setCyc(x) { _cyc = x; renderPage(); }

  // ── 購買 ──
  function buyPlan(k) {
    const email = localStorage.getItem('bs_sso_email') || '';
    if (k === 'custom') {
      document.getElementById('planRoot').innerHTML =
        '<div style="text-align:center;max-width:460px;margin:0 auto;padding:30px 0;">' +
          '<div style="font-size:38px;">🤝</div>' +
          '<div style="font-size:20px;font-weight:900;color:#fff;margin-top:10px;">客製方案 · 一對一報價</div>' +
          '<div style="font-size:14px;color:rgba(255,255,255,0.6);margin:12px 0 20px;line-height:1.8;">多品牌中控、超量產能、地端混合運算與專屬導入。<br>留下需求,我們依規模為你規劃。</div>' +
          '<a href="mailto:admin@raby.com.tw?subject=Brand%20OS%20客製方案諮詢" style="display:block;text-decoration:none;width:100%;padding:15px;border-radius:12px;background:linear-gradient(135deg,#7c6cff,#ff7ac3);color:#fff;font-size:15px;font-weight:800;">✉️ admin@raby.com.tw</a>' +
          '<button onclick="renderPage()" style="width:100%;margin-top:14px;padding:13px;border:none;border-radius:12px;background:transparent;color:rgba(255,255,255,0.45);font-size:14px;cursor:pointer;">← 返回方案</button>' +
        '</div>';
      return;
    }
    if (!email) {
      // 未登入 = 新客 / 朋友 → 導去品牌入駐書申請,帶著選的方案(desiredPlan)
      location.href = 'onboard.html?plan=' + encodeURIComponent(k);
      return;
    }
    const p = findBrandosPlan(k); if (!p) return;
    const yr = (_cyc === 'year');
    const monthPrice = (p.promo > 0) ? p.promo : p.price;
    const amount = yr ? (p.price * 12) : monthPrice;
    const cycleText = yr ? '年繳（開通13個月）' : '月繳';
    const bs = 'width:100%;margin-top:10px;padding:15px;border:none;border-radius:12px;font-size:15px;font-weight:800;cursor:pointer;color:#fff;';
    document.getElementById('planRoot').innerHTML =
      '<div style="text-align:center;max-width:450px;margin:0 auto;padding:20px 0;">' +
        '<div style="font-size:20px;font-weight:900;color:#fff;">' + p.name + ' 方案 · ' + cycleText + '</div>' +
        '<div style="font-size:14px;color:rgba(255,255,255,0.6);margin:8px 0 4px;">每月 ' + p.bits.toLocaleString() + ' 點 ／ NT$' + amount.toLocaleString() + (yr ? '（年）' : '（月）') + '</div>' +
        '<div style="font-size:12px;color:rgba(255,255,255,0.4);margin-bottom:20px;">未稅,另計 5% 營業稅</div>' +
        '<div style="font-size:13px;color:rgba(255,255,255,0.5);margin-bottom:6px;">選擇付款方式</div>' +
        '<button onclick="buyPlanEcpay(\'' + k + '\')" style="' + bs + 'background:linear-gradient(135deg,#7c6cff,#ff7ac3);">💳 線上刷卡 / ATM（即時開通）</button>' +
        '<button onclick="buyPlanManual(\'' + k + '\')" style="' + bs + 'background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);">🏦 銀行轉帳（人工開通）</button>' +
        '<button onclick="renderPage()" style="' + bs + 'background:transparent;color:rgba(255,255,255,0.45);font-weight:500;margin-top:14px;">← 返回方案</button>' +
      '</div>';
  }

  // ★ 2026-08-08:訂閱建單改走 Worker(D1 正本),不再直打 GAS。
  //   為什麼:訂單正本早就在 D1,但這裡還在寫 GAS Sheets ——
  //   而綠界回呼(confirmSubOrder)是去 D1 找那張單,永遠 not_found,
  //   客戶付了三萬五卻不會開通。index.html 的儲值在 v3.95 已經改過,
  //   plans.html 漏掉沒跟上,這裡補齊。
  //   ⚠️ 不能用 CF_WORKER_URL —— 那支是 photoroom-proxy(綠界導向參數專用),
  //     沒有 gas_write。訂單/點數/D1 全部在 kol-proxy。
  const KOL_WORKER_URL = 'https://kol-proxy.calm-sunset-6b66.workers.dev';
  function _wWrite(gasAction, payload) {
    return fetch(KOL_WORKER_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'gas_write', password: GAS_PASSWORD, gasAction, payload })
    }).then(r => r.json());
  }

  function buyPlanEcpay(k) {
    const email = localStorage.getItem('bs_sso_email') || '';
    if (!email) { alert('請先登入再購買'); return; }
    const root = document.getElementById('planRoot');
    if (window.showSpaceLoader) showSpaceLoader(root, '正在建立付款'); else root.innerHTML = '<div style="text-align:center;padding:60px 0;color:rgba(255,255,255,0.6);">建立付款中…</div>';
    _wWrite('createSubOrder', { email, plan: k, cycle: _cyc, method: 'ecpay' })
      .then(j => {
        if (!j.ok) { alert('下單失敗:' + (j.error || '')); renderPage(); return; }
        return fetch(CF_WORKER_URL, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'ecpay_create', password: GAS_PASSWORD,
            orderType: 'sub',
            orderId: j.orderId, amount: j.amount,
            itemName: `${j.planName}方案 ${j.cycle === 'year' ? '年繳' : '月繳'}`,
            tradeDesc: 'Brand OS 訂閱方案',
            clientBackURL: location.origin + location.pathname + '?paid=' + encodeURIComponent(j.orderId)
          })
        }).then(r => r.json()).then(e => {
          if (!e.ok) { alert('建立付款失敗:' + (e.error || '')); renderPage(); return; }
          const form = document.createElement('form');
          form.method = 'POST'; form.action = e.endpoint;
          for (const key in e.fields) {
            const inp = document.createElement('input');
            inp.type = 'hidden'; inp.name = key; inp.value = e.fields[key];
            form.appendChild(inp);
          }
          document.body.appendChild(form); form.submit();
        });
      })
      .catch(() => { alert('連線錯誤,請重試'); renderPage(); });
  }

  function buyPlanManual(k) {
    const email = localStorage.getItem('bs_sso_email') || '';
    if (!email) { alert('請先登入再購買'); return; }
    const p = findBrandosPlan(k); if (!p) return;
    const yr = (_cyc === 'year');
    const monthPrice = (p.promo > 0) ? p.promo : p.price;
    const amount = yr ? (p.price * 12) : monthPrice;
    if (!confirm(`確認訂閱「${p.name} 方案 · ${yr ? '年繳' : '月繳'}」?\n\n每月 ${p.bits.toLocaleString()} 點 ／ NT$${amount.toLocaleString()}${yr ? '（年）' : '（月）'}（未稅）\n\n下單後依匯款資訊轉帳,我們對帳後為你開通。`)) return;
    _wWrite('createSubOrder', { email, plan: k, cycle: _cyc })
      .then(j => { if (!j.ok) { alert('下單失敗:' + (j.error || '')); return; } showSubOrderInfo(j); })
      .catch(() => alert('連線錯誤,請重試'));
  }

  function showSubOrderInfo(o) {
    const b = o.bank || {};
    const cycleText = (o.cycle === 'year') ? '年繳（開通13個月）' : '月繳';
    document.getElementById('planRoot').innerHTML = `
      <div style="max-width:480px;margin:0 auto;padding:14px 0;">
        <div style="text-align:center;margin-bottom:18px;">
          <div style="font-size:36px;">✅</div>
          <div style="font-size:17px;font-weight:900;color:#fff;margin-top:6px;">訂閱單已建立</div>
          <div style="font-size:12px;color:rgba(255,255,255,0.5);margin-top:3px;">請依下方資訊匯款,我們對帳後為你開通 ${o.planName} 方案</div>
        </div>
        <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,190,90,0.25);border-radius:12px;padding:18px 20px;font-size:13px;line-height:2.1;color:rgba(255,255,255,0.85);">
          <div style="display:flex;justify-content:space-between;"><span style="color:rgba(255,255,255,0.5)">訂單編號</span><b style="font-family:monospace">${o.orderId}</b></div>
          <div style="display:flex;justify-content:space-between;"><span style="color:rgba(255,255,255,0.5)">方案</span><b>${o.planName} · ${cycleText}</b></div>
          <div style="display:flex;justify-content:space-between;"><span style="color:rgba(255,255,255,0.5)">每月配點</span><b>${Number(o.monthlyBits).toLocaleString()} 點</b></div>
          <div style="display:flex;justify-content:space-between;"><span style="color:rgba(255,255,255,0.5)">應付金額</span><b style="color:#ffce6b">NT$${Number(o.amount).toLocaleString()}（未稅）</b></div>
          <div style="height:1px;background:rgba(255,255,255,0.1);margin:8px 0;"></div>
          <div style="display:flex;justify-content:space-between;"><span style="color:rgba(255,255,255,0.5)">銀行</span><b>${b.bankName || ''} ${b.bankCode || ''}</b></div>
          <div style="display:flex;justify-content:space-between;"><span style="color:rgba(255,255,255,0.5)">帳號</span><b style="font-family:monospace">${b.account || ''}</b></div>
          <div style="display:flex;justify-content:space-between;"><span style="color:rgba(255,255,255,0.5)">戶名</span><b>${b.accountName || ''}</b></div>
        </div>
        <div style="font-size:11px;color:rgba(255,255,255,0.4);margin-top:12px;line-height:1.7;">※ 匯款時請於備註填「訂單編號」方便對帳。對帳開通後,方案點數會立即配發。</div>
        <div style="margin-top:14px;background:rgba(124,108,255,0.08);border:1px solid rgba(124,108,255,0.3);border-radius:12px;padding:14px 16px;">
          <div style="font-size:12.5px;font-weight:800;color:#fff;margin-bottom:8px;">🏦 匯款完成後,回報您的帳號後五碼</div>
          <div style="display:flex;gap:8px;">
            <input id="last5Input" maxlength="5" inputmode="numeric" placeholder="帳號後 5 碼" style="flex:1;padding:10px 12px;border-radius:9px;border:1px solid rgba(255,255,255,0.18);background:rgba(0,0,0,0.3);color:#fff;font-family:monospace;font-size:14px;letter-spacing:2px;">
            <button onclick="reportLast5('${o.orderId}')" style="padding:10px 18px;border:none;border-radius:9px;background:linear-gradient(135deg,#7c6cff,#ff7ac3);color:#fff;font-weight:800;font-size:13px;cursor:pointer;white-space:nowrap;">回報</button>
          </div>
          <div id="last5Msg" style="font-size:11px;color:rgba(255,255,255,0.5);margin-top:7px;line-height:1.6;">填了我們對帳更快、點數開通更即時。</div>
        </div>
        <button onclick="renderPage()" style="width:100%;margin-top:16px;padding:13px;border:none;border-radius:12px;background:linear-gradient(135deg,#ffb347,#ff8c42);color:#fff;font-size:14px;font-weight:800;cursor:pointer;">完成 · 回方案</button>
      </div>`;
  }

  function reportLast5(orderId) {
    const el = document.getElementById('last5Input');
    const msg = document.getElementById('last5Msg');
    const v = (el.value || '').replace(/\D/g, '').slice(-5);
    if (v.length < 5) { msg.textContent = '請輸入正確的後 5 碼(5 位數字)'; msg.style.color = '#ff9d9d'; return; }
    msg.textContent = '回報中…'; msg.style.color = 'rgba(255,255,255,0.5)';
    fetch(`${GAS_URL}?action=reportTransferLast5&password=${GAS_PASSWORD}&orderId=${encodeURIComponent(orderId)}&last5=${v}`)
      .then(r => r.json())
      .then(j => {
        if (j.ok) { msg.textContent = '✅ 已收到後五碼,我們會盡快對帳開通'; msg.style.color = '#8effc0'; el.disabled = true; }
        else { msg.textContent = '回報失敗:' + (j.error || ''); msg.style.color = '#ff9d9d'; }
      })
      .catch(() => { msg.textContent = '連線錯誤,請重試'; msg.style.color = '#ff9d9d'; });
  }

  // ── ECPay 導回提示(對齊 index)──
  (function () {
    const m = /[?&]paid=([^&]+)/.exec(location.search);
    if (m) {
      const email = localStorage.getItem('bs_sso_email') || '';
      if (email) { fetch(`${GAS_URL}?action=clearPendingPayment&password=${GAS_PASSWORD}&email=${encodeURIComponent(email)}`).catch(() => {}); }
      setTimeout(function () {
        alert('✅ 付款完成!方案點數會在幾秒內自動配發。\n\n訂單編號:' + decodeURIComponent(m[1]));
      }, 300);
      history.replaceState(null, '', location.pathname);
    }
  })();

  // ── 待付款:有就預選方案 + 橫幅 ──
  (function initPending() {
    const email = localStorage.getItem('bs_sso_email') || '';
    renderPage();                 // 🆕 先立刻畫:方案卡片資料全在本地,不必等 GAS → 秒出內容
    if (!email) return;
    // 背景查待付款,有才補橫幅+預選(不擋畫面)
    fetch(`${GAS_URL}?action=getPendingPayment&password=${GAS_PASSWORD}&email=${encodeURIComponent(email)}`)
      .then(r => r.json())
      .then(j => {
        if (j && j.ok && j.pending && j.desiredPlan) {
          _pendingPlan = j.desiredPlan;
          _grp = ['ent', 'flag', 'custom'].includes(_pendingPlan) ? 'ent' : 'small';
          renderPage();           // 只有真的有待付款才重畫
        }
      })
      .catch(() => {});
  })();
</script>

  <footer style="max-width:880px;margin:56px auto 0;padding:28px 24px 48px;border-top:1px solid rgba(255,255,255,0.08);text-align:center;font-family:'Noto Sans TC',-apple-system,sans-serif;">
    <div style="font-size:12.5px;color:#9a9a9a;margin-bottom:12px;letter-spacing:.3px;">
      <a href="privacy.html" target="_blank" style="color:#5BC8C8;text-decoration:none;">隱私權政策</a>
      &nbsp;·&nbsp;
      <a href="terms.html" target="_blank" style="color:#5BC8C8;text-decoration:none;">服務條款</a>
      &nbsp;·&nbsp;
      <a href="https://raby.com.tw" target="_blank" style="color:#5BC8C8;text-decoration:none;">RABY 官網</a>
      &nbsp;·&nbsp;
      <a href="mailto:admin@raby.com.tw" style="color:#5BC8C8;text-decoration:none;">聯絡我們</a>
    </div>
    <div style="font-size:11.5px;color:#666;letter-spacing:0.5px;">© 2026 創捷國際貿易股份有限公司 · Brand OS</div>
  </footer>
</body>
</html>
