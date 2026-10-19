/* ==========================================================================
   Command registry. Every command is an explicit, supported action — visitors never
   get eval, a shell, env vars or anything server-side. Input is lower-cased, trimmed,
   length-capped, split on whitespace and looked up in a Map; unknown input just gets
   a friendly message.

   A handler receives (args, ctx) and returns { html?, text?, close?, error? } or nothing.
   `ctx` is supplied by whoever hosts the console (portfolio modal or XIRAF terminal)
   so the same commands behave correctly in both places.
   ========================================================================== */
import { esc, safeUrl, store, getTheme, setTheme, reduceMotion } from './util.js';
import { ACCENTS, setAccent, getAccent, matrix, confetti } from './fx.js';
import { data } from './data.js';
import { GAMES, findGame } from './arcade/registry.js';

const SECTIONS = {
  about:      { sel: '#about',      blurb: 'who is Faris?',      detail: () => 'Faris is a student exploring ideas, AI and the process of turning concepts into real projects.' },
  experience: { sel: '#experience', blurb: 'how I work',         detail: () => 'The way Faris works: EXPLORE → BUILD → SHIP.' },
  skills:     { sel: '#skills',     blurb: 'current toolbox',    detail: () => 'The current toolbox and what is being learned — live from the dashboard.' },
  projects:   { sel: '#work',       blurb: "things I'm building", detail: () => 'ECHO, EVENTRA, PROOFCHECK and anything added from the dashboard.' },
  now:        { sel: '#now',        blurb: "what I'm up to",     detail: () => 'What Faris is experimenting with right now.' },
  blog:       { sel: '#thoughts',   blurb: 'notes & ideas',      detail: () => 'Notes, ideas and lessons from the process.' },
  faq:        { sel: '#faq',        blurb: 'quick answers',      detail: () => 'A few things people ask — answered like a conversation.' },
  education:  { sel: '#education',  blurb: 'where I study',      detail: () => 'Second-year BA Sociology at Pondicherry University.' },
  contact:    { sel: '#contact',    blurb: "let's talk",         detail: () => 'Email ' + (data.profile.email || 'farisdomain@gmail.com') + ' or use the contact form.' }
};
export const SECTION_NAMES = Object.keys(SECTIONS);

const cmdBtn = (cmd, note) => `<button type="button" data-command="${esc(cmd)}">${esc(cmd)}${note ? ` <small>— ${esc(note)}</small>` : ''}</button>`;
const muted = t => `<div class="term-muted">${esc(t)}</div>`;

const registry = new Map();
function define(name, spec){ registry.set(name, { name, ...spec }); (spec.aliases || []).forEach(a => registry.set(a, registry.get(name))); }

/* ── core ─────────────────────────────────────────────────────────────── */
define('help', {
  summary: 'show available commands', group: 'core',
  run(args, ctx){
    if (args[0] === 'games') return helpGames();
    const sections = SECTION_NAMES.map(k => cmdBtn(k, SECTIONS[k].blurb)).join('');
    const about = [['whoami', 'a quick intro'], ['neofetch', 'system card for Faris'], ['ls', 'list the sections'], ['open <section>', 'jump to a section'], ['cat <project>', 'read a project'], ['stack', 'the current toolbox'], ['socials', 'where to find Faris'], ['contact', 'how to reach Faris']]
      .map(([c, n]) => /</.test(c) ? `<div class="term-game"><span><b>${esc(c)}</b> — ${esc(n)}</span></div>` : cmdBtn(c, n)).join('');
    const fun = [['accent', 'recolour the glass (violet · cyan · rose · amber · mint)'], ['matrix', 'digital rain'], ['confetti', 'celebrate something'], ['coin', 'flip a coin'], ['roll', 'roll a die'], ['fortune', 'a small thought'], ['shatter', 'break the glass panels on the page'], ['rebuild', 'put them all back'], ['date', 'time check'], ['uptime', 'how long you have been here']]
      .map(([c, n]) => cmdBtn(c, n)).join('');
    const core = [
      ['help games', 'game commands & controls'],
      ['games', 'list the arcade'], ['game', 'open the arcade launcher'],
      ['theme', 'show or change the theme'], ['sound', 'sound on / off'],
      [ctx.inOS ? 'exit xiraf' : 'boot xiraf', ctx.inOS ? 'return to the portfolio' : 'start XIRAF OS'],
      ['clear', 'clear terminal']
    ].map(([c, n]) => cmdBtn(c, n)).join('');
    return { html: muted('Sections:') + sections + muted('— about —') + about + muted('— play —') + fun + muted('— system —') + core };
  }
});

define('clear', { summary: 'clear terminal', group: 'core', run(){ return { clear: true }; } });

define('about', {
  summary: 'who is Faris? (or: about xiraf)', group: 'core',
  run(args, ctx){
    if (args[0] === 'xiraf'){
      return { html: '<div class="term-detail"><b>XIRAF OS</b> — a new digital environment, built into FARIS. It’s the same portfolio, rendered as a desktop: windows, a dock, a launcher, a terminal and an arcade. Type <b>boot xiraf</b> to enter, <b>exit xiraf</b> to leave.</div>' };
    }
    return section('about', ctx);
  }
});
for (const k of SECTION_NAMES) if (k !== 'about') define(k, { summary: SECTIONS[k].blurb, group: 'sections', run: (args, ctx) => section(k, ctx) });

function section(k, ctx){
  const s = SECTIONS[k];
  ctx.goto?.(k, s.sel);
  return { html: `<div class="term-detail">${esc(s.detail())}</div>`, close: !ctx.inOS && 750, beep: 640 };
}

define('theme', {
  summary: 'show or change the theme', group: 'core',
  run(args){
    const a = args[0];
    if (!a) return { html: muted(`Current theme: ${getTheme()}. Use "theme light", "theme dark" or "theme toggle".`) };
    const next = a === 'toggle' ? (getTheme() === 'dark' ? 'light' : 'dark') : a;
    if (next !== 'light' && next !== 'dark') return { error: `Unknown theme "${a}". Try: light, dark or toggle.` };
    setTheme(next);
    return { html: muted(`Theme set to ${next}.`), beep: 660 };
  }
});

/* ── XIRAF OS ─────────────────────────────────────────────────────────── */
define('boot', {
  summary: 'boot xiraf — start XIRAF OS', group: 'xiraf',
  run(args, ctx){
    if (args[0] !== 'xiraf') return { error: args[0] ? `Can't boot "${args[0]}". Did you mean: boot xiraf` : 'Boot what? Try: boot xiraf' };
    if (ctx.inOS) return { html: muted('XIRAF OS is already running. Type "exit xiraf" to return to the portfolio.') };
    if (!ctx.xiraf) return { error: 'XIRAF OS is unavailable right now.' };
    return { html: muted('Starting XIRAF OS…'), then: () => ctx.xiraf.boot(), close: 1 };
  }
});
define('exit', {
  summary: 'exit xiraf — return to the portfolio', group: 'xiraf',
  run(args, ctx){
    if (args[0] !== 'xiraf') return { error: args[0] ? `Can't exit "${args[0]}". Did you mean: exit xiraf` : 'Exit what? Try: exit xiraf' };
    if (!ctx.inOS) return { html: muted('XIRAF OS isn’t running. Type "boot xiraf" to start it.') };
    return { html: muted('Leaving XIRAF OS…'), then: () => ctx.xiraf.exit() };
  }
});

/* ── arcade ───────────────────────────────────────────────────────────── */
function gamesList(){
  return muted('Arcade:') + GAMES.map(g => cmdBtn(g.cmd, g.blurb)).join('');
}
function helpGames(){
  return { html: muted('Game commands:') + cmdBtn('games', 'list all games') + cmdBtn('game', 'open the launcher') +
    GAMES.map(g => `<div class="term-game"><button type="button" data-command="${esc(g.cmd)}">${esc(g.cmd)}</button><span>${esc(g.how)}</span></div>`).join('') +
    muted('Scores are saved on this device only. Esc closes the arcade.') };
}
define('games', { summary: 'list available games', group: 'arcade', run(){ return { html: gamesList() }; } });
define('game', {
  summary: 'open the game launcher (or: game <name>)', group: 'arcade',
  run(args, ctx){
    if (!args.length){
      if (!ctx.arcade) return { error: 'The arcade is unavailable right now.' };
      return { html: muted('Opening the arcade…'), then: () => ctx.arcade.open(null), close: 1 };
    }
    const g = findGame(args[0]);
    if (!g) return { error: `No game called "${args[0]}".`, html: gamesList() };
    if (!ctx.arcade) return { error: 'The arcade is unavailable right now.' };
    return { html: muted(`Launching ${g.title}…`), then: () => ctx.arcade.open(g.id), close: 1, beep: 600 };
  }
});

/* ── about / navigation ───────────────────────────────────────────────── */
const projectByName = n => data.projects.find(p => String(p.title || '').toLowerCase() === n || String(p.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '') === n.replace(/[^a-z0-9]+/g, ''));
const link = (href, label) => { const u = safeUrl(href); return u ? `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>` : ''; };

define('whoami', { summary: 'a quick intro', group: 'about', run(){ return { html: `<div class="term-detail"><b>${esc(data.profile.name || 'Faris')}</b> — student, second-year BA Sociology. Curious by nature, building by experimenting.</div>` }; } });
define('neofetch', {
  summary: 'system card for Faris', group: 'about', aliases: ['faris', 'fetch'],
  run(){
    const rows = [['name', data.profile.name || 'Faris'], ['role', 'student'], ['studying', 'BA Sociology · Pondicherry University'], ['location', 'India'],
      ['into', 'AI · web · learning by building'], ['projects', String(data.projects.length || '—')], ['skills', String(data.skills.length || '—')],
      ['theme', getTheme() + ' / ' + getAccent()], ['shell', 'faris.terminal v3']];
    return { html: `<pre class="term-pre"><b>  ◢◤◢◤◢◤◢◤◢◤   </b>
<b>  F A R I S .   </b>
<b>  ◥◣◥◣◥◣◥◣◥◣   </b>
${rows.map(([k, v]) => `<span class="k">${esc(k.padEnd(9))}</span> ${esc(v)}`).join('\n')}</pre>` };
  }
});
define('banner', { summary: 'big FARIS banner', group: 'about', run(){ return { html: '<pre class="term-pre"><b>███████╗ █████╗ ██████╗ ██╗███████╗\n██╔════╝██╔══██╗██╔══██╗██║██╔════╝\n█████╗  ███████║██████╔╝██║███████╗\n██╔══╝  ██╔══██║██╔══██╗██║╚════██║\n██║     ██║  ██║██║  ██║██║███████║\n╚═╝     ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝╚══════╝</b></pre>' }; } });
define('ls', {
  summary: 'list the sections', group: 'about',
  run(){ return { html: muted('sections/') + SECTION_NAMES.map(k => cmdBtn('open ' + k, SECTIONS[k].blurb)).join('') }; }
});
define('open', {
  summary: 'open <section> — jump to a section', group: 'about', aliases: ['cd', 'goto'],
  run(args, ctx){
    const k = (args[0] || '').replace(/\/$/, '');
    if (!k) return { error: 'Open what? Try: open projects', html: muted('Sections: ' + SECTION_NAMES.join(', ')) };
    if (!SECTIONS[k]) return { error: `No section called "${k}".`, html: muted('Sections: ' + SECTION_NAMES.join(', ')) };
    return section(k, ctx);
  }
});
define('cat', {
  summary: 'cat <project> — read a project', group: 'about', aliases: ['project'],
  run(args){
    const n = args.join(' ');
    if (!n) return { html: muted('Projects:') + data.projects.map(p => cmdBtn('cat ' + String(p.title).toLowerCase())).join(''), error: 'Cat which project?' };
    const p = projectByName(n);
    if (!p) return { error: `No project called "${n}".`, html: data.projects.map(x => cmdBtn('cat ' + String(x.title).toLowerCase())).join('') };
    const tech = (p.technologies || []).join(' · ');
    const links = [link(p.live_url, 'live'), link(p.github_url, 'source')].filter(Boolean).join('  ');
    return { html: `<div class="term-detail"><b>${esc(p.title)}</b>${p.category ? ` · ${esc(p.category)}` : ''}${p.status ? ` · ${esc(p.status)}` : ''}<br>${esc(p.details || p.description || '')}${tech ? `<br><span class="term-muted">${esc(tech)}</span>` : ''}${links ? `<br>${links}` : ''}</div>` };
  }
});
define('stack', {
  summary: 'the current toolbox', group: 'about', aliases: ['toolbox'],
  run(){
    if (!data.skills.length) return { html: muted('The toolbox is still being filled.') };
    const g = new Map(); data.skills.forEach(s => { const k = (s.label || 'Exploring').trim(); (g.get(k) || g.set(k, []).get(k)).push(s.name); });
    return { html: [...g].map(([k, v]) => `<div class="term-detail"><b>${esc(k)}</b><br>${esc(v.join(' · '))}</div>`).join('') };
  }
});
define('socials', {
  summary: 'where to find Faris', group: 'about', aliases: ['links'],
  run(){
    const p = data.profile, items = [link(p.instagram, 'Instagram'), link(p.github, 'GitHub'), link(p.linkedin, 'LinkedIn'), p.email ? `<a href="mailto:${esc(p.email)}">Email ↗</a>` : ''].filter(Boolean);
    return { html: `<div class="term-links">${items.join('')}</div>` };
  }
});
define('contact', {
  summary: 'how to reach Faris', group: 'about', aliases: ['email'],
  run(args, ctx){
    const mail = data.profile.email || 'farisdomain@gmail.com';
    return { html: `<div class="term-detail">Email <a href="mailto:${esc(mail)}">${esc(mail)}</a> or use the contact form. ${cmdBtn('open contact')}</div>` };
  }
});

/* ── play ─────────────────────────────────────────────────────────────── */
define('accent', {
  summary: 'accent <name> — recolour the glass', group: 'play', aliases: ['color', 'colour'],
  run(args){
    const a = args[0];
    if (!a) return { html: muted(`Accent: ${getAccent()}. Try one of: ${ACCENTS.join(', ')} — or "accent reset".`) + ACCENTS.map(n => cmdBtn('accent ' + n)).join('') };
    const r = setAccent(a);
    if (!r) return { error: `Unknown accent "${a}".`, hint: 'Try: ' + ACCENTS.join(', ') + ', reset' };
    return { html: muted(`Accent set to ${r}.`), beep: 640 };
  }
});
define('matrix', { summary: 'digital rain', group: 'play', run(){ return matrix() ? { html: muted('Wake up, Faris… (it stops by itself)'), beep: 220 } : { html: muted('Digital rain is skipped because reduced motion is on.') }; } });
define('confetti', { summary: 'celebrate', group: 'play', aliases: ['party'], run(){ return confetti() ? { html: muted('Congratulations on something.'), beep: 700 } : { html: muted('Confetti is skipped because reduced motion is on.') }; } });
define('coin', { summary: 'flip a coin', group: 'play', aliases: ['flip'], run(){ return { html: muted(Math.random() < .5 ? 'Heads.' : 'Tails.'), beep: 500 }; } });
define('roll', {
  summary: 'roll [sides] — roll a die', group: 'play', aliases: ['dice'],
  run(args){ const n = Math.min(1000, Math.max(2, parseInt(args[0], 10) || 6)); return { html: muted(`d${n} → ${1 + Math.floor(Math.random() * n)}`), beep: 480 }; }
});
const FORTUNES = ['Ship the small version first.', 'Curiosity compounds.', 'Break it, learn why, fix it, repeat.', 'The first draft is allowed to be bad.', 'Ask the slightly scary question.', 'Make something today, even if it’s tiny.', 'Understanding people is a superpower.'];
define('fortune', { summary: 'a small thought', group: 'play', aliases: ['quote'], run(){ return { html: `<div class="term-detail">${esc(FORTUNES[Math.floor(Math.random() * FORTUNES.length)])}</div>` }; } });
define('shatter', {
  summary: 'break the glass panels on the page', group: 'play',
  run(args, ctx){ const n = ctx.glass?.shatterAll?.() ?? 0; return n ? { html: muted(`Shattered ${n} panel${n === 1 ? '' : 's'}. Type "rebuild" to restore them.`), beep: 260 } : { html: muted('No intact glass panels nearby. (On the page itself, tap a panel three times.)') }; }
});
define('rebuild', {
  summary: 'rebuild every broken panel', group: 'play',
  run(args, ctx){ const n = ctx.glass?.rebuildAll?.() ?? 0; return { html: muted(n ? `Rebuilding ${n} panel${n === 1 ? '' : 's'}…` : 'Nothing is broken.'), beep: 600 }; }
});
define('sound', {
  summary: 'sound on|off', group: 'system',
  run(args, ctx){
    const a = args[0];
    if (a !== 'on' && a !== 'off') return { html: muted(`Sound is ${store.get('faris-sound') === 'on' ? 'on' : 'off'}. Use "sound on" or "sound off".`) };
    ctx.setSound?.(a === 'on') ?? store.set('faris-sound', a);
    return { html: muted(`Sound ${a}.`), beep: a === 'on' ? 700 : 0 };
  }
});
define('date', { summary: 'time check', group: 'system', aliases: ['time'], run(){
  const now = new Date(), f = (tz) => now.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short', ...(tz ? { timeZone: tz } : {}) });
  return { html: muted('You: ' + f()) + muted('Faris (India): ' + f('Asia/Kolkata')) };
} });
const T0 = performance.now();
define('uptime', { summary: 'how long you have been here', group: 'system', run(){ const s = Math.round((performance.now() - T0) / 1000); return { html: muted(`You've been here ${s >= 60 ? Math.floor(s / 60) + 'm ' : ''}${s % 60}s. Welcome.`) }; } });
define('echo', { summary: 'echo <text>', group: 'system', run(args){ return { html: muted(args.join(' ').slice(0, 80) || ' ') }; } });
define('hello', { summary: 'say hi', group: 'system', aliases: ['hi', 'hey'], run(){ return { html: muted('Hey! Type "help" to see what I can do.'), beep: 560 }; } });
define('sudo', { summary: 'nice try', group: 'system', aliases: ['rm', 'su'], run(){ return { error: 'Permission denied: you are a guest, and this is glass.', beep: 200 }; } });

/* ── dispatch ─────────────────────────────────────────────────────────── */
export const MAX_INPUT = 80;
export function parse(raw){
  const clean = String(raw ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, MAX_INPUT).trim().toLowerCase();
  const parts = clean.split(/\s+/).filter(Boolean);
  return { clean, name: parts[0] || '', args: parts.slice(1) };
}
export function execute(raw, ctx){
  const { clean, name, args } = parse(raw);
  if (!name) return null;
  const cmd = registry.get(name);
  if (!cmd) return { clean, error: `Command not found: ${clean}`, hint: 'Type "help" to see available commands.', beep: 300 };
  try { return { clean, ...(cmd.run(args, ctx) || {}) }; }
  catch (e){ console.error(e); return { clean, error: 'That command failed. Try again, or type "help".' }; }
}
export const commandNames = () => [...new Set([...registry.values()].map(c => c.name))];
export const completions = prefix => [...registry.keys()].filter(k => k.startsWith(prefix)).sort();
export const reduce = reduceMotion;
