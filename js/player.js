import * as THREE from 'three';
import { CFG, collideCircleAABBs, clamp } from './config.js';
import { makePerson, animateWalk } from './npc.js';

export class Player {
  constructor(scene, x, z) {
    this.x = x; this.z = z;
    this.heading = 0;
    this.moving = 0;
    this.phase = 0;
    this.mesh = makePerson({ female: false, kind: 'casual' });
    scene.add(this.mesh);
    this.syncMesh();
  }

  syncMesh() {
    this.mesh.position.set(this.x, 0.34, this.z);
    this.mesh.rotation.y = this.heading;
  }

  update(dt, ix, iz, colliders) {
    const len = Math.hypot(ix, iz);
    this.moving = len;
    if (len > 0.05) {
      const n = Math.min(1, len);
      const speed = CFG.walkSpeed * n;
      const tx = ix / len, tz = iz / len;
      this.x += tx * speed * dt;
      this.z += tz * speed * dt;
      const target = Math.atan2(tx, tz);
      let dh = target - this.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      this.heading += dh * Math.min(1, dt * 12);
      this.phase += dt * (3 + speed * 0.95);
      animateWalk(this.mesh.userData, this.phase, Math.min(0.85, 0.3 + speed * 0.08), dt, false);
    } else {
      animateWalk(this.mesh.userData, this.phase, 0, dt, true);
    }
    const c = collideCircleAABBs(this.x, this.z, 0.55, colliders);
    this.x = clamp(c.x, -CFG.bounds, CFG.bounds);
    this.z = clamp(c.z, -CFG.bounds, CFG.bounds);
    this.syncMesh();
  }

  setVisible(v) { this.mesh.visible = v; }
}
