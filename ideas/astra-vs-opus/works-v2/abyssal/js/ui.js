// 界面：标题、深度计、生境切换、工具栏、世界实验室、海图、观察模式、野外图鉴、帮助。
import * as THREE from 'three';
import { SITES, PLACES, EXT, canyonX, DEFAULT_RECIPE } from './world.js';
import { LIGHT_PRESETS, U } from './optics.js';
import { SPECIES, SPECIES_BY_ID } from './species.js';
import { clamp, lerp, smoothstep, mulberry32 } from './noise.js';
import { L, tx, isEn, onLang } from './i18n.js';

const ZONES = {
  surface: { title: { zh: '呼吸之海', en: 'The Breathing Sea' }, sub: { zh: '随浪漂浮，或潜入下面的世界。', en: 'Float on the swell, or dive into the world below.' }, tab: null },
  reef: { title: { zh: '珊瑚大教堂', en: 'Coral Cathedral' }, sub: { zh: '海浪之下的另一个世界。', en: 'Another world beneath the waves.' }, tab: 'reef' },
  kelp: { title: { zh: '沉没的森林', en: 'The Sunken Forest' }, sub: { zh: '整片森林随海水起伏。', en: 'A whole forest swaying with the sea.' }, tab: 'kelp' },
  blue: { title: { zh: '深入蔚蓝', en: 'Into the Blue' }, sub: { zh: '在巨兽身边，你是如此渺小。', en: 'Beside the giants, you are very small.' }, tab: 'blue' },
  twilight: { title: { zh: '暮光带', en: 'Twilight Zone' }, sub: { zh: '最后一点蓝光，来自上方的缓慢的雪。', en: 'The last of the blue light, and a slow snow falling from above.' }, tab: 'blue' },
  lowtwilight: { title: { zh: '漫长的暮光', en: 'The Long Twilight' }, sub: { zh: '光几乎耗尽，生命开始自己发光。', en: 'The light is nearly spent; life begins to make its own.' }, tab: 'deep' },
  midnight: { title: { zh: '午夜之水', en: 'Midnight Waters' }, sub: { zh: '这里从未有过白天。', en: 'Day has never reached this far.' }, tab: 'deep' },
  vents: { title: { zh: '午夜花园', en: 'Midnight Garden' }, sub: { zh: '光消失之后，生命仍在。', en: 'Where the light ends, life goes on.' }, tab: 'deep' },
  abyss: { title: { zh: '玄武岩平原', en: 'Basalt Plain' }, sub: { zh: '深渊平原上，一切都慢了下来。', en: 'On the abyssal plain, everything slows down.' }, tab: 'deep' },
};
const TABS = [['reef', { zh: '珊瑚礁', en: 'Coral Reef' }], ['kelp', { zh: '海藻林', en: 'Kelp Forest' }], ['blue', { zh: '开阔大洋', en: 'Open Ocean' }], ['deep', { zh: '深渊', en: 'The Deep' }]];
const STOPS = [[0, { zh: '水面', en: 'Surface' }], [200, { zh: '暮光带', en: 'Twilight' }], [600, { zh: '下暮光带', en: 'Low twilight' }], [1000, { zh: '午夜带', en: 'Midnight' }], [1400, { zh: '热液区', en: 'Vents' }]];
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
    onLang(() => this.relocalize());
  }

  // 切换语言：保存界面状态 → 重建全部 DOM → 恢复（不刷新、不动渲染）
  relocalize() {
    const st = {
      lab: !this.lab.classList.contains('hidden'), labCur: this.labCur,
      more: this.lab.querySelector('details.more')?.open, view: this.lab.querySelector('details.view')?.open,
      chart: !this.chart.classList.contains('hidden'),
      chartTarget: this.chartTarget,
      journal: !this.journalEl.classList.contains('hidden'),
      help: !this.help.classList.contains('hidden'),
      obs: this.obs.active ? this.obs.target : null,
      labOpened: this.labOpened,
    };
    this.sliders = [];
    this.chartTarget = null;
    this.build();
    this.zone = null; this.zoneT = 0; this.nearT = 0;
    if (this.hidden) this.root.classList.add('uihidden');
    if (st.lab) { this.toggleLab(true); this.labTab(st.labCur); }
    else if (st.labCur) this.labTab(st.labCur);
    this.labOpened = st.labOpened;
    const m = this.lab.querySelector('details.more'); if (m && st.more) m.open = true;
    const v = this.lab.querySelector('details.view'); if (v && st.view) v.open = true;
    if (st.chart) {
      this.toggleChart(true);
      const t = st.chartTarget;
      if (t) {
        const same = this.chartItems.find((i) => i.kind === t.kind && i.id === t.id && t.kind !== 'point');
        if (same) this.chartSelect(same);
        else if (t.kind === 'point') this.chartSelect(this.chartPoint(t.x, t.z));
      }
    }
    if (st.journal) this.toggleJournal(true);
    if (st.help) this.toggleHelp(true);
    if (st.obs && !st.obs.dead) this.observe(st.obs);
    else this.obs.active = false;
  }

  // ——————————————— 构建 ———————————————
  build() {
    const r = this.root;
    r.innerHTML = '';
    this.brand = el('div', 'brand', `ABYSSAL<small>${L('活的深海', 'The Living Deep')}</small>`);
    r.append(this.brand);

    // 右上：主操作
    const top = el('div', 'topbtns');
    this.btnUp = this.button(ICON.up, L('上浮', 'Ascend'), () => { if (!this.app.ascend()) this.toast(L('已经在水面了', 'Already at the surface')); }, L('回到水面漂浮', 'Return to the surface and float'));
    this.btnDown = this.button(ICON.down, L('下潜', 'Descend'), () => { if (!this.app.descend()) this.toast(L('已经在海底附近', 'Already near the seafloor')); }, L('沿峡谷下潜到深渊（或在深水区直接下沉）', 'Dive down the canyon into the deep (or sink straight down in deep water)'));
    this.btnChart = this.button(ICON.chart, L('探索', 'Explore'), () => this.toggleChart(), L('海图与目的地（C）', 'Sea chart and destinations (C)'));
    this.btnLab = this.button(ICON.lab, L('世界实验室', 'World Lab'), () => this.toggleLab(), L('种子、地形、生命、水体与天气（G）', 'Seed, terrain, life, water and weather (G)'));
    this.btnHelp = this.button('?', '', () => this.toggleHelp(), L('操作说明', 'Controls'));
    this.btnHelp.classList.add('sq');
    top.append(this.btnUp, this.btnDown, this.btnChart, this.btnLab, this.btnHelp);
    r.append(top);

    // 右侧：深度计
    const g = el('div', 'gauge');
    this.depthNum = el('div', 'dnum', '0<span>m</span>');
    this.depthLbl = el('div', 'dlbl', L('水面以下', 'BELOW SURFACE'));
    const scale = el('div', 'dscale');
    this.stopEls = STOPS.map(([d, name], i) => {
      const s = el('button', 'stop', `<b>${d === 1400 ? '≈1,400' : d.toLocaleString('en-US')}</b><span>${tx(name)}</span>`);
      s.style.top = `${(i / (STOPS.length - 1)) * 100}%`;
      s.title = d === 0 ? L('上浮到水面', 'Ascend to the surface') : L(`前往 ${d} 米`, `Go to ${d.toLocaleString('en-US')} m`);
      s.addEventListener('click', () => {
        if (d === 0) this.app.ascend();
        else if (d === 1400) this.app.descend();
        else if (!this.app.descend(d)) this.toast(L('已经在这个深度以下', 'Already below this depth'));
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
    this.titleEl = el('h1', 'title', tx(ZONES.surface.title));
    this.subEl = el('p', 'sub', '');
    this.nearEl = el('p', 'near', '');
    this.diveBtn = el('button', 'cta', L('潜入珊瑚礁', 'Dive into the Coral Reef'));
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
      const b = el('button', 'tab', `${tx(name)}<kbd>${SITES[id].key}</kbd>`);
      b.addEventListener('click', () => { this.app.travelSite(id); b.blur(); });
      this.tabEls[id] = b;
      tabs.append(b);
    }
    this.tabBar = el('i', 'tabbar');
    tabs.append(this.tabBar);
    r.append(tabs);

    // 右下：工具栏
    const tools = el('div', 'tools');
    this.btnDrift = this.button('', L('漂流', 'Drift'), () => this.app.setMode('drift'), L('原地漂流，镜头不惊扰动物', 'Drift in place without disturbing the animals'));
    this.btnSwim = this.button('', L('游动', 'Swim'), () => this.app.setMode('swim'), L('WASD 游动，拖动环顾（F）', 'Swim with WASD, drag to look around (F)'));
    this.btnPause = this.button(ICON.pause, '', () => this.app.togglePause(), L('暂停模拟（P）', 'Pause the simulation (P)'));
    this.btnLamp = this.button(ICON.lamp, '', () => this.toast(this.lampMsg(this.app.cycleLamp())), L('潜水灯（L）', 'Dive light (L)'));
    this.btnObs = this.button(ICON.eye, '', () => this.toggleObserve(), L('观察视野里的动物（O）', 'Observe an animal in view (O)'));
    this.btnJournal = this.button(ICON.book, '', () => this.toggleJournal(), L('野外图鉴（J）', 'Field guide (J)'));
    this.btnShot = this.button(ICON.camera, '', () => { this.app.screenshot(); this.toast(L('已保存不含界面的截图', 'Saved a screenshot without the interface')); }, L('保存截图（不含界面）', 'Save a screenshot (without the interface)'));
    for (const [b, t] of [[this.btnPause, this.btnPause.title], [this.btnLamp, this.btnLamp.title], [this.btnObs, this.btnObs.title], [this.btnJournal, this.btnJournal.title], [this.btnShot, this.btnShot.title], [this.btnHelp, this.btnHelp.title]]) b.setAttribute('aria-label', t);
    for (const b of [this.btnPause, this.btnLamp, this.btnObs, this.btnJournal, this.btnShot]) b.classList.add('sq');
    tools.append(this.btnDrift, this.btnSwim, this.btnPause, this.btnLamp, this.btnObs, this.btnJournal, this.btnShot);
    const hint = el('div', 'hint', L('选择 <b>游动</b> 开始探索 · <b>G</b> 世界实验室 · <b>H</b> 隐藏界面', 'Choose <b>Swim</b> to explore · <b>G</b> World Lab · <b>H</b> hide interface'));
    const tw = el('div', 'toolwrap');
    tw.append(tools, hint);
    r.append(tw);

    // 旅程提示
    this.journeyEl = el('div', 'journey hidden', `<span class="jl"></span><i class="jbar"><b></b></i><button>${L('停在这里', 'Stop here')}</button>`);
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
    this.touch.append(tbtn(L('前进', 'Forward'), 'f', 1), tbtn(L('后退', 'Back'), 'f', -1), tbtn(L('上升', 'Up'), 'u', 1), tbtn(L('下沉', 'Down'), 'u', -1));
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

  lampMsg(m) { return m === 'auto' ? L('潜水灯：随深度自动', 'Dive light: auto by depth') : m === 'on' ? L('潜水灯：开', 'Dive light: on') : L('潜水灯：关', 'Dive light: off'); }
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
    lab.setAttribute('aria-label', L('世界实验室', 'World Lab'));
    lab.innerHTML = `<header><h2>${L('世界实验室', 'World Lab')}</h2><button class="x" aria-label="${L('关闭', 'Close')}">×</button></header>`;
    lab.querySelector('.x').addEventListener('click', () => this.toggleLab(false));
    const tabs = el('div', 'ltabs');
    tabs.setAttribute('role', 'tablist');
    const body = el('div', 'lbody');
    const pages = {};
    this.labTabs = {};
    const tabNames = [['world', L('世界', 'World')], ['life', L('生命', 'Life')], ['water', L('水体', 'Water')], ['weather', L('天气', 'Weather')]];
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
    const seedRow = el('div', 'row seedrow', `<label>${L('种子', 'Seed')}</label>`);
    this.seedInput = el('input');
    this.seedInput.type = 'text';
    this.seedInput.value = R.seed;
    this.seedInput.setAttribute('aria-label', L('世界种子（数字或文字）', 'World seed (number or text)'));
    const seedGo = el('button', 'mini', L('生长', 'Grow'));
    seedGo.addEventListener('click', () => this.applySeed(this.seedInput.value));
    this.seedInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.applySeed(this.seedInput.value); e.stopPropagation(); });
    const newSeed = el('button', 'mini', L('新种子', 'New seed'));
    newSeed.addEventListener('click', () => this.newSeed());
    seedRow.append(this.seedInput, seedGo, newSeed);
    w.append(seedRow);
    w.append(this.slider(L('地形起伏', 'Relief'), 0.3, 2, 0.05, () => R.relief, (v) => this.regen({ relief: v }), { live: false }));
    w.append(this.slider(L('生物覆盖', 'Cover'), 0, 2, 0.05, () => R.cover, (v) => app.setCover({ cover: v }), { live: false }));
    w.append(this.slider(L('海藻高度', 'Kelp height'), 0.4, 1.6, 0.05, () => R.kelpHeight, (v) => app.setCover({ kelpHeight: v }), { live: false }));
    w.append(this.slider(L('生境尺度', 'Habitat scale'), 0.6, 1.8, 0.05, () => R.habitatScale, (v) => this.regen({ habitatScale: v }), { live: false }));
    w.append(el('p', 'note', L('地形类旋钮在松开时重新生长；同一片海底，回到同一个地方看到的群落不变。', 'Terrain knobs regrow the seafloor when you let go; on the same seafloor, returning to the same spot shows the same communities.')));
    const acts = el('div', 'acts');
    const reset = el('button', 'mini', L('重置配方', 'Reset recipe'));
    reset.addEventListener('click', () => this.resetRecipe());
    const copy = el('button', 'mini', L('复制世界链接', 'Copy world link'));
    copy.addEventListener('click', () => this.copyLink());
    acts.append(reset, copy);
    w.append(acts);

    // 生命
    const l = pages.life;
    l.append(this.slider(L('动物丰度', 'Abundance'), 0, 2, 0.05, () => R.life, (v) => app.setLife({ life: v }), { live: false }));
    l.append(this.slider(L('掠食者', 'Predators'), 0, 2, 0.05, () => R.predators, (v) => app.setLife({ predators: v }), { live: false }));
    l.append(this.slider(L('底栖生物', 'Bottom dwellers'), 0, 2, 0.05, () => R.benthos, (v) => app.setLife({ benthos: v }), { live: false }));
    l.append(this.slider(L('水母与漂流者', 'Jellies & drifters'), 0, 2, 0.05, () => R.jellies, (v) => app.setLife({ jellies: v }), { live: false }));
    l.append(this.slider(L('鱼群规模', 'School size'), 0.3, 2, 0.05, () => R.shoal, (v) => app.setLife({ shoal: v }), { live: false }));
    this.popEl = el('p', 'note', '');
    l.append(this.popEl);
    l.append(el('p', 'note', L('数字是当前在镜头周围加载的动物，而不是整片海洋的总数。', 'The count is the animals currently loaded around the camera, not the total for the whole ocean.')));

    // 水体
    const wa = pages.water;
    wa.append(this.slider(L('水体清澈度', 'Clarity'), 0.4, 2, 0.05, () => E.water.clarity, (v) => { E.water.clarity = v; }));
    wa.append(this.slider(L('洋流强度', 'Current'), 0, 3, 0.05, () => E.water.current, (v) => { E.water.current = v; }));
    wa.append(this.slider(L('生物发光', 'Glow'), 0, 3, 0.05, () => E.water.glow, (v) => { E.water.glow = v; }));
    wa.append(this.slider(L('深层上升流', 'Upwelling'), 0, 3, 0.05, () => E.water.upwelling, (v) => { E.water.upwelling = v; }));
    const lampRow = el('div', 'row', `<label>${L('潜水灯', 'Dive light')}</label>`);
    const seg = el('div', 'seg');
    this.lampSeg = {};
    for (const [id, name] of [['auto', L('自动', 'Auto')], ['on', L('开', 'On')], ['off', L('关', 'Off')]]) {
      const b = el('button', '', name);
      b.addEventListener('click', () => { E.water.lamp = id; });
      this.lampSeg[id] = b;
      seg.append(b);
    }
    lampRow.append(seg);
    wa.append(lampRow);
    const sndRow = el('div', 'row', `<label>${L('海洋声音', 'Ocean sound')}</label>`);
    this.sndBtn = el('button', 'toggle', L('关', 'Off'));
    this.sndBtn.addEventListener('click', () => this.toggleSound());
    sndRow.append(this.sndBtn);
    wa.append(sndRow);
    wa.append(this.slider(L('音量', 'Volume'), 0, 1, 0.01, () => app.sound.volume, (v) => app.sound.setVolume(v)));
    wa.append(el('p', 'note', L('声音全部实时合成：浪涌、水下低鸣、礁区的噼啪声、远处的鲸歌。M 键开关。', 'All sound is synthesised live: surf, the underwater drone, the crackle of the reef, distant whale song. Press M to toggle.')));

    // 天气
    const we = pages.weather;
    const pr = el('div', 'seg presets');
    this.presetBtns = {};
    for (const [id, name] of [['day', L('白天', 'Day')], ['dusk', L('黄昏', 'Dusk')], ['storm', L('风暴', 'Storm')], ['night', L('夜晚', 'Night')]]) {
      const b = el('button', '', name);
      b.addEventListener('click', () => { E.setPreset(id); app.weatherChanged(); this.refreshSliders(); });
      this.presetBtns[id] = b;
      pr.append(b);
    }
    we.append(pr);
    const W = E.weather;
    const wx = (k) => (v) => { W[k] = v; E.lightName = 'custom'; if (['wind', 'swell', 'chop', 'windDir', 'swellDir', 'period', 'storm'].includes(k)) app.weatherChanged(); };
    we.append(this.slider(L('太阳高度', 'Sun elevation'), -30, 85, 1, () => W.sun, wx('sun'), { fmt: (v) => `${v.toFixed(0)}°` }));
    we.append(this.slider(L('云量', 'Cloud cover'), 0, 1, 0.01, () => W.cloud, wx('cloud')));
    we.append(this.slider(L('风速', 'Wind speed'), 0, 30, 0.5, () => W.wind, wx('wind'), { fmt: (v) => `${v.toFixed(1)} m/s` }));
    we.append(this.slider(L('涌浪', 'Swell'), 0, 1.5, 0.01, () => W.swell, wx('swell')));
    we.append(this.slider(L('风暴强度', 'Storm'), 0, 1, 0.01, () => W.storm, wx('storm')));
    const more = el('details', 'more');
    more.innerHTML = `<summary>${L('更多天气旋钮', 'More weather controls')}</summary>`;
    more.append(this.slider(L('风向', 'Wind direction'), 0, 360, 1, () => W.windDir, wx('windDir'), { fmt: (v) => `${v.toFixed(0)}°` }));
    more.append(this.slider(L('涌浪周期', 'Swell period'), 0.3, 2, 0.01, () => W.period, wx('period')));
    more.append(this.slider(L('浪尖陡度', 'Chop'), 0, 1.6, 0.01, () => W.chop, wx('chop')));
    more.append(this.slider(L('降雨', 'Rain'), 0, 1, 0.01, () => W.rain, wx('rain')));
    more.append(this.slider(L('雾霾', 'Haze'), 0, 1, 0.01, () => W.haze, wx('haze')));
    more.append(this.slider(L('云密度', 'Cloud density'), 0, 1, 0.01, () => W.cloudDensity, wx('cloudDensity')));
    we.append(more);
    const ev = el('div', 'events', `<h3>${L('海洋事件', 'Ocean events')}</h3>`);
    const evb = (name, id, tip) => { const b = el('button', 'mini', name); b.title = tip; b.addEventListener('click', () => { app.event(id); this.toast(tip); }); return b; };
    ev.append(
      evb(L('海底震颤', 'Seafloor tremor'), 'tremor', L('深处的热液区发生震颤：沉积物被搅起，一圈长波传向海面', 'A tremor shakes the deep vent field: sediment billows up and a long wave rolls toward the surface')),
      evb(L('畸形浪', 'Rogue wave'), 'rogue', L('一道畸形浪正从你身后逼近', 'A rogue wave is closing in behind you')),
      evb(L('闪电', 'Lightning'), 'lightning', L('一道闪电劈向远处的海面', 'Lightning strikes the sea in the distance')));
    we.append(ev);

    // 视图与控制
    const view = el('details', 'view');
    view.innerHTML = `<summary>${L('视图与控制', 'View & controls')}</summary>`;
    const wlRow = el('div', 'row', `<label>${L('在水线漂浮', 'Float at the waterline')}</label>`);
    this.wlBtn = el('button', 'toggle', L('关', 'Off'));
    this.wlBtn.addEventListener('click', () => {
      const ex = app.explorer;
      ex.waterline = !ex.waterline;
      if (ex.waterline) { ex.journey = null; ex.floating = true; ex.pos.y = 0; ex.mode = 'drift'; ex.pitch = 0; }
      else if (ex.pos.y > -2) ex.pos.y = 1.6;
    });
    wlRow.append(this.wlBtn);
    view.append(wlRow);
    const qRow = el('div', 'row', `<label>${L('渲染画质', 'Render quality')}</label>`);
    const qseg = el('div', 'seg');
    this.qBtns = {};
    for (const [id, name] of [['low', L('低', 'Low')], ['medium', L('中', 'Medium')], ['high', L('高', 'High')]]) {
      const b = el('button', '', name);
      b.addEventListener('click', () => { app.setQuality(id); });
      this.qBtns[id] = b;
      qseg.append(b);
    }
    qRow.append(qseg);
    view.append(qRow);
    this.perfEl = el('p', 'note mono', '');
    view.append(this.perfEl);
    const hb = el('button', 'mini', L('操作说明', 'Controls'));
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
    this.toast(L('正在重新生长海底……', 'Regrowing the seafloor…'));
    setTimeout(() => { this.app.regenerate(patch); this.chartVersion = -1; }, 30);
  }
  applySeed(v) {
    const s = String(v).trim();
    if (!s) return;
    let seed = /^\d+$/.test(s) ? (parseInt(s, 10) >>> 0) : (() => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0) % 1000000; })();
    this.regen({ seed });
    this.seedInput.value = seed;
    this.toast(L(`种子 ${seed}`, `Seed ${seed}`));
  }
  newSeed() {
    const seed = Math.floor(Math.random() * 99999) + 1;
    this.seedInput.value = seed;
    this.regen({ seed });
    this.toast(L(`新种子 ${seed}：另一片海洋`, `New seed ${seed}: another ocean`));
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
    const done = () => this.toast(L('世界链接已复制', 'World link copied'));
    const ask = L('复制这个链接：', 'Copy this link:');
    try {
      navigator.clipboard.writeText(url).then(done, () => { window.prompt(ask, url); });
    } catch (e) { window.prompt(ask, url); }
  }
  toggleSound() {
    const s = this.app.sound;
    s.setOn(!s.on).then(() => {});
    setTimeout(() => this.toast(s.on ? L('海洋声音已开启', 'Ocean sound on') : L('海洋声音已关闭', 'Ocean sound off')), 50);
  }

  // ——————————————— 海图 ———————————————
  buildChart() {
    const c = el('div', 'modal chart hidden');
    c.setAttribute('role', 'dialog');
    c.setAttribute('aria-label', L('海图', 'Sea chart'));
    c.innerHTML = `<div class="mcard">
      <header><h2>${L('海图', 'Sea chart')}</h2><p>${L('同一片海洋里的生境与目的地。点选标记，或在海图上任意一点，然后出发。', 'Habitats and destinations in the same ocean. Pick a marker, or any point on the chart, then set off.')}</p><button class="x" aria-label="${L('关闭', 'Close')}">×</button></header>
      <div class="cbody"><div class="cmap"><canvas></canvas><div class="clegend"><span class="lg reef">${L('珊瑚礁', 'Coral reef')}</span><span class="lg kelp">${L('海藻林', 'Kelp')}</span><span class="lg grass">${L('海草', 'Seagrass')}</span><span class="lg vent">${L('热液带', 'Vents')}</span><span class="lg you">${L('你的位置', 'You')}</span></div></div>
      <div class="clist"></div></div>
      <footer><div class="csel">${L('选择一个目的地', 'Choose a destination')}</div><button class="cta go" disabled>${L('前往', 'Go')}</button></footer></div>`;
    c.querySelector('.x').addEventListener('click', () => this.toggleChart(false));
    c.addEventListener('click', (e) => { if (e.target === c) this.toggleChart(false); });
    this.chart = c;
    this.chartCanvas = c.querySelector('canvas');
    this.chartSel = c.querySelector('.csel');
    this.chartGo = c.querySelector('.go');
    const list = c.querySelector('.clist');
    const groups = [
      [L('四个生境', 'Four habitats'), Object.values(SITES).map((s) => ({ kind: 'site', id: s.id, name: L(s.title, s.titleEn), note: L(s.name, s.nameEn), x: s.x, z: s.z }))],
      [L('更远的地方', 'Farther afield'), PLACES.map((p) => ({ kind: 'place', id: p.id, name: L(p.name, p.nameEn), note: L(p.note, p.noteEn), x: p.x, z: p.z }))],
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
        this.app.explorer.travelTo({ x: s.x, y: Math.min(-4, f + 6), z: s.z, yaw: this.app.explorer.yaw, pitch: -0.1 }, { zh: '海图上的一点', en: 'a point on the chart' });
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
        this.chartSelect(this.chartPoint(x, z));
      }
    });
    this.root.append(c);
  }
  chartPoint(x, z) {
    const f = this.app.world.floorAt(x, z);
    return { kind: 'point', name: L('海图上的一点', 'A point on the chart'), note: L(`水深约 ${Math.round(-f)} 米`, `About ${Math.round(-f).toLocaleString('en-US')} m deep`), x, z };
  }
  chartSelect(it) {
    this.chartTarget = it;
    for (const i of this.chartItems) i.btn.classList.toggle('on', i === it);
    const f = this.app.world.floorAt(it.x, it.z);
    const d = Math.hypot(it.x - this.app.explorer.pos.x, it.z - this.app.explorer.pos.z);
    this.chartSel.innerHTML = L(`<b>${it.name}</b> · 水深约 ${Math.round(-f).toLocaleString('en-US')} 米 · 距离 ${(d / 1000).toFixed(2)} 公里`, `<b>${it.name}</b> · about ${Math.round(-f).toLocaleString('en-US')} m deep · ${(d / 1000).toFixed(2)} km away`);
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
    j.setAttribute('aria-label', L('野外图鉴', 'Field guide'));
    j.innerHTML = `<div class="mcard"><header><h2>${L('野外图鉴', 'Field guide')}</h2><p class="jprog"></p><button class="x" aria-label="${L('关闭', 'Close')}">×</button></header><div class="jgrid"></div>
      <footer><p class="note">${L('动物需要在画面里停留片刻、距离足够近、没有被岩石或地形挡住，并且被光照亮（阳光、潜水灯，或它自己的生物光）才会被记录。记录保存在这个浏览器里。', 'An animal is recorded once it stays in frame for a moment, close enough, not hidden by rock or terrain, and lit up (by sunlight, your dive light, or its own bioluminescence). Records are saved in this browser.')}</p></footer></div>`;
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
      if (['butterflyfish', 'parrotfish', 'damselfish', 'reefshark', 'manta', 'octopus', 'crab', 'seastar', 'urchin'].includes(sp.id)) return L('珊瑚礁', 'the coral reef');
      if (['seal', 'turtle', 'sardine'].includes(sp.id)) return L('海藻林与浅海', 'the kelp forest and shallows');
      if (['whale', 'dolphin', 'tuna', 'sunfish', 'squid'].includes(sp.id)) return L('开阔大洋', 'the open ocean');
      if (['lanternfish', 'hatchetfish', 'mwshrimp'].includes(sp.id)) return L('200 米以下的峡谷', 'the canyon below 200 m');
      if (['vampire', 'dragonfish'].includes(sp.id)) return L('600 米以下', 'below 600 m');
      if (['anglerfish', 'gulper'].includes(sp.id)) return L('1,000 米以下', 'below 1,000 m');
      if (['seapen', 'brittlestar'].includes(sp.id)) return L('陆坡与深海海底', 'the slope and deep seafloor');
      if (['jelly', 'siphonophore'].includes(sp.id)) return L('水层中漂流', 'drifting in open water');
      return L('深渊海底', 'the abyssal floor');
    };
    for (const sp of SPECIES) {
      const rec = this.journal[sp.id];
      if (rec) n++;
      const card = el('article', 'jcard' + (rec ? ' seen' : ''));
      const link = rec && LINKS[sp.id] ? `<a href="${LINKS[sp.id]}" target="_blank" rel="noopener">${L('延伸阅读 ↗', 'Further reading ↗')}</a>` : '';
      card.innerHTML = `<h4>${this.spName(sp)}</h4>
        <p class="jmeta">${rec ? L(`首次记录：${Math.round(rec.depth)} 米 · 种子 ${rec.seed}`, `First recorded at ${Math.round(rec.depth).toLocaleString('en-US')} m · seed ${rec.seed}`) : L(`尚未记录 · 线索：${where(sp)}`, `Not yet recorded · Hint: ${where(sp)}`)}</p>
        <p class="jdesc">${rec ? L(sp.desc, sp.descEn) : L('……', '…')}</p>${link}`;
      grid.append(card);
    }
    this.journalEl.querySelector('.jprog').textContent = L(`已记录 ${n} / ${SPECIES.length} 种动物群体。描述的是生成的动物类群，而非精确的生物物种。`, `${n} of ${SPECIES.length} animal groups recorded. Entries describe generated animal groups, not exact biological species.`);
  }
  // 中文：「中文名<small>英文名</small>」；英文：只显示英文俗名
  spName(sp) { return isEn() ? sp.en : `${sp.zh}<small>${sp.en}</small>`; }
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
    this.toast(L(`<span class="new">新记录</span> ${sp.zh} · ${Math.round(depth)} 米`, `<span class="new">NEW</span> ${sp.en} · ${Math.round(depth).toLocaleString('en-US')} m`), 3000);
  }

  // ——————————————— 帮助 ———————————————
  buildHelp() {
    const h = el('div', 'modal help hidden');
    h.setAttribute('role', 'dialog');
    h.setAttribute('aria-label', L('操作', 'Controls'));
    h.innerHTML = isEn() ? `<div class="mcard"><header><h2>Controls</h2><button class="x" aria-label="Close">×</button></header>
      <div class="hgrid">
      <div><kbd>Ascend</kbd> / <kbd>Descend</kbd></div><div>Travel up to the surface / down the canyon into the deep</div>
      <div>Depth scale</div><div>Go to the surface, 200 m, 600 m, 1,000 m or the vent garden</div>
      <div><kbd>Drift</kbd> / <kbd>Swim</kbd></div><div>Drift in place / explore freely (<kbd>F</kbd> to switch)</div>
      <div><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></div><div>Swim where you are looking</div>
      <div>Drag</div><div>Look around</div>
      <div><kbd>Q</kbd> / <kbd>E</kbd></div><div>Sink / rise</div>
      <div><kbd>Shift</kbd></div><div>Swim faster</div>
      <div>Scroll wheel</div><div>Zoom while swimming</div>
      <div><kbd>1</kbd>–<kbd>4</kbd></div><div>Visit the four habitats in the same ocean</div>
      <div><kbd>C</kbd></div><div>Sea chart: more destinations</div>
      <div><kbd>G</kbd> / <kbd>R</kbd></div><div>World Lab / new seed</div>
      <div><kbd>O</kbd> / <kbd>J</kbd></div><div>Observe an animal / field guide; tapping an animal on screen also selects it</div>
      <div><kbd>L</kbd></div><div>Override the dive light</div>
      <div><kbd>M</kbd></div><div>Turn ocean sound on or off</div>
      <div><kbd>P</kbd> / <kbd>H</kbd></div><div>Pause the simulation / hide the interface</div>
      <div><kbd>Esc</kbd></div><div>Close panels, end observation, stop a journey</div>
      </div>
      <p class="note">The entire ocean (terrain, coral, kelp, the animals' shapes and behaviour, the sky and the sound) is generated by code in real time; no textures, models or audio are downloaded. Journeys are time-compressed, and animal sizes and distributions are approximations staged for exploring, not ecological data.</p></div>`
      : `<div class="mcard"><header><h2>操作</h2><button class="x" aria-label="关闭">×</button></header>
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
    if (!c.length) { this.toast(L('视野里暂时没有能看清的动物', 'No animal close and clear enough to observe right now')); return; }
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
    this.obsCard.innerHTML = `<p class="olbl">${L('观察中', 'OBSERVING')}</p><h2>${this.spName(sp)}</h2><p class="odesc">${L(sp.desc, sp.descEn)}</p>
      <p class="ometa"></p><div class="oacts"><button class="mini on-follow">${following ? L('停止跟随', 'Stop following') : L('跟随', 'Follow')}</button><button class="mini on-next">${L('下一个', 'Next')}</button><button class="mini on-close">${L('结束观察', 'End')}</button></div>`;
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
        case 'KeyL': { this.toast(this.lampMsg(app.cycleLamp())); break; }
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
    this.depthLbl.textContent = depth >= 0 ? L('水面以下', 'BELOW SURFACE') : L('水面以上', 'ABOVE SURFACE');
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
        this.titleEl.textContent = tx(z.title);
        this.subEl.textContent = tx(z.sub);
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
        this.diveBtn.textContent = bd < 250 ? L(`潜入${best.name}`, `Dive into the ${best.nameEn}`) : L('潜入下方', 'Dive below');
      }
    }
    // 附近
    this.nearT -= dt;
    if (this.nearT <= 0) {
      this.nearT = 0.8;
      const ids = app.fauna.nearby(p, p.y > -1.5 ? 60 : 30).slice(0, 4);
      const pre = p.y > -1.5 ? L('下方', 'Below') : L('附近', 'Nearby');
      this.nearEl.innerHTML = ids.length ? `${pre} · ${ids.map((id) => (isEn() ? SPECIES_BY_ID[id].en : SPECIES_BY_ID[id].zh)).join(' · ')}` : '';
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
      this.journeyEl.querySelector('.jl').textContent = `${L('正在前往', 'Heading to')} · ${tx(j.label)}`;
      this.journeyEl.querySelector('.jbar b').style.width = `${clamp(j.t / j.T, 0, 1) * 100}%`;
    } else this.journeyEl.classList.add('hidden');

    // 实验室里的实时数字
    if (!this.lab.classList.contains('hidden')) {
      this.popEl.textContent = L(`当前加载的动物：${app.population()} · 种子 ${app.recipe.seed}`, `Animals loaded: ${app.population()} · seed ${app.recipe.seed}`);
      this.perfEl.textContent = L(`${app.fps.toFixed(0)} fps · 内部分辨率 ${(app.renderScale * 100).toFixed(0)}% · 画质 ${({ low: '低', medium: '中', high: '高' })[app.quality]}`, `${app.fps.toFixed(0)} fps · internal resolution ${(app.renderScale * 100).toFixed(0)}% · quality ${({ low: 'low', medium: 'medium', high: 'high' })[app.quality]}`);
      for (const k in this.lampSeg) this.lampSeg[k].classList.toggle('on', app.env.water.lamp === k);
      for (const k in this.presetBtns) this.presetBtns[k].classList.toggle('on', app.env.lightName === k);
      for (const k in this.qBtns) this.qBtns[k].classList.toggle('on', app.quality === k);
      this.sndBtn.textContent = app.sound.on ? L('开', 'On') : L('关', 'Off');
      this.sndBtn.classList.toggle('on', app.sound.on);
      this.wlBtn.textContent = ex.waterline ? L('开', 'On') : L('关', 'Off');
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
      if (!a || a.dead) { this.endObserve(); this.toast(L('动物游出了视野', 'The animal swam out of view')); return; }
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
        this.marker.querySelector('span').textContent = `${isEn() ? a.sp.en : a.sp.zh} · ${dist.toFixed(1)} m`;
        this.marker.classList.remove('hidden');
      }
      if (this.obsMeta) this.obsMeta.textContent = L(`距离 ${dist.toFixed(1)} 米 · 深度 ${Math.round(-a.pos.y)} 米 · 体长约 ${a.size.toFixed(a.size < 1 ? 2 : 1)} 米`, `${dist.toFixed(1)} m away · ${Math.round(-a.pos.y).toLocaleString('en-US')} m deep · about ${a.size.toFixed(a.size < 1 ? 2 : 1)} m long`);
      if (dist > 70) { this.endObserve(); this.toast(L('动物游远了', 'The animal swam away')); }
    }
  }
}
