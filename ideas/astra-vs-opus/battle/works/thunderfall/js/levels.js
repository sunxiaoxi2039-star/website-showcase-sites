// 五个关卡的出怪时间轴（每关约 100 秒道中 + BOSS 战，全程约 11~12 分钟）
import { fighter, heli, tank, bunker, boat, bomber, gunship, saucer, carrier, rock, cruiser, turtle, P } from './enemies.js';
import { coastX, fjord } from './bg.js';
import { rand, pick } from './util.js';

const PI = Math.PI;

// ---------- 编队 ----------
function vForm(G, fx, n = 5, o = {}) {
  const x = G.W * fx;
  for (let i = 0; i < n; i++) {
    const k = i - (n - 1) / 2;
    fighter(G, { path: P.dive(x + k * 36, o.spd || 210, o.sway || 0), delay: Math.abs(k) * 0.2, fire: i % 2 ? 'none' : o.fire || 'aim', spr: o.spr, hp: o.hp });
  }
}
function snake(G, fx, n = 6, o = {}) {
  for (let i = 0; i < n; i++) fighter(G, { path: P.dive(G.W * fx, o.spd || 190, o.amp || 80, 2.4), delay: i * 0.28, fire: i % 3 === 1 ? o.fire || 'aim' : 'none', spr: o.spr, hp: o.hp });
}
function sweep(G, side, fy, n = 6, o = {}) {
  const L = side === 'L';
  const path = turtle(L ? -30 : G.W + 30, G.H * fy, L ? 0.15 : PI - 0.15, [['s', G.W * 0.35], ['a', 90, L ? PI * 0.85 : -PI * 0.85], ['s', 900]], o.spd || 240);
  for (let i = 0; i < n; i++) fighter(G, { path, delay: i * 0.22, fire: i % 2 ? 'aim' : 'none', spr: o.spr || 'zako2', hp: o.hp });
}
function uturn(G, fx, n = 5, o = {}) {
  const x = G.W * fx;
  const path = turtle(x, -30, PI / 2, [['s', 240 + (o.depth || 0)], ['a', 55, fx < 0.5 ? -PI : PI], ['s', 1200]], o.spd || 230);
  for (let i = 0; i < n; i++) fighter(G, { path, delay: i * 0.24, fire: i === 2 ? 'fan' : 'none', spr: o.spr || 'zako2', hp: o.hp });
}
function loop(G, fx, n = 5, o = {}) {
  const x = G.W * fx;
  const path = turtle(x, -30, PI / 2, [['s', 200], ['a', 60, fx < 0.5 ? -PI * 2 : PI * 2], ['s', 1400]], o.spd || 240);
  for (let i = 0; i < n; i++) fighter(G, { path, delay: i * 0.2, fire: i % 2 ? 'aim' : 'none', spr: o.spr, hp: o.hp });
}
function cross(G, n = 5, o = {}) {
  for (let i = 0; i < n; i++) {
    fighter(G, { path: P.line(-30, 60, G.W + 40, G.H * 0.75, 260), delay: i * 0.25, fire: i === 2 ? 'aim' : 'none', spr: o.spr });
    fighter(G, { path: P.line(G.W + 30, 60, -40, G.H * 0.75, 260), delay: i * 0.25 + 0.12, fire: i === 2 ? 'aim' : 'none', spr: o.spr || 'zako2' });
  }
}
function wall(G, n = 7, o = {}) {
  for (let i = 0; i < n; i++) fighter(G, { path: P.dive(G.W * (0.1 + (0.8 * i) / (n - 1)), o.spd || 150, 18, 3), delay: (i % 2) * 0.3, fire: i % 2 ? 'wave' : 'aim', spr: o.spr || 'zako2', hp: (o.hp || 3) + 2 });
}
function helis(G, xs, o = {}) { xs.forEach((fx, i) => heli(G, { x: G.W * fx, delay: i * (o.gap ?? 0.6), ty: o.ty, pattern: o.pattern, hold: o.hold })); }

const spawnGy = (G) => G.bg.scroll + G.H + 30;
function landTanks(G, n = 3, vx = 0) {
  const gy = spawnGy(G), c = coastX(G.W, gy);
  for (let i = 0; i < n; i++) tank(G, { x: Math.min(G.W - 18, c + 30 + rand(0, Math.max(10, G.W - c - 60))), vx, vy: rand(-8, 14), delay: i * 0.9 });
}
function landBunkers(G, n = 2) {
  const gy = spawnGy(G), c = coastX(G.W, gy);
  for (let i = 0; i < n; i++) bunker(G, { x: Math.min(G.W - 26, c + 40 + ((G.W - c - 70) * (i + 0.5)) / n), delay: i * 0.3 });
}
function seaBoats(G, n = 2) {
  const gy = spawnGy(G), c = coastX(G.W, gy);
  for (let i = 0; i < n; i++) boat(G, { x: Math.max(30, Math.min(c - 40, 40 + rand(0, c - 80))), delay: i * 1.2 });
}
function fjordBoats(G, n = 2) {
  const [cx, hw] = fjord(G.W, spawnGy(G));
  for (let i = 0; i < n; i++) boat(G, { x: cx + (i - (n - 1) / 2) * Math.min(90, hw * 0.7), delay: i * 0.8 });
}
function shoreBunkers(G, skin = 'bunkerS') {
  const [cx, hw] = fjord(G.W, spawnGy(G));
  const l = cx - hw - 34, r = cx + hw + 34;
  if (l > 24) bunker(G, { x: l, skin, pattern: 'fan' });
  if (r < G.W - 24) bunker(G, { x: r, skin, pattern: 'fan', delay: 0.4 });
}
function tankColumn(G, fx, n = 4, skin = 'tankD', vy = 20) {
  for (let i = 0; i < n; i++) tank(G, { x: G.W * fx, skin, vy, delay: i * 1.3 });
}
function tankCross(G, side, fy = 0.15, n = 3, skin = 'tankD') {
  const L = side === 'L';
  for (let i = 0; i < n; i++) { const t = tank(G, { x: L ? -20 : G.W + 20, y: G.H * fy, vx: L ? 45 : -45, vy: -G.scrollSpeed, skin, delay: i * 1.1 }); t.vy = -G.scrollSpeed + 6; }
}
function baseBunkers(G, xs, skin = 'bunker', pattern = 'fan') { xs.forEach((fx, i) => bunker(G, { x: G.W * fx, skin, pattern: Array.isArray(pattern) ? pattern[i] : pattern, delay: i * 0.2 })); }
function rocks(G, n = 5, gap = 0.6) { for (let i = 0; i < n; i++) rock(G, { delay: i * gap }); }

export const LEVELS = [
  {
    name: '海岸防线', en: 'COASTAL FRONT', theme: 'coast', music: 's1', bossAt: 100,
    events: [
      [3.5, (G) => vForm(G, 0.5, 5)],
      [7, (G) => snake(G, 0.25, 6)],
      [10, (G) => snake(G, 0.72, 6)],
      [13.5, (G) => helis(G, [0.3, 0.7])],
      [16.5, (G) => sweep(G, 'L', 0.12, 6)],
      [19, (G) => seaBoats(G, 2)],
      [21, (G) => { vForm(G, 0.35, 5); carrier(G, { side: 'L', y: 200 }); }],
      [25, (G) => helis(G, [0.2, 0.5, 0.8], { gap: 0.4 })],
      [28.5, (G) => sweep(G, 'R', 0.1, 6)],
      [31, (G) => { landTanks(G, 3); seaBoats(G, 1); }],
      [34, (G) => { uturn(G, 0.25, 5); uturn(G, 0.75, 5); }],
      [38.5, (G) => bomber(G, { x: G.W * 0.5 })],
      [44, (G) => { snake(G, 0.2, 5); snake(G, 0.8, 5); }],
      [47, (G) => { landBunkers(G, 2); landTanks(G, 2); }],
      [51, (G) => helis(G, [0.15, 0.4, 0.65, 0.9], { gap: 0.5 })],
      [55, (G) => { carrier(G, { side: 'R', y: 160 }); cross(G, 4); }],
      [59, (G) => { loop(G, 0.3, 5); }],
      [61, (G) => gunship(G, { x: G.W * 0.5, straight: true })],
      [66, (G) => { vForm(G, 0.25, 5); vForm(G, 0.75, 5); landTanks(G, 3); }],
      [70, (G) => { landBunkers(G, 3); seaBoats(G, 2); }],
      [74, (G) => { saucer(G, { x: G.W * 0.3 }); saucer(G, { x: G.W * 0.7, delay: 0.8 }); }],
      [79, (G) => { bomber(G, { x: G.W * 0.3, ty: 170 }); bomber(G, { x: G.W * 0.72, ty: 230, delay: 1.5 }); }],
      [86, (G) => { sweep(G, 'L', 0.1, 6); sweep(G, 'R', 0.22, 6); }],
      [90, (G) => { helis(G, [0.25, 0.75]); landTanks(G, 3); }],
      [94, (G) => { gunship(G, { x: G.W * 0.25 }); gunship(G, { x: G.W * 0.75, delay: 1.5 }); }],
      [100, 'boss'],
    ],
  },
  {
    name: '沙漠风暴', en: 'DESERT STORM', theme: 'desert', music: 's2', bossAt: 102,
    events: [
      [3.5, (G) => { tankColumn(G, 0.68, 3); vForm(G, 0.3, 5, { spr: 'zako2' }); }],
      [7, (G) => cross(G, 5)],
      [10, (G) => { baseBunkers(G, [0.2, 0.45]); helis(G, [0.8]); }],
      [13, (G) => sweep(G, 'R', 0.1, 7)],
      [16, (G) => { tankCross(G, 'L', 0.2, 3); gunship(G, { x: G.W * 0.6 }); }],
      [21, (G) => { carrier(G, { side: 'R', y: 170 }); snake(G, 0.3, 6); }],
      [25, (G) => { uturn(G, 0.2, 5); uturn(G, 0.8, 5); tankColumn(G, 0.68, 4); }],
      [30, (G) => { saucer(G, { x: G.W * 0.5 }); helis(G, [0.2, 0.8], { pattern: 'wave' }); }],
      [34, (G) => { baseBunkers(G, [0.15, 0.4, 0.85], 'bunker', ['fan', 'spin', 'fan']); }],
      [38, (G) => { wall(G, 7); }],
      [42, (G) => { bomber(G, { x: G.W * 0.5 }); tankCross(G, 'R', 0.3, 3); }],
      [48, (G) => { G.midWarn(); }],
      [50, (G) => cruiser(G, { life: 30 })],
      [60, (G) => { snake(G, 0.15, 5); }],
      [70, (G) => { loop(G, 0.7, 6, { spr: 'zako2' }); }],
      [80, (G) => { carrier(G, { side: 'L', y: 220 }); helis(G, [0.3, 0.6, 0.9], { gap: 0.4 }); }],
      [84, (G) => { gunship(G, { x: G.W * 0.3, sweep: true }); gunship(G, { x: G.W * 0.7, sweep: true, delay: 1 }); tankColumn(G, 0.68, 3); }],
      [90, (G) => { cross(G, 5); baseBunkers(G, [0.3, 0.55]); }],
      [95, (G) => { vForm(G, 0.5, 7, { spr: 'zako2', fire: 'fan' }); saucer(G, { x: G.W * 0.25 }); saucer(G, { x: G.W * 0.75 }); }],
      [102, 'boss'],
    ],
  },
  {
    name: '冰封海峡', en: 'FROZEN STRAIT', theme: 'ice', music: 's3', bossAt: 104,
    events: [
      [3.5, (G) => { fjordBoats(G, 2); snake(G, 0.5, 6, { spr: 'zako2' }); }],
      [7.5, (G) => { shoreBunkers(G); sweep(G, 'L', 0.1, 6); }],
      [11, (G) => { helis(G, [0.25, 0.5, 0.75], { pattern: 'wave' }); }],
      [15, (G) => { fjordBoats(G, 3); cross(G, 4); }],
      [19, (G) => { saucer(G, { x: G.W * 0.3 }); saucer(G, { x: G.W * 0.7, delay: 1 }); shoreBunkers(G); }],
      [23, (G) => { carrier(G, { side: 'L', y: 180 }); uturn(G, 0.75, 5); }],
      [27, (G) => { bomber(G, { x: G.W * 0.35 }); vForm(G, 0.75, 5, { spr: 'zako2' }); }],
      [33, (G) => { gunship(G, { x: G.W * 0.5, sweep: true }); fjordBoats(G, 2); }],
      [38, (G) => { wall(G, 7); shoreBunkers(G); }],
      [43, (G) => { loop(G, 0.25, 6); loop(G, 0.75, 6); }],
      [49, (G) => { G.midWarn(); }],
      [51, (G) => cruiser(G, { life: 32 })],
      [58, (G) => { fjordBoats(G, 2); }],
      [66, (G) => { helis(G, [0.2, 0.8]); }],
      [76, (G) => { carrier(G, { side: 'R', y: 150 }); snake(G, 0.3, 6, { spr: 'zako2' }); snake(G, 0.7, 6); }],
      [81, (G) => { saucer(G, { x: G.W * 0.2 }); saucer(G, { x: G.W * 0.5, delay: 0.6 }); saucer(G, { x: G.W * 0.8, delay: 1.2 }); }],
      [86, (G) => { bomber(G, { x: G.W * 0.28, ty: 160 }); bomber(G, { x: G.W * 0.72, ty: 240, delay: 1 }); fjordBoats(G, 2); }],
      [93, (G) => { gunship(G, { x: G.W * 0.2 }); gunship(G, { x: G.W * 0.8, delay: 0.7 }); sweep(G, 'L', 0.12, 6); }],
      [98, (G) => { cross(G, 5); shoreBunkers(G); }],
      [104, 'boss'],
    ],
  },
  {
    name: '天穹之上', en: 'ABOVE THE CLOUDS', theme: 'sky', music: 's4', bossAt: 104,
    events: [
      [3.5, (G) => { sweep(G, 'L', 0.1, 7); sweep(G, 'R', 0.2, 7); }],
      [8, (G) => { wall(G, 8); }],
      [12, (G) => { gunship(G, { x: G.W * 0.3 }); gunship(G, { x: G.W * 0.7, delay: 0.8 }); }],
      [17, (G) => { carrier(G, { side: 'R', y: 180 }); loop(G, 0.3, 6, { spr: 'zako2' }); }],
      [21, (G) => { saucer(G, { x: G.W * 0.25 }); saucer(G, { x: G.W * 0.75, delay: 0.5 }); cross(G, 5); }],
      [26, (G) => { bomber(G, { x: G.W * 0.5, ty: 200 }); snake(G, 0.15, 6); snake(G, 0.85, 6); }],
      [32, (G) => { uturn(G, 0.2, 6); uturn(G, 0.8, 6); helis(G, [0.5]); }],
      [36, (G) => { gunship(G, { x: G.W * 0.5, sweep: true, cycles: 3 }); vForm(G, 0.25, 5); vForm(G, 0.75, 5); }],
      [42, (G) => { bomber(G, { x: G.W * 0.25, ty: 160 }); bomber(G, { x: G.W * 0.75, ty: 220 }); }],
      [48, (G) => { G.midWarn(); }],
      [50, (G) => cruiser(G, { life: 30 })],
      [58, (G) => { sweep(G, 'L', 0.15, 6); }],
      [68, (G) => { sweep(G, 'R', 0.15, 6); }],
      [80, (G) => { carrier(G, { side: 'L', y: 200 }); wall(G, 8); }],
      [85, (G) => { saucer(G, { x: G.W * 0.2 }); saucer(G, { x: G.W * 0.5, delay: 0.5 }); saucer(G, { x: G.W * 0.8, delay: 1 }); gunship(G, { x: G.W * 0.5, delay: 1 }); }],
      [91, (G) => { loop(G, 0.25, 6); loop(G, 0.75, 6, { spr: 'zako2' }); }],
      [95, (G) => { bomber(G, { x: G.W * 0.5, ty: 180 }); cross(G, 5); }],
      [104, 'boss'],
    ],
  },
  {
    name: '星际要塞', en: 'STAR FORTRESS', theme: 'space', music: 's5', bossAt: 106,
    events: [
      [3.5, (G) => rocks(G, 6, 0.5)],
      [7, (G) => { sweep(G, 'L', 0.1, 7, { spr: 'zako2' }); sweep(G, 'R', 0.18, 7, { spr: 'zako2' }); }],
      [11, (G) => { saucer(G, { x: G.W * 0.3 }); saucer(G, { x: G.W * 0.7 }); rocks(G, 4, 0.8); }],
      [16, (G) => { gunship(G, { x: G.W * 0.25, sweep: true }); gunship(G, { x: G.W * 0.75, sweep: true, delay: 0.5 }); }],
      [21, (G) => { carrier(G, { side: 'L', y: 170 }); baseBunkers(G, [0.3, 0.7], 'bunkerM', 'spin'); }],
      [25, (G) => { wall(G, 8, { hp: 5 }); }],
      [29, (G) => { bomber(G, { x: G.W * 0.3, ty: 160 }); bomber(G, { x: G.W * 0.7, ty: 230, delay: 1 }); }],
      [35, (G) => { rocks(G, 8, 0.4); loop(G, 0.5, 6, { spr: 'zako2' }); }],
      [40, (G) => { baseBunkers(G, [0.2, 0.5, 0.8], 'bunkerM', ['fan', 'spin', 'fan']); cross(G, 5); }],
      [45, (G) => { G.midWarn(); }],
      [47, (G) => { cruiser(G, { life: 34 }); }],
      [56, (G) => { rocks(G, 4, 1); }],
      [66, (G) => { sweep(G, 'L', 0.15, 6, { spr: 'zako2' }); }],
      [76, (G) => { carrier(G, { side: 'R', y: 200 }); saucer(G, { x: G.W * 0.2 }); saucer(G, { x: G.W * 0.8 }); }],
      [80, (G) => { gunship(G, { x: G.W * 0.2 }); gunship(G, { x: G.W * 0.5, delay: 0.5, sweep: true }); gunship(G, { x: G.W * 0.8, delay: 1 }); }],
      [87, (G) => { rocks(G, 6, 0.4); uturn(G, 0.25, 6); uturn(G, 0.75, 6); }],
      [92, (G) => { baseBunkers(G, [0.25, 0.75], 'bunkerM', 'spin'); bomber(G, { x: G.W * 0.5 }); }],
      [98, (G) => { vForm(G, 0.5, 9, { spr: 'zako2', fire: 'fan' }); }],
      [106, 'boss'],
    ],
  },
];
export { pick };
