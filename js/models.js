// Imported character models (GLB). Optional: if models/models.json is missing, the game uses the procedural characters.
// models.json: { "height": 1.78, "hero": "hero.glb", "police": ["police.glb"], "npcs": ["npc_01.glb", {"file":"npc_02.glb","gender":"f","height":1.65,"yaw":0}] }
import * as THREE from 'three';
import { GLTFLoader } from '../lib/GLTFLoader.js';
import { clone } from '../lib/SkeletonUtils.js';
import { DRACOLoader } from '../lib/DRACOLoader.js';
import { MeshoptDecoder } from '../lib/meshopt_decoder.module.js';

export const Models = { byFile: {}, ready: false, hero: null, police: [], npcs: [], stats: [], errors: [] };
const pick = a => a[Math.floor(Math.random() * a.length)];

function normalize(gltf, entry, baseH) {
  const root = gltf.scene, wrap = new THREE.Group(); wrap.add(root);
  root.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(root), h = Math.max(0.01, b.max.y - b.min.y), s = (entry.height || baseH || 1.78) / h;
  root.scale.multiplyScalar(s); root.updateMatrixWorld(true);
  const b2 = new THREE.Box3().setFromObject(root);
  root.position.x -= (b2.min.x + b2.max.x) / 2; root.position.z -= (b2.min.z + b2.max.z) / 2; root.position.y -= b2.min.y;
  wrap.rotation.y = entry.yaw || 0;
  let tris = 0, texMax = 0, meshes = 0, bones = 0;
  root.traverse(o => {
    if (o.isSkinnedMesh) { o.frustumCulled = false; bones = Math.max(bones, o.skeleton.bones.length); }
    if (o.isMesh) {
      meshes++; o.castShadow = !!entry.shadow; o.receiveShadow = false;
      const g = o.geometry; tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
      for (const m of [].concat(o.material)) {
        if (m.metalness !== undefined) { m.metalness = Math.min(m.metalness, 0.1); m.roughness = Math.max(m.roughness, 0.7); }
        if (m.map) { m.map.anisotropy = 2; const im = m.map.image; if (im && im.width) texMax = Math.max(texMax, im.width, im.height); }
        m.envMapIntensity = 0;
      }
    }
  });
  return { scene: wrap, clips: gltf.animations || [], file: entry.file, gender: entry.gender, stats: { file: entry.file, tris: Math.round(tris), meshes, bones, tex: texMax, clips: (gltf.animations || []).map(c => c.name) } };
}

export async function initModels(ver) {
  let man;
  try { const r = await fetch('./models/models.json?v=' + ver, { cache: 'no-cache' }); if (!r.ok) return Models; man = await r.json(); } catch (e) { return Models; }
  const loader = new GLTFLoader(), dr = new DRACOLoader(); dr.setDecoderPath('./lib/draco/'); loader.setDRACOLoader(dr); loader.setMeshoptDecoder(MeshoptDecoder);
  const load = async (e, role) => {
    const entry = typeof e === 'string' ? { file: e } : e;
    try { const g = await loader.loadAsync('./models/' + entry.file + '?v=' + ver); const t = normalize(g, entry, man.height); t.role = role; Models.stats.push(t.stats); return t; }
    catch (err) { Models.errors.push(entry.file + ': ' + err.message); return null; }
  };
  if (man.hero) Models.hero = await load(man.hero, 'hero');
  for (const e of man.police || []) { const t = await load(e, 'police'); if (t) Models.police.push(t); }
  for (const e of man.npcs || []) { const t = await load(e, 'npc'); if (t) Models.npcs.push(t); }
  for (const e of man.variants || []) { const t = await load(e, 'hero'); if (t) Models.byFile[t.file] = t; }
  Models.ready = !!(Models.hero || Models.police.length || Models.npcs.length);
  return Models;
}

export function pickTemplate(opts) {
  if (!Models.ready) return null;
  const role = (opts && opts.role) || 'npc';
  if (role === 'hero') return (opts.glb && Models.byFile[opts.glb]) || Models.hero;
  if (role === 'police') return Models.police.length ? pick(Models.police) : null;
  if (!Models.npcs.length) return null;
  const g = opts && opts.female !== undefined ? (opts.female ? 'f' : 'm') : null;
  const pool = g ? Models.npcs.filter(t => !t.gender || t.gender === g) : Models.npcs;
  return pick(pool.length ? pool : Models.npcs);
}

// drop-in replacement for the procedural person: same userData fields the NPC, police and player code use
export function wrapImported(tpl) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const model = clone(tpl.scene); body.add(model);
  const mixer = new THREE.AnimationMixer(model), acts = {};
  const find = re => tpl.clips.find(c => re.test(c.name));
  const idle = find(/idle|stand|breath/i), walk = find(/walk/i) || tpl.clips[0], run = find(/run|jog/i);
  for (const [k, c] of [['idle', idle], ['walk', walk], ['run', run]]) if (c) { const a = mixer.clipAction(c); a.play(); a.setEffectiveWeight(0); acts[k] = a; }
  if (acts.idle) acts.idle.setEffectiveWeight(1); else if (acts.walk) acts.walk.setEffectiveWeight(1);
  const D = () => new THREE.Object3D(), arm = () => ({ sh: D(), el: D() }), leg = () => ({ hp: D(), kn: D() });
  root.userData = {
    imported: true, body, tor: D(), head: D(), aL: arm(), aR: arm(), lL: leg(), lR: leg(), long: false, mixer, acts, lastT: performance.now(), wI: 1, wW: 0, wR: 0,
    mats: { top: new THREE.MeshLambertMaterial({ color: '#556' }), bottom: new THREE.MeshLambertMaterial({ color: '#334' }), skin: new THREE.MeshLambertMaterial({ color: '#c8956a' }) }, scale: body.scale
  };
  return root;
}

export function stepImported(u, amp, still) {
  const now = performance.now(), dt = Math.min(0.1, (now - u.lastT) / 1000); u.lastT = now;
  if (dt <= 0.0005) return;
  const a = u.acts, moving = !still && amp > 0.05, fast = moving && amp > 1.0;
  const tI = moving ? 0 : 1, tW = moving && !fast ? 1 : 0, tR = fast ? 1 : 0, f = Math.min(1, dt * 8);
  if (!a.run) { /* no run clip: use walk faster */ }
  u.wI += (tI - u.wI) * f; u.wW += ((a.run ? tW : (moving ? 1 : 0)) - u.wW) * f; u.wR += (tR - u.wR) * f;
  if (a.idle) { a.idle.setEffectiveWeight(u.wI); if (a.walk) { a.walk.setEffectiveWeight(u.wW); a.walk.timeScale = a.run ? 1 : Math.max(0.6, Math.min(1.6, 0.8 + amp * 0.6)); } }
  else if (a.walk) { a.walk.setEffectiveWeight(1); a.walk.timeScale = moving ? (a.run ? 1 : Math.max(0.6, Math.min(1.6, 0.8 + amp * 0.6))) : 0; }
  if (a.run) a.run.setEffectiveWeight(u.wR);
  if (!a.idle && !a.walk) { u.body.position.y = moving ? Math.abs(Math.sin(now / 160)) * 0.04 : 0; u.body.rotation.z = moving ? Math.sin(now / 320) * 0.04 : Math.sin(now / 1500) * 0.01; }
  u.mixer.update(dt);
}
