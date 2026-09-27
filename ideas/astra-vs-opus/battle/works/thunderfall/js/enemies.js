// 敌人：杂兵、地面单位、中型舰、五关 BOSS，以及它们的弹幕模式
import { TAU, rand, randi, pick, clamp, lerp } from './util.js';

const PI = Math.PI;

export function mk(G, o) {
  const e = Object.assign({
    t: 0, hp: 10, hw: 14, hh: 14, alive: true, layer: 1, score: 100, drop: 0, flash: 0,
    rot: 0, entered: false, st: {}, ground: false, shadow: true, parts: null,
  }, o);
  e.maxHp = e.hp;
  if (e.path) { const p = e.path(Math.max(0, e.t)); e.x = p[0]; e.y = p[1]; }
  G.enemies.push(e);
  return e;
}

export function tick(st, key, iv, dt, first = 0) {
  if (st[key] === undefined) st[key] = first;
  st[key] -= dt;
  if (st[key] <= 0) { st[key] += iv; return true; }
  return false;
}

function angLerp(a, b, k) {
  let d = ((b - a + PI) % TAU + TAU) % TAU - PI;
  return a + d * k;
}

function followPath(e, dt) {
  const p = e.path(e.t);
  const dx = p[0] - e.x, dy = p[1] - e.y;
  if (dt > 0 && dx * dx + dy * dy > 0.01) e.rot = angLerp(e.rot, Math.atan2(dy, dx) + PI / 2, Math.min(1, dt * 10));
  e.x = p[0]; e.y = p[1];
}

// ---------- 路径 ----------
// 海龟式路径：直线段与圆弧段，按弧长均匀采样
export function turtle(x, y, heading, segs, speed) {
  const pts = [[x, y]];
  let h = heading;
  for (const s of segs) {
    if (s[0] === 's') {
      const n = Math.max(1, Math.ceil(s[1] / 4));
      for (let i = 0; i < n; i++) { x += Math.cos(h) * (s[1] / n); y += Math.sin(h) * (s[1] / n); pts.push([x, y]); }
    } else {
      const r = s[1], ang = s[2];
      const arc = Math.abs(ang) * r, n = Math.max(2, Math.ceil(arc / 4));
      for (let i = 0; i < n; i++) { h += ang / n; x += Math.cos(h) * (arc / n); y += Math.sin(h) * (arc / n); pts.push([x, y]); }
    }
  }
  const ex = Math.cos(h), ey = Math.sin(h);
  const step = 4;
  return (t) => {
    const d = Math.max(0, t) * speed / step;
    const i = Math.floor(d);
    if (i >= pts.length - 1) { const over = (d - (pts.length - 1)) * step; const L = pts[pts.length - 1]; return [L[0] + ex * over, L[1] + ey * over]; }
    const f = d - i, A = pts[i], B = pts[i + 1];
    return [A[0] + (B[0] - A[0]) * f, A[1] + (B[1] - A[1]) * f];
  };
}

export const P = {
  dive: (x0, spd, sway = 0, f = 2) => (t) => [x0 + sway * Math.sin(t * f), -40 + spd * t],
  line: (x0, y0, x1, y1, spd) => { const d = Math.hypot(x1 - x0, y1 - y0); return (t) => [x0 + ((x1 - x0) / d) * spd * t, y0 + ((y1 - y0) / d) * spd * t]; },
};

// ---------- 杂兵 ----------
export function fighter(G, o) {
  const e = mk(G, {
    kind: 'zako', spr: o.spr || 'zako', hp: (o.hp || 3) * G.hpMul, hw: 16, hh: 16, score: 150, drop: 0.05,
    path: o.path, t: -(o.delay || 0), fire: o.fire || 'aim', fireAt: o.fireAt ?? rand(0.7, 1.6), rot: PI,
  });
  e.ai = (e, G, dt) => {
    followPath(e, dt);
    if (e.fire !== 'none' && !e.st.fired && e.t >= e.fireAt && e.y > 40 && e.y < G.H * 0.62) {
      e.st.fired = true;
      const a = G.aimAng(e.x, e.y);
      if (e.fire === 'aim') G.shoot(e.x, e.y + 8, a, 210, 'o');
      else if (e.fire === 'fan') G.fan(e.x, e.y + 8, a, 3, 0.32, 200, 'p');
      else if (e.fire === 'burst') { for (let i = 0; i < 3; i++) G.shoot(e.x, e.y + 8, a, 170 + i * 45, 'o'); }
      else if (e.fire === 'wave') G.shoot(e.x, e.y + 8, a, 170, 'g', { wave: { amp: 26, f: 6 } });
    }
  };
  return e;
}

export function heli(G, o) {
  const e = mk(G, {
    kind: 'heli', spr: 'heli', hp: 13 * G.hpMul, hw: 18, hh: 22, score: 400, drop: 0.14, rotor: true,
    x: o.x, y: -50, ty: o.ty || rand(150, 330), hold: o.hold || 4.5, t: -(o.delay || 0), rot: PI,
  });
  e.ai = (e, G, dt) => {
    const t = e.t;
    if (t < 1.4) e.y = lerp(-50, e.ty, 1 - (1 - t / 1.4) ** 3);
    else if (t < 1.4 + e.hold) {
      e.x += Math.sin(t * 1.3 + e.ty) * 22 * dt;
      e.rot = angLerp(e.rot, G.aimAng(e.x, e.y) - PI / 2, dt * 3);
      if (tick(e.st, 'f', 1.5 / G.fireMul, dt, 0.5)) {
        const a = G.aimAng(e.x, e.y);
        if (o.pattern === 'wave') G.fan(e.x, e.y, a, 3, 0.5, 170, 'g', { wave: { amp: 20, f: 5 } });
        else G.fan(e.x, e.y, a, 3, 0.26, 200, 'o');
        G.sfx('eshot');
      }
    } else { e.y += 150 * dt; e.x += (e.x < G.W / 2 ? -40 : 40) * dt; e.rot = angLerp(e.rot, PI, dt * 3); }
  };
  return e;
}

export function tank(G, o) {
  const skin = o.skin || 'tankA';
  const e = mk(G, {
    kind: 'tank', spr: skin, tspr: skin + '_t', hp: 14 * G.hpMul, hw: 15, hh: 18, score: 500, drop: 0.08, layer: 0, ground: true, shadow: false,
    x: o.x, y: o.y ?? -30, vx: o.vx || 0, vy: o.vy ?? 18, rot: 0, tur: PI / 2, t: -(o.delay || 0),
  });
  e.rot = Math.atan2(e.vy + 0.001, e.vx) - PI / 2 + PI;
  e.ai = (e, G, dt) => {
    e.x += e.vx * dt; e.y += (e.vy + G.scrollSpeed) * dt;
    const want = G.aimAng(e.x, e.y);
    e.tur = angLerp(e.tur, want, dt * 2.2);
    if (e.y > 30 && e.y < G.H * 0.8 && tick(e.st, 'f', 2.1 / G.fireMul, dt, rand(0.6, 1.6))) {
      G.shoot(e.x + Math.cos(e.tur) * 20, e.y + Math.sin(e.tur) * 20, e.tur, 185, 'y');
      G.puff(e.x + Math.cos(e.tur) * 22, e.y + Math.sin(e.tur) * 22, 0.5);
    }
  };
  return e;
}

export function bunker(G, o) {
  const e = mk(G, {
    kind: 'bunker', spr: o.skin || 'bunker', tspr: 'bunker_g', hp: 30 * G.hpMul, hw: 20, hh: 20, score: 800, drop: 0.15, layer: 0, ground: true, shadow: false,
    x: o.x, y: o.y ?? -30, rot: 0, tur: PI / 2, pattern: o.pattern || 'fan', t: -(o.delay || 0),
  });
  e.ai = (e, G, dt) => {
    e.y += G.scrollSpeed * dt;
    if (e.pattern === 'spin') e.tur += dt * 1.8;
    else e.tur = angLerp(e.tur, G.aimAng(e.x, e.y), dt * 1.8);
    if (e.y > 40 && e.y < G.H * 0.75) {
      if (e.pattern === 'spin') { if (tick(e.st, 'f', 0.22 / G.fireMul, dt)) { G.shoot(e.x, e.y, e.tur, 150, 'p'); G.shoot(e.x, e.y, e.tur + PI, 150, 'p'); } }
      else if (tick(e.st, 'f', 2.2 / G.fireMul, dt, 0.8)) { G.fan(e.x, e.y, e.tur, 5, 0.55, 180, 'o'); G.sfx('eshot'); }
    }
  };
  return e;
}

export function boat(G, o) {
  const e = mk(G, {
    kind: 'boat', spr: 'boat', tspr: 'bunker_g', hp: 18 * G.hpMul, hw: 12, hh: 26, score: 600, drop: 0.1, layer: 0, ground: true, shadow: false,
    x: o.x, y: -40, vy: o.vy ?? -14, rot: 0, tur: PI / 2, t: -(o.delay || 0), wake: true,
  });
  e.ai = (e, G, dt) => {
    e.y += (e.vy + G.scrollSpeed) * dt;
    e.tur = angLerp(e.tur, G.aimAng(e.x, e.y), dt * 2);
    if (e.y > 30 && e.y < G.H * 0.8 && tick(e.st, 'f', 1.9 / G.fireMul, dt, 1)) { G.shoot(e.x, e.y, e.tur, 190, 'y'); G.shoot(e.x, e.y, e.tur, 150, 'y'); }
    if (tick(e.st, 'w', 0.12, dt)) G.wake(e.x, e.y + 26);
  };
  return e;
}

export function bomber(G, o) {
  const e = mk(G, {
    kind: 'bomber', spr: 'bomber', hp: 110 * G.hpMul, hw: 50, hh: 30, score: 3000, drop: 0.7, big: true,
    x: o.x, y: -60, rot: PI, ty: o.ty || 190, t: -(o.delay || 0),
  });
  e.ai = (e, G, dt) => {
    const t = e.t;
    if (t < 3) e.y = lerp(-60, e.ty, 1 - (1 - t / 3) ** 2);
    else if (t < 14) {
      e.x += Math.sin(t * 0.8) * 20 * dt;
      if (tick(e.st, 'r', 2.4 / G.fireMul, dt, 0.3)) {
        e.st.alt = !e.st.alt;
        if (e.st.alt) G.ring(e.x, e.y + 10, 14, 130, 'b', rand(0, 1), { wave: { amp: 14, f: 4 } });
        else G.fan(e.x, e.y + 20, G.aimAng(e.x, e.y), 5, 0.6, 200, 'p');
        G.sfx('eshot');
      }
      if (tick(e.st, 'm', 3.6, dt, 1.5)) { G.emissile(e.x - 34, e.y + 10, PI / 2); G.emissile(e.x + 34, e.y + 10, PI / 2); }
    } else e.y += 55 * dt;
  };
  return e;
}

export function gunship(G, o) {
  const e = mk(G, {
    kind: 'gunship', spr: 'gunship', hp: 70 * G.hpMul, hw: 26, hh: 30, score: 2500, drop: 0.55, big: true,
    x: o.x, y: -60, rot: PI, ty: o.ty || rand(130, 200), t: -(o.delay || 0), cycles: o.cycles || 2,
  });
  e.ai = (e, G, dt) => {
    const t = e.t;
    if (t < 2) { e.y = lerp(-60, e.ty, 1 - (1 - t / 2) ** 2); return; }
    const c = e.st.c || 0;
    if (c < e.cycles) {
      e.st.lt = (e.st.lt || 0) + dt;
      if (!e.st.fired) {
        e.st.fired = true;
        const a = o.straight ? PI / 2 : G.aimAng(e.x, e.y);
        e.rot = a - PI / 2;
        G.laser({ owner: e, ox: 0, oy: 36, ang: a, warn: 1.0, dur: 1.1, w: 24, sweep: o.sweep ? (G.player.x > e.x ? 0.25 : -0.25) : 0 });
      }
      if (e.st.lt > 3.4) { e.st.lt = 0; e.st.fired = false; e.st.c = c + 1; }
      else if (e.st.lt > 2.2 && tick(e.st, 'b', 0.4, dt)) G.fan(e.x, e.y + 20, G.aimAng(e.x, e.y), 2, 0.5, 180, 'v');
    } else { e.y -= 90 * dt; e.rot = angLerp(e.rot, 0, dt * 2); if (e.y < -80) e.alive = false; }
  };
  return e;
}

export function saucer(G, o) {
  const x0 = o.x;
  const e = mk(G, {
    kind: 'saucer', spr: 'saucer', hp: 22 * G.hpMul, hw: 20, hh: 20, score: 700, drop: 0.16, spin: true,
    path: (t) => [x0 + Math.sin(t * 1.3) * (o.amp || 110), -30 + (o.spd || 70) * t], t: -(o.delay || 0),
  });
  e.ai = (e, G, dt) => {
    const p = e.path(e.t); e.x = p[0]; e.y = p[1];
    e.rot += dt * 3;
    if (e.y > 40 && e.y < G.H * 0.6 && tick(e.st, 'f', 1.9 / G.fireMul, dt, 0.8)) {
      G.ring(e.x, e.y, 8, 120, 'v', e.t, { wave: { amp: 18, f: 4.5 } });
      G.sfx('eshot');
    }
  };
  return e;
}

export function carrier(G, o) {
  const fromL = o.side !== 'R';
  const y0 = o.y || 180;
  const e = mk(G, {
    kind: 'carrier', spr: 'carrier', hp: 38 * G.hpMul, hw: 40, hh: 22, score: 1500, drop: 1, carrier: true, big: true,
    path: (t) => [fromL ? -60 + 75 * t : G.W + 60 - 75 * t, y0 + Math.sin(t * 1.2) * 24], t: -(o.delay || 0), rot: fromL ? PI / 2 : -PI / 2,
  });
  e.ai = (e, G, dt) => { followPath(e, dt); };
  return e;
}

export function emissile(G, x, y, ang) {
  const e = mk(G, {
    kind: 'missile', spr: 'emissile', hp: 2, hw: 6, hh: 10, score: 100, drop: 0, x, y, rot: ang + PI / 2, vang: ang, spd: 90, bodyHit: true, smallFx: true,
  });
  e.ai = (e, G, dt) => {
    e.spd = Math.min(260 * G.bs, e.spd + 150 * dt);
    if (e.t < 1.6) e.vang = angLerp(e.vang, G.aimAng(e.x, e.y), dt * 1.8);
    e.x += Math.cos(e.vang) * e.spd * dt; e.y += Math.sin(e.vang) * e.spd * dt;
    e.rot = e.vang + PI / 2;
    if (tick(e.st, 'tr', 0.05, dt)) G.trail(e.x - Math.cos(e.vang) * 10, e.y - Math.sin(e.vang) * 10);
  };
  return e;
}

export function rock(G, o) {
  const sz = o.size || pick([1, 2, 3]);
  const spr = ['rock2', 'rock1', 'rock3'][sz - 1];
  const r = [16, 24, 34][sz - 1];
  const e = mk(G, {
    kind: 'rock', spr, hp: [10, 22, 40][sz - 1] * G.hpMul, hw: r, hh: r, score: 200 * sz, drop: 0.06 * sz, bodyHit: true, shadow: false,
    x: o.x ?? rand(30, G.W - 30), y: -r - 10, vx: o.vx ?? rand(-30, 30), vy: o.vy ?? rand(70, 130), spinV: rand(-1.5, 1.5), t: -(o.delay || 0), rockSize: sz,
  });
  e.ai = (e, G, dt) => { e.x += e.vx * dt; e.y += e.vy * dt; e.rot += e.spinV * dt; };
  e.onKill = (e, G) => { if (e.rockSize > 1) for (let i = 0; i < 2; i++) { const c = rock(G, { size: e.rockSize - 1, x: e.x, vx: rand(-80, 80), vy: rand(60, 120) }); c.y = e.y; c.t = 0; } };
  return e;
}

// ---------- 中型舰（中 BOSS） ----------
export function cruiser(G, o) {
  const e = mk(G, {
    kind: 'cruiser', spr: 'cruiser', hp: 560 * G.hpMul, hw: 70, hh: 60, score: 20000, drop: 1, dropN: 2, big: true, mid: true,
    x: G.W / 2, y: -100, rot: 0, t: 0, life: o.life || 32,
  });
  e.parts = [];
  for (const [ox, oy] of [[-26, 10], [26, 10], [0, 50]]) {
    const p = mk(G, { kind: 'turret', spr: 'bturret', hp: 70 * G.hpMul, hw: 11, hh: 11, score: 1500, parent: e, ox, oy, tur: PI / 2, noShadow: true, shadow: false });
    p.ai = (p, G, dt) => {
      p.tur = angLerp(p.tur, G.aimAng(p.x, p.y), dt * 2.5);
      if (e.t > 3 && tick(p.st, 'f', 1.8 / G.fireMul, dt, rand(0.3, 1.5))) G.fan(p.x, p.y, p.tur, 3, 0.3, 190, 'o');
    };
    e.parts.push(p);
  }
  e.ai = (e, G, dt) => {
    const t = e.t;
    if (t < 3) { e.y = lerp(-100, 190, 1 - (1 - t / 3) ** 2); e.inv = true; return; }
    e.inv = false;
    if (t > e.life) { e.y -= 60 * dt; if (e.y < -120) { e.alive = false; e.parts.forEach((p) => (p.alive = false)); } return; }
    e.x = G.W / 2 + Math.sin(t * 0.5) * 110;
    if (tick(e.st, 'r', 3 / G.fireMul, dt, 1)) { G.ring(e.x, e.y + 40, 18, 150, 'p', t); G.sfx('eshot'); }
    if (tick(e.st, 'l', 7, dt, 4)) { G.laser({ owner: e, ox: -60, oy: -40, ang: PI / 2, warn: 0.9, dur: 1.2, w: 20, sweep: 0.18 }); G.laser({ owner: e, ox: 60, oy: -40, ang: PI / 2, warn: 0.9, dur: 1.2, w: 20, sweep: -0.18 }); }
    if (tick(e.st, 'w', 2.2 / G.fireMul, dt, 2)) for (let i = -2; i <= 2; i++) G.shoot(e.x + i * 24, e.y + 60, PI / 2, 140, 'g', { wave: { amp: 30, f: 3, ph: i } });
  };
  return e;
}

// ---------- BOSS 通用 ----------
function bossBase(G, o) {
  const e = mk(G, Object.assign({ boss: true, big: true, layer: 2, hp: o.hp * G.hpMul, rot: 0, inv: true, phase: 0, score: 100000, t: 0, x: G.W / 2, y: -o.hh - 40, drop: 0 }, o));
  e.maxHp = e.hp;
  e.parts = [];
  const k = e.sc || 1;
  e.hw *= k; e.hh *= k;
  if (e.hitRects) e.hitRects = e.hitRects.map((r) => r.map((v) => v * k));
  return e;
}
function addPart(G, e, o) {
  const k = e.sc || 1;
  if (o.ox !== undefined) { o.ox *= k; o.oy *= k; }
  const p = mk(G, Object.assign({ kind: 'turret', spr: 'bturret', hw: 11, hh: 11, score: 3000, parent: e, tur: PI / 2, shadow: false, layer: e.layer, t: 0 }, o, { hp: (o.hp || 90) * G.hpMul }));
  p.maxHp = p.hp;
  e.parts.push(p);
  return p;
}
function aimTurret(p, G, dt, k = 2.5) { p.tur = angLerp(p.tur, G.aimAng(p.x, p.y), dt * k); }

// 模式循环：每个阶段一组攻击，按时长轮换
function runPatterns(e, G, dt, list) {
  const c = e.cyc || (e.cyc = { i: 0, t: 0, st: {} });
  const pat = list[c.i % list.length];
  c.t += dt;
  pat.f(c.t, dt, c.st);
  if (c.t >= pat.d) { c.i++; c.t = 0; c.st = {}; }
}
function bossPhase(e, G, ths = [0.66, 0.33]) {
  const r = e.hp / e.maxHp;
  let ph = 0; for (const th of ths) if (r < th) ph++;
  if (ph !== e.phase) {
    e.phase = ph; e.cyc = null;
    G.cancelBullets(); G.explode(e.x + rand(-40, 40), e.y + rand(-30, 30), 2); G.shake(10); G.flashScreen(0.35);
  }
  return ph;
}
function enterBoss(e, G, dt, ty, dur = 3.5) {
  if (e.t < dur) { e.y = lerp(-e.hh - 40, ty, 1 - (1 - e.t / dur) ** 3); e.inv = true; return true; }
  e.inv = false; return false;
}

// 第一关：铁甲巨蟹
export function boss1(G) {
  const e = bossBase(G, { kind: 'boss1', spr: 'boss1', hp: 1450, hw: 70, hh: 70, name: '铁甲巨蟹', ground: false, shadow: true, sc: 1.3 });
  for (const ox of [-78, 78]) {
    const p = addPart(G, e, { ox, oy: -40, hp: 120 });
    p.ai = (p, G, dt) => { aimTurret(p, G, dt); if (e.t > 4 && tick(p.st, 'f', 1.7 / G.fireMul, dt, rand(0.5, 1.5))) G.fan(p.x, p.y, p.tur, 3, 0.28, 200, 'o'); };
  }
  for (const ox of [-82, 82]) {
    const p = addPart(G, e, { ox, oy: 36, hp: 120 });
    p.ai = (p, G, dt) => { aimTurret(p, G, dt); if (e.t > 4 && tick(p.st, 'f', 2.3 / G.fireMul, dt, rand(0.5, 1.5))) { G.shoot(p.x, p.y, p.tur, 230, 'y'); G.shoot(p.x, p.y, p.tur, 180, 'y'); } };
  }
  e.ai = (e, G, dt) => {
    if (enterBoss(e, G, dt, 200)) return;
    const ph = bossPhase(e, G);
    e.x = G.W / 2 + Math.sin(e.t * 0.45) * 120;
    const cx = e.x, cy = e.y + 70;
    const P0 = [
      { d: 3.2, f: (t, dt, s) => { if (tick(s, 'a', 0.5, dt)) { G.fan(cx, cy, G.aimAng(cx, cy), 5, 0.5, 210, 'p'); G.sfx('eshot'); } } },
      { d: 2.5, f: (t, dt, s) => { if (tick(s, 'a', 0.8, dt)) G.ring(e.x, e.y, 22, 150, 'o', t * 3); } },
      { d: 3, f: (t, dt, s) => { if (tick(s, 'a', 1, dt, 0.2)) G.shoot(cx, cy, G.aimAng(cx, cy), 160, 'big', { r: 9, split: { t: 0.9, n: 10, spd: 150, type: 'o' } }); } },
    ];
    const P1 = [
      { d: 3.6, f: (t, dt, s) => { if (tick(s, 'a', 0.22, dt)) G.shoot(e.x + rand(-60, 60), cy - 20, PI / 2 + rand(-0.3, 0.3), 140, 'g', { wave: { amp: 30, f: 3.5, ph: t * 4 } }); } },
      { d: 3.2, f: (t, dt, s) => { if (!s.l) { s.l = 1; G.laser({ owner: e, ox: -10, oy: 76, ang: PI / 2 - 0.35, warn: 1, dur: 1.8, w: 22, sweep: 0.35 }); G.laser({ owner: e, ox: 10, oy: 76, ang: PI / 2 + 0.35, warn: 1, dur: 1.8, w: 22, sweep: -0.35 }); } } },
      { d: 3, f: (t, dt, s) => { if (tick(s, 'a', 0.45, dt)) { G.fan(cx, cy, G.aimAng(cx, cy), 7, 0.9, 190, 'p'); } } },
    ];
    const P2 = [
      { d: 4, f: (t, dt, s) => { if (tick(s, 'a', 0.09, dt)) { for (let k = 0; k < 3; k++) G.shoot(e.x, e.y, t * 2.2 + (k * TAU) / 3, 160, 'p'); } } },
      { d: 3, f: (t, dt, s) => { if (tick(s, 'a', 0.9, dt)) G.shoot(cx, cy, G.aimAng(cx, cy), 170, 'big', { r: 9, split: { t: 0.7, n: 14, spd: 160, type: 'o' } }); if (tick(s, 'b', 0.3, dt)) G.shoot(e.x + rand(-80, 80), e.y, PI / 2, 130, 'g', { wave: { amp: 30, f: 4 } }); } },
    ];
    runPatterns(e, G, dt, [P0, P1, P2][ph]);
  };
  return e;
}

// 第二关：沙暴飞翼
export function boss2(G) {
  const e = bossBase(G, { kind: 'boss2', spr: 'boss2', hp: 1750, hw: 150, hh: 44, name: '沙暴飞翼', sc: 1.2, hitRects: [[0, 0, 36, 60], [0, -10, 170, 22]] });
  for (const ox of [-120, -60, 60, 120]) {
    const p = addPart(G, e, { ox, oy: Math.abs(ox) > 100 ? 0 : 20, hp: 110, spr: 'bturretD' });
    p.ai = (p, G, dt) => { aimTurret(p, G, dt); if (e.t > 4 && tick(p.st, 'f', 2 / G.fireMul, dt, rand(0.3, 2))) G.shoot(p.x, p.y, p.tur, 210, 'o'); };
  }
  e.ai = (e, G, dt) => {
    if (enterBoss(e, G, dt, 170)) return;
    const ph = bossPhase(e, G);
    e.x = G.W / 2 + Math.sin(e.t * 0.35) * 60;
    e.y = 170 + Math.sin(e.t * 0.7) * 16;
    const P0 = [
      { d: 3.4, f: (t, dt, s) => { if (!s.l) { s.l = 1; for (const ox of [-150, 150]) G.laser({ owner: e, ox, oy: 10, ang: PI / 2, warn: 1, dur: 1.9, w: 26, sweep: ox < 0 ? 0.22 : -0.22 }); } if (tick(s, 'a', 0.6, dt, 1)) G.fan(e.x, e.y + 60, G.aimAng(e.x, e.y), 3, 0.3, 200, 'p'); } },
      { d: 3.4, f: (t, dt, s) => { if (tick(s, 'a', 0.16, dt)) { const k = s.k = (s.k || 0) + 1; for (const sd of [-1, 1]) G.shoot(e.x + sd * 40, e.y + 40, PI / 2 + sd * 0.8, 170, 'y', { curve: -sd * 0.9 }); } } },
      { d: 2.6, f: (t, dt, s) => { if (tick(s, 'a', 0.9, dt, 0.1)) for (const sd of [-1, 1]) G.emissile(e.x + sd * 80, e.y + 20, PI / 2 + sd * 0.4); } },
    ];
    const P1 = [
      { d: 3.6, f: (t, dt, s) => { if (tick(s, 'a', 0.1, dt)) G.shoot(e.x, e.y + 50, PI / 2 + Math.sin(t * 3) * 1.1, 190, 'p', { curve: Math.sin(t * 3) > 0 ? 0.5 : -0.5 }); } },
      { d: 3.2, f: (t, dt, s) => { if (!s.l) { s.l = 1; for (const a of [-0.5, -0.17, 0.17, 0.5]) G.laser({ owner: e, ox: 0, oy: 50, ang: PI / 2 + a, warn: 1, dur: 1.5, w: 18 }); } } },
      { d: 3, f: (t, dt, s) => { if (tick(s, 'a', 0.5, dt)) G.ring(e.x, e.y + 40, 16, 140, 'b', t * 2, { wave: { amp: 16, f: 5 } }); } },
    ];
    const P2 = [
      { d: 4, f: (t, dt, s) => { if (tick(s, 'a', 0.07, dt)) { for (const sd of [-1, 1]) G.shoot(e.x + sd * 100, e.y + 10, PI / 2 + sd * (0.3 + Math.sin(t * 2) * 0.4), 200, sd < 0 ? 'y' : 'p', { curve: sd * 0.25 }); } if (tick(s, 'm', 1.6, dt)) G.emissile(e.x, e.y + 40, PI / 2); } },
      { d: 3.4, f: (t, dt, s) => { if (!s.l) { s.l = 1; G.laser({ owner: e, ox: 0, oy: 50, ang: PI / 2 - 0.9, warn: 1, dur: 2.2, w: 28, sweep: 0.8 }); } if (tick(s, 'a', 0.5, dt, 1)) G.fan(e.x, e.y + 50, G.aimAng(e.x, e.y), 5, 0.7, 180, 'o'); } },
    ];
    runPatterns(e, G, dt, [P0, P1, P2][ph]);
  };
  return e;
}

// 第三关：冰海战列舰（从上方驶入，舰体本身占据屏幕上半）
export function boss3(G) {
  const e = bossBase(G, { kind: 'boss3', spr: 'boss3', hp: 1850, hw: 46, hh: 180, name: '冰海战列舰', shadow: false, layer: 0, wake: true, hitRects: [[0, -40, 34, 50]] });
  const tspots = [[0, 120, 'main'], [0, 80, 'main'], [-40, -120, 's'], [40, -120, 's'], [0, -150, 'main'], [-42, 0, 's'], [42, 0, 's']];
  for (const [ox, oy, k] of tspots) {
    const p = addPart(G, e, { ox, oy, hp: k === 'main' ? 150 : 90, hw: k === 'main' ? 16 : 11, hh: k === 'main' ? 16 : 11, sc: k === 'main' ? 1.5 : 1 });
    p.ai = (p, G, dt) => {
      aimTurret(p, G, dt, 1.8);
      if (e.t < 4) return;
      if (k === 'main') { if (tick(p.st, 'f', 2.6 / G.fireMul, dt, rand(0.5, 2))) { G.shoot(p.x, p.y, p.tur, 170, 'big', { r: 9, split: { t: 1.0, n: 8, spd: 140, type: 'y' } }); G.puff(p.x + Math.cos(p.tur) * 26, p.y + Math.sin(p.tur) * 26, 1); } }
      else if (tick(p.st, 'f', 1.4 / G.fireMul, dt, rand(0.2, 1.4))) G.fan(p.x, p.y, p.tur, 3, 0.25, 200, 'o');
    };
  }
  e.ai = (e, G, dt) => {
    if (e.t < 5) { e.y = lerp(-e.hh - 60, 190, 1 - (1 - e.t / 5) ** 2); e.inv = true; return; }
    e.inv = false;
    const ph = bossPhase(e, G);
    e.x = G.W / 2 + Math.sin(e.t * 0.3) * 70;
    if (tick(e.st, 'wk', 0.1, dt)) { G.wake(e.x - 60, e.y + 150); G.wake(e.x + 60, e.y + 150); }
    const P0 = [
      { d: 3, f: (t, dt, s) => { if (tick(s, 'a', 0.6, dt)) { for (const sd of [-1, 1]) G.fan(e.x + sd * 60, e.y + rand(-100, 100), sd > 0 ? 0.2 : PI - 0.2, 4, 0.8, 150, 'b'); } } },
      { d: 3, f: (t, dt, s) => { if (tick(s, 'a', 0.25, dt)) G.shoot(e.x + rand(-50, 50), e.y + 180, PI / 2, 120, 'g', { wave: { amp: 40, f: 2.4, ph: t * 3 } }); } },
    ];
    const P1 = [
      { d: 3.2, f: (t, dt, s) => { if (tick(s, 'a', 1.1, dt, 0.1)) for (const sd of [-1, 1]) G.emissile(e.x + sd * 50, e.y - 60, PI / 2 + sd * 0.6); if (tick(s, 'b', 0.2, dt)) G.shoot(e.x, e.y + 190, PI / 2 + Math.sin(t * 4) * 0.9, 180, 'p'); } },
      { d: 3.4, f: (t, dt, s) => { if (!s.l) { s.l = 1; G.laser({ owner: e, ox: 0, oy: 190, ang: PI / 2, warn: 1.1, dur: 2, w: 34, sweep: G.player.x > e.x ? 0.3 : -0.3 }); } if (tick(s, 'a', 0.7, dt, 1)) G.ring(e.x, e.y - 40, 16, 140, 'b', t); } },
    ];
    const P2 = [
      { d: 4, f: (t, dt, s) => { if (tick(s, 'a', 0.11, dt)) for (let k = 0; k < 2; k++) G.shoot(e.x, e.y - 40, t * 1.7 + k * PI, 150, 'b', { wave: { amp: 12, f: 6 } }); if (tick(s, 'b', 1.2, dt)) G.fan(e.x, e.y + 190, G.aimAng(e.x, e.y + 190), 7, 0.8, 200, 'o'); } },
      { d: 3.4, f: (t, dt, s) => { if (!s.l) { s.l = 1; for (const a of [-0.6, 0, 0.6]) G.laser({ owner: e, ox: 0, oy: 190, ang: PI / 2 + a, warn: 1, dur: 1.6, w: 22, sweep: -a * 0.5 }); } } },
    ];
    runPatterns(e, G, dt, [P0, P1, P2][ph]);
  };
  return e;
}

// 第四关：天穹浮空要塞（外环旋转，炮台随环转动，核心可击破）
export function boss4(G) {
  const e = bossBase(G, { kind: 'boss4', spr: 'boss4', hp: 2100, hw: 50, hh: 50, name: '天穹要塞', spinA: 0, sc: 1.15, hitRects: [[0, 0, 56, 56]] });
  for (let i = 0; i < 6; i++) {
    const p = addPart(G, e, { ox: 0, oy: 0, hp: 110, ring: i, spr: 'bturretP' });
    p.ai = (p, G, dt) => { aimTurret(p, G, dt, 3); if (e.t > 4 && tick(p.st, 'f', 2.4 / G.fireMul, dt, rand(0.3, 2.4))) G.shoot(p.x, p.y, p.tur, 190, 'v'); };
  }
  e.partPos = (p) => { const a = e.spinA + (p.ring * TAU) / 6; return [Math.cos(a) * 112 * e.sc, Math.sin(a) * 112 * e.sc]; };
  e.ai = (e, G, dt) => {
    if (enterBoss(e, G, dt, 230, 4)) return;
    const ph = bossPhase(e, G);
    e.spinA += dt * (0.35 + ph * 0.2);
    e.x = G.W / 2 + Math.sin(e.t * 0.4) * 50;
    const P0 = [
      { d: 3.6, f: (t, dt, s) => { if (tick(s, 'a', 0.12, dt)) for (let k = 0; k < 4; k++) G.shoot(e.x, e.y, t * 1.4 + (k * TAU) / 4, 150, 'b'); } },
      { d: 3, f: (t, dt, s) => { if (tick(s, 'a', 0.7, dt)) G.ring(e.x, e.y, 20, 130, 'v', t, { wave: { amp: 20, f: 4 } }); } },
    ];
    const P1 = [
      { d: 4.2, f: (t, dt, s) => { if (!s.l) { s.l = 1; for (let k = 0; k < 3; k++) G.laser({ owner: e, ox: 0, oy: 0, ang: PI / 2 + (k - 1) * 2.1, warn: 1.1, dur: 2.8, w: 22, sweep: 0.55 }); } if (tick(s, 'a', 0.5, dt, 1.2)) G.fan(e.x, e.y, G.aimAng(e.x, e.y), 3, 0.4, 200, 'p'); } },
      { d: 3, f: (t, dt, s) => { if (tick(s, 'a', 0.16, dt)) G.shoot(e.x, e.y, rand(0.3, PI - 0.3), rand(110, 170), 'b', { acc: 40, curve: rand(-0.4, 0.4) }); } },
    ];
    const P2 = [
      { d: 4.6, f: (t, dt, s) => { if (!s.l) { s.l = 1; for (let k = 0; k < 4; k++) G.laser({ owner: e, ox: 0, oy: 0, ang: (k * TAU) / 4 + 0.4, warn: 1, dur: 3.4, w: 20, sweep: -0.6 }); } if (tick(s, 'a', 0.2, dt, 1)) G.shoot(e.x, e.y, t * 3, 150, 'v', { wave: { amp: 14, f: 5 } }); } },
      { d: 3, f: (t, dt, s) => { if (tick(s, 'a', 0.6, dt)) { G.ring(e.x, e.y, 24, 140, 'b', t); G.ring(e.x, e.y, 24, 100, 'v', t + 0.13); } } },
    ];
    runPatterns(e, G, dt, [P0, P1, P2][ph]);
  };
  return e;
}

// 第五关：雷霆母舰（三阶段最终 BOSS）
export function boss5(G) {
  const e = bossBase(G, { kind: 'boss5', spr: 'boss5', hp: 2800, hw: 44, hh: 44, name: '雷霆母舰·终焉', sc: 1.12, hitRects: [[0, 20, 40, 44]] });
  const spots = [[-150, -10], [150, -10], [-90, 30], [90, 30], [-40, 110], [40, 110]];
  for (const [ox, oy] of spots) {
    const p = addPart(G, e, { ox, oy, hp: 120, spr: 'bturretP' });
    p.ai = (p, G, dt) => {
      aimTurret(p, G, dt, 2.5);
      if (e.t < 4) return;
      if (Math.abs(ox) > 120) { if (tick(p.st, 'f', 3.2 / G.fireMul, dt, rand(0.5, 2))) G.emissile(p.x, p.y, p.tur); }
      else if (tick(p.st, 'f', 1.6 / G.fireMul, dt, rand(0.3, 1.6))) G.fan(p.x, p.y, p.tur, 3, 0.22, 210, 'p');
    };
  }
  e.ai = (e, G, dt) => {
    if (enterBoss(e, G, dt, 200, 4.5)) return;
    const ph = bossPhase(e, G);
    e.x = G.W / 2 + Math.sin(e.t * 0.3) * 50;
    const cx = e.x, cy = e.y + 20;
    const P0 = [
      { d: 3.4, f: (t, dt, s) => { if (tick(s, 'a', 0.1, dt)) { G.shoot(cx, cy, t * 2.5, 160, 'v'); G.shoot(cx, cy, -t * 2.5 + PI, 160, 'p'); } } },
      { d: 3, f: (t, dt, s) => { if (!s.l) { s.l = 1; for (const ox of [-18, 18]) G.laser({ owner: e, ox, oy: 160, ang: PI / 2, warn: 1, dur: 1.8, w: 26, sweep: ox < 0 ? -0.3 : 0.3 }); } if (tick(s, 'a', 0.5, dt, 1)) G.ring(cx, cy, 16, 150, 'b', t); } },
      { d: 3, f: (t, dt, s) => { if (tick(s, 'a', 0.9, dt, 0.1)) G.shoot(cx, cy, G.aimAng(cx, cy), 150, 'bigv', { r: 9, split: { t: 0.8, n: 12, spd: 150, type: 'v', wave: { amp: 10, f: 5 } } }); } },
    ];
    const P1 = [
      { d: 4, f: (t, dt, s) => { if (tick(s, 'a', 0.13, dt)) for (let k = 0; k < 5; k++) G.shoot(cx, cy, t * 1.1 + (k * TAU) / 5, 140, 'p', { curve: 0.35 }); } },
      { d: 3.6, f: (t, dt, s) => { if (!s.l) { s.l = 1; for (let k = 0; k < 5; k++) G.laser({ owner: e, ox: 0, oy: 20, ang: PI / 2 + (k - 2) * 0.42, warn: 1.1, dur: 1.4, w: 18 }); } if (tick(s, 'a', 0.35, dt, 2.4)) G.fan(cx, cy, G.aimAng(cx, cy), 5, 0.5, 220, 'o'); } },
      { d: 3, f: (t, dt, s) => { if (tick(s, 'a', 0.2, dt)) G.shoot(rand(20, G.W - 20), -10, PI / 2, rand(110, 160), 'v', { wave: { amp: rand(20, 40), f: rand(2, 4) } }); } },
    ];
    const P2 = [
      { d: 5, f: (t, dt, s) => { if (!s.l) { s.l = 1; for (let k = 0; k < 3; k++) G.laser({ owner: e, ox: 0, oy: 20, ang: PI / 2 + (k - 1) * 0.9, warn: 1, dur: 3.8, w: 20, sweep: Math.sin(k + 1) > 0.5 ? 0.35 : -0.35 }); } if (tick(s, 'a', 0.08, dt, 1)) G.shoot(cx, cy, t * 3.3, 170, 'b', { wave: { amp: 10, f: 6 } }); } },
      { d: 3.4, f: (t, dt, s) => { if (tick(s, 'a', 0.45, dt)) { G.ring(cx, cy, 26, 150, 'p', t); } if (tick(s, 'b', 0.8, dt)) G.shoot(cx, cy, G.aimAng(cx, cy), 160, 'bigv', { r: 9, split: { t: 0.7, n: 10, spd: 170, type: 'p' } }); } },
    ];
    runPatterns(e, G, dt, [P0, P1, P2][ph]);
  };
  return e;
}

export const BOSSES = [boss1, boss2, boss3, boss4, boss5];
export { randi, clamp };
