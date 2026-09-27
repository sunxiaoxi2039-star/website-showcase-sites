/* Astra vs Opus — 首页交互 */
(function () {
  'use strict';
  const { WORKS, V2, BATTLE, SLIDES } = window.AVO;
  const PROMPTS = window.AVO_PROMPTS || {};
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const RM = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const esc = s => String(s).replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
  const L = o => `<span data-zh>${o.zh}</span><span data-en>${o.en}</span>`;
  const lang = () => (document.documentElement.lang === 'en' ? 'en' : 'zh');

  /* ---------------- 语言 ---------------- */
  const META = {
    zh: { title: 'Astra × Opus：三轮对照', desc: 'GPT-6 Astra 发布周的作品，让 Claude 做了三轮：Opus 5 按描述临摹 6 件、Opus 5.5 隔离记忆独立逆向 5 件、20 道 Astra 原题一字不改盲做盲评，另附 128 件案例索引。' },
    en: { title: 'Astra × Opus: Three Rounds', desc: 'GPT-6 Astra’s launch-week demos, rebuilt by Claude in three rounds: 6 copies by Opus 5, 5 isolated re-derivations by Opus 5.5, and 20 original Astra prompts built and judged blind — plus a 128-case index.' }
  };
  let storageOK = true;
  function setLang(l, save) {
    document.documentElement.lang = l === 'en' ? 'en' : 'zh-CN';
    document.title = META[l].title;
    const md = $('meta[name=description]'); if (md) md.setAttribute('content', META[l].desc);
    $$('[data-alt-zh]').forEach(el => el.setAttribute('alt', el.dataset['alt' + (l === 'en' ? 'En' : 'Zh')]));
    if (save) { try { localStorage.setItem('avo-lang', l); } catch (e) { storageOK = false; } }
    if (!storageOK) tagLinks(l);
    updateSlideAlt();
    tableLabels();
  }
  function tagLinks(l) {
    $$('a[href^="./"]').forEach(a => {
      const u = a.getAttribute('href').replace(/\?lang=(zh|en)/, '');
      const [p, h] = u.split('#');
      a.setAttribute('href', p + '?lang=' + l + (h ? '#' + h : ''));
    });
  }
  try { localStorage.getItem('avo-lang'); } catch (e) { storageOK = false; }
  $('#langBtn').addEventListener('click', () => setLang(lang() === 'en' ? 'zh' : 'en', true));

  /* ---------------- 第三轮：分数图 ---------------- */
  const X = v => ((v - 20) / 30 * 100).toFixed(2) + '%';
  const rowHTML = (b, i) => `
    <a class="crow" href="./battle/index.html#${b.slug}" style="--a:${X(b.astra)};--o:${X(b.opus)};--d:${(i * 45)}ms" title="${esc(b.full)}">
      <span class="nm">${L(b)}</span>
      <span class="track">${[0, 1 / 3, 2 / 3, 1].map(x => `<i class="grid" style="left:${x * 100}%"></i>`).join('')}<i class="bar"></i><i class="pa"></i><i class="po"></i></span>
      <span class="vals"><i>${b.astra.toFixed(1)}</i> : <b>${b.opus.toFixed(1)}</b></span>
    </a>`;
  const heavy = BATTLE.filter(b => b.group === 'heavy');
  const batch = BATTLE.filter(b => b.group === 'batch').sort((a, b) => (a.opus - a.astra) - (b.opus - b.astra));
  $('#chartRows').innerHTML = `
    <div class="cgroup heavy">
      <div class="cgroup-h"><b>${L({ zh: '重量级 3 题', en: 'Heavyweight · 3' })}</b>${L({ zh: '单独打磨的游戏 · 差距 3–5.5 分', en: 'Individually polished games · 3–5.5 points apart' })}</div>
      ${heavy.map(rowHTML).join('')}
    </div>
    <div class="cgroup">
      <div class="cgroup-h"><b>${L({ zh: '批量组 17 题', en: 'Batch · 17' })}</b>${L({ zh: '一次生成 100 件中的 2–5 KB 小品 · 按分差排序', en: '2–5 KB sketches from a 100-piece run · sorted by gap' })}</div>
      ${batch.map((b, i) => rowHTML(b, i + 3)).join('')}
    </div>`;

  $('#heavyMini').innerHTML = heavy.map(b => `
    <a class="hm" href="./battle/index.html#${b.slug}">
      <span class="t">${L(b)}</span>
      <span class="s"><i>${b.astra.toFixed(1)}</i> : <b>${b.opus.toFixed(1)}</b></span>
      <span class="g"><span style="left:0;width:${b.astra / 50 * 100}%;background:rgba(110,231,165,.55)"></span><span style="left:${b.astra / 50 * 100}%;width:${(b.opus - b.astra) / 50 * 100}%;background:var(--o55)"></span></span>
    </a>`).join('');

  /* ---------------- 第三轮：对比滑块 ---------------- */
  const slider = $('#slider'), imgA = $('#imgA'), imgO = $('#imgO');
  let cur = SLIDES[0];
  const chips = $('#cmpChips');
  chips.innerHTML = SLIDES.map(s => {
    const b = BATTLE.find(x => x.slug === s);
    return `<button type="button" role="tab" data-s="${s}" class="${b.group === 'heavy' ? 'hv' : ''}">${L(b)}</button>`;
  }).join('');
  function updateSlideAlt() {
    const b = BATTLE.find(x => x.slug === cur); if (!b) return;
    const n = lang() === 'en' ? b.en : b.zh;
    imgA.alt = (lang() === 'en' ? 'GPT-6 Astra original: ' : 'GPT-6 Astra 原作：') + n;
    imgO.alt = (lang() === 'en' ? 'Opus 5.5 version: ' : 'Opus 5.5 版本：') + n;
  }
  function showSlide(s) {
    cur = s;
    const b = BATTLE.find(x => x.slug === s);
    imgA.src = `./battle/originals/${s}.jpg`;
    imgO.src = `./battle/shots/${s}.jpg`;
    $$('button', chips).forEach(c => c.setAttribute('aria-selected', c.dataset.s === s ? 'true' : 'false'));
    $('#cmpFoot').innerHTML = `
      <span><b>${L(b)}</b> · ${b.group === 'heavy' ? L({ zh: '重量级', en: 'Heavyweight' }) : L({ zh: '批量组', en: 'Batch' })}
      · <span class="sc"><i>${b.astra.toFixed(1)}</i> : <em>${b.opus.toFixed(1)}</em></span></span>
      <a href="./battle/index.html#${s}">${L({ zh: '看这场对决', en: 'Open this duel' })} ↗</a>`;
    updateSlideAlt();
  }
  chips.addEventListener('click', e => { const c = e.target.closest('button'); if (c) showSlide(c.dataset.s); });
  let pos = 50;
  const setPos = p => { pos = Math.max(0, Math.min(100, p)); slider.style.setProperty('--p', pos + '%'); slider.setAttribute('aria-valuenow', Math.round(pos)); };
  let drag = null;
  slider.addEventListener('pointerdown', e => {
    slider.classList.remove('hint-anim');
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, active: e.pointerType === 'mouse' };
    if (drag.active) { slider.setPointerCapture(e.pointerId); move(e); }
  });
  function move(e) { const r = slider.getBoundingClientRect(); setPos((e.clientX - r.left) / r.width * 100); }
  slider.addEventListener('pointermove', e => {
    if (!drag || drag.id !== e.pointerId) return;
    if (!drag.active) {
      const dx = Math.abs(e.clientX - drag.x), dy = Math.abs(e.clientY - drag.y);
      if (dx > 6 && dx > dy) { drag.active = true; try { slider.setPointerCapture(e.pointerId); } catch (_) {} }
      else if (dy > 8) { drag = null; return; }
      else return;
    }
    move(e);
  });
  const end = () => { drag = null; };
  slider.addEventListener('pointerup', e => { if (drag && !drag.active) move(e); end(); });
  slider.addEventListener('pointercancel', end);
  slider.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft') { setPos(pos - 5); e.preventDefault(); }
    if (e.key === 'ArrowRight') { setPos(pos + 5); e.preventDefault(); }
  });
  showSlide(cur);

  /* ---------------- 第二轮卡片 ---------------- */
  $('#v2grid').innerHTML = V2.map(w => `
    <div class="v2card rv">
      <a class="v2in" href="./compare/index.html#${w.slug}">
        <div class="v2img"><img src="./works-v2/${w.slug}/cover.jpg" alt="${esc(w.name.zh)}" data-alt-zh="${esc(w.name.zh)} · Opus 5.5 版封面" data-alt-en="${esc(w.name.en)} · Opus 5.5 cover" loading="lazy"><span class="v2go">${L({ zh: '三方对照 ↗', en: 'Compare ↗' })}</span></div>
        <div class="v2body">
          <h3>${L(w.name)}</h3>
          <p>${L(w.summary)}</p>
          <span class="base ${w.higher ? 'higher' : 'same'}">${w.higher ? L({ zh: '起跑线更高', en: 'Higher starting line' }) : L({ zh: '同一起跑线', en: 'Same starting line' })} · ${L(w.base)}</span>
        </div>
        <i class="gloss"></i>
      </a>
    </div>`).join('');

  if (!RM) {
    $$('.v2in').forEach(card => {
      let raf = 0;
      const upd = e => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          card.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
          card.style.setProperty('--my', (py * 100).toFixed(1) + '%');
          card.style.setProperty('--rx', ((0.5 - py) * 8).toFixed(2) + 'deg');
          card.style.setProperty('--ry', ((px - 0.5) * 10).toFixed(2) + 'deg');
        });
      };
      card.addEventListener('pointerenter', e => { card.classList.add('tilting'); upd(e); });
      card.addEventListener('pointermove', upd);
      const reset = () => { card.classList.remove('tilting'); card.style.setProperty('--rx', '0deg'); card.style.setProperty('--ry', '0deg'); };
      card.addEventListener('pointerleave', reset);
      card.addEventListener('pointercancel', reset);
      card.addEventListener('pointerup', e => { if (e.pointerType !== 'mouse') setTimeout(reset, 250); });
    });
  }

  /* ---------------- 第一轮 ---------------- */
  const pairs = $('#pairs');
  pairs.innerHTML = WORKS.map((w, i) => `
    <article class="pair rv">
      <div class="shot">
        <img src="./assets/covers/${w.slug}.jpg" alt="${esc(w.name.zh)}" data-alt-zh="${esc(w.name.zh)} 临摹截图" data-alt-en="${esc(w.name.en)} — copy screenshot" loading="lazy">
        <div class="shotbar">
          <button type="button" data-embed="${w.slug}">${L({ zh: '▶ 内嵌预览', en: '▶ Live preview' })}</button>
          <a href="./works/${w.slug}/index.html" target="_blank" rel="noopener">${L({ zh: '全屏打开 ↗', en: 'Full screen ↗' })}</a>
        </div>
      </div>
      <div class="info">
        <div class="side a">${L({ zh: 'Astra · 原作', en: 'Astra · original' })}</div>
        <h3>${L(w.name)}</h3>
        <div class="en" data-zh>${esc(w.name.en)}</div>
        <p class="odesc">${L(w.originDesc)}</p>
        <div class="links"><span>${L({ zh: '作者', en: 'By' })} <b>${w.author}</b></span>
          <a href="${w.post}" target="_blank" rel="noopener">${L({ zh: '原帖 ↗', en: 'Post ↗' })}</a>
          ${w.demo ? `<a href="${w.demo}" target="_blank" rel="noopener">${L({ zh: '原作 demo ↗', en: 'Original demo ↗' })}</a>` : ''}
          ${w.repo ? `<a href="${w.repo}" target="_blank" rel="noopener">${L({ zh: '仓库 ↗', en: 'Repo ↗' })}</a>` : ''}
        </div>
        <div class="copyblk">
          <div class="side o">${L({ zh: 'Opus 5 · 临摹', en: 'Opus 5 · copy' })}</div>
          <h4>${L(w.copyTitle)}</h4>
          <div class="cols">
            <div><h5>${L({ zh: '做到了什么', en: 'What it does' })}</h5><ul>${w.did.map(d => `<li>${L(d)}</li>`).join('')}</ul></div>
            <div><h5>${L({ zh: '差在哪', en: 'Where it falls short' })}</h5><ul>${w.gap.map(d => `<li>${L(d)}</li>`).join('')}</ul></div>
          </div>
          <div class="tags">${w.tags.map(t => `<span>${L(t)}</span>`).join('')}</div>
          <details class="pbox">
            <summary><span>${L({ zh: '生成这件临摹用的 prompt', en: 'The prompt behind this copy' })}</span><em>${L({ zh: '原文 · 可一键复制', en: 'Original (Chinese) · copy' })}</em></summary>
            <div class="pbody">
              <button class="pcopy" type="button" data-copy="${w.slug}">${L({ zh: '复制', en: 'Copy' })}</button>
              <pre lang="zh-CN">${esc(PROMPTS[w.slug] || '')}</pre>
              <details class="ptrans" data-en><summary>English translation (for reference)</summary><pre lang="en">${esc(w.promptEn)}</pre></details>
            </div>
          </details>
        </div>
      </div>
    </article>`).join('');

  pairs.addEventListener('click', e => {
    const btn = e.target.closest('.pcopy');
    if (btn) {
      const text = PROMPTS[btn.dataset.copy] || '';
      const done = ok => { btn.innerHTML = ok ? L({ zh: '已复制', en: 'Copied' }) : L({ zh: '复制失败', en: 'Copy failed' }); setTimeout(() => { btn.innerHTML = L({ zh: '复制', en: 'Copy' }); }, 1600); };
      const fallback = () => {
        try { const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove(); done(ok); } catch (_) { done(false); }
      };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => done(true), fallback); else fallback();
      return;
    }
    const eb = e.target.closest('[data-embed]');
    if (!eb) return;
    const shot = eb.closest('.shot'), slug = eb.dataset.embed;
    if (shot.dataset.live === '1') {
      const f = shot.querySelector('iframe'); if (f) f.remove();
      shot.querySelector('img').style.opacity = '1';
      shot.dataset.live = '0';
      eb.innerHTML = L({ zh: '▶ 内嵌预览', en: '▶ Live preview' });
      return;
    }
    const frame = document.createElement('iframe');
    frame.src = `./works/${slug}/index.html`;
    frame.title = slug;
    frame.setAttribute('allow', 'autoplay; fullscreen');
    shot.insertBefore(frame, shot.querySelector('.shotbar'));
    shot.querySelector('img').style.opacity = '0';
    shot.dataset.live = '1';
    eb.innerHTML = L({ zh: '■ 收起预览', en: '■ Close preview' });
  });

  const lbl = { sell: { zh: '原作的核心卖点', en: 'What sells the original' }, mine: { zh: '临摹的实现路线', en: 'How the copy does it' }, score: { zh: '自评还原度', en: 'Self-rated fidelity' }, gap: { zh: '主要差距', en: 'Main gap' } };
  $('#tbody').innerHTML = WORKS.map(w => `
    <tr>
      <td><b>${L(w.name)}</b><small>${w.author}</small></td>
      <td data-l="">${L(w.row.sell)}</td>
      <td data-l="">${L(w.row.mine)}</td>
      <td data-l=""><span class="score">${w.row.score}%<i><b style="--w:${w.row.score}%"></b></i></span></td>
      <td data-l="">${L(w.row.gap)}</td>
    </tr>`).join('');
  function tableLabels() {
    const keys = ['sell', 'mine', 'score', 'gap'];
    $$('#tbody tr').forEach(tr => $$('td[data-l]', tr).forEach((td, i) => td.setAttribute('data-l', lbl[keys[i]][lang()])));
  }

  /* ---------------- 数字滚动 ---------------- */
  function countUp(el) {
    const to = +el.dataset.count;
    if (RM || to === 0) { el.textContent = to; return; }
    const t0 = performance.now(), dur = 1400 + Math.min(to, 128) * 4;
    el.textContent = '0';
    const step = t => {
      const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(2, -10 * k);
      el.textContent = Math.round(to * (k >= 1 ? 1 : e));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /* ---------------- 揭示 + 导航 ---------------- */
  const revealTargets = $$('.rv, .chart, .ftable, [data-count]');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(ents => ents.forEach(en => {
      if (!en.isIntersecting) return;
      const el = en.target;
      el.classList.add('in');
      if (el.dataset.count != null) countUp(el);
      io.unobserve(el);
    }), { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    revealTargets.forEach(el => io.observe(el));
  } else revealTargets.forEach(el => el.classList.add('in'));

  const dock = $('#dock');
  const navLinks = $$('a', dock);
  const secs = $$('[data-nav]');
  let ticking = false;
  function onScroll() {
    ticking = false;
    const y = window.scrollY, vh = window.innerHeight;
    dock.classList.toggle('show', y > vh * 0.55);
    let on = null;
    secs.forEach(s => { if (s.getBoundingClientRect().top < vh * 0.45) on = s.dataset.nav; });
    navLinks.forEach(a => a.classList.toggle('on', a.dataset.k === on));
  }
  window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();

  // 滑块首次进入视野时演示一下可拖动
  if (!RM && 'IntersectionObserver' in window) {
    const so = new IntersectionObserver(ents => {
      if (!ents[0].isIntersecting) return;
      so.disconnect();
      slider.classList.add('hint-anim');
      setPos(28);
      setTimeout(() => setPos(62), 900);
      setTimeout(() => { setPos(50); setTimeout(() => slider.classList.remove('hint-anim'), 950); }, 1800);
    }, { threshold: 0.6 });
    so.observe(slider);
  }

  setLang(lang(), false);
})();
