import * as THREE from 'three';
import { COMMON, STROKE } from './shaders.js';

// The sky is painted in two steps:
//  1. a low-res equirectangular "idea" of the sky (colour field + stroke-direction field),
//     re-rendered only when the atmosphere profile changes;
//  2. the dome shader lays thousands of brush strokes over the sphere, each stroke taking
//     its colour from the field at its centre and its angle from the flow field.

const D2R = Math.PI / 180;
const dirAE = (azDeg, elDeg) => {
  const az = azDeg * D2R, el = elDeg * D2R;
  return new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
};

// az: 0 = north (-z), 90 = east (+x)
const STARS = [
  [-8, 40, 3.0], [2, 20, 2.4], [52, 18, 2.6], [8, 34, 2.2], [-3, 54, 2.6], [33, 48, 2.4], [17, 43, 2.0],
  [74, 17, 2.2], [-22, 24, 2.3], [-33, 46, 2.1], [-55, 30, 2.0], [128, 38, 2.0], [165, 30, 2.2], [-140, 40, 2.2],
];
const DIPPER = [[0, 0], [4.8, 1.4], [9.0, 2.0], [13.2, 1.0], [13.8, -4.6], [20.2, -3.8], [19.8, 1.9]].map(([x, y]) => [80 + x, 21 + y, 1.5]);
const VORTEX = [
  // az, el, radiusDeg, strength, spin, group(0 = starry swirl, 1 = wheat turbulence)
  [22, 27, 13, 1.0, 1, 0], [40, 31, 9, 0.9, -1, 0], [-20, 34, 9, 0.6, 1, 0], [-50, 40, 8, 0.5, -1, 0],
  [-100, 16, 12, 0.7, 1, 1], [-70, 24, 9, 0.6, -1, 1], [-124, 25, 10, 0.6, 1, 1], [-86, 40, 12, 0.5, -1, 1],
];
const MOON = [66, 33, 4.2];

const NS = STARS.length + DIPPER.length;
const NV = VORTEX.length;

const FIELD_COMMON = /* glsl */ `
${COMMON}
#define PI 3.14159265
uniform vec4 uStar[${NS}]; uniform float uStarKind[${NS}];
uniform vec4 uVort[${NV}]; uniform vec4 uVortP[${NV}];
uniform vec4 uMoon;
uniform vec3 uZen; uniform vec3 uHor;
uniform float uSwirl; uniform float uStars; uniform float uMoonK; uniform float uDipper; uniform float uClouds; uniform float uTurb;
varying vec2 vUv;
vec3 dirOf(float az, float el){ return vec3(sin(az)*cos(el), sin(el), -cos(az)*cos(el)); }
float starW(int k){ return uStarKind[k] > 0.5 ? uDipper : uStars; }
float vortW(int k){ return uVortP[k].w > 0.5 ? uTurb : uSwirl; }
`;

const FIELD_VERT = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const COLOR_FRAG = /* glsl */ `
${FIELD_COMMON}
void main(){
  float az = (vUv.x - 0.5) * 2.0 * PI; float el = (vUv.y - 0.5) * PI;
  vec3 d = dirOf(az, el);
  float t = clamp(el / 1.15, 0.0, 1.0);
  vec3 col = mix(uHor, uZen, pow(t, 0.6));
  float n = fbm(vec2(az * 2.2, el * 4.0) + 3.0);
  col *= 0.86 + 0.28 * n;
  // horizontal wavy bands of lighter paint
  float band = sin(el * 34.0 + sin(az * 4.0 + el * 9.0) * 1.8 + n * 4.0);
  col = mix(col, col * 1.25 + vec3(0.02, 0.05, 0.08), smoothstep(0.5, 1.0, band) * 0.4);
  // glow near the horizon (the lighter band above the hills in the night paintings)
  col = mix(col, uHor * 1.25 + vec3(0.05, 0.07, 0.02), smoothstep(0.25, 0.0, el) * 0.35);
  // vortices
  for (int k = 0; k < ${NV}; k++){
    vec3 c = uVort[k].xyz; float R = uVort[k].w;
    float w0 = vortW(k) * uVortP[k].x;
    if (w0 < 0.01) continue;
    float ang = acos(clamp(dot(d, c), -1.0, 1.0));
    float r = ang / R;
    float w = exp(-r * r * 1.1) * w0;
    vec3 e1 = normalize(cross(vec3(0.0, 1.0, 0.0), c)); vec3 e2 = cross(c, e1);
    float th = atan(dot(d, e2), dot(d, e1));
    float sp = sin(r * 13.0 - th * uVortP[k].y * 1.0 + float(k) * 1.7 + n * 1.5);
    vec3 pale = uVortP[k].w > 0.5 ? vec3(0.22, 0.4, 0.78) : vec3(0.55, 0.72, 0.9);
    vec3 cream = uVortP[k].w > 0.5 ? vec3(0.4, 0.62, 0.86) : vec3(0.93, 0.93, 0.78);
    vec3 sw = mix(pale, cream, smoothstep(0.55, 1.0, sp));
    col = mix(col, sw, smoothstep(-0.2, 0.8, sp) * w * 0.85);
  }
  // wheat-field clouds
  if (uClouds > 0.01){
    for (int k = 0; k < 2; k++){
      vec2 cc = k == 0 ? vec2(-1.72, 0.3) : vec2(-1.28, 0.44);
      vec2 dd = vec2((az - cc.x) * cos(el) / (k == 0 ? 0.2 : 0.15), (el - cc.y) / (k == 0 ? 0.075 : 0.06));
      float r = length(dd);
      float m = smoothstep(1.0, 0.25, r + (fbm(vec2(az * 3.0, el * 6.0) * 2.5) - 0.5) * 1.3);
      col = mix(col, mix(vec3(0.62, 0.74, 0.88), vec3(0.86, 0.88, 0.86), m), m * uClouds * 0.7);
    }
  }
  // stars: concentric haloes of yellow, white and pale green paint
  for (int k = 0; k < ${NS}; k++){
    float w = starW(k); if (w < 0.01) continue;
    float r = acos(clamp(dot(d, uStar[k].xyz), -1.0, 1.0)) / uStar[k].w;
    float ring = 0.5 + 0.5 * cos(r * 8.0);
    vec3 halo = mix(vec3(0.52, 0.74, 0.78), vec3(0.98, 0.9, 0.5), ring);
    col = mix(col, halo, smoothstep(1.5, 0.5, r) * 0.75 * w);
    col = mix(col, vec3(1.0, 0.95, 0.62), smoothstep(0.55, 0.3, r) * w);
  }
  // moon with an orange halo
  if (uMoonK > 0.01){
    float r = acos(clamp(dot(d, uMoon.xyz), -1.0, 1.0)) / uMoon.w;
    float ring = 0.5 + 0.5 * cos(r * 7.0);
    col = mix(col, mix(vec3(0.95, 0.72, 0.3), vec3(1.0, 0.92, 0.5), ring), smoothstep(1.4, 0.6, r) * 0.85 * uMoonK);
    col = mix(col, vec3(1.0, 0.82, 0.32), smoothstep(0.62, 0.45, r) * uMoonK);
  }
  // below horizon: deep blue
  col = mix(col, uHor * 0.6, smoothstep(0.0, -0.08, el));
  gl_FragColor = vec4(col, 1.0);
}
`;

const FLOW_FRAG = /* glsl */ `
${FIELD_COMMON}
vec2 dbl(vec2 v){ float a = atan(v.y, v.x) * 2.0; return vec2(cos(a), sin(a)); }
void main(){
  float az = (vUv.x - 0.5) * 2.0 * PI; float el = (vUv.y - 0.5) * PI;
  vec3 d = dirOf(az, el);
  vec3 E = vec3(cos(az), 0.0, sin(az));
  vec3 N = vec3(-sin(az) * sin(el), cos(el), cos(az) * sin(el));
  float n = fbm(vec2(az * 1.6, el * 3.0) + 7.0);
  float a0 = 0.35 * sin(az * 5.0 + el * 8.0 + n * 5.0) + 0.25 * (n - 0.5);
  vec2 v = vec2(cos(2.0 * a0), sin(2.0 * a0)) * 0.6;
  for (int k = 0; k < ${NV}; k++){
    float w0 = vortW(k) * uVortP[k].x; if (w0 < 0.01) continue;
    vec3 c = uVort[k].xyz;
    float ang = acos(clamp(dot(d, c), -1.0, 1.0));
    float r = ang / uVort[k].w;
    vec3 tng = cross(c, d);
    vec3 rad = normalize(c - d * dot(c, d) + 1e-5);
    tng = normalize(tng + 1e-5) * cos(0.25) + rad * sin(0.25) * uVortP[k].y;
    vec2 lt = vec2(dot(tng, E), dot(tng, N));
    v += dbl(lt) * exp(-r * r * 0.7) * 3.5 * w0;
  }
  for (int k = 0; k < ${NS}; k++){
    float w = starW(k); if (w < 0.01) continue;
    vec3 c = uStar[k].xyz;
    float r = acos(clamp(dot(d, c), -1.0, 1.0)) / uStar[k].w;
    vec3 tng = normalize(cross(c, d) + 1e-5);
    v += dbl(vec2(dot(tng, E), dot(tng, N))) * exp(-r * r * 0.35) * 4.0 * w;
  }
  if (uMoonK > 0.01){
    float r = acos(clamp(dot(d, uMoon.xyz), -1.0, 1.0)) / uMoon.w;
    vec3 tng = normalize(cross(uMoon.xyz, d) + 1e-5);
    v += dbl(vec2(dot(tng, E), dot(tng, N))) * exp(-r * r * 0.3) * 4.0 * uMoonK;
  }
  v = normalize(v + vec2(1e-4, 0.0));
  gl_FragColor = vec4(v * 0.5 + 0.5, 0.0, 1.0);
}
`;

const DOME_VERT = /* glsl */ `
varying vec3 vDir;
void main(){ vDir = position; vec4 w = modelMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * viewMatrix * w; gl_Position.z = gl_Position.w * 0.99999; }
`;

const DOME_FRAG = /* glsl */ `
${COMMON}
${STROKE}
#define PI 3.14159265
uniform sampler2D tFlow; uniform sampler2D tCol;
uniform vec4 uStar[${NS}]; uniform float uStarKind[${NS}];
uniform vec4 uMoon; uniform float uStars; uniform float uMoonK; uniform float uDipper; uniform float uTime; uniform float uCell;
uniform vec3 uFogCol; uniform float uReveal;
varying vec3 vDir;
vec2 uvOf(float az, float el){ return vec2(az / (2.0 * PI) + 0.5, el / PI + 0.5); }
float wrapPi(float a){ return a - 2.0 * PI * floor((a + PI) / (2.0 * PI)); }

void main(){
  vec3 d = normalize(vDir);
  float az = atan(d.x, -d.z); float el = asin(clamp(d.y, -1.0, 1.0));
  float cell = uCell;
  float aa = max(length(fwidth(d)) / cell * 0.8, 0.02);
  vec3 under = texture2D(tCol, uvOf(az, el)).rgb;
  vec3 col = under * 0.86;
  float bestPrio = -1.0; float bestCov = 0.0; vec2 bestLocal = vec2(0.0); vec4 bestH = vec4(0.5); vec2 bestC = vec2(0.0);
  for (int layer = 0; layer < 2; layer++){
    float lo = float(layer) * 0.5;
    float j0 = floor(el / cell + lo);
    for (int dj = -1; dj <= 1; dj++){
      float jj = j0 + float(dj);
      float elc = (jj + 0.5 - lo) * cell;
      float N = max(3.0, floor(6.2832 * cos(clamp(elc, -1.5, 1.5)) / cell));
      float cAz = 6.2832 / N;
      float i0 = floor((az + PI) / cAz + lo);
      for (int di = -1; di <= 1; di++){
        float ii = i0 + float(di);
        float iw = mod(ii, N);
        vec4 h = hash42(vec2(iw, jj) + float(layer) * 91.7);
        float azc = -PI + (ii + 0.5 - lo + (h.x - 0.5) * 0.8) * cAz;
        float elcc = elc + (h.y - 0.5) * 0.8 * cell;
        vec2 f = texture2D(tFlow, uvOf(wrapPi(azc), elcc)).xy * 2.0 - 1.0;
        float ang = 0.5 * atan(f.y, f.x) + (h.z - 0.5) * 0.3;
        vec2 dir = vec2(cos(ang), sin(ang));
        vec2 q = vec2(wrapPi(az - azc) * cos(el), el - elcc) / cell;
        float a = dot(q, dir); float b = dot(q, vec2(-dir.y, dir.x));
        float hl = mix(0.62, 1.0, h.w);
        float hw = hl / 3.8;
        float t = clamp(a / hl, -1.0, 1.0);
        float w = hw * (1.0 - 0.3 * t * t);
        float sd = length(vec2(max(abs(a) - hl + w, 0.0), b)) - w;
        float cov = 1.0 - smoothstep(-aa, aa, sd);
        float prio = fract(h.w * 13.7 + h.x * 3.1);
        if (cov > 0.02 && prio > bestPrio && h.w * 0.75 + h.x * 0.25 < uReveal * 1.1){ bestPrio = prio; bestCov = cov; bestLocal = vec2(a / hl, b / w); bestH = h; bestC = vec2(azc, elcc); }
      }
    }
  }
  if (bestPrio > -0.5){
    Stroke s; s.local = bestLocal; s.h = bestH; s.cov = bestCov;
    vec3 sc = texture2D(tCol, uvOf(wrapPi(bestC.x), bestC.y)).rgb;
    sc *= 0.93 + 0.14 * bestH.x;
    sc += (bestH.zwx - 0.5) * 0.05;
    col = mix(col, sc * strokeRelief(s, 1.0), bestCov);
  }
  // crisp star cores (a few stroke-swirls of near-white paint)
  for (int k = 0; k < ${NS}; k++){
    float w = uStarKind[k] > 0.5 ? uDipper : uStars; if (w < 0.01) continue;
    vec3 c = uStar[k].xyz;
    float r = acos(clamp(dot(d, c), -1.0, 1.0)) / uStar[k].w;
    if (r > 0.6) continue;
    vec3 e1 = normalize(cross(vec3(0.0, 1.0, 0.0), c)); vec3 e2 = cross(c, e1);
    float th = atan(dot(d, e2), dot(d, e1));
    float sw = 0.5 + 0.5 * sin(th * 3.0 + r * 18.0 + float(k) + uTime * 0.6);
    float tw = 0.92 + 0.08 * sin(uTime * 2.3 + float(k) * 2.1);
    vec3 cc = mix(vec3(1.0, 0.9, 0.45), vec3(1.0, 1.0, 0.88), sw) * tw;
    col = mix(col, cc, smoothstep(0.34, 0.2, r) * w);
  }
  if (uMoonK > 0.01){
    vec3 c = uMoon.xyz;
    float r = acos(clamp(dot(d, c), -1.0, 1.0)) / uMoon.w;
    vec3 e1 = normalize(cross(vec3(0.0, 1.0, 0.0), c)); vec3 e2 = cross(c, e1);
    vec2 p = vec2(dot(d, e1), dot(d, e2)) / uMoon.w;
    float disk = smoothstep(0.42, 0.36, r);
    float cut = smoothstep(0.3, 0.36, length(p - vec2(-0.16, 0.12)));
    vec3 mc = mix(vec3(1.0, 0.72, 0.22), vec3(1.0, 0.9, 0.45), 0.5 + 0.5 * sin(r * 30.0 + atan(p.y, p.x) * 2.0));
    col = mix(col, mc, disk * cut * uMoonK);
  }
  col = mix(col, uFogCol, smoothstep(0.06, -0.04, el) * 0.8);
  col = mix(vec3(0.9, 0.85, 0.74), col, smoothstep(0.0, 0.3, uReveal));
  gl_FragColor = vec4(col, 1.0);
}
`;

export function createSky(renderer) {
  const flowRT = new THREE.WebGLRenderTarget(512, 256, { wrapS: THREE.RepeatWrapping, wrapT: THREE.ClampToEdgeWrapping, depthBuffer: false });
  const colRT = new THREE.WebGLRenderTarget(1024, 512, { wrapS: THREE.RepeatWrapping, wrapT: THREE.ClampToEdgeWrapping, depthBuffer: false });
  flowRT.texture.wrapS = THREE.RepeatWrapping; colRT.texture.wrapS = THREE.RepeatWrapping;

  const starArr = [...STARS, ...DIPPER].map(([a, e, s]) => { const v = dirAE(a, e); return new THREE.Vector4(v.x, v.y, v.z, s * D2R); });
  const starKind = [...STARS.map(() => 0), ...DIPPER.map(() => 1)];
  const vort = VORTEX.map(([a, e, r]) => { const v = dirAE(a, e); return new THREE.Vector4(v.x, v.y, v.z, r * D2R); });
  const vortP = VORTEX.map(([, , , s, spin, g]) => new THREE.Vector4(s, spin, 0, g));
  const mv = dirAE(MOON[0], MOON[1]);
  const moon = new THREE.Vector4(mv.x, mv.y, mv.z, MOON[2] * D2R);

  const shared = {
    uStar: { value: starArr }, uStarKind: { value: starKind }, uVort: { value: vort }, uVortP: { value: vortP }, uMoon: { value: moon },
    uZen: { value: new THREE.Color() }, uHor: { value: new THREE.Color() },
    uSwirl: { value: 1 }, uStars: { value: 1 }, uMoonK: { value: 1 }, uDipper: { value: 1 }, uClouds: { value: 0 }, uTurb: { value: 0 },
  };
  const colMat = new THREE.ShaderMaterial({ uniforms: shared, vertexShader: FIELD_VERT, fragmentShader: COLOR_FRAG, depthTest: false, depthWrite: false });
  const flowMat = new THREE.ShaderMaterial({ uniforms: shared, vertexShader: FIELD_VERT, fragmentShader: FLOW_FRAG, depthTest: false, depthWrite: false });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), colMat);
  quad.frustumCulled = false;
  const fsScene = new THREE.Scene(); fsScene.add(quad);
  const fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const domeMat = new THREE.ShaderMaterial({
    uniforms: {
      tFlow: { value: flowRT.texture }, tCol: { value: colRT.texture },
      uStar: shared.uStar, uStarKind: shared.uStarKind, uMoon: shared.uMoon,
      uStars: shared.uStars, uMoonK: shared.uMoonK, uDipper: shared.uDipper,
      uTime: { value: 0 }, uCell: { value: 1.1 * D2R }, uFogCol: { value: new THREE.Color() }, uReveal: { value: 1 },
    },
    vertexShader: DOME_VERT, fragmentShader: DOME_FRAG, side: THREE.BackSide, depthWrite: false,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(900, 64, 32), domeMat);
  dome.frustumCulled = false; dome.renderOrder = -10;

  let lastKey = '';
  function update(p, camPos, time) {
    shared.uZen.value.setRGB(...p.zen); shared.uHor.value.setRGB(...p.hor);
    shared.uSwirl.value = p.swirl; shared.uStars.value = p.stars; shared.uMoonK.value = p.moon;
    shared.uDipper.value = p.dipper; shared.uClouds.value = p.clouds; shared.uTurb.value = p.turb;
    domeMat.uniforms.uFogCol.value.setRGB(...p.fog);
    domeMat.uniforms.uTime.value = time;
    dome.position.copy(camPos);
    const key = [p.zen, p.hor, p.swirl, p.stars, p.moon, p.dipper, p.clouds, p.turb].flat().map((v) => v.toFixed(3)).join(',');
    if (key !== lastKey) {
      lastKey = key;
      const prev = renderer.getRenderTarget();
      quad.material = colMat; renderer.setRenderTarget(colRT); renderer.render(fsScene, fsCam);
      quad.material = flowMat; renderer.setRenderTarget(flowRT); renderer.render(fsScene, fsCam);
      renderer.setRenderTarget(prev);
    }
  }
  return { dome, update, colTex: colRT.texture, uniforms: domeMat.uniforms };
}
