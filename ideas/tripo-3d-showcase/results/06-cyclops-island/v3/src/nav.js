// nav.js — radius-aware grid A* over the island plus movement helpers that respect terrain, shore and obstacles.
const MIN = -14, MAX = 14, CELL = .25, N = Math.round((MAX - MIN) / CELL);

export function createNav(world) {
  // clearance field sampled once; grids for each actor radius are thresholds of it
  const field = new Float32Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) field[j * N + i] = world.staticClearance(MIN + (i + .5) * CELL, MIN + (j + .5) * CELL);

  const toCell = v => Math.min(N - 1, Math.max(0, Math.floor((v - MIN) / CELL)));
  const centre = i => MIN + (i + .5) * CELL;
  const clearance = (x, z) => world.staticClearance(x, z);
  const walkable = (x, z, r) => clearance(x, z) >= r;
  const cellOK = (i, j, r) => i >= 0 && j >= 0 && i < N && j < N && field[j * N + i] >= r;

  function lineClear(ax, az, bx, bz, r) {
    const d = Math.hypot(bx - ax, bz - az), steps = Math.max(1, Math.ceil(d / (CELL * .5)));
    for (let s = 1; s <= steps; s++) { const t = s / steps; if (!walkable(ax + (bx - ax) * t, az + (bz - az) * t, r)) return false; }
    return true;
  }

  // nearest walkable cell to a point (spiral search)
  function nearestOK(x, z, r) {
    const ci = toCell(x), cj = toCell(z);
    if (cellOK(ci, cj, r)) return [ci, cj];
    for (let rad = 1; rad < 24; rad++) {
      let best = null, bd = 1e9;
      for (let j = cj - rad; j <= cj + rad; j++) for (let i = ci - rad; i <= ci + rad; i++) {
        if (Math.max(Math.abs(i - ci), Math.abs(j - cj)) !== rad || !cellOK(i, j, r)) continue;
        const d = (i - ci) ** 2 + (j - cj) ** 2; if (d < bd) { bd = d; best = [i, j]; }
      }
      if (best) return best;
    }
    return null;
  }

  // binary heap A*
  const g = new Float32Array(N * N), came = new Int32Array(N * N), closed = new Uint8Array(N * N), stamp = new Uint32Array(N * N); let gen = 0;
  const NB = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
  function findPath(sx, sz, tx, tz, r) {
    const s = nearestOK(sx, sz, r), t = nearestOK(tx, tz, r);
    if (!s || !t) return null;
    gen++;
    const si = s[1] * N + s[0], ti = t[1] * N + t[0];
    const heap = [], push = (f, i) => { heap.push([f, i]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, rr = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (rr < heap.length && heap[rr][0] < heap[m][0]) m = rr; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
    const h = i => { const x = i % N, y = (i / N) | 0; const dx = Math.abs(x - t[0]), dy = Math.abs(y - t[1]); return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy); };
    stamp[si] = gen; g[si] = 0; closed[si] = 0; came[si] = -1; push(h(si), si);
    let found = false, iter = 0;
    while (heap.length && iter++ < 40000) {
      const [, cur] = pop();
      if (cur === ti) { found = true; break; }
      if (stamp[cur] === gen && closed[cur]) continue;
      closed[cur] = 1;
      const cx = cur % N, cy = (cur / N) | 0;
      for (const [dx, dy, cost] of NB) {
        const nx = cx + dx, ny = cy + dy;
        if (!cellOK(nx, ny, r)) continue;
        if (dx && dy && (!cellOK(cx + dx, cy, r) || !cellOK(cx, cy + dy, r))) continue;
        const ni = ny * N + nx, ng = g[cur] + cost;
        if (stamp[ni] !== gen) { stamp[ni] = gen; g[ni] = Infinity; closed[ni] = 0; }
        if (closed[ni] || ng >= g[ni]) continue;
        g[ni] = ng; came[ni] = cur; push(ng + h(ni), ni);
      }
    }
    if (!found) return null;
    const cells = []; for (let c = ti; c !== -1; c = came[c]) cells.push([centre(c % N), centre((c / N) | 0)]);
    cells.reverse();
    // exact end point when it is valid
    if (walkable(tx, tz, r)) cells[cells.length - 1] = [tx, tz];
    // string pulling
    const out = [[sx, sz]]; let k = 0;
    while (k < cells.length - 1) {
      let far = k + 1;
      for (let m = cells.length - 1; m > k + 1; m--) if (lineClear(out[out.length - 1][0], out[out.length - 1][1], cells[m][0], cells[m][1], r)) { far = m; break; }
      out.push(cells[far]); k = far;
    }
    out.shift();
    return out;
  }

  // move with sliding: returns the accepted position
  function move(pos, dx, dz, r) {
    const nx = pos.x + dx, nz = pos.z + dz;
    if (walkable(nx, nz, r)) { pos.x = nx; pos.z = nz; return true; }
    if (walkable(nx, pos.z, r)) { pos.x = nx; return true; }
    if (walkable(pos.x, nz, r)) { pos.z = nz; return true; }
    return false;
  }

  // push a point back onto valid ground (used after knockback / dodge)
  function clamp(pos, r) {
    if (walkable(pos.x, pos.z, r)) return pos;
    const c = nearestOK(pos.x, pos.z, r);
    if (c) { pos.x = centre(c[0]); pos.z = centre(c[1]); }
    return pos;
  }

  return { findPath, move, clamp, walkable, lineClear, clearance, grid: { MIN, MAX, CELL, N, field } };
}
