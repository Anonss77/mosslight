// Mosslight v2 — decor: deterministic dungeon dressing (Astra spec §2, §5, §6).
// All placement uses dedicated seeded RNG streams — never the run RNG and
// never Math.random — so the same seed always dresses the same dungeon.
// Static props are painted into the baked layer per area (the whole map
// re-skins per area, like the existing palette swap). Interactive props
// are baked to small sprites and drawn dynamically so they can react.
// Ambient particles are pooled (global cap 64) and visual-only.

import { TILE, DUN_W, DUN_H, SCALE, AREAS } from './config.js';
import { Rng } from './random.js';

// Fill a rect in WORLD pixels on a canvas that is scaled by SCALE.
function px(g, x, y, w, h, c) {
  g.fillStyle = c;
  g.fillRect(Math.round(x * SCALE), Math.round(y * SCALE), Math.max(1, Math.round(w * SCALE)), Math.max(1, Math.round(h * SCALE)));
}
function pxA(g, x, y, w, h, c, a) {
  g.globalAlpha = a;
  px(g, x, y, w, h, c);
  g.globalAlpha = 1;
}

// ------------------------------------------------------------------ area kits
// Floor variants: one seeded roll per floor tile -> variant by thresholds.
export const FLOOR_VARIANTS = [
  // Bloomroot
  [
    { upto: 0.18, paint: bloomRootHair },
    { upto: 0.32, paint: bloomMossFleck },
    { upto: 0.41, paint: bloomPetal },
    { upto: 0.49, paint: bloomSoilSeam },
  ],
  // Cinderglass
  [
    { upto: 0.17, paint: cinderForgeTile },
    { upto: 0.27, paint: cinderGlassShard },
    { upto: 0.40, paint: cinderSoot },
    { upto: 0.48, paint: cinderRivet },
  ],
  // Moonmilk
  [
    { upto: 0.18, paint: moonVein },
    { upto: 0.28, paint: moonLimeBloom },
    { upto: 0.42, paint: moonVioletInset },
    { upto: 0.50, paint: moonStarDust },
  ],
];

function bloomRootHair(g, x, y, rng) {
  const c = rng.chance(0.5) ? '#214C49' : '#2D7162';
  px(g, x + 2, y + 3, 6, 1, c); px(g, x + 8, y + 4, 5, 1, c);
  px(g, x + 4, y + 10, 7, 1, '#2D7162'); px(g, x + 11, y + 11, 3, 1, '#214C49');
}
function bloomMossFleck(g, x, y, rng) {
  px(g, x + 1, y + 1, 2, 1, '#6FCB73'); px(g, x + 12, y + 2, 2, 1, '#A7E68A');
  px(g, x + 3, y + 13, 2, 1, '#A7E68A'); px(g, x + 13, y + 12, 2, 1, '#6FCB73');
}
function bloomPetal(g, x, y) {
  px(g, x + 2, y + 2, 2, 2, '#F48FB1'); px(g, x + 4, y + 3, 2, 2, '#FFD2A6');
  px(g, x + 11, y + 11, 2, 2, '#F48FB1'); px(g, x + 12, y + 13, 2, 2, '#FFD2A6');
}
function bloomSoilSeam(g, x, y) {
  px(g, x + 2, y + 12, 4, 1, '#314951'); px(g, x + 6, y + 9, 4, 1, '#5C7468');
  px(g, x + 10, y + 6, 4, 1, '#314951');
}
function cinderForgeTile(g, x, y) {
  px(g, x + 2, y + 2, 12, 1, '#713B3C'); px(g, x + 2, y + 13, 12, 1, '#A95845');
  px(g, x + 2, y + 2, 1, 12, '#713B3C'); px(g, x + 13, y + 2, 1, 12, '#A95845');
}
export function cinderGlassShard(g, x, y) {
  px(g, x + 3, y + 4, 2, 2, '#65D5D5'); px(g, x + 9, y + 9, 2, 2, '#B2FFFF');
  px(g, x + 6, y + 12, 2, 2, '#65D5D5');
}
function cinderSoot(g, x, y) {
  pxA(g, x + 4, y + 5, 8, 6, '#422C3B', 0.55);
  pxA(g, x + 6, y + 3, 4, 3, '#422C3B', 0.55);
}
function cinderRivet(g, x, y) {
  px(g, x + 3, y + 3, 2, 2, '#E7B35A'); px(g, x + 11, y + 11, 2, 2, '#E7B35A');
  px(g, x + 5, y + 5, 6, 1, '#9C6A45');
}
function moonVein(g, x, y, rng) {
  px(g, x + 2, y + 8, 5, 1, '#C7D8FF'); px(g, x + 7, y + 7, 4, 1, '#A9B4FF');
  px(g, x + 11, y + 8, 3, 1, '#C7D8FF');
  if (rng.chance(0.5)) { px(g, x + 5, y + 3, 1, 4, '#A9B4FF'); px(g, x + 10, y + 11, 1, 3, '#C7D8FF'); }
}
function moonLimeBloom(g, x, y) {
  px(g, x + 2, y + 3, 2, 1, '#B7E36B'); px(g, x + 11, y + 5, 2, 1, '#E3FF9A');
  px(g, x + 5, y + 12, 2, 1, '#E3FF9A'); px(g, x + 12, y + 11, 2, 1, '#B7E36B');
}
function moonVioletInset(g, x, y) {
  px(g, x + 5, y + 5, 6, 6, '#7357B8');
  px(g, x + 5, y + 5, 6, 1, '#A98BEA'); px(g, x + 5, y + 10, 6, 1, '#A98BEA');
  px(g, x + 5, y + 5, 1, 6, '#A98BEA'); px(g, x + 10, y + 5, 1, 6, '#A98BEA');
}
function moonStarDust(g, x, y) {
  px(g, x + 3, y + 4, 1, 1, '#FFFFFF'); px(g, x + 10, y + 3, 1, 1, '#D9F5FF');
  px(g, x + 6, y + 11, 1, 1, '#FFFFFF'); px(g, x + 12, y + 9, 2, 2, '#D9F5FF');
}

// Plain-floor highlight (kept from v1's speckle spirit).
// v3: two extra speckles at FIXED offsets (no extra RNG calls — the bake
// stream is untouched), so the floor texture reads at a glance.
export function plainFloorHighlight(g, x, y, areaIdx, rng) {
  const cols = ['#A7E68A', '#E7B35A', '#C7D8FF'];
  px(g, x + 3 + rng.int(0, 10), y + 3 + rng.int(0, 10), 1, 1, cols[areaIdx]);
  px(g, x + 11, y + 12, 1, 1, cols[areaIdx]);
  px(g, x + 12, y + 3, 1, 1, '#FFFFFF');
}

// ------------------------------------------------------------------ wall kits
export const WALL_KIT = [
  { // Bloomroot
    top: '#8FE8A8', face: '#1F4A44', low: '#122C32', side: '#10272E',
    growth: (g, x, y, rng) => {
      // Root growth: branching shape on 35% of wall sections.
      if (!rng.chance(0.35)) return;
      const c = rng.pick(['#2D7162', '#6FCB73', '#A7E68A']);
      const bx = x + rng.int(2, 10), by = y + rng.int(4, 10);
      px(g, bx, by, 1, rng.int(4, 8), c);
      px(g, bx + 1, by + 2, rng.int(2, 5), 1, c);
      px(g, bx - 2, by + 4, rng.int(2, 4), 1, '#6FCB73');
    },
    crack: (g, x, y, rng) => {
      if (!rng.chance(0.18)) return;
      px(g, x + rng.int(3, 12), y + rng.int(4, 12), 1, rng.int(3, 6), '#0C202A');
    },
    corner: (g, x, y) => { px(g, x + 10, y + 10, 6, 6, '#A7E68A'); px(g, x + 12, y + 12, 4, 4, '#6FCB73'); },
  },
  { // Cinderglass
    top: '#E7B35A', face: '#5C3644', low: '#2A2533', sideW: '#362438', sideS: '#211F2C',
    growth: (g, x, y, rng) => {
      if (!rng.chance(0.22)) return; // cyan glass growths
      const bx = x + rng.int(2, 10), by = y + rng.int(4, 10);
      const c = rng.chance(0.5) ? '#65D5D5' : '#B2FFFF';
      px(g, bx, by, 2, rng.int(3, 8), c);
      px(g, bx + 2, by + 2, 2, rng.int(2, 5), '#B2FFFF');
    },
    crack: (g, x, y, rng) => {
      const bx = x + rng.int(3, 10), by = y + rng.int(3, 10);
      px(g, bx, by, 1, rng.int(3, 6), '#1A1A28');
      px(g, bx + 1, by + 3, rng.int(2, 4), 1, '#1A1A28');
    },
    rust: (g, x, y, rng) => {
      if (!rng.chance(0.4)) return;
      px(g, x + rng.int(2, 13), y + 2, 1, rng.int(2, 5), '#C76542');
    },
    rivet: (g, x, y, rng) => {
      if (!rng.chance(0.3)) return;
      px(g, x + rng.int(2, 12), y + rng.int(2, 12), 2, 2, '#E7B35A');
    },
  },
  { // Moonmilk
    top: '#E3FF9A', face: '#6058AC', low: '#393B78', side: '#303566',
    growth: (g, x, y, rng) => {
      if (!rng.chance(0.42)) return; // crystal growths
      const bx = x + rng.int(2, 10), by = y + rng.int(4, 10);
      const c = rng.pick(['#A9B4FF', '#C7D8FF', '#D9F5FF']);
      px(g, bx, by, 2, rng.int(4, 10), c);
      px(g, bx + 2, by + 3, 1, rng.int(2, 6), '#D9F5FF');
    },
    crack: (g, x, y, rng) => {
      const bx = x + rng.int(3, 10), by = y + rng.int(3, 10);
      px(g, bx, by, 1, rng.int(3, 6), '#272A5A');
      px(g, bx, by + rng.int(3, 6), 1, 1, '#C7D8FF');
    },
    deposit: (g, x, y, rng) => {
      if (!rng.chance(0.30)) return;
      pxA(g, x + rng.int(0, 4), y + 12, 12, 3, '#B7E36B', 0.55);
    },
  },
];

// Wall-border depth colour per area (2px border on floor tiles by walls).
export const BORDER_COLOR = [
  ['#173B3D', 0.32], ['#2A2533', 0.36], ['#353A78', 0.28],
];

// ------------------------------------------------------------------ prop painters
// Each painter draws one prop at world (ox, oy) = top-left, on canvas g
// (already scaled by SCALE via px()). Sizes are world px per the spec.
const P = {};
// --- Bloomroot large
P.glowcap = (g, ox, oy) => {
  px(g, ox + 2, oy + 8, 4, 6, '#A7E68A'); px(g, ox + 12, oy + 8, 4, 6, '#A7E68A');
  px(g, ox + 1, oy + 2, 8, 6, '#F48FB1'); px(g, ox + 9, oy + 4, 8, 6, '#F48FB1');
  px(g, ox + 3, oy + 3, 3, 2, '#FFD2A6'); px(g, ox + 11, oy + 5, 3, 2, '#FFD2A6');
  px(g, ox + 1, oy + 13, 16, 1, '#214C49');
};
P.rootarch = (g, ox, oy) => {
  px(g, ox + 1, oy + 2, 5, 20, '#6FCB73'); px(g, ox + 26, oy + 2, 5, 20, '#6FCB73');
  px(g, ox + 4, oy + 1, 24, 5, '#6FCB73'); px(g, ox + 8, oy + 5, 16, 3, '#2D7162');
  px(g, ox + 1, oy + 1, 30, 1, '#183D3C'); px(g, ox + 12, oy + 6, 8, 2, '#A7E68A');
  px(g, ox, oy + 22, 32, 2, '#183D3C');
};
P.seedpod = (g, ox, oy) => {
  px(g, ox + 5, oy, 2, 8, '#2D7162');
  px(g, ox + 2, oy + 8, 8, 12, '#FFD2A6'); px(g, ox + 4, oy + 10, 4, 4, '#F48FB1');
  px(g, ox + 2, oy + 20, 8, 1, '#2D7162');
};
P.shrine = (g, ox, oy) => {
  px(g, ox + 4, oy + 8, 16, 18, '#5C7468'); px(g, ox + 6, oy + 6, 12, 4, '#5C7468');
  px(g, ox + 8, oy + 12, 8, 8, '#FFD2A6'); px(g, ox + 10, oy + 14, 4, 4, '#F48FB1');
  px(g, ox + 4, oy + 26, 16, 2, '#314951');
  px(g, ox + 2, oy + 4, 4, 4, '#F48FB1'); px(g, ox + 18, oy + 5, 4, 4, '#F48FB1');
};
// --- Bloomroot small
P.fern = (g, ox, oy) => {
  px(g, ox + 9, oy + 12, 2, 6, '#49B982');
  for (let i = 0; i < 5; i++) {
    px(g, ox + i * 3, oy + 10 - i, 3, 1, '#49B982');
    px(g, ox + 16 - i * 3, oy + 10 - i, 3, 1, '#49B982');
  }
  px(g, ox + 6, oy + 4, 3, 1, '#A7E68A'); px(g, ox + 12, oy + 5, 3, 1, '#A7E68A');
};
P.pond = (g, ox, oy) => {
  px(g, ox + 1, oy + 4, 28, 12, '#42B8B0');
  px(g, ox + 4, oy + 6, 10, 2, '#9BE7D2'); px(g, ox + 18, oy + 10, 8, 2, '#9BE7D2');
  px(g, ox, oy + 14, 30, 3, '#6B8064'); px(g, ox, oy + 3, 30, 1, '#6B8064');
};
P.petals = (g, ox, oy) => {
  px(g, ox, oy, 2, 2, '#F48FB1'); px(g, ox + 4, oy + 2, 2, 2, '#FFD2A6');
};
P.vine = (g, ox, oy) => {
  px(g, ox + 2, oy, 3, 28, '#2D7162'); px(g, ox + 9, oy + 4, 3, 26, '#6FCB73');
  px(g, ox + 5, oy + 8, 4, 2, '#6FCB73'); px(g, ox + 2, oy + 16, 4, 2, '#A7E68A');
};
// --- Cinderglass large
P.anvil = (g, ox, oy) => {
  px(g, ox + 2, oy + 2, 20, 5, '#75808B'); px(g, ox + 2, oy + 2, 20, 1, '#C6D2D1');
  px(g, ox + 9, oy + 7, 6, 7, '#75808B'); px(g, ox + 6, oy + 14, 12, 4, '#75808B');
  px(g, ox + 6, oy + 17, 12, 1, '#252837');
};
P.furnace = (g, ox, oy) => {
  px(g, ox + 2, oy, 16, 26, '#713B3C');
  px(g, ox + 5, oy + 12, 10, 12, '#FF714B'); px(g, ox + 7, oy + 15, 6, 7, '#FFD166');
  px(g, ox + 2, oy, 16, 2, '#E7B35A'); px(g, ox + 2, oy + 24, 16, 2, '#E7B35A');
};
P.pipes = (g, ox, oy) => {
  px(g, ox + 1, oy, 4, 32, '#B9664F'); px(g, ox + 6, oy + 2, 4, 30, '#B9664F');
  px(g, ox + 1, oy, 1, 32, '#E7B35A'); px(g, ox + 6, oy + 2, 1, 30, '#E7B35A');
  px(g, ox, oy + 8, 12, 2, '#713B3C'); px(g, ox, oy + 20, 12, 2, '#713B3C');
};
P.glassrack = (g, ox, oy) => {
  px(g, ox + 1, oy + 16, 26, 4, '#4A5661'); px(g, ox + 1, oy + 2, 26, 2, '#4A5661');
  px(g, ox + 3, oy + 6, 4, 10, '#65D5D5'); px(g, ox + 10, oy + 4, 5, 12, '#B2FFFF');
  px(g, ox + 18, oy + 7, 4, 9, '#65D5D5'); px(g, ox + 4, oy + 7, 2, 2, '#FFFFFF');
};
P.worktable = (g, ox, oy) => {
  px(g, ox + 1, oy + 2, 28, 8, '#75483F'); px(g, ox + 1, oy + 2, 28, 2, '#C28A45');
  px(g, ox + 3, oy + 10, 3, 6, '#75483F'); px(g, ox + 24, oy + 10, 3, 6, '#75483F');
  px(g, ox + 12, oy + 4, 5, 3, '#E7B35A');
};
// --- Cinderglass small
P.gearpile = (g, ox, oy) => {
  px(g, ox + 3, oy + 8, 8, 8, '#C28A45'); px(g, ox + 11, oy + 4, 6, 6, '#5A3A3B');
  px(g, ox + 5, oy + 10, 4, 4, '#5A3A3B'); px(g, ox + 12, oy + 5, 3, 3, '#E7B35A');
  px(g, ox + 2, oy + 16, 14, 2, '#5A3A3B');
};
P.chain = (g, ox, oy) => {
  for (let y = 0; y < 28; y += 4) { px(g, ox + 2, oy + y, 4, 2, y % 8 ? '#9C6A45' : '#E7B35A'); }
};
P.brazier = (g, ox, oy) => {
  px(g, ox + 2, oy + 10, 12, 6, '#713B3C');
  px(g, ox + 4, oy + 4, 8, 7, '#FF714B'); px(g, ox + 6, oy + 6, 4, 4, '#FFD166');
  px(g, ox + 5, oy + 16, 6, 2, '#2A2533');
};
// --- Moonmilk large
P.crystal = (g, ox, oy) => {
  px(g, ox + 4, oy + 8, 4, 16, '#A9B4FF'); px(g, ox + 9, oy + 2, 5, 22, '#D9F5FF');
  px(g, ox + 15, oy + 10, 4, 14, '#C7D8FF');
  px(g, ox + 10, oy + 4, 3, 3, '#FFFFFF'); px(g, ox + 5, oy + 10, 2, 2, '#FFFFFF');
  px(g, ox + 2, oy + 24, 18, 2, '#4F4D96');
};
P.moonpool = (g, ox, oy) => {
  px(g, ox + 1, oy + 5, 30, 12, '#B7E36B');
  px(g, ox + 5, oy + 7, 10, 3, '#E3FF9A'); px(g, ox + 20, oy + 11, 8, 2, '#FFFFFF');
  px(g, ox, oy + 16, 32, 3, '#7357B8');
};
P.obelisk = (g, ox, oy) => {
  px(g, ox + 5, oy + 2, 8, 30, '#7357B8'); px(g, ox + 7, oy + 4, 4, 26, '#A98BEA');
  px(g, ox + 8, oy + 8, 2, 8, '#D9F5FF'); px(g, ox + 3, oy + 30, 12, 3, '#4F4D96');
  px(g, ox + 5, oy, 8, 2, '#D9F5FF');
};
P.bridgemark = (g, ox, oy) => {
  px(g, ox + 1, oy + 4, 26, 6, '#A9B4FF'); px(g, ox + 4, oy + 2, 20, 2, '#D9F5FF');
  px(g, ox + 1, oy + 10, 26, 2, '#4F4D96');
};
// --- Moonmilk small
P.starflower = (g, ox, oy) => {
  px(g, ox + 7, oy + 10, 2, 8, '#8BCB8A');
  px(g, ox + 4, oy + 2, 8, 8, '#D9F5FF'); px(g, ox + 6, oy + 4, 4, 4, '#E3FF9A');
  px(g, ox + 7, oy + 1, 2, 2, '#FFFFFF');
};
P.rune = (g, ox, oy) => {
  px(g, ox + 4, oy + 2, 8, 12, '#C7D8FF');
  px(g, ox + 6, oy + 5, 4, 6, '#FFFFFF'); px(g, ox + 7, oy + 6, 2, 2, '#A98BEA');
  px(g, ox + 4, oy + 2, 8, 1, '#FFFFFF');
};
P.moonstone = (g, ox, oy) => {
  px(g, ox + 5, oy, 2, 6, '#7357B8');
  px(g, ox + 2, oy + 6, 8, 10, '#D9F5FF'); px(g, ox + 4, oy + 8, 4, 4, '#FFFFFF');
};
P.pebbles = (g, ox, oy) => {
  px(g, ox, oy, 2, 2, '#E3FF9A'); px(g, ox + 5, oy + 3, 2, 2, '#D9F5FF');
  px(g, ox + 2, oy + 6, 3, 2, '#E3FF9A');
};

// Kind tables per area: [large kinds, small kinds, interactive kinds].
// Interactive kinds are drawn dynamically (base sprite + reaction).
export const KIND_TABLE = [
  { large: ['glowcap', 'rootarch', 'seedpod', 'shrine'], small: ['fern', 'pond', 'petals', 'vine'], inter: ['flower', 'pot', 'vine'] },
  { large: ['anvil', 'furnace', 'pipes', 'glassrack', 'worktable'], small: ['gearpile', 'chain', 'brazier'], inter: ['brazier', 'rack', 'gear'] },
  { large: ['crystal', 'moonpool', 'obelisk', 'bridgemark'], small: ['starflower', 'rune', 'moonstone', 'pebbles'], inter: ['starflower', 'crystal', 'rune'] },
];
// Interactive base painters (drawn to a small sprite canvas, then drawn
// dynamically with rotation/glow). 'rack'/'gear' reuse static painters.
export const INTERACTIVE_PAINTERS = {
  flower: P.glowcap,
  pot: (g, ox, oy) => {
    px(g, ox + 1, oy + 2, 12, 10, '#8A5548'); px(g, ox + 1, oy + 2, 12, 2, '#D28A62');
    px(g, ox + 4, oy, 6, 3, '#6FCB73'); px(g, ox + 5, oy - 1, 2, 2, '#A7E68A');
    px(g, ox, oy + 12, 14, 2, '#342A37');
  },
  vine: (g, ox, oy) => {
    px(g, ox + 5, oy + 2, 6, 6, '#F48FB1'); px(g, ox + 6, oy + 3, 4, 4, '#FFF0A6');
    px(g, ox + 2, oy + 8, 2, 12, '#2D7162'); px(g, ox + 12, oy + 8, 2, 12, '#2D7162');
    px(g, ox + 4, oy, 8, 2, '#2D7162');
  },
  brazier: P.brazier,
  rack: P.glassrack,
  gear: P.gearpile,
  starflower: P.starflower,
  crystal: P.crystal,
  rune: P.rune,
};
// Interactive prop sizes (world px) per kind.
export const INTERACTIVE_SIZE = {
  flower: [18, 14], pot: [14, 14], vine: [16, 22],
  brazier: [16, 18], rack: [28, 22], gear: [20, 20],
  starflower: [16, 18], crystal: [22, 26], rune: [16, 16],
};
// Static prop sizes per kind (world px).
export const PROP_SIZE = {
  glowcap: [18, 14], rootarch: [32, 24], seedpod: [12, 22], shrine: [24, 28],
  fern: [20, 18], pond: [30, 18], petals: [6, 6], vine: [16, 30],
  anvil: [24, 18], furnace: [20, 26], pipes: [12, 32], glassrack: [28, 22], worktable: [30, 16],
  gearpile: [20, 20], chain: [8, 28], brazier: [16, 18],
  crystal: [22, 26], moonpool: [32, 20], obelisk: [18, 34], bridgemark: [28, 12],
  starflower: [16, 18], rune: [16, 16], moonstone: [12, 18], pebbles: [7, 8],
};

// ------------------------------------------------------------------ placement
function roomOf(dungeon, tx, ty) {
  for (const r of dungeon.rooms) {
    if (tx >= r.x && tx < r.x + r.w && ty >= r.y && ty < r.y + r.h) return r;
  }
  return null;
}
function dist2(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }

export function buildDecor(dungeon) {
  const rng = new Rng((dungeon.seed * 7919 + 104729) >>> 0);
  const rooms = dungeon.rooms.slice().sort((a, b) => (a.cy - b.cy) || (a.cx - b.cx));
  const start = dungeon.playerStart();
  const boss = dungeon.bossStart();
  // Route mask: tiles within 1 tile of the BFS path spawn -> boss.
  const route = new Set();
  const path = dungeon.findPath(start.x, start.y, boss.x, boss.y) || [];
  for (const n of path) {
    const tx = Math.floor(n.x / TILE), ty = Math.floor(n.y / TILE);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      route.add((ty + dy) * DUN_W + (tx + dx));
    }
  }
  const blocked = (x, y) => {
    if (dungeon.isWallPx(x, y)) return true;
    if (dist2(x, y, start.x, start.y) < 48 * 48) return true;
    if (dist2(x, y, boss.x, boss.y) < 80 * 80) return true;
    for (const c of dungeon.chests) if (dist2(x, y, c.x, c.y) < 24 * 24) return true;
    for (const s of dungeon.statues) if (dist2(x, y, s.x, s.y) < 24 * 24) return true;
    return false;
  };
  const inRoute = (x, y) => route.has(Math.floor(y / TILE) * DUN_W + Math.floor(x / TILE));

  const slots = { large: [], small: [], inter: [], fg: [] };
  const placedLarge = [];
  const tryPlace = (room, w, h, list, opts = {}) => {
    for (let t = 0; t < 12; t++) {
      const tx = room.x + 1 + rng.int(0, Math.max(1, room.w - 2));
      const ty = room.y + 1 + rng.int(0, Math.max(1, room.h - 2));
      const x = (tx + 0.5) * TILE + rng.range(-4, 4);
      const y = (ty + 0.5) * TILE + rng.range(-4, 4);
      if (blocked(x, y)) continue;
      if (inRoute(x, y)) continue;
      if (opts.bossRoom) {
        // Boss room: side decorations only, nothing in the central rect.
        if (Math.abs(x - boss.x) < 80 && Math.abs(y - boss.y) < 56) continue;
      }
      if (opts.large) {
        let ok = true;
        for (const p of placedLarge) {
          if (dist2(x, y, p.x, p.y) < (16 + Math.max(w, p.w)) ** 2) { ok = false; break; }
        }
        if (!ok) continue;
      }
      const slot = { x, y, w, h, room, seed: rng.int(0, 1e9) };
      list.push(slot);
      if (opts.large) placedLarge.push(slot);
      return slot;
    }
    return null;
  };

  for (const room of rooms) {
    const isStart = room === dungeon.start;
    const isBoss = room === dungeon.boss;
    const tiles = room.w * room.h;
    let nLarge, nSmall, nInter;
    if (isStart) { nLarge = 0; nSmall = rng.int(2, 4); nInter = 0; }
    else if (isBoss) { nLarge = rng.int(1, 3); nSmall = rng.int(4, 7); nInter = 1; }
    else if (tiles <= 30) { nLarge = 1; nSmall = rng.int(3, 6); nInter = 1; }
    else if (tiles <= 42) { nLarge = rng.int(1, 3); nSmall = rng.int(5, 8); nInter = rng.int(1, 3); }
    else if (tiles <= 56) { nLarge = 2; nSmall = rng.int(7, 11); nInter = 2; }
    else { nLarge = rng.int(2, 4); nSmall = rng.int(10, 15); nInter = rng.int(2, 4); }
    for (let i = 0; i < nLarge; i++) {
      const s = tryPlace(room, 28, 24, slots.large, { large: true, bossRoom: isBoss });
      if (s) s.fixedKind = null;
    }
    for (let i = 0; i < nSmall; i++) tryPlace(room, 10, 10, slots.small, { bossRoom: isBoss });
    for (let i = 0; i < nInter; i++) tryPlace(room, 18, 18, slots.inter, { bossRoom: isBoss });
    // Foreground edge tufts along the room's bottom interior edge.
    const nFg = rng.int(2, 5);
    for (let i = 0; i < nFg; i++) {
      const tx = room.x + rng.int(1, Math.max(2, room.w - 1));
      const ty = room.y + room.h - 2;
      const x = (tx + 0.5) * TILE, y = (ty + 0.5) * TILE;
      if (dungeon.isWallPx(x, y) || inRoute(x, y)) continue;
      slots.fg.push({ x, y, w: 10, h: 8, room, seed: rng.int(0, 1e9) });
    }
  }
  // One root shrine beside each buff statue (Bloomroot kind; other areas
  // re-skin the slot to their own large prop).
  for (const st of dungeon.statues) {
    const r = roomOf(dungeon, Math.floor(st.x / TILE), Math.floor(st.y / TILE));
    if (!r) continue;
    const x = st.x + 30, y = st.y;
    if (!dungeon.isWallPx(x, y) && !blocked(x, y) && !inRoute(x, y)) {
      slots.large.push({ x, y, w: 24, h: 28, room: r, seed: rng.int(0, 1e9), fixedKind: { 0: 'shrine' } });
    }
  }
  return { slots, seed: dungeon.seed };
}

// Kind for a slot in the given area (seeded, stable per slot+area).
export function kindFor(slot, areaIdx, table) {
  if (slot.fixedKind && slot.fixedKind[areaIdx]) return slot.fixedKind[areaIdx];
  const kinds = KIND_TABLE[areaIdx][table];
  return kinds[Math.abs(slot.seed) % kinds.length];
}

// Paint static props for one area into the bake canvas.
export function paintDecorStatic(g, dungeon, areaIdx, decor) {
  const { slots } = decor;
  for (const s of slots.large) {
    const kind = kindFor(s, areaIdx, 'large');
    const paint = P[kind];
    if (paint) paint(g, s.x - PROP_SIZE[kind][0] / 2, s.y - PROP_SIZE[kind][1] / 2);
  }
  for (const s of slots.small) {
    let kind = kindFor(s, areaIdx, 'small');
    // Small ponds never appear in the start or boss room.
    if (kind === 'pond' && (s.room === dungeon.start || s.room === dungeon.boss)) kind = 'fern';
    const paint = P[kind];
    if (paint) paint(g, s.x - PROP_SIZE[kind][0] / 2, s.y - PROP_SIZE[kind][1] / 2);
  }
  // Foreground edge tufts (drawn in the static layer, characters pass
  // in front of them because they are baked behind the entities).
  for (const s of slots.fg) {
    const fg = areaIdx === 0 ? fgGrass : areaIdx === 1 ? fgScrap : fgCrystal;
    fg(g, s.x - 5, s.y - 4, s.seed);
  }
}
function fgGrass(g, x, y, seed) {
  const n = 3 + (seed % 3);
  for (let i = 0; i < n; i++) px(g, x + i * 3, y + 6 - (i % 2) * 3, 2, 6 - (i % 2) * 2, i % 2 ? '#A7E68A' : '#6FCB73');
}
function fgScrap(g, x, y, seed) {
  px(g, x, y + 4, 6, 4, '#2A2533'); px(g, x + 7, y + 2, 3, 6, '#362438');
  if (seed % 2) px(g, x + 3, y, 2, 4, '#E7B35A');
}
function fgCrystal(g, x, y, seed) {
  px(g, x, y + 2, 2, 6, '#A9B4FF'); px(g, x + 4, y, 2, 8, '#D9F5FF');
  px(g, x + 8, y + 3, 2, 5, '#C7D8FF');
}

// ------------------------------------------------------------------ vignette
export function makeVignette(edgeAlpha) {
  const c = document.createElement('canvas');
  c.width = 1280; c.height = 720;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(640, 360, 280, 640, 360, 540);
  grad.addColorStop(0, 'rgba(37,35,77,0)');
  grad.addColorStop(1, `rgba(37,35,77,${edgeAlpha})`);
  g.fillStyle = grad;
  g.fillRect(0, 0, 1280, 720);
  return c;
}

// ------------------------------------------------------------------ ambient particles
export const AMBIENT_DEFS = [
  [ // Bloomroot
    { max: 18, colors: ['#FFF0A6', '#A7E68A'], speed: [4, 9], life: [1.8, 3.2], size: [1, 2], vy: 0 },
    { max: 22, colors: ['#F48FB1', '#B7E36B'], speed: [3, 6], life: [1.2, 2.4], size: [1, 1], vy: -1 },
    { max: 8, colors: ['#F48FB1', '#FFD2A6'], speed: [8, 14], life: [1.5, 2.5], size: [2, 2], vy: 1 },
  ],
  [ // Cinderglass
    { max: 24, colors: ['#FF714B', '#FFB347', '#FFD166'], speed: [10, 28], life: [0.4, 1.1], size: [1, 2], vy: -1 },
    { max: 8, colors: ['#B2FFFF', '#D5E8E8'], speed: [4, 7], life: [1.2, 2.0], size: [2, 3], rect: [3, 2], vy: -1, alpha: 0.38 },
    { max: 12, colors: ['#8C6D6B', '#B38B7E'], speed: [3, 8], life: [1.0, 1.8], size: [1, 1], vy: 0 },
  ],
  [ // Moonmilk
    { max: 20, colors: ['#D9F5FF', '#C7D8FF'], speed: [2, 5], life: [2.0, 3.8], size: [1, 2], vy: 0 },
    { max: 12, colors: ['#E3FF9A', '#B7E36B'], speed: [3, 6], life: [1.5, 2.8], size: [1, 1], vy: 0 },
    { max: 8, colors: ['#FFFFFF'], speed: [0, 0], life: [0.7, 1.4], size: [1, 2], vy: 0, twinkle: true },
  ],
];

export class Ambient {
  constructor(seed) {
    this.rng = new Rng((seed ^ 0x9e3779b9) >>> 0);
    this.list = [];
    this.area = -1;
    this.spawnT = 0;
  }
  setArea(area) {
    if (area !== this.area) { this.area = area; this.list.length = 0; }
  }
  update(dt, px, py) {
    const defs = AMBIENT_DEFS[this.area] || [];
    this.spawnT -= dt;
    if (this.spawnT <= 0 && this.list.length < 64) {
      this.spawnT = 0.08;
      const d = defs[this.rng.int(0, defs.length)];
      const cur = this.list.filter((p) => p.def === d).length;
      if (cur < d.max) {
        const sp = this.rng.range(d.speed[0], d.speed[1]);
        const a = this.rng.float() * Math.PI * 2;
        const sz = this.rng.int(d.size[0], d.size[1] + 1);
        const wh = d.rect || [sz, sz];
        this.list.push({
          def: d,
          x: px + this.rng.range(-320, 320), y: py + this.rng.range(-200, 200),
          vx: Math.cos(a) * sp, vy: d.vy ? d.vy * sp : Math.sin(a) * sp * 0.5,
          life: this.rng.range(d.life[0], d.life[1]),
          maxLife: 0, w: wh[0], h: wh[1],
          color: d.colors[this.rng.int(0, d.colors.length)],
        });
        const p = this.list[this.list.length - 1];
        p.maxLife = p.life;
      }
    }
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) this.list.splice(i, 1);
    }
  }
  render(g, X, Y) {
    for (const p of this.list) {
      let a = Math.max(0, p.life / p.maxLife);
      if (p.def.twinkle) a = p.life > p.maxLife - 0.15 ? (p.maxLife - p.life) / 0.15 : p.life < 0.25 ? p.life / 0.25 : 1;
      g.globalAlpha = a * (p.def.alpha || 1);
      g.fillStyle = p.color;
      g.fillRect(X(p.x) - p.w, Y(p.y) - p.h, p.w * 2, p.h * 2);
    }
    g.globalAlpha = 1;
  }
}

// ------------------------------------------------------------------ interactive sprites
// Bake one small sprite per interactive kind per area (drawn dynamically
// so reactions can rotate/glow them). Returned as {areaIdx: {kind: canvas}}.
export function bakeInteractiveSprites() {
  const out = [];
  for (let a = 0; a < 3; a++) {
    out[a] = {};
    for (const kind of KIND_TABLE[a].inter) {
      const [w, h] = INTERACTIVE_SIZE[kind];
      const c = document.createElement('canvas');
      c.width = (w + 8) * SCALE; c.height = (h + 8) * SCALE;
      const g = c.getContext('2d');
      g.imageSmoothingEnabled = false;
      // Painters take world coords on a SCALE canvas; offset by the pad.
      const paint = INTERACTIVE_PAINTERS[kind];
      if (paint) {
        // Temporarily draw with an origin shift: painters use px() which
        // multiplies by SCALE, so call with local coords + pad.
        paint(g, 4, 4);
      }
      out[a][kind] = c;
    }
  }
  return out;
}
