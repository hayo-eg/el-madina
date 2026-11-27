// keyboard + touch input
export class Controls {
  constructor() {
    this.keys = {};
    this.stick = { x: 0, y: 0, active: false, id: -1 };
    this.brakeHeld = false;
    this._actionEdge = false;
    this._resetEdge = false;

    window.addEventListener('keydown', e => {
      if (e.repeat) return;
      this.keys[e.code] = true;
      if (e.code === 'KeyE') this._actionEdge = true;
      if (e.code === 'KeyR') this._resetEdge = true;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', e => { this.keys[e.code] = false; });

    // touch joystick
    const stick = document.getElementById('stick');
    const knob = document.getElementById('knob');
    const R = 44;
    const setKnob = (dx, dy) => { knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`; };
    stick.addEventListener('pointerdown', e => {
      this.stick.id = e.pointerId; this.stick.active = true;
      stick.setPointerCapture(e.pointerId);
      this._stickMove(e, stick, R, setKnob);
      e.preventDefault();
    });
    stick.addEventListener('pointermove', e => {
      if (e.pointerId !== this.stick.id) return;
      this._stickMove(e, stick, R, setKnob);
    });
    const end = e => {
      if (e.pointerId !== this.stick.id) return;
      this.stick.id = -1; this.stick.active = false;
      this.stick.x = 0; this.stick.y = 0;
      setKnob(0, 0);
    };
    stick.addEventListener('pointerup', end);
    stick.addEventListener('pointercancel', end);

    const brake = document.getElementById('btnBrake');
    brake.addEventListener('pointerdown', e => { this.brakeHeld = true; e.preventDefault(); });
    brake.addEventListener('pointerup', () => { this.brakeHeld = false; });
    brake.addEventListener('pointercancel', () => { this.brakeHeld = false; });

    const action = document.getElementById('btnAction');
    action.addEventListener('pointerdown', e => { this._actionEdge = true; e.preventDefault(); });

    // block context menu / double-tap zoom
    window.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('gesturestart', e => e.preventDefault());
  }

  _stickMove(e, stick, R, setKnob) {
    const r = stick.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2);
    let dy = e.clientY - (r.top + r.height / 2);
    const d = Math.hypot(dx, dy);
    if (d > R) { dx = dx / d * R; dy = dy / d * R; }
    this.stick.x = dx / R;
    this.stick.y = dy / R;
    setKnob(dx, dy);
  }

  // foot input: camera-relative move vector
  foot() {
    let x = 0, z = 0;
    if (this.keys['KeyW'] || this.keys['ArrowUp']) z += 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) z -= 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) x -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) x += 1;
    if (this.stick.active) { x = this.stick.x; z = -this.stick.y; }
    return { x, z };
  }

  car() {
    let throttle = 0, steer = 0;
    if (this.keys['KeyW'] || this.keys['ArrowUp']) throttle += 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) throttle -= 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) steer += 1;   // steer left
    if (this.keys['KeyD'] || this.keys['ArrowRight']) steer -= 1;
    if (this.stick.active) { throttle = -this.stick.y; steer = -this.stick.x; }
    const brake = !!(this.keys['Space']) || this.brakeHeld;
    return { throttle, steer, brake };
  }

  actionPressed() { const v = this._actionEdge; this._actionEdge = false; return v; }
  resetPressed() { const v = this._resetEdge; this._resetEdge = false; return v; }
}
