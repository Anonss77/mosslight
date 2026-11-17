
import * as THREE from 'three';
import { TILE, FIELD_W, FIELD_H, AREAS, CAM, HEROES } from './config.js';
import { makeRng } from './random.js';
import {
 buildLantern, buildAuraRing, buildMoth,
 buildPuffcap, buildTinket, buildBrambler, buildBoss,
 buildWisp, buildBulwark, buildMagnet, buildBomb, buildStarchip,
 buildCoin, buildHeart, buildShard, buildChest, buildStatue, buildProp, buildTorch,
 buildSlash, buildEmberPatch, buildStreak, buildTelegraphRing, buildAimLine,
 blobShadow, lam,
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
   for (let i = 0; i < 6; i++) {
    ctx.fillStyle = pal.water;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.ellipse(vrng.range(100, FIELD_W - 100) * sx, vrng.range(100, FIELD_H - 100) * sy, 26, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
   }
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

 const PROP_KINDS = [
  ['flower', 'tuft', 'pond', 'mushroom', 'tree', 'bush', 'stump'],
  ['anvil', 'gear', 'furnace', 'crystal', 'rock', 'barrel', 'crate'],
  ['crystal', 'obelisk', 'starflower', 'fungus', 'rock', 'moonflower', 'spire'],
 ];
 function buildProps() {
  scene.remove(propGroup);
  propGroup = new THREE.Group();
  scene.add(propGroup);
  const vrng = makeRng(0x51ab3f ^ (area * 7919 + 13));
  const kinds = PROP_KINDS[area];
  const FW = FIELD_W / TILE, FH = FIELD_H / TILE;
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion(), pv = new THREE.Vector3(), sv = new THREE.Vector3();

  for (let i = 0; i < 240; i++) {
   const { group } = buildProp(area, vrng.pick(kinds));
   group.position.set(vrng.range(3, FW - 3), 0, vrng.range(3, FH - 3));
   group.rotation.y = vrng.range(0, Math.PI * 2);
   group.scale.setScalar(vrng.range(0.85, 1.3));
   propGroup.add(group);
  }

  const tuftGeo = new THREE.ConeGeometry(0.13, 0.85, 5);
  const tuftMat = new THREE.MeshLambertMaterial({ color: area === 2 ? 0xa7e760 : 0x5da85a });
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
 let slashMesh = null;
 let emberMeshes = new Map();
 const streakPool = [];

 async function loadHero(id) {
  const H = HEROES[id] || HEROES.neri;
  id = HEROES[id] ? id : 'neri';
  if (heroCache[id]) { setHero(heroCache[id]); return heroCache[id]; }
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
    setHero(built);
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
   const m = new THREE.Mesh(
    new THREE.TetrahedronGeometry(0.14),
    new THREE.MeshBasicMaterial({ color: 0xffffff }),
   );
   m.visible = false;
   scene.add(m);
   p = { mesh: m, inUse: false, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 1 };
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

 function setField(f) {
  field = f;
  area = 0;
  bakeFloor();
  buildProps();
  buildChestsAndStatues();
  buildTitleDecor();
  setSky();
 }

 function setArea(a) {
  if (a === area) return;
  area = a;
  bakeFloor();
  buildProps();
  setSky();
 }

 function pxPerUnit() {
  const h = renderer.domElement.height / renderer.getPixelRatio();
  return h / (2 * CAM.dist * Math.tan((CAM.fov * Math.PI) / 360));
 }

 function sync(sim, dt) {
  const p = sim.player;
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
   const col = pr.kind === 'tinket' ? 0x35c9d0 : pr.kind === 'shard' ? 0x7fe8ff : 0xffc94d;
   slot.core.material.color.set(col);
   slot.glow.material.color.set(col);
   const s = pr.kind === 'shard' ? 1.25 : 1;
   slot.group.scale.setScalar(s);
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
   slot.mesh.scale.setScalar(k);
   slot.mesh.rotation.x = pt.rot;
   slot.mesh.rotation.y = pt.rot * 1.3;
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
   if (!slashMesh) { slashMesh = buildSlash(); scene.add(slashMesh.group); }
   slashMesh.group.visible = true;
   const s = sim.slash;
   slashMesh.group.position.set(toX(s.x), 0.7, toZ(s.y));
   slashMesh.group.rotation.y = s.angle;
   const k = 1 - s.life / s.maxLife;
   slashMesh.group.scale.setScalar(1.15 + k * 2.1);
   slashMesh.parts.arc.material.opacity = 0.95 * (s.life / s.maxLife);
   slashMesh.parts.glow.material.opacity = 0.45 * (s.life / s.maxLife);
  } else if (slashMesh) {
   slashMesh.group.visible = false;
  }

  const seenEmbers = new Set();
  for (const e of sim.embers) {
   seenEmbers.add(e.id);
   let em = emberMeshes.get(e.id);
   if (!em) {
    em = buildEmberPatch();
    em.group.scale.set(e.r * PX, 1, e.r * PX);
    scene.add(em.group);
    emberMeshes.set(e.id, em);
   }
   em.group.position.set(toX(e.x), 0, toZ(e.y));
   em.group.visible = true;
   const flick = 0.85 + Math.sin(sim.time * 13 + e.id * 2) * 0.15;
   em.parts.tongues.forEach((t, i) => { t.scale.y = flick * (1 + Math.sin(sim.time * 9 + i * 1.4) * 0.2); });
  }
  for (const [id, em] of emberMeshes) {
   if (!seenEmbers.has(id)) { scene.remove(em.group); emberMeshes.delete(id); }
  }

  for (const st of streakPool) st.group.visible = false;
  let si = 0;
  for (const st of sim.streaks) {
   let slot = streakPool[si];
   if (!slot) {
    slot = buildStreak();
    slot.group.scale.set(2.6, 3.0, 2.6);
    scene.add(slot.group);
    streakPool.push(slot);
   }
   slot.group.visible = true;
   slot.group.position.set(toX(st.x), st.h, toZ(st.y));
   si++;
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

 return { setField, setArea, sync, render, resize, setPixelRatio, loadHero, isHeroLoaded: () => !!hero, scene, camera, renderer };
}
