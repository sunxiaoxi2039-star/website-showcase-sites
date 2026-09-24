// 后期：HDR 场景 → 体积光（阳光光柱 + 潜水灯光束，沿视线步进）→ 泛光 → 水线分屏合成 → ACES 色调映射。
import * as THREE from 'three';
import { U, COMMON_GLSL } from './optics.js';
import { WAVE_GLSL, WAVE_U } from './surface.js';

const FS_VERT = /* glsl */`
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

function pass(frag, uniforms) {
  const m = new THREE.ShaderMaterial({ uniforms, vertexShader: FS_VERT, fragmentShader: frag, depthTest: false, depthWrite: false });
  return m;
}

export class Post {
  constructor(renderer) {
    this.renderer = renderer;
    const opts = { type: THREE.HalfFloatType, format: THREE.RGBAFormat, depthBuffer: true };
    this.rtA = new THREE.WebGLRenderTarget(4, 4, opts);
    this.rtA.depthTexture = new THREE.DepthTexture(4, 4);
    this.rtB = new THREE.WebGLRenderTarget(4, 4, opts);
    this.rtB.depthTexture = new THREE.DepthTexture(4, 4);
    const small = { type: THREE.HalfFloatType, format: THREE.RGBAFormat, depthBuffer: false };
    this.rtVol = new THREE.WebGLRenderTarget(4, 4, small);
    this.rtB1 = new THREE.WebGLRenderTarget(4, 4, small);
    this.rtB2 = new THREE.WebGLRenderTarget(4, 4, small);
    this.rtB3 = new THREE.WebGLRenderTarget(4, 4, small);
    this.rtB4 = new THREE.WebGLRenderTarget(4, 4, small);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.quad.frustumCulled = false;
    this.scene = new THREE.Scene();
    this.scene.add(this.quad);
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.invProj = new THREE.Matrix4();
    this.camWorld = new THREE.Matrix4();
    this.volScale = 0.5;

    // 体积光（半分辨率）
    this.volMat = pass(/* glsl */`
      ${COMMON_GLSL}
      uniform sampler2D tDepth;
      uniform mat4 uInvProj;
      uniform mat4 uCamWorld;
      uniform float uNear, uFar;
      uniform float uSteps;
      varying vec2 vUv;
      float ign(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
      float shaft(vec2 e){
        float a = vnoise(e * 0.09 + vec2(uTime * 0.05, uTime * 0.03));
        float b = vnoise(e * 0.23 - vec2(uTime * 0.08, -uTime * 0.02) + 4.0);
        return smoothstep(0.42, 0.85, a * 0.65 + b * 0.45);
      }
      void main(){
        float z = texture2D(tDepth, vUv).x;
        vec4 vp = uInvProj * vec4(vUv * 2.0 - 1.0, z * 2.0 - 1.0, 1.0);
        vp /= vp.w;
        vec3 wp = (uCamWorld * vec4(vp.xyz, 1.0)).xyz;
        vec3 ro = uCamPos;
        vec3 rd = normalize(wp - ro);
        float dist = length(wp - ro);
        if (z >= 0.99999) dist = 1e4;
        float d0 = max(-ro.y, 0.0);
        if (rd.y > 0.0) dist = min(dist, d0 / rd.y);
        float maxT = min(dist, 80.0);
        vec3 acc = vec3(0.0);
        vec3 accL = vec3(0.0);
        float steps = uSteps;
        float dt = maxT / steps;
        float j = ign(gl_FragCoord.xy + fract(uTime * 7.0) * 60.0);
        float mu = max(dot(rd, uRefrSun), 0.0);
        float ph = 0.3 + 1.6 * pow(mu, 6.0);
        float sunOn = step(0.0005, luma(uSunCol)) * uCaustStr;
        for (int i = 0; i < 32; i++){
          if (float(i) >= steps) break;
          float t = (float(i) + j) * dt;
          vec3 p = ro + rd * t;
          float d = max(-p.y, 0.0);
          vec3 tr = exp(-uKv * t);
          if (sunOn > 0.0 && d < 140.0){
            vec2 e = p.xz + uRefrSun.xz * (d / max(uRefrSun.y, 0.25));
            float s = shaft(e) * (1.0 - smoothstep(20.0, 140.0, d));
            acc += uSunCol * uRefrSun.y * exp(-uKd * d) * s * ph * tr * sunOn * 0.9;
          }
          if (uLamp > 0.001){
            for (int k = 0; k < 2; k++){
              vec3 lp = uLampPos + uLampRight * (k == 0 ? -0.45 : 0.45);
              vec3 L = p - lp; float dl = length(L);
              float cone = smoothstep(0.8, 0.95, dot(L / max(dl, 1e-3), uLampDir));
              accL += vec3(0.7, 0.88, 1.0) * cone * uLamp * LAMP_I / (1.0 + 0.12 * dl * dl) * exp(-uKv * dl) * tr;
            }
          }
        }
        acc *= uScat * dt * (1.0 + uSilt * 2.0) * 3.5;
        acc += accL * dt * (0.0035 + uSilt * 0.01);
        gl_FragColor = vec4(acc, 1.0);
      }`, {
      ...U,
      tDepth: { value: null },
      uInvProj: { value: this.invProj },
      uCamWorld: { value: this.camWorld },
      uNear: { value: 0.1 }, uFar: { value: 30000 },
      uSteps: { value: 20 },
    });

    this.brightMat = pass(/* glsl */`
      uniform sampler2D tSrc; uniform sampler2D tVol; uniform float uExposure; uniform vec2 uTexel;
      varying vec2 vUv;
      void main(){
        vec3 c = vec3(0.0);
        c += texture2D(tSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb;
        c += texture2D(tSrc, vUv + uTexel * vec2(1.0, -1.0)).rgb;
        c += texture2D(tSrc, vUv + uTexel * vec2(-1.0, 1.0)).rgb;
        c += texture2D(tSrc, vUv + uTexel * vec2(1.0, 1.0)).rgb;
        c = c * 0.25 * uExposure;
        float l = max(max(c.r, c.g), c.b);
        c *= smoothstep(0.9, 2.2, l);
        gl_FragColor = vec4(min(c, vec3(40.0)), 1.0);
      }`, { tSrc: { value: null }, tVol: { value: null }, uExposure: { value: 1 }, uTexel: { value: new THREE.Vector2() } });

    this.blurMat = pass(/* glsl */`
      uniform sampler2D tSrc; uniform vec2 uDir; varying vec2 vUv;
      void main(){
        vec3 c = texture2D(tSrc, vUv).rgb * 0.227;
        c += texture2D(tSrc, vUv + uDir * 1.385).rgb * 0.316;
        c += texture2D(tSrc, vUv - uDir * 1.385).rgb * 0.316;
        c += texture2D(tSrc, vUv + uDir * 3.231).rgb * 0.070;
        c += texture2D(tSrc, vUv - uDir * 3.231).rgb * 0.070;
        gl_FragColor = vec4(c, 1.0);
      }`, { tSrc: { value: null }, uDir: { value: new THREE.Vector2() } });

    this.copyMat = pass(/* glsl */`
      uniform sampler2D tSrc; varying vec2 vUv;
      void main(){ gl_FragColor = texture2D(tSrc, vUv); }`, { tSrc: { value: null } });

    this.finalMat = pass(/* glsl */`
      ${COMMON_GLSL}
      ${WAVE_GLSL}
      uniform sampler2D tA;
      uniform sampler2D tB;
      uniform sampler2D tVol;
      uniform sampler2D tBloom1;
      uniform sampler2D tBloom2;
      uniform float uExposure;
      uniform float uSplit;       // 1 = 水线分屏
      uniform float uUnderMain;   // 非分屏时，主画面是否在水下
      uniform mat4 uInvProj;
      uniform mat4 uCamWorld;
      uniform vec2 uRes;
      uniform float uVignette;
      uniform vec3 uWhite;
      varying vec2 vUv;
      vec3 aces(vec3 x){
        x *= 0.6;
        return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
      }
      float waterH(vec2 p){
        vec3 n; float j;
        vec2 p0 = p;
        for (int i = 0; i < 3; i++){ vec3 d = gerstner(p0, uWaveTime, 0.0, n, j); p0 = p - d.xz; }
        vec3 d = gerstner(p0, uWaveTime, 0.0, n, j);
        return d.y + eventHeight(p, uWaveTime);
      }
      void main(){
        vec2 uv = vUv;
        float under = uUnderMain;
        float edge = 1.0;
        if (uSplit > 0.5){
          vec4 vp = uInvProj * vec4(uv * 2.0 - 1.0, -1.0, 1.0);
          vp /= vp.w;
          vec3 wp = (uCamWorld * vec4(vp.xyz * 3.0, 1.0)).xyz;
          float h = waterH(wp.xz);
          float s = wp.y - h;
          under = s < 0.0 ? 1.0 : 0.0;
          edge = smoothstep(0.0, 0.025, abs(s));
          // 水膜边缘的轻微折射扭曲
          uv += vec2(0.0, (1.0 - edge) * 0.006);
        }
        vec3 col;
        if (under > 0.5){
          vec2 wob = vec2(sin(uv.y * 40.0 + uTime * 1.3), cos(uv.x * 35.0 + uTime * 1.1)) * 0.0006;
          vec2 vt = 1.5 / uRes;
          vec3 vol = (texture2D(tVol, uv + vt * vec2(1.0, 0.5)) + texture2D(tVol, uv - vt * vec2(1.0, 0.5)) + texture2D(tVol, uv + vt * vec2(-0.5, 1.0)) + texture2D(tVol, uv - vt * vec2(-0.5, 1.0))).rgb * 0.25;
          col = texture2D(tB, uv + wob).rgb + vol;
          col *= uWhite;
        } else {
          col = texture2D(tA, uv).rgb;
        }
        col *= uExposure;
        col += texture2D(tBloom1, vUv).rgb * 0.5 + texture2D(tBloom2, vUv).rgb * 0.7;
        col = aces(col);
        col = pow(col, vec3(1.0 / 2.2));
        // 水线：一道暗色弯月面
        col *= mix(0.55, 1.0, edge);
        vec2 q = vUv - 0.5;
        col *= 1.0 - uVignette * dot(q, q) * (under > 0.5 ? 1.25 : 0.7);
        float g = hash12(gl_FragCoord.xy + fract(uTime * 13.0) * 100.0) - 0.5;
        col += g * 0.01;
        gl_FragColor = vec4(col, 1.0);
      }`, {
      ...U, ...WAVE_U,
      tA: { value: null }, tB: { value: null }, tVol: { value: null },
      tBloom1: { value: null }, tBloom2: { value: null },
      uExposure: { value: 1 }, uSplit: { value: 0 }, uUnderMain: { value: 1 },
      uInvProj: { value: this.invProj }, uCamWorld: { value: this.camWorld },
      uRes: { value: new THREE.Vector2() }, uVignette: { value: 0.9 }, uWhite: { value: new THREE.Vector3(1, 1, 1) },
    });
    this.black = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
    this.black.needsUpdate = true;
  }

  setSize(w, h) {
    this.w = w; this.h = h;
    this.rtA.setSize(w, h);
    this.rtB.setSize(w, h);
    const vw = Math.max(1, Math.round(w * this.volScale)), vh = Math.max(1, Math.round(h * this.volScale));
    this.rtVol.setSize(vw, vh);
    const bw = Math.max(1, w >> 2), bh = Math.max(1, h >> 2);
    this.rtB1.setSize(bw, bh);
    this.rtB2.setSize(bw, bh);
    this.rtB3.setSize(Math.max(1, bw >> 1), Math.max(1, bh >> 1));
    this.rtB4.setSize(Math.max(1, bw >> 1), Math.max(1, bh >> 1));
    this.finalMat.uniforms.uRes.value.set(w, h);
  }

  _run(mat, target) {
    this.quad.material = mat;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.scene, this.cam);
  }

  // renderScene(under) 负责把场景画进当前 render target
  render(camera, renderScene, opts) {
    const r = this.renderer;
    const { under, split, exposure, volSteps } = opts;
    this.invProj.copy(camera.projectionMatrixInverse);
    this.camWorld.copy(camera.matrixWorld);
    let mainRT;
    if (split) {
      renderScene(false, this.rtA);
      renderScene(true, this.rtB);
      mainRT = this.rtB;
    } else if (under) {
      renderScene(true, this.rtB);
      mainRT = this.rtB;
    } else {
      renderScene(false, this.rtA);
      mainRT = this.rtA;
    }
    const doVol = (under || split) && volSteps > 0;
    if (doVol) {
      this.volMat.uniforms.tDepth.value = this.rtB.depthTexture;
      this.volMat.uniforms.uSteps.value = volSteps;
      U.uCamUnder.value = 1;
      this._run(this.volMat, this.rtVol);
    }
    // 泛光
    const src = split ? this.rtB : mainRT;
    this.brightMat.uniforms.tSrc.value = src.texture;
    this.brightMat.uniforms.uExposure.value = exposure;
    this.brightMat.uniforms.uTexel.value.set(1 / this.w, 1 / this.h);
    this._run(this.brightMat, this.rtB1);
    const bw = this.rtB1.width, bh = this.rtB1.height;
    this.blurMat.uniforms.tSrc.value = this.rtB1.texture;
    this.blurMat.uniforms.uDir.value.set(1 / bw, 0);
    this._run(this.blurMat, this.rtB2);
    this.blurMat.uniforms.tSrc.value = this.rtB2.texture;
    this.blurMat.uniforms.uDir.value.set(0, 1 / bh);
    this._run(this.blurMat, this.rtB1);
    this.copyMat.uniforms.tSrc.value = this.rtB1.texture;
    this._run(this.copyMat, this.rtB3);
    const cw = this.rtB3.width, ch = this.rtB3.height;
    this.blurMat.uniforms.tSrc.value = this.rtB3.texture;
    this.blurMat.uniforms.uDir.value.set(2 / cw, 0);
    this._run(this.blurMat, this.rtB4);
    this.blurMat.uniforms.tSrc.value = this.rtB4.texture;
    this.blurMat.uniforms.uDir.value.set(0, 2 / ch);
    this._run(this.blurMat, this.rtB3);

    const f = this.finalMat.uniforms;
    f.tA.value = split || !under ? this.rtA.texture : this.rtB.texture;
    f.tB.value = this.rtB.texture;
    f.tVol.value = doVol ? this.rtVol.texture : this.black;
    f.tBloom1.value = this.rtB1.texture;
    f.tBloom2.value = this.rtB3.texture;
    f.uExposure.value = exposure;
    f.uSplit.value = split ? 1 : 0;
    f.uUnderMain.value = under ? 1 : 0;
    if (opts.wb) f.uWhite.value.copy(opts.wb);
    this._run(this.finalMat, null);
  }
}
