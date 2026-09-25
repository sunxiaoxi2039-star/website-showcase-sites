// world.js — island terrain, Aegean sea, scenery, obstacle map and model-slot anchors.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const CAVE_MOUTH = new THREE.Vector2(1.6, -7.3);
export const CAVE_CENTER = new THREE.Vector2(1.9, -9.4);
export const GIANT_BED = new THREE.Vector2(4.0, -6.1);
export const JETTY_ZONE = { x: -0.8, z: 8.7, r: 2.7 };
export const HERO_START = new THREE.Vector2(0.2, 6.2);
export const SHIP_POS = new THREE.Vector3(-4.6, 0, 11.7);
export const SUPPLY_SPOTS = [new THREE.Vector2(0.95, -8.15), new THREE.Vector2(1.75, -8.7), new THREE.Vector2(2.5, -8.1)];
// jetty walkway: centre-line from the beach out to the ship, half width
const JETTY_A = new THREE.Vector2(-1.6, 9.9), JETTY_B = new THREE.Vector2(-3.5, 11.5), JETTY_HALF = .55;
export const PATH = [[-0.9, 9.4], [-0.3, 7.2], [1.1, 5.0], [0.5, 2.4], [-0.6, -0.3], [0.1, -3.0], [1.3, -5.1], [1.6, -7.2]];

let seed = 1234567;
export const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const R = (a, b) => a + (b - a) * rand();
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// value noise
const P = new Uint8Array(512); { const p = [...Array(256).keys()]; for (let i = 255; i > 0; i--) { const j = (rand() * (i + 1)) | 0; [p[i], p[j]] = [p[j], p[i]]; } for (let i = 0; i < 512; i++) P[i] = p[i & 255]; }
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const h = (i, j) => P[(P[(xi + i) & 255] + yi + j) & 255] / 255;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return (h(0, 0) * (1 - u) + h(1, 0) * u) * (1 - v) + (h(0, 1) * (1 - u) + h(1, 1) * u) * v;
}

export function islandR(a) {
  let da = a - Math.PI / 2; da = Math.atan2(Math.sin(da), Math.cos(da));
  return 11.0 + .9 * Math.sin(3 * a + .7) + .55 * Math.sin(5 * a + 2.1) + .3 * Math.sin(9 * a + .3) + .8 * Math.exp(-da * da / .3);
}
export const shoreDist = (x, z) => islandR(Math.atan2(z, x)) - Math.hypot(x, z);
function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(px - ax - dx * t, pz - az - dz * t);
}
export function pathDist(x, z) { let m = 1e9; for (let i = 0; i < PATH.length - 1; i++) m = Math.min(m, segDist(x, z, ...PATH[i], ...PATH[i + 1])); return m; }
const onJetty = (x, z) => JETTY_HALF - segDist(x, z, JETTY_A.x, JETTY_A.y, JETTY_B.x, JETTY_B.y);

export function height(x, z) {
  const d = shoreDist(x, z);
  if (d < 0) return Math.max(-2.2, d * .45) + .08;
  const beach = smooth(0, 1.9, d);
  let h = .08 + .3 * beach + (vnoise(x * .2 + 9, z * .2) - .5) * .5 * smooth(1.8, 4.5, d);
  h += 1.1 * Math.exp(-((x - 2.2) ** 2 + (z + 10.4) ** 2) / 5);   // rise behind the cave
  h -= .04 * smooth(1.0, .3, pathDist(x, z));
  return h;
}
export function groundY(x, z) { return onJetty(x, z) > -.05 && shoreDist(x, z) < 1.2 ? Math.max(.42, height(x, z)) : height(x, z); }

export function buildWorld(scene) {
  const world = { obstacles: [], slots: {}, updaters: [] };
  const obst = (x, z, r, tag) => world.obstacles.push({ x, z, r, tag });

  // ---------------- terrain ----------------
  const N = 180, S = 34;
  const tg = new THREE.PlaneGeometry(S, S, N, N); tg.rotateX(-Math.PI / 2);
  const pos = tg.attributes.position, cols = new Float32Array(pos.count * 3), c = new THREE.Color();
  const sand = new THREE.Color('#e8d9b0'), wet = new THREE.Color('#c9b68a'), path = new THREE.Color('#efe3c4'), under = new THREE.Color('#7fb2a2');
  const g1 = new THREE.Color('#8daf55'), g2 = new THREE.Color('#6e9443'), g3 = new THREE.Color('#a9bd66');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), d = shoreDist(x, z);
    pos.setY(i, height(x, z));
    const n = vnoise(x * .7, z * .7), n2 = vnoise(x * 2.3 + 40, z * 2.3);
    if (d < 0) c.copy(wet).lerp(under, smooth(0, -1.2, d));
    else {
      c.copy(g2).lerp(g1, n).lerp(g3, smooth(.55, .9, n2) * .6);
      c.lerp(sand, smooth(2.1 + n * .6, 1.2, d));
      c.lerp(wet, smooth(.45, .05, d) * .8);
      c.lerp(path, smooth(.95 + n2 * .35, .55, pathDist(x, z)) * smooth(.8, 1.6, d + 1));
    }
    c.multiplyScalar(.94 + n2 * .1);
    cols.set([c.r, c.g, c.b], i * 3);
  }
  tg.setAttribute('color', new THREE.BufferAttribute(cols, 3)); tg.computeVertexNormals();
  const terrain = new THREE.Mesh(tg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95, metalness: 0 }));
  terrain.receiveShadow = true; terrain.name = 'terrain'; scene.add(terrain);
  world.terrain = terrain;

  // ---------------- sea ----------------
  const TS = 256, EXT = 26, data = new Uint8Array(TS * TS * 4);
  for (let j = 0; j < TS; j++) for (let i = 0; i < TS; i++) {
    const x = (i / (TS - 1) - .5) * 2 * EXT, z = (j / (TS - 1) - .5) * 2 * EXT;
    const v = Math.round(Math.min(1, Math.max(0, (shoreDist(x, z) + 12) / 14)) * 255);
    data.set([v, v, v, 255], (j * TS + i) * 4);
  }
  const shoreTex = new THREE.DataTexture(data, TS, TS); shoreTex.magFilter = shoreTex.minFilter = THREE.LinearFilter; shoreTex.needsUpdate = true;
  const seaU = {
    uTime: { value: 0 }, uShore: { value: shoreTex }, uExt: { value: EXT },
    uShallow: { value: new THREE.Color('#3fc4b8') }, uMid: { value: new THREE.Color('#1a8791') }, uDeep: { value: new THREE.Color('#0d4d5e') }, uFar: { value: new THREE.Color('#0a3442') },
  };
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
    uniforms: seaU,
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uTime, uExt; uniform sampler2D uShore; uniform vec3 uShallow, uMid, uDeep, uFar; varying vec3 vW;
      float h(vec2 p){ vec3 q = fract(p.xyx * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }   // sin-free: stays random at large world coords
      float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+1.),f.x), f.y); }
      void main(){
        vec2 uv = vW.xz / (2. * uExt) + .5;
        float sd = texture2D(uShore, clamp(uv, 0., 1.)).r * 14. - 12.;
        if (any(greaterThan(abs(uv - .5), vec2(.5)))) sd = -12.;
        float depth = clamp(-sd / 6., 0., 1.);
        vec3 col = mix(uShallow, uMid, smoothstep(.0, .3, depth));
        col = mix(col, uDeep, smoothstep(.25, .9, depth));
        col = mix(col, uFar, smoothstep(20., 60., length(vW.xz)));
        vec2 p = vW.xz;
        float r1 = n(p * .55 + vec2(uTime * .12, uTime * .05)), r2 = n(p * 1.7 - vec2(uTime * .2, -uTime * .16));
        col *= .9 + .12 * r1 + .08 * r2;
        float glint = pow(n(p * vec2(1.8, 1.4) + vec2(uTime * .35, 0.)), 28.) * (1. - depth * .6);
        col += glint * .12;
        float foam = smoothstep(-.4, -.08, sd);
        float l1 = -1.15 - .25 * sin(uTime * .8), l2 = -2.5 - .3 * sin(uTime * .6 + 1.3);
        foam += exp(-pow((sd - l1) * 7., 2.)) * .75 * (.6 + .4 * r2);
        foam += exp(-pow((sd - l2) * 6., 2.)) * .45 * (.6 + .4 * r1);
        foam += smoothstep(.72, 1., sin(sd * 9. + uTime * 2.2)) * smoothstep(-1., -.2, sd) * .35;
        col = mix(col, vec3(.93, .97, .95), clamp(foam, 0., 1.) * .85);
        gl_FragColor = vec4(col, 1.);
      }`,
  }));
  sea.name = 'sea'; scene.add(sea);
  world.updaters.push(t => { seaU.uTime.value = t; });

  // ---------------- helpers ----------------
  const blob = (r, detail, amp, s) => {
    const g = new THREE.IcosahedronGeometry(r, detail), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(p, i); const k = 1 + (vnoise(v.x * 2.3 + s, v.y * 2.3 + v.z * 1.7) - .5) * amp; p.setXYZ(i, v.x * k, v.y * k, v.z * k); }
    g.computeVertexNormals(); return g;
  };
  const tint = (g, hex) => { const c = new THREE.Color(hex), a = new Float32Array(g.attributes.position.count * 3); for (let i = 0; i < a.length; i += 3) a.set([c.r, c.g, c.b], i); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g.index ? g.toNonIndexed() : g; };
  const valid = (x, z, list, gap) => list.every(q => Math.hypot(q[0] - x, q[1] - z) > gap);
  const farFromKeyPlaces = (x, z, m = 0) =>
    pathDist(x, z) > 1.35 + m && Math.hypot(x - CAVE_CENTER.x, z - CAVE_CENTER.y) > 4.4 + m && Math.hypot(x - JETTY_ZONE.x, z - JETTY_ZONE.z) > 3.4 + m &&
    Math.hypot(x - GIANT_BED.x, z - GIANT_BED.y) > 2.6 + m && Math.hypot(x - HERO_START.x, z - HERO_START.y) > 2 + m;

  // generic slot: a list of transforms, a procedural placeholder object, optional imported replacement
  function makeSlot(name, transforms, placeholder, targetHeight) {
    const slot = { name, transforms, placeholder, targetHeight, imported: null, status: 'procedural', note: 'Procedural placeholder' };
    scene.add(placeholder);
    world.slots[name] = slot; return slot;
  }

  // ---------------- olive trees (instanced placeholder) ----------------
  const olives = [];
  for (let k = 0; k < 4000 && olives.length < 25; k++) {
    const a = R(0, Math.PI * 2), r = Math.sqrt(rand()) * 10.5, x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (shoreDist(x, z) < 2.1 || !farFromKeyPlaces(x, z) || !valid(x, z, olives, 2.25)) continue;
    olives.push([x, z]);
  }
  {
    const trunkParts = [];
    const trunk = new THREE.CylinderGeometry(.11, .2, 1.1, 7, 5); trunk.translate(0, .55, 0);
    const tp = trunk.attributes.position; for (let i = 0; i < tp.count; i++) { const y = tp.getY(i); tp.setX(i, tp.getX(i) + Math.sin(y * 3.2) * .09); tp.setZ(i, tp.getZ(i) + Math.cos(y * 2.1) * .06); }
    trunk.computeVertexNormals(); trunkParts.push(tint(trunk, '#6f6352'));
    for (let i = 0; i < 3; i++) { const root = new THREE.ConeGeometry(.08, .45, 5); root.rotateZ(1.2); root.rotateY(i * 2.1); root.translate(Math.cos(i * 2.1) * .16, .06, -Math.sin(i * 2.1) * .16); trunkParts.push(tint(root, '#665a4a')); }
    const branch = new THREE.CylinderGeometry(.04, .08, .7, 5); branch.rotateZ(.8); branch.translate(.25, 1.05, 0); trunkParts.push(tint(branch, '#6f6352'));
    const trunkGeo = mergeGeometries(trunkParts);
    const canopyParts = [];
    const blobs = [[0, 1.45, 0, .62], [.45, 1.3, .15, .5], [-.4, 1.35, -.1, .52], [.1, 1.75, -.25, .45], [-.15, 1.6, .38, .44], [.35, 1.62, -.35, .38]];
    blobs.forEach(([x, y, z, r], i) => { const b = blob(r, 1, .55, i * 7); b.translate(x, y, z); canopyParts.push(tint(b, ['#7f9a62', '#6d8a55', '#90a871'][i % 3])); });
    const canopyGeo = mergeGeometries(canopyParts);
    const n = olives.length;
    const trunkM = new THREE.InstancedMesh(trunkGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .9 }), n);
    const canopyM = new THREE.InstancedMesh(canopyGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .85, flatShading: true }), n);
    trunkM.castShadow = canopyM.castShadow = true; trunkM.receiveShadow = canopyM.receiveShadow = true;
    const group = new THREE.Group(); group.add(trunkM, canopyM);
    const transforms = olives.map(([x, z]) => ({ x, z, y: height(x, z), rot: R(0, Math.PI * 2), s: R(.85, 1.25), phase: R(0, 6) }));
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), pv = new THREE.Vector3();
    const place = t => {
      transforms.forEach((o, i) => {
        e.set(Math.sin(t * .9 + o.phase) * .025, o.rot, Math.cos(t * .7 + o.phase) * .025); q.setFromEuler(e); sc.setScalar(o.s); pv.set(o.x, o.y - .02, o.z);
        m.compose(pv, q, sc); trunkM.setMatrixAt(i, m); canopyM.setMatrixAt(i, m);
      });
      trunkM.instanceMatrix.needsUpdate = canopyM.instanceMatrix.needsUpdate = true;
    };
    place(0);
    const slot = makeSlot('olive', transforms, group, 2.1);
    world.updaters.push(t => { if (group.visible) place(t); if (slot.imported) slot.imported.children.forEach((c, i) => { const o = transforms[i]; c.rotation.set(Math.sin(t * .9 + o.phase) * .02, o.rot, Math.cos(t * .7 + o.phase) * .02); }); });
    transforms.forEach(o => obst(o.x, o.z, .38 * o.s, 'olive'));
  }

  // ---------------- cypresses ----------------
  const cyp = [];
  for (let k = 0; k < 3000 && cyp.length < 9; k++) {
    const a = R(0, Math.PI * 2), r = Math.sqrt(rand()) * 10.2, x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (shoreDist(x, z) < 1.5 || !farFromKeyPlaces(x, z) || !valid(x, z, olives, 1.4) || !valid(x, z, cyp, 2.5)) continue;
    cyp.push([x, z]);
  }
  {
    const pts = []; for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push(new THREE.Vector2(Math.sin(Math.pow(t, .75) * Math.PI) * .42 * (1 - t * .35) + .001, .25 + t * 2.3)); }
    const body = new THREE.LatheGeometry(pts, 9); const bp = body.attributes.position;
    for (let i = 0; i < bp.count; i++) { const k = 1 + (vnoise(bp.getX(i) * 6, bp.getY(i) * 5 + bp.getZ(i) * 6) - .5) * .35; bp.setX(i, bp.getX(i) * k); bp.setZ(i, bp.getZ(i) * k); }
    body.computeVertexNormals();
    const tr = new THREE.CylinderGeometry(.05, .07, .35, 5); tr.translate(0, .17, 0);
    const geo = mergeGeometries([tint(body, '#2f5a36'), tint(tr, '#5a4a3a')]);
    const transforms = cyp.map(([x, z]) => ({ x, z, y: height(x, z), rot: R(0, 6), s: R(.8, 1.2), phase: R(0, 6) }));
    const im = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .9, flatShading: true }), transforms.length);
    im.castShadow = im.receiveShadow = true;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), pv = new THREE.Vector3();
    const place = t => { transforms.forEach((o, i) => { e.set(Math.sin(t * 1.1 + o.phase) * .03, o.rot, 0); q.setFromEuler(e); sc.set(o.s, o.s * 1.1, o.s); pv.set(o.x, o.y - .02, o.z); m.compose(pv, q, sc); im.setMatrixAt(i, m); }); im.instanceMatrix.needsUpdate = true; };
    place(0);
    const g = new THREE.Group(); g.add(im);
    const slot = makeSlot('cypress', transforms, g, 2.6);
    world.updaters.push(t => { if (g.visible) place(t); if (slot.imported) slot.imported.children.forEach((c, i) => { c.rotation.x = Math.sin(t * 1.1 + transforms[i].phase) * .03; }); });
    transforms.forEach(o => obst(o.x, o.z, .3 * o.s, 'cypress'));
  }

  // ---------------- boulders ----------------
  {
    const list = [];
    for (let k = 0; k < 6000 && list.length < 46; k++) {
      const a = R(0, Math.PI * 2), rr = islandR(a) - R(.15, 1.1), x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      if (Math.hypot(x - JETTY_ZONE.x, z - JETTY_ZONE.z) < 3.6 || Math.hypot(x - (JETTY_A.x + JETTY_B.x) / 2, z - (JETTY_A.y + JETTY_B.y) / 2) < 2.2 || !valid(x, z, list, 1.1)) continue;
      list.push([x, z, R(.35, .75)]);
    }
    for (let k = 0; k < 8; k++) { const a = R(-.6, 3.8), x = CAVE_CENTER.x + Math.cos(a) * R(3, 4.2), z = CAVE_CENTER.y - Math.sin(a) * R(2.4, 3.6); if (shoreDist(x, z) > .5 && Math.hypot(x - GIANT_BED.x, z - GIANT_BED.y) > 1.9 && pathDist(x, z) > 1.2) list.push([x, z, R(.4, .7)]); }
    const geo = tint(blob(1, 1, .7, 3), '#c4b38f');
    const transforms = list.map(([x, z, s]) => ({ x, z, y: height(x, z), rot: R(0, 6), s, sy: R(.6, .9) }));
    const im = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .92, flatShading: true }), transforms.length);
    im.castShadow = im.receiveShadow = true;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pv = new THREE.Vector3(), e = new THREE.Euler();
    transforms.forEach((o, i) => { e.set(R(-.3, .3), o.rot, R(-.3, .3)); q.setFromEuler(e); sc.set(o.s, o.s * o.sy, o.s * R(.8, 1.1)); pv.set(o.x, o.y + o.s * .15, o.z); m.compose(pv, q, sc); im.setMatrixAt(i, m); });
    const g = new THREE.Group(); g.add(im);
    makeSlot('boulder', transforms, g, .9);
    transforms.forEach(o => obst(o.x, o.z, o.s * .9, 'boulder'));
  }

  // ---------------- cave: limestone arch with a dark interior ----------------
  {
    const g = new THREE.Group(), stone = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95, flatShading: true });
    const parts = [];
    const add = (x, y, z, r, col, sy = 1) => { const b = blob(r, 1, .6, x * 3 + z); b.scale(1, sy, 1); b.translate(x, y, z); parts.push(tint(b, col)); };
    const cx = CAVE_MOUTH.x, cz = CAVE_MOUTH.y - .35;
    for (let i = 0; i <= 10; i++) { const a = i / 10 * Math.PI; add(cx + Math.cos(a) * 1.25, height(cx, cz) + Math.sin(a) * 1.55 + .1, cz + R(-.15, .15), R(.42, .58), ['#cbbb98', '#b9a886', '#d4c6a4'][i % 3]); }
    for (let i = 0; i < 16; i++) { const a = R(-.3, Math.PI + .3), rr = R(1.2, 2.6); add(CAVE_CENTER.x + Math.cos(a) * rr, 1 + R(0, 1.6), CAVE_CENTER.y - Math.sin(a) * rr * .8 - .3, R(.8, 1.35), ['#b8a784', '#a99878', '#c6b692'][i % 3], R(.8, 1.15)); }
    add(CAVE_CENTER.x - 1.6, 1.4, CAVE_CENTER.y - .9, 1.6, '#b09f7d'); add(CAVE_CENTER.x + 1.8, 1.5, CAVE_CENTER.y - .6, 1.7, '#bba98a'); add(CAVE_CENTER.x + .2, 2.4, CAVE_CENTER.y - 1.3, 1.8, '#c2b190');
    // moss
    for (let i = 0; i < 9; i++) { const a = R(0, Math.PI), rr = R(1.4, 2.4); add(CAVE_CENTER.x + Math.cos(a) * rr, 2.2 + R(0, .9), CAVE_CENTER.y - Math.sin(a) * rr * .6, R(.18, .3), '#7d9451', .5); }
    const rock = new THREE.Mesh(mergeGeometries(parts), stone); rock.castShadow = rock.receiveShadow = true; g.add(rock);
    const inside = new THREE.Mesh(new THREE.SphereGeometry(1.25, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#1b1510', roughness: 1, side: THREE.BackSide }));
    inside.scale.set(1, 1.2, 1.25); inside.position.set(cx, height(cx, cz - 1), cz - 1.05); g.add(inside);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(1.3, 20).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#2a2219', roughness: 1 }));
    floor.position.set(cx, height(cx, cz - 1) + .03, cz - 1.05); floor.receiveShadow = true; g.add(floor);
    const slot = makeSlot('cave', [{ x: cx, z: cz, y: 0, rot: 0, s: 1 }], g, 3.4);
    slot.interior = [inside, floor];
    // collision: the side pillars and the whole rock mass behind; the passage stays open
    obst(cx - 1.35, cz, .55, 'cave'); obst(cx + 1.35, cz, .55, 'cave');
    for (let i = 0; i < 9; i++) { const a = i / 8 * Math.PI; obst(CAVE_CENTER.x + Math.cos(a) * 2.2, CAVE_CENTER.y - Math.sin(a) * 1.4 - .4, 1.1, 'cave'); }
    obst(cx - 1.55, cz - 1.2, .45, 'cave'); obst(cx + 1.55, cz - 1.2, .45, 'cave'); obst(cx, cz - 2.35, .5, 'cave');
    // firelight
    const fire = new THREE.PointLight('#ff9a4a', 6, 7, 1.6); fire.position.set(cx, height(cx, cz) + .6, cz - .7); g.add(fire);
    const torchL = new THREE.PointLight('#ffb060', 2.5, 4, 1.8); torchL.position.set(cx - 1.05, height(cx, cz) + 1.1, cz + .45); g.add(torchL);
    world.updaters.push(t => { fire.intensity = 5 + Math.sin(t * 13) * .6 + Math.sin(t * 29 + 1) * .5; torchL.intensity = 2.3 + Math.sin(t * 17 + 2) * .4; });
    world.firePoints = [fire.position.clone(), torchL.position.clone()];
  }

  // ---------------- ship and jetty ----------------
  {
    const g = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: '#4a3223', roughness: .8 }), dark = new THREE.MeshStandardMaterial({ color: '#2e2016', roughness: .85 });
    const bronze = new THREE.MeshStandardMaterial({ color: '#a8743a', roughness: .35, metalness: .8 });
    const hull = new THREE.CylinderGeometry(.62, .62, 4.2, 18, 12, true, Math.PI / 2, Math.PI); hull.rotateX(Math.PI / 2);
    const hp = hull.attributes.position;
    for (let i = 0; i < hp.count; i++) { const z = hp.getZ(i) / 2.1, k = 1 - Math.pow(Math.abs(z), 2.2); hp.setX(i, hp.getX(i) * (.08 + .92 * k)); hp.setY(i, hp.getY(i) * (.55 + .45 * k) + Math.pow(Math.abs(z), 3) * .75 * (z > 0 ? 1.25 : .8)); }
    hull.computeVertexNormals();
    const hullM = new THREE.Mesh(hull, new THREE.MeshStandardMaterial({ color: '#5a3a26', roughness: .75, side: THREE.DoubleSide })); hullM.position.y = .5; g.add(hullM);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(.9, .05, 3.2), wood); deck.position.y = .5; g.add(deck);
    const stripe = new THREE.Mesh(new THREE.TorusGeometry(1, .03, 6, 40, Math.PI), dark); stripe.scale.set(.62, 1, 2.1); stripe.rotation.x = Math.PI / 2; stripe.position.y = .47; g.add(stripe);
    const ram = new THREE.Mesh(new THREE.ConeGeometry(.08, .55, 8), bronze); ram.rotation.x = Math.PI / 2; ram.position.set(0, .12, 2.28); g.add(ram);
    const prow = new THREE.Mesh(new THREE.TorusGeometry(.25, .05, 6, 12, Math.PI * 1.2), wood); prow.position.set(0, 1.35, 2.02); prow.rotation.y = Math.PI / 2; g.add(prow);
    const stern = new THREE.Mesh(new THREE.TorusGeometry(.3, .06, 6, 12, Math.PI * 1.1), wood); stern.position.set(0, 1.12, -2.0); stern.rotation.set(0, Math.PI / 2, Math.PI * .9); g.add(stern);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(.045, .06, 3.1, 8), wood); mast.position.set(0, 2.0, .15); g.add(mast);
    const yard = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, 2.1, 6), wood); yard.rotation.z = Math.PI / 2; yard.position.set(0, 3.3, .15); g.add(yard);
    // sail with a painted sun emblem
    const cv = document.createElement('canvas'); cv.width = cv.height = 256; const cx2 = cv.getContext('2d');
    const gr = cx2.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#b3322a'); gr.addColorStop(1, '#8e2620'); cx2.fillStyle = gr; cx2.fillRect(0, 0, 256, 256);
    cx2.strokeStyle = 'rgba(0,0,0,.18)'; cx2.lineWidth = 2; for (let x = 0; x < 256; x += 32) { cx2.beginPath(); cx2.moveTo(x, 0); cx2.lineTo(x, 256); cx2.stroke(); }
    cx2.fillStyle = '#e8b25a'; cx2.beginPath(); cx2.arc(128, 128, 34, 0, Math.PI * 2); cx2.fill();
    cx2.strokeStyle = '#e8b25a'; cx2.lineWidth = 7; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; cx2.beginPath(); cx2.moveTo(128 + Math.cos(a) * 46, 128 + Math.sin(a) * 46); cx2.lineTo(128 + Math.cos(a) * 70, 128 + Math.sin(a) * 70); cx2.stroke(); }
    const sailTex = new THREE.CanvasTexture(cv); sailTex.colorSpace = THREE.SRGBColorSpace;
    const sailGeo = new THREE.PlaneGeometry(1.9, 1.7, 8, 8); const sp = sailGeo.attributes.position; for (let i = 0; i < sp.count; i++) sp.setZ(i, (1 - Math.pow(sp.getX(i) / .95, 2)) * .22 * (.6 + .4 * (sp.getY(i) + .85) / 1.7)); sailGeo.computeVertexNormals();
    const sail = new THREE.Mesh(sailGeo, new THREE.MeshStandardMaterial({ map: sailTex, roughness: .9, side: THREE.DoubleSide })); sail.position.set(0, 2.4, .2); sail.rotation.y = Math.PI / 2; g.add(sail);
    const rope = new THREE.LineBasicMaterial({ color: '#2a1f16' });
    for (const [a, b] of [[[0, 3.5, .15], [0, .6, 2.0]], [[0, 3.5, .15], [0, .6, -1.9]], [[0, 3.3, 1.2], [.45, .6, .9]], [[0, 3.3, -.9], [-.45, .6, -.6]]]) g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...a), new THREE.Vector3(...b)]), rope));
    for (let i = 0; i < 6; i++) for (const s of [-1, 1]) { const oar = new THREE.Mesh(new THREE.CylinderGeometry(.018, .018, 1.6, 5), wood); oar.position.set(s * .8, .3, -1.2 + i * .48); oar.rotation.set(0, 0, s * 1.05); g.add(oar); }
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    const shipRot = -2.35;
    g.position.copy(SHIP_POS); g.rotation.y = shipRot;
    const slot = makeSlot('ship', [{ x: SHIP_POS.x, z: SHIP_POS.z, y: 0, rot: shipRot, s: 1 }], g, 3.6);
    world.updaters.push(t => {
      const bob = Math.sin(t * 1.3) * .06, roll = Math.sin(t * 1.1 + 1) * .035, pitch = Math.sin(t * .9) * .025;
      for (const o of [g, slot.imported]) if (o) { o.position.y = bob - .08; o.rotation.set(pitch, shipRot, roll, 'YXZ'); }
    });
    world.ship = g;
    obst(SHIP_POS.x, SHIP_POS.z, 1.2, 'ship');

    // jetty
    const jg = new THREE.Group(); const plankM = new THREE.MeshStandardMaterial({ color: '#8a6a48', roughness: .9 });
    const dir = new THREE.Vector2().subVectors(JETTY_B, JETTY_A), L = dir.length(), ang = Math.atan2(dir.x, dir.y);
    for (let i = 0; i < 14; i++) {
      const t = (i + .5) / 14, x = JETTY_A.x + dir.x * t, z = JETTY_A.y + dir.y * t;
      const pl = new THREE.Mesh(new THREE.BoxGeometry(JETTY_HALF * 2.1, .06, L / 14 * .85), plankM); pl.position.set(x, .4, z); pl.rotation.y = ang; jg.add(pl);
      if (i % 3 === 0) for (const s of [-1, 1]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(.06, .07, 1.2, 6), plankM); post.position.set(x + Math.cos(ang) * s * JETTY_HALF, -.1, z - Math.sin(ang) * s * JETTY_HALF); jg.add(post); }
    }
    jg.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    scene.add(jg);
  }

  // ---------------- grass tufts and flowers ----------------
  {
    const blade = new THREE.ConeGeometry(.035, .28, 3); blade.translate(0, .14, 0);
    const tuft = mergeGeometries([0, 1, 2].map(i => { const b = blade.clone(); b.rotateZ((i - 1) * .35); b.rotateY(i * 2.1); return b; }));
    const n = 1400, im = new THREE.InstancedMesh(tuft, new THREE.MeshStandardMaterial({ color: '#789c45', roughness: 1 }), n);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pv = new THREE.Vector3(), c = new THREE.Color();
    let k = 0;
    for (let tries = 0; tries < 20000 && k < n; tries++) {
      const x = R(-12, 12), z = R(-12, 12), d = shoreDist(x, z);
      if (d < 1.9 || pathDist(x, z) < .9 || Math.hypot(x - CAVE_CENTER.x, z - CAVE_CENTER.y) < 2.8) continue;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), R(0, 6)); sc.setScalar(R(.7, 1.4)); pv.set(x, height(x, z) - .02, z); m.compose(pv, q, sc);
      im.setMatrixAt(k, m); im.setColorAt(k, c.setHSL(R(.2, .27), R(.35, .5), R(.32, .45))); k++;
    }
    im.count = k; im.receiveShadow = true; scene.add(im);
    const fl = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.045, 0), new THREE.MeshStandardMaterial({ color: '#fbf6ea', roughness: .7 }), 160);
    k = 0;
    for (let tries = 0; tries < 5000 && k < 160; tries++) { const x = R(-11, 11), z = R(-11, 11); if (shoreDist(x, z) < 2 || pathDist(x, z) < .8) continue; m.makeTranslation(x, height(x, z) + .12, z); fl.setMatrixAt(k++, m); }
    fl.count = k; scene.add(fl);
  }

  // ---------------- birds ----------------
  {
    const birds = [];
    const wingGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(.35, 0, -.1), new THREE.Vector3(0, 0, -.18)]); wingGeo.computeVertexNormals();
    const bm = new THREE.MeshBasicMaterial({ color: '#f4f1e8', side: THREE.DoubleSide });
    for (let i = 0; i < 6; i++) {
      const b = new THREE.Group(), l = new THREE.Mesh(wingGeo, bm), r = new THREE.Mesh(wingGeo, bm); r.scale.x = -1; b.add(l, r);
      b.userData = { l, r, rad: R(6, 13), h: R(5, 8), sp: R(.15, .3) * (rand() < .5 ? -1 : 1), ph: R(0, 6), cx: R(-4, 4), cz: R(-4, 4) };
      scene.add(b); birds.push(b);
    }
    world.updaters.push(t => birds.forEach(b => {
      const u = b.userData, a = t * u.sp + u.ph;
      b.position.set(u.cx + Math.cos(a) * u.rad, u.h + Math.sin(t * .7 + u.ph) * .4, u.cz + Math.sin(a) * u.rad);
      b.rotation.y = -a + (u.sp > 0 ? 0 : Math.PI);
      const f = Math.sin(t * 9 + u.ph) * .6; u.l.rotation.z = f; u.r.rotation.z = -f;
    }));
  }

  // ---------------- static clearance for navigation ----------------
  world.staticClearance = (x, z) => {
    let c = shoreDist(x, z) - .25;
    const cj = onJetty(x, z) + (shoreDist(x, z) > -.2 ? 0 : 0);
    if (cj > c) c = cj;
    for (const o of world.obstacles) { const d = Math.hypot(x - o.x, z - o.z) - o.r; if (d < c) c = d; }
    return c;
  };
  world.update = (t, dt) => world.updaters.forEach(f => f(t, dt));
  return world;
}
