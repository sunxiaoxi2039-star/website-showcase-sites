import * as THREE from 'three';

// Collects every static painted surface of the town into ONE geometry that carries, per
// vertex, the palette (3 colours) and the brush description (cell size, aspect, angle...).
// One draw call, one shader.

export const hex = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };

// Style: palette a (main), b (secondary), c (accent / lit colour for emissive)
export function S(a, b, c, o = {}) {
  return {
    a: hex(a), b: hex(b), c: hex(c),
    cell: 0.3, aspect: 3, angle: 0, jitter: 0.35, emissive: 0, flow: 0, outline: 0, size: 1, ...o,
  };
}

export function rng(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

const unitBox = new THREE.BoxGeometry(1, 1, 1).toNonIndexed();
unitBox.translate(0, 0.5, 0);
const unitCyl = new THREE.CylinderGeometry(1, 1, 1, 18, 1).toNonIndexed(); unitCyl.translate(0, 0.5, 0);
const unitCone = new THREE.CylinderGeometry(0, 1, 1, 12, 1).toNonIndexed(); unitCone.translate(0, 0.5, 0);
const unitSphere = new THREE.SphereGeometry(1, 14, 10).toNonIndexed();
const unitPyr = new THREE.CylinderGeometry(0, 0.7071, 1, 4, 1).toNonIndexed(); unitPyr.rotateY(Math.PI / 4); unitPyr.translate(0, 0.5, 0);

function prismGeo() {
  // ridge along x at y=1, eaves at z=±0.5, y=0
  const p = [];
  const A = [-0.5, 0, 0.5], B = [0.5, 0, 0.5], C = [0.5, 1, 0], D = [-0.5, 1, 0];
  const E = [-0.5, 0, -0.5], F = [0.5, 0, -0.5];
  const tri = (a, b, c) => p.push(...a, ...b, ...c);
  tri(A, B, C); tri(A, C, D);      // south slope
  tri(F, E, D); tri(F, D, C);      // north slope
  tri(E, A, D);                    // west gable
  tri(B, F, C);                    // east gable
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.computeVertexNormals();
  return g;
}
const unitPrism = prismGeo();

export class Builder {
  constructor() { this.P = []; this.N = []; this.A = []; this.B = []; this.C = []; this.ST = []; this.MT = []; }
  add(geo, m, s) {
    const p = geo.attributes.position, n = geo.attributes.normal;
    const nm = new THREE.Matrix3().getNormalMatrix(m);
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(m); this.P.push(v.x, v.y, v.z);
      v.fromBufferAttribute(n, i).applyMatrix3(nm).normalize(); this.N.push(v.x, v.y, v.z);
      this.A.push(...s.a); this.B.push(...s.b); this.C.push(...s.c);
      this.ST.push(s.cell, s.aspect, s.angle, s.jitter);
      this.MT.push(s.emissive, s.flow, s.outline, s.size);
    }
  }
  mat(x, y, z, sx, sy, sz, ry = 0, rx = 0, rz = 0) {
    const m = new THREE.Matrix4();
    m.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(sx, sy, sz));
    return m;
  }
  // (x, y, z) = centre of the BOTTOM face
  box(x, y, z, w, h, d, s, ry = 0, rx = 0, rz = 0) { this.add(unitBox, this.mat(x, y, z, w, h, d, ry, rx, rz), s); }
  cyl(x, y, z, r, h, s, rx = 0, rz = 0) { this.add(unitCyl, this.mat(x, y, z, r, h, r, 0, rx, rz), s); }
  cone(x, y, z, r, h, s) { this.add(unitCone, this.mat(x, y, z, r, h, r), s); }
  pyr(x, y, z, w, h, d, s) { this.add(unitPyr, this.mat(x, y, z, w, h, d), s); }
  sphere(x, y, z, rx, ry, rz, s) { this.add(unitSphere, this.mat(x, y, z, rx, ry, rz), s); }
  prism(x, y, z, len, h, width, s, ry = 0) { this.add(unitPrism, this.mat(x, y, z, len, h, width, ry), s); }
  geo(g, m, s) { const gg = g.index ? g.toNonIndexed() : g; if (!gg.attributes.normal) gg.computeVertexNormals(); this.add(gg, m, s); }

  build(material) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.N, 3));
    g.setAttribute('cA', new THREE.Float32BufferAttribute(this.A, 3));
    g.setAttribute('cB', new THREE.Float32BufferAttribute(this.B, 3));
    g.setAttribute('cC', new THREE.Float32BufferAttribute(this.C, 3));
    g.setAttribute('st', new THREE.Float32BufferAttribute(this.ST, 4));
    g.setAttribute('mt', new THREE.Float32BufferAttribute(this.MT, 4));
    g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, material);
    mesh.frustumCulled = false;
    return mesh;
  }
  get vertexCount() { return this.P.length / 3; }
}
