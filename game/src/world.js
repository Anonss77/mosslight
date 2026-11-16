// Mosslight v5 — 3D world: renderer, camera, lights, floor, walls,
// props, sync sim->meshes. Sim in px (768x576, 16px tiles); 1 unit=16px.
// Decor uses its own visual stream, re-seeded per area bake: the render
// never shifts gameplay.

import * as THREE from 'three';
import { GRID_W, GRID_H, TILE, WORLD_W, WORLD_H, AREAS, CAM } from './config.js';
import { makeRng } from './random.js';
import {
  buildLantern, buildAuraRing, buildMoth,
  buildPuffcap, buildTinket, buildBrambler, buildBoss,
  buildCoin, buildHeart, buildShard, buildChest, buildStatue, buildProp,
  buildSlash, buildEmberPatch, buildStreak, buildTelegraphRing, buildAimLine,
  blobShadow, lam,
} from './models.js';
import { GLTFLoader } from '../vendor/loaders/GLTFLoader.js';
import { isFloor } from './dungeon.js';

const PX = 1 / TILE; // px -> world units
const toX = (px) => px * PX;
const toZ = (py) => py * PX;

// Deterministic per-tile speckle offsets from a tile hash (no RNG calls).
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
  const camera = new THREE.PerspectiveCamera(CAM.fov, 1, 0.1, 200);
  const ambient = new THREE.AmbientLight(0xffffff, 1.6);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight(0xfff2d0, 2.4);
  sun.position.set(6, 14, 4);
  scene.add(sun);
  const farGround = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 400),
    new THREE.MeshLambertMaterial({ color: 0xffffff }),
  );
  farGround.rotation.x = -Math.PI / 2;
  farGround.position.set(GRID_W / 2, -0.08, GRID_H / 2);
  scene.add(farGround);
  function bakeGround() {
    const p = AREAS[area], c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d');
    for (let a = 0; a < 8; a++) for (let b = 0; b < 8; b++) {
      x.fillStyle = (a + b) % 2 ? p.floor : p.floorAlt;
      x.fillRect(a * 16, b * 16, 16, 16);
    }
    x.fillStyle = p.highlight; x.globalAlpha = 0.35;
    for (let i = 0; i < 48; i++) x.fillRect((i * 53) % 128, (i * 97) % 128, 2, 2);
    x.globalAlpha = 1;
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(40, 40); t.anisotropy = 4;
    if (farGround.material.map) farGround.material.map.dispose();
    farGround.material.map = t;
    farGround.material.needsUpdate = true;
  }

  let dungeon = null;
  let area = 0;
  let floorMesh = null;
  let wallMesh = null;
  let wallTopMesh = null;
  let propGroup = new THREE.Group();
  scene.add(propGroup);
  let chestMeshes = [];
  let statueMeshes = [];

  // ---- floor baking (canvas texture, per area) ----
  function bakeFloor() {
    const pal = AREAS[area];
    const cv = document.createElement('canvas');
    cv.width = WORLD_W; cv.height = WORLD_H;
    const ctx = cv.getContext('2d');
    const vrng = makeRng(0x51ab3f ^ (area * 7919 + 13));
    for (let ty = 0; ty < GRID_H; ty++) {
      for (let tx = 0; tx < GRID_W; tx++) {
        const px = tx * TILE, py = ty * TILE;
        if (isFloor(dungeon, tx, ty)) {
          ctx.fillStyle = (tx + ty) % 2 === 0 ? pal.floor : pal.floorAlt;
          ctx.fillRect(px, py, TILE, TILE);
          const h1 = tileHash(tx, ty), h2 = tileHash(ty, tx);
          ctx.fillStyle = pal.highlight;
          ctx.globalAlpha = 0.25;
          ctx.fillRect(px + 3 + h1 * 8, py + 4 + h2 * 7, 2, 2);
          ctx.fillRect(px + 9 + h2 * 4, py + 10 + h1 * 3, 2, 2);
          ctx.globalAlpha = 1;
        } else {
          ctx.fillStyle = (tx + ty) % 2 === 0 ? pal.outline : pal.wall;
          ctx.fillRect(px, py, TILE, TILE);
          const h1 = tileHash(tx, ty);
          ctx.fillStyle = pal.highlight;
          ctx.globalAlpha = 0.2;
          ctx.fillRect(px + 3 + h1 * 8, py + 4 + h1 * 7, 2, 2);
          ctx.globalAlpha = 1;
        }
      }
    }
    // Area features, seeded (same seed every bake -> same layout).
    if (area === 0) {
      for (let i = 0; i < 3; i++) {
        const room = vrng.pick(dungeon.rooms);
        const cx = (room.x + 1 + vrng.range(1, Math.max(1.1, room.w - 2))) * TILE;
        const cy = (room.y + 1 + vrng.range(1, Math.max(1.1, room.h - 2))) * TILE;
        ctx.fillStyle = pal.water;
        ctx.globalAlpha = 0.85;
        ctx.beginPath(); ctx.ellipse(cx, cy, 26, 16, 0, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      }
      for (let i = 0; i < 40; i++) {
        const room = vrng.pick(dungeon.rooms);
        ctx.fillStyle = pal.flower;
        ctx.fillRect(
          (room.x + vrng.range(0.5, room.w - 0.5)) * TILE,
          (room.y + vrng.range(0.5, room.h - 0.5)) * TILE, 3, 3);
      }
    } else if (area === 1) {
      for (let i = 0; i < 26; i++) {
        const room = vrng.pick(dungeon.rooms);
        ctx.fillStyle = vrng.chance(0.5) ? pal.machinery : pal.forge;
        ctx.globalAlpha = 0.8;
        ctx.fillRect(
          (room.x + vrng.range(0.5, room.w - 0.5)) * TILE,
          (room.y + vrng.range(0.5, room.h - 0.5)) * TILE, 4, 4);
        ctx.globalAlpha = 1;
      }
    } else {
      for (let i = 0; i < 34; i++) {
        const room = vrng.pick(dungeon.rooms);
        ctx.fillStyle = vrng.chance(0.55) ? pal.crystal : pal.fungus;
        ctx.globalAlpha = 0.85;
        ctx.fillRect(
          (room.x + vrng.range(0.5, room.w - 0.5)) * TILE,
          (room.y + vrng.range(0.5, room.h - 0.5)) * TILE, 3, 3);
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
        new THREE.PlaneGeometry(GRID_W, GRID_H),
        new THREE.MeshLambertMaterial({ map: tex }),
      );
      floorMesh.rotation.x = -Math.PI / 2;
      floorMesh.position.set(GRID_W / 2, 0, GRID_H / 2);
      scene.add(floorMesh);
    }
  }

  // ---- walls (instanced boxes, only tiles touching floor) ----
  function buildWalls() {
    const pal = AREAS[area];
    const spots = [];
    for (let ty = 0; ty < GRID_H; ty++) {
      for (let tx = 0; tx < GRID_W; tx++) {
        if (isFloor(dungeon, tx, ty)) continue;
        let near = false;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
          if (isFloor(dungeon, tx + dx, ty + dy)) { near = true; break; }
        }
        if (near) spots.push([tx + 0.5, ty + 0.5]);
      }
    }
    const box = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshLambertMaterial({ color: pal.wall });
    if (wallMesh) { scene.remove(wallMesh); wallMesh.dispose(); }
    if (wallTopMesh) { scene.remove(wallTopMesh); wallTopMesh.dispose(); }
    wallMesh = new THREE.InstancedMesh(box, mat, spots.length);
    const topBox = new THREE.BoxGeometry(1.04, 0.1, 1.04);
    const topMat = new THREE.MeshLambertMaterial({ color: pal.wallTop });
    wallTopMesh = new THREE.InstancedMesh(topBox, topMat, spots.length);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion(), pv = new THREE.Vector3(), sv = new THREE.Vector3();
    spots.forEach(([x, z], i) => {
      const h = 0.5 + tileHash((x * 7) | 0, (z * 7) | 0) * 0.55;
      m4.compose(pv.set(x, h / 2, z), q, sv.set(1, h, 1));
      wallMesh.setMatrixAt(i, m4);
      m4.compose(pv.set(x, h + 0.05, z), q, sv.set(1.04, 0.1, 1.04));
      wallTopMesh.setMatrixAt(i, m4);
    });
    wallMesh.instanceMatrix.needsUpdate = true;
    wallTopMesh.instanceMatrix.needsUpdate = true;
    scene.add(wallMesh, wallTopMesh);
  }

  // ---- props (visual only, rebuilt per area from a fixed seed) ----
  const PROP_KINDS = [
    ['flower', 'tuft', 'pond', 'mushroom', 'tree'],
    ['anvil', 'gear', 'furnace', 'crystal', 'rock'],
    ['crystal', 'obelisk', 'starflower', 'fungus', 'rock'],
  ];
  function buildProps() {
    scene.remove(propGroup);
    propGroup = new THREE.Group();
    scene.add(propGroup);
    const vrng = makeRng(0x51ab3f ^ (area * 7919 + 13));
    const kinds = PROP_KINDS[area];
    for (const room of dungeon.rooms) {
      const n = room.w * room.h >= 48 ? 6 : room.w * room.h >= 30 ? 4 : 3;
      for (let i = 0; i < n; i++) {
        const tx = room.x + 1 + vrng.int(0, Math.max(0, room.w - 3));
        const ty = room.y + 1 + vrng.int(0, Math.max(0, room.h - 3));
        const { group } = buildProp(area, vrng.pick(kinds));
        group.position.set(tx + 0.5, 0, ty + 0.5);
        group.rotation.y = vrng.range(0, Math.PI * 2);
        const s = vrng.range(0.85, 1.15);
        group.scale.setScalar(s);
        propGroup.add(group);
      }
    }
    for (let i = 0; i < 48; i++) {
      const ox = -16 + vrng.range(0, 80), oz = -12 + vrng.range(0, 60);
      if (ox > 0 && ox < GRID_W && oz > 0 && oz < GRID_H) continue;
      const { group } = buildProp(area, vrng.pick(kinds));
      group.position.set(ox + 0.5, 0, oz + 0.5);
      group.rotation.y = vrng.range(0, 6.28);
      group.scale.setScalar(vrng.range(1, 1.8));
      propGroup.add(group);
    }
  }

  function buildChestsAndStatues() {
    for (const c of chestMeshes) scene.remove(c.group);
    for (const s of statueMeshes) scene.remove(s.group);
    chestMeshes = dungeon.chests.map((c) => {
      const built = buildChest();
      built.group.position.set(toX(c.x), 0, toZ(c.y));
      scene.add(built.group);
      return { ...built, data: c };
    });
    statueMeshes = dungeon.statues.map((s) => {
      const built = buildStatue();
      built.group.position.set(toX(s.x), 0, toZ(s.y));
      scene.add(built.group);
      return { ...built, data: s };
    });
  }

  // ---- entity mesh pools ----
  const enemyMeshes = new Map(); // id -> {group, parts, type}
  const lootMeshes = new Map(); // id -> {group, parts, kind}
  const projPool = [];
  const particlePool = [];
  const damagePool = [];
  const telegraphPool = [];
  const aimPool = [];
  let neri = null; // { group, model, modelMat, mixer, actions, lantern, aura, moth, current, oneshot, prevCd, prevHurt, yawOffset }
  let neriLoading = null;
  let bossMesh = null;
  let slashMesh = null;
  let emberMeshes = new Map(); // patch id -> group
  const streakPool = [];

  async function loadNeri() {
    if (neri) return neri;
    if (neriLoading) return neriLoading;
    neriLoading = (async () => {
      try {
        const gltf = await new GLTFLoader().loadAsync('assets/neri.glb');
        const model = gltf.scene;
        const HIDDEN = new Set(['2H_Staff', '1H_Wand', 'Spellbook', 'Spellbook_open']);
        model.traverse((o) => { if (HIDDEN.has(o.name)) o.visible = false; });
        model.updateMatrixWorld(true);
        const bodyBox = new THREE.Box3();
        model.traverse((o) => {
          if (o.isMesh && o.name.startsWith('Mage_')) bodyBox.expandByObject(o);
        });
        if (bodyBox.isEmpty()) bodyBox.setFromObject(model);
        const size = new THREE.Vector3();
        bodyBox.getSize(size);
        const s = CAM.neriHeight / Math.max(0.01, size.y);
        model.scale.setScalar(s);
        model.updateMatrixWorld(true);
        const footBox = new THREE.Box3();
        model.traverse((o) => {
          if (o.isMesh && o.name.startsWith('Mage_')) footBox.expandByObject(o);
        });
        if (!footBox.isEmpty()) model.position.y = -footBox.min.y;
        const group = new THREE.Group();
        group.add(model);
        let hand = null;
        model.traverse((o) => { if (!hand && (o.name === 'handslotl' || o.name === 'handl')) hand = o; });
        if (!hand) model.traverse((o) => { if (!hand && (o.name === 'handslotr' || o.name === 'handr')) hand = o; });
        const lantern = buildLantern();
        if (hand) hand.add(lantern.group);
        else { lantern.group.position.set(-0.7, 1.4, 0.2); group.add(lantern.group); }
        const k = CAM.neriHeight / 2.6;
        const aura = buildAuraRing();
        aura.scale.setScalar(k);
        group.add(aura);
        const moth = buildMoth();
        moth.position.set(0.75 * k, 2.0 * k, 0.3 * k);
        moth.scale.setScalar(k);
        group.add(moth);
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
          cast: pick('Spellcast_Shoot', 'Spellcasting', 'Spellcast_Raise'),
          castLong: pick('Spellcast_Raise', 'Spellcast_Long'),
          hurt: pick('Hit_A', 'Hit_B'),
          death: pick('Death_A', 'Death_B'),
          cheer: pick('Cheer'),
        };
        const actions = {};
        for (const [k, clip] of Object.entries(defs)) if (clip) actions[k] = mixer.clipAction(clip);
        if (actions.idle) actions.idle.play();
        const built = {
          group, model, modelMat, mixer, actions, lantern, aura, moth,
          current: actions.idle || null, oneshot: null,
          prevCd: { crescent: 0, ember: 0, glassguard: 0, starfall: 0 },
          prevHurt: 0, yawOffset: 0,
        };
        mixer.addEventListener('finished', (e) => { if (built.oneshot === e.action) built.oneshot = null; });
        neri = built;
        return neri;
      } catch (err) {
        console.error('[mosslight] neri.glb failed to load', err);
        neriLoading = null;
        return null;
      }
    })();
    return neriLoading;
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

  // ---- public API ----
  function setDungeon(d) {
    dungeon = d;
    area = 0;
    bakeFloor();
    buildWalls();
    buildProps();
    buildChestsAndStatues();
    scene.background = new THREE.Color(AREAS[0].sky);
    bakeGround();
  }

  function setArea(a) {
    if (a === area) return;
    area = a;
    bakeFloor();
    buildWalls();
    buildProps();
    scene.background = new THREE.Color(AREAS[a].sky);
    bakeGround();
  }

  function pxPerUnit() {
    const h = renderer.domElement.height / renderer.getPixelRatio();
    return h / (2 * CAM.dist * Math.tan((CAM.fov * Math.PI) / 360));
  }

  function sync(sim, dt) {
    const p = sim.player;
    if (!neri && !neriLoading) loadNeri();
    if (neri) {
      const pg = neri.group;
      pg.visible = true;
      pg.position.set(toX(p.x), 0, toZ(p.y));
      pg.rotation.y = Math.PI / 2 - (p.faceAngle || 0) + neri.yawOffset;
      const a = neri.actions;
      const loop = p.moving ? 'walk' : 'idle';
      if (p.hurtT > 0 && neri.prevHurt <= 0 && a.hurt) neri.oneshot = a.hurt;
      neri.prevHurt = p.hurtT;
      for (const k of ['crescent', 'ember', 'glassguard', 'starfall']) {
        const cd = p.cooldowns[k] || 0;
        if (neri.prevCd[k] <= 0.05 && cd > 1) {
          neri.oneshot = (k === 'starfall' && a.castLong) ? a.castLong : a.cast;
        }
        neri.prevCd[k] = cd;
      }
      if (sim.done?.result === 'victory' && a.cheer && neri.current !== a.cheer) neri.oneshot = a.cheer;
      if (sim.done?.result === 'defeat' && a.death && neri.current !== a.death) neri.oneshot = a.death;
      const want = neri.oneshot || a[loop] || a.idle || null;
      if (want && neri.current !== want) {
        const prev = neri.current;
        want.reset();
        if (want === neri.oneshot) { want.setLoop(THREE.LoopOnce, 1); want.clampWhenFinished = true; }
        else { want.setLoop(THREE.LoopRepeat, Infinity); want.clampWhenFinished = false; }
        want.play();
        if (prev) prev.crossFadeTo(want, 0.15, false);
        else want.fadeIn(0.15);
        neri.current = want;
      }
      neri.mixer.update(Math.min(dt, 0.05));
      neri.lantern.parts.light.intensity = 24 + Math.sin(sim.time * 7) * 3;
      neri.moth.position.y = 2.0 + Math.sin(sim.time * 2.2) * 0.16;
      neri.moth.position.x = 0.75 + Math.sin(sim.time * 1.5) * 0.1;
      neri.aura.material.opacity = 0.24 + Math.sin(sim.time * 3) * 0.06;
      if (neri.modelMat && neri.modelMat.emissive) {
        neri.modelMat.emissive.setHex(p.hurtT > 0 ? 0x881111 : 0x000000);
      }
    }

    const seenEnemies = new Set();
    for (const e of sim.enemies) {
      seenEnemies.add(e.id);
      let em = enemyMeshes.get(e.id);
      if (!em) {
        em = e.type === 'puffcap' ? buildPuffcap() : e.type === 'tinket' ? buildTinket() : buildBrambler();
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
      g.position.set(toX(e.x), y, toZ(e.y));
      g.rotation.y = e.faceAngle || 0;
      if (e.type === 'tinket') em.parts.key.rotation.y += dt * (e.moving ? 9 : 1.5);
      if (e.flashT > 0) {
        const f = e.flashT > 0 ? 0.6 : 0;
        em.group.traverse((o) => { if (o.isMesh && o.material.emissive) o.material.emissive.setHex(0xffffff); });
        void f;
      } else {
        em.group.traverse((o) => { if (o.isMesh && o.material.emissive) o.material.emissive.setHex(0x000000); });
      }
    }
    for (const [id, em] of enemyMeshes) {
      if (!seenEnemies.has(id)) { scene.remove(em.group); enemyMeshes.delete(id); }
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
      if (b.flashT > 0) {
        bossMesh.parts.body.material.emissive.setHex(0x888888);
      } else {
        bossMesh.parts.body.material.emissive.setHex(0x0a3a3a);
      }
    } else if (bossMesh) {
      bossMesh.group.visible = false;
    }

    const seenLoot = new Set();
    for (const l of sim.loot) {
      seenLoot.add(l.id);
      let lm = lootMeshes.get(l.id);
      if (!lm) {
        lm = l.kind === 'coin' ? buildCoin() : l.kind === 'heart' || l.kind === 'bigheart' ? buildHeart() : buildShard();
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
      slashMesh.group.scale.setScalar(0.6 + k * 1.1);
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
        scene.add(slot.group);
        streakPool.push(slot);
      }
      slot.group.visible = true;
      slot.group.position.set(toX(st.x), st.h, toZ(st.y));
      si++;
    }

    // --- camera: follow Neri, tilted 55 deg, with deterministic shake ---
    let tx = toX(p.x);
    const tz = Math.max(4, Math.min(GRID_H - 4, toZ(p.y)));
    // The left clamp is relaxed in title state (the dark ground fills the
    if (sim.state === 'title') tx -= CAM.titleShiftX;
    tx = Math.max(sim.state === 'title' ? -6 : 6, Math.min(GRID_W - 6, tx));
    const tilt = (CAM.tiltDeg * Math.PI) / 180;
    const dy = Math.sin(tilt) * CAM.dist;
    const dz = Math.cos(tilt) * CAM.dist;
    let shX = 0, shZ = 0;
    if (sim.shakeT > 0) {
      const k = sim.shakeT / sim.shakeMax;
      shX = Math.sin(sim.time * 90) * sim.shakeAmp * k * PX;
      shZ = Math.cos(sim.time * 77) * sim.shakeAmp * k * PX;
    }
    camera.position.set(tx + shX, CAM.targetHeight + dy, tz + dz + shZ);
    camera.lookAt(tx + shX, CAM.targetHeight, tz - CAM.maxPitch + shZ);
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

  return { setDungeon, setArea, sync, render, resize, setPixelRatio, loadNeri, isNeriLoaded: () => !!neri, scene, camera, renderer };
}
