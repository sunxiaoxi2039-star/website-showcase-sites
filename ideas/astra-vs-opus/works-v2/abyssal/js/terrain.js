// 海底：以镜头为中心的非均匀网格（近处 0.75 米、远处约 9 米），顶点着色器直接采样烘焙好的高度图。
import * as THREE from 'three';
import { U, COMMON_GLSL } from './optics.js';
import { TERRAIN_GLSL, N, DN } from './world.js';

export const TERRAIN_STEP = 0.75;

export function createWorldTextures(world) {
  const hd = new Float32Array(N * N * 2);
  for (let i = 0; i < N * N; i++) {
    hd[i * 2] = world.H[i];
    hd[i * 2 + 1] = world.A[i];
  }
  const heightTex = new THREE.DataTexture(hd, N, N, THREE.RGFormat, THREE.FloatType);
  heightTex.minFilter = heightTex.magFilter = THREE.NearestFilter;
  heightTex.needsUpdate = true;
  const detailTex = new THREE.DataTexture(world.D, DN, DN, THREE.RedFormat, THREE.FloatType);
  detailTex.minFilter = detailTex.magFilter = THREE.NearestFilter;
  detailTex.needsUpdate = true;
  const hab = new Uint8Array(N * N * 4);
  for (let i = 0; i < N * N; i++) {
    hab[i * 4] = Math.round(world.reef[i] * 255);
    hab[i * 4 + 1] = Math.round(world.kelp[i] * 255);
    hab[i * 4 + 2] = Math.round(world.vent[i] * 255);
    hab[i * 4 + 3] = Math.round(world.grass[i] * 255);
  }
  const habTex = new THREE.DataTexture(hab, N, N, THREE.RGBAFormat, THREE.UnsignedByteType);
  habTex.minFilter = habTex.magFilter = THREE.LinearFilter;
  habTex.needsUpdate = true;
  return { heightTex, detailTex, habTex };
}

function makeGrid(M, s0, gf) {
  const pos = [];
  const w = (i) => s0 * i * (1 + gf * (i / M) * (i / M));
  const dw = (i) => s0 * (1 + 3 * gf * (i / M) * (i / M));
  for (let j = -M; j <= M; j++) {
    for (let i = -M; i <= M; i++) {
      pos.push(w(i), Math.max(dw(i), dw(j)), w(j));
    }
  }
  const S = 2 * M + 1;
  const idx = [];
  for (let j = 0; j < S - 1; j++) {
    for (let i = 0; i < S - 1; i++) {
      const a = j * S + i, b = a + 1, c = a + S, d = c + 1;
      // 交替对角线，减少方向性伪影
      if ((i + j) & 1) idx.push(a, c, b, b, c, d);
      else idx.push(a, c, d, a, d, b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

export const TERRAIN_U = {
  uHeightTex: { value: null },
  uDetailTex: { value: null },
  uHabTex: { value: null },
  uGridCenter: { value: new THREE.Vector2() },
};

export function createTerrain(quality) {
  const M = quality === 'low' ? 90 : quality === 'high' ? 150 : 128;
  const geo = makeGrid(M, TERRAIN_STEP * (128 / M), 3.9 * (M / 128));
  const mat = new THREE.ShaderMaterial({
    uniforms: { ...U, ...TERRAIN_U },
    vertexShader: /* glsl */`
      ${COMMON_GLSL}
      ${TERRAIN_GLSL}
      uniform vec2 uGridCenter;
      varying vec3 vWorld;
      varying vec3 vNrm;
      varying float vAO;
      varying vec4 vHab;
      void main(){
        vec2 p = uGridCenter + position.xz;
        float sp = position.y;
        float h = wFloor(p);
        float e = max(0.6, sp * 1.2);
        float hx = wFloor(p + vec2(e, 0.0)) - wFloor(p - vec2(e, 0.0));
        float hz = wFloor(p + vec2(0.0, e)) - wFloor(p - vec2(0.0, e));
        vNrm = normalize(vec3(-hx, 2.0 * e, -hz));
        // 凹处更暗：与周围 4 米的平均高度比较
        float r = 4.0 + sp;
        float avg = (wFloor(p + vec2(r, r)) + wFloor(p + vec2(-r, r)) + wFloor(p + vec2(r, -r)) + wFloor(p + vec2(-r, -r))) * 0.25;
        vAO = clamp(1.0 + (h - avg) * 0.22, 0.45, 1.15);
        vWorld = vec3(p.x, h, p.y);
        vHab = wHabitat(p);
        gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
      }`,
    fragmentShader: /* glsl */`
      ${COMMON_GLSL}
      varying vec3 vWorld;
      varying vec3 vNrm;
      varying float vAO;
      varying vec4 vHab;
      float bumpN(vec2 p){ return vnoise(p) * 0.6 + vnoise(p * 2.7 + 5.1) * 0.3 + vnoise(p * 7.3 - 3.3) * 0.1; }
      void main(){
        vec3 p = vWorld;
        vec3 n = normalize(vNrm);
        float dist = length(p - uCamPos);
        float reef = vHab.r, kelp = vHab.g, vent = vHab.b, grass = vHab.a;
        float depth = -p.y;
        float steep = 1.0 - n.y;
        float shelf = 1.0 - smoothstep(55.0, 110.0, depth);
        float abyss = smoothstep(1150.0, 1300.0, depth);
        // 细节法线（随距离淡出）
        float df = 1.0 - smoothstep(12.0, 60.0, dist);
        vec2 q = p.xz * 1.3;
        float b0 = bumpN(q);
        float bx = bumpN(q + vec2(0.07, 0.0)) - b0;
        float bz = bumpN(q + vec2(0.0, 0.07)) - b0;
        float rockMask = smoothstep(0.22, 0.42, steep + reef * 0.25 + vent * 0.3 + (1.0 - shelf) * (1.0 - abyss) * 0.15);
        // 沙纹
        float sandMask = (1.0 - rockMask) * (1.0 - reef * 0.7) * shelf;
        vec2 rdir = normalize(vec2(0.8, 0.6) + vec2(vnoise(p.xz * 0.05) - 0.5, vnoise(p.xz * 0.05 + 9.0) - 0.5));
        float rph = dot(p.xz, rdir) * 3.1 + vnoise(p.xz * 0.35) * 5.0;
        float rip = sin(rph);
        vec2 ripG = rdir * cos(rph) * 3.1 * 0.03 * sandMask;
        vec3 bn = vec3(-bx / 0.07 * 0.18 * (0.4 + rockMask), 0.0, -bz / 0.07 * 0.18 * (0.4 + rockMask));
        n = normalize(n + (bn + vec3(-ripG.x, 0.0, -ripG.y)) * df);

        // 反照率
        float v1 = vnoise(p.xz * 0.21), v2 = vnoise(p.xz * 0.9 + 3.0), v3 = vnoise(p.xz * 0.043 + 7.0);
        vec3 sand = mix(vec3(0.66, 0.62, 0.5), vec3(0.76, 0.71, 0.59), v1) * (0.93 + 0.07 * rip * sandMask * df);
        vec3 sediment = mix(vec3(0.46, 0.44, 0.37), vec3(0.56, 0.53, 0.45), v2);
        vec3 lime = mix(vec3(0.56, 0.53, 0.46), vec3(0.68, 0.64, 0.55), v2);
        vec3 turf = mix(vec3(0.33, 0.36, 0.22), vec3(0.45, 0.42, 0.27), v1);
        vec3 coralline = vec3(0.62, 0.36, 0.42);
        vec3 darkRock = mix(vec3(0.27, 0.26, 0.24), vec3(0.36, 0.34, 0.31), v2);
        vec3 ooze = mix(vec3(0.40, 0.39, 0.36), vec3(0.48, 0.46, 0.42), v1);
        vec3 basalt = mix(vec3(0.10, 0.10, 0.11), vec3(0.17, 0.16, 0.16), v2);
        vec3 rust = mix(vec3(0.45, 0.26, 0.11), vec3(0.62, 0.42, 0.18), v1);

        vec3 shelfCol = mix(sand, sediment * vec3(0.9, 0.95, 0.8), grass * 0.8);
        vec3 reefRock = mix(lime, turf, smoothstep(0.35, 0.7, v2 + v3 * 0.3) * 0.7);
        shelfCol = mix(shelfCol, reefRock, clamp(reef * 1.2, 0.0, 1.0) * mix(0.35, 1.0, rockMask));
        vec3 kelpRock = mix(darkRock, coralline, smoothstep(0.55, 0.8, v2) * 0.6);
        shelfCol = mix(shelfCol, kelpRock, rockMask * kelp * 0.9 + rockMask * (1.0 - reef) * 0.4);
        vec3 slopeCol = mix(sediment * 0.85, darkRock, rockMask);
        vec3 abyssCol = mix(ooze, basalt, rockMask * 0.8);
        abyssCol = mix(abyssCol, mix(basalt, rust, smoothstep(0.4, 0.8, v2 + v3 * 0.4)), smoothstep(0.1, 0.6, vent));
        vec3 albedo = mix(slopeCol, shelfCol, shelf);
        albedo = mix(albedo, abyssCol, abyss);
        albedo *= 0.9 + 0.2 * v3;

        float ao = vAO * (0.75 + 0.25 * b0);
        float cm = smoothstep(0.1, 0.6, n.y);
        vec3 col = shadeUnder(albedo, p, n, ao, cm);
        gl_FragColor = vec4(applyWater(col, p), 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 0;
  return mesh;
}
