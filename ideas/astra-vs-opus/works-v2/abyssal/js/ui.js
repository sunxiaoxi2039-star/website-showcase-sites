// 界面：标题、深度计、生境切换、工具栏、世界实验室、海图、观察模式、野外图鉴、帮助。
import * as THREE from 'three';
import { SITES, PLACES, EXT, canyonX, DEFAULT_RECIPE } from './world.js';
import { LIGHT_PRESETS, U } from './optics.js';
import { SPECIES, SPECIES_BY_ID } from './species.js';
import { clamp, lerp, smoothstep, mulberry32 } from './noise.js';

const ZONES = {
  surface: { title: '呼吸之海', sub: '随浪漂浮，或潜入下面的世界。', tab: null },
  reef: { title: '珊瑚大教堂', sub: '海浪之下的另一个世界。', tab: 'reef' },
  kelp: { title: '沉没的森林', sub: '整片森林随海水起伏。', tab: 'kelp' },
  blue: { title: '深入蔚蓝', sub: '在巨兽身边，你是如此渺小。', tab: 'blue' },
  twilight: { title: '暮光带', sub: '最后一点蓝光，来自上方的缓慢的雪。', tab: 'blue' },
  lowtwilight: { title: '漫长的暮光', sub: '光几乎耗尽，生命开始自己发光。', tab: 'deep' },
  midnight: { title: '午夜之水', sub: '这里从未有过白天。', tab: 'deep' },
  vents: { title: '午夜花园', sub: '光消失之后，生命仍在。', tab: 'deep' },
  abyss: { title: '玄武岩平原', sub: '深渊平原上，一切都慢了下来。', tab: 'deep' },
};
const TABS = [['reef', '珊瑚礁'], ['kelp', '海藻林'], ['blue', '开阔大洋'], ['deep', '深渊']];
const STOPS = [[0, '水面'], [200, '暮光带'], [600, '下暮光带'], [1000, '午夜带'], [1400, '热液区']];
const LINKS = {
  gulper: 'https://www.mbari.org/animal/whiptail-gulper-eel/',
  flapjack: 'https://www.mbari.org/animal/flapjack-octopus/',
  vampire: 'https://www.mbari.org/animal/vampire-squid/',
  anglerfish: 'https://www.mbari.org/animal/deep-sea-anglerfish/',
  lanternfish: 'https://oceanexplorer.noaa.gov/education/bioluminescence/',
  parrotfish: 'https://oceanservice.noaa.gov/facts/sand.html',
  seal: 'https://oceantoday.noaa.gov/sealanatomy/',
};

const ICON = {
  up: '<svg viewBox="0 0 16 16"><path d="M8 13V3M4 7l4-4 4 4"/></svg>',
  down: '<svg viewBox="0 0 16 16"><path d="M8 3v10M4 9l4 4 4-4"/></svg>',
  chart: '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="5.5"/><path d="M8 2.5v2M8 11.5v2M2.5 8h2M11.5 8h2"/><circle cx="8" cy="8" r="1.2"/></svg>',
  lab: '<svg viewBox="0 0 16 16"><path d="M2 4h12M2 8h12M2 12h12"/><circle cx="5" cy="4" r="1.4"/><circle cx="11" cy="8" r="1.4"/><circle cx="7" cy="12" r="1.4"/></svg>',
  pause: '<svg viewBox="0 0 16 16"><path d="M5.5 3.5v9M10.5 3.5v9"/></svg>',
  play: '<svg viewBox="0 0 16 16"><path d="M5 3.5l7 4.5-7 4.5z"/></svg>',
  lamp: '<svg viewBox="0 0 16 16"><path d="M5 2.5h6l-1 4H6zM6 6.5v7h4v-7M3 4l-1.5-.8M13 4l1.5-.8M8 1V0"/></svg>',
  eye: '<svg viewBox="0 0 16 16"><path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z"/><circle cx="8" cy="8" r="2"/></svg>',
  book: '<svg viewBox="0 0 16 16"><path d="M2 3.5c2-1 4-1 6 .5 2-1.5 4-1.5 6-.5v9c-2-1-4-1-6 .5-2-1.5-4-1.5-6-.5zM8 4v9"/></svg>',
  camera: '<svg viewBox="0 0 16 16"><path d="M2 5h3l1.3-1.8h3.4L11 5h3v7.5H2z"/><circle cx="8" cy="8.6" r="2.3"/></svg>',
  sound: '<svg viewBox="0 0 16 16"><path d="M2.5 6h2.5l3-2.5v9l-3-2.5H2.5zM10.5 5.5c1 1.4 1 3.6 0 5M12.5 4c1.8 2.3 1.8 5.7 0 8"/></svg>',
};

const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const fmtDepth = (d) => (d >= 100 ? d.toFixed(0) : d.toFixed(1));

export class UI {
  constructor(app) {
    this.app = app;
    this.root = document.getElementById('ui');
    this.canvas = document.getElementById('gl');
    this.zone = null;
    this.zoneT = 0;
    this.nearT = 0;
    this.journalT = 0;
    this.obs = { active: false, target: null, follow: false, lastSpecies: null };
    this.journal = this.loadJournal();
    this.build();
    this.bind();
  }

  // ——————————————— 构建 ———————————————
  build() {
    const r = this.root;
    r.innerHTML = '';
    this.brand = el('div', 'brand', 'ABYSSAL<small>活的深海</small>');
    r.append(this.brand);

    // 右上：主操作
    const top = el('div', 'topbtns');
    this.btnUp = this.button(ICON.up, '上浮', () => { if (!this.app.ascend()) this.toast('已经在水面了'); }, '回到水面漂浮');
    this.btnDown = this.button(ICON.down, '下潜', () => { if (!this.app.descend()) this.toast('已经在海底附近'); }, '沿峡谷下潜到深渊（或在深水区直接下沉）');
    this.btnChart = this.button(ICON.chart, '探索', () => this.toggleChart(), '海图与目的地（C）');
    this.btnLab = this.button(ICON.lab, '世界实验室', () => this.toggleLab(), '种子、地形、生命、水体与天气（G）');
    this.btnHelp = this.button('?', '', () => this.toggleHelp(), '操作说明');
    this.btnHelp.classList.add('sq');
    top.append(this.btnUp, this.btnDown, this.btnChart, this.btnLab, this.btnHelp);
    r.append(top);

    // 右侧：深度计
    const g = el('div', 'gauge');
    this.depthNum = el('div', 'dnum', '0<span>m</span>');
    this.depthLbl = el('div', 'dlbl', '水面以下');
    const scale = el('div', 'dscale');
    this.stopEls = STOPS.map(([d, name], i) => {
      const s = el('button', 'stop', `<b>${d === 1400 ? '≈1,400' : d.toLocaleString('en-US')}</b><span>${name}</span>`);
      s.style.top = `${(i / (STOPS.length - 1)) * 100}%`;
      s.title = d === 0 ? '上浮到水面' : `前往 ${d} 米`;
      s.addEventListener('click', () => {
        if (d === 0) this.app.ascend();
        else if (d === 1400) this.app.descend();
        else if (!this.app.descend(d)) this.toast('已经在这个深度以下');
      });
      scale.append(s);
      return s;
    });
    this.depthMark = el('i', 'dmark');
    scale.append(this.depthMark);
    g.append(this.depthNum, this.depthLbl, scale);
    r.append(g);

    // 左下：标题区
    const tb = el('div', 'titleblock');
    this.titleEl = el('h1', 'title', '呼吸之海');
    this.subEl = el('p', 'sub', '');
    this.nearEl = el('p', 'near', '');
    this.diveBtn = el('button', 'cta', '潜入珊瑚礁');
    this.diveBtn.addEventListener('click', () => { this.app.dive(); this.diveBtn.blur(); });
    tb.append(this.titleEl, this.subEl, this.nearEl, this.diveBtn);
    this.titleBlock = tb;
    r.append(tb);

    // 观察卡片（替换标题）
    this.obsCard = el('div', 'obscard hidden');
    r.append(this.obsCard);
    this.marker = el('div', 'marker hidden', '<i></i><i></i><i></i><i></i><span></span>');
    r.append(this.marker);

    // 生境标签
    const tabs = el('div', 'tabs');
    this.tabEls = {};
    for (const [id, name] of TABS) {
      const b = el('button', 'tab', `${name}<kbd>${SITES[id].key}</kbd>`);
      b.addEventListener('click', () => { this.app.travelSite(id); b.blur(); });
      this.tabEls[id] = b;
      tabs.append(b);
    }
    this.tabBar = el('i', 'tabbar');
    tabs.append(this.tabBar);
    r.append(tabs);

    // 右下：工具栏
    const tools = el('div', 'tools');
    this.btnDrift = this.button('', '漂流', () => this.app.setMode('drift'), '原地漂流，镜头不惊扰动物');
    this.btnSwim = this.button('', '游动', () => this.app.setMode('swim'), 'WASD 游动，拖动环顾（F）');
    this.btnPause = this.button(ICON.pause, '', () => this.app.togglePause(), '暂停模拟（P）');
    this.btnLamp = this.button(ICON.lamp, '', () => { const m = this.app.cycleLamp(); this.toast(m === 'auto' ? '潜水灯：随深度自动' : m === 'on' ? '潜水灯：开' : '潜水灯：关'); }, '潜水灯（L）');
    this.btnObs = this.button(ICON.eye, '', () => this.toggleObserve(), '观察视野里的动物（O）');
    this.btnJournal = this.button(ICON.book, '', () => this.toggleJournal(), '野外图鉴（J）');
    this.btnShot = this.button(ICON.camera, '', () => { this.app.screenshot(); this.toast('已保存不含界面的截图'); }, '保存截图（不含界面）');
    for (const b of [this.btnPause, this.btnLamp, this.btnObs, this.btnJournal, this.btnShot]) b.classList.add('sq');
    tools.append(this.btnDrift, this.btnSwim, this.btnPause, this.btnLamp, this.btnObs, this.btnJournal, this.btnShot);
    const hint = el('div', 'hint', '选择 <b>游动</b> 开始探索 · <b>G</b> 世界实验室 · <b>H</b> 隐藏界面');
    const tw = el('div', 'toolwrap');
    tw.append(tools, hint);
    r.append(tw);

    // 旅程提示
    this.journeyEl = el('div', 'journey hidden', '<span class="jl"></span><i class="jbar"><b></b></i><button>停在这里</button>');
    this.journeyEl.querySelector('button').addEventListener('click', () => this.app.stopJourney());
    r.append(this.journeyEl);

    // 触屏游动按钮
    this.touch = el('div', 'touch hidden');
    const tbtn = (label, key, val) => {
      const b = el('button', '', label);
      const on = (e) => { e.preventDefault(); this.app.explorer.touchMove[key] = val; };
      const off = () => { this.app.explorer.touchMove[key] = 0; };
      b.addEventListener('pointerdown', on);
      b.addEventListener('pointerup', off);
      b.addEventListener('pointerleave', off);
      b.addEventListener('pointercancel', off);
      return b;
    };
    this.touch.append(tbtn('前进', 'f', 1), tbtn('后退', 'f', -1), tbtn('上升', 'u', 1), tbtn('下沉', 'u', -1));
    r.append(this.touch);

    this.toasts = el('div', 'toasts');
    r.append(this.toasts);

    this.buildLab();
    this.buildChart();
    this.buildJournal();
    this.buildHelp();
  }

  button(icon, label, fn, title) {
    const b = el('button', 'btn', `${icon}${label ? `<span>${label}</span>` : ''}`);
    if (title) b.title = title;
    b.addEventListener('click', (e) => { fn(e); b.blur(); });
    return b;
  }

  toast(msg, ms = 2200) {
    const t = el('div', 'toast', msg);
    this.toasts.append(t);
    requestAnimationFrame(() => t.classList.add('in'));
    setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 400); }, ms);
    while (this.toasts.children.length > 3) this.toasts.firstChild.remove();
  }

  // ——————————————— 世界实验室 ———————————————
  buildLab() {
    const app = this.app;
    const lab = el('aside', 'panel lab hidden');
    lab.setAttribute('role', 'dialog');
    lab.setAttribute('aria-label', '世界实验室');
    lab.innerHTML = '<header><h2>世界实验室</h2><button class="x" aria-label="关闭">×</button></header>';
    lab.querySelector('.x').addEventListener('click', () => this.toggleLab(false));
    const tabs = el('div', 'ltabs');
    tabs.setAttribute('role', 'tablist');
    const body = el('div', 'lbody');
    const pages = {};
    this.labTabs = {};
    const tabNames = [['world', '世界'], ['life', '生命'], ['water', '水体'], ['weather', '天气']];
    for (const [id, name] of tabNames) {
      const b = el('button', 'ltab', name);
      b.setAttribute('role', 'tab');
      b.addEventListener('click', () => this.labTab(id));
      b.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          const i = tabNames.findIndex((t) => t[0] === id);
          const n = tabNames[(i + (e.key === 'ArrowRight' ? 1 : 3)) % 4][0];
          this.labTab(n); this.labTabs[n].focus(); e.preventDefault();
        }
      });
      tabs.append(b);
      this.labTabs[id] = b;
      pages[id] = el('div', 'lpage');
      body.append(pages[id]);
    }
    this.labPages = pages;
    const R = app.recipe, E = app.env;

    // 世界
    const w = pages.world;
    const seedRow = el('div', 'row seedrow', '<label>种子</label>');
    this.seedInput = el('input');
    this.seedInput.type = 'text';
    this.seedInput.value = R.seed;
    this.seedInput.setAttribute('aria-label', '世界种子（数字或文字）');
    const seedGo = el('button', 'mini', '生长');
    seedGo.addEventListener('click', () => this.applySeed(this.seedInput.value));
    this.seedInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.applySeed(this.seedInput.value); e.stopPropagation(); });
    const newSeed = el('button', 'mini', '新种子');
    newSeed.addEventListener('click', () => this.newSeed());
    seedRow.append(this.seedInput, seedGo, newSeed);
    w.append(seedRow);
    w.append(this.slider('地形起伏', 0.3, 2, 0.05, () => R.relief, (v) => this.regen({ relief: v }), { live: false }));
    w.append(this.slider('生物覆盖', 0, 2, 0.05, () => R.cover, (v) => app.setCover({ cover: v }), { live: false }));
    w.append(this.slider('海藻高度', 0.4, 1.6, 0.05, () => R.kelpHeight, (v) => app.setCover({ kelpHeight: v }), { live: false }));
    w.append(this.slider('生境尺度', 0.6, 1.8, 0.05, () => R.habitatScale, (v) => this.regen({ habitatScale: v }), { live: false }));
    w.append(el('p', 'note', '地形类旋钮在松开时重新生长；同一片海底，回到同一个地方看到的群落不变。'));
    const acts = el('div', 'acts');
    const reset = el('button', 'mini', '重置配方');
    reset.addEventListener('click', () => this.resetRecipe());
    const copy = el('button', 'mini', '复制世界链接');
    copy.addEventListener('click', () => this.copyLink());
    acts.append(reset, copy);
    w.append(acts);

    // 生命
    const l = pages.life;
    l.append(this.slider('动物丰度', 0, 2, 0.05, () => R.life, (v) => app.setLife({ life: v }), { live: false }));
    l.append(this.slider('掠食者', 0, 2, 0.05, () => R.predators, (v) => app.setLife({ predators: v }), { live: false }));
    l.append(this.slider('底栖生物', 0, 2, 0.05, () => R.benthos, (v) => app.setLife({ benthos: v }), { live: false }));
    l.append(this.slider('水母与漂流者', 0, 2, 0.05, () => R.jellies, (v) => app.setLife({ jellies: v }), { live: false }));
    l.append(this.slider('鱼群规模', 0.3, 2, 0.05, () => R.shoal, (v) => app.setLife({ shoal: v }), { live: false }));
    this.popEl = el('p', 'note', '');
    l.append(this.popEl);
    l.append(el('p', 'note', '数字是当前在镜头周围加载的动物，而不是整片海洋的总数。'));

    // 水体
    const wa = pages.water;
    wa.append(this.slider('水体清澈度', 0.4, 2, 0.05, () => E.water.clarity, (v) => { E.water.clarity = v; }));
    wa.append(this.slider('洋流强度', 0, 3, 0.05, () => E.water.current, (v) => { E.water.current = v; }));
    wa.append(this.slider('生物发光', 0, 3, 0.05, () => E.water.glow, (v) => { E.water.glow = v; }));
    wa.append(this.slider('深层上升流', 0, 3, 0.05, () => E.water.upwelling, (v) => { E.water.upwelling = v; }));
    const lampRow = el('div', 'row', '<label>潜水灯</label>');
    const seg = el('div', 'seg');
    this.lampSeg = {};
    for (const [id, name] of [['auto', '自动'], ['on', '开'], ['off', '关']]) {
      const b = el('button', '', name);
      b.addEventListener('click', () => { E.water.lamp = id; });
      this.lampSeg[id] = b;
      seg.append(b);
    }
    lampRow.append(seg);
    wa.append(lampRow);
    const sndRow = el('div', 'row', '<label>海洋声音</label>');
    this.sndBtn = el('button', 'toggle', '关');
    this.sndBtn.addEventListener('click', () => this.toggleSound());
    sndRow.append(this.sndBtn);
    wa.append(sndRow);
    wa.append(this.slider('音量', 0, 1, 0.01, () => app.sound.volume, (v) => app.sound.setVolume(v)));
    wa.append(el('p', 'note', '声音全部实时合成：浪涌、水下低鸣、礁区的噼啪声、远处的鲸歌。M 键开关。'));

    // 天气
    const we = pages.weather;
    const pr = el('div', 'seg presets');
    this.presetBtns = {};
    for (const [id, name] of [['day', '白天'], ['dusk', '黄昏'], ['storm', '风暴'], ['night', '夜晚']]) {
      const b = el('button', '', name);
      b.addEventListener('click', () => { E.setPreset(id); app.weatherChanged(); this.refreshSliders(); });
      this.presetBtns[id] = b;
      pr.append(b);
    }
    we.append(pr);
    const W = E.weather;
    const wx = (k) => (v) => { W[k] = v; E.lightName = 'custom'; if (['wind', 'swell', 'chop', 'windDir', 'swellDir', 'period', 'storm'].includes(k)) app.weatherChanged(); };
    we.append(this.slider('太阳高度', -30, 85, 1, () => W.sun, wx('sun'), { fmt: (v) => `${v.toFixed(0)}°` }));
    we.append(this.slider('云量', 0, 1, 0.01, () => W.cloud, wx('cloud')));
    we.append(this.slider('风速', 0, 30, 0.5, () => W.wind, wx('wind'), { fmt: (v) => `${v.toFixed(1)} m/s` }));
    we.append(this.slider('涌浪', 0, 1.5, 0.01, () => W.swell, wx('swell')));
    we.append(this.slider('风暴强度', 0, 1, 0.01, () => W.storm, wx('storm')));
    const more = el('details', 'more');
    more.innerHTML = '<summary>更多天气旋钮</summary>';
    more.append(this.slider('风向', 0, 360, 1, () => W.windDir, wx('windDir'), { fmt: (v) => `${v.toFixed(0)}°` }));
    more.append(this.slider('涌浪周期', 0.3, 2, 0.01, () => W.period, wx('period')));
    more.append(this.slider('浪尖陡度', 0, 1.6, 0.01, () => W.chop, wx('chop')));
    more.append(this.slider('降雨', 0, 1, 0.01, () => W.rain, wx('rain')));
    more.append(this.slider('雾霾', 0, 1, 0.01, () => W.haze, wx('haze')));
    more.append(this.slider('云密度', 0, 1, 0.01, () => W.cloudDensity, wx('cloudDensity')));
    we.append(more);
    const ev = el('div', 'events', '<h3>海洋事件</h3>');
    const evb = (name, id, tip) => { const b = el('button', 'mini', name); b.title = tip; b.addEventListener('click', () => { app.event(id); this.toast(tip); }); return b; };
    ev.append(evb('海底震颤', 'tremor', '深处的热液区发生震颤：沉积物被搅起，一圈长波传向海面'), evb('畸形浪', 'rogue', '一道畸形浪正从你身后逼近'), evb('闪电', 'lightning', '一道闪电劈向远处的海面'));
    we.append(ev);

    // 视图与控制
    const view = el('details', 'view');
    view.innerHTML = '<summary>视图与控制</summary>';
    const wlRow = el('div', 'row', '<label>在水线漂浮</label>');
    this.wlBtn = el('button', 'toggle', '关');
    this.wlBtn.addEventListener('click', () => {
      const ex = app.explorer;
      ex.waterline = !ex.waterline;
      if (ex.waterline) { ex.journey = null; ex.floating = true; ex.pos.y = 0; ex.mode = 'drift'; ex.pitch = 0; }
      else if (ex.pos.y > -2) ex.pos.y = 1.6;
    });
    wlRow.append(this.wlBtn);
    view.append(wlRow);
    const qRow = el('div', 'row', '<label>渲染画质</label>');
    const qseg = el('div', 'seg');
    this.qBtns = {};
    for (const [id, name] of [['low', '低'], ['medium', '中'], ['high', '高']]) {
      const b = el('button', '', name);
      b.addEventListener('click', () => { app.setQuality(id); });
      this.qBtns[id] = b;
      qseg.append(b);
    }
    qRow.append(qseg);
    view.append(qRow);
    this.perfEl = el('p', 'note mono', '');
    view.append(this.perfEl);
    const hb = el('button', 'mini', '操作说明');
    hb.addEventListener('click', () => this.toggleHelp(true));
    view.append(hb);

    lab.append(tabs, body, view);
    this.lab = lab;
    this.root.append(lab);
    this.labTab('weather');
  }

  slider(label, min, max, step, get, set, opts = {}) {
    const row = el('div', 'row slider');
    const id = 's' + Math.random().toString(36).slice(2, 8);
    const lab = el('label', '', label);
    lab.htmlFor = id;
    const inp = el('input');
    inp.type = 'range'; inp.min = min; inp.max = max; inp.step = step; inp.id = id;
    inp.value = get();
    const out = el('output', '', '');
    const fmt = opts.fmt || ((v) => (Math.abs(v) >= 10 ? v.toFixed(0) : v.toFixed(2)));
    const show = () => { out.textContent = fmt(parseFloat(inp.value)); };
    show();
    inp.addEventListener('input', () => { show(); if (opts.live !== false) set(parseFloat(inp.value)); });
    inp.addEventListener('change', () => { if (opts.live === false) set(parseFloat(inp.value)); });
    inp.addEventListener('keydown', (e) => e.stopPropagation());
    row.append(lab, inp, out);
    (this.sliders = this.sliders || []).push({ inp, get, show });
    return row;
  }
  refreshSliders() {
    for (const s of this.sliders) { s.inp.value = s.get(); s.show(); }
    this.seedInput.value = this.app.recipe.seed;
  }
  labTab(id) {
    this.labCur = id;
    for (const k in this.labPages) {
      this.labPages[k].classList.toggle('on', k === id);
      this.labTabs[k].classList.toggle('on', k === id);
      this.labTabs[k].setAttribute('aria-selected', k === id ? 'true' : 'false');
    }
  }
  toggleLab(v) {
    const open = v !== undefined ? v : this.lab.classList.contains('hidden');
    if (open) { this.closeAll('lab'); this.refreshSliders(); if (!this.labOpened) { this.labTab(this.app.explorer.pos.y > -1 ? 'weather' : 'world'); this.labOpened = true; } }
    this.lab.classList.toggle('hidden', !open);
    this.btnLab.classList.toggle('on', open);
  }
  openLab(tab) { this.toggleLab(true); if (['world', 'life', 'water', 'weather'].includes(tab)) this.labTab(tab); }
  regen(patch) {
    this.toast('正在重新生长海底……');
    setTimeout(() => { this.app.regenerate(patch); this.chartVersion = -1; }, 30);
  }
  applySeed(v) {
    const s = String(v).trim();
    if (!s) return;
    let seed = /^\d+$/.test(s) ? (parseInt(s, 10) >>> 0) : (() => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0) % 1000000; })();
    this.regen({ seed });
    this.seedInput.value = seed;
    this.toast(`种子 ${seed}`);
  }
  newSeed() {
    const seed = Math.floor(Math.random() * 99999) + 1;
    this.seedInput.value = seed;
    this.regen({ seed });
    this.toast(`新种子 ${seed}：另一片海洋`);
  }
  resetRecipe() {
    const app = this.app;
    const keep = { ...DEFAULT_RECIPE };
    app.env.setPreset('day');
    Object.assign(app.env.water, { clarity: 1, current: 1, glow: 1, upwelling: 1, lamp: 'auto' });
    app.weatherChanged();
    app.setLife({ life: 1, predators: 1, benthos: 1, jellies: 1, shoal: 1 });
    this.regen(keep);
    setTimeout(() => this.refreshSliders(), 80);
  }
  copyLink() {
    const app = this.app;
    const R = app.recipe, E = app.env;
    const p = new URLSearchParams();
    p.set('seed', R.seed);
    const pos = app.explorer.pos;
    if (app.lastPlace) p.set('place', app.lastPlace);
    else {
      let best = 'reef', bd = 1e9;
      for (const s of Object.values(SITES)) { const d = Math.hypot(s.x - pos.x, s.z - pos.z); if (d < bd) { bd = d; best = s.id; } }
      p.set('site', best);
    }
    if (pos.y > -1) p.set('surface', app.explorer.waterline ? 'waterline' : '1');
    const map = { relief: 'relief', cover: 'cover', kelpHeight: 'height', habitatScale: 'habitatScale', life: 'life', predators: 'predators', benthos: 'benthos', jellies: 'jellies', shoal: 'shoal' };
    for (const k in map) if (Math.abs(R[k] - DEFAULT_RECIPE[k]) > 1e-3) p.set(map[k], +R[k].toFixed(2));
    if (E.lightName !== 'custom') p.set('light', E.lightName);
    else for (const k of ['sun', 'cloud', 'wind', 'swell', 'storm', 'rain', 'haze']) p.set(k, +(+E.weather[k]).toFixed(2));
    for (const [k, def] of [['clarity', 1], ['current', 1], ['glow', 1], ['upwelling', 1]]) if (Math.abs(E.water[k] - def) > 1e-3) p.set(k, +E.water[k].toFixed(2));
    if (E.water.lamp !== 'auto') p.set('lamp', E.water.lamp);
    if (app.qualityExplicit) p.set('preset', app.quality);
    const url = `${location.origin}${location.pathname}?${p.toString()}`;
    const done = () => this.toast('世界链接已复制');
    try {
      navigator.clipboard.writeText(url).then(done, () => { window.prompt('复制这个链接：', url); });
    } catch (e) { window.prompt('复制这个链接：', url); }
  }
  toggleSound() {
    const s = this.app.sound;
    s.setOn(!s.on).then(() => {});
    setTimeout(() => this.toast(s.on ? '海洋声音已开启' : '海洋声音已关闭'), 50);
  }

  // ——————————————— 海图 ———————————————
  buildChart() {
    const c = el('div', 'modal chart hidden');
    c.setAttribute('role', 'dialog');
    c.setAttribute('aria-label', '海图');
    c.innerHTML = `<div class="mcard">
      <header><h2>海图</h2><p>同一片海洋里的生境与目的地。点选标记，或在海图上任意一点，然后出发。</p><button class="x" aria-label="关闭">×</button></header>
      <div class="cbody"><div class="cmap"><canvas></canvas><div class="clegend"><span class="lg reef">珊瑚礁</span><span class="lg kelp">海藻林</span><span class="lg grass">海草</span><span class="lg vent">热液带</span><span class="lg you">你的位置</span></div></div>
      <div class="clist"></div></div>
      <footer><div class="csel">选择一个目的地</div><button class="cta go" disabled>前往</button></footer></div>`;
    c.querySelector('.x').addEventListener('click', () => this.toggleChart(false));
    c.addEventListener('click', (e) => { if (e.target === c) this.toggleChart(false); });
    this.chart = c;
    this.chartCanvas = c.querySelector('canvas');
    this.chartSel = c.querySelector('.csel');
    this.chartGo = c.querySelector('.go');
    const list = c.querySelector('.clist');
    const groups = [
      ['四个生境', Object.values(SITES).map((s) => ({ kind: 'site', id: s.id, name: s.title, note: s.name, x: s.x, z: s.z }))],
      ['更远的地方', PLACES.map((p) => ({ kind: 'place', id: p.id, name: p.name, note: p.note, x: p.x, z: p.z }))],
    ];
    this.chartItems = [];
    for (const [gname, items] of groups) {
      list.append(el('h3', '', gname));
      for (const it of items) {
        const b = el('button', 'citem', `<b>${it.name}</b><span>${it.note}</span>`);
        b.addEventListener('click', () => this.chartSelect(it));
        it.btn = b;
        list.append(b);
        this.chartItems.push(it);
      }
    }
    this.chartGo.addEventListener('click', () => {
      const s = this.chartTarget;
      if (!s) return;
      if (s.kind === 'site') this.app.travelSite(s.id);
      else if (s.kind === 'place') this.app.travelPlace(s.id);
      else {
        const f = this.app.world.floorAt(s.x, s.z);
        this.app.explorer.travelTo({ x: s.x, y: Math.min(-4, f + 6), z: s.z, yaw: this.app.explorer.yaw, pitch: -0.1 }, '海图上的一点');
        this.app.opening = false;
      }
      this.toggleChart(false);
    });
    this.chartCanvas.addEventListener('click', (e) => {
      const r = this.chartCanvas.getBoundingClientRect();
      const u = (e.clientX - r.left) / r.width, v = (e.clientY - r.top) / r.height;
      const x = (u * 2 - 1) * EXT, z = (v * 2 - 1) * EXT;
      let best = null, bd = 1e9;
      for (const it of this.chartItems) {
        const d = Math.hypot(it.x - x, it.z - z);
        if (d < bd) { bd = d; best = it; }
      }
      const pxd = bd / (2 * EXT) * r.width;
      if (best && pxd < 14) this.chartSelect(best);
      else if (Math.hypot(x, z) < 2200) {
        const f = this.app.world.floorAt(x, z);
        this.chartSelect({ kind: 'point', name: '海图上的一点', note: `水深约 ${Math.round(-f)} 米`, x, z });
      }
    });
    this.root.append(c);
  }
  chartSelect(it) {
    this.chartTarget = it;
    for (const i of this.chartItems) i.btn.classList.toggle('on', i === it);
    const f = this.app.world.floorAt(it.x, it.z);
    const d = Math.hypot(it.x - this.app.explorer.pos.x, it.z - this.app.explorer.pos.z);
    this.chartSel.innerHTML = `<b>${it.name}</b> · 水深约 ${Math.round(-f).toLocaleString('en-US')} 米 · 距离 ${(d / 1000).toFixed(2)} 公里`;
    this.chartGo.disabled = false;
  }
  renderChartBase() {
    const w = this.app.world;
    const S = 440;
    const cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(S, S);
    const d = img.data;
    const deep = [8, 18, 34], mid = [16, 52, 82], shelf = [58, 124, 138], shallow = [110, 176, 170];
    for (let j = 0; j < S; j++) {
      for (let i = 0; i < S; i++) {
        const x = ((i + 0.5) / S * 2 - 1) * EXT, z = ((j + 0.5) / S * 2 - 1) * EXT;
        const f = w.floorAt(x, z);
        const h = w.habitat(x, z);
        const n = w.normalAt(x, z, 6);
        const shade = clamp(0.62 + 0.55 * (-n[0] * 0.6 - n[2] * 0.5 + n[1] * 0.4 - 0.4), 0.35, 1.25);
        const t = clamp(-f / 1450, 0, 1);
        let c;
        if (-f < 60) c = shallow.map((v, k) => lerp(v, shelf[k], clamp((-f - 10) / 50, 0, 1)));
        else if (t < 0.4) c = shelf.map((v, k) => lerp(v, mid[k], (t - 0.04) / 0.36));
        else c = mid.map((v, k) => lerp(v, deep[k], clamp((t - 0.4) / 0.6, 0, 1)));
        c = c.map((v, k) => lerp(v, [226, 128, 138][k], h.reef * 0.75));
        c = c.map((v, k) => lerp(v, [124, 142, 62][k], h.kelp * 0.8));
        c = c.map((v, k) => lerp(v, [96, 160, 104][k], h.grass * 0.35));
        c = c.map((v, k) => lerp(v, [240, 150, 60][k], smoothstep(0.25, 0.8, h.vent) * 0.85));
        // 等深线
        const f2 = w.floorAt(x + EXT * 2 / S, z);
        const line = [50, 200, 600, 1000].some((L) => (-f - L) * (-f2 - L) < 0);
        const k = (j * S + i) * 4;
        const outside = Math.hypot(x, z) > 2200 ? 0.45 : 1;
        d[k] = c[0] * shade * outside + (line ? 40 : 0);
        d[k + 1] = c[1] * shade * outside + (line ? 40 : 0);
        d[k + 2] = c[2] * shade * outside + (line ? 40 : 0);
        d[k + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    this.chartBase = cv;
    this.chartVersion = this.app.worldVersion;
  }
  drawChart() {
    const cv = this.chartCanvas;
    const size = Math.round(cv.clientWidth * Math.min(2, window.devicePixelRatio || 1)) || 440;
    if (cv.width !== size) { cv.width = size; cv.height = size; }
    if (this.chartVersion !== this.app.worldVersion) this.renderChartBase();
    const ctx = cv.getContext('2d');
    ctx.drawImage(this.chartBase, 0, 0, size, size);
    const toPx = (x, z) => [((x / EXT) * 0.5 + 0.5) * size, ((z / EXT) * 0.5 + 0.5) * size];
    const k = size / 440;
    // 可航行边界
    ctx.strokeStyle = 'rgba(239,233,220,0.35)';
    ctx.setLineDash([4 * k, 4 * k]);
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, (2200 / EXT) * 0.5 * size, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    // 峡谷
    ctx.strokeStyle = 'rgba(160,200,230,0.35)';
    ctx.lineWidth = 1.5 * k;
    ctx.beginPath();
    for (let z = -620; z <= SITES.deep.z; z += 40) { const [px, py] = toPx(canyonX(z), z); if (z === -620) ctx.moveTo(px, py); else ctx.lineTo(px, py); }
    ctx.stroke();
    // 旅程路线
    const j = this.app.explorer.journey;
    if (j) {
      ctx.strokeStyle = 'rgba(217,228,191,0.9)';
      ctx.lineWidth = 2 * k;
      ctx.beginPath();
      j.pts.forEach((p, i) => { const [px, py] = toPx(p.x, p.z); if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); });
      ctx.stroke();
    }
    ctx.font = `${11 * k}px ${getComputedStyle(document.body).fontFamily}`;
    ctx.textBaseline = 'middle';
    for (const it of this.chartItems) {
      const [px, py] = toPx(it.x, it.z);
      const sel = this.chartTarget === it;
      ctx.fillStyle = it.kind === 'site' ? '#efe9dc' : 'rgba(239,233,220,0.75)';
      ctx.strokeStyle = 'rgba(4,10,14,0.8)';
      ctx.lineWidth = 2 * k;
      ctx.beginPath();
      ctx.arc(px, py, (it.kind === 'site' ? 5 : 3.2) * k * (sel ? 1.5 : 1), 0, Math.PI * 2);
      ctx.stroke(); ctx.fill();
      if (it.kind === 'site' || sel) {
        ctx.fillStyle = sel ? '#d9e4bf' : '#efe9dc';
        ctx.strokeText(it.name, px + 8 * k, py);
        ctx.fillText(it.name, px + 8 * k, py);
      }
    }
    if (this.chartTarget && this.chartTarget.kind === 'point') {
      const [px, py] = toPx(this.chartTarget.x, this.chartTarget.z);
      ctx.strokeStyle = '#d9e4bf'; ctx.lineWidth = 2 * k;
      ctx.beginPath(); ctx.moveTo(px - 6 * k, py); ctx.lineTo(px + 6 * k, py); ctx.moveTo(px, py - 6 * k); ctx.lineTo(px, py + 6 * k); ctx.stroke();
    }
    // 你的位置与朝向
    const ex = this.app.explorer;
    const [cx, cy] = toPx(ex.pos.x, ex.pos.z);
    const a = ex.yaw;
    const fx = -Math.sin(a), fz = -Math.cos(a);
    ctx.fillStyle = '#7fe3d4';
    ctx.beginPath();
    ctx.moveTo(cx + fx * 10 * k, cy + fz * 10 * k);
    ctx.lineTo(cx - fz * 5 * k - fx * 5 * k, cy + fx * 5 * k - fz * 5 * k);
    ctx.lineTo(cx + fz * 5 * k - fx * 5 * k, cy - fx * 5 * k - fz * 5 * k);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(127,227,212,0.4)';
    ctx.beginPath(); ctx.arc(cx, cy, 14 * k, 0, Math.PI * 2); ctx.stroke();
  }
  toggleChart(v) {
    const open = v !== undefined ? v : this.chart.classList.contains('hidden');
    if (open) { this.closeAll('chart'); this.chart.classList.remove('hidden'); requestAnimationFrame(() => this.drawChart()); }
    else this.chart.classList.add('hidden');
    this.btnChart.classList.toggle('on', open);
  }
  openChart() { this.toggleChart(true); }

  // ——————————————— 野外图鉴 ———————————————
  loadJournal() {
    try { return JSON.parse(localStorage.getItem('abyssal-journal-v1') || '{}') || {}; } catch (e) { return {}; }
  }
  saveJournal() {
    try { localStorage.setItem('abyssal-journal-v1', JSON.stringify(this.journal)); } catch (e) { /* 隐私模式等情况下忽略 */ }
  }
  buildJournal() {
    const j = el('div', 'modal journalm hidden');
    j.setAttribute('role', 'dialog');
    j.setAttribute('aria-label', '野外图鉴');
    j.innerHTML = `<div class="mcard"><header><h2>野外图鉴</h2><p class="jprog"></p><button class="x" aria-label="关闭">×</button></header><div class="jgrid"></div>
      <footer><p class="note">动物需要在画面里停留片刻、距离足够近、没有被岩石或地形挡住，并且被光照亮（阳光、潜水灯，或它自己的生物光）才会被记录。记录保存在这个浏览器里。</p></footer></div>`;
    j.querySelector('.x').addEventListener('click', () => this.toggleJournal(false));
    j.addEventListener('click', (e) => { if (e.target === j) this.toggleJournal(false); });
    this.journalEl = j;
    this.root.append(j);
  }
  renderJournal() {
    const grid = this.journalEl.querySelector('.jgrid');
    grid.innerHTML = '';
    let n = 0;
    const where = (sp) => {
      const f = sp.fit;
      if (['butterflyfish', 'parrotfish', 'damselfish', 'reefshark', 'manta', 'octopus', 'crab', 'seastar', 'urchin'].includes(sp.id)) return '珊瑚礁';
      if (['seal', 'turtle', 'sardine'].includes(sp.id)) return '海藻林与浅海';
      if (['whale', 'dolphin', 'tuna', 'sunfish', 'squid'].includes(sp.id)) return '开阔大洋';
      if (['lanternfish', 'hatchetfish', 'mwshrimp'].includes(sp.id)) return '200 米以下的峡谷';
      if (['vampire', 'dragonfish'].includes(sp.id)) return '600 米以下';
      if (['anglerfish', 'gulper'].includes(sp.id)) return '1,000 米以下';
      if (['seapen', 'brittlestar'].includes(sp.id)) return '陆坡与深海海底';
      if (['jelly', 'siphonophore'].includes(sp.id)) return '水层中漂流';
      return '深渊海底';
    };
    for (const sp of SPECIES) {
      const rec = this.journal[sp.id];
      if (rec) n++;
      const card = el('article', 'jcard' + (rec ? ' seen' : ''));
      const link = rec && LINKS[sp.id] ? `<a href="${LINKS[sp.id]}" target="_blank" rel="noopener">延伸阅读 ↗</a>` : '';
      card.innerHTML = `<h4>${sp.zh}<small>${sp.en}</small></h4>
        <p class="jmeta">${rec ? `首次记录：${Math.round(rec.depth)} 米 · 种子 ${rec.seed}` : `尚未记录 · 线索：${where(sp)}`}</p>
        <p class="jdesc">${rec ? sp.desc : '……'}</p>${link}`;
      grid.append(card);
    }
    this.journalEl.querySelector('.jprog').textContent = `已记录 ${n} / ${SPECIES.length} 种动物群体。描述的是生成的动物类群，而非精确的生物物种。`;
  }
  toggleJournal(v) {
    const open = v !== undefined ? v : this.journalEl.classList.contains('hidden');
    if (open) { this.closeAll('journal'); this.renderJournal(); }
    this.journalEl.classList.toggle('hidden', !open);
    this.btnJournal.classList.toggle('on', open);
  }
  openJournal() { this.toggleJournal(true); }
  record(sp, depth) {
    if (this.journal[sp.id]) return;
    this.journal[sp.id] = { t: Date.now(), depth, seed: this.app.recipe.seed };
    this.saveJournal();
    this.toast(`<span class="new">新记录</span> ${sp.zh} · ${Math.round(depth)} 米`, 3000);
  }

  // ——————————————— 帮助 ———————————————
  buildHelp() {
    const h = el('div', 'modal help hidden');
    h.setAttribute('role', 'dialog');
    h.innerHTML = `<div class="mcard"><header><h2>操作</h2><button class="x" aria-label="关闭">×</button></header>
      <div class="hgrid">
      <div><kbd>上浮</kbd> / <kbd>下潜</kbd></div><div>连续前往水面 / 沿峡谷潜入深渊</div>
      <div>深度刻度</div><div>前往水面、200 米、600 米、1,000 米或热液花园</div>
      <div><kbd>漂流</kbd> / <kbd>游动</kbd></div><div>原地漂流 / 自由探索（<kbd>F</kbd> 切换）</div>
      <div><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></div><div>朝视线方向游动</div>
      <div>拖动</div><div>环顾四周</div>
      <div><kbd>Q</kbd> / <kbd>E</kbd></div><div>下沉 / 上升</div>
      <div><kbd>Shift</kbd></div><div>游得更快</div>
      <div>滚轮</div><div>游动模式下缩放</div>
      <div><kbd>1</kbd>–<kbd>4</kbd></div><div>前往同一片海里的四个生境</div>
      <div><kbd>C</kbd></div><div>海图：更多目的地</div>
      <div><kbd>G</kbd> / <kbd>R</kbd></div><div>世界实验室 / 生成新种子</div>
      <div><kbd>O</kbd> / <kbd>J</kbd></div><div>观察动物 / 野外图鉴；点一下画面里的动物也能选中</div>
      <div><kbd>L</kbd></div><div>手动覆盖潜水灯</div>
      <div><kbd>M</kbd></div><div>开启或静音海洋声音</div>
      <div><kbd>P</kbd> / <kbd>H</kbd></div><div>暂停模拟 / 隐藏界面</div>
      <div><kbd>Esc</kbd></div><div>关闭面板、结束观察、停止旅程</div>
      </div>
      <p class="note">整片海洋——地形、珊瑚、海藻、动物的形态与行为、天空与声音——都由代码实时生成，没有下载任何贴图、模型或音频。旅程速度经过压缩；动物大小与分布是为了探索而编排的近似，并非生态数据。</p></div>`;
    h.querySelector('.x').addEventListener('click', () => this.toggleHelp(false));
    h.addEventListener('click', (e) => { if (e.target === h) this.toggleHelp(false); });
    this.help = h;
    this.root.append(h);
  }
  toggleHelp(v) {
    const open = v !== undefined ? v : this.help.classList.contains('hidden');
    if (open) this.closeAll('help');
    this.help.classList.toggle('hidden', !open);
  }

  closeAll(except) {
    if (except !== 'lab') { this.lab.classList.add('hidden'); this.btnLab.classList.remove('on'); }
    if (except !== 'chart') { this.chart.classList.add('hidden'); this.btnChart.classList.remove('on'); }
    if (except !== 'journal') { this.journalEl.classList.add('hidden'); this.btnJournal.classList.remove('on'); }
    if (except !== 'help') this.help.classList.add('hidden');
  }
  setHidden(h) {
    this.hidden = h;
    this.root.classList.toggle('uihidden', h);
  }

  // ——————————————— 观察 ———————————————
  identifiable(a, dist) {
    const app = this.app, env = app.env;
    const d = Math.max(0, -a.pos.y);
    const cam = app.camera;
    const E = env.downwellLum(d) * env.exposure;
    const kv = U.uKv.value.y;
    let ok = false;
    if (E > 0.035 && dist < Math.min(45, 3.4 / kv)) ok = true;
    if (!ok && env.lampLevel > 0.3 && dist < 18) {
      const dir = new THREE.Vector3().subVectors(a.renderPos || a.pos, cam.position).normalize();
      if (dir.dot(U.uLampDir.value) > 0.82) ok = true;
    }
    if (!ok && a.sp.glow && env.water.glow > 0.2 && dist < 24) ok = true;
    if (!ok) return false;
    // 地形遮挡
    const w = app.world;
    const p0 = cam.position, p1 = a.renderPos || a.pos;
    for (let i = 1; i < 7; i++) {
      const t = i / 7;
      const x = lerp(p0.x, p1.x, t), y = lerp(p0.y, p1.y, t), z = lerp(p0.z, p1.z, t);
      if (w.floorAt(x, z) > y + 0.3) return false;
    }
    return true;
  }
  candidates() {
    const cam = this.app.camera;
    const out = [];
    const v = new THREE.Vector3();
    for (const { a, dist } of this.app.fauna.visible) {
      if (dist > 40 || !this.identifiable(a, dist)) continue;
      v.copy(a.renderPos).project(cam);
      if (Math.abs(v.x) > 0.95 || Math.abs(v.y) > 0.95 || v.z > 1) continue;
      out.push({ a, dist, sc: Math.hypot(v.x, v.y) + dist / 60 });
    }
    return out.sort((x, y) => x.sc - y.sc);
  }
  toggleObserve(force) {
    const on = force !== undefined ? force : !this.obs.active;
    if (!on) { this.endObserve(); return; }
    const c = this.candidates();
    if (!c.length) { this.toast('视野里暂时没有能看清的动物'); return; }
    this.observe(c[0].a);
  }
  observe(a) {
    this.obs.active = true;
    this.obs.target = a;
    this.obs.follow = false;
    this.btnObs.classList.add('on');
    this.renderObsCard();
  }
  nextObserve() {
    const c = this.candidates();
    const cur = this.obs.target;
    const species = [...new Set(c.map((x) => x.a.sp.id))];
    if (!species.length) return;
    const i = cur ? species.indexOf(cur.sp.id) : -1;
    const nextId = species[(i + 1) % species.length];
    const pick = c.find((x) => x.a.sp.id === nextId);
    if (pick) { this.app.explorer.follow = null; this.observe(pick.a); }
  }
  endObserve() {
    this.obs.active = false;
    this.obs.target = null;
    this.app.explorer.follow = null;
    this.btnObs.classList.remove('on');
    this.obsCard.classList.add('hidden');
    this.marker.classList.add('hidden');
    this.titleBlock.classList.remove('hidden');
  }
  renderObsCard() {
    const a = this.obs.target;
    if (!a) return;
    const sp = a.sp;
    const following = this.app.explorer.follow === a;
    this.obsCard.innerHTML = `<p class="olbl">观察中</p><h2>${sp.zh}<small>${sp.en}</small></h2><p class="odesc">${sp.desc}</p>
      <p class="ometa"></p><div class="oacts"><button class="mini on-follow">${following ? '停止跟随' : '跟随'}</button><button class="mini on-next">下一个</button><button class="mini on-close">结束观察</button></div>`;
    this.obsCard.querySelector('.on-follow').addEventListener('click', () => {
      const ex = this.app.explorer;
      if (ex.follow === a) ex.follow = null;
      else { ex.follow = a; ex.journey = null; ex.mode = 'drift'; }
      this.renderObsCard();
    });
    this.obsCard.querySelector('.on-next').addEventListener('click', () => this.nextObserve());
    this.obsCard.querySelector('.on-close').addEventListener('click', () => this.endObserve());
    this.obsMeta = this.obsCard.querySelector('.ometa');
    this.obsCard.classList.remove('hidden');
    this.titleBlock.classList.add('hidden');
  }
  pickAt(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    const cam = this.app.camera;
    const v = new THREE.Vector3();
    let best = null, bd = 1e9;
    for (const { a, dist } of this.app.fauna.visible) {
      if (dist > 45) continue;
      v.copy(a.renderPos).project(cam);
      const px = (v.x * 0.5 + 0.5) * r.width, py = (-v.y * 0.5 + 0.5) * r.height;
      const rad = Math.max(24, (a.size / dist) * r.height * 0.9);
      const d = Math.hypot(px - (clientX - r.left), py - (clientY - r.top));
      if (d < rad && d / rad + dist / 80 < bd) { bd = d / rad + dist / 80; best = a; }
    }
    if (best) this.observe(best);
    return !!best;
  }

  // ——————————————— 输入 ———————————————
  bind() {
    const app = this.app;
    const ex = app.explorer;
    let down = null;
    this.canvas.addEventListener('pointerdown', (e) => {
      down = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, t: performance.now(), id: e.pointerId, moved: 0 };
      this.canvas.setPointerCapture(e.pointerId);
    });
    this.canvas.addEventListener('pointermove', (e) => {
      if (!down || down.id !== e.pointerId) return;
      const dx = e.clientX - down.lx, dy = e.clientY - down.ly;
      down.lx = e.clientX; down.ly = e.clientY;
      down.moved += Math.abs(dx) + Math.abs(dy);
      if (down.moved > 4) { ex.look(dx, dy); if (ex.follow) ex.follow = null; }
    });
    const up = (e) => {
      if (!down) return;
      if (down.moved < 6 && performance.now() - down.t < 400) {
        if (!this.pickAt(e.clientX, e.clientY) && this.obs.active) { /* 点空白处保持当前观察 */ }
      }
      down = null;
    };
    this.canvas.addEventListener('pointerup', up);
    this.canvas.addEventListener('pointercancel', () => { down = null; });
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (ex.mode !== 'swim' && !this.obs.active) return;
      ex.fov = clamp(ex.fov + Math.sign(e.deltaY) * 3, 28, 80);
    }, { passive: false });
    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' && e.target.type === 'text')) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const code = e.code;
      ex.keys[code] = true;
      const typing = e.target && e.target.tagName === 'INPUT';
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE'].includes(code)) {
        if (ex.mode !== 'swim') { app.setMode('swim'); }
        if (ex.journey) ex.stop();
        ex.follow = null;
        app.opening = false;
      }
      if (typing) return;
      switch (code) {
        case 'Digit1': app.travelSite('reef'); break;
        case 'Digit2': app.travelSite('kelp'); break;
        case 'Digit3': app.travelSite('blue'); break;
        case 'Digit4': app.travelSite('deep'); break;
        case 'KeyG': this.toggleLab(); break;
        case 'KeyR': this.newSeed(); break;
        case 'KeyC': this.toggleChart(); break;
        case 'KeyO': this.toggleObserve(); break;
        case 'KeyJ': this.toggleJournal(); break;
        case 'KeyM': this.toggleSound(); break;
        case 'KeyF': app.setMode(ex.mode === 'swim' ? 'drift' : 'swim'); break;
        case 'KeyP': app.togglePause(); break;
        case 'KeyH': this.setHidden(!this.hidden); break;
        case 'KeyL': { const m = app.cycleLamp(); this.toast(m === 'auto' ? '潜水灯：随深度自动' : m === 'on' ? '潜水灯：开' : '潜水灯：关'); break; }
        case 'KeyN': if (this.obs.active) this.nextObserve(); break;
        case 'Escape':
          if (!this.lab.classList.contains('hidden') || !this.chart.classList.contains('hidden') || !this.journalEl.classList.contains('hidden') || !this.help.classList.contains('hidden')) this.closeAll();
          else if (this.obs.active) this.endObserve();
          else if (ex.journey) ex.stop();
          break;
        default: return;
      }
    });
    window.addEventListener('keyup', (e) => { ex.keys[e.code] = false; });
    window.addEventListener('blur', () => { ex.keys = {}; });
  }

  // ——————————————— 每帧 ———————————————
  update(dt, camera) {
    const app = this.app;
    const ex = app.explorer;
    const p = ex.pos;
    const depth = -p.y;
    // 深度计
    const shown = Math.abs(depth) < 0.05 ? 0 : depth;
    this.depthNum.innerHTML = `${fmtDepth(Math.abs(shown))}<span>m</span>`;
    this.depthLbl.textContent = depth >= 0 ? '水面以下' : '水面以上';
    const stops = [0, 200, 600, 1000, 1400];
    let fr = 0;
    const dd = clamp(depth, 0, 1450);
    for (let i = 0; i < 4; i++) if (dd >= stops[i]) fr = i + clamp((dd - stops[i]) / (stops[i + 1] - stops[i]), 0, 1);
    this.depthMark.style.top = `${(fr / 4) * 100}%`;

    // 区域标题（带迟滞）
    this.zoneT -= dt;
    if (this.zoneT <= 0) {
      this.zoneT = 0.5;
      const zone = p.y > -1.5 ? 'surface' : app.world.zoneAt(p.x, p.z, p.y);
      if (zone !== this.zone) {
        this.zone = zone;
        const z = ZONES[zone] || ZONES.blue;
        this.titleEl.classList.remove('in');
        void this.titleEl.offsetWidth;
        this.titleEl.textContent = z.title;
        this.subEl.textContent = z.sub;
        this.titleEl.classList.add('in');
        for (const [id] of TABS) this.tabEls[id].classList.toggle('on', z.tab === id);
        const tab = z.tab ? this.tabEls[z.tab] : null;
        if (tab) { this.tabBar.style.opacity = 1; this.tabBar.style.left = `${tab.offsetLeft}px`; this.tabBar.style.width = `${tab.offsetWidth}px`; }
        else this.tabBar.style.opacity = 0;
      }
      // 开场按钮
      const atSurf = p.y > -1.5 && !ex.journey;
      this.diveBtn.classList.toggle('hidden', !atSurf);
      if (atSurf) {
        let best = null, bd = 1e9;
        for (const s of Object.values(SITES)) { const d = Math.hypot(s.x - p.x, s.z - p.z); if (d < bd) { bd = d; best = s; } }
        this.diveBtn.textContent = bd < 250 ? `潜入${best.name}` : '潜入下方';
      }
    }
    // 附近
    this.nearT -= dt;
    if (this.nearT <= 0) {
      this.nearT = 0.8;
      const ids = app.fauna.nearby(p, p.y > -1.5 ? 60 : 30).slice(0, 4);
      const pre = p.y > -1.5 ? '下方' : '附近';
      this.nearEl.innerHTML = ids.length ? `${pre} · ${ids.map((id) => SPECIES_BY_ID[id].zh).join(' · ')}` : '';
    }
    // 工具栏状态
    this.btnDrift.classList.toggle('on', ex.mode === 'drift');
    this.btnSwim.classList.toggle('on', ex.mode === 'swim');
    this.btnPause.innerHTML = app.paused ? ICON.play : ICON.pause;
    this.btnLamp.classList.toggle('on', app.env.lampLevel > 0.5);
    this.btnLamp.classList.toggle('manual', app.env.water.lamp !== 'auto');
    this.touch.classList.toggle('hidden', !(ex.mode === 'swim' && matchMedia('(pointer: coarse)').matches));
    // 旅程
    if (ex.journey) {
      const j = ex.journey;
      this.journeyEl.classList.remove('hidden');
      this.journeyEl.querySelector('.jl').textContent = `正在前往 · ${j.label}`;
      this.journeyEl.querySelector('.jbar b').style.width = `${clamp(j.t / j.T, 0, 1) * 100}%`;
    } else this.journeyEl.classList.add('hidden');

    // 实验室里的实时数字
    if (!this.lab.classList.contains('hidden')) {
      this.popEl.textContent = `当前加载的动物：${app.population()} · 种子 ${app.recipe.seed}`;
      this.perfEl.textContent = `${app.fps.toFixed(0)} fps · 内部分辨率 ${(app.renderScale * 100).toFixed(0)}% · 画质 ${({ low: '低', medium: '中', high: '高' })[app.quality]}`;
      for (const k in this.lampSeg) this.lampSeg[k].classList.toggle('on', app.env.water.lamp === k);
      for (const k in this.presetBtns) this.presetBtns[k].classList.toggle('on', app.env.lightName === k);
      for (const k in this.qBtns) this.qBtns[k].classList.toggle('on', app.quality === k);
      this.sndBtn.textContent = app.sound.on ? '开' : '关';
      this.sndBtn.classList.toggle('on', app.sound.on);
      this.wlBtn.textContent = ex.waterline ? '开' : '关';
      this.wlBtn.classList.toggle('on', ex.waterline);
    }
    if (!this.chart.classList.contains('hidden')) {
      this.chartDrawT = (this.chartDrawT || 0) - dt;
      if (this.chartDrawT <= 0) { this.chartDrawT = 0.25; this.drawChart(); }
    }

    // 图鉴记录
    this.journalT -= dt;
    if (this.journalT <= 0) {
      this.journalT = 0.25;
      if (!app.paused) {
        for (const { a, dist } of app.fauna.visible) {
          if (this.journal[a.sp.id]) continue;
          if (dist < 45 && this.identifiable(a, dist)) {
            a.seen += 0.25;
            if (a.seen >= 1.0) this.record(a.sp, -a.pos.y);
          } else a.seen = Math.max(0, a.seen - 0.25);
        }
      }
    }

    // 观察标记
    if (this.obs.active) {
      const a = this.obs.target;
      if (!a || a.dead) { this.endObserve(); this.toast('动物游出了视野'); return; }
      const v = new THREE.Vector3().copy(a.renderPos || a.pos).project(camera);
      const r = this.canvas.getBoundingClientRect();
      const dist = (a.renderPos || a.pos).distanceTo(camera.position);
      if (v.z > 1 || Math.abs(v.x) > 1.2 || Math.abs(v.y) > 1.2) this.marker.classList.add('hidden');
      else {
        const px = (v.x * 0.5 + 0.5) * r.width, py = (-v.y * 0.5 + 0.5) * r.height;
        const s = clamp((a.size / Math.max(dist, 0.5)) * r.height * 0.95, 34, 360);
        this.marker.style.transform = `translate(${px - s / 2}px, ${py - s / 2}px)`;
        this.marker.style.width = `${s}px`;
        this.marker.style.height = `${s}px`;
        this.marker.querySelector('span').textContent = `${a.sp.zh} · ${dist.toFixed(1)} m`;
        this.marker.classList.remove('hidden');
      }
      if (this.obsMeta) this.obsMeta.textContent = `距离 ${dist.toFixed(1)} 米 · 深度 ${Math.round(-a.pos.y)} 米 · 体长约 ${a.size.toFixed(a.size < 1 ? 2 : 1)} 米`;
      if (dist > 70) { this.endObserve(); this.toast('动物游远了'); }
    }
  }
}
