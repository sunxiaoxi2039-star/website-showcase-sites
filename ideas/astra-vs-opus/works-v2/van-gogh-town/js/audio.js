// A tiny synthesised soundscape (no audio files): wind over the wheat, the Rhône lapping,
// crickets at night and a distant murmur near the café. Levels follow the painting you are in.
export class Ambience {
  constructor() { this.ctx = null; this.on = false; this.g = {}; }

  start() {
    if (this.ctx) { this.ctx.resume(); this.on = true; return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    const len = ctx.sampleRate * 3;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) { // pinkish noise
      const w = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + w * 0.099; b1 = 0.963 * b1 + w * 0.2965; b2 = 0.57 * b2 + w * 1.0526;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.12;
    }
    const noise = () => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.loopStart = Math.random(); s.start(0, Math.random() * 2); return s; };
    const master = ctx.createGain(); master.gain.value = 0.0; master.connect(ctx.destination);
    this.master = master;
    const lfo = (freq, amount, target) => { const o = ctx.createOscillator(); o.frequency.value = freq; const g = ctx.createGain(); g.gain.value = amount; o.connect(g).connect(target); o.start(); };
    const chan = (name) => { const g = ctx.createGain(); g.gain.value = 0; g.connect(master); this.g[name] = g; return g; };

    // wind
    const wf = ctx.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 480; wf.Q.value = 0.6;
    noise().connect(wf).connect(chan('wind'));
    lfo(0.09, 260, wf.frequency);
    // river
    const rf = ctx.createBiquadFilter(); rf.type = 'lowpass'; rf.frequency.value = 700;
    const rg = ctx.createGain(); rg.gain.value = 0.7; lfo(0.35, 0.3, rg.gain);
    noise().connect(rf).connect(rg).connect(chan('river'));
    // crickets: a high sine chopped into chirps
    const cr = chan('crickets');
    for (const [f, rate] of [[4300, 21], [4700, 17]]) {
      const o = ctx.createOscillator(); o.frequency.value = f;
      const am = ctx.createGain(); am.gain.value = 0;
      const pulse = ctx.createOscillator(); pulse.type = 'square'; pulse.frequency.value = rate;
      const pg = ctx.createGain(); pg.gain.value = 0.5; pulse.connect(pg).connect(am.gain);
      const chirp = ctx.createGain(); chirp.gain.value = 0.5; lfo(0.7 + Math.random() * 0.4, 0.5, chirp.gain);
      o.connect(am).connect(chirp).connect(cr);
      o.start(); pulse.start();
    }
    // café murmur: band-limited noise with a slow swell
    const mf = ctx.createBiquadFilter(); mf.type = 'bandpass'; mf.frequency.value = 320; mf.Q.value = 1.4;
    const mg = ctx.createGain(); mg.gain.value = 0.6; lfo(0.23, 0.35, mg.gain);
    noise().connect(mf).connect(mg).connect(chan('cafe'));
    this.on = true;
  }

  stop() { this.on = false; if (this.ctx) this.ctx.suspend(); }

  update(p) {
    if (!this.ctx || !this.on) return;
    const t = this.ctx.currentTime;
    const set = (n, v) => this.g[n] && this.g[n].gain.setTargetAtTime(v, t, 0.6);
    this.master.gain.setTargetAtTime(0.9, t, 1.2);
    set('wind', 0.25 + p.wheat * 1.3 + p.starry * 0.6);
    set('river', p.rhone * 1.6);
    set('crickets', p.night * 0.05 * (1 - p.inside));
    set('cafe', p.cafe * 0.7);
  }
}
