import * as THREE from 'three';
import { PAINT_VERT, PAINT_FRAG, COMMON } from './shaders.js';
import { PAINTINGS, PROFILES, PROFILE_KEYS } from './data.js';
import { buildTown } from './town.js';
import { terrainMesh } from './terrain.js';
import { buildVegetation, buildHalos, buildCrows, buildWater } from './veg.js';
import { createSky } from './sky.js';
import { Player, lookAngles } from './player.js';
import { H } from './terrain.js';
import { Ambience } from './audio.js';

THREE.ColorManagement.enabled = false;
const params = new URLSearchParams(location.search);
const $ = (id) => document.getElementById(id);

// ------------------------------------------------------------------ renderer
const app = $('app');
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.setPixelRatio(1);
app.appendChild(renderer.domElement);
const canvas = renderer.domElement;

let soft = false;
try {
  const gl = renderer.getContext();
  let name = gl.getParameter(gl.RENDERER) || '';
  if (!/firefox/i.test(navigator.userAgent)) {
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    if (dbg) name = gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || name;
  }
  soft = /swiftshader|llvmpipe|software/i.test(name);
} catch (_) { /* ignore */ }
const mobile = matchMedia('(pointer: coarse)').matches;
const Q = params.has('q') ? parseFloat(params.get('q')) : (soft ? 0.5 : mobile ? 0.55 : 1);
const maxScale = params.has('scale') ? parseFloat(params.get('scale')) : Math.min(devicePixelRatio || 1, mobile ? 1.25 : 1.5);
let scale = params.has('scale') ? maxScale : (soft ? 0.5 : Math.min(1, maxScale));
const adaptive = !params.has('scale');

const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 1600);
const scene = new THREE.Scene();

// ------------------------------------------------------------------ shared uniforms
const U = {
  uSunDir: { value: new THREE.Vector3(0.3, 0.8, 0.4).normalize() }, uSunCol: { value: new THREE.Color(0, 0, 0) },
  uAmbSky: { value: new THREE.Color() }, uAmbGround: { value: new THREE.Color() },
  uLampPos: { value: Array.from({ length: 8 }, () => new THREE.Vector3()) },
  uLampCol: { value: Array.from({ length: 8 }, () => new THREE.Vector4()) },
  uLampK: { value: 1 }, uFogCol: { value: new THREE.Color() }, uFogDen: { value: 0.006 },
  uNight: { value: 1 }, uUnder: { value: new THREE.Color() }, uTime: { value: 0 }, uDetail: { value: 1 }, uReveal: { value: 0 },
};
const paintMat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: PAINT_VERT, fragmentShader: PAINT_FRAG, side: THREE.DoubleSide });

// ------------------------------------------------------------------ world
const sky = createSky(renderer);
scene.add(sky.dome);
const town = buildTown(paintMat);
scene.add(town.mesh);
scene.add(terrainMesh(paintMat, -190, 110, -150, 150, 1.5));
scene.add(terrainMesh(paintMat, -560, 560, -560, 560, 8, [-186, 106, -146, 146]));
sky.uniforms.uReveal = U.uReveal;
const veg = buildVegetation(U, Q, town.people);
scene.add(veg.mesh);
const halos = buildHalos(town.lamps, U);
scene.add(halos);
scene.add(buildCrows(U));
scene.add(buildWater(U, town.lamps, sky.colTex));
const segs = [...town.segs, ...veg.segs];

// ------------------------------------------------------------------ post: outlines, canvas, grading
const rt = new THREE.WebGLRenderTarget(4, 4, { depthTexture: new THREE.DepthTexture(4, 4), type: THREE.UnsignedByteType });
const postMat = new THREE.ShaderMaterial({
  uniforms: { tColor: { value: rt.texture }, tDepth: { value: rt.depthTexture }, uRes: { value: new THREE.Vector2() }, uTime: U.uTime, uInk: { value: new THREE.Color(0.06, 0.08, 0.22) }, uCanvasK: { value: 1 }, uDbg: { value: params.has('dbgedge') ? 1 : 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
  fragmentShader: /* glsl */ `
${COMMON}
uniform sampler2D tColor; uniform sampler2D tDepth; uniform vec2 uRes; uniform vec3 uInk; uniform float uCanvasK; uniform float uDbg;
varying vec2 vUv;
float Z(vec2 uv){ return texture2D(tDepth, uv).x; }
void main(){
  vec2 px = 1.0 / uRes;
  vec2 fp = vUv * uRes;
  vec2 wob = (vec2(vnoise(fp / 7.0), vnoise(fp / 7.0 + 17.0)) - 0.5) * px * 2.4;
  vec2 uv = vUv + wob;
  vec3 c = texture2D(tColor, uv).rgb;
  vec2 uc = (floor(uv * uRes) + 0.5) * px;   // exact texel centres: planes give a zero Laplacian
  float z = Z(uc);
  float zl = Z(uc - vec2(px.x, 0.0)), zr = Z(uc + vec2(px.x, 0.0)), zd = Z(uc - vec2(0.0, px.y)), zu = Z(uc + vec2(0.0, px.y));
  float iz = max(1.0 - z, 1e-6);
  float lap = (abs(zl + zr - 2.0 * z) + abs(zu + zd - 2.0 * z)) / iz;
  float jump = max(max(abs(zl - z), abs(zr - z)), max(abs(zu - z), abs(zd - z))) / iz;
  float e = max(smoothstep(0.08, 0.25, lap), smoothstep(0.25, 0.6, jump));
  float near = min(min(zl, zr), min(zu, zd));
  e *= smoothstep(0.99999, 0.9995, min(near, z));
  e *= 0.55 + 0.45 * vnoise(fp / 5.0 + 3.0);
  if (uDbg > 0.5) { gl_FragColor = vec4(lap * 3.0, jump * 3.0, iz * 10.0, 1.0); return; }
  vec3 ink = uInk + c * 0.28;
  c = mix(c, ink, e * 0.85);
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(vec3(l), c, 1.14);
  c = (c - 0.5) * 1.04 + 0.5;
  // canvas weave + grain
  float weave = sin(fp.x * 1.3 + sin(fp.y * 0.21) * 0.8) * sin(fp.y * 1.3 + sin(fp.x * 0.19) * 0.8);
  c *= 1.0 + (0.035 * weave + (hash12(fp) - 0.5) * 0.04) * uCanvasK;
  vec2 q = vUv - 0.5;
  c *= 1.0 - dot(q, q) * 0.36;
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`,
  depthTest: false, depthWrite: false,
});
const postScene = new THREE.Scene();
const postQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMat); postQuad.frustumCulled = false;
postScene.add(postQuad);
const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

function resize() {
  const w = app.clientWidth, h = app.clientHeight;
  renderer.setSize(w, h, false);
  canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
  const rw = Math.max(2, Math.round(w * scale)), rh = Math.max(2, Math.round(h * scale));
  rt.setSize(rw, rh);
  postMat.uniforms.uRes.value.set(rw, rh);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  U.uDetail.value = Math.max(0.7, Math.min(1.3, scale));
}
addEventListener('resize', resize);

// ------------------------------------------------------------------ atmosphere blending
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const clone = (p) => { const o = {}; for (const k of PROFILE_KEYS) o[k] = Array.isArray(p[k]) ? p[k].slice() : p[k]; return o; };
const lerpInto = (o, p, w) => { for (const k of PROFILE_KEYS) { if (Array.isArray(o[k])) for (let i = 0; i < o[k].length; i++) o[k][i] += (p[k][i] - o[k][i]) * w; else o[k] += (p[k] - o[k]) * w; } };
function zoneWeights(x, z) {
  return PAINTINGS.map((p) => {
    if (p.box) {
      const [x0, z0, x1, z1] = p.box;
      const dx = Math.max(x0 - x, 0, x - x1), dz = Math.max(z0 - z, 0, z - z1);
      return 1 - sm(0, 2.5, Math.hypot(dx, dz));
    }
    return 1 - sm(p.inner, p.outer, Math.hypot(x - p.center[0], z - p.center[1]));
  });
}
function targetProfile(x, z) {
  const prof = clone(PROFILES.town);
  const w = zoneWeights(x, z);
  PAINTINGS.forEach((p, i) => { if (p.id !== 'cafe' && w[i] > 0) lerpInto(prof, PROFILES[p.id], w[i]); });
  return prof;
}
let cur = null;
const tmpV = new THREE.Vector3();
function applyProfile(p) {
  tmpV.set(...p.sunDir).normalize(); U.uSunDir.value.copy(tmpV);
  U.uSunCol.value.setRGB(...p.sunCol); U.uAmbSky.value.setRGB(...p.ambSky); U.uAmbGround.value.setRGB(...p.ambGround);
  U.uFogCol.value.setRGB(...p.fog); U.uFogDen.value = p.fogDen; U.uNight.value = p.night; U.uLampK.value = p.lampK;
  U.uUnder.value.setRGB(...p.under);
}
const lampsSorted = town.lamps.map((l) => ({ ...l, v: new THREE.Vector3(...l.p) }));
function updateLamps() {
  const cp = camera.position;
  lampsSorted.forEach((l) => { l.d = l.v.distanceTo(cp) - l.r; });
  lampsSorted.sort((a, b) => a.d - b.d);
  for (let i = 0; i < 8; i++) {
    const l = lampsSorted[i];
    if (l && !l.far) { U.uLampPos.value[i].copy(l.v); U.uLampCol.value[i].set(l.c[0], l.c[1], l.c[2], l.r); }
    else U.uLampCol.value[i].set(0, 0, 0, 1);
  }
}

// ------------------------------------------------------------------ player & tour
const player = new Player(camera, canvas, segs);
player.idleDrift = !params.has('cover');
const byId = Object.fromEntries(PAINTINGS.map((p) => [p.id, p]));
function placeAt(p) {
  const [x, z] = p.vp.pos; const y = H(x, z) + 1.62;
  const a = lookAngles(x, y, z, ...p.vp.look);
  player.set(x, z, a.yaw, a.pitch, p.vp.fov);
}
placeAt(byId[params.get('vp')] || byId.cafe);

const TOUR = ['cafe', 'yellow', 'bedroom', 'rhone', 'wheat', 'starry'];
let tour = null;
function startTour() {
  const curIdx = tour ? tour.i : -1;
  tour = { i: curIdx, hold: 0 };
  nextTourStop();
  setBtn('btnTour', true);
}
function nextTourStop() {
  if (!tour) return;
  tour.i = (tour.i + 1) % TOUR.length;
  const p = byId[TOUR[tour.i]];
  goTo(p, () => { if (tour) tour.hold = 7.5; });
}
function stopTour() { if (!tour) return; tour = null; setBtn('btnTour', false); }
function goTo(p, done) {
  player.flyTo(p, () => { showLabel(p, true); done && done(); });
  hideLabel();
}
player.onInput = () => stopTour();

// ------------------------------------------------------------------ UI
const gallery = $('gallery');
PAINTINGS.forEach((p) => {
  const b = document.createElement('button');
  b.className = 'chip'; b.dataset.id = p.id;
  b.innerHTML = `<span class="sw">${p.swatch.map((c) => `<i style="background:${c}"></i>`).join('')}</span><span class="nm"><b>${p.key}</b>${p.cn}</span>`;
  b.title = `前往《${p.cn}》的画架`;
  b.addEventListener('click', (e) => { e.stopPropagation(); stopTour(); goTo(p); });
  gallery.appendChild(b);
});
function setBtn(id, on) { const el = $(id); if (el) el.classList.toggle('on', on); }

let labelFor = null, labelTimer = 0;
function showLabel(p) {
  clearTimeout(labelTimer);
  labelTimer = setTimeout(() => $('label').classList.remove('show'), innerWidth < 640 ? 6500 : 11000);
  labelFor = p.id;
  $('lbl-cn').textContent = p.cn;
  $('lbl-orig').textContent = `${p.orig} · ${p.year}`;
  $('lbl-place').textContent = `${p.place} ｜ 现藏：${p.museum}`;
  $('lbl-quote').textContent = `“${p.quote}”`;
  $('lbl-src').textContent = `—— ${p.quoteSrc}`;
  $('label').classList.add('show');
}
function hideLabel() { labelFor = null; $('label').classList.remove('show'); }

let framed = false;
function toggleFrame(on = !framed) {
  framed = on; setBtn('btnFrame', on);
  document.body.classList.toggle('framed', on);
  const f = $('frame');
  f.classList.toggle('show', on);
  if (on) layoutFrame();
}
function layoutFrame() {
  const w = app.clientWidth, h = app.clientHeight;
  const zid = currentZone() || 'cafe';
  const p = byId[zid];
  let fw = w * 0.84, fh = fw / p.aspect;
  if (fh > h * 0.78) { fh = h * 0.78; fw = fh * p.aspect; }
  const f = $('frame-inner');
  f.style.width = fw + 'px'; f.style.height = fh + 'px';
  $('frame-plaque').textContent = `${p.cn}　${p.orig}，${p.year.slice(0, 4)}`;
}
function currentZone() {
  const w = zoneWeights(player.x, player.z);
  let best = -1, bi = -1;
  w.forEach((v, i) => { if (v > best) { best = v; bi = i; } });
  return best > 0.35 ? PAINTINGS[bi].id : null;
}

let uiHidden = false;
function toggleUI() { uiHidden = !uiHidden; document.body.classList.toggle('noui', uiHidden); }

$('btnTour').addEventListener('click', (e) => { e.stopPropagation(); tour ? stopTour() : startTour(); });
$('btnFrame').addEventListener('click', (e) => { e.stopPropagation(); toggleFrame(); });
$('btnHide').addEventListener('click', (e) => { e.stopPropagation(); toggleUI(); });
$('btnHelp').addEventListener('click', (e) => { e.stopPropagation(); $('help').classList.toggle('show'); });
const amb = new Ambience();
function toggleSound() { if (amb.on) amb.stop(); else amb.start(); setBtn('btnSound', amb.on); }
$('btnSound').addEventListener('click', (e) => { e.stopPropagation(); toggleSound(); });

addEventListener('keydown', (e) => {
  if (!player.enabled) return;
  const k = e.key.toLowerCase();
  const p = PAINTINGS.find((pp) => pp.key === k);
  if (p) { stopTour(); goTo(p); }
  if (k === 't') tour ? stopTour() : startTour();
  if (k === 'f') toggleFrame();
  if (k === 'h') toggleUI();
  if (k === 'm') toggleSound();
});

function begin(withTour) {
  $('intro').classList.add('gone');
  player.enabled = true;
  document.body.classList.add('playing');
  if (withTour) startTour(); else showLabel(byId[currentZone() || 'cafe']);
}
$('btnStart').addEventListener('click', () => begin(false));
$('btnStartTour').addEventListener('click', () => begin(true));

// minimap
const mm = $('minimap'); const mctx = mm.getContext('2d');
const MMR = 175;
function drawMap() {
  const s = mm.width; const k = s / (MMR * 2);
  const X = (x) => (x + MMR) * k, Z = (z) => (z + MMR) * k;
  mctx.clearRect(0, 0, s, s);
  mctx.save();
  mctx.beginPath(); mctx.arc(s / 2, s / 2, s / 2 - 1, 0, Math.PI * 2); mctx.clip();
  mctx.fillStyle = '#3f6a4a'; mctx.fillRect(0, 0, s, s);
  mctx.fillStyle = '#d8a73c'; mctx.beginPath(); mctx.moveTo(X(-50), Z(-118)); mctx.lineTo(X(-50), Z(62)); mctx.lineTo(X(-170), Z(62)); mctx.lineTo(X(-170), Z(-118)); mctx.fill();
  mctx.fillStyle = '#2a4e4a'; mctx.beginPath(); mctx.arc(X(-78), Z(80), 34 * k, 0, 7); mctx.fill();
  mctx.fillStyle = '#2d4f8f'; mctx.fillRect(X(88), 0, (128 - 88) * k, s);
  mctx.fillStyle = '#c8b27e'; mctx.fillRect(X(-40), Z(-90), 124 * k, 140 * k);
  mctx.fillStyle = '#7a6a8a';
  for (const [x0, z0, x1, z1] of town.segs) { if (Math.hypot(x0 - x1, z0 - z1) > 30) continue; mctx.fillRect(Math.min(X(x0), X(x1)), Math.min(Z(z0), Z(z1)), Math.abs(X(x1) - X(x0)) + 1, Math.abs(Z(z1) - Z(z0)) + 1); }
  mctx.font = `bold ${Math.round(s * 0.075)}px sans-serif`; mctx.textAlign = 'center'; mctx.textBaseline = 'middle';
  for (const p of PAINTINGS) {
    if (p.id === 'bedroom') continue;
    const [x, z] = p.vp.pos;
    mctx.fillStyle = p.swatch[0]; mctx.beginPath(); mctx.arc(X(x), Z(z), s * 0.045, 0, 7); mctx.fill();
    mctx.strokeStyle = '#141a3a'; mctx.lineWidth = 1.5; mctx.stroke();
    mctx.fillStyle = '#141a3a'; mctx.fillText(p.key, X(x), Z(z) + 0.5);
  }
  // player
  mctx.translate(X(player.x), Z(player.z)); mctx.rotate(-player.yaw);
  mctx.fillStyle = '#fff6d0'; mctx.strokeStyle = '#141a3a'; mctx.lineWidth = 1.5;
  mctx.beginPath(); mctx.moveTo(0, -s * 0.06); mctx.lineTo(s * 0.035, s * 0.035); mctx.lineTo(-s * 0.035, s * 0.035); mctx.closePath(); mctx.fill(); mctx.stroke();
  mctx.restore();
}

// ------------------------------------------------------------------ loop
if (params.has('cover')) { document.body.classList.add('cover', 'noui'); $('intro').classList.add('gone'); }
if (params.has('play')) begin(false);
resize();
const clock = { t0: performance.now(), last: performance.now(), elapsedTime: 0, getDelta() { const n = performance.now(); const d = (n - this.last) / 1000; this.last = n; this.elapsedTime = (n - this.t0) / 1000; return d; } };
let frames = 0, acc = 0, accN = 0, lastZone = null, mapT = 0;
window.__vg = { info: () => ({ townVerts: town.vertexCount, sprites: veg.count, Q }), frames: () => frames, player, goTo: (id) => goTo(byId[id]), placeAt: (id) => placeAt(byId[id]), scale: () => scale };

function frame() {
  const dt = Math.min(clock.getDelta(), 0.1);
  const t = params.has('t') ? parseFloat(params.get('t')) : clock.elapsedTime;
  U.uTime.value = t;
  U.uReveal.value = params.has('t') || params.has('noreveal') ? 1 : Math.min(1, Math.max(0, (clock.elapsedTime - 0.3) / 3.4));
  player.update(dt, t);

  const target = targetProfile(camera.position.x, camera.position.z);
  if (!cur) cur = target; else lerpInto(cur, target, 1 - Math.exp(-dt * 3.5));
  applyProfile(cur);
  updateLamps();
  sky.update(cur, camera.position, t);

  if (tour && !player.fly && tour.hold > 0) {
    tour.hold -= dt;
    if (tour.hold <= 0) nextTourStop();
  }
  // museum label follows the zone you are standing in
  const z = currentZone();
  if (z !== lastZone) {
    lastZone = z;
    document.querySelectorAll('.chip').forEach((c) => c.classList.toggle('here', c.dataset.id === z));
    if (player.enabled && !player.fly) { if (z) showLabel(byId[z]); else hideLabel(); }
    if (framed) layoutFrame();
  }
  mapT -= dt; if (mapT <= 0) { mapT = 0.1; drawMap(); }
  if (amb.on) {
    const zw = zoneWeights(camera.position.x, camera.position.z);
    const W = Object.fromEntries(PAINTINGS.map((p, i) => [p.id, zw[i]]));
    amb.update({ wheat: W.wheat, starry: W.starry, rhone: W.rhone, cafe: W.cafe, night: cur.night, inside: W.bedroom });
  }

  if (params.has('nopost')) { renderer.setRenderTarget(null); renderer.render(scene, camera); }
  else {
    renderer.setRenderTarget(rt);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.render(postScene, postCam);
  }
  frames++;
  if (frames === 1) $('loading').classList.add('gone');

  if (adaptive) {
    acc += dt; accN++;
    if (acc > 1.5) {
      const ms = acc / accN * 1000; acc = 0; accN = 0;
      const old = scale;
      if (ms > 38) scale = Math.max(0.45, scale * 0.85);
      else if (ms < 20 && scale < maxScale) scale = Math.min(maxScale, scale * 1.1);
      if (Math.abs(old - scale) > 0.01) resize();
    }
  }
  if (stopAt && frames >= stopAt) { window.__vgDone = true; return; }
  requestAnimationFrame(frame);
}
let stopAt = params.has('frames') ? parseInt(params.get('frames'), 10) : 0;
window.__vg.stop = () => { stopAt = frames + 1; };
window.__vg.ms = () => clock.elapsedTime / Math.max(1, frames);
requestAnimationFrame(frame);
