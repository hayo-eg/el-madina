import * as THREE from 'three';
import { CFG, blockCoord, clamp } from './config.js';

function randPoint() {
  const k = Math.floor(Math.random() * CFG.grid), l = Math.floor(Math.random() * CFG.grid);
  const side = Math.floor(Math.random() * 4), c = CFG.block / 2 + 3.5;
  const bx = blockCoord(k), bz = blockCoord(l);
  return side === 0 ? { x: bx + c, z: bz } : side === 1 ? { x: bx - c, z: bz } : side === 2 ? { x: bx, z: bz + c } : { x: bx, z: bz - c };
}
function farPoint(from, min) { let p, g = 0; do { p = randPoint(); } while (Math.hypot(p.x - from.x, p.z - from.z) < min && g++ < 40); return p; }

export const JOB_DEFS = [
  { id: 'cargo', title: 'توصيل شحنة سرية 📦', desc: 'استلم الصندوق وسلّمه قبل ما الوقت يخلص. البوليس ممكن يشوفك.', reward: 700 },
  { id: 'steal', title: 'سرقة عربية مطلوبة 🚗', desc: 'اسرق العربية الحمرا الفخمة وودّيها للجراج. بوليس هيطاردك.', reward: 1000 },
];

export class Jobs {
  constructor(scene, hud, ctx) {
    this.scene = scene; this.hud = hud; this.ctx = ctx;
    this.active = null; this.done = ctx.saved.done || {};
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.8, 0.38, 10, 28), new THREE.MeshBasicMaterial({ color: '#ff5fa8' }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.5;
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 70, 14, 1, true), new THREE.MeshBasicMaterial({ color: '#ff5fa8', transparent: true, opacity: 0.25, fog: false, side: THREE.DoubleSide, depthWrite: false }));
    beam.position.y = 35;
    this.marker = new THREE.Group(); this.marker.add(ring, beam); this.marker.visible = false; this.ring = ring;
    scene.add(this.marker);
  }

  _mk(p, color) {
    this.marker.position.set(p.x, 0, p.z); this.marker.visible = true;
    this.marker.children.forEach(o => o.material.color.set(color));
    this.pt = p;
  }

  start(id, P) {
    if (this.active) return false;
    const def = JOB_DEFS.find(d => d.id === id); if (!def) return false;
    const a = this.active = { def, stage: 0, timer: 0, max: 1, id };
    if (id === 'cargo') {
      a.from = farPoint(P, 60); a.to = farPoint(a.from, 140);
      this._mk(a.from, '#ff9a3c'); this.hud.mission('📦 روح استلم الشحنة من العلامة', def.title);
    } else if (id === 'steal') {
      const p = farPoint(P, 80);
      a.car = this.ctx.spawnCar(p.x, p.z, '#d11f3c', 'sports');
      a.garage = farPoint(p, 150);
      this._mk(p, '#ff2b55'); this.hud.mission('🚗 اركب العربية الحمرا الفخمة', def.title);
    }
    this.ctx.banner('مهمة: ' + def.title, '#ffd166', 2200);
    return true;
  }

  cancel(msg) {
    if (!this.active) return;
    this.marker.visible = false; this.hud.timer(null);
    if (this.active.car) this.active.car.job = false;
    this.active = null;
    if (msg) this.ctx.banner(msg, '#ff6b6b', 2200);
    this.ctx.restore();
  }

  complete() {
    const a = this.active, d = a.def;
    this.done[d.id] = (this.done[d.id] || 0) + 1;
    this.marker.visible = false; this.hud.timer(null);
    this.ctx.addCash(d.reward);
    this.ctx.banner('نجحت! +' + d.reward + ' 💰', '#7ee787', 2600);
    this.active = null; this.ctx.audio.success(); this.ctx.restore(); this.ctx.save();
  }

  markerPos() { return this.active && this.marker.visible ? this.pt : null; }

  update(dt, P) {
    const a = this.active; if (!a) return;
    this.ring.scale.setScalar(1 + Math.sin(performance.now() / 250) * 0.12);
    if (a.timer > 0 || a.stage === 1 && a.max > 1) {
      a.timer -= dt; this.hud.timer(Math.max(0, a.timer / a.max));
      if (a.timer <= 0) { this.cancel('الوقت خلص! فشلت المهمة'); return; }
    }
    const d = Math.hypot(this.pt.x - P.x, this.pt.z - P.z);
    if (a.id === 'cargo') {
      if (a.stage === 0 && d < 4.5) {
        a.stage = 1; a.max = a.timer = Math.hypot(a.to.x - a.from.x, a.to.z - a.from.z) / 11 + 22;
        this._mk(a.to, '#7ee787'); this.hud.mission('📦 سلّم الشحنة قبل الوقت ما يخلص!', 'الشحنة معاك');
        this.ctx.wantStars(1); this.ctx.audio.pickup();
      } else if (a.stage === 1 && d < 4.5) this.complete();
    } else if (a.id === 'steal') {
      if (a.stage === 0) {
        const c = this.ctx.getCar();
        if (c && c.mesh === a.car.mesh) {
          a.stage = 1; a.max = a.timer = Math.hypot(a.garage.x - P.x, a.garage.z - P.z) / 13 + 30;
          this._mk(a.garage, '#7ee787'); this.hud.mission('🚨 وصّل العربية للجراج بسرعة!', 'البوليس وراك');
          this.ctx.wantStars(2); this.ctx.audio.pickup();
        } else { this.marker.position.set(a.car.x, 0, a.car.z); this.pt = { x: a.car.x, z: a.car.z }; }
      } else if (a.stage === 1) {
        const c = this.ctx.getCar();
        if (!c || c.mesh !== a.car.mesh) { this.hud.mission('ارجع للعربية المسروقة!', ''); }
        else if (d < 5) this.complete();
      }
    }
  }
}
