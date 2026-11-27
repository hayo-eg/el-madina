import * as THREE from 'three';
import { CFG, collideCircleAABBs, clamp } from './config.js';

export class Player {
  constructor(scene, x, z) {
    this.x = x; this.z = z;
    this.heading = 0;
    this.moving = 0;
    this.phase = 0;

    const g = new THREE.Group();
    const skin = new THREE.MeshLambertMaterial({ color: '#e8b98a' });
    const shirt = new THREE.MeshLambertMaterial({ color: '#2f6fd0' });
    const pants = new THREE.MeshLambertMaterial({ color: '#26314a' });

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.36), shirt);
    body.position.y = 1.06;
    g.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.42, 0.38), skin);
    head.position.y = 1.68;
    g.add(head);
    const hair = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.4), new THREE.MeshLambertMaterial({ color: '#1d1713' }));
    hair.position.y = 1.92;
    g.add(hair);

    this.legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.7, 0.28), pants);
    this.legL.geometry.translate(0, -0.35, 0);
    this.legL.position.set(-0.16, 0.7, 0);
    g.add(this.legL);
    this.legR = this.legL.clone();
    this.legR.position.x = 0.16;
    g.add(this.legR);

    const armGeo = new THREE.BoxGeometry(0.18, 0.62, 0.22);
    armGeo.translate(0, -0.31, 0);
    this.armL = new THREE.Mesh(armGeo, shirt);
    this.armL.position.set(-0.42, 1.4, 0);
    g.add(this.armL);
    this.armR = this.armL.clone();
    this.armR.position.x = 0.42;
    g.add(this.armR);

    this.mesh = g;
    scene.add(g);
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
      const tx = ix / (len || 1), tz = iz / (len || 1);
      this.x += tx * speed * dt;
      this.z += tz * speed * dt;
      const target = Math.atan2(tx, tz);
      let dh = target - this.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      this.heading += dh * Math.min(1, dt * 12);
      this.phase += dt * speed * 1.6;
      const sw = Math.sin(this.phase) * 0.7;
      this.legL.rotation.x = sw;
      this.legR.rotation.x = -sw;
      this.armL.rotation.x = -sw * 0.8;
      this.armR.rotation.x = sw * 0.8;
    } else {
      this.legL.rotation.x *= 0.8; this.legR.rotation.x *= 0.8;
      this.armL.rotation.x *= 0.8; this.armR.rotation.x *= 0.8;
    }
    const c = collideCircleAABBs(this.x, this.z, 0.55, colliders);
    this.x = clamp(c.x, -CFG.bounds, CFG.bounds);
    this.z = clamp(c.z, -CFG.bounds, CFG.bounds);
    this.syncMesh();
  }

  setVisible(v) { this.mesh.visible = v; }
}
