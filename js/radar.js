import { CFG, span, roadCoord, blockCoord } from './config.js';

const BASE_PX = 1024;

function baseMap(style, parks) {
  const S = span(), s = BASE_PX / S;
  const cv = document.createElement('canvas');
  cv.width = cv.height = BASE_PX;
  const g = cv.getContext('2d');
  const px = v => (v + S / 2) * s;
  const pal = style === 'radar'
    ? { land: '#27384a', block: '#34485e', park: '#2f5f4a', road: '#b9c4d0', casing: '#1a2430' }
    : { land: '#c4bda8', block: '#d3cdb9', park: '#9cc596', road: '#fffdf6', casing: '#8f8873' };
  g.fillStyle = pal.land; g.fillRect(0, 0, BASE_PX, BASE_PX);
  const parkSet = new Set(parks.map(p => p[0] + ',' + p[1]));
  for (let k = 0; k < CFG.grid; k++)
    for (let l = 0; l < CFG.grid; l++) {
      g.fillStyle = parkSet.has(k + ',' + l) ? pal.park : pal.block;
      g.fillRect(px(blockCoord(k) - CFG.block / 2 - 2), px(blockCoord(l) - CFG.block / 2 - 2), (CFG.block + 4) * s, (CFG.block + 4) * s);
    }
  // roads: casing first, then fill (GTA style outlined roads)
  for (const [w, col] of [[CFG.road + 2.2, pal.casing], [CFG.road - 1, pal.road]]) {
    g.fillStyle = col;
    for (let i = 0; i <= CFG.grid; i++) {
      g.fillRect(0, px(roadCoord(i) - w / 2), BASE_PX, w * s);
      g.fillRect(px(roadCoord(i) - w / 2), 0, w * s, BASE_PX);
    }
  }
  if (style === 'pause') {
    g.fillStyle = 'rgba(40,50,70,.55)'; g.font = 'bold 26px Tahoma, Arial'; g.textAlign = 'center';
    g.fillText('وسط البلد', px(0), px(0));
    g.fillText('الكورنيش', px(-S * 0.28), px(S * 0.32));
    g.fillText('المنطقة الصناعية', px(S * 0.26), px(-S * 0.3));
    g.fillText('الحي القديم', px(-S * 0.28), px(-S * 0.26));
    g.fillText('الميناء', px(S * 0.28), px(S * 0.3));
  }
  return cv;
}

function blip(g, x, y, kind, t) {
  g.save();
  g.translate(x, y);
  if (kind === 'marker') {
    g.fillStyle = '#ffd23f'; g.strokeStyle = '#000'; g.lineWidth = 2;
    g.beginPath(); g.arc(0, 0, 9, 0, 7); g.fill(); g.stroke();
  } else if (kind === 'police') {
    const on = Math.floor(t * 4) % 2 === 0;
    g.fillStyle = on ? '#ff3b3b' : '#3b82ff'; g.strokeStyle = '#fff'; g.lineWidth = 2;
    g.beginPath(); g.arc(0, 0, 8, 0, 7); g.fill(); g.stroke();
  } else if (kind === 'weapon') {
    g.fillStyle = '#e8e8e8'; g.fillRect(-6, -6, 12, 12);
  }
  g.restore();
}

export class Radar {
  constructor(canvas, pauseCanvas, parks) {
    this.cv = canvas; this.g = canvas.getContext('2d');
    this.pcv = pauseCanvas; this.pg = pauseCanvas.getContext('2d');
    this.radarBase = baseMap('radar', parks);
    this.pauseBase = baseMap('pause', parks);
    this.S = span();
    this.range = 105; // metres from centre to ring edge
  }

  draw(info, t) {
    const g = this.g, W = this.cv.width, C = W / 2, S = this.S;
    const k = C / this.range;
    const th = info.heading + Math.PI;
    g.fillStyle = '#17202c'; g.fillRect(0, 0, W, W);
    g.save();
    g.translate(C, C); g.rotate(th); g.scale(k, k); g.translate(-info.x, -info.z);
    g.drawImage(this.radarBase, -S / 2, -S / 2, S, S);
    g.restore();
    const cs = Math.cos(th), sn = Math.sin(th);
    const place = (wx, wz, kind) => {
      const dx = wx - info.x, dz = wz - info.z;
      let rx = (dx * cs - dz * sn) * k, ry = (dx * sn + dz * cs) * k;
      const d = Math.hypot(rx, ry), lim = C - 12;
      if (d > lim) { rx *= lim / d; ry *= lim / d; }
      blip(g, C + rx, C + ry, kind, t);
    };
    if (info.marker) place(info.marker.x, info.marker.z, 'marker');
    for (const p of info.police) place(p.x, p.z, 'police');
    // player arrow (always up)
    g.save(); g.translate(C, C);
    g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(0, -15); g.lineTo(11, 12); g.lineTo(0, 6); g.lineTo(-11, 12); g.closePath(); g.stroke(); g.fill();
    g.restore();
    // north marker
    g.fillStyle = '#fff'; g.font = 'bold 22px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('N', C + Math.sin(th) * (C - 16), C - Math.cos(th) * (C - 16));
    // subtle ring shade
    const gr = g.createRadialGradient(C, C, C * 0.78, C, C, C);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.45)');
    g.fillStyle = gr; g.fillRect(0, 0, W, W);
  }

  drawPause(info, t) {
    const g = this.pg, W = this.pcv.width, S = this.S;
    g.fillStyle = '#8fb4d1'; g.fillRect(0, 0, W, W);
    const size = W * 0.9, off = (W - size) / 2, k = size / S;
    g.drawImage(this.pauseBase, off, off, size, size);
    g.strokeStyle = '#6f879c'; g.lineWidth = 4; g.strokeRect(off, off, size, size);
    g.fillStyle = '#1fb7d6'; g.fillRect(off, off + size + 6, size, W - off - size - 6);
    g.fillStyle = '#fff'; g.font = 'bold 22px Tahoma, Arial'; g.textAlign = 'center'; g.fillText('البحر ↓ كورنيش وملاهي ومرسى', W / 2, off + size + 30);
    const pt = (x, z) => [off + (x + S / 2) * k, off + (z + S / 2) * k];
    if (info.marker) { const [x, y] = pt(info.marker.x, info.marker.z); blip(g, x, y, 'marker', t); }
    for (const p of info.police) { const [x, y] = pt(p.x, p.z); blip(g, x, y, 'police', t); }
    const [ax, ay] = pt(info.x, info.z);
    g.save(); g.translate(ax, ay); g.rotate(Math.PI - info.heading);
    g.fillStyle = '#1b6cff'; g.strokeStyle = '#fff'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(0, -16); g.lineTo(12, 13); g.lineTo(0, 7); g.lineTo(-12, 13); g.closePath(); g.fill(); g.stroke();
    g.restore();
  }
}
