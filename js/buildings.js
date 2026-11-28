import * as THREE from 'three';
import { mergeGeometries } from '../lib/BufferGeometryUtils.js';
import { CFG, blockCoord } from './config.js';

// metres covered by one texture tile: 3 bays wide x 3 floors tall
const BAY = 6, FLOOR = 3.5, TW = BAY * 3, TH = FLOOR * 3, GF = 4.2;
const Y0 = 0.3;

function cvs(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function mkTex(c) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
function mulberry(a) {
  return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ---- facade styles: one 3x3 bay tile each ----
const STYLES = [
  { name: 'apartment', wall: '#e9dcc0' },
  { name: 'modern', wall: '#f1f1ec' },
  { name: 'glass', wall: '#5f7f98' },
  { name: 'classic', wall: '#dfc79c' },
  { name: 'concrete', wall: '#b9b7b0' },
  { name: 'brick', wall: '#b05a40' },
];
function facadeTexture(si) {
  const bw = 192, bh = 112, [c, g] = cvs(bw * 3, bh * 3);
  const rnd = mulberry(100 + si * 17);
  const st = STYLES[si];
  g.fillStyle = st.wall; g.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(${rnd() < 0.5 ? '0,0,0' : '255,255,255'},${0.02 + rnd() * 0.04})`; g.fillRect(rnd() * c.width, rnd() * c.height, 2 + rnd() * 10, 1 + rnd() * 6); }
  if (si === 5) {
    g.strokeStyle = 'rgba(40,15,10,.28)'; g.lineWidth = 1;
    for (let y = 0; y < c.height; y += 7) { g.beginPath(); g.moveTo(0, y); g.lineTo(c.width, y); g.stroke(); for (let x = (y / 7 % 2) * 8; x < c.width; x += 16) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 7); g.stroke(); } }
  }
  for (let fy = 0; fy < 3; fy++) for (let bx = 0; bx < 3; bx++) {
    const x0 = bx * bw, y0 = fy * bh, lit = rnd() < 0.2, curtain = rnd() < 0.35;
    const glass = (x, y, w, h, tint) => {
      const gr = g.createLinearGradient(x, y, x + w * 0.6, y + h);
      if (lit) { gr.addColorStop(0, '#ffe9a8'); gr.addColorStop(1, '#f3b15a'); }
      else { gr.addColorStop(0, tint || '#8fb8d4'); gr.addColorStop(0.55, '#4b7391'); gr.addColorStop(1, '#2a3f5c'); }
      g.fillStyle = gr; g.fillRect(x, y, w, h);
      if (!lit) { g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.moveTo(x, y + h * 0.7); g.lineTo(x + w * 0.5, y); g.lineTo(x + w * 0.75, y); g.lineTo(x, y + h); g.fill(); }
      if (curtain && !lit) { g.fillStyle = 'rgba(240,230,215,.55)'; g.fillRect(x, y, w * (0.3 + rnd() * 0.3), h); }
    };
    if (si === 0) {
      glass(x0 + 56, y0 + 20, 80, 62); g.fillStyle = '#f8f4ea'; g.fillRect(x0 + 52, y0 + 16, 88, 5); g.fillRect(x0 + 52, y0 + 80, 88, 5); g.fillRect(x0 + 52, y0 + 16, 5, 69); g.fillRect(x0 + 135, y0 + 16, 5, 69);
      g.fillStyle = 'rgba(30,45,60,.45)'; g.fillRect(x0 + 94, y0 + 21, 2, 60);
      g.fillStyle = '#9a9488'; g.fillRect(x0 + 30, y0 + 100, 132, 8); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x0 + 30, y0 + 108, 132, 3);
      g.strokeStyle = '#3d3d40'; g.lineWidth = 2; for (let r = 0; r < 12; r++) { g.beginPath(); g.moveTo(x0 + 34 + r * 11, y0 + 86); g.lineTo(x0 + 34 + r * 11, y0 + 100); g.stroke(); }
      if (rnd() < 0.3) { g.fillStyle = '#d7d9db'; g.fillRect(x0 + 140, y0 + 60, 28, 20); g.fillStyle = '#9a9ea3'; g.fillRect(x0 + 143, y0 + 64, 22, 3); }
    } else if (si === 1) {
      glass(x0 + 8, y0 + 22, 176, 54, '#a9d1e6'); g.fillStyle = '#e0e0da'; for (let m = 0; m < 4; m++) g.fillRect(x0 + 8 + m * 58, y0 + 22, 3, 54);
      g.fillStyle = '#bdbdb6'; g.fillRect(x0, y0 + 80, bw, 6); g.fillStyle = '#d7d7d1'; g.fillRect(x0, y0 + 6, bw, 14);
    } else if (si === 2) {
      glass(x0 + 3, y0 + 3, bw - 6, bh - 6, '#9cc7e2'); g.fillStyle = '#b8c4cc'; g.fillRect(x0, y0, bw, 3); g.fillRect(x0, y0, 3, bh); g.fillRect(x0 + bw / 2, y0, 2, bh); g.fillStyle = 'rgba(210,225,235,.65)'; g.fillRect(x0, y0 + bh - 16, bw, 16);
    } else if (si === 3) {
      g.fillStyle = '#efe2c4'; g.fillRect(x0 + 40, y0 + 18, 112, 90);
      g.fillStyle = lit ? '#f7c870' : '#3c5d7b';
      g.beginPath(); g.moveTo(x0 + 58, y0 + 92); g.lineTo(x0 + 58, y0 + 46); g.arc(x0 + 96, y0 + 46, 38, Math.PI, 0); g.lineTo(x0 + 134, y0 + 92); g.fill();
      g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(x0 + 62, y0 + 30, 16, 60);
      g.fillStyle = '#c8b185'; g.fillRect(x0 + 50, y0 + 92, 92, 8); g.fillRect(x0, y0 + bh - 6, bw, 6);
      g.strokeStyle = '#2f2a24'; g.lineWidth = 3; g.beginPath(); g.moveTo(x0 + 96, y0 + 10); g.lineTo(x0 + 96, y0 + 92); g.moveTo(x0 + 58, y0 + 60); g.lineTo(x0 + 134, y0 + 60); g.stroke();
    } else if (si === 4) {
      for (let k = 0; k < 2; k++) glass(x0 + 28 + k * 78, y0 + 28, 58, 48);
      g.fillStyle = '#8f8d86'; g.fillRect(x0 + 24, y0 + 76, 140, 5); g.fillRect(x0 + 24, y0 + 24, 140, 4);
      if (rnd() < 0.4) { g.fillStyle = '#e3e5e6'; g.fillRect(x0 + 108, y0 + 84, 36, 22); g.fillStyle = '#555'; g.beginPath(); g.arc(x0 + 126, y0 + 95, 8, 0, 7); g.fill(); }
      if (rnd() < 0.25) { g.strokeStyle = '#555'; g.lineWidth = 1; g.beginPath(); g.moveTo(x0 + 10, y0 + 90); g.lineTo(x0 + 80, y0 + 90); g.stroke(); const cs = ['#d33', '#36c', '#fc3', '#fff']; for (let q = 0; q < 4; q++) { g.fillStyle = cs[Math.floor(rnd() * 4)]; g.fillRect(x0 + 14 + q * 16, y0 + 90, 11, 16); } }
      g.fillStyle = 'rgba(0,0,0,.08)'; for (let s = 0; s < 3; s++) g.fillRect(x0 + 40 + s * 40, y0 + 84, 4 + rnd() * 6, 28);
    } else {
      glass(x0 + 58, y0 + 20, 76, 64); g.fillStyle = '#f3ede0'; g.fillRect(x0 + 52, y0 + 14, 88, 7); g.fillRect(x0 + 52, y0 + 84, 88, 6);
      g.strokeStyle = '#d9d0bd'; g.lineWidth = 3; g.strokeRect(x0 + 58, y0 + 20, 76, 64);
      if (rnd() < 0.5) { g.fillStyle = '#2e5e3f'; g.fillRect(x0 + 40, y0 + 20, 12, 64); g.fillRect(x0 + 140, y0 + 20, 12, 64); }
    }
  }
  g.fillStyle = 'rgba(0,0,0,.12)'; for (let f = 0; f < 3; f++) g.fillRect(0, f * bh + bh - 2, c.width, 2);
  return mkTex(c);
}

const SHOPS = [
  ['صيدلية الشفاء', '#1f8a4c', '#fff'], ['مخبز السلام', '#c7872f', '#fff'], ['كافيه النيل', '#6a3b24', '#ffe8b0'], ['سوبر ماركت الأمل', '#d03a3a', '#fff'],
  ['كشري التحرير', '#e0a420', '#2a1a05'], ['ملابس الأناقة', '#2d5fa3', '#fff'], ['موبايلات الحارة', '#222a3a', '#7fe0ff'], ['عصير قصب', '#3ca14a', '#fff'],
  ['مكتبة النور', '#7a3d8f', '#fff'], ['ورشة الأسطى', '#444', '#ffd24a'],
];
function shopTexture(i) {
  const bw = 288, bh = 202, [c, g] = cvs(bw * 3, bh);
  const rnd = mulberry(500 + i * 31);
  g.fillStyle = '#d9d2c4'; g.fillRect(0, 0, c.width, c.height);
  const [name, col, tcol] = SHOPS[i];
  for (let b = 0; b < 3; b++) {
    const x0 = b * bw;
    g.fillStyle = col; g.fillRect(x0 + 6, 8, bw - 12, 52);
    g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(x0 + 6, 8, bw - 12, 6);
    g.fillStyle = tcol; g.font = 'bold 34px Tahoma, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = 'rtl'; g.fillText(name, x0 + bw / 2, 36, bw - 30);
    const gr = g.createLinearGradient(0, 70, 0, 190); gr.addColorStop(0, '#f6e6b8'); gr.addColorStop(1, '#8b6d3a');
    g.fillStyle = '#2a2d33'; g.fillRect(x0 + 14, 66, bw - 28, 128);
    g.fillStyle = gr; g.fillRect(x0 + 20, 72, bw - 40, 116);
    for (let s = 0; s < 14; s++) { g.fillStyle = `hsl(${Math.floor(rnd() * 360)},55%,60%)`; g.fillRect(x0 + 28 + rnd() * (bw - 70), 90 + rnd() * 80, 12 + rnd() * 16, 12 + rnd() * 20); }
    g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.moveTo(x0 + 20, 188); g.lineTo(x0 + 120, 72); g.lineTo(x0 + 160, 72); g.lineTo(x0 + 60, 188); g.fill();
    if (b === 1 || b === 2) { g.fillStyle = '#3a2d22'; g.fillRect(x0 + (b === 1 ? bw - 76 : 20), 72, 56, 122); g.fillStyle = 'rgba(160,210,235,.5)'; g.fillRect(x0 + (b === 1 ? bw - 70 : 26), 78, 44, 100); }
    g.fillStyle = '#8c8578'; g.fillRect(x0, 194, bw, 8);
  }
  g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, 62, c.width, 5);
  return mkTex(c);
}

// box with UVs scaled to real-world size so texture tiles stay constant on every building
function wallBox(w, h, d, x, y, z, tw, th, tint) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    const f = Math.floor(i / 4);
    if (f === 2 || f === 3) { uv.setXY(i, 0.01, 0.01); continue; }
    const su = (f === 0 || f === 1) ? d / tw : w / tw, sv = h / th;
    uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  }
  g.translate(x, y + h / 2, z);
  const n = g.attributes.position.count, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = tint[0]; col[i * 3 + 1] = tint[1]; col[i * 3 + 2] = tint[2]; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
function plainBox(w, h, d, x, y, z) { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y + h / 2, z); return g; }
function cyl(r0, r1, h, x, y, z, seg = 8) { const g = new THREE.CylinderGeometry(r0, r1, h, seg); g.translate(x, y + h / 2, z); return g; }
function strip(a) { for (const g of a) { g.deleteAttribute('uv'); } return a; }

export function buildDistrict(scene, colliders, seed = 7) {
  const rng = mulberry(seed);
  const styleMats = STYLES.map((s, i) => new THREE.MeshLambertMaterial({ map: facadeTexture(i), vertexColors: true }));
  const shopMats = SHOPS.map((s, i) => new THREE.MeshLambertMaterial({ map: shopTexture(i), vertexColors: true }));
  const shaft = STYLES.map(() => []), shop = SHOPS.map(() => []);
  const roofG = [], tankG = [], slabG = [], metalG = [], glassG = [], domeG = [], goldG = [];
  const treeTrunk = [], treeLeaf = [], grassG = [], pathG = [], benchG = [], waterG = [], stoneG = [];
  const emptyBlocks = [];
  const pick = a => a[Math.floor(rng() * a.length)];
  const tintOf = () => { const b = 0.88 + rng() * 0.2, w = (rng() - 0.5) * 0.12; return [Math.min(1.1, b + w), b, Math.min(1.1, b - w)]; };

  function building(x, z, w, d, floors, style, opts = {}) {
    const tint = tintOf();
    const sg = shaft[style], si = Math.floor(rng() * SHOPS.length);
    shop[si].push(wallBox(w, GF, d, x, Y0, z, BAY * 3, GF, [1, 1, 1]));
    let y = Y0 + GF, cw = w, cd = d;
    const tiers = opts.tiers || 1;
    let remaining = floors;
    for (let t = 0; t < tiers; t++) {
      const fl = t === tiers - 1 ? remaining : Math.max(3, Math.round(remaining * 0.55));
      remaining -= fl;
      const h = fl * FLOOR;
      sg.push(wallBox(cw, h, cd, x, y, z, TW, TH, tint));
      if ((style === 0 || style === 5) && t === 0 && opts.balc) {
        for (let f = 2; f < fl; f += 2) for (let bx = -cw / 2 + BAY / 2; bx < cw / 2 - 1; bx += BAY) {
          slabG.push(plainBox(3.4, 0.18, 1.2, x + bx, y + f * FLOOR, z + cd / 2 + 0.6));
          slabG.push(plainBox(3.4, 0.9, 0.08, x + bx, y + f * FLOOR + 0.18, z + cd / 2 + 1.16));
        }
      }
      y += h;
      roofG.push(plainBox(cw + 0.7, 0.6, cd + 0.7, x, y, z));
      roofG.push(plainBox(cw + 0.3, 0.9, 0.3, x, y + 0.6, z + cd / 2 - 0.1)); roofG.push(plainBox(cw + 0.3, 0.9, 0.3, x, y + 0.6, z - cd / 2 + 0.1));
      roofG.push(plainBox(0.3, 0.9, cd + 0.3, x + cw / 2 - 0.1, y + 0.6, z)); roofG.push(plainBox(0.3, 0.9, cd + 0.3, x - cw / 2 + 0.1, y + 0.6, z));
      if (t < tiers - 1) { cw *= 0.72; cd *= 0.72; }
      else {
        roofG.push(plainBox(Math.min(5, cw * 0.3), 2.2, Math.min(4, cd * 0.3), x + (rng() - 0.5) * cw * 0.4, y + 0.6, z + (rng() - 0.5) * cd * 0.4));
        if (rng() < 0.55) tankG.push(cyl(1.2, 1.2, 2.0, x + (rng() - 0.5) * cw * 0.5, y + 0.6, z + (rng() - 0.5) * cd * 0.5, 10));
        if (rng() < 0.6) { const ax = x + (rng() - 0.5) * cw * 0.5, az = z + (rng() - 0.5) * cd * 0.5, ah = 3 + rng() * (tiers > 1 ? 14 : 5); metalG.push(cyl(0.06, 0.1, ah, ax, y + 0.6, az, 4)); }
        if (rng() < 0.4) { const dg = new THREE.SphereGeometry(0.7, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2); dg.rotateX(0.6); dg.translate(x + (rng() - 0.5) * cw * 0.5, y + 1.4, z + (rng() - 0.5) * cd * 0.5); metalG.push(dg); }
        if (tiers > 1) metalG.push(cyl(0.12, 0.45, 16, x, y + 0.6, z, 6));
      }
    }
    slabG.push(plainBox(w + 0.4, 0.2, 1.4, x, Y0 + GF + 0.02, z + d / 2 + 0.7));
    colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, h: y - Y0 + 1 });
  }

  function tree(x, z, big) {
    const h = 2.2 + rng() * 1.4, r = (big ? 2.6 : 1.9) + rng() * 0.8;
    treeTrunk.push(cyl(0.2, 0.3, h, x, 0.35, z, 6));
    const s = new THREE.IcosahedronGeometry(r, 0); s.scale(1, 0.85, 1); s.translate(x, h + r * 0.55, z); treeLeaf.push(s);
    const s2 = new THREE.IcosahedronGeometry(r * 0.7, 0); s2.translate(x + r * 0.5, h + r * 0.35, z - r * 0.2); treeLeaf.push(s2);
  }
  function bench(x, z, rot) {
    const a = plainBox(1.8, 0.12, 0.5, 0, 0.45, 0), b = plainBox(1.8, 0.5, 0.08, 0, 0.7, -0.24), l1 = plainBox(0.1, 0.45, 0.4, -0.8, 0, 0), l2 = plainBox(0.1, 0.45, 0.4, 0.8, 0, 0);
    const m = mergeGeometries([a, b, l1, l2]); m.rotateY(rot); m.translate(x, 0.34, z); benchG.push(m);
  }
  const P = CFG.block + CFG.road;
  function park(cx, cz, fountain) {
    const g = new THREE.PlaneGeometry(CFG.block - 1, CFG.block - 1); g.rotateX(-Math.PI / 2); g.translate(cx, 0.37, cz); grassG.push(g);
    const p1 = plainBox(3, 0.04, CFG.block - 1, cx, 0.38, cz), p2 = plainBox(CFG.block - 1, 0.04, 3, cx, 0.38, cz); pathG.push(p1, p2);
    const n = 9 + Math.floor(rng() * 5);
    for (let i = 0; i < n; i++) { const x = cx + (rng() - 0.5) * 36, zz = cz + (rng() - 0.5) * 36; if (Math.abs(x - cx) < 6 && Math.abs(zz - cz) < 6) continue; if (Math.abs(x - cx) < 2.4 || Math.abs(zz - cz) < 2.4) continue; tree(x, zz, rng() < 0.4); }
    for (const [dx, dz, r] of [[4, 6, 0], [-4, -6, Math.PI], [6, -4, Math.PI / 2], [-6, 4, -Math.PI / 2]]) bench(cx + dx * 1.4, cz + dz * 1.4, r);
    if (fountain) {
      stoneG.push(cyl(4.4, 4.6, 0.9, cx, 0.35, cz, 20)); waterG.push(cyl(4.0, 4.0, 0.12, cx, 1.2, cz, 20));
      stoneG.push(cyl(0.7, 0.9, 2.2, cx, 0.35, cz, 10)); stoneG.push(cyl(1.7, 1.2, 0.4, cx, 2.4, cz, 12)); waterG.push(cyl(1.5, 1.5, 0.1, cx, 2.82, cz, 12));
      colliders.push({ minX: cx - 4.6, maxX: cx + 4.6, minZ: cz - 4.6, maxZ: cz + 4.6, h: 1.2 });
    }
    emptyBlocks.push([Math.round((cx - blockCoord(0)) / P), Math.round((cz - blockCoord(0)) / P)]);
  }
  function tower(cx, cz) {
    stoneG.push(cyl(5, 6, 3, cx, 0.35, cz, 8));
    metalG.push(cyl(2.6, 3.4, 40, cx, 3.3, cz, 8));
    glassG.push(cyl(3.6, 3.6, 3.2, cx, 43.3, cz, 8)); glassG.push(cyl(3.4, 0.4, 5, cx, 46.5, cz, 8));
    goldG.push(cyl(0.12, 0.12, 12, cx, 51.5, cz, 4));
    for (let i = 0; i < 3; i++) goldG.push(cyl(3.9 - i * 0.1, 3.9, 0.4, cx, 12 + i * 12, cz, 8));
    colliders.push({ minX: cx - 3.6, maxX: cx + 3.6, minZ: cz - 3.6, maxZ: cz + 3.6, h: 50 });
  }
  function mosque(cx, cz) {
    const tint = [1, 0.97, 0.9];
    shaft[3].push(wallBox(22, 9, 22, cx, Y0, cz, TW, TH, tint));
    roofG.push(plainBox(23, 0.7, 23, cx, Y0 + 9, cz));
    const dm = new THREE.SphereGeometry(7.5, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2); dm.translate(cx, Y0 + 9.7, cz); domeG.push(dm);
    goldG.push(cyl(0.15, 0.15, 4, cx, Y0 + 17, cz, 4));
    for (const [mx, mz] of [[-12.5, -12.5], [12.5, 12.5]]) {
      shaft[3].push(wallBox(2.6, 30, 2.6, cx + mx, Y0, cz + mz, TW, TH, tint));
      roofG.push(plainBox(3.6, 0.5, 3.6, cx + mx, Y0 + 24, cz + mz)); roofG.push(plainBox(3.6, 0.5, 3.6, cx + mx, Y0 + 30, cz + mz));
      domeG.push(cyl(0, 1.4, 5, cx + mx, Y0 + 30.5, cz + mz, 8)); goldG.push(cyl(0.08, 0.08, 2.5, cx + mx, Y0 + 35.3, cz + mz, 4));
    }
    colliders.push({ minX: cx - 14, maxX: cx + 14, minZ: cz - 14, maxZ: cz + 14, h: 12 });
  }

  const mid = (CFG.grid - 1) / 2;
  for (let k = 0; k < CFG.grid; k++) for (let l = 0; l < CFG.grid; l++) {
    const cx = blockCoord(k), cz = blockCoord(l);
    const r = rng();
    if (k === mid && l === mid) { park(cx, cz, true); tower(cx + 14, cz - 14); continue; }
    if (k === 1 && l === 4) { mosque(cx, cz); continue; }
    if (k === mid + 1 && l === mid) continue; // shop block (built by shops.js)
    if (r < 0.1) { park(cx, cz, false); continue; }
    if (r < 0.38) {
      for (let a = -1; a <= 1; a += 2) for (let b = -1; b <= 1; b += 2) {
        const w = pick([12, 18]), d = pick([12, 18]);
        building(cx + a * 11.5, cz + b * 11.5, w, d, 3 + Math.floor(rng() * 5), Math.floor(rng() * 6), { balc: rng() < 0.5 });
      }
    } else if (r < 0.7) {
      const d = pick([24, 30]);
      building(cx - 10, cz + (rng() - 0.5) * 4, 18, d, 4 + Math.floor(rng() * 6), Math.floor(rng() * 6), { balc: rng() < 0.5 });
      building(cx + 10, cz + (rng() - 0.5) * 4, 18, d, 3 + Math.floor(rng() * 7), Math.floor(rng() * 6), { balc: rng() < 0.5 });
    } else {
      const high = rng() < 0.45;
      const w = pick(high ? [24, 30] : [24, 30, 36]), d = pick([24, 30]);
      building(cx, cz, w, d, high ? 14 + Math.floor(rng() * 9) : 6 + Math.floor(rng() * 6), high ? pick([1, 2, 2, 4]) : Math.floor(rng() * 6), { tiers: high ? 2 + Math.floor(rng() * 2) : 1, balc: rng() < 0.4 });
    }
  }

  const add = (arr, mat, shadow) => { if (!arr.length) return; const m = new THREE.Mesh(mergeGeometries(arr), mat); m.castShadow = !!shadow; m.receiveShadow = true; scene.add(m); return m; };
  const lam = c => new THREE.MeshLambertMaterial({ color: c });
  shaft.forEach((a, i) => add(a, styleMats[i], true));
  shop.forEach((a, i) => add(a, shopMats[i], false));
  add(strip(roofG), lam('#8f8c85'), true); add(strip(tankG), lam('#506070')); add(strip(slabG), lam('#b3ada0')); add(strip(metalG), lam('#69737d'));
  add(strip(glassG), new THREE.MeshStandardMaterial({ color: '#7fb6d4', roughness: 0.2, metalness: 0.4, emissive: '#10304a' }));
  add(strip(domeG), lam('#3aa889')); add(strip(goldG), new THREE.MeshLambertMaterial({ color: '#e5b94a', emissive: '#4a3508' }));
  add(strip(treeTrunk), lam('#6b4a2c')); add(strip(treeLeaf), lam('#3e8f3f'), true);
  add(strip(grassG), lam('#5f9a48')); add(strip(pathG), lam('#cdbf9f')); add(strip(benchG), lam('#6a4a30'));
  add(strip(waterG), new THREE.MeshLambertMaterial({ color: '#58c8e8', emissive: '#103c58' })); add(strip(stoneG), lam('#cfc8ba'));

  // street furniture along block edges
  const bins = [], hydr = [], bol = [], tl = [], sg2 = [], lamps = [];
  for (let k = 0; k < CFG.grid; k++) for (let l = 0; l < CFG.grid; l++) {
    const cx = blockCoord(k), cz = blockCoord(l), o = CFG.block / 2 + 1.8;
    for (let s = 0; s < 5; s++) {
      const side = Math.floor(rng() * 4), t = (rng() - 0.5) * 36;
      const x = side < 2 ? cx + (side === 0 ? -o : o) : cx + t, z = side < 2 ? cz + t : cz + (side === 2 ? -o : o);
      const kind = rng();
      if (kind < 0.35) bins.push(cyl(0.3, 0.3, 0.9, x, 0.34, z, 8));
      else if (kind < 0.55) hydr.push(cyl(0.16, 0.2, 0.75, x, 0.34, z, 6));
      else if (kind < 0.8) { for (let q = 0; q < 3; q++) bol.push(cyl(0.12, 0.12, 0.7, x + (side < 2 ? 0 : q * 0.9), 0.34, z + (side < 2 ? q * 0.9 : 0), 5)); }
      else bench(x, z, side < 2 ? Math.PI / 2 * (side === 0 ? 1 : -1) : (side === 2 ? 0 : Math.PI));
    }
    for (const [sx, sz] of [[1, 1], [-1, -1]]) {
      const x = cx + sx * (CFG.block / 2 + 3.4), z = cz + sz * (CFG.block / 2 + 3.4);
      tl.push(cyl(0.1, 0.1, 4.2, x, 0.34, z, 5)); sg2.push(plainBox(0.4, 1.1, 0.35, x, 4.0, z));
      const g = new THREE.SphereGeometry(0.12, 5, 4); g.translate(x, 4.95, z + 0.2); lamps.push(g);
    }
  }
  add(strip(bins), lam('#3f6b4f')); add(strip(hydr), lam('#c0392b')); add(strip(bol), lam('#e8e1d0')); add(strip(tl), lam('#4b5159'));
  add(strip(sg2), new THREE.MeshBasicMaterial({ color: '#2b2f36' }));
  add(strip(lamps), new THREE.MeshBasicMaterial({ color: '#3dff7a' }));
  return { emptyBlocks };
}
