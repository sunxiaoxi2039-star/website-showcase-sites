// X 艺术案例十则 · 页面主逻辑
// 数据：先读 site/cases.json（merge-cases.py 合并的正式数据），缺失时退回 site/cases.sample.json（三条占位）。
// 加 ?data=sample 可直接读占位数据；?data=sample/xxx.json 读 site/sample/ 下的测试数据（自测件数 1–10 用）。
// 展签编辑层 site/labels.json：只在 cases.json 对应字段为空时补位（一句话评、看点、技法、作者说明）。
import { initHero } from './hero.js';

const root = document.documentElement;
const reducedMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
let reduced = reducedMQ.matches; // 系统设置中途切换时由 change 监听更新
const $ = (s, el = document) => el.querySelector(s);
const SERIES_MIN = 10; // 「十则」：编号按十则原序，分母至少是 10
const VERDICT_MAX = 50; // summary_cn 不超过这个长度才直接当「一句话评」，更长的收进「展品说明」
const FIRST_MAX = 48; // 简介太长又没有 verdict_cn 时，首句不超过这个长度就拿来当「一句话评」

// 三版都是 Claude Opus 5.5 写的；原作者的成品不搬过来，只给原帖链接
const VERSIONS = [
  { key: 'oneshot', no: '①', label: '一次成型', who: 'Claude 首版，原样没改', short: '首版' },
  { key: 'fixed', no: '②', label: '修正版', who: 'Claude 只修跑不动、画错的地方', short: '修正' },
  { key: 'final', no: '③', label: '精修版', who: 'Claude 在前一版上再打磨', short: '精修' },
];
const CN_NUM = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
const EXEC_MODEL = 'Claude Opus 5.5';
const measurers = []; // 提示词折叠判断，渲染后与 resize、字体加载后各跑一次
const remeasure = () => measurers.forEach((f) => f());

/* ---------------- 小工具 ---------------- */
function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'style') el.style.cssText = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid);
  return el;
}
const pad2 = (n) => String(n ?? '').padStart(2, '0');
const cnNum = (n) => (n >= 0 && n <= 10 ? CN_NUM[n] : String(n));
const has = (v) => typeof v === 'string' ? v.trim() !== '' : v != null;
const handleOf = (a) => (a ? '@' + String(a).trim().replace(/^@+/, '') : '');
function safeHttp(u) {
  try { const x = new URL(u, location.href); return /^https?:$/.test(x.protocol) ? x.href : null; } catch (_) { return null; }
}
// 现场地址：相对路径（相对 x-art/）或 data:text/html（占位数据用）；其余一律不收
function safeSrc(u) {
  if (!has(u)) return null;
  const s = String(u).trim();
  if (/^data:text\/html[;,]/i.test(s)) return s;
  if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return /^https?:/i.test(s) ? s : null;
  return s;
}
function fmtScore(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  if (n <= 10) return `${n} / 10`;
  if (n <= 100) return `${n} / 100`;
  return String(n);
}
function asList(v) {
  if (Array.isArray(v)) return v.filter(has).map(String);
  if (has(v)) return String(v).split(/\n+/).map((s) => s.replace(/^[-*·\s]+/, '').trim()).filter(Boolean);
  return [];
}
// 文字里的 @账号 变成 X 主页链接
function withHandles(text) {
  return String(text).split(/(@[A-Za-z0-9_]{1,15})/).filter((s) => s !== '').map((s) =>
    /^@[A-Za-z0-9_]{1,15}$/.test(s) ? h('a', { href: `https://x.com/${s.slice(1)}`, target: '_blank', rel: 'noopener noreferrer', text: s }) : s);
}
// 「原话（原帖用弯引号括起，框引号已去掉）」这类标注改成顺口的说法
function fmtVerbatim(v) {
  if (v === true || v === 'True' || v === 'true') return '逐字原文';
  if (v === false || v === 'False' || v === 'false') return '非逐字，按原帖整理';
  if (!has(v)) return null;
  return String(v).replace(/原帖用.{0,3}引号括起[，,]?\s*框引号已去掉/g, '原帖外层引号已省略');
}
const canFullscreen = !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);

/* ---------------- 数据 ---------------- */
async function loadCases() {
  const want = new URLSearchParams(location.search).get('data');
  const tryLoad = async (url) => {
    const r = await fetch(url, { cache: 'no-cache' });
    if (!r.ok) throw new Error(url + ' ' + r.status);
    const j = await r.json();
    const arr = Array.isArray(j) ? j : Array.isArray(j?.cases) ? j.cases : null;
    if (!arr || !arr.length) throw new Error(url + ' 为空');
    return arr;
  };
  if (want === 'sample') return { cases: await tryLoad('site/cases.sample.json'), sample: true, placeholder: true };
  if (want && /^sample\/[\w-]+\.json$/.test(want)) return { cases: await tryLoad('site/' + want), sample: true, placeholder: false };
  try { return { cases: await tryLoad('site/cases.json'), sample: false }; }
  catch (err) {
    console.info('[x-art] 正式数据暂缺，改读占位数据 cases.sample.json');
    return { cases: await tryLoad('site/cases.sample.json'), sample: true, placeholder: true };
  }
}
// 展签编辑层；读不到就当没有，不影响页面
async function loadLabels() {
  try {
    const r = await fetch('site/labels.json', { cache: 'no-cache' });
    if (!r.ok) return {};
    const j = await r.json();
    return j && typeof j === 'object' && !Array.isArray(j) ? j : {};
  } catch (_) { return {}; }
}
function normalize(c, i, labels = {}) {
  const nn = pad2(c.nn ?? i + 1);
  const vp = c.vposters && typeof c.vposters === 'object' ? c.vposters : {};
  const versions = VERSIONS.filter((v) => safeSrc(c[v.key])).map((v) => ({ ...v, src: safeSrc(c[v.key]), poster: safeSrc(vp[v.key]) || null }));
  // cases.json 有值时以它为准，空着才用编辑层补位
  const o = labels[nn] && typeof labels[nn] === 'object' ? labels[nn] : {};
  const text = (k) => (has(c[k]) && typeof c[k] === 'string' ? c[k].trim() : has(o[k]) && typeof o[k] === 'string' ? o[k].trim() : null);
  const list = (k) => (asList(c[k]).length ? asList(c[k]) : asList(o[k]));
  const summary = has(c.summary_cn) ? String(c.summary_cn).trim() : null;
  // 一句话评：优先 verdict_cn（数据或编辑层）；没有时，简介够短就整段用，
  // 否则取简介首句（不超过 FIRST_MAX 字），其余收进「展品说明」
  let verdict = text('verdict_cn');
  let about = summary;
  if (!verdict && summary) {
    if (summary.length <= VERDICT_MAX) { verdict = summary; about = null; }
    else {
      const m = summary.match(/^[^。！？!?]+[。！？!?]/);
      if (m && m[0].length <= FIRST_MAX) { verdict = m[0]; about = summary.slice(m[0].length).trim() || null; }
    }
  }
  return {
    ...c, nn, id: 'w-' + (c.slug ? String(c.slug).replace(/[^a-z0-9-]/gi, '') : nn), versions,
    verdict, about: about && about !== verdict ? about : null,
    hls: list('highlights_cn'), techs: list('techniques'), authorNote: text('author_note_cn'),
  };
}

/* ---------------- 现场管理：全站同一时刻只开一个 iframe ---------------- */
const Live = {
  cur: null, // { work, iframe }
  open(work) {
    if (this.cur && this.cur.work === work) return;
    this.close();
    const v = work.versions.find((x) => x.key === work.ver) || work.versions[0];
    if (!v) return;
    const iframe = h('iframe', {
      src: v.src, title: `${work.data.title_cn || work.data.title || ''} · ${v.label} · 现场`,
      allow: 'autoplay; fullscreen; accelerometer; gyroscope', loading: 'eager',
      referrerpolicy: 'no-referrer',
    });
    work.screen.append(iframe);
    work.el.classList.add('is-live');
    this.cur = { work, iframe };
    // 重新观察一次：打开时若画框已不在视野里（例如键盘或脚本触发），立即收回
    liveIO.unobserve(work.screen); liveIO.observe(work.screen);
    // 焦点留在父页面的「关闭现场」上，这样打开后直接按 Esc 就能收起；
    // 不把焦点交给 iframe，也不在 iframe 里拦 Esc（有几件作品自己要用 Esc）。
    work.closeBtn?.focus({ preventScroll: true });
  },
  swap(work) {
    if (!this.cur || this.cur.work !== work) return;
    const v = work.versions.find((x) => x.key === work.ver);
    if (v) this.cur.iframe.src = v.src;
  },
  close() {
    if (!this.cur) return;
    const { work, iframe } = this.cur;
    const hadFocus = work.el.contains(document.activeElement);
    try { iframe.src = 'about:blank'; } catch (_) {}
    iframe.remove();
    work.el.classList.remove('is-live');
    this.cur = null;
    // 「关闭现场」随之隐藏，焦点交回「开启现场」，键盘用户不会掉到页首
    if (hadFocus) work.play?.focus({ preventScroll: true });
  },
};
const liveIO = new IntersectionObserver((entries) => {
  for (const en of entries) {
    if (!en.isIntersecting && Live.cur && Live.cur.work.screen === en.target) Live.close();
  }
}, { threshold: 0 });

/* ---------------- 渲染 ---------------- */
function renderStats(cases) {
  const count = cases.length;
  const clean = cases.filter((c) => c.oneshot_clean === true).length;
  const mins = cases.reduce((s, c) => s + (Number(c.minutes_oneshot) || 0), 0);
  const set = (k, v) => document.querySelectorAll(`[data-stat="${k}"]`).forEach((el) => { el.textContent = ''; el.append(...[].concat(v)); });
  set('count', [String(count), h('small', { text: '件' })]);
  set('clean', [String(clean), h('small', { text: `/ ${count}` })]);
  set('minutes', mins ? [String(Math.round(mins)), h('small', { text: '分钟' })] : '—');
  set('count-cn', cnNum(count));
  const pending = 10 - count; // 十则里还没上墙的
  set('pending-cn', cnNum(pending));
  document.querySelectorAll('[data-pending]').forEach((el) => { el.hidden = pending <= 0; });
}

function renderCatalogue(works) {
  const list = $('#catList');
  const peek = $('#catPeek');
  list.textContent = '';
  for (const w of works) {
    const c = w.data;
    const meta = [c.oneshot_clean === true ? '一次成型' : c.oneshot_clean === false ? '修正后成型' : null,
      has(c.minutes_oneshot) ? `${c.minutes_oneshot} 分钟` : null].filter(Boolean).join(' · ');
    const a = h('a', { href: '#' + w.id },
      h('span', { class: 'cat-nn', text: w.nn }),
      h('span', { class: 'cat-t' }, h('strong', { text: c.title_cn || c.title || '未命名' }), has(c.title) && c.title_cn ? h('em', { text: c.title }) : null),
      h('span', { class: 'cat-a', text: handleOf(c.author) }),
      h('span', { class: 'cat-m', text: meta }),
      h('span', { class: 'cat-go', 'aria-hidden': 'true', text: '→' }));
    a.addEventListener('click', (e) => {
      e.preventDefault();
      document.getElementById(w.id)?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
      history.replaceState(null, '', '#' + w.id);
    });
    const img = c.thumb || c.poster;
    if (img) {
      a.addEventListener('pointerenter', (e) => { if (e.pointerType !== 'mouse') return; peek.src = img; peek.classList.add('is-on'); });
      a.addEventListener('pointerleave', () => peek.classList.remove('is-on'));
      a.addEventListener('pointermove', (e) => {
        if (e.pointerType !== 'mouse') return;
        const x = Math.min(window.innerWidth - 280, e.clientX + 24);
        peek.style.transform = `translate3d(${x}px, ${e.clientY - 80}px, 0)`;
      });
    }
    list.append(h('li', {}, a));
  }
}

function renderWork(c, total) {
  const w = { data: c, nn: c.nn, id: c.id, versions: c.versions, ver: null };
  w.ver = (c.versions.find((v) => v.key === 'final') || c.versions[c.versions.length - 1] || {}).key || null;
  const titleCn = c.title_cn || c.title || '未命名';

  // —— 画框 ——
  // 画框比例默认 16:9（海报统一 1600×900），海报加载后只有比例明显不同才改，避免框高跳动
  const poster = h('img', { class: 'poster', alt: `${titleCn} 海报`, loading: 'lazy', decoding: 'async', width: 1600, height: 900 });
  const screen = h('div', { class: 'screen' });
  const frame = h('div', { class: 'frame' }, h('div', { class: 'mat' }, screen));
  if (c.poster || c.versions.some((v) => v.poster)) {
    poster.addEventListener('load', () => {
      poster.classList.add('is-loaded');
      const ar = poster.naturalWidth / poster.naturalHeight;
      if (ar && Number.isFinite(ar) && Math.abs(ar - 16 / 9) > 0.02) stage.style.setProperty('--ar', Math.min(2.2, Math.max(0.8, ar)).toFixed(4));
      screen.querySelector('.poster-miss')?.remove();
    });
    // 切版本会换 src，load / error 不能只听一次
    poster.addEventListener('error', () => { if (!screen.querySelector('.poster-miss')) screen.append(h('span', { class: 'poster-miss', text: '海报暂缺' })); });
    poster.src = (c.versions.find((v) => v.key === w.ver) || {}).poster || c.poster;
    screen.append(poster);
  } else {
    screen.append(h('span', { class: 'poster-miss', text: '海报暂缺' }));
  }
  const canPlay = c.versions.length > 0;
  const playWhich = h('small', { class: 'play-which' });
  const play = h('button', { class: 'play', type: 'button', 'aria-label': `开启现场：${titleCn}`, disabled: !canPlay },
    h('span', { class: 'play-disc' }, h('span', {}, h('b', { text: '▶' }), canPlay ? '开启现场' : '暂无现场', playWhich)));
  const tag = h('span', { class: 'ver-tag', 'aria-hidden': 'true' });
  screen.append(play, tag);
  // 画框左上角和播放钮都写明当前是哪一版，免得切了按钮却分不清在看谁的
  const showVer = () => {
    const v = c.versions.find((x) => x.key === w.ver);
    if (!v) { tag.hidden = true; return; }
    tag.hidden = false;
    tag.textContent = `${v.no} ${v.label} · Claude`;
    playWhich.textContent = v.label;
    play.setAttribute('aria-label', `开启现场：${titleCn}（${v.label}）`);
    if (v.poster && poster.getAttribute('src') !== v.poster) { poster.classList.remove('is-loaded'); poster.src = v.poster; }
  };
  play.addEventListener('click', () => Live.open(w));

  // —— 版本切换 + 工具 ——
  const openNew = h('a', { class: 't-new', target: '_blank', rel: 'noopener', text: '新窗口打开 ↗' });
  const setOpenNew = () => {
    const v = c.versions.find((x) => x.key === w.ver);
    // data: 地址不能在新窗口直接打开，占位数据时隐藏该链接
    if (v && !/^data:/i.test(v.src)) { openNew.href = v.src; openNew.hidden = false; } else { openNew.removeAttribute('href'); openNew.hidden = true; }
  };
  const verBox = h('div', { class: 'ver', role: 'group', 'aria-label': '版本切换（三版都由 Claude 写成）' });
  const postHref = safeHttp(c.post_url);
  if (postHref) {
    verBox.append(h('a', { class: 'ver-orig', href: postHref, target: '_blank', rel: 'noopener noreferrer' },
      h('span', { class: 'v-name', text: '原作 ↗' }), h('span', { class: 'v-who', text: `${handleOf(c.author) || '原作者'} 发在 X，去原帖看` })));
  }
  for (const d of VERSIONS) {
    const v = c.versions.find((x) => x.key === d.key);
    const b = h('button', { type: 'button', 'data-ver': d.key, disabled: !v, 'aria-pressed': String(!!v && v.key === w.ver) },
      h('span', { class: 'v-name', text: `${d.no} ${d.label}` }),
      h('span', { class: 'v-who', text: v ? d.who : d.key === 'fixed' ? '这件没有单独修正版' : '暂无' }));
    if (v) b.addEventListener('click', () => {
      w.ver = v.key;
      verBox.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.ver === v.key)));
      setOpenNew();
      showVer();
      Live.swap(w);
    });
    verBox.append(b);
  }
  setOpenNew();
  showVer();
  // 不支持元素全屏的浏览器（如 iPhone Safari）不显示「全屏」
  let fsBtn = null;
  if (canFullscreen && canPlay) {
    fsBtn = h('button', { type: 'button', class: 't-fs', text: '全屏' });
    fsBtn.addEventListener('click', () => {
      if (!Live.cur || Live.cur.work !== w) Live.open(w);
      const el = screen;
      try {
        const p = (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el);
        if (p && typeof p.catch === 'function') p.catch(() => {});
      } catch (_) {}
    });
  }
  const closeBtn = h('button', { type: 'button', class: 't-close', text: '关闭现场' });
  closeBtn.addEventListener('click', () => Live.close());
  // 现场开着时才显示的操作提示：键盘说 Esc，触屏（小屏）引导去新窗口看完整画面
  const liveHint = h('p', { class: 'live-hint' },
    h('span', { class: 'lh-key', text: '按 Esc 或「关闭现场」收起；在作品里点过之后，先点一下画框外再按 Esc。' }),
    h('span', { class: 'lh-touch', text: '手机上画框偏小，想看完整画面请点「新窗口打开」。' }));
  const cap = h('figcaption', { class: 'cap' }, c.versions.length ? verBox : h('span', { class: 'tools', text: '暂无可运行版本' }),
    h('div', { class: 'tools' }, closeBtn, fsBtn, openNew), liveHint);
  const stage = h('figure', { class: 'stage' }, frame, cap);

  // —— 展签 ——
  const handle = handleOf(c.author);
  const postUrl = safeHttp(c.post_url);
  const profile = handle ? `https://x.com/${handle.slice(1)}` : null;
  const meta = h('dl', { class: 'lab-meta' });
  const row = (k, ...v) => { if (v.flat().some((x) => x != null && x !== '')) meta.append(h('dt', { text: k }), h('dd', {}, ...v)); };
  row('原帖作者', handle ? h('a', { href: profile, target: '_blank', rel: 'noopener noreferrer', text: handle }) : null,
    has(c.author_name) ? `（${c.author_name}）` : null);
  if (c.authorNote) row('作者说明', ...withHandles(c.authorNote));
  row('原帖', postUrl ? h('a', { href: postUrl, target: '_blank', rel: 'noopener noreferrer', text: '查看原帖 ↗' }) : null,
    has(c.post_date) ? `　${c.post_date}` : null);
  row('作者所用模型', has(c.model_used_by_author) ? String(c.model_used_by_author) : '未注明');
  row('执行模型', EXEC_MODEL);
  if (c.oneshot_clean === true || c.oneshot_clean === false) {
    row('一次成型', c.oneshot_clean ? '是' : '否', h('span', { class: 'pill ' + (c.oneshot_clean ? 'ok' : 'no'), text: c.oneshot_clean ? '原样可跑' : '经过修正' }));
  }
  // 口径：写出首版、需要时再做修正版，含自检截图；不含之后的精修
  if (has(c.minutes_oneshot)) {
    const scope = c.oneshot_clean === true ? '首版，含自检；不含精修' : c.oneshot_clean === false ? '首版＋修正版，含自检；不含精修' : '首版（需要时含修正版）及自检；不含精修';
    row('生成用时', `约 ${c.minutes_oneshot} 分钟`, h('small', { class: 'dd-note', text: scope }));
  }
  const sc = fmtScore(c.review_score_before);
  if (sc) row('修前评分', sc);

  const hls = c.hls || [];
  const techs = c.techs || [];
  const label = h('aside', { class: 'label', 'aria-label': `展签 ${w.nn}` },
    h('p', { class: 'lab-no', text: `No. ${w.nn} / ${pad2(total)}` }),
    h('h3', { class: 'lab-title', id: w.id + '-t', text: titleCn }),
    has(c.title) && c.title_cn ? h('p', { class: 'lab-en', lang: 'en', text: c.title }) : null,
    meta,
    has(c.art_direction_cn) ? h('p', { class: 'lab-dir', text: c.art_direction_cn }) : null,
    c.verdict ? h('blockquote', { class: 'verdict', text: c.verdict }) : null,
    c.about ? h('details', { class: 'about' }, h('summary', { text: '展品说明' }), h('p', { text: c.about })) : null,
    hls.length ? [h('p', { class: 'hl-head', text: '看点' }), h('ol', { class: 'hl' }, hls.map((t) => h('li', { text: t })))] : null,
    techs.length ? [h('p', { class: 'tq-head', text: '技法' }), h('ul', { class: 'tags' }, techs.map((t) => h('li', { text: t })))] : null,
    renderPrompt(c, postUrl),
  );

  const el = h('section', { class: 'work', id: w.id, 'aria-labelledby': w.id + '-t', 'data-nn': w.nn },
    h('p', { class: 'work-num', 'aria-hidden': 'true', text: w.nn }),
    h('div', { class: 'wrap work-grid' }, stage, label));
  Object.assign(w, { el, screen, frame, play, closeBtn });
  liveIO.observe(screen);
  return w;
}

function renderPrompt(c, postUrl) {
  if (!has(c.prompt_text)) return null;
  const text = String(c.prompt_text);
  const vb = fmtVerbatim(c.verbatim);
  const pre = h('pre', { class: 'prompt-text', lang: 'en', tabindex: '0', text });
  const box = h('div', { class: 'prompt' });
  const copy = h('button', { type: 'button', class: 'copy', text: '复制' });
  copy.addEventListener('click', async () => {
    let ok = false;
    try { await navigator.clipboard.writeText(text); ok = true; } catch (_) {
      const ta = h('textarea', { style: 'position:fixed;left:-9999px;top:0', readonly: true });
      ta.value = text; document.body.append(ta); ta.select();
      try { ok = document.execCommand('copy'); } catch (_) { ok = false; }
      ta.remove();
    }
    copy.textContent = ok ? '已复制' : '复制失败';
    copy.classList.toggle('is-done', ok);
    setTimeout(() => { copy.textContent = '复制'; copy.classList.remove('is-done'); }, 1800);
  });
  const expand = h('button', { type: 'button', class: 'expand', 'aria-expanded': 'false', text: `展开全文（${text.length} 字符）` });
  expand.addEventListener('click', () => {
    const open = box.classList.toggle('is-open');
    expand.setAttribute('aria-expanded', String(open));
    expand.textContent = open ? '收起' : `展开全文（${text.length} 字符）`;
  });
  box.append(
    h('div', { class: 'prompt-head' }, h('h4', {}, '原帖提示词', vb ? h('small', { text: vb }) : null), copy),
    pre, expand);
  // 默认收起（只露前四行）；排版后按实际高度判断是否需要「展开全文」，窗口变宽变窄时重算
  measurers.push(() => {
    if (!pre.isConnected || box.classList.contains('is-open')) return;
    box.classList.toggle('is-long', pre.scrollHeight > pre.clientHeight + 2);
  });
  const note = h('p', { class: 'prompt-note' }, '原帖提示词仅作对照引用，版权归原作者',
    postUrl ? ['　·　', h('a', { href: postUrl, target: '_blank', rel: 'noopener noreferrer', text: '原帖链接 ↗' })] : null);
  return [box, note];
}

/* ---------------- 滚动：开场进度、视差、顶栏 ---------------- */
function setupScroll(works, hero, total) {
  const heroEl = $('#hero');
  const heroText = $('#heroText');
  const bar = $('#bar');
  const barRoom = $('#barRoom');
  const barProg = $('#barProgress');
  const visible = new Set();

  const io = new IntersectionObserver((entries) => {
    for (const en of entries) {
      const w = works.find((x) => x.el === en.target);
      if (!w) continue;
      if (en.isIntersecting) { visible.add(w); w.el.classList.add('is-in'); } else visible.delete(w);
    }
    tick();
  }, { rootMargin: '10% 0px 10% 0px', threshold: 0 });
  works.forEach((w) => io.observe(w.el));

  const heroIO = new IntersectionObserver(([en]) => hero?.setVisible(en.isIntersecting), { threshold: 0 });
  heroIO.observe(heroEl);

  let ticking = false;
  function tick() {
    ticking = false;
    const vh = window.innerHeight;
    const y = window.scrollY;
    // 开场
    const heroSpan = Math.max(1, heroEl.offsetHeight - vh);
    const s = Math.min(1, Math.max(0, y / heroSpan));
    if (!reduced) {
      hero?.setScroll(s);
      heroText.style.transform = `translate3d(0, ${(-s * 22).toFixed(2)}vh, 0)`;
      heroText.style.opacity = String(Math.max(0, 1 - s * 1.6).toFixed(3));
    }
    bar.classList.toggle('is-on', y > heroEl.offsetHeight - vh * 0.5);
    const docH = document.documentElement.scrollHeight - vh;
    barProg.style.transform = `scaleX(${docH > 0 ? (y / docH).toFixed(4) : 0})`;
    // 视差（手机只动大号数字，幅度也小）
    let cur = null;
    for (const w of visible) {
      const r = w.el.getBoundingClientRect();
      const p = ((r.top + r.height / 2) - vh / 2) / (vh / 2 + r.height / 2);
      if (!reduced) w.el.style.setProperty('--p', Math.max(-1, Math.min(1, p)).toFixed(4));
      if (r.top < vh * 0.5 && r.bottom > vh * 0.5) cur = w;
    }
    barRoom.textContent = cur ? `展间 ${cur.nn} / ${pad2(total)} · ${cur.data.title_cn || cur.data.title || ''}` : '';
  }
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(tick); } };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });

  // 系统「减少动态效果」中途切换：立即停/启开场动画与视差，不必刷新
  const onReducedChange = (e) => {
    reduced = e.matches;
    hero?.setReduced(reduced);
    if (reduced) {
      heroText.style.transform = '';
      heroText.style.opacity = '';
      works.forEach((w) => w.el.style.removeProperty('--p'));
    }
    onScroll();
  };
  if (reducedMQ.addEventListener) reducedMQ.addEventListener('change', onReducedChange);
  else if (reducedMQ.addListener) reducedMQ.addListener(onReducedChange);
  tick();
}

/* ---------------- 启动 ---------------- */
async function main() {
  const dataP = loadCases(); // 先发请求，再编译着色器，两边并行
  dataP.catch(() => {});
  const labelsP = loadLabels();
  let hero = null;
  try { hero = initHero($('#heroCanvas'), { reduced }); } catch (err) { console.warn('[hero]', err); hero = null; }
  if (!hero) root.classList.add('no-gl');

  const status = $('#worksStatus');
  let data;
  try { data = await dataP; }
  catch (err) {
    status.textContent = '展品数据读取失败，请稍后刷新。';
    console.warn('[x-art] 数据读取失败', err);
    setupScroll([], hero, SERIES_MIN);
    return;
  }
  const labels = data.placeholder ? {} : await labelsP; // 三条占位数据不套编辑层
  const cases = data.cases.map((c, i) => normalize(c, i, labels));
  // 编号按十则原序（No. 09 / 10），分母不跟着「已上墙件数」变
  const total = Math.max(SERIES_MIN, ...cases.map((c) => Number(c.nn) || 0));
  if (data.sample) root.classList.add('is-sample');
  renderStats(cases);
  const box = $('#works');
  box.textContent = '';
  if (data.sample) box.append(h('p', { class: 'sample-note', text: data.placeholder
    ? '当前展示的是占位数据（site/cases.sample.json），正式十件合并进 site/cases.json 后自动替换。'
    : '当前展示的是测试数据（site/sample/ 下），去掉地址里的 ?data= 即回到正式数据。' }));
  const works = cases.map((c) => renderWork(c, total));
  works.forEach((w) => box.append(w.el));
  renderCatalogue(works);
  setupScroll(works, hero, total);
  requestAnimationFrame(remeasure);
  document.fonts?.ready.then(remeasure).catch(() => {});
  let mt = 0;
  window.addEventListener('resize', () => { clearTimeout(mt); mt = setTimeout(remeasure, 200); }, { passive: true });

  // 带锚点进入时，渲染完再跳一次
  if (location.hash && location.hash.length > 1) {
    const t = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (t) t.scrollIntoView({ block: 'start' });
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && Live.cur && !document.fullscreenElement) Live.close(); });
  // 自测钩子：只读，不改状态
  window.__xart = { get liveCount() { return document.querySelectorAll('.screen iframe').length; }, works: works.length, sample: data.sample, total, get reduced() { return reduced; } };
}

main();
