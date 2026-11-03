/* ═══════════════════════════════════════════════════════════════════
 *  sw.js · v1.0(2026-11-03)網站備份在客人瀏覽器(Service Worker)
 * ───────────────────────────────────────────────────────────────────
 *  RA 11/03:Cloudflare 繞路新加坡,登入頁、換頁會卡 8~14 秒 → 客人會客訴。
 *  ★ 做法:客人來過一次,網頁與程式在他瀏覽器留一份備份。
 *          每次先跟 Cloudflare 拿最新版:3 秒內拿到 → 用新的(同時更新備份)
 *                                       3 秒沒回來 → 先開備份,新版在背景抓完存起來,下次就是新版
 *  ★ 只管 ai.raby.com.tw 自己的「網頁 / 程式 / CSS / 圖片 / 字型」。
 *     API、Worker、cdn.raby.com.tw、Google 等一律不碰(照原本直接連)。
 *  ★ 載入:loader.js 註冊。緊急關閉:網址加 ?sw=off(這台瀏覽器解除)。
 *     全站緊急關閉:把下面 KILL 改成 true 再部署 → 所有客人下次開頁自動解除並清掉備份。
 * ═══════════════════════════════════════════════════════════════════ */
'use strict';

var VERSION = 'v1.0';
var CACHE = 'bos-shell-v1';
var WAIT_MS = 3000;          // 等 Cloudflare 幾毫秒,超過就先開備份
var MAX_ITEMS = 400;         // 備份最多幾個檔案(超過刪最舊的)
var KILL = false;            // 全站緊急關閉開關

self.addEventListener('install', function () { self.skipWaiting(); });

self.addEventListener('activate', function (event) {
  event.waitUntil((async function () {
    var names = await caches.keys();
    await Promise.all(names.map(function (n) {
      if (KILL || (n.indexOf('bos-shell-') === 0 && n !== CACHE)) return caches.delete(n);
    }));
    if (KILL) {
      await self.registration.unregister();
      return;
    }
    await self.clients.claim();
  })());
});

//  哪些請求要管:自己網域、GET、而且是「網頁 / 程式 / CSS / 圖片 / 字型」
var DEST_OK = { document: 1, script: 1, style: 1, image: 1, font: 1 };
function wanted(req) {
  if (KILL || req.method !== 'GET') return false;
  var u;
  try { u = new URL(req.url); } catch (e) { return false; }
  if (u.origin !== self.location.origin) return false;
  if (u.pathname === '/sw.js') return false;
  if (req.mode === 'navigate') return true;
  return !!DEST_OK[req.destination];
}

async function save(req, res) {
  try {
    if (!res || !res.ok || res.type !== 'basic' || res.redirected) return;
    var c = await caches.open(CACHE);
    await c.put(req, res);
    var keys = await c.keys();
    if (keys.length > MAX_ITEMS) {
      for (var i = 0; i < keys.length - MAX_ITEMS; i++) await c.delete(keys[i]);
    }
  } catch (e) {}
}

async function backup(req, isPage) {
  try {
    var c = await caches.open(CACHE);
    var hit = await c.match(req);
    if (!hit && isPage) hit = await c.match(req, { ignoreSearch: true });   // /kol?xx 也能用 /kol 的備份
    return hit || null;
  } catch (e) { return null; }
}

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (!wanted(req)) return;                 // 不管的 → 瀏覽器照原本直接連
  var isPage = req.mode === 'navigate';

  var net = fetch(req);
  //  拿到新版就更新備份(就算客人已經先看到備份,背景也會存好,下次就是新版)
  event.waitUntil(net.then(function (res) { return save(req, res.clone()); }).catch(function () {}));

  event.respondWith((async function () {
    var timer;
    var slow = new Promise(function (r) { timer = setTimeout(function () { r('slow'); }, WAIT_MS); });
    try {
      var first = await Promise.race([net, slow]);
      if (first !== 'slow') { clearTimeout(timer); return first; }
      //  3 秒沒回來 → 有備份就先開備份
      var b = await backup(req, isPage);
      if (b) return b;
      return await net;                     // 沒備份(第一次來)→ 只能繼續等
    } catch (e) {
      clearTimeout(timer);
      var b2 = await backup(req, isPage);   // 斷線 / 錯誤 → 有備份就用
      if (b2) return b2;
      throw e;
    }
  })());
});
