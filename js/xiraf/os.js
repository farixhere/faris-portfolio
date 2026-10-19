/* ==========================================================================
   XIRAF OS shell — boot sequence, desktop, menubar, launcher, notifications, dock.

   State lives in one place (the `os` object): off → booting → on → exiting → off.
   The portfolio underneath is never torn down; it is only made inert and visually
   tucked away, so exiting returns to the exact scroll position and state.
   The entire page is transformed: <html class="os"> swaps the design tokens, the
   portfolio chrome animates out, and the desktop animates in as one coordinated move.
   ========================================================================== */
import { $, $$, esc, reduceMotion, announce, getTheme, setTheme, emit, store } from '../util.js';
import { createWM, isMobileOS } from './windows.js';
import { APPS, appById, ICONS } from './apps.js';
import { closeModal } from '../modal.js';

const BOOT_LINES = ['Starting glass compositor', 'Mounting portfolio data', 'Loading window manager', 'Welcome'];

export function createXiraf({ openPortfolioArcade, getRoot = () => document.getElementById('main') } = {}){
  let state = 'off', root = null, wm = null, lastFocus = null, clockTimer = 0, bootTimers = [], launcherOpen = false, notifOpen = false, mounted = null;
  const later = (fn, ms) => { const id = setTimeout(() => { bootTimers = bootTimers.filter(x => x !== id); fn(); }, ms); bootTimers.push(id); return id; };

  /* the context apps and the console use to talk to the OS */
  const ctx = {
    exit: target => api.exit(target),
    consoleCtx: () => ({
      inOS: true, xiraf: api,
      arcade: { open: id => api.openApp('arcade', { game: id }) },
      goto: (k) => { if (k === 'projects') api.openApp('projects'); else api.openApp('portfolio', { section: k === 'about' ? 'about' : k }); },
      close: null
    })
  };

  function build(){
    root = document.createElement('div');
    root.id = 'xiraf'; root.className = 'xiraf'; root.hidden = true;
    root.innerHTML = `
      <div class="xf-wall" aria-hidden="true"><i class="xf-orb xf-o1"></i><i class="xf-orb xf-o2"></i><i class="xf-orb xf-o3"></i><i class="xf-grid"></i></div>
      <div class="xf-boot" role="status" aria-live="polite" hidden>
        <div class="xf-boot-in">
          <div class="xf-ring" aria-hidden="true"><span>X</span></div>
          <h1>XIRAF<b> OS</b></h1>
          <p>A New Digital Environment</p>
          <div class="xf-bar" aria-hidden="true"><i></i></div>
          <small class="xf-boot-line">Starting…</small>
        </div>
      </div>
      <div class="xf-ui" hidden>
        <header class="xf-menubar glass-os">
          <button type="button" class="xf-launch" aria-haspopup="dialog" aria-expanded="false" aria-controls="xfLauncher" aria-label="Open launcher"><span class="xf-x" aria-hidden="true">X</span><span class="xf-name">XIRAF</span></button>
          <span class="xf-active" aria-live="polite"></span>
          <div class="xf-tray">
            <button type="button" class="xf-tbtn" data-act="theme" aria-label="Switch theme"><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-sun"/></svg></button>
            <button type="button" class="xf-tbtn" data-act="notif" aria-haspopup="dialog" aria-expanded="false" aria-controls="xfNotif" aria-label="Notifications">${ICONS.bell}</button>
            <time class="xf-clock" aria-label="Current time"></time>
            <button type="button" class="xf-tbtn xf-exit" data-act="exit" aria-label="Exit XIRAF OS">${ICONS.exit}<span>Exit</span></button>
          </div>
        </header>
        <div class="xf-desktop" id="xfDesktop" tabindex="-1" role="region" aria-label="XIRAF desktop">
          <ul class="xf-icons" aria-label="Desktop shortcuts">${APPS.map(a => `<li><button type="button" class="xf-icon" data-app="${a.id}"><span class="xf-ico glass-os" aria-hidden="true">${a.icon}</span><span class="xf-label">${esc(a.title)}</span></button></li>`).join('')}</ul>
        </div>
        <section class="xf-panel xf-launcher glass-os" id="xfLauncher" role="dialog" aria-label="Launcher" hidden>
          <label class="xf-search"><span class="sr-only">Search apps</span>${ICONS.search}<input type="search" placeholder="Search apps…" autocomplete="off" spellcheck="false"></label>
          <ul class="xf-apps">${APPS.map(a => `<li><button type="button" class="xf-app" data-app="${a.id}" data-name="${esc((a.title + ' ' + a.hint).toLowerCase())}"><span class="xf-ico" aria-hidden="true">${a.icon}</span><span><b>${esc(a.title)}</b><small>${esc(a.hint)}</small></span></button></li>`).join('')}</ul>
          <div class="xf-panel-foot"><button type="button" class="os-btn" data-act="full">Open full portfolio</button><button type="button" class="os-btn" data-act="exit">${ICONS.exit} Exit XIRAF</button></div>
        </section>
        <section class="xf-panel xf-notif glass-os" id="xfNotif" role="dialog" aria-label="Notifications" hidden>
          <h2>Notifications</h2>
          <ul class="xf-nlist">
            <li><b>Welcome to XIRAF OS</b><span>This is the FARIS portfolio, rendered as a desktop. Nothing was lost — exit any time.</span></li>
            <li><b>Tip</b><span>Open Terminal and type <code>games</code> to see what’s in the Arcade.</span></li>
            <li><b>Tip</b><span>Type <code>exit xiraf</code> to return to the portfolio.</span></li>
          </ul>
        </section>
        <nav class="xf-dock glass-os" aria-label="Applications">${APPS.map(a => `<button type="button" class="xf-dbtn" data-app="${a.id}" aria-label="${esc(a.title)}" title="${esc(a.title)}"><span class="xf-ico" aria-hidden="true">${a.icon}</span><i class="xf-dot" aria-hidden="true"></i></button>`).join('')}</nav>
      </div>`;
    document.body.appendChild(root);
    const desktop = $('#xfDesktop', root);
    wm = createWM(desktop, { onChange: paintChrome });
    root.addEventListener('click', onClick);
    root.addEventListener('keydown', onKey);
    root.addEventListener('pointerdown', onOutside, true);
    $('.xf-search input', root).addEventListener('input', onSearch);
  }

  const appDef = a => ({ ...a, mount: (host, w, opts) => a.mount(host, w, opts, ctx), onClosed: () => { if (!wm.list().length) $('#xfDesktop', root)?.focus({ preventScroll: true }); } });

  function openApp(id, opts = {}){
    const a = appById(id); if (!a || state !== 'on') return null;
    setLauncher(false); setNotif(false);
    const win = wm.open(appDef(a), { ...opts, onExisting: ex => {
      if (id === 'arcade' && opts.game) ex.inst?.open?.(opts.game);
      if (id === 'portfolio' && opts.section) ex.inst?.goSection?.(opts.section);
    } });
    return win;
  }

  /* ── chrome: dock indicators, menubar title ── */
  function paintChrome({ windows, activeId }){
    if (!root) return;
    $$('.xf-dbtn', root).forEach(b => {
      const w = windows.find(x => x.id === b.dataset.app);
      b.classList.toggle('run', !!w); b.classList.toggle('on', !!w && w.id === activeId && !w.min);
      b.setAttribute('aria-pressed', String(!!w && w.id === activeId && !w.min));
    });
    const act = windows.find(x => x.id === activeId);
    $('.xf-active', root).textContent = act ? act.title : 'Desktop';
  }

  function setLauncher(open){
    if (open === launcherOpen) return;
    launcherOpen = open;
    const p = $('#xfLauncher', root), b = $('.xf-launch', root);
    b.setAttribute('aria-expanded', String(open)); b.setAttribute('aria-label', open ? 'Close launcher' : 'Open launcher');
    if (open){ setNotif(false); p.hidden = false; p.classList.add('xf-pop'); const i = $('input', p); i.value = ''; onSearch(); setTimeout(() => i.focus({ preventScroll: true }), 20); }
    else { p.hidden = true; p.classList.remove('xf-pop'); }
  }
  function setNotif(open){
    if (open === notifOpen) return;
    notifOpen = open;
    const p = $('#xfNotif', root), b = $('[data-act=notif]', root);
    b.setAttribute('aria-expanded', String(open));
    if (open){ setLauncher(false); p.hidden = false; p.classList.add('xf-pop'); } else { p.hidden = true; p.classList.remove('xf-pop'); }
  }
  function onSearch(){
    const q = $('.xf-search input', root).value.trim().toLowerCase();
    $$('.xf-app', root).forEach(b => { b.parentElement.hidden = !!q && !b.dataset.name.includes(q); });
  }

  function onClick(e){
    const appBtn = e.target.closest('.xf-icon[data-app], .xf-dbtn[data-app], .xf-app[data-app]');
    if (appBtn){
      const id = appBtn.dataset.app;
      if (appBtn.classList.contains('xf-icon') && !matchMedia('(pointer: coarse)').matches && e.detail === 1){
        $$('.xf-icon', root).forEach(x => x.classList.toggle('sel', x === appBtn)); return;      /* desktop: single click selects, double-click opens */
      }
      if (appBtn.classList.contains('xf-dbtn')){
        const w = wm.get(id);
        if (w && !w.min && wm.activeId === id){ wm.minimize(w); return; }
      }
      openApp(id); return;
    }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'exit') api.exit();
    else if (act === 'full') api.exit('#top');
    else if (act === 'theme') setTheme(getTheme() === 'dark' ? 'light' : 'dark');
    else if (act === 'notif') setNotif(!notifOpen);
    else if (e.target.closest('.xf-launch')) setLauncher(!launcherOpen);
  }
  function onKey(e){
    if (e.key === 'Escape'){
      if (launcherOpen){ e.preventDefault(); setLauncher(false); $('.xf-launch', root).focus(); }
      else if (notifOpen){ e.preventDefault(); setNotif(false); $('[data-act=notif]', root).focus(); }
    } else if ((e.key === 'Enter' || e.key === ' ') && e.target.classList?.contains('xf-icon')){
      e.preventDefault(); openApp(e.target.dataset.app);
    }
  }
  function onOutside(e){
    if ((launcherOpen || notifOpen) && !e.target.closest('.xf-panel, .xf-launch, [data-act=notif]')){ setLauncher(false); setNotif(false); }
    if (!e.target.closest('.xf-icon')) $$('.xf-icon.sel', root).forEach(x => x.classList.remove('sel'));
  }

  function tickClock(){
    const el = $('.xf-clock', root); if (!el) return;
    const d = new Date();
    el.textContent = d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }) + '  ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    el.dateTime = d.toISOString();
  }
  function syncThemeIcon(){ const u = $('[data-act=theme] use', root); if (u) u.setAttribute('href', getTheme() === 'dark' ? '#i-moon' : '#i-sun'); }
  const onTheme = () => syncThemeIcon();

  /* ── boot / exit ── */
  function pageShell(on){
    const els = [getRoot(), $('#topbar'), $('#dock'), document.querySelector('.footer'), $('#askFaris'), document.querySelector('.progress')].filter(Boolean);
    for (const el of els){ el.toggleAttribute('inert', on); if (on) el.setAttribute('aria-hidden', 'true'); else el.removeAttribute('aria-hidden'); }
  }

  const api = {
    get state(){ return state; },
    get isOn(){ return state === 'on' || state === 'booting'; },
    openApp,
    boot(opts = {}){
      if (state !== 'off') return false;
      state = 'booting';
      lastFocus = opts.returnFocus || document.activeElement;
      closeModal(true);
      if (!root) build();
      mounted = true;
      const html = document.documentElement, boot = $('.xf-boot', root), ui = $('.xf-ui', root), line = $('.xf-boot-line', root), bar = $('.xf-bar i', root);
      root.hidden = false; boot.hidden = false; ui.hidden = true;
      html.classList.add('os', 'os-booting');
      document.body.style.overflow = 'hidden';
      pageShell(true);
      announce('Starting XIRAF OS');
      const fast = reduceMotion.matches, total = fast ? 420 : (isMobileOS() ? 1500 : 1900);
      bar.style.transition = `transform ${total}ms cubic-bezier(.3,.6,.2,1)`;
      requestAnimationFrame(() => requestAnimationFrame(() => { bar.style.transform = 'scaleX(1)'; }));
      BOOT_LINES.forEach((t, i) => later(() => { if (state === 'booting') line.textContent = t + '…'; }, (total / BOOT_LINES.length) * i));
      later(() => {
        if (state !== 'booting') return;
        ui.hidden = false; root.classList.add('xf-live');
        html.classList.remove('os-booting'); html.classList.add('os-live');
        later(() => { boot.hidden = true; bar.style.transform = ''; bar.style.transition = ''; }, fast ? 0 : 700);
        state = 'on';
        syncThemeIcon(); tickClock(); clockTimer = setInterval(tickClock, 15000);
        document.addEventListener('faris:theme', onTheme);
        $('#xfDesktop', root).focus({ preventScroll: true });
        paintChrome({ windows: [], activeId: null });
        announce('XIRAF OS is ready. Use the launcher or desktop shortcuts to open an app.');
        emit('xiraf', 'on');
      }, total);
      return true;
    },
    exit(target){
      if (state !== 'on' && state !== 'booting') return false;
      const wasBooting = state === 'booting';
      state = 'exiting';
      bootTimers.forEach(clearTimeout); bootTimers = [];
      clearInterval(clockTimer); clockTimer = 0;
      document.removeEventListener('faris:theme', onTheme);
      setLauncher(false); setNotif(false);
      const html = document.documentElement;
      root.classList.add('xf-leaving');
      html.classList.remove('os-live', 'os-booting'); html.classList.add('os-leaving');
      const fast = reduceMotion.matches;
      later(() => {
        wm?.closeAll();                                         // releases every game / console / observer
        pageShell(false);
        root.hidden = true; root.classList.remove('xf-leaving', 'xf-live');
        $('.xf-ui', root).hidden = true; $('.xf-boot', root).hidden = true;
        html.classList.remove('os', 'os-leaving');
        document.body.style.overflow = '';
        state = 'off'; mounted = null;
        if (target){ document.querySelector(target)?.scrollIntoView({ behavior: 'auto', block: 'start' }); }
        const f = (target ? document.querySelector('#heroTitle,' + target) : null) || lastFocus;
        if (f && f.isConnected) { if (!f.matches('a,button,input,textarea,[tabindex]')) f.setAttribute('tabindex', '-1'); f.focus({ preventScroll: true }); }
        announce('Returned to the FARIS portfolio.');
        emit('xiraf', 'off');
      }, fast || wasBooting ? 0 : 520);
      return true;
    },
    destroy(){ api.exit(); }
  };
  return api;
}
