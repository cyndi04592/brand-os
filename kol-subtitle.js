/* ═══════════════════════════════════════════════════════════════════════
   🎬 kol-subtitle.js v1.6(2026-09-19)秒數對不上時的保險
   v1.6:RA 實測:分鏡卡 15 秒「5-15 秒開口」,實際片被縮成 10 秒,她 1.8 秒就開口,
        字幕照分鏡去 5 秒找聲音 → 前 3 秒錯過。(根因在 kol.html snapDur,已另修)
        ① 卡片秒數 ≠ 實際秒數 → 分鏡的開口時段照比例縮放
        ② 量音量找開口時,往前多找 2 秒(不再只放寬 0.3 秒)
   ───────────────────────────────────────────────────────────────────────
   v1.5 聲音由瀏覽器直接遞給語音辨識
   v1.5:RA 實測 Console:語音辨識去 cdn 抓影片被擋 403 → 退回量音量。
        瀏覽器本來就抓得到聲音(量音量成功)→ 抓一次,壓成 16kHz 單聲道 WAV,
        直接交給語音辨識(Worker v5.79 audioData),繞過被擋的門;量音量也共用同一份。
   ───────────────────────────────────────────────────────────────────────
   v1.4【語音辨識對時間】+【不准用猜的】
   v1.4:RA:「環境音有其他聲音呢?你確定聽得懂音軌?」「猜太危險,客人會覺得字幕很爛」
        ★ 第一順位:語音辨識(Worker speech_timing)聽出每個字是第幾秒 →
          跟我們的台詞一個字一個字對齊(字用我們的,只借它的時間;聽錯字、簡體都沒關係)。
        ★ 第二順位:量音量找停頓(v1.3,只在語音辨識失敗時用)。
        ★ 兩個都拿不到 → 【不燒、不扣點】,告訴客人稍後再試。不再退回推算。
   ───────────────────────────────────────────────────────────────────────
   v1.3【聽聲音對時間】
   v1.3:RA:「燒字幕等於耳朵聽不到?一百支片要對一百次?」
        ★ 字用我們自己的台詞(不會錯字、不會變簡體),【時間用影片實際的聲音】:
          按「加上字幕」時先把影片的聲音抓下來,只聽「什麼時候在講、什麼時候停」,
          ① 每一格:找真正開始講與講完的時間(不再用猜的 +0.5 / -0.3)
          ② 每一句的換句點:吸到附近真正的停頓(±0.6 秒內最安靜的那一刻)
        ★ 全自動、免費、在客人的瀏覽器裡做,不動算力機。
        ★ 抓不到聲音(網路、權限、影片沒聲音)→ 自動退回 v1.2 的算法,照樣能燒。
        驗證(妞妞露營片):換句點吸到 9.75 / 13.25 秒,結束 14.70 秒,跟實測一致。
   ───────────────────────────────────────────────────────────────────────
   v1.2 時間軸改成【塞滿開口視窗】
   v1.2:RA 實測妞妞那支(15 秒、開口 4-15 秒、58 字):最後一句字幕太早消失。
        量聲音:她從 4.5 秒講到 14.7 秒 —— 算力機會把台詞【拉長塞滿整個開口視窗】,
        不是照語速 6 字/秒講完就停(舊算法算到 13.1 秒就結束,差 1.6 秒)。
        新算法:開口視窗起點 +0.5 秒(真正出聲的延遲)→ 終點 -0.3 秒,照字數比例分配。
        驗證:預測的換句點 9.65 / 13.20 秒,實測人聲停頓 9.75 / 13.25 秒,誤差 0.1 秒內。
   v1.1 加上字幕
   v1.1:RA 定案 —— 客人要的是【直接燒好字幕的 MP4】,不要叫他去剪映自己上。
        成品下方給一顆【加上字幕(N 點)】,客人自己選;按了才燒、原片保留、要扣點。
        時間軸照舊在這裡算(台詞＋開口秒數),燒字的是 Worker 的 subtitle_burn(v5.74)。
        不再給客人 .srt 下載按鈕(download() 保留給 Console 除錯用)。
   ───────────────────────────────────────────────────────────────────────
   v1.0 自動字幕核心
   ───────────────────────────────────────────────────────────────────────
   職責:只做一件事 —— 把分鏡卡的【台詞 + 開口秒數】變成字幕檔(.srt)。
   ★ 為什麼不用引擎上字幕:引擎上的字會變簡體、字型爛,
     所以生成端 tail 一律「無字幕」,那條不改;字幕是【生完之後自己上】。
   ★ 我們比一般字幕工具省掉最貴的一段:
       台詞是自己寫的 → 不用聽打、不會錯字
       開口秒數分鏡卡本來就有 → 不用對時間軸
   ★ 顯示的是分鏡卡上的【原始台詞】(發音修正表只改送給引擎念的那份,
     這裡拿不到也不該拿),所以字幕會是「囤」,不會出現「屯」這種修正字。

   斷句規則(參考 What'Sub 三要素:斷句節奏 × 一行字數 × 停留時間):
     ① 照逗號、句號、語氣停頓斷,不硬切詞
     ② 一行最多 15 字,太短(<5 字)的片段往後併
     ③ 每行至少停留 1.2 秒,不夠就跟下一行合併(合併後仍 ≤16 字)
     ④ 逗號句號頓號不上字幕:行尾拿掉、行內改空格(台灣字幕慣例),？！保留

   ⏱ 時間怎麼算:
     段落起點 = 前面各段實際秒數加總(用 plan 的 durationSec,跟接片一致)
     開口起訖 = 從 shotDesc 分時段抓「開口/說/講」的第一段 → 最後一段
               (⚠️ 與 kol-storyboard-panel _speakSpan、kol-proxy _winOf、
                  crew-director _speakSegOf 同一套 —— 現在是【四邊同步】)
     講多久   = 字數 ÷ 語速 6.0,但不超出開口視窗
     每行時間 = 照字數比例分配(標點停頓算半個字)

   用法(kol.html 成品區呼叫):
     KolSubtitle.attach(boxEl, { beats, plan, videoUrl, brandId, name })
       → 在播放器下方加一顆「加上字幕(N 點)」
     KolSubtitle.buildCues(beats, durations) → [{start,end,text}]
     KolSubtitle.toSRT(cues) → 字串
   ═══════════════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';

  const SPEAK_RATE = 6.0;   // ⚠️ 與 kol-proxy / 面板的 SPEAK_RATE 同步
  const MAX_LINE   = 15;    // 一行字數上限
  const MIN_PIECE  = 5;     // 太短的片段往後併
  const MIN_HOLD   = 1.2;   // 每行最少停留秒數
  const MERGE_MAX  = 16;    // 為了停留時間合併時,放寬到 16 字
  const ONSET      = 0.5;   // ⏱ v1.2 實測:時段開始後約 0.5 秒才真正出聲
  const TAIL       = 0.3;   // ⏱ v1.2 實測:時段結束前約 0.3 秒講完

  //  開口起訖(秒)—— ⚠️ 四邊同步:面板 _speakSpan / kol-proxy _winOf / crew-director _speakSegOf
  function speakSpan(shotDesc) {
    const t = String(shotDesc || '');
    const re = /[((]\s*(\d{1,2})\s*[-–~]\s*(\d{1,2})\s*秒?\s*[))]([^((]*)/g;
    let m, a = null, z = null;
    while ((m = re.exec(t)) !== null) {
      if (/(?<![從自])開口(?![處部朝邊側捏拿取夾伸抽])|說|講|聊|問|答|唸|念/.test(m[3])) {
        const s0 = Number(m[1]), e0 = Number(m[2]);
        if (e0 > s0) { if (a === null || s0 < a) a = s0; if (z === null || e0 > z) z = e0; }
      }
    }
    return a === null ? null : [a, z];
  }

  //  計字:標點不算字,但算半個字的停頓時間
  function weight(s) {
    const txt = s.replace(/[\s,，、。.!！?？;；:：…~～「」『』"“”]/g, '');
    const pun = (s.match(/[,，、。.!！?？;；…]/g) || []).length;
    return txt.length + pun * 0.5;
  }
  function visLen(s) { return s.replace(/\s/g, '').length; }

  //  字幕行的顯示文字:拿掉引號、行尾逗號句號頓號(？！保留)
  function clean(s) {
    return String(s || '')
      .replace(/[「」『』"“”]/g, '')
      .replace(/^[\s,，、。.;；:：]+/, '')
      .replace(/[\s,，、。.;；:：]+$/, '')
      .replace(/[,，、。;；]+/g, ' ')   // 行內標點改空格(台灣字幕慣例)
      .replace(/\s+/g, ' ')
      .trim();
  }

  //  一句台詞 → 字幕行
  function splitLines(dialogue) {
    const src = String(dialogue || '').replace(/[「」『』"“”]/g, '').trim();
    if (!src) return [];
    //  ① 照標點切成片段(標點留在片段尾巴,用來算停頓)
    let pieces = src.split(/(?<=[,，、。.!！?？;；…~～])/).map(s => s.trim()).filter(Boolean);
    //  ② 超過一行的片段 → 平均切開(不在最後剩一兩個字)
    const out = [];
    pieces.forEach(p => {
      const n = visLen(clean(p));
      if (n <= MAX_LINE) { out.push(p); return; }
      const chars = Array.from(p);
      const k = Math.ceil(n / MAX_LINE), size = Math.ceil(chars.length / k);
      for (let i = 0; i < chars.length; i += size) out.push(chars.slice(i, i + size).join(''));
    });
    //  ③ 太短的片段往後併(併完不超過一行)
    const lines = [];
    out.forEach(p => {
      const last = lines[lines.length - 1];
      if (last !== undefined && visLen(clean(last)) < MIN_PIECE
          && visLen(clean(last)) + visLen(clean(p)) + 1 <= MAX_LINE) {
        lines[lines.length - 1] = last + p;
      } else lines.push(p);
    });
    //  最後一行太短 → 併回前一行
    if (lines.length > 1 && visLen(clean(lines[lines.length - 1])) < MIN_PIECE
        && visLen(clean(lines[lines.length - 2])) + visLen(clean(lines[lines.length - 1])) + 1 <= MAX_LINE) {
      lines[lines.length - 2] += lines.pop();
    }
    return lines;
  }

  //  所有段落 → 字幕 cue(v1.3:每個 cue 帶 beat 編號,對聲音時要用)
  function buildCues(beats, durations) {
    const cues = [];
    buildCues._wins = [];
    let offset = 0;
    (beats || []).forEach((b, i) => {
      const segDur = Number(durations && durations[i]) || Number(b && b.seconds) || 15;
      const dia = String((b && b.dialogue) || '').trim();
      if (dia) {
        const sp = speakSpan(b.shotDesc);
        //  v1.6:卡片寫 15 秒、實際出 10 秒 → 分鏡的時段照比例縮
        const cardSec = Number(b && b.seconds) || segDur;
        const k = (cardSec > 0 && Math.abs(cardSec - segDur) > 0.5) ? segDur / cardSec : 1;
        let s0 = sp ? Math.min(sp[0] * k, segDur) : 0;
        let s1 = sp ? Math.min(sp[1] * k, segDur) : segDur;
        if (s1 - s0 < 1) { s0 = 0; s1 = segDur; }
        const lines = splitLines(dia);
        const totalW = lines.reduce((a, l) => a + weight(l), 0) || 1;
        //  ⏱ v1.2:塞滿開口視窗(起點 +0.5 秒出聲延遲、終點 -0.3 秒收尾),不再照語速算
        const a0 = Math.min(s0 + ONSET, s1 - 1), a1 = Math.max(a0 + 1, s1 - TAIL);
        const talk = a1 - a0;
        buildCues._wins.push({ beat: i, from: offset + s0, to: offset + s1, segStart: offset, segEnd: offset + segDur });
        let t = offset + a0;
        let seg = lines.map(l => {
          const d = talk * weight(l) / totalW;
          const c = { start: t, end: t + d, text: clean(l) };
          t += d; return c;
        });
        //  停留太短 → 跟下一行合併(時間相加,合併後 ≤16 字)
        for (let k = 0; k < seg.length - 1; k++) {
          const a = seg[k], n = seg[k + 1];
          if (a.end - a.start < MIN_HOLD && visLen(a.text) + visLen(n.text) + 1 <= MERGE_MAX) {
            seg.splice(k, 2, { start: a.start, end: n.end, text: a.text + ' ' + n.text });
            k--;
          }
        }
        //  最後一行還是太短 → 往後延(不超出這一段)
        const lastC = seg[seg.length - 1];
        if (lastC && lastC.end - lastC.start < MIN_HOLD) lastC.end = Math.min(offset + segDur, lastC.start + MIN_HOLD);
        seg.filter(c => c.text).forEach(c => { c.beat = i; c.w = weight(c.text); cues.push(c); });
      }
      offset += segDur;
    });
    return cues;
  }

  //  ═══ v1.3 聽聲音 ═══════════════════════════════════════════════
  //  energy:每 STEP 秒一格的人聲頻段音量(dB,已減掉最大值 → 0 是最大聲)
  const STEP = 0.05;
  const VOICED = -20;     // 比最大聲小 20 dB 以內算「在講話」
  const SNAP = 0.6;       // 換句點最多移動 ±0.6 秒去找停頓
  const PAUSE_DB = -25;   // 比最大聲小 25 dB 以上算安靜
  const PAUSE_MIN = 0.15; // 連續安靜 0.15 秒以上才算停頓
  function alignCues(cues, wins, energy) {
    if (!energy || !energy.length) return cues;
    const at = (t) => energy[Math.max(0, Math.min(energy.length - 1, Math.round(t / STEP)))];
    const out = [];
    wins.forEach(w => {
      const mine = cues.filter(c => c.beat === w.beat);
      if (!mine.length) return;
      //  ① 真正開始與講完:在開口時段(前後放寬一點)裡找第一個/最後一個在講話的格子
      let st = null, en = null;
      for (let t = Math.max(w.segStart, w.from - 2); t <= Math.min(w.segEnd, w.to + 0.2); t += STEP) {   // v1.6 往前多找 2 秒
        if (at(t) > VOICED) { if (st === null) st = t; en = t + STEP; }
      }
      if (st === null || en - st < 1) { mine.forEach(c => out.push(c)); return; }   // 聽不到 → 用算的
      //  ② 照字數比例重排到真正講話的區間
      const tot = mine.reduce((a, c) => a + c.w, 0) || 1;
      let t = st;
      const seg = mine.map(c => { const d = (en - st) * c.w / tot; const r = { start: t, end: t + d, text: c.text }; t += d; return r; });
      //  ③ 換句點吸到附近【真正的停頓】:連續 ≥0.15 秒都很安靜才算(字跟字之間 0.1 秒的縫不算),
      //     挑離預測點最近的那個停頓,換句點放在停頓結束、下一句開口的那一刻。
      const pauses = [];
      for (let t = st, run = null; t <= en + STEP; t += STEP) {
        if (at(t) < PAUSE_DB) { if (run === null) run = t; }
        else if (run !== null) { if (t - run >= PAUSE_MIN) pauses.push({ a: run, b: t }); run = null; }
      }
      for (let pass = 0; pass < 2; pass++) for (let k = 0; k < seg.length - 1; k++) {   // 跑兩輪:前一個換句點移動後,後面的空間也會變
        const b = seg[k].end;
        let best = null;
        pauses.forEach(p => {
          const mid = (p.a + p.b) / 2;
          if (Math.abs(mid - b) > SNAP) return;
          if (p.b - seg[k].start < MIN_HOLD * 0.8 || seg[k + 1].end - p.b < MIN_HOLD * 0.8) return;   // 兩邊都要停留夠久(真停頓容許到 1 秒)
          if (!best || Math.abs(mid - b) < Math.abs((best.a + best.b) / 2 - b)) best = p;
        });
        if (best) { seg[k].end = best.b; seg[k + 1].start = best.b; }
      }
      seg.forEach(c => out.push(c));
    });
    return out;
  }
  //  ═══ v1.4 語音辨識對齊 ═══════════════════════════════════════════
  //  chunks:[{t:'文字', s:開始秒, e:結束秒}](Worker speech_timing 回傳)
  //  做法:我們的台詞 vs 辨識出的字,用「最長共同子序列」一個字一個字配對,
  //        配到的字就拿到時間;每句字幕 = 這句第一個配到的字 → 最後一個配到的字。
  const _PUNC = /[\s,，、。.!！?？;；:：…~～「」『』"“”'’()（）\-—]/;
  function alignByWords(cues, chunks) {
    if (!Array.isArray(chunks) || !chunks.length || !cues.length) return null;
    //  辨識結果攤成一個字一格,每格時間在所屬片段裡平均分
    const asr = [];
    chunks.forEach(c => {
      const ch = Array.from(String(c.t)).filter(x => !_PUNC.test(x));
      const d = Math.max(0.01, (c.e - c.s) / Math.max(1, ch.length));
      ch.forEach((x, i) => asr.push({ x: x, s: c.s + d * i, e: c.s + d * (i + 1) }));
    });
    //  我們的台詞攤成一個字一格,記住屬於哪一句
    const ours = [];
    cues.forEach((c, k) => Array.from(String(c.text)).forEach(x => { if (!_PUNC.test(x)) ours.push({ x: x, k: k }); }));
    const n = ours.length, m = asr.length;
    if (!n || !m || n * m > 2e6) return null;
    //  LCS 表
    const W = m + 1, L = new Uint16Array((n + 1) * W);
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
      L[i * W + j] = ours[i].x === asr[j].x ? L[(i + 1) * W + j + 1] + 1 : Math.max(L[(i + 1) * W + j], L[i * W + j + 1]);
    const hit = new Array(n).fill(null);
    for (let i = 0, j = 0; i < n && j < m;) {
      if (ours[i].x === asr[j].x) { hit[i] = asr[j]; i++; j++; }
      else if (L[(i + 1) * W + j] >= L[i * W + j + 1]) i++; else j++;
    }
    const matched = hit.filter(Boolean).length;
    //  配到的字太少(聽不清楚、背景太吵)→ 不採用,交給下一順位
    if (matched < Math.max(4, n * 0.4)) return null;
    //  每一句的時間 = 第一個配到的字 → 最後一個配到的字
    const span = cues.map(() => ({ s: null, e: null }));
    ours.forEach((o, i) => { const h = hit[i]; if (!h) return; const sp = span[o.k];
      if (sp.s === null || h.s < sp.s) sp.s = h.s; if (sp.e === null || h.e > sp.e) sp.e = h.e; });
    //  沒配到任何字的句子:夾在前後兩句中間
    for (let k = 0; k < span.length; k++) {
      if (span[k].s !== null) continue;
      let a = k - 1; while (a >= 0 && span[a].s === null) a--;
      let b = k + 1; while (b < span.length && span[b].s === null) b++;
      const from = a >= 0 ? span[a].e : (b < span.length ? span[b].s - 1.5 : 0);
      const to = b < span.length ? span[b].s : from + 1.5;
      span[k].s = from; span[k].e = Math.max(from + 0.5, to);
    }
    //  組字幕:字跟著嘴出來;停留到下一句開口(中間停很久就先收)
    const out = cues.map((c, k) => ({ start: Math.max(0, span[k].s - 0.05), end: span[k].e, text: c.text, beat: c.beat }));
    for (let k = 0; k < out.length; k++) {
      const nx = out[k + 1];
      if (nx && nx.start - out[k].end < 1.5) out[k].end = nx.start;
      else out[k].end = out[k].end + 0.3;
      if (out[k].end - out[k].start < 0.6) out[k].end = out[k].start + 0.6;
      if (nx && out[k].end > nx.start) out[k].end = nx.start;
    }
    out._matched = matched; out._total = n;
    return out;
  }

  //  🎧 v1.5 抓影片聲音(同一支只抓一次)→ AudioBuffer;失敗回 null
  const _audioCache = {};
  async function loadAudio(videoUrl) {
    if (_audioCache[videoUrl] !== undefined) return _audioCache[videoUrl];
    let out = null;
    try {
      const AC = root.OfflineAudioContext || root.webkitOfflineAudioContext;
      if (AC && root.fetch) {
        const res = await fetch(videoUrl, { mode: 'cors' });
        if (res.ok) {
          const buf = await res.arrayBuffer();
          out = await new AC(1, 1, 16000).decodeAudioData(buf);
        }
      }
    } catch (err) {
      try { console.warn('[KolSubtitle] 抓不到影片聲音:', err && err.message); } catch (_) {}
      out = null;
    }
    _audioCache[videoUrl] = out;
    return out;
  }
  //  把聲音轉成 16kHz 單聲道(可選擇只留人聲頻段)
  async function _render(audio, voiceBand) {
    const AC = root.OfflineAudioContext || root.webkitOfflineAudioContext;
    const sr = 16000, len = Math.ceil(audio.duration * sr);
    const ctx = new AC(1, len, sr);
    const src = ctx.createBufferSource(); src.buffer = audio;
    let node = src;
    if (voiceBand) {
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 250;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3500;
      src.connect(hp); hp.connect(lp); node = lp;
    }
    node.connect(ctx.destination); src.start();
    return (await ctx.startRendering()).getChannelData(0);
  }
  //  每 0.05 秒的人聲頻段音量(dB,0 = 最大聲)
  async function measureVoice(videoUrl) {
    try {
      const audio = await loadAudio(videoUrl);
      if (!audio) return null;
      const d = await _render(audio, true);
      const w = Math.round(16000 * STEP), e = [];
      for (let i = 0; i + w <= d.length; i += w) {
        let q = 0; for (let j = i; j < i + w; j++) q += d[j] * d[j];
        e.push(10 * Math.log10(q / w + 1e-12));
      }
      const mx = Math.max.apply(null, e);
      return e.map(v => v - mx);
    } catch (err) { return null; }
  }
  //  給語音辨識的聲音檔:16kHz 單聲道 16-bit WAV → data URI(10 秒約 300KB)
  async function audioDataUri(videoUrl) {
    try {
      const audio = await loadAudio(videoUrl);
      if (!audio) return '';
      const d = await _render(audio, false);
      const n = d.length, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
      const str = (o, t) => { for (let i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)); };
      str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
      v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
      v.setUint32(24, 16000, true); v.setUint32(28, 32000, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
      str(36, 'data'); v.setUint32(40, n * 2, true);
      for (let i = 0; i < n; i++) { const x = Math.max(-1, Math.min(1, d[i])); v.setInt16(44 + i * 2, x < 0 ? x * 0x8000 : x * 0x7fff, true); }
      const bytes = new Uint8Array(buf); let bin = '';
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      return 'data:audio/wav;base64,' + btoa(bin);
    } catch (err) { return ''; }
  }

  function ts(sec) {
    const ms = Math.max(0, Math.round(sec * 1000));
    const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60,
          s = Math.floor(ms / 1000) % 60, r = ms % 1000;
    const p = (n, w) => String(n).padStart(w, '0');
    return p(h, 2) + ':' + p(m, 2) + ':' + p(s, 2) + ',' + p(r, 3);
  }
  function toSRT(cues) {
    return (cues || []).map((c, i) =>
      (i + 1) + '\n' + ts(c.start) + ' --> ' + ts(c.end) + '\n' + c.text + '\n'
    ).join('\n');
  }

  //  下載 .srt(加 UTF-8 BOM,Windows 記事本與部分剪輯軟體才不會亂碼)
  function download(srt, name) {
    const blob = new Blob(['\uFEFF' + srt], { type: 'application/x-subrip;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (String(name || '影片').replace(/[\\/:*?"<>|\s]+/g, '_') || '影片') + '.srt';
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  //  點數:與 Worker v5.74 同一個公式(⚠️ 兩邊同步)—— 60 秒以內 100 點,之後每分鐘 100 點
  function costOf(sec) { return Math.max(100, Math.ceil(Math.max(1, Math.min(600, Number(sec) || 60)) / 60 * 100)); }

  //  成品區加一顆【加上字幕】。beats = 分鏡卡;plan = 接片計畫(取實際秒數);videoUrl = 成品網址
  //  ★ 白牌:畫面上只出現「加上字幕」「算力機」,不出現任何後端服務名。
  function attach(boxEl, o) {
    try {
      o = o || {};
      if (!boxEl || !o.videoUrl) return;
      const beats = o.beats || [];
      const durs = (o.plan || []).map(p => p && p.durationSec);
      const cues = buildCues(beats, durs);
      const wins = buildCues._wins.slice();
      if (!cues.length) return;   // 整支都沒台詞 → 不顯示按鈕
      const totalSec = durs.reduce((a, d) => a + (Number(d) || 0), 0) || 15;
      const cost = costOf(totalSec);

      const wrap = document.createElement('div');
      wrap.style.cssText = 'margin-top:10px;padding:10px 12px;border-radius:10px;border:1px solid #a78bfa33;background:#a78bfa0d;';
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:10px;flex-wrap:wrap;';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = '🔤 加上字幕(' + cost + ' 點)';
      btn.style.cssText = 'padding:8px 14px;border-radius:8px;border:none;background:#a78bfa;color:#fff;font-size:13px;font-weight:600;cursor:pointer;';
      const tip = document.createElement('span');
      tip.textContent = '繁體中文 · 共 ' + cues.length + ' 句 · 原片會保留';
      tip.style.cssText = 'color:#999;font-size:12px;';
      const out = document.createElement('div');
      out.style.cssText = 'margin-top:8px;font-size:13px;line-height:1.7;';
      row.appendChild(btn); row.appendChild(tip);
      wrap.appendChild(row); wrap.appendChild(out);
      boxEl.appendChild(wrap);

      btn.onclick = async function () {
        if (!confirm('加上繁體中文字幕,會扣 ' + cost + ' 點。\n原本沒有字幕的影片會保留。\n\n確定要加嗎?')) return;
        const S = root.KolStitch;
        if (!S || !S._api || !S.pollEpisode) { out.innerHTML = '<span style="color:#ff6b6b;">頁面還沒載入完成,請重新整理後再按一次。</span>'; return; }
        btn.disabled = true; btn.style.opacity = '0.5'; btn.style.cursor = 'default';
        btn.textContent = '字幕製作中…';
        const t0 = Date.now();
        const tick = setInterval(function () {
          out.innerHTML = '<span style="color:#a78bfa;">⏳ 字幕製作中,約 1-2 分鐘,請不要關閉這個頁面(已等 ' + Math.round((Date.now() - t0) / 1000) + ' 秒)</span>';
        }, 1000);
        try {
          //  🎧 v1.4:① 語音辨識 → ② 量音量 → ③ 都不行就不燒、不扣點(不准用猜的)
          let timed = null, how = '';
          try {
            const _ad = await audioDataUri(o.videoUrl);   // 🎧 v1.5 聲音直接遞過去(繞過 CDN 擋 403)
            const st = await S._api('speech_timing', { videoUrl: o.videoUrl, audioData: _ad || undefined, prompt: cues.map(c => c.text).join(',') });
            timed = alignByWords(cues, st && st.chunks);
            if (timed) how = '🎧 語音辨識(' + timed._matched + '/' + timed._total + ' 字對上)';
          } catch (e) { try { console.warn('[KolSubtitle] 語音辨識失敗,改量音量:', e && e.message); } catch (_) {} }
          if (!timed) {
            const energy = await measureVoice(o.videoUrl);
            if (energy) { timed = alignCues(cues, wins, energy); how = '🔊 量音量'; }
          }
          if (!timed) {
            clearInterval(tick);
            btn.disabled = false; btn.style.opacity = '1'; btn.style.cursor = 'pointer';
            btn.textContent = '🔤 加上字幕(' + cost + ' 點)';
            out.innerHTML = '<span style="color:#ffb3b3;">⚠️ 這支影片暫時聽不清楚台詞的時間,為了不讓字幕對不上,這次先不加。<b>沒有扣點</b>,請稍後再按一次。</span>';
            return;
          }
          const srt = toSRT(timed);
          try { console.log('[KolSubtitle] 時間來源:' + how); } catch (_) {}
          const sub = await S._api('subtitle_burn', {
            videoUrl: o.videoUrl, srt: srt, brandId: o.brandId || 'stitch', durationSec: totalSec,
          });
          const url = await S.pollEpisode(sub.requestId, o.brandId || 'stitch', null, sub.endpoint, 72);   // 5 秒 × 72 = 6 分鐘
          clearInterval(tick);
          btn.textContent = '✅ 字幕已加上';
          out.innerHTML = '<div style="color:#8fd694;margin-bottom:6px;">✅ 有字幕的版本做好了(原片在上面,兩支都可以下載)</div>'
            + '<video src="' + url + '" controls playsinline style="width:100%;border-radius:10px;background:#000;"></video>'
            + '<div style="margin-top:6px;"><a href="' + url + '" target="_blank" style="color:#a78bfa;font-size:12px;">↗ 開新分頁 / 下載有字幕版</a></div>';
        } catch (e) {
          clearInterval(tick);
          const m = String((e && e.message) || '');
          btn.disabled = false; btn.style.opacity = '1'; btn.style.cursor = 'pointer';
          btn.textContent = '🔤 加上字幕(' + cost + ' 點)';
          if (/INSUFFICIENT|點數不足|Bits 不足/i.test(m)) { out.innerHTML = ''; return; }   // 點數不足的視窗由全站攔截器負責
          if (/沒有台詞/.test(m)) { out.innerHTML = '<span style="color:#ffb3b3;">這支影片沒有台詞,不需要加字幕。</span>'; return; }
          out.innerHTML = '<span style="color:#ff6b6b;">⚠️ 字幕沒有加上:算力機目前滿載。<b>本次點數已自動退還</b>,請稍後再按一次。</span>';
          try { console.warn('[KolSubtitle] 加字幕失敗:', m); } catch (_) {}
        }
      };
    } catch (e) {
      try { console.warn('[KolSubtitle] 字幕按鈕略過(不影響影片):', e); } catch (_) {}
    }
  }

  const api = { buildCues, toSRT, splitLines, speakSpan, download, attach, costOf, alignCues, alignByWords, measureVoice, audioDataUri, version: 'v1.6' };
  root.KolSubtitle = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  try { console.log('[KolSubtitle] v1.6 就緒 · ⏱卡片秒數≠實際秒數時照比例縮放+往前多找2秒 · v1.5 🎧聲音由瀏覽器直接遞給語音辨識(繞過CDN 403) · v1.4 🎧語音辨識對每個字的時間(字用自己的台詞)→ 備援量音量 → 都不行就不燒不扣點 · v1.3 🎧聽影片聲音對時間(字用自己的台詞·抓不到聲音退回推算) · v1.2 ⏱時間軸塞滿開口視窗(實測誤差0.1秒) · v1.1 🔤 成品下方【加上字幕】→ Worker subtitle_burn 燒進 MP4(扣點·原片保留) · v1.0 台詞+開口秒數 → 時間軸(一行≤15字·停留≥1.2秒·四邊同步 _speakSpan)'); } catch (_) {}
})(typeof window !== 'undefined' ? window : globalThis);
