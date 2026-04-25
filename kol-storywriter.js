// ════════════════════════════════════════════════════════════════════
//  kol-storywriter.js · v5.12
//  
//  📖 編劇 — 故事弧、情緒基調、劇情遊戲化
//  
//  職責:
//   • 管理故事弧(storyArc = theme / tone / productHint)
//   • 單集故事情境(situation)
//   • 未來:連載劇情記憶、集與集之間的連貫
//  
//  v5.12 狀態:把 kol.html 的 storyArc + episode.situation 組裝搬過來
//  下一版(v5.13):跨集劇情記憶(上集她說了什麼,這集自然銜接)
// ════════════════════════════════════════════════════════════════════

(function () {
  'use strict';

  /**
   * 產出故事段落
   */
  function contribute(ctx) {
    const parts = [];

    // 故事弧(theme / tone / product hint)
    const arc = ctx.storyArc || {};
    const arcParts = [];
    if (arc.tone) arcParts.push('emotional tone: ' + arc.tone);
    if (arc.theme) arcParts.push('content theme: ' + arc.theme);
    if (arc.productHint) arcParts.push('subtle product emphasis: ' + arc.productHint);
    if (arcParts.length > 0) {
      parts.push(arcParts.join(', ') + ', no explicit brand name mentioned, natural lifestyle integration');
    }

    // 單集情境
    if (ctx.episode?.situation) {
      parts.push('scene context: ' + ctx.episode.situation);
    }

    // natural 模式風格提示
    if (ctx.episode?.portraitMode === 'natural') {
      parts.push('IMPORTANT: generate this scene purely from text description, do not anchor to any reference face, let the imagination flow freely for maximum naturalism, authentic imperfect human presence, slight asymmetry in facial features is welcomed');
    }

    return parts.join('. ');
  }

  /**
   * 多鏡頭故事拆分(v5.13 計畫)
   * 15 秒影片拆成 3 個 shot,每 shot 有自己的故事節拍
   */
  function splitForMultiShot(situation, duration) {
    // TODO: 未來用 AI 把一個 situation 拆成 3 個 5 秒 shot
    return null;
  }

  // ─── 導出 + 自動向總導演註冊 ─────────────────────────
  window.KolStorywriter = {
    contribute,
    splitForMultiShot,
  };

  if (window.CrewDirector?.register) {
    window.CrewDirector.register('storywriter', window.KolStorywriter);
  }

  console.log('[KolStorywriter] 📖 v5.12 就緒');
})();
