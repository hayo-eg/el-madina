import * as THREE from 'three';
import { CFG, clamp, fwd, roadCoord, span } from './config.js';

const CAR_COLORS = ['#e74c3c', '#3498db', '#f1c40f', '#2ecc71', '#e67e22', '#ecf0f1', '#9b59b6', '#1abc9c', '#fd79a8', '#00cec9'];

export function makeCar(color) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const darkMat = new THREE.MeshLambertMaterial({ color: '#1c2330' });
  const glassMat = new THREE.MeshLambertMaterial({ color: '#9fd8ef' });

  const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.85, 4.4), bodyMat);
  body.position.y = 0.75;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.72, 2.1), glassMat);
  cabin.position.set(0, 1.5, -0.25);
  g.add(cabin);

  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheels = [];
  for (const [x, z] of [[-1.05, 1.45], [1.05, 1.45], [-1.05, -1.45], [1.05, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, darkMat);
    w.position.set(x, 0.42, z);
    g.add(w); wheels.push(w);
  }

  const hl = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.22, 0.1), new THREE.MeshBasicMaterial({ color: '#fff6c9' }));
  hl.position.set(0, 0.85, 2.21);
  g.add(hl);
  const tl = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.2, 0.1), new THREE.MeshBasicMaterial({ color: '#ff4d4d' }));
  tl.position.set(0, 0.85, -2.21);
  g.add(tl);

  g.userData.wheels = wheels;
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
