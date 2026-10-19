/* ==========================================================================
   FARIS Glass — independent shatter / rebuild panels

   Every element carrying [data-gp] becomes its own small state machine:

        intact ──shatter──▶ exploding ──(settled)──▶ collapsed
          ▲                                              │
          └────(finished)──── rebuilding ◀──rebuild──────┘

   • Fragments come from the panel's own geometry: radial cracks spreading from the
     impact point, clipped to the panel rectangle, each fragment carrying a clone of the
     panel's real content so the break starts pixel-identical to the intact panel.
   • The original content is never destroyed — it is only hidden + made inert while the
     panel is broken, then revealed again on rebuild (so nothing can be lost).
   • Events arriving in the wrong state are ignored, so rapid double clicks can't corrupt
     an animation. State is per panel, so panels never affect each other.
   • Everything it creates (nodes, animations, observers, listeners) is released on
     rebuild / destroy.

   Interaction: a panel shatters on the THIRD tap within a short window. Taps 1 and 2 only
   crack it (a small shake + growing crack lines), and the count resets if the visitor
   pauses. There is no "Shatter" button. Once broken, a small "Rebuild" control appears
   (also reachable by tapping the debris), and the console has `shatter` / `rebuild`.

   Markup contract: a panel's direct children must be elements (not bare text).
   ========================================================================== */
import { $$, announce, perfProfile, reduceMotion, rng, hashStr, clamp } from './util.js';

const INTERACTIVE = 'a[href],button,input,textarea,select,summary,label,[role=button],[contenteditable],[data-gp-ignore]';
const ICON = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3M18 3v4h-4M6 21v-4h4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const TAPS_TO_BREAK = 3, TAP_WINDOW = 2600;

const registry = new WeakMap();
const collapsedKeys = new Set();          // survives re-renders (e.g. changing the project filter)
const sessionCounts = new Map();          // key → times shattered, so repeated shatters differ a little
let uid = 0;

/* ── geometry ──────────────────────────────────────────────────────────── */
function clipToRect(poly, w, h){
  const edges = [
    [p => p[0] >= 0,  (a, b) => [0, a[1] + (b[1] - a[1]) * (0 - a[0]) / (b[0] - a[0])]],
    [p => p[0] <= w,  (a, b) => [w, a[1] + (b[1] - a[1]) * (w - a[0]) / (b[0] - a[0])]],
    [p => p[1] >= 0,  (a, b) => [a[0] + (b[0] - a[0]) * (0 - a[1]) / (b[1] - a[1]), 0]],
    [p => p[1] <= h,  (a, b) => [a[0] + (b[0] - a[0]) * (h - a[1]) / (b[1] - a[1]), h]]
  ];
  let out = poly;
  for (const [inside, cross] of edges){
    const input = out; out = [];
    if (!input.length) break;
    for (let i = 0; i < input.length; i++){
      const cur = input[i], prev = input[(i + input.length - 1) % input.length];
      const ci = inside(cur), pi = inside(prev);
      if (ci){ if (!pi) out.push(cross(prev, cur)); out.push(cur); }
      else if (pi) out.push(cross(prev, cur));
    }
  }
  return out;
}
const polyArea = p => { let s = 0; for (let i = 0; i < p.length; i++){ const a = p[i], b = p[(i + 1) % p.length]; s += a[0] * b[1] - b[0] * a[1]; } return Math.abs(s) / 2; };

/* Cracks radiate from the impact point P: rays × concentric rings tile the whole plane,
   then every tile is clipped to the panel. Shared vertices ⇒ no gaps between fragments. */
function buildShards(w, h, P, rand, prof, nodeCount){
  const area = w * h;
  let rays = clamp(Math.round(Math.sqrt(area) / 52), 5, prof.maxRays);
  let rings = area > 90000 ? 2 : 1;
  while (rays * (rings + 1) > prof.maxShards && (rings > 1 || rays > 5)){ if (rings > 1) rings--; else rays--; }
  const cloneContent = rays * (rings + 1) * nodeCount <= prof.cloneBudget;

  const R = Math.max(Math.hypot(P.x, P.y), Math.hypot(w - P.x, P.y), Math.hypot(P.x, h - P.y), Math.hypot(w - P.x, h - P.y));
  const radii = [0];
  for (let k = 1; k <= rings; k++) radii.push(R * Math.pow(k / (rings + 1), 1.35) * (0.9 + rand() * 0.2));
  radii.push(R * 2.2);

  const base = rand() * Math.PI * 2, step = Math.PI * 2 / rays;
  const ang = Array.from({ length: rays }, (_, i) => base + (i + (rand() - 0.5) * 0.55) * step);
  const V = ang.map(a => radii.map((r, k) => {
    const j = (k === 0 || k === radii.length - 1) ? 1 : 0.92 + rand() * 0.16;
    return [P.x + Math.cos(a) * r * j, P.y + Math.sin(a) * r * j];
  }));

  const tiles = [];
  for (let i = 0; i < rays; i++){
    const n = (i + 1) % rays;
    tiles.push([[P.x, P.y], V[i][1], V[n][1]]);
    for (let k = 1; k <= rings; k++) tiles.push([V[i][k], V[n][k], V[n][k + 1], V[i][k + 1]]);
  }

  const shards = [];
  for (const tile of tiles){
    let poly = clipToRect(tile, w, h);
    if (poly.length < 3) continue;
    const a = polyArea(poly); if (a < 2) continue;
    const cx0 = poly.reduce((s, p) => s + p[0], 0) / poly.length, cy0 = poly.reduce((s, p) => s + p[1], 0) / poly.length;
    /* grow each fragment by half a pixel so anti-aliasing never leaves hairline seams */
    poly = poly.map(([x, y]) => {
      const dx = x - cx0, dy = y - cy0, L = Math.hypot(dx, dy) || 1;
      return [clamp(x + dx / L * 0.6, 0, w), clamp(y + dy / L * 0.6, 0, h)];
    });
    const xs = poly.map(p => p[0]), ys = poly.map(p => p[1]);
    const bx = Math.floor(Math.min(...xs)), by = Math.floor(Math.min(...ys));
    const bw = Math.ceil(Math.max(...xs)) - bx, bh = Math.ceil(Math.max(...ys)) - by;
    shards.push({ poly, bx, by, bw: Math.max(1, bw), bh: Math.max(1, bh), cx: cx0, cy: cy0, area: a, dist: Math.hypot(cx0 - P.x, cy0 - P.y) });
  }
  return { shards, cloneContent, maxDist: Math.max(1, ...shards.map(s => s.dist)) };
}

/* Per-fragment motion plan: where it cracks to, where it falls, how it comes to rest. */
function planShard(s, P, w, h, maxDist, rand, prof){
  const dx0 = s.cx - P.x, dy0 = s.cy - P.y, len = Math.hypot(dx0, dy0) || 1;
  let ux = dx0 / len, uy = dy0 / len;
  if (len < 2){ const t = rand() * 6.28; ux = Math.cos(t); uy = Math.sin(t); }
  const near = clamp(1 - len / maxDist, 0.2, 1);
  const push = (14 + 58 * near) * (0.7 + rand() * 0.6);
  const sc = 0.6 + rand() * 0.28;
  const rot = (rand() - 0.5) * (60 + 80 * near);
  const halfH = s.bh * sc / 2;
  const landCy = h + 4 - halfH * 0.85 - rand() * Math.min(h * 0.16, 46);
  const landCx = clamp(s.cx + ux * push * 1.5 + (rand() - 0.5) * 26, -w * 0.03, w * 1.03);
  return {
    crack: { x: ux * (5 + 9 * near), y: uy * (5 + 9 * near) - 2, r: (rand() - 0.5) * 6 },
    rest:  { x: landCx - s.cx, y: landCy - s.cy, r: rot, s: sc },
    delay: (len / maxDist) * prof.stagger * 0.3,
    dur:   prof.duration * (0.86 + rand() * 0.3)
  };
}
const tf = (x, y, r, sc) => `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) rotate(${r.toFixed(1)}deg) scale(${sc.toFixed(3)})`;

/* ── the panel controller ──────────────────────────────────────────────── */
class Panel {
  constructor(el){
    this.el = el; this.destroyed = false; this.state = 'intact';
    this.key = el.dataset.gpKey || ('gp-' + (++uid));
    this.label = (el.dataset.gpLabel || el.querySelector('h1,h2,h3,h4')?.textContent || 'panel').trim().slice(0, 48);
    this.layer = null; this.shards = []; this.anims = []; this.token = 0; this.ro = null; this.size = null; this.down = null;

    el.classList.add('gp'); el.dataset.state = 'intact'; el.dataset.gpReady = '';
    this.toggle = null; this.taps = 0; this.tapTimer = 0; this.crack = null; this.crackPts = [];

    this.onDown = e => { this.down = { x: e.clientX, y: e.clientY }; };
    this.onClick = e => this.surfaceClick(e);
    el.addEventListener('pointerdown', this.onDown, { passive: true });
    el.addEventListener('click', this.onClick);

    if (collapsedKeys.has(this.key)) this.restoreCollapsed();
  }

  /* direct children that make up the panel's content (everything we didn't add) */
  contents(){ return [...this.el.children].filter(c => !c.classList.contains('gp-keep')); }

  /* the only visible control: a "Rebuild" pill, present just while the panel is broken */
  paintToggle(){
    const s = this.state, broken = s === 'collapsed' || s === 'rebuilding' || s === 'exploding';
    if (!broken){ this.toggle?.remove(); this.toggle = null; return; }
    if (!this.toggle){
      this.toggle = document.createElement('button');
      this.toggle.type = 'button'; this.toggle.className = 'gp-toggle gp-keep';
      this.toggle.innerHTML = ICON + '<span class="gp-txt">Rebuild</span>';
      this.toggle.addEventListener('click', this.onToggle ||= e => { e.stopPropagation(); this.rebuild(); });
      this.el.appendChild(this.toggle);
    }
    this.toggle.setAttribute('aria-label', 'Rebuild ' + this.label + ' panel');
    this.toggle.setAttribute('aria-disabled', String(s === 'exploding' || s === 'rebuilding'));
    this.toggle.title = 'Rebuild panel';
  }

  /* ── tap counting + crack feedback (taps 1 & 2) ─────────────────── */
  clearCracks(){ clearTimeout(this.tapTimer); this.tapTimer = 0; this.taps = 0; this.crackPts = []; this.crack?.remove(); this.crack = null; }
  registerTap(P){
    this.taps++; clearTimeout(this.tapTimer);
    if (this.taps >= TAPS_TO_BREAK){ const pt = P; this.clearCracks(); return this.shatter(pt); }
    this.crackPts.push({ x: P.x - P.r.left, y: P.y - P.r.top });
    this.drawCracks();
    this.tapTimer = setTimeout(() => this.fadeCracks(), TAP_WINDOW);
    if (!reduceMotion.matches){
      const d = this.taps === 1 ? 2.2 : 3.6;
      this.el.animate([{ translate: '0 0' }, { translate: `${-d}px ${d * .4}px` }, { translate: `${d}px ${-d * .4}px` }, { translate: `${-d * .5}px 0` }, { translate: '0 0' }], { duration: 240, easing: 'ease-out' });
    }
    announce(`${this.label} panel cracked. ${TAPS_TO_BREAK - this.taps} more ${TAPS_TO_BREAK - this.taps === 1 ? 'tap' : 'taps'} to shatter.`);
    return true;
  }
  drawCracks(){
    const w = this.el.offsetWidth, h = this.el.offsetHeight;
    if (!this.crack){
      this.crack = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      this.crack.setAttribute('class', 'gp-crack gp-keep'); this.crack.setAttribute('aria-hidden', 'true');
      this.el.appendChild(this.crack);
    }
    this.crack.setAttribute('viewBox', `0 0 ${w} ${h}`);
    const rand = rng(hashStr(this.key) + this.taps * 131), reach = Math.min(w, h) * (0.16 + 0.14 * this.taps);
    let d = '';
    for (const p of this.crackPts){
      const n = 5 + this.taps * 2, base = rand() * 6.28;
      for (let i = 0; i < n; i++){
        let a = base + i * 6.28 / n + (rand() - .5) * .6, x = p.x, y = p.y, len = reach * (0.45 + rand() * .75);
        d += `M${x.toFixed(1)} ${y.toFixed(1)}`;
        for (let k = 0; k < 4; k++){ const seg = len / 4; a += (rand() - .5) * .7; x += Math.cos(a) * seg; y += Math.sin(a) * seg; d += `L${x.toFixed(1)} ${y.toFixed(1)}`; }
      }
    }
    this.crack.innerHTML = `<path d="${d}" class="gp-crack-glow"/><path d="${d}" class="gp-crack-line"/>`;
    this.crack.classList.remove('is-in'); void this.crack.getBoundingClientRect(); this.crack.classList.add('is-in');
  }
  fadeCracks(){
    const c = this.crack; this.taps = 0; this.crackPts = []; this.crack = null; this.tapTimer = 0;
    if (!c) return;
    c.classList.add('is-out'); setTimeout(() => c.remove(), 500);
  }

  setState(s){
    this.state = s; this.el.dataset.state = s;
    const hide = s !== 'intact';
    for (const c of this.contents()){
      if (hide){
        if (!c.hasAttribute('inert')){ c.setAttribute('inert', ''); c.dataset.gpInert = '1'; }
        if (!c.hasAttribute('aria-hidden')){ c.setAttribute('aria-hidden', 'true'); c.dataset.gpAria = '1'; }
      } else {
        if (c.dataset.gpInert){ c.removeAttribute('inert'); delete c.dataset.gpInert; }
        if (c.dataset.gpAria){ c.removeAttribute('aria-hidden'); delete c.dataset.gpAria; }
      }
    }
    this.paintToggle();
    this.el.dispatchEvent(new CustomEvent('gp:state', { detail: { state: s, key: this.key }, bubbles: true }));
  }

  surfaceClick(e){
    if (e.defaultPrevented || this.destroyed) return;
    if (this.el.dataset.gpSurface === 'off') return;
    if (e.target.closest('.gp-toggle')) return;
    if (this.state === 'collapsed'){ this.rebuild(); return; }
    if (this.state !== 'intact') return;
    const hit = e.target.closest(INTERACTIVE);
    if (hit && hit !== this.el && this.el.contains(hit)) return;          // buttons, links, fields keep their own behaviour
    const sel = window.getSelection?.();
    if (sel && String(sel).length && this.el.contains(sel.anchorNode)) return; // user is selecting text
    if (this.down && Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) > 8) return; // a drag, not a tap
    this.registerTap({ x: e.clientX, y: e.clientY, r: this.el.getBoundingClientRect() });
  }

  /* ── build the fragment layer ─────────────────────────────────────── */
  makeLayer(from, prof, count){
    const el = this.el;
    el.classList.add('gp-busy');                       // freeze tilt so geometry is measured flat
    void el.offsetWidth;
    const w = el.offsetWidth, h = el.offsetHeight;
    const r = from?.r || el.getBoundingClientRect();
    const P = from ? { x: clamp(from.x - r.left, 0, w), y: clamp(from.y - r.top, 0, h) } : { x: w / 2, y: h / 2 };
    const rand = rng(hashStr(this.key) + count * 7919);

    const kids = this.contents();
    const nodes = kids.reduce((n, c) => n + 1 + c.querySelectorAll('*').length, 0);
    const geo = buildShards(w, h, P, rand, prof, nodes);

    /* one deep copy of the content per fragment — ids stripped, inert, form values carried over */
    let tpl = null;
    if (geo.cloneContent){
      tpl = el.cloneNode(false);
      for (const a of [...tpl.attributes]) if (/^(id|tabindex|style|data-gp.*|data-state|aria-.*|role|inert)$/i.test(a.name)) tpl.removeAttribute(a.name);
      tpl.classList.remove('gp', 'reveal', 'in', 'gp-busy');
      tpl.classList.add('gp-clone');
      Object.assign(tpl.style, { position: 'absolute', left: '0', top: '0', width: w + 'px', height: h + 'px', margin: '0' });
      tpl.setAttribute('inert', ''); tpl.setAttribute('aria-hidden', 'true');
      for (const c of kids){
        const cc = c.cloneNode(true);
        cc.removeAttribute('id'); cc.removeAttribute('inert'); cc.removeAttribute('aria-hidden'); delete cc.dataset?.gpInert; delete cc.dataset?.gpAria;
        cc.querySelectorAll('[id]').forEach(n => n.removeAttribute('id'));
        cc.querySelectorAll('a,button,input,textarea,select,[tabindex]').forEach(n => n.setAttribute('tabindex', '-1'));
        const src = [...c.querySelectorAll('input,textarea,select')], dst = [...cc.querySelectorAll('input,textarea,select')];
        src.forEach((n, i) => { const d = dst[i]; if (!d) return;
          if (n.tagName === 'TEXTAREA') d.textContent = n.value;
          else if (n.type === 'checkbox' || n.type === 'radio'){ if (n.checked) d.setAttribute('checked', ''); }
          else d.setAttribute('value', n.value); });
        tpl.appendChild(cc);
      }
    }

    const layer = document.createElement('div');
    layer.className = 'gp-shards gp-keep'; layer.setAttribute('aria-hidden', 'true');
    const frag = document.createDocumentFragment(), shards = [];
    for (const s of geo.shards){
      const plan = planShard(s, P, w, h, geo.maxDist, rand, prof);
      const node = document.createElement('div');
      node.className = 'gp-shard';
      const local = s.poly.map(([x, y]) => `${(x - s.bx).toFixed(1)}px ${(y - s.by).toFixed(1)}px`).join(',');
      node.style.cssText = `left:${s.bx}px;top:${s.by}px;width:${s.bw}px;height:${s.bh}px;clip-path:polygon(${local});transform-origin:${(s.cx - s.bx).toFixed(1)}px ${(s.cy - s.by).toFixed(1)}px`;
      const inner = document.createElement('div');
      inner.className = 'gp-shard-in';
      inner.style.cssText = `left:${-s.bx}px;top:${-s.by}px;width:${w}px;height:${h}px`;
      if (tpl) inner.appendChild(tpl.cloneNode(true));
      node.appendChild(inner);
      if (prof.edges){
        const pts = s.poly.map(([x, y]) => `${(x - s.bx).toFixed(1)},${(y - s.by).toFixed(1)}`).join(' ');
        node.insertAdjacentHTML('beforeend', `<svg class="gp-edge" width="${s.bw}" height="${s.bh}" viewBox="0 0 ${s.bw} ${s.bh}" aria-hidden="true"><polygon points="${pts}" fill="none" stroke="rgba(255,255,255,.82)" stroke-width=".9" stroke-linejoin="round"/></svg>`);
      }
      const glint = document.createElement('i'); glint.className = 'gp-glint'; node.appendChild(glint);
      frag.appendChild(node);
      shards.push({ node, glint, s, plan });
    }
    layer.appendChild(frag);
    el.appendChild(layer);
    this.layer = layer; this.shards = shards; this.size = { w, h };
    return { w, h, P };
  }

  restShape(sh){ const r = sh.plan.rest; return tf(r.x, r.y, r.r, r.s); }
  setRest(sh){ sh.node.style.transform = this.restShape(sh); sh.node.style.opacity = '.62'; sh.node.style.willChange = 'auto'; }

  clearAnims(){ for (const a of this.anims){ try { a.cancel(); } catch { /* already gone */ } } this.anims = []; }
  dropLayer(){ this.clearAnims(); this.layer?.remove(); this.layer = null; this.shards = []; this.ro?.disconnect(); this.ro = null; }

  /* ── intact → exploding → collapsed ──────────────────────────────── */
  shatter(from){
    if (this.destroyed || this.state !== 'intact') return false;
    const w0 = this.el.offsetWidth, h0 = this.el.offsetHeight;
    if (w0 < 40 || h0 < 40) return false;
    this.clearCracks();
    collapsedKeys.add(this.key);
    const count = (sessionCounts.get(this.key) || 0) + 1; sessionCounts.set(this.key, count);
    const prof = perfProfile();

    if (reduceMotion.matches){
      this.setState('collapsed'); this.el.classList.add('gp-reduced'); this.afterCollapse();
      return true;
    }
    const token = ++this.token;
    this.makeLayer(from, prof, count);
    this.setState('exploding');                       // content hidden in the same frame the fragments appear

    const kf = sh => {
      const { crack, rest } = sh.plan, last = tf(rest.x, rest.y, rest.r, rest.s);
      return [
        { transform: tf(0, 0, 0, 1), opacity: 1, offset: 0, easing: 'cubic-bezier(.2,.8,.3,1)' },
        { transform: tf(crack.x, crack.y, crack.r, 1), opacity: 1, offset: 0.14, easing: 'cubic-bezier(.55,.05,.85,.45)' },
        { transform: tf(rest.x, rest.y, rest.r, rest.s), opacity: 0.9, offset: 0.78, easing: 'cubic-bezier(.2,.7,.4,1)' },
        { transform: tf(rest.x, rest.y - 7, rest.r + 2, rest.s), opacity: 0.8, offset: 0.88, easing: 'ease-in' },
        { transform: last, opacity: 0.62, offset: 1 }
      ];
    };
    const done = this.shards.map(sh => {
      sh.node.style.willChange = 'transform, opacity';
      const a = sh.node.animate(kf(sh), { duration: sh.plan.dur, delay: sh.plan.delay, fill: 'both' });
      this.anims.push(a);
      return a.finished.catch(() => 'cancelled');
    });
    Promise.all(done).then(res => {
      if (this.destroyed || token !== this.token) return;
      if (res.includes('cancelled')) return;
      for (const sh of this.shards) this.setRest(sh);
      this.clearAnims();
      this.setState('collapsed'); this.afterCollapse();
    });
    return true;
  }

  afterCollapse(){
    const a = document.activeElement;
    if (a && a !== this.toggle && this.el.contains(a)) this.toggle?.focus({ preventScroll: true });
    if (!reduceMotion.matches) this.watchSize();
    announce(`${this.label} panel shattered. Use the Rebuild button, or tap it, to restore it.`);
  }

  /* ── collapsed → rebuilding → intact ("suit-up") ─────────────────── */
  rebuild(){
    if (this.destroyed || this.state !== 'collapsed') return false;
    collapsedKeys.delete(this.key);
    if (reduceMotion.matches || !this.layer){
      this.el.classList.remove('gp-reduced'); this.dropLayer(); this.setState('intact'); this.el.classList.remove('gp-busy');
      announce(`${this.label} panel rebuilt.`); return true;
    }
    const token = ++this.token, prof = perfProfile();
    this.setState('rebuilding');
    this.ro?.disconnect(); this.ro = null;
    const order = [...this.shards].sort((a, b) => a.s.dist - b.s.dist), n = Math.max(1, order.length - 1);
    const done = order.map((sh, i) => {
      sh.node.style.willChange = 'transform, opacity';
      const delay = (i / n) * prof.stagger;
      const a = sh.node.animate([
        { transform: this.restShape(sh), opacity: 0.62, offset: 0, easing: 'cubic-bezier(.25,.85,.3,1)' },
        { transform: tf(0, 0, 0, 1.035), opacity: 1, offset: 0.82, easing: 'ease-out' },
        { transform: tf(0, 0, 0, 1), opacity: 1, offset: 1 }
      ], { duration: prof.duration * 0.78, delay, fill: 'both' });
      const g = sh.glint.animate([{ opacity: 0 }, { opacity: 0, offset: 0.55 }, { opacity: 1, offset: 0.85 }, { opacity: 0 }], { duration: prof.duration * 0.78 + 120, delay, fill: 'both' });
      this.anims.push(a, g);
      return a.finished.catch(() => 'cancelled');
    });
    Promise.all(done).then(res => {
      if (this.destroyed || token !== this.token || res.includes('cancelled')) return;
      this.setState('intact');                       // reveal the real content…
      this.dropLayer();                              // …and drop the fragments in the same frame
      this.el.classList.remove('gp-busy', 'gp-reduced');
      this.finishFlash();
      announce(`${this.label} panel rebuilt.`);
    });
    return true;
  }

  finishFlash(){
    /* wrapper is clipped to the panel; only the inner band moves */
    const sheen = document.createElement('span');
    sheen.className = 'gp-sheen gp-keep'; sheen.setAttribute('aria-hidden', 'true');
    const band = document.createElement('i'); sheen.appendChild(band);
    this.el.appendChild(sheen);
    const a = band.animate([{ transform: 'translateX(-130%) skewX(-18deg)', opacity: 0 }, { opacity: 1, offset: 0.25 }, { transform: 'translateX(330%) skewX(-18deg)', opacity: 0 }], { duration: 760, easing: 'cubic-bezier(.3,.6,.2,1)' });
    a.finished.catch(() => {}).then(() => sheen.remove());
    this.el.classList.add('gp-flash');
    setTimeout(() => this.el.classList.remove('gp-flash'), 700);
  }

  /* collapsed panels keep their fragments settled; if the panel is resized, re-lay them out */
  watchSize(){
    if (!('ResizeObserver' in window) || this.ro) return;
    this.ro = new ResizeObserver(() => {
      if (this.state !== 'collapsed' || !this.size) return;
      const w = this.el.offsetWidth, h = this.el.offsetHeight;
      if (Math.abs(w - this.size.w) < 3 && Math.abs(h - this.size.h) < 3) return;
      this.layoutCollapsed();
    });
    this.ro.observe(this.el);
  }

  layoutCollapsed(){
    const prof = perfProfile();
    this.layer?.remove(); this.layer = null; this.shards = [];
    this.makeLayer(null, prof, sessionCounts.get(this.key) || 1);
    for (const sh of this.shards) this.setRest(sh);
  }

  restoreCollapsed(){
    if (!this.el.offsetWidth) return;
    if (reduceMotion.matches){ this.setState('collapsed'); this.el.classList.add('gp-reduced'); return; }
    this.layoutCollapsed();
    this.setState('collapsed'); this.watchSize();
  }

  destroy(){
    if (this.destroyed) return;
    this.destroyed = true; this.token++;
    this.dropLayer();
    this.el.removeEventListener('click', this.onClick);
    this.el.removeEventListener('pointerdown', this.onDown);
    this.clearCracks();
    /* content must never stay hidden after teardown */
    for (const c of this.contents()){
      if (c.dataset.gpInert){ c.removeAttribute('inert'); delete c.dataset.gpInert; }
      if (c.dataset.gpAria){ c.removeAttribute('aria-hidden'); delete c.dataset.gpAria; }
    }
    this.toggle?.remove(); this.toggle = null;
    this.el.classList.remove('gp', 'gp-busy', 'gp-reduced', 'gp-flash');
    delete this.el.dataset.state; delete this.el.dataset.gpReady;
    registry.delete(this.el);
  }
}

/* ── public API ────────────────────────────────────────────────────────── */
export const glass = {
  mount(el){ return registry.get(el) || (registry.set(el, new Panel(el)), registry.get(el)); },
  mountAll(root = document){ return $$('[data-gp]:not([data-gp-ready])', root).map(el => glass.mount(el)); },
  unmount(el){ registry.get(el)?.destroy(); },
  unmountAll(root = document){ $$('[data-gp][data-gp-ready]', root).forEach(el => glass.unmount(el)); },
  get(el){ return registry.get(el) || null; },
  isCollapsed: key => collapsedKeys.has(key),
  /* for the console: break / restore every visible, intact panel (keyboard-friendly alternative to tapping) */
  shatterAll(){ let n = 0; document.querySelectorAll('.gp[data-state=intact]').forEach(el => { const r = el.getBoundingClientRect(); if (r.bottom > -innerHeight * 3 && r.top < innerHeight * 4 && registry.get(el)?.shatter({ x: r.left + r.width / 2, y: r.top + r.height / 2, r })) n++; }); return n; },
  rebuildAll(){ let n = 0; document.querySelectorAll('.gp[data-state=collapsed]').forEach(el => { if (registry.get(el)?.rebuild()) n++; }); return n; }
};
