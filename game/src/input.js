
export class Input {
  constructor() {
    if (!window.__keys) window.__keys = new Set();
    if (!window.__joy) window.__joy = { x: 0, y: 0 };
    if (!window.__castQueue) window.__castQueue = [];
    this.joy = { active: false, id: -1 };
    this.onPause = null;
    this.onBag = null;
    this.bindKeyboard();
  }

  bindKeyboard() {
    window.addEventListener('keydown', (e) => {
      if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
      window.__keys.add(e.code);
      if (e.repeat) return;
      if (e.code === 'KeyJ' || e.code === 'Space') window.__castQueue.push('attack');
      else if (e.code === 'KeyQ') window.__castQueue.push('s1');
      else if (e.code === 'KeyE') window.__castQueue.push('s2');
      else if (e.code === 'KeyR') window.__castQueue.push('ult');
      else if (e.code === 'KeyB' && this.onBag) this.onBag();
      else if (e.code === 'Escape' && this.onPause) this.onPause();
    });
    window.addEventListener('keyup', (e) => window.__keys.delete(e.code));
    window.addEventListener('blur', () => window.__keys.clear());
  }

  bindJoystick(joyEl, thumbEl) {
    const rect = () => joyEl.getBoundingClientRect();
    const setFromEvent = (e) => {
      const r = rect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      let dx = e.clientX - cx, dy = e.clientY - cy;
      const len = Math.hypot(dx, dy);
      const max = 31 * (r.width / 112);
      if (len > max) { dx = dx / len * max; dy = dy / len * max; }
      window.__joy.x = dx / max;
      window.__joy.y = dy / max;
      thumbEl.style.transform = `translate(${dx}px, ${dy}px)`;
    };
    joyEl.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.joy.active = true;
      this.joy.id = e.pointerId;
      try { joyEl.setPointerCapture(e.pointerId); } catch {  }
      setFromEvent(e);
    });
    joyEl.addEventListener('pointermove', (e) => {
      if (this.joy.active && e.pointerId === this.joy.id) setFromEvent(e);
    });
    const end = (e) => {
      if (e.pointerId !== this.joy.id) return;
      this.joy.active = false;
      window.__joy.x = 0; window.__joy.y = 0;
      thumbEl.style.transform = 'translate(0px, 0px)';
    };
    joyEl.addEventListener('pointerup', end);
    joyEl.addEventListener('pointercancel', end);
  }

  bindSkillButton(el, skillId) {
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      window.__castQueue.push(skillId);
    });
  }

  bindCamera(el) {
    if (!window.__cam) window.__cam = { az: 0, tilt: 38, vaz: 0, vtilt: 0 };
    const cam = window.__cam;
    let drag = null, lastTap = 0;
    const tick = () => {
      if (!drag) {
        cam.az += cam.vaz; cam.vaz *= 0.93;
        cam.tilt = Math.max(25, Math.min(70, cam.tilt + cam.vtilt)); cam.vtilt *= 0.93;
        if (Math.abs(cam.vaz) < 0.0001) cam.vaz = 0;
        if (Math.abs(cam.vtilt) < 0.001) cam.vtilt = 0;
      }
      requestAnimationFrame(tick);
    };
    if (!cam.__tick) { cam.__tick = true; requestAnimationFrame(tick); }
    el.addEventListener('pointerdown', (e) => {
      const now = Date.now();
      if (now - lastTap < 500) { cam.az = 0; cam.tilt = 38; cam.vaz = 0; cam.vtilt = 0; lastTap = 0; return; }
      lastTap = now;
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
      try { el.setPointerCapture(e.pointerId); } catch {  }
    });
    el.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      cam.vaz = dx * 0.005; cam.vtilt = -dy * 0.12;
      cam.az += cam.vaz;
      cam.tilt = Math.max(25, Math.min(70, cam.tilt + cam.vtilt));
      drag.x = e.clientX; drag.y = e.clientY;
    });
    const end = (e) => { if (drag && e.pointerId === drag.id) drag = null; };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }
}
