import * as THREE from 'three';
import { CFG, clamp, fwd, roadCoord, span } from './config.js';

const CAR_COLORS = ['#e74c3c', '#3498db', '#f1c40f', '#2ecc71', '#e67e22', '#ecf0f1', '#9b59b6', '#1abc9c', '#fd79a8', '#00cec9'];

export const CAR_TYPES = ['sedan', 'taxi', 'suv', 'sports', 'pickup', 'microbus', 'hatch'];
const M = {}, GC = {};
function mat(k, c, extra) {
  const key = k + c;
  if (!M[key]) M[key] = extra ? new THREE.MeshStandardMaterial({ color: c, ...extra }) : new THREE.MeshLambertMaterial({ color: c });
  return M[key];
}

// side-profile polygon [z,y] extruded across the car width, bevelled for a smooth look
function profileGeo(key, pts, width, bev = 0.07) {
  const k = key + width;
  if (GC[k]) return GC[k];
  const sh = new THREE.Shape();
  pts.forEach(([z, y], i) => (i ? sh.lineTo(z, y) : sh.moveTo(z, y)));
  sh.closePath();
  const dep = width - 2 * bev;
  const g = new THREE.ExtrudeGeometry(sh, { depth: dep, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 2, curveSegments: 1 });
  g.translate(0, 0, -dep / 2);
  g.rotateY(-Math.PI / 2);
  g.computeVertexNormals();
  return (GC[k] = g);
}
function rboxGeo(w, h, d) {
  const b = 0.06;
  if (Math.min(w, h, d) < 0.22) return new THREE.BoxGeometry(w, h, d);
  const hw = d / 2 - b, hh = h / 2 - b;
  return profileGeo('rb' + w + '_' + h + '_' + d, [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]], w, b);
}

const PROFILES = {
  sedan: { w: 1.9, lower: [[-2.2, 0.4], [2.2, 0.4], [2.25, 0.62], [2.1, 0.82], [1.2, 0.94], [-1.6, 0.97], [-2.15, 0.88], [-2.25, 0.62]],
    cab: [[1.05, 0.94], [0.4, 1.58], [-1.0, 1.58], [-1.55, 0.97]], roof: [[0.38, 1.56], [-0.98, 1.56], [-1.0, 1.64], [0.33, 1.64]], cw: 1.7, bodyL: 2.27, ly: 0.78, wr: 0.4, wz: 1.4 },
  hatch: { w: 1.85, lower: [[-1.9, 0.4], [1.9, 0.4], [1.95, 0.62], [1.8, 0.8], [1.0, 0.94], [-1.85, 1.0], [-1.95, 0.65]],
    cab: [[0.9, 0.94], [0.35, 1.6], [-1.7, 1.6], [-1.85, 1.0]], roof: [[0.3, 1.58], [-1.7, 1.58], [-1.72, 1.66], [0.25, 1.66]], cw: 1.65, bodyL: 1.97, ly: 0.78, wr: 0.37, wz: 1.2 },
  suv: { w: 2.05, lower: [[-2.3, 0.5], [2.3, 0.5], [2.36, 0.82], [2.2, 1.06], [1.4, 1.16], [-2.2, 1.2], [-2.36, 0.9]],
    cab: [[1.3, 1.16], [0.85, 2.0], [-2.0, 2.0], [-2.22, 1.2]], roof: [[0.8, 1.98], [-2.0, 1.98], [-2.02, 2.07], [0.75, 2.07]], cw: 1.85, bodyL: 2.38, ly: 0.98, wr: 0.5, wz: 1.5 },
  sports: { w: 2.0, lower: [[-2.25, 0.32], [2.25, 0.32], [2.3, 0.5], [2.0, 0.64], [0.9, 0.78], [-1.3, 0.86], [-2.2, 0.84], [-2.3, 0.55]],
    cab: [[0.9, 0.78], [0.25, 1.25], [-0.9, 1.25], [-1.4, 0.86]], roof: [[0.2, 1.23], [-0.9, 1.23], [-0.92, 1.3], [0.15, 1.3]], cw: 1.7, bodyL: 2.31, ly: 0.58, wr: 0.38, wz: 1.4 },
};

export function makeCar(color, type) {
  type = type || CAR_TYPES[Math.floor(Math.random() * CAR_TYPES.length)];
  if (type === 'taxi') color = '#f2c200';
  const g = new THREE.Group();
  const body = new THREE.MeshStandardMaterial({ color, roughness: 0.28, metalness: 0.55, envMapIntensity: 1.1 });
  const dark = mat('d', '#14181f');
  const glass = mat('g', '#142a40', { roughness: 0.05, metalness: 0.85, envMapIntensity: 1.3 });
  const rim = mat('r', '#d5d9e0', { roughness: 0.25, metalness: 0.95 });
  const trim = mat('t', '#262b33');
  const hlM = new THREE.MeshBasicMaterial({ color: '#fff6c9' });
  const tlM = new THREE.MeshBasicMaterial({ color: '#8a1111' });
  const addG = (geo, m, x, y, z) => { const me = new THREE.Mesh(geo, m); me.position.set(x, y, z); me.castShadow = true; g.add(me); return me; };
  const add = (w, h, d, x, y, z, m) => addG(rboxGeo(w, h, d), m || body, x, y, z);
  let wr = 0.42, wz = 1.45, wx = 0.9, wl = 0.3, bodyL = 2.3, ly = 0.8;
  const P = PROFILES[type === 'taxi' ? 'sedan' : type];
  if (P) {
    addG(profileGeo(type + 'L', P.lower, P.w), body, 0, 0, 0);
    addG(profileGeo(type + 'C', P.cab, P.cw, 0.05), glass, 0, 0, 0);
    addG(profileGeo(type + 'R', P.roof, P.cw + 0.04, 0.03), body, 0, 0, 0);
    // pillars between windows (body colour) for a framed look
    const cz = (P.cab[1][0] + P.cab[2][0]) / 2;
    add(P.cw + 0.06, 0.06, 0.12, 0, P.cab[1][1] - 0.02, cz + 0.2, body);
    // bumpers and grille
    add(P.w + 0.04, 0.16, 0.22, 0, P.lower[0][1] + 0.08, P.bodyL - 0.05, trim);
    add(P.w + 0.04, 0.16, 0.22, 0, P.lower[0][1] + 0.08, -P.bodyL + 0.05, trim);
    add(P.w * 0.5, 0.14, 0.05, 0, P.ly - 0.12, P.bodyL + 0.02, trim);   // grille
    // wing mirrors
    for (const sx of [-1, 1]) add(0.12, 0.1, 0.18, sx * (P.cw / 2 + 0.12), P.cab[0][1] + 0.1, P.cab[0][0] - 0.1, body);
    wr = P.wr; wz = P.wz; wx = P.w / 2 - 0.06; bodyL = P.bodyL; ly = P.ly;
    if (type === 'sports') {
      add(1.9, 0.07, 0.5, 0, 1.15, -2.05, body);
      add(0.1, 0.32, 0.3, -0.7, 0.98, -2.05, trim); add(0.1, 0.32, 0.3, 0.7, 0.98, -2.05, trim);
    }
    if (type === 'suv') { add(0.1, 0.06, 2.7, -0.8, 2.12, -0.7, trim); add(0.1, 0.06, 2.7, 0.8, 2.12, -0.7, trim); }
    if (type === 'taxi') {
      add(0.85, 0.22, 0.34, 0, 1.78, -0.3, new THREE.MeshBasicMaterial({ color: '#fff2a0' }));
      add(1.94, 0.09, 4.2, 0, 0.84, 0, mat('k', '#111')).scale.set(1.0, 1, 0.5);
    }
  } else if (type === 'pickup') {
    wr = 0.48; wz = 1.55; wx = 0.98; bodyL = 2.46; ly = 0.95;
    add(2.1, 0.72, 4.9, 0, 0.85, 0);
    add(1.95, 0.95, 1.7, 0, 1.62, 0.7, glass);
    add(1.9, 0.1, 1.5, 0, 2.15, 0.7);
    add(2.12, 0.5, 0.14, 0, 1.4, -0.4);
    add(0.12, 0.5, 2.1, -1.0, 1.32, -1.45); add(0.12, 0.5, 2.1, 1.0, 1.32, -1.45);
    add(2.1, 0.5, 0.12, 0, 1.32, -2.45);
    add(1.9, 0.08, 2.0, 0, 1.13, -1.45, trim);
    add(2.14, 0.16, 0.22, 0, 0.6, 2.45, trim); add(2.14, 0.16, 0.22, 0, 0.6, -2.5, trim);
  } else {                                           // microbus
    wz = 1.6; wx = 0.98; bodyL = 2.45; ly = 0.9;
    add(2.1, 0.8, 4.9, 0, 0.9, 0);
    add(2.05, 0.95, 4.7, 0, 1.78, -0.1, glass);
    add(2.0, 0.1, 4.5, 0, 2.3, -0.1);
    add(2.14, 0.16, 0.22, 0, 0.6, 2.46, trim); add(2.14, 0.16, 0.22, 0, 0.6, -2.46, trim);
    add(2.12, 0.1, 4.9, 0, 1.3, 0, new THREE.MeshLambertMaterial({ color: '#f5f5f0' }));
    add(2.0, 0.1, 0.05, 0, 2.2, 2.4, trim);
  }
  // lights
  const lw = type === 'sports' ? 0.5 : 0.42;
  for (const sx of [-0.68, 0.68]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(lw, 0.17, 0.08), hlM); h.position.set(sx, ly, bodyL); g.add(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(lw, 0.17, 0.08), tlM.clone()); t.position.set(sx, ly, -bodyL); g.add(t);
    (g.userData.tails = g.userData.tails || []).push(t);
  }
  // wheels: tyre + rim + hub + spokes
  const wk = 'w' + wr + wl;
  if (!GC[wk]) {
    const tg = new THREE.CylinderGeometry(wr, wr, wl, 18); tg.rotateZ(Math.PI / 2);
    const rg = new THREE.CylinderGeometry(wr * 0.62, wr * 0.62, wl + 0.03, 14); rg.rotateZ(Math.PI / 2);
    const hg = new THREE.CylinderGeometry(wr * 0.16, wr * 0.16, wl + 0.07, 8); hg.rotateZ(Math.PI / 2);
    GC[wk] = { tg, rg, hg, sp: new THREE.BoxGeometry(0.04, wr * 1.05, 0.05) };
  }
  const W = GC[wk];
  const wheels = [];
  for (const [x, z] of [[-wx, wz], [wx, wz], [-wx, -wz], [wx, -wz]]) {
    const w = new THREE.Group();
    const tire = new THREE.Mesh(W.tg, dark); tire.castShadow = true; w.add(tire);
    w.add(new THREE.Mesh(W.rg, rim));
    w.add(new THREE.Mesh(W.hg, trim));
    for (let i = 0; i < 4; i++) { const sp = new THREE.Mesh(W.sp, trim); sp.position.x = Math.sign(x) * (wl / 2 + 0.02); sp.rotation.x = i * Math.PI / 4; w.add(sp); }
    w.rotation.order = 'YXZ';
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
