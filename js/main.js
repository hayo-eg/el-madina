import * as THREE from 'three';
import { CFG, clamp, fwd, roadCoord, span, collideCircleAABBs, angleLerp } from './config.js';
import { buildCity, drawMinimapBase } from './world.js';
import { Player } from './player.js';
import { TrafficCar, makeParked, makeCar } from './vehicles.js';
import { Controls } from './controls.js';
import { Missions } from './missions.js';
import { makeSky, makeEnvMap, HORIZON } from './sky.js';
import { NPCs } from './npc.js';
import { initModels, Models } from './models.js';
import { lookOpts } from './customize.js';
import { Shops } from './shops.js';
import { Story, CHAPTER_TITLES } from './story.js';
import { Radar } from './radar.js';
import { Police } from './police.js';
import { Jobs, JOB_DEFS } from './jobs.js';
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
  cash(v) { $('cash').textContent = v + ' ج'; },
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
    this.fxInit();
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
  fxInit() {
    const c = this.ctx; if (!c || this.noise) return;
    const nb = c.createBuffer(1, c.sampleRate, c.sampleRate), d = nb.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.noise = nb;
    const len = Math.floor(c.sampleRate * 1.7), ib = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const x = ib.getChannelData(ch); for (let i = 0; i < len; i++) x[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.1); }
    this.rev = c.createConvolver(); this.rev.buffer = ib;
    const rg = c.createGain(); rg.gain.value = 0.42; this.rev.connect(rg); rg.connect(c.destination);
    // siren
    this.sir = c.createOscillator(); this.sir.type = 'triangle'; this.sirG = c.createGain(); this.sirG.gain.value = 0;
    const lfo = c.createOscillator(); lfo.frequency.value = 0.9; const lg = c.createGain(); lg.gain.value = 260;
    lfo.connect(lg); lg.connect(this.sir.frequency); this.sir.frequency.value = 820;
    this.sir.connect(this.sirG); this.sirG.connect(c.destination); this.sir.start(); lfo.start();
  },
  nb(t, dur, o) {
    const c = this.ctx; if (!c || !this.noise) return;
    const s = c.createBufferSource(); s.buffer = this.noise; s.loop = true;
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = o.hp || 20;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = o.lp || 12000;
    const g = c.createGain(); const v = (o.g || 0.5) * this.vol;
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    s.connect(hp); hp.connect(lp); lp.connect(g); g.connect(c.destination);
    if (o.rev) { const r = c.createGain(); r.gain.value = o.rev; g.connect(r); r.connect(this.rev); }
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  },
  th(t, f0, f1, dur, gain, type = 'sine') {
    const c = this.ctx; if (!c) return;
    const o = c.createOscillator(), g = c.createGain(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(gain * this.vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
  },
  shot(k) {
    const c = this.ctx; if (!c) return; this.fxInit();
    const t = c.currentTime, r = 0.92 + Math.random() * 0.16;
    if (k === 1) {        // pistol: sharp crack + mid body + short low thump + room tail
      this.nb(t, 0.05, { hp: 1800, lp: 11000, g: 0.9, rev: 0.5 });
      this.nb(t, 0.16, { hp: 250, lp: 2600 * r, g: 0.6, rev: 0.6 });
      this.th(t, 190 * r, 55, 0.14, 0.9);
      this.nb(t + 0.02, 0.55, { hp: 120, lp: 900, g: 0.22, rev: 1.2 });
    } else if (k === 2) { // SMG: tighter, higher, quick
      this.nb(t, 0.035, { hp: 2600, lp: 12000, g: 0.8, rev: 0.25 });
      this.nb(t, 0.09, { hp: 400, lp: 3500 * r, g: 0.5, rev: 0.3 });
      this.th(t, 260 * r, 95, 0.075, 0.65);
      this.nb(t + 0.01, 0.28, { hp: 200, lp: 1200, g: 0.12, rev: 0.7 });
    } else {              // shotgun: huge boom, long noise, deep thump, long tail
      this.nb(t, 0.09, { hp: 900, lp: 9000, g: 1.0, rev: 0.6 });
      this.nb(t, 0.32, { hp: 60, lp: 3200 * r, g: 0.95, rev: 0.9 });
      this.th(t, 120 * r, 30, 0.34, 1.25);
      this.nb(t + 0.03, 0.95, { hp: 60, lp: 700, g: 0.3, rev: 1.6 });
      this.th(t + 0.34, 2400, 1800, 0.03, 0.08, 'square'); // shell click later
    }
  },
  reload(k, dur) {
    const c = this.ctx; if (!c) return; this.fxInit();
    const t = c.currentTime;
    this.nb(t + 0.02, 0.03, { hp: 3000, lp: 8000, g: 0.5 }); this.th(t + 0.02, 1500, 700, 0.04, 0.2, 'square');
    this.nb(t + dur * 0.5, 0.05, { hp: 1200, lp: 5000, g: 0.35 }); this.th(t + dur * 0.5, 900, 400, 0.06, 0.18, 'square');
    this.nb(t + dur - 0.08, 0.04, { hp: 2500, lp: 9000, g: 0.55 }); this.th(t + dur - 0.08, 1800, 600, 0.05, 0.25, 'square');
    if (k === 3) { this.nb(t + dur * 0.75, 0.04, { hp: 2000, lp: 7000, g: 0.4 }); this.th(t + dur * 0.75, 1200, 500, 0.05, 0.2, 'square'); }
  },
  dry() { const c = this.ctx; if (!c) return; this.fxInit(); const t = c.currentTime; this.nb(t, 0.02, { hp: 3500, lp: 9000, g: 0.4 }); this.th(t, 1800, 900, 0.03, 0.15, 'square'); },
  punch() { const c = this.ctx; if (!c) return; this.fxInit(); const t = c.currentTime; this.nb(t, 0.07, { hp: 80, lp: 700, g: 0.7 }); this.th(t, 140, 55, 0.12, 0.7); },
  swing() { const c = this.ctx; if (!c) return; this.fxInit(); const t = c.currentTime; this.nb(t, 0.12, { hp: 600, lp: 2500, g: 0.12 }); },
  radio(on) {
    const c = this.ctx; if (!c) return; this.fxInit();
    if (!on) { this.musicOn = false; clearInterval(this.mTimer); return; }
    if (this.musicOn) return; this.musicOn = true;
    const bpm = 104, step = 60 / bpm / 4, R = [55, 43.65, 65.41, 49];            // A1 F1 C2 G1
    const chords = [[220, 261.63, 329.63], [174.61, 220, 261.63], [261.63, 329.63, 392], [196, 246.94, 293.66]];
    this.mStep = 0; this.mNext = c.currentTime + 0.1;
    const play = (t, n) => {
      const bar = Math.floor(n / 16) % 4, s = n % 16, v = this.vol * 0.55;
      const osc = (f, type, dur, g, lp) => { const o = c.createOscillator(), gg = c.createGain(), fl = c.createBiquadFilter(); o.type = type; o.frequency.value = f; fl.type = 'lowpass'; fl.frequency.value = lp; gg.gain.setValueAtTime(g * v, t); gg.gain.exponentialRampToValueAtTime(0.0008, t + dur); o.connect(fl); fl.connect(gg); gg.connect(c.destination); o.start(t); o.stop(t + dur + 0.02); };
      if (s % 2 === 0 || s % 4 === 3) osc(R[bar] * (s % 8 === 6 ? 2 : 1), 'sawtooth', step * 1.8, 0.16, 500);
      const ch = chords[bar]; const arp = [0, 1, 2, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2, 1, 2, 1][s];
      osc(ch[arp] * 2, 'square', step * 1.4, 0.06, 2600);
      if (s === 0) { for (const f of ch) osc(f, 'triangle', step * 15, 0.045, 1200); }
      if (s % 8 === 0) this.th(t, 130, 45, 0.18, 0.5 * v);
      if (s % 8 === 4) this.nb(t, 0.14, { hp: 1200, lp: 7000, g: 0.28 * v, rev: 0.25 });
      if (s % 2 === 0) this.nb(t, 0.03, { hp: 6000, lp: 12000, g: 0.1 * v });
    };
    this.mTimer = setInterval(() => {
      while (this.mNext < c.currentTime + 0.2) { play(this.mNext, this.mStep++); this.mNext += step; }
    }, 40);
  },
  siren(level) { if (!this.sirG) return; this.sirG.gain.value = level * 0.06 * this.vol; },
  bump() { this.tone(90, 0.12, 'square', 0.12); const c = this.ctx; if (c) { this.fxInit(); this.nb(c.currentTime, 0.18, { hp: 120, lp: 1800, g: 0.5, rev: 0.2 }); this.th(c.currentTime, 110, 45, 0.16, 0.6); } },
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
renderer.toneMappingExposure = 1.25;
renderer.shadowMap.enabled = !!S.shadows;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color(HORIZON);
scene.fog = new THREE.Fog(HORIZON, 110, 420);
scene.add(new THREE.HemisphereLight('#ffeede', '#76675c', 1.0));
const sun = new THREE.DirectionalLight('#ffd7ac', 1.8);
const SUN_OFF = new THREE.Vector3(55, 62, 95);
sun.castShadow = !!S.shadows;
sun.shadow.mapSize.set(1024, 1024);
const sc = sun.shadow.camera; sc.left = -60; sc.right = 60; sc.top = 60; sc.bottom = -60; sc.near = 10; sc.far = 260;
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.6;
scene.add(sun); scene.add(sun.target);
const sky = makeSky(scene);
scene.environment = makeEnvMap(renderer);
scene.environmentIntensity = 0.9;

const camera = new THREE.PerspectiveCamera(62, 1, 0.5, 1600);
function resize() {
  const vv = window.visualViewport;
  const w = Math.round(vv ? vv.width : window.innerWidth), h = Math.round(vv ? vv.height : window.innerHeight);
  document.documentElement.style.setProperty('--vh', (h / 100) + 'px');
  renderer.setSize(w, h, false);
  canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
  canvas.style.left = (vv ? vv.offsetLeft : 0) + 'px'; canvas.style.top = (vv ? vv.offsetTop : 0) + 'px'; canvas.style.right = 'auto'; canvas.style.bottom = 'auto';
  camera.aspect = w / h;
  // keep the vertical field of view comfortable on very wide phones (~2.2:1)
  { const a = w / h; camera.userData.baseFov = clamp(2 * Math.atan(Math.tan(40 * Math.PI / 180) / a) * 180 / Math.PI, 38, 62); }
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));
resize();

// ---------- World ----------
window.__models = Models;
window.__loadModels = () => { if (window.__modelsP) return window.__modelsP; return window.__modelsP = initModels(window.GAME_VERSION || '0').then(() => { if (Models.ready && typeof player !== 'undefined') { player.rebuild(lookOpts(shops.look)); npcs.rebuildAll(scene); if (Models.variantsP) Models.variantsP.then(() => { try { player.rebuild(lookOpts(shops.look)); } catch (e) {} }); } return Models; }).catch(() => Models); };
const city = buildCity(scene);
const colliders = city.colliders;
const controls = new Controls();
const START = { x: roadCoord(3), z: roadCoord(3) + (CFG.block + CFG.road) / 2 };
const player = new Player(scene, START.x, START.z);
const shops = new Shops(scene, colliders, { cash: () => missions.cash, spend: n => { missions.cash -= n; hud.cash(missions.cash); saveGame(); }, banner: (t, c, ms) => banner(t, c, ms), openOverlay: (id, on) => openOverlay(id, on), applyLook: o => player.rebuild(o) });
window.__shops = shops;
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

const npcs = new NPCs(scene, 110);
npcs.colliders = colliders;
const allNpcs = npcs.list.slice();
const NPC_N = { low: 28, normal: 70, high: 110 };
function applyNpc() {
  const n = NPC_N[S.npc] || 28;
  npcs.list = allNpcs.slice(0, n);
  allNpcs.forEach((p, i) => { if (i >= n) p.mesh.visible = false; });
}
applyNpc();

const SAVE_KEY = 'madina_save_v1';
let saved = {};
try { saved = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}'); } catch (e) {}
const owned = saved.owned || [true, true, false, false];
const missions = new Missions(scene, hud, audio);
missions.cash = saved.cash || 0; hud.cash(missions.cash);
let saveJobsRef = null;
function saveGame() { try { localStorage.setItem(SAVE_KEY, JSON.stringify({ cash: missions.cash, owned, done: saveJobsRef ? saveJobsRef.done : {}, story: story.save() })); } catch (e) {} }
setInterval(saveGame, 8000);
window.addEventListener('pagehide', saveGame);
const police = new Police(scene, colliders);
const jobs = new Jobs(scene, hud, {
  saved, audio,
  addCash(n) { missions.cash += n; hud.cash(missions.cash); },
  wantStars(n) { wantStars(Math.max(stars, n)); },
  banner(t, c, ms) { banner(t, c, ms); },
  restore() { missions._banner(); missions.marker.visible = true; },
  save: saveGame,
  getCar() { return car; },
  spawnCar(x, z, color, type) { const mesh = makeCar(color, type); mesh.position.set(x, 0, z); scene.add(mesh); const o = { mesh, x, z, heading: 0, speed: 0, parked: true, job: true }; parked.push(o); return o; },
});
saveJobsRef = jobs;
const story = new Story(scene, camera, {
  saved, audio, hud, colliders,
  P() { return { px: car ? car.x : player.x, pz: car ? car.z : player.z }; },
  getCar() { return car; },
  nearestCar() { return nearestCar(); },
  stars() { return stars; },
  wantStars(n) { wantStars(Math.max(stars, n)); },
  clearStars() { police.clear(); stars = 0; evade = 0; bust = 0; refreshStars(); },
  addCash(n) { missions.cash += n; hud.cash(missions.cash); },
  banner(t, c, ms) { banner(t, c, ms); },
  save() { saveGame(); },
  restore() { missions._banner(); missions.marker.visible = true; },
  spawnCar(x, z, color, type) { const mesh = makeCar(color, type); mesh.position.set(x, 0, z); scene.add(mesh); const o = { mesh, x, z, heading: 0, speed: 0, parked: true, job: true }; parked.push(o); return o; },
  forceExit() { if (car) exitCar(); },
  lock(on) { controls.locked = on; if (on) { controls.fireHeld = false; controls.mouseFire = false; } },
  teleport(x, z) { player.x = x; player.z = z; player.syncMesh(); focus.x = x; focus.z = z; },
  playerFace(a) { if (a) { player.heading = Math.atan2(a.x - player.x, a.z - player.z); player.syncMesh(); } },
  playerMesh() { return player.mesh; },
  camReset() { camYaw = player.heading; camPitch = 0.45; focus.x = player.x; focus.z = player.z; camera.fov = camera.userData.baseFov || 62; camera.updateProjectionMatrix(); },
});
window.__story = story;
const radar = new Radar($('minimap'), $('pmCanvas'), city.emptyBlocks);

// ---------- State ----------
let car = null;
let camYaw = 0, camPitch = 0.5, camOff = 0, shoulderOff = 0;
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
  i = clamp(i, 0, WEAPONS.length - 1);
  if (!owned[i] && i > 0) { banner('اشتري السلاح ده من المتجر', '#ffd166', 1500); i = 0; }
  cur = i;
  gunGroup.children.forEach(g => g.visible = false);
  if (cur && gunGroup.userData[cur]) gunGroup.userData[cur].visible = !car;
  refreshWeaponHud();
}
function setIcon(el, k) { if (el.__k === k) return; el.__k = k; el.innerHTML = window.__ICONS[k]; }
function refreshWeaponHud() {
  const w = WEAPONS[cur], el = $('weaponHud');
  el.style.display = cur ? 'block' : 'none';
  $('wName').textContent = w.name;
  $('wAmmo').textContent = cur ? (wState[cur].reload > 0 ? '...' : wState[cur].ammo + ' / مفتوح') : '';
  $('cross').style.display = (cur && !car) ? 'block' : 'none';
  $('btnFire').style.display = !car ? 'flex' : 'none';
  setIcon($('btnFire'), cur ? 'bullet' : 'fist');
}
function wantStars(n) {
  n = clamp(n, 0, 5);
  if (n > stars) { stars = n; evade = 0; if (n === 1) banner('مطلوب', '#ffd23f'); }
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
  // the crosshair is the screen centre = camera forward, so shots go along camera yaw
  let yaw = camYaw;
  if (S.autoAim) {
    let best = null, bd = 99;
    const cand = police.officers.filter(o => o.hp > 0).concat(police.cars.filter(c => c.hp > 0));
    for (const t of cand) {
      const dx = t.x - player.x, dz = t.z - player.z, d = Math.hypot(dx, dz);
      if (d > 55) continue;
      let da = Math.atan2(dx, dz) - camYaw; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
      if (Math.abs(da) < 0.09 && d < bd) { bd = d; best = Math.atan2(dx, dz); }
    }
    if (best !== null) yaw = best;
  }
  return yaw;
}
const _v3 = new THREE.Vector3();
function shoot() {
  const w = WEAPONS[cur], ws = wState[cur];
  if (!cur || car || ws.reload > 0 || fireCool > 0) return;
  if (ws.ammo <= 0) { audio.dry(); fireCool = 0.3; startReload(); return; }
  ws.ammo--; fireCool = w.cd;
  const yaw = aimDirection(); aimYaw = yaw; aimT = 0.8;
  const sy = Math.sin(yaw), cy = Math.cos(yaw);
  const ox = player.x + sy * 0.6, oz = player.z + cy * 0.6;
  camera.getWorldDirection(_v3);
  const hl = Math.hypot(_v3.x, _v3.z) || 1, slope = _v3.y / hl;
  audio.shot(cur);
  npcs.alarm(player.x, player.z, cur === 3 ? 70 : 55);
  camKick = Math.min(0.05, camKick + 0.012 * (cur === 3 ? 3 : 1));
  for (let p = 0; p < w.pellets; p++) {
    const a = yaw + (Math.random() - 0.5) * 2 * w.spread;
    const dx = Math.sin(a), dz = Math.cos(a);
    const t = police.target(ox, oz, dx, dz, w.range, npcs.list);
    const dist = t ? t.dist : w.range;
    const camAlong = (ox - camera.position.x) * sy + (oz - camera.position.z) * cy;
    const ey = clamp(camera.position.y + slope * (camAlong + dist), 0.25, 3.5);
    police.tracer(ox, 1.25, oz, ox + dx * dist, t ? clamp(ey, 0.4, 1.7) : ey, oz + dz * dist);
    if (t) {
      spark(ox + dx * dist, clamp(ey, 0.4, 1.7), oz + dz * dist);
      if (t.kind === 'npc') npcs.hit(t.obj, w.dmg * (w.pellets > 1 ? 1.4 : 1.5), 'gun', player.x, player.z);
      else if (t.kind === 'officer') { t.obj.hp -= w.dmg; t.obj.barT = 3.5; wantStars(Math.max(stars, 2)); if (t.obj.hp <= 0) wantStars(stars + 1); }
      else if (t.kind === 'pcar') { t.obj.hp -= w.dmg; wantStars(Math.max(stars, 2)); }
    }
  }
  player.heading = yaw; player.syncMesh();
  if (ws.ammo <= 0) startReload();
  refreshWeaponHud();
}
let punchT = 0, punchCool = 0, camKick = 0;
function punch() {
  if (punchCool > 0 || car) return;
  punchCool = 0.5; punchT = 0.32;
  const yaw = camYaw; aimYaw = yaw; aimT = 0.5;
  player.heading = yaw; player.syncMesh();
  audio.swing();
  const ox = player.x, oz = player.z, dx = Math.sin(yaw), dz = Math.cos(yaw);
  const t = police.target(ox + dx * 0.2, oz + dz * 0.2, dx, dz, 2.2, npcs.list);
  if (t) {
    audio.punch(); spark(ox + dx * t.dist, 1.3, oz + dz * t.dist, '#fff2b0');
    if (t.kind === 'npc') { npcs.hit(t.obj, 22, 'punch', player.x, player.z); npcs.knock(t.obj, dx, dz, 0.9); npcs.alarm(t.obj.x, t.obj.z, 14); }
    else if (t.kind === 'officer') { t.obj.hp -= 20; t.obj.barT = 3.5; wantStars(Math.max(stars, 2)); if (t.obj.hp <= 0) wantStars(stars + 1); }
  }
}
function startReload() {
  const ws = wState[cur];
  if (!cur || ws.reload > 0 || ws.ammo >= WEAPONS[cur].mag) return;
  ws.reload = cur === 3 ? 1.6 : 1.2; audio.reload(cur, ws.reload); refreshWeaponHud();
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
  jobs.cancel('فشلت المهمة');
  police.clear(); stars = 0; evade = 0; bust = 0; refreshStars();
  hp = 100;
  if (car) {
    parked.push({ mesh: car.mesh, x: car.x, z: car.z, heading: car.heading, speed: 0, parked: true });
    car = null; player.setVisible(true); audio.engine(0, false);
  }
  player.x = START.x; player.z = START.z; player.syncMesh();
  focus.x = player.x; focus.z = player.z;
  camYaw = 0; setWeapon(cur);
  story.onDeath();
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

// ---------- car vs car collisions ----------
function carVel(o) { if (o === car) return { x: car.vx, z: car.vz }; const f = fwd(o.heading), s = o.speed || 0; return { x: f.x * s, z: f.z * s }; }
function resolveCars() {
  const list = [];
  if (car) list.push(car);
  for (const t of traffic) list.push(t);
  for (const c of police.cars) list.push(c);
  for (const p of parked) list.push(p);
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const a = list[i], b = list[j];
    if (a.parked && b.parked) continue;
    if (Math.abs(a.x - b.x) > 6.4 || Math.abs(a.z - b.z) > 6.4) continue;
    const fa = fwd(a.heading), fb = fwd(b.heading);
    let best = 0, nx = 0, nz = 0;
    for (const oa of [1.3, -1.3]) for (const ob of [1.3, -1.3]) {
      const ax = a.x + fa.x * oa, az = a.z + fa.z * oa, bx = b.x + fb.x * ob, bz = b.z + fb.z * ob;
      const d = Math.hypot(ax - bx, az - bz), ov = 2.5 - d;
      if (ov > best) { best = ov; nx = d > 0.001 ? (ax - bx) / d : 1; nz = d > 0.001 ? (az - bz) / d : 0; }
    }
    if (best <= 0) continue;
    const am = !a.parked, bm = !b.parked;
    const sa = am && bm ? 0.5 : am ? 1 : 0, sb = am && bm ? 0.5 : bm ? 1 : 0;
    a.x += nx * best * sa; a.z += nz * best * sa; b.x -= nx * best * sb; b.z -= nz * best * sb;
    const va = carVel(a), vb = carVel(b);
    const vrel = (va.x - vb.x) * nx + (va.z - vb.z) * nz;
    if (vrel >= 0) continue;
    const imp = -vrel, jj = imp * 1.35;
    const kick = (o, sx, sgn) => {
      if (o.parked) return;
      if (o === car) { car.vx += nx * jj * sx * sgn; car.vz += nz * jj * sx * sgn; car.speed *= 0.7; }
      else { o.speed *= 0.4; o.stopTimer = 0.7; o.heading += sgn * (Math.random() - 0.5) * 0.4; }
    };
    kick(a, Math.max(sa, 0.6), 1); kick(b, Math.max(sb, 0.6), -1);
    if (imp > 5) {
      const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
      spark(mx, 0.9, mz, '#ffe08a');
      if (crashCool <= 0) { audio.bump(); crashCool = 0.3; }
      if (a === car || b === car) { hurt(imp * 0.32); camKick = Math.min(0.05, camKick + 0.02); }
      for (const o of [a, b]) {
        if (o.police && o.hp > 0) { o.hp -= imp * 3.2; if (a === car || b === car) wantStars(Math.max(stars, 2)); }
      }
    }
  }
  if (car) { car.mesh.position.set(car.x, 0, car.z); }
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
  shoulderOff += (((S.shoulder && cur && !car) ? 1.05 : 0) - shoulderOff) * Math.min(1, dt * 6);
  camKick *= Math.exp(-9 * dt);
  const tx = (car ? car.x : player.x) - Math.cos(camYaw) * shoulderOff, tz = (car ? car.z : player.z) + Math.sin(camYaw) * shoulderOff;
  const fk = 1 - Math.exp(-(car ? 14 : 12) * dt);
  focus.x += (tx - focus.x) * fk; focus.z += (tz - focus.z) * fk;
  const dist = (car ? 9.5 + Math.abs(car.speed) * 0.07 : 8.2) * S.camDist;
  const cp = Math.cos(camPitch), sp = Math.sin(camPitch);
  const fy = car ? 1.3 : 1.35;
  const wantY = Math.max(0.9, fy + sp * dist) + camKick * 12;
  camera.position.set(focus.x - Math.sin(camYaw) * cp * dist, wantY, focus.z - Math.cos(camYaw) * cp * dist);
  const ahead = car ? 4 : 2.5;
  camera.lookAt(focus.x + Math.sin(camYaw) * ahead, fy - (car ? 0.2 : 0.55), focus.z + Math.cos(camYaw) * ahead);
  if (story.cineActive) story._shot(story.cine.b || story.cine.def.beats[0], story.cine.b ? story.cine.t / story.cine.dur : 0);
}

// ---------- floating HP bars ----------
const barPool = [];
function getBar(i) {
  if (barPool[i]) return barPool[i];
  const bg = new THREE.Sprite(new THREE.SpriteMaterial({ color: '#000000', depthTest: false, transparent: true, opacity: 0.7 }));
  const fg = new THREE.Sprite(new THREE.SpriteMaterial({ color: '#4fd36b', depthTest: false, transparent: true }));
  bg.scale.set(0.95, 0.13, 1); fg.scale.set(0.87, 0.07, 1); bg.renderOrder = 998; fg.renderOrder = 999;
  scene.add(bg); scene.add(fg); bg.visible = fg.visible = false;
  return (barPool[i] = { bg, fg });
}
function updateBars() {
  let k = 0;
  const each = o => {
    if (o.barT > 0 && o.hp > 0 && k < 10) {
      const b = getBar(k++), r = clamp(o.hp / (o.hpMax || 100), 0, 1);
      const y = 2.25;
      b.bg.position.set(o.x, y, o.z); b.fg.position.set(o.x, y, o.z);
      b.fg.scale.x = 0.87 * Math.max(0.02, r); b.fg.material.color.set(r > 0.5 ? '#4fd36b' : r > 0.25 ? '#ffd23f' : '#ff4545');
      b.bg.visible = b.fg.visible = true;
    }
  };
  npcs.list.forEach(each);
  police.officers.forEach(o => { if (o.barT === undefined) { o.hpMax = 60; o.barT = 0; } o.barT -= 0.016; each(o); });
  for (let i = k; i < barPool.length; i++) barPool[i].bg.visible = barPool[i].fg.visible = false;
}

// ---------- HUD / overlays ----------
let mapT = 0;
function radarInfo() {
  return {
    x: car ? car.x : player.x, z: car ? car.z : player.z, heading: camYaw,
    marker: story.markerPos() || (jobs.active ? jobs.markerPos() : missions.markerPos()), police: police.blips(),
  };
}
function openOverlay(id, on) {
  $(id).style.display = on ? 'flex' : 'none';
  paused = $('settings').style.display === 'flex' || $('pauseMap').style.display === 'flex' || $('menu').style.display === 'flex' || $('shopOv').style.display === 'flex' || story.cineActive;
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
const onSet = key => {
  if (key === 'quality') { applyQuality(S.quality === 'auto' ? autoTier() : TIERS.indexOf(S.quality)); buildSettingsUI(onSet); perfDone = S.quality !== 'auto'; perfT = 0; perfN = 0; }
  if (key === 'shadows') { renderer.shadowMap.enabled = !!S.shadows; sun.castShadow = !!S.shadows; scene.traverse(o => { if (o.material) o.material.needsUpdate = true; }); perfDone = true; }
  if (key === 'hiRes') applyPixelRatio();
  if (key === 'volume') audio.vol = S.volume;
  if (key === 'radio') audio.radio(S.radio);
  if (key === 'npc') applyNpc();
  if (key === 'traffic') applyTraffic();
  if (key === 'kmh') $('spUnit').textContent = S.kmh ? 'كم/س' : 'ميل/س';
};
buildSettingsUI(onSet);
audio.vol = S.volume;
$('spUnit').textContent = S.kmh ? 'كم/س' : 'ميل/س';

// ---------- menu: missions / shop / progress ----------
let menuTab = story.done ? 'jobs' : 'story';
const SHOP = [
  { id: 'w2', name: 'رشاش خفيف', desc: 'نار سريعة', price: 900, type: 'weapon', idx: 2 },
  { id: 'w3', name: 'خرطوش', desc: 'قوة كبيرة من قريب', price: 1400, type: 'weapon', idx: 3 },
  { id: 'hp', name: 'علاج كامل', desc: 'صحتك ترجع 100%', price: 150, type: 'heal' },
];
function renderMenu() {
  $('menuCash').textContent = missions.cash + ' ج';
  document.querySelectorAll('#menu .tab').forEach(b => b.classList.toggle('on', b.dataset.t === menuTab));
  const body = $('menuBody'); body.innerHTML = '';
  const card = (title, sub, label, fn, disabled) => {
    const d = document.createElement('div'); d.className = 'card';
    d.innerHTML = '<div class="t"><b></b><small></small></div>'; d.querySelector('b').textContent = title; d.querySelector('small').textContent = sub;
    if (label) { const b = document.createElement('button'); b.textContent = label; b.disabled = !!disabled; b.addEventListener('click', fn); d.appendChild(b); }
    body.appendChild(d);
  };
  if (menuTab === 'story') {
    card('الهدف الحالي', story.objective(), null);
    if (!story.done) card(story.paused ? 'القصة واقفة (لعب حر)' : 'القصة شغالة', story.paused ? 'ارجع للقصة لما تحب' : 'ممكن توقفها وتلعب حر أو مهام جانبية', story.paused ? 'كمّل القصة' : 'وقف القصة', () => { story.pause(!story.paused); renderMenu(); });
    CHAPTER_TITLES.forEach((t, i) => {
      const state = story.done || i < story.ch ? 'خلصت' : i === story.ch ? 'شغالة' : 'لسه';
      card('الفصل ' + (i + 1) + ': ' + t, state, (state === 'خلصت' || state === 'شغالة') ? 'ابدأ الفصل من الأول' : null, () => { story.restartChapter(i); openOverlay('menu', false); });
    });
  } else if (menuTab === 'jobs') {
    if (jobs.active) card('مهمة شغالة: ' + jobs.active.def.title, 'اكمل المهمة أو الغيها', 'إلغاء', () => { jobs.cancel('اتلغت المهمة'); renderMenu(); });
    const blocked = story.active && !story.paused;
    if (blocked) card('القصة شغالة', 'وقّفها من تبويب القصة علشان تعمل مهام جانبية', null);
    for (const d of JOB_DEFS) card(d.title, d.desc + ' · مكافأة ' + d.reward + ' · اتعملت ' + (jobs.done[d.id] || 0) + ' مرة', 'ابدأ', () => {
      const P = { x: car ? car.x : player.x, z: car ? car.z : player.z };
      if (jobs.start(d.id, P)) { openOverlay('menu', false); }
    }, !!jobs.active || blocked);
    card('توصيل ركاب (حر)', 'المهمة الأساسية: خد الركاب من العلامة الصفرا. شغالة لما مفيش مهمة تانية.', null);
  } else if (menuTab === 'shop') {
    for (const it of SHOP) {
      const have = it.type === 'weapon' && owned[it.idx];
      card(it.name, it.desc + (have ? ' · عندك' : ' · ' + it.price + ' ج'), have ? 'ملكك' : 'اشتري', () => {
        if (missions.cash < it.price) { banner('الفلوس مش كفاية', '#ff6b6b', 1200); return; }
        missions.cash -= it.price; hud.cash(missions.cash);
        if (it.type === 'weapon') { owned[it.idx] = true; banner('اشتريت ' + it.name, '#7ee787', 1200); } else { hp = 100; banner('اتعالجت', '#7ee787', 1200); }
        saveGame(); renderMenu();
      }, have || (missions.cash < it.price));
    }
  } else {
    const n = Object.values(jobs.done).reduce((a, b) => a + b, 0);
    card('الفلوس', missions.cash + ' ج', null); card('مهام اتعملت', String(n), null);
    card('أحسن رصيد ركاب', String(missions.best || 0), null);
    card('الأسلحة', WEAPONS.map((w, i) => i && owned[i] ? w.name : '').filter(Boolean).join(' · ') || 'مفيش', null);
  }
}
document.querySelectorAll('#menu .tab').forEach(b => b.addEventListener('click', () => { menuTab = b.dataset.t; renderMenu(); }));
$('btnMenu').addEventListener('click', () => { if (started) { renderMenu(); openOverlay('menu', true); } });
$('menuClose').addEventListener('click', () => openOverlay('menu', false));

// ---------- Main loop ----------
let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  let dt = (now - last) / 1000; last = now;
  dt = Math.min(dt, 0.05);
  frames++;
  if (controls.pressed('map') && started) openOverlay('pauseMap', $('pauseMap').style.display !== 'flex');
  if (controls.pressed('settings') && started) openOverlay('settings', $('settings').style.display !== 'flex');
  if (controls.pressed('menu') && started) { renderMenu(); openOverlay('menu', $('menu').style.display !== 'flex'); }
  if (controls.pressed('esc')) { shops.close(); openOverlay('menu', false); openOverlay('settings', false); openOverlay('pauseMap', false); }

  if (started && !paused) {
    gameT += dt; crashCool -= dt;
    const px = car ? car.x : player.x, pz = car ? car.z : player.z;
    if (dead > 0) {
      dead -= dt; if (!car) { player.mesh.rotation.x = -Math.PI / 2 * Math.min(1, (2.8 - dead) * 5); player.mesh.position.y = 0.45; }
      if (dead <= 0) { player.mesh.rotation.x = 0; respawn(); }
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
        if (controls.actionPressed()) { const sh = shops.near(player.x, player.z); if (sh) shops.open(sh); else { const c = nearestCar(); if (c) enterCar(c); } }
        if (cur) { if (controls.fire() && (WEAPONS[cur].auto || !shoot._held)) shoot(); }
        else if (controls.fire() && !shoot._held) punch();
        shoot._held = controls.fire();
        if (aimT > 0) { player.heading = aimYaw; player.syncMesh(); }
        punchCool -= dt;
        if (punchT > 0) { punchT -= dt; const u = player.mesh.userData, k = Math.sin(Math.PI * (1 - Math.max(0, punchT) / 0.32)); u.aR.sh.rotation.x = -1.55 * k; u.aR.el.rotation.x = -0.1 - 0.2 * k; u.tor.rotation.y = -0.35 * k; }
      }
      updateWeapons(dt);
    }

    const P = { x: car ? car.x : player.x, z: car ? car.z : player.z, car, onFoot: !car };
    npcs.update(dt, car, P.x, P.z);
    if (npcs.pendingHits > 0) { hurt(npcs.pendingHits); npcs.pendingHits = 0; }
    for (const n of npcs.list) if (n.crime) { n.crime = false; wantStars(Math.max(stars, 1)); }
    for (const t of traffic) t.update(dt, traffic, P.x, P.z, car);
    if (story.active && !story.paused) { missions.marker.visible = false; } else if (jobs.active) { missions.marker.visible = false; jobs.update(dt, P); } else missions.update(dt, P.x, P.z, !!car);

    // police
    const out = police.update(dt, P, stars, S.police);
    resolveCars();
    if (out.hurt && dead <= 0) hurt(out.hurt);
    if (out.bump) audio.bump();
    audio.siren(stars > 0 && out.nearCar < 70 ? 1 - out.nearCar / 70 : 0);
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
    const shopNear = !car ? shops.near(player.x, player.z) : null;
    const pr = $('prompt');
    if (shopNear) { pr.style.display = 'block'; pr.textContent = IS_TOUCH ? 'اضغط "ادخل" للمحل' : 'اضغط E تدخل المحل'; } else if (near) { pr.style.display = 'block'; pr.textContent = IS_TOUCH ? 'اضغط "اركب"' : 'اضغط E لركوب العربية'; } else pr.style.display = 'none';
    $('btnAction').style.display = (near || car || shopNear) ? 'flex' : 'none';
    setIcon($('btnAction'), car ? 'exit' : 'enter');
    $('btnBrake').style.display = car ? 'flex' : 'none';
    $('drvL').style.display = car ? 'flex' : 'none'; $('drvR').style.display = car ? 'flex' : 'none'; $('stick').style.display = car ? 'none' : ''; document.body.classList.toggle('driving', !!car); if (!car && controls.arr) controls.arr.u = controls.arr.d = controls.arr.l = controls.arr.r = false;
    $('btnWeapon').style.display = car ? 'none' : 'flex';
    $('speed').style.display = car ? 'block' : 'none';
    if (car) $('speed').firstChild.nodeValue = Math.round(Math.abs(car.speed) * (S.kmh ? 3.6 : 2.237)) + ' ';
    audio.engine(car ? car.speed : 0, !!car && dead <= 0);
    if (frames % 2 === 0) radar.draw(radarInfo(), gameT);
    else if (frames % 2 === 1 && frames < 3) radar.draw(radarInfo(), gameT);
  }

  if (started) story.update(dt, (paused && !story.cineActive) || dead > 0);
  city.update(performance.now() / 1000);
  updateCamera(dt);
  if (!paused) { updateSmoke(dt); updateSparks(dt); updateBars(); }
  sky.update(dt, camera.position);
  { const fx = car ? car.x : player.x, fz = car ? car.z : player.z;
    sun.target.position.set(fx, 0, fz); sun.position.set(fx + SUN_OFF.x, SUN_OFF.y, fz + SUN_OFF.z); }
  if (story.cineActive) { camera.fov = story.fov; camera.updateProjectionMatrix(); } else { const base = camera.userData.baseFov || 62; const tf = car ? base + Math.min(14, Math.abs(car.speed) * 0.35) : base; camera.fov += (tf - camera.fov) * 0.08; camera.updateProjectionMatrix(); }
  perfCheck(dt);
  renderer.render(scene, camera);
  shops.update(dt, gameT); shops.renderPreview(renderer, dt);
}

const TIERS = ['low', 'medium', 'high'];
let curTier = 1;
function autoTier() {
  const mem = navigator.deviceMemory, cores = navigator.hardwareConcurrency || 4;
  if (mem !== undefined) { if (mem <= 2 || (mem <= 3 && cores <= 4)) return 0; if (mem >= 8 && cores >= 8) return 2; return 1; }
  if (cores <= 4) return 0;
  return IS_TOUCH ? 1 : 2;
}
function applyQuality(t) {
  curTier = t;
  const q = [{ sh: false, pr: 1, npc: 'low', tr: 'low', fog: [70, 260] }, { sh: false, pr: 1.25, npc: 'normal', tr: 'normal', fog: [100, 380] }, { sh: true, pr: 2, npc: 'high', tr: 'high', fog: [120, 430] }][t];
  S.shadows = q.sh; S.hiRes = q.pr > 1.5; S.npc = q.npc; S.traffic = q.tr;
  renderer.shadowMap.enabled = q.sh; sun.castShadow = q.sh;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.pr));
  scene.fog.near = q.fog[0]; scene.fog.far = q.fog[1];
  scene.traverse(o => { if (o.material) o.material.needsUpdate = true; });
  applyNpc(); applyTraffic();
  window.__tier = TIERS[t];
}
let perfT = 0, perfN = 0, perfDone = false, perfDrops = 0;
const FORCE = /shadows=on/.test(location.search);
function perfCheck(dt) {
  if (perfDone || FORCE || !started || S.quality !== 'auto') return;
  perfT += dt; perfN++;
  if (perfT > 4) {
    const fps = perfN / perfT; perfT = 0; perfN = 0;
    if (fps < 42 && curTier > 0) { applyQuality(curTier - 1); perfDrops++; window.__lowQuality = true; if (perfDrops >= 2) perfDone = true; }
    else perfDone = true;
  }
}
camera.position.set(player.x, 7.5, player.z - 11);
requestAnimationFrame(loop);
radar.draw(radarInfo(), 0);
refreshStars(); refreshWeaponHud(); setWeapon(0);
applyQuality(S.quality === 'auto' ? autoTier() : Math.max(0, TIERS.indexOf(S.quality)));

$('startBtn').addEventListener('click', () => {
  audio.init();
  if (audio.ctx && audio.ctx.state === 'suspended') audio.ctx.resume();
  $('start').style.display = 'none';
  started = true;
  Promise.race([window.__loadModels(), new Promise(r => setTimeout(r, 9000))]).then(() => story.begin());
  missions._banner();
  if (S.radio) { audio.radio(true); banner('راديو ماينا FM', '#ff7ac8', 2200); }
});
hud.mission('جاهز؟ اضغط ابدأ اللعب', '');
$('startBtn').disabled = true;
let warm = 0; const warmUp = () => { if (++warm >= 4) { $('startBtn').disabled = false; window.__loadDone && window.__loadDone(); } else requestAnimationFrame(warmUp); };
renderer.compile(scene, camera); requestAnimationFrame(warmUp);
if (saved.cash !== undefined) { $('saveInfo').textContent = 'تقدمك محفوظ · ' + (saved.cash || 0) + ' ج'; $('startBtn').textContent = 'كمّل اللعب'; $('newBtn').style.display = 'inline-block'; }
$('newBtn').addEventListener('click', () => { if (confirm('تمسح التقدم وتبدأ من الأول؟')) { localStorage.removeItem(SAVE_KEY); location.reload(); } });

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
  testCar() { const mesh = makeCar(0xd04040, 'sedan'); mesh.position.set(player.x + 2.5, 0, player.z); scene.add(mesh); const o = { mesh, x: player.x + 2.5, z: player.z, heading: 0, speed: 0, parked: true, job: true }; parked.push(o); if (!car) enterCar(o); },
  enterStoryCar(id) { const o = story.cars[id]; if (o && !car) enterCar(o); }, clearStars() { police.clear(); stars = 0; evade = 0; refreshStars(); }, setPlayer(x, z) { if (car) { car.x = x; car.z = z; } else { player.x = x; player.z = z; player.syncMesh(); } }, jobs, startJob(id) { return jobs.start(id, { x: player.x, z: player.z }); }, saveGame, owned, setWeapon, police, openOverlay, shoot, punch, npcs, resolveCars, get car() { return car; }, setCam(y, p) { camYaw = y; camPitch = p; },
  traffic, parked, scene, camera,
};
