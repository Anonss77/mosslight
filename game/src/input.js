// Mosslight — input. Keyboard (WASD/arrows move, J/K/L/Space skills,
// Escape pause, Enter confirm) plus touch: a virtual joystick on the left
// half of the screen and round skill buttons on the right. The joystick
// element itself is DOM; this module wires pointer events and exposes one
// clean movement vector plus skill triggers.

export class Input {
  constructor(stage) {
    this.stage = stage;
    this.keys = new Set();
    this.joy = { active: false, id: -1, dx: 0, dy: 0 };
    this.aim = { x: 1, y: 0 };      // last aim direction (for Ember Bloom)
    this.skillQueue = [];           // skill ids pressed since last frame
    this.pausePressed = false;
    this.confirmPressed = false;
    this.joyEl = null;
    this.thumbEl = null;
    this.bindKeyboard();
  }

  bindKeyboard() {
    window.addEventListener('keydown', (e) => {
      if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
      if (e.repeat) return;
      this.keys.add(e.key.toLowerCase());
      const k = e.key.toLowerCase();
      if (k === 'j') this.skillQueue.push('crescent');
      if (k === 'k') this.skillQueue.push('ember');
      if (k === 'l') this.skillQueue.push('glassguard');
      if (k === ' ') this.skillQueue.push('starfall');
      if (k === 'escape') this.pausePressed = true;
      if (k === 'enter') this.confirmPressed = true;
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());
  }

  // Wire the DOM joystick (outer ring + thumb). Movement follows the
  // pointer inside the ring, up to 31px of thumb travel.
  bindJoystick(joyEl, thumbEl) {
    this.joyEl = joyEl;
    this.thumbEl = thumbEl;
    const rect = () => joyEl.getBoundingClientRect();
    const setFromEvent = (e) => {
      const r = rect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      let dx = e.clientX - cx, dy = e.clientY - cy;
      const len = Math.hypot(dx, dy);
      const max = 31 * (r.width / 112); // scale with the rendered size
      if (len > max) { dx = dx / len * max; dy = dy / len * max; }
      this.joy.dx = dx / max;
      this.joy.dy = dy / max;
      thumbEl.style.transform = `translate(${dx}px, ${dy}px)`;
      if (len > 4) this.aim = { x: dx / len, y: dy / len };
    };
    joyEl.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.joy.active = true;
      this.joy.id = e.pointerId;
      joyEl.setPointerCapture(e.pointerId);
      setFromEvent(e);
    });
    joyEl.addEventListener('pointermove', (e) => {
      if (this.joy.active && e.pointerId === this.joy.id) setFromEvent(e);
    });
    const end = (e) => {
      if (e.pointerId !== this.joy.id) return;
      this.joy.active = false;
      this.joy.dx = 0; this.joy.dy = 0;
      thumbEl.style.transform = 'translate(0px, 0px)';
    };
    joyEl.addEventListener('pointerup', end);
    joyEl.addEventListener('pointercancel', end);
  }

  // Wire one skill button element to queue its skill on press.
  bindSkillButton(el, skillId) {
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.skillQueue.push(skillId);
    });
  }

  // Movement vector from keyboard or joystick, normalised.
  moveVec() {
    let x = 0, y = 0;
    const k = this.keys;
    if (k.has('a') || k.has('arrowleft')) x -= 1;
    if (k.has('d') || k.has('arrowright')) x += 1;
    if (k.has('w') || k.has('arrowup')) y -= 1;
    if (k.has('s') || k.has('arrowdown')) y += 1;
    if (x || y) {
      const len = Math.hypot(x, y);
      return { x: x / len, y: y / len };
    }
    if (this.joy.active) return { x: this.joy.dx, y: this.joy.dy };
    return { x: 0, y: 0 };
  }

  // Drain the queued skill presses (called once per frame by the game).
  takeSkills() {
    const q = this.skillQueue;
    this.skillQueue = [];
    return q;
  }

  takePause() { const p = this.pausePressed; this.pausePressed = false; return p; }
  takeConfirm() { const c = this.confirmPressed; this.confirmPressed = false; return c; }
}
