


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
      if (e.code === 'KeyJ' || e.code === 'KeyQ') window.__castQueue.push('crescent');
      else if (e.code === 'KeyK' || e.code === 'KeyE') window.__castQueue.push('ember');
      else if (e.code === 'KeyL' || e.code === 'KeyR') window.__castQueue.push('glassguard');
      else if (e.code === 'Space' || e.code === 'KeyF') window.__castQueue.push('starfall');
      else if (e.code === 'KeyC') window.__castQueue.push('frost');
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
}
