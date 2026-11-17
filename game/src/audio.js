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
this.master.gain.value = .6;
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
g.gain.linearRampToValueAtTime(gain, t0 + .08);
g.gain.linearRampToValueAtTime(0, t0 + dur + .04);
o.connect(g); g.connect(this.master);
o.start(t0); o.stop(t0 + dur + .1);
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
if (s % 16 === 0) for (const f of CH[bar]) this.tone('triangle', f, f, 1.8, .045);
const m = MEL[s % 16];
if (m) this.tone('sine', m, m, .4, .055);
this.musicStep++;
}, 250);
}
play(name) {
if (!this.ctx || this.muted) return;
switch (name) {
case 'bolt':
this.tone('square', 880, 120, .08, .12);
this.noise(.05, .10, 4000, 'highpass');
break;
case 'wave':this.noise(.12,.18,1200,'bandpass');break;
case 'arrow':this.tone('triangle',900,300,.07,.14);break;
case 'skBolt':this.tone('sawtooth',660,220,.12,.14);this.noise(.12,.14,3000,'highpass');break;
case 'skChg':this.tone('square',1200,800,.15,.12);this.noise(.12,.2,300,'lowpass');break;
case 'skWhirl':this.noise(.5,.25,500,'bandpass');break;
case 'skVol':for(let i=0;i<2;i++)this.tone('triangle',1200,400,.08,.14,i*.08);break;
case 'skMoon':this.tone('triangle',1800,400,.5,.1);break;
case 'skArc':
this.noise(.18, .22, 2500, 'bandpass');
this.tone('sawtooth', 320, 90, .12, .12);
break;
case 'skEmber':
this.noise(.35, .25, 900, 'lowpass');
this.tone('sawtooth', 180, 60, .3, .18);
break;
case 'skStar':
this.tone('sine', 300, 1200, .4, .1);
this.noise(.4, .08, 3000, 'highpass');
break;
case 'boom':
this.noise(.5, .35, 300, 'lowpass');
this.tone('sine', 70, 35, .5, .35);
break;
case 'skFrost':
this.noise(.3, .2, 5000, 'highpass');
this.tone('sine', 1200, 300, .25, .12);
break;
case 'heal':
this.tone('sine', 520, 780, .12, .12);
this.tone('sine', 780, 1040, .18, .12, .1);
break;
case 'buy':
this.tone('sine', 660, 880, .1, .14);
this.tone('sine', 990, 990, .15, .12, .09);
break;
case 'pop': this.tone('square', 500, 900, .08, .15); break;
case 'shard': this.tone('sine', 1200, 1800, .1, .15); break;
case 'hit': this.tone('triangle', 280, 110, .10, .18); break;
case 'death':
this.noise(.12, .12, 900, 'highpass');
this.tone('triangle', 190, 90, .12, .10);
break;
case 'warn': this.tone('square', 440, 440, .08, .06); break;
case 'hurt': this.tone('sawtooth', 180, 90, .15, .15); break;
case 'coin':
this.tone('sine', 760, 1180, .09, .14);
this.tone('sine', 1180, 1420, .07, .14, .09);
break;
case 'tinket': this.tone('sine', 1200, 900, .06, .06); break;
case 'slam': this.noise(.15, .15, 300, 'lowpass'); break;
case 'ring': this.tone('sine', 660, 660, .30, .12); break;
case 'fan': this.noise(.10, .08, 2000, 'highpass'); break;
case 'echo': this.tone('sine', 440, 220, .20, .10); break;
case 'roar':
for (const [f0, f1] of [[68, 48], [72, 52], [75, 55]]) {
this.tone('sawtooth', f0, f1, .8, .10);
}
this.noise(.25, .08, 400, 'lowpass');
break;
case 'victory':
[523, 659, 784, 1047].forEach((f, i) => this.tone('sine', f, f, .18, .12, i * .14));
break;
case 'defeat':
[392, 330, 262].forEach((f, i) => this.tone('triangle', f, f, .25, .12, i * .28));
break;
default: break;
}
}
}
