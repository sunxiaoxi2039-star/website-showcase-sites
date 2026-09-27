import * as THREE from 'three';
import { World, SITES, PLACES, DEFAULT_RECIPE } from './world.js';
import { U, Environment } from './optics.js';
import { SKY_U, createSkyDome } from './sky.js';
import { Waves, WAVE_U, createSurface } from './surface.js';
import { createTerrain, createWorldTextures, TERRAIN_U, TERRAIN_STEP } from './terrain.js';
import { Post } from './post.js';
import { Scenery } from './scenery.js';
import { Fauna, FAUNA_U } from './fauna.js';
import { createSnow, Plumes, createRain, Lightning, PART_U } from './particles.js';
import { Explorer } from './explore.js';
import { OceanSound } from './sound.js';
import { UI } from './ui.js';
import { parseSeed, clamp, smoothstep } from './noise.js';

const qs = new URLSearchParams(location.search);
if (qs.get('shot') === '1') document.body.classList.add('shot');
const num = (k, lo, hi, def) => { const v = parseFloat(qs.get(k)); return Number.isFinite(v) ? clamp(v, lo, hi) : def; };

const loading = document.getElementById('loading');
function fail(msg) {
  loading.innerHTML = `<div class="ld-brand">ABYSSAL</div><div class="ld-err">${msg}</div>`;
}

// ——— 渲染器 ———
const canvas = document.getElementById('gl');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', alpha: false });
  if (!renderer.capabilities.isWebGL2) throw new Error('webgl2');
} catch (e) {
  fail('这个作品需要 WebGL2。请换一台支持硬件加速的电脑或浏览器再试。');
  throw e;
}
renderer.setClearColor(0x000000, 1);

// ——— 配方 ———
const recipe = {
  ...DEFAULT_RECIPE,
  seed: parseSeed(qs.get('seed')),
  relief: num('relief', 0.3, 2, 1),
  cover: num('cover', 0, 2, 1),
  kelpHeight: num('height', 0.4, 1.6, 1),
  habitatScale: num('habitatScale', 0.6, 1.8, 1),
  life: num('life', 0, 2, 1),
  predators: num('predators', 0, 2, 1),
  benthos: num('benthos', 0, 2, 1),
  jellies: num('jellies', 0, 2, 1),
  shoal: num('shoal', 0.3, 2, 1),
};
const quality0 = ['low', 'medium', 'high'].includes(qs.get('preset')) ? qs.get('preset') : (matchMedia('(pointer: coarse)').matches ? 'low' : 'medium');

const app = {
  recipe, quality: quality0, qualityExplicit: qs.has('preset'), adaptive: qs.get('adaptive') !== '0',
  paused: false, time: 0, renderScale: 1, fps: 60,
};
window.__app = app;

const env = new Environment();
const light0 = ['day', 'dusk', 'storm', 'night'].includes(qs.get('light')) ? qs.get('light') : 'day';
env.setPreset(light0);
for (const k of ['sun', 'cloud', 'wind', 'swell', 'storm', 'rain', 'haze']) if (qs.has(k)) env.weather[k] = parseFloat(qs.get(k)) || 0;
env.water.clarity = num('clarity', 0.4, 2, 1);
env.water.current = num('current', 0, 3, 1);
env.water.glow = num('glow', 0, 3, 1);
env.water.upwelling = num('upwelling', 0, 3, 1);
env.water.lamp = ['on', 'off'].includes(qs.get('lamp')) ? qs.get('lamp') : 'auto';
app.env = env;

const waves = new Waves();
waves.configure(env.weather);
app.waves = waves;

let world, terrain, scenery, fauna;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 40000);
app.camera = camera;
const dome = createSkyDome();
scene.add(dome);
const surface = createSurface();
scene.add(surface);
const snow = createSnow(quality0 === 'low' ? 1800 : 3200);
scene.add(snow);
const plumes = new Plumes(quality0 === 'low' ? 500 : 900);
scene.add(plumes.points);
const rain = createRain(4000);
scene.add(rain);
const lightning = new Lightning();
scene.add(lightning.lines);
const post = new Post(renderer);
// 水下阳光阴影
const SHADOW_N = 2048, SHADOW_R = 32;
const shadowRT = new THREE.WebGLRenderTarget(SHADOW_N, SHADOW_N, { depthBuffer: true });
shadowRT.depthTexture = new THREE.DepthTexture(SHADOW_N, SHADOW_N);
const shadowCam = new THREE.OrthographicCamera(-SHADOW_R, SHADOW_R, SHADOW_R, -SHADOW_R, 1, 500);
const shadowMat = new THREE.ShaderMaterial({
  vertexShader: `void main(){ vec4 p = vec4(position, 1.0);
    #ifdef USE_INSTANCING
      p = instanceMatrix * p;
    #endif
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * p; }`,
  fragmentShader: 'void main(){ gl_FragColor = vec4(1.0); }',
  side: THREE.DoubleSide,
});
U.uShadowMap.value = shadowRT.depthTexture;
const shadowOff = [];
function renderShadow(pos) {
  const rs = U.uRefrSun.value;
  const on = app.under && -pos.y < 110 && U.uCaustStr.value > 0.05 && app.quality !== 'low' && qs.get('shadow') !== '0';
  U.uShadowOn.value = on ? 1 : 0;
  if (!on) return;
  // 以纹素为单位对齐，避免阴影随镜头移动闪烁
  const texel = (2 * SHADOW_R) / SHADOW_N;
  const fw = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  const cx = pos.x + fw.x * 14, cz = pos.z + fw.z * 14;
  const c = new THREE.Vector3(Math.round(cx / texel) * texel, pos.y - 8, Math.round(cz / texel) * texel);
  shadowCam.position.copy(c).addScaledVector(rs, 200);
  shadowCam.up.set(0, 0, 1);
  shadowCam.lookAt(c);
  shadowCam.updateMatrixWorld();
  U.uShadowMat.value.multiplyMatrices(shadowCam.projectionMatrix, shadowCam.matrixWorldInverse);
  shadowOff.length = 0;
  for (const o of [terrain, surface, dome, snow, plumes.points, rain, lightning.lines]) { if (o.visible) { shadowOff.push(o); o.visible = false; } }
  scene.overrideMaterial = shadowMat;
  renderer.setRenderTarget(shadowRT);
  renderer.clear();
  renderer.render(scene, shadowCam);
  scene.overrideMaterial = null;
  for (const o of shadowOff) o.visible = true;
}
const explorer = new Explorer(null, waves);
app.explorer = explorer;
const sound = new OceanSound();
app.sound = sound;

function buildWorld() {
  const t0 = performance.now();
  world = new World(app.recipe);
  const tex = createWorldTextures(world);
  for (const k of ['uHeightTex', 'uDetailTex', 'uHabTex']) if (TERRAIN_U[k].value) TERRAIN_U[k].value.dispose();
  TERRAIN_U.uHeightTex.value = tex.heightTex;
  TERRAIN_U.uDetailTex.value = tex.detailTex;
  TERRAIN_U.uHabTex.value = tex.habTex;
  if (!terrain) { terrain = createTerrain(app.quality); scene.add(terrain); }
  if (!scenery) { scenery = new Scenery(world, app.quality); scene.add(scenery.group); } else scenery.setWorld(world);
  if (!fauna) { fauna = new Fauna(world, scenery, app.quality); scene.add(fauna.group); } else fauna.setWorld(world);
  fauna.setDials(app.recipe);
  explorer.setWorld(world);
  app.world = world; app.scenery = scenery; app.fauna = fauna;
  app.worldVersion = (app.worldVersion || 0) + 1;
  return performance.now() - t0;
}

// ——— 起始视角 ———
function startView() {
  const site = SITES[qs.get('site')] ? qs.get('site') : null;
  const place = PLACES.find((p) => p.id === qs.get('place'));
  const surf = qs.get('surface');
  const depth = qs.get('depth');
  const base = place || (site ? SITES[site] : SITES.reef);
  if (surf === '1' || surf === 'waterline' || (!site && !place && !depth)) {
    explorer.placeSurface(base.x, base.z, site === 'blue' ? 0.4 : site === 'kelp' ? 2.4 : 0.55);
    if (surf === 'waterline') { explorer.waterline = true; explorer.pos.y = 0; }
    app.opening = true;
    return;
  }
  if (depth) {
    const d = depth === 'vent' ? 1400 : clamp(parseFloat(depth) || 200, 5, 1400);
    const route = explorer.canyonRoute();
    const q = route.find((p) => p.y <= -d) || route[route.length - 1];
    explorer.placeAt(q.x, depth === 'vent' ? q.y : Math.max(-d, world.floorAt(q.x, q.z) + 5), q.z, 2.6, 0.0);
    return;
  }
  const t = place ? explorer.placeTarget(place) : explorer.siteTarget(site);
  explorer.placeAt(t.x, t.y, t.z, t.yaw, t.pitch);
}

// ——— 动作（供界面调用） ———
app.travelSite = (id) => {
  const t = explorer.siteTarget(id);
  explorer.travelTo(t, SITES[id].title);
  app.opening = false;
};
app.travelPlace = (id) => {
  const p = PLACES.find((q) => q.id === id);
  if (!p) return;
  explorer.travelTo(explorer.placeTarget(p), p.name);
  app.opening = false;
  app.lastPlace = id;
};
app.descend = (stop) => { app.opening = false; return explorer.descend(stop); };
app.ascend = () => explorer.ascend();
app.stopJourney = () => explorer.stop();
app.dive = () => {
  const p = explorer.pos;
  let best = 'reef', bd = 1e9;
  for (const s of Object.values(SITES)) {
    const d = Math.hypot(s.x - p.x, s.z - p.z);
    if (d < bd) { bd = d; best = s.id; }
  }
  if (bd > 250) best = world.floorAt(p.x, p.z) < -200 ? 'blue' : p.x > 0 ? 'kelp' : 'reef';
  app.travelSite(best);
};
app.setMode = (m) => { explorer.mode = m; if (m === 'swim') { explorer.follow = null; explorer.journey = null; } };
app.togglePause = () => { app.paused = !app.paused; sound.suspend(app.paused); };
app.cycleLamp = () => {
  const cur = env.water.lamp;
  if (cur === 'auto') env.water.lamp = env.lampLevel > 0.5 ? 'off' : 'on';
  else env.water.lamp = 'auto';
  return env.water.lamp;
};
app.regenerate = (patch) => {
  Object.assign(app.recipe, patch);
  const p = explorer.pos.clone();
  buildWorld();
  const f = world.floorAt(p.x, p.z);
  if (p.y < 0 && p.y < f + 1.5) explorer.pos.y = f + 3;
};
app.setCover = (patch) => { Object.assign(app.recipe, patch); Object.assign(world.recipe, patch); scenery.setWorld(world); };
app.setLife = (patch) => { Object.assign(app.recipe, patch); fauna.setDials(patch); };
app.weatherChanged = () => { waves.configure(env.weather); };
app.event = (type) => {
  const p = explorer.pos;
  const t = app.time;
  if (type === 'tremor') {
    const v = scenery.vents[0] || { x: SITES.deep.x, z: SITES.deep.z };
    waves.addEvent(0, v.x, v.z, 1.6 + env.weather.swell, t, null);
    app.tremor = { t: 0, x: v.x, z: v.z };
    env.silt = Math.max(env.silt, -p.y > 900 ? 1 : 0.4);
  } else if (type === 'rogue') {
    const a = explorer.yaw;
    const dir = [Math.sin(a), Math.cos(a)];
    waves.addEvent(1, p.x - dir[0] * 250, p.z - dir[1] * 250, 5 + env.weather.wind * 0.25, t, dir);
  } else if (type === 'lightning') {
    lightning.strike(p, explorer.yaw);
    env.flash = 1;
  }
};
app.screenshot = () => { app.wantShot = true; };
app.population = () => fauna.population();
app.setQuality = (q) => { app.quality = q; app.qualityExplicit = true; applyQuality(); };

function applyQuality() {
  const q = app.quality;
  app.maxScale = q === 'low' ? 0.7 : q === 'high' ? 1.0 : 0.85;
  if (!app.adaptive) app.renderScale = app.maxScale;
  app.renderScale = Math.min(app.renderScale, app.maxScale);
  app.volSteps = q === 'low' ? 10 : q === 'high' ? 24 : 16;
  scenery.radius = q === 'low' ? 96 : q === 'high' ? 150 : 128;
  scenery.lastKey = '';
  resize();
}

function resize() {
  const w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const pr = dpr * (app.renderScale || 1);
  renderer.setPixelRatio(pr);
  renderer.setSize(w, h, false);
  post.volScale = app.quality === 'high' ? 0.6 : 0.5;
  post.setSize(Math.round(w * pr), Math.round(h * pr));
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  PART_U.uPx.value = (h * pr) / 900;
}
window.addEventListener('resize', resize);

// ——— 启动 ———
let ui;
function boot() {
  try {
    buildWorld();
  } catch (e) {
    console.error(e);
    fail('生成海洋时出错：' + e.message);
    return;
  }
  app.renderScale = app.quality === 'low' ? 0.7 : app.quality === 'high' ? 1 : 0.85;
  applyQuality();
  startView();
  ui = new UI(app);
  app.ui = ui;
  if (qs.get('ui') === '0') ui.setHidden(true);
  if (qs.get('lab')) ui.openLab(qs.get('lab'));
  if (qs.get('chart') === '1') ui.openChart();
  if (qs.get('journal') === '1') ui.openJournal();
  if (qs.get('pause') === '1') app.paused = true;
  loading.classList.add('done');
  last = performance.now();
  requestAnimationFrame(frame);
}

document.addEventListener('visibilitychange', () => sound.suspend(document.hidden || app.paused));

// ——— 主循环 ———
let last = 0;
const frameTimes = [];
let adaptT = 0;
const fwd = new THREE.Vector3();
function frame(now) {
  requestAnimationFrame(frame);
  const rawDt = (now - last) / 1000;
  last = now;
  const dt = Math.min(0.1, Math.max(0, rawDt));
  frameTimes.push(rawDt);
  if (frameTimes.length > 60) frameTimes.shift();
  const avg = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
  app.fps = 1 / Math.max(avg, 1e-3);
  // 自适应画质：只调内部分辨率
  adaptT += rawDt;
  if (app.adaptive && adaptT > 2 && frameTimes.length >= 30) {
    adaptT = 0;
    if (avg > 1 / 38 && app.renderScale > 0.55) { app.renderScale = Math.max(0.55, app.renderScale - 0.1); resize(); }
    else if (avg < 1 / 58 && app.renderScale < app.maxScale - 0.01) { app.renderScale = Math.min(app.maxScale, app.renderScale + 0.05); resize(); }
  }

  const sdt = app.paused ? 0 : dt;
  app.time += sdt;
  const t = app.time;
  U.uTime.value = t;
  WAVE_U.uWaveTime.value = t;

  explorer.update(dt, t, scenery.obstacles);
  explorer.applyCamera(camera, t);
  const pos = explorer.pos;
  const waveH = waves.height(pos.x, pos.z, t);
  const under = pos.y < waveH;
  const split = Math.abs(pos.y - waveH) < 0.9 && pos.y > -3;
  app.under = under;

  env.offshore = smoothstep(-70, -350, world.floorAt(pos.x, pos.z));
  env.update(dt, pos, under);
  U.uCamPos.value.copy(pos);
  fwd.set(0, 0, -1).applyQuaternion(camera.quaternion);
  U.uLampPos.value.copy(pos).addScaledVector(fwd, 0.25);
  U.uLampPos.value.y -= 0.3;
  U.uLampDir.value.copy(fwd);
  U.uLampRight.value.set(1, 0, 0).applyQuaternion(camera.quaternion);
  FAUNA_U.uEmit.value = 1 / env.exposure;
  PART_U.uEmitP.value = 1 / env.exposure;
  PART_U.uSpark.value = smoothstep(150, 400, -pos.y) * clamp((explorer.speedNow - 0.8) / 4, 0, 1);
  SKY_U.uCloudCover.value = env.weather.cloud;
  SKY_U.uCloudDens.value = env.weather.cloudDensity;
  SKY_U.uStorm.value = env.weather.storm;
  SKY_U.uHaze.value = env.weather.haze;
  const wd = (env.weather.windDir * Math.PI) / 180;
  const cs = 0.0008 * (1 + env.weather.wind * 0.1);
  SKY_U.uCloudOff.value.set(Math.cos(wd) * t * cs, Math.sin(wd) * t * cs);
  const md = (env.weather.azimuth * Math.PI) / 180 + Math.PI;
  SKY_U.uMoonDir.value.set(Math.sin(md) * 0.75, 0.55, Math.cos(md) * 0.75).normalize();
  U.uBloom.value += (clamp((env.water.upwelling - 0.6) / 2, 0, 1) - U.uBloom.value) * Math.min(1, dt * 0.05);
  rain.material.uniforms.uRain.value = env.weather.rain;
  rain.material.uniforms.uWind.value.set(Math.cos(wd) * env.weather.wind * 0.4, Math.sin(wd) * env.weather.wind * 0.4);
  if (env.weather.storm > 0.5 && !app.paused && Math.random() < dt * env.weather.storm * 0.08 && pos.y > -30) app.event('lightning');
  lightning.update(dt);
  if (app.tremor) { app.tremor.t += sdt; if (app.tremor.t > 30) app.tremor = null; }

  dome.position.copy(pos);
  WAVE_U.uGridCenter.value.set(pos.x, pos.z);
  surface.visible = pos.y > -320;
  const s = TERRAIN_STEP * 4;
  TERRAIN_U.uGridCenter.value.set(Math.round(pos.x / s) * s, Math.round(pos.z / s) * s);

  scenery.update(camera, pos);
  const diverActive = explorer.mode === 'swim' && explorer.speedNow > 0.6 && !explorer.follow;
  fauna.update(dt, camera, pos, diverActive, app.paused);
  plumes.update(sdt, scenery.vents, pos, 0.6 + env.water.upwelling * 0.4 + (app.tremor ? 2 : 0));
  snow.visible = under || split;

  if (app.tremor && app.tremor.t < 6) {
    const k = (1 - app.tremor.t / 6) * 0.02 * (-pos.y > 900 ? 1 : 0.3);
    camera.rotation.x += (Math.random() - 0.5) * k; camera.rotation.z += (Math.random() - 0.5) * k;
    camera.updateMatrixWorld();
  }

  renderShadow(pos);
  post.render(camera, (u, rt) => {
    U.uCamUnder.value = u ? 1 : 0;
    renderer.setRenderTarget(rt);
    renderer.render(scene, camera);
  }, { under, split, exposure: env.exposure, volSteps: app.volSteps, wb: env.wb });

  if (app.wantShot) {
    app.wantShot = false;
    canvas.toBlob((b) => {
      if (!b) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(b);
      a.download = `abyssal-${app.recipe.seed}-${Math.round(Math.max(0, -pos.y))}m.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }, 'image/png');
  }

  // 声音
  const hab = world.habitat(pos.x, pos.z);
  let whale = 0;
  for (const a of (app.whaleKind = app.whaleKind || fauna.kinds.find((k) => k.sp.id === 'whale')).animals) whale = Math.max(whale, 1 - a.pos.distanceTo(pos) / 150);
  let vent = 0;
  for (const v of scenery.vents) vent = Math.max(vent, 1 - Math.hypot(v.x - pos.x, v.y - pos.y, v.z - pos.z) / 40);
  sound.update(dt, { y: pos.y, under, wind: env.weather.wind, storm: env.weather.storm, reef: under && -pos.y < 60 ? hab.reef : 0, whale, vent, tremor: app.tremor ? Math.max(0, 1 - app.tremor.t / 8) : 0 });

  ui.update(dt, camera);
  window.__frames = (window.__frames || 0) + 1;
}

setTimeout(boot, 30);
window.__dbg = { get world() { return world; }, env, explorer, waves, renderer, scene, get scenery() { return scenery; }, get fauna() { return fauna; }, camera, app };
