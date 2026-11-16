// Mosslight v6 — game orchestration: state machine, waves, combat, boss
// AI, loot, pickups, upgrades, score, the deterministic autotest bot,
// HUD, minimap, and the screenshot/autotest hooks the verification tools
// poll. All sim numbers come from config.js; all gameplay randomness from
// the run RNG; the visual RNG feeds particles and decor only. The
// simulation runs in px units on the 2400x1800 open field; world.js
// renders it in 3D. No walls, no pathfinding: enemies walk straight at
// Neri and the bot walks straight at its target.

import {
  FIELD_W, FIELD_H,
  WAVE_TIME, INTERMISSION_TIME, WAVE_COUNT, WAVES, AREA_NAMES, AREAS,
  MAX_ENEMIES, SPAWN_GROUP_EVERY, SPAWN_MIN_DIST,
  VICTORY_BONUS, DEFEAT_PER_WAVE,
  PLAYER, SKILLS, ENEMIES, BOSS, LOOT, UPGRADES, FEEL,
  COS05, SIN05, COS06, SIN06, FAN_OFF,
} from './config.js';
import { makeRng } from './random.js';
import {
  generateField, moveField, spawnPoint,
} from './field.js';
import {
  SpatialHash, freshIds,
  createPlayer, createEnemy, createBoss, createProjectile, createLoot,
  burstParticles, updateParticles, addDamageNumber, updateDamageNumbers,
  resetStagger,
} from './entities.js';

export const STEP = 1 / 60; // fixed timestep, seconds

const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export class Game {
  constructor(world, audio, opts = {}) {
    this.world = world;
    this.audio = audio;
    this.opts = opts; // {seed, autotest, shot, speed}
    this.seed = opts.seed ?? 20261116;
    this.rng = makeRng(this.seed);
    this.vrng = makeRng((this.seed ^ 0x51ab3f) >>> 0);
    this.state = 'title';
    this.time = 0; // sim time, seconds (deterministic)
    this.wave = 0;
    this.waveT = 0; // wave timer
    this.interT = 0;
    this.groupsSpawned = 0;
    this.spawnT = 0;
    this.score = 0;
    this.coins = 0;
    this.shards = 0;
    this.kills = 0;
    this.hitstop = 0;
    this.shakeT = 0; this.shakeMax = 1; this.shakeAmp = 0;
    this.lowHpWarnT = 0;
    this.enemies = [];
    this.projectiles = [];
    this.loot = [];
    this.pickups = [];
    this.particles = [];
    this.damageNumbers = [];
    this.embers = [];
    this.telegraphs = [];
    this.streaks = [];
    this.slash = null;
    this.boss = null;
    this.offers = [];
    this.player = null;
    this.field = null;
    this.area = 0;
    this.done = null; // set once on victory/defeat {result, score, ...}
    this.shotReady = false;
    this.shotSeedTries = 0;
    this.bot = { path: [], pathI: 0, repathT: 0, orbitDir: 1, orbitT: 0, target: null, stuckT: 0, lastX: 0, lastY: 0, wanderT: 0, wanderX: 0, wanderY: 0 };
    this.hash = new SpatialHash(64);
    this.chestCoins = new Map();
    this.minimapTick = 0;
    this.buildRun();
  }

  // ---- run setup ----
  buildRun() {
    freshIds();
    resetStagger();
    this.rng = makeRng(this.seed);
    this.vrng = makeRng((this.seed ^ 0x51ab3f) >>> 0);
    this.field = generateField(this.seed);
    this.world.setField(this.field);
    // Neri spawns at the centre of the open field, facing south (toward
    // the camera) so the title pose shows her front-on.
    this.player = createPlayer(FIELD_W / 2, FIELD_H / 2);
    this.area = 0;
    this.enemies = [];
    this.projectiles = [];
    this.loot = [];
    this.pickups = this.field.pickups.map((p, i) => ({ ...p, id: 1000 + i }));
    this.particles = [];
    this.damageNumbers = [];
    this.embers = [];
    this.telegraphs = [];
    this.streaks = [];
    this.slash = null;
    this.boss = null;
    this.score = 0; this.coins = 0; this.shards = 0; this.kills = 0;
    this.wave = 0; this.time = 0;
    this.done = null;
    this.chestCoins = new Map();
    for (const c of this.field.chests) {
      this.chestCoins.set(c, this.rng.int(LOOT.chestCoinsMin, LOOT.chestCoinsMax));
    }
    // Roll the intermission offers for wave 1's intermission up front? No:
    // offers are rolled when an intermission starts, in run order.
    this.updateHUD();
  }

  startRun() {
    this.buildRun();
    this.state = 'playing';
    this.startWave(1);
    this.audio.unlock();
  }

  startWave(n) {
    this.wave = n;
    const def = WAVES[n - 1];
    if (def.area !== this.area) {
      this.area = def.area;
      this.world.setArea(def.area);
    }
    this.waveT = WAVE_TIME;
    this.groupsSpawned = 0;
    this.spawnT = 0;
    if (def.boss) this.spawnBoss();
    this.updateHUD();
  }

  startIntermission() {
    this.state = 'intermission';
    this.interT = INTERMISSION_TIME;
    this.rollOffers();
    this.updateHUD();
    this.showIntermission();
  }

  rollOffers() {
    const p = this.player;
    const eligible = UPGRADES.filter((u) => {
      if (p.upgrades[u.id] >= u.max) return false;
      return u.cur === 'coin' ? this.coins >= u.cost : this.shards >= u.cost;
    });
    this.rng.shuffle(eligible);
    this.offers = eligible.slice(0, 3);
  }

  buyUpgrade(id) {
    const u = UPGRADES.find((o) => o.id === id);
    if (!u || !this.offers.includes(u)) return false;
    const p = this.player;
    if (u.cur === 'coin') {
      if (this.coins < u.cost) return false;
      this.coins -= u.cost;
    } else {
      if (this.shards < u.cost) return false;
      this.shards -= u.cost;
    }
    p.upgrades[u.id]++;
    if (u.id === 'wick') p.boltDamage += 3;
    if (u.id === 'hands') p.boltInterval = Math.max(0.2, p.boltInterval - 0.08);
    if (u.id === 'thread') p.boltRange += 35;
    if (u.id === 'cape') { p.maxHp += 20; p.hp = Math.min(p.maxHp, p.hp + 20); }
    if (u.id === 'charm') { p.charmCrescent = (p.charmCrescent || 0) + 10; p.charmEmber = (p.charmEmber || 0) + 3; p.charmStar = (p.charmStar || 0) + 15; }
    this.offers = this.offers.filter((o) => o.id !== id);
    this.audio.play('skill');
    this.updateHUD();
    return true;
  }

  // ---- spawning ----
  spawnGroup() {
    const def = WAVES[this.wave - 1];
    if (this.enemies.length >= MAX_ENEMIES) return;
    const n = def.perGroup;
    const types = [];
    for (let i = 0; i < n; i++) types.push('puffcap');
    // Composition rolls: tinkets from wave 2 (cap 2/group), bramblers
    // from wave 3 (cap 1 early, 2 from wave 5).
    const tinketCap = this.wave >= 2 ? 2 : 0;
    const bramCap = this.wave >= 3 ? (this.wave >= 5 ? 2 : 1) : 0;
    let tinkets = 0, brams = 0;
    for (let i = 0; i < n; i++) {
      const r = this.rng.f();
      if (tinkets < tinketCap && r < 0.28) { types[i] = 'tinket'; tinkets++; }
      else if (brams < bramCap && r >= 0.28 && r < 0.45) { types[i] = 'brambler'; brams++; }
    }
    const base = spawnPoint(this.rng, this.player.x, this.player.y, SPAWN_MIN_DIST);
    for (const type of types) {
      if (this.enemies.length >= MAX_ENEMIES) break;
      const m = moveField(base.x, base.y, ENEMIES[type].moveRadius, this.rng.range(-30, 30), this.rng.range(-30, 30));
      this.enemies.push(createEnemy(type, m.x, m.y, def.hpMul, def.spMul));
    }
  }

  spawnBoss() {
    // The boss spawns ~200px from the player in a random direction, so
    // the fight starts immediately — no path, no boss room anymore.
    const p = this.player;
    const u = this.rng.unit();
    const m = moveField(p.x, p.y, BOSS.moveRadius, u.x * BOSS.spawnDist, u.y * BOSS.spawnDist);
    this.boss = createBoss(m.x, m.y);
    this.audio.play('roar');
  }

  // ---- one fixed step ----
  step(dt) {
    this.time += dt;
    if (this.hitstop > 0) { this.hitstop--; return; }
    if (this.state === 'playing') this.updatePlaying(dt);
    else if (this.state === 'intermission') this.updateIntermission(dt);
    // Visual-only updates run in every state (particles, numbers).
    updateParticles(this.particles, dt);
    updateDamageNumbers(this.damageNumbers, dt);
    if (this.shakeT > 0) this.shakeT -= dt;
    // Low-HP warning tick.
    if (this.player && this.player.hp <= FEEL.lowHp && this.player.hp > 0) {
      this.lowHpWarnT -= dt;
      if (this.lowHpWarnT <= 0) { this.lowHpWarnT = FEEL.lowHpWarnEvery; this.audio.play('warn'); }
    }
  }

  updateIntermission(dt) {
    this.interT -= dt;
    const p = this.player;
    // Standing near a statue channels it (1.2s) — also works in intermission.
    this.updateStatues(dt);
    if (this.opts.autotest || this.opts.shot) this.botIntermission();
    if (this.interT <= 0) {
      // Timeout: auto-buy the first affordable offer, else continue bare.
      const first = this.offers[0];
      if (first) this.buyUpgrade(first.id);
      this.hideIntermission();
      this.state = 'playing';
      this.startWave(this.wave + 1);
    }
  }

  updatePlaying(dt) {
    const p = this.player;
    if (p.dead) return;
    // --- timers ---
    this.waveT -= dt;
    p.iframesT = Math.max(0, p.iframesT - dt);
    p.castT = Math.max(0, p.castT - dt);
    p.hurtT = Math.max(0, p.hurtT - dt);
    for (const k of Object.keys(p.cooldowns)) p.cooldowns[k] = Math.max(0, p.cooldowns[k] - dt);
    p.energy = Math.min(PLAYER.energyMax, p.energy + PLAYER.energyRegen * dt);
    if (p.shieldT > 0) { p.shieldT -= dt; if (p.shieldT <= 0) p.shield = 0; }
    if (p.starfallWindup > 0) {
      p.starfallWindup -= dt;
      if (p.starfallWindup <= 0) this.fireStarfall();
    }
    // --- input / bot ---
    if (this.opts.autotest || this.opts.shot) this.botStep(dt);
    else this.applyInput(dt);
    // --- auto bolt ---
    p.boltTimer -= dt;
    if (p.boltTimer <= 0) this.tryBolt();
    // --- spawns ---
    const def = WAVES[this.wave - 1];
    if (this.groupsSpawned < def.groups) {
      this.spawnT += dt;
      // First group: immediately on normal waves, at 7s on a boss wave
      // (the boss itself spawns at 0s; adds arrive at 7/14/21/28s).
      const firstAt = def.boss ? SPAWN_GROUP_EVERY : 0.01;
      if (this.spawnT >= SPAWN_GROUP_EVERY || (this.groupsSpawned === 0 && this.spawnT >= firstAt)) {
        this.spawnT = 0;
        this.groupsSpawned++;
        this.spawnGroup();
      }
    }
    // --- entities ---
    this.updateEnemies(dt);
    this.updateBoss(dt);
    this.updateProjectiles(dt);
    this.updateLoot(dt);
    this.updateEmbers(dt);
    this.updateTelegraphs(dt);
    this.updateStreaks(dt);
    if (this.slash) {
      this.slash.life -= dt;
      if (this.slash.life <= 0) this.slash = null;
    }
    this.updateChests(dt);
    this.updatePickups();
    this.updateStatues(dt);
    // --- wave end ---
    if (this.wave < WAVE_COUNT) {
      const allSpawned = this.groupsSpawned >= def.groups;
      if ((allSpawned && this.enemies.length === 0) || this.waveT <= 0) {
        // Wave clear bonus on remaining seconds (only when cleared by kills).
        if (allSpawned && this.enemies.length === 0 && this.waveT > 0) {
          const bonus = Math.round(this.waveT) * LOOT.waveClearPerSecond;
          this.coins += bonus;
          this.score += bonus * LOOT.coinScore;
          const shardBonus = LOOT.waveClearShards[this.wave - 1] || 0;
          this.shards += shardBonus;
          this.score += shardBonus * LOOT.shardScore;
        }
        this.enemies = [];
        this.projectiles = [];
        this.startIntermission();
      }
    } else if (this.waveT <= 0 && !this.boss) {
      // Wave 8 timer expired with the boss already dead: victory was set
      // on the kill; this only fires if the boss somehow vanished.
      this.endRun('victory');
    } else if (this.waveT <= 0 && this.boss) {
      this.endRun('defeat');
    }
    this.minimapTick++;
    if (this.minimapTick % 6 === 0 && (!this.opts.autotest || this.opts.shot)) this.drawMinimap();
    this.updateHUD();
  }

  applyInput(dt) {
    const p = this.player;
    const ix = window.__joy ? window.__joy.x : 0;
    const iy = window.__joy ? window.__joy.y : 0;
    const kx = (window.__keys?.has('KeyD') || window.__keys?.has('ArrowRight') ? 1 : 0) - (window.__keys?.has('KeyA') || window.__keys?.has('ArrowLeft') ? 1 : 0);
    const ky = (window.__keys?.has('KeyS') || window.__keys?.has('ArrowDown') ? 1 : 0) - (window.__keys?.has('KeyW') || window.__keys?.has('ArrowUp') ? 1 : 0);
    let mx = ix + kx, my = iy + ky;
    const len = Math.hypot(mx, my);
    if (len > 1) { mx /= len; my /= len; }
    p.moving = len > 0.05;
    if (p.moving) {
      const moved = moveField(p.x, p.y, p.moveRadius, mx * p.speed * dt, my * p.speed * dt);
      p.x = moved.x; p.y = moved.y;
      const fl = Math.hypot(mx, my) || 1;
      p.fx = mx / fl; p.fy = my / fl; // facing unit vector (sim)
      p.faceAngle = Math.atan2(my, mx); // renderer only
    }
    // Queued skill casts (input.js sets window.__castQueue).
    if (window.__castQueue && window.__castQueue.length) {
      const id = window.__castQueue.shift();
      this.castSkill(id);
    }
  }

  // ---- combat ----
  nearestTarget(maxRange, preferBoss = true) {
    const p = this.player;
    let best = null, bestD = maxRange;
    if (this.boss && preferBoss) {
      const d = dist(p.x, p.y, this.boss.x, this.boss.y);
      if (d <= maxRange) { best = this.boss; bestD = d; }
    }
    for (const e of this.enemies) {
      const d = dist(p.x, p.y, e.x, e.y);
      // The bolt prefers the boss unless an add is very close (as-built).
      if (preferBoss && best === this.boss && d > 20) continue;
      if (d < bestD) { best = e; bestD = d; }
    }
    return best;
  }

  tryBolt() {
    const p = this.player;
    const target = this.nearestTarget(p.boltRange, true);
    if (!target) { p.boltTimer = 0.1; return; }
    p.boltTimer = p.boltInterval;
    const dx = target.x - p.x, dy = target.y - p.y;
    const d = Math.hypot(dx, dy) || 1;
    const ux = dx / d, uy = dy / d;
    p.fx = ux; p.fy = uy;
    p.faceAngle = Math.atan2(dy, dx); // renderer only
    p.castT = 0.16;
    this.projectiles.push(createProjectile(
      p.x + ux * 14, p.y + uy * 14,
      ux * PLAYER.boltSpeed, uy * PLAYER.boltSpeed,
      p.boltDamage, 'bolt', 2,
    ));
    this.audio.play('bolt');
  }

  castSkill(id) {
    const p = this.player;
    if (this.state !== 'playing' || p.dead || p.starfallWindup > 0) return false;
    const s = SKILLS[id];
    if (!s) return false;
    if (p.cooldowns[id] > 0 || p.energy < s.cost) return false;
    p.energy -= s.cost;
    p.cooldowns[id] = s.cd;
    p.castT = 0.16;
    if (id === 'crescent') {
      const dmg = s.damage + (p.charmCrescent || 0);
      const a = p.faceAngle;
      this.slash = { x: p.x, y: p.y, angle: a, life: 0.22, maxLife: 0.22 };
      let hits = 0;
      for (const e of [...this.enemies]) {
        if (dist(p.x, p.y, e.x, e.y) <= s.range + e.radius) { this.damageEnemy(e, dmg, 'skill', '#ffd76a'); hits++; }
      }
      if (this.boss && dist(p.x, p.y, this.boss.x, this.boss.y) <= s.range + this.boss.radius) {
        this.damageBoss(dmg, 'skill');
        hits++;
      }
      if (hits > 0) this.hitstop = FEEL.hitstopCrescent;
      this.audio.play('skill');
    } else if (id === 'ember') {
      const target = this.nearestTarget(s.range, true);
      let ax, ay;
      if (target) { ax = target.x; ay = target.y; }
      else { ax = p.x + p.fx * 100; ay = p.y + p.fy * 100; }
      const patch = { id: this.embers.length + 1, x: ax, y: ay, r: s.patchRadius, life: s.tickTime, tickT: SKILLS.ember.tickEvery, tick: s.tick + (p.charmEmber || 0), damage: s.damage };
      this.embers.push(patch);
      for (const e of [...this.enemies]) {
        if (dist(ax, ay, e.x, e.y) <= s.patchRadius + e.radius) this.damageEnemy(e, s.damage, 'skill', '#ff8a2a');
      }
      if (this.boss && dist(ax, ay, this.boss.x, this.boss.y) <= s.patchRadius + this.boss.radius) this.damageBoss(s.damage, 'skill');
      this.audio.play('skill');
    } else if (id === 'glassguard') {
      p.shield = s.shield;
      p.shieldT = s.shieldTime;
      this.audio.play('skill');
    } else if (id === 'starfall') {
      p.starfallWindup = s.windup;
      p.starfallX = p.x; p.starfallY = p.y;
      this.audio.play('skill');
    }
    this.updateHUD();
    return true;
  }

  fireStarfall() {
    const p = this.player;
    const s = SKILLS.starfall;
    const dmg = s.damage + (p.charmStar || 0);
    const cx = p.starfallX, cy = p.starfallY;
    // Five gold streaks converge on the blast point (visual).
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.4;
      this.streaks.push({ x: cx + Math.cos(a) * 60, y: cy + Math.sin(a) * 60, h: 9, t: 0 });
    }
    let hitBoss = false;
    for (const e of [...this.enemies]) {
      if (dist(cx, cy, e.x, e.y) <= s.range + e.radius) {
        this.damageEnemy(e, dmg, 'skill', '#ffd76a');
        const dx = e.x - cx, dy = e.y - cy;
        const d = Math.hypot(dx, dy) || 1;
        const m = moveField(e.x, e.y, e.moveRadius, (dx / d) * s.knockback, (dy / d) * s.knockback);
        e.x = m.x; e.y = m.y;
      }
    }
    if (this.boss && dist(cx, cy, this.boss.x, this.boss.y) <= s.range + this.boss.radius) {
      this.damageBoss(dmg, 'skill');
      hitBoss = true;
    }
    this.shake(FEEL.shakeStarfall.amp, FEEL.shakeStarfall.time);
    if (hitBoss) this.hitstop = FEEL.hitstopStarfallBoss;
  }

  damageEnemy(e, dmg, kind, color = '#ffffff') {
    if (e.hp <= 0) return;
    e.hp -= dmg;
    e.flashT = 0.1;
    addDamageNumber(this.damageNumbers, e.x, e.y - 14, Math.round(dmg), color, kind === 'skill' ? 24 : 22);
    burstParticles(this.particles, this.vrng, e.x, e.y, color === '#ffffff' ? '#ffd76a' : color, 3, 60);
    if (kind === 'bolt') this.hitstop = Math.max(this.hitstop, FEEL.hitstopBolt);
    this.audio.play('hit');
    if (e.hp <= 0) this.killEnemy(e);
  }

  killEnemy(e) {
    const idx = this.enemies.indexOf(e);
    if (idx >= 0) this.enemies.splice(idx, 1);
    this.kills++;
    this.score += LOOT.killScore;
    const def = ENEMIES[e.type];
    burstParticles(this.particles, this.vrng, e.x, e.y, e.type === 'puffcap' ? '#ff7fb0' : e.type === 'tinket' ? '#d89a4a' : '#6fe08a', FEEL.deathParticles, 100);
    for (let i = 0; i < def.coinDrop; i++) this.loot.push(createLoot('coin', e.x, e.y, this.rng));
    if (this.player.hp < this.player.maxHp && this.rng.chance(def.heartChance)) {
      this.loot.push(createLoot('heart', e.x, e.y, this.rng));
    }
    if (def.shardChance > 0 && this.rng.chance(def.shardChance)) {
      this.loot.push(createLoot('shard', e.x, e.y, this.rng));
    }
    this.audio.play('death');
  }

  damageBoss(dmg, kind) {
    const b = this.boss;
    if (!b || b.hp <= 0) return;
    const before = b.hp;
    b.hp -= dmg;
    b.flashT = 0.12;
    addDamageNumber(this.damageNumbers, b.x, b.y - 40, Math.round(dmg), kind === 'skill' ? '#ffd76a' : '#ffffff', 26);
    if (kind === 'bolt') this.hitstop = Math.max(this.hitstop, FEEL.hitstopBolt);
    this.audio.play('hit');
    if (before > b.maxHp * BOSS.phase2At && b.hp <= b.maxHp * BOSS.phase2At && b.phase === 1) {
      b.phase = 2;
      b.state = 'roar'; b.stateT = BOSS.roarTime;
      this.audio.play('roar');
    } else if (before > b.maxHp * BOSS.phase3At && b.hp <= b.maxHp * BOSS.phase3At && b.phase === 2) {
      b.phase = 3;
      b.state = 'roar'; b.stateT = BOSS.roarTime;
      this.audio.play('roar');
    }
    if (b.hp <= 0) this.killBoss();
  }

  killBoss() {
    const b = this.boss;
    this.boss = null;
    this.score += LOOT.bossScore;
    burstParticles(this.particles, this.vrng, b.x, b.y, '#5fe0dc', FEEL.bossDeathParticles, 160);
    burstParticles(this.particles, this.vrng, b.x, b.y, '#ffd76a', 12, 120);
    for (let i = 0; i < BOSS.lootCoins; i++) this.loot.push(createLoot('coin', b.x, b.y, this.rng));
    for (let i = 0; i < BOSS.lootShards; i++) this.loot.push(createLoot('shard', b.x, b.y, this.rng));
    this.loot.push(createLoot('bigheart', b.x, b.y, this.rng));
    this.shake(FEEL.shakeBossDeath.amp, FEEL.shakeBossDeath.time);
    this.audio.play('victory');
    // Collect the boss loot instantly for the score tally, then end.
    this.score += BOSS.lootCoins * LOOT.coinScore + BOSS.lootShards * LOOT.shardScore;
    this.coins += BOSS.lootCoins;
    this.shards += BOSS.lootShards;
    this.endRun('victory');
  }

  damagePlayer(dmg, source = '') {
    const p = this.player;
    if (p.dead || p.iframesT > 0) return;
    let rest = dmg;
    if (p.shield > 0) {
      const absorbed = Math.min(p.shield, rest);
      p.shield -= absorbed;
      rest -= absorbed;
    }
    if (rest > 0) {
      p.hp -= rest;
      p.iframesT = PLAYER.iframes;
      p.hurtT = 0.25;
      this.shake(FEEL.shakePlayerHit.amp, FEEL.shakePlayerHit.time);
      addDamageNumber(this.damageNumbers, p.x, p.y - 20, Math.round(rest), '#ff6b7a', 20);
      this.audio.play('hurt');
    }
    if (p.hp <= 0) {
      p.hp = 0;
      p.dead = true;
      this.audio.play('defeat');
      this.endRun('defeat');
    }
    this.updateHUD();
  }

  shake(amp, time) {
    this.shakeAmp = amp;
    this.shakeMax = time;
    this.shakeT = time;
  }

  // ---- enemies ----
  updateEnemies(dt) {
    const p = this.player;
    // Rebuild the spatial hash for separation + targeting.
    this.hash.clear();
    for (const e of this.enemies) this.hash.insert(e);
    for (const e of [...this.enemies]) {
      e.flashT = Math.max(0, e.flashT - dt);
      e.attackCd = Math.max(0, e.attackCd - dt);
      e.contactCd = Math.max(0, e.contactCd - dt);
      const d = dist(e.x, e.y, p.x, p.y);
      e.faceAngle = Math.atan2(p.y - e.y, p.x - e.x);
      if (e.type === 'puffcap') this.updatePuffcap(e, dt, d);
      else if (e.type === 'tinket') this.updateTinket(e, dt, d);
      else this.updateBrambler(e, dt, d);
      // Contact: regular enemies deal damage through their attacks only
      // (puffcap hop landing, tinket bolt, brambler slam) — NOT by merely
      // touching the player (v3-faithful; every-frame contact damage made
      // any touch a death sentence). Glassguard's shield still hurts
      // enemies that touch the player (0.5s per enemy).
      if (p.shield > 0 && d < e.radius + p.radius && e.contactCd <= 0) {
        e.contactCd = SKILLS.glassguard.contactEvery;
        this.damageEnemy(e, SKILLS.glassguard.contactDamage, 'skill', '#7fe8ff');
      }
    }
    // Light separation so enemies don't stack exactly.
    const list = this.enemies;
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const dd = Math.hypot(dx, dy);
        const min = (a.radius + b.radius) * 0.75;
        if (dd > 0.01 && dd < min) {
          const push = (min - dd) / 2;
          const nx = dx / dd, ny = dy / dd;
          const ma = moveField(a.x - nx * push, a.y - ny * push, a.moveRadius, 0, 0);
          const mb = moveField(b.x + nx * push, b.y + ny * push, b.moveRadius, 0, 0);
          a.x = ma.x; a.y = ma.y; b.x = mb.x; b.y = mb.y;
        }
      }
    }
  }

  // Open world: walk straight at the target (no walls, no pathfinding).
  moveToward(e, tx, ty, dt, speed) {
    const dx = tx - e.x, dy = ty - e.y;
    const d = Math.hypot(dx, dy);
    if (d < 1) { e.moving = false; return; }
    const stepLen = Math.min(speed * dt, d);
    const m = moveField(e.x, e.y, e.moveRadius, (dx / d) * stepLen, (dy / d) * stepLen);
    e.x = m.x; e.y = m.y;
    e.moving = true;
    e.faceAngle = Math.atan2(dy, dx);
  }

  updatePuffcap(e, dt, d) {
    const p = this.player;
    const def = ENEMIES.puffcap;
    e.hopT = Math.max(0, (e.hopT || 0) - dt);
    if (e.state === 'pause') {
      e.stateT -= dt;
      e.moving = false;
      if (e.stateT <= 0) {
        e.state = 'hop';
        e.hopT = def.hopTime;
        e.hopFromX = e.x; e.hopFromY = e.y;
        const dx = p.x - e.x, dy = p.y - e.y;
        const d = Math.hypot(dx, dy) || 1;
        e.hopToX = e.x + (dx / d) * def.hopDist;
        e.hopToY = e.y + (dy / d) * def.hopDist;
      }
    } else if (e.state === 'hop') {
      const k = 1 - e.hopT / def.hopTime;
      const nx = e.hopFromX + (e.hopToX - e.hopFromX) * k;
      const ny = e.hopFromY + (e.hopToY - e.hopFromY) * k;
      const moved = moveField(e.x, e.y, e.moveRadius, nx - e.x, ny - e.y);
      e.x = moved.x; e.y = moved.y;
      e.moving = true;
      if (e.hopT <= 0) {
        e.state = 'chase';
        e.attackCd = def.attackCd;
        // Hop landing: the attack itself. (v3: damage when the hop lands
        // on the player; the pause before the hop is the dodge window.)
        if (dist(e.x, e.y, p.x, p.y) <= e.radius + p.radius + 4) {
          this.damagePlayer(def.damage, 'puffcap');
        }
      }
    } else {
      e.moving = false;
      if (d <= def.attackRange && e.attackCd <= 0) {
        e.state = 'pause';
        e.stateT = def.pauseTime;
      } else {
        this.moveToward(e, p.x, p.y, dt, e.speed);
      }
    }
  }

  updateTinket(e, dt, d) {
    const p = this.player;
    const def = ENEMIES.tinket;
    if (e.state === 'aim') {
      e.stateT -= dt;
      e.moving = false;
      // Aim is LOCKED at aim start (aimX/aimY): the aim line shows where
      // the bolt will go, and the player dodges by leaving that line.
      // (Tracking the player made the bolt undodgeable.)
      this.setAimTelegraph(e);
      if (e.stateT <= 0) {
        e.state = 'chase';
        e.attackCd = def.attackCd;
        const dx = e.aimX - e.x, dy = e.aimY - e.y;
        const d = Math.hypot(dx, dy) || 1;
        const ux = dx / d, uy = dy / d;
        this.projectiles.push(createProjectile(
          e.x + ux * 12, e.y + uy * 12,
          ux * def.boltSpeed, uy * def.boltSpeed,
          def.damage, 'tinket', 3,
        ));
        this.clearAimTelegraph(e);
        this.audio.play('tinket');
      }
    } else {
      e.moving = false;
      if (d <= def.stopRange && e.attackCd <= 0) {
        e.state = 'aim';
        e.stateT = def.aimTime;
        e.aimX = p.x; e.aimY = p.y;
      } else {
        this.moveToward(e, p.x, p.y, dt, e.speed);
      }
    }
  }

  setAimTelegraph(e) {
    let tg = this.telegraphs.find((t) => t.owner === e && t.kind === 'aim');
    if (!tg) {
      tg = { kind: 'aim', owner: e, x0: e.x, y0: e.y, x1: e.aimX, y1: e.aimY, life: 1, maxLife: 1, final: false, color: '#35c9d0', r: 0 };
      this.telegraphs.push(tg);
    }
    tg.x0 = e.x; tg.y0 = e.y; tg.x1 = e.aimX; tg.y1 = e.aimY;
  }

  clearAimTelegraph(e) {
    this.telegraphs = this.telegraphs.filter((t) => !(t.owner === e && t.kind === 'aim'));
  }

  updateBrambler(e, dt, d) {
    const p = this.player;
    const def = ENEMIES.brambler;
    if (e.state === 'root') {
      e.stateT -= dt;
      e.moving = false;
      // Ring telegraph (visual, rebuilt every step while rooting).
      let tg = this.telegraphs.find((t) => t.owner === e && t.kind === 'ring');
      if (!tg) {
        tg = { kind: 'ring', owner: e, x: e.x, y: e.y, r: def.ringRadius, life: def.rootTime, maxLife: def.rootTime, final: false, color: '#e94f62' };
        this.telegraphs.push(tg);
      }
      tg.x = e.x; tg.y = e.y;
      tg.final = e.stateT <= 0.15;
      tg.life = Math.max(0.01, e.stateT);
      if (e.stateT <= 0) {
        this.telegraphs = this.telegraphs.filter((t) => t !== tg);
        e.state = 'chase';
        e.attackCd = def.attackCd;
        burstParticles(this.particles, this.vrng, e.x, e.y, '#e94f62', 6, 80);
        if (dist(e.x, e.y, p.x, p.y) <= def.ringRadius + p.radius) {
          this.damagePlayer(def.damage, 'brambler');
        }
        this.shake(FEEL.shakeSlam.amp, FEEL.shakeSlam.time);
        this.audio.play('slam');
      }
    } else {
      e.moving = false;
      if (d <= def.attackRange && e.attackCd <= 0) {
        e.state = 'root';
        e.stateT = def.rootTime;
      } else {
        this.moveToward(e, p.x, p.y, dt, e.speed);
      }
    }
  }

  // ---- boss ----
  updateBoss(dt) {
    const b = this.boss;
    if (!b) return;
    const p = this.player;
    b.flashT = Math.max(0, b.flashT - dt);
    const speedMul = b.phase === 2 ? BOSS.phase2SpeedMul : 1;
    const moveSpeed = b.speed * (b.phase === 3 ? BOSS.phase3MoveMul : 1);
    const d = dist(b.x, b.y, p.x, p.y);
    b.faceAngle = Math.atan2(p.y - b.y, p.x - b.x);
    b.telegraphing = false;
    if (b.state === 'roar') {
      b.stateT -= dt * speedMul;
      b.moving = false;
      if (b.stateT <= 0) { b.state = 'chase'; b.stateT = 1.2; }
      return;
    }
    if (b.state === 'chase') {
      b.stateT -= dt;
      b.moving = true;
      this.moveToward(b, p.x, p.y, dt, moveSpeed);
      if (d < b.radius + p.radius) this.damagePlayer(BOSS.contactDamage, 'boss');
      if (b.stateT <= 0) this.bossStartPattern();
      return;
    }
    if (b.state === 'ringTel') {
      b.stateT -= dt * speedMul;
      b.telegraphing = true;
      b.moving = false;
      let tg = this.telegraphs.find((t) => t.owner === b && t.kind === 'ring');
      if (!tg) {
        tg = { kind: 'ring', owner: b, x: b.x, y: b.y, r: BOSS.ringRadius, life: BOSS.ringTelegraph, maxLife: BOSS.ringTelegraph, final: false, color: '#e94f62' };
        this.telegraphs.push(tg);
      }
      tg.x = b.x; tg.y = b.y;
      tg.final = b.stateT <= 0.15;
      tg.life = Math.max(0.01, b.stateT);
      if (b.stateT <= 0) {
        this.telegraphs = this.telegraphs.filter((t) => t !== tg);
        b.state = 'ringHit';
        b.stateT = BOSS.ringActive;
        if (dist(b.x, b.y, p.x, p.y) <= BOSS.ringRadius + p.radius) {
          this.damagePlayer(BOSS.ringDamage, 'boss-ring');
        }
        this.audio.play('ring');
      }
      return;
    }
    if (b.state === 'ringHit') {
      b.stateT -= dt;
      if (b.stateT <= 0) { b.state = 'recovery'; b.stateT = BOSS.recovery; b.patternIdx = (b.patternIdx + 1) % 3; }
      return;
    }
    if (b.state === 'fanTel') {
      b.stateT -= dt * speedMul;
      b.telegraphing = true;
      b.moving = false;
      if (b.stateT <= 0) {
        const dx = p.x - b.x, dy = p.y - b.y;
        const d = Math.hypot(dx, dy) || 1;
        const ux = dx / d, uy = dy / d;
        for (let i = 0; i < BOSS.fanShards; i++) {
          const o = FAN_OFF[i];
          const vx = ux * o.c - uy * o.s, vy = ux * o.s + uy * o.c;
          this.projectiles.push(createProjectile(
            b.x + vx * 20, b.y + vy * 20,
            vx * BOSS.fanSpeed, vy * BOSS.fanSpeed,
            BOSS.fanDamage, 'shard', BOSS.fanLife,
          ));
        }
        b.state = 'recovery';
        b.stateT = BOSS.recovery;
        b.patternIdx = (b.patternIdx + 1) % 3;
        this.audio.play('fan');
      }
      return;
    }
    if (b.state === 'echoTel') {
      b.stateT -= dt * speedMul;
      b.telegraphing = true;
      b.moving = false;
      // Markers follow the player's position at cast time (fixed at start).
      if (!b.echoMarks.length) {
        const dx = p.x - b.x, dy = p.y - b.y;
        const d = Math.hypot(dx, dy) || 1;
        const px = -(dy / d), py = dx / d;
        b.echoMarks = [
          { x: p.x, y: p.y },
          { x: p.x + px * BOSS.echoOffsets, y: p.y + py * BOSS.echoOffsets },
          { x: p.x - px * BOSS.echoOffsets, y: p.y - py * BOSS.echoOffsets },
        ];
        for (const m of b.echoMarks) {
          this.telegraphs.push({
            kind: 'ring', owner: b, x: m.x, y: m.y, r: BOSS.echoRadius,
            life: BOSS.echoDelay, maxLife: BOSS.echoDelay, final: false, color: '#76dde0',
          });
        }
      }
      for (const tg of this.telegraphs) {
        if (tg.owner === b && tg.kind === 'ring') tg.final = b.stateT <= 0.15;
      }
      if (b.stateT <= 0) {
        this.telegraphs = this.telegraphs.filter((t) => !(t.owner === b && t.kind === 'ring'));
        for (const m of b.echoMarks) {
          if (dist(m.x, m.y, p.x, p.y) <= BOSS.echoRadius + p.radius) {
            this.damagePlayer(BOSS.echoDamage, 'boss-echo');
          }
          burstParticles(this.particles, this.vrng, m.x, m.y, '#76dde0', 5, 70);
        }
        b.echoMarks = [];
        b.state = 'recovery';
        b.stateT = BOSS.recovery;
        b.patternIdx = (b.patternIdx + 1) % 3;
        this.audio.play('echo');
      }
      return;
    }
    if (b.state === 'recovery') {
      b.stateT -= dt * speedMul;
      b.moving = false;
      if (b.stateT <= 0) { b.state = 'chase'; b.stateT = 1.0; }
    }
  }

  bossStartPattern() {
    const b = this.boss;
    const pattern = b.patternIdx % 3;
    if (pattern === 0) { b.state = 'ringTel'; b.stateT = BOSS.ringTelegraph; }
    else if (pattern === 1) { b.state = 'fanTel'; b.stateT = BOSS.fanTelegraph; }
    else { b.state = 'echoTel'; b.stateT = BOSS.echoDelay; b.echoMarks = []; }
  }

  // ---- projectiles / loot / embers / telegraphs / streaks ----
  updateProjectiles(dt) {
    const p = this.player;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.life -= dt;
      const nx = pr.x + pr.vx * dt, ny = pr.y + pr.vy * dt;
      if (pr.life <= 0 || nx < 0 || nx > FIELD_W || ny < 0 || ny > FIELD_H) {
        this.projectiles.splice(i, 1);
        continue;
      }
      pr.x = nx; pr.y = ny;
      if (pr.kind === 'bolt') {
        // Player bolt: hits the boss first, then enemies.
        if (this.boss && dist(pr.x, pr.y, this.boss.x, this.boss.y) <= this.boss.radius + pr.radius) {
          this.damageBoss(pr.damage, 'bolt');
          this.projectiles.splice(i, 1);
          continue;
        }
        let hit = false;
        for (const e of [...this.enemies]) {
          if (dist(pr.x, pr.y, e.x, e.y) <= e.radius + pr.radius) {
            this.damageEnemy(e, pr.damage, 'bolt');
            hit = true;
            break;
          }
        }
        if (hit) this.projectiles.splice(i, 1);
      } else {
        // Enemy projectiles hurt the player.
        if (dist(pr.x, pr.y, p.x, p.y) <= p.radius + pr.radius) {
          this.damagePlayer(pr.damage, pr.kind);
          this.projectiles.splice(i, 1);
        }
      }
    }
  }

  updateLoot(dt) {
    const p = this.player;
    for (let i = this.loot.length - 1; i >= 0; i--) {
      const l = this.loot[i];
      l.life -= dt;
      if (l.life <= 0) { this.loot.splice(i, 1); continue; }
      // Scatter velocity decays; the field edge just stops the slide.
      l.x += l.vx * dt;
      l.y += l.vy * dt;
      l.vx *= 0.9; l.vy *= 0.9;
      const cx = Math.max(6, Math.min(FIELD_W - 6, l.x)), cy = Math.max(6, Math.min(FIELD_H - 6, l.y));
      if (cx !== l.x || cy !== l.y) { l.vx = 0; l.vy = 0; }
      l.x = cx; l.y = cy;
      const d = dist(l.x, l.y, p.x, p.y);
      const collectR = l.kind === 'heart' || l.kind === 'bigheart' ? LOOT.collectHeart : LOOT.collectCoin;
      if (d <= LOOT.magnetRange) {
        const dx = p.x - l.x, dy = p.y - l.y;
        const dl = Math.hypot(dx, dy) || 1;
        l.x += (dx / dl) * LOOT.magnetSpeed * dt;
        l.y += (dy / dl) * LOOT.magnetSpeed * dt;
      }
      if (dist(l.x, l.y, p.x, p.y) <= collectR) {
        if (l.kind === 'coin') {
          this.coins++;
          this.score += LOOT.coinScore;
          addDamageNumber(this.damageNumbers, p.x, p.y - 24, '+2', '#ffd76a', 18);
          this.audio.play('coin');
        } else if (l.kind === 'shard') {
          this.shards++;
          this.score += LOOT.shardScore;
          addDamageNumber(this.damageNumbers, p.x, p.y - 24, '+25', '#7fb8ff', 18);
          this.audio.play('coin');
        } else {
          const heal = l.kind === 'bigheart' ? BOSS.lootHeart : LOOT.heartHeal;
          p.hp = Math.min(p.maxHp, p.hp + heal);
          addDamageNumber(this.damageNumbers, p.x, p.y - 24, `+${heal}`, '#6fe08a', 18);
          this.audio.play('heal');
        }
        this.loot.splice(i, 1);
        this.updateHUD();
      }
    }
  }

  updateEmbers(dt) {
    for (let i = this.embers.length - 1; i >= 0; i--) {
      const e = this.embers[i];
      e.life -= dt;
      e.tickT -= dt;
      if (e.tickT <= 0) {
        e.tickT = SKILLS.ember.tickEvery;
        for (const en of [...this.enemies]) {
          if (dist(e.x, e.y, en.x, en.y) <= e.r + en.radius) this.damageEnemy(en, e.tick, 'skill', '#ff8a2a');
        }
        if (this.boss && dist(e.x, e.y, this.boss.x, this.boss.y) <= e.r + this.boss.radius) {
          this.damageBoss(e.tick, 'skill');
        }
      }
      if (e.life <= 0) this.embers.splice(i, 1);
    }
  }

  updateTelegraphs(dt) {
    // Telegraphs are owned by their attacker states (ring/echo set their
    // own life); this only ages free-standing ones (none right now) and
    // drops aim lines whose owner stopped aiming.
    for (let i = this.telegraphs.length - 1; i >= 0; i--) {
      const tg = this.telegraphs[i];
      if (tg.kind === 'aim') {
        const owner = tg.owner;
        if (!owner || owner.state !== 'aim') this.telegraphs.splice(i, 1);
      }
    }
  }

  updateStreaks(dt) {
    for (let i = this.streaks.length - 1; i >= 0; i--) {
      const s = this.streaks[i];
      s.t += dt;
      s.h -= 26 * dt;
      if (s.h <= 0.4) this.streaks.splice(i, 1);
    }
  }

  updateChests() {
    const p = this.player;
    for (const c of this.field.chests) {
      if (c.opened) continue;
      if (dist(c.x, c.y, p.x, p.y) <= 36) {
        c.opened = true;
        const n = this.chestCoins.get(c) || 5;
        this.coins += n;
        this.score += n * LOOT.coinScore;
        addDamageNumber(this.damageNumbers, c.x, c.y - 20, `+${n}`, '#ffd76a', 18);
        burstParticles(this.particles, this.vrng, c.x, c.y, '#ffd76a', 6, 70);
        this.audio.play('coin');
        this.updateHUD();
      }
    }
  }

  // Static field pickups (Genshin-style collectibles): walk over them.
  // gem = +1 shard (+25), coin pile = +3 coins (+6), heart = +20 HP.
  updatePickups() {
    const p = this.player;
    for (const pk of this.pickups) {
      if (pk.taken) continue;
      const r = pk.kind === 'heart' ? 28 : 36;
      if (dist(pk.x, pk.y, p.x, p.y) <= r) {
        pk.taken = true;
        if (pk.kind === 'gem') {
          this.shards++;
          this.score += LOOT.shardScore;
          addDamageNumber(this.damageNumbers, p.x, p.y - 24, '+25', '#7fb8ff', 18);
        } else if (pk.kind === 'coins') {
          this.coins += 3;
          this.score += 3 * LOOT.coinScore;
          addDamageNumber(this.damageNumbers, p.x, p.y - 24, '+6', '#ffd76a', 18);
        } else {
          p.hp = Math.min(p.maxHp, p.hp + LOOT.heartHeal);
          addDamageNumber(this.damageNumbers, p.x, p.y - 24, `+${LOOT.heartHeal}`, '#6fe08a', 18);
        }
        this.audio.play('coin');
        this.updateHUD();
      }
    }
  }

  updateStatues(dt) {
    const p = this.player;
    for (const s of this.field.statues) {
      if (s.used) continue;
      if (dist(s.x, s.y, p.x, p.y) <= 42) {
        s.channel = (s.channel || 0) + dt;
        if (s.channel >= LOOT.statueTime) {
          s.used = true;
          p.energy = Math.min(PLAYER.energyMax, p.energy + LOOT.statueEnergy);
          addDamageNumber(this.damageNumbers, s.x, s.y - 24, '+20 energy', '#76dde0', 16);
          this.audio.play('heal');
          this.updateHUD();
        }
      } else {
        s.channel = 0;
      }
    }
  }

  // ---- run end ----
  endRun(result) {
    if (this.done) return;
    if (result === 'victory') {
      this.score += VICTORY_BONUS;
      this.state = 'victory';
    } else {
      this.score += DEFEAT_PER_WAVE * Math.max(0, this.wave - 1);
      this.state = 'defeat';
    }
    this.done = {
      result,
      score: this.score,
      wave: this.wave,
      time: Math.round(this.time * 10) / 10,
      kills: this.kills,
      hp: Math.max(0, Math.round(this.player.hp)),
      maxHp: this.player.maxHp,
      coins: this.coins,
      shards: this.shards,
      fieldHash: this.field.hash,
    };
    try {
      const best = Number(localStorage.getItem('mosslight-best') || 0);
      if (this.score > best) localStorage.setItem('mosslight-best', String(this.score));
      this.done.best = Math.max(best, this.score);
    } catch (e) { this.done.best = this.score; }
    this.showResult();
    this.updateHUD();
  }

  // ---- the deterministic bot (autotest + shot modes) ----
  // Telegraph dodge (autotest bot): a unit direction to flee, or null.
  // Reads the same telegraphs the renderer draws, so the bot reacts to
  // what a player sees: ring circles (boss ring, brambler slam, boss echo
  // marks), the boss fan, and tinket aim lines.
  botDodgeDir() {
    const p = this.player;
    const r = p.radius;
    // Ring telegraphs: leave the circle (radially away from its centre).
    for (const tg of this.telegraphs) {
      if (tg.kind === 'ring') {
        const d = dist(p.x, p.y, tg.x, tg.y);
        if (d < tg.r + r + 12) {
          const dx = p.x - tg.x, dy = p.y - tg.y;
          const dl = Math.hypot(dx, dy) || 1;
          return { x: dx / dl, y: dy / dl };
        }
      }
    }
    // Boss fan: the shards fly at the player, so strafe sideways.
    const boss = this.boss;
    if (boss && boss.state === 'fanTel') {
      const dx = p.x - boss.x, dy = p.y - boss.y;
      const dl = Math.hypot(dx, dy) || 1;
      const s = this.bot.orbitDir || 1;
      return { x: -(dy / dl) * s, y: (dx / dl) * s };
    }
    // Tinket aim line: step off the line (perpendicular).
    for (const tg of this.telegraphs) {
      if (tg.kind === 'aim') {
        const dx = tg.x1 - tg.x0, dy = tg.y1 - tg.y0;
        const len2 = dx * dx + dy * dy || 1;
        let tt = ((p.x - tg.x0) * dx + (p.y - tg.y0) * dy) / len2;
        tt = Math.max(0, Math.min(1, tt));
        const cx = tg.x0 + dx * tt, cy = tg.y0 + dy * tt;
        if (dist(p.x, p.y, cx, cy) < 26) {
          const dl = Math.hypot(dx, dy) || 1;
          return { x: -(dy / dl), y: dx / dl };
        }
      }
    }
    return null;
  }

  botStep(dt) {
    const p = this.player;
    const b = this.bot;
    // Stuck detection (v3 bot): barely moved for 1.5s -> wander in a
    // seeded-random direction for 0.7s (escapes corners and wedges).
    if (Math.hypot(p.x - b.lastX, p.y - b.lastY) < 0.5) b.stuckT += dt;
    else { b.stuckT = 0; b.lastX = p.x; b.lastY = p.y; }
    if (b.stuckT > 1.5) {
      const u = this.rng.unit();
      b.wanderX = u.x; b.wanderY = u.y;
      b.wanderT = 0.7;
      b.stuckT = 0;
    }
    // Telegraph dodge (highest priority): move directly.
    let dodged = false;
    let dodge = this.botDodgeDir();
    if (!dodge && b.wanderT > 0) {
      b.wanderT -= dt;
      dodge = { x: b.wanderX, y: b.wanderY };
    }
    if (dodge) {
      const moved = moveField(p.x, p.y, p.moveRadius, dodge.x * p.speed * dt, dodge.y * p.speed * dt);
      p.x = moved.x; p.y = moved.y;
      p.fx = dodge.x; p.fy = dodge.y; // dodge dir is already a unit vector
      p.faceAngle = Math.atan2(dodge.y, dodge.x); // renderer only
      p.moving = true;
      dodged = true;
    }
    // Movement target.
    let tx = null, ty = null, mode = 'chase';
    if (this.boss) {
      // Hold a 150-160px ring around the boss, orbiting slowly.
      const d = dist(p.x, p.y, this.boss.x, this.boss.y);
      b.orbitT -= dt;
      if (b.orbitT <= 0) { b.orbitDir *= -1; b.orbitT = 2; }
      const dx = p.x - this.boss.x, dy = p.y - this.boss.y;
      const dl = Math.hypot(dx, dy) || 1;
      const ux = dx / dl, uy = dy / dl;
      if (d < 140) {
        // Back away along the radial.
        tx = this.boss.x + ux * 175;
        ty = this.boss.y + uy * 175;
      } else if (d > 175) {
        tx = this.boss.x + ux * 155;
        ty = this.boss.y + uy * 155;
      } else {
        // Orbit tangentially: rotate the radial by +/-0.5 rad.
        const s = SIN05 * b.orbitDir;
        tx = this.boss.x + (ux * COS05 - uy * s) * 160;
        ty = this.boss.y + (ux * s + uy * COS05) * 160;
      }
      mode = 'boss';
    } else if (this.enemies.length) {
      // Nearest enemy; kite inside bolt range, back off when crowded.
      let near = null, nd = Infinity;
      for (const e of this.enemies) {
        const d = dist(p.x, p.y, e.x, e.y);
        if (d < nd) { nd = d; near = e; }
      }
      if (near) {
        const dx = p.x - near.x, dy = p.y - near.y;
        const dl = Math.hypot(dx, dy) || 1;
        const ux = dx / dl, uy = dy / dl;
        if (nd < 70) {
          tx = p.x + ux * 90;
          ty = p.y + uy * 90;
        } else if (nd > 165) {
          tx = near.x; ty = near.y;
        } else {
          // Strafe: hold range, drift sideways (rotate radial by 0.6 rad).
          tx = near.x + (ux * COS06 - uy * SIN06) * 150;
          ty = near.y + (ux * SIN06 + uy * COS06) * 150;
        }
        mode = 'chase';
      }
    } else {
      // Nothing to fight: drift toward the field centre so the next
      // spawn group finds the player nearby.
      tx = FIELD_W / 2;
      ty = FIELD_H / 2;
      mode = 'idle';
    }
    // Open field: walk straight at the target (no walls, no pathfinding).
    if (dodged) {
      // Already moved directly (dodge / wander); nothing more here.
    } else if (tx !== null) {
      const dx = tx - p.x, dy = ty - p.y;
      const d = Math.hypot(dx, dy);
      if (d > 8) {
        const moved = moveField(p.x, p.y, p.moveRadius, (dx / d) * p.speed * dt, (dy / d) * p.speed * dt);
        p.x = moved.x; p.y = moved.y;
        p.fx = dx / d; p.fy = dy / d;
        p.faceAngle = Math.atan2(dy, dx); // renderer only
        p.moving = true;
      } else {
        p.moving = false;
      }
    } else {
      p.moving = false;
    }
    if (mode !== 'chase' && mode !== 'boss') p.moving = p.moving && true;
    // Skills: use them when they clearly help.
    const nearCount = (r) => this.enemies.filter((e) => dist(p.x, p.y, e.x, e.y) <= r).length
      + (this.boss && dist(p.x, p.y, this.boss.x, this.boss.y) <= r ? 1 : 0);
    if (p.cooldowns.crescent <= 0 && p.energy >= SKILLS.crescent.cost && nearCount(SKILLS.crescent.range + 10) >= 2) {
      this.castSkill('crescent');
    }
    if (p.cooldowns.ember <= 0 && p.energy >= SKILLS.ember.cost && (this.boss || nearCount(120) >= 2)) {
      this.castSkill('ember');
    }
    if (p.cooldowns.glassguard <= 0 && p.energy >= SKILLS.glassguard.cost && p.hp < 50 && nearCount(70) >= 1) {
      this.castSkill('glassguard');
    }
    if (p.cooldowns.starfall <= 0 && p.energy >= SKILLS.starfall.cost
      && ((this.boss && dist(p.x, p.y, this.boss.x, this.boss.y) <= SKILLS.starfall.range) || nearCount(SKILLS.starfall.range) >= 4)) {
      this.castSkill('starfall');
    }
  }

  botIntermission() {
    if (!this.offers.length) return;
    const p = this.player;
    const pref = ['charm', 'wick', 'hands', 'thread', 'cape'];
    let pick = null;
    if (p.hp < 60) {
      pick = this.offers.find((o) => o.id === 'cape') || null;
    }
    if (!pick) pick = this.offers.find((o) => pref.includes(o.id) && pref.indexOf(o.id) === Math.min(...this.offers.map((x) => pref.indexOf(x.id))));
    if (!pick) pick = this.offers[0];
    if (pick) this.buyUpgrade(pick.id);
  }

  // ---- HUD + minimap (DOM, kept from v3) ----
  updateHUD() {
    const $ = (id) => document.getElementById(id);
    const p = this.player;
    if (!p) return;
    const hpBar = $('hpFill'), hpText = $('hpText');
    if (hpBar) {
      hpBar.style.width = `${(p.hp / p.maxHp) * 100}%`;
      hpBar.classList.toggle('low', p.hp <= FEEL.lowHp);
    }
    if (hpText) hpText.textContent = `HP ${Math.ceil(p.hp)} / ${p.maxHp}`;
    const enBar = $('energyFill'), enText = $('energyText');
    if (enBar) enBar.style.width = `${(p.energy / PLAYER.energyMax) * 100}%`;
    if (enText) enText.textContent = `${Math.floor(p.energy)} / ${PLAYER.energyMax}`;
    const waveEl = $('waveText');
    if (waveEl) waveEl.textContent = `WAVE ${Math.max(1, this.wave)} / ${WAVE_COUNT}`;
    const timerEl = $('timerText');
    if (timerEl) {
      const t = Math.max(0, this.state === 'intermission' ? this.interT : this.waveT);
      timerEl.textContent = `0:${String(Math.floor(t)).padStart(2, '0')}`;
    }
    const areaEl = $('areaText');
    if (areaEl) areaEl.textContent = AREA_NAMES[this.area];
    const coinEl = $('coinCount');
    if (coinEl) coinEl.textContent = String(this.coins);
    const shardEl = $('shardCount');
    if (shardEl) shardEl.textContent = String(this.shards);
    const bossWrap = $('bossWrap');
    if (bossWrap) {
      bossWrap.style.display = this.boss && this.state === 'playing' ? 'block' : 'none';
      if (this.boss) {
        const bf = $('bossFill');
        if (bf) bf.style.width = `${(this.boss.hp / this.boss.maxHp) * 100}%`;
        const bt = $('bossText');
        if (bt) bt.textContent = `${BOSS.name} — ${Math.max(0, Math.ceil(this.boss.hp))} / ${this.boss.maxHp}`;
      }
    }
    // Skill buttons: cooldown sweep + energy state.
    for (const id of ['crescent', 'ember', 'glassguard', 'starfall']) {
      const btn = document.getElementById(`skill-${id}`);
      if (!btn) continue;
      const cd = p.cooldowns[id] / SKILLS[id].cd;
      btn.style.setProperty('--cd', String(cd));
      btn.classList.toggle('ready', cd <= 0 && p.energy >= SKILLS[id].cost);
      btn.classList.toggle('cooling', cd > 0);
    }
    const scoreEl = $('scoreText');
    if (scoreEl) scoreEl.textContent = `Score ${this.score}`;
  }

  drawMinimap() {
    const cv = document.getElementById('minimap');
    if (!cv) return;
    const ctx = cv.getContext('2d');
    const S = cv.width; // square canvas
    // Uniform scale (the field is 2400x1800, 4:3): keep proportions,
    // centre the shorter side vertically.
    const s = S / FIELD_W;
    const offY = (S - FIELD_H * s) / 2;
    const px = (x) => x * s;
    const py = (y) => offY + y * s;
    ctx.clearRect(0, 0, S, S);
    // Round clip.
    ctx.save();
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2);
    ctx.clip();
    const pal = AREAS[this.area];
    // Fill the whole circle with ground colour first: the field is 4:3
    // inside a round map, so the bands above/below it must read as
    // terrain, never as black empty space.
    ctx.fillStyle = pal.floor;
    ctx.fillRect(0, 0, S, S);
    // Open field: the whole map is terrain — coarse checker for texture.
    const cell = 150; // px per checker cell, world scale
    for (let gy = 0; gy < FIELD_H / cell; gy++) {
      for (let gx = 0; gx < FIELD_W / cell; gx++) {
        ctx.fillStyle = (gx + gy) % 2 ? pal.floor : pal.floorAlt;
        ctx.fillRect(px(gx * cell), py(gy * cell), cell * s + 0.6, cell * s + 0.6);
      }
    }
    const dot = (x, y, r, fill) => {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.arc(px(x), py(y), r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.65)';
      ctx.lineWidth = 1;
      ctx.stroke();
    };
    for (const e of this.enemies) dot(e.x, e.y, 3, '#ff4f6a');
    if (this.boss) dot(this.boss.x, this.boss.y, 5, '#ffd76a');
    const p = this.player;
    dot(p.x, p.y, 3.5, '#ffffff');
    ctx.strokeStyle = '#ffd76a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(px(p.x), py(p.y), 5.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // ---- panels (DOM) ----
  showIntermission() {
    const panel = document.getElementById('interPanel');
    const row = document.getElementById('offerRow');
    if (!panel || !row) return;
    row.innerHTML = '';
    for (const o of this.offers) {
      const div = document.createElement('div');
      div.className = 'offer';
      div.innerHTML = `<b>${o.name}</b><span>${o.desc}</span><em>${o.cost} ${o.cur === 'coin' ? '🪙' : '💎'}</em>`;
      div.onclick = () => { this.buyUpgrade(o.id); this.refreshOffers(); };
      row.appendChild(div);
    }
    const skip = document.createElement('div');
    skip.className = 'offer skip';
    skip.innerHTML = '<b>Skip</b><span>save for later</span><em>—</em>';
    skip.onclick = () => { this.hideIntermission(); };
    row.appendChild(skip);
    panel.style.display = 'block';
  }

  refreshOffers() {
    this.showIntermission();
  }

  hideIntermission() {
    const panel = document.getElementById('interPanel');
    if (panel) panel.style.display = 'none';
  }

  showResult() {
    const panel = document.getElementById('resultPanel');
    if (!panel) return;
    const title = document.getElementById('resultTitle');
    const body = document.getElementById('resultBody');
    if (title) title.textContent = this.done.result === 'victory' ? 'VICTORY' : 'DEFEAT';
    if (body) {
      body.innerHTML = `Score <b>${this.done.score}</b> &nbsp;·&nbsp; Best ${this.done.best}<br>` +
        `Wave ${this.done.wave} / ${WAVE_COUNT} &nbsp;·&nbsp; ${this.done.kills} kills &nbsp;·&nbsp; ${this.done.time}s<br>` +
        (this.done.result === 'victory'
          ? 'You defeated the Gloam Bell and relit the wilds!'
          : 'The wilds keep their light… for now.');
    }
    panel.style.display = 'block';
  }

  hideResult() {
    const panel = document.getElementById('resultPanel');
    if (panel) panel.style.display = 'none';
  }

  // ---- shot conditions (screenshot hooks) ----
  shotConditionMet() {
    const shot = this.opts.shot;
    if (!shot) return false;
    if (shot === 'start') return this.state === 'title';
    if (this.state !== 'playing') return false;
    if (shot === 'combat') {
      return this.wave >= 1 && this.wave <= 3 && this.enemies.length >= 8 && this.loot.length >= 1;
    }
    if (shot === 'cinder') {
      return this.wave >= 4 && this.wave <= 6 && this.enemies.length >= 8;
    }
    if (shot === 'boss') {
      if (this.wave !== 8 || !this.boss) return false;
      if (this.boss.hp >= this.boss.maxHp * 0.5) return false;
      if (this.player.y <= this.boss.y) return false; // Neri below the boss
      return this.telegraphs.some((t) => t.owner === this.boss && t.kind === 'ring');
    }
    return false;
  }

  shotPreconditionMet() {
    const shot = this.opts.shot;
    if (!shot || shot === 'start') return true;
    if (this.state !== 'playing') return false;
    if (shot === 'combat') return this.wave >= 1 && this.wave <= 3 && this.enemies.length >= 6;
    if (shot === 'cinder') return this.wave >= 4 && this.enemies.length >= 5;
    if (shot === 'boss') return this.wave === 8 && this.boss && this.boss.hp < this.boss.maxHp * 0.62;
    return false;
  }

  // If a shot run ends before its condition, restart on the next seed.
  maybeRestartShot() {
    if (!this.opts.shot || this.shotReady) return false;
    if (this.done && this.shotSeedTries < 5) {
      this.shotSeedTries++;
      this.seed += 1;
      this.buildRun();
      this.state = 'playing';
      this.startWave(1);
      this.hideResult();
      return true;
    }
    return false;
  }
}
