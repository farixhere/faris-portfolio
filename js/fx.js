/* ==========================================================================
   Small, self-cleaning visual effects used by console commands.
   Everything here is opt-in (a visitor has to type the command), respects
   prefers-reduced-motion, and removes every node / loop it creates.
   ========================================================================== */
import { reduceMotion, store } from './util.js';

export const ACCENTS = ['violet', 'cyan', 'rose', 'amber', 'mint'];

export function setAccent(name, persist = true){
  const root = document.documentElement;
  if (!name || name === 'reset' || name === 'default'){ root.removeAttribute('data-accent'); if (persist) store.set('faris-accent', ''); return 'violet'; }
  if (!ACCENTS.includes(name)) return null;
  root.setAttribute('data-accent', name);
  if (persist) store.set('faris-accent', name);
  return name;
}
export const getAccent = () => document.documentElement.getAttribute('data-accent') || 'violet';

let rain = null;
export function matrix(ms = 6000){
  if (reduceMotion.matches) return false;
  if (rain) return true;
  const c = document.createElement('canvas');
  c.className = 'fx-matrix'; c.setAttribute('aria-hidden', 'true');
  const ctx = c.getContext('2d');
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const size = () => { c.width = innerWidth * dpr; c.height = innerHeight * dpr; };
  size(); document.body.appendChild(c);
  const fs = 16 * dpr, cols = Math.ceil(c.width / fs), drops = Array.from({ length: cols }, () => Math.random() * -40);
  const chars = 'FARIS01アイウエオカキクケコサシスセソ◇◆✦';
  const css = getComputedStyle(document.documentElement);
  const colour = css.getPropertyValue('--accent-2').trim() || '#9ad';
  let raf = 0, t0 = performance.now(), last = 0;
  const frame = now => {
    raf = requestAnimationFrame(frame);
    if (now - last < 45) return; last = now;
    ctx.fillStyle = 'rgba(0,0,0,.08)'; ctx.globalCompositeOperation = 'destination-out'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.globalCompositeOperation = 'source-over'; ctx.font = fs + 'px "DM Mono",monospace'; ctx.fillStyle = colour;
    for (let i = 0; i < cols; i++){
      const y = drops[i] * fs;
      if (y > 0) ctx.fillText(chars[(Math.random() * chars.length) | 0], i * fs, y);
      if (y > c.height && Math.random() > .97) drops[i] = 0; else drops[i] += 1;
    }
    if (now - t0 > ms){ stop(); }
  };
  const stop = () => {
    cancelAnimationFrame(raf); removeEventListener('resize', size);
    c.classList.add('out'); setTimeout(() => { c.remove(); rain = null; }, 600);
  };
  addEventListener('resize', size);
  rain = { stop }; raf = requestAnimationFrame(frame);
  return true;
}

export function confetti(n = 44){
  if (reduceMotion.matches) return false;
  const wrap = document.createElement('div'); wrap.className = 'fx-confetti'; wrap.setAttribute('aria-hidden', 'true');
  document.body.appendChild(wrap);
  const hues = ['var(--a1)', 'var(--a2)', 'var(--a3)', '#fff'];
  const anims = [];
  for (let i = 0; i < n; i++){
    const p = document.createElement('i');
    const s = 6 + Math.random() * 9;
    p.style.cssText = `width:${s}px;height:${s * (0.6 + Math.random() * .8)}px;background:${hues[i % hues.length]};left:${Math.random() * 100}%;top:-4vh`;
    wrap.appendChild(p);
    const dx = (Math.random() - .5) * 240, dur = 1600 + Math.random() * 1400;
    anims.push(p.animate([
      { transform: 'translate(0,0) rotate(0deg)', opacity: 1 },
      { transform: `translate(${dx}px,${105 + Math.random() * 15}vh) rotate(${(Math.random() - .5) * 900}deg)`, opacity: .9 }
    ], { duration: dur, delay: Math.random() * 400, easing: 'cubic-bezier(.2,.6,.4,1)', fill: 'forwards' }).finished.catch(() => {}));
  }
  Promise.all(anims).then(() => wrap.remove());
  setTimeout(() => wrap.remove(), 4200);
  return true;
}
