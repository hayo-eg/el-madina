import * as THREE from 'three';
import { CFG, clamp, fwd, roadCoord, span, collideCircleAABBs, angleLerp } from './config.js';
import { buildCity, drawMinimapBase } from './world.js';
import { Player } from './player.js';
import { TrafficCar, makeParked, makeCar } from './vehicles.js';
import { Controls } from './controls.js';
import { Missions } from './missions.js';
import { makeSky, makeEnvMap, HORIZON } from './sky.js';
import { NPCs } from './npc.js';
import { Radar } from './radar.js';
import { Police } from './police.js';
import { S, buildSettingsUI } from './settings.js';

const $ = id => document.getElementById(id);

// ---------- HUD ----------
const hud = {
  mission(t, sub) { $('missionText').innerHTML = t + (sub ? '<small>' + sub + '</small>' : ''); },
  timer(f) {
    const b = $('timerBar');
    if (f === null) { b.style.display = 'none'; return; }
    b.style.display = 'block';
    $('timerFill').style.width = (f * 100).toFixed(1) + '%';
  },
  cash(v) { $('cash').textContent = '💰 ' + v; },
};

// ---------- Audio (tiny WebAudio synth, no assets) ----------
const audio = {
  ctx: null, eng: null, engGain: null, vol: 0.8,
  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.eng = this.ctx.createOscillator();
    this.eng.type = 'sawtooth';
    this.engGain = this.ctx.createGain();
    this.engGain.gain.value = 0;
    const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 400;
    this.eng.connect(lp); lp.connect(this.engGain); this.engGain.connect(this.ctx.destination);
    this.eng.frequency.value = 50;
    this.eng.start();
  },
  tone(f, d, type = 'sine', v = 0.15, delay = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(v * this.vol * 1.25, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
    o.connect(g); g.connect(this.ctx.destination);
    o.start(t); o.stop(t + d + 0.02);
  },
  pickup() { this.tone(660, 0.12); this.tone(880, 0.18, 'sine', 0.15, 0.1); },
  success() { this.tone(523, 0.12); this.tone(659, 0.12, 'sine', 0.15, 0.1); this.tone(784, 0.25, 'sine', 0.15, 0.2); },
  fail() { this.tone(220, 0.3, 'square', 0.1); this.tone(160, 0.4, 'square', 0.1, 0.2); },
  shot(k) { this.tone(k === 2 ? 70 : 140, 0.09, 'sawtooth', 0.16); this.tone(900, 0.04, 'square', 0.05); },
  siren(on) {},
  bump() { this.tone(90, 0.12, 'square', 0.12); },
  engine(speed, driving) {
    if (!this.ctx) return;
    this.engGain.gain.value = driving ? (0.05 + Math.min(0.06, Math.abs(speed) / 600)) * this.vol * 1.25 : 0;
    this.eng.frequency.value = 45 + Math.abs(speed) * 3;
  },
};

// ---------- Renderer / scene ----------
const canvas = $('c');
const IS_TOUCH = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
const hadSaved = !!localStorage.getItem('madina_settings');
if (IS_TOUCH && !hadSaved) { S.npc = 'normal'; S.traffic = 'normal'; }
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
function applyPixelRatio() { renderer.setPixelRatio(S.hiRes ? Math.min(window.devicePixelRatio || 1, 2) : Math.min(window.devicePixelRatio || 1, 1.5)); }
applyPixelRatio();
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = !!S.shadows;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color(HORIZON);
scene.fog = new THREE.Fog(HORIZON, 110, 360);
scene.add(new THREE.HemisphereLight('#cfe6ff', '#b8a07a', 0.95));
const sun = new THREE.DirectionalLight('#fff0cf', 2.0);
const SUN_OFF = new THREE.Vector3(60, 100, 40);
sun.castShadow = !!S.shadows;
sun.shadow.mapSize.set(1024, 1024);
const sc = sun.shadow.camera; sc.left = -60; sc.right = 60; sc.top = 60; sc.bottom = -60; sc.near = 10; sc.far = 260;
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.6;
scene.add(sun); scene.add(sun.target);
const sky = makeSky(scene);
scene.environment = makeEnvMap(renderer);
scene.environmentIntensity = 0.9;

const camera = new THREE.PerspectiveCamera(62, 1, 0.5, 600);
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // keep the vertical field of view comfortable on very wide phones (~2.2:1)
  camera.userData.baseFov = w / h > 1.9 ? 56 : 62;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));
resize();

// ---------- World ----------
const city = buildCity(scene);
const colliders = city.colliders;
const controls = new Controls();
const START = { x: roadCoord(3), z: roadCoord(3) + (CFG.block + CFG.road) / 2 };
const player = new Player(scene, START.x, START.z);
player.heading = 0;

let parked = makeParked(scene, { count: CFG.parkedCount });
parked = parked.filter(c => {
  if (Math.hypot(c.x - player.x, c.z - player.z) < 45) { scene.remove(c.mesh); return false; }
  return true;
});
{
  const mesh = makeCar('#f1c40f', 'taxi');
  const sx = roadCoord(3) + 5.4, sz = player.z + 3;
  mesh.position.set(sx, 0, sz);
  scene.add(mesh);
  parked.push({ mesh, x: sx, z: sz, heading: 0, speed: 0, parked: true });
}

let traffic = [];
function spawnTraffic(i) {
  const bi = Math.floor(Math.random() * CFG.grid), bj = Math.floor(Math.random() * CFG.grid);
  return new TrafficCar(scene, bi, bj, Math.random() < 0.5, i);
}
const TRAFFIC_N = { low: 5, normal: 9, high: 15 };
function applyTraffic() {
  const n = TRAFFIC_N[S.traffic] || 9;
  while (traffic.length < n) traffic.push(spawnTraffic(traffic.length));
  while (traffic.length > n) { const t = traffic.pop(); scene.remove(t.mesh); }
}
applyTraffic();

const npcs = new NPCs(scene, 46);
const allNpcs = npcs.list.slice();
const NPC_N = { low: 14, normal: 28, high: 46 };
function applyNpc() {
  const n = NPC_N[S.npc] || 28;
  npcs.list = allNpcs.slice(0, n);
  allNpcs.forEach((p, i) => { if (i >= n) p.mesh.visible = false; });
}
applyNpc();

const missions = new Missions(scene, hud, audio);
const police = new Police(scene, colliders);
const radar = new Radar($('minimap'), $('pmCanvas'), city.emptyBlocks);

// ---------- State ----------
let car = null;
let camYaw = 0, camPitch = 0.5, camOff = 0;
let started = false, paused = false;
let crashCool = 0;
let hp = 100, hurtCool = 0, lastHurt = -99;
let stars = 0, evade = 0, bust = 0, banTimer = 0, dead = 0;
let gameT = 0, frames = 0;
const focus = { x: player.x, z: player.z };

// ---------- Weapons ----------
const WEAPONS = [
  { name: 'بدون سلاح', mag: 0 },
  { name: 'مسدس', mag: 12, cd: 0.28, dmg: 30, range: 62, pellets: 1, spread: 0.012, auto: false, kind: 1, len: 0.28 },
  { name: 'رشاش خفيف', mag: 30, cd: 0.085, dmg: 13, range: 52, pellets: 1, spread: 0.045, auto: true, kind: 1, len: 0.5 },
  { name: 'خرطوش', mag: 6, cd: 0.85, dmg: 22, range: 30, pellets: 6, spread: 0.11, auto: false, kind: 2, len: 0.7 },
];
const wState = WEAPONS.map(w => ({ ammo: w.mag, reload: 0 }));
let cur = 0, fireCool = 0, aimT = 0, aimYaw = 0;
const gunGroup = new THREE.Group();
{
  const dark = new THREE.MeshLambertMaterial({ color: '#23262b' });
  WEAPONS.forEach((w, i) => {
    if (!i) return;
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.12, w.len), dark); body.position.z = w.len / 2; g.add(body);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.08), dark); grip.position.set(0, -0.12, 0.08); g.add(grip);
    if (i === 2) { const mg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.2, 0.07), dark); mg.position.set(0, -0.14, 0.3); g.add(mg); }
    g.visible = false; gunGroup.add(g); gunGroup.userData[i] = g;
  });
  gunGroup.position.set(0.26, 1.18, 0.28);
  player.mesh.add(gunGroup);
}
const sparks = [];
const sparkGeo = new THREE.SphereGeometry(0.16, 6, 4);
function spark(x, y, z, color = '#ffd36b') {
  const m = new THREE.Mesh(sparkGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 }));
  m.position.set(x, y, z); scene.add(m); sparks.push({ m, t: 0.18 });
}
function updateSparks(dt) {
  for (let i = sparks.length - 1; i >= 0; i--) {
    const s = sparks[i]; s.t -= dt; s.m.scale.setScalar(1 + (0.18 - s.t) * 8); s.m.material.opacity = Math.max(0, s.t / 0.18);
    if (s.t <= 0) { scene.remove(s.m); s.m.material.dispose(); sparks.splice(i, 1); }
  }
}
function setWeapon(i) {
  cur = clamp(i, 0, WEAPONS.length - 1);
  gunGroup.children.forEach(g => g.visible = false);
  if (cur && gunGroup.userData[cur]) gunGroup.userData[cur].visible = !car;
  refreshWeaponHud();
}
function refreshWeaponHud() {
  const w = WEAPONS[cur], el = $('weaponHud');
  el.style.display = 'block';
  $('wName').textContent = w.name;
  $('wAmmo').textContent = cur ? (wState[cur].reload > 0 ? 'جاري التعمير...' : wState[cur].ammo + ' / ∞') : 'اضغط Q أو سلاح';
  $('cross').style.display = (cur && !car) ? 'block' : 'none';
  $('btnFire').style.display = (cur && !car) ? 'flex' : 'none';
}
function wantStars(n) {
  n = clamp(n, 0, 5);
  if (n > stars) { stars = n; evade = 0; if (n === 1) banner('مطلوب ★', '#ffd23f'); }
  refreshStars();
}
function refreshStars() {
  const el = $('stars');
  [...el.children].forEach((c, i) => c.classList.toggle('on', i < stars));
  el.classList.toggle('flash', stars > 0);
}
function banner(text, color = '#fff', ms = 1800) {
  const b = $('banner'); b.textContent = text; b.style.color = color; b.style.display = 'block';
  clearTimeout(banner._t); banner._t = setTimeout(() => { b.style.display = 'none'; }, ms);
}
function aimDirection() {
  // direction from player: camera forward, optionally snapped to the nearest target (auto aim)
  let yaw = camYaw;
  if (S.autoAim) {
    let best = null, bd = 99;
    const cand = police.officers.filter(o => o.hp > 0).concat(police.cars.filter(c => c.hp > 0));
    for (const t of cand) {
      const dx = t.x - player.x, dz = t.z - player.z, d = Math.hypot(dx, dz);
      if (d > 55) continue;
      let da = Math.atan2(dx, dz) - camYaw; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
      if (Math.abs(da) < 0.4 && d < bd) { bd = d; best = Math.atan2(dx, dz); }
    }
    if (best !== null) yaw = best;
  }
  return yaw;
}
function shoot() {
  const w = WEAPONS[cur], ws = wState[cur];
  if (!cur || car || ws.reload > 0 || fireCool > 0) return;
  if (ws.ammo <= 0) { startReload(); return; }
  ws.ammo--; fireCool = w.cd;
  const yaw = aimDirection(); aimYaw = yaw; aimT = 0.7;
  const ox = player.x + Math.sin(yaw) * 0.6, oz = player.z + Math.cos(yaw) * 0.6;
  audio.shot(w.kind);
  for (let p = 0; p < w.pellets; p++) {
    const a = yaw + (Math.random() - 0.5) * 2 * w.spread;
    const dx = Math.sin(a), dz = Math.cos(a);
    const t = police.target(ox, oz, dx, dz, w.range, npcs.list);
    const dist = t ? t.dist : w.range;
    police.tracer(ox, 1.25, oz, ox + dx * dist, 1.1, oz + dz * dist);
    if (t) {
      spark(ox + dx * dist, 1.1, oz + dz * dist);
      if (t.kind === 'npc') { t.obj.down = 2.6; wantStars(Math.max(stars, 1)); }
      else if (t.kind === 'officer') { t.obj.hp -= w.dmg; wantStars(Math.max(stars, 2)); if (t.obj.hp <= 0) wantStars(stars + 1); }
      else if (t.kind === 'pcar') { t.obj.hp -= w.dmg; wantStars(Math.max(stars, 2)); }
    }
  }
  const f = fwd(yaw); player.heading = yaw; player.syncMesh();
  if (ws.ammo <= 0) startReload();
  refreshWeaponHud();
}
function startReload() {
  const ws = wState[cur];
  if (!cur || ws.reload > 0 || ws.ammo >= WEAPONS[cur].mag) return;
  ws.reload = cur === 3 ? 1.6 : 1.2; refreshWeaponHud();
}
function updateWeapons(dt) {
  fireCool -= dt; aimT -= dt;
  const ws = wState[cur];
  if (cur && ws.reload > 0) { ws.reload -= dt; if (ws.reload <= 0) { ws.ammo = WEAPONS[cur].mag; refreshWeaponHud(); } }
}

// ---------- Player damage / respawn ----------
function hurt(n) {
  if (dead > 0 || n <= 0) return;
  hp -= n; lastHurt = gameT;
  document.body.classList.add('hit'); setTimeout(() => document.body.classList.remove('hit'), 160);
  if (hp <= 0) { hp = 0; die('وقعت!', '#ff6b6b', 0.1); }
}
function die(text, color, pct) {
  dead = 2.8;
  banner(text, color, 2600);
  const lost = Math.floor(missions.cash * pct);
  missions.cash -= lost; hud.cash(missions.cash);
}
function respawn() {
  police.clear(); stars = 0; evade = 0; bust = 0; refreshStars();
  hp = 100;
  if (car) {
    parked.push({ mesh: car.mesh, x: car.x, z: car.z, heading: car.heading, speed: 0, parked: true });
    car = null; player.setVisible(true); audio.engine(0, false);
  }
  player.x = START.x; player.z = START.z; player.syncMesh();
  focus.x = player.x; focus.z = player.z;
  camYaw = 0; setWeapon(cur);
}

// ---------- Cars ----------
function nearestCar() {
  let best = null, bd = 6.5;
  for (const c of parked.concat(traffic)) {
    if (c === car) continue;
    const d = Math.hypot(c.x - player.x, c.z - player.z);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}
function enterCar(c) {
  const ti = traffic.indexOf(c);
  if (ti >= 0) { traffic.splice(ti, 1); traffic.push(spawnTraffic(ti)); }
  const pi = parked.indexOf(c);
  if (pi >= 0) parked.splice(pi, 1);
  car = { mesh: c.mesh, x: c.x, z: c.z, heading: c.heading, speed: 0, steer: 0, vx: 0, vz: 0 };
  player.setVisible(false);
  camOff = 0; camYaw = car.heading; setWeapon(cur);
}
function exitCar() {
  if (!car) return;
  const side = fwd(car.heading + Math.PI / 2);
  player.x = car.x + side.x * 2.8; player.z = car.z + side.z * 2.8;
  player.heading = car.heading;
  const c = collideCircleAABBs(player.x, player.z, 0.55, colliders);
  player.x = c.x; player.z = c.z;
  player.setVisible(true);
  parked.push({ mesh: car.mesh, x: car.x, z: car.z, heading: car.heading, speed: 0, parked: true });
  car = null; audio.engine(0, false);
  camYaw = car ? camYaw : camYaw; setWeapon(cur);
}

function stepCar(dt) {
  const inp = controls.car();
  const arcade = S.handling === 'arcade';
  const f = fwd(car.heading), rx = f.z, rz = -f.x;
  let vl = car.vx * f.x + car.vz * f.z;
  let vt = car.vx * rx + car.vz * rz;
  // longitudinal
  if (inp.brake) {
    const d = CFG.carBrake * (arcade ? 1 : 0.85) * dt;
    vl = Math.abs(vl) <= d ? 0 : vl - Math.sign(vl) * d;
  } else if (inp.throttle > 0.05) {
    const pw = arcade ? 1.15 : Math.max(0.12, 1 - Math.max(0, vl) / (CFG.carMax * 1.06));
    vl += (vl < 0 ? CFG.carBrake : CFG.carAccel * 1.25 * pw) * inp.throttle * dt;
  } else if (inp.throttle < -0.05) {
    vl += (vl > 0 ? -CFG.carBrake * 0.9 : -CFG.carAccel * 0.55) * -inp.throttle * dt;
  } else {
    const d = (arcade ? 3.3 : 2.2 + Math.abs(vl) * 0.04) * dt;
    vl = Math.abs(vl) <= d ? 0 : vl - Math.sign(vl) * d;
  }
  vl = clamp(vl, -CFG.carRevMax, CFG.carMax);
  // steering (speed sensitive in realistic mode)
  const sm = CFG.steerMax * S.steer * (arcade ? 1 / (1 + Math.abs(vl) / 55) : 1 / (1 + Math.abs(vl) / 20));
  const target = clamp(inp.steer, -1, 1) * Math.min(sm, 0.8);
  car.steer += clamp(target - car.steer, -(arcade ? 4.5 : 3.2) * dt, (arcade ? 4.5 : 3.2) * dt);
  const grip = clamp(Math.abs(vl) / 5, 0, 1);
  car.heading += (vl / CFG.wheelBase) * Math.tan(car.steer) * dt * grip * (arcade ? 1.15 : 1);
  // lateral grip: handbrake lets the rear slide
  const k = inp.hand ? 1.1 : (arcade ? 11 : 6.5);
  vt *= Math.exp(-k * dt);
  if (inp.hand) vl *= Math.exp(-0.35 * dt);
  const f2 = fwd(car.heading), r2x = f2.z, r2z = -f2.x;
  // re-project old velocity into new heading so turning keeps momentum (that is what makes drifts)
  const wvx = f.x * vl + rx * vt, wvz = f.z * vl + rz * vt;
  car.vx = wvx; car.vz = wvz;
  let nl = car.vx * f2.x + car.vz * f2.z, nt = car.vx * r2x + car.vz * r2z;
  nt *= Math.exp(-k * 0.6 * dt);
  car.vx = f2.x * nl + r2x * nt; car.vz = f2.z * nl + r2z * nt;
  car.speed = nl;
  car.x += car.vx * dt; car.z += car.vz * dt;

  let hit = false;
  for (const off of [1.3, -1.3]) {
    const px = car.x + f2.x * off, pz = car.z + f2.z * off;
    const c = collideCircleAABBs(px, pz, 1.2, colliders);
    if (c.hit) { car.x += c.x - px; car.z += c.z - pz; hit = true; }
  }
  for (const o of parked.concat(traffic)) {
    const dx = car.x - o.x, dz = car.z - o.z, d = Math.hypot(dx, dz);
    if (d < 3.4 && d > 0.001) {
      const push = 3.4 - d;
      car.x += dx / d * push; car.z += dz / d * push;
      if (!o.parked) { o.speed = 0; o.stopTimer = 0.6; }
      hit = true;
    }
  }
  if (hit) {
    if (Math.abs(nl) > 6 && crashCool <= 0) { audio.bump(); crashCool = 0.4; if (Math.abs(nl) > 20) hurt(4); }
    car.vx *= 0.55; car.vz *= 0.55; car.speed *= 0.55;
  }
  car.x = clamp(car.x, -CFG.bounds, CFG.bounds);
  car.z = clamp(car.z, -CFG.bounds, CFG.bounds);

  const braking = inp.brake || (inp.throttle < -0.05 && nl > 1);
  for (const t of car.mesh.userData.tails || []) t.material.color.set(braking ? '#ff2a2a' : '#8a1111');
  if (Math.abs(nt) > 4.5 || (inp.brake && Math.abs(nl) > 12) || (inp.throttle > 0.5 && nl < 4 && nl > 0.2)) emitSmoke(car, 2);
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
  // body roll in corners
  car.mesh.rotation.z += ((-car.steer * clamp(nl / 40, 0, 1) * 0.06) - car.mesh.rotation.z) * Math.min(1, dt * 6);
  for (const w of car.mesh.userData.wheels) w.rotation.x += nl * dt / 0.42;
  car.mesh.userData.wheels[0].rotation.y = car.steer;
  car.mesh.userData.wheels[1].rotation.y = car.steer;
  if (controls.resetPressed()) { car.vx = car.vz = car.speed = 0; }
}

function puffTex() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
const PN = 48;
const pGeo = new THREE.BufferGeometry();
const pPos = new Float32Array(PN * 3), pLife = new Float32Array(PN);
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
const pPts = new THREE.Points(pGeo, new THREE.PointsMaterial({ map: puffTex(), color: '#e4e4e4', size: 2.6, transparent: true, opacity: 0.4, depthWrite: false }));
pPts.frustumCulled = false; scene.add(pPts);
let pIdx = 0;
for (let i = 0; i < PN; i++) pPos[i * 3 + 1] = -50;
function emitSmoke(c, n) {
  const f = fwd(c.heading);
  for (let i = 0; i < n; i++) {
    const k = pIdx++ % PN;
    pPos[k * 3] = c.x - f.x * 1.8 + (Math.random() - 0.5) * 1.6;
    pPos[k * 3 + 1] = 0.5; pPos[k * 3 + 2] = c.z - f.z * 1.8 + (Math.random() - 0.5) * 1.6;
    pLife[k] = 1;
  }
}
function updateSmoke(dt) {
  for (let i = 0; i < PN; i++) {
    if (pLife[i] > 0) { pLife[i] -= dt * 1.6; pPos[i * 3 + 1] += dt * 1.2; if (pLife[i] <= 0) pPos[i * 3 + 1] = -50; }
  }
  pGeo.attributes.position.needsUpdate = true;
}

// ---------- Camera (free orbit) ----------
function updateCamera(dt) {
  const L = controls.look();
  if (!paused) {
    const sens = 0.0062;
    if (car) {
      camOff -= L.x * sens;
      camPitch = clamp(camPitch + L.y * 0.0045, 0.12, 1.1);
      if (controls.lookIdle(performance.now() / 1000) > 2.2) camOff *= Math.exp(-2.2 * dt);
      camOff = clamp(camOff, -Math.PI, Math.PI);
      camYaw = angleLerp(camYaw, car.heading + camOff, 1 - Math.exp(-5 * dt));
    } else {
      camYaw -= L.x * sens;
      camPitch = clamp(camPitch + L.y * 0.0045, 0.1, 1.15);
    }
  }
  const tx = car ? car.x : player.x, tz = car ? car.z : player.z;
  const fk = 1 - Math.exp(-(car ? 14 : 12) * dt);
  focus.x += (tx - focus.x) * fk; focus.z += (tz - focus.z) * fk;
  const dist = (car ? 9.5 + Math.abs(car.speed) * 0.07 : 8.2) * S.camDist;
  const cp = Math.cos(camPitch), sp = Math.sin(camPitch);
  const fy = car ? 1.3 : 1.35;
  const wantY = Math.max(0.9, fy + sp * dist);
  camera.position.set(focus.x - Math.sin(camYaw) * cp * dist, wantY, focus.z - Math.cos(camYaw) * cp * dist);
  const ahead = car ? 4 : 2.5;
  camera.lookAt(focus.x + Math.sin(camYaw) * ahead, fy, focus.z + Math.cos(camYaw) * ahead);
}

// ---------- HUD / overlays ----------
let mapT = 0;
function radarInfo() {
  return {
    x: car ? car.x : player.x, z: car ? car.z : player.z, heading: camYaw,
    marker: missions.markerPos(), police: police.blips(),
  };
}
function openOverlay(id, on) {
  $(id).style.display = on ? 'flex' : 'none';
  paused = $('settings').style.display === 'flex' || $('pauseMap').style.display === 'flex';
  if (on && id === 'pauseMap') { const i = radarInfo(); i.heading = car ? car.heading : player.heading; radar.drawPause(i, gameT); }
}
$('btnGear').addEventListener('click', () => openOverlay('settings', true));
$('setClose').addEventListener('click', () => openOverlay('settings', false));
$('pmClose').addEventListener('click', () => openOverlay('pauseMap', false));
$('mapWrap').addEventListener('pointerdown', e => { e.preventDefault(); if (started) openOverlay('pauseMap', true); });
$('btnFull').addEventListener('click', () => {
  const d = document, el = d.documentElement;
  if (d.fullscreenElement || d.webkitFullscreenElement) { (d.exitFullscreen || d.webkitExitFullscreen).call(d); return; }
  const rq = el.requestFullscreen || el.webkitRequestFullscreen;
  if (rq) Promise.resolve(rq.call(el)).then(() => { try { screen.orientation.lock('landscape').catch(() => {}); } catch (e) {} }).catch(() => {});
  else banner('الشاشة الكاملة مش مدعومة هنا', '#fff', 1500);
});
buildSettingsUI(key => {
  if (key === 'shadows') { renderer.shadowMap.enabled = !!S.shadows; sun.castShadow = !!S.shadows; scene.traverse(o => { if (o.material) o.material.needsUpdate = true; }); perfDone = true; }
  if (key === 'hiRes') applyPixelRatio();
  if (key === 'volume') audio.vol = S.volume;
  if (key === 'npc') applyNpc();
  if (key === 'traffic') applyTraffic();
  if (key === 'kmh') $('spUnit').textContent = S.kmh ? 'كم/س' : 'ميل/س';
});
audio.vol = S.volume;
$('spUnit').textContent = S.kmh ? 'كم/س' : 'ميل/س';

// ---------- Main loop ----------
let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  let dt = (now - last) / 1000; last = now;
  dt = Math.min(dt, 0.05);
  frames++;
  if (controls.pressed('map') && started) openOverlay('pauseMap', $('pauseMap').style.display !== 'flex');
  if (controls.pressed('settings') && started) openOverlay('settings', $('settings').style.display !== 'flex');
  if (controls.pressed('esc')) { openOverlay('settings', false); openOverlay('pauseMap', false); }

  if (started && !paused) {
    gameT += dt; crashCool -= dt;
    const px = car ? car.x : player.x, pz = car ? car.z : player.z;
    if (dead > 0) {
      dead -= dt; if (dead <= 0) respawn();
    } else {
      // weapon keys
      if (controls.pressed('weapon')) setWeapon((cur + 1) % WEAPONS.length);
      for (let i = 0; i < 4; i++) if (controls.pressed('w' + i)) setWeapon(i);
      if (controls.pressed('reload')) startReload();
      if (car) {
        stepCar(dt);
        if (controls.actionPressed()) exitCar();
      } else {
        const f = controls.foot();
        const sy = Math.sin(camYaw), cy = Math.cos(camYaw);
        player.update(dt, f.z * sy - f.x * cy, f.z * cy + f.x * sy, colliders);
        if (controls.actionPressed()) { const c = nearestCar(); if (c) enterCar(c); }
        if (cur && controls.fire() && (WEAPONS[cur].auto || !shoot._held)) shoot();
        shoot._held = controls.fire();
        if (aimT > 0 && cur) { player.heading = aimYaw; player.syncMesh(); }
      }
      updateWeapons(dt);
    }

    const P = { x: car ? car.x : player.x, z: car ? car.z : player.z, car, onFoot: !car };
    npcs.update(dt, car, P.x, P.z);
    for (const n of npcs.list) {
      if (n.down > 2.4 && !n.flag) { n.flag = true; if (car && Math.abs(car.speed) > 5) wantStars(Math.max(stars, 1)); }
      if (n.down <= 0) n.flag = false;
    }
    for (const t of traffic) t.update(dt, traffic, P.x, P.z, car);
    missions.update(dt, P.x, P.z, !!car);

    // police
    const out = police.update(dt, P, stars, S.police);
    if (out.hurt && dead <= 0) hurt(out.hurt);
    if (out.bump) audio.bump();
    if (stars > 0 && dead <= 0) {
      const close = out.nearCar < 48 || police.officers.some(o => o.hp > 0 && Math.hypot(o.x - P.x, o.z - P.z) < 48);
      if (close) evade = 0; else evade += dt;
      if (evade > 11) { evade = 0; stars--; refreshStars(); if (stars === 0) { banner('هربت من البوليس!', '#7ee787'); police.clear(); } }
      // busted: stopped next to a police car
      const stopped = car ? Math.abs(car.speed) < 3 : player.moving < 0.1;
      const nearCop = police.cars.some(c => c.hp > 0 && Math.hypot(c.x - P.x, c.z - P.z) < 6.5);
      if (stopped && nearCop && car) bust += dt; else bust = Math.max(0, bust - dt * 2);
      if (bust > 2.4) { bust = 0; die('اتقبض عليك!', '#6fa8ff', 0.15); }
    }
    if (stars === 0 && gameT - lastHurt > 6 && hp < 100 && dead <= 0) hp = Math.min(100, hp + 3 * dt);
    $('hpFill').style.width = hp.toFixed(0) + '%';

    // prompts
    const near = !car ? nearestCar() : null;
    const pr = $('prompt');
    if (near) { pr.style.display = 'block'; pr.textContent = IS_TOUCH ? 'اضغط "اركب"' : 'اضغط E لركوب العربية'; } else pr.style.display = 'none';
    $('btnAction').style.display = (near || car) ? 'flex' : 'none';
    $('btnAction').textContent = car ? 'انزل' : 'اركب';
    $('btnBrake').style.display = car ? 'flex' : 'none';
    $('btnWeapon').style.display = car ? 'none' : 'flex';
    $('speed').style.display = car ? 'block' : 'none';
    if (car) $('speed').firstChild.nodeValue = Math.round(Math.abs(car.speed) * (S.kmh ? 3.6 : 2.237)) + ' ';
    audio.engine(car ? car.speed : 0, !!car && dead <= 0);
    if (frames % 2 === 0) radar.draw(radarInfo(), gameT);
    else if (frames % 2 === 1 && frames < 3) radar.draw(radarInfo(), gameT);
  }

  updateCamera(dt);
  if (!paused) { updateSmoke(dt); updateSparks(dt); }
  sky.update(dt, camera.position);
  { const fx = car ? car.x : player.x, fz = car ? car.z : player.z;
    sun.target.position.set(fx, 0, fz); sun.position.set(fx + SUN_OFF.x, SUN_OFF.y, fz + SUN_OFF.z); }
  { const base = camera.userData.baseFov || 62; const tf = car ? base + Math.min(14, Math.abs(car.speed) * 0.35) : base; camera.fov += (tf - camera.fov) * 0.08; camera.updateProjectionMatrix(); }
  perfCheck(dt);
  renderer.render(scene, camera);
}

let perfT = 0, perfN = 0, perfDone = false;
const FORCE = /shadows=on/.test(location.search);
function perfCheck(dt) {
  if (perfDone || FORCE || !started) return;
  perfT += dt; perfN++;
  if (perfT > 3) {
    perfDone = true;
    if (perfN / perfT < 28) {
      renderer.shadowMap.enabled = false; sun.castShadow = false; renderer.setPixelRatio(1);
      scene.traverse(o => { if (o.material) o.material.needsUpdate = true; });
      window.__lowQuality = true;
    }
  }
}
camera.position.set(player.x, 7.5, player.z - 11);
requestAnimationFrame(loop);
radar.draw(radarInfo(), 0);
refreshStars(); refreshWeaponHud(); setWeapon(0);

$('startBtn').addEventListener('click', () => {
  audio.init();
  if (audio.ctx && audio.ctx.state === 'suspended') audio.ctx.resume();
  $('start').style.display = 'none';
  started = true;
  missions._banner();
});
hud.mission('جاهز؟ اضغط ابدأ اللعب', '');

// debug/test hooks
window.__game = {
  get state() { return { x: car ? car.x : player.x, z: car ? car.z : player.z, inCar: !!car, speed: car ? car.speed : 0, cash: missions.cash, mission: missions.state, frames, hp, stars, weapon: cur, ammo: wState[cur].ammo, camYaw, camPitch, police: police.cars.length, officers: police.officers.length, dead }; },
  enterNearest() { const c = nearestCar(); if (c) enterCar(c); return !!c; },
  teleportToMarker() { const m = missions.markerPos(); if (m) { if (car) { car.x = m.x; car.z = m.z; } else { player.x = m.x; player.z = m.z; } } },
  showcase() {
    const types = ['sedan', 'taxi', 'suv', 'sports', 'pickup', 'microbus', 'hatch'];
    const cols = ['#c0392b', '#f2c200', '#2c3e50', '#e67e22', '#27ae60', '#ecf0f1', '#8e44ad'];
    types.forEach((t, i) => { const m = makeCar(cols[i], t); m.position.set(player.x - 15 + i * 5, 0, player.z + 16); m.rotation.y = 2.5; scene.add(m); });
  },
  toNpc(d = 8, i = 0) { const n = npcs.list[i]; player.x = n.x - 2; player.z = n.z - d; return [n.x, n.z]; },
  lineup() { npcs.list.slice(0, 8).forEach((n, i) => { n.x = player.x - 7 + i * 2; n.z = player.z + 6; n.heading = Math.PI; n.idle = 99; n.mesh.position.set(n.x, 0.34, n.z); n.mesh.rotation.y = Math.PI; }); },
  setStars(n) { stars = 0; wantStars(n); },
  setWeapon, police, openOverlay, shoot, setCam(y, p) { camYaw = y; camPitch = p; },
  traffic, parked, scene, camera,
};
