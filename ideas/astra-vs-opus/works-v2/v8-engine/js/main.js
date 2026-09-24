import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ENGINE, STROKES, computeCycle, sampleCycle, strokeAt, psiOf, wrap720, valveLift, pistonDisp } from './physics.js';
import { createEngine, G } from './engine3d.js';
import { drawCycle, drawTimingWheel, drawFiring, drawScrubber, COLORS } from './charts.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const params = new URLSearchParams(location.search);
if (params.has('shot')) document.body.classList.add('shot');

// ---------------- 状态 ----------------
const DEFAULTS = { rpm: 3000, throttle: 1, advance: 26, vvt: 0 };
const S = {
  theta: 14, playing: true, slow: 1 / 150, focus: 1, mode: 'section', cview: 'ptheta',
  flow: true, sound: false, ...DEFAULTS,
};
if (params.has('theta')) S.theta = +params.get('theta');
if (params.has('paused')) S.playing = false;
if (params.has('mode')) S.mode = params.get('mode');
if (params.has('focus')) S.focus = +params.get('focus');
let cycle = computeCycle(S);

const STROKE_TEXT = {
  intake: '活塞从上止点下行，进气门打开，缸内形成负压，新鲜空气与燃油经进气道被“吸”进来。进气门要到下止点后约 48° 才关闭——借助气流惯性再多塞进一点空气。',
  compression: '两个气门都关闭，活塞上行把混合气压缩到约 1/11 的体积，压力升到十几 bar、温度升至 600 K 以上。上止点前火花塞提前点火，给火焰留出传播时间。',
  power: '火焰从火花塞向四周扩散，约 50° 曲轴转角内烧完混合气。缸压在上止点后十几度达到峰值，推动活塞下行，经连杆把直线运动变成曲轴的旋转——这是唯一产生功的冲程。',
  exhaust: '排气门在下止点前约 52° 提前打开，高压废气先“自由冲出”，随后活塞上行把残余废气推进排气歧管。上止点附近进、排气门同时微开，这段时间叫“气门重叠”。',
};
const STROKE_TARGET = { intake: 450, compression: 640, power: 16, exhaust: 270 };
const PARTS = [
  ['crank', '曲轴', '横置平面（cross-plane）曲轴：4 个曲柄销互成 90°（0°/90°/270°/180°），每个曲柄销同时驱动左右两列各一缸。配重块抵消旋转与一阶往复惯性力，让 V8 几乎完全平衡；前端是减振皮带轮，后端是飞轮与起动齿圈。'],
  ['rod', '连杆', '连接活塞销与曲柄销，把活塞的往复直线运动转换为曲轴旋转。同一个曲柄销上并排装两根连杆，因此左右两列气缸前后错开约 22 mm。注意连杆摆角：它让活塞在上止点附近停留得更久。'],
  ['piston', '活塞', '铝合金活塞，三道活塞环（两道气环密封燃气、一道油环刮油）。活塞顶在上止点时距缸盖仅约 1 mm；燃烧压力峰值时它承受约 4.5 吨的推力。'],
  ['cam', '凸轮轴', '每列缸盖有两根顶置凸轮轴（DOHC）：谷侧为进气、外侧为排气。凸轮轴由正时链驱动，转速只有曲轴的一半——四冲程每缸每 720° 只需开关一次气门。模型中的凸轮型线是按真实升程曲线逐点生成的；进气凸轮前端是 VVT 相位器，拖动右侧 VVT 滑块可以看到它整体转动。'],
  ['valvetrain', '气门机构', '每缸 4 气门：2 个较大的进气门（蓝色弹簧）+ 2 个排气门（橙色弹簧）。凸轮直接压下桶形挺柱把气门顶开，气门弹簧负责把它关回去。最大升程约 11.8 mm。'],
  ['chain', '正时链', '曲轴链轮 20 齿、凸轮轴链轮 40 齿，2:1 减速。两条链条分别驱动左右两列缸盖。链条一旦跳齿，气门与活塞就会相撞——这就是“正时”二字的分量。'],
  ['ignition', '火花塞 / 点火线圈', '每缸一个独立点火线圈（COP），按 1-8-4-3-6-5-7-2 的顺序每 90° 曲轴转角点火一次。点火提前角随转速和负荷变化：点得太早会爆震，太晚则浪费做功。'],
  ['block', '缸体', '90° V 型缸体：缸径 94 mm、行程 92 mm，总排量约 5.1 L。剖切面（红色斜线）显示了缸壁、缸盖螺栓孔和下方的主轴承隔板。'],
  ['head', '缸盖', '缸盖构成燃烧室顶部，内部布置进排气道、气门导管与凸轮轴承座。进气道全部朝向 V 型谷，排气道朝外——这就是“谷进外排”的典型布置。'],
  ['accessory', '前端附件', '多楔带把曲轴减振皮带轮的动力分给水泵（冷却液循环）和发电机（给点火线圈与电子设备供电）。水泵皮带轮比曲轴小，所以转得更快。只有“外观”视图下显示。'],
  ['intake', '进气歧管', '稳压腔 + 8 根独立进气道，前端节气门体控制进气量——拖动“节气门开度”可以看到蝶阀转动，歧管压力随之变化。'],
  ['exhaust', '排气歧管', '每列 4 进 1 集管。横置平面曲轴让同一列的点火间隔不均匀（例如右列 1→3→5→7 的间隔为 270°/180°/90°/180°），排气脉冲在集管里“挤成一团”，这正是美式 V8 标志性“突突”声浪的来源。打开声音听听看。'],
];
const PART_NAME = Object.fromEntries(PARTS.map(([k, n]) => [k, n]));

// ---------------- 渲染器 ----------------
const canvas = $('#gl'), stage = $('#stage');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.localClippingEnabled = true;
const DPR = Math.min(window.devicePixelRatio || 1, 1.75);
renderer.setPixelRatio(DPR);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.92;
const BG0 = new THREE.Color('#0e1219'), BG1 = new THREE.Color('#0a2445');
renderer.setClearColor(BG0);

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.3;
scene.add(new THREE.HemisphereLight('#bcd4ff', '#2a2320', 0.6));
const key = new THREE.DirectionalLight('#fff1e0', 1.7); key.position.set(6, 10, 7); scene.add(key);
const rim = new THREE.DirectionalLight('#7fb0ff', 1.6); rim.position.set(-7, 4, -8); scene.add(rim);
const fill = new THREE.DirectionalLight('#ffb27a', 0.5); fill.position.set(-5, -2, 6); scene.add(fill);

const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 600);
const CAMS = {
  hero: { pos: new THREE.Vector3(5.6, 11.8, 14.2), target: new THREE.Vector3(0, 0.85, -0.3) },
  front: { pos: new THREE.Vector3(0.001, 1.6, 17), target: new THREE.Vector3(0, 1.2, 0) },
  top: { pos: new THREE.Vector3(0.001, 18, 2.2), target: new THREE.Vector3(0, 1.2, 0) },
  side: { pos: new THREE.Vector3(16.5, 3.2, 1.2), target: new THREE.Vector3(0, 1.2, 0) },
};
camera.position.copy(CAMS.hero.pos);
const controls = new OrbitControls(camera, canvas);
controls.target.copy(CAMS.hero.target);
controls.enableDamping = true; controls.dampingFactor = 0.08;
controls.minDistance = 4; controls.maxDistance = 120;
controls.maxPolarAngle = Math.PI * 0.62;

// 地面：淡网格 + 接触阴影
const floorMat = new THREE.ShaderMaterial({
  uniforms: { uO: { value: 1 } },
  vertexShader: `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `varying vec2 vP; uniform float uO;
    float grid(vec2 p, float s){ vec2 q = p * s; vec2 g = abs(fract(q - 0.5) - 0.5) / fwidth(q); return 1.0 - min(min(g.x, g.y), 1.0); }
    void main(){
      float fade = smoothstep(11.0, 1.5, length(vP));
      float a = (grid(vP, 2.0) * 0.045 + grid(vP, 0.5) * 0.09) * fade;
      float sh = smoothstep(1.0, 0.0, length(vP / vec2(3.3, 4.6)));
      float A = clamp(a + sh * 0.6, 0.0, 1.0);
      vec3 col = vec3(0.62, 0.7, 0.82) * a / max(A, 1e-3);
      gl_FragColor = vec4(col, A * uO);
    }`,
  transparent: true, depthWrite: false,
});
const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), floorMat);
floor.rotation.x = -Math.PI / 2; floor.position.y = -1.74; floor.renderOrder = -1;
scene.add(floor);
// 原理图底纸
const paperMat = new THREE.ShaderMaterial({
  uniforms: { uO: { value: 0 } },
  vertexShader: `varying vec2 vP; void main(){ vP = (modelMatrix * vec4(position,1.0)).xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `varying vec2 vP; uniform float uO;
    float grid(vec2 p, float s){ vec2 q = p * s; vec2 g = abs(fract(q - 0.5) - 0.5) / fwidth(q); return 1.0 - min(min(g.x, g.y), 1.0); }
    void main(){ float a = grid(vP, 4.0) * 0.07 + grid(vP, 1.0) * 0.16; gl_FragColor = vec4(vec3(0.6, 0.82, 1.0), a * uO); }`,
  transparent: true, depthWrite: false,
});
const paper = new THREE.Mesh(new THREE.PlaneGeometry(80, 50), paperMat);
paper.position.set(0, 1.2, -6); paper.renderOrder = -1; paper.visible = false;
scene.add(paper);

const engine = createEngine(scene);
const cyls = engine.cyls;

// 后期：辉光
const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, rt);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(4, 4), 0.8, 0.6, 1.9);
composer.addPass(bloom);
if (params.has('nobloom')) bloom.enabled = false;
composer.addPass(new OutputPass());

function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h, false);
  composer.setPixelRatio(DPR);
  composer.setSize(w, h);
  camera.aspect = w / h;
  camera.zoom = Math.min(1, camera.aspect / 0.92);
  // 桌面布局时把视觉中心移到两侧面板之间
  const wide = window.innerWidth > 980;
  if (wide) {
    const l = $('#left').getBoundingClientRect(), r = $('#right').getBoundingClientRect();
    const cx = (l.right + r.left) / 2;
    camera.setViewOffset(w, h, w / 2 - cx, 0, w, h);
  } else camera.clearViewOffset();
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(stage);
window.addEventListener('resize', resize);
resize();

// ---------------- 声音：按左右两列 EVO 事件合成排气脉冲 ----------------
const audio = {
  ctx: null, buf: null, out: null,
  init() {
    if (this.ctx) return;
    const ctx = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    const len = Math.floor(ctx.sampleRate * 0.16);
    const b = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = b.getChannelData(0);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const t = i / ctx.sampleRate;
      lp += (Math.random() * 2 - 1 - lp) * 0.25;
      d[i] = lp * Math.exp(-t / 0.022) * 1.6 + Math.sin(2 * Math.PI * 62 * t) * Math.exp(-t / 0.045) * 0.9 + Math.sin(2 * Math.PI * 31 * t) * Math.exp(-t / 0.07) * 0.6;
    }
    this.buf = b;
    const comp = ctx.createDynamicsCompressor();
    this.lp = ctx.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.frequency.value = 900; this.lp.Q.value = 0.7;
    this.out = ctx.createGain(); this.out.gain.value = 0.7;
    this.lp.connect(comp); comp.connect(this.out); this.out.connect(ctx.destination);
  },
  pop(delay, pan, level, rate) {
    const ctx = this.ctx; if (!ctx || ctx.state !== 'running') return;
    const src = ctx.createBufferSource(); src.buffer = this.buf; src.playbackRate.value = rate;
    const g = ctx.createGain(); g.gain.value = level;
    const p = ctx.createStereoPanner(); p.pan.value = pan;
    src.connect(g); g.connect(p); p.connect(this.lp);
    src.start(ctx.currentTime + 0.03 + delay);
  },
};

// ---------------- UI 构建 ----------------
const cp = { even: $('[data-bank="even"]'), odd: $('[data-bank="odd"]') };
for (const c of cyls) {
  const b = document.createElement('button');
  b.textContent = c.id; b.dataset.cyl = c.id; b.title = `聚焦第 ${c.id} 缸`;
  (c.id % 2 ? cp.odd : cp.even).appendChild(b);
}
const labels = cyls.map((c) => {
  const el = document.createElement('button');
  el.className = 'clabel'; el.textContent = c.id; el.dataset.cyl = c.id; el.title = `第 ${c.id} 缸`;
  $('#labels').appendChild(el); return el;
});
$('#fo').innerHTML = ENGINE.firingOrder.map((id) => `<span data-cyl="${id}">${id}</span>`).join('');
$('#parts').innerHTML = PARTS.map(([k, n]) => `<button data-part="${k}">${n}</button>`).join('');

function setFocus(id) {
  S.focus = id;
  $$('#cylpick button').forEach((b) => b.classList.toggle('on', +b.dataset.cyl === id));
  $('#hs-cyl').textContent = id; $('#cc-cyl').textContent = id;
  lastStrokeKey = null;
}
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-cyl]');
  if (t && !t.closest('#fo')) setFocus(+t.dataset.cyl);
  else if (t) setFocus(+t.dataset.cyl);
});

// 冲程切换：把聚焦缸“拨”到该冲程
let tween = null;
function goStroke(key) {
  const c = cyls[S.focus - 1];
  const psi = psiOf(c, S.theta);
  let d = wrap720(STROKE_TARGET[key] - psi);
  if (d < 4) d += 0;
  tween = { from: S.theta, to: S.theta + d, t: 0, dur: 0.45 + d / 720 * 0.9 };
  setPlaying(false);
}
$$('#strokes button').forEach((b) => b.addEventListener('click', () => goStroke(b.dataset.stroke)));

function setPlaying(p) {
  S.playing = p;
  $('#play-ico').setAttribute('d', p ? 'M7 5h3.5v14H7zM13.5 5H17v14h-3.5z' : 'M8 5v14l11-7z');
}
$('#play').addEventListener('click', () => { tween = null; setPlaying(!S.playing); });
$('#stepb').addEventListener('click', () => { tween = null; setPlaying(false); S.theta = wrap720(S.theta - 5); });
$('#stepf').addEventListener('click', () => { tween = null; setPlaying(false); S.theta = wrap720(S.theta + 5); });
$('#speed').addEventListener('change', (e) => { S.slow = +e.target.value; });
$('#flow').addEventListener('change', (e) => { S.flow = e.target.checked; });
$('#sound').addEventListener('click', () => {
  S.sound = !S.sound;
  if (S.sound) { audio.init(); audio.ctx.resume(); }
  else if (audio.ctx) audio.ctx.suspend();
  $('#sound').classList.toggle('on', S.sound);
  $('#snd-x').style.display = S.sound ? 'none' : ''; $('#snd-w').style.display = S.sound ? '' : 'none';
});
window.addEventListener('keydown', (e) => {
  if (e.target.matches('input, select, textarea')) return;
  if (e.code === 'Space') { e.preventDefault(); tween = null; setPlaying(!S.playing); }
  else if (e.key === 'ArrowRight') { setPlaying(false); S.theta = wrap720(S.theta + (e.shiftKey ? 45 : 5)); }
  else if (e.key === 'ArrowLeft') { setPlaying(false); S.theta = wrap720(S.theta - (e.shiftKey ? 45 : 5)); }
  else if (/^[1-8]$/.test(e.key)) setFocus(+e.key);
});

// 视图模式
let bpState = { on: false, t: 0, anim: null, saved: null };
function setMode(m) {
  $$('#modes button').forEach((b) => b.classList.toggle('on', b.dataset.mode === m));
  if (m === 'blueprint') { enterBlueprint(); return; }
  S.mode = m;
  if (bpState.on) { exitBlueprint(m); return; }
  engine.applyMode(m);
}
$$('#modes button').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));

let camTween = null;
function flyTo(pos, target, dur = 0.9, fov) {
  camTween = { p0: camera.position.clone(), t0: controls.target.clone(), p1: pos.clone(), t1: target.clone(), f0: camera.fov, f1: fov ?? camera.fov, t: 0, dur };
}
$$('#cams button').forEach((b) => b.addEventListener('click', () => {
  const c = CAMS[b.dataset.cam];
  if (bpState.on) return;
  flyTo(c.pos, c.target);
}));

// 原理图：扫描平面把实体“擦”成线稿，同时摄像机做 dolly-zoom 变成近正交前视
function enterBlueprint() {
  if (bpState.on || bpState.anim) return;
  engine.setBlueprint(true);
  paper.visible = true;
  bpState.saved = { pos: camera.position.clone(), target: controls.target.clone(), fov: camera.fov };
  const fovB = 7;
  const target = new THREE.Vector3(0, 1.45, 0);
  const H = 10.2;
  const dist = H / 2 / Math.tan(fovB / 2 * Math.PI / 180);
  bpState.anim = { dir: 1, t: 0, dur: 1.7, from: bpState.saved, to: { pos: new THREE.Vector3(0, 1.45, dist), target, fov: fovB } };
  controls.enabled = false;
}
function exitBlueprint(m) {
  if (bpState.anim) return;
  engine.applyMode(m);
  const back = bpState.saved || { pos: CAMS.hero.pos, target: CAMS.hero.target, fov: 30 };
  bpState.anim = { dir: -1, t: 0, dur: 1.5, from: { pos: camera.position.clone(), target: controls.target.clone(), fov: camera.fov }, to: back };
  controls.enabled = false;
  $('#annot').classList.remove('on'); $('#bp-title').classList.remove('on');
}
const ease = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
function stepBlueprint(dt) {
  const a = bpState.anim; if (!a) return;
  a.t = Math.min(1, a.t + dt / a.dur);
  const e = ease(a.t);
  // dolly-zoom：按视高插值，保持构图连续
  const h0 = a.from.pos.distanceTo(a.from.target) * 2 * Math.tan(a.from.fov / 2 * Math.PI / 180);
  const h1 = a.to.pos.distanceTo(a.to.target) * 2 * Math.tan(a.to.fov / 2 * Math.PI / 180);
  const fov = Math.exp(THREE.MathUtils.lerp(Math.log(a.from.fov), Math.log(a.to.fov), e));
  const H = THREE.MathUtils.lerp(h0, h1, e);
  const dist = H / 2 / Math.tan(fov / 2 * Math.PI / 180);
  const d0 = a.from.pos.clone().sub(a.from.target).normalize();
  const d1 = a.to.pos.clone().sub(a.to.target).normalize();
  const dir = d0.clone().lerp(d1, e).normalize();
  const tgt = a.from.target.clone().lerp(a.to.target, e);
  camera.fov = fov; camera.position.copy(tgt).addScaledVector(dir, dist); controls.target.copy(tgt);
  camera.updateProjectionMatrix();
  // 扫描平面（沿 x 方向）
  const sw = a.dir > 0 ? THREE.MathUtils.lerp(-4.2, 4.2, THREE.MathUtils.smoothstep(a.t, 0.15, 0.9)) : THREE.MathUtils.lerp(4.2, -4.2, THREE.MathUtils.smoothstep(a.t, 0.05, 0.8));
  engine.sweep(sw);
  const k = a.dir > 0 ? e : 1 - e;
  setBpAmount(k);
  if (a.t >= 1) {
    bpState.anim = null; controls.enabled = true;
    if (a.dir > 0) {
      bpState.on = true; engine.sweep(100);
      $('#annot').classList.add('on'); $('#bp-title').classList.add('on');
    } else {
      bpState.on = false; engine.sweep(-100); engine.setBlueprint(false); paper.visible = false;
    }
  }
}
function setBpAmount(k) {
  renderer.setClearColor(BG0.clone().lerp(BG1, k));
  floorMat.uniforms.uO.value = 1 - k;
  paperMat.uniforms.uO.value = k;
  bloom.strength = 0.8 * (1 - k * 0.5);
  stage.classList.toggle('bp', k > 0.5);
  for (const l of labels) { l.style.opacity = String(1 - k); l.style.pointerEvents = k > 0.5 ? 'none' : ''; }
}

// 部件
function selectPart(k) {
  const same = engine.selected === k;
  const key = same ? null : k;
  engine.select(key);
  $$('#parts button').forEach((b) => b.classList.toggle('on', b.dataset.part === key));
  const card = $('#part-card');
  if (key) {
    const p = PARTS.find((x) => x[0] === key);
    $('#pc-name').textContent = p[1]; $('#pc-text').textContent = p[2]; card.hidden = false;
  } else card.hidden = true;
}
$('#parts').addEventListener('click', (e) => { const b = e.target.closest('[data-part]'); if (b) selectPart(b.dataset.part); });
$('#pc-close').addEventListener('click', () => selectPart(engine.selected));

// 3D 拾取
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
function pick(ev) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObjects(engine.pickables(), false);
  for (const h of hits) {
    const planes = h.object.material.clippingPlanes;
    if (planes && planes.some((p) => p.distanceToPoint(h.point) < -1e-3)) continue;
    return h.object.userData.part;
  }
  return null;
}
let down = null, lastHover = 0;
const tip = $('#tip');
canvas.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
canvas.addEventListener('pointerup', (e) => {
  if (!down) return;
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
  down = null;
  if (moved > 5 || bpState.on) return;
  const p = pick(e);
  if (p) selectPart(p); else if (engine.selected) selectPart(engine.selected);
});
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse' || down || bpState.on) return;
  const now = performance.now(); if (now - lastHover < 70) return; lastHover = now;
  const p = pick(e);
  const r = stage.getBoundingClientRect();
  if (p) {
    tip.innerHTML = `${PART_NAME[p]}<small>点击查看</small>`;
    tip.style.left = `${e.clientX - r.left}px`; tip.style.top = `${e.clientY - r.top}px`;
    tip.classList.add('on'); canvas.style.cursor = 'pointer';
  } else { tip.classList.remove('on'); canvas.style.cursor = ''; }
});
canvas.addEventListener('pointerleave', () => tip.classList.remove('on'));

// 调参
const sliders = {
  rpm: { el: $('#s-rpm'), out: $('#o-rpm'), fmt: (v) => `${v} rpm` },
  throttle: { el: $('#s-thr'), out: $('#o-thr'), fmt: (v) => `${Math.round(v * 100)}%` },
  advance: { el: $('#s-adv'), out: $('#o-adv'), fmt: (v) => `${v}° BTDC` },
  vvt: { el: $('#s-vvt'), out: $('#o-vvt'), fmt: (v) => (v > 0 ? `提前 ${v}°` : v < 0 ? `推迟 ${-v}°` : '0°') },
};
let recomputeTimer = 0, mbt = null;
function onParam() {
  for (const [k, s] of Object.entries(sliders)) { S[k] = +s.el.value; s.out.textContent = s.fmt(S[k]); }
  cycle = computeCycle(S);
  updateMetrics();
  clearTimeout(recomputeTimer);
  recomputeTimer = setTimeout(findMBT, 120);
}
for (const s of Object.values(sliders)) s.el.addEventListener('input', onParam);
$('#reset').addEventListener('click', () => {
  for (const [k, v] of Object.entries(DEFAULTS)) sliders[k].el.value = v;
  onParam();
});
function findMBT() {
  let best = -1e9, bestA = 0;
  for (let a = 4; a <= 45; a += 1) {
    const c = computeCycle({ ...S, advance: a });
    if (c.imep > best) { best = c.imep; bestA = a; }
  }
  mbt = bestA; updateHint();
}
function updateMetrics() {
  $('#m-rpm').textContent = S.rpm;
  $('#m-tq').textContent = cycle.torque.toFixed(0);
  $('#m-pw').textContent = (cycle.power / 1000).toFixed(0);
  $('#m-imep').textContent = (cycle.imep / 1e5).toFixed(1);
  $('#r-peak').textContent = `${(cycle.peak / 1e5).toFixed(0)} bar @ ${cycle.peakPsi >= 0 ? '+' : ''}${cycle.peakPsi.toFixed(0)}°`;
  $('#knock').hidden = cycle.knock < 1;
  const ev = cycle.ev;
  const ov = ev.EVC - ev.IVO;
  const fmt = (a, ref, pre, post) => { const d = a - ref; return d < 0 ? `${-d}° ${pre}` : `${d}° ${post}`; };
  $('#vt').innerHTML = `
    <dt style="color:${COLORS.intake}">IVO</dt><dd>${fmt(ev.IVO, 360, 'BTDC', 'ATDC')}</dd>
    <dt style="color:${COLORS.intake}">IVC</dt><dd>${fmt(ev.IVC, 540, 'BBDC', 'ABDC')}</dd>
    <dt style="color:${COLORS.exhaust}">EVO</dt><dd>${fmt(ev.EVO, 180, 'BBDC', 'ABDC')}</dd>
    <dt style="color:${COLORS.exhaust}">EVC</dt><dd>${fmt(ev.EVC, 360, 'BTDC', 'ATDC')}</dd>
    <dt style="color:#ffe07a">点火</dt><dd>${S.advance}° BTDC</dd>
    <dt>重叠</dt><dd>${Math.max(0, ov)}°</dd>`;
  updateHint();
}
function updateHint() {
  const h = $('#tune-hint');
  const pk = cycle.peakPsi;
  let t;
  if (cycle.knock >= 1) t = `<b>点火过早：</b>压力峰值出现在上止点后 ${pk.toFixed(0)}°，峰值 ${(cycle.peak / 1e5).toFixed(0)} bar，末端混合气可能自燃——爆震。`;
  else if (pk > 22) t = `<b>点火偏晚：</b>压力峰值拖到上止点后 ${pk.toFixed(0)}°，活塞已经下行，燃烧能量更多变成废气热量。`;
  else if (pk < 8) t = `<b>接近爆震边缘：</b>峰值压力来得太早（+${pk.toFixed(0)}°），活塞仍在上止点附近“顶着”燃烧。`;
  else t = `<b>点火时机合适：</b>压力峰值在上止点后 ${pk.toFixed(0)}°，接近最佳扭矩点（通常 12–16° ATDC）。`;
  if (mbt != null) t += ` 本工况 MBT ≈ ${mbt}° BTDC。`;
  if (S.vvt >= 12) t += ` 进气凸轮提前 ${S.vvt}° → 气门重叠扩大到 ${cycle.ev.EVC - cycle.ev.IVO}°。`;
  else if (S.vvt <= -10) t += ` 进气门推迟到下止点后 ${cycle.ev.IVC - 540}° 才关闭。`;
  h.innerHTML = t;
}

// 图表交互
$$('#cview button').forEach((b) => b.addEventListener('click', () => {
  S.cview = b.dataset.v;
  $$('#cview button').forEach((x) => x.classList.toggle('on', x === b));
}));
let firingHit = null;
$('#c-firing').addEventListener('click', (e) => {
  if (!firingHit) return;
  const r = e.currentTarget.getBoundingClientRect();
  setFocus(firingHit.rowAt(e.clientY - r.top));
});
let scrubHit = null, scrubbing = false, wasPlaying = false;
const scrubEl = $('#c-scrub');
function scrubTo(e) {
  if (!scrubHit) return;
  const r = scrubEl.getBoundingClientRect();
  const xa = scrubHit.xaAt(e.clientX - r.left);
  const psi = xa < 0 ? xa + 720 : xa;
  S.theta = wrap720(cyls[S.focus - 1].phase + psi);
}
scrubEl.addEventListener('pointerdown', (e) => { scrubbing = true; wasPlaying = S.playing; tween = null; setPlaying(false); scrubEl.setPointerCapture(e.pointerId); scrubTo(e); });
scrubEl.addEventListener('pointermove', (e) => { if (scrubbing) scrubTo(e); });
scrubEl.addEventListener('pointerup', () => { scrubbing = false; if (wasPlaying) setPlaying(true); });

// ---------------- 主循环 ----------------
const tmpV = new THREE.Vector3();
let last = performance.now();
let lastStrokeKey = null;
const factsCache = {};
function setText(id, v, cls) {
  if (factsCache[id] === v + cls) return; factsCache[id] = v + cls;
  const el = document.getElementById(id); el.textContent = v; if (cls !== undefined) el.className = cls;
}
const fireUntil = new Float64Array(9);

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  const prev = S.theta;
  let adv = 0;
  if (tween) {
    tween.t = Math.min(1, tween.t + dt / tween.dur);
    const th = tween.from + (tween.to - tween.from) * ease(tween.t);
    adv = th - (tween.cur ?? tween.from); tween.cur = th;
    S.theta = wrap720(th);
    if (tween.t >= 1) tween = null;
  } else if (S.playing && !scrubbing) {
    adv = S.rpm * 6 * S.slow * dt;
    S.theta = wrap720(S.theta + adv);
  } else {
    let d = S.theta - prev; if (d > 360) d -= 720; if (d < -360) d += 720; adv = d;
  }
  if (!tween && !S.playing && !scrubbing && adv === 0) adv = 0;

  // 声音与点火提示：检测 EVO（排气脉冲）/ 点火事件
  if (adv > 0) {
    const a0 = prev, a1 = prev + adv;
    for (const c of cyls) {
      // 点火
      let e = c.phase + cycle.ign; while (e > a0) e -= 720; e += 720;
      if (e <= a1 && S.slow < 0.2) fireUntil[c.id] = now + 500;
      // 排气脉冲
      let x = c.phase + cycle.ev.EVO; while (x > a0) x -= 720;
      for (x += 720; x <= a1; x += 720) {
        if (S.sound) {
          const frac = (x - a0) / adv;
          const realtime = S.slow >= 0.99;
          audio.pop(frac * dt, c.id % 2 ? 0.55 : -0.55, (0.35 + 0.65 * S.throttle) * (realtime ? 0.55 : 1), realtime ? 0.8 + S.rpm / 9000 : 0.75);
        }
      }
    }
    if (audio.lp) audio.lp.frequency.value = 500 + S.rpm * 0.25 * (0.5 + S.throttle);
  }

  engine.update({ theta: S.theta, cycle, params: S, dTheta: Math.min(adv, 40), dt, focusId: S.focus, showFlow: S.flow, showGas: !params.has('nogas') });
  stepBlueprint(dt);
  if (camTween) {
    camTween.t = Math.min(1, camTween.t + dt / camTween.dur);
    const e = ease(camTween.t);
    camera.position.lerpVectors(camTween.p0, camTween.p1, e);
    controls.target.lerpVectors(camTween.t0, camTween.t1, e);
    if (camTween.t >= 1) camTween = null;
  }
  controls.update();
  engine.setPointScale(renderer.domElement.height / (2 * Math.tan(camera.fov * Math.PI / 360)) * camera.zoom);
  composer.render();

  // ---- UI ----
  const fc = cyls[S.focus - 1];
  const psi = psiOf(fc, S.theta);
  const st = strokeAt(psi);
  if (st.key !== lastStrokeKey) {
    lastStrokeKey = st.key;
    $('#hs-name').textContent = st.name; $('#hs-en').textContent = st.en;
    $('#hud-stroke').style.setProperty('--c', COLORS[st.key]);
    $$('#strokes button').forEach((b) => b.classList.toggle('on', b.dataset.stroke === st.key));
    $('#sc-text').textContent = STROKE_TEXT[st.key];
  }
  const ev = cycle.ev;
  const li = valveLift(psi, ev.IVO, ev.IVC, 11.8), le = valveLift(psi, ev.EVO, ev.EVC, 11.2);
  setText('f-iv', li > 0.05 ? `开 ${li.toFixed(1)}mm` : '关', li > 0.05 ? 'open' : 'shut');
  setText('f-ev', le > 0.05 ? `开 ${le.toFixed(1)}mm` : '关', le > 0.05 ? 'open' : 'shut');
  const pdir = Math.sin(psi * Math.PI / 180);
  setText('f-pis', Math.abs(pdir) < 0.05 ? (wrap720(psi) % 360 < 90 || wrap720(psi) % 360 > 270 ? '上止点' : '下止点') : pdir > 0 ? '↓ 下行' : '↑ 上行', '');
  const sp = sampleCycle(cycle, psi);
  setText('f-p', `${(sp.p / 1e5).toFixed(1)} bar`, '');
  setText('r-p', (sp.p / 1e5).toFixed(1), undefined);
  setText('t-theta', `${S.theta.toFixed(0)}°`, undefined);
  setText('t-psi', `${(psi >= 360 ? psi - 720 : psi).toFixed(0)}°`, undefined);

  drawCycle($('#c-cycle'), { cycle, psi, view: S.cview === 'pv' ? 'pv' : 'ptheta', log: S.cview === 'log', advance: S.advance });
  drawTimingWheel($('#c-wheel'), { ev, advance: S.advance, psi });
  firingHit = drawFiring($('#c-firing'), { cyls, theta: S.theta, focus: S.focus, firingOrder: ENGINE.firingOrder });
  scrubHit = drawScrubber(scrubEl, { psi, ev, advance: S.advance });

  // 点火顺序条：当前处于做功前 90° 的缸
  let firing = null;
  for (const c of cyls) if (psiOf(c, S.theta) < 90) firing = c.id;
  $$('#fo span').forEach((s) => { s.classList.toggle('fire', +s.dataset.cyl === firing); s.classList.toggle('focus', +s.dataset.cyl === S.focus); });

  // 气缸标签
  const w = stage.clientWidth, h = stage.clientHeight;
  camera.updateMatrixWorld();
  for (const c of cyls) {
    engine.anchorWorld(c.id, tmpV).project(camera);
    const el = labels[c.id - 1];
    const vis = tmpV.z < 1 && Math.abs(tmpV.x) < 1.1 && Math.abs(tmpV.y) < 1.1;
    el.style.display = vis ? '' : 'none';
    el.style.transform = `translate(${(tmpV.x * 0.5 + 0.5) * w}px, ${(-tmpV.y * 0.5 + 0.5) * h}px) translate(-50%, -50%)`;
    const k = strokeAt(psiOf(c, S.theta)).key;
    el.style.setProperty('--c', COLORS[k]);
    el.classList.toggle('focus', c.id === S.focus);
    el.classList.toggle('fire', now < fireUntil[c.id]);
  }
  if (bpState.on) drawAnnotations(w, h);

  requestAnimationFrame(frame);
}

// 原理图标注
function proj(v) { const p = v.clone().project(camera); return [(p.x * 0.5 + 0.5) * stage.clientWidth, (-p.y * 0.5 + 0.5) * stage.clientHeight]; }
function drawAnnotations() {
  const k = engine.keyPoints();
  const C = proj(k.crank), AO = proj(k.axisOdd), AE = proj(k.axisEven);
  const BL0 = proj(k.boreL0), BR0 = proj(k.boreR0), BL = proj(k.boreL), BR = proj(k.boreR);
  const TD0 = proj(k.tdc0), BD0 = proj(k.bdc0), TD = proj(k.tdc), BD = proj(k.bdc);
  const CI = proj(k.camIn), CE = proj(k.camEx);
  const r = Math.hypot(AO[0] - C[0], AO[1] - C[1]) * 0.3;
  const a0 = Math.atan2(AE[1] - C[1], AE[0] - C[0]), a1 = Math.atan2(AO[1] - C[1], AO[0] - C[0]);
  const arc = `M${C[0] + r * Math.cos(a0)},${C[1] + r * Math.sin(a0)} A${r},${r} 0 0 1 ${C[0] + r * Math.cos(a1)},${C[1] + r * Math.sin(a1)}`;
  const arrow = (P, Q, s = 7) => {
    // 两端箭头
    const dx = Q[0] - P[0], dy = Q[1] - P[1], L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
    const hd = (X, sx) => `M${X[0]},${X[1]} l${(ux * sx - uy * 0.4 * s)},${(uy * sx + ux * 0.4 * s)} M${X[0]},${X[1]} l${(ux * sx + uy * 0.4 * s)},${(uy * sx - ux * 0.4 * s)}`;
    return `M${P[0]},${P[1]} L${Q[0]},${Q[1]} ${hd(P, s)} ${hd(Q, -s)}`;
  };
  const ext = (P, Q) => { const dx = Q[0] - P[0], dy = Q[1] - P[1], L = Math.hypot(dx, dy) || 1; return `M${P[0] + dx / L * 4},${P[1] + dy / L * 4} L${Q[0] + dx / L * 6},${Q[1] + dy / L * 6}`; };
  const mid = (P, Q) => [(P[0] + Q[0]) / 2, (P[1] + Q[1]) / 2];
  const bm = mid(BL, BR), sm = mid(TD, BD);
  const ang = (P, Q) => Math.atan2(Q[1] - P[1], Q[0] - P[0]) * 180 / Math.PI;
  const leader = (P, dx, dy, text) => `<path class="dim" d="M${P[0]},${P[1]} l${dx},${dy} l${dx > 0 ? 70 : -70},0"/><circle cx="${P[0]}" cy="${P[1]}" r="2.5" fill="#cfe8ff"/><text class="zh" x="${P[0] + dx + (dx > 0 ? 4 : -4)}" y="${P[1] + dy - 6}" text-anchor="${dx > 0 ? 'start' : 'end'}">${text}</text>`;
  const ba = ang(BL, BR), sa = ang(BD, TD);
  $('#annot').innerHTML = `
    <path class="ctr" d="M${C[0]},${C[1]} L${AO[0]},${AO[1]} M${C[0]},${C[1]} L${AE[0]},${AE[1]}"/>
    <path class="ctr" d="M${C[0] - 60},${C[1]} L${C[0] + 60},${C[1]}"/>
    <path class="dim" d="${arc}"/>
    <text x="${C[0]}" y="${C[1] - r - 8}" text-anchor="middle" style="font-size:13px">90°</text>
    <path class="dim" style="opacity:.6" d="${ext(BL0, BL)} ${ext(BR0, BR)} ${ext(TD0, TD)} ${ext(BD0, BD)}"/>
    <path class="dim" d="${arrow(BL, BR)}"/>
    <text transform="translate(${bm[0]},${bm[1]}) rotate(${ba}) translate(0,-7)" text-anchor="middle">Ø94 缸径</text>
    <path class="dim" d="${arrow(TD, BD)}"/>
    <text class="zh" transform="translate(${sm[0]},${sm[1]}) rotate(${sa}) translate(0,-7)" text-anchor="middle">行程 92</text>
    ${leader(C, -120, 150, '曲轴中心 · 横置平面曲轴')}
    ${leader(CI, 36, -60, '进气凸轮轴（谷侧）')}
    ${leader(CE, -40, -40, '排气凸轮轴')}
    <text class="zh" x="${AO[0] + 8}" y="${AO[1] - 6}">右列 1·3·5·7</text>
    <text class="zh" x="${AE[0] - 8}" y="${AE[1] - 6}" text-anchor="end">左列 2·4·6·8</text>`;
}

// ---------------- 启动 ----------------
setFocus(S.focus);
setPlaying(S.playing);
onParam();
if (S.mode !== 'section') setMode(S.mode);
if (params.has('cam') && CAMS[params.get('cam')]) { const c = CAMS[params.get('cam')]; camera.position.copy(c.pos); controls.target.copy(c.target); }
if (params.has('part')) selectPart(params.get('part'));
requestAnimationFrame((t) => { last = t; frame(t); setTimeout(() => $('#loading').classList.add('done'), 60); });
window.__v8 = { S, engine, camera, controls, setMode, selectPart, goStroke, finish() { if (bpState.anim) bpState.anim.t = 0.999; if (camTween) camTween.t = 0.999; if (tween) tween.t = 0.999; } };
