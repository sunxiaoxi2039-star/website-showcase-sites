// A small synthesized "reactor hum" driven by the core's live energy value.
// Nothing is sampled: detuned saws through a resonant low-pass, a sub sine,
// a faint high shimmer, plus a thump on every heartbeat in pulse mode.
export class CoreAudio {
  constructor() {
    this.ctx = null;
    this.on = false;
  }

  _init() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    const ctx = (this.ctx = new AC());
    const master = (this.master = ctx.createGain());
    master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 3;
    master.connect(comp).connect(ctx.destination);

    const filter = (this.filter = ctx.createBiquadFilter());
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    filter.Q.value = 5;
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.11;
    filter.connect(droneGain).connect(master);

    this.oscs = [];
    [[55, -7], [55, 6], [82.4, 0]].forEach(([f, det], i) => {
      const o = ctx.createOscillator();
      o.type = i === 2 ? 'triangle' : 'sawtooth';
      o.frequency.value = f;
      o.detune.value = det;
      o.connect(filter);
      o.start();
      this.oscs.push(o);
    });

    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.value = 41.2;
    const subGain = (this.subGain = ctx.createGain());
    subGain.gain.value = 0.22;
    sub.connect(subGain).connect(master);
    sub.start();

    // shimmer with slow tremolo
    const shimmer = ctx.createOscillator();
    shimmer.type = 'sine';
    shimmer.frequency.value = 1318.5;
    const shimmerGain = ctx.createGain();
    shimmerGain.gain.value = 0.006;
    const trem = ctx.createOscillator();
    trem.frequency.value = 0.35;
    const tremDepth = ctx.createGain();
    tremDepth.gain.value = 0.005;
    trem.connect(tremDepth).connect(shimmerGain.gain);
    shimmer.connect(shimmerGain).connect(master);
    shimmer.start();
    trem.start();
    return true;
  }

  async toggle() {
    if (!this.ctx && !this._init()) return false;
    const now = this.ctx.currentTime;
    this.on = !this.on;
    if (this.on) {
      await this.ctx.resume();
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setTargetAtTime(0.55, now, 0.4);
    } else {
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setTargetAtTime(0, now, 0.15);
    }
    return this.on;
  }

  update(energy, spin) {
    if (!this.on || !this.ctx) return;
    const now = this.ctx.currentTime;
    this.filter.frequency.setTargetAtTime(180 + energy * 520 + spin * 160, now, 0.06);
    this.subGain.gain.setTargetAtTime(0.14 + energy * 0.12, now, 0.08);
    const pitch = 1 + spin * 0.035;
    this.oscs[0].frequency.setTargetAtTime(55 * pitch, now, 0.3);
    this.oscs[1].frequency.setTargetAtTime(55 * pitch, now, 0.3);
  }

  thump() {
    if (!this.on || !this.ctx) return;
    const ctx = this.ctx, now = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(92, now);
    o.frequency.exponentialRampToValueAtTime(34, now + 0.32);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.5, now + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
    o.connect(g).connect(this.master);
    o.start(now);
    o.stop(now + 0.45);
  }

  blip(freq = 880) {
    if (!this.on || !this.ctx) return;
    const ctx = this.ctx, now = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(freq, now);
    o.frequency.exponentialRampToValueAtTime(freq * 0.5, now + 0.12);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.08, now + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    o.connect(g).connect(this.master);
    o.start(now);
    o.stop(now + 0.2);
  }
}
