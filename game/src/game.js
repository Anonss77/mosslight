// Mosslight — game orchestration: state machine, waves, combat, rendering,
// HUD, minimap, the deterministic autotest bot, and screenshot hooks.
// All sim numbers come from config.js; all randomness from the run RNG.

import {
  VIEW_W, VIEW_H, TILE, WORLD_W, WORLD_H, SCALE, STEP, AREAS, areaOfWave,
  WAVES, WAVE_LEN, GROUP_EVERY, INTERMISSION_LEN, MAX_ENEMIES, MIN_SPAWN_DIST,
  HERO, SKILLS, ENEMIES, BOSS, LOOT, SCORE, FEEL,
} from './config.js';
import { Rng } from './random.js';
import { Dungeon, bakeLayer } from './dungeon.js';
import { buildSprites } from './sprites.js';
import { Sfx } from './audio.js';
import { Input } from './input.js';
import {
  Player, Enemy, Boss, Projectiles, Loot, Particles, DamageNumbers,
  EmberPatches, SpatialHash,
} from './entities.js';

const $ = (id) => document.getElementById(id);

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.sprites = buildSprites();
    this.sfx = new Sfx();
    this.input = new Input(canvas);
    this.hash = new SpatialHash();
    this.state = 'title';
    this.botMode = false;
    this.frozen = false;          // shot freeze: render continues, sim stops
    this.speed = 1;               // sim steps per frame (accelerated in tests)
    this.hitStop = 0;
    this.shakeT = 0; this.shakeMag = 0;
    this.time = 0;                // total sim time (seconds)
    this.frame = 0;
    this.shotReady = false;
    this.done = null;             // autotest result
    this.bot = { stuckT: 0, lastX: 0, lastY: 0, wanderT: 0, wanderX: 0, wanderY: 0 };
    this.botSkills = [];
    this.botMove = { x: 0, y: 0 };
    this.interBotT = 0;
    this.bindUi();
    this.showTitle();
  }

  // ---------------------------------------------------------- UI wiring
  bindUi() {
    this.input.bindJoystick($('joystick'), $('joyThumb'));
    for (const s of SKILLS) this.input.bindSkillButton($('skill-' + s.id), s.id);
    $('startBtn').addEventListener('click', () => {
      this.sfx.ensure();
      const seed = parseInt($('seedInput').value, 10);
      this.startRun(Number.isFinite(seed) ? seed : (Math.random() * 1e9) | 0);
    });
    $('seedInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') $('startBtn').click();
    });
    $('skipBtn').addEventListener('click', () => this.endIntermission(null));
    $('resumeBtn').addEventListener('click', () => this.setState('playing'));
    $('restartBtn').addEventListener('click', () => this.startRun(this.seed));
    $('quitBtn').addEventListener('click', () => this.showTitle());
    $('againBtn').addEventListener('click', () => this.startRun(this.seed));
    $('titleBtn').addEventListener('click', () => this.showTitle());
    $('muteBtn').addEventListener('click', () => {
      this.sfx.muted = !this.sfx.muted;
      $('muteBtn').textContent = this.sfx.muted ? '🔇' : '🔊';
    });
    // Title hero portrait: the baked Neri sprite as a data URL.
    const heroImg = $('titleHero');
    if (heroImg) heroImg.src = this.sprites.neri[0].toDataURL();
    const mothImg = $('titleMoth');
    if (mothImg) mothImg.src = this.sprites.moth[0].toDataURL();
  }

  setState(s) {
    this.state = s;
    for (const id of ['title', 'hud', 'intermission', 'pausePanel', 'result']) {
      $(id).classList.toggle('hidden', id !== s && !(s === 'playing' && id === 'hud'));
    }
    $('hud').classList.toggle('hidden', s === 'title' || s === 'victory' || s === 'defeat');
    $('title').classList.toggle('hidden', s !== 'title');
    $('intermission').classList.toggle('hidden', s !== 'intermission');
    $('pausePanel').classList.toggle('hidden', s !== 'paused');
    $('result').classList.toggle('hidden', s !== 'victory' && s !== 'defeat');
  }

  showTitle() {
    this.setState('title');
    const best = JSON.parse(localStorage.getItem('mosslight-best') || '{"score":0,"wave":0,"coins":0}');
    $('bestScore').textContent = `Best: ${best.score} pts · Wave ${best.wave} · ${best.coins} coins`;
    if (!$('seedInput').value) $('seedInput').value = String((Math.random() * 1e9) | 0);
  }

  // ---------------------------------------------------------- run setup
  startRun(seed) {
    this.seed = seed;
    this.rng = new Rng(seed);
    this.dungeon = new Dungeon(seed);
    this.layer = bakeLayer(this.dungeon, 0);
    this.area = 0;
    const start = this.dungeon.playerStart();
    this.player = new Player(start.x, start.y);
    this.enemies = [];
    this.boss = null;
    this.projectiles = new Projectiles();
    this.loot = new Loot();
    this.loot.onCollect = (l) => this.collectLoot(l);
    this.particles = new Particles();
    this.dmgNums = new DamageNumbers();
    this.embers = new EmberPatches();
    this.wave = 1;
    this.waveT = WAVE_LEN;
    this.groupsSpawned = 0;
    this.interT = 0;
    this.offers = [];
    this.kills = 0;
    this.coins = 0;
    this.shards = 0;
    this.score = 0;
    this.time = 0;
    this.frame = 0;
    this.hitStop = 0;
    this.victoryT = 0;
    this.warnT = 0;
    this.slashT = 0;
    this.starfallFx = null;
    this.cam = { x: 0, y: 0 };
    this.done = null;
    this.shotReady = false;
    this.setState('playing');
    this.sfx.ensure();
  }

  // ---------------------------------------------------------- main loop
  loop = (t) => {
    requestAnimationFrame(this.loop);
    const steps = this.state === 'title' ? 1 : this.speed;
    for (let i = 0; i < steps; i++) {
      if (this.hitStop > 0) { this.hitStop--; }
      else this.update(STEP);
      this.frame++;
    }
    if (!this.headless) { this.render(); this.updateHud(); }
  };

  start() { requestAnimationFrame(this.loop); }

  update(dt) {
    if (this.frozen) return;
    this.time += dt;
    if (this.input.takePause() && (this.state === 'playing' || this.state === 'paused')) {
      this.setState(this.state === 'playing' ? 'paused' : 'playing');
      return;
    }
    if (this.state === 'title' || this.state === 'paused' || this.state === 'shot') return;
    if (this.state === 'victory' || this.state === 'defeat') {
      this.particles.update(dt);
      this.dmgNums.update(dt);
      return;
    }
    if (this.state === 'intermission') {
      this.interT -= dt;
      this.particles.update(dt);
      this.dmgNums.update(dt);
      if (this.botMode) {
        this.interBotT -= dt;
        if (this.interBotT <= 0) this.endIntermission(this.botChooseOffer());
      }
      if (this.interT <= 0) this.endIntermission('auto');
      return;
    }
    // state === 'playing'
    if (this.botMode) this.botThink();
    this.updatePlayer(dt);
    this.updateEnemies(dt);
    if (this.boss) this.updateBoss(dt);
    this.projectiles.update(dt, this.dungeon);
    this.loot.update(dt, this.player);
    this.particles.update(dt);
    this.dmgNums.update(dt);
    for (const p of this.embers.update(dt)) this.emberTick(p);
    this.updateWave(dt);
    if (this.shakeT > 0) this.shakeT -= dt;
    if (this.slashT > 0) this.slashT -= dt;
    if (this.starfallFx) {
      this.starfallFx.t -= dt;
      if (this.starfallFx.t <= 0) this.starfallFx = null;
    }
    // Low-HP warning beep every 5s.
    if (this.player.hp <= FEEL.lowHp && this.player.hp > 0) {
      this.warnT -= dt;
      if (this.warnT <= 0) { this.warnT = 5; this.sfx.warning(); }
    }
    // Victory celebration beat.
    if (this.victoryT > 0) {
      this.victoryT -= dt;
      if (this.victoryT <= 0) this.finishVictory();
    }
    if (!this.player.alive) this.finishDefeat();
  }

  // ---------------------------------------------------------- player
  updatePlayer(dt) {
    const p = this.player;
    if (!p.alive) return;
    // Timers.
    if (p.invuln > 0) p.invuln -= dt;
    if (p.shieldTime > 0) { p.shieldTime -= dt; if (p.shieldTime <= 0) p.shield = 0; }
    for (const k of Object.keys(p.cooldowns)) if (p.cooldowns[k] > 0) p.cooldowns[k] -= dt;
    p.energy = Math.min(HERO.maxEnergy, p.energy + HERO.energyRegen * dt);
    // Starfall wind-up resolves into the blast.
    if (p.starfallWindup > 0) {
      p.starfallWindup -= dt;
      if (p.starfallWindup <= 0) this.resolveStarfall();
    }
    // Movement (axis-separated so walls slide instead of sticking).
    const mv = this.botMode ? this.botMove : this.input.moveVec();
    p.moving = mv.x !== 0 || mv.y !== 0;
    if (p.moving) {
      p.facing = { x: mv.x, y: mv.y };
      p.walkPhase += dt * 10;
      const sp = HERO.speed;
      const nx = p.x + mv.x * sp * dt;
      if (!this.dungeon.hitsWall(nx, p.y, p.moveRadius)) p.x = nx;
      const ny = p.y + mv.y * sp * dt;
      if (!this.dungeon.hitsWall(p.x, ny, p.moveRadius)) p.y = ny;
    }
    // Glassguard thorns: moving through enemies hurts them.
    if (p.shield > 0) {
      const near = this.hash.query(p.x, p.y, p.radius + 14, []);
      for (const e of near) {
        if (e.thornT > 0) continue;
        e.thornT = 0.5;
        this.damageEnemy(e, 10, '#7FD4FF');
      }
    }
    // Skills.
    for (const id of this.input.takeSkills()) this.trySkill(id);
    if (this.botMode) for (const id of this.botSkills.splice(0)) this.trySkill(id);
    // Automatic lantern bolt: in the boss fight the boss is the priority
    // target (the adds are the skills' job); an add only steals the bolt
    // when it is right on top of the player (about to deal contact damage).
    p.boltTimer -= dt;
    if (p.boltTimer <= 0) {
      let target = this.nearestEnemy(p.x, p.y, p.boltRange);
      if (this.boss && !this.boss.dead) {
        const bd = Math.hypot(this.boss.x - p.x, this.boss.y - p.y);
        const ed = target ? Math.hypot(target.x - p.x, target.y - p.y) : Infinity;
        if (bd <= p.boltRange && ed > 20) target = this.boss;
      }
      if (target) {
        p.boltTimer = p.boltInterval;
        const dx = target.x - p.x, dy = target.y - p.y;
        const d = Math.hypot(dx, dy) || 1;
        this.projectiles.spawn(p.x, p.y, (dx / d) * HERO.boltSpeed, (dy / d) * HERO.boltSpeed, p.boltDamage, 'player', 4, 2);
        this.sfx.hit();
      } else {
        p.boltTimer = 0.1;
      }
    }
    // Bolt hits.
    for (let i = this.projectiles.list.length - 1; i >= 0; i--) {
      const pr = this.projectiles.list[i];
      if (pr.from !== 'player') continue;
      const hit = this.enemyAt(pr.x, pr.y, pr.radius + 10);
      if (hit) {
        this.projectiles.list.splice(i, 1);
        this.damageEnemy(hit, pr.damage, '#FFFFFF');
        this.hitStop = Math.max(this.hitStop, FEEL.hitStopBolt);
      }
    }
  }

  trySkill(id) {
    const p = this.player;
    if (!p.alive || p.starfallWindup > 0) return;
    const def = SKILLS.find((s) => s.id === id);
    if (!def) return;
    if (p.cooldowns[id] > 0 || p.energy < def.cost) return;
    p.energy -= def.cost;
    p.cooldowns[id] = def.cooldown;
    this.sfx.skill();
    if (id === 'crescent') {
      this.slashT = 0.15;
      const near = this.hash.query(p.x, p.y, def.radius + 12, []);
      for (const e of near) this.damageEnemy(e, def.damage + p.skillBonus.cut, def.color);
      if (this.boss && !this.boss.dead && Math.hypot(this.boss.x - p.x, this.boss.y - p.y) < def.radius + this.boss.radius) {
        this.damageBoss(def.damage + p.skillBonus.cut);
      }
      this.hitStop = Math.max(this.hitStop, FEEL.hitStopCut);
    } else if (id === 'ember') {
      // Aim: the boss first when it is in range, else the nearest enemy
      // within aim range, else the facing direction.
      let target = null;
      if (this.boss && !this.boss.dead && Math.hypot(this.boss.x - p.x, this.boss.y - p.y) <= def.aimRange) target = this.boss;
      else target = this.nearestEnemy(p.x, p.y, def.aimRange);
      const ax = target ? target.x : p.x + p.facing.x * def.aimRange;
      const ay = target ? target.y : p.y + p.facing.y * def.aimRange;
      this.embers.spawn(ax, ay, def.damage, def.tickDamage + p.skillBonus.ember);
      const near = this.hash.query(ax, ay, def.radius + 12, []);
      for (const e of near) this.damageEnemy(e, def.damage, def.color);
      if (this.boss && !this.boss.dead && Math.hypot(this.boss.x - ax, this.boss.y - ay) < def.radius + this.boss.radius) {
        this.damageBoss(def.damage);
      }
    } else if (id === 'glassguard') {
      p.shield = def.shield;
      p.shieldTime = def.duration;
      this.sfx.shield();
    } else if (id === 'starfall') {
      p.starfallWindup = def.windup;
      this.starfallFx = { t: def.windup, x: p.x, y: p.y };
    }
  }

  resolveStarfall() {
    const p = this.player;
    const def = SKILLS[3];
    const dmg = def.damage + p.skillBonus.star;
    const near = this.hash.query(p.x, p.y, def.radius + 14, []);
    for (const e of near) {
      this.damageEnemy(e, dmg, def.color);
      const dx = e.x - p.x, dy = e.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      e.kbx += (dx / d) * 300; e.kby += (dy / d) * 300;
    }
    if (this.boss && !this.boss.dead && Math.hypot(this.boss.x - p.x, this.boss.y - p.y) < def.radius + this.boss.radius) {
      this.damageBoss(dmg);
    }
    this.particles.burst(p.x, p.y, 20, ['#FFD76A', '#FFF3C4', '#FF8A2A'], this.rng, 200);
    this.shake(FEEL.shakeStarfall[0], FEEL.shakeStarfall[1]);
    this.hitStop = Math.max(this.hitStop, FEEL.hitStopStarfall);
    this.sfx.skill();
  }

  emberTick(patch) {
    const near = this.hash.query(patch.x, patch.y, patch.radius + 12, []);
    for (const e of near) {
      if (patch.hitIds.has(e.id)) continue;
      patch.hitIds.add(e.id);
      this.damageEnemy(e, patch.tickDamage, '#FF8A2A');
    }
    if (this.boss && !this.boss.dead && Math.hypot(this.boss.x - patch.x, this.boss.y - patch.y) < patch.radius + this.boss.radius) {
      this.damageBoss(patch.tickDamage);
    }
  }

  // ---------------------------------------------------------- enemies
  nearestEnemy(x, y, range) {
    let best = null, bestD = range * range;
    const cands = this.hash.query(x, y, range, []);
    for (const e of cands) {
      const d = (e.x - x) ** 2 + (e.y - y) ** 2;
      if (d < bestD) { bestD = d; best = e; }
    }
    if (this.boss && !this.boss.dead) {
      const d = (this.boss.x - x) ** 2 + (this.boss.y - y) ** 2;
      if (d < bestD && d <= range * range) { best = this.boss; }
    }
    return best;
  }

  enemyAt(x, y, r) {
    const cands = this.hash.query(x, y, r, []);
    for (const e of cands) {
      const dx = e.x - x, dy = e.y - y;
      if (dx * dx + dy * dy < (r + e.radius) * (r + e.radius) * 0.6) return e;
    }
    if (this.boss && !this.boss.dead) {
      const dx = this.boss.x - x, dy = this.boss.y - y;
      if (dx * dx + dy * dy < (r + this.boss.radius) ** 2 * 0.7) return this.boss;
    }
    return null;
  }

  damageEnemy(e, amount, color) {
    if (e.dead) return;
    // The boss shares the enemyAt hit path (bolt), but its hurt() returns
    // phase strings ('phase2' is truthy) — routing it through killEnemy
    // would crash on e.def and skip the victory. It has its own handler.
    if (e === this.boss) { this.damageBoss(amount); return; }
    const died = e.hurt(amount);
    this.dmgNums.add(e.x, e.y - 14, amount, color);
    if (died) this.killEnemy(e);
  }

  damageBoss(amount) {
    if (!this.boss || this.boss.dead) return;
    const res = this.boss.hurt(amount);
    this.dmgNums.add(this.boss.x, this.boss.y - 30, amount, '#FFD76A');
    if (res === 'phase2' || res === 'phase3') {
      this.boss.state = 'roar'; this.boss.stateT = BOSS.roarTime;
      this.sfx.bossRoar();
    }
    if (res === 'dead') this.killBoss();
  }

  killEnemy(e) {
    this.kills++;
    this.score += SCORE.enemy;
    this.particles.burst(e.x, e.y, FEEL.deathParticles, ['#FF7FA8', '#9BD96A', '#C9973F', '#FFF3C4'], this.rng);
    this.sfx.death();
    // Loot: coins always; hearts only when the player is hurt; shards for bramblers.
    this.loot.spawn('coin', e.x, e.y, 1, this.rng);
    if (e.type === 'brambler') this.loot.spawn('coin', e.x + 8, e.y - 6, 1, this.rng);
    if (this.player.hp < this.player.maxHp && this.rng.chance(e.def.heartChance)) {
      this.loot.spawn('heart', e.x - 8, e.y + 4, 1, this.rng);
    }
    if (e.def.shardChance && this.rng.chance(e.def.shardChance)) {
      this.loot.spawn('shard', e.x + 4, e.y + 8, 1, this.rng);
    }
    this.enemies.splice(this.enemies.indexOf(e), 1);
  }

  killBoss() {
    this.score += SCORE.boss;
    this.particles.burst(this.boss.x, this.boss.y, FEEL.bossDeathParticles, ['#76DDE0', '#FFD76A', '#FFF3C4', '#B9A9F0'], this.rng, 260);
    this.shake(FEEL.shakeBossDie[0], FEEL.shakeBossDie[1]);
    // Boss loot: 30 coins, 3 shards, one big heart (+30 HP).
    for (let i = 0; i < 10; i++) this.loot.spawn('coin', this.boss.x + this.rng.range(-30, 30), this.boss.y + this.rng.range(-30, 30), 3, this.rng);
    for (let i = 0; i < 3; i++) this.loot.spawn('shard', this.boss.x + this.rng.range(-24, 24), this.boss.y + this.rng.range(-24, 24), 1, this.rng);
    this.loot.spawn('bigheart', this.boss.x, this.boss.y - 20, 1, this.rng);
    this.boss = null;
    this.victoryT = 2;
  }

  updateEnemies(dt) {
    // Rebuild the spatial hash every step (cheap at <=80 enemies).
    this.hash.clear();
    for (const e of this.enemies) this.hash.insert(e);
    const p = this.player;
    for (const e of [...this.enemies]) {
      if (e.flash > 0) e.flash -= dt;
      if (e.thornT > 0) e.thornT -= dt;
      if (e.cooldown > 0) e.cooldown -= dt;
      // Knockback decay.
      e.x += e.kbx * dt; e.y += e.kby * dt;
      e.kbx *= 0.86; e.kby *= 0.86;
      const dx = p.x - e.x, dy = p.y - e.y;
      const dist = Math.hypot(dx, dy) || 1;
      const def = e.def;
      // Follow a BFS path to the player (re-pathed every second); direct
      // line movement gets stuck on walls in a room-and-corridor dungeon.
      const stepToward = (sp) => {
        e.repathT -= dt;
        if (!e.path || e.repathT <= 0) {
          e.path = this.dungeon.findPath(e.x, e.y, p.x, p.y) || [];
          e.pathIdx = 0;
          e.repathT = 1;
        }
        let tx = p.x, ty = p.y;
        if (e.pathIdx < e.path.length) {
          const node = e.path[e.pathIdx];
          if (Math.hypot(node.x - e.x, node.y - e.y) < 10) e.pathIdx++;
          if (e.pathIdx < e.path.length) { tx = e.path[e.pathIdx].x; ty = e.path[e.pathIdx].y; }
        }
        const mx = tx - e.x, my = ty - e.y;
        const md = Math.hypot(mx, my) || 1;
        const nx = e.x + (mx / md) * sp * dt;
        if (!this.dungeon.hitsWall(nx, e.y, e.moveRadius)) e.x = nx;
        const ny = e.y + (my / md) * sp * dt;
        if (!this.dungeon.hitsWall(e.x, ny, e.moveRadius)) e.y = ny;
      };
      if (e.type === 'puffcap') {
        if (e.state === 'chase') {
          stepToward(e.speed);
          if (dist <= def.attackRange && e.cooldown <= 0) { e.state = 'pause'; e.stateT = def.pause; }
        } else if (e.state === 'pause') {
          e.stateT -= dt;
          if (e.stateT <= 0) { e.state = 'hop'; e.stateT = def.hopTime; e.hopFrom = { x: e.x, y: e.y }; }
        } else if (e.state === 'hop') {
          e.stateT -= dt;
          const t = 1 - Math.max(0, e.stateT / def.hopTime);
          const hx = e.hopFrom.x + (dx / dist) * def.hopDist * t;
          const hy = e.hopFrom.y + (dy / dist) * def.hopDist * t;
          if (!this.dungeon.hitsWall(hx, hy, e.moveRadius)) { e.x = hx; e.y = hy; }
          if (dist <= e.radius + p.radius + 4 && p.alive) this.hurtPlayer(def.damage);
          if (e.stateT <= 0) { e.state = 'chase'; e.cooldown = def.cooldown; }
        }
      } else if (e.type === 'tinket') {
        if (e.state === 'chase') {
          if (dist > def.attackRange) stepToward(e.speed);
          else if (e.cooldown <= 0) { e.state = 'aim'; e.stateT = def.aimTime; e.aimAngle = Math.atan2(dy, dx); }
        } else if (e.state === 'aim') {
          e.stateT -= dt;
          e.aimAngle = Math.atan2(dy, dx);
          if (e.stateT <= 0) {
            this.projectiles.spawn(e.x, e.y, Math.cos(e.aimAngle) * def.boltSpeed, Math.sin(e.aimAngle) * def.boltSpeed, def.damage, 'enemy', 4, 3);
            e.state = 'chase'; e.cooldown = def.cooldown;
          }
        }
      } else if (e.type === 'brambler') {
        if (e.state === 'chase') {
          stepToward(e.speed);
          if (dist <= def.attackRange && e.cooldown <= 0) { e.state = 'root'; e.stateT = def.rootTime; }
        } else if (e.state === 'root') {
          e.stateT -= dt;
          if (e.stateT <= 0) {
            if (dist <= def.slamRadius && p.alive) this.hurtPlayer(def.damage);
            this.shake(FEEL.shakeSlam[0], FEEL.shakeSlam[1]);
            this.particles.burst(e.x, e.y, 6, ['#FF8A2A', '#8A5A33'], this.rng, 90);
            e.state = 'chase'; e.cooldown = def.cooldown;
          }
        }
      }
    }
    // Enemy bolts hitting the player.
    for (let i = this.projectiles.list.length - 1; i >= 0; i--) {
      const pr = this.projectiles.list[i];
      if (pr.from === 'player') continue;
      const dx = pr.x - p.x, dy = pr.y - p.y;
      if (dx * dx + dy * dy < (pr.radius + p.radius) ** 2) {
        this.projectiles.list.splice(i, 1);
        this.hurtPlayer(pr.damage);
      }
    }
    // Boss contact damage.
    if (this.boss && !this.boss.dead) {
      const dx = this.boss.x - p.x, dy = this.boss.y - p.y;
      if (dx * dx + dy * dy < (this.boss.radius + p.radius) ** 2) this.hurtPlayer(BOSS.contactDamage);
    }
  }

  hurtPlayer(amount) {
    const dealt = this.player.hurt(amount);
    if (dealt > 0) {
      this.shake(FEEL.shakeHit[0], FEEL.shakeHit[1]);
      this.sfx.hit();
      this.dmgNums.add(this.player.x, this.player.y - 22, amount, '#FF6B5E');
    }
  }

  // ---------------------------------------------------------- boss
  updateBoss(dt) {
    const b = this.boss;
    if (!b || b.dead) return;
    if (b.flash > 0) b.flash -= dt;
    b.x += b.kbx * dt; b.y += b.kby * dt;
    b.kbx *= 0.86; b.kby *= 0.86;
    const p = this.player;
    const dx = p.x - b.x, dy = p.y - b.y;
    const dist = Math.hypot(dx, dy) || 1;
    const tm = b.timeMul;
    if (b.state === 'enter') {
      b.stateT -= dt;
      if (b.stateT <= 0) { b.state = 'reposition'; b.stateT = 1.2; }
    } else if (b.state === 'roar') {
      b.stateT -= dt;
      if (b.stateT <= 0) { b.state = 'reposition'; b.stateT = 0.5; }
    } else if (b.state === 'reposition') {
      b.stateT -= dt;
      const sp = BOSS.speed * b.speedMul;
      // Path-follow toward the player (walls block direct lines).
      b.repathT = (b.repathT ?? 0) - dt;
      if (!b.path || b.repathT <= 0) {
        b.path = this.dungeon.findPath(b.x, b.y, p.x, p.y) || [];
        b.pathIdx = 0;
        b.repathT = 1;
      }
      let tx = p.x, ty = p.y;
      if (b.path && b.pathIdx < b.path.length) {
        const node = b.path[b.pathIdx];
        if (Math.hypot(node.x - b.x, node.y - b.y) < 12) b.pathIdx++;
        if (b.pathIdx < b.path.length) { tx = b.path[b.pathIdx].x; ty = b.path[b.pathIdx].y; }
      }
      const mx = tx - b.x, my = ty - b.y;
      const md = Math.hypot(mx, my) || 1;
      const nx = b.x + (mx / md) * sp * dt;
      if (!this.dungeon.hitsWall(nx, b.y, b.moveRadius)) b.x = nx;
      const ny = b.y + (my / md) * sp * dt;
      if (!this.dungeon.hitsWall(b.x, ny, b.moveRadius)) b.y = ny;
      if (b.stateT <= 0) {
        b.state = 'telegraph';
        const kind = ['ring', 'fan', 'drop'][b.attackIdx % 3];
        b.telegraph = { kind, x: p.x, y: p.y, angle: Math.atan2(dy, dx), t: 0, dur: kind === 'ring' ? BOSS.ringTime : kind === 'fan' ? BOSS.fanTime : BOSS.dropTime };
        b.stateT = b.telegraph.dur * tm;
      }
    } else if (b.state === 'telegraph') {
      b.stateT -= dt;
      if (b.telegraph) b.telegraph.t += dt;
      if (b.stateT <= 0) {
        const kind = b.telegraph.kind;
        if (kind === 'ring') {
          if (Math.hypot(p.x - b.x, p.y - b.y) <= BOSS.ringRadius && p.alive) this.hurtPlayer(BOSS.ringDamage);
          this.particles.burst(b.x, b.y, 16, ['#76DDE0', '#FFD76A'], this.rng, 220);
        } else if (kind === 'fan') {
          const base = b.telegraph.angle;
          for (let i = -2; i <= 2; i++) {
            const a = base + (i * BOSS.fanSpread * Math.PI) / 180;
            this.projectiles.spawn(b.x, b.y, Math.cos(a) * BOSS.fanSpeed, Math.sin(a) * BOSS.fanSpeed, BOSS.fanDamage, 'boss', 5, BOSS.shardLife);
          }
        } else if (kind === 'drop') {
          for (const off of [-BOSS.dropOffset, 0, BOSS.dropOffset]) {
            const mx = b.telegraph.x + off, my = b.telegraph.y;
            if (Math.hypot(p.x - mx, p.y - my) <= BOSS.dropRadius && p.alive) this.hurtPlayer(BOSS.dropDamage);
            this.particles.burst(mx, my, 8, ['#B9A9F0', '#76DDE0'], this.rng, 140);
          }
        }
        b.attackIdx++;
        b.telegraph = null;
        b.state = 'recovery';
        b.stateT = BOSS.recovery;
      }
    } else if (b.state === 'recovery') {
      b.stateT -= dt;
      if (b.stateT <= 0) { b.state = 'reposition'; b.stateT = 0.6; }
    }
  }

  // ---------------------------------------------------------- waves
  updateWave(dt) {
    this.waveT -= dt;
    const spec = WAVES[this.wave - 1];
    // Spawn groups every 7 seconds.
    const shouldHave = Math.min(spec.groups, Math.floor((WAVE_LEN - this.waveT) / GROUP_EVERY) + (this.wave === 8 ? 0 : 1));
    if (this.wave === 8 && this.groupsSpawned === 0 && !this.boss) {
      const bs = this.dungeon.bossSpawnNear(this.player.x, this.player.y);
      this.boss = new Boss(bs.x, bs.y);
      this.boss.state = 'enter'; this.boss.stateT = 1.0;
      this.sfx.bossRoar();
      this.groupsSpawned = 0; // groups start spawning at 7s
    }
    const targetGroups = this.wave === 8
      ? Math.min(7, Math.floor((WAVE_LEN - this.waveT) / GROUP_EVERY))
      : shouldHave;
    if (this.groupsSpawned < targetGroups && this.enemies.length < MAX_ENEMIES) {
      this.spawnGroup(spec, this.wave);
      this.groupsSpawned++;
    }
    // Wave cleared: all groups spawned and no standard enemies left.
    if (this.wave < 8 && this.groupsSpawned >= spec.groups && this.enemies.length === 0) {
      this.clearWave();
      return;
    }
    // Timer expired.
    if (this.waveT <= 0) {
      if (this.wave === 8) {
        if (this.boss && !this.boss.dead) this.finishDefeat();
        return;
      }
      // Survived the timer: leftovers fade out, no clear bonus.
      for (const e of this.enemies) this.particles.burst(e.x, e.y, 4, ['#FFF3C4'], this.rng, 60);
      this.enemies = [];
      this.startIntermission();
    }
  }

  spawnGroup(spec, wave) {
    const mix = this.spawnMix(wave, spec.perGroup);
    for (const [type, count] of Object.entries(mix)) {
      for (let i = 0; i < count; i++) {
        if (this.enemies.length >= MAX_ENEMIES) return;
        const pt = this.dungeon.spawnPoint(areaOfWave(wave), this.player.x, this.player.y, MIN_SPAWN_DIST);
        this.enemies.push(new Enemy(type, pt.x + this.rng.range(-20, 20), pt.y + this.rng.range(-20, 20), spec.hpMul, spec.speedMul));
      }
    }
  }

  spawnMix(wave, perGroup) {
    let tinkets = 0, bramblers = 0;
    if (wave >= 2) tinkets = Math.min(2, Math.floor(perGroup / 2));
    if (wave >= 3) bramblers = wave >= 5 ? Math.min(2, Math.floor(perGroup / 3)) : 1;
    return { puffcap: Math.max(1, perGroup - tinkets - bramblers), tinket: tinkets, brambler: bramblers };
  }

  clearWave() {
    const bonus = Math.max(0, Math.floor(this.waveT)) * LOOT.waveClearCoinPerSec;
    this.coins += bonus;
    this.score += Math.max(0, Math.floor(this.waveT)) * SCORE.waveClearPerSec;
    if (LOOT.waveClearShards[this.wave]) this.shards += LOOT.waveClearShards[this.wave];
    this.startIntermission();
  }

  startIntermission() {
    this.projectiles.clear();
    this.embers.clear();
    this.interT = INTERMISSION_LEN;
    this.interBotT = 0.5;
    this.offers = this.rollOffers();
    this.renderOffers();
    this.setState('intermission');
  }

  rollOffers() {
    const p = this.player;
    const eligible = [];
    for (const u of [
      { id: 'wick', cost: { coins: 12 }, max: 2, owned: p.up.wick },
      { id: 'hands', cost: { coins: 10 }, max: 2, owned: p.up.hands },
      { id: 'thread', cost: { coins: 10 }, max: 2, owned: p.up.thread },
      { id: 'cape', cost: { coins: 14 }, max: 2, owned: p.up.cape },
      { id: 'charm', cost: { shards: 2 }, max: 1, owned: p.up.charm },
    ]) {
      if (u.owned >= u.max) continue;
      const afford = (u.cost.coins ?? 0) <= this.coins && (u.cost.shards ?? 0) <= this.shards;
      if (afford) eligible.push(u);
    }
    this.rng.shuffle(eligible);
    return eligible.slice(0, 3);
  }

  renderOffers() {
    const box = $('offers');
    box.innerHTML = '';
    const defs = {
      wick: { name: 'Bright Wick', desc: 'Lantern Bolt +3 damage', icon: '🔥' },
      hands: { name: 'Quick Hands', desc: 'Lantern Bolt fires 0.08s faster', icon: '⚡' },
      thread: { name: 'Long Thread', desc: 'Lantern Bolt +35 range', icon: '⭐' },
      cape: { name: 'Padded Cape', desc: '+20 max HP, heal 20 HP', icon: '🛡️' },
      charm: { name: 'Shard Charm', desc: 'Skills +damage: Cut +10, Ember +3/tick, Starfall +15', icon: '💎' },
    };
    for (const o of this.offers) {
      const d = defs[o.id];
      const card = document.createElement('button');
      card.className = 'offer';
      card.innerHTML = `<div class="offerIcon">${d.icon}</div><div class="offerName">${d.name}</div><div class="offerDesc">${d.desc}</div><div class="offerCost">${o.cost.coins ? '🪙 ' + o.cost.coins : '💠 ' + o.cost.shards}</div>`;
      card.addEventListener('click', () => this.endIntermission(o.id));
      box.appendChild(card);
    }
    if (!this.offers.length) {
      const none = document.createElement('div');
      none.className = 'offerNone';
      none.textContent = 'No upgrades affordable — save your coins for the next wave!';
      box.appendChild(none);
    }
  }

  endIntermission(choice) {
    if (this.state !== 'intermission') return;
    let id = choice;
    if (id === 'auto') {
      id = this.offers.length ? this.offers[0].id : null;
    }
    if (id) this.buyUpgrade(id);
    this.wave++;
    if (this.wave > 8) { this.finishVictory(); return; }
    const newArea = areaOfWave(this.wave);
    if (newArea !== this.area) {
      this.area = newArea;
      this.layer = bakeLayer(this.dungeon, newArea);
    }
    this.waveT = WAVE_LEN;
    this.groupsSpawned = 0;
    this.setState('playing');
  }

  buyUpgrade(id) {
    const p = this.player;
    const costs = {
      wick: { coins: 12 }, hands: { coins: 10 }, thread: { coins: 10 },
      cape: { coins: 14 }, charm: { shards: 2 },
    };
    const c = costs[id];
    if (!c) return;
    if ((c.coins ?? 0) > this.coins || (c.shards ?? 0) > this.shards) return;
    this.coins -= c.coins ?? 0;
    this.shards -= c.shards ?? 0;
    if (id === 'wick') p.up.wick++;
    if (id === 'hands') p.up.hands++;
    if (id === 'thread') p.up.thread++;
    if (id === 'cape') { p.up.cape++; p.maxHp += 20; p.hp = Math.min(p.maxHp, p.hp + 20); }
    if (id === 'charm') p.up.charm = 1;
    this.sfx.upgrade();
  }

  collectLoot(l) {
    if (l.type === 'coin') { this.coins += l.value; this.score += SCORE.coin * l.value; this.sfx.coin(); }
    else if (l.type === 'shard') { this.shards += l.value; this.score += SCORE.shard * l.value; this.sfx.coin(); }
    else if (l.type === 'heart') { this.player.heal(LOOT.heartHeal); this.sfx.heart(); }
    else if (l.type === 'bigheart') { this.player.heal(BOSS.lootHeart); this.sfx.heart(); }
  }

  // ---------------------------------------------------------- endings
  finishVictory() {
    if (this.state === 'victory') return;
    this.score += SCORE.victory;
    this.saveBest();
    $('resultTitle').textContent = '✨ VICTORY ✨';
    $('resultTitle').style.color = '#FFD76A';
    $('resultScore').textContent = `Score: ${this.score}`;
    $('resultBest').textContent = `Best: ${this.bestScore} · Wave ${this.wave} / 8`;
    $('resultWave').textContent = `You defeated the Gloam Bell and relit the dungeon!`;
    this.setState('victory');
    this.sfx.victory();
    if (this.botMode) this.done = { result: 'victory', score: this.score, wave: this.wave, time: this.time, summary: this.summary() };
  }

  finishDefeat() {
    if (this.state === 'defeat') return;
    this.score += SCORE.defeatPerWave * (this.wave - 1);
    this.saveBest();
    $('resultTitle').textContent = '💀 DEFEAT';
    $('resultTitle').style.color = '#FF6B5E';
    $('resultScore').textContent = `Score: ${this.score}`;
    $('resultBest').textContent = `Best: ${this.bestScore} · Wave ${this.wave} / 8`;
    $('resultWave').textContent = `The dungeon kept its light... this time. Wave ${this.wave} of 8.`;
    this.setState('defeat');
    this.sfx.defeat();
    if (this.botMode) this.done = { result: 'defeat', score: this.score, wave: this.wave, time: this.time, summary: this.summary() };
  }

  saveBest() {
    const best = JSON.parse(localStorage.getItem('mosslight-best') || '{"score":0,"wave":0,"coins":0}');
    best.score = Math.max(best.score, this.score);
    best.wave = Math.max(best.wave, this.wave);
    best.coins += this.coins;
    localStorage.setItem('mosslight-best', JSON.stringify(best));
    this.bestScore = best.score;
  }

  shake(mag, dur) { this.shakeMag = mag; this.shakeT = dur; }

  // ---------------------------------------------------------- determinism
  summary() {
    const es = this.enemies.map((e) => [e.type, Math.round(e.x), Math.round(e.y), e.hp]).sort();
    let h = 0;
    for (const s of JSON.stringify(es)) h = (Math.imul(h, 31) + s.charCodeAt(0)) | 0;
    return {
      seed: this.seed, dungeon: this.dungeon.summary(),
      wave: this.wave, score: this.score, kills: this.kills,
      coins: this.coins, shards: this.shards,
      hp: this.player.hp, px: Math.round(this.player.x), py: Math.round(this.player.y),
      enemies: h >>> 0,
    };
  }

  // ---------------------------------------------------------- bot (autotest + shots)
  botThink() {
    const p = this.player;
    this.botSkills = this.botSkills || [];
    const target = this.nearestEnemy(p.x, p.y, 400);
    const boss = this.boss && !this.boss.dead ? this.boss : null;
    // Stuck detection: wander if barely moved for 1.5s.
    if (Math.hypot(p.x - this.bot.lastX, p.y - this.bot.lastY) < 2) this.bot.stuckT += STEP;
    else { this.bot.stuckT = 0; this.bot.lastX = p.x; this.bot.lastY = p.y; }
    if (this.bot.wanderT > 0) {
      this.bot.wanderT -= STEP;
      this.botMove = { x: this.bot.wanderX, y: this.bot.wanderY };
      return;
    }
    if (this.bot.stuckT > 1.5) {
      const a = this.rng.float() * Math.PI * 2;
      this.bot.wanderX = Math.cos(a); this.bot.wanderY = Math.sin(a);
      this.bot.wanderT = 0.7;
      this.bot.stuckT = 0;
      return;
    }
    // A hurt player runs for the nearest heart first.
    if (p.hp < p.maxHp * 0.7) {
      let heart = null, hd = 160;
      for (const l of this.loot.list) {
        if (l.type !== 'heart' && l.type !== 'bigheart') continue;
        const d = Math.hypot(l.x - p.x, l.y - p.y);
        if (d < hd) { heart = l; hd = d; }
      }
      if (heart) {
        const dx = heart.x - p.x, dy = heart.y - p.y, d = Math.hypot(dx, dy) || 1;
        this.botMove = { x: dx / d, y: dy / d };
        return;
      }
    }
    // Boss fight: hold 150-160px (outside the 140px ring, inside the
    // 190px bolt range and the 160px Ember aim); close in to 100-135px
    // only when Starfall is ready and affordable, and run out / strafe
    // while the boss telegraphs an attack.
    if (boss) {
      const dx = boss.x - p.x, dy = boss.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      const ux = dx / d, uy = dy / d;
      const starCdReady = p.cooldowns.starfall <= 0; // cooldown ready (energy may still be short)
      // Hold range: 150-160px normally (inside the 190px bolt range and
      // the 160px Ember aim, and close enough to escape the 180px ring in
      // the 0.7s telegraph); 100-135px when Starfall is ready and affordable.
      const wantClose = starCdReady && p.energy >= 100;
      const holdLo = wantClose ? 100 : 150;
      const holdHi = wantClose ? 135 : 160;
      if (boss.telegraph?.kind === 'ring') {
        this.botMove = { x: -ux, y: -uy }; // run out of the ring
      } else if (boss.telegraph?.kind === 'drop') {
        this.botMove = { x: -uy, y: ux }; // strafe out of the markers
      } else if (boss.telegraph?.kind === 'fan') {
        this.botMove = { x: -uy, y: ux }; // strafe out of the fan
      } else if (d > holdHi || !this.dungeon.hasLineOfSight(p.x, p.y, boss.x, boss.y)) {
        // Close in: to 150-160px normally (inside bolt/Ember range), to
        // 100-135px when Starfall is ready and affordable — and always
        // keep closing while a wall blocks the bolt's line of sight.
        // BFS path: a direct line crosses walls and wedges the bot.
        this.botRepathT = (this.botRepathT ?? 0) - STEP;
        if (!this.botPath || this.botRepathT <= 0) {
          this.botPath = this.dungeon.findPath(p.x, p.y, boss.x, boss.y) || [];
          this.botPathIdx = 0;
          this.botRepathT = 1;
        }
        let tx = boss.x, ty = boss.y;
        if (this.botPathIdx < this.botPath.length) {
          const node = this.botPath[this.botPathIdx];
          if (Math.hypot(node.x - p.x, node.y - p.y) < 10) this.botPathIdx++;
          if (this.botPathIdx < this.botPath.length) { tx = this.botPath[this.botPathIdx].x; ty = this.botPath[this.botPathIdx].y; }
        }
        const mx = tx - p.x, my = ty - p.y, md = Math.hypot(mx, my) || 1;
        this.botMove = { x: mx / md, y: my / md };
      } else if (d < holdLo) {
        this.botMove = { x: -ux, y: -uy }; // too close: back off
      } else {
        this.botMove = { x: -uy * 0.5, y: ux * 0.5 }; // orbit at hold range
      }
      // Save energy for Starfall while it is ready: never spend the last
      // 100 energy on a small skill when Starfall is off cooldown.
      if (starCdReady && p.energy >= 100 && d < 135) this.botSkills.push('starfall');
      if (p.cooldowns.crescent <= 0 && p.energy >= 20 && d < 70 && (!starCdReady || p.energy >= 120)) this.botSkills.push('crescent');
      if (p.cooldowns.ember <= 0 && p.energy >= 30 && d < 160 && (!starCdReady || p.energy >= 130)) this.botSkills.push('ember');
      const closeFoes = this.enemies.filter((e) => Math.hypot(e.x - p.x, e.y - p.y) < 80).length;
    if ((closeFoes >= 2 || p.hp < 55) && p.cooldowns.glassguard <= 0 && p.energy >= 25) this.botSkills.push('glassguard');
      return;
    }
    if (!target) { this.botMove = { x: 0, y: 0 }; return; }
    const dx = target.x - p.x, dy = target.y - p.y;
    const d = Math.hypot(dx, dy) || 1;
    const ux = dx / d, uy = dy / d;
    // Kite: too close -> back away; in range -> strafe; far -> follow a BFS
    // path (a direct line to a far enemy crosses walls and gets stuck).
    if (d < 45) this.botMove = { x: -ux, y: -uy };
    else if (d < p.boltRange) this.botMove = { x: -uy * 0.7, y: ux * 0.7 };
    else {
      this.botRepathT = (this.botRepathT ?? 0) - STEP;
      if (!this.botPath || this.botRepathT <= 0) {
        this.botPath = this.dungeon.findPath(p.x, p.y, target.x, target.y) || [];
        this.botPathIdx = 0;
        this.botRepathT = 1;
      }
      let tx = target.x, ty = target.y;
      if (this.botPathIdx < this.botPath.length) {
        const node = this.botPath[this.botPathIdx];
        if (Math.hypot(node.x - p.x, node.y - p.y) < 10) this.botPathIdx++;
        if (this.botPathIdx < this.botPath.length) { tx = this.botPath[this.botPathIdx].x; ty = this.botPath[this.botPathIdx].y; }
      }
      const mx = tx - p.x, my = ty - p.y;
      const md = Math.hypot(mx, my) || 1;
      this.botMove = { x: mx / md, y: my / md };
    }
    const near = this.hash.query(p.x, p.y, 70, []);
    if (near.length >= 2 && p.cooldowns.crescent <= 0 && p.energy >= 20) this.botSkills.push('crescent');
    const mid = this.hash.query(p.x, p.y, 110, []);
    if (mid.length >= 2 && p.cooldowns.ember <= 0 && p.energy >= 30) this.botSkills.push('ember');
    const closeFoes = this.enemies.filter((e) => Math.hypot(e.x - p.x, e.y - p.y) < 80).length;
    if ((closeFoes >= 2 || p.hp < 55) && p.cooldowns.glassguard <= 0 && p.energy >= 25) this.botSkills.push('glassguard');
    const far = this.hash.query(p.x, p.y, 135, []);
    if (far.length >= 5 && p.cooldowns.starfall <= 0 && p.energy >= 100) this.botSkills.push('starfall');
    // Intermission choice is made in endIntermission by the shot driver.
  }

  botChooseOffer() {
    // Priority: cape when hurt, then wick, hands, thread, charm.
    const p = this.player;
    const order = ['cape', 'wick', 'hands', 'thread', 'charm'];
    if (p.hp < 70 && this.offers.some((o) => o.id === 'cape')) return 'cape';
    for (const id of order) if (this.offers.some((o) => o.id === id)) return id;
    return null;
  }

  // ---------------------------------------------------------- render
  render() {
    const g = this.ctx;
    g.clearRect(0, 0, VIEW_W, VIEW_H);
    if (this.state === 'title') { this.renderTitle(g); return; }
    // Camera follows the player, clamped to the world.
    const px = this.player ? this.player.x * SCALE : 0;
    const py = this.player ? this.player.y * SCALE : 0;
    let cx = Math.max(0, Math.min(WORLD_W * SCALE - VIEW_W, px - VIEW_W / 2));
    let cy = Math.max(0, Math.min(WORLD_H * SCALE - VIEW_H, py - VIEW_H / 2));
    if (this.shakeT > 0) {
      cx += (Math.random() - 0.5) * 2 * this.shakeMag;
      cy += (Math.random() - 0.5) * 2 * this.shakeMag;
    }
    this.cam = { x: cx, y: cy };
    if (this.layer) g.drawImage(this.layer, -cx, -cy);
    const X = (wx) => wx * SCALE - cx;
    const Y = (wy) => wy * SCALE - cy;
    // Chests and statues.
    for (const c of this.dungeon.chests) {
      if (c.opened) continue;
      g.drawImage(this.sprites.chest, X(c.x) - 16, Y(c.y) - 16, 32, 32);
    }
    for (const s of this.dungeon.statues) {
      g.drawImage(this.sprites.statue, X(s.x) - 16, Y(s.y) - 24, 32, 48);
      if (!s.used) {
        g.fillStyle = '#FFD76A';
        g.font = 'bold 13px monospace';
        g.textAlign = 'center';
        g.fillText('✦', X(s.x), Y(s.y) - 30);
      }
    }
    // Loot.
    for (const l of this.loot.list) {
      const spr = l.type === 'coin' ? this.sprites.coin : l.type === 'heart' || l.type === 'bigheart' ? this.sprites.heart : this.sprites.shard;
      const sz = l.type === 'bigheart' ? 36 : 24;
      const blink = l.life < 3 && Math.floor(l.life * 6) % 2 === 0;
      if (!blink) g.drawImage(spr, X(l.x) - sz / 2, Y(l.y) - sz / 2, sz, sz);
    }
    // Ember patches.
    for (const p of this.embers.list) {
      g.fillStyle = 'rgba(255,138,42,0.30)';
      g.beginPath(); g.arc(X(p.x), Y(p.y), p.radius * SCALE, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,210,90,0.45)';
      g.beginPath(); g.arc(X(p.x), Y(p.y), p.radius * SCALE * 0.55, 0, Math.PI * 2); g.fill();
    }
    // Boss telegraphs (floor markers, drawn before entities).
    if (this.boss?.telegraph) this.renderBossTelegraph(g, X, Y);
    // Enemies.
    for (const e of this.enemies) this.renderEnemy(g, e, X, Y);
    // Boss.
    if (this.boss) this.renderBoss(g, X, Y);
    // Player + lantern + moth.
    if (this.player.alive) this.renderPlayer(g, X, Y);
    // Slash arc.
    if (this.slashT > 0) {
      const p = this.player;
      g.strokeStyle = 'rgba(255,255,255,0.9)';
      g.lineWidth = 6;
      g.beginPath(); g.arc(X(p.x), Y(p.y), 56 * SCALE * (1.2 - this.slashT), 0, Math.PI * 2); g.stroke();
    }
    // Starfall wind-up ring.
    if (this.starfallFx) {
      const p = this.player;
      const t = 1 - this.starfallFx.t / SKILLS[3].windup;
      g.strokeStyle = `rgba(255,215,106,${0.4 + 0.6 * t})`;
      g.lineWidth = 5;
      g.beginPath(); g.arc(X(p.x), Y(p.y), 135 * SCALE * t, 0, Math.PI * 2); g.stroke();
    }
    // Projectiles.
    for (const pr of this.projectiles.list) {
      g.fillStyle = pr.from === 'player' ? '#FFE9A8' : pr.from === 'enemy' ? '#35C9D0' : '#76DDE0';
      g.beginPath(); g.arc(X(pr.x), Y(pr.y), pr.radius * SCALE, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#FFFFFF';
      g.beginPath(); g.arc(X(pr.x), Y(pr.y), pr.radius * SCALE * 0.4, 0, Math.PI * 2); g.fill();
    }
    // Particles.
    for (const pt of this.particles.list) {
      g.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      g.fillStyle = pt.color;
      g.fillRect(X(pt.x) - pt.size, Y(pt.y) - pt.size, pt.size * 2, pt.size * 2);
    }
    g.globalAlpha = 1;
    // Damage numbers.
    g.textAlign = 'center';
    g.font = 'bold 16px monospace';
    for (const d of this.dmgNums.list) {
      g.globalAlpha = Math.max(0, d.life / FEEL.dmgNumLife);
      g.fillStyle = '#1A1A1A';
      g.fillText(String(d.value), X(d.x) + 1, Y(d.y) + 1);
      g.fillStyle = d.color;
      g.fillText(String(d.value), X(d.x), Y(d.y));
    }
    g.globalAlpha = 1;
    // Aim line for tinkets.
    for (const e of this.enemies) {
      if (e.type === 'tinket' && e.state === 'aim') {
        g.strokeStyle = 'rgba(53,201,208,0.8)';
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(X(e.x), Y(e.y));
        g.lineTo(X(e.x) + Math.cos(e.aimAngle) * 145 * SCALE, Y(e.y) + Math.sin(e.aimAngle) * 145 * SCALE);
        g.stroke();
      }
    }
  }

  renderBossTelegraph(g, X, Y) {
    const b = this.boss, t = b.telegraph;
    if (!t) return;
    const frac = Math.min(1, t.t / t.dur);
    const strong = frac > 0.8;
    if (t.kind === 'ring') {
      g.fillStyle = strong ? 'rgba(255,80,80,0.55)' : 'rgba(255,80,80,0.25)';
      g.beginPath(); g.arc(X(b.x), Y(b.y), BOSS.ringRadius * SCALE * (0.3 + 0.7 * frac), 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#FF5050'; g.lineWidth = 3;
      g.beginPath(); g.arc(X(b.x), Y(b.y), BOSS.ringRadius * SCALE * (0.3 + 0.7 * frac), 0, Math.PI * 2); g.stroke();
    } else if (t.kind === 'fan') {
      g.fillStyle = strong ? 'rgba(118,221,224,0.5)' : 'rgba(118,221,224,0.22)';
      for (let i = -2; i <= 2; i++) {
        const a = t.angle + (i * BOSS.fanSpread * Math.PI) / 180;
        g.beginPath();
        g.moveTo(X(b.x), Y(b.y));
        g.lineTo(X(b.x) + Math.cos(a - 0.08) * 300, Y(b.y) + Math.sin(a - 0.08) * 300);
        g.lineTo(X(b.x) + Math.cos(a + 0.08) * 300, Y(b.y) + Math.sin(a + 0.08) * 300);
        g.closePath(); g.fill();
      }
    } else if (t.kind === 'drop') {
      g.fillStyle = strong ? 'rgba(185,169,240,0.6)' : 'rgba(185,169,240,0.3)';
      for (const off of [-BOSS.dropOffset, 0, BOSS.dropOffset]) {
        g.beginPath(); g.arc(X(t.x + off), Y(t.y), BOSS.dropRadius * SCALE, 0, Math.PI * 2); g.fill();
        g.strokeStyle = '#B9A9F0'; g.lineWidth = 3;
        g.beginPath(); g.arc(X(t.x + off), Y(t.y), BOSS.dropRadius * SCALE, 0, Math.PI * 2); g.stroke();
      }
    }
  }

  renderEnemy(g, e, X, Y) {
    const spr = e.type === 'puffcap' ? this.sprites.puffcap : e.type === 'tinket' ? this.sprites.tinket : this.sprites.brambler;
    const bob = e.state === 'hop' ? -4 : Math.sin(this.time * 8 + e.id) * 1.5;
    const w = spr.width * SCALE, h = spr.height * SCALE;
    const sx = X(e.x) - w / 2, sy = Y(e.y) - h / 2 + bob * SCALE;
    g.drawImage(spr, sx, sy, w, h);
    if (e.flash > 0) {
      g.globalAlpha = e.flash / 0.08 * 0.7;
      g.fillStyle = '#FFFFFF';
      g.beginPath(); g.arc(X(e.x), Y(e.y), e.radius * SCALE, 0, Math.PI * 2); g.fill();
      g.globalAlpha = 1;
    }
    // Brambler root telegraph ring.
    if (e.type === 'brambler' && e.state === 'root') {
      g.strokeStyle = 'rgba(255,80,80,0.7)';
      g.lineWidth = 3;
      g.beginPath(); g.arc(X(e.x), Y(e.y), ENEMIES.brambler.slamRadius * SCALE, 0, Math.PI * 2); g.stroke();
    }
    // Small HP bar when hurt.
    if (e.hp < e.maxHp) {
      const bw = 28, bx = X(e.x) - bw / 2, by = Y(e.y) - e.radius * SCALE - 10;
      g.fillStyle = '#1A1A1A'; g.fillRect(bx - 1, by - 1, bw + 2, 6);
      g.fillStyle = '#E94F62'; g.fillRect(bx, by, bw * (e.hp / e.maxHp), 4);
    }
  }

  renderBoss(g, X, Y) {
    const b = this.boss;
    const spr = b.flash > 0 ? this.sprites.bellWhite : this.sprites.bell;
    const bob = Math.sin(this.time * 3) * 3;
    const w = spr.width * SCALE, h = spr.height * SCALE;
    g.drawImage(spr, X(b.x) - w / 2, Y(b.y) - h / 2 + bob, w, h);
    // Roar flash.
    if (b.state === 'roar') {
      g.strokeStyle = 'rgba(255,215,106,0.8)';
      g.lineWidth = 4;
      g.beginPath(); g.arc(X(b.x), Y(b.y), (b.radius + 14) * SCALE, 0, Math.PI * 2); g.stroke();
    }
  }

  renderPlayer(g, X, Y) {
    const p = this.player;
    const frame = p.moving ? (Math.floor(p.walkPhase) % 2) : 0;
    const spr = this.sprites.neri[frame];
    const bob = p.moving ? Math.sin(p.walkPhase * 2) * 1 : 0;
    const w = spr.width * SCALE, h = spr.height * SCALE;
    // Invulnerability blink.
    if (p.invuln > 0 && Math.floor(this.time * 12) % 2 === 0) g.globalAlpha = 0.5;
    g.drawImage(spr, X(p.x) - w / 2, Y(p.y) - h / 2 + bob, w, h);
    g.globalAlpha = 1;
    // Lantern in hand (right side, bobbing with a glow).
    const lx = X(p.x) + 16, ly = Y(p.y) + 6 + Math.sin(this.time * 4) * 2;
    g.fillStyle = 'rgba(255,201,60,0.18)';
    g.beginPath(); g.arc(lx, ly, 26, 0, Math.PI * 2); g.fill();
    g.drawImage(this.sprites.lantern, lx - 10, ly - 12, 20, 24);
    // Glassguard shield ring.
    if (p.shield > 0) {
      g.strokeStyle = 'rgba(127,212,255,0.85)';
      g.lineWidth = 4;
      g.beginPath(); g.arc(X(p.x), Y(p.y), (p.radius + 8) * SCALE, 0, Math.PI * 2); g.stroke();
    }
    // Moth companion, trailing behind with a gentle bob.
    const mx = X(p.x) - 26 + Math.sin(this.time * 2) * 4;
    const my = Y(p.y) - 18 + Math.sin(this.time * 5) * 3;
    const mframe = Math.floor(this.time * 8) % 2;
    g.drawImage(this.sprites.moth[mframe], mx - 12, my - 12, 24, 24);
  }

  renderTitle(g) {
    // Bright Bloomroot backdrop: draw the first area's layer if we have one,
    // otherwise a flat bright green with flowers.
    const pal = AREAS[0];
    g.fillStyle = pal.floor;
    g.fillRect(0, 0, VIEW_W, VIEW_H);
    g.fillStyle = pal.moss;
    for (let i = 0; i < 40; i++) {
      const x = (i * 137) % VIEW_W, y = (i * 89) % VIEW_H;
      g.fillRect(x, y, 26, 18);
    }
    g.fillStyle = pal.flower;
    for (let i = 0; i < 14; i++) {
      const x = (i * 211 + 60) % VIEW_W, y = (i * 151 + 40) % VIEW_H;
      g.fillRect(x, y, 10, 10);
    }
    // Neri standing in the entrance, with moth.
    const nx = VIEW_W / 2 - 120, ny = 430;
    g.drawImage(this.sprites.neri[0], nx, ny, 96, 96);
    g.drawImage(this.sprites.lantern, nx + 66, ny + 40, 40, 48);
    g.drawImage(this.sprites.moth[0], nx - 60, ny - 20, 48, 48);
  }

  // ---------------------------------------------------------- HUD (DOM)
  updateHud() {
    if (this.state === 'title') return;
    const p = this.player;
    if (!p) return;
    $('hpFill').style.width = `${(p.hp / p.maxHp) * 100}%`;
    $('hpText').textContent = `${Math.ceil(p.hp)} / ${p.maxHp}`;
    $('hpBar').classList.toggle('low', p.hp <= FEEL.lowHp);
    $('energyFill').style.width = `${(p.energy / HERO.maxEnergy) * 100}%`;
    $('waveText').textContent = `WAVE ${this.wave} / 8`;
    const t = Math.max(0, this.waveT);
    $('timerText').textContent = this.state === 'intermission' ? '—' : `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
    $('coinText').textContent = `${this.coins}  💠 ${this.shards}`;
    $('areaText').textContent = AREAS[this.area].name;
    // Boss bar.
    const bossOn = this.state === 'playing' && this.boss && !this.boss.dead;
    $('bossBar').classList.toggle('hidden', !bossOn);
    if (bossOn) {
      $('bossFill').style.width = `${(this.boss.hp / this.boss.maxHp) * 100}%`;
      $('bossName').textContent = `${BOSS.name} — ${Math.ceil(this.boss.hp)} / ${this.boss.maxHp}`;
    }
    // Skill buttons: cooldown mask + energy affordability.
    for (const s of SKILLS) {
      const el = $('skill-' + s.id);
      const cd = Math.max(0, p.cooldowns[s.id]);
      el.querySelector('.cd').style.height = cd > 0 ? `${(cd / s.cooldown) * 100}%` : '0%';
      el.classList.toggle('cant', p.energy < s.cost);
      el.classList.toggle('ready', s.id === 'starfall' && p.energy >= s.cost && cd <= 0);
    }
    if (this.state === 'intermission') {
      $('interTimer').textContent = `Next wave in ${Math.ceil(this.interT)}s — pick an upgrade!`;
    }
    this.renderMinimap();
  }

  renderMinimap() {
    const c = $('minimap');
    if (!c || !this.dungeon) return;
    const g = c.getContext('2d');
    const sx = c.width / WORLD_W, sy = c.height / WORLD_H;
    g.clearRect(0, 0, c.width, c.height);
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(0, 0, c.width, c.height);
    for (const r of this.dungeon.rooms) {
      g.fillStyle = AREAS[r.area].floor;
      g.globalAlpha = 0.55;
      g.fillRect(r.x * TILE * sx, r.y * TILE * sy, r.w * TILE * sx, r.h * TILE * sy);
    }
    g.globalAlpha = 1;
    for (const e of this.enemies) {
      g.fillStyle = '#FF5050';
      g.fillRect(e.x * sx - 1, e.y * sy - 1, 3, 3);
    }
    if (this.boss && !this.boss.dead) {
      g.fillStyle = '#FFD76A';
      g.fillRect(this.boss.x * sx - 2, this.boss.y * sy - 2, 5, 5);
    }
    g.fillStyle = '#FFFFFF';
    g.fillRect(this.player.x * sx - 2, this.player.y * sy - 2, 4, 4);
  }
}
