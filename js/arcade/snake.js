/* Snake — responsive grid, keyboard + swipe + on-screen pad. */
import { best, createLoop, fitCanvas, createOverlay, chrome, onSwipe, dpad, KEY_DIR } from './common.js';

const N = 20, SIZE = 400;
const OPP = { up: 'down', down: 'up', left: 'right', right: 'left' };
const VEC = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

export default function create(container){
  const { play, set } = chrome(container, { title: 'Snake', stats: [{ id: 'score', label: 'Score', value: 0 }, { id: 'best', label: 'Best', value: best.get('snake') }] });
  const canvas = document.createElement('canvas');
  canvas.className = 'g-canvas'; canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', 'Snake game board. Use arrow keys, WASD, swipes or the direction buttons.');
  play.appendChild(canvas);
  const fit = fitCanvas(canvas, SIZE, SIZE, play), ctx = fit.ctx;
  const overlay = createOverlay(play);
  const pad = dpad(container, d => turn(d));
  const unswipe = onSwipe(canvas, d => turn(d), 22);

  let snake, dir, queue, food, score, acc, state = 'ready', clock = 0, destroyed = false;

  function reset(){
    snake = [[10, 10], [9, 10], [8, 10]]; dir = 'right'; queue = []; score = 0; acc = 0; set('score', 0); placeFood();
  }
  function placeFood(){
    const taken = new Set(snake.map(s => s[0] + ',' + s[1]));
    const free = [];
    for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) if (!taken.has(x + ',' + y)) free.push([x, y]);
    food = free.length ? free[Math.floor(Math.random() * free.length)] : null;
  }
  function turn(d){
    if (state === 'ready'){ start(); }
    if (state !== 'play') return;
    const last = queue.length ? queue[queue.length - 1] : dir;
    if (d !== last && d !== OPP[last] && queue.length < 2) queue.push(d);
  }
  function start(){ overlay.hide(); if (state === 'over' || state === 'ready') reset(); state = 'play'; loop.start(); container.focus({ preventScroll: true }); }
  function over(){
    state = 'over';
    const rec = best.submit('snake', score); set('best', best.get('snake'));
    overlay.show('Game over', `Score ${score} · Best ${best.get('snake')}${rec ? ' — new record!' : ''}`, 'Play again', () => { state = 'over'; start(); });
  }
  const interval = () => Math.max(0.065, 0.14 - score * 0.003);

  function tick(){
    if (queue.length) dir = queue.shift();
    const [dx, dy] = VEC[dir], head = snake[0], nx = head[0] + dx, ny = head[1] + dy;
    const grows = food && nx === food[0] && ny === food[1];
    const body = grows ? snake : snake.slice(0, -1);
    if (nx < 0 || ny < 0 || nx >= N || ny >= N || body.some(s => s[0] === nx && s[1] === ny)){ over(); return; }
    snake.unshift([nx, ny]);
    if (grows){ score++; set('score', score); placeFood(); } else snake.pop();
  }
  function step(dt){
    clock += dt;
    if (state !== 'play') return;
    acc += dt;
    while (acc >= interval() && state === 'play'){ acc -= interval(); tick(); }
  }

  function draw(){
    const c = SIZE / N;
    const bg = ctx.createLinearGradient(0, 0, SIZE, SIZE); bg.addColorStop(0, '#0d1430'); bg.addColorStop(1, '#161d44');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.fillStyle = 'rgba(255,255,255,.045)';
    for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) if ((x + y) % 2 === 0) ctx.fillRect(x * c, y * c, c, c);
    if (food){
      const p = 0.5 + 0.5 * Math.sin(clock * 5), cx = food[0] * c + c / 2, cy = food[1] * c + c / 2;
      const g = ctx.createRadialGradient(cx, cy, 1, cx, cy, c * 0.9); g.addColorStop(0, 'rgba(232,154,100,1)'); g.addColorStop(1, 'rgba(232,154,100,0)');
      ctx.fillStyle = g; ctx.fillRect(cx - c, cy - c, c * 2, c * 2);
      ctx.fillStyle = '#ffd1aa'; ctx.beginPath(); ctx.arc(cx, cy, c * (0.28 + p * 0.05), 0, 6.283); ctx.fill();
    }
    snake.forEach((s, i) => {
      const t = 1 - i / Math.max(8, snake.length);
      ctx.fillStyle = `rgba(${Math.round(110 + 60 * t)},${Math.round(150 + 70 * t)},255,${0.55 + 0.45 * t})`;
      ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(s[0] * c + 1.5, s[1] * c + 1.5, c - 3, c - 3, i === 0 ? 7 : 5); ctx.fill(); ctx.stroke();
    });
    if (snake.length){ const h = snake[0]; ctx.fillStyle = '#0b1228'; ctx.beginPath(); ctx.arc(h[0] * c + c * 0.62, h[1] * c + c * 0.38, 1.9, 0, 6.283); ctx.fill(); }
  }

  const loop = createLoop(step, draw);
  const onKey = e => {
    const d = KEY_DIR[e.key];
    if (overlay.visible) return;
    if (d){ e.preventDefault(); turn(d); }
    else if (e.key === ' ' || e.key === 'p' || e.key === 'P'){ e.preventDefault(); if (state === 'play') pause(); }
  };
  container.addEventListener('keydown', onKey);
  function pause(){
    if (destroyed) return;
    if (state === 'play'){
      state = 'paused'; loop.stop();
      overlay.show('Paused', 'Your snake is waiting.', 'Resume', () => { overlay.hide(); state = 'play'; loop.start(); container.focus({ preventScroll: true }); });
    } else loop.stop();
  }

  reset(); draw();
  overlay.show('Snake', 'Arrow keys, WASD, swipes or the pad. Eat the glow, avoid walls and yourself.', 'Start', start);

  return {
    pause,
    resume(){ if (state === 'ready' || state === 'over') draw(); },
    restart(){ state = 'over'; start(); },
    destroy(){
      destroyed = true; loop.stop(); fit.destroy(); unswipe();
      container.removeEventListener('keydown', onKey); pad.remove(); container.innerHTML = '';
    }
  };
}
