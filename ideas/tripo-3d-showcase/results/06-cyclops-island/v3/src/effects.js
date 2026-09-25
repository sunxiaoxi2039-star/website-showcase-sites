// effects.js — pooled combat telegraphs, shockwaves, flash, cracks, dust, sparks, rock fragments, dodge trail, camera shake.
import * as THREE from 'three';
import { groundY } from './world.js';

const ORANGE = new THREE.Color('#ff8a2a'), GOLD = new THREE.Color('#ffd35a');

export function createEffects(scene) {
  const fx = { shake: 0 };
  const flatMat = (color, opacity) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, depthTest: false, side: THREE.DoubleSide });

  // ---------- telegraph (lock circle) ----------
  const tele = new THREE.Group(); tele.visible = false; tele.renderOrder = 10; scene.add(tele);
  const teleRing = new THREE.Mesh(new THREE.RingGeometry(.94, 1, 64).rotateX(-Math.PI / 2), flatMat(ORANGE, .95));
  const teleFill = new THREE.Mesh(new THREE.CircleGeometry(1, 64).rotateX(-Math.PI / 2), flatMat(ORANGE, .28));
  const teleBase = new THREE.Mesh(new THREE.CircleGeometry(1, 64).rotateX(-Math.PI / 2), flatMat('#40160a', .22));
  const teleCharged = new THREE.Mesh(new THREE.RingGeometry(1.08, 1.16, 64, 1).rotateX(-Math.PI / 2), flatMat(GOLD, .9));
  const cross = new THREE.Mesh(new THREE.RingGeometry(.1, .16, 24).rotateX(-Math.PI / 2), flatMat(ORANGE, .9));
  [teleBase, teleFill, teleRing, teleCharged, cross].forEach((m, i) => { m.renderOrder = 10 + i; tele.add(m); });
  fx.showTelegraph = (x, z, r, charged) => {
    tele.visible = true; tele.position.set(x, groundY(x, z) + .06, z); tele.scale.setScalar(r);
    teleCharged.visible = charged; cross.scale.setScalar(1 / r);
    teleRing.material.color.copy(charged ? GOLD : ORANGE); teleFill.material.color.copy(charged ? GOLD : ORANGE);
  };
  fx.telegraphProgress = (k, t) => { teleFill.scale.setScalar(Math.max(.01, k)); teleRing.material.opacity = .7 + .3 * Math.sin(t * 20); teleCharged.rotation.y = t * 1.5; };
  fx.hideTelegraph = () => { tele.visible = false; };

  // ---------- shockwave rings (pooled) ----------
  const waves = [];
  for (let i = 0; i < 3; i++) {
    const g = new THREE.Group(); g.visible = false; scene.add(g);
    const band = new THREE.Mesh(new THREE.RingGeometry(.9, 1, 96).rotateX(-Math.PI / 2), flatMat(GOLD, .9)); band.renderOrder = 20;
    const glow = new THREE.Mesh(new THREE.RingGeometry(.8, 1.06, 96).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffb347', transparent: true, opacity: .35, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false })); glow.renderOrder = 19;
    g.add(glow, band); waves.push({ g, band, glow, active: false });
  }
  fx.spawnWave = (x, z) => { const w = waves.find(w => !w.active) || waves[0]; w.active = true; w.g.visible = true; w.g.position.set(x, groundY(x, z) + .08, z); return w; };
  fx.setWave = (w, r, width, alpha) => { const s = Math.max(.01, r); w.g.scale.setScalar(s); w.band.geometry.dispose(); w.band.geometry = new THREE.RingGeometry(Math.max(0, 1 - width / s), 1 + width / s * .3, 96).rotateX(-Math.PI / 2); w.band.material.opacity = .95 * alpha; w.glow.material.opacity = .35 * alpha; };
  fx.endWave = w => { w.active = false; w.g.visible = false; };

  // ---------- impact flash ----------
  const flashLight = new THREE.PointLight('#ffb35a', 0, 9, 1.6); scene.add(flashLight);
  const flashDisc = new THREE.Mesh(new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#fff0c8', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false }));
  flashDisc.renderOrder = 30; scene.add(flashDisc);
  let flashT = 0;

  // ---------- ground cracks (pooled decals) ----------
  const cracks = [];
  for (let i = 0; i < 6; i++) {
    const pts = [];
    for (let k = 0; k < 9; k++) {
      let a = k / 9 * Math.PI * 2 + Math.random() * .4, r = .15, x = 0, z = 0;
      for (let s = 0; s < 5; s++) { const nr = r + .28 + Math.random() * .2; a += (Math.random() - .5) * .6; const nx = Math.cos(a) * nr, nz = Math.sin(a) * nr; pts.push(x, 0, z, nx, 0, nz); x = nx; z = nz; r = nr; }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const l = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: '#3a2412', transparent: true, opacity: 0, depthTest: false })); l.renderOrder = 9; l.visible = false; scene.add(l);
    cracks.push({ l, t: 0 });
  }
  let crackIdx = 0;

  // ---------- particles (dust / sparks / trail) ----------
  const PN = 700, pPos = new Float32Array(PN * 3), pCol = new Float32Array(PN * 3), pSize = new Float32Array(PN), pAlpha = new Float32Array(PN);
  const parts = Array.from({ length: PN }, () => ({ life: 0, max: 1, vx: 0, vy: 0, vz: 0, g: 0, drag: 0, size: 1, grow: 0, c: new THREE.Color() }));
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  pGeo.setAttribute('size', new THREE.BufferAttribute(pSize, 1)); pGeo.setAttribute('alpha', new THREE.BufferAttribute(pAlpha, 1));
  const pMat = new THREE.ShaderMaterial({
    uniforms: { uScale: { value: 30 } }, transparent: true, depthWrite: false,
    vertexShader: `attribute float size; attribute float alpha; attribute vec3 color; varying vec3 vC; varying float vA; uniform float uScale;
      void main(){ vC = color; vA = alpha; vec4 mv = modelViewMatrix * vec4(position,1.); gl_Position = projectionMatrix * mv; gl_PointSize = size * uScale; }`,
    fragmentShader: `varying vec3 vC; varying float vA; void main(){ float d = length(gl_PointCoord - .5); if (d > .5) discard; gl_FragColor = vec4(vC, vA * smoothstep(.5, .15, d)); }`,
  });
  const points = new THREE.Points(pGeo, pMat); points.frustumCulled = false; points.renderOrder = 25; scene.add(points);
  let pNext = 0;
  function emit(x, y, z, o) {
    const p = parts[pNext]; pNext = (pNext + 1) % PN;
    p.life = p.max = o.life; p.x = x; p.y = y; p.z = z; p.vx = o.vx; p.vy = o.vy; p.vz = o.vz; p.g = o.g || 0; p.drag = o.drag || 0; p.size = o.size; p.grow = o.grow || 0; p.c.set(o.color); p.a0 = o.alpha ?? 1;
  }
  fx.dust = (x, z, n = 40, rad = 1, color = '#cdb58b') => {
    const y = groundY(x, z);
    for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, s = .8 + Math.random() * 2.4; emit(x + Math.cos(a) * rad * .3, y + .1, z + Math.sin(a) * rad * .3, { life: .9 + Math.random() * .8, vx: Math.cos(a) * s, vy: .4 + Math.random() * 1.1, vz: Math.sin(a) * s, drag: 2.4, size: .3 + Math.random() * .3, grow: .35, color, alpha: .2 }); }   // light enough that overlapping puffs never form an opaque blob
  };
  fx.sparks = (x, z, n = 26) => {
    const y = groundY(x, z) + .1;
    for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, s = 2 + Math.random() * 4; emit(x, y, z, { life: .35 + Math.random() * .4, vx: Math.cos(a) * s, vy: 2 + Math.random() * 3.5, vz: Math.sin(a) * s, g: 9, size: .09 + Math.random() * .06, color: Math.random() < .5 ? '#ffd27a' : '#ff8a3a' }); }
  };
  fx.trail = (x, y, z) => emit(x, y + .25, z, { life: .35, vx: 0, vy: .2, vz: 0, size: .32, grow: -.4, color: '#f5e6c0', alpha: .5 });
  fx.hurt = (x, y, z) => { for (let i = 0; i < 14; i++) { const a = Math.random() * 6.283; emit(x, y + .4, z, { life: .45, vx: Math.cos(a) * 1.6, vy: 1 + Math.random() * 1.5, vz: Math.sin(a) * 1.6, g: 5, size: .1, color: '#e0443a' }); } };
  fx.pickup = (x, y, z) => { for (let i = 0; i < 22; i++) { const a = Math.random() * 6.283; emit(x, y + .2, z, { life: .8, vx: Math.cos(a) * .6, vy: 1.4 + Math.random(), vz: Math.sin(a) * .6, drag: 1.5, size: .1, color: '#ffe39a' }); } };
  fx.zzz = (x, y, z) => emit(x + (Math.random() - .5) * .2, y, z, { life: 2.2, vx: .15, vy: .35, vz: -.05, size: .12, grow: .1, color: '#f4ecd8', alpha: .3 });   // v3: fainter, so puffs piling up at low fps never hide the giant's face
  fx.embers = (x, y, z) => emit(x + (Math.random() - .5) * .3, y, z + (Math.random() - .5) * .3, { life: 1.2, vx: (Math.random() - .5) * .2, vy: .6 + Math.random() * .4, vz: (Math.random() - .5) * .2, size: .05, color: '#ffb050' });

  // ---------- rock fragments ----------
  const RN = 48, rocks = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.07, 0), new THREE.MeshStandardMaterial({ color: '#a8977a', roughness: 1, flatShading: true }), RN);
  rocks.castShadow = true; rocks.frustumCulled = false; scene.add(rocks);
  const rockS = Array.from({ length: RN }, () => ({ life: 0 })); let rNext = 0;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), pv = new THREE.Vector3();
  fx.rocks = (x, z, n = 14, fromY = null) => {
    for (let i = 0; i < n; i++) {
      const r = rockS[rNext]; rNext = (rNext + 1) % RN; const a = Math.random() * 6.283, s = 1 + Math.random() * 2.5;
      Object.assign(r, { life: 1.6, x, y: (fromY ?? groundY(x, z)) + .2, z, vx: Math.cos(a) * s, vy: 2.5 + Math.random() * 3, vz: Math.sin(a) * s, rx: Math.random() * 6, ry: Math.random() * 6, s: .6 + Math.random() * 1.2 });
    }
  };

  fx.impact = (x, z, r, charged) => {
    const y = groundY(x, z);
    flashLight.position.set(x, y + 1.2, z); flashT = .28;
    flashDisc.position.set(x, y + .07, z); flashDisc.scale.setScalar(r * 1.1);
    const c = cracks[crackIdx]; crackIdx = (crackIdx + 1) % cracks.length;
    c.l.visible = true; c.t = 3.2; c.l.position.set(x, y + .05, z); c.l.scale.setScalar(r * .75); c.l.rotation.y = Math.random() * 6;
    fx.dust(x, z, charged ? 70 : 46, r); fx.sparks(x, z, charged ? 40 : 24); fx.rocks(x, z, charged ? 20 : 12);
    fx.shake = Math.max(fx.shake, charged ? .5 : .32);
  };

  fx.reset = () => {
    fx.hideTelegraph(); waves.forEach(w => fx.endWave(w)); parts.forEach(p => p.life = 0); rockS.forEach(r => r.life = 0);
    cracks.forEach(c => { c.t = 0; c.l.visible = false; }); flashT = 0; fx.shake = 0;
  };

  fx.update = (dt, camZoom) => {
    // particles
    pMat.uniforms.uScale.value = camZoom * 16 * Math.min(2, window.devicePixelRatio || 1);
    for (let i = 0; i < PN; i++) {
      const p = parts[i];
      if (p.life <= 0) { pAlpha[i] = 0; continue; }
      p.life -= dt; const k = Math.max(0, p.life / p.max);
      p.vx *= 1 - p.drag * dt; p.vz *= 1 - p.drag * dt; p.vy = p.vy * (1 - p.drag * dt) - p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      pPos[i * 3] = p.x; pPos[i * 3 + 1] = p.y; pPos[i * 3 + 2] = p.z;
      pCol[i * 3] = p.c.r; pCol[i * 3 + 1] = p.c.g; pCol[i * 3 + 2] = p.c.b;
      pSize[i] = Math.max(.01, p.size * (1 + p.grow * (1 - k))); pAlpha[i] = p.a0 * Math.min(1, k * 2.2);
    }
    pGeo.attributes.position.needsUpdate = pGeo.attributes.color.needsUpdate = pGeo.attributes.size.needsUpdate = pGeo.attributes.alpha.needsUpdate = true;
    // rocks
    for (let i = 0; i < RN; i++) {
      const r = rockS[i];
      if (r.life <= 0) { m4.makeScale(0, 0, 0); rocks.setMatrixAt(i, m4); continue; }
      r.life -= dt; r.vy -= 12 * dt; r.x += r.vx * dt; r.y += r.vy * dt; r.z += r.vz * dt;
      const gy = groundY(r.x, r.z) + .04; if (r.y < gy) { r.y = gy; r.vy *= -.35; r.vx *= .6; r.vz *= .6; }
      r.rx += dt * 6; r.ry += dt * 4; e.set(r.rx, r.ry, 0); q.setFromEuler(e); sc.setScalar(r.s * Math.min(1, r.life * 2)); pv.set(r.x, r.y, r.z);
      m4.compose(pv, q, sc); rocks.setMatrixAt(i, m4);
    }
    rocks.instanceMatrix.needsUpdate = true;
    // flash & cracks
    flashT = Math.max(0, flashT - dt); flashLight.intensity = flashT / .28 * 40; flashDisc.material.opacity = (flashT / .28) ** 2 * .75;
    for (const c of cracks) { if (c.t <= 0) continue; c.t -= dt; c.l.material.opacity = Math.min(.85, c.t * .6); if (c.t <= 0) c.l.visible = false; }
    fx.shake = Math.max(0, fx.shake - dt * 1.4);
  };
  return fx;
}
