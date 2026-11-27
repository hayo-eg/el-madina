import * as THREE from 'three';
import { mergeGeometries } from '../lib/BufferGeometryUtils.js';
import { CFG, span, roadCoord, blockCoord } from './config.js';

const PALETTE = ['#e8dcc0', '#d9c9a8', '#cbb491', '#b7c4c9', '#e3e0d5', '#c97e52', '#9fb4a0', '#d4a373'];

// one shared window texture drawn on a canvas
function windowTexture() {
  const cv = document.createElement('canvas');
  cv.width = 64; cv.height = 128;
  const g = cv.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 64, 128);
  g.fillStyle = '#2c3a4a';
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 3; x++)
      g.fillRect(6 + x * 20, 8 + y * 15, 12, 9);
  const tx = new THREE.CanvasTexture(cv);
  tx.wrapS = tx.wrapT = THREE.RepeatWrapping;
  tx.colorSpace = THREE.SRGBColorSpace;
  return tx;
}

export function buildCity(scene) {
  const S = span();
  const colliders = [];

  // ground
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(S + 700, S + 700),
    new THREE.MeshLambertMaterial({ color: '#c9b083' })
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // roads (two big cross strips per line)
  const roadMat = new THREE.MeshLambertMaterial({ color: '#41464d' });
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
  const dashMat = new THREE.MeshLambertMaterial({ color: '#e8e4d8' });
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
  scene.add(new THREE.Mesh(mergeGeometries(roadGeos), roadMat));
  scene.add(new THREE.Mesh(mergeGeometries(dashGeos), dashMat));

  // sidewalk slabs (merged)
  const walkMat = new THREE.MeshLambertMaterial({ color: '#b9b2a4' });
  const walkGeos = [];
  for (let k = 0; k < CFG.grid; k++)
    for (let l = 0; l < CFG.grid; l++) {
      const g = new THREE.BoxGeometry(CFG.block + 5, 0.34, CFG.block + 5);
      g.translate(blockCoord(k), 0.17, blockCoord(l));
      walkGeos.push(g);
    }
  scene.add(new THREE.Mesh(mergeGeometries(walkGeos), walkMat));

  // buildings
  const winTex = windowTexture();
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  unitBox.translate(0, 0.5, 0); // pivot at base
  const mats = PALETTE.map(c => new THREE.MeshLambertMaterial({ color: c }));

  const palmTrunks = [], palmLeaves = [];
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
    scene.add(mesh);
    colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, h: h + 0.3 });
  }

  function addPalms(trunks, leaves, cx, cz, n) {
    for (let i = 0; i < n; i++) {
      const x = cx + (rng() - 0.5) * (CFG.block - 10);
      const z = cz + (rng() - 0.5) * (CFG.block - 10);
      const h = 3.6 + rng() * 2.2;
      const t = new THREE.CylinderGeometry(0.22, 0.34, h, 5);
      t.translate(x, h / 2, z);
      trunks.push(t);
      const l1 = new THREE.ConeGeometry(2.1, 1.1, 6);
      l1.translate(x, h + 0.4, z);
      leaves.push(l1);
      const l2 = new THREE.ConeGeometry(1.5, 0.8, 6);
      l2.rotateY(0.5);
      l2.translate(x, h + 0.9, z);
      leaves.push(l2);
    }
  }

  if (palmTrunks.length) {
    scene.add(new THREE.Mesh(mergeGeometries(palmTrunks), new THREE.MeshLambertMaterial({ color: '#7a5230' })));
    scene.add(new THREE.Mesh(mergeGeometries(palmLeaves), new THREE.MeshLambertMaterial({ color: '#4e8f4a' })));
  }

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
  scene.add(new THREE.Mesh(mergeGeometries(headGeos), new THREE.MeshBasicMaterial({ color: '#ffe9a8' })));

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
