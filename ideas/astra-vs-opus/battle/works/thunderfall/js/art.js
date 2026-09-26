// 程序化美术：所有战机、敌人、子弹、道具都在启动时预渲染成离屏画布
import { makeCanvas, TAU, mulberry } from './util.js';

export const ART = {};
let SS = 2.5; // 预渲染超采样倍率

function sprite(w, h, draw, ss = SS) {
  const c = makeCanvas(w * ss, h * ss);
  const g = c.getContext('2d');
  g.setTransform(ss, 0, 0, ss, (w * ss) / 2, (h * ss) / 2);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  draw(g, w, h);
  return { c, w, h };
}

function sym(g, pts) {
  g.beginPath();
  pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
  for (let i = pts.length - 1; i >= 0; i--) g.lineTo(-pts[i][0], pts[i][1]);
  g.closePath();
}
function poly(g, pts, sx = 1) {
  g.beginPath();
  pts.forEach((p, i) => (i ? g.lineTo(p[0] * sx, p[1]) : g.moveTo(p[0] * sx, p[1])));
  g.closePath();
}
function lg(g, x0, y0, x1, y1, stops) {
  const gr = g.createLinearGradient(x0, y0, x1, y1);
  stops.forEach((s, i) => gr.addColorStop(Array.isArray(s) ? s[0] : i / (stops.length - 1), Array.isArray(s) ? s[1] : s));
  return gr;
}
function rg(g, x, y, r0, r1, stops, x1 = x, y1 = y) {
  const gr = g.createRadialGradient(x, y, r0, x1, y1, r1);
  stops.forEach((s, i) => gr.addColorStop(Array.isArray(s) ? s[0] : i / (stops.length - 1), Array.isArray(s) ? s[1] : s));
  return gr;
}
function bounds(pts) {
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const p of pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
  return { x0, x1, y0, y1 };
}
function mirrorEach(fn) { fn(1); fn(-1); }

// ---------- 战机（玩家与敌机共用的精细机体渲染） ----------
function drawJet(g, S) {
  const C = S.col;
  const ol = C.outline;
  // 水平尾翼
  if (S.tail) {
    const b = bounds(S.tail);
    sym(g, S.tail);
    g.fillStyle = lg(g, 0, b.y0, 0, b.y1, [C.wing[0], C.wing[1], C.wing[2]]);
    g.fill();
    g.lineWidth = 0.7; g.strokeStyle = ol; g.stroke();
  }
  // 主翼
  {
    const b = bounds(S.wing);
    sym(g, S.wing);
    g.fillStyle = lg(g, 0, b.y0, 0, b.y1, [C.wing[0], C.wing[1], C.wing[2]]);
    g.fill();
    // 翼根到翼尖的明暗
    g.save();
    sym(g, S.wing); g.clip();
    g.fillStyle = lg(g, -b.x1, 0, b.x1, 0, [[0, 'rgba(0,0,0,.35)'], [0.35, 'rgba(255,255,255,.10)'], [0.5, 'rgba(255,255,255,0)'], [0.65, 'rgba(255,255,255,.10)'], [1, 'rgba(0,0,0,.35)']]);
    g.fillRect(-b.x1, b.y0, b.x1 * 2, b.y1 - b.y0);
    // 面板线
    g.strokeStyle = C.panel; g.lineWidth = 0.45;
    if (S.panels) for (const ln of S.panels) mirrorEach((sx) => { g.beginPath(); g.moveTo(ln[0][0] * sx, ln[0][1]); g.lineTo(ln[1][0] * sx, ln[1][1]); g.stroke(); });
    if (S.wingStripe) mirrorEach((sx) => { poly(g, S.wingStripe, sx); g.fillStyle = C.stripe; g.fill(); });
    if (S.wingTip) mirrorEach((sx) => { poly(g, S.wingTip, sx); g.fillStyle = C.accent; g.fill(); });
    g.restore();
    sym(g, S.wing);
    g.lineWidth = 0.8; g.strokeStyle = ol; g.stroke();
    if (S.lead) {
      g.strokeStyle = C.lead; g.lineWidth = 0.7;
      mirrorEach((sx) => { g.beginPath(); S.lead.forEach((p, i) => (i ? g.lineTo(p[0] * sx, p[1] + 0.6) : g.moveTo(p[0] * sx, p[1] + 0.6))); g.stroke(); });
    }
  }
  // 挂架导弹 / 机炮吊舱
  if (S.pods) {
    for (const p of S.pods) mirrorEach((sx) => {
      const [px, py, len, kind] = p;
      const x = px * sx;
      if (kind === 'gun') {
        g.fillStyle = lg(g, x - 3, 0, x + 3, 0, ['#1b1b22', '#8d8a9a', '#2a2833']);
        g.beginPath(); g.roundRect(x - 2.8, py - len / 2, 5.6, len, 2.2); g.fill();
        g.strokeStyle = ol; g.lineWidth = 0.5; g.stroke();
        g.fillStyle = '#111'; g.fillRect(x - 1, py - len / 2 - 5, 2, 5);
        g.fillStyle = C.accent; g.fillRect(x - 2.8, py + len / 2 - 3, 5.6, 1.2);
      } else {
        g.fillStyle = lg(g, x - 1.8, 0, x + 1.8, 0, ['#8a8f96', '#ffffff', '#9aa0a8']);
        g.beginPath(); g.roundRect(x - 1.6, py - len / 2, 3.2, len, 1.5); g.fill();
        g.fillStyle = C.missileTip || '#d8261c';
        g.beginPath(); g.moveTo(x - 1.6, py - len / 2 + 1.5); g.quadraticCurveTo(x, py - len / 2 - 3, x + 1.6, py - len / 2 + 1.5); g.fill();
        g.fillStyle = '#50555c';
        g.beginPath(); g.moveTo(x - 1.6, py + len / 2 - 2); g.lineTo(x - 3.2, py + len / 2 + 0.6); g.lineTo(x + 3.2, py + len / 2 + 0.6); g.lineTo(x + 1.6, py + len / 2 - 2); g.fill();
      }
    });
  }
  // 尾喷口
  if (S.engines) for (const e of S.engines) mirrorEach((sx) => {
    const [ex, ey, er] = e;
    const x = ex * sx;
    g.fillStyle = lg(g, x - er, 0, x + er, 0, ['#2a2a30', '#b9bcc4', '#3a3a44']);
    g.beginPath(); g.ellipse(x, ey, er, er * 1.25, 0, 0, TAU); g.fill();
    g.fillStyle = rg(g, x, ey + er * 0.2, 0, er * 0.8, ['#fff3c2', '#ff9b2e', '#3a1204']);
    g.beginPath(); g.ellipse(x, ey + er * 0.25, er * 0.62, er * 0.8, 0, 0, TAU); g.fill();
  });
  // 鸭翼
  if (S.canard) {
    const b = bounds(S.canard);
    mirrorEach((sx) => {
      poly(g, S.canard, sx);
      g.fillStyle = lg(g, 0, b.y0, 0, b.y1, [C.wing[0], C.wing[2]]);
      g.fill(); g.lineWidth = 0.6; g.strokeStyle = ol; g.stroke();
    });
  }
  // 机身
  {
    const b = bounds(S.fus);
    const hw = b.x1;
    sym(g, S.fus);
    g.fillStyle = lg(g, -hw, 0, hw, 0, [[0, C.fus[0]], [0.18, C.fus[1]], [0.38, C.fus[2]], [0.47, C.fus[3]], [0.58, C.fus[2]], [0.82, C.fus[1]], [1, C.fus[0]]]);
    g.fill();
    g.save(); sym(g, S.fus); g.clip();
    // 机头雷达罩
    if (S.noseEnd != null) {
      g.fillStyle = lg(g, -hw, 0, hw, 0, [C.nose[0], C.nose[1], C.nose[0]]);
      g.fillRect(-hw, b.y0, hw * 2, S.noseEnd - b.y0);
      g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(-hw, S.noseEnd - 0.4, hw * 2, 0.8);
    }
    // 机身条纹
    if (S.bands) for (const bd of S.bands) { g.fillStyle = bd[2] || C.stripe; g.fillRect(-hw, bd[0], hw * 2, bd[1]); }
    // 进气道
    if (S.intake) mirrorEach((sx) => {
      poly(g, S.intake, sx);
      g.fillStyle = lg(g, 0, S.intake[0][1], 0, S.intake[2][1], ['#050507', '#2a2c33']);
      g.fill();
    });
    // 背脊线与面板
    g.strokeStyle = C.panel; g.lineWidth = 0.4;
    g.beginPath(); g.moveTo(0, S.canopy.y + S.canopy.ry + 1); g.lineTo(0, b.y1 - 2); g.stroke();
    if (S.fusPanels) for (const y of S.fusPanels) { g.beginPath(); g.moveTo(-hw, y); g.lineTo(hw, y); g.stroke(); }
    // 纵向高光
    g.fillStyle = lg(g, 0, b.y0, 0, b.y1, ['rgba(255,255,255,.25)', 'rgba(255,255,255,0)', 'rgba(0,0,0,.25)']);
    g.fillRect(-hw, b.y0, hw * 2, b.y1 - b.y0);
    g.restore();
    sym(g, S.fus); g.lineWidth = 0.8; g.strokeStyle = ol; g.stroke();
  }
  // 垂直尾翼（俯视呈细条）
  if (S.fins) for (const f of S.fins) mirrorEach((sx) => {
    const [[x0, y0], [x1, y1]] = f;
    g.lineCap = 'round';
    g.strokeStyle = ol; g.lineWidth = (S.finW || 2.2) + 1;
    g.beginPath(); g.moveTo(x0 * sx, y0); g.lineTo(x1 * sx, y1); g.stroke();
    g.strokeStyle = C.fin; g.lineWidth = S.finW || 2.2;
    g.beginPath(); g.moveTo(x0 * sx, y0); g.lineTo(x1 * sx, y1); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.45)'; g.lineWidth = 0.6;
    g.beginPath(); g.moveTo(x0 * sx - 0.4 * sx, y0 + 1); g.lineTo(x1 * sx - 0.4 * sx, y1); g.stroke();
    if (C.finTip) { g.strokeStyle = C.finTip; g.lineWidth = S.finW || 2.2; g.beginPath(); g.moveTo(x1 * sx - (x1 - x0) * 0.2 * sx, y1 - (y1 - y0) * 0.2); g.lineTo(x1 * sx, y1); g.stroke(); }
  });
  // 座舱盖
  {
    const k = S.canopy;
    g.fillStyle = '#0b0b10';
    g.beginPath(); g.ellipse(k.x, k.y, k.rx + 0.9, k.ry + 1, 0, 0, TAU); g.fill();
    g.fillStyle = rg(g, k.x - k.rx * 0.3, k.y - k.ry * 0.4, 0, k.ry * 1.3, [C.glass[2], C.glass[1], C.glass[0]]);
    g.beginPath(); g.ellipse(k.x, k.y, k.rx, k.ry, 0, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 0.5;
    g.beginPath(); g.moveTo(k.x - k.rx, k.y + k.ry * 0.25); g.quadraticCurveTo(k.x, k.y + k.ry * 0.05, k.x + k.rx, k.y + k.ry * 0.25); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.85)';
    g.beginPath(); g.ellipse(k.x - k.rx * 0.35, k.y - k.ry * 0.45, k.rx * 0.28, k.ry * 0.32, -0.2, 0, TAU); g.fill();
  }
  if (S.extra) S.extra(g, C);
}

const SHIP_SPECS = {
  falcon: {
    w: 78, h: 98,
    fus: [[0, -46], [2.4, -40], [4.2, -31], [5.6, -20], [6.8, -8], [7.4, 6], [7.4, 22], [6.6, 31], [5.2, 36]],
    wing: [[6.5, -10], [13, -3], [25, 9], [33, 17], [33.5, 21.5], [26, 22.5], [7.4, 19]],
    wingTip: [[27.2, 11.5], [33, 17], [33.5, 21.5], [29, 22]],
    wingStripe: [[10.5, -3.2], [13, -4.2], [25.8, 8], [24.2, 9.6]],
    lead: [[6.5, -10], [13, -3], [25, 9], [33, 17]],
    panels: [[[9, 6], [24, 18]], [[15, 1], [15, 21]], [[20, 6], [21, 21.5]]],
    canard: [[5.4, -24], [11, -19], [11.5, -16], [5.8, -15]],
    tail: [[6.6, 22], [15, 28.5], [16.5, 33.5], [6.8, 32]],
    fins: [[[4.8, 14], [7.8, 30]]],
    engines: [[3.2, 36.5, 2.7]],
    intake: [[5.4, -12], [8.1, -8], [8.1, 2], [6.9, 2]],
    canopy: { x: 0, y: -24, rx: 3.2, ry: 8.5 },
    noseEnd: -37,
    bands: [[9, 2.2], [13, 0.9]],
    fusPanels: [-4, 18, 27],
    pods: [[18.5, 5, 12]],
    col: {
      fus: ['#3b0505', '#a3150f', '#ef3b28', '#ffc2ae'], wing: ['#ef4a36', '#b31d15', '#5e0907'],
      outline: '#1d0202', panel: 'rgba(40,0,0,.55)', accent: '#f4f1ea', stripe: '#f7f4ec', lead: 'rgba(255,220,200,.8)',
      fin: '#9c1812', finTip: '#f4f1ea', glass: ['#040c20', '#1a5cc4', '#9fe8ff'], nose: ['#3f444c', '#8a919c'], missileTip: '#e0261c',
    },
  },
  dragon: {
    w: 78, h: 100,
    fus: [[0, -48], [2.1, -42], [3.8, -32], [5.2, -20], [6.3, -6], [6.8, 8], [6.8, 24], [6, 32], [4.6, 37]],
    wing: [[6.5, 8], [13, 1], [24, -8], [30.5, -10.5], [31.5, -6.5], [26, 4], [17, 13], [6.8, 18]],
    wingTip: [[25.5, -8.8], [30.5, -10.5], [31.5, -6.5], [27.2, -1.2]],
    wingStripe: [[12, 3], [22.5, -5.4], [23.5, -3.4], [13, 5.2]],
    lead: [[6.5, 8], [13, 1], [24, -8], [30.5, -10.5]],
    panels: [[[10, 12], [26, -2]], [[16, 0], [17, 13]]],
    canard: [[5, -26], [12.5, -23], [13, -20], [5.3, -17]],
    tail: [[6.3, 24], [14.5, 27], [15.5, 31.5], [6.5, 32]],
    fins: [[[4.4, 16], [9.5, 29]]], finW: 2,
    engines: [[3, 37.5, 2.6]],
    intake: [[5.1, -14], [7.4, -10], [7.4, 0], [6.4, 0]],
    canopy: { x: 0, y: -26, rx: 2.9, ry: 8.8 },
    noseEnd: -39,
    bands: [[12, 1.4, '#35e8ff']],
    fusPanels: [-2, 20, 28],
    pods: [[19.5, 7, 10]],
    col: {
      fus: ['#061433', '#1a468f', '#3f86e6', '#d6ebff'], wing: ['#5898f5', '#1f4fa6', '#0b1f4d'],
      outline: '#020a1c', panel: 'rgba(0,10,40,.6)', accent: '#35e8ff', stripe: '#e8f6ff', lead: 'rgba(200,240,255,.85)',
      fin: '#173d80', finTip: '#35e8ff', glass: ['#1a0c02', '#c0661a', '#ffe0a0'], nose: ['#1e2430', '#5a6272'], missileTip: '#29d8ff',
    },
  },
  titan: {
    w: 86, h: 94,
    fus: [[0, -42], [3.2, -37], [5.8, -27], [8, -15], [9.6, -2], [10.2, 12], [10.2, 26], [9.2, 33], [7.6, 38]],
    wing: [[8.5, -16], [16, -8], [29, 4], [37, 12], [37.5, 19], [30, 22], [10, 21]],
    wingTip: [[31.2, 6.8], [37, 12], [37.5, 19], [33, 20.3]],
    wingStripe: [[12, -10], [15, -11.5], [30, 3], [27.5, 5]],
    lead: [[8.5, -16], [16, -8], [29, 4], [37, 12]],
    panels: [[[12, 4], [30, 17]], [[18, -3], [19, 21.5]], [[25, 2], [25.5, 21.5]]],
    tail: [[9, 25], [19, 31], [20.5, 36], [9.2, 35]],
    fins: [[[7, 14], [8.8, 31]]], finW: 3,
    engines: [[4.8, 38.5, 3.4]],
    intake: [[7.6, -14], [10.6, -9], [10.6, 4], [9.4, 4]],
    canopy: { x: 0, y: -22, rx: 3.8, ry: 9 },
    noseEnd: -33,
    bands: [[6, 2, '#ffc94a'], [10, 0.8, '#ffc94a']],
    fusPanels: [-6, 18, 29],
    pods: [[22, 0, 17, 'gun']],
    col: {
      fus: ['#120a1c', '#3f2a63', '#7b5cb8', '#eadcff'], wing: ['#8062c4', '#3e2a70', '#170d2c'],
      outline: '#08040f', panel: 'rgba(10,0,25,.6)', accent: '#ffc94a', stripe: '#ffd976', lead: 'rgba(235,220,255,.85)',
      fin: '#35245e', finTip: '#ffc94a', glass: ['#170406', '#b3161b', '#ffa89a'], nose: ['#2a2434', '#6d6480'],
    },
  },
};

function jetSprite(S, bank = 0, scale = 1) {
  const w = S.w * scale, h = S.h * scale;
  return sprite(w, h, (g) => {
    g.scale(scale, scale);
    const ab = Math.abs(bank);
    for (const side of [-1, 1]) {
      const dips = side * bank > 0;
      const k = 1 - (dips ? 0.32 : 0.1) * ab;
      g.save();
      g.beginPath(); g.rect(side < 0 ? -S.w : 0, -S.h, S.w, S.h * 2); g.clip();
      g.scale(k, 1);
      drawJet(g, S);
      g.restore();
    }
    if (ab > 0) {
      g.save();
      g.globalCompositeOperation = 'source-atop';
      const dipSide = Math.sign(bank);
      g.fillStyle = `rgba(0,0,20,${0.3 * ab})`;
      g.fillRect(dipSide > 0 ? 0 : -S.w, -S.h, S.w, S.h * 2);
      g.fillStyle = `rgba(255,255,255,${0.1 * ab})`;
      g.fillRect(dipSide > 0 ? -S.w : 0, -S.h, S.w, S.h * 2);
      g.restore();
    }
  });
}

function silhouette(sp, color = '#000') {
  const c = makeCanvas(sp.c.width, sp.c.height);
  const g = c.getContext('2d');
  g.drawImage(sp.c, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = color; g.fillRect(0, 0, c.width, c.height);
  return { c, w: sp.w, h: sp.h };
}

// ---------- 敌机 ----------
const ENEMY_JETS = {
  zako: {
    w: 42, h: 46,
    fus: [[0, -22], [2, -17], [3.3, -9], [4, 0], [4, 10], [3.2, 16]],
    wing: [[3.8, -6], [9, 0], [18, 8], [18.5, 12.5], [4, 12]],
    wingTip: [[15, 5.5], [18, 8], [18.5, 12.5], [16, 12.4]],
    lead: [[3.8, -6], [9, 0], [18, 8]],
    panels: [[[8, 4], [9, 12]]],
    tail: [[3.8, 11], [9, 15.5], [9.4, 18.5], [3.6, 17.5]],
    fins: [[[2.6, 9], [3.8, 17]]], finW: 1.4,
    engines: [[1.9, 16.5, 1.8]],
    canopy: { x: 0, y: -10, rx: 1.9, ry: 4.4 },
    noseEnd: -17,
    col: {
      fus: ['#161d0c', '#475726', '#7d9345', '#dbe7ab'], wing: ['#788a42', '#46532a', '#1c2310'], outline: '#0b0f05',
      panel: 'rgba(0,0,0,.4)', accent: '#e8472a', stripe: '#fff', lead: 'rgba(240,255,200,.6)', fin: '#3d4a22',
      glass: ['#220405', '#b0151a', '#ffa080'], nose: ['#2b2e2a', '#6b706a'],
    },
  },
  zako2: {
    w: 46, h: 48,
    fus: [[0, -23], [1.8, -18], [3, -10], [3.8, 0], [4, 10], [3, 17]],
    wing: [[3.8, 2], [9, -2], [17, -7], [19.5, -6], [18.5, -2], [12, 7], [4, 11]],
    wingTip: [[16, -6.5], [19.5, -6], [18.5, -2], [16.5, -1]],
    lead: [[3.8, 2], [9, -2], [17, -7]],
    canard: [[3, -14], [7.5, -12], [7.5, -10], [3, -8]],
    tail: [[3.8, 12], [8.5, 15], [9, 18], [3.6, 18]],
    fins: [[[2.4, 9], [5.5, 16.5]]], finW: 1.3,
    engines: [[1.8, 17.5, 1.7]],
    canopy: { x: 0, y: -12, rx: 1.8, ry: 4.4 },
    noseEnd: -18,
    col: {
      fus: ['#12151b', '#434b57', '#7d8897', '#e2e8f0'], wing: ['#7c8898', '#474f5c', '#1a1e25'], outline: '#07080b',
      panel: 'rgba(0,0,0,.4)', accent: '#ffb321', stripe: '#fff', lead: 'rgba(230,240,255,.6)', fin: '#39414d',
      glass: ['#0a1c05', '#2aa018', '#b8ff90'], nose: ['#232326', '#5c5f66'],
    },
  },
};

function drawHeli(g) {
  // 俯视武装直升机：机身、尾梁、短翼火箭巢
  const ol = '#0c1008';
  // 尾梁
  g.fillStyle = lg(g, -2, 0, 2, 0, ['#2a3319', '#6f7f40', '#2a3319']);
  g.beginPath(); g.roundRect(-1.8, 4, 3.6, 22, 1.5); g.fill(); g.strokeStyle = ol; g.lineWidth = 0.6; g.stroke();
  // 尾桨平衡翼
  g.fillStyle = '#4b5a2a'; g.beginPath(); g.roundRect(-7, 20, 14, 3, 1.2); g.fill(); g.stroke();
  // 短翼
  g.fillStyle = lg(g, 0, -4, 0, 2, ['#8a9a55', '#3e4a22']);
  g.beginPath(); g.roundRect(-15, -4, 30, 5, 1.5); g.fill(); g.stroke();
  mirrorEach((sx) => {
    g.fillStyle = lg(g, 13 * sx - 2.5, 0, 13 * sx + 2.5, 0, ['#222', '#888', '#222']);
    g.beginPath(); g.roundRect(13 * sx - 2.5, -8, 5, 12, 2); g.fill(); g.stroke();
    g.fillStyle = '#111';
    for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(13 * sx - 1 + i * 1, -7, 0.7, 0, TAU); g.fill(); }
  });
  // 机身
  g.beginPath(); g.ellipse(0, -2, 7, 13, 0, 0, TAU);
  g.fillStyle = lg(g, -7, 0, 7, 0, ['#1d2410', '#5a6a2e', '#a4b56a', '#5a6a2e', '#1d2410']);
  g.fill(); g.strokeStyle = ol; g.lineWidth = 0.8; g.stroke();
  // 迷彩斑
  g.save(); g.beginPath(); g.ellipse(0, -2, 7, 13, 0, 0, TAU); g.clip();
  g.fillStyle = 'rgba(40,50,20,.5)';
  g.beginPath(); g.ellipse(-3, 4, 4, 3, 0.5, 0, TAU); g.fill();
  g.beginPath(); g.ellipse(4, -5, 3, 4, -0.3, 0, TAU); g.fill();
  g.restore();
  // 座舱（串列双座）
  g.fillStyle = rg(g, -1, -12, 0, 6, ['#ffc4a0', '#b0151a', '#200405']);
  g.beginPath(); g.ellipse(0, -9, 3.6, 5.5, 0, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(-3.4, -8); g.lineTo(3.4, -8); g.stroke();
  // 机鼻炮塔
  g.fillStyle = '#222'; g.beginPath(); g.arc(0, -15, 2, 0, TAU); g.fill();
  // 旋翼轴
  g.fillStyle = '#333'; g.beginPath(); g.arc(0, 0, 2.2, 0, TAU); g.fill();
  g.fillStyle = '#e8472a'; g.beginPath(); g.arc(0, 0, 1, 0, TAU); g.fill();
}

function drawRotor(g, r) {
  g.fillStyle = 'rgba(30,30,30,.18)';
  g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(20,20,20,.75)'; g.lineWidth = 2.2;
  for (let i = 0; i < 4; i++) { const a = (i * TAU) / 4; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * r, Math.sin(a) * r); g.stroke(); }
  g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 1;
  g.beginPath(); g.arc(0, 0, r * 0.95, 0, TAU); g.stroke();
}

function drawBomber(g) {
  // 大型四发轰炸机（机头朝上）
  const ol = '#0a0c0e';
  const wing = [[6, -12], [20, -6], [52, 8], [56, 14], [55, 18], [20, 14], [8, 16]];
  const bw = bounds(wing);
  sym(g, wing);
  g.fillStyle = lg(g, 0, bw.y0, 0, bw.y1, ['#7d8a93', '#4a555e', '#1f252a']); g.fill();
  g.save(); sym(g, wing); g.clip();
  g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 0.5;
  for (let x = 10; x < 56; x += 6) mirrorEach((sx) => { g.beginPath(); g.moveTo(x * sx, -20); g.lineTo(x * sx, 30); g.stroke(); });
  g.fillStyle = '#b3261e'; mirrorEach((sx) => { g.beginPath(); g.arc(38 * sx, 8, 3.2, 0, TAU); g.fill(); g.fillStyle = '#f2e6c8'; g.beginPath(); g.arc(38 * sx, 8, 1.4, 0, TAU); g.fill(); g.fillStyle = '#b3261e'; });
  g.restore();
  sym(g, wing); g.strokeStyle = ol; g.lineWidth = 0.9; g.stroke();
  // 发动机舱
  for (const ex of [18, 32]) mirrorEach((sx) => {
    const x = ex * sx;
    g.fillStyle = lg(g, x - 3.5, 0, x + 3.5, 0, ['#20252a', '#9aa6ae', '#20252a']);
    g.beginPath(); g.roundRect(x - 3.5, -10 + ex * 0.28, 7, 20, 3); g.fill(); g.strokeStyle = ol; g.lineWidth = 0.6; g.stroke();
    g.fillStyle = rg(g, x, 10 + ex * 0.28, 0, 3, ['#fff1b0', '#ff8a1e', '#301000']);
    g.beginPath(); g.arc(x, 10 + ex * 0.28, 2.4, 0, TAU); g.fill();
  });
  // 尾翼
  const tail = [[4, 30], [18, 36], [19, 40], [4, 40]];
  sym(g, tail); g.fillStyle = lg(g, 0, 30, 0, 40, ['#6d7880', '#2a3137']); g.fill(); g.strokeStyle = ol; g.stroke();
  // 机身
  const fus = [[0, -40], [4, -34], [7, -22], [8, -6], [8, 20], [6.5, 36], [4, 42]];
  sym(g, fus);
  g.fillStyle = lg(g, -8, 0, 8, 0, ['#1b2025', '#5a666f', '#b9c4cc', '#5a666f', '#1b2025']); g.fill();
  g.save(); sym(g, fus); g.clip();
  g.fillStyle = 'rgba(0,0,0,.35)'; for (let y = -20; y < 40; y += 8) g.fillRect(-8, y, 16, 0.5);
  g.fillStyle = '#b3261e'; g.fillRect(-8, 22, 16, 2.5);
  g.restore(); sym(g, fus); g.strokeStyle = ol; g.lineWidth = 0.9; g.stroke();
  // 玻璃机头
  g.fillStyle = rg(g, -1, -34, 0, 7, ['#ffd0a0', '#c24a1a', '#2a0a02']);
  g.beginPath(); g.ellipse(0, -31, 4.5, 6.5, 0, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 0.4;
  for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(i * 2, -37); g.lineTo(i * 2.5, -25); g.stroke(); }
  // 背部炮塔
  g.fillStyle = '#23282d'; g.beginPath(); g.arc(0, 2, 4, 0, TAU); g.fill();
  g.fillStyle = rg(g, -1, 1, 0, 3, ['#ffe8a0', '#e0402a', '#400']); g.beginPath(); g.arc(0, 2, 2.4, 0, TAU); g.fill();
}

function drawGunship(g) {
  // 激光炮艇：厚重机身，机头为聚能发射器（机头朝上）
  const ol = '#0b0610';
  const wing = [[8, -6], [30, 6], [34, 18], [30, 24], [10, 20]];
  sym(g, wing); g.fillStyle = lg(g, 0, -6, 0, 24, ['#7b4a8a', '#4a2a5a', '#1d0f26']); g.fill(); g.strokeStyle = ol; g.lineWidth = 0.9; g.stroke();
  g.save(); sym(g, wing); g.clip();
  g.fillStyle = 'rgba(255,90,200,.9)'; mirrorEach((sx) => g.fillRect(28 * sx - (sx < 0 ? 4 : 0), 10, 4, 10));
  g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 0.5; mirrorEach((sx) => { g.beginPath(); g.moveTo(14 * sx, 0); g.lineTo(20 * sx, 22); g.stroke(); });
  g.restore();
  const fus = [[0, -32], [6, -28], [11, -16], [12, 4], [11, 22], [8, 32], [4, 34]];
  sym(g, fus); g.fillStyle = lg(g, -12, 0, 12, 0, ['#1a0f22', '#4d3060', '#9b78b0', '#4d3060', '#1a0f22']); g.fill();
  g.save(); sym(g, fus); g.clip();
  g.fillStyle = 'rgba(0,0,0,.3)'; for (let y = -16; y < 34; y += 7) g.fillRect(-12, y, 24, 0.6);
  g.fillStyle = '#e8c33a'; g.fillRect(-12, 12, 24, 2);
  g.restore(); sym(g, fus); g.strokeStyle = ol; g.stroke();
  // 双发
  mirrorEach((sx) => { g.fillStyle = rg(g, 5 * sx, 33, 0, 3, ['#fff', '#ff5ad0', '#300']); g.beginPath(); g.arc(5 * sx, 33, 2.6, 0, TAU); g.fill(); });
  // 机头发射器
  g.fillStyle = lg(g, -6, 0, 6, 0, ['#222', '#777', '#222']); g.beginPath(); g.roundRect(-6, -38, 12, 14, 3); g.fill(); g.stroke();
  g.fillStyle = rg(g, 0, -36, 0, 6, ['#ffffff', '#ff7ae0', '#a0147a', 'rgba(80,0,60,0)']); g.beginPath(); g.arc(0, -36, 5, 0, TAU); g.fill();
  // 座舱
  g.fillStyle = rg(g, -1, -14, 0, 6, ['#d8ffb0', '#30a020', '#051a02']); g.beginPath(); g.ellipse(0, -12, 3.5, 6, 0, 0, TAU); g.fill();
}

function drawSaucer(g) {
  // 漂移弹飞碟
  g.fillStyle = 'rgba(0,0,0,.4)'; g.beginPath(); g.arc(0, 0, 22, 0, TAU); g.fill();
  g.fillStyle = lg(g, -22, -22, 22, 22, ['#c9b8e8', '#6a4fa0', '#24163e']); g.beginPath(); g.arc(0, 0, 21, 0, TAU); g.fill();
  g.strokeStyle = '#120a20'; g.lineWidth = 1; g.stroke();
  g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 0.6;
  for (let i = 0; i < 12; i++) { const a = (i * TAU) / 12; g.beginPath(); g.moveTo(Math.cos(a) * 11, Math.sin(a) * 11); g.lineTo(Math.cos(a) * 20, Math.sin(a) * 20); g.stroke(); }
  for (let i = 0; i < 6; i++) {
    const a = (i * TAU) / 6 + 0.26;
    g.fillStyle = rg(g, Math.cos(a) * 16, Math.sin(a) * 16, 0, 3, ['#fff', '#6ff7ff', 'rgba(0,160,255,0)']);
    g.beginPath(); g.arc(Math.cos(a) * 16, Math.sin(a) * 16, 3, 0, TAU); g.fill();
  }
  g.fillStyle = lg(g, -10, -10, 10, 10, ['#e5dcf5', '#56407e']); g.beginPath(); g.arc(0, 0, 10, 0, TAU); g.fill();
  g.fillStyle = rg(g, -3, -3, 0, 8, ['#fff', '#b58cff', '#3b1a78']); g.beginPath(); g.arc(0, 0, 6.5, 0, TAU); g.fill();
}

function drawCarrier(g) {
  // 补给运输机（机头朝上，橙黄警示条）
  const ol = '#140d02';
  const wing = [[6, -8], [44, -2], [46, 4], [44, 8], [6, 10]];
  sym(g, wing); g.fillStyle = lg(g, 0, -8, 0, 10, ['#d9dcdf', '#8b9096', '#44484d']); g.fill(); g.strokeStyle = ol; g.lineWidth = 0.9; g.stroke();
  g.save(); sym(g, wing); g.clip();
  for (let x = 30; x < 46; x += 4) mirrorEach((sx) => { g.fillStyle = (x / 4) % 2 ? '#f0a020' : '#1a1a1a'; g.fillRect(x * sx - (sx < 0 ? 4 : 0), -10, 4, 22); });
  g.restore();
  for (const ex of [16, 28]) mirrorEach((sx) => {
    g.fillStyle = lg(g, ex * sx - 3, 0, ex * sx + 3, 0, ['#333', '#aaa', '#333']); g.beginPath(); g.roundRect(ex * sx - 3, -12, 6, 16, 2.5); g.fill(); g.stroke();
    g.strokeStyle = 'rgba(40,40,40,.6)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(ex * sx - 7, -13); g.lineTo(ex * sx + 7, -13); g.stroke(); g.strokeStyle = ol; g.lineWidth = 0.9;
  });
  const fus = [[0, -30], [6, -26], [9, -14], [9.5, 18], [7, 28], [3, 30]];
  sym(g, fus); g.fillStyle = lg(g, -10, 0, 10, 0, ['#3d4146', '#a4a9ae', '#eef0f2', '#a4a9ae', '#3d4146']); g.fill(); g.stroke();
  g.save(); sym(g, fus); g.clip();
  g.fillStyle = '#f0a020'; g.fillRect(-10, -4, 20, 5); g.fillStyle = '#1a1a1a'; for (let x = -10; x < 10; x += 4) g.fillRect(x, -4, 2, 5);
  g.fillStyle = '#2d8a3a'; g.beginPath(); g.arc(0, 12, 4, 0, TAU); g.fill();
  g.fillStyle = '#fff'; g.fillRect(-2.6, 11.2, 5.2, 1.6); g.fillRect(-0.8, 9.4, 1.6, 5.2);
  g.restore();
  const tail = [[3, 22], [16, 26], [16, 30], [3, 30]]; sym(g, tail); g.fillStyle = '#6d7277'; g.fill(); g.stroke();
  g.fillStyle = rg(g, -1, -24, 0, 5, ['#e4f8ff', '#3b8ad0', '#08203a']); g.beginPath(); g.ellipse(0, -21, 4, 5, 0, 0, TAU); g.fill();
}

function drawTankBody(g, camo) {
  const [c0, c1, c2] = camo;
  // 履带
  mirrorEach((sx) => {
    g.fillStyle = '#1b1b18'; g.beginPath(); g.roundRect(sx > 0 ? 9 : -15, -19, 6, 38, 2); g.fill();
    g.fillStyle = '#3a3a33';
    for (let y = -18; y < 18; y += 3) g.fillRect(sx > 0 ? 9.5 : -14.5, y, 5, 1.3);
  });
  g.fillStyle = lg(g, -10, -16, 10, 16, [c2, c1, c0]);
  g.beginPath(); g.roundRect(-10.5, -16, 21, 32, 3); g.fill();
  g.strokeStyle = '#0c0c08'; g.lineWidth = 0.8; g.stroke();
  g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(-10.5, 8, 21, 1); g.fillRect(-10.5, -10, 21, 1);
  g.fillStyle = 'rgba(255,255,255,.15)'; g.fillRect(-9.5, -15, 19, 2);
  // 排气格栅
  g.fillStyle = '#1b1b18'; for (let i = 0; i < 4; i++) g.fillRect(-6 + i * 3.4, 11, 2, 4);
}
function drawTankTurret(g, camo) {
  const [c0, c1, c2] = camo;
  g.fillStyle = '#111'; g.fillRect(-1.5, -24, 3, 16);
  g.fillStyle = '#2a2a24'; g.fillRect(-2.2, -26, 4.4, 3);
  g.fillStyle = rg(g, -2, -3, 1, 10, [c2, c1, c0]);
  g.beginPath(); g.moveTo(-7, -6); g.lineTo(7, -6); g.lineTo(8.5, 4); g.lineTo(5, 8); g.lineTo(-5, 8); g.lineTo(-8.5, 4); g.closePath(); g.fill();
  g.strokeStyle = '#0c0c08'; g.lineWidth = 0.8; g.stroke();
  g.fillStyle = '#222'; g.beginPath(); g.arc(3, 2, 2.2, 0, TAU); g.fill();
  g.fillStyle = 'rgba(255,255,255,.2)'; g.beginPath(); g.arc(-2, -1, 2.5, 0, TAU); g.fill();
}

function drawBunker(g, col) {
  // 地面炮台底座（八角混凝土）
  g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath();
  for (let i = 0; i < 8; i++) { const a = (i * TAU) / 8 + TAU / 16; g.lineTo(Math.cos(a) * 23 + 3, Math.sin(a) * 23 + 4); }
  g.fill();
  g.beginPath();
  for (let i = 0; i < 8; i++) { const a = (i * TAU) / 8 + TAU / 16; g.lineTo(Math.cos(a) * 22, Math.sin(a) * 22); }
  g.closePath();
  g.fillStyle = lg(g, -22, -22, 22, 22, col); g.fill();
  g.strokeStyle = '#141414'; g.lineWidth = 1; g.stroke();
  g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 0.6;
  g.beginPath(); for (let i = 0; i < 8; i++) { const a = (i * TAU) / 8 + TAU / 16; g.lineTo(Math.cos(a) * 17, Math.sin(a) * 17); } g.closePath(); g.stroke();
  g.fillStyle = '#e8c33a';
  for (let i = 0; i < 4; i++) { const a = (i * TAU) / 4 + TAU / 8; g.beginPath(); g.arc(Math.cos(a) * 19, Math.sin(a) * 19, 1.3, 0, TAU); g.fill(); }
  g.fillStyle = '#1b1b1b'; g.beginPath(); g.arc(0, 0, 12.5, 0, TAU); g.fill();
}
function drawBunkerGun(g) {
  g.fillStyle = '#121212'; g.fillRect(-4.5, -24, 3, 16); g.fillRect(1.5, -24, 3, 16);
  g.fillStyle = '#3a3a3a'; g.fillRect(-5, -25, 4, 3); g.fillRect(1, -25, 4, 3);
  g.fillStyle = rg(g, -3, -3, 1, 12, ['#b8bec4', '#5a6068', '#22262a']);
  g.beginPath(); g.arc(0, 0, 10.5, 0, TAU); g.fill();
  g.strokeStyle = '#101010'; g.lineWidth = 0.8; g.stroke();
  g.fillStyle = '#d8261c'; g.beginPath(); g.arc(0, 2, 3, 0, TAU); g.fill();
  g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.arc(-1, 1, 1, 0, TAU); g.fill();
}

function drawBoat(g) {
  // 炮艇（俯视，艇首朝上）
  g.fillStyle = 'rgba(255,255,255,.25)';
  g.beginPath(); g.moveTo(0, -30); g.lineTo(14, 30); g.lineTo(-14, 30); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(0, -26); g.quadraticCurveTo(10, -14, 10, 4); g.lineTo(9, 24); g.lineTo(-9, 24); g.lineTo(-10, 4); g.quadraticCurveTo(-10, -14, 0, -26); g.closePath();
  g.fillStyle = lg(g, -10, 0, 10, 0, ['#2b3440', '#7a8898', '#2b3440']); g.fill(); g.strokeStyle = '#0a0d10'; g.lineWidth = 0.9; g.stroke();
  g.fillStyle = '#a5b2c0'; g.beginPath(); g.roundRect(-5, -2, 10, 14, 2); g.fill(); g.stroke();
  g.fillStyle = '#1b2530'; g.fillRect(-4, 0, 8, 2);
  g.fillStyle = '#c0392b'; g.fillRect(-9, 18, 18, 2);
}

function drawMissile(g) {
  g.fillStyle = lg(g, -2.5, 0, 2.5, 0, ['#4a4f55', '#dfe3e8', '#4a4f55']);
  g.beginPath(); g.roundRect(-2.4, -9, 4.8, 18, 2); g.fill();
  g.fillStyle = '#d8261c'; g.beginPath(); g.moveTo(-2.4, -8); g.quadraticCurveTo(0, -14, 2.4, -8); g.fill();
  g.fillStyle = '#333'; g.beginPath(); g.moveTo(-2.4, 5); g.lineTo(-5, 10); g.lineTo(5, 10); g.lineTo(2.4, 5); g.fill();
  g.fillStyle = '#ffcc00'; g.fillRect(-2.4, -3, 4.8, 1.4);
}

function drawRock(g, seed, r) {
  const R = mulberry(seed);
  const pts = [];
  const n = 11;
  for (let i = 0; i < n; i++) { const a = (i * TAU) / n; const rr = r * (0.75 + R() * 0.3); pts.push([Math.cos(a) * rr, Math.sin(a) * rr]); }
  g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath();
  g.fillStyle = rg(g, -r * 0.35, -r * 0.35, r * 0.1, r * 1.2, ['#a39a8e', '#5c544b', '#221e1a']); g.fill();
  g.strokeStyle = '#120f0c'; g.lineWidth = 1; g.stroke();
  g.save(); g.clip();
  for (let i = 0; i < 5; i++) {
    const cx = (R() - 0.5) * r * 1.2, cy = (R() - 0.5) * r * 1.2, cr = r * (0.12 + R() * 0.18);
    g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.arc(cx, cy, cr, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.arc(cx - cr * 0.3, cy - cr * 0.3, cr * 0.6, 0, TAU); g.fill();
  }
  g.restore();
}

// ---------- 中型舰与 BOSS ----------
function plate(g, x, y, w, h, c0, c1, r = 3) {
  g.fillStyle = lg(g, x, y, x + w, y + h, [c1, c0]);
  g.beginPath(); g.roundRect(x, y, w, h, r); g.fill();
  g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 0.8; g.stroke();
  g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 0.6;
  g.beginPath(); g.moveTo(x + r, y + 0.8); g.lineTo(x + w - r, y + 0.8); g.stroke();
}
function rivets(g, x0, y0, x1, y1, step = 6) {
  g.fillStyle = 'rgba(0,0,0,.45)';
  for (let x = x0; x <= x1; x += step) for (let y = y0; y <= y1; y += step) { g.beginPath(); g.arc(x, y, 0.6, 0, TAU); g.fill(); }
}
function glowDot(g, x, y, r, col) {
  g.fillStyle = rg(g, x, y, 0, r, ['#ffffff', col, 'rgba(0,0,0,0)']);
  g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
}

function drawCruiser(g) {
  // 中型空中战舰（机头朝下，因为是从上方压下来的舰船）
  const ol = '#0a0d10';
  const hull = [[0, 78], [18, 66], [34, 40], [44, 10], [46, -30], [40, -60], [26, -76], [0, -80]];
  // 侧翼
  const wing = [[40, -30], [96, -12], [104, 4], [98, 14], [44, 16]];
  sym(g, wing); g.fillStyle = lg(g, 0, -30, 0, 16, ['#8c98a2', '#4e5963', '#20272d']); g.fill(); g.strokeStyle = ol; g.lineWidth = 1; g.stroke();
  g.save(); sym(g, wing); g.clip();
  g.fillStyle = 'rgba(0,0,0,.25)'; for (let x = 50; x < 104; x += 8) mirrorEach((sx) => g.fillRect(x * sx, -30, 0.8 * sx, 50));
  mirrorEach((sx) => { g.fillStyle = '#c0392b'; g.fillRect(92 * sx - (sx < 0 ? 8 : 0), -4, 8, 12); });
  g.restore();
  // 引擎舱
  mirrorEach((sx) => {
    plate(g, 60 * sx - 9, -40, 18, 44, '#2a3036', '#8a959e', 4);
    glowDot(g, 60 * sx, -42, 7, '#ff9a2a');
  });
  sym(g, hull);
  g.fillStyle = lg(g, -46, 0, 46, 0, ['#1c2228', '#56626c', '#aab6c0', '#56626c', '#1c2228']); g.fill();
  g.save(); sym(g, hull); g.clip();
  for (let y = -70; y < 80; y += 14) { g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(-50, y, 100, 0.8); }
  g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(-1, -80, 2, 160);
  g.fillStyle = '#e8c33a'; g.fillRect(-50, 30, 100, 3); g.fillStyle = '#1a1a1a'; for (let x = -50; x < 50; x += 6) g.fillRect(x, 30, 3, 3);
  rivets(g, -36, -60, 36, 20, 12);
  g.restore(); sym(g, hull); g.strokeStyle = ol; g.lineWidth = 1.2; g.stroke();
  // 舰桥
  plate(g, -14, -30, 28, 30, '#39434c', '#b8c3cc', 5);
  g.fillStyle = rg(g, 0, -18, 0, 8, ['#e0ffff', '#2aa3d0', '#062030']); g.beginPath(); g.roundRect(-9, -24, 18, 8, 3); g.fill();
  // 炮座
  for (const [x, y] of [[-26, 10], [26, 10], [0, 50]]) { g.fillStyle = '#222'; g.beginPath(); g.arc(x, y, 9, 0, TAU); g.fill(); g.strokeStyle = '#555'; g.lineWidth = 1; g.stroke(); }
}

function drawBossTurret(g, col = ['#2a2f35', '#8b96a0', '#d5dde4']) {
  g.fillStyle = '#0e0e0e'; g.fillRect(-2.2, -22, 4.4, 14);
  g.fillStyle = '#444'; g.fillRect(-3, -23, 6, 3);
  g.fillStyle = rg(g, -2, -2, 1, 11, [col[2], col[1], col[0]]);
  g.beginPath(); g.arc(0, 0, 9.5, 0, TAU); g.fill();
  g.strokeStyle = '#0a0a0a'; g.lineWidth = 0.9; g.stroke();
  g.fillStyle = '#c0392b'; g.beginPath(); g.arc(0, 1, 3, 0, TAU); g.fill();
  g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.arc(-1, 0, 1, 0, TAU); g.fill();
}

function drawBoss1(g) {
  // 第一关 BOSS：陆行巨蟹重战车（俯视，炮口朝下）
  const ol = '#0c0c08';
  // 四条履带腿
  for (const [x, y, a] of [[-78, -40, -0.35], [78, -40, 0.35], [-82, 36, 0.3], [82, 36, -0.3]]) {
    g.save(); g.translate(x, y); g.rotate(a);
    g.fillStyle = '#18180f'; g.beginPath(); g.roundRect(-14, -30, 28, 60, 6); g.fill();
    g.fillStyle = '#3b3a2c'; for (let yy = -28; yy < 28; yy += 5) g.fillRect(-13, yy, 26, 2);
    plate(g, -8, -22, 16, 44, '#4a4a2a', '#9c9a60', 4);
    g.restore();
  }
  // 连接臂
  g.strokeStyle = '#2d2c1c'; g.lineWidth = 12;
  for (const [x, y] of [[-70, -36], [70, -36], [-72, 32], [72, 32]]) { g.beginPath(); g.moveTo(0, 0); g.lineTo(x, y); g.stroke(); }
  g.strokeStyle = '#6f6d45'; g.lineWidth = 6;
  for (const [x, y] of [[-70, -36], [70, -36], [-72, 32], [72, 32]]) { g.beginPath(); g.moveTo(0, 0); g.lineTo(x, y); g.stroke(); }
  // 主车体（八边形装甲）
  const hull = [[0, -70], [40, -62], [62, -30], [62, 30], [44, 64], [0, 72]];
  sym(g, hull);
  g.fillStyle = lg(g, -62, -70, 62, 72, ['#b7b27a', '#6d6a40', '#2d2b18']); g.fill();
  g.save(); sym(g, hull); g.clip();
  g.fillStyle = 'rgba(50,48,20,.55)';
  const R = mulberry(7);
  for (let i = 0; i < 14; i++) { g.beginPath(); g.ellipse((R() - 0.5) * 110, (R() - 0.5) * 130, 8 + R() * 14, 5 + R() * 9, R() * 3, 0, TAU); g.fill(); }
  g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 0.8;
  for (let y = -60; y < 70; y += 16) { g.beginPath(); g.moveTo(-62, y); g.lineTo(62, y); g.stroke(); }
  g.fillStyle = '#e8c33a'; g.fillRect(-62, 44, 124, 4); g.fillStyle = '#111'; for (let x = -62; x < 62; x += 8) g.fillRect(x, 44, 4, 4);
  rivets(g, -50, -50, 50, 50, 10);
  g.restore(); sym(g, hull); g.strokeStyle = ol; g.lineWidth = 1.4; g.stroke();
  // 主炮基座与双管主炮（朝下）
  plate(g, -30, -24, 60, 48, '#3c3a22', '#a8a470', 10);
  g.fillStyle = '#141410'; g.fillRect(-14, 20, 9, 58); g.fillRect(5, 20, 9, 58);
  g.fillStyle = '#4a4836'; g.fillRect(-15, 70, 11, 8); g.fillRect(4, 70, 11, 8);
  g.fillStyle = rg(g, -6, -6, 2, 26, ['#e6e2b0', '#8a8650', '#33311c']); g.beginPath(); g.arc(0, 0, 22, 0, TAU); g.fill();
  g.strokeStyle = ol; g.lineWidth = 1; g.stroke();
  glowDot(g, 0, 0, 10, '#ff3a1a');
  // 前部探照灯
  glowDot(g, -30, 58, 5, '#ffe080'); glowDot(g, 30, 58, 5, '#ffe080');
}

function drawBoss2(g) {
  // 第二关 BOSS：沙暴飞翼（机头朝下）
  const ol = '#0b0906';
  const wing = [[0, 60], [40, 40], [120, -6], [170, -26], [176, -14], [150, 6], [96, 20], [60, 30], [30, -40], [0, -54]];
  sym(g, wing);
  g.fillStyle = lg(g, 0, -54, 0, 60, ['#6e5a3c', '#b89a66', '#5a4630']); g.fill();
  g.save(); sym(g, wing); g.clip();
  g.fillStyle = lg(g, -176, 0, 176, 0, [[0, 'rgba(0,0,0,.4)'], [0.5, 'rgba(255,255,255,.15)'], [1, 'rgba(0,0,0,.4)']]); g.fillRect(-176, -60, 352, 130);
  g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 0.8;
  for (let x = 20; x < 176; x += 14) mirrorEach((sx) => { g.beginPath(); g.moveTo(x * sx, -60); g.lineTo(x * sx, 60); g.stroke(); });
  // 沙漠迷彩
  const R = mulberry(11);
  g.fillStyle = 'rgba(90,60,30,.45)';
  for (let i = 0; i < 20; i++) { g.beginPath(); g.ellipse((R() - 0.5) * 320, (R() - 0.5) * 70, 10 + R() * 18, 5 + R() * 8, R() * 3, 0, TAU); g.fill(); }
  mirrorEach((sx) => { g.fillStyle = '#b3261e'; g.fillRect(150 * sx - (sx < 0 ? 18 : 0), -22, 18, 6); });
  g.restore(); sym(g, wing); g.strokeStyle = ol; g.lineWidth = 1.4; g.stroke();
  // 引擎（向上喷）
  for (const ex of [52, 80]) mirrorEach((sx) => {
    plate(g, ex * sx - 8, -44 + ex * 0.2, 16, 34, '#3a3024', '#a8946c', 5);
    glowDot(g, ex * sx, -46 + ex * 0.2, 8, '#ff9a2a');
  });
  // 中央机体
  const fus = [[0, 70], [22, 50], [30, 0], [26, -44], [0, -56]];
  sym(g, fus); g.fillStyle = lg(g, -30, 0, 30, 0, ['#3a2e1c', '#9c8054', '#e8d2a2', '#9c8054', '#3a2e1c']); g.fill(); g.strokeStyle = ol; g.lineWidth = 1.2; g.stroke();
  g.fillStyle = rg(g, 0, 40, 0, 14, ['#ffe6c0', '#d04010', '#300800']); g.beginPath(); g.ellipse(0, 38, 9, 14, 0, 0, TAU); g.fill();
  plate(g, -14, -20, 28, 30, '#3a3024', '#c0aa80', 6);
  glowDot(g, 0, -5, 11, '#ff4020');
}

function drawBoss3(g) {
  // 第三关 BOSS：冰海战列舰（舰首朝下）
  const ol = '#080b0e';
  const hull = [[0, 190], [30, 150], [58, 80], [66, 0], [64, -110], [54, -170], [30, -190], [0, -192]];
  // 尾迹/破冰浪
  g.fillStyle = 'rgba(255,255,255,.35)';
  g.beginPath(); g.moveTo(0, 196); g.lineTo(90, 150); g.lineTo(70, 150); g.lineTo(0, 184); g.lineTo(-70, 150); g.lineTo(-90, 150); g.closePath(); g.fill();
  sym(g, hull);
  g.fillStyle = lg(g, -66, 0, 66, 0, ['#1b232b', '#56636e', '#8e9ca8', '#56636e', '#1b232b']); g.fill();
  g.save(); sym(g, hull); g.clip();
  // 甲板木纹/钢板
  g.fillStyle = lg(g, -50, 0, 50, 0, ['#4a5560', '#6d7a86', '#4a5560']); g.fillRect(-50, -180, 100, 350);
  g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 0.6;
  for (let x = -48; x < 50; x += 6) { g.beginPath(); g.moveTo(x, -180); g.lineTo(x, 170); g.stroke(); }
  for (let y = -170; y < 170; y += 30) { g.beginPath(); g.moveTo(-60, y); g.lineTo(60, y); g.stroke(); }
  g.fillStyle = '#9b2a22'; g.fillRect(-70, 150, 140, 60);
  g.restore(); sym(g, hull); g.strokeStyle = ol; g.lineWidth = 1.6; g.stroke();
  // 上层建筑
  plate(g, -30, -60, 60, 90, '#2c353e', '#9aa8b4', 8);
  plate(g, -22, -50, 44, 50, '#3a4550', '#c2ced8', 6);
  g.fillStyle = rg(g, 0, -30, 0, 16, ['#e8fbff', '#40b8e8', '#082838']); g.beginPath(); g.roundRect(-16, -40, 32, 12, 4); g.fill();
  // 烟囱
  plate(g, -12, 36, 24, 30, '#1c2228', '#6a7682', 6);
  g.fillStyle = '#0b0b0b'; g.beginPath(); g.ellipse(0, 50, 8, 10, 0, 0, TAU); g.fill();
  // 雷达
  g.strokeStyle = '#cfd8e0'; g.lineWidth = 2; g.beginPath(); g.moveTo(-18, -70); g.lineTo(18, -70); g.stroke();
  // 炮座底盘
  for (const [x, y, r] of [[0, 120, 20], [0, 80, 16], [-40, -120, 13], [40, -120, 13], [0, -150, 16], [-42, 0, 12], [42, 0, 12]]) {
    g.fillStyle = '#15191d'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.strokeStyle = '#6b7884'; g.lineWidth = 1.2; g.stroke();
  }
}

function drawBoss4(g) {
  // 第四关 BOSS：天穹浮空要塞（圆盘+外环）
  const ol = '#06080c';
  g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.arc(0, 0, 150, 0, TAU); g.fill();
  g.beginPath(); g.arc(0, 0, 148, 0, TAU);
  g.fillStyle = rg(g, -40, -50, 20, 160, ['#dfe6f0', '#7a889a', '#2a3340', '#10151c']); g.fill();
  g.strokeStyle = ol; g.lineWidth = 2; g.stroke();
  g.save(); g.beginPath(); g.arc(0, 0, 148, 0, TAU); g.clip();
  g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1;
  for (let i = 0; i < 24; i++) { const a = (i * TAU) / 24; g.beginPath(); g.moveTo(Math.cos(a) * 60, Math.sin(a) * 60); g.lineTo(Math.cos(a) * 150, Math.sin(a) * 150); g.stroke(); }
  for (const r of [70, 100, 128]) { g.beginPath(); g.arc(0, 0, r, 0, TAU); g.stroke(); }
  for (let i = 0; i < 16; i++) { const a = (i * TAU) / 16 + 0.1; glowDot(g, Math.cos(a) * 138, Math.sin(a) * 138, 4, '#6ff7ff'); }
  g.restore();
  // 内圈
  g.beginPath(); g.arc(0, 0, 62, 0, TAU); g.fillStyle = rg(g, -10, -14, 5, 64, ['#4b566a', '#1d232e', '#080a0e']); g.fill(); g.strokeStyle = '#8aa0b8'; g.lineWidth = 2; g.stroke();
  for (let i = 0; i < 8; i++) { const a = (i * TAU) / 8; plate(g, Math.cos(a) * 46 - 6, Math.sin(a) * 46 - 6, 12, 12, '#2a3340', '#9fb0c4', 3); }
}

function drawBoss4Core(g) {
  g.fillStyle = rg(g, 0, 0, 0, 34, ['#ffffff', '#9cf0ff', '#1a8ad0', 'rgba(10,40,90,0)']); g.beginPath(); g.arc(0, 0, 34, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 1.2; g.beginPath(); g.arc(0, 0, 20, 0, TAU); g.stroke();
}

function drawBoss5(g) {
  // 最终 BOSS：「雷霆母舰」核心舰体（舰首朝下）
  const ol = '#05060a';
  const wing = [[0, 120], [60, 100], [150, 40], [220, 0], [230, -30], [200, -60], [120, -80], [60, -120], [0, -130]];
  sym(g, wing);
  g.fillStyle = lg(g, 0, -130, 0, 120, ['#3a2a4e', '#6a567e', '#231832']); g.fill();
  g.save(); sym(g, wing); g.clip();
  g.fillStyle = lg(g, -230, 0, 230, 0, [[0, 'rgba(0,0,0,.5)'], [0.5, 'rgba(255,255,255,.12)'], [1, 'rgba(0,0,0,.5)']]); g.fillRect(-240, -140, 480, 270);
  g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 0.8;
  for (let x = 12; x < 240; x += 16) mirrorEach((sx) => { g.beginPath(); g.moveTo(x * sx, -140); g.lineTo(x * sx, 130); g.stroke(); });
  for (let y = -120; y < 130; y += 20) { g.beginPath(); g.moveTo(-240, y); g.lineTo(240, y); g.stroke(); }
  // 发光能量槽
  mirrorEach((sx) => {
    for (let i = 0; i < 5; i++) { g.fillStyle = 'rgba(255,60,200,.85)'; g.fillRect((70 + i * 28) * sx - (sx < 0 ? 16 : 0), -40 + i * 12, 16, 4); }
    g.fillStyle = 'rgba(120,240,255,.9)'; g.fillRect(200 * sx - (sx < 0 ? 6 : 0), -40, 6, 30);
  });
  rivets(g, -200, -100, 200, 100, 16);
  g.restore(); sym(g, wing); g.strokeStyle = ol; g.lineWidth = 2; g.stroke();
  // 引擎群（上方）
  for (const ex of [40, 80, 120]) mirrorEach((sx) => { plate(g, ex * sx - 10, -110 + ex * 0.2, 20, 36, '#231a30', '#8a78a6', 6); glowDot(g, ex * sx, -112 + ex * 0.2, 10, '#c050ff'); });
  // 中央舰体
  const fus = [[0, 150], [34, 120], [50, 40], [52, -60], [40, -110], [0, -126]];
  sym(g, fus); g.fillStyle = lg(g, -52, 0, 52, 0, ['#1d1428', '#5a4672', '#c8b6e0', '#5a4672', '#1d1428']); g.fill(); g.strokeStyle = ol; g.lineWidth = 1.6; g.stroke();
  g.save(); sym(g, fus); g.clip();
  g.fillStyle = 'rgba(0,0,0,.3)'; for (let y = -110; y < 150; y += 18) g.fillRect(-60, y, 120, 1);
  g.fillStyle = '#ffc94a'; g.fillRect(-60, 90, 120, 4);
  g.restore();
  // 核心舱口
  g.fillStyle = '#0a0610'; g.beginPath(); g.ellipse(0, 20, 34, 40, 0, 0, TAU); g.fill();
  g.strokeStyle = '#8a70b0'; g.lineWidth = 2; g.stroke();
  for (let i = 0; i < 8; i++) { const a = (i * TAU) / 8; g.strokeStyle = 'rgba(160,120,220,.6)'; g.lineWidth = 1; g.beginPath(); g.moveTo(Math.cos(a) * 36, 20 + Math.sin(a) * 42); g.lineTo(Math.cos(a) * 26, 20 + Math.sin(a) * 30); g.stroke(); }
  // 舰首双主炮
  mirrorEach((sx) => { g.fillStyle = '#111'; g.fillRect(18 * sx - 4, 120, 8, 44); g.fillStyle = '#5a4672'; g.fillRect(18 * sx - 5, 158, 10, 6); });
}

function drawCore(g, col) {
  g.fillStyle = rg(g, 0, 0, 0, 30, ['#ffffff', col, 'rgba(40,0,40,.9)', 'rgba(0,0,0,0)']);
  g.beginPath(); g.arc(0, 0, 30, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 1;
  g.beginPath(); g.arc(0, 0, 16, 0, TAU); g.stroke();
}

// ---------- 子弹 / 光效 ----------
function orb(r, rim, core, dark) {
  const s = r * 3.2;
  return sprite(s, s, (g) => {
    g.fillStyle = rg(g, 0, 0, r * 0.6, s / 2, [[0, rim], [1, 'rgba(0,0,0,0)']]);
    g.globalAlpha = 0.45; g.beginPath(); g.arc(0, 0, s / 2, 0, TAU); g.fill(); g.globalAlpha = 1;
    g.fillStyle = dark; g.beginPath(); g.arc(0, 0, r + 0.8, 0, TAU); g.fill();
    g.fillStyle = rg(g, -r * 0.2, -r * 0.2, 0, r, [[0, '#ffffff'], [0.45, core], [1, rim]]);
    g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
  }, 3);
}
function needle(len, wid, rim, core) {
  return sprite(wid * 3, len + wid * 2, (g) => {
    g.fillStyle = rg(g, 0, 0, 0, len / 2 + wid, [[0, rim], [1, 'rgba(0,0,0,0)']]);
    g.globalAlpha = 0.5; g.beginPath(); g.ellipse(0, 0, wid * 1.5, len / 2 + wid, 0, 0, TAU); g.fill(); g.globalAlpha = 1;
    g.fillStyle = lg(g, -wid / 2, 0, wid / 2, 0, [rim, core, '#fff', core, rim]);
    g.beginPath(); g.ellipse(0, 0, wid / 2, len / 2, 0, 0, TAU); g.fill();
  }, 3);
}
function glow(r, col, core = '#ffffff') {
  return sprite(r * 2, r * 2, (g) => {
    g.fillStyle = rg(g, 0, 0, 0, r, [[0, core], [0.25, col], [1, 'rgba(0,0,0,0)']]);
    g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
  }, 1.5);
}
function puff(r, col) {
  return sprite(r * 2, r * 2, (g) => {
    const R = mulberry(r * 13);
    for (let i = 0; i < 7; i++) {
      const x = (R() - 0.5) * r * 0.8, y = (R() - 0.5) * r * 0.8, rr = r * (0.35 + R() * 0.3);
      g.fillStyle = rg(g, x, y, 0, rr, [[0, col], [1, 'rgba(0,0,0,0)']]);
      g.beginPath(); g.arc(x, y, rr, 0, TAU); g.fill();
    }
  }, 1);
}
function flame() {
  return sprite(16, 48, (g) => {
    g.fillStyle = rg(g, 0, -14, 0, 26, [[0, 'rgba(255,255,255,1)'], [0.2, 'rgba(255,240,170,.95)'], [0.5, 'rgba(255,140,40,.6)'], [1, 'rgba(255,40,0,0)']], 0, -6);
    g.beginPath(); g.ellipse(0, 0, 7, 23, 0, 0, TAU); g.fill();
  }, 3);
}
function blueFlame() {
  return sprite(16, 48, (g) => {
    g.fillStyle = rg(g, 0, -14, 0, 26, [[0, 'rgba(255,255,255,1)'], [0.2, 'rgba(180,240,255,.95)'], [0.5, 'rgba(60,140,255,.6)'], [1, 'rgba(0,40,255,0)']], 0, -6);
    g.beginPath(); g.ellipse(0, 0, 7, 23, 0, 0, TAU); g.fill();
  }, 3);
}

// 道具：武器晶体
export const WEAPON_COLORS = {
  blue: { main: '#2f8dff', light: '#9fdcff', dark: '#082a66', glow: '#39a0ff', name: '蓝·贯穿激光' },
  green: { main: '#27d86a', light: '#b6ffc8', dark: '#063d1c', glow: '#3dff86', name: '绿·追踪导弹' },
  purple: { main: '#a650ff', light: '#e6c8ff', dark: '#2c0a5c', glow: '#c070ff', name: '紫·雷电锁链' },
  gold: { main: '#ffb81c', light: '#fff0b0', dark: '#6a3a00', glow: '#ffd040', name: '金·雷霆散弹' },
};

function drawIcon(g, kind, col) {
  g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.lineWidth = 2; g.lineCap = 'round';
  if (kind === 'blue') { g.fillRect(-1.6, -8, 3.2, 16); g.globalAlpha = 0.6; g.fillRect(-5, -5, 1.6, 10); g.fillRect(3.4, -5, 1.6, 10); g.globalAlpha = 1; }
  else if (kind === 'green') {
    g.beginPath(); g.moveTo(0, -8); g.lineTo(3, -3); g.lineTo(3, 6); g.lineTo(-3, 6); g.lineTo(-3, -3); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(-3, 3); g.lineTo(-6, 8); g.lineTo(-3, 6); g.fill(); g.beginPath(); g.moveTo(3, 3); g.lineTo(6, 8); g.lineTo(3, 6); g.fill();
  } else if (kind === 'purple') {
    g.beginPath(); g.moveTo(2, -9); g.lineTo(-4, 1); g.lineTo(0, 1); g.lineTo(-2, 9); g.lineTo(5, -2); g.lineTo(1, -2); g.closePath(); g.fill();
  } else if (kind === 'gold') {
    for (const a of [-0.5, -0.25, 0, 0.25, 0.5]) { g.save(); g.rotate(a); g.fillRect(-1, -9, 2, 7); g.restore(); }
    g.beginPath(); g.arc(0, 4, 3.2, 0, TAU); g.fill();
  }
}
function crystal(kind) {
  const C = WEAPON_COLORS[kind];
  return sprite(40, 40, (g) => {
    g.fillStyle = rg(g, 0, 0, 4, 20, [[0, C.glow], [1, 'rgba(0,0,0,0)']]); g.globalAlpha = 0.6; g.beginPath(); g.arc(0, 0, 20, 0, TAU); g.fill(); g.globalAlpha = 1;
    // 六边形晶体胶囊
    g.beginPath(); for (let i = 0; i < 6; i++) { const a = (i * TAU) / 6 - Math.PI / 2; g.lineTo(Math.cos(a) * 15, Math.sin(a) * 15); } g.closePath();
    g.fillStyle = lg(g, -15, -15, 15, 15, [C.light, C.main, C.dark]); g.fill();
    g.strokeStyle = '#fff'; g.lineWidth = 1.2; g.stroke();
    g.beginPath(); for (let i = 0; i < 6; i++) { const a = (i * TAU) / 6 - Math.PI / 2; g.lineTo(Math.cos(a) * 11, Math.sin(a) * 11); } g.closePath();
    g.fillStyle = 'rgba(0,0,0,.28)'; g.fill();
    g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.moveTo(-12, -6); g.lineTo(0, -13); g.lineTo(6, -10); g.lineTo(-8, -3); g.closePath(); g.fill();
    drawIcon(g, kind, C);
  }, 3);
}
function bombItem() {
  return sprite(36, 36, (g) => {
    g.fillStyle = rg(g, 0, 0, 3, 18, [[0, 'rgba(255,90,40,.8)'], [1, 'rgba(0,0,0,0)']]); g.beginPath(); g.arc(0, 0, 18, 0, TAU); g.fill();
    g.fillStyle = lg(g, -12, -12, 12, 12, ['#ffd0a0', '#ff4a1a', '#6a0e00']); g.beginPath(); g.roundRect(-12, -12, 24, 24, 6); g.fill();
    g.strokeStyle = '#fff'; g.lineWidth = 1.2; g.stroke();
    g.fillStyle = '#fff'; g.font = '900 16px Orbitron, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('B', 0, 1);
  }, 3);
}
function medal() {
  return sprite(28, 28, (g) => {
    g.fillStyle = lg(g, -12, -12, 12, 12, ['#fff6c0', '#ffb81c', '#7a4a00']); g.beginPath(); g.arc(0, 0, 11, 0, TAU); g.fill();
    g.strokeStyle = '#5a3400'; g.lineWidth = 1; g.stroke();
    g.fillStyle = '#fff3a0';
    g.beginPath(); for (let i = 0; i < 10; i++) { const a = (i * TAU) / 10 - Math.PI / 2, r = i % 2 ? 3 : 7; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill();
    g.strokeStyle = 'rgba(120,70,0,.8)'; g.lineWidth = 0.6; g.stroke();
  }, 3);
}
function oneUp() {
  return sprite(40, 30, (g) => {
    g.fillStyle = rg(g, 0, 0, 3, 20, [[0, 'rgba(80,255,140,.8)'], [1, 'rgba(0,0,0,0)']]); g.beginPath(); g.arc(0, 0, 20, 0, TAU); g.fill();
    g.fillStyle = lg(g, 0, -10, 0, 10, ['#c8ffd8', '#18b050', '#063a18']); g.beginPath(); g.roundRect(-16, -10, 32, 20, 6); g.fill();
    g.strokeStyle = '#fff'; g.lineWidth = 1.2; g.stroke();
    g.fillStyle = '#fff'; g.font = '900 11px Orbitron, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('1UP', 0, 1);
  }, 3);
}

export function buildArt(quality = 2.5) {
  SS = quality;
  // 玩家战机：5 帧倾斜动画
  ART.ships = {};
  for (const id of Object.keys(SHIP_SPECS)) {
    const S = SHIP_SPECS[id];
    const frames = [-1, -0.5, 0, 0.5, 1].map((b) => jetSprite(S, b));
    ART.ships[id] = { frames, shadow: silhouette(frames[2]), spec: S, big: jetSprite(S, 0, 2.4) };
  }
  ART.enemy = {};
  for (const id of Object.keys(ENEMY_JETS)) {
    const sp = jetSprite(ENEMY_JETS[id]);
    ART.enemy[id] = sp; ART.enemy[id + '_s'] = silhouette(sp);
  }
  const add = (id, w, h, fn, sh = true) => { const sp = sprite(w, h, fn); ART.enemy[id] = sp; if (sh) ART.enemy[id + '_s'] = silhouette(sp); };
  add('heli', 40, 60, drawHeli);
  ART.rotor = sprite(64, 64, (g) => drawRotor(g, 30));
  add('bomber', 116, 90, drawBomber);
  add('gunship', 72, 80, drawGunship);
  add('saucer', 48, 48, drawSaucer);
  add('carrier', 96, 64, drawCarrier);
  const camoA = ['#2e3319', '#6b7a3a', '#a8b870'], camoD = ['#4a3a20', '#a88a55', '#e0c890'], camoS = ['#48525c', '#9aa6b2', '#e8eef4'];
  add('tankA', 32, 42, (g) => drawTankBody(g, camoA), false);
  add('tankD', 32, 42, (g) => drawTankBody(g, camoD), false);
  add('tankS', 32, 42, (g) => drawTankBody(g, camoS), false);
  add('tankA_t', 20, 54, (g) => drawTankTurret(g, camoA), false);
  add('tankD_t', 20, 54, (g) => drawTankTurret(g, camoD), false);
  add('tankS_t', 20, 54, (g) => drawTankTurret(g, camoS), false);
  add('bunker', 54, 54, (g) => drawBunker(g, ['#b9b4a4', '#7d7868', '#3c392f']), false);
  add('bunkerS', 54, 54, (g) => drawBunker(g, ['#e8eef4', '#9fb0c0', '#4a5868']), false);
  add('bunkerM', 54, 54, (g) => drawBunker(g, ['#8e8aa0', '#4c4860', '#1e1c2a']), false);
  add('bunker_g', 24, 52, drawBunkerGun, false);
  add('boat', 30, 64, drawBoat, false);
  add('emissile', 12, 30, drawMissile);
  add('rock1', 60, 60, (g) => drawRock(g, 3, 27), false);
  add('rock2', 44, 44, (g) => drawRock(g, 9, 19), false);
  add('rock3', 80, 80, (g) => drawRock(g, 21, 37), false);
  add('cruiser', 212, 164, drawCruiser);
  add('bturret', 24, 48, (g) => drawBossTurret(g), false);
  add('bturretD', 24, 48, (g) => drawBossTurret(g, ['#3a3024', '#a8946c', '#f0dcb0']), false);
  add('bturretP', 24, 48, (g) => drawBossTurret(g, ['#231a30', '#7a64a0', '#e0d0ff']), false);
  add('boss1', 220, 180, drawBoss1);
  add('boss2', 356, 140, drawBoss2);
  add('boss3', 190, 400, drawBoss3, false);
  add('boss4', 304, 304, drawBoss4);
  add('boss4core', 70, 70, drawBoss4Core, false);
  add('boss5', 464, 300, drawBoss5);
  add('core', 64, 64, (g) => drawCore(g, '#ff50d0'), false);

  // 敌弹
  ART.eb = {
    o: orb(6, '#ff5a1a', '#ffc080', '#5a0a00'),
    p: orb(6, '#ff2a8a', '#ffb0e0', '#50002a'),
    b: orb(6, '#1a8aff', '#a0e0ff', '#00204a'),
    g: orb(6, '#18c050', '#b0ffc8', '#003a14'),
    v: orb(7, '#a040ff', '#e0c0ff', '#240050'),
    y: orb(6, '#ffc020', '#fff0b0', '#4a2a00'),
    big: orb(11, '#ff2a1a', '#ffb080', '#4a0000'),
    bigv: orb(11, '#b030ff', '#f0c0ff', '#2a0050'),
    rice: needle(16, 6, '#ff3a8a', '#ffd0e8'),
    riceB: needle(16, 6, '#2aa0ff', '#d0f0ff'),
  };
  // 玩家子弹
  ART.pb = {
    vulcan: needle(20, 6, '#ffb000', '#fff6c0'),
    vulcan2: needle(24, 8, '#ff9000', '#fff0a0'),
    shot: needle(16, 5, '#30ff90', '#e0fff0'),
    opt: needle(16, 5, '#30c0ff', '#e0f8ff'),
    shell: orb(5, '#ffb000', '#fff6c0', '#5a2a00'),
  };
  ART.pmissile = sprite(10, 26, (g) => {
    g.fillStyle = lg(g, -2.5, 0, 2.5, 0, ['#205030', '#d8ffe0', '#205030']); g.beginPath(); g.roundRect(-2.2, -9, 4.4, 18, 2); g.fill();
    g.fillStyle = '#20ff70'; g.beginPath(); g.moveTo(-2.2, -8); g.quadraticCurveTo(0, -13, 2.2, -8); g.fill();
    g.fillStyle = '#2a4a34'; g.beginPath(); g.moveTo(-2.2, 5); g.lineTo(-4.5, 10); g.lineTo(4.5, 10); g.lineTo(2.2, 5); g.fill();
  }, 3);
  ART.rocket = sprite(10, 28, (g) => {
    g.fillStyle = lg(g, -2.5, 0, 2.5, 0, ['#6a1010', '#fff', '#6a1010']); g.beginPath(); g.roundRect(-2.6, -10, 5.2, 20, 2); g.fill();
    g.fillStyle = '#e0261c'; g.beginPath(); g.moveTo(-2.6, -9); g.quadraticCurveTo(0, -15, 2.6, -9); g.fill();
    g.fillStyle = '#333'; g.beginPath(); g.moveTo(-2.6, 6); g.lineTo(-5, 11); g.lineTo(5, 11); g.lineTo(2.6, 6); g.fill();
  }, 3);
  // 僚机（苍龙专属）
  ART.option = sprite(22, 26, (g) => {
    g.fillStyle = lg(g, -9, 0, 9, 0, ['#0b1f4d', '#5898f5', '#0b1f4d']);
    g.beginPath(); g.moveTo(0, -12); g.lineTo(9, 6); g.lineTo(4, 10); g.lineTo(-4, 10); g.lineTo(-9, 6); g.closePath(); g.fill();
    g.strokeStyle = '#020a1c'; g.lineWidth = 0.8; g.stroke();
    glowDot(g, 0, 0, 5, '#35e8ff');
  }, 3);
  // 光效
  ART.glow = {
    white: glow(32, 'rgba(255,240,200,.8)'),
    orange: glow(32, 'rgba(255,130,30,.75)', '#fff4c0'),
    red: glow(32, 'rgba(255,50,30,.7)', '#ffd0a0'),
    blue: glow(32, 'rgba(60,150,255,.8)', '#e0f6ff'),
    cyan: glow(32, 'rgba(60,240,255,.8)', '#f0ffff'),
    green: glow(32, 'rgba(60,255,130,.8)', '#e8fff0'),
    purple: glow(32, 'rgba(180,80,255,.8)', '#f4e8ff'),
    gold: glow(32, 'rgba(255,200,40,.85)', '#fffbe0'),
    pink: glow(32, 'rgba(255,60,190,.8)', '#fff0fa'),
  };
  ART.smoke = puff(32, 'rgba(60,56,52,.55)');
  ART.smokeL = puff(32, 'rgba(160,150,140,.35)');
  ART.flame = flame();
  ART.bflame = blueFlame();
  ART.items = { blue: crystal('blue'), green: crystal('green'), purple: crystal('purple'), gold: crystal('gold'), bomb: bombItem(), medal: medal(), oneup: oneUp() };
}

// 供选择界面绘制大尺寸预览
export function drawShipPreview(ctx, id, x, y, scale, t) {
  const S = ART.ships[id];
  const sp = S.big;
  const w = sp.w * scale / 2.4, h = sp.h * scale / 2.4;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const fl = id === 'dragon' ? ART.bflame : ART.flame;
  for (const e of S.spec.engines) for (const sx of [1, -1]) {
    const f = 0.85 + Math.sin(t * 40 + sx) * 0.1 + Math.random() * 0.1;
    const fw = e[2] * 3.2 * scale, fh = 36 * scale * f;
    ctx.drawImage(fl.c, x + e[0] * sx * scale - fw / 2, y + e[1] * scale + e[2] * scale, fw, fh);
  }
  ctx.restore();
  ctx.drawImage(sp.c, x - w / 2, y - h / 2, w, h);
}
