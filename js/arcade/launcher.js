/* ==========================================================================
   Arcade launcher — one component used by BOTH the portfolio modal and the XIRAF
   Arcade window. It owns the currently running game and guarantees that game is
   destroyed (no leaked frames / listeners) when switching, closing or exiting.
   ========================================================================== */
import { esc } from '../util.js';
import { GAMES, findGame } from './registry.js';
import { best } from './common.js';

const BEST_KEY = { flappy: 'flappy', snake: 'snake', memory: 'memory', pong: 'pong', '2048': '2048' };
const bestLabel = id => {
  const v = best.get(BEST_KEY[id]);
  if (!v) return 'No score yet';
  return id === 'memory' ? `Best: ${v} moves` : id === 'pong' ? `Wins: ${v}` : `Best: ${v}`;
};

export function mountArcade(host, { game = null, onTitle = () => {}, onClose = null } = {}){
  host.classList.add('arcade');
  host.innerHTML = '<div class="arcade-view"></div>';
  const view = host.firstElementChild;
  let current = null, currentId = null, token = 0, destroyed = false, autoPaused = false;

  const stopGame = () => { try { current?.destroy(); } catch (e) { console.error(e); } current = null; currentId = null; };

  function showMenu(focus = true){
    token++; stopGame(); onTitle('Arcade');
    view.innerHTML = `
      <div class="arcade-head"><h2>Arcade</h2><p>Five small games, built into the portfolio. No ads, no accounts — scores stay on this device.</p></div>
      <ul class="arcade-grid">${GAMES.map(g => `
        <li><button type="button" class="arcade-card" data-game="${esc(g.id)}">
          <span class="arcade-glyph" aria-hidden="true">${g.glyph}</span>
          <span class="arcade-name">${esc(g.title)}</span>
          <span class="arcade-blurb">${esc(g.blurb)}</span>
          <span class="arcade-best">${esc(bestLabel(g.id))}</span>
          <code class="arcade-cmd">${esc(g.cmd)}</code>
        </button></li>`).join('')}</ul>`;
    if (focus) view.querySelector('.arcade-card')?.focus({ preventScroll: true });
  }

  async function open(name){
    const g = findGame(name);
    if (!g){ showMenu(); return false; }
    const mine = ++token;
    stopGame();
    onTitle(g.title);
    view.innerHTML = `
      <div class="arcade-bar">
        <button type="button" class="arcade-back" data-act="back" aria-label="Back to all games">← All games</button>
        <strong>${esc(g.title)}</strong>
        <button type="button" class="arcade-restart" data-act="restart" aria-label="Restart ${esc(g.title)}">Restart</button>
      </div>
      <div class="arcade-stage" id="stage-${esc(g.id)}"><p class="arcade-loading">Loading ${esc(g.title)}…</p></div>
      <p class="arcade-how">${esc(g.how)}</p>`;
    const stage = view.querySelector('.arcade-stage');
    try {
      const mod = await g.load();
      if (mine !== token || destroyed) return false;          // user moved on while the module loaded
      stage.innerHTML = '';
      const root = document.createElement('div'); root.className = 'game-host'; stage.appendChild(root);
      current = mod.default(root, {}); currentId = g.id;
      root.focus({ preventScroll: true });
      return true;
    } catch (e) {
      console.error(e);
      if (mine === token) stage.innerHTML = '<p class="arcade-loading">This game couldn’t be loaded. Check your connection and try again.</p>';
      return false;
    }
  }

  const onClick = e => {
    const card = e.target.closest('[data-game]'); if (card){ open(card.dataset.game); return; }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'back') showMenu();
    else if (act === 'restart') current?.restart?.();
  };
  host.addEventListener('click', onClick);

  /* Pause when the tab is hidden or the arcade scrolls out of view — never burn CPU unseen. */
  const onVis = () => { if (document.hidden){ current?.pause?.(); autoPaused = true; } else if (autoPaused){ autoPaused = false; current?.resume?.(); } };
  document.addEventListener('visibilitychange', onVis);
  let io = null;
  if ('IntersectionObserver' in window){
    io = new IntersectionObserver(([en]) => { if (!en.isIntersecting) current?.pause?.(); }, { threshold: 0 });
    io.observe(host);
  }

  if (game && findGame(game)) open(game); else showMenu(false);

  return {
    open, menu: showMenu,
    get running(){ return currentId; },
    pause(){ current?.pause?.(); },
    resume(){ current?.resume?.(); },
    destroy(){
      destroyed = true; token++; stopGame();
      host.removeEventListener('click', onClick); document.removeEventListener('visibilitychange', onVis); io?.disconnect();
      host.innerHTML = ''; host.classList.remove('arcade');
      onClose?.();
    }
  };
}
