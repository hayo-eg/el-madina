// Shared city configuration + math helpers
export const CFG = {
  grid: 7,            // blocks per axis
  block: 44,          // block size (meters)
  road: 14,           // road width
  laneOff: 3.3,       // lane offset from road center
  trafficCount: 9,
  parkedCount: 16,
  walkSpeed: 7.2,
  carAccel: 17,
  carBrake: 36,
  carDrag: 0.55,
  carMax: 41,
  carRevMax: 12,
  steerMax: 0.62,
  turnRate: 2.6,
  wheelBase: 3.1,
  bounds: 0,          // filled below
};

export function span() { return CFG.grid * (CFG.block + CFG.road) + CFG.road; }
CFG.bounds = span() / 2 + 46;

// road line center coordinate, i in 0..grid
export function roadCoord(i) { return -span() / 2 + CFG.road / 2 + i * (CFG.block + CFG.road); }
// block center coordinate, k in 0..grid-1
export function blockCoord(k) { return roadCoord(k) + CFG.road / 2 + CFG.block / 2; }

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
export function fwd(h) { return { x: Math.sin(h), z: Math.cos(h) }; }

// push a circle (x,z,r) out of AABB list; returns corrected {x,z,hit,nx,nz}
export function collideCircleAABBs(x, z, r, boxes) {
  let hit = false, nx = 0, nz = 0;
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i];
    if (x < b.minX - r || x > b.maxX + r || z < b.minZ - r || z > b.maxZ + r) continue;
    const cx = clamp(x, b.minX, b.maxX);
    const cz = clamp(z, b.minZ, b.maxZ);
    let dx = x - cx, dz = z - cz;
    let d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    hit = true;
    if (d2 < 1e-6) {
      // center inside box: push out along smallest axis
      const px = Math.min(x - b.minX, b.maxX - x);
      const pz = Math.min(z - b.minZ, b.maxZ - z);
      if (px < pz) { nx = (x - b.minX < b.maxX - x) ? -1 : 1; nz = 0; x += nx * (px + r); }
      else { nz = (z - b.minZ < b.maxZ - z) ? -1 : 1; nx = 0; z += nz * (pz + r); }
    } else {
      const d = Math.sqrt(d2);
      nx = dx / d; nz = dz / d;
      const push = r - d;
      x += nx * push; z += nz * push;
    }
  }
  return { x, z, hit, nx, nz };
}
