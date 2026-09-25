// polish.js — v3-only look: golden-hour grade, tilt-shift "miniature" focus, drifting cloud shadows, wind on the Tripo trees.
// Everything here is hand-written shader code; no extra downloads. fixed/ and oneshot/ do not load this file.
import * as THREE from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`;

// ---------- post: golden-hour split toning (linear HDR, before the ACES output pass) ----------
export function goldenPass() {
  return new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uWarm: { value: 1 } },
    vertexShader: VERT,
    fragmentShader: `uniform sampler2D tDiffuse; uniform float uWarm; varying vec2 vUv;
      void main(){
        vec4 c = texture2D(tDiffuse, vUv);
        float l = dot(c.rgb, vec3(.2126, .7152, .0722));
        // shadows lean teal (the sea bouncing up), highlights lean amber (low sun), mids keep their hue
        vec3 sh = vec3(.86, 1.02, 1.08), hi = vec3(1.12, 1.0, .82);
        float t = smoothstep(.02, .9, l);
        c.rgb *= mix(vec3(1.), mix(sh, hi, t), uWarm);
        // a touch of saturation in the mids so the Tripo textures read richer
        c.rgb = mix(vec3(l), c.rgb, 1. + .14 * uWarm * (1. - abs(t * 2. - 1.)));
        gl_FragColor = c;
      }`,
  });
}

// ---------- post: tilt-shift, two separable blur passes whose radius grows away from a horizontal focus band ----------
function blurPass(dir) {
  return new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uDir: { value: new THREE.Vector2(...dir) }, uRes: { value: new THREE.Vector2(1, 1) },
      uFocus: { value: .5 }, uBand: { value: .14 }, uMax: { value: 3.2 } },
    vertexShader: VERT,
    fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 uDir, uRes; uniform float uFocus, uBand, uMax; varying vec2 vUv;
      void main(){
        float d = max(0., abs(vUv.y - uFocus) - uBand);
        float r = uMax * smoothstep(0., .42, d);
        if (r < .05) { gl_FragColor = texture2D(tDiffuse, vUv); return; }
        vec2 st = uDir / uRes * r;
        // 9-tap gaussian (sigma ~ 2 taps)
        vec4 s = texture2D(tDiffuse, vUv) * .2270270270;
        s += (texture2D(tDiffuse, vUv + st * 1.3846153846) + texture2D(tDiffuse, vUv - st * 1.3846153846)) * .3162162162;
        s += (texture2D(tDiffuse, vUv + st * 3.2307692308) + texture2D(tDiffuse, vUv - st * 3.2307692308)) * .0702702703;
        gl_FragColor = s;
      }`,
  });
}
export function tiltShift() {
  const h = blurPass([1, 0]), v = blurPass([0, 1]);
  return {
    passes: [h, v],
    setSize(w, hh) { for (const p of [h, v]) p.uniforms.uRes.value.set(w, hh); },
    set(focus, band, max) { for (const p of [h, v]) { p.uniforms.uFocus.value = focus; p.uniforms.uBand.value = band; p.uniforms.uMax.value = max; } },
  };
}

// ---------- cloud shadows: only the direct (sun) light is dimmed, so shaded ground keeps its sky fill ----------
const cloudU = { uCloudT: { value: 0 }, uCloudK: { value: .62 } };
const CLOUD_V_HEAD = 'varying vec2 vCloudW;\n';
const CLOUD_V_BODY = `
  vec4 cw = vec4(transformed, 1.);
  #ifdef USE_INSTANCING
  cw = instanceMatrix * cw;
  #endif
  vCloudW = (modelMatrix * cw).xz;`;
const CLOUD_F_HEAD = `varying vec2 vCloudW; uniform float uCloudT, uCloudK;
  float cH(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float cN(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
    return mix(mix(cH(i), cH(i + vec2(1, 0)), f.x), mix(cH(i + vec2(0, 1)), cH(i + 1.), f.x), f.y); }
  float cloudShade(vec2 w){
    vec2 p = w * .055 + vec2(uCloudT * .018, uCloudT * .007);
    float n = cN(p) * .55 + cN(p * 2.1 + 7.3) * .3 + cN(p * 4.7 - 3.1) * .15;
    return 1. - uCloudK * smoothstep(.44, .66, n);
  }\n`;
function patchCloud(mat) {
  if (mat.userData.cloud || !mat.isMeshStandardMaterial) return;
  mat.userData.cloud = true;
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    prev?.call(mat, sh, r);
    Object.assign(sh.uniforms, cloudU);
    sh.vertexShader = CLOUD_V_HEAD + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>' + CLOUD_V_BODY);
    sh.fragmentShader = CLOUD_F_HEAD + sh.fragmentShader.replace('#include <aomap_fragment>',
      'float cl = cloudShade(vCloudW); reflectedLight.directDiffuse *= cl; reflectedLight.directSpecular *= cl;\n#include <aomap_fragment>');
  };
  const key = mat.customProgramCacheKey?.bind(mat);
  mat.customProgramCacheKey = () => (key ? key() : '') + '|cloud' + (mat.userData.wind ? '|wind' : '');
  mat.needsUpdate = true;
}

// ---------- wind: bend a tree's vertices by their height inside the model, phase from the instance position ----------
const windU = { uWindT: { value: 0 } };
export function patchWind(root) {
  root.traverse(o => {
    if (!o.isMesh || !o.material || o.material.userData.wind) return;
    o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox, mat = o.material;
    mat.userData.wind = true;
    const uH = { value: new THREE.Vector2(bb.min.y, Math.max(1e-4, bb.max.y - bb.min.y)) };
    const uAmp = { value: Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z) * .035 };
    const prev = mat.onBeforeCompile;
    mat.onBeforeCompile = (sh, r) => {
      Object.assign(sh.uniforms, windU, { uWindH: uH, uWindAmp: uAmp });
      sh.vertexShader = 'uniform float uWindT, uWindAmp; uniform vec2 uWindH;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        { float hk = clamp((position.y - uWindH.x) / uWindH.y, 0., 1.); hk *= hk;
          float ph = dot(modelMatrix[3].xz, vec2(.37, .61));
          float g = sin(uWindT * 1.3 + ph) * .7 + sin(uWindT * 2.9 + ph * 1.7) * .3;
          transformed.x += g * uWindAmp * hk; transformed.z += cos(uWindT * 1.1 + ph) * uWindAmp * .45 * hk;
          transformed.x += sin(uWindT * 7. + position.y * 9. + position.x * 5.) * uWindAmp * .08 * hk; }`);
      prev?.call(mat, sh, r);
    };
    mat.needsUpdate = true;
  });
}

export function patchScene(scene) { scene.traverse(o => { if (o.isMesh && o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(patchCloud); }); }
export function tickPolish(t) { cloudU.uCloudT.value = t; windU.uWindT.value = t; }
