/* RABY 讀取動畫 v1（2026-11-22 老闆定稿）
 *  c2 艙門開啟＝全系統預設讀取
 *  c3 發射前檢查＝Brand OS 跑廣告圖、KOL 數字人生成時用
 * 放法：<script src="/raby/raby-loader.js" data-assets="/raby/"></script>
 *   data-assets 資料夾要有：earth.jpg（軌道藍光）metal.jpg（拉絲黑金屬）aero.ttf aero-seam.ttf
 * 用法：
 *   RabyLoader.show('c2')                         // 不給進度＝能量條自己循環
 *   RabyLoader.show('c3', {title:'RENDERING', steps:['BRAND PACK','SCENE','RENDER','LOGO']})
 *   RabyLoader.progress(42)                       // 0–100，給了就照實際進度
 *   RabyLoader.step(2)                            // c3：第 0..2 行亮 OK
 *   RabyLoader.hide()
 */
(function () {
  var me = document.currentScript;
  var base = (me && me.getAttribute('data-assets')) || '/raby/';
  if (base.slice(-1) !== '/') base += '/';
  var css = [
    "@font-face{font-family:'RuiAero';src:url(" + base + "aero.ttf) format('truetype');font-display:swap}",
    "@font-face{font-family:'RuiAeroSeam';src:url(" + base + "aero-seam.ttf) format('truetype');font-display:swap}",
    ".rl{position:fixed;inset:0;z-index:2147483000;background:#000 url(" + base + "earth.jpg) center 42%/cover no-repeat;color:#fff;font-family:'Barlow','Noto Sans TC',sans-serif;display:flex;align-items:center;justify-content:center;overflow:hidden;opacity:0;transition:opacity .35s}",
    ".rl.on{opacity:1}",
    ".rl::before{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.35),rgba(0,0,0,0) 40%,rgba(0,0,0,.85) 80%)}",
    ".rl-box{position:relative;display:flex;flex-direction:column;align-items:center;gap:26px;opacity:0;transition:opacity .5s .9s}",
    ".rl.open .rl-box{opacity:1}",
    ".rl-t{font-family:'RuiAeroSeam','RuiAero','Barlow',sans-serif;font-size:clamp(26px,4vw,40px);letter-spacing:.3em;padding-left:.3em;background:linear-gradient(180deg,#fff 0%,#D9E0EA 36%,#6E7786 50%,#B9C3D1 60%,#F4F7FB 100%);-webkit-background-clip:text;background-clip:text;color:transparent}",
    ".rl-lab{font-size:11px;letter-spacing:.32em;color:rgba(255,255,255,.6)}",
    ".rl-bar{width:min(260px,70vw);display:flex;flex-direction:column;gap:10px}",
    ".rl-cells{position:relative;height:10px;background:rgba(255,255,255,.08);box-shadow:inset 0 0 0 1px rgba(255,255,255,.14)}",
    ".rl-cells>b{position:absolute;left:0;top:0;bottom:0;width:0;background:linear-gradient(90deg,#5AA0FF,#CFE3FF);box-shadow:0 0 14px rgba(90,160,255,.7);transition:width .4s cubic-bezier(.4,0,.2,1)}",
    ".rl-cells::after{content:'';position:absolute;inset:0;background:repeating-linear-gradient(90deg,transparent 0 9px,#000 9px 12px)}",
    ".rl.auto .rl-cells>b{animation:rlfill 3.6s cubic-bezier(.55,0,.35,1) infinite;transition:none}",
    ".rl-row{display:flex;justify-content:space-between}.rl-pct{font-family:'RuiAero','Barlow',sans-serif;color:#CFE3FF;letter-spacing:.2em}",
    ".rl-door{position:absolute;top:0;bottom:0;width:50%;background:#111 url(" + base + "metal.jpg) center/cover;transition:transform 1s cubic-bezier(.7,0,.3,1) .35s;display:flex;align-items:center}",
    ".rl-door i{width:9px;height:9px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#EEF2F7,#7B8492 55%,#15181d)}",
    ".rl-l{left:0;justify-content:flex-end;padding-right:22px;box-shadow:inset -1px 0 0 rgba(255,255,255,.35),inset -10px 0 22px rgba(0,0,0,.8);background-image:linear-gradient(90deg,rgba(0,0,0,.15),rgba(0,0,0,.55)),url(" + base + "metal.jpg)}",
    ".rl-r{right:0;padding-left:22px;box-shadow:inset 1px 0 0 rgba(255,255,255,.35),inset 10px 0 22px rgba(0,0,0,.8);background-image:linear-gradient(270deg,rgba(0,0,0,.15),rgba(0,0,0,.55)),url(" + base + "metal.jpg)}",
    ".rl.open .rl-l{transform:translateX(-100%)}.rl.open .rl-r{transform:translateX(100%)}",
    ".rl-seam{position:absolute;top:0;bottom:0;left:50%;width:2px;margin-left:-1px;background:#9CC8FF;box-shadow:0 0 18px 4px rgba(90,160,255,.8);opacity:0;animation:rlseam .6s ease-out .05s both}",
    ".rl-steps{width:min(260px,70vw);display:flex;flex-direction:column;gap:10px}",
    ".rl-steps>div{display:flex;justify-content:space-between;opacity:.25;transition:opacity .3s}",
    ".rl-steps>div.ok{opacity:1}.rl-steps>div span+span{color:#9CC8FF;visibility:hidden}.rl-steps>div.ok span+span{visibility:visible}",
    ".rl-chev{font-family:'RuiAero','Barlow',sans-serif;font-size:28px;color:#9CC8FF;text-shadow:0 0 12px rgba(90,160,255,.8)}",
    ".rl-chev span{display:inline-block;animation:rlchev 1.6s linear infinite}",
    "@keyframes rlfill{0%{width:0}85%,100%{width:100%}}",
    "@keyframes rlseam{0%{opacity:0}40%{opacity:1}100%{opacity:0}}",
    "@keyframes rlchev{0%{transform:translateX(-30px);opacity:0}30%,70%{opacity:1}100%{transform:translateX(30px);opacity:0}}",
    "@media (prefers-reduced-motion:reduce){.rl *,.rl{animation:none!important;transition:none!important}}"
  ].join('\n');
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  var el = null, kind = null, timer = null;
  function h(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function bar() { return '<div class="rl-bar"><div class="rl-cells"><b></b></div><div class="rl-row rl-lab"><span>ENERGY</span><span class="rl-pct"></span></div></div>'; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function show(k, opt) {
    opt = opt || {}; hide(true); kind = k === 'c3' ? 'c3' : 'c2';
    el = h('div', 'rl auto'); el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite'); el.setAttribute('aria-label', 'Loading');
    var box = h('div', 'rl-box');
    if (kind === 'c2') {
      box.innerHTML = '<span class="rl-t">' + esc(opt.title || 'BOARDING') + '</span>' + bar();
      el.appendChild(box);
      el.appendChild(h('div', 'rl-door rl-l', '<i></i>')); el.appendChild(h('div', 'rl-door rl-r', '<i></i>')); el.appendChild(h('div', 'rl-seam'));
    } else {
      var steps = opt.steps || ['POWER', 'NAVIGATION', 'COMMS', 'LAUNCH'];
      var rows = steps.map(function (s, i) { return '<div><span>' + String(i + 1).padStart(2, '0') + ' ' + esc(s) + '</span><span>OK</span></div>'; }).join('');
      var chev = ''; for (var i = 0; i < 5; i++) chev += '<span style="animation-delay:' + (i * 0.16) + 's">›</span>';
      box.innerHTML = '<span class="rl-lab">' + esc(opt.title || 'SYSTEMS CHECK') + '</span><div class="rl-steps rl-lab">' + rows + '</div><div class="rl-chev" aria-hidden="true">' + chev + '</div>' + bar();
      el.appendChild(box);
      el.className += ' open';
      if (!opt.manual) { var n = 0; timer = setInterval(function () { step(n++ % (steps.length + 1) - 1); }, 700); }
    }
    document.body.appendChild(el);
    requestAnimationFrame(function () { if (!el) return; el.classList.add('on'); if (kind === 'c2') setTimeout(function () { el && el.classList.add('open'); }, 450); });
  }
  function progress(p) {
    if (!el) return; p = Math.max(0, Math.min(100, Math.round(p)));
    el.classList.remove('auto');
    el.querySelector('.rl-cells>b').style.width = p + '%';
    el.querySelector('.rl-pct').textContent = p + '%';
  }
  function step(i) {
    if (!el || kind !== 'c3') return;
    var rows = el.querySelectorAll('.rl-steps>div');
    for (var j = 0; j < rows.length; j++) rows[j].classList.toggle('ok', j <= i);
  }
  function hide(now) {
    if (timer) { clearInterval(timer); timer = null; }
    if (!el) return; var e = el; el = null;
    if (now === true) { e.remove(); return; }
    e.classList.remove('on'); setTimeout(function () { e.remove(); }, 400);
  }
  window.RabyLoader = { show: show, progress: progress, step: step, hide: hide };
})();
