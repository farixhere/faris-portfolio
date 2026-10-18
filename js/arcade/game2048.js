/* 2048 — sliding tiles with real merge animation. Keyboard, swipe, or on-screen pad. */
import { best, createOverlay, chrome, onSwipe, dpad, KEY_DIR } from './common.js';

const N = 4;
const VEC = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] };

export default function create(container){
  const { play, set } = chrome(container, { title: '2048', stats: [{ id: 'score', label: 'Score', value: 0 }, { id: 'best', label: 'Best', value: best.get('2048') }] });
  const board = document.createElement('div');
  board.className = 't48-board'; board.setAttribute('role', 'group'); board.setAttribute('aria-label', '2048 board. Use arrow keys, WASD or swipes.');
  board.innerHTML = '<div class="t48-grid" aria-hidden="true">' + '<i class="t48-cell"></i>'.repeat(N * N) + '</div><div class="t48-tiles"></div>';
  play.appendChild(board);
  const layer = board.querySelector('.t48-tiles');
  const live = document.createElement('p'); live.className = 'sr-only'; live.setAttribute('role', 'status'); live.setAttribute('aria-live', 'polite'); container.appendChild(live);
  const overlay = createOverlay(play);
  const pad = dpad(container, d => move(d));
  const unswipe = onSwipe(board, d => move(d), 24);
  const timers = new Set();
  const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); };

  let grid, score, won, over, id = 0, destroyed = false;

  const put = t => { t.el.style.setProperty('--r', t.r); t.el.style.setProperty('--c', t.c); };
  const label = t => { t.el.textContent = t.v; t.el.dataset.v = t.v > 2048 ? 'big' : t.v; t.el.setAttribute('aria-label', `${t.v}`); };
  function spawn(){
    const free = [];
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (!grid[r][c]) free.push([r, c]);
    if (!free.length) return;
    const [r, c] = free[Math.floor(Math.random() * free.length)];
    const t = { id: ++id, v: Math.random() < 0.9 ? 2 : 4, r, c, el: document.createElement('div') };
    t.el.className = 't48-tile t48-new'; label(t); put(t); layer.appendChild(t.el); grid[r][c] = t;
    later(() => t.el.classList.remove('t48-new'), 200);
  }

  function newGame(){
    timers.forEach(clearTimeout); timers.clear();
    layer.innerHTML = ''; grid = Array.from({ length: N }, () => Array(N).fill(null));
    score = 0; won = false; over = false; set('score', 0); overlay.hide(); live.textContent = 'New game.';
    spawn(); spawn();
  }

  function canMove(){
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++){
      const t = grid[r][c]; if (!t) return true;
      if (c + 1 < N && grid[r][c + 1]?.v === t.v) return true;
      if (r + 1 < N && grid[r + 1][c]?.v === t.v) return true;
    }
    return false;
  }

  function move(dir){
    if (destroyed || over || overlay.visible) return;
    const [dr, dc] = VEC[dir];
    const rows = [...Array(N).keys()], cols = [...Array(N).keys()];
    if (dr === 1) rows.reverse(); if (dc === 1) cols.reverse();
    let moved = false, gained = 0;
    for (const r of rows) for (const c of cols){
      const t = grid[r][c]; if (!t) continue;
      let nr = r, nc = c;
      while (true){
        const tr = nr + dr, tc = nc + dc;
        if (tr < 0 || tc < 0 || tr >= N || tc >= N || grid[tr][tc]) break;
        nr = tr; nc = tc;
      }
      const tr = nr + dr, tc = nc + dc, target = (tr >= 0 && tc >= 0 && tr < N && tc < N) ? grid[tr][tc] : null;
      if (target && target.v === t.v && !target.fresh){
        grid[r][c] = null; t.r = tr; t.c = tc; put(t);
        target.v *= 2; target.fresh = true; gained += target.v; moved = true;
        t.el.style.zIndex = 1;
        later(() => { t.el.remove(); label(target); target.el.classList.add('t48-bump'); later(() => target.el.classList.remove('t48-bump'), 180); }, 110);
      } else if (nr !== r || nc !== c){
        grid[r][c] = null; grid[nr][nc] = t; t.r = nr; t.c = nc; put(t); moved = true;
      }
    }
    if (!moved) return;
    for (const row of grid) for (const t of row) if (t) t.fresh = false;
    score += gained; set('score', score);
    if (gained) live.textContent = `Score ${score}.`;
    later(() => {
      spawn();
      if (!won && grid.flat().some(t => t && t.v >= 2048)){
        won = true; best.submit('2048', score); set('best', best.get('2048'));
        overlay.show('You made 2048!', `Score ${score}`, 'Keep going', () => overlay.hide());
      } else if (!canMove()){
        over = true; const rec = best.submit('2048', score); set('best', best.get('2048'));
        overlay.show('No moves left', `Score ${score}${rec ? ' — new record!' : ''}`, 'New game', newGame);
      }
    }, 120);
  }

  const onKey = e => {
    const d = KEY_DIR[e.key];
    if (d && !overlay.visible){ e.preventDefault(); move(d); }
  };
  container.addEventListener('keydown', onKey);
  board.addEventListener('pointerdown', () => container.focus({ preventScroll: true }));
  newGame();

  return {
    pause(){}, resume(){},
    restart: newGame,
    destroy(){
      destroyed = true; timers.forEach(clearTimeout); timers.clear(); unswipe();
      container.removeEventListener('keydown', onKey); pad.remove(); container.innerHTML = '';
    }
  };
}
