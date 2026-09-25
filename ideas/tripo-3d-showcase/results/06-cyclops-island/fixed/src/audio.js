// audio.js — optional synthesized sound, only started after a user gesture. No audio files.
export function createAudio() {
  let ctx = null, master = null, enabled = false, sea = null;
  const A = { get enabled() { return enabled; } };

  function ensure() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
    ctx = new AC(); master = ctx.createGain(); master.gain.value = .5; master.connect(ctx.destination);
    // gentle sea bed: looped filtered noise
    const buf = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 520;
    const g = ctx.createGain(); g.gain.value = .0;
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = .12; lg.gain.value = .05; lfo.connect(lg); lg.connect(g.gain);
    src.connect(f); f.connect(g); g.connect(master); src.start(); lfo.start();
    sea = g; return true;
  }
  A.toggle = () => { if (!ensure()) return false; enabled = !enabled; if (enabled) ctx.resume(); sea.gain.setTargetAtTime(enabled ? .08 : 0, ctx.currentTime, .3); return enabled; };
  A.pause = p => { if (ctx && enabled) (p ? ctx.suspend() : ctx.resume()); };

  const noise = (dur, freq, q, gain, type = 'lowpass') => {
    if (!enabled) return;
    const t = ctx.currentTime, buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 2;
    const s = ctx.createBufferSource(); s.buffer = buf; const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.value = gain; s.connect(f); f.connect(g); g.connect(master); s.start(t);
  };
  const tone = (f0, f1, dur, gain, type = 'sine') => {
    if (!enabled) return;
    const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur); o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + .02);
  };
  A.thud = charged => { tone(90, 32, .6, .9); noise(.5, 380, 1, .8); if (charged) tone(150, 40, 1, .5, 'triangle'); };
  A.whoosh = () => noise(.28, 1600, 1.2, .5, 'bandpass');
  A.pickup = () => { tone(660, 990, .18, .18, 'triangle'); setTimeout(() => tone(990, 1320, .2, .14, 'triangle'), 90); };
  A.hurt = () => { tone(300, 120, .25, .3, 'square'); noise(.15, 900, 1, .3); };
  A.roar = () => { tone(120, 60, 1.3, .45, 'sawtooth'); noise(1.1, 300, 2, .35); };
  A.windup = charged => tone(charged ? 180 : 140, charged ? 420 : 300, 1.05, .08, 'triangle');
  A.win = () => [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, f, .5, .16, 'triangle'), i * 140));
  A.lose = () => [392, 330, 262].forEach((f, i) => setTimeout(() => tone(f, f * .98, .5, .16, 'triangle'), i * 180));
  return A;
}
