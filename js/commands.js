/* ==========================================================================
   Command registry. Every command is an explicit, supported action — visitors never
   get eval, a shell, env vars or anything server-side. Input is lower-cased, trimmed,
   length-capped, split on whitespace and looked up in a Map; unknown input just gets
   a friendly message.

   A handler receives (args, ctx) and returns { html?, text?, close?, error? } or nothing.
   `ctx` is supplied by whoever hosts the console (portfolio modal or XIRAF terminal)
   so the same commands behave correctly in both places.
   ========================================================================== */
import { esc, getTheme, setTheme, reduceMotion } from './util.js';
import { data } from './data.js';
import { GAMES, findGame } from './arcade/registry.js';

const SECTIONS = {
  about:      { sel: '#about',      blurb: 'who is Faris?',      detail: () => 'Faris is a student exploring ideas, AI and the process of turning concepts into real projects.' },
  experience: { sel: '#experience', blurb: 'how I work',         detail: () => 'The way Faris works: EXPLORE → BUILD → SHIP.' },
  skills:     { sel: '#skills',     blurb: 'current toolbox',    detail: () => 'The current toolbox and what is being learned — live from the dashboard.' },
  projects:   { sel: '#work',       blurb: "things I'm building", detail: () => 'ECHO, EVENTRA, PROOFCHECK and anything added from the dashboard.' },
  now:        { sel: '#now',        blurb: "what I'm up to",     detail: () => 'What Faris is experimenting with right now.' },
  blog:       { sel: '#thoughts',   blurb: 'notes & ideas',      detail: () => 'Notes, ideas and lessons from the process.' },
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
    const core = [
      ['help games', 'game commands & controls'],
      ['games', 'list the arcade'], ['game', 'open the arcade launcher'],
      ['theme', 'show or change the theme'],
      [ctx.inOS ? 'exit xiraf' : 'boot xiraf', ctx.inOS ? 'return to the portfolio' : 'start XIRAF OS'],
      ['clear', 'clear terminal']
    ].map(([c, n]) => cmdBtn(c, n)).join('');
    return { html: muted('Available commands:') + sections + muted('— system —') + core };
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
