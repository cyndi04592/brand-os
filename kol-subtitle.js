/* ═══════════════════════════════════════════════════════════════════════
   🎬 kol-subtitle.js v1.0(2026-09-19)自動字幕核心
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
     KolSubtitle.attach(boxEl, { beats, plan, name })
       → 在播放器下方加一顆「⬇ 下載字幕檔」
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

  //  所有段落 → 字幕 cue
  function buildCues(beats, durations) {
    const cues = [];
    let offset = 0;
    (beats || []).forEach((b, i) => {
      const segDur = Number(durations && durations[i]) || Number(b && b.seconds) || 15;
      const dia = String((b && b.dialogue) || '').trim();
      if (dia) {
        const sp = speakSpan(b.shotDesc);
        let s0 = sp ? Math.min(sp[0], segDur) : 0;
        let s1 = sp ? Math.min(sp[1], segDur) : segDur;
        if (s1 - s0 < 1) { s0 = 0; s1 = segDur; }
        const lines = splitLines(dia);
        const totalW = lines.reduce((a, l) => a + weight(l), 0) || 1;
        const talk = Math.min(s1 - s0, Math.max(totalW / SPEAK_RATE, lines.length * MIN_HOLD));
        let t = offset + s0;
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
        seg.filter(c => c.text).forEach(c => cues.push(c));
      }
      offset += segDur;
    });
    return cues;
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

  //  成品區加一顆按鈕。beats = 分鏡卡;plan = 接片計畫(取實際秒數)
  function attach(boxEl, o) {
    try {
      o = o || {};
      if (!boxEl) return;
      const beats = o.beats || [];
      const durs = (o.plan || []).map(p => p && p.durationSec);
      const cues = buildCues(beats, durs);
      if (!cues.length) return;   // 整支都沒台詞 → 不顯示按鈕
      const srt = toSRT(cues);
      const wrap = document.createElement('div');
      wrap.style.cssText = 'margin-top:8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = '⬇ 下載字幕檔(.srt)';
      btn.style.cssText = 'padding:6px 12px;border-radius:8px;border:1px solid #a78bfa66;background:transparent;color:#a78bfa;font-size:12px;cursor:pointer;';
      btn.onclick = () => download(srt, o.name);
      const tip = document.createElement('span');
      tip.textContent = '共 ' + cues.length + ' 句 · 可匯入剪映、CapCut、Premiere';
      tip.style.cssText = 'color:#888;font-size:11px;';
      wrap.appendChild(btn); wrap.appendChild(tip);
      boxEl.appendChild(wrap);
    } catch (e) {
      try { console.warn('[KolSubtitle] 字幕按鈕略過(不影響影片):', e); } catch (_) {}
    }
  }

  const api = { buildCues, toSRT, splitLines, speakSpan, download, attach, version: 'v1.0' };
  root.KolSubtitle = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  try { console.log('[KolSubtitle] v1.0 就緒 · 🎬 台詞+開口秒數 → .srt(一行≤15字·停留≥1.2秒·四邊同步 _speakSpan)'); } catch (_) {}
})(typeof window !== 'undefined' ? window : globalThis);
