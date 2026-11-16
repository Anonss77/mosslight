export class Audio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.voices = 0;
    this.muted = false;
    this.headless = false;
    this.musicOn = false;
    this.musicTimer = null;
    this.musicStep = 0;
  }

  unlock() {
    if (this.headless) return;
    this.ensure();
    this.startMusic();
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.6;
      this.master.connect(this.ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }

  tone(type, f0, f1, dur, gain, when = 0) {
    if (!this.ctx || this.muted || this.voices >= 8) return;
    const t0 = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(1, f0), t0);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.08);
    g.gain.linearRampToValueAtTime(0, t0 + dur + 0.04);
    o.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0 + dur + 0.1);
    this.voices++;
    o.onended = () => { this.voices--; };
  }

  noise(dur, gain, freq = 900, type = 'highpass', when = 0) {
    if (!this.ctx || this.muted || this.voices >= 8) return;
    const t0 = this.ctx.currentTime + when;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.linearRampToValueAtTime(0, t0 + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t0); src.stop(t0 + dur);
    this.voices++;
    src.onended = () => { this.voices--; };
  }

  startMusic() {
    if (this.musicOn || !this.ctx) return;
    this.musicOn = true; this.musicStep = 0;
    const CH = [[220, 261.63, 329.63], [174.61, 220, 261.63], [196, 246.94, 293.66], [164.81, 196, 246.94]];
    const MEL = [440, 0, 523.25, 0, 659.25, 0, 523.25, 0, 392, 0, 440, 0, 523.25, 0, 0, 0];
    this.musicTimer = setInterval(() => {
      const s = this.musicStep, bar = (s / 16 | 0) % 4;
      if (s % 16 === 0) for (const f of CH[bar]) this.tone('triangle', f, f, 1.8, 0.045);
      const m = MEL[s % 16];
      if (m) this.tone('sine', m, m, 0.4, 0.055);
      this.musicStep++;
    }, 250);
  }

  play(name) {
    if (!this.ctx || this.muted) return;
    switch (name) {
      case 'bolt':
        this.tone('square', 880, 120, 0.08, 0.12);
        this.noise(0.05, 0.10, 4000, 'highpass');
        break;
      case 'slash':
        this.noise(0.18, 0.22, 2500, 'bandpass');
        this.tone('sawtooth', 320, 90, 0.12, 0.12);
        break;
      case 'ember':
        this.noise(0.35, 0.25, 900, 'lowpass');
        this.tone('sawtooth', 180, 60, 0.3, 0.18);
        break;
      case 'shield':
        this.tone('sine', 660, 660, 0.25, 0.2);
        this.tone('sine', 990, 990, 0.35, 0.16, 0.08);
        break;
      case 'starfall':
        this.tone('sine', 300, 1200, 0.4, 0.1);
        this.noise(0.4, 0.08, 3000, 'highpass');
        break;
      case 'boom':
        this.noise(0.5, 0.35, 300, 'lowpass');
        this.tone('sine', 70, 35, 0.5, 0.35);
        break;
      case 'frost':
        this.noise(0.3, 0.2, 5000, 'highpass');
        this.tone('sine', 1200, 300, 0.25, 0.12);
        break;
      case 'heal':
        this.tone('sine', 520, 780, 0.12, 0.12);
        this.tone('sine', 780, 1040, 0.18, 0.12, 0.1);
        break;
      case 'buy':
        this.tone('sine', 660, 880, 0.1, 0.14);
        this.tone('sine', 990, 990, 0.15, 0.12, 0.09);
        break;
      case 'magnet': this.tone('sine', 300, 900, 0.2, 0.15); break;
      case 'pop': this.tone('square', 500, 900, 0.08, 0.15); break;
      case 'shard': this.tone('sine', 1200, 1800, 0.1, 0.15); break;
      case 'hit': this.tone('triangle', 280, 110, 0.10, 0.18); break;
      case 'death':
        this.noise(0.12, 0.12, 900, 'highpass');
        this.tone('triangle', 190, 90, 0.12, 0.10);
        break;
      case 'warn': this.tone('square', 440, 440, 0.08, 0.06); break;
      case 'hurt': this.tone('sawtooth', 180, 90, 0.15, 0.15); break;
      case 'coin':
        this.tone('sine', 760, 1180, 0.09, 0.14);
        this.tone('sine', 1180, 1420, 0.07, 0.14, 0.09);
        break;
      case 'tinket': this.tone('sine', 1200, 900, 0.06, 0.06); break;
      case 'slam': this.noise(0.15, 0.15, 300, 'lowpass'); break;
      case 'ring': this.tone('sine', 660, 660, 0.30, 0.12); break;
      case 'fan': this.noise(0.10, 0.08, 2000, 'highpass'); break;
      case 'echo': this.tone('sine', 440, 220, 0.20, 0.10); break;
      case 'roar':
        for (const [f0, f1] of [[68, 48], [72, 52], [75, 55]]) {
          this.tone('sawtooth', f0, f1, 0.8, 0.10);
        }
        this.noise(0.25, 0.08, 400, 'lowpass');
        break;
      case 'victory':
        [523, 659, 784, 1047].forEach((f, i) => this.tone('sine', f, f, 0.18, 0.12, i * 0.14));
        break;
      case 'defeat':
        [392, 330, 262].forEach((f, i) => this.tone('triangle', f, f, 0.25, 0.12, i * 0.28));
        break;
      default: break;
    }
  }
}
