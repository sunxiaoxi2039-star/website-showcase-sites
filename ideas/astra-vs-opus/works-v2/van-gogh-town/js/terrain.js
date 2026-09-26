import * as THREE from 'three';
import { hex } from './builder.js';

const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export const WATER_Y = -1.0;
export const HILL = { x: -78, z: 80, h: 14, s: 24 };

// Paths through the wheat field (three of them, as in the painting)
export const PATHS = [
  { pts: [[-46, -8], [-54, -8.2], [-62, -8.6], [-74, -7.4], [-88, -8.6], [-100, -8]], w: 1.5 },
  { pts: [[-47, -7], [-54, -4.5], [-60, 0.5], [-65, 8], [-69, 18], [-72, 30], [-73, 42]], w: 1.35 },
  { pts: [[-47, -9], [-54, -12], [-60, -17], [-67, -25], [-76, -36], [-86, -50], [-95, -64]], w: 1.35 },
];

function distSeg(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(px - ax - dx * t, pz - az - dz * t);
}
export function pathDist(x, z) {
  let d = 1e9;
  for (const p of PATHS) for (let i = 0; i < p.pts.length - 1; i++) {
    const [ax, az] = p.pts[i], [bx, bz] = p.pts[i + 1];
    d = Math.min(d, distSeg(x, z, ax, az, bx, bz) - (p.w - 1.4));
  }
  return d;
}

export function townMask(x, z) {
  // 1 inside the flat town
  const a = sm(-44, -38, x) * sm(84, 78, x) * sm(-96, -88, z) * sm(58, 52, z);
  return a;
}

export function H(x, z) {
  let h = 0;
  const dx = x - HILL.x, dz = z - HILL.z;
  h += HILL.h * Math.exp(-(dx * dx + dz * dz) / (2 * HILL.s * HILL.s));
  // olive-grove hummocks south
  h += 2.2 * Math.exp(-((x + 20) ** 2 + (z - 95) ** 2) / 800);
  // gentle undulation of the fields
  h += 0.9 * Math.sin(x * 0.045 + 1.3) * Math.cos(z * 0.038) * sm(-40, -70, x);
  // ring of hills closing the horizon (lower to the west: wheat field horizon)
  const r = Math.hypot(x * 0.9, z);
  const ang = Math.atan2(z, x);
  const westLow = 0.3 + 0.7 * sm(-120, 40, x);
  h += sm(185, 330, r) * (34 + 14 * Math.sin(ang * 5 + 1) + 8 * Math.sin(ang * 11)) * westLow;
  // Alpilles to the north (Starry Night background)
  h += sm(140, 250, -z) * (22 + 10 * Math.sin(x * 0.021 + 0.4) + 5 * Math.sin(x * 0.07)) * sm(210, 120, x);
  const tm = townMask(x, z);
  h *= 1 - tm;
  // the Rhône: near bank slopes into the river, far bank is a low quay
  if (x > 80) {
    let rv;
    if (x < 92) rv = -1.55 * sm(80, 92, x);
    else if (x < 127) rv = -1.55 - 1.05 * sm(92, 100, x) * sm(127, 119, x);
    else rv = -1.55 + 2.0 * sm(127, 131, x);
    const keep = x < 131 ? sm(86, 80, x) : sm(131, 165, x);
    h = h * keep + rv;
  }
  return h;
}

// Palette regions ----------------------------------------------------------
const R = {
  town: { a: hex('#cdb27a'), b: hex('#b89a62'), c: hex('#dcc893'), cell: 0.32, aspect: 2.6, flow: 0.4 },
  meadow: { a: hex('#5b8a3a'), b: hex('#86a64a'), c: hex('#3f6b5a'), cell: 0.38, aspect: 3.6, flow: 0.7 },
  wheat: { a: hex('#d6a23a'), b: hex('#e8c65a'), c: hex('#b3702a'), cell: 0.3, aspect: 4.2, flow: 0.25 },
  wheatEdge: { a: hex('#4f7f38'), b: hex('#79a142'), c: hex('#2f5a44'), cell: 0.3, aspect: 3.4, flow: 0.4 },
  hill: { a: hex('#2c5a4e'), b: hex('#4a7c5a'), c: hex('#23406a'), cell: 0.42, aspect: 3.8, flow: 1.0 },
  far: { a: hex('#3c5ca0'), b: hex('#5a78b8'), c: hex('#2c3f7c'), cell: 1.6, aspect: 3.6, flow: 0.8 },
  bank: { a: hex('#6f9a5a'), b: hex('#c79098'), c: hex('#8ab070'), cell: 0.36, aspect: 3.6, flow: 0.55 },
  bed: { a: hex('#1c2f5a'), b: hex('#243a66'), c: hex('#18284a'), cell: 0.6, aspect: 3, flow: 0.2 },
  farbank: { a: hex('#8a7a9a'), b: hex('#6a6a9a'), c: hex('#a08a7a'), cell: 0.5, aspect: 2.8, flow: 0.3 },
  north: { a: hex('#3f6a6a'), b: hex('#5a7ea0'), c: hex('#2f4a7a'), cell: 0.8, aspect: 3.6, flow: 0.9 },
};

function wheatMask(x, z) {
  const edge = -50 + 3 * Math.sin(z * 0.2);
  let m = sm(edge, edge - 3, x) * sm(-125, -110, z) * sm(64, 52, z);
  const dh = Math.hypot(x - HILL.x, z - HILL.z);
  m *= sm(34, 44, dh);
  m *= sm(260, 220, Math.hypot(x, z));
  return m;
}
export { wheatMask };

function regionWeights(x, z) {
  const w = {};
  const r = Math.hypot(x, z);
  const tm = townMask(x, z);
  const hill = Math.exp(-((x - HILL.x) ** 2 + (z - HILL.z) ** 2) / (2 * 30 * 30));
  const wm = wheatMask(x, z) * (1 - tm);
  const far = sm(190, 260, r);
  const north = sm(140, 200, -z) * (1 - far);
  const bank = x > 76 ? sm(76, 82, x) * sm(92, 89, x) : 0;
  const bed = x > 88 ? sm(88, 93, x) * sm(128, 125, x) : 0;
  const farbank = sm(126, 131, x);
  w.town = tm * (1 - bank);
  w.wheat = wm * (1 - hill * 0.7);
  w.hill = hill * (1 - tm) * 1.2;
  w.far = far;
  w.north = north * (1 - tm);
  w.bank = bank;
  w.bed = bed;
  w.farbank = farbank * (1 - bed);
  let s = 0; for (const k in w) s += w[k];
  w.meadow = Math.max(0, 1 - s);
  return w;
}

export function groundStyle(x, z) {
  const w = regionWeights(x, z);
  let tot = 0;
  const out = { a: [0, 0, 0], b: [0, 0, 0], c: [0, 0, 0], cell: 0, aspect: 0, flow: 0 };
  for (const k in w) {
    const v = w[k]; if (v <= 0) continue; tot += v;
    const r = R[k];
    for (let i = 0; i < 3; i++) { out.a[i] += r.a[i] * v; out.b[i] += r.b[i] * v; out.c[i] += r.c[i] * v; }
    out.cell += r.cell * v; out.aspect += r.aspect * v; out.flow += r.flow * v;
  }
  for (let i = 0; i < 3; i++) { out.a[i] /= tot; out.b[i] /= tot; out.c[i] /= tot; }
  out.cell /= tot; out.aspect /= tot; out.flow /= tot;
  const d = Math.hypot(x, z);
  out.cell *= 1 + Math.max(0, d - 110) / 90;
  return out;
}

// Build an indexed terrain grid with the paint attributes
export function terrainMesh(material, x0, x1, z0, z1, step, lowerInside = null) {
  const nx = Math.round((x1 - x0) / step) + 1, nz = Math.round((z1 - z0) / step) + 1;
  const n = nx * nz;
  const P = new Float32Array(n * 3), A = new Float32Array(n * 3), B = new Float32Array(n * 3), C = new Float32Array(n * 3);
  const ST = new Float32Array(n * 4), MT = new Float32Array(n * 4);
  let k = 0;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++, k++) {
    const x = x0 + i * step, z = z0 + j * step;
    let y = H(x, z);
    if (lowerInside && x > lowerInside[0] && x < lowerInside[1] && z > lowerInside[2] && z < lowerInside[3]) y -= 0.6;
    if (townMask(x, z) > 0.999) y -= 0.04;
    P[k * 3] = x; P[k * 3 + 1] = y; P[k * 3 + 2] = z;
    const s = groundStyle(x, z);
    A.set(s.a, k * 3); B.set(s.b, k * 3); C.set(s.c, k * 3);
    ST.set([s.cell, s.aspect, 0.3, 1.2], k * 4);
    MT.set([0, s.flow, 0, 1], k * 4);
  }
  const idx = [];
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3));
  g.setAttribute('cA', new THREE.BufferAttribute(A, 3));
  g.setAttribute('cB', new THREE.BufferAttribute(B, 3));
  g.setAttribute('cC', new THREE.BufferAttribute(C, 3));
  g.setAttribute('st', new THREE.BufferAttribute(ST, 4));
  g.setAttribute('mt', new THREE.BufferAttribute(MT, 4));
  g.setIndex(idx);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, material);
  m.frustumCulled = false;
  return m;
}
