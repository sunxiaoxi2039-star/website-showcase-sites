// 发动机热力学 / 运动学模型（纯函数，无 DOM 依赖，可在 node 中测试）
// 约定：ψ（psi）为单缸循环角，0° = 压缩上止点（点火 TDC），720° 一个工作循环。
//   0–180 做功 · 180–360 排气 · 360–540 进气 · 540–720 压缩

export const ENGINE = {
  bore: 0.094,        // m
  stroke: 0.092,      // m
  rod: 0.150,         // m 连杆中心距
  cr: 11.0,           // 压缩比
  bankAngle: 90,      // V 夹角
  firingOrder: [1, 8, 4, 3, 6, 5, 7, 2],
};

export const STROKES = [
  { key: 'power', name: '做功', en: 'POWER', from: 0, to: 180 },
  { key: 'exhaust', name: '排气', en: 'EXHAUST', from: 180, to: 360 },
  { key: 'intake', name: '进气', en: 'INTAKE', from: 360, to: 540 },
  { key: 'compression', name: '压缩', en: 'COMPRESSION', from: 540, to: 720 },
];

export const wrap720 = (a) => ((a % 720) + 720) % 720;
export const wrap360 = (a) => ((a % 360) + 360) % 360;
const D2R = Math.PI / 180;

export function strokeAt(psi) {
  const p = wrap720(psi);
  return STROKES[Math.min(3, Math.floor(p / 180))];
}

// 活塞距上止点位移 (m)
export function pistonDisp(psi) {
  const r = ENGINE.stroke / 2, l = ENGINE.rod;
  const a = psi * D2R;
  const s = Math.sin(a);
  return r * (1 - Math.cos(a)) + l - Math.sqrt(l * l - r * r * s * s);
}

export const AREA = Math.PI * ENGINE.bore * ENGINE.bore / 4;
export const VD = AREA * ENGINE.stroke;             // 单缸排量 m³
export const VC = VD / (ENGINE.cr - 1);             // 燃烧室容积
export const DISPLACEMENT_L = VD * 8 * 1000;

export function volumeAt(psi) { return VC + AREA * pistonDisp(psi); }

// 气门正时（ψ 坐标）。vvt > 0 表示进气凸轮提前。
export function valveEvents(vvt = 0) {
  return {
    IVO: 348 - vvt,  // 上止点前 12°
    IVC: 588 - vvt,  // 下止点后 48°
    EVO: 128,        // 下止点前 52°
    EVC: 370,        // 上止点后 10°
  };
}

// 凸轮型线：归一化升程 0..1，t ∈ [0,1] 为事件内进度。
// 采用多项式“高次缓冲”型线（近似 3-4-5 多项式 + 平顶），比正弦更接近真实凸轮。
export function liftShape(t) {
  if (t <= 0 || t >= 1) return 0;
  const x = 1 - Math.abs(2 * t - 1);           // 0→1→0
  // 平滑上升：C2 连续的 quintic smootherstep，再稍作“饱满”处理
  const s = x * x * x * (x * (x * 6 - 15) + 10);
  return Math.pow(s, 0.8);
}

export const MAX_LIFT = { intake: 0.0118, exhaust: 0.0112 }; // m

export function valveLift(psi, open, close, maxLift) {
  let p = wrap720(psi - open);
  const dur = wrap720(close - open);
  if (p > dur) return 0;
  return maxLift * liftShape(p / dur);
}

// ------- 缸压循环：单区热力学 + Wiebe 燃烧放热 -------
export function computeCycle({ advance = 26, throttle = 1, vvt = 0, rpm = 3000 } = {}) {
  const N = 1440, step = 0.5;
  const ev = valveEvents(vvt);
  const pMan = 30e3 + 70e3 * throttle;            // 进气歧管压力 Pa
  const pExh = 104e3 + 10e3 * throttle;           // 排气背压
  const ram = 1 + 0.04 * throttle * Math.sin(Math.min(1, rpm / 6500) * Math.PI); // 惯性进气
  const P = new Float64Array(N);
  const V = new Float64Array(N);
  const XB = new Float64Array(N);                 // 已燃质量分数
  const DXB = new Float64Array(N);                // 放热率
  const T = new Float64Array(N);
  for (let i = 0; i < N; i++) V[i] = volumeAt(i * step);

  // 燃烧参数
  const ign = 720 - advance;
  const delay = 7 + 4 * (1 - throttle);
  const dur = 48 + 16 * (1 - throttle) + rpm / 900;
  const burnStart = ign + delay;
  const a = 5, m = 2;
  const wiebe = (psi) => {
    // psi 在 [IVC, 720+EVO] 连续坐标下
    const t = (psi - burnStart) / dur;
    if (t <= 0) return 0;
    return 1 - Math.exp(-a * Math.pow(t, m + 1));
  };

  // 进气门关闭时的状态
  const pIvc = pMan * ram;
  const Vivc = volumeAt(ev.IVC);
  const Tivc = 335;
  const R = 287;
  const mass = pIvc * Vivc / (R * Tivc);
  const Qlhv = mass / 14.7 * 44e6 * 0.82 * (0.55 + 0.45 * throttle); // 含传热损失修正

  // 积分区间：IVC → 720 + EVO
  let p = pIvc;
  let prevXb = 0;
  const start = ev.IVC, end = 720 + ev.EVO;
  const sub = 4;                                  // 子步
  let psi = start;
  const setAt = (ps, pv, xb, dxb) => {
    const idx = Math.round(wrap720(ps) / step) % N;
    P[idx] = pv; XB[idx] = xb; DXB[idx] = dxb;
  };
  setAt(psi, p, 0, 0);
  while (psi < end - 1e-9) {
    for (let k = 0; k < sub; k++) {
      const h = step / sub;
      const v0 = volumeAt(psi), v1 = volumeAt(psi + h);
      const xb1 = wiebe(psi + h);
      const dQ = Qlhv * (xb1 - prevXb);
      const g = 1.36 - 0.1 * xb1;
      // 一阶热力学定律（离散）：dp = -γ p dV/V + (γ-1) dQ / V
      const vm = 0.5 * (v0 + v1);
      p = p + (-g * p * (v1 - v0) + (g - 1) * dQ) / vm;
      prevXb = xb1;
      psi += h;
    }
    setAt(psi, p, prevXb, (wiebe(psi + 0.25) - wiebe(psi - 0.25)) / 0.5);
  }
  const pEvo = p;

  // 排气：EVO 后自由排气（指数衰减），强制排气阶段接近背压
  for (let ps = ev.EVO + step; ps <= ev.IVC; ps += step) {
    const idx = Math.round(wrap720(ps) / step) % N;
    const tb = ps - ev.EVO;
    let pv = pExh + (pEvo - pExh) * Math.exp(-tb / 16);
    // 排气冲程后半段活塞推挤：轻微鼓包
    if (ps > 180 && ps < 360) pv += 6e3 * throttle * Math.sin((ps - 180) / 180 * Math.PI);
    // 气门重叠 → 进气：从背压平滑过渡到歧管压力
    const blend = smooth01((ps - (ev.IVO + 4)) / (ev.EVC - ev.IVO + 24));
    const pIntake = pMan - 7e3 * throttle * Math.sin(Math.max(0, Math.min(1, (ps - 360) / 180)) * Math.PI)
      + (ps > 540 ? (pIvc - pMan) * smooth01((ps - 540) / (ev.IVC - 540)) : 0);
    pv = pv * (1 - blend) + pIntake * blend;
    P[idx] = pv; XB[idx] = 1 - blend; DXB[idx] = 0;
  }
  // 温度（仅用于显示）
  for (let i = 0; i < N; i++) {
    T[i] = P[i] * V[i] / (mass * R);
  }

  // 指示功与 IMEP
  let W = 0;
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    W += 0.5 * (P[i] + P[j]) * (V[j] - V[i]);
  }
  const imep = W / VD;                            // Pa
  let pk = 0, pkIdx = 0;
  for (let i = 0; i < N; i++) if (P[i] > pk) { pk = P[i]; pkIdx = i; }
  let pkPsi = pkIdx * step; if (pkPsi > 360) pkPsi -= 720;
  const torque = imep * VD * 8 / (4 * Math.PI) * 0.86;   // 8 缸，扣除约 14% 机械损失
  const power = torque * rpm * 2 * Math.PI / 60;
  // 末端气体爆震指数（经验）：峰值压力 × 峰值位置过早 × 负荷
  const knock = Math.max(0, (pk / 1e5 - 55) / 30) + Math.max(0, (8 - pkPsi) / 10) * throttle;
  return {
    P, V, XB, DXB, T, step, N, ev, ign, burnStart, dur,
    pMan, pExh, peak: pk, peakPsi: pkPsi, imep, work: W, torque, power, knock, mass,
  };
}

function smooth01(x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }

export function sampleCycle(cycle, psi) {
  const f = wrap720(psi) / cycle.step;
  const i = Math.floor(f), t = f - i;
  const j = (i + 1) % cycle.N;
  return {
    p: cycle.P[i] * (1 - t) + cycle.P[j] * t,
    xb: cycle.XB[i] * (1 - t) + cycle.XB[j] * t,
    dxb: cycle.DXB[i] * (1 - t) + cycle.DXB[j] * t,
    T: cycle.T[i] * (1 - t) + cycle.T[j] * t,
  };
}

// ------- 曲柄连杆几何（V8 横置平面曲轴） -------
// 左列（奇数缸 1/3/5/7）气缸轴线相对竖直 +45°，右列（偶数缸 2/4/6/8）-45°。
// 曲柄销 i（0..3）由 (2i+1, 2i+2) 两缸共用。
export function cylinderLayout() {
  const fo = ENGINE.firingOrder;
  const half = ENGINE.bankAngle / 2;
  const cyls = [];
  for (let c = 1; c <= 8; c++) {
    const k = fo.indexOf(c);
    const left = c % 2 === 1;
    const beta = left ? half : -half;          // 气缸轴线角（从竖直量起，逆时针为正，面向发动机前端）
    const pin = Math.floor((c - 1) / 2);
    const phase = 90 * k;                       // 点火相位：θ = phase 时为压缩上止点
    const pinAngle = wrap360(beta - phase);     // 曲柄销角：θ + pinAngle = beta 时上止点
    cyls.push({ id: c, k, left, beta, pin, phase, pinAngle });
  }
  return cyls;
}

export function psiOf(cyl, theta) { return wrap720(theta - cyl.phase); }
