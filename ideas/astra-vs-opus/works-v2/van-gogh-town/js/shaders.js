// Shared GLSL chunks.
// Core idea: every surface is re-painted per pixel by a procedural "stroke splatter".
// Space is cut into cells; each cell owns one brush stroke (random position / length /
// angle).  For a pixel we find the top-most stroke covering it and light the stroke as a
// whole — lighting is evaluated at the stroke's CENTRE, so gradients (lamp pools, sunlit
// edges) get quantised into dabs of flat colour, exactly the way a painter would do it.

export const COMMON = /* glsl */ `
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec4 hash42(vec2 p){ vec4 p4 = fract(vec4(p.xyxy) * vec4(.1031, .1030, .0973, .1099)); p4 += dot(p4, p4.wzxy + 33.33); return fract((p4.xxyz + p4.yzzw) * p4.zywx); }
float vnoise(vec2 p){
  vec2 i = floor(p); vec2 f = fract(p); vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(hash12(i), hash12(i+vec2(1.,0.)), u.x), mix(hash12(i+vec2(0.,1.)), hash12(i+vec2(1.,1.)), u.x), u.y);
}
float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i=0;i<4;i++){ s += a*vnoise(p); p = p*2.03 + 17.1; a *= 0.5; } return s; }
`;

// Stroke search. P is in "cell units". Two staggered layers x 3x3 cells.
export const STROKE = /* glsl */ `
struct Stroke { vec2 center; vec2 local; float cov; vec4 h; float found; float dirA; vec2 local2; float cov2; vec4 h2; vec2 center2; };

Stroke findStroke(vec2 P, float aspect, float baseAng, float jit, float flowAmt, float aa, float seed, float sizeK){
  Stroke best; best.found = 0.0; best.cov = 0.0; best.center = P; best.local = vec2(0.0); best.h = vec4(0.5); best.dirA = 0.0;
  best.local2 = vec2(0.0); best.cov2 = 0.0; best.h2 = vec4(0.5); best.center2 = P;
  float bestPrio = -1.0; float secPrio = -1.0;
  for (int layer = 0; layer < 2; layer++){
    vec2 off = layer == 0 ? vec2(0.0) : vec2(0.5, 0.5);
    vec2 base = floor(P + off);
    for (int j = -1; j <= 1; j++){
      for (int i = -1; i <= 1; i++){
        vec2 c = base + vec2(float(i), float(j));
        vec4 h = hash42(c + vec2(seed, seed*0.37) + float(layer)*57.31);
        vec2 ctr = c + 0.5 + (h.xy - 0.5) * 0.8 - off;
        float ang = baseAng + (h.z - 0.5) * 2.0 * jit + flowAmt * (vnoise(ctr * 0.21 + seed) - 0.5) * 6.2832;
        vec2 dir = vec2(cos(ang), sin(ang));
        vec2 q = P - ctr;
        float a = dot(q, dir);
        float b = dot(q, vec2(-dir.y, dir.x));
        float hl = mix(0.6, 1.0, h.w) * sizeK;
        float hw = hl / aspect;
        float t = clamp(a / hl, -1.0, 1.0);
        float w = hw * (1.0 - 0.3 * t * t) * (0.92 + 0.16 * sin(t * 2.7 + h.x * 6.28));
        float sd = length(vec2(max(abs(a) - hl + w, 0.0), b)) - w;
        float cov = 1.0 - smoothstep(-aa, aa, sd);
        float prio = fract(h.w * 13.7 + h.x * 3.1 + h.y * 1.7);
        if (cov > 0.02){
          vec2 loc = vec2(a / hl, b / max(w, 1e-3));
          if (prio > bestPrio){
            secPrio = bestPrio; best.local2 = best.local; best.cov2 = best.cov; best.h2 = best.h; best.center2 = best.center;
            bestPrio = prio; best.found = 1.0; best.center = ctr; best.local = loc; best.cov = cov; best.h = h; best.dirA = ang;
          } else if (prio > secPrio){
            secPrio = prio; best.local2 = loc; best.cov2 = cov; best.h2 = h; best.center2 = ctr;
          }
        }
      }
    }
  }
  return best;
}

// bristle + impasto ridge modulation for a stroke's colour
float reliefOf(vec2 local, vec4 h, float bristleK){
  float y = clamp(local.y, -1.0, 1.0);
  float ridge = 1.0 - y * y;
  float br = 0.5 + 0.5 * sin(y * 8.5 + h.x * 40.0 + sin(local.x * 2.3 + h.z * 9.0) * 1.3);
  float br2 = 0.5 + 0.5 * sin(y * 19.0 + h.y * 23.0);
  float m = 0.93 + 0.1 * ridge;
  m += (br - 0.5) * 0.16 * bristleK + (br2 - 0.5) * 0.08 * bristleK;
  m += 0.05 * local.x;          // paint loads at one end, drags thin at the other
  m += 0.04 * (-y);             // light from one side of the ridge
  return m;
}
float strokeRelief(Stroke s, float bristleK){ return reliefOf(s.local, s.h, bristleK); }
`;

export const LIGHT_UNIFORMS = /* glsl */ `
uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uAmbSky; uniform vec3 uAmbGround;
uniform vec3 uLampPos[8]; uniform vec4 uLampCol[8]; uniform float uLampK;
uniform vec3 uFogCol; uniform float uFogDen; uniform float uNight; uniform vec3 uUnder;
uniform float uTime; uniform float uReveal;
`;

export const LIGHT_FN = /* glsl */ `
vec3 lampLight(vec3 p, vec3 n){
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 8; i++){
    vec3 d = uLampPos[i] - p;
    float dist = length(d);
    float r = uLampCol[i].w;
    float att = 1.0 / (1.0 + dist * dist / (r * r * 0.05));
    att *= 1.0 - smoothstep(r * 0.7, r, dist);
    float nd = dot(n, d / max(dist, 1e-3)) * 0.65 + 0.35;
    acc += uLampCol[i].rgb * att * max(nd, 0.0);
  }
  return acc * uLampK;
}
// "a night painting without black": under night ambient, colours slide towards blue-violet-green
vec3 nightAlb(vec3 alb){
  float l = dot(alb, vec3(0.3, 0.5, 0.2));
  vec3 cool = vec3(l) * vec3(0.72, 0.86, 1.32) + (alb - vec3(l)) * vec3(0.35, 0.6, 0.9);
  return mix(alb, cool, uNight * 0.6);
}
vec3 tone(vec3 c){ return c / (1.0 + max(max(c.r, c.g), c.b) * 0.18) * 1.12; }
vec3 shadeL(vec3 alb, vec3 amb, vec3 lamp){ return tone(nightAlb(alb) * amb + alb * lamp); }
vec3 ambOf(vec3 n){ return mix(uAmbGround, uAmbSky, n.y * 0.5 + 0.5) + uSunCol * max(dot(n, uSunDir), 0.0); }
vec3 shade(vec3 alb, vec3 p, vec3 n){ return shadeL(alb, ambOf(n), lampLight(p, n)); }
vec3 applyFog(vec3 c, vec3 p){
  float d = length(p - cameraPosition);
  float f = 1.0 - exp(-d * uFogDen / (1.0 + max(cameraPosition.y - 8.0, 0.0) / 14.0));
  f *= 1.0 - smoothstep(0.0, 120.0, p.y) * 0.3;
  return mix(c, uFogCol, clamp(f, 0.0, 0.85));
}
`;

export const PAINT_VERT = /* glsl */ `
attribute vec3 cA; attribute vec3 cB; attribute vec3 cC; attribute vec4 st; attribute vec4 mt;
varying vec3 vW; varying vec3 vN; varying vec3 vA; varying vec3 vB; varying vec3 vC; varying vec4 vSt; varying vec4 vMt;
void main(){
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal);
  vA = cA; vB = cB; vC = cC; vSt = st; vMt = mt;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

export const PAINT_FRAG = /* glsl */ `
${COMMON}
${STROKE}
${LIGHT_UNIFORMS}
${LIGHT_FN}
uniform float uDetail;
varying vec3 vW; varying vec3 vN; varying vec3 vA; varying vec3 vB; varying vec3 vC; varying vec4 vSt; varying vec4 vMt;

vec3 pickCol(vec4 h){
  vec3 c = h.y < 0.5 ? vA : (h.y < 0.8 ? vB : vC);
  c *= 0.9 + 0.2 * h.x;
  c += (h.zwx - 0.5) * 0.07;
  return max(c, 0.0);
}

// paint one level of strokes; cs = cell size in metres
vec3 paintLevel(vec2 P, float cs, float fw, float seed, vec3 n, vec3 U, vec3 V, vec3 amb, vec3 lampP, vec3 baseCol, float em){
  vec2 Pc = P / cs;
  vec3 col = baseCol;
  Stroke s = findStroke(Pc, vSt.y, vSt.z, vSt.w, vMt.y, max(fw * 0.75, 0.015), seed, vMt.w);
  if (s.h2.w * 0.75 + s.h2.x * 0.25 > uReveal * 1.1) s.cov2 = 0.0;
  if (s.h.w * 0.75 + s.h.x * 0.25 > uReveal * 1.1) s.found = 0.0;
  if (s.found > 0.5){
    vec3 sc = pickCol(s.h);
    vec3 cw = vW + U * (s.center.x - Pc.x) * cs + V * (s.center.y - Pc.y) * cs;
    vec3 lit = shadeL(sc, amb, lampLight(cw, n));
    vec3 emc = (s.h.y < 0.6 ? vC : mix(vC, vec3(1.0, 0.93, 0.6), 0.6)) * (0.95 + 0.2 * s.h.x);
    lit = mix(lit, emc, em);
    float relief = strokeRelief(s, 1.0);
    // optional dark contour around each dab (cobbles, tiles)
    float edge = smoothstep(0.45, 1.0, max(abs(s.local.x) * 0.8, abs(s.local.y)));
    relief *= 1.0 - vMt.z * edge * 0.75;
    // the stroke underneath (lit at the pixel) instead of a dark gap
    vec3 bg = baseCol;
    if (s.cov2 > 0.0){
      vec3 sc2 = pickCol(s.h2);
      vec3 l2 = mix(shadeL(sc2, amb, lampP), mix(vC, vec3(1.0, 0.93, 0.6), 0.3), em);
      float e2 = smoothstep(0.45, 1.0, max(abs(s.local2.x) * 0.8, abs(s.local2.y)));
      bg = mix(baseCol, l2 * reliefOf(s.local2, s.h2, 1.0) * (1.0 - vMt.z * e2 * 0.75), s.cov2);
    }
    col = mix(bg, lit * relief, s.cov);
  }
  return col;
}

void main(){
  vec3 n = normalize(vN);
  if (!gl_FrontFacing) n = -n;
  vec3 an = abs(n);
  vec2 P; vec3 U; vec3 V; float other;
  if (an.y > an.x && an.y > an.z){ P = vW.xz; U = vec3(1.,0.,0.); V = vec3(0.,0.,1.); other = vW.y; }
  else if (an.x > an.z){ P = vec2(vW.z, vW.y); U = vec3(0.,0.,1.); V = vec3(0.,1.,0.); other = vW.x; }
  else { P = vW.xy; U = vec3(1.,0.,0.); V = vec3(0.,1.,0.); other = vW.z; }
  float cs = vSt.x;
  float fw = sqrt(length(dFdx(P)) * length(dFdy(P))) * 1.2 / cs;
  float seed = dot(floor(n * 2.0 + 0.5), vec3(17.1, 31.7, 7.3)) + floor(other * 1.3) * 3.71;
  float em = vMt.x * uNight;

  vec3 avg = vA * 0.55 + vB * 0.3 + vC * 0.15;
  vec3 under = mix(avg * 0.8, uUnder, 0.16);
  vec3 amb = ambOf(n);
  vec3 lampP = lampLight(vW, n);
  vec3 baseCol = shadeL(under, amb, lampP);
  vec3 emAvg = mix(vC, vec3(1.0, 0.86, 0.45), 0.25) * 1.05;
  baseCol = mix(baseCol, emAvg * 0.7, em);
  // the town paints itself on arrival: bare canvas first, then dab after dab
  const vec3 CANVAS = vec3(0.9, 0.85, 0.74);
  float grounded = smoothstep(0.0, 0.3, uReveal);
  baseCol = mix(CANVAS * (0.9 + 0.1 * n.y), baseCol, grounded);
  vec3 farCol = mix(shadeL(avg, amb, lampP), emAvg, em) * 0.96;
  farCol = mix(baseCol, farCol, grounded);

  // two stroke levels: fine strokes up close, 4x broader strokes further away, so the
  // brushwork keeps roughly the same size on screen, the way a painter's would
  float a0 = 0.22 * uDetail, a1 = 0.55 * uDetail;
  float lod0 = smoothstep(a0, a1, fw);
  float lod1 = smoothstep(a0, a1, fw * 0.25);
  vec3 col0 = lod0 < 0.999 ? paintLevel(P, cs, fw, seed, n, U, V, amb, lampP, baseCol, em) : farCol;
  vec3 col1 = (lod0 > 0.001 && lod1 < 0.999) ? paintLevel(P, cs * 4.0, fw * 0.25, seed + 11.3, n, U, V, amb, lampP, baseCol, em) : farCol;
  col1 = mix(col1, farCol, lod1);
  vec3 col = mix(col0, col1, lod0);
  col = applyFog(col, vW);
  gl_FragColor = vec4(col, 1.0);
}
`;
