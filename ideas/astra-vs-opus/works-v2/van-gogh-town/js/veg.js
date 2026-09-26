import * as THREE from 'three';
import { COMMON, STROKE, LIGHT_UNIFORMS, LIGHT_FN } from './shaders.js';
import { hex, rng } from './builder.js';
import { H, wheatMask, pathDist, townMask, HILL, WATER_Y } from './terrain.js';

// ------------------------------------------------------------------ brush-stroke sprites
const SPRITE_VERT = /* glsl */ `
${COMMON}
${LIGHT_UNIFORMS}
${LIGHT_FN}
attribute vec3 iPos; attribute vec4 iSize; attribute vec3 iCol; attribute float iPhase; attribute float iLat;
varying vec3 vCol; varying vec2 vUv; varying vec3 vW; varying float vSeed;
void main(){
  vec3 toCam = cameraPosition - iPos; toCam.y = 0.0;
  float l = length(toCam);
  vec3 fwd = l > 1e-4 ? toCam / l : vec3(0.0, 0.0, 1.0);
  vec3 right = vec3(fwd.z, 0.0, -fwd.x);
  float ca = cos(iSize.z), sa = sin(iSize.z);
  vec2 lp = vec2(position.x * iSize.x, position.y * iSize.y);
  lp = vec2(lp.x * ca - lp.y * sa, lp.x * sa + lp.y * ca);
  float sway = sin(uTime * 1.6 + iPhase + iPos.x * 0.15 + iPos.z * 0.11) * iSize.w * position.y * position.y;
  sway += sin(uTime * 3.1 + iPhase * 2.0) * iSize.w * 0.25 * position.y;
  vec3 w = iPos + right * (lp.x + sway + iLat) + vec3(0.0, lp.y, 0.0);
  if (fract(iPhase * 0.6180339) > uReveal * 1.1) w = iPos;
  vec3 n = normalize(vec3(0.0, 0.75, 0.0) + fwd * 0.5);
  vCol = shade(iCol, iPos + vec3(0.0, iSize.y * 0.5, 0.0), n);
  vUv = vec2(position.x * 2.0, position.y); vW = w; vSeed = iPhase;
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
}
`;
const SPRITE_FRAG = /* glsl */ `
${LIGHT_UNIFORMS}
${LIGHT_FN}
varying vec3 vCol; varying vec2 vUv; varying vec3 vW; varying float vSeed;
void main(){
  float v = clamp(vUv.y, 0.0, 1.0);
  float w = pow(sin(3.14159 * v), 0.45) * (0.86 + 0.14 * sin(v * 6.0 + vSeed));
  if (abs(vUv.x) > w) discard;
  float y = vUv.x / max(w, 1e-3);
  float ridge = 1.0 - y * y;
  float br = 0.5 + 0.5 * sin(y * 7.0 + vSeed * 13.0);
  vec3 c = vCol * (0.8 + 0.24 * ridge + (br - 0.5) * 0.2 + (v - 0.5) * 0.14);
  c = applyFog(c, vW);
  gl_FragColor = vec4(c, 1.0);
}
`;

function makeSprites(list, uniforms) {
  const base = new THREE.PlaneGeometry(1, 1); base.translate(0, 0.5, 0);
  const g = new THREE.InstancedBufferGeometry();
  g.index = base.index; g.setAttribute('position', base.attributes.position);
  const n = list.length;
  const pos = new Float32Array(n * 3), size = new Float32Array(n * 4), col = new Float32Array(n * 3), ph = new Float32Array(n), lat = new Float32Array(n);
  list.forEach((s, i) => { pos.set(s.p, i * 3); size.set(s.s, i * 4); col.set(s.c, i * 3); ph[i] = s.ph; lat[i] = s.lat || 0; });
  g.setAttribute('iLat', new THREE.InstancedBufferAttribute(lat, 1));
  g.setAttribute('iPos', new THREE.InstancedBufferAttribute(pos, 3));
  g.setAttribute('iSize', new THREE.InstancedBufferAttribute(size, 4));
  g.setAttribute('iCol', new THREE.InstancedBufferAttribute(col, 3));
  g.setAttribute('iPhase', new THREE.InstancedBufferAttribute(ph, 1));
  g.instanceCount = n;
  const m = new THREE.ShaderMaterial({ uniforms, vertexShader: SPRITE_VERT, fragmentShader: SPRITE_FRAG, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(g, m);
  mesh.frustumCulled = false;
  return mesh;
}

const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
const jitterCol = (r, h, k = 0.08) => { const c = hex(h); return c.map((v) => Math.max(0, v * (1 - k + 2 * k * r()))); };

export function buildVegetation(uniforms, quality, people = []) {
  const r = rng(11);
  const list = [];
  const segs = [];
  const Q = quality;

  // ---- wheat
  const WHEAT = ['#e8c050', '#d8a032', '#f0d470', '#c47c2a', '#e0b040', '#eacb62', '#d49a36', '#b8742a'];
  const nW = Math.round(64000 * Q);
  let tries = 0, got = 0;
  while (got < nW && tries < nW * 12) {
    tries++;
    const x = -48 - r() * 116, z = -118 + r() * 184;
    const m = wheatMask(x, z); if (m < 0.2) continue;
    const pd = pathDist(x, z); if (pd < 0.35) continue;
    const dv = Math.hypot(x + 49, z + 8);
    const dens = 0.1 + 0.9 * Math.exp(-dv / 22);
    if (r() > dens * m) continue;
    got++;
    const nearPath = pd < 1.4;
    const c = nearPath && r() < 0.6 ? jitterCol(r, pick(r, ['#5a9a3a', '#7aa844', '#3f7a3a', '#9ab84a'])) : jitterCol(r, pick(r, WHEAT));
    const hgt = (nearPath ? 0.45 : 0.8) + r() * 0.5;
    list.push({ p: [x, H(x, z) - 0.05, z], s: [0.09 + r() * 0.07, hgt, (r() - 0.5) * 0.55 - 0.12, 0.1 + r() * 0.08], c, ph: r() * 100 });
  }

  // ---- meadow / bank grass tufts
  const GRASS = ['#4f8a3a', '#6a9e44', '#8ab04c', '#3a6a4a', '#5a8a5a', '#a0b858'];
  const nG = Math.round(14000 * Q);
  got = 0; tries = 0;
  while (got < nG && tries < nG * 20) {
    tries++;
    const x = -150 + r() * 240, z = -140 + r() * 270;
    if (townMask(x, z) > 0.2 && !(x > 76)) continue;
    if (wheatMask(x, z) > 0.3) continue;
    if (x > 87.4 && x < 131) continue;
    if (x > 76 && x < 82) continue;
    const rr = Math.hypot(x, z); if (rr > 175) continue;
    const dh = Math.hypot(x - HILL.x, z - HILL.z);
    const near = Math.max(Math.exp(-dh / 30), x > 80 ? 0.9 : 0);
    if (Math.hypot(x + 49, z + 8) < 9) continue;
    if (r() > 0.18 + near) continue;
    got++;
    let c;
    if (x > 80 && r() < 0.25) c = jitterCol(r, pick(r, ['#d8a0a8', '#c890b0', '#e8c0b0']));
    else if (dh < 40) c = jitterCol(r, pick(r, ['#2f5a4e', '#3f6e5a', '#4e7e5e', '#2a4a5e', '#5a8a5a']));
    else c = jitterCol(r, pick(r, GRASS));
    const hgt = 0.28 + r() * 0.4;
    list.push({ p: [x, H(x, z) - 0.04, z], s: [0.08 + r() * 0.05, hgt, (r() - 0.5) * 0.9, 0.06], c, ph: r() * 100 });
  }

  // ---- cypress: a flame of dark green strokes
  function cypress(cx, cz, Ht, R, n) {
    const y0 = H(cx, cz) - 0.3;
    const COL = ['#142214', '#2a4422', '#40602a', '#3a2c18', '#62702c', '#223a22', '#7a8a3a', '#0c140c'];
    for (let i = 0; i < n; i++) {
      const t = Math.pow(r(), 0.85);
      const rad = R * (t < 0.22 ? 0.72 + 1.3 * t : Math.pow(1 - t, 0.8) * 1.23) * (0.55 + 0.5 * Math.sqrt(r()));
      const th = r() * Math.PI * 2;
      const x = cx + Math.cos(th) * rad, z = cz + Math.sin(th) * rad;
      const roll = 0.42 * Math.sin(t * 11 + th * 2) + (r() - 0.5) * 0.35;
      const light = Math.cos(th - 0.8) * 0.5 + 0.5;
      const ci = Math.min(COL.length - 1, Math.floor(r() * 5 + light * 3.5));
      list.push({ p: [x, y0 + t * Ht, z], s: [0.24 * (Ht / 14) + r() * 0.1, (1.2 + r() * 1.2) * (Ht / 14), roll, 0.05 + t * 0.12], c: jitterCol(r, COL[ci], 0.1), ph: r() * 100 });
    }
    segs.push([cx - R * 0.6, cz, cx + R * 0.6, cz], [cx, cz - R * 0.6, cx, cz + R * 0.6]);
  }
  cypress(-73.7, 71.9, 17, 2.4, Math.round(4200 * Math.max(0.6, Q)));
  cypress(-60, 58, 9, 1.3, Math.round(1200 * Q));
  cypress(-22, 64, 8, 1.2, Math.round(1000 * Q));
  cypress(-36, 57, 10, 1.3, Math.round(1100 * Q));
  cypress(72, 30, 8, 1.1, Math.round(900 * Q));

  // ---- round trees (plane trees / olives)
  function tree(cx, cz, h, R, pal, n) {
    const y0 = H(cx, cz);
    for (let i = 0; i < 8; i++) list.push({ p: [cx + (r() - 0.5) * 0.25, y0 + i * h * 0.09, cz + (r() - 0.5) * 0.25], s: [0.22, h * 0.22, (r() - 0.5) * 0.3, 0.0], c: jitterCol(r, pick(r, ['#5a3a2a', '#3a2a2a', '#7a5a3a'])), ph: r() * 100 });
    for (let i = 0; i < n; i++) {
      const u = r() * 2 - 1, th = r() * Math.PI * 2, k = Math.sqrt(1 - u * u);
      const rad = 0.55 + 0.45 * Math.cbrt(r());
      const x = cx + Math.cos(th) * k * R * rad, z = cz + Math.sin(th) * k * R * rad, y = y0 + h * 0.62 + u * R * 0.72 * rad;
      const top = (u + 1) / 2;
      const ci = Math.min(pal.length - 1, Math.floor(top * (pal.length - 1) + r() * 1.6));
      const roll = Math.atan2(u, Math.cos(th)) * 0.5 + (r() - 0.5) * 0.6;
      list.push({ p: [x, y - 0.35, z], s: [0.2 + r() * 0.08, 0.6 + r() * 0.45, roll, 0.08], c: jitterCol(r, pal[ci], 0.1), ph: r() * 100 });
    }
    segs.push([cx - 0.3, cz, cx + 0.3, cz]);
  }
  const PLANE = ['#1f3a3a', '#2c5a3a', '#3e7040', '#5a8a3e', '#7aa048', '#a0b858'];
  const OLIVE = ['#3a5a5a', '#4e6e66', '#6a8a70', '#8aa088', '#a8b89a'];
  const nT = Math.round(620 * Math.max(0.5, Q));
  for (const [x, z] of [[35, -5], [35, 3], [44, 4.5], [53, 4.5], [67, -8], [66, 2], [73, -22], [4.7, -13]]) tree(x, z, 7 + r() * 2, 2.6 + r() * 0.8, PLANE, nT);
  for (const [x, z] of [[79, -26], [79, -52]]) tree(x, z, 7, 2.6, PLANE, nT);
  for (const [x, z] of [[-56, 88], [-92, 96], [-50, 70], [-98, 66], [-66, 104], [-44, 92], [-30, 78], [-10, 70], [18, 76], [40, 68], [-86, 112]]) tree(x, z, 4 + r() * 1.5, 2.2 + r() * 0.7, OLIVE, Math.round(nT * 0.7));

  // ---- people, painted as a handful of strokes each (never as mannequins)
  const SKIN = ['#e8b890', '#d8a078', '#f0c8a0'];
  for (const pp of people) {
    const y0 = H(pp.x, pp.z);
    // strokes pivot at their base; recentre strongly rotated ones (hat brims, arms)
    const P = (lat, y, w, h, roll, col, k = 0.08) => list.push({ p: [pp.x, y0 + y, pp.z], s: [w, h, roll, 0], c: jitterCol(r, col, k), ph: r() * 100, lat: lat + 0.5 * h * Math.sin(roll) });
    const coat = pp.c, dark = '#1a1e36';
    if (pp.seated) {
      P(-0.08, 0.05, 0.12, 0.45, 0, dark); P(0.08, 0.05, 0.12, 0.45, 0, dark);
      for (let i = 0; i < 4; i++) P(-0.14 + i * 0.09, 0.42, 0.16, 0.62, (r() - 0.5) * 0.15, coat);
      P(-0.22, 0.55, 0.1, 0.42, 0.25, coat); P(0.22, 0.55, 0.1, 0.42, -0.25, coat);
      P(0, 1.0, 0.2, 0.26, 0, pick(r, SKIN)); P(0.02, 1.02, 0.12, 0.2, 0.3, pick(r, SKIN));
      P(0, 1.21, 0.09, 0.36, 1.52, dark); P(0, 1.23, 0.18, 0.16, 0, dark);
    } else if (pp.dress) {
      for (let i = 0; i < 7; i++) { const l = -0.27 + i * 0.09; P(l * 0.5, 0.02, 0.17, 1.0, l * 0.7, coat); }
      for (let i = 0; i < 3; i++) P(-0.09 + i * 0.09, 0.9, 0.15, 0.5, 0, coat);
      P(0, 1.36, 0.2, 0.27, 0, pick(r, SKIN));
      P(0, 1.5, 0.12, 0.52, 1.52, '#e8d070'); P(0, 1.55, 0.2, 0.14, 0, '#e8d070');
    } else {
      P(-0.08, 0, 0.13, 0.85, 0.03, dark); P(0.08, 0, 0.13, 0.85, -0.03, dark);
      for (let i = 0; i < 5; i++) P(-0.16 + i * 0.08, 0.68, 0.16, 0.78, (r() - 0.5) * 0.12, coat);
      if (pp.apron) for (let i = 0; i < 3; i++) P(-0.08 + i * 0.08, 0.35, 0.14, 0.75, 0, '#f4efe0', 0.03);
      P(-0.25, 0.82, 0.1, 0.58, 0.12, coat); P(0.25, 0.82, 0.1, 0.58, -0.12, coat);
      P(0, 1.42, 0.2, 0.28, 0, pick(r, SKIN)); P(0.03, 1.44, 0.12, 0.22, 0.3, pick(r, SKIN));
      P(0, 1.63, 0.1, 0.4, 1.52, dark); P(0, 1.66, 0.19, 0.18, 0, dark);
    }
  }

  const mesh = makeSprites(list, uniforms);
  return { mesh, segs, count: list.length };
}

// ------------------------------------------------------------------ lamp haloes (concentric strokes)
const HALO_VERT = /* glsl */ `
attribute vec3 iPos; attribute float iSize; attribute float iSeed;
varying vec2 vUv; varying float vSeed;
void main(){
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec3 toCam = normalize(cameraPosition - iPos);
  vec3 w = iPos + (right * position.x + up * position.y) * iSize * 2.0 + toCam * min(iSize * 1.1, length(cameraPosition - iPos) * 0.5);
  vUv = position.xy * 2.0; vSeed = iSeed;
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
}
`;
const HALO_FRAG = /* glsl */ `
${COMMON}
uniform float uLampK; uniform float uTime; uniform float uReveal;
varying vec2 vUv; varying float vSeed;
void main(){
  float r = length(vUv);
  if (r > 1.0) discard;
  float th = atan(vUv.y, vUv.x);
  float rr = r * 4.2;
  float band = floor(rr); float fr = fract(rr);
  float segs = 5.0 + band * 5.0;
  float dirn = mod(band, 2.0) * 2.0 - 1.0;
  float s = (th / 6.2832 + 0.5) * segs + hash12(vec2(band, vSeed)) * 3.0 + uTime * 0.04 * dirn;
  float si = floor(s); float sf = fract(s);
  vec4 h = hash42(vec2(si + band * 31.0, vSeed));
  float dash = smoothstep(0.0, 0.12, sf) * smoothstep(1.0, 0.72 - h.x * 0.25, sf);
  float wid = smoothstep(0.08, 0.3, fr) * smoothstep(0.98, 0.7, fr);
  vec3 col = band < 1.0 ? vec3(1.0, 0.97, 0.78) : band < 2.0 ? vec3(1.0, 0.86, 0.38) : band < 3.0 ? vec3(0.98, 0.7, 0.26) : vec3(0.74, 0.82, 0.44);
  col *= 0.9 + 0.2 * h.y;
  float a = dash * wid * (1.0 - band * 0.17);
  if (r < 0.09) { a = 1.0; col = vec3(1.0, 0.98, 0.86); }
  a *= uLampK * smoothstep(0.55, 1.0, uReveal);
  if (a < 0.03) discard;
  gl_FragColor = vec4(col, a);
}
`;

export function buildHalos(lamps, uniforms) {
  const list = lamps.filter((l) => l.halo > 0);
  const base = new THREE.PlaneGeometry(1, 1);
  const g = new THREE.InstancedBufferGeometry();
  g.index = base.index; g.setAttribute('position', base.attributes.position);
  const pos = new Float32Array(list.length * 3), size = new Float32Array(list.length), seed = new Float32Array(list.length);
  list.forEach((l, i) => { pos.set(l.p, i * 3); size[i] = l.halo; seed[i] = i * 7.3; });
  g.setAttribute('iPos', new THREE.InstancedBufferAttribute(pos, 3));
  g.setAttribute('iSize', new THREE.InstancedBufferAttribute(size, 1));
  g.setAttribute('iSeed', new THREE.InstancedBufferAttribute(seed, 1));
  g.instanceCount = list.length;
  const m = new THREE.ShaderMaterial({ uniforms, vertexShader: HALO_VERT, fragmentShader: HALO_FRAG, transparent: true, depthWrite: false });
  const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.renderOrder = 5;
  return mesh;
}

// ------------------------------------------------------------------ crows over the wheat
const CROW_VERT = /* glsl */ `
uniform float uTime;
attribute vec4 iOrbit; attribute vec4 iParam;
varying vec2 vUv; varying float vFlap;
void main(){
  float t = uTime * iParam.x + iParam.y;
  vec3 c = iOrbit.xyz + vec3(cos(t) * iOrbit.w, sin(t * 1.7) * iParam.w, sin(t) * iOrbit.w * 0.55);
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec3 w = c + (right * position.x + up * position.y * 0.6) * iParam.z;
  vUv = position.xy * 2.0; vFlap = sin(uTime * 7.0 + iParam.y * 7.0);
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
}
`;
const CROW_FRAG = /* glsl */ `
varying vec2 vUv; varying float vFlap;
void main(){
  float ax = abs(vUv.x);
  float yc = vFlap * 0.5 * ax + 0.5 * ax * (1.0 - ax) * (0.5 - vFlap * 0.5) - 0.05;
  float th = 0.2 * (1.0 - ax * 0.75);
  float d = abs(vUv.y - yc);
  float body = length(vUv * vec2(1.0, 1.4) - vec2(0.0, -0.05));
  if (d > th && body > 0.2) discard;
  gl_FragColor = vec4(0.07, 0.08, 0.16, 1.0);
}
`;
export function buildCrows(uniforms, n = 26) {
  const r = rng(5);
  const base = new THREE.PlaneGeometry(1, 1);
  const g = new THREE.InstancedBufferGeometry();
  g.index = base.index; g.setAttribute('position', base.attributes.position);
  const orb = new Float32Array(n * 4), par = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const cx = -68 - r() * 40, cz = -26 + r() * 36, cy = 6 + r() * 11;
    orb.set([cx, cy, cz, 3 + r() * 12], i * 4);
    par.set([(0.1 + r() * 0.14) * (r() < 0.5 ? -1 : 1), r() * 100, 1.7 + r() * 0.9, 0.6 + r() * 1.6], i * 4);
  }
  g.setAttribute('iOrbit', new THREE.InstancedBufferAttribute(orb, 4));
  g.setAttribute('iParam', new THREE.InstancedBufferAttribute(par, 4));
  g.instanceCount = n;
  const m = new THREE.ShaderMaterial({ uniforms: { uTime: uniforms.uTime }, vertexShader: CROW_VERT, fragmentShader: CROW_FRAG, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false;
  return mesh;
}

// ------------------------------------------------------------------ the Rhône
const WATER_VERT = /* glsl */ `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
export function buildWater(uniforms, lamps, skyTex) {
  const refl = lamps.filter((l) => l.p[0] > 75).slice(0, 40);
  const NL = Math.max(1, refl.length);
  const WATER_FRAG = /* glsl */ `
${COMMON}
${STROKE}
${LIGHT_UNIFORMS}
${LIGHT_FN}
#define PI 3.14159265
uniform sampler2D tSky; uniform vec3 uRefl[${NL}];
varying vec3 vW;
vec3 waterCol(vec3 p){
  vec3 v = normalize(p - cameraPosition);
  vec3 rd = reflect(v, vec3(0.0, 1.0, 0.0));
  float az = atan(rd.x, -rd.z), el = asin(clamp(rd.y, -1.0, 1.0));
  vec3 sky = texture2D(tSky, vec2(az / (2.0 * PI) + 0.5, el / PI + 0.5)).rgb;
  vec3 deep = mix(vec3(0.07, 0.13, 0.27), vec3(0.12, 0.24, 0.32), 0.5 + 0.5 * sin(p.z * 0.05));
  vec3 c = mix(deep, sky, 0.55);
  vec2 cp = cameraPosition.xz; vec2 pp = p.xz; float dp = length(pp - cp); vec2 dirp = (pp - cp) / max(dp, 1e-3);
  float s = 0.0;
  for (int i = 0; i < ${NL}; i++){
    vec2 dl = uRefl[i].xz - cp; float dL = length(dl); vec2 dirl = dl / max(dL, 1e-3);
    if (dot(dirp, dirl) < 0.0) continue;
    float lat = abs(dirp.x * dirl.y - dirp.y * dirl.x) * dp;
    float t = dp / dL;
    float w = 0.3 + 0.008 * dL;
    s += exp(-lat * lat / (w * w)) * smoothstep(0.1, 0.5, t) * smoothstep(1.02, 0.94, t) * (0.55 + 0.45 * t);
  }
  s = clamp(s, 0.0, 1.0) * uLampK * clamp(1.0 - (cameraPosition.y - 5.0) / 18.0, 0.0, 1.0);
  c = mix(c, mix(vec3(0.98, 0.62, 0.22), vec3(1.0, 0.9, 0.5), s), s * 0.95);
  return c;
}
void main(){
  vec2 P = vec2(vW.x / 2.2, vW.z); float cs = 0.4;
  vec2 Pc = P / cs;
  float fw = sqrt(length(dFdx(Pc)) * length(dFdy(Pc))) * 1.2;
  vec3 base = waterCol(vW) * 0.82;
  vec3 col = base;
  float lod = smoothstep(0.3, 0.7, fw);
  if (lod < 0.999){
    Stroke s = findStroke(Pc, 4.5, 1.5708, 0.12, 0.05, max(fw * 0.75, 0.015), 3.0, 1.0);
    if (s.found > 0.5){
      vec3 cw = vec3(s.center.x * cs * 2.2, vW.y, s.center.y * cs);
      vec3 sc = waterCol(cw) * (0.92 + 0.16 * s.h.x) + (s.h.zwx - 0.5) * 0.05;
      col = mix(base, sc * strokeRelief(s, 1.0), s.cov);
    }
  }
  col = mix(col, waterCol(vW), lod);
  col = applyFog(col, vW);
  gl_FragColor = vec4(col, 1.0);
}
`;
  const u = { ...uniforms, tSky: { value: skyTex }, uRefl: { value: refl.map((l) => new THREE.Vector3(...l.p)) } };
  const m = new THREE.ShaderMaterial({ uniforms: u, vertexShader: WATER_VERT, fragmentShader: WATER_FRAG });
  const g = new THREE.PlaneGeometry(44, 900); g.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(g, m);
  mesh.position.set(109, WATER_Y, 0);
  mesh.frustumCulled = false;
  return mesh;
}
