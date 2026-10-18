/* Pong — you vs a fallible opponent. First to 7. Keys, pointer drag, or hold the on-screen buttons. */
import { best, createLoop, fitCanvas, createOverlay, chrome } from './common.js';
import { clamp } from '../util.js';

const W = 480, H = 320, PH = 62, PWID = 10, R = 7, TO = 7;

export default function create(container){
  const { play, set } = chrome(container, { title: 'Pong', stats: [{ id: 'you', label: 'You', value: 0 }, { id: 'cpu', label: 'CPU', value: 0 }, { id: 'best', label: 'Wins', value: best.get('pong') }] });
  const canvas = document.createElement('canvas');
  canvas.className = 'g-canvas'; canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', 'Pong board. Move with W and S, the arrow keys, or drag. First to seven wins.');
  play.appendChild(canvas);
  const fit = fitCanvas(canvas, W, H, play), ctx = fit.ctx;
  const overlay = createOverlay(play);
  const ctl = document.createElement('div');
  ctl.className = 'g-dpad g-dpad-v'; ctl.setAttribute('role', 'group'); ctl.setAttribute('aria-label', 'Paddle controls');
  ctl.innerHTML = '<button type="button" class="g-dir" data-d="-1" aria-label="Move paddle up">▲</button><button type="button" class="g-dir" data-d="1" aria-label="Move paddle down">▼</button>';
  container.appendChild(ctl);

  let me, cpu, ball, ys, yc, hold = 0, keys = new Set(), state = 'ready', serveT = 0, aiErr = 0, aiT = 0, clock = 0, destroyed = false;

  function serve(dirn){
    const a = (Math.random() - 0.5) * 0.7;
    ball = { x: W / 2, y: H / 2, vx: Math.cos(a) * 250 * dirn, vy: Math.sin(a) * 250, hits: 0 };
    serveT = 0.7;
  }
  function reset(){ me = H / 2; cpu = H / 2; ys = 0; yc = 0; set('you', 0); set('cpu', 0); serve(Math.random() < 0.5 ? 1 : -1); }
  reset();

  function start(){ overlay.hide(); if (state !== 'paused'){ reset(); } state = 'play'; loop.start(); container.focus({ preventScroll: true }); }
  function finish(won){
    state = 'over';
    if (won){ best.submit('pong', best.get('pong') + 1); set('best', best.get('pong')); }
    overlay.show(won ? 'You win!' : 'CPU wins', `${ys} – ${yc}${won ? ' · wins: ' + best.get('pong') : ''}`, 'Play again', () => { state = 'ready'; start(); });
  }

  function step(dt){
    clock += dt;
    if (state !== 'play') return;
    const dir = (keys.has('up') ? -1 : 0) + (keys.has('down') ? 1 : 0) + hold;
    me = clamp(me + clamp(dir, -1, 1) * 330 * dt, PH / 2, H - PH / 2);
    aiT -= dt; if (aiT <= 0){ aiT = 0.35; aiErr = (Math.random() - 0.5) * 46; }
    const target = ball.vx > 0 ? ball.y + aiErr : H / 2;
    cpu = clamp(cpu + clamp(target - cpu, -215 * dt, 215 * dt), PH / 2, H - PH / 2);
    if (serveT > 0){ serveT -= dt; return; }
    ball.x += ball.vx * dt; ball.y += ball.vy * dt;
    if (ball.y < R){ ball.y = R; ball.vy = Math.abs(ball.vy); }
    if (ball.y > H - R){ ball.y = H - R; ball.vy = -Math.abs(ball.vy); }
    const hit = (px, py, sign) => {
      const dx = Math.abs(ball.x - px) < PWID / 2 + R, dy = Math.abs(ball.y - py) < PH / 2 + R;
      if (dx && dy && Math.sign(ball.vx) === -sign){
        const off = clamp((ball.y - py) / (PH / 2), -1, 1), sp = Math.min(520, Math.hypot(ball.vx, ball.vy) + 16);
        const ang = off * 0.95;
        ball.vx = Math.cos(ang) * sp * sign; ball.vy = Math.sin(ang) * sp; ball.x = px + sign * (PWID / 2 + R + 0.5); ball.hits++;
      }
    };
    hit(24, me, 1); hit(W - 24, cpu, -1);
    if (ball.x < -R){ yc++; set('cpu', yc); if (yc >= TO) return finish(false); serve(1); }
    else if (ball.x > W + R){ ys++; set('you', ys); if (ys >= TO) return finish(true); serve(-1); }
  }

  function draw(){
    const bg = ctx.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#0c1230'); bg.addColorStop(1, '#171e4a');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.setLineDash([8, 10]); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(W / 2, 8); ctx.lineTo(W / 2, H - 8); ctx.stroke(); ctx.setLineDash([]);
    const paddle = (x, y, hue) => { ctx.fillStyle = hue; ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.roundRect(x - PWID / 2, y - PH / 2, PWID, PH, 5); ctx.fill(); ctx.stroke(); };
    paddle(24, me, 'rgba(140,175,255,.9)'); paddle(W - 24, cpu, 'rgba(255,178,122,.9)');
    const g = ctx.createRadialGradient(ball.x - 2, ball.y - 2, 1, ball.x, ball.y, R + 3); g.addColorStop(0, '#fff'); g.addColorStop(1, '#ffd1aa');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ball.x, ball.y, R, 0, 6.283); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.font = '700 64px "DM Mono", monospace'; ctx.textAlign = 'center';
    ctx.fillText(ys, W / 2 - 70, 70); ctx.fillText(yc, W / 2 + 70, 70);
  }

  const loop = createLoop(step, draw);
  const keyMap = { ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down' };
  const onKey = e => { const k = keyMap[e.key]; if (k && !overlay.visible){ e.preventDefault(); e.type === 'keydown' ? keys.add(k) : keys.delete(k); } };
  const onKeyUp = e => { const k = keyMap[e.key]; if (k) keys.delete(k); };
  container.addEventListener('keydown', onKey); container.addEventListener('keyup', onKeyUp);
  const onBlur = () => keys.clear();
  container.addEventListener('blur', onBlur, true);

  const toY = e => { const r = canvas.getBoundingClientRect(); return clamp((e.clientY - r.top) / r.height * H, PH / 2, H - PH / 2); };
  let dragging = false;
  const pdown = e => { dragging = true; canvas.setPointerCapture?.(e.pointerId); if (state === 'play') me = toY(e); container.focus({ preventScroll: true }); };
  const pmove = e => { if (dragging && state === 'play') me = toY(e); };
  const pup = () => { dragging = false; };
  canvas.addEventListener('pointerdown', pdown); canvas.addEventListener('pointermove', pmove); canvas.addEventListener('pointerup', pup); canvas.addEventListener('pointercancel', pup);
  const bDown = e => { const b = e.target.closest('[data-d]'); if (b){ e.preventDefault(); hold = +b.dataset.d; } };
  const bUp = () => { hold = 0; };
  ctl.addEventListener('pointerdown', bDown); ctl.addEventListener('pointerup', bUp); ctl.addEventListener('pointerleave', bUp); ctl.addEventListener('pointercancel', bUp);

  function pause(){
    if (destroyed) return;
    keys.clear(); hold = 0;
    if (state === 'play'){ state = 'paused'; loop.stop(); overlay.show('Paused', 'The ball is waiting.', 'Resume', () => { overlay.hide(); state = 'play'; loop.start(); container.focus({ preventScroll: true }); }); }
    else loop.stop();
  }

  draw();
  overlay.show('Pong', 'W / S, arrow keys, drag, or hold the buttons. First to seven wins.', 'Start', start);

  return {
    pause, resume(){ if (state === 'ready' || state === 'over') draw(); },
    restart(){ state = 'ready'; start(); },
    destroy(){
      destroyed = true; loop.stop(); fit.destroy();
      container.removeEventListener('keydown', onKey); container.removeEventListener('keyup', onKeyUp); container.removeEventListener('blur', onBlur, true);
      canvas.removeEventListener('pointerdown', pdown); canvas.removeEventListener('pointermove', pmove);
      canvas.removeEventListener('pointerup', pup); canvas.removeEventListener('pointercancel', pup);
      container.innerHTML = '';
    }
  };
}
