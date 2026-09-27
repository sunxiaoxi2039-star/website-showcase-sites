// Web Audio for the pond. Nothing is created until the Sound button is pressed.
// Beds: gentle swimming water, rain, whirlpool. One-shots: landing splash, musical droplets, rain ticks.
const PENTA = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51, 1567.98];

export class PondAudio {
  constructor() {
    this.ctx = null;
    this.enabled = false;
    this.visible = true;
    this.lastDrop = 0;
    this.suspendTimer = 0;
  }

  get live() { return !!(this.ctx && this.enabled && this.visible && this.ctx.state === 'running'); }

  _noise(seconds, kind) {
    const ctx = this.ctx, n = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
    }
    return buf;
  }

  _loop(buf) {
    const s = this.ctx.createBufferSource();
    s.buffer = buf; s.loop = true;
    s.loopStart = 0; s.loopEnd = buf.duration;
    s.start(0, Math.random() * buf.duration);
    return s;
  }

  _impulse(sec) {
    const ctx = this.ctx, n = Math.floor(ctx.sampleRate * sec);
    const buf = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3.2);
    }
    return buf;
  }

  _build() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain(); this.master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 3; comp.attack.value = 0.005; comp.release.value = 0.25;
    this.master.connect(comp); comp.connect(ctx.destination);
    this.verb = ctx.createConvolver(); this.verb.buffer = this._impulse(2.6);
    this.wet = ctx.createGain(); this.wet.gain.value = 0.55;
    this.wet.connect(this.verb); this.verb.connect(this.master);
    this.dry = ctx.createGain(); this.dry.gain.value = 1; this.dry.connect(this.master);

    this.whiteBuf = this._noise(3, 'white');
    this.brownBuf = this._noise(4, 'brown');

    // swimming water: slow filtered brown noise + a faint trickle
    this.swimG = ctx.createGain(); this.swimG.gain.value = 0;
    const sLp = ctx.createBiquadFilter(); sLp.type = 'lowpass'; sLp.frequency.value = 700;
    const sBp = ctx.createBiquadFilter(); sBp.type = 'bandpass'; sBp.frequency.value = 380; sBp.Q.value = 0.7;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.11;
    const lfoG = ctx.createGain(); lfoG.gain.value = 170; lfo.connect(lfoG); lfoG.connect(sBp.frequency); lfo.start();
    this._loop(this.brownBuf).connect(sLp); sLp.connect(sBp); sBp.connect(this.swimG); this.swimG.connect(this.dry);
    this.trickleF = ctx.createBiquadFilter(); this.trickleF.type = 'bandpass'; this.trickleF.frequency.value = 2200; this.trickleF.Q.value = 6;
    this.trickleG = ctx.createGain(); this.trickleG.gain.value = 0;
    this._loop(this.whiteBuf).connect(this.trickleF); this.trickleF.connect(this.trickleG); this.trickleG.connect(this.dry); this.trickleG.connect(this.wet);

    // rain: bright hiss + soft low wash
    this.rainG = ctx.createGain(); this.rainG.gain.value = 0;
    const rHp = ctx.createBiquadFilter(); rHp.type = 'highpass'; rHp.frequency.value = 1100;
    const rLp = ctx.createBiquadFilter(); rLp.type = 'lowpass'; rLp.frequency.value = 8200;
    this._loop(this.whiteBuf).connect(rHp); rHp.connect(rLp); rLp.connect(this.rainG);
    const rLow = ctx.createBiquadFilter(); rLow.type = 'lowpass'; rLow.frequency.value = 320;
    const rLowG = ctx.createGain(); rLowG.gain.value = 0.5;
    this._loop(this.brownBuf).connect(rLow); rLow.connect(rLowG); rLowG.connect(this.rainG);
    this.rainG.connect(this.dry);

    // whirlpool: resonant swirling noise and a low hum
    this.whirlG = ctx.createGain(); this.whirlG.gain.value = 0;
    const wBp = ctx.createBiquadFilter(); wBp.type = 'bandpass'; wBp.frequency.value = 300; wBp.Q.value = 3.5;
    const wLfo = ctx.createOscillator(); wLfo.frequency.value = 0.32;
    const wLfoG = ctx.createGain(); wLfoG.gain.value = 140; wLfo.connect(wLfoG); wLfoG.connect(wBp.frequency); wLfo.start();
    this._loop(this.brownBuf).connect(wBp); wBp.connect(this.whirlG);
    const hum = ctx.createOscillator(); hum.type = 'sine'; hum.frequency.value = 52;
    const hum2 = ctx.createOscillator(); hum2.type = 'sine'; hum2.frequency.value = 78.3;
    const humG = ctx.createGain(); humG.gain.value = 0.18;
    hum.connect(humG); hum2.connect(humG); humG.connect(this.whirlG); hum.start(); hum2.start();
    const trem = ctx.createOscillator(); trem.frequency.value = 0.9;
    const tremG = ctx.createGain(); tremG.gain.value = 0.08; trem.connect(tremG); tremG.connect(humG.gain); trem.start();
    this.whirlG.connect(this.dry); this.whirlG.connect(this.wet);
    return true;
  }

  setEnabled(on) {
    if (on && !this.ctx && !this._build()) return false;
    this.enabled = on;
    this._apply();
    return true;
  }

  setVisible(v) { this.visible = v; this._apply(); }

  _apply() {
    const ctx = this.ctx;
    if (!ctx) return;
    clearTimeout(this.suspendTimer);
    const g = this.master.gain, now = ctx.currentTime;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    if (this.enabled && this.visible) {
      if (ctx.state !== 'running') ctx.resume();
      g.setTargetAtTime(0.9, now, 0.35);
    } else {
      g.setTargetAtTime(0, now, this.visible ? 0.25 : 0.06);
      this.suspendTimer = setTimeout(() => {
        if (!(this.enabled && this.visible) && ctx.state === 'running') ctx.suspend();
      }, this.visible ? 1600 : 400);
    }
  }

  // continuous levels, called a few times per second
  update(swim, rain, whirl) {
    if (!this.live) return;
    const now = this.ctx.currentTime;
    this.swimG.gain.setTargetAtTime(0.05 + 0.2 * swim, now, 0.6);
    this.trickleG.gain.setTargetAtTime(0.006 + 0.03 * swim, now, 0.4);
    this.trickleF.frequency.setTargetAtTime(1500 + Math.random() * 1800, now, 0.05);
    this.rainG.gain.setTargetAtTime(0.2 * rain, now, 0.5);
    this.whirlG.gain.setTargetAtTime(0.32 * whirl, now, 0.5);
  }

  splash(amount = 1) {
    if (!this.live) return;
    const ctx = this.ctx, t = ctx.currentTime + 0.01;
    const src = ctx.createBufferSource(); src.buffer = this.whiteBuf;
    const bp = ctx.createBiquadFilter(); bp.type = 'lowpass'; bp.Q.value = 0.8;
    bp.frequency.setValueAtTime(7000, t); bp.frequency.exponentialRampToValueAtTime(700, t + 0.45);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5 * amount, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0008, t + 0.55);
    src.connect(bp); bp.connect(g); g.connect(this.dry); g.connect(this.wet);
    src.start(t, Math.random() * 2); src.stop(t + 0.6);

    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(260, t); o.frequency.exponentialRampToValueAtTime(62, t + 0.16);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(0.55 * amount, t + 0.008);
    og.gain.exponentialRampToValueAtTime(0.0005, t + 0.24);
    o.connect(og); og.connect(this.dry); o.start(t); o.stop(t + 0.26);

    for (let i = 0; i < 7; i++) this._bubble(t + 0.05 + Math.random() * 0.55, 0.05 * amount);
  }

  _bubble(t, vol) {
    const ctx = this.ctx;
    const f = 500 + Math.random() * 900;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 1.9, t + 0.06);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    o.connect(g); g.connect(this.dry); g.connect(this.wet); o.start(t); o.stop(t + 0.1);
  }

  // soft musical droplet: pentatonic sine "bloop" with a small upward glide, mostly reverb
  droplet(vol = 1, idx = -1) {
    if (!this.live) return;
    const ctx = this.ctx, now = ctx.currentTime;
    if (now - this.lastDrop < 0.07) return;
    this.lastDrop = now;
    const f = PENTA[idx >= 0 ? idx % PENTA.length : Math.floor(Math.random() * PENTA.length)];
    const t = now + 0.005;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(f * 0.93, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.03);
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 2.01;
    const g = ctx.createGain(), g2 = ctx.createGain(); g2.gain.value = 0.18;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.11 * vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    o.connect(g); o2.connect(g2); g2.connect(g);
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (pan) { pan.pan.value = Math.random() * 1.2 - 0.6; g.connect(pan); pan.connect(this.dry); pan.connect(this.wet); }
    else { g.connect(this.dry); g.connect(this.wet); }
    o.start(t); o2.start(t); o.stop(t + 1); o2.stop(t + 1);
  }

  tick(vol = 1) {
    if (!this.live) return;
    const ctx = this.ctx, t = ctx.currentTime + Math.random() * 0.02;
    const src = ctx.createBufferSource(); src.buffer = this.whiteBuf;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2500 + Math.random() * 4000; bp.Q.value = 2.5;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09 * vol, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    src.connect(bp); bp.connect(g); g.connect(this.dry);
    src.start(t, Math.random() * 2.5); src.stop(t + 0.06);
  }
}
