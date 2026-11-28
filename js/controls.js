// keyboard + mouse + touch input (joystick, look-drag, buttons)
export class Controls {
  constructor() {
    this.keys = {};
    this.stick = { x: 0, y: 0, active: false, id: -1 };
    this.brakeHeld = false; this.fireHeld = false; this.mouseFire = false;
    this.edge = {};
    this.lookDX = 0; this.lookDY = 0;
    this.lastLook = -99;
    const E = n => { this.edge[n] = true; };

    window.addEventListener('keydown', e => {
      if (e.repeat) return;
      this.keys[e.code] = true;
      const m = { KeyE: 'action', KeyR: 'reload', KeyQ: 'weapon', KeyM: 'map', KeyP: 'settings', KeyJ: 'menu', Digit1: 'w1', Digit2: 'w2', Digit3: 'w3', Digit0: 'w0', Escape: 'esc', KeyH: 'reset' }[e.code];
      if (m) E(m);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', e => { this.keys[e.code] = false; });
    window.addEventListener('blur', () => { this.keys = {}; this.fireHeld = false; this.mouseFire = false; });

    // touch joystick
    const stick = document.getElementById('stick');
    const knob = document.getElementById('knob');
    const setKnob = (dx, dy) => { knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`; };
    const mv = e => {
      const r = stick.getBoundingClientRect(), R = r.width * 0.34;
      let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      const d = Math.hypot(dx, dy);
      if (d > R) { dx = dx / d * R; dy = dy / d * R; }
      this.stick.x = dx / R; this.stick.y = dy / R; setKnob(dx, dy);
    };
    stick.addEventListener('pointerdown', e => { this.stick.id = e.pointerId; this.stick.active = true; stick.setPointerCapture(e.pointerId); mv(e); e.preventDefault(); });
    stick.addEventListener('pointermove', e => { if (e.pointerId === this.stick.id) mv(e); });
    const end = e => { if (e.pointerId !== this.stick.id) return; this.stick.id = -1; this.stick.active = false; this.stick.x = 0; this.stick.y = 0; setKnob(0, 0); };
    stick.addEventListener('pointerup', end); stick.addEventListener('pointercancel', end);

    const hold = (id, on, off) => {
      const b = document.getElementById(id);
      b.addEventListener('pointerdown', e => { on(); try { b.setPointerCapture(e.pointerId); } catch (_) {} e.preventDefault(); });
      b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off);
    };
    this.arr = { u: false, d: false, l: false, r: false };
    for (const k of ['u', 'd', 'l', 'r']) hold('arr_' + k, () => { this.arr[k] = true; }, () => { this.arr[k] = false; });
    hold('btnBrake', () => { this.brakeHeld = true; }, () => { this.brakeHeld = false; });
    hold('btnFire', () => { this.fireHeld = true; }, () => { this.fireHeld = false; });
    document.getElementById('btnAction').addEventListener('pointerdown', e => { E('action'); e.preventDefault(); });
    document.getElementById('btnWeapon').addEventListener('pointerdown', e => { E('weapon'); e.preventDefault(); });

    // look-drag: touch on the canvas (any finger not on a button; right 60% of the screen), mouse right/middle drag
    const cv = document.getElementById('c');
    const looks = new Map();
    cv.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse') {
        if (e.button === 0) { this.mouseFire = true; }
        if (e.button === 2 || e.button === 1) { looks.set(e.pointerId, [e.clientX, e.clientY]); cv.setPointerCapture(e.pointerId); }
      } else if (e.clientX > window.innerWidth * 0.38) {
        looks.set(e.pointerId, [e.clientX, e.clientY]); cv.setPointerCapture(e.pointerId);
      }
      e.preventDefault();
    });
    cv.addEventListener('pointermove', e => {
      const p = looks.get(e.pointerId);
      if (p) {
        this.lookDX += e.clientX - p[0]; this.lookDY += e.clientY - p[1];
        p[0] = e.clientX; p[1] = e.clientY; this.lastLook = performance.now() / 1000;
      } else if (e.pointerType === 'mouse' && document.pointerLockElement === cv) {
        this.lookDX += e.movementX; this.lookDY += e.movementY; this.lastLook = performance.now() / 1000;
      }
    });
    const up = e => { looks.delete(e.pointerId); if (e.pointerType === 'mouse' && e.button === 0) this.mouseFire = false; };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    window.addEventListener('pointerup', e => { if (e.pointerType === 'mouse' && e.button === 0) this.mouseFire = false; });
    window.addEventListener('mousemove', e => { if (document.pointerLockElement === cv) { this.lookDX += e.movementX; this.lookDY += e.movementY; this.lastLook = performance.now() / 1000; } });
    window.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('gesturestart', e => e.preventDefault());
    this.canvas = cv;
  }

  // look delta in pixels since last call
  look() { if (this.locked) { this.lookDX = this.lookDY = 0; return { x: 0, y: 0 }; } const d = { x: this.lookDX, y: this.lookDY }; this.lookDX = 0; this.lookDY = 0; return d; }
  lookIdle(now) { return now - this.lastLook; }
  pressed(n) { if (this.locked && n !== 'esc') { this.edge[n] = false; return false; } const v = !!this.edge[n]; this.edge[n] = false; return v; }
  actionPressed() { return this.pressed('action'); }
  resetPressed() { return this.pressed('reset'); }
  fire() { if (this.locked) return false; return this.fireHeld || this.mouseFire || !!this.keys['KeyF']; }

  // foot input: x = right, z = forward (screen relative)
  foot() {
    let x = 0, z = 0; if (this.locked) return { x, z };
    if (this.keys['KeyW'] || this.keys['ArrowUp']) z += 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) z -= 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) x -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) x += 1;
    if (this.stick.active) { x = this.stick.x; z = -this.stick.y; }
    return { x, z };
  }

  car() {
    if (this.locked) return { throttle: 0, steer: 0, brake: true, hand: false };
    let throttle = 0, steer = 0;
    if (this.keys['KeyW'] || this.keys['ArrowUp']) throttle += 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) throttle -= 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) steer += 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) steer -= 1;
    if (this.stick.active) { throttle = -this.stick.y; steer = -this.stick.x; }
    const A = this.arr; if (A && (A.u || A.d || A.l || A.r)) { throttle = (A.u ? 1 : 0) - (A.d ? 1 : 0); steer = (A.l ? 1 : 0) - (A.r ? 1 : 0); }
    const brake = !!this.keys['Space'] || this.brakeHeld;
    const hand = !!(this.keys['ShiftLeft'] || this.keys['ShiftRight']);
    return { throttle, steer, brake, hand };
  }
}
