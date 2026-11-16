// Mosslight — sprites. Every sprite is drawn from CODE: a pixel-map of
// strings, one character = one palette colour, '.' = transparent. At load
// each map is baked once to an offscreen canvas (nearest-neighbour, no
// smoothing) and the game draws the baked canvases. No image files, no
// network, 100% original art.

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

// Return a solid-white silhouette of a baked sprite (telegraph flash).
function whiteOf(canvas) {
  const c = document.createElement('canvas');
  c.width = canvas.width; c.height = canvas.height;
  const g = c.getContext('2d');
  g.drawImage(canvas, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = '#FFFFFF';
  g.fillRect(0, 0, c.width, c.height);
  return c;
}

// ---------------------------------------------------------------- Neri (hero)
// 24x24 chibi courier: dark hair, warm brown skin, red scarf, teal cape,
// cream tunic, dark boots. Two walk frames (legs apart / together).
const NERI_PAL = {
  h: '#234F3C', s: '#C68A5B', e: '#1A1A1A', w: '#FFFFFF',
  r: '#E84A4A', c: '#1F8A8A', t: '#F2D8A7', b: '#5A3A28', o: '#173F35',
};
const NERI_BODY = [
  '........hhhhhhhh........',
  '......hhhhhhhhhhhh......',
  '.....hhhhhhhhhhhhhh.....',
  '.....hhhhhhhhhhhhhh.....',
  '.....hhsssssssssshh.....',
  '.....hssssssssssssh.....',
  '.....hsswsssssswssh.....',
  '.....hssssssssssssh.....',
  '.....hssssssssssssh.....',
  '......ssssssssssss......',
  '.....rrrrrrrrrrrrrr.....',
  '....rrrrrrrrrrrrrrrr....',
  '....cccttttttttttccc....',
  '....cccttttttttttccc....',
  '....cccttttttttttccc....',
  '.....cctttttttttcc......',
  '.....cctttttttttcc......',
  '.....cctttttttttcc......',
  '.....ccbbbbbbbbbbcc.....',
  '.....ccbbbbbbbbbbcc.....',
];
const NERI_LEGS_A = [
  '......bb........bb......',
  '......bb........bb......',
  '......bb........bb......',
  '......bb........bb......',
];
const NERI_LEGS_B = [
  '.........bbbbbb.........',
  '.........bbbbbb.........',
  '.........bbbbbb.........',
  '.........bbbbbb.........',
];

// Lantern held in hand (drawn separately so it can glow and bob).
const LANTERN_PAL = { g: '#FFE9A8', l: '#FFC93C', w: '#FFF6D8' };
const LANTERN = [
  '...gggg...',
  '..gggggg..',
  '.gllllllg.',
  'gllllllllg',
  'gllwwllllg',
  'gllllllllg',
  '.gllllllg.',
  '..gggggg..',
  '...gggg...',
];

// Moth companion, 12x12, two wing frames.
const MOTH_PAL = { m: '#8A75B7', w: '#FFF3C4', e: '#1A1A1A' };
const MOTH_A = [
  'ww........ww',
  'www......www',
  '.wwwmmmmwww.',
  '..wmmmmmmw..',
  '...mmmmmm...',
  '....mmmm....',
  '....mmmm....',
  '....mmmm....',
  '.....mm.....',
  '............',
  '............',
  '............',
];
const MOTH_B = [
  '............',
  '............',
  '....mmmm....',
  '..wwmmmmww..',
  '.wwwmmmmwww.',
  'wwwmmmmmmwww',
  '.wwwmmmmwww.',
  '..wwmmmmww..',
  '....mmmm....',
  '.....mm.....',
  '............',
  '............',
];

// ---------------------------------------------------------------- Enemies
// Puffcap: pink mushroom, mint cap spots, tiny feet. 20x20.
const PUFF_PAL = { p: '#FF7FA8', m: '#9BD96A', s: '#FFF3C4', f: '#173F35' };
const PUFF = [
  '......pppppppp......',
  '....pppppppppppp....',
  '...pppppppppppppp...',
  '..pppmppppppppmppp..',
  '..pppppppppppppppp..',
  '.ppppmpppppppppmppp.',
  '.pppppppppppppppppp.',
  'pppppppppppppppppppp',
  'pppppppppppppppppppp',
  '......ssssssss......',
  '......ssssssss......',
  '......ssssssss......',
  '......ssssssss......',
  '......ssssssss......',
  '......ssssssss......',
  '.....ff......ff.....',
  '.....ff......ff.....',
  '....ffff....ffff....',
  '....................',
  '....................',
];

// Tinket: brass wind-up beetle, cyan key. 18x22.
const TINK_PAL = { b: '#C9973F', d: '#7A5A22', k: '#35C9D0', l: '#472C36' };
const TINK = [
  '........kk........',
  '.......kkkk.......',
  '........kk........',
  '......bbbbbb......',
  '....bbbbbbbbbb....',
  '...bbbbbbbbbbbb...',
  '..bbbbbbbbbbbbbb..',
  '..bbdbbbbbbbbdbb..',
  '..bbbbbbbbbbbbbb..',
  '.bbbbbbbbbbbbbbbb.',
  '.bbbbbbbbbbbbbbbb.',
  '.bbbbbbbbbbbbbbbb.',
  '..bbbbbbbbbbbbbb..',
  '..bbbbbbbbbbbbbb..',
  '...bbbbbbbbbbbb...',
  '....bbbbbbbbbb....',
  '......bbbbbb......',
  '.ll............ll.',
  '..ll..........ll..',
  '...ll........ll...',
  '....ll......ll....',
  '..................',
];

// Brambler: leafy stump, orange thorns. 24x24.
const BRAM_PAL = { g: '#5EAA62', t: '#8A5A33', o: '#FF8A2A', r: '#5A3A28' };
const BRAM = [
  '......gggggg............',
  '....gggggggggg..........',
  '...gggggggggggg.........',
  '..gggggggggggggg........',
  '..gggggggggggggg........',
  '.gggggggggggggggg.......',
  '.gggggggggggggggg.......',
  '....tttttttttt..........',
  '...tttttttttttt.........',
  '...tttttttttttt.........',
  '...tttttttttttt.........',
  '...tttttttttttt.........',
  '..otttttttttttto........',
  '...tttttttttttt.........',
  '...tttttttttttt.........',
  '...tttttttttttt.........',
  '..otttttttttttto........',
  '...tttttttttttt.........',
  '...tttttttttttt.........',
  '..tttttttttttttt........',
  '..tttttttttttttt........',
  '.tttttttttttttttt.......',
  '.tttttttttttttttt.......',
  '..rrrrrrrrrrrrrr........',
];

// The Gloam Bell: 48x48 floating bell, turquoise glass, gold rim.
// Built from a 24-wide half map, mirrored for symmetry.
const BELL_PAL = { g: '#76DDE0', h: '#B9F0F2', y: '#FFD76A' };
const BELL_HALF = [
  '...........gg',
  '..........gggg',
  '.........ggggg',
  '........gggggg',
  '......gggggggg',
  '.....ggggggggg',
  '....gggggggggg',
  '...ggggggggggg',
  '...ggggggggggg',
  '..gggggggggggg',
  '..hhgggggggggg',
  '..hhgggggggggg',
  '..hhgggggggggg',
  '..hhgggggggggg',
  '..hhgggggggggg',
  '..hhgggggggggg',
  '..hhgggggggggg',
  '..hhgggggggggg',
  '..hhgggggggggg',
  '..hhgggggggggg',
  '..gggggggggggg',
  '..gggggggggggg',
  '..gggggggggggg',
  '..gggggggggggg',
  '..gggggggggggg',
  '..gggggggggggg',
  '..gggggggggggg',
  '..gggggggggggg',
  '..gggggggggggg',
  '..gggggggggggg',
  '..gggggggggggg',
  '..gggggggggggg',
  '..gggggggggggg',
  '..gggggggggggg',
  '..gggggggggggg',
  '..gggggggggggg',
  '..gggggggggggg',
  '..gggggggggggg',
  '..gggggggggggg',
  '..gggggggggggg',
  '..gggggggggggg',
  '..gggggggggggg',
  '..gggggggggggg',
  '..gggggggggggg',
  '.ggggggggggggg',
  'gggggggggggggg',
  'yyyyyyyyyyyyyy',
  'yyyyyyyyyyyyyy',
];

// ---------------------------------------------------------------- Loot & props
const COIN_PAL = { y: '#F5D45A', g: '#C9973F', w: '#FFF3C4' };
const COIN = [
  '...gggggg...',
  '..gyyyyyyg..',
  '.gyyyyyyyyg.',
  '.gyywyyyyyg.',
  'gyyyyyyyyyyg',
  'gyyyyyyyyyyg',
  'gyyyyyyyyyyg',
  'gyyyyyyyyyyg',
  '.gyyyyyyyyg.',
  '.gyyyyyyyyg.',
  '..gyyyyyyg..',
  '...gggggg...',
];

const HEART_PAL = { r: '#E94F62', w: '#FFB3C0' };
const HEART = [
  '.rrrr..rrrr.',
  'rwrrrrrrrrrr',
  'rrrrrrrrrrrr',
  'rrrrrrrrrrrr',
  'rrrrrrrrrrrr',
  '.rrrrrrrrrr.',
  '..rrrrrrrr..',
  '...rrrrrr...',
  '....rrrr....',
  '.....rr.....',
  '............',
  '............',
];

const SHARD_PAL = { c: '#35C9D0', w: '#D8FBFF' };
const SHARD = [
  '.....cc.....',
  '....cccc....',
  '...cwcccc...',
  '..cccccccc..',
  '..cccccccc..',
  '..cccccccc..',
  '..cccccccc..',
  '...cccccc...',
  '....cccc....',
  '.....cc.....',
  '............',
  '............',
];

const CHEST_PAL = { b: '#8A5A33', y: '#FFD76A', d: '#6B4226' };
const CHEST = [
  '....bbbbbbbb....',
  '...bbbbbbbbbb...',
  '..bbbbbbbbbbbb..',
  '..byyyyyyyyyyb..',
  '..byyyyyyyyyyb..',
  '..byyyyyyyyyyb..',
  '..bbbbbbbbbbbb..',
  '..bddddddddddb..',
  '..bddddddddddb..',
  '..bddddddddddb..',
  '..bddddddddddb..',
  '..bddddddddddb..',
  '..bbbbbbbbbbbb..',
  '...bbbbbbbbbb...',
  '....bbbbbbbb....',
  '................',
];

const STATUE_PAL = { s: '#9A8FBF', g: '#FFD76A' };
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
  const neriA = bake([...NERI_BODY, ...NERI_LEGS_A], NERI_PAL);
  const neriB = bake([...NERI_BODY, ...NERI_LEGS_B], NERI_PAL);
  const bell = bakeMirror(BELL_HALF, BELL_PAL);
  // Tiny face inside the bell: two dark eyes and a small mouth.
  const bg = bell.getContext('2d');
  bg.fillStyle = '#173F35';
  bg.fillRect(17, 22, 4, 5);
  bg.fillRect(27, 22, 4, 5);
  bg.fillRect(21, 30, 6, 2);
  return {
    neri: [neriA, neriB],
    lantern: bake(LANTERN, LANTERN_PAL),
    moth: [bake(MOTH_A, MOTH_PAL), bake(MOTH_B, MOTH_PAL)],
    puffcap: bake(PUFF, PUFF_PAL),
    tinket: bake(TINK, TINK_PAL),
    brambler: bake(BRAM, BRAM_PAL),
    bell,
    bellWhite: whiteOf(bell),
    coin: bake(COIN, COIN_PAL),
    heart: bake(HEART, HEART_PAL),
    shard: bake(SHARD, SHARD_PAL),
    chest: bake(CHEST, CHEST_PAL),
    statue: bake(STATUE, STATUE_PAL),
  };
}
