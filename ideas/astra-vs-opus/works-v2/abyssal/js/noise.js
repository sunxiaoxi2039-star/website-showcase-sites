// 可复现的随机数与噪声。世界里的一切（地形、群落、动物形态）都从这里派生。

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 文本种子 → 稳定的 32 位整数
export function hashString(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function parseSeed(v) {
  if (v == null || v === '') return 713;
  const s = String(v).trim();
  if (/^\d+$/.test(s)) return (parseInt(s, 10) >>> 0) % 4294967296;
  return hashString(s) % 1000000;
}

// 整数坐标哈希 → [0,1)
export function hash2i(ix, iz, seed) {
  let h = Math.imul(ix | 0, 374761393) ^ Math.imul(iz | 0, 668265263) ^ Math.imul(seed | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
export function hash3i(a, b, c, seed) {
  return hash2i(a * 7919 + c * 104729, b, seed);
}

export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export function smoothstep(e0, e1, x) {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}
export const fract = (x) => x - Math.floor(x);

// 平滑值噪声（种子化的格点表）
export class Noise2 {
  constructor(seed) {
    this.seed = seed >>> 0;
    const rnd = mulberry32(this.seed ^ 0x9e3779b9);
    this.size = 256;
    this.tab = new Float32Array(256 * 256);
    for (let i = 0; i < this.tab.length; i++) this.tab[i] = rnd() * 2 - 1;
    // 梯度噪声的梯度表
    this.gx = new Float32Array(256 * 256);
    this.gz = new Float32Array(256 * 256);
    for (let i = 0; i < this.gx.length; i++) {
      const a = rnd() * Math.PI * 2;
      this.gx[i] = Math.cos(a);
      this.gz[i] = Math.sin(a);
    }
  }
  // 值噪声 [-1,1]
  value(x, z) {
    const ix = Math.floor(x), iz = Math.floor(z);
    const fx = x - ix, fz = z - iz;
    const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
    const x0 = ix & 255, z0 = iz & 255, x1 = (ix + 1) & 255, z1 = (iz + 1) & 255;
    const t = this.tab;
    const a = t[z0 * 256 + x0], b = t[z0 * 256 + x1], c = t[z1 * 256 + x0], d = t[z1 * 256 + x1];
    return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
  }
  // 梯度噪声 ≈[-0.7,0.7]
  grad(x, z) {
    const ix = Math.floor(x), iz = Math.floor(z);
    const fx = x - ix, fz = z - iz;
    const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10), uz = fz * fz * fz * (fz * (fz * 6 - 15) + 10);
    const x0 = ix & 255, z0 = iz & 255, x1 = (ix + 1) & 255, z1 = (iz + 1) & 255;
    const gx = this.gx, gz = this.gz;
    const i00 = z0 * 256 + x0, i10 = z0 * 256 + x1, i01 = z1 * 256 + x0, i11 = z1 * 256 + x1;
    const n00 = gx[i00] * fx + gz[i00] * fz;
    const n10 = gx[i10] * (fx - 1) + gz[i10] * fz;
    const n01 = gx[i01] * fx + gz[i01] * (fz - 1);
    const n11 = gx[i11] * (fx - 1) + gz[i11] * (fz - 1);
    const nx0 = n00 + (n10 - n00) * ux, nx1 = n01 + (n11 - n01) * ux;
    return (nx0 + (nx1 - nx0) * uz) * 1.4;
  }
  fbm(x, z, oct = 4, lac = 2.03, gain = 0.5) {
    let s = 0, a = 0.5, n = 0;
    for (let i = 0; i < oct; i++) {
      s += a * this.grad(x, z);
      n += a;
      // 旋转，避免轴向伪影
      const nx = x * 1.6 - z * 1.2, nz = x * 1.2 + z * 1.6;
      x = nx * (lac / 2) + 17.3;
      z = nz * (lac / 2) - 9.1;
      a *= gain;
    }
    return s / n;
  }
  ridged(x, z, oct = 4) {
    let s = 0, a = 0.5, n = 0, w = 1;
    for (let i = 0; i < oct; i++) {
      let r = 1 - Math.abs(this.grad(x, z));
      r *= r;
      s += a * r * w;
      w = clamp(r * 1.5, 0, 1);
      n += a;
      const nx = x * 1.6 - z * 1.2, nz = x * 1.2 + z * 1.6;
      x = nx + 31.7; z = nz - 11.3;
      a *= 0.5;
    }
    return s / n;
  }
}
