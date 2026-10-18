/* ==========================================================================
   Terminal component — one implementation, mounted in the portfolio modal and in the
   XIRAF Terminal window. Keeps its own history (↑ / ↓), supports Tab completion and
   a clickable command list, and never lets a command touch anything but ctx.
   ========================================================================== */
import { $$, esc, beep } from './util.js';
import { execute, completions } from './commands.js';

export function mountConsole(host, ctx, { prompt = 'guest@faris:~$', greeting = true } = {}){
  host.classList.add('term-console');
  host.setAttribute('aria-live', 'polite');
  host.innerHTML = `
    ${greeting ? '<div class="term-line term-info">Welcome to faris.terminal v2.0.0</div><div class="term-line term-info">Type <b>"help"</b> for commands · <b>"boot xiraf"</b> to enter XIRAF OS.</div><div class="term-gap"></div>' : ''}
    <div class="terminal-input-row"><label>${esc(prompt)}</label><input autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="send" maxlength="80" aria-label="Terminal command" placeholder="type a command…"></div>`;
  const row = host.querySelector('.terminal-input-row'), input = row.querySelector('input'), label = row.querySelector('label');
  input.id = 'tin-' + Math.random().toString(36).slice(2, 8); label.htmlFor = input.id;

  const history = []; let hi = 0, draft = '', closeTimer = 0, destroyed = false;

  const bind = r => $$('[data-command]', r).forEach(b => b.addEventListener('click', () => run(b.dataset.command)));
  const out = html => { const d = document.createElement('div'); d.className = 'term-output'; d.innerHTML = html; host.insertBefore(d, row); bind(d); };
  const scroll = () => { host.scrollTop = host.scrollHeight; };

  function run(raw){
    if (destroyed) return;
    const value = String(raw ?? '').trim(); if (!value) return;
    clearTimeout(closeTimer);
    history.push(value); hi = history.length; draft = '';
    const line = document.createElement('div'); line.className = 'term-line term-prompt';
    line.innerHTML = `<span>${esc(prompt)}</span> ${esc(value.slice(0, 80))}`;
    host.insertBefore(line, row);

    const res = execute(value, ctx);
    input.value = '';
    if (!res){ scroll(); return; }
    if (res.clear){ [...host.children].forEach(c => { if (c !== row) c.remove(); }); input.focus({ preventScroll: true }); return; }
    if (res.error) out(`<div class="term-muted term-err">${esc(res.error)}</div>${res.hint ? `<div class="term-muted">${esc(res.hint)}</div>` : ''}`);
    if (res.html) out(res.html);
    if (res.beep) beep(res.beep);
    scroll();
    if (res.then){
      const go = res.then;
      closeTimer = setTimeout(() => { if (destroyed) return; if (res.close) ctx.close?.(); go(); }, res.close ? 260 : 0);
    }
    else if (res.close) closeTimer = setTimeout(() => { if (!destroyed) ctx.close?.(); }, +res.close);
    /* keep the keyboard up on phones after a command */
    if (!res.close && !res.then) input.focus({ preventScroll: true });
  }

  const onKey = e => {
    if (e.key === 'Enter'){ e.preventDefault(); run(input.value); }
    else if (e.key === 'ArrowUp'){ e.preventDefault(); if (hi === history.length) draft = input.value; if (hi > 0){ hi--; input.value = history[hi]; } }
    else if (e.key === 'ArrowDown'){ e.preventDefault(); if (hi < history.length - 1){ hi++; input.value = history[hi]; } else { hi = history.length; input.value = draft; } }
    else if (e.key === 'Tab' && input.value && !input.value.includes(' ')){
      const m = completions(input.value.toLowerCase());
      if (m.length){ e.preventDefault(); input.value = m.length === 1 ? m[0] + (['boot', 'exit', 'game'].includes(m[0]) ? ' ' : '') : m[0]; if (m.length > 1) out(`<div class="term-muted">${esc(m.join('   '))}</div>`); }
    }
  };
  const onHostClick = e => { if (!e.target.closest('button,a') && !getSelection()?.toString()) input.focus({ preventScroll: true }); };
  input.addEventListener('keydown', onKey);
  host.addEventListener('click', onHostClick);
  bind(host);

  return {
    run, focus: () => input.focus({ preventScroll: true }), input,
    print: out,
    destroy(){ destroyed = true; clearTimeout(closeTimer); input.removeEventListener('keydown', onKey); host.removeEventListener('click', onHostClick); host.innerHTML = ''; host.classList.remove('term-console'); }
  };
}
