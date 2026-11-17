
export const TILE = 16;
export const FIELD_W = 2400;
export const FIELD_H = 1800;

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
{ area: 0, groups: 6, perGroup: 5, hpMul: 1.2, spMul: 1.0 },
{ area: 0, groups: 6, perGroup: 6, hpMul: 1.35, spMul: 1.05 },
{ area: 1, groups: 6, perGroup: 6, hpMul: 1.5, spMul: 1.05 },
{ area: 1, groups: 7, perGroup: 6, hpMul: 1.7, spMul: 1.1 },
{ area: 1, groups: 7, perGroup: 8, hpMul: 1.9, spMul: 1.1 },
{ area: 2, groups: 8, perGroup: 8, hpMul: 2.1, spMul: 1.15 },
{ area: 2, groups: 4, perGroup: 5, hpMul: 1.8, spMul: 1.15, boss: true },
];
export const PLAYER = {
radius: 10,
moveRadius: 7,
energyMax: 100,
energyRegen: 8,
iframes: 0.65,
boltInterval: 0.55,
boltSpeed: 320,
};

export const HEROES = {
neri: { name: 'Neri', file: 'neri.glb', proj: 'bolt', prefix: 'Mage_',
hide: ['2H_Staff', '1H_Wand', 'Spellbook', 'Spellbook_open'],
cast: 'Spellcast_Shoot', castLong: 'Spellcast_Raise',
hp: 100, speed: 180, boltDmg: 5, boltRange: 190,
skills: [
{ name: 'skBolt', fx: 'fan', ic: 'bolt', cost: 20, cd: 4, n: 3, dmg: 6 },
{ name: 'skEmber', fx: 'patch', ic: 'flame', cost: 30, cd: 7, range: 160, r: 72, dmg: 12, tick: 8, tickTime: 2 },
{ name: 'skStar', fx: 'rain', ic: 'star', cost: 100, cd: 30, windup: 0.6, range: 135, dmg: 90, kb: 90, n: 16, col: '#ffd76a' },
] },
aldric: { name: 'Aldric', file: 'aldric.glb', proj: 'wave', prefix: 'Knight_',
hide: ['1H_Sword_Offhand', '2H_Sword', 'Badge_Shield', 'Rectangle_Shield', 'Round_Shield', 'Spike_Shield'],
cast: '1H_Melee_Attack_Slice_Horizontal', castLong: '2H_Melee_Attack_Spin',
hp: 130, speed: 165, boltDmg: 6, boltRange: 150,
skills: [
{ name: 'skArc', fx: 'arc', ic: 'sword', cost: 20, cd: 4, range: 70, dmg: 30, kb: 0 },
{ name: 'skChg', fx: 'charge', ic: 'shield', cost: 30, cd: 7, range: 70, dmg: 22, lunge: 90, kb: 40 },
{ name: 'skWhirl', fx: 'arc', ic: 'whirl', cost: 100, cd: 30, range: 150, dmg: 70, kb: 120 },
] },
lyra: { name: 'Lyra', file: 'lyra.glb', proj: 'arrow', prefix: 'Rogue_',
hide: ['1H_Crossbow', 'Knife', 'Knife_Offhand', 'Throwable'],
cast: '2H_Ranged_Shoot',
hp: 105, speed: 195, boltDmg: 6, boltRange: 230,
skills: [
{ name: 'skVol', fx: 'fan', ic: 'arrows', cost: 20, cd: 4, n: 5, dmg: 8 },
{ name: 'skFrost', fx: 'frostshot', ic: 'frost', cost: 30, cd: 7, dmg: 14, freeze: 2.5 },
{ name: 'skMoon', fx: 'rain', ic: 'moon', cost: 100, cd: 30, windup: 0.6, range: 135, dmg: 100, kb: 60, n: 20, col: '#b9a9f0' },
] },
};

export const ENEMIES = {
puffcap: {
hp: 84, speed: 72, radius: 10, moveRadius: 7,
attackRange: 30, pauseTime: 0.35, hopDist: 46, hopTime: 0.25, damage: 10, attackCd: 1.4,
coinDrop: 1, heartChance: 0.25, shardChance: 0, magnetChance: 0, bombChance: 0,
},
tinket: {
hp: 68, speed: 55, radius: 9, moveRadius: 7,
stopRange: 145, aimTime: 0.55, boltSpeed: 180, damage: 9, attackCd: 2.2,
coinDrop: 1, heartChance: 0.2, shardChance: 0, magnetChance: 0, bombChance: 0,
},
brambler: {
hp: 190, speed: 42, radius: 12, moveRadius: 7,
attackRange: 48, rootTime: 0.45, ringRadius: 70, damage: 20, attackCd: 2.6,
coinDrop: 2, heartChance: 0.22, shardChance: 0.25, magnetChance: 0, bombChance: 0.1,
},

wisp: {
hp: 44, speed: 118, radius: 7, moveRadius: 6,
attackRange: 26, pauseTime: 0.3, hopDist: 60, hopTime: 0.22, damage: 6, attackCd: 1.1,
coinDrop: 1, heartChance: 0.15, shardChance: 0, magnetChance: 0.15, bombChance: 0,
},

bulwark: {
hp: 300, speed: 32, radius: 14, moveRadius: 8,
attackRange: 52, rootTime: 0.5, ringRadius: 78, damage: 25, attackCd: 3.0,
coinDrop: 3, heartChance: 0.25, shardChance: 0.3, magnetChance: 0, bombChance: 0.25, starchipChance: 0.1,
},
};


export const BOSS = {
name: 'The Gloam Bell',
hp: 1600,
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
fanSpeed: 210,
fanDamage: 11,
fanLife: 1.5,
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

export const UPGRADES = [  { id: 'wick', name: 'upWick', cost: 12, cur: 'coin', max: 2, desc: 'upWickD', ic: 'candle' },
{ id: 'hands', name: 'upHands', cost: 10, cur: 'coin', max: 2, desc: 'upHandsD', ic: 'bolt' },
{ id: 'thread', name: 'upThread', cost: 10, cur: 'coin', max: 2, desc: 'upThreadD', ic: 'thread' },
{ id: 'cape', name: 'upCape', cost: 14, cur: 'coin', max: 2, desc: 'upCapeD', ic: 'cape' },
{ id: 'charm', name: 'upCharm', cost: 2, cur: 'shard', max: 1, desc: 'upCharmD', ic: 'gem' },
];

export const SHOP = [
{ id: 'shopHeart', name: 'itHeart', ic: 'heart', desc: 'shHeartD', cost: 60 },
{ id: 'shopEnergy', name: 'shEnergy', ic: 'bolt', desc: 'shEnergyD', cost: 45 },
{ id: 'shopBomb', name: 'itBomb', ic: 'bomb', desc: 'shBombD', cost: 35 },
{ id: 'shopMagnet', name: 'itMag', ic: 'magnet', desc: 'shMagD', cost: 30 },
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
lowHpWarnEvery: 5,
};

export const AREAS = [
{
name: 'Bloomroot Warrens',
wall: '#35705F', floor: '#71CC6F',
floorAlt: '#7ED47E', water: '#45C8B2', flower: '#FF7099',
highlight: '#FFF3C4', sky: '#2F7D5C',
},
{
name: 'Cinderglass Works',
wall: '#5C3644', floor: '#F07F4A',
floorAlt: '#F58F5C', forge: '#F59B42', machinery: '#35C9D0',
highlight: '#FFF2D0', sky: '#7A4A30',
},
{
name: 'Moonmilk Vault',
wall: '#6058AC', floor: '#A58CD0',
floorAlt: '#B39DDB', crystal: '#C9BBF5', fungus: '#A7E760',
highlight: '#F6F0FF', sky: '#4A4A9A',
},
];

export const CAM = {
fov: 50,
tiltDeg: 38,

dist: 16,
targetHeight: 1.4,
neriHeight: 3.4,

maxPitch: 0.35,
titleShiftX: 9,
};
