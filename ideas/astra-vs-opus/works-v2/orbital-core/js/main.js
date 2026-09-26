import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { buildOrbitalCore } from './model.js';
import { CoreAudio } from './audio.js';

const $ = (s) => document.querySelector(s);
const canvas = $('#scene');
const loader = $('#loader');
const params = new URLSearchParams(location.search);
if (params.has('cover')) document.body.classList.add('cover-mode');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ------------------------------------------------------------------ */
/* Renderer                                                            */
/* ------------------------------------------------------------------ */
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
} catch (err) {
  loader.classList.add('is-done');
  $('#fail').hidden = false;
  throw err;
}
const DPR_MAX = Math.min(window.devicePixelRatio || 1, 2);
let DPR = DPR_MAX;
renderer.setPixelRatio(DPR);
renderer.setSize(innerWidth, innerHeight, false);
// Tried AgX (Blender 4.x default view transform) first: it desaturates this monochrome blue palette
// into grey haze. ACES keeps the deep cobalt blacks, so it is the default; ?tm=agx switches back.
renderer.toneMapping = params.get('tm') === 'agx' ? THREE.AgXToneMapping : THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const HORIZON = new THREE.Color('#071424');
scene.fog = new THREE.FogExp2(HORIZON, 0.042);

/* ---------- Studio environment (a tiny "HDRI" baked with PMREM) ---------- */
function buildEnvironment() {
  const pm = new THREE.PMREMGenerator(renderer);
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(
    new THREE.SphereGeometry(20, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `varying vec3 vP; void main(){ float y = normalize(vP).y;
        vec3 top = vec3(0.012,0.02,0.035); vec3 hor = vec3(0.03,0.06,0.11); vec3 bot = vec3(0.004,0.006,0.01);
        vec3 c = y > 0.0 ? mix(hor, top, smoothstep(0.0, 0.7, y)) : mix(hor, bot, smoothstep(0.0, 0.25, -y));
        gl_FragColor = vec4(c, 1.0); }`,
    }),
  ));
  const panel = ([w, h], rgb, pos) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(...rgb), side: THREE.DoubleSide }));
    m.position.set(...pos);
    m.lookAt(0, 0, 0);
    env.add(m);
  };
  panel([9, 4], [3.6, 3.8, 4.2], [0, 10, 3]);          // overhead key softbox
  panel([1.4, 11], [0.35, 1.1, 4.2], [-9, 1, -3]);     // cold blue strip, left
  panel([1.2, 11], [2.4, 2.6, 2.9], [9, 1.5, -1]);     // white strip, right
  panel([14, 1.4], [0.15, 0.5, 1.8], [0, -1.5, -10]);  // horizon glow behind
  panel([3, 3], [0.9, 0.6, 0.35], [6, 2.5, 8]);        // small warm bounce
  const tex = pm.fromScene(env, 0.03).texture;
  pm.dispose();
  return tex;
}
scene.environment = buildEnvironment();
scene.environmentIntensity = 0.95;

/* ---------- Backdrop dome (matches the fog so the floor dissolves) ---------- */
{
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(80, 48, 24),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { uHor: { value: HORIZON }, uTop: { value: new THREE.Color('#02050a') }, uGlow: { value: new THREE.Color('#0d2a52') } },
      vertexShader: 'varying vec3 vP; void main(){ vP = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }',
      fragmentShader: `uniform vec3 uHor; uniform vec3 uTop; uniform vec3 uGlow; varying vec3 vP;
        void main(){ vec3 d = normalize(vP); float y = d.y;
          float yy = max(y, 0.0);
          vec3 c = mix(uHor, uTop, smoothstep(0.0, 0.6, yy));
          gl_FragColor = vec4(c, 1.0); }`,
    }),
  );
  dome.renderOrder = -10;
  scene.add(dome);
}

/* ---------- Lights ---------- */
scene.add(new THREE.HemisphereLight(0x9bd6ff, 0x05070d, 0.35));
const key = new THREE.DirectionalLight(0xdcefff, 1.5);
key.position.set(4, 7, 5);
scene.add(key);
const rim = new THREE.DirectionalLight(0x4a8dff, 2.4);
rim.position.set(-6, 2.5, -6);
scene.add(rim);

/* ---------- Model ---------- */
try { await Promise.race([document.fonts.load('500 26px "IBM Plex Mono"'), new Promise((r) => setTimeout(r, 1200))]); } catch { /* fonts optional */ }
const core = buildOrbitalCore();
scene.add(core.root);
const P = core.parts;

/* ------------------------------------------------------------------ */
/* Camera + controls                                                   */
/* ------------------------------------------------------------------ */
const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.1, 300);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.enablePan = false;
controls.rotateSpeed = 0.7;
controls.zoomSpeed = 0.8;
controls.minPolarAngle = 0.22;
controls.maxPolarAngle = 1.6;
controls.autoRotate = true;
controls.autoRotateSpeed = 0;
const TARGET_BASE = new THREE.Vector3(0, -0.12, 0);
controls.target.copy(TARGET_BASE);

const HOME = { polar: 1.2, az: 0.66 };
let fitDist = 10;

function layout() {
  const w = innerWidth, h = innerHeight;
  const aspect = w / h;
  camera.aspect = aspect;
  const vHalf = THREE.MathUtils.degToRad(camera.fov / 2);
  const hHalf = Math.atan(Math.tan(vHalf) * aspect);
  const mobile = w <= 740;
  fitDist = Math.max(3.4 / Math.sin(vHalf), (mobile ? 2.4 : 2.6) / Math.sin(hHalf));
  controls.minDistance = fitDist * 0.42;
  controls.maxDistance = fitDist * 1.55;
  // Frame the object off-centre so it breathes next to the typography
  const xOff = mobile ? 0 : -w * 0.035;
  const yOff = mobile ? -h * 0.035 : -h * 0.01;
  camera.setViewOffset(w, h, xOff, yOff, w, h);
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
  composer?.setSize(w, h);
  core.particleUniforms.uPx.value = DPR * Math.min(1.4, h / 900);
}

const sph = new THREE.Spherical();
function placeCamera(r, polar, az, target = controls.target) {
  sph.set(r, polar, az);
  camera.position.setFromSpherical(sph).add(target);
  camera.lookAt(target);
}

/* ------------------------------------------------------------------ */
/* Post-processing                                                     */
/* ------------------------------------------------------------------ */
const rt = new THREE.WebGLRenderTarget(innerWidth * DPR, innerHeight * DPR, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, rt);
composer.setPixelRatio(DPR);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.45, 0.4, 0.95);
composer.addPass(bloom);
composer.addPass(new OutputPass());
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(innerWidth, innerHeight) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime; uniform vec2 uRes; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec2 c = vUv - 0.5;
      float r2 = dot(c, c);
      // lens: faint chromatic fringe toward the edges
      vec2 off = c * r2 * 0.012;
      vec3 col;
      col.r = texture2D(tDiffuse, vUv - off).r;
      col.g = texture2D(tDiffuse, vUv).g;
      col.b = texture2D(tDiffuse, vUv + off).b;
      // vignette
      col *= mix(1.0, 0.58, smoothstep(0.08, 0.62, r2 * 1.6));
      // film grain / dither (kills banding in the dark gradient)
      col += (h(vUv * uRes + fract(uTime) * 91.0) - 0.5) * 0.022;
      gl_FragColor = vec4(col, 1.0);
    }`,
});
composer.addPass(grade);
layout();

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */
const MODES = {
  orbit:   { a: 0.32, b: 0.52, cam: 0.55, label: '运行中' },
  pulse:   { a: 0.85, b: 1.45, cam: 1.0,  label: '脉冲中' },
  still:   { a: 0.0,  b: 0.0,  cam: 0.0,  label: '待机' },
  explode: { a: 0.12, b: 0.0,  cam: 0.35, label: '拆解视图' },
};
const S = {
  mode: 'orbit', t: 0, wall: 0,
  spinA: 0, spinB: 0, camSpin: 0,
  alpha: 0.4, beta: 0.9, betaTarget: 0,
  explode: 0, energy: 0, ignite: 0,
  beatClock: 0, beatAge: 9, beat2: false,
  intro: reduceMotion || params.has('fast') ? null : { t: 0, dur: 3.4 },
  tween: null,
};
const coverPose = params.has('cover');
if (coverPose) { S.alpha = 0.35; S.beta = 2.55; }
const audio = new CoreAudio();
const buttons = [...document.querySelectorAll('[data-mode]')];
const readout = $('.readout');

function setMode(next) {
  if (!MODES[next] || next === S.mode) return;
  S.mode = next;
  if (next === 'explode') S.betaTarget = Math.ceil(S.beta / Math.PI + 0.15) * Math.PI;
  if (next === 'pulse') S.beatClock = 0;
  buttons.forEach((b) => {
    const on = b.dataset.mode === next;
    b.classList.toggle('is-active', on);
    b.setAttribute('aria-pressed', String(on));
  });
  readout.classList.toggle('is-still', next === 'still');
  $('#roState').textContent = MODES[next].label;
  audio.blip(next === 'explode' ? 660 : next === 'pulse' ? 990 : 820);
}
buttons.forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
addEventListener('keydown', (e) => {
  if (e.target.closest && e.target.closest('input,textarea')) return;
  const m = { 1: 'orbit', 2: 'pulse', 3: 'still', 4: 'explode' }[e.key];
  if (m) setMode(m);
  if (e.key === 'r' || e.key === 'R') resetView();
});

const soundBtn = $('#sound');
soundBtn.addEventListener('click', async () => {
  const on = await audio.toggle();
  soundBtn.classList.toggle('is-on', on);
  soundBtn.setAttribute('aria-pressed', String(on));
  soundBtn.querySelector('em').textContent = on ? '声音 · 开' : '声音 · 关';
});

function resetView() {
  const off = camera.position.clone().sub(controls.target);
  sph.setFromVector3(off);
  S.tween = { t: 0, dur: 1.3, from: { r: sph.radius, polar: sph.phi, az: sph.theta }, to: { r: fitDist, polar: HOME.polar, az: nearestAngle(sph.theta, HOME.az) } };
}
function nearestAngle(from, to) {
  const d = ((to - from + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  return from + d;
}
canvas.addEventListener('dblclick', resetView);
controls.addEventListener('start', () => {
  S.intro = null; S.tween = null;
  canvas.classList.add('is-grabbing');
});
controls.addEventListener('end', () => canvas.classList.remove('is-grabbing'));

addEventListener('resize', () => {
  const prev = fitDist;
  layout();
  // keep the user's relative zoom when the viewport changes
  const off = camera.position.clone().sub(controls.target);
  off.multiplyScalar(fitDist / prev);
  camera.position.copy(controls.target).add(off);
  grade.uniforms.uRes.value.set(innerWidth, innerHeight);
  tagW.clear();
});

/* ------------------------------------------------------------------ */
/* Labels (exploded view annotations)                                  */
/* ------------------------------------------------------------------ */
const labelsEl = $('#labels');
const tags = Object.fromEntries([...document.querySelectorAll('.tag')].map((el) => [el.dataset.part, el]));
const tmpV = new THREE.Vector3(), camRight = new THREE.Vector3(), camUp = new THREE.Vector3();
function toScreen(v) {
  tmpV.copy(v).project(camera);
  return { x: (tmpV.x * 0.5 + 0.5) * innerWidth, y: (-tmpV.y * 0.5 + 0.5) * innerHeight, z: tmpV.z };
}
function ringExtreme(obj, R, side) {
  let best = null;
  const p = new THREE.Vector3();
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2;
    p.set(Math.sin(a) * R, 0, Math.cos(a) * R);
    obj.localToWorld(p);
    const s = toScreen(p);
    if (!best || (side === 'R' ? s.x > best.x : s.x < best.x)) best = s;
  }
  return best;
}
const tagW = new Map();
function placeTag(el, s, side) {
  let w = tagW.get(el);
  if (!w) { w = el.offsetWidth; tagW.set(el, w); }
  const W = innerWidth, pad = 8;
  let left = side === 'L' ? s.x - w : s.x;
  // keep annotations inside the viewport (phones): slide them in rather than clip
  left = Math.min(Math.max(left, pad), W - w - pad);
  el.style.transform = `translate(${left.toFixed(1)}px, ${s.y.toFixed(1)}px) translate(0, -50%)`;
}
function updateLabels() {
  const on = S.explode > 0.72;
  labelsEl.classList.toggle('is-on', on);
  document.body.classList.toggle('is-exploded', S.explode > 0.3);
  if (S.explode < 0.05) return;
  camRight.setFromMatrixColumn(camera.matrixWorld, 0);
  camUp.setFromMatrixColumn(camera.matrixWorld, 1);
  const c = new THREE.Vector3();
  P.core.getWorldPosition(c);
  placeTag(tags.core, toScreen(c.clone().addScaledVector(camRight, 0.46).addScaledVector(camUp, 0.2)), 'R');
  placeTag(tags.cage, toScreen(c.clone().addScaledVector(camRight, -0.66 * P.cage.scale.x).addScaledVector(camUp, -0.1)), 'L');
  placeTag(tags.outer, ringExtreme(P.outer, 1.47, 'R'), 'R');
  placeTag(tags.inner, ringExtreme(P.inner, 1.2, 'L'), 'L');
  placeTag(tags.pedestal, ringExtreme(P.pedestal, 1.83, 'R'), 'R');
}

/* ------------------------------------------------------------------ */
/* Readout + oscilloscope                                              */
/* ------------------------------------------------------------------ */
const roFreq = $('#roFreq'), roAlpha = $('#roAlpha'), roBeta = $('#roBeta'), roOut = $('#roOut');
const scope = $('#scope'), sctx = scope.getContext('2d');
const hist = new Float32Array(120).fill(1);
let histHead = 0, roTimer = 0;
const deg = (r) => ((((r * 180) / Math.PI) % 360) + 360) % 360;
function updateReadout(dt) {
  hist[histHead] = S.energy;
  histHead = (histHead + 1) % hist.length;
  roTimer += dt;
  if (roTimer < 0.1) return;
  roTimer = 0;
  roFreq.textContent = `${(47.9 + S.energy * 0.7 + S.spinB * 0.6).toFixed(1)} THz`;
  roAlpha.textContent = `${deg(S.alpha).toFixed(1).padStart(5, '0')}°`;
  roBeta.textContent = `${deg(S.beta * (1 - S.explode)).toFixed(1).padStart(5, '0')}°`;
  roOut.textContent = `${Math.round(S.energy * 100)}%`;
  if (scope.offsetParent === null) return;
  const W = scope.width, H = scope.height;
  sctx.clearRect(0, 0, W, H);
  sctx.strokeStyle = 'rgba(147,213,243,.14)';
  sctx.lineWidth = 1;
  sctx.beginPath(); sctx.moveTo(0, H / 2); sctx.lineTo(W, H / 2); sctx.stroke();
  sctx.lineWidth = 2;
  sctx.strokeStyle = '#7fdcff';
  sctx.shadowColor = '#2e9bff';
  sctx.shadowBlur = 8;
  sctx.beginPath();
  for (let i = 0; i < hist.length; i++) {
    const v = hist[(histHead + i) % hist.length];
    const x = (i / (hist.length - 1)) * W;
    const y = H * 0.5 - (v - 1) * H * 0.8 + Math.sin(i * 0.9 + S.t * 12) * 1.2;
    i ? sctx.lineTo(x, y) : sctx.moveTo(x, y);
  }
  sctx.stroke();
  sctx.shadowBlur = 0;
}

/* ------------------------------------------------------------------ */
/* Frame loop                                                          */
/* ------------------------------------------------------------------ */
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const smooth = (x) => x * x * (3 - 2 * x);
const damp = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
const glowBase = core.materials.glow.color.clone();
const glowSoftBase = core.materials.glowSoft.color.clone();
const ledBase = core.materials.led.color.clone();
const clock = new THREE.Clock();
let fpsAcc = 0, fpsN = 0, firstFrame = true;

// intro start pose
placeCamera(fitDist * (S.intro ? 1.75 : 1), S.intro ? 1.42 : HOME.polar, S.intro ? HOME.az - 1.25 : HOME.az);

function heartbeat(age) {
  const a = Math.exp(-age * 10);
  const b = age > 0.24 ? Math.exp(-(age - 0.24) * 10) * 0.6 : 0;
  return a + b;
}

function frame() {
  const rawDt = Math.min(clock.getDelta(), 0.5);
  const dt = Math.min(rawDt, 0.25);
  S.t += dt;
  S.wall += rawDt;
  fpsAcc += dt; fpsN++;
  if (fpsAcc > 1) {
    const fps = fpsN / fpsAcc;
    window.__fps = Math.round(fps);
    fpsAcc = 0; fpsN = 0;
    // adaptive resolution: step the pixel ratio down on struggling GPUs (never below 1)
    if (!S.intro && fps < 30 && DPR > 1) {
      DPR = Math.max(1, DPR - 0.25);
      renderer.setPixelRatio(DPR);
      composer.setPixelRatio(DPR);
      layout();
    }
  }
  const M = MODES[S.mode];

  // --- intro / camera tweens ---
  if (S.intro) {
    S.intro.t += rawDt;
    const k = Math.min(S.intro.t / S.intro.dur, 1);
    const e = ease(k);
    placeCamera(THREE.MathUtils.lerp(fitDist * 1.75, fitDist, e), THREE.MathUtils.lerp(1.42, HOME.polar, e), THREE.MathUtils.lerp(HOME.az - 1.25, HOME.az, e));
    if (k >= 1) S.intro = null;
  } else if (S.tween) {
    S.tween.t += rawDt;
    const k = ease(Math.min(S.tween.t / S.tween.dur, 1));
    const { from, to } = S.tween;
    placeCamera(THREE.MathUtils.lerp(from.r, to.r, k), THREE.MathUtils.lerp(from.polar, to.polar, k), THREE.MathUtils.lerp(from.az, to.az, k));
    if (k >= 1) S.tween = null;
  }
  S.ignite = reduceMotion || params.has('fast') ? 1 : Math.min(1, Math.max(0, (S.wall - 0.35) / 1.6));

  // --- mechanics ---
  const hold = coverPose ? 0 : 1; // ?cover freezes the gimbal in a fixed, photogenic pose
  S.spinA = damp(S.spinA, M.a * hold, 1.6, dt);
  S.spinB = damp(S.spinB, M.b * hold, 1.6, dt);
  S.camSpin = damp(S.camSpin, S.intro || S.tween ? 0 : M.cam * hold, 1.2, dt);
  S.explode = damp(S.explode, S.mode === 'explode' ? 1 : 0, 2.4, dt);
  const ex = smooth(Math.min(1, Math.max(0, S.explode)));
  S.alpha += S.spinA * dt;
  if (S.mode === 'explode') S.beta = damp(S.beta, S.betaTarget, 2.2, dt);
  else S.beta += S.spinB * dt;

  // energy envelope per mode
  let energy;
  if (S.mode === 'pulse') {
    S.beatClock += dt;
    if (S.beatClock > 1.25) { S.beatClock = 0; S.beatAge = 0; audio.thump(); }
    energy = 0.78 + 0.8 * heartbeat(S.beatClock);
  } else if (S.mode === 'still') energy = 0.8 + 0.04 * Math.sin(S.t * 0.9);
  else if (S.mode === 'explode') energy = 0.92 + 0.05 * Math.sin(S.t * 1.3);
  else energy = 1 + 0.07 * Math.sin(S.t * 1.6);
  S.energy = damp(S.energy, energy * S.ignite, S.mode === 'pulse' ? 18 : 4, rawDt);
  S.beatAge += dt;

  // --- apply to model ---
  const g = P.gimbal;
  g.rotation.order = 'ZYX';
  g.rotation.y = S.alpha;
  g.rotation.z = (0.2 + Math.sin(S.t * 0.37) * 0.04) * (1 - ex);
  g.rotation.x = Math.sin(S.t * 0.29) * 0.03 * (1 - ex);
  P.outerPivot.rotation.x = (Math.PI / 2) * (1 - ex);
  P.outerPivot.position.y = 1.38 * ex;
  P.innerPivot.rotation.x = S.beta;
  P.innerPivot.position.y = -1.12 * ex;
  P.core.position.y = 0.42 + 0.12 * ex + Math.sin(S.t * 1.1) * 0.025;
  P.cage.scale.setScalar(1 + 0.26 * ex);
  P.cage.rotation.y = S.t * 0.08;
  P.cage.rotation.x = S.t * 0.05;
  P.dial.rotation.z = -S.alpha * 0.25;

  core.uniforms.uTime.value = S.t;
  core.uniforms.uEnergy.value = S.energy;
  core.uniforms.uExplode.value = ex;
  core.floorUniforms.uBeat.value = S.mode === 'pulse' ? 1 : 0;
  core.floorUniforms.uBeatAge.value = S.beatAge;
  P.coreLight.intensity = 11 * S.energy + 1;
  const glowK = 0.45 + 0.6 * S.energy;
  core.materials.glow.color.copy(glowBase).multiplyScalar(glowK);
  core.materials.glowSoft.color.copy(glowSoftBase).multiplyScalar(0.3 + 0.8 * S.energy);
  core.materials.led.color.copy(ledBase).multiplyScalar(0.55 + 0.45 * S.ignite);

  // --- camera ---
  controls.autoRotateSpeed = S.camSpin;
  controls.enabled = !S.intro;
  controls.target.lerp(new THREE.Vector3(0, TARGET_BASE.y + 0.28 * ex, 0), 1 - Math.exp(-3 * dt));
  if (!S.intro && !S.tween) controls.update(dt);
  else camera.lookAt(controls.target);

  audio.update(S.energy, S.spinA + S.spinB * 0.5);
  grade.uniforms.uTime.value = S.t;
  composer.render(dt);
  updateLabels();
  updateReadout(dt);

  if (firstFrame) {
    firstFrame = false;
    requestAnimationFrame(() => loader.classList.add('is-done'));
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// test / debugging hooks
window.__orbital = { setMode, resetView, state: S, camera, controls };
