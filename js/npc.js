import * as THREE from 'three';
import { CFG, blockCoord } from './config.js';

const SHIRTS = ['#d64545', '#e0a030', '#3aa56b', '#4a78d8', '#9b59b6', '#f0f0f0', '#e67e22', '#2c3e50', '#16a085', '#e84393'];
const PANTS = ['#26314a', '#3d3a36', '#5a4632', '#1f2a3a', '#4a4f57'];
const SKINS = ['#e8b98a', '#c98f62', '#8d5a3b', '#f1c7a1'];
const R = 23;   // sidewalk ring offset from block centre
const mats = {};
const m = c => (mats[c] || (mats[c] = new THREE.MeshLambertMaterial({ color: c })));
const pick = a => a[Math.floor(Math.random() * a.length)];

function makePerson() {
  const g = new THREE.Group();
  const shirt = m(pick(SHIRTS)), pants = m(pick(PANTS)), skin = m(pick(SKINS));
  const mk = (w, h, d, mt, x, y, z) => { const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mt); me.position.set(x, y, z); me.castShadow = true; g.add(me); return me; };
  mk(0.6, 0.7, 0.34, shirt, 0, 1.05, 0);
  mk(0.38, 0.4, 0.36, skin, 0, 1.64, 0);
  mk(0.4, 0.13, 0.38, m(Math.random() < 0.5 ? '#1d1713' : '#4a3626'), 0, 1.88, 0);
  const leg = (x) => { const geo = new THREE.BoxGeometry(0.22, 0.7, 0.26); geo.translate(0, -0.35, 0); const l = new THREE.Mesh(geo, pants); l.position.set(x, 0.7, 0); l.castShadow = true; g.add(l); return l; };
  const arm = (x) => { const geo = new THREE.BoxGeometry(0.17, 0.6, 0.2); geo.translate(0, -0.3, 0); const a = new THREE.Mesh(geo, shirt); a.position.set(x, 1.38, 0); g.add(a); return a; };
  g.userData = { lL: leg(-0.15), lR: leg(0.15), aL: arm(-0.4), aR: arm(0.4) };
  return g;
}

export class NPCs {
  constructor(scene, count) {
    this.list = [];
    for (let i = 0; i < count; i++) {
      const mesh = makePerson();
      scene.add(mesh);
      const n = { mesh, k: 0, l: 0, dir: 1, corner: 0, x: 0, z: 0, speed: 1.5 + Math.random() * 1.2, phase: Math.random() * 6, down: 0, heading: 0 };
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
    n.down = 0;
    n.mesh.rotation.x = 0;
    n.mesh.position.set(n.x, 0.34, n.z);
  }

  update(dt, carObj, px, pz) {
    for (const n of this.list) {
      const g = n.mesh;
      if (n.down > 0) {
        n.down -= dt;
        g.rotation.x = -Math.PI / 2 * Math.min(1, (2.6 - n.down) * 6);
        g.position.y = 0.34 + 0.2;
        if (n.down <= 0) this.respawn(n);
        continue;
      }
      // hit by a fast car
      if (carObj && Math.abs(carObj.speed) > 5) {
        const d = Math.hypot(n.x - carObj.x, n.z - carObj.z);
        if (d < 2.3) { n.down = 2.6; continue; }
      }
      // wait if the player is right in front
      const dpl = Math.hypot(n.x - px, n.z - pz);
      let sp = n.speed;
      if (dpl < 1.2) sp = 0;
      const c = this.corners(n);
      const tgt = n.dir > 0 ? c[(n.corner + 1) % 4] : c[n.corner];
      const dx = tgt[0] - n.x, dz = tgt[1] - n.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.6) { n.corner = (n.corner + (n.dir > 0 ? 1 : 3)) % 4; }
      else {
        n.x += dx / dist * sp * dt; n.z += dz / dist * sp * dt;
        const target = Math.atan2(dx, dz);
        let dh = target - n.heading;
        while (dh > Math.PI) dh -= Math.PI * 2; while (dh < -Math.PI) dh += Math.PI * 2;
        n.heading += dh * Math.min(1, dt * 8);
      }
      n.phase += dt * sp * 3.2;
      const sw = sp > 0 ? Math.sin(n.phase) * 0.6 : 0;
      const u = g.userData;
      u.lL.rotation.x = sw; u.lR.rotation.x = -sw; u.aL.rotation.x = -sw * 0.8; u.aR.rotation.x = sw * 0.8;
      g.position.set(n.x, 0.34, n.z);
      g.rotation.y = n.heading;
    }
  }
}
