/* ==========================================================================
   XIRAF window manager.
   Desktop: draggable, resizable, minimise / maximise / close, z-ordered, clamped to the
   desktop. Narrow screens: every window becomes a full-height sheet (no dragging) and
   only the front one is interactive.
   Each window hosts an app; closing a window always calls the app's destroy() so games,
   consoles and observers are released.
   ========================================================================== */
import { esc, reduceMotion, clamp } from '../util.js';

const mobileMQ = matchMedia('(max-width: 719px)');
export const isMobileOS = () => mobileMQ.matches;
const MIN_W = 320, MIN_H = 240;

export function createWM(desktop, { onChange = () => {} } = {}){
  const wins = new Map();
  let z = 20, cascade = 0, activeId = null, destroyed = false;
  const bounds = () => ({ w: desktop.clientWidth, h: desktop.clientHeight });

  function emit(){ onChange({ windows: [...wins.values()], activeId }); }

  function updateInert(){
    const m = isMobileOS();
    for (const w of wins.values()){
      const hide = w.min || (m && w.id !== activeId);
      w.el.toggleAttribute('inert', hide);
      w.el.setAttribute('aria-hidden', String(hide));
      w.el.classList.toggle('xw-behind', m && w.id !== activeId && !w.min);
    }
  }

  function applyRect(w){
    if (isMobileOS()){ w.el.style.left = w.el.style.top = w.el.style.width = w.el.style.height = ''; return; }
    const b = bounds(), r = w.rect;
    r.w = clamp(r.w, Math.min(MIN_W, b.w), b.w); r.h = clamp(r.h, Math.min(MIN_H, b.h), b.h);
    r.x = clamp(r.x, 0, Math.max(0, b.w - r.w)); r.y = clamp(r.y, 0, Math.max(0, b.h - 40));
    if (w.max){ Object.assign(w.el.style, { left: '0px', top: '0px', width: b.w + 'px', height: b.h + 'px' }); return; }
    Object.assign(w.el.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' });
  }

  function focus(w, { restoreIfMin = true } = {}){
    if (!w || destroyed) return;
    if (w.min && restoreIfMin) restore(w, false);
    activeId = w.id; w.el.style.zIndex = ++z;
    for (const o of wins.values()) o.el.classList.toggle('xw-active', o === w);
    updateInert(); emit();
  }

  function front(){
    let top = null;
    for (const w of wins.values()) if (!w.min && (!top || +w.el.style.zIndex > +top.el.style.zIndex)) top = w;
    return top;
  }

  function open(def, opts = {}){
    if (destroyed) return null;
    const ex = wins.get(def.id);
    if (ex){ focus(ex); opts.onExisting?.(ex); ex.el.querySelector('.xw-body')?.focus?.({ preventScroll: true }); return ex; }

    const b = bounds(), mobile = isMobileOS();
    const w0 = Math.min(def.w || 640, b.w - 24), h0 = Math.min(def.h || 440, b.h - 24);
    const off = (cascade++ % 6) * 28;
    const win = { id: def.id, def, min: false, max: false, inst: null, title: def.title,
      rect: { x: clamp(Math.round((b.w - w0) / 2) - 60 + off, 8, Math.max(8, b.w - w0 - 8)), y: clamp(Math.round((b.h - h0) / 2) - 40 + off, 8, Math.max(8, b.h - h0 - 8)), w: w0, h: h0 } };

    const el = document.createElement('section');
    el.className = 'xw xw-in glass-os'; el.dataset.app = def.id;
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', def.title);
    el.innerHTML = `
      <header class="xw-bar">
        <span class="xw-ico" aria-hidden="true">${def.icon || ''}</span>
        <h2 class="xw-title">${esc(def.title)}</h2>
        <div class="xw-btns">
          <button type="button" class="xw-btn" data-w="min" aria-label="Minimize ${esc(def.title)}"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 11h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button>
          <button type="button" class="xw-btn xw-max" data-w="max" aria-label="Maximize ${esc(def.title)}"><svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3.2" y="3.2" width="9.6" height="9.6" rx="1.8" fill="none" stroke="currentColor" stroke-width="1.5"/></svg></button>
          <button type="button" class="xw-btn xw-x" data-w="close" aria-label="Close ${esc(def.title)}"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button>
        </div>
      </header>
      <div class="xw-body" tabindex="-1"></div>
      <i class="xw-rs" data-rs aria-hidden="true"></i>`;
    win.el = el; win.body = el.querySelector('.xw-body'); win.titleEl = el.querySelector('.xw-title');
    desktop.appendChild(el); wins.set(def.id, win);
    applyRect(win);

    const api = {
      setTitle(t){ win.title = t; win.titleEl.textContent = t; el.setAttribute('aria-label', t); },
      close: () => close(win), focus: () => focus(win), win
    };
    try { win.inst = def.mount(win.body, api, opts) || null; }
    catch (e){ console.error(e); win.body.innerHTML = '<p class="xw-error">This app couldn’t start.</p>'; }
    el.addEventListener('animationend', e => { if (e.animationName === 'xw-in') el.classList.remove('xw-in'); });
    wire(win);
    focus(win);
    if (!mobile) win.body.focus({ preventScroll: true });
    return win;
  }

  function wire(w){
    const el = w.el;
    el.addEventListener('pointerdown', () => { if (activeId !== w.id) focus(w); }, true);
    el.addEventListener('focusin', () => { if (activeId !== w.id) focus(w); });
    el.addEventListener('click', e => {
      const b = e.target.closest('[data-w]'); if (!b) return;
      const a = b.dataset.w;
      if (a === 'close') close(w); else if (a === 'min') minimize(w); else if (a === 'max') toggleMax(w);
    });
    const bar = el.querySelector('.xw-bar');
    bar.addEventListener('dblclick', e => { if (!e.target.closest('button') && !isMobileOS()) toggleMax(w); });

    let drag = null;
    bar.addEventListener('pointerdown', e => {
      if (e.button > 0 || e.target.closest('button') || isMobileOS() || w.max) return;
      drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, x: w.rect.x, y: w.rect.y };
      bar.setPointerCapture(e.pointerId); el.classList.add('xw-dragging');
    });
    bar.addEventListener('pointermove', e => {
      if (!drag || e.pointerId !== drag.id) return;
      const b = bounds();
      w.rect.x = clamp(drag.x + e.clientX - drag.sx, -w.rect.w + 80, b.w - 80);
      w.rect.y = clamp(drag.y + e.clientY - drag.sy, 0, b.h - 40);
      el.style.left = w.rect.x + 'px'; el.style.top = w.rect.y + 'px';
    });
    const endDrag = e => { if (drag && e.pointerId === drag.id){ drag = null; el.classList.remove('xw-dragging'); applyRect(w); } };
    bar.addEventListener('pointerup', endDrag); bar.addEventListener('pointercancel', endDrag);

    const rs = el.querySelector('[data-rs]'); let rz = null;
    rs.addEventListener('pointerdown', e => {
      if (e.button > 0 || isMobileOS() || w.max) return;
      rz = { id: e.pointerId, sx: e.clientX, sy: e.clientY, w: w.rect.w, h: w.rect.h };
      rs.setPointerCapture(e.pointerId); el.classList.add('xw-dragging'); e.preventDefault();
    });
    rs.addEventListener('pointermove', e => {
      if (!rz || e.pointerId !== rz.id) return;
      const b = bounds();
      w.rect.w = clamp(rz.w + e.clientX - rz.sx, MIN_W, b.w - w.rect.x); w.rect.h = clamp(rz.h + e.clientY - rz.sy, MIN_H, b.h - w.rect.y);
      el.style.width = w.rect.w + 'px'; el.style.height = w.rect.h + 'px';
    });
    const endRz = e => { if (rz && e.pointerId === rz.id){ rz = null; el.classList.remove('xw-dragging'); } };
    rs.addEventListener('pointerup', endRz); rs.addEventListener('pointercancel', endRz);
  }

  function toggleMax(w){
    w.max = !w.max; w.el.classList.toggle('xw-maxed', w.max);
    const btn = w.el.querySelector('.xw-max'); btn.setAttribute('aria-label', (w.max ? 'Restore ' : 'Maximize ') + w.title);
    applyRect(w);
  }

  function minimize(w){
    if (w.min) return;
    w.min = true;
    const done = () => { w.el.classList.add('xw-hidden'); };
    if (reduceMotion.matches) done(); else { w.el.classList.add('xw-minimizing'); setTimeout(() => { w.el.classList.remove('xw-minimizing'); done(); }, 200); }
    const next = front(); activeId = null; emit();
    if (next) focus(next); else { updateInert(); emit(); }
  }
  function restore(w, andFocus = true){
    if (!w.min) return;
    w.min = false; w.el.classList.remove('xw-hidden', 'xw-minimizing');
    if (!reduceMotion.matches){ w.el.classList.add('xw-in'); }
    if (andFocus) focus(w, { restoreIfMin: false }); else { updateInert(); }
  }

  function teardown(w){
    try { w.inst?.destroy?.(); } catch (e){ console.error(e); }
    w.el.remove(); wins.delete(w.id);
  }
  function close(w){
    if (!w || w.closing || !wins.has(w.id)) return;
    w.closing = true; w.el.setAttribute('inert', '');
    const finish = () => {
      teardown(w);
      if (activeId === w.id) activeId = null;
      const next = front(); if (next) focus(next); else { updateInert(); emit(); }
      w.def.onClosed?.();
    };
    if (reduceMotion.matches) finish(); else { w.el.classList.remove('xw-in'); w.el.classList.add('xw-out'); setTimeout(finish, 190); }
  }

  const onResize = () => { for (const w of wins.values()) applyRect(w); updateInert(); };
  addEventListener('resize', onResize);
  mobileMQ.addEventListener('change', onResize);

  return {
    open, close, focus, minimize, restore, front,
    get: id => wins.get(id) || null,
    list: () => [...wins.values()],
    get activeId(){ return activeId; },
    /* immediate teardown, used when leaving XIRAF */
    closeAll(){ for (const w of [...wins.values()]) teardown(w); activeId = null; emit(); },
    destroy(){ destroyed = true; removeEventListener('resize', onResize); mobileMQ.removeEventListener('change', onResize); for (const w of [...wins.values()]) teardown(w); }
  };
}
