// Mosslight — config: every number from the design, in one place.
// World units are world pixels; the renderer draws the world at SCALE 2.

export const VIEW_W = 1280;
export const VIEW_H = 720;
export const TILE = 16;            // tile size in world px
export const DUN_W = 48;           // dungeon tiles wide
export const DUN_H = 36;           // dungeon tiles high
export const WORLD_W = DUN_W * TILE; // 768
export const WORLD_H = DUN_H * TILE; // 576
export const SCALE = 2;            // world -> screen scale (integer, nearest-neighbour)
export const STEP = 1 / 60;        // fixed timestep (seconds)

export const AREAS = [
  {
    name: 'Bloomroot Warrens',
    outline: '#14382F', wall: '#2E8A66', floor: '#71CC6F', moss: '#B8F078',
    water: '#45D8C4', flower: '#FF7FA8', loot: '#F5D45A', highlight: '#FFF3C4',
    accent: '#FF7FA8',
  },
  {
    name: 'Cinderglass Works',
    outline: '#3A2028', wall: '#A84A4A', floor: '#F07F4A', moss: '#FFB35E',
    water: '#4ADDE0', flower: '#FF6B7A', loot: '#FFE073', highlight: '#FFF2D0',
    accent: '#4ADDE0',
  },
  {
    name: 'Moonmilk Vault',
    outline: '#2E2140', wall: '#6E58A0', floor: '#A58CD0', moss: '#CDBFFF',
    water: '#8FEAF0', flower: '#C4F07A', loot: '#FFD76A', highlight: '#F6F0FF',
    accent: '#CDBFFF',
  },
];

// Wave of the run -> area index (waves 1-3 area 0, 4-6 area 1, 7-8 area 2).
export function areaOfWave(wave) {
  return wave <= 3 ? 0 : wave <= 6 ? 1 : 2;
}

// wave, area, spawn groups, enemies per group, hp multiplier, speed multiplier
export const WAVES = [
  { wave: 1, groups: 5, perGroup: 3, hpMul: 1.00, speedMul: 1.00 },
  { wave: 2, groups: 6, perGroup: 3, hpMul: 1.10, speedMul: 1.00 },
  { wave: 3, groups: 6, perGroup: 4, hpMul: 1.20, speedMul: 1.05 },
  { wave: 4, groups: 6, perGroup: 4, hpMul: 1.35, speedMul: 1.05 },
  { wave: 5, groups: 7, perGroup: 4, hpMul: 1.50, speedMul: 1.10 },
  { wave: 6, groups: 7, perGroup: 5, hpMul: 1.65, speedMul: 1.10 },
  { wave: 7, groups: 8, perGroup: 5, hpMul: 1.80, speedMul: 1.15 },
  { wave: 8, groups: 4, perGroup: 3, hpMul: 1.50, speedMul: 1.15 }, // balance: 7x5=35 adds at 2x HP outpaced the player's kill rate so they piled up, shot the player from range, and the boss never took fire; 4x3=12 at 1.5x keeps the boss the focus
];

export const WAVE_LEN = 50;        // seconds per wave
export const GROUP_EVERY = 7;      // seconds between spawn groups
export const INTERMISSION_LEN = 20;// seconds between waves
export const MAX_ENEMIES = 80;     // cap on standard enemies alive at once
export const MIN_SPAWN_DIST = 240; // px from player when spawning

// Hero Neri.
export const HERO = {
  maxHp: 100,
  speed: 120,           // px/s
  boltDamage: 8,
  boltInterval: 0.55,   // s
  boltRange: 190,       // px
  boltSpeed: 320,       // px/s
  maxEnergy: 100,
  energyRegen: 8,       // per second
  invuln: 0.65,         // s after taking damage
  radius: 14,           // collision radius (world px)
};

// Skills: id, name, icon colour, cost, cooldown, key.
export const SKILLS = [
  { id: 'crescent', name: 'Crescent Cut', cost: 20, cooldown: 4, key: 'j', radius: 56, damage: 26, color: '#FF6B5E' },
  { id: 'ember', name: 'Ember Bloom', cost: 30, cooldown: 7, key: 'k', radius: 72, damage: 12, tickDamage: 8, tickEvery: 0.5, duration: 2, aimRange: 160, color: '#FF8A2A' },
  { id: 'glassguard', name: 'Glassguard', cost: 25, cooldown: 9, key: 'l', shield: 35, duration: 3, thornDamage: 10, thornEvery: 0.5, color: '#7FD4FF' },
  { id: 'starfall', name: 'Starfall', cost: 100, cooldown: 30, key: ' ', radius: 135, damage: 90, knockback: 90, windup: 0.6, color: '#FFD76A' },
];

// Enemies: type, hp, speed, damage, radius, loot chances.
export const ENEMIES = {
  puffcap: {
    name: 'Puffcap', hp: 24, speed: 55, damage: 8, radius: 10,
    attackRange: 30, pause: 0.35, hopDist: 46, hopTime: 0.25, cooldown: 1.4,
    coin: 1, heartChance: 0.25, shardChance: 0,
  },
  tinket: {
    name: 'Tinket', hp: 18, speed: 42, damage: 7, radius: 9,
    attackRange: 145, aimTime: 0.55, boltSpeed: 180, cooldown: 2.2,
    coin: 1, heartChance: 0.20, shardChance: 0,
  },
  brambler: {
    name: 'Brambler', hp: 55, speed: 32, damage: 16, radius: 12,
    attackRange: 48, rootTime: 0.45, slamRadius: 70, cooldown: 2.6,
    coin: 2, heartChance: 0.22, shardChance: 0.25,
  },
};

// Which enemies may appear in a spawn group, by wave.
export function groupMix(wave) {
  // Returns [puffcap, tinket, brambler] counts for one group.
  const perGroup = WAVES[wave - 1].perGroup;
  let tinkets = 0, bramblers = 0;
  if (wave >= 2) tinkets = Math.min(2, Math.floor(perGroup / 2));
  if (wave >= 3) bramblers = wave >= 5 ? Math.min(2, Math.floor(perGroup / 3)) : 1;
  const puffcaps = Math.max(1, perGroup - tinkets - bramblers);
  return { puffcap: puffcaps, tinket: tinkets, brambler: bramblers };
}

// Boss: the Gloam Bell.
export const BOSS = {
  name: 'The Gloam Bell',
  hp: 950,   // design 1200; the boss now spawns near the player so the
             // full ~54 dps lands from the first second, but the player
             // enters the fight at ~65 HP and takes ~2.7 dps — 1200 HP
             // (22s) outlasts the player by ~3s. 950 HP (~18s) is tense
             // but winnable; a skilled player still finishes in ~20s.
  speed: 38,
  contactDamage: 12,
  radius: 24,
  ringRadius: 140, ringTime: 0.9, ringDamage: 18, ringActive: 0.25, // balance: a 180px ring covered the whole 192px-wide boss room so it was undodgeable in-room; 140px lets a player at bolt range (150-160px) stand outside it, and 0.9s gives time to escape when closing in for Starfall
  fanShards: 5, fanSpread: 12, fanSpeed: 210, fanDamage: 9, fanTime: 0.6, shardLife: 1.5,
  dropMarkers: 3, dropRadius: 44, dropOffset: 48, dropTime: 0.8, dropDamage: 14,
  recovery: 0.75, roarTime: 0.8,
  phase2Hp: 0.60, phase2Speed: 1.15,   // attack sequence 15% faster
  phase3Hp: 0.25, phase3Move: 1.20,    // 20% movement speed
  lootCoins: 30, lootShards: 3, lootHeart: 30,
};

// Loot rules.
export const LOOT = {
  life: 20,            // seconds on the floor
  magnetRange: 90,     // px: start pulling
  magnetSpeed: 180,    // px/s
  collectCoin: 36,     // px
  collectHeart: 28,    // px
  heartHeal: 20,
  waveClearCoinPerSec: 5,
  waveClearShards: { 2: 1, 4: 1, 6: 1 }, // wave -> bonus shards
};

// Upgrades offered at intermissions.
export const UPGRADES = [
  { id: 'wick', name: 'Bright Wick', cost: { coins: 12 }, max: 2, desc: 'Lantern Bolt +3 damage', icon: 'flame' },
  { id: 'hands', name: 'Quick Hands', cost: { coins: 10 }, max: 2, desc: 'Lantern Bolt fires 0.08s faster', icon: 'bolt' },
  { id: 'thread', name: 'Long Thread', cost: { coins: 10 }, max: 2, desc: 'Lantern Bolt +35 range', icon: 'star' },
  { id: 'cape', name: 'Padded Cape', cost: { coins: 14 }, max: 2, desc: '+20 max HP, heal 20 HP', icon: 'shield' },
  { id: 'charm', name: 'Shard Charm', cost: { shards: 2 }, max: 1, desc: 'Skills +damage: Cut +10, Ember +3/tick, Starfall +15', icon: 'gem' },
];

// Score rules.
export const SCORE = {
  enemy: 100,
  boss: 1000,
  coin: 2,
  shard: 25,
  waveClearPerSec: 5,
  victory: 5000,
  defeatPerWave: 100,
};

// Feel numbers.
export const FEEL = {
  hitStopBolt: 2, hitStopCut: 3, hitStopStarfall: 5, // frames
  shakeHit: [3, 0.08], shakeSlam: [5, 0.12], shakeStarfall: [8, 0.16], shakeBossDie: [10, 0.2],
  dmgNumLife: 0.65, dmgNumRise: 22,
  deathParticles: 8, bossDeathParticles: 24, particleLife: 0.45,
  lowHp: 25,
};
