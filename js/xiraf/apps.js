/* ==========================================================================
   XIRAF apps. Each app is { id, title, icon, w, h, mount(host, api, opts) } and
   mount() returns { destroy(), ...optional methods }. All content comes from the same
   shared data store as the portfolio, so the two modes can never disagree.
   ========================================================================== */
import { $, $$, esc, safeUrl, announce, on } from '../util.js';
import { data } from '../data.js';
import { mediaFor, armArtFallback } from '../art.js';
import { mountConsole } from '../console.js';
import { mountArcade } from '../arcade/launcher.js';
import { GAMES } from '../arcade/registry.js';

const ARROW = '<svg class="ico-s" aria-hidden="true"><use href="#i-arrow"/></svg>';
const svg = d => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
export const ICONS = {
  portfolio: svg('<rect x="3.5" y="4.5" width="17" height="15" rx="3" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M3.5 9h17M8 14h5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>'),
  projects: svg('<path d="M3.5 8a2 2 0 0 1 2-2h4l2 2.2h7a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>'),
  terminal: svg('<rect x="3.5" y="4.5" width="17" height="15" rx="3" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="m8 10 3 2.5L8 15M13 15h3.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>'),
  arcade: svg('<rect x="3" y="8" width="18" height="10" rx="5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M8 11v4M6 13h4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><circle cx="15.5" cy="12" r="1.1" fill="currentColor"/><circle cx="18" cy="14" r="1.1" fill="currentColor"/>'),
  about: svg('<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 11v5.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="7.8" r="1.1" fill="currentColor"/>'),
  exit: svg('<path d="M10 4.5H6.5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2H10M15 8l4 4-4 4M19 12H9.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>'),
  bell: svg('<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15zM10 20a2 2 0 0 0 4 0" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>'),
  grid: svg('<g fill="currentColor"><rect x="4" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.8"/></g>'),
  search: svg('<circle cx="11" cy="11" r="6.2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="m16 16 4 4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>')
};

/* Re-render an app view whenever the shared data (re)loads. */
function bindData(render){
  return on('data', () => render());
}

/* ── Portfolio ─────────────────────────────────────────────────────────── */
function portfolioApp(host, api, opts, ctx){
  host.classList.add('app-portfolio');
  const links = () => {
    const p = data.profile, out = [];
    const ig = safeUrl(p.instagram), gh = safeUrl(p.github), li = safeUrl(p.linkedin);
    if (p.email) out.push(`<a href="mailto:${esc(p.email)}">${esc(p.email)} ${ARROW}</a>`);
    if (ig) out.push(`<a href="${esc(ig)}" target="_blank" rel="noopener noreferrer">Instagram ${ARROW}</a>`);
    if (gh) out.push(`<a href="${esc(gh)}" target="_blank" rel="noopener noreferrer">GitHub ${ARROW}</a>`);
    if (li) out.push(`<a href="${esc(li)}" target="_blank" rel="noopener noreferrer">LinkedIn ${ARROW}</a>`);
    return out.join('');
  };
  function render(){
    const p = data.profile;
    const groups = new Map();
    data.skills.forEach(r => { const k = (r.label || 'Exploring').trim(); (groups.get(k) || groups.set(k, []).get(k)).push(r); });
    host.innerHTML = `
      <article class="app-scroll">
        <section data-sec="about" class="ap-hero">
          <p class="label">Student · Exploring what’s possible</p>
          <h3>${esc(p.name || 'Faris')}</h3>
          <p class="lead">Curious by nature. Building by experimenting.</p>
          <p>${esc(p.bio || '')}</p>
          <div class="ap-actions"><button type="button" class="os-btn os-btn-primary" data-act="full">Open the full portfolio ${ARROW}</button></div>
        </section>
        <section data-sec="experience"><h4>The way I work</h4><ol class="ap-steps"><li><b>01</b> Explore <span>Follow the questions that won’t leave me alone.</span></li><li><b>02</b> Build <span>Turn ideas into something you can actually use.</span></li><li><b>03</b> Ship <span>Stop polishing forever. Put the thing out there.</span></li></ol></section>
        <section data-sec="now"><h4>Right now</h4>${data.experiments.length ? `<ul class="ap-list">${data.experiments.map(x => `<li><div><b>${esc(x.title)}</b><span>${esc(x.description || '')}</span></div><em>${esc(x.status || 'Active')}</em></li>`).join('')}</ul>` : '<p class="ap-muted">Nothing listed right now.</p>'}</section>
        <section data-sec="skills"><h4>Toolbox</h4><p class="ap-note"><b>Honest note —</b> I’m a beginner coder. I build with AI tools as a collaborator and learn from everything they help me make.</p>
          ${groups.size ? [...groups].map(([label, items]) => `<div class="ap-group"><h5>${esc(label)}</h5><ul class="ap-chips">${items.map(s => `<li>${esc(s.icon || '✦')} ${esc(s.name)}</li>`).join('')}</ul></div>`).join('') : '<p class="ap-muted">The toolbox is being filled.</p>'}</section>
        <section data-sec="education"><h4>Education</h4><dl class="ap-dl"><div><dt>Degree</dt><dd>BA Sociology</dd></div><div><dt>Year</dt><dd>Second year</dd></div><div><dt>University</dt><dd>Pondicherry University</dd></div><div><dt>Outside class</dt><dd>AI · web · learning by building</dd></div></dl></section>
        ${data.posts.length ? `<section data-sec="blog"><h4>Notes</h4><ul class="ap-list">${data.posts.map(x => `<li><div><b>${esc(x.title)}</b><span>${esc(x.excerpt || String(x.content || '').slice(0, 120))}</span></div></li>`).join('')}</ul></section>` : ''}
        <section data-sec="contact"><h4>Contact</h4><div class="ap-links">${links()}</div></section>
      </article>`;
  }
  render();
  const off = bindData(render);
  const onClick = e => { if (e.target.closest('[data-act=full]')) ctx.exit('#top'); };
  host.addEventListener('click', onClick);
  const goSection = sec => {
    const t = $(`[data-sec="${sec}"]`, host); if (t){ t.scrollIntoView({ block: 'start', behavior: 'auto' }); t.classList.add('ap-flash'); setTimeout(() => t.classList.remove('ap-flash'), 900); }
  };
  if (opts?.section) setTimeout(() => goSection(opts.section), 60);
  return { goSection, destroy(){ off(); host.removeEventListener('click', onClick); host.innerHTML = ''; } };
}

/* ── Projects ──────────────────────────────────────────────────────────── */
function projectsApp(host, api){
  host.classList.add('app-projects');
  let sel = 0, detailOpen = false;
  const rows = () => data.projects;
  function render(){
    const list = rows();
    if (sel >= list.length) sel = 0;
    host.innerHTML = `
      <div class="pj-wrap${detailOpen ? ' pj-detail' : ''}">
        <ul class="pj-list" role="listbox" aria-label="Projects">${list.map((p, i) => `
          <li role="presentation"><button type="button" role="option" class="pj-item" data-i="${i}" aria-selected="${i === sel}">
            <span class="pj-thumb" aria-hidden="true">${mediaFor(p)}</span>
            <span class="pj-meta"><b>${esc(p.title)}</b><small>${esc(p.category || 'Project')}${p.status ? ' · ' + esc(p.status) : ''}</small></span>
          </button></li>`).join('')}</ul>
        <div class="pj-view">${list.length ? detail(list[sel]) : '<p class="ap-muted">No projects yet.</p>'}</div>
      </div>`;
    armArtFallback(host, img => list[+img.closest('.pj-item')?.dataset.i ?? sel]);
  }
  function detail(p){
    const live = safeUrl(p.live_url), src = safeUrl(p.github_url);
    return `<button type="button" class="pj-back os-btn" data-act="back" aria-label="Back to project list">← Projects</button>
      <div class="pj-art" aria-hidden="true">${mediaFor(p, { loading: 'eager' })}</div>
      <p class="label">${esc(p.category || 'Project')}</p>
      <h3>${esc(p.title)}</h3>
      ${p.status ? `<p class="pj-status">${esc(p.status)}</p>` : ''}
      <p>${esc(p.details || p.description || '')}</p>
      ${(p.technologies || []).length ? `<ul class="ap-chips">${p.technologies.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
      <div class="ap-actions">${live ? `<a class="os-btn os-btn-primary" href="${esc(live)}" target="_blank" rel="noopener noreferrer">Live project ${ARROW}</a>` : ''}${src ? `<a class="os-btn" href="${esc(src)}" target="_blank" rel="noopener noreferrer">Source code ${ARROW}</a>` : ''}</div>`;
  }
  render();
  const off = bindData(render);
  const onClick = e => {
    const it = e.target.closest('.pj-item');
    if (it){ sel = +it.dataset.i; detailOpen = true; render(); host.querySelector(`.pj-item[data-i="${sel}"]`)?.focus({ preventScroll: true }); announce(`${rows()[sel]?.title} selected`); return; }
    if (e.target.closest('[data-act=back]')){ detailOpen = false; render(); host.querySelector(`.pj-item[data-i="${sel}"]`)?.focus({ preventScroll: true }); }
  };
  const onKey = e => {
    const it = e.target.closest('.pj-item'); if (!it || !['ArrowDown', 'ArrowUp'].includes(e.key)) return;
    e.preventDefault(); const items = $$('.pj-item', host), i = items.indexOf(it), n = items[clampIdx(i + (e.key === 'ArrowDown' ? 1 : -1), items.length)];
    n?.focus({ preventScroll: true });
  };
  host.addEventListener('click', onClick); host.addEventListener('keydown', onKey);
  return {
    select(i){ sel = Math.max(0, Math.min(rows().length - 1, i)); detailOpen = true; render(); },
    destroy(){ off(); host.removeEventListener('click', onClick); host.removeEventListener('keydown', onKey); host.innerHTML = ''; }
  };
}
const clampIdx = (i, n) => Math.max(0, Math.min(n - 1, i));

/* ── Terminal ──────────────────────────────────────────────────────────── */
function terminalApp(host, api, opts, ctx){
  host.classList.add('app-terminal');
  const con = mountConsole(host, ctx.consoleCtx(), { prompt: 'guest@xiraf:~$' });
  setTimeout(() => con.focus(), 40);
  return { focus: con.focus, destroy(){ con.destroy(); } };
}

/* ── Arcade ────────────────────────────────────────────────────────────── */
function arcadeApp(host, api, opts){
  const inst = mountArcade(host, { game: opts?.game || null, onTitle: t => api.setTitle(t === 'Arcade' ? 'Arcade' : 'Arcade · ' + t) });
  return { open: id => inst.open(id), menu: () => inst.menu(), destroy: () => inst.destroy() };
}

/* ── About XIRAF ───────────────────────────────────────────────────────── */
function aboutApp(host, api, opts, ctx){
  host.classList.add('app-about');
  host.innerHTML = `
    <article class="app-scroll">
      <div class="ab-brand"><span class="ab-mark" aria-hidden="true">X</span><div><h3>XIRAF OS</h3><p>A New Digital Environment</p></div></div>
      <p>XIRAF is not a separate website. It is the FARIS portfolio rendered as a desktop — the same projects, skills and links, in a different shape. Everything you see here is read from the same live content as the regular site.</p>
      <h4>What’s inside</h4>
      <ul class="ap-list">
        <li><div><b>Portfolio</b><span>Who Faris is, what he’s working on, the toolbox and how to get in touch.</span></div></li>
        <li><div><b>Projects</b><span>Browse every project, with real links only.</span></div></li>
        <li><div><b>Terminal</b><span>The same console as the portfolio. Try <code>help</code>, <code>theme dark</code> or <code>games</code>.</span></div></li>
        <li><div><b>Arcade</b><span>${GAMES.map(g => esc(g.title)).join(', ')} — scores stay on this device.</span></div></li>
      </ul>
      <h4>Tips</h4>
      <ul class="ap-tips"><li>Drag windows by their title bar and resize from the bottom-right corner. On a phone, apps open as full-screen sheets.</li><li>Type <code>exit xiraf</code> in any terminal — or use the Exit button — to return to the portfolio exactly where you left it.</li><li>Prefer less motion? XIRAF follows your system’s reduced-motion setting.</li></ul>
      <div class="ap-actions"><button type="button" class="os-btn os-btn-primary" data-act="exit">Exit XIRAF OS ${ARROW}</button></div>
    </article>`;
  const onClick = e => { if (e.target.closest('[data-act=exit]')) ctx.exit(); };
  host.addEventListener('click', onClick);
  return { destroy(){ host.removeEventListener('click', onClick); host.innerHTML = ''; } };
}

export const APPS = [
  { id: 'portfolio', title: 'Portfolio',  icon: ICONS.portfolio, w: 720, h: 520, mount: portfolioApp, hint: 'About Faris' },
  { id: 'projects',  title: 'Projects',   icon: ICONS.projects,  w: 760, h: 500, mount: projectsApp,  hint: 'Things worth building' },
  { id: 'terminal',  title: 'Terminal',   icon: ICONS.terminal,  w: 640, h: 420, mount: terminalApp,  hint: 'Console commands' },
  { id: 'arcade',    title: 'Arcade',     icon: ICONS.arcade,    w: 620, h: 640, mount: arcadeApp,    hint: 'Five mini-games' },
  { id: 'about',     title: 'About XIRAF', icon: ICONS.about,    w: 560, h: 520, mount: aboutApp,     hint: 'What this is' }
];
export const appById = id => APPS.find(a => a.id === id) || null;
