import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { geo, initGeo, proj, unproj, heightM, groundY, VT, VB, BASE_Y, pointInRing, inExtent } from './geo.js';
import { LANDMARKS, PEAKS, BRIDGES, DISTRICT_ZH, buildLandmarkModels, nightLit, beacons, focusY } from './landmarks.js';

const Q = new URLSearchParams(location.search);
const IS_MOBILE = matchMedia('(max-width: 760px)').matches || /Mobi|Android/i.test(navigator.userAgent);
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const LOCK_Q = Q.has('q');
if (Q.has('nobar')) document.body.classList.add('nobar');
const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------------------
// 载入
// ---------------------------------------------------------------------------
const ldBar = $('ldBar'), ldMsg = $('ldMsg');
const progress = {};
function setProg(k, v) { progress[k] = v; const vals = Object.values(progress); ldBar.style.width = (vals.reduce((a, b) => a + b, 0) / 8 * 100).toFixed(1) + '%'; }
async function fetchBuf(url, key) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(url + ' ' + r.status);
  const total = +r.headers.get('content-length') || 0;
  if (!r.body || !total) { const b = await r.arrayBuffer(); setProg(key, 1); return b; }
  const reader = r.body.getReader(); const chunks = []; let got = 0;
  for (;;) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); got += value.length; setProg(key, got / total); }
  const out = new Uint8Array(got); let o = 0; for (const c of chunks) { out.set(c, o); o += c.length; }
  return out.buffer;
}
const texLoader = new THREE.TextureLoader();
function loadTex(url, key, srgb = true) {
  return new Promise((res, rej) => texLoader.load(url, (t) => { setProg(key, 1); if (srgb) t.colorSpace = THREE.SRGBColorSpace; res(t); }, undefined, rej));
}

// ---------------------------------------------------------------------------
// 渲染器 / 场景
// ---------------------------------------------------------------------------
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: Q.has('shot') });
const MAX_PR = IS_MOBILE ? 1.5 : 2;
let pixelRatio = Math.min(devicePixelRatio || 1, MAX_PR);
renderer.setPixelRatio(pixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, 1, 0.02, 2600);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.dampingFactor = 0.08;
controls.minDistance = 0.25; controls.maxDistance = 75;
controls.maxPolarAngle = THREE.MathUtils.degToRad(82);
controls.screenSpacePanning = false;
controls.zoomToCursor = true;
controls.rotateSpeed = 0.55; controls.panSpeed = 1.0;
controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };

const sun = new THREE.DirectionalLight(0xffffff, 3);
sun.castShadow = true;
const SM = IS_MOBILE ? 2048 : 4096;
sun.shadow.mapSize.set(SM, SM);
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.0;
scene.add(sun, sun.target);
const hemi = new THREE.HemisphereLight(0xbcd4ff, 0x6b5f50, 1.0);
scene.add(hemi);

// 共享 uniforms
const U = {
  uNight: { value: 0 }, uTime: { value: 0 }, uGlowK: { value: 1 }, uLit: { value: 0.5 }, uSnow: { value: 0 }, uWet: { value: 0 },
  uSeasonTint: { value: new THREE.Color(1, 1, 1) }, uWaterCol: { value: new THREE.Color('#3d6f86') }, uSkyRefl: { value: new THREE.Color('#9fc4e0') },
};

// ---------------------------------------------------------------------------
// 天空
// ---------------------------------------------------------------------------
const skyU = {
  uTop: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uBottom: { value: new THREE.Color() },
  uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color() }, uMoonDir: { value: new THREE.Vector3(0, -1, 0) },
  uNight: U.uNight, uTime: U.uTime, uCloud: { value: 0 },
};
const sky = new THREE.Mesh(new THREE.SphereGeometry(1800, 48, 24), new THREE.ShaderMaterial({
  uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
  vertexShader: `varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }`,
  fragmentShader: `
    uniform vec3 uTop, uHorizon, uBottom, uSunDir, uSunCol, uMoonDir; uniform float uNight, uTime, uCloud;
    varying vec3 vDir;
    float h3(vec3 p){ p = fract(p*0.3183099+.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
    void main(){
      vec3 d = normalize(vDir);
      float h = d.y;
      vec3 col = mix(uHorizon, uTop, pow(smoothstep(-0.02, 0.42, h), 0.55));
      col += uHorizon * 0.3 * exp(-abs(h) * 26.0);
      col = mix(col, uBottom, smoothstep(0.0, -0.3, h));
      float sd = max(dot(d, uSunDir), 0.0);
      float above = smoothstep(-0.08, 0.02, h);
      col += uSunCol * (pow(sd, 1600.0) * 30.0 * step(-0.01, uSunDir.y) + pow(sd, 10.0) * 0.45 + pow(sd, 2.5) * 0.12) * above;
      // 星空
      if (uNight > 0.01 && h > 0.0) {
        vec3 p = d * 220.0; vec3 id = floor(p); vec3 f = fract(p) - 0.5;
        float r = h3(id);
        float s = step(0.992, r) * smoothstep(0.22, 0.0, length(f));
        s *= 0.6 + 0.4 * sin(uTime * (1.5 + r * 4.0) + r * 40.0);
        col += vec3(0.9, 0.95, 1.0) * s * uNight * smoothstep(0.0, 0.25, h) * (1.0 - uCloud);
        // 月亮
        float md = dot(d, uMoonDir);
        col += vec3(1.0, 0.96, 0.86) * (smoothstep(0.99955, 0.9997, md) * 1.6 + pow(max(md, 0.0), 60.0) * 0.12) * uNight;
      }
      col = mix(col, vec3(dot(col, vec3(0.33))) * 0.9, uCloud * 0.6);
      gl_FragColor = vec4(col, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
}));
sky.renderOrder = -10; sky.frustumCulled = false;
scene.add(sky);
scene.fog = new THREE.Fog(0xcfe0ee, 30, 200);

// ---------------------------------------------------------------------------
// 后期：Bloom + 移轴 + 调色
// ---------------------------------------------------------------------------
const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: IS_MOBILE ? 0 : 4 });
const composer = new EffectComposer(renderer, rt);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.4, 0.55, 0.9);
composer.addPass(bloom);
const TiltShader = {
  uniforms: { tDiffuse: { value: null }, uDir: { value: new THREE.Vector2() }, uAmount: { value: 2.5 }, uFocus: { value: 0.5 }, uBand: { value: 0.16 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 uDir; uniform float uAmount, uFocus, uBand; varying vec2 vUv;
    void main(){
      float d = abs(vUv.y - uFocus);
      float r = uAmount * smoothstep(uBand, uBand + 0.38, d);
      if (r < 0.05) { gl_FragColor = texture2D(tDiffuse, vUv); return; }
      vec4 c = vec4(0.0); float ws = 0.0;
      for (int i = -4; i <= 4; i++) { float w = exp(-float(i*i) / 9.0); c += texture2D(tDiffuse, vUv + uDir * float(i) * r) * w; ws += w; }
      gl_FragColor = c / ws;
    }`,
};
const tiltH = new ShaderPass(TiltShader), tiltV = new ShaderPass(TiltShader);
composer.addPass(tiltH); composer.addPass(tiltV);
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uVig: { value: 0.35 }, uSat: { value: 1.08 } },
  vertexShader: TiltShader.vertexShader,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uVig, uSat; varying vec2 vUv;
    void main(){ vec4 c = texture2D(tDiffuse, vUv); float l = dot(c.rgb, vec3(0.2126,0.7152,0.0722));
      c.rgb = max(mix(vec3(l), c.rgb, uSat), 0.0);
      vec2 q = vUv - 0.5; c.rgb *= 1.0 - uVig * smoothstep(0.25, 0.85, dot(q, q) * 2.2);
      gl_FragColor = c; }`,
});
composer.addPass(grade);
composer.addPass(new OutputPass());

// ---------------------------------------------------------------------------
// 状态
// ---------------------------------------------------------------------------
const S = {
  hour: +(Q.get('t') ?? 17.25), timePlay: false, season: Q.get('season') || 'autumn', weather: Q.get('weather') || 'clear',
  layers: { districts: true, labels: true, traffic: true, trees: true, buildings: true, tilt: true },
  tour: false, tourIdx: -1, focus: null, flight: null, orbitSpin: 0, lastInteract: 0,
  lodPx: IS_MOBILE ? 2.2 : 1.3, buildingBudget: IS_MOBILE ? 0.6 : 1,
};
let meta, groups = {}, chunksB = [], chunksT = [], traffic, fountain, planes = [], districtObjs = [], seoulCurtain, weatherFx;

// ---------------------------------------------------------------------------
// 地形
// ---------------------------------------------------------------------------
function buildTerrain(tex) {
  const { NX, NZ, X0, X1, Z0, Z1, heights } = geo;
  const n = NX * NZ;
  const pos = new Float32Array(n * 3), uv = new Float32Array(n * 2), nor = new Float32Array(n * 3);
  const dx = (X1 - X0) / (NX - 1), dz = (Z1 - Z0) / (NZ - 1);
  const Y = (i, j) => heights[Math.min(NZ - 1, Math.max(0, j)) * NX + Math.min(NX - 1, Math.max(0, i))] * 0.1 * VT / 1000;
  for (let j = 0, k = 0; j < NZ; j++) for (let i = 0; i < NX; i++, k++) {
    pos[k * 3] = X0 + i * dx; pos[k * 3 + 1] = Y(i, j); pos[k * 3 + 2] = Z0 + j * dz;
    uv[k * 2] = i / (NX - 1); uv[k * 2 + 1] = 1 - j / (NZ - 1);
    const gx = (Y(i + 1, j) - Y(i - 1, j)) / (2 * dx), gz = (Y(i, j + 1) - Y(i, j - 1)) / (2 * dz);
    const l = Math.hypot(gx, 1, gz); nor[k * 3] = -gx / l; nor[k * 3 + 1] = 1 / l; nor[k * 3 + 2] = -gz / l;
  }
  const idx = new Uint32Array((NX - 1) * (NZ - 1) * 6);
  for (let j = 0, o = 0; j < NZ - 1; j++) for (let i = 0; i < NX - 1; i++) {
    const a = j * NX + i, b = a + 1, c = a + NX, d = c + 1;
    idx[o++] = a; idx[o++] = c; idx[o++] = b; idx[o++] = b; idx[o++] = c; idx[o++] = d;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeBoundingSphere();
  const mat = new THREE.MeshStandardMaterial({ map: tex.ground, roughness: 0.93, metalness: 0 });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { tNight: { value: tex.night }, tWater: { value: tex.water }, tMask: { value: tex.mask } }, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vWPos; uniform sampler2D tNight, tWater, tMask; uniform float uNight, uTime, uSnow, uWet, uGlowK; uniform vec3 uSeasonTint, uWaterCol, uSkyRefl;
      float gWater;`)
      .replace('#include <map_fragment>', `#include <map_fragment>
      float wm = texture2D(tWater, vMapUv).r;
      gWater = smoothstep(0.40, 0.62, wm);
      vec3 mk = texture2D(tMask, vMapUv).rgb;
      diffuseColor.rgb *= mix(vec3(1.0), uSeasonTint, mk.g * (1.0 - gWater));
      float snowAmt = uSnow * (1.0 - gWater);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.9, 0.92, 0.95), snowAmt * (0.82 - mk.g * 0.25));
      diffuseColor.rgb *= 1.0 - uWet * 0.25 * (1.0 - gWater);
      diffuseColor.rgb = mix(diffuseColor.rgb, uWaterCol, gWater);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      roughnessFactor = mix(roughnessFactor - uWet * 0.35, 0.16, gWater);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      if (gWater > 0.01) {
        vec2 p = vWPos.xz * 55.0; float t = uTime * 0.7;
        vec2 gr = vec2(cos(p.x * 1.7 + t) * 1.7 * cos(p.y * 1.3 - t * 0.8), -sin(p.x * 1.7 + t) * sin(p.y * 1.3 - t * 0.8) * 1.3);
        gr += vec2(1.0, 1.0) * cos((p.x + p.y) * 2.9 - t * 1.3) * 1.2 + vec2(-1.0, 1.0) * cos((p.y - p.x) * 4.1 + t * 1.1) * 0.8;
        float rfade = 1.0 - smoothstep(0.4, 1.6, length(fwidth(p)));
        vec3 nw = normalize(vec3(-gr.x * 0.035 * rfade, 1.0, -gr.y * 0.035 * rfade));
        normal = normalize(mix(normal, normalize((viewMatrix * vec4(nw, 0.0)).xyz), gWater));
      }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      vec3 nl = texture2D(tNight, vMapUv).rgb;
      totalEmissiveRadiance += pow(nl, vec3(2.3)) * uNight * 0.75 * uGlowK * (1.0 - gWater);
      vec3 Vd = normalize(vViewPosition);
      float fres = 0.03 + 0.97 * pow(1.0 - clamp(dot(normal, Vd), 0.0, 1.0), 5.0);
      vec3 refl = texture2D(tNight, vMapUv + normal.xz * 0.004, 5.0).rgb;
      totalEmissiveRadiance += gWater * (uSkyRefl * fres * 0.8 + refl * refl * uNight * 2.4 + vec3(0.006, 0.01, 0.022) * uNight);`);
  };
  const mesh = new THREE.Mesh(g, mat);
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

// 沙盘侧壁与底座
function buildPlinth() {
  const { NX, NZ, X0, X1, Z0, Z1 } = geo;
  const c = document.createElement('canvas'); c.width = 8; c.height = 256; const x = c.getContext('2d');
  const bands = [['#5d4a36', 0], ['#7a6146', .08], ['#8f7654', .2], ['#a48b66', .34], ['#8a7050', .5], ['#9c8260', .62], ['#6f5a42', .78], ['#54442f', 1]];
  const gr = x.createLinearGradient(0, 0, 0, 256); bands.forEach(([col, s]) => gr.addColorStop(s, col)); x.fillStyle = gr; x.fillRect(0, 0, 8, 256);
  for (let i = 0; i < 400; i++) { x.fillStyle = `rgba(0,0,0,${Math.random() * .12})`; x.fillRect(Math.random() * 8, Math.random() * 256, 1, 1 + Math.random() * 2); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 });
  const pos = [], uv = [], idx = [];
  const addEdge = (pts) => {
    const base = pos.length / 3;
    pts.forEach(([px, pz], k) => {
      const y = groundY(px, pz);
      pos.push(px, y, pz, px, BASE_Y, pz);
      uv.push(k / pts.length, 1 - 0.02, k / pts.length, 0);
    });
    for (let k = 0; k < pts.length - 1; k++) { const a = base + k * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  };
  const E = (n, f) => Array.from({ length: n }, (_, i) => f(i / (n - 1)));
  addEdge(E(NX, (t) => [X0 + t * (X1 - X0), Z1]));            // 南
  addEdge(E(NZ, (t) => [X1, Z1 - t * (Z1 - Z0)]));            // 东
  addEdge(E(NX, (t) => [X1 - t * (X1 - X0), Z0]));            // 北
  addEdge(E(NZ, (t) => [X0, Z0 + t * (Z1 - Z0)]));            // 西
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  const walls = new THREE.Mesh(g, mat); walls.material.side = THREE.DoubleSide;
  scene.add(walls);
  // 木质底座 + 黄铜饰条
  const W = X1 - X0, D = Z1 - Z0, cx = (X0 + X1) / 2, cz = (Z0 + Z1) / 2;
  const wood = new THREE.MeshStandardMaterial({ color: '#2a211c', roughness: 0.55, metalness: 0.05 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(W + 1.6, 0.9, D + 1.6), wood);
  base.position.set(cx, BASE_Y - 0.45 - 0.06, cz); base.receiveShadow = true; scene.add(base);
  const brass = new THREE.MeshStandardMaterial({ color: '#b08a4a', roughness: 0.35, metalness: 0.85 });
  const trim = new THREE.Mesh(new THREE.BoxGeometry(W + 1.7, 0.06, D + 1.7), brass);
  trim.position.set(cx, BASE_Y - 0.06, cz); scene.add(trim);
  // 铭牌
  const pc = document.createElement('canvas'); pc.width = 1024; pc.height = 128; const p = pc.getContext('2d');
  p.fillStyle = '#b8924f'; p.fillRect(0, 0, 1024, 128);
  p.strokeStyle = '#6e5327'; p.lineWidth = 6; p.strokeRect(10, 10, 1004, 108);
  p.fillStyle = '#3b2a12'; p.font = '600 50px "PingFang SC","Noto Sans CJK SC","Microsoft YaHei",sans-serif'; p.textAlign = 'center';
  p.fillText('首尔 서울 SEOUL  ·  37°34′N 126°59′E', 512, 82);
  const pt = new THREE.CanvasTexture(pc); pt.colorSpace = THREE.SRGBColorSpace; pt.anisotropy = 4;
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(8, 1), new THREE.MeshStandardMaterial({ map: pt, roughness: 0.4, metalness: 0.6 }));
  plate.position.set(cx, BASE_Y - 0.5, Z1 + 0.8 + 0.002); scene.add(plate);
}

// ---------------------------------------------------------------------------
// 建筑（按区块实例化 + 按屏幕尺寸 LOD）
// ---------------------------------------------------------------------------
const CX = 12, CZ = 10;
function chunkOf(x, z) {
  const i = Math.min(CX - 1, Math.max(0, Math.floor((x - geo.X0) / (geo.X1 - geo.X0) * CX)));
  const j = Math.min(CZ - 1, Math.max(0, Math.floor((z - geo.Z0) / (geo.Z1 - geo.Z0) * CZ)));
  return j * CX + i;
}
function buildingMaterial() {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, metalness: 0 });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
      attribute vec4 aInfo; varying vec3 vObj; varying vec3 vObjN; varying vec4 vInfo; varying float vSeed;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
      vObj = position; vObjN = normal; vInfo = aInfo;
      vSeed = fract(sin(dot(instanceMatrix[3].xz, vec2(127.1, 311.7))) * 43758.5453);`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      uniform float uNight, uLit, uSnow, uTime, uWet; varying vec3 vObj; varying vec3 vObjN; varying vec4 vInfo; varying float vSeed;
      float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      vec3 lin(vec3 c){ return pow(c, vec3(2.2)); }
      float gWin; float gRoof; float gGlass; vec3 gEmit;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      float kind = mod(vInfo.w, 128.0);
      float outside = step(127.5, vInfo.w);
      float s = vSeed, s2 = fract(s * 7.13 + 0.3), s3 = fract(s * 13.7 + 0.7);
      gRoof = step(0.5, vObjN.y);
      vec3 wall, roofc; gGlass = 0.0;
      float fh = 5.2, ww = 4.4; vec2 lo = vec2(0.22, 0.3), hi = vec2(0.78, 0.78);
      if (kind < 0.5) {
        wall = s < 0.3 ? vec3(0.83, 0.77, 0.67) : s < 0.55 ? vec3(0.70, 0.46, 0.38) : s < 0.8 ? vec3(0.80, 0.79, 0.76) : vec3(0.89, 0.87, 0.83);
        roofc = s2 < 0.42 ? vec3(0.40, 0.60, 0.46) : s2 < 0.58 ? vec3(0.43, 0.56, 0.68) : s2 < 0.72 ? vec3(0.66, 0.45, 0.38) : vec3(0.66, 0.64, 0.61);
        fh = 5.8; ww = 5.0;
      } else if (kind < 1.5) {
        wall = mix(vec3(0.88, 0.86, 0.82), vec3(0.74, 0.72, 0.70), s); if (s2 < 0.2) wall = vec3(0.64, 0.54, 0.48); if (s3 < 0.12) wall = vec3(0.62, 0.70, 0.74);
        roofc = s3 < 0.4 ? vec3(0.42, 0.60, 0.46) : vec3(0.63, 0.63, 0.62);
      } else if (kind < 2.5) {
        wall = mix(vec3(0.95, 0.94, 0.90), vec3(0.88, 0.87, 0.84), s); if (s2 < 0.18) wall = vec3(0.92, 0.88, 0.80);
        roofc = vec3(0.72, 0.70, 0.68); lo = vec2(0.05, 0.34); hi = vec2(0.95, 0.72); fh = 4.6;
      } else if (kind < 3.5) {
        wall = mix(vec3(0.46, 0.57, 0.66), vec3(0.66, 0.72, 0.76), s); if (s2 < 0.25) wall = vec3(0.36, 0.43, 0.50); if (s3 < 0.15) wall = vec3(0.72, 0.70, 0.64);
        roofc = vec3(0.56, 0.58, 0.61); gGlass = 1.0; lo = vec2(0.06, 0.12); hi = vec2(0.94, 0.9); fh = 4.2; ww = 3.2;
      } else if (kind < 4.5) {
        wall = vec3(0.82, 0.82, 0.80); roofc = s < 0.4 ? vec3(0.50, 0.62, 0.72) : s < 0.6 ? vec3(0.74, 0.52, 0.42) : vec3(0.72, 0.74, 0.74);
        lo = vec2(0.3, 0.55); hi = vec2(0.7, 0.8); fh = 9.0; ww = 9.0;
      } else if (kind < 5.5) {
        wall = s < 0.5 ? vec3(0.86, 0.76, 0.62) : vec3(0.78, 0.64, 0.55); roofc = vec3(0.57, 0.52, 0.48);
      } else {
        wall = vec3(0.90, 0.86, 0.78); roofc = vec3(0.24, 0.26, 0.29); lo = vec2(0.3, 0.3); hi = vec2(0.7, 0.7);
      }
      wall = lin(wall); roofc = lin(roofc);
      float W = vInfo.x, Hh = vInfo.y, D = vInfo.z;
      float along = abs(vObjN.x) > 0.5 ? (vObj.z + 0.5) * D : (vObj.x + 0.5) * W;
      float up = vObj.y * Hh;
      vec2 cell = vec2(along / ww, up / fh);
      vec2 id = floor(cell), f = fract(cell);
      vec2 aw = max(fwidth(cell), vec2(1e-4));
      float win = smoothstep(lo.x - aw.x, lo.x + aw.x, f.x) * (1.0 - smoothstep(hi.x - aw.x, hi.x + aw.x, f.x))
                * smoothstep(lo.y - aw.y, lo.y + aw.y, f.y) * (1.0 - smoothstep(hi.y - aw.y, hi.y + aw.y, f.y));
      float lod = smoothstep(0.12, 0.45, max(aw.x, aw.y));
      float cov = (hi.x - lo.x) * (hi.y - lo.y);
      win = mix(win, cov, lod) * (1.0 - gRoof) * step(0.6, up);
      gWin = win;
      float r = h21(id + vec2(s * 91.0, s2 * 53.0));
      float litP = uLit * (kind > 3.5 && kind < 4.5 ? 0.25 : 1.0);
      float lit = mix(step(r, litP), litP, lod);
      vec3 wc = h21(id.yx + s3 * 17.0) > 0.62 ? vec3(0.75, 0.85, 1.0) : vec3(1.0, 0.72, 0.42);
      if (gGlass > 0.5) wc = mix(wc, vec3(0.85, 0.92, 1.0), 0.5);
      wc = mix(wc, vec3(1.0, 0.74, 0.46), lod);
      gEmit = wc * win * lit * uNight * (gGlass > 0.5 ? 1.25 : 0.85) * mix(1.0, 0.24, lod);
      gEmit += (1.0 - gRoof) * step(up, fh) * uNight * vec3(1.0, 0.8, 0.55) * 0.35 * step(kind, 1.5) * step(0.4, s3);
      if (gGlass > 0.5 && Hh > 260.0) gEmit += (1.0 - gRoof) * smoothstep(Hh - 14.0, Hh - 4.0, up) * uNight * vec3(0.7, 0.85, 1.0) * 0.9;
      vec3 glassC = gGlass > 0.5 ? lin(vec3(0.30, 0.40, 0.50)) : lin(vec3(0.32, 0.37, 0.43));
      wall = mix(wall, glassC, win * (gGlass > 0.5 ? 0.55 : 0.5));
      wall *= mix(0.58, 1.0, smoothstep(0.0, 16.0, up));
      wall *= 1.0 - uWet * 0.2;
      roofc *= mix(0.9, 1.05, s3);
      roofc = mix(roofc, vec3(0.92, 0.94, 0.97), uSnow * 0.9);
      vec3 col = mix(wall, roofc, gRoof);
      col = mix(col, vec3(dot(col, vec3(0.3, 0.5, 0.2))) * 1.05 + 0.02, outside * 0.5);
      gEmit *= 1.0 - outside * 0.4;
      diffuseColor.rgb = col;`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      roughnessFactor = mix(0.88, mix(0.78, 0.28, clamp(gWin * 0.9 + gGlass * 0.35, 0.0, 1.0)), 1.0 - gRoof) - uWet * 0.25;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      totalEmissiveRadiance += gEmit;`);
  };
  return mat;
}

function buildBuildings(buf) {
  const dv = new DataView(buf);
  const n = dv.getUint32(0, true);
  const REC = 14;
  const { X0, X1, Z0, Z1 } = geo;
  const counts = new Int32Array(CX * CZ);
  const cidx = new Int32Array(n);
  const X = new Float32Array(n), Zs = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const o = 4 + i * REC;
    const x = X0 + dv.getUint16(o, true) / 65535 * (X1 - X0);
    const z = Z0 + dv.getUint16(o + 2, true) / 65535 * (Z1 - Z0);
    X[i] = x; Zs[i] = z;
    const c = chunkOf(x, z); cidx[i] = c; counts[c]++;
  }
  const lists = Array.from({ length: CX * CZ }, (_, c) => new Int32Array(counts[c]));
  const fill = new Int32Array(CX * CZ);
  for (let i = 0; i < n; i++) { const c = cidx[i]; lists[c][fill[c]++] = i; }
  const geom = new THREE.BoxGeometry(1, 1, 1); geom.translate(0, 0.5, 0);
  // 去掉底面
  const keepIdx = []; const ix = geom.index.array; for (let k = 0; k < ix.length; k += 3) {
    const a = ix[k], b = ix[k + 1], c2 = ix[k + 2];
    if (geom.attributes.position.getY(a) + geom.attributes.position.getY(b) + geom.attributes.position.getY(c2) === 0) continue;
    keepIdx.push(a, b, c2);
  }
  geom.setIndex(keepIdx);
  const mat = buildingMaterial();
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3(), yAxis = new THREE.Vector3(0, 1, 0);
  const tall = [];
  for (let c = 0; c < CX * CZ; c++) {
    const L = lists[c]; if (!L.length) continue;
    // 按屏幕尺寸排序（大→小），用于 LOD 截断
    const size = new Float32Array(L.length);
    const recs = Array.from(L).map((i) => {
      const o = 4 + i * REC;
      const w = dv.getUint16(o + 4, true) / 10, d = dv.getUint16(o + 6, true) / 10, h = dv.getUint16(o + 8, true) / 10;
      return { i, w, d, h, key: Math.max(w, d, h * VB * 0.8) };
    }).sort((a, b) => b.key - a.key);
    const g = geom.clone();
    const info = new Float32Array(recs.length * 4);
    const mesh = new THREE.InstancedMesh(g, mat, recs.length);
    recs.forEach((r, k) => {
      const o = 4 + r.i * REC;
      const base = dv.getUint16(o + 10, true) / 10 - 50;
      const ang = dv.getUint8(o + 12) / 255 * Math.PI;
      const kind = dv.getUint8(o + 13);
      const hEx = r.h * VB;
      p.set(X[r.i], base * VT / 1000, Zs[r.i]);
      q.setFromAxisAngle(yAxis, -ang);
      sc.set(r.w / 1000, hEx / 1000 + 0.004, r.d / 1000);
      m4.compose(p, q, sc); mesh.setMatrixAt(k, m4);
      info[k * 4] = r.w; info[k * 4 + 1] = hEx + 4; info[k * 4 + 2] = r.d; info[k * 4 + 3] = kind;
      size[k] = r.key;
      if (r.h > 150) tall.push([X[r.i], p.y + hEx / 1000, Zs[r.i], r.w, r.d, ang]);
    });
    g.setAttribute('aInfo', new THREE.InstancedBufferAttribute(info, 4));
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    mesh.userData = { size, total: recs.length };
    scene.add(mesh);
    chunksB.push(mesh);
  }
  return { n, tall };
}

// ---------------------------------------------------------------------------
// 树木
// ---------------------------------------------------------------------------
const SEASON = {
  spring: { tint: [1.25, 1.3, 1.1], leaf: ['#8fbf6a', '#a7cf7c', '#79ad5c'], accent: ['#f6c9d6', '#f2b5c8', '#fbe3ea'], accentP: 0.32, pine: '#4f7a4a' },
  summer: { tint: [0.7, 0.88, 0.65], leaf: ['#4e8a43', '#5f9b4d', '#3f7a3c'], accent: ['#6aa653'], accentP: 0.1, pine: '#3d6a3f' },
  autumn: { tint: [1.4, 0.98, 0.72], leaf: ['#d88a3a', '#c9542f', '#e2b64a', '#a8452c', '#8f9a45'], accent: ['#f2c94c', '#e8a33d'], accentP: 0.3, pine: '#4a6b42' },
  winter: { tint: [1.45, 1.0, 1.1], leaf: ['#8a7d6c', '#9a8f80', '#7c7266'], accent: ['#a59a8b'], accentP: 0.1, pine: '#48614a' },
};
function buildTrees(buf) {
  const dv = new DataView(buf);
  const n = dv.getUint32(0, true), REC = 6;
  const per = Array.from({ length: CX * CZ }, () => []);
  for (let i = 0; i < n; i++) {
    const o = 4 + i * REC;
    const x = dv.getInt16(o, true) / 1000, z = dv.getInt16(o + 2, true) / 1000;
    if (!inExtent(x, z, 0.05)) continue;
    per[chunkOf(x, z)].push({ x, z, s: dv.getUint8(o + 4) / 255, t: dv.getUint8(o + 5) });
  }
  const crown = new THREE.IcosahedronGeometry(1, 0); crown.translate(0, 1, 0);
  const cone = new THREE.ConeGeometry(0.8, 2.6, 6); cone.translate(0, 1.3, 0);
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true });
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3();
  for (const list of per) {
    if (!list.length) continue;
    list.sort((a, b) => b.s - a.s);
    for (const conifer of [false, true]) {
      const L = list.filter((t) => ((t.t & 1) === 0 && t.s * 7.31 % 1 < 0.38) === conifer);
      if (!L.length) continue;
      const mesh = new THREE.InstancedMesh(conifer ? cone : crown, mat, L.length);
      L.forEach((t, k) => {
        const r = (0.0085 + t.s * 0.0065) * (t.t & 2 ? 0.85 : 1);
        p.set(t.x, groundY(t.x, t.z) - 0.002, t.z);
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), t.s * 40);
        sc.set(r, r * (conifer ? 1.25 : 0.95), r);
        m4.compose(p, q, sc); mesh.setMatrixAt(k, m4);
        mesh.setColorAt(k, new THREE.Color());
      });
      mesh.userData = { trees: L, conifer, total: L.length, size: Float32Array.from(L, (t) => 12 + t.s * 10) };
      mesh.castShadow = true; mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      scene.add(mesh); chunksT.push(mesh);
    }
  }
  applySeason();
}
function applySeason() {
  const P = SEASON[S.season];
  U.uSeasonTint.value.setRGB(...P.tint);
  const c = new THREE.Color();
  for (const mesh of chunksT) {
    const { trees, conifer } = mesh.userData;
    trees.forEach((t, k) => {
      const h = (t.s * 97.13) % 1;
      if (conifer) c.set(P.pine).offsetHSL(0, 0, (h - 0.5) * 0.08);
      else if (h < P.accentP && (t.t & 1)) c.set(P.accent[Math.floor(h * 97) % P.accent.length]);
      else c.set(P.leaf[Math.floor(h * 1000) % P.leaf.length]).offsetHSL((h - 0.5) * 0.02, 0, (h - 0.5) * 0.1);
      if (S.weather === 'snow') c.lerp(new THREE.Color('#e9eef3'), conifer ? 0.35 : 0.5);
      mesh.setColorAt(k, c);
    });
    mesh.instanceColor.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------
// 桥梁（主干道的桥段）与车流
// ---------------------------------------------------------------------------
const ROAD_W = [0.040, 0.034, 0.028, 0.022];
function buildRoads() {
  const roads = meta.roads;
  const pos = [], col = [], glow = [], idx = [];
  const piers = [];
  const paths = [];
  const top = new THREE.Color('#5d6066'), side = new THREE.Color('#c9c3b8');
  const wl = geo.wl;
  const waterY = (wl - 1.5) * VT / 1000;
  for (const [cls, flat, flags] of roads) {
    const n = flat.length / 2;
    const P = new Array(n);
    for (let k = 0; k < n; k++) P[k] = [flat[k * 2] / 1000, flat[k * 2 + 1] / 1000];
    const y = new Float32Array(n);
    for (let k = 0; k < n; k++) y[k] = groundY(P[k][0], P[k][1]) + 0.0015;
    // 桥段：端点高度插值并保证净空
    let k = 0;
    while (k < n) {
      if (flags[k] !== 1) { k++; continue; }
      let e = k; while (e + 1 < n && flags[e + 1] === 1) e++;
      const a = Math.max(0, k - 1), b = Math.min(n - 1, e + 1);
      const ya = y[a], yb = y[b];
      let len = 0; const cum = [0];
      for (let t = a + 1; t <= b; t++) { len += Math.hypot(P[t][0] - P[t - 1][0], P[t][1] - P[t - 1][1]); cum.push(len); }
      const overWater = [];
      for (let t = k; t <= e; t++) {
        const f = len ? cum[t - a] / len : 0.5;
        const g = groundY(P[t][0], P[t][1]);
        const wet = heightM(P[t][0], P[t][1]) < wl + 0.8;
        const arch = Math.sin(f * Math.PI) * Math.min(0.02, len * 0.012);
        y[t] = Math.max(ya + (yb - ya) * f + arch, wet ? waterY + 0.03 : g + 0.012);
        overWater.push(wet);
      }
      // 桥面带（仅桥段绘制几何）
      const hw = ROAD_W[cls] / 2, th = 0.005;
      const seg = [];
      for (let t = a; t <= b; t++) seg.push(t);
      const base = pos.length / 3;
      seg.forEach((t, si) => {
        const t0 = seg[Math.max(0, si - 1)], t1 = seg[Math.min(seg.length - 1, si + 1)];
        let dx = P[t1][0] - P[t0][0], dz = P[t1][1] - P[t0][1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
        const nx = -dz * hw, nz = dx * hw;
        const yy = y[t];
        pos.push(P[t][0] + nx, yy, P[t][1] + nz, P[t][0] - nx, yy, P[t][1] - nz, P[t][0] + nx, yy - th, P[t][1] + nz, P[t][0] - nx, yy - th, P[t][1] - nz);
        for (let v = 0; v < 4; v++) { const cc = v < 2 ? top : side; col.push(cc.r, cc.g, cc.b); glow.push(v < 2 ? 0.0 : 1.0); }
        if (si > 0) {
          const o = base + (si - 1) * 4, q2 = base + si * 4;
          idx.push(o, q2, o + 1, o + 1, q2, q2 + 1);           // 桥面
          idx.push(o + 2, q2 + 2, o, o, q2 + 2, q2);           // 侧 +
          idx.push(o + 1, q2 + 1, o + 3, o + 3, q2 + 1, q2 + 3); // 侧 -
        }
        if (t >= k && t <= e && overWater[t - k] && (t - k) % 3 === 1) piers.push([P[t][0], yy - th, P[t][1], Math.atan2(dz, dx), hw]);
      });
      k = e + 1;
    }
    // 车流路径（去掉隧道）
    let cur = [];
    for (let t = 0; t < n; t++) {
      if (flags[t] === 2) { if (cur.length > 1) paths.push({ cls, pts: cur }); cur = []; continue; }
      cur.push([P[t][0], y[t] + 0.002, P[t][1]]);
    }
    if (cur.length > 1) paths.push({ cls, pts: cur });
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('aGlow', new THREE.Float32BufferAttribute(glow, 1));
  g.setIndex(idx); g.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aGlow; varying float vGlow;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = aGlow;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uNight; varying float vGlow;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(1.0, 0.78, 0.5) * vGlow * uNight * 2.2 + vec3(1.0,0.7,0.4) * (1.0 - vGlow) * uNight * 0.25;');
  };
  const bridges = new THREE.Mesh(g, mat);
  bridges.castShadow = true; bridges.receiveShadow = true;
  scene.add(bridges);
  // 桥墩
  const pg = new THREE.BoxGeometry(1, 1, 1); pg.translate(0, -0.5, 0);
  const pm = new THREE.InstancedMesh(pg, new THREE.MeshStandardMaterial({ color: '#b8b2a6', roughness: 0.9 }), piers.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3();
  piers.forEach(([x, yy, z, a, hw], i) => {
    const hgt = yy - waterY + 0.004;
    p.set(x, yy, z); q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -a); sc.set(0.008, hgt, hw * 1.6);
    m4.compose(p, q, sc); pm.setMatrixAt(i, m4);
  });
  pm.castShadow = true; scene.add(pm);
  return paths;
}

function buildTraffic(paths) {
  // 预处理路径累计长度
  const P = paths.map((pp) => {
    const pts = pp.pts; const cum = new Float32Array(pts.length); let L = 0;
    for (let i = 1; i < pts.length; i++) { L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][2] - pts[i - 1][2]); cum[i] = L; }
    return { ...pp, cum, L };
  }).filter((p) => p.L > 0.05);
  const weights = P.map((p) => p.L * [3.2, 2.4, 1.4, 0.8][p.cls]);
  const totalW = weights.reduce((a, b) => a + b, 0);
  const N = IS_MOBILE ? 5000 : 14000;
  const cars = [];
  const cdf = []; let acc = 0; for (const w of weights) { acc += w; cdf.push(acc / totalW); }
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < N; i++) {
    const r = rnd(); let lo = 0, hi = cdf.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (cdf[m] < r) lo = m + 1; else hi = m; }
    const path = P[lo];
    const dir = rnd() < 0.5 ? 1 : -1;
    cars.push({ p: path, s: rnd() * path.L, dir, v: [0.16, 0.13, 0.09, 0.07][path.cls] * (0.7 + rnd() * 0.6), lane: ROAD_W[path.cls] * (0.18 + rnd() * 0.22), seg: 0, c: rnd() });
  }
  const pos = new Float32Array(N * 3), colD = new Float32Array(N * 3), colN = new Float32Array(N * 3);
  const dayPal = ['#f4f4f2', '#e2e3e5', '#f7f5ef', '#a9adb2', '#c8463d', '#3f6aa8', '#e8e4d8', '#f0c24a'].map((h) => new THREE.Color(h));
  cars.forEach((c, i) => {
    const d = dayPal[Math.floor(c.c * dayPal.length) % dayPal.length]; colD.set([d.r, d.g, d.b], i * 3);
    const nc = c.dir > 0 ? [2.6, 2.2, 1.6] : [2.8, 0.35, 0.22]; colN.set(nc, i * 3);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aDay', new THREE.BufferAttribute(colD, 3));
  g.setAttribute('aNightC', new THREE.BufferAttribute(colN, 3));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uNight: U.uNight, uScale: { value: 800 } },
    vertexShader: `attribute vec3 aDay; attribute vec3 aNightC; uniform float uNight, uScale; varying vec3 vC; varying float vA;
      void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
        float sz = mix(0.008, 0.014, uNight);
        gl_PointSize = clamp(sz * uScale / -mv.z, 0.0, 7.0);
        vA = smoothstep(0.6, 1.6, gl_PointSize);
        vC = mix(aDay * 0.9, aNightC, uNight); }`,
    fragmentShader: `varying vec3 vC; varying float vA; void main(){ vec2 q = gl_PointCoord - 0.5; float d = length(q); if (d > 0.5) discard; gl_FragColor = vec4(vC, vA * smoothstep(0.5, 0.2, d)); }`,
    transparent: true, depthWrite: false,
  });
  const pts = new THREE.Points(g, mat); pts.frustumCulled = false; scene.add(pts);
  return { cars, pts, pos, mat };
}
function updateTraffic(dt) {
  if (!traffic || !traffic.pts.visible) return;
  const { cars, pos } = traffic;
  const sp = REDUCED ? 0 : dt;
  for (let i = 0; i < cars.length; i++) {
    const c = cars[i], p = c.p;
    c.s += c.v * sp * c.dir;
    if (c.s > p.L) c.s -= p.L; else if (c.s < 0) c.s += p.L;
    let k = c.seg;
    const cum = p.cum;
    while (k < cum.length - 2 && cum[k + 1] < c.s) k++;
    while (k > 0 && cum[k] > c.s) k--;
    c.seg = k;
    const a = p.pts[k], b = p.pts[k + 1];
    const segL = cum[k + 1] - cum[k] || 1;
    const f = (c.s - cum[k]) / segL;
    const dx = (b[0] - a[0]) / segL, dz = (b[2] - a[2]) / segL;
    const off = c.lane * c.dir;
    pos[i * 3] = a[0] + (b[0] - a[0]) * f - dz * off;
    pos[i * 3 + 1] = a[1] + (b[1] - a[1]) * f + 0.001;
    pos[i * 3 + 2] = a[2] + (b[2] - a[2]) * f + dx * off;
  }
  traffic.pts.geometry.attributes.position.needsUpdate = true;
}

// ---------------------------------------------------------------------------
// 盘浦大桥月光彩虹喷泉
// ---------------------------------------------------------------------------
function buildFountain(paths) {
  const [fx, fz] = proj(126.9962, 37.5135);
  // 找到最靠近的、跨越江面的主干道路段
  let best = null, bd = 1e9;
  for (const p of paths) {
    for (let i = 0; i < p.pts.length; i++) {
      const d = Math.hypot(p.pts[i][0] - fx, p.pts[i][2] - fz);
      if (d < bd) { bd = d; best = p; }
    }
  }
  if (!best || bd > 0.3) return null;
  const noz = [];
  for (let i = 0; i < best.pts.length - 1; i++) {
    const a = best.pts[i], b = best.pts[i + 1];
    const L = Math.hypot(b[0] - a[0], b[2] - a[2]); const steps = Math.ceil(L / 0.012);
    for (let s = 0; s < steps; s++) {
      const f = s / steps; const x = a[0] + (b[0] - a[0]) * f, z = a[2] + (b[2] - a[2]) * f;
      if (heightM(x, z) > geo.wl + 0.2) continue;
      const dx = (b[0] - a[0]) / L, dz = (b[2] - a[2]) / L;
      for (const side of [1, -1]) noz.push([x - dz * 0.016 * side, a[1] + (b[1] - a[1]) * f - 0.003, z + dx * 0.016 * side, -dz * side, dx * side]);
    }
  }
  if (!noz.length) return null;
  const PER = 14;
  const N = noz.length * PER;
  const pos = new Float32Array(N * 3), dir = new Float32Array(N * 3);
  noz.forEach((nz, i) => {
    for (let k = 0; k < PER; k++) { const j = i * PER + k; pos.set([nz[0], nz[1], nz[2]], j * 3); dir.set([nz[3], nz[4], (k + Math.random()) / PER], j * 3); }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aDir', new THREE.BufferAttribute(dir, 3));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime, uNight: U.uNight, uScale: { value: 800 }, uWaterY: { value: (geo.wl - 1.5) * VT / 1000 } },
    vertexShader: `attribute vec3 aDir; uniform float uTime, uNight, uScale, uWaterY; varying vec3 vC; varying float vA;
      vec3 hsv(float h){ return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); }
      void main(){
        float t = fract(uTime * 0.45 + aDir.z);
        vec3 p = position;
        p.x += aDir.x * 0.05 * t; p.z += aDir.y * 0.05 * t;
        p.y += 0.012 * t - 0.06 * t * t;
        p.y = max(p.y, uWaterY);
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(0.006 * uScale / -mv.z, 0.0, 9.0);
        float hue = fract(position.x * 1.5 + position.z * 1.5 + uTime * 0.08);
        vC = mix(vec3(0.85, 0.92, 1.0) * 0.9, hsv(hue) * 2.6 + 0.2, uNight);
        vA = (1.0 - t) * smoothstep(0.4, 1.5, gl_PointSize) * 0.85; }`,
    fragmentShader: `varying vec3 vC; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(vC, vA * smoothstep(0.5, 0.0, d)); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(g, mat); pts.frustumCulled = false; scene.add(pts);
  return { pts, mat };
}

// ---------------------------------------------------------------------------
// 金浦机场起降航班
// ---------------------------------------------------------------------------
function buildPlanes() {
  const C = new THREE.Vector3(-16.1, 0, 0.87); C.y = groundY(C.x, C.z);
  const hd = THREE.MathUtils.degToRad(136);
  const H = new THREE.Vector3(Math.sin(hd), 0, -Math.cos(hd)).normalize();
  const mk = () => {
    const g = new THREE.Group();
    const white = new THREE.MeshStandardMaterial({ color: '#f2f3f5', roughness: 0.4 });
    const fus = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.35, 12, 8), white); fus.rotation.x = Math.PI / 2; g.add(fus);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(12, 0.25, 2.4), white); wing.position.z = 0.5; g.add(wing);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.25, 2.4, 1.6), new THREE.MeshStandardMaterial({ color: '#2f5fa8' })); tail.position.set(0, 1.2, 5.2); g.add(tail);
    const stab = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.2, 1.2), white); stab.position.z = 5.4; g.add(stab);
    const lightMat = (c) => new THREE.MeshBasicMaterial({ color: c });
    const nav = [[-6, 0, 0.5, '#ff3030'], [6, 0, 0.5, '#30ff60'], [0, 0.6, 0, '#ffffff']].map(([x, y, z, c]) => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.45, 6, 4), lightMat(c)); m.position.set(x, y, z); g.add(m); return m; });
    g.userData.nav = nav;
    g.scale.setScalar(0.007);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    scene.add(g);
    return g;
  };
  const list = [];
  for (let i = 0; i < 3; i++) list.push({ g: mk(), phase: i / 3, mode: i % 2 });
  return { list, C, H };
}
function updatePlanes(t) {
  if (!planes || !planes.list) return;
  const { list, C, H } = planes;
  const T = 60;
  const up = new THREE.Vector3(0, 1, 0);
  for (const pl of list) {
    const u = ((t / T + pl.phase) % 1);
    let s, alt;
    if (pl.mode === 0) { // 进近落地：从西北方远处下滑
      if (u < 0.7) { const f = u / 0.7; s = -16 + f * 15.2; alt = 1.1 * (1 - f); }
      else { const f = (u - 0.7) / 0.3; s = -0.8 + (1 - Math.pow(1 - f, 2)) * 2.4; alt = 0; }
    } else { // 起飞：朝东南爬升
      if (u < 0.25) { const f = u / 0.25; s = -1.5 + f * f * 2.2; alt = 0; }
      else { const f = (u - 0.25) / 0.75; s = 0.7 + f * 18; alt = Math.pow(f, 1.2) * 1.8; }
    }
    const pos = C.clone().addScaledVector(H, s); pos.y = C.y + 0.012 + alt;
    const pitch = pl.mode === 0 ? (alt > 0 ? 0.05 : 0) : (alt > 0 ? 0.14 : 0);
    pl.g.position.copy(pos);
    pl.g.lookAt(pos.clone().sub(H)); pl.g.rotateX(pitch);
    const vis = inExtent(pos.x, pos.z, 0.2);
    pl.g.visible = vis;
    const blink = (t * 1.3 % 1) < 0.12;
    pl.g.userData.nav[2].visible = blink;
    pl.g.userData.nav.forEach((m) => m.scale.setScalar(0.6 + U.uNight.value * 1.6));
  }
}

// ---------------------------------------------------------------------------
// 航空障碍灯（高楼顶部闪烁红灯）
// ---------------------------------------------------------------------------
let beaconPts;
function buildBeacons(tall) {
  const P = [];
  for (const [x, y, z] of tall) P.push(x, y + 0.004, z);
  scene.updateMatrixWorld(true);
  for (const b of beacons) { const v = b.p.clone(); v.applyMatrix4(b.g.matrixWorld); P.push(v.x, v.y, v.z); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime, uNight: U.uNight, uScale: { value: 800 } },
    vertexShader: `uniform float uTime, uNight, uScale; varying float vA; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
      float ph = fract(uTime * 0.7 + fract(position.x * 13.1) * 0.3); vA = smoothstep(0.0, 0.1, ph) * smoothstep(0.45, 0.2, ph) * (0.25 + uNight);
      gl_PointSize = clamp(0.012 * uScale / -mv.z, 2.0, 7.0); }`,
    fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(vec3(3.0, 0.25, 0.15) * vA, vA * smoothstep(0.5, 0.1, d)); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  beaconPts = new THREE.Points(g, mat); beaconPts.frustumCulled = false; scene.add(beaconPts);
}

// ---------------------------------------------------------------------------
// 区界光幕
// ---------------------------------------------------------------------------
function curtainGeom(ring, step = 0.03) {
  const pts = [];
  for (let i = 0; i < ring.length; i += 2) pts.push([ring[i] / 1000, ring[i + 1] / 1000]);
  pts.push(pts[0]);
  const dense = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / step));
    for (let k = 0; k < n; k++) dense.push([ax + (bx - ax) * k / n, az + (bz - az) * k / n]);
  }
  dense.push(dense[0]);
  const pos = [], tt = [], idx = [];
  dense.forEach(([x, z], i) => { const y = groundY(x, z) + 0.003; pos.push(x, y, z, x, y, z); tt.push(0, 1); if (i) { const o = (i - 1) * 2; idx.push(o, o + 2, o + 1, o + 1, o + 2, o + 3); } });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aT', new THREE.Float32BufferAttribute(tt, 1));
  g.setIndex(idx);
  return g;
}
function curtainMat(color, h, a) {
  return new THREE.ShaderMaterial({
    uniforms: { uCol: { value: new THREE.Color(color) }, uH: { value: h }, uA: { value: a } },
    vertexShader: `attribute float aT; uniform float uH; varying float vT; void main(){ vT = aT; vec3 p = position; p.y += aT * uH; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
    fragmentShader: `uniform vec3 uCol; uniform float uA; varying float vT; void main(){ float a = uA * (pow(1.0 - vT, 2.2) * 0.9 + step(vT, 0.02) * 0.6); gl_FragColor = vec4(uCol, a); }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  });
}
function buildDistricts() {
  for (const d of meta.districts) {
    const grp = new THREE.Group();
    const mat = curtainMat('#8fd3ff', 0.05, 0.28);
    for (const r of d.rings) grp.add(new THREE.Mesh(curtainGeom(r), mat));
    grp.userData = { d, mat };
    scene.add(grp);
    districtObjs.push(grp);
  }
  const sg = new THREE.Group();
  const smat = curtainMat('#ffc26e', 0.14, 0.5);
  for (const r of meta.seoul) sg.add(new THREE.Mesh(curtainGeom(r), smat));
  smat.userData.a = 0.45;
  scene.add(sg); seoulCurtain = sg;
}
function districtAt(x, z) {
  for (const o of districtObjs) for (const r of o.userData.d.rings) if (pointInRing(x * 1000, z * 1000, r)) return o;
  return null;
}
let hoverD = null, selD = null;
function styleDistricts() {
  for (const o of districtObjs) {
    const m = o.userData.mat;
    const on = o === selD, hv = o === hoverD;
    m.uniforms.uH.value = on ? 0.32 : hv ? 0.14 : 0.05;
    m.userData.a = on ? 0.75 : hv ? 0.5 : 0.2;
    m.uniforms.uCol.value.set(on ? '#ffd28a' : '#8fd3ff');
  }
}

// ---------------------------------------------------------------------------
// 天气
// ---------------------------------------------------------------------------
function buildWeather() {
  const NR = IS_MOBILE ? 700 : 1600, NS = IS_MOBILE ? 600 : 1300;
  const rp = new Float32Array(NR * 2 * 3), rt2 = new Float32Array(NR * 2);
  for (let i = 0; i < NR; i++) { const x = Math.random(), y = Math.random(), z = Math.random(); rp.set([x, y, z, x, y, z], i * 6); rt2[i * 2] = 0; rt2[i * 2 + 1] = 1; }
  const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(rp, 3)); rg.setAttribute('aE', new THREE.BufferAttribute(rt2, 1));
  const common = { uTime: U.uTime, uC: { value: new THREE.Vector3() }, uS: { value: 4 }, uNight: U.uNight };
  const rain = new THREE.LineSegments(rg, new THREE.ShaderMaterial({
    uniforms: common,
    vertexShader: `attribute float aE; uniform float uTime, uS; uniform vec3 uC; varying float vE;
      void main(){ vec3 p = position; p.y = fract(p.y - uTime * 1.6); vec3 w = uC + (p - vec3(0.5, 0.0, 0.5)) * vec3(uS, uS * 0.6, uS);
        w.y -= aE * uS * 0.014; w.x += aE * uS * 0.003; vE = aE; gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0); }`,
    fragmentShader: `uniform float uNight; varying float vE; void main(){ gl_FragColor = vec4(mix(vec3(0.75, 0.8, 0.88), vec3(0.4, 0.45, 0.6), uNight), 0.2 * (1.0 - vE)); }`,
    transparent: true, depthWrite: false,
  }));
  const sp = new Float32Array(NS * 3); for (let i = 0; i < NS * 3; i++) sp[i] = Math.random();
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const snow = new THREE.Points(sg, new THREE.ShaderMaterial({
    uniforms: { ...common, uScale: { value: 800 } },
    vertexShader: `uniform float uTime, uS, uScale; uniform vec3 uC;
      void main(){ vec3 p = position; p.y = fract(p.y - uTime * 0.12); p.x = fract(p.x + sin(uTime * 0.5 + position.z * 20.0) * 0.01);
        vec3 w = uC + (p - vec3(0.5, 0.0, 0.5)) * vec3(uS, uS * 0.6, uS);
        vec4 mv = viewMatrix * vec4(w, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = clamp(uS * 0.004 * uScale / -mv.z, 1.0, 6.0); }`,
    fragmentShader: `void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(vec3(1.0), 0.85 * smoothstep(0.5, 0.1, d)); }`,
    transparent: true, depthWrite: false,
  }));
  rain.frustumCulled = snow.frustumCulled = false;
  rain.visible = snow.visible = false;
  scene.add(rain, snow);
  return { rain, snow, common };
}
function applyWeather() {
  const w = S.weather;
  if (weatherFx) { weatherFx.rain.visible = w === 'rain'; weatherFx.snow.visible = w === 'snow'; }
  U.uSnow.value = w === 'snow' ? 0.75 : 0;
  U.uWet.value = w === 'rain' ? 1 : 0;
  skyU.uCloud.value = w === 'clear' ? 0 : 0.75;
  if (chunksT.length) applySeason();
}

// ---------------------------------------------------------------------------
// 昼夜
// ---------------------------------------------------------------------------
const LAT = THREE.MathUtils.degToRad(37.57), DEC = THREE.MathUtils.degToRad(6);
function celestial(hour, dec) {
  const H = (hour - 12.4) / 24 * Math.PI * 2;
  const e = -Math.cos(dec) * Math.sin(H);
  const n = Math.sin(dec) * Math.cos(LAT) - Math.cos(dec) * Math.cos(H) * Math.sin(LAT);
  const u = Math.sin(dec) * Math.sin(LAT) + Math.cos(dec) * Math.cos(H) * Math.cos(LAT);
  return new THREE.Vector3(e, u, -n).normalize();
}
// 关键帧：按太阳高度角（度）
const KF = [
  { e: -20, top: '#02040b', hor: '#0a1122', bot: '#06080d', sun: '#8aa6ff', si: 0.0, hs: '#243457', hg: '#0e1016', hi: 0.4, fog: '#0b1224', wat: '#0a1626', exp: 1.0 },
  { e: -9, top: '#08112a', hor: '#1d2748', bot: '#0a0d15', sun: '#8aa6ff', si: 0.0, hs: '#2d3d66', hg: '#141620', hi: 0.45, fog: '#1a2340', wat: '#0f1f33', exp: 1.0 },
  { e: -3.5, top: '#1b2856', hor: '#b86a6e', bot: '#1c1a22', sun: '#ff6a3a', si: 0.2, hs: '#51598a', hg: '#2a2228', hi: 0.78, fog: '#6b5068', wat: '#27354e', exp: 1.0 },
  { e: 1, top: '#34528e', hor: '#ff9960', bot: '#2d2a2e', sun: '#ff7c3e', si: 1.6, hs: '#7d86b0', hg: '#4d3c33', hi: 0.95, fog: '#c7917a', wat: '#35506a', exp: 1.0 },
  { e: 7, top: '#4a74b4', hor: '#ffc38c', bot: '#3a3a3e', sun: '#ffb574', si: 2.6, hs: '#a4b6d8', hg: '#5f5244', hi: 0.9, fog: '#e0c2a2', wat: '#3a6480', exp: 1.0 },
  { e: 18, top: '#4f86cf', hor: '#d6e5ef', bot: '#434a52', sun: '#fff1dc', si: 3.2, hs: '#b9d0ee', hg: '#6f6454', hi: 1.0, fog: '#cfdde8', wat: '#3d7090', exp: 1.0 },
  { e: 60, top: '#3f7fd6', hor: '#cfe2f1', bot: '#434a52', sun: '#fffaf2', si: 3.5, hs: '#c2d8f2', hg: '#7a6e5c', hi: 1.05, fog: '#d5e3ee', wat: '#3a7394', exp: 1.0 },
];
const tmpA = new THREE.Color(), tmpB = new THREE.Color();
function kfColor(k, key, i, f) { tmpA.set(KF[i][key]); tmpB.set(KF[i + 1][key]); return tmpA.lerp(tmpB, f); }
function updateTime() {
  const hour = S.hour;
  const sd = celestial(hour, DEC), md = celestial(hour + 12.2, -DEC * 0.6);
  const el = THREE.MathUtils.radToDeg(Math.asin(sd.y));
  let i = 0; while (i < KF.length - 2 && el > KF[i + 1].e) i++;
  const f = THREE.MathUtils.clamp((el - KF[i].e) / (KF[i + 1].e - KF[i].e), 0, 1);
  const lerp = (k) => KF[i][k] + (KF[i + 1][k] - KF[i][k]) * f;
  const night = THREE.MathUtils.smoothstep(-el, -3, 7);
  U.uNight.value = night;
  const cloud = skyU.uCloud.value;
  skyU.uTop.value.copy(kfColor(0, 'top', i, f));
  skyU.uHorizon.value.copy(kfColor(0, 'hor', i, f));
  skyU.uBottom.value.copy(kfColor(0, 'bot', i, f));
  skyU.uSunDir.value.copy(sd); skyU.uMoonDir.value.copy(md);
  skyU.uSunCol.value.copy(kfColor(0, 'sun', i, f)).multiplyScalar(1 - cloud * 0.8);
  if (cloud > 0) { const g = new THREE.Color('#8f969e').multiplyScalar(1 - night * 0.85); skyU.uTop.value.lerp(g, cloud * 0.8); skyU.uHorizon.value.lerp(g.clone().multiplyScalar(1.1), cloud * 0.7); }
  // 主光：白天太阳，夜晚月光
  const useMoon = el < -2;
  const dir = useMoon ? md : sd;
  sun.userData.dir = dir.clone();
  if (useMoon) { sun.color.set('#9fb4ff'); sun.intensity = 0.13 * THREE.MathUtils.smoothstep(-el, 2, 8) * Math.max(0.2, md.y) * (1 - cloud * 0.7); }
  else { sun.color.copy(kfColor(0, 'sun', i, f)); sun.intensity = lerp('si') * THREE.MathUtils.smoothstep(el, -3, 2) * (1 - cloud * 0.72); }
  hemi.color.copy(kfColor(0, 'hs', i, f)); hemi.groundColor.copy(kfColor(0, 'hg', i, f)); hemi.intensity = lerp('hi') * (1 + cloud * 0.25);
  scene.fog.color.copy(kfColor(0, 'fog', i, f)); if (cloud) scene.fog.color.lerp(skyU.uHorizon.value, 0.6);
  U.uWaterCol.value.copy(kfColor(0, 'wat', i, f));
  U.uSkyRefl.value.copy(skyU.uHorizon.value).lerp(skyU.uTop.value, 0.4).multiplyScalar(0.55);
  // 亮灯比例：傍晚最多，深夜减少
  const h = hour;
  const lit = h >= 17 && h < 23.5 ? 0.62 : (h >= 23.5 || h < 1.5) ? 0.45 : h < 5.5 ? 0.22 : h < 8 ? 0.35 : 0.25;
  U.uLit.value = lit;
  for (const { mat, k, tower } of nightLit) {
    mat.emissiveIntensity = night * k;
    if (tower) mat.emissive.setHSL((U.uTime.value * 0.02) % 1, 0.7, 0.55);
  }
  bloom.strength = 0.12 + night * 0.5;
  bloom.threshold = THREE.MathUtils.lerp(1.3, 0.85, night);
  bloom.radius = 0.4 + night * 0.15;
  renderer.toneMappingExposure = THREE.MathUtils.lerp(1.02, 1.08, night);
  // UI
  const hh = Math.floor(h) % 24, mm = Math.floor((h % 1) * 60);
  $('clockTime').textContent = String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
  $('clockIcon').textContent = el > 0 ? '☀' : '☾';
  $('clockPhase').textContent = el < -12 ? (h < 5 || h > 23 ? '深夜' : '夜晚') : el < -2 ? (h < 12 ? '黎明' : '暮色') : el < 8 ? (h < 12 ? '清晨' : '黄昏') : h < 10.5 ? '上午' : h < 13.5 ? '正午' : '午后';
  $('timeSlider').value = h;
}

// ---------------------------------------------------------------------------
// 标签
// ---------------------------------------------------------------------------
const labels = [];
const SHORT = { bukhansan: '北汉山', namsan: 'N 首尔塔', yeouido: '63 大厦', banpo: '盘浦大桥喷泉', lotteworld: '乐天世界', olympicpark: '和平之门', jamsil: '蚕室主体育场', coex: 'COEX', worldcup: '世界杯体育场', gimpo: '金浦机场', ddp: 'DDP', seoulforest: '首尔林', gwanghwamun: '光化门广场' };
function addLabel(el, pos, opt) { $('labels').appendChild(el); labels.push({ el, pos, pri: 100, ...opt, vis: null }); }
function buildLabels() {
  LANDMARKS.forEach((L, i) => {
    const [x, z] = proj(L.lon, L.lat);
    const el = document.createElement('div'); el.className = 'lb lb-lm';
    el.innerHTML = `<div class="pill"><b>${i + 1}</b>${SHORT[L.id] || L.zh.replace(/（.*）/, '')}</div><div class="stem"></div><div class="dot"></div>`;
    el.addEventListener('click', (e) => { e.stopPropagation(); stopTour(); focusLandmark(i); });
    L.el = el;
    const top = { lotte: 1.16, namsan: 0.52, yeouido: 0.53, bukhansan: 0.02 }[L.id] ?? 0.03;
    let gy = groundY(x, z); if (L.id === 'namsan') gy = groups.namsan ? groups.namsan.position.y : gy;
    const txt = SHORT[L.id] || L.zh.replace(/（.*）/, '');
    const pri = L.id === 'namsan' ? -1 : PRI.indexOf(L.id);
    addLabel(el, new THREE.Vector3(x, gy + top, z), { type: 'lm', far: 60, near: 0, w: 34 + [...txt].reduce((a, ch) => a + (ch.charCodeAt(0) > 255 ? 12.5 : 7.2), 0), lmIdx: i, pri });
  });
  for (const d of meta.districts) {
    const el = document.createElement('div'); el.className = 'lb lb-d'; el.innerHTML = `${DISTRICT_ZH[d.ko] || d.ko}<small>${d.ko}</small>`;
    const x = d.c[0] / 1000, z = d.c[1] / 1000;
    addLabel(el, new THREE.Vector3(x, groundY(x, z) + 0.05, z), { type: 'd', far: 55, near: 5.5 });
  }
  for (const [nm, lon, lat, h] of PEAKS) {
    const [x, z] = proj(lon, lat);
    const el = document.createElement('div'); el.className = 'lb lb-pk'; el.innerHTML = `<i>▲</i>${nm}<em>${h}m</em>`;
    addLabel(el, new THREE.Vector3(x, groundY(x, z) + 0.03, z), { type: 'pk', far: 26, near: 0 });
  }
  for (const [nm, lon, lat] of BRIDGES) {
    const [x, z] = proj(lon, lat);
    const el = document.createElement('div'); el.className = 'lb lb-br'; el.textContent = nm;
    addLabel(el, new THREE.Vector3(x, 0.04, z), { type: 'br', far: 11, near: 0 });
  }
  for (const [nm, lon, lat] of [['汉 江', 126.915, 37.534], ['汉 江', 127.075, 37.527], ['中浪川', 127.047, 37.565], ['炭川', 127.068, 37.505], ['安养川', 126.873, 37.527]]) {
    const [x, z] = proj(lon, lat);
    const el = document.createElement('div'); el.className = 'lb lb-rv'; el.textContent = nm;
    addLabel(el, new THREE.Vector3(x, 0.01, z), { type: 'rv', far: nm.includes('汉') ? 40 : 12, near: 0 });
  }
}
const vtmp = new THREE.Vector3();
let W = 1, Hh = 1;
const PRI = ['namsan', 'lotte', 'gyeongbokgung', 'yeouido', 'bukhansan', 'gangnam', 'ddp', 'banpo', 'jamsil', 'coex', 'gimpo', 'worldcup', 'seoulstation', 'gwanghwamun', 'sungnyemun', 'olympicpark', 'lotteworld', 'changdeokgung', 'cheonggyecheon', 'yongsan', 'seoulforest', 'heunginjimun'];
function updateLabels() {
  const show = S.layers.labels;
  const camPos = camera.position;
  const dist = camera.position.distanceTo(controls.target);
  const placed = [];
  for (const L of labels) {
    let vis = show || L.type === 'lm';
    const d = camPos.distanceTo(L.pos);
    if (vis) vis = d < L.far && dist > L.near;
    if (vis) { vtmp.copy(L.pos).project(camera); vis = vtmp.z < 1 && Math.abs(vtmp.x) < 1.1 && Math.abs(vtmp.y) < 1.1; }
    const x = (vtmp.x * 0.5 + 0.5) * W, y = (-vtmp.y * 0.5 + 0.5) * Hh;
    if (vis && L.type === 'lm') {
      const s = THREE.MathUtils.clamp(1.25 - d / 50, 0.72, 1);
      const r = [x - L.w * s / 2 - 3, y - 44 * s, x + L.w * s / 2 + 3, y - 18 * s];
      if (L.lmIdx !== S.focus && placed.some((q) => r[0] < q[2] && r[2] > q[0] && r[1] < q[3] && r[3] > q[1])) vis = false;
      else placed.push(r);
    }
    if (vis !== L.vis) { L.el.style.display = vis ? '' : 'none'; L.vis = vis; }
    if (!vis) continue;
    if (L.type === 'lm') {
      const s = THREE.MathUtils.clamp(1.25 - d / 50, 0.72, 1);
      L.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%) scale(${s.toFixed(3)})`;
      L.el.style.zIndex = String(1000 - Math.round(d * 10));
    } else {
      const fade = L.type === 'd' ? THREE.MathUtils.clamp((dist - L.near) / 3, 0, 1) * THREE.MathUtils.clamp((L.far - d) / 8, 0, 1) : THREE.MathUtils.clamp((L.far - d) / (L.far * 0.3), 0, 1);
      L.el.style.opacity = fade.toFixed(2);
      L.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
    }
  }
}

// ---------------------------------------------------------------------------
// 相机飞行 / 巡游
// ---------------------------------------------------------------------------
function camState() {
  const off = camera.position.clone().sub(controls.target);
  const dist = off.length();
  const polar = Math.acos(THREE.MathUtils.clamp(off.y / dist, -1, 1));
  const az = Math.atan2(off.x, -off.z); // 相机所在方位（0=北）
  return { target: controls.target.clone(), dist, polar, az };
}
function applyCam(st) {
  const sp = Math.sin(st.polar);
  camera.position.set(st.target.x + st.dist * sp * Math.sin(st.az), st.target.y + st.dist * Math.cos(st.polar), st.target.z - st.dist * sp * Math.cos(st.az));
  controls.target.copy(st.target);
  camera.lookAt(st.target);
}
const ease = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
function flyTo(end, dur, onDone) {
  const start = camState();
  let daz = end.az - start.az; daz = Math.atan2(Math.sin(daz), Math.cos(daz));
  const travel = start.target.distanceTo(end.target);
  const bump = Math.min(1.4, travel / Math.max(start.dist, end.dist, 0.5) * 0.55);
  if (REDUCED) dur = 0.01;
  S.flight = { start, end, daz, bump, t: 0, dur, onDone };
  controls.enabled = false;
}
function stepFlight(dt) {
  const F = S.flight; if (!F) return;
  F.t = Math.min(1, F.t + dt / F.dur);
  const e = ease(F.t);
  const st = {
    target: F.start.target.clone().lerp(F.end.target, e),
    dist: Math.exp(Math.log(F.start.dist) + (Math.log(F.end.dist) - Math.log(F.start.dist)) * e) * (1 + F.bump * Math.sin(Math.PI * e)),
    polar: F.start.polar + (F.end.polar - F.start.polar) * e - Math.sin(Math.PI * e) * 0.12 * F.bump,
    az: F.start.az + F.daz * e,
  };
  applyCam(st);
  if (F.t >= 1) { S.flight = null; controls.enabled = true; controls.update(); F.onDone && F.onDone(); }
}
const d2r = THREE.MathUtils.degToRad;
function viewFor(L) {
  const [x, z] = proj(L.lon, L.lat);
  const [dist, polar, az] = L.view;
  return { target: new THREE.Vector3(x, focusY(L), z), dist: IS_MOBILE ? dist * 1.35 : dist, polar: d2r(polar), az: d2r(az) };
}
const HOME = () => ({ target: new THREE.Vector3(0.5, 0.05, 1.2), dist: IS_MOBILE ? 58 : 41, polar: d2r(IS_MOBILE ? 42 : 50), az: d2r(194) });
function focusLandmark(i, fromTour = false) {
  const L = LANDMARKS[i];
  S.focus = i;
  selD = null; styleDistricts();
  const v = viewFor(L);
  const travel = controls.target.distanceTo(v.target);
  flyTo(v, THREE.MathUtils.clamp(2.2 + travel * 0.16, 2.6, fromTour ? 6.5 : 4.5), () => { S.orbitSpin = fromTour ? 1 : 0.5; });
  showCard(i);
  document.querySelectorAll('#placeList button').forEach((b, k) => b.classList.toggle('on', k === i));
  LANDMARKS.forEach((l, k) => l.el && l.el.classList.toggle('on', k === i));
  const li = document.querySelectorAll('#placeList li')[i]; if (li && !IS_MOBILE) li.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  if (IS_MOBILE) closeSheets();
}
function showCard(i) {
  const L = LANDMARKS[i];
  $('card').hidden = false;
  $('cardCat').textContent = L.cat;
  $('cardTitle').textContent = L.zh;
  $('cardSub').textContent = `${L.ko} · ${L.en}`;
  $('cardDesc').textContent = L.desc;
  $('cardFacts').innerHTML = L.facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
  $('cardCoord').textContent = `${L.lat.toFixed(4)}°N  ${L.lon.toFixed(4)}°E`;
  $('cardStep').textContent = S.tour ? `巡游 第 ${i + 1} / ${LANDMARKS.length} 站` : `${i + 1} / ${LANDMARKS.length}`;
}
let tourTimer = 0;
const DWELL = 7.5;
function startTour() {
  S.tour = true; $('btnTour').classList.add('playing'); $('tourIcon').textContent = '❚❚'; $('tourText').textContent = '暂停巡游';
  $('tourBar').classList.add('on');
  const next = S.focus == null ? 0 : (S.focus + 1) % LANDMARKS.length;
  S.tourIdx = next; tourTimer = 0;
  focusLandmark(next, true);
}
function stopTour() {
  if (!S.tour) return;
  S.tour = false; $('btnTour').classList.remove('playing'); $('tourIcon').textContent = '▶'; $('tourText').textContent = '地标飞越巡游';
  $('tourBar').classList.remove('on');
  if (S.focus != null) showCard(S.focus);
}
function stepTour(dt) {
  if (!S.tour || S.flight) return;
  tourTimer += dt;
  $('tourProg').style.width = ((S.tourIdx + Math.min(1, tourTimer / DWELL)) / LANDMARKS.length * 100).toFixed(2) + '%';
  if (tourTimer > DWELL) {
    tourTimer = 0;
    S.tourIdx = (S.tourIdx + 1) % LANDMARKS.length;
    focusLandmark(S.tourIdx, true);
  }
}

// ---------------------------------------------------------------------------
// 拾取（沿视线步进高度场）
// ---------------------------------------------------------------------------
const ray = new THREE.Raycaster();
function pickGround(cx, cy) {
  const r = canvas.getBoundingClientRect();
  ray.setFromCamera(new THREE.Vector2((cx - r.left) / r.width * 2 - 1, -(cy - r.top) / r.height * 2 + 1), camera);
  const o = ray.ray.origin, d = ray.ray.direction;
  let t = 0; const maxT = 200;
  for (let i = 0; i < 600 && t < maxT; i++) {
    const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t;
    const gy = inExtent(x, z) ? groundY(x, z) : -0.05;
    const gap = y - gy;
    if (gap < 0.002) return inExtent(x, z) ? new THREE.Vector3(x, gy, z) : null;
    t += Math.max(0.004, gap * 0.6);
  }
  return null;
}

// ---------------------------------------------------------------------------
// 小地图
// ---------------------------------------------------------------------------
const mm = $('mm'), mctx = mm.getContext('2d');
let mmBase;
function buildMinimap(waterImg) {
  const w = mm.width, h = mm.height;
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  g.fillStyle = '#171b25'; g.fillRect(0, 0, w, h);
  const toPx = (x, z) => [(x / 1000 - geo.X0) / (geo.X1 - geo.X0) * w, (z / 1000 - geo.Z0) / (geo.Z1 - geo.Z0) * h];
  g.fillStyle = '#262d3b';
  g.beginPath(); for (const r of meta.seoul) { for (let i = 0; i < r.length; i += 2) { const [x, y] = toPx(r[i], r[i + 1]); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.closePath(); } g.fill();
  // 河流
  const t = document.createElement('canvas'); t.width = w; t.height = h; const tg = t.getContext('2d');
  tg.drawImage(waterImg, 0, 0, w, h);
  const id = tg.getImageData(0, 0, w, h);
  for (let i = 0; i < id.data.length; i += 4) { const a = id.data[i]; id.data[i] = 79; id.data[i + 1] = 143; id.data[i + 2] = 176; id.data[i + 3] = Math.min(255, a * 1.6); }
  tg.putImageData(id, 0, 0);
  g.drawImage(t, 0, 0);
  g.strokeStyle = 'rgba(160, 200, 230, .35)'; g.lineWidth = 0.7;
  for (const d of meta.districts) for (const r of d.rings) { g.beginPath(); for (let i = 0; i < r.length; i += 2) { const [x, y] = toPx(r[i], r[i + 1]); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.closePath(); g.stroke(); }
  g.strokeStyle = 'rgba(255, 194, 110, .8)'; g.lineWidth = 1.2;
  for (const r of meta.seoul) { g.beginPath(); for (let i = 0; i < r.length; i += 2) { const [x, y] = toPx(r[i], r[i + 1]); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.closePath(); g.stroke(); }
  g.fillStyle = '#f2b35e';
  LANDMARKS.forEach((L) => { const [x, z] = proj(L.lon, L.lat); const [px, py] = toPx(x * 1000, z * 1000); g.beginPath(); g.arc(px, py, 1.6, 0, 7); g.fill(); });
  mmBase = c;
}
const ndcC = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
function drawMinimap() {
  if (!mmBase) return;
  const w = mm.width, h = mm.height;
  mctx.drawImage(mmBase, 0, 0);
  const pts = ndcC.map(([nx, ny]) => {
    ray.setFromCamera(new THREE.Vector2(nx, ny), camera);
    const o = ray.ray.origin, d = ray.ray.direction;
    let t = d.y < -1e-4 ? (0 - o.y) / d.y : 80; t = Math.min(t, 80);
    return [(o.x + d.x * t - geo.X0) / (geo.X1 - geo.X0) * w, (o.z + d.z * t - geo.Z0) / (geo.Z1 - geo.Z0) * h];
  });
  mctx.fillStyle = 'rgba(116, 199, 207, .16)'; mctx.strokeStyle = 'rgba(116, 199, 207, .9)'; mctx.lineWidth = 1.2;
  mctx.beginPath(); pts.forEach(([x, y], i) => i ? mctx.lineTo(x, y) : mctx.moveTo(x, y)); mctx.closePath(); mctx.fill(); mctx.stroke();
  const tx = (controls.target.x - geo.X0) / (geo.X1 - geo.X0) * w, ty = (controls.target.z - geo.Z0) / (geo.Z1 - geo.Z0) * h;
  mctx.fillStyle = '#fff'; mctx.beginPath(); mctx.arc(tx, ty, 2.6, 0, 7); mctx.fill();
  const [lon, lat] = unproj(controls.target.x, controls.target.z);
  $('mmCoord').textContent = `${lat.toFixed(3)}°N ${lon.toFixed(3)}°E`;
  const d = districtAt(controls.target.x, controls.target.z);
  $('mmDistrict').textContent = d ? `${DISTRICT_ZH[d.userData.d.ko]} ${d.userData.d.ko}` : '首尔近郊';
}

// ---------------------------------------------------------------------------
// UI 绑定
// ---------------------------------------------------------------------------
function closeSheets() { document.querySelectorAll('.sheet').forEach((s) => s.classList.remove('open')); }
function bindUI() {
  const list = $('placeList');
  LANDMARKS.forEach((L, i) => {
    const li = document.createElement('li');
    li.innerHTML = `<button><span class="n">${String(i + 1).padStart(2, '0')}</span><span class="nm">${L.zh}</span><span class="ct">${L.cat}</span></button>`;
    li.firstChild.addEventListener('click', () => { stopTour(); focusLandmark(i); });
    list.appendChild(li);
  });
  $('timeSlider').addEventListener('input', (e) => { S.hour = +e.target.value; S.timePlay = false; $('timePlay').classList.remove('on'); updateTime(); markPreset(); });
  $('timePlay').addEventListener('click', () => { S.timePlay = !S.timePlay; $('timePlay').classList.toggle('on', S.timePlay); $('timePlay').textContent = S.timePlay ? '❚❚ 暂停' : '▶ 流动'; });
  document.querySelectorAll('#timePresets button').forEach((b) => b.addEventListener('click', () => animateHour(+b.dataset.t)));
  const seg = (id, key, fn) => document.querySelectorAll(`#${id} button`).forEach((b) => b.addEventListener('click', () => {
    S[key] = b.dataset.v; document.querySelectorAll(`#${id} button`).forEach((x) => x.classList.toggle('on', x === b)); fn();
  }));
  seg('seasonSeg', 'season', applySeason);
  seg('weatherSeg', 'weather', () => { applyWeather(); updateTime(); });
  document.querySelectorAll(`#seasonSeg button`).forEach((x) => x.classList.toggle('on', x.dataset.v === S.season));
  document.querySelectorAll(`#weatherSeg button`).forEach((x) => x.classList.toggle('on', x.dataset.v === S.weather));
  document.querySelectorAll('#layerToggles input').forEach((inp) => inp.addEventListener('change', () => { S.layers[inp.dataset.layer] = inp.checked; applyLayers(); }));
  $('btnHome').addEventListener('click', () => { stopTour(); S.focus = null; $('card').hidden = true; selD = null; styleDistricts(); flyTo(HOME(), 3.2); clearOn(); });
  $('btnTour').addEventListener('click', () => (S.tour ? stopTour() : startTour()));
  $('btnCompass').addEventListener('click', () => { const st = camState(); flyTo({ ...st, az: Math.PI }, 1.2); });
  $('cardX').addEventListener('click', () => { stopTour(); $('card').hidden = true; S.focus = null; clearOn(); });
  $('cardPrev').addEventListener('click', () => { const i = ((S.focus ?? 0) - 1 + LANDMARKS.length) % LANDMARKS.length; if (S.tour) { S.tourIdx = i; tourTimer = 0; } focusLandmark(i, S.tour); });
  $('cardNext').addEventListener('click', () => { const i = ((S.focus ?? -1) + 1) % LANDMARKS.length; if (S.tour) { S.tourIdx = i; tourTimer = 0; } focusLandmark(i, S.tour); });
  $('btnPlaces').addEventListener('click', () => { const o = $('places').classList.contains('open'); closeSheets(); if (!o) $('places').classList.add('open'); });
  $('btnControls').addEventListener('click', () => { const o = $('controls').classList.contains('open'); closeSheets(); if (!o) $('controls').classList.add('open'); });
  document.querySelectorAll('.sheet-x').forEach((b) => b.addEventListener('click', closeSheets));
  // 画布交互
  const interrupt = () => { S.lastInteract = performance.now(); S.orbitSpin = 0; if (S.tour) stopTour(); if (S.flight) { S.flight = null; controls.enabled = true; } $('hint').style.opacity = 0; };
  canvas.addEventListener('pointerdown', (e) => { interrupt(); downAt = [e.clientX, e.clientY]; });
  canvas.addEventListener('wheel', interrupt, { passive: true });
  let downAt = null, hoverT = 0;
  canvas.addEventListener('pointerup', (e) => {
    if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 5) return;
    const p = pickGround(e.clientX, e.clientY); if (!p) return;
    const d = districtAt(p.x, p.z);
    selD = d === selD ? null : d; styleDistricts();
    if (d && selD) {
      const dd = d.userData.d; const x = dd.c[0] / 1000, z = dd.c[1] / 1000;
      const st = camState();
      flyTo({ target: new THREE.Vector3(x, groundY(x, z), z), dist: Math.max(6, Math.sqrt(dd.area) * 2.3), polar: d2r(48), az: st.az }, 2.4);
      $('card').hidden = true; S.focus = null; clearOn();
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.buttons || e.pointerType === 'touch') { $('tip').hidden = true; return; }
    const now = performance.now(); if (now - hoverT < 90) return; hoverT = now;
    const p = pickGround(e.clientX, e.clientY);
    const d = p ? districtAt(p.x, p.z) : null;
    if (d !== hoverD) { hoverD = d; styleDistricts(); }
    const tip = $('tip');
    if (p) {
      const hm = heightM(p.x, p.z);
      const r = $('stage').getBoundingClientRect();
      tip.innerHTML = d ? `<b>${DISTRICT_ZH[d.userData.d.ko]}</b>${d.userData.d.ko} <span>· ${d.userData.d.area.toFixed(1)} km² · 海拔 ${Math.round(hm)} m</span>` : `<b>首尔近郊</b><span>海拔 ${Math.round(hm)} m</span>`;
      tip.style.left = (e.clientX - r.left + 14) + 'px'; tip.style.top = (e.clientY - r.top + 14) + 'px'; tip.hidden = false;
    } else tip.hidden = true;
  });
  canvas.addEventListener('pointerleave', () => { $('tip').hidden = true; hoverD = null; styleDistricts(); });
  mm.addEventListener('click', (e) => {
    const r = mm.getBoundingClientRect();
    const x = geo.X0 + (e.clientX - r.left) / r.width * (geo.X1 - geo.X0), z = geo.Z0 + (e.clientY - r.top) / r.height * (geo.Z1 - geo.Z0);
    interrupt(); const st = camState(); flyTo({ ...st, target: new THREE.Vector3(x, groundY(x, z), z), dist: Math.min(st.dist, 9) }, 2);
  });
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' && e.target.type === 'range') return;
    const st = camState();
    const pan = st.dist * 0.08;
    const fx = -Math.sin(st.az), fz = Math.cos(st.az);
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      interrupt();
      const v = new THREE.Vector3();
      if (e.key === 'ArrowUp') v.set(fx, 0, fz); if (e.key === 'ArrowDown') v.set(-fx, 0, -fz);
      if (e.key === 'ArrowLeft') v.set(-fz, 0, fx); if (e.key === 'ArrowRight') v.set(fz, 0, -fx);
      controls.target.addScaledVector(v, pan); camera.position.addScaledVector(v, pan); e.preventDefault();
    } else if (e.key === '+' || e.key === '=') { interrupt(); flyTo({ ...st, dist: st.dist * 0.7 }, 0.5); }
    else if (e.key === '-') { interrupt(); flyTo({ ...st, dist: st.dist * 1.4 }, 0.5); }
    else if (e.key === 'h' || e.key === 'H') $('btnHome').click();
    else if (e.key === 't' || e.key === 'T') $('btnTour').click();
    else if (e.key === 'n' || e.key === 'N') animateHour(S.hour > 7 && S.hour < 18.5 ? 21.3 : 12.2);
  });
  markPreset();
}
function clearOn() { document.querySelectorAll('#placeList button').forEach((b) => b.classList.remove('on')); LANDMARKS.forEach((l) => l.el && l.el.classList.remove('on')); }
function markPreset() { document.querySelectorAll('#timePresets button').forEach((b) => b.classList.toggle('on', Math.abs(+b.dataset.t - S.hour) < 0.3)); }
let hourAnim = null;
function animateHour(target) {
  let d = target - S.hour; if (d < -12) d += 24; if (d > 12) d -= 24;
  hourAnim = { from: S.hour, d, t: 0 };
  S.timePlay = false; $('timePlay').classList.remove('on'); $('timePlay').textContent = '▶ 流动';
}
function applyLayers() {
  const L = S.layers;
  districtObjs.forEach((o) => (o.visible = L.districts)); if (seoulCurtain) seoulCurtain.visible = L.districts;
  $('labels').classList.toggle('lb-hidden', !L.labels);
  if (traffic) traffic.pts.visible = L.traffic;
  chunksT.forEach((m) => (m.visible = L.trees));
  chunksB.forEach((m) => (m.visible = L.buildings));
}

// ---------------------------------------------------------------------------
// 每帧
// ---------------------------------------------------------------------------
function resize() {
  const r = $('stage').getBoundingClientRect();
  W = r.width; Hh = r.height;
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(W, Hh, false);
  composer.setPixelRatio(pixelRatio);
  composer.setSize(W, Hh);
  bloom.resolution.set(W * pixelRatio / 2, Hh * pixelRatio / 2);
  camera.aspect = W / Hh; camera.updateProjectionMatrix();
  tiltH.uniforms.uDir.value.set(1 / (W * pixelRatio), 0); tiltV.uniforms.uDir.value.set(0, 1 / (Hh * pixelRatio));
  const scale = Hh * pixelRatio / (2 * Math.tan(d2r(camera.fov / 2)));
  for (const m of [traffic?.mat, fountain?.mat, beaconPts?.material, weatherFx?.snow.material]) if (m?.uniforms?.uScale) m.uniforms.uScale.value = scale;
}
const focal = () => Hh / (2 * Math.tan(d2r(camera.fov / 2)));
const sph = new THREE.Sphere();
function updateLOD() {
  const f = focal();
  const cp = camera.position;
  const lodK = S.lodPx;
  const upd = (mesh, budget) => {
    sph.copy(mesh.boundingSphere).applyMatrix4(mesh.matrixWorld);
    const d = Math.max(0.05, cp.distanceTo(sph.center) - sph.radius);
    const minSize = lodK * d * 1000 / f; // 米
    const sz = mesh.userData.size;
    let lo = 0, hi = sz.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (sz[m] >= minSize) lo = m + 1; else hi = m; }
    mesh.count = Math.max(0, Math.floor(lo * budget));
  };
  for (const m of chunksB) upd(m, S.buildingBudget);
  for (const m of chunksT) upd(m, 1);
}
function updateShadow() {
  const dist = camera.position.distanceTo(controls.target);
  const R = THREE.MathUtils.clamp(dist * 0.75, 0.6, 30);
  const dir = sun.userData.dir || new THREE.Vector3(0, 1, 0);
  const cam = sun.shadow.camera;
  // 贴图按纹素对齐，减少闪烁
  const tx = controls.target.x, tz = controls.target.z;
  const texel = (2 * R) / SM;
  const sx = Math.round(tx / texel) * texel, sz = Math.round(tz / texel) * texel;
  sun.target.position.set(sx, 0, sz);
  sun.position.set(sx + dir.x * 60, Math.max(dir.y, 0.05) * 60, sz + dir.z * 60);
  cam.left = -R; cam.right = R; cam.top = R; cam.bottom = -R; cam.near = 1; cam.far = 140;
  cam.updateProjectionMatrix();
  sun.shadow.bias = -0.00012 - R * 0.00001;
  sun.shadow.normalBias = R * 0.0008;
  sun.castShadow = sun.intensity > 0.05;
}
let last = performance.now(), fpsAcc = 0, fpsN = 0, fpsT = 0, mmT = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  U.uTime.value += dt;
  const t = U.uTime.value;
  if (hourAnim) {
    hourAnim.t = Math.min(1, hourAnim.t + dt / 2.2);
    S.hour = (hourAnim.from + hourAnim.d * ease(hourAnim.t) + 24) % 24;
    if (hourAnim.t >= 1) { hourAnim = null; markPreset(); }
    updateTime();
  } else if (S.timePlay) { S.hour = (S.hour + dt * 0.35) % 24; updateTime(); }
  else if ((t * 10 | 0) % 5 === 0) for (const { mat, tower } of nightLit) if (tower) mat.emissive.setHSL((t * 0.02) % 1, 0.7, 0.55);
  stepFlight(dt);
  stepTour(dt);
  if (!S.flight) {
    if (S.orbitSpin && !REDUCED) { const st = camState(); st.az += dt * d2r(3.2) * S.orbitSpin; applyCam(st); }
    controls.update();
  }
  // 雾：随相机距离
  const dist = camera.position.distanceTo(controls.target);
  scene.fog.near = dist * 1.1 + 2; scene.fog.far = dist * 3.4 + 30;
  sky.position.copy(camera.position);
  U.uGlowK.value = THREE.MathUtils.clamp(dist / 9, 0.4, 1);
  const cf = THREE.MathUtils.clamp(dist / 10, 0.3, 1) * (1 - U.uNight.value * 0.35);
  for (const o of districtObjs) { const m = o.userData.mat; m.uniforms.uA.value = (m.userData.a ?? 0.2) * (o === selD ? 1 : cf); }
  if (seoulCurtain) { const m = seoulCurtain.children[0].material; m.uniforms.uA.value = m.userData.a * cf; }
  updateShadow();
  updateLOD();
  updateTraffic(dt);
  updatePlanes(t);
  if (weatherFx && S.weather !== 'clear') { weatherFx.common.uC.value.copy(controls.target); weatherFx.common.uS.value = THREE.MathUtils.clamp(dist * 0.9, 1, 30); }
  // 移轴：俯视时弱，斜视时强
  const polar = camState().polar;
  const tiltAmt = S.layers.tilt ? THREE.MathUtils.clamp((polar - 0.4) * 2.2, 0, 1.6) * pixelRatio * THREE.MathUtils.clamp(1.3 - dist / 40, 0.5, 1) : 0;
  tiltH.enabled = tiltV.enabled = tiltAmt > 0.05;
  tiltH.uniforms.uAmount.value = tiltV.uniforms.uAmount.value = tiltAmt;
  $('needle').style.transform = `rotate(${-90 + THREE.MathUtils.radToDeg(Math.PI - camState().az)}deg)`;
  composer.render(dt);
  updateLabels();
  if (now - mmT > 120) { mmT = now; drawMinimap(); }
  // 自适应画质
  fpsAcc += dt; fpsN++;
  if (!LOCK_Q && now - fpsT > 2500 && fpsN > 20) {
    const fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; fpsT = now;
    if (fps < 28 && pixelRatio > 0.75) { pixelRatio = Math.max(0.75, pixelRatio - 0.25); S.lodPx = Math.min(3.5, S.lodPx + 0.4); resize(); }
    else if (fps > 55 && pixelRatio < Math.min(devicePixelRatio || 1, MAX_PR)) { pixelRatio = Math.min(MAX_PR, pixelRatio + 0.25); S.lodPx = Math.max(IS_MOBILE ? 2.2 : 1.3, S.lodPx - 0.3); resize(); }
  }
}

// ---------------------------------------------------------------------------
// 启动
// ---------------------------------------------------------------------------
async function main() {
  const gl = renderer.getContext();
  if (!gl) throw new Error('WebGL 不可用');
  ldMsg.textContent = '载入地形、建筑与道路数据…';
  const [metaBuf, terrBuf, bldBuf, treeBuf, ground, night, water, mask] = await Promise.all([
    fetchBuf('data/meta.json', 'meta'), fetchBuf('data/terrain.bin', 'terr'), fetchBuf('data/buildings.bin', 'bld'), fetchBuf('data/trees.bin', 'tree'),
    loadTex('data/ground.jpg', 'g'), loadTex('data/night.jpg', 'n', false), loadTex('data/water.png', 'w', false), loadTex('data/mask.png', 'm', false),
  ]);
  meta = JSON.parse(new TextDecoder().decode(metaBuf));
  initGeo(meta, new Int16Array(terrBuf));
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  ground.anisotropy = aniso; night.anisotropy = aniso;
  ldMsg.textContent = '搭建地形与汉江…';
  await tick();
  buildTerrain({ ground, night, water, mask });
  buildPlinth();
  ldMsg.textContent = '摆放 ' + (meta.buildings).toLocaleString('zh-CN') + ' 栋建筑…';
  await tick();
  const { n, tall } = buildBuildings(bldBuf);
  ldMsg.textContent = '种树、架桥、放出车流…';
  await tick();
  buildTrees(treeBuf);
  const paths = buildRoads();
  traffic = buildTraffic(paths);
  fountain = buildFountain(paths);
  planes = buildPlanes();
  groups = buildLandmarkModels(scene);
  buildBeacons(tall);
  buildDistricts(); styleDistricts();
  weatherFx = buildWeather(); applyWeather();
  buildLabels();
  labels.sort((a, b) => a.pri - b.pri);
  const wimg = await new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.src = 'data/water.png'; });
  buildMinimap(wimg);
  bindUI();
  applyLayers();
  $('stats').innerHTML = `25 区 · ${n.toLocaleString('zh-CN')} 栋建筑 · ${(meta.trees / 10000).toFixed(0)} 万棵树<br>${meta.roads.length.toLocaleString('zh-CN')} 段主干道 · 22 处地标 · 真实地形`;
  resize();
  window.addEventListener('resize', resize);
  updateTime();
  // 开场：从高空俯冲到全景
  const home = HOME();
  const cam0 = Q.get('cam');
  if (cam0) { // 调试/截图：cam=x,z,dist,polar,az
    const [x, z, d, p, a] = cam0.split(',').map(Number);
    applyCam({ target: new THREE.Vector3(x, groundY(x, z), z), dist: d, polar: d2r(p), az: d2r(a) });
  } else {
    applyCam({ ...home, dist: home.dist * 1.7, polar: d2r(18), az: home.az - 0.5 });
    flyTo(home, 4.2);
  }
  if (Q.get('lm')) { const i = LANDMARKS.findIndex((l) => l.id === Q.get('lm')); if (i >= 0) { S.flight = null; controls.enabled = true; const v = viewFor(LANDMARKS[i]); applyCam(v); showCard(i); S.focus = i; } }
  requestAnimationFrame(frame);
  setTimeout(() => $('loader').classList.add('done'), 150);
  setTimeout(() => { $('hint').style.opacity = 0; }, 9000);
  window.__atlas = { viewFor, showCard, sun, hemi, scene, bloom, S, camera, controls, applyCam, groundY, updateTime, focusLandmark, startTour, LANDMARKS, renderer, U };
}
const tick = () => new Promise((r) => setTimeout(r, 0));
main().catch((e) => { console.error(e); ldMsg.textContent = '载入失败：' + e.message; });
