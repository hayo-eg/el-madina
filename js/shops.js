// Three shop buildings (barber, clothes, weapons) with door markers and an icon menu with a live hero preview.
import * as THREE from 'three';
import { CFG, blockCoord } from './config.js';
import { makePerson } from './npc.js';
import { HAIR, HAIRCOL, TOPS, PANTS, SHOES, GLASSES, HATS, DEFAULT_LOOK, lookOpts, loadLook, saveLook } from './customize.js';

const W = 13, D = 12, H = 5.8;
const WEAPONS_SOON = ['عصاية بيسبول', 'عتلة', 'ساطور', 'بلطة', 'بونية حديد', 'سكينة', 'مسدس', 'ريفولفر', 'مسدس تقيل', 'ميكرو رشاش', 'رشاش بكاتم', 'خرطوش', 'خرطوش مقطوع', 'بندقية آلية', 'قناصة'];

function paint(kind) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 240; const g = c.getContext('2d');
  const th = { barber: ['#2a1c14', '#ffcf66', 'الحلاق'], clothes: ['#1b2230', '#8ee3d0', 'محل الملابس'], weapons: ['#1d1d1a', '#ffb347', 'محل السلاح'] }[kind];
  g.fillStyle = kind === 'barber' ? '#6b4a38' : kind === 'clothes' ? '#59606b' : '#4d4a42'; g.fillRect(0, 0, 512, 240);
  for (let y = 0; y < 240; y += 14) for (let x = (y / 14 % 2) * 20; x < 512; x += 40) { g.fillStyle = 'rgba(0,0,0,.10)'; g.fillRect(x, y, 38, 12); }
  g.fillStyle = th[0]; g.fillRect(10, 8, 492, 66); g.strokeStyle = th[1]; g.lineWidth = 3; g.strokeRect(10, 8, 492, 66);
  g.fillStyle = th[1]; g.font = 'bold 46px Tahoma, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = 'rtl'; g.fillText(th[2], 256, 43);
  g.font = '34px Arial'; g.fillText(kind === 'barber' ? '✂' : kind === 'clothes' ? '👕' : '🔫', 458, 43); g.fillText(kind === 'barber' ? '💈' : kind === 'clothes' ? '👟' : '🛡', 54, 43);
  // awning
  for (let i = 0; i < 16; i++) { g.fillStyle = kind === 'barber' ? (i % 2 ? '#f4f1ea' : '#b8262a') : kind === 'clothes' ? (i % 2 ? '#2a3140' : '#11151c') : '#3b3a35'; g.beginPath(); g.moveTo(14 + i * 30.5, 82); g.lineTo(14 + (i + 1) * 30.5, 82); g.lineTo(18 + (i + 1) * 30.5, 108); g.lineTo(10 + i * 30.5, 108); g.fill(); }
  // windows and door
  for (const [x, w] of [[26, 190], [296, 190]]) {
    const gr = g.createLinearGradient(0, 118, 0, 228); gr.addColorStop(0, '#ffdca0'); gr.addColorStop(1, '#a8743a'); g.fillStyle = gr; g.fillRect(x, 118, w, 108);
    g.strokeStyle = '#1a1410'; g.lineWidth = 5; g.strokeRect(x, 118, w, 108);
    if (kind === 'barber') { for (const cx of [x + 55, x + 135]) { g.fillStyle = '#a83232'; g.fillRect(cx - 18, 168, 36, 30); g.fillRect(cx - 14, 146, 28, 24); g.fillStyle = '#ccc'; g.fillRect(cx - 4, 198, 8, 22); } g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(x + 12, 126, 40, 56); }
    if (kind === 'clothes') { for (const cx of [x + 55, x + 135]) { g.fillStyle = '#d9d2c4'; g.beginPath(); g.arc(cx, 146, 10, 0, 7); g.fill(); g.fillStyle = cx > x + 100 ? '#2e6fb5' : '#c0392b'; g.fillRect(cx - 18, 158, 36, 44); g.fillStyle = '#26314a'; g.fillRect(cx - 14, 202, 11, 22); g.fillRect(cx + 3, 202, 11, 22); } }
    if (kind === 'weapons') { g.strokeStyle = '#111'; g.lineWidth = 3; for (let k = 0; k < 9; k++) { g.beginPath(); g.moveTo(x + k * 24, 118); g.lineTo(x + k * 24, 226); g.stroke(); } g.fillStyle = '#222'; g.fillRect(x + 20, 160, 120, 12); g.fillRect(x + 30, 190, 80, 10); }
  }
  g.fillStyle = '#2b1d12'; g.fillRect(222, 114, 68, 122); g.fillStyle = 'rgba(190,225,240,.45)'; g.fillRect(230, 122, 52, 80); g.fillStyle = th[1]; g.beginPath(); g.arc(280, 178, 3, 0, 7); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function iconTex(ch) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.fillStyle = 'rgba(255,209,102,.95)'; g.beginPath(); g.arc(64, 64, 58, 0, 7); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 6; g.stroke();
  g.font = '64px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, 64, 70);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class Shops {
  constructor(scene, colliders, hooks) {
    this.h = hooks; this.open_ = false; this.list = []; this.marks = [];
    const cx = blockCoord(4), cz = blockCoord(3);
    const defs = [
      { id: 'barber', ch: '✂', x: cx - 14.5, tab: ['hair'] },
      { id: 'clothes', ch: '👕', x: cx, tab: ['top', 'pants', 'shoe', 'glasses', 'hat'] },
      { id: 'weapons', ch: '🔫', x: cx + 14.5, tab: ['soon'] },
    ];
    const wall = new THREE.MeshLambertMaterial({ color: '#8a7a68' });
    for (const d of defs) {
      const z = cz + 14;
      const tex = paint(d.id);
      const body = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), wall); body.position.set(d.x, H / 2 + 0.34, z); scene.add(body);
      const front = new THREE.Mesh(new THREE.PlaneGeometry(W, H * 0.98), new THREE.MeshLambertMaterial({ map: tex, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.35 }));
      front.position.set(d.x, H / 2 + 0.34, z + D / 2 + 0.03); scene.add(front);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(W + 0.6, 0.5, D + 0.6), new THREE.MeshLambertMaterial({ color: '#8f8c85' })); roof.position.set(d.x, H + 0.6, z); scene.add(roof);
      colliders.push({ minX: d.x - W / 2, maxX: d.x + W / 2, minZ: z - D / 2, maxZ: z + D / 2, h: H + 1 });
      if (d.id === 'barber') { const pc = document.createElement('canvas'); pc.width = 32; pc.height = 128; const g = pc.getContext('2d'); g.fillStyle = '#f4f1ea'; g.fillRect(0, 0, 32, 128); for (let k = -2; k < 8; k++) { g.fillStyle = k % 2 ? '#2e5fb5' : '#c0392b'; g.beginPath(); g.moveTo(0, k * 20 + 20); g.lineTo(32, k * 20); g.lineTo(32, k * 20 + 10); g.lineTo(0, k * 20 + 30); g.fill(); } const pt = new THREE.CanvasTexture(pc); const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.5, 12), new THREE.MeshLambertMaterial({ map: pt, emissive: '#444' })); pole.position.set(d.x + W / 2 - 0.5, 3.2, z + D / 2 + 0.3); scene.add(pole); }
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: iconTex(d.ch), depthTest: false, transparent: true })); sp.scale.set(1.6, 1.6, 1); sp.position.set(d.x, 3.2, z + D / 2 + 3.2); sp.renderOrder = 990; scene.add(sp);
      const ring = new THREE.Mesh(new THREE.RingGeometry(1.2, 1.7, 28), new THREE.MeshBasicMaterial({ color: '#ffd166', transparent: true, opacity: 0.85, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.set(d.x, 0.45, z + D / 2 + 3.2); scene.add(ring);
      this.marks.push(sp, ring);
      d.dx = d.x; d.dz = z + D / 2 + 3.2; this.list.push(d);
    }
    // back building so the block does not look empty
    const back = new THREE.Mesh(new THREE.BoxGeometry(42, 14, 14), wall); back.position.set(cx, 7.34, cz - 12); scene.add(back);
    colliders.push({ minX: cx - 21, maxX: cx + 21, minZ: cz - 19, maxZ: cz - 5, h: 15 });
    this.state = loadLook(); this.look = Object.assign({}, this.state.look); this.owned = new Set(this.state.owned);
    for (const k of ['top', 'pants', 'shoe', 'glasses', 'hat']) this.owned.add(this.look[k]); this.owned.add('fixed'); this.owned.add('g0'); this.owned.add('h0');
    this._ui(); this._preview();
  }

  near(x, z) { for (const d of this.list) if (Math.hypot(x - d.dx, z - d.dz) < 3.4) return d; return null; }
  get isOpen() { return this.open_; }

  _ui() {
    const st = document.createElement('style');
    st.textContent = '#shopOv{background:rgba(5,9,16,.35)} #shopOv .sp{display:flex;gap:10px;width:min(780px,97vw);height:min(86vh,430px);background:transparent;border-radius:16px;color:#fff}.sr{background:#141c2b;border:1px solid rgba(255,255,255,.18);border-radius:16px;padding-left:10px!important}#pvBox{border-radius:16px;overflow:hidden}#pvBox{flex:0 0 36%;background:transparent;position:relative}#pvBox small{position:absolute;bottom:6px;left:0;right:0;text-align:center;color:#9fb4d8;font-size:11px}.sr{flex:1;display:flex;flex-direction:column;padding:10px 10px 10px 0;min-width:0}.sr h3{display:flex;justify-content:space-between;align-items:center;color:#ffd166;font-size:18px;margin-bottom:6px}.stabs{display:flex;gap:5px;margin-bottom:6px;flex-wrap:wrap}.stabs button{background:#0e1420;color:#cfe3ff;border:1px solid rgba(255,255,255,.2);border-radius:9px;padding:5px 9px;font-family:inherit;font-size:13px}.stabs button.on{background:#ffd166;color:#111;font-weight:800}.sgrid{overflow:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:7px;flex:1;align-content:start}.si{background:#0e1420;border:2px solid rgba(255,255,255,.12);border-radius:11px;padding:6px;text-align:center;font-size:12px;cursor:pointer}.si.sel{border-color:#ffd166}.si.eq{border-color:#7ee787}.si i{display:block;width:34px;height:34px;border-radius:50%;margin:0 auto 4px;border:2px solid #fff3}.si b{display:block;font-size:12px}.si small{color:#9fb4d8}.sbuy{margin-top:6px;display:flex;gap:6px;align-items:center}.sbuy button{flex:1;background:#ffd166;color:#111;border:none;border-radius:10px;padding:9px;font-family:inherit;font-weight:800;font-size:15px}.sbuy button:disabled{background:#444;color:#999}.sbuy span{color:#ffd166;font-weight:800;min-width:70px;text-align:center}@media (orientation:portrait){#shopOv .sp{flex-direction:column;height:92vh}#pvBox{flex:0 0 34%}.sr{padding:0 10px 10px}}';
    document.head.appendChild(st);
    const ov = document.createElement('div'); ov.id = 'shopOv'; ov.className = 'ov';
    ov.innerHTML = '<div class="sp"><div id="pvBox"><small>اسحب للتدوير</small></div><div class="sr"><h3><span id="shT"></span><span><small id="shCash"></small> <button class="xbtn" id="shX">✕</button></span></h3><div class="stabs" id="shTabs"></div><div class="sgrid" id="shGrid"></div><div class="sbuy"><span id="shPrice"></span><button id="shBuy">اشتري والبس</button></div></div></div>';
    document.body.appendChild(ov);
    this.ov = ov; ov.querySelector('#shX').addEventListener('click', () => this.close());
    ov.querySelector('#shBuy').addEventListener('click', () => this._buy());
    const pv = ov.querySelector('#pvBox'); let dragX = null;
    pv.addEventListener('pointerdown', e => { dragX = e.clientX; pv.setPointerCapture(e.pointerId); });
    pv.addEventListener('pointermove', e => { if (dragX !== null && this.pvp) { this.pvp.rotation.y += (e.clientX - dragX) * 0.012; dragX = e.clientX; this.spin = 0; } });
    pv.addEventListener('pointerup', () => { dragX = null; });
  }
  _preview() {
    const sc = this.pvScene = new THREE.Scene(); sc.background = new THREE.Color('#2b3548');
    sc.add(new THREE.HemisphereLight('#ffffff', '#556', 1.25)); const dl = new THREE.DirectionalLight('#fff3dc', 1.5); dl.position.set(2, 4, 5); sc.add(dl);
    const fl = new THREE.Mesh(new THREE.CircleGeometry(1.1, 28), new THREE.MeshLambertMaterial({ color: '#46526a' })); fl.rotation.x = -Math.PI / 2; sc.add(fl);
    this.pvCam = new THREE.PerspectiveCamera(30, 1, 0.1, 50); this.pvp = null; this.spin = 1;
  }
  _setPreview() {
    if (this.pvp) this.pvScene.remove(this.pvp);
    const o = Object.assign({ role: 'hero' }, lookOpts(this.sel)); const p = makePerson(o);
    const U = p.userData; p.userData._still = true; this.pvp = p; this.pvScene.add(p); p.rotation.y = 0.5;
  }

  open(def) {
    this.def = def; this.open_ = true; this.sel = Object.assign({}, this.look);
    this.tab = def.tab[0]; this.ov.querySelector('#shT').textContent = { barber: '✂ الحلاق', clothes: '👕 محل الملابس', weapons: '🔫 محل السلاح' }[def.id];
    this.h.openOverlay('shopOv', true); this._render(); this._setPreview();
  }
  close() { if (!this.open_) return; this.open_ = false; this.h.openOverlay('shopOv', false); this.h.applyLook(lookOpts(this.look)); }

  _items(tab) { return { hair: HAIR, top: TOPS, pants: PANTS, shoe: SHOES, glasses: GLASSES, hat: HATS }[tab] || []; }
  _color(tab, it) {
    if (tab === 'hair') return HAIRCOL[this.sel.hairCol || 0];
    const o = it.o || {}; return o.top || o.bottom || o.shoe || o.glassColor || o.hatColor || o.pack || (it.id.endsWith('0') ? '#555' : '#8a8f99');
  }
  _render() {
    const tabs = this.ov.querySelector('#shTabs'), grid = this.ov.querySelector('#shGrid'); tabs.innerHTML = ''; grid.innerHTML = '';
    this.ov.querySelector('#shCash').textContent = '💰 ' + this.h.cash();
    const names = { hair: 'قصات', top: 'فوق', pants: 'بناطيل', shoe: 'جزم', glasses: 'نضارات', hat: 'طواقي', soon: 'الأسلحة' };
    if (this.def.tab.length > 1) for (const t of this.def.tab) { const b = document.createElement('button'); b.textContent = names[t]; b.className = t === this.tab ? 'on' : ''; b.onclick = () => { this.tab = t; this.pick = null; this._render(); }; tabs.appendChild(b); }
    if (this.tab === 'soon') {
      for (const n of WEAPONS_SOON) { const d = document.createElement('div'); d.className = 'si'; d.innerHTML = '<i style="background:#444"></i><b></b><small>قريباً</small>'; d.querySelector('b').textContent = n; grid.appendChild(d); }
      this.ov.querySelector('#shBuy').disabled = true; this.ov.querySelector('#shPrice').textContent = ''; return;
    }
    const key = this.tab, list = this._items(key);
    if (key === 'hair') { // hair colors row first
      const d = document.createElement('div'); d.style.cssText = 'grid-column:1/-1;display:flex;gap:8px;justify-content:center'; HAIRCOL.forEach((c, i) => { const s = document.createElement('i'); s.style.cssText = `width:26px;height:26px;border-radius:50%;background:${c};border:3px solid ${(this.sel.hairCol || 0) === i ? '#ffd166' : '#fff3'};cursor:pointer`; s.onclick = () => { this.sel.hairCol = i; this._setPreview(); this._render(); }; d.appendChild(s); }); grid.appendChild(d);
    }
    for (const it of list) {
      const own = this.owned.has(it.id) || it.p === 0, eq = this.look[key] === it.id, sel = this.sel[key] === it.id;
      const d = document.createElement('div'); d.className = 'si' + (sel ? ' sel' : '') + (eq ? ' eq' : '');
      d.innerHTML = '<i></i><b></b><small></small>'; d.querySelector('i').style.background = this._color(key, it);
      d.querySelector('b').textContent = it.n; d.querySelector('small').textContent = eq ? 'لابسه' : own ? 'عندك' : it.p + ' 💰';
      d.onclick = () => { this.sel[key] = it.id; this.pick = it; this._setPreview(); this._render(); };
      grid.appendChild(d);
    }
    const it = list.find(x => x.id === this.sel[key]) || list[0], own = this.owned.has(it.id) || it.p === 0, eq = this.look[key] === it.id;
    const buy = this.ov.querySelector('#shBuy');
    this.ov.querySelector('#shPrice').textContent = own ? '' : it.p + ' 💰';
    buy.textContent = eq ? 'لابسه' : own ? 'البس' : 'اشتري والبس'; buy.disabled = eq || (!own && this.h.cash() < it.p);
    this.curItem = it; this.curKey = key;
  }
  _buy() {
    const it = this.curItem, key = this.curKey; if (!it) return;
    const own = this.owned.has(it.id) || it.p === 0;
    if (!own) { if (this.h.cash() < it.p) { this.h.banner('الفلوس مش كفاية', '#ff6b6b', 1200); return; } this.h.spend(it.p); this.owned.add(it.id); }
    this.look = Object.assign({}, this.look, { [key]: it.id }); if (key === 'hair') this.look.hairCol = this.sel.hairCol || 0;
    saveLook(this.look, [...this.owned]); this.h.applyLook(lookOpts(this.look)); this.h.banner(own ? 'لبست ' + it.n : 'اشتريت ' + it.n, '#7ee787', 1300); this._render();
  }

  update(dt, t) { for (let i = 0; i < this.marks.length; i += 2) { this.marks[i].position.y = 3.2 + Math.sin(t * 2 + i) * 0.15; const s = 1 + Math.sin(t * 3 + i) * 0.06; this.marks[i + 1].scale.set(s, s, s); } }
  renderPreview(renderer, dt) {
    if (!this.open_ || !this.pvp) return;
    const r = this.ov.querySelector('#pvBox').getBoundingClientRect(); if (r.width < 8) return;
    if (this.spin) this.pvp.rotation.y += dt * 0.5;
    const c = this.pvCam; c.aspect = r.width / r.height; c.position.set(0, 1.0, 4.4); c.lookAt(0, 0.95, 0); c.updateProjectionMatrix();
    const key = this.tab; // focus the head for hair/glasses/hats
    if (key === 'hair' || key === 'glasses' || key === 'hat') { c.position.set(0, 1.62, 2.1); c.lookAt(0, 1.62, 0); }
    else if (key === 'shoe') { c.position.set(0, 0.45, 3.0); c.lookAt(0, 0.4, 0); }
    const U = this.pvp.userData; if (U.mixer) { U.mixer.update(dt); }
    const vp = new THREE.Vector4(); renderer.getViewport(vp); const was = renderer.autoClear;
    renderer.setScissorTest(true); renderer.setViewport(r.left, innerHeight - r.bottom, r.width, r.height); renderer.setScissor(r.left, innerHeight - r.bottom, r.width, r.height);
    renderer.clearDepth(); renderer.render(this.pvScene, c);
    renderer.setScissorTest(false); renderer.setViewport(vp);
  }
}
