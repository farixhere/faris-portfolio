/* ==========================================================================
   FARIS portfolio — entry point.
   Data flow is unchanged: Supabase (public-read tables) → render.
   This file wires the page together; the heavy pieces live in their own modules:
   glass (shatter engine) · console + commands · arcade · xiraf (OS).
   ========================================================================== */
import { $, $$, esc, safeUrl, store, reduceMotion, toast, beep, soundOn, setTheme, getTheme, on, bus, perfProfile } from './util.js';
import { openModal, closeModal, initModals, getActiveModal } from './modal.js';
import { data, loadAll, sb } from './data.js';
import { mediaFor, armArtFallback } from './art.js';
import { glass } from './glass.js';
import { mountConsole } from './console.js';
import { mountArcade } from './arcade/launcher.js';
import { createXiraf } from './xiraf/os.js';

const ARROW = '<svg aria-hidden="true"><use href="#i-arrow"/></svg>';

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

/* ── Projects: the interactive showcase ──────────────────────────────── */
let projectRows = [], activeFilter = 'all';
const statusKind = s => {
  const t = String(s || '').toLowerCase();
  if (!t) return '';
  if (/(build|develop|progress|wip)/.test(t)) return 'building';
  if (/concept|idea/.test(t)) return 'concept';
  if (/(live|launch|complete|done|ship|released)/.test(t)) return 'live';
  return 'other';
};
const projectKey = p => 'project-' + String(p.id ?? p.slug ?? p.title).toLowerCase().replace(/[^a-z0-9]+/g, '-');

function projectCard(p, i){
  const live = safeUrl(p.live_url), src = safeUrl(p.github_url), kind = statusKind(p.status);
  const links = [];
  if (live) links.push(`<a class="plink" href="${esc(live)}" target="_blank" rel="noopener noreferrer">Live ${ARROW}</a>`);
  if (src) links.push(`<a class="plink" href="${esc(src)}" target="_blank" rel="noopener noreferrer">Source ${ARROW}</a>`);
  const techAll = (p.technologies || []);
  return `<article class="project glass" data-gp data-gp-key="${esc(projectKey(p))}" data-gp-label="${esc(p.title)}" data-i="${i}">
    <div class="project-art">${mediaFor(p)}<span class="project-glare" aria-hidden="true"></span></div>
    <div class="project-body">
      <div class="project-meta"><span class="idx">${String(i + 1).padStart(2, '0')}</span><span>${esc(p.category || 'Project')}</span>${p.status ? `<span class="chip st" data-st="${kind}"><i aria-hidden="true"></i>${esc(p.status)}</span>` : ''}</div>
      <h3>${esc(p.title)}</h3>
      <p class="project-desc">${esc(p.description || '')}</p>
      ${techAll.length ? `<ul class="tags" aria-label="Technologies">${techAll.slice(0, 4).map(t => `<li>${esc(t)}</li>`).join('')}${techAll.length > 4 ? `<li>+${techAll.length - 4}</li>` : ''}</ul>` : ''}
      <div class="project-more" id="pm-${i}" inert><div class="project-more-in">
        <p class="project-details">${esc(p.details || p.description || '')}</p>
        ${techAll.length > 4 ? `<ul class="tags" aria-label="All technologies">${techAll.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
      </div></div>
      <div class="project-foot">${links.join('')}<button type="button" class="project-toggle" aria-expanded="false" aria-controls="pm-${i}" data-toggle="${i}"><span>Details</span><b aria-hidden="true">+</b></button></div>
    </div>
  </article>`;
}

function renderProjects(list){
  const el = $('#projectGrid');
  glass.unmountAll(el);
  if (!list.length){
    el.innerHTML = '<div class="empty-state">No projects in this category yet.</div>';
  } else {
    el.innerHTML = list.map(p => projectCard(p, projectRows.indexOf(p))).join('');
    $$('.project', el).forEach(c => c.classList.add('reveal', 'in'));
    armArtFallback(el, img => projectRows[+img.closest('.project')?.dataset.i]);
    glass.mountAll(el);
  }
  $('#projectCount').textContent = list.length + (list.length === 1 ? ' project shown' : ' projects shown');
}

function setupProjects(rows){
  projectRows = rows;
  const cats = ['all', ...new Set(rows.map(r => r.category).filter(Boolean))];
  if (!cats.includes(activeFilter)) activeFilter = 'all';
  const f = $('#projectFilters');
  f.hidden = cats.length < 3;                              /* a filter with one choice is just noise */
  f.innerHTML = cats.map(c => `<button type="button" class="${c === activeFilter ? 'active' : ''}" data-f="${esc(c)}" aria-pressed="${c === activeFilter}">${esc(c === 'all' ? 'All' : c)}</button>`).join('');
  renderProjects(activeFilter === 'all' ? rows : rows.filter(r => r.category === activeFilter));
}

function initProjectShowcase(){
  const grid = $('#projectGrid'), filters = $('#projectFilters');
  filters.addEventListener('click', e => {
    const b = e.target.closest('button[data-f]'); if (!b) return;
    activeFilter = b.dataset.f;
    $$('button', filters).forEach(x => { x.classList.toggle('active', x === b); x.setAttribute('aria-pressed', String(x === b)); });
    renderProjects(activeFilter === 'all' ? projectRows : projectRows.filter(r => r.category === activeFilter));
  });

  /* expand / collapse details (animated height, independent per card) */
  grid.addEventListener('click', e => {
    const t = e.target.closest('.project-toggle'); if (!t) return;
    const card = t.closest('.project'), open = t.getAttribute('aria-expanded') !== 'true';
    t.setAttribute('aria-expanded', String(open)); card.classList.toggle('open', open);
    card.querySelector('.project-more').toggleAttribute('inert', !open);
    t.querySelector('span').textContent = open ? 'Less' : 'Details'; t.querySelector('b').textContent = open ? '−' : '+';
    beep(open ? 600 : 460);
  });

  /* keyboard: arrows move between projects' Details buttons */
  grid.addEventListener('keydown', e => {
    if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(e.key)) return;
    const t = e.target.closest('.project-toggle'); if (!t) return;
    const all = $$('.project-toggle', grid), i = all.indexOf(t), n = all[i + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1)];
    if (n){ e.preventDefault(); n.focus(); n.closest('.project').scrollIntoView({ block: 'nearest', behavior: reduceMotion.matches ? 'auto' : 'smooth' }); }
  });

  /* pointer-responsive tilt + glare. Fine pointers get tilt; touch gets a lighter version
     (smaller angle, and it snaps back on release) so phones keep the feel without hover. */
  let raf = 0, pending = null;
  const apply = () => {
    raf = 0; if (!pending) return;
    const { card, x, y, touch } = pending, r = card.getBoundingClientRect();
    const px = (x - r.left) / r.width, py = (y - r.top) / r.height, max = touch ? 3 : 6;
    card.style.setProperty('--ry', ((px - .5) * 2 * max).toFixed(2) + 'deg');
    card.style.setProperty('--rx', ((.5 - py) * 2 * max).toFixed(2) + 'deg');
    card.style.setProperty('--mx', (px * 100).toFixed(1) + '%'); card.style.setProperty('--my', (py * 100).toFixed(1) + '%');
    card.classList.add('tilting');
  };
  const reset = card => { if (!card) return; ['--rx', '--ry'].forEach(k => card.style.removeProperty(k)); card.classList.remove('tilting'); };
  const move = e => {
    if (reduceMotion.matches) return;
    const card = e.target.closest?.('.project'); if (!card || card.dataset.state !== 'intact') return;
    pending = { card, x: e.clientX, y: e.clientY, touch: e.pointerType === 'touch' };
    raf ||= requestAnimationFrame(apply);
  };
  grid.addEventListener('pointermove', move, { passive: true });
  grid.addEventListener('pointerdown', move, { passive: true });
  const leave = e => { const c = e.target.closest?.('.project'); pending = null; reset(c); };
  grid.addEventListener('pointerleave', e => { $$('.project.tilting', grid).forEach(reset); }, true);
  grid.addEventListener('pointerup', leave, { passive: true });
  grid.addEventListener('pointercancel', leave, { passive: true });
  grid.addEventListener('pointerout', e => { const c = e.target.closest?.('.project'); if (c && !c.contains(e.relatedTarget)) reset(c); }, { passive: true });
}

/* ── Other section renderers ─────────────────────────────────────────── */
function renderSkills(rows){
  const el = $('#skillsGrid');
  glass.unmountAll(el);
  if (!rows.length){ el.innerHTML = '<div class="skeleton">The toolbox is being filled.</div>'; return; }
  const groups = new Map();
  rows.forEach(r => { const k = (r.label || 'Exploring').trim(); (groups.get(k) || groups.set(k, []).get(k)).push(r); });
  el.innerHTML = [...groups].map(([label, items]) => `
    <div class="sk-group glass reveal" data-gp data-gp-key="skills-${esc(label.toLowerCase())}" data-gp-label="${esc(label)}"><h3>${esc(label)}<span>${String(items.length).padStart(2, '0')}</span></h3>
    <ul class="sk-list">${items.map(s => `<li class="skill"><span class="sk-ico" aria-hidden="true">${esc(s.icon || '✦')}</span>${esc(s.name)}</li>`).join('')}</ul></div>`).join('');
  observeReveals(el); glass.mountAll(el);
}
function renderNow(rows){
  const el = $('#experimentsList');
  glass.unmountAll(el);
  el.innerHTML = rows.length
    ? rows.map((x, i) => `<li class="now-item glass" data-n="${String(i + 1).padStart(2, '0')}" data-gp data-gp-key="now-${i}-${esc(String(x.title).toLowerCase().replace(/[^a-z0-9]+/g, '-'))}" data-gp-label="${esc(x.title)}"><div><h4>${esc(x.title)}</h4><p>${esc(x.description || '')}</p></div><span class="pill">${esc(x.status || 'Active')}</span></li>`).join('')
    : '<li class="skeleton">Nothing listed right now.</li>';
  glass.mountAll(el);
}
function renderPosts(rows){
  if (!rows.length) return;                      /* keep the designed empty state */
  const el = $('#postGrid');
  glass.unmountAll(el);
  el.innerHTML = rows.map((x, i) => {
    const d = x.published_at ? new Date(x.published_at) : null;
    const date = d && !isNaN(d) ? d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '';
    return `<article class="post glass reveal" data-gp data-gp-key="post-${esc(String(x.id ?? i))}" data-gp-label="${esc(x.title)}">
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
  observeReveals(el); glass.mountAll(el);
}
let faqRows = [], faqIdx = 0, faqWired = false;
function showFaq(i, { focus = false, animate = true } = {}){
  if (!faqRows.length) return;
  faqIdx = (i + faqRows.length) % faqRows.length;
  const x = faqRows[faqIdx];
  $$('.faq-tab').forEach((t, k) => { const on = k === faqIdx; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; if (on && focus) t.focus({ preventScroll: true }); });
  $('#faqBadge').textContent = 'Q·' + String(faqIdx + 1).padStart(2, '0');
  $('#faqQ').textContent = x.question || '';
  const view = $('#faqA'); view.setAttribute('aria-labelledby', 'faqtab' + faqIdx);
  const words = String(x.answer || '').split(/(\s+)/);
  let w = 0;
  view.innerHTML = '<p>' + words.map(t => /^\s+$/.test(t) ? t : `<span class="w" style="--i:${animate ? w++ : 0}">${esc(t)}</span>`).join('') + '</p>';
}
function renderFaq(rows){
  const el = $('#faqList');
  glass.unmountAll($('#faqView'));
  faqRows = rows;
  if (!rows.length){ el.innerHTML = '<div class="skeleton">Questions are on their way.</div>'; glass.mountAll($('#faqView').parentNode); return; }
  el.innerHTML = rows.map((x, i) => `<button type="button" class="faq-tab" role="tab" id="faqtab${i}" aria-selected="false" aria-controls="faqA" tabindex="-1"><i>${String(i + 1).padStart(2, '0')}</i><span>${esc(x.question)}</span></button>`).join('');
  if (!faqWired){
    faqWired = true;
    el.addEventListener('click', e => { const t = e.target.closest('.faq-tab'); if (t) showFaq($$('.faq-tab', el).indexOf(t)); });
    el.addEventListener('keydown', e => {
      const k = e.key, vertical = !matchMedia('(max-width:720px)').matches;
      const next = (vertical ? 'ArrowDown' : 'ArrowRight'), prev = (vertical ? 'ArrowUp' : 'ArrowLeft');
      if (k === next || k === 'ArrowRight' && !vertical){ e.preventDefault(); showFaq(faqIdx + 1, { focus: true }); }
      else if (k === prev || k === 'ArrowLeft' && !vertical){ e.preventDefault(); showFaq(faqIdx - 1, { focus: true }); }
      else if (k === 'Home'){ e.preventDefault(); showFaq(0, { focus: true }); }
      else if (k === 'End'){ e.preventDefault(); showFaq(faqRows.length - 1, { focus: true }); }
    });
    $('#faqPrev').addEventListener('click', () => showFaq(faqIdx - 1));
    $('#faqNext').addEventListener('click', () => showFaq(faqIdx + 1));
  }
  showFaq(Math.min(faqIdx, rows.length - 1), { animate: false });
  glass.mountAll($('#faqView').parentNode);
}

function applyProfile(){
  const profile = data.profile;
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

function renderAll(){
  applyProfile();
  renderSkills(data.skills); renderNow(data.experiments); renderPosts(data.posts); renderFaq(data.faq);
  setupProjects(data.projects);
  if (data.failed === -1) toast('Live content unavailable — showing the essentials.');
  else if (data.failed > 0) toast('Some live content couldn’t load.');
}

/* ── Console (portfolio modal) + Arcade (portfolio modal) + XIRAF ───── */
let arcadeInst = null, consoleInst = null, xiraf = null;

function openPortfolioArcade(game){
  const modal = $('#arcadeModal');
  if (arcadeInst && getActiveModal() === modal){ arcadeInst.open(game); return; }
  openModal(modal, null, () => { arcadeInst?.destroy(); arcadeInst = null; $('#arcadeHost').innerHTML = ''; });
  arcadeInst = mountArcade($('#arcadeHost'), { game, onTitle: t => { $('#arcadeTitle').textContent = t === 'Arcade' ? 'Arcade' : t; } });
}

function consoleCtx(inline = false){
  return {
    inOS: false, glass,
    get xiraf(){ return { boot: () => xiraf.boot({ returnFocus: inline ? $('#heroConsole input') : $('#terminalOpen') }), exit: () => xiraf.exit() }; },
    arcade: { open: id => openPortfolioArcade(id) },
    goto: (k, sel) => setTimeout(() => $(sel)?.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'start' }), inline ? 200 : 800),
    close: () => { if (!inline) closeModal(true); },
    setSound: on => { store.set('faris-sound', on ? 'on' : 'off'); paintSound(); }
  };
}

/* the console that lives in the hero (the old decorative playground, now real) */
function initHeroConsole(){
  const host = $('#heroConsole'); if (!host) return;
  const con = mountConsole(host, consoleCtx(true), { prompt: 'guest@faris:~$' });
  $('#heroChips').addEventListener('click', e => { const b = e.target.closest('[data-run]'); if (b){ con.run(b.dataset.run); beep(540); } });
  window.__heroConsole = con;
}

function initTerminal(){
  const modal = $('#terminalModal');
  const open = () => {
    consoleInst ||= mountConsole($('#terminalConsole'), consoleCtx(false));
    openModal(modal, '.terminal-input-row input'); beep(520);
  };
  $('#terminalOpen').addEventListener('click', open);
  /* "/" opens the terminal from anywhere (not while typing in a field, and not inside XIRAF) */
  document.addEventListener('keydown', e => {
    if (e.key === '/' && !getActiveModal() && !xiraf?.isOn && !e.metaKey && !e.ctrlKey && !/^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName)){ e.preventDefault(); open(); }
  });
  $('#arcadeOpen')?.addEventListener('click', () => openPortfolioArcade(null));
}

/* ── Ask Faris (fixed answers — no backend connected; behaviour preserved) ── */
function initAsk(){
  const answers = {
    interest: () => 'Faris is a student exploring ideas, AI and the process of turning concepts into real projects.',
    building: () => 'Projects like ECHO (an interactive narrative game), EVENTRA (an event-organizer app) and the PROOFCHECK concept — plus this portfolio, which runs on a Supabase-backed dashboard.',
    study: () => 'He is in the second year of a BA in Sociology at Pondicherry University.',
    contact: () => 'Email ' + (data.profile.email || 'farisdomain@gmail.com') + ', message him on Instagram, or use the contact form below.'
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
  const mailFallback = () => 'Or email me directly at ' + (data.profile.email || 'farisdomain@gmail.com') + '.';
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

/* ── Hero light show: orb parallax, glass spotlight, local clock ─────── */
function initHeroFx(){
  const orbs = $('#orbs'), hero = $('.hero');
  if (orbs && hero && !reduceMotion.matches && matchMedia('(pointer:fine)').matches){
    let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0, visible = true;
    const tick = () => {
      cx += (tx - cx) * .08; cy += (ty - cy) * .08;
      orbs.style.setProperty('--px', cx.toFixed(3)); orbs.style.setProperty('--py', cy.toFixed(3));
      raf = visible && (Math.abs(tx - cx) > .002 || Math.abs(ty - cy) > .002) ? requestAnimationFrame(tick) : 0;
    };
    hero.addEventListener('pointermove', e => { const r = hero.getBoundingClientRect(); tx = ((e.clientX - r.left) / r.width - .5) * 2; ty = ((e.clientY - r.top) / r.height - .5) * 2; raf ||= requestAnimationFrame(tick); }, { passive: true });
    if ('IntersectionObserver' in window) new IntersectionObserver(([en]) => { visible = en.isIntersecting; document.documentElement.classList.toggle('is-paused', !visible && scrollY > innerHeight * 2); }, { threshold: 0 }).observe(hero);
  }
  /* the glass catches the light where the pointer is */
  if (matchMedia('(pointer:fine)').matches){
    let pend = null, raf2 = 0;
    document.addEventListener('pointermove', e => {
      const g = e.target.closest?.('.glass,.glass-xl'); if (!g) return;
      pend = { g, x: e.clientX, y: e.clientY };
      raf2 ||= requestAnimationFrame(() => { raf2 = 0; if (!pend) return; const r = pend.g.getBoundingClientRect(); pend.g.style.setProperty('--mx', ((pend.x - r.left) / r.width * 100).toFixed(1) + '%'); pend.g.style.setProperty('--my', ((pend.y - r.top) / r.height * 100).toFixed(1) + '%'); });
    }, { passive: true });
  }
  /* local time in India (real, computed — nothing invented) */
  const clock = $('#clock'), sub = $('#clockSub');
  if (clock){
    const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false });
    const day = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', weekday: 'long', day: 'numeric', month: 'short' });
    const paint = () => { const d = new Date(); clock.textContent = fmt.format(d); sub.textContent = 'IST · ' + day.format(d); };
    paint(); setInterval(() => { if (!document.hidden) paint(); }, 15000);
  }
}

/* ── Nav: scroll state, active section, progress, mobile menu ────────── */
function initNav(){
  const links = $('#navlinks'), prog = $('#progress'), dock = $('#dock');
  let ticking = false;
  const onScroll = () => {
    if (ticking) return; ticking = true;
    requestAnimationFrame(() => {
      const max = document.documentElement.scrollHeight - innerHeight;
      prog.style.width = (max > 0 ? scrollY / max * 100 : 0) + '%';
      ticking = false;
    });
  };
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  if ('IntersectionObserver' in window){
    const map = new Map($$('a[data-sec]', links).map(a => [a.dataset.sec, a]));
    const alias = { education: 'thoughts' };                        /* sections without a dock item light up the nearest one */
    const so = new IntersectionObserver(es => es.forEach(en => {
      if (!en.isIntersecting) return;
      const a = map.get(alias[en.target.id] || en.target.id); if (!a) return;
      map.forEach(x => x.removeAttribute('aria-current')); a.setAttribute('aria-current', 'true');
    }), { rootMargin: '-45% 0px -50% 0px' });
    ['top', 'experience', 'work', 'skills', 'thoughts', 'education', 'faq', 'contact'].forEach(id => { const s = document.getElementById(id); if (s) so.observe(s); });
  }

  /* fine pointers: the dock magnifies icons under the cursor */
  if (matchMedia('(pointer:fine)').matches && !reduceMotion.matches){
    const items = $$('a,button.dock-term', dock);
    dock.addEventListener('pointermove', e => items.forEach(it => { const r = it.getBoundingClientRect(), d = Math.abs(e.clientX - (r.left + r.width / 2)); it.style.transform = `translateY(${-Math.max(0, 7 - d / 12).toFixed(1)}px) scale(${(1 + Math.max(0, .16 - d / 600)).toFixed(3)})`; }), { passive: true });
    dock.addEventListener('pointerleave', () => items.forEach(it => { it.style.transform = ''; }));
  }
}

function paintSound(){
  const b = $('#soundToggle'), on = soundOn();
  b.setAttribute('aria-pressed', String(on));
  b.title = 'Sound effects (' + (on ? 'on' : 'off') + ')';
}

/* ── Boot ────────────────────────────────────────────────────────────── */
// freeze the aurora while scrolling: the glass panels stop re-blurring a moving backdrop
{ let t = 0; addEventListener('scroll', () => { const h = document.documentElement; h.classList.add('is-scrolling'); clearTimeout(t); t = setTimeout(() => h.classList.remove('is-scrolling'), 140); }, { passive: true }); }

function start(){
  setTheme(getTheme(), false);
  paintSound();
  initModals();
  xiraf = createXiraf();
  $('#themeToggle').addEventListener('click', () => setTheme(getTheme() === 'dark' ? 'light' : 'dark'));
  $('#soundToggle').addEventListener('click', () => { store.set('faris-sound', soundOn() ? 'off' : 'on'); paintSound(); beep(680); });
  document.addEventListener('click', e => { if (e.target.closest('[data-sound]')) beep(); });
  $('#backTop').addEventListener('click', () => scrollTo({ top: 0, behavior: reduceMotion.matches ? 'auto' : 'smooth' }));
  $('#xirafOpen')?.addEventListener('click', e => xiraf.boot({ returnFocus: e.currentTarget }));

  initNav(); initTerminal(); initHeroConsole(); initAsk(); initContact(); initHeroFx(); initProjectShowcase();
  glass.mountAll();                     // the static panels in index.html
  observeReveals();

  on('data', renderAll);
  loadAll().then(() => { if (location.hash === '#xiraf') xiraf.boot(); });

  /* a hook for tests and power users; read-only surface, nothing sensitive */
  window.FARIS = Object.freeze({ glass, get xiraf(){ return xiraf; }, profile: () => perfProfile() });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
