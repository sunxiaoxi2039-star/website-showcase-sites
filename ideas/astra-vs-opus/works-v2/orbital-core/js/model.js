// Procedural "Blender-style" hard-surface model of the Orbital Core.
// Every part is built from 2D profiles swept around an axis (like Blender's Screw / Spin
// modifier) with crisp chamfers, split into machined segments with end caps.
import * as THREE from 'three';

/* ------------------------------------------------------------------ */
/* Geometry helpers                                                    */
/* ------------------------------------------------------------------ */

// Sweep a closed/open 2D profile [(r,y)...] around the Y axis between phi0..phi1.
// Each profile edge gets its own flat normal => chamfers read as sharp highlight lines.
// Optionally caps both ends (for segmented rings with gaps).
function sweepProfile(profile, { phi0 = 0, phi1 = Math.PI * 2, steps = 64, closed = true, caps = false, uRepeat = 1 } = {}) {
  const pos = [], nor = [], uv = [], idx = [];
  const edges = [];
  const n = profile.length;
  const edgeCount = closed ? n : n - 1;
  // signed area to know profile orientation (so normals point outward)
  let area = 0;
  for (let i = 0; i < n; i++) {
    const a = profile[i], b = profile[(i + 1) % n];
    area += a[0] * b[1] - b[0] * a[1];
  }
  const orient = area >= 0 ? 1 : -1;
  let vAcc = 0;
  for (let e = 0; e < edgeCount; e++) {
    const a = profile[e], b = profile[(e + 1) % n];
    const dr = b[0] - a[0], dy = b[1] - a[1];
    const len = Math.hypot(dr, dy) || 1e-6;
    // outward normal in (r,y) for CCW profile is (dy, -dr)
    const nr = (dy / len) * orient, ny = (-dr / len) * orient;
    edges.push({ a, b, nr, ny, v0: vAcc, v1: vAcc + len });
    vAcc += len;
  }
  const phiLen = phi1 - phi0;
  for (const ed of edges) {
    const base = pos.length / 3;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const phi = phi0 + phiLen * t;
      const sp = Math.sin(phi), cp = Math.cos(phi);
      for (const [p, v] of [[ed.a, ed.v0], [ed.b, ed.v1]]) {
        pos.push(p[0] * sp, p[1], p[0] * cp);
        nor.push(ed.nr * sp, ed.ny, ed.nr * cp);
        uv.push((phi / (Math.PI * 2)) * uRepeat, v * 2);
      }
    }
    for (let s = 0; s < steps; s++) {
      const i0 = base + s * 2, i1 = i0 + 1, i2 = i0 + 2, i3 = i0 + 3;
      idx.push(i0, i2, i1, i1, i2, i3);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  fixWinding(geo);
  if (caps && closed) return mergeGeos([geo, profileCap(profile, phi0, -1), profileCap(profile, phi1, 1)]);
  return geo;
}

// Flat polygon cap of a profile placed at angle phi. dir = +1 faces along +phi.
function profileCap(profile, phi, dir) {
  const contour = profile.map((p) => new THREE.Vector2(p[0], p[1]));
  const tris = THREE.ShapeUtils.triangulateShape(contour, []);
  const sp = Math.sin(phi), cp = Math.cos(phi);
  const nx = cp * dir, nz = -sp * dir; // d/dphi of (sin, cos)
  const pos = [], nor = [], uv = [], idx = [];
  profile.forEach((p) => {
    pos.push(p[0] * sp, p[1], p[0] * cp);
    nor.push(nx, 0, nz);
    uv.push(p[0], p[1]);
  });
  tris.forEach((t) => idx.push(t[0], t[1], t[2]));
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  fixWinding(geo);
  return geo;
}

// Make every triangle's winding agree with its stored vertex normal.
function fixWinding(geo) {
  const p = geo.attributes.position, nrm = geo.attributes.normal, index = geo.index.array;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3(), fn = new THREE.Vector3();
  for (let i = 0; i < index.length; i += 3) {
    a.fromBufferAttribute(p, index[i]); b.fromBufferAttribute(p, index[i + 1]); c.fromBufferAttribute(p, index[i + 2]);
    fn.subVectors(b, a).cross(c.sub(a));
    if (fn.lengthSq() < 1e-14) continue;
    n.fromBufferAttribute(nrm, index[i]);
    if (fn.dot(n) < 0) { const t = index[i + 1]; index[i + 1] = index[i + 2]; index[i + 2] = t; }
  }
}

function mergeGeos(list) {
  let vCount = 0, iCount = 0;
  list.forEach((g) => { vCount += g.attributes.position.count; iCount += g.index.count; });
  const pos = new Float32Array(vCount * 3), nor = new Float32Array(vCount * 3), uv = new Float32Array(vCount * 2);
  const idx = new Uint32Array(iCount);
  let vo = 0, io = 0;
  list.forEach((g) => {
    pos.set(g.attributes.position.array, vo * 3);
    nor.set(g.attributes.normal.array, vo * 3);
    uv.set(g.attributes.uv.array, vo * 2);
    const gi = g.index.array;
    for (let i = 0; i < gi.length; i++) idx[io + i] = gi[i] + vo;
    vo += g.attributes.position.count; io += gi.length;
    g.dispose();
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  return geo;
}

// Chamfered rectangle cross-section, with an optional recessed channel on the outer face.
function ringSection(R, halfT, halfW, bevel, channel) {
  const ri = R - halfT, ro = R + halfT, b = bevel;
  const pts = [
    [ri, -halfW + b], [ri, halfW - b], [ri + b, halfW], [ro - b, halfW], [ro, halfW - b],
  ];
  if (channel) {
    const { half, depth } = channel;
    pts.push([ro, half + 0.006], [ro - 0.006, half], [ro - depth, half], [ro - depth, -half], [ro - 0.006, -half], [ro, -half - 0.006]);
  }
  pts.push([ro, -halfW + b], [ro - b, -halfW], [ri + b, -halfW]);
  return pts;
}

/* ------------------------------------------------------------------ */
/* Procedural textures                                                 */
/* ------------------------------------------------------------------ */

function brushedTexture() {
  const w = 1024, h = 256;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = 'rgb(128,128,128)';
  g.fillRect(0, 0, w, h);
  // streaks run along U (= around the sweep axis) => spun / turned metal
  for (let i = 0; i < 2600; i++) {
    const y = Math.random() * h;
    const v = 90 + Math.random() * 90;
    g.strokeStyle = `rgba(${v},${v},${v},${0.08 + Math.random() * 0.25})`;
    g.lineWidth = Math.random() < 0.9 ? 0.6 : 1.6;
    const x = Math.random() * w;
    const len = 80 + Math.random() * 700;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + len, y + (Math.random() - 0.5) * 0.8); g.stroke();
    g.beginPath(); g.moveTo(x - w, y); g.lineTo(x - w + len, y); g.stroke();
  }
  // a few micro scratches
  for (let i = 0; i < 40; i++) {
    g.strokeStyle = `rgba(210,210,210,${0.1 + Math.random() * 0.2})`;
    g.lineWidth = 0.5;
    const x = Math.random() * w, y = Math.random() * h;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (Math.random() - 0.5) * 60, y + (Math.random() - 0.5) * 30); g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

// Engraved dial for the pedestal top: ticks + circular micro-type.
function dialTexture() {
  const S = 1024;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.translate(S / 2, S / 2);
  const rOut = S / 2 - 6;
  g.strokeStyle = '#fff';
  g.fillStyle = '#fff';
  for (let i = 0; i < 360; i += 2) {
    const a = (i * Math.PI) / 180;
    const major = i % 30 === 0, mid = i % 10 === 0;
    const l = major ? 34 : mid ? 20 : 10;
    g.globalAlpha = major ? 1 : mid ? 0.75 : 0.45;
    g.lineWidth = major ? 3 : 1.6;
    g.beginPath();
    g.moveTo(Math.cos(a) * rOut, Math.sin(a) * rOut);
    g.lineTo(Math.cos(a) * (rOut - l), Math.sin(a) * (rOut - l));
    g.stroke();
  }
  g.globalAlpha = 0.9;
  g.lineWidth = 1.5;
  g.beginPath(); g.arc(0, 0, rOut - 46, 0, Math.PI * 2); g.stroke();
  g.globalAlpha = 0.5;
  g.beginPath(); g.arc(0, 0, rOut - 112, 0, Math.PI * 2); g.stroke();
  // circular type
  const text = 'ORBITAL CORE · SPECIMEN 01 · DUAL-RING CONTAINMENT · FIELD NOMINAL · 48.6 THz · ';
  g.font = '500 26px "IBM Plex Mono", monospace';
  g.globalAlpha = 0.85;
  const rT = rOut - 80;
  const total = text.length;
  for (let i = 0; i < total; i++) {
    const a = (i / total) * Math.PI * 2;
    g.save();
    g.rotate(a);
    g.translate(0, -rT);
    g.fillText(text[i], -8, 0);
    g.restore();
  }
  // four index markers
  g.globalAlpha = 1;
  for (let k = 0; k < 4; k++) {
    g.save();
    g.rotate((k * Math.PI) / 2);
    g.beginPath();
    g.moveTo(0, -(rOut - 50)); g.lineTo(-9, -(rOut - 68)); g.lineTo(9, -(rOut - 68)); g.closePath();
    g.fill();
    g.restore();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 8;
  return tex;
}

/* ------------------------------------------------------------------ */
/* Shaders                                                             */
/* ------------------------------------------------------------------ */

const NOISE = /* glsl */`
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.0-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;vec4 s1=floor(b1)*2.0+1.0;vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
float fbm(vec3 p){float f=0.0,a=0.5;for(int i=0;i<4;i++){f+=a*snoise(p);p*=2.03;a*=0.5;}return f;}
`;

function plasmaMaterial(uniforms) {
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */`
      varying vec3 vObj; varying vec3 vN; varying vec3 vView;
      void main(){
        vObj = position;
        vec4 wp = modelMatrix * vec4(position,1.0);
        vN = normalize(mat3(modelMatrix) * normal);
        vView = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime; uniform float uEnergy;
      varying vec3 vObj; varying vec3 vN; varying vec3 vView;
      ${NOISE}
      void main(){
        vec3 p = normalize(vObj);
        float t = uTime*0.35;
        // domain-warped turbulence => convective plasma cells
        vec3 q = p*1.25 + 0.8*vec3(fbm(p*1.1 + t), fbm(p*1.1 - t + 4.1), fbm(p*1.1 + 8.3 + t*0.5));
        float n = fbm(q*1.1 + vec3(0.0, t*0.6, 0.0));
        float cells = smoothstep(-0.35, 0.6, n);
        float filaments = pow(1.0 - abs(snoise(q*1.7 - t*0.7)), 9.0);
        float facing = clamp(dot(normalize(vN), normalize(vView)), 0.0, 1.0);
        vec3 deep = vec3(0.005, 0.06, 0.55);
        vec3 mid  = vec3(0.03, 0.34, 1.55);
        vec3 hot  = vec3(0.70, 1.55, 2.60);
        vec3 col = mix(deep, mid, cells);
        col = mix(col, hot, filaments*0.85 + pow(facing, 3.0)*0.55*cells);
        // limb: brighten the rim slightly (scattering corona)
        col += vec3(0.15,0.45,1.4) * pow(1.0 - facing, 2.5) * 0.9;
        gl_FragColor = vec4(col * uEnergy, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

function haloMaterial(uniforms, { power = 2.4, strength = 1.0, color = new THREE.Color(0.25, 0.6, 1.6) } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { ...uniforms, uPower: { value: power }, uStrength: { value: strength }, uColor: { value: color } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    vertexShader: /* glsl */`
      varying vec3 vN; varying vec3 vView;
      void main(){
        vec4 wp = modelMatrix * vec4(position,1.0);
        vN = normalize(mat3(modelMatrix) * normal);
        vView = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */`
      uniform float uEnergy; uniform float uPower; uniform float uStrength; uniform vec3 uColor;
      varying vec3 vN; varying vec3 vView;
      void main(){
        float f = clamp(dot(-normalize(vN), normalize(vView)), 0.0, 1.0);
        float a = pow(f, uPower) * uStrength * uEnergy;
        gl_FragColor = vec4(uColor * a, 1.0);
      }`,
  });
}

function beamMaterial(uniforms) {
  return new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */`
      varying vec2 vUv; varying vec3 vN; varying vec3 vView;
      void main(){
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position,1.0);
        vN = normalize(mat3(modelMatrix) * normal);
        vView = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime; uniform float uEnergy; uniform float uExplode;
      varying vec2 vUv; varying vec3 vN; varying vec3 vView;
      void main(){
        float edge = 1.0 - abs(dot(normalize(vN), normalize(vView)));
        float core = pow(1.0 - edge, 2.0);
        float fadeY = smoothstep(0.0, 0.12, vUv.y) * smoothstep(1.0, 0.55, vUv.y);
        float bands = 0.55 + 0.45 * sin(vUv.y * 38.0 - uTime * 4.0);
        float a = core * fadeY * (0.35 + 0.65 * bands) * 0.55 * uEnergy * (1.0 - uExplode*0.7);
        gl_FragColor = vec4(vec3(0.2, 0.55, 1.6) * a, 1.0);
      }`,
  });
}

function floorFxMaterial(uniforms) {
  return new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      varying vec2 vP;
      void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */`
      uniform float uTime; uniform float uEnergy; uniform float uBeat; uniform float uBeatAge;
      varying vec2 vP;
      float ring(float d, float r, float w){ return smoothstep(w, 0.0, abs(d - r)); }
      void main(){
        float d = length(vP);
        float ang = atan(vP.y, vP.x);
        // pooled light under the pedestal
        float pool = exp(-pow(max(d - 1.7, 0.0), 1.0) * 1.6) * 0.38 * smoothstep(1.55, 1.95, d);
        // concentric survey rings (every 1.45 units, like a measured stage)
        float rings = 0.0;
        for (int i = 1; i < 6; i++) {
          float r = 1.0 + float(i) * 1.45;
          float dash = step(0.35, fract(ang * (8.0 + float(i) * 6.0) / 6.2831 + uTime * 0.01 * float(i)));
          rings += ring(d, r, 0.012) * (i == 1 ? 1.0 : mix(0.55, 1.0, dash));
        }
        rings *= 0.11 * smoothstep(10.0, 2.0, d);
        // radial ticks just outside the pedestal
        float ticks = step(0.86, fract(ang * 120.0 / 6.2831)) * smoothstep(2.2, 2.18, d) * smoothstep(2.08, 2.1, d) * 0.16;
        // expanding shockwave on each pulse
        float wave = 0.0;
        if (uBeat > 0.0) {
          float wr = 1.8 + uBeatAge * 5.5;
          wave = ring(d, wr, 0.08 + uBeatAge * 0.12) * exp(-uBeatAge * 2.4) * 1.3 * uBeat;
        }
        vec3 col = vec3(0.12, 0.42, 1.2) * (pool * uEnergy) + vec3(0.35, 0.7, 1.0) * (rings + ticks) + vec3(0.3, 0.75, 1.8) * wave;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}

function particleMaterial(uniforms) {
  return new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      attribute vec4 aOrbit; // radius, inclination, node, phase
      attribute vec2 aMisc;  // speed, size
      uniform float uTime; uniform float uSpeed; uniform float uPx; uniform float uEnergy;
      varying float vA;
      void main(){
        float r = aOrbit.x; float inc = aOrbit.y; float node = aOrbit.z;
        float th = aOrbit.w + uTime * aMisc.x;
        vec3 p = vec3(cos(th) * r, 0.0, sin(th) * r);
        // inclination around X then node around Y
        p = vec3(p.x, -p.z * sin(inc), p.z * cos(inc));
        p = vec3(p.x * cos(node) + p.z * sin(node), p.y, -p.x * sin(node) + p.z * cos(node));
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = min(aMisc.y * uPx * (24.0 / -mv.z), 5.0 * uPx);
        vA = (0.45 + 0.55 * sin(th * 3.0 + aOrbit.w * 7.0)) * uEnergy;
      }`,
    fragmentShader: /* glsl */`
      varying float vA;
      void main(){
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c);
        float a = smoothstep(0.5, 0.0, d);
        a = a * a;
        gl_FragColor = vec4(vec3(0.45, 0.85, 2.2) * a * vA, 1.0);
      }`,
  });
}

/* ------------------------------------------------------------------ */
/* Build                                                               */
/* ------------------------------------------------------------------ */

export function buildOrbitalCore() {
  const uniforms = {
    uTime: { value: 0 },
    uEnergy: { value: 1 },
    uExplode: { value: 0 },
  };
  const floorUniforms = { uTime: uniforms.uTime, uEnergy: uniforms.uEnergy, uBeat: { value: 0 }, uBeatAge: { value: 0 } };
  const particleUniforms = { uTime: uniforms.uTime, uEnergy: uniforms.uEnergy, uSpeed: { value: 1 }, uPx: { value: 1 } };

  const brushed = brushedTexture();
  const brushedRing = brushed.clone(); brushedRing.repeat.set(3, 1); brushedRing.needsUpdate = true;

  const mat = {
    ringMetal: new THREE.MeshPhysicalMaterial({
      color: 0x303a46, metalness: 1, roughness: 0.27, roughnessMap: brushedRing,
      clearcoat: 0.35, clearcoatRoughness: 0.18, anisotropy: 0.55, envMapIntensity: 1.15,
    }),
    darkMetal: new THREE.MeshPhysicalMaterial({
      color: 0x0b1017, metalness: 1, roughness: 0.42, roughnessMap: brushed,
      anisotropy: 0.35, envMapIntensity: 0.4,
    }),
    satin: new THREE.MeshPhysicalMaterial({ color: 0x0b1017, metalness: 0.6, roughness: 0.55, envMapIntensity: 0.8 }),
    titanium: new THREE.MeshPhysicalMaterial({
      color: 0x9c8466, metalness: 1, roughness: 0.3, roughnessMap: brushed, clearcoat: 0.2, envMapIntensity: 1.2,
    }),
    strut: new THREE.MeshStandardMaterial({ color: 0x3a4654, metalness: 1, roughness: 0.3 }),
    glow: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.18, 0.55, 2.6) }),
    glowSoft: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.1, 0.32, 1.25) }),
    led: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.9, 2.4, 2.8) }),
    ledWarm: new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 1.2, 0.35) }),
  };

  const root = new THREE.Group();
  root.name = 'OrbitalCore';
  const parts = {};

  /* ---------- Energy core ---------- */
  const coreGroup = new THREE.Group();
  coreGroup.position.y = 0.42;
  root.add(coreGroup);
  parts.core = coreGroup;

  const plasma = new THREE.Mesh(new THREE.SphereGeometry(0.5, 96, 64), plasmaMaterial(uniforms));
  plasma.name = 'Plasma_Core';
  coreGroup.add(plasma);

  const corona = new THREE.Mesh(new THREE.SphereGeometry(0.86, 64, 48), haloMaterial(uniforms, { power: 3.2, strength: 1.1 }));
  corona.renderOrder = 2;
  coreGroup.add(corona);
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(1.35, 48, 32), haloMaterial(uniforms, { power: 5.0, strength: 0.3, color: new THREE.Color(0.1, 0.35, 1.2) }));
  atmo.renderOrder = 2;
  coreGroup.add(atmo);

  // Geodesic containment cage (icosphere edges as struts + node caps)
  const cage = new THREE.Group();
  cage.name = 'Containment_Cage';
  coreGroup.add(cage);
  parts.cage = cage;
  {
    const ico = new THREE.IcosahedronGeometry(0.66, 1);
    const p = ico.attributes.position;
    const verts = [], keyOf = (v) => `${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)}`;
    const map = new Map();
    const vid = (i) => {
      const v = new THREE.Vector3().fromBufferAttribute(p, i);
      const k = keyOf(v);
      if (!map.has(k)) { map.set(k, verts.length); verts.push(v); }
      return map.get(k);
    };
    const edges = new Set();
    for (let i = 0; i < p.count; i += 3) {
      const a = vid(i), b = vid(i + 1), c = vid(i + 2);
      [[a, b], [b, c], [c, a]].forEach(([x, y]) => edges.add(x < y ? `${x}_${y}` : `${y}_${x}`));
    }
    const strutGeo = new THREE.CylinderGeometry(0.0075, 0.0075, 1, 6, 1, true);
    const struts = new THREE.InstancedMesh(strutGeo, mat.strut, edges.size);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), s = new THREE.Vector3();
    let k = 0;
    edges.forEach((e) => {
      const [a, b] = e.split('_').map(Number);
      const va = verts[a], vb = verts[b];
      const mid = va.clone().add(vb).multiplyScalar(0.5);
      const dir = vb.clone().sub(va);
      const len = dir.length();
      q.setFromUnitVectors(up, dir.normalize());
      m.compose(mid, q, s.set(1, len, 1));
      struts.setMatrixAt(k++, m);
    });
    struts.castShadow = true;
    cage.add(struts);
    const nodeGeo = new THREE.OctahedronGeometry(0.024, 0);
    const nodes = new THREE.InstancedMesh(nodeGeo, mat.titanium, verts.length);
    verts.forEach((v, i) => {
      q.setFromUnitVectors(up, v.clone().normalize());
      m.compose(v, q, s.set(1, 1.4, 1));
      nodes.setMatrixAt(i, m);
    });
    nodes.castShadow = true;
    cage.add(nodes);
    // 12 pentagon vertices get tiny emitters
    const ledGeo = new THREE.SphereGeometry(0.011, 8, 6);
    const leds = new THREE.InstancedMesh(ledGeo, mat.led, 12);
    const icoBase = new THREE.IcosahedronGeometry(0.69, 0).attributes.position;
    const seen = new Set(); let li = 0;
    for (let i = 0; i < icoBase.count && li < 12; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(icoBase, i);
      const key = keyOf(v);
      if (seen.has(key)) continue;
      seen.add(key);
      m.makeTranslation(v.x, v.y, v.z);
      leds.setMatrixAt(li++, m);
    }
    cage.add(leds);
    ico.dispose();
  }

  const coreLight = new THREE.PointLight(0x3f9bff, 30, 9, 1.6);
  coreLight.castShadow = true;
  coreLight.shadow.mapSize.set(512, 512);
  coreLight.shadow.bias = -0.002;
  coreLight.shadow.normalBias = 0.02;
  coreLight.shadow.radius = 4;
  coreLight.shadow.camera.near = 0.55;
  coreGroup.add(coreLight);
  parts.coreLight = coreLight;

  // Orbiting particle stream
  {
    const N = 720;
    const orbit = new Float32Array(N * 4), misc = new Float32Array(N * 2), pos = new Float32Array(N * 3);
    const planes = [[0.35, 0.2], [1.2, 1.9], [-0.7, 3.6], [1.57, 0.8]];
    for (let i = 0; i < N; i++) {
      const pl = planes[i % planes.length];
      const lane = Math.random();
      orbit[i * 4] = 0.72 + Math.pow(lane, 1.6) * 1.35;
      orbit[i * 4 + 1] = pl[0] + (Math.random() - 0.5) * 0.12;
      orbit[i * 4 + 2] = pl[1] + (Math.random() - 0.5) * 0.12;
      orbit[i * 4 + 3] = Math.random() * Math.PI * 2;
      misc[i * 2] = (0.25 + Math.random() * 0.5) * (i % 2 ? 1 : -1) / (0.6 + orbit[i * 4]);
      misc[i * 2 + 1] = 0.6 + Math.random() * Math.random() * 3.0;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aOrbit', new THREE.BufferAttribute(orbit, 4));
    g.setAttribute('aMisc', new THREE.BufferAttribute(misc, 2));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 2.5);
    const pts = new THREE.Points(g, particleMaterial(particleUniforms));
    pts.renderOrder = 3;
    coreGroup.add(pts);
    parts.particles = pts;
  }

  /* ---------- Gimbal rings ---------- */
  const gimbal = new THREE.Group(); // spins around Y (azimuth α)
  gimbal.name = 'Gimbal';
  coreGroup.add(gimbal);
  parts.gimbal = gimbal;

  function buildRing({ R, halfT, halfW, segments, gap, collarAt, name }) {
    const group = new THREE.Group();
    group.name = name;
    const sec = ringSection(R, halfT, halfW, 0.014, { half: 0.018, depth: 0.018 });
    const segGeos = [];
    const step = (Math.PI * 2) / segments;
    for (let i = 0; i < segments; i++) {
      const a0 = i * step + gap / 2, a1 = (i + 1) * step - gap / 2;
      segGeos.push(sweepProfile(sec, { phi0: a0, phi1: a1, steps: 28, caps: true, uRepeat: 6 }));
    }
    const shell = new THREE.Mesh(mergeGeos(segGeos), mat.ringMetal);
    shell.castShadow = shell.receiveShadow = true;
    group.add(shell);
    // Light rail in the outer channel (continuous => shows through every seam)
    const rail = new THREE.Mesh(
      sweepProfile([[R + halfT - 0.019, -0.006], [R + halfT - 0.012, -0.006], [R + halfT - 0.012, 0.006], [R + halfT - 0.019, 0.006]], { steps: 256 }),
      mat.glow,
    );
    group.add(rail);
    // Inner spine glowing through the seams
    const spine = new THREE.Mesh(
      sweepProfile([[R - halfT * 0.6, -halfW * 0.55], [R + halfT * 0.6, -halfW * 0.55], [R + halfT * 0.6, halfW * 0.55], [R - halfT * 0.6, halfW * 0.55]], { steps: 256 }),
      mat.glowSoft,
    );
    group.add(spine);
    // Machined collars with status LEDs
    const collarSec = ringSection(R, halfT + 0.018, halfW + 0.016, 0.01, null);
    const collarGeos = [];
    const ledGeos = [];
    collarAt.forEach((ang) => {
      collarGeos.push(sweepProfile(collarSec, { phi0: ang - 0.07, phi1: ang + 0.07, steps: 8, caps: true, uRepeat: 6 }));
      [-0.035, 0, 0.035].forEach((o, j) => {
        const b = new THREE.BoxGeometry(0.012, 0.004, 0.012);
        const r = R;
        b.translate(Math.sin(ang + o) * r, halfW + 0.017, Math.cos(ang + o) * r);
        b.userData.warm = j === 1;
        ledGeos.push(b);
      });
    });
    const collars = new THREE.Mesh(mergeGeos(collarGeos), mat.titanium);
    collars.castShadow = true;
    group.add(collars);
    const ledCool = ledGeos.filter((g) => !g.userData.warm).map((g) => g.toNonIndexed());
    const ledWarm = ledGeos.filter((g) => g.userData.warm).map((g) => g.toNonIndexed());
    const mergeSimple = (arr) => {
      const out = new THREE.BufferGeometry();
      const total = arr.reduce((s, g) => s + g.attributes.position.count, 0);
      const pos = new Float32Array(total * 3); let o = 0;
      arr.forEach((g) => { pos.set(g.attributes.position.array, o); o += g.attributes.position.array.length; });
      out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      return out;
    };
    group.add(new THREE.Mesh(mergeSimple(ledCool), mat.led));
    group.add(new THREE.Mesh(mergeSimple(ledWarm), mat.ledWarm));
    return group;
  }

  // Outer ring: vertical, spins with the gimbal around Y.
  const outerPivot = new THREE.Group();
  gimbal.add(outerPivot);
  const outer = buildRing({ R: 1.42, halfT: 0.05, halfW: 0.085, segments: 12, gap: 0.03, collarAt: [Math.PI / 2, -Math.PI / 2, 0, Math.PI], name: 'Ring_Outer' });
  outerPivot.add(outer);
  outerPivot.rotation.x = Math.PI / 2;
  parts.outerPivot = outerPivot;
  parts.outer = outer;

  // Inner ring: pivots about X inside the outer ring (true gimbal), connected by pins.
  const innerPivot = new THREE.Group();
  gimbal.add(innerPivot);
  const inner = buildRing({ R: 1.16, halfT: 0.042, halfW: 0.07, segments: 10, gap: 0.034, collarAt: [Math.PI / 2, -Math.PI / 2], name: 'Ring_Inner' });
  innerPivot.add(inner);
  parts.innerPivot = innerPivot;
  parts.inner = inner;

  // Pivot pins (bridge inner → outer along ±X), stepped shafts in titanium
  {
    const pinProfile = [
      [0, 1.19], [0.03, 1.19], [0.03, 1.24], [0.022, 1.25], [0.022, 1.33], [0.034, 1.34], [0.034, 1.37], [0, 1.37],
    ];
    const pin = sweepProfile(pinProfile.map(([r, y]) => [r, y]), { steps: 20, closed: false });
    const pinGeoA = pin.clone().rotateZ(-Math.PI / 2);
    const pinGeoB = pin.clone().rotateZ(Math.PI / 2);
    const pins = new THREE.Mesh(mergeGeos([pinGeoA, pinGeoB]), mat.titanium);
    pins.castShadow = true;
    innerPivot.add(pins);
    // glowing bearing band on each shaft
    const band = sweepProfile([[0.023, 1.285], [0.026, 1.285], [0.026, 1.3], [0.023, 1.3]], { steps: 20 });
    const bands = new THREE.Mesh(mergeGeos([band.clone().rotateZ(-Math.PI / 2), band.clone().rotateZ(Math.PI / 2)]), mat.led);
    innerPivot.add(bands);
    band.dispose();
    pin.dispose();
  }

  /* ---------- Pedestal ---------- */
  const pedestal = new THREE.Group();
  pedestal.name = 'Pedestal';
  pedestal.position.y = -1.52;
  root.add(pedestal);
  parts.pedestal = pedestal;
  {
    const prof = [
      [0.0, -0.2], [1.72, -0.2], [1.8, -0.16], [1.82, -0.1], [1.82, -0.02], [1.78, 0.02], [1.6, 0.02], [1.6, 0.07],
      [1.55, 0.12], [1.13, 0.12], [1.13, 0.095], [1.02, 0.095], [1.02, 0.12], [0.56, 0.12], [0.5, 0.17], [0.4, 0.2],
      [0.34, 0.2], [0.33, 0.16], [0.0, 0.16],
    ];
    // sweep the open profile (no caps needed, it's closed around the axis)
    const body = new THREE.Mesh(sweepProfile(prof, { steps: 160, closed: false, uRepeat: 1 }), mat.darkMetal);
    body.castShadow = body.receiveShadow = true;
    pedestal.add(body);

    // Groove light ring
    const groove = new THREE.Mesh(sweepProfile([[1.035, 0.096], [1.115, 0.096], [1.115, 0.102], [1.035, 0.102]], { steps: 200 }), mat.glow);
    pedestal.add(groove);

    // Emitter lens
    // Emitter lens: fresnel-grooved disc (concentric steps) rather than a flat blob
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.33, 64), new THREE.ShaderMaterial({
      uniforms: { uTime: uniforms.uTime, uEnergy: uniforms.uEnergy, color: { value: new THREE.Color(0.25, 0.7, 2.2) } },
      vertexShader: 'varying vec2 vP; void main(){ vP = position.xy / 0.33; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform float uTime; uniform float uEnergy; uniform vec3 color; varying vec2 vP;
        void main(){
          float r = length(vP);
          float grooves = 0.55 + 0.45 * smoothstep(0.0, 0.18, fract(r * 9.0 - uTime * 0.6));
          float center = exp(-r * r * 12.0) * 0.9;
          float rim = smoothstep(0.86, 0.95, r) * smoothstep(1.0, 0.95, r) * 1.6;
          vec3 c = color * (0.25 + grooves * 0.45 * (1.0 - r * 0.6) + center + rim) * (0.35 + 0.7 * uEnergy);
          gl_FragColor = vec4(c, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }));
    lens.rotation.x = -Math.PI / 2;
    lens.position.y = 0.162;
    pedestal.add(lens);
    parts.lens = lens;

    // Engraved dial
    const dial = new THREE.Mesh(
      new THREE.RingGeometry(0.58, 1.0, 128, 1),
      new THREE.MeshBasicMaterial({ map: dialTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: new THREE.Color(0.22, 0.55, 1.05) }),
    );
    // Remap ring UVs to planar so the square canvas maps correctly
    {
      const p = dial.geometry.attributes.position, uv = dial.geometry.attributes.uv;
      for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 2 + 0.5, p.getY(i) / 2 + 0.5);
    }
    dial.rotation.x = -Math.PI / 2;
    dial.position.y = 0.1225;
    pedestal.add(dial);
    parts.dial = dial;

    // Side fins: machined cooling ribs around the plinth
    const finGeo = new THREE.BoxGeometry(0.035, 0.1, 0.07);
    const fins = new THREE.InstancedMesh(finGeo, mat.satin, 72);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), v = new THREE.Vector3();
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * Math.PI * 2;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), a);
      v.set(Math.sin(a) * 1.83, -0.1, Math.cos(a) * 1.83);
      m.compose(v, q, s);
      fins.setMatrixAt(i, m);
    }
    fins.castShadow = fins.receiveShadow = true;
    pedestal.add(fins);

    // Status slits on the step face
    const slitGeo = new THREE.BoxGeometry(0.06, 0.012, 0.006);
    const slits = new THREE.InstancedMesh(slitGeo, mat.glowSoft, 24);
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2 + 0.07;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), a);
      v.set(Math.sin(a) * 1.601, 0.045, Math.cos(a) * 1.601);
      m.compose(v, q, s);
      slits.setMatrixAt(i, m);
    }
    pedestal.add(slits);

    // Levitation beam from lens to core
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.3, 1.5, 48, 1, true), beamMaterial(uniforms));
    beam.position.y = 0.16 + 0.75;
    beam.renderOrder = 1;
    pedestal.add(beam);
    parts.beam = beam;
  }

  /* ---------- Stage / floor ---------- */
  const stage = new THREE.Group();
  root.add(stage);
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(160, 96).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x0a121d, metalness: 0.35, roughness: 0.62, envMapIntensity: 0.25 }),
  );
  floor.position.y = -1.72;
  stage.add(floor);
  // soft contact shadow (baked-AO style) under the plinth
  {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(128, 128, 40, 128, 128, 128);
    grd.addColorStop(0, 'rgba(0,0,0,0.95)');
    grd.addColorStop(0.62, 'rgba(0,0,0,0.75)');
    grd.addColorStop(0.78, 'rgba(0,0,0,0.3)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 256, 256);
    const ao = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 5.2).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
    ao.position.y = -1.718;
    ao.renderOrder = 0;
    stage.add(ao);
  }
  // shader reads local position.xy, so keep the plane in XY and rotate the mesh
  const floorFx = new THREE.Mesh(new THREE.PlaneGeometry(22, 22), floorFxMaterial(floorUniforms));
  floorFx.rotation.x = -Math.PI / 2;
  floorFx.position.y = -1.716;
  floorFx.renderOrder = 1;
  stage.add(floorFx);
  parts.floorFx = floorFx;

  return { root, parts, uniforms, floorUniforms, particleUniforms, materials: mat };
}
