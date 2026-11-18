// Synthesised sound only: every effect is built from WebAudio oscillators and filtered noise,
// so the game ships no audio files and makes no network request. The context is created lazily
// on the first user gesture (browsers block audio before one) and resumes on every gesture.

export function createAudio() {
  let ctx = null;
  let master = null;
  let noiseBuf = null;
  let engineOsc = null;
  let engineOsc2 = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenLfo = null;
  let muted = false;
  let sirenOn = false;

  /** Build the context and the always-on engine and siren voices (silent until driven). */
  function ensure() {
    if (ctx !== null) return true;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return false;
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);

    const len = ctx.sampleRate;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;

    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 55;
    engineOsc2 = ctx.createOscillator();
    engineOsc2.type = 'square';
    engineOsc2.frequency.value = 28;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    const engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    engineOsc.connect(engineFilter);
    engineOsc2.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(master);
    engineOsc.start();
    engineOsc2.start();

    sirenOsc = ctx.createOscillator();
    sirenOsc.type = 'triangle';
    sirenOsc.frequency.value = 780;
    sirenLfo = ctx.createOscillator();
    sirenLfo.type = 'square';
    sirenLfo.frequency.value = 0.9;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 180;
    sirenLfo.connect(lfoGain);
    lfoGain.connect(sirenOsc.frequency);
    sirenGain = ctx.createGain();
    sirenGain.gain.value = 0;
    sirenOsc.connect(sirenGain);
    sirenGain.connect(master);
    sirenOsc.start();
    sirenLfo.start();
    return true;
  }

  /** A short burst of filtered noise: a crash, a shot, a thud, with its own shape. */
  function burst(seconds, filterFreq, type, peak) {
    if (!ensure()) return;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(peak, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + seconds);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(now);
    src.stop(now + seconds + 0.02);
  }

  /** A short tone that slides from one frequency to another. */
  function blip(from, to, seconds, peak, type) {
    if (!ensure()) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(from, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), now + seconds);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(peak, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + seconds);
    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + seconds + 0.02);
  }

  return {
    /** Call from any gesture handler: creates and resumes the context. */
    unlock() {
      if (ensure() && ctx.state === 'suspended') ctx.resume();
    },
    /** Engine hum follows how fast the player's car is going, 0..1; silent on foot. */
    engine(amount) {
      if (!ensure()) return;
      const a = Math.max(0, Math.min(1, amount));
      engineGain.gain.setTargetAtTime(a * 0.12, ctx.currentTime, 0.08);
      engineOsc.frequency.setTargetAtTime(55 + a * 165, ctx.currentTime, 0.08);
      engineOsc2.frequency.setTargetAtTime(28 + a * 82, ctx.currentTime, 0.08);
    },
    /** The two-tone police siren, on while the player is wanted. */
    siren(on) {
      if (!ensure()) return;
      sirenOn = on;
      sirenGain.gain.setTargetAtTime(on && !muted ? 0.045 : 0, ctx.currentTime, 0.15);
    },
    crash() {
      burst(0.35, 300, 'lowpass', 0.5);
      blip(120, 45, 0.25, 0.3, 'sine');
    },
    shot() {
      burst(0.12, 1800, 'highpass', 0.4);
      blip(220, 70, 0.1, 0.25, 'square');
    },
    punch() {
      burst(0.12, 240, 'lowpass', 0.45);
    },
    pickup() {
      blip(520, 940, 0.16, 0.22, 'sine');
    },
    coin() {
      blip(880, 1320, 0.14, 0.2, 'sine');
    },
    mission() {
      blip(523, 523, 0.12, 0.22, 'triangle');
      setTimeout(() => blip(784, 784, 0.18, 0.22, 'triangle'), 110);
    },
    fail() {
      blip(300, 140, 0.3, 0.2, 'sawtooth');
    },
    click() {
      blip(700, 700, 0.05, 0.12, 'sine');
    },
    toggleMute() {
      muted = !muted;
      if (master !== null) master.gain.value = muted ? 0 : 0.5;
      if (sirenGain !== null && ctx !== null) sirenGain.gain.setTargetAtTime(sirenOn && !muted ? 0.045 : 0, ctx.currentTime, 0.05);
      return muted;
    },
    isMuted: () => muted,
  };
}
