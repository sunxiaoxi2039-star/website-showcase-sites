// 入口：画布自适应、输入（触屏/鼠标/键盘）、界面流转、主循环、标题画面演示
import { buildArt, ART, drawShipPreview, WEAPON_COLORS } from './art.js';
import { Game, SHIPS, WEAPON_NAMES } from './game.js';
import { Sound } from './audio.js';
import { LEVELS } from './levels.js';
import { store, clamp, fmtScore, fmtTime } from './util.js';

const $ = (s) => document.querySelector(s);
const W = 540;
const Q = new URLSearchParams(location.search);
const canvas = $('#game');
const ctx = canvas.getContext('2d');
const stageEl = $('#stage');
let H = 960, scale = 1, dpr = 1;

const sound = new Sound();
const silent = { play() {}, music() {}, update() {} };

function computeLayout() {
  const vw = window.innerWidth, vh = window.innerHeight;
  H = clamp(Math.round((W * vh) / vw), 880, 1200);
  scale = Math.min(vw / W, vh / H);
  dpr = Math.min(2, window.devicePixelRatio || 1);
  const cw = Math.floor(W * scale), chh = Math.floor(H * scale);
  stageEl.style.width = cw + 'px'; stageEl.style.height = chh + 'px';
  canvas.width = Math.round(cw * dpr); canvas.height = Math.round(chh * dpr);
  const wide = vw - cw >= 2 * 272;
  $('#sideL').classList.toggle('show', wide); $('#sideR').classList.toggle('show', wide);
  if (game) game.H = H;
  if (demo) demo.H = H;
}

let game = null, demo = null;
computeLayout();
const artT0 = performance.now();
buildArt(clamp(scale * dpr * 1.25, 1.5, 3));
window.__artMs = performance.now() - artT0;
const bgQ = clamp(scale * dpr, 1, 2);

game = new Game(W, H, sound); game.bgQ = bgQ;
if (Q.get('god')) game.debug.god = true;
if (Q.get('auto')) game.debug.auto = true;
const TS = +Q.get('ts') || 1;

// 标题画面演示：自动驾驶的真实对局
function makeDemo() {
  demo = new Game(W, H, silent); demo.bgQ = bgQ; demo.demo = true;
  demo.debug.god = true; demo.debug.auto = true;
  demo.newGame(['falcon', 'dragon', 'titan'][Math.floor(Math.random() * 3)], 0);
  demo.player.level = 3 + Math.floor(Math.random() * 3); demo.player.color = ['blue', 'green', 'purple', 'gold'][Math.floor(Math.random() * 4)];
  demo.skipTo(8 + Math.random() * 50);
  demo.hiscore = 0;
}
makeDemo();

// ---------- 界面 ----------
let mode = 'title';
let touchUI = window.matchMedia('(any-pointer: coarse)').matches || 'ontouchstart' in window;
const screens = ['title', 'select', 'help', 'pause', 'continue', 'over', 'ending'];
function show(name) {
  for (const s of screens) $('#' + s).classList.toggle('show', s === name);
  const inGame = name === null;
  $('#pauseBtn').classList.toggle('show', inGame);
  $('#bombBtn').classList.toggle('show', inGame && touchUI);
}
function setMode(m) {
  mode = m;
  if (m === 'play') show(null);
  else show(m);
  if (m === 'title') { $('#tHi').textContent = 'HI-SCORE ' + fmtScore(store.get('tf_hi', 0)); sound.music('title'); }
}

const legendHTML = () => ['blue', 'green', 'purple', 'gold'].map((c) => `<canvas data-item="${c}" width="56" height="56"></canvas><div><b style="color:${WEAPON_COLORS[c].light}">${WEAPON_COLORS[c].name}</b><br>${{ blue: '直线高能光束，瞬间熔穿正前方目标', green: '自动追踪最近敌人的导弹群', purple: '弯曲的闪电自动锁定多个敌人', gold: '扇形覆盖全屏的高速散弹（稀有）' }[c]}</div>`).join('')
  + `<canvas data-item="bomb" width="56" height="56"></canvas><div><b style="color:#ffb080">炸弹补给</b><br>清除全屏子弹并造成大范围伤害</div>`
  + `<canvas data-item="medal" width="56" height="56"></canvas><div><b style="color:#ffe070">勋章</b><br>拾取获得额外分数</div>`;
$('#helpLegend').innerHTML = legendHTML();
$('#sideLegend').innerHTML = legendHTML() + '<div></div><div style="color:#8ea2c4">同色武器叠加升级（最高 Lv6），不同颜色则切换武器</div>';
document.querySelectorAll('canvas[data-item]').forEach((c) => { const sp = ART.items[c.dataset.item]; const g = c.getContext('2d'); g.drawImage(sp.c, (56 - sp.w * 1.5) / 2, (56 - sp.h * 1.5) / 2, sp.w * 1.5, sp.h * 1.5); });

// 选择界面
const shipIds = ['falcon', 'dragon', 'titan'];
let selIdx = 0;
let startStage = clamp((+Q.get('stage') || 1) - 1, 0, 4);
const unlocked = () => Math.max(store.get('tf_unlock', 0), Q.get('stage') ? 4 : 0);
const thumbs = $('#thumbs');
shipIds.forEach((id, i) => {
  const b = document.createElement('button'); b.className = 'thumb'; b.innerHTML = `<canvas width="120" height="120"></canvas>${SHIPS[id].name}`;
  b.onclick = () => { selIdx = i; refreshSelect(); sound.play('select'); };
  thumbs.appendChild(b);
  const g = b.querySelector('canvas').getContext('2d'); const sp = ART.ships[id].frames[2];
  const k = 100 / sp.h; g.drawImage(sp.c, 60 - (sp.w * k) / 2, 10, sp.w * k, sp.h * k);
});
function pips(el, n) { el.innerHTML = Array.from({ length: 5 }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join(''); }
function refreshSelect() {
  const S = SHIPS[shipIds[selIdx]];
  $('#selCode').textContent = S.code; $('#selName').textContent = S.name;
  pips($('#pPower'), S.stats.power); pips($('#pSpeed'), S.stats.speed); pips($('#pBomb'), S.stats.bomb);
  $('#selSpec').innerHTML = `<b>初始武器：</b><span style="color:${WEAPON_COLORS[S.weapon].light}">${WEAPON_COLORS[S.weapon].name}</span><br><b>副武器：</b>${S.sub}　<b>炸弹：</b>${S.bombName} ×${S.bombs}<br>${S.desc}`;
  [...thumbs.children].forEach((b, i) => b.classList.toggle('on', i === selIdx));
  const st = $('#stages'); const u = unlocked();
  st.innerHTML = '<span>出击关卡</span>' + LEVELS.map((L, i) => `<button ${i > u ? 'disabled' : ''} class="${i === startStage ? 'on' : ''}" data-s="${i}" title="${L.name}">${i + 1}</button>`).join('');
  st.querySelectorAll('button').forEach((b) => (b.onclick = () => { startStage = +b.dataset.s; refreshSelect(); sound.play('select'); }));
}
if (startStage > unlocked()) startStage = 0;
refreshSelect();

function startGame(auto) {
  if (!auto) { sound.init(); sound.play('start'); }
  game.newGame(shipIds[selIdx], startStage);
  if (Q.get('skip')) game.skipTo(+Q.get('skip'));
  if (Q.get('lv')) { game.player.level = +Q.get('lv'); }
  if (Q.get('wc')) { game.player.color = Q.get('wc'); }
  lastShip = shipIds[selIdx];
  setMode('play');
}
let lastShip = 'falcon';
$('#startBtn').onclick = () => { sound.init(); sound.play('select'); setMode('select'); };
$('#helpBtn').onclick = () => { sound.init(); sound.play('select'); setMode('help'); };
$('#helpBack').onclick = () => { sound.play('select'); setMode('title'); };
$('#backBtn').onclick = () => { sound.play('select'); setMode('title'); };
$('#goBtn').onclick = startGame;
$('#resumeBtn').onclick = () => { setMode('play'); };
$('#muteBtn').onclick = () => { sound.setMuted(!sound.muted); updateMute(); };
function updateMute() { $('#muteBtn').textContent = '声音：' + (sound.muted ? '关' : '开'); }
updateMute();
$('#restartBtn').onclick = () => { game.newGame(lastShip, game.stageIdx); setMode('play'); };
$('#quitBtn').onclick = () => { game.saveHi(); game.state = 'idle'; setMode('title'); };
$('#contYes').onclick = () => { game.continueGame(); setMode('play'); };
$('#contNo').onclick = () => gameOver();
$('#overRetry').onclick = () => { game.newGame(lastShip, 0); setMode('play'); };
$('#overTitle').onclick = () => { game.state = 'idle'; setMode('title'); };
$('#endRetry').onclick = () => { setMode('select'); };
$('#endTitle').onclick = () => { game.state = 'idle'; setMode('title'); };

let contT = 0;
game.on('gameover', () => { contT = 9.99; setMode('continue'); sound.music(null); });
game.on('ending', () => {
  store.set('tf_unlock', 4);
  $('#endStats').innerHTML = statRows([['最终得分', fmtScore(game.score)], ['通关用时', fmtTime(game.totalTime)], ['击坠数', game.kills], ['续关次数', game.continues], ['使用战机', game.ship.name]]);
  setTimeout(() => setMode('ending'), 2500);
});
game.on('stage', (i) => { if (i > store.get('tf_unlock', 0)) store.set('tf_unlock', i); });
function statRows(rows) { return rows.map(([k, v]) => `<div class="kv"><span>${k}</span><b>${v}</b></div>`).join(''); }
function gameOver() {
  game.saveHi();
  $('#overStats').innerHTML = statRows([['得分', fmtScore(game.score)], ['最高分', fmtScore(game.hiscore)], ['到达关卡', `${game.stageIdx + 1} · ${LEVELS[game.stageIdx].name}`], ['击坠数', game.kills]]);
  game.state = 'idle';
  setMode('over');
}

// ---------- 输入 ----------
const keys = new Set();
const keyMap = { ArrowLeft: 'L', KeyA: 'L', ArrowRight: 'R', KeyD: 'R', ArrowUp: 'U', KeyW: 'U', ArrowDown: 'D', KeyS: 'D' };
window.addEventListener('keydown', (e) => {
  if (!e.repeat) sound.init();
  if (keyMap[e.code]) { keys.add(keyMap[e.code]); e.preventDefault(); }
  if (e.key === 'Shift') game.input.slow = true;
  if (mode === 'play') {
    if (e.code === 'Space' || e.code === 'KeyX' || e.code === 'KeyK') { game.useBomb(); e.preventDefault(); }
    if (e.code === 'KeyP' || e.code === 'Escape') setMode('pause');
  } else if (mode === 'pause') {
    if (e.code === 'KeyP' || e.code === 'Escape') setMode('play');
  } else if (mode === 'title') {
    if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); setMode('select'); sound.play('select'); }
  } else if (mode === 'select') {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') { selIdx = (selIdx + 2) % 3; refreshSelect(); sound.play('select'); }
    if (e.code === 'ArrowRight' || e.code === 'KeyD') { selIdx = (selIdx + 1) % 3; refreshSelect(); sound.play('select'); }
    if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); startGame(); }
    if (e.code === 'Escape') setMode('title');
  } else if (mode === 'help' && (e.code === 'Escape' || e.code === 'Enter')) setMode('title');
});
window.addEventListener('keyup', (e) => { if (keyMap[e.code]) keys.delete(keyMap[e.code]); if (e.key === 'Shift') game.input.slow = false; });
window.addEventListener('blur', () => { keys.clear(); game.input.drag = null; if (mode === 'play') setMode('pause'); });
document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'play') setMode('pause'); });

let drag = null;
function toLogical(e) { const r = canvas.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H]; }
canvas.addEventListener('pointerdown', (e) => {
  sound.init();
  if (e.pointerType === 'touch' && !touchUI) { touchUI = true; if (mode === 'play') show(null); }
  if (mode !== 'play') return;
  const [x, y] = toLogical(e);
  const p = game.player;
  drag = { id: e.pointerId, sx: x, sy: y, px: p.x, py: p.y };
  game.input.drag = { tx: p.x, ty: p.y };
  try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  e.preventDefault();
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.id || mode !== 'play') return;
  const [x, y] = toLogical(e);
  const k = e.pointerType === 'touch' ? 1.25 : 1;
  let tx = drag.px + (x - drag.sx) * k, ty = drag.py + (y - drag.sy) * k;
  // 越界时重新锚定，避免"死区"
  const cx = clamp(tx, 18, W - 18), cy = clamp(ty, 60, H - 40);
  if (cx !== tx) { drag.sx += (tx - cx) / k; tx = cx; }
  if (cy !== ty) { drag.sy += (ty - cy) / k; ty = cy; }
  game.input.drag = { tx, ty };
});
const endDrag = (e) => { if (drag && e.pointerId === drag.id) { drag = null; game.input.drag = null; } };
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
$('#bombBtn').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); game.useBomb(); });
$('#pauseBtn').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); setMode('pause'); });
window.addEventListener('resize', computeLayout);

// ---------- 主循环 ----------
let last = performance.now(), sideT = 0;
const perf = (window.__perf = { frames: 0, upd: 0, draw: 0 });
const prevCtx = $('#preview').getContext('2d');
function frame(now) {
  const rdt = Math.min(0.05, (now - last) / 1000); last = now;
  game.input.kx = (keys.has('R') ? 1 : 0) - (keys.has('L') ? 1 : 0);
  game.input.ky = (keys.has('D') ? 1 : 0) - (keys.has('U') ? 1 : 0);
  let active = null;
  if (mode === 'play' || mode === 'continue' || mode === 'pause' || (mode === 'ending' && game.state !== 'idle')) active = game;
  else if (mode === 'over' && game.state !== 'idle') active = game;
  if (mode === 'play' || mode === 'continue') {
    const dt = rdt * TS, n = Math.max(1, Math.ceil(dt / (1 / 60)));
    const t0 = performance.now();
    for (let i = 0; i < n; i++) game.update(dt / n);
    perf.upd += performance.now() - t0;
  }
  if (!active) {
    active = demo;
    demo.update(rdt);
    if (demo.state === 'clear' || demo.stageT > 95 || demo.state === 'ending') makeDemo();
  }
  if (mode === 'continue') {
    contT -= rdt;
    $('#contCount').textContent = Math.max(0, Math.floor(contT));
    if (contT <= 0) gameOver();
  }
  ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
  ctx.imageSmoothingEnabled = true;
  const t1 = performance.now();
  active.draw(ctx);
  perf.draw += performance.now() - t1; perf.frames++;
  if (mode === 'select') drawPreview(now / 1000);
  sound.update();
  // 炸弹按钮
  if (mode === 'play') { const b = game.player.bombs; $('#bombN').textContent = '×' + b; $('#bombBtn').classList.toggle('empty', b <= 0); }
  sideT -= rdt;
  if (sideT <= 0) { sideT = 0.25; updateSide(active); }
  requestAnimationFrame(frame);
}

function drawPreview(t) {
  const c = prevCtx, S = 600;
  c.clearRect(0, 0, S, S);
  c.save();
  c.translate(S / 2, S / 2);
  // 旋转光环
  c.strokeStyle = 'rgba(120,180,255,.35)'; c.lineWidth = 2;
  for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(0, 0, 150 + i * 44, t * (0.4 + i * 0.2), t * (0.4 + i * 0.2) + Math.PI * (0.6 + i * 0.3)); c.stroke(); }
  c.strokeStyle = 'rgba(255,200,80,.5)'; c.setLineDash([4, 12]); c.beginPath(); c.arc(0, 0, 250, -t * 0.3, -t * 0.3 + Math.PI * 2); c.stroke(); c.setLineDash([]);
  const gr = c.createRadialGradient(0, 0, 10, 0, 0, 260); gr.addColorStop(0, 'rgba(60,120,255,.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gr; c.fillRect(-300, -300, 600, 600);
  c.restore();
  drawShipPreview(c, shipIds[selIdx], S / 2, S / 2 - 10 + Math.sin(t * 2) * 8, 4.2, t);
}

function updateSide(g) {
  if (!$('#sideL').classList.contains('show')) return;
  const real = g === game && game.player;
  $('#sScore').textContent = fmtScore(real ? game.score : 0);
  $('#sHi').textContent = fmtScore(Math.max(store.get('tf_hi', 0), real ? game.hiscore : 0));
  $('#sStage').textContent = real ? `${game.stageIdx + 1} / 5` : '—';
  $('#sShip').textContent = real ? game.ship.name : SHIPS[shipIds[selIdx]].name;
  $('#sWeapon').textContent = real ? `${WEAPON_NAMES[game.player.color]} Lv${game.player.level}` : '—';
  $('#sTime').textContent = real ? fmtTime(game.totalTime) : '0:00';
}

setMode('title');
if (Q.get('autostart')) { selIdx = Math.max(0, shipIds.indexOf(Q.get('autostart'))); startGame(true); }
requestAnimationFrame(frame);
window.__game = game;
window.__demo = () => demo;
