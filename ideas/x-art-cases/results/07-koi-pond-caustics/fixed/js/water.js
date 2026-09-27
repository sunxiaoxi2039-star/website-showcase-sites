// Water: GPU heightfield ripples, tileable caustics, pond floor and the refraction composite.
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
    uWaterDeep: { value: new THREE.Vector3(0.05, 0.34, 0.38) },
    uRain: { value: 0 },
    uCalm: { value: 0 },
    uWhirl: { value: new THREE.Vector4(0, 0, 0, 1.3) },
    uPads: { value: Array.from({ length: 5 }, () => new THREE.Vector4(99, 99, 0.01, 0)) },
    uFloorD: { value: 1.6 },
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
float canopy(vec2 w){ return smoothstep(0.54, 0.76, fbm(w*0.2 + vec2(uTime*0.011, -uTime*0.007) + 4.0)); }
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
  foam = max(foam*0.986 - 0.0022, 0.0);
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
  c.b = min(c.b, 1.6);
  gl_FragColor = c;
}
`;

const CLEAR_FS = /* glsl */`
varying vec2 vUv;
void main(){ gl_FragColor = vec4(0.0); }
`;

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
  return pow(clamp(1.0 - e*1.7, 0.0, 1.0), 6.0);
}
float caustic(vec2 uv, float t){
  vec2 wv = uv + 0.03*vec2(sin(6.2831853*(uv.y*2.0) + t*0.8), cos(6.2831853*(uv.x*3.0) - t*0.7));
  float a = cLayer(wv, 5.0, t, 0.0);
  float b = cLayer(wv + vec2(0.31, 0.17), 7.0, t*1.21, 17.0);
  return a*0.55 + b*0.45 + a*b*1.6;
}
void main(){
  float t = uTime*0.85;
  vec2 uv = fract(vUv);
  vec2 d = vec2(0.0032, 0.0021);
  vec3 c = vec3(caustic(uv + d, t), caustic(uv, t), caustic(uv - d, t));
  gl_FragColor = vec4(c*0.62, 1.0);
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
uniform vec2 uSimTexel;
uniform vec3 uSunDir;
uniform float uRain;
uniform vec4 uPads[5];
varying vec2 vW;

vec3 pebbleColor(float h){
  vec3 c = vec3(0.70, 0.68, 0.64);
  c = mix(c, vec3(0.50, 0.47, 0.44), step(0.2, h));
  c = mix(c, vec3(0.80, 0.63, 0.47), step(0.42, h));
  c = mix(c, vec3(0.90, 0.88, 0.83), step(0.6, h));
  c = mix(c, vec3(0.42, 0.45, 0.47), step(0.78, h));
  c = mix(c, vec3(0.66, 0.52, 0.42), step(0.9, h));
  return c;
}
float padShadow(vec2 w){
  float m = 0.0;
  for (int i = 0; i < 5; i++){
    vec4 p = uPads[i];
    float d = length(w - p.xy) - p.z;
    m = max(m, smoothstep(0.16, -0.14, d));
  }
  return m;
}
void main(){
  vec2 w = vW;
  float sd = pondSDF(w);
  float depth = mix(0.3, 1.75, smoothstep(0.0, 2.3, -sd)) + (fbm(w*0.42 + 7.0) - 0.5)*0.4;
  depth = max(depth, 0.18);
  float edgeZone = smoothstep(-1.3, -0.2, sd);

  float grain = vnoise(w*38.0)*0.5 + vnoise(w*11.0)*0.5;
  float marks = sin(w.x*5.5 + w.y*2.2 + fbm(w*0.8)*5.0)*0.5 + 0.5;
  vec3 sand = vec3(0.86, 0.80, 0.65)*(0.86 + 0.18*grain)*(0.95 + 0.07*marks);

  vec3 v = voro(w*3.3);
  float dens = smoothstep(0.38, 0.62, fbm(w*0.55 + 11.0) + edgeZone*0.25);
  float has = step(v.z, 0.25 + 0.7*dens);
  float peb = smoothstep(0.03, 0.1, v.y)*has;
  float dome = 1.08 - v.x*0.65;
  vec3 pc = pebbleColor(fract(v.z*7.13))*dome*(0.92 + 0.12*vnoise(w*20.0));
  vec3 alb = mix(sand, pc, peb);
  alb *= 1.0 - (1.0 - smoothstep(0.0, 0.05, v.y))*0.35*has;

  vec3 v2 = voro(w*1.25 + 5.3);
  float rock = smoothstep(0.04, 0.14, v2.y)*edgeZone*step(0.45, v2.z);
  vec3 rc = mix(vec3(0.44, 0.45, 0.43), vec3(0.64, 0.6, 0.53), fract(v2.z*5.7))*(1.1 - v2.x*0.7);
  alb = mix(alb, rc, rock);
  float moss = smoothstep(0.52, 0.8, fbm(w*0.9 + 3.3))*(0.35 + 0.65*edgeZone);
  alb = mix(alb, alb*vec3(0.52, 0.7, 0.42), moss*0.75);

  vec2 suv = worldToUv(w);
  float hC = texture2D(uHeight, suv).r;
  float hL = texture2D(uHeight, suv - vec2(uSimTexel.x, 0.0)).r;
  float hR = texture2D(uHeight, suv + vec2(uSimTexel.x, 0.0)).r;
  float hD = texture2D(uHeight, suv - vec2(0.0, uSimTexel.y)).r;
  float hU = texture2D(uHeight, suv + vec2(0.0, uSimTexel.y)).r;
  vec2 grad = vec2(hR - hL, hD - hU);
  float lap = hL + hR + hD + hU - 4.0*hC;

  vec3 c1 = texture2D(uCaustic, w/3.4 + grad*1.4).rgb;
  vec3 c2 = texture2D(uCaustic, w/5.6 + vec2(0.37, 0.61) - grad*0.9).rgb;
  vec3 caus = c1*0.75 + c2*0.6;
  caus = mix(caus, vec3(0.32), smoothstep(0.4, 2.2, depth)*0.35);

  float sunAmt = 1.0 - uRain*0.7;
  vec2 sunShift = uSunDir.xz/uSunDir.y;
  float rimSh = smoothstep(-0.1, 0.06, pondSDF(w + sunShift*depth*0.45));
  float padSh = padShadow(w + sunShift*(depth + 0.05));
  float can = canopy(w);
  float shade = clamp(max(max(rimSh, padSh*0.8), can*0.6), 0.0, 1.0);
  float direct = sunAmt*(1.0 - shade);
  float focus = clamp(-lap*30.0, -0.35, 1.2);
  vec3 light = vec3(0.4) + direct*(vec3(0.46) + caus*1.5 + focus);
  light *= vec3(1.04, 1.0, 0.93);
  vec3 col = alb*light;

  vec3 absorb = exp(-depth*vec3(0.95, 0.25, 0.18));
  col *= absorb;
  vec3 scatter = mix(vec3(0.07, 0.44, 0.44), vec3(0.03, 0.27, 0.35), smoothstep(0.4, 1.8, depth));
  scatter *= 0.8 + 0.2*sunAmt;
  col = mix(col, scatter, 1.0 - exp(-depth*0.5));
  gl_FragColor = vec4(col, 1.0);
}
`;

const COMP_FS = /* glsl */`
uniform sampler2D uUnder;
uniform sampler2D uHeight;
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
    float amp = 0.026/(1.0 + fi*0.55);
    g += dir*(k*amp)*cos(dot(dir, p)*k - t*spd + fi*1.7);
  }
  float e = 0.05;
  vec2 q = p*5.0 + t*0.35;
  float n0 = vnoise(q);
  g += vec2(vnoise(q + vec2(e, 0.0)) - n0, vnoise(q + vec2(0.0, e)) - n0)/e*0.012;
  return g;
}

vec3 rimColor(vec2 w, float sd, float can){
  vec3 v = voro(w*1.8 + 2.0);
  float gap = smoothstep(0.02, 0.09, v.y);
  vec3 stone = mix(vec3(0.55, 0.53, 0.49), vec3(0.72, 0.68, 0.6), v.z);
  stone = mix(stone, vec3(0.48, 0.5, 0.5), step(0.82, v.z));
  stone *= 0.86 + 0.2*vnoise(w*11.0) + 0.08*(hash12(floor(w*90.0)) - 0.5);
  stone *= 1.12 - v.x*0.45;
  vec3 moss = vec3(0.19, 0.29, 0.13)*(0.7 + 0.6*vnoise(w*7.0));
  vec3 c = mix(moss, stone, gap);
  c *= mix(0.58, 1.0, smoothstep(0.0, 0.2, sd));
  float rimW = 0.36;
  float gm = smoothstep(rimW, rimW + 0.07, sd + (vnoise(w*3.0) - 0.5)*0.14);
  vec3 grass = mix(vec3(0.1, 0.2, 0.07), vec3(0.24, 0.37, 0.12), fbm(w*2.2));
  grass *= 0.78 + 0.4*vnoise(vec2(w.x*40.0, w.y*9.0));
  c = mix(c, grass, gm);
  c *= 1.0 - 0.25*smoothstep(0.12, 0.0, abs(sd - rimW - 0.03))*gm;
  c *= vec3(1.05, 1.0, 0.92);
  c *= mix(1.0 - uRain*0.25, 0.62, can*0.8);
  return c;
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
  vec3 base = mix(vec3(0.12, 0.33, 0.11), vec3(0.3, 0.52, 0.17), smoothstep(0.0, 1.0, rn));
  base = mix(base, vec3(0.45, 0.24, 0.16), smoothstep(0.86, 1.0, rn)*0.55);
  float veins = pow(abs(cos(a*8.0 + idx)), 30.0)*smoothstep(0.08, 0.8, rn);
  base += veins*vec3(0.05, 0.08, 0.03);
  base *= 0.88 + 0.22*vnoise(w*16.0 + idx*7.0);
  vec3 n = normalize(vec3(-d.x/P.z*0.45, 1.0, -d.y/P.z*0.45));
  base *= 0.78 + 0.35*max(dot(n, uSunDir), 0.0);
  base += vec3(0.9, 0.95, 0.85)*pow(max(dot(reflect(vec3(0.0, -1.0, 0.0), n), uSunDir), 0.0), 40.0)*0.25;
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

vec3 finish(vec3 col){
  vec2 q = (vUv - 0.5)*vec2(uRes.x/uRes.y, 1.0);
  float vig = smoothstep(1.25, 0.3, length(q));
  col *= mix(0.8, 1.0, vig);
  col += vec3(1.0, 0.92, 0.75)*0.06*exp(-length(vUv - vec2(0.92, 0.95))*2.4)*(1.0 - uRain);
  col *= 1.03;
  col += (hash12(gl_FragCoord.xy + fract(uTime*7.0)*91.0) - 0.5)/255.0;
  return col;
}

void main(){
  vec2 w = uvToWorld(vUv);
  float sd = pondSDF(w);
  float can = canopy(w);
  vec3 rim = rimColor(w, sd, can);
  if (sd > 0.06){ gl_FragColor = vec4(finish(rim), 1.0); return; }

  vec4 hc = texture2D(uHeight, vUv);
  float hL = texture2D(uHeight, vUv - vec2(uSimTexel.x, 0.0)).r;
  float hR = texture2D(uHeight, vUv + vec2(uSimTexel.x, 0.0)).r;
  float hD = texture2D(uHeight, vUv - vec2(0.0, uSimTexel.y)).r;
  float hU = texture2D(uHeight, vUv + vec2(0.0, uSimTexel.y)).r;
  vec2 grad = vec2(hR - hL, hD - hU)*9.0;
  float foam = hc.b;

  float mAmp = (1.0 - 0.78*uCalm)*(1.0 + 0.5*uRain);
  vec2 G = grad + microGrad(w, uTime)*mAmp;

  vec2 rv = w - uWhirl.xy;
  float rl = length(rv);
  float S = uWhirl.z, R = uWhirl.w;
  vec2 rn = rv/max(rl, 1e-3);
  vec2 tn = vec2(-rn.y, rn.x);
  float ew = exp(-rl*rl/(R*R)*1.4);
  float ang = atan(rv.y, rv.x);
  float sph = ang*3.0 + log(rl + 0.05)*5.5 - uTime*(1.4 + 1.6*S);
  float spiral = sin(sph);
  G += rn*(S*2.2*rl/(R*R)*ew) + tn*(cos(sph)*0.35*S*ew);

  float tw = S*2.4*exp(-rl/(R*0.8));
  float ct = cos(tw), st = sin(tw);
  vec2 rvT = vec2(ct*rv.x - st*rv.y, st*rv.x + ct*rv.y);
  vec2 wT = uWhirl.xy + rvT*(1.0 - 0.25*S*ew);
  vec2 wR = wT - clamp(G, -1.5, 1.5)*0.22;
  vec2 uvR = worldToUv(wR);
  vec2 dsp = uvR - vUv;
  vec3 under;
  under.r = texture2D(uUnder, vUv + dsp*1.08).r;
  under.g = texture2D(uUnder, uvR).g;
  under.b = texture2D(uUnder, vUv + dsp*0.92).b;

  vec3 N = normalize(vec3(-G.x, 1.0, -G.y));
  float ndv = N.y;
  float fres = 0.02 + 0.98*pow(1.0 - ndv, 5.0);
  float refl = clamp(fres*3.0 + (1.0 - ndv)*0.55, 0.0, 0.55);
  vec3 rdir = reflect(vec3(0.0, -1.0, 0.0), N);
  float sunDot = max(dot(rdir, uSunDir), 0.0);
  vec3 sky = mix(vec3(0.72, 0.88, 0.95), vec3(0.55, 0.6, 0.64), uRain);
  sky = mix(sky, vec3(0.2, 0.32, 0.24), can*0.5);
  vec3 col = mix(under, sky, refl);
  float sunVis = (1.0 - uRain*0.8)*(1.0 - can*0.85);
  col += vec3(1.0, 0.96, 0.86)*(pow(sunDot, 700.0)*7.0 + pow(sunDot, 60.0)*0.22)*sunVis;

  float fn = vnoise(w*9.0 + vec2(uTime*0.25, -uTime*0.1))*0.6 + vnoise(w*23.0)*0.4;
  float fm = smoothstep(0.12, 0.6, foam*(0.5 + fn));
  col = mix(col, vec3(0.93, 0.98, 1.0), fm*0.85);
  float arms = smoothstep(0.35, 0.95, spiral*0.5 + 0.5 + (fn - 0.5)*0.6)*S*smoothstep(R*1.8, R*0.45, rl)*smoothstep(0.03, 0.3, rl);
  col = mix(col, vec3(0.86, 0.95, 0.96), arms*0.45);
  col *= 1.0 - S*0.55*exp(-rl*rl/(R*R*0.045));

  float inside = smoothstep(0.0, -0.4, sd);
  col *= mix(0.62, 1.0, inside);
  col += vec3(0.75, 0.9, 0.9)*smoothstep(0.035, 0.0, abs(sd + 0.025))*0.18;
  vec2 sunShift = uSunDir.xz/uSunDir.y;
  float sSh = smoothstep(-0.04, 0.05, pondSDF(w + sunShift*0.12));
  col *= 1.0 - sSh*0.25;

  col = mix(col, rim, smoothstep(-0.01, 0.03, sd));

  for (int i = 0; i < 5; i++){
    vec4 P = uPads[i];
    float sdS = length(w - (P.xy - sunShift*0.09)) - P.z;
    col *= 1.0 - 0.32*smoothstep(0.06, -0.06, sdS);
    vec4 pad = lily(w, P, float(i));
    col = mix(col, pad.rgb, pad.a);
    if (i == 0 || i == 3){
      float rot = P.w + 0.07*sin(uTime*0.22 + float(i)*1.9);
      vec2 fc = P.xy - vec2(cos(rot), sin(rot))*P.z*0.28;
      vec4 fl = lotus(w, fc, P.z*0.42, float(i)*1.3);
      col *= 1.0 - 0.25*lotus(w, fc - sunShift*0.05, P.z*0.42, float(i)*1.3).a*(1.0 - fl.a);
      col = mix(col, fl.rgb, fl.a);
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
    this.causticRT = new THREE.WebGLRenderTarget(causticSize, causticSize, {
      wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping,
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
      depthBuffer: false, generateMipmaps: false,
    });
    U.uCaustic.value = this.causticRT.texture;

    this.floorMat = new THREE.ShaderMaterial({
      vertexShader: FLOOR_VS, fragmentShader: COMMON + FLOOR_FS,
      uniforms: { ...common, uCaustic: U.uCaustic, uHeight: U.uHeight, uSimTexel: U.uSimTexel, uSunDir: U.uSunDir, uRain: U.uRain, uPads: U.uPads },
    });
    this.floor = new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), this.floorMat);
    this.floor.position.y = -4;
    this.floor.frustumCulled = false;

    this.compMat = new THREE.ShaderMaterial({
      vertexShader: QUAD_VS, fragmentShader: COMMON + COMP_FS,
      uniforms: {
        ...common, uUnder: { value: null }, uHeight: U.uHeight, uSimTexel: U.uSimTexel, uSunDir: U.uSunDir,
        uRain: U.uRain, uCalm: U.uCalm, uWhirl: U.uWhirl, uPads: U.uPads, uRes: { value: new THREE.Vector2(1, 1) },
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

  update(damp) {
    this.run(this.causticMat, this.causticRT);
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
    for (let k = 0; k < 2; k++) {
      this.stepMat.uniforms.uTex.value = this.rts[this.cur].texture;
      this.run(this.stepMat, this.rts[1 - this.cur]);
      this.cur = 1 - this.cur;
    }
    this.U.uHeight.value = this.rts[this.cur].texture;
  }
}
