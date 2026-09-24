// 天空：解析大气渐变 + 2.5D 积云层（带自阴影与银边）+ 夜空星月。
// 同一个 skyColor() 也被海面反射与“斯涅尔窗”折射使用。
import * as THREE from 'three';
import { U, COMMON_GLSL } from './optics.js';

export const SKY_U = {
  uCloudCover: { value: 0.4 },
  uCloudDens: { value: 0.6 },
  uCloudOff: { value: new THREE.Vector2() },
  uStorm: { value: 0 },
  uHaze: { value: 0.2 },
  uMoonDir: { value: new THREE.Vector3(-0.3, 0.5, -0.8).normalize() },
};

export const SKY_GLSL = /* glsl */`
uniform float uCloudCover;
uniform float uCloudDens;
uniform vec2 uCloudOff;
uniform float uStorm;
uniform float uHaze;
uniform vec3 uMoonDir;

vec3 skyBase(vec3 rd){
  float sunH = uSunDir.y;
  float day = smoothstep(-0.12, 0.22, sunH);
  float dusk = smoothstep(0.42, 0.02, sunH) * smoothstep(-0.16, 0.0, sunH);
  float h = max(rd.y, 0.0);
  vec3 zen = mix(vec3(0.004, 0.007, 0.018), vec3(0.07, 0.2, 0.62), day);
  vec3 hor = mix(vec3(0.012, 0.016, 0.03), vec3(0.58, 0.7, 0.88), day);
  hor = mix(hor, vec3(1.05, 0.55, 0.30), dusk * 0.85);
  zen = mix(zen, vec3(0.16, 0.18, 0.36), dusk * 0.5);
  vec3 col = mix(hor, zen, pow(h, 0.42));
  // 太阳一侧的暖色光晕
  float mu = dot(rd, uSunDir);
  float muC = max(mu, 0.0);
  vec3 sunTint = mix(vec3(1.0, 0.95, 0.85), vec3(1.0, 0.55, 0.25), dusk);
  col += sunTint * (0.10 * pow(muC, 6.0) + 0.35 * pow(muC, 60.0)) * (0.3 + 0.7 * day + dusk);
  col += vec3(1.0, 0.5, 0.25) * dusk * 0.35 * pow(1.0 - h, 6.0) * (0.5 + 0.5 * muC);
  // 风暴：压暗并去饱和
  col = mix(col, vec3(luma(col)) * vec3(0.55, 0.6, 0.66), uStorm * 0.85);
  // 夜空：星星与月亮
  if (uNight > 0.01){
    vec3 d = rd * 260.0;
    vec3 cell = floor(d);
    float s = hash13(cell);
    float star = step(0.9965, s) * smoothstep(0.5, 0.0, length(fract(d) - 0.5));
    star *= 0.6 + 0.4 * sin(uTime * (2.0 + s * 5.0) + s * 40.0);
    float mw = smoothstep(0.35, 0.0, abs(dot(rd, normalize(vec3(0.3, 0.4, -0.86)))));
    col += uNight * (star * 1.4 * h + vec3(0.03, 0.035, 0.06) * mw * vnoise(rd.xz * 30.0) * h) * (1.0 - uCloudCover * 0.6);
    float md = dot(rd, uMoonDir);
    col += uNight * (vec3(1.3, 1.3, 1.2) * smoothstep(0.99955, 0.99975, md) + vec3(0.06, 0.07, 0.1) * pow(max(md, 0.0), 40.0));
  }
  return col;
}

// 2.5D 积云：云底平面上的覆盖场 + 朝太阳方向的密度差近似自阴影
float cloudField(vec2 p){
  vec2 q = p * 0.00042 + uCloudOff;
  float base = fbm2(q);
  float det = fbm2(q * 4.3 + 11.7);
  float n = base * 0.78 + det * 0.3;
  float cov = mix(0.72, 0.22, uCloudCover);
  return smoothstep(cov, cov + 0.22, n);
}
vec4 clouds(vec3 ro, vec3 rd){
  if (rd.y < 0.012) return vec4(0.0);
  float H = 1600.0 - uStorm * 700.0;
  float t = (H - ro.y) / rd.y;
  vec2 p = ro.xz + rd.xz * t;
  float d = cloudField(p);
  if (d < 0.003) return vec4(0.0);
  vec2 sd = normalize(uSunDir.xz + 1e-4) * 260.0;
  float d2 = cloudField(p + sd);
  float d3 = cloudField(p + sd * 2.2);
  float shadow = exp(-(d2 * 0.9 + d3 * 0.5) * (0.45 + uCloudDens * 0.7));
  float day = smoothstep(-0.12, 0.22, uSunDir.y);
  float dusk = smoothstep(0.42, 0.02, uSunDir.y) * smoothstep(-0.16, 0.0, uSunDir.y);
  vec3 lit = mix(vec3(1.05, 1.02, 0.98), vec3(1.1, 0.62, 0.36), dusk) * (1.15 * day + 0.3 * dusk);
  vec3 shade = mix(vec3(0.5, 0.56, 0.66), vec3(0.4, 0.3, 0.38), dusk) * (0.8 * day + 0.12);
  shade = mix(shade, vec3(0.12, 0.13, 0.15), uStorm * 0.85);
  lit = mix(lit, vec3(0.35, 0.37, 0.4), uStorm * 0.8);
  float edge = 1.0 - smoothstep(0.0, 0.55, d);
  float mu = max(dot(rd, uSunDir), 0.0);
  vec3 col = mix(shade, lit, shadow * (0.55 + 0.45 * (1.0 - d)));
  col += lit * edge * pow(mu, 8.0) * 1.8;              // 银边
  col *= 1.0 - 0.28 * smoothstep(0.5, 1.0, d) * uCloudDens;   // 厚云底更暗
  col = mix(col, col * 0.02 + vec3(0.004, 0.005, 0.009), uNight * (1.0 - day));
  col += vec3(0.8, 0.85, 1.0) * uFlash * 2.5 * d;
  float fade = smoothstep(0.012, 0.16, rd.y);
  float a = clamp(d * (0.75 + 0.25 * uCloudDens) * 1.15, 0.0, 1.0) * fade;
  // 远处被大气吞没
  col = mix(col, skyBase(rd), 1.0 - smoothstep(0.0, 0.25, rd.y) * 0.9);
  return vec4(col, a);
}
// 体积云：在 1400–2300 米的云层里步进，云柱随高度收窄形成积云的圆顶
float cloudBase2(vec2 p){
  vec2 q = p * 0.00058 + uCloudOff;
  return fbm2(q) * 0.8 + vnoise(q * 4.7 + 3.7) * 0.28;
}
vec4 cloudsVol(vec3 ro, vec3 rd){
  if (rd.y < 0.008) return vec4(0.0);
  float H0 = 1300.0 - uStorm * 600.0, H1 = H0 + 900.0 + uStorm * 600.0;
  float t0 = (H0 - ro.y) / rd.y, t1 = (H1 - ro.y) / rd.y;
  if (t0 > 60000.0) return vec4(0.0);
  t1 = min(t1, t0 + 7000.0);
  const int N = 14;
  float dt = (t1 - t0) / float(N);
  float cov = mix(0.8, 0.24, uCloudCover);
  float T = 1.0;
  vec3 acc = vec3(0.0);
  float day = smoothstep(-0.12, 0.22, uSunDir.y);
  float dusk = smoothstep(0.42, 0.02, uSunDir.y) * smoothstep(-0.16, 0.0, uSunDir.y);
  vec3 sunC = mix(vec3(1.05, 1.0, 0.95), vec3(1.2, 0.62, 0.32), dusk) * (1.6 * day + 0.35 * dusk);
  sunC = mix(sunC, vec3(0.38, 0.4, 0.44), uStorm * 0.8);
  vec3 ambTop = mix(vec3(0.62, 0.7, 0.84), vec3(0.45, 0.36, 0.46), dusk) * (0.85 * day + 0.1);
  vec3 ambBot = mix(vec3(0.4, 0.44, 0.52), vec3(0.26, 0.2, 0.26), dusk) * (0.8 * day + 0.08);
  ambTop = mix(ambTop, vec3(0.14, 0.15, 0.17), uStorm * 0.8);
  ambBot = mix(ambBot, vec3(0.06, 0.065, 0.075), uStorm * 0.85);
  float mu = max(dot(rd, uSunDir), 0.0);
  float phase = 0.55 + 1.3 * pow(mu, 12.0);
  vec2 sd = normalize(uSunDir.xz + 1e-4);
  float j = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  for (int i = 0; i < N; i++){
    float t = t0 + (float(i) + j) * dt;
    vec3 p = ro + rd * t;
    float hn = clamp((p.y - H0) / (H1 - H0), 0.0, 1.0);
    float b = cloudBase2(p.xz);
    float thr = cov + hn * hn * 0.32 + (1.0 - smoothstep(0.0, 0.12, hn)) * 0.05;
    float d = smoothstep(thr, thr + 0.09, b) * (0.35 + uCloudDens);
    if (d < 0.002) continue;
    // 朝太阳方向的遮挡
    float bs = cloudBase2(p.xz + sd * 220.0);
    float hs = min(hn + 0.2, 1.0);
    float ds = smoothstep(cov + hs * hs * 0.32, cov + hs * hs * 0.32 + 0.09, bs);
    float lightT = exp(-ds * 1.1 * (0.3 + 0.6 * uCloudDens)) * (0.45 + 0.55 * hn);
    float powder = 1.0 - exp(-d * 4.0);
    vec3 c = sunC * lightT * phase * (0.5 + 0.5 * powder) + mix(ambBot, ambTop, hn);
    float a = 1.0 - exp(-d * dt * 0.0045);
    acc += T * a * c;
    T *= 1.0 - a;
    if (T < 0.03) break;
  }
  acc = mix(acc, acc * 0.02 + vec3(0.004, 0.005, 0.009) * (1.0 - T), uNight * (1.0 - day));
  acc += vec3(0.8, 0.85, 1.0) * uFlash * 2.0 * (1.0 - T);
  float fade = smoothstep(0.008, 0.12, rd.y);
  float alpha = (1.0 - T) * fade;
  // 远处的云融进大气
  vec3 col = alpha > 0.001 ? acc / max(1.0 - T, 1e-3) : vec3(0.0);
  col = mix(col, skyBase(rd), (1.0 - smoothstep(0.0, 0.3, rd.y)) * 0.55);
  return vec4(col, alpha);
}
vec3 seaHorizon(vec3 rd){
  vec3 r = vec3(rd.x, abs(rd.y) + 0.02, rd.z);
  return skyBase(r) * 0.55 + uAirFog * 0.25;
}
vec3 skyColor(vec3 ro, vec3 rd, bool withSun){
  vec3 col = skyBase(rd);
  vec4 c = clouds(ro, rd);
  col = mix(col, c.rgb, c.a);
  if (withSun){
    float mu = dot(rd, uSunDir);
    float disk = smoothstep(0.99955, 0.99985, mu);
    float day = smoothstep(-0.05, 0.1, uSunDir.y);
    col += disk * uSunCol * 22.0 * (1.0 - c.a * 0.95) * day;
  }
  col += vec3(0.7, 0.75, 0.9) * uFlash * 0.6;
  return col * (1.0 + uHaze * 0.1);
}
`;

// 水下看“无尽的水体”，以及从水面往下看到的深水色
export const DOME_FRAG = /* glsl */`
${COMMON_GLSL}
${SKY_GLSL}
varying vec3 vDir;
void main(){
  vec3 rd = normalize(vDir);
  vec3 col;
  if (uCamUnder > 0.5){
    float d0 = max(-uCamPos.y, 0.0);
    float L = rd.y > 0.0 ? d0 / rd.y : 1e5;
    col = waterInscatter(uCamPos, rd, min(L, 1e5));
  } else {
    if (rd.y >= 0.0){
      col = skyBase(rd);
      vec4 c = cloudsVol(uCamPos, rd);
      col = mix(col, c.rgb, c.a);
      float mu = dot(rd, uSunDir);
      float disk = smoothstep(0.99955, 0.99985, mu) * smoothstep(-0.05, 0.1, uSunDir.y);
      col += disk * uSunCol * 22.0 * (1.0 - c.a * 0.95);
      col += vec3(0.7, 0.75, 0.9) * uFlash * 0.6;
      col = mix(col, uAirFog, (1.0 - smoothstep(0.0, 0.08, rd.y)) * 0.55 * (0.35 + uHaze));
    } else {
      vec3 rdw = normalize(vec3(rd.x * 0.75, rd.y, rd.z * 0.75));
      col = waterInscatter(vec3(uCamPos.x, -0.05, uCamPos.z), rdw, 1e5) * vec3(0.55, 0.5, 0.72);
      col = mix(col, seaHorizon(rd), smoothstep(-0.05, 0.0, rd.y));
    }
  }
  gl_FragColor = vec4(col, 1.0);
}
`;

export function createSkyDome() {
  const geo = new THREE.SphereGeometry(1, 64, 32);
  const mat = new THREE.ShaderMaterial({
    uniforms: { ...U, ...SKY_U },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main(){
        vDir = position;
        vec4 p = modelViewMatrix * vec4(position * 20000.0, 1.0);
        gl_Position = projectionMatrix * p;
        gl_Position.z = gl_Position.w * 0.99999;
      }`,
    fragmentShader: DOME_FRAG,
    side: THREE.BackSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  return mesh;
}
