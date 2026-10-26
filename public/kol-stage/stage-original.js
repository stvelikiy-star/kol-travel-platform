/* КӨЛ — слайдер первого экрана «сцена».
   Разделение: данные (KOL_SEASON.scenes) → состояние (index/target) → анимация (WAAPI, один таймлайн за раз).
   Быстрые нажатия: цель обновляется сразу, текущий переход ускоряется и завершается, затем идёт переход к последней цели. */
(function () {
  'use strict';
  var S = window.KOL_SEASON, scenes = S && S.scenes;
  var root = document.getElementById('top');
  if (!scenes || !root || !root.animate) return;

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var EASE_OUT = 'cubic-bezier(.22,.61,.36,1)', EASE_IN = 'cubic-bezier(.55,0,.55,.2)', EASE_IO = 'cubic-bezier(.45,0,.2,1)';
  var reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
  var fineMQ = window.matchMedia('(hover: hover) and (pointer: fine)');
  var mobileMQ = window.matchMedia('(max-width: 760px)');

  var el = {
    arts: $('#arts'), title: $('#stage-title'), lead: $('#stage-lead'), cta: $('#stage-cta'), ctaT: $('#stage-cta-t'), ctaWrap: $('#stage-cta-wrap'),
    kicker: $('.stage-kicker', root), idx: $('#sk-idx'), lbl: $('#sk-lbl'), cur: $('#sn-cur'), status: $('#stage-status'),
    glass: $('#stage-panel'), glassList: $('#glass-list'), thumbs: $$('.thumb', root), prev: $('#sn-prev'), next: $('#sn-next'), prog: $$('.sn-progress i', root), art: $('#stage-art')
  };
  var N = scenes.length;
  var state = { index: 0, target: 0, running: false, anims: [], dir: 1, fast: false };
  var listeners = [];
  function on(t, ev, fn, o) { t.addEventListener(ev, fn, o); listeners.push([t, ev, fn, o]); }
  function pad(n) { return (n < 10 ? '0' : '') + (n + 1 > 9 ? '' : '') + (n + 1); }
  function icon(n) { return '<svg class="icon" aria-hidden="true" focusable="false"><use href="#i-' + n + '"/></svg>'; }
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function reduced() { return reduceMQ.matches; }
  function wrap(i) { return (i + N) % N; }

  /* ---------- Построение: визуалы и текст сцены ---------- */
  var ARS = { arch: '4/5', pebble: '1/1.05', round: '1/1', ticket: '1.28/1' };
  function buildArt(i) {
    var s = scenes[i], d = document.createElement('div');
    d.className = 'art'; d.dataset.i = i; d.setAttribute('aria-hidden', 'true');
    d.innerHTML = '<div class="art-par"><div class="art-shape shape-' + s.shape + '" style="--ar:' + ARS[s.shape] + '"><img src="/kol-winter/' + s.img + '.webp" srcset="/kol-winter/' + s.img + '-mobile.webp 660w, /kol-winter/' + s.img + '.webp 1408w" sizes="(max-width: 760px) 85vw, 640px" alt="" width="1200" height="1500" decoding="async" style="object-position:' + s.pos + '"></div><span class="art-ring shape-' + s.shape + '" style="--ar:' + ARS[s.shape] + '"></span></div>';
    return d;
  }
  var arts = [];
  function initArts() {
    arts[0] = $('.art', el.arts);
    for (var i = 1; i < N; i++) { arts[i] = buildArt(i); el.arts.appendChild(arts[i]); }
  }
  function linesHTML(i) { return scenes[i].lines.map(function (t, k) { return '<span class="ln" style="--l:' + k + '"><span>' + esc(t) + '</span></span>'; }).join(''); }
  function setText(i) {
    var s = scenes[i];
    el.title.innerHTML = linesHTML(i);
    var sl = $('.stage-link', root); if (sl && s.link) sl.textContent = s.link;
    el.lead.textContent = s.lead; el.ctaT.textContent = s.cta; el.cta.href = s.href;
    el.idx.textContent = pad(i); el.lbl.textContent = s.label; el.cur.textContent = pad(i);
    el.glassList.innerHTML = s.steps.map(function (st) { return '<li>' + icon(st[0]) + '<span>' + esc(st[1]) + '</span></li>'; }).join('');
    root.dataset.scene = s.id;
  }
  var orbs = [], arcsA = [];
  function initBg() {
    var o = $('.bg-orbs', root), a = $('.bg-arcs', root);
    orbs[0] = $('.orb', o); arcsA[0] = $('.arc', a);
    for (var i = 1; i < N; i++) {
      orbs[i] = document.createElement('i'); orbs[i].className = 'orb'; o.appendChild(orbs[i]);
      arcsA[i] = document.createElement('i'); arcsA[i].className = 'arc arc-a'; a.appendChild(arcsA[i]);
    }
    for (var k = 0; k < N; k++) { orbs[k].style.setProperty('--c', scenes[k].soft); arcsA[k].style.setProperty('--c', scenes[k].accent); }
  }
  function setAccent(i) {
    var s = scenes[i]; root.style.setProperty('--accent', s.accent); root.style.setProperty('--soft', s.soft); root.style.setProperty('--sdeep', s.deep);
    for (var k = 0; k < N; k++) { orbs[k].classList.toggle('on', k === i); arcsA[k].classList.toggle('on', k === i); }
  }
  function setNav(i) {
    el.thumbs.forEach(function (t, k) { t.setAttribute('aria-current', String(k === i)); });
    el.prog.forEach(function (p, k) { p.classList.toggle('on', k === i); p.classList.toggle('done', k < i); });
  }

  /* ---------- Анимация перехода ---------- */
  function A(node, kf, o) { var a = node.animate(kf, o); if (state.fast) a.playbackRate = 6; state.anims.push(a); return a.finished.catch(function () {}); }
  function clearAnims() { state.anims.forEach(function (a) { try { a.cancel(); } catch (e) {} }); state.anims = []; }
  function speedUp() { state.fast = true; state.anims.forEach(function (a) { try { a.playbackRate = 6; } catch (e) {} }); }

  function leaveText(rm) {
    var lines = $$('.ln>span', el.title), p = [];
    if (rm) { [el.title, el.lead, el.ctaWrap, el.kicker, el.glass].forEach(function (n) { p.push(A(n, [{ opacity: 1 }, { opacity: 0 }], { duration: 180, easing: 'linear', fill: 'forwards' })); }); return Promise.all(p); }
    lines.forEach(function (l, k) { p.push(A(l, [{ transform: 'translateY(0)' }, { transform: 'translateY(-115%)' }], { duration: 440, delay: k * 60, easing: EASE_IN, fill: 'forwards' })); });
    [el.lead, el.ctaWrap, el.kicker, el.glass].forEach(function (n, k) { p.push(A(n, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-10px)' }], { duration: 260, delay: k * 30, easing: EASE_IN, fill: 'forwards' })); });
    return Promise.all(p);
  }
  function enterText(rm) {
    var lines = $$('.ln>span', el.title), p = [];
    if (rm) { [el.title, el.lead, el.ctaWrap, el.kicker, el.glass].forEach(function (n) { p.push(A(n, [{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing: 'linear', fill: 'both' })); }); return Promise.all(p); }
    lines.forEach(function (l, k) { p.push(A(l, [{ transform: 'translateY(115%)' }, { transform: 'translateY(0)' }], { duration: 760, delay: k * 90, easing: EASE_OUT, fill: 'both' })); });
    [el.kicker, el.lead, el.ctaWrap, el.glass].forEach(function (n, k) { p.push(A(n, [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 620, delay: 160 + k * 90, easing: EASE_OUT, fill: 'both' })); });
    return Promise.all(p);
  }

  function transition(from, to, dir) {
    var rm = reduced(), mob = mobileMQ.matches, out = arts[from], inn = arts[to], ps = [];
    inn.classList.add('is-entering'); inn.removeAttribute('aria-hidden');
    var k = mob ? .6 : 1;
    if (rm) {
      ps.push(A(out, [{ opacity: 1 }, { opacity: 0 }], { duration: 220, easing: 'linear', fill: 'forwards' }));
      ps.push(A(inn, [{ opacity: 0 }, { opacity: 1 }], { duration: 260, delay: 80, easing: 'linear', fill: 'both' }));
    } else {
      // уходящий кадр: вверх и в сторону, с поворотом (как тарелка в референсе уходит за край)
      ps.push(A(out, [{ transform: 'translate3d(0,0,0) rotate(0) scale(1)', opacity: 1 },
        { transform: 'translate3d(' + (-dir * 26 * k) + '%,' + (-10 * k) + '%,0) rotate(' + (-dir * 14) + 'deg) scale(.84)', opacity: 0 }], { duration: 660, easing: EASE_IO, fill: 'forwards' }));
      // входящий: из противоположного угла, с небольшим масштабом и поворотом
      ps.push(A(inn, [{ transform: 'translate3d(' + (dir * 30 * k) + '%,' + (-16 * k) + '%,0) rotate(' + (dir * 18) + 'deg) scale(.72)', opacity: 0 },
        { opacity: 1, offset: .38 }, { transform: 'translate3d(0,0,0) rotate(0) scale(1)', opacity: 1 }], { duration: 920, delay: 190, easing: EASE_OUT, fill: 'both' }));
      // кольцо входящего кадра запаздывает, создавая глубину
      var ring = $('.art-ring', inn);
      if (ring) ps.push(A(ring, [{ opacity: 0, transform: 'translate(0,0) scale(.94)' }, { opacity: .7, transform: 'translate(5%,4%) scale(1.03)' }], { duration: 900, delay: 520, easing: EASE_OUT, fill: 'both' }));
    }
    // текст: уход → подмена → вход (подмена синхронна середине перехода кадра)
    var textFlow = leaveText(rm).then(function () {
      setText(to); clearTextAnims(); return enterText(rm);
    });
    return Promise.all([Promise.all(ps), textFlow]);
  }
  var textNodes = function () { return [el.title, el.lead, el.ctaWrap, el.kicker, el.glass].concat($$('.ln>span', el.title)); };
  function clearTextAnims() {
    // после подмены текста сбрасываем только анимации «ухода» (fill: forwards), чтобы новый текст не остался скрытым
    var keep = [];
    state.anims.forEach(function (a) {
      var t = a.effect && a.effect.target;
      var isText = t && (t === el.title || t === el.lead || t === el.ctaWrap || t === el.kicker || t === el.glass || (t.parentNode && t.parentNode.classList && t.parentNode.classList.contains('ln')));
      if (isText) { try { a.cancel(); } catch (e) {} } else keep.push(a);
    });
    state.anims = keep;
  }

  function commit(from, to) {
    clearAnims();
    // Следующая сцена начинает с нейтрального объёма и догоняет курсор плавно.
    var previousPar = $('.art-par', arts[from]);
    if (previousPar) ['--kol-mx','--kol-my','--kol-rx','--kol-ry','--kol-ix','--kol-iy','--kol-glx','--kol-gly'].forEach(function(k){ previousPar.style.removeProperty(k); });
    pc.x = pc.y = 0; kick();
    arts[from].classList.remove('is-active', 'is-entering'); arts[from].setAttribute('aria-hidden', 'true');
    arts[to].classList.remove('is-entering'); arts[to].classList.add('is-active'); arts[to].removeAttribute('aria-hidden');
    state.index = to; setText(to);
    el.status.textContent = 'Сцена ' + (to + 1) + ' из ' + N + ': ' + scenes[to].label;
  }

  function pump() {
    if (state.running || state.target === state.index) return;
    state.running = true; state.fast = false; root.classList.add('is-live');
    var from = state.index, to = state.target, dir = state.dir;
    setAccent(to);
    transition(from, to, dir).then(function () { commit(from, to); state.running = false; preload(wrap(to + 1)); preload(wrap(to - 1)); pump(); });
  }
  function go(i, dir) {
    i = wrap(i); if (i === state.target) return;
    state.dir = dir || (i > state.target ? 1 : -1);
    state.target = i; setNav(i);
    if (state.running) speedUp(); else pump();
  }
  function step(d) { go(state.target + d, d); }

  /* ---------- Предзагрузка ---------- */
  var loaded = {};
  function preload(i) { if (loaded[i]) return; loaded[i] = true; var im = new Image(); im.decoding = 'async'; im.src = '/kol-winter/' + scenes[i].img + '.webp'; }

  /* ---------- Управление ---------- */
  el.thumbs.forEach(function (t, k) { on(t, 'click', function () { go(k); }); });
  on(el.prev, 'click', function () { step(-1); });
  on(el.next, 'click', function () { step(1); });
  on(root, 'keydown', function (e) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    var t = e.target; if (t.closest && t.closest('input,select,textarea')) return;
    if (!root.contains(t)) return;
    e.preventDefault(); step(e.key === 'ArrowRight' ? 1 : -1);
  });
  // свайп: только горизонтальный жест, вертикальная прокрутка не перехватывается
  var sw = null, swiped = false;
  on(root, 'pointerdown', function (e) { if (e.pointerType === 'mouse') return; sw = { x: e.clientX, y: e.clientY, t: Date.now() }; swiped = false; }, { passive: true });
  on(root, 'pointerup', function (e) {
    if (!sw) return; var dx = e.clientX - sw.x, dy = e.clientY - sw.y, dt = Date.now() - sw.t; sw = null;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5 && dt < 900) { swiped = true; step(dx < 0 ? 1 : -1); }
  }, { passive: true });
  on(root, 'pointercancel', function () { sw = null; }, { passive: true });
  on(root, 'click', function (e) { if (swiped) { e.preventDefault(); e.stopPropagation(); swiped = false; } }, true);

  /* ---------- Параллакс (только мышь, без reduced motion) ---------- */
  var pt = { x: 0, y: 0 }, pc = { x: 0, y: 0 }, raf = 0, bgNodes = [];
  function par() {
    raf = 0; pc.x += (pt.x - pc.x) * .09; pc.y += (pt.y - pc.y) * .09;
    // Отдельный внутренний 3D-слой: не вмешивается в WAAPI переходы .art.
    var a = $('.art.is-active .art-par', el.arts);
    if (a) {
      if (parOn()) {
        a.style.setProperty('--kol-mx', (pc.x * 12).toFixed(2) + 'px');
        a.style.setProperty('--kol-my', (pc.y * 9).toFixed(2) + 'px');
        a.style.setProperty('--kol-rx', (-pc.y * 7).toFixed(2) + 'deg');
        a.style.setProperty('--kol-ry', (pc.x * 9).toFixed(2) + 'deg');
        a.style.setProperty('--kol-ix', (-pc.x * 13).toFixed(2) + 'px');
        a.style.setProperty('--kol-iy', (-pc.y * 11).toFixed(2) + 'px');
        a.style.setProperty('--kol-glx', (50 + pc.x * 17).toFixed(1) + '%');
        a.style.setProperty('--kol-gly', (38 + pc.y * 14).toFixed(1) + '%');
      } else {
        ['--kol-mx','--kol-my','--kol-rx','--kol-ry','--kol-ix','--kol-iy','--kol-glx','--kol-gly'].forEach(function(k) { a.style.removeProperty(k); });
      }
    }
    bgNodes.forEach(function (n) { n[0].style.transform = 'translate3d(' + (pc.x * n[1]).toFixed(2) + 'px,' + (pc.y * n[2]).toFixed(2) + 'px,0)'; });
    if (Math.abs(pt.x - pc.x) > .002 || Math.abs(pt.y - pc.y) > .002) raf = requestAnimationFrame(par);
  }
  function kick() { if (!raf && !document.hidden) raf = requestAnimationFrame(par); }
  function parOn() { return fineMQ.matches && !reduced(); }
  bgNodes = [[$('.bg-orbs', root), -26, -16], [$('.bg-arcs', root), 18, 12]].filter(function (n) { return n[0]; });
  on(root, 'pointermove', function (e) {
    if (e.pointerType !== 'mouse' || !parOn()) return;
    var r = root.getBoundingClientRect(); pt.x = ((e.clientX - r.left) / r.width - .5) * 2; pt.y = ((e.clientY - r.top) / r.height - .5) * 2; kick();
  }, { passive: true });
  on(root, 'pointerleave', function () { pt.x = pt.y = 0; kick(); }, { passive: true });
  on(document, 'visibilitychange', function () { if (document.hidden && raf) { cancelAnimationFrame(raf); raf = 0; } });
  function onRM() { if (reduced()) { pt.x = pt.y = pc.x = pc.y = 0; par(); } }
  if (reduceMQ.addEventListener) reduceMQ.addEventListener('change', onRM);

  /* ---------- Атмосферный блок: мягкий параллакс при прокрутке ---------- */
  var atmo = document.getElementById('atmo'), atmoImg = document.getElementById('atmo-img'), ticking = false, atmoVisible = false;
  function atmoUpdate() {
    ticking = false; if (!atmo || reduced() || !atmoVisible) return;
    var r = atmo.getBoundingClientRect(), vh = window.innerHeight, p = (r.top + r.height / 2 - vh / 2) / vh;
    atmoImg.style.setProperty('--atmo-y', (Math.max(-1, Math.min(1, p)) * -40).toFixed(1) + 'px');
  }
  if (atmo && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) { atmoVisible = es[0].isIntersecting; atmoUpdate(); }, { rootMargin: '10% 0px' }); io.observe(atmo);
    on(window, 'scroll', function () { if (!ticking && atmoVisible) { ticking = true; requestAnimationFrame(atmoUpdate); } }, { passive: true });
  }
  // линия маршрута «рисуется» при появлении
  var rp = document.getElementById('route-path');
  if (rp && 'IntersectionObserver' in window && document.documentElement.classList.contains('js-motion')) {
    var len = rp.getTotalLength ? rp.getTotalLength() : 600;
    rp.style.strokeDasharray = len; rp.style.strokeDashoffset = len; rp.style.transition = 'stroke-dashoffset 1.6s ' + EASE_OUT;
    var io2 = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { rp.style.strokeDashoffset = 0; setTimeout(function () { rp.style.strokeDasharray = '2 9'; rp.style.transition = ''; }, 1700); io2.disconnect(); } }, { threshold: .4 });
    io2.observe(rp);
  }

  /* ---------- Инициализация и очистка ---------- */
  function destroy() {
    clearAnims(); if (raf) cancelAnimationFrame(raf);
    listeners.forEach(function (l) { l[0].removeEventListener(l[1], l[2], l[3]); }); listeners = [];
    if (reduceMQ.removeEventListener) reduceMQ.removeEventListener('change', onRM);
  }
  on(window, 'pagehide', destroy);
  initArts(); initBg(); setAccent(0); setNav(0);
  setTimeout(function () { root.classList.add('is-live'); }, 2000);
  var start = function () { preload(1); preload(N - 1); };
  if ('requestIdleCallback' in window) requestIdleCallback(start, { timeout: 1500 }); else setTimeout(start, 600);
  window.KOLStage = { go: go, next: function () { step(1); }, prev: function () { step(-1); }, state: state, destroy: destroy };
})();