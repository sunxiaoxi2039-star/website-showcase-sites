// Water: GPU heightfield ripples, tileable caustics, a baked pond floor and shore,
// a drifting leaf canopy (dappled light) and the refraction / reflection composite with colour grading.
import * as THREE from 'three';

export function createShared() {
  return {
    uTime: { value: 0 },
    uHalf: { value: new THREE.Vector2(6, 4) },
    uPond: { value: new THREE.Vector2(5.5, 3.5) },
    uPondR: { value: 1.5 },
    uSunDir: { value: new THREE.Vector3(0.3, 0.9, -0.33).normalize() },
    uHeight: { value: null },
    uSimTexel: { value: new THREE.Vector2(1 / 256, 1 / 256) },
    uCaustic: { value: null },
    uCanopyTex: { value: null },
    uFloorA: { value: null },
    uFloorB: { value: null },
    uRimTex: { value: null },
    uRain: { value: 0 },
    uCalm: { value: 0 },
    uWhirl: { value: new THREE.Vector4(0, 0, 0, 1.3) },
    uPads: { value: Array.from({ length: 5 }, () => new THREE.Vector4(99, 99, 0.01, 0)) },
  };
}

export const COMMON = /* glsl */`
uniform vec2 uHalf;
uniform vec2 uPond;
uniform float uPondR;
uniform float uTime;
float hash12(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
vec2 hash22(vec2 p){ return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453123); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f*f*(3.0 - 2.0*f);
  float a = hash12(i), b = hash12(i + vec2(1.0, 0.0));
  float c = hash12(i + vec2(0.0, 1.0)), d = hash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 p){
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++){ s += a*vnoise(p); p = p*2.03 + vec2(1.7, 9.2); a *= 0.5; }
  return s;
}
float sdRoundBox(vec2 p, vec2 b, float r){
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}
float pondSDF(vec2 w){ return sdRoundBox(w, uPond, uPondR) + (vnoise(w*1.15 + 3.7) - 0.5)*0.16; }
vec2 worldToUv(vec2 w){ return vec2(w.x/(2.0*uHalf.x) + 0.5, 0.5 - w.y/(2.0*uHalf.y)); }
vec2 uvToWorld(vec2 uv){ return vec2((uv.x - 0.5)*2.0*uHalf.x, (0.5 - uv.y)*2.0*uHalf.y); }
// voronoi: x nearest distance, y edge distance, z cell id hash
vec3 voro(vec2 p){
  vec2 i = floor(p), f = fract(p);
  float d1 = 8.0, d2 = 8.0; vec2 best = vec2(0.0);
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++){
    vec2 g = vec2(float(x), float(y));
    vec2 o = 0.15 + 0.7*hash22(i + g);
    float d = length(g + o - f);
    if (d < d1){ d2 = d1; d1 = d; best = i + g; } else if (d < d2){ d2 = d; }
  }
  return vec3(d1, d2 - d1, hash12(best + 0.37));
}
// the two caustic layers are stored in r/g; combine them into one light value
float causC(vec2 t){ return min((t.x*0.55 + t.y*0.45 + t.x*t.y*1.6)*0.62, 1.15); }
`;

// dappled canopy shade, drawn every frame into a small texture
export const CANOPY = /* glsl */`
uniform sampler2D uCanopyTex;
float canopy(vec2 w){ return texture2D(uCanopyTex, worldToUv(w)).r; }
`;

const QUAD_VS = /* glsl */`
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const STEP_FS = /* glsl */`
uniform sampler2D uTex;
uniform vec2 uTexel;
uniform float uDamp;
varying vec2 vUv;
void main(){
  vec4 c = texture2D(uTex, vUv);
  vec4 l = texture2D(uTex, vUv - vec2(uTexel.x, 0.0));
  vec4 r = texture2D(uTex, vUv + vec2(uTexel.x, 0.0));
  vec4 d = texture2D(uTex, vUv - vec2(0.0, uTexel.y));
  vec4 u = texture2D(uTex, vUv + vec2(0.0, uTexel.y));
  float sum = l.r + r.r + d.r + u.r;
  float next = 0.2*c.r + 0.45*sum - c.g;
  next *= uDamp;
  float foam = (c.b*4.0 + l.b + r.b + d.b + u.b)/8.0;
  foam = max(foam*0.984 - 0.0024, 0.0);
  float wall = smoothstep(0.05, -0.08, pondSDF(uvToWorld(vUv)));
  gl_FragColor = vec4(next*wall, c.r*wall, foam*wall, 1.0);
}
`;

const DROP_FS = /* glsl */`
uniform sampler2D uTex;
uniform vec4 uDrops[16];
uniform vec4 uDropsB[16];
uniform int uCount;
varying vec2 vUv;
void main(){
  vec4 c = texture2D(uTex, vUv);
  vec2 w = uvToWorld(vUv);
  for (int i = 0; i < 16; i++){
    if (i >= uCount) break;
    vec4 d = uDrops[i];
    float r = length(w - d.xy)/d.z;
    if (r < 1.0){
      float k = 0.5 + 0.5*cos(r*3.14159265);
      c.r += k*d.w;
      c.b += k*uDropsB[i].x;
    }
  }
  c.b = min(c.b, 1.4);
  gl_FragColor = c;
}
`;

const CLEAR_FS = /* glsl */`
varying vec2 vUv;
void main(){ gl_FragColor = vec4(0.0); }
`;

// two tileable voronoi-edge layers (r, g); dispersion is done when sampling
const CAUSTIC_FS = /* glsl */`
varying vec2 vUv;
float cLayer(vec2 uv, float N, float t, float seed){
  vec2 p = uv*N;
  vec2 i = floor(p), f = fract(p);
  float d1 = 8.0, d2 = 8.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++){
    vec2 g = vec2(float(x), float(y));
    vec2 id = mod(i + g, N);
    vec2 h = hash22(id + seed);
    vec2 o = 0.5 + 0.42*sin(t*(0.5 + 0.5*h.yx) + 6.2831853*h);
    float d = length(g + o - f);
    if (d < d1){ d2 = d1; d1 = d; } else if (d < d2){ d2 = d; }
  }
  float e = d2 - d1;
  return pow(clamp(1.0 - e*1.75, 0.0, 1.0), 6.5);
}
void main(){
  float t = uTime*0.85;
  vec2 uv = fract(vUv);
  vec2 wv = uv + 0.03*vec2(sin(6.2831853*(uv.y*2.0) + t*0.8), cos(6.2831853*(uv.x*3.0) - t*0.7));
  float a = cLayer(wv, 5.0, t, 0.0);
  float b = cLayer(wv + vec2(0.31, 0.17), 7.0, t*1.21, 17.0);
  gl_FragColor = vec4(a, b, 0.0, 1.0);
}
`;

// leaf canopy over two corners of the pond; its shade drifts and has small sun flecks
const CANOPY_FS = /* glsl */`
varying vec2 vUv;
void main(){
  vec2 w = uvToWorld(vUv);
  vec2 drift = vec2(uTime*0.011, -uTime*0.007);
  float n = fbm(w*0.2 + drift + 4.0);
  vec2 c1 = vec2(-uHalf.x - 0.6, -uHalf.y - 0.6), c2 = vec2(uHalf.x + 0.8, uHalf.y + 0.4);
  float near = max(smoothstep(6.8, 1.5, length(w - c1)), 0.8*smoothstep(5.2, 1.2, length(w - c2)));
  float cover = smoothstep(0.52, 0.72, n + near*0.42 - 0.12);
  float sway = sin(uTime*0.6 + w.x*0.7)*0.05;
  float holes = smoothstep(0.62, 0.8, vnoise(w*2.6 + drift*3.0 + vec2(sway, -sway)) + 0.25*vnoise(w*6.1 - drift*2.0));
  gl_FragColor = vec4(cover*(1.0 - 0.7*holes), 0.0, 0.0, 1.0);
}
`;

// nearest voronoi site: xy offset from the pixel to the site centre, z edge distance, w id hash
const VORO2 = /* glsl */`
vec4 voro2(vec2 p, float jitter){
  vec2 i = floor(p), f = fract(p);
  float d1 = 8.0, d2 = 8.0; vec2 best = vec2(0.0), off = vec2(0.0);
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++){
    vec2 g = vec2(float(x), float(y));
    vec2 o = 0.5 + jitter*(hash22(i + g) - 0.5);
    vec2 r = g + o - f;
    float d = length(r);
    if (d < d1){ d2 = d1; d1 = d; best = i + g; off = r; } else if (d < d2){ d2 = d; }
  }
  return vec4(off, d2 - d1, hash12(best + 0.37));
}
`;

// static floor: albedo, ambient occlusion, depth absorption and the static shade, baked on resize
const FLOOR_BAKE_FS = /* glsl */`
uniform vec3 uSunDir;
uniform vec4 uPads[5];
uniform float uMode;
varying vec2 vUv;
${VORO2}
vec3 pebbleColor(float h){
  vec3 c = vec3(0.72, 0.70, 0.66);
  c = mix(c, vec3(0.52, 0.49, 0.46), step(0.18, h));
  c = mix(c, vec3(0.83, 0.66, 0.50), step(0.40, h));
  c = mix(c, vec3(0.92, 0.90, 0.86), step(0.58, h));
  c = mix(c, vec3(0.40, 0.43, 0.45), step(0.76, h));
  c = mix(c, vec3(0.70, 0.55, 0.44), step(0.88, h));
  return c;
}
float padShadow(vec2 w){
  float m = 0.0;
  for (int i = 0; i < 5; i++){
    vec4 p = uPads[i];
    float d = length(w - p.xy) - p.z;
    m = max(m, smoothstep(0.18, -0.16, d));
  }
  return m;
}
// a few fallen leaves resting on the sand
vec4 leaves(vec2 w){
  vec2 p = w*0.9;
  vec2 i = floor(p);
  vec4 res = vec4(0.0);
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++){
    vec2 id = i + vec2(float(x), float(y));
    float h = hash12(id + 5.1);
    if (h > 0.22) continue;
    vec2 c = id + 0.2 + 0.6*hash22(id + 2.3);
    float ang = hash12(id + 9.7)*6.2831853;
    float len = 0.13 + 0.09*hash12(id + 1.3);
    vec2 d = (p - c)/0.9;
    d = vec2(cos(ang)*d.x + sin(ang)*d.y, -sin(ang)*d.x + cos(ang)*d.y);
    float u = d.x/len;
    float bend = 0.18*u*u;
    float hw = 0.42*len*(1.0 - u*u);
    float m = smoothstep(0.004, -0.004, abs(d.y - bend*len) - hw)*step(abs(u), 1.0);
    float stem = smoothstep(0.006, 0.0, abs(d.y - bend*len))*step(u, -0.9)*step(-1.25, u);
    m = max(m, stem);
    if (m > res.a){
      float k = hash12(id + 4.4);
      vec3 col = mix(vec3(0.55, 0.32, 0.12), vec3(0.42, 0.40, 0.14), k);
      col = mix(col, vec3(0.66, 0.46, 0.18), step(0.7, k));
      col *= 0.85 + 0.25*smoothstep(0.0, 0.8, abs(d.y - bend*len)/max(hw, 1e-3));
      col *= 1.0 - 0.3*smoothstep(0.012, 0.0, abs(d.y - bend*len));
      res = vec4(col, m);
    }
  }
  return res;
}
void main(){
  vec2 w = uvToWorld(vUv);
  float sd = pondSDF(w);
  float depth = mix(0.28, 1.9, smoothstep(0.0, 2.6, -sd)) + (fbm(w*0.42 + 7.0) - 0.5)*0.42;
  depth = max(depth, 0.18);
  vec3 absorb = exp(-depth*vec3(0.9, 0.24, 0.17));
  float fog = 1.0 - exp(-depth*0.52);
  if (uMode > 0.5){
    vec3 scatter = mix(vec3(0.08, 0.47, 0.46), vec3(0.02, 0.25, 0.35), smoothstep(0.4, 2.0, depth));
    gl_FragColor = vec4(scatter*fog, clamp(depth/2.5, 0.0, 1.0));
    return;
  }
  // under the stones of the shore nothing is ever seen
  if (sd > 0.45){ gl_FragColor = vec4(vec3(0.2, 0.22, 0.18)*absorb*(1.0 - fog), 1.0); return; }
  float edgeZone = smoothstep(-1.4, -0.2, sd);
  vec3 L = uSunDir;

  // sand with soft ripple marks
  float grain = vnoise(w*42.0)*0.5 + vnoise(w*13.0)*0.5;
  float warp = fbm(w*0.7)*5.0;
  float marks = sin(w.x*6.0 + w.y*2.4 + warp);
  float mdx = cos(w.x*6.0 + w.y*2.4 + warp);
  vec3 sand = vec3(0.86, 0.80, 0.66)*(0.88 + 0.16*grain);
  sand *= 1.0 + 0.05*marks + 0.04*mdx*sign(L.x);
  sand = mix(sand, vec3(0.74, 0.72, 0.62), smoothstep(0.45, 0.8, fbm(w*1.3 + 21.0))*0.35);

  // fine gravel in drifts
  vec4 gv = voro2(w*8.5, 0.85);
  float gdens = smoothstep(0.42, 0.66, fbm(w*0.6 + 11.0) + edgeZone*0.3);
  float gHas = step(gv.w, 0.18 + 0.72*gdens);
  float gr = length(gv.xy);
  float gm = smoothstep(0.42, 0.3, gr)*gHas;
  vec3 gn = normalize(vec3(-gv.x*1.6, 1.0, -gv.y*1.6));
  vec3 gc = pebbleColor(fract(gv.w*7.13))*(0.72 + 0.4*max(dot(gn, L), 0.0))*(0.92 + 0.12*vnoise(w*40.0));
  vec3 alb = mix(sand, gc, gm);
  alb *= 1.0 - 0.22*gHas*smoothstep(0.5, 0.36, gr)*(1.0 - gm);

  // rounded stones, denser toward the shore
  vec4 sv = voro2(w*2.7 + 5.3, 0.75);
  float sr = length(sv.xy);
  float sHas = step(sv.w, 0.08 + 0.62*edgeZone);
  float srad = 0.3 + 0.12*fract(sv.w*13.1);
  float sm = smoothstep(srad, srad - 0.05, sr)*sHas;
  vec3 sn = normalize(vec3(-sv.x/srad*1.3, 1.0, -sv.y/srad*1.3));
  vec3 scol = mix(vec3(0.46, 0.47, 0.45), vec3(0.68, 0.63, 0.55), fract(sv.w*5.7));
  scol *= 0.66 + 0.45*max(dot(sn, L), 0.0);
  scol *= 0.92 + 0.14*vnoise(w*18.0 + sv.w*40.0);
  alb *= 1.0 - 0.35*sHas*smoothstep(srad + 0.12, srad, sr)*(1.0 - sm);
  alb = mix(alb, scol, sm);

  // leaves, algae and silt
  vec4 lf = leaves(w + 13.0);
  alb = mix(alb, lf.rgb, lf.a*0.92);
  float algae = smoothstep(0.5, 0.82, fbm(w*0.85 + 3.3))*(0.3 + 0.7*edgeZone);
  alb = mix(alb, alb*vec3(0.5, 0.68, 0.42), algae*0.7);
  float silt = smoothstep(0.55, 0.85, fbm(w*0.35 + 40.0))*smoothstep(-0.8, -2.2, sd);
  alb = mix(alb, alb*vec3(0.78, 0.8, 0.74), silt*0.5);

  // static shade: shore overhang and lily pads
  vec2 sunShift = L.xz/L.y;
  float rimSh = smoothstep(-0.1, 0.08, pondSDF(w + sunShift*depth*0.45));
  float padSh = padShadow(w + sunShift*(depth + 0.05));
  float shade = clamp(max(rimSh, padSh*0.8), 0.0, 1.0);

  gl_FragColor = vec4(alb*absorb*(1.0 - fog), shade);
}
`;

// static shore: stones with rounded tops, wet band, moss in the gaps, lush ground cover; baked on resize
const RIM_BAKE_FS = /* glsl */`
uniform vec3 uSunDir;
varying vec2 vUv;
${VORO2}
void main(){
  vec2 w = uvToWorld(vUv);
  float sd = pondSDF(w);
  // the open water never shows the shore texture
  if (sd < -0.12){ gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
  vec3 L = uSunDir;
  vec4 v = voro2(w*1.75 + 2.0, 0.8);
  float r = length(v.xy);
  float gap = smoothstep(0.02, 0.1, v.z);
  vec3 n = normalize(vec3(-v.x*1.5, 1.0, -v.y*1.5));
  float id = v.w;
  vec3 stone = mix(vec3(0.58, 0.56, 0.52), vec3(0.76, 0.71, 0.62), id);
  stone = mix(stone, vec3(0.5, 0.53, 0.54), step(0.8, id));
  stone *= 0.9 + 0.16*vnoise(w*9.0 + id*20.0) + 0.06*(vnoise(w*55.0) - 0.5);
  float lit = 0.55 + 0.6*max(dot(n, L), 0.0);
  stone *= lit;
  stone += vec3(1.0, 0.95, 0.85)*pow(max(dot(reflect(vec3(0.0, -1.0, 0.0), n), L), 0.0), 18.0)*0.06;
  float lichen = smoothstep(0.62, 0.8, vnoise(w*6.0 + id*9.0))*0.5;
  stone = mix(stone, stone*vec3(0.78, 0.86, 0.6), lichen);
  vec3 moss = mix(vec3(0.12, 0.2, 0.08), vec3(0.24, 0.33, 0.12), vnoise(w*8.0))*(0.75 + 0.5*vnoise(w*30.0));
  vec3 c = mix(moss, stone, gap);
  // wet stone near the waterline
  c *= mix(0.55, 1.0, smoothstep(0.0, 0.22, sd));
  c = mix(c, c*vec3(0.8, 0.88, 0.86), smoothstep(0.12, 0.0, sd)*0.5);

  // ground cover beyond the stones
  float rimW = 0.4;
  float gm = smoothstep(rimW, rimW + 0.08, sd + (vnoise(w*3.0) - 0.5)*0.18);
  float big = fbm(w*1.6);
  vec3 grass = mix(vec3(0.07, 0.16, 0.06), vec3(0.2, 0.33, 0.1), big);
  grass = mix(grass, vec3(0.3, 0.38, 0.12), smoothstep(0.6, 0.85, fbm(w*0.7 + 8.0))*0.6);
  float a1 = vnoise(w*2.0)*6.28;
  vec2 bd = vec2(cos(a1), sin(a1));
  float blade = vnoise(vec2(dot(w, bd)*55.0, dot(w, vec2(-bd.y, bd.x))*9.0));
  float blade2 = vnoise(vec2(dot(w, bd.yx)*70.0, dot(w, bd)*12.0));
  grass *= 0.72 + 0.34*blade + 0.18*blade2;
  // clover-like leaves catching light
  vec4 cl = voro2(w*9.0, 0.9);
  float leaf = smoothstep(0.26, 0.18, length(cl.xy))*step(0.55, cl.w);
  grass = mix(grass, grass*1.35 + vec3(0.02, 0.04, 0.0), leaf*0.6);
  c = mix(c, grass, gm);
  c *= 1.0 - 0.3*smoothstep(0.14, 0.0, abs(sd - rimW - 0.04))*gm;
  c *= vec3(1.05, 1.0, 0.92);
  gl_FragColor = vec4(c, 1.0);
}
`;

const FLOOR_VS = /* glsl */`
varying vec2 vW;
void main(){
  vec4 wp = modelMatrix*vec4(position, 1.0);
  vW = wp.xz;
  gl_Position = projectionMatrix*viewMatrix*wp;
}
`;

const FLOOR_FS = /* glsl */`
uniform sampler2D uCaustic;
uniform sampler2D uHeight;
uniform sampler2D uFloorA;
uniform sampler2D uFloorB;
uniform vec2 uSimTexel;
uniform float uRain;
varying vec2 vW;
void main(){
  vec2 w = vW;
  vec2 suv = worldToUv(w);
  vec4 A = texture2D(uFloorA, suv);
  vec4 B = texture2D(uFloorB, suv);
  float depth = B.a*2.5;

  float hC = texture2D(uHeight, suv).r;
  float hL = texture2D(uHeight, suv - vec2(uSimTexel.x, 0.0)).r;
  float hR = texture2D(uHeight, suv + vec2(uSimTexel.x, 0.0)).r;
  float hD = texture2D(uHeight, suv - vec2(0.0, uSimTexel.y)).r;
  float hU = texture2D(uHeight, suv + vec2(0.0, uSimTexel.y)).r;
  vec2 grad = vec2(hR - hL, hD - hU);
  float lap = hL + hR + hD + hU - 4.0*hC;

  vec2 u1 = w/3.4 + grad*1.4, u2 = w/5.6 + vec2(0.37, 0.61) - grad*0.9;
  vec2 dsp = vec2(0.0034, 0.0022)*(0.7 + depth*0.5);
  vec3 caus;
  caus.r = causC(texture2D(uCaustic, u1 + dsp).rg)*0.75 + causC(texture2D(uCaustic, u2 + dsp).rg)*0.6;
  caus.g = causC(texture2D(uCaustic, u1).rg)*0.75 + causC(texture2D(uCaustic, u2).rg)*0.6;
  caus.b = causC(texture2D(uCaustic, u1 - dsp).rg)*0.75 + causC(texture2D(uCaustic, u2 - dsp).rg)*0.6;
  caus = caus*caus*1.3;
  caus = mix(caus, vec3(0.22), smoothstep(0.4, 2.3, depth)*0.4);

  float sunAmt = 1.0 - uRain*0.7;
  float can = canopy(w);
  float shade = clamp(max(A.a, can*0.78), 0.0, 1.0);
  float direct = sunAmt*(1.0 - shade);
  float focus = clamp(-lap*30.0, -0.35, 1.2);
  vec3 light = vec3(0.36, 0.39, 0.41) + direct*(vec3(0.42) + caus*1.85 + focus);
  light *= vec3(1.06, 1.0, 0.9);
  vec3 col = A.rgb*light + B.rgb*(0.78 + 0.22*sunAmt);
  gl_FragColor = vec4(col, 1.0);
}
`;

const COMP_FS = /* glsl */`
uniform sampler2D uUnder;
uniform sampler2D uHeight;
uniform sampler2D uFloorB;
uniform sampler2D uRimTex;
uniform vec2 uSimTexel;
uniform vec3 uSunDir;
uniform float uRain;
uniform float uCalm;
uniform vec4 uWhirl;
uniform vec4 uPads[5];
uniform vec2 uRes;
varying vec2 vUv;

vec2 microGrad(vec2 p, float t){
  vec2 g = vec2(0.0);
  for (int i = 0; i < 7; i++){
    float fi = float(i);
    float a = fi*2.39996 + 0.6;
    vec2 dir = vec2(cos(a), sin(a));
    float k = 2.6 + fi*1.9;
    float spd = sqrt(9.8*k)*0.32;
    float amp = 0.024/(1.0 + fi*0.55);
    g += dir*(k*amp)*cos(dot(dir, p)*k - t*spd + fi*1.7);
  }
  float e = 0.05;
  vec2 q = p*5.0 + t*0.35;
  float n0 = vnoise(q);
  g += vec2(vnoise(q + vec2(e, 0.0)) - n0, vnoise(q + vec2(0.0, e)) - n0)/e*0.011;
  return g;
}

vec4 lily(vec2 w, vec4 P, float idx){
  vec2 d = w - P.xy;
  float r = length(d);
  if (r > P.z*1.08) return vec4(0.0);
  float rot = P.w + 0.07*sin(uTime*0.22 + idx*1.9);
  float a = atan(d.y, d.x) - rot;
  a = mod(a + 3.14159265, 6.2831853) - 3.14159265;
  float rn = r/P.z;
  float edge = P.z*(1.0 + 0.018*sin(a*9.0 + idx*3.0));
  float body = smoothstep(edge, edge - 0.018, r);
  float notch = max(smoothstep(0.1, 0.17, abs(a)), step(rn, 0.07));
  float m = body*notch;
  vec3 base = mix(vec3(0.1, 0.3, 0.1), vec3(0.3, 0.52, 0.17), smoothstep(0.0, 1.0, rn));
  base = mix(base, vec3(0.5, 0.24, 0.16), smoothstep(0.86, 1.0, rn)*0.55);
  float veins = pow(abs(cos(a*8.0 + idx)), 30.0)*smoothstep(0.08, 0.8, rn);
  base += veins*vec3(0.05, 0.08, 0.03);
  base *= 0.88 + 0.22*vnoise(w*16.0 + idx*7.0);
  vec3 n = normalize(vec3(-d.x/P.z*0.45, 1.0, -d.y/P.z*0.45));
  base *= 0.78 + 0.35*max(dot(n, uSunDir), 0.0);
  base += vec3(0.9, 0.95, 0.85)*pow(max(dot(reflect(vec3(0.0, -1.0, 0.0), n), uSunDir), 0.0), 40.0)*0.22;
  vec3 vv = voro(w*14.0 + idx*3.0);
  float drop = smoothstep(0.1, 0.05, vv.x)*step(0.9, vv.z);
  base = mix(base, base*1.4 + 0.1, drop*0.7);
  return vec4(base, m);
}

vec4 lotus(vec2 w, vec2 c, float s, float seed){
  vec2 d = (w - c)/s;
  float r = length(d);
  if (r > 1.1) return vec4(0.0);
  float a = atan(d.y, d.x) + seed + 0.1*sin(uTime*0.3 + seed);
  float p1 = pow(abs(cos(a*4.0)), 0.8);
  float p2 = pow(abs(cos(a*4.0 + 0.785)), 0.8);
  float outer = smoothstep(0.03, -0.03, r - (0.45 + 0.55*p1));
  float inner = smoothstep(0.03, -0.03, r - 0.72*(0.45 + 0.55*p2));
  float core = smoothstep(0.2, 0.16, r);
  vec3 col = mix(vec3(1.0, 0.93, 0.95), vec3(0.93, 0.5, 0.66), smoothstep(0.35, 1.0, r))*(0.82 + 0.18*p1);
  vec3 cin = mix(vec3(1.0, 0.97, 0.97), vec3(0.97, 0.7, 0.8), smoothstep(0.2, 0.75, r))*(0.9 + 0.1*p2);
  col = mix(col, cin, inner);
  col = mix(col, vec3(1.0, 0.8, 0.25)*(0.85 + 0.3*vnoise(d*30.0)), core);
  col *= 0.85 + 0.15*smoothstep(0.0, 0.3, r);
  return vec4(col, max(outer, inner));
}

vec3 aces(vec3 x){ return clamp((x*(2.51*x + 0.03))/(x*(2.43*x + 0.59) + 0.14), 0.0, 1.0); }

vec3 finish(vec3 col){
  vec2 q = (vUv - 0.5)*vec2(uRes.x/uRes.y, 1.0);
  // warm sunlight from the top right, cool deep corners
  float sunGlow = exp(-length((vUv - vec2(0.95, 1.02))*vec2(uRes.x/uRes.y, 1.0))*1.6);
  col += vec3(1.0, 0.86, 0.62)*0.07*sunGlow*(1.0 - uRain);
  col *= mix(vec3(0.8, 0.88, 0.92), vec3(1.0), smoothstep(1.3, 0.35, length(q)));
  col = aces(col*0.92);
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(col, col*vec3(0.94, 1.01, 1.05), smoothstep(0.45, 0.05, l)*0.6);
  col = mix(col, col*vec3(1.04, 1.01, 0.95), smoothstep(0.45, 0.95, l)*0.6);
  col = mix(vec3(l), col, 1.12 - 0.18*uRain);
  col += (hash12(gl_FragCoord.xy + fract(uTime*7.0)*91.0) - 0.5)/255.0;
  return col;
}

void main(){
  vec2 w = uvToWorld(vUv);
  float sd = pondSDF(w);
  float can = canopy(w);
  vec3 rim = texture2D(uRimTex, vUv).rgb;
  rim *= mix(1.0 - uRain*0.28, 0.6, can*0.85);
  rim += vec3(1.0, 0.9, 0.7)*0.05*(1.0 - can)*(1.0 - uRain);
  if (sd > 0.06){ gl_FragColor = vec4(finish(rim), 1.0); return; }

  vec4 hc = texture2D(uHeight, vUv);
  float hL = texture2D(uHeight, vUv - vec2(uSimTexel.x, 0.0)).r;
  float hR = texture2D(uHeight, vUv + vec2(uSimTexel.x, 0.0)).r;
  float hD = texture2D(uHeight, vUv - vec2(0.0, uSimTexel.y)).r;
  float hU = texture2D(uHeight, vUv + vec2(0.0, uSimTexel.y)).r;
  vec2 grad = vec2(hR - hL, hD - hU)*7.0;
  // soft limit: splashes and raindrops make very steep slopes; bend the view below, never shred it
  grad /= 1.0 + 0.45*length(grad);
  float foam = hc.b;

  float mAmp = (1.0 - 0.75*uCalm)*(1.0 + 0.5*uRain);
  vec2 G = grad + microGrad(w, uTime)*mAmp;

  // whirlpool: funnel slope, spiral flow and a twist of what lies below
  vec2 rv = w - uWhirl.xy;
  float rl = length(rv);
  float S = uWhirl.z, R = uWhirl.w;
  float spiral = 0.0, ew = 0.0;
  vec2 wT = w;
  if (S > 0.002){
    vec2 rn = rv/max(rl, 1e-3);
    vec2 tn = vec2(-rn.y, rn.x);
    ew = exp(-rl*rl/(R*R)*1.4);
    float ang = atan(rv.y, rv.x);
    float sph = ang*3.0 + log(rl + 0.05)*5.5 - uTime*(1.4 + 1.6*S);
    spiral = sin(sph);
    G += rn*(S*1.6*rl/(R*R)*ew) + tn*(cos(sph)*0.22*S*ew);
    float tw = S*1.9*exp(-rl/(R*0.8));
    float ct = cos(tw), st = sin(tw);
    vec2 rvT = vec2(ct*rv.x - st*rv.y, st*rv.x + ct*rv.y);
    wT = uWhirl.xy + rvT*(1.0 - 0.28*S*ew);
  }
  // refraction offset saturates with slope; only the wave part is dispersed (not the whirlpool twist)
  vec2 uvT = worldToUv(wT);
  vec2 dsp = worldToUv(wT - G/(1.0 + 0.9*length(G))*0.22) - uvT;
  vec3 under;
  under.r = texture2D(uUnder, uvT + dsp*1.05).r;
  under.g = texture2D(uUnder, uvT + dsp).g;
  under.b = texture2D(uUnder, uvT + dsp*0.95).b;

  // soft sun shafts drifting through the water column, stronger over deep water
  float depth = texture2D(uFloorB, uvT + dsp).a*2.5;
  vec2 sp = normalize(vec2(-uSunDir.z, uSunDir.x));
  float shaft = vnoise(vec2(dot(w, sp)*1.6 + uTime*0.05, dot(w, uSunDir.xz)*0.25 - uTime*0.02));
  shaft = smoothstep(0.45, 0.95, shaft)*smoothstep(0.3, 1.6, depth);
  float sunVis = (1.0 - uRain*0.8)*(1.0 - can*0.85);
  under += vec3(0.55, 0.9, 0.85)*shaft*0.07*sunVis;

  vec2 Gn = G/(1.0 + 0.5*length(G));
  vec3 N = normalize(vec3(-Gn.x, 1.0, -Gn.y));
  float ndv = N.y;
  float fres = 0.02 + 0.98*pow(1.0 - ndv, 5.0);
  float refl = clamp(fres*3.0 + (1.0 - ndv)*0.5, 0.0, 0.36);
  vec3 rdir = reflect(vec3(0.0, -1.0, 0.0), N);
  float sunDot = max(dot(rdir, uSunDir), 0.0);
  vec3 sky = mix(vec3(0.7, 0.87, 0.95), vec3(0.5, 0.6, 0.66), uRain);
  sky = mix(sky, vec3(0.1, 0.2, 0.12), can*0.6);
  vec3 col = mix(under, sky, refl);
  // sun glints: sparse, clustered, warm; plus a broad soft sheen
  float cluster = smoothstep(0.35, 0.8, vnoise(w*0.9 + vec2(uTime*0.07, uTime*0.03)));
  float glint = pow(sunDot, 1800.0)*2.4*(0.25 + 0.75*cluster)*(1.0 - 0.6*uCalm);
  float sheen = pow(sunDot, 28.0)*0.05 + pow(sunDot, 240.0)*0.16*(0.4 + 0.6*cluster);
  col += vec3(1.0, 0.95, 0.82)*(glint + sheen)*sunVis;

  // lacy foam from splashes and wakes
  if (foam > 0.015){
    vec3 vf = voro(w*10.0 + vec2(uTime*0.12, -uTime*0.08));
    float fn = vnoise(w*9.0 + vec2(uTime*0.25, -uTime*0.1));
    float lace = 1.0 - smoothstep(0.015, 0.12, vf.y);
    float fm = smoothstep(0.18, 0.95, foam*(0.28 + 0.95*lace + 0.35*fn));
    vec3 foamCol = mix(vec3(0.78, 0.93, 0.95), vec3(1.0, 0.99, 0.95), lace);
    col = mix(col, foamCol, fm*0.72);
    col += vec3(0.08, 0.14, 0.14)*smoothstep(0.0, 0.5, foam)*(1.0 - fm);
  }
  if (S > 0.002){
    float core = exp(-rl*rl/(R*R*0.05));
    col = mix(col, col*vec3(0.3, 0.52, 0.66), S*core*0.75);
    float band = smoothstep(R*1.7, R*0.4, rl)*smoothstep(0.02, 0.22, rl);
    float streak = pow(0.5 + 0.5*spiral, 10.0);
    col += vec3(0.7, 0.93, 1.0)*streak*band*S*0.26;
    float ringR = R*0.36;
    col += vec3(0.8, 0.95, 1.0)*exp(-pow((rl - ringR)/(R*0.1), 2.0))*S*0.1;
  }

  float inside = smoothstep(0.0, -0.4, sd);
  col *= mix(0.64, 1.0, inside);
  col += vec3(0.75, 0.92, 0.9)*smoothstep(0.035, 0.0, abs(sd + 0.025))*0.16;
  vec2 sunShift = uSunDir.xz/uSunDir.y;
  float sSh = smoothstep(-0.04, 0.05, pondSDF(w + sunShift*0.12));
  col *= 1.0 - sSh*0.25;

  col = mix(col, rim, smoothstep(-0.01, 0.03, sd));

  for (int i = 0; i < 5; i++){
    vec4 P = uPads[i];
    if (length(w - P.xy) > P.z*1.5) continue;
    float sdS = length(w - (P.xy - sunShift*0.09)) - P.z;
    col *= 1.0 - 0.32*smoothstep(0.06, -0.06, sdS);
    vec4 pad = lily(w, P, float(i));
    col = mix(col, pad.rgb*(1.0 - 0.35*can), pad.a);
    if (i == 0 || i == 3){
      float rot = P.w + 0.07*sin(uTime*0.22 + float(i)*1.9);
      vec2 fc = P.xy - vec2(cos(rot), sin(rot))*P.z*0.28;
      vec4 fl = lotus(w, fc, P.z*0.42, float(i)*1.3);
      col *= 1.0 - 0.25*lotus(w, fc - sunShift*0.05, P.z*0.42, float(i)*1.3).a*(1.0 - fl.a);
      col = mix(col, fl.rgb*(1.0 - 0.3*can), fl.a);
    }
  }
  gl_FragColor = vec4(finish(col), 1.0);
}
`;

export class Water {
  constructor(renderer, U, { causticSize = 512 } = {}) {
    this.renderer = renderer;
    this.U = U;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
    this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(geo);
    this.quad.frustumCulled = false;
    this.quadScene = new THREE.Scene();
    this.quadScene.add(this.quad);

    const common = { uHalf: U.uHalf, uPond: U.uPond, uPondR: U.uPondR, uTime: U.uTime };
    const mk = (fs, uniforms) => new THREE.ShaderMaterial({
      vertexShader: QUAD_VS, fragmentShader: fs, uniforms: { ...common, ...uniforms },
      depthTest: false, depthWrite: false,
    });
    this.stepMat = mk(COMMON + STEP_FS, { uTex: { value: null }, uTexel: { value: new THREE.Vector2() }, uDamp: { value: 0.99 } });
    this.dropMat = mk(COMMON + DROP_FS, {
      uTex: { value: null },
      uDrops: { value: Array.from({ length: 16 }, () => new THREE.Vector4()) },
      uDropsB: { value: Array.from({ length: 16 }, () => new THREE.Vector4()) },
      uCount: { value: 0 },
    });
    this.clearMat = mk(CLEAR_FS, {});
    this.causticMat = mk(COMMON + CAUSTIC_FS, {});
    this.canopyMat = mk(COMMON + CANOPY_FS, {});
    this.floorBakeMat = mk(COMMON + FLOOR_BAKE_FS, { uSunDir: U.uSunDir, uPads: U.uPads, uMode: { value: 0 } });
    this.rimBakeMat = mk(COMMON + RIM_BAKE_FS, { uSunDir: U.uSunDir });
    const lin = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, generateMipmaps: false };
    this.causticRT = new THREE.WebGLRenderTarget(causticSize, causticSize, { ...lin, wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping });
    U.uCaustic.value = this.causticRT.texture;
    this.canopyRT = new THREE.WebGLRenderTarget(4, 4, lin);
    U.uCanopyTex.value = this.canopyRT.texture;
    this.bakeA = new THREE.WebGLRenderTarget(4, 4, lin);
    this.bakeB = new THREE.WebGLRenderTarget(4, 4, lin);
    this.bakeRim = new THREE.WebGLRenderTarget(4, 4, lin);
    U.uFloorA.value = this.bakeA.texture; U.uFloorB.value = this.bakeB.texture; U.uRimTex.value = this.bakeRim.texture;

    this.floorMat = new THREE.ShaderMaterial({
      vertexShader: FLOOR_VS, fragmentShader: COMMON + CANOPY + FLOOR_FS,
      uniforms: {
        ...common, uCaustic: U.uCaustic, uHeight: U.uHeight, uSimTexel: U.uSimTexel, uRain: U.uRain,
        uFloorA: U.uFloorA, uFloorB: U.uFloorB, uCanopyTex: U.uCanopyTex,
      },
    });
    this.floor = new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), this.floorMat);
    this.floor.position.y = -4;
    this.floor.frustumCulled = false;

    this.compMat = new THREE.ShaderMaterial({
      vertexShader: QUAD_VS, fragmentShader: COMMON + CANOPY + COMP_FS,
      uniforms: {
        ...common, uUnder: { value: null }, uHeight: U.uHeight, uSimTexel: U.uSimTexel, uSunDir: U.uSunDir,
        uRain: U.uRain, uCalm: U.uCalm, uWhirl: U.uWhirl, uPads: U.uPads, uRes: { value: new THREE.Vector2(1, 1) },
        uFloorB: U.uFloorB, uRimTex: U.uRimTex, uCanopyTex: U.uCanopyTex,
      },
      depthTest: false, depthWrite: false,
    });
    const comp = new THREE.Mesh(geo, this.compMat);
    comp.frustumCulled = false;
    this.compScene = new THREE.Scene();
    this.compScene.add(comp);

    this.rts = null;
    this.cur = 0;
    this.queue = [];
  }

  resize(simW, simH, viewHalfW, viewHalfH, resW, resH) {
    if (this.rts) this.rts.forEach((r) => r.dispose());
    const opt = {
      type: THREE.HalfFloatType, format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
      wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping,
      depthBuffer: false, generateMipmaps: false,
    };
    this.rts = [new THREE.WebGLRenderTarget(simW, simH, opt), new THREE.WebGLRenderTarget(simW, simH, opt)];
    this.cur = 0;
    this.U.uSimTexel.value.set(1 / simW, 1 / simH);
    this.stepMat.uniforms.uTexel.value.set(1 / simW, 1 / simH);
    this.floor.scale.set(viewHalfW * 1.06, 1, viewHalfH * 1.06);
    this.compMat.uniforms.uRes.value.set(resW, resH);
    this.canopyRT.setSize(simW, simH);
    // bake the still parts of the scene once per size (the floor, the shore)
    const k = Math.min(1, 2048 / Math.max(resW, resH));
    const bw = Math.max(4, Math.round(resW * k)), bh = Math.max(4, Math.round(resH * k));
    this.bakeA.setSize(bw, bh); this.bakeB.setSize(bw, bh); this.bakeRim.setSize(bw, bh);
    this.floorBakeMat.uniforms.uMode.value = 0; this.run(this.floorBakeMat, this.bakeA);
    this.floorBakeMat.uniforms.uMode.value = 1; this.run(this.floorBakeMat, this.bakeB);
    this.run(this.rimBakeMat, this.bakeRim);
    this.clear();
  }

  run(mat, target) {
    this.quad.material = mat;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.quadScene, this.quadCam);
  }

  clear() {
    for (const rt of this.rts) this.run(this.clearMat, rt);
    this.U.uHeight.value = this.rts[this.cur].texture;
  }

  addDrop(x, z, radius, strength, foam = 0) {
    if (this.queue.length < 160 * 5) this.queue.push(x, z, radius, strength, foam);
  }

  update(damp, steps = 2) {
    this.run(this.causticMat, this.causticRT);
    this.run(this.canopyMat, this.canopyRT);
    const q = this.queue;
    const u = this.dropMat.uniforms;
    let i = 0;
    while (i < q.length) {
      let n = 0;
      while (n < 16 && i < q.length) {
        u.uDrops.value[n].set(q[i], q[i + 1], q[i + 2], q[i + 3]);
        u.uDropsB.value[n].set(q[i + 4], 0, 0, 0);
        n++; i += 5;
      }
      u.uCount.value = n;
      u.uTex.value = this.rts[this.cur].texture;
      this.run(this.dropMat, this.rts[1 - this.cur]);
      this.cur = 1 - this.cur;
    }
    q.length = 0;
    this.stepMat.uniforms.uDamp.value = damp;
    for (let k = 0; k < steps; k++) {
      this.stepMat.uniforms.uTex.value = this.rts[this.cur].texture;
      this.run(this.stepMat, this.rts[1 - this.cur]);
      this.cur = 1 - this.cur;
    }
    this.U.uHeight.value = this.rts[this.cur].texture;
  }
}
