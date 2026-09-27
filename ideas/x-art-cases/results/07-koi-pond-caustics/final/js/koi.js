// Procedural koi: one merged geometry (body, fins, forked tail, eyes) drawn with instancing,
// a swimming vertex shader (body wave, turning bend, fin paddles, tail flutter) and
// per-variety skin shaders (Kohaku, Showa, Golden Ogon, Platinum). Also the 2D card previews.
import * as THREE from 'three';
import { COMMON, CANOPY } from './water.js';

export const VARIETIES = ['Kohaku', 'Showa', 'Golden Ogon', 'Platinum'];

const X0 = -0.42, X1 = 0.5, BL = X1 - X0;
// half-width of the body from the tail root (t = 0) to the nose (t = 1); round nose via sqrt(1 - t)
export function halfW(t) {
  t = Math.min(1, Math.max(0, t));
  return 0.024 * (1 - t) + 0.276 * Math.pow(t, 1.167) * Math.sqrt(1 - t);
}

let BASE_GEO = null;
function buildGeometry() {
  if (BASE_GEO) return BASE_GEO;
  const pos = [], nrm = [], part = [], fin = [], base = [], idx = [];
  const vert = (x, y, z, nx, ny, nz, p, fu, fv, b) => {
    const l = Math.hypot(nx, ny, nz) || 1;
    pos.push(x, y, z); nrm.push(nx / l, ny / l, nz / l); part.push(p); fin.push(fu, fv);
    base.push(b ? b[0] : 0, b ? b[1] : 0, b ? b[2] : 0);
    return pos.length / 3 - 1;
  };
  const grid = (start, nu, nv) => {
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
      const a = start + i * (nv + 1) + j, b = a + 1, c = a + nv + 1, d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  };

  // body: elliptic rings along the length, seam under the belly
  const NS = 38, NR = 22;
  let s0 = pos.length / 3;
  for (let i = 0; i <= NS; i++) {
    const t = 0.5 - 0.5 * Math.cos(Math.PI * i / NS);
    const x = X0 + t * BL;
    const w = halfW(t);
    const dw = (halfW(t + 0.004) - halfW(t - 0.004)) / (0.008 * BL);
    for (let j = 0; j <= NR; j++) {
      const th = -Math.PI / 2 + 2 * Math.PI * j / NR;
      const c = Math.cos(th), s = Math.sin(th);
      const hk = s > 0 ? 0.92 : 0.8;
      vert(x, s * w * hk, c * w, -dw * 0.9, s / hk, c, 0, (th - Math.PI / 2) * w * 0.9, t);
    }
  }
  grid(s0, NS, NR);

  // eyes: small spheres on the sides of the head
  const te = (0.405 - X0) / BL, we = halfW(te);
  for (const side of [1, -1]) {
    const E = [0.405, 0.3 * we * 0.92, side * we * 0.86], r = 0.021;
    s0 = pos.length / 3;
    const LA = 7, LO = 10;
    for (let i = 0; i <= LA; i++) {
      const ph = Math.PI * i / LA;
      for (let j = 0; j <= LO; j++) {
        const th = 2 * Math.PI * j / LO;
        const nx = Math.sin(ph) * Math.cos(th), ny = Math.cos(ph), nz = Math.sin(ph) * Math.sin(th);
        vert(E[0] + nx * r, E[1] + ny * r, E[2] + nz * r, nx, ny, nz, 5, 0, 0, E);
      }
    }
    grid(s0, LA, LO);
  }

  // dorsal fin: a thin sail along the spine, leaning back
  {
    const NU = 12, NV = 3;
    s0 = pos.length / 3;
    for (let i = 0; i <= NU; i++) {
      const u = i / NU, t = 0.3 + 0.42 * u, x = X0 + t * BL, top = halfW(t) * 0.92;
      const hd = 0.055 * Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.08)), 0.6) * (1.15 - 0.45 * u);
      for (let j = 0; j <= NV; j++) {
        const v = j / NV;
        vert(x - v * hd * 0.6, top - 0.004 + v * hd, 0, 0, 0.15, 1, 3, u, v);
      }
    }
    grid(s0, NU, NV);
  }

  // paddle fins: pectoral (big) and pelvic (small) fans that pivot at their base
  const fan = (p, t, zf, yf, a0, a1, len, droop) => {
    const x = X0 + t * BL, w = halfW(t);
    for (const side of [1, -1]) {
      const B = [x, -yf * w * 0.8, side * zf * w];
      const NU = 5, NV = 10;
      s0 = pos.length / 3;
      for (let i = 0; i <= NU; i++) {
        const u = i / NU;
        for (let j = 0; j <= NV; j++) {
          const v = j / NV, psi = a0 + (a1 - a0) * v;
          const lr = len * (0.68 + 0.32 * Math.sin(Math.PI * Math.pow(v, 0.8)));
          vert(B[0] + Math.cos(psi) * lr * u, B[1] - droop * u * u, B[2] + side * Math.sin(psi) * lr * u,
            0, 1, -side * 0.2, p, u, v * 2 - 1, B);
        }
      }
      grid(s0, NU, NV);
    }
  };
  fan(2, 0.42, 0.55, 0.6, 2.0, 2.8, 0.12, 0.02);
  fan(1, 0.73, 0.78, 0.35, 1.72, 2.72, 0.21, 0.03);

  // caudal fin: wide forked fan, laid out so it reads from above
  {
    const NU = 10, NV = 14;
    s0 = pos.length / 3;
    for (let i = 0; i <= NU; i++) {
      const u = i / NU;
      const hw = 0.02 + 0.2 * Math.pow(u, 0.8);
      for (let j = 0; j <= NV; j++) {
        const v = j / NV * 2 - 1, av = Math.abs(v);
        const Lv = 0.37 * (0.64 + 0.36 * Math.pow(av, 1.35));
        const lobe = 1 - 0.18 * Math.pow(u, 3) * Math.pow(av, 5);
        vert(X0 + 0.03 - u * Lv, 0.004 - 0.012 * u, v * hw * lobe, 0, 1, 0, 4, u, v);
      }
    }
    grid(s0, NU, NV);
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('aPart', new THREE.Float32BufferAttribute(part, 1));
  g.setAttribute('aFin', new THREE.Float32BufferAttribute(fin, 2));
  g.setAttribute('aBase', new THREE.Float32BufferAttribute(base, 3));
  g.setIndex(idx);
  BASE_GEO = g;
  return g;
}

const KOI_VS = /* glsl */`
attribute float aPart;
attribute vec2 aFin;
attribute vec3 aBase;
attribute vec4 iAnim;   // x tail phase, y wave amplitude, z turn curvature, w fin phase
attribute vec4 iLook;   // x variety, y seed, z depth 0..1, w opacity
attribute vec4 iExtra;  // x fin fold 0..1
uniform float uTime;
varying vec3 vLocal;
varying vec3 vNrm;
varying vec3 vWorld;
varying vec2 vFin;
varying float vPart;
varying vec4 vLook;
varying vec3 vBase;

float spine(float x){
  float s = clamp(0.5 - x, 0.0, 1.45);
  return iAnim.y*(0.12 + 1.05*s*s)*sin(6.2*s - iAnim.x) + iAnim.z*0.5*s*s;
}
vec2 rot2(vec2 v, float a){ float c = cos(a), s = sin(a); return vec2(c*v.x - s*v.y, s*v.x + c*v.y); }

void main(){
  vec3 p = position;
  vec3 n = normal;
  if (aPart > 0.5 && aPart < 2.5){
    float side = aBase.z >= 0.0 ? 1.0 : -1.0;
    float big = aPart < 1.5 ? 1.0 : 0.65;
    float sweep = (0.32*sin(iAnim.w + side*0.8) + 0.6*iExtra.x - 0.08)*big;
    vec3 o = p - aBase;
    o.xz = rot2(o.xz, sweep*side);
    o.y += aFin.x*0.03*sin(iAnim.w + aFin.y*1.3 + side)*big;
    o.y += aFin.x*aFin.x*0.012*sin(aFin.y*4.0 - iAnim.w*1.7);
    p = aBase + o;
    n.xz = rot2(n.xz, sweep*side);
  } else if (aPart > 2.5 && aPart < 3.5){
    p.z += aFin.y*0.008*sin(aFin.x*9.0 - iAnim.x*1.3);
  } else if (aPart > 3.5 && aPart < 4.5){
    float u = aFin.x;
    p.z += u*u*0.035*sin(u*4.5 - iAnim.x - 1.4)*(0.4 + 8.0*iAnim.y);
    p.y += u*0.012*sin(aFin.y*2.2 + iAnim.x*0.7);
  }
  float z0 = spine(p.x);
  float sl = (spine(p.x + 0.01) - spine(p.x - 0.01))*50.0;
  p.z += z0;
  n.x -= sl*n.z;
  n = normalize(n);
#ifdef USE_INSTANCING
  mat4 m = modelMatrix*instanceMatrix;
#else
  mat4 m = modelMatrix;
#endif
  vec4 wp = m*vec4(p, 1.0);
  vWorld = wp.xyz;
  vNrm = normalize(mat3(m)*n);
  vLocal = position;
  vFin = aFin;
  vPart = aPart;
  vLook = iLook;
  vBase = aBase;
  gl_Position = projectionMatrix*viewMatrix*wp;
}
`;

const KOI_FS = /* glsl */`
uniform sampler2D uCaustic;
uniform vec3 uSunDir;
uniform float uRain;
uniform float uAir;
varying vec3 vLocal;
varying vec3 vNrm;
varying vec3 vWorld;
varying vec2 vFin;
varying float vPart;
varying vec4 vLook;
varying vec3 vBase;

const vec3 SNOW = vec3(0.97, 0.96, 0.93);
const vec3 HI = vec3(0.86, 0.16, 0.06);
const vec3 SUMI = vec3(0.045, 0.045, 0.055);

vec3 skin(vec3 lp, float arc, float v, float seed, out float metal){
  metal = 0.0;
  vec2 q = vec2(lp.x*4.2, arc*5.0) + vec2(seed*17.3, seed*7.9);
  float belly = smoothstep(0.004, -0.04, lp.y);
  float nose = smoothstep(0.42, 0.49, lp.x);
  float root = smoothstep(-0.26, -0.4, lp.x);
  if (v < 0.5){
    float n = fbm(q) + 0.3*(vnoise(q*2.6) - 0.5);
    float red = smoothstep(0.46, 0.5, n + 0.03 - 0.5*belly - 0.4*nose - 0.25*root);
    return mix(SNOW, HI, red);
  } else if (v < 1.5){
    float nr = fbm(q + 5.0) + 0.25*(vnoise(q*2.3 + 2.0) - 0.5);
    float nb = fbm(q*1.2 + 23.0) + 0.3*(vnoise(q*3.1 + 9.0) - 0.5);
    float red = smoothstep(0.46, 0.5, nr + 0.03 - 0.5*belly - 0.25*nose);
    float blk = smoothstep(0.47, 0.51, nb + 0.05 + 0.06*belly);
    float band = smoothstep(0.55, 0.62, vnoise(vec2(lp.x*9.0 + seed*3.0, arc*2.0)))*smoothstep(0.34, 0.2, lp.x);
    return mix(mix(SNOW, HI, red), SUMI, max(blk, band*0.9));
  } else if (v < 2.5){
    metal = 1.0;
    return mix(vec3(0.82, 0.46, 0.07), vec3(1.0, 0.72, 0.2), smoothstep(-0.03, 0.05, lp.y))*(0.94 + 0.12*vnoise(q*3.0));
  }
  metal = 1.0;
  return mix(vec3(0.7, 0.73, 0.75), vec3(0.95, 0.96, 0.95), smoothstep(-0.03, 0.05, lp.y))*(0.96 + 0.08*vnoise(q*3.0));
}

void main(){
  float v = vLook.x, seed = vLook.y, depth = vLook.z;
  float part = vPart;
  vec3 lp = vLocal;
  float metal = 0.0, alpha = 1.0, sparkle = 0.0;
  float isBody = part < 0.5 ? 1.0 : 0.0;
  vec3 base;
  vec3 N = normalize(vNrm);
  if (part < 0.5){
    float arc = vFin.x;
    base = skin(lp, arc, v, seed, metal);
    vec2 sc = vec2(lp.x*38.0, arc*38.0);
    float row = floor(sc.x);
    sc.y += 0.5*mod(row, 2.0);
    vec2 f = fract(sc) - 0.5;
    float rim = smoothstep(0.34, 0.52, length(f + vec2(0.18, 0.0)));
    float scaleMask = smoothstep(0.38, 0.33, lp.x)*smoothstep(-0.44, -0.36, lp.x);
    float h = hash12(vec2(row, floor(sc.y)) + seed*31.0);
    base *= 1.0 - rim*scaleMask*mix(0.12, 0.24, metal);
    base *= 1.0 + (h - 0.5)*0.08*scaleMask;
    sparkle = scaleMask*step(0.55, h)*(1.0 - rim);
    base *= 1.0 - 0.3*smoothstep(0.47, 0.5, lp.x)*smoothstep(0.0, -0.02, lp.y);
  } else if (part > 4.5){
    vec3 e = normalize(lp - vBase);
    float side = vBase.z >= 0.0 ? 1.0 : -1.0;
    float c = dot(e, normalize(vec3(0.25, 0.55, side)));
    base = mix(vec3(0.8, 0.68, 0.42), vec3(0.012), smoothstep(0.6, 0.72, c));
    base *= mix(0.55, 1.0, smoothstep(-0.2, 0.3, c));
  } else {
    if (N.y < 0.0) N = -N;
    if (v < 0.5) base = vec3(0.96, 0.94, 0.9);
    else if (v < 1.5){
      base = vec3(0.95, 0.93, 0.9);
      if (part < 1.5) base = mix(SUMI, base, smoothstep(0.22, 0.5, vFin.x));
      if (part > 3.5) base = mix(base, SUMI, 0.55*smoothstep(0.55, 0.7, vnoise(vFin*vec2(3.0, 5.0) + seed*9.0)));
    } else if (v < 2.5){ base = vec3(1.0, 0.8, 0.34); metal = 0.7; }
    else { base = vec3(0.95, 0.96, 0.95); metal = 0.7; }
    float nRays = part > 3.5 ? 9.0 : 5.0;
    float rays = pow(abs(sin(vFin.y*3.14159*nRays)), 8.0);
    if (part > 2.5 && part < 3.5) rays = pow(abs(sin(vFin.x*3.14159*9.0)), 8.0);
    base *= 1.0 - 0.14*rays*smoothstep(0.1, 0.4, vFin.x);
    base = mix(base, base*1.06 + 0.03, smoothstep(0.6, 1.0, vFin.x));
    if (part > 2.5 && part < 3.5) alpha = mix(0.85, 0.3, vFin.y);
    else alpha = mix(0.92, 0.42, smoothstep(0.15, 1.0, vFin.x))*smoothstep(1.0, 0.78, abs(vFin.y));
  }

  vec3 L = uSunDir;
  float ndl = dot(N, L);
  float wrap = max((ndl + 0.45)/1.45, 0.0);
  vec3 Hh = normalize(L + vec3(0.0, 1.0, 0.0));
  float nh = max(dot(N, Hh), 0.0);
  float edge = pow(1.0 - clamp(N.y, 0.0, 1.0), 2.0);
  float sunAmt = 1.0 - 0.6*uRain;
  vec3 col = base*(0.36 + 0.74*wrap*sunAmt);
  col *= 1.0 - 0.38*edge*isBody;
  vec3 env = mix(vec3(0.12, 0.3, 0.32), vec3(0.95, 1.0, 1.0), smoothstep(0.15, 1.0, N.y));
  col = mix(col, base*env*1.3, metal*0.5);
  float sp = pow(nh, 56.0)*(0.22 + 1.1*metal + 0.9*sparkle*metal) + pow(nh, 9.0)*0.1*metal;
  if (part > 4.5) sp = pow(nh, 90.0)*2.2 + pow(nh, 20.0)*0.2;
  col += sp*mix(vec3(1.0, 0.98, 0.92), base, metal*0.35)*sunAmt;
  if (v > 2.5) col += vec3(0.05, 0.03, 0.08)*edge*isBody;
  else if (v > 1.5) col *= vec3(1.08, 0.97, 0.8);

  float under = 1.0 - uAir;
  vec2 cu = vWorld.xz/3.4, cu2 = vWorld.xz/5.6 + vec2(0.37, 0.61);
  vec2 cd = vec2(0.003, 0.002);
  vec3 caus = vec3(
    causC(texture2D(uCaustic, cu + cd).rg)*0.75 + causC(texture2D(uCaustic, cu2 + cd).rg)*0.6,
    causC(texture2D(uCaustic, cu).rg)*0.75 + causC(texture2D(uCaustic, cu2).rg)*0.6,
    causC(texture2D(uCaustic, cu - cd).rg)*0.75 + causC(texture2D(uCaustic, cu2 - cd).rg)*0.6);
  float can = canopy(vWorld.xz);
  col += base*caus*0.95*smoothstep(0.1, 0.9, N.y)*under*sunAmt*(1.0 - 0.75*can)*(1.0 - 0.45*depth);
  col *= 1.0 - 0.32*can*under;
  // water between the fish and the eye: gentle red loss and a veil of teal, hues stay readable
  float d = (0.12 + depth*0.8)*under;
  col *= exp(-d*vec3(0.52, 0.2, 0.16));
  col = mix(col, vec3(0.06, 0.38, 0.42)*(0.78 + 0.22*sunAmt), 1.0 - exp(-d*0.62));
  gl_FragColor = vec4(col, alpha*vLook.w);
}
`;

function koiMaterial(U, air) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: U.uTime, uHalf: U.uHalf, uPond: U.uPond, uPondR: U.uPondR,
      uSunDir: U.uSunDir, uCaustic: U.uCaustic, uCanopyTex: U.uCanopyTex, uRain: U.uRain, uAir: { value: air ? 1 : 0 },
    },
    vertexShader: KOI_VS, fragmentShader: COMMON + CANOPY + KOI_FS,
    transparent: true, side: THREE.DoubleSide, depthWrite: true, depthTest: true,
  });
}

// A pool of instanced koi. Each frame: begin(), push() per fish (sorted deep → shallow), end().
export class KoiInstances {
  constructor(U, max, air = false) {
    const geo = buildGeometry().clone();
    this.max = max;
    const mk = (name) => {
      const a = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4);
      a.setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute(name, a);
      return a;
    };
    this.anim = mk('iAnim'); this.look = mk('iLook'); this.extra = mk('iExtra');
    this.mesh = new THREE.InstancedMesh(geo, koiMaterial(U, air), max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.n = 0;
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._q2 = new THREE.Quaternion();
    this._p = new THREE.Vector3(); this._s = new THREE.Vector3();
    this._e = new THREE.Euler(0, 0, 0, 'YZX');
  }
  begin() { this.n = 0; }
  push(x, y, z, heading, scale, roll, pitch, a, l, e) {
    if (this.n >= this.max) return;
    const i = this.n++;
    this._e.set(roll, -heading, pitch, 'YZX');
    this._q.setFromEuler(this._e);
    this._m.compose(this._p.set(x, y, z), this._q, this._s.set(scale, scale, scale));
    this.mesh.setMatrixAt(i, this._m);
    this.anim.array.set(a, i * 4); this.look.array.set(l, i * 4); this.extra.array.set(e, i * 4);
  }
  end() {
    this.mesh.count = this.n;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.anim.needsUpdate = true; this.look.needsUpdate = true; this.extra.needsUpdate = true;
  }
}

const SH_VS = /* glsl */`
attribute vec4 iShadow;
varying vec2 vP;
varying vec2 vS;
void main(){
  vP = position.xz; vS = iShadow.xy;
#ifdef USE_INSTANCING
  vec4 wp = modelMatrix*instanceMatrix*vec4(position, 1.0);
#else
  vec4 wp = modelMatrix*vec4(position, 1.0);
#endif
  gl_Position = projectionMatrix*viewMatrix*wp;
}
`;
const SH_FS = /* glsl */`
varying vec2 vP;
varying vec2 vS;
void main(){
  vec2 p = vP;
  p.y *= 1.0 + 0.9*smoothstep(0.1, -1.0, p.x);
  float d = length(p);
  float a = (1.0 - smoothstep(1.0 - vS.x, 1.0, d))*vS.y;
  gl_FragColor = vec4(0.0, 0.045, 0.055, a);
}
`;

// Soft elongated shadows (on the pond floor for swimming koi, on the water for falling ones).
export class ShadowInstances {
  constructor(max) {
    const geo = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
    this.attr = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4);
    this.attr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('iShadow', this.attr);
    this.mesh = new THREE.InstancedMesh(geo, new THREE.ShaderMaterial({
      vertexShader: SH_VS, fragmentShader: SH_FS, transparent: true, depthWrite: false, depthTest: false,
    }), max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.max = max; this.n = 0;
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._p = new THREE.Vector3(); this._s = new THREE.Vector3();
    this._up = new THREE.Vector3(0, 1, 0);
  }
  begin() { this.n = 0; }
  push(x, y, z, heading, len, wid, soft, alpha) {
    if (this.n >= this.max) return;
    const i = this.n++;
    this._q.setFromAxisAngle(this._up, -heading);
    this._m.compose(this._p.set(x, y, z), this._q, this._s.set(len, 1, wid));
    this.mesh.setMatrixAt(i, this._m);
    this.attr.array[i * 4] = soft; this.attr.array[i * 4 + 1] = alpha;
  }
  end() { this.mesh.count = this.n; this.mesh.instanceMatrix.needsUpdate = true; this.attr.needsUpdate = true; }
}

// ---------- 2D previews for the cards and the drag ghost ----------
function rng(seed) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

export function drawKoi2D(ctx, W, H, variety, t = 0, seed = 3) {
  ctx.save();
  ctx.clearRect(0, 0, W, H);
  const k = Math.min(W / 1.45, H / 0.6);
  const cx = W * 0.5 + 0.15 * k, cy = H * 0.5;
  const A = 0.045, ph = t * 5.2;
  const sz = (x) => { const s = Math.max(0, Math.min(1.45, 0.5 - x)); return A * (0.12 + 1.05 * s * s) * Math.sin(6.2 * s - ph); };
  const P = (x, z) => [cx + x * k, cy + (z + sz(x)) * k];
  const R = rng(seed + variety * 101);

  const glow = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.5);
  glow.addColorStop(0, 'rgba(140, 235, 230, 0.2)');
  glow.addColorStop(1, 'rgba(140, 235, 230, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  const metal = variety >= 2;
  const finCol = variety === 2 ? 'rgba(255, 206, 110, 0.62)' : 'rgba(250, 248, 242, 0.6)';
  const rayCol = variety === 2 ? 'rgba(170, 110, 20, 0.35)' : 'rgba(120, 130, 135, 0.28)';
  ctx.lineJoin = 'round';

  const fan = (t0, zf, a0, a1, len, dark) => {
    const x = X0 + t0 * BL, w = halfW(t0);
    for (const side of [1, -1]) {
      const bz = side * zf * w;
      const pts = [];
      for (let i = 0; i <= 14; i++) {
        const v = i / 14, psi = a0 + (a1 - a0) * v;
        const lr = len * (0.68 + 0.32 * Math.sin(Math.PI * Math.pow(v, 0.8)));
        pts.push(P(x + Math.cos(psi) * lr, bz + side * Math.sin(psi) * lr));
      }
      const b = P(x, bz);
      ctx.beginPath(); ctx.moveTo(b[0], b[1]);
      pts.forEach((q) => ctx.lineTo(q[0], q[1]));
      ctx.closePath();
      ctx.fillStyle = finCol; ctx.fill();
      if (dark) {
        const g = ctx.createRadialGradient(b[0], b[1], 0, b[0], b[1], len * k * 0.6);
        g.addColorStop(0, 'rgba(15, 15, 18, 0.85)'); g.addColorStop(1, 'rgba(15, 15, 18, 0)');
        ctx.fillStyle = g; ctx.fill();
      }
      ctx.strokeStyle = rayCol; ctx.lineWidth = Math.max(0.6, k * 0.0035);
      for (let i = 1; i < 14; i += 2) { ctx.beginPath(); ctx.moveTo(b[0], b[1]); ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke(); }
    }
  };

  // tail
  {
    const Lv = (v) => 0.37 * (0.64 + 0.36 * Math.pow(Math.abs(v), 1.35));
    const hw = (u) => 0.02 + 0.2 * Math.pow(u, 0.8);
    const X = (u, v) => X0 + 0.03 - u * Lv(v);
    const pts = [];
    for (let i = 0; i <= 10; i++) { const u = i / 10; pts.push(P(X(u, -1), -hw(u))); }
    for (let i = 0; i <= 20; i++) { const v = -1 + i / 10; pts.push(P(X(1, v), v * hw(1) * (1 - 0.18 * Math.pow(Math.abs(v), 5)))); }
    for (let i = 10; i >= 0; i--) { const u = i / 10; pts.push(P(X(u, 1), hw(u))); }
    ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.closePath();
    ctx.fillStyle = finCol; ctx.fill();
    ctx.strokeStyle = rayCol; ctx.lineWidth = Math.max(0.6, k * 0.0035);
    for (let i = -8; i <= 8; i += 2) {
      const v = i / 9; const a = P(X(0.05, v), v * hw(0.05)); const b = P(X(0.97, v), v * hw(0.97));
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    }
  }
  fan(0.42, 0.55, 2.0, 2.8, 0.12, false);
  fan(0.73, 0.78, 1.72, 2.72, 0.21, variety === 1);

  // body outline
  const body = new Path2D();
  const N = 44;
  for (let i = 0; i <= N; i++) { const tt = i / N; const q = P(X0 + tt * BL, -halfW(tt)); i ? body.lineTo(q[0], q[1]) : body.moveTo(q[0], q[1]); }
  for (let i = N; i >= 0; i--) { const tt = i / N; const q = P(X0 + tt * BL, halfW(tt)); body.lineTo(q[0], q[1]); }
  body.closePath();

  const lg = ctx.createLinearGradient(0, cy - 0.12 * k, 0, cy + 0.12 * k);
  if (variety === 0) { ctx.fillStyle = '#f6f3ec'; }
  else if (variety === 1) { ctx.fillStyle = '#131316'; }
  else if (variety === 2) { lg.addColorStop(0, '#b57612'); lg.addColorStop(0.5, '#ffd55e'); lg.addColorStop(1, '#b57612'); ctx.fillStyle = lg; }
  else { lg.addColorStop(0, '#9da5a9'); lg.addColorStop(0.5, '#fafbf9'); lg.addColorStop(1, '#9da5a9'); ctx.fillStyle = lg; }
  ctx.fill(body);

  ctx.save();
  ctx.clip(body);
  const blob = (x, z, rx, rz, col) => { const q = P(x, z); ctx.beginPath(); ctx.ellipse(q[0], q[1], rx * k, rz * k, 0, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill(); };
  if (variety === 0) {
    const n = 3 + Math.floor(R() * 2);
    for (let i = 0; i < n; i++) blob(0.34 - i * (0.62 / n) - R() * 0.05, (R() - 0.5) * 0.05, 0.07 + R() * 0.06, 0.07 + R() * 0.05, '#d4301a');
  } else if (variety === 1) {
    for (let i = 0; i < 3; i++) blob(0.3 - i * 0.24 + R() * 0.05, (R() - 0.5) * 0.08, 0.08 + R() * 0.04, 0.065 + R() * 0.03, '#cc2e17');
    for (let i = 0; i < 3; i++) blob(0.22 - i * 0.26 + R() * 0.06, (R() - 0.5) * 0.12, 0.05 + R() * 0.04, 0.045, '#f3efe7');
    for (let i = 0; i < 2; i++) blob(0.12 - i * 0.3 + R() * 0.05, (R() - 0.5) * 0.1, 0.05, 0.05, '#131316');
  }
  // scales
  ctx.strokeStyle = metal ? 'rgba(255, 255, 255, 0.28)' : 'rgba(0, 0, 0, 0.1)';
  ctx.lineWidth = Math.max(0.5, k * 0.0035);
  const sp = 0.034;
  for (let x = -0.4; x < 0.34; x += sp) {
    for (let z = -0.14; z < 0.14; z += sp) {
      const off = (Math.round((x + 0.4) / sp) % 2) * sp * 0.5;
      const q = P(x, z + off);
      ctx.beginPath(); ctx.arc(q[0], q[1], sp * k * 0.62, Math.PI * 0.55, Math.PI * 1.45); ctx.stroke();
    }
  }
  // roundness shading and a soft back highlight
  const sh = ctx.createLinearGradient(0, cy - 0.13 * k, 0, cy + 0.13 * k);
  sh.addColorStop(0, 'rgba(0, 30, 40, 0.42)'); sh.addColorStop(0.36, 'rgba(0, 30, 40, 0)');
  sh.addColorStop(0.64, 'rgba(0, 30, 40, 0)'); sh.addColorStop(1, 'rgba(0, 30, 40, 0.42)');
  ctx.fillStyle = sh; ctx.fill(body);
  ctx.beginPath();
  for (let i = 0; i <= 20; i++) { const x = -0.3 + i * 0.036; const q = P(x, -0.012); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }
  ctx.strokeStyle = metal ? 'rgba(255, 255, 250, 0.55)' : 'rgba(255, 255, 255, 0.28)';
  ctx.lineWidth = k * 0.026; ctx.lineCap = 'round'; ctx.stroke();
  ctx.restore();

  // eyes
  const te = (0.405 - X0) / BL, we = halfW(te);
  for (const side of [1, -1]) {
    const q = P(0.405, side * we * 0.9);
    ctx.beginPath(); ctx.arc(q[0], q[1], k * 0.02, 0, Math.PI * 2); ctx.fillStyle = '#0c0c0e'; ctx.fill();
    ctx.beginPath(); ctx.arc(q[0] + k * 0.006, q[1] - k * 0.006, k * 0.006, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fill();
  }
  ctx.restore();
}
