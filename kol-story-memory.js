// ════════════════════════════════════════════════════════════════════
//  kol-story-memory.js · v5.13
//  
//  KOL 劇情記憶模組(從 kol.html v5.10 抽出)
//  
//  v5.13 修正(都在 runVideoGeneration):
//   • 🆕 臉走乾淨管線 resolveKolImageUrl → 杜絕烤肉紋(原本直餵 HeyGen WEBP)
//   • 🆕 payload 帶 seed → 讀 ep-seed-toggle(鎖定每段畫面一致性)
//  
//  職責:
//   • 日曆主題 → 單集企劃自動對應
//   • Episodes / Calendar 的 GAS API wrapper
//   • 日曆 UI 渲染 + 點擊處理
//   • KOL 劇情記憶佇列 UI
//   • Episode 生成三拆按鈕(影片 / 貼文 / 全套)
//   • Episode 影片 polling + 狀態回寫
//  
//  依賴(kol.html 提供):
//   • 全域:S, PASSWORD, GAS_URL, WORKER
//   • 函式:api, gasPost, toast, escapeHtml, composeSeedancePrompt,
//          generateSocialPosts, renderEpisodeCard, renderEpisodeTask,
//          getCurrentRotationProduct, saveEpisodeDraft, resolveKolImageUrl,
//          getScenesForBrand (window 級),SCENE_LIBRARY (window 級)
// ════════════════════════════════════════════════════════════════════

(function () {
  'use strict';

  // 📋 日曆主題 → 單集企劃自動對應
  const CALENDAR_TOPIC_MAP = {
    '咖啡廳午後':  { sceneId: 'cafe_afternoon',  storyFrame: 'daily vlog slice of life', tone: 'warm and gentle' },
    '下班放鬆':    { sceneId: 'home_unboxing',   storyFrame: 'cozy after-work unwinding', tone: 'tired but content' },
    '工作抱怨':    { sceneId: 'urban_night',      storyFrame: 'casual complaint about work stress', tone: 'witty and slightly sarcastic' },
    '週五戶外':    { sceneId: 'outdoor_garden',  storyFrame: 'travel journal vlog', tone: 'excited and energetic' },
    '週末讀書':    { sceneId: 'cafe_afternoon',  storyFrame: 'weekend self-care ritual', tone: 'nostalgic and soft' },
    '早餐分享':    { sceneId: 'kitchen_morning',  storyFrame: 'daily vlog slice of life', tone: 'relaxed and playful' },
    'me-time':     { sceneId: 'home_unboxing',   storyFrame: 'weekend self-care ritual', tone: 'warm and gentle' },
    '安靜獨處':    { sceneId: 'home_unboxing',   storyFrame: 'quiet reflection moment', tone: 'nostalgic and soft' },
    '穿搭分享':    { sceneId: 'urban_night',      storyFrame: 'fashion outfit sharing', tone: 'confident and independent' },
    '媽媽經':      { sceneId: 'kitchen_morning',  storyFrame: 'motherhood daily struggle and joy', tone: 'tired but content' },
  };

  // ─── Episode / Calendar API wrappers ────────────────────────────────
  async function apiListEpisodes(brandId, kolId, limit) {
    const qs = new URLSearchParams({
      action: 'listEpisodes',
      password: PASSWORD,
      brandId: brandId || '',
      kolId: kolId || '',
      limit: String(limit || 20),
    }).toString();
    const r = await fetch(`${GAS_URL}?${qs}`);
    return r.json();
  }

  async function apiSaveEpisode(data) {
    return await gasPost('saveEpisode', { data });
  }

  async function apiUpdateEpisodeStatus(id, fields) {
    return await gasPost('updateEpisodeStatus', { id, fields });
  }

  async function apiListCalendar(brandId, kolId, year, month) {
    const qs = new URLSearchParams({
      action: 'listCalendar',
      password: PASSWORD,
      brandId: brandId || '',
      kolId: kolId || '',
      year: String(year),
      month: String(month),
    }).toString();
    const r = await fetch(`${GAS_URL}?${qs}`);
    return r.json();
  }

  async function apiSaveCalendar(data) {
    return await gasPost('saveCalendar', { data });
  }

  async function apiDeleteCalendar(id) {
    return await gasPost('deleteCalendar', { id });
  }

  // ─── 日期標準化工具 ───────────────────────────────────────────
  function normalizeDate(d) {
    if (!d) return '';
    if (typeof d === 'string') return d.slice(0, 10);
    if (d instanceof Date) {
      const yy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yy}-${mm}-${dd}`;
    }
    return '';
  }

  // ─── Calendar 渲染 ────────────────────────────────────────────
  async function renderSystemCalendar() {
    const wrap = document.getElementById('system-calendar-wrap');
    if (!wrap) return;

    const persona = S.personas.find(x => x.persona_id === window.systemSelectedPersonaId);
    if (!persona || !S.currentBrandId) {
      wrap.innerHTML = '<div class="kol-empty" style="padding:16px">選 KOL 以載入日曆…</div>';
      return;
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const monthLabel = ['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月'][month - 1];

    wrap.innerHTML = `
      <div class="panel-title">
        <div class="dot" style="background:var(--accent)"></div>
        📅 本月內容日曆 · ${year} ${monthLabel}
        <span class="chip green" style="margin-left:auto">🟢 真資料</span>
      </div>
      <div class="calendar-hint">點任一天 → 自動填入右側單集企劃 · 可排規劃或追溯紀錄</div>
      <div id="system-calendar-grid" class="calendar-grid">
        <div class="kol-empty" style="grid-column:1/-1;padding:20px"><span class="spin">⏳</span> 載入中…</div>
      </div>
      <div class="cal-legend">
        <span><span class="dot" style="background:var(--accent3)"></span>已生成</span>
        <span><span class="dot" style="background:var(--accent)"></span>已規劃</span>
        <span><span class="dot" style="background:#ffa94d"></span>今日</span>
        <span><span class="dot" style="background:rgba(255,255,255,.2)"></span>空白可點</span>
      </div>
    `;

    try {
      const [calRes, epRes] = await Promise.all([
        apiListCalendar(S.currentBrandId, persona.persona_id, year, month),
        apiListEpisodes(S.currentBrandId, persona.persona_id, 60),
      ]);

      if (!calRes.ok) throw new Error(calRes.error || 'Calendar 讀取失敗');

      const entries = calRes.entries || [];
      const episodes = epRes.ok ? (epRes.episodes || []) : [];

      const byDate = {};
      for (const e of entries) {
        const dateKey = normalizeDate(e.scheduled_date);
        if (dateKey) byDate[dateKey] = e;
      }

      const epsByDate = {};
      for (const e of episodes) {
        if (e.video_status === 'done' && e.calendar_date) {
          const dateKey = normalizeDate(e.calendar_date);
          if (dateKey) {
            epsByDate[dateKey] = epsByDate[dateKey] || [];
            epsByDate[dateKey].push(e);
          }
        }
      }

      renderCalendarCells(year, month, byDate, epsByDate);
      S._calendarByDate = byDate;
      S._episodesByDate = epsByDate;
    } catch (e) {
      const grid = document.getElementById('system-calendar-grid');
      if (grid) grid.innerHTML = `<div class="kol-empty" style="grid-column:1/-1;padding:20px;color:var(--accent2)">❌ ${escapeHtml(e.message)}</div>`;
    }
  }

  function renderCalendarCells(year, month, byDate, epsByDate) {
    const grid = document.getElementById('system-calendar-grid');
    if (!grid) return;

    const firstOfMonth = new Date(year, month - 1, 1);
    const lastOfMonth = new Date(year, month, 0);
    const today = new Date();
    const todayKey = normalizeDate(today);

    let html = '';
    ['日','一','二','三','四','五','六'].forEach(d => {
      html += `<div class="cal-cell head">${d}</div>`;
    });

    const startPad = firstOfMonth.getDay();
    for (let i = 0; i < startPad; i++) {
      html += `<div class="cal-cell" style="opacity:.2"></div>`;
    }

    for (let day = 1; day <= lastOfMonth.getDate(); day++) {
      const dateKey = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
      const entry = byDate[dateKey];
      const eps = epsByDate[dateKey] || [];
      const isToday = dateKey === todayKey;
      const isPast = new Date(dateKey) < new Date(todayKey);
      const isPosted = eps.length > 0;

      const classes = ['cal-cell', 'clickable'];
      if (isToday) classes.push('today');
      if (isPast && !isPosted && !entry) classes.push('past');
      if (isPosted) classes.push('past', 'posted');
      if (entry && !isPosted) classes.push('planned');

      let eventHtml = '';
      if (isPosted) {
        eventHtml = `<span class="ev">✅ ${escapeHtml(eps[0].calendar_topic || '已發布')}</span>`;
      } else if (entry) {
        const prefix = isToday ? '⏳' : '📍';
        eventHtml = `<span class="ev">${prefix} ${escapeHtml(entry.calendar_topic || '已排程')}</span>`;
      }

      const dayLabel = isToday ? `${day} · 今天` : String(day);

      html += `<div class="${classes.join(' ')}" data-date="${dateKey}" data-has-entry="${!!entry}" data-has-episode="${isPosted}">
        <span class="n">${dayLabel}</span>
        ${eventHtml}
      </div>`;
    }

    grid.innerHTML = html;

    grid.removeEventListener('click', handleCalendarCellClick);
    grid.addEventListener('click', handleCalendarCellClick);
  }

  function handleCalendarCellClick(e) {
    const cell = e.target.closest('.cal-cell.clickable');
    if (!cell) return;
    const dateKey = cell.dataset.date;
    if (!dateKey) return;

    const eps = S._episodesByDate?.[dateKey] || [];
    if (eps.length > 0) {
      showPastEpisode(eps[0]);
      return;
    }

    const entry = S._calendarByDate?.[dateKey];
    const topic = entry?.calendar_topic || '';
    const mapping = topic ? CALENDAR_TOPIC_MAP[topic] : null;

    applyCalendarToEpisode(dateKey, topic, entry, mapping);
  }

  function applyCalendarToEpisode(dateKey, topic, entry, mapping) {
    renderEpisodeCard();
    setTimeout(() => {
      const sitEl = document.getElementById('ep-situation');
      if (sitEl && !sitEl.value.trim() && topic) {
        sitEl.placeholder = `今天是「${topic}」…(點 AI 幫我寫,或自己發揮)`;
      }

      const sceneEl = document.getElementById('ep-scene');
      if (sceneEl && mapping?.sceneId) {
        const opt = Array.from(sceneEl.options).find(o => o.value === mapping.sceneId);
        if (opt) sceneEl.value = mapping.sceneId;
      }

      const toneEl = document.getElementById('ep-tone');
      if (toneEl && mapping?.tone) {
        const opt = Array.from(toneEl.options).find(o => o.value === mapping.tone);
        if (opt) toneEl.value = mapping.tone;
      }

      S._pendingCalendarDate = dateKey;
      S._pendingCalendarTopic = topic || '';

      const epCard = document.getElementById('system-episode-card');
      if (epCard) epCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

      toast(`📅 已套用 ${dateKey}${topic ? ' · ' + topic : ''}`, 'success');

      if (!entry && dateKey && S.currentBrandId && window.systemSelectedPersonaId) {
        apiSaveCalendar({
          brandId: S.currentBrandId,
          kolId: window.systemSelectedPersonaId,
          scheduled_date: dateKey,
          calendar_topic: topic || '',
          story_frame: mapping?.storyFrame || '',
          emotion_hint: mapping?.tone || '',
          status: 'planned',
          auto_generated: false,
        }).catch(() => {});
      }
    }, 50);
  }

  function showPastEpisode(ep) {
    const info = `📅 ${ep.calendar_date || '-'}\n主題:${ep.calendar_topic || '-'}\n場景:${ep.scene_id || '-'}\n狀態:${ep.video_status}\n\n故事:${(ep.scenario || '無').slice(0, 100)}`;
    if (ep.video_url) {
      if (confirm(info + '\n\n要開啟影片嗎?')) {
        window.open(ep.video_url, '_blank');
      }
    } else {
      alert(info);
    }
  }

  // ─── Queue 渲染(KOL 劇情記憶)────────────────────────────────
  async function renderSystemQueue() {
    const wrap = document.getElementById('system-queue-wrap');
    if (!wrap) return;

    const persona = S.personas.find(x => x.persona_id === window.systemSelectedPersonaId);
    if (!persona || !S.currentBrandId) {
      wrap.innerHTML = '<div class="kol-empty" style="padding:16px">選 KOL 以載入歷程…</div>';
      return;
    }

    wrap.innerHTML = `
      <div class="panel-title">
        <div class="dot" style="background:var(--accent3)"></div>
        🎬 KOL 劇情記憶 · 最近 20 集
        <span class="chip green" style="margin-left:auto">🟢 真 Episodes</span>
      </div>
      <div id="system-queue-list" class="queue-list">
        <div class="kol-empty" style="padding:20px"><span class="spin">⏳</span> 讀取中…</div>
      </div>
    `;

    try {
      const res = await apiListEpisodes(S.currentBrandId, persona.persona_id, 20);
      if (!res.ok) throw new Error(res.error || '讀取失敗');

      const eps = res.episodes || [];
      const listEl = document.getElementById('system-queue-list');

      if (eps.length === 0) {
        listEl.innerHTML = `
          <div class="kol-empty" style="padding:24px 16px">
            <span class="emoji">📖</span>
            還沒有任何集數<br>
            <small>生成第一支影片後,這裡就會變成 KOL 的劇情連載</small>
          </div>
        `;
        return;
      }

      listEl.innerHTML = eps.map(ep => {
        const statusIcon = ep.video_status === 'done' ? '✓' :
                          ep.video_status === 'generating' ? '⏳' :
                          ep.video_status === 'failed' ? '❌' : '📋';
        const statusClass = ep.video_status === 'done' ? 'queue-done' :
                           ep.video_status === 'failed' ? 'queue-failed' :
                           ep.video_status === 'generating' ? 'queue-progress' : 'queue-pending';
        const statusChip = ep.video_status === 'done' ? '<span class="chip green">已生成</span>' :
                          ep.video_status === 'failed' ? '<span class="chip" style="background:rgba(250,109,155,.15);color:var(--accent2)">失敗</span>' :
                          ep.video_status === 'generating' ? '<span class="chip">生成中</span>' :
                          '<span class="chip">草稿</span>';

        const dateShort = ep.calendar_date ? String(ep.calendar_date).slice(5, 10).replace('-', '/') : '—';
        const epScenes = (typeof window.getScenesForBrand === 'function')
          ? window.getScenesForBrand(ep.brandId)
          : (window.SCENE_LIBRARY?.[ep.brandId] || {});
        const sceneLabel = epScenes[ep.scene_id]?.label || ep.scene_id || '未分類';

        return `
          <div class="queue-item" data-episode-id="${escapeHtml(ep.id)}" style="cursor:pointer">
            <div class="queue-status ${statusClass}">${statusIcon}</div>
            <div class="queue-info">
              <strong>${escapeHtml(dateShort)} · ${escapeHtml(ep.calendar_topic || ep.story_frame || '未命名集')}</strong>
              <small>${escapeHtml(sceneLabel)} · ${ep.duration || 10}s</small>
            </div>
            ${statusChip}
          </div>
        `;
      }).join('');

      listEl.querySelectorAll('.queue-item').forEach(item => {
        item.addEventListener('click', () => {
          const epId = item.dataset.episodeId;
          const ep = eps.find(e => e.id === epId);
          if (ep) showPastEpisode(ep);
        });
      });

      listEl.insertAdjacentHTML('beforeend', `
        <div class="queue-footer">
          <span class="queue-cost">累計 ${eps.length} 集</span>
        </div>
      `);
    } catch (e) {
      const listEl = document.getElementById('system-queue-list');
      if (listEl) listEl.innerHTML = `<div class="kol-empty" style="padding:20px;color:var(--accent2)">❌ ${escapeHtml(e.message)}</div>`;
    }
  }

  // ─── 生成 Episode · 三拆按鈕(video / posts / all)─────────
  async function generateEpisodeV510(mode) {
    mode = mode || 'all';

    const persona = S.personas.find(x => x.persona_id === window.systemSelectedPersonaId);
    if (!persona) { toast('請先選 KOL', 'error'); return; }

    const situation = document.getElementById('ep-situation')?.value?.trim() || '';
    const sceneId = document.getElementById('ep-scene')?.value || '';
    const movementId = document.getElementById('ep-movement')?.value || 'static';
    const tone = document.getElementById('ep-tone')?.value || '';

    if (mode !== 'posts' && !sceneId) { toast('請選場景', 'error'); return; }
    if (!situation && mode !== 'posts') {
      if (!confirm('你沒填「故事情境」,AI 會只依 KOL 人設生成泛用 vlog。要繼續嗎?')) return;
    }

    saveEpisodeDraft(true);

    const product = getCurrentRotationProduct();
    const productImageUrls = [...(S.episodeProductUrls || [])];

    if (mode !== 'posts' && productImageUrls.length === 0) {
      const ok = confirm('⚠️ 你沒選商品照,Seedance 會腦補商品(跟真實差很多)。\n\n建議先選 1-3 張官方商品照。\n\n還是要繼續?');
      if (!ok) return;
    }

    const now = new Date();
    const calendarDate = S._pendingCalendarDate || normalizeDate(now);
    const calendarTopic = S._pendingCalendarTopic || '';

    const episodeData = {
      brandId: S.currentBrandId,
      kolId: persona.persona_id,
      calendar_date: calendarDate,
      calendar_topic: calendarTopic,
      scene_id: sceneId,
      story_frame: document.getElementById('ep-scene')?.selectedOptions?.[0]?.text || '',
      emotion: tone,
      product_name: product?.name || '',
      camera_movement: movementId,
      scenario: situation,
      reference_images: productImageUrls,
      duration: 10,
      aspect: '9:16',
      quality: 'fast',
      resolution: '720p',
      video_status: mode === 'posts' ? 'skipped' : 'planned',
      posts_status: mode === 'video' ? 'skipped' : 'pending',
    };

    let episodeId = null;
    try {
      const saved = await apiSaveEpisode(episodeData);
      if (saved.ok) episodeId = saved.id;
    } catch (e) {
      console.error('saveEpisode 失敗(不阻塞):', e);
    }

    const tasks = [];
    if (mode === 'video' || mode === 'all') {
      tasks.push(runVideoGeneration(persona, product, sceneId, movementId, tone, situation, productImageUrls, episodeId));
    }
    if (mode === 'posts' || mode === 'all') {
      tasks.push(runPostsGeneration(persona, product, situation, sceneId, movementId, tone, episodeId));
    }

    await Promise.allSettled(tasks);

    renderSystemCalendar();
    renderSystemQueue();
  }

  async function runVideoGeneration(persona, product, sceneId, movementId, tone, situation, productImageUrls, episodeId) {
    if (!persona.talking_photo_id) {
      toast('KOL 尚未綁定 HeyGen 照片,無法生成影片', 'error');
      return;
    }

    let kolImageUrl = '';
    try {
      const res = await api('heygen_list_group_avatars', { group_id: persona.talking_photo_id });
      kolImageUrl = res?.avatars?.[0]?.image_url || '';
    } catch (_) {}
    if (!kolImageUrl) {
      toast('無法取得 KOL 肖像 URL', 'error');
      if (episodeId) apiUpdateEpisodeStatus(episodeId, { video_status: 'failed', notes: 'KOL 肖像 URL 取不到' });
      return;
    }

    const prevArc = { ...S.storyArc };
    S.storyArc = { ...S.storyArc, tone };
    const opts = {
      episode: {
        persona: {
          persona_name: persona.persona_name,
          background: persona.background,
          personality: persona.personality,
          speaking_style: persona.speaking_style,
          role_relationship: persona.role_relationship,
          signature_topics: persona.signature_topics,
          taboo_words: persona.taboo_words,
          forbidden_topics: persona.forbidden_topics,
        },
        product,
        situation,
      },
    };
    const prompt = composeSeedancePrompt(S.currentBrandId, sceneId, 'none', movementId, '10', opts);
    S.storyArc = prevArc;

    if (!prompt) { toast('組 prompt 失敗', 'error'); return; }

    if (episodeId) apiUpdateEpisodeStatus(episodeId, { video_status: 'generating', notes: '' }).catch(() => {});

    const taskBox = document.getElementById('system-episode-task');
    if (taskBox) taskBox.innerHTML = `<div class="seedance-task"><div class="seedance-task-info"><strong>⏳ 送出影片中…</strong></div></div>`;

    const payload = {
      kolImageUrl,
      productImageUrls,
      prompt,
      resolution: '720p',
      duration: '10',
      aspectRatio: '9:16',
      generateAudio: true,
      tier: 'fast',
      brandId: S.currentBrandId,
      kolName: persona.persona_name,
    };

    try {
      const res = await api('seedance_submit', payload);
      if (!res.ok) throw new Error(res.error);

      const task = {
        requestId: res.requestId,
        endpoint: res.endpoint,
        responseUrl: res.responseUrl,
        statusUrl: res.statusUrl,
        label: `${persona.persona_name} · 單集 · 10s`,
        status: 'IN_QUEUE',
        created: new Date().toLocaleTimeString('zh-TW'),
        startTime: Date.now(),
        url: null,
        episodeId,
      };
      renderEpisodeTask(task);
      toast('🎬 影片送出,約 1-2 分鐘', 'success');
      pollEpisodeTaskV510(task);
    } catch (e) {
      if (taskBox) taskBox.innerHTML = `<div class="seedance-task"><div class="seedance-task-info"><strong style="color:var(--accent2)">❌ ${escapeHtml(e.message)}</strong></div></div>`;
      toast('影片提交失敗:' + e.message, 'error');
      if (episodeId) apiUpdateEpisodeStatus(episodeId, { video_status: 'failed', notes: e.message });
    }
  }

  async function pollEpisodeTaskV510(task) {
    let count = 0;
    const t = setInterval(async () => {
      if (++count > 150) {
        clearInterval(t);
        task.status = 'FAILED';
        task.error = 'Timeout (5min)';
        renderEpisodeTask(task);
        if (task.episodeId) apiUpdateEpisodeStatus(task.episodeId, { video_status: 'failed', notes: 'Timeout' });
        return;
      }
      try {
        const res = await api('fal_poll', {
          requestId: task.requestId,
          endpoint: task.endpoint,
          responseUrl: task.responseUrl,
          statusUrl: task.statusUrl,
        });
        if (res.status === 'FAILED') {
          clearInterval(t);
          task.status = 'FAILED';
          task.error = res.error || '任務失敗';
          renderEpisodeTask(task);
          if (task.episodeId) apiUpdateEpisodeStatus(task.episodeId, { video_status: 'failed', notes: task.error });
          toast('生成失敗:' + task.error, 'error');
          return;
        }
        task.status = res.status;
        if (res.status === 'COMPLETED') {
          clearInterval(t);
          task.url = res.videoUrl;
          task.elapsed = Math.round((Date.now() - task.startTime) / 1000);
          renderEpisodeTask(task);

          if (task.episodeId) {
            apiUpdateEpisodeStatus(task.episodeId, {
              video_status: 'done',
              video_url: res.videoUrl,
              video_cost_usd: 1.21,
              fal_request_id: task.requestId,
              video_elapsed_sec: task.elapsed,
            }).catch(() => {});
          }

          toast('🎉 影片完成', 'success');
          setTimeout(() => renderSystemQueue(), 500);
        } else {
          renderEpisodeTask(task);
        }
      } catch (e) { console.warn('poll error', e); }
    }, 2000);
  }

  async function runPostsGeneration(persona, product, situation, sceneId, movementId, tone, episodeId) {
    const ctx = { persona, product, situation, sceneId, movementId, tone };
    try {
      await generateSocialPosts(ctx);

      const igText = document.getElementById('social-ig-text')?.value || '';
      const threadsText = document.getElementById('social-threads-text')?.value || '';
      const fbText = document.getElementById('social-fb-text')?.value || '';

      if (episodeId) {
        apiUpdateEpisodeStatus(episodeId, {
          posts_status: 'done',
          post_ig: igText,
          post_threads: threadsText,
          post_fb: fbText,
          posts_cost_usd: 0.006,
        }).catch(() => {});
      }
    } catch (e) {
      if (episodeId) apiUpdateEpisodeStatus(episodeId, { posts_status: 'failed', notes: e.message });
    }
  }

  // ─── 導出到 window(kol.html 還在用這些全域函式)────────
  window.StoryMemory = {
    CALENDAR_TOPIC_MAP,
    normalizeDate,
    apiListEpisodes,
    apiSaveEpisode,
    apiUpdateEpisodeStatus,
    apiListCalendar,
    apiSaveCalendar,
    apiDeleteCalendar,
  };

  // 為了向後相容,全域函式 kol.html 直接呼叫
  window.renderSystemCalendar = renderSystemCalendar;
  window.renderSystemQueue = renderSystemQueue;
  window.generateEpisodeV510 = generateEpisodeV510;
  window.handleCalendarCellClick = handleCalendarCellClick;
  window.applyCalendarToEpisode = applyCalendarToEpisode;
  window.showPastEpisode = showPastEpisode;
  window.normalizeDate = normalizeDate;

})();
