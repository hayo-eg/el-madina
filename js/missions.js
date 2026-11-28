import * as THREE from 'three';
import { blockCoord, CFG, span } from './config.js';

// taxi-style missions: reach marker, then deliver before the timer ends
export class Missions {
  constructor(scene, hud, audio) {
    this.scene = scene;
    this.hud = hud;
    this.audio = audio;
    this.state = 'TO_START';
    this.cash = 0;
    this.best = parseInt(localStorage.getItem('madina_best') || '0', 10);
    this.timer = 0; this.timerMax = 1;
    this.done = 0;

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(2.6, 0.35, 10, 28),
      new THREE.MeshBasicMaterial({ color: '#ffd166' })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.5;
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(1.5, 1.5, 70, 14, 1, true),
      new THREE.MeshBasicMaterial({ color: '#ffd166', transparent: true, opacity: 0.22, fog: false, side: THREE.DoubleSide, depthWrite: false })
    );
    beam.position.y = 35;
    this.marker = new THREE.Group();
    this.marker.add(ring); this.marker.add(beam);
    this.ring = ring;
    scene.add(this.marker);

    this.start = this._randomPoint();
    this.dest = null;
    this._place(this.start);
    this._banner();
  }

  _randomPoint() {
    // a sidewalk edge midpoint on a random block
    const k = Math.floor(Math.random() * CFG.grid);
    const l = Math.floor(Math.random() * CFG.grid);
    const side = Math.floor(Math.random() * 4);
    const c = CFG.block / 2 + 3.5;
    const bx = blockCoord(k), bz = blockCoord(l);
    if (side === 0) return { x: bx + c, z: bz };
    if (side === 1) return { x: bx - c, z: bz };
    if (side === 2) return { x: bx, z: bz + c };
    return { x: bx, z: bz - c };
  }

  _place(p) { this.marker.position.set(p.x, 0, p.z); }

  _banner() {
    if (this.state === 'TO_START') {
      this.hud.mission('روح للعلامة الصفرا علشان تستلم الراكب', this.best > 0 ? 'أحسن رصيد: ' + this.best : '');
      this.hud.timer(null);
    } else {
      this.hud.mission('وصّل الراكب قبل الوقت ما يخلص!', '');
    }
  }

  update(dt, px, pz, inCar) {
    // pulse
    const t = performance.now() / 1000;
    this.ring.scale.setScalar(1 + Math.sin(t * 4) * 0.12);

    const target = this.state === 'TO_START' ? this.start : this.dest;
    if (!target) return;

    if (this.state === 'TO_DEST') {
      this.timer -= dt;
      this.hud.timer(Math.max(0, this.timer / this.timerMax));
      if (this.timer <= 0) {
        this.state = 'TO_START';
        this.start = this._randomPoint();
        this.dest = null;
        this._place(this.start);
        this.hud.mission('الوقت خلص! روح للعلامة تاني', '');
        this.hud.timer(null);
        this.audio.fail();
        return;
      }
    }

    const d = Math.hypot(target.x - px, target.z - pz);
    if (d < 4.5) {
      if (this.state === 'TO_START') {
        this.state = 'TO_DEST';
        this.dest = this._randomPoint();
        // make sure the destination is far enough
        let guard = 0;
        while (Math.hypot(this.dest.x - px, this.dest.z - pz) < 90 && guard++ < 20) this.dest = this._randomPoint();
        const dist = Math.hypot(this.dest.x - px, this.dest.z - pz);
        this.timerMax = this.timer = Math.max(14, dist / 15);
        this._place(this.dest);
        this._banner();
        this.audio.pickup();
      } else {
        const reward = Math.round(80 + this.timer * 6);
        this.cash += reward;
        this.done++;
        if (this.cash > this.best) { this.best = this.cash; localStorage.setItem('madina_best', String(this.best)); }
        this.hud.cash(this.cash);
        this.audio.success();
        this.hud.mission('تمام! +' + reward + ' ج', '');
        this.state = 'COOLDOWN';
        this.cool = 2.2;
        this.dest = null;
        this.hud.timer(null);
        this.marker.position.set(9999, 0, 9999);
      }
    }

    if (this.state === 'COOLDOWN') {
      this.cool -= dt;
      if (this.cool <= 0) {
        this.state = 'TO_START';
        this.start = this._randomPoint();
        this._place(this.start);
        this._banner();
      }
    }
  }

  markerPos() {
    return this.state === 'TO_START' ? this.start : this.dest;
  }
}
