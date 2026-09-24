// 海面：12 个 Gerstner 波（CPU 与 GPU 用同一组参数）+ 事件波（海底震颤的环形波列、畸形浪）。
// CPU 版本用来让“漂浮的镜头”随真实浪高起伏、并判定水线。
import * as THREE from 'three';
import { U, COMMON_GLSL } from './optics.js';
import { SKY_U, SKY_GLSL } from './sky.js';
import { mulberry32, clamp, lerp } from './noise.js';

export const NW = 12;
const G = 9.81;

export const WAVE_U = {
  uWA: { value: Array.from({ length: NW }, () => new THREE.Vector4()) }, // dir.x, dir.z, k, amp
  uWB: { value: Array.from({ length: NW }, () => new THREE.Vector4()) }, // omega, phase, Q, lambda
  uEv: { value: Array.from({ length: 3 }, () => new THREE.Vector4(0, 0, -1000, 0)) }, // x, z, t0, amp
  uEvB: { value: Array.from({ length: 3 }, () => new THREE.Vector4(0, 0, 0, 0)) },    // type, dirx, dirz, unused
  uWaveTime: { value: 0 },
  uWindDir: { value: new THREE.Vector2(1, 0) },
  uChop: { value: 1 },
  uBloom: U.uBloom,
  uGridCenter: { value: new THREE.Vector2() },
};

export const WAVE_GLSL = /* glsl */`
uniform vec4 uWA[${NW}];
uniform vec4 uWB[${NW}];
uniform vec4 uEv[3];
uniform vec4 uEvB[3];
uniform float uWaveTime;
uniform vec2 uWindDir;
uniform float uChop;
float eventHeight(vec2 p, float t){
  float h = 0.0;
  for (int i = 0; i < 3; i++){
    float age = t - uEv[i].z;
    if (age < 0.0 || age > 240.0 || uEv[i].w == 0.0) continue;
    vec2 d = p - uEv[i].xy;
    if (uEvB[i].x < 0.5){
      float r = length(d);
      float front = r - 14.0 * age;
      float env = exp(-front * front / (70.0 * 70.0));
      h += uEv[i].w * env * cos(front * 0.16) / sqrt(1.0 + r / 150.0) * exp(-age / 90.0);
    } else {
      vec2 dir = uEvB[i].yz;
      float s = dot(d, dir) - 16.0 * age;
      float l = dot(d, vec2(-dir.y, dir.x));
      h += uEv[i].w * exp(-s * s / (38.0 * 38.0)) * exp(-l * l / (260.0 * 260.0)) * (cos(s * 0.07) * 0.8 + 0.2) * smoothstep(0.0, 8.0, age) * exp(-age / 70.0);
    }
  }
  return h;
}
// Gerstner 位移与雅可比（返回位移，写出法线与泡沫度量）
vec3 gerstner(vec2 p0, float t, float dist, out vec3 nrm, out float jac){
  vec3 disp = vec3(0.0);
  float dxdx = 0.0, dzdz = 0.0, dxdz = 0.0, dhdx = 0.0, dhdz = 0.0;
  for (int i = 0; i < ${NW}; i++){
    vec4 a = uWA[i]; vec4 b = uWB[i];
    float fade = 1.0 - smoothstep(b.w * 6.0, b.w * 22.0, dist);
    if (fade <= 0.0) continue;
    float amp = a.w * fade;
    float th = a.z * dot(a.xy, p0) - b.x * t + b.y;
    float s = sin(th), c = cos(th);
    float q = b.z * uChop;
    disp.x += q * amp * a.x * c;
    disp.z += q * amp * a.y * c;
    disp.y += amp * s;
    float wa = a.z * amp;
    dhdx += a.x * wa * c;
    dhdz += a.y * wa * c;
    dxdx += q * wa * a.x * a.x * s;
    dzdz += q * wa * a.y * a.y * s;
    dxdz += q * wa * a.x * a.y * s;
  }
  float jxx = 1.0 - dxdx, jzz = 1.0 - dzdz;
  jac = jxx * jzz - dxdz * dxdz;
  nrm = normalize(vec3(-dhdx, max(jxx * jzz, 0.2), -dhdz));
  return disp;
}
`;

export class Waves {
  constructor() {
    this.events = [];
    this.configure({ wind: 7, swell: 0.4, chop: 0.8, windDir: 40, swellDir: 20, period: 1, storm: 0 });
  }
  configure(w) {
    this.cfg = { ...w };
    const rnd = mulberry32(99173);
    const wd = (w.windDir * Math.PI) / 180, sd = (w.swellDir * Math.PI) / 180;
    const U10 = Math.max(1, w.wind);
    // 充分成长风浪的峰值波长（有上限，避免巨浪穿帮）
    const lp = clamp(0.83 * U10 * U10, 6, 190);
    const Hs = clamp(0.021 * U10 * U10, 0.08, 7.5);
    const list = [];
    const nWind = 9;
    for (let i = 0; i < nWind; i++) {
      const f = i / (nWind - 1);
      const lambda = lp * 1.25 * Math.pow(0.66, i);
      const ang = wd + (rnd() - 0.5) * 1.6 * (0.4 + f);
      const amp = (Hs * 0.5) * Math.pow(lambda / lp, 0.9) * 0.55;
      list.push({ lambda, ang, amp });
    }
    const swellL = 110 + 90 * w.period;
    for (let i = 0; i < 3; i++) {
      const lambda = swellL * Math.pow(0.78, i);
      const ang = sd + (rnd() - 0.5) * 0.35;
      const amp = w.swell * (0.75 - i * 0.18) * (1 + w.storm * 1.3);
      list.push({ lambda, ang, amp });
    }
    this.waves = list.map((o) => {
      const k = (2 * Math.PI) / o.lambda;
      return { dx: Math.cos(o.ang), dz: Math.sin(o.ang), k, amp: o.amp, omega: Math.sqrt(G * k), phase: rnd() * Math.PI * 2, Q: 0, lambda: o.lambda };
    });
    // 陡度：保证不自交
    let sum = 0;
    for (const wv of this.waves) sum += wv.k * wv.amp;
    const chop = w.chop;
    for (const wv of this.waves) wv.Q = clamp(0.85 / Math.max(sum, 0.01), 0, 1.6);
    this.chop = chop;
    WAVE_U.uChop.value = chop;
    WAVE_U.uWindDir.value.set(Math.cos(wd), Math.sin(wd));
    this.waves.forEach((wv, i) => {
      WAVE_U.uWA.value[i].set(wv.dx, wv.dz, wv.k, wv.amp);
      WAVE_U.uWB.value[i].set(wv.omega, wv.phase, wv.Q, wv.lambda);
    });
    this.Hs = Hs + w.swell * 1.2;
  }
  addEvent(type, x, z, amp, t, dir) {
    // 0 = 环形波列（海底震颤），1 = 平面波包（畸形浪）
    this.events.push({ type, x, z, t0: t, amp, dx: dir ? dir[0] : 1, dz: dir ? dir[1] : 0 });
    if (this.events.length > 3) this.events.shift();
    this.events.forEach((e, i) => {
      WAVE_U.uEv.value[i].set(e.x, e.z, e.t0, e.amp);
      WAVE_U.uEvB.value[i].set(e.type, e.dx, e.dz, 0);
    });
  }
  eventHeight(x, z, t) {
    let h = 0;
    for (const e of this.events) {
      const age = t - e.t0;
      if (age < 0 || age > 240) continue;
      const dx = x - e.x, dz = z - e.z;
      if (e.type === 0) {
        const r = Math.hypot(dx, dz);
        const front = r - 14 * age;
        h += e.amp * Math.exp(-(front * front) / 4900) * Math.cos(front * 0.16) / Math.sqrt(1 + r / 150) * Math.exp(-age / 90);
      } else {
        const s = dx * e.dx + dz * e.dz - 16 * age;
        const l = -dx * e.dz + dz * e.dx;
        h += e.amp * Math.exp(-(s * s) / 1444) * Math.exp(-(l * l) / 67600) * (Math.cos(s * 0.07) * 0.8 + 0.2) * clamp(age / 8, 0, 1) * Math.exp(-age / 70);
      }
    }
    return h;
  }
  disp(x0, z0, t, out) {
    let dx = 0, dy = 0, dz = 0;
    for (const w of this.waves) {
      const th = w.k * (w.dx * x0 + w.dz * z0) - w.omega * t + w.phase;
      const c = Math.cos(th), s = Math.sin(th);
      const q = w.Q * this.chop;
      dx += q * w.amp * w.dx * c;
      dz += q * w.amp * w.dz * c;
      dy += w.amp * s;
    }
    out[0] = dx; out[1] = dy; out[2] = dz;
    return out;
  }
  // 世界坐标 (x,z) 处的真实水面高度（迭代反解水平位移）
  height(x, z, t) {
    const o = [0, 0, 0];
    let x0 = x, z0 = z;
    for (let i = 0; i < 4; i++) {
      this.disp(x0, z0, t, o);
      x0 = x - o[0];
      z0 = z - o[2];
    }
    this.disp(x0, z0, t, o);
    return o[1] + this.eventHeight(x, z, t);
  }
  slope(x, z, t) {
    const e = 0.8;
    return [(this.height(x + e, z, t) - this.height(x - e, z, t)) / (2 * e), (this.height(x, z + e, t) - this.height(x, z - e, t)) / (2 * e)];
  }
}

function makePolarGrid() {
  const rings = [0];
  let r = 0.35;
  while (r < 30000) {
    rings.push(r);
    r = r * 1.05 + 0.3;
  }
  const seg = 256;
  const pos = [];
  const idx = [];
  for (let i = 0; i < rings.length; i++) {
    for (let j = 0; j < seg; j++) {
      const a = (j / seg) * Math.PI * 2;
      pos.push(Math.cos(a) * rings[i], 0, Math.sin(a) * rings[i]);
    }
  }
  for (let i = 0; i < rings.length - 1; i++) {
    for (let j = 0; j < seg; j++) {
      const a = i * seg + j, b = i * seg + ((j + 1) % seg);
      const c = (i + 1) * seg + j, d = (i + 1) * seg + ((j + 1) % seg);
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

export function createSurface() {
  const mat = new THREE.ShaderMaterial({
    uniforms: { ...U, ...SKY_U, ...WAVE_U },
    vertexShader: /* glsl */`
      ${COMMON_GLSL}
      ${WAVE_GLSL}
      uniform vec2 uGridCenter;
      varying vec3 vWorld;
      varying vec3 vNrm;
      varying float vJac;
      varying float vCrest;
      void main(){
        vec2 p0 = uGridCenter + position.xz;
        float dist = length(position.xz);
        vec3 n; float j;
        vec3 d = gerstner(p0, uWaveTime, dist, n, j);
        float eh = eventHeight(p0, uWaveTime);
        float e = 1.5;
        float ehx = eventHeight(p0 + vec2(e, 0.0), uWaveTime) - eh;
        float ehz = eventHeight(p0 + vec2(0.0, e), uWaveTime) - eh;
        n = normalize(n + vec3(-ehx / e, 0.0, -ehz / e));
        vec3 wp = vec3(p0.x + d.x, d.y + eh, p0.y + d.z);
        vWorld = wp;
        vNrm = n;
        vJac = j;
        vCrest = d.y + eh;
        gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
      }`,
    fragmentShader: /* glsl */`
      ${COMMON_GLSL}
      ${SKY_GLSL}
      uniform float uWaveTime;
      uniform vec2 uWindDir;
      uniform float uBloom;
      varying vec3 vWorld;
      varying vec3 vNrm;
      varying float vJac;
      varying float vCrest;
      vec2 detailSlope(vec2 p, float dist){
        vec2 g = vec2(0.0);
        float fade = 1.0 - smoothstep(20.0, 260.0, dist);
        float lam = 5.2;
        float ang = atan(uWindDir.y, uWindDir.x);
        for (int i = 0; i < 10; i++){
          float a = ang + sin(float(i) * 2.39) * 1.1;
          vec2 dir = vec2(cos(a), sin(a));
          float k = 6.2831 / lam;
          float w = sqrt(9.81 * k);
          float amp = lam * 0.012;
          float th = k * dot(dir, p) - w * uWaveTime + float(i) * 1.7;
          g += dir * (k * amp * cos(th));
          lam *= 0.72;
        }
        return g * fade;
      }
      void main(){
        vec3 p = vWorld;
        vec3 cam = uCamPos;
        vec3 vv = p - cam;
        float dist = length(vv);
        vec3 v = vv / dist;
        vec2 ds = detailSlope(p.xz, dist);
        vec3 N = normalize(vNrm + vec3(-ds.x, 0.0, -ds.y));
        float foam = smoothstep(0.62, 0.18, vJac) * (0.55 + 0.45 * vnoise(p.xz * 0.9 + uWaveTime * 0.3));
        foam *= 1.0 - smoothstep(300.0, 1500.0, dist);
        if (uCamUnder > 0.5){
          // 从水下仰望：斯涅尔窗
          vec3 Nd = -N;
          vec3 t = refract(v, Nd, 1.333);
          vec3 col;
          float cosi = clamp(dot(-v, Nd), 0.0, 1.0);
          if (dot(t, t) < 1e-4){
            vec3 r = reflect(v, Nd);
            col = waterInscatter(p - vec3(0.0, 0.1, 0.0), r, 1e4) * 1.1;
          } else {
            float F = 0.02 + 0.98 * pow(1.0 - cosi, 5.0);
            vec3 sky = skyColor(p, t, true);
            vec3 r = reflect(v, Nd);
            vec3 wr = waterInscatter(p - vec3(0.0, 0.1, 0.0), r, 1e4);
            col = mix(sky * 0.92, wr, clamp(F * 2.0, 0.0, 1.0));
          }
          col += vec3(0.9, 0.95, 1.0) * foam * 0.35 * luma(uSunCol + uSkyAmb);
          gl_FragColor = vec4(applyWater(col, p), 1.0);
          return;
        }
        // 从空中俯视
        vec3 r = reflect(v, N);
        r.y = abs(r.y) + 0.001;
        float cosv = clamp(dot(-v, N), 0.0, 1.0);
        float F = 0.02 + 0.98 * pow(1.0 - cosv, 5.0);
        F = min(F, 0.95);
        vec3 refl = skyColor(p, r, false);
        float rough = mix(0.0025, 0.06, smoothstep(10.0, 3000.0, dist));
        float spec = pow(max(dot(r, uSunDir), 0.0), 1.0 / rough) * (1.0 / (rough * 60.0));
        refl += uSunCol * spec * 2.0 * smoothstep(-0.02, 0.05, uSunDir.y);
        // 背光浪峰的次表面散射
        float back = pow(max(dot(v, -uSunDir) * -1.0, 0.0), 3.0);
        vec3 sss = vec3(0.05, 0.36, 0.42) * luma(uSunCol) * 0.05 * (0.3 + back * 2.0) * smoothstep(-1.0, 2.5, vCrest);
        vec3 foamCol = vec3(0.92, 0.96, 1.0) * (uSunCol * max(dot(N, uSunDir), 0.0) * 0.8 + uSkyAmb * 1.2 + 0.002);
        vec3 glow = vec3(0.1, 0.9, 0.8) * uBloom * uNight * (foam * 3.0 + smoothstep(0.9, 0.5, vJac) * 0.8) * uGlow;
        vec3 col = refl * F + sss * (1.0 - F) + foamCol * foam + glow;
        float a = clamp(F + foam * (1.0 - F) + luma(sss) * 0.5, 0.0, 1.0);
        // 远处混入空气透视
        float fog = 1.0 - exp(-dist * uAirDensity);
        col = mix(col, uAirFog * a, fog);
        a = mix(a, 1.0, fog);
        a = mix(a, 1.0, smoothstep(2500.0, 14000.0, dist));
        col = mix(col, seaHorizon(v), smoothstep(2500.0, 14000.0, dist));
        gl_FragColor = vec4(col, a);
      }`,
    transparent: true,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    side: THREE.DoubleSide,
    depthWrite: true,
  });
  const mesh = new THREE.Mesh(makePolarGrid(), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 5;
  return mesh;
}
