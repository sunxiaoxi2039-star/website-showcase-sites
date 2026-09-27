// 合成海洋声：浪涌（随风浪与深度变化）、水下低鸣、礁区“噼啪”声、远处的鲸歌、热泉嘶声、海底震颤的低频轰鸣。
// 不使用任何录音或麦克风；默认关闭，由用户开启。
export class OceanSound {
  constructor() {
    this.ctx = null;
    this.on = false;
    this.volume = 0.7;
    this.nextCrackle = 0;
    this.nextCall = 3;
  }
  _init() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    const ctx = new AC();
    this.ctx = ctx;
    const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.997 * b0 + w * 0.029591; b1 = 0.985 * b1 + w * 0.032534; b2 = 0.95 * b2 + w * 0.048056;
      d[i] = (b0 + b1 + b2 + w * 0.02) * 0.9;
    }
    this.noiseBuf = noiseBuf;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    // 简单混响：合成的指数衰减脉冲
    const conv = ctx.createConvolver();
    const ir = ctx.createBuffer(2, ctx.sampleRate * 3, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const ch = ir.getChannelData(c);
      for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / ch.length, 3);
    }
    conv.buffer = ir;
    this.verb = ctx.createGain();
    this.verb.gain.value = 0.35;
    this.verb.connect(conv).connect(this.master);
    this.master.connect(ctx.destination);
    const loop = (freq, q, type = 'lowpass') => {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf; src.loop = true;
      src.playbackRate.value = 0.9 + Math.random() * 0.2;
      const f = ctx.createBiquadFilter();
      f.type = type; f.frequency.value = freq; f.Q.value = q;
      const g = ctx.createGain(); g.gain.value = 0;
      src.connect(f).connect(g).connect(this.master);
      src.start();
      return { f, g };
    };
    this.surf = loop(900, 0.5);
    this.hum = loop(120, 0.7);
    this.hiss = loop(2500, 0.8, 'bandpass');
    this.rumble = loop(60, 1);
    return true;
  }
  async setOn(v) {
    if (v && !this.ctx && !this._init()) return;
    this.on = v;
    if (!this.ctx) return;
    if (v && this.ctx.state === 'suspended') await this.ctx.resume();
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(v ? this.volume : 0, t, 0.4);
  }
  setVolume(v) {
    this.volume = v;
    if (this.ctx && this.on) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.1);
  }
  suspend(s) {
    if (!this.ctx) return;
    if (s) this.ctx.suspend(); else if (this.on) this.ctx.resume();
  }
  update(dt, st) {
    if (!this.ctx || !this.on) return;
    const t = this.ctx.currentTime;
    const depth = Math.max(0, -st.y);
    const under = st.under;
    const wave = Math.min(1, 0.25 + st.wind / 25 + st.storm * 0.6);
    const breath = 0.6 + 0.4 * Math.sin(t * 0.55) * Math.sin(t * 0.23 + 1);
    const surfGain = under ? 0.5 * wave * Math.exp(-depth / 25) : 0.9 * wave * breath;
    this.surf.g.gain.setTargetAtTime(surfGain, t, 0.3);
    this.surf.f.frequency.setTargetAtTime(under ? 350 + 200 * breath : 900 + 1400 * wave * breath, t, 0.3);
    this.hum.g.gain.setTargetAtTime(under ? 0.45 + Math.min(0.4, depth / 800) : 0.05, t, 0.5);
    this.hum.f.frequency.setTargetAtTime(under ? 90 + 60 * Math.exp(-depth / 100) : 200, t, 0.5);
    this.hiss.g.gain.setTargetAtTime(st.vent * 0.3, t, 0.5);
    this.rumble.g.gain.setTargetAtTime(st.tremor * 1.2, t, 0.2);
    // 礁区噼啪（枪虾与啃食声）
    if (under && st.reef > 0.1 && t > this.nextCrackle) {
      this.nextCrackle = t + 0.02 + Math.random() * 0.2 / st.reef;
      this.click(0.05 + Math.random() * 0.12 * st.reef * Math.exp(-depth / 40));
    }
    // 鲸歌
    if (st.whale > 0 && t > this.nextCall) {
      this.nextCall = t + 6 + Math.random() * 10;
      this.call(st.whale * (under ? 1 : 0.25));
    }
  }
  click(g) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2500 + Math.random() * 3000;
    const gn = ctx.createGain();
    const t = ctx.currentTime;
    gn.gain.setValueAtTime(g, t); gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.015);
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (pan) { pan.pan.value = Math.random() * 2 - 1; src.connect(f).connect(gn).connect(pan).connect(this.master); }
    else src.connect(f).connect(gn).connect(this.master);
    src.start(t, Math.random() * 3, 0.03);
  }
  call(g) {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    const base = 160 + Math.random() * 200;
    o.frequency.setValueAtTime(base, t);
    o.frequency.linearRampToValueAtTime(base * (1.4 + Math.random() * 0.8), t + 1.2);
    o.frequency.linearRampToValueAtTime(base * 0.8, t + 2.6);
    const vib = ctx.createOscillator(); vib.frequency.value = 5; const vg = ctx.createGain(); vg.gain.value = 6;
    vib.connect(vg).connect(o.frequency);
    const gn = ctx.createGain();
    gn.gain.setValueAtTime(0, t);
    gn.gain.linearRampToValueAtTime(0.18 * g, t + 0.5);
    gn.gain.linearRampToValueAtTime(0.0, t + 2.8);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    o.connect(lp).connect(gn);
    gn.connect(this.verb); gn.connect(this.master);
    o.start(t); vib.start(t); o.stop(t + 3); vib.stop(t + 3);
  }
}
