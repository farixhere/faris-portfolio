/* Game catalogue. Game code is loaded on demand, so it costs nothing until someone plays. */
export const GAMES = [
  { id: 'flappy', title: 'Flappy', glyph: '◐', cmd: 'game flappy', aliases: ['flap', 'flappybird', 'bird'],
    blurb: 'Glide through glass pillars.', how: 'Tap, click or press Space to flap. Squeeze through the gaps without touching a pillar.', load: () => import('./flappy.js') },
  { id: 'snake', title: 'Snake', glyph: '≋', cmd: 'game snake', aliases: [],
    blurb: 'Eat the glow. Don’t eat yourself.', how: 'Arrow keys or WASD — or swipe, or use the on-screen pad. Walls and your own tail end the run.', load: () => import('./snake.js') },
  { id: 'memory', title: 'Memory', glyph: '◇', cmd: 'game memory', aliases: ['match', 'pairs'],
    blurb: 'Find all eight pairs.', how: 'Click or tap cards to flip two at a time. Match every pair in as few moves as you can.', load: () => import('./memory.js') },
  { id: 'pong', title: 'Pong', glyph: '▮', cmd: 'game pong', aliases: [],
    blurb: 'First to seven wins.', how: 'W / S or arrow keys, drag on the board, or hold the on-screen buttons. The CPU isn’t perfect.', load: () => import('./pong.js') },
  { id: '2048', title: '2048', glyph: '▦', cmd: 'game 2048', aliases: ['t48'],
    blurb: 'Merge your way to 2048.', how: 'Arrow keys, WASD or swipe to slide tiles. Equal tiles merge into one.', load: () => import('./game2048.js') }
];

export function findGame(name){
  const n = String(name || '').trim().toLowerCase();
  if (!n) return null;
  return GAMES.find(g => g.id === n || g.aliases.includes(n)) || null;
}
