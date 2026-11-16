// Mosslight v2 — sprites. Every sprite is drawn from CODE: a pixel-map of
// strings, one character = one palette colour, '.' = transparent. At load
// each map is baked once to an offscreen canvas (nearest-neighbour, no
// smoothing) and the game draws the baked canvases. No image files, no
// network, 100% original art.
//
// v2 (Astra visual spec): Neri is a new 24x24 map rendered at 2x with 4
// walk frames, a cast frame and a hurt frame derived from the idle map;
// the lantern is a separate 6x7 element with a precomputed 3-band glow;
// the moth is a new 8x8 sprite; enemies and the boss have new silhouettes
// with per-type hit-flash variants. Walk/cast/hurt frames are computed
// from the idle grid with small rect moves — the maps below are the only
// hand-written art; the transforms are code.

// Pixel-grid helpers: rows may contain '|' separators (formatting only).
function grid(rows) {
  return rows.map((r) => r.replace(/\|/g, '').split(''));
}
function ungrid(g) {
  return g.map((r) => r.join(''));
}
function cloneGrid(g) {
  return g.map((r) => r.slice());
}
function setPx(g, x, y, ch) {
  if (x >= 0 && x < 24 && y >= 0 && y < 24) g[y][x] = ch;
}
// Move a rectangle of pixels by (dx,dy); the source region is cleared.
function moveRect(g, x0, y0, w, h, dx, dy) {
  const tmp = [];
  for (let y = 0; y < h; y++) {
    tmp.push([]);
    for (let x = 0; x < w; x++) tmp[y].push(g[y0 + y][x0 + x]);
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) g[y0 + y][x0 + x] = '.';
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const nx = x0 + x + dx, ny = y0 + y + dy;
    if (nx >= 0 && nx < 24 && ny >= 0 && ny < 24) g[ny][nx] = tmp[y][x];
  }
}
function mirrorGrid(g) {
  return g.map((r) => r.slice().reverse());
}

function bake(rows, pal) {
  const w = Math.max(...rows.map((r) => r.length));
  const h = rows.length;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  for (let y = 0; y < h; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.' || ch === ' ') continue;
      g.fillStyle = pal[ch] || '#FF00FF';
      g.fillRect(x, y, 1, 1);
    }
  }
  return c;
}

// Mirror a half-width map (left half) into a symmetric full sprite.
function bakeMirror(halfRows, pal) {
  const rows = halfRows.map((r) => r + [...r].reverse().join(''));
  return bake(rows, pal);
}

// Return a solid-colour silhouette of a baked sprite.
function tintOf(canvas, color) {
  const c = document.createElement('canvas');
  c.width = canvas.width; c.height = canvas.height;
  const g = c.getContext('2d');
  g.drawImage(canvas, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = color;
  g.fillRect(0, 0, c.width, c.height);
  return c;
}
function whiteOf(canvas) { return tintOf(canvas, '#FFFFFF'); }

// ---------------------------------------------------------------- Neri (hero)
// 24x24 chibi courier, Astra spec: dark hair mass, warm face/hands, broad
// teal cape, bright red scarf, oversized amber lantern held on the left,
// two visible boots, dark outline on every floor palette.
const NERI_PAL = {
  K: '#18233A', k: '#293653', H: '#5B344A', h: '#7B4660',
  S: '#F2B38A', s: '#D8786F', C: '#1B8A90', c: '#3DB5A8',
  R: '#FF5A68', r: '#B93650', L: '#FFC857', l: '#FFF0A6',
  M: '#A7B8B0', B: '#2E294E', W: '#F8E6C4',
};
const NERI_IDLE = [
  '....|....|....|....|....|....',
  '....|....|..KK|KK..|....|....',
  '....|..KK|KHHH|HHKK|....|....',
  '....|.KHH|HHHH|HHHK|....|....',
  '....|.KHH|HhHH|HHHK|....|....',
  '....|.KHH|HSSS|SSHK|....|....',
  '....|.KHS|SSWS|SSHK|....|....',
  '....|..KK|SSSS|KK..|....|....',
  '....|....|KRRR|RK..|....|....',
  '....|..KK|RRRR|RKK.|....|....',
  '....|.KCC|CCCC|CCK.|....|....',
  '....|KCCC|CccC|CCCk|....|....',
  '....|KCCC|CCCC|CCK.|....|....',
  '....|KCCC|CCCC|CCK.|....|....',
  '....|KCCK|CCCC|CKK.|....|....',
  '....|..KK|CCCC|KK..|....|....',
  '....|....|KCCK|K...|....|....',
  '....|....|KBBK|KBBK|....|....',
  '....|....|KBBB|BBBB|....|....',
  '....|....|KBBB|BBBB|....|....',
  '....|....|..KK|..KK|....|....',
  '....|....|....|....|....|....',
  '....|....|....|....|....|....',
  '....|....|....|....|....|....',
];

// Lantern render offsets per frame, in screen px from the player centre.
// Sprite coords from the spec: idle (6,18), walk1 (5,18), walk2 (6,17),
// walk3 (7,18), walk4 (6,19). Sprite is 48x48, lantern 12x14.
export const LANTERN_POS = [
  [-6, 19], [-8, 19], [-6, 17], [-4, 19], [-6, 21],
];

// Walk frames, derived from the idle map (110 ms each, 440 ms loop).
function neriWalkFrames() {
  const idle = grid(NERI_IDLE);
  // Frame 1: right boot forward/down, cape bottom edge left 1, scarf tip
  // right 1, cape highlight at (7,14).
  const f1 = cloneGrid(idle);
  moveRect(f1, 12, 17, 5, 4, 2, 1);
  moveRect(f1, 6, 15, 10, 1, -1, 0);
  setPx(f1, 13, 8, 'R'); setPx(f1, 14, 8, 'K');
  setPx(f1, 13, 9, 'R');
  setPx(f1, 7, 14, 'c');
  // Frame 2: both boots down 1, scarf tip right 2, cape highlights,
  // fluttering notch at the cape hem.
  const f2 = cloneGrid(idle);
  moveRect(f2, 8, 17, 8, 4, 0, 1);
  setPx(f2, 13, 8, 'R'); setPx(f2, 14, 8, 'K');
  setPx(f2, 13, 9, 'R'); setPx(f2, 14, 9, 'K');
  setPx(f2, 6, 13, 'c'); setPx(f2, 9, 14, 'c');
  setPx(f2, 12, 16, '.');
  // Frame 3: mirror of frame 1, plus a central cape highlight.
  const f3 = mirrorGrid(f1);
  setPx(f3, 10, 13, 'c');
  // Frame 4: scarf tip left 2, cape lower section left 1, stride
  // outlines below both boots.
  const f4 = cloneGrid(idle);
  moveRect(f4, 9, 8, 5, 2, -2, 0);
  moveRect(f4, 4, 12, 12, 5, -1, 0);
  setPx(f4, 10, 21, 'K'); setPx(f4, 11, 21, 'K');
  setPx(f4, 14, 21, 'K'); setPx(f4, 15, 21, 'K');
  return [ungrid(f1), ungrid(f2), ungrid(f3), ungrid(f4)];
}

// Cast frame (160 ms): scarf trails diagonally, cape opens on the far
// side, feet spread. The lantern arm + crescent are drawn at render time
// toward the aim vector.
function neriCastFrame() {
  const g = cloneGrid(grid(NERI_IDLE));
  setPx(g, 11, 9, 'R'); setPx(g, 10, 10, 'R'); setPx(g, 9, 11, 'R');
  setPx(g, 12, 9, '.'); setPx(g, 12, 10, '.');
  setPx(g, 3, 12, 'C'); setPx(g, 2, 12, 'K');
  setPx(g, 3, 13, 'C'); setPx(g, 2, 13, 'K');
  setPx(g, 3, 14, 'C'); setPx(g, 2, 14, 'K');
  moveRect(g, 8, 17, 4, 4, -1, 0);
  moveRect(g, 13, 17, 4, 4, 1, 0);
  return ungrid(g);
}

// Hurt frame (120 ms): white checkerboard distress marks + red marks
// above the head. Scarf/lantern tilt is applied at render time.
function neriHurtFrame() {
  const g = cloneGrid(grid(NERI_IDLE));
  setPx(g, 6, 10, 'W'); setPx(g, 9, 12, 'W');
  setPx(g, 12, 14, 'W'); setPx(g, 15, 11, 'W');
  setPx(g, 9, 2, 'R'); setPx(g, 14, 3, 'R');
  return ungrid(g);
}

// Lantern held in hand, 6x7 source (12x14 screen). Drawn separately so
// its glow can pulse without rebuilding Neri.
const LANTERN = [
  '..M..',
  '.MLM.',
  '.MllM',
  '.LllL',
  '.MllM',
  '..M..',
  '..M..',
];

// Precomputed lantern glow: one radial gradient with the spec's three
// bands, drawn 'lighter'. v3: bigger (144px) and brighter so Neri's
// lantern reads at a glance, like the hero aura in the references.
function makeLanternGlow() {
  const c = document.createElement('canvas');
  c.width = 144; c.height = 144;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(72, 72, 0, 72, 72, 72);
  grad.addColorStop(0, 'rgba(255,224,111,0.22)');
  grad.addColorStop(26 / 72, 'rgba(255,224,111,0.22)');
  grad.addColorStop(26 / 72, 'rgba(255,205,84,0.12)');
  grad.addColorStop(50 / 72, 'rgba(255,205,84,0.12)');
  grad.addColorStop(50 / 72, 'rgba(255,190,62,0.05)');
  grad.addColorStop(1, 'rgba(255,190,62,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 144, 144);
  return c;
}

// Moth companion, 8x8 source rendered at 2x. Two wing frames.
const MOTH_PAL = { b: '#8A7AC8', w: '#B8E1D5', h: '#FFF0A6', K: '#18233A' };
const MOTH_A = [
  'wh....hw',
  'wwh..hww',
  '.wwbbww.',
  '..wbbw..',
  '...bb...',
  '...bb...',
  '....b...',
  '........',
];
const MOTH_B = [
  '.wh..hw.',
  '.wwbbww.',
  '..wbbw..',
  '..wbbw..',
  '...bb...',
  '...bb...',
  '....b...',
  '........',
];

// ---------------------------------------------------------------- Enemies
// Puffcap: pink mushroom, three-lobed cap, pale spots, visible eyes.
// 20x20. Hit flash: whole body white 70 ms. Death: 8 particles.
const PUFF_PAL = { o: '#482B4A', p: '#FF7FB0', h: '#FFB3C7', s: '#FFE0C8', d: '#A85C72', e: '#241D39' };
const PUFF = [
  '.......oooooo.......',
  '.....ooppppppoo.....',
  '....oppppppppppo....',
  '...opphppppppphpo...',
  '..oppppppppppppppo..',
  '..opphpppppppphppo..',
  '.oppppppppppppppppo.',
  '.oppppppppppppppppo.',
  '.oppppppppppppppppo.',
  '..oopppppppppppoo...',
  '......ssssss........',
  '......ssssss........',
  '......sesess........',
  '......ssssss........',
  '......ssssss........',
  '......ssssss........',
  '.....dd......dd.....',
  '.....dd......dd.....',
  '....dddd....dddd....',
  '....................',
];

// Tinket: brass wind-up beetle, side gear protrusions, cyan eye lens,
// red wind-up key. 18x22. Hit flash: brass -> #FFF4D0, 60 ms.
const TINK_PAL = { b: '#D89A4A', h: '#FFD76A', d: '#69433E', g: '#E7B35A', l: '#65D5D5', k: '#E05B4F' };
const TINK = [
  '........kk........',
  '.......kkkk.......',
  '........kk........',
  '......bbbbbb......',
  '....bbbbbbbbbb....',
  '...bbbbbbbbbbbb...',
  '..gbbbbbbbbbbbbg..',
  '..gbbhbbbbbbhbbg..',
  '..bbbbbbbbbbbbbb..',
  '.bbbbbbbbbbbbbbbb.',
  '.bbbbbbbllbbbbbbb.',
  '.bbbbbbbbbbbbbbbb.',
  '.bbbbbbbbbbbbbbbb.',
  '..bbbbbbbbbbbbbb..',
  '..bbbbbbbbbbbbbb..',
  '...bbbbbbbbbbbb...',
  '....bbbbbbbbbb....',
  '......bbbbbb......',
  '.dd............dd.',
  '..dd..........dd..',
  '...dd........dd...',
  '....dd......dd....',
];

// Brambler: leafy stump, three-point leaf crown, pale eyes, thorn tips.
// 24x24. Hit flash: bark #F6D3A6, leaves white, 70 ms.
const BRAM_PAL = { t: '#96684F', h: '#C98A68', d: '#403443', g: '#6FE08A', l: '#C0F5A0', y: '#E3FF9A', w: '#F6F0FF' };
const BRAM = [
  '..........gg............',
  '.........gggg...........',
  '....gg..gggggg..gg......',
  '...gggggggggggggggg.....',
  '..gggggggggggggggggg....',
  '..gglgggggggggggglgg....',
  '.gggggggggggggggggggg...',
  '.gggggggggggggggggggg...',
  '..ggwggggggggggwgg......',
  '..gggggggggggggggg......',
  '....tttttttttt..........',
  '...thttttttttth.........',
  '...tttttttttttt.........',
  '...tttttttttttt.........',
  '..ytttttttttttty........',
  '...tttttttttttt.........',
  '...tttttttttttt.........',
  '...tttttttttttt.........',
  '..ytttttttttttty........',
  '...tttttttttttt.........',
  '...tttttttttttt.........',
  '..tttttttttttttt........',
  '..tttttttttttttt........',
  '..dddddddddddddd........',
];

// The Gloam Bell: 48x48 source (24-wide half, mirrored), turquoise glass
// filling nearly the whole footprint, violet crown, gold rim, dark mouth.
// Crescent reflection + gold clapper are drawn post-bake.
const BELL_PAL = { g: '#5FE0DC', h: '#B2FFFF', d: '#2E8AB0', m: '#283D72', y: '#FFD76A', v: '#A98BEA', o: '#171A43' };
const BELL_HALF = [
  '......................vv',
  '.....................vvv',
  '....................vvvv',
  '...................ggggg',
  '..................gggggg',
  '................gggggggg',
  '...............ggggggggg',
  '..............gggggggggg',
  '.............ggggggggggg',
  '............gggggggggggg',
  '...........ggggggggggggg',
  '..........gggggggggggggg',
  '.........ggggggggggggggg',
  '........gggggggggggggggg',
  '.......ggggggggggggggggg',
  '......gggggggggggggggggg',
  '.....ggggggggggggggggggg',
  '....gggggggggggggggggggg',
  '...ggggggggggggggggggggg',
  '..gggggggggggggggggggggg',
  '..gggggggggggggggggggggg',
  '..gggggggggggggggggggggg',
  '..gggggggggggggggggggggg',
  '..gggggggggggggggggggggg',
  '..gggggggggggggggggggggg',
  '..gggggggggggggggggggggg',
  '..gggggggggggggggggggggg',
  '..gggggggggggggggggggggg',
  '..gggggggggggggggggggggg',
  '..gggggggggggggggggggggg',
  '..gggggggggggggggggggggg',
  '..gggggggggggggggggggggg',
  '..gggggggggggggggggggggg',
  '..gggggggggggggggggggggg',
  '..gggggggggggggggggggggg',
  '..gggggggggggggggggggggg',
  '..gggggggggggggggggggggg',
  '..gggggggggggggggggggggg',
  '..gggggggggggggggggggggg',
  '..gggggggggggggggggggggg',
  '..gggggggggggggggggggggg',
  '..gggggggggggggggggggggg',
  '..gggggggggggggggggggggg',
  '..gggggggggggggggggggggg',
  '.ggggggggggggggggggggggg',
  'ommmmmmmmmmmmmmmmmmmmmmm',
  'ommmmmmmmmmmmmmmmmmmmmmm',
  'yyyyyyyyyyyyyyyyyyyyyyyy',
];

// ---------------------------------------------------------------- Loot & props
// v3: redrawn 16x16 (chest 20x20) with real item detail — dark edge,
// bright fill, white shine — so each reads as a game item, not a blob.
// Coins, hearts and shards drawn in game.js at 28px (was 24), chest 36px.
const COIN_PAL = { y: '#FFD76A', g: '#B8862E', w: '#FFF8D0' };
const COIN = [
  '.....gggggg.....',
  '...ggyyyyyygg...',
  '..gyyyyyyyyyyg..',
  '.gywwyyyyyyyyyg.',
  '.gywwyyyyyyyyyg.',
  'gyyyyyyyyyyyyyyg',
  'gyyyyyyyyyyyyyyg',
  'gyyyyyyyyyyyyyyg',
  'gyyyyyyyyyyyyyyg',
  'gyyyyyyyyyyyyyyg',
  'gyyyyyyyyyyyyyyg',
  '.gyyyyyyyyyyyyg.',
  '.gyyyyyyyyyyyyg.',
  '..gyyyyyyyyyyg..',
  '...ggyyyyyygg...',
  '.....gggggg.....',
];

const HEART_PAL = { r: '#FF5A6E', d: '#A02040', w: '#FFD0DA' };
const HEART = [
  '...ddrr..rrdd...',
  '..drrrrrrrrrrd..',
  '.dwrrrrrrrrrrrd.',
  '.dwrrrrrrrrrrrd.',
  'drrrrrrrrrrrrrrd',
  'drrrrrrrrrrrrrrd',
  'drrrrrrrrrrrrrrd',
  '.drrrrrrrrrrrrd.',
  '..drrrrrrrrrrd..',
  '...drrrrrrrrd...',
  '....drrrrrrd....',
  '.....drrrrd.....',
  '......drrd......',
  '.......dd.......',
  '................',
  '................',
];

const SHARD_PAL = { c: '#4ADDE0', b: '#2AA8C8', d: '#1E6E7E', l: '#B2FFFF', w: '#FFFFFF' };
const SHARD = [
  '.......dd.......',
  '......dccd......',
  '.....dccccd.....',
  '....dcwccccd....',
  '...dccclcccd....',
  '...dcclccccd....',
  '..dccclcccccd...',
  '..dccllcccccd...',
  '..dccclcccccd...',
  '..dccclcccccd...',
  '...dccclcccd....',
  '....dcccccd.....',
  '.....dcccd......',
  '......dcd.......',
  '.......d........',
  '................',
];

const CHEST_PAL = { b: '#8A5A33', y: '#FFD76A', d: '#4A2E1A', l: '#FFE9A8' };
const CHEST = [
  '.....dddddddddd.....',
  '...ddbbbbbbbbbbdd...',
  '..dbbbbbbbbbbbbbbd..',
  '..dbbyyyyyyyyyybbd..',
  '..dbbyyyyyyyyyybbd..',
  '..dbbbbbbyybbbbbbd..',
  '..dbbbbbbyybbbbbbd..',
  '..dbbbbbbyybbbbbbd..',
  '..dddddddddddddddd..',
  '..dbbbbbbbbbbbbbbd..',
  '..dbbbbbbbbbbbbbbd..',
  '..dbbbbbbllbbbbbbd..',
  '..dbbbbbbllbbbbbbd..',
  '..dbbbbbbyybbbbbbd..',
  '..dbbbbbbyybbbbbbd..',
  '..dbbbbbbyybbbbbbd..',
  '..dddddddddddddddd..',
  '...dddddddddddddd...',
  '.....dddddddddd.....',
  '....................',
];

const STATUE_PAL = { s: '#B0A5D8', g: '#FFD76A' };
const STATUE = [
  '......ssss......',
  '......ssss......',
  '.....ssssss.....',
  '.....ssssss.....',
  '....ssssssss....',
  '....ssgssgss....',
  '....ssssssss....',
  '.....ssssss.....',
  '......ssss......',
  '......ssss......',
  '......ssss......',
  '.....ssssss.....',
  '....ssssssss....',
  '...ssssssssss...',
  '...ssssssssss...',
  '..ssssssssssss..',
  '..ssssssssssss..',
  '..ss........ss..',
  '..ss........ss..',
  '..ssssssssssss..',
  '.ssssssssssssss.',
  '.ssssssssssssss.',
  '................',
  '................',
];

// Bake everything once; export the sprite table.
export function buildSprites() {
  const idleRows = ungrid(grid(NERI_IDLE));
  const [w1, w2, w3, w4] = neriWalkFrames();
  const neriIdle = bake(idleRows, NERI_PAL);
  const bell = bakeMirror(BELL_HALF, BELL_PAL);
  // Bell post-bake: pale crescent reflection (upper-left body) + gold
  // clapper hanging at the centre of the dark mouth.
  const bg = bell.getContext('2d');
  bg.fillStyle = '#B2FFFF';
  const crescent = [[9, 10], [10, 8], [11, 7], [12, 6], [13, 5], [14, 5], [15, 4], [16, 4], [17, 4], [11, 9], [12, 8], [13, 7], [14, 6], [15, 6], [16, 5]];
  for (const [x, y] of crescent) bg.fillRect(x, y, 1, 1);
  bg.fillStyle = '#FFC857';
  bg.fillRect(22, 42, 4, 6);
  bg.fillStyle = '#B93650';
  bg.fillRect(23, 47, 2, 1);
  // Bright outer edge on the bell body (left rim, upper half).
  bg.fillStyle = '#B2FFFF';
  for (let y = 18; y <= 30; y++) bg.fillRect(2, y, 1, 1);
  const puff = bake(PUFF, PUFF_PAL);
  const tink = bake(TINK, TINK_PAL);
  const bram = bake(BRAM, BRAM_PAL);
  return {
    // neri[0] = idle, [1..4] = walk frames (110 ms each).
    neri: [neriIdle, bake(w1, NERI_PAL), bake(w2, NERI_PAL), bake(w3, NERI_PAL), bake(w4, NERI_PAL)],
    neriCast: bake(neriCastFrame(), NERI_PAL),
    neriHurt: bake(neriHurtFrame(), NERI_PAL),
    lantern: bake(LANTERN, NERI_PAL),
    lanternPos: LANTERN_POS,
    lanternGlow: makeLanternGlow(),
    moth: [bake(MOTH_A, MOTH_PAL), bake(MOTH_B, MOTH_PAL)],
    puffcap: puff,
    puffFlash: whiteOf(puff),
    tinket: tink,
    tinkFlash: tintOf(tink, '#FFF4D0'),
    brambler: bram,
    bramFlash: whiteOf(bram),
    bell,
    bellWhite: whiteOf(bell),
    coin: bake(COIN, COIN_PAL),
    heart: bake(HEART, HEART_PAL),
    shard: bake(SHARD, SHARD_PAL),
    chest: bake(CHEST, CHEST_PAL),
    statue: bake(STATUE, STATUE_PAL),
  };
}
