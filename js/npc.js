import * as THREE from 'three';
import { buildPerson } from './people.js';
import { CFG, blockCoord, clamp, collideCircleAABBs } from './config.js';

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

let _bt = null;
function bubbleTex() {
  if (_bt) return _bt;
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  g.fillStyle = '#ff3b3b'; g.beginPath(); g.arc(32, 32, 28, 0, 7); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 4; g.stroke();
  g.fillStyle = '#fff'; g.font = 'bold 44px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('!', 32, 35);
  return (_bt = new THREE.CanvasTexture(c));
}

export function makePerson(opts) {
  const root = buildPerson(opts);
  const U = root.userData, M = U.mats;
  const low = new THREE.Group();
  const lt = new THREE.Mesh(geo('lowT', () => new THREE.BoxGeometry(0.36, 0.62, 0.22)), M.top); lt.position.y = 1.28;
  const ll = new THREE.Mesh(geo('lowL', () => new THREE.BoxGeometry(0.22, 0.86, 0.2)), M.bottom); ll.position.y = 0.5;
  const lh = new THREE.Mesh(geo('lowH', () => new THREE.SphereGeometry(0.115, 8, 6)), M.skin); lh.position.y = 1.72;
  low.add(lt, ll, lh); low.scale.copy(U.scale); low.visible = false; root.add(low);
  const bub = new THREE.Sprite(new THREE.SpriteMaterial({ map: bubbleTex(), depthTest: false, transparent: true }));
  bub.scale.set(0.5, 0.5, 1); bub.position.y = 2.45; bub.visible = false; bub.renderOrder = 997; root.add(bub);
  U.low = low; U.bub = bub;
  return root;
}

const AMBIENT = ['الجو حلو النهاردة', 'إيه يا عم الزحمة دي', 'صباح الفل', 'هو الأتوبيس اتأخر ليه؟', 'ده غالي أوي', 'يا ساتر يا رب', 'نروح فين النهاردة؟', 'ربنا يسهل', 'استنى بس هرد عليك', 'عايز أمسك كشري', 'الدنيا حر أوي', 'مين اللي كسب امبارح؟'];
const GREET = ['إزيك يا باشا', 'صباح الخير', 'أهلاً يا كبير', 'ازيك يا معلم', 'حاسب يا أستاذ', 'منور الحارة'];
const SCARED = ['الحقوني!', 'يا نهار أبيض!', 'سلاح! اجري!', 'يا لهوي!', 'ابعد عني!'];
const ANGRY = ['إنت مجنون؟!', 'هتندم!', 'تعالى هنا!', 'إيه ده يا عم؟!'];
const _bt2 = {};
function textTex(t) {
  if (_bt2[t]) return _bt2[t];
  const c = document.createElement('canvas'); c.width = 256; c.height = 72; const g = c.getContext('2d');
  g.fillStyle = 'rgba(255,255,255,.94)'; g.strokeStyle = '#222'; g.lineWidth = 3;
  g.beginPath(); (g.roundRect || g.rect).call(g, 4, 4, 248, 50, 14); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(118, 54); g.lineTo(128, 70); g.lineTo(138, 54); g.fillStyle = 'rgba(255,255,255,.94)'; g.fill();
  g.fillStyle = '#111'; g.font = 'bold 24px Tahoma, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = 'rtl'; g.fillText(t, 128, 30, 232);
  const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; return (_bt2[t] = tx);
}

export class NPCs {
  constructor(scene, count) {
    this.list = []; this.pendingHits = 0; this.colliders = []; this.rp = 0; this.talkT = 0; this.bubbles = [];
    for (let i = 0; i < 5; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ depthTest: false, transparent: true })); s.scale.set(2.3, 0.65, 1); s.visible = false; s.renderOrder = 998; scene.add(s); this.bubbles.push({ s, n: null, t: 0 }); }
    for (let i = 0; i < count; i++) {
      const mesh = makePerson();
      scene.add(mesh);
      const n = { mesh, k: 0, l: 0, dir: 1, corner: 0, x: 0, z: 0, speed: rnd(1.1, 2.1), phase: Math.random() * 6, down: 0, downMax: 2.6, hp: 100, hpMax: 100, brave: i % 3 !== 2, flee: 0, fx: 0, fz: 0, fight: 0, panic: 0, stagger: 0, barT: 0, crime: false, carCool: 0, heading: 0, stride: rnd(0.8, 1.15), idle: 0 };
      this.respawn(n);
      this.list.push(n);
    }
  }

  say(n, text, dur = 2.6, force) {
    let b = this.bubbles.find(q => q.n === n);
    if (!b) b = this.bubbles.find(q => q.t <= 0) || (force ? this.bubbles.reduce((a, q) => (q.t < a.t ? q : a)) : null);
    if (!b) return false;
    b.n = n; b.t = dur; b.s.material.map = textTex(text); b.s.material.needsUpdate = true; b.s.visible = true;
    return true;
  }
  tickBubbles(dt) {
    for (const b of this.bubbles) {
      if (b.t <= 0) continue;
      b.t -= dt;
      if (b.t <= 0 || !b.n || b.n.mesh.visible === false || b.n.down > 0) { b.t = 0; b.s.visible = false; b.n = null; continue; }
      b.s.position.set(b.n.x, 2.55, b.n.z);
    }
  }
  chatter(dt, px, pz) {
    this.talkT -= dt;
    if (this.talkT > 0) return;
    this.talkT = 1.1 + Math.random();
    const near = this.list.filter(n => n.down <= 0 && n.flee <= 0 && n.fight <= 0 && Math.hypot(n.x - px, n.z - pz) < 16);
    if (!near.length) return;
    // greet the player if someone is very close
    for (const n of near) {
      if ((n.greetCd || 0) > 0) { n.greetCd -= 1; continue; }
      if (Math.hypot(n.x - px, n.z - pz) < 3.2 && this.say(n, GREET[Math.floor(Math.random() * GREET.length)], 2.4)) { n.greetCd = 15; n.talk = 2.2; n.idle = 2.2; n.faceP = true; return; }
    }
    const n = near[Math.floor(Math.random() * near.length)];
    if (Math.random() < 0.6 && this.say(n, AMBIENT[Math.floor(Math.random() * AMBIENT.length)], 2.8)) { n.idle = 2.8; }
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

  hit(n, dmg, src, sx, sz) {
    if (n.down > 0) return false;
    n.hp -= dmg; n.barT = 3.5; n.crime = true;
    if (n.hp <= 0) { n.hp = 0; n.down = n.downMax = 5; n.flee = 0; n.fight = 0; return true; }
    n.stagger = 0.35;
    if (src === 'punch' && n.brave) { n.fight = 10; n.flee = 0; this.say(n, ANGRY[Math.floor(Math.random() * ANGRY.length)], 2.4, true); }
    else { n.fight = 0; n.flee = 7; n.fx = sx === undefined ? n.x : sx; n.fz = sz === undefined ? n.z + 1 : sz; }
    return false;
  }

  // put a pedestrian back on the nearest sidewalk loop
  snap(n) {
    const P = CFG.block + CFG.road;
    n.k = clamp(Math.round((n.x - blockCoord(0)) / P), 0, CFG.grid - 1);
    n.l = clamp(Math.round((n.z - blockCoord(0)) / P), 0, CFG.grid - 1);
    const cx = blockCoord(n.k), cz = blockCoord(n.l), dx = n.x - cx, dz = n.z - cz;
    if (Math.abs(dx) > Math.abs(dz)) { n.x = cx + Math.sign(dx || 1) * R; n.z = cz + clamp(dz, -R, R); n.corner = dx > 0 ? 1 : 3; }
    else { n.z = cz + Math.sign(dz || 1) * R; n.x = cx + clamp(dx, -R, R); n.corner = dz > 0 ? 2 : 0; }
  }

  // keep the crowd around the player: move far pedestrians to sidewalks near them
  recycle(px, pz) {
    const P = CFG.block + CFG.road;
    for (let c = 0; c < 6; c++) {
      this.rp = (this.rp + 1) % this.list.length;
      const n = this.list[this.rp];
      if (n.down > 0 || n.fight > 0 || n.flee > 0 || Math.hypot(n.x - px, n.z - pz) < 90) continue;
      for (let t = 0; t < 8; t++) {
        n.k = clamp(Math.round((px - blockCoord(0)) / P) + Math.floor(Math.random() * 5) - 2, 0, CFG.grid - 1);
        n.l = clamp(Math.round((pz - blockCoord(0)) / P) + Math.floor(Math.random() * 5) - 2, 0, CFG.grid - 1);
        n.corner = Math.floor(Math.random() * 4); n.dir = Math.random() < 0.5 ? 1 : -1;
        const cs = this.corners(n), a = cs[n.corner], b = cs[(n.corner + 1) % 4], tt = Math.random();
        n.x = a[0] + (b[0] - a[0]) * tt; n.z = a[1] + (b[1] - a[1]) * tt;
        const d = Math.hypot(n.x - px, n.z - pz);
        if (d > 14 && d < 78) break;
      }
      n.panic = 0; n.mesh.position.set(n.x, 0.34, n.z);
    }
  }

  // gunshot / violence nearby: everyone close runs away from the source (not tied to aim)
  alarm(x, z, r) {
    for (const n of this.list) {
      if (n.down > 0 || n.fight > 0) continue;
      const d = Math.hypot(n.x - x, n.z - z);
      if (d < r) { if (n.flee <= 0 && Math.random() < 0.5) this.say(n, SCARED[Math.floor(Math.random() * SCARED.length)], 2.2, true); n.flee = Math.max(n.flee, 5 + Math.random() * 3); n.fx = x; n.fz = z; n.idle = 0; n.stagger = Math.min(n.stagger, 0.05 + d * 0.004); }
    }
  }

  knock(n, fx, fz, d) { n.x += fx * d; n.z += fz * d; }

  update(dt, carObj, px, pz) {
    this.recycle(px, pz); this.tickBubbles(dt); this.chatter(dt, px, pz);
    for (const n of this.list) {
      const g = n.mesh;
      const near = Math.hypot(n.x - px, n.z - pz);
      g.visible = near < 95;
      const far = near > 30, U = g.userData;
      if (U.body.visible === far) { U.body.visible = !far; U.low.visible = far; }
      U.bub.visible = n.flee > 0 || n.fight > 0;
      if (n.down > 0) {
        n.down -= dt;
        g.rotation.x = -Math.PI / 2 * Math.min(1, (n.downMax - n.down) * 6);
        g.position.y = 0.34 + 0.12;
        if (n.down <= 0) this.respawn(n);
        continue;
      }
      if (carObj && Math.abs(carObj.speed) > 5) {
        if (n.carCool <= 0 && Math.hypot(n.x - carObj.x, n.z - carObj.z) < 2.3) { n.carCool = 0.8; this.hit(n, 30 + Math.abs(carObj.speed) * 4, 'car', carObj.x, carObj.z); if (n.down > 0) continue; }
      }
      n.carCool -= dt; n.barT -= dt; n.atkCool = (n.atkCool || 0) - dt;
      if (n.flee > 0) {
        n.flee -= dt;
        if (n.stagger > 0) n.stagger -= dt;
        else {
          const dx = n.x - n.fx, dz = n.z - n.fz, d = Math.hypot(dx, dz) || 1;
          const c = collideCircleAABBs(n.x + dx / d * 5.8 * dt, n.z + dz / d * 5.8 * dt, 0.5, this.colliders);
          if (c.hit) { n.fx += (Math.random() - 0.5) * 30; n.fz += (Math.random() - 0.5) * 30; }
          n.x = c.x; n.z = c.z; n.heading = Math.atan2(dx, dz); n.phase += dt * 15;
        }
        g.position.set(n.x, 0.34, n.z); g.rotation.y = n.heading;
        if (!far) animateWalk(U, n.phase, 1.0, dt, false);
        if (n.flee <= 0) this.snap(n);
        continue;
      }
      if (n.fight > 0) {
        n.fight -= dt;
        const dx = px - n.x, dz = pz - n.z, d = Math.hypot(dx, dz) || 1;
        n.heading = Math.atan2(dx, dz);
        if (n.stagger > 0) n.stagger -= dt;
        else if (d > 1.7) { n.x += dx / d * 4.4 * dt; n.z += dz / d * 4.4 * dt; n.phase += dt * 11; }
        else if (n.atkCool <= 0) { n.atkCool = 1.0; n.atkT = 0.28; this.pendingHits += 5; }
        if (g.visible && !far) {
          const u = g.userData; const k = d > 1.7 && n.stagger <= 0 ? 1 : 0;
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
      if (n.idle > 0) { n.idle -= dt; sp = 0; if (n.faceP) { let dh = Math.atan2(px - n.x, pz - n.z) - n.heading; while (dh > Math.PI) dh -= Math.PI * 2; while (dh < -Math.PI) dh += Math.PI * 2; n.heading += dh * Math.min(1, dt * 6); if (n.idle <= 0) n.faceP = false; } }
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
      g.position.set(n.x, 0.34, n.z); g.rotation.y = n.heading;
      if (!g.visible || far) continue;
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
