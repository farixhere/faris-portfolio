/* ==========================================================================
   Shared helpers: DOM, escaping, storage, motion/performance profile, toast
   ========================================================================== */
export const $  = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
export const safeUrl = u => { const s = String(u ?? '').trim(); return /^https?:\/\//i.test(s) ? s : ''; };

export const store = {
  get(k){ try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v){ try { localStorage.setItem(k, v); } catch { /* private mode etc. */ } },
  json(k, fallback){ try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch { return fallback; } }
};

export const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
export const coarsePointer = matchMedia('(pointer: coarse)');
export const narrow = matchMedia('(max-width: 719px)');

/* Animation detail is tuned, never removed: phones get fewer fragments and a smaller blur,
   but still get the full shatter / rebuild effect. */
export function perfProfile(){
  const lite = narrow.matches || coarsePointer.matches || (navigator.hardwareConcurrency || 8) <= 4;
  return lite
    ? { lite: true,  maxRays: 5, maxShards: 14, duration: 820, stagger: 260, edges: false, cloneBudget: 150 }
    : { lite: false, maxRays: 8, maxShards: 26, duration: 1080, stagger: 380, edges: true,  cloneBudget: 420 };
}

/* Tiny seeded PRNG so a panel shatters the same way after a re-render. */
export function rng(seed){
  let a = seed >>> 0;
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export const hashStr = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/* ── Toast + screen-reader announcements ───────────────────────────────── */
let toastTimer;
export function toast(msg){
  const t = $('#toast'); if (!t) return;
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}
export function announce(msg){
  const el = $('#srLive'); if (!el) return;
  el.textContent = '';
  requestAnimationFrame(() => { el.textContent = msg; });
}

/* ── Sound (off by default, user-controlled, never autoplays) ───────────── */
export const soundOn = () => store.get('faris-sound') === 'on';
export function beep(freq = 520){
  if (!soundOn()) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = window.__ac || (window.__ac = new AC());
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = freq; g.gain.value = .025;
    o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + .045);
  } catch { /* audio unavailable */ }
}

/* ── Theme ──────────────────────────────────────────────────────────────── */
export const getTheme = () => document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
export function setTheme(v, persist = true){
  document.documentElement.dataset.theme = v;
  if (persist) store.set('faris-theme-v2', v);
  $('meta[name=theme-color]')?.setAttribute('content', v === 'dark' ? '#0F0E0C' : '#F4EFE6');
  const b = $('#themeToggle');
  if (b) b.setAttribute('aria-label', v === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
  document.dispatchEvent(new CustomEvent('faris:theme', { detail: v }));
}

/* Minimal event bus shared by the console, OS and arcade. */
export const bus = new EventTarget();
export const emit = (name, detail) => bus.dispatchEvent(new CustomEvent(name, { detail }));
export const on = (name, fn) => { const h = e => fn(e.detail); bus.addEventListener(name, h); return () => bus.removeEventListener(name, h); };
