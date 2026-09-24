// 2D 图表：工作循环（p-θ / p-V + 气门升程）、气门正时圆图、点火相位图、时间轴刷
import { STROKES, wrap720, valveLift, MAX_LIFT, VC, VD, volumeAt, sampleCycle } from './physics.js';

export const COLORS = {
  intake: '#3fa9ff', compression: '#9a86ff', power: '#ff6a2b', exhaust: '#dba445',
  grid: 'rgba(255,255,255,0.06)', axis: 'rgba(255,255,255,0.16)', text: '#7f8898', hi: '#e8ecf2',
};
const SC = { power: COLORS.power, exhaust: COLORS.exhaust, intake: COLORS.intake, compression: COLORS.compression };

const MONO = '"JetBrains Mono", "SF Mono", ui-monospace, Menlo, Consolas, monospace';
const SANS = '-apple-system, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", system-ui, sans-serif';

function fit(canvas) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return { ctx, w, h };
}
const alpha = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};
// ψ（0=点火上止点）→ 图上 x 坐标角（-360..360，进气在左）
export const psiToXa = (psi) => { const p = wrap720(psi); return p >= 360 ? p - 720 : p; };
const XBANDS = [
  { key: 'intake', a: -360, b: -180, name: '进气' },
  { key: 'compression', a: -180, b: 0, name: '压缩' },
  { key: 'power', a: 0, b: 180, name: '做功' },
  { key: 'exhaust', a: 180, b: 360, name: '排气' },
];

// ------------------------------------------------------------
export function drawCycle(canvas, { cycle, psi, view = 'ptheta', log = false, advance }) {
  const { ctx, w, h } = fit(canvas);
  if (view === 'pv') return drawPV(ctx, w, h, cycle, psi);
  const L = 34, R = 10, T = 16, B = 18;
  const W = w - L - R;
  const liftH = Math.round((h - T - B) * 0.25);
  const pH = h - T - B - liftH - 10;
  const X = (xa) => L + (xa + 360) / 720 * W;
  const pmaxBar = Math.max(20, Math.ceil(cycle.peak / 1e5 * 1.12 / 10) * 10);
  const Y = log
    ? (bar) => T + pH - (Math.log10(Math.max(0.2, bar)) - Math.log10(0.2)) / (Math.log10(pmaxBar * 1.3) - Math.log10(0.2)) * pH
    : (bar) => T + pH - bar / pmaxBar * pH;
  const yL0 = T + pH + 10, yL1 = yL0 + liftH;

  // 冲程色带
  ctx.font = `600 10px ${SANS}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const cur = psiToXa(psi);
  for (const b of XBANDS) {
    const active = cur >= b.a && cur < b.b;
    ctx.fillStyle = alpha(SC[b.key], active ? 0.12 : 0.045);
    ctx.fillRect(X(b.a), T, X(b.b) - X(b.a), yL1 - T);
    ctx.fillStyle = alpha(SC[b.key], active ? 1 : 0.55);
    ctx.fillRect(X(b.a) + 1, T - 12, X(b.b) - X(b.a) - 2, 2);
    ctx.fillText(b.name, (X(b.a) + X(b.b)) / 2, T - 5 + 0.5);
  }
  // 网格
  ctx.strokeStyle = COLORS.grid; ctx.lineWidth = 1;
  ctx.fillStyle = COLORS.text; ctx.font = `10px ${MONO}`; ctx.textAlign = 'right';
  const ticks = log ? [0.5, 1, 2, 5, 10, 20, 50, 100].filter((v) => v <= pmaxBar * 1.3) : Array.from({ length: pmaxBar / 10 + 1 }, (_, i) => i * 10).filter((v, i, arr) => arr.length < 9 || i % 2 === 0);
  for (const v of ticks) {
    const y = Math.round(Y(v)) + 0.5;
    ctx.beginPath(); ctx.moveTo(L, y); ctx.lineTo(w - R, y); ctx.stroke();
    ctx.fillText(String(v), L - 5, y);
  }
  ctx.save(); ctx.translate(9, T + pH / 2); ctx.rotate(-Math.PI / 2); ctx.textAlign = 'center';
  ctx.fillText('bar', 0, 0); ctx.restore();
  for (const xa of [-360, -180, 0, 180, 360]) {
    const x = Math.round(X(xa)) + 0.5;
    ctx.strokeStyle = xa === 0 ? 'rgba(255,255,255,0.22)' : COLORS.grid;
    ctx.beginPath(); ctx.moveTo(x, T); ctx.lineTo(x, yL1); ctx.stroke();
  }
  ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillStyle = COLORS.text;
  for (const [xa, t] of [[-360, 'TDC'], [-180, 'BDC'], [0, 'TDC'], [180, 'BDC'], [360, 'TDC']]) {
    const x = Math.min(w - R - 12, Math.max(L + 12, X(xa)));
    ctx.fillText(t, x, yL1 + 4);
  }

  // 压力曲线
  const grad = ctx.createLinearGradient(0, T, 0, T + pH);
  grad.addColorStop(0, 'rgba(255,106,43,0.42)'); grad.addColorStop(1, 'rgba(255,106,43,0.02)');
  ctx.beginPath();
  for (let xa = -360; xa <= 360; xa += 1) {
    const s = sampleCycle(cycle, xa);
    const x = X(xa), y = Y(s.p / 1e5);
    if (xa === -360) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = '#ffb27a'; ctx.lineWidth = 1.6; ctx.stroke();
  ctx.lineTo(X(360), T + pH); ctx.lineTo(X(-360), T + pH); ctx.closePath();
  ctx.fillStyle = grad; ctx.fill();

  // 点火
  const xs = X(-advance);
  ctx.setLineDash([3, 3]); ctx.strokeStyle = '#ffe07a'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(xs + 0.5, T + 4); ctx.lineTo(xs + 0.5, yL1); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = '#ffe07a'; ctx.font = `600 10px ${SANS}`; ctx.textAlign = 'right'; ctx.textBaseline = 'top';
  ctx.fillText('点火 ⚡', xs - 3, T + 3);
  // 峰值
  const xp = X(cycle.peakPsi), yp = Y(cycle.peak / 1e5);
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(xp, yp, 2.5, 0, 7); ctx.fill();
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.font = `10px ${MONO}`; ctx.fillStyle = '#ffd2b0';
  ctx.fillText(`${(cycle.peak / 1e5).toFixed(0)} bar @${cycle.peakPsi >= 0 ? '+' : ''}${cycle.peakPsi.toFixed(0)}°`, xp + 7, yp + 1);

  // 升程
  const ev = cycle.ev;
  const lmax = MAX_LIFT.intake * 1.08;
  const drawLift = (open, close, max, col) => {
    ctx.beginPath();
    for (let xa = -360; xa <= 360; xa += 2) {
      const l = valveLift(xa, open, close, max);
      const x = X(xa), y = yL1 - l / lmax * liftH;
      if (xa === -360) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.lineTo(X(360), yL1); ctx.lineTo(X(-360), yL1); ctx.closePath();
    ctx.fillStyle = alpha(col, 0.28); ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 1.2; ctx.stroke();
  };
  drawLift(ev.IVO, ev.IVC, MAX_LIFT.intake, COLORS.intake);
  drawLift(ev.EVO, ev.EVC, MAX_LIFT.exhaust, COLORS.exhaust);
  ctx.fillStyle = COLORS.text; ctx.font = `10px ${SANS}`; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  ctx.fillText('升程', L - 5, yL0 + liftH / 2);

  // 游标
  const xc = X(cur);
  const sc = sampleCycle(cycle, psi);
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(Math.round(xc) + 0.5, T); ctx.lineTo(Math.round(xc) + 0.5, yL1); ctx.stroke();
  const yc = Y(sc.p / 1e5);
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(xc, yc, 4, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(xc, yc, 8, 0, 7); ctx.stroke();
}

function drawPV(ctx, w, h, cycle, psi) {
  const L = 38, R = 12, T = 12, B = 22;
  const W = w - L - R, H = h - T - B;
  const vmin = VC * 1e6 * 0.85, vmax = (VC + VD) * 1e6 * 1.06;
  const pmin = 0.2, pmax = cycle.peak / 1e5 * 1.5;
  const X = (v) => L + (Math.log(v) - Math.log(vmin)) / (Math.log(vmax) - Math.log(vmin)) * W;
  const Y = (p) => T + H - (Math.log(Math.max(pmin, p)) - Math.log(pmin)) / (Math.log(pmax) - Math.log(pmin)) * H;
  ctx.strokeStyle = COLORS.grid; ctx.fillStyle = COLORS.text; ctx.font = `10px ${MONO}`;
  ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  for (const p of [0.5, 1, 2, 5, 10, 20, 50, 100]) {
    if (p > pmax) continue;
    const y = Math.round(Y(p)) + 0.5;
    ctx.beginPath(); ctx.moveTo(L, y); ctx.lineTo(w - R, y); ctx.stroke(); ctx.fillText(p, L - 5, y);
  }
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  for (const v of [60, 100, 200, 400, 700]) {
    if (v < vmin || v > vmax) continue;
    const x = Math.round(X(v)) + 0.5;
    ctx.beginPath(); ctx.moveTo(x, T); ctx.lineTo(x, T + H); ctx.stroke(); ctx.fillText(v, x, T + H + 4);
  }
  ctx.textAlign = 'left'; ctx.fillText('V cm³', L + 2, T + H - 12);
  ctx.save(); ctx.translate(10, T + H / 2); ctx.rotate(-Math.PI / 2); ctx.textAlign = 'center'; ctx.fillText('p bar (log)', 0, 0); ctx.restore();
  // 包围面积（指示功）
  ctx.beginPath();
  for (let a = 0; a <= 720; a += 1) {
    const s = sampleCycle(cycle, a); const v = volumeAt(a) * 1e6;
    if (a === 0) ctx.moveTo(X(v), Y(s.p / 1e5)); else ctx.lineTo(X(v), Y(s.p / 1e5));
  }
  ctx.fillStyle = 'rgba(255,106,43,0.08)'; ctx.fill();
  for (const st of STROKES) {
    ctx.beginPath();
    for (let a = st.from; a <= st.to; a += 1) {
      const s = sampleCycle(cycle, a); const v = volumeAt(a) * 1e6;
      if (a === st.from) ctx.moveTo(X(v), Y(s.p / 1e5)); else ctx.lineTo(X(v), Y(s.p / 1e5));
    }
    ctx.strokeStyle = SC[st.key]; ctx.lineWidth = 1.8; ctx.stroke();
  }
  const s = sampleCycle(cycle, psi); const v = volumeAt(wrap720(psi)) * 1e6;
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(X(v), Y(s.p / 1e5), 4, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(X(v), Y(s.p / 1e5), 8, 0, 7); ctx.stroke();
  ctx.fillStyle = COLORS.hi; ctx.font = `600 10px ${SANS}`; ctx.textAlign = 'right'; ctx.textBaseline = 'top';
  ctx.fillText(`环线面积 = 指示功 ${cycle.work.toFixed(0)} J/缸`, w - R - 2, T + 2);
}

// ------------------------------------------------------------
export function drawTimingWheel(canvas, { ev, advance, psi }) {
  const { ctx, w, h } = fit(canvas);
  const cx = w / 2, cy = h / 2 + 2, R = Math.min(w, h) / 2 - 20;
  const ang = (deg) => (deg - 90) * Math.PI / 180;  // 0°=顶部，顺时针
  const p360 = (a) => ((a % 360) + 360) % 360;
  // 底圈
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1;
  for (const r of [R, R * 0.74]) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.stroke(); }
  // 刻度
  for (let a = 0; a < 360; a += 10) {
    const r0 = a % 90 === 0 ? R + 3 : R + 1, r1 = a % 90 === 0 ? R + 9 : R + 5;
    ctx.strokeStyle = a % 90 === 0 ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.12)';
    ctx.beginPath(); ctx.moveTo(cx + r0 * Math.cos(ang(a)), cy + r0 * Math.sin(ang(a)));
    ctx.lineTo(cx + r1 * Math.cos(ang(a)), cy + r1 * Math.sin(ang(a))); ctx.stroke();
  }
  ctx.fillStyle = COLORS.text; ctx.font = `600 9px ${MONO}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('TDC', cx, cy - R - 15); ctx.fillText('BDC', cx, cy + R + 15);
  const arc = (a0, a1, r, col, lw) => {
    ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(cx, cy, r, ang(a0), ang(a1 < a0 ? a1 + 360 : a1)); ctx.stroke(); ctx.lineCap = 'butt';
  };
  const rev = wrap720(psi) < 360 ? 0 : 1; // 0: 做功+排气圈，1: 进气+压缩圈
  const ivo = p360(ev.IVO), ivc = p360(ev.IVC), evo = p360(ev.EVO), evc = p360(ev.EVC);
  arc(evo, evc, R, COLORS.exhaust, 7);
  arc(ivo, ivc, R * 0.74, COLORS.intake, 7);
  // 重叠
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R * 0.9, ang(ivo), ang(evc + 360)); ctx.closePath(); ctx.fill();
  // 标记
  const mark = (a, r, label, col, outside = true) => {
    const x = cx + r * Math.cos(ang(a)), y = cy + r * Math.sin(ang(a));
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, 2.6, 0, 7); ctx.fill();
    const rl = outside ? r + 16 : r - 16;
    ctx.font = `600 9px ${MONO}`; ctx.fillStyle = col;
    ctx.fillText(label, cx + rl * Math.cos(ang(a)), cy + rl * Math.sin(ang(a)));
  };
  mark(evo, R, 'EVO', COLORS.exhaust); mark(evc, R, 'EVC', COLORS.exhaust);
  mark(ivo, R * 0.74, 'IVO', COLORS.intake, false); mark(ivc, R * 0.74, 'IVC', COLORS.intake, false);
  const sa = p360(-advance);
  ctx.strokeStyle = '#ffe07a'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(cx + R * 0.82 * Math.cos(ang(sa)), cy + R * 0.82 * Math.sin(ang(sa)));
  ctx.lineTo(cx + R * 1.08 * Math.cos(ang(sa)), cy + R * 1.08 * Math.sin(ang(sa))); ctx.stroke();
  ctx.fillStyle = '#ffe07a'; ctx.font = `10px ${SANS}`;
  ctx.fillText('⚡', cx + (R + 12) * Math.cos(ang(sa - 8)), cy + (R + 12) * Math.sin(ang(sa - 8)));
  // 曲柄指针
  const a = p360(psi);
  const st = STROKES[Math.min(3, Math.floor(wrap720(psi) / 180))];
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + R * 0.95 * Math.cos(ang(a)), cy + R * 0.95 * Math.sin(ang(a))); ctx.stroke();
  ctx.fillStyle = '#0d1016'; ctx.beginPath(); ctx.arc(cx, cy, R * 0.44, 0, 7); ctx.fill();
  ctx.strokeStyle = SC[st.key]; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, cy, R * 0.44, 0, 7); ctx.stroke();
  ctx.fillStyle = SC[st.key]; ctx.font = `700 13px ${SANS}`;
  ctx.fillText(st.name, cx, cy - 6);
  ctx.fillStyle = COLORS.text; ctx.font = `9px ${MONO}`;
  ctx.fillText(`第${rev + 1}圈 ${a.toFixed(0)}°`, cx, cy + 9);
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx + R * 0.95 * Math.cos(ang(a)), cy + R * 0.95 * Math.sin(ang(a)), 3, 0, 7); ctx.fill();
}

// ------------------------------------------------------------
export function drawFiring(canvas, { cyls, theta, focus, firingOrder }) {
  const { ctx, w, h } = fit(canvas);
  const L = 26, R = 6, T = 4, B = 16;
  const rows = firingOrder.length, rh = (h - T - B) / rows;
  const X = (a) => L + a / 720 * (w - L - R);
  ctx.font = `600 10px ${MONO}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
  firingOrder.forEach((id, r) => {
    const c = cyls[id - 1];
    const y = T + r * rh;
    for (const st of STROKES) {
      // θ = phase + ψ
      for (const off of [0, -720]) {
        const a0 = c.phase + st.from + off, a1 = c.phase + st.to + off;
        const x0 = X(Math.max(0, a0)), x1 = X(Math.min(720, a1));
        if (x1 <= x0) continue;
        ctx.fillStyle = alpha(SC[st.key], id === focus ? 0.95 : 0.55);
        ctx.fillRect(x0, y + 1.5, x1 - x0 - 0.5, rh - 3);
      }
    }
    ctx.fillStyle = id === focus ? '#fff' : COLORS.text;
    ctx.fillText(String(id), L / 2 - 2, y + rh / 2);
    if (id === focus) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.strokeRect(L - 1.5, y + 0.5, w - L - R + 3, rh - 1); }
  });
  ctx.fillStyle = COLORS.text; ctx.font = `9px ${MONO}`; ctx.textBaseline = 'top';
  for (let a = 0; a <= 720; a += 90) {
    ctx.textAlign = a === 0 ? 'left' : a === 720 ? 'right' : 'center';
    ctx.fillText(a + '°', X(a), h - B + 4);
  }
  const x = X(wrap720(theta));
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x, T - 2); ctx.lineTo(x, h - B + 1); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(x - 4, T - 3); ctx.lineTo(x + 4, T - 3); ctx.lineTo(x, T + 3); ctx.fill();
  return { rowAt: (py) => firingOrder[Math.max(0, Math.min(rows - 1, Math.floor((py - T) / rh)))] };
}

// ------------------------------------------------------------
export function drawScrubber(canvas, { psi, ev, advance }) {
  const { ctx, w, h } = fit(canvas);
  const L = 6, R = 6;
  const X = (xa) => L + (xa + 360) / 720 * (w - L - R);
  const yb = h - 16, bh = 8;
  const cur = psiToXa(psi);
  ctx.font = `600 10px ${SANS}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const b of XBANDS) {
    const active = cur >= b.a && cur < b.b;
    ctx.fillStyle = alpha(SC[b.key], active ? 0.95 : 0.4);
    ctx.fillRect(X(b.a) + 1, yb, X(b.b) - X(b.a) - 2, bh);
    ctx.fillStyle = active ? SC[b.key] : COLORS.text;
    ctx.fillText(b.name, (X(b.a) + X(b.b)) / 2, yb - 11);
  }
  ctx.fillStyle = '#ffe07a'; ctx.fillRect(X(-advance) - 0.5, yb - 3, 1.5, bh + 6);
  ctx.fillStyle = COLORS.text; ctx.font = `9px ${MONO}`;
  for (const [xa, t] of [[-360, 'TDC'], [-180, 'BDC'], [0, 'TDC'], [180, 'BDC'], [360, 'TDC']]) {
    ctx.textAlign = xa === -360 ? 'left' : xa === 360 ? 'right' : 'center';
    ctx.fillText(t, X(xa), h - 3);
  }
  const x = X(cur);
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.roundRect(x - 2, yb - 5, 4, bh + 10, 2); ctx.fill();
  return { xaAt: (px) => Math.max(-360, Math.min(359.9, (px - L) / (w - L - R) * 720 - 360)) };
}
