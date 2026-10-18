/* Flappy — original glass-and-night-sky take on the side-scrolling flyer (no borrowed assets). */
import { best, createLoop, fitCanvas, createOverlay, chrome } from './common.js';
import { clamp } from '../util.js';

const W = 360, H = 540, GROUND = 46, PW = 62, GAP = 152, BX = 92, R = 13;

export default function create(container){
  const { play, set } = chrome(container, { title: 'Flappy', stats: [{ id: 'score', label: 'Score', value: 0 }, { id: 'best', label: 'Best', value: best.get('flappy') }] });
  const canvas = document.createElement('canvas');
  canvas.className = 'g-canvas'; canvas.setAttribute('aria-label', 'Flappy game board. Click, tap or press Space to flap.'); canvas.setAttribute('role', 'img');
  play.appendChild(canvas);
  const fit = fitCanvas(canvas, W, H, play), ctx = fit.ctx;
  const overlay = createOverlay(play);

  const stars = Array.from({ length: 36 }, (_, i) => ({ x: (i * 97) % W, y: (i * 53) % (H - GROUND - 60), r: 0.6 + (i % 3) * 0.5, p: i * 0.7 }));
  let state = 'ready', bird, pipes, score, spawn, groundX, clock = 0, destroyed = false;

  function reset(){
    bird = { y: H / 2 - 40, vy: 0, rot: 0 }; pipes = []; score = 0; spawn = 0.9; groundX = 0;
    set('score', 0);
  }
  reset();

  function flap(){ bird.vy = -430; }
  function start(){ overlay.hide(); reset(); state = 'play'; flap(); loop.start(); container.focus({ preventScroll: true }); }
  function over(){
    state = 'over';
    const rec = best.submit('flappy', score); set('best', best.get('flappy'));
    overlay.show('Game over', `Score ${score} · Best ${best.get('flappy')}${rec ? ' — new record!' : ''}`, 'Play again', start);
  }
  function input(){
    if (overlay.visible) return;
    if (state === 'ready') start(); else if (state === 'play') flap();
  }

  function step(dt){
    clock += dt;
    if (state !== 'play') { bird.y = H / 2 - 40 + Math.sin(clock * 3) * 6; return; }
    const speed = 150 + Math.min(score, 30) * 2;
    bird.vy += 1500 * dt; bird.y += bird.vy * dt; bird.rot = clamp(bird.vy / 600, -0.5, 1.1);
    if (bird.y - R < 0){ bird.y = R; bird.vy = 0; }
    groundX = (groundX - speed * dt) % 24;
    spawn -= dt;
    if (spawn <= 0){ spawn = 1.5; pipes.push({ x: W + 12, gy: 118 + Math.random() * (H - GROUND - 236), scored: false }); }
    for (const p of pipes){
      p.x -= speed * dt;
      if (!p.scored && p.x + PW < BX - R){ p.scored = true; score++; set('score', score); }
      if (BX + R > p.x && BX - R < p.x + PW && (bird.y - R < p.gy - GAP / 2 || bird.y + R > p.gy + GAP / 2)){ over(); return; }
    }
    pipes = pipes.filter(p => p.x > -PW - 10);
    if (bird.y + R >= H - GROUND){ bird.y = H - GROUND - R; over(); }
  }

  function pipe(x, y0, y1, cap){
    const g = ctx.createLinearGradient(x, 0, x + PW, 0);
    g.addColorStop(0, 'rgba(150,200,255,.34)'); g.addColorStop(.5, 'rgba(210,235,255,.5)'); g.addColorStop(1, 'rgba(120,170,255,.28)');
    ctx.fillStyle = g; ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(x, y0, PW, y1 - y0, 6); ctx.fill(); ctx.stroke();
    const cy = cap ? y1 - 22 : y0;
    ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.beginPath(); ctx.roundRect(x - 4, cy, PW + 8, 22, 6); ctx.fill(); ctx.stroke();
  }

  function draw(){
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#0b1228'); sky.addColorStop(.6, '#1a2a60'); sky.addColorStop(1, '#3a3f86');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    const glow = ctx.createRadialGradient(280, 120, 4, 280, 120, 90); glow.addColorStop(0, 'rgba(255,214,170,.55)'); glow.addColorStop(1, 'rgba(255,214,170,0)');
    ctx.fillStyle = glow; ctx.fillRect(180, 20, 200, 200);
    ctx.fillStyle = '#ffd9b8'; ctx.beginPath(); ctx.arc(280, 120, 17, 0, 6.283); ctx.fill();
    for (const s of stars){ ctx.globalAlpha = 0.45 + 0.4 * Math.sin(clock * 1.5 + s.p); ctx.fillStyle = '#fff'; ctx.fillRect(s.x, s.y, s.r, s.r); }
    ctx.globalAlpha = 1;
    for (const p of pipes){ pipe(p.x, -10, p.gy - GAP / 2, true); pipe(p.x, p.gy + GAP / 2, H - GROUND, false); }
    ctx.fillStyle = '#10163a'; ctx.fillRect(0, H - GROUND, W, GROUND);
    ctx.fillStyle = 'rgba(147,169,255,.45)'; ctx.fillRect(0, H - GROUND, W, 2);
    ctx.fillStyle = 'rgba(255,255,255,.08)'; for (let x = groundX - 24; x < W + 24; x += 24) ctx.fillRect(x, H - GROUND + 14, 12, 4);
    ctx.save(); ctx.translate(BX, bird.y); ctx.rotate(bird.rot);
    const bg = ctx.createRadialGradient(-4, -5, 2, 0, 0, R + 2); bg.addColorStop(0, '#ffe0c2'); bg.addColorStop(.5, '#e89a64'); bg.addColorStop(1, '#b8602a');
    ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(0, 0, R, 0, 6.283); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.beginPath(); ctx.ellipse(-3, 3 + Math.sin(clock * 18) * (state === 'play' ? 2.5 : 0.5), 7, 4, -0.4, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#171717'; ctx.beginPath(); ctx.arc(5, -3, 2.2, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.moveTo(R - 1, -1); ctx.lineTo(R + 7, 2); ctx.lineTo(R - 1, 5); ctx.fill();
    ctx.restore();
    if (state === 'ready' && !overlay.visible){ ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.font = '600 15px "DM Mono", monospace'; ctx.textAlign = 'center'; ctx.fillText('TAP · CLICK · SPACE', W / 2, H / 2 + 60); }
  }

  const loop = createLoop(step, draw);
  const onKey = e => {
    if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W'){
      if (overlay.visible) return;
      e.preventDefault(); input();
    }
  };
  const onDown = e => { e.preventDefault(); container.focus({ preventScroll: true }); input(); };
  container.addEventListener('keydown', onKey);
  canvas.addEventListener('pointerdown', onDown);

  overlay.show('Flappy', 'Tap, click or press Space to flap through the gaps.', 'Start', start);
  loop.start();                               // idle animation behind the start card

  return {
    pause(){ if (state === 'play' && !destroyed){ loop.stop(); state = 'paused'; overlay.show('Paused', 'Your run is on hold.', 'Resume', () => { overlay.hide(); state = 'play'; loop.start(); container.focus({ preventScroll: true }); }); } else if (state !== 'play') loop.stop(); },
    resume(){ if (state === 'ready' || state === 'over') loop.start(); },
    restart(){ start(); },
    destroy(){
      destroyed = true; loop.stop(); fit.destroy();
      container.removeEventListener('keydown', onKey); canvas.removeEventListener('pointerdown', onDown);
      container.innerHTML = '';
    }
  };
}
