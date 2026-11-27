import * as THREE from 'three';
import { CFG, clamp, fwd, roadCoord, span, collideCircleAABBs } from './config.js';
import { makeCar } from './vehicles.js';
import { makePerson, animateWalk } from './npc.js';

const lightMat = c => new THREE.MeshBasicMaterial({ color: c });
const SKIN_KEEP = new Set(['#f1c7a1', '#e0ac7e', '#c68b5c', '#a26a45', '#7a4b30', '#15110e', '#2a1d14', '#4a3626', '#6b4a2b', '#8c8c8c']);
const navy = new THREE.MeshLambertMaterial({ color: '#1d2d4d' });

function makePoliceCar() {
  const g = makeCar('#f4f6fa', 'sedan');
  // dark blue lower stripe + light bar
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.06, 0.34, 3.4), new THREE.MeshStandardMaterial({ color: '#1b3a7a', roughness: 0.5, metalness: 0.2 }));
  stripe.position.set(0, 0.62, 0.1); g.add(stripe);
  const bar = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.1, 0.34), new THREE.MeshLambertMaterial({ color: '#111' }));
  const red = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.16, 0.3), lightMat('#ff2020'));
  const blue = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.16, 0.3), lightMat('#2a5cff'));
  red.position.x = -0.32; blue.position.x = 0.32; red.position.y = blue.position.y = 0.1;
  bar.add(base, red, blue);
  bar.position.set(0, 1.62, -0.1);
  g.add(bar);
  g.userData.bar = { red, blue };
  return g;
}

function makeOfficer() {
  const m = makePerson({ female: false, kind: 'casual' });
  m.traverse(o => {
    if (o.isMesh && o.material && o.material.color) {
      const hex = '#' + o.material.color.getHexString();
      if (!SKIN_KEEP.has(hex)) o.material = navy;
    }
  });
  // cap
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.1, 10), navy);
  cap.position.y = 1.86; m.add(cap);
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.3), new THREE.MeshLambertMaterial({ color: '#222' }));
  gun.position.set(0.28, 1.1, 0.4); m.add(gun);
  return m;
}

export class Police {
  constructor(scene, colliders) {
    this.scene = scene; this.colliders = colliders;
    this.cars = []; this.officers = [];
    this.tracers = [];
    this.t = 0;
  }

  desired(stars) { return stars <= 0 ? 0 : Math.min(4, stars + (stars >= 4 ? 0 : 0)); }

  spawnCar(px, pz) {
    for (let g = 0; g < 20; g++) {
      const i = Math.floor(Math.random() * (CFG.grid + 1));
      const vertical = Math.random() < 0.5;
      const along = (Math.random() - 0.5) * (span() - 30);
      const x = vertical ? roadCoord(i) + 3.3 : along, z = vertical ? along : roadCoord(i) + 3.3;
      const d = Math.hypot(x - px, z - pz);
      if (d < 70 || d > 160) continue;
      const mesh = makePoliceCar(); this.scene.add(mesh);
      const c = { mesh, x, z, heading: Math.atan2(px - x, pz - z), speed: 0, hp: 120, dead: 0, stuck: 0, rev: 0, deployed: false, police: true, phase: Math.random() * 6 };
      this.cars.push(c); return c;
    }
    return null;
  }

  clear() {
    for (const c of this.cars) this.scene.remove(c.mesh);
    for (const o of this.officers) this.scene.remove(o.mesh);
    this.cars = []; this.officers = [];
  }

  update(dt, P, stars, diff) {
    this.t += dt;
    const out = { hurt: 0, nearCar: 99, copsClose: 0 };
    const dm = diff === 'easy' ? 0.7 : diff === 'hard' ? 1.35 : 1;
    const maxSp = (stars >= 4 ? 40 : 34) * (diff === 'easy' ? 0.85 : diff === 'hard' ? 1.08 : 1);
    // spawn / despawn
    const alive = this.cars.filter(c => !c.dead);
    if (stars > 0 && alive.length < this.desired(stars) && Math.random() < dt * 0.8) this.spawnCar(P.x, P.z);
    for (let i = this.cars.length - 1; i >= 0; i--) {
      const c = this.cars[i];
      const d = Math.hypot(c.x - P.x, c.z - P.z);
      if (c.hp <= 0 && c.gone) c.dead -= dt;
      if ((stars === 0 && d > 55 && c.hp > 0) || d > 240 || (c.gone && c.dead <= 0)) {
        this.scene.remove(c.mesh); this.cars.splice(i, 1);
      }
    }
    for (const c of this.cars) {
      const flash = Math.floor((this.t + c.phase) * 5) % 2 === 0;
      const b = c.mesh.userData.bar;
      b.red.visible = flash; b.blue.visible = !flash;
      if (c.hp <= 0) {
        c.speed *= Math.max(0, 1 - dt * 2);
        if (!c.gone) { c.gone = true; c.dead = 6; b.red.visible = b.blue.visible = false; }
      } else {
        // chase
        const dx = P.x - c.x, dz = P.z - c.z, d = Math.hypot(dx, dz);
        out.nearCar = Math.min(out.nearCar, d);
        if (stars > 0) {
          let want = Math.atan2(dx, dz);
          if (c.rev > 0) { c.rev -= dt; want += Math.PI * 0.6; }
          let dh = want - c.heading;
          while (dh > Math.PI) dh -= Math.PI * 2; while (dh < -Math.PI) dh += Math.PI * 2;
          c.heading += clamp(dh, -2.1 * dt, 2.1 * dt) * (Math.abs(c.speed) > 2 ? 1 : 0.5);
          let tgt = Math.min(maxSp, 8 + d * 0.5);
          if (P.onFoot && d < 14) tgt = 0;
          if (c.rev > 0) tgt = -8;
          c.speed += clamp(tgt - c.speed, -26 * dt, 15 * dm * dt);
        } else c.speed *= Math.max(0, 1 - dt);
        if (d < 22) out.copsClose++;
        // officers deploy
        if (P.onFoot && stars > 0 && d < 20 && !c.deployed && c.speed < 6) {
          c.deployed = true;
          const n = stars >= 3 ? 2 : 1;
          for (let k = 0; k < n; k++) this.spawnOfficer(c.x + k * 1.6, c.z + 2.4);
        }
      }
      const f = fwd(c.heading);
      c.x += f.x * c.speed * dt; c.z += f.z * c.speed * dt;
      let hit = false;
      for (const off of [1.3, -1.3]) {
        const px = c.x + f.x * off, pz = c.z + f.z * off;
        const r = collideCircleAABBs(px, pz, 1.2, this.colliders);
        if (r.hit) { c.x += r.x - px; c.z += r.z - pz; hit = true; }
      }
      if (hit) c.speed *= 0.6;
      if (c.hp > 0 && stars > 0 && Math.abs(c.speed) < 2.5 && !(P.onFoot && out.nearCar < 14)) { c.stuck += dt; if (c.stuck > 1.2) { c.rev = 1.2; c.stuck = 0; } } else c.stuck = 0;
      c.x = clamp(c.x, -CFG.bounds, CFG.bounds); c.z = clamp(c.z, -CFG.bounds, CFG.bounds);
      c.mesh.position.set(c.x, 0, c.z); c.mesh.rotation.y = c.heading;
      for (const w of c.mesh.userData.wheels) w.rotation.x += c.speed * dt / 0.42;
      // contact with player
      if (c.hp > 0) {
        const d = Math.hypot(c.x - P.x, c.z - P.z);
        const rad = P.car ? 3.4 : 1.8;
        if (d < rad && Math.abs(c.speed) > 3 && (c.hitCool || 0) <= 0) {
          c.hitCool = 0.9; out.hurt += (P.car ? 5 : 12) * dm; out.bump = true;
          if (P.car) { P.car.speed *= 0.7; const nx = (P.x - c.x) / (d || 1), nz = (P.z - c.z) / (d || 1); P.car.x += nx * 0.8; P.car.z += nz * 0.8; }
        }
        c.hitCool = (c.hitCool || 0) - dt;
      }
    }
    // officers
    for (let i = this.officers.length - 1; i >= 0; i--) {
      const o = this.officers[i];
      if (o.hp <= 0) {
        o.down -= dt;
        o.mesh.rotation.x = -Math.PI / 2 * Math.min(1, (3 - o.down) * 5); o.mesh.position.y = 0.46;
        if (o.down <= 0) { this.scene.remove(o.mesh); this.officers.splice(i, 1); }
        continue;
      }
      const dx = P.x - o.x, dz = P.z - o.z, d = Math.hypot(dx, dz);
      if (stars === 0 || d > 140) { this.scene.remove(o.mesh); this.officers.splice(i, 1); continue; }
      o.heading = Math.atan2(dx, dz);
      let sp = 0;
      if (d > (P.car ? 12 : 9)) sp = 4.6;
      if (sp > 0) {
        o.x += dx / d * sp * dt; o.z += dz / d * sp * dt;
        const r = collideCircleAABBs(o.x, o.z, 0.5, this.colliders); o.x = r.x; o.z = r.z;
        o.phase += dt * 9;
      }
      animateWalk(o.mesh.userData, o.phase, sp > 0 ? 0.7 : 0, dt, sp === 0);
      o.mesh.position.set(o.x, 0.34, o.z); o.mesh.rotation.y = o.heading;
      o.cool -= dt;
      if (d < 38 && o.cool <= 0) {
        o.cool = (0.9 + Math.random() * 0.7) / dm;
        const hitChance = P.car ? 0.25 : 0.4;
        this.tracer(o.x, 1.2, o.z, P.x, 1.0, P.z);
        if (Math.random() < hitChance) out.hurt += 6 * dm; else out.shotAt = true;
      }
    }
    // tracers fade
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i]; t.life -= dt;
      t.line.material.opacity = Math.max(0, t.life / 0.12);
      if (t.life <= 0) { this.scene.remove(t.line); t.line.geometry.dispose(); this.tracers.splice(i, 1); }
    }
    return out;
  }

  spawnOfficer(x, z) {
    const mesh = makeOfficer(); this.scene.add(mesh);
    const o = { mesh, x, z, heading: 0, phase: 0, hp: 60, down: 3, cool: 1.2 + Math.random(), police: true, officer: true };
    mesh.position.set(x, 0.34, z);
    this.officers.push(o);
  }

  tracer(x0, y0, z0, x1, y1, z1, color = '#ffe9a0') {
    const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1)]);
    const line = new THREE.Line(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 1 }));
    line.frustumCulled = false;
    this.scene.add(line); this.tracers.push({ line, life: 0.12 });
  }

  blips() { return this.cars.filter(c => c.hp > 0).map(c => ({ x: c.x, z: c.z })).concat(this.officers.filter(o => o.hp > 0).map(o => ({ x: o.x, z: o.z }))); }

  // find first target along a ray (ground plane) within range and lateral tolerance
  target(ox, oz, dirx, dirz, range, npcList) {
    let best = null;
    const test = (x, z, rad, kind, obj) => {
      const rx = x - ox, rz = z - oz;
      const along = rx * dirx + rz * dirz;
      if (along < 0.5 || along > range) return;
      const lat = Math.abs(rx * -dirz + rz * dirx);
      if (lat > rad) return;
      if (!best || along < best.dist) best = { kind, obj, dist: along, lat };
    };
    for (const c of this.cars) if (c.hp > 0) test(c.x, c.z, 1.9, 'pcar', c);
    for (const o of this.officers) if (o.hp > 0) test(o.x, o.z, 0.7, 'officer', o);
    for (const n of npcList) if (n.down <= 0 && n.mesh.visible) test(n.x, n.z, 0.6, 'npc', n);
    return best;
  }
}
