/* ==========================================================================
   NOVA — the AI guide of FARIS OS.
   Two parts:
     1. The hero introduction (time-aware greeting, typed lines, skip, opt-in voice).
     2. A grounded chat assistant. It is NOT a language model: it matches the visitor's
        question to a fixed set of intents and answers only from this site's own
        content (the Supabase-backed `data` object, plus the fixed facts already
        published on the page). When it has nothing, it says so.
   Nothing here calls an external service, so no key can leak.
   ========================================================================== */
import { $, $$, esc, safeUrl, store, reduceMotion, beep } from './util.js';
import { data } from './data.js';

const hello = () => {
  const h = new Date().getHours();
  return h < 5 ? 'Good evening' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

/* ── Voice (opt-in; browsers block autoplay, so it only ever starts from a click) ── */
const canSpeak = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
const voice = {
  on: () => canSpeak && store.get('faris-nova-voice') === 'on',
  say(text){
    if (!this.on()) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text.replace(/\s+/g, ' '));
      u.rate = .98; u.pitch = 1;
      speechSynthesis.speak(u);
    } catch { /* voice is a nicety */ }
  },
  stop(){ try { speechSynthesis.cancel(); } catch { /* noop */ } }
};

/* ── 1. Hero introduction ────────────────────────────────────────────── */
function initIntro(){
  const box = $('#novaText'), full = $('#novaFull'), skip = $('#novaSkip'), vbtn = $('#novaVoice');
  if (!box) return;
  const lines = [hello() + '.', 'I am NOVA, your digital guide.', 'Welcome to FARIS OS.', 'Today, I’ll be introducing you to the mind behind this system.', 'Shall we begin?'];
  full.textContent = lines.join(' ');
  let timer = 0, done = false, run = 0;

  const paintAll = () => { box.innerHTML = lines.map((l, i) => `<p class="${i === 0 ? 'nl-lead' : ''}">${esc(l)}</p>`).join(''); };
  const finish = () => { done = true; clearTimeout(timer); run++; paintAll(); skip.textContent = 'Replay'; skip.dataset.mode = 'replay'; box.classList.add('done'); };

  const play = () => {
    const my = ++run; done = false; box.classList.remove('done'); box.innerHTML = '';
    skip.textContent = 'Skip intro'; skip.dataset.mode = 'skip';
    if (reduceMotion.matches){ finish(); return; }
    let li = 0;
    const next = () => {
      if (my !== run) return;
      if (li >= lines.length){ finish(); return; }
      const p = document.createElement('p'); if (li === 0) p.className = 'nl-lead'; box.appendChild(p);
      const text = lines[li++]; let ci = 0;
      const type = () => {
        if (my !== run) return;
        p.textContent = text.slice(0, ++ci);
        if (ci < text.length) timer = setTimeout(type, 22);
        else timer = setTimeout(next, 420);
      };
      type();
    };
    timer = setTimeout(next, 650);
  };

  const paintVoice = () => {
    const on = voice.on();
    vbtn.setAttribute('aria-pressed', String(on));
    vbtn.setAttribute('aria-label', on ? 'Turn off NOVA’s voice' : 'Turn on NOVA’s voice');
    vbtn.title = 'Voice narration (' + (on ? 'on' : 'off') + ')';
  };
  if (!canSpeak) vbtn.hidden = true;
  paintVoice();
  vbtn.addEventListener('click', () => {
    store.set('faris-nova-voice', voice.on() ? 'off' : 'on'); paintVoice();
    if (voice.on()){ voice.say(lines.join(' ')); } else voice.stop();
  });
  skip.addEventListener('click', () => {
    if (skip.dataset.mode === 'replay'){ play(); if (voice.on()) voice.say(lines.join(' ')); }
    else { voice.stop(); finish(); }
  });
  play();
}

/* ── Pointer: NOVA turns a few degrees toward the visitor (fine pointers, motion allowed) ── */
function initLook(){
  const rig = $('#novaRig'), hero = $('.hero-os');
  if (!rig || !hero) return;
  if (reduceMotion.matches || !matchMedia('(pointer:fine)').matches) return;
  let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0, visible = true;
  const tick = () => {
    cx += (tx - cx) * .07; cy += (ty - cy) * .07;
    rig.style.setProperty('--nx', cx.toFixed(3)); rig.style.setProperty('--ny', cy.toFixed(3));
    raf = visible && (Math.abs(tx - cx) > .002 || Math.abs(ty - cy) > .002) ? requestAnimationFrame(tick) : 0;
  };
  hero.addEventListener('pointermove', e => {
    const r = hero.getBoundingClientRect();
    tx = ((e.clientX - r.left) / r.width - .62) * 2; ty = ((e.clientY - r.top) / r.height - .4) * 2;
    raf ||= requestAnimationFrame(tick);
  }, { passive: true });
  if ('IntersectionObserver' in window) new IntersectionObserver(([en]) => { visible = en.isIntersecting; }, { threshold: 0 }).observe(hero);
}

/* ── System clock in the top bar (the visitor's own local time) ─────── */
function initSysClock(){
  const el = $('#sysClock'); if (!el) return;
  const fmt = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
  const paint = () => { el.textContent = fmt.format(new Date()); };
  paint(); setInterval(() => { if (!document.hidden) paint(); }, 20000);
}

/* ── 2. Grounded assistant ───────────────────────────────────────────── */
const rx = (...w) => new RegExp('\\b(?:' + w.join('|') + ')', 'i');
const list = a => a.length <= 1 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
const T = s => String(s ?? '').trim();

/* Each intent returns { text, actions? }. `actions` are { label, href } (internal #hash or https). */
function knowledge(q){
  const P = data.profile || {};
  const projects = (data.projects || []).filter(p => T(p.title));
  const email = T(P.email) || 'farisdomain@gmail.com';

  /* a specific project, by name */
  const named = projects.find(p => q.toLowerCase().includes(T(p.title).toLowerCase()));
  if (named){
    const bits = [T(named.details) || T(named.description)];
    if (T(named.status)) bits.push('Status: ' + T(named.status) + '.');
    if ((named.technologies || []).length) bits.push('Built with ' + list(named.technologies) + '.');
    const actions = [];
    if (safeUrl(named.live_url)) actions.push({ label: 'Open live site', href: safeUrl(named.live_url) });
    if (safeUrl(named.github_url)) actions.push({ label: 'View source', href: safeUrl(named.github_url) });
    actions.push({ label: 'See in Projects', href: '#work' });
    return { text: named.title + ' — ' + bits.filter(Boolean).join(' '), actions };
  }

  if (rx('hi\\b', 'hello', 'hey', 'good (?:morning|afternoon|evening)').test(q) && q.length < 30)
    return { text: hello() + '. Ask me about Faris, his projects, the technologies he uses, or how to reach him.' };

  if (rx('who are you', 'what are you', 'are you (?:an? )?(?:ai|real|human|bot)', 'about (?:you|nova)', 'your name').test(q) || /^nova\??$/i.test(q.trim()))
    return { text: 'I’m NOVA, the guide of FARIS OS. I’m a structured assistant: I answer from the content on this site rather than from a language model, so I only say what is actually published here.' };

  if (rx('faris os', 'this (?:site|website|portfolio|system)', 'what is this').test(q))
    return { text: 'FARIS OS is the personal portfolio of Faris, presented as a small operating system: projects, skills, a journal and a contact form, with me as the guide. Its content is managed from a private admin dashboard, so it stays current without code changes.', actions: [{ label: 'See projects', href: '#work' }] };

  if (rx('project', 'built', 'building', 'made', 'portfolio of work', 'what (?:has|does) (?:faris|he) (?:make|do)').test(q) || /\bwork\b/i.test(q)){
    if (!projects.length) return { text: 'The project list hasn’t loaded yet. Try again in a moment, or scroll to the Projects section.', actions: [{ label: 'Go to Projects', href: '#work' }] };
    const lines = projects.map(p => T(p.title) + (T(p.status) ? ' (' + T(p.status) + ')' : '') + (T(p.description) ? ' — ' + T(p.description) : ''));
    return { text: 'Here is what’s in the project archive: ' + lines.join(' · ') + ' Ask me about any of them by name.', actions: [{ label: 'Open Projects', href: '#work' }] };
  }

  if (rx('technolog', 'skill', 'stack', 'tools?', 'languages?', 'framework', 'what does (?:faris|he) use', 'tech\\b').test(q)){
    const rows = data.skills || [];
    if (!rows.length) return { text: 'The skills list hasn’t loaded yet. You can find it in the Skills section.', actions: [{ label: 'Go to Skills', href: '#skills' }] };
    const g = new Map(); rows.forEach(r => { const k = T(r.label) || 'Exploring'; (g.get(k) || g.set(k, []).get(k)).push(T(r.name)); });
    return { text: [...g].map(([k, v]) => k + ': ' + list(v) + '.').join(' '), actions: [{ label: 'Open Skills', href: '#skills' }] };
  }

  if (rx('contact', 'email', 'e-mail', 'reach', 'hire', 'message', 'instagram', 'github', 'linkedin', 'social').test(q)){
    const actions = [{ label: 'Email Faris', href: 'mailto:' + email }];
    if (safeUrl(P.instagram)) actions.push({ label: 'Instagram', href: safeUrl(P.instagram) });
    if (safeUrl(P.github)) actions.push({ label: 'GitHub', href: safeUrl(P.github) });
    if (safeUrl(P.linkedin)) actions.push({ label: 'LinkedIn', href: safeUrl(P.linkedin) });
    actions.push({ label: 'Contact form', href: '#contact' });
    return { text: 'The quickest way is email: ' + email + '. You can also use the contact form on this page or message him on Instagram.', actions };
  }

  if (rx('study', 'studying', 'education', 'university', 'college', 'degree', 'sociology', 'student').test(q))
    return { text: 'Faris is a second-year BA Sociology student at Pondicherry University (distance education).', actions: [{ label: 'Education', href: '#education' }] };

  if (rx('journal', 'notes?', 'blog', 'posts?', 'writ', 'articles?').test(q)){
    const posts = data.posts || [];
    if (!posts.length) return { text: 'There are no published journal entries yet.', actions: [{ label: 'Open Journal', href: '#thoughts' }] };
    return { text: 'Published so far: ' + list(posts.slice(0, 6).map(p => '“' + T(p.title) + '”')) + '.', actions: [{ label: 'Open Journal', href: '#thoughts' }] };
  }

  if (rx('experiment', 'right now', 'currently', 'lately', 'learning', 'exploring').test(q)){
    const ex = data.experiments || [];
    if (!ex.length) return { text: 'Faris is a student exploring AI, technology and whatever interesting thing comes next. The detailed “now” list hasn’t loaded.', actions: [{ label: 'About', href: '#experience' }] };
    return { text: 'Right now: ' + list(ex.slice(0, 6).map(e => T(e.title || e.name))).replace(/^: /, '') + '.', actions: [{ label: 'About', href: '#experience' }] };
  }

  if (rx('who is', 'about faris', 'tell me about', 'introduce', 'faris').test(q) || /\b(?:he|his)\b/i.test(q))
    return { text: (T(P.bio) || 'A student exploring AI, technology, and whatever interesting thing comes next.') + ' He is studying BA Sociology and learns by building projects and experiments.', actions: [{ label: 'Meet Faris', href: '#experience' }, { label: 'See projects', href: '#work' }] };

  return { text: 'I don’t have that on file, and I won’t guess. I can tell you about Faris, his projects, skills, journal, studies, or how to contact him.', actions: [{ label: 'Contact Faris', href: '#contact' }] };
}

const SUGGESTIONS = ['Who is Faris?', 'What projects has Faris built?', 'What is FARIS OS?', 'What technologies does Faris use?', 'How can I contact Faris?'];

function initChat(){
  const panel = $('#novaChat'), launch = $('#askFaris'), log = $('#ncLog'), chips = $('#ncChips'), form = $('#ncForm'), input = $('#ncInput');
  if (!panel || !launch) return;
  let busy = false, opened = false;

  const scroll = () => { log.scrollTop = log.scrollHeight; };
  const action = a => {
    const ext = /^https?:/i.test(a.href);
    return `<a class="nc-act" href="${esc(a.href)}"${ext ? ' target="_blank" rel="noopener noreferrer"' : ''}>${esc(a.label)}</a>`;
  };
  const add = (who, html) => {
    const d = document.createElement('div'); d.className = 'nc-msg ' + who; d.innerHTML = html; log.appendChild(d); scroll(); return d;
  };
  const chipsRender = () => { chips.innerHTML = SUGGESTIONS.map(s => `<button type="button">${esc(s)}</button>`).join(''); };

  const ask = q => {
    q = q.trim(); if (!q || busy) return;
    busy = true;
    add('me', esc(q));
    const typing = add('bot typing', '<span class="dots" aria-label="NOVA is typing"><i></i><i></i><i></i></span>');
    const wait = reduceMotion.matches ? 60 : 420 + Math.min(q.length * 6, 380);
    setTimeout(() => {
      let ans;
      try { ans = knowledge(q); }
      catch (e){ console.error(e); ans = { text: 'Something went wrong on my side. Please try that again, or use the Contact section.', actions: [{ label: 'Contact', href: '#contact' }], err: true }; }
      typing.remove();
      add('bot' + (ans.err ? ' err' : ''), `<p>${esc(ans.text)}</p>` + (ans.actions?.length ? `<div class="nc-acts">${ans.actions.map(action).join('')}</div>` : ''));
      voice.say(ans.text); beep(560); busy = false;
    }, wait);
  };

  const open = () => {
    panel.hidden = false; panel.classList.add('open'); launch.setAttribute('aria-expanded', 'true'); launch.classList.add('is-open');
    if (!opened){
      opened = true; chipsRender();
      add('bot', `<p>${esc(hello())}. I’m NOVA. Ask me about Faris, his projects, skills or how to reach him — I only answer from what’s published on this site.</p>`);
    }
    setTimeout(() => input.focus({ preventScroll: true }), 40);
  };
  const close = (restore = true) => {
    panel.classList.remove('open'); panel.hidden = true; launch.setAttribute('aria-expanded', 'false'); launch.classList.remove('is-open');
    voice.stop(); if (restore) launch.focus({ preventScroll: true });
  };

  launch.addEventListener('click', () => (panel.hidden ? open() : close()));
  $('#novaHeroAsk')?.addEventListener('click', open);
  $('#ncClose').addEventListener('click', () => close());
  $('#ncExpand').addEventListener('click', e => {
    const on = panel.classList.toggle('big'); e.currentTarget.setAttribute('aria-pressed', String(on));
    e.currentTarget.setAttribute('aria-label', on ? 'Shrink chat' : 'Expand chat');
  });
  panel.addEventListener('keydown', e => { if (e.key === 'Escape'){ e.stopPropagation(); close(); } });
  form.addEventListener('submit', e => { e.preventDefault(); const q = input.value; input.value = ''; ask(q); });
  chips.addEventListener('click', e => { const b = e.target.closest('button'); if (b) ask(b.textContent); });
  /* internal links: smooth-scroll and tuck the chat away on small screens so the section is visible */
  log.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]'); if (!a) return;
    e.preventDefault(); const t = document.querySelector(a.getAttribute('href'));
    if (matchMedia('(max-width:720px)').matches) close(false);
    t?.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'start' });
  });
  window.NOVA = Object.freeze({ answer: q => knowledge(String(q || '')), open, close });   // read-only; handy for tests
}

export function initNova(){ initIntro(); initLook(); initSysClock(); initChat(); }
