// 粒子：海洋雪（深处被扰动时闪出生物光）、热液羽流、雨线、闪电。
import * as THREE from 'three';
import { U, COMMON_GLSL } from './optics.js';
import { mulberry32 } from './noise.js';

export const PART_U = {
  uBox: { value: 36 },
  uSpark: { value: 0 },
  uPx: { value: 1 },
  uEmitP: { value: 1 },
};

export function createSnow(count = 3000) {
  const rnd = mulberry32(4242);
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = rnd(); pos[i * 3 + 1] = rnd(); pos[i * 3 + 2] = rnd();
    seed[i] = rnd();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const m = new THREE.ShaderMaterial({
    uniforms: { ...U, ...PART_U },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      ${COMMON_GLSL}
      attribute float aSeed;
      uniform float uBox;
      uniform float uSpark;
      uniform float uPx;
      varying float vA;
      varying vec3 vC;
      void main(){
        vec3 drift = vec3(uCurrent.x, -0.04 - aSeed * 0.05, uCurrent.y) * uTime * 0.6;
        drift += vec3(sin(uTime * 0.3 + aSeed * 30.0), 0.0, cos(uTime * 0.27 + aSeed * 20.0)) * 0.3;
        vec3 p = position * uBox + drift;
        p = mod(p - uCamPos + uBox * 0.5, uBox) - uBox * 0.5 + uCamPos;
        vec4 mv = viewMatrix * vec4(p, 1.0);
        float dist = -mv.z;
        float d = max(-p.y, 0.0);
        vec3 light = downwell(d) * 0.12 + lampLight(p, normalize(uCamPos - p)) * 0.3;
        float fade = smoothstep(uBox * 0.5, uBox * 0.2, length(p - uCamPos)) * smoothstep(0.2, 1.2, dist);
        // 深处：镜头快速移动时，被扰动的浮游生物闪光
        float spark = uSpark * step(0.82, aSeed) * smoothstep(9.0, 2.0, dist) * (0.5 + 0.5 * sin(uTime * 9.0 + aSeed * 90.0));
        vC = light * (0.5 + aSeed) + vec3(0.25, 0.85, 1.0) * spark * uGlow * 0.25 * PART_EMIT;
        vA = fade * step(p.y, -0.3) * uCamUnder;
        gl_PointSize = clamp((0.012 + aSeed * 0.02) * uPx / max(dist, 0.1) * 900.0, 1.0, 5.0);
        gl_Position = projectionMatrix * mv;
      }`.replace('PART_EMIT', 'uEmitP'),
    fragmentShader: /* glsl */`
      varying float vA;
      varying vec3 vC;
      void main(){
        vec2 q = gl_PointCoord - 0.5;
        float a = smoothstep(0.5, 0.1, length(q)) * vA;
        gl_FragColor = vec4(vC * a, 1.0);
      }`,
  });
  m.vertexShader = m.vertexShader.replace('uniform float uPx;', 'uniform float uPx;\nuniform float uEmitP;');
  const pts = new THREE.Points(g, m);
  pts.frustumCulled = false;
  pts.renderOrder = 9;
  return pts;
}

// 热液羽流：从附近烟囱顶部升起的一团团矿物“烟”
export class Plumes {
  constructor(n = 900) {
    this.n = n;
    const rnd = mulberry32(99);
    this.pos = new Float32Array(n * 3);
    this.age = new Float32Array(n);
    this.life = new Float32Array(n);
    this.slot = new Int16Array(n);
    this.off = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) { this.age[i] = rnd() * 8; this.life[i] = 6 + rnd() * 6; this.slot[i] = i % 8; this.off[i * 2] = rnd(); this.off[i * 2 + 1] = rnd(); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.ageAttr = new THREE.BufferAttribute(new Float32Array(n), 1);
    g.setAttribute('aAge', this.ageAttr);
    this.geo = g;
    this.mat = new THREE.ShaderMaterial({
      uniforms: { ...U, ...PART_U, uUp: { value: 1 } },
      transparent: true,
      depthWrite: false,
      vertexShader: /* glsl */`
        ${COMMON_GLSL}
        attribute float aAge;
        uniform float uPx;
        varying float vA;
        varying vec3 vC;
        varying float vDist;
        void main(){
          vec4 mv = viewMatrix * vec4(position, 1.0);
          float dist = -mv.z;
          vDist = dist;
          vec3 light = lampLight(position, normalize(uCamPos - position)) * 0.9 + downwell(max(-position.y, 0.0)) * 0.2;
          vC = light * vec3(0.55, 0.52, 0.48) + vec3(0.02, 0.018, 0.015);
          vA = smoothstep(0.0, 0.1, aAge) * (1.0 - smoothstep(0.55, 1.0, aAge)) * 0.5;
          gl_PointSize = clamp((0.5 + aAge * 1.8) * uPx / max(dist, 0.2) * 700.0, 2.0, 160.0);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */`
        ${COMMON_GLSL}
        varying float vA;
        varying vec3 vC;
        varying float vDist;
        void main(){
          vec2 q = gl_PointCoord - 0.5;
          float n = vnoise(gl_PointCoord * 4.0 + uTime * 0.3);
          float a = smoothstep(0.5, 0.0, length(q)) * vA * (0.6 + 0.6 * n);
          vec3 c = vC * exp(-uKv * vDist) + (1.0 - exp(-uKv * vDist)) * vec3(0.0);
          gl_FragColor = vec4(c, a);
        }`,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 9;
    this.vents = [];
  }
  update(dt, vents, camPos, strength) {
    // 选最近的 8 个烟囱
    const near = vents.filter((v) => Math.hypot(v.x - camPos.x, v.z - camPos.z) < 70 && Math.abs(v.y - camPos.y) < 60)
      .sort((a, b) => Math.hypot(a.x - camPos.x, a.z - camPos.z) - Math.hypot(b.x - camPos.x, b.z - camPos.z)).slice(0, 8);
    this.points.visible = near.length > 0;
    if (!near.length) return;
    const cur = U.uCurrent.value;
    const s = Math.max(0.2, strength);
    for (let i = 0; i < this.n; i++) {
      const v = near[this.slot[i] % near.length];
      this.age[i] += dt * s * 0.6;
      let t = this.age[i] / this.life[i];
      if (t >= 1) { this.age[i] = 0; t = 0; this.off[i * 2] = Math.random(); this.off[i * 2 + 1] = Math.random(); }
      const rise = t * (6 + v.h * 1.4) * s;
      const spread = 0.3 + t * 2.2;
      const a = this.off[i * 2] * 6.283 + t * 2.0;
      this.pos[i * 3] = v.x + Math.cos(a) * spread * this.off[i * 2 + 1] + cur.x * rise * 0.6;
      this.pos[i * 3 + 1] = v.y + rise;
      this.pos[i * 3 + 2] = v.z + Math.sin(a) * spread * this.off[i * 2 + 1] + cur.y * rise * 0.6;
      this.ageAttr.array[i] = t;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.ageAttr.needsUpdate = true;
  }
}

// 雨：相机周围的一圈下落线段（仅在水面以上可见）
export function createRain(n = 5000) {
  const rnd = mulberry32(7);
  const pos = new Float32Array(n * 2 * 3);
  const seed = new Float32Array(n * 2);
  const end = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    const x = rnd(), y = rnd(), z = rnd(), s = rnd();
    for (let k = 0; k < 2; k++) {
      pos[(i * 2 + k) * 3] = x; pos[(i * 2 + k) * 3 + 1] = y; pos[(i * 2 + k) * 3 + 2] = z;
      seed[i * 2 + k] = s; end[i * 2 + k] = k;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  g.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
  const m = new THREE.ShaderMaterial({
    uniforms: { ...U, uRain: { value: 0 }, uWind: { value: new THREE.Vector2(3, 1) } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      ${COMMON_GLSL}
      attribute float aSeed;
      attribute float aEnd;
      uniform float uRain;
      uniform vec2 uWind;
      varying float vA;
      void main(){
        float B = 40.0;
        vec3 vel = vec3(uWind.x, -9.0, uWind.y);
        vec3 p = position * B + vel * (uTime + aSeed * 10.0);
        p = mod(p - uCamPos + B * 0.5, B) - B * 0.5 + uCamPos;
        p -= vel * 0.035 * aEnd;
        vA = step(aSeed, uRain) * (1.0 - uCamUnder) * step(0.0, p.y) * 0.35;
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */`
      varying float vA;
      uniform vec3 uSkyAmb;
      void main(){ gl_FragColor = vec4(vec3(0.7, 0.75, 0.8) * (0.4 + uSkyAmb) * vA, 1.0); }`,
  });
  const lines = new THREE.LineSegments(g, m);
  lines.frustumCulled = false;
  lines.renderOrder = 9;
  return lines;
}

// 闪电：分叉的折线，短暂出现
export class Lightning {
  constructor() {
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(600 * 3), 3));
    this.mat = new THREE.LineBasicMaterial({ color: 0xdfe8ff, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
    this.lines = new THREE.LineSegments(this.geo, this.mat);
    this.lines.frustumCulled = false;
    this.lines.visible = false;
    this.t = 0;
  }
  strike(camPos, yaw) {
    const arr = this.geo.attributes.position.array;
    let n = 0;
    const d = 900 + Math.random() * 1500;
    const a = yaw + (Math.random() - 0.5) * 1.4;
    const bx = camPos.x - Math.sin(a) * d, bz = camPos.z - Math.cos(a) * d;
    const seg = (x0, y0, z0, len, depth) => {
      let x = x0, y = y0, z = z0;
      const steps = 14;
      for (let i = 0; i < steps && n < 598; i++) {
        const nx = x + (Math.random() - 0.5) * 70, ny = y - len / steps, nz = z + (Math.random() - 0.5) * 70;
        arr.set([x, y, z, nx, ny, nz], n * 3); n += 2;
        if (depth > 0 && Math.random() < 0.18) seg(nx, ny, nz, len * 0.4, depth - 1);
        x = nx; y = ny; z = nz;
        if (y < 0) break;
      }
    };
    seg(bx, 1300, bz, 1300, 2);
    this.geo.setDrawRange(0, n);
    this.geo.attributes.position.needsUpdate = true;
    this.lines.visible = true;
    this.t = 0.35;
  }
  update(dt) {
    if (this.t > 0) {
      this.t -= dt;
      this.mat.opacity = Math.random() < 0.3 ? 0.3 : 1;
      if (this.t <= 0) this.lines.visible = false;
    }
  }
}
