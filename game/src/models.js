
import * as THREE from 'three';

export const lam = (color, opts = {}) => new THREE.MeshLambertMaterial({ color, ...opts });
export const phong = (color, opts = {}) => new THREE.MeshPhongMaterial({ color, shininess: 60, ...opts });
export const basic = (color, opts = {}) => new THREE.MeshBasicMaterial({ color, ...opts });
export const gold = () => new THREE.MeshPhongMaterial({ color: 0xffd76a, shininess: 120, specular: 0xfff2c0 });

function mesh(geo, mat, x = 0, y = 0, z = 0) {
 const m = new THREE.Mesh(geo, mat);
 m.position.set(x, y, z);
 return m;
}

const pick = (arr, v) => arr[v % arr.length];

function topEyes(g, x, y, z, r) {
 const w = lam(0xffffff), d = lam(0x1a1a1a);
 for (const s of [-1, 1]) {
  g.add(mesh(new THREE.SphereGeometry(r, 8, 6), w, s * x, y, z));
  g.add(mesh(new THREE.SphereGeometry(r / 2, 6, 5), d, s * x, y + r * 0.4, z + r * 0.4));
 }
}

export function blobShadow(radius, opacity = 0.32) {
 const m = new THREE.Mesh(
  new THREE.CircleGeometry(radius, 20),
  new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity, depthWrite: false }),
 );
 m.rotation.x = -Math.PI / 2;
 m.position.y = 0.02;
 return m;
}

export function enemyRing(r) {
 const m = new THREE.Mesh(
  new THREE.RingGeometry(r * 0.8, r, 24),
  new THREE.MeshBasicMaterial({ color: 0xff2a2a, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }),
 );
 m.rotation.x = -Math.PI / 2;
 m.position.y = 0.04;
 return m;
}

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

export function buildAuraRing() {
 const aura = new THREE.Mesh(
  new THREE.RingGeometry(0.55, 0.95, 28),
  new THREE.MeshBasicMaterial({ color: 0xffb830, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
 );
 aura.rotation.x = -Math.PI / 2;
 aura.position.y = 0.04;
 return aura;
}

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

export function buildPuffcap(v = 0) {
 const g = new THREE.Group();
 const stem = mesh(new THREE.CylinderGeometry(0.24, 0.32, 0.55, 10), lam(0xfff3c4), 0, 0.28, 0);
 g.add(stem);
 const cap = mesh(new THREE.SphereGeometry(0.55, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), lam(pick([0xff7fb0, 0xff6fa0, 0xff8fc0], v)), 0, 0.5, 0);
 cap.scale.y = 0.75;
 g.add(cap);

 for (const [x, y, z, r] of [[-0.3, 0.85, -0.15, 0.1], [0.32, 0.75, -0.05, 0.12], [0.05, 0.88, -0.3, 0.09]]) {
  g.add(mesh(new THREE.SphereGeometry(r, 8, 6), lam(0xa5e37a), x, y, z));
 }
 g.add(mesh(new THREE.SphereGeometry(0.09, 8, 6), lam(0x3a2a20), -0.16, 0.06, 0.28));
 g.add(mesh(new THREE.SphereGeometry(0.09, 8, 6), lam(0x3a2a20), 0.16, 0.06, 0.28));
 topEyes(g, 0.16, 0.87, 0.18, 0.13);
 const pup = lam(0x1a1a1a);
 const smile = mesh(new THREE.BoxGeometry(0.16, 0.035, 0.04), pup, 0, 0.85, 0.3);
 smile.rotation.x = -0.55;
 g.add(smile);
 g.add(blobShadow(0.5));
 g.add(enemyRing(0.66));
 return { group: g, parts: { cap, stem } };
}

export function buildTinket(v = 0) {
 const g = new THREE.Group();
 const brass = phong(pick([0xd89a4a, 0xc08a3a, 0xe8aa5a], v), { shininess: 90 });
 const body = mesh(new THREE.SphereGeometry(0.42, 14, 10), brass, 0, 0.32, 0);
 body.scale.set(1, 0.62, 1.35);
 g.add(body);
 const head = mesh(new THREE.SphereGeometry(0.26, 10, 8), lam(0x6a4a2a), 0, 0.3, 0.55);
 g.add(head);
 const key = new THREE.Group();
 key.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 8), lam(0x35c9d0), 0, 0.12, 0));
 key.children[0].rotation.x = Math.PI / 2;
 const bar = mesh(new THREE.BoxGeometry(0.34, 0.08, 0.06), lam(0x35c9d0), 0, 0.12, 0.14);
 key.add(bar);
 key.position.set(0, 0.55, -0.35);
 g.add(key);
 for (const sx of [-1, 1]) {
  for (const [lz, la] of [[0.3, 0.5], [0, 0], [-0.3, -0.5]]) {
   const leg = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 6), lam(0x6a4a2a), sx * 0.42, 0.16, lz);
   leg.rotation.z = sx * 0.9;
   leg.rotation.x = la * 0.4;
   g.add(leg);
  }
 }
 topEyes(g, 0.11, 0.53, 0.6, 0.13);
 for (const sx of [-1, 1]) {
  const an = mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.36, 5), lam(0x6a4a2a), sx * 0.14, 0.56, 0.74);
  an.rotation.x = -0.7; an.rotation.z = -sx * 0.3;
  g.add(an);
  g.add(mesh(new THREE.SphereGeometry(0.05, 6, 5), lam(0x35c9d0), sx * 0.22, 0.68, 0.84));
 }
 g.add(blobShadow(0.45));
 g.add(enemyRing(0.62));
 return { group: g, parts: { body, key } };
}

export function buildBrambler(v = 0) {
 const g = new THREE.Group();
 const stump = mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.85, 10), lam(pick([0x8a5a3a, 0x7a4a30, 0x9a6a44], v)), 0, 0.43, 0);
 g.add(stump);
 const top = mesh(new THREE.CylinderGeometry(0.48, 0.44, 0.12, 10), lam(0x6a452c), 0, 0.9, 0);
 g.add(top);
 const leafM = lam(0x6fe08a);
 for (const [x, y, z, ry] of [[-0.3, 1.05, 0.1, 0.5], [0.3, 1.08, -0.05, -0.4], [0, 1.15, 0.25, 0.1], [0.05, 1.0, -0.3, 2.6]]) {
  const leaf = mesh(new THREE.ConeGeometry(0.22, 0.6, 6), leafM, x, y, z);
  leaf.rotation.z = ry;
  leaf.rotation.x = 0.3;
  g.add(leaf);
 }
 for (const [x, z, rz] of [[-0.48, 0.1, 1.1], [0.48, -0.1, -1.1], [-0.4, -0.35, 0.7], [0.42, 0.32, -0.8], [-0.1, 0.48, 1.9]]) {
  const thorn = mesh(new THREE.ConeGeometry(0.09, 0.35, 6), lam(0xf59b42), x, 0.55, z);
  thorn.rotation.z = rz;
  g.add(thorn);
 }
 topEyes(g, 0.16, 0.95, 0.3, 0.11);
 const pup = lam(0x1a1a1a);
 for (const sx of [-1, 1]) {
  const brow = mesh(new THREE.BoxGeometry(0.2, 0.045, 0.04), pup, sx * 0.15, 0.8, 0.44);
  brow.rotation.z = -sx * 0.45;
  g.add(brow);
 }
 g.add(mesh(new THREE.BoxGeometry(0.14, 0.035, 0.04), pup, 0, 0.97, 0.36));
 g.add(blobShadow(0.55));
 g.add(enemyRing(0.66));
 return { group: g, parts: { stump, top } };
}

export function buildWisp() {
 const g = new THREE.Group();
 const orb = mesh(new THREE.SphereGeometry(0.34, 12, 10), basic(0x7fe8ff, { transparent: true, opacity: 0.9 }), 0, 0.75, 0);
 g.add(orb);
 g.add(mesh(new THREE.SphereGeometry(0.16, 8, 6), basic(0xffffff), 0, 0.75, 0));
 for (const sx of [-1, 1]) {
  const wing = mesh(new THREE.SphereGeometry(0.22, 8, 6), basic(0xb9f0f2, { transparent: true, opacity: 0.7 }), sx * 0.4, 0.8, 0);
  wing.scale.set(1, 0.25, 0.7);
  g.add(wing);
 }
 topEyes(g, 0.12, 1.02, 0.14, 0.09);
 g.add(blobShadow(0.35));
 g.add(enemyRing(0.5));
 return { group: g, parts: { orb } };
}

export function buildBulwark() {
 const g = new THREE.Group();
 const slab = mesh(new THREE.BoxGeometry(0.95, 1.1, 0.7), lam(0x8a8a96), 0, 0.55, 0);
 g.add(slab);
 g.add(mesh(new THREE.BoxGeometry(1.0, 0.18, 0.75), lam(0x6fe08a), 0, 1.18, 0));
 g.add(mesh(new THREE.BoxGeometry(0.5, 0.3, 0.72), lam(0x6a6a76), 0, 0.15, 0));
 for (const [x, z, rz] of [[-0.5, 0.1, 1.0], [0.5, -0.1, -1.0], [0, 0.36, 0]]) {
  const spike = mesh(new THREE.ConeGeometry(0.09, 0.4, 6), lam(0xf59b42), x, 0.85, z);
  spike.rotation.z = rz;
  g.add(spike);
 }
 topEyes(g, 0.18, 1.3, 0.2, 0.1);
 g.add(blobShadow(0.6));
 g.add(enemyRing(0.9));
 return { group: g, parts: { slab } };
}

export function buildBoss() {
 const g = new THREE.Group();
 const glass = new THREE.MeshPhongMaterial({
  color: 0x5fe0dc, transparent: true, opacity: 0.88, shininess: 140, specular: 0xdfffff, emissive: 0x0a3a3a,
 });
 const body = mesh(new THREE.CylinderGeometry(0.55, 1.7, 3.1, 18), glass, 0, 1.9, 0);
 g.add(body);
 const dome = mesh(new THREE.SphereGeometry(0.55, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), glass, 0, 3.45, 0);
 g.add(dome);
 const rim = mesh(new THREE.TorusGeometry(1.7, 0.2, 10, 22), gold(), 0, 0.35, 0);
 rim.rotation.x = Math.PI / 2;
 g.add(rim);
 g.add(mesh(new THREE.CylinderGeometry(0.3, 0.4, 0.5, 10), gold(), 0, 4.15, 0));
 const clapper = mesh(new THREE.SphereGeometry(0.3, 10, 8), gold(), 0, 0.25, 0);
 g.add(clapper);
 const eyeW = lam(0xffffff), pup = basic(0x76dde0);
 for (const sx of [-1, 1]) {
  g.add(mesh(new THREE.SphereGeometry(0.2, 10, 8), eyeW, sx * 0.38, 2.15, 0.95));
  g.add(mesh(new THREE.SphereGeometry(0.1, 8, 6), pup, sx * 0.38, 2.15, 1.12));
 }
 const mouth = mesh(new THREE.BoxGeometry(0.5, 0.08, 0.05), lam(0x1a2a2a), 0, 1.7, 1.2);
 g.add(mouth);
 const band = mesh(new THREE.TorusGeometry(1.02, 0.08, 8, 22), gold(), 0, 2.0, 0);
 band.rotation.x = Math.PI / 2;
 g.add(band);
 const glow = new THREE.Mesh(
  new THREE.CircleGeometry(2.0, 24),
  new THREE.MeshBasicMaterial({ color: 0x76dde0, transparent: true, opacity: 0.18, depthWrite: false }),
 );
 glow.rotation.x = -Math.PI / 2;
 glow.position.y = 0.03;
 g.add(glow);
 const ring = enemyRing(2.3);
 ring.position.y = 0.06;
 g.add(ring);
 return { group: g, parts: { body, dome, rim, clapper, glow } };
}

export function buildCoin() {
 const g = new THREE.Group();
 const disc = mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.09, 18), gold(), 0, 0, 0);
 g.add(disc);
 const face = mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.1, 18), phong(0xffe89a, { shininess: 160 }), 0, 0, 0);
 g.add(face);
 return { group: g, parts: { disc } };
}

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

export function buildShard() {
 const g = new THREE.Group();
 const shard = mesh(new THREE.OctahedronGeometry(0.4, 0), phong(0x5fa8ff, { shininess: 140, flatShading: true, emissive: 0x0a2a5a }), 0, 0.45, 0);
 shard.scale.set(1, 1.7, 1);
 g.add(shard);
 return { group: g, parts: { shard } };
}

export function buildStarchip() {
 const g = new THREE.Group();
 const star = mesh(new THREE.OctahedronGeometry(0.42, 0), phong(0xffd76a, { shininess: 160, flatShading: true, emissive: 0x4a3200 }), 0, 0.5, 0);
 star.scale.set(1, 1.7, 1);
 g.add(star);
 return { group: g, parts: { star } };
}

export function buildMagnet() {
 const g = new THREE.Group();
 const horse = mesh(new THREE.TorusGeometry(0.3, 0.11, 8, 14, Math.PI), lam(0xe94f62), 0, 0.35, 0);
 g.add(horse);
 for (const sx of [-1, 1]) g.add(mesh(new THREE.BoxGeometry(0.2, 0.28, 0.2), lam(0xd8d8e8), sx * 0.3, 0.35, 0));
 return { group: g, parts: { horse } };
}

export function buildBomb() {
 const g = new THREE.Group();
 g.add(mesh(new THREE.SphereGeometry(0.34, 12, 10), lam(0x2a2a32), 0, 0.34, 0));
 const fuse = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 6), lam(0x8a6a2a), 0.1, 0.75, 0);
 fuse.rotation.z = -0.5;
 g.add(fuse);
 g.add(mesh(new THREE.SphereGeometry(0.09, 8, 6), basic(0xffd76a), 0.24, 0.88, 0));
 return { group: g, parts: {} };
}

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

export function buildTorch() {
 const g = new THREE.Group();
 g.add(mesh(new THREE.CylinderGeometry(0.07, 0.1, 1.7, 8), lam(0x6a452c), 0, 0.85, 0));
 g.add(mesh(new THREE.CylinderGeometry(0.16, 0.1, 0.22, 8), lam(0x8a6a2a), 0, 1.75, 0));
 const flame = mesh(new THREE.ConeGeometry(0.16, 0.5, 8), basic(0xffb830), 0, 2.05, 0);
 g.add(flame);
 return { group: g, parts: { flame } };
}

export function buildProp(area, kind) {
 const g = new THREE.Group();
 if (kind === 'mushroom') {
  g.add(mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.3, 8), lam(0xfff3c4), 0, 0.15, 0));
  const cap = mesh(new THREE.SphereGeometry(0.3, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), lam(0xff7fb0), 0, 0.3, 0);
  cap.scale.y = 0.7;
  g.add(cap);
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
 }
 return { group: g, parts: {} };
}

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

export function buildAimLine() {
 const m = new THREE.Mesh(
  new THREE.PlaneGeometry(1, 0.14),
  new THREE.MeshBasicMaterial({ color: 0x35c9d0, transparent: true, opacity: 0.6, depthWrite: false }),
 );
 m.rotation.x = -Math.PI / 2;
 m.position.y = 0.07;
 return { group: m, parts: {} };
}
