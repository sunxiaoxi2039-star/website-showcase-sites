// WebAudio 合成音效与芯片风格背景音乐（无任何音频文件）
import { store, mulberry } from './util.js';

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

const TRACKS = {
  title: { bpm: 112, root: 50, prog: [[0, 'M'], [7, 'M'], [9, 'm'], [5, 'M']], seed: 3, lead: 'square', drive: 0.6 },
  s1: { bpm: 148, root: 45, prog: [[0, 'm'], [8, 'M'], [10, 'M'], [7, 'm']], seed: 11, lead: 'square', drive: 1 },
  s2: { bpm: 152, root: 47, prog: [[0, 'm'], [5, 'm'], [8, 'M'], [10, 'M']], seed: 23, lead: 'sawtooth', drive: 1 },
  s3: { bpm: 140, root: 44, prog: [[0, 'm'], [10, 'M'], [8, 'M'], [10, 'M']], seed: 37, lead: 'square', drive: 1 },
  s4: { bpm: 156, root: 48, prog: [[0, 'M'], [9, 'm'], [5, 'M'], [7, 'M']], seed: 41, lead: 'square', drive: 1 },
  s5: { bpm: 160, root: 43, prog: [[0, 'm'], [1, 'M'], [0, 'm'], [10, 'M']], seed: 53, lead: 'sawtooth', drive: 1 },
  boss: { bpm: 172, root: 42, prog: [[0, 'm'], [1, 'M'], [6, 'd'], [1, 'M']], seed: 67, lead: 'sawtooth', drive: 1.2 },
  clear: { bpm: 132, root: 52, prog: [[0, 'M'], [5, 'M'], [7, 'M'], [0, 'M']], seed: 71, lead: 'square', drive: 0.7 },
};

function chordTones(root, q) {
  const third = q === 'M' ? 4 : 3;
  const fifth = q === 'd' ? 6 : 7;
  return [root, root + third, root + fifth];
}

function buildSong(def) {
  const R = mulberry(def.seed);
  const bars = [];
  // 两小节动机，AABA 结构
  const motifs = [];
  for (let m = 0; m < 3; m++) {
    const rhythm = [];
    for (let s = 0; s < 16; s++) rhythm.push(s % 4 === 0 ? R() < 0.9 : s % 2 === 0 ? R() < 0.55 : R() < 0.22);
    const idx = rhythm.map(() => Math.floor(R() * 5));
    motifs.push({ rhythm, idx });
  }
  const form = [0, 0, 1, 0, 0, 2, 1, 0];
  for (let b = 0; b < 8; b++) {
    const [off, q] = def.prog[b % def.prog.length];
    const ct = chordTones(def.root + off, q);
    const mo = motifs[form[b]];
    const lead = [];
    for (let s = 0; s < 16; s++) {
      if (!mo.rhythm[s]) { lead.push(null); continue; }
      const i = mo.idx[s];
      const pool = [ct[0] + 24, ct[1] + 24, ct[2] + 24, ct[0] + 36, ct[1] + 12 + 12];
      lead.push(pool[i]);
    }
    bars.push({ ct, lead });
  }
  return bars;
}

export class Sound {
  constructor() {
    this.ctx = null;
    this.muted = store.get('tf_mute', false);
    this.last = {};
    this.song = null;
    this.songName = null;
  }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain(); this.master.gain.value = this.muted ? 0 : 0.8;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 6;
    this.master.connect(comp); comp.connect(ctx.destination);
    this.sfxBus = ctx.createGain(); this.sfxBus.gain.value = 0.55; this.sfxBus.connect(this.master);
    this.musicBus = ctx.createGain(); this.musicBus.gain.value = 0.26; this.musicBus.connect(this.master);
    const len = ctx.sampleRate * 1.5;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    if (this.pendingMusic) this.music(this.pendingMusic);
  }
  setMuted(m) {
    this.muted = m; store.set('tf_mute', m);
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.05);
  }
  throttle(name, gap) {
    const t = performance.now();
    if (this.last[name] && t - this.last[name] < gap) return false;
    this.last[name] = t; return true;
  }
  tone(type, f0, f1, dur, vol, when = 0, bus = this.sfxBus) {
    const c = this.ctx, t = c.currentTime + when;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.02);
  }
  noiseHit(dur, vol, f0, f1, when = 0, type = 'lowpass', bus = this.sfxBus) {
    const c = this.ctx, t = c.currentTime + when;
    const s = c.createBufferSource(); s.buffer = this.noise;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    s.connect(f); f.connect(g); g.connect(bus); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }
  play(name) {
    if (!this.ctx || this.muted || this.ctx.state !== 'running') return;
    switch (name) {
      case 'shot': if (this.throttle(name, 90)) this.tone('square', 1100, 500, 0.05, 0.035); break;
      case 'hit': if (this.throttle(name, 60)) this.noiseHit(0.04, 0.06, 4000, 1500, 0, 'highpass'); break;
      case 'boomS': if (this.throttle(name, 50)) { this.noiseHit(0.3, 0.35, 2400, 200); this.tone('sine', 140, 40, 0.25, 0.3); } break;
      case 'boomM': if (this.throttle(name, 80)) { this.noiseHit(0.6, 0.55, 2000, 120); this.tone('sine', 110, 30, 0.5, 0.45); } break;
      case 'boomL': this.noiseHit(1.4, 0.8, 1800, 60); this.tone('sine', 90, 24, 1.2, 0.7); this.tone('sawtooth', 60, 30, 0.8, 0.15); break;
      case 'pickup': [0, 4, 7, 12].forEach((n, i) => this.tone('square', mtof(76 + n), mtof(76 + n), 0.09, 0.12, i * 0.05)); break;
      case 'power': [0, 7, 12, 16, 19, 24].forEach((n, i) => this.tone('square', mtof(72 + n), mtof(72 + n), 0.1, 0.12, i * 0.045)); break;
      case 'medal': this.tone('triangle', 1760, 1760, 0.08, 0.15); this.tone('triangle', 2637, 2637, 0.12, 0.12, 0.05); break;
      case 'oneup': [0, 4, 7, 12, 7, 12].forEach((n, i) => this.tone('square', mtof(79 + n), mtof(79 + n), 0.1, 0.13, i * 0.07)); break;
      case 'bomb': this.noiseHit(2.2, 0.9, 3000, 40); this.tone('sine', 200, 22, 1.8, 0.8); this.tone('sawtooth', 800, 40, 1.2, 0.18); break;
      case 'charge': if (this.throttle(name, 200)) this.tone('sawtooth', 180, 1400, 0.7, 0.08); break;
      case 'elaser': if (this.throttle(name, 150)) { this.tone('sawtooth', 110, 70, 0.9, 0.14); this.noiseHit(0.9, 0.12, 900, 300, 0, 'bandpass'); } break;
      case 'eshot': if (this.throttle(name, 120)) this.tone('triangle', 520, 260, 0.08, 0.05); break;
      case 'warning': for (let i = 0; i < 6; i++) { this.tone('square', 660, 660, 0.24, 0.12, i * 0.5); this.tone('square', 440, 440, 0.24, 0.12, i * 0.5 + 0.25); } break;
      case 'die': this.noiseHit(1.2, 0.7, 3000, 80); this.tone('square', 800, 60, 1, 0.2); break;
      case 'select': this.tone('square', 880, 1320, 0.07, 0.12); break;
      case 'start': [0, 7, 12, 19, 24].forEach((n, i) => this.tone('sawtooth', mtof(60 + n), mtof(60 + n), 0.14, 0.12, i * 0.06)); break;
      case 'lock': if (this.throttle(name, 200)) this.tone('sine', 1800, 2400, 0.06, 0.05); break;
      default: break;
    }
  }
  music(name) {
    if (!this.ctx) { this.pendingMusic = name; return; }
    if (this.songName === name) return;
    this.songName = name;
    if (!name) { this.song = null; return; }
    const def = TRACKS[name];
    this.song = { def, bars: buildSong(def), step: 0, next: this.ctx.currentTime + 0.1, loop: name !== 'clear' };
  }
  update() {
    if (!this.ctx || !this.song || this.ctx.state !== 'running') return;
    const S = this.song, c = this.ctx;
    const stepDur = 60 / S.def.bpm / 4;
    if (S.next < c.currentTime - 0.5) S.next = c.currentTime + 0.05;
    while (S.next < c.currentTime + 0.15) {
      const total = S.bars.length * 16;
      if (!S.loop && S.step >= total) { this.song = null; return; }
      const bar = S.bars[Math.floor(S.step / 16) % S.bars.length];
      const s = S.step % 16;
      const t = S.next - c.currentTime;
      if (!this.muted) this.playStep(bar, s, t, stepDur, S.def);
      S.step++; S.next += stepDur;
    }
  }
  playStep(bar, s, when, sd, def) {
    const bus = this.musicBus;
    const root = bar.ct[0];
    // 贝斯：八分音符根音/八度跳动
    if (s % 2 === 0) {
      const n = s % 8 === 6 ? root + 12 : s % 4 === 2 ? root + 7 : root;
      this.voice('sawtooth', mtof(n - 12), sd * 1.8, 0.2 * def.drive, when, 900, bus);
    }
    // 琶音
    const arp = bar.ct[s % 3] + 12 + (s % 6 >= 3 ? 12 : 0);
    this.voice('triangle', mtof(arp), sd * 0.9, 0.07, when, 4000, bus);
    // 主旋律
    const ln = bar.lead[s];
    if (ln != null) {
      let len = 1; while (s + len < 16 && bar.lead[s + len] == null && len < 4) len++;
      this.voice(def.lead, mtof(ln), sd * len * 0.95, 0.1, when, 2600, bus, true);
    }
    // 鼓
    if (s % 8 === 0 || (def.drive > 0.9 && s === 10)) { this.tone('sine', 150, 40, 0.18, 0.55 * def.drive, when, bus); }
    if (s === 4 || s === 12) this.noiseHit(0.14, 0.3 * def.drive, 5000, 1200, when, 'bandpass', bus);
    if (s % 2 === 0) this.noiseHit(0.035, 0.08, 9000, 7000, when, 'highpass', bus);
  }
  voice(type, f, dur, vol, when, cutoff, bus, vib = false) {
    const c = this.ctx, t = c.currentTime + when;
    const o = c.createOscillator(), g = c.createGain(), fl = c.createBiquadFilter();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (vib && dur > 0.2) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = 6; lg.gain.value = f * 0.012; l.connect(lg); lg.connect(o.frequency); l.start(t + 0.1); l.stop(t + dur + 0.05); }
    fl.type = 'lowpass'; fl.frequency.value = cutoff;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.008); g.gain.setTargetAtTime(vol * 0.6, t + 0.02, 0.08); g.gain.setTargetAtTime(0.0001, t + dur * 0.9, 0.03);
    o.connect(fl); fl.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.2);
  }
}
