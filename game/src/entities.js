// Mosslight v4 — simulation entities: plain data factories, the spatial
// hash that keeps targeting and collisions cheap, and the small helpers
// that spawn visual objects (particles, damage numbers) from game events.
// All numbers come from config.js; gameplay randomness comes from the run
// RNG passed in by game.js; particle jitter comes from the visual RNG.
// No rendering code lives here — world.js turns these objects into meshes.

import { PLAYER, SKILLS, ENEMIES, BOSS, LOOT, FEEL } from './config.js';

// ---- spatial hash (cell 64 px; lookups only touch neighbouring cells) ----
export class SpatialHash {
  constructor(cell = 64) {
    this.cell = cell;
    this.map = new Map();
  }
  key(cx, cy) { return cx * 4096 + cy; }
  clear() { this.map.clear(); }
  insert(e) {
    const cx = Math.floor(e.x / this.cell), cy = Math.floor(e.y / this.cell);
    const k = this.key(cx, cy);
    let bucket = this.map.get(k);
    if (!bucket) { bucket = []; this.map.set(k, bucket); }
    bucket.push(e);
  }
  // Every entity whose cell overlaps the circle (x, y, r).
  query(x, y, r, out = []) {
    const x0 = Math.floor((x - r) / this.cell), x1 = Math.floor((x + r) / this.cell);
    const y0 = Math.floor((y - r) / this.cell), y1 = Math.floor((y + r) / this.cell);
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const bucket = this.map.get(this.key(cx, cy));
        if (bucket) for (const e of bucket) out.push(e);
      }
    }
    return out;
  }
}

// ---- factories (plain data, no methods) ----
let nextId = 1;
export function freshIds() { nextId = 1; }
function nid() { return nextId++; }

export function createPlayer(x, y) {
  return {
    x, y, hp: PLAYER.maxHp, maxHp: PLAYER.maxHp,
    energy: PLAYER.energyMax,
    speed: PLAYER.speed,
    radius: PLAYER.radius, moveRadius: PLAYER.moveRadius,
    boltTimer: 0,
    boltDamage: PLAYER.boltDamage, boltInterval: PLAYER.boltInterval, boltRange: PLAYER.boltRange,
    cooldowns: { crescent: 0, ember: 0, glassguard: 0, starfall: 0 },
    shield: 0, shieldT: 0,
    iframesT: 0, castT: 0, hurtT: 0,
    starfallWindup: 0, starfallX: 0, starfallY: 0,
    upgrades: { wick: 0, hands: 0, thread: 0, cape: 0, charm: 0 },
    faceAngle: Math.PI / 2, moving: false, dead: false, // face south
    // (toward the camera) at spawn: the title pose shows Neri front-on.
    joyX: 0, joyY: 0, // current joystick vector (-1..1)
  };
}

export function createEnemy(type, x, y, hpMul, spMul) {
  const def = ENEMIES[type];
  return {
    id: nid(), type, x, y,
    hp: Math.round(def.hp * hpMul), maxHp: Math.round(def.hp * hpMul),
    speed: def.speed * spMul,
    radius: def.radius, moveRadius: def.moveRadius,
    damage: def.damage,
    state: 'chase', stateT: 0,
    path: [], pathI: 0, repathT: 0,
    attackCd: 0, aimX: 0, aimY: 0,
    hopT: 0, hopFromX: 0, hopFromY: 0, hopToX: 0, hopToY: 0,
    contactCd: 0, // glassguard contact-damage throttle per enemy
    faceAngle: 0, moving: false, flashT: 0,
  };
}

export function createBoss(x, y) {
  return {
    id: nid(), type: 'boss', x, y,
    hp: BOSS.hp, maxHp: BOSS.hp,
    speed: BOSS.speed,
    radius: BOSS.radius, moveRadius: BOSS.moveRadius,
    state: 'chase', stateT: 1.2, // first pattern after 1.2s, not instantly on spawn
    patternIdx: 0, phase: 1,
    path: [], pathI: 0, repathT: 0,
    faceAngle: 0, moving: false, flashT: 0, telegraphing: false,
    ringX: 0, ringY: 0,
    fanAngle: 0,
    echoMarks: [],
  };
}

export function createProjectile(x, y, vx, vy, damage, kind, life = 3) {
  return { id: nid(), x, y, vx, vy, damage, kind, life, radius: 6 };
}

export function createLoot(kind, x, y, rng) {
  return {
    id: nid(), kind, x, y,
    vx: rng.range(-40, 40), vy: rng.range(-40, 40),
    life: LOOT.lifetime, magnet: false,
  };
}

// ---- visual objects (driven by game events, rendered by world.js) ----
export function burstParticles(list, vrng, x, y, color, count, speed = 90) {
  for (let i = 0; i < count; i++) {
    const a = vrng.range(0, Math.PI * 2);
    const v = vrng.range(speed * 0.4, speed);
    list.push({
      x, y, z: vrng.range(0.2, 0.9),
      vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: vrng.range(40, 120),
      life: FEEL.particleLife, maxLife: FEEL.particleLife,
      color, rot: vrng.range(0, Math.PI * 2),
    });
  }
}

export function updateParticles(list, dt) {
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i];
    p.life -= dt;
    if (p.life <= 0) { list.splice(i, 1); continue; }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.z += p.vz * dt;
    p.vz -= 260 * dt; // gravity pulls sparks back to the floor
    if (p.z < 0) { p.z = 0; p.vz = 0; }
    p.vx *= 0.94;
    p.vy *= 0.94;
  }
}

// Damage numbers: horizontal stagger cycles -9 / 0 / +9 px so two hits on
// adjacent enemies never merge into one unreadable blob (v3 bug fix).
let staggerIdx = 0;
export function resetStagger() { staggerIdx = 0; }
export function addDamageNumber(list, x, y, text, color, sizePx) {
  const offs = [-9, 0, 9];
  const off = offs[staggerIdx % 3];
  staggerIdx++;
  list.push({
    x: x + off, y,
    text: String(text), color, sizePx,
    life: FEEL.damageLife, maxLife: FEEL.damageLife,
  });
}

export function updateDamageNumbers(list, dt) {
  for (let i = list.length - 1; i >= 0; i--) {
    const d = list[i];
    d.life -= dt;
    d.y -= (FEEL.damageRise / FEEL.damageLife) * dt;
    if (d.life <= 0) list.splice(i, 1);
  }
}
