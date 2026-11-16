// Mosslight — all design numbers (sources in BUILD-LOG-mosslight.md).

export const TILE = 16; // px per tile (kept for the px<->unit render scale)
export const FIELD_W = 2400; // px — one big open field, no dungeon
export const FIELD_H = 1800; // px
export const WORLD_W = FIELD_W;
export const WORLD_H = FIELD_H;
export const UNIT = TILE; // 1 world unit = 16 px (render scale)

// ---- rotation constants (v6) ----
// NO trig in the sim: sin/cos/atan2 differ 1 ULP between Node and Chrome
// V8 and desync the run (seed 42, step 720). Fixed-angle rotations use
// these literals (identical doubles everywhere). Render code may use trig.
export const COS05 = 0.8775825618903728, SIN05 = 0.479425538604203; // cos/sin(0.5)
export const COS06 = 0.8253356149096783, SIN06 = 0.5646424733950355; // cos/sin(0.6)
// Boss fan: 5 shards at -24,-12,0,12,24 deg from the base direction.
export const FAN_OFF = [
  { c: 0.9135454576426009, s: -0.4067366430758002 },
  { c: 0.9781476007338057, s: -0.2079116908177593 },
  { c: 1, s: 0 },
  { c: 0.9781476007338057, s: 0.2079116908177593 },
  { c: 0.9135454576426009, s: 0.4067366430758002 },
];

// ---- run structure ----
export const WAVE_TIME = 50; // s per wave
export const INTERMISSION_TIME = 20; // s
export const WAVE_COUNT = 8;
export const MAX_ENEMIES = 120;
export const SPAWN_GROUP_EVERY = 7; // s
export const SPAWN_MIN_DIST = 240; // px from the player
export const VICTORY_BONUS = 5000;
export const DEFEAT_PER_WAVE = 100;

// waves: area, groups, enemies per group, HP mult, speed mult
// (v6: more per group than the dungeon build, same per-enemy stats)
export const WAVES = [
  { area: 0, groups: 5, perGroup: 5, hpMul: 1.0, spMul: 1.0 },
  { area: 0, groups: 6, perGroup: 5, hpMul: 1.1, spMul: 1.0 },
  { area: 0, groups: 6, perGroup: 6, hpMul: 1.2, spMul: 1.05 },
  { area: 1, groups: 6, perGroup: 6, hpMul: 1.35, spMul: 1.05 },
  { area: 1, groups: 7, perGroup: 6, hpMul: 1.5, spMul: 1.1 },
  { area: 1, groups: 7, perGroup: 8, hpMul: 1.65, spMul: 1.1 },
  { area: 2, groups: 8, perGroup: 8, hpMul: 1.8, spMul: 1.15 },
  { area: 2, groups: 4, perGroup: 5, hpMul: 1.5, spMul: 1.15, boss: true },
];
export const AREA_NAMES = ['Bloomroot Warrens', 'Cinderglass Works', 'Moonmilk Vault'];

// ---- hero: Neri ----
export const PLAYER = {
  maxHp: 100,
  speed: 120, // px/s
  radius: 10, // gameplay radius (hit/collision)
  moveRadius: 7, // wall-collision radius
  energyMax: 100,
  energyRegen: 8, // per s
  iframes: 0.65, // s invulnerable after damage
  boltDamage: 8,
  boltInterval: 0.55, // s
  boltRange: 190, // px
  boltSpeed: 320, // px/s
};

export const SKILLS = {
  crescent: { name: 'Crescent Cut', cost: 20, cd: 4, range: 56, damage: 26 },
  ember: { name: 'Ember Bloom', cost: 30, cd: 7, range: 160, patchRadius: 72, damage: 12, tick: 8, tickEvery: 0.5, tickTime: 2 },
  glassguard: { name: 'Glassguard', cost: 25, cd: 9, shield: 35, shieldTime: 3, contactDamage: 10, contactEvery: 0.5 },
  starfall: { name: 'Starfall', cost: 100, cd: 30, windup: 0.6, range: 135, damage: 90, knockback: 90,  },
  frost: { name: 'Frost Nova', cost: 35, cd: 10, range: 200, freeze: 2.5, damage: 10,  },
};

// ---- enemies (base values, before wave multipliers) ----
export const ENEMIES = {
  puffcap: {
    name: 'Puffcap', hp: 24, speed: 55, radius: 10, moveRadius: 7,
    attackRange: 30, pauseTime: 0.35, hopDist: 46, hopTime: 0.25, damage: 8, attackCd: 1.4,
    coinDrop: 1, heartChance: 0.25, shardChance: 0, magnetChance: 0, bombChance: 0,
  },
  tinket: {
    name: 'Tinket', hp: 18, speed: 42, radius: 9, moveRadius: 7,
    stopRange: 145, aimTime: 0.55, boltSpeed: 180, damage: 7, attackCd: 2.2,
    coinDrop: 1, heartChance: 0.2, shardChance: 0, magnetChance: 0, bombChance: 0,
  },
  brambler: {
    name: 'Brambler', hp: 55, speed: 32, radius: 12, moveRadius: 7,
    attackRange: 48, rootTime: 0.45, ringRadius: 70, damage: 16, attackCd: 2.6,
    coinDrop: 2, heartChance: 0.22, shardChance: 0.25, magnetChance: 0, bombChance: 0.1,
  },

  wisp: {
    name: 'Wisp', hp: 12, speed: 88, radius: 7, moveRadius: 6,
    attackRange: 26, pauseTime: 0.3, hopDist: 60, hopTime: 0.22, damage: 5, attackCd: 1.1,
    coinDrop: 1, heartChance: 0.15, shardChance: 0, magnetChance: 0.15, bombChance: 0,
  },

  bulwark: {
    name: 'Bulwark', hp: 90, speed: 24, radius: 14, moveRadius: 8,
    attackRange: 52, rootTime: 0.5, ringRadius: 78, damage: 20, attackCd: 3.0,
    coinDrop: 3, heartChance: 0.25, shardChance: 0.3, magnetChance: 0, bombChance: 0.25, starchipChance: 0.1,
  },
};
// group composition caps by wave
export const TINKET_FROM_WAVE = 2; // waves are 1-based
export const TINKET_MAX_PER_GROUP = 2;
export const BRAMBLER_FROM_WAVE = 3;
export const BRAMBLER_MAX_PER_GROUP_EARLY = 1; // waves 3-4
export const BRAMBLER_MAX_PER_GROUP_LATE = 2; // waves 5+
export const WISP_FROM_WAVE = 2;
export const BULWARK_FROM_WAVE = 4;

// ---- boss: The Gloam Bell (as-built: 950 HP, ring 140px / 0.9s) ----
export const BOSS = {
  name: 'The Gloam Bell',
  hp: 950,
  speed: 38, // px/s while repositioning
  radius: 16,
  moveRadius: 14,
  contactDamage: 12,
  ringRadius: 140, // px (as-built; Sol said 180)
  ringTelegraph: 0.9, // s (as-built; Sol said 0.7)
  ringActive: 0.25, // s
  ringDamage: 18,
  fanTelegraph: 0.6, // s
  fanShards: 5,
  fanSpreadDeg: 12,
  fanSpeed: 210, // px/s
  fanDamage: 9,
  fanLife: 1.5, // s
  echoMarkers: 3,
  echoRadius: 44, // px
  echoOffsets: 48, // px either side of the player
  echoDelay: 0.8, // s
  echoDamage: 14,
  recovery: 0.75, // s after each pattern
  roarTime: 0.8, // s on phase change
  phase2At: 0.6, // 60% HP: attack speed +15%
  phase2SpeedMul: 1 / 0.85, // timings shrink ~15%
  phase3At: 0.25, // 25% HP: move speed +20%
  phase3MoveMul: 1.2,
  spawnDist: 200, // px along the BFS path from the player (as-built)
  lootCoins: 30,
  lootShards: 3,
  lootHeart: 30, // big heart restores 30 HP
};

// ---- loot ----
export const LOOT = {
  lifetime: 20, // s on the floor
  magnetRange: 90, // px
  magnetSpeed: 180, // px/s
  collectCoin: 36, // px
  collectHeart: 28, // px
  heartHeal: 20,
  coinScore: 2,
  shardScore: 25,
  killScore: 100,
  bossScore: 1000,
  waveClearPerSecond: 5, // coins per remaining second
  waveClearShards: [0, 1, 0, 1, 0, 1, 0, 0], // waves 1..8: +1 shard on waves 2, 4, 6
  chestCoinsMin: 4,
  chestCoinsMax: 8,
  statueEnergy: 20,
  statueTime: 1.2, // s to interact
};

// ---- upgrades (intermission offers) ----
export const UPGRADES = [
  { id: 'wick', name: 'Bright Wick', cost: 12, cur: 'coin', max: 2, desc: 'Bolt +3 damage' },
  { id: 'hands', name: 'Quick Hands', cost: 10, cur: 'coin', max: 2, desc: 'Bolt interval -0.08s' },
  { id: 'thread', name: 'Long Thread', cost: 10, cur: 'coin', max: 2, desc: 'Bolt range +35px' },
  { id: 'cape', name: 'Padded Cape', cost: 14, cur: 'coin', max: 2, desc: '+20 max HP, heal 20' },
  { id: 'charm', name: 'Shard Charm', cost: 2, cur: 'shard', max: 1, desc: 'Crescent +10, Ember tick +3, Starfall +15' },
];

// ---- feel (Sol section 9) ----
export const FEEL = {
  hitstopBolt: 2, // frames
  hitstopCrescent: 3, // frames
  hitstopStarfallBoss: 5, // frames
  shakePlayerHit: { amp: 3, time: 0.08 },
  shakeSlam: { amp: 5, time: 0.12 },
  shakeStarfall: { amp: 12, time: 0.16 },
  shakeBossDeath: { amp: 10, time: 0.2 },
  damageRise: 22, // px
  damageLife: 0.65, // s
  deathParticles: 14,
  bossDeathParticles: 36,
  particleLife: 0.45, // s
  lowHp: 25,
  lowHpPulseHz: 2,
  lowHpWarnEvery: 5, // s
};

// ---- area palettes (v3-brightened values where the v3 log gives them) ----
export const AREAS = [
  { // Bloomroot Warrens
    name: 'Bloomroot Warrens',
    outline: '#3A7A5E', wall: '#35705F', wallTop: '#4FA88A', floor: '#71CC6F',
    floorAlt: '#7ED47E', moss: '#A5E37A', water: '#45C8B2', flower: '#FF7099',
    loot: '#F5D45A', highlight: '#FFF3C4', sky: '#2F7D5C', mapWall: '#57B795',
  },
  { // Cinderglass Works
    name: 'Cinderglass Works',
    outline: '#5C3A44', wall: '#5C3644', wallTop: '#7A4A58', floor: '#F07F4A',
    floorAlt: '#F58F5C', forge: '#F59B42', machinery: '#35C9D0', hazard: '#E94F62',
    loot: '#FFE073', highlight: '#FFF2D0', sky: '#7A4A30', mapWall: '#C08A96',
  },
  { // Moonmilk Vault
    name: 'Moonmilk Vault',
    outline: '#4A3A66', wall: '#6058AC', wallTop: '#7A72C4', floor: '#A58CD0',
    floorAlt: '#B39DDB', crystal: '#C9BBF5', glow: '#76DDE0', fungus: '#A7E760',
    loot: '#FFD76A', highlight: '#F6F0FF', sky: '#4A4A9A', mapWall: '#A89FE8',
  },
];

// ---- 3D camera / render ----
export const CAM = {
  fov: 50, // vertical degrees
  tiltDeg: 38, // v7: was 55 — at 55 Neri read as "just a hat"; at 38 her
  // face + robe show. The sky band at the north edge is sky, not void.
  dist: 16, // world units from the target point
  targetHeight: 1.4, // world units above the floor (Neri's chest)
  neriHeight: 3.4, // world units (~130px at 1280x720); Neri is the biggest
  // readable character on screen, bigger than any regular enemy.
  bossHeight: 4.6, // world units tall (the bell is BIG)
  maxPitch: 0.35, // how far ahead the camera looks (units, north of Neri)
  titleShiftX: 9, // title screen: Neri stands right of the panel.
};

// ---- HUD (v3 numbers, kept) ----
export const HUD = {
  hpW: 280, hpH: 26,
  energyW: 220, energyH: 14,
  waveFont: 30, timerFont: 18, areaFont: 14,
  bossBarW: 560, bossBarH: 18,
  minimap: 140, // round, px
  joyOuter: 112, joyThumb: 48, joyTravel: 31,
  skillD: 64, starD: 72, minTouch: 52,
};
