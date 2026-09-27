// 生物解剖：每个物种由放样躯干、鳍片、腕足、发光器官拼出。
// 物体空间：+z 为前（头），+y 为上，体长归一化为 1。
// 顶点属性：aS（0 头 → 1 尾，驱动身体波动）、aFlap（竖直/侧向拍动权重）、
// aArm（腕编号、沿腕位置）、aGlow（发光器官）、aPulse（伞/外套膜收缩）。
import { Builder, V, noise3 } from './geom.js';
import { mulberry32, clamp, smoothstep, lerp } from './noise.js';

export const FAUNA_SPEC = { aS: 1, aFlap: 2, aArm: 2, aGlow: 1, aPulse: 1 };

const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
function reset(b) { b.set('aS', 0); b.set('aFlap', [0, 0]); b.set('aArm', [-1, 0]); b.set('aGlow', 0); b.set('aPulse', 0); }

// 放样躯干。prof(t) → [半宽, 半高, y 偏移]；t: 0 吻端 → 1 尾柄
function loft(b, { z0 = 0.5, z1 = -0.36, seg = 18, rad = 12, prof, color, sOf, pulse }) {
  const pts = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    const p = prof(t);
    pts.push([0, p[2] || 0, lerp(z0, z1, t)]);
  }
  reset(b);
  return b.tube(pts, (t) => { const p = prof(t); return [Math.max(p[0], 0.002), Math.max(p[1], 0.002)]; }, rad, {
    color: (t, ang) => color(t, Math.sin(ang), Math.cos(ang)),
    attr: (bb, t) => { bb.set('aS', sOf ? sOf(t) : lerp(0.5 - z0, 0.5 - z1, t)); bb.set('aPulse', pulse ? pulse(t) : 0); bb.set('aFlap', [0, 0]); bb.set('aArm', [-1, 0]); bb.set('aGlow', 0); },
    capStart: true, capEnd: true,
  });
}

// 纺锤形轮廓
function spindle(H, W, peak = 0.33, nose = 0.55, tailMin = 0.14) {
  return (t) => {
    let f;
    if (t < peak) f = Math.pow(Math.sin((Math.PI / 2) * (t / peak)), nose);
    else f = Math.cos((Math.PI / 2) * ((t - peak) / (1 - peak)) * 0.96);
    f = Math.max(f, t > 0.5 ? tailMin : 0.02);
    return [W * 0.5 * f, H * 0.5 * f, 0];
  };
}

// 平面鳍（在 x=const 平面或指定平面上的多边形），flap: [竖直, 侧向]
function fin(b, pts, col, { s = null, flap = [0, 0], flapFn = null, normal = [1, 0, 0], glow = 0 } = {}) {
  reset(b);
  b.sheet(pts, normal, () => col, (bb, p) => {
    bb.set('aS', s !== null ? s : clamp(0.5 - p[2], 0, 1));
    bb.set('aFlap', flapFn ? flapFn(p) : flap);
    bb.set('aGlow', glow);
  });
}

function eye(b, x, y, z, r, col = [0.03, 0.03, 0.035], glow = 0) {
  reset(b);
  b.set('aS', clamp(0.5 - z, 0, 1));
  b.set('aGlow', glow);
  b.blob(1, (d) => [x + d[0] * r, y + d[1] * r, z + d[2] * r], (p, n) => (n[2] > 0.6 && !glow ? [0.35, 0.35, 0.33] : col), (bb) => { bb.set('aS', clamp(0.5 - z, 0, 1)); bb.set('aGlow', glow); });
}

function glowDot(b, x, y, z, r, col) {
  eye(b, x, y, z, r, col, 1);
}

function caudal(b, zBase, h, len, kind, col) {
  const zt = zBase - len;
  if (kind === 'fork') fin(b, [[0, 0, zBase + 0.02], [0, h * 0.25, zBase], [0, h, zt], [0, 0, zBase - len * 0.55], [0, -h, zt], [0, -h * 0.25, zBase]], col);
  else if (kind === 'lunate') fin(b, [[0, 0, zBase + 0.02], [0, h * 0.2, zBase], [0, h * 1.1, zt - len * 0.1], [0, h * 0.4, zt + len * 0.35], [0, 0, zt + len * 0.45], [0, -h * 0.4, zt + len * 0.35], [0, -h * 1.1, zt - len * 0.1], [0, -h * 0.2, zBase]], col);
  else if (kind === 'round') fin(b, [[0, 0, zBase + 0.02], [0, h * 0.4, zBase], [0, h * 0.8, zt + len * 0.25], [0, h * 0.4, zt], [0, -h * 0.4, zt], [0, -h * 0.8, zt + len * 0.25], [0, -h * 0.4, zBase]], col);
  else if (kind === 'truncate') fin(b, [[0, 0, zBase + 0.02], [0, h * 0.35, zBase], [0, h * 0.95, zt], [0, 0, zt + len * 0.05], [0, -h * 0.95, zt], [0, -h * 0.35, zBase]], col);
  else if (kind === 'hetero') fin(b, [[0, 0, zBase + 0.02], [0, h * 0.25, zBase], [0, h * 1.25, zt - len * 0.1], [0, h * 0.6, zt + len * 0.2], [0, 0, zt + len * 0.4], [0, -h * 0.65, zt + len * 0.55], [0, -h * 0.2, zBase]], col);
}

// ——————————————— 鱼类通用构建 ———————————————
function fishGeo(o) {
  const b = new Builder(FAUNA_SPEC);
  const H = o.H, W = o.W;
  const prof = o.prof || spindle(H, W, o.peak ?? 0.33, o.nose ?? 0.55, o.tailMin ?? 0.14);
  const back = o.back, belly = o.belly, finC = o.fin || mix3(back, belly, 0.4);
  const zTail = o.zTail ?? -0.36;
  loft(b, {
    z1: zTail, prof, seg: o.seg || 18, rad: o.rad || 12,
    color: (t, sy) => {
      let c = mix3(belly, back, smoothstep(-0.35, 0.45, sy));
      if (o.colorFn) c = o.colorFn(t, sy, c);
      return c;
    },
  });
  const hAt = (z) => { const t = clamp((0.5 - z) / (0.5 - zTail), 0, 1); return prof(t)[1]; };
  const wAt = (z) => { const t = clamp((0.5 - z) / (0.5 - zTail), 0, 1); return prof(t)[0]; };
  // 尾鳍
  if (o.tail !== 'none') caudal(b, zTail + 0.01, o.tailH ?? H * 0.62, o.tailLen ?? 0.16, o.tail || 'fork', o.tailC || finC);
  // 背鳍
  if (o.dorsal) {
    const [za, zb, dh, sweep] = o.dorsal;
    const pts = [[0, hAt(za) * 0.8, za], [0, hAt(za) * 0.9 + dh, za - (za - zb) * (sweep ?? 0.35)], [0, hAt(zb) * 0.9 + dh * 0.25, zb], [0, hAt(zb) * 0.8, zb]];
    fin(b, pts, o.dorsalC || finC, { flapFn: o.finFlap ? () => [0, 1] : null });
  }
  if (o.dorsal2) {
    const [za, zb, dh] = o.dorsal2;
    fin(b, [[0, hAt(za) * 0.8, za], [0, hAt(za) + dh, za - 0.02], [0, hAt(zb) * 0.8, zb]], o.dorsalC || finC);
  }
  if (o.anal) {
    const [za, zb, dh, sweep] = o.anal;
    const pts = [[0, -hAt(za) * 0.8, za], [0, -hAt(zb) * 0.8, zb], [0, -hAt(zb) * 0.9 - dh * 0.25, zb], [0, -hAt(za) * 0.9 - dh, za - (za - zb) * (sweep ?? 0.35)]];
    fin(b, pts, o.analC || finC, { flapFn: o.finFlap ? () => [0, 1] : null });
  }
  // 胸鳍（左右一对，可拍动）
  if (o.pect) {
    const [zp, len, wid, down, horiz] = o.pect;
    for (const sgn of [-1, 1]) {
      const x0 = wAt(zp) * 0.85 * sgn, y0 = -hAt(zp) * 0.25;
      const tip = horiz ? [x0 + sgn * len, y0 - down, zp - len * 0.45] : [x0 + sgn * len * 0.45, y0 - down, zp - len];
      const pts = [[x0, y0, zp], [x0 + sgn * wid * 0.2, y0 - 0.005, zp + 0.01], tip, [x0, y0 - 0.01, zp - wid]];
      fin(b, pts, o.pectC || finC, { normal: [0, 1, 0], flapFn: (p) => [clamp(Math.abs(p[0] - x0) / len, 0, 1) * (o.pectFlap ?? 0.6), 0] });
    }
  }
  if (o.pelvic) {
    const [zp, len] = o.pelvic;
    for (const sgn of [-1, 1]) {
      const x0 = wAt(zp) * 0.5 * sgn, y0 = -hAt(zp) * 0.85;
      fin(b, [[x0, y0, zp], [x0 + sgn * len * 0.3, y0 - len * 0.7, zp - len * 0.6], [x0, y0, zp - len * 0.5]], finC, { normal: [1, 0, 0] });
    }
  }
  // 眼睛
  const ez = o.eyeZ ?? 0.38;
  const er = o.eye ?? 0.035;
  for (const sgn of [-1, 1]) eye(b, sgn * wAt(ez) * 0.82, hAt(ez) * (o.eyeY ?? 0.25), ez, er, o.eyeC);
  if (o.extra) o.extra(b, { hAt, wAt });
  return b.build();
}

// ——————————————— 各物种 ———————————————
export const GEO = {
  butterflyfish: () => fishGeo({
    H: 0.62, W: 0.12, peak: 0.42, nose: 0.9, tailMin: 0.18, back: [0.98, 0.84, 0.18], belly: [1, 0.95, 0.72], fin: [0.98, 0.86, 0.3],
    tail: 'truncate', tailH: 0.22, tailLen: 0.13, dorsal: [0.3, -0.33, 0.12, 0.3], anal: [0.1, -0.33, 0.1, 0.3], pect: [0.18, 0.12, 0.05, 0.02, false], eye: 0.045, eyeY: 0.28, eyeZ: 0.33,
    colorFn: (t, sy, c) => {
      const band = Math.sin(t * 22) > 0.55 ? 0.35 : 1;
      const eyeBand = Math.abs(t - 0.2) < 0.05 ? 0.1 : 1;
      const k = Math.min(band, eyeBand);
      return k < 1 ? mix3(c, [0.08, 0.06, 0.05], 1 - k) : c;
    },
    extra: (b) => {
      // 尖吻
      reset(b);
      b.tube([[0, -0.02, 0.48], [0, -0.03, 0.56]], [[0.02, 0.02], [0.012, 0.012]], 5, { color: () => [0.95, 0.85, 0.3], attr: (bb) => { reset(bb); bb.set('aS', 0); }, capEnd: true });
    },
  }),
  parrotfish: () => fishGeo({
    H: 0.34, W: 0.18, peak: 0.36, nose: 0.6, back: [0.2, 0.62, 0.55], belly: [0.55, 0.8, 0.68], fin: [0.85, 0.45, 0.55],
    tail: 'truncate', tailH: 0.2, tailLen: 0.14, dorsal: [0.32, -0.28, 0.05, 0.5], anal: [0.02, -0.28, 0.045, 0.5], pect: [0.22, 0.14, 0.06, 0.02, false], pectFlap: 1.2, eye: 0.03,
    colorFn: (t, sy, c) => {
      const scale = 0.9 + 0.1 * Math.sin(t * 60) * Math.sin(sy * 12);
      const beak = t < 0.07 ? [0.85, 0.85, 0.75] : null;
      const stripe = Math.abs(sy - 0.1) < 0.08 && t > 0.1 && t < 0.35 ? [0.95, 0.55, 0.6] : null;
      return beak || stripe || c.map((k) => k * scale);
    },
  }),
  damselfish: () => fishGeo({
    H: 0.42, W: 0.14, peak: 0.38, nose: 0.8, back: [0.25, 0.62, 0.85], belly: [0.55, 0.85, 0.95], fin: [0.3, 0.7, 0.9],
    tail: 'fork', tailH: 0.2, tailLen: 0.16, dorsal: [0.28, -0.3, 0.08, 0.3], anal: [0.05, -0.3, 0.07, 0.3], pect: [0.2, 0.1, 0.04, 0.02, false], eye: 0.045, seg: 10, rad: 8,
  }),
  reefshark: () => fishGeo({
    H: 0.16, W: 0.15, peak: 0.34, nose: 0.4, tailMin: 0.1, back: [0.45, 0.48, 0.5], belly: [0.9, 0.9, 0.88], fin: [0.4, 0.43, 0.46], zTail: -0.3, seg: 22,
    tail: 'hetero', tailH: 0.17, tailLen: 0.22, dorsal: [0.14, -0.02, 0.13, 0.62], dorsal2: [-0.2, -0.25, 0.03], anal: [-0.18, -0.24, 0.025, 0.5], pect: [0.18, 0.22, 0.09, 0.07, true], pectFlap: 0.15, eye: 0.012, eyeY: 0.2, eyeZ: 0.42,
    colorFn: (t, sy, c) => (t < 0.05 ? mix3(c, [0.6, 0.6, 0.6], 0.3) : c),
    extra: (b, { hAt }) => {
      // 鳃裂
      reset(b);
      for (let i = 0; i < 5; i++) {
        const z = 0.3 - i * 0.02;
        for (const sgn of [-1, 1]) fin(b, [[sgn * 0.071, 0.01, z], [sgn * 0.071, -0.03, z - 0.004], [sgn * 0.071, -0.03, z - 0.012], [sgn * 0.071, 0.01, z - 0.008]], [0.28, 0.3, 0.32], { normal: [sgn, 0, 0], s: 0.2 });
      }
      // 背鳍黑色尖端
      fin(b, [[0, hAt(0.1) + 0.08, 0.06], [0, hAt(0.1) + 0.125, 0.0], [0, hAt(0.1) + 0.07, 0.03]], [0.1, 0.1, 0.12], { s: 0.45 });
    },
  }),
  tuna: () => fishGeo({
    H: 0.24, W: 0.2, peak: 0.4, nose: 0.5, tailMin: 0.06, back: [0.08, 0.14, 0.32], belly: [0.82, 0.85, 0.9], fin: [0.25, 0.3, 0.45], zTail: -0.32,
    tail: 'lunate', tailH: 0.24, tailLen: 0.14, tailC: [0.2, 0.25, 0.4], dorsal: [0.18, 0.05, 0.12, 0.5], dorsal2: [-0.02, -0.08, 0.07], anal: [-0.02, -0.08, 0.07, 0.3], pect: [0.24, 0.16, 0.04, 0.03, true], pectFlap: 0.1, eye: 0.022,
    colorFn: (t, sy, c) => (t > 0.62 && t < 0.95 && Math.abs(sy) > 0.85 && Math.sin(t * 90) > 0 ? [0.95, 0.85, 0.2] : c),
  }),
  sardine: () => fishGeo({
    H: 0.2, W: 0.11, peak: 0.36, nose: 0.6, back: [0.18, 0.32, 0.42], belly: [0.9, 0.92, 0.95], fin: [0.6, 0.65, 0.7],
    tail: 'fork', tailH: 0.14, tailLen: 0.16, dorsal: [0.1, -0.05, 0.06, 0.4], pect: [0.26, 0.08, 0.03, 0.02, false], eye: 0.035, seg: 10, rad: 8,
    colorFn: (t, sy, c) => (Math.abs(sy - 0.25) < 0.06 ? [0.3, 0.55, 0.65] : c),
  }),
  lanternfish: () => fishGeo({
    H: 0.2, W: 0.12, peak: 0.3, nose: 0.9, back: [0.12, 0.14, 0.18], belly: [0.55, 0.6, 0.66], fin: [0.3, 0.33, 0.38],
    tail: 'fork', tailH: 0.14, tailLen: 0.16, dorsal: [0.05, -0.12, 0.07, 0.4], pect: [0.26, 0.08, 0.03, 0.02, false], eye: 0.07, eyeZ: 0.36, seg: 10, rad: 8,
    extra: (b, { hAt, wAt }) => {
      for (let i = 0; i < 9; i++) {
        const z = 0.3 - i * 0.07;
        for (const sgn of [-1, 1]) glowDot(b, sgn * wAt(z) * 0.7, -hAt(z) * 0.72, z, 0.014, [0.5, 0.9, 1]);
      }
    },
  }),
  hatchetfish: () => fishGeo({
    H: 0.62, W: 0.07, peak: 0.28, nose: 0.9, tailMin: 0.08, back: [0.35, 0.4, 0.45], belly: [0.88, 0.9, 0.94], fin: [0.7, 0.75, 0.8],
    prof: (t) => {
      const f = t < 0.3 ? Math.pow(Math.sin((Math.PI / 2) * (t / 0.3)), 0.8) : Math.max(0.1, 1 - Math.pow((t - 0.3) / 0.7, 0.7));
      return [0.035 * f + 0.004, 0.3 * f, -0.12 * f * (t > 0.2 ? 1 : t / 0.2)];
    },
    tail: 'fork', tailH: 0.12, tailLen: 0.14, dorsal: [0.0, -0.12, 0.07, 0.4], anal: [-0.05, -0.2, 0.05, 0.4], eye: 0.07, eyeY: 0.55, eyeZ: 0.38, seg: 12, rad: 8,
    extra: (b, { hAt }) => {
      for (let i = 0; i < 8; i++) {
        const z = 0.3 - i * 0.05;
        for (const sgn of [-1, 1]) glowDot(b, sgn * 0.025, -hAt(z) - 0.12 * Math.min(1, (0.5 - z) / 0.2) * 1 + 0.02, z, 0.013, [0.45, 0.8, 1]);
      }
    },
  }),
  dragonfish: () => fishGeo({
    H: 0.09, W: 0.07, peak: 0.2, nose: 0.4, tailMin: 0.25, back: [0.04, 0.04, 0.05], belly: [0.08, 0.07, 0.08], fin: [0.06, 0.06, 0.07], seg: 24, rad: 8,
    tail: 'fork', tailH: 0.06, tailLen: 0.08, dorsal: [-0.22, -0.34, 0.05, 0.3], anal: [-0.22, -0.34, 0.05, 0.3], eye: 0.02, eyeZ: 0.43,
    extra: (b) => {
      // 下颌与牙齿
      reset(b);
      fin(b, [[0, -0.02, 0.5], [0.03, -0.045, 0.44], [-0.03, -0.045, 0.44]], [0.12, 0.08, 0.08], { normal: [0, -1, 0], s: 0 });
      // 颊部发光器
      glowDot(b, 0.03, 0.0, 0.41, 0.012, [1, 0.3, 0.3]);
      glowDot(b, -0.03, 0.0, 0.41, 0.012, [1, 0.3, 0.3]);
      // 颏须与发光末端
      reset(b);
      const pts = [[0, -0.04, 0.42], [0, -0.12, 0.38], [0.01, -0.2, 0.3], [0, -0.25, 0.26]];
      b.tube(pts, () => 0.003, 3, { color: () => [0.1, 0.1, 0.1], attr: (bb, t) => { reset(bb); bb.set('aS', 0.1); bb.set('aArm', [0, t]); } });
      glowDot(b, 0, -0.255, 0.255, 0.014, [0.5, 0.95, 1]);
      // 侧线发光点
      for (let i = 0; i < 12; i++) { const z = 0.3 - i * 0.05; for (const sgn of [-1, 1]) glowDot(b, sgn * 0.03, -0.035, z, 0.006, [0.4, 0.7, 1]); }
    },
  }),
  anglerfish: () => fishGeo({
    H: 0.62, W: 0.52, peak: 0.42, nose: 0.35, tailMin: 0.14, back: [0.1, 0.08, 0.08], belly: [0.16, 0.12, 0.11], fin: [0.1, 0.09, 0.09], zTail: -0.3, rad: 14,
    tail: 'round', tailH: 0.14, tailLen: 0.16, dorsal: [-0.1, -0.25, 0.05, 0.4], anal: [-0.1, -0.25, 0.05, 0.4], pect: [0.05, 0.1, 0.06, 0.05, false], eye: 0.02, eyeY: 0.45, eyeZ: 0.3,
    extra: (b) => {
      // 巨口与牙
      reset(b);
      fin(b, [[0.2, -0.06, 0.4], [0, -0.1, 0.55], [-0.2, -0.06, 0.4], [0, -0.2, 0.4]], [0.05, 0.03, 0.03], { normal: [0, 0, 1], s: 0 });
      for (let i = 0; i < 9; i++) {
        const a = -0.9 + i * 0.22;
        const x = Math.sin(a) * 0.19, z = 0.4 + Math.cos(a) * 0.12;
        fin(b, [[x - 0.01, -0.06, z], [x + 0.01, -0.06, z], [x, -0.13, z + 0.01]], [0.85, 0.82, 0.75], { normal: [0, 0, 1], s: 0 });
      }
      // 吻上的钓竿与发光饵球
      const pts = [[0, 0.25, 0.3], [0, 0.4, 0.38], [0, 0.44, 0.52], [0, 0.38, 0.64]];
      b.tube(pts, () => 0.008, 4, { color: () => [0.2, 0.16, 0.14], attr: (bb, t) => { reset(bb); bb.set('aS', 0); bb.set('aArm', [0, t * 0.6]); } });
      glowDot(b, 0, 0.36, 0.66, 0.04, [0.6, 1, 0.9]);
    },
  }),
  gulper: () => {
    const b = new Builder(FAUNA_SPEC);
    // 细长鞭尾 + 巨大可张开的口囊
    loft(b, {
      z0: 0.3, z1: -0.5, seg: 30, rad: 8,
      prof: (t) => [0.04 * (1 - t) + 0.003, 0.05 * (1 - t) + 0.003, 0],
      color: () => [0.06, 0.05, 0.06],
    });
    reset(b);
    // 口囊（上下颌之间的膜）
    const jaw = [];
    for (let i = 0; i <= 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      jaw.push([Math.cos(a) * 0.1, Math.sin(a) * 0.11 - 0.02, 0.44]);
    }
    for (let i = 0; i < 8; i++) {
      fin(b, [[0, 0, 0.26], jaw[i], jaw[i + 1]], [0.08, 0.06, 0.08], { normal: [0, 0, 1], s: 0.02, flapFn: () => [0, 0] });
    }
    for (const sgn of [-1, 1]) eye(b, sgn * 0.035, 0.05, 0.32, 0.012);
    glowDot(b, 0, 0, -0.52, 0.018, [1, 0.35, 0.5]);
    return b.build();
  },
  whale: () => fishGeo({
    H: 0.2, W: 0.21, peak: 0.36, nose: 0.5, tailMin: 0.07, back: [0.13, 0.15, 0.18], belly: [0.62, 0.64, 0.66], fin: [0.8, 0.8, 0.8], zTail: -0.4, seg: 26, rad: 14,
    tail: 'none', dorsal: [-0.14, -0.2, 0.03, 0.5], eye: 0.008, eyeY: -0.1, eyeZ: 0.3,
    prof: (t) => {
      const s = spindle(0.2, 0.21, 0.36, 0.5, 0.07)(t);
      return [s[0], s[1], t < 0.25 ? -0.01 * (1 - t / 0.25) : 0];
    },
    colorFn: (t, sy, c) => {
      const grooves = t < 0.35 && sy < -0.3 && Math.sin(sy * 70) > 0.3 ? 0.7 : 1;
      const knob = t < 0.2 && sy > 0.5 && noise3(t * 40, sy * 20, 0) > 0.4 ? 0.6 : 1;
      return c.map((k) => k * grooves * knob);
    },
    extra: (b, { hAt, wAt }) => {
      // 水平尾叶
      fin(b, [[0, 0, -0.38], [0.02, 0, -0.39], [0.13, 0, -0.5], [0.04, 0, -0.46], [0, 0, -0.44], [-0.04, 0, -0.46], [-0.13, 0, -0.5], [-0.02, 0, -0.39]], [0.12, 0.13, 0.15], { normal: [0, 1, 0], s: 1 });
      // 长胸鳍（白色，拍动）
      for (const sgn of [-1, 1]) {
        const x0 = wAt(0.2) * 0.9 * sgn, y0 = -hAt(0.2) * 0.4;
        fin(b, [[x0, y0, 0.24], [x0 + sgn * 0.08, y0 - 0.03, 0.2], [x0 + sgn * 0.3, y0 - 0.12, 0.02], [x0 + sgn * 0.26, y0 - 0.12, -0.02], [x0, y0, 0.14]], [0.85, 0.86, 0.85], { normal: [0, 1, 0], flapFn: (p) => [clamp(Math.abs(p[0] - x0) / 0.3, 0, 1) * 0.5, 0] });
      }
    },
  }),
  dolphin: () => fishGeo({
    H: 0.17, W: 0.16, peak: 0.36, nose: 0.4, tailMin: 0.06, back: [0.35, 0.38, 0.43], belly: [0.85, 0.87, 0.88], fin: [0.33, 0.36, 0.4], zTail: -0.42, seg: 22,
    tail: 'none', dorsal: [0.06, -0.08, 0.1, 0.8], pect: [0.22, 0.12, 0.04, 0.05, true], pectFlap: 0.1, eye: 0.01, eyeY: 0.0, eyeZ: 0.36,
    prof: (t) => {
      if (t < 0.08) { const k = t / 0.08; return [0.012 + 0.02 * k, 0.012 + 0.02 * k, -0.02]; }
      const s = spindle(0.17, 0.16, 0.36, 0.5, 0.06)(t);
      return [s[0], s[1], 0];
    },
    extra: (b) => {
      fin(b, [[0, 0, -0.4], [0.02, 0, -0.41], [0.1, 0, -0.5], [0.03, 0, -0.47], [0, 0, -0.45], [-0.03, 0, -0.47], [-0.1, 0, -0.5], [-0.02, 0, -0.41]], [0.33, 0.36, 0.4], { normal: [0, 1, 0], s: 1 });
    },
  }),
  seal: () => fishGeo({
    H: 0.22, W: 0.22, peak: 0.42, nose: 0.45, tailMin: 0.1, back: [0.32, 0.3, 0.27], belly: [0.55, 0.52, 0.47], fin: [0.25, 0.23, 0.21], zTail: -0.38, seg: 20,
    tail: 'none', pect: [0.22, 0.1, 0.04, 0.05, false], pectFlap: 0.3, eye: 0.02, eyeY: 0.35, eyeZ: 0.4,
    colorFn: (t, sy, c) => (noise3(t * 30, sy * 8, 3) > 0.45 ? c.map((k) => k * 0.6) : c),
    extra: (b) => {
      // 后鳍（竖直成对的扇形，侧向扫动）
      for (const sgn of [-1, 1]) fin(b, [[sgn * 0.02, 0, -0.36], [sgn * 0.03, 0.06, -0.5], [sgn * 0.02, 0, -0.46], [sgn * 0.03, -0.06, -0.5]], [0.22, 0.2, 0.18], { normal: [1, 0, 0], s: 1 });
      // 胡须
      reset(b);
      for (const sgn of [-1, 1]) for (let i = 0; i < 3; i++) b.tube([[sgn * 0.04, -0.01 - i * 0.008, 0.47], [sgn * 0.1, -0.02 - i * 0.015, 0.44]], () => 0.002, 3, { color: () => [0.8, 0.78, 0.7], attr: (bb) => { reset(bb); bb.set('aS', 0); } });
    },
  }),
  sunfish: () => fishGeo({
    H: 0.75, W: 0.2, peak: 0.45, nose: 0.6, tailMin: 0.62, back: [0.5, 0.55, 0.6], belly: [0.8, 0.82, 0.84], fin: [0.45, 0.5, 0.55], zTail: -0.36, rad: 14,
    tail: 'none', dorsal: [-0.1, -0.3, 0.55, 0.62], anal: [-0.1, -0.3, 0.55, 0.62], finFlap: true, eye: 0.03, eyeZ: 0.3, eyeY: 0.1,
    colorFn: (t, sy, c) => (noise3(t * 12, sy * 6, 5) > 0.35 ? c.map((k) => k * 0.82) : c),
    extra: (b) => {
      // 舵鳍（clavus）：圆钝的后缘
      fin(b, [[0, 0.2, -0.34], [0, 0.26, -0.44], [0, 0, -0.5], [0, -0.26, -0.44], [0, -0.2, -0.34]], [0.5, 0.55, 0.6], { s: 0.9 });
    },
  }),
  manta: () => {
    const b = new Builder(FAUNA_SPEC);
    const NX = 16, NZ = 10;
    const top = [], bot = [];
    const outline = (u) => {
      // u ∈ [-1,1]（翼展方向），返回该处的前后缘 z
      const a = Math.abs(u);
      const lead = 0.28 - 0.25 * a * a + 0.12 * a * (1 - a);
      const trail = -0.18 + 0.22 * a - 0.05 * a * a;
      return [lead, trail];
    };
    for (let i = 0; i <= NX; i++) {
      const u = (i / NX) * 2 - 1;
      const [lz, tz] = outline(u);
      const rowT = [], rowB = [];
      for (let j = 0; j <= NZ; j++) {
        const v = j / NZ;
        const z = lerp(lz, tz, v);
        const th = 0.07 * (1 - Math.abs(u)) * Math.sin(Math.PI * Math.min(1, v * 1.05 + 0.02)) + 0.004;
        const x = u * 0.95;
        const w = Math.pow(Math.abs(u), 1.4);
        reset(b);
        b.set('aS', clamp(0.5 - z, 0, 1)); b.set('aFlap', [w, 0]);
        const shoulder = Math.abs(u) < 0.25 && v < 0.35 && u !== 0 ? 1 : 0;
        const topC = shoulder ? [0.8, 0.8, 0.78] : [0.07, 0.08, 0.1];
        rowT.push(b.v([x, th, z], [0, 1, 0], topC));
        const spot = noise3(u * 9, v * 9, 7) > 0.55 ? 0.35 : 1;
        rowB.push(b.v([x, -th * 0.6, z], [0, -1, 0], [0.9 * spot, 0.9 * spot, 0.9 * spot]));
      }
      top.push(rowT); bot.push(rowB);
    }
    for (let i = 0; i < NX; i++) for (let j = 0; j < NZ; j++) {
      b.quad(top[i][j], top[i][j + 1], top[i + 1][j + 1], top[i + 1][j]);
      b.quad(bot[i][j], bot[i + 1][j], bot[i + 1][j + 1], bot[i][j + 1]);
    }
    // 头鳍与尾
    for (const sgn of [-1, 1]) fin(b, [[sgn * 0.12, 0, 0.26], [sgn * 0.16, 0.0, 0.38], [sgn * 0.1, -0.02, 0.36]], [0.08, 0.08, 0.1], { normal: [1, 0, 0], s: 0.0 });
    reset(b);
    b.tube([[0, 0, -0.15], [0, 0, -0.35], [0, 0.01, -0.55]], (t) => 0.012 * (1 - t) + 0.002, 4, { color: () => [0.08, 0.08, 0.1], attr: (bb, t) => { reset(bb); bb.set('aS', 0.7 + t * 0.3); } });
    for (const sgn of [-1, 1]) eye(b, sgn * 0.13, 0.0, 0.28, 0.012);
    return b.build();
  },
  turtle: () => {
    const b = new Builder(FAUNA_SPEC);
    reset(b);
    // 背甲
    b.blob(2, (d) => [d[0] * 0.3, (d[1] > 0 ? d[1] * 0.14 : d[1] * 0.06), d[2] * 0.38], (p, n) => {
      if (n[1] < -0.3) return [0.75, 0.68, 0.5];
      const plate = (Math.sin(p[0] * 30) * Math.sin(p[2] * 25) > 0.2) ? 0.75 : 1;
      return [0.42 * plate, 0.33 * plate, 0.2 * plate];
    }, (bb) => { reset(bb); bb.set('aS', 0.5); });
    // 头
    reset(b);
    b.blob(1, (d) => [d[0] * 0.06, d[1] * 0.05 + 0.01, d[2] * 0.08 + 0.46], () => [0.5, 0.45, 0.3], (bb) => { reset(bb); bb.set('aS', 0); });
    for (const sgn of [-1, 1]) eye(b, sgn * 0.045, 0.03, 0.5, 0.012);
    // 前鳍（长，拍动）与后鳍
    for (const sgn of [-1, 1]) {
      fin(b, [[sgn * 0.22, 0, 0.22], [sgn * 0.3, 0, 0.26], [sgn * 0.62, -0.02, 0.02], [sgn * 0.58, -0.02, -0.04], [sgn * 0.24, 0, 0.12]], [0.45, 0.4, 0.28], { normal: [0, 1, 0], flapFn: (p) => [clamp((Math.abs(p[0]) - 0.22) / 0.4, 0, 1), 0] });
      fin(b, [[sgn * 0.14, 0, -0.3], [sgn * 0.3, 0, -0.42], [sgn * 0.12, 0, -0.4]], [0.45, 0.4, 0.28], { normal: [0, 1, 0], flapFn: (p) => [0, clamp((Math.abs(p[0]) - 0.1) / 0.2, 0, 1) * 0.4] });
    }
    return b.build();
  },
  squid: () => {
    const b = new Builder(FAUNA_SPEC);
    // 外套膜（前端尖）朝 +z，腕在 -z
    loft(b, {
      z0: 0.5, z1: -0.08, seg: 14, rad: 10,
      prof: (t) => { const f = Math.pow(Math.sin(Math.PI / 2 * Math.min(1, t / 0.75)), 0.7); return [0.075 * f + 0.004, 0.075 * f + 0.004, 0]; },
      color: (t, sy) => { const sp = noise3(t * 30, sy * 6, 9) > 0.3 ? 0.75 : 1; return [0.85 * sp, 0.5 * sp, 0.45 * sp]; },
      pulse: (t) => smoothstep(0.1, 0.5, t),
    });
    // 鳍
    for (const sgn of [-1, 1]) fin(b, [[sgn * 0.03, 0, 0.48], [sgn * 0.13, 0, 0.36], [sgn * 0.05, 0, 0.26]], [0.85, 0.55, 0.5], { normal: [0, 1, 0], flapFn: (p) => [clamp(Math.abs(p[0]) / 0.13, 0, 1), 0] });
    // 头与眼
    reset(b);
    b.blob(1, (d) => [d[0] * 0.06, d[1] * 0.06, d[2] * 0.06 - 0.12], () => [0.85, 0.55, 0.5], (bb) => { reset(bb); bb.set('aS', 0.6); });
    for (const sgn of [-1, 1]) eye(b, sgn * 0.055, 0.01, -0.12, 0.022);
    // 8 腕 + 2 触腕
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const long = i === 2 || i === 7;
      const L = long ? 0.42 : 0.24;
      const pts = [];
      for (let k = 0; k <= 5; k++) { const t = k / 5; pts.push([Math.cos(a) * 0.03 * (1 + t), Math.sin(a) * 0.03 * (1 + t), -0.16 - t * L]); }
      reset(b);
      b.tube(pts, (t) => 0.012 * (1 - 0.7 * t) + (long && t > 0.85 ? 0.006 : 0), 4, { color: () => [0.9, 0.55, 0.5], attr: (bb, t) => { reset(bb); bb.set('aS', 0.7 + t * 0.3); bb.set('aArm', [i, t]); } });
    }
    return b.build();
  },
  vampire: () => {
    const b = new Builder(FAUNA_SPEC);
    loft(b, {
      z0: 0.5, z1: 0.0, seg: 10, rad: 10,
      prof: (t) => { const f = Math.pow(Math.sin(Math.PI / 2 * Math.min(1, t / 0.8)), 0.6); return [0.12 * f + 0.004, 0.12 * f + 0.004, 0]; },
      color: () => [0.35, 0.06, 0.07],
    });
    for (const sgn of [-1, 1]) fin(b, [[sgn * 0.08, 0, 0.36], [sgn * 0.19, 0.0, 0.3], [sgn * 0.09, 0, 0.24]], [0.3, 0.05, 0.06], { normal: [0, 1, 0], flapFn: (p) => [clamp((Math.abs(p[0]) - 0.08) / 0.1, 0, 1), 0] });
    for (const sgn of [-1, 1]) eye(b, sgn * 0.1, 0.03, 0.08, 0.035, [0.25, 0.3, 0.45]);
    // 伞膜：8 腕之间连着蹼
    const n = 8, L = 0.45;
    const armPts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const pts = [];
      for (let k = 0; k <= 5; k++) { const t = k / 5; const r = 0.1 + t * 0.2; pts.push([Math.cos(a) * r, Math.sin(a) * r, -t * L]); }
      armPts.push(pts);
      reset(b);
      b.tube(pts, (t) => 0.018 * (1 - 0.6 * t), 4, { color: () => [0.3, 0.05, 0.06], attr: (bb, t) => { reset(bb); bb.set('aS', 0.5 + t * 0.5); bb.set('aArm', [i, t]); bb.set('aPulse', t); } });
      glowDot(b, pts[5][0], pts[5][1], pts[5][2], 0.018, [0.5, 0.8, 1]);
    }
    for (let i = 0; i < n; i++) {
      const A = armPts[i], B2 = armPts[(i + 1) % n];
      for (let k = 0; k < 4; k++) {
        reset(b);
        const quad = [A[k], B2[k], B2[k + 1], A[k + 1]];
        b.set('aS', 0.6); b.set('aArm', [i, k / 5]); b.set('aPulse', k / 5);
        const ia = b.v(quad[0], [0, 0, -1], [0.22, 0.03, 0.05]);
        b.set('aArm', [(i + 1) % n, k / 5]);
        const ib = b.v(quad[1], [0, 0, -1], [0.22, 0.03, 0.05]);
        b.set('aArm', [(i + 1) % n, (k + 1) / 5]); b.set('aPulse', (k + 1) / 5);
        const ic = b.v(quad[2], [0, 0, -1], [0.22, 0.03, 0.05]);
        b.set('aArm', [i, (k + 1) / 5]);
        const id = b.v(quad[3], [0, 0, -1], [0.22, 0.03, 0.05]);
        b.quad(ia, ib, ic, id);
      }
    }
    return b.build();
  },
  octopus: () => {
    const b = new Builder(FAUNA_SPEC);
    const col = (p, n) => { const m = noise3(p[0] * 30, p[1] * 30, p[2] * 30) > 0.2 ? 0.7 : 1; return [0.62 * m, 0.33 * m, 0.24 * m]; };
    reset(b);
    // 外套膜在后上方
    b.blob(2, (d) => [d[0] * 0.14, d[1] * 0.13 + 0.16, d[2] * 0.18 - 0.1], col, (bb) => { reset(bb); bb.set('aS', 0.5); bb.set('aPulse', 1); });
    reset(b);
    b.blob(1, (d) => [d[0] * 0.11, d[1] * 0.08 + 0.06, d[2] * 0.1 + 0.04], col, (bb) => { reset(bb); bb.set('aS', 0.3); });
    for (const sgn of [-1, 1]) eye(b, sgn * 0.08, 0.12, 0.06, 0.025, [0.7, 0.6, 0.2]);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.2;
      const pts = [];
      for (let k = 0; k <= 8; k++) {
        const t = k / 8;
        const r = 0.08 + t * 0.42;
        pts.push([Math.cos(a) * r, 0.02 + 0.05 * Math.sin(t * 3) * (1 - t), Math.sin(a) * r + 0.04]);
      }
      reset(b);
      b.tube(pts, (t) => 0.035 * (1 - 0.85 * t), 5, { color: (t, ang) => (Math.sin(ang) < -0.3 ? [0.9, 0.75, 0.65] : [0.62, 0.33, 0.24]), attr: (bb, t) => { reset(bb); bb.set('aS', 0.4); bb.set('aArm', [i, t]); } });
    }
    return b.build();
  },
  flapjack: () => {
    const b = new Builder(FAUNA_SPEC);
    reset(b);
    b.blob(2, (d) => {
      const r = Math.hypot(d[0], d[2]);
      const y = d[1] > 0 ? d[1] * 0.28 * (1 - r * 0.3) : d[1] * 0.07;
      const scal = 0.45 * (1 + 0.06 * Math.sin(Math.atan2(d[2], d[0]) * 8));
      return [d[0] * scal, y, d[2] * scal];
    }, (p, n) => (n[1] < -0.5 ? [0.95, 0.55, 0.4] : [0.95, 0.4, 0.22]), (bb, p) => { reset(bb); bb.set('aS', 0.5); bb.set('aPulse', clamp(Math.hypot(p[0], p[2]) / 0.45, 0, 1)); });
    for (const sgn of [-1, 1]) fin(b, [[sgn * 0.1, 0.18, 0.02], [sgn * 0.2, 0.3, 0.0], [sgn * 0.17, 0.2, -0.06]], [0.95, 0.45, 0.25], { normal: [1, 0, 0], flapFn: () => [0, 1] });
    for (const sgn of [-1, 1]) eye(b, sgn * 0.08, 0.14, 0.14, 0.03);
    return b.build();
  },
  crab: () => {
    const b = new Builder(FAUNA_SPEC);
    const shell = [0.75, 0.32, 0.18];
    reset(b);
    b.blob(2, (d) => [d[0] * 0.3, d[1] > 0 ? d[1] * 0.12 : d[1] * 0.05, d[2] * 0.22 + (d[2] > 0 ? 0.02 : 0)], (p, n) => (n[1] > 0 ? shell : [0.9, 0.75, 0.6]), (bb) => { reset(bb); bb.set('aS', 0.5); });
    for (const sgn of [-1, 1]) eye(b, sgn * 0.06, 0.12, 0.2, 0.018);
    for (let i = 0; i < 8; i++) {
      const sgn = i < 4 ? -1 : 1;
      const k = i % 4;
      const z = 0.1 - k * 0.08;
      const pts = [[sgn * 0.26, 0.0, z], [sgn * 0.42, 0.1, z - 0.02], [sgn * 0.55, -0.12, z - 0.05]];
      reset(b);
      b.tube(pts, (t) => 0.025 * (1 - 0.5 * t), 4, { color: () => shell, attr: (bb, t) => { reset(bb); bb.set('aS', 0.5); bb.set('aArm', [i, t]); } });
    }
    // 螯
    for (const sgn of [-1, 1]) {
      const pts = [[sgn * 0.2, 0.02, 0.18], [sgn * 0.3, 0.06, 0.32], [sgn * 0.22, 0.05, 0.44]];
      reset(b);
      b.tube(pts, (t) => 0.035 + 0.03 * t, 5, { color: () => shell, attr: (bb, t) => { reset(bb); bb.set('aS', 0.2); bb.set('aArm', [8 + (sgn > 0 ? 1 : 0), t * 0.3]); }, capEnd: true });
    }
    return b.build();
  },
  seastar: () => {
    const b = new Builder(FAUNA_SPEC);
    reset(b);
    b.blob(3, (d) => {
      const a = Math.atan2(d[2], d[0]);
      const arm = Math.pow(Math.abs(Math.cos(a * 2.5)), 4);
      const r = 0.12 + 0.38 * arm;
      const h = Math.hypot(d[0], d[2]);
      return [d[0] / Math.max(h, 1e-3) * r * h, d[1] > 0 ? d[1] * (0.05 + 0.04 * arm) : d[1] * 0.02, d[2] / Math.max(h, 1e-3) * r * h];
    }, (p, n) => { const bump = noise3(p[0] * 60, 0, p[2] * 60) > 0.3 ? 0.85 : 1; return n[1] > 0 ? [0.95 * bump, 0.45 * bump, 0.2 * bump] : [0.9, 0.7, 0.5]; }, (bb, p) => {
      reset(bb);
      const a = Math.atan2(p[2], p[0]);
      bb.set('aArm', [Math.round((a / (Math.PI * 2)) * 5 + 5) % 5, clamp(Math.hypot(p[0], p[2]) / 0.5, 0, 1)]);
    });
    return b.build();
  },
  urchin: () => {
    const b = new Builder(FAUNA_SPEC);
    reset(b);
    b.blob(2, (d) => [d[0] * 0.25, d[1] > 0 ? d[1] * 0.2 : d[1] * 0.08, d[2] * 0.25], () => [0.18, 0.08, 0.16], (bb) => reset(bb));
    const rnd = mulberry32(7);
    for (let i = 0; i < 70; i++) {
      const u = rnd() * 2 - 1, a = rnd() * Math.PI * 2;
      const y = Math.abs(u) * 0.9 + 0.1;
      const r = Math.sqrt(1 - y * y);
      const d = [Math.cos(a) * r, y, Math.sin(a) * r];
      const base = [d[0] * 0.24, d[1] * 0.18, d[2] * 0.24];
      const L = 0.35 + rnd() * 0.25;
      reset(b);
      b.tube([base, [base[0] + d[0] * L, base[1] + d[1] * L, base[2] + d[2] * L]], (t) => 0.012 * (1 - t) + 0.001, 3, { color: () => [0.12, 0.06, 0.1], attr: (bb, t) => { reset(bb); bb.set('aArm', [i % 8, t]); } });
    }
    return b.build();
  },
  isopod: () => {
    const b = new Builder(FAUNA_SPEC);
    reset(b);
    b.blob(3, (d) => {
      const seg = 0.02 * Math.abs(Math.sin(d[2] * 18));
      return [d[0] * 0.24, d[1] > 0 ? d[1] * (0.14 - seg) : d[1] * 0.04, d[2] * 0.5];
    }, (p, n) => { const s = Math.abs(Math.sin(p[2] * 36)) < 0.25 ? 0.7 : 1; return n[1] > 0 ? [0.72 * s, 0.66 * s, 0.7 * s] : [0.85, 0.8, 0.75]; }, (bb) => { reset(bb); bb.set('aS', 0.5); });
    for (const sgn of [-1, 1]) eye(b, sgn * 0.12, 0.05, 0.4, 0.03, [0.12, 0.1, 0.08]);
    for (let i = 0; i < 14; i++) {
      const sgn = i % 2 ? 1 : -1;
      const k = Math.floor(i / 2);
      const z = 0.3 - k * 0.09;
      reset(b);
      b.tube([[sgn * 0.2, -0.02, z], [sgn * 0.3, -0.04, z - 0.02], [sgn * 0.34, -0.1, z - 0.03]], () => 0.012, 3, { color: () => [0.8, 0.72, 0.7], attr: (bb, t) => { reset(bb); bb.set('aS', 0.5); bb.set('aArm', [i, t]); } });
    }
    // 触角
    for (const sgn of [-1, 1]) { reset(b); b.tube([[sgn * 0.05, 0.02, 0.48], [sgn * 0.15, 0.04, 0.62], [sgn * 0.25, 0.02, 0.7]], () => 0.006, 3, { color: () => [0.8, 0.72, 0.7], attr: (bb, t) => { reset(bb); bb.set('aArm', [14, t]); } }); }
    return b.build();
  },
  brittlestar: () => {
    const b = new Builder(FAUNA_SPEC);
    reset(b);
    b.blob(1, (d) => [d[0] * 0.1, d[1] * 0.03, d[2] * 0.1], () => [0.75, 0.62, 0.55], (bb) => reset(bb));
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const pts = [];
      for (let k = 0; k <= 10; k++) {
        const t = k / 10;
        const r = 0.08 + t * 0.9;
        const bend = Math.sin(t * 4 + i) * 0.2 * t;
        pts.push([Math.cos(a + bend) * r, 0.01 + Math.sin(t * Math.PI) * 0.04, Math.sin(a + bend) * r]);
      }
      reset(b);
      b.tube(pts, (t) => 0.02 * (1 - 0.8 * t) + 0.003, 4, { color: (t) => (Math.sin(t * 40) > 0.3 ? [0.72, 0.58, 0.5] : [0.55, 0.42, 0.38]), attr: (bb, t) => { reset(bb); bb.set('aArm', [i, t]); } });
    }
    return b.build();
  },
  seacucumber: () => {
    const b = new Builder(FAUNA_SPEC);
    reset(b);
    b.blob(2, (d) => [d[0] * 0.2, d[1] > 0 ? d[1] * 0.18 : d[1] * 0.08, d[2] * 0.5], (p) => [0.82, 0.62, 0.66], (bb, p) => { reset(bb); bb.set('aS', clamp(0.5 - p[2], 0, 1)); });
    // 背上的“腿”（深海海猪）
    for (let i = 0; i < 6; i++) {
      const sgn = i % 2 ? 1 : -1;
      const z = 0.2 - Math.floor(i / 2) * 0.12;
      reset(b);
      b.tube([[sgn * 0.08, 0.14, z], [sgn * 0.1, 0.24, z + 0.03]], (t) => 0.022 * (1 - t) + 0.004, 4, { color: () => [0.85, 0.66, 0.7], attr: (bb, t) => { reset(bb); bb.set('aArm', [i, t]); } });
    }
    for (let i = 0; i < 10; i++) {
      const sgn = i % 2 ? 1 : -1;
      const z = 0.3 - Math.floor(i / 2) * 0.13;
      reset(b);
      b.tube([[sgn * 0.17, -0.02, z], [sgn * 0.22, -0.08, z]], (t) => 0.02 * (1 - t) + 0.004, 4, { color: () => [0.85, 0.66, 0.7], attr: (bb, t) => { reset(bb); bb.set('aArm', [i, t]); } });
    }
    return b.build();
  },
  seapen: () => {
    const b = new Builder(FAUNA_SPEC);
    const col = [0.95, 0.55, 0.35];
    reset(b);
    b.tube([[0, -0.05, 0], [0, 0.3, 0], [0, 0.7, 0.02], [0, 1.0, 0.04]], (t) => 0.02 * (1 - 0.5 * t), 5, { color: () => col, attr: (bb, t) => { reset(bb); bb.set('aS', t); } });
    for (let k = 0; k < 18; k++) {
      const t = 0.35 + (k / 18) * 0.62;
      const y = t * 1.0;
      for (const sgn of [-1, 1]) {
        const len = 0.14 * Math.sin(Math.PI * (k + 1) / 19) + 0.04;
        fin(b, [[0, y, 0.02], [sgn * len, y + 0.04, 0.0], [sgn * len * 0.9, y + 0.07, 0.01], [0, y + 0.035, 0.02]], [1, 0.7, 0.5], { normal: [0, 0, 1], s: t, glow: 0.12 });
      }
    }
    return b.build();
  },
  ventshrimp: () => shrimpGeo([0.95, 0.9, 0.8], false),
  mwshrimp: () => shrimpGeo([0.95, 0.2, 0.12], true),
  jelly: () => {
    const b = new Builder(FAUNA_SPEC);
    // 伞体朝 +z（前进方向）
    reset(b);
    b.blob(2, (d) => {
      const z = d[2] > -0.1 ? d[2] * 0.45 : -0.045 + (d[2] + 0.1) * 0.05;
      return [d[0] * 0.3, d[1] * 0.3, z];
    }, (p) => [0.75, 0.8, 0.95], (bb, p) => { reset(bb); bb.set('aPulse', clamp(1 - p[2] / 0.45, 0, 1)); bb.set('aGlow', p[2] < -0.02 ? 0.5 : 0.08); });
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const pts = [];
      for (let k = 0; k <= 6; k++) { const t = k / 6; pts.push([Math.cos(a) * 0.27, Math.sin(a) * 0.27, -0.05 - t * 0.9]); }
      reset(b);
      b.tube(pts, () => 0.004, 3, { color: () => [0.8, 0.85, 1], attr: (bb, t) => { reset(bb); bb.set('aArm', [i, t]); bb.set('aPulse', 0.6); bb.set('aGlow', 0.25); } });
    }
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      const pts = [];
      for (let k = 0; k <= 5; k++) { const t = k / 5; pts.push([Math.cos(a) * 0.05, Math.sin(a) * 0.05, -0.05 - t * 0.45]); }
      reset(b);
      b.tube(pts, (t) => 0.03 * (1 - t) + 0.006, 4, { color: () => [0.9, 0.75, 0.85], attr: (bb, t) => { reset(bb); bb.set('aArm', [12 + i, t]); bb.set('aGlow', 0.15); } });
    }
    return b.build();
  },
  siphonophore: () => {
    const b = new Builder(FAUNA_SPEC);
    // 沿 z 的长链：前端泳钟 + 后面一串营养体与垂下的触手
    const N = 34;
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1);
      const z = 0.5 - t;
      const r = i < 5 ? 0.02 : 0.009;
      reset(b);
      b.blob(1, (d) => [d[0] * r, d[1] * r, z + d[2] * r * 1.4], () => (i < 5 ? [0.85, 0.9, 1] : [0.95, 0.6, 0.5]), (bb) => { reset(bb); bb.set('aS', t); bb.set('aGlow', i < 5 ? 0.3 : 0.6); });
      if (i >= 5 && i % 2 === 0) {
        reset(b);
        b.tube([[0, 0, z], [0, -0.02, z - 0.004], [0, -0.06, z - 0.01]], () => 0.0015, 3, { color: () => [0.9, 0.7, 0.6], attr: (bb, tt) => { reset(bb); bb.set('aS', t); bb.set('aArm', [i % 6, tt]); bb.set('aGlow', 0.3); } });
      }
    }
    reset(b);
    const stem = [];
    for (let k = 0; k <= 20; k++) stem.push([0, 0, 0.5 - k / 20]);
    b.tube(stem, () => 0.002, 3, { color: () => [0.9, 0.85, 0.9], attr: (bb, t) => { reset(bb); bb.set('aS', t); bb.set('aGlow', 0.2); } });
    return b.build();
  },
};

function shrimpGeo(col, long) {
  const b = new Builder(FAUNA_SPEC);
  loft(b, {
    z0: 0.4, z1: -0.35, seg: 12, rad: 8,
    prof: (t) => { const f = Math.sin(Math.PI * Math.min(1, t * 0.95 + 0.05)); return [0.07 * f + 0.004, 0.09 * f + 0.004, 0.06 * Math.sin(t * Math.PI) - 0.03]; },
    color: (t, sy) => mix3(col, col.map((k) => k * 0.75), smoothstep(0.3, 0.9, Math.abs(Math.sin(t * 28)))),
  });
  caudal(b, -0.34, 0.06, 0.12, 'fork', col);
  for (const sgn of [-1, 1]) eye(b, sgn * 0.05, 0.05, 0.36, 0.022);
  // 游泳足与触角
  for (let i = 0; i < 10; i++) {
    const sgn = i % 2 ? 1 : -1;
    const z = 0.25 - Math.floor(i / 2) * 0.1;
    reset(b);
    b.tube([[sgn * 0.03, -0.06, z], [sgn * 0.06, -0.16, z - 0.02]], () => 0.007, 3, { color: () => col, attr: (bb, t) => { reset(bb); bb.set('aS', 0.4); bb.set('aArm', [i, t]); } });
  }
  for (const sgn of [-1, 1]) {
    reset(b);
    const L = long ? 1.1 : 0.5;
    b.tube([[sgn * 0.02, 0.02, 0.4], [sgn * 0.1, 0.06, 0.4 + L * 0.4], [sgn * 0.2, 0.0, 0.4 + L]], () => 0.004, 3, { color: () => col, attr: (bb, t) => { reset(bb); bb.set('aS', 0); bb.set('aArm', [11, t]); } });
  }
  return b.build();
}
