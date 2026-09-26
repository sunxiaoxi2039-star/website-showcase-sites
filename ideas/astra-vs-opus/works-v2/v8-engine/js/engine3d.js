// V8 发动机三维模型：全部由程序化几何生成（无外部模型文件）
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  ENGINE, cylinderLayout, psiOf, valveEvents, valveLift, MAX_LIFT, liftShape,
  wrap720, sampleCycle, pistonDisp,
} from './physics.js';

const DEG = Math.PI / 180;
const V3 = THREE.Vector3;

// ---------------- 几何尺寸（场景单位 = 分米，1 = 100 mm） ----------------
export const G = (() => {
  const g = {
    bore: ENGINE.bore * 10, r: ENGINE.stroke * 5, rod: ENGINE.rod * 10,
    spacing: 1.10, stagger: 0.11, compH: 0.30, pinR: 0.265, mainR: 0.32,
  };
  g.deck = g.r + g.rod + g.compH + 0.012;
  g.seatY = g.deck + 0.075;
  g.D = 1.0; g.wo = 0.64; g.wh = 0.52; g.Rh = 0.95; g.Ro = 1.08;
  g.zFront = 2.35; g.zRear = -2.35;
  g.tilt = 17 * DEG; g.valveLen = 0.92; g.bucketH = 0.09; g.Rb = 0.165;
  g.camDist = g.valveLen + g.bucketH + g.Rb;
  g.valveX = 0.2; g.valveZ = 0.19;
  g.headW = 0.84; g.headTop = 3.42; g.coverTop = 3.92;
  g.chainZ = { odd: 2.47, even: 2.63 };
  g.webT = 0.14; g.pinLen = 0.44;
  // 凸轮轴中心（缸列局部坐标）
  g.camIn = new THREE.Vector2(-g.valveX - g.camDist * Math.sin(g.tilt), g.seatY + g.camDist * Math.cos(g.tilt));
  g.camEx = new THREE.Vector2(g.valveX + g.camDist * Math.sin(g.tilt), g.seatY + g.camDist * Math.cos(g.tilt));
  return g;
})();
export const pinZ = (i) => (1.5 - i) * G.spacing;

// ---------------- 辅助几何 ----------------
function gearShape(R, n, depth, holeR) {
  const s = new THREE.Shape();
  const w = Math.PI * 2 / n;
  for (let i = 0; i < n; i++) {
    const a = i * w;
    const pts = [[R - depth, a], [R, a + 0.28 * w], [R, a + 0.52 * w], [R - depth, a + 0.8 * w]];
    pts.forEach(([rr, aa], k) => {
      const x = rr * Math.cos(aa), y = rr * Math.sin(aa);
      if (i === 0 && k === 0) s.moveTo(x, y); else s.lineTo(x, y);
    });
  }
  s.closePath();
  if (holeR) { const h = new THREE.Path(); h.absarc(0, 0, holeR, 0, Math.PI * 2, true); s.holes.push(h); }
  return s;
}

function extrudeZ(shape, depth, bevel = 0.015, curveSegments = 24) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.001, depth - 2 * bevel), bevelEnabled: bevel > 0,
    bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments,
  });
  g.translate(0, 0, -depth / 2 + bevel);
  return g;
}

// 在 (x, z) 平面画截面、沿 y 拉伸（用于缸体、缸盖）：shape 中 Y 轴 = -z
function extrudeY(shape, y0, y1, bevel = 0.02) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: y1 - y0 - 2 * bevel, bevelEnabled: bevel > 0, bevelThickness: bevel,
    bevelSize: bevel, bevelSegments: 2, curveSegments: 40,
  });
  g.rotateX(-Math.PI / 2);
  g.translate(0, y0 + bevel, 0);
  return g;
}

function rectShapeXZ(x0, x1, z0, z1, r = 0.06) {
  // 注意 shape 的 Y = -z
  const s = new THREE.Shape();
  const Y0 = -z1, Y1 = -z0;
  s.moveTo(x0 + r, Y0);
  s.lineTo(x1 - r, Y0); s.quadraticCurveTo(x1, Y0, x1, Y0 + r);
  s.lineTo(x1, Y1 - r); s.quadraticCurveTo(x1, Y1, x1 - r, Y1);
  s.lineTo(x0 + r, Y1); s.quadraticCurveTo(x0, Y1, x0, Y1 - r);
  s.lineTo(x0, Y0 + r); s.quadraticCurveTo(x0, Y0, x0 + r, Y0);
  return s;
}
const circlePath = (x, y, r) => { const p = new THREE.Path(); p.absarc(x, y, r, 0, Math.PI * 2, true); return p; };

function cylZ(r, z0, z1, seg = 40) {
  const g = new THREE.CylinderGeometry(r, r, Math.abs(z1 - z0), seg);
  g.rotateX(Math.PI / 2);
  g.translate(0, 0, (z0 + z1) / 2);
  return g;
}

// ---------------- 着色器材质 ----------------
const CLIP_V = /* glsl */`
#include <common>
#include <clipping_planes_pars_vertex>
varying vec3 vN; varying vec3 vV; varying vec3 vW;
void main(){
  #include <beginnormal_vertex>
  #include <defaultnormal_vertex>
  #include <begin_vertex>
  #include <project_vertex>
  #include <clipping_planes_vertex>
  vN = normalize(transformedNormal);
  vV = normalize(-mvPosition.xyz);
  vW = (modelMatrix * vec4(transformed, 1.0)).xyz;
}`;

function ghostMaterial(color, planes) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uAlpha: { value: 1 } },
    vertexShader: CLIP_V,
    fragmentShader: /* glsl */`
      #include <common>
      #include <clipping_planes_pars_fragment>
      uniform vec3 uColor; uniform float uAlpha;
      varying vec3 vN; varying vec3 vV; varying vec3 vW;
      void main(){
        #include <clipping_planes_fragment>
        float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
        float rim = pow(f, 2.2);
        float a = (0.035 + rim * 0.55) * uAlpha;
        gl_FragColor = vec4(uColor * (0.35 + rim * 1.6), a);
      }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, clipping: true,
    clippingPlanes: planes,
  });
}

function capMaterial(planes) {
  return new THREE.ShaderMaterial({
    uniforms: { cA: { value: new THREE.Color('#c23b22') }, cB: { value: new THREE.Color('#7a1d10') } },
    vertexShader: CLIP_V,
    fragmentShader: /* glsl */`
      #include <common>
      #include <clipping_planes_pars_fragment>
      uniform vec3 cA; uniform vec3 cB;
      varying vec3 vN; varying vec3 vV; varying vec3 vW;
      void main(){
        #include <clipping_planes_fragment>
        float h = step(0.62, fract((gl_FragCoord.x + gl_FragCoord.y) / 7.0));
        gl_FragColor = vec4(mix(cA, cB, h), 1.0);
      }`,
    side: THREE.BackSide, clipping: true, clippingPlanes: planes,
  });
}

function blueprintMaterial(planes) {
  return new THREE.ShaderMaterial({
    uniforms: { cFill: { value: new THREE.Color('#0c2d52') }, cLine: { value: new THREE.Color('#bfe3ff') } },
    vertexShader: CLIP_V,
    fragmentShader: /* glsl */`
      #include <common>
      #include <clipping_planes_pars_fragment>
      uniform vec3 cFill; uniform vec3 cLine;
      varying vec3 vN; varying vec3 vV; varying vec3 vW;
      void main(){
        #include <clipping_planes_fragment>
        float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
        float line = smoothstep(0.80, 0.93, f);
        gl_FragColor = vec4(mix(cFill, cLine * 0.9, line), 1.0);
      }`,
    clipping: true, clippingPlanes: planes, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
  });
}

function gasMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color('#3aa0ff') }, uI: { value: 1 }, uA: { value: 0.5 }, uT: { value: 0 },
      uFlame: { value: 0 },
    },
    vertexShader: /* glsl */`
      varying vec3 vN; varying vec3 vV; varying vec3 vL;
      void main(){
        vL = position;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor; uniform float uI; uniform float uA; uniform float uT; uniform float uFlame;
      varying vec3 vN; varying vec3 vV; varying vec3 vL;
      float hash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      float noise(vec3 x){ vec3 i = floor(x); vec3 f = fract(x); f = f*f*(3.0-2.0*f);
        return mix(mix(mix(hash(i), hash(i+vec3(1,0,0)), f.x), mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), f.x), f.y),
                   mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), f.x), mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), f.x), f.y), f.z); }
      void main(){
        float f = abs(dot(normalize(vN), normalize(vV)));
        float n = noise(vL * vec3(7.0, 3.0, 7.0) + vec3(0.0, -uT * 1.7, uT * 0.6));
        // 火焰前锋：以顶部火花塞为中心向外扩张的亮环
        float rr = length(vec2(vL.x, vL.z)) * 2.0 + (0.5 - vL.y) * 0.6;
        float front = smoothstep(0.2, 0.0, abs(rr - uFlame * 1.3)) * step(0.001, uFlame) * step(uFlame, 0.999);
        vec3 col = uColor * uI * (0.7 + 0.6 * n) + vec3(1.0, 0.8, 0.45) * front * 3.0;
        float a = uA * (0.55 + 0.45 * (1.0 - f)) + front * 0.5;
        gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
      }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  });
}

function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.15, 'rgba(255,240,210,0.9)');
  g.addColorStop(0.4, 'rgba(255,170,80,0.35)'); g.addColorStop(1, 'rgba(255,120,40,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ---------------- 主构建函数 ----------------
export function createEngine(scene) {
  const root = new THREE.Group(); root.name = 'engine';
  scene.add(root);
  const cyls = cylinderLayout();

  // 裁剪平面：扫描转场 + 剖切
  const sweepSolid = new THREE.Plane(new V3(1, 0, 0), 100);
  const sweepLine = new THREE.Plane(new V3(-1, 0, 0), -100);
  const s2 = Math.SQRT1_2;
  const secPlanes = {
    odd: new THREE.Plane(new V3(s2, -s2, 0), 100),
    even: new THREE.Plane(new V3(-s2, -s2, 0), 100),
    case: new THREE.Plane(new V3(0, -1, 0), 100),
  };

  // ---- 材质 ----
  const P = [sweepSolid];
  const std = (o) => new THREE.MeshStandardMaterial({ clippingPlanes: P, ...o });
  const M = {
    steel: std({ color: '#b3b9c1', metalness: 1, roughness: 0.3 }),
    forged: std({ color: '#9aa1aa', metalness: 1, roughness: 0.38 }),
    rod: std({ color: '#b5bcc6', metalness: 1, roughness: 0.3 }),
    piston: std({ color: '#b4bac2', metalness: 0.8, roughness: 0.4 }),
    ring: std({ color: '#3b3f46', metalness: 0.9, roughness: 0.4 }),
    valveIn: std({ color: '#c4cbd6', metalness: 1, roughness: 0.3 }),
    valveEx: std({ color: '#b89e7e', metalness: 1, roughness: 0.3 }),
    springIn: std({ color: '#3f7fe0', metalness: 0.6, roughness: 0.35 }),
    springEx: std({ color: '#e0673f', metalness: 0.6, roughness: 0.35 }),
    bucket: std({ color: '#8c939c', metalness: 1, roughness: 0.3 }),
    cam: std({ color: '#a2a8b0', metalness: 1, roughness: 0.34 }),
    sprocket: std({ color: '#5a616b', metalness: 1, roughness: 0.52 }),
    chain: std({ color: '#50555d', metalness: 1, roughness: 0.4 }),
    plug: std({ color: '#c9ced4', metalness: 1, roughness: 0.3 }),
    ceramic: std({ color: '#f1efe9', metalness: 0, roughness: 0.35 }),
    coil: std({ color: '#1b1e23', metalness: 0.2, roughness: 0.55 }),
    coilAccent: std({ color: '#ff5a2a', metalness: 0.3, roughness: 0.4, emissive: '#ff3a10', emissiveIntensity: 0.25 }),
    pulley: std({ color: '#2a2e35', metalness: 0.8, roughness: 0.45 }),
    flywheel: std({ color: '#7d848d', metalness: 1, roughness: 0.4 }),
    intake: std({ color: '#262a31', metalness: 0.3, roughness: 0.5 }),
    intakeAccent: std({ color: '#9aa3ad', metalness: 1, roughness: 0.25 }),
    cover: std({ color: '#23272e', metalness: 0.75, roughness: 0.38 }),
    pan: std({ color: '#3a3f47', metalness: 0.8, roughness: 0.45 }),
    frontCover: std({ color: '#79828c', metalness: 0.65, roughness: 0.52 }),
  };
  const alu = (plane) => std({ color: '#8d959f', metalness: 0.55, roughness: 0.5, clippingPlanes: [sweepSolid, plane] });
  const SHELL = {
    odd: alu(secPlanes.odd), even: alu(secPlanes.even), case: alu(secPlanes.case),
  };
  const CAP = { odd: capMaterial([sweepSolid, secPlanes.odd]), even: capMaterial([sweepSolid, secPlanes.even]), case: capMaterial([sweepSolid, secPlanes.case]) };
  const GHOST = {
    shell: ghostMaterial('#7fb4ff', [sweepSolid]),
    warm: ghostMaterial('#ffb27a', [sweepSolid]),
    faint: ghostMaterial('#8fbfff', [sweepSolid]),
  };
  GHOST.faint.uniforms.uAlpha.value = 0.38;
  const BP = blueprintMaterial([sweepLine]);
  const BPLINE = new THREE.LineBasicMaterial({ color: '#d8efff', transparent: true, opacity: 0.85, clippingPlanes: [sweepLine] });

  const BPG = new THREE.ShaderMaterial({
    uniforms: { cLine: { value: new THREE.Color('#9fd2ff') } },
    vertexShader: CLIP_V,
    fragmentShader: /* glsl */`
      #include <common>
      #include <clipping_planes_pars_fragment>
      uniform vec3 cLine;
      varying vec3 vN; varying vec3 vV; varying vec3 vW;
      void main(){
        #include <clipping_planes_fragment>
        float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
        float line = smoothstep(0.86, 0.97, f);
        gl_FragColor = vec4(cLine, line * 0.55 + 0.025);
      }`,
    transparent: true, depthWrite: false, clipping: true, clippingPlanes: [sweepLine], side: THREE.DoubleSide,
  });
  const BPLINE_G = new THREE.LineBasicMaterial({ color: '#8cc6ff', transparent: true, opacity: 0.32, clippingPlanes: [sweepLine], depthWrite: false });

  // 部件分类（用于拾取、高亮与说明）；每个部件使用独立材质副本，便于高亮/虚化
  const parts = {};
  const allMeshes = [];
  const shellMeshes = [];   // { mesh, key, kind }
  const headerMats = [];
  const matCache = new Map();
  function partMat(mat, part) {
    if (!mat.isMeshStandardMaterial || headerMats.includes(mat)) return mat;
    const k = mat.uuid + '|' + part;
    let m = matCache.get(k);
    if (!m) {
      m = mat.clone(); m.clippingPlanes = mat.clippingPlanes;
      m.userData.baseEmissive = mat.emissiveIntensity; m.userData.baseEmissiveColor = mat.emissive.clone();
      matCache.set(k, m);
    }
    return m;
  }
  function reg(mesh, part, opts = {}) {
    mesh.userData.part = part;
    const p = (parts[part] ||= { meshes: [], mats: new Set() });
    p.meshes.push(mesh);
    if (mesh.material.isMeshStandardMaterial) p.mats.add(mesh.material);
    allMeshes.push(mesh);
    if (opts.shell) shellMeshes.push({ mesh, ...opts.shell });
    if (opts.bp) mesh.userData.bp = opts.bp;
    return mesh;
  }
  function mk(geo, mat, part, parent, opts) {
    const m = new THREE.Mesh(geo, partMat(mat, part));
    parent.add(m);
    return reg(m, part, opts);
  }
  function shell(geo, key, part, parent, extra = {}) {
    const m = new THREE.Mesh(geo, partMat(SHELL[key], part));
    parent.add(m);
    const cap = new THREE.Mesh(geo, CAP[key]);
    cap.userData.noPick = true; cap.layers.set(1);
    m.add(cap);
    m.userData.cap = cap;
    return reg(m, part, {
      bp: extra.bp || (extra.sectionOnly ? 'none' : 'ghost'),
      shell: { key, kind: extra.kind || 'block', ghost: extra.ghost || 'shell', solidOnly: !!extra.solidOnly, sectionOnly: !!extra.sectionOnly },
    });
  }

  // ---------------- 缸列坐标系 ----------------
  const banks = {};
  for (const key of ['odd', 'even']) {
    const beta = key === 'odd' ? 45 : -45;
    const g = new THREE.Group();
    g.rotation.z = -beta * DEG;
    if (key === 'even') g.scale.x = -1;
    g.userData = { beta, key, sign: key === 'odd' ? -1 : 1 };
    root.add(g);
    banks[key] = g;
  }
  g_updateMatrices();
  function g_updateMatrices() { root.updateMatrixWorld(true); }
  const bankOf = (c) => (c.id % 2 === 1 ? 'odd' : 'even');
  const cylZpos = (c) => pinZ(c.pin) + (c.id % 2 === 1 ? G.stagger : -G.stagger);
  const toWorld = (bankKey, x, y, z) => banks[bankKey].localToWorld(new V3(x, y, z));
  const bankDir = (bankKey, x, y) => {
    const v = new V3(x, y, 0).applyMatrix3(new THREE.Matrix3().setFromMatrix4(banks[bankKey].matrixWorld));
    return v.normalize();
  };

  // =============== 曲轴 ===============
  const crank = new THREE.Group(); crank.name = 'crank'; root.add(crank);
  {
    const ws = new THREE.Shape();
    const a = G.pinR + 0.1, r = G.r, Rc = 0.78, a0 = 200 * DEG, a1 = 340 * DEG;
    ws.moveTo(a, r);
    ws.absarc(0, r, a, 0, Math.PI, false);
    ws.lineTo(Rc * Math.cos(a0), Rc * Math.sin(a0));
    ws.absarc(0, 0, Rc, a0, a1, false);
    ws.lineTo(a, r);
    const webGeo = extrudeZ(ws, G.webT, 0.025, 32);
    const pinGeo = cylZ(G.pinR, -G.pinLen / 2 - 0.02, G.pinLen / 2 + 0.02);
    for (let i = 0; i < 4; i++) {
      const phi = cyls[2 * i].pinAngle;
      const z = pinZ(i);
      for (const dz of [G.pinLen / 2 + G.webT / 2, -(G.pinLen / 2 + G.webT / 2)]) {
        const w = mk(webGeo, M.forged, 'crank', crank);
        w.rotation.z = -phi * DEG; w.position.z = z + dz;
      }
      const p = mk(pinGeo, M.steel, 'crank', crank);
      p.position.set(r * Math.sin(phi * DEG), r * Math.cos(phi * DEG), z);
    }
    const jEnd = G.pinLen / 2 + G.webT;
    const js = [2.39, ...[0, 1, 2].map((i) => (pinZ(i) + pinZ(i + 1)) / 2), -2.39];
    for (let k = 0; k < 5; k++) {
      let z0, z1;
      if (k === 0) { z0 = pinZ(0) + jEnd - 0.02; z1 = 2.39; }
      else if (k === 4) { z0 = -2.39; z1 = pinZ(3) - jEnd + 0.02; }
      else { z0 = pinZ(k) + jEnd - 0.02; z1 = pinZ(k - 1) - jEnd + 0.02; }
      mk(cylZ(G.mainR, z0, z1), M.steel, 'crank', crank);
    }
    // 前端：轴颈、链轮、减振皮带轮
    mk(cylZ(0.22, 2.39, 3.2), M.steel, 'crank', crank, { bp: 'ghost' });
    const crankSprocket = extrudeZ(gearShape(0.2, 20, 0.035, 0.05), 0.1, 0.008);
    for (const z of [G.chainZ.odd, G.chainZ.even]) { const s = mk(crankSprocket, M.sprocket, 'chain', crank, { bp: 'ghost' }); s.position.z = z; }
    const pul = new THREE.LatheGeometry([
      [0.18, 0], [0.56, 0], [0.56, 0.03], [0.52, 0.045], [0.56, 0.06], [0.52, 0.075], [0.56, 0.09], [0.52, 0.105],
      [0.56, 0.12], [0.52, 0.135], [0.56, 0.15], [0.56, 0.2], [0.42, 0.2], [0.4, 0.23], [0.24, 0.23], [0.22, 0.3], [0.1, 0.32], [0, 0.32],
    ].map(([x, y]) => new THREE.Vector2(x, y)), 64);
    pul.rotateX(Math.PI / 2); pul.translate(0, 0, 2.86);
    mk(pul, M.pulley, 'crank', crank, { bp: 'ghost' });
    const ring = mk(new THREE.TorusGeometry(0.44, 0.012, 8, 64), M.coilAccent, 'crank', crank, { bp: 'none' });
    ring.position.z = 3.19;
    // 后端：法兰 + 飞轮 + 齿圈
    mk(cylZ(0.46, -2.52, -2.39), M.steel, 'crank', crank);
    const fly = new THREE.LatheGeometry([[0.1, 0], [1.2, 0], [1.2, 0.05], [0.95, 0.05], [0.9, 0.09], [0.5, 0.09], [0.45, 0.12], [0.1, 0.12]].map(([x, y]) => new THREE.Vector2(x, y)), 72);
    fly.rotateX(-Math.PI / 2); fly.translate(0, 0, -2.52);
    mk(fly, M.flywheel, 'crank', crank);
    const rg = extrudeZ(gearShape(1.3, 120, 0.05, 1.16), 0.08, 0.005);
    const rgm = mk(rg, M.forged, 'crank', crank); rgm.position.z = -2.58;
    // 飞轮上的减重孔
    for (let i = 0; i < 6; i++) {
      const h = mk(cylZ(0.1, -2.66, -2.62, 20), M.pulley, 'crank', crank);
      const a2 = i / 6 * Math.PI * 2; h.position.set(0.75 * Math.cos(a2), 0.75 * Math.sin(a2), 0);
    }
  }

  // =============== 连杆 & 活塞 ===============
  const rodGeo = (() => {
    const Rb = G.pinR + 0.09, Rs = 0.16, wB = 0.17, wS = 0.085, L = G.rod;
    const yB = Math.sqrt(Rb * Rb - wB * wB), yS = Math.sqrt(Rs * Rs - wS * wS);
    const s = new THREE.Shape();
    s.moveTo(wB, yB);
    s.absarc(0, 0, Rb, Math.atan2(yB, wB), Math.PI - Math.atan2(yB, wB), true);
    s.lineTo(-wS, L - yS);
    s.absarc(0, L, Rs, Math.atan2(-yS, -wS), Math.atan2(-yS, wS), true);
    s.lineTo(wB, yB);
    s.holes.push(circlePath(0, 0, G.pinR + 0.005));
    s.holes.push(circlePath(0, L, 0.105));
    const body = extrudeZ(s, 0.19, 0.02, 32);
    // I 字梁：两侧加强筋
    const rib = new THREE.BoxGeometry(0.05, L - Rb - Rs + 0.1, 0.22);
    const r1 = rib.clone(); r1.translate(0.085, (Rb + L - Rs) / 2, 0);
    const r2 = rib.clone(); r2.translate(-0.085, (Rb + L - Rs) / 2, 0);
    // 连杆螺栓
    const bolt = new THREE.CylinderGeometry(0.035, 0.035, 0.2, 12);
    const b1 = bolt.clone(); b1.translate(0.3, -0.12, 0.0);
    const b2 = bolt.clone(); b2.translate(-0.3, -0.12, 0.0);
    const ni = (g) => (g.index ? g.toNonIndexed() : g);
    return mergeGeometries([ni(body), ni(r1), ni(r2), ni(b1), ni(b2)].map((g) => { g.deleteAttribute('uv'); return g; }));
  })();
  rodGeo.computeVertexNormals();

  const pistonGeo = (() => {
    const R = G.bore / 2 - 0.006, h = G.compH;
    const pts = [
      [0, h - 0.02], [0.2, h - 0.03], [0.3, h - 0.005], [R - 0.02, h], [R, h - 0.02],
      [R, h - 0.045], [R - 0.022, h - 0.045], [R - 0.022, h - 0.06], [R, h - 0.06],
      [R, h - 0.085], [R - 0.022, h - 0.085], [R - 0.022, h - 0.1], [R, h - 0.1],
      [R, h - 0.125], [R - 0.024, h - 0.125], [R - 0.024, h - 0.15], [R, h - 0.15],
      [R, h - 0.2], [R - 0.008, h - 0.22], [R - 0.008, -0.2], [R - 0.05, -0.21], [R - 0.05, 0.12], [0, 0.12],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    return new THREE.LatheGeometry(pts, 56);
  })();
  const ringGeo = (() => {
    const R = G.bore / 2 - 0.004;
    const gs = [];
    for (const y of [0.0525, 0.0925, 0.1375]) {
      const g = new THREE.TorusGeometry(R - 0.012, 0.009, 6, 56);
      g.rotateX(Math.PI / 2); g.translate(0, G.compH - y, 0); gs.push(g);
    }
    return mergeGeometries(gs);
  })();
  const wristGeo = (() => { const g = new THREE.CylinderGeometry(0.1, 0.1, 0.78, 24); g.rotateX(Math.PI / 2); return g; })();

  const rods = [], pistons = [];
  for (const c of cyls) {
    const rod = mk(rodGeo, M.rod, 'rod', root);
    rod.position.z = cylZpos(c);
    rods.push(rod);
    const bk = banks[bankOf(c)];
    const pg = new THREE.Group(); bk.add(pg);
    pg.position.z = cylZpos(c);
    mk(pistonGeo, M.piston, 'piston', pg);
    mk(ringGeo, M.ring, 'piston', pg);
    mk(wristGeo, M.steel, 'piston', pg);
    pistons.push(pg);
  }

  // =============== 缸体（缸列 + 曲轴箱 + 主轴承隔板 + 油底壳） ===============
  const blockGroup = new THREE.Group(); root.add(blockGroup);
  for (const key of ['odd', 'even']) {
    const zs = cyls.filter((c) => bankOf(c) === key).map(cylZpos);
    const s = rectShapeXZ(-G.wo, G.wo, G.zRear, G.zFront, 0.05);
    for (const z of zs) s.holes.push(circlePath(0, -z, G.bore / 2));
    // 缸盖螺栓孔
    for (const z of [...zs.map((z) => z + 0.55), zs[zs.length - 1] - 0.55]) for (const x of [-0.53, 0.53]) {
      if (Math.abs(z) < 2.3) s.holes.push(circlePath(x, -z, 0.045));
    }
    const geo = extrudeY(s, G.D, G.deck, 0.015);
    shell(geo, key, 'block', banks[key]);
    // 缸盖（完整，用于外观/透视）
    const hs = rectShapeXZ(-G.headW, G.headW, G.zRear, G.zFront, 0.08);
    shell(extrudeY(hs, G.deck, G.headTop, 0.03), key, 'head', banks[key], { solidOnly: true });
    // 缸盖（骨架，用于剖切）：燃烧室板 + 凸轮轴承座
    const deckS = rectShapeXZ(-G.headW, G.headW, G.zRear, G.zFront, 0.08);
    for (const z of zs) deckS.holes.push(circlePath(0, -z, G.bore / 2));
    shell(extrudeY(deckS, G.deck, G.deck + 0.17, 0.015), key, 'head', banks[key], { sectionOnly: true });
    const towerZ = [zs[0] + 0.55, ...zs.slice(0, 3).map((z, i) => (z + zs[i + 1]) / 2), zs[3] - 0.55];
    for (const cam of [G.camIn, G.camEx]) {
      const ts = new THREE.Shape();
      const x0 = cam.x - 0.2, x1 = cam.x + 0.2, y0 = G.deck + 0.16, y1 = cam.y + 0.19;
      ts.moveTo(x0, y0); ts.lineTo(x1, y0); ts.lineTo(x1, y1); ts.lineTo(x0, y1); ts.closePath();
      ts.holes.push(circlePath(cam.x, cam.y, 0.142));
      const tg = extrudeZ(ts, 0.14, 0.012);
      for (const z of towerZ) {
        const t = shell(tg, key, 'head', banks[key], { sectionOnly: true });
        t.position.z = z;
      }
    }
    // 外侧壁（排气侧）
    const wall = new THREE.BoxGeometry(0.1, G.headTop - G.deck - 0.17, G.zFront - G.zRear);
    wall.translate(G.headW - 0.05, (G.headTop + G.deck + 0.17) / 2, 0);
    shell(wall, key, 'head', banks[key], { sectionOnly: true });
    // 气门室盖（凸轮罩）
    const cs = new THREE.Shape();
    const hx = G.headW - 0.02, cy0 = G.headTop, cyTop = G.coverTop;
    cs.moveTo(-hx, cy0);
    cs.lineTo(-hx, cy0 + 0.2);
    cs.quadraticCurveTo(-hx, cyTop, G.camIn.x, cyTop);
    cs.quadraticCurveTo(0, cyTop, 0, cyTop - 0.12);
    cs.quadraticCurveTo(0, cyTop, G.camEx.x, cyTop);
    cs.quadraticCurveTo(hx, cyTop, hx, cy0 + 0.2);
    cs.lineTo(hx, cy0); cs.closePath();
    const cg = extrudeZ(cs, G.zFront - G.zRear - 0.12, 0.04);
    const cover = mk(cg, M.cover, 'head', banks[key], { bp: 'ghost' });
    cover.userData.solidOnly = true;
    shellMeshes.push({ mesh: cover, key, kind: 'cover', ghost: 'shell', solidOnly: true });
    // 罩盖上的加强筋装饰
    for (const x of [G.camIn.x, G.camEx.x]) {
      const rib = mk(new THREE.BoxGeometry(0.035, 0.03, G.zFront - G.zRear - 0.4), M.intakeAccent, 'head', banks[key], { bp: 'none' });
      rib.position.set(x, cyTop + 0.005, 0);
      shellMeshes.push({ mesh: rib, key, kind: 'cover', ghost: 'shell', solidOnly: true });
    }
  }

  // 曲轴箱截面（前视轮廓，沿 z 拉伸）
  {
    const s = Math.SQRT1_2;
    const uR = new THREE.Vector2(s, s), uL = new THREE.Vector2(-s, s);
    const nRo = new THREE.Vector2(s, -s), nLo = new THREE.Vector2(-s, -s);   // 外侧法向
    const nRi = new THREE.Vector2(-s, s), nLi = new THREE.Vector2(s, s);     // 谷侧法向
    const pt = (u, t, n, w) => new THREE.Vector2(u.x * t + n.x * w, u.y * t + n.y * w);
    const D = G.D + 0.02, wo = G.wo, wh = G.wh, Ro = G.Ro, Rh = G.Rh;
    const to = Math.sqrt(Ro * Ro - wo * wo), th = Math.sqrt(Rh * Rh - wh * wh);
    // U 形外壳
    const U = new THREE.Shape();
    const a = pt(uR, D, nRo, wo); U.moveTo(a.x, a.y);
    const b = pt(uR, to, nRo, wo); U.lineTo(b.x, b.y);
    const c = pt(uL, to, nLo, wo);
    U.absarc(0, 0, Ro, Math.atan2(b.y, b.x), Math.atan2(c.y, c.x) - Math.PI * 2, true);
    const d = pt(uL, D, nLo, wo); U.lineTo(d.x, d.y);
    const e = pt(uL, D, nLo, wh); U.lineTo(e.x, e.y);
    const f = pt(uL, th, nLo, wh); U.lineTo(f.x, f.y);
    const gq = pt(uR, th, nRo, wh);
    U.absarc(0, 0, Rh, Math.atan2(f.y, f.x), Math.atan2(gq.y, gq.x) + Math.PI * 2, false);
    const h = pt(uR, D, nRo, wh); U.lineTo(h.x, h.y); U.closePath();
    const len = G.zFront - G.zRear;
    shell(extrudeZ(U, len, 0.02, 64), 'case', 'block', blockGroup);
    // 谷底 V 形隔板
    const Vs = new THREE.Shape();
    const v1 = pt(uR, D, nRi, wh); Vs.moveTo(v1.x, v1.y);
    Vs.lineTo(0, 2 * wh * s);
    const v2 = pt(uL, D, nLi, wh); Vs.lineTo(v2.x, v2.y);
    const v3 = pt(uL, D, nLi, wo); Vs.lineTo(v3.x, v3.y);
    Vs.lineTo(0, 2 * wo * s);
    const v4 = pt(uR, D, nRi, wo); Vs.lineTo(v4.x, v4.y); Vs.closePath();
    shell(extrudeZ(Vs, len, 0.01), 'case', 'block', blockGroup);
    // 主轴承隔板（下半）
    const bh = new THREE.Shape();
    const yCut = 0.22, ang = Math.asin(yCut / Ro);
    bh.moveTo(Ro * Math.cos(ang), yCut);
    bh.absarc(0, 0, Ro - 0.01, ang, Math.PI - ang - Math.PI * 2, true);
    bh.lineTo(Ro * Math.cos(ang), yCut);
    bh.holes.push(circlePath(0, 0, G.mainR + 0.015));
    const bg = extrudeZ(bh, 0.16, 0.01, 48);
    for (const z of [2.2, ...[0, 1, 2].map((i) => (pinZ(i) + pinZ(i + 1)) / 2), -2.2]) {
      const m = shell(bg, 'case', 'block', blockGroup, { bp: 'none' }); m.position.z = z;
    }
    // 主轴承盖螺栓
    for (const z of [2.2, 1.1, 0, -1.1, -2.2]) for (const x of [-0.5, 0.5]) {
      const bolt = mk(new THREE.CylinderGeometry(0.05, 0.05, 0.12, 12), M.forged, 'block', blockGroup);
      bolt.position.set(x, -0.62, z);
    }
    // 油底壳
    const pan = new THREE.Shape();
    pan.moveTo(-1.05, -0.62); pan.lineTo(1.05, -0.62); pan.lineTo(1.0, -1.05);
    pan.quadraticCurveTo(0.95, -1.62, 0.6, -1.66); pan.lineTo(-0.6, -1.66);
    pan.quadraticCurveTo(-0.95, -1.62, -1.0, -1.05); pan.closePath();
    const pm = shell(extrudeZ(pan, len - 0.1, 0.05), 'case', 'block', blockGroup);
    pm.userData.pan = true;
    // 正时罩盖（仅外观）：按链轮包络求凸包
    const pts = [];
    const ring = (cx, cy, r) => { for (let i = 0; i < 48; i++) { const a = i / 48 * Math.PI * 2; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } };
    ring(0, 0, 0.42); ring(0, -0.35, 0.3);
    for (const bk of ['odd', 'even']) for (const cam of [G.camIn, G.camEx]) { const w = toWorld(bk, cam.x, cam.y, 0); ring(w.x, w.y, 0.58); }
    pts.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
    const cross = (o, a2, b2) => (a2[0] - o[0]) * (b2[1] - o[1]) - (a2[1] - o[1]) * (b2[0] - o[0]);
    const lower = [], upper = [];
    for (const p2 of pts) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p2) <= 0) lower.pop(); lower.push(p2); }
    for (const p2 of pts.slice().reverse()) { while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p2) <= 0) upper.pop(); upper.push(p2); }
    const hull = lower.slice(0, -1).concat(upper.slice(0, -1));
    const fc = new THREE.Shape();
    hull.forEach(([x, y], i) => (i ? fc.lineTo(x, y) : fc.moveTo(x, y)));
    fc.closePath();
    fc.holes.push(circlePath(0, 0, 0.25));
    const fcm = mk(extrudeZ(fc, 0.4, 0.05), M.frontCover, 'block', blockGroup, { bp: 'none' });
    fcm.position.z = G.zFront + 0.22;
    shellMeshes.push({ mesh: fcm, key: 'case', kind: 'frontcover', ghost: 'shell', solidOnly: true });
    // 罩盖周边螺栓
    const boltG = new THREE.CylinderGeometry(0.05, 0.05, 0.06, 6); boltG.rotateX(Math.PI / 2);
    let acc = 0;
    for (let i = 0; i < hull.length; i++) {
      const p0 = hull[i], p1 = hull[(i + 1) % hull.length];
      const L = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
      acc += L;
      if (acc < 0.55) continue;
      acc = 0;
      const cx = hull.reduce((s2, q) => s2 + q[0], 0) / hull.length, cy = hull.reduce((s2, q) => s2 + q[1], 0) / hull.length;
      const dx = p0[0] - cx, dy = p0[1] - cy, dl = Math.hypot(dx, dy);
      const bm = mk(boltG, M.forged, 'block', blockGroup, { bp: 'none' });
      bm.position.set(p0[0] - dx / dl * 0.13, p0[1] - dy / dl * 0.13, G.zFront + 0.44);
      shellMeshes.push({ mesh: bm, key: 'case', kind: 'frontcover', ghost: 'shell', solidOnly: true, keepMat: true });
    }
  }

  // =============== 配气机构 ===============
  const valves = [];   // {c, type, grp, valve, spring, retainer, bucket}
  const cams = [];     // {bank, type, shaft}
  const valveGeo = (() => {
    const mk2 = (Rv) => new THREE.LatheGeometry([
      [0, 0.005], [Rv - 0.01, 0], [Rv, 0.012], [Rv, 0.022], [Rv * 0.78, 0.045], [Rv * 0.45, 0.085], [0.07, 0.14],
      [0.036, 0.21], [0.036, G.valveLen - 0.06], [0.03, G.valveLen - 0.05], [0.03, G.valveLen - 0.02], [0.036, G.valveLen - 0.01], [0.03, G.valveLen], [0, G.valveLen],
    ].map(([x, y]) => new THREE.Vector2(x, y)), 36);
    return { in: mk2(0.178), ex: mk2(0.152) };
  })();
  const springL = 0.34, springY0 = 0.5;
  const springGeo = (() => {
    class Helix extends THREE.Curve {
      getPoint(t, o = new V3()) {
        const turns = 6.5, a = t * turns * Math.PI * 2;
        const R = 0.105 - 0.012 * Math.sin(t * Math.PI);
        return o.set(R * Math.cos(a), t * springL, R * Math.sin(a));
      }
    }
    return new THREE.TubeGeometry(new Helix(), 220, 0.017, 6, false);
  })();
  const retainerGeo = new THREE.CylinderGeometry(0.12, 0.07, 0.04, 28);
  const bucketGeo = new THREE.CylinderGeometry(0.145, 0.145, G.bucketH, 32);
  const guideGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.28, 16);

  for (const c of cyls) {
    const bk = bankOf(c), grp = banks[bk], zc = cylZpos(c);
    for (const type of ['in', 'ex']) {
      for (const dz of [-G.valveZ, G.valveZ]) {
        const vg = new THREE.Group(); grp.add(vg);
        const x = type === 'in' ? -G.valveX : G.valveX;
        vg.position.set(x, G.seatY, zc + dz);
        vg.rotation.z = type === 'in' ? G.tilt : -G.tilt;
        const valve = mk(valveGeo[type], type === 'in' ? M.valveIn : M.valveEx, 'valvetrain', vg);
        const spring = mk(springGeo, type === 'in' ? M.springIn : M.springEx, 'valvetrain', vg);
        spring.position.y = springY0;
        const guide = mk(guideGeo, M.bucket, 'valvetrain', vg); guide.position.y = springY0 - 0.1;
        const retainer = mk(retainerGeo, M.bucket, 'valvetrain', vg);
        const bucket = mk(bucketGeo, M.bucket, 'valvetrain', vg);
        valves.push({ c, type, grp: vg, valve, spring, retainer, bucket });
      }
    }
  }

  // 凸轮：按升程曲线生成真实凸轮型线（极坐标：基圆 + 升程）
  const ev0 = valveEvents(0);
  function lobeGeo(type) {
    const open = type === 'in' ? ev0.IVO : ev0.EVO, close = type === 'in' ? ev0.IVC : ev0.EVC;
    const dur = wrap720(close - open);
    const maxL = (type === 'in' ? MAX_LIFT.intake : MAX_LIFT.exhaust) * 10;
    const s = new THREE.Shape();
    const N = 180;
    for (let i = 0; i <= N; i++) {
      const phi = (i / N) * Math.PI * 2 - Math.PI;       // 相对凸尖角
      const t = (2 * phi / DEG + dur / 2) / dur;         // 凸轮 1° = 曲轴 2°
      const rr = G.Rb + maxL * liftShape(t);
      const x = rr * Math.sin(phi), y = -rr * Math.cos(phi);
      if (i === 0) s.moveTo(x, y); else s.lineTo(x, y);
    }
    return extrudeZ(s, 0.15, 0.01, 12);
  }
  const lobeGeos = { in: lobeGeo('in'), ex: lobeGeo('ex') };
  const camSprocketGeo = extrudeZ(gearShape(0.4, 40, 0.035, 0.08), 0.1, 0.008);
  const phaserGeo = cylZ(0.24, -0.09, 0.09, 40);
  for (const bk of ['odd', 'even']) {
    const grp = banks[bk];
    const bcyls = cyls.filter((c) => bankOf(c) === bk);
    for (const type of ['in', 'ex']) {
      const pos = type === 'in' ? G.camIn : G.camEx;
      const cg = new THREE.Group(); grp.add(cg);
      cg.position.set(pos.x, pos.y, 0);
      cg.rotation.z = type === 'in' ? G.tilt : -G.tilt;
      const shaft = new THREE.Group(); cg.add(shaft);
      const zF = G.chainZ[bk];
      mk(cylZ(0.1, G.zRear + 0.12, zF, 24), M.cam, 'cam', shaft);
      const zs = bcyls.map(cylZpos);
      const towerZ = [zs[0] + 0.55, ...zs.slice(0, 3).map((z, i) => (z + zs[i + 1]) / 2), zs[3] - 0.55];
      for (const z of towerZ) mk(cylZ(0.135, z - 0.08, z + 0.08, 28), M.cam, 'cam', shaft);
      const cen = type === 'in' ? (ev0.IVO + ev0.IVC) / 2 : (ev0.EVO + ev0.EVC) / 2;
      const s = grp.userData.sign;
      for (const c of bcyls) for (const dz of [-G.valveZ, G.valveZ]) {
        const lobe = mk(lobeGeos[type], M.cam, 'cam', shaft);
        lobe.position.z = cylZpos(c) + dz;
        lobe.rotation.z = s * (-c.phase - cen) / 2 * DEG;
      }
      const sp = mk(camSprocketGeo, M.sprocket, 'chain', shaft, { bp: 'ghost' }); sp.position.z = zF;
      if (type === 'in') {
        const ph = mk(phaserGeo, M.intakeAccent, 'cam', shaft, { bp: 'ghost' }); ph.position.z = zF + 0.16;
      } else {
        mk(cylZ(0.16, zF + 0.05, zF + 0.12, 24), M.forged, 'cam', shaft, { bp: 'ghost' });
      }
      cams.push({ bank: bk, type, shaft, sign: s });
    }
  }

  // =============== 正时链 ===============
  root.updateMatrixWorld(true);
  const chains = [];
  function beltPath(circles) {
    // circles: [{c: Vector2, r}] 按逆时针排序，链条走外侧
    const n = circles.length;
    const segs = [];
    const tangents = [];
    for (let i = 0; i < n; i++) {
      const A = circles[i], B = circles[(i + 1) % n];
      const d = B.c.clone().sub(A.c); const L = d.length(); const phi = Math.atan2(d.y, d.x);
      const na = phi - Math.acos((A.r - B.r) / L);
      const nv = new THREE.Vector2(Math.cos(na), Math.sin(na));
      tangents.push({ p1: A.c.clone().addScaledVector(nv, A.r), p2: B.c.clone().addScaledVector(nv, B.r), ang: na });
    }
    for (let i = 0; i < n; i++) {
      const t = tangents[i], next = tangents[(i + 1) % n], C = circles[(i + 1) % n];
      segs.push({ type: 'line', a: t.p1, b: t.p2, len: t.p1.distanceTo(t.p2) });
      let a0 = t.ang, a1 = next.ang;
      while (a1 < a0) a1 += Math.PI * 2;
      segs.push({ type: 'arc', c: C.c, r: C.r, a0, a1, len: (a1 - a0) * C.r });
    }
    const total = segs.reduce((s, g) => s + g.len, 0);
    return {
      total, at(s) {
        s = ((s % total) + total) % total;
        for (const g of segs) {
          if (s <= g.len) {
            if (g.type === 'line') {
              const t = s / g.len;
              return { p: g.a.clone().lerp(g.b, t), ang: Math.atan2(g.b.y - g.a.y, g.b.x - g.a.x) };
            }
            const a = g.a0 + s / g.r;
            return { p: new THREE.Vector2(g.c.x + g.r * Math.cos(a), g.c.y + g.r * Math.sin(a)), ang: a + Math.PI / 2 };
          }
          s -= g.len;
        }
        return { p: segs[0].a.clone(), ang: 0 };
      },
    };
  }
  for (const bk of ['odd', 'even']) {
    const z = G.chainZ[bk];
    const ci = toWorld(bk, G.camIn.x, G.camIn.y, 0), ce = toWorld(bk, G.camEx.x, G.camEx.y, 0);
    let circles = [
      { c: new THREE.Vector2(0, 0), r: 0.2 + 0.02 },
      { c: new THREE.Vector2(ci.x, ci.y), r: 0.4 + 0.02 },
      { c: new THREE.Vector2(ce.x, ce.y), r: 0.4 + 0.02 },
    ];
    const cx = (circles[0].c.x + circles[1].c.x + circles[2].c.x) / 3, cy = (circles[0].c.y + circles[1].c.y + circles[2].c.y) / 3;
    circles.sort((A, B) => Math.atan2(A.c.y - cy, A.c.x - cx) - Math.atan2(B.c.y - cy, B.c.x - cx));
    const path = beltPath(circles);
    const pitch = 0.07;
    const count = Math.floor(path.total / pitch);
    const linkGeo = new THREE.BoxGeometry(pitch * 0.92, 0.04, 0.085);
    const inst = new THREE.InstancedMesh(linkGeo, partMat(M.chain, 'chain'), count);
    inst.userData.part = 'chain';
    root.add(inst); allMeshes.push(inst);
    const pc = (parts.chain ||= { meshes: [], mats: new Set() }); pc.meshes.push(inst); pc.mats.add(inst.material);
    inst.frustumCulled = false;
    chains.push({ inst, path, count, pitch: path.total / count, z });
  }

  // =============== 前端附件：水泵、发电机、张紧轮、多楔带 ===============
  const accessories = [];
  {
    const accZ = 2.96;
    const grooved = (r, w) => {
      const pts2 = [[0.05, -w / 2], [r + 0.03, -w / 2], [r + 0.03, -w / 2 + 0.02]];
      const n = 6;
      for (let i = 0; i <= n; i++) pts2.push([i % 2 ? r - 0.015 : r, -w / 2 + 0.03 + (w - 0.06) * i / n]);
      pts2.push([r + 0.03, w / 2 - 0.02], [r + 0.03, w / 2], [0.12, w / 2], [0.1, w / 2 + 0.04], [0.05, w / 2 + 0.04]);
      const g = new THREE.LatheGeometry(pts2.map(([x, y]) => new THREE.Vector2(x, y)), 48);
      g.rotateX(Math.PI / 2); return g;
    };
    const defs = [
      { c: new THREE.Vector2(0.9, 1.95), r: 0.36, name: 'wp' },
      { c: new THREE.Vector2(-1.05, 3.05), r: 0.2, name: 'alt' },
      { c: new THREE.Vector2(-0.95, 1.2), r: 0.2, name: 'idler' },
    ];
    for (const d of defs) {
      const pul = mk(grooved(d.r, 0.2), d.name === 'wp' ? M.pulley : M.forged, 'accessory', root, { bp: 'none' });
      pul.position.set(d.c.x, d.c.y, accZ);
      accessories.push({ mesh: pul, ratio: 0.56 / d.r });
      shellMeshes.push({ mesh: pul, key: 'case', kind: 'acc', ghost: 'shell', solidOnly: true, keepMat: true });
    }
    // 水泵壳体
    const wpBody = mk(new THREE.CylinderGeometry(0.26, 0.34, 0.5, 32), M.frontCover, 'accessory', root, { bp: 'none' });
    wpBody.geometry.rotateX(Math.PI / 2); wpBody.position.set(0.9, 1.95, 2.62);
    shellMeshes.push({ mesh: wpBody, key: 'case', kind: 'acc', ghost: 'shell', solidOnly: true });
    // 发电机：带散热鳍片的壳体
    const alt = new THREE.Group(); alt.position.set(-1.05, 3.05, 0); root.add(alt);
    const altBody = mk(cylZ(0.46, 2.3, 2.84, 40), M.frontCover, 'accessory', alt, { bp: 'none' });
    const altCap = mk(cylZ(0.4, 2.84, 2.9, 40), M.pulley, 'accessory', alt, { bp: 'none' });
    shellMeshes.push({ mesh: altBody, key: 'case', kind: 'acc', ghost: 'shell', solidOnly: true });
    shellMeshes.push({ mesh: altCap, key: 'case', kind: 'acc', ghost: 'shell', solidOnly: true });
    for (let i = 0; i < 14; i++) {
      const fin = mk(new THREE.BoxGeometry(0.07, 0.03, 0.46), M.pulley, 'accessory', alt, { bp: 'none' });
      const a2 = i / 14 * Math.PI * 2; fin.position.set(Math.cos(a2) * 0.465, Math.sin(a2) * 0.465, 2.57); fin.rotation.z = a2;
      shellMeshes.push({ mesh: fin, key: 'case', kind: 'acc', ghost: 'shell', solidOnly: true });
    }
    // 皮带
    const circles = [{ c: new THREE.Vector2(0, 0), r: 0.565 }, ...defs.map((d) => ({ c: d.c, r: d.r + 0.035 }))];
    const cx = circles.reduce((s2, c) => s2 + c.c.x, 0) / circles.length, cy = circles.reduce((s2, c) => s2 + c.c.y, 0) / circles.length;
    circles.sort((A, B) => Math.atan2(A.c.y - cy, A.c.x - cx) - Math.atan2(B.c.y - cy, B.c.x - cx));
    const path = beltPath(circles);
    const N = 360, pos = [], nor = [], idx = [];
    const bw = 0.17;
    for (let i = 0; i <= N; i++) {
      const r = path.at(i / N * path.total);
      const nx = Math.sin(r.ang), ny = -Math.cos(r.ang);
      pos.push(r.p.x, r.p.y, accZ - bw / 2, r.p.x, r.p.y, accZ + bw / 2);
      nor.push(nx, ny, 0, nx, ny, 0);
      if (i < N) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    bg.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    bg.setIndex(idx);
    const beltMat = std({ color: '#15171b', metalness: 0.1, roughness: 0.8, side: THREE.DoubleSide });
    const belt = mk(bg, beltMat, 'accessory', root, { bp: 'none' });
    shellMeshes.push({ mesh: belt, key: 'case', kind: 'acc', ghost: 'shell', solidOnly: true, keepMat: true });
  }

  // =============== 火花塞 & 点火线圈 ===============
  const plugGeo = new THREE.LatheGeometry([
    [0, -0.03], [0.012, -0.03], [0.012, 0.0], [0.05, 0.0], [0.062, 0.02], [0.062, 0.2], [0.075, 0.21], [0.075, 0.23], [0, 0.23],
  ].map(([x, y]) => new THREE.Vector2(x, y)), 24);
  const hexGeo = (() => { const g = new THREE.CylinderGeometry(0.1, 0.1, 0.1, 6); g.translate(0, 0.28, 0); return g; })();
  const insGeo = (() => { const g = new THREE.LatheGeometry([[0, 0.33], [0.065, 0.33], [0.055, 0.5], [0.05, 1.05], [0.03, 1.1], [0, 1.1]].map(([x, y]) => new THREE.Vector2(x, y)), 24); return g; })();
  const coilGeo = new THREE.CylinderGeometry(0.1, 0.09, 0.62, 20);
  const coilHeadGeo = new THREE.BoxGeometry(0.34, 0.16, 0.22);
  const glowTex = glowTexture();
  const sparks = [];
  const plugGroups = [];
  for (const c of cyls) {
    const bk = bankOf(c), zc = cylZpos(c);
    const g = new THREE.Group(); banks[bk].add(g);
    g.position.set(0, G.seatY - 0.02, zc);
    mk(plugGeo, M.plug, 'ignition', g);
    mk(hexGeo, M.plug, 'ignition', g);
    mk(insGeo, M.ceramic, 'ignition', g);
    const coil = mk(coilGeo, M.coil, 'ignition', g); coil.position.y = G.coverTop - G.seatY - 0.1;
    const head = mk(coilHeadGeo, M.coil, 'ignition', g); head.position.set(0.05, G.coverTop - G.seatY + 0.26, 0);
    const acc = mk(new THREE.BoxGeometry(0.12, 0.06, 0.23), M.coilAccent, 'ignition', g); acc.position.set(0.16, G.coverTop - G.seatY + 0.26, 0);
    for (const m of [coil, head, acc]) { m.userData.solidOnly = true; shellMeshes.push({ mesh: m, key: bk, kind: 'coil', ghost: 'warm', solidOnly: true, keepMat: true }); }
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: new THREE.Color(5, 4, 2.6), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, depthTest: false }));
    sp.position.y = -0.04; sp.scale.setScalar(0.001); g.add(sp);
    sparks.push(sp);
    plugGroups.push(g);
  }

  // =============== 缸内气体 ===============
  const gasGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 40, 1, false);
  const gases = [];
  for (const c of cyls) {
    const mat = gasMaterial();
    const m = new THREE.Mesh(gasGeo, mat);
    m.scale.set(G.bore * 0.97, 0.5, G.bore * 0.97);
    m.position.z = cylZpos(c);
    m.renderOrder = 5;
    banks[bankOf(c)].add(m);
    gases.push(m);
  }

  // 聚焦气缸指示环
  const focusRing = new THREE.Mesh(new THREE.TorusGeometry(G.bore / 2 + 0.05, 0.014, 8, 72),
    new THREE.MeshBasicMaterial({ color: '#ffe3b8', transparent: true, opacity: 0.9, depthTest: true }));
  focusRing.rotation.x = Math.PI / 2;
  const focusRing2 = focusRing.clone(); focusRing2.material = focusRing.material;

  // =============== 进气歧管 ===============
  const intakeGroup = new THREE.Group(); root.add(intakeGroup);
  const intakePaths = [], exhaustPaths = [];
  {
    const ps = new THREE.Shape();
    const x0 = -0.62, x1 = 0.62, y0 = 3.32, y1 = 4.12, r = 0.26;
    ps.moveTo(x0 + r, y0); ps.lineTo(x1 - r, y0); ps.quadraticCurveTo(x1, y0, x1, y0 + r);
    ps.lineTo(x1, y1 - r); ps.quadraticCurveTo(x1, y1, x1 - r, y1); ps.lineTo(x0 + r, y1);
    ps.quadraticCurveTo(x0, y1, x0, y1 - r); ps.lineTo(x0, y0 + r); ps.quadraticCurveTo(x0, y0, x0 + r, y0);
    const plen = 4.3;
    const pg = extrudeZ(ps, plen, 0.06);
    const plenum = mk(pg, M.intake, 'intake', intakeGroup, { bp: 'ghost' }); plenum.position.z = -0.1;
    // 顶部饰条
    for (const x of [-0.3, 0, 0.3]) {
      const rb = mk(new THREE.BoxGeometry(0.05, 0.03, plen - 0.6), M.intakeAccent, 'intake', intakeGroup, { bp: 'ghost' });
      rb.position.set(x, y1 + 0.01, -0.1);
    }
    // 节气门体 + 蝶阀
    const tb = mk(new THREE.CylinderGeometry(0.3, 0.3, 0.42, 40, 1, true), M.intakeAccent, 'intake', intakeGroup, { bp: 'ghost' });
    tb.material.side = THREE.DoubleSide; tb.geometry.rotateX(Math.PI / 2); tb.position.set(0, 3.72, 2.28);
    const flange = mk(new THREE.TorusGeometry(0.31, 0.035, 10, 48), M.intakeAccent, 'intake', intakeGroup, { bp: 'ghost' });
    flange.position.set(0, 3.72, 2.5);
    const bell = mk(new THREE.TorusGeometry(0.34, 0.06, 12, 48), M.intake, 'intake', intakeGroup, { bp: 'ghost' });
    bell.position.set(0, 3.72, 2.08);
    const butterfly = mk(new THREE.CylinderGeometry(0.285, 0.285, 0.015, 40), M.valveIn, 'intake', intakeGroup, { bp: 'ghost' });
    butterfly.position.set(0, 3.72, 2.3);
    intakeGroup.userData.butterfly = butterfly;
    const bshaft = mk(new THREE.CylinderGeometry(0.02, 0.02, 0.7, 10), M.forged, 'intake', intakeGroup, { bp: 'ghost' });
    bshaft.rotation.z = Math.PI / 2; bshaft.position.set(0, 3.72, 2.3);

    const runnerMat = M.intake;
    for (const c of cyls) {
      const bk = bankOf(c), zc = cylZpos(c);
      const side = bk === 'odd' ? 1 : -1;
      const port = toWorld(bk, -G.headW + 0.02, 2.66, zc);
      const out = bankDir(bk, -1, 0);
      const p1 = port.clone().addScaledVector(out, 0.3);
      const p2 = new V3(side * 0.95, 3.15, zc);
      const p3 = new V3(side * 0.58, 3.62, zc * 0.96);
      const curve = new THREE.CatmullRomCurve3([port, p1, p2, p3], false, 'centripetal');
      mk(new THREE.TubeGeometry(curve, 40, 0.13, 20, false), runnerMat, 'intake', intakeGroup, { bp: 'ghost' });
      // 进气道法兰
      const fl = mk(new THREE.TorusGeometry(0.14, 0.03, 8, 28), M.intakeAccent, 'intake', intakeGroup, { bp: 'ghost' });
      fl.position.copy(port); fl.lookAt(port.clone().add(out));
      // 粒子路径：稳压腔 → 进气道 → 气门 → 缸内
      const pv = toWorld(bk, -G.valveX, G.seatY + 0.15, zc);
      const pc = toWorld(bk, 0, 1.95, zc);
      const pIn = new V3(side * 0.1, 3.72, zc * 0.8);
      intakePaths.push(new THREE.CatmullRomCurve3([pIn, p3, p2, p1, port, pv, pc], false, 'centripetal'));
    }
  }

  // =============== 排气歧管 ===============
  const exhaustGroup = new THREE.Group(); root.add(exhaustGroup);
  {
    for (const bk of ['odd', 'even']) {
      const side = bk === 'odd' ? 1 : -1;
      const coll = new V3(side * 2.05, -0.95, -2.75);
      const collEnd = new V3(side * 2.05, -1.05, -3.9);
      const cm = new THREE.MeshStandardMaterial({ color: '#958d84', metalness: 1, roughness: 0.34, emissive: '#ff3a0a', emissiveIntensity: 0, clippingPlanes: [sweepSolid] });
      headerMats.push(cm);
      const col = mk(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([coll.clone().add(new V3(0, 0.05, 0.3)), coll, collEnd]), 20, 0.2, 24, false), cm, 'exhaust', exhaustGroup, { bp: 'ghost' });
      const cone = mk(new THREE.SphereGeometry(0.24, 24, 16), cm, 'exhaust', exhaustGroup, { bp: 'ghost' }); cone.position.copy(coll);
      const tipRing = mk(new THREE.TorusGeometry(0.2, 0.03, 8, 32), M.forged, 'exhaust', exhaustGroup, { bp: 'ghost' }); tipRing.position.copy(collEnd);
    }
    for (const c of cyls) {
      const bk = bankOf(c), zc = cylZpos(c);
      const side = bk === 'odd' ? 1 : -1;
      const port = toWorld(bk, G.headW - 0.02, 2.62, zc);
      const out = bankDir(bk, 1, 0);
      const p1 = port.clone().addScaledVector(out, 0.35);
      const p2 = new V3(side * 2.62, 0.55, zc);
      const p3 = new V3(side * 2.4, -0.45, zc * 0.55 - 1.2);
      const coll = new V3(side * 2.05, -0.9, -2.55);
      const curve = new THREE.CatmullRomCurve3([port, p1, p2, p3, coll], false, 'centripetal');
      const mat = new THREE.MeshStandardMaterial({ color: '#a39a90', metalness: 1, roughness: 0.34, emissive: '#ff3a0a', emissiveIntensity: 0, clippingPlanes: [sweepSolid] });
      headerMats.push(mat);
      mk(new THREE.TubeGeometry(curve, 60, 0.1, 16, false), mat, 'exhaust', exhaustGroup, { bp: 'ghost' });
      const fl = mk(new THREE.TorusGeometry(0.11, 0.03, 8, 24), M.forged, 'exhaust', exhaustGroup, { bp: 'ghost' });
      fl.position.copy(port); fl.lookAt(port.clone().add(out));
      const pv = toWorld(bk, G.valveX, G.seatY + 0.15, zc);
      const pc = toWorld(bk, 0, 2.05, zc);
      const collEnd = new V3(side * 2.05, -1.05, -4.1);
      exhaustPaths.push(new THREE.CatmullRomCurve3([pc, pv, port, p1, p2, p3, coll, collEnd], false, 'centripetal'));
    }
  }

  // =============== 气流粒子 ===============
  const PER = 34;
  const nPaths = 16;
  const partCount = nPaths * PER;
  const pPos = new Float32Array(partCount * 3), pCol = new Float32Array(partCount * 3), pA = new Float32Array(partCount), pS = new Float32Array(partCount);
  const pU = new Float32Array(partCount), pJ = new Float32Array(partCount * 3);
  for (let i = 0; i < partCount; i++) {
    pU[i] = (i % PER) / PER + Math.random() / PER;
    pJ[i * 3] = (Math.random() - 0.5) * 0.14; pJ[i * 3 + 1] = (Math.random() - 0.5) * 0.14; pJ[i * 3 + 2] = (Math.random() - 0.5) * 0.14;
    pS[i] = 0.7 + Math.random() * 0.6;
  }
  const pgeo = new THREE.BufferGeometry();
  pgeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pgeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  pgeo.setAttribute('alpha', new THREE.BufferAttribute(pA, 1));
  pgeo.setAttribute('size', new THREE.BufferAttribute(pS, 1));
  const pmat = new THREE.ShaderMaterial({
    uniforms: { uScale: { value: 300 } },
    vertexShader: /* glsl */`
      attribute float alpha; attribute float size; attribute vec3 color;
      varying float vA; varying vec3 vC; uniform float uScale;
      void main(){ vA = alpha; vC = color; vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * uScale * 0.075 / -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */`
      varying float vA; varying vec3 vC;
      void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d); if (r > 0.5) discard;
        float a = smoothstep(0.5, 0.0, r); gl_FragColor = vec4(vC * a * vA * 1.4, 1.0); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const particles = new THREE.Points(pgeo, pmat);
  particles.frustumCulled = false; particles.renderOrder = 6;
  root.add(particles);
  const flowState = new Float32Array(16);
  const heat = new Float32Array(8);

  // =============== 模式、选中、原理图 ===============
  // 可见性用 layers 控制（layers 不向子节点级联），这样原理图副本（子节点）可以独立显示
  let mode = 'section';
  let bpBuilt = false, bpOn = false;
  const bpObjects = [];
  const show = (obj, on) => obj.layers.set(on ? 0 : 1);
  function buildBlueprint() {
    if (bpBuilt) return; bpBuilt = true;
    const edgeCache = new Map();
    for (const m of allMeshes) {
      if (m.isInstancedMesh) continue;
      const kind = m.userData.bp || 'solid';
      if (kind === 'none') continue;
      const bm = new THREE.Mesh(m.geometry, kind === 'ghost' ? BPG : BP);
      bm.userData.noPick = true; bm.visible = false;
      bm.renderOrder = kind === 'ghost' ? 8 : 0;
      m.add(bm);
      let eg = edgeCache.get(m.geometry.uuid);
      if (!eg) { eg = new THREE.EdgesGeometry(m.geometry, 30); edgeCache.set(m.geometry.uuid, eg); }
      const ls = new THREE.LineSegments(eg, kind === 'ghost' ? BPLINE_G : BPLINE);
      ls.renderOrder = kind === 'ghost' ? 8 : 1;
      bm.add(ls);
      bpObjects.push(bm);
    }
  }
  function setBlueprint(on) {
    if (on) buildBlueprint();
    bpOn = on;
    for (const bm of bpObjects) bm.visible = on;
  }

  function applyMode(m) {
    mode = m;
    const section = m === 'section', xray = m === 'xray';
    secPlanes.odd.constant = section ? 0 : 100;
    secPlanes.even.constant = section ? 0 : 100;
    secPlanes.case.constant = section ? 0.001 : 100;
    for (const s of shellMeshes) {
      const mesh = s.mesh;
      let vis = s.solidOnly ? !section : s.sectionOnly ? section : true;
      if (s.kind === 'coil') vis = !section;
      show(mesh, vis);
      if (!mesh.userData.origMat) mesh.userData.origMat = mesh.material;
      mesh.material = (xray && !s.keepMat) ? (s.ghost === 'warm' ? GHOST.warm : GHOST.shell) : mesh.userData.origMat;
      if (mesh.userData.cap) show(mesh.userData.cap, section && vis);
      mesh.renderOrder = xray ? 10 : 0;
    }
    for (const m2 of parts.intake.meshes) {
      if (!m2.userData.origMat) m2.userData.origMat = m2.material;
      m2.material = xray ? GHOST.shell : section ? GHOST.faint : m2.userData.origMat;
      m2.renderOrder = (xray || section) ? 10 : 0;
    }
    for (const m2 of parts.exhaust.meshes) {
      if (!m2.userData.origMat) m2.userData.origMat = m2.material;
      m2.material = xray ? GHOST.warm : m2.userData.origMat;
      m2.renderOrder = xray ? 10 : 0;
    }
    applyDim();
  }

  let selected = null;
  function applyDim() {
    const dimShell = selected && selected !== 'block' && selected !== 'head';
    for (const key of Object.keys(parts)) {
      const dim = !!selected && key !== selected;
      for (const mat of parts[key].mats) {
        if (headerMats.includes(mat) && !dim && mat.userData.base) { /* restore below */ }
        if (!mat.userData.base) mat.userData.base = { transparent: mat.transparent, opacity: mat.opacity, depthWrite: mat.depthWrite };
        const want = dim ? { transparent: true, opacity: (key === 'block' || key === 'head') ? 0.06 : 0.1, depthWrite: false } : mat.userData.base;
        if (mat.transparent !== want.transparent) mat.needsUpdate = true;
        Object.assign(mat, want);
        if (key !== selected) { mat.emissive.copy(mat.userData.baseEmissiveColor || mat.emissive); if (mat.userData.baseEmissive !== undefined) mat.emissiveIntensity = mat.userData.baseEmissive; }
      }
    }
    for (const c of Object.values(CAP)) c.visible = !dimShell;
    GHOST.shell.uniforms.uAlpha.value = dimShell ? 0.45 : 1;
  }
  function select(part) { selected = part; applyDim(); }

  // =============== 每帧更新 ===============
  const tmp = new V3(), tmp2 = new V3();
  const pinWorld = (c, theta) => {
    const a = (theta + c.pinAngle) * DEG;
    return tmp.set(G.r * Math.sin(a), G.r * Math.cos(a), cylZpos(c));
  };
  const colIntake = new THREE.Color('#3aa3ff');
  const colComp = new THREE.Color('#7e6bff');
  const colHot = new THREE.Color('#ff9a3c');
  const colBurn = new THREE.Color('#ff4a10');
  const colExh = new THREE.Color('#8a5a3c');
  const cTmp = new THREE.Color();
  let time = 0;
  let focus = 1;

  function update({ theta, cycle, params, dTheta, dt, focusId, showFlow = true, showGas = true }) {
    time += dt;
    focus = focusId;
    crank.rotation.z = -theta * DEG;
    const ev = cycle.ev;
    const Lin = MAX_LIFT.intake * 10, Lex = MAX_LIFT.exhaust * 10;
    const pistonX = [];
    cyls.forEach((c, i) => {
      const psi = psiOf(c, theta);
      const r = G.r, l = G.rod, a = psi * DEG;
      const xp = r * Math.cos(a) + Math.sqrt(l * l - r * r * Math.sin(a) ** 2);
      pistonX.push(xp);
      pistons[i].position.y = xp;
      // 连杆：从曲柄销到活塞销
      const pw = pinWorld(c, theta);
      const beta = c.id % 2 === 1 ? 45 : -45;
      const q = tmp2.set(xp * Math.sin(beta * DEG), xp * Math.cos(beta * DEG), pw.z);
      rods[i].position.set(pw.x, pw.y, pw.z);
      rods[i].rotation.z = Math.atan2(-(q.x - pw.x), q.y - pw.y);
      // 缸内气体
      const crown = xp + G.compH - 0.01;
      const top = G.seatY + 0.02;
      const gm = gases[i];
      gm.position.y = (crown + top) / 2;
      gm.scale.y = Math.max(0.01, top - crown);
      const s = sampleCycle(cycle, psi);
      const pBar = s.p / 1e5;
      const u = gm.material.uniforms;
      let I, A;
      if (psi < 180 || psi >= 700) {
        // 燃烧/做功
        const xb = s.xb;
        const hot = Math.min(1, Math.max(0, (s.T - 900) / 1800));
        cTmp.copy(colComp).lerp(colBurn, Math.min(1, xb * 1.5)).lerp(colHot, hot * xb * 0.8);
        I = 0.9 + Math.min(3.4, pBar / 18) + s.dxb * 40;
        A = 0.5 + 0.3 * Math.min(1, pBar / 30);
        u.uFlame.value = xb > 0.002 && xb < 0.985 ? Math.pow(xb, 0.5) : 0;
      } else if (psi < 360) {
        cTmp.copy(colExh).lerp(colBurn, Math.min(1, Math.max(0, (pBar - 1.3) / 5)));
        I = 0.8 + Math.min(0.8, (pBar - 1) / 3);
        A = 0.38;
        u.uFlame.value = 0;
      } else {
        const resid = s.xb;
        const comp = Math.max(0, Math.min(1, (pBar - 1) / 18));
        cTmp.copy(colIntake).lerp(colComp, comp).lerp(colExh, resid * 0.8);
        I = 0.85 + comp * 0.5;
        A = 0.36 + comp * 0.3;
        u.uFlame.value = 0;
      }
      const isF = c.id === focusId;
      u.uColor.value.copy(cTmp);
      u.uI.value = I * (isF ? 1 : 0.8);
      u.uA.value = A * (isF ? 1 : 0.7) * (bpOn ? 0.8 : 1);
      u.uT.value = time;
      gm.visible = showGas && (mode !== 'solid' || bpOn);
      // 火花
      const sinceIgn = wrap720(psi - cycle.ign);
      const spark = sinceIgn < 14 ? (1 - sinceIgn / 14) : 0;
      const flick = 0.75 + 0.25 * Math.sin(time * 90 + i);
      sparks[i].scale.setScalar(spark > 0 ? 0.15 + spark * 0.6 * flick : 0.001);
      sparks[i].material.opacity = spark;
      // 排气管热度
      const exFlow = valveLift(psi, ev.EVO, ev.EVC, 1);
      heat[i] = Math.max(heat[i] * Math.exp(-dt * 0.8), exFlow * (pBar > 1.5 ? 1 : 0.55));
    });
    // 气门
    for (const v of valves) {
      const psi = psiOf(v.c, theta);
      const lift = v.type === 'in' ? valveLift(psi, ev.IVO, ev.IVC, Lin) : valveLift(psi, ev.EVO, ev.EVC, Lex);
      v.valve.position.y = -lift;
      v.spring.scale.y = (springL - lift) / springL;
      v.retainer.position.y = springY0 + springL - lift + 0.02;
      v.bucket.position.y = G.valveLen + G.bucketH / 2 - lift;
    }
    // 凸轮轴（半速）
    for (const c of cams) {
      const shift = c.type === 'in' ? params.vvt : 0;
      c.shaft.rotation.z = c.sign * (theta + shift) / 2 * DEG;
    }
    // 正时链
    const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), s4 = new V3(1, 1, 1), p4 = new V3(), zAxis = new V3(0, 0, 1);
    for (const ch of chains) {
      const off = -theta * DEG * 0.22;
      for (let k = 0; k < ch.count; k++) {
        const r = ch.path.at(k * ch.pitch + off);
        p4.set(r.p.x, r.p.y, ch.z);
        q4.setFromAxisAngle(zAxis, r.ang);
        m4.compose(p4, q4, s4);
        ch.inst.setMatrixAt(k, m4);
      }
      ch.inst.instanceMatrix.needsUpdate = true;
    }
    for (const a3 of accessories) a3.mesh.rotation.z = -theta * DEG * a3.ratio;
    // 节气门蝶阀
    intakeGroup.userData.butterfly.rotation.x = Math.PI / 2 - params.throttle * 1.35;
    // 排气管发光
    for (let i = 0; i < 8; i++) headerMats[2 + i].emissiveIntensity = heat[i] * heat[i] * 0.55;
    headerMats[0].emissiveIntensity = (heat[0] + heat[2] + heat[4] + heat[6]) * 0.12;
    headerMats[1].emissiveIntensity = (heat[1] + heat[3] + heat[5] + heat[7]) * 0.12;

    // 聚焦环
    const fc = cyls[focusId - 1];
    const fb = banks[bankOf(fc)];
    if (focusRing.parent !== fb) fb.add(focusRing);
    focusRing.position.set(0, G.deck + 0.012, cylZpos(fc));
    focusRing.material.opacity = 0.55 + 0.35 * Math.sin(time * 4);

    // 粒子
    particles.visible = showFlow;
    if (showFlow) {
      let idx = 0;
      const adv = Math.abs(dTheta);
      for (let pth = 0; pth < 16; pth++) {
        const isIn = pth < 8;
        const c = cyls[pth % 8];
        const psi = psiOf(c, theta);
        const curve = isIn ? intakePaths[pth] : exhaustPaths[pth - 8];
        let flow;
        const vel = Math.sin(psi * DEG); // 活塞速度近似（>0 下行）
        if (isIn) {
          const lf = valveLift(psi, ev.IVO, ev.IVC, 1);
          flow = lf * (0.25 + Math.max(0, vel) * 0.9) * (0.4 + 0.6 * params.throttle);
        } else {
          const lf = valveLift(psi, ev.EVO, ev.EVC, 1);
          const pr = Math.max(0, sampleCycle(cycle, psi).p / 1e5 - 1.1);
          flow = lf * (0.25 + Math.max(0, -vel) * 0.8 + Math.min(1.5, pr * 0.3));
        }
        flowState[pth] = flowState[pth] * 0.8 + flow * 0.2;
        const vis = Math.min(1, flowState[pth] * 2.2);
        const col = isIn ? colIntake : colBurn;
        for (let k = 0; k < PER; k++, idx++) {
          pU[idx] = (pU[idx] + adv * flow * 0.0065) % 1;
          const u = pU[idx];
          curve.getPointAt(Math.min(0.999, u), tmp);
          pPos[idx * 3] = tmp.x + pJ[idx * 3]; pPos[idx * 3 + 1] = tmp.y + pJ[idx * 3 + 1]; pPos[idx * 3 + 2] = tmp.z + pJ[idx * 3 + 2];
          const edge = Math.min(1, u * 8, (1 - u) * 5);
          pA[idx] = vis * edge * (c.id === focusId ? 1 : 0.55);
          const hotness = isIn ? 0 : Math.max(0, 1 - u * 1.4);
          pCol[idx * 3] = col.r + hotness * 0.3; pCol[idx * 3 + 1] = col.g + hotness * 0.4; pCol[idx * 3 + 2] = col.b + hotness * 0.2;
        }
      }
      pgeo.attributes.position.needsUpdate = true;
      pgeo.attributes.alpha.needsUpdate = true;
      pgeo.attributes.color.needsUpdate = true;
    }
    // 选中部件脉冲
    if (selected && parts[selected]) {
      const pulse = 0.5 + 0.5 * Math.sin(time * 3.2);
      for (const mat of parts[selected].mats) {
        if (headerMats.includes(mat)) continue;
        mat.emissive.setRGB(1.0, 0.55, 0.2);
        mat.emissiveIntensity = 0.05 + pulse * 0.16;
      }
    }
  }

  // 锚点（HTML 标签）
  const anchors = cyls.map((c) => ({ id: c.id, local: new V3(0, G.coverTop + 0.55, cylZpos(c)), bank: bankOf(c) }));
  function anchorWorld(id, out = new V3()) {
    const a = anchors[id - 1];
    return banks[a.bank].localToWorld(out.copy(a.local));
  }
  // 原理图标注用的关键点（世界坐标）
  function keyPoints() {
    const Z = 3.2, b = G.bore / 2;
    const tdcY = G.r + G.rod + G.compH, bdcY = G.rod - G.r + G.compH;
    return {
      crank: new V3(0, 0, Z),
      axisOdd: toWorld('odd', 0, 4.7, Z), axisEven: toWorld('even', 0, 4.7, Z),
      boreL0: toWorld('even', -b, G.deck, Z), boreR0: toWorld('even', b, G.deck, Z),
      boreL: toWorld('even', -b, 4.25, Z), boreR: toWorld('even', b, 4.25, Z),
      tdc0: toWorld('odd', b, tdcY, Z), bdc0: toWorld('odd', b, bdcY, Z),
      tdc: toWorld('odd', 1.45, tdcY, Z), bdc: toWorld('odd', 1.45, bdcY, Z),
      camIn: toWorld('even', G.camIn.x, G.camIn.y, Z), camEx: toWorld('even', G.camEx.x, G.camEx.y, Z),
    };
  }

  function pickables() {
    return allMeshes.filter((m) => {
      if (!m.visible || !(m.layers.mask & 1)) return false;
      if (m.material.transparent && m.material.opacity < 0.2) return false;
      let o = m.parent; while (o) { if (!o.visible) return false; o = o.parent; }
      if (mode === 'xray' && (m.material.isShaderMaterial)) return false;
      return true;
    });
  }

  applyMode('section');

  return {
    root, crank, update, applyMode, select, gases, setPointScale(v) { pmat.uniforms.uScale.value = v; }, get selected() { return selected; },
    sweep(s) { sweepSolid.constant = -s; sweepLine.constant = s; },
    anchorWorld, keyPoints, pickables, cyls, parts,
    materials: M, get mode() { return mode; }, setBlueprint, get blueprint() { return bpOn; },
  };
}
