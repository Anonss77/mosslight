// Mosslight v4 — audio. Web Audio API only: oscillators and generated
// noise, no audio files. The sim calls audio.play(name) for every event;
// in headless test mode main.js sets audio.headless = true, so unlock()
// never creates a context and play() is a silent no-op (the sim must
// never wait on sound). Master volume 0.6, at most 8 voices at once.

export class Audio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.voices = 0;
    this.muted = false;
    this.headless = false;
  }

  // Called on the first user gesture (start button). No-op in tests.
  unlock() {
    if (this.headless) return;
    this.ensure();
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

  // One tone: waveform, frequency slide from f0 to f1 over dur, gain.
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

  // Filtered noise burst (impacts, roars, deaths).
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

  // Every name game.js plays.
  play(name) {
    if (!this.ctx || this.muted) return;
    switch (name) {
      case 'bolt': this.tone('square', 880, 220, 0.07, 0.08); break;
      case 'hit': this.tone('triangle', 280, 110, 0.10, 0.18); break;
      case 'death':
        this.noise(0.12, 0.12, 900, 'highpass');
        this.tone('triangle', 190, 90, 0.12, 0.10);
        break;
      case 'skill': this.tone('sawtooth', 240, 560, 0.16, 0.12); break;
      case 'shield': this.tone('sine', 330, 660, 0.18, 0.10); break;
      case 'warn': this.tone('square', 440, 440, 0.08, 0.06); break;
      case 'hurt': this.tone('sawtooth', 180, 90, 0.15, 0.15); break;
      case 'coin':
        this.tone('sine', 760, 1180, 0.09, 0.14);
        this.tone('sine', 1180, 1420, 0.07, 0.14, 0.09);
        break;
      case 'heart': this.tone('sine', 520, 780, 0.12, 0.12); break;
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
