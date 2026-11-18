// SOLARA BAY audio: every sound is synthesized with WebAudio.
// No audio files, no network — oscillators and noise buffers only.
export class SoundBank {
  constructor() {
    this.ctx = null; this.muted = false; this.engineOsc = null; this.engineGain = null; this.sirenOn = false;
  }
  ensure() {
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.master = this.ctx.createGain(); this.master.gain.value = 0.35; this.master.connect(this.ctx.destination);
      } catch { this.ctx = null; }
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }
  toggleMute() { this.muted = !this.muted; if (this.master) this.master.gain.value = this.muted ? 0 : 0.35; return this.muted; }
  blip(freq, dur, type = 'sine', vol = 0.3, slideTo = null) {
    if (!this.ensure() || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur);
  }
  noise(dur, vol = 0.3, low = 400) {
    if (!this.ensure() || this.muted) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = low;
    const g = this.ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(this.master); src.start(t);
  }
  pickup() { this.blip(660, 0.09, 'sine', 0.3); setTimeout(() => this.blip(990, 0.12, 'sine', 0.3), 80); }
  shoot() { this.noise(0.12, 0.5, 2400); this.blip(180, 0.08, 'square', 0.2, 60); }
  punch() { this.noise(0.08, 0.4, 500); }
  crash() { this.noise(0.3, 0.5, 700); this.blip(90, 0.25, 'sawtooth', 0.25, 40); }
  steal() { this.blip(300, 0.1, 'square', 0.2, 520); }
  mission() { [523, 659, 784].forEach((f, i) => setTimeout(() => this.blip(f, 0.16, 'sine', 0.3), i * 110)); }
  busted() { [392, 330, 262].forEach((f, i) => setTimeout(() => this.blip(f, 0.22, 'triangle', 0.3), i * 160)); }
  engine(speed01) {
    if (!this.ensure() || this.muted) { this.stopEngine(); return; }
    if (!this.engineOsc) {
      this.engineOsc = this.ctx.createOscillator(); this.engineOsc.type = 'sawtooth';
      this.engineGain = this.ctx.createGain(); this.engineGain.gain.value = 0.0;
      const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 600;
      this.engineOsc.connect(f); f.connect(this.engineGain); this.engineGain.connect(this.master);
      this.engineOsc.start();
    }
    this.engineOsc.frequency.value = 55 + speed01 * 130;
    this.engineGain.gain.value = 0.05 + speed01 * 0.08;
  }
  stopEngine() { if (this.engineGain) this.engineGain.gain.value = 0; }
  siren(on) {
    if (on === this.sirenOn) return; this.sirenOn = on;
    if (!on) { if (this._sirenTimer) clearInterval(this._sirenTimer); this._sirenTimer = null; return; }
    this._sirenTimer = setInterval(() => { if (!this.muted) this.blip(this._sirenHi ? 700 : 950, 0.32, 'sine', 0.07); this._sirenHi = !this._sirenHi; }, 340);
  }
}
