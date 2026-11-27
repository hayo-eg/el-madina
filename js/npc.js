import * as THREE from 'three';
import { CFG, blockCoord } from './config.js';

const R = 23;   // sidewalk ring offset from block centre
const pick = a => a[Math.floor(Math.random() * a.length)];
const rnd = (a, b) => a + Math.random() * (b - a);
const MC = {}, GC = {};
const mat = c => (MC[c] || (MC[c] = new THREE.MeshLambertMaterial({ color: c })));
const smat = c => (MC['s' + c] || (MC['s' + c] = new THREE.MeshStandardMaterial({ color: c, roughness: 0.62, metalness: 0 })));
const fmat = c => (MC['f' + c] || (MC['f' + c] = new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, metalness: 0 })));
function geo(key, fn) { return GC[key] || (GC[key] = fn()); }
const cyl = (rt, rb, h, seg = 8, oy = 0) => { const g = new THREE.CylinderGeometry(rt, rb, h, seg); g.translate(0, oy, 0); return g; };

const SKINS = ['#f1c7a1', '#e0ac7e', '#c68b5c', '#a26a45', '#7a4b30'];
const TOPS = ['#ff8fb8', '#5fd6d0', '#f7f1de', '#ffd36b', '#8be0a0', '#ff6f91', '#7dd3fc', '#c0392b', '#2e6fb5', '#2f8f5b', '#e0a030', '#f2f2ee', '#34495e', '#8e5ba6', '#d9d4c7', '#e67e22', '#1f2a3a', '#7f8c8d', '#b84a62'];
const BOTTOMS = ['#26314a', '#3d3a36', '#5a4632', '#1f2a3a', '#4a4f57', '#6b5b45', '#2b3a2f'];
const HAIRS = ['#15110e', '#2a1d14', '#4a3626', '#6b4a2b', '#8c8c8c'];
const ROBES = ['#f0ece0', '#cfc6b0', '#7d8a9a', '#3b4658', '#8a6b4a'];
const HIJABS = ['#1a1a1a', '#7b2d4f', '#2d5a6b', '#d9d3c4', '#4a3a6b', '#2f5d3a'];
const SHOES = ['#111111', '#3b2a1c', '#e8e8e8', '#27303d'];

export function makePerson(opts) {
  opts = opts || {};
  const female = opts.female !== undefined ? opts.female : Math.random() < 0.45;
  const kind = opts.kind ? opts.kind : female ? (Math.random() < 0.55 ? 'abaya' : (Math.random() < 0.5 ? 'dress' : 'casual')) : (Math.random() < 0.2 ? 'galabeya' : 'casual');
  const hijab = female && Math.random() < 0.7 && !opts.kind;
  const long = kind === 'galabeya' || kind === 'abaya' || kind === 'dress';
  const skin = smat(pick(SKINS));
  const top = fmat(kind === 'galabeya' ? pick(ROBES) : kind === 'abaya' ? pick(['#1a1a1a', '#26303d', '#3b2f3f']) : pick(TOPS));
  const bottom = fmat(pick(BOTTOMS));
  const shoe = mat(pick(SHOES));
  const longSleeves = long || Math.random() < 0.35;
  const sc = rnd(0.93, 1.07) * (female ? 0.95 : 1.0);
  const wide = rnd(0.92, 1.12);

  const root = new THREE.Group();
  const body = new THREE.Group();              // scaled body group
  body.scale.set(sc * wide, sc, sc * wide);
  root.add(body);
  const add = (g, m, x, y, z, parent = body, shadow = false) => { const me = new THREE.Mesh(g, m); me.position.set(x, y, z); me.castShadow = shadow; parent.add(me); return me; };

  // torso: tapered, slightly flattened front-to-back
  const torsoH = long ? 0.62 : 0.56;
  const tor = add(geo('torso', () => cyl(0.2, 0.165, 0.56, 16, 0)), top, 0, 1.3, 0, body, true);
  tor.scale.z = 0.62;
  if (female) tor.scale.x = 0.9;
  const hips = add(geo('hips', () => cyl(0.17, 0.18, 0.2, 16, 0)), long ? top : bottom, 0, 0.97, 0, body, true);
  hips.scale.z = 0.66;
  if (long) {
    const robe = add(geo('robe', () => cyl(0.18, 0.29, 0.86, 18, 0)), top, 0, 0.62, 0, body, true);
    robe.scale.z = 0.8;
    robe.userData.robe = true;
  }
  if (!long) add(geo('belt', () => cyl(0.176, 0.176, 0.035, 16, 0)), mat('#2a2018'), 0, 1.04, 0, body);
  add(geo('collar', () => new THREE.TorusGeometry(0.058, 0.014, 6, 14)), top, 0, 1.585, 0.0, body).rotation.x = Math.PI / 2;
  add(geo('neck', () => cyl(0.052, 0.06, 0.1, 12)), skin, 0, 1.6, 0);
  // head
  const head = new THREE.Group(); head.position.set(0, 1.72, 0); body.add(head);
  const face = add(geo('head', () => { const g = new THREE.SphereGeometry(0.112, 24, 18); g.scale(0.92, 1.12, 1.0); return g; }), skin, 0, 0, 0, head, true);
  add(geo('nose', () => { const g = new THREE.ConeGeometry(0.02, 0.05, 6); g.rotateX(Math.PI / 2 * 0.0); g.rotateX(0.35); return g; }), skin, 0, -0.012, 0.114, head);
  add(geo('nosetip', () => new THREE.SphereGeometry(0.017, 8, 6)), skin, 0, -0.03, 0.123, head);
  for (const sx of [-1, 1]) {
    const eye = add(geo('eyew', () => { const g = new THREE.SphereGeometry(0.0185, 10, 8); g.scale(1.25, 0.8, 0.5); return g; }), mat('#f4f1ea'), sx * 0.043, 0.024, 0.101, head);
    add(geo('iris', () => new THREE.CircleGeometry(0.0095, 10)), mat('#2a1a10'), sx * 0.043, 0.024, 0.1085, head);
    const brow = add(geo('brow', () => new THREE.BoxGeometry(0.05, 0.009, 0.012)), mat('#1c140f'), sx * 0.045, 0.057, 0.103, head);
    brow.rotation.z = -sx * 0.12;
    add(geo('lid', () => { const g = new THREE.SphereGeometry(0.02, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.45); g.scale(1.3, 0.8, 0.6); return g; }), skin, sx * 0.043, 0.027, 0.1, head);
    add(geo('cheek', () => new THREE.SphereGeometry(0.03, 8, 6)), skin, sx * 0.062, -0.025, 0.088, head);
  }
  if (!female && Math.random() < 0.4) { add(geo('shades', () => new THREE.BoxGeometry(0.2, 0.034, 0.03)), mat('#0b0b10'), 0, 0.026, 0.108, head); }
  add(geo('lipU', () => { const g = new THREE.BoxGeometry(0.04, 0.008, 0.012); return g; }), mat('#a05a54'), 0, -0.048, 0.106, head);
  add(geo('lipL', () => new THREE.BoxGeometry(0.034, 0.009, 0.012)), mat('#b36a62'), 0, -0.058, 0.104, head);
  add(geo('chin', () => new THREE.SphereGeometry(0.03, 8, 6)), skin, 0, -0.082, 0.07, head);
  for (const sx of [-1, 1]) add(geo('ear', () => new THREE.SphereGeometry(0.02, 6, 6)), skin, sx * 0.1, 0, 0, head);
  if (hijab) {
    const hm = mat(pick(HIJABS));
    const hj = add(geo('hijab', () => { const g = new THREE.SphereGeometry(0.135, 14, 12); g.scale(0.98, 1.1, 1.05); return g; }), hm, 0, 0.012, -0.045, head, true);
    add(geo('hijabs', () => cyl(0.12, 0.2, 0.24, 12, 0)), hm, 0, -0.17, -0.02, head);
  } else {
    const hair = mat(pick(HAIRS));
    const style = female ? pick(['long', 'bun', 'long']) : pick(['short', 'short', 'cap', 'bald', 'curly']);
    if (style !== 'bald') {
      add(geo('hcap', () => { const g = new THREE.SphereGeometry(0.12, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55); g.scale(1, 1.1, 1.08); return g; }), hair, 0, 0.012, -0.012, head, true);
    }
    if (style === 'long') add(geo('hlong', () => { const g = new THREE.BoxGeometry(0.22, 0.28, 0.08); return g; }), hair, 0, -0.1, -0.09, head);
    if (style === 'bun') add(geo('bun', () => new THREE.SphereGeometry(0.05, 8, 8)), hair, 0, 0.1, -0.1, head);
    if (style === 'curly') add(geo('curly', () => new THREE.SphereGeometry(0.135, 8, 8)), hair, 0, 0.04, -0.02, head);
    if (!female && Math.random() < 0.3) add(geo('beard', () => { const g = new THREE.SphereGeometry(0.1, 10, 8, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.4); g.scale(0.95, 1.0, 0.9); return g; }), mat('#241a14'), 0, -0.02, 0.01, head);
  }

  // arms: shoulder pivot -> upper arm -> elbow pivot -> forearm + hand
  const mkArm = sx => {
    const sh = new THREE.Group(); sh.position.set(sx * 0.235, 1.5, 0); body.add(sh);
    const sleeve = longSleeves ? top : top;
    add(geo('shoulder', () => new THREE.SphereGeometry(0.055, 8, 8)), top, 0, 0, 0, sh);
    add(geo('shoulder2', () => new THREE.SphereGeometry(0.054, 12, 10)), top, 0, 0, 0, sh);
    add(geo('uarm', () => cyl(0.05, 0.043, 0.3, 14, -0.15)), sleeve, 0, 0, 0, sh, true);
    const el = new THREE.Group(); el.position.y = -0.3; sh.add(el);
    add(geo('elbow', () => new THREE.SphereGeometry(0.043, 10, 8)), longSleeves ? top : skin, 0, 0, 0, el);
    add(geo('farm', () => cyl(0.043, 0.036, 0.27, 14, -0.135)), longSleeves ? top : skin, 0, 0, 0, el);
    add(geo('hand', () => { const g = new THREE.SphereGeometry(0.04, 12, 10); g.scale(0.85, 1.15, 0.6); return g; }), skin, 0, -0.295, 0, el);
    add(geo('thumb', () => new THREE.CapsuleGeometry(0.011, 0.03, 3, 6)), skin, -sx * 0.026, -0.275, 0.012, el);
    return { sh, el };
  };
  const aL = mkArm(-1), aR = mkArm(1);

  // legs: hip pivot -> thigh -> knee pivot -> shin -> foot
  const mkLeg = sx => {
    const hp = new THREE.Group(); hp.position.set(sx * 0.09, 0.93, 0); body.add(hp);
    add(geo('thigh', () => cyl(0.078, 0.06, 0.46, 14, -0.23)), bottom, 0, 0, 0, hp, true);
    const kn = new THREE.Group(); kn.position.y = -0.46; hp.add(kn);
    add(geo('knee', () => new THREE.SphereGeometry(0.058, 10, 8)), long ? skin : bottom, 0, 0, 0, kn);
    add(geo('shin', () => cyl(0.058, 0.045, 0.44, 14, -0.22)), long ? skin : bottom, 0, 0, 0, kn, true);
    add(geo('foot', () => { const g = new THREE.CapsuleGeometry(0.045, 0.17, 4, 8); g.rotateX(Math.PI / 2); g.scale(1.0, 0.75, 1); return g; }), shoe, 0, -0.455, 0.06, kn);
    add(geo('sole', () => new THREE.BoxGeometry(0.1, 0.02, 0.29)), mat('#e9e6df'), 0, -0.49, 0.06, kn);
    return { hp, kn };
  };
  const lL = mkLeg(-1), lR = mkLeg(1);
  root.userData = { body, tor, head, aL, aR, lL, lR, long };
  return root;
}

export class NPCs {
  constructor(scene, count) {
    this.list = []; this.pendingHits = 0;
    for (let i = 0; i < count; i++) {
      const mesh = makePerson();
      scene.add(mesh);
      const n = { mesh, k: 0, l: 0, dir: 1, corner: 0, x: 0, z: 0, speed: rnd(1.1, 2.1), phase: Math.random() * 6, down: 0, downMax: 2.6, hp: 100, hpMax: 100, panic: 0, stagger: 0, barT: 0, crime: false, carCool: 0, heading: 0, stride: rnd(0.8, 1.15), idle: 0 };
      this.respawn(n);
      this.list.push(n);
    }
  }

  corners(n) {
    const cx = blockCoord(n.k), cz = blockCoord(n.l);
    return [[cx - R, cz - R], [cx + R, cz - R], [cx + R, cz + R], [cx - R, cz + R]];
  }

  respawn(n) {
    n.k = Math.floor(Math.random() * CFG.grid);
    n.l = Math.floor(Math.random() * CFG.grid);
    n.dir = Math.random() < 0.5 ? 1 : -1;
    n.corner = Math.floor(Math.random() * 4);
    const c = this.corners(n);
    const a = c[n.corner], b = c[(n.corner + 1) % 4];
    const t = Math.random();
    n.x = a[0] + (b[0] - a[0]) * t; n.z = a[1] + (b[1] - a[1]) * t;
    n.down = 0; n.hp = 100; n.panic = 0; n.stagger = 0; n.barT = 0;
    n.mesh.rotation.x = 0;
    n.mesh.position.set(n.x, 0.34, n.z);
  }

  hit(n, dmg) {
    if (n.down > 0) return false;
    n.hp -= dmg; n.barT = 3.5; n.crime = true;
    if (n.hp <= 0) { n.hp = 0; n.down = n.downMax = 5; return true; }
    if (n.brave === undefined) n.brave = Math.random() < 0.35;
    if (n.brave) { n.fight = 9; n.panic = 0; } else n.panic = 6;
    n.stagger = 0.35; return false;
  }

  // gunshot / violence nearby: everyone close scatters
  alarm(x, z, r) {
    for (const n of this.list) {
      if (n.down > 0) continue;
      if (Math.hypot(n.x - x, n.z - z) < r) { n.panic = Math.max(n.panic, 5 + Math.random() * 3); n.fight = 0; n.idle = 0; }
    }
  }

  knock(n, fx, fz, d) { n.x += fx * d; n.z += fz * d; }

  update(dt, carObj, px, pz) {
    for (const n of this.list) {
      const g = n.mesh;
      const near = Math.hypot(n.x - px, n.z - pz);
      g.visible = near < 120;
      if (n.down > 0) {
        n.down -= dt;
        g.rotation.x = -Math.PI / 2 * Math.min(1, (n.downMax - n.down) * 6);
        g.position.y = 0.34 + 0.12;
        if (n.down <= 0) this.respawn(n);
        continue;
      }
      if (carObj && Math.abs(carObj.speed) > 5) {
        if (n.carCool <= 0 && Math.hypot(n.x - carObj.x, n.z - carObj.z) < 2.3) { n.carCool = 0.8; this.hit(n, 30 + Math.abs(carObj.speed) * 4); if (n.down > 0) continue; }
      }
      n.carCool -= dt; n.barT -= dt; n.atkCool = (n.atkCool || 0) - dt;
      if (n.fight > 0) {
        n.fight -= dt;
        const dx = px - n.x, dz = pz - n.z, d = Math.hypot(dx, dz) || 1;
        n.heading = Math.atan2(dx, dz);
        if (n.stagger > 0) n.stagger -= dt;
        else if (d > 1.5) { n.x += dx / d * 3.4 * dt; n.z += dz / d * 3.4 * dt; n.phase += dt * 10; }
        else if (n.atkCool <= 0) { n.atkCool = 1.1; n.atkT = 0.28; this.pendingHits += 6; }
        if (g.visible) {
          const u = g.userData; const k = d > 1.5 && n.stagger <= 0 ? 1 : 0;
          const s = Math.sin(n.phase);
          u.lL.hp.rotation.x = s * 0.7 * k; u.lR.hp.rotation.x = -s * 0.7 * k;
          if (n.atkT > 0) { n.atkT -= dt; u.aR.sh.rotation.x = -1.5 * Math.sin(Math.PI * (1 - n.atkT / 0.28)); u.aL.sh.rotation.x = -0.7; }
          else { u.aR.sh.rotation.x = -0.5; u.aL.sh.rotation.x = -0.5; u.aL.el.rotation.x = u.aR.el.rotation.x = -1.2; }
          g.position.set(n.x, 0.34, n.z); g.rotation.y = n.heading;
        }
        continue;
      }
      let sp = n.speed;
      if (n.panic > 0) { n.panic -= dt; sp = 3.7; n.idle = 0; }
      if (n.stagger > 0) { n.stagger -= dt; sp = 0; }
      if (near < 1.2) sp = 0;
      // slow down and look around occasionally
      if (n.idle > 0) { n.idle -= dt; sp = 0; }
      else if (Math.random() < dt * 0.02) n.idle = rnd(1, 3);
      const c = this.corners(n);
      const tgt = n.dir > 0 ? c[(n.corner + 1) % 4] : c[n.corner];
      const dx = tgt[0] - n.x, dz = tgt[1] - n.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.6) { n.corner = (n.corner + (n.dir > 0 ? 1 : 3)) % 4; }
      else if (sp > 0) {
        n.x += dx / dist * sp * dt; n.z += dz / dist * sp * dt;
        const target = Math.atan2(dx, dz);
        let dh = target - n.heading;
        while (dh > Math.PI) dh -= Math.PI * 2; while (dh < -Math.PI) dh += Math.PI * 2;
        n.heading += dh * Math.min(1, dt * 6);
      }
      if (!g.visible) continue;
      const u = g.userData;
      const walking = sp > 0;
      const k = walking ? 1 : 0;
      n.phase += dt * sp * 4.2 * n.stride;
      const p = n.phase;
      const s = Math.sin(p), c2 = Math.cos(p);
      const amp = Math.min(1, sp / 1.6) * 0.55 * k;
      u.lL.hp.rotation.x += ((s * amp) - u.lL.hp.rotation.x) * Math.min(1, dt * 14);
      u.lR.hp.rotation.x += ((-s * amp) - u.lR.hp.rotation.x) * Math.min(1, dt * 14);
      u.lL.kn.rotation.x += ((Math.max(0, -c2) * 0.9 * k) - u.lL.kn.rotation.x) * Math.min(1, dt * 14);
      u.lR.kn.rotation.x += ((Math.max(0, c2) * 0.9 * k) - u.lR.kn.rotation.x) * Math.min(1, dt * 14);
      u.aL.sh.rotation.x += ((-s * amp * 0.9) - u.aL.sh.rotation.x) * Math.min(1, dt * 14);
      u.aR.sh.rotation.x += ((s * amp * 0.9) - u.aR.sh.rotation.x) * Math.min(1, dt * 14);
      u.aL.el.rotation.x = -0.18 - Math.max(0, s) * 0.35 * k;
      u.aR.el.rotation.x = -0.18 - Math.max(0, -s) * 0.35 * k;
      u.aL.sh.rotation.z = 0.04; u.aR.sh.rotation.z = -0.04;
      u.body.position.y = Math.abs(s) * 0.025 * k;
      u.body.rotation.z = s * 0.025 * k;
      u.tor.rotation.y = s * 0.12 * k;
      u.head.rotation.y = n.idle > 0 ? Math.sin(performance.now() / 600 + n.phase) * 0.5 : 0;
      g.position.set(n.x, 0.34, n.z);
      g.rotation.y = n.heading;
    }
  }
}

// shared walk-cycle animation (used by the player too)
export function animateWalk(u, p, amp, dt, still) {
  const br = Math.sin(performance.now() / 750 + (u.seed || (u.seed = Math.random() * 6)));
  const s = Math.sin(p), c2 = Math.cos(p), k = still ? 0 : 1, f = Math.min(1, dt * 14);
  u.lL.hp.rotation.x += ((s * amp * k) - u.lL.hp.rotation.x) * f;
  u.lR.hp.rotation.x += ((-s * amp * k) - u.lR.hp.rotation.x) * f;
  u.lL.kn.rotation.x += ((Math.max(0, -c2) * (0.5 + amp) * k) - u.lL.kn.rotation.x) * f;
  u.lR.kn.rotation.x += ((Math.max(0, c2) * (0.5 + amp) * k) - u.lR.kn.rotation.x) * f;
  u.aL.sh.rotation.x += ((-s * amp * 0.9 * k) - u.aL.sh.rotation.x) * f;
  u.aR.sh.rotation.x += ((s * amp * 0.9 * k) - u.aR.sh.rotation.x) * f;
  u.aL.el.rotation.x = -0.18 - Math.max(0, s) * 0.35 * k * (0.6 + amp);
  u.aR.el.rotation.x = -0.18 - Math.max(0, -s) * 0.35 * k * (0.6 + amp);
  u.aL.sh.rotation.z = 0.04; u.aR.sh.rotation.z = -0.04;
  u.body.position.y = Math.abs(s) * 0.03 * k;
  u.body.rotation.z = s * 0.025 * k;
  u.tor.rotation.y = s * 0.12 * k;
  u.tor.scale.y = 1 + br * 0.014 * (1 - k);
  if (still) { u.aL.sh.rotation.x += (br * 0.03 - u.aL.sh.rotation.x) * f * 0.3; u.head.rotation.y = Math.sin(performance.now() / 2300 + u.seed) * 0.25; }
  else u.head.rotation.y *= 0.9;
  u.head.rotation.x = k * 0.03;
}
