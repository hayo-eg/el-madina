import * as THREE from 'three';
import { CFG, clamp, fwd, roadCoord, span, collideCircleAABBs, angleLerp } from './config.js';
import { buildCity, drawMinimapBase } from './world.js';
import { Player } from './player.js';
import { TrafficCar, makeParked, makeCar } from './vehicles.js';
import { Controls } from './controls.js';
import { Missions } from './missions.js';

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
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
const scene = new THREE.Scene();
const SKY = '#9fd0f0';
scene.background = new THREE.Color(SKY);
scene.fog = new THREE.Fog(SKY, 90, 330);
scene.add(new THREE.HemisphereLight('#ffffff', '#b8a07a', 1.05));
const sun = new THREE.DirectionalLight('#fff3d6', 1.3);
sun.position.set(80, 140, 50);
scene.add(sun);

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
  const mesh = makeCar('#f1c40f');
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
  drawMini();
  renderer.render(scene, camera);
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
  traffic, parked, scene, camera,
};
