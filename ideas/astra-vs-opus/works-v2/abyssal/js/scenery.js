// 景物：程序化生成的岩石、珊瑚、海藻、海草、海绵、矿物烟囱与管虫；
// 以 32 米的地块为单位按世界坐标播种（回到同一地点得到同样的群落），只在镜头附近展开并逐帧视锥剔除。
import * as THREE from 'three';
import { U, COMMON_GLSL } from './optics.js';
import { Builder, noise3, fbm3, V } from './geom.js';
import { mulberry32, hash2i, clamp, smoothstep, lerp } from './noise.js';

const SPEC = { aSway: 1, aAO: 1 };

// ——————————————————— 几何生成 ———————————————————
function rockGeo(seed, style) {
  const b = new Builder(SPEC);
  const rnd = mulberry32(seed);
  const o = rnd() * 100;
  const topCol = style === 'basalt' ? [0.16, 0.15, 0.15] : style === 'kelp' ? [0.42, 0.33, 0.33] : [0.55, 0.52, 0.38];
  const sideCol = style === 'basalt' ? [0.13, 0.12, 0.12] : style === 'kelp' ? [0.3, 0.29, 0.28] : [0.66, 0.63, 0.55];
  const tiers = style === 'shelf' ? [[0, 0, 0, 1, 1], [0.25, 0.32, -0.1, 0.62, 0.8], [-0.3, 0.52, 0.2, 0.4, 0.7]] : [[0, 0, 0, 1, 1]];
  const nt = style === 'shelf' ? 1 + Math.floor(rnd() * 3) : 1;
  for (let ti = 0; ti < nt; ti++) {
  const [ox, oy, oz, os, oys] = tiers[ti];
  const rot = rnd() * Math.PI * 2;
  b.blob(style === 'pinnacle' ? 4 : 3, (d0) => {
    const d = [d0[0] * Math.cos(rot) - d0[2] * Math.sin(rot), d0[1], d0[0] * Math.sin(rot) + d0[2] * Math.cos(rot)];
    let [x, y, z] = d;
    const n1 = fbm3(x * 1.3 + o, y * 1.3, z * 1.3, 3, seed & 7);
    const n2 = noise3(x * 5 + o, y * 5, z * 5, 3);
    let r = 1 + 0.42 * n1 + 0.08 * n2;
    x *= r; y *= r; z *= r;
    if (style === 'shelf' || style === 'kelp') {
      const eq = 1 - Math.abs(d[1]);
      x *= 1 + 0.18 * eq; z *= 1 + 0.18 * eq;          // 侧壁更陡
      y *= 0.58;
      if (y > 0.16) y = 0.16 + (y - 0.16) * 0.14;       // 台地顶面
      const k = 6;
      const ys = Math.floor(y * k + 0.5) / k;
      y = lerp(y, ys, 0.3) + 0.02 * n2;                 // 层理台阶
      const under = smoothstep(0.02, -0.3, y);
      x *= 1 - 0.06 * under; z *= 1 - 0.06 * under;     // 底部略收
    } else if (style === 'boulder') {
      y *= 0.72;
    } else if (style === 'pinnacle') {
      const h = (d[1] + 1) * 0.5;
      y = (h * 2 - 1) * 3.2 + 0.25 * n1;
      const taper = 1.15 - 0.75 * h;
      x *= taper; z *= taper;
      y += 0.06 * Math.sin(y * 9 + n2);
    } else if (style === 'basalt') {
      y *= 0.55;
      const lump = 0.12 * Math.sin(x * 4 + o) * Math.sin(z * 4);
      y += lump;
    }
    return [x * os + ox, y * os * oys + oy, z * os + oz];
  }, (p, n) => {
    const top = smoothstep(0.35, 0.85, n[1]);
    const nv = 0.8 + 0.4 * noise3(p[0] * 3 + o, p[1] * 3, p[2] * 3);
    return [lerp(sideCol[0], topCol[0], top) * nv, lerp(sideCol[1], topCol[1], top) * nv, lerp(sideCol[2], topCol[2], top) * nv];
  }, (bb, p) => {
    bb.set('aSway', 0);
    bb.set('aAO', clamp(0.55 + 0.6 * (p[1] + 0.3), 0.35, 1));
  });
  }
  return b.build();
}

// 分枝珊瑚（鹿角珊瑚类）
function branchingGeo(seed, cold) {
  const b = new Builder(SPEC);
  const rnd = mulberry32(seed);
  const base = cold ? [0.92, 0.88, 0.8] : [1, 1, 1];
  function branch(start, dir, len, rad, depth) {
    const pts = [];
    const segs = 3;
    let p = start.slice(), d = dir.slice();
    pts.push(p.slice());
    for (let i = 0; i < segs; i++) {
      d = V.norm([d[0] + (rnd() - 0.5) * 0.35, d[1] + (rnd() - 0.5) * 0.2 + 0.08, d[2] + (rnd() - 0.5) * 0.35]);
      p = V.add(p, V.scale(d, len / segs));
      pts.push(p.slice());
    }
    b.tube(pts, (t) => rad * (1 - 0.55 * t), 5, {
      color: (t) => {
        const tip = depth === 0 ? smoothstep(0.4, 1, t) : 0;
        return [base[0] * (0.8 + 0.35 * tip), base[1] * (0.8 + 0.35 * tip), base[2] * (0.8 + 0.35 * tip)];
      },
      attr: (bb, t) => { bb.set('aSway', 0); bb.set('aAO', clamp(0.45 + p[1] * 0.5 + t * 0.2, 0.4, 1)); },
      capEnd: depth === 0,
    });
    if (depth > 0) {
      const kids = 2 + (rnd() < 0.5 ? 1 : 0);
      for (let k = 0; k < kids; k++) {
        const at = 0.45 + rnd() * 0.5;
        const idx = Math.min(segs, Math.round(at * segs));
        const sp = pts[idx];
        const a = rnd() * Math.PI * 2;
        const tilt = 0.55 + rnd() * 0.6;
        const nd = V.norm([d[0] + Math.cos(a) * tilt, d[1] + 0.1, d[2] + Math.sin(a) * tilt]);
        branch(sp, nd, len * (0.7 + rnd() * 0.2), rad * 0.72, depth - 1);
      }
    }
  }
  const trunks = cold ? 5 : 4 + Math.floor(rnd() * 3);
  for (let i = 0; i < trunks; i++) {
    const a = (i / trunks) * Math.PI * 2 + rnd();
    const lean = 0.5 + rnd() * 0.6;
    branch([Math.cos(a) * 0.08, -0.05, Math.sin(a) * 0.08], V.norm([Math.cos(a) * lean, 1, Math.sin(a) * lean]), 0.34 + rnd() * 0.12, 0.075, 3);
  }
  return b.build();
}

// 脑珊瑚 / 团块珊瑚
function brainGeo(seed) {
  const b = new Builder(SPEC);
  const o = seed * 0.37;
  b.blob(3, (d) => {
    let [x, y, z] = d;
    const n = fbm3(x * 1.2 + o, y * 1.2, z * 1.2, 2);
    let r = 1 + 0.18 * n;
    const groove = Math.abs(Math.sin((noise3(x * 2.5 + o, y * 2.5, z * 2.5) * 9)));
    r *= 1 - 0.035 * groove;
    x *= r; z *= r; y = y * r * 0.62;
    if (y < -0.1) y = -0.1 + (y + 0.1) * 0.15;
    return [x, y, z];
  }, (p, n, d) => {
    const groove = Math.abs(Math.sin(noise3(d[0] * 2.5 + o, d[1] * 2.5, d[2] * 2.5) * 9));
    const k = 0.75 + 0.3 * groove;
    return [k, k, k];
  }, (bb, p) => { bb.set('aSway', 0); bb.set('aAO', clamp(0.5 + p[1] * 1.2, 0.35, 1)); });
  return b.build();
}

// 桌状珊瑚
function tableGeo(seed) {
  const b = new Builder(SPEC);
  const rnd = mulberry32(seed);
  b.tube([[0, -0.05, 0], [0.03, 0.2, 0], [0, 0.42, 0.02]], [0.12, 0.09, 0.14], 7, {
    color: () => [0.8, 0.8, 0.8], attr: (bb) => { bb.set('aSway', 0); bb.set('aAO', 0.5); },
  });
  const R = 16, S = 28;
  const rows = [];
  const ph = rnd() * 10;
  for (let i = 0; i <= R; i++) {
    const row = [];
    const rr = i / R;
    for (let j = 0; j < S; j++) {
      const a = (j / S) * Math.PI * 2;
      const edge = 1 + 0.12 * Math.sin(a * 5 + ph) + 0.06 * Math.sin(a * 11 + ph * 2);
      const r = rr * edge;
      const y = 0.42 + 0.1 * rr - 0.08 * rr * rr + 0.02 * Math.sin(a * 13 + rr * 9);
      row.push([Math.cos(a) * r, y, Math.sin(a) * r]);
    }
    rows.push(row);
  }
  const top = [], bot = [];
  for (let i = 0; i <= R; i++) {
    for (let j = 0; j < S; j++) {
      const p = rows[i][j];
      b.set('aSway', 0); b.set('aAO', 1);
      const k = 0.85 + 0.25 * (i / R);
      top.push(b.v(p, [0, 1, 0], [k, k, k]));
      b.set('aAO', 0.35);
      bot.push(b.v([p[0], p[1] - 0.05, p[2]], [0, -1, 0], [0.6, 0.6, 0.6]));
    }
  }
  for (let i = 0; i < R; i++) {
    for (let j = 0; j < S; j++) {
      const a = i * S + j, bj = i * S + ((j + 1) % S), c = (i + 1) * S + j, d = (i + 1) * S + ((j + 1) % S);
      b.quad(top[a], top[bj], top[d], top[c]);
      b.quad(bot[a], bot[c], bot[d], bot[bj]);
    }
  }
  return b.build();
}

// 海扇（柳珊瑚）：一个平面内的分形网格，随流摆动
function fanGeo(seed) {
  const b = new Builder(SPEC);
  const rnd = mulberry32(seed);
  function br(p, a, len, rad, depth, sway) {
    const pts = [p];
    let q = p, ang = a;
    for (let i = 0; i < 2; i++) {
      ang += (rnd() - 0.5) * 0.3;
      q = [q[0] + Math.sin(ang) * len / 2, q[1] + Math.cos(ang) * len / 2, (rnd() - 0.5) * 0.02];
      pts.push(q);
    }
    b.tube(pts, (t) => rad * (1 - 0.4 * t), 3, {
      color: () => [1, 1, 1],
      attr: (bb, t) => { const y = lerp(p[1], q[1], t); bb.set('aSway', clamp(y / 1.2, 0, 1)); bb.set('aAO', 0.6 + 0.4 * clamp(y, 0, 1)); },
    });
    if (depth > 0) {
      br(q, ang - 0.35 - rnd() * 0.3, len * 0.78, rad * 0.72, depth - 1);
      br(q, ang + 0.35 + rnd() * 0.3, len * 0.78, rad * 0.72, depth - 1);
      if (depth > 2 && rnd() < 0.5) br(q, ang + (rnd() - 0.5) * 0.3, len * 0.7, rad * 0.7, depth - 2);
    }
  }
  br([0, -0.02, 0], 0, 0.32, 0.025, 5);
  return b.build();
}

// 软珊瑚 / 海鞭：一丛细长的枝
function whipGeo(seed) {
  const b = new Builder(SPEC);
  const rnd = mulberry32(seed);
  const n = 5 + Math.floor(rnd() * 5);
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2, lean = 0.1 + rnd() * 0.35, h = 0.6 + rnd() * 0.7;
    const pts = [];
    for (let k = 0; k <= 5; k++) {
      const t = k / 5;
      pts.push([Math.cos(a) * lean * t * t * h + Math.cos(a) * 0.04, t * h, Math.sin(a) * lean * t * t * h + Math.sin(a) * 0.04]);
    }
    b.tube(pts, (t) => 0.022 * (1 - 0.6 * t), 4, {
      color: (t) => [0.85 + 0.2 * t, 0.85 + 0.2 * t, 0.85 + 0.2 * t],
      attr: (bb, t) => { bb.set('aSway', t * h); bb.set('aAO', 0.5 + 0.5 * t); },
      capEnd: true,
    });
  }
  return b.build();
}

// 管状海绵
function spongeGeo(seed) {
  const b = new Builder(SPEC);
  const rnd = mulberry32(seed);
  const n = 2 + Math.floor(rnd() * 4);
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2, d = i === 0 ? 0 : 0.15 + rnd() * 0.12;
    const h = 0.4 + rnd() * 0.6, r = 0.07 + rnd() * 0.05;
    const cx = Math.cos(a) * d, cz = Math.sin(a) * d;
    const pts = [];
    for (let k = 0; k <= 4; k++) { const t = k / 4; pts.push([cx + Math.cos(a) * t * 0.1, t * h, cz + Math.sin(a) * t * 0.1]); }
    b.tube(pts, (t) => r * (1 + 0.25 * t), 8, { color: () => [1, 1, 1], attr: (bb, t) => { bb.set('aSway', 0); bb.set('aAO', 0.5 + 0.5 * t); } });
    // 内壁
    b.tube(pts.slice().reverse(), (t) => r * (1 + 0.25 * (1 - t)) * 0.8, 8, { color: () => [0.35, 0.35, 0.35], attr: (bb) => { bb.set('aSway', 0); bb.set('aAO', 0.3); } });
  }
  return b.build();
}

// 桶状海绵
function barrelGeo(seed) {
  const b = new Builder(SPEC);
  const pts = [];
  for (let k = 0; k <= 8; k++) pts.push([0, (k / 8) * 1.0, 0]);
  const prof = (t) => 0.38 + 0.18 * Math.sin(t * Math.PI * 0.85) + 0.02 * Math.sin(t * 40);
  b.tube(pts, (t) => prof(t), 14, {
    color: (t, ang) => { const k = 0.8 + 0.25 * Math.abs(Math.sin(ang * 7)); return [k, k * 0.95, k * 0.9]; },
    attr: (bb, t) => { bb.set('aSway', 0); bb.set('aAO', 0.45 + 0.55 * t); },
  });
  b.tube(pts.slice().reverse(), (t) => prof(1 - t) * 0.8, 14, { color: () => [0.3, 0.25, 0.22], attr: (bb) => { bb.set('aSway', 0); bb.set('aAO', 0.25); } });
  return b.build();
}

// 巨藻：y 方向为单位高度（实例缩放 y = 株高），xz 为米
function kelpGeo(seed) {
  const b = new Builder(SPEC);
  const rnd = mulberry32(seed);
  const segs = 26;
  const stipe = [];
  const ph = rnd() * 6;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    stipe.push([Math.sin(t * 3 + ph) * 0.15 * t, t, Math.cos(t * 2.3 + ph) * 0.12 * t]);
  }
  b.tube(stipe, (t) => 0.035 * (1 - 0.4 * t), 4, {
    color: () => [0.42, 0.36, 0.16],
    attr: (bb, t) => { bb.set('aSway', t); bb.set('aAO', 0.6 + 0.4 * t); },
  });
  // 叶片：沿茎交替生出，向上倾斜
  const blades = 34;
  for (let k = 0; k < blades; k++) {
    const t = 0.06 + (k / blades) * 0.94;
    const i = Math.round(t * segs);
    const s = stipe[Math.min(i, segs)];
    const a = k * 2.4 + rnd() * 0.6;
    const len = 0.7 + rnd() * 0.6 + (t > 0.85 ? 0.8 : 0);
    const w = 0.09 + rnd() * 0.05;
    const dir = [Math.cos(a), 0, Math.sin(a)];
    const perp = [-dir[2], 0, dir[0]];
    const left = [], right = [];
    const n = 5;
    for (let j = 0; j <= n; j++) {
      const u = j / n;
      const droop = u * u * 0.012;
      const cx = s[0] + dir[0] * len * u, cz = s[2] + dir[2] * len * u;
      const cy = s[1] + u * 0.018 - droop + (len * u * 0.012);
      const ww = w * Math.sin(Math.PI * Math.min(1, u * 1.1 + 0.08)) * (1 + 0.3 * Math.sin(u * 12));
      left.push([cx + perp[0] * ww, cy, cz + perp[2] * ww]);
      right.push([cx - perp[0] * ww, cy, cz - perp[2] * ww]);
    }
    const nrm = [0, 1, 0];
    b.strip(left, right, () => nrm, (u) => [0.62 + 0.15 * u, 0.5 + 0.1 * u, 0.2], (bb, u) => { bb.set('aSway', clamp(t + u * 0.04, 0, 1)); bb.set('aAO', 0.85); });
  }
  return b.build();
}

// 海草丛
function grassGeo(seed) {
  const b = new Builder(SPEC);
  const rnd = mulberry32(seed);
  const n = 26;
  for (let i = 0; i < n; i++) {
    const r = Math.sqrt(rnd()) * 0.7, a = rnd() * Math.PI * 2;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const h = 0.25 + rnd() * 0.45;
    const facing = rnd() * Math.PI;
    const dx = Math.cos(facing), dz = Math.sin(facing);
    const lean = (rnd() - 0.5) * 0.25;
    const w = 0.012 + rnd() * 0.008;
    const left = [], right = [];
    for (let k = 0; k <= 4; k++) {
      const t = k / 4;
      const px = x + dz * lean * t * t * h, pz = z - dx * lean * t * t * h;
      left.push([px + dx * w * (1 - t * 0.6), t * h, pz + dz * w * (1 - t * 0.6)]);
      right.push([px - dx * w * (1 - t * 0.6), t * h, pz - dz * w * (1 - t * 0.6)]);
    }
    const g = 0.8 + rnd() * 0.3;
    b.strip(left, right, () => [dz, 0.3, -dx], (t) => [0.35 * g + t * 0.12, 0.52 * g + t * 0.1, 0.18 * g], (bb, t) => { bb.set('aSway', t * h * 1.4); bb.set('aAO', 0.5 + 0.5 * t); });
  }
  return b.build();
}

// 矿物烟囱（黑烟囱）
function chimneyGeo(seed) {
  const b = new Builder(SPEC);
  const rnd = mulberry32(seed);
  const o = rnd() * 50;
  function spire(x, z, h, r0) {
    const pts = [];
    const n = 10;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      pts.push([x + Math.sin(t * 4 + o) * 0.08 * h * t, t * h, z + Math.cos(t * 3 + o) * 0.06 * h * t]);
    }
    b.tube(pts, (t, i) => {
      const lump = 1 + 0.35 * noise3(i * 0.9 + o, x * 3, z * 3) + 0.2 * Math.sin(t * 30 + o);
      return r0 * (1 - 0.6 * t) * lump;
    }, 9, {
      color: (t, ang) => {
        const rust = smoothstep(0.2, 0.8, noise3(t * 6 + o, ang, x));
        const white = smoothstep(0.15, 0.0, t) * 0.8;
        const c = [lerp(0.16, 0.5, rust), lerp(0.15, 0.3, rust), lerp(0.14, 0.14, rust)];
        return [lerp(c[0], 0.85, white), lerp(c[1], 0.83, white), lerp(c[2], 0.72, white)];
      },
      attr: (bb, t) => { bb.set('aSway', 0); bb.set('aAO', 0.45 + 0.55 * t); },
      capEnd: true,
    });
  }
  spire(0, 0, 1, 0.22);
  const extra = 1 + Math.floor(rnd() * 3);
  for (let i = 0; i < extra; i++) {
    const a = rnd() * Math.PI * 2, d = 0.15 + rnd() * 0.2;
    spire(Math.cos(a) * d, Math.sin(a) * d, 0.4 + rnd() * 0.45, 0.12);
  }
  return b.build();
}

// 管虫丛：白色管子 + 红色鳃冠
function tubewormGeo(seed) {
  const b = new Builder(SPEC);
  const rnd = mulberry32(seed);
  const n = 26;
  for (let i = 0; i < n; i++) {
    const r = Math.sqrt(rnd()) * 0.45, a = rnd() * Math.PI * 2;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const h = 0.4 + rnd() * 0.9;
    const lean = [x * 0.4 + (rnd() - 0.5) * 0.2, z * 0.4 + (rnd() - 0.5) * 0.2];
    const pts = [];
    for (let k = 0; k <= 4; k++) { const t = k / 4; pts.push([x + lean[0] * t * h, t * h, z + lean[1] * t * h]); }
    b.tube(pts, () => 0.022, 5, { color: (t) => [0.86, 0.84, 0.78].map((c) => c * (0.8 + 0.2 * t)), attr: (bb, t) => { bb.set('aSway', t * 0.3); bb.set('aAO', 0.4 + 0.6 * t); } });
    const top = pts[4];
    const plume = [top, [top[0] + lean[0] * 0.08, top[1] + 0.07, top[2] + lean[1] * 0.08], [top[0] + lean[0] * 0.1, top[1] + 0.12, top[2] + lean[1] * 0.1]];
    b.tube(plume, (t) => 0.045 * Math.sin(Math.PI * (0.25 + t * 0.7)), 6, { color: () => [0.85, 0.08, 0.06], attr: (bb, t) => { bb.set('aSway', 0.35 + t * 0.1); bb.set('aAO', 1); }, capEnd: true });
  }
  return b.build();
}

// ——————————————————— 材质 ———————————————————
function sceneryMaterial(opts = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { ...U, uBump: { value: opts.bump || 0 }, uSwayAmp: { value: opts.sway || 0 }, uSwayFreq: { value: opts.freq || 0.5 }, uTrans: { value: opts.trans || 0 }, uKelp: { value: opts.kelp ? 1 : 0 } },
    vertexColors: true,
    side: opts.double ? THREE.DoubleSide : THREE.FrontSide,
    vertexShader: /* glsl */`
      ${COMMON_GLSL}
      attribute float aSway;
      attribute float aAO;
      uniform float uSwayAmp;
      uniform float uSwayFreq;
      uniform float uKelp;
      varying vec3 vWorld;
      varying vec3 vNrm;
      varying vec3 vCol;
      varying float vAO;
      void main(){
        mat4 im = instanceMatrix;
        vec3 origin = (modelMatrix * im * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        vec4 wp = modelMatrix * im * vec4(position, 1.0);
        float ph = hash12(origin.xz) * 6.2831;
        float depthF = exp(-max(-origin.y, 0.0) / 30.0);
        if (uSwayAmp > 0.0){
          float s = aSway;
          vec2 cur = uCurrent * 2.0;
          if (uKelp > 0.5){
            float H = length(im[1].xyz);
            float surge = sin(uTime * 0.75 + ph + origin.x * 0.02) * (0.5 + 0.8 * depthF);
            vec2 dir = normalize(vec2(0.8, 0.6));
            vec2 off = (cur * 1.5 + dir * surge * 1.1 + vec2(sin(uTime * 0.5 + ph), cos(uTime * 0.43 + ph)) * 0.35) * pow(s, 1.6) * uSwayAmp * (H / 15.0);
            wp.xz += off;
            wp.y -= dot(off, off) * 0.02 * s;
          } else {
            float w = sin(uTime * uSwayFreq * 6.2831 + ph + wp.y * 1.5) * 0.6 + sin(uTime * 1.9 + ph * 2.0) * 0.25;
            vec2 off = (cur * 0.6 + vec2(0.7, 0.5) * w * (0.4 + depthF)) * s * s * uSwayAmp;
            wp.xz += off;
          }
        }
        vWorld = wp.xyz;
        vNrm = normalize(mat3(modelMatrix) * mat3(im) * normal);
        vec3 c = color;
        #ifdef USE_INSTANCING_COLOR
          c *= instanceColor;
        #endif
        vCol = c;
        vAO = aAO;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */`
      ${COMMON_GLSL}
      uniform float uTrans;
      uniform float uBump;
      varying vec3 vWorld;
      varying vec3 vNrm;
      varying vec3 vCol;
      varying float vAO;
      void main(){
        vec3 n = normalize(vNrm);
        vec3 v = normalize(uCamPos - vWorld);
        if (!gl_FrontFacing) n = -n;
        float fine = vnoise(vWorld.xz * 6.0 + vWorld.y * 3.0);
        vec3 alb = vCol * (0.88 + 0.24 * fine);
        if (uBump > 0.0){
          vec3 q = vWorld * 1.7;
          float b0 = vnoise3(q) * 0.65 + vnoise3(q * 3.1) * 0.35;
          float bx = vnoise3(q + vec3(0.08, 0.0, 0.0)) * 0.65 + vnoise3(q * 3.1 + vec3(0.25, 0.0, 0.0)) * 0.35 - b0;
          float by = vnoise3(q + vec3(0.0, 0.08, 0.0)) * 0.65 + vnoise3(q * 3.1 + vec3(0.0, 0.25, 0.0)) * 0.35 - b0;
          float bz = vnoise3(q + vec3(0.0, 0.0, 0.08)) * 0.65 + vnoise3(q * 3.1 + vec3(0.0, 0.0, 0.25)) * 0.35 - b0;
          float fade = 1.0 - smoothstep(10.0, 45.0, length(uCamPos - vWorld));
          n = normalize(n - vec3(bx, by, bz) * 6.0 * uBump * fade);
          float pits = smoothstep(0.35, 0.15, b0);
          alb *= mix(1.0, 0.55 + 0.6 * b0, uBump) * (1.0 - pits * 0.35 * uBump);
          // 顶面的藻皮
          alb = mix(alb, alb * vec3(0.72, 0.85, 0.55), smoothstep(0.55, 0.9, n.y) * smoothstep(0.4, 0.7, vnoise(vWorld.xz * 0.7)) * uBump * 0.8);
        }
        vec3 col = shadeUnder(alb, vWorld, n, vAO, 0.6 + 0.4 * max(n.y, 0.0));
        // 薄片透光（海藻叶、海扇）
        if (uTrans > 0.0){
          float d = max(-vWorld.y, 0.0);
          float back = pow(max(dot(-v, uRefrSun), 0.0), 2.0);
          col += alb * uSunCol * uRefrSun.y * exp(-uKd * d) * uTrans * (0.25 + back * 0.9);
        }
        gl_FragColor = vec4(applyWater(col, vWorld), 1.0);
      }`,
  });
}

// ——————————————————— 类型表 ———————————————————
// 每种类型若干变体；maxDist 用于距离剔除；radius 为包围球（米，按实例缩放）
function buildTypes(quality) {
  const T = [];
  const add = (name, geos, mat, maxDist, cap) => { for (let i = 0; i < geos.length; i++) T.push({ name, variant: i, geo: geos[i], mat, maxDist, cap }); };
  const rockMat = sceneryMaterial({ bump: 1 });
  const coralMat = sceneryMaterial();
  const swayMat = sceneryMaterial({ sway: 0.12, freq: 0.35, double: true, trans: 0.25 });
  const whipMat = sceneryMaterial({ sway: 0.18, freq: 0.3 });
  const kelpMat = sceneryMaterial({ sway: 1, kelp: true, double: true, trans: 0.6 });
  const grassMat = sceneryMaterial({ sway: 0.25, freq: 0.45, double: true, trans: 0.4 });
  const wormMat = sceneryMaterial({ sway: 0.05, freq: 0.2 });
  const S = (a) => a.map((s) => s * 7919 + 13);
  add('shelf', S([1, 2, 3, 4]).map((s) => rockGeo(s, 'shelf')), rockMat, 170, 700);
  add('kelprock', S([5, 6]).map((s) => rockGeo(s, 'kelp')), rockMat, 150, 300);
  add('boulder', S([7, 8, 9]).map((s) => rockGeo(s, 'boulder')), rockMat, 150, 400);
  add('pinnacle', S([10, 11]).map((s) => rockGeo(s, 'pinnacle')), rockMat, 320, 60);
  add('basalt', S([12, 13, 14]).map((s) => rockGeo(s, 'basalt')), rockMat, 120, 300);
  add('branch', S([21, 22, 23, 20]).map((s) => branchingGeo(s, false)), coralMat, 85, 900);
  add('cold', S([24, 25]).map((s) => branchingGeo(s, true)), coralMat, 70, 300);
  add('brain', S([26, 27]).map((s) => brainGeo(s)), coralMat, 90, 900);
  add('table', S([28, 29]).map((s) => tableGeo(s)), coralMat, 100, 300);
  add('fan', S([30, 31, 32]).map((s) => fanGeo(s)), swayMat, 80, 400);
  add('whip', S([33, 34]).map((s) => whipGeo(s)), whipMat, 70, 500);
  add('sponge', S([35, 36]).map((s) => spongeGeo(s)), coralMat, 80, 300);
  add('barrel', S([37]).map((s) => barrelGeo(s)), coralMat, 100, 120);
  add('kelp', S([41, 42, 43]).map((s) => kelpGeo(s)), kelpMat, 150, 700);
  add('grass', S([44, 45]).map((s) => grassGeo(s)), grassMat, 55, 1600);
  add('chimney', S([51, 52, 53]).map((s) => chimneyGeo(s)), rockMat, 110, 120);
  add('worms', S([54, 55]).map((s) => tubewormGeo(s)), wormMat, 60, 300);
  return T;
}

// 珊瑚与海绵的配色（水下红色最先消失，潜水灯下才会“复活”）
const CORAL_COLORS = {
  branch: [[0.72, 0.52, 0.78], [0.9, 0.72, 0.42], [0.95, 0.55, 0.6], [0.55, 0.62, 0.85], [0.88, 0.8, 0.55]],
  brain: [[0.62, 0.72, 0.42], [0.85, 0.66, 0.38], [0.78, 0.5, 0.4], [0.55, 0.68, 0.6]],
  table: [[0.75, 0.72, 0.5], [0.6, 0.7, 0.5], [0.82, 0.6, 0.55]],
  fan: [[0.75, 0.3, 0.6], [0.9, 0.45, 0.25], [0.95, 0.8, 0.35], [0.55, 0.3, 0.7]],
  whip: [[0.9, 0.6, 0.3], [0.8, 0.8, 0.55], [0.7, 0.4, 0.65]],
  sponge: [[0.95, 0.72, 0.2], [0.85, 0.35, 0.3], [0.6, 0.4, 0.75]],
  barrel: [[0.66, 0.4, 0.3], [0.72, 0.5, 0.36]],
  cold: [[0.95, 0.92, 0.88], [0.98, 0.7, 0.55], [0.95, 0.85, 0.7]],
};

export const TILE = 32;

export class Scenery {
  constructor(world, quality = 'medium') {
    this.world = world;
    this.quality = quality;
    this.group = new THREE.Group();
    this.types = buildTypes(quality);
    this.byName = {};
    this.types.forEach((t, i) => {
      (this.byName[t.name] = this.byName[t.name] || []).push(i);
      const mesh = new THREE.InstancedMesh(t.geo, t.mat, t.cap);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(t.cap * 3), 3);
      mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
      mesh.count = 0;
      mesh.frustumCulled = false;
      t.mesh = mesh;
      this.group.add(mesh);
    });
    this.tiles = new Map();
    this.active = [];
    this.radius = quality === 'low' ? 96 : quality === 'high' ? 150 : 128;
    this.density = quality === 'low' ? 0.6 : quality === 'high' ? 1.15 : 1;
    this.lastKey = '';
    this.frustum = new THREE.Frustum();
    this.pm = new THREE.Matrix4();
    this.vents = [];     // 附近烟囱顶部（给羽流粒子与声音）
    this.obstacles = []; // 附近大型岩石（给动物避让与镜头碰撞）
  }

  setWorld(world) {
    this.world = world;
    this.tiles.clear();
    this.lastKey = '';
  }

  _tile(tx, tz) {
    const key = tx + ',' + tz;
    let t = this.tiles.get(key);
    if (t) { t.used = performance.now(); return t; }
    t = this._generate(tx, tz);
    t.used = performance.now();
    this.tiles.set(key, t);
    if (this.tiles.size > 400) {
      const arr = [...this.tiles.entries()].sort((a, b) => a[1].used - b[1].used);
      for (let i = 0; i < 100; i++) this.tiles.delete(arr[i][0]);
    }
    return t;
  }

  _generate(tx, tz) {
    const w = this.world;
    const r = w.recipe;
    const seed = (r.seed * 2654435761) >>> 0;
    const rnd = mulberry32(Math.floor(hash2i(tx, tz, seed) * 4294967296));
    const items = []; // {type, m:Float32Array(16), c:[r,g,b], x,y,z, rad}
    const obst = [];
    const vents = [];
    const cover = r.cover * this.density;
    const x0 = tx * TILE, z0 = tz * TILE;
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const qy = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const tmpN = new THREE.Vector3();
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();
    const Y = new THREE.Vector3(0, 1, 0);
    const pick = (name) => { const ids = this.byName[name]; return ids[Math.floor(rnd() * ids.length)]; };
    const place = (name, x, z, s, opts = {}) => {
      const f = opts.y !== undefined ? opts.y : w.floorAt(x, z);
      const n = w.normalAt(x, z, 1.5);
      const upBlend = opts.upright !== undefined ? opts.upright : 0.6;
      tmpN.set(n[0] * (1 - upBlend), lerp(n[1], 1, upBlend), n[2] * (1 - upBlend)).normalize();
      q.setFromUnitVectors(up, tmpN);
      qy.setFromAxisAngle(Y, rnd() * Math.PI * 2);
      q.multiply(qy);
      const sy = opts.sy || s;
      const sxz = opts.sxz || s;
      pos.set(x, f - (opts.sink !== undefined ? opts.sink : 0.08) * sy, z);
      scl.set(sxz, sy, sxz * (opts.sz || 1));
      m4.compose(pos, q, scl);
      const type = opts.type !== undefined ? opts.type : pick(name);
      const col = opts.color || [1, 1, 1];
      items.push({ type, m: new Float32Array(m4.elements), c: col, x, y: f + sy * 0.4, z, rad: Math.max(sxz, sy) * (opts.radMul || 1.2) });
      return { f, n };
    };
    const choose = (arr) => arr[Math.floor(rnd() * arr.length)];
    const tint = (c, v = 0.12) => c.map((k) => clamp(k * (1 - v + rnd() * v * 2), 0, 1.2));

    // 采样：抖动网格
    const G = 8;
    const cs = TILE / G;
    for (let j = 0; j < G; j++) {
      for (let i = 0; i < G; i++) {
        const x = x0 + (i + rnd()) * cs, z = z0 + (j + rnd()) * cs;
        const xx = x, zz = z;
        if (x * x + z * z > 2350 * 2350) continue;
        const h = w.habitat(x, z);
        const f = w.floorAt(x, z);
        const depth = -f;
        const roll = rnd();
        // —— 珊瑚礁 ——
        if (h.reef > 0.08 && depth < 60) {
          const rf = h.reef;
          if (roll < 0.13 * rf * Math.min(1.2, cover + 0.2)) {
            // 石灰岩台地 + 顶上长珊瑚
            const s = 1.6 + rnd() * rnd() * 5.5;
            const sy = s * (0.8 + rnd() * 0.7);
            const { f: rf0 } = place('shelf', x, z, s, { sy, upright: 0.3, sink: -0.08, color: tint([1, 1, 1], 0.08), radMul: 0.9 });
            obst.push({ x, y: rf0 + sy * 0.15, z, r: s * 0.95 });
            const top = rf0 + 0.28 * sy;
            const nc = Math.floor(s * 2.4 * cover * rf);
            for (let k = 0; k < nc; k++) {
              const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * s * 0.55;
              const cx = x + Math.cos(a) * d, cz = z + Math.sin(a) * d;
              const kind = rnd();
              const yTop = Math.max(w.floorAt(cx, cz), top - (d / s) * (d / s) * sy * 0.6);
              if (kind < 0.4) place('branch', cx, cz, 0.9 + rnd() * 1.0, { y: yTop, color: tint(choose(CORAL_COLORS.branch)), upright: 0.9 });
              else if (kind < 0.62) place('brain', cx, cz, 0.5 + rnd() * 0.7, { y: yTop, color: tint(choose(CORAL_COLORS.brain)), upright: 0.9 });
              else if (kind < 0.76) place('table', cx, cz, 0.8 + rnd() * 1.0, { y: yTop, color: tint(choose(CORAL_COLORS.table)), upright: 0.95 });
              else if (kind < 0.9) place('fan', cx, cz, 1.3 + rnd() * 1.2, { y: yTop, color: tint(choose(CORAL_COLORS.fan)), upright: 1 });
              else place('whip', cx, cz, 1.0 + rnd() * 0.8, { y: yTop, color: tint(choose(CORAL_COLORS.whip)), upright: 1 });
            }
          } else if (roll < 0.13 * rf + 0.55 * rf * cover) {
            const nclu = 1 + Math.floor(rnd() * 3 * rf);
            for (let cc = 0; cc < nclu; cc++) {
            const x = xx + (rnd() - 0.5) * cs * 1.2 * (cc > 0 ? 1 : 0), z = zz + (rnd() - 0.5) * cs * 1.2 * (cc > 0 ? 1 : 0);
            const kind = rnd();
            if (kind < 0.36) place('branch', x, z, 0.9 + rnd() * 1.2, { color: tint(choose(CORAL_COLORS.branch)), upright: 0.8 });
            else if (kind < 0.58) place('brain', x, z, 0.5 + rnd() * 0.9, { color: tint(choose(CORAL_COLORS.brain)), upright: 0.6 });
            else if (kind < 0.68) place('table', x, z, 0.8 + rnd() * 1.0, { color: tint(choose(CORAL_COLORS.table)), upright: 0.95 });
            else if (kind < 0.8) place('fan', x, z, 1.3 + rnd() * 1.3, { color: tint(choose(CORAL_COLORS.fan)), upright: 1 });
            else if (kind < 0.9) place('whip', x, z, 1.0 + rnd() * 0.9, { color: tint(choose(CORAL_COLORS.whip)), upright: 1 });
            else if (kind < 0.97) place('sponge', x, z, 1.0 + rnd() * 1.0, { color: tint(choose(CORAL_COLORS.sponge)), upright: 0.9 });
            else place('barrel', x, z, 0.9 + rnd() * 0.8, { color: tint(choose(CORAL_COLORS.barrel)), upright: 0.9 });
            }
          }
        }
        // —— 海草 ——
        if (h.grass > 0.1 && depth < 45 && rnd() < h.grass * 0.9 * cover) {
          for (let k = 0; k < 2; k++) place('grass', x + (rnd() - 0.5) * cs, z + (rnd() - 0.5) * cs, 0.8 + rnd() * 0.7, { color: tint([1, 1, 1]), upright: 0.3, sink: 0.02 });
        }
        // —— 海藻林 ——
        if (h.kelp > 0.1 && depth < 50) {
          if (rnd() < h.kelp * 0.28 * cover) {
            const H = Math.min(depth - 1.2, (depth * 0.72 + 3) * r.kelpHeight * (0.75 + rnd() * 0.35));
            if (H > 3) place('kelp', x, z, 1, { sy: H, sxz: 0.9 + rnd() * 0.4, upright: 1, sink: 0.05, color: tint([1, 1, 1], 0.1), radMul: 0.6 });
          }
          if (rnd() < 0.02 * cover) {
            const s = 1 + rnd() * 2.5;
            const { f: ff } = place('kelprock', x, z, s, { sy: s * 1.3, upright: 0.3, sink: 0.02, color: tint([1, 1, 1], 0.1) });
            obst.push({ x, y: ff, z, r: s * 0.9 });
          }
          if (rnd() < 0.03 * cover) place('sponge', x, z, 0.5 + rnd() * 0.5, { color: tint(choose(CORAL_COLORS.sponge)) });
        }
        // —— 陆架上零星的石块 ——
        if (depth < 60 && h.reef < 0.1 && h.kelp < 0.1 && rnd() < 0.012) {
          const s = 0.8 + rnd() * 1.8;
          place('boulder', x, z, s, { color: tint([0.95, 0.93, 0.85], 0.1), upright: 0.2, sink: -0.2 });
          obst.push({ x, y: f, z, r: s * 0.8 });
        }
        // —— 陆坡：巨石、冷水珊瑚 ——
        if (depth >= 60 && depth < 1250) {
          const nrm = w.normalAt(x, z, 2);
          const steep = 1 - nrm[1];
          if (rnd() < 0.02 + steep * 0.05) {
            const s = 1.2 + rnd() * 3.5;
            place('boulder', x, z, s, { color: tint([0.55, 0.52, 0.48], 0.12), upright: 0.2, sink: -0.1 });
            obst.push({ x, y: f, z, r: s * 0.85 });
          }
          if (depth > 120 && depth < 1000 && rnd() < (0.05 + steep * 0.12) * cover) {
            place('cold', x, z, 0.5 + rnd() * 0.7, { color: tint(choose(CORAL_COLORS.cold), 0.05), upright: 0.5 });
          }
          if (depth > 300 && rnd() < 0.02 * cover) place('whip', x, z, 0.8 + rnd() * 0.6, { color: tint([0.95, 0.5, 0.35]), upright: 0.9 });
        }
        // —— 深渊：玄武岩、烟囱、管虫 ——
        if (depth >= 1150) {
          if (rnd() < 0.018 + h.vent * 0.03) {
            const s = 1 + rnd() * 3;
            place('basalt', x, z, s, { color: tint([1, 1, 1], 0.1), upright: 0.2, sink: -0.1 });
            obst.push({ x, y: f, z, r: s * 0.8 });
          }
          if (h.vent > 0.3 && rnd() < h.vent * 0.035) {
            const Hc = 3 + rnd() * rnd() * 11;
            place('chimney', x, z, 1, { sy: Hc, sxz: 1.4 + Hc * 0.18, upright: 0.9, sink: 0.03, color: tint([1, 1, 1], 0.1) });
            vents.push({ x, y: f + Hc * 0.95, z, h: Hc });
            obst.push({ x, y: f + Hc * 0.4, z, r: 1.2 + Hc * 0.15 });
            const nw = 2 + Math.floor(rnd() * 4 * cover);
            for (let k = 0; k < nw; k++) {
              const a = rnd() * Math.PI * 2, d = 1.5 + rnd() * 3.5;
              place('worms', x + Math.cos(a) * d, z + Math.sin(a) * d, 0.8 + rnd() * 0.8, { color: tint([1, 1, 1], 0.08), upright: 0.8, sink: 0.05 });
            }
          }
        }
      }
    }
    // —— 深入蔚蓝：陆坡上的石柱 ——
    const bx = -330, bz = 30;
    const dcen = Math.hypot(x0 + TILE / 2 - bx, z0 + TILE / 2 - bz);
    if (dcen < 420 && rnd() < 0.45) {
      const x = x0 + rnd() * TILE, z = z0 + rnd() * TILE;
      const f = w.floorAt(x, z);
      if (-f > 60) {
        const s = 4 + rnd() * 6;
        place('pinnacle', x, z, s, { sy: s * (0.8 + rnd() * 0.6), upright: 0.9, sink: -2.6, color: tint([0.6, 0.58, 0.52], 0.1), radMul: 1.2 });
        obst.push({ x, y: f + s * 2, z, r: s * 1.3 });
      }
    }
    return { items, obst, vents };
  }

  update(camera, camPos) {
    const tx = Math.floor(camPos.x / TILE), tz = Math.floor(camPos.z / TILE);
    const R = Math.ceil(this.radius / TILE);
    const key = tx + ',' + tz;
    if (key !== this.lastKey) {
      this.lastKey = key;
      this.active = [];
      for (let j = -R; j <= R; j++) {
        for (let i = -R; i <= R; i++) {
          const cx = (tx + i + 0.5) * TILE - camPos.x, cz = (tz + j + 0.5) * TILE - camPos.z;
          if (cx * cx + cz * cz > (this.radius + TILE) ** 2) continue;
          this.active.push(this._tile(tx + i, tz + j));
        }
      }
      this.obstacles = [];
      this.vents = [];
      for (const t of this.active) {
        for (const o of t.obst) this.obstacles.push(o);
        for (const v of t.vents) this.vents.push(v);
      }
    }
    // 视锥 + 距离剔除
    this.pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.pm);
    const planes = this.frustum.planes;
    for (const t of this.types) t.mesh.count = 0;
    const depthCam = -camPos.y;
    // 深处能见度有限，远距离剔除更激进
    const visScale = depthCam > 250 ? 0.45 : depthCam > 120 ? 0.7 : 1;
    for (const tile of this.active) {
      for (const it of tile.items) {
        const t = this.types[it.type];
        const dx = it.x - camPos.x, dy = it.y - camPos.y, dz = it.z - camPos.z;
        const md = t.maxDist * visScale + it.rad;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 > md * md) continue;
        let inside = true;
        for (let p = 0; p < 6; p++) {
          const pl = planes[p];
          if (pl.normal.x * it.x + pl.normal.y * it.y + pl.normal.z * it.z + pl.constant < -it.rad * 1.3) { inside = false; break; }
        }
        if (!inside) continue;
        const mesh = t.mesh;
        if (mesh.count >= t.cap) continue;
        const k = mesh.count++;
        mesh.instanceMatrix.array.set(it.m, k * 16);
        mesh.instanceColor.array[k * 3] = it.c[0];
        mesh.instanceColor.array[k * 3 + 1] = it.c[1];
        mesh.instanceColor.array[k * 3 + 2] = it.c[2];
      }
    }
    for (const t of this.types) {
      if (t.mesh.count > 0) {
        t.mesh.instanceMatrix.needsUpdate = true;
        t.mesh.instanceColor.needsUpdate = true;
        t.mesh.visible = true;
      } else t.mesh.visible = false;
    }
  }

  // 最近的障碍（给镜头碰撞）
  pushOut(p, radius) {
    for (const o of this.obstacles) {
      const dx = p.x - o.x, dy = p.y - o.y, dz = p.z - o.z;
      const d = Math.hypot(dx, dy, dz);
      const min = o.r * 0.8 + radius;
      if (d < min && d > 1e-4) {
        const k = (min - d) / d;
        p.x += dx * k; p.y += dy * k; p.z += dz * k;
      }
    }
  }
}
