/* ==========================================================================
   FARIS portfolio — public site logic
   Data flow is unchanged: Supabase (public-read tables) → render.
   Tables: profile, skills, experiments, projects, posts, faq  (+ messages insert)
   ========================================================================== */
(() => {
'use strict';

/* The publishable (anon) key is meant to be public; Row-Level Security protects the data. */
const SUPABASE_URL = 'https://zrcfulryxnwffdlpudxo.supabase.co';
const SUPABASE_KEY = 'sb_publishable_4KcOsFvIRvjgI0JMMjZRqA_8uDrjodc';
const sb = window.supabase?.createClient?.(SUPABASE_URL, SUPABASE_KEY) || null;

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const safeUrl = u => { const s = String(u ?? '').trim(); return /^https?:\/\//i.test(s) ? s : ''; };
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const ARROW = '<svg aria-hidden="true"><use href="#i-arrow"/></svg>';

const store = {
  get(k){ try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v){ try { localStorage.setItem(k, v); } catch { /* private mode etc. */ } }
};

/* ── Profile defaults (overridden by the database) ───────────────────── */
let profile = {
  name: 'Faris',
  bio: 'A student exploring AI, technology, and whatever interesting thing comes next.',
  email: 'farisdomain@gmail.com',
  instagram: 'https://www.instagram.com/farixhere/',
  github: 'https://github.com/dupekingsam-code',
  linkedin: '',
  hero_image: ''
};

/* ── Toast ───────────────────────────────────────────────────────────── */
let toastTimer;
function toast(msg){
  const t = $('#toast'); if (!t) return;
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

/* ── Sound (off by default, user-controlled, never autoplays) ────────── */
const soundOn = () => store.get('faris-sound') === 'on';
function beep(freq = 520){
  if (!soundOn()) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = window.__ac || (window.__ac = new AC());
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = freq; g.gain.value = .025;
    o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + .045);
  } catch { /* audio unavailable */ }
}
function paintSound(){
  const b = $('#soundToggle'), on = soundOn();
  b.setAttribute('aria-pressed', String(on));
  b.title = 'Sound effects (' + (on ? 'on' : 'off') + ')';
}

/* ── Theme (light default; separate key so old "dark" prefs don't stick) ── */
function setTheme(v, persist = true){
  document.documentElement.dataset.theme = v;
  if (persist) store.set('faris-theme-v2', v);
  $('meta[name=theme-color]')?.setAttribute('content', v === 'dark' ? '#121210' : '#F7F5EF');
  $('#themeToggle').setAttribute('aria-label', v === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
}

/* ── Modals: focus trap, Esc, backdrop, scroll-lock, focus return ─────── */
let activeModal = null, lastFocus = null;
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
function openModal(el, focusSel){
  if (activeModal) closeModal(true);
  lastFocus = document.activeElement;
  activeModal = el;
  el.classList.add('open'); el.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  const target = (focusSel && $(focusSel, el)) || $('[data-close]', el) || $(FOCUSABLE, el);
  setTimeout(() => target?.focus({ preventScroll: true }), 30);
}
function closeModal(silent){
  if (!activeModal) return;
  activeModal.classList.remove('open'); activeModal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  const back = lastFocus; activeModal = null; lastFocus = null;
  if (!silent) back?.focus?.({ preventScroll: true });
}
document.addEventListener('keydown', e => {
  if (!activeModal) return;
  if (e.key === 'Escape'){ e.preventDefault(); closeModal(); return; }
  if (e.key !== 'Tab') return;
  const f = $$(FOCUSABLE, activeModal).filter(x => x.offsetParent !== null);
  if (!f.length) return;
  const first = f[0], last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
});
$$('.modal').forEach(m => {
  m.addEventListener('mousedown', e => { if (e.target === m) closeModal(); });
  $$('[data-close]', m).forEach(b => b.addEventListener('click', () => closeModal()));
});

/* ── Generative project artwork (designed placeholders, not screenshots) ── */
const hash = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); };
const ART = {
  echo: () => `<svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
    <rect width="400" height="300" fill="#141414"/>
    <g fill="none" stroke="#3159E8">
      <circle cx="270" cy="128" r="34" stroke-opacity=".95"/><circle cx="270" cy="128" r="66" stroke-opacity=".7"/>
      <circle cx="270" cy="128" r="102" stroke-opacity=".5"/><circle cx="270" cy="128" r="142" stroke-opacity=".32"/>
      <circle cx="270" cy="128" r="188" stroke-opacity=".18"/><circle cx="270" cy="128" r="238" stroke-opacity=".1"/>
    </g>
    <circle cx="270" cy="128" r="17" fill="#E89A64"/>
    <g fill="#F7F5EF" opacity=".75"><circle cx="46" cy="40" r="1.4"/><circle cx="110" cy="74" r="1"/><circle cx="170" cy="30" r="1.2"/><circle cx="352" cy="38" r="1.2"/><circle cx="80" cy="118" r="1"/><circle cx="196" cy="96" r="1.1"/></g>
    <path d="M0 238 62 196l48 24 62-44 58 54 70-30 100 42V300H0z" fill="#0A0A0A"/>
    <path d="M0 270l70-26 60 18 80-30 70 24 120-14v58H0z" fill="#1d1d1c"/>
  </svg>`,
  eventra: () => `<svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
    <rect width="400" height="300" fill="#E89A64"/>
    <circle cx="60" cy="250" r="90" fill="#3159E8" opacity=".9"/><rect x="310" y="-30" width="120" height="120" fill="#171717" transform="rotate(18 370 30)"/>
    <g transform="rotate(-5 200 150)">
      <path d="M50 70h200v0a14 14 0 0 0 28 0h72v160H278a14 14 0 0 0-28 0H50z" fill="#F7F5EF" stroke="#171717" stroke-width="2"/>
      <path d="M264 84v132" stroke="#171717" stroke-width="2" stroke-dasharray="3 6"/>
      <rect x="72" y="94" width="100" height="12" fill="#171717"/><rect x="72" y="116" width="150" height="6" fill="#171717" opacity=".35"/>
      <rect x="72" y="140" width="64" height="26" fill="#3159E8"/><rect x="144" y="140" width="64" height="26" fill="none" stroke="#171717" stroke-width="1.5"/>
      <rect x="72" y="178" width="150" height="6" fill="#171717" opacity=".35"/><rect x="72" y="192" width="104" height="6" fill="#171717" opacity=".35"/>
      <circle cx="318" cy="132" r="26" fill="#3159E8"/><path d="M292 190a26 26 0 0 1 52 0z" fill="#171717"/>
    </g>
  </svg>`,
  proofcheck: () => `<svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
    <rect width="400" height="300" fill="#E9E5DB"/>
    <g stroke="#171717" stroke-width="2">
      <rect x="64" y="58" width="190" height="104" fill="#F7F5EF" transform="rotate(-6 160 110)"/>
      <rect x="86" y="86" width="196" height="108" fill="#F7F5EF" transform="rotate(3 184 140)"/>
      <rect x="112" y="118" width="204" height="112" fill="#FFFDF8"/>
    </g>
    <g fill="#171717"><rect x="134" y="144" width="110" height="8" opacity=".85"/><rect x="134" y="162" width="150" height="6" opacity=".3"/><rect x="134" y="176" width="128" height="6" opacity=".3"/><rect x="134" y="190" width="90" height="6" opacity=".3"/></g>
    <circle cx="304" cy="118" r="30" fill="#3159E8"/><path d="m290 118 10 10 18-20" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="94" cy="226" r="26" fill="none" stroke="#171717" stroke-width="5"/><path d="m113 245 22 22" stroke="#171717" stroke-width="7" stroke-linecap="round"/>
    <circle cx="344" cy="238" r="9" fill="#E89A64"/>
  </svg>`,
  generic: seed => {
    const h = hash(seed), pal = ['#3159E8', '#E89A64', '#171717'], a = pal[h % 3], b = pal[(h + 1) % 3], c = pal[(h + 2) % 3];
    return `<svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <rect width="400" height="300" fill="#E9E5DB"/>
      <circle cx="${110 + h % 90}" cy="${120 + h % 40}" r="${70 + h % 30}" fill="${a}"/>
      <rect x="${200 + h % 60}" y="${60 + h % 50}" width="120" height="120" fill="${b}" transform="rotate(${(h % 40) - 20} 260 120)"/>
      <path d="M40 300v-90a70 70 0 0 1 140 0v90z" fill="none" stroke="${c}" stroke-width="3"/>
      <g fill="#171717"><circle cx="330" cy="248" r="3"/><circle cx="346" cy="248" r="3"/><circle cx="362" cy="248" r="3"/></g>
    </svg>`;
  }
};
function artFor(p){
  const k = (String(p.title || '') + ' ' + String(p.slug || '')).toLowerCase();
  if (k.includes('echo')) return ART.echo();
  if (k.includes('eventra')) return ART.eventra();
  if (k.includes('proofcheck')) return ART.proofcheck();
  return ART.generic(p.title || 'faris');
}
/* DB image_url sometimes holds a website, not a picture — only trust things that look like images. */
const looksLikeImage = u => /\.(png|jpe?g|webp|gif|avif|svg)(\?|#|$)/i.test(u) || /(googleusercontent|githubusercontent|supabase\.co\/storage|imgur|unsplash|cloudinary|images\.)/i.test(u);

/* ── Honest fallbacks (shown only if the database has no matching entry) ── */
const PROOFCHECK = {
  title: 'PROOFCHECK', category: 'CONCEPT', status: 'CONCEPT', sort_order: 9999,
  description: 'An idea for making decisions with evidence — gathering real reviews, discussions and experiences so you can judge what’s actually trustworthy.',
  details: 'PROOFCHECK is a project concept about evidence and trust. The idea is to bring together real-world reviews, discussions and lived experiences so people can make better decisions with proof instead of hype. It is still an idea being explored — not a launched product.',
  technologies: ['Concept', 'Reviews', 'Trust'], image_url: '', live_url: '', github_url: ''
};
const FALLBACK_PROJECTS = [
  { title: 'ECHO', category: 'GAME', status: '', sort_order: 0, description: 'An interactive narrative / mystery game.', details: 'ECHO is an interactive narrative and mystery game.', technologies: ['Interactive Narrative', 'Web Game'], live_url: '', github_url: '' },
  { title: 'EVENTRA', category: 'WEB', status: '', sort_order: 1, description: 'An event-hosting and organizer application.', details: 'EVENTRA is an event-hosting and organizer application.', technologies: ['Web App'], live_url: '', github_url: 'https://github.com/farixhere/eventra-updated' },
  PROOFCHECK
];

/* ── Scroll reveal ───────────────────────────────────────────────────── */
let io;
function observeReveals(root = document){
  const els = $$('.reveal:not(.in)', root);
  if (reduceMotion.matches || !('IntersectionObserver' in window)){ els.forEach(e => e.classList.add('in')); return; }
  io ||= new IntersectionObserver(entries => entries.forEach(en => {
    if (en.isIntersecting){ en.target.classList.add('in'); io.unobserve(en.target); }
  }), { threshold: .12, rootMargin: '0px 0px -6% 0px' });
  els.forEach(e => io.observe(e));
}

/* ── Renderers ───────────────────────────────────────────────────────── */
let projectRows = [];
function projectCard(p, i){
  const links = [];
  const live = safeUrl(p.live_url), src = safeUrl(p.github_url);
  if (live) links.push(`<a href="${esc(live)}" target="_blank" rel="noopener noreferrer">Live ${ARROW}</a>`);
  if (src) links.push(`<a href="${esc(src)}" target="_blank" rel="noopener noreferrer">Source ${ARROW}</a>`);
  const img = safeUrl(p.image_url);
  const media = img && looksLikeImage(img)
    ? `<img src="${esc(img)}" alt="${esc(p.title)} preview" loading="lazy" decoding="async" referrerpolicy="no-referrer" data-art>`
    : artFor(p);
  return `<article class="project" data-i="${i}">
    <div class="project-art">${media}</div>
    <div class="project-body">
      <div class="project-meta"><span class="idx">${String(i + 1).padStart(2, '0')}</span><span>${esc(p.category || 'Project')}</span>${p.status ? `<span class="chip">${esc(p.status)}</span>` : ''}</div>
      <h3><button type="button" class="project-open" data-open="${i}" aria-haspopup="dialog">${esc(p.title)}</button></h3>
      <p class="project-desc">${esc(p.description || '')}</p>
      ${(p.technologies || []).length ? `<ul class="tags" aria-label="Technologies">${p.technologies.slice(0, 4).map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
      <div class="project-foot">${links.join('')}<span class="more" aria-hidden="true">Details +</span></div>
    </div>
  </article>`;
}
function renderProjects(list){
  const el = $('#projectGrid');
  if (!list.length){
    el.innerHTML = '<div class="empty-state">No projects in this category yet.</div>';
  } else {
    el.innerHTML = list.map(p => projectCard(p, projectRows.indexOf(p))).join('');
    $$('.project', el).forEach(c => c.classList.add('reveal', 'in'));
    $$('img[data-art]', el).forEach(img => img.addEventListener('error', () => {
      const p = projectRows[+img.closest('.project').dataset.i];
      img.parentElement.innerHTML = artFor(p);
    }, { once: true }));
    $$('.project-open', el).forEach(b => b.addEventListener('click', () => openProject(projectRows[+b.dataset.open], b)));
  }
  $('#projectCount').textContent = list.length + (list.length === 1 ? ' project shown' : ' projects shown');
}
function setupProjects(rows){
  projectRows = rows;
  const cats = ['all', ...new Set(rows.map(r => r.category).filter(Boolean))];
  const f = $('#projectFilters');
  f.hidden = cats.length < 3;                              /* a filter with one choice is just noise */
  f.innerHTML = cats.map(c => `<button type="button" class="${c === 'all' ? 'active' : ''}" data-f="${esc(c)}" aria-pressed="${c === 'all'}">${esc(c === 'all' ? 'All' : c)}</button>`).join('');
  $$('button', f).forEach(b => b.addEventListener('click', () => {
    $$('button', f).forEach(x => { x.classList.remove('active'); x.setAttribute('aria-pressed', 'false'); });
    b.classList.add('active'); b.setAttribute('aria-pressed', 'true');
    renderProjects(b.dataset.f === 'all' ? rows : rows.filter(r => r.category === b.dataset.f));
  }));
  renderProjects(rows);
}
function openProject(p, trigger){
  $('#projectModalCategory').textContent = p.category || 'Project';
  $('#projectModalTitle').textContent = p.title || '';
  const st = $('#projectModalStatus');
  st.hidden = !p.status; st.textContent = p.status || '';
  $('#projectModalDetails').textContent = p.details || p.description || '';
  $('#projectModalTags').innerHTML = (p.technologies || []).map(t => `<li>${esc(t)}</li>`).join('');
  const live = safeUrl(p.live_url), src = safeUrl(p.github_url);
  $('#projectModalLinks').innerHTML =
    (live ? `<a href="${esc(live)}" target="_blank" rel="noopener noreferrer">Live project ${ARROW}</a>` : '') +
    (src ? `<a href="${esc(src)}" target="_blank" rel="noopener noreferrer">Source code ${ARROW}</a>` : '');
  const img = safeUrl(p.image_url);
  $('#projectModalArt').innerHTML = img && looksLikeImage(img)
    ? `<img src="${esc(img)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">` : artFor(p);
  openModal($('#projectModal'));
  beep(600);
}

function renderSkills(rows){
  const el = $('#skillsGrid');
  if (!rows.length){ el.innerHTML = '<div class="skeleton">The toolbox is being filled.</div>'; return; }
  const groups = new Map();
  rows.forEach(r => { const k = (r.label || 'Exploring').trim(); (groups.get(k) || groups.set(k, []).get(k)).push(r); });
  el.innerHTML = [...groups].map(([label, items]) => `
    <div class="sk-group reveal"><h3>${esc(label)}<span>${String(items.length).padStart(2, '0')}</span></h3>
    <ul class="sk-list">${items.map(s => `<li class="skill"><span class="sk-ico" aria-hidden="true">${esc(s.icon || '✦')}</span>${esc(s.name)}</li>`).join('')}</ul></div>`).join('');
  observeReveals(el);
}
function renderNow(rows){
  const el = $('#experimentsList');
  el.innerHTML = rows.length
    ? rows.map(x => `<li class="now-item"><div><h4>${esc(x.title)}</h4><p>${esc(x.description || '')}</p></div><span class="pill">${esc(x.status || 'Active')}</span></li>`).join('')
    : '<li class="skeleton">Nothing listed right now.</li>';
}
function renderPosts(rows){
  if (!rows.length) return;                      /* keep the designed empty state */
  const el = $('#postGrid');
  el.innerHTML = rows.map((x, i) => {
    const d = x.published_at ? new Date(x.published_at) : null;
    const date = d && !isNaN(d) ? d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '';
    return `<article class="post reveal">
      ${date ? `<time datetime="${esc(x.published_at)}">${esc(date)}</time>` : ''}
      <h3><button type="button" class="post-open" data-post="${i}" aria-haspopup="dialog">${esc(x.title)}</button></h3>
      <p>${esc(x.excerpt || String(x.content || '').slice(0, 140))}</p>
      <span class="read" aria-hidden="true">Read note →</span></article>`;
  }).join('');
  $$('.post-open', el).forEach(b => b.addEventListener('click', () => {
    const x = rows[+b.dataset.post], d = x.published_at ? new Date(x.published_at) : null;
    $('#postModalDate').textContent = d && !isNaN(d) ? d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : 'Note';
    $('#postModalTitle').textContent = x.title || '';
    const body = String(x.content || x.excerpt || '').split(/\n{2,}/).filter(Boolean);
    $('#postModalBody').innerHTML = body.map(p => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
    openModal($('#postModal'));
  }));
  observeReveals(el);
}
function renderFaq(rows){
  const el = $('#faqList');
  if (!rows.length){ el.innerHTML = '<div class="skeleton">Questions are on their way.</div>'; return; }
  el.innerHTML = rows.map((x, i) => `<div class="faq-item">
    <h3><button type="button" id="fq${i}" aria-expanded="false" aria-controls="fa${i}">${esc(x.question)}</button></h3>
    <div class="faq-answer" id="fa${i}" role="region" aria-labelledby="fq${i}"><div><p>${esc(x.answer)}</p></div></div></div>`).join('');
  $$('.faq-item button', el).forEach(b => b.addEventListener('click', () => {
    const open = b.getAttribute('aria-expanded') !== 'true';
    b.setAttribute('aria-expanded', String(open));
    b.closest('.faq-item').classList.toggle('open', open);
  }));
}

function applyProfile(){
  const mail = profile.email ? 'mailto:' + profile.email : '';
  const set = (id, href) => { const a = $(id); if (a && href) a.href = href; };
  set('#connectEmail', mail); set('#heroEmail', mail);
  if (profile.email) $('#connectEmail').firstChild.nodeValue = profile.email + ' ';
  const ig = safeUrl(profile.instagram), gh = safeUrl(profile.github), li = safeUrl(profile.linkedin);
  set('#connectInstagram', ig); set('#heroInstagram', ig);
  set('#connectGithub', gh); set('#heroGithub', gh);
  if (!ig){ $('#heroInstagram').closest('li').hidden = true; $('#connectInstagram').closest('li').hidden = true; }
  if (!gh){ $('#heroGithub').closest('li').hidden = true; $('#connectGithub').closest('li').hidden = true; }
  if (li){ set('#heroLinkedin', li); $('#heroLinkedinItem').hidden = false; }   /* only when a real link exists */
  if (profile.bio) $('#aboutBio').textContent = profile.bio;
  const img = safeUrl(profile.hero_image);
  if (img){
    const ph = $('#heroPhotoImg');
    ph.addEventListener('load', () => { $('#heroPhoto').hidden = false; }, { once: true });
    ph.addEventListener('error', () => { $('#heroPhoto').hidden = true; }, { once: true });
    ph.src = img;
  }
}

/* ── Load from Supabase (each table independent so one failure ≠ blank site) ── */
async function load(){
  if (!sb){
    toast('Live content unavailable — showing the essentials.');
    setupProjects(FALLBACK_PROJECTS); renderNow([]); renderSkills([]); renderFaq([]);
    return;
  }
  const q = {
    profile:     () => sb.from('profile').select('*').eq('id', 1).maybeSingle(),
    skills:      () => sb.from('skills').select('*').order('sort_order'),
    experiments: () => sb.from('experiments').select('*').order('sort_order'),
    projects:    () => sb.from('projects').select('*').order('sort_order'),
    posts:       () => sb.from('posts').select('*').eq('published', true).order('published_at', { ascending: false }),
    faq:         () => sb.from('faq').select('*').order('sort_order')
  };
  const names = Object.keys(q);
  const res = await Promise.allSettled(names.map(n => q[n]()));
  const d = {}; let failed = 0;
  res.forEach((r, i) => {
    const ok = r.status === 'fulfilled' && !r.value.error;
    if (!ok) failed++;
    d[names[i]] = ok ? (r.value.data ?? (names[i] === 'profile' ? null : [])) : (names[i] === 'profile' ? null : []);
  });
  if (d.profile){ profile = { ...profile, ...Object.fromEntries(Object.entries(d.profile).filter(([, v]) => v != null && v !== '')) }; }
  applyProfile();
  renderSkills(d.skills); renderNow(d.experiments); renderPosts(d.posts); renderFaq(d.faq);

  let rows = d.projects.length ? [...d.projects] : [...FALLBACK_PROJECTS];
  /* The brief features PROOFCHECK; show it honestly as a concept unless it is already in the dashboard. */
  if (!rows.some(r => /proofcheck/i.test(r.title || ''))) rows.push(PROOFCHECK);
  setupProjects(rows);
  if (failed) toast('Some live content couldn’t load.');
}

/* ── Terminal (commands preserved) ───────────────────────────────────── */
function initTerminal(){
  const consoleEl = $('#terminalConsole'), row = $('#terminalInputRow'), input = $('#terminalInput'), modal = $('#terminalModal');
  const targets = { about:'#about', experience:'#experience', skills:'#skills', projects:'#work', now:'#now', blog:'#thoughts', education:'#education', contact:'#contact' };
  const details = {
    about: () => 'Faris is a student exploring ideas, AI and the process of turning concepts into real projects.',
    experience: () => 'The way Faris works: EXPLORE → BUILD → SHIP.',
    skills: () => 'The current toolbox and what is being learned — live from the dashboard.',
    projects: () => 'ECHO, EVENTRA, PROOFCHECK and anything added from the dashboard.',
    now: () => 'What Faris is experimenting with right now.',
    blog: () => 'Notes, ideas and lessons from the process.',
    education: () => 'Second-year BA Sociology at Pondicherry University.',
    contact: () => 'Email ' + (profile.email || 'farisdomain@gmail.com') + ' or use the contact form.'
  };
  const labels = { about:'who is Faris?', experience:'how I work', skills:'current toolbox', projects:"things I'm building", now:"what I'm up to", blog:'notes & ideas', education:'where I study', contact:"let's talk" };
  const helpHtml = '<div class="term-muted">Available commands:</div>' +
    Object.keys(targets).map(k => `<button type="button" data-command="${k}">${k} <small>— ${labels[k]}</small></button>`).join('') +
    '<button type="button" data-command="clear">clear <small>— clear terminal</small></button>';
  let closeTimer;
  const out = html => { const d = document.createElement('div'); d.className = 'term-output'; d.innerHTML = html; consoleEl.insertBefore(d, row); bind(d); };
  const bind = r => $$('[data-command]', r).forEach(b => b.addEventListener('click', () => run(b.dataset.command)));
  function run(raw){
    const cmd = String(raw).trim().toLowerCase(); if (!cmd) return;
    clearTimeout(closeTimer);
    if (cmd === 'clear'){ consoleEl.innerHTML = ''; consoleEl.appendChild(row); input.value = ''; input.focus(); return; }
    const line = document.createElement('div'); line.className = 'term-line term-prompt';
    line.innerHTML = '<span>guest@faris:~$</span> ' + esc(cmd); consoleEl.insertBefore(line, row);
    if (cmd === 'help') out(helpHtml);
    else if (targets[cmd]){
      out('<div class="term-detail">' + esc(details[cmd]()) + '</div>'); beep(640);
      closeTimer = setTimeout(() => { closeModal(true); $(targets[cmd])?.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'start' }); }, 750);
    } else { out('<div class="term-muted">Command not found: ' + esc(cmd) + '</div><div class="term-muted">Type "help" to see available commands.</div>'); beep(300); }
    consoleEl.scrollTop = consoleEl.scrollHeight; input.value = '';
  }
  input.addEventListener('keydown', e => { if (e.key === 'Enter'){ e.preventDefault(); run(input.value); } });
  consoleEl.addEventListener('click', e => { if (!e.target.closest('button,a')) input.focus(); });
  bind(consoleEl);
  const open = () => { openModal(modal, '#terminalInput'); beep(520); };
  $('#terminalOpen').addEventListener('click', open);
  /* "/" opens the terminal from anywhere (not while typing in a field) */
  document.addEventListener('keydown', e => {
    if (e.key === '/' && !activeModal && !e.metaKey && !e.ctrlKey && !/^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName)){ e.preventDefault(); open(); }
  });
}

/* ── Ask Faris (fixed answers — no backend connected; behaviour preserved) ── */
function initAsk(){
  const answers = {
    interest: () => 'Faris is a student exploring ideas, AI and the process of turning concepts into real projects.',
    building: () => 'Projects like ECHO (an interactive narrative game), EVENTRA (an event-organizer app) and the PROOFCHECK concept — plus this portfolio, which runs on a Supabase-backed dashboard.',
    study: () => 'He is in the second year of a BA in Sociology at Pondicherry University.',
    contact: () => 'Email ' + (profile.email || 'farisdomain@gmail.com') + ', message him on Instagram, or use the contact form below.'
  };
  $('#askFaris').addEventListener('click', () => openModal($('#askModal')));
  $$('[data-question]').forEach(b => b.addEventListener('click', () => {
    $$('[data-question]').forEach(x => x.setAttribute('aria-pressed', 'false'));
    b.setAttribute('aria-pressed', 'true');
    $('#askAnswer').textContent = answers[b.dataset.question]();
    beep(560);
  }));
}

/* ── Contact form (backend unchanged: insert into `messages`) ────────── */
function initContact(){
  const form = $('#contactForm'), status = $('#formStatus'), btn = $('#sendBtn');
  const say = (msg, kind = '') => { status.textContent = msg; status.className = 'form-status ' + kind; };
  const mailFallback = () => 'Or email me directly at ' + (profile.email || 'farisdomain@gmail.com') + '.';
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const fields = ['name', 'email', 'message'].map(n => form.elements[n]);
    fields.forEach(f => f.removeAttribute('aria-invalid'));
    const [name, email, message] = fields.map(f => f.value.trim());
    const bad = fields.find(f => !f.value.trim());
    if (bad){ bad.setAttribute('aria-invalid', 'true'); bad.focus(); say('Please fill in your ' + (bad.name === 'message' ? 'message' : bad.name) + '.', 'error'); return; }
    if (!form.elements.email.checkValidity()){ form.elements.email.setAttribute('aria-invalid', 'true'); form.elements.email.focus(); say('That email address doesn’t look right.', 'error'); return; }
    if (!sb){ say('The message service is unavailable right now. ' + mailFallback(), 'error'); return; }
    btn.disabled = true; $('span', btn).textContent = 'Sending…'; say('');
    try {
      const { error } = await sb.from('messages').insert({ name, email, message, read: false });
      if (error) throw error;
      say('Message sent. Thank you — I’ll get back to you.', 'ok'); form.reset(); beep(700);
    } catch {
      say('Couldn’t send your message. ' + mailFallback(), 'error');
    } finally {
      btn.disabled = false; $('span', btn).textContent = 'Send message';
    }
  });
}

/* ── Hero playground ─────────────────────────────────────────────────── */
function initPlayground(){
  const stage = $('#stage'); if (!stage) return;
  let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0, visible = true, lastTrail = 0, boops = 0;
  const tick = () => {
    cx += (tx - cx) * .09; cy += (ty - cy) * .09;
    stage.style.setProperty('--px', cx.toFixed(3)); stage.style.setProperty('--py', cy.toFixed(3));
    raf = (Math.abs(tx - cx) > .002 || Math.abs(ty - cy) > .002) ? requestAnimationFrame(tick) : 0;
  };
  const kick = () => { if (!raf && visible) raf = requestAnimationFrame(tick); };
  const trail = (x, y, now) => {
    if (now - lastTrail < 55) return; lastTrail = now;
    if ($$('.trail', stage).length > 22) return;
    const d = document.createElement('i'); d.className = 'trail';
    d.style.left = x + 'px'; d.style.top = y + 'px';
    d.addEventListener('animationend', () => d.remove(), { once: true });
    stage.appendChild(d);
  };
  if (!reduceMotion.matches){
    stage.addEventListener('pointermove', e => {
      const r = stage.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width - .5) * 2; ty = ((e.clientY - r.top) / r.height - .5) * 2;
      kick(); trail(e.clientX - r.left, e.clientY - r.top, e.timeStamp);
    });
    const rest = () => { tx = 0; ty = 0; kick(); };
    stage.addEventListener('pointerleave', rest); stage.addEventListener('pointercancel', rest);
    if ('IntersectionObserver' in window){
      new IntersectionObserver(([en]) => { visible = en.isIntersecting; stage.classList.toggle('is-paused', !visible); }, { threshold: 0 }).observe(stage);
    }
  } else { stage.classList.add('is-paused'); }
  $('#sphere').addEventListener('click', e => {
    const s = e.currentTarget; s.classList.remove('boop'); void s.offsetWidth; s.classList.add('boop');
    $('#boopCount').textContent = ++boops; beep(300 + Math.min(boops, 12) * 40);
    if (boops === 10) toast('Ten boops. The sphere forgives you.');
  });
}

/* ── Nav: scroll state, active section, progress, mobile menu ────────── */
function initNav(){
  const bar = $('#topbar'), links = $('#navlinks'), menu = $('#menuBtn'), prog = $('#progress');
  const setMenu = open => {
    links.classList.toggle('open', open); menu.setAttribute('aria-expanded', String(open));
    menu.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    document.body.style.overflow = open ? 'hidden' : '';
  };
  menu.addEventListener('click', () => setMenu(!links.classList.contains('open')));
  $$('a', links).forEach(a => a.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && links.classList.contains('open')){ setMenu(false); menu.focus(); } });
  matchMedia('(min-width:1041px)').addEventListener('change', e => { if (e.matches) setMenu(false); });

  let ticking = false;
  const onScroll = () => {
    if (ticking) return; ticking = true;
    requestAnimationFrame(() => {
      const max = document.documentElement.scrollHeight - innerHeight;
      prog.style.width = (max > 0 ? scrollY / max * 100 : 0) + '%';
      bar.classList.toggle('scrolled', scrollY > 8);
      ticking = false;
    });
  };
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  if ('IntersectionObserver' in window){
    const map = new Map($$('a', links).map(a => [a.getAttribute('href').slice(1), a]));
    const so = new IntersectionObserver(es => es.forEach(en => {
      const a = map.get(en.target.id); if (!a || !en.isIntersecting) return;
      map.forEach(x => x.removeAttribute('aria-current')); a.setAttribute('aria-current', 'true');
    }), { rootMargin: '-45% 0px -50% 0px' });
    map.forEach((_, id) => { const s = document.getElementById(id); if (s) so.observe(s); });
  }
}

/* ── Boot ────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  setTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light', false);
  paintSound();
  $('#themeToggle').addEventListener('click', () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
  $('#soundToggle').addEventListener('click', () => { store.set('faris-sound', soundOn() ? 'off' : 'on'); paintSound(); beep(680); });
  document.addEventListener('click', e => { if (e.target.closest('[data-sound]')) beep(); });
  $('#backTop').addEventListener('click', () => scrollTo({ top: 0, behavior: reduceMotion.matches ? 'auto' : 'smooth' }));

  initNav(); initTerminal(); initAsk(); initContact(); initPlayground();
  observeReveals();
  load();
});
})();
