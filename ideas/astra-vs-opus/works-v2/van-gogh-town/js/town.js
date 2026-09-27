import * as THREE from 'three';
import { Builder, S, rng, hex } from './builder.js';
import { H, PATHS, WATER_Y } from './terrain.js';
import { PAINTINGS } from './data.js';

// ---------------------------------------------------------------- palettes
const P = {
  cobble: S('#8d88aa', '#6f86b8', '#c99a7a', { cell: 0.25, aspect: 1.35, jitter: 3.2, outline: 0.75, size: 0.8 }),
  cobbleWarm: S('#9a8aa6', '#7a8cc0', '#d4a07a', { cell: 0.24, aspect: 1.3, jitter: 3.2, outline: 0.8, size: 0.8 }),
  sand: S('#dcc088', '#cfae72', '#e6d09a', { cell: 0.3, aspect: 3.6, jitter: 0.4, flow: 0.35 }),
  terrace: S('#e0a03a', '#eeba4c', '#c0742c', { cell: 0.2, aspect: 2.6, jitter: 0.15 }),
  roof: S('#b8573a', '#cc6d44', '#8c4638', { cell: 0.2, aspect: 2.4, jitter: 0.1, outline: 0.35 }),
  roof2: S('#c4663e', '#d8844e', '#9a4d3a', { cell: 0.2, aspect: 2.4, jitter: 0.1, outline: 0.35 }),
  trim: S('#e8dcc0', '#d4c4a0', '#f2ead0', { cell: 0.18, aspect: 3, jitter: 0.1 }),
  glass: S('#27324e', '#384868', '#f3c448', { cell: 0.14, aspect: 2.2, jitter: 0.5, emissive: 1 }),
  glassDark: S('#27324e', '#384868', '#46587a', { cell: 0.14, aspect: 2.2, jitter: 0.5 }),
  shopLit: S('#f0a030', '#f7c050', '#f4ae3e', { cell: 0.16, aspect: 3, jitter: 0.5, emissive: 1 }),
  green: S('#3f7a4a', '#5c9a5a', '#2c5a3a', { cell: 0.12, aspect: 4, angle: 1.57, jitter: 0.08 }),
  blueSh: S('#3f5a9a', '#5a78b8', '#2f4478', { cell: 0.12, aspect: 4, angle: 1.57, jitter: 0.08 }),
  redSh: S('#8a4a3a', '#a85a44', '#6a3a30', { cell: 0.12, aspect: 4, angle: 1.57, jitter: 0.08 }),
  door: S('#4a6a3a', '#5c7e44', '#344e2c', { cell: 0.12, aspect: 5, angle: 1.57, jitter: 0.05 }),
  iron: S('#1f2a3a', '#2c3a50', '#3a4a60', { cell: 0.1, aspect: 4, angle: 1.57, jitter: 0.1 }),
  lantern: S('#f5c040', '#ffe070', '#fff0a0', { cell: 0.08, aspect: 2, jitter: 1, emissive: 1 }),
  stone: S('#c4b89e', '#aea288', '#d8ccb0', { cell: 0.3, aspect: 3.5, jitter: 0.3 }),
  wood: S('#8a5a3a', '#a06a44', '#6a4430', { cell: 0.1, aspect: 5, angle: 1.57, jitter: 0.08 }),
};
const WALLS = [
  ['#e3cf9a', '#d4b87a', '#efe0b0'], ['#d9a95a', '#c9914a', '#e8c27a'], ['#d9957a', '#c97f6a', '#e8b09a'],
  ['#a9b8c9', '#8fa2bb', '#c4cfd9'], ['#b8a3c0', '#a08fb0', '#cdbfd6'], ['#c9c09a', '#b3a883', '#ddd5b5'],
  ['#e0b870', '#cfa060', '#f0d090'], ['#c8a88a', '#b09070', '#dcc0a0'],
];
const wallStyle = (w) => S(w[0], w[1], w[2], { cell: 0.26, aspect: 4.2, jitter: 0.3 });
const SHUTTERS = [P.green, P.green, P.blueSh, P.blueSh, P.redSh];

// ---------------------------------------------------------------- world state
export function buildTown(material) {
  const b = new Builder();
  const segs = [];     // collision segments [x1,z1,x2,z2]
  const lamps = [];    // {p, c, r, halo}
  const people = [];
  const r = rng(7);

  const rect = (x0, z0, x1, z1) => { segs.push([x0, z0, x1, z0], [x1, z0, x1, z1], [x1, z1, x0, z1], [x0, z1, x0, z0]); };

  // place an element flat on a building face
  function onFace(f, o, u, y, w, h, depth, style) {
    // f: 's' (z=z1,+z) 'n' (z=z0,-z) 'e' (x=x1,+x) 'w' (x=x0,-x); u along face
    if (f === 's') b.box(u, y, o.z1 + depth / 2 - 0.01, w, h, depth, style);
    else if (f === 'n') b.box(u, y, o.z0 - depth / 2 + 0.01, w, h, depth, style);
    else if (f === 'e') b.box(o.x1 + depth / 2 - 0.01, y, u, depth, h, w, style);
    else b.box(o.x0 - depth / 2 + 0.01, y, u, depth, h, w, style);
  }

  function windowAt(f, o, u, y, opt) {
    const lit = r() < (opt.lit ?? 0.45);
    const sh = opt.shutter;
    const closed = r() < (opt.closed ?? 0.18);
    if (closed) { onFace(f, o, u, y, 0.98, 1.5, 0.1, sh); }
    else {
      onFace(f, o, u, y, 0.9, 1.45, 0.08, lit ? P.glass : P.glassDark);
      onFace(f, o, u - 0.72, y, 0.44, 1.5, 0.12, sh);
      onFace(f, o, u + 0.72, y, 0.44, 1.5, 0.12, sh);
    }
    onFace(f, o, u, y - 0.1, 1.15, 0.1, 0.2, P.trim);
  }

  function building(o) {
    const w = o.x1 - o.x0, d = o.z1 - o.z0, cx = (o.x0 + o.x1) / 2, cz = (o.z0 + o.z1) / 2;
    const wall = o.wall || wallStyle(WALLS[Math.floor(r() * WALLS.length)]);
    const h = o.h;
    if (!o.noShell) b.box(cx, -0.2, cz, w, h + 0.2, d, wall);
    b.box(cx, h - 0.3, cz, w + 0.25, 0.3, d + 0.25, P.trim);
    const roofS = r() < 0.5 ? P.roof : P.roof2;
    const rh = o.rh ?? (1.2 + r() * 0.8);
    if (o.roof === 'flat') {
      b.box(cx, h, cz, w, 0.6, d, wall);
    } else if (o.roof === 'z' || (o.roof !== 'x' && d > w)) {
      b.prism(cx, h, cz, d + 0.5, rh, w + 0.7, roofS, Math.PI / 2);
    } else {
      b.prism(cx, h, cz, w + 0.5, rh, d + 0.7, roofS);
    }
    if (r() < 0.7) b.box(o.x0 + w * (0.2 + r() * 0.6), h, o.z0 + d * (0.25 + r() * 0.5), 0.7, rh + 1.1, 0.7, wall);
    const floors = Math.max(1, Math.floor((h - 0.8) / 3.1));
    const sh = o.shutter || SHUTTERS[Math.floor(r() * SHUTTERS.length)];
    for (const f of (o.faces || '')) {
      const horiz = f === 's' || f === 'n';
      const a0 = horiz ? o.x0 : o.z0, a1 = horiz ? o.x1 : o.z1;
      const len = a1 - a0;
      const n = Math.max(1, Math.floor((len - 0.8) / 2.7));
      const sp = len / n;
      const doorCol = Math.floor(r() * n);
      for (let fl = 0; fl < floors; fl++) {
        for (let i = 0; i < n; i++) {
          const u = a0 + sp * (i + 0.5);
          if (fl === 0 && i === doorCol && !o.noDoor) {
            onFace(f, o, u, 0, 1.15, 2.35, 0.1, r() < 0.5 ? P.door : sh);
            onFace(f, o, u, 2.35, 1.35, 0.14, 0.16, P.trim);
            continue;
          }
          if (fl === 0 && o.shop && r() < 0.6) {
            onFace(f, o, u, 0.5, 1.8, 2.0, 0.08, r() < 0.6 ? P.shopLit : P.glassDark);
            continue;
          }
          windowAt(f, o, u, 1.0 + fl * 3.1, { shutter: sh, lit: o.lit });
        }
      }
    }
    if (!o.noCollide) rect(o.x0, o.z0, o.x1, o.z1);
  }

  // a row of lots along z between x0..x1, from zA to zB, skipping gaps
  function rowZ(x0, x1, zA, zB, gaps, faces, hMin, hMax, extra = {}) {
    let z = zA;
    while (z < zB - 3) {
      let w = 6 + r() * 6;
      if (z + w > zB) w = zB - z;
      const gap = gaps.find(([g0, g1]) => z + w > g0 && z < g1);
      if (gap) { if (z < gap[0] - 3) { w = gap[0] - z; } else { z = gap[1]; continue; } }
      if (w < 3) { z += w; continue; }
      building({ x0, x1, z0: z, z1: z + w, h: hMin + r() * (hMax - hMin), faces, ...extra });
      z += w;
    }
  }
  function rowX(z0, z1, xA, xB, gaps, faces, hMin, hMax, extra = {}) {
    let x = xA;
    while (x < xB - 3) {
      let w = 6 + r() * 6;
      if (x + w > xB) w = xB - x;
      const gap = gaps.find(([g0, g1]) => x + w > g0 && x < g1);
      if (gap) { if (x < gap[0] - 3) { w = gap[0] - x; } else { x = gap[1]; continue; } }
      if (w < 3) { x += w; continue; }
      building({ x0: x, x1: x + w, z0, z1, h: hMin + r() * (hMax - hMin), faces, ...extra });
      x += w;
    }
  }

  function lamp(x, z, h = 3.6, opt = {}) {
    const y = H(x, z);
    b.cyl(x, y, z, 0.07, h, P.iron);
    b.cyl(x, y, z, 0.16, 0.5, P.iron);
    b.box(x, y + h, z, 0.36, 0.5, 0.36, P.lantern);
    b.pyr(x, y + h + 0.5, z, 0.5, 0.3, 0.5, P.iron);
    lamps.push({ p: [x, y + h + 0.25, z], c: opt.c || [1.0, 0.72, 0.34], r: opt.r || 11, halo: opt.halo || 1.4, far: !!opt.far });
    if (!opt.far) segs.push([x - 0.15, z, x + 0.15, z]);
  }

  // ---------------------------------------------------------------- streets
  const street = (x0, z0, x1, z1, st = P.cobble) => b.box((x0 + x1) / 2, -0.06, (z0 + z1) / 2, x1 - x0, 0.08, z1 - z0, st);
  street(-5.2, -52, 5.8, 50);                 // main street (café street)
  street(-40, -51.5, 34, -42.5);               // north cross street
  street(-40, 42.5, 34, 50);                   // south cross street
  street(14.5, -42.5, 18.5, 42.5); street(-19, -42.5, -15, 42.5);
  street(-40, 16, 34, 21); street(-40, -26, 34, -22);
  street(-12, -60, 12, -51.5, P.cobbleWarm);   // church square
  street(29, -41, 78, 8, P.sand);              // Place Lamartine (sand)
  street(57, -95, 63.2, -41, P.cobbleWarm);    // street past the Yellow House, under the railway
  street(76, -100, 82, 70, P.cobbleWarm);      // Rhône promenade
  street(29, 8, 76, 12, P.cobble);
  street(34, -51.5, 57, -41, P.sand);

  // ---------------------------------------------------------------- the café (Place du Forum)
  const cafeWall = S('#e9b83c', '#f2cf5c', '#d98a2a', { cell: 0.24, aspect: 4.2, jitter: 0.3 });
  building({ x0: -15, x1: -5.2, z0: -6, z1: 12, h: 10.4, wall: cafeWall, faces: '', roof: 'z', noCollide: true });
  rect(-15, -6, -5.2, 12);
  const cafe = { x0: -15, x1: -5.2, z0: -6, z1: 12 };
  // upper windows on the café facade
  for (let fl = 1; fl < 3; fl++) for (let i = 0; i < 5; i++) {
    const z = -4.5 + i * 3.4;
    windowAt('e', cafe, z, 1.0 + fl * 3.1, { shutter: P.green, lit: 0.7 });
  }
  // lit ground floor: doors & windows glowing orange
  for (let i = 0; i < 6; i++) {
    const z = -3.8 + i * 2.6;
    onFace('e', cafe, z, 0.2, 1.7, 2.9, 0.08, P.shopLit);
    onFace('e', cafe, z + 1.3, 0, 0.35, 3.3, 0.14, S('#c9892a', '#b87624', '#e0a040', { cell: 0.08, aspect: 4, angle: 1.57, jitter: 0.1 }));
  }
  // awning: big yellow canopy sloping out over the terrace
  const awn = S('#f3c43a', '#eca42e', '#f6c848', { cell: 0.24, aspect: 4.2, jitter: 0.2, emissive: 0.8 });
  const slope = Math.atan2(1.05, 4.1);
  b.box(-3.2, 3.35, 3.5, 4.25, 0.07, 14.6, awn, 0, 0, -slope);
  b.box(-1.18, 2.35, 3.5, 0.07, 0.55, 14.6, awn);
  b.box(-3.2, 2.35, -3.75, 4.1, 0.55, 0.07, awn);
  b.box(-3.2, 2.35, 10.75, 4.1, 0.55, 0.07, awn);
  // terrace floor, tables, chairs
  b.box(-3.0, -0.02, 3.5, 4.4, 0.12, 14.4, P.terrace);
  const top = S('#f2e8b8', '#e8d890', '#fff6d0', { cell: 0.08, aspect: 2.5, jitter: 3 });
  const chairS = S('#c98a3a', '#b0702c', '#e0a050', { cell: 0.06, aspect: 3, jitter: 0.2 });
  for (const tx of [-3.9, -2.0]) for (const tz of [-1.8, 1.4, 4.6, 7.8]) {
    b.cyl(tx, 0.1, tz, 0.05, 0.65, P.iron);
    b.cyl(tx, 0.75, tz, 0.42, 0.05, top);
    for (const [dx, dz] of [[0.6, 0.2], [-0.55, -0.35], [0.1, 0.62]]) {
      if (r() < 0.25) continue;
      const cx = tx + dx, cz = tz + dz;
      b.box(cx, 0.45, cz, 0.42, 0.05, 0.42, chairS);
      for (const [lx, lz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) b.box(cx + lx, 0.08, cz + lz, 0.04, 0.4, 0.04, chairS);
      b.box(cx + (dx > 0 ? 0.2 : -0.2), 0.5, cz, 0.04, 0.5, 0.42, chairS);
    }
    segs.push([tx - 0.45, tz, tx + 0.45, tz]);
  }
  // the café lamp
  b.box(-4.9, 2.55, 4.4, 0.45, 0.6, 0.45, P.lantern);
  b.box(-5.05, 3.15, 4.4, 0.5, 0.06, 0.06, P.iron);
  lamps.push({ p: [-4.8, 2.85, 4.4], c: [2.4, 1.65, 0.6], r: 16, halo: 2.4 });
  lamps.push({ p: [-3.0, 2.2, -1.0], c: [0.9, 0.6, 0.22], r: 10, halo: 0 });
  lamps.push({ p: [-3.0, 2.2, 9.0], c: [0.9, 0.6, 0.22], r: 10, halo: 0 });
  // patrons
  people.push({ x: -3.4, z: -1.5, seated: 1, c: '#2c3560' }, { x: -2.5, z: 4.9, seated: 1, c: '#6a4a3a' }, { x: -4.3, z: 7.5, seated: 1, c: '#e8dcc0' },
    { x: -1.6, z: 1.9, seated: 1, c: '#34406a' }, { x: -0.6, z: 2.2, seated: 0, c: '#3a3a5a', apron: 1 }, { x: 2.8, z: -14, seated: 0, c: '#2a2a44' }, { x: 1.2, z: -17, seated: 0, c: '#5a3a5a' });

  // ---------------------------------------------------------------- town blocks
  const gapsZ = [[-26, -22], [16, 21]];
  rowZ(-15, -5.2, -42.5, -6, gapsZ, 'e', 7, 11, { shop: true });
  rowZ(-15, -5.2, 12, 42.5, gapsZ, 'e', 7, 11, { shop: true });
  rowZ(5.8, 14.5, -42.5, 42.5, gapsZ, 'w', 8, 12.5, { lit: 0.4 });
  rowZ(18.5, 29, -42.5, 42.5, gapsZ, 'ew', 7, 10.5);
  rowZ(-33, -19, -42.5, 42.5, gapsZ, 'ew', 6.5, 10);
  // north of the cross street
  rowX(-72, -51.5, -34, -12, [], 's', 7, 11);
  rowX(-72, -51.5, 12, 34, [], 's', 7, 11);
  // south of the cross street (edge of town)
  rowX(50, 58, -34, -8, [], 'n', 6, 8.5);
  rowX(50, 58, 8, 32, [], 'n', 6, 8.5);
  // south of the square
  rowX(12, 26, 31, 74, [[48, 53]], 'n', 6.5, 9.5, { shop: true });
  // east edge between square and promenade (north part)
  rowZ(64, 75, -100, -62, [[-84, -76]], 'w', 6, 9);

  // ---------------------------------------------------------------- church (the spire of the Starry Night)
  const stone = S('#b6ad9c', '#9fa0b0', '#cfc4aa', { cell: 0.34, aspect: 2.2, jitter: 0.25 });
  const slate = S('#34457a', '#2a3866', '#56689e', { cell: 0.22, aspect: 3.5, angle: 1.57, jitter: 0.12 });
  b.box(0, -0.2, -71, 12, 11.2, 20, stone);
  b.prism(0, 11, -71, 20.6, 4.5, 12.8, slate, Math.PI / 2);
  b.box(0, -0.2, -60.6, 4.6, 17.5, 4.6, stone);
  b.box(0, 17.2, -60.6, 5.0, 0.5, 5.0, P.trim);
  b.pyr(0, 17.7, -60.6, 4.4, 15, 4.4, slate);
  b.cyl(0, 32.5, -60.6, 0.06, 1.8, P.iron);
  onFace('s', { x0: -2.3, x1: 2.3, z0: -62.9, z1: -58.3 }, 0, 0, 1.6, 3.2, 0.12, P.door);
  onFace('s', { x0: -2.3, x1: 2.3, z0: -62.9, z1: -58.3 }, 0, 10, 0.9, 2.2, 0.1, P.glass);
  for (const zz of [-78, -73, -68, -64.5]) for (const f of ['e', 'w']) onFace(f, { x0: -6, x1: 6, z0: -81, z1: -61 }, zz, 3, 1.1, 4.2, 0.1, P.glass);
  rect(-6, -81, 6, -61); rect(-2.3, -62.9, 2.3, -58.3);

  // ---------------------------------------------------------------- Place Lamartine & the Yellow House
  const yellow = S('#f0c23a', '#f6d868', '#dd9f34', { cell: 0.26, aspect: 2.6, jitter: 0.5 });
  const pink = S('#dc907a', '#e6a88e', '#bb6f5e', { cell: 0.28, aspect: 2.6, jitter: 0.45 });
  // neighbours
  building({ x0: 33.5, x1: 45.5, z0: -54, z1: -43.2, h: 7.6, wall: pink, faces: 's', shutter: P.green, shop: true, roof: 'x' });
  b.box(39.5, 2.9, -42.3, 11, 0.07, 1.9, S('#e9e2c8', '#d8a0a0', '#f4f0dc', { cell: 0.14, aspect: 5, angle: 1.57, jitter: 0.05 }), 0, 0.42);
  building({ x0: 63.2, x1: 75, z0: -60, z1: -43.5, h: 6.4, wall: wallStyle(['#e8d49a', '#dcc080', '#f0e2b4']), faces: 'sw', shutter: P.blueSh, shop: true, roof: 'x' });
  // Yellow House shell (hollow: the bedroom is inside)
  const YH = { x0: 45.5, x1: 57, z0: -52, z1: -41.2 };
  const Hh = 8.6, T = 0.35;
  b.box(48.9, -0.2, -41.2 - T / 2, 6.8, Hh + 0.2, T, yellow);          // facade left of door
  b.box(55.25, -0.2, -41.2 - T / 2, 3.5, Hh + 0.2, T, yellow);          // facade right of door
  b.box(52.9, 2.4, -41.2 - T / 2, 1.2, Hh - 2.4, T, yellow);            // above door
  b.box(51.25, -0.2, -52 + T / 2, 11.5, Hh + 0.2, T, yellow);           // back
  b.box(45.5 + T / 2, -0.2, -46.6, T, Hh + 0.2, 10.8, yellow);          // west
  b.box(57 - T / 2, -0.2, -46.6, T, Hh + 0.2, 10.8, yellow);            // east
  b.box(51.25, 3.4, -46.6, 11.5, 0.3, 10.8, yellow);                     // floor slab
  b.box(51.25, Hh - 0.3, -46.6, 11.8, 0.3, 11.1, P.trim);
  b.prism(51.25, Hh, -46.6, 12.2, 1.5, 11.6, P.roof);
  b.box(47.5, Hh, -49, 0.7, 2.4, 0.7, yellow); b.box(55, Hh, -44, 0.7, 2.2, 0.7, yellow);
  // facade openings (green, as in the painting)
  const green = P.green;
  for (const x of [47.3, 50.0, 53.3, 55.8]) {
    onFace('s', YH, x, 4.6, 0.95, 1.6, 0.08, P.glassDark);
    onFace('s', YH, x - 0.75, 4.55, 0.5, 1.7, 0.12, green);
    onFace('s', YH, x + 0.75, 4.55, 0.5, 1.7, 0.12, green);
    onFace('s', YH, x, 4.45, 1.2, 0.1, 0.2, P.trim);
  }
  onFace('s', YH, 46.9, 0, 1.2, 2.45, 0.1, green);
  onFace('s', YH, 49.3, 0.9, 1.7, 1.7, 0.1, green);
  onFace('s', YH, 55.4, 0.9, 1.1, 1.6, 0.1, P.glassDark);
  onFace('s', YH, 55.4 - 0.7, 0.85, 0.45, 1.7, 0.12, green); onFace('s', YH, 55.4 + 0.7, 0.85, 0.45, 1.7, 0.12, green);
  onFace('s', YH, 52.9, 2.35, 1.5, 0.14, 0.18, green);
  for (const z of [-44, -48.8]) {
    onFace('e', YH, z, 4.6, 0.95, 1.6, 0.1, green);
    onFace('e', YH, z, 1.0, 0.95, 1.6, 0.1, green);
  }
  // Yellow House collisions: shell with a door gap
  segs.push([45.5, -41.2, 52.3, -41.2], [53.5, -41.2, 57, -41.2], [57, -41.2, 57, -52], [57, -52, 45.5, -52], [45.5, -52, 45.5, -41.2]);

  // ---------------------------------------------------------------- the bedroom (inside)
  const wallB = S('#a9b8e0', '#b2bfe4', '#a0afda', { cell: 0.2, aspect: 3.4, angle: 1.45, jitter: 0.45 });
  const floorB = S('#b07a5a', '#9c9058', '#c28a66', { cell: 0.14, aspect: 5, angle: 1.57, jitter: 0.06 });
  const bedWood = S('#e2a63a', '#f0c250', '#c98a2a', { cell: 0.08, aspect: 4, angle: 1.57, jitter: 0.1 });
  const cover = S('#d8402f', '#e8603a', '#b8302a', { cell: 0.1, aspect: 2.5, jitter: 1.2 });
  const pillow = S('#e8e890', '#f0f0b8', '#c8d880', { cell: 0.07, aspect: 2.2, jitter: 1.5 });
  const doorB = S('#6a8ac0', '#7c9ad0', '#5070a8', { cell: 0.1, aspect: 5, angle: 1.57, jitter: 0.06 });
  const winB = S('#6a9a5a', '#88b870', '#4a7a4a', { cell: 0.07, aspect: 4, angle: 1.57, jitter: 0.1 });
  const paneB = S('#a8d0a0', '#c8e0b0', '#88b088', { cell: 0.07, aspect: 2, jitter: 1 });
  const bx0 = 50.6, bz1 = -41.55, bz0 = -47.6;
  b.box(53.2, 0.0, -44.55, 5.6, 0.04, 6.2, floorB);
  b.box(50.52, 0, -44.55, 0.14, 3.4, 6.1, wallB);                        // west
  b.box(53.4, 0, bz0 - 0.07, 5.9, 3.4, 0.14, wallB);                     // back
  b.box(55.5, 0, -44.575, 0.14, 3.4, 6.2, wallB, 0.131);                 // slanted east wall
  b.box(51.45, 0, bz1 - 0.02, 1.7, 3.4, 0.04, wallB);                    // inner lining of facade
  b.box(54.7, 0, bz1 - 0.02, 2.4, 3.4, 0.04, wallB);
  b.box(52.9, 2.35, bz1 - 0.02, 1.2, 1.05, 0.04, wallB);
  b.box(53.2, 3.36, -44.55, 5.6, 0.04, 6.2, S('#d2d8ee', '#dcdff0', '#c4cce8', { cell: 0.24, aspect: 3, jitter: 0.6 }));
  // window in the back wall, half open
  b.box(52.0, 1.15, bz0 + 0.01, 1.3, 1.45, 0.06, paneB);
  b.box(52.0, 1.1, bz0 + 0.04, 1.4, 0.08, 0.1, winB); b.box(52.0, 2.6, bz0 + 0.04, 1.4, 0.08, 0.1, winB);
  b.box(51.33, 1.1, bz0 + 0.04, 0.08, 1.58, 0.1, winB); b.box(52.67, 1.1, bz0 + 0.04, 0.08, 1.58, 0.1, winB);
  b.box(52.0, 1.1, bz0 + 0.04, 0.05, 1.58, 0.1, winB); b.box(52.0, 1.85, bz0 + 0.04, 1.3, 0.05, 0.1, winB);
  b.box(51.1, 1.1, bz0 + 0.45, 0.62, 1.5, 0.05, paneB, 0.9);
  // the bed along the slanted east wall
  const bedRy = 0.131;
  const bedAt = (dx, y, dz, w, h, d, s) => {
    const cx = 54.28 + dx, cz = -46.35 + dz; b.box(cx + Math.sin(bedRy) * dz * 0.0, y, cz, w, h, d, s, bedRy);
  };
  bedAt(0, 0, -1.02, 1.5, 1.35, 0.12, bedWood);       // headboard
  bedAt(0.14, 0, 1.18, 1.5, 0.95, 0.12, bedWood);     // footboard
  bedAt(0.07, 0.25, 0.08, 1.5, 0.3, 2.1, bedWood);    // frame
  bedAt(0.07, 0.55, 0.12, 1.4, 0.22, 2.0, cover);     // red cover
  bedAt(-0.28, 0.75, -0.72, 0.62, 0.18, 0.45, pillow);
  bedAt(0.36, 0.75, -0.72, 0.62, 0.18, 0.45, pillow);
  bedAt(0.02, 0.76, -0.35, 1.36, 0.06, 0.4, S('#e0e8a8', '#f0f0c0', '#c8d090', { cell: 0.07, aspect: 2, jitter: 1 }));
  segs.push([53.4, -47.4, 53.6, -45.2], [53.6, -45.2, 55.2, -45.1]);
  // table by the window with jug and basin
  b.box(50.95, 0.72, -46.9, 0.62, 0.05, 0.8, bedWood);
  for (const [lx, lz] of [[-0.26, -0.35], [0.26, -0.35], [-0.26, 0.35], [0.26, 0.35]]) b.box(50.95 + lx, 0, -46.9 + lz, 0.05, 0.72, 0.05, bedWood);
  b.cyl(50.95, 0.77, -47.05, 0.18, 0.08, S('#7a9ad0', '#90b0e0', '#5a7ab8', { cell: 0.05, aspect: 2, jitter: 3 }));
  b.cyl(50.95, 0.77, -46.7, 0.07, 0.28, S('#5a7ab8', '#7a9ad0', '#3a5a98', { cell: 0.04, aspect: 2, jitter: 3 }));
  b.cyl(51.1, 0.77, -47.15, 0.035, 0.22, S('#6a9a5a', '#e0c050', '#8ab870', { cell: 0.04, aspect: 2, jitter: 3 }));
  segs.push([50.6, -46.4, 51.3, -46.4]);
  // two straw chairs
  const straw = S('#d8b050', '#c89838', '#e8c870', { cell: 0.05, aspect: 3, jitter: 1.5 });
  const chair = (x, z, ry) => {
    b.box(x, 0.46, z, 0.46, 0.06, 0.46, straw, ry);
    const c = Math.cos(ry), s = Math.sin(ry);
    for (const [lx, lz] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) b.box(x + lx * c + lz * s, 0, z - lx * s + lz * c, 0.05, 0.47, 0.05, bedWood);
    b.box(x - 0.2 * s, 0.5, z - 0.2 * c, 0.46, 0.6, 0.05, bedWood, ry);
    segs.push([x - 0.25, z, x + 0.25, z]);
  };
  chair(53.0, -46.8, 0.35);
  chair(51.15, -44.3, 1.3);
  // doors: blue, one on each side wall
  b.box(50.62, 0, -43.1, 0.05, 2.25, 1.0, doorB);
  b.box(55.62, 0, -43.0, 0.05, 2.25, 0.95, doorB, 0.131);
  // pictures on the walls (painted in miniature), mirror, towel, clothes
  const frameS = S('#c89a3a', '#a07828', '#e0b850', { cell: 0.04, aspect: 3, jitter: 0.2 });
  const pic = (x, y, z, w, h, ry, pal) => {
    b.box(x, y, z, w + 0.08, h + 0.08, 0.03, frameS, ry);
    b.box(x + Math.sin(ry) * 0.02, y + 0.04, z + Math.cos(ry) * 0.02, w, h, 0.03, S(pal[0], pal[1], pal[2], { cell: 0.05, aspect: 2.4, jitter: 1.5 }), ry);
  };
  // on the slanted wall above the bed
  pic(55.25, 1.5, -46.7, 0.7, 0.5, -Math.PI / 2 + bedRy, ['#4a8ad0', '#f0c040', '#3a8a4a']);
  pic(55.33, 2.1, -45.9, 0.36, 0.46, -Math.PI / 2 + bedRy, ['#e89040', '#2a5ab0', '#f0d080']);
  pic(55.4, 2.1, -45.3, 0.36, 0.46, -Math.PI / 2 + bedRy, ['#d86a40', '#2a6a4a', '#f0c070']);
  pic(54.0, 1.95, bz0 + 0.02, 0.44, 0.56, 0, ['#e8b030', '#2a6ac0', '#6ab050']);
  pic(53.3, 1.95, bz0 + 0.02, 0.44, 0.56, 0, ['#f0d890', '#3a7a4a', '#d87040']);
  b.box(50.62, 1.55, -47.0, 0.04, 0.55, 0.42, S('#9ab8c0', '#c8d8d8', '#7a98a8', { cell: 0.04, aspect: 2, jitter: 2 }));
  b.box(50.66, 1.0, -46.1, 0.03, 0.6, 0.28, S('#dde8d0', '#b8d0b0', '#f0f4e8', { cell: 0.04, aspect: 4, angle: 1.57, jitter: 0.2 }));
  b.box(55.35, 1.2, -44.2, 0.06, 0.9, 0.4, S('#3a5aa8', '#5070c0', '#2a4088', { cell: 0.05, aspect: 3, angle: 1.57, jitter: 0.2 }), 0.131);
  // bedroom collisions
  segs.push([50.6, -41.55, 50.6, -47.6], [50.6, -47.6, 55.1, -47.6], [55.1, -47.6, 55.9, -41.55], [50.6, -41.55, 52.3, -41.55], [53.5, -41.55, 55.9, -41.55]);

  // ---------------------------------------------------------------- square furniture
  lamp(40, -3); lamp(70, -32); lamp(71, 4); lamp(35, -36); lamp(60, -14);
  people.push({ x: 42, z: -30, seated: 0, c: '#e8d8c0' }, { x: 60.5, z: -37, seated: 0, c: '#34406a' }, { x: 38.5, z: -39.5, seated: 1, c: '#2c3a5a' });

  // ---------------------------------------------------------------- street lamps
  lamp(5.3, 38); lamp(5.3, -8); lamp(-4.7, -21); lamp(5.3, -36); lamp(-25, -47); lamp(22, -47); lamp(-20, 46); lamp(22, 46);
  lamp(-7, -55); lamp(7, -55); lamp(16.5, 30); lamp(-17, 0); lamp(79.5, -40); lamp(79.5, -10); lamp(79.5, 38);

  // ---------------------------------------------------------------- railway viaduct (behind the Yellow House, crossing the Rhône)
  const vStone = S('#cbb896', '#b39f7e', '#ddcca8', { cell: 0.32, aspect: 2.4, jitter: 0.3 });
  for (let x = 20; x <= 158; x += 9) {
    const g = H(x, -80);
    b.box(x, g - 1.5, -80, 2.2, 12.5 - g + 1.5, 4.2, vStone);
    if (x < 88 || x > 130) segs.push([x - 1.1, -80, x + 1.1, -80]);
  }
  b.box(90, 10.3, -80, 140, 1.5, 4.6, vStone);
  b.box(90, 9.5, -80, 140, 0.8, 4.2, vStone);
  b.box(90, 11.8, -81.9, 140, 0.6, 0.25, vStone); b.box(90, 11.8, -78.1, 140, 0.6, 0.25, vStone);

  // ---------------------------------------------------------------- the Rhône: far bank town and lamps
  const farWalls = [['#8a86a8', '#7a7aa0', '#a09ab8'], ['#9a8a90', '#8a7a88', '#b0a0a8'], ['#7a8aa8', '#6a7a9a', '#9aa8c0']];
  let zf = -170;
  while (zf < 170) {
    const w = 7 + r() * 8;
    const x0 = 137 + r() * 4;
    building({ x0, x1: x0 + 10 + r() * 8, z0: zf, z1: zf + w, h: 8 + r() * 11, faces: 'w', wall: wallStyle(farWalls[Math.floor(r() * 3)]), lit: 0.6, closed: 0, noCollide: true, noDoor: true });
    zf += w + (r() < 0.2 ? 5 : 0);
  }
  b.box(131.5, -1.6, 0, 2.5, 2.1, 400, S('#9a8a7a', '#86786e', '#b09a86', { cell: 0.3, aspect: 2.2, jitter: 0.2 }));
  for (let z = -130; z <= 140; z += 11) lamp(131.4, z, 4.2, { far: true, halo: 1.6, r: 6 });

  // boats pulled up on the near bank + the strolling couple
  const hullA = S('#3a6aa8', '#e08a3a', '#f0e8d0', { cell: 0.12, aspect: 3.5, jitter: 0.15 });
  const hullB = S('#4a8a5a', '#d8b84a', '#e8e0c8', { cell: 0.12, aspect: 3.5, jitter: 0.15 });
  const boat = (x, z, ry, s) => {
    const y = Math.max(H(x, z), WATER_Y - 0.1);
    b.add(new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).toNonIndexed(), b.mat(x, y + 0.45, z, 2.6, 0.62, 0.9, ry), s);
    b.box(x, y + 0.42, z, 4.6, 0.08, 1.4, s, ry);
    b.cyl(x - Math.cos(ry) * 0.6, y + 0.4, z + Math.sin(ry) * 0.6, 0.05, 3.2, P.wood);
  };
  boat(90.6, 17.8, 0.35, hullA);
  boat(92.4, 21.5, -0.25, hullB);
  boat(95.5, 26, 0.5, hullA);
  people.push({ x: 86.6, z: 17.2, seated: 0, c: '#3a4a7a' }, { x: 87.2, z: 17.6, seated: 0, c: '#d8c8a8', dress: 1 });

  // ---------------------------------------------------------------- wheat-field paths as painted ribbons
  const dirt = S('#b4563a', '#cf7a45', '#8e4a2e', { cell: 0.2, aspect: 3.4, jitter: 0.7, flow: 0.3 });
  const verge = S('#4f8a3a', '#7aa844', '#2f5a3a', { cell: 0.2, aspect: 3.4, jitter: 0.9, flow: 0.4 });
  for (const p of PATHS) {
    ribbon(b, p.pts, p.w + 0.9, 0.04, verge);
    ribbon(b, p.pts, p.w, 0.08, dirt);
  }

  // ---------------------------------------------------------------- people

  // ---------------------------------------------------------------- painters' easels at the viewpoints
  for (const pt of PAINTINGS) {
    if (pt.id === 'bedroom') continue;
    const [vx, vz] = pt.vp.pos;
    const [lx, , lz] = pt.vp.look;
    const f = new THREE.Vector2(lx - vx, lz - vz).normalize();
    const ex = vx + f.y * -1.3 - f.x * 0.2, ez = vz + f.x * 1.3 - f.y * 0.2;
    easel(b, ex, ez, Math.atan2(f.x, f.y), pt.swatch);
    segs.push([ex - 0.3, ez, ex + 0.3, ez]);
  }

  // world limits
  const R0 = 168;
  for (let i = 0; i < 64; i++) {
    const a0 = i / 64 * Math.PI * 2, a1 = (i + 1) / 64 * Math.PI * 2;
    segs.push([Math.cos(a0) * R0, Math.sin(a0) * R0, Math.cos(a1) * R0, Math.sin(a1) * R0]);
  }
  segs.push([87.6, -300, 87.6, 300]);

  const mesh = b.build(material);
  return { mesh, segs, lamps, people, vertexCount: b.vertexCount };
}

function ribbon(b, pts, w, lift, style) {
  const P = [];
  const dense = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    const n = Math.ceil(Math.hypot(bx - ax, bz - az) / 1.2);
    for (let k = 0; k < n; k++) dense.push([ax + (bx - ax) * k / n, az + (bz - az) * k / n]);
  }
  dense.push(pts[pts.length - 1]);
  for (let i = 0; i < dense.length - 1; i++) {
    const [ax, az] = dense[i], [bx, bz] = dense[i + 1];
    const dx = bx - ax, dz = bz - az, l = Math.hypot(dx, dz);
    const nx = -dz / l, nz = dx / l;
    const taper = (k) => Math.min(1, (dense.length - 1 - k) / 6 + 0.25);
    const wa = w * taper(i) / 2, wb = w * taper(i + 1) / 2;
    const A = [ax + nx * wa, 0, az + nz * wa], B = [ax - nx * wa, 0, az - nz * wa];
    const C = [bx + nx * wb, 0, bz + nz * wb], D = [bx - nx * wb, 0, bz - nz * wb];
    for (const v of [A, B, C, D]) v[1] = H(v[0], v[2]) + lift;
    P.push(...A, ...C, ...B, ...B, ...C, ...D);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.computeVertexNormals();
  b.add(g, new THREE.Matrix4(), style);
}

function easel(b, x, z, ry, sw) {
  const y = H(x, z);
  const wood = S('#9a6a3a', '#b07a44', '#7a5030', { cell: 0.05, aspect: 5, angle: 1.57, jitter: 0.08 });
  const c = Math.cos(ry), s = Math.sin(ry);
  const L = (lx, lz, rx, rz) => b.box(x + lx * c + lz * s, y, z - lx * s + lz * c, 0.05, 1.9, 0.05, wood, ry, rx, rz);
  L(-0.35, 0.1, 0.1, 0.18); L(0.35, 0.1, 0.1, -0.18); L(0, -0.45, -0.25, 0);
  b.box(x + 0.16 * s, y + 0.82, z + 0.16 * c, 0.9, 0.05, 0.1, wood, ry);
  b.box(x + 0.18 * s, y + 0.87, z + 0.18 * c, 0.86, 0.66, 0.04, S(sw[0], sw[1], sw[2], { cell: 0.05, aspect: 2.5, jitter: 1.2, flow: 0.6 }), ry, 0.1);
}
