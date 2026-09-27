// The living part of the pond: koi steering (wander, speed changes, soft wall turns, separation,
// whirlpool current, fleeing from touches), the drop -> splash -> dive sequence, splash droplets and rain.
import * as THREE from 'three';
import { KoiInstances, ShadowInstances } from './koi.js';

export const MAX_KOI = 60;
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rnd = (a, b) => a + Math.random() * (b - a);
const wrap = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };

const DROP_VS = /* glsl */`
attribute float aSize;
attribute float aAlpha;
uniform float uScale;
varying float vA;
void main(){
  vec3 p = position;
  float h = p.y;
  p.xz *= 1.0 + h*0.05;
  p.y = 1.0 + h;
  vA = aAlpha;
  gl_Position = projectionMatrix*modelViewMatrix*vec4(p, 1.0);
  gl_PointSize = max(1.5, aSize*uScale*(1.0 + h*0.3));
}
`;
const DROP_FS = /* glsl */`
varying float vA;
void main(){
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  float a = smoothstep(0.5, 0.18, d)*vA;
  float hl = smoothstep(0.22, 0.0, length(c + vec2(0.13, 0.13)));
  gl_FragColor = vec4(mix(vec3(0.78, 0.94, 0.98), vec3(1.0), hl), a*(0.6 + 0.4*hl));
}
`;

export class School {
  constructor(U, water, audio) {
    this.U = U; this.water = water; this.audio = audio;
    this.fish = [];
    this.scale = 1;
    this.koi = new KoiInstances(U, MAX_KOI + 8, false);
    this.airKoi = new KoiInstances(U, 16, true);
    this.shadows = new ShadowInstances(MAX_KOI + 8);
    this.airShadows = new ShadowInstances(16);
    this.shadows.mesh.renderOrder = 1; this.koi.mesh.renderOrder = 2;
    this.airShadows.mesh.renderOrder = 0; this.airKoi.mesh.renderOrder = 1;
    this.under = new THREE.Group();
    this.under.add(this.shadows.mesh, this.koi.mesh);

    this.MAXP = 520;
    this.parts = [];
    this.pPos = new Float32Array(this.MAXP * 3);
    this.pSize = new Float32Array(this.MAXP);
    this.pAlpha = new Float32Array(this.MAXP);
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(this.pPos, 3).setUsage(THREE.DynamicDrawUsage));
    pg.setAttribute('aSize', new THREE.BufferAttribute(this.pSize, 1).setUsage(THREE.DynamicDrawUsage));
    pg.setAttribute('aAlpha', new THREE.BufferAttribute(this.pAlpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.pMat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 100 } }, vertexShader: DROP_VS, fragmentShader: DROP_FS,
      transparent: true, depthTest: false, depthWrite: false,
    });
    this.points = new THREE.Points(pg, this.pMat);
    this.points.frustumCulled = false; this.points.renderOrder = 2;

    this.MAXR = 340;
    this.rain = [];
    this.rPos = new Float32Array(this.MAXR * 6);
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.BufferAttribute(this.rPos, 3).setUsage(THREE.DynamicDrawUsage));
    this.rainLines = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({
      color: 0xe4f7ff, transparent: true, opacity: 0.3, depthTest: false, depthWrite: false,
    }));
    this.rainLines.frustumCulled = false; this.rainLines.renderOrder = 3;

    this.air = new THREE.Group();
    this.air.add(this.airShadows.mesh, this.airKoi.mesh, this.points, this.rainLines);
    this.fears = [];
    this.rainAcc = 0;
    this.sorted = [];
  }

  setPixelScale(pxPerUnit) { this.pMat.uniforms.uScale.value = pxPerUnit; }

  sdf(x, z) {
    const b = this.U.uPond.value, r = this.U.uPondR.value;
    const qx = Math.abs(x) - b.x + r, qz = Math.abs(z) - b.y + r;
    return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - r;
  }

  grad(x, z) {
    const e = 0.02;
    const gx = this.sdf(x + e, z) - this.sdf(x - e, z), gz = this.sdf(x, z + e) - this.sdf(x, z - e);
    const l = Math.hypot(gx, gz) || 1;
    return [gx / l, gz / l];
  }

  // a random spot well inside the pond, kept away from the bottom panel
  randomSpot(margin = 0.8) {
    const b = this.U.uPond.value;
    for (let i = 0; i < 40; i++) {
      const x = rnd(-b.x + margin, b.x - margin), z = rnd(-b.y + margin, b.y * 0.3);
      if (this.sdf(x, z) < -margin) return [x, z];
    }
    return [0, 0];
  }

  activeCount() { let n = 0; for (const f of this.fish) if (f.state !== 'leave') n++; return n; }

  _make(v, x, z) {
    return {
      v, seed: Math.random() * 10, size: this.scale * rnd(0.92, 1.2), x, z, h: rnd(0, TAU),
      speed: 0.25 * this.scale, target: rnd(0.18, 0.42) * this.scale, turn: 0,
      depth: rnd(0.3, 0.8), depthTarget: rnd(0.25, 0.85), depthT: rnd(3, 9),
      phase: rnd(0, TAU), fin: rnd(0, TAU), wander: 0, wanderT: 0, speedT: rnd(1, 4),
      state: 'swim', t: 0, alpha: 1, lift: 0, vx: 0, vz: 0, dive: 99, wakeT: 0,
    };
  }

  populate(n) {
    for (let i = 0; i < n; i++) {
      // polish: keep the starting fish apart so the school reads as individuals, not a pile
      let x = 0, z = 0;
      for (let k = 0; k < 30; k++) {
        [x, z] = this.randomSpot(0.9);
        let ok = true;
        for (const o of this.fish) if (Math.hypot(o.x - x, o.z - z) < 1.15 * this.scale) { ok = false; break; }
        if (ok) break;
      }
      // fixed: the starting school is already in the pond on the first frame
      // (fading in from 0 per frame left the pond empty on slow first frames)
      const f = this._make(i % 4, x, z);
      this.fish.push(f);
    }
  }

  release(v, x, z) {
    if (this.activeCount() >= MAX_KOI) return false;
    const f = this._make(v, x, z);
    f.state = 'fall'; f.t = 0; f.lift = 1.5; f.depth = 0;
    f.vx = rnd(-0.12, 0.12); f.vz = rnd(-0.12, 0.12);
    this.fish.push(f);
    return true;
  }

  clear() {
    let n = 0;
    for (const f of this.fish) {
      if (f.state === 'leave') continue;
      if (f.state === 'fall') { f.state = 'swim'; f.lift = 0; f.dive = 0; }
      f.state = 'leave'; f.depthTarget = 1.3; f.target = 0.5 * this.scale; n++;
    }
    return n;
  }

  touch(x, z, strength = 1) { this.fears.push({ x, z, t: 0.7 * strength }); }

  splash(x, z, size) {
    const w = this.water;
    w.addDrop(x, z, 0.55 * size, -0.8, 0.0);
    w.addDrop(x, z, 0.9 * size, 0.18, 0.42);
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * TAU + Math.random() * 0.3, r = 0.5 * size * rnd(0.8, 1.1);
      w.addDrop(x + Math.cos(a) * r, z + Math.sin(a) * r, 0.16 * size, 0.1, 0.55);
    }
    for (let i = 0; i < 54 && this.parts.length < this.MAXP; i++) {
      const a = Math.random() * TAU, sp = rnd(0.35, 2.1) * size, r0 = rnd(0.1, 0.35) * size;
      this.parts.push({
        x: x + Math.cos(a) * r0, z: z + Math.sin(a) * r0, h: rnd(0, 0.1),
        vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, vh: rnd(1.3, 4.2), s: rnd(0.025, 0.07) * size,
      });
    }
    this.fears.push({ x, z, t: 0.9 });
    this.audio.splash(Math.min(1.2, 0.6 + size * 0.5));
  }

  update(dt, env) {
    for (let i = this.fears.length - 1; i >= 0; i--) { this.fears[i].t -= dt; if (this.fears[i].t <= 0) this.fears.splice(i, 1); }
    const fish = this.fish;
    for (let i = fish.length - 1; i >= 0; i--) {
      const f = fish[i];
      if (f.state === 'fall') { this._fall(f, dt); continue; }
      this._swim(f, dt, env);
      if (f.state === 'leave') { f.alpha -= dt * 0.75; if (f.alpha <= 0) fish.splice(i, 1); }
      else if (f.alpha < 1) f.alpha = Math.min(1, f.alpha + dt * 0.8);
    }
    this._particles(dt);
    this._rain(dt, env);
  }

  _fall(f, dt) {
    f.t += dt;
    const k = Math.min(1, f.t / 0.5);
    f.lift = 1.5 * (1 - k * k);
    f.x += f.vx * dt; f.z += f.vz * dt;
    f.phase += dt * 16; f.fin += dt * 10;
    if (k >= 1) {
      f.state = 'swim'; f.lift = 0; f.depth = 0; f.depthTarget = rnd(0.4, 0.8); f.dive = 0;
      f.speed = 0.95 * this.scale; f.target = 0.45 * this.scale; f.speedT = 2.5; f.alpha = 1;
      this.splash(f.x, f.z, f.size);
    }
  }

  _swim(f, dt, env) {
    const sc = this.scale;
    const fx = Math.cos(f.h), fz = Math.sin(f.h);
    f.wanderT -= dt;
    if (f.wanderT <= 0) { f.wander = rnd(-1.1, 1.1); f.wanderT = rnd(1.2, 4.5); }
    f.speedT -= dt;
    if (f.speedT <= 0) {
      const burst = !env.calm && Math.random() < 0.16;
      f.target = (burst ? rnd(0.7, 1.1) : rnd(0.14, 0.46)) * (env.calm ? 0.55 : 1) * sc;
      f.speedT = burst ? rnd(0.8, 1.6) : rnd(2.5, 6);
    }
    let dx = fx, dz = fz;
    const wa = f.h + f.wander * 0.8;
    dx += Math.cos(wa) * 0.9; dz += Math.sin(wa) * 0.9;

    // soft turns before the wall
    const look = (0.55 + f.speed / sc * 1.3) * sc + 0.3 * f.size;
    const ax = f.x + fx * look, az = f.z + fz * look;
    const margin = 0.5 * f.size + 0.2;
    const sa = this.sdf(ax, az), s0 = this.sdf(f.x, f.z) + 0.2;
    const m = Math.max(sa, s0);
    if (m > -margin) {
      const g = sa > s0 ? this.grad(ax, az) : this.grad(f.x, f.z);
      let tx = -g[1], tz = g[0];
      if (tx * fx + tz * fz < 0) { tx = -tx; tz = -tz; }
      const w = clamp((m + margin) / margin, 0, 2) * 2.4;
      dx += (tx - g[0]) * 0.9 * w; dz += (tz - g[1]) * 0.9 * w;
    }

    // keep personal space
    for (const o of this.fish) {
      if (o === f || o.state === 'fall') continue;
      const ox = f.x - o.x, oz = f.z - o.z, d2 = ox * ox + oz * oz, R = (f.size + o.size) * 0.5;
      if (d2 < R * R && d2 > 1e-6) {
        const d = Math.sqrt(d2), dd = Math.abs(f.depth - o.depth);
        const w = (1 - d / R) * 2.6 * (dd < 0.3 ? 1 : 0.35);
        dx += ox / d * w; dz += oz / d * w;
        if (dd < 0.2 && f.dive > 3 && f.state !== 'leave') f.depthTarget = clamp(f.depthTarget + (f.depth >= o.depth ? 0.25 : -0.25) * dt, 0.15, 0.9);
      }
    }

    // flee from touches and splashes
    for (const q of this.fears) {
      const ox = f.x - q.x, oz = f.z - q.z, d = Math.hypot(ox, oz), R = 1.5 * sc;
      if (d < R && d > 1e-4) {
        const w = (1 - d / R) * 4 * q.t;
        dx += ox / d * w; dz += oz / d * w;
        if (w > 0.8) { f.target = Math.max(f.target, 1.0 * sc); f.speedT = Math.max(f.speedT, 1.0); }
      }
    }

    // whirlpool current drags and turns the fish
    const W = env.whirl;
    if (W.S > 0.01) {
      const rx = f.x - W.x, rz = f.z - W.z, r = Math.hypot(rx, rz) + 1e-4;
      const infl = W.S * Math.exp(-r * r / (W.R * W.R * 2.6));
      const sp = infl * (0.9 + 0.6 / (0.3 + r)) * sc;
      const cvx = -rz / r * sp - rx / r * 0.3 * infl * sc, cvz = rx / r * sp - rz / r * 0.3 * infl * sc;
      f.x += cvx * dt; f.z += cvz * dt;
      dx += cvx * 0.8; dz += cvz * 0.8;
      if (r < 0.7) { dx += rx / r * (0.7 - r) * 5; dz += rz / r * (0.7 - r) * 5; }
      f.h += infl * 0.6 * dt;
    }

    const want = Math.atan2(dz, dx);
    const dh = wrap(want - f.h);
    const maxTurn = 1.3 + f.speed / sc * 1.6;
    const rate = clamp(dh * 2.0, -maxTurn, maxTurn);
    f.turn += (rate - f.turn) * (1 - Math.exp(-dt * 3));
    f.h = wrap(f.h + f.turn * dt);
    f.speed += (f.target - f.speed) * (1 - Math.exp(-dt * (f.target > f.speed ? 2.2 : 0.9)));
    f.x += Math.cos(f.h) * f.speed * dt;
    f.z += Math.sin(f.h) * f.speed * dt;
    const s1 = this.sdf(f.x, f.z), lim = -0.3 * f.size;
    if (s1 > lim) { const g = this.grad(f.x, f.z); f.x -= g[0] * (s1 - lim); f.z -= g[1] * (s1 - lim); }

    f.dive += dt;
    f.depthT -= dt;
    if (f.depthT <= 0 && f.state !== 'leave') { f.depthTarget = rnd(0.22, 0.88); f.depthT = rnd(4, 10); }
    const rateD = f.state === 'leave' ? 0.9 : f.dive < 2.5 ? 1.4 : 0.35;
    f.depth += (f.depthTarget - f.depth) * (1 - Math.exp(-dt * rateD));
    f.phase += dt * (3.0 + f.speed / sc * 9.0 + Math.abs(f.turn) * 1.2);
    f.fin += dt * (2.0 + f.speed / sc * 2.5);

    // a faint wake when swimming right under the surface
    if (f.depth < 0.22 && f.speed > 0.2 * sc && f.state !== 'leave') {
      f.wakeT -= dt;
      if (f.wakeT <= 0) {
        f.wakeT = 0.12;
        this.water.addDrop(f.x - fx * 0.45 * f.size, f.z - fz * 0.45 * f.size, 0.16 * f.size, 0.2 * (0.25 - f.depth), 0);
      }
    }
  }

  _particles(dt) {
    const P = this.parts;
    for (let i = P.length - 1; i >= 0; i--) {
      const p = P[i];
      p.vh -= 7.5 * dt; p.h += p.vh * dt;
      p.x += p.vx * dt; p.z += p.vz * dt;
      p.vx *= 1 - dt * 0.4; p.vz *= 1 - dt * 0.4;
      if (p.h <= 0) {
        if (this.sdf(p.x, p.z) < -0.05) {
          this.water.addDrop(p.x, p.z, 0.06 + p.s * 0.6, 0.1 + p.s * 1.6, 0.35);
          if (Math.random() < 0.12) this.audio.droplet(0.35);
        }
        P[i] = P[P.length - 1]; P.pop();
      }
    }
  }

  _rain(dt, env) {
    const lvl = env.rain, hx = env.halfX, hz = env.halfY;
    if (lvl > 0.02) {
      this.rainAcc += dt * lvl * 90 * (hx * hz / 25);
      while (this.rainAcc >= 1) {
        this.rainAcc -= 1;
        if (this.rain.length < this.MAXR) this.rain.push({ x: rnd(-hx, hx), z: rnd(-hz, hz), h: rnd(1.4, 2.8) });
      }
    }
    const R = this.rain;
    for (let i = R.length - 1; i >= 0; i--) {
      const r = R[i];
      r.h -= dt * 11;
      if (r.h <= 0) {
        if (this.sdf(r.x, r.z) < -0.04) {
          this.water.addDrop(r.x, r.z, rnd(0.05, 0.085), rnd(0.14, 0.3), 0.1);
          if (Math.random() < 0.25) this.audio.tick(0.6);
        }
        R[i] = R[R.length - 1]; R.pop();
      }
    }
  }

  render() {
    if (!this._va) { this._va = new Float32Array(4); this._vl = new Float32Array(4); this._ve = new Float32Array(4); }
    const sun = this.U.uSunDir.value, shx = sun.x / sun.y, shz = sun.z / sun.y, sc = this.scale;
    this.koi.begin(); this.shadows.begin(); this.airKoi.begin(); this.airShadows.begin();
    const list = this.sorted;
    list.length = 0;
    for (const f of this.fish) if (f.state !== 'fall') list.push(f);
    list.sort((a, b) => b.depth - a.depth);
    for (const f of list) {
      const d = f.depth;
      const s = f.size * (1 + 0.14 * (1 - Math.min(1, d)));
      const y = Math.max(-3.85, -0.3 - d * 3.0);
      const amp = clamp(0.026 + f.speed / sc * 0.045 + Math.abs(f.turn) * 0.006, 0, 0.085);
      const curv = clamp(0.35 * f.turn / Math.max(f.speed / sc, 0.2), -0.5, 0.5);
      const fold = clamp((f.speed / sc - 0.4) * 1.8, 0, 1);
      const roll = clamp(f.turn * 0.12, -0.3, 0.3);
      const pitch = clamp(-(f.depthTarget - f.depth) * 0.9, -0.4, 0.3);
      const A = this._va, B = this._vl, C = this._ve;
      A[0] = f.phase; A[1] = amp; A[2] = curv; A[3] = f.fin;
      B[0] = f.v; B[1] = f.seed; B[2] = clamp(d, 0, 1.3); B[3] = f.alpha;
      C[0] = fold; C[1] = 0; C[2] = 0; C[3] = 0;
      this.koi.push(f.x, y, f.z, f.h, s, roll, pitch, A, B, C);
      // polish: the shadow falls away from the sun (bottom-left); the higher the fish swims above
      // the floor, the farther and softer its shadow. The fixed version pushed it toward the sun.
      const off = (3.6 - 3.0 * Math.min(d, 1.2)) * 0.55;
      const bx = f.x - Math.cos(f.h) * 0.12 * f.size, bz = f.z - Math.sin(f.h) * 0.12 * f.size;
      this.shadows.push(bx - shx * off, -3.9, bz - shz * off, f.h, f.size * 0.64, f.size * 0.16,
        0.5 + 0.4 * (1 - Math.min(d, 1)), (0.26 + 0.18 * Math.min(d, 1)) * f.alpha);
    }
    for (const f of this.fish) {
      if (f.state !== 'fall') continue;
      const k = 1 + f.lift * 0.05;
      const A = this._va, B = this._vl, C = this._ve;
      A[0] = f.phase; A[1] = 0.07; A[2] = Math.sin(f.t * 14) * 0.4; A[3] = f.fin;
      B[0] = f.v; B[1] = f.seed; B[2] = 0; B[3] = 1;
      C[0] = 0.2; C[1] = 0; C[2] = 0; C[3] = 0;
      this.airKoi.push(f.x * k, 0.6 + f.lift, f.z * k, f.h, f.size * (1.12 + f.lift * 0.22), 0, 0.25 * Math.sin(f.t * 9), A, B, C);
      this.airShadows.push(f.x + shx * f.lift * 0.35, 0.2, f.z + shz * f.lift * 0.35, f.h, f.size * 0.62, f.size * 0.16,
        0.7, 0.26 * (1 - f.lift / 2));
    }
    this.koi.end(); this.shadows.end(); this.airKoi.end(); this.airShadows.end();

    const P = this.parts, n = Math.min(P.length, this.MAXP);
    for (let i = 0; i < n; i++) {
      const p = P[i];
      this.pPos[i * 3] = p.x; this.pPos[i * 3 + 1] = p.h; this.pPos[i * 3 + 2] = p.z;
      this.pSize[i] = p.s; this.pAlpha[i] = clamp(p.h * 4 + 0.45, 0, 1);
    }
    const pg = this.points.geometry;
    pg.attributes.position.needsUpdate = true; pg.attributes.aSize.needsUpdate = true; pg.attributes.aAlpha.needsUpdate = true;
    pg.setDrawRange(0, n);

    const R = this.rain, m = Math.min(R.length, this.MAXR), a = this.rPos;
    for (let i = 0; i < m; i++) {
      const r = R[i], k1 = 1 + r.h * 0.05, h2 = r.h + 0.55, k2 = 1 + h2 * 0.05;
      a[i * 6] = r.x * k1; a[i * 6 + 1] = 1 + r.h; a[i * 6 + 2] = r.z * k1;
      a[i * 6 + 3] = r.x * k2; a[i * 6 + 4] = 1 + h2; a[i * 6 + 5] = r.z * k2;
    }
    const rg = this.rainLines.geometry;
    rg.attributes.position.needsUpdate = true;
    rg.setDrawRange(0, m * 2);
  }
}
