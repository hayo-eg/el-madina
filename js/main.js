import * as THREE from 'three';
import { CFG, clamp, fwd, roadCoord, span, collideCircleAABBs, angleLerp } from './config.js';
import { buildCity, drawMinimapBase } from './world.js';
import { Player } from './player.js';
import { TrafficCar, makeParked, makeCar } from './vehicles.js';
import { Controls } from './controls.js';
import { Missions } from './missions.js';
import { makeSky, makeEnvMap, HORIZON } from './sky.js';
import { NPCs } from './npc.js';

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
  ctx: null, eng: null, engGain: null,
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
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
    o.connect(g); g.connect(this.ctx.destination);
    o.start(t); o.stop(t + d + 0.02);
  },
  pickup() { this.tone(660, 0.12); this.tone(880, 0.18, 'sine', 0.15, 0.1); },
  success() { this.tone(523, 0.12); this.tone(659, 0.12, 'sine', 0.15, 0.1); this.tone(784, 0.25, 'sine', 0.15, 0.2); },
  fail() { this.tone(220, 0.3, 'square', 0.1); this.tone(160, 0.4, 'square', 0.1, 0.2); },
  bump() { this.tone(90, 0.12, 'square', 0.12); },
  engine(speed, driving) {
    if (!this.ctx) return;
    this.engGain.gain.value = driving ? 0.05 + Math.min(0.06, speed / 600) : 0;
    this.eng.frequency.value = 45 + Math.abs(speed) * 3;
  },
};

// ---------- Renderer / scene ----------
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color(HORIZON);
scene.fog = new THREE.Fog(HORIZON, 110, 360);
scene.add(new THREE.HemisphereLight('#cfe6ff', '#b8a07a', 0.95));
const sun = new THREE.DirectionalLight('#fff0cf', 2.0);
const SUN_OFF = new THREE.Vector3(60, 100, 40);
sun.castShadow = true;
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
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// ---------- World ----------
const city = buildCity(scene);
const colliders = city.colliders;
const controls = new Controls();
const player = new Player(scene, roadCoord(3), roadCoord(3) + (CFG.block + CFG.road) / 2);
player.heading = 0;

let parked = makeParked(scene, { count: CFG.parkedCount });
parked = parked.filter(c => {
  if (Math.hypot(c.x - player.x, c.z - player.z) < 45) { scene.remove(c.mesh); return false; }
  return true;
});
// guaranteed starter car near the player
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
for (let i = 0; i < CFG.trafficCount; i++) traffic.push(spawnTraffic(i));

const npcs = new NPCs(scene, 26);
const missions = new Missions(scene, hud, audio);
const miniBase = drawMinimapBase(264);
const mini = $('minimap').getContext('2d');

// ---------- State ----------
let car = null;       // car the player is driving
let camYaw = 0;
let started = false;
let crashCool = 0;

function nearestCar() {
  let best = null, bd = 6.5;
  const all = parked.concat(traffic);
  for (const c of all) {
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
  car = { mesh: c.mesh, x: c.x, z: c.z, heading: c.heading, speed: 0, steer: 0 };
  player.setVisible(false);
  camYaw = car.heading;
}

function exitCar() {
  if (!car) return;
  const side = fwd(car.heading + Math.PI / 2);
  player.x = car.x + side.x * 2.8;
  player.z = car.z + side.z * 2.8;
  player.heading = car.heading;
  const c = collideCircleAABBs(player.x, player.z, 0.55, colliders);
  player.x = c.x; player.z = c.z;
  player.setVisible(true);
  parked.push({ mesh: car.mesh, x: car.x, z: car.z, heading: car.heading, speed: 0, parked: true });
  car = null;
  audio.engine(0, false);
}

function stepCar(dt) {
  const inp = controls.car();
  const sp = car.speed;
  if (inp.brake) {
    const d = CFG.carBrake * dt;
    car.speed = Math.abs(sp) <= d ? 0 : sp - Math.sign(sp) * d;
  } else if (inp.throttle > 0.05) {
    car.speed += (sp < 0 ? CFG.carBrake : CFG.carAccel) * inp.throttle * dt;
  } else if (inp.throttle < -0.05) {
    car.speed += (sp > 0 ? -CFG.carBrake : -CFG.carAccel * 0.6) * -inp.throttle * dt;
  } else {
    const d = CFG.carDrag * 6 * dt;
    car.speed = Math.abs(sp) <= d ? 0 : sp - Math.sign(sp) * d;
  }
  car.speed = clamp(car.speed, -CFG.carRevMax, CFG.carMax);

  const target = inp.steer * CFG.steerMax;
  car.steer += clamp(target - car.steer, -3.5 * dt, 3.5 * dt);
  const grip = clamp(Math.abs(car.speed) / 6, 0, 1);
  car.heading += (car.speed / CFG.wheelBase) * Math.tan(car.steer) * dt * 1.0 * grip;

  const f = fwd(car.heading);
  car.x += f.x * car.speed * dt;
  car.z += f.z * car.speed * dt;

  // building collisions (two circles along the body)
  let hit = false;
  for (const off of [1.3, -1.3]) {
    const px = car.x + f.x * off, pz = car.z + f.z * off;
    const c = collideCircleAABBs(px, pz, 1.2, colliders);
    if (c.hit) { car.x += c.x - px; car.z += c.z - pz; hit = true; }
  }
  // other cars
  const others = parked.concat(traffic);
  for (const o of others) {
    const dx = car.x - o.x, dz = car.z - o.z;
    const d = Math.hypot(dx, dz);
    if (d < 3.4 && d > 0.001) {
      const push = 3.4 - d;
      car.x += dx / d * push; car.z += dz / d * push;
      if (!o.parked) { o.speed = 0; o.stopTimer = 0.6; }
      hit = true;
    }
  }
  if (hit) {
    if (Math.abs(car.speed) > 6 && crashCool <= 0) { audio.bump(); crashCool = 0.4; }
    car.speed *= 0.55;
  }
  car.x = clamp(car.x, -CFG.bounds, CFG.bounds);
  car.z = clamp(car.z, -CFG.bounds, CFG.bounds);

  const braking = inp.brake || (inp.throttle < -0.05 && car.speed > 1);
  for (const t of car.mesh.userData.tails || []) t.material.color.set(braking ? '#ff2a2a' : '#8a1111');
  if ((inp.brake && Math.abs(car.speed) > 12) || (inp.throttle > 0.5 && car.speed < 4 && car.speed > 0.2)) emitSmoke(car, 2);
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
  for (const w of car.mesh.userData.wheels) w.rotation.x += car.speed * dt / 0.42;
  // front wheels visual steer
  car.mesh.userData.wheels[0].rotation.y = car.steer;
  car.mesh.userData.wheels[1].rotation.y = car.steer;

  if (controls.resetPressed()) {
    // flip/unstick: nudge to nearest road lane centre
    car.speed = 0;
  }
}

function puffTex() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
// tire smoke particles
const PN = 48;
const pGeo = new THREE.BufferGeometry();
const pPos = new Float32Array(PN * 3), pLife = new Float32Array(PN);
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
const pPts = new THREE.Points(pGeo, new THREE.PointsMaterial({ map: puffTex(), color: '#e4e4e4', size: 2.6, transparent: true, opacity: 0.4, depthWrite: false }));
pPts.frustumCulled = false;
scene.add(pPts);
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

function updateCamera(dt) {
  if (car) {
    camYaw = angleLerp(camYaw, car.heading, 1 - Math.exp(-4 * dt));
    const back = 9 + Math.abs(car.speed) * 0.08;
    const f = fwd(camYaw);
    const tx = car.x, tz = car.z;
    camera.position.x += (tx - f.x * back - camera.position.x) * (1 - Math.exp(-8 * dt));
    camera.position.z += (tz - f.z * back - camera.position.z) * (1 - Math.exp(-8 * dt));
    camera.position.y += (5.4 - camera.position.y) * (1 - Math.exp(-6 * dt));
    camera.lookAt(tx + f.x * 5, 1.2, tz + f.z * 5);
  } else {
    camYaw = angleLerp(camYaw, 0, 1 - Math.exp(-3 * dt));
    const tx = player.x, tz = player.z;
    camera.position.x += (tx - camera.position.x) * (1 - Math.exp(-8 * dt));
    camera.position.z += (tz - 11 - camera.position.z) * (1 - Math.exp(-8 * dt));
    camera.position.y += (7.5 - camera.position.y) * (1 - Math.exp(-6 * dt));
    camera.lookAt(tx, 1.2, tz + 3);
  }
}

function drawMini() {
  const S = span(), s = 264 / S;
  mini.drawImage(miniBase, 0, 0);
  const px = v => (v + S / 2) * s;
  const mp = missions.markerPos();
  if (mp) {
    mini.fillStyle = '#ffd166';
    mini.beginPath(); mini.arc(px(mp.x), px(mp.z), 8, 0, 7); mini.fill();
    mini.strokeStyle = '#000'; mini.lineWidth = 2; mini.stroke();
  }
  mini.fillStyle = '#5aa7ff';
  for (const t of traffic) { mini.fillRect(px(t.x) - 2, px(t.z) - 2, 4, 4); }
  const ex = car ? car.x : player.x, ez = car ? car.z : player.z;
  const eh = car ? car.heading : player.heading;
  mini.save();
  mini.translate(px(ex), px(ez));
  mini.rotate(-eh + Math.PI);
  mini.fillStyle = '#ff3b3b';
  mini.beginPath(); mini.moveTo(0, -9); mini.lineTo(6, 7); mini.lineTo(-6, 7); mini.closePath(); mini.fill();
  mini.restore();
}

// ---------- Main loop ----------
let last = performance.now();
let frames = 0;
function loop(now) {
  requestAnimationFrame(loop);
  let dt = (now - last) / 1000; last = now;
  dt = Math.min(dt, 0.05);
  frames++;
  crashCool -= dt;

  if (started) {
    if (car) {
      stepCar(dt);
      if (controls.actionPressed()) exitCar();
    } else {
      const f = controls.foot();
      player.update(dt, -f.x, f.z, colliders);
      if (controls.actionPressed()) {
        const c = nearestCar();
        if (c) enterCar(c);
      }
    }

    npcs.update(dt, car, car ? car.x : player.x, car ? car.z : player.z);
    for (const t of traffic) t.update(dt, traffic, car ? car.x : player.x, car ? car.z : player.z, car);
    missions.update(dt, car ? car.x : player.x, car ? car.z : player.z, !!car);

    // HUD bits
    const near = !car ? nearestCar() : null;
    const pr = $('prompt');
    if (near) { pr.style.display = 'block'; pr.textContent = 'اضغط E أو "اركب" لركوب العربية'; }
    else if (car) { pr.style.display = 'none'; }
    else pr.style.display = 'none';
    $('btnAction').style.display = (near || car) ? 'flex' : 'none';
    $('btnAction').textContent = car ? 'انزل' : 'اركب';
    $('btnBrake').style.display = car ? 'flex' : 'none';
    $('speed').style.display = car ? 'block' : 'none';
    if (car) $('speed').firstChild.nodeValue = Math.round(Math.abs(car.speed) * 3.6) + ' ';
    audio.engine(car ? car.speed : 0, !!car);
  }

  updateCamera(dt);
  updateSmoke(dt);
  sky.update(dt, camera.position);
  { const fx = car ? car.x : player.x, fz = car ? car.z : player.z;
    sun.target.position.set(fx, 0, fz); sun.position.set(fx + SUN_OFF.x, SUN_OFF.y, fz + SUN_OFF.z); }
  { const tf = car ? 62 + Math.min(14, Math.abs(car.speed) * 0.35) : 62; camera.fov += (tf - camera.fov) * 0.08; camera.updateProjectionMatrix(); }
  perfCheck(dt);
  drawMini();
  renderer.render(scene, camera);
}

// adaptive quality: drop shadows if the device is struggling (skip with ?shadows=on)
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
  get state() { return { x: car ? car.x : player.x, z: car ? car.z : player.z, inCar: !!car, speed: car ? car.speed : 0, cash: missions.cash, mission: missions.state, frames }; },
  enterNearest() { const c = nearestCar(); if (c) enterCar(c); return !!c; },
  teleportToMarker() { const m = missions.markerPos(); if (m) { if (car) { car.x = m.x; car.z = m.z; } else { player.x = m.x; player.z = m.z; } } },
  showcase() {
    const types = ['sedan', 'taxi', 'suv', 'sports', 'pickup', 'microbus', 'hatch'];
    const cols = ['#c0392b', '#f2c200', '#2c3e50', '#e67e22', '#27ae60', '#ecf0f1', '#8e44ad'];
    types.forEach((t, i) => { const m = makeCar(cols[i], t); m.position.set(player.x - 15 + i * 5, 0, player.z + 16); m.rotation.y = 2.5; scene.add(m); });
  },
  toNpc(d = 8, i = 0) { const n = npcs.list[i]; player.x = n.x - 2; player.z = n.z - d; return [n.x, n.z]; },
  lineup() { npcs.list.slice(0, 8).forEach((n, i) => { n.x = player.x - 7 + i * 2; n.z = player.z + 6; n.heading = Math.PI; n.idle = 99; n.mesh.position.set(n.x, 0.34, n.z); n.mesh.rotation.y = Math.PI; }); },
  traffic, parked, scene, camera,
};
