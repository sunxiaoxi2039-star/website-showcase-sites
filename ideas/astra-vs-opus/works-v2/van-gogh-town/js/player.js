import { H } from './terrain.js';

const EYE = 1.62;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };

export function lookAngles(px, py, pz, lx, ly, lz) {
  const dx = lx - px, dy = ly - py, dz = lz - pz;
  return { yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)) };
}

// bedroom interior bounds (entered through the door of the Yellow House)
const inBedroom = (x, z) => x > 50.4 && x < 56.2 && z < -41.3 && z > -47.8;
const BEDROOM_DOOR = [52.9, -38.6];

export class Player {
  constructor(camera, dom, segs) {
    this.cam = camera; this.dom = dom; this.segs = segs;
    this.x = 0; this.z = 0; this.y = EYE; this.yaw = 0; this.pitch = 0; this.fov = 62;
    this.keys = new Set();
    this.fly = null; this.enabled = false; this.onInput = null;
    this.look = { dx: 0, dy: 0 };
    this.joy = { x: 0, y: 0, id: null, ox: 0, oy: 0 };
    this.bob = 0; this.run = false;
    this._bind();
  }

  set(x, z, yaw, pitch, fov) { this.x = x; this.z = z; this.yaw = yaw; this.pitch = pitch; if (fov) this.fov = fov; this.y = H(x, z) + EYE; this._apply(); }

  _bind() {
    const dom = this.dom;
    addEventListener('keydown', (e) => {
      if (!this.enabled || e.target.tagName === 'INPUT') return;
      const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift', 'q', 'e'].includes(k)) {
        this.keys.add(k); this.onInput && this.onInput('move');
        if (k.startsWith('arrow')) e.preventDefault();
      }
    });
    addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    addEventListener('blur', () => this.keys.clear());

    let drag = null;
    dom.addEventListener('pointerdown', (e) => {
      if (!this.enabled || e.pointerType === 'touch') return;
      drag = { x: e.clientX, y: e.clientY, moved: 0 };
    });
    addEventListener('pointermove', (e) => {
      if (!this.enabled || e.pointerType === 'touch') return;
      if (document.pointerLockElement === dom) { this._turn(e.movementX, e.movementY, 0.0022); return; }
      if (drag) {
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy);
        this._turn(dx, dy, 0.0042);
      }
    });
    addEventListener('pointerup', (e) => {
      if (e.pointerType === 'touch') return;
      if (drag && drag.moved < 4 && this.enabled && !this.fly && dom.requestPointerLock) {
        try { const p = dom.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (_) { /* ignore */ }
      }
      drag = null;
    });

    // touch: left half = joystick, right half = look
    const touches = new Map();
    dom.addEventListener('touchstart', (e) => {
      if (!this.enabled) return;
      for (const t of e.changedTouches) {
        const left = t.clientX < innerWidth * 0.45;
        if (left && this.joy.id === null) { this.joy.id = t.identifier; this.joy.ox = t.clientX; this.joy.oy = t.clientY; this._joyUI(true, t.clientX, t.clientY, 0, 0); }
        else touches.set(t.identifier, { x: t.clientX, y: t.clientY });
      }
      this.onInput && this.onInput('touch');
      e.preventDefault();
    }, { passive: false });
    dom.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.joy.id) {
          let dx = t.clientX - this.joy.ox, dy = t.clientY - this.joy.oy;
          const l = Math.hypot(dx, dy), m = 55;
          if (l > m) { dx *= m / l; dy *= m / l; }
          this.joy.x = dx / m; this.joy.y = dy / m;
          this._joyUI(true, this.joy.ox, this.joy.oy, dx, dy);
        } else if (touches.has(t.identifier)) {
          const p = touches.get(t.identifier);
          this._turn(t.clientX - p.x, t.clientY - p.y, 0.005);
          p.x = t.clientX; p.y = t.clientY;
        }
      }
      e.preventDefault();
    }, { passive: false });
    const end = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.joy.id) { this.joy.id = null; this.joy.x = 0; this.joy.y = 0; this._joyUI(false); }
        touches.delete(t.identifier);
      }
    };
    dom.addEventListener('touchend', end); dom.addEventListener('touchcancel', end);
  }

  _joyUI(show, x, y, dx, dy) {
    const el = document.getElementById('joy');
    if (!el) return;
    el.style.display = show ? 'block' : 'none';
    if (show) { el.style.left = x + 'px'; el.style.top = y + 'px'; el.firstElementChild.style.transform = `translate(${dx}px, ${dy}px)`; }
  }

  _turn(dx, dy, k) {
    if (this.fly) { this.onInput && this.onInput('look'); if (this.fly) return; }
    this.yaw -= dx * k; this.pitch = clamp(this.pitch - dy * k, -1.35, 1.35);
    this.onInput && this.onInput('look');
  }

  flyTo(p, onDone) {
    const [tx, tz] = p.vp.pos;
    const ty = H(tx, tz) + EYE;
    const a = lookAngles(tx, ty, tz, ...p.vp.look);
    const legs = [];
    let sx = this.x, sy = this.y, sz = this.z;
    if (inBedroom(sx, sz)) {
      // walk out through the door first
      const [dx, dz] = BEDROOM_DOOR;
      legs.push({ from: [sx, sy, sz], to: [dx, H(dx, dz) + EYE, dz], arc: 0, dur: 1.6 });
      sx = dx; sz = dz; sy = H(dx, dz) + EYE;
    }
    if (p.id === 'bedroom') {
      const [dx, dz] = BEDROOM_DOOR;
      const ay = H(dx, dz) + EYE;
      const dist = Math.hypot(dx - sx, dz - sz);
      if (dist > 1) legs.push({ from: [sx, sy, sz], to: [dx, ay, dz], arc: Math.min(34, dist * 0.32), dur: clamp(2.2 + dist / 26, 2.4, 8) });
      legs.push({ from: [dx, ay, dz], to: [tx, ty, tz], arc: 0, dur: 2.4 });
    } else {
      const dist = Math.hypot(tx - sx, tz - sz);
      legs.push({ from: [sx, sy, sz], to: [tx, ty, tz], arc: dist < 8 ? 0 : Math.min(38, 4 + dist * 0.3), dur: clamp(2.2 + dist / 26, 1.5, 9) });
    }
    const total = legs.reduce((s, l) => s + l.dur, 0);
    this.fly = { legs, total, t: 0, yaw0: this.yaw, pitch0: this.pitch, fov0: this.fov, yaw1: a.yaw, pitch1: a.pitch, fov1: p.vp.fov, onDone };
    if (document.pointerLockElement) document.exitPointerLock();
  }

  cancelFly() { this.fly = null; }

  update(dt, t) {
    if (this.fly) {
      const f = this.fly;
      f.t += dt;
      let acc = 0, leg = f.legs[f.legs.length - 1], lt = 1;
      for (const l of f.legs) { if (f.t < acc + l.dur) { leg = l; lt = (f.t - acc) / l.dur; break; } acc += l.dur; }
      const e = ease(clamp(lt, 0, 1));
      this.x = leg.from[0] + (leg.to[0] - leg.from[0]) * e;
      this.z = leg.from[2] + (leg.to[2] - leg.from[2]) * e;
      const ground = H(this.x, this.z) + EYE;
      this.y = Math.max(ground, leg.from[1] + (leg.to[1] - leg.from[1]) * e + leg.arc * Math.sin(Math.PI * e));
      const g = ease(clamp(f.t / f.total, 0, 1));
      const high = f.legs.reduce((m, l) => Math.max(m, l.arc), 0) > 6;
      // look where we fly, then settle on the painter's view
      const ldx = leg.to[0] - leg.from[0], ldz = leg.to[2] - leg.from[2];
      const travel = Math.hypot(ldx, ldz) > 3 ? Math.atan2(-ldx, -ldz) : f.yaw1;
      const g1 = clamp(f.t / Math.min(1.6, f.total * 0.3), 0, 1), g2 = clamp((g - 0.55) / 0.45, 0, 1);
      const yA = f.yaw0 + angDiff(f.yaw0, travel) * (g1 * g1 * (3 - 2 * g1));
      this.yaw = yA + angDiff(yA, f.yaw1) * (g2 * g2 * (3 - 2 * g2));
      this.pitch = f.pitch0 + (f.pitch1 - f.pitch0) * g - (high ? 0.42 * Math.sin(Math.PI * g) : 0);
      this.fov = f.fov0 + (f.fov1 - f.fov0) * g;
      if (f.t >= f.total) { this.fly = null; f.onDone && f.onDone(); }
      this._apply();
      return;
    }
    if (!this.enabled) { this._apply(); if (!this.idleDrift) return; this.cam.rotation.y += Math.sin(t * 0.13) * 0.035; this.cam.rotation.x += Math.sin(t * 0.09) * 0.012; return; }
    const k = this.keys;
    let fx = 0, fz = 0;
    if (k.has('w') || k.has('arrowup')) fz += 1;
    if (k.has('s') || k.has('arrowdown')) fz -= 1;
    if (k.has('a')) fx -= 1;
    if (k.has('d')) fx += 1;
    if (k.has('arrowleft') || k.has('q')) this.yaw += dt * 1.8;
    if (k.has('arrowright') || k.has('e')) this.yaw -= dt * 1.8;
    fz -= this.joy.y; fx += this.joy.x;
    const len = Math.hypot(fx, fz);
    const speed = (k.has('shift') ? 7.5 : 3.4) * (len > 1 ? 1 / len : 1);
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    let nx = this.x + (-sy * fz + cy * fx) * speed * dt;
    let nz = this.z + (-cy * fz - sy * fx) * speed * dt;
    [nx, nz] = this._collide(nx, nz);
    const moved = Math.hypot(nx - this.x, nz - this.z);
    this.x = nx; this.z = nz;
    this.bob += moved * 1.9;
    const target = H(this.x, this.z) + EYE + Math.sin(this.bob) * 0.035 * Math.min(1, moved / (dt * 3 + 1e-4));
    this.y += (target - this.y) * Math.min(1, dt * 12);
    this.fov += (62 - this.fov) * Math.min(1, dt * 0.8) * (moved > 0.001 ? 1 : 0);
    this._apply();
  }

  _collide(x, z) {
    const R = 0.32;
    for (let it = 0; it < 3; it++) {
      for (const s of this.segs) {
        const [ax, az, bx, bz] = s;
        if (x < Math.min(ax, bx) - 1 || x > Math.max(ax, bx) + 1 || z < Math.min(az, bz) - 1 || z > Math.max(az, bz) + 1) continue;
        const dx = bx - ax, dz = bz - az;
        const l2 = dx * dx + dz * dz || 1e-6;
        const t = clamp(((x - ax) * dx + (z - az) * dz) / l2, 0, 1);
        const px = ax + dx * t, pz = az + dz * t;
        let ex = x - px, ez = z - pz;
        const d = Math.hypot(ex, ez);
        if (d < R) {
          if (d < 1e-5) { ex = -dz; ez = dx; const l = Math.hypot(ex, ez); ex /= l; ez /= l; } else { ex /= d; ez /= d; }
          x = px + ex * R; z = pz + ez * R;
        }
      }
    }
    return [x, z];
  }

  _apply() {
    const c = this.cam;
    c.position.set(this.x, this.y, this.z);
    c.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    if (Math.abs(c.fov - this.fov) > 0.01) { c.fov = this.fov; c.updateProjectionMatrix(); }
  }
}
