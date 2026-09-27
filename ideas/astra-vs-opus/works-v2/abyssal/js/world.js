// 世界生成：一片连续的海底（西侧珊瑚礁台地、东侧海藻林、陆坡与峡谷、1400 米深渊平原与热液带）。
// 大尺度地形烘焙成 RG32F 高度图，小尺度起伏来自一张可平铺的细节噪声；
// GPU（texelFetch + 手写插值）与 CPU（同样的插值）读取同一份数据，所以碰撞与画面一致。

import { Noise2, mulberry32, clamp, smoothstep, lerp } from './noise.js';

export const EXT = 2400;          // 烘焙范围半宽（米）
export const N = 768;             // 高度图分辨率
export const CELL = (2 * EXT) / (N - 1);
export const DN = 256;            // 细节噪声分辨率（可平铺）
export const DCELL = 1.5;         // 细节噪声每格米数
export const WORLD_RADIUS = 2200; // 可航行半径
export const MAX_DEPTH = 1400;

export const DEFAULT_RECIPE = {
  seed: 713,
  relief: 1.0,      // 地形起伏
  cover: 1.0,       // 生物覆盖
  kelpHeight: 1.0,  // 海藻高度
  habitatScale: 1.0,// 生境尺度
  life: 1.0,        // 动物丰度
  predators: 1.0,   // 掠食者
  benthos: 1.0,     // 底栖生物
  jellies: 1.0,     // 水母与漂流者
  shoal: 1.0,       // 鱼群规模
};

// 峡谷轴线（世界坐标 z → x）
export function canyonX(z) {
  return 70 * Math.sin(z / 260) + 35 * Math.sin(z / 110 + 1.3) + 40;
}

export const SITES = {
  reef: { id: 'reef', x: -560, z: -760, name: '珊瑚礁', title: '珊瑚大教堂', sub: '海浪之下的另一个世界。', key: 1 },
  kelp: { id: 'kelp', x: 580, z: -700, name: '海藻林', title: '沉没的森林', sub: '整片森林随海水起伏。', key: 2 },
  blue: { id: 'blue', x: -330, z: 30, name: '开阔大洋', title: '深入蔚蓝', sub: '在巨兽身边，你是如此渺小。', key: 3 },
  deep: { id: 'deep', x: 0, z: 1180, name: '深渊', title: '午夜花园', sub: '光消失之后，生命仍在。', key: 4 },
};
SITES.deep.x = canyonX(1180) + 30;

export const PLACES = [
  { id: 'reef-ridges', name: '珊瑚脊', x: -760, z: -1000, kind: 'reef', note: '石灰岩脊上的珊瑚群落最密集。' },
  { id: 'reef-channels', name: '沙质水道', x: -360, z: -560, kind: 'reef', note: '珊瑚脊之间的白沙水道与海草。' },
  { id: 'reef-gardens', name: '外礁花园', x: -1020, z: -520, kind: 'reef', note: '远离起点的外缘礁区。' },
  { id: 'kelp-avenues', name: '海藻长廊', x: 470, z: -980, kind: 'kelp', note: '成排的巨藻夹出的通道。' },
  { id: 'kelp-clearings', name: '林间空地', x: 800, z: -560, kind: 'kelp', note: '森林中的沙地空地。' },
  { id: 'kelp-outer', name: '外缘海藻林', x: 1060, z: -1120, kind: 'kelp', note: '森林的东北外缘。' },
  { id: 'shelf-edge', name: '陆架边缘', x: -160, z: -250, kind: 'blue', note: '浅海在这里突然坠入蓝色。' },
  { id: 'canyon-wall', name: '峡谷岩壁', x: 0, z: 330, kind: 'slope', note: '陡峭的峡谷壁，约 500 米深。' },
  { id: 'vent-belt', name: '热液带', x: -420, z: 1320, kind: 'vent', note: '沿断裂带排列的矿物烟囱。' },
  { id: 'basalt-plain', name: '玄武岩平原', x: 720, z: 1420, kind: 'abyss', note: '起伏的深渊平原。' },
  { id: 'far-vents', name: '远方热液区', x: -960, z: 1760, kind: 'vent', note: '海图最远处的一片热泉。' },
];
PLACES.find((p) => p.id === 'canyon-wall').x = canyonX(330) + 55;

// 强制的热液区中心（保证三个热液目的地都有烟囱）
const VENT_SPOTS = [
  [SITES.deep.x + 10, SITES.deep.z + 10, 60],
  [-420, 1320, 70],
  [-960, 1760, 80],
];

export class World {
  constructor(recipe) {
    this.recipe = { ...DEFAULT_RECIPE, ...recipe };
    this.generate();
  }

  generate() {
    const r = this.recipe;
    const seed = r.seed >>> 0;
    this.noise = new Noise2(seed);
    this.noiseB = new Noise2(seed ^ 0x5bd1e995);
    this.H = new Float32Array(N * N);   // 大尺度高度
    this.A = new Float32Array(N * N);   // 细节幅度
    this.reef = new Float32Array(N * N);
    this.kelp = new Float32Array(N * N);
    this.grass = new Float32Array(N * N);
    this.vent = new Float32Array(N * N);
    this.D = new Float32Array(DN * DN); // 可平铺细节噪声
    this._bakeDetail(seed);
    const t0 = performance.now();
    for (let j = 0; j < N; j++) {
      const z = -EXT + j * CELL;
      for (let i = 0; i < N; i++) {
        const x = -EXT + i * CELL;
        this._bake(i + j * N, x, z);
      }
    }
    this.bakeMs = performance.now() - t0;
  }

  _bakeDetail(seed) {
    const rnd = mulberry32(seed * 31 + 7);
    const D = this.D;
    const octs = [
      [8, 1.0], [16, 0.55], [32, 0.32], [64, 0.2], [128, 0.12],
    ];
    const lattices = octs.map(([L]) => {
      const a = new Float32Array(L * L);
      for (let k = 0; k < a.length; k++) a[k] = rnd() * 2 - 1;
      return a;
    });
    let norm = 0;
    for (const [, amp] of octs) norm += amp;
    for (let j = 0; j < DN; j++) {
      for (let i = 0; i < DN; i++) {
        let s = 0;
        for (let o = 0; o < octs.length; o++) {
          const [L, amp] = octs[o];
          const lat = lattices[o];
          const gx = (i * L) / DN, gz = (j * L) / DN;
          const ix = Math.floor(gx), iz = Math.floor(gz);
          let fx = gx - ix, fz = gz - iz;
          fx = fx * fx * (3 - 2 * fx); fz = fz * fz * (3 - 2 * fz);
          const x0 = ix % L, x1 = (ix + 1) % L, z0 = iz % L, z1 = (iz + 1) % L;
          const a = lat[z0 * L + x0], b = lat[z0 * L + x1], c = lat[z1 * L + x0], d = lat[z1 * L + x1];
          s += amp * lerp(lerp(a, b, fx), lerp(c, d, fx), fz);
        }
        // 略微“风化”：让正值变成台地、负值变成凹坑
        let v = s / norm * 1.7;
        v = v > 0 ? Math.pow(v, 0.8) : -Math.pow(-v, 1.2);
        D[j * DN + i] = v;
      }
    }
  }

  // 离岸坐标：u<-200 为陆架，u>950 为深渊平原
  offshore(x, z) {
    const n = this.noise;
    return z + 230 * n.fbm(x / 1300 + 3.1, z / 1300 - 1.7, 3) + 50 * n.grad(x / 300, z / 300 + 5.3);
  }

  _bake(idx, x, z) {
    const r = this.recipe;
    const n = this.noise, m = this.noiseB;
    const hs = r.habitatScale;
    const relief = r.relief;
    const u = this.offshore(x, z);
    const shelfMask = 1 - smoothstep(-300, -170, u);
    const edgeBlend = smoothstep(-270, -130, u);
    const abyss = smoothstep(800, 1050, u);

    let h = 0, reef = 0, kelp = 0, grass = 0, ventF = 0, reefW = 0, ridgeH = 0;
    // ——— 陆架 ———
    if (edgeBlend < 1) {
      const wx = x + 140 * m.fbm(x / 700 - 4.2, z / 700 + 2.2, 2);
      let shelf = -17 - 11 * smoothstep(-1900, -220, u) + 4.5 * n.fbm(x / 260, z / 260, 3);
      reefW = smoothstep(80, -260, wx);
      const kelpE = smoothstep(-80, 260, wx);
      if (reefW > 0) {
        // 珊瑚脊：沿东北-西南方向延伸的脊线，中间是沙质水道
        const rx = (x * 0.8 + z * 0.6) / (95 * hs), rz = (-x * 0.6 + z * 0.8) / (230 * hs);
        const ridge = n.ridged(rx, rz, 4);
        ridgeH = Math.pow(ridge, 2.2);
        shelf += reefW * (ridgeH * 8.5 * relief - 1.2);
        const patchR = n.fbm(x / (150 * hs) + 21, z / (150 * hs) - 8, 3);
        reef = shelfMask * reefW * smoothstep(0.42, 0.62, ridge * 0.75 + patchR * 0.55 + 0.05);
        reef = Math.max(reef, shelfMask * Math.exp(-(((x - SITES.reef.x) ** 2 + (z - SITES.reef.z) ** 2) / (60 * 60))));
      }
      if (kelpE > 0) {
        shelf += kelpE * (m.fbm(x / 70, z / 70, 3) * 3.2 * relief);
        const clear = m.fbm(x / (120 * hs) - 13, z / (120 * hs) + 6, 3);
        kelp = shelfMask * kelpE * smoothstep(-0.2, -0.02, clear);
        // 起点：一小片林间空地，四周是林缘
        const kd2 = ((x - SITES.kelp.x) ** 2 + (z - SITES.kelp.z) ** 2);
        kelp = Math.max(kelp, shelfMask * kelpE * Math.exp(-kd2 / (90 * 90)));
        kelp *= 1 - Math.exp(-kd2 / (11 * 11));
        const cl = PLACES[4];
        kelp *= 1 - Math.exp(-(((x - cl.x) ** 2 + (z - cl.z) ** 2) / (38 * 38)));
      }
      const g = m.fbm(x / (45 * hs) + 2, z / (45 * hs) + 9, 3);
      grass = shelfMask * smoothstep(0.0, 0.22, g) * (1 - reef) * (1 - kelp * 0.7) * (0.3 + 0.7 * reefW * (1 - ridgeH));
      h = shelf;
    }
    // ——— 陆坡 ———
    let slopeZone = 0;
    if (edgeBlend > 0) {
      const t = clamp((u + 200) / 1150, 0, 1);
      const S = 1 - Math.pow(1 - t, 2.1);
      let hs2 = -32 - 1368 * S;
      slopeZone = edgeBlend * (1 - smoothstep(850, 1100, u));
      if (slopeZone > 0) hs2 += slopeZone * (n.fbm(x / 120 + 7, z / 90, 4) * 55 * relief) * Math.sin(Math.PI * clamp(t * 1.3, 0, 1));
      h = lerp(h, hs2, edgeBlend);
    }
    // ——— 峡谷 ———
    const cx = canyonX(z);
    const dx = x - cx;
    const w = 32 + 0.07 * Math.max(u + 300, 0);
    const cd = 22 * smoothstep(-760, -260, u) + 170 * smoothstep(-260, 200, u) * (1 - smoothstep(380, 820, u));
    const cg = Math.exp(-(dx / w) * (dx / w));
    h -= cd * cg;

    // ——— 深渊平原与热液带 ———
    if (abyss > 0) {
      const roll = n.fbm(x / 220 - 9, z / 220 + 4, 4) * 26 * relief;
      const belt = Math.pow(n.ridged((x * 0.5 - z * 0.86) / (320 * hs) + 40, (x * 0.86 + z * 0.5) / (900 * hs), 2), 5);
      const patch = smoothstep(0.1, 0.45, m.fbm(x / (160 * hs) + 11, z / (160 * hs) - 3, 3) + 0.25);
      ventF = belt * patch;
      for (const [vx, vz, vr] of VENT_SPOTS) {
        const d2 = ((x - vx) ** 2 + (z - vz) ** 2) / (vr * vr);
        ventF = Math.max(ventF, Math.exp(-d2 * 1.2));
      }
      ventF *= abyss;
      h = lerp(h, h + roll + ventF * 10 * relief, abyss);
    }
    h = Math.min(h, -7);

    // 细节幅度：沙地平缓，礁区与岩壁粗糙
    const slopeRough = edgeBlend * (1 - abyss);
    const amp = relief * (0.35 + 1.4 * reef + 0.9 * kelp * (1 - reef) + 3.2 * slopeRough + 1.2 * abyss + 2.2 * ventF + 1.4 * cg * slopeZone);

    this.H[idx] = h;
    this.A[idx] = amp;
    this.reef[idx] = reef;
    this.kelp[idx] = kelp;
    this.grass[idx] = grass;
    this.vent[idx] = ventF;
  }

  // ——— 与 GLSL 完全一致的采样 ———
  _bilin(arr, x, z) {
    let gx = (x + EXT) / CELL, gz = (z + EXT) / CELL;
    gx = clamp(gx, 0, N - 1.001); gz = clamp(gz, 0, N - 1.001);
    const i = Math.floor(gx), j = Math.floor(gz);
    const fx = gx - i, fz = gz - j;
    const k = i + j * N;
    const a = arr[k], b = arr[k + 1], c = arr[k + N], d = arr[k + N + 1];
    return (a + (b - a) * fx) * (1 - fz) + (c + (d - c) * fx) * fz;
  }
  detail(x, z) {
    const gx = x / DCELL, gz = z / DCELL;
    const i = Math.floor(gx), j = Math.floor(gz);
    let fx = gx - i, fz = gz - j;
    fx = fx * fx * (3 - 2 * fx); fz = fz * fz * (3 - 2 * fz);
    const i0 = ((i % DN) + DN) % DN, j0 = ((j % DN) + DN) % DN;
    const i1 = (i0 + 1) % DN, j1 = (j0 + 1) % DN;
    const D = this.D;
    const a = D[j0 * DN + i0], b = D[j0 * DN + i1], c = D[j1 * DN + i0], d = D[j1 * DN + i1];
    return (a + (b - a) * fx) * (1 - fz) + (c + (d - c) * fx) * fz;
  }
  floorAt(x, z) {
    return this._bilin(this.H, x, z) + this._bilin(this.A, x, z) * this.detail(x, z);
  }
  normalAt(x, z, e = 1.2) {
    const hx = this.floorAt(x + e, z) - this.floorAt(x - e, z);
    const hz = this.floorAt(x, z + e) - this.floorAt(x, z - e);
    const nx = -hx, ny = 2 * e, nz = -hz;
    const l = Math.hypot(nx, ny, nz);
    return [nx / l, ny / l, nz / l];
  }
  habitat(x, z) {
    return {
      reef: this._bilin(this.reef, x, z),
      kelp: this._bilin(this.kelp, x, z),
      grass: this._bilin(this.grass, x, z),
      vent: this._bilin(this.vent, x, z),
    };
  }
  // 区域类型（用于标题与群落）
  zoneAt(x, z, y) {
    const f = this.floorAt(x, z);
    const hab = this.habitat(x, z);
    const u = this.offshore(x, z);
    const depth = -y;
    const above = f + 60 > y; // 离底 60 米内
    if (y > -1.5) return 'surface';
    if (f > -60) {
      if (hab.kelp > 0.35 && x > 0) return 'kelp';
      if (hab.reef > 0.2 || x < -120) return 'reef';
      return x > 0 ? 'kelp' : 'reef';
    }
    if (depth < 200) return 'blue';
    if (f < -1250 && above) return hab.vent > 0.25 ? 'vents' : 'abyss';
    if (depth < 600) return 'twilight';
    if (depth < 1000) return 'lowtwilight';
    return 'midnight';
  }
}

// 地形着色器用到的 GLSL（与 World._bilin / detail / floorAt 一一对应）
export const TERRAIN_GLSL = /* glsl */`
uniform sampler2D uHeightTex;  // RG32F: 高度, 细节幅度
uniform sampler2D uDetailTex;  // R32F 可平铺
uniform sampler2D uHabTex;     // RGBA8 生境
const float W_EXT = ${EXT.toFixed(1)};
const float W_CELL = ${CELL.toFixed(8)};
const int W_N = ${N};
const float W_DCELL = ${DCELL.toFixed(3)};
const int W_DN = ${DN};
vec2 wHeightRaw(vec2 p){
  vec2 g = clamp((p + W_EXT) / W_CELL, vec2(0.0), vec2(float(W_N) - 1.001));
  ivec2 i = ivec2(floor(g));
  vec2 f = g - vec2(i);
  vec2 a = texelFetch(uHeightTex, i, 0).rg;
  vec2 b = texelFetch(uHeightTex, i + ivec2(1,0), 0).rg;
  vec2 c = texelFetch(uHeightTex, i + ivec2(0,1), 0).rg;
  vec2 d = texelFetch(uHeightTex, i + ivec2(1,1), 0).rg;
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float wDetail(vec2 p){
  vec2 g = p / W_DCELL;
  vec2 fl = floor(g);
  vec2 f = g - fl;
  f = f * f * (3.0 - 2.0 * f);
  ivec2 i0 = ivec2(mod(fl, float(W_DN)));
  ivec2 i1 = ivec2(mod(fl + 1.0, float(W_DN)));
  float a = texelFetch(uDetailTex, ivec2(i0.x, i0.y), 0).r;
  float b = texelFetch(uDetailTex, ivec2(i1.x, i0.y), 0).r;
  float c = texelFetch(uDetailTex, ivec2(i0.x, i1.y), 0).r;
  float d = texelFetch(uDetailTex, ivec2(i1.x, i1.y), 0).r;
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float wFloor(vec2 p){
  vec2 ha = wHeightRaw(p);
  return ha.x + ha.y * wDetail(p);
}
vec4 wHabitat(vec2 p){
  return texture(uHabTex, ((p + W_EXT) / W_CELL + 0.5) / float(W_N));
}
`;
