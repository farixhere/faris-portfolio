/* Memory Match — 4×4 glass cards, move counter, completion state. */
import { best, createOverlay, chrome } from './common.js';

const FACES = [
  { g: '◆', n: 'diamond', c: '#7da2ff' }, { g: '●', n: 'circle', c: '#ffb27a' }, { g: '▲', n: 'triangle', c: '#8be0c3' }, { g: '■', n: 'square', c: '#f08fb0' },
  { g: '★', n: 'star', c: '#ffd86b' }, { g: '✦', n: 'spark', c: '#b9a6ff' }, { g: '☾', n: 'moon', c: '#9fd3ff' }, { g: '❖', n: 'gem', c: '#ff9f8a' }
];

export default function create(container){
  const { play, set } = chrome(container, { title: 'Memory Match', stats: [{ id: 'moves', label: 'Moves', value: 0 }, { id: 'pairs', label: 'Pairs', value: '0/8' }, { id: 'best', label: 'Best', value: best.get('memory') || '—' }] });
  const board = document.createElement('div');
  board.className = 'mem-board'; board.setAttribute('role', 'group'); board.setAttribute('aria-label', 'Memory cards, four by four');
  play.appendChild(board);
  const overlay = createOverlay(play);
  const timers = new Set();
  const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); };

  let deck, open, matched, moves, lock, destroyed = false;

  function shuffle(a){ for (let i = a.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  function paint(i){
    const b = board.children[i], c = deck[i], shown = open.includes(i) || matched.has(i);
    b.classList.toggle('flipped', shown); b.classList.toggle('matched', matched.has(i));
    b.disabled = matched.has(i);
    b.setAttribute('aria-label', `Card ${i + 1} of 16, ${shown ? FACES[c].n + (matched.has(i) ? ', matched' : '') : 'face down'}`);
    b.querySelector('.mem-front').textContent = shown ? FACES[c].g : '';
    b.querySelector('.mem-front').style.color = FACES[c].c;
  }

  function deal(){
    timers.forEach(clearTimeout); timers.clear();
    deck = shuffle([...FACES.keys(), ...FACES.keys()]); open = []; matched = new Set(); moves = 0; lock = false;
    set('moves', 0); set('pairs', '0/8');
    board.innerHTML = deck.map((_, i) => `<button type="button" class="mem-card" data-i="${i}"><span class="mem-inner"><span class="mem-back" aria-hidden="true"></span><span class="mem-front" aria-hidden="true"></span></span></button>`).join('');
    deck.forEach((_, i) => paint(i));
    overlay.hide();
  }

  function flip(i){
    if (destroyed || lock || open.includes(i) || matched.has(i)) return;
    open.push(i); paint(i);
    if (open.length < 2) return;
    moves++; set('moves', moves);
    const [a, b] = open;
    if (deck[a] === deck[b]){
      matched.add(a); matched.add(b); open = []; paint(a); paint(b); set('pairs', `${matched.size / 2}/8`);
      if (matched.size === 16) later(win, 450);
    } else {
      lock = true;
      later(() => { const o = open; open = []; lock = false; o.forEach(paint); }, 760);
    }
  }

  function win(){
    const rec = best.submit('memory', moves, true); set('best', best.get('memory') || '—');
    overlay.show('All matched!', `Cleared in ${moves} moves${rec ? ' — new best!' : ` · Best ${best.get('memory')}`}`, 'Play again', deal);
  }

  const onClick = e => { const b = e.target.closest('.mem-card'); if (b) flip(+b.dataset.i); };
  board.addEventListener('click', onClick);
  deal();

  return {
    pause(){ /* turn-based: nothing runs in the background */ },
    resume(){},
    restart: deal,
    destroy(){ destroyed = true; timers.forEach(clearTimeout); timers.clear(); board.removeEventListener('click', onClick); container.innerHTML = ''; }
  };
}
