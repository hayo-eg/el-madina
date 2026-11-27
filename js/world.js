import * as THREE from 'three';
import { mergeGeometries } from '../lib/BufferGeometryUtils.js';
import { CFG, span, roadCoord, blockCoord } from './config.js';

const PALETTE = ['#ff9ec7', '#7fe5e0', '#ffe1a8', '#c9a7ff', '#a8e6cf', '#ffb3a0', '#f6f0e0', '#8fd3ff', '#ffd0e8', '#9be8ff'];

// one shared window texture drawn on a canvas
function windowTexture() {
  const cv = document.createElement('canvas');
  cv.width = 128; cv.height = 256;
  const g = cv.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 128, 256);
  g.fillStyle = 'rgba(0,0,0,0.07)';
  for (let y = 0; y < 8; y++) g.fillRect(0, y * 32 + 29, 128, 3);   // floor lines
  let seed = 3;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 3; x++) {
      const wx = 10 + x * 40, wy = 6 + y * 32;
      const lit = rnd() < 0.22;
      const gr = g.createLinearGradient(0, wy, 0, wy + 20);
      if (lit) { gr.addColorStop(0, rnd() < 0.5 ? '#ffe28a' : '#ff9ad0'); gr.addColorStop(1, '#ffb347'); }
      else { gr.addColorStop(0, '#5aa6c8'); gr.addColorStop(1, '#2a3a74'); }
      g.fillStyle = gr; g.fillRect(wx, wy, 26, 20);
      g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(wx, wy, 26, 2);
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(wx - 2, wy + 20, 30, 3);  // sill
    }
  const tx = new THREE.CanvasTexture(cv);
  tx.wrapS = tx.wrapT = THREE.RepeatWrapping;
  tx.colorSpace = THREE.SRGBColorSpace;
  tx.anisotropy = 4;
  return tx;
}

export function buildCity(scene) {
  const S = span();
  const colliders = [];

  // ground
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(S + 700, S + 700),
    new THREE.MeshLambertMaterial({ color: '#e3bda4' })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // ocean to the south with a sandy beach band and a boardwalk
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(1400, 500), new THREE.MeshLambertMaterial({ color: '#1fc3d6', emissive: '#0a4a66' }));
  sea.rotation.x = -Math.PI / 2; sea.position.set(0, 0.04, S / 2 + 34 + 250); scene.add(sea);
  const foam = new THREE.Mesh(new THREE.PlaneGeometry(1400, 3), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8 }));
  foam.rotation.x = -Math.PI / 2; foam.position.set(0, 0.06, S / 2 + 34.5); scene.add(foam);
  const walk = new THREE.Mesh(new THREE.BoxGeometry(S + 40, 0.3, 4), new THREE.MeshLambertMaterial({ color: '#c9a27c' }));
  walk.position.set(0, 0.15, S / 2 + 12); scene.add(walk);

  // roads (two big cross strips per line)
  const roadMat = new THREE.MeshLambertMaterial({ color: '#4d4670' });
  const roadGeos = [];
  for (let i = 0; i <= CFG.grid; i++) {
    const c = roadCoord(i);
    const gx = new THREE.BoxGeometry(S, 0.1, CFG.road);
    gx.translate(0, 0.05, c);
    roadGeos.push(gx);
    const gz = new THREE.BoxGeometry(CFG.road, 0.1, S);
    gz.translate(c, 0.05, 0);
    roadGeos.push(gz);
  }
  // center dashes
  const dashMat = new THREE.MeshLambertMaterial({ color: '#fdf3ea' });
  const dashGeos = [];
  for (let i = 0; i <= CFG.grid; i++) {
    const c = roadCoord(i);
    for (let d = -S / 2 + 6; d < S / 2 - 6; d += 8) {
      let skip = false;
      for (let j = 0; j <= CFG.grid; j++) if (Math.abs(d - roadCoord(j)) < CFG.road / 2 + 2) { skip = true; break; }
      if (skip) continue;
      const g1 = new THREE.BoxGeometry(3, 0.12, 0.5);
      g1.translate(d, 0.06, c);
      dashGeos.push(g1);
      const g2 = new THREE.BoxGeometry(0.5, 0.12, 3);
      g2.translate(c, 0.06, d);
      dashGeos.push(g2);
    }
  }
  const roadMesh = new THREE.Mesh(mergeGeometries(roadGeos), roadMat); roadMesh.receiveShadow = true; scene.add(roadMesh);
  scene.add(new THREE.Mesh(mergeGeometries(dashGeos), dashMat));

  // zebra crossings at every intersection
  const zebra = [];
  for (let i = 0; i <= CFG.grid; i++)
    for (let j = 0; j <= CFG.grid; j++) {
      const cx = roadCoord(i), cz = roadCoord(j), o = CFG.road / 2 + 1.6;
      for (let t = -5; t <= 5; t += 2) {
        for (const sgn of [-1, 1]) {
          const a = new THREE.BoxGeometry(0.9, 0.13, 2.6); a.translate(cx + t, 0.065, cz + sgn * o); zebra.push(a);
          const b = new THREE.BoxGeometry(2.6, 0.13, 0.9); b.translate(cx + sgn * o, 0.065, cz + t); zebra.push(b);
        }
      }
    }
  scene.add(new THREE.Mesh(mergeGeometries(zebra), dashMat));

  // sidewalk slabs (merged)
  const walkMat = new THREE.MeshLambertMaterial({ color: '#e8d2dc' });
  const walkGeos = [];
  for (let k = 0; k < CFG.grid; k++)
    for (let l = 0; l < CFG.grid; l++) {
      const g = new THREE.BoxGeometry(CFG.block + 5, 0.34, CFG.block + 5);
      g.translate(blockCoord(k), 0.17, blockCoord(l));
      walkGeos.push(g);
    }
  const walkMesh = new THREE.Mesh(mergeGeometries(walkGeos), walkMat); walkMesh.receiveShadow = true; scene.add(walkMesh);

  // buildings
  const winTex = windowTexture();
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  unitBox.translate(0, 0.5, 0); // pivot at base
  const mats = PALETTE.map(c => new THREE.MeshLambertMaterial({ color: c }));

  const palmTrunks = [], palmLeaves = [];
  const roofGeos = [], tankGeos = [], neonP = [], neonC = [];
  const awn = ['#c0392b', '#2e86c1', '#27ae60', '#d68910'].map(() => []);
  const emptyBlocks = [];
  const rng = mulberry(7);
  for (let k = 0; k < CFG.grid; k++)
    for (let l = 0; l < CFG.grid; l++) {
      const cx = blockCoord(k), cz = blockCoord(l);
      const r = rng();
      if (r < 0.18) { emptyBlocks.push([k, l]); addPalms(palmTrunks, palmLeaves, cx, cz, 3 + Math.floor(rng() * 4)); continue; }
      if (r < 0.45) {
        // 2x2 small buildings
        for (let a = -1; a <= 1; a += 2)
          for (let b = -1; b <= 1; b += 2) {
            const w = 12 + rng() * 5, d = 12 + rng() * 5, h = 7 + rng() * 12;
            addBuilding(cx + a * (CFG.block / 4 + 1), cz + b * (CFG.block / 4 + 1), w, d, h);
          }
      } else {
        const w = 20 + rng() * 12, d = 20 + rng() * 12, h = 9 + rng() * 26;
        addBuilding(cx, cz, w, d, h);
        if (rng() < 0.3) addPalms(palmTrunks, palmLeaves, cx + w / 2 + 5, cz + d / 2 + 5, 1);
      }
    }

  function addBuilding(x, z, w, d, h) {
    const base = mats[Math.floor(rng() * mats.length)];
    const t = winTex.clone();
    t.repeat.set(Math.max(1, Math.round(w / 9)), Math.max(1, Math.round(h / 8)));
    t.needsUpdate = true;
    const m = new THREE.MeshLambertMaterial({ color: base.color, map: t });
    const mesh = new THREE.Mesh(unitBox, m);
    mesh.scale.set(w, h, d);
    mesh.position.set(x, 0.3, z);
    mesh.castShadow = true; mesh.receiveShadow = true;
    scene.add(mesh);
    { const nb = new THREE.BoxGeometry(w + 0.9, 0.3, d + 0.9); nb.translate(x, 0.3 + h - 0.6, z); (rng() < 0.5 ? neonP : neonC).push(nb);
      if (h > 14) { const nb2 = new THREE.BoxGeometry(w + 0.9, 0.25, d + 0.9); nb2.translate(x, 0.3 + h * 0.5, z); (rng() < 0.5 ? neonP : neonC).push(nb2); } }
    const cor = new THREE.BoxGeometry(w + 0.7, 0.55, d + 0.7); cor.translate(x, 0.3 + h + 0.27, z); roofGeos.push(cor);
    const ac = new THREE.BoxGeometry(w * 0.3, 1.2, d * 0.28); ac.translate(x + (rng() - 0.5) * w * 0.4, 0.3 + h + 1.1, z + (rng() - 0.5) * d * 0.4); roofGeos.push(ac);
    if (rng() < 0.45) { const tk = new THREE.CylinderGeometry(1.1, 1.1, 1.8, 10); tk.translate(x + (rng() - 0.5) * w * 0.5, 0.3 + h + 1.4, z + (rng() - 0.5) * d * 0.5); tankGeos.push(tk); }
    const ai = Math.floor(rng() * 4);
    const aw1 = new THREE.BoxGeometry(w * 0.75, 0.22, 1.3); aw1.translate(x, 3.6, z + d / 2 + 0.6); awn[ai].push(aw1);
    const aw2 = new THREE.BoxGeometry(1.3, 0.22, d * 0.75); aw2.translate(x + w / 2 + 0.6, 3.6, z); awn[(ai + 1) % 4].push(aw2);
    colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, h: h + 0.3 });
  }

  function addPalms(trunks, leaves, cx, cz, n, exact) {
    for (let i = 0; i < n; i++) {
      const x = exact ? cx : cx + (rng() - 0.5) * (CFG.block - 10);
      const z = exact ? cz : cz + (rng() - 0.5) * (CFG.block - 10);
      const h = 4.2 + rng() * 2.6;
      const t = new THREE.CylinderGeometry(0.18, 0.32, h, 7);
      t.translate(x, h / 2, z);
      trunks.push(t);
      const nf = 7, off = rng() * 6;
      for (let f = 0; f < nf; f++) {
        const fr = new THREE.BoxGeometry(2.8, 0.07, 0.62);
        fr.translate(1.4, 0, 0); fr.rotateZ(-0.42); fr.rotateY(off + f * Math.PI * 2 / nf);
        fr.translate(x, h + 0.2, z);
        leaves.push(fr);
      }
      const nut = new THREE.SphereGeometry(0.28, 6, 5); nut.translate(x, h - 0.1, z); trunks.push(nut);
    }
  }
  // sidewalk palms along every block edge (Vice-City boulevard feel)
  for (let k = 0; k < CFG.grid; k++)
    for (let l = 0; l < CFG.grid; l++) {
      const cx = blockCoord(k), cz = blockCoord(l), o = CFG.block / 2 + 1.2;
      addPalms(palmTrunks, palmLeaves, cx - o, cz - o, 1, true);
      addPalms(palmTrunks, palmLeaves, cx + o, cz + o, 1, true);
      if ((k + l) % 2 === 0) { addPalms(palmTrunks, palmLeaves, cx + o, cz - o, 1, true); addPalms(palmTrunks, palmLeaves, cx - o, cz + o, 1, true); }
    }

  if (palmTrunks.length) {
    const t1 = new THREE.Mesh(mergeGeometries(palmTrunks), new THREE.MeshLambertMaterial({ color: '#9a6b42' })); t1.castShadow = true; scene.add(t1);
    const t2 = new THREE.Mesh(mergeGeometries(palmLeaves), new THREE.MeshLambertMaterial({ color: '#27b36a', side: THREE.DoubleSide })); t2.castShadow = true; scene.add(t2);
  }
  if (neonP.length) scene.add(new THREE.Mesh(mergeGeometries(neonP), new THREE.MeshBasicMaterial({ color: '#ff3fa4' })));
  if (neonC.length) scene.add(new THREE.Mesh(mergeGeometries(neonC), new THREE.MeshBasicMaterial({ color: '#2de2e6' })));
  const roofMesh = new THREE.Mesh(mergeGeometries(roofGeos), new THREE.MeshLambertMaterial({ color: '#8d8a84' })); roofMesh.castShadow = true; scene.add(roofMesh);
  if (tankGeos.length) scene.add(new THREE.Mesh(mergeGeometries(tankGeos), new THREE.MeshLambertMaterial({ color: '#4a5560' })));
  ['#c0392b', '#2e86c1', '#27ae60', '#d68910'].forEach((c, i) => { if (awn[i].length) { const am = new THREE.Mesh(mergeGeometries(awn[i]), new THREE.MeshLambertMaterial({ color: c })); am.castShadow = true; scene.add(am); } });

  // street lights at intersection corners
  const poleGeos = [], headGeos = [];
  for (let i = 0; i <= CFG.grid; i += 2)
    for (let j = 0; j <= CFG.grid; j += 2) {
      const x = roadCoord(i) + CFG.road / 2 + 1, z = roadCoord(j) + CFG.road / 2 + 1;
      const p = new THREE.CylinderGeometry(0.14, 0.18, 6.4, 5);
      p.translate(x, 3.2, z);
      poleGeos.push(p);
      const hgeo = new THREE.BoxGeometry(0.7, 0.3, 0.7);
      hgeo.translate(x, 6.5, z);
      headGeos.push(hgeo);
    }
  scene.add(new THREE.Mesh(mergeGeometries(poleGeos), new THREE.MeshLambertMaterial({ color: '#5b6470' })));
  scene.add(new THREE.Mesh(mergeGeometries(headGeos), new THREE.MeshBasicMaterial({ color: '#ffd0f0' })));

  return { colliders, emptyBlocks, size: S };
}

// deterministic pseudo-random
function mulberry(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// static minimap background
export function drawMinimapBase(sizePx) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = sizePx;
  const g = cv.getContext('2d');
  const S = span();
  const s = sizePx / S;
  const px = v => (v + S / 2) * s;
  g.fillStyle = '#c9b083'; g.fillRect(0, 0, sizePx, sizePx);
  g.fillStyle = '#a99e8c';
  for (let k = 0; k < CFG.grid; k++)
    for (let l = 0; l < CFG.grid; l++)
      g.fillRect(px(blockCoord(k) - CFG.block / 2 - 2), px(blockCoord(l) - CFG.block / 2 - 2), (CFG.block + 4) * s, (CFG.block + 4) * s);
  g.fillStyle = '#41464d';
  for (let i = 0; i <= CFG.grid; i++) {
    g.fillRect(0, px(roadCoord(i) - CFG.road / 2), sizePx, CFG.road * s);
    g.fillRect(px(roadCoord(i) - CFG.road / 2), 0, CFG.road * s, sizePx);
  }
  return cv;
}
