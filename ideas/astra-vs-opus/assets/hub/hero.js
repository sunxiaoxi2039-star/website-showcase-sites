/* 首屏：两股粒子流（Astra 绿 × Opus 紫）在光斑处交汇、炸开成涡旋。
   纯 WebGL，粒子运动全部在顶点着色器里按时间解析计算，CPU 每帧只传几个 uniform。
   降级：无 WebGL / 低端设备 → 只保留 CSS 静态渐变；reduced-motion → 只画一帧静止画面。 */
(function () {
  'use strict';
  const hero = document.getElementById('top');
  const cv = document.getElementById('heroGl');
  if (!hero || !cv) return;
  const RM = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const small = Math.min(screen.width, screen.height) < 700 || innerWidth < 760;
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 4;
  if (small && (cores <= 2 || mem <= 1)) return; // 很弱的手机：静态渐变

  let gl;
  try {
    gl = cv.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: true, powerPreference: 'low-power' }) ||
         cv.getContext('experimental-webgl');
  } catch (e) { gl = null; }
  if (!gl) return;

  const VS = `
  attribute vec4 aA; attribute vec4 aB;
  uniform float uT; uniform vec2 uAsp; uniform vec2 uC; uniform float uRot; uniform float uLen; uniform float uPx;
  varying vec3 vCol; varying float vAl;
  void main(){
    float side = aA.x;
    float u = fract(uT * aA.w + aA.y);
    float lane = aA.z;
    vec3 cA = vec3(0.431, 0.906, 0.647);
    vec3 cO = vec3(0.765, 0.651, 1.0);
    vec3 col = side < 0.0 ? cA : cO;
    vec3 hot = vec3(1.0, 0.93, 0.78);
    float split = 0.58;
    vec2 w; float al; float sz = aB.z;
    float cr = cos(uRot), sr = sin(uRot);
    if (u < split) {
      float k = u / split;
      float a = side * uLen * (1.0 - k);
      float nar = pow(1.0 - k, 1.35);
      float b = lane * 0.62 * nar
              + sin(k * 7.0 + lane * 5.0 + uT * 9.0 + aB.w * 6.28) * 0.06 * nar
              + side * 0.22 * sin(k * 3.14159) * nar;
      w = vec2(a * cr - b * sr, a * sr + b * cr);
      al = smoothstep(0.0, 0.12, k) * (0.35 + 0.65 * k * k);
      col = mix(col, hot, smoothstep(0.82, 1.0, k) * 0.7);
      sz *= 0.7 + 0.8 * k;
    } else {
      float e = (u - split) / (1.0 - split);
      float ang = aB.x * 6.28318 + side * e * 2.2;
      float r = pow(e, 0.55) * (0.18 + aB.y * 1.05);
      vec2 d = vec2(cos(ang), sin(ang) * 0.72);
      vec2 l = d * r;
      w = vec2(l.x * cr - l.y * sr, l.x * sr + l.y * cr);
      al = pow(1.0 - e, 1.6);
      col = mix(hot, col, smoothstep(0.0, 0.45, e));
      sz *= 1.4 - 0.7 * e;
    }
    w += uC;
    gl_Position = vec4(w / uAsp, 0.0, 1.0);
    gl_PointSize = sz * uPx;
    vCol = col; vAl = al;
  }`;
  const FS = `
  precision mediump float;
  varying vec3 vCol; varying float vAl;
  void main(){
    vec2 p = gl_PointCoord - 0.5;
    float d = length(p);
    float a = smoothstep(0.5, 0.0, d);
    a = a * a * vAl;
    gl_FragColor = vec4(vCol * a, a);
  }`;

  function sh(type, src) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { throw new Error(gl.getShaderInfoLog(s)); }
    return s;
  }
  let prog;
  try {
    prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('link');
  } catch (e) { return; }
  gl.useProgram(prog);

  const N = small ? (cores <= 4 ? 2600 : 4200) : 11000;
  const data = new Float32Array(N * 8);
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < N; i++) {
    const o = i * 8;
    const g = (rnd() + rnd() + rnd()) / 3 * 2 - 1; // 车道分布偏中间
    data[o] = i % 2 ? 1 : -1;
    data[o + 1] = rnd();
    data[o + 2] = g;
    data[o + 3] = 0.55 + rnd() * 0.75;
    data[o + 4] = rnd();
    data[o + 5] = Math.pow(rnd(), 1.8);
    data[o + 6] = 1.2 + Math.pow(rnd(), 3) * 4.2;
    data[o + 7] = rnd();
  }
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  const aA = gl.getAttribLocation(prog, 'aA'), aB = gl.getAttribLocation(prog, 'aB');
  gl.enableVertexAttribArray(aA); gl.vertexAttribPointer(aA, 4, gl.FLOAT, false, 32, 0);
  gl.enableVertexAttribArray(aB); gl.vertexAttribPointer(aB, 4, gl.FLOAT, false, 32, 16);
  const U = n => gl.getUniformLocation(prog, n);
  const uT = U('uT'), uAsp = U('uAsp'), uC = U('uC'), uRot = U('uRot'), uLen = U('uLen'), uPx = U('uPx');
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE);
  gl.clearColor(0, 0, 0, 0);

  const dpr = Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2);
  let W = 0, H = 0, ax = 1, ay = 1, fx = 0.64, fy = 0.44, portrait = false;
  const cT = [0, 0], cNow = [0, 0], ptr = [0, 0];
  function resize() {
    const r = hero.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width * dpr)); H = Math.max(1, Math.round(r.height * dpr));
    cv.width = W; cv.height = H;
    gl.viewport(0, 0, W, H);
    ax = Math.max(1, r.width / r.height); ay = Math.max(1, r.height / r.width);
    portrait = r.width < 760;
    fx = portrait ? 0.5 : 0.75; fy = portrait ? Math.min(0.4, innerHeight * 0.17 / r.height) : 0.4;
    hero.style.setProperty('--cx', (fx * 100) + '%'); hero.style.setProperty('--cy', (fy * 100).toFixed(2) + '%');
    cT[0] = (fx * 2 - 1) * ax; cT[1] = (1 - fy * 2) * ay;
    if (!cNow[0] && !cNow[1]) { cNow[0] = cT[0]; cNow[1] = cT[1]; }
    gl.uniform2f(uAsp, ax, ay);
    gl.uniform1f(uRot, portrait ? -0.42 : 0.3);
    gl.uniform1f(uLen, Math.hypot(ax, ay) * (portrait ? 1.35 : 1.5) + 0.3);
    // 粒子像素尺寸跟随较短边，手机上稍大
    gl.uniform1f(uPx, dpr * Math.max(1.4, Math.min(r.width, r.height) / 520));
  }

  let t0 = performance.now(), tAcc = 0, last = t0, running = false, raf = 0;
  function frame(now) {
    raf = 0;
    const dt = Math.min(0.05, (now - last) / 1000); last = now; tAcc += dt;
    // 光斑随指针轻微偏移
    const tx = cT[0] + ptr[0] * 0.18 * ax, ty = cT[1] + ptr[1] * 0.14 * ay;
    cNow[0] += (tx - cNow[0]) * 0.04; cNow[1] += (ty - cNow[1]) * 0.04;
    draw(tAcc);
    if (running) raf = requestAnimationFrame(frame);
  }
  function draw(t) {
    gl.uniform1f(uT, t * 0.085);
    gl.uniform2f(uC, cNow[0], cNow[1]);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.POINTS, 0, N);
  }
  function start() { if (running || RM) return; running = true; last = performance.now(); raf = requestAnimationFrame(frame); }
  function stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; }

  resize();
  cv.classList.add('on');
  if (RM) { cNow[0] = cT[0]; cNow[1] = cT[1]; draw(37.0); }
  else start();

  let visible = true, onscreen = true;
  const sync = () => (visible && onscreen ? start() : stop());
  document.addEventListener('visibilitychange', () => { visible = !document.hidden; sync(); });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(e => { onscreen = e[0].isIntersecting; sync(); }).observe(hero);
  }
  let rt = 0;
  window.addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(() => { resize(); cNow[0] = cT[0]; cNow[1] = cT[1]; if (!running) draw(RM ? 37.0 : tAcc); }, 150);
  });
  hero.addEventListener('pointermove', e => {
    const r = hero.getBoundingClientRect();
    ptr[0] = ((e.clientX - r.left) / r.width - fx) ;
    ptr[1] = -((e.clientY - r.top) / r.height - fy);
  }, { passive: true });
  hero.addEventListener('pointerleave', () => { ptr[0] = ptr[1] = 0; });
  cv.addEventListener('webglcontextlost', e => { e.preventDefault(); stop(); cv.classList.remove('on'); });
})();
