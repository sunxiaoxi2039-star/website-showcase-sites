// 展示页主逻辑：生成章节、教程、资产区 → 滚动动效（GSAP ScrollTrigger + Lenis）→ 开场三维场景 → 实时场景管理 → 复制与展开
const CH = window.CHAPTERS || [];
const PR = window.PROMPTS || {};
const TUT = window.TUTORIALS || {};
const AS = window.ASSETS || [];
// 成品和教程图片相对本页的位置：本机项目里是 ../（showcase/ 在 results/ 旁边），发布包里是 ./（build-release 改写这个属性）
const BASE = document.body.dataset.base ?? '../';
// 教程 Markdown 的链接：本机直接开文件；发布包改成 GitHub 上的渲染页（Pages 会把 .md 当下载文件）
const MD_BASE = document.body.dataset.mdBase ?? `${BASE}tutorials/`;
const gsap = window.gsap;
const ST = window.ScrollTrigger;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = () => matchMedia('(max-width: 860px)').matches;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const liveSrc = (ch, v) => `${BASE}results/${ch.slug}/${v}/index.html`;
const LIVE_NAME = { oneshot: '一次成型版', fixed: '修正版', v3: 'v3 版' };
const pad2 = (n) => String(n).padStart(2, '0');
const DEFAULT_THEME = { bg: '#08090c', accent: '#e8c07a' };
const ASSET_THEME = { bg: '#0b1316', accent: '#7fd6c8' };
if (gsap && ST) gsap.registerPlugin(ST);

/* ---------- 1. 生成章节、侧边导航、汇总表 ---------- */
function chapterHTML(ch) {
  const p = PR[ch.nn] || {};
  const short = (p.text || '').length < 300;
  const authors = (p.authorLinks || []).map((u) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(u.replace(/^https?:\/\/(www\.)?/, ''))}</a>`).join('　');
  const card = (k, i, extra = '') => `
      <figure class="card card-${k}${extra}">
        <div class="frame"><img src="media/${ch.nn}-${k}.jpg" alt="${esc(ch.zh)}：${esc(ch.shots[i])}" loading="lazy" decoding="async"></div>
        <figcaption><b>${k.toUpperCase()}</b>${esc(ch.shots[i])}</figcaption>
      </figure>`;
  return `
<section class="chapter" id="ch-${ch.nn}" data-nn="${ch.nn}" style="--bg:${ch.palette.bg};--accent:${ch.palette.accent}">
  <div class="stage">
    <div class="stage-bg" aria-hidden="true"><img src="media/${ch.nn}-a.jpg" alt="" loading="lazy" decoding="async"></div>
    <div class="stage-num" aria-hidden="true">${ch.nn}</div>
    <div class="stage-cam">${card('a', 0)}${card('b', 1)}${card('c', 2, ch.cPortrait ? ' portrait' : '')}
    </div>
    <div class="stage-title">
      <p class="eyebrow">第 ${ch.nn} 章　·　${esc(p.kind || '')}</p>
      <h2><span class="en">${esc(ch.en)}</span><span class="zh">${esc(ch.zh)}</span></h2>
      <p class="hook">${esc(ch.hook)}</p>
    </div>
  </div>
  <div class="dossier">
    <div class="player">
      <div class="screen" data-nn="${ch.nn}">
        <img class="poster" src="media/${ch.nn}-poster.jpg" alt="${esc(ch.zh)} 预览封面" loading="lazy" decoding="async">
        <video muted loop playsinline preload="none" data-src="media/${ch.nn}.mp4" aria-label="${esc(ch.zh)} 修正版 10 秒预览"></video>
        <span class="screen-badge">预览录像 · 修正版</span>
        <button class="shield" type="button" hidden><span>点一下开始操作场景（移出画面恢复页面滚动）</span></button>
      </div>
      <div class="player-actions" role="group" aria-label="实时运行哪一版">
        <span class="pa-label">▶ 实时运行</span>
        <button class="btn" type="button" data-live="oneshot">一次成型</button>
        <button class="btn primary" type="button" data-live="fixed">修正版</button>
        ${ch.v3 ? `<button class="btn" type="button" data-live="v3">${esc(ch.v3.label)}</button>`
          : `<button class="btn" type="button" disabled title="${esc(ch.noV3)}">v3（本章没有）</button>`}
        <button class="btn" type="button" data-stop hidden>■ 停止</button>
        <a class="btn" href="${liveSrc(ch, ch.v3 ? 'v3' : 'fixed')}" target="_blank" rel="noopener">新窗口打开 ↗</a>
      </div>
      <p class="player-note">默认只放录像；点按钮才加载实时场景。全页同一时间只跑 1 个，滚出画面自动卸载。${ch.v3 ? '' : esc(ch.noV3)}</p>
    </div>
    <div class="facts">
      <dl class="meta">
        <dt>出处</dt><dd><a class="src-link" href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.title)}</a><span class="sub">${esc(p.url)}${p.pageDate ? '　·　页面日期 ' + esc(p.pageDate) : ''}</span></dd>
        <dt>作者</dt><dd>${esc(p.author)}${authors ? `<span class="sub">${authors}</span>` : ''}</dd>
        <dt>类型</dt><dd>${esc(p.kind)}<span class="sub">${esc(p.kindNote)}</span></dd>
        <dt>页面原模型</dt><dd>${esc(p.origModel || '页面未注明')}</dd>
        <dt>执行模型</dt><dd>Claude Opus 5.5</dd>
        <dt>一次成型</dt><dd><span class="pill ${ch.oneshot.ok ? 'good' : 'bad'}">${esc(ch.oneshot.label)}</span><span class="sub">${esc(ch.oneshot.detail)}</span></dd>
        <dt>是否修过</dt><dd>修过<span class="sub">${esc(ch.fixes)}</span></dd>
        <dt>耗时</dt><dd>${esc(ch.time)}<span class="sub">${esc(ch.span)}（2026-09-23）</span></dd>
        <dt>技术</dt><dd>${esc(ch.tech)}</dd>
      </dl>
      <div class="prompt${short ? ' is-short' : ''}">
        <div class="prompt-head"><h3>提示词原文</h3><span class="count">${(p.text || '').length} 字符</span>
          <button class="btn small" type="button" data-copy="${ch.nn}">复制全文</button></div>
        <div class="prompt-body"><pre class="prompt-text" tabindex="0">${esc(p.text)}</pre></div>
        <div class="prompt-foot"><span class="src">摘自 <a href="${esc(p.url)}" target="_blank" rel="noopener">原页面</a>　·　抓取于 ${esc(p.fetched)}</span>
          ${short ? '' : '<button class="btn small" type="button" data-expand aria-expanded="false">展开全文</button>'}</div>
      </div>
      <p class="known"><b>已知不足</b>　${esc(ch.known)}</p>
      <p class="files">本地留档：<code>${esc(p.file)}</code>　<code>results/${ch.slug}/NOTES.md</code></p>
    </div>
  </div>
  ${versionsHTML(ch, p)}
  ${tutorialHTML(ch)}
</section>`;
}

// 三版对比：原版只放文字描述和原页面链接（不转载别人的图、视频、模型）；一次成型原样；精细加工 = 修正版（+ v3）
function versionsHTML(ch, p) {
  const fine = ch.v3 ? 'v3' : 'fixed';
  return `
  <div class="versions" aria-label="三版对比">
    <div class="vs-head"><h3>三版对比</h3><p class="vs-diff"><b>差在哪</b>${esc(ch.diff)}</p></div>
    <div class="vs-grid">
      <article class="vs-card vs-orig">
        <p class="vs-tag"><b>① 原版</b>原作者在 Tripo 页面上的成品</p>
        <div class="vs-orig-body">
          <p>${esc(ch.orig)}</p>
          <p class="vs-note">本页不下载、不转载原作者的图片、视频和模型，只写看到的样子。想看原样请打开原页面。</p>
          <a class="btn" href="${esc(p.url)}" target="_blank" rel="noopener">在 Tripo 打开原页面 ↗</a>
        </div>
      </article>
      <figure class="vs-card vs-one">
        <p class="vs-tag"><b>② 我们的一次成型</b>原样保留，没改一个字</p>
        <div class="frame"><img src="media/${ch.nn}-oneshot.jpg" alt="${esc(ch.zh)}一次成型版截图：${esc(ch.oneshotShot)}" loading="lazy" decoding="async"></div>
        <figcaption><span class="pill ${ch.oneshot.ok ? 'good' : 'bad'}">${esc(ch.oneshot.label)}</span>${esc(ch.oneshot.detail)}</figcaption>
      </figure>
      <figure class="vs-card vs-fine" data-fine="${fine}">
        <p class="vs-tag"><b>③ 精细加工版</b>${ch.v3 ? `<span class="seg" role="group" aria-label="切换精细加工版">
          <button type="button" data-fine-set="fixed" aria-pressed="false">修正版</button><button type="button" data-fine-set="v3" aria-pressed="true">${esc(ch.v3.label)}</button></span>` : '修正版'}</p>
        <div class="frame">
          <img class="fine-fixed" src="media/${ch.nn}-a.jpg" alt="${esc(ch.zh)}修正版截图：${esc(ch.shots[0])}" loading="lazy" decoding="async">
          ${ch.v3 ? `<img class="fine-v3" src="media/${ch.nn}-v3.jpg" alt="${esc(ch.zh)} ${esc(ch.v3.shot)}" loading="lazy" decoding="async">` : ''}
        </div>
        <figcaption><span class="fine-fixed">修正版：${esc(ch.fixes)}</span>${ch.v3 ? `<span class="fine-v3">${esc(ch.v3.detail)}</span>` : ''}</figcaption>
      </figure>
    </div>
  </div>`;
}

// 新手教程：内容来自 tutorials/NN-*.md（build-tutorials.py 转成 js/tutorials.js）
function tutorialHTML(ch) {
  const t = TUT[ch.nn];
  if (!t) return '';
  return `
  <details class="tutorial" id="tut-${ch.nn}">
    <summary><span class="tut-kicker">新手教程 · 第 ${ch.nn} 章</span><span class="tut-title">${esc(t.title)}</span><span class="tut-meta">${t.steps} 步 · 点开展开</span></summary>
    <div class="tut-body">${t.html.replaceAll('src="img/', `src="${BASE}tutorials/img/`)}
      <p class="tut-md">同一份教程的 Markdown 版：<a href="${MD_BASE}${esc(t.file)}" target="_blank" rel="noopener"><code>tutorials/${esc(t.file)}</code></a></p>
    </div>
  </details>`;
}

$('#chapters').innerHTML = CH.map(chapterHTML).join('');
$('#rail').innerHTML = `<a href="#hero" data-rail="hero"><span>开场</span><i></i></a>` +
  `<a href="#learn" data-rail="learn"><span>新手教程</span><i></i></a>` +
  CH.map((c) => `<a href="#ch-${c.nn}" data-rail="${c.nn}"><span>${c.nn} ${esc(c.zh)}</span><i></i></a>`).join('') +
  `<a href="#assets" data-rail="assets"><span>资产</span><i></i></a>` +
  `<a href="#outro" data-rail="outro"><span>对照表</span><i></i></a>`;
$('#summary').innerHTML = `<thead><tr><th>#</th><th>提示词</th><th>类型</th><th>一次成型</th><th>修改</th><th>v3</th><th>耗时</th><th>出处</th></tr></thead><tbody>` +
  CH.map((c) => {
    const p = PR[c.nn] || {};
    return `<tr style="--c:${c.palette.accent}"><td>${c.nn}</td><td><a href="#ch-${c.nn}">${esc(c.zh)}</a><span class="sub">${esc(c.en)}</span></td>
      <td>${esc(p.kind)}</td><td><span class="pill ${c.oneshot.ok ? 'good' : 'bad'}" style="--accent:${c.palette.accent}">${esc(c.oneshot.label)}</span></td>
      <td>${esc(c.fixes.split('：')[0].split('，')[0])}</td><td>${c.v3 ? esc(c.v3.label.replace(/^v3 · /, '')) : '<span class="sub">—</span>'}</td><td>${esc(c.time)}</td>
      <td><a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.author)}</a></td></tr>`;
  }).join('') + '</tbody>';

// 新手教程入口：点一章就展开那一章的教程并滚过去
$('#learn-list').innerHTML = CH.map((c) => {
  const t = TUT[c.nn];
  return `<li style="--c:${c.palette.accent}"><a href="#tut-${c.nn}" data-tut="${c.nn}"><b>${c.nn}</b><span>${esc(c.zh)}</span>
    <em>${t ? `${t.steps} 步${c.v3 ? ' · 含 v3' : ''}` : '整理中'}</em></a></li>`;
}).join('');

// 资产区：转台录像默认放，点开才加载实时查看器（和章节共用「全页只开 1 个 iframe」）
const fmtMB = (b) => (b / 1048576).toFixed(b < 1048576 ? 2 : 1) + ' MB';
$('#asset-grid').innerHTML = AS.map((a) => `
  <article class="asset" data-asset="${a.key}">
    <div class="screen asset-screen">
      <img class="poster" src="media/assets/${a.key}.jpg" alt="${esc(a.zh)} 转台预览" loading="lazy" decoding="async">
      <video muted loop playsinline preload="none" data-src="media/assets/${a.key}.mp4" aria-label="${esc(a.zh)} 转台录像"></video>
      <span class="screen-badge">转台录像</span>
      <button class="shield" type="button" hidden><span>点一下开始拖动查看</span></button>
    </div>
    <div class="asset-info">
      <h3>${esc(a.zh)}<small>${esc(a.role)}</small></h3>
      <dl>
        <dt>生成</dt><dd>${esc(a.gen)}<span class="sub">${esc(a.via)} · 参考图 ${esc(a.ref)}</span></dd>
        <dt>花费</dt><dd>¥${a.cost.toFixed(1)}<span class="sub">${esc(a.costNote)}</span></dd>
        <dt>面数</dt><dd>${a.tris.toLocaleString()}<span class="sub">生成时 ${a.rawTris.toLocaleString()}</span></dd>
        <dt>文件</dt><dd>${fmtMB(a.bytes)}<span class="sub">贴图 ${esc(a.tex)}</span></dd>
        <dt>处理</dt><dd>${esc(a.post)}</dd>
        ${a.rig ? `<dt>动作</dt><dd>${esc(a.rig.clips)}<span class="sub">自动绑骨 ${a.rig.bones} 根骨骼 · 带动作的文件 ${fmtMB(a.rig.bytes)}</span></dd>` : ''}
      </dl>
      <div class="player-actions">
        <button class="btn primary small" type="button" data-view="${a.key}">▶ ${a.rig ? '实时查看（可切换动作）' : '实时查看'}</button>
        <button class="btn small" type="button" data-stop hidden>■ 停止</button>
      </div>
    </div>
  </article>`).join('');

/* ---------- 2. 平滑滚动 ---------- */
let lenis = null;
if (!reduced && !isMobile() && window.Lenis && gsap && ST) {
  lenis = new window.Lenis({ lerp: 0.1, wheelMultiplier: 0.9, smoothWheel: true });
  lenis.on('scroll', ST.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  window.__lenis = lenis;
}
function scrollToEl(el) {
  if (!el) return;
  if (lenis) { lenis.scrollTo(el, { duration: 1.6 }); return; }
  // 手机上一口气平滑滚几十屏会被途中的 pin 重算打断，远距离直接跳过去
  const far = Math.abs(el.getBoundingClientRect().top) > innerHeight * 4;
  el.scrollIntoView({ behavior: reduced || far ? 'auto' : 'smooth' });
}
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;
  const el = document.getElementById(a.getAttribute('href').slice(1));
  if (!el) return;
  e.preventDefault();
  if (el.matches('details') && !el.open) {
    // 先展开教程：toggle 会让 ScrollTrigger 重算位置，等它算完再滚，否则滚动会被打断
    el.open = true;
    setTimeout(() => scrollToEl(el), 120);
  } else scrollToEl(el);
});

/* ---------- 3. 开场三维场景 ---------- */
const heroEl = $('#hero');
let hero = null;
function heroFallback(why) {
  console.warn('[hero] 用静态拼图代替三维场景：', why);
  const fb = $('#hero-fallback');
  fb.innerHTML = CH.map((c) => `<img src="media/${c.nn}-a.jpg" alt="">`).join('');
  fb.hidden = false;
  $('#hero-canvas').style.display = 'none';
}
function webglOK() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}
const caption = $('#hero-caption');
function onFrame(i) {
  if (i < 0) { caption.classList.remove('is-on'); return; }
  const c = CH[i];
  caption.querySelector('.hc-nn').textContent = c.nn + ' / ' + pad2(CH.length);
  caption.querySelector('.hc-title').textContent = c.zh;
  caption.querySelector('.hc-en').textContent = c.en;
  caption.style.setProperty('--accent', c.palette.accent);
  caption.classList.add('is-on');
}
async function initHero() {
  if (!webglOK()) return heroFallback('浏览器不支持 WebGL');
  try {
    const { createHero } = await import('./hero.js');
    hero = createHero({ canvas: $('#hero-canvas'), chapters: CH, reduced, mobile: isMobile(), glb: document.body.dataset.heroGlb || '', glbYaw: parseFloat(document.body.dataset.heroYaw) || 0, onFrame });
    window.__hero = hero;
    const io = new IntersectionObserver(([en]) => hero.setActive(en.isIntersecting && !document.hidden));
    io.observe(heroEl);
    document.addEventListener('visibilitychange', () => hero.setActive(!document.hidden && heroEl.getBoundingClientRect().bottom > 0));
    if (heroProgress) hero.setProgress(heroProgress);
  } catch (err) {
    heroFallback(err?.message || err);
  }
}
let heroProgress = 0;

/* ---------- 4. 滚动动效 ---------- */
const root = document.documentElement;
function setTheme(t) {
  if (gsap) gsap.to(root, { '--page-bg': t.bg, '--accent': t.accent, duration: reduced ? 0 : 0.9, ease: 'power2.out', overwrite: true });
  else { root.style.setProperty('--page-bg', t.bg); root.style.setProperty('--accent', t.accent); }
}
function setRail(key) {
  $$('#rail a').forEach((a) => a.classList.toggle('is-on', a.dataset.rail === key));
}

function initMotion() {
  const bar = $('#progress-bar');
  if (!gsap || !ST) { // CDN 没加载时：页面照常能读，只是没有动效
    const onScroll = () => { const m = document.documentElement.scrollHeight - innerHeight; bar.style.transform = `scaleX(${m > 0 ? scrollY / m : 0})`; };
    addEventListener('scroll', onScroll, { passive: true }); onScroll();
    console.warn('[motion] GSAP 未加载，关闭滚动动效');
    return;
  }
  ST.create({ start: 0, end: 'max', onUpdate: (s) => { bar.style.transform = `scaleX(${s.progress})`; } });

  const mm = gsap.matchMedia();

  // 开场：pin 住，滚动推动镜头
  mm.add({ desk: '(min-width: 861px)', mob: '(max-width: 860px)', rm: '(prefers-reduced-motion: reduce)' }, (ctx) => {
    const { mob, rm } = ctx.conditions;
    if (rm) return;
    const copyLayers = $$('#hero-copy [data-depth]');
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: heroEl, start: 'top top', end: mob ? '+=220%' : '+=320%', pin: true, scrub: true, anticipatePin: 1,
        onUpdate: (s) => { heroProgress = s.progress; if (hero) hero.setProgress(s.progress); },
      },
    });
    // 标题各层按 data-depth 以不同速度上移，整块文字同时淡出
    copyLayers.forEach((el) => tl.to(el, { y: -140 * parseFloat(el.dataset.depth), ease: 'power1.in', duration: 0.1 }, 0));
    tl.to('#hero-copy', { autoAlpha: 0, ease: 'power1.in', duration: 0.08 }, 0.01);
    tl.to('#hero-end', { autoAlpha: 1, y: -10, duration: 0.06 }, 0.92).to({}, { duration: 0.02 }, 0.98);
  });

  // 总览：数字按不同速度漂，背景大字横移
  mm.add('(prefers-reduced-motion: no-preference)', () => {
    const ov = $('#overview');
    $$('.ov-item', ov).forEach((el) => {
      const s = (parseFloat(el.dataset.speed) - 1) * (isMobile() ? 120 : 320);
      gsap.fromTo(el, { y: s }, { y: -s, ease: 'none', scrollTrigger: { trigger: ov, start: 'top bottom', end: 'bottom top', scrub: true } });
    });
    gsap.fromTo('.ov-back', { xPercent: 6 }, { xPercent: -22, ease: 'none', scrollTrigger: { trigger: ov, start: 'top bottom', end: 'bottom top', scrub: true } });
  });

  // 章节舞台：桌面 pin + 三维运镜；手机只留轻量视差
  mm.add({ desk: '(min-width: 861px) and (prefers-reduced-motion: no-preference)', mob: '(max-width: 860px) and (prefers-reduced-motion: no-preference)' }, (ctx) => {
    const { desk } = ctx.conditions;
    $$('.chapter').forEach((sec) => {
      const stage = $('.stage', sec), cam = $('.stage-cam', sec), bg = $('.stage-bg', sec), num = $('.stage-num', sec), title = $('.stage-title', sec);
      const a = $('.card-a', sec), b = $('.card-b', sec), c = $('.card-c', sec);
      if (desk) {
        // 进场：舞台还没到顶时背景和大号数字已经开始漂
        gsap.fromTo(bg, { yPercent: -10 }, { yPercent: 0, ease: 'none', scrollTrigger: { trigger: stage, start: 'top bottom', end: 'top top', scrub: true } });
        gsap.fromTo(num, { yPercent: -45 }, { yPercent: -10, ease: 'none', scrollTrigger: { trigger: stage, start: 'top bottom', end: 'top top', scrub: true } });
        const tl = gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: stage, start: 'top top', end: '+=150%', pin: true, scrub: 0.8, anticipatePin: 1 } });
        tl.fromTo(cam, { rotationY: -16, rotationX: 9, z: -520 }, { rotationY: 11, rotationX: -5, z: 110, duration: 1 }, 0)
          .fromTo($('.frame', a), { clipPath: 'inset(16% 24% 16% 24% round 14px)' }, { clipPath: 'inset(0% 0% 0% 0% round 14px)', duration: 0.42, ease: 'power2.out' }, 0)
          .fromTo(b, { yPercent: 70, z: 240, rotationY: -8 }, { yPercent: -90, z: 240, rotationY: 4, duration: 1 }, 0)
          // 竖版截图很高，只小幅上移、z 也小一些，否则会升进标题下的导语里（v2 的已知问题）
          .fromTo(c, c.classList.contains('portrait') ? { yPercent: 40, z: 160, rotationY: 10 } : { yPercent: 110, z: 380, rotationY: 10 },
            { yPercent: c.classList.contains('portrait') ? 8 : -140, z: c.classList.contains('portrait') ? 160 : 380, rotationY: -6, duration: 1 }, 0)
          .fromTo(bg, { scale: 1.16 }, { scale: 1, yPercent: 8, duration: 1 }, 0)
          .fromTo(num, { yPercent: -10 }, { yPercent: 38, duration: 1 }, 0)
          .fromTo(title, { autoAlpha: 0, y: 50 }, { autoAlpha: 1, y: 0, duration: 0.18, ease: 'power2.out' }, 0.04)
          .to(title, { y: -30, duration: 0.3 }, 0.7);
      } else {
        [[bg, 14], [num, 30], [a, 6], [b, 14], [c, 22]].forEach(([el, amt]) => {
          gsap.fromTo(el, { yPercent: amt }, { yPercent: -amt, ease: 'none', scrollTrigger: { trigger: stage, start: 'top bottom', end: 'bottom top', scrub: true } });
        });
      }
      // 档案区的元素依次浮上来
      gsap.from($$('.player, .meta, .prompt, .known', sec), {
        y: 50, autoAlpha: 0, duration: 0.9, stagger: 0.08, ease: 'power3.out',
        scrollTrigger: { trigger: $('.dossier', sec), start: 'top 78%', once: true },
      });
    });
  });
  // 主题色与侧边导航：放在所有 pin 之后创建，位置才会算上 pin 撑出来的距离
  const zones = [['hero', heroEl, DEFAULT_THEME], ['overview', $('#overview'), DEFAULT_THEME], ['learn', $('#learn'), DEFAULT_THEME],
    ...CH.map((c) => [c.nn, $(`#ch-${c.nn}`), c.palette]), ['assets', $('#assets'), ASSET_THEME], ['outro', $('#outro'), DEFAULT_THEME]];
  zones.forEach(([key, el, theme]) => ST.create({
    trigger: el, start: 'top 55%', end: 'bottom 55%',
    onToggle: (s) => { if (s.isActive) { setTheme(theme); setRail(key === 'overview' ? 'hero' : key); } },
  }));
  addEventListener('load', () => ST.refresh());
}

/* ---------- 5. 预览录像：进入视口附近才加载，离开就暂停 ---------- */
function initVideos() {
  const near = new IntersectionObserver((ens) => ens.forEach((en) => {
    if (!en.isIntersecting) return;
    const v = en.target; if (!v.src) { v.src = v.dataset.src; v.preload = 'auto'; }
    near.unobserve(v);
  }), { rootMargin: '300px 0px' });
  const vis = new IntersectionObserver((ens) => ens.forEach((en) => {
    const v = en.target;
    if (en.isIntersecting && !v.closest('.screen').classList.contains('has-live')) v.play().catch(() => {});
    else v.pause();
  }), { threshold: 0.15 });
  $$('.screen video').forEach((v) => { near.observe(v); vis.observe(v); if (reduced) v.removeAttribute('loop'); });
}

/* ---------- 6. 实时场景：全页最多 1 个 iframe，离开视口就卸载 ---------- */
const live = { cur: null, log: [] };
const hud = $('#live-hud'), hudCount = $('#live-count');
function liveCount() { return $$('iframe.live-frame').length; }
function syncHud() { const n = liveCount(); hudCount.textContent = n; hud.classList.toggle('is-live', n > 0); }
function logLive(type, nn, variant, reason) {
  const e = { t: Math.round(performance.now()), type, nn, variant, reason, active: liveCount() };
  live.log.push(e);
  console.info(`[live] ${type}`, nn, variant, reason, `active=${e.active}`);
}
function unloadLive(reason) {
  const cur = live.cur; if (!cur) return;
  live.cur = null;
  const { screen, iframe, nn, variant, box, idleBadge } = cur;
  try { iframe.src = 'about:blank'; } catch {}
  iframe.remove();
  screen.classList.remove('has-live');
  $('.shield', screen).hidden = true;
  const badge = $('.screen-badge', screen); badge.textContent = idleBadge; badge.classList.remove('is-live');
  $('[data-stop]', box).hidden = true;
  $$('[data-live], [data-view]', box).forEach((b) => b.removeAttribute('aria-pressed'));
  const v = $('video', screen); v.style.visibility = '';
  syncHud();
  logLive('unload', nn, variant, reason);
}
// 章节和资产卡共用：box 是按钮所在的容器，screen 是放 iframe 的画面
function mountLive({ box, screen, src, title, nn, variant, badgeText, button }) {
  if (live.cur && live.cur.screen === screen && live.cur.variant === variant) return;
  if (live.cur) unloadLive(live.cur.screen === screen ? 'switch-variant' : 'switch');
  const idleBadge = $('.screen-badge', screen).textContent;
  const v = $('video', screen); v.pause(); v.style.visibility = 'hidden';
  const iframe = document.createElement('iframe');
  iframe.className = 'live-frame';
  iframe.title = title;
  iframe.allow = 'fullscreen; autoplay; gamepad';
  iframe.src = src;
  screen.appendChild(iframe);
  screen.classList.add('has-live');
  live.cur = { screen, iframe, nn, variant, box, idleBadge };
  const badge = $('.screen-badge', screen);
  badge.textContent = badgeText; badge.classList.add('is-live');
  $('.shield', screen).hidden = false;
  $('[data-stop]', box).hidden = false;
  button.setAttribute('aria-pressed', 'true');
  syncHud();
  logLive('load', nn, variant, 'click');
}
function loadLive(sec, variant) {
  const ch = CH.find((c) => c.nn === sec.dataset.nn);
  mountLive({ box: sec, screen: $('.screen', sec), src: liveSrc(ch, variant), title: `${ch.zh}（${LIVE_NAME[variant]}）实时场景`,
    nn: ch.nn, variant, badgeText: '实时 · ' + LIVE_NAME[variant], button: $(`[data-live="${variant}"]`, sec) });
}
function loadViewer(card) {
  const a = AS.find((x) => x.key === card.dataset.asset);
  const file = a.rig ? a.rig.file : `${a.key}.glb`, yaw = a.rig ? a.rig.yaw : a.yaw || 0;
  const src = `viewer.html?src=${encodeURIComponent(`${BASE}results/06-cyclops-island/v3/models/${file}`)}&yaw=${yaw}`;
  mountLive({ box: card, screen: $('.screen', card), src, title: `${a.zh} 模型实时查看器`,
    nn: 'asset', variant: a.key, badgeText: '实时 · 可拖动', button: $('[data-view]', card) });
}
function initLive() {
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-live]');
    if (b) return loadLive(b.closest('.chapter'), b.dataset.live);
    const vw = e.target.closest('[data-view]');
    if (vw) return loadViewer(vw.closest('.asset'));
    if (e.target.closest('[data-stop]')) return unloadLive('stop-button');
    const sh = e.target.closest('.shield');
    if (sh) { sh.hidden = true; const f = $('iframe', sh.parentElement); if (f) f.focus(); }
  });
  // 鼠标移出画面：重新盖上遮罩，页面恢复滚动
  $$('.screen').forEach((s) => s.addEventListener('mouseleave', () => { if (live.cur && live.cur.screen === s) $('.shield', s).hidden = false; }));
  const io = new IntersectionObserver((ens) => ens.forEach((en) => {
    if (live.cur && en.target === live.cur.screen && en.intersectionRatio < 0.2) unloadLive('left-viewport');
  }), { threshold: [0, 0.2] });
  $$('.screen').forEach((s) => io.observe(s));
  window.__live = { log: live.log, count: liveCount, unload: unloadLive };
}

/* ---------- 7. 复制与展开 ---------- */
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch {}
  const ta = document.createElement('textarea');
  ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;left:-9999px;top:0';
  document.body.appendChild(ta); ta.select();
  let ok = false; try { ok = document.execCommand('copy'); } catch {}
  ta.remove(); return ok;
}
function initPromptUI() {
  document.addEventListener('click', async (e) => {
    const c = e.target.closest('[data-copy]');
    if (c) {
      const nn = c.dataset.copy, text = (PR[nn] || {}).text || '';
      const ok = await copyText(text);
      console.info('[copy]', nn, ok ? 'ok' : 'fail', text.length);
      c.textContent = ok ? '已复制 ✓' : '复制失败，请手动选中';
      c.classList.toggle('copied', ok);
      clearTimeout(c._t); c._t = setTimeout(() => { c.textContent = '复制全文'; c.classList.remove('copied'); }, 2200);
      return;
    }
    const fs = e.target.closest('[data-fine-set]');
    if (fs) {
      const fig = fs.closest('.vs-fine'); fig.dataset.fine = fs.dataset.fineSet;
      $$('[data-fine-set]', fig).forEach((b) => b.setAttribute('aria-pressed', b === fs));
      return;
    }
    const tl = e.target.closest('[data-tut]');
    if (tl) return; // 展开和滚动都由第 2 节的锚点处理负责
    const x = e.target.closest('[data-expand]');
    if (x) {
      const box = x.closest('.prompt'); const open = box.classList.toggle('is-open');
      x.textContent = open ? '收起' : '展开全文'; x.setAttribute('aria-expanded', open);
      if (!open) { $('.prompt-text', box).scrollTop = 0; }
      if (ST) ST.refresh();
    }
  });
  // 教程展开或收起会改变页面高度，pin 的位置要重算
  $$('details.tutorial').forEach((d) => d.addEventListener('toggle', () => { if (ST) ST.refresh(); }));
}

initMotion();
initVideos();
initLive();
initPromptUI();
initHero();
import('./fx.js').then((m) => m.initFX({ gsap, ST, reduced, mobile: isMobile() })).catch((e) => console.warn('[fx] 微交互未启用：', e?.message || e));
