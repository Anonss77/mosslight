
import * as THREE from 'three';
import { TILE, FIELD_W, FIELD_H, AREAS, CAM, HEROES } from './config.js';
import { makeRng } from './random.js';
import {
buildLantern, buildAuraRing, buildMoth,
buildPuffcap, buildTinket, buildBrambler, buildBoss,
buildWisp, buildBulwark, buildMagnet, buildBomb, buildStarchip,
buildCoin, buildHeart, buildShard, buildChest, buildStatue, buildProp, buildTorch,
buildTelegraphRing, buildAimLine,
} from './models.js';
import { GLTFLoader } from '../vendor/loaders/GLTFLoader.js';

const PX = 1 / TILE;
const toX = (px) => px * PX;
const toZ = (py) => py * PX;

function tileHash(tx, ty) {
let h = (tx * 374761393 + ty * 668265263) | 0;
h = (h ^ (h >> 13)) | 0;
h = Math.imul(h, 1274126177);
return ((h ^ (h >> 16)) >>> 0) / 4294967296;
}

export function createWorld(canvas) {
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(CAM.fov, 1, 0.1, 400);
const ambient = new THREE.AmbientLight(0xffffff, 1.6);
scene.add(ambient);
const sun = new THREE.DirectionalLight(0xfff2d0, 2.4);
sun.position.set(6, 14, 4);
scene.add(sun);

let field = null;
let area = 0;
let floorMesh = null;
let propGroup = new THREE.Group();
scene.add(propGroup);
let chestMeshes = [];
let statueMeshes = [];

let skyTex = null;
function shade(hex, f) {
const n = parseInt(hex.slice(1), 16);
const r = Math.min(255, Math.round(((n >> 16) & 255) * f));
const g = Math.min(255, Math.round(((n >> 8) & 255) * f));
const b = Math.min(255, Math.round((n & 255) * f));
return `rgb(${r},${g},${b})`;
}
function setSky() {
const pal = AREAS[area];
const cv = document.createElement('canvas');
cv.width = 4; cv.height = 256;
const ctx = cv.getContext('2d');
const grad = ctx.createLinearGradient(0, 0, 0, 256);
grad.addColorStop(0, shade(pal.sky, 0.5));
grad.addColorStop(0.62, pal.sky);
grad.addColorStop(1, shade(pal.sky, 1.5));
ctx.fillStyle = grad;
ctx.fillRect(0, 0, 4, 256);
if (skyTex) skyTex.dispose();
skyTex = new THREE.CanvasTexture(cv);
skyTex.colorSpace = THREE.SRGBColorSpace;
scene.background = skyTex;
}
function bakeFloor() {
const pal = AREAS[area];
const cv = document.createElement('canvas');
cv.width = 1200; cv.height = 900;
const ctx = cv.getContext('2d');
const vrng = makeRng(0x51ab3f ^ (area * 7919 + 13));
const sx = 1200 / FIELD_W, sy = 900 / FIELD_H;

for (let ty = 0; ty < FIELD_H / TILE; ty++) {
for (let tx = 0; tx < FIELD_W / TILE; tx++) {
ctx.fillStyle = (tx + ty) % 2 === 0 ? pal.floor : pal.floorAlt;
ctx.fillRect(tx * TILE * sx, ty * TILE * sy, TILE * sx + 0.5, TILE * sy + 0.5);
}
}

ctx.fillStyle = pal.highlight;
ctx.globalAlpha = 0.35;
for (let i = 0; i < 1600; i++) ctx.fillRect((i * 53) % 1200, (i * 97) % 900, 2, 2);
ctx.globalAlpha = 1;

if (area === 0) {
for (let i = 0; i < 500; i++) {
ctx.fillStyle = pal.flower;
ctx.fillRect(vrng.range(0, FIELD_W) * sx, vrng.range(0, FIELD_H) * sy, 3, 3);
}
} else if (area === 1) {
for (let i = 0; i < 8; i++) {
ctx.fillStyle = pal.wall;
ctx.globalAlpha = 0.5;
ctx.beginPath();
ctx.ellipse(vrng.range(100, FIELD_W - 100) * sx, vrng.range(100, FIELD_H - 100) * sy, 60, 40, 0, 0, Math.PI * 2);
ctx.fill();
ctx.globalAlpha = 1;
}
for (let i = 0; i < 320; i++) {
ctx.fillStyle = vrng.chance(0.5) ? pal.machinery : pal.forge;
ctx.globalAlpha = 0.8;
ctx.fillRect(vrng.range(0, FIELD_W) * sx, vrng.range(0, FIELD_H) * sy, 4, 4);
ctx.globalAlpha = 1;
}
} else {
for (let i = 0; i < 420; i++) {
ctx.fillStyle = vrng.chance(0.55) ? pal.crystal : pal.fungus;
ctx.globalAlpha = 0.85;
ctx.fillRect(vrng.range(0, FIELD_W) * sx, vrng.range(0, FIELD_H) * sy, 3, 3);
ctx.globalAlpha = 1;
}
}
const tex = new THREE.CanvasTexture(cv);
tex.colorSpace = THREE.SRGBColorSpace;
tex.anisotropy = 4;
if (floorMesh) {
floorMesh.material.map.dispose();
floorMesh.material.map = tex;
floorMesh.material.needsUpdate = true;
} else {
floorMesh = new THREE.Mesh(
new THREE.PlaneGeometry(FIELD_W / TILE, FIELD_H / TILE),
new THREE.MeshLambertMaterial({ map: tex }),
);
floorMesh.rotation.x = -Math.PI / 2;
floorMesh.position.set(FIELD_W / TILE / 2, 0, FIELD_H / TILE / 2);
scene.add(floorMesh);
}
}

const NP = (a) => a.map(([f, s]) => ['nature/' + f, s]);
const PROP_GLB = [
NP([['tree_oak.glb', 2.2], ['tree_pineTallA.glb', 2], ['tree_detailed.glb', 1.8], ['tree_pineRoundA.glb', 1.9], ['rock_largeA.glb', 1.6], ['rock_smallA.glb', 1.2], ['flower_redA.glb', 1.4], ['flower_yellowA.glb', 1.4], ['flower_purpleA.glb', 1.4], ['mushroom_red.glb', 1.6], ['mushroom_redTall.glb', 1.6], ['log.glb', 1.4], ['stump_round.glb', 1.3], ['plant_bush.glb', 1.5], ['grass_large.glb', 1.6]]),
NP([['campfire_stones.glb', 1.8], ['rock_largeA.glb', 1.6], ['rock_smallA.glb', 1.2], ['log.glb', 1.4], ['stump_round.glb', 1.3], ['tree_pineTallA.glb', 1.6]]),
[['crystal.glb', 0.55], ['crystal.glb', 0.4], ['nature/rock_largeA.glb', 1.6], ['nature/rock_smallA.glb', 1.2]],
];
const glbCache = {}, glbWait = {};
function glbGet(f) {
if (glbCache[f]) return Promise.resolve(glbCache[f]);
if (!glbWait[f]) glbWait[f] = new GLTFLoader().loadAsync('assets/' + f).then((g) => (glbCache[f] = g.scene)).catch(() => null);
return glbWait[f];
}
function glbPut(f, x, z, ry, sc) {
const g0 = propGroup;
glbGet(f).then((sc0) => {
if (!sc0 || !g0.parent) return;
const c = sc0.clone();
c.position.set(x, 0, z); c.rotation.y = ry; c.scale.setScalar(sc);
g0.add(c);
});
}
function buildProps() {
scene.remove(propGroup);
propGroup = new THREE.Group();
scene.add(propGroup);
const vrng = makeRng(0x51ab3f ^ (area * 7919 + 13));
const kinds = PROP_GLB[area];
const FW = FIELD_W / TILE, FH = FIELD_H / TILE;
const m4 = new THREE.Matrix4();
const q = new THREE.Quaternion(), pv = new THREE.Vector3(), sv = new THREE.Vector3();

for (let i = 0; i < 240; i++) {
const [f, s0] = vrng.pick(kinds);
glbPut(f, vrng.range(3, FW - 3), vrng.range(3, FH - 3), vrng.range(0, Math.PI * 2), s0 * vrng.range(0.85, 1.3));
}
if (area === 0) {
glbPut('shrine.glb', FW * 0.22, FH * 0.3, 0.4, 2);
glbPut('town/pillar-stone.glb', FW * 0.22 - 5, FH * 0.3 + 4, 0, 1.8);
glbPut('town/pillar-stone.glb', FW * 0.22 + 5, FH * 0.3 + 4, 0, 1.8);
} else if (area === 2) {
glbPut('cave/gate-rock.glb', FW / 2, 5, 0, 2.4);
glbPut('crystal.glb', FW * 0.75, FH * 0.65, 0.8, 0.7);
}

const tuftGeo = new THREE.ConeGeometry(0.13, 0.85, 5);
const tuftMat = new THREE.MeshLambertMaterial({ color: area === 2 ? 0xa7e760 : 0x5da85a });
windMat(tuftMat, 0.8);
const TUFTS = 1600;
const tufts = new THREE.InstancedMesh(tuftGeo, tuftMat, TUFTS * 3);
for (let i = 0; i < TUFTS; i++) {
const bx = vrng.range(2, FW - 2), bz = vrng.range(2, FH - 2);
for (let j = 0; j < 3; j++) {
const s = vrng.range(0.7, 1.3);
m4.compose(pv.set(bx + vrng.range(-0.14, 0.14), 0.3 * s, bz + vrng.range(-0.14, 0.14)), q, sv.set(s, s, s));
tufts.setMatrixAt(i * 3 + j, m4);
}
}
tufts.instanceMatrix.needsUpdate = true;
propGroup.add(tufts);

const per = Math.floor((FW + FH) * 2 / 2.4);
const trunkGeo = new THREE.CylinderGeometry(0.14, 0.22, 0.9, 7);
const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6a452c });
const canopyGeo = new THREE.SphereGeometry(0.62, 10, 8);
const canopyMat = new THREE.MeshLambertMaterial({ color: area === 0 ? 0x4a9a4a : area === 1 ? 0x7a5a3a : 0x8a7ac8 });
windMat(canopyMat, 0.25);
const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, per);
const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, per);
for (let i = 0; i < per; i++) {
const t = (i / per) * (FW + FH) * 2;

const jt = vrng.range(-0.9, 0.9);
const jd = vrng.range(-0.3, 2.4);
let x, z;
if (t < FW) { x = t + jt; z = 0.6 + jd; }
else if (t < FW + FH) { x = FW - 0.6 - jd; z = t - FW + jt; }
else if (t < FW * 2 + FH) { x = FW - (t - FW - FH) + jt; z = FH - 0.6 - jd; }
else { x = 0.6 + jd; z = FH - (t - FW * 2 - FH) + jt; }

const s = (0.8 + tileHash(i * 3, area) * 1.2) * (t < FW ? 2.2 : 1);
m4.compose(pv.set(x, 0.45 * s, z), q, sv.set(s, s, s));
trunks.setMatrixAt(i, m4);
m4.compose(pv.set(x, 1.25 * s, z), q, sv.set(s, s, s));
canopies.setMatrixAt(i, m4);
}
trunks.instanceMatrix.needsUpdate = true;
canopies.instanceMatrix.needsUpdate = true;
propGroup.add(trunks, canopies);
}

function buildChestsAndStatues() {
for (const c of chestMeshes) scene.remove(c.group);
for (const s of statueMeshes) scene.remove(s.group);
chestMeshes = field.chests.map((c) => {
const built = buildChest();
built.group.position.set(toX(c.x), 0, toZ(c.y));
scene.add(built.group);
return { ...built, data: c };
});
statueMeshes = field.statues.map((s) => {
const built = buildStatue();
built.group.position.set(toX(s.x), 0, toZ(s.y));
scene.add(built.group);
return { ...built, data: s };
});
}

let titleDecor = null;
function buildTitleDecor() {
if (titleDecor) scene.remove(titleDecor);
titleDecor = new THREE.Group();
const put = (built, x, z, s, ry = 0) => {
const g = built.group || built;
g.position.set(x, 0, z);
g.scale.setScalar(s);
g.rotation.y = ry;
titleDecor.add(g);
return built;
};
put(buildStatue(), 52.5, 50, 1.8);
put(buildProp(0, 'crystal'), 55, 55, 2.1);
put(buildProp(0, 'mushroom'), 56, 58, 2.6);
put(buildTorch(), 53, 46, 1);
put(buildStatue(), 79.5, 50, 1.8, 0.6);
put(buildProp(0, 'obelisk'), 77, 55, 1.7);
put(buildProp(0, 'crystal'), 76, 58, 2.1);
put(buildTorch(), 79, 46, 1);
scene.add(titleDecor);
}

const enemyMeshes = new Map();
const hpBars = new Map();

let bossHpBar = null;
const lootMeshes = new Map();
const pickupMeshes = new Map();
const projPool = [];
const particlePool = [];
const damagePool = [];
const telegraphPool = [];
const aimPool = [];
let hero = null;
const heroCache = {};
const heroLoading = {};
let bossMesh = null;

async function loadHero(id, keep) {
const H = HEROES[id] || HEROES.neri;
id = HEROES[id] ? id : 'neri';
if (heroCache[id]) { if (!keep) setHero(heroCache[id]); return heroCache[id]; }
if (heroLoading[id]) return heroLoading[id];
heroLoading[id] = (async () => {
try {
const gltf = await new GLTFLoader().loadAsync('assets/' + H.file);
const model = gltf.scene;
const HIDDEN = new Set(H.hide);
model.traverse((o) => { if (HIDDEN.has(o.name)) o.visible = false; });
model.updateMatrixWorld(true);
const bodyBox = new THREE.Box3();
model.traverse((o) => {
if (o.isMesh && o.name.startsWith(H.prefix)) bodyBox.expandByObject(o);
});
if (bodyBox.isEmpty()) bodyBox.setFromObject(model);
const size = new THREE.Vector3();
bodyBox.getSize(size);
const s = CAM.neriHeight / Math.max(0.01, size.y);
model.scale.setScalar(s);
model.updateMatrixWorld(true);
const footBox = new THREE.Box3();
model.traverse((o) => {
if (o.isMesh && o.name.startsWith(H.prefix)) footBox.expandByObject(o);
});
if (!footBox.isEmpty()) model.position.y = -footBox.min.y;
const group = new THREE.Group();
group.add(model);
let lantern = null, aura = null, moth = null;
if (id === 'neri') {
let hand = null;
model.traverse((o) => { if (!hand && (o.name === 'handslotl' || o.name === 'handl')) hand = o; });
if (!hand) model.traverse((o) => { if (!hand && (o.name === 'handslotr' || o.name === 'handr')) hand = o; });
lantern = buildLantern();
if (hand) hand.add(lantern.group);
else { lantern.group.position.set(-0.7, 1.4, 0.2); group.add(lantern.group); }
const k = CAM.neriHeight / 2.6;
aura = buildAuraRing();
aura.scale.setScalar(k);
group.add(aura);
moth = buildMoth();
moth.position.set(0.75 * k, 2.0 * k, 0.3 * k);
moth.scale.setScalar(k);
group.add(moth);
}
group.visible = false;
scene.add(group);
let modelMat = null;
model.traverse((o) => { if (!modelMat && o.isMesh && o.material) modelMat = o.material; });
const mixer = new THREE.AnimationMixer(model);
const clips = {};
for (const c of gltf.animations) clips[c.name] = c;
const pick = (...names) => { for (const n of names) if (clips[n]) return clips[n]; return null; };
const defs = {
idle: pick('Idle', 'Unarmed_Idle'),
walk: pick('Walking_A', 'Walking_B', 'Walking_C'),
run: pick('Running_A', 'Running_B'),
cast: pick(H.cast, 'Spellcast_Shoot'),
castLong: pick(H.castLong, 'Spellcast_Raise'),
hurt: pick('Hit_A', 'Hit_B'),
death: pick('Death_A', 'Death_B'),
cheer: pick('Cheer'),
};
const actions = {};
for (const [k, clip] of Object.entries(defs)) if (clip) actions[k] = mixer.clipAction(clip);
if (actions.idle) actions.idle.play();
const built = {
id, group, model, modelMat, mixer, actions, lantern, aura, moth,
current: actions.idle || null, oneshot: null,
prevCd: { s1: 0, s2: 0, ult: 0 },
prevHurt: 0, yawOffset: 0,
};
mixer.addEventListener('finished', (e) => { if (built.oneshot === e.action) built.oneshot = null; });
heroCache[id] = built;
if (!keep) setHero(built);
return built;
} catch (err) {
console.error('[mosslight] hero glb failed to load', id, err);
heroLoading[id] = null;
return null;
}
})();
return heroLoading[id];
}

function setHero(built) {
if (hero && hero !== built) hero.group.visible = false;
hero = built;
}

function getProj() {
let p = projPool.find((e) => !e.inUse);
if (!p) {
const g = new THREE.Group();
const core = new THREE.Mesh(
new THREE.SphereGeometry(0.16, 10, 8),
new THREE.MeshBasicMaterial({ color: 0xffc94d }),
);
const glow = new THREE.Mesh(
new THREE.SphereGeometry(0.34, 10, 8),
new THREE.MeshBasicMaterial({ color: 0xffb830, transparent: true, opacity: 0.35, depthWrite: false }),
);
g.add(core, glow);
g.visible = false;
scene.add(g);
p = { group: g, core, glow, inUse: false };
projPool.push(p);
}
return p;
}

function getParticle() {
let p = particlePool.find((e) => !e.inUse);
if (!p) {
const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: fxTex('dot'), transparent: true, depthWrite: false }));
m.visible = false;
scene.add(m);
p = { mesh: m, inUse: false };
particlePool.push(p);
}
return p;
}

function getDamageSprite() {
let d = damagePool.find((e) => !e.inUse);
if (!d) {
const cv = document.createElement('canvas');
cv.width = 160; cv.height = 72;
const tex = new THREE.CanvasTexture(cv);
const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
spr.visible = false;
spr.renderOrder = 10;
scene.add(spr);
d = { sprite: spr, canvas: cv, tex, inUse: false };
damagePool.push(d);
}
return d;
}

function drawDamage(d, text, color, sizePx) {
const ctx = d.canvas.getContext('2d');
ctx.clearRect(0, 0, 160, 72);
ctx.font = `bold ${sizePx}px Trebuchet MS, sans-serif`;
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.lineWidth = 6;
ctx.strokeStyle = '#1a1a1a';
ctx.strokeText(text, 80, 36);
ctx.fillStyle = color;
ctx.fillText(text, 80, 36);
d.tex.needsUpdate = true;
}

function makeHpBar(w) {
const g = new THREE.Group();
const bg = new THREE.Mesh(
new THREE.PlaneGeometry(w, 0.15),
new THREE.MeshBasicMaterial({ color: 0x1a1a1a, transparent: true, opacity: 0.85, depthTest: false }),
);
bg.renderOrder = 5;
const fillW = w - 0.06;
const fill = new THREE.Mesh(
new THREE.PlaneGeometry(fillW, 0.1),
new THREE.MeshBasicMaterial({ color: 0x7fe07f, transparent: true, opacity: 0.95, depthTest: false }),
);
fill.renderOrder = 6;
fill.position.z = 0.001;
g.add(bg, fill);
g.visible = false;
scene.add(g);
return { group: g, fill, fillW };
}

function updateHpBar(hb, frac) {
const f = Math.max(0, Math.min(1, frac));
hb.fill.scale.x = Math.max(0.001, f);
hb.fill.position.x = -(1 - f) * hb.fillW / 2;
hb.fill.material.color.setHex(f > 0.5 ? 0x7fe07f : f > 0.25 ? 0xffc94d : 0xff4f4f);
hb.group.visible = true;
}

function getTelegraph(color, radius) {
let t = telegraphPool.find((e) => !e.inUse);
if (!t) {
const built = buildTelegraphRing(color, 1);
built.group.visible = false;
scene.add(built.group);
t = { ...built, inUse: false, baseRadius: 1 };
telegraphPool.push(t);
}
t.parts.ring.material.color.set(color);
t.parts.fill.material.color.set(color);
return t;
}

const windU = { value: 0 };
function windMat(mat, k) {
mat.onBeforeCompile = (sh) => {
sh.uniforms.uTime = windU;
sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
#ifdef USE_INSTANCING
float wx = instanceMatrix[3][0] + instanceMatrix[3][2];
#else
float wx = 0.0;
#endif
transformed.x += sin(uTime * 1.5 + wx * 0.4) * transformed.y * transformed.y * ${k};`);
};
}
const texL = new THREE.TextureLoader();
const fxTexC = {};
function fxTex(n) {
if (!fxTexC[n]) fxTexC[n] = texL.load('fx/' + n + '.png');
return fxTexC[n];
}
const FXC = { fireball: 8, flame: 6, meteor: 8, 'meteor-v': 8, tornado: 8, frost: 6, slash: 4, dot: 1, smoke: 1, flare: 1, ring: 1 };
const fxPool = [];
function getFx() {
let f = fxPool.find((e) => !e.inUse);
if (!f) {
const spr = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false }));
spr.visible = false; scene.add(spr);
f = { sprite: spr, sheet: '', tex: null, inUse: false, shot: false };
fxPool.push(f);
}
return f;
}
function fxSet(f, name, tint, rot) {
if (f.sheet !== name) {
f.sheet = name;
f.tex = texL.load('fx/' + name + '.png');
f.tex.repeat.set(1 / FXC[name], 1);
f.sprite.material.map = f.tex;
}
f.sprite.material.color.set(tint);
f.sprite.material.rotation = rot || 0;
f.sprite.material.opacity = 1;
}
function showFx(name, fr, x, y, z, sc, tint, rot) {
const f = getFx();
fxSet(f, name, tint, rot);
f.tex.offset.set((fr % FXC[name]) / FXC[name], 0);
f.sprite.position.set(x, y, z);
f.sprite.scale.set(sc, sc, 1);
f.sprite.visible = true; f.inUse = true;
return f;
}
function hideFx() { for (const f of fxPool) if (!f.shot) f.inUse = false; }
const fxShots = [];
function spawnShot(name, x, y, z, sc, tint, rot, dur, grow) {
const f = getFx();
fxSet(f, name, tint, rot);
f.sprite.position.set(x, y, z);
f.sprite.scale.set(sc, sc, 1);
f.sprite.visible = true; f.inUse = true; f.shot = true;
fxShots.push({ f, name, t: 0, dur, n: FXC[name], sc, grow: grow || 1 });
}
function updateShots(dt) {
for (let i = fxShots.length - 1; i >= 0; i--) {
const sh = fxShots[i];
sh.t += dt;
if (sh.t >= sh.dur) { sh.f.sprite.visible = false; sh.f.inUse = false; sh.f.shot = false; fxShots.splice(i, 1); }
else {
const fr = Math.min(sh.n - 1, Math.floor(sh.t / sh.dur * sh.n));
sh.f.tex.offset.set(fr / sh.n, 0);
sh.f.sprite.material.opacity = 1 - (sh.t / sh.dur) * 0.5;
sh.f.sprite.scale.setScalar(sh.sc * (1 + (sh.t / sh.dur) * (sh.grow - 1)));
}
}
}
const ZONE_WATER = [
[0x1a6a5a, 0x45c8b2, 0x9fd8e8, 0x8fc98a, 0xffffff, 0xfff2d0],
[0x7a2a0a, 0xff7a1a, 0xffc94d, 0xc98a4a, 0xffd8b0, 0xffc890],
[0x3a2a6a, 0x8a6ad8, 0xc9a9f0, 0x8a6ad8, 0xd8c8ff, 0xc8b8ff],
];
let waterMesh = null, waterMat = null;
function pondBlobs(a) {
if (a === 1) return [[0.68, 0.55, 0.035, 0.024]];
if (a === 2) return [[0.32, 0.45, 0.038, 0.026]];
const r = makeRng(0x51ab3f ^ 13);
const b = [];
for (let i = 0; i < 6; i++) b.push([r.range(100, FIELD_W - 100) / FIELD_W, r.range(100, FIELD_H - 100) / FIELD_H, 0.022, 0.018]);
return b;
}
const WATER_V = `varying vec2 vUv; varying vec3 vWp;
void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position, 1.0); vWp = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`;
const WATER_F = `uniform float uTime; uniform vec3 uDeep; uniform vec3 uShal; uniform vec4 uBlobs[6];
varying vec2 vUv; varying vec3 vWp;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),u.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),u.x),u.y);}
void main(){float m=0.;for(int i=0;i<6;i++){vec4 b=uBlobs[i];m=max(m,1.-smoothstep(.75,1.,length((vUv-b.xy)/b.zw)));}
if(m<0.05)discard;float w=n(vWp.xz*.12+vec2(uTime*.2,uTime*.1));
vec3 c=mix(uDeep,uShal,.35+w*.5);c+=vec3(1.,.95,.8)*pow(w,6.)*.5;
gl_FragColor=vec4(c,smoothstep(.05,.25,m)*.9);}`;
function setWater(a) {
const z = ZONE_WATER[a];
if (!waterMesh) {
waterMat = new THREE.ShaderMaterial({ vertexShader: WATER_V, fragmentShader: WATER_F, transparent: true, depthWrite: false, uniforms: { uTime: { value: 0 }, uDeep: { value: new THREE.Color(z[0]) }, uShal: { value: new THREE.Color(z[1]) }, uBlobs: { value: [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()] } } });
waterMesh = new THREE.Mesh(new THREE.PlaneGeometry(FIELD_W / TILE, FIELD_H / TILE), waterMat);
waterMesh.rotation.x = -Math.PI / 2;
waterMesh.position.set(FIELD_W / TILE / 2, 0.12, FIELD_H / TILE / 2);
scene.add(waterMesh);
}
const b = pondBlobs(a);
for (let i = 0; i < 6; i++) {
const bb = b[i] || [0, 0, 0, 0];
waterMat.uniforms.uBlobs.value[i].set(bb[0], bb[1], bb[2], bb[3]);
}
waterMat.uniforms.uDeep.value.setHex(z[0]);
waterMat.uniforms.uShal.value.setHex(z[1]);
}
const MOTES = 240;
let motePts = null, motePos = null, moteCol = null, moteBase = null;
const MOTE_COL = [[0xd8ff9a, 0xffe9a8], [0xff8a2a, 0xffc94d], [0xc9a9f0, 0x8a6ad8]];
function buildMotes() {
if (motePts) return;
motePos = new Float32Array(MOTES * 3);
moteCol = new Float32Array(MOTES * 3);
moteBase = new Float32Array(MOTES * 4);
const g = new THREE.BufferGeometry();
g.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
g.setAttribute('color', new THREE.BufferAttribute(moteCol, 3));
const cv = document.createElement('canvas');
cv.width = 32; cv.height = 32;
const ctx = cv.getContext('2d');
const gr = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
ctx.fillStyle = gr; ctx.fillRect(0, 0, 32, 32);
const mat = new THREE.PointsMaterial({ size: 0.55, map: new THREE.CanvasTexture(cv), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
motePts = new THREE.Points(g, mat);
motePts.frustumCulled = false;
const r = makeRng(0x77aa11);
for (let i = 0; i < MOTES; i++) {
moteBase[i * 4] = r.range(4, FIELD_W / TILE - 4);
moteBase[i * 4 + 1] = r.range(4, FIELD_H / TILE - 4);
moteBase[i * 4 + 2] = r.range(0, Math.PI * 2);
moteBase[i * 4 + 3] = r.range(0.4, 1.2);
}
scene.add(motePts);
setMotes(0);
}
function setMotes(a) {
if (!motePts) return;
const [c1, c2] = MOTE_COL[a];
const col = new THREE.Color();
for (let i = 0; i < MOTES; i++) {
col.setHex(i % 2 ? c1 : c2);
moteCol[i * 3] = col.r; moteCol[i * 3 + 1] = col.g; moteCol[i * 3 + 2] = col.b;
}
motePts.geometry.attributes.color.needsUpdate = true;
}
function updateMotes(t, a) {
if (!motePts) return;
for (let i = 0; i < MOTES; i++) {
const bx = moteBase[i * 4], bz = moteBase[i * 4 + 1], ph = moteBase[i * 4 + 2], sp = moteBase[i * 4 + 3];
const leaf = a === 0 && i % 3 !== 0;
const y = a === 1 ? 0.2 + ((t * sp * 0.3 + ph) % 1) * 4 : leaf ? 5 - ((t * sp * 0.35 + ph) % 1) * 5 : 1.2 + Math.sin(t * sp + ph) * 0.8;
motePos[i * 3] = bx + Math.sin(t * sp * 0.7 + ph) * (leaf ? 1.5 : 1);
motePos[i * 3 + 1] = y;
motePos[i * 3 + 2] = bz + Math.cos(t * sp * 0.6 + ph) * (leaf ? 1.5 : 1);
}
motePts.geometry.attributes.position.needsUpdate = true;
}
const animals=[];
let pondC={x:30,z:30};
function mkAn(c,x,z,s,k){
const g=new THREE.Group(),m=new THREE.MeshLambertMaterial({color:c});
const b=new THREE.Mesh(new THREE.SphereGeometry(0.5,8,6),m);
b.scale.set(k===2?1.3:1.5,k===2?0.5:0.85,0.85);
b.position.y=k===2?0.2:0.62;
g.add(b);
if(k!==2){
const h=new THREE.Mesh(new THREE.SphereGeometry(0.26,8,6),m);
h.position.set(0.62,1.05,0);
g.add(h);
}
if(k===0){
const lg=new THREE.CylinderGeometry(0.06,0.06,0.6,5);
for(const[ax,az]of[[-0.45,-0.2],[-0.45,0.2],[0.45,-0.2],[0.45,0.2]]){
const l=new THREE.Mesh(lg,m);
l.position.set(ax,0.3,az);
g.add(l);
}
const an=new THREE.ConeGeometry(0.06,0.5,5);
for(const s2 of[-1,1]){
const a=new THREE.Mesh(an,m);
a.position.set(0.55,1.35,s2*0.15);
a.rotation.z=-0.3;
g.add(a);
}
}
if(k===1){
const w=new THREE.Mesh(new THREE.BoxGeometry(0.9,0.04,0.35),m);
w.position.y=0.9;
g.add(w);
}
g.position.set(x,0,z);
g.scale.setScalar(s);
scene.add(g);
return{grp:g,x,z,cx:x,cz:z,r:k===2?2.5:k===1?6:4,w:k===2?0.5:k===1?0.25:0.3,ang:Math.random()*6.28,fish:k===2,bird:k===1,alt:k===1?6:k===3?2.5:0,bob:k===1?0.8:k===3?0.5:0};
}
function setAnimals(a){
for(const an of animals)scene.remove(an.grp);
animals.length=0;
const b0=pondBlobs(a)[0];
pondC={x:b0[0]*FIELD_W/TILE,z:(1-b0[1])*FIELD_H/TILE};
const FW=FIELD_W/TILE,FH=FIELD_H/TILE;
const put=(k,n,c,s)=>{
for(let i=0;i<n;i++){
const x=k===2?pondC.x:8+Math.random()*(FW-16);
const z=k===2?pondC.z:8+Math.random()*(FH-16);
animals.push(mkAn(c,x,z,s,k));
}
};
if(a===0){put(0,2,0x8a5a2a,1.25);put(1,2,0x3a3a3a,0.8);put(3,1,0xffc94d,0.5);}
if(a===2){put(2,2,0x5aa8d8,0.9);}
}
function updateAnimals(dt,t,px,pz){
for(const a of animals){
const dx=px-a.x,dz=pz-a.z;
if(!a.fish&&!a.bird&&Math.hypot(dx,dz)<5){a.cx-=dx*dt*0.6;a.cz-=dz*dt*0.6;}
a.ang+=dt*a.w;
a.x=a.cx+Math.cos(a.ang)*a.r;
a.z=a.cz+Math.sin(a.ang)*a.r;
a.grp.rotation.y=Math.atan2(-Math.sin(a.ang),Math.cos(a.ang));
a.grp.position.set(a.x,a.alt+Math.sin(t*1.4+a.ang)*a.bob,a.z);
}
}
function setZoneFx(a) {
const z = ZONE_WATER[a];
scene.fog = new THREE.FogExp2(z[3], 0.004);
ambient.color.setHex(z[4]);
sun.color.setHex(z[5]);
setWater(a);
buildMotes();
setMotes(a);
setAnimals(a);
}

function setField(f) {
field = f;
area = 0;
bakeFloor();
buildProps();
buildChestsAndStatues();
buildTitleDecor();
setSky();
setZoneFx(area);
}

function setArea(a) {
if (a === area) return;
area = a;
bakeFloor();
buildProps();
setSky();
setZoneFx(area);
}

function pxPerUnit() {
const h = renderer.domElement.height / renderer.getPixelRatio();
return h / (2 * CAM.dist * Math.tan((CAM.fov * Math.PI) / 360));
}

function sync(sim, dt) {
const p = sim.player;
hideFx();
updateShots(dt);
windU.value = sim.time;
if (waterMat) waterMat.uniforms.uTime.value = sim.time;
updateMotes(sim.time, area);
updateAnimals(dt, sim.time, toX(p.x), toZ(p.y));
const hid = sim.heroId || 'neri';
if (titleDecor) titleDecor.visible = sim.state === 'title';
if (!hero || hero.id !== hid) loadHero(hid);
if (hero) {
const pg = hero.group;
pg.visible = true;
pg.position.set(toX(p.x), 0, toZ(p.y));
pg.rotation.y = Math.PI / 2 - (p.faceAngle || 0) + hero.yawOffset;
const a = hero.actions;
const mvx = p.x - (hero.px ?? p.x), mvy = p.y - (hero.py ?? p.y);
const v = dt > 0 ? Math.hypot(mvx, mvy) / dt : 0;
hero.px = p.x; hero.py = p.y;
const loop = !p.moving ? 'idle' : (v > 110 ? 'run' : 'walk');
hero.dustT = (hero.dustT || 0) - dt;
if (p.moving && v > 60 && hero.dustT <= 0) {
hero.dustT = 0.18;
sim.particles.push({ x: p.x, y: p.y + 10, z: 0.25, vx: 0, vy: 0, vz: 18, life: 0.4, maxLife: 0.4, color: '#d8c9a3', rot: 0 });
}
if (p.hurtT > 0 && hero.prevHurt <= 0 && a.hurt) hero.oneshot = a.hurt;
hero.prevHurt = p.hurtT;
for (const k of ['s1', 's2', 'ult']) {
const cd = p.cooldowns[k] || 0;
if (hero.prevCd[k] <= 0.05 && cd > 1) {
hero.oneshot = (k === 'ult' && a.castLong) ? a.castLong : a.cast;
}
hero.prevCd[k] = cd;
}
if (sim.done?.result === 'victory' && a.cheer && hero.current !== a.cheer) hero.oneshot = a.cheer;
if (sim.done?.result === 'defeat' && a.death && hero.current !== a.death) hero.oneshot = a.death;
const want = hero.oneshot || a[loop] || a.idle || null;
if (want && hero.current !== want) {
const prev = hero.current;
want.reset();
if (want === hero.oneshot) { want.setLoop(THREE.LoopOnce, 1); want.clampWhenFinished = true; }
else { want.setLoop(THREE.LoopRepeat, Infinity); want.clampWhenFinished = false; }
want.play();
if (prev) prev.crossFadeTo(want, 0.15, false);
else want.fadeIn(0.15);
hero.current = want;
}
hero.mixer.update(Math.min(dt, 0.05));
if (hero.lantern) {
hero.lantern.parts.light.intensity = 24 + Math.sin(sim.time * 7) * 3;
hero.moth.position.y = 2.0 + Math.sin(sim.time * 2.2) * 0.16;
hero.moth.position.x = 0.75 + Math.sin(sim.time * 1.5) * 0.1;
hero.aura.material.opacity = 0.24 + Math.sin(sim.time * 3) * 0.06;
}
if (hero.modelMat && hero.modelMat.emissive) {
hero.modelMat.emissive.setHex(p.hurtT > 0 ? 0x881111 : 0x000000);
}
}

const seenEnemies = new Set();
for (const e of sim.enemies) {
seenEnemies.add(e.id);
let em = enemyMeshes.get(e.id);
if (!em) {
const v = e.id % 3;
em = e.type === 'puffcap' ? buildPuffcap(v) : e.type === 'tinket' ? buildTinket(v) : e.type === 'wisp' ? buildWisp() : e.type === 'bulwark' ? buildBulwark() : buildBrambler(v);
scene.add(em.group);
enemyMeshes.set(e.id, { ...em, type: e.type });
}
const g = em.group;
let y = 0;
if (e.type === 'puffcap' && e.hopT > 0) {
const k = 1 - e.hopT / 0.25;
y = Math.sin(k * Math.PI) * 0.55;
g.scale.set(1.25 + k * 0.12, 1.25 - k * 0.15, 1.25 + k * 0.12);
} else {
g.scale.setScalar(1.25);
}
if (e.type === 'wisp') y = 0.55 + Math.sin(sim.time * 3 + e.id) * 0.15;
g.position.set(toX(e.x), y, toZ(e.y));
g.rotation.y = e.faceAngle || 0;
if (e.type === 'tinket') em.parts.key.rotation.y += dt * (e.moving ? 9 : 1.5);
if (e.flashT > 0) {
em.group.traverse((o) => { if (o.isMesh && o.material.emissive) o.material.emissive.setHex(0xffffff); });
} else if ((e.frozenT || 0) > 0) {
em.group.traverse((o) => { if (o.isMesh && o.material.emissive) o.material.emissive.setHex(0x3355cc); });
} else {
em.group.traverse((o) => { if (o.isMesh && o.material.emissive) o.material.emissive.setHex(0x000000); });
}

let hb = hpBars.get(e.id);
if (!hb) { hb = makeHpBar(1.15); hpBars.set(e.id, hb); }
hb.group.position.set(toX(e.x), 1.95, toZ(e.y));
hb.group.quaternion.copy(camera.quaternion);
updateHpBar(hb, e.hp / e.maxHp);
}
for (const [id, em] of enemyMeshes) {
if (!seenEnemies.has(id)) {
scene.remove(em.group); enemyMeshes.delete(id);
const hb = hpBars.get(id);
if (hb) { scene.remove(hb.group); hpBars.delete(id); }
}
}

if (sim.boss) {
if (!bossMesh) { bossMesh = buildBoss(); scene.add(bossMesh.group); }
const b = sim.boss;
const bobY = 0.35 + Math.sin(sim.time * 1.8) * 0.18;
bossMesh.group.position.set(toX(b.x), bobY, toZ(b.y));
bossMesh.group.rotation.y = b.faceAngle || 0;
bossMesh.group.rotation.z = b.telegraphing ? Math.sin(sim.time * 20) * 0.04 : 0;
bossMesh.group.visible = true;
bossMesh.parts.clapper.position.y = 0.25 + Math.sin(sim.time * 6) * 0.08;
if (!bossHpBar) bossHpBar = makeHpBar(2.8);
bossHpBar.group.position.set(toX(b.x), 5.05, toZ(b.y));
bossHpBar.group.quaternion.copy(camera.quaternion);
updateHpBar(bossHpBar, b.hp / b.maxHp);
if (b.flashT > 0) {
bossMesh.parts.body.material.emissive.setHex(0x888888);
} else {
bossMesh.parts.body.material.emissive.setHex(0x0a3a3a);
}
} else if (bossMesh) {
bossMesh.group.visible = false;
if (bossHpBar) bossHpBar.group.visible = false;
}

const seenLoot = new Set();
for (const l of sim.loot) {
seenLoot.add(l.id);
let lm = lootMeshes.get(l.id);
if (!lm) {
lm = l.kind === 'coin' ? buildCoin() : l.kind === 'heart' || l.kind === 'bigheart' ? buildHeart() : l.kind === 'magnet' ? buildMagnet() : l.kind === 'bomb' ? buildBomb() : l.kind === 'starchip' ? buildStarchip() : buildShard();
scene.add(lm.group);
lootMeshes.set(l.id, { ...lm, kind: l.kind });
}
const g = lm.group;
const bobY = 0.25 + Math.sin(sim.time * 3 + l.id * 1.7) * 0.08;
g.position.set(toX(l.x), bobY, toZ(l.y));
if (l.kind === 'coin') g.rotation.y = sim.time * 4 + l.id;
else if (l.kind === 'shard') { g.rotation.y = sim.time * 2.5 + l.id; }
else g.rotation.y = Math.sin(sim.time * 1.5 + l.id) * 0.3;
if (l.kind === 'bigheart') g.scale.setScalar(1.4);
}
for (const [id, lm] of lootMeshes) {
if (!seenLoot.has(id)) { scene.remove(lm.group); lootMeshes.delete(id); }
}

const seenPickups = new Set();
for (const pk of sim.pickups || []) {
if (pk.taken) continue;
seenPickups.add(pk.id);
let pm = pickupMeshes.get(pk.id);
if (!pm) {
pm = pk.kind === 'gem' ? buildShard() : pk.kind === 'coins' ? buildCoin() : buildHeart();
scene.add(pm.group);
pickupMeshes.set(pk.id, { ...pm, kind: pk.kind });
}
const g = pm.group;
const bobY = 0.3 + Math.sin(sim.time * 3 + pk.id * 1.7) * 0.08;
g.position.set(toX(pk.x), bobY, toZ(pk.y));
g.rotation.y = sim.time * 3 + pk.id;
if (pk.kind === 'coins') g.scale.setScalar(1.5);
}
for (const [id, pm] of pickupMeshes) {
if (!seenPickups.has(id)) { scene.remove(pm.group); pickupMeshes.delete(id); }
}

for (const c of chestMeshes) {
c.group.visible = !c.data.opened;
if (c.data.opened) c.parts.lid.rotation.x = -1.1;
}
for (const s of statueMeshes) {
s.parts.ring.material.opacity = s.data.used ? 0.08 : 0.4 + Math.sin(sim.time * 2.5) * 0.12;
}

for (const pr of projPool) pr.inUse = false;
for (const pr of sim.projectiles) {
const slot = getProj();
slot.inUse = true;
slot.group.visible = true;
slot.group.position.set(toX(pr.x), 0.9, toZ(pr.y));
const v = { bolt: HEROES[hid].proj, frostbolt: 'arrow' }[pr.kind] || 'bolt';
const col = pr.kind === 'tinket' ? 0x35c9d0 : pr.kind === 'shard' ? 0x7fe8ff : pr.kind === 'frostbolt' ? 0xbfefff : v === 'arrow' ? 0x2a7a2a : v === 'wave' ? 0xffd76a : 0xffc94d;
slot.core.material.color.set(col);
slot.glow.material.color.set(col);
const s = pr.kind === 'shard' ? 1.25 : 1;
slot.group.scale.set((v === 'arrow' ? 5 : v === 'wave' ? 0.6 : 1) * s, (v === 'wave' ? 3.5 : v === 'arrow' ? 0.6 : 1) * s, v === 'bolt' ? s : 0.6);
slot.group.rotation.y = -Math.atan2(pr.vy, pr.vx);
const ang = -Math.atan2(pr.vy, pr.vx);
if (pr.kind === 'bolt' || pr.kind === 'frostbolt') {
slot.group.visible = false;
showFx('fireball', Math.floor(sim.time * 12 + pr.x) % 8, toX(pr.x), 0.9, toZ(pr.y), 1.5, pr.kind === 'frostbolt' ? 0xbfefff : 0xffffff, ang);
} else if (v === 'arrow') {
spawnShot('dot', toX(pr.x - pr.vx * 0.02), 0.9, toZ(pr.y - pr.vy * 0.02), 0.5, 0xffffff, 0, 0.25);
} else if (v === 'wave') {
spawnShot('dot', toX(pr.x - pr.vx * 0.02), 0.9, toZ(pr.y - pr.vy * 0.02), 0.6, 0xffd76a, 0, 0.25);
}
}
for (const pr of projPool) if (!pr.inUse) pr.group.visible = false;

for (const pt of particlePool) pt.inUse = false;
for (const pt of sim.particles) {
const slot = getParticle();
slot.inUse = true;
slot.mesh.visible = true;
slot.mesh.position.set(toX(pt.x), 0.4 + pt.z, toZ(pt.y));
slot.mesh.material.color.set(pt.color);
const k = Math.max(0.15, pt.life / pt.maxLife);
slot.mesh.scale.set(k * 0.9, k * 0.9, 1);
slot.mesh.material.opacity = Math.min(1, k * 1.5);
}
for (const pt of particlePool) if (!pt.inUse) pt.mesh.visible = false;

for (const d of damagePool) d.inUse = false;
const ppu = pxPerUnit();
for (const dn of sim.damageNumbers) {
const slot = getDamageSprite();
slot.inUse = true;
slot.sprite.visible = true;
drawDamage(slot, dn.text, dn.color, dn.sizePx);
const rise = (1 - dn.life / dn.maxLife) * 22;
slot.sprite.position.set(toX(dn.x), 1.6 + rise * PX, toZ(dn.y));
const h = (dn.sizePx / ppu) * 2.4;
slot.sprite.scale.set(h * (160 / 72), h, 1);
slot.sprite.material.opacity = Math.min(1, (dn.life / dn.maxLife) * 3);
}
for (const d of damagePool) if (!d.inUse) d.sprite.visible = false;

for (const t of telegraphPool) t.inUse = false;
for (const tg of sim.telegraphs) {
const slot = getTelegraph(tg.color, 1);
slot.inUse = true;
slot.group.visible = true;
slot.group.position.set(toX(tg.x), 0, toZ(tg.y));
const r = tg.r * PX;
slot.group.scale.set(r, 1, r);
const k = tg.life / tg.maxLife;
const op = tg.final ? 0.55 + (1 - k) * 0.35 : 0.25 + (1 - k) * 0.3;
slot.parts.ring.material.opacity = op;
slot.parts.fill.material.opacity = op * 0.35;
}
for (const t of telegraphPool) if (!t.inUse) t.group.visible = false;

for (const a of aimPool) a.group.visible = false;
let ai = 0;
for (const tg of sim.telegraphs) {
if (tg.kind !== 'aim') continue;
let line = aimPool[ai];
if (!line) {
line = buildAimLine();
scene.add(line.group);
aimPool.push(line);
}
line.group.visible = true;
line.group.position.set(toX((tg.x0 + tg.x1) / 2), 0.07, toZ((tg.y0 + tg.y1) / 2));
const dx = tg.x1 - tg.x0, dy = tg.y1 - tg.y0;
const len = Math.hypot(dx, dy) * PX;
line.group.scale.set(len, 1, 1);
line.group.rotation.z = -Math.atan2(dy, dx);
ai++;
}

if (sim.slash && sim.slash.life > 0) {
const s = sim.slash;
const k = 1 - s.life / s.maxLife;
const ult = (s.m || 1) > 2;
showFx('slash', Math.min(3, Math.floor(k * 4)), toX(s.x), 0.7, toZ(s.y), (ult ? 5 : 3) * (s.m || 1) * (1 + k * 0.6), ult ? 0xff8a2a : 0xffd76a, -s.angle);
if (ult) {
showFx('tornado', Math.floor(sim.time * 10) % 8, toX(s.x), 1.6, toZ(s.y), 5.5, 0xffffff, 0);
showFx('smoke', 0, toX(s.x), 0.8, toZ(s.y), 4.5, 0xff8a2a, 0);
}
}

for (const e of sim.embers) {
const fr = Math.floor(sim.time * 9 + e.x * 0.13) % 6;
const sc = e.r * PX * 0.9;
showFx('flame', fr, toX(e.x), 0.9, toZ(e.y), sc, 0xffffff, 0);
showFx('flame', (fr + 2) % 6, toX(e.x) + sc * 0.25, 0.6, toZ(e.y) + sc * 0.15, sc * 0.5, 0xffc94d, 0);
showFx('flame', (fr + 4) % 6, toX(e.x) - sc * 0.25, 0.6, toZ(e.y) - sc * 0.15, sc * 0.5, 0xff8a2a, 0);
}

for (const st of sim.streaks) {
showFx(st.col === '#b9a9f0' ? 'meteor-v' : 'meteor', Math.floor(st.t * 22) % 8, toX(st.x), st.h, toZ(st.y), 2.4, 0xffffff, -0.6);
}
if (sim.fxEvents && sim.fxEvents.length) {
for (const ev of sim.fxEvents.splice(0)) {
if (ev.k === 'frost') {
spawnShot('frost', toX(ev.x), 1, toZ(ev.y), 3.2, 0xffffff, 0, 0.45);
spawnShot('ring', toX(ev.x), 1, toZ(ev.y), 1, 0xbfefff, 0, 0.45, 3);
spawnShot('flare', toX(ev.x), 1.2, toZ(ev.y), 1.6, 0xbfefff, 0, 0.3);
} else if (ev.k === 'charge') {
for (let i = 0; i <= 4; i++) {
const t = i / 4;
spawnShot('smoke', toX(ev.x0 + (ev.x1 - ev.x0) * t), 0.6, toZ(ev.y0 + (ev.y1 - ev.y0) * t), 1.6, 0x7fd4ff, 0, 0.4);
}
spawnShot('ring', toX(ev.x1), 1, toZ(ev.y1), 1, 0x7fd4ff, 0, 0.5, 3);
}
}
}

const FW = FIELD_W / TILE, FH = FIELD_H / TILE;
let tx = toX(p.x);
const tz = Math.max(9, Math.min(FH - 9, toZ(p.y)));

if (sim.state === 'title') tx -= CAM.titleShiftX;
tx = Math.max(sim.state === 'title' ? FW / 2 - 24 : 14, Math.min(FW - 14, tx));
const cam = (typeof window !== 'undefined' && window.__cam) || { az: 0, tilt: CAM.tiltDeg };
const tilt = ((cam.tilt ?? CAM.tiltDeg) * Math.PI) / 180;
const dy = Math.sin(tilt) * CAM.dist;
const dz = Math.cos(tilt) * CAM.dist;
const az = cam.az || 0;
const ox = Math.sin(az) * dz, oz = Math.cos(az) * dz;
const fx = -Math.sin(az) * CAM.maxPitch, fz = -Math.cos(az) * CAM.maxPitch;
let shX = 0, shZ = 0;
if (sim.shakeT > 0) {
const k = sim.shakeT / sim.shakeMax;
shX = Math.sin(sim.time * 90) * sim.shakeAmp * k * PX;
shZ = Math.cos(sim.time * 77) * sim.shakeAmp * k * PX;
}
camera.position.set(tx + ox + shX, CAM.targetHeight + dy, tz + oz + shZ);
camera.lookAt(tx + fx + shX, CAM.targetHeight, tz + fz + shZ);
}

function render() {
renderer.render(scene, camera);
}

function resize(w, h) {
renderer.setSize(w, h, false);
camera.aspect = w / h;
camera.updateProjectionMatrix();
}

function setPixelRatio(r) {
renderer.setPixelRatio(r);
}

return { setField, setArea, sync, render, resize, setPixelRatio, loadHero, isHeroLoaded: (id) => (id ? !!heroCache[id] : !!hero), scene, camera, renderer };
}
