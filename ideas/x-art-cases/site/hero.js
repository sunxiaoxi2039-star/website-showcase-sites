// 开场着色器：手写 GLSL 的「墨流」（suminagashi）。
// 原理：每滴墨落在水面，会把已有的墨圈整体往外推——点 p 到滴点 c 距离为 r、墨滴半径 R 时，
// 它原来的位置在 sqrt(r² − R²) 处。着色时从最后一滴倒着逆推，逐层按「前到后」叠色，得到同心墨圈；
// 滚动先让二十四滴墨（三团，墨与清水交替）依次绽开，再加一道波形梳纹把墨圈拉成羽毛纹；鼠标附近有一小团涡流。
// 不依赖任何库，只用 WebGL1（带 OES_standard_derivatives 时边缘抗锯齿更干净）。

const VERT = `
attribute vec2 aPos;
void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = (hasDeriv) => `${hasDeriv ? '#extension GL_OES_standard_derivatives : enable\n#define HAS_DERIV 1\n' : ''}
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uProg;   // 墨滴绽开进度 0..1
uniform float uComb;   // 梳纹强度 0..1
uniform float uFade;   // 退回墙色 0..1
uniform float uZoom;
uniform vec2 uCenter; // 滚动后段慢慢推近，镜头中心随之平移
uniform vec2 uMouse;
uniform float uSwirl;
uniform float uPx;     // 一个像素在 p 空间里的大小

const int N = 24;
const vec3 PAPER  = vec3(0.937, 0.922, 0.890);
const vec3 PAPER2 = vec3(0.965, 0.955, 0.930);
const vec3 INK    = vec3(0.106, 0.102, 0.090);
const vec3 RED    = vec3(0.722, 0.196, 0.122);
const vec3 GOLD   = vec3(0.690, 0.545, 0.275);
const vec3 INDIGO = vec3(0.180, 0.250, 0.345);

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
  return v;
}
// 同一团墨里交替落「墨」和「清水」，墨色在 墨/朱/墨/金/墨/靛 之间轮换
vec3 dropColor(float i){
  float j = floor(i / 3.0);
  if (mod(j, 2.0) < 0.5) return mod(j, 4.0) < 0.5 ? PAPER2 : PAPER;
  float k = mod(floor(j / 2.0) + mod(i, 3.0), 6.0);
  if (k < 0.5) return INK;
  if (k < 1.5) return RED;
  if (k < 2.5) return INK;
  if (k < 3.5) return GOLD;
  if (k < 4.5) return INK;
  return INDIGO;
}
vec2 dropCenter(float i){
  float k = mod(i, 3.0);
  vec2 c = k < 0.5 ? vec2(-0.42, 0.22) : (k < 1.5 ? vec2(0.24, 0.18) : vec2(0.70, -0.26));
  return c + (vec2(hash(vec2(i, 1.3)), hash(vec2(i, 7.1))) - 0.5) * 0.035;
}

void main(){
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y * uZoom + uCenter;

  // 1. 水面缓慢漂移（最后发生，最先逆推）
  vec2 q = p + (vec2(fbm(p * 1.6 + uTime * 0.03), fbm(p * 1.6 - uTime * 0.025 + 5.2)) - 0.5) * 0.07;
  q += (vec2(noise(p * 7.0 + 3.1), noise(p * 7.0 - 8.4)) - 0.5) * 0.012;

  // 2. 鼠标附近的涡流
  vec2 dm = q - uMouse;
  float a = exp(-dot(dm, dm) * 14.0) * uSwirl;
  float ca = cos(a), sa = sin(a);
  q = uMouse + mat2(ca, -sa, sa, ca) * dm;

  // 3. 撤回梳纹（最后一步先撤）：先竖向轻摆一道，再横向下梳。
  //    横梳的梳齿等距排开、相邻两齿方向相反；位移只依赖 y，所以逆映射是精确的。
  //    用 cos 的高次幂模拟梳齿：齿尖处拉得最狠，两齿中间几乎不动，墨圈因此被拉成人字形羽毛纹。
  float A = uComb;
  q.y -= 0.035 * A * sin(q.x * 6.0 - 0.7 + uTime * 0.04);
  float cy = cos(3.14159265 * (q.y + 0.03) / 0.13);
  float tine = sign(cy) * pow(abs(cy), 5.0);
  q.x -= A * (0.24 * tine + 0.03 * sin(q.y * 11.0 + 1.3));

  // 4. 墨滴倒序逆推，前到后叠色
  vec3 col = vec3(0.0);
  float alpha = 0.0;
  for (int k = 0; k < N; k++) {
    float i = float(N - 1 - k);
    float t0 = 0.02 + i * 0.027;
    float b = smoothstep(t0, t0 + 0.09, uProg);
    float R = (0.055 + 0.05 * hash(vec2(i, 3.7))) * b;
    vec2 c = dropCenter(i);
    vec2 d = q - c;
    float r = length(d);
    float e = r - R;
#ifdef HAS_DERIV
    float aa = fwidth(e) * 0.9 + 1e-5;
#else
    float aa = uPx * 1.2;
#endif
    float w = R > 1e-4 ? 1.0 - smoothstep(-aa, aa, e) : 0.0;
    col += (1.0 - alpha) * w * dropColor(i);
    alpha += (1.0 - alpha) * w;
    float r2 = max(r * r - R * R, 0.0);
    q = c + d * (sqrt(r2) / max(r, 1e-4));
  }
  vec3 bg = PAPER * (1.0 - 0.035 * fbm(q * 3.0));
  col += (1.0 - alpha) * bg;
  col *= 1.0 - 0.06 * alpha * noise(p * 22.0);   // 墨色里的一点浓淡

  // 纸纹与晕影
  float g = hash(gl_FragCoord.xy + floor(uTime * 12.0)) - 0.5;
  col *= 1.0 + g * 0.028;
  vec2 v = gl_FragCoord.xy / uRes - 0.5;
  col *= 1.0 - dot(v, v) * 0.16;

  col = mix(col, PAPER, uFade);
  gl_FragColor = vec4(col, 1.0);
}
`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const msg = gl.getShaderInfoLog(s);
    gl.deleteShader(s);
    throw new Error('着色器编译失败：' + msg);
  }
  return s;
}

/**
 * 启动开场着色器。返回 { setScroll(s), setVisible(bool) }；失败时返回 null（页面显示 CSS 退路）。
 * reduced=true 时只画一帧静态画面，不跑动画、不跟滚动。
 */
export function initHero(canvas, { reduced = false } = {}) {
  let gl = null;
  try {
    gl = canvas.getContext('webgl', { antialias: false, alpha: false, premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: 'low-power' });
  } catch (_) { gl = null; }
  if (!gl) return null;

  const hasDeriv = !!gl.getExtension('OES_standard_derivatives');
  let prog;
  try {
    prog = gl.createProgram();
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG(hasDeriv)));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  } catch (err) {
    console.warn('[hero] 着色器不可用，改用静态退路', err);
    return null;
  }
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const U = {};
  for (const n of ['uRes', 'uTime', 'uProg', 'uComb', 'uFade', 'uZoom', 'uCenter', 'uMouse', 'uSwirl', 'uPx']) U[n] = gl.getUniformLocation(prog, n);

  const state = { scroll: reduced ? 0.25 : 0, intro: reduced ? 1 : 0, visible: true, raf: 0, t0: performance.now(), lost: false,
    mouse: [10, 10], mouseTarget: [10, 10], swirl: 0, swirlTarget: 0, w: 0, h: 0, zoom: 1 };

  function resize() {
    const small = Math.min(window.innerWidth, window.innerHeight) < 700;
    const dpr = Math.min(window.devicePixelRatio || 1, small ? 1.5 : 1.25);
    const cw = canvas.clientWidth || window.innerWidth;
    const ch = canvas.clientHeight || window.innerHeight;
    const w = Math.max(2, Math.round(cw * dpr));
    const h = Math.max(2, Math.round(ch * dpr));
    if (w !== state.w || h !== state.h) {
      canvas.width = w; canvas.height = h; state.w = w; state.h = h;
      gl.viewport(0, 0, w, h);
    }
    // 竖屏时把构图整体缩小，保证三团墨都在画面里
    const aspect = cw / ch;
    state.zoom = aspect < 1.25 ? 1.45 / aspect : 1.0;
  }

  const ease = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  function draw(now) {
    if (state.lost) return;
    const t = (now - state.t0) / 1000;
    if (!reduced) state.intro = ease(t / 2.6);
    const s = state.scroll;
    const prog = 0.42 * state.intro + 0.62 * s;
    state.mouse[0] += (state.mouseTarget[0] - state.mouse[0]) * 0.08;
    state.mouse[1] += (state.mouseTarget[1] - state.mouse[1]) * 0.08;
    state.swirl += (state.swirlTarget - state.swirl) * 0.05;
    state.swirlTarget *= 0.985;
    gl.uniform2f(U.uRes, state.w, state.h);
    gl.uniform1f(U.uTime, reduced ? 12.0 : t);
    gl.uniform1f(U.uProg, prog);
    gl.uniform1f(U.uComb, smooth(0.42, 0.95, s));
    gl.uniform1f(U.uFade, 0.8 * smooth(0.8, 1.0, s));
    // 后半程推近：视野缩到七成，中心移向中间那团墨
    const push = smooth(0.3, 1.0, s);
    const zoom = state.zoom * (1 - 0.3 * push);
    gl.uniform1f(U.uZoom, zoom);
    gl.uniform2f(U.uCenter, 0.12 * push, 0.03 * push);
    gl.uniform2f(U.uMouse, state.mouse[0], state.mouse[1]);
    gl.uniform1f(U.uSwirl, reduced ? 0 : state.swirl);
    gl.uniform1f(U.uPx, zoom / state.h);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function loop(now) {
    state.raf = 0;
    if (!state.visible || reduced) return;
    draw(now);
    state.raf = requestAnimationFrame(loop);
  }
  function kick() {
    if (reduced) { draw(performance.now()); return; }
    if (!state.raf && state.visible) state.raf = requestAnimationFrame(loop);
  }

  resize();
  kick();
  let rt = 0;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { resize(); kick(); }, 120); });

  if (!reduced) {
    canvas.parentElement.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const r = canvas.getBoundingClientRect();
      const push = smooth(0.3, 1.0, state.scroll);
      const z = state.zoom * (1 - 0.3 * push);
      const x = ((e.clientX - r.left) - 0.5 * r.width) / r.height * z + 0.12 * push;
      const y = (0.5 * r.height - (e.clientY - r.top)) / r.height * z + 0.03 * push;
      state.mouseTarget = [x, y];
      state.swirlTarget = Math.min(1.1, state.swirlTarget + 0.06);
    }, { passive: true });
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); state.lost = true; document.documentElement.classList.add('no-gl'); });

  return {
    setScroll(s) { if (reduced) return; state.scroll = s; },
    setVisible(v) { state.visible = v; if (v) kick(); },
  };
}
