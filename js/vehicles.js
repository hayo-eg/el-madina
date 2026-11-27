import * as THREE from 'three';
import { CFG, clamp, fwd, roadCoord, span } from './config.js';

const CAR_COLORS = ['#e74c3c', '#3498db', '#f1c40f', '#2ecc71', '#e67e22', '#ecf0f1', '#9b59b6', '#1abc9c', '#fd79a8', '#00cec9'];

export const CAR_TYPES = ['sedan', 'taxi', 'suv', 'sports', 'pickup', 'microbus', 'hatch'];
const M = {};
function mat(k, c, extra) {
  const key = k + c;
  if (!M[key]) M[key] = extra ? new THREE.MeshStandardMaterial({ color: c, ...extra }) : new THREE.MeshLambertMaterial({ color: c });
  return M[key];
}

export function makeCar(color, type) {
  type = type || CAR_TYPES[Math.floor(Math.random() * CAR_TYPES.length)];
  if (type === 'taxi') color = '#f2c200';
  const g = new THREE.Group();
  const body = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.12 });
  const dark = mat('d', '#14181f');
  const glass = mat('g', '#1d3550', { roughness: 0.08, metalness: 0.6 });
  const rim = mat('r', '#c9ced6', { roughness: 0.3, metalness: 0.9 });
  const trim = mat('t', '#262b33');
  const hlM = new THREE.MeshBasicMaterial({ color: '#fff6c9' });
  const tlM = new THREE.MeshBasicMaterial({ color: '#8a1111' });
  const add = (w, h, d, x, y, z, m, rx) => {
    const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m || body);
    me.position.set(x, y, z);
    if (rx) me.rotation.x = rx;
    me.castShadow = true;
    g.add(me); return me;
  };
  let wr = 0.42, wz = 1.45, wx = 1.0, wl = 0.3;
  if (type === 'sedan' || type === 'taxi') {
    add(2.0, 0.62, 4.5, 0, 0.72, 0);                 // lower body
    add(1.9, 0.12, 1.2, 0, 1.06, 1.45, body);        // hood
    add(1.82, 0.62, 2.2, 0, 1.32, -0.3, glass);      // greenhouse
    add(1.76, 0.1, 1.7, 0, 1.68, -0.3);              // roof
    add(2.04, 0.12, 0.2, 0, 0.5, 2.25, trim); add(2.04, 0.12, 0.2, 0, 0.5, -2.25, trim); // bumpers
    if (type === 'taxi') {
      add(0.8, 0.22, 0.34, 0, 1.84, -0.3, new THREE.MeshBasicMaterial({ color: '#fff2a0' }));
      add(2.02, 0.1, 0.9, 0, 0.9, 0.2, mat('k', '#111')).scale.set(1, 0.4, 1);
    }
  } else if (type === 'hatch') {
    wr = 0.38; wz = 1.3;
    add(1.9, 0.62, 3.9, 0, 0.7, 0);
    add(1.8, 0.7, 2.4, 0, 1.3, -0.35, glass);
    add(1.76, 0.1, 2.2, 0, 1.68, -0.4);
    add(1.94, 0.12, 0.2, 0, 0.5, 2.0, trim); add(1.94, 0.12, 0.2, 0, 0.5, -1.98, trim);
  } else if (type === 'suv') {
    wr = 0.5; wz = 1.5;
    add(2.1, 0.8, 4.6, 0, 0.9, 0);
    add(2.0, 0.75, 3.1, 0, 1.58, -0.5, glass);
    add(1.95, 0.1, 3.0, 0, 2.0, -0.5);
    add(0.1, 0.06, 2.8, -0.8, 2.08, -0.5, trim); add(0.1, 0.06, 2.8, 0.8, 2.08, -0.5, trim); // roof rails
    add(2.14, 0.2, 0.22, 0, 0.62, 2.35, trim); add(2.14, 0.2, 0.22, 0, 0.62, -2.35, trim);
  } else if (type === 'sports') {
    wr = 0.38; wx = 1.08;
    add(2.1, 0.5, 4.5, 0, 0.58, 0);
    add(1.7, 0.1, 1.4, 0, 0.9, 1.4);
    add(1.6, 0.5, 1.7, 0, 1.0, -0.25, glass);
    add(1.5, 0.08, 1.2, 0, 1.28, -0.25);
    add(1.9, 0.07, 0.5, 0, 1.15, -2.0, body);         // spoiler
    add(0.1, 0.35, 0.3, -0.7, 0.98, -2.0, trim); add(0.1, 0.35, 0.3, 0.7, 0.98, -2.0, trim);
    add(2.1, 0.12, 0.3, 0, 0.36, 2.25, trim);
  } else if (type === 'pickup') {
    wr = 0.48; wz = 1.55;
    add(2.1, 0.7, 4.9, 0, 0.82, 0);
    add(1.95, 0.9, 1.7, 0, 1.55, 0.8, glass);       // cab
    add(1.9, 0.1, 1.5, 0, 2.05, 0.8);
    add(2.1, 0.5, 0.12, 0, 1.35, -0.4, body);       // bed front wall
    add(0.1, 0.5, 2.1, -1.0, 1.28, -1.45, body); add(0.1, 0.5, 2.1, 1.0, 1.28, -1.45, body);
    add(2.1, 0.5, 0.1, 0, 1.28, -2.45, body);
    add(1.9, 0.08, 2.0, 0, 1.13, -1.45, trim);
  } else if (type === 'microbus') {
    wz = 1.6;
    add(2.1, 0.8, 4.9, 0, 0.9, 0);
    add(2.05, 0.95, 4.7, 0, 1.78, -0.1, glass);
    add(2.0, 0.1, 4.5, 0, 2.3, -0.1);
    add(2.1, 0.12, 0.2, 0, 0.55, 2.45, trim); add(2.1, 0.12, 0.2, 0, 0.55, -2.45, trim);
    add(2.12, 0.1, 4.9, 0, 1.3, 0, new THREE.MeshLambertMaterial({ color: '#f5f5f0' })); // stripe
  }
  // headlights / taillights
  const bodyL = type === 'microbus' ? 2.45 : type === 'pickup' ? 2.46 : type === 'hatch' ? 1.96 : 2.26;
  const lw = type === 'sports' ? 0.5 : 0.42;
  const ly = type === 'sports' ? 0.62 : type === 'suv' || type === 'pickup' ? 0.95 : 0.8;
  for (const sx of [-0.68, 0.68]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(lw, 0.18, 0.08), hlM); h.position.set(sx, ly, bodyL); g.add(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(lw, 0.18, 0.08), tlM.clone()); t.position.set(sx, ly, -bodyL); g.add(t);
    (g.userData.tails = g.userData.tails || []).push(t);
  }
  const wheelGeo = new THREE.CylinderGeometry(wr, wr, wl, 12); wheelGeo.rotateZ(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(wr * 0.55, wr * 0.55, wl + 0.04, 8); rimGeo.rotateZ(Math.PI / 2);
  const wheels = [];
  for (const [x, z] of [[-wx, wz], [wx, wz], [-wx, -wz], [wx, -wz]]) {
    const w = new THREE.Group();
    const tire = new THREE.Mesh(wheelGeo, dark); tire.castShadow = true; w.add(tire);
    w.add(new THREE.Mesh(rimGeo, rim));
    w.position.set(x, wr, z);
    g.add(w); wheels.push(w);
  }
  g.userData.wheels = wheels;
  g.userData.type = type;
  return g;
}

// A traffic car driving a rectangular loop around a block
export class TrafficCar {
  constructor(scene, bi, bj, clockwise, colorIdx) {
    this.mesh = makeCar(CAR_COLORS[colorIdx % CAR_COLORS.length]);
    scene.add(this.mesh);
    const off = CFG.laneOff;
    const x0 = roadCoord(bi), x1 = roadCoord(bi + 1);
    const z0 = roadCoord(bj), z1 = roadCoord(bj + 1);
    // loop corners offset to the proper lane
    if (clockwise) {
      this.wps = [
        { x: x0 + off, z: z0 + off }, { x: x1 - off, z: z0 + off },
        { x: x1 - off, z: z1 - off }, { x: x0 + off, z: z1 - off },
      ];
    } else {
      this.wps = [
        { x: x0 + off, z: z0 + off }, { x: x0 + off, z: z1 - off },
        { x: x1 - off, z: z1 - off }, { x: x1 - off, z: z0 + off },
      ];
    }
    this.wpIdx = 1 + Math.floor(Math.random() * 3);
    const start = this.wps[(this.wpIdx + this.wps.length - 1) % this.wps.length];
    this.x = start.x; this.z = start.z;
    this.heading = 0;
    this.speed = 7 + Math.random() * 5;
    this.topSpeed = this.speed;
    this.blocked = 0;
    this.stopTimer = 0;
    this.removed = false;
    this.syncMesh();
  }

  syncMesh() {
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
  }

  update(dt, others, playerX, playerZ, playerCar) {
    if (this.removed) return;
    const wp = this.wps[this.wpIdx];
    const dx = wp.x - this.x, dz = wp.z - this.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 5) { this.wpIdx = (this.wpIdx + 1) % this.wps.length; return; }

    const desired = Math.atan2(dx, dz);
    let dh = desired - this.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    const maxTurn = 2.0 * dt;
    this.heading += clamp(dh, -maxTurn, maxTurn);

    // obstacle check ahead
    const f = fwd(this.heading);
    let want = this.topSpeed;
    const check = (ox, oz, rad) => {
      const rx = ox - this.x, rz = oz - this.z;
      const ahead = rx * f.x + rz * f.z;
      if (ahead < 1 || ahead > 10) return;
      const lat = Math.abs(rx * -f.z + rz * f.x);
      if (lat < rad) want = 0;
    };
    for (const o of others) { if (o !== this && !o.removed) check(o.x, o.z, 2.6); }
    if (playerCar) check(playerCar.x, playerCar.z, 2.8);
    else check(playerX, playerZ, 2.2);

    if (this.stopTimer > 0) { this.stopTimer -= dt; want = 0; }
    if (want === 0) this.blocked += dt; else this.blocked = 0;

    const accel = want > this.speed ? 6 : 22;
    this.speed += clamp(want - this.speed, -accel * dt, accel * dt);
    this.x += f.x * this.speed * dt;
    this.z += f.z * this.speed * dt;
    // keep inside city
    const B = span() / 2;
    this.x = clamp(this.x, -B, B);
    this.z = clamp(this.z, -B, B);
    this.syncMesh();
    for (const w of this.mesh.userData.wheels) w.rotation.x += this.speed * dt / 0.42;
  }
}

// parked car (static, enterable)
export function makeParked(scene, list) {
  const cars = [];
  let placed = 0, guard = 0;
  while (placed < list.count && guard++ < 400) {
    const i = 1 + Math.floor(Math.random() * (CFG.grid - 1));
    const along = (Math.random() - 0.5) * (span() - 60);
    const side = Math.random() < 0.5 ? -1 : 1;
    const vertical = Math.random() < 0.5;
    const c = roadCoord(i) + side * (CFG.road / 2 - 1.6);
    const x = vertical ? along : c;
    const z = vertical ? c : along;
    // keep clear of intersections
    let nearCross = false;
    for (let j = 0; j <= CFG.grid; j++) {
      if (vertical && Math.abs(along - roadCoord(j)) < CFG.road) nearCross = true;
      if (!vertical && Math.abs(along - roadCoord(j)) < CFG.road) nearCross = true;
    }
    if (nearCross) continue;
    const heading = vertical ? (side > 0 ? 0 : Math.PI) : (side > 0 ? Math.PI / 2 : -Math.PI / 2);
    const mesh = makeCar(CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)]);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = heading;
    scene.add(mesh);
    cars.push({ mesh, x, z, heading, speed: 0, parked: true });
    placed++;
  }
  return cars;
}
