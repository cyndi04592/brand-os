/* ═══════════════════════════════════════════════════════════════
   🤝 admin-referral.js v1.1(2026-09-17)後台「推薦分潤」分頁 · 🎨 樣式改用 admin.html 原生 class
   ・一個檔案一個職責:admin.html 已 3800 行,推薦分潤獨立成這支,admin.html 只掛分頁殼
   ・資料全在 Worker v5.57(D1:ref_referrers / ref_bindings / ref_commissions / ref_settings)
   ・用 admin.html 既有的 workerWrite() 與 ADMIN_USER_EMAIL,權限由 Worker 端 _d1IsStaff 把關
   規則(RA 拍板):第一個推薦人永久綁定 · 每次付費都分潤 · 付款滿一個月才計入 ·
     每月 10 日結算 · 個人代扣所得稅＋二代健保(勞報單)、公司開統編發票 · 沒有提領門檻
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (n) => 'NT$' + Math.round(Number(n) || 0).toLocaleString();
  const call = (act, payload) => workerWrite(act, Object.assign({ email: ADMIN_USER_EMAIL }, payload || {}));
  let _data = { referrers: [], settings: {} };
  let _settle = null;

  function thisMonth() { const d = new Date(Date.now() + 8 * 3600e3); return d.toISOString().slice(0, 7); }

  async function load() {
    const root = $('refRoot'); if (!root) return;
    root.innerHTML = '<div class="empty-state"><p>載入中...</p></div>';
    try {
      const j = await call('refList');
      if (!j.ok) { root.innerHTML = '<div class="empty-state"><p>載入失敗:' + esc(j.message || j.error) + '</p></div>'; return; }
      _data = j; render();
    } catch (e) { root.innerHTML = '<div class="empty-state"><p>連線錯誤</p></div>'; }
  }

  //  🎨 v1.1:照 admin.html 原本的設計語彙 —— add-staff-form / field-input / btn-add-staff /
  //    staff-card / staff-avatar / badge / btn-refresh / btn-delete / table-wrap,不自己發明樣式
  const LB = 'font-size:11px;color:var(--t3);display:block;margin-bottom:5px;font-weight:600;letter-spacing:0.5px;';
  const fld = (label, html, style) => `<div style="${style || ''}"><label style="${LB}">${label}</label>${html}</div>`;
  const kpi = (label, val, color) => `<div style="flex:1;min-width:130px;"><div style="font-size:11px;color:var(--t3);font-weight:600;">${label}</div><div style="font-family:var(--font-display);font-size:18px;font-weight:800;color:${color || 'var(--t1)'};margin-top:2px;">${val}</div></div>`;

  function render() {
    const s = _data.settings || {};
    const base = location.origin;
    const refs = _data.referrers || [];
    $('refRoot').innerHTML = `
      <div class="section-header"><h2>推薦分潤</h2><button class="btn-refresh" onclick="RefAdmin.load()">重新整理</button></div>
      <div style="font-size:12px;color:var(--t3);margin-bottom:18px;line-height:1.9;">
        客人點推薦連結(或結帳時填推薦碼)下單 → 綁定第一個推薦人,永久有效 → 每次付款開通都記一筆分潤。<br>
        付款滿一個月才計入(期間退費請按「作廢」)· 每月 10 日結算 · 個人代扣所得稅與二代健保(勞報單),公司不代扣(開統編發票)。
      </div>

      <div class="add-staff-form">
        <h3 id="rfFormTitle">＋ 新增推薦人</h3>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:14px;margin-top:14px;">
          ${fld('推薦碼(英數,給客人用)', '<input class="field-input" id="rfCode" placeholder="AMY20" style="width:100%;text-transform:uppercase;font-family:var(--font-mono);" data-no-dirty>')}
          ${fld('名字', '<input class="field-input" id="rfName" placeholder="Amy 業務" style="width:100%;" data-no-dirty>')}
          ${fld('分潤 %', '<input class="field-input" id="rfPct" type="number" min="0" max="100" placeholder="20" style="width:100%;" data-no-dirty>')}
          ${fld('推薦人 Email(防自己推自己)', '<input class="field-input" id="rfEmail" type="email" style="width:100%;" data-no-dirty>')}
          ${fld('身分', '<select class="field-input" id="rfKind" style="width:100%;"><option value="person">個人(勞報單 · 代扣)</option><option value="company">公司(開統編發票)</option></select>')}
          ${fld('所得類別(依會計師建議)', '<select class="field-input" id="rfIncome" style="width:100%;"><option value="9A">9A 執行業務/佣金(超過門檻先扣稅)</option><option value="92">92 其他所得(不先扣稅)</option></select>')}
          ${fld('身分證字號(個人)', '<input class="field-input" id="rfIdNo" style="width:100%;font-family:var(--font-mono);" data-no-dirty>')}
          ${fld('統一編號(公司)', '<input class="field-input" id="rfTaxId" maxlength="8" style="width:100%;font-family:var(--font-mono);" data-no-dirty>')}
          ${fld('備註(合作性質、匯款帳號)', '<input class="field-input" id="rfNote" style="width:100%;" data-no-dirty>', 'grid-column:1/-1;')}
        </div>
        <div style="margin-top:16px;display:flex;gap:18px;align-items:center;flex-wrap:wrap;">
          <label style="display:flex;align-items:center;gap:7px;font-size:13px;color:var(--t2);cursor:pointer;font-weight:600;"><input type="checkbox" id="rfNhiEx" style="width:16px;height:16px;"> 有免扣補充保費證明</label>
          <label style="display:flex;align-items:center;gap:7px;font-size:13px;color:var(--t2);cursor:pointer;font-weight:600;"><input type="checkbox" id="rfActive" checked style="width:16px;height:16px;"> 啟用中</label>
          <div style="flex:1"></div>
          <button class="btn-refresh" onclick="RefAdmin.clearForm()">清空</button>
          <button class="btn-add-staff" onclick="RefAdmin.save()">＋ 儲存推薦人</button>
        </div>
      </div>

      <div class="staff-grid" style="margin-bottom:22px;">
        ${refs.length ? refs.map(r => `
          <div class="staff-card" style="flex-wrap:wrap;">
            <div class="staff-avatar">${esc(String(r.name || r.code).slice(0, 1))}</div>
            <div class="staff-info" style="min-width:220px;">
              <div class="staff-name">${esc(r.name || '(未命名)')} <span class="badge" style="margin-left:6px;font-family:var(--font-mono);">${esc(r.code)} · ${esc(r.pct)}%</span>
                ${Number(r.active) ? '' : '<span class="badge" style="margin-left:4px;background:rgba(244,67,54,0.1);color:#f44336;border-color:rgba(244,67,54,0.3);">停用</span>'}</div>
              <div class="staff-email">${r.kind === 'company' ? '公司 · 統編 ' + esc(r.tax_id || '未填') : '個人 · ' + esc(r.income_type)} · 推薦 ${r.clients} 位 · 待結 ${money(r.pending)} · 已結 ${money(r.settled)}</div>
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
              <button class="btn-refresh" onclick="RefAdmin.copy('${esc(base)}/?ref=${esc(r.code)}')">🔗 推薦連結</button>
              <button class="btn-refresh" onclick="RefAdmin.copy('${esc(base)}/ref.html?code=${esc(r.code)}&k=${esc(r.view_key)}')">👀 推薦人查看頁</button>
              <button class="btn-refresh" onclick="RefAdmin.edit('${esc(r.code)}')">✎ 編輯</button>
            </div>
          </div>`).join('') : '<div class="empty-state"><p>還沒有推薦人</p></div>'}
      </div>

      <div class="add-staff-form">
        <h3>每月結算</h3>
        <div style="display:flex;gap:14px;align-items:flex-end;flex-wrap:wrap;margin-top:14px;">
          ${fld('結算月份(截至當月 10 日已滿一個月)', `<input class="field-input" id="rsMonth" type="month" value="${thisMonth()}" style="width:190px;">`)}
          <button class="btn-add-staff" onclick="RefAdmin.settle()">試算</button>
          <div style="flex:1"></div>
          ${fld('退費作廢(訂單編號)', '<input class="field-input" id="rvOrder" style="width:190px;font-family:var(--font-mono);" data-no-dirty>')}
          <button class="btn-delete" style="padding:9px 16px;" onclick="RefAdmin.voidOrder()">作廢</button>
        </div>
        <div id="rsResult" style="margin-top:18px;"></div>
      </div>

      <div class="add-staff-form">
        <h3>手動補綁</h3>
        <div style="font-size:11.5px;color:var(--t3);margin-top:4px;">客人當初沒帶到推薦碼時用;已經綁過的不能改(第一個推薦人算數)</div>
        <div class="add-staff-row" style="margin-top:12px;">
          ${fld('客人登入的 Google Email', '<input class="field-input" id="rbEmail" type="email" style="width:100%;" data-no-dirty>')}
          ${fld('推薦碼', '<input class="field-input" id="rbCode" style="width:100%;text-transform:uppercase;font-family:var(--font-mono);" data-no-dirty>')}
          <button class="btn-add-staff" onclick="RefAdmin.bind()">綁定</button>
        </div>
      </div>

      <div class="add-staff-form" style="background:rgba(255,93,143,0.06);border-color:rgba(255,93,143,0.25);">
        <h3 style="color:#ff8cae;">代扣設定</h3>
        <div style="font-size:11.5px;color:var(--t3);margin-top:4px;">法規每年可能調整,改這裡就好;所得類別請依會計師建議設定在每位推薦人上。</div>
        <div style="display:flex;gap:14px;align-items:flex-end;flex-wrap:wrap;margin-top:12px;">
          ${fld('所得稅率', `<input class="field-input" id="rsTaxRate" value="${esc(s.tax_rate)}" style="width:100px;">`)}
          ${fld('單次「超過」幾元才扣稅', `<input class="field-input" id="rsTaxTh" value="${esc(s.tax_threshold)}" style="width:150px;">`)}
          ${fld('補充保費率', `<input class="field-input" id="rsNhiRate" value="${esc(s.nhi_rate)}" style="width:100px;">`)}
          ${fld('單次「達」幾元全額扣', `<input class="field-input" id="rsNhiTh" value="${esc(s.nhi_threshold)}" style="width:150px;">`)}
          <button class="btn-add-staff" onclick="RefAdmin.saveSettings()">儲存設定</button>
        </div>
      </div>`;
  }

  function renderSettle() {
    const box = $('rsResult'); if (!box || !_settle) return;
    const ps = _settle.payouts || [];
    if (!ps.length) { box.innerHTML = '<div class="empty-state" style="padding:24px;"><p>截至 ' + esc(_settle.cutoff) + ' 沒有要結算的分潤</p></div>'; return; }
    const tot = ps.reduce((a, p) => ({ g: a.g + p.gross, t: a.t + p.tax, n: a.n + p.nhi, net: a.net + p.net }), { g: 0, t: 0, n: 0, net: 0 });
    box.innerHTML = `
      <div style="display:flex;gap:14px;flex-wrap:wrap;align-items:flex-end;margin-bottom:14px;">
        ${kpi('應付', money(tot.g))}${kpi('代扣所得稅', money(tot.t), 'var(--pink)')}${kpi('代扣補充保費', money(tot.n), 'var(--pink)')}${kpi('實匯', money(tot.net), 'var(--mint)')}
        <button class="btn-refresh" onclick="RefAdmin.exportCsv()">⬇ 匯出 CSV(給會計)</button>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>推薦人</th><th>單據</th><th>應付</th><th>所得稅</th><th>補充保費</th><th>實匯</th><th>明細</th><th></th></tr></thead>
        <tbody>${ps.map((p, i) => `<tr>
          <td><b>${esc(p.name || p.code)}</b><div class="staff-email">${esc(p.code)}</div></td>
          <td>${esc(p.doc)}</td><td>${money(p.gross)}</td><td>${money(p.tax)}</td><td>${money(p.nhi)}</td>
          <td style="color:var(--mint);font-weight:700;">${money(p.net)}</td>
          <td style="font-size:11px;color:var(--t3);line-height:1.7;">${p.items.map(it => `${esc(it.order_id)} · ${money(it.amount)}×${esc(it.pct)}%=${money(it.commission)} · 計入 ${esc(it.eligible_at)}`).join('<br>')}</td>
          <td><button class="btn-add-staff" style="padding:6px 14px;font-size:12px;" onclick="RefAdmin.markPaid(${i})">已匯款</button></td>
        </tr>`).join('')}</tbody></table></div>`;
  }

  window.RefAdmin = {
    load,
    copy(t) { navigator.clipboard.writeText(t).then(() => alert('已複製:\n' + t)).catch(() => prompt('複製這個連結:', t)); },
    clearForm() { ['rfCode', 'rfName', 'rfPct', 'rfEmail', 'rfIdNo', 'rfTaxId', 'rfNote'].forEach(id => { $(id).value = ''; }); $('rfKind').value = 'person'; $('rfIncome').value = '9A'; $('rfNhiEx').checked = false; $('rfActive').checked = true; $('rfCode').disabled = false; $('rfFormTitle').textContent = '＋ 新增推薦人'; },
    edit(code) {
      const r = (_data.referrers || []).find(x => x.code === code); if (!r) return;
      $('rfCode').value = r.code; $('rfCode').disabled = true; $('rfName').value = r.name || ''; $('rfPct').value = r.pct;
      $('rfEmail').value = r.email || ''; $('rfKind').value = r.kind || 'person'; $('rfIdNo').value = r.id_no || ''; $('rfTaxId').value = r.tax_id || '';
      $('rfIncome').value = r.income_type || '9A'; $('rfNhiEx').checked = !!Number(r.nhi_exempt); $('rfActive').checked = !!Number(r.active); $('rfNote').value = r.note || '';
      $('rfFormTitle').textContent = '✎ 編輯推薦人 ' + r.code; $('rfCode').scrollIntoView({ behavior: 'smooth', block: 'center' });
    },
    async save() {
      const referrer = { code: $('rfCode').value, name: $('rfName').value, pct: $('rfPct').value, refEmail: $('rfEmail').value, kind: $('rfKind').value,
        id_no: $('rfIdNo').value, tax_id: $('rfTaxId').value, income_type: $('rfIncome').value, nhi_exempt: $('rfNhiEx').checked, active: $('rfActive').checked, note: $('rfNote').value };
      const j = await call('refSave', { referrer });
      if (!j.ok) return alert('❌ ' + (j.message || j.error));
      alert('✅ 已儲存 ' + j.code); load();
    },
    async saveSettings() {
      const settings = { tax_rate: $('rsTaxRate').value, tax_threshold: $('rsTaxTh').value, nhi_rate: $('rsNhiRate').value, nhi_threshold: $('rsNhiTh').value };
      const j = await call('refSettingsSave', { settings });
      if (!j.ok) return alert('❌ ' + (j.message || j.error)); alert('✅ 代扣設定已儲存'); load();
    },
    async bind() {
      const j = await call('refBindManual', { clientEmail: $('rbEmail').value, code: $('rbCode').value });
      if (!j.ok) return alert('❌ ' + (j.message || j.error)); alert('✅ 已綁定(之後這位客人付款開通都會記分潤)'); load();
    },
    async settle() {
      const j = await call('refSettle', { month: $('rsMonth').value });
      if (!j.ok) return alert('❌ ' + (j.message || j.error)); _settle = j; renderSettle();
    },
    async markPaid(i) {
      const p = _settle && _settle.payouts[i]; if (!p) return;
      if (!confirm(`確認已匯款給 ${p.name || p.code} ${money(p.net)}?\n(這 ${p.items.length} 筆會標記為 ${_settle.month} 已結算,不會再出現在結算清單)`)) return;
      const j = await call('refMarkPaid', { month: _settle.month, orderIds: p.items.map(x => x.order_id) });
      if (!j.ok) return alert('❌ ' + (j.message || j.error)); alert('✅ 已標記'); this.settle(); load();
    },
    async voidOrder() {
      const id = $('rvOrder').value.trim(); if (!id) return;
      if (!confirm('確定作廢訂單 ' + id + ' 的分潤?(退費時使用;已結算的不會被改)')) return;
      const j = await call('refVoid', { orderId: id, note: '退費作廢' });
      if (!j.ok) return alert('❌ ' + (j.message || j.error)); alert(j.changed ? '✅ 已作廢' : '⚠️ 沒有找到可作廢的待結分潤'); load();
    },
    exportCsv() {
      if (!_settle) return;
      const rows = [['結算月份', '推薦碼', '名字', '單據', '身分證字號', '統一編號', '所得類別', '應付', '代扣所得稅', '代扣補充保費', '實匯', '明細筆數']];
      (_settle.payouts || []).forEach(p => rows.push([_settle.month, p.code, p.name || '', p.doc, p.id_no || '', p.tax_id || '', p.kind === 'company' ? '' : (p.income_type || ''), p.gross, p.tax, p.nhi, p.net, p.items.length]));
      const csv = '\ufeff' + rows.map(r => r.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n');
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      a.download = '推薦分潤結算_' + _settle.month + '.csv'; a.click();
    },
  };
})();
