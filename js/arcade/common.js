/* ==========================================================================
   Arcade helpers shared by the five games.
   Contract every game follows:

     export default function create(container, opts) -> { destroy(), pause(), restart() }

   • A game only listens to keys while focus is inside its own container, so gameplay
     can never hijack the page (arrow keys / Space keep scrolling the page elsewhere).
   • destroy() releases every frame, timer, observer and listener the game created.
   ========================================================================== */
import { store } from '../util.js';

export const best = {
  get: name => +store.get('faris-best-' + name) || 0,
  /* returns true when `value` is a new record */
  submit(name, value, lowerIsBetter = false){
    const cur = best.get(name);
    const better = lowerIsBetter ? (cur === 0 || value < cur) : value > cur;
    if (better && value > 0) store.set('faris-best-' + name, String(value));
    return better && value > 0;
  }
};

/* requestAnimationFrame loop with clamped delta time. */
export function createLoop(step, draw){
  let raf = 0, last = 0, running = false;
  const frame = t => {
    if (!running) return;
    const dt = Math.min(0.05, (t - last) / 1000); last = t;
    step(dt); draw();
    raf = requestAnimationFrame(frame);
  };
  return {
    start(){ if (running) return; running = true; last = performance.now(); raf = requestAnimationFrame(frame); },
    stop(){ running = false; cancelAnimationFrame(raf); },
    get running(){ return running; }
  };
}

/* Keep a canvas crisp at any size / device pixel ratio while preserving its logical aspect. */
export function fitCanvas(canvas, logicalW, logicalH, host){
  const ctx = canvas.getContext('2d');
  const apply = () => {
    const r = host.getBoundingClientRect();
    const maxW = Math.max(160, r.width), maxH = Math.max(160, r.height || 9999);
    const scale = Math.min(maxW / logicalW, maxH / logicalH);
    const cssW = Math.floor(logicalW * scale), cssH = Math.floor(logicalH * scale);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.style.width = cssW + 'px'; canvas.style.height = cssH + 'px';
    canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr);
    ctx.setTransform(canvas.width / logicalW, 0, 0, canvas.height / logicalH, 0, 0);
  };
  apply();
  const ro = new ResizeObserver(apply); ro.observe(host);
  return { ctx, destroy: () => ro.disconnect(), refit: apply };
}

/* Overlay used for start / paused / game-over messages (real DOM, so it is accessible). */
export function createOverlay(container){
  const el = document.createElement('div');
  el.className = 'g-overlay'; el.hidden = true;
  el.innerHTML = '<div class="g-card" role="status" aria-live="polite"><h3></h3><p></p><button type="button" class="g-btn"></button></div>';
  container.appendChild(el);
  const h = el.querySelector('h3'), p = el.querySelector('p'), b = el.querySelector('button');
  let cb = null;
  b.addEventListener('click', () => cb?.());
  return {
    el,
    show(title, text, label, onClick){ h.textContent = title; p.textContent = text || ''; b.textContent = label; cb = onClick; el.hidden = false; setTimeout(() => b.focus({ preventScroll: true }), 30); },
    hide(){ el.hidden = true; cb = null; },
    get visible(){ return !el.hidden; }
  };
}

/* Swipe detection on any element (touch, pen or mouse drag). Doesn't block page scroll outside the element. */
export function onSwipe(el, cb, threshold = 26){
  let sx = 0, sy = 0, id = null;
  const down = e => { id = e.pointerId; sx = e.clientX; sy = e.clientY; };
  const up = e => {
    if (e.pointerId !== id) return; id = null;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold) return;
    cb(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
  };
  const cancel = () => { id = null; };
  el.addEventListener('pointerdown', down); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', cancel);
  return () => { el.removeEventListener('pointerdown', down); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', cancel); };
}

/* On-screen direction pad (touch / small screens). */
export function dpad(container, onDir){
  const el = document.createElement('div');
  el.className = 'g-dpad'; el.setAttribute('role', 'group'); el.setAttribute('aria-label', 'Direction controls');
  const mk = (dir, label, glyph) => `<button type="button" class="g-dir g-${dir}" data-dir="${dir}" aria-label="${label}">${glyph}</button>`;
  el.innerHTML = mk('up', 'Up', '▲') + mk('left', 'Left', '◀') + mk('down', 'Down', '▼') + mk('right', 'Right', '▶');
  const h = e => { const b = e.target.closest('[data-dir]'); if (b){ e.preventDefault(); onDir(b.dataset.dir); } };
  el.addEventListener('pointerdown', h);
  el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' '){ const b = e.target.closest('[data-dir]'); if (b){ e.preventDefault(); onDir(b.dataset.dir); } } });
  container.appendChild(el);
  return el;
}

export const KEY_DIR = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', W: 'up', s: 'down', S: 'down', a: 'left', A: 'left', d: 'right', D: 'right' };

/* Standard game chrome: score line + play area. Returns the pieces. */
export function chrome(container, { title, stats }){
  container.classList.add('game-root'); container.tabIndex = 0;
  container.setAttribute('role', 'group'); container.setAttribute('aria-label', title + ' game');
  container.innerHTML = `
    <div class="g-hud" aria-live="off">${stats.map(s => `<span class="g-stat"><small>${s.label}</small><b data-stat="${s.id}">${s.value ?? 0}</b></span>`).join('')}</div>
    <div class="g-play"></div>`;
  const hud = container.querySelector('.g-hud'), play = container.querySelector('.g-play');
  const set = (id, v) => { const n = hud.querySelector(`[data-stat="${id}"]`); if (n) n.textContent = v; };
  return { hud, play, set };
}
