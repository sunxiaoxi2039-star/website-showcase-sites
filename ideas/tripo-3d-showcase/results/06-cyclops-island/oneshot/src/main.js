// main.js — renderer, orthographic camera + controls, post-processing, input, UI binding and replaceable model slots.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildWorld, islandR, PATH, CAVE_MOUTH, JETTY_ZONE, SHIP_POS, GIANT_BED, groundY } from './world.js';
import { createNav } from './nav.js';
import { createEffects } from './effects.js';
import { createAudio } from './audio.js';
import { createEncounter, TUNING, STAGES } from './encounter.js';
import { normalizeModel } from './actors.js';

const $ = id => document.getElementById(id);
const canvas = $('c');
const isPhone = () => innerWidth <= 760;

// ---------------- renderer / scene ----------------
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#0c3a45');
scene.fog = new THREE.Fog('#0c3a45', 62, 120);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), .04).texture; scene.environmentIntensity = .35;

const hemi = new THREE.HemisphereLight('#d7ecea', '#5d4a30', 1.05); scene.add(hemi);
const sun = new THREE.DirectionalLight('#ffd6a0', 2.9);
sun.position.set(-15, 21, 9); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 70 }); sun.shadow.bias = -.0004; sun.shadow.normalBias = .03;
scene.add(sun, sun.target);
const fill = new THREE.DirectionalLight('#8fc3d0', .45); fill.position.set(12, 10, -10); scene.add(fill);

const world = buildWorld(scene);
const nav = createNav(world);
const fx = createEffects(scene);
const audio = createAudio();
const E = createEncounter({ scene, world, nav, fx, audio });

// ---------------- orthographic three-quarter camera ----------------
const OFF = new THREE.Vector3(19, 31, 34), DIST = OFF.length(), ELEV = Math.asin(OFF.y / DIST), AZ0 = Math.atan2(OFF.x, OFF.z);
const VIEW = 23.5;   // world units visible vertically at zoom 1
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 200);
const cam = { az: AZ0, azGoal: AZ0, zoom: 1, zoomGoal: 1, target: new THREE.Vector3(.4, 0, 1.2), targetGoal: new THREE.Vector3(.4, 0, 1.2), follow: false };
const defaultTarget = () => new THREE.Vector3(isPhone() ? .2 : .4, 0, isPhone() ? 1.6 : 1.2);
function resize() {
  const w = innerWidth, h = innerHeight, a = w / h;
  renderer.setSize(w, h, false); composer.setSize(w, h); bloom.setSize(w, h);
  const vh = VIEW * (a < .8 ? 1.9 : 1);
  camera.left = -vh * a / 2; camera.right = vh * a / 2; camera.top = vh / 2; camera.bottom = -vh / 2; camera.updateProjectionMatrix();
}
function updateCamera(dt) {
  const k = 1 - Math.exp(-dt * 7);
  let d = cam.azGoal - cam.az; cam.az += d * k;
  cam.zoom += (cam.zoomGoal - cam.zoom) * k;
  if (cam.follow) cam.targetGoal.set(E.hero.pos.x, 0, E.hero.pos.z);
  cam.target.lerp(cam.targetGoal, k);
  const ch = Math.cos(ELEV) * DIST;
  camera.position.set(cam.target.x + Math.sin(cam.az) * ch, cam.target.y + Math.sin(ELEV) * DIST, cam.target.z + Math.cos(cam.az) * ch);
  if (fx.shake > 0) { const s = fx.shake * .35; camera.position.x += (Math.random() - .5) * s; camera.position.y += (Math.random() - .5) * s; camera.position.z += (Math.random() - .5) * s; }
  camera.zoom = cam.zoom; camera.updateProjectionMatrix();
  camera.lookAt(cam.target.x + (camera.position.x - cam.target.x - Math.sin(cam.az) * ch), 0, cam.target.z + (camera.position.z - cam.target.z - Math.cos(cam.az) * ch));
}
const clampTarget = () => { const l = Math.hypot(cam.targetGoal.x, cam.targetGoal.z); if (l > 11) cam.targetGoal.multiplyScalar(11 / l); };
const rotateCam = s => { cam.azGoal += s * Math.PI / 4; };
const zoomBy = f => { cam.zoomGoal = Math.min(3.2, Math.max(.55, cam.zoomGoal * f)); };
const resetCam = () => { cam.azGoal = AZ0 + Math.round((cam.az - AZ0) / (Math.PI * 2)) * Math.PI * 2; cam.zoomGoal = 1; cam.targetGoal.copy(defaultTarget()); cam.follow = false; $('camFollow').classList.remove('on'); };

// ---------------- post-processing: bloom, vignette + grain, ACES output ----------------
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), .22, .45, .9);
composer.addPass(bloom);
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uHurt: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime, uHurt; varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      vec2 d = vUv - .5; float r = length(d * vec2(1.15, 1.));
      c.rgb *= mix(.55, 1., smoothstep(.78, .22, r));
      c.rgb = mix(c.rgb, c.rgb * vec3(1.35, .45, .4), uHurt * smoothstep(.25, .75, r));
      float n = fract(sin(dot(vUv * vec2(1917.3, 1433.1) + fract(uTime) * 91.7, vec2(12.9898, 78.233))) * 43758.5453);
      c.rgb *= 1. + (n - .5) * .07;
      gl_FragColor = c;
    }`,
});
composer.addPass(grade);
composer.addPass(new OutputPass());

// ---------------- replaceable model slots ----------------
const SLOTS = [
  { key: 'odysseus', label: 'Odysseus + 3 crew', height: .8, kind: 'character' },
  { key: 'polyphemus', label: 'Polyphemus', height: 2.6, kind: 'character' },
  { key: 'ship', label: 'Greek ship', kind: 'world' },
  { key: 'olive', label: 'Olive tree ×25', kind: 'world' },
  { key: 'cave', label: 'Limestone cave arch', kind: 'world' },
  { key: 'cypress', label: 'Cypress ×9', kind: 'world' },
  { key: 'boulder', label: 'Coastal boulder ×' + world.slots.boulder.transforms.length, kind: 'world' },
];
const slotState = Object.fromEntries(SLOTS.map(s => [s.key, { status: 'procedural', text: 'Procedural placeholder', source: null, tris: 0 }]));
let mode = localStorage.getItem('cyclops.mode') || 'tripo';
const loader = new GLTFLoader();

function countTris(obj) { let n = 0; obj.traverse(o => { if (o.isMesh && o.geometry) n += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; }); return Math.round(n); }

function applyWorldSlot(key, gltf) {
  const slot = world.slots[key];
  if (slot.imported) { scene.remove(slot.imported); slot.imported = null; }
  if (gltf) {
    const group = new THREE.Group();
    for (const t of slot.transforms) {
      const inst = normalizeModel(gltf.scene.clone(true), slot.targetHeight * (t.s || 1));
      inst.position.set(t.x, t.y || 0, t.z); inst.rotation.y = t.rot || 0;
      group.add(inst);
    }
    if (key === 'ship') { group.position.copy(SHIP_POS); group.children[0].position.set(0, 0, 0); group.children[0].rotation.y = 0; }
    scene.add(group); slot.imported = group;
  }
  applyMode();
}
function applyMode() {
  E.mode = mode; E.applyMode();
  for (const key of ['ship', 'olive', 'cave', 'cypress', 'boulder']) {
    const slot = world.slots[key], useImp = mode === 'tripo' && !!slot.imported;
    if (key === 'cave') slot.placeholder.children.forEach(c => { c.visible = !useImp || slot.interior.includes(c) || c.isLight; });
    else slot.placeholder.visible = !useImp;
    if (slot.imported) slot.imported.visible = useImp;
  }
  $('modeTripo').classList.toggle('on', mode === 'tripo'); $('modeOrig').classList.toggle('on', mode === 'original');
  const n = SLOTS.filter(s => slotState[s.key].source).length;
  $('cmpFoot').textContent = n ? `Same view. ${n} / 7 Tripo models in place.` : 'Same view. No Tripo models imported yet — both show the placeholders.';
  localStorage.setItem('cyclops.mode', mode);
}

async function applySlot(key, buffer, source) {
  const def = SLOTS.find(s => s.key === key);
  let gltf;
  try {
    gltf = await loader.parseAsync(buffer, './models/');
    let meshes = 0; gltf.scene.traverse(o => { if (o.isMesh) meshes++; });
    if (!meshes) throw new Error('no meshes in file');
  } catch (err) {
    slotState[key] = { ...slotState[key], status: 'failed', text: 'Import failed — kept the working model (' + (err.message || err) + ')' };
    renderSlots(); return false;
  }
  const tris = countTris(gltf.scene);
  if (def.kind === 'character') {
    const rig = E.setCharacterModel(key, gltf, def.height);
    slotState[key] = rig.animated
      ? { status: 'animated', text: `Imported · animated (${rig.found.join(', ')})`, source, tris }
      : { status: 'static', text: 'Imported · static — no animation clips (gameplay sway only, not animated)', source, tris };
  } else {
    applyWorldSlot(key, gltf);
    slotState[key] = { status: 'imported', text: 'Imported · static scenery', source, tris };
  }
  saveProgress(); renderSlots(); applyMode();
  return true;
}
function resetSlot(key) {
  const def = SLOTS.find(s => s.key === key);
  if (def.kind === 'character') E.setCharacterModel(key, null); else applyWorldSlot(key, null);
  slotState[key] = { status: 'procedural', text: 'Procedural placeholder', source: null, tris: 0 };
  idb('delete', key); saveProgress(); renderSlots(); applyMode();
}
function saveProgress() { localStorage.setItem('cyclops.slots', JSON.stringify(Object.fromEntries(SLOTS.map(s => [s.key, { status: slotState[s.key].status, source: slotState[s.key].source }])))); }
function renderSlots() {
  $('slotTable').innerHTML = SLOTS.map((s, i) => {
    const st = slotState[s.key], cls = st.status === 'failed' ? 'bad' : st.status === 'static' ? 'static' : st.source ? 'ok' : '';
    return `<tr><td>${i + 1}. ${s.key}</td><td>${s.label}<div class="st ${cls}">${st.text}${st.tris ? ` · ${st.tris.toLocaleString()} tris` : ''}${st.source ? ` · ${st.source}` : ''}</div></td>
      <td style="white-space:nowrap"><button data-imp="${s.key}">Import .glb</button>${st.source ? `<button data-rst="${s.key}">Reset</button>` : ''}</td></tr>`;
  }).join('');
}
// IndexedDB keeps local imports across reloads
function idb(op, key, val) {
  return new Promise(res => {
    const rq = indexedDB.open('cyclops-island', 1);
    rq.onupgradeneeded = () => rq.result.createObjectStore('models');
    rq.onerror = () => res(null);
    rq.onsuccess = () => {
      const tx = rq.result.transaction('models', op === 'get' || op === 'keys' ? 'readonly' : 'readwrite'), st = tx.objectStore('models');
      const r = op === 'get' ? st.get(key) : op === 'put' ? st.put(val, key) : op === 'keys' ? st.getAllKeys() : st.delete(key);
      r.onsuccess = () => res(r.result); r.onerror = () => res(null);
    };
  });
}
let importKey = null;
$('slotTable').addEventListener('click', e => {
  const imp = e.target.closest('[data-imp]'), rst = e.target.closest('[data-rst]');
  if (imp) { importKey = imp.dataset.imp; $('fileIn').value = ''; $('fileIn').click(); }
  if (rst) resetSlot(rst.dataset.rst);
});
$('fileIn').addEventListener('change', async () => {
  const f = $('fileIn').files[0]; if (!f || !importKey) return;
  const buf = await f.arrayBuffer();
  if (await applySlot(importKey, buf, 'local: ' + f.name)) idb('put', importKey, { buf, name: f.name });
});
async function loadSavedModels() {
  // 1) bundled models listed in models/manifest.json, 2) browser-local imports (override)
  try {
    const man = await (await fetch('./models/manifest.json', { cache: 'no-cache' })).json();
    for (const s of SLOTS) if (man[s.key]) { try { const r = await fetch('./models/' + man[s.key]); if (r.ok) await applySlot(s.key, await r.arrayBuffer(), 'models/' + man[s.key]); } catch (e) { /* keep placeholder */ } }
  } catch (e) { /* no manifest in file:// mode — placeholders stay */ }
  for (const s of SLOTS) { const rec = await idb('get', s.key); if (rec && rec.buf) await applySlot(s.key, rec.buf, 'local: ' + rec.name); }
}

// ---------------- input ----------------
const keys = new Set();
const moveVec = new THREE.Vector2();
let paused = false;
function setPaused(p) { paused = p; $('pauseOv').hidden = !p; $('btnPause').textContent = p ? '▶' : '❚❚'; audio.pause(p); }
function camBasis() { const f = new THREE.Vector2(-Math.sin(cam.az), -Math.cos(cam.az)); return { f, r: new THREE.Vector2(-f.y, f.x) }; }
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  const k = e.key.toLowerCase(); keys.add(k);
  if (k === ' ' || k.startsWith('arrow')) e.preventDefault();
  if (e.repeat) return;
  if (k === 'p' || k === 'escape') { if (!$('helpOv').hidden) $('helpOv').hidden = true; else if (!$('modelsOv').hidden) $('modelsOv').hidden = true; else setPaused(!paused); }
  if (paused) return;
  if (k === ' ') doDodge();
  if (k === 'e') E.take();
  if (k === 'q') rotateCam(-1);
  if (k === 'r') rotateCam(1);
  if (k === 'f') toggleFollow();
});
addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => keys.clear());
function readMove() {
  let x = 0, y = 0;
  if (keys.has('w') || keys.has('arrowup')) y += 1; if (keys.has('s') || keys.has('arrowdown')) y -= 1;
  if (keys.has('d') || keys.has('arrowright')) x += 1; if (keys.has('a') || keys.has('arrowleft')) x -= 1;
  const { f, r } = camBasis();
  moveVec.set(f.x * y + r.x * x, f.y * y + r.y * x); if (moveVec.lengthSq() > 1) moveVec.normalize();
  return moveVec;
}
function doDodge() { E.dodge(readMove().clone()); }
function toggleFollow() { cam.follow = !cam.follow; $('camFollow').classList.toggle('on', cam.follow); if (!cam.follow) cam.targetGoal.copy(cam.target); }

// pointer: left click = walk, left drag = pan, right drag = rotate, wheel = zoom, pinch = zoom/rotate
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
const pointers = new Map(); let drag = null, pinch = null;
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('pointerdown', e => {
  canvas.setPointerCapture(e.pointerId); pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), ang: Math.atan2(b.y - a.y, b.x - a.x), zoom: cam.zoomGoal, az: cam.azGoal }; drag = null; return; }
  drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, button: e.button, moved: false };
});
canvas.addEventListener('pointermove', e => {
  if (!pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch && pointers.size >= 2) { const [a, b] = [...pointers.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); cam.zoomGoal = Math.min(3.2, Math.max(.55, pinch.zoom * d / pinch.d)); cam.azGoal = pinch.az - (Math.atan2(b.y - a.y, b.x - a.x) - pinch.ang); return; }
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
  if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 6) drag.moved = true;
  if (!drag.moved) return;
  if (drag.button === 2) { cam.azGoal -= dx * .006; cam.az = cam.azGoal; }
  else {
    const upp = (camera.top - camera.bottom) / camera.zoom / innerHeight, { f, r } = camBasis();
    cam.follow = false; $('camFollow').classList.remove('on');
    cam.targetGoal.x -= (r.x * dx - f.x * dy / Math.sin(ELEV)) * upp; cam.targetGoal.z -= (r.y * dx - f.y * dy / Math.sin(ELEV)) * upp; clampTarget();
    cam.target.copy(cam.targetGoal);
  }
});
const endPointer = e => {
  pointers.delete(e.pointerId);
  if (pinch) { if (pointers.size < 2) pinch = null; drag = null; return; }
  if (drag && !drag.moved && drag.button === 0 && !paused) {
    ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObject(world.terrain)[0];
    if (hit) { if (E.setPath(hit.point.x, hit.point.z)) clickMarker(hit.point); }
  }
  drag = null;
};
canvas.addEventListener('pointerup', endPointer); canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('wheel', e => { e.preventDefault(); zoomBy(Math.exp(-e.deltaY * .0015)); }, { passive: false });
const marker = new THREE.Mesh(new THREE.RingGeometry(.16, .22, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#f3ead6', transparent: true, opacity: 0, depthTest: false }));
marker.renderOrder = 8; scene.add(marker); let markerT = 0;
function clickMarker(p) { marker.position.set(p.x, groundY(p.x, p.z) + .05, p.z); markerT = .8; }

// buttons
$('btnDodge').addEventListener('pointerdown', e => { e.preventDefault(); doDodge(); });
$('btnTake').addEventListener('click', () => E.take());
$('btnPause').addEventListener('click', () => setPaused(!paused)); $('resume').addEventListener('click', () => setPaused(false));
$('btnSound').addEventListener('click', () => { const on = audio.toggle(); $('btnSound').textContent = on ? '🔊︎' : '🔇︎'; $('btnSound').title = on ? 'Sound (on)' : 'Sound (off)'; });
$('btnHelp').addEventListener('click', () => { $('helpOv').hidden = false; }); $('helpClose').addEventListener('click', () => { $('helpOv').hidden = true; });
$('btnModels').addEventListener('click', () => { renderSlots(); $('modelsOv').hidden = false; }); $('modelsClose').addEventListener('click', () => { $('modelsOv').hidden = true; });
$('btnHero').addEventListener('click', () => { renderSlots(); $('modelsOv').hidden = false; importKey = 'odysseus'; $('fileIn').value = ''; $('fileIn').click(); });
$('modeTripo').addEventListener('click', () => { mode = 'tripo'; applyMode(); });
$('modeOrig').addEventListener('click', () => { mode = 'original'; applyMode(); });
$('camL').addEventListener('click', () => rotateCam(-1)); $('camR').addEventListener('click', () => rotateCam(1));
$('zoomIn').addEventListener('click', () => zoomBy(1.25)); $('zoomOut').addEventListener('click', () => zoomBy(.8));
$('camReset').addEventListener('click', resetCam); $('camFollow').addEventListener('click', toggleFollow);
$('replay').addEventListener('click', () => { E.reset(); $('endOv').hidden = true; endShown = false; resetCam(); });

// ---------------- minimap ----------------
const mm = $('minimap').getContext('2d');
const islandPoly = Array.from({ length: 90 }, (_, i) => { const a = i / 90 * Math.PI * 2, r = islandR(a); return [Math.cos(a) * r, Math.sin(a) * r]; });
function drawMinimap() {
  const W = 220, s = W / 30, c = mm; c.clearRect(0, 0, W, W);
  c.save(); c.translate(W / 2, W / 2);
  c.fillStyle = 'rgba(12,58,69,.9)'; c.beginPath(); c.arc(0, 0, W / 2, 0, 7); c.fill();
  c.fillStyle = '#6f8d5b'; c.strokeStyle = 'rgba(243,234,214,.6)'; c.lineWidth = 2; c.beginPath(); islandPoly.forEach(([x, z], i) => i ? c.lineTo(x * s, z * s) : c.moveTo(x * s, z * s)); c.closePath(); c.fill(); c.stroke();
  c.strokeStyle = 'rgba(243,234,214,.75)'; c.lineWidth = 3; c.setLineDash([4, 5]); c.beginPath(); PATH.forEach(([x, z], i) => i ? c.lineTo(x * s, z * s) : c.moveTo(x * s, z * s)); c.stroke(); c.setLineDash([]);
  const G = E.state();
  c.fillStyle = '#3b3126'; c.beginPath(); c.arc(CAVE_MOUTH.x * s, (CAVE_MOUTH.y - 1) * s, 7, 0, 7); c.fill();
  if (G.stage === 3) { c.strokeStyle = '#ffd35a'; c.lineWidth = 2; c.beginPath(); c.arc(JETTY_ZONE.x * s, JETTY_ZONE.z * s, TUNING.jettyRadius * s, 0, 7); c.stroke(); }
  c.fillStyle = '#9b2c24'; c.beginPath(); c.arc(SHIP_POS.x * s, SHIP_POS.z * s, 5, 0, 7); c.fill();
  c.fillStyle = '#e0663a'; c.beginPath(); c.arc(E.giant.pos.x * s, E.giant.pos.z * s, 6, 0, 7); c.fill();
  c.fillStyle = '#f3ead6'; E.crew.forEach(m => { c.beginPath(); c.arc(m.pos.x * s, m.pos.z * s, 2.5, 0, 7); c.fill(); });
  c.fillStyle = '#ffd35a'; c.beginPath(); c.arc(E.hero.pos.x * s, E.hero.pos.z * s, 4.5, 0, 7); c.fill();
  // camera view wedge
  c.strokeStyle = 'rgba(255,211,90,.55)'; c.lineWidth = 1.5; c.beginPath(); const a = Math.atan2(-Math.cos(cam.az), -Math.sin(cam.az)); c.moveTo(cam.target.x * s, cam.target.z * s);
  c.lineTo(cam.target.x * s - Math.cos(a) * 40, cam.target.z * s - Math.sin(a) * 40); c.stroke();
  c.restore();
}

// ---------------- UI binding ----------------
const bossTxt = { sleeping: 'ASLEEP · TREAD LIGHTLY', waking: 'WAKING · RUN!', chasing: 'HUNTING YOU', windup: 'GROUND BREAKER · MOVE!', impact: 'GROUND BREAKER', recovery: 'RECOVERING', terminal: 'ROARING AT THE SEA' };
let endShown = false, uiT = 0;
const toast = $('toast');
function updateUI(dt) {
  const G = E.state(), g = E.giant;
  const st = STAGES[G.stage];
  if ($('mTitle').textContent !== st.title) { $('mKicker').textContent = st.kicker; $('mTitle').textContent = st.title; $('mText').textContent = st.text; $('mStage').textContent = `0${G.stage} / 03`; }
  [...$('hearts').children].forEach((h, i) => h.classList.toggle('lost', i >= G.health));
  $('stamina').style.width = G.stamina + '%'; $('stamina').parentElement.classList.toggle('low', G.stamina < TUNING.dodgeCost);
  const p1 = G.stage > 1 ? 100 : Math.max(0, 100 - (Math.hypot(E.hero.pos.x - CAVE_MOUTH.x, E.hero.pos.z - CAVE_MOUTH.y) - 2.2) / 13 * 100);
  $('seg1').style.setProperty('--p', Math.min(100, p1) + '%'); $('seg2').style.setProperty('--p', G.taken / 3 * 100 + '%'); $('seg3').style.setProperty('--p', G.boardT / TUNING.boardTime * 100 + '%');
  const boardedTxt = G.stage === 3 ? `${G.boarded} / 3 aboard` : '3 crew';
  $('crewCount').textContent = boardedTxt;
  let status = '● Taking in the view', warn = false;
  if (G.result === 'defeated') { status = '● Fallen — the myth resets'; warn = true; }
  else if (G.result === 'escaped') status = '● Aboard — sailing home';
  else if (G.dodgeT > 0) status = '● Dodging';
  else if (G.immune > 0) { status = '● Hurt!'; warn = true; }
  else if (G.stage === 3) { status = G.inZone ? `● Holding the jetty · ${G.boardT.toFixed(1)} / 11 s` : '● Get back inside the circle!'; warn = !G.inZone; }
  else if (G.sprinting) status = '● Sprinting'; else if (E.hero.speedNow > .1) status = '● Walking';
  $('heroStatus').textContent = status; $('heroStatus').classList.toggle('warn', warn);
  $('bossState').textContent = bossTxt[g.state] + (g.state === 'windup' && g.charged ? ' · CHARGED' : '');
  $('boss').classList.toggle('alert', g.state !== 'sleeping');
  $('suspicion').style.width = (g.state === 'sleeping' ? G.suspicion : 100) + '%';
  $('dodgeCd').style.width = (G.dodgeCd / TUNING.dodgeCooldown * 100) + '%'; $('btnDodge').classList.toggle('cool', G.dodgeCd > 0 || G.stamina < TUNING.dodgeCost);
  $('btnTake').hidden = G.nearSupply < 0 || !!G.result;
  toast.textContent = G.message || ''; toast.classList.toggle('on', G.messageT > 0);
  // projected destination label
  const [dx, dz, k, tt] = E.targetPoint(); const v = new THREE.Vector3(dx, groundY(dx, dz) + (G.stage === 3 ? 1.2 : 3.2), dz).project(camera);
  const dest = $('dest'); dest.style.left = ((v.x + 1) / 2 * innerWidth) + 'px'; dest.style.top = ((1 - v.y) / 2 * innerHeight) + 'px';
  $('destK').textContent = k.toUpperCase(); $('destT').textContent = tt; dest.style.opacity = G.result ? 0 : 1;
  if (G.result === 'escaped' && G.resultT > 1.8 && !endShown) {
    endShown = true; $('endOv').hidden = false;
    $('endText').textContent = G.hits === 0 ? 'Not a scratch. Homer would need a new verse.' : `Odysseus and all three crew are aboard. Polyphemus roars at an empty shore.`;
    $('endStats').innerHTML = [['TIME', fmt(G.time)], ['HITS TAKEN', G.hits], ['DODGES', G.dodges], ['SLAMS SURVIVED', G.slams]].map(([a, b]) => `<div><dt>${a}</dt><dd>${b}</dd></div>`).join('');
  }
  if (G.result === 'escaped') G.resultT += dt;
  uiT += dt; if (uiT > .1) { uiT = 0; drawMinimap(); }
}
const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// ---------------- loop + frame-time measurement ----------------
const clock = new THREE.Clock(); let simT = 0;
const frames = []; let fpsT = 0;
function frame() {
  requestAnimationFrame(frame);
  const raw = clock.getDelta(), dt = Math.min(raw, 1 / 20);
  frames.push(raw * 1000); if (frames.length > 240) frames.shift();
  if (!paused) {
    simT += dt;
    E.update(dt, simT, { move: readMove(), sprint: keys.has('shift') });
    world.update(simT, dt);
    fx.update(dt, cam.zoom * innerHeight / (camera.top - camera.bottom));
    grade.uniforms.uTime.value = simT;
    grade.uniforms.uHurt.value = Math.max(0, E.hero.hurt) * .8;
    for (const [i, fp] of (world.firePoints || []).entries()) if (Math.random() < dt * 5) fx.embers(fp.x, fp.y, fp.z);
    markerT = Math.max(0, markerT - dt); marker.material.opacity = markerT; marker.scale.setScalar(1 + (1 - markerT) * .6);
  }
  updateCamera(paused ? 0 : dt);
  sun.position.set(cam.target.x - 15, 21, cam.target.z + 9); sun.target.position.set(cam.target.x, 0, cam.target.z);
  composer.render();
  updateUI(paused ? 0 : dt);
  fpsT += raw; if (fpsT > .5) { fpsT = 0; const avg = frames.reduce((a, b) => a + b, 0) / frames.length; $('fps').textContent = Math.round(1000 / avg) + ' FPS'; }
}
window.__perf = () => { const s = [...frames].sort((a, b) => a - b), avg = s.reduce((a, b) => a + b, 0) / s.length; return { avgMs: +avg.toFixed(2), p95Ms: +s[Math.floor(s.length * .95)].toFixed(2), fps: +(1000 / avg).toFixed(1), calls: renderer.info.render.calls, tris: renderer.info.render.triangles }; };
setInterval(() => { const p = window.__perf(); $('perfLine').textContent = `Measured here: ${p.fps} fps · avg ${p.avgMs} ms · p95 ${p.p95Ms} ms · ${p.calls} draw calls · ${p.tris.toLocaleString()} triangles`; }, 1000);

// test hooks for automated acceptance checks
window.__game = { E, world, nav, fx, cam, camera, TUNING, setPaused, isPaused: () => paused, setMode: m => { mode = m; applyMode(); }, applySlot, slotState, resetCam, rotateCam, keys };

addEventListener('resize', resize);
resize(); resetCam(); cam.target.copy(cam.targetGoal); applyMode(); renderSlots();
frame();
loadSavedModels().finally(() => setTimeout(() => $('loading').classList.add('done'), 250));
