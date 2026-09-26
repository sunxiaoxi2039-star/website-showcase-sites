// 投影与地形采样：1 场景单位 = 1 km；x 向东，z 向南，y 向上。
export const VT = 2.2;   // 地形垂直夸张
export const VB = 2.0;   // 建筑垂直夸张
export const BASE_Y = -0.42; // 沙盘底座顶面

export const geo = {
  lon0: 126.978, lat0: 37.5665, kx: 88.28, kz: 110.95,
  X0: -21.8, X1: 21.8, Z0: -18.6, Z1: 18.9, NX: 728, NZ: 626, wl: 3,
  heights: null,
};

export function initGeo(meta, heights) {
  geo.lon0 = meta.lon0; geo.lat0 = meta.lat0; geo.kx = meta.kx; geo.kz = meta.kz;
  [geo.X0, geo.X1, geo.Z0, geo.Z1] = meta.extent;
  [geo.NX, geo.NZ] = meta.grid;
  geo.wl = meta.wl;
  geo.heights = heights;
}

export function proj(lon, lat) {
  return [(lon - geo.lon0) * geo.kx, -(lat - geo.lat0) * geo.kz];
}
export function unproj(x, z) {
  return [geo.lon0 + x / geo.kx, geo.lat0 - z / geo.kz];
}

// 真实海拔（米），双线性插值
export function heightM(x, z) {
  const { NX, NZ, X0, X1, Z0, Z1, heights } = geo;
  let fx = (x - X0) / (X1 - X0) * (NX - 1);
  let fz = (z - Z0) / (Z1 - Z0) * (NZ - 1);
  fx = Math.min(Math.max(fx, 0), NX - 1.001);
  fz = Math.min(Math.max(fz, 0), NZ - 1.001);
  const i = fx | 0, j = fz | 0, a = fx - i, b = fz - j;
  const k = j * NX + i;
  return (heights[k] * (1 - a) * (1 - b) + heights[k + 1] * a * (1 - b) +
    heights[k + NX] * (1 - a) * b + heights[k + NX + 1] * a * b) * 0.1;
}
export function groundY(x, z) { return heightM(x, z) * VT / 1000; }
export function inExtent(x, z, m = 0) {
  return x > geo.X0 + m && x < geo.X1 - m && z > geo.Z0 + m && z < geo.Z1 - m;
}

export function pointInRing(x, z, ring) { // ring: flat [x,z,...] in metres
  let inside = false;
  for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
    const xi = ring[i], zi = ring[i + 1], xj = ring[j], zj = ring[j + 1];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}
