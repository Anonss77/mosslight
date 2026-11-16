// Mosslight — dungeon generation. A 48x36 tile dungeon built with BSP:
// the map is split into 12 leaves, one room per leaf, rooms joined by
// L-shaped corridors (minimum spanning tree over room centres). The layout
// is flood-fill checked for connectivity; a bad layout retries with the
// next seed value. All randomness comes from the run's seeded RNG, so the
// same seed always builds the same dungeon.

import { DUN_W, DUN_H, TILE, WORLD_W, WORLD_H, SCALE, AREAS } from './config.js';
import { Rng } from './random.js';

const WALL = 1;
const FLOOR = 0;

// Simple FNV-1a hash of the tile grid (determinism summary).
function hashTiles(tiles) {
  let h = 0x811c9dc5;
  for (let i = 0; i < tiles.length; i++) {
    h ^= tiles[i];
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

export class Dungeon {
  constructor(seed) {
    this.seed = seed;
    this.rng = new Rng(seed);
    this.build();
  }

  build() {
    // Retry loop: a layout that fails the flood-fill check rebuilds with
    // the next seed value (still deterministic for a given start seed).
    let tries = 0;
    while (true) {
      const rng = new Rng(this.seed + tries * 7919);
      const d = this.tryBuild(rng);
      if (d) { Object.assign(this, d); this.tries = tries; return; }
      tries++;
      if (tries > 50) throw new Error('dungeon: no connected layout found');
    }
  }

  tryBuild(rng) {
    const tiles = new Uint8Array(DUN_W * DUN_H).fill(WALL);
    const at = (x, y) => tiles[y * DUN_W + x];
    const set = (x, y, v) => { tiles[y * DUN_W + x] = v; };

    // --- BSP: split the map into 12 leaves.
    const leaves = [{ x: 1, y: 1, w: DUN_W - 2, h: DUN_H - 2 }];
    while (leaves.length < 12) {
      // Split the largest leaf.
      let bi = 0;
      for (let i = 1; i < leaves.length; i++) {
        if (leaves[i].w * leaves[i].h > leaves[bi].w * leaves[bi].h) bi = i;
      }
      const leaf = leaves.splice(bi, 1)[0];
      const vertical = leaf.w > leaf.h ? true : leaf.h > leaf.w ? false : rng.chance(0.5);
      if (vertical && leaf.w >= 12) {
        const cut = rng.int(6, leaf.w - 5);
        leaves.push({ x: leaf.x, y: leaf.y, w: cut, h: leaf.h });
        leaves.push({ x: leaf.x + cut, y: leaf.y, w: leaf.w - cut, h: leaf.h });
      } else if (!vertical && leaf.h >= 12) {
        const cut = rng.int(6, leaf.h - 5);
        leaves.push({ x: leaf.x, y: leaf.y, w: leaf.w, h: cut });
        leaves.push({ x: leaf.x, y: leaf.y + cut, w: leaf.w, h: leaf.h - cut });
      } else {
        leaves.push(leaf);
        break; // cannot split further; accept fewer leaves
      }
    }

    // --- One room per leaf, inset by at least 1 tile.
    const rooms = [];
    for (const leaf of leaves) {
      const rw = Math.min(rng.int(5, 10), leaf.w - 2);
      const rh = Math.min(rng.int(5, 9), leaf.h - 2);
      if (rw < 4 || rh < 4) continue;
      const rx = leaf.x + rng.int(1, Math.max(2, leaf.w - rw));
      const ry = leaf.y + rng.int(1, Math.max(2, leaf.h - rh));
      const room = { x: rx, y: ry, w: rw, h: rh, cx: rx + (rw >> 1), cy: ry + (rh >> 1) };
      rooms.push(room);
      for (let y = ry; y < ry + rh; y++) for (let x = rx; x < rx + rw; x++) set(x, y, FLOOR);
    }
    if (rooms.length < 8) return null;

    // --- Start room (southwest: low x, high y) and boss room (northeast).
    let start = rooms[0], boss = rooms[0];
    for (const r of rooms) {
      if (r.cx - r.cy < start.cx - start.cy) start = r;
      if (r.cx - r.cy > boss.cx - boss.cy) boss = r;
    }
    start.w = Math.max(start.w, 9); start.h = Math.max(start.h, 8);
    boss.w = Math.max(boss.w, 12); boss.h = Math.max(boss.h, 10);
    // Re-carve the enlarged rooms (they may overlap walls).
    const carve = (r) => { for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (x > 0 && y > 0 && x < DUN_W - 1 && y < DUN_H - 1) set(x, y, FLOOR); };
    carve(start); carve(boss);
    start.cx = start.x + (start.w >> 1); start.cy = start.y + (start.h >> 1);
    boss.cx = boss.x + (boss.w >> 1); boss.cy = boss.y + (boss.h >> 1);

    // --- Connect rooms: minimum spanning tree over centres, L corridors.
    const connected = [rooms[0]];
    const rest = rooms.slice(1);
    const corridor = (ax, ay, bx, by) => {
      const carveH = (x0, x1, y) => { for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) for (let dy = -1; dy <= 1; dy++) if (y + dy > 0 && y + dy < DUN_H - 1 && x > 0 && x < DUN_W - 1) set(x, y + dy, FLOOR); };
      const carveV = (y0, y1, x) => { for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) for (let dx = -1; dx <= 1; dx++) if (x + dx > 0 && x + dx < DUN_W - 1 && y > 0 && y < DUN_H - 1) set(x + dx, y, FLOOR); };
      if (rng.chance(0.5)) { carveH(ax, bx, ay); carveV(ay, by, bx); }
      else { carveV(ay, by, ax); carveH(ax, bx, by); }
    };
    while (rest.length) {
      let best = null, bestD = Infinity, bestFrom = null;
      for (const r of rest) for (const c of connected) {
        const d = (r.cx - c.cx) ** 2 + (r.cy - c.cy) ** 2;
        if (d < bestD) { bestD = d; best = r; bestFrom = c; }
      }
      corridor(bestFrom.cx, bestFrom.cy, best.cx, best.cy);
      connected.push(best);
      rest.splice(rest.indexOf(best), 1);
    }

    // --- Cave patches: 4 random rooms get a blobby moss patch (walkable).
    const caveRooms = rng.shuffle(rooms.slice()).slice(0, 4);
    const caveTiles = new Set();
    for (const room of caveRooms) {
      let cx = room.x + rng.int(1, room.w - 1);
      let cy = room.y + rng.int(1, room.h - 1);
      for (let i = 0; i < 10; i++) {
        caveTiles.add(cy * DUN_W + cx);
        cx += rng.int(-1, 2); cy += rng.int(-1, 2);
        cx = Math.max(room.x, Math.min(room.x + room.w - 1, cx));
        cy = Math.max(room.y, Math.min(room.y + room.h - 1, cy));
      }
    }

    // --- Flood-fill connectivity from the start room centre.
    const seen = new Uint8Array(DUN_W * DUN_H);
    const stack = [[start.cx, start.cy]];
    seen[start.cy * DUN_W + start.cx] = 1;
    while (stack.length) {
      const [x, y] = stack.pop();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= DUN_W || ny >= DUN_H) continue;
        if (at(nx, ny) !== FLOOR || seen[ny * DUN_W + nx]) continue;
        seen[ny * DUN_W + nx] = 1;
        stack.push([nx, ny]);
      }
    }
    for (const r of rooms) {
      if (!seen[r.cy * DUN_W + r.cx]) return null;
    }

    // --- Area assignment: rooms sorted by distance from start, in thirds.
    const byDist = rooms.slice().sort((a, b) => {
      const da = (a.cx - start.cx) ** 2 + (a.cy - start.cy) ** 2;
      const db = (b.cx - start.cx) ** 2 + (b.cy - start.cy) ** 2;
      return da - db;
    });
    const third = Math.ceil(rooms.length / 3);
    byDist.forEach((r, i) => { r.area = i < third ? 0 : i < third * 2 ? 1 : 2; });
    start.area = 0; boss.area = 2;

    // --- Chests: first three rooms from the start (excluding start).
    const chests = byDist.slice(1, 4).map((r) => ({
      x: (r.cx + 0.5) * TILE, y: (r.cy + 0.5) * TILE,
      coins: rng.int(4, 9), opened: false,
    }));
    // --- Buff statues: one per area, in a non-start, non-boss room.
    const statues = [];
    for (let a = 0; a < 3; a++) {
      const cands = rooms.filter((r) => r.area === a && r !== start && r !== boss);
      if (!cands.length) continue;
      const r = rng.pick(cands);
      statues.push({ x: (r.cx + 0.5) * TILE, y: (r.cy + 0.5) * TILE, used: false, area: a });
    }

    return { tiles, rooms, start, boss, chests, statues, caveTiles, hash: hashTiles(tiles), rng };
  }

  isWallPx(wx, wy) {
    const tx = Math.floor(wx / TILE), ty = Math.floor(wy / TILE);
    if (tx < 0 || ty < 0 || tx >= DUN_W || ty >= DUN_H) return true;
    return this.tiles[ty * DUN_W + tx] === WALL;
  }

  // Line of sight: true when no wall tile lies on the segment (sampled
  // every 8px). Projectiles die on walls, so a bolt fired without line of
  // sight never reaches its target.
  hasLineOfSight(x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const dist = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.ceil(dist / 8));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (this.isWallPx(x1 + dx * t, y1 + dy * t)) return false;
    }
    return true;
  }

  // Circle (x, y, r) vs wall tiles: true if the circle overlaps a wall.
  hitsWall(x, y, r) {
    const x0 = Math.floor((x - r) / TILE), x1 = Math.floor((x + r) / TILE);
    const y0 = Math.floor((y - r) / TILE), y1 = Math.floor((y + r) / TILE);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      if (tx < 0 || ty < 0 || tx >= DUN_W || ty >= DUN_H) return true;
      if (this.tiles[ty * DUN_W + tx] === WALL) {
        // Closest point on the tile to the circle centre.
        const cx = Math.max(tx * TILE, Math.min(x, tx * TILE + TILE));
        const cy = Math.max(ty * TILE, Math.min(y, ty * TILE + TILE));
        if ((x - cx) ** 2 + (y - cy) ** 2 < r * r) return true;
      }
    }
    return false;
  }

  // BFS path on the tile grid (floor tiles only). Returns an array of
  // world-space waypoints (tile centres) from (x0,y0) to (x1,y1), or null
  // when unreachable. The grid is tiny (48x36), so this is cheap.
  findPath(x0, y0, x1, y1) {
    const sx = Math.floor(x0 / TILE), sy = Math.floor(y0 / TILE);
    const tx = Math.floor(x1 / TILE), ty = Math.floor(y1 / TILE);
    if (sx === tx && sy === ty) return [];
    const start = sy * DUN_W + sx, target = ty * DUN_W + tx;
    if (this.tiles[target] === WALL) return null;
    const prev = new Int16Array(DUN_W * DUN_H).fill(-1);
    prev[start] = start;
    const q = [start];
    let head = 0;
    while (head < q.length) {
      const cur = q[head++];
      if (cur === target) break;
      const cx = cur % DUN_W, cy = (cur / DUN_W) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= DUN_W || ny >= DUN_H) continue;
        const ni = ny * DUN_W + nx;
        if (prev[ni] !== -1 || this.tiles[ni] === WALL) continue;
        prev[ni] = cur;
        q.push(ni);
      }
    }
    if (prev[target] === -1) return null;
    const path = [];
    let cur = target;
    while (cur !== start) {
      path.push({ x: (cur % DUN_W + 0.5) * TILE, y: (((cur / DUN_W) | 0) + 0.5) * TILE });
      cur = prev[cur];
    }
    path.reverse();
    return path;
  }

  // Random spawn point in a room of the given area, at least minDist from (px, py).
  // Biases toward the NEAREST qualifying room so the action stays near the player.
  spawnPoint(area, px, py, minDist) {
    const rng = this.rng;
    const rooms = this.rooms.filter((r) => r.area === area);
    const pool = rooms.length ? rooms : this.rooms;
    let best = null, bestD = Infinity;
    for (let i = 0; i < 8; i++) {
      const r = rng.pick(pool);
      const x = (r.x + 1 + rng.float() * (r.w - 2)) * TILE;
      const y = (r.y + 1 + rng.float() * (r.h - 2)) * TILE;
      const d = (x - px) ** 2 + (y - py) ** 2;
      if (d >= minDist * minDist && d < bestD) { bestD = d; best = { x, y }; }
    }
    if (best) return best;
    // Fallback: anywhere in the boss room's far corner.
    return { x: (this.boss.cx + 0.5) * TILE, y: (this.boss.cy + 0.5) * TILE };
  }

  playerStart() {
    return { x: (this.start.cx + 0.5) * TILE, y: (this.start.cy + 0.5) * TILE };
  }

  bossStart() {
    return { x: (this.boss.cx + 0.5) * TILE, y: (this.boss.cy + 0.5) * TILE };
  }

  // Boss spawn near the player: a point ~200px along the BFS path from
  // the player toward the boss room, so the final fight starts as a duel,
  // not a maze chase. The boss room is far from where the player usually
  // ends wave 7, and a 50s boss timer does not leave room for both sides
  // to cross the dungeon before the fight even starts. The path is all
  // floor, so the point is always valid and reachable. Falls back to the
  // boss room when the path is too short to walk 200px along.
  bossSpawnNear(px, py) {
    const path = this.findPath(px, py, (this.boss.cx + 0.5) * TILE, (this.boss.cy + 0.5) * TILE);
    if (path && path.length > 1) {
      let dist = 0, prev = { x: px, y: py };
      for (const node of path) {
        dist += Math.hypot(node.x - prev.x, node.y - prev.y);
        if (dist >= 200) return { x: node.x, y: node.y };
        prev = node;
      }
    }
    return this.bossStart();
  }

  summary() {
    return {
      seed: this.seed, tries: this.tries, hash: this.hash,
      rooms: this.rooms.map((r) => [r.x, r.y, r.w, r.h, r.area]),
      chests: this.chests.map((c) => [Math.round(c.x), Math.round(c.y), c.coins]),
      statues: this.statues.map((s) => [Math.round(s.x), Math.round(s.y), s.area]),
    };
  }
}

// Bake one area's static layer (floors, walls, decor) to an offscreen
// canvas at SCALE, so each frame only blits it. Speckles use the run RNG
// (deterministic per seed).
export function bakeLayer(dungeon, areaIdx) {
  const pal = AREAS[areaIdx];
  const c = document.createElement('canvas');
  c.width = WORLD_W * SCALE; c.height = WORLD_H * SCALE;
  const g = c.getContext('2d');
  const rng = new Rng(dungeon.seed * 31 + areaIdx * 101);
  g.imageSmoothingEnabled = false;

  for (let ty = 0; ty < DUN_H; ty++) {
    for (let tx = 0; tx < DUN_W; tx++) {
      const t = dungeon.tiles[ty * DUN_W + tx];
      const px = tx * TILE * SCALE, py = ty * TILE * SCALE, s = TILE * SCALE;
      if (t === WALL) {
        g.fillStyle = pal.wall;
        g.fillRect(px, py, s, s);
        // Top highlight where a wall meets floor below.
        if (ty + 1 < DUN_H && dungeon.tiles[(ty + 1) * DUN_W + tx] === FLOOR) {
          g.fillStyle = pal.highlight;
          g.fillRect(px, py + s - 4, s, 4);
        }
        g.fillStyle = pal.outline;
        g.fillRect(px, py, s, 2);
      } else {
        const cave = dungeon.caveTiles.has(ty * DUN_W + tx);
        g.fillStyle = cave ? pal.moss : pal.floor;
        g.fillRect(px, py, s, s);
        // Speckles: moss dots, flowers, water patches.
        const roll = rng.float();
        if (roll < 0.06) {
          g.fillStyle = pal.moss;
          g.fillRect(px + 6, py + 8, 8, 6);
          g.fillRect(px + 18, py + 20, 6, 5);
        } else if (roll < 0.09) {
          g.fillStyle = pal.flower;
          g.fillRect(px + 12, py + 10, 8, 8);
          g.fillStyle = pal.highlight;
          g.fillRect(px + 14, py + 12, 4, 4);
        } else if (roll < 0.11) {
          g.fillStyle = pal.water;
          g.fillRect(px + 4, py + 6, 24, 18);
          g.fillStyle = pal.highlight;
          g.fillRect(px + 8, py + 10, 10, 3);
        } else if (roll < 0.13) {
          g.fillStyle = pal.loot;
          g.fillRect(px + 14, py + 14, 4, 4);
        }
      }
    }
  }
  // Soft outline where floor meets wall (readability).
  g.strokeStyle = pal.outline;
  g.lineWidth = 2;
  for (let ty = 0; ty < DUN_H; ty++) {
    for (let tx = 0; tx < DUN_W; tx++) {
      if (dungeon.tiles[ty * DUN_W + tx] !== FLOOR) continue;
      const px = tx * TILE * SCALE, py = ty * TILE * SCALE, s = TILE * SCALE;
      if (ty > 0 && dungeon.tiles[(ty - 1) * DUN_W + tx] === WALL) { g.beginPath(); g.moveTo(px, py + 1); g.lineTo(px + s, py + 1); g.stroke(); }
      if (tx > 0 && dungeon.tiles[ty * DUN_W + tx - 1] === WALL) { g.beginPath(); g.moveTo(px + 1, py); g.lineTo(px + 1, py + s); g.stroke(); }
    }
  }
  return c;
}
