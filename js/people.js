// Character builder: painted faces, shaped bodies, layered hair, textured clothes.
// Shared textures and geometry keep the per-person cost low (about 30 meshes, no merged per-person buffers).
import * as THREE from 'three';

const pick = a => a[Math.floor(Math.random() * a.length)];
const rnd = (a, b) => a + Math.random() * (b - a);
const MC = {}, GC = {};
export function geo(key, fn) { return GC[key] || (GC[key] = fn()); }
const std = (c, r = 0.75, map) => { const k = 'm' + c + r + (map ? map.uuid : ''); return MC[k] || (MC[k] = new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: 0, map: map || null })); };
const cyl = (rt, rb, h, seg = 12, oy = 0) => { const g = new THREE.CylinderGeometry(rt, rb, h, seg); g.translate(0, oy, 0); return g; };

export const SKINS = ['#f2cba6', '#e6b68a', '#cf9a6a', '#b07a50', '#80523a'];
const TOPS = ['#c0392b', '#2e6fb5', '#2f8f5b', '#e0a030', '#f2f2ee', '#34495e', '#8e5ba6', '#d9d4c7', '#e67e22', '#1f2a3a', '#7f8c8d', '#b84a62', '#5fa8a2', '#c9b458', '#7a8f4a', '#9b4b3a'];
const TOPS_F = ['#e87aa0', '#5fc8c0', '#f7f1de', '#ffd36b', '#7fcf98', '#ff6f91', '#7dd3fc', '#8e5ba6', '#c0392b', '#2e6fb5', '#e0a030', '#b84a62'];
const BOTTOMS = ['#26314a', '#3d3a36', '#5a4632', '#1f2a3a', '#4a4f57', '#6b5b45', '#2b3a2f', '#3b4f78'];
const HAIRS = ['#15110e', '#1c1511', '#2a1d14', '#4a3626', '#6b4a2b'];
const ROBES = ['#f0ece0', '#cfc6b0', '#8d9aa8', '#3b4658', '#8a6b4a', '#d8d0bd', '#506070'];
const HIJABS = ['#1a1a1a', '#7b2d4f', '#2d5a6b', '#d9d3c4', '#4a3a6b', '#2f5d3a', '#a24a4a', '#c9a24a', '#3b3f6e'];
const SHOES = ['#151515', '#3b2a1c', '#e8e8e8', '#27303d', '#6a2f2a'];

function shade(hex, f) { const c = new THREE.Color(hex); c.multiplyScalar(f); return '#' + c.getHexString(); }
function mix(a, b, t) { const c = new THREE.Color(a).lerp(new THREE.Color(b), t); return '#' + c.getHexString(); }
function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function tex(c, repeat) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 2; if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; }

// ---- tiny geometry merge (positions, normals, uvs, indices) ----
function merge(parts) {
  const P = [], N = [], U = [], I = []; let off = 0;
  for (const [g0, m] of parts) {
    const g = g0.clone(); g.applyMatrix4(m);
    const p = g.attributes.position, n = g.attributes.normal, u = g.attributes.uv;
    for (let i = 0; i < p.count; i++) { P.push(p.getX(i), p.getY(i), p.getZ(i)); N.push(n.getX(i), n.getY(i), n.getZ(i)); U.push(u ? u.getX(i) : 0, u ? u.getY(i) : 0); }
    const ix = g.index; if (ix) for (let i = 0; i < ix.count; i++) I.push(ix.getX(i) + off); else for (let i = 0; i < p.count; i++) I.push(i + off);
    off += p.count;
  }
  const o = new THREE.BufferGeometry();
  o.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); o.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); o.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); o.setIndex(I);
  return o;
}
const M = (x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) => { const m = new THREE.Matrix4(); m.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, 0, rz)), new THREE.Vector3(sx, sy, sz)); return m; };

// ---- shared fabric grain ----
let _fab = null;
function fabric() {
  if (_fab) return _fab;
  const c = cv(64, 64), g = c.getContext('2d'); g.fillStyle = '#e8e8e8'; g.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 700; i++) { const v = 200 + Math.random() * 55 | 0; g.fillStyle = `rgba(${v},${v},${v},.5)`; g.fillRect(Math.random() * 64, Math.random() * 64, 1 + Math.random() * 2, 1); }
  for (let i = 0; i < 64; i += 2) { g.fillStyle = 'rgba(0,0,0,.035)'; g.fillRect(i, 0, 1, 64); }
  return (_fab = tex(c, true));
}
let _hairT = null;
function hairTex() {
  if (_hairT) return _hairT;
  const c = cv(64, 64), g = c.getContext('2d'); g.fillStyle = '#cfcfcf'; g.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 90; i++) { const v = Math.random() < 0.5 ? 255 : 120 + Math.random() * 40 | 0; g.strokeStyle = `rgba(${v},${v},${v},.55)`; g.lineWidth = 1; const x = Math.random() * 64; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (Math.random() - 0.5) * 6, 64); g.stroke(); }
  return (_hairT = tex(c, true));
}

// ---- face painting (planar front projection, 192x192) ----
const FS = 192, FACES = {};
let faceCount = 0;
const rowOf = (y) => (1 - (0.5 + y / 0.27)) * FS, colOf = (x) => (0.5 + x / 0.24) * FS;
function paintFace(p) {
  const c = cv(FS, FS), g = c.getContext('2d');
  const sk = p.skin, dark = shade(sk, 0.9), light = shade(sk, 1.04);
  g.fillStyle = sk; g.fillRect(0, 0, FS, FS);
  // soft form shading
  let gr = g.createRadialGradient(96, 100, 20, 96, 100, 100); gr.addColorStop(0, light); gr.addColorStop(0.7, sk); gr.addColorStop(1, dark);
  g.fillStyle = gr; g.fillRect(0, 0, FS, FS);
  if (p.hijab) {
    // fabric outside a face oval
    const hc = p.hijab; g.save(); g.fillStyle = hc; g.beginPath(); g.rect(0, 0, FS, FS); g.ellipse(96, 108, 62, 70, 0, 0, 7, true); g.fill('evenodd');
    g.strokeStyle = shade(hc, 0.82); g.lineWidth = 2; for (let i = 0; i < 9; i++) { g.beginPath(); g.ellipse(96, 108, 66 + i * 4, 74 + i * 5, 0, 0, 7); g.globalAlpha = 0.35; g.stroke(); } g.globalAlpha = 1;
    g.strokeStyle = shade(hc, 0.7); g.lineWidth = 5; g.beginPath(); g.ellipse(96, 108, 63, 71, 0, 0, 7); g.globalAlpha = 0.5; g.stroke(); g.globalAlpha = 1; g.restore();
  } else if (p.hairline) {
    // forehead hairline darkening (hair mesh sits above)
    g.fillStyle = shade(p.hair, 1.0); g.globalAlpha = 0.12; g.fillRect(0, 0, FS, 28); g.globalAlpha = 1;
  }
  // eye sockets shadow
  for (const sx of [-1, 1]) {
    const ex = colOf(sx * 0.043), ey = rowOf(0.024);
    gr = g.createRadialGradient(ex, ey, 2, ex, ey, 24); gr.addColorStop(0, shade(sk, 0.86)); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.globalAlpha = 0.7; g.fillRect(ex - 28, ey - 28, 56, 56); g.globalAlpha = 1;
    // eye
    g.save(); g.translate(ex, ey);
    const w = p.female ? 17 : 16, h = p.female ? 8.5 : 7.5;
    g.fillStyle = '#f1eee8'; g.beginPath(); g.ellipse(0, 0, w, h, 0, 0, 7); g.fill();
    g.clip(); const ix = -sx * 1.5; g.fillStyle = p.eye; g.beginPath(); g.arc(ix, 0.5, 7, 0, 7); g.fill();
    g.fillStyle = '#0a0705'; g.beginPath(); g.arc(ix, 0.5, 3.4, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.arc(ix + 2, -2, 1.5, 0, 7); g.fill();
    g.fillStyle = 'rgba(40,20,10,.35)'; g.fillRect(-w, -h, w * 2, h * 0.7);
    g.restore();
    // upper lid line + lashes
    g.strokeStyle = p.female ? '#120a07' : '#2a1812'; g.lineWidth = p.female ? 3 : 2.4; g.beginPath(); g.ellipse(ex, ey + 1, p.female ? 17.5 : 16.5, p.female ? 9 : 8, 0, Math.PI * 1.04, Math.PI * 1.96); g.stroke();
    if (p.female) { g.lineWidth = 1.6; g.beginPath(); g.moveTo(ex + sx * 16, ey - 1); g.lineTo(ex + sx * 21, ey - 5); g.stroke(); }
    g.strokeStyle = shade(sk, 0.68); g.lineWidth = 1.4; g.globalAlpha = 0.7; g.beginPath(); g.ellipse(ex, ey + 2, 16, 9.5, 0, 0.15, Math.PI - 0.15); g.stroke(); g.globalAlpha = 1;
    // lid crease and bags
    g.strokeStyle = shade(sk, 0.72); g.globalAlpha = 0.5; g.lineWidth = 1.3; g.beginPath(); g.ellipse(ex, ey - 4, 17, 8, 0, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); g.globalAlpha = 1;
    if (p.old) { g.strokeStyle = shade(sk, 0.6); g.globalAlpha = 0.5; for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(ex + sx * 19, ey + k * 3 - 3); g.lineTo(ex + sx * 27, ey + k * 4 - 5); g.stroke(); } g.globalAlpha = 1; }
    // brow
    const by = rowOf(0.057) + (p.female ? 3 : 0), bw = 24, bt = p.brow;
    g.fillStyle = p.hair === '#8c8c8c' ? '#777' : shade(p.hair, 0.8); g.beginPath();
    g.moveTo(ex - sx * bw * 0.55, by + 3 - bt * 0.2); g.quadraticCurveTo(ex + sx * 0, by - 5 - (p.arch || 0), ex + sx * bw * 0.85, by + 5);
    g.lineTo(ex + sx * bw * 0.8, by + 5 + bt * 0.6); g.quadraticCurveTo(ex, by - 3 + bt * 0.6 - (p.arch || 0), ex - sx * bw * 0.55, by + 3 + bt * 0.7); g.fill();
  }
  // nose
  const nx = 96, ny = rowOf(-0.03);
  g.strokeStyle = shade(sk, 0.7); g.globalAlpha = 0.5; g.lineWidth = 3; g.lineCap = 'round';
  g.beginPath(); g.moveTo(nx - 7, ny - 24); g.quadraticCurveTo(nx - 11, ny - 4, nx - 11, ny + 5); g.stroke();
  g.beginPath(); g.moveTo(nx + 7, ny - 24); g.quadraticCurveTo(nx + 11, ny - 4, nx + 11, ny + 5); g.stroke(); g.globalAlpha = 1;
  g.fillStyle = shade(sk, 0.45); g.beginPath(); g.ellipse(nx - 5.5, ny + 7, 2.8, 1.8, 0.2, 0, 7); g.ellipse(nx + 5.5, ny + 7, 2.8, 1.8, -0.2, 0, 7); g.fill();
  g.fillStyle = light; g.globalAlpha = 0.35; g.beginPath(); g.ellipse(nx, ny - 8, 3, 13, 0, 0, 7); g.fill(); g.globalAlpha = 1;
  // facial hair under mouth region first
  const my = rowOf(-0.053);
  if (p.beard) {
    g.fillStyle = shade(p.hair, 0.9); g.globalAlpha = p.beard === 'stubble' ? 0.16 : 0.85;
    g.beginPath();
    if (p.beard === 'full') { g.moveTo(24, my - 34); g.quadraticCurveTo(22, 150, 96, 182); g.quadraticCurveTo(170, 150, 168, my - 34); g.quadraticCurveTo(150, my - 12, 128, my - 8); g.lineTo(64, my - 8); g.quadraticCurveTo(42, my - 12, 24, my - 34); }
    else if (p.beard === 'goatee') { g.ellipse(96, my + 20, 17, 22, 0, 0, 7); }
    else { g.moveTo(28, my - 30); g.quadraticCurveTo(26, 150, 96, 186); g.quadraticCurveTo(166, 150, 164, my - 30); g.quadraticCurveTo(140, my + 20, 96, my + 24); g.quadraticCurveTo(52, my + 20, 28, my - 30); }
    g.fill(); g.globalAlpha = 1;
    if (p.beard !== 'stubble') { for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.2})`; g.fillRect(30 + Math.random() * 132, my - 20 + Math.random() * 70, 1.5, 3); } }
  }
  if (p.stache) {
    g.fillStyle = shade(p.hair, 0.85); g.beginPath(); g.moveTo(96, my - 11); g.quadraticCurveTo(72, my - 15, 56, my - 3); g.quadraticCurveTo(70, my - 1, 96, my - 6); g.quadraticCurveTo(122, my - 1, 136, my - 3); g.quadraticCurveTo(120, my - 15, 96, my - 11); g.fill();
  }
  // mouth
  const lipC = p.female ? p.lip : shade(mix(sk, '#9a4a46', 0.5), 0.95);
  g.fillStyle = lipC; g.beginPath(); g.moveTo(96 - 22, my); g.quadraticCurveTo(96 - 9, my - 6, 96, my - 3.5); g.quadraticCurveTo(96 + 9, my - 6, 96 + 22, my); g.quadraticCurveTo(96, my + 3, 96 - 22, my); g.fill();
  g.fillStyle = shade(lipC, 1.18); g.beginPath(); g.moveTo(96 - 20, my + 0.5); g.quadraticCurveTo(96, my + 13, 96 + 20, my + 0.5); g.quadraticCurveTo(96, my + 2, 96 - 20, my + 0.5); g.fill();
  g.strokeStyle = shade(sk, 0.4); g.lineWidth = 1.7; g.beginPath(); g.moveTo(96 - 23, my - 0.5); g.quadraticCurveTo(96, my + 4 + (p.smile || 0), 96 + 23, my - 0.5); g.stroke();
  // philtrum and chin shade
  g.strokeStyle = shade(sk, 0.78); g.globalAlpha = 0.35; g.lineWidth = 2; g.beginPath(); g.moveTo(92, ny + 13); g.lineTo(91, my - 8); g.moveTo(100, ny + 13); g.lineTo(101, my - 8); g.stroke(); g.globalAlpha = 1;
  if (p.female) { for (const sx of [-1, 1]) { gr = g.createRadialGradient(96 + sx * 46, 128, 2, 96 + sx * 46, 128, 22); gr.addColorStop(0, 'rgba(230,110,110,.35)'); gr.addColorStop(1, 'rgba(230,110,110,0)'); g.fillStyle = gr; g.fillRect(96 + sx * 46 - 24, 104, 48, 48); } }
  if (p.old) { g.strokeStyle = shade(sk, 0.62); g.globalAlpha = 0.4; g.lineWidth = 1.4; for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(52, rowOf(0.08) - 6 + k * 4); g.quadraticCurveTo(96, rowOf(0.08) - 10 + k * 4, 140, rowOf(0.08) - 6 + k * 4); g.stroke(); } g.beginPath(); g.moveTo(66, ny + 4); g.quadraticCurveTo(60, my - 4, 70, my + 10); g.moveTo(126, ny + 4); g.quadraticCurveTo(132, my - 4, 122, my + 10); g.stroke(); g.globalAlpha = 1; }
  // edge colours stay skin so clamped UVs at the back of the head look right
  if (!p.hijab) { g.fillStyle = sk; g.globalAlpha = 0.0; }
  const t = tex(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t;
}
const EYES = ['#2a1a10', '#3a2416', '#5b3a1c', '#1c1a18', '#4a5a3a'];
const LIPS = ['#b8556a', '#a84a4a', '#c07070', '#8a3a48', '#c4604f'];
function faceMat(p) {
  const key = [p.skin, p.female ? 'f' : 'm', p.hijab || '', p.eye, p.brow, p.arch || 0, p.beard || '', p.stache ? 's' : '', p.old ? 'o' : '', p.lip || '', p.smile || 0].join('|');
  if (FACES[key]) return FACES[key];
  if (faceCount >= 56) { const keys = Object.keys(FACES).filter(k => k.startsWith(p.skin + '|' + (p.female ? 'f' : 'm') + '|' + (p.hijab || ''))); if (keys.length) return FACES[pick(keys)]; }
  faceCount++;
  return (FACES[key] = new THREE.MeshStandardMaterial({ map: paintFace(p), roughness: 0.62, metalness: 0 }));
}
function headGeo() {
  return geo('head2', () => {
    const g = new THREE.SphereGeometry(0.112, 28, 20); g.scale(0.92, 1.12, 1.0);
    const p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      if (y < 0.0) { const t = Math.min(1, -y / 0.125); const f = 1 - 0.26 * Math.pow(t, 1.4); x *= f; z *= (1 - 0.16 * Math.pow(t, 1.6)); if (z > 0 && t > 0.5) z += 0.012 * (t - 0.5); }
      if (y > 0.02 && z > 0) z *= 0.97 + 0.03 * (1 - y / 0.125);
      p.setXYZ(i, x, y, z);
      uv.setXY(i, THREE.MathUtils.clamp(0.5 + x / 0.24, 0.001, 0.999), THREE.MathUtils.clamp(0.5 + y / 0.27, 0.001, 0.999));
    }
    g.computeVertexNormals(); return g;
  });
}

// ---- clothes textures (u around the body, seam at the back; v 0 hem to 1 neck) ----
const CLOTH = {};
function paintCloth(type, c1, c2, c3, bottomC, long) {
  const W = 128, H = 256, c = cv(W, H), g = c.getContext('2d');
  g.fillStyle = c1; g.fillRect(0, 0, W, H);
  const FR = 64;
  if (!long) { // trousers waist at the bottom of the torso mesh
    g.fillStyle = bottomC; g.fillRect(0, H * 0.78, W, H * 0.22);
    g.fillStyle = '#2a2018'; g.fillRect(0, H * 0.775, W, 5); g.fillStyle = '#b8a060'; g.fillRect(FR - 3, H * 0.772, 6, 7);
  }
  const top = long ? 0 : 0; // placeholder for readability
  if (type === 'stripe') { g.fillStyle = c2; for (let y = 6; y < H * 0.76; y += 22) g.fillRect(0, y, W, 9); }
  else if (type === 'vstripe') { g.fillStyle = c2; g.globalAlpha = 0.6; for (let x = 0; x < W; x += 12) g.fillRect(x, 0, 3, H * 0.77); g.globalAlpha = 1; }
  else if (type === 'check') { g.globalAlpha = 0.45; g.fillStyle = c2; for (let y = 0; y < H * 0.77; y += 24) g.fillRect(0, y, W, 9); for (let x = 0; x < W; x += 16) g.fillRect(x, 0, 6, H * 0.77); g.globalAlpha = 1; }
  else if (type === 'jersey') { g.fillStyle = c2; for (let x = 0; x < W; x += 20) g.fillRect(x, 0, 10, H * 0.77); g.fillStyle = c3; g.fillRect(0, 0, W, 16); }
  else if (type === 'tee') { g.fillStyle = c2; g.globalAlpha = 0.95; g.beginPath(); g.arc(FR, H * 0.43, 15, 0, 7); g.fill(); g.fillStyle = c3; g.fillRect(FR - 8, H * 0.43 - 2, 16, 4); g.globalAlpha = 1; }
  else if (type === 'dots') { g.fillStyle = '#ffffff'; g.globalAlpha = 0.5; for (let y = 8; y < H * 0.78; y += 16) for (let x = (y / 16 % 2) * 8; x < W; x += 16) { g.beginPath(); g.arc(x, y, 2.4, 0, 7); g.fill(); } g.globalAlpha = 1; }
  else if (type === 'hoodie') { g.fillStyle = shade(c1, 0.82); g.beginPath(); g.moveTo(FR - 28, H * 0.52); g.lineTo(FR + 28, H * 0.52); g.lineTo(FR + 34, H * 0.74); g.lineTo(FR - 34, H * 0.74); g.fill(); g.strokeStyle = '#eee'; g.lineWidth = 2; g.beginPath(); g.moveTo(FR - 5, 14); g.lineTo(FR - 6, H * 0.34); g.moveTo(FR + 5, 14); g.lineTo(FR + 6, H * 0.34); g.stroke(); }
  if (type === 'polo') { g.fillStyle = shade(c1, 0.88); g.fillRect(FR - 3, 0, 6, H * 0.3); g.fillStyle = shade(c1, 1.25); for (let i = 0; i < 3; i++) g.fillRect(FR - 1.5, 26 + i * 22, 3, 3); }
  // collar / neckline
  if (long) { // galabeya band collar and placket
    g.fillStyle = shade(c1, 0.85); g.fillRect(FR - 6, 0, 12, H * 0.45); g.fillStyle = c2; for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(FR, 22 + i * 20, 2.2, 0, 7); g.fill(); }
    g.fillStyle = shade(c1, 0.78); g.fillRect(0, 0, W, 6);
    if (type === 'abaya') { g.fillStyle = c2; g.fillRect(0, H - 14, W, 6); g.fillRect(FR - 14, 0, 28, H - 8); g.fillStyle = c1; g.fillRect(FR - 12, 0, 24, H - 8); }
  } else {
    g.fillStyle = shade(c1, 0.8); g.beginPath(); g.moveTo(FR - 20, 0); g.lineTo(FR + 20, 0); g.lineTo(FR + 14, 10); g.lineTo(FR, 22); g.lineTo(FR - 14, 10); g.fill();
    g.fillStyle = shade(c1, 1.15); g.beginPath(); g.moveTo(FR - 22, 0); g.lineTo(FR - 8, 0); g.lineTo(FR - 4, 12); g.lineTo(FR - 18, 8); g.fill(); g.beginPath(); g.moveTo(FR + 22, 0); g.lineTo(FR + 8, 0); g.lineTo(FR + 4, 12); g.lineTo(FR + 18, 8); g.fill();
  }
  // folds
  g.strokeStyle = 'rgba(0,0,0,.09)'; g.lineWidth = 2; for (let i = 0; i < 9; i++) { const x = Math.random() * W; g.beginPath(); g.moveTo(x, H * 0.2 + Math.random() * 30); g.quadraticCurveTo(x + (Math.random() - 0.5) * 14, H * 0.5, x + (Math.random() - 0.5) * 20, H * 0.75); g.stroke(); }
  return tex(c);
}
function clothMat(type, c1, c2, c3, bottomC, long) {
  const key = [type, c1, c2, c3, bottomC, long ? 1 : 0].join('|');
  if (CLOTH[key]) return CLOTH[key];
  return (CLOTH[key] = new THREE.MeshStandardMaterial({ map: paintCloth(type, c1, c2, c3, bottomC, long), roughness: 0.88, metalness: 0 }));
}

// ---- body profiles ----
function profile(ctrl, yMin, yMax, steps) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const y = yMin + (yMax - yMin) * i / steps;
    let k = 0; while (k < ctrl.length - 2 && ctrl[k + 1][0] < y) k++;
    const [y0, r0] = ctrl[k], [y1, r1] = ctrl[k + 1]; let t = THREE.MathUtils.clamp((y - y0) / (y1 - y0), 0, 1); t = t * t * (3 - 2 * t);
    pts.push(new THREE.Vector2(r0 + (r1 - r0) * t, y));
  }
  return pts;
}
const P_M = [[0.88, .168], [0.95, .182], [1.02, .176], [1.12, .168], [1.22, .179], [1.32, .197], [1.42, .211], [1.5, .207], [1.54, .182], [1.575, .115], [1.6, .062]];
const P_F = [[0.88, .172], [0.95, .198], [1.02, .186], [1.12, .147], [1.22, .152], [1.3, .168], [1.4, .17], [1.5, .176], [1.54, .156], [1.575, .105], [1.6, .058]];
const P_RM = [[0.1, .31], [0.3, .27], [0.55, .22], [0.85, .19], [1.0, .182], [1.12, .172], [1.25, .182], [1.4, .206], [1.5, .207], [1.54, .182], [1.575, .115], [1.6, .062]];
const P_RF = [[0.1, .3], [0.3, .26], [0.55, .21], [0.85, .18], [1.0, .17], [1.12, .152], [1.25, .158], [1.4, .172], [1.5, .176], [1.54, .156], [1.575, .105], [1.6, .058]];
function torsoGeo(female, long) {
  return geo('tor_' + female + long, () => {
    const ctrl = long ? (female ? P_RF : P_RM) : (female ? P_F : P_M);
    const g = new THREE.LatheGeometry(profile(ctrl, long ? 0.1 : 0.88, 1.6, long ? 22 : 14), 22, Math.PI, Math.PI * 2);
    return g;
  });
}

export function buildPerson(opts) {
  opts = opts || {};
  const police = opts.uniform === 'police';
  const female = opts.female !== undefined ? opts.female : Math.random() < 0.45;
  const kind = opts.kind ? opts.kind : female ? (Math.random() < 0.5 ? 'abaya' : (Math.random() < 0.45 ? 'dress' : 'casual')) : (Math.random() < 0.2 ? 'galabeya' : 'casual');
  const hijab = female && !police && (opts.hijab !== undefined ? opts.hijab : (Math.random() < 0.72 && !opts.kind));
  const long = kind === 'galabeya' || kind === 'abaya' || kind === 'dress';
  const skinHex = opts.skin || pick(SKINS);
  const old = opts.old !== undefined ? opts.old : !opts.noOld && Math.random() < 0.16;
  const hairHex = old ? '#8c8c8c' : (opts.hair || pick(HAIRS));
  const skin = std(skinHex, 0.68);
  const style = opts.style ? opts.style : police ? 'short' : female ? pick(['long', 'long', 'bun', 'pony', 'bob']) : pick(['short', 'short', 'fade', 'quiff', 'curly', 'bald', 'side', 'short']);
  const hijabHex = hijab ? (kind === 'abaya' && Math.random() < 0.7 ? '#1a1a1a' : pick(HIJABS)) : null;
  const fp = {
    skin: skinHex, female, hijab: hijabHex, hair: hairHex, eye: pick(EYES), brow: female ? rnd(3, 5.5) : rnd(5, 9), arch: female ? 2 : 0, lip: pick(LIPS), old,
    beard: opts.beard !== undefined ? opts.beard : !female && !police && style !== 'bald' ? (Math.random() < 0.18 ? 'full' : Math.random() < 0.18 ? 'stubble' : Math.random() < 0.06 ? 'goatee' : null) : null,
    stache: opts.stache !== undefined ? opts.stache : !female && (police || Math.random() < 0.3), smile: pick([0, 2, -1]), hairline: !hijab && style !== 'bald'
  };
  if (!female && style === 'bald' && Math.random() < 0.4) fp.beard = 'stubble';
  const face = faceMat(fp);

  // clothes
  let tmat, topHex, bottomHex = opts.bottom || pick(BOTTOMS), shirtType = 'solid';
  if (police) { topHex = '#eeeeea'; bottomHex = '#e4e4df'; shirtType = 'polo'; }
  else if (kind === 'galabeya') topHex = opts.top || pick(ROBES);
  else if (kind === 'abaya') topHex = opts.top || pick(['#171717', '#202833', '#33293a', '#1e2e2a']);
  else if (kind === 'dress') topHex = opts.top || pick(TOPS_F);
  else topHex = opts.top || pick(female ? TOPS_F : TOPS);
  const alt = pick(TOPS), alt2 = pick(['#f2f2ee', '#222222', '#e0a030', '#c0392b']);
  if (!police && !opts.top) {
    if (kind === 'casual') shirtType = female ? pick(['solid', 'stripe', 'dots', 'tee']) : pick(['solid', 'solid', 'polo', 'stripe', 'check', 'tee', 'tee', 'jersey', 'hoodie', 'vstripe']);
    else if (kind === 'dress') shirtType = pick(['dots', 'solid', 'vstripe']);
    else if (kind === 'abaya') shirtType = pick(['abaya', 'abaya', 'solid']);
    else shirtType = 'solid';
  }
  if (opts.shirt) shirtType = opts.shirt;
  if (shirtType === 'jersey' && !opts.top) { topHex = pick(['#d93a3a', '#f4f4f4', '#2b6cb0', '#f2c230']); }
  tmat = clothMat(shirtType, topHex, shirtType === 'abaya' ? pick(['#c9a24a', '#8a8a8a', '#a24a6a']) : (shirtType === 'jersey' ? pick(['#ffffff', '#101010']) : alt), alt2, bottomHex, long);
  const sleeveMat = new THREE.MeshStandardMaterial({ color: topHex, roughness: 0.9, map: fabric() });
  MC['sl' + topHex] = MC['sl' + topHex] || sleeveMat; const sleeve = MC['sl' + topHex];
  const bottomMat = std(bottomHex, 0.9, fabric());
  const shoeHex = opts.shoe || (police ? '#101010' : pick(SHOES)), shoe = std(shoeHex, 0.55);
  const longSleeves = opts.sleeves !== undefined ? opts.sleeves : (long || shirtType === 'hoodie' || police ? true : Math.random() < 0.4);
  const sc = (opts.scale || rnd(0.92, 1.08)) * (female ? 0.95 : 1.0);
  const wide = rnd(0.94, 1.1);

  const root = new THREE.Group();
  const body = new THREE.Group(); body.scale.set(sc * wide, sc, sc * wide); root.add(body);
  const add = (g, m, x, y, z, parent = body, shadow = false) => { const me = new THREE.Mesh(g, m); me.position.set(x, y, z); me.castShadow = shadow; parent.add(me); return me; };

  const tor = add(torsoGeo(female, long), tmat, 0, 0, 0, body, true);
  tor.scale.set(1, 1, long ? 0.72 : (female ? 0.6 : 0.64));
  add(geo('neck2', () => cyl(0.05, 0.058, 0.14, 12)), skin, 0, 1.6, 0.0);
  // head
  const head = new THREE.Group(); head.position.set(0, 1.725, 0); body.add(head);
  const hs = rnd(0.95, 1.05) * (female ? 0.96 : 1);
  const face0 = add(headGeo(), face, 0, 0, 0, head, true); face0.scale.set(hs * (female ? 0.96 : 1.02), hs, hs);
  add(geo('nose2', () => merge([
    [new THREE.CapsuleGeometry(0.0125, 0.036, 3, 8), M(0, 0.004, 0.107, 1, 1, 1, -0.28)],
    [new THREE.SphereGeometry(0.0185, 10, 8), M(0, -0.027, 0.119, 1.1, 0.85, 1)],
    [new THREE.SphereGeometry(0.0115, 8, 6), M(-0.0165, -0.032, 0.109)], [new THREE.SphereGeometry(0.0115, 8, 6), M(0.0165, -0.032, 0.109)]
  ])), skin, 0, 0, 0, head);
  add(geo('ears2', () => merge([
    [new THREE.SphereGeometry(0.021, 8, 6), M(-0.099, -0.002, -0.004, 0.55, 1.25, 0.9)], [new THREE.SphereGeometry(0.021, 8, 6), M(0.099, -0.002, -0.004, 0.55, 1.25, 0.9)]
  ])), skin, 0, 0, 0, head);
  // hair
  const hairMat = new THREE.MeshStandardMaterial({ color: hairHex, roughness: 0.55, metalness: 0, map: hairTex() });
  const hk = 'hr' + hairHex; hairMat.map = hairTex(); const hm = MC[hk] || (MC[hk] = hairMat);
  const sphere = (r, wS, hS, ts, tl, ps, pl) => { const g = new THREE.SphereGeometry(r, 18, 12, ps, pl, ts, tl); g.scale(wS, hS, 1.04); return g; };
  if (hijab) {
    const hj = std(hijabHex, 0.85, fabric());
    const wedge = 0.85;
    add(geo('hood', () => sphere(0.131, 1.0, 1.14, 0, 2.15, Math.PI / 2 + wedge, Math.PI * 2 - wedge * 2)), hj, 0, 0.005, -0.012, head, true);
    add(geo('hoodtop', () => sphere(0.128, 1.0, 1.14, 0, 0.55, 0, Math.PI * 2)), hj, 0, 0.012, -0.012, head);
    const dr = add(geo('drape', () => { const g = new THREE.CylinderGeometry(0.124, 0.215, 0.34, 18, 1, true); g.translate(0, -0.29, 0); return g; }), hj, 0, 0, -0.012, head);
    dr.scale.z = 0.8; dr.material = hj; hj.side = THREE.DoubleSide;
  } else if (style !== 'bald') {
    const back = style === 'long' || style === 'bob' ? 2.35 : style === 'fade' || police ? 1.38 : style === 'short' || style === 'side' ? 1.52 : 1.7;
    add(geo('htop', () => sphere(0.119, 0.97, 1.13, 0, 0.96, 0, Math.PI * 2)), hm, 0, 0.012, -0.008, head, true);
    add(geo('hback' + back, () => sphere(0.122, 0.98, 1.13, 0, back, Math.PI / 2 + 0.95, Math.PI * 2 - 1.9)), hm, 0, 0.012, -0.008, head);
    if (style === 'quiff') add(geo('quiff', () => new THREE.SphereGeometry(0.06, 12, 8)), hm, 0, 0.118, 0.04, head).scale.set(1.35, 0.62, 1.15);
    if (style === 'side') { add(geo('sidep', () => new THREE.SphereGeometry(0.1, 12, 8, 0, Math.PI * 2, 0, 1.0)), hm, 0.025, 0.045, 0.03, head).scale.set(1.0, 0.45, 1.05); }
    if (style === 'curly') add(geo('curlz', () => { const parts = []; for (let i = 0; i < 26; i++) { const a = i * 2.4, b = 0.25 + (i % 5) * 0.2; parts.push([new THREE.SphereGeometry(0.036, 7, 5), M(Math.sin(a) * Math.sin(b) * 0.115, 0.045 + Math.cos(b) * 0.1, Math.cos(a) * Math.sin(b) * 0.11 - 0.015)]); } return merge(parts); }), hm, 0, 0.02, -0.015, head, true);
    if (style === 'bun') add(geo('bun2', () => new THREE.SphereGeometry(0.052, 10, 8)), hm, 0, 0.1, -0.1, head);
    if (style === 'pony') add(geo('pony', () => new THREE.CapsuleGeometry(0.03, 0.2, 4, 8)), hm, 0, -0.07, -0.15, head).rotation.x = 0.25;
    if (style === 'long' || style === 'bob') {
      const L = style === 'bob' ? 0.2 : 0.34;
      const d = add(geo('hdrape' + L, () => { const g = new THREE.CylinderGeometry(0.122, 0.12, L, 16, 1, true, 0.95, Math.PI * 2 - 1.9); g.translate(0, -L / 2, 0); return g; }), hm, 0, -0.03, -0.008, head);
      d.scale.z = 1.05; hm.side = THREE.DoubleSide;
    }
  }
  // glasses and shades
  if (!hijab || Math.random() < 0.5) {
    const gl = opts.glasses === 'specs' ? 0.2 : opts.glasses === 'shades' ? 0.05 : opts.glasses === 'none' ? 1 : Math.random();
    if (gl < 0.14) { add(geo('shades2', () => merge([[new THREE.BoxGeometry(0.075, 0.034, 0.014), M(-0.043, 0.026, 0.115)], [new THREE.BoxGeometry(0.075, 0.034, 0.014), M(0.043, 0.026, 0.115)], [new THREE.BoxGeometry(0.03, 0.008, 0.01), M(0, 0.034, 0.108)], [new THREE.BoxGeometry(0.012, 0.008, 0.2), M(-0.0975, 0.034, 0.0)], [new THREE.BoxGeometry(0.012, 0.008, 0.2), M(0.0975, 0.034, 0.0)]])), std('#0c0c10', 0.25), 0, 0, 0, head); }
    else if (gl < 0.26) { add(geo('specs', () => merge([[new THREE.TorusGeometry(0.03, 0.0035, 6, 16), M(-0.043, 0.026, 0.12)], [new THREE.TorusGeometry(0.03, 0.0035, 6, 16), M(0.043, 0.026, 0.12)], [new THREE.BoxGeometry(0.02, 0.004, 0.004), M(0, 0.034, 0.12)], [new THREE.BoxGeometry(0.005, 0.005, 0.2), M(-0.098, 0.034, 0.02)], [new THREE.BoxGeometry(0.005, 0.005, 0.2), M(0.098, 0.034, 0.02)]])), std('#1a1a1a', 0.4), 0, 0, 0, head); }
  }

  // accessories
  {
    const acc = police ? -1 : opts.acc !== undefined ? opts.acc : (Math.random() < 0.55 ? Math.floor(Math.random() * 9) : -1);
    const acol = opts.accColor || pick(['#c0392b', '#2e6fb5', '#222222', '#f2f2ee', '#2f8f5b', '#e0a030', '#6b3fa0']);
    const A = c => std(c, 0.8);
    if (acc === 0 && !hijab) {
      add(geo('capd', () => new THREE.SphereGeometry(0.128, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.5)), A(acol), 0, 0.035, -0.012, head);
      add(geo('capv', () => new THREE.BoxGeometry(0.15, 0.012, 0.09)), A(acol), 0, 0.05, 0.135, head).rotation.x = 0.1;
    } else if (acc === 1 && !female && style !== 'curly') {
      add(geo('kufi', () => new THREE.SphereGeometry(0.11, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.3)), A('#f4f1e6'), 0, 0.078, -0.004, head);
    } else if (acc === 2 && !female) {
      add(geo('wool', () => new THREE.SphereGeometry(0.126, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.5)), A(acol), 0, 0.042, -0.008, head);
      add(geo('woolb', () => new THREE.TorusGeometry(0.119, 0.02, 6, 16)), A('#e9e2d0'), 0, 0.042, -0.004, head).rotation.x = Math.PI / 2;
    } else if (acc === 3) {
      add(geo('bpk', () => merge([[new THREE.CapsuleGeometry(0.1, 0.17, 4, 10), M(0, 0, 0, 1.25, 1, 0.62)], [new THREE.CapsuleGeometry(0.07, 0.07, 4, 8), M(0, -0.09, -0.075, 1.25, 1, 0.6)]])), A(acol), 0, 1.3, -0.15, body, true);
      for (const sx of [-1, 1]) add(geo('bps', () => new THREE.BoxGeometry(0.03, 0.34, 0.03)), A(acol), sx * 0.12, 1.36, 0.0, body);
    } else if (acc === 4) {
      add(geo('bag', () => new THREE.BoxGeometry(0.2, 0.16, 0.08)), A(acol), 0.25, 0.98, 0.04, body);
      add(geo('strap', () => new THREE.BoxGeometry(0.02, 0.62, 0.02)), A(acol), 0.06, 1.3, 0.14, body).rotation.z = -0.55;
    } else if (acc === 5 && !long) {
      const v = add(geo('vest2', () => new THREE.LatheGeometry(profile(P_M, 0.98, 1.52, 8), 18, Math.PI, Math.PI * 2)), A(acol), 0, 0, 0, body); v.scale.set(1.04, 1, 0.68);
    } else if (acc === 6 && !female && !long) {
      add(geo('tie', () => new THREE.BoxGeometry(0.03, 0.26, 0.012)), A(acol), 0, 1.38, 0.133, body);
    } else if (acc === 7 && !hijab) {
      add(geo('hp', () => new THREE.TorusGeometry(0.12, 0.012, 6, 14, Math.PI)), A('#1e1e1e'), 0, 0.012, 0, head);
      for (const sx of [-1, 1]) add(geo('hpc', () => new THREE.SphereGeometry(0.03, 8, 6)), A('#1e1e1e'), sx * 0.115, 0, 0, head).scale.set(0.5, 1, 1);
    } else if (acc === 8 && !long) {
      add(geo('scarf', () => new THREE.TorusGeometry(0.078, 0.032, 6, 14)), A(acol), 0, 1.58, 0, body).rotation.x = Math.PI / 2;
    }
  }

  // arms
  const mkArm = sx => {
    const sw = female ? 0.218 : 0.236;
    const sh = new THREE.Group(); sh.position.set(sx * sw, 1.5, 0); body.add(sh);
    add(geo('uarmS', () => new THREE.CapsuleGeometry(0.048, 0.2, 4, 10).translate(0, -0.15, 0)), longSleeves ? sleeve : skin, 0, 0, 0, sh, true);
    if (!longSleeves) add(geo('uslv', () => new THREE.CapsuleGeometry(0.054, 0.11, 4, 10).translate(0, -0.075, 0)), sleeve, 0, 0, 0, sh);
    const el = new THREE.Group(); el.position.y = -0.3; sh.add(el);
    add(geo('farm2', () => new THREE.CapsuleGeometry(0.038, 0.19, 4, 10).translate(0, -0.14, 0)), longSleeves ? sleeve : skin, 0, 0, 0, el, true);
    if (longSleeves) add(geo('cuff', () => cyl(0.04, 0.04, 0.03, 12, -0.255)), std(shade(topHex, 0.8), 0.8), 0, 0, 0, el);
    add(geo('hand2', () => merge([
      [new THREE.SphereGeometry(0.036, 12, 10), M(0, -0.29, 0, 0.9, 1.1, 0.6)],
      [new THREE.CapsuleGeometry(0.0095, 0.03, 3, 6), M(-sx * 0.026, -0.282, 0.014, 1, 1, 1, 0, sx * 0.5)],
      [new THREE.CapsuleGeometry(0.0125, 0.045, 3, 6), M(0, -0.33, 0.004, 1.9, 1, 0.8)]
    ])), skin, 0, 0, 0, el);
    return { sh, el };
  };
  const aL = mkArm(-1), aR = mkArm(1);

  // legs
  const mkLeg = sx => {
    const hp = new THREE.Group(); hp.position.set(sx * (female ? 0.082 : 0.09), 0.93, 0); body.add(hp);
    const trousers = !long || kind === 'dress' ? true : true;
    add(geo('thigh2', () => cyl(0.079, 0.062, 0.46, 14, -0.23)), long && kind === 'galabeya' ? bottomMat : bottomMat, 0, 0, 0, hp, true);
    const kn = new THREE.Group(); kn.position.y = -0.46; hp.add(kn);
    add(geo('knee2', () => new THREE.SphereGeometry(0.06, 10, 8)), bottomMat, 0, 0, 0, kn);
    add(geo('shin2', () => cyl(0.06, 0.046, 0.44, 14, -0.22)), long && kind !== 'dress' ? skin : bottomMat, 0, 0, 0, kn, true);
    if (long && kind !== 'dress') add(geo('ank', () => cyl(0.047, 0.044, 0.06, 10, -0.43)), skin, 0, 0, 0, kn);
    add(geo('shoeU', () => { const g = new THREE.CapsuleGeometry(0.046, 0.15, 4, 10); g.rotateX(Math.PI / 2); g.scale(1.0, 0.72, 1); return g; }), shoe, 0, -0.452, 0.06, kn);
    add(geo('sole2', () => new THREE.BoxGeometry(0.102, 0.022, 0.285)), std(shoeHex === '#e8e8e8' ? '#cfcfcf' : '#dcd8cf', 0.7), 0, -0.488, 0.062, kn);
    return { hp, kn };
  };
  const lL = mkLeg(-1), lR = mkLeg(1);
  root.userData = { body, tor, head, aL, aR, lL, lR, long, mats: { top: tmat, bottom: long ? tmat : bottomMat, skin }, scale: body.scale };
  return root;
}
