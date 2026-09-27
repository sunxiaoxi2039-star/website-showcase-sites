// 探索相机：漂流 / 游动、连续旅程（沿地形与峡谷）、随真实浪高漂浮、跟随动物。
import * as THREE from 'three';
import { SITES, PLACES, canyonX, WORLD_RADIUS } from './world.js';
import { clamp, lerp, smoothstep } from './noise.js';

export const EYE_HEIGHT = 1.6;

export class Explorer {
  constructor(world, waves) {
    this.world = world;
    this.waves = waves;
    this.pos = new THREE.Vector3(SITES.reef.x, EYE_HEIGHT, SITES.reef.z);
    this.vel = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0; this.fov = 62;
    this.mode = 'drift';
    this.journey = null;
    this.follow = null;
    this.waterline = false;
    this.keys = {};
    this.touchMove = { f: 0, u: 0 };
    this.floating = true;
    this.driftT = 0;
    this.lookVel = { yaw: 0, pitch: 0 };
    this.speedNow = 0;
  }

  setWorld(world) { this.world = world; }

  floorAt(x, z) { return this.world.floorAt(x, z); }

  // ——— 放置 ———
  placeSurface(x, z, yaw) {
    this.pos.set(x, EYE_HEIGHT, z);
    this.floating = true;
    this.yaw = yaw ?? this.yaw;
    this.pitch = -0.02;
    this.journey = null;
  }
  placeAt(x, y, z, yaw, pitch) {
    this.pos.set(x, y, z);
    this.floating = false;
    if (yaw !== undefined) this.yaw = yaw;
    this.pitch = pitch ?? -0.12;
    this.journey = null;
  }
  siteTarget(id) {
    const s = SITES[id];
    const f = this.floorAt(s.x, s.z);
    const y = id === 'blue' ? -38 : id === 'deep' ? f + 3.8 : Math.min(-4, f + 4.5);
    return { x: s.x, y, z: s.z, yaw: SITES[id].yaw ?? (id === 'blue' ? 0.4 : id === 'kelp' ? 2.2 : id === 'deep' ? 3.0 : 0.6), pitch: id === 'blue' ? 0.12 : id === 'deep' ? -0.32 : 0.02 };
  }
  placeTarget(p) {
    const f = this.floorAt(p.x, p.z);
    const y = p.kind === 'slope' ? Math.min(-30, f + 25) : p.kind === 'blue' ? Math.min(-8, f + 8) : Math.min(-4, f + 5);
    return { x: p.x, y, z: p.z, yaw: this.yaw, pitch: -0.12 };
  }

  // ——— 旅程 ———
  // 沿直线采样地形，保持离底一定高度；平滑后得到一条连续的路径
  planPath(from, to, opts = {}) {
    const pts = [];
    const dx = to.x - from.x, dz = to.z - from.z;
    const D = Math.hypot(dx, dz);
    const n = Math.max(2, Math.ceil(D / 12));
    const clearance = opts.clearance ?? 14;
    const surf = opts.surface;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = from.x + dx * t, z = from.z + dz * t;
      let y = lerp(from.y, to.y, smoothstep(0, 1, t));
      const f = this.floorAt(x, z);
      if (i > 0 && i < n) {
        y = Math.max(y, f + clearance);
        if (!surf) y = Math.min(y, -3);
      }
      pts.push(new THREE.Vector3(x, y, z));
    }
    return pts;
  }
  smoothPath(pts, passes = 3) {
    for (let p = 0; p < passes; p++) {
      for (let i = 1; i < pts.length - 1; i++) {
        const y = (pts[i - 1].y + pts[i].y * 2 + pts[i + 1].y) / 4;
        const f = this.floorAt(pts[i].x, pts[i].z);
        pts[i].y = Math.max(y, f + 5);
      }
    }
    return pts;
  }
  // 从当前位置出发：先离开水面（如在水面），再沿地形前往
  travelTo(target, label, opts = {}) {
    this.follow = null;
    const start = this.pos.clone();
    let pts = [];
    const tgt = new THREE.Vector3(target.x, target.y, target.z);
    if (start.y > -1 && tgt.y < -1) {
      // 从水面潜下：先垂直下沉几米
      pts.push(start.clone());
      const f = this.floorAt(start.x, start.z);
      const dive = new THREE.Vector3(start.x, Math.max(f + 4, -8), start.z);
      pts.push(dive);
      pts = pts.concat(this.planPath(dive, tgt).slice(1));
    } else if (tgt.y > -1) {
      // 上浮：先到水下 3 米，再垂直浮出
      const below = new THREE.Vector3(tgt.x, -3, tgt.z);
      pts = this.planPath(start, below);
      pts.push(tgt.clone());
    } else {
      pts = this.planPath(start, tgt);
    }
    if (opts.via) pts = opts.via;
    this.smoothPath(pts);
    this.startJourney(pts, label, target, opts);
  }
  startJourney(pts, label, target, opts = {}) {
    const lens = [0];
    for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1] + pts[i].distanceTo(pts[i - 1]));
    const L = lens[lens.length - 1];
    if (L < 0.5) { this.journey = null; return; }
    const T = clamp(5 + L / 70 + Math.sqrt(L) * 0.25, 5, 42) * (opts.slow || 1);
    this.journey = { pts, lens, L, T, t: 0, label, target, onArrive: opts.onArrive, surface: target.y > -1 };
    this.mode = 'drift';
    this.floating = false;
  }
  stop() {
    if (!this.journey) return;
    this.journey = null;
    this.vel.set(0, 0, 0);
  }
  // 沿峡谷下潜的路线（从陆架到热液花园）
  canyonRoute(fromPos) {
    const pts = [];
    const zStart = -620;
    const zEnd = SITES.deep.z;
    for (let z = zStart; z <= zEnd; z += 20) {
      const x = canyonX(z);
      const f = this.floorAt(x, z);
      pts.push(new THREE.Vector3(x, f + 28, z));
    }
    const last = SITES.deep;
    const tgt = this.siteTarget('deep');
    pts.push(new THREE.Vector3(last.x, tgt.y, last.z));
    // 单调下降，避免路线忽上忽下
    for (let i = 1; i < pts.length; i++) pts[i].y = Math.min(pts[i].y, pts[i - 1].y);
    for (let i = 1; i < pts.length; i++) { const f = this.floorAt(pts[i].x, pts[i].z); pts[i].y = Math.max(pts[i].y, f + 6); }
    return pts;
  }
  descend(stopDepth) {
    const p = this.pos;
    const f = this.floorAt(p.x, p.z);
    // 已在深水区上方：直接下潜
    if (f < -250) {
      const targetY = stopDepth ? Math.max(-stopDepth, f + 8) : f + 8;
      if (targetY >= p.y - 1) return false;
      this.travelTo({ x: p.x, y: targetY, z: p.z }, stopDepth ? `${stopDepth} 米` : '海底');
      return true;
    }
    // 在陆架上：先去峡谷头部，再沿峡谷向下
    const route = this.canyonRoute();
    let cut = route.length;
    if (stopDepth) {
      cut = route.findIndex((q) => q.y <= -stopDepth);
      if (cut < 0) cut = route.length - 1;
      route[cut].y = -stopDepth;
      cut += 1;
    }
    const tail = route.slice(0, cut);
    const head = this.planPath(p.y > -1 ? new THREE.Vector3(p.x, -6, p.z) : p.clone(), tail[0]);
    let pts = head.concat(tail.slice(1));
    if (p.y > -1) pts.unshift(p.clone());
    this.smoothPath(pts, 2);
    const last = pts[pts.length - 1];
    this.startJourney(pts, stopDepth ? `${stopDepth} 米` : '午夜花园', { x: last.x, y: last.y, z: last.z }, { slow: 1.0 });
    return true;
  }
  ascend() {
    const p = this.pos;
    if (p.y > -1) return false;
    this.travelTo({ x: p.x, y: EYE_HEIGHT, z: p.z }, '水面');
    return true;
  }

  pathPoint(d, out) {
    const { pts, lens } = this.journey;
    let i = 1;
    while (i < lens.length - 1 && lens[i] < d) i++;
    const t = (d - lens[i - 1]) / Math.max(lens[i] - lens[i - 1], 1e-6);
    return out.copy(pts[i - 1]).lerp(pts[i], clamp(t, 0, 1));
  }

  // ——— 每帧 ———
  update(dt, t, obstacles) {
    const p = this.pos;
    const prev = p.clone();
    const waveH = this.waves.height(p.x, p.z, t);
    if (this.journey) {
      const j = this.journey;
      j.t += dt;
      const u = clamp(j.t / j.T, 0, 1);
      const e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
      const d = e * j.L;
      this.pathPoint(d, p);
      // 视线：朝行进方向，垂直分量压缩
      const ahead = this.pathPoint(Math.min(j.L, d + 25), new THREE.Vector3());
      const dir = ahead.sub(p);
      const h = Math.hypot(dir.x, dir.z);
      if (h > 0.5 || Math.abs(dir.y) > 0.5) {
        let tyaw = Math.atan2(-dir.x, -dir.z);
        if (h < 2) tyaw = this.yaw;
        const tp = clamp(Math.atan2(dir.y, Math.max(h, 8)) * 0.8, -0.9, 0.35);
        const k = Math.min(1, dt * 1.5);
        this.yaw += wrapAngle(tyaw - this.yaw) * k;
        this.pitch += (tp - this.pitch) * k;
      }
      if (u >= 1) {
        const tg = j.target;
        if (tg && tg.yaw !== undefined && !j.surface) this.pendingLook = { yaw: tg.yaw, pitch: tg.pitch ?? -0.1, t: 2.5 };
        const cb = j.onArrive;
        this.journey = null;
        if (j.surface) { this.floating = true; this.pitch = -0.02; }
        if (cb) cb();
      }
    } else if (this.follow && !this.follow.dead) {
      const a = this.follow;
      const ap = a.renderPos || a.pos;
      const dist = Math.max(2.2, a.size * (a.sp.id === 'whale' ? 1.6 : 3.2));
      const fwd = a.fwd;
      const want = new THREE.Vector3(ap.x - fwd.x * dist * 0.7 + fwd.z * dist * 0.7, ap.y + dist * 0.25, ap.z - fwd.z * dist * 0.7 - fwd.x * dist * 0.7);
      p.lerp(want, Math.min(1, dt * 1.2));
      const look = new THREE.Vector3().subVectors(ap, p);
      const tyaw = Math.atan2(-look.x, -look.z);
      const tp = Math.atan2(look.y, Math.hypot(look.x, look.z));
      this.yaw += wrapAngle(tyaw - this.yaw) * Math.min(1, dt * 3);
      this.pitch += (tp - this.pitch) * Math.min(1, dt * 3);
    } else {
      if (this.follow && this.follow.dead) this.follow = null;
      if (this.pendingLook) {
        const pl = this.pendingLook;
        const k = Math.min(1, dt * 1.2);
        this.yaw += wrapAngle(pl.yaw - this.yaw) * k;
        this.pitch += (pl.pitch - this.pitch) * k;
        pl.t -= dt;
        if (pl.t <= 0) this.pendingLook = null;
      }
      const k = this.keys;
      const fast = k.ShiftLeft || k.ShiftRight ? 4 : 1;
      const depthBoost = p.y < -150 ? 2.5 : 1;
      const sp = 3.2 * fast * depthBoost;
      const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw), cp = Math.cos(this.pitch), spn = Math.sin(this.pitch);
      const fwd = new THREE.Vector3(-sy * cp, spn, -cy * cp);
      const right = new THREE.Vector3(cy, 0, -sy);
      const want = new THREE.Vector3();
      let mf = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0) + this.touchMove.f;
      let mr = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0);
      let mu = (k.KeyE || k.Space ? 1 : 0) - (k.KeyQ ? 1 : 0) + this.touchMove.u;
      if (this.mode === 'swim') {
        want.addScaledVector(fwd, mf * sp).addScaledVector(right, mr * sp);
        want.y += mu * sp * 0.8;
      }
      this.vel.lerp(want, Math.min(1, dt * 2.5));
      if (this.mode === 'drift') {
        // 漂流：被洋流轻轻带动，镜头缓缓摇摆
        this.driftT += dt;
        this.vel.multiplyScalar(Math.max(0, 1 - dt * 2));
      }
      p.addScaledVector(this.vel, dt);
      if (this.vel.lengthSq() > 0.04 || mu !== 0) this.floating = false;
    }
    // 漂浮：锁在浪面上方
    if (!this.journey && (this.floating || (this.mode === 'drift' && p.y > -0.4 && p.y < 4 && !this.follow))) {
      if (p.y > -0.4) {
        const target = waveH + (this.waterline ? 0.0 + Math.sin(t * 0.7) * 0.12 : EYE_HEIGHT);
        p.y += (target - p.y) * Math.min(1, dt * 6);
        this.floating = true;
      }
    }
    // 约束：海底、岩石、世界边界、天空
    if (!(this.journey && this.journey.surface && p.y > -3)) {
      const f = this.floorAt(p.x, p.z);
      if (p.y < f + 1.1) { p.y = f + 1.1; if (this.vel.y < 0) this.vel.y = 0; }
    }
    if (obstacles && !this.journey) {
      for (const o of obstacles) {
        const dx = p.x - o.x, dy = p.y - o.y, dz = p.z - o.z;
        const d = Math.hypot(dx, dy, dz);
        const min = o.r * 0.75 + 0.8;
        if (d < min && d > 1e-4) { const k2 = (min - d) / d; p.x += dx * k2; p.y += dy * k2; p.z += dz * k2; }
      }
    }
    const r = Math.hypot(p.x, p.z);
    if (r > WORLD_RADIUS) { p.x *= WORLD_RADIUS / r; p.z *= WORLD_RADIUS / r; }
    p.y = Math.min(p.y, 120);
    this.speedNow = prev.distanceTo(p) / Math.max(dt, 1e-3);
    // 漂流时的轻微摇晃
    this.sway = this.mode === 'drift' && !this.journey && !this.follow ? 1 : 0;
  }

  look(dx, dy) {
    this.yaw -= dx * 0.0042 * (this.fov / 62);
    this.pitch = clamp(this.pitch - dy * 0.0042 * (this.fov / 62), -1.45, 1.45);
    this.pendingLook = null;
  }

  applyCamera(camera, t) {
    let yaw = this.yaw, pitch = this.pitch, roll = 0;
    if (this.sway) {
      yaw += Math.sin(t * 0.13) * 0.02;
      pitch += Math.sin(t * 0.21) * 0.012;
      roll = Math.sin(t * 0.17) * 0.012;
    }
    if (this.floating && this.pos.y > -0.5) {
      const s = this.waves.slope(this.pos.x, this.pos.z, t);
      roll += clamp(s[0] * Math.cos(yaw) - s[1] * Math.sin(yaw), -0.3, 0.3) * 0.5;
      pitch += clamp(-(s[0] * Math.sin(yaw) + s[1] * Math.cos(yaw)), -0.3, 0.3) * 0.3;
    }
    camera.position.copy(this.pos);
    camera.rotation.set(pitch, yaw, roll, 'YXZ');
    if (Math.abs(camera.fov - this.fov) > 0.01) { camera.fov = this.fov; camera.updateProjectionMatrix(); }
    camera.updateMatrixWorld();
  }
}

export function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
