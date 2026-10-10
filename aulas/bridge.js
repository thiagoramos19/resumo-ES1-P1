/* bridge.js — liga uma vídeo-aula ao PortalVideoAulas.html via postMessage.
   Só age quando a aula está dentro de um iframe; aberta sozinha, nada muda. */
(function () {
  'use strict';
  if (window.parent === window) return;
  var D = document;
  function q(s) { return D.querySelector(s); }
  function post(m) { m.aula = true; try { window.parent.postMessage(m, '*'); } catch (e) {} }
  function norm(t) { return String(t || '').replace(/\s*[★✨]\s*$/, '').replace(/\s*\(pt[-_][A-Za-z]+\)\s*$/i, '').trim(); }
  var HIDE = 'position:fixed!important;left:-5000px!important;top:0!important;width:1000px!important;visibility:hidden!important;pointer-events:none!important;';

  function speedAdd(box, attr) {
    var c = q(box); if (!c || c.querySelector('[' + attr + '="2"]')) return;
    var b = D.createElement('button'); b.setAttribute(attr, '2'); b.textContent = '2x'; c.appendChild(b);
  }
  function speedClick(box, attr, r) {
    var c = q(box); if (!c) return;
    var b = c.querySelector('[' + attr + '="' + r + '"]'); if (b) b.click();
  }

  var kind = (typeof ROTEIRO !== 'undefined') ? 'C'
    : (typeof TOTAL !== 'undefined' && typeof st !== 'undefined') ? 'B'
    : (typeof S === 'object' && typeof total !== 'undefined') ? 'A' : null;
  if (!kind) { post({ type: 'nobridge' }); return; }

  var AD = {
    A: {
      css: 'header.top,#voiceNote{display:none!important}footer.controls{' + HIDE + '}',
      bar: '#bar', fill: '#fill', vsel: '#voiceSel',
      init: function () { speedAdd('#speeds', 'data-s'); },
      play: function () { play(); }, pause: function () { pause(); },
      on: function () { return S.playing; }, done: function () { return S.finished; },
      tot: function () { return total; }, rate: function () { return S.speed; },
      setRate: function (r) { speedClick('#speeds', 'data-s', r); }
    },
    B: {
      css: 'header,#aviso{display:none!important}footer{' + HIDE + '}',
      bar: '#bar', fill: '#fill', vsel: '#voz',
      init: function () {
        var s = q('#rate');
        if (s && !s.querySelector('[value="2"]')) { var o = D.createElement('option'); o.value = '2'; o.textContent = '2x'; s.appendChild(o); }
      },
      play: function () { play(); }, pause: function () { pause(); },
      on: function () { return st.playing; }, done: null,
      tot: function () { return TOTAL; }, rate: function () { return st.rate; },
      setRate: function (r) { var s = q('#rate'); if (s) { s.value = String(r); s.dispatchEvent(new Event('change')); } }
    },
    C: {
      css: '.controls{' + HIDE + '}.start{display:none!important}html,body{height:100%;overflow:hidden}' +
        '.app{padding:8px!important;gap:8px!important;height:100vh;justify-content:center}' +
        '.stage-wrap{width:min(100%,calc((100vh - 118px)*16/9))!important}',
      bar: '#progress', fill: '#fill', vsel: '#voice',
      init: function () { speedAdd('#speed', 'data-rate'); },
      play: function () { play(); }, pause: function () { pause(); },
      on: function () { return playing; }, done: null,
      tot: function () { return total; }, rate: function () { return rate; },
      setRate: function (r) { speedClick('#speed', 'data-rate', r); }
    }
  }[kind];

  var style = D.createElement('style');
  style.textContent = AD.css + 'body.nocc #caption,body.nocc #legenda,body.nocc .caption{display:none!important}' +
    '#__gate{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;text-align:center;' +
    'background:radial-gradient(900px 500px at 50% 40%,rgba(28,43,107,.92),rgba(8,11,24,.97));font-family:system-ui,Segoe UI,sans-serif;color:#eef1fb;padding:24px}' +
    '#__gate h1{font-size:clamp(18px,3vw,30px);margin:0 0 22px;font-weight:800;line-height:1.2}' +
    '#__gate button{cursor:pointer;border:0;border-radius:999px;padding:16px 34px;font-size:18px;font-weight:800;color:#0a1124;background:linear-gradient(90deg,#7aa7ff,#b7a2ff);box-shadow:0 10px 40px rgba(122,167,255,.45)}' +
    '#__gate p{margin:16px 0 0;color:#98a4c6;font-size:14px}';
  D.head.appendChild(style);
  try { AD.init(); } catch (e) {}

  var gate = null, userPaused = false, ended = false, wasOn = false;
  function hideGate() { if (gate) { gate.remove(); gate = null; } }
  var active = false;
  try { active = !!(navigator.userActivation && navigator.userActivation.hasBeenActive); } catch (e) {}
  if (!active) {
    gate = D.createElement('div'); gate.id = '__gate';
    gate.innerHTML = '<div><h1></h1><button type="button">▶ Assistir</button><p>Toque para iniciar a narração</p></div>';
    gate.querySelector('h1').textContent = D.title;
    gate.querySelector('button').addEventListener('click', function () { hideGate(); userPaused = false; AD.play(); tick(); });
    D.body.appendChild(gate);
  } else if (/[?&]autoplay=1/.test(location.search)) {
    setTimeout(function () { AD.play(); }, 600);
  }

  function frac() { var f = q(AD.fill); return f ? Math.min(1, (parseFloat(f.style.width) || 0) / 100) : 0; }
  function seek(f) {
    var el = q(AD.bar); if (!el) return;
    f = Math.max(0, Math.min(0.9999, f)); var r = el.getBoundingClientRect();
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: r.left + r.width * f, clientY: r.top + r.height / 2 }));
  }
  function tick() {
    var vs = [], cur = '', sel = q(AD.vsel);
    if (sel) for (var i = 0; i < sel.options.length; i++) {
      var t = sel.options[i].textContent;
      vs.push({ key: norm(t), nat: /★|✨|online|natural|google/i.test(t) });
      if (i === sel.selectedIndex) cur = norm(t);
    }
    var on = !!AD.on(), f = frac();
    if (on) ended = false;
    else if (!ended && ((AD.done && AD.done()) || (wasOn && f > 0.95 && !userPaused))) ended = true;
    wasOn = on;
    post({ type: 'state', playing: on, frac: f, dur: AD.tot() || 0, rate: AD.rate() || 1, voices: vs, voice: cur, gate: !!gate, ended: ended });
  }
  setInterval(tick, 250);

  window.addEventListener('message', function (e) {
    if (e.source !== window.parent) return;
    var m = e.data; if (!m || m.dst !== 'aula') return;
    try {
      switch (m.cmd) {
        case 'play': hideGate(); userPaused = false; if (!AD.on()) AD.play(); break;
        case 'pause': userPaused = true; if (AD.on()) AD.pause(); break;
        case 'toggle': if (AD.on()) { userPaused = true; AD.pause(); } else { userPaused = false; AD.play(); } break;
        case 'seek': ended = false; seek(+m.value); break;
        case 'rate': AD.setRate(+m.value); break;
        case 'cc': D.body.classList.toggle('nocc', !m.value); break;
        case 'voice':
          if (sel0()) for (var i = 0; i < sel0().options.length; i++) {
            if (norm(sel0().options[i].textContent) === m.value) { sel0().value = sel0().options[i].value; sel0().dispatchEvent(new Event('change')); break; }
          }
          break;
      }
    } catch (err) {}
    setTimeout(tick, 60);
  });
  function sel0() { return q(AD.vsel); }
  post({ type: 'ready' });
  tick();
})();
