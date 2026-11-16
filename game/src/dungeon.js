// Mosslight v4 — dungeon generation, from the design's section 7.
// A 48x36 tile dungeon: the grid is divided into 6x4 BSP regions, one room
// candidate per region; 12 rooms are kept (start room SW 9x8, boss room NE
// 12x10); rooms join by L-shaped 3-tile corridors over a minimum spanning
// tree of room centres; 2x2 cave patches roughen 4 rooms (4 cellular
// automata passes, still walkable); chests sit in the first three rooms
// from the start; one buff statue stands in a room of each area. The layout
// is flood-fill checked from the start room; a bad layout retries with the
// next seed value. All randomness comes from the run's seeded RNG, so the
// same seed always builds the same dungeon. Rooms are tagged to an area by
// distance from the start (nearest third Bloomroot, middle Cinderglass,
// farthest Moonmilk) so waves spawn in their own area's rooms.

import { GRID_W, GRID_H, TILE, WORLD_W, WORLD_H } from './config.js';
import { makeRng } from './random.js';

const WALL = 0;
const FLOOR = 1;

// FNV-1a hash of the tile grid (determinism summary).
export function hashTiles(tiles) {
  let h = 0x811c9dc5;
  for (let i = 0; i < tiles.length; i++) {
    h ^= tiles[i];
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

function carveRoom(grid, room) {
  for (let y = room.y; y < room.y + room.h; y++) {
    for (let x = room.x; x < room.x + room.w; x++) grid[y * GRID_W + x] = FLOOR;
  }
}

// L-shaped corridor, 3 tiles wide, from (x0,y0) to (x1,y1).
function carveCorridor(grid, x0, y0, x1, y1, rng) {
  const horizontalFirst = rng.chance(0.5);
  const carveH = (y, xa, xb) => {
    for (let x = Math.min(xa, xb); x <= Math.max(xa, xb); x++) {
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy > 0 && yy < GRID_H - 1 && x > 0 && x < GRID_W - 1) grid[yy * GRID_W + x] = FLOOR;
      }
    }
  };
  const carveV = (x, ya, yb) => {
    for (let y = Math.min(ya, yb); y <= Math.max(ya, yb); y++) {
      for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx;
        if (xx > 0 && xx < GRID_W - 1 && y > 0 && y < GRID_H - 1) grid[y * GRID_W + xx] = FLOOR;
      }
    }
  };
  if (horizontalFirst) { carveH(y0, x0, x1); carveV(x1, y0, y1); }
  else { carveV(x0, y0, y1); carveH(y1, x0, x1); }
}

// Roughen a 2x2 patch inside a room with 4 cellular-automata passes.
// The patch stays walkable floor; the passes only vary its edge tiles.
function carveCavePatch(grid, room, rng) {
  const px = room.x + 1 + rng.int(0, Math.max(0, room.w - 4));
  const py = room.y + 1 + rng.int(0, Math.max(0, room.h - 4));
  // 4x4 neighbourhood, 4 passes of "a wall tile with >=5 floor neighbours becomes floor".
  for (let pass = 0; pass < 4; pass++) {
    for (let y = py; y < py + 4; y++) {
      for (let x = px; x < px + 4; x++) {
        if (x < 1 || y < 1 || x >= GRID_W - 1 || y >= GRID_H - 1) continue;
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          if (grid[(y + dy) * GRID_W + (x + dx)] === FLOOR) n++;
        }
        if (n >= 5) grid[y * GRID_W + x] = FLOOR;
      }
    }
  }
  // The 2x2 core is always floor.
  for (let y = py + 1; y < py + 3; y++) for (let x = px + 1; x < px + 3; x++) grid[y * GRID_W + x] = FLOOR;
  return { x: px + 1, y: py + 1 };
}

function floodFillCount(grid, sx, sy) {
  const seen = new Uint8Array(GRID_W * GRID_H);
  const stack = [[sx, sy]];
  seen[sy * GRID_W + sx] = 1;
  let count = 0;
  while (stack.length) {
    const [x, y] = stack.pop();
    count++;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= GRID_W || ny >= GRID_H) continue;
      if (seen[ny * GRID_W + nx] || grid[ny * GRID_W + nx] !== FLOOR) continue;
      seen[ny * GRID_W + nx] = 1;
      stack.push([nx, ny]);
    }
  }
  return { count, seen };
}

// Build one candidate layout from a seed. Returns null when it fails the
// connectivity check (caller retries with the next seed).
function buildLayout(seed) {
  const rng = makeRng(seed);
  const grid = new Uint8Array(GRID_W * GRID_H); // all wall
  // 6x4 regions; each region is 8 wide x 9 tall.
  const regionW = Math.floor(GRID_W / 6);
  const regionH = Math.floor(GRID_H / 4);
  const candidates = [];
  for (let ry = 0; ry < 4; ry++) {
    for (let rx = 0; rx < 6; rx++) {
      const x0 = rx * regionW, y0 = ry * regionH;
      // Split the region once (vertical or horizontal) and place the room
      // inside one half, keeping at least 1 tile of wall around it.
      const vertical = rng.chance(0.5);
      let bx, by, bw, bh;
      if (vertical) {
        const cut = x0 + 2 + rng.int(0, regionW - 4);
        const left = rng.chance(0.5);
        bx = left ? x0 + 1 : cut + 1;
        bw = left ? cut - x0 - 1 : x0 + regionW - cut - 2;
        by = y0 + 1; bh = regionH - 2;
      } else {
        const cut = y0 + 2 + rng.int(0, regionH - 4);
        const top = rng.chance(0.5);
        by = top ? y0 + 1 : cut + 1;
        bh = top ? cut - y0 - 1 : y0 + regionH - cut - 2;
        bx = x0 + 1; bw = regionW - 2;
      }
      const w = Math.max(3, Math.min(9, bw));
      const h = Math.max(3, Math.min(8, bh));
      const x = bx + rng.int(0, Math.max(0, bw - w));
      const y = by + rng.int(0, Math.max(0, bh - h));
      candidates.push({ x, y, w, h, region: ry * 6 + rx });
    }
  }
  // The start room is the SW region (bottom-left, region 18) sized 9x8;
  // the boss room is the NE region (top-right, region 5) sized 12x10.
  const startRegion = 18, bossRegion = 5;
  const startCand = candidates[startRegion];
  const bossCand = candidates[bossRegion];
  startCand.w = 9; startCand.h = 8;
  startCand.x = Math.min(startCand.x, GRID_W - 10);
  startCand.y = Math.min(startCand.y, GRID_H - 9);
  bossCand.w = 12; bossCand.h = 10;
  bossCand.x = Math.min(bossCand.x, GRID_W - 13);
  bossCand.y = Math.min(bossCand.y, GRID_H - 11);
  // Keep 12 rooms: start + boss + 10 more, shuffled by the seed.
  const rest = candidates.filter((c) => c.region !== startRegion && c.region !== bossRegion);
  rng.shuffle(rest);
  const rooms = [startCand, bossCand, ...rest.slice(0, 10)];
  // Clamp rooms to 5-9 wide / 5-8 high (except start/boss, already sized),
  // and keep at least 1 tile of wall between neighbours by construction.
  for (const r of rooms) {
    if (r !== startCand && r !== bossCand) {
      r.w = Math.max(5, Math.min(9, r.w));
      r.h = Math.max(5, Math.min(8, r.h));
    }
    r.cx = r.x + Math.floor(r.w / 2);
    r.cy = r.y + Math.floor(r.h / 2);
  }
  for (const r of rooms) carveRoom(grid, r);
  // Connect rooms: minimum spanning tree over room centres, L corridors.
  const connected = new Set([0]);
  const edges = [];
  while (connected.size < rooms.length) {
    let best = null;
    for (const i of connected) {
      for (let j = 0; j < rooms.length; j++) {
        if (connected.has(j)) continue;
        const d = Math.abs(rooms[i].cx - rooms[j].cx) + Math.abs(rooms[i].cy - rooms[j].cy);
        if (!best || d < best.d) best = { i, j, d };
      }
    }
    edges.push([best.i, best.j]);
    connected.add(best.j);
  }
  for (const [i, j] of edges) carveCorridor(grid, rooms[i].cx, rooms[i].cy, rooms[j].cx, rooms[j].cy, rng);
  // Cave patches in 4 rooms.
  const caveRooms = rng.shuffle([...rooms]).slice(0, 4);
  const caves = caveRooms.map((r) => carveCavePatch(grid, r, rng));
  // Tag rooms to areas by distance from the start room centre.
  const sx = rooms[0].cx, sy = rooms[0].cy;
  const withDist = rooms.map((r) => ({ r, d: Math.abs(r.cx - sx) + Math.abs(r.cy - sy) }));
  withDist.sort((a, b) => a.d - b.d);
  withDist.forEach((entry, idx) => {
    entry.r.area = idx < 4 ? 0 : idx < 8 ? 1 : 2;
    entry.r.id = idx;
  });
  rooms[0].area = 0; // start room is always Bloomroot
  rooms[1].area = 2; // boss room is always Moonmilk
  // Connectivity: every room centre reachable from the start centre.
  const { seen } = floodFillCount(grid, rooms[0].cx, rooms[0].cy);
  for (const r of rooms) {
    if (!seen[r.cy * GRID_W + r.cx]) return null;
  }
  // Chests: one in each of the first three rooms from the start (BFS order),
  // excluding the start room itself.
  const order = [...rooms].sort((a, b) => (Math.abs(a.cx - sx) + Math.abs(a.cy - sy)) - (Math.abs(b.cx - sx) + Math.abs(b.cy - sy)));
  const chests = [];
  for (const r of order.slice(1, 4)) {
    chests.push({
      x: (r.x + 1 + rng.int(0, Math.max(0, r.w - 3))) * TILE + TILE / 2,
      y: (r.y + 1 + rng.int(0, Math.max(0, r.h - 3))) * TILE + TILE / 2,
      room: r,
    });
  }
  // Statues: one per area, in a non-start, non-boss room of that area.
  const statues = [];
  for (let area = 0; area < 3; area++) {
    const pool = rooms.filter((r) => r.area === area && r !== rooms[0] && r !== rooms[1]);
    if (!pool.length) continue;
    const r = rng.pick(pool);
    statues.push({
      x: (r.x + 1 + rng.int(0, Math.max(0, r.w - 3))) * TILE + TILE / 2,
      y: (r.y + 1 + rng.int(0, Math.max(0, r.h - 3))) * TILE + TILE / 2,
      room: r, area, used: false,
    });
  }
  return { grid, rooms, startRoom: rooms[0], bossRoom: rooms[1], chests, statues, caves, seed };
}

// Public: generate a dungeon for a seed, retrying on failed layouts.
export function generateDungeon(seed) {
  for (let attempt = 0; attempt < 64; attempt++) {
    const layout = buildLayout(seed + attempt);
    if (layout) return layout;
  }
  throw new Error('dungeon: no connected layout in 64 attempts');
}

// ---- queries over a built dungeon ----

export function tileAt(d, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= GRID_W || ty >= GRID_H) return WALL;
  return d.grid[ty * GRID_W + tx];
}

export function isFloor(d, tx, ty) {
  return tileAt(d, tx, ty) === FLOOR;
}

// Can a circle of radius r (px) sit at (x, y) without touching a wall?
export function circleFits(d, x, y, r) {
  const x0 = Math.floor((x - r) / TILE), x1 = Math.floor((x + r) / TILE);
  const y0 = Math.floor((y - r) / TILE), y1 = Math.floor((y + r) / TILE);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (tileAt(d, tx, ty) === WALL) {
        // Closest point on the tile to the circle centre.
        const cx = Math.max(tx * TILE, Math.min(x, tx * TILE + TILE));
        const cy = Math.max(ty * TILE, Math.min(y, ty * TILE + TILE));
        const dx = x - cx, dy = y - cy;
        if (dx * dx + dy * dy < r * r) return false;
      }
    }
  }
  return true;
}

// Move a circle by (dx, dy) with axis separation so it slides along walls.
export function moveCircle(d, x, y, r, dx, dy) {
  if (circleFits(d, x + dx, y, r)) x += dx;
  if (circleFits(d, x, y + dy, r)) y += dy;
  return { x, y };
}

// BFS path (tile centres in px) from (sx, sy) to (tx, ty). Empty when unreachable.
export function findPath(d, sx, sy, tx, ty) {
  const startX = Math.floor(sx / TILE), startY = Math.floor(sy / TILE);
  const goalX = Math.floor(tx / TILE), goalY = Math.floor(ty / TILE);
  if (!isFloor(d, goalX, goalY)) return [];
  const prev = new Int32Array(GRID_W * GRID_H).fill(-1);
  const queue = [startY * GRID_W + startX];
  prev[startY * GRID_W + startX] = startY * GRID_W + startX;
  let head = 0;
  while (head < queue.length) {
    const cur = queue[head++];
    const cx = cur % GRID_W, cy = Math.floor(cur / GRID_W);
    if (cx === goalX && cy === goalY) break;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, ny = cy + dy;
      if (!isFloor(d, nx, ny)) continue;
      const ni = ny * GRID_W + nx;
      if (prev[ni] !== -1) continue;
      prev[ni] = cur;
      queue.push(ni);
    }
  }
  const goal = goalY * GRID_W + goalX;
  if (prev[goal] === -1) return [];
  const path = [];
  let cur = goal;
  while (cur !== startY * GRID_W + startX) {
    path.push({ x: (cur % GRID_W) * TILE + TILE / 2, y: Math.floor(cur / GRID_W) * TILE + TILE / 2 });
    cur = prev[cur];
  }
  path.reverse();
  return path;
}

// A random floor point inside a room (px).
export function randomPointInRoom(rng, room, margin = 1) {
  const tx = room.x + margin + rng.int(0, Math.max(0, room.w - 1 - margin * 2));
  const ty = room.y + margin + rng.int(0, Math.max(0, room.h - 1 - margin * 2));
  return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 };
}

// Spawn point: a floor point in one of the current area's rooms, at least
// minDist px from the player, near a room edge when possible.
export function spawnPoint(d, rng, px, py, area, minDist) {
  const pool = d.rooms.filter((r) => r.area === area);
  const shuffled = rng.shuffle([...pool]);
  for (const room of shuffled) {
    for (let tries = 0; tries < 12; tries++) {
      const p = randomPointInRoom(rng, room, 0);
      const dx = p.x - px, dy = p.y - py;
      if (dx * dx + dy * dy >= minDist * minDist) return p;
    }
  }
  // Fallback: any room, any distance.
  const room = rng.pick(d.rooms);
  return randomPointInRoom(rng, room, 0);
}

// The room containing a px point (or null).
export function roomAt(d, x, y) {
  const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
  for (const r of d.rooms) {
    if (tx >= r.x && tx < r.x + r.w && ty >= r.y && ty < r.y + r.h) return r;
  }
  return null;
}
