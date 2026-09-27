// 程序化几何工具：带自定义顶点属性的构建器、平行传输管道、焊接、三维值噪声。
import * as THREE from 'three';

export function hash3(x, y, z) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export function noise3(x, y, z, seed = 0) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  let fx = x - ix, fy = y - iy, fz = z - iz;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); fz = fz * fz * (3 - 2 * fz);
  const s = seed * 131;
  const h = (a, b, c) => hash3(ix + a + s, iy + b, iz + c);
  const l = (a, b, t) => a + (b - a) * t;
  return l(
    l(l(h(0, 0, 0), h(1, 0, 0), fx), l(h(0, 1, 0), h(1, 1, 0), fx), fy),
    l(l(h(0, 0, 1), h(1, 0, 1), fx), l(h(0, 1, 1), h(1, 1, 1), fx), fy),
    fz) * 2 - 1;
}
export function fbm3(x, y, z, oct = 3, seed = 0) {
  let s = 0, a = 0.5, n = 0;
  for (let i = 0; i < oct; i++) {
    s += a * noise3(x, y, z, seed + i);
    n += a; a *= 0.5; x *= 2.03; y *= 2.03; z *= 2.03;
  }
  return s / n;
}

// 构建器：spec = { name: itemSize }，每个顶点必须给出 position/normal/color，其余属性给默认值
export class Builder {
  constructor(spec = {}) {
    this.spec = spec;
    this.pos = []; this.nrm = []; this.col = []; this.idx = [];
    this.extra = {};
    for (const k in spec) this.extra[k] = [];
    this.count = 0;
    this.cur = {}; // 当前的额外属性值
  }
  set(k, v) { this.cur[k] = v; return this; }
  v(p, n, c) {
    this.pos.push(p[0], p[1], p[2]);
    this.nrm.push(n[0], n[1], n[2]);
    this.col.push(c[0], c[1], c[2]);
    for (const k in this.spec) {
      const sz = this.spec[k];
      const val = this.cur[k];
      if (sz === 1) this.extra[k].push(val === undefined ? 0 : val);
      else for (let i = 0; i < sz; i++) this.extra[k].push(val === undefined ? 0 : val[i]);
    }
    return this.count++;
  }
  tri(a, b, c) { this.idx.push(a, b, c); }
  quad(a, b, c, d) { this.idx.push(a, b, c, a, c, d); }

  // 沿路径的管道。radii[i]、colorFn(i,t,ang)、attrFn(t, ang) 可选
  tube(pts, radii, sides, opts = {}) {
    const n = pts.length;
    const frames = pathFrames(pts);
    const rings = [];
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const { N, B } = frames[i];
      const r = typeof radii === 'function' ? radii(t, i) : radii[i];
      const rw = Array.isArray(r) ? r : [r, r];
      const ring = [];
      for (let j = 0; j <= sides; j++) {
        const ang = (j / sides) * Math.PI * 2;
        const ca = Math.cos(ang), sa = Math.sin(ang);
        const ia = 1 / Math.max(rw[0], 1e-5), ib = 1 / Math.max(rw[1], 1e-5);
        const nx = N[0] * ca * ia + B[0] * sa * ib, ny = N[1] * ca * ia + B[1] * sa * ib, nz = N[2] * ca * ia + B[2] * sa * ib;
        const px = pts[i][0] + N[0] * ca * rw[0] + B[0] * Math.sin(ang) * rw[1];
        const py = pts[i][1] + N[1] * ca * rw[0] + B[1] * Math.sin(ang) * rw[1];
        const pz = pts[i][2] + N[2] * ca * rw[0] + B[2] * Math.sin(ang) * rw[1];
        if (opts.attr) opts.attr(this, t, ang, i);
        const c = opts.color ? opts.color(t, ang, i) : [1, 1, 1];
        const l = Math.hypot(nx, ny, nz) || 1;
        ring.push(this.v([px, py, pz], [nx / l, ny / l, nz / l], c));
      }
      rings.push(ring);
    }
    for (let i = 0; i < n - 1; i++) {
      for (let j = 0; j < sides; j++) {
        this.quad(rings[i][j], rings[i][j + 1], rings[i + 1][j + 1], rings[i + 1][j]);
      }
    }
    if (opts.capEnd) {
      const last = pts[n - 1], T = frames[n - 1].T;
      if (opts.attr) opts.attr(this, 1, 0, n - 1);
      const c = opts.color ? opts.color(1, 0, n - 1) : [1, 1, 1];
      const ci = this.v(last, T, c);
      for (let j = 0; j < sides; j++) this.tri(rings[n - 1][j], rings[n - 1][j + 1], ci);
    }
    if (opts.capStart) {
      const first = pts[0], T = frames[0].T;
      if (opts.attr) opts.attr(this, 0, 0, 0);
      const c = opts.color ? opts.color(0, 0, 0) : [1, 1, 1];
      const ci = this.v(first, [-T[0], -T[1], -T[2]], c);
      for (let j = 0; j < sides; j++) this.tri(rings[0][j + 1], rings[0][j], ci);
    }
    return rings;
  }

  // 双面薄片（鳍、叶片）：outline 为有序多边形（三角扇），normal 给定
  sheet(pts, normal, color, attrFn) {
    const c = pts.map((p, i) => { if (attrFn) attrFn(this, p, i); return this.v(p, normal, color(p, i)); });
    for (let i = 1; i < pts.length - 1; i++) this.tri(c[0], c[i], c[i + 1]);
  }

  // 条带（两列点），单层，材质需双面
  strip(left, right, normalFn, colorFn, attrFn) {
    const n = left.length;
    const a = [], b = [];
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const nr = normalFn(t, i);
      if (attrFn) attrFn(this, t, 0);
      a.push(this.v(left[i], nr, colorFn(t, 0)));
      if (attrFn) attrFn(this, t, 1);
      b.push(this.v(right[i], nr, colorFn(t, 1)));
    }
    for (let i = 0; i < n - 1; i++) this.quad(a[i], b[i], b[i + 1], a[i + 1]);
  }

  // 变形球：fn(dir) → [x,y,z]；返回平滑法线
  blob(detail, fn, colorFn, attrFn) {
    const g = weld(new THREE.IcosahedronGeometry(1, detail));
    const p = g.attributes.position;
    const base = this.count;
    const verts = [];
    for (let i = 0; i < p.count; i++) {
      const d = [p.getX(i), p.getY(i), p.getZ(i)];
      verts.push(fn(d));
    }
    // 计算平滑法线
    const idx = g.index.array;
    const nr = new Float32Array(p.count * 3);
    for (let i = 0; i < idx.length; i += 3) {
      const a = verts[idx[i]], b = verts[idx[i + 1]], c = verts[idx[i + 2]];
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
      const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      for (const k of [idx[i], idx[i + 1], idx[i + 2]]) { nr[k * 3] += nx; nr[k * 3 + 1] += ny; nr[k * 3 + 2] += nz; }
    }
    for (let i = 0; i < p.count; i++) {
      const l = Math.hypot(nr[i * 3], nr[i * 3 + 1], nr[i * 3 + 2]) || 1;
      const n = [nr[i * 3] / l, nr[i * 3 + 1] / l, nr[i * 3 + 2] / l];
      const d = [p.getX(i), p.getY(i), p.getZ(i)];
      if (attrFn) attrFn(this, verts[i], n, d);
      this.v(verts[i], n, colorFn(verts[i], n, d));
    }
    for (let i = 0; i < idx.length; i += 3) this.tri(base + idx[i], base + idx[i + 1], base + idx[i + 2]);
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    for (const k in this.spec) g.setAttribute(k, new THREE.Float32BufferAttribute(this.extra[k], this.spec[k]));
    g.setIndex(this.count > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingSphere();
    return g;
  }
}

// 平行传输标架
export function pathFrames(pts) {
  const n = pts.length;
  const T = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const l = Math.hypot(d[0], d[1], d[2]) || 1;
    T.push([d[0] / l, d[1] / l, d[2] / l]);
  }
  const frames = [];
  let up = Math.abs(T[0][1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  let N = cross(up, T[0]); N = norm(N);
  let B = cross(T[0], N);
  frames.push({ T: T[0], N, B });
  for (let i = 1; i < n; i++) {
    const t = T[i];
    // 把上一帧的 N 投影到当前切线的法平面
    let nN = sub(N, scale(t, dot(N, t)));
    nN = norm(nN);
    const nB = cross(t, nN);
    frames.push({ T: t, N: nN, B: nB });
    N = nN; B = nB;
  }
  return frames;
}
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
function norm(a) { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
export const V = { dot, cross, sub, scale, norm, add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]] };

// 焊接重复顶点（只保留 position）
export function weld(geo) {
  const p = geo.attributes.position;
  const map = new Map();
  const pos = [];
  const idx = [];
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const key = `${Math.round(x * 1e4)},${Math.round(y * 1e4)},${Math.round(z * 1e4)}`;
    let k = map.get(key);
    if (k === undefined) { k = pos.length / 3; pos.push(x, y, z); map.set(key, k); }
    idx.push(k);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

// 从旋转轴向上的方向构造朝向（地形法线与竖直方向混合）
export function alignUp(nx, ny, nz, yaw, out) {
  // up = (nx,ny,nz)；forward 由 yaw 决定
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(nx, ny, nz).normalize());
  const qy = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  return (out || new THREE.Quaternion()).multiplyQuaternions(q, qy);
}
