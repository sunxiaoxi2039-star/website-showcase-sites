// Koi pond: wiring of renderer, water, school of koi, UI and sound.
import * as THREE from 'three';
import { createShared, Water } from './water.js';
import { drawKoi2D, VARIETIES } from './koi.js';
import { PondAudio } from './audio.js';
import { School, MAX_KOI } from './school.js';

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const body = document.body;

function start() {
  const canvas = $('pond');
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: true, powerPreference: 'high-performance' });
  if (!gl) { $('fallback').style.display = 'flex'; return; }

  const renderer = new THREE.WebGLRenderer({ canvas, context: gl, antialias: false });
  renderer.setClearColor(0x0b2c30, 1);
  let pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(pixelRatio);

  const U = createShared();
  const water = new Water(renderer, U);
  const audio = new PondAudio();
  const school = new School(U, water, audio);

  const cam = new THREE.OrthographicCamera(-6, 6, 4, -4, 0.1, 50);
  cam.position.set(0, 20, 0);
  cam.up.set(0, 0, -1);
  cam.lookAt(0, 0, 0);

  const underScene = new THREE.Scene();
  underScene.add(water.floor, school.under);
  const airScene = new THREE.Scene();
  airScene.add(school.air);
  const underRT = new THREE.WebGLRenderTarget(4, 4, { samples: 4, depthBuffer: true });

  let halfX = 6, halfY = 4, W = 1, H = 1;
  const toWorld = (sx, sy) => [(sx / W - 0.5) * 2 * halfX, (sy / H - 0.5) * 2 * halfY];
  const toScreen = (x, z) => [(x / (2 * halfX) + 0.5) * W, (z / (2 * halfY) + 0.5) * H];

  function layoutPads() {
    const p = U.uPond.value, s = Math.min(p.x, p.y) / 3.25;
    const list = [
      [-0.72 * p.x, -0.55 * p.y, 0.55 * s, 0.3],
      [0.78 * p.x, -0.2 * p.y, 0.42 * s, 2.1],
      [0.55 * p.x, 0.62 * p.y, 0.5 * s, 4.0],
      [-0.35 * p.x, 0.7 * p.y, 0.36 * s, 1.2],
      [-0.86 * p.x, 0.1 * p.y, 0.3 * s, 5.1],
    ];
    list.forEach((q, i) => U.uPads.value[i].set(q[0], q[1], q[2], q[3]));
  }

  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    const asp = W / H;
    if (asp >= 1) { halfY = 4; halfX = 4 * asp; } else { halfX = 3.4; halfY = 3.4 / asp; }
    U.uHalf.value.set(halfX, halfY);
    const px = halfX - 0.85, pz = halfY - 0.75;
    U.uPond.value.set(px, pz);
    U.uPondR.value = Math.min(1.6, 0.4 * Math.min(px, pz));
    layoutPads();
    school.scale = clamp(Math.min(halfX, halfY) / 4, 0.78, 1);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(W, H, false);
    const rw = Math.round(W * pixelRatio), rh = Math.round(H * pixelRatio);
    const simW = asp >= 1 ? 384 : Math.round(384 * asp), simH = asp >= 1 ? Math.round(384 / asp) : 384;
    water.resize(simW, simH, halfX, halfY, rw, rh);
    underRT.setSize(rw, rh);
    cam.left = -halfX; cam.right = halfX; cam.top = halfY; cam.bottom = -halfY;
    cam.updateProjectionMatrix();
    school.setPixelScale(rh / halfY);
    clampWhirl();
    drawCards();
  }

  // ---------- UI helpers ----------
  const toastEl = $('toast');
  let toastTimer = 0;
  function toast(msg, ms = 2400) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), ms);
  }
  const countEl = $('count');
  let shownCount = -1;
  function updateCount() {
    const n = school.activeCount();
    if (n !== shownCount) { shownCount = n; countEl.textContent = `${n} koi`; }
  }
  const setPressed = (el, on) => el.setAttribute('aria-pressed', on ? 'true' : 'false');

  const cards = [...document.querySelectorAll('.card')];
  function drawCards() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    for (const card of cards) {
      const c = card.querySelector('canvas');
      const w = Math.max(40, Math.round(c.clientWidth * dpr)), h = Math.max(25, Math.round(c.clientHeight * dpr));
      if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
      drawKoi2D(c.getContext('2d'), w, h, +card.dataset.variety, 0, 3 + +card.dataset.variety);
    }
  }

  const panel = document.querySelector('.panel');
  function overUi(sx, sy) {
    if (body.classList.contains('ui-hidden')) return false;
    for (const el of [panel, document.querySelector('.topbar')]) {
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (sx >= r.left && sx <= r.right && sy >= r.top && sy <= r.bottom) return true;
    }
    return false;
  }
  const validDrop = (x, z) => school.sdf(x, z) < -0.35;

  function pulse(card) {
    if (!card) return;
    card.classList.remove('pulse');
    void card.offsetWidth;
    card.classList.add('pulse');
  }

  function release(v, x, z) {
    if (!school.release(v, x, z)) {
      toast(`The pond is full (${MAX_KOI} koi). Try Clear pond first.`);
      return false;
    }
    pulse(cards[v]);
    updateCount();
    return true;
  }

  function randomDropSpot() {
    const p = U.uPond.value;
    let zMax = p.y - 0.8;
    if (!body.classList.contains('ui-hidden')) {
      const top = panel.getBoundingClientRect().top;
      zMax = Math.min(zMax, toWorld(0, top)[1] - 0.7);
    }
    const zMin = -p.y + 0.8;
    if (zMax < zMin + 0.5) zMax = zMin + 0.5;
    for (let i = 0; i < 60; i++) {
      const x = (Math.random() * 2 - 1) * (p.x - 0.8), z = zMin + Math.random() * (zMax - zMin);
      if (school.sdf(x, z) < -0.8) return [x, z];
    }
    return [0, 0];
  }

  // ---------- dragging a koi card onto the water ----------
  const ghost = $('ghost'), gctx = ghost.getContext('2d'), target = $('target');
  let drag = null, suppressUntil = 0;
  function dragMove(e) {
    drag.sx = e.clientX; drag.sy = e.clientY;
    ghost.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
    target.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
    const [x, z] = toWorld(e.clientX, e.clientY);
    target.classList.toggle('bad', overUi(e.clientX, e.clientY) || !validDrop(x, z));
  }
  function endDrag() {
    ghost.classList.remove('on'); target.classList.remove('on', 'bad');
    drag = null;
  }
  for (const card of cards) {
    const v = +card.dataset.variety;
    card.style.touchAction = 'none';
    card.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      drag = { v, card, id: e.pointerId, x0: e.clientX, y0: e.clientY, sx: e.clientX, sy: e.clientY, active: false };
      try { card.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    });
    card.addEventListener('pointermove', (e) => {
      if (!drag || drag.id !== e.pointerId) return;
      if (!drag.active && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 8) {
        drag.active = true;
        ghost.classList.add('on'); target.classList.add('on');
      }
      if (drag.active) dragMove(e);
    });
    card.addEventListener('pointerup', (e) => {
      if (!drag || drag.id !== e.pointerId) return;
      if (drag.active) {
        suppressUntil = performance.now() + 450;
        const [x, z] = toWorld(e.clientX, e.clientY);
        if (!overUi(e.clientX, e.clientY) && validDrop(x, z)) release(v, x, z);
        else toast('Drop the koi onto open water.');
      }
      endDrag();
    });
    card.addEventListener('pointercancel', endDrag);
    card.addEventListener('click', () => {
      if (performance.now() < suppressUntil) return;
      const [x, z] = randomDropSpot();
      release(v, x, z);
    });
  }

  // ---------- touching the water ----------
  const WHIRL_R = 1.3;
  const whirl = { on: false, x: 0, z: 0, S: 0, placed: false };
  let touch = null;
  const noteFor = (x) => clamp(Math.floor((x / (2 * halfX) + 0.5) * 9), 0, 8);
  canvas.addEventListener('pointerdown', (e) => {
    const [x, z] = toWorld(e.clientX, e.clientY);
    touch = { id: e.pointerId, x, z, acc: 0 };
    try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    if (school.sdf(x, z) < -0.05) {
      water.addDrop(x, z, 0.16, 0.5, 0.35);
      school.touch(x, z, 1);
      audio.droplet(0.8, noteFor(x));
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!touch || touch.id !== e.pointerId) return;
    const [x, z] = toWorld(e.clientX, e.clientY);
    const d = Math.hypot(x - touch.x, z - touch.z);
    const steps = Math.min(12, Math.floor((touch.acc + d) / 0.1));
    for (let i = 1; i <= steps; i++) {
      const k = (i * 0.1 - touch.acc) / Math.max(d, 1e-5);
      const px = touch.x + (x - touch.x) * clamp(k, 0, 1), pz = touch.z + (z - touch.z) * clamp(k, 0, 1);
      if (school.sdf(px, pz) < -0.05) water.addDrop(px, pz, 0.14, 0.35, 0.12);
    }
    touch.acc = (touch.acc + d) % 0.1;
    if (d > 0.02 && school.sdf(x, z) < -0.05) {
      school.touch(x, z, 0.6);
      if (Math.random() < d * 1.4) audio.droplet(0.45, noteFor(x));
    }
    touch.x = x; touch.z = z;
  });
  const endTouch = (e) => { if (touch && touch.id === e.pointerId) touch = null; };
  canvas.addEventListener('pointerup', endTouch);
  canvas.addEventListener('pointercancel', endTouch);

  // ---------- whirlpool ----------
  const handle = $('whirlHandle');
  function clampWhirl() {
    if (!whirl.placed) { const p = U.uPond.value; whirl.x = p.x * 0.38; whirl.z = -p.y * 0.18; whirl.placed = true; }
    for (let i = 0; i < 6; i++) {
      const s = school.sdf(whirl.x, whirl.z) + 0.9;
      if (s <= 0) break;
      const g = school.grad(whirl.x, whirl.z);
      whirl.x -= g[0] * s; whirl.z -= g[1] * s;
    }
  }
  let handleDrag = null;
  handle.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    handleDrag = e.pointerId;
    try { handle.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
  });
  handle.addEventListener('pointermove', (e) => {
    if (handleDrag !== e.pointerId) return;
    const [x, z] = toWorld(e.clientX, e.clientY);
    whirl.x = x; whirl.z = z;
    clampWhirl();
  });
  const endHandle = (e) => { if (handleDrag === e.pointerId) handleDrag = null; };
  handle.addEventListener('pointerup', endHandle);
  handle.addEventListener('pointercancel', endHandle);

  // ---------- controls ----------
  const btnSound = $('btnSound'), btnRain = $('btnRain'), btnWhirl = $('btnWhirl'), btnCalm = $('btnCalm');
  let soundOn = false, rainOn = false, calmOn = false;
  function setSound(on) {
    if (!audio.setEnabled(on)) { toast('Web Audio is not available in this browser.'); return; }
    soundOn = on;
    setPressed(btnSound, on);
    btnSound.title = on ? 'Mute sound' : 'Sound';
    toast(on ? 'Sound on' : 'Sound off', 1400);
  }
  function setRain(on) { rainOn = on; setPressed(btnRain, on); }
  function setWhirl(on) {
    whirl.on = on; setPressed(btnWhirl, on);
    body.classList.toggle('whirl-on', on);
    if (on) { clampWhirl(); toast('Whirlpool on. Drag the handle to move it.'); }
  }
  function setCalm(on) { calmOn = on; setPressed(btnCalm, on); }
  function setHidden(on) {
    body.classList.toggle('ui-hidden', on);
    if (on) toast('UI hidden. Press H or tap the top-right corner to show it.', 2600);
    else $('showUi').classList.remove('peek');
  }
  btnSound.addEventListener('click', () => setSound(!soundOn));
  btnRain.addEventListener('click', () => setRain(!rainOn));
  btnWhirl.addEventListener('click', () => setWhirl(!whirl.on));
  btnCalm.addEventListener('click', () => setCalm(!calmOn));
  $('btnClear').addEventListener('click', () => {
    const n = school.clear();
    toast(n ? `${n} koi swim away into the deep.` : 'The pond is already empty.');
    updateCount();
  });
  $('btnHide').addEventListener('click', () => setHidden(true));
  const showUi = $('showUi');
  showUi.addEventListener('click', () => setHidden(false));
  let peekTimer = 0;
  const peek = (sx, sy) => {
    if (!body.classList.contains('ui-hidden')) return;
    if (sx > W - 170 && sy < 100) {
      showUi.classList.add('peek');
      clearTimeout(peekTimer);
      peekTimer = setTimeout(() => showUi.classList.remove('peek'), 2200);
    }
  };
  window.addEventListener('pointermove', (e) => peek(e.clientX, e.clientY), { passive: true });
  window.addEventListener('pointerdown', (e) => peek(e.clientX, e.clientY), { passive: true });
  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'h' || e.key === 'H') setHidden(!body.classList.contains('ui-hidden'));
    else if (e.key >= '1' && e.key <= '4' && document.activeElement?.tagName !== 'INPUT') {
      const v = +e.key - 1, [x, z] = randomDropSpot();
      release(v, x, z);
    }
  });
  document.addEventListener('visibilitychange', () => {
    audio.setVisible(!document.hidden);
    last = performance.now();
  });
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) setCalm(true);

  let resizeTimer = 0;
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(resize, 120); });

  // ---------- frame loop ----------
  resize();
  school.populate(8);
  updateCount();
  setTimeout(() => toast('Tap a koi to release it, or drag it onto the water.', 3200), 900);

  const env = { rain: 0, calm: false, whirl: { x: 0, z: 0, S: 0, R: WHIRL_R }, halfX: 6, halfY: 4 };
  let last = performance.now(), time = 0, audioT = 0, whirlT = 0, slowT = 0, frameAvg = 16, ghostT = 0;
  const ease = (cur, tgt, dt, rate) => cur + (tgt - cur) * (1 - Math.exp(-dt * rate));

  function frame(now) {
    requestAnimationFrame(frame);
    const raw = (now - last) / 1000;
    last = now;
    const dt = clamp(raw, 0, 0.05);
    time += dt;
    U.uTime.value = time;

    U.uRain.value = ease(U.uRain.value, rainOn ? 1 : 0, dt, 1.2);
    U.uCalm.value = ease(U.uCalm.value, calmOn ? 1 : 0, dt, 1.5);
    whirl.S = ease(whirl.S, whirl.on ? 1 : 0, dt, 0.9);
    U.uWhirl.value.set(whirl.x, whirl.z, whirl.S, WHIRL_R);
    env.rain = U.uRain.value; env.calm = calmOn;
    env.whirl.x = whirl.x; env.whirl.z = whirl.z; env.whirl.S = whirl.S;
    env.halfX = halfX; env.halfY = halfY;

    if (whirl.S > 0.02) {
      whirlT -= dt;
      if (whirlT <= 0) {
        whirlT = 0.09;
        water.addDrop(whirl.x, whirl.z, 0.32, -0.1 * whirl.S, 0);
        for (let k = 0; k < 2; k++) {
          const a = time * 2.6 + k * Math.PI, r = 0.62 * WHIRL_R;
          water.addDrop(whirl.x + Math.cos(a) * r, whirl.z + Math.sin(a) * r, 0.18, 0.05 * whirl.S, 0.12 * whirl.S);
        }
      }
      if (whirl.on) {
        const [sx, sy] = toScreen(whirl.x, whirl.z);
        handle.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px)`;
      }
    }
    if (env.rain > 0.5 && Math.random() < dt * 1.5 * env.rain) audio.droplet(0.3);

    school.update(dt, env);
    school.render();
    updateCount();

    if (drag && drag.active) {
      ghostT += dt;
      drawKoi2D(gctx, ghost.width, ghost.height, drag.v, ghostT * 1.6, 3 + drag.v);
    }

    audioT -= dt;
    if (audioT <= 0) {
      audioT = 0.25;
      let sp = 0;
      for (const f of school.fish) sp += f.speed;
      const swim = clamp(sp / (school.scale * 7), 0, 1);
      audio.update(swim, env.rain, whirl.S);
    }

    const damp = 0.995 - 0.01 * U.uCalm.value;
    water.update(damp);
    renderer.setRenderTarget(underRT);
    renderer.render(underScene, cam);
    water.compMat.uniforms.uUnder.value = underRT.texture;
    renderer.setRenderTarget(null);
    renderer.render(water.compScene, water.quadCam);
    renderer.autoClear = false;
    renderer.render(airScene, cam);
    renderer.autoClear = true;

    // adaptive resolution: step down when frames stay slow
    if (raw < 0.25 && !document.hidden) {
      frameAvg += (raw * 1000 - frameAvg) * 0.05;
      if (frameAvg > 26 && pixelRatio > 1) {
        slowT += raw;
        if (slowT > 2.5) {
          slowT = 0; frameAvg = 16;
          pixelRatio = Math.max(1, pixelRatio - 0.25);
          resize();
        }
      } else slowT = Math.max(0, slowT - raw * 0.5);
    }
  }
  requestAnimationFrame(frame);

  // small hook for automated checks
  window.__koi = {
    release(v = 0, sx, sy) {
      const [x, z] = sx == null ? randomDropSpot() : toWorld(sx, sy);
      return release(v, x, z);
    },
    rain: setRain,
    whirl: setWhirl,
    calm: setCalm,
    hide: setHidden,
    clear: () => school.clear(),
    ripple(sx, sy) { const [x, z] = toWorld(sx, sy); water.addDrop(x, z, 0.16, 0.5, 0.35); },
    count: () => school.activeCount(),
    varieties: VARIETIES,
  };
}

start();
