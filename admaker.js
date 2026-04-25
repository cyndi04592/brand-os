// ═══════════════════════════════════════════════════════════════════════
//  Brand OS · Cloudflare Worker (v10.3)
//  變更紀錄:
//    [v10.3] ★ 新增 gas_brand_packs_fetch:讀 Brand OS GAS 的 brand_packs sheet
//             需要 GAS_BRAND_OS_URL + GAS_PASSWORD 環境變數
//             有 5 分鐘 in-memory cache 避免每次都打 GAS
//    [v10.2] 後端無實質變更 — v10.2 的版式骨架 / 品牌風格包 / 風土調味
//             邏輯全部在前端 admaker.js 的 buildPosterPrompt() 完成
//             worker 只負責原樣轉發 gpt_poster_edit_submit 給 fal
//    [v10.1] 新增 gpt_poster_edit_submit (商品圖→海報,100%保留商品)
//             endpoint: openai/gpt-image-2/edit
//             quality: high (每張 ~$0.17)
//    [v10.1] 新增 kling_poster_video_submit (海報→5秒影片)
//             endpoint: fal-ai/kling-video/v2.1/standard/image-to-video
//             每秒 $0.07,5秒約 $0.35 (~NT$11)
//    [v10.0] gpt_poster_submit (文生圖,保留作備援)
// ═══════════════════════════════════════════════════════════════════════

// v10.3 in-memory cache for brand packs (5 分鐘)
// 注意:Cloudflare Worker 每個 isolate 各自有自己的快取,不是全球共用
// 但對於低頻讀取(admaker 開啟時讀一次)這已經足夠
let _BRAND_PACKS_CACHE = null;
let _BRAND_PACKS_CACHE_TIME = 0;
const BRAND_PACKS_CACHE_TTL_MS = 5 * 60 * 1000;

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: { 'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type' } });
    }
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });

    const body = await request.json();
    if (body.password !== env.ACCESS_PASSWORD) return jsonResp({ ok: false, error: '密碼錯誤' });
    const action = body.action;

    // ══ Claude 生成腳本 ══
    if (action === 'claude_generate') {
      const prompt = body.prompt;
      if (!prompt) return jsonResp({ ok: false, error: '缺少 prompt' });
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', headers: { 'x-api-key': env.CLAUDE_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: body.max_tokens || 2000, messages: [{ role: 'user', content: prompt }] })
      });
      const result = await resp.json();
      if (result.error) return jsonResp({ ok: false, error: result.error.message });
      return jsonResp({ ok: true, text: result.content.map(c => c.text || '').join(''), usage: result.usage });
    }

    // ══ Drive 檔案列表 ══
    if (action === 'drive_files') {
      const { folderId, type } = body;
      if (!folderId) return jsonResp({ ok: false, error: '缺少 folderId' });
      const SA_EMAIL = 'brand-os-drive@brand-os-drive.iam.gserviceaccount.com';
      const SA_KEY_B64 = 'LS0tLS1CRUdJTiBQUklWQVRFIEtFWS0tLS0tCk1JSUV2UUlCQURBTkJna3Foa2lHOXcwQkFRRUZBQVNDQktjd2dnU2pBZ0VBQW9JQkFRQ2M4NzZia0ZsaGtMaGwKT1pMbXgyS1NCTEUzWGx4UU9hY3pWd2RKSDcrWVcrQm9jMGkrQzVXd1lNSEtjbTBMUW13TllrdFAxUzRzN0xCVwpYbW96MkJRZDcxT0dSNndqNHFZZCs3a0ZrZjlPWUg0WG96QkZQWG1yY0lvdWtFMTRwMkYreTFzbkdWaTdOUHJWCnRVWHJsMXVJUWhDMjdhUFd1NWdLaWVPMm9JK3FXdjVrVWN5Tlg1dUMwVklZUHFIMldSZ0dCNDRJSDhJWUhCSlYKbGZPWDBZTjkvL21ObDM4N0d5NXYyTW1xVW9Qc3U4ekNveTdibThmN0l6VzUzNFpzdkk0YWc1OWZxZ1BidnltbQpBS0JXNHF6WVlQQjNyaU9Gdjk4MFN1Wll6N0hEYXpJYUlhKzBCVUtPcEJvbUJoZVVXZEFRNWh1SmkwdmtEdmMxCmY0bERNLzdiQWdNQkFBRUNnZ0VBUG9mei9HbWQycnU4WTRQMUxhSHBlVENLWkh0aFB3dEJQTGlqSy9TTXNvaUUKVjBqN0JkQjZ3bXRDT2tTdGdpdGovazhYbjBaWlg4ZXJGN1lGRFFPOVBCSHlUcEQybWROK2lIcVdSQXhmVWR3cQowSU1SUTd6UzRVVjBvRW1ZdkFXLzE3THdiWnJ4R2FEcGdNUjRoM3psbUZ0dDZsdXloMloxRkZuTWtpSFZLekwyCjRGN1RBYnY4WEVvZDl5a1pIWnQ5cjZGa01XbDRHWCtld2J2d0NqL0FnUzBPNThlNk5IN3VKNW5qUXZsUHJVV2oKVEswckxmQ254TWJLQTlkcDRneHNGZ1JSSlhqM3lXVWswTGJFMWtTRElnOFBJZVlKN0lxTVlRTFZaczFjbUt5ZApqa1FQeUJWOCs4UEU3WU9ZalBsaTYzZDZjK2dMK0lQWUtBU0lPWXJvNlFLQmdRRE1MRDh3eDhNMFdqa3lrZ0pEClg0YWJsMzU0NEZsaFVML2tqcTBOYTV4eGY4VGx0MXJGSU5KZlFhTVBJMFZWcFo5bzU3L2FpMkRhMUNEK0JwLzAKTExhQXR6cmVaV1pLYkNQVWFaKytFb3ZWRVY2ZEhseFBCbWdHeXhUWWNNWWkvNU9nTUFFMzVpUlBSQ3N6cUYrOApUa2ZMelFNVVJlOXFSdVpVRk92L0g4U1N3d0tCZ1FERXl2VGtiVzgwRDA4Rjkxdjl1OGk1Q3JyZkhXODdFMitSCjBFYXFvTkxxUkJvUW95VU4zcmlJNnBhQ2tkNjV3KzhCSUMwMlk1aDlFREt0cEZkZjF6aHpjRHRpUU8zamNkTEIKY2NjYTI2c0Q3bUhMZlJNdVg5WXlVQWY1WHB3MWtYKzFzVG13aHRGc25uSDR1cko5TEFwREtaS1ZWNDVmTnJHaQpNN3VCVlZCeUNRS0JnUUNKR3RsZ1AzVDFMZlVrNFdtRnBwczAxcG1HUUZtbEFOMnJkS2YrMEJtaEdnUzFvZGZoCmNuWHlvNWdFN1ZGOC94ZzZFUTREaXY4Q1U5ckgydGtFMWhYRC84Y1hXdzVDd2JXWnlVZ05FbFUyUWxDL3Y0aUwKUktrTWpza3p3eDg2bDFlaUJUcDhPQjUvNEM0R3BYV01kU0MvV2E5TXFOM3FCeXhhb0NZT0QxNG9rd0tCZ0Z3cApRRzhKNFI1Y1hRSEtTa2FWL3ZiSjA2SlJ3cG5FREdnWlJqNzZla3hFQUlEeUpwUk1UZGV4SlRPWTVOblNyTWUyCkxmWmV4amNyc3RBbk90UWprc2hkTXpKY2Znd2FiajB4NzdEZ1YwTE1EUGlqWnF3OUxhNzZWQUd4RVM3MUtQNEsKTlo0NlJURzlNbHJ0OUZFeW9zdTVXSENnUklqS3NIM3FCRklaaGtjaEFvR0FRSlpnbFV5cFMwUFVUT282cGV1bwo3VjZKWXorMTIvZEpCR1A4Ni9oZ1F1YngvK0JRYjZ0ajNzL29QUzFXdDVEem1PZG1JbzNwQWZpL3ppR1hLN2hnCitPaGdYQWxWVSsyN2UxUm5Lb2RQU3hpSDFSSU14Nnd6ZVAwNnZyOEtWYlhqWG5EUStkVUhBSTZ3T2xnQkJnTDAKQlZDVWhFcG5nWEk3d2tkcWI0dHg4MzA9Ci0tLS0tRU5EIFBSSVZBVEUgS0VZLS0tLS0=';
      try {
        const now = Math.floor(Date.now() / 1000);
        const jwtHeader = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
        const jwtPayload = btoa(JSON.stringify({ iss: SA_EMAIL, scope: 'https://www.googleapis.com/auth/drive.readonly', aud: 'https://oauth2.googleapis.com/token', exp: now + 3600, iat: now })).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
        const unsigned = jwtHeader + '.' + jwtPayload;
        const pemDecoded = atob(SA_KEY_B64);
        const pemBody = pemDecoded.replace(/-----BEGIN PRIVATE KEY-----/g,'').replace(/-----END PRIVATE KEY-----/g,'').replace(/\r?\n/g,'').trim();
        const binaryDer = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0));
        const cryptoKey = await crypto.subtle.importKey('pkcs8', binaryDer.buffer, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
        const sigBuf = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(unsigned));
        const sig = btoa(String.fromCharCode(...new Uint8Array(sigBuf))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
        const jwt = unsigned + '.' + sig;
        const tokenData = await (await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }) })).json();
        if (!tokenData.access_token) return jsonResp({ ok: false, error: 'Drive Token 取得失敗: ' + JSON.stringify(tokenData).slice(0,200) });
        const mimeFilter = type === 'video' ? "mimeType contains 'video/'" : "mimeType contains 'image/'";
        const q = encodeURIComponent(`'${folderId}' in parents and (${mimeFilter}) and trashed=false`);
        const driveData = await (await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=${encodeURIComponent('files(id,name,mimeType,thumbnailLink,webContentLink,size)')}&pageSize=100&orderBy=name`, { headers: { 'Authorization': `Bearer ${tokenData.access_token}` } })).json();
        if (driveData.error) return jsonResp({ ok: false, error: driveData.error.message });
        const files = (driveData.files || []).map(f => ({ id: f.id, name: f.name, mimeType: f.mimeType, thumbnailLink: f.thumbnailLink ? f.thumbnailLink.replace('=s220','=s400') : null, downloadUrl: `https://drive.google.com/uc?export=download&id=${f.id}`, viewUrl: `https://drive.google.com/file/d/${f.id}/view`, size: f.size }));
        return jsonResp({ ok: true, files, total: files.length });
      } catch(jwtErr) { return jsonResp({ ok: false, error: 'JWT 簽署失敗: ' + jwtErr.message }); }
    }

    // ══ fal.ai 取得上傳 URL ══
    if (action === 'fal_get_upload_url') {
      const { mimeType } = body;
      if (!env.FAL_KEY) return jsonResp({ ok: false, error: 'FAL_KEY 未設定' });
      try {
        const resp = await fetch('https://rest.alpha.fal.ai/storage/upload/initiate', {
          method: 'POST',
          headers: { 'Authorization': `Key ${env.FAL_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ content_type: mimeType || 'image/jpeg', file_name: 'upload.jpg' })
        });
        if (!resp.ok) {
          const err = await resp.text();
          return jsonResp({ ok: false, error: 'initiate 失敗: ' + err.slice(0,300) });
        }
        const data = await resp.json();
        return jsonResp({ ok: true, uploadUrl: data.upload_url, fileUrl: data.file_url || data.url });
      } catch(e) {
        return jsonResp({ ok: false, error: e.message });
      }
    }

    // ══ fal.ai 同步呼叫（fal.run，不走 queue）══
    if (action === 'fal_submit') {
      const { endpoint, payload } = body;
      if (!endpoint || !payload) return jsonResp({ ok: false, error: '缺少 endpoint 或 payload' });
      if (!env.FAL_KEY) return jsonResp({ ok: false, error: 'FAL_KEY 未設定' });
      const payloadWithSeed = { ...payload, seed: payload.seed || Math.floor(Math.random() * 9999999) };
      const resp = await fetch(`https://fal.run/${endpoint}`, {
        method: 'POST',
        headers: { 'Authorization': `Key ${env.FAL_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadWithSeed)
      });
      if (!resp.ok) { const err = await resp.text(); return jsonResp({ ok: false, error: 'fal run 失敗: ' + err.slice(0,400) }); }
      const result = await resp.json();
      const imgUrl = extractImageUrl(result);
      if (imgUrl) return jsonResp({ ok: true, status: 'COMPLETED', imageUrl: imgUrl });
      const videoUrl = extractVideoUrl(result);
      if (videoUrl) return jsonResp({ ok: true, status: 'COMPLETED', videoUrl });
      return jsonResp({ ok: false, error: '無圖片結果: ' + JSON.stringify(result).slice(0,300) });
    }

    // ══ Flux Pro Kontext（直接改圖，queue 非同步）══
    if (action === 'flux_kontext_submit') {
      const { imageUrl, prompt } = body;
      if (!imageUrl || !prompt) return jsonResp({ ok: false, error: '缺少 imageUrl 或 prompt' });
      if (!env.FAL_KEY) return jsonResp({ ok: false, error: 'FAL_KEY 未設定' });
      const resp = await fetch('https://queue.fal.run/fal-ai/flux-pro/kontext', {
        method: 'POST',
        headers: { 'Authorization': `Key ${env.FAL_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: imageUrl,
          prompt,
          guidance_scale: 3.5,
          num_inference_steps: 28,
          seed: Math.floor(Math.random() * 9999999),
          output_format: 'jpeg',
          image_size: { width: 1080, height: 1080 }
        })
      });
      if (!resp.ok) { const err = await resp.text(); return jsonResp({ ok: false, error: `Kontext 提交失敗 [${resp.status}]: ` + err.slice(0,400) }); }
      const data = await resp.json();
      if (!data.request_id) return jsonResp({ ok: false, error: '無 request_id: ' + JSON.stringify(data).slice(0,200) });
      return jsonResp({ ok: true, requestId: data.request_id, endpoint: 'fal-ai/flux-pro/kontext', responseUrl: data.response_url, statusUrl: data.status_url });
    }

    // ══════════════════════════════════════════════════════════════════
    // GPT Image 2 海報 Submit (queue 非同步) — 文生圖,保留作備援
    // ══════════════════════════════════════════════════════════════════
    if (action === 'gpt_poster_submit') {
      const { prompt, image_size, quality } = body;
      if (!prompt) return jsonResp({ ok: false, error: '缺少 prompt' });
      if (!env.FAL_KEY) return jsonResp({ ok: false, error: 'FAL_KEY 未設定' });

      const payload = {
        prompt,
        image_size: image_size || 'portrait_4_3',
        quality: quality || 'medium'
      };

      const resp = await fetch('https://queue.fal.run/openai/gpt-image-2', {
        method: 'POST',
        headers: { 'Authorization': `Key ${env.FAL_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!resp.ok) {
        const err = await resp.text();
        return jsonResp({ ok: false, error: `GPT Image 2 提交失敗 [${resp.status}]: ` + err.slice(0,500) });
      }
      const data = await resp.json();
      if (!data.request_id) return jsonResp({ ok: false, error: '無 request_id: ' + JSON.stringify(data).slice(0,300) });
      return jsonResp({
        ok: true,
        requestId: data.request_id,
        endpoint: 'openai/gpt-image-2',
        responseUrl: data.response_url,
        statusUrl: data.status_url
      });
    }

    // ══════════════════════════════════════════════════════════════════
    // ★ GPT Image 2 編輯模式 (商品圖→廣告圖,100%保留商品)
    //   v10.2 的版式骨架 / 品牌風格包 / 風土調味 / 情境主題 全部由前端
    //   admaker.js 的 buildPosterPrompt() 合成,後端只負責原樣轉發
    // ══════════════════════════════════════════════════════════════════
    if (action === 'gpt_poster_edit_submit') {
      const { prompt, imageUrls, image_size, quality, num_images } = body;
      if (!prompt) return jsonResp({ ok: false, error: '缺少 prompt' });
      if (!imageUrls || !imageUrls.length) return jsonResp({ ok: false, error: '缺少 imageUrls (商品圖)' });
      if (!env.FAL_KEY) return jsonResp({ ok: false, error: 'FAL_KEY 未設定' });

      const payload = {
        prompt,
        image_urls: imageUrls,
        image_size: image_size || 'portrait_4_3',
        quality: quality || 'high',
        num_images: num_images || 1,
        output_format: 'png'
      };

      const resp = await fetch('https://queue.fal.run/openai/gpt-image-2/edit', {
        method: 'POST',
        headers: { 'Authorization': `Key ${env.FAL_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!resp.ok) {
        const err = await resp.text();
        return jsonResp({ ok: false, error: `GPT Edit 提交失敗 [${resp.status}]: ` + err.slice(0,500) });
      }
      const data = await resp.json();
      if (!data.request_id) return jsonResp({ ok: false, error: '無 request_id: ' + JSON.stringify(data).slice(0,300) });
      return jsonResp({
        ok: true,
        requestId: data.request_id,
        endpoint: 'openai/gpt-image-2/edit',
        responseUrl: data.response_url,
        statusUrl: data.status_url
      });
    }

    // ══════════════════════════════════════════════════════════════════
    // Kling 海報→5秒影片
    // ══════════════════════════════════════════════════════════════════
    if (action === 'kling_poster_video_submit') {
      const { imageUrl, prompt, duration, aspect_ratio } = body;
      if (!imageUrl) return jsonResp({ ok: false, error: '缺少 imageUrl (海報圖)' });
      if (!env.FAL_KEY) return jsonResp({ ok: false, error: 'FAL_KEY 未設定' });

      const payload = {
        image_url: imageUrl,
        prompt: prompt || 'Subtle atmospheric motion: gentle light particles floating, soft ambient motion, slow cinematic breathing of the scene. Product and typography remain completely still and crisp.',
        duration: String(duration || 5),
        aspect_ratio: aspect_ratio || '3:4',
        cfg_scale: 0.5,
        negative_prompt: 'blur, distort, warp, text shifting, product deformation, low quality'
      };

      const resp = await fetch('https://queue.fal.run/fal-ai/kling-video/v2.1/standard/image-to-video', {
        method: 'POST',
        headers: { 'Authorization': `Key ${env.FAL_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!resp.ok) {
        const err = await resp.text();
        return jsonResp({ ok: false, error: `Kling Video 提交失敗 [${resp.status}]: ` + err.slice(0,500) });
      }
      const data = await resp.json();
      if (!data.request_id) return jsonResp({ ok: false, error: '無 request_id: ' + JSON.stringify(data).slice(0,300) });
      return jsonResp({
        ok: true,
        requestId: data.request_id,
        endpoint: 'fal-ai/kling-video/v2.1/standard/image-to-video',
        responseUrl: data.response_url,
        statusUrl: data.status_url
      });
    }


    // ══════════════════════════════════════════════════════════════════
    // ★ v10.3: 從 Brand OS GAS 讀 brand_packs sheet
    //   - GAS endpoint: ?action=getBrandPacks
    //   - 環境變數需求:
    //       GAS_BRAND_OS_URL = https://script.google.com/macros/s/.../exec
    //       GAS_PASSWORD     = raby2026 (或 GAS 那邊設定的密碼)
    //   - 5 分鐘 in-memory cache,避免每次都打 GAS
    //   - 強制刷新:傳 { force_refresh: true }
    // ══════════════════════════════════════════════════════════════════
    if (action === 'gas_brand_packs_fetch') {
      const forceRefresh = body.force_refresh === true;
      const now = Date.now();

      // 命中快取直接回
      if (!forceRefresh
          && _BRAND_PACKS_CACHE
          && (now - _BRAND_PACKS_CACHE_TIME) < BRAND_PACKS_CACHE_TTL_MS) {
        return jsonResp({
          ok: true,
          packs: _BRAND_PACKS_CACHE.packs,
          total: _BRAND_PACKS_CACHE.total,
          cached: true,
          cache_age_sec: Math.round((now - _BRAND_PACKS_CACHE_TIME) / 1000),
        });
      }

      const gasUrl = env.GAS_BRAND_OS_URL;
      const gasPwd = env.GAS_PASSWORD;
      if (!gasUrl) return jsonResp({ ok: false, error: 'GAS_BRAND_OS_URL 未設定' });
      if (!gasPwd) return jsonResp({ ok: false, error: 'GAS_PASSWORD 未設定' });

      try {
        const url = `${gasUrl}?action=getBrandPacks&password=${encodeURIComponent(gasPwd)}`;
        const resp = await fetch(url, {
          method: 'GET',
          // GAS Web App 重定向到 googleusercontent,要 follow
          redirect: 'follow',
        });
        if (!resp.ok) {
          const text = await resp.text();
          return jsonResp({ ok: false, error: `GAS 回應失敗 [${resp.status}]: ` + text.slice(0, 300) });
        }
        const data = await resp.json();
        if (!data.ok) {
          return jsonResp({ ok: false, error: 'GAS 回傳 ok=false: ' + (data.error || 'unknown') });
        }

        // 寫入快取
        _BRAND_PACKS_CACHE = { packs: data.packs || [], total: data.total || 0 };
        _BRAND_PACKS_CACHE_TIME = now;

        return jsonResp({
          ok: true,
          packs: data.packs || [],
          total: data.total || 0,
          cached: false,
          fetched_at: data.fetched_at || new Date().toISOString(),
        });
      } catch (e) {
        return jsonResp({ ok: false, error: 'GAS fetch 失敗: ' + e.message });
      }
    }


    // ══ fal.ai 影片 Submit（queue 非同步）══
    if (action === 'fal_video_submit') {
      const { endpoint, payload } = body;
      if (!endpoint || !payload) return jsonResp({ ok: false, error: '缺少 endpoint 或 payload' });
      if (!env.FAL_KEY) return jsonResp({ ok: false, error: 'FAL_KEY 未設定' });

      let finalPayload;
      const isKling = endpoint.includes('kling-video');
      if (isKling) {
        finalPayload = {
          start_image_url: payload.image_url,
          prompt: payload.prompt || 'cinematic product advertising, slow zoom, soft lighting',
          duration: String(parseInt(payload.duration) || 5),
          aspect_ratio: payload.aspect_ratio || '9:16',
          generate_audio: true
        };
      } else {
        finalPayload = {
          ...payload,
          seed: payload.seed || Math.floor(Math.random() * 9999999)
        };
      }

      const resp = await fetch(`https://queue.fal.run/${endpoint}`, {
        method: 'POST',
        headers: { 'Authorization': `Key ${env.FAL_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(finalPayload)
      });
      if (!resp.ok) {
        const err = await resp.text();
        return jsonResp({ ok: false, error: `fal queue 失敗 [${resp.status}]: ` + err.slice(0,600) });
      }
      const data = await resp.json();
      if (!data.request_id) return jsonResp({ ok: false, error: '無 request_id: ' + JSON.stringify(data).slice(0,400) });
      return jsonResp({ ok: true, requestId: data.request_id, endpoint, responseUrl: data.response_url, statusUrl: data.status_url });
    }

    // ══ fal.ai Poll（單次狀態查詢）══
    if (action === 'fal_poll') {
      const { requestId, endpoint, responseUrl, statusUrl } = body;
      if (!requestId || !endpoint) return jsonResp({ ok: false, error: '缺少 requestId 或 endpoint' });
      if (!env.FAL_KEY) return jsonResp({ ok: false, error: 'FAL_KEY 未設定' });
      const headers = { 'Authorization': `Key ${env.FAL_KEY}` };

      const finalStatusUrl = statusUrl
        || `https://queue.fal.run/${endpoint}/requests/${requestId}/status`;
      const statusResp = await fetch(finalStatusUrl + '?logs=1', { headers });
      if (!statusResp.ok) return jsonResp({ ok: true, status: 'IN_QUEUE' });
      const statusData = await statusResp.json();
      const status = statusData.status || 'IN_QUEUE';

      if (status === 'FAILED') {
        return jsonResp({ ok: false, status: 'FAILED', error: statusData.error || statusData.detail || '任務失敗' });
      }
      if (status !== 'COMPLETED') return jsonResp({ ok: true, status });

      let result = statusData;
      const finalResponseUrl = responseUrl
        || statusData.response_url
        || `https://queue.fal.run/${endpoint}/requests/${requestId}/response`;
      const resultResp = await fetch(finalResponseUrl, { headers });
      if (resultResp.ok) {
        result = await resultResp.json();
      }

      const videoUrl = extractVideoUrl(result) || extractVideoUrl(statusData);
      if (videoUrl) return jsonResp({ ok: true, status: 'COMPLETED', videoUrl });

      const imgUrl = extractImageUrl(result) || extractImageUrl(statusData);
      if (imgUrl) return jsonResp({ ok: true, status: 'COMPLETED', imageUrl: imgUrl });

      return jsonResp({ ok: true, status: 'COMPLETED', rawResult: JSON.stringify(result).slice(0, 2000) });
    }

    // ══ 試穿 Submit ══
    if (action === 'kling_tryon_submit') {
      const { humanImageBase64, garmentImageBase64 } = body;
      if (!humanImageBase64 || !garmentImageBase64) return jsonResp({ ok: false, error: '缺少圖片' });
      if (!env.FAL_KEY) return jsonResp({ ok: false, error: 'FAL_KEY 未設定' });
      const resp = await fetch('https://queue.fal.run/fal-ai/kling/v1-5/kolors-virtual-try-on', {
        method: 'POST', headers: { 'Authorization': `Key ${env.FAL_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ human_image_url: humanImageBase64, garment_image_url: garmentImageBase64, prompt: 'ultra-realistic product photography, photorealistic integration, high-end fashion campaign quality' })
      });
      if (!resp.ok) { const err = await resp.text(); return jsonResp({ ok: false, error: '提交失敗: ' + err.slice(0,300) }); }
      const data = await resp.json();
      if (!data.request_id) return jsonResp({ ok: false, error: '無 request_id: ' + JSON.stringify(data).slice(0,200) });
      return jsonResp({ ok: true, requestId: data.request_id, endpoint: 'fal-ai/kling/v1-5/kolors-virtual-try-on', responseUrl: data.response_url, statusUrl: data.status_url });
    }

    // ══ LINE 測試通知 ══
    if (action === 'line_test') {
      const twTime = new Date(Date.now() + 8*3600000);
      await sendLine(env, `🧪 Brand OS 通知測試\n${twTime.toLocaleString('zh-TW')}\n\n✅ LINE 通知設定成功！`);
      return jsonResp({ ok: true, message: '測試通知已發送' });
    }

    // ══ FB 數據 ══
    if (action === 'fb_insights_daily') {
      const { accountId, brand, since, until } = body;
      if (!accountId || !since || !until) return jsonResp({ ok: false, error: '缺少必要參數' });
      const token = getMetaToken(env, brand);
      if (!token) return jsonResp({ ok: false, error: 'FB Token 未設定' });
      const fields = 'spend,impressions,reach,frequency,ctr,cpm,clicks,inline_link_clicks,actions,action_values';
      const data = await (await fetch(`https://graph.facebook.com/v19.0/act_${accountId}/insights?fields=${encodeURIComponent(fields)}&time_range={"since":"${since}","until":"${until}"}&time_increment=1&limit=90&access_token=${token}`)).json();
      if (data.error) return jsonResp({ ok: false, error: data.error.message });
      const daily = (data.data || []).map(d => { const acts=d.actions||[], actVals=d.action_values||[]; return { date_start: d.date_start, spend: parseFloat(d.spend||0), impressions: parseInt(d.impressions||0), reach: parseInt(d.reach||0), ctr: parseFloat(d.ctr||0), cpm: parseFloat(d.cpm||0), purchases: parseInt(acts.find(a=>a.action_type==='purchase')?.value||0), add_to_cart: parseInt(acts.find(a=>a.action_type==='add_to_cart')?.value||0), purchase_value: parseFloat(actVals.find(a=>a.action_type==='purchase')?.value||0) }; });
      return jsonResp({ ok: true, data: daily });
    }

    if (action === 'fb_daily_trend') {
      const { accountId, brand, since, until } = body;
      if (!accountId || !since || !until) return jsonResp({ ok: false, error: '缺少參數' });
      const token = getMetaToken(env, brand); if (!token) return jsonResp({ ok: false, error: 'FB Token 未設定' });
      const data = await (await fetch('https://graph.facebook.com/v19.0/act_'+accountId+'/insights?fields='+encodeURIComponent('spend,impressions,reach,clicks,ctr,cpm,cpc,actions,action_values')+'&time_range={"since":"'+since+'","until":"'+until+'"}&time_increment=1&limit=90&access_token='+token)).json();
      if (data.error) return jsonResp({ ok: false, error: data.error.message });
      return jsonResp({ ok: true, data: data.data || [] });
    }

    if (action === 'fb_insights') {
      const { accountId, brand, datePreset, since, until, level } = body;
      if (!accountId) return jsonResp({ ok: false, error: '缺少 accountId' });
      const token = getMetaToken(env, brand); if (!token) return jsonResp({ ok: false, error: 'FB Token 未設定' });
      const insightsParam = (since && until) ? `time_range({"since":"${since}","until":"${until}"})` : `date_preset(${datePreset||'last_7d'})`;
      const lvl = level || 'ads';
      const endpointMap = { campaigns:`act_${accountId}/campaigns`, adsets:`act_${accountId}/adsets`, ads:`act_${accountId}/ads` };
      const insightFields = 'spend,impressions,reach,frequency,ctr,cpm,clicks,inline_link_clicks,cpc,actions,action_values';
      const fbData = await (await fetch(`https://graph.facebook.com/v19.0/${endpointMap[lvl]||endpointMap['ads']}?fields=${encodeURIComponent(`name,status,effective_status,adset_name,campaign_name,insights.${insightsParam}{${insightFields}}`)}&limit=200&access_token=${token}`)).json();
      if (fbData.error) return jsonResp({ ok: false, error: fbData.error.message });
      let allData = fbData.data||[], nextUrl = fbData.paging?.next, pageCount = 1;
      while (nextUrl && pageCount < 3) { const nd = await (await fetch(nextUrl)).json(); if (nd.error||!nd.data) break; allData = allData.concat(nd.data); nextUrl = nd.paging?.next; pageCount++; }
      return jsonResp({ ok: true, data: allData, level: lvl, total: allData.length });
    }

    if (action === 'fb_insights_yoy') {
      const { accountId, brand, since, until } = body;
      if (!accountId || !since || !until) return jsonResp({ ok: false, error: '缺少必要參數' });
      const token = getMetaToken(env, brand); if (!token) return jsonResp({ ok: false, error: 'Token 未設定' });
      const sinceYoy = since.replace(/^(\d{4})/, (_,y) => String(parseInt(y)-1));
      const untilYoy = until.replace(/^(\d{4})/, (_,y) => String(parseInt(y)-1));
      const insightFields = 'spend,impressions,reach,frequency,ctr,cpm,clicks,inline_link_clicks,actions,action_values';
      const buildUrl = (s,u) => `https://graph.facebook.com/v19.0/act_${accountId}/ads?fields=${encodeURIComponent(`name,status,insights.time_range({"since":"${s}","until":"${u}"}){${insightFields}}`)}&limit=200&access_token=${token}`;
      const [thisData, lastData] = await Promise.all([(await fetch(buildUrl(since,until))).json(), (await fetch(buildUrl(sinceYoy,untilYoy))).json()]);
      if (thisData.error) return jsonResp({ ok: false, error: thisData.error.message });
      return jsonResp({ ok: true, thisYear: { data: thisData.data||[], since, until }, lastYear: { data: lastData.data||[], since: sinceYoy, until: untilYoy } });
    }

    if (action === 'fb_learning_pct') {
      const { accountId, brand, days } = body;
      const token = getMetaToken(env, brand); if (!token) return jsonResp({ ok: false, error: 'Token 未設定' });
      const d = parseInt(days)||90;
      const until = new Date().toISOString().split('T')[0];
      const since = new Date(Date.now()-d*86400000).toISOString().split('T')[0];
      const data = await (await fetch(`https://graph.facebook.com/v19.0/act_${accountId}/adsets?fields=${encodeURIComponent(`name,effective_status,insights.time_range({"since":"${since}","until":"${until}"}){spend}`)}&limit=200&access_token=${token}`)).json();
      if (data.error) return jsonResp({ ok: false, error: data.error.message });
      let totalSpend=0, learnSpend=0, learnCount=0, learnLimitedCount=0;
      (data.data||[]).forEach(a => { const s=parseFloat(a.insights?.data?.[0]?.spend||0); totalSpend+=s; if(a.effective_status==='LEARNING'){learnSpend+=s;learnCount++;} if(a.effective_status==='LEARNING_LIMITED'){learnSpend+=s;learnLimitedCount++;} });
      return jsonResp({ ok: true, days: d, since, until, totalAdsets: (data.data||[]).length, learningCount: learnCount, learningLimitedCount: learnLimitedCount, totalSpend: Math.round(totalSpend), learnSpend: Math.round(learnSpend), learnPct: totalSpend>0?Math.round(learnSpend/totalSpend*100):0 });
    }

    if (action === 'keyword_search_volume') {
      const { keywords, languageId, locationId } = body;
      if (!keywords||!keywords.length) return jsonResp({ ok: false, error: '缺少 keywords' });
      const tokenData = await (await fetch('https://oauth2.googleapis.com/token', { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body: new URLSearchParams({ client_id:env.GOOGLE_ADS_CLIENT_ID, client_secret:env.GOOGLE_ADS_CLIENT_SECRET, refresh_token:env.GOOGLE_ADS_REFRESH_TOKEN, grant_type:'refresh_token' }) })).json();
      if (!tokenData.access_token) return jsonResp({ ok: false, error: 'Access Token 取得失敗' });
      const mccId = env.GOOGLE_ADS_MCC_ID.replace(/-/g,'');
      const customerId = body.customerId ? body.customerId.replace(/-/g,'') : '4274937558';
      const adsData = await (await fetch(`https://googleads.googleapis.com/v17/customers/${customerId}:generateKeywordIdeas`, { method:'POST', headers:{'Authorization':`Bearer ${tokenData.access_token}`,'developer-token':env.GOOGLE_ADS_DEVELOPER_TOKEN,'login-customer-id':mccId,'Content-Type':'application/json'}, body: JSON.stringify({ keywordSeed:{keywords}, language:`languageConstants/${languageId||1000}`, geoTargetConstants:[`geoTargetConstants/${locationId||2158}`], includeAdultKeywords:false, keywordPlanNetwork:'GOOGLE_SEARCH' }) })).json();
      if (adsData.error) return jsonResp({ ok: false, error: adsData.error.message||JSON.stringify(adsData.error).slice(0,300) });
      return jsonResp({ ok: true, results: (adsData.results||[]).map(r=>({ keyword:r.text, avgMonthlySearches:parseInt(r.keywordIdeaMetrics?.avgMonthlySearches||0), competition:r.keywordIdeaMetrics?.competition||'UNKNOWN', competitionIndex:parseInt(r.keywordIdeaMetrics?.competitionIndex||0), lowTopOfPageBid:parseInt(r.keywordIdeaMetrics?.lowTopOfPageBidMicros||0)/1000000, highTopOfPageBid:parseInt(r.keywordIdeaMetrics?.highTopOfPageBidMicros||0)/1000000 })), total: (adsData.results||[]).length });
    }

    return jsonResp({ ok: false, error: '未知的 action: ' + action });
  },

  async scheduled(event, env, ctx) { ctx.waitUntil(handleCron(event, env)); }
};

function extractImageUrl(result) {
  if (!result) return null;
  return result?.images?.[0]?.url
    || result?.image?.url
    || result?.output?.images?.[0]?.url
    || result?.output?.image?.url
    || null;
}

function extractVideoUrl(result) {
  if (!result) return null;
  return result?.video?.url
    || result?.output?.video?.url
    || null;
}

function getMetaToken(env, brand) {
  if (brand) { const k=`FB_TOKEN_${brand.toUpperCase()}`; if(env[k]) return env[k]; }
  if (env.META_SYSTEM_TOKEN) return env.META_SYSTEM_TOKEN;
  if (env.FB_TOKEN_MOZ) return env.FB_TOKEN_MOZ;
  return null;
}

const BRAND_CONFIG = [
  { brand:'moz', label:'MOZ瑞典駝鹿', accountId:'566452034785926', alertSpend:100000, alertNoon:50000 },
];

async function handleCron(event, env) {
  const now = new Date();
  const twHour = (now.getUTCHours()+8)%24, twMin = now.getUTCMinutes();
  const isNoon = twHour===12&&twMin<10, isMidnight = twHour===0&&twMin<10;
  const results = [];
  for (const brand of BRAND_CONFIG) {
    if (!brand.accountId) continue;
    const token = getMetaToken(env, brand.brand); if (!token) continue;
    const spend = await getTodaySpend(brand.accountId, token);
    if (spend===null) continue;
    results.push({ ...brand, spend });
    if (spend.spend>=brand.alertSpend) await sendLine(env, `🚨【${brand.label}】廣告費超標！今日花費 $${Math.round(spend.spend).toLocaleString()} TWD\n🔗 https://ai.raby.com.tw/monitor.html`);
    if (isNoon&&spend.spend>=brand.alertNoon) await sendLine(env, `⚠️【${brand.label}】中午花費預警\n上午已花費 $${Math.round(spend.spend).toLocaleString()} TWD`);
  }
  if (isMidnight&&results.length>0) await sendDailyReport(env, results);
}

async function getTodaySpend(accountId, token) {
  try {
    const today = new Date(Date.now()+8*3600000).toISOString().split('T')[0];
    const data = await (await fetch(`https://graph.facebook.com/v19.0/act_${accountId}/ads?fields=${encodeURIComponent(`name,status,effective_status,insights.time_range({"since":"${today}","until":"${today}"}){spend,impressions,actions,action_values,ctr,cpm,cpc,frequency}`)}&limit=200&access_token=${token}`)).json();
    if (data.error) return null;
    let totalSpend=0, totalPur=0, totalATC=0, totalRev=0;
    for (const ad of (data.data||[])) { const ins=ad.insights?.data?.[0]||{}; totalSpend+=parseFloat(ins.spend||0); const acts=ins.actions||[], actVals=ins.action_values||[]; totalPur+=parseInt(acts.find(a=>a.action_type==='purchase')?.value||0); totalATC+=parseInt(acts.find(a=>a.action_type==='add_to_cart')?.value||0); totalRev+=parseFloat(actVals.find(a=>a.action_type==='purchase')?.value||0); }
    return { spend:totalSpend, purchases:totalPur, addToCart:totalATC, revenue:totalRev };
  } catch(e) { return null; }
}

async function sendDailyReport(env, results) {
  const dateStr = new Date(Date.now()+8*3600000).toISOString().split('T')[0];
  let msg = `📊 Brand OS 廣告日報 ${dateStr}\n${'─'.repeat(24)}\n`;
  for (const r of results) {
    if (!r.spend) continue;
    const { spend, purchases:pur, addToCart:atc, revenue:rev } = r.spend;
    const roas = spend>0&&rev>0?(rev/spend).toFixed(2):'—', cpa = pur>0?Math.round(spend/pur):'—';
    msg += `\n【${r.label}】\n  💰 花費：$${Math.round(spend).toLocaleString()}\n  🛒 購買：${pur}次　加購：${atc}次\n  📈 ROAS：${roas}x${roas!=='—'&&parseFloat(roas)<2?' ⚠️':''}　CPA：${cpa==='—'?'—':'$'+cpa.toLocaleString()}${typeof cpa==='number'&&cpa>1500?' ⚠️':''}\n`;
  }
  msg += `\n🔗 https://ai.raby.com.tw/monitor.html`;
  await sendLine(env, msg);
}

async function sendLine(env, message) {
  const token=env.LINE_CHANNEL_TOKEN, userId=env.LINE_USER_ID;
  if (!token||!userId) return;
  await fetch('https://api.line.me/v2/bot/message/push', { method:'POST', headers:{'Authorization':`Bearer ${token}`,'Content-Type':'application/json'}, body: JSON.stringify({ to:userId, messages:[{type:'text',text:message}] }) });
}

function jsonResp(obj) {
  return new Response(JSON.stringify(obj), { headers: { 'Content-Type':'application/json','Access-Control-Allow-Origin':'*' } });
}
