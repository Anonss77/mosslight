
export const TILE = 16;
export const FIELD_W = 2400;
export const FIELD_H = 1800;
export const WORLD_W = FIELD_W;
export const WORLD_H = FIELD_H;
export const UNIT = TILE;

export const COS05 = 0.8775825618903728, SIN05 = 0.479425538604203;

export const COS06 = 0.8253356149096783, SIN06 = 0.5646424733950355;

export const FAN_OFF = [
  { c: 0.9135454576426009, s: -0.4067366430758002 },
  { c: 0.9781476007338057, s: -0.2079116908177593 },
  { c: 1, s: 0 },
  { c: 0.9781476007338057, s: 0.2079116908177593 },
  { c: 0.9135454576426009, s: 0.4067366430758002 },
];

export const WAVE_TIME = 50;
export const INTERMISSION_TIME = 20;
export const WAVE_COUNT = 8;
export const MAX_ENEMIES = 120;
export const SPAWN_GROUP_EVERY = 7;
export const SPAWN_MIN_DIST = 240;
export const VICTORY_BONUS = 5000;
export const DEFEAT_PER_WAVE = 100;

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

export const PLAYER = {
  maxHp: 100,
  speed: 180,
  radius: 10,
  moveRadius: 7,
  energyMax: 100,
  energyRegen: 8,
  iframes: 0.65,
  boltDamage: 8,
  boltInterval: 0.55,
  boltRange: 190,
  boltSpeed: 320,
  attackCd: 0.35,
};

export const SKILLS = {
  crescent: { name: 'Crescent Cut', cost: 20, cd: 4, range: 56, damage: 26 },
  ember: { name: 'Ember Bloom', cost: 30, cd: 7, range: 160, patchRadius: 72, damage: 12, tick: 8, tickEvery: 0.5, tickTime: 2 },
  glassguard: { name: 'Glassguard', cost: 25, cd: 9, shield: 35, shieldTime: 3, contactDamage: 10, contactEvery: 0.5 },
  starfall: { name: 'Starfall', cost: 100, cd: 30, windup: 0.6, range: 135, damage: 90, knockback: 90,  },
  frost: { name: 'Frost Nova', cost: 35, cd: 10, range: 200, freeze: 2.5, damage: 10,  },
};

export const ENEMIES = {
  puffcap: {
    name: 'Puffcap', hp: 84, speed: 72, radius: 10, moveRadius: 7,
    attackRange: 30, pauseTime: 0.35, hopDist: 46, hopTime: 0.25, damage: 10, attackCd: 1.4,
    coinDrop: 1, heartChance: 0.25, shardChance: 0, magnetChance: 0, bombChance: 0,
  },
  tinket: {
    name: 'Tinket', hp: 68, speed: 55, radius: 9, moveRadius: 7,
    stopRange: 145, aimTime: 0.55, boltSpeed: 180, damage: 9, attackCd: 2.2,
    coinDrop: 1, heartChance: 0.2, shardChance: 0, magnetChance: 0, bombChance: 0,
  },
  brambler: {
    name: 'Brambler', hp: 190, speed: 42, radius: 12, moveRadius: 7,
    attackRange: 48, rootTime: 0.45, ringRadius: 70, damage: 20, attackCd: 2.6,
    coinDrop: 2, heartChance: 0.22, shardChance: 0.25, magnetChance: 0, bombChance: 0.1,
  },

  wisp: {
    name: 'Wisp', hp: 44, speed: 118, radius: 7, moveRadius: 6,
    attackRange: 26, pauseTime: 0.3, hopDist: 60, hopTime: 0.22, damage: 6, attackCd: 1.1,
    coinDrop: 1, heartChance: 0.15, shardChance: 0, magnetChance: 0.15, bombChance: 0,
  },

  bulwark: {
    name: 'Bulwark', hp: 300, speed: 32, radius: 14, moveRadius: 8,
    attackRange: 52, rootTime: 0.5, ringRadius: 78, damage: 25, attackCd: 3.0,
    coinDrop: 3, heartChance: 0.25, shardChance: 0.3, magnetChance: 0, bombChance: 0.25, starchipChance: 0.1,
  },
};

export const TINKET_FROM_WAVE = 2;
export const TINKET_MAX_PER_GROUP = 2;
export const BRAMBLER_FROM_WAVE = 3;
export const BRAMBLER_MAX_PER_GROUP_EARLY = 1;
export const BRAMBLER_MAX_PER_GROUP_LATE = 2;
export const WISP_FROM_WAVE = 2;
export const BULWARK_FROM_WAVE = 4;

export const BOSS = {
  name: 'The Gloam Bell',
  hp: 1300,
  speed: 48,
  radius: 16,
  moveRadius: 14,
  contactDamage: 15,
  ringRadius: 140,
  ringTelegraph: 0.9,
  ringActive: 0.25,
  ringDamage: 22,
  fanTelegraph: 0.6,
  fanShards: 5,
  fanSpreadDeg: 12,
  fanSpeed: 210,
  fanDamage: 11,
  fanLife: 1.5,
  echoMarkers: 3,
  echoRadius: 44,
  echoOffsets: 48,
  echoDelay: 0.8,
  echoDamage: 17,
  recovery: 0.75,
  roarTime: 0.8,
  phase2At: 0.6,
  phase2SpeedMul: 1 / 0.85,
  phase3At: 0.25,
  phase3MoveMul: 1.2,
  spawnDist: 200,
  lootCoins: 30,
  lootShards: 3,
  lootHeart: 30,
};

export const LOOT = {
  lifetime: 20,
  magnetRange: 90,
  magnetSpeed: 180,
  collectCoin: 36,
  collectHeart: 28,
  coinScore: 2,
  shardScore: 25,
  killScore: 100,
  bossScore: 1000,
  waveClearPerSecond: 5,
  waveClearShards: [0, 1, 0, 1, 0, 1, 0, 0],
  chestCoinsMin: 4,
  chestCoinsMax: 8,
  statueEnergy: 20,
  statueTime: 1.2,
};

export const UPGRADES = [  { id: 'wick', name: 'Bright Wick', cost: 12, cur: 'coin', max: 2, desc: 'Bolt +3 damage', ic: 'candle' },
  { id: 'hands', name: 'Quick Hands', cost: 10, cur: 'coin', max: 2, desc: 'Bolt interval -0.08s', ic: 'bolt' },
  { id: 'thread', name: 'Long Thread', cost: 10, cur: 'coin', max: 2, desc: 'Bolt range +35px', ic: 'thread' },
  { id: 'cape', name: 'Padded Cape', cost: 14, cur: 'coin', max: 2, desc: '+20 max HP, heal 20', ic: 'cape' },
  { id: 'charm', name: 'Shard Charm', cost: 2, cur: 'shard', max: 1, desc: 'Crescent +10, Ember tick +3, Starfall +15', ic: 'gem' },
];

export const SHOP = [
  { id: 'shopHeart', name: 'Heart', ic: 'heart', desc: 'Heal +30 HP', cost: 60 },
  { id: 'shopEnergy', name: 'Energy', ic: 'bolt', desc: 'Restore +50 skill energy', cost: 45 },
  { id: 'shopBomb', name: 'Bomb', ic: 'bomb', desc: '+1 bomb to bag', cost: 35 },
  { id: 'shopMagnet', name: 'Magnet', ic: 'magnet', desc: '+1 magnet to bag', cost: 30 },
];

export const FEEL = {
  hitstopBolt: 2,
  hitstopCrescent: 3,
  hitstopStarfallBoss: 5,
  shakePlayerHit: { amp: 3, time: 0.08 },
  shakeSlam: { amp: 5, time: 0.12 },
  shakeStarfall: { amp: 20, time: 0.3 },
  shakeBossDeath: { amp: 10, time: 0.2 },
  damageRise: 22,
  damageLife: 0.65,
  deathParticles: 22,
  bossDeathParticles: 60,
  particleLife: 0.6,
  lowHp: 25,
  lowHpPulseHz: 2,
  lowHpWarnEvery: 5,
};

export const AREAS = [
  {
    name: 'Bloomroot Warrens',
    outline: '#3A7A5E', wall: '#35705F', wallTop: '#4FA88A', floor: '#71CC6F',
    floorAlt: '#7ED47E', moss: '#A5E37A', water: '#45C8B2', flower: '#FF7099',
    loot: '#F5D45A', highlight: '#FFF3C4', sky: '#2F7D5C', mapWall: '#57B795',
  },
  {
    name: 'Cinderglass Works',
    outline: '#5C3A44', wall: '#5C3644', wallTop: '#7A4A58', floor: '#F07F4A',
    floorAlt: '#F58F5C', forge: '#F59B42', machinery: '#35C9D0', hazard: '#E94F62',
    loot: '#FFE073', highlight: '#FFF2D0', sky: '#7A4A30', mapWall: '#C08A96',
  },
  {
    name: 'Moonmilk Vault',
    outline: '#4A3A66', wall: '#6058AC', wallTop: '#7A72C4', floor: '#A58CD0',
    floorAlt: '#B39DDB', crystal: '#C9BBF5', glow: '#76DDE0', fungus: '#A7E760',
    loot: '#FFD76A', highlight: '#F6F0FF', sky: '#4A4A9A', mapWall: '#A89FE8',
  },
];

export const CAM = {
  fov: 50,
  tiltDeg: 38,
  tiltMin: 25,
  tiltMax: 70,

  dist: 16,
  targetHeight: 1.4,
  neriHeight: 3.4,

  bossHeight: 4.6,
  maxPitch: 0.35,
  titleShiftX: 9,
};

export const HUD = {
  hpW: 280, hpH: 26,
  energyW: 220, energyH: 14,
  waveFont: 30, timerFont: 18, areaFont: 14,
  bossBarW: 560, bossBarH: 18,
  minimap: 140,
  joyOuter: 112, joyThumb: 48, joyTravel: 31,
  skillD: 64, starD: 72, minTouch: 52,
};
