// Mosslight — open field (2400x1800): no dungeon, walls, or void. Enemies
// spawn at the camera edge and walk straight at Neri; decor has no
// Edge is a tree line, never a wall. Deterministic (mulberry32).

import { FIELD_W, FIELD_H } from './config.js';
import { makeRng } from './random.js';

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// FNV-1a hash of the field scatter (determinism summary).
export function hashField(f) {
  let h = 0x811c9dc5;
  const mix = (n) => {
    h ^= n & 0xff;
    h = Math.imul(h, 0x01000193);
    h ^= (n >> 8) & 0xff;
    h = Math.imul(h, 0x01000193);
  };
  for (const p of [...f.chests, ...f.statues, ...f.pickups]) { mix(p.x | 0); mix(p.y | 0); }
  return (h >>> 0).toString(16).padStart(8, '0');
}

// Clamp a point inside the field (soft edge, no wall).
export function clampField(x, y, r) {
  return { x: clamp(x, r, FIELD_W - r), y: clamp(y, r, FIELD_H - r) };
}

// Move by (dx, dy), clamped to the field (no walls to slide along).
export function moveField(x, y, r, dx, dy) {
  return clampField(x + dx, y + dy, r);
}

// Spawn point: a random direction, minDist..minDist+260 px from the player.
export function spawnPoint(rng, px, py, minDist) {
  const u = rng.unit();
  const d = minDist + rng.range(0, 260);
  return clampField(px + u.x * d, py + u.y * d, 24);
}

// Scatter n points in the field, at least minR px from the centre spawn.
function scatter(rng, n, minR) {
  const cx = FIELD_W / 2, cy = FIELD_H / 2;
  const out = [];
  for (let i = 0; i < n; i++) {
    let x = cx, y = cy;
    for (let t = 0; t < 8; t++) {
      x = rng.range(80, FIELD_W - 80);
      y = rng.range(80, FIELD_H - 80);
      if (Math.hypot(x - cx, y - cy) >= minR) break;
    }
    out.push({ x, y });
  }
  return out;
}

// Chests 3, statues 3, gems 8, coin piles 10, hearts 6.
export function generateField(seed) {
  const rng = makeRng(seed);
  const chests = scatter(rng, 3, 220).map((p) => ({ ...p, opened: false }));
  const statues = scatter(rng, 3, 260).map((p) => ({ ...p, used: false, channel: 0 }));
  const pickups = [];
  for (const p of scatter(rng, 8, 180)) pickups.push({ ...p, kind: 'gem', taken: false });
  for (const p of scatter(rng, 10, 150)) pickups.push({ ...p, kind: 'coins', taken: false });
  for (const p of scatter(rng, 6, 150)) pickups.push({ ...p, kind: 'heart', taken: false });
  const field = { seed, chests, statues, pickups, spawn: { x: FIELD_W / 2, y: FIELD_H / 2 } };
  field.hash = hashField(field);
  return field;
}
