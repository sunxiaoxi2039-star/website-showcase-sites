// 展示页的微交互与转场。全部是 DOM / CSS，不开第二个 WebGL，保证全页同一时间只有 1 个三维画布在跑。
// 减弱动效时整份不启用；GSAP 没加载时只保留不依赖它的部分（标题逐字、光标、磁吸、倾斜）。
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

// 把一段文字拆成逐字的 span，每个字带序号 --i，CSS 按序号错开出场
function splitChars(el) {
  if (!el || el.dataset.split) return;
  el.dataset.split = '1';
  el.setAttribute('aria-label', el.textContent);
  const text = el.textContent; el.textContent = '';
  [...text].forEach((c, i) => {
    const s = document.createElement('span');
    s.className = 'ch'; s.setAttribute('aria-hidden', 'true');
    s.style.setProperty('--i', i);
    s.textContent = c === ' ' ? ' ' : c;
    el.appendChild(s);
  });
}

// 乱码解码：进入视口时先显示随机字符，再逐字落定成原文
const GLYPHS = '▚▞▙▟░▒╳◆◇01ABCDEFXYZ#%&/<>=';
function scramble(el, dur = 900) {
  const final = el.dataset.final || (el.dataset.final = el.textContent);
  const t0 = performance.now();
  const step = (now) => {
    const k = Math.min(1, (now - t0) / dur), fixed = Math.floor(k * final.length);
    let out = final.slice(0, fixed);
    for (let i = fixed; i < final.length; i++) out += /\s|　|·/.test(final[i]) ? final[i] : GLYPHS[(Math.random() * GLYPHS.length) | 0];
    el.textContent = out;
    if (k < 1) requestAnimationFrame(step); else el.textContent = final;
  };
  requestAnimationFrame(step);
}

// 章节进场：9 条百叶从中间向两边依次收起，跟着滚动走（往回滚会重新合上）
function initVeils(gsap, ST) {
  $$('.chapter .stage').forEach((stage) => {
    const veil = document.createElement('div');
    veil.className = 'stage-veil'; veil.setAttribute('aria-hidden', 'true');
    veil.innerHTML = '<i></i>'.repeat(9) + `<b>${stage.closest('.chapter').dataset.nn}</b>`;
    stage.appendChild(veil);
    const slats = $$('i', veil), num = veil.querySelector('b');
    const tl = gsap.timeline({ scrollTrigger: { trigger: stage, start: 'top 92%', end: 'top 18%', scrub: 0.6 } });
    tl.to(slats, { scaleY: 0, ease: 'power2.inOut', duration: 1, stagger: { each: 0.07, from: 'center' } }, 0)
      .fromTo(num, { autoAlpha: 1, scale: 1 }, { autoAlpha: 0, scale: 1.35, ease: 'power1.in', duration: 0.6 }, 0.1);
  });
}

function initTitles(ST, mobile) {
  $$('.hero-title .line').forEach(splitChars);
  requestAnimationFrame(() => document.body.classList.add('fx-ready'));
  $$('.chapter .stage-title h2').forEach((h2) => {
    $$('.en, .zh', h2).forEach(splitChars);
    h2.classList.add('split');
    const stage = h2.closest('.stage');
    const show = () => h2.classList.add('is-in');
    if (ST) ST.create({ trigger: stage, start: mobile ? 'top 70%' : 'top top', once: true, onEnter: show });
    else new IntersectionObserver(([e], o) => { if (e.isIntersecting) { show(); o.disconnect(); } }).observe(h2);
  });
  const io = new IntersectionObserver((ens) => ens.forEach((e) => { if (e.isIntersecting) { scramble(e.target); io.unobserve(e.target); } }), { threshold: 0.6 });
  $$('.learn .eyebrow, .assets .eyebrow, .dossier .prompt-head h3, .versions .eyebrow').forEach((el) => io.observe(el));
}

// 桌面光标环：跟随鼠标、悬停在可点元素上放大；原生光标保留，环只是装饰
function initCursor() {
  const ring = document.createElement('div');
  ring.className = 'cursor-ring'; ring.setAttribute('aria-hidden', 'true');
  document.body.appendChild(ring);
  let x = innerWidth / 2, y = innerHeight / 2, rx = x, ry = y, shown = false;
  addEventListener('pointermove', (e) => {
    x = e.clientX; y = e.clientY;
    if (!shown) { shown = true; rx = x; ry = y; ring.classList.add('on'); }
    const hot = e.target.closest?.('a, button, [data-live], .asset .screen, summary, .card');
    ring.classList.toggle('hot', !!hot);
  }, { passive: true });
  document.addEventListener('pointerleave', () => { shown = false; ring.classList.remove('on'); });
  addEventListener('pointerdown', () => ring.classList.add('press'));
  addEventListener('pointerup', () => ring.classList.remove('press'));
  (function loop() {
    rx += (x - rx) * 0.2; ry += (y - ry) * 0.2;
    ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
    requestAnimationFrame(loop);
  })();
}

// 磁吸按钮：指针靠近时按钮朝指针偏一点，离开弹回
function initMagnet() {
  $$('.btn.primary, .topnav a, .learn-list a, .scroll-cue').forEach((el) => {
    el.classList.add('magnet');
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', ((e.clientX - r.left) / r.width - 0.5) * 10 + 'px');
      el.style.setProperty('--my', ((e.clientY - r.top) / r.height - 0.5) * 8 + 'px');
    });
    el.addEventListener('pointerleave', () => { el.style.setProperty('--mx', '0px'); el.style.setProperty('--my', '0px'); });
  });
}

// 卡片倾斜 + 跟随指针的高光
function initTilt() {
  $$('.asset .screen, .learn-list li, .vs-card').forEach((el) => {
    el.classList.add('tilt');
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect(), u = (e.clientX - r.left) / r.width, v = (e.clientY - r.top) / r.height;
      el.style.setProperty('--rx', ((0.5 - v) * 6).toFixed(2) + 'deg');
      el.style.setProperty('--ry', ((u - 0.5) * 8).toFixed(2) + 'deg');
      el.style.setProperty('--gx', (u * 100).toFixed(1) + '%');
      el.style.setProperty('--gy', (v * 100).toFixed(1) + '%');
    });
    el.addEventListener('pointerleave', () => { el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); });
  });
}

export function initFX({ gsap, ST, reduced, mobile }) {
  if (reduced) return;
  initTitles(ST, mobile);
  if (gsap && ST) { initVeils(gsap, ST); ST.sort?.(); ST.refresh(); }
  if (matchMedia('(pointer: fine)').matches && !mobile) { initCursor(); initMagnet(); initTilt(); }
}
