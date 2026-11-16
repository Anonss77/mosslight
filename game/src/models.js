// Mosslight v4 — 3D models. Neri herself is a real rigged GLB asset
// (assets/neri.glb — KayKit Mage, CC0, loaded by world.js); everything
// else here is built from Three.js primitives in code, no textures from
// files. Every builder returns a THREE.Group with named parts so world.js
// can animate it (hop squash, key spin, boss tilt, lantern flicker).
// Pure functions of type: variation (scale/rotation) is applied by the
// caller with the visual RNG.

import * as THREE from 'three';

// ---- material helpers ----
export const lam = (color, opts = {}) => new THREE.MeshLambertMaterial({ color, ...opts });
export const phong = (color, opts = {}) => new THREE.MeshPhongMaterial({ color, shininess: 60, ...opts });
export const basic = (color, opts = {}) => new THREE.MeshBasicMaterial({ color, ...opts });
export const gold = () => new THREE.MeshPhongMaterial({ color: 0xffd76a, shininess: 120, specular: 0xfff2c0 });

function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}

// Soft dark disc under an entity (cheap fake shadow; real shadow maps are
// off — too slow in the headless software renderer).
export function blobShadow(radius, opacity = 0.32) {
  const m = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 20),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity, depthWrite: false }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.02;
  return m;
}

// ---- Neri's lantern: a hand lantern that hangs from the GLB hand slot.
// Neri herself is a real rigged GLB (assets/neri.glb, KayKit Mage, CC0) —
// code primitives could never look like a person, so the hero is an asset
// and only her lantern, aura ring and moth companion are built in code.
export function makeGlowTexture() {
  const cv = document.createElement('canvas');
  cv.width = 128; cv.height = 128;
  const ctx = cv.getContext('2d');
  const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,220,120,0.7)');
  grad.addColorStop(1, 'rgba(255,180,40,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildLantern() {
  // Model-space units: the hand slot is the origin; the cage hangs below it.
  const g = new THREE.Group();
  const brass = lam(0x8a6a2a);
  const handle = mesh(new THREE.TorusGeometry(0.09, 0.02, 8, 14), brass, 0, 0, 0);
  g.add(handle);
  const cage = mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.2, 10, 1, true), brass, 0, -0.16, 0);
  g.add(cage);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    g.add(mesh(new THREE.BoxGeometry(0.02, 0.2, 0.02), brass, Math.cos(a) * 0.12, -0.16, Math.sin(a) * 0.12));
  }
  const flame = mesh(
    new THREE.SphereGeometry(0.08, 12, 10),
    new THREE.MeshBasicMaterial({ color: 0xffc94d }),
    0, -0.16, 0,
  );
  g.add(flame);
  g.add(mesh(new THREE.ConeGeometry(0.13, 0.09, 10), brass, 0, -0.02, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.13, 0.1, 0.04, 10), brass, 0, -0.28, 0));
  // Real point light inside the flame (the dungeon's warm light).
  const light = new THREE.PointLight(0xffb830, 26, 11, 1.6);
  light.position.set(0, -0.16, 0);
  g.add(light);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeGlowTexture(), color: 0xffb830, transparent: true, opacity: 0.55,
    depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  glow.scale.set(0.9, 0.9, 1);
  glow.position.set(0, -0.16, 0);
  g.add(glow);
  return { group: g, parts: { light, glow, flame } };
}

// Soft amber ring under Neri's feet (the "find her instantly" ring).
export function buildAuraRing() {
  const aura = new THREE.Mesh(
    new THREE.RingGeometry(0.55, 0.95, 28),
    new THREE.MeshBasicMaterial({ color: 0xffb830, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
  );
  aura.rotation.x = -Math.PI / 2;
  aura.position.y = 0.04;
  return aura;
}

// Moth companion: tiny pale body + two flat wings, floats beside Neri.
export function buildMoth() {
  const moth = new THREE.Group();
  moth.add(mesh(new THREE.SphereGeometry(0.09, 8, 6), lam(0x8a7ac8), 0, 0, 0));
  const wingL = mesh(new THREE.SphereGeometry(0.14, 8, 6), basic(0xf6f0ff, { transparent: true, opacity: 0.85 }), -0.14, 0.04, 0);
  wingL.scale.set(1, 0.25, 0.7);
  const wingR = wingL.clone();
  wingR.position.x = 0.14;
  moth.add(wingL, wingR);
  return moth;
}

// ---- Puffcap: pink mushroom with mint spots ----
export function buildPuffcap() {
  const g = new THREE.Group();
  const stem = mesh(new THREE.CylinderGeometry(0.24, 0.32, 0.55, 10), lam(0xfff3c4), 0, 0.28, 0);
  g.add(stem);
  const cap = mesh(new THREE.SphereGeometry(0.55, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), lam(0xff7fb0), 0, 0.5, 0);
  cap.scale.y = 0.75;
  g.add(cap);
  // Mint spots on the cap.
  for (const [x, y, z, r] of [[-0.25, 0.82, 0.25, 0.1], [0.28, 0.78, 0.18, 0.12], [0.05, 0.88, -0.3, 0.09]]) {
    g.add(mesh(new THREE.SphereGeometry(r, 8, 6), lam(0xa5e37a), x, y, z));
  }
  // Tiny feet + eyes.
  g.add(mesh(new THREE.SphereGeometry(0.09, 8, 6), lam(0x3a2a20), -0.16, 0.06, 0.28));
  g.add(mesh(new THREE.SphereGeometry(0.09, 8, 6), lam(0x3a2a20), 0.16, 0.06, 0.28));
  g.add(mesh(new THREE.SphereGeometry(0.06, 8, 6), lam(0x1a1a1a), -0.12, 0.42, 0.26));
  g.add(mesh(new THREE.SphereGeometry(0.06, 8, 6), lam(0x1a1a1a), 0.12, 0.42, 0.26));
  g.add(blobShadow(0.5));
  return { group: g, parts: { cap, stem } };
}

// ---- Tinket: brass wind-up beetle with a cyan key ----
export function buildTinket() {
  const g = new THREE.Group();
  const brass = phong(0xd89a4a, { shininess: 90 });
  const body = mesh(new THREE.SphereGeometry(0.42, 14, 10), brass, 0, 0.32, 0);
  body.scale.set(1, 0.62, 1.35);
  g.add(body);
  const head = mesh(new THREE.SphereGeometry(0.22, 10, 8), lam(0x6a4a2a), 0, 0.3, 0.55);
  g.add(head);
  // Wind-up key on the back (spins while it walks).
  const key = new THREE.Group();
  key.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 8), lam(0x35c9d0), 0, 0.12, 0));
  key.children[0].rotation.x = Math.PI / 2;
  const bar = mesh(new THREE.BoxGeometry(0.34, 0.08, 0.06), lam(0x35c9d0), 0, 0.12, 0.14);
  key.add(bar);
  key.position.set(0, 0.55, -0.35);
  g.add(key);
  // Six thin legs.
  for (const sx of [-1, 1]) {
    for (const [lz, la] of [[0.3, 0.5], [0, 0], [-0.3, -0.5]]) {
      const leg = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 6), lam(0x6a4a2a), sx * 0.42, 0.16, lz);
      leg.rotation.z = sx * 0.9;
      leg.rotation.x = la * 0.4;
      g.add(leg);
    }
  }
  g.add(mesh(new THREE.SphereGeometry(0.05, 8, 6), lam(0x1a1a1a), -0.09, 0.36, 0.72));
  g.add(mesh(new THREE.SphereGeometry(0.05, 8, 6), lam(0x1a1a1a), 0.09, 0.36, 0.72));
  g.add(blobShadow(0.45));
  return { group: g, parts: { body, key } };
}

// ---- Brambler: leafy stump with orange thorns ----
export function buildBrambler() {
  const g = new THREE.Group();
  const stump = mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.85, 10), lam(0x8a5a3a), 0, 0.43, 0);
  g.add(stump);
  const top = mesh(new THREE.CylinderGeometry(0.48, 0.44, 0.12, 10), lam(0x6a452c), 0, 0.9, 0);
  g.add(top);
  // Leafy crown.
  const leafM = lam(0x6fe08a);
  for (const [x, y, z, ry] of [[-0.3, 1.05, 0.1, 0.5], [0.3, 1.08, -0.05, -0.4], [0, 1.15, 0.25, 0.1], [0.05, 1.0, -0.3, 2.6]]) {
    const leaf = mesh(new THREE.ConeGeometry(0.22, 0.6, 6), leafM, x, y, z);
    leaf.rotation.z = ry;
    leaf.rotation.x = 0.3;
    g.add(leaf);
  }
  // Orange thorns on the sides.
  for (const [x, z, rz] of [[-0.48, 0.1, 1.1], [0.48, -0.1, -1.1], [-0.4, -0.35, 0.7]]) {
    const thorn = mesh(new THREE.ConeGeometry(0.09, 0.35, 6), lam(0xf59b42), x, 0.55, z);
    thorn.rotation.z = rz;
    g.add(thorn);
  }
  g.add(mesh(new THREE.SphereGeometry(0.06, 8, 6), lam(0x1a1a1a), -0.14, 0.6, 0.42));
  g.add(mesh(new THREE.SphereGeometry(0.06, 8, 6), lam(0x1a1a1a), 0.14, 0.6, 0.42));
  g.add(blobShadow(0.55));
  return { group: g, parts: { stump, top } };
}

// ---- The Gloam Bell: a BIG floating turquoise glass bell (4.6 units) ----
export function buildBoss() {
  const g = new THREE.Group();
  const glass = new THREE.MeshPhongMaterial({
    color: 0x5fe0dc, transparent: true, opacity: 0.88, shininess: 140, specular: 0xdfffff, emissive: 0x0a3a3a,
  });
  const body = mesh(new THREE.CylinderGeometry(0.55, 1.7, 3.1, 18), glass, 0, 1.9, 0);
  g.add(body);
  const dome = mesh(new THREE.SphereGeometry(0.55, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), glass, 0, 3.45, 0);
  g.add(dome);
  // Gold rim + crown + clapper.
  const rim = mesh(new THREE.TorusGeometry(1.7, 0.2, 10, 22), gold(), 0, 0.35, 0);
  rim.rotation.x = Math.PI / 2;
  g.add(rim);
  g.add(mesh(new THREE.CylinderGeometry(0.3, 0.4, 0.5, 10), gold(), 0, 4.15, 0));
  const clapper = mesh(new THREE.SphereGeometry(0.3, 10, 8), gold(), 0, 0.25, 0);
  g.add(clapper);
  // Tiny face inside the glass.
  g.add(mesh(new THREE.SphereGeometry(0.11, 8, 6), lam(0x1a2a2a), -0.35, 2.1, 1.55));
  g.add(mesh(new THREE.SphereGeometry(0.11, 8, 6), lam(0x1a2a2a), 0.35, 2.1, 1.55));
  const mouth = mesh(new THREE.BoxGeometry(0.3, 0.06, 0.05), lam(0x1a2a2a), 0, 1.75, 1.6);
  g.add(mouth);
  // Bright rim light: a soft cyan glow disc under the bell.
  const glow = new THREE.Mesh(
    new THREE.CircleGeometry(2.0, 24),
    new THREE.MeshBasicMaterial({ color: 0x76dde0, transparent: true, opacity: 0.18, depthWrite: false }),
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.03;
  g.add(glow);
  return { group: g, parts: { body, dome, rim, clapper, glow } };
}

// ---- Items (real game items, readable at a glance) ----
// Gold coin: a spinning disc with a bright inner face.
export function buildCoin() {
  const g = new THREE.Group();
  const disc = mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.09, 18), gold(), 0, 0, 0);
  g.add(disc);
  const face = mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.1, 18), phong(0xffe89a, { shininess: 160 }), 0, 0, 0);
  g.add(face);
  return { group: g, parts: { disc } };
}

// Red heart: extruded heart shape + white shine bead.
export function buildHeart() {
  const s = new THREE.Shape();
  s.moveTo(0, 0.32);
  s.bezierCurveTo(0, 0.55, -0.45, 0.55, -0.45, 0.22);
  s.bezierCurveTo(-0.45, -0.08, 0, -0.22, 0, -0.45);
  s.bezierCurveTo(0, -0.22, 0.45, -0.08, 0.45, 0.22);
  s.bezierCurveTo(0.45, 0.55, 0, 0.55, 0, 0.32);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.22, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 2 });
  const g = new THREE.Group();
  const heart = new THREE.Mesh(geo, phong(0xff4f6a, { shininess: 80 }));
  heart.rotation.x = -0.5;
  g.add(heart);
  g.add(mesh(new THREE.SphereGeometry(0.09, 8, 6), basic(0xffffff), -0.2, 0.28, 0.18));
  return { group: g, parts: { heart } };
}

// Blue shard: a faceted, elongated octahedron.
export function buildShard() {
  const g = new THREE.Group();
  const shard = mesh(new THREE.OctahedronGeometry(0.4, 0), phong(0x5fa8ff, { shininess: 140, flatShading: true, emissive: 0x0a2a5a }), 0, 0.45, 0);
  shard.scale.set(1, 1.7, 1);
  g.add(shard);
  return { group: g, parts: { shard } };
}

// Wooden chest with gold bands and a lock.
export function buildChest() {
  const g = new THREE.Group();
  const wood = lam(0x8a5a3a);
  const woodDark = lam(0x6a452c);
  g.add(mesh(new THREE.BoxGeometry(0.95, 0.55, 0.6), wood, 0, 0.28, 0));
  const lid = mesh(new THREE.BoxGeometry(0.95, 0.28, 0.6), woodDark, 0, 0.68, 0);
  g.add(lid);
  for (const x of [-0.32, 0.32]) {
    g.add(mesh(new THREE.BoxGeometry(0.1, 0.85, 0.64), gold(), x, 0.42, 0));
  }
  g.add(mesh(new THREE.BoxGeometry(0.2, 0.22, 0.08), gold(), 0, 0.45, 0.32));
  return { group: g, parts: { lid } };
}

// Buff statue: pale obelisk with a glowing rune ring.
export function buildStatue() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(0.55, 1.5, 0.55), lam(0xb0a5d8), 0, 0.75, 0));
  const tip = mesh(new THREE.ConeGeometry(0.42, 0.5, 4), lam(0xd8ccf5), 0, 1.75, 0);
  tip.rotation.y = Math.PI / 4;
  g.add(tip);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.5, 0.75, 24),
    new THREE.MeshBasicMaterial({ color: 0x76dde0, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.05;
  g.add(ring);
  return { group: g, parts: { ring } };
}

// ---- Area props (visual only, no collision) ----
export function buildProp(area, kind) {
  const g = new THREE.Group();
  if (kind === 'flower') {
    g.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.5, 6), lam(0x3a7a3a), 0, 0.25, 0));
    const petal = lam(area === 0 ? 0xff7099 : area === 1 ? 0xff6b7a : 0xf6f0ff);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      g.add(mesh(new THREE.SphereGeometry(0.12, 8, 6), petal, Math.cos(a) * 0.16, 0.52, Math.sin(a) * 0.16));
    }
    g.add(mesh(new THREE.SphereGeometry(0.1, 8, 6), lam(0xffd76a), 0, 0.54, 0));
  } else if (kind === 'tuft') {
    for (const [x, z, h] of [[-0.12, 0, 0.5], [0.1, 0.08, 0.62], [0, -0.12, 0.45]]) {
      const blade = mesh(new THREE.ConeGeometry(0.09, h, 5), lam(area === 2 ? 0xa7e760 : 0x5da85a), x, h / 2, z);
      g.add(blade);
    }
  } else if (kind === 'pond') {
    const disc = mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.08, 18), phong(0x45c8b2, { shininess: 120, transparent: true, opacity: 0.85 }), 0, 0.04, 0);
    g.add(disc);
  } else if (kind === 'mushroom') {
    g.add(mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.3, 8), lam(0xfff3c4), 0, 0.15, 0));
    const cap = mesh(new THREE.SphereGeometry(0.3, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), lam(0xff7fb0), 0, 0.3, 0);
    cap.scale.y = 0.7;
    g.add(cap);
  } else if (kind === 'anvil') {
    g.add(mesh(new THREE.BoxGeometry(0.7, 0.35, 0.4), lam(0x3a3a44), 0, 0.55, 0));
    g.add(mesh(new THREE.BoxGeometry(0.95, 0.22, 0.42), lam(0x55555f), 0, 0.82, 0));
    g.add(mesh(new THREE.BoxGeometry(0.5, 0.4, 0.35), lam(0x2a2a32), 0, 0.2, 0));
  } else if (kind === 'gear') {
    const gear = mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.14, 12), phong(0xd89a4a, { shininess: 100 }), 0, 0.1, 0);
    g.add(gear);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      g.add(mesh(new THREE.BoxGeometry(0.16, 0.14, 0.16), phong(0xd89a4a), Math.cos(a) * 0.45, 0.1, Math.sin(a) * 0.45));
    }
    g.add(mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.18, 10), lam(0x35c9d0), 0, 0.12, 0));
  } else if (kind === 'furnace') {
    g.add(mesh(new THREE.BoxGeometry(0.9, 1.0, 0.7), lam(0x6a3a3a), 0, 0.5, 0));
    g.add(mesh(new THREE.BoxGeometry(0.5, 0.45, 0.06), basic(0xff8a2a), 0, 0.4, 0.36));
    g.add(mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.5, 8), lam(0x3a3a44), 0, 1.2, 0));
  } else if (kind === 'crystal') {
    const c = area === 1 ? 0x35c9d0 : 0xc9bbf5;
    for (const [x, z, s, ry] of [[0, 0, 1, 0], [-0.35, 0.2, 0.6, 0.7], [0.3, -0.15, 0.75, 1.9]]) {
      const shard = mesh(new THREE.OctahedronGeometry(0.4 * s, 0), phong(c, { flatShading: true, shininess: 140, emissive: 0x112244 }), x, 0.45 * s, z);
      shard.scale.y = 1.8;
      shard.rotation.y = ry;
      g.add(shard);
    }
  } else if (kind === 'obelisk') {
    g.add(mesh(new THREE.BoxGeometry(0.5, 1.7, 0.5), lam(0x8a7ac8), 0, 0.85, 0));
    const tip = mesh(new THREE.ConeGeometry(0.38, 0.45, 4), lam(0xc9bbf5), 0, 1.9, 0);
    tip.rotation.y = Math.PI / 4;
    g.add(tip);
  } else if (kind === 'starflower') {
    g.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.55, 6), lam(0x7a9a5a), 0, 0.28, 0));
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const petal = mesh(new THREE.ConeGeometry(0.09, 0.3, 4), basic(0xf6f0ff), Math.cos(a) * 0.14, 0.58, Math.sin(a) * 0.14);
      petal.rotation.z = Math.cos(a) * 0.9;
      g.add(petal);
    }
    g.add(mesh(new THREE.SphereGeometry(0.09, 8, 6), basic(0xffd76a), 0, 0.6, 0));
  } else if (kind === 'fungus') {
    const cap = mesh(new THREE.SphereGeometry(0.3, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), phong(0xa7e760, { emissive: 0x2a4a0a }), 0, 0.28, 0);
    cap.scale.y = 0.7;
    g.add(cap);
    g.add(mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.28, 8), lam(0xd8e8c8), 0, 0.14, 0));
  }
  return { group: g, parts: {} };
}

// ---- Effect meshes ----
// Big white crescent slash with an orange glow (Crescent Cut).
export function buildSlash() {
  const g = new THREE.Group();
  const arc = new THREE.Mesh(
    new THREE.TorusGeometry(0.9, 0.16, 10, 24, Math.PI * 1.1),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95 }),
  );
  arc.rotation.x = -Math.PI / 2;
  arc.rotation.z = Math.PI * 0.45;
  g.add(arc);
  const glow = new THREE.Mesh(
    new THREE.TorusGeometry(0.9, 0.3, 10, 24, Math.PI * 1.1),
    new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: 0.45 }),
  );
  glow.rotation.x = -Math.PI / 2;
  glow.rotation.z = Math.PI * 0.45;
  g.add(glow);
  return { group: g, parts: { arc, glow } };
}

// Ember fire patch: flat glow disc + flame tongues.
export function buildEmberPatch() {
  const g = new THREE.Group();
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(1, 24),
    new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0.5, depthWrite: false }),
  );
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 0.05;
  g.add(disc);
  const tongues = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const flame = mesh(
      new THREE.ConeGeometry(0.22, 0.8, 6),
      new THREE.MeshBasicMaterial({ color: i % 2 ? 0xffc94d : 0xff8a2a, transparent: true, opacity: 0.9 }),
      Math.cos(a) * 0.6, 0.4, Math.sin(a) * 0.6,
    );
    g.add(flame);
    tongues.push(flame);
  }
  return { group: g, parts: { disc, tongues } };
}

// Starfall streak: a falling gold rod.
export function buildStreak() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.6, 6), basic(0xffd76a), 0, 0, 0));
  g.add(mesh(new THREE.SphereGeometry(0.14, 8, 6), basic(0xfff2c0), 0, -0.8, 0));
  return { group: g, parts: {} };
}

// Flat floor telegraph ring (boss ring, brambler slam, echo markers).
export function buildTelegraphRing(color, radius) {
  const m = new THREE.Mesh(
    new THREE.RingGeometry(radius * 0.82, radius, 40),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.06;
  const fill = new THREE.Mesh(
    new THREE.CircleGeometry(radius * 0.82, 40),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.18, depthWrite: false }),
  );
  fill.rotation.x = -Math.PI / 2;
  fill.position.y = 0.05;
  const g = new THREE.Group();
  g.add(fill, m);
  return { group: g, parts: { ring: m, fill } };
}

// Thin aim line (tinket telegraph): a long flat cyan bar.
export function buildAimLine() {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 0.14),
    new THREE.MeshBasicMaterial({ color: 0x35c9d0, transparent: true, opacity: 0.6, depthWrite: false }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.07;
  return { group: m, parts: {} };
}
