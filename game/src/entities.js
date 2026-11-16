// Mosslight — entities: player, enemies, boss, projectiles, loot, particles,
// damage numbers, and the spatial hash that keeps collisions cheap.
// All numbers come from config.js; all randomness from the run RNG.

import { HERO, SKILLS, ENEMIES, BOSS, LOOT, FEEL, STEP } from './config.js';

// ---------------------------------------------------------------- spatial hash
// Cell 64 world px; enemies are looked up only in neighbouring cells.
export class SpatialHash {
  constructor(cell = 64) { this.cell = cell; this.map = new Map(); }
  key(cx, cy) { return cx * 100000 + cy; }
  clear() { this.map.clear(); }
  insert(e) {
    const cx = Math.floor(e.x / this.cell), cy = Math.floor(e.y / this.cell);
    const k = this.key(cx, cy);
    let arr = this.map.get(k);
    if (!arr) { arr = []; this.map.set(k, arr); }
    arr.push(e);
  }
  // All entities within radius r of (x, y).
  query(x, y, r, out) {
    out.length = 0;
    const c = this.cell;
    const x0 = Math.floor((x - r) / c), x1 = Math.floor((x + r) / c);
    const y0 = Math.floor((y - r) / c), y1 = Math.floor((y + r) / c);
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
      const arr = this.map.get(this.key(cx, cy));
      if (!arr) continue;
      for (const e of arr) {
        const dx = e.x - x, dy = e.y - y;
        if (dx * dx + dy * dy <= r * r) out.push(e);
      }
    }
    return out;
  }
}

// ---------------------------------------------------------------- player
export class Player {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.hp = HERO.maxHp; this.maxHp = HERO.maxHp;
    this.energy = HERO.maxEnergy;
    this.radius = HERO.radius;      // gameplay radius (contact, attacks)
    this.moveRadius = 7;            // wall-collision radius (must be < half a tile so 1-tile gaps stay passable)
    this.facing = { x: 1, y: 0 };
    this.invuln = 0;
    this.boltTimer = 0;
    this.shield = 0; this.shieldTime = 0;
    this.cooldowns = { crescent: 0, ember: 0, glassguard: 0, starfall: 0 };
    this.up = { wick: 0, hands: 0, thread: 0, cape: 0, charm: 0 };
    this.walkPhase = 0;
    this.moving = false;
    this.starfallWindup = 0; // >0 while the ultimate winds up
    this.alive = true;
    this.castT = 0; // cast-frame timer (visual only, 0.16s per cast)
    this.hurtT = 0; // hurt-frame timer (visual only, 0.12s per hit)
  }
  get boltDamage() { return HERO.boltDamage + this.up.wick * 3; }
  get boltInterval() { return Math.max(0.2, HERO.boltInterval - this.up.hands * 0.08); }
  get boltRange() { return HERO.boltRange + this.up.thread * 35; }
  get skillBonus() { return this.up.charm ? { cut: 10, ember: 3, star: 15 } : { cut: 0, ember: 0, star: 0 }; }

  hurt(amount) {
    if (this.invuln > 0 || !this.alive) return 0;
    let rest = amount;
    if (this.shield > 0) {
      const absorbed = Math.min(this.shield, rest);
      this.shield -= absorbed; rest -= absorbed;
    }
    if (rest > 0) {
      this.hp -= rest;
      this.invuln = HERO.invuln;
      this.hurtT = 0.12; // hurt frame (visual only)
      if (this.hp <= 0) { this.hp = 0; this.alive = false; }
    }
    return amount;
  }

  heal(amount) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }
}

// ---------------------------------------------------------------- enemies
let ENEMY_ID = 1;
export class Enemy {
  constructor(type, x, y, hpMul, speedMul) {
    const def = ENEMIES[type];
    this.id = ENEMY_ID++;
    this.type = type;
    this.x = x; this.y = y;
    this.hp = Math.round(def.hp * hpMul);
    this.maxHp = this.hp;
    this.speed = def.speed * speedMul;
    this.radius = def.radius;       // gameplay radius (contact, attacks)
    this.moveRadius = 7;            // wall-collision radius (< half a tile)
    this.state = 'chase';   // chase | pause | hop | root | aim | recover
    this.stateT = 0;
    this.cooldown = 0;
    this.flash = 0;         // white hit flash timer
    this.kbx = 0; this.kby = 0; // knockback velocity
    this.thornT = 0;        // glassguard thorn immunity timer
    this.hopFrom = null;
    this.aimAngle = 0;
    this.path = null;       // BFS waypoints toward the player
    this.pathIdx = 0;
    this.repathT = 0;
    this.dead = false;
  }
  get def() { return ENEMIES[this.type]; }

  hurt(amount) {
    this.hp -= amount;
    this.flash = 0.08;
    if (this.hp <= 0) { this.hp = 0; this.dead = true; }
    return this.dead;
  }
}

// ---------------------------------------------------------------- boss
export class Boss {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.hp = BOSS.hp; this.maxHp = BOSS.hp;
    this.radius = BOSS.radius;      // gameplay radius (contact, attacks)
    this.moveRadius = 14;           // wall-collision radius
    this.state = 'enter';   // enter | reposition | telegraph | attack | recovery | roar
    this.stateT = 0;
    this.attackIdx = 0;     // 0 ring, 1 fan, 2 drop, repeating
    this.phase = 1;
    this.flash = 0;
    this.kbx = 0; this.kby = 0;
    this.roarDone = { 2: false, 3: false };
    this.dead = false;
    this.telegraph = null;  // {kind, x, y, angle, t, dur}
  }
  get speedMul() { return this.phase >= 3 ? BOSS.phase3Move : 1; }
  get timeMul() { return this.phase >= 2 ? 1 / BOSS.phase2Speed : 1; }
  hurt(amount) {
    this.hp -= amount;
    this.flash = 0.08;
    if (this.hp <= 0) { this.hp = 0; this.dead = true; }
    const frac = this.hp / this.maxHp;
    if (frac <= BOSS.phase2Hp && this.phase === 1) { this.phase = 2; return 'phase2'; }
    if (frac <= BOSS.phase3Hp && this.phase === 2) { this.phase = 3; return 'phase3'; }
    return this.dead ? 'dead' : null;
  }
}

// ---------------------------------------------------------------- projectiles
export class Projectiles {
  constructor() { this.list = []; }
  spawn(x, y, vx, vy, damage, from, radius = 4, life = 3) {
    this.list.push({ x, y, vx, vy, damage, from, radius, life });
  }
  update(dt, dungeon) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
      if (p.life <= 0 || dungeon.isWallPx(p.x, p.y)) this.list.splice(i, 1);
    }
  }
  clear() { this.list.length = 0; }
}

// ---------------------------------------------------------------- loot
export class Loot {
  constructor() { this.list = []; }
  spawn(type, x, y, value, rng) {
    const a = rng.float() * Math.PI * 2;
    const sp = rng.range(40, 90);
    this.list.push({
      type, x, y, value,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: LOOT.life, magnet: false,
    });
  }
  update(dt, player) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const l = this.list[i];
      l.life -= dt;
      if (l.life <= 0) { this.list.splice(i, 1); continue; }
      // Pop-out drift decays.
      l.x += l.vx * dt; l.y += l.vy * dt;
      l.vx *= 0.90; l.vy *= 0.90;
      const dx = player.x - l.x, dy = player.y - l.y;
      const d = Math.hypot(dx, dy);
      const collectR = l.type === 'heart' ? LOOT.collectHeart : LOOT.collectCoin;
      if (d < LOOT.magnetRange) {
        l.x += (dx / (d || 1)) * LOOT.magnetSpeed * dt;
        l.y += (dy / (d || 1)) * LOOT.magnetSpeed * dt;
      }
      if (d < collectR) {
        this.list.splice(i, 1);
        this.onCollect?.(l);
      }
    }
  }
  clear() { this.list.length = 0; }
}

// ---------------------------------------------------------------- particles
export class Particles {
  constructor() { this.list = []; }
  burst(x, y, count, colors, rng, speed = 120) {
    for (let i = 0; i < count; i++) {
      const a = rng.float() * Math.PI * 2;
      const sp = rng.range(speed * 0.3, speed);
      this.list.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: FEEL.particleLife, maxLife: FEEL.particleLife,
        color: colors[i % colors.length], size: rng.range(2, 5),
      });
    }
  }
  // Per-type death burst (Astra §7): count, colors, life, distance range
  // and gravity are per enemy type; all visual-only. Each particle flies
  // roughly `dist` world px over its life (velocity = dist / life).
  // RNG HYGIENE: exactly 3 run-RNG calls per particle (angle, distance,
  // size) — the same as v1's burst() — so the visual layer never perturbs
  // the gameplay roll stream. Life is fixed per type (no jitter call).
  burstSpec(x, y, count, colors, rng, opts = {}) {
    const life = opts.life || FEEL.particleLife;
    const dist = opts.dist || [12, 30];
    const grav = opts.gravity || 0;
    for (let i = 0; i < count; i++) {
      const a = rng.float() * Math.PI * 2;
      const d = rng.range(dist[0], dist[1]);
      const sp = d / life;
      this.list.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life, maxLife: life,
        color: colors[i % colors.length],
        size: opts.size ? rng.range(opts.size[0], opts.size[1]) : rng.range(2, 5),
        grav,
      });
    }
  }
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 0.92; p.vy *= 0.92;
      if (p.grav) p.vy += p.grav * dt;
      p.life -= dt;
      if (p.life <= 0) this.list.splice(i, 1);
    }
  }
  clear() { this.list.length = 0; }
}

// ---------------------------------------------------------------- damage numbers
export class DamageNumbers {
  constructor() { this.list = []; }
  add(x, y, value, color = '#FFFFFF', size = 22) {
    // v3: stagger simultaneous numbers horizontally (-9/0/+9px, cycling
    // with the live count) so two hits on adjacent enemies don't merge
    // into one unreadable number. Visual only — no RNG, no gameplay.
    const stagger = (this.list.length % 3 - 1) * 9;
    this.list.push({ x: x + stagger, y, value: Math.round(value), color, size, life: FEEL.dmgNumLife });
  }
  // Raw text (e.g. '+2' gold, '+25' shard) — no rounding, keeps the sign.
  addText(x, y, text, color = '#FFFFFF', size = 20) {
    const stagger = (this.list.length % 3 - 1) * 9;
    this.list.push({ x: x + stagger, y, value: String(text), color, size, life: FEEL.dmgNumLife });
  }
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const d = this.list[i];
      d.y -= (FEEL.dmgNumRise / FEEL.dmgNumLife) * dt;
      d.life -= dt;
      if (d.life <= 0) this.list.splice(i, 1);
    }
  }
  clear() { this.list.length = 0; }
}

// ---------------------------------------------------------------- ember patches
export class EmberPatches {
  constructor() { this.list = []; }
  spawn(x, y, damage, tickDamage) {
    this.list.push({ x, y, radius: 72, timeLeft: 2, tickT: 0.5, damage, tickDamage, hitIds: new Set() });
  }
  // Returns {x, y, damage} ticks to apply (caller finds enemies in radius).
  update(dt) {
    const ticks = [];
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.timeLeft -= dt;
      p.tickT -= dt;
      if (p.tickT <= 0) { p.tickT += 0.5; ticks.push(p); }
      if (p.timeLeft <= 0) this.list.splice(i, 1);
    }
    return ticks;
  }
  clear() { this.list.length = 0; }
}
