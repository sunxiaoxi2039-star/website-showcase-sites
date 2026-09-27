// 动物群落：按镜头周围的生境适宜度生成/回收群体；固定步长（30Hz）的转向模拟 + 平滑插值渲染。
// 行为：鱼群（分离/对齐/聚合）、礁鱼觅食低头、掠食者巡弋与追逐、猎物惊散后重聚、
// 底栖动物“走一段停一段”、螃蟹横行、呼吸空气的动物周期性上浮、鱿鱼喷射后退、水母随流脉动。
import * as THREE from 'three';
import { U, COMMON_GLSL } from './optics.js';
import { GEO } from './fauna-geo.js';
import { SPECIES } from './species.js';
import { mulberry32, clamp, smoothstep, lerp } from './noise.js';

const STEP = 1 / 30;
const tmpV = new THREE.Vector3();
const tmpV2 = new THREE.Vector3();
const tmpTo = new THREE.Vector3();
const UPW = new THREE.Vector3(0, 1, 0);

export const FAUNA_U = { uEmit: { value: 1 } };

function faunaMaterial(sp) {
  const a = sp.anim;
  const translucent = !!sp.translucent;
  const m = new THREE.ShaderMaterial({
    uniforms: {
      ...U, ...FAUNA_U,
      uBody: { value: new THREE.Vector4(a.lat || 0, a.vert || 0, a.k || 0, 0) },
      uFins: { value: new THREE.Vector4(a.flapV || 0, a.flapH || 0, a.lag || 0, a.arm || 0) },
      uMisc: { value: new THREE.Vector4(a.pulse || 0, a.legs ? 1 : 0, a.armSpeed || 1, sp.move === 'jet' ? 1 : 0) },
      uRim: { value: a.pulseRim ? 1 : 0 },
      uSpec: { value: sp.spec || 0.3 },
      uTrans: { value: translucent ? 1 : 0 },
    },
    vertexColors: true,
    side: THREE.DoubleSide,
    transparent: translucent,
    depthWrite: !translucent,
    blending: translucent ? THREE.AdditiveBlending : THREE.NormalBlending,
    vertexShader: /* glsl */`
      ${COMMON_GLSL}
      attribute float aS;
      attribute vec2 aFlap;
      attribute vec2 aArm;
      attribute float aGlow;
      attribute float aPulse;
      attribute vec4 iAnim;
      uniform vec4 uBody;
      uniform vec4 uFins;
      uniform vec4 uMisc;
      uniform float uRim;
      varying vec3 vWorld;
      varying vec3 vNrm;
      varying vec3 vCol;
      varying float vGlow;
      varying float vSeed;
      void main(){
        vec3 p = position;
        float ph = iAnim.x, eff = iAnim.y, sd = iAnim.z;
        float s = aS;
        float w = sin(ph - s * uBody.z);
        float env = s * s + 0.05;
        p.x += uBody.x * eff * w * env;
        p.y += uBody.y * eff * w * env;
        // 鳍：竖直拍动沿展向有相位滞后；侧向拍动（翻车鱼的背/臀鳍、烟灰蛸的耳鳍）
        float fe = 0.35 + eff;
        p.y += aFlap.x * uFins.x * sin(ph - aFlap.x * uFins.z) * fe;
        p.x += aFlap.y * uFins.y * sin(ph + 1.2) * fe;
        // 腕：卷曲摆动或步足交替
        if (aArm.x >= 0.0){
          float id = aArm.x, t = aArm.y;
          if (uMisc.y > 0.5){
            float lp = ph + id * 1.5708 + mod(id, 2.0) * 3.14159;
            p.y += max(sin(lp), 0.0) * t * uFins.w * eff * 1.4;
            p.z += cos(lp) * t * uFins.w * 0.8 * eff;
          } else {
            float tt = uTime * uMisc.z;
            float c1 = sin(tt + id * 1.7 + t * 4.0 + sd * 6.28);
            float c2 = cos(tt * 0.83 + id * 2.3 + t * 3.1 + sd * 3.0);
            float k = t * t * uFins.w * (0.6 + 0.6 * eff);
            p.x += c1 * k;
            p.y += c2 * k * 0.7;
            p.z += sin(tt * 0.7 + id) * k * 0.5;
          }
        }
        // 外套膜/伞体收缩
        if (aPulse > 0.0 && uMisc.x > 0.0){
          float pu = uMisc.w > 0.5 ? iAnim.w : (0.5 + 0.5 * sin(ph));
          if (uRim > 0.5) p.y -= uMisc.x * aPulse * aPulse * pu;
          else p.xy *= 1.0 - uMisc.x * aPulse * pu;
        }
        mat4 im = instanceMatrix;
        vec4 wp = modelMatrix * im * vec4(p, 1.0);
        vWorld = wp.xyz;
        vNrm = normalize(mat3(modelMatrix) * mat3(im) * normal);
        vec3 c = color;
        #ifdef USE_INSTANCING_COLOR
          if (aGlow < 0.5) c *= instanceColor;
        #endif
        vCol = c;
        vGlow = aGlow;
        vSeed = sd;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */`
      ${COMMON_GLSL}
      uniform float uSpec;
      uniform float uTrans;
      uniform float uEmit;
      varying vec3 vWorld;
      varying vec3 vNrm;
      varying vec3 vCol;
      varying float vGlow;
      varying float vSeed;
      void main(){
        vec3 n = normalize(vNrm);
        if (!gl_FrontFacing) n = -n;
        vec3 v = normalize(uCamPos - vWorld);
        vec3 col = shadeUnder(vCol, vWorld, n, 0.85 + 0.15 * n.y, 0.35);
        float d = max(-vWorld.y, 0.0);
        // 鳞片的镜面反射：阳光（折射后）与潜水灯
        vec3 r = reflect(-v, n);
        float fres = 0.25 + 0.75 * pow(1.0 - max(dot(n, v), 0.0), 3.0);
        vec3 spec = uSunCol * uRefrSun.y * exp(-uKd * d) * pow(max(dot(r, uRefrSun), 0.0), 18.0) * 1.6;
        spec += downwell(d) * 0.25 * smoothstep(-0.2, 0.8, r.y) * fres;
        spec += lampLight(vWorld, n) * pow(max(dot(r, -uLampDir), 0.0), 12.0) * 2.0;
        col += spec * uSpec;
        // 生物发光
        float glowOn = vGlow * uGlow * (0.75 + 0.25 * sin(uTime * (1.5 + vSeed * 3.0) + vSeed * 40.0));
        vec3 emit = vCol * glowOn * 2.2 * uEmit;
        if (uTrans > 0.5){
          col = col * 0.45 + emit;
          col = applyWater(col, vWorld);
          float a = 0.35 + 0.65 * pow(1.0 - abs(dot(n, v)), 2.0);
          gl_FragColor = vec4(col * a, 1.0);
          return;
        }
        col += emit;
        gl_FragColor = vec4(applyWater(col, vWorld), 1.0);
      }`,
  });
  return m;
}

export class Fauna {
  constructor(world, scenery, quality = 'medium') {
    this.world = world;
    this.scenery = scenery;
    this.group = new THREE.Group();
    this.rnd = mulberry32(12345);
    this.dials = { life: 1, predators: 1, benthos: 1, jellies: 1, shoal: 1 };
    this.acc = 0;
    this.time = 0;
    this.kinds = SPECIES.map((sp, i) => {
      const geo = GEO[sp.id]();
      const mult = sp.count > 60 ? 2.2 : 2.6;
      const cap = Math.max(4, Math.ceil(sp.count * mult * 1.3 + (sp.group[1] || 1) * 2));
      const iAnim = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4);
      iAnim.setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute('iAnim', iAnim);
      const mesh = new THREE.InstancedMesh(geo, faunaMaterial(sp), cap);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
      mesh.count = 0;
      mesh.frustumCulled = false;
      mesh.renderOrder = sp.translucent ? 8 : 1;
      this.group.add(mesh);
      return { sp, idx: i, mesh, iAnim, cap, animals: [], groups: [], suit: 0, target: 0, check: this.rnd() * 0.7 };
    });
    this.animals = [];
    this.hunters = [];
    this.visible = [];
    this.fresh = true;
    this.lastCam = new THREE.Vector3(1e9, 0, 0);
    this.frustum = new THREE.Frustum();
    this.pm = new THREE.Matrix4();
    this.m4 = new THREE.Matrix4();
    this.diver = { pos: new THREE.Vector3(), active: false };
    this.counts = {};
  }

  setWorld(world) { this.world = world; this.clear(); }
  setDials(d) {
    const changed = ['life', 'predators', 'benthos', 'jellies', 'shoal'].some((k) => d[k] !== undefined && d[k] !== this.dials[k]);
    Object.assign(this.dials, d);
    if (changed) this.clear();
  }
  clear() {
    for (const k of this.kinds) { k.animals = []; k.groups = []; k.mesh.count = 0; }
    this.animals = [];
    this.fresh = true;
  }

  ctx(x, y, z) {
    const f = this.world.floorAt(x, z);
    return { x, y, z, depth: -y, floor: f, fdepth: -f, above: y - f, hab: this.world.habitat(x, z) };
  }

  dialFor(sp) {
    const d = this.dials;
    let m = d.life;
    if (sp.hunter) m *= d.predators;
    if (sp.benthos) m *= d.benthos;
    if (sp.jelly) m *= d.jellies;
    return m;
  }

  radii(camPos) {
    // 深处只有潜水灯照得到的范围才看得见：群落收拢到镜头附近
    const d = -camPos.y;
    const k = smoothstep(90, 400, d);
    return { R: lerp(75, 32, k), Rb: lerp(42, 20, k), V: lerp(42, 26, k) };
  }

  // 估计镜头周围一个物种的适宜度
  suitability(k, camPos) {
    const sp = k.sp;
    const { R, Rb, V } = this.radii(camPos);
    let s = 0;
    const n = 10;
    const benthic = sp.move === 'benthic' || sp.move === 'sessile';
    for (let i = 0; i < n; i++) {
      const a = this.rnd() * Math.PI * 2, r = Math.sqrt(this.rnd()) * (benthic ? Rb : sp.nearR ? Math.min(R, sp.nearR) : sp.near ? Math.min(R, 45) : R);
      const x = camPos.x + Math.cos(a) * r, z = camPos.z + Math.sin(a) * r;
      const f = this.world.floorAt(x, z);
      let y;
      if (benthic || sp.nearFloor) {
        y = f + (sp.nearFloor ? 1 : 0.1);
        if (Math.abs(y - camPos.y) > V) continue;
      } else {
        const lo = Math.max(f + 0.5, camPos.y - V), hi = Math.min(-0.5, camPos.y + V);
        if (hi <= lo) continue;
        y = lerp(lo, hi, this.rnd());
        if (sp.clear) {
          const y2 = clamp(f + lerp(sp.clear[0], Math.min(sp.clear[1], sp.clear[0] + 30), this.rnd()) + sp.size[1] * 0.5, lo, hi);
          s += Math.max(sp.fit(this.ctx(x, y, z)), sp.fit(this.ctx(x, y2, z)));
          continue;
        }
      }
      s += sp.fit(this.ctx(x, y, z));
    }
    return s / n;
  }

  spawnGroup(k, camPos, anywhere, camera) {
    const sp = k.sp;
    const { R, Rb, V } = this.radii(camPos);
    const benthic = sp.move === 'benthic' || sp.move === 'sessile';
    const rnd = this.rnd;
    for (let tries = 0; tries < 6; tries++) {
      const rad = benthic ? Rb : sp.nearR ? Math.min(R, sp.nearR) : sp.near ? Math.min(R, 45) : R;
      let a = rnd() * Math.PI * 2;
      // 初次生成时，多数群体放在镜头前方的视野里
      if (anywhere && camera && rnd() < 0.7) {
        const f = tmpV2.set(0, 0, -1).applyQuaternion(camera.quaternion);
        a = Math.atan2(f.z, f.x) + (rnd() - 0.5) * 1.3;
      }
      const u0 = rnd();
      const r = anywhere ? (sp.near || sp.nearR ? rad * (0.12 + 0.88 * u0 * u0) : Math.sqrt(u0) * rad * 0.95) : lerp(rad * 0.55, rad * 0.95, u0);
      let x = camPos.x + Math.cos(a) * r, z = camPos.z + Math.sin(a) * r;
      if (x * x + z * z > 2300 * 2300) continue;
      let f = this.world.floorAt(x, z);
      let y;
      if (sp.vent) {
        const vents = this.scenery.vents;
        if (!vents.length) return false;
        const v = vents[Math.floor(rnd() * vents.length)];
        x = v.x + (rnd() - 0.5) * 3; z = v.z + (rnd() - 0.5) * 3;
        f = this.world.floorAt(x, z);
        y = f + 0.5 + rnd() * Math.min(5, v.h * 0.6);
      } else if (benthic || sp.nearFloor) {
        y = f + (sp.nearFloor ? 0.5 + rnd() * 2.5 : 0.05);
        if (Math.abs(y - camPos.y) > V) continue;
      } else {
        const c = sp.clear || [1, 50];
        const vv = anywhere ? V * 0.45 : V;
        const lo = Math.max(f + c[0] + sp.size[1], camPos.y - vv), hi = Math.min(-0.8, camPos.y + vv, f + c[1]);
        if (hi <= lo) continue;
        y = lerp(lo, hi, rnd());
      }
      const ctx = this.ctx(x, y, z);
      const fit = sp.fit(ctx);
      if (fit < 0.25 || rnd() > fit + 0.2) continue;
      // 不在视野里“凭空出现”
      if (!anywhere && camera) {
        tmpV.set(x, y, z);
        const d = tmpV.distanceTo(camPos);
        if (d < rad * 0.7 && this.frustum.containsPoint(tmpV)) continue;
      }
      let n = sp.group[0] + Math.floor(rnd() * (sp.group[1] - sp.group[0] + 1));
      if (sp.shoal) n = Math.max(2, Math.round(n * this.dials.shoal));
      n = Math.min(n, k.cap - k.animals.length);
      if (n <= 0) return false;
      const g = { members: [], target: new THREE.Vector3(x, y, z), home: new THREE.Vector3(x, y, z), timer: 0, ex: false, exT: 20 + rnd() * 60, exHold: 0 };
      const spread = sp.size[1] * (sp.school ? 2.2 : 3) * Math.cbrt(n) + (sp.move === 'swarm' ? 1.2 : 0);
      for (let i = 0; i < n; i++) {
        const p = new THREE.Vector3(x + (rnd() - 0.5) * spread, y + (rnd() - 0.5) * spread * (benthic ? 0 : 0.5), z + (rnd() - 0.5) * spread);
        if (benthic) p.y = this.world.floorAt(p.x, p.z) + 0.02;
        else p.y = Math.max(p.y, this.world.floorAt(p.x, p.z) + (sp.clear ? sp.clear[0] : 0.5) * 0.6 + sp.size[1] * 0.3);
        p.y = Math.min(p.y, -0.6);
        this.addAnimal(k, g, p);
      }
      k.groups.push(g);
      return true;
    }
    return false;
  }

  addAnimal(k, g, p) {
    const sp = k.sp;
    const rnd = this.rnd;
    const size = lerp(sp.size[0], sp.size[1], rnd());
    const ang = rnd() * Math.PI * 2;
    const fwd = new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang));
    if (sp.move === 'drift' && !sp.chain) fwd.set((rnd() - 0.5) * 0.6, 1, (rnd() - 0.5) * 0.6).normalize();
    const v = 0.9 + rnd() * 0.2;
    const a = {
      k, sp, g, size, seed: rnd(),
      pos: p.clone(), prev: p.clone(), vel: fwd.clone().multiplyScalar(sp.speed[0]),
      fwd: fwd.clone(), prevFwd: fwd.clone(), up: new THREE.Vector3(0, 1, 0), prevUp: new THREE.Vector3(0, 1, 0),
      roll: 0, prevRoll: 0, phase: rnd() * 10, effort: 0.4, state: 0, timer: rnd() * 3, feedT: 3 + rnd() * 12, feed: null,
      fear: 0, jet: 0, jetT: 2 + rnd() * 6, stroke: rnd() * 10, heading: ang, target: p.clone(), tTimer: 0,
      tint: [v * (0.92 + rnd() * 0.16), v * (0.92 + rnd() * 0.16), v * (0.92 + rnd() * 0.16)],
      exT: 15 + rnd() * 70, ex: false, exHold: 0, seen: 0,
    };
    if (sp.move === 'benthic' || sp.move === 'sessile') {
      const n = this.world.normalAt(p.x, p.z, 0.8);
      a.up.set(n[0], n[1], n[2]); a.prevUp.copy(a.up);
    }
    g.members.push(a);
    k.animals.push(a);
    this.animals.push(a);
  }

  removeAnimal(a) {
    a.dead = true;
  }

  sweep() {
    for (const k of this.kinds) {
      if (k.animals.some((a) => a.dead)) {
        k.animals = k.animals.filter((a) => !a.dead);
        for (const g of k.groups) g.members = g.members.filter((a) => !a.dead);
        k.groups = k.groups.filter((g) => g.members.length > 0);
      }
    }
    this.animals = this.animals.filter((a) => !a.dead);
    this.hunters = this.animals.filter((a) => a.sp.hunter);
  }

  population() { return this.animals.length; }

  update(dt, camera, camPos, diverActive, paused) {
    this.pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.pm);
    this.diver.pos.copy(camPos);
    this.diver.active = diverActive;
    const jump = this.lastCam.distanceTo(camPos) > 45;
    this.lastCam.copy(camPos);
    if (jump) this.fresh = true;
    if (!paused) {
      // 群落管理
      const { R, V } = this.radii(camPos);
      for (const k of this.kinds) {
        k.check -= dt;
        if (k.check <= 0 || this.fresh) {
          k.check = 0.6 + this.rnd() * 0.4;
          k.suit = this.suitability(k, camPos);
          k.target = Math.round(k.sp.count * this.dialFor(k.sp) * Math.min(1, k.suit * 1.7));
        }
        // 回收远离的个体
        for (const a of k.animals) {
          const dx = a.pos.x - camPos.x, dz = a.pos.z - camPos.z;
          const benthic = a.sp.move === 'benthic' || a.sp.move === 'sessile';
          const lim = (benthic ? this.radii(camPos).Rb : a.sp.nearR ? Math.min(R, a.sp.nearR) : a.sp.near ? Math.min(R, 45) : R) * 1.35;
          if (dx * dx + dz * dz > lim * lim || Math.abs(a.pos.y - camPos.y) > V * 1.7) this.removeAnimal(a);
        }
      }
      this.sweep();
      for (const k of this.kinds) {
        let spawns = this.fresh ? 40 : 2;
        while (k.animals.length < k.target && spawns-- > 0) {
          if (!this.spawnGroup(k, camPos, this.fresh, camera)) break;
        }
        // 数量过多（刻度下调）时回收
        if (k.animals.length > k.target * 1.6 + 2 && k.groups.length > 1) {
          const g = k.groups[0];
          for (const a of g.members) this.removeAnimal(a);
        }
      }
      this.sweep();
      this.fresh = false;

      this.acc += dt;
      let steps = 0;
      while (this.acc >= STEP && steps < 4) {
        this.acc -= STEP;
        this.step(STEP);
        steps++;
      }
      if (this.acc > STEP) this.acc = 0;
    }
    this.render(camPos, paused ? this.alphaHold || 0 : this.acc / STEP);
    if (!paused) this.alphaHold = this.acc / STEP;
  }

  step(dt) {
    this.time += dt;
    const w = this.world;
    const cur = U.uCurrent.value;
    for (const k of this.kinds) {
      const sp = k.sp;
      // 群体目标
      for (const g of k.groups) {
        if (!g.members.length) continue;
        const c = tmpV.set(0, 0, 0);
        for (const m of g.members) c.add(m.pos);
        c.multiplyScalar(1 / g.members.length);
        g.center = g.center || new THREE.Vector3();
        g.center.copy(c);
        g.timer -= dt;
        if (g.timer <= 0 || c.distanceTo(g.target) < 3 + sp.size[1] * 2) this.newGroupTarget(k, g, c);
        // 呼吸
        if (sp.breathes) {
          if (!g.ex) { g.exT -= dt; if (g.exT < 0) { g.ex = true; g.exHold = 2.5 + this.rnd() * 3; } }
          else if (c.y > -2.2) { g.exHold -= dt; if (g.exHold < 0) { g.ex = false; g.exT = 30 + this.rnd() * 60; g.timer = 0; } }
        }
      }
      for (const a of k.animals) {
        a.prev.copy(a.pos);
        a.prevFwd.copy(a.fwd);
        a.prevUp.copy(a.up);
        a.prevRoll = a.roll;
        switch (sp.move) {
          case 'benthic': this.stepBenthic(a, dt); break;
          case 'sessile': a.effort = 1; a.phase += dt * sp.anim.freq * 6.283; break;
          default: this.stepSwimmer(a, dt, cur);
        }
      }
    }
  }

  newGroupTarget(k, g, c) {
    const sp = k.sp;
    const w = this.world;
    const rnd = this.rnd;
    const wander = sp.move === 'reef' ? 10 : sp.move === 'swarm' ? 2.5 : sp.move === 'hover' ? 6 : sp.size[1] > 5 ? 60 : 28;
    g.timer = 6 + rnd() * 10;
    if (sp.move === 'swarm') {
      g.target.copy(g.home).add(tmpV2.set((rnd() - 0.5) * 3, (rnd() - 0.3) * 2, (rnd() - 0.5) * 3));
      if (sp.hoverCoral) g.target.y = Math.max(g.target.y, w.floorAt(g.target.x, g.target.z) + 0.8 + rnd() * 1.5);
      return;
    }
    // 掠食者偶尔把目标设为附近的猎物群
    if (sp.hunter && rnd() < 0.35) {
      let best = null, bd = 30;
      for (const kk of this.kinds) {
        if (!kk.sp.prey) continue;
        for (const gg of kk.groups) {
          if (!gg.center) continue;
          const d = gg.center.distanceTo(c);
          if (d < bd) { bd = d; best = gg.center; }
        }
      }
      if (best) { g.target.copy(best); g.timer = 5; return; }
    }
    for (let i = 0; i < 8; i++) {
      const x = c.x + (rnd() - 0.5) * 2 * wander, z = c.z + (rnd() - 0.5) * 2 * wander;
      // 往镜头附近靠拢，避免整群游出群落范围
      const bx = lerp(x, this.diver.pos.x, 0.15), bz = lerp(z, this.diver.pos.z, 0.15);
      const f = w.floorAt(bx, bz);
      const cl = sp.clear || [1, 40];
      let y;
      if (g.ex) y = -0.6;
      else if (sp.nearFloor) y = f + cl[0] + rnd() * (cl[1] - cl[0]);
      else y = f + cl[0] + sp.size[1] + rnd() * Math.min(cl[1] - cl[0], 25);
      y = clamp(y, c.y - 20, c.y + 20);
      y = Math.min(y, g.ex ? -0.4 : -1.5);
      const fit = sp.fit(this.ctx(bx, y, bz));
      if (fit > 0.2 || i === 7) {
        g.target.set(bx, Math.max(y, f + cl[0] + sp.size[1] * 0.5), bz);
        if (g.ex) g.target.y = -0.6;
        return;
      }
    }
  }

  stepSwimmer(a, dt, cur) {
    const sp = a.sp;
    const g = a.g;
    const w = this.world;
    const acc = tmpV.set(0, 0, 0);
    const size = a.size;
    const maxS = sp.speed[1] * (a.fear > 0.1 ? 1.4 : 1);
    const cruise = sp.speed[0];
    // —— 目标 ——
    let tgt = g.target;
    if (sp.move === 'reef' && a.feed) tgt = a.feed;
    const to = tmpTo.copy(tgt).sub(a.pos);
    const dist = to.length();
    const seekK = sp.move === 'hover' || sp.move === 'drift' ? 0.15 : 0.9;
    if (dist > 0.01) acc.addScaledVector(to, (seekK * Math.min(1, dist / 4)) / dist * cruise * 1.5);
    // —— 鱼群：分离、对齐、聚合 ——
    if (sp.school || sp.move === 'swarm') {
      const mem = g.members;
      const n = mem.length;
      const stride = n > 40 ? 3 : 1;
      const off = Math.floor(this.time * 30) % stride;
      const sep = size * 1.6 + 0.1;
      const view = size * 6 + 1;
      let cnt = 0;
      let ax = 0, ay = 0, az = 0, cx = 0, cy = 0, cz = 0, sx = 0, sy = 0, sz = 0;
      for (let i = off; i < n; i += stride) {
        const m = mem[i];
        if (m === a) continue;
        const dx = a.pos.x - m.pos.x, dy = a.pos.y - m.pos.y, dz = a.pos.z - m.pos.z;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 > view * view) continue;
        const d = Math.sqrt(d2) + 1e-4;
        if (d < sep) { const f = (sep - d) / sep / d; sx += dx * f; sy += dy * f; sz += dz * f; }
        ax += m.vel.x; ay += m.vel.y; az += m.vel.z;
        cx += m.pos.x; cy += m.pos.y; cz += m.pos.z;
        cnt++;
      }
      acc.x += sx * 4 * cruise; acc.y += sy * 4 * cruise; acc.z += sz * 4 * cruise;
      if (cnt > 0 && !a.feed) {
        const kA = sp.move === 'swarm' ? 0.1 : 1.2, kC = sp.move === 'swarm' ? 0.2 : 0.5;
        acc.x += (ax / cnt - a.vel.x) * kA + (cx / cnt - a.pos.x) * kC;
        acc.y += (ay / cnt - a.vel.y) * kA + (cy / cnt - a.pos.y) * kC;
        acc.z += (az / cnt - a.vel.z) * kA + (cz / cnt - a.pos.z) * kC;
      }
      if (sp.move === 'swarm') {
        acc.x += (Math.sin(this.time * 2.3 + a.seed * 40) ) * 0.4;
        acc.y += (Math.cos(this.time * 1.9 + a.seed * 30)) * 0.25;
        acc.z += (Math.sin(this.time * 2.7 + a.seed * 20)) * 0.4;
      }
    } else if (g.members.length > 1) {
      for (const m of g.members) {
        if (m === a) continue;
        const d = a.pos.distanceTo(m.pos);
        const sep = size * 2.5;
        if (d < sep && d > 1e-3) acc.addScaledVector(tmpV2.copy(a.pos).sub(m.pos), (sep - d) / sep / d * 2);
      }
    }
    // —— 惊散：掠食者或正在游动的潜水员 ——
    if (sp.prey || sp.move === 'reef') {
      let tx = 0, ty = 0, tz = 0, best = 1e9;
      const fleeR = 5 + size * 12;
      for (const h of this.hunters) {
        if (h === a) continue;
        const d = a.pos.distanceTo(h.pos);
        if (d < fleeR + h.size * 2 && d < best) { best = d; tx = h.pos.x; ty = h.pos.y; tz = h.pos.z; }
      }
      if (this.diver.active) {
        const d = a.pos.distanceTo(this.diver.pos);
        if (d < fleeR * 0.9 && d < best) { best = d; tx = this.diver.pos.x; ty = this.diver.pos.y; tz = this.diver.pos.z; }
      }
      if (best < 1e8) {
        const away = tmpV2.set(a.pos.x - tx, a.pos.y - ty, a.pos.z - tz);
        const d = away.length() + 1e-3;
        acc.addScaledVector(away, (maxS * 3.5) / d * (1 - d / (fleeR + 6)));
        a.fear = 1;
        a.feed = null;
      }
    }
    a.fear = Math.max(0, a.fear - dt * 0.5);
    // —— 礁鱼觅食：游到岩面、低头啄食、再回到群里 ——
    if (sp.move === 'reef') {
      if (!a.feed) {
        a.feedT -= dt;
        if (a.feedT < 0 && a.fear < 0.1) {
          const fx = a.pos.x + (this.rnd() - 0.5) * 4, fz = a.pos.z + (this.rnd() - 0.5) * 4;
          let fy = w.floorAt(fx, fz);
          for (const o of this.scenery.obstacles) {
            const dx = fx - o.x, dz = fz - o.z;
            if (dx * dx + dz * dz < o.r * o.r * 0.4) fy = Math.max(fy, o.y + o.r * 0.35);
          }
          a.feed = new THREE.Vector3(fx, fy + size * 0.6, fz);
          a.feedDur = 2 + this.rnd() * 4;
        }
      } else if (a.pos.distanceTo(a.feed) < size * 1.5 + 0.2) {
        a.vel.multiplyScalar(0.88);
        acc.multiplyScalar(0.15);
        a.feedDur -= dt;
        if (a.feedDur < 0) { a.feed = null; a.feedT = 5 + this.rnd() * 15; }
      }
    }
    // —— 鱿鱼：鳍悬停 + 间歇喷射后退 ——
    if (sp.move === 'jet') {
      a.jetT -= dt;
      if (a.jetT < 0 || (a.fear > 0.9 && a.jet < 0.1)) {
        a.jetT = 3 + this.rnd() * 6;
        a.jet = 1;
        a.vel.addScaledVector(a.fwd, sp.speed[1] * (0.7 + 0.3 * a.fear));
      }
      a.jet = Math.max(0, a.jet - dt * 1.4);
    }
    // —— 水母：伞体脉动推进 + 洋流 ——
    if (sp.move === 'drift') {
      const pulse = Math.max(0, Math.sin(a.phase));
      acc.addScaledVector(a.fwd, pulse * sp.speed[1] * 0.8);
      acc.x += (cur.x * 0.6 - a.vel.x) * 0.3;
      acc.z += (cur.y * 0.6 - a.vel.z) * 0.3;
    } else {
      // 洋流带来的漂移
      const cf = Math.exp(-Math.max(0, -a.pos.y) / 120);
      acc.x += cur.x * 0.25 * cf; acc.z += cur.y * 0.25 * cf;
    }
    // —— 地形：前瞻避让 + 硬约束 ——
    const clr = (sp.clear ? sp.clear[0] : 0.5) + size * 0.3;
    const la = 1.2 + size;
    const fx = a.pos.x + a.vel.x * la, fz = a.pos.z + a.vel.z * la;
    const fAhead = w.floorAt(fx, fz);
    const yAhead = a.pos.y + a.vel.y * la;
    if (yAhead < fAhead + clr + 0.4) acc.y += (fAhead + clr + 0.4 - yAhead) * 3 + 0.5;
    // 大石块
    if (a.pos.y - w.floorAt(a.pos.x, a.pos.z) < 20) {
      for (const o of this.scenery.obstacles) {
        const dx = a.pos.x - o.x, dy = a.pos.y - o.y, dz = a.pos.z - o.z;
        const rr = o.r + size + 0.6;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < rr * rr && d2 > 1e-4) {
          const d = Math.sqrt(d2);
          const f = (rr - d) / rr / d * 5;
          acc.x += dx * f; acc.y += dy * f * 0.6 + (rr - d) * 0.8; acc.z += dz * f;
        }
      }
    }
    // 深度带
    const maxY = g.ex ? -0.35 : -0.9 - size * 0.25;
    if (a.pos.y > maxY - 1) acc.y -= (a.pos.y - (maxY - 1)) * 2;
    // —— 滑行节律：强力拍动与滑行交替 ——
    let thrustScale = 1;
    if (sp.move === 'glide') {
      a.stroke += dt;
      const cyc = 0.5 + 0.5 * Math.sin(a.stroke * (0.35 / Math.sqrt(size)) + a.seed * 6);
      thrustScale = cyc > 0.35 ? 1 : 0.25;
      a.glide = cyc <= 0.35;
    }
    acc.multiplyScalar(thrustScale);
    // —— 积分 ——
    a.vel.addScaledVector(acc, dt);
    const drag = sp.move === 'drift' || sp.move === 'hover' ? 0.9 : 0.35;
    a.vel.multiplyScalar(1 - drag * dt);
    const sp2 = a.vel.length();
    if (sp2 > maxS) a.vel.multiplyScalar(maxS / sp2);
    // 游泳动物保持一个最低速度（悬停/漂流类除外）
    const minS = sp.move === 'hover' || sp.move === 'drift' || sp.move === 'jet' || a.feed || sp.move === 'swarm' ? 0 : cruise * 0.4;
    if (sp2 < minS && sp2 > 1e-4) a.vel.multiplyScalar(minS / sp2);
    else if (sp2 <= 1e-4 && minS > 0) a.vel.copy(a.fwd).multiplyScalar(minS);
    a.pos.addScaledVector(a.vel, dt);
    const fNow = w.floorAt(a.pos.x, a.pos.z);
    const minY = fNow + clr * 0.55;
    if (a.pos.y < minY) { a.pos.y = minY; if (a.vel.y < 0) a.vel.y *= -0.2; }
    if (a.pos.y > maxY) { a.pos.y = maxY; if (a.vel.y > 0) a.vel.y = 0; }
    // —— 朝向：沿速度方向，转弯时侧倾 ——
    const speed = a.vel.length();
    const des = tmpV2;
    if (sp.move === 'jet') {
      // 头朝后：外套膜尖端朝着运动方向，缓慢转向目标
      des.copy(speed > 0.3 ? a.vel : to).normalize();
    } else if (sp.move === 'drift' && !sp.chain) {
      des.set(Math.sin(this.time * 0.1 + a.seed * 10) * 0.4, 1, Math.cos(this.time * 0.13 + a.seed * 7) * 0.4).normalize();
    } else if (speed > 0.03) des.copy(a.vel).multiplyScalar(1 / speed);
    else des.copy(a.fwd);
    if (!(sp.move === 'drift' && !sp.chain)) {
      const lim = sp.move === 'glide' || sp.size[1] > 3 ? 0.45 : 0.7;
      des.y = clamp(des.y, -lim, lim);
      if (a.feed && a.pos.distanceTo(a.feed) < size * 3 + 0.5) { des.y = -0.75; }
      des.normalize();
    }
    const turn = (sp.size[1] > 5 ? 0.6 : sp.size[1] > 1.5 ? 1.8 : 4.5) * dt;
    a.fwd.lerp(des, Math.min(1, turn)).normalize();
    const yawRate = (a.prevFwd.x * a.fwd.z - a.prevFwd.z * a.fwd.x) / dt;
    const rollT = clamp(yawRate * Math.max(speed, 0.3) * 0.35, -0.7, 0.7) * (sp.move === 'drift' ? 0 : 1);
    a.roll += (rollT - a.roll) * Math.min(1, dt * 3);
    // —— 动画节奏 ——
    const eff = clamp(speed / Math.max(maxS, 0.01) * 1.1 + acc.length() / (maxS * 3 + 0.1) * 0.4, 0.12, 1.3);
    a.effort += ((a.glide ? 0.12 : eff) - a.effort) * Math.min(1, dt * 3);
    if (a.feed && a.pos.distanceTo(a.feed) < size * 2) a.effort = 0.3;
    const freq = sp.anim.freq * (a.glide ? 0.35 : 0.3 + a.effort);
    a.phase += dt * freq * 6.2832;
  }

  stepBenthic(a, dt) {
    const sp = a.sp;
    const w = this.world;
    a.timer -= dt;
    // 潜水员靠近：螃蟹等会快速躲开
    let flee = false;
    if (this.diver.active && !sp.slow) {
      const d = a.pos.distanceTo(this.diver.pos);
      if (d < 3.5) { flee = true; a.heading = Math.atan2(a.pos.z - this.diver.pos.z, a.pos.x - this.diver.pos.x); a.state = 1; a.timer = 1.2; }
    }
    if (a.timer <= 0) {
      a.state = a.state === 1 ? 0 : 1;
      a.timer = a.state === 1 ? 0.8 + this.rnd() * 2.2 : 1 + this.rnd() * 5;
      if (a.state === 1) a.heading += (this.rnd() - 0.5) * 2.2;
    }
    const moving = a.state === 1;
    const sp0 = sp.speed[0], sp1 = sp.speed[1];
    const speed = moving ? (flee ? sp1 * 1.6 : lerp(sp0, sp1, 0.5 + 0.5 * Math.sin(a.seed * 20))) : 0;
    const dirAng = a.heading;
    const nx = a.pos.x + Math.cos(dirAng) * speed * dt, nz = a.pos.z + Math.sin(dirAng) * speed * dt;
    const f = w.floorAt(nx, nz);
    const ok = sp.fit(this.ctx(nx, f + 0.1, nz)) > 0.1;
    if (ok) { a.pos.x = nx; a.pos.z = nz; a.pos.y = f + 0.02 * a.size; }
    else a.heading += Math.PI * 0.7;
    // 朝向：贴合海底法线；螃蟹的身体与运动方向垂直
    const n = w.normalAt(a.pos.x, a.pos.z, Math.max(0.3, a.size));
    a.up.set(n[0], n[1], n[2]);
    const face = sp.sideways ? dirAng + Math.PI / 2 : dirAng;
    const desired = tmpV2.set(Math.cos(face), 0, Math.sin(face));
    a.fwd.lerp(desired, Math.min(1, dt * 3)).normalize();
    a.effort += ((moving ? 1 : 0.08) - a.effort) * Math.min(1, dt * 4);
    a.phase += dt * sp.anim.freq * (moving ? 1 : 0.15) * 6.2832;
  }

  render(camPos, alpha) {
    const planes = this.frustum.planes;
    this.visible.length = 0;
    const m = this.m4.elements;
    const P = new THREE.Vector3(), F = new THREE.Vector3(), Uv = new THREE.Vector3(), R = new THREE.Vector3();
    for (const k of this.kinds) {
      const mesh = k.mesh;
      const arr = mesh.instanceMatrix.array;
      const col = mesh.instanceColor.array;
      const ia = k.iAnim.array;
      let c = 0;
      for (const a of k.animals) {
        P.copy(a.prev).lerp(a.pos, alpha);
        const rad = a.size * (a.sp.chain ? 0.6 : 0.8);
        let inside = true;
        for (let p = 0; p < 6; p++) {
          const pl = planes[p];
          if (pl.normal.x * P.x + pl.normal.y * P.y + pl.normal.z * P.z + pl.constant < -rad) { inside = false; break; }
        }
        a.renderPos = a.renderPos || new THREE.Vector3();
        a.renderPos.copy(P);
        a.inView = inside;
        if (!inside) continue;
        const dist = P.distanceTo(camPos);
        this.visible.push({ a, dist });
        if (c >= k.cap) continue;
        F.copy(a.prevFwd).lerp(a.fwd, alpha).normalize();
        const benthic = a.sp.move === 'benthic' || a.sp.move === 'sessile';
        if (benthic) {
          Uv.copy(a.prevUp).lerp(a.up, alpha).normalize();
          R.crossVectors(Uv, F).normalize();
          F.crossVectors(R, Uv).normalize();
        } else {
          R.crossVectors(UPW, F);
          if (R.lengthSq() < 1e-6) R.set(1, 0, 0);
          R.normalize();
          Uv.crossVectors(F, R).normalize();
          const roll = lerp(a.prevRoll, a.roll, alpha);
          const cr = Math.cos(roll), sr = Math.sin(roll);
          const rx = R.x * cr + Uv.x * sr, ry = R.y * cr + Uv.y * sr, rz = R.z * cr + Uv.z * sr;
          const ux = Uv.x * cr - R.x * sr, uy = Uv.y * cr - R.y * sr, uz = Uv.z * cr - R.z * sr;
          R.set(rx, ry, rz); Uv.set(ux, uy, uz);
        }
        const s = a.size;
        const o = c * 16;
        arr[o] = R.x * s; arr[o + 1] = R.y * s; arr[o + 2] = R.z * s; arr[o + 3] = 0;
        arr[o + 4] = Uv.x * s; arr[o + 5] = Uv.y * s; arr[o + 6] = Uv.z * s; arr[o + 7] = 0;
        arr[o + 8] = F.x * s; arr[o + 9] = F.y * s; arr[o + 10] = F.z * s; arr[o + 11] = 0;
        arr[o + 12] = P.x; arr[o + 13] = P.y; arr[o + 14] = P.z; arr[o + 15] = 1;
        col[c * 3] = a.tint[0]; col[c * 3 + 1] = a.tint[1]; col[c * 3 + 2] = a.tint[2];
        ia[c * 4] = a.phase; ia[c * 4 + 1] = a.effort; ia[c * 4 + 2] = a.seed; ia[c * 4 + 3] = a.jet;
        c++;
      }
      mesh.count = c;
      mesh.visible = c > 0;
      if (c > 0) {
        mesh.instanceMatrix.needsUpdate = true;
        mesh.instanceColor.needsUpdate = true;
        k.iAnim.needsUpdate = true;
      }
    }
  }

  // 附近的动物（按数量排序），用于“附近”一行
  nearby(camPos, r = 28) {
    const cnt = {};
    for (const a of this.animals) {
      const d = a.pos.distanceTo(camPos);
      if (d < r + a.size) cnt[a.sp.id] = (cnt[a.sp.id] || 0) + 1 / (1 + d * 0.05);
    }
    return Object.entries(cnt).sort((x, y) => y[1] - x[1]).map(([id]) => id);
  }
}
