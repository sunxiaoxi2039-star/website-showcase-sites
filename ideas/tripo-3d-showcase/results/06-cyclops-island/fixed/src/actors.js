// actors.js — articulated procedural Odysseus / crew / Polyphemus with pose-blended procedural animation,
// plus the skinned-replacement path (AnimationMixer, clip matching, SkeletonUtils clones, root-motion stripping).
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: .7, ...o });
const M = {
  skin: mat('#c99a74', { roughness: .8 }), bronze: mat('#b98a3e', { roughness: .32, metalness: .85 }), crimson: mat('#a3262a', { roughness: .8 }),
  ivory: mat('#ece2cc', { roughness: .9 }), terracotta: mat('#b5553a', { roughness: .85, side: THREE.DoubleSide }), leather: mat('#5b3c26', { roughness: .8 }),
  beard: mat('#3b2a1e', { roughness: 1 }), wood: mat('#6b4a2f', { roughness: .85 }), armour: mat('#8e6d3c', { roughness: .45, metalness: .6 }),
  gSkin: mat('#b88660', { roughness: .75 }), gHair: mat('#2a1f18', { roughness: 1, flatShading: true }), fur: mat('#6e5238', { roughness: 1, flatShading: true }),
  eyeW: mat('#f4efe3', { roughness: .3 }), iris: mat('#3a2410', { roughness: .3 }), club: mat('#5e4128', { roughness: .95, flatShading: true }),
};
const mesh = (geo, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; return o; };
const limb = (len, r0, r1, m) => { const g = new THREE.CylinderGeometry(r1, r0, len, 8); g.translate(0, -len / 2, 0); return mesh(g, m); };
const joint = (parent, x, y, z) => { const j = new THREE.Group(); j.position.set(x, y, z); parent.add(j); return j; };

// ---------------- skeleton shared by hero and giant ----------------
function skeleton(d) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const J = {};
  J.hips = joint(body, 0, d.hipY, 0);
  J.torso = joint(J.hips, 0, 0, 0);
  J.head = joint(J.torso, 0, d.neckY, 0);
  J.shL = joint(J.torso, d.shX, d.shY, 0); J.shR = joint(J.torso, -d.shX, d.shY, 0);
  J.elL = joint(J.shL, 0, -d.upper, 0); J.elR = joint(J.shR, 0, -d.upper, 0);
  J.legL = joint(J.hips, d.legX, 0, 0); J.legR = joint(J.hips, -d.legX, 0, 0);
  J.knL = joint(J.legL, 0, -d.thigh, 0); J.knR = joint(J.legR, 0, -d.thigh, 0);
  return { root, body, J };
}

export function buildHero(variant = 0) {
  const d = { hipY: .5, neckY: .36, shX: .16, shY: .31, upper: .19, fore: .18, legX: .075, thigh: .25, shin: .23 };
  const { root, body, J } = skeleton(d);
  // torso: armour + tunic skirt
  J.torso.add(mesh(new THREE.CylinderGeometry(.14, .12, .3, 10).translate(0, .18, 0), M.armour));
  J.torso.add(mesh(new THREE.CylinderGeometry(.155, .14, .06, 10).translate(0, .3, 0), M.bronze));
  J.hips.add(mesh(new THREE.CylinderGeometry(.13, .19, .2, 10, 1, true).translate(0, -.06, 0), M.ivory));
  J.hips.add(mesh(new THREE.TorusGeometry(.13, .02, 6, 14).rotateX(Math.PI / 2).translate(0, .03, 0), M.leather));
  // sheathed sword on the hip
  const sheath = mesh(new THREE.BoxGeometry(.03, .26, .045), M.leather, .15, -.08, -.03); sheath.rotation.z = .25; J.hips.add(sheath);
  J.hips.add(mesh(new THREE.BoxGeometry(.08, .015, .02), M.bronze, .12, .05, -.03));
  // head, beard, Corinthian helmet with crimson crest
  J.head.add(mesh(new THREE.SphereGeometry(.085, 12, 10).translate(0, .09, 0), M.skin));
  J.head.add(mesh(new THREE.SphereGeometry(.07, 8, 6).scale(1, 1.1, .8).translate(0, .03, .05), M.beard));
  const helm = mesh(new THREE.SphereGeometry(.098, 14, 10, 0, Math.PI * 2, 0, Math.PI * .62).translate(0, .1, -.005), M.bronze); J.head.add(helm);
  J.head.add(mesh(new THREE.BoxGeometry(.018, .09, .03), M.bronze, 0, .07, .09));
  for (const s of [-1, 1]) J.head.add(mesh(new THREE.BoxGeometry(.02, .11, .07), M.bronze, s * .085, .06, .03));
  const crest = mesh(new THREE.TorusGeometry(.1, .028, 6, 14, Math.PI).rotateY(Math.PI / 2).scale(1, 1, 1.1).translate(0, .17, -.01), variant ? M.terracotta : M.crimson); J.head.add(crest);
  // arms
  for (const [sh, el, s] of [[J.shL, J.elL, 1], [J.shR, J.elR, -1]]) {
    sh.add(mesh(new THREE.SphereGeometry(.05, 8, 6), M.bronze));
    sh.add(limb(d.upper, .038, .035, M.skin));
    el.add(limb(d.fore, .033, .028, M.skin));
    el.add(mesh(new THREE.CylinderGeometry(.036, .036, .07, 8).translate(0, -.09, 0), M.leather));
    el.add(mesh(new THREE.SphereGeometry(.03, 6, 5), M.skin, 0, -d.fore - .01, 0));
    if (s === 1) { const shield = mesh(new THREE.CylinderGeometry(.13, .13, .025, 16).rotateZ(Math.PI / 2), M.bronze, .05, -.1, 0); el.add(shield); shield.add(mesh(new THREE.TorusGeometry(.13, .012, 5, 18).rotateY(Math.PI / 2), M.crimson)); }
  }
  // legs + sandals
  for (const [lg, kn] of [[J.legL, J.knL], [J.legR, J.knR]]) {
    lg.add(limb(d.thigh, .055, .045, M.skin));
    kn.add(limb(d.shin, .042, .032, M.skin));
    kn.add(mesh(new THREE.CylinderGeometry(.038, .038, .1, 8).translate(0, -.13, 0), M.leather));
    kn.add(mesh(new THREE.BoxGeometry(.06, .025, .12), M.leather, 0, -d.shin - .01, .025));
  }
  // cape hangs from the shoulders and flutters with speed
  const capeGeo = new THREE.PlaneGeometry(.3, .44, 3, 6); capeGeo.translate(0, -.22, 0);
  const cape = new THREE.Mesh(capeGeo, variant === 0 ? M.terracotta : mat(['#b5553a', '#8f3b2e', '#a35a30', '#944a35'][variant], { side: THREE.DoubleSide, roughness: .85 }));
  cape.castShadow = true; cape.position.set(0, .33, -.1); J.torso.add(cape);
  J.cape = cape;
  root.scale.setScalar(.82);
  return { root, body, J, dims: d, kind: 'hero' };
}

export function buildGiant() {
  const d = { hipY: .5, neckY: .4, shX: .22, shY: .34, upper: .2, fore: .2, legX: .1, thigh: .24, shin: .24 };
  const { root, body, J } = skeleton(d);
  J.torso.add(mesh(new THREE.SphereGeometry(.2, 14, 10).scale(1.05, 1.12, .8).translate(0, .2, 0), M.gSkin));
  J.torso.add(mesh(new THREE.SphereGeometry(.17, 12, 8).scale(1, .8, .85).translate(0, .06, .04), M.gSkin));
  J.hips.add(mesh(new THREE.CylinderGeometry(.18, .22, .16, 9, 1).translate(0, -.03, 0), M.fur));
  for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; J.hips.add(mesh(new THREE.ConeGeometry(.05, .12, 4).rotateX(Math.PI), M.fur, Math.cos(a) * .19, -.13, Math.sin(a) * .19)); }
  J.torso.add(mesh(new THREE.BoxGeometry(.05, .4, .02).rotateZ(.7).translate(0, .18, .15), M.leather));
  // head: exactly one central eye, curly hair and beard
  J.head.add(mesh(new THREE.SphereGeometry(.12, 14, 12).scale(1, 1.05, .95).translate(0, .1, 0), M.gSkin));
  J.head.add(mesh(new THREE.SphereGeometry(.042, 12, 10).translate(0, .13, .1), M.eyeW));
  J.head.add(mesh(new THREE.SphereGeometry(.022, 8, 8).translate(0, .13, .135), M.iris));
  J.head.add(mesh(new THREE.BoxGeometry(.11, .02, .03).translate(0, .18, .105), M.gHair));
  J.head.add(mesh(new THREE.SphereGeometry(.02, 6, 5).translate(0, .085, .12), M.gSkin));
  for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; J.head.add(mesh(new THREE.IcosahedronGeometry(.045, 0), M.gHair, Math.cos(a) * .1, .17 + Math.sin(i * 1.7) * .03, Math.sin(a) * .09 - .03)); }
  for (let i = 0; i < 9; i++) { const a = (i / 8 - .5) * 2.4; J.head.add(mesh(new THREE.IcosahedronGeometry(.04, 0), M.gHair, Math.sin(a) * .09, .01 + Math.cos(i * 2.3) * .02, Math.cos(a) * .08 + .02)); }
  for (const [sh, el, s] of [[J.shL, J.elL, 1], [J.shR, J.elR, -1]]) {
    sh.add(mesh(new THREE.SphereGeometry(.08, 10, 8), M.gSkin));
    sh.add(limb(d.upper, .075, .062, M.gSkin));
    el.add(limb(d.fore, .06, .05, M.gSkin));
    el.add(mesh(new THREE.SphereGeometry(.058, 8, 6), M.gSkin, 0, -d.fore - .02, 0));
    if (s === -1) {
      const club = new THREE.Group(); club.position.set(0, -d.fore - .03, 0); club.rotation.x = Math.PI / 2; el.add(club);
      club.add(mesh(new THREE.CylinderGeometry(.06, .025, .62, 8).translate(0, .26, 0), M.club));
      for (let i = 0; i < 5; i++) club.add(mesh(new THREE.IcosahedronGeometry(.03, 0), M.club, Math.cos(i * 1.3) * .05, .42 + i * .04, Math.sin(i * 1.3) * .05));
      J.club = club;
    }
  }
  for (const [lg, kn] of [[J.legL, J.knL], [J.legR, J.knR]]) {
    lg.add(limb(d.thigh, .09, .075, M.gSkin));
    kn.add(limb(d.shin, .07, .06, M.gSkin));
    kn.add(mesh(new THREE.BoxGeometry(.11, .05, .18), M.gSkin, 0, -d.shin - .015, .04));
  }
  root.scale.setScalar(2.55);
  return { root, body, J, dims: d, kind: 'giant' };
}

// ---------------- poses ----------------
const JOINTS = ['hips', 'torso', 'head', 'shL', 'shR', 'elL', 'elR', 'legL', 'legR', 'knL', 'knR'];
function blank() { const p = { hipDrop: 0, bodyTilt: 0, bodyRoll: 0 }; for (const j of JOINTS) p[j] = [0, 0, 0]; return p; }

export function heroPose(a, t) {
  const p = blank();
  const ph = a.phase, sp = a.moveBlend, run = a.runBlend;
  const amp = .45 + .35 * run, sw = Math.sin(ph);
  p.legL[0] = sw * amp * sp; p.legR[0] = -sw * amp * sp;
  p.knL[0] = Math.max(0, -Math.cos(ph)) * (.6 + .5 * run) * sp; p.knR[0] = Math.max(0, Math.cos(ph)) * (.6 + .5 * run) * sp;
  p.shL[0] = -sw * (.4 + .4 * run) * sp; p.shR[0] = sw * (.4 + .4 * run) * sp;
  p.elL[0] = -(.25 + .6 * run) * sp - .15; p.elR[0] = -(.25 + .6 * run) * sp - .15;
  p.shL[2] = .12; p.shR[2] = -.12;
  p.torso[0] = (.08 + .2 * run) * sp; p.head[0] = -p.torso[0] * .6;
  p.hipDrop = -Math.abs(Math.cos(ph)) * .03 * sp + Math.sin(t * 2 + a.seed) * .006 * (1 - sp);
  p.torso[1] = sw * .12 * sp;
  if (a.hurt > 0) { p.torso[0] -= .45 * a.hurt; p.head[0] -= .3 * a.hurt; p.shL[2] += .5 * a.hurt; p.shR[2] -= .5 * a.hurt; }
  if (a.state === 'dodge') {
    const k = Math.min(1, a.stateT / .34);
    p.bodyTilt = k * Math.PI * 2; p.hipDrop = -.18 * Math.sin(k * Math.PI);
    for (const j of ['legL', 'legR']) p[j][0] = -1.3; for (const j of ['knL', 'knR']) p[j][0] = 2; p.shL[0] = p.shR[0] = -1.2; p.torso[0] = .6;
  }
  if (a.state === 'take') { const k = Math.sin(Math.min(1, a.stateT / .5) * Math.PI); p.torso[0] += .7 * k; p.shR[0] -= 1.1 * k; p.knL[0] += .5 * k; p.knR[0] += .5 * k; p.hipDrop -= .08 * k; }
  if (a.state === 'fallen') { p.bodyTilt = -Math.PI / 2 * Math.min(1, a.stateT * 3); p.hipDrop = -.35 * Math.min(1, a.stateT * 3); }
  if (a.state === 'cheer') { const w = Math.sin(t * 8 + a.seed); p.shL[0] = -2.8 + w * .2; p.shR[0] = -2.8 - w * .2; p.hipDrop = Math.abs(w) * .05; }
  return p;
}

export function giantPose(a, t) {
  const p = blank();
  const s = a.state, k = a.stateT;
  if (s === 'sleeping' || s === 'waking') {
    // slumped sitting, legs forward, chin on chest, slow breathing
    const breath = Math.sin(t * 1.4) * .04;
    const q = blank();
    q.hipDrop = -.36; q.legL = [-1.35, .15, 0]; q.legR = [-1.35, -.15, 0]; q.knL[0] = .35; q.knR[0] = .35;
    q.torso = [-.45 + breath, 0, 0]; q.head = [.55 - breath, .2, .15]; q.shL = [.1, 0, .35]; q.shR = [.1, 0, -.35]; q.elL[0] = -.4; q.elR[0] = -.3;
    if (s === 'sleeping') return q;
    const w = Math.min(1, k / 1.6), e = w * w * (3 - 2 * w);
    for (const j of JOINTS) for (let i = 0; i < 3; i++) p[j][i] = q[j][i] * (1 - e);
    p.hipDrop = q.hipDrop * (1 - e);
    if (w > .6) { const r = Math.sin((w - .6) / .4 * Math.PI); p.shL[0] -= 2.2 * r; p.shR[0] -= 2.2 * r; p.head[0] -= .5 * r; }
    return p;
  }
  const ph = a.phase, sp = a.moveBlend, sw = Math.sin(ph);
  p.legL[0] = sw * .6 * sp; p.legR[0] = -sw * .6 * sp;
  p.knL[0] = Math.max(0, -Math.cos(ph)) * .8 * sp; p.knR[0] = Math.max(0, Math.cos(ph)) * .8 * sp;
  p.shL[0] = -sw * .5 * sp; p.shR[0] = sw * .35 * sp - .25; p.shL[2] = .3; p.shR[2] = -.3; p.elL[0] = -.5; p.elR[0] = -.7;
  p.torso[0] = .22 * sp + .08; p.hipDrop = -Math.abs(Math.cos(ph)) * .04 * sp + Math.sin(t * 1.6) * .008;
  p.torso[1] = sw * .15 * sp;
  if (s === 'windup') {
    const w = Math.min(1, k / 1.12), e = 1 - (1 - w) ** 3;
    p.shR = [-2.9 * e, 0, -.2]; p.elR[0] = -1.2 * e; p.torso[0] = .1 - .45 * e; p.torso[1] = .35 * e; p.head[0] = -.2 * e;
    p.shL = [-.6 * e, 0, .6 * e]; p.legL[0] = -.35 * e; p.knL[0] = .3 * e; p.legR[0] = .25 * e; p.hipDrop = -.03 * e;
    if (a.charged) { p.shL = [-2.6 * e, 0, .1]; p.elL[0] = -1.1 * e; p.head[0] = -.4 * e; }
  } else if (s === 'impact' || s === 'recovery') {
    const w = s === 'impact' ? Math.min(1, k / .12) : 1, back = s === 'recovery' ? Math.min(1, k / .85) : 0, e = (1 - back);
    p.shR = [(-2.9 + (2.9 - 1.1) * w) * e + p.shR[0] * back, 0, -.2 * e]; p.elR[0] = -.1 * e - .7 * back; p.torso[0] = (.1 + .75 * w) * e + .08 * back; p.torso[1] = -.2 * e;
    p.legL[0] = -.7 * e; p.knL[0] = .9 * e; p.legR[0] = .45 * e; p.knR[0] = .3 * e; p.hipDrop = -.12 * e; p.head[0] = .2 * e;
    if (a.charged) { p.shL = [(-2.6 + 1.6 * w) * e, 0, .1]; }
  } else if (s === 'terminal') {
    const r = Math.sin(t * 3); p.shL = [-2.5 + r * .2, 0, .4]; p.shR = [-2.4 - r * .2, 0, -.4]; p.head[0] = -.5; p.torso[0] = -.25;
  }
  return p;
}

export function applyPose(fig, pose, dt, rate = 14) {
  const k = 1 - Math.exp(-rate * dt);
  for (const j of JOINTS) { const r = fig.J[j].rotation; r.x += (pose[j][0] - r.x) * k; r.y += (pose[j][1] - r.y) * k; r.z += (pose[j][2] - r.z) * k; }
  fig.J.hips.position.y += (fig.dims.hipY + pose.hipDrop - fig.J.hips.position.y) * k;
  // whole-body roll for dodge is driven directly (it spins past 2π)
  fig.body.rotation.x = pose.bodyTilt;
  fig.body.position.y = pose.bodyTilt ? Math.abs(Math.sin(pose.bodyTilt / 2)) * .15 : 0;
}

// ---------------- imported model support ----------------
export function normalizeModel(object, targetHeight) {
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object), size = box.getSize(new THREE.Vector3());
  const s = targetHeight / Math.max(1e-4, size.y);
  const wrap = new THREE.Group(); wrap.add(object);
  object.scale.multiplyScalar(s);
  object.updateMatrixWorld(true);
  const b2 = new THREE.Box3().setFromObject(object), c = b2.getCenter(new THREE.Vector3());
  object.position.x -= c.x; object.position.z -= c.z; object.position.y -= b2.min.y;   // feet on the ground, centred on the collision proxy
  object.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; if (o.material) o.material.envMapIntensity = 1; } });
  return wrap;
}

const CLIP_ALIASES = {
  idle: /idle|stand|breath/i, walk: /walk/i, run: /run|sprint|jog/i, dodge: /dodge|roll|evade|dash/i,
  sleep: /sleep|lie|rest/i, wake: /wake|get.?up|rise|stand.?up/i, attack: /attack|slam|strike|smash|swing|hit(?!_react)/i,
  hurt: /hurt|damage|react|hit.?react/i, die: /die|death|dead/i, cheer: /cheer|victory|celebrate|roar/i,
};
// strip horizontal root motion so gameplay owns translation (no doubled movement)
function stripRootMotion(clip) {
  for (const tr of clip.tracks) {
    if (!tr.name.endsWith('.position')) continue;
    const bone = tr.name.split('.')[0].toLowerCase();
    if (!/hip|pelvis|root|armature|mixamorig:hips/.test(bone)) continue;
    const v = tr.values, x0 = v[0], z0 = v[2];
    for (let i = 0; i < v.length; i += 3) { v[i] = x0; v[i + 2] = z0; }
  }
  return clip;
}

export function makeRig(sourceScene, animations, targetHeight) {
  const clone = SkeletonUtils.clone(sourceScene);
  const wrap = normalizeModel(clone, targetHeight);
  const clips = {}, found = [];
  if (animations && animations.length) {
    for (const [key, re] of Object.entries(CLIP_ALIASES)) {
      const c = animations.find(a => re.test(a.name));
      if (c) { clips[key] = stripRootMotion(c.clone()); found.push(`${key}←"${c.name}"`); }
    }
    if (!Object.keys(clips).length) { clips.idle = stripRootMotion(animations[0].clone()); found.push(`idle←"${animations[0].name}"`); }
  }
  const animated = Object.keys(clips).length > 0;
  const rig = { object: wrap, animated, found, clips, mixer: animated ? new THREE.AnimationMixer(clone) : null, actions: {}, current: null };
  if (animated) for (const [k, c] of Object.entries(clips)) rig.actions[k] = rig.mixer.clipAction(c);
  rig.play = (name, fade = .18, timeScale = 1, once = false) => {
    const pick = rig.actions[name] || (name === 'run' && rig.actions.walk) || (name === 'walk' && rig.actions.run) || rig.actions.idle || Object.values(rig.actions)[0];
    if (!pick) return;
    pick.timeScale = timeScale;
    if (rig.current === pick) return;
    pick.reset(); pick.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat); pick.clampWhenFinished = once; pick.enabled = true;
    if (rig.current) rig.current.crossFadeTo(pick, fade, false); pick.play();
    rig.current = pick;
  };
  return rig;
}
