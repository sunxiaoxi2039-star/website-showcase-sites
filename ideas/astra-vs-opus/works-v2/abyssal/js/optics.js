// 共享光学：所有材质引用同一组 uniform；水体衰减、散射、焦散、潜水灯全部在这里定义。
import * as THREE from 'three';
import { clamp, smoothstep, lerp } from './noise.js';

const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export const U = {
  uTime: { value: 0 },
  uCamPos: { value: v3() },
  uCamUnder: { value: 1 },
  uSunDir: { value: v3(0.3, 0.7, 0.3).normalize() },
  uSunCol: { value: v3(3, 3, 3) },
  uSkyAmb: { value: v3(0.5, 0.6, 0.8) },
  uRefrSun: { value: v3(0, 1, 0) },
  uKd: { value: v3(0.1, 0.04, 0.03) },
  uKv: { value: v3(0.25, 0.06, 0.05) },
  uScat: { value: v3(0.01, 0.03, 0.035) },
  uLamp: { value: 0 },
  uLampPos: { value: v3() },
  uLampDir: { value: v3(0, 0, -1) },
  uLampRight: { value: v3(1, 0, 0) },
  uGlow: { value: 1 },
  uCaustStr: { value: 1 },
  uAirFog: { value: v3(0.6, 0.7, 0.8) },
  uAirDensity: { value: 0.00005 },
  uCurrent: { value: new THREE.Vector2(0.2, 0.1) },
  uNight: { value: 0 },
  uSilt: { value: 0 },
  uFlash: { value: 0 },
  uBloom: { value: 0 },     // 表层藻华（夜间受扰发光）
  uCover: { value: 1 },
  uShadowMap: { value: null },
  uShadowMat: { value: new THREE.Matrix4() },
  uShadowOn: { value: 0 },
};

export const COMMON_GLSL = /* glsl */`
uniform float uTime;
uniform vec3 uCamPos;
uniform float uCamUnder;
uniform vec3 uSunDir;
uniform vec3 uSunCol;
uniform vec3 uSkyAmb;
uniform vec3 uRefrSun;
uniform vec3 uKd;
uniform vec3 uKv;
uniform vec3 uScat;
uniform float uLamp;
uniform vec3 uLampPos;
uniform vec3 uLampDir;
uniform vec3 uLampRight;
uniform float uGlow;
uniform float uCaustStr;
uniform vec3 uAirFog;
uniform float uAirDensity;
uniform vec2 uCurrent;
uniform float uNight;
uniform float uSilt;
uniform float uFlash;
uniform sampler2D uShadowMap;
uniform mat4 uShadowMat;
uniform float uShadowOn;

float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float hash13(vec3 p3){ p3 = fract(p3 * 0.1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash12(i), b = hash12(i + vec2(1,0)), c = hash12(i + vec2(0,1)), d = hash12(i + vec2(1,1));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float vnoise3(vec3 p){
  vec3 i = floor(p), f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  float n000 = hash13(i), n100 = hash13(i + vec3(1,0,0)), n010 = hash13(i + vec3(0,1,0)), n110 = hash13(i + vec3(1,1,0));
  float n001 = hash13(i + vec3(0,0,1)), n101 = hash13(i + vec3(1,0,1)), n011 = hash13(i + vec3(0,1,1)), n111 = hash13(i + vec3(1,1,1));
  return mix(mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y), mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y), u.z);
}
float fbm2(vec2 p){
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++){ s += a * vnoise(p); p = mat2(1.6, 1.2, -1.2, 1.6) * p + 3.1; a *= 0.5; }
  return s / 0.9375;
}
float luma(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

// 焦散：两层随时间漂移的“绝对值噪声网”，沿折射后的太阳方向投影到水面
float causticWeb(vec2 p, float t){
  vec2 q = p;
  float n1 = vnoise(q * 1.0 + vec2(t * 0.35, t * 0.22));
  float n2 = vnoise(q * 1.3 + vec2(-t * 0.27, t * 0.31) + 7.3);
  float w1 = 1.0 - abs(n1 * 2.0 - 1.0);
  float w2 = 1.0 - abs(n2 * 2.0 - 1.0);
  float c = pow(w1, 7.0) + pow(w2, 7.0);
  return c;
}
float caustics(vec3 p){
  float d = max(-p.y, 0.0);
  vec2 e = p.xz + uRefrSun.xz * (d / max(uRefrSun.y, 0.25));
  float t = uTime;
  float c = causticWeb(e * 0.55, t) * 0.65 + causticWeb(e * 1.15 + 3.7, t * 1.3) * 0.45;
  // 越深越模糊、越弱
  float blur = clamp(d / 45.0, 0.0, 1.0);
  return mix(c, 0.35, blur) * exp(-d / 30.0);
}

// 阳光阴影（沿折射后的太阳方向的正交深度图，4 点 PCF，越深越软）
float sunShadow(vec3 p, vec3 n){
  if (uShadowOn < 0.5) return 1.0;
  vec4 sc = uShadowMat * vec4(p + n * 0.06, 1.0);
  vec3 q = sc.xyz * 0.5 + 0.5;
  if (q.x < 0.0 || q.x > 1.0 || q.y < 0.0 || q.y > 1.0 || q.z > 1.0) return 1.0;
  float edge = smoothstep(0.0, 0.12, min(min(q.x, 1.0 - q.x), min(q.y, 1.0 - q.y)));
  float d = max(-p.y, 0.0);
  float r = (1.2 + d * 0.08) / 2048.0;
  float s = 0.0;
  s += step(q.z - 0.0015, texture2D(uShadowMap, q.xy + vec2(-r, -r)).r);
  s += step(q.z - 0.0015, texture2D(uShadowMap, q.xy + vec2(r, -r)).r);
  s += step(q.z - 0.0015, texture2D(uShadowMap, q.xy + vec2(-r, r)).r);
  s += step(q.z - 0.0015, texture2D(uShadowMap, q.xy + vec2(r, r)).r);
  s *= 0.25;
  float strength = 0.9 * exp(-d / 90.0);
  return mix(1.0, mix(1.0 - strength, 1.0, s), edge);
}

vec3 downwell(float d){ return (uSunCol * uRefrSun.y + uSkyAmb) * exp(-uKd * max(d, 0.0)); }

#define LAMP_I 1.4
vec3 lampLight(vec3 p, vec3 n){
  if (uLamp <= 0.001) return vec3(0.0);
  vec3 sum = vec3(0.0);
  for (int i = 0; i < 2; i++){
    vec3 lp = uLampPos + uLampRight * (i == 0 ? -0.45 : 0.45);
    vec3 L = lp - p; float d = length(L); L /= max(d, 1e-3);
    float cone = smoothstep(0.72, 0.92, dot(-L, uLampDir)) * 0.85 + 0.15 * smoothstep(0.5, 0.78, dot(-L, uLampDir));
    float fall = 1.0 / (1.0 + 0.025 * d * d);
    sum += cone * fall * (0.2 + 0.8 * max(dot(n, L), 0.0)) * exp(-uKv * d * 0.5);
  }
  return sum * uLamp * vec3(1.0, 0.94, 0.84) * LAMP_I;
}

// 水下表面光照（反照率、法线、环境光遮蔽、焦散权重）
vec3 shadeUnder(vec3 albedo, vec3 p, vec3 n, float ao, float cmask){
  float d = max(-p.y, 0.0);
  vec3 att = exp(-uKd * d);
  float ndl = max(dot(n, uRefrSun), 0.0);
  float c = caustics(p) * uCaustStr * cmask;
  float sh = sunShadow(p, n);
  vec3 direct = uSunCol * uRefrSun.y * att * ndl * (0.55 + 2.2 * c * sh) * sh;
  float hemi = 0.5 + 0.5 * n.y;
  vec3 amb = (uSkyAmb + uSunCol * uRefrSun.y * 0.25) * att * (0.18 + 0.82 * hemi) * ao;
  // 水体侧向散射的柔光（让阴影面不至于死黑）
  amb += downwell(d) * (uScat / uKv) * 0.9 * ao;
  return albedo * (direct + amb + lampLight(p, n) * mix(1.0, ao, 0.5));
}

// 沿视线的解析水体内散射：∫ b·phase·E(d(t))·e^{-Kv t} dt
vec3 waterInscatter(vec3 ro, vec3 rd, float L){
  float d0 = max(-ro.y, 0.0);
  vec3 a = uKd * rd.y - uKv;
  vec3 e0 = (uSunCol * uRefrSun.y + uSkyAmb) * exp(-uKd * d0);
  float mu = max(dot(rd, uRefrSun), 0.0);
  float phase = 0.55 + 0.9 * pow(mu, 5.0) + 1.6 * pow(mu, 60.0);
  return uScat * phase * e0 * (exp(a * L) - 1.0) / a;
}

vec3 airFog(vec3 col, float L, vec3 rd){
  float f = 1.0 - exp(-L * uAirDensity);
  return mix(col, uAirFog, f);
}

vec3 applyWater(vec3 col, vec3 p){
  vec3 ro = uCamPos;
  vec3 v = p - ro;
  float L = max(length(v), 1e-4);
  vec3 rd = v / L;
  if (uCamUnder > 0.5){
    return col * exp(-uKv * L) + waterInscatter(ro, rd, L);
  }
  if (p.y >= 0.0) return airFog(col, L, rd);
  float te = clamp(ro.y / max(ro.y - p.y, 1e-4), 0.0, 1.0);
  vec3 e = ro + v * te;
  float Lw = L * (1.0 - te);
  vec3 rdw = normalize(vec3(rd.x * 0.75, rd.y, rd.z * 0.75));
  // 从空中看：折射后的视线更陡、光要往返两次，按更长的等效路径衰减
  vec3 c = col * exp(-uKv * Lw * 1.8) + waterInscatter(e - vec3(0.0, 0.01, 0.0), rdw, Lw * 1.8) * vec3(0.55, 0.5, 0.72);
  return airFog(c, L * te, rd);
}
`;

// —— 环境状态 → uniform ——
export const LIGHT_PRESETS = {
  day: { sun: 52, cloud: 0.38, wind: 7, swell: 0.45, storm: 0, rain: 0, haze: 0.25, cloudDensity: 0.6, chop: 0.8, azimuth: 205 },
  dusk: { sun: 5, cloud: 0.42, wind: 5, swell: 0.35, storm: 0, rain: 0, haze: 0.4, cloudDensity: 0.55, chop: 0.7, azimuth: 250 },
  storm: { sun: 32, cloud: 0.92, wind: 21, swell: 0.9, storm: 0.85, rain: 0.8, haze: 0.7, cloudDensity: 0.9, chop: 1.2, azimuth: 205 },
  night: { sun: -28, cloud: 0.25, wind: 6, swell: 0.4, storm: 0, rain: 0, haze: 0.2, cloudDensity: 0.5, chop: 0.8, azimuth: 205 },
};

export const DEFAULT_WATER = { clarity: 1, current: 1, glow: 1, lamp: 'auto', upwelling: 1 };

export class Environment {
  constructor() {
    this.weather = { ...LIGHT_PRESETS.day, windDir: 40, swellDir: 20, period: 1 };
    this.water = { ...DEFAULT_WATER };
    this.lightName = 'day';
    this.exposure = 1;
    this.lampAuto = 0;
    this.lampLevel = 0;
    this.silt = 0;
    this.bloom = 0;
    this.flash = 0;
    this.nightF = 0;
    this.wb = new THREE.Vector3(1, 1, 1);
  }
  setPreset(name) {
    const p = LIGHT_PRESETS[name];
    if (!p) return;
    this.lightName = name;
    Object.assign(this.weather, p);
  }
  update(dt, camPos, under) {
    const w = this.weather, wa = this.water;
    const el = (w.sun * Math.PI) / 180, az = (w.azimuth * Math.PI) / 180;
    const sunDir = new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
    U.uSunDir.value.copy(sunDir);
    const sunH = sunDir.y;
    const day = smoothstep(-0.1, 0.22, sunH);
    const dusk = smoothstep(0.42, 0.02, sunH) * smoothstep(-0.14, 0.02, sunH);
    const night = 1 - smoothstep(-0.2, 0.0, sunH);
    this.nightF = night;
    U.uNight.value = night;
    const cloudBlock = 1 - 0.75 * Math.pow(w.cloud, 1.5) * w.cloudDensity * 1.3;
    const stormDim = 1 - 0.8 * w.storm;
    // 太阳辐照（含低角度的红化）
    const tint = new THREE.Vector3(1, lerp(1, 0.62, dusk), lerp(1, 0.38, dusk));
    const sunI = 3.1 * day * clamp(cloudBlock, 0.12, 1) * stormDim;
    const sunCol = tint.clone().multiplyScalar(sunI);
    // 夜晚的月光（很弱，但给水下留下一丝蓝）
    const moon = night * 0.045 * (1 - w.cloud * 0.7);
    sunCol.add(new THREE.Vector3(0.7, 0.8, 1.0).multiplyScalar(moon));
    U.uSunCol.value.copy(sunCol);
    const amb = new THREE.Vector3(0.42, 0.56, 0.82).multiplyScalar(0.55 * day * (1 - 0.35 * w.storm));
    amb.add(new THREE.Vector3(0.95, 0.55, 0.35).multiplyScalar(0.12 * dusk));
    amb.add(new THREE.Vector3(0.5, 0.55, 0.6).multiplyScalar(0.35 * w.cloud * day));
    amb.add(new THREE.Vector3(0.02, 0.03, 0.05).multiplyScalar(night));
    amb.addScalar(this.flash * 1.5);
    U.uSkyAmb.value.copy(amb);
    // 折射进水里的太阳方向（夜里用月亮方向，近似同一方位）
    let sd = sunDir.clone();
    if (sunH < 0.02) sd.set(-sunDir.x, Math.max(0.35, -sunDir.y), -sunDir.z).normalize();
    const cosI = Math.max(sd.y, 0.02);
    const sinI = Math.sqrt(1 - cosI * cosI);
    const sinT = sinI / 1.333;
    const cosT = Math.sqrt(1 - sinT * sinT);
    const h = Math.hypot(sd.x, sd.z) || 1;
    U.uRefrSun.value.set((sd.x / h) * sinT, cosT, (sd.z / h) * sinT);
    // 水体光学：清澈度越低，衰减越强；上升流带来营养盐，水更绿
    const c = wa.clarity;
    const green = clamp((wa.upwelling - 1) * 0.12, -0.1, 0.3) + this.silt * 0.3;
    const turb = (1 / c) * (1 - 0.4 * (this.offshore || 0)) + this.silt * 1.5;
    U.uKd.value.set(0.055 + 0.018 * turb, 0.03 + 0.009 * turb + green * 0.02, 0.022 + 0.01 * turb + green * 0.05);
    U.uScat.value.set(0.0012 + 0.0015 * turb, 0.0045 + 0.004 * turb + green * 0.012, 0.0075 + 0.004 * turb);
    const kd = U.uKd.value, sc = U.uScat.value;
    U.uKv.value.set(kd.x + 0.035 + sc.x * 2, kd.y + 0.006 + sc.y, kd.z + 0.006 + sc.z);
    // 焦散强度：直射越强、云越少越明显
    U.uCaustStr.value = clamp(sunI / 3.1, 0, 1) * (0.5 + 0.5 * clamp(w.wind / 8, 0.2, 1.5)) * (1 - 0.6 * w.storm);
    // 空气雾
    const fogC = new THREE.Vector3(0.62, 0.72, 0.84).multiplyScalar(day * (1 - 0.5 * w.storm));
    fogC.add(new THREE.Vector3(0.9, 0.55, 0.38).multiplyScalar(dusk * 0.6));
    fogC.add(new THREE.Vector3(0.02, 0.025, 0.04).multiplyScalar(night));
    U.uAirFog.value.copy(fogC);
    U.uAirDensity.value = 0.00002 + 0.00012 * w.haze + 0.0004 * w.storm + 0.0002 * w.rain;
    U.uGlow.value = wa.glow;
    U.uSilt.value = this.silt;
    U.uFlash.value = this.flash;
    const cur = wa.current;
    U.uCurrent.value.set(Math.cos(0.7) * 0.25 * cur, Math.sin(0.7) * 0.25 * cur);

    // 潜水灯：自动模式下随深度渐亮
    const depth = Math.max(0, -camPos.y);
    const E = this.downwellLum(depth);
    this.lampAuto = under ? smoothstep(0.02, 0.0015, E) : 0;
    let target = this.lampAuto;
    if (wa.lamp === 'on') target = under ? 1 : 0;
    if (wa.lamp === 'off') target = 0;
    this.lampLevel += (target - this.lampLevel) * Math.min(1, dt * 2.5);
    U.uLamp.value = this.lampLevel;

    // 自动曝光（以下行辐照为准，缓慢适应）
    let targetExp;
    if (under) {
      const scene = E * 0.55 + this.lampLevel * 0.09 + 0.0012;
      targetExp = clamp(0.3 / scene, 0.6, 120);
    } else {
      const skyL = sunI * 0.28 + 0.6 * (amb.x + amb.y + amb.z) / 3 + 0.004;
      targetExp = clamp(0.62 / skyL, 0.35, lerp(60, 7, night));
    }
    // 潜水相机式的部分白平衡：浅水恢复一些暖色，深处仍然是蓝色
    const kd2 = U.uKd.value;
    const dd = under ? Math.min(depth, 60) : 0;
    const kvv = U.uKv.value;
    // 浅处按阳光下行路径校正；深处按潜水灯往返约 12 米的路径校正
    const lampW = smoothstep(60, 220, depth) * this.lampLevel;
    const er = lerp(Math.exp(-kd2.x * dd), Math.exp(-kvv.x * 12), lampW);
    const eg = lerp(Math.exp(-kd2.y * dd), Math.exp(-kvv.y * 12), lampW);
    const eb = lerp(Math.exp(-kd2.z * dd), Math.exp(-kvv.z * 12), lampW);
    const el2 = 0.2126 * er + 0.7152 * eg + 0.0722 * eb;
    const wbAmt = under ? lerp(0.8 * (1 - smoothstep(40, 200, depth)), 0.9, lampW) : 0;
    this.wb.set(Math.pow(er / el2, -wbAmt), Math.pow(eg / el2, -wbAmt), Math.pow(eb / el2, -wbAmt));
    this.wb.x = clamp(this.wb.x, 0.5, 3.2); this.wb.y = clamp(this.wb.y, 0.5, 2); this.wb.z = clamp(this.wb.z, 0.5, 2);
    const k = 1 - Math.exp(-dt * (under ? 1.6 : 3));
    this.exposure = Math.exp(lerp(Math.log(this.exposure), Math.log(targetExp), k));
    // 事件衰减
    this.silt = Math.max(0, this.silt - dt * 0.03);
    this.flash = Math.max(0, this.flash - dt * 3.5);
  }
  downwellLum(depth) {
    const s = U.uSunCol.value, a = U.uSkyAmb.value, r = U.uRefrSun.value.y, kd = U.uKd.value;
    const er = (s.x * r + a.x) * Math.exp(-kd.x * depth);
    const eg = (s.y * r + a.y) * Math.exp(-kd.y * depth);
    const eb = (s.z * r + a.z) * Math.exp(-kd.z * depth);
    return 0.2126 * er + 0.7152 * eg + 0.0722 * eb;
  }
}
