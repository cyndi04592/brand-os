/* ══════════════════════════════════════════════════════════════
   Brand OS · monitor-data.js · v1.2(2026-11-11)— v1.2:加 MON.diag() 診斷包;v1.1:Worker 回舊資料(stale)時,15 秒後自動換新的;自動更新不硬敲 Meta
   新版廣告監控頁的「資料管家」——整頁只有這支檔跟後台講話。
   其他區塊檔(總覽 / ASC / 廣告列表 / 小幫手)只跟這支拿資料,不自己打 API。

   做的事:
   ① 跟 ads-monitor Worker 拿數據(登入通行證自動帶)
   ② 記住看過的品牌 + 區間 → 切回來 0 秒(5 分鐘內有效)
   ③ 第一個品牌載完,背景偷偷先載其他品牌 → 切換幾乎不用等
   ④ 通知各區塊「資料到了」→ 各區塊自己重畫
   ⑤ 共用小工具:金額 / 百分比 / 漲跌 / 行銷活動分組(ASC / CIBS / 再行銷)

   用法(其他檔):
     MON.on('data', function (d) { ... });   // 每次換品牌或區間,資料到了就叫你
     MON.on('loading', function (info) { ... });
     MON.on('error', function (msg) { ... });
     MON.setBrand('cf');  MON.setRange({ preset: '30d' });  MON.refresh();
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var API = 'https://ads-monitor.calm-sunset-6b66.workers.dev';
  var MEM_TTL = 5 * 60 * 1000;      // 前端記憶 5 分鐘(跟 Worker 暫存同步)
  var LS_BRAND = 'mon2_brand';
  var LS_RANGE = 'mon2_range';
  var LS_CFG = 'mon2_cfg';

  //  警戒值預設(設定面板可改,存在這台電腦)
  var CFG_DEFAULT = {
    roasTarget: 3.0,     // ROAS 目標
    cpaWarn: 1500,       // 單次購買成本警戒
    freqWarn: 3.5,       // 頻率過高(素材疲乏)
    ctrWarn: 0.8,        // 點擊率過低(%)
    cpmWarn: 300,        // 千次曝光成本過高
    cibsOverWarn: 1.5    // CIBS 今日花費超過日預算幾倍要提醒
  };

  // ── 小工具 ───────────────────────────────────────────────
  function lsGet(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (_) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (_) {} }
  function token() {
    try { return sessionStorage.getItem('bs_auth_token') || localStorage.getItem('bs_auth_token') || ''; }
    catch (_) { return ''; }
  }
  function rangeKey(r) {
    r = r || {};
    return r.preset ? r.preset : (String(r.since || '') + '~' + String(r.until || ''));
  }

  // ── 事件 ────────────────────────────────────────────────
  var handlers = {};
  function on(ev, fn) { (handlers[ev] = handlers[ev] || []).push(fn); }
  function emit(ev, payload) {
    (handlers[ev] || []).forEach(function (fn) {
      try { fn(payload); } catch (e) { console.error('[MON] ' + ev + ' 區塊出錯', e); }
    });
  }

  // ── 跟 Worker 講話 ───────────────────────────────────────
  function post(body, timeoutMs) {
    var ctl = new AbortController();
    var tm = setTimeout(function () { ctl.abort(); }, timeoutMs || 30000);
    body.token = token();
    return fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctl.signal
    }).then(function (r) {
      return r.json().catch(function () { return { ok: false, error: '伺服器回傳格式不對(' + r.status + ')' }; });
    }).catch(function (e) {
      return { ok: false, error: e && e.name === 'AbortError' ? '等太久了,Meta 沒回應,請按重新整理' : '網路連不上,請檢查網路' };
    }).finally(function () { clearTimeout(tm); });
  }

  // ── 狀態 ────────────────────────────────────────────────
  var state = {
    me: null,               // { email, role, all, brands:[{id,name,hasSmr,tier}] }
    brand: lsGet(LS_BRAND, ''),
    range: (function () { try { return JSON.parse(lsGet(LS_RANGE, '')) || { preset: '7d' }; } catch (_) { return { preset: '7d' }; } })(),
    data: null,
    cfg: (function () {
      var c = {};
      try { c = JSON.parse(lsGet(LS_CFG, '{}')) || {}; } catch (_) {}
      return Object.assign({}, CFG_DEFAULT, c);
    })()
  };
  var mem = {};        // 'brand|range' → { at, data }
  var inflight = {};   // 同一包正在抓,就共用同一個等待
  var seq = 0;         // 最後一次要求的編號(舊的回來就丟掉)

  function memGet(k) {
    var x = mem[k];
    return x && (Date.now() - x.at < MEM_TTL) ? x.data : null;
  }

  function fetchDash(brand, range, fresh) {
    var k = brand + '|' + rangeKey(range);
    if (!fresh) {
      var hit = memGet(k);
      if (hit) return Promise.resolve(hit);
      if (inflight[k]) return inflight[k];
    }
    var p = post({ action: 'dashboard', brand: brand, range: range, fresh: !!fresh }, 45000).then(function (j) {
      delete inflight[k];
      if (j && j.ok) { mem[k] = { at: Date.now(), data: j }; }
      return j;
    });
    inflight[k] = p;
    return p;
  }

  function handleFail(j) {
    if (j && j.code === 'NEED_LOGIN') {
      emit('error', '登入已過期,3 秒後帶你回登入頁');
      setTimeout(function () { location.href = 'index.html'; }, 3000);
      return;
    }
    emit('error', (j && j.error) || '讀不到資料');
  }

  //  主流程:載目前品牌 + 區間
  function load(fresh) {
    if (!state.brand) return Promise.resolve(null);
    var my = ++seq;
    var cachedNow = !fresh && memGet(state.brand + '|' + rangeKey(state.range));
    if (!cachedNow) emit('loading', { brand: state.brand, range: state.range });
    var t0 = Date.now();
    return fetchDash(state.brand, state.range, fresh).then(function (j) {
      if (my !== seq) return null;           // 中途又切了品牌,這包作廢
      if (!j || !j.ok) { handleFail(j); return null; }
      j.loadMs = Date.now() - t0;
      state.data = j;
      emit('data', j);
      if (j.warn) emit('warn', j.warn);
      //  Worker 先給了舊資料、背景在重抓 → 15 秒後再拿一次(那時暫存已是新的)
      if (j.stale && !j.warn) {
        var k = state.brand + '|' + rangeKey(state.range);
        setTimeout(function () {
          if (state.brand + '|' + rangeKey(state.range) !== k) return;
          delete mem[k];
          load(false);
        }, 15000);
      }
      prefetchOthers();
      return j;
    });
  }

  //  背景先載其他品牌(同區間),一次一個,不搶頻寬
  var prefetching = false;
  function prefetchOthers() {
    if (prefetching || !state.me) return;
    var todo = state.me.brands.map(function (b) { return b.id; }).filter(function (id) {
      return id !== state.brand && !memGet(id + '|' + rangeKey(state.range));
    });
    if (!todo.length) return;
    prefetching = true;
    var range = state.range;
    (function next() {
      var id = todo.shift();
      if (!id || rangeKey(range) !== rangeKey(state.range)) { prefetching = false; return; }
      fetchDash(id, range, false).then(function () { setTimeout(next, 300); });
    })();
  }

  // ── 對外 ────────────────────────────────────────────────
  function init() {
    if (!token()) { location.href = 'index.html'; return Promise.resolve(null); }
    return post({ action: 'me' }, 15000).then(function (j) {
      if (!j || !j.ok) { handleFail(j); return null; }
      if (!j.brands || !j.brands.length) { emit('error', '這個帳號目前沒有可以看的品牌廣告數據'); return null; }
      state.me = j;
      var ids = j.brands.map(function (b) { return b.id; });
      if (ids.indexOf(state.brand) < 0) state.brand = ids[0];
      emit('me', j);
      return load(false);
    });
  }
  function setBrand(id) {
    if (!state.me || !state.me.brands.some(function (b) { return b.id === id; })) return;
    state.brand = id; lsSet(LS_BRAND, id);
    emit('brand', id);
    return load(false);
  }
  function setRange(r) {
    state.range = r && (r.preset || r.since) ? r : { preset: '7d' };
    lsSet(LS_RANGE, JSON.stringify(state.range));
    emit('range', state.range);
    return load(false);
  }
  function setCfg(patch) {
    state.cfg = Object.assign({}, state.cfg, patch || {});
    lsSet(LS_CFG, JSON.stringify(state.cfg));
    if (state.data) emit('data', state.data);
  }
  //  診斷包(CPA 為什麼變貴):跟主畫面分開抓,主畫面先出來
  var diagMem = {};
  function diag() {
    var brand = state.brand, range = state.range, k = brand + '|' + rangeKey(range);
    var x = diagMem[k];
    if (x && Date.now() - x.at < MEM_TTL) return Promise.resolve(x.data);
    return post({ action: 'diagnose', brand: brand, range: range }, 45000).then(function (j) {
      if (j && j.ok) diagMem[k] = { at: Date.now(), data: j };
      return j;
    });
  }
  function brandInfo(id) {
    id = id || state.brand;
    return (state.me && state.me.brands.filter(function (b) { return b.id === id; })[0]) || null;
  }

  // ── 共用格式 ────────────────────────────────────────────
  var fmt = {
    money: function (n) { return 'NT$' + Math.round(n || 0).toLocaleString('zh-TW'); },
    num: function (n) { return Math.round(n || 0).toLocaleString('zh-TW'); },
    pct: function (n, d) { return (n || 0).toFixed(d == null ? 2 : d) + '%'; },
    x: function (n) { return (n || 0).toFixed(2) + 'x'; },
    //  漲跌:回 { text:'▲12.3%', dir:'up'|'down'|'flat' };上一期是 0 就回 '—'
    delta: function (cur, prev) {
      if (!prev) return { text: '—', dir: 'flat' };
      var p = (cur - prev) / prev * 100;
      if (Math.abs(p) < 0.05) return { text: '持平', dir: 'flat' };
      return { text: (p > 0 ? '▲' : '▼') + Math.abs(p).toFixed(1) + '%', dir: p > 0 ? 'up' : 'down' };
    },
    weekday: function (ymd) { return '日一二三四五六'.charAt(new Date(ymd + 'T00:00:00+08:00').getDay()); }
  };

  //  行銷活動分組:新版 Advantage+ 不回 ASC 標記,改看名稱與出價方式
  function campaignGroup(c) {
    var n = String((c && c.name) || '');
    if (c && c.asc) return 'asc';
    if (/【\s*CIBS/i.test(n) || String((c && c.bidStrategy) || '') === 'LOWEST_COST_WITH_MIN_ROAS') return 'cibs';
    if (/【\s*ASC/i.test(n) || /advantage\+/i.test(n)) return 'asc';
    if (/再行銷|retarget|remarketing/i.test(n)) return 'rt';
    return 'other';
  }
  var GROUP_LABEL = { asc: 'ASC 高效推廣', cibs: 'CIBS 超額預算', rt: '再行銷', other: '其他' };

  window.MON = {
    version: 'monitor-data v1.2',
    on: on, init: init,
    refresh: function () { return load(true); },                                          // 使用者按「重抓最新」
    softRefresh: function () { delete mem[state.brand + '|' + rangeKey(state.range)]; return load(false); },   // 自動更新:讓 Worker 決定要不要敲 Meta
    setBrand: setBrand, setRange: setRange, setCfg: setCfg,
    brandInfo: brandInfo, state: state, fmt: fmt, diag: diag,
    campaignGroup: campaignGroup, GROUP_LABEL: GROUP_LABEL,
    CFG_DEFAULT: CFG_DEFAULT
  };
})();
