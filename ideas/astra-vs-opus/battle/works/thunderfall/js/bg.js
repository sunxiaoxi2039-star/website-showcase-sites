// 卷轴背景：按关卡主题程序化生成地形分块（全局坐标确定性，块与块之间无缝衔接）
import { makeCanvas, hash, TAU, smooth, rand } from './util.js';

const CH = 256; // 分块高度（逻辑像素）

const THEMES = {
  coast: { name: 'coast', clouds: '#ffffff', cloudA: 0.5, shadow: true },
  desert: { name: 'desert', clouds: '#fff4e0', cloudA: 0.35, shadow: true },
  ice: { name: 'ice', clouds: '#f4fbff', cloudA: 0.55, shadow: true },
  sky: { name: 'sky', clouds: '#ffe6f0', cloudA: 0.6, shadow: true },
  space: { name: 'space', clouds: null, cloudA: 0, shadow: true },
};

function rgbaHex(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}

export class Background {
  constructor(theme, W, q) {
    this.theme = THEMES[theme];
    this.W = W;
    this.q = q;
    this.scroll = 0;
    this.chunks = new Map();
    this.overlay = [];
    this.cloudSprites = this.theme.clouds ? makeCloudSprites(this.theme.clouds, theme === 'sky') : [];
    this.stars = [];
    for (let i = 0; i < 90; i++) this.stars.push({ x: Math.random() * W, y: Math.random() * 1400, z: rand(0.3, 1) });
  }
  get shadow() { return this.theme.shadow; }

  chunk(k) {
    let c = this.chunks.get(k);
    if (!c) {
      c = makeCanvas(this.W * this.q, CH * this.q);
      const g = c.getContext('2d');
      g.setTransform(this.q, 0, 0, this.q, 0, 0);
      const Y = (gy) => (k + 1) * CH - gy;
      g.save();
      GEN[this.theme.name](g, this.W, k, Y);
      g.restore();
      this.chunks.set(k, c);
    }
    return c;
  }

  update(dt, speed, H) {
    this.scroll += speed * dt;
    const k0 = Math.floor(this.scroll / CH) - 1;
    for (const k of this.chunks.keys()) if (k < k0) this.chunks.delete(k);
    // 视差云层
    if (this.cloudSprites.length) {
      const rate = this.theme.name === 'sky' ? 1.2 : 0.5;
      if (Math.random() < dt * rate) {
        const sp = this.cloudSprites[(Math.random() * this.cloudSprites.length) | 0];
        const sc = rand(0.8, 1.6);
        this.overlay.push({ sp, x: rand(-60, this.W + 60), y: -sp.h * sc, sc, v: speed * rand(1.8, 2.6), a: this.theme.cloudA * rand(0.6, 1) });
      }
    }
    for (const o of this.overlay) o.y += o.v * dt;
    this.overlay = this.overlay.filter((o) => o.y < H + 200);
    for (const s of this.stars) { s.y += speed * dt * (1.5 + s.z * 3); if (s.y > H) { s.y -= H + 10; s.x = Math.random() * this.W; } }
  }

  // 把地面坐标（屏幕 y）固定在地形上：返回当前滚动量，供地面单位同步
  draw(ctx, H) {
    const s = this.scroll;
    const k0 = Math.floor(s / CH), k1 = Math.floor((s + H) / CH);
    for (let k = k0; k <= k1; k++) {
      const c = this.chunk(k);
      const yb = H + s - k * CH;
      ctx.drawImage(c, 0, Math.floor((yb - CH) * 100) / 100, this.W, CH + 0.5);
    }
    if (this.theme.name === 'space') {
      ctx.fillStyle = '#cfe8ff';
      for (const st of this.stars) { ctx.globalAlpha = 0.3 + st.z * 0.6; ctx.fillRect(st.x, st.y, 1 + st.z, 1 + st.z * 5); }
      ctx.globalAlpha = 1;
    }
  }
  drawOverlay(ctx) {
    for (const o of this.overlay) {
      ctx.globalAlpha = o.a;
      ctx.drawImage(o.sp.c, o.x - (o.sp.w * o.sc) / 2, o.y, o.sp.w * o.sc, o.sp.h * o.sc);
    }
    ctx.globalAlpha = 1;
  }
  // 在地面上留下弹坑（直接画进地形分块）
  crater(x, yScreen, H, r) {
    const gy = this.scroll + H - yScreen;
    const k = Math.floor(gy / CH);
    for (const kk of [k - 1, k, k + 1]) {
      const c = this.chunks.get(kk);
      if (!c) continue;
      const g = c.getContext('2d');
      g.setTransform(this.q, 0, 0, this.q, 0, 0);
      const y = (kk + 1) * CH - gy;
      const grd = g.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, 'rgba(10,8,6,.85)'); grd.addColorStop(0.55, 'rgba(30,24,18,.6)'); grd.addColorStop(1, 'rgba(30,24,18,0)');
      g.fillStyle = grd; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
      g.fillStyle = 'rgba(0,0,0,.5)';
      for (let i = 0; i < 6; i++) { const a = Math.random() * TAU, d = r * (0.4 + Math.random() * 0.6); g.beginPath(); g.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, r * 0.12, 0, TAU); g.fill(); }
    }
  }
}

function makeCloudSprites(col, big) {
  const out = [];
  for (let i = 0; i < 6; i++) {
    const w = big ? 260 : 180, h = big ? 150 : 110;
    const c = makeCanvas(w, h);
    const g = c.getContext('2d');
    for (let j = 0; j < 14; j++) {
      const x = w * (0.2 + Math.random() * 0.6), y = h * (0.3 + Math.random() * 0.4), r = h * (0.18 + Math.random() * 0.22);
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, rgbaHex(col, 0.55)); gr.addColorStop(1, rgbaHex(col, 0));
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    }
    out.push({ c, w, h });
  }
  return out;
}

// ---------- 地形生成器 ----------
export function coastX(W, gy) {
  return W * (0.95 - 0.62 * smooth(gy / 3200)) + 34 * Math.sin(gy * 0.0031) + 18 * Math.sin(gy * 0.0093 + 2);
}

function drawWaves(g, W, k, Y, x0, x1, seed, col) {
  g.strokeStyle = col; g.lineWidth = 1.2;
  for (let i = 0; i < 70; i++) {
    const gy = k * CH + hash(i, k, seed) * CH;
    const x = x0 + hash(i, k, seed + 1) * (x1 - x0);
    const len = 6 + hash(i, k, seed + 2) * 14;
    g.globalAlpha = 0.18 + hash(i, k, seed + 3) * 0.3;
    g.beginPath(); g.moveTo(x, Y(gy)); g.quadraticCurveTo(x + len / 2, Y(gy) - 2.5, x + len, Y(gy)); g.stroke();
  }
  g.globalAlpha = 1;
}

function building(g, x, y, w, h, roof, seed) {
  g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x + 4, y + 5, w, h);
  const gr = g.createLinearGradient(x, y, x + w, y + h);
  gr.addColorStop(0, roof[0]); gr.addColorStop(1, roof[1]);
  g.fillStyle = gr; g.fillRect(x, y, w, h);
  g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 0.8; g.strokeRect(x + 0.4, y + 0.4, w - 0.8, h - 0.8);
  g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(x, y, w, 2);
  if (hash(seed, 1, 5) > 0.5) { g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x + w * 0.3, y + h * 0.3, w * 0.25, h * 0.25); }
}

function tree(g, x, y, r, c0, c1) {
  g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.arc(x + r * 0.5, y + r * 0.6, r, 0, TAU); g.fill();
  const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
  gr.addColorStop(0, c1); gr.addColorStop(1, c0);
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
}

function road(g, pts, w) {
  g.strokeStyle = '#3b3d40'; g.lineWidth = w + 3; g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke();
  g.strokeStyle = '#55585c'; g.lineWidth = w; g.stroke();
  g.strokeStyle = 'rgba(255,230,140,.8)'; g.lineWidth = 1; g.setLineDash([6, 6]); g.stroke(); g.setLineDash([]);
}

const GEN = {
  coast(g, W, k, Y) {
    const gy0 = k * CH - 20, gy1 = (k + 1) * CH + 20;
    // 海洋
    const og = g.createLinearGradient(0, 0, W, 0);
    og.addColorStop(0, '#0b3558'); og.addColorStop(0.6, '#155a86'); og.addColorStop(1, '#1d6f98');
    g.fillStyle = og; g.fillRect(0, 0, W, CH);
    drawWaves(g, W, k, Y, 0, W, 11, '#9fd6f0');
    const line = [];
    for (let gy = gy0; gy <= gy1; gy += 6) line.push([coastX(W, gy), Y(gy)]);
    const strokeLine = (col, lw, dx = 0) => { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); line.forEach((p, i) => (i ? g.lineTo(p[0] + dx, p[1]) : g.moveTo(p[0] + dx, p[1]))); g.stroke(); };
    strokeLine('rgba(60,170,190,.45)', 90);
    strokeLine('rgba(90,200,200,.55)', 40);
    // 陆地
    g.beginPath(); line.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
    g.lineTo(W + 10, line[line.length - 1][1]); g.lineTo(W + 10, line[0][1]); g.closePath();
    g.save(); g.clip();
    g.fillStyle = '#577f36'; g.fillRect(0, 0, W, CH);
    const cs = 56;
    const fields = ['#6f9a43', '#86a84d', '#9aa856', '#5b8a3c', '#b0a060', '#7a9a4a', '#6a8c3a'];
    const cy0 = Math.floor(gy0 / cs), cy1 = Math.floor(gy1 / cs);
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = 0; cx < W / cs + 1; cx++) {
      const h = hash(cx, cy, 3);
      const x = cx * cs, y = Y((cy + 1) * cs);
      const town = hash(cx >> 1, cy >> 1, 9) > 0.7 && cy > 12;
      if (town) {
        g.fillStyle = '#8c8a80'; g.fillRect(x, y, cs, cs);
        for (let i = 0; i < 4; i++) {
          const bw = 12 + hash(cx, cy, 20 + i) * 14, bh = 10 + hash(cx, cy, 30 + i) * 14;
          const bx = x + 3 + (i % 2) * 27 + hash(cx, cy, 40 + i) * 4, by = y + 3 + (i >> 1) * 27 + hash(cx, cy, 50 + i) * 4;
          const roofs = [['#c25a3c', '#7a2e1c'], ['#9aa4ae', '#4e5660'], ['#5e7ea8', '#2c3e5a'], ['#d8d2c0', '#8a8474']];
          building(g, bx, by, Math.min(bw, 24), Math.min(bh, 24), roofs[(hash(cx, cy, 60 + i) * 4) | 0], cx * 7 + cy + i);
        }
      } else {
        g.fillStyle = fields[(h * fields.length) | 0];
        g.fillRect(x + 1, y + 1, cs - 2, cs - 2);
        g.strokeStyle = 'rgba(0,0,0,.08)'; g.lineWidth = 1;
        const vert = hash(cx, cy, 4) > 0.5;
        for (let i = 4; i < cs; i += 5) { g.beginPath(); if (vert) { g.moveTo(x + i, y + 1); g.lineTo(x + i, y + cs - 1); } else { g.moveTo(x + 1, y + i); g.lineTo(x + cs - 1, y + i); } g.stroke(); }
        if (hash(cx, cy, 5) > 0.55) for (let i = 0; i < 5; i++) tree(g, x + hash(cx, cy, 70 + i) * cs, y + (hash(cx, cy, 80 + i) > 0.5 ? 2 : cs - 2), 4 + hash(cx, cy, 90 + i) * 3, '#1f4a1c', '#4c8a3a');
      }
    }
    // 道路
    const rx = (gy) => coastX(W, gy) + 70 + 20 * Math.sin(gy * 0.006);
    const rpts = []; for (let gy = gy0; gy <= gy1; gy += 8) rpts.push([rx(gy), Y(gy)]);
    road(g, rpts, 9);
    for (let cy = Math.ceil(gy0 / 448); cy * 448 <= gy1; cy++) road(g, [[0, Y(cy * 448)], [W, Y(cy * 448)]], 8);
    g.restore();
    // 沙滩与浪花
    strokeLine('#e6d6a2', 12, 2);
    g.setLineDash([10, 7]); strokeLine('rgba(255,255,255,.75)', 2.2, -6); g.setLineDash([]);
  },

  desert(g, W, k, Y) {
    const gy0 = k * CH - 30, gy1 = (k + 1) * CH + 30;
    g.fillStyle = '#d6b072'; g.fillRect(0, 0, W, CH);
    for (let cy = Math.floor(gy0 / 90); cy <= gy1 / 90; cy++) for (let cx = -1; cx < W / 90 + 1; cx++) {
      const h = hash(cx, cy, 2);
      g.fillStyle = h > 0.5 ? 'rgba(236,206,150,.4)' : 'rgba(180,135,80,.28)';
      g.beginPath(); g.ellipse(cx * 90 + hash(cx, cy, 3) * 90, Y(cy * 90 + hash(cx, cy, 4) * 90), 60 + h * 40, 30 + h * 20, h * 3, 0, TAU); g.fill();
    }
    // 沙丘脊线
    for (let j = Math.floor(gy0 / 46); j <= gy1 / 46; j++) {
      const base = j * 46, ph = hash(j, 0, 7) * 10, amp = 8 + hash(j, 0, 8) * 10;
      const pts = []; for (let x = -10; x <= W + 10; x += 10) pts.push([x, Y(base + amp * Math.sin(x * 0.018 + ph) + 5 * Math.sin(x * 0.05 + ph * 2))]);
      g.strokeStyle = 'rgba(150,105,55,.35)'; g.lineWidth = 7; g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1] + 3) : g.moveTo(p[0], p[1] + 3))); g.stroke();
      g.strokeStyle = 'rgba(255,238,200,.55)'; g.lineWidth = 1.6; g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke();
    }
    // 干涸河床
    const rv = (gy) => W * 0.3 + 90 * Math.sin(gy * 0.0024) + 30 * Math.sin(gy * 0.009);
    const rp = []; for (let gy = gy0; gy <= gy1; gy += 8) rp.push([rv(gy), Y(gy)]);
    const sl = (col, lw) => { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); rp.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke(); };
    sl('rgba(140,95,50,.4)', 44); sl('rgba(196,160,104,.9)', 32); sl('rgba(170,130,80,.5)', 6);
    // 岩石台地
    for (let cy = Math.floor(gy0 / 120); cy <= gy1 / 120; cy++) for (let cx = 0; cx < W / 120 + 1; cx++) {
      if (hash(cx, cy, 13) < 0.72) continue;
      const x = cx * 120 + hash(cx, cy, 14) * 90, y = Y(cy * 120 + hash(cx, cy, 15) * 100), r = 16 + hash(cx, cy, 16) * 26;
      const pts = []; for (let i = 0; i < 9; i++) { const a = (i * TAU) / 9, rr = r * (0.7 + hash(cx * 9 + i, cy, 17) * 0.4); pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.8]); }
      g.fillStyle = 'rgba(80,50,20,.35)'; g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0] + 6, p[1] + 7) : g.moveTo(p[0] + 6, p[1] + 7))); g.closePath(); g.fill();
      const gr = g.createLinearGradient(x - r, y - r, x + r, y + r); gr.addColorStop(0, '#c98a4e'); gr.addColorStop(1, '#6e4222');
      g.fillStyle = gr; g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(60,35,15,.6)'; g.lineWidth = 1; g.stroke();
      g.fillStyle = 'rgba(255,220,170,.25)'; g.beginPath(); g.ellipse(x - r * 0.2, y - r * 0.2, r * 0.45, r * 0.3, 0, 0, TAU); g.fill();
    }
    // 军事基地：停机坪、油罐、跑道
    const rx = (gy) => W * 0.7 + 30 * Math.sin(gy * 0.004);
    const rpts = []; for (let gy = gy0; gy <= gy1; gy += 8) rpts.push([rx(gy), Y(gy)]);
    road(g, rpts, 10);
    for (let cy = Math.floor(gy0 / 300); cy <= gy1 / 300; cy++) {
      if (hash(cy, 1, 21) < 0.4) continue;
      const x = rx(cy * 300) + (hash(cy, 2, 21) > 0.5 ? 40 : -110), y = Y(cy * 300);
      g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x + 4, y + 4, 70, 70);
      g.fillStyle = '#a9a292'; g.fillRect(x, y, 70, 70);
      g.strokeStyle = '#e8e2d0'; g.lineWidth = 2; g.strokeRect(x + 6, y + 6, 58, 58);
      g.fillStyle = '#e8e2d0'; g.font = 'bold 30px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('H', x + 35, y + 37);
      for (let i = 0; i < 3; i++) {
        const tx = x + (hash(cy, 2, 21) > 0.5 ? 90 : -30) + 0, ty = y + 10 + i * 24;
        g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.arc(tx + 3, ty + 3, 10, 0, TAU); g.fill();
        const gr = g.createRadialGradient(tx - 3, ty - 3, 1, tx, ty, 10); gr.addColorStop(0, '#f4f0e6'); gr.addColorStop(1, '#8a8474');
        g.fillStyle = gr; g.beginPath(); g.arc(tx, ty, 10, 0, TAU); g.fill();
      }
    }
  },

  ice(g, W, k, Y) {
    const gy0 = k * CH - 30, gy1 = (k + 1) * CH + 30;
    // 雪原
    const sg = g.createLinearGradient(0, 0, W, 0); sg.addColorStop(0, '#dde8f2'); sg.addColorStop(0.5, '#eef4fa'); sg.addColorStop(1, '#d4e2ee');
    g.fillStyle = sg; g.fillRect(0, 0, W, CH);
    for (let i = 0; i < 40; i++) {
      const gy = k * CH + hash(i, k, 31) * CH, x = hash(i, k, 32) * W;
      g.fillStyle = 'rgba(150,180,210,.18)'; g.beginPath(); g.ellipse(x, Y(gy), 30 + hash(i, k, 33) * 40, 6 + hash(i, k, 34) * 8, 0.2, 0, TAU); g.fill();
    }
    // 峡湾水道
    const cx = (gy) => fjord(W, gy)[0];
    const hw = (gy) => fjord(W, gy)[1];
    const L = [], R = [];
    for (let gy = gy0; gy <= gy1; gy += 6) { const n = 8 * Math.sin(gy * 0.05) + 5 * Math.sin(gy * 0.13); L.push([cx(gy) - hw(gy) + n, Y(gy)]); R.push([cx(gy) + hw(gy) - n, Y(gy)]); }
    // 崖壁阴影
    const edge = (pts, dx, col, lw) => { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0] + dx, p[1]) : g.moveTo(p[0] + dx, p[1]))); g.stroke(); };
    edge(L, -6, '#6a7c8e', 18); edge(R, 6, '#6a7c8e', 18);
    edge(L, -12, '#98aabb', 8); edge(R, 12, '#98aabb', 8);
    g.beginPath(); L.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); for (let i = R.length - 1; i >= 0; i--) g.lineTo(R[i][0], R[i][1]); g.closePath();
    const wg = g.createLinearGradient(0, 0, W, 0); wg.addColorStop(0, '#0f2e48'); wg.addColorStop(0.5, '#1a4868'); wg.addColorStop(1, '#0f2e48');
    g.fillStyle = wg; g.fill();
    g.save(); g.clip();
    drawWaves(g, W, k, Y, 0, W, 41, '#a8d8f0');
    // 浮冰
    for (let cy = Math.floor(gy0 / 70); cy <= gy1 / 70; cy++) for (let c = 0; c < 4; c++) {
      if (hash(c, cy, 43) < 0.55) continue;
      const gy = cy * 70 + hash(c, cy, 44) * 70, x = cx(gy) + (hash(c, cy, 45) - 0.5) * hw(gy) * 1.8, r = 8 + hash(c, cy, 46) * 20;
      const pts = []; for (let i = 0; i < 7; i++) { const a = (i * TAU) / 7, rr = r * (0.6 + hash(c * 7 + i, cy, 47) * 0.5); pts.push([x + Math.cos(a) * rr, Y(gy) + Math.sin(a) * rr * 0.7]); }
      g.fillStyle = 'rgba(0,20,40,.35)'; g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0] + 3, p[1] + 4) : g.moveTo(p[0] + 3, p[1] + 4))); g.closePath(); g.fill();
      g.fillStyle = '#dcebf6'; g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.fill();
      g.strokeStyle = '#8fb4d0'; g.lineWidth = 1; g.stroke();
    }
    g.restore();
    // 针叶林
    for (let cy = Math.floor(gy0 / 40); cy <= gy1 / 40; cy++) for (let c = 0; c < 14; c++) {
      if (hash(c, cy, 51) < 0.6) continue;
      const gy = cy * 40 + hash(c, cy, 52) * 40, x = hash(c, cy, 53) * W;
      if (Math.abs(x - cx(gy)) < hw(gy) + 24) continue;
      const y = Y(gy), s = 5 + hash(c, cy, 54) * 5;
      g.fillStyle = 'rgba(40,60,90,.3)'; g.beginPath(); g.moveTo(x + 4, y - s + 4); g.lineTo(x + s + 4, y + s + 4); g.lineTo(x - s + 4, y + s + 4); g.fill();
      g.fillStyle = '#1e4a3a'; g.beginPath(); g.moveTo(x, y - s * 1.3); g.lineTo(x + s, y + s); g.lineTo(x - s, y + s); g.fill();
      g.fillStyle = '#f4f8fc'; g.beginPath(); g.moveTo(x, y - s * 1.3); g.lineTo(x + s * 0.45, y - s * 0.2); g.lineTo(x - s * 0.45, y - s * 0.2); g.fill();
    }
  },

  sky(g, W, k, Y) {
    const gy0 = k * CH - 140, gy1 = (k + 1) * CH + 140;
    const bg = g.createLinearGradient(0, 0, W, 0); bg.addColorStop(0, '#1f2a5c'); bg.addColorStop(0.5, '#34427e'); bg.addColorStop(1, '#1f2a5c');
    g.fillStyle = bg; g.fillRect(0, 0, W, CH);
    // 远层薄云
    for (let cy = Math.floor(gy0 / 90); cy <= gy1 / 90; cy++) for (let cx = -1; cx < W / 90 + 1; cx++) {
      if (hash(cx, cy, 61) > 0.7) continue;
      const x = cx * 90 + hash(cx, cy, 62) * 90, y = Y(cy * 90 + hash(cx, cy, 63) * 90), r = 70 + hash(cx, cy, 64) * 50;
      const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(150,140,210,.35)'); gr.addColorStop(1, 'rgba(150,140,210,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    }
    // 积云团：先画阴影，再画受光面
    for (let cy = Math.floor(gy0 / 130); cy <= gy1 / 130; cy++) for (let cx = -1; cx < W / 130 + 1; cx++) {
      if (hash(cx, cy, 65) > 0.62) continue;
      const ox = cx * 130 + hash(cx, cy, 66) * 130, oy = cy * 130 + hash(cx, cy, 67) * 130;
      const n = 5 + ((hash(cx, cy, 68) * 5) | 0);
      const puffs = [];
      for (let i = 0; i < n; i++) puffs.push([ox + (hash(cx * 13 + i, cy, 69) - 0.5) * 110, Y(oy + (hash(cx * 13 + i, cy, 70) - 0.5) * 70), 22 + hash(cx * 13 + i, cy, 71) * 26]);
      for (const [x, y, r] of puffs) {
        const gr = g.createRadialGradient(x + 10, y + 14, 0, x + 10, y + 14, r * 1.15); gr.addColorStop(0, 'rgba(25,25,70,.45)'); gr.addColorStop(1, 'rgba(25,25,70,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(x + 10, y + 14, r * 1.15, 0, TAU); g.fill();
      }
      for (const [x, y, r] of puffs) {
        const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.05, x, y, r);
        gr.addColorStop(0, 'rgba(255,246,238,1)'); gr.addColorStop(0.45, 'rgba(246,214,222,.97)'); gr.addColorStop(0.8, 'rgba(176,160,212,.85)'); gr.addColorStop(1, 'rgba(150,140,210,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
      }
    }
  },

  space(g, W, k, Y) {
    const gy0 = k * CH - 40, gy1 = (k + 1) * CH + 40;
    g.fillStyle = '#05060f'; g.fillRect(0, 0, W, CH);
    for (let i = 0; i < 3; i++) {
      const gy = k * CH + hash(i, k, 90) * CH, x = hash(i, k, 91) * W, r = 80 + hash(i, k, 92) * 120;
      const gr = g.createRadialGradient(x, Y(gy), 0, x, Y(gy), r);
      const col = ['rgba(120,40,160,.16)', 'rgba(30,110,160,.14)', 'rgba(160,40,90,.12)'][i];
      gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, CH);
    }
    for (let i = 0; i < 90; i++) {
      const x = hash(i, k, 93) * W, y = hash(i, k, 94) * CH, b = hash(i, k, 95);
      g.fillStyle = `rgba(${200 + b * 55},${210 + b * 45},255,${0.3 + b * 0.7})`; g.fillRect(x, y, b > 0.9 ? 2 : 1, b > 0.9 ? 2 : 1);
    }
    // 敌方母舰舰体
    const hx0 = (gy) => 40 + 30 * Math.sin(gy * 0.0027) + (gy < 700 ? (700 - gy) * 0.5 : 0);
    const hx1 = (gy) => W - 40 - 30 * Math.sin(gy * 0.0021 + 1) - (gy < 700 ? (700 - gy) * 0.5 : 0);
    const L = [], R = [];
    for (let gy = gy0; gy <= gy1; gy += 8) { const q = Math.round(gy / 48) * 48; L.push([hx0(q), Y(gy)]); R.push([hx1(q), Y(gy)]); }
    if (L.every((p, i) => p[0] < R[i][0] - 10)) {
      g.beginPath(); L.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); for (let i = R.length - 1; i >= 0; i--) g.lineTo(R[i][0], R[i][1]); g.closePath();
      g.fillStyle = '#2a2f3e'; g.fill();
      g.save(); g.clip();
      const cs = 48;
      for (let cy = Math.floor(gy0 / cs); cy <= gy1 / cs; cy++) for (let cx = 0; cx < W / cs + 1; cx++) {
        const h = hash(cx, cy, 97), x = cx * cs, y = Y((cy + 1) * cs);
        const tone = 40 + h * 40;
        const gr = g.createLinearGradient(x, y, x + cs, y + cs);
        gr.addColorStop(0, `rgb(${tone + 30},${tone + 34},${tone + 50})`); gr.addColorStop(1, `rgb(${tone - 10},${tone - 8},${tone + 4})`);
        g.fillStyle = gr; g.fillRect(x + 1, y + 1, cs - 2, cs - 2);
        g.fillStyle = 'rgba(0,0,0,.4)';
        for (const [px, py] of [[4, 4], [cs - 5, 4], [4, cs - 5], [cs - 5, cs - 5]]) { g.beginPath(); g.arc(x + px, y + py, 1, 0, TAU); g.fill(); }
        if (h > 0.8) { g.fillStyle = '#10131c'; for (let i = 0; i < 5; i++) g.fillRect(x + 8, y + 8 + i * 7, cs - 16, 3); }
        else if (h < 0.12) { const gl = g.createRadialGradient(x + cs / 2, y + cs / 2, 0, x + cs / 2, y + cs / 2, 10); gl.addColorStop(0, '#fff'); gl.addColorStop(0.3, '#6ff7ff'); gl.addColorStop(1, 'rgba(0,120,255,0)'); g.fillStyle = gl; g.fillRect(x, y, cs, cs); }
        else if (h > 0.62 && h < 0.7) { g.fillStyle = '#181b26'; g.beginPath(); g.arc(x + cs / 2, y + cs / 2, 14, 0, TAU); g.fill(); g.strokeStyle = '#5a6078'; g.lineWidth = 2; g.stroke(); }
      }
      // 发光沟槽
      for (const fx of [0.33, 0.67]) {
        const pts = []; for (let gy = gy0; gy <= gy1; gy += 8) pts.push([lerpX(hx0(gy), hx1(gy), fx), Y(gy)]);
        g.strokeStyle = '#0b0d14'; g.lineWidth = 12; g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke();
        g.strokeStyle = 'rgba(80,220,255,.8)'; g.lineWidth = 2; g.stroke();
      }
      g.restore();
      const edgeS = (pts, col, lw) => { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke(); };
      edgeS(L, '#9aa4c0', 3); edgeS(R, '#4a5068', 3);
      for (let cy = Math.floor(gy0 / 96); cy <= gy1 / 96; cy++) {
        const gy = cy * 96; for (const side of [0, 1]) {
          const x = side ? hx1(Math.round(gy / 48) * 48) : hx0(Math.round(gy / 48) * 48);
          const gl = g.createRadialGradient(x, Y(gy), 0, x, Y(gy), 7); gl.addColorStop(0, '#fff'); gl.addColorStop(0.35, '#ff4a6a'); gl.addColorStop(1, 'rgba(255,0,60,0)');
          g.fillStyle = gl; g.beginPath(); g.arc(x, Y(gy), 7, 0, TAU); g.fill();
        }
      }
    }
  },
};
export function fjord(W, gy) {
  return [W * 0.5 + 70 * Math.sin(gy * 0.0019) + 20 * Math.sin(gy * 0.007), 150 + 40 * Math.sin(gy * 0.0013 + 1) + Math.min(60, gy * 0.01)];
}
function lerpX(a, b, t) { return a + (b - a) * t; }

