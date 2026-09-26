// 游戏核心：玩家、武器、弹幕、碰撞、道具、特效、关卡流程
import { ART, WEAPON_COLORS } from './art.js';
import { Background } from './bg.js';
import { LEVELS } from './levels.js';
import { BOSSES, emissile, tick } from './enemies.js';
import { TAU, clamp, rand, pick, lerp, store } from './util.js';
import { drawHUD } from './hud.js';

const PI = Math.PI;

export const SHIPS = {
  falcon: {
    id: 'falcon', name: '赤隼', code: 'R-1 FALCON', speed: 330, dmg: 1.0, bombs: 3, hit: 3.6, weapon: 'gold',
    sub: '双联火箭弹', bombName: '雷霆核爆', desc: '经典均衡型主力战机，机翼挂载双联火箭弹，炸弹为覆盖全屏的热核冲击波。',
    stats: { power: 3, speed: 3, bomb: 4 }, flame: 'flame',
  },
  dragon: {
    id: 'dragon', name: '苍龙', code: 'X-2 DRAGON', speed: 410, dmg: 0.88, bombs: 2, hit: 3.2, weapon: 'blue',
    sub: '双僚机护航', bombName: '苍雷风暴', desc: '前掠翼高速截击机，两架僚机同步射击，炸弹召唤连锁落雷精确打击。',
    stats: { power: 2, speed: 5, bomb: 3 }, flame: 'bflame',
  },
  titan: {
    id: 'titan', name: '雷神', code: 'Z-3 TITAN', speed: 280, dmg: 1.22, bombs: 4, hit: 4.2, weapon: 'green',
    sub: '侧翼重型机炮', bombName: '聚能歼灭炮', desc: '重装攻击机，火力与装甲最强但机动偏慢，炸弹为持续照射的巨型光束。',
    stats: { power: 5, speed: 2, bomb: 5 }, flame: 'flame',
  },
};

const COLOR_WEIGHTS = [['blue', 34], ['green', 30], ['purple', 22], ['gold', 14]];
function randColor() {
  let r = Math.random() * 100;
  for (const [c, w] of COLOR_WEIGHTS) { if ((r -= w) < 0) return c; }
  return 'blue';
}
export const WEAPON_NAMES = { blue: '贯穿激光', green: '追踪导弹', purple: '雷电锁链', gold: '雷霆散弹' };
const MAXLV = 6;

export class Game {
  constructor(W, H, sound) {
    this.W = W; this.H = H; this.snd = sound;
    this.input = { kx: 0, ky: 0, slow: false, drag: null };
    this.state = 'idle';
    this.hiscore = store.get('tf_hi', 0);
    this.listeners = {};
    this.debug = {};
  }
  on(ev, fn) { this.listeners[ev] = fn; }
  emit(ev, a) { if (this.listeners[ev]) this.listeners[ev](a); }
  sfx(n) { this.snd.play(n); }

  // ---------- 流程 ----------
  newGame(shipId, stage = 0) {
    this.ship = SHIPS[shipId];
    this.score = 0; this.kills = 0; this.continues = 0; this.totalTime = 0; this.bombsUsed = 0; this.deaths = 0;
    this.player = {
      x: this.W / 2, y: this.H - 140, bank: 0, lives: 3, bombs: this.ship.bombs, color: this.ship.weapon, level: 1,
      alive: true, inv: 2, shotT: 0, subT: 0, mT: 0, respawnT: 0, hist: [], opts: [], vx: 0, vy: 0, t: 0,
    };
    for (let i = 0; i < 20; i++) this.player.hist.push([this.player.x, this.player.y]);
    this.startStage(stage);
  }
  startStage(i) {
    this.stageIdx = i;
    this.level = LEVELS[i];
    this.bg = new Background(this.level.theme, this.W, this.bgQ || 1.5);
    this.enemies = []; this.pb = []; this.eb = []; this.lasers = []; this.items = []; this.fx = []; this.texts = []; this.beams = []; this.bolts = [];
    this.stageT = 0; this.scriptT = 0; this.ei = 0; this.boss = null;
    this.state = 'play'; this.banner = { t: 0, kind: 'stage' };
    this.hpMul = 1 + i * 0.16; this.bs = 1 + i * 0.07; this.fireMul = 1 + i * 0.12;
    this.scrollSpeed = 36;
    this.shakeV = 0; this.flash = 0; this.bombFx = null; this.pity = 0; this.noMiss = true; this.stageKills = 0;
    this.midT = 0;
    const p = this.player;
    p.x = this.W / 2; p.y = this.H + 60; p.inv = 3; p.alive = true; p.enterT = 1.2;
    this.snd.music(this.level.music);
    this.emit('stage', i);
  }
  skipTo(t) {
    this.scriptT = t; this.stageT = t;
    const ev = this.level.events;
    this.ei = 0; while (this.ei < ev.length && ev[this.ei][0] < t) this.ei++;
    this.bg.scroll = t * this.scrollSpeed;
    this.banner.t = 99;
  }

  // ---------- 发射工具（供敌人调用） ----------
  aimAng(x, y) { const p = this.player; return Math.atan2(p.y - y, p.x - x); }
  shoot(x, y, ang, spd, type = 'o', o = {}) {
    if (this.bombFx || this.eb.length > 900) return null;
    spd *= this.bs;
    const b = { x, y, bx: x, by: y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, t: 0, type, r: o.r || (type === 'big' || type === 'bigv' ? 8 : 4), o };
    if (o.wave) { b.px = -Math.sin(ang); b.py = Math.cos(ang); }
    this.eb.push(b);
    return b;
  }
  fan(x, y, ang, n, spread, spd, type, o) { for (let i = 0; i < n; i++) this.shoot(x, y, ang + (n > 1 ? (i / (n - 1) - 0.5) * spread : 0), spd, type, o); }
  ring(x, y, n, spd, type, off = 0, o) { for (let i = 0; i < n; i++) this.shoot(x, y, off + (i * TAU) / n, spd, type, o); }
  laser(o) {
    const L = Object.assign({ t: 0, warn: 0.9, dur: 1, w: 22, sweep: 0, len: 1600, ox: 0, oy: 0 }, o);
    if (L.owner && L.owner.sc) { L.ox *= L.owner.sc; L.oy *= L.owner.sc; }
    if (L.owner) { L.x = L.owner.x + L.ox; L.y = L.owner.y + L.oy; }
    this.lasers.push(L);
    this.sfx('charge');
  }
  emissile(x, y, ang) { if (!this.bombFx) emissile(this, x, y, ang); }
  cancelBullets(score = true) {
    for (const b of this.eb) { if (score) { this.fxAdd({ k: 'glow', spr: 'gold', x: b.x, y: b.y, vx: 0, vy: -40, life: 0.35, size: 14 }); } }
    if (score) this.score += this.eb.length * 10;
    this.eb.length = 0;
    this.lasers.length = 0;
  }
  midWarn() { this.banner = { t: 0, kind: 'mid' }; this.sfx('charge'); this.midT = 0.01; }
  shake(v) { this.shakeV = Math.max(this.shakeV, v); }
  flashScreen(v) { this.flash = Math.max(this.flash, v); }

  // ---------- 特效 ----------
  fxAdd(f) { if (this.fx.length < 900) this.fx.push(f); }
  explode(x, y, s = 1) {
    const n = Math.round(5 + s * 5);
    this.fxAdd({ k: 'glow', spr: 'white', x, y, vx: 0, vy: 0, life: 0.18, size: 50 * Math.sqrt(s), grow: 2 });
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), v = rand(20, 150) * Math.sqrt(s);
      this.fxAdd({ k: 'glow', spr: pick(['orange', 'orange', 'red', 'gold']), x: x + rand(-6, 6) * s, y: y + rand(-6, 6) * s, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rand(0.35, 0.8), size: rand(18, 34) * Math.pow(s, 0.55), drag: 3, grow: 0.6 });
    }
    for (let i = 0; i < Math.round(2 + s * 2.5); i++) {
      const a = rand(0, TAU), v = rand(10, 60) * Math.sqrt(s);
      this.fxAdd({ k: 'smoke', x: x + rand(-8, 8) * s, y: y + rand(-8, 8) * s, vx: Math.cos(a) * v, vy: Math.sin(a) * v + this.scrollSpeed, life: rand(0.8, 1.6), size: rand(16, 28) * Math.pow(s, 0.6), grow: 1.4, drag: 1.5, rot: rand(0, TAU) });
    }
    for (let i = 0; i < Math.round(6 + s * 6); i++) {
      const a = rand(0, TAU), v = rand(180, 520) * Math.pow(s, 0.3);
      this.fxAdd({ k: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rand(0.15, 0.4), size: rand(1, 2), drag: 4 });
    }
    if (s >= 1.5) {
      for (let i = 0; i < Math.round(s * 3); i++) { const a = rand(0, TAU), v = rand(60, 220); this.fxAdd({ k: 'debris', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rand(0.6, 1.2), size: rand(2, 5), rot: rand(0, TAU), vr: rand(-10, 10), drag: 1.5 }); }
      this.fxAdd({ k: 'ring', x, y, vx: 0, vy: 0, life: 0.45, size: 10, grow2: 90 * s });
      this.shake(2 + s * 2);
    }
  }
  puff(x, y, s = 1) { this.fxAdd({ k: 'glow', spr: 'orange', x, y, vx: 0, vy: 0, life: 0.12, size: 18 * s }); this.fxAdd({ k: 'smoke', x, y, vx: rand(-10, 10), vy: this.scrollSpeed, life: 0.6, size: 10 * s, grow: 1.5, rot: 0 }); }
  trail(x, y) { this.fxAdd({ k: 'smoke', x, y, vx: 0, vy: this.scrollSpeed * 0.5, life: 0.45, size: 7, grow: 1.8, rot: rand(0, TAU), light: true }); }
  wake(x, y) { this.fxAdd({ k: 'wake', x: x + rand(-3, 3), y, vx: rand(-8, 8), vy: this.scrollSpeed, life: 1.2, size: 5, grow: 3 }); }
  spark(x, y, col = 'gold') {
    this.fxAdd({ k: 'glow', spr: col, x, y, vx: rand(-30, 30), vy: rand(-60, 0), life: 0.12, size: rand(10, 16) });
  }
  text(x, y, s, col = '#fff', size = 14) { this.texts.push({ x, y, s, col, life: 1.1, size }); }

  // ---------- 道具 ----------
  dropItem(x, y, kind, color) {
    const a = rand(0, TAU);
    const it = { kind, color, x: clamp(x, 24, this.W - 24), y: clamp(y, 70, this.H - 120), vx: Math.cos(a) * rand(60, 90), vy: Math.sin(a) * rand(40, 70) + 20, t: 0, life: kind === 'medal' ? 99 : 10.5 };
    if (kind === 'medal') { it.vx = rand(-30, 30); it.vy = -60; }
    this.items.push(it);
  }

  // ---------- 伤害与击破 ----------
  hitTest(e, x, y, r) {
    if (e.hitRects) {
      for (const [ox, oy, hw, hh] of e.hitRects) if (Math.abs(x - (e.x + ox)) < hw + r && Math.abs(y - (e.y + oy)) < hh + r) return true;
      return false;
    }
    return Math.abs(x - e.x) < e.hw + r && Math.abs(y - e.y) < e.hh + r;
  }
  damage(e, d) {
    if (!e.alive || e.dying) return;
    if (e.inv) { return; }
    e.hp -= d; e.flash = 0.07;
    if (e.hp <= 0) this.kill(e);
  }
  kill(e) {
    if (e.boss) {
      e.dying = 3.2; e.inv = true; e.hp = 0;
      for (const p of e.parts) if (p.alive) { p.alive = false; this.explode(p.x, p.y, 1.5); }
      this.cancelBullets(); this.sfx('boomL'); this.shake(14); this.flashScreen(0.5);
      this.snd.music(null);
      return;
    }
    e.alive = false;
    this.score += e.score; this.kills++; this.stageKills++;
    const s = e.mid ? 3.5 : e.big ? 2.2 : e.kind === 'turret' ? 1.4 : e.kind === 'missile' ? 0.6 : e.ground ? 1.3 : 1;
    this.explode(e.x, e.y, s);
    this.sfx(s >= 2 ? 'boomM' : 'boomS');
    if (e.ground && this.bg) this.bg.crater(e.x, e.y, this.H, e.kind === 'bunker' ? 26 : 18);
    if (e.parts) for (const p of e.parts) if (p.alive) { p.alive = false; this.explode(p.x, p.y, 1.2); }
    if (e.score >= 1500) this.text(e.x, e.y - 10, String(e.score), '#ffe070', e.mid ? 20 : 15);
    if (e.onKill) e.onKill(e, this);
    // 掉落
    if (e.carrier) {
      this.dropItem(e.x, e.y, 'weapon', randColor());
      if (Math.random() < 0.45) this.dropItem(e.x, e.y, 'bomb');
      this.pity = 0;
    } else if (e.mid) {
      for (let i = 0; i < (e.dropN || 1); i++) this.dropItem(e.x + rand(-30, 30), e.y, 'weapon', randColor());
      this.dropItem(e.x, e.y, 'bomb');
      for (let i = 0; i < 5; i++) this.dropItem(e.x + rand(-50, 50), e.y + rand(-30, 30), 'medal');
      this.pity = 0;
    } else if (e.drop > 0) {
      if (Math.random() < e.drop || (this.pity > 16 && e.drop >= 0.05)) { this.dropItem(e.x, e.y, 'weapon', randColor()); this.pity = 0; }
      else if (e.ground && Math.random() < 0.35) this.dropItem(e.x, e.y, 'medal');
      else if (Math.random() < 0.02) this.dropItem(e.x, e.y, 'bomb');
    }
  }

  continueGame() {
    const p = this.player;
    this.continues++; this.score = 0;
    p.lives = 3; p.bombs = this.ship.bombs; p.alive = true; p.inv = 3.5; p.x = this.W / 2; p.y = this.H + 60; p.enterT = 1;
    this.state = this.prevState || 'play';
    this.cancelBullets(false);
  }

  playerDie(cause = '?') {
    const p = this.player;
    if (!p.alive || p.inv > 0 || this.debug.god) return;
    (this.debug.causes || (this.debug.causes = [])).push(cause + '@' + this.stageIdx + ':' + Math.round(this.stageT));
    p.alive = false; p.respawnT = 1.8; this.noMiss = false; this.deaths++;
    this.explode(p.x, p.y, 3); this.sfx('die'); this.flashScreen(0.4);
    // 雷电式惩罚：火力下降并掉出当前颜色的武器
    this.dropItem(p.x, p.y - 40, 'weapon', p.color);
    p.level = Math.max(1, p.level - 2);
    p.lives--;
    this.cancelBullets(false);
  }

  useBomb() {
    const p = this.player;
    if (!p.alive || p.bombs <= 0 || this.bombFx || this.state === 'clear') return;
    p.bombs--; this.bombsUsed++;
    const type = this.ship.id;
    this.bombFx = { type, t: 0, dur: type === 'falcon' ? 2.4 : type === 'dragon' ? 2.2 : 2.6, x: p.x, y: Math.max(200, p.y - 300), tickT: 0, bolts: [] };
    p.inv = Math.max(p.inv, this.bombFx.dur + 0.6);
    this.cancelBullets(); this.sfx('bomb'); this.shake(16); this.flashScreen(0.8);
  }

  // ---------- 更新 ----------
  update(dt) {
    if (this.state === 'idle' || this.state === 'paused') return;
    this.totalTime += dt;
    this.stageT += dt;
    const frozen = this.state === 'gameover' || this.state === 'ending';
    if (!frozen && !this.enemies.some((e) => e.mid && e.alive)) this.scriptT += dt;
    this.banner.t += dt;
    const bossMode = this.boss && this.boss.alive;
    this.bg.update(dt, this.scrollSpeed, this.H);
    this.pity += dt;

    // 关卡脚本
    const ev = this.level.events;
    while (!frozen && this.ei < ev.length && ev[this.ei][0] <= this.scriptT) {
      const e = ev[this.ei++];
      if (e[1] === 'boss') { this.state = 'warning'; this.warnT = 0; this.banner = { t: 0, kind: 'warning' }; this.snd.music(null); this.sfx('warning'); }
      else e[1](this);
    }
    if (this.state === 'warning') {
      this.warnT += dt;
      if (this.warnT > 3.6) { this.boss = BOSSES[this.stageIdx](this); this.state = 'boss'; this.snd.music('boss'); this.emit('boss', this.boss); }
    }

    this.updatePlayer(dt);
    this.updateEnemies(dt);
    this.updateBullets(dt);
    this.updateLasers(dt);
    this.updateItems(dt);
    this.updateBomb(dt);
    this.updateFx(dt);

    if (this.state === 'boss' && this.boss && this.boss.dying) {
      const b = this.boss;
      b.dying -= dt;
      if (tick(b.st, 'dx', 0.12, dt)) { this.explode(b.x + rand(-b.hw - 40, b.hw + 40), b.y + rand(-b.hh - 20, b.hh + 20), rand(1.2, 2.4)); this.sfx('boomS'); }
      if (b.dying <= 0) {
        this.explode(b.x, b.y, 6); for (let i = 0; i < 6; i++) this.explode(b.x + rand(-100, 100), b.y + rand(-80, 80), 2.5);
        this.sfx('boomL'); this.shake(24); this.flashScreen(1);
        b.alive = false;
        this.score += b.score; this.kills++;
        this.text(b.x, b.y, String(b.score), '#ffe070', 26);
        this.dropItem(b.x - 40, b.y, 'weapon', randColor());
        this.dropItem(b.x + 40, b.y, 'bomb');
        if (this.stageIdx === 1 || this.stageIdx === 3) this.dropItem(b.x, b.y + 30, 'oneup');
        for (let i = 0; i < 10; i++) this.dropItem(b.x + rand(-120, 120), b.y + rand(-60, 60), 'medal');
        this.state = 'clear'; this.clearT = 0;
        const bonusBomb = this.player.bombs * 5000, bonusNoMiss = this.noMiss ? 50000 : 0;
        this.clearInfo = { bonusBomb, bonusNoMiss, kills: this.stageKills, time: this.stageT };
        this.score += bonusBomb + bonusNoMiss;
        this.banner = { t: 0, kind: 'clear' };
        this.snd.music('clear');
      }
    }
    if (this.state === 'clear') {
      this.clearT += dt;
      if (this.clearT > 7) {
        if (this.stageIdx < LEVELS.length - 1) this.startStage(this.stageIdx + 1);
        else { this.state = 'ending'; this.saveHi(); this.snd.music('title'); this.emit('ending'); }
      }
    }
    if (this.score > this.hiscore) this.hiscore = this.score;
    this.shakeV = Math.max(0, this.shakeV - dt * 30);
    this.flash = Math.max(0, this.flash - dt * 1.6);
  }
  saveHi() { store.set('tf_hi', Math.floor(this.hiscore)); }

  updatePlayer(dt) {
    const p = this.player, S = this.ship, I = this.input;
    p.t += dt;
    if (!p.alive) {
      p.respawnT -= dt;
      if (p.respawnT <= 0) {
        if (p.lives < 0) { if (this.state !== 'gameover') { this.prevState = this.state; this.state = 'gameover'; this.saveHi(); this.emit('gameover'); } return; }
        p.alive = true; p.inv = 3.2; p.x = this.W / 2; p.y = this.H + 60; p.enterT = 1; p.bombs = Math.max(p.bombs, S.bombs);
      }
      return;
    }
    p.inv = Math.max(0, p.inv - dt);
    const ox = p.x, oy = p.y;
    if (p.enterT > 0) {
      p.enterT -= dt;
      p.y = lerp(p.y, this.H - 150, Math.min(1, dt * 4));
    } else if (this.debug.auto) {
      // 测试用自动驾驶：躲避最近的子弹
      let tx = this.W / 2 + Math.sin(p.t * 0.7) * this.W * 0.3, ty = this.H - 170;
      for (const b of this.eb) { const fx = b.x + b.vx * 0.25, fy = b.y + b.vy * 0.25; const dx = p.x - fx, dy = p.y - fy; const d2 = dx * dx + dy * dy; if (d2 < 80 * 80) { tx += (dx / Math.sqrt(d2 + 1)) * 120; ty += (dy / Math.sqrt(d2 + 1)) * 60; } }
      for (const e of this.enemies) { if (!e.alive || e.ground || e.t < 0) continue; const dx = p.x - e.x, dy = p.y - e.y; if (Math.abs(dx) < e.hw + 50 && Math.abs(dy) < e.hh + 90) tx += Math.sign(dx || 1) * 120; }
      for (const L of this.lasers) { const dx = p.x - L.x; tx += Math.sign(dx || 1) * 140; }
      for (const it of this.items) if (it.kind !== 'medal') { tx = it.x; ty = Math.max(it.y, this.H * 0.45); break; }
      const d = Math.hypot(tx - p.x, ty - p.y), m = S.speed * dt;
      if (d > 1) { p.x += ((tx - p.x) / d) * Math.min(d, m); p.y += ((ty - p.y) / d) * Math.min(d, m); }
    } else {
      const sp = S.speed * (I.slow ? 0.5 : 1);
      if (I.drag) {
        const tx = I.drag.tx, ty = I.drag.ty;
        const d = Math.hypot(tx - p.x, ty - p.y), m = sp * 2.6 * dt;
        if (d > 0.5) { p.x += ((tx - p.x) / d) * Math.min(d, m); p.y += ((ty - p.y) / d) * Math.min(d, m); }
      }
      let kx = I.kx, ky = I.ky;
      if (kx && ky) { kx *= 0.7071; ky *= 0.7071; }
      p.x += kx * sp * dt; p.y += ky * sp * dt;
    }
    if (p.enterT <= 0) { p.x = clamp(p.x, 18, this.W - 18); p.y = clamp(p.y, 60, this.H - 40); }
    p.vx = (p.x - ox) / Math.max(dt, 1e-4);
    p.vy = (p.y - oy) / Math.max(dt, 1e-4);
    p.bank = lerp(p.bank, clamp(p.vx / S.speed, -1, 1), Math.min(1, dt * 9));
    p.hist.unshift([p.x, p.y]); if (p.hist.length > 40) p.hist.pop();
    // 苍龙僚机
    if (S.id === 'dragon') {
      const lag = p.hist[Math.min(p.hist.length - 1, 6)];
      p.opts = [[lag[0] - 34, lag[1] + 14], [lag[0] + 34, lag[1] + 14]];
    }
    if (this.state !== 'gameover') this.fire(dt);
  }

  fire(dt) {
    const p = this.player, S = this.ship, L = p.level, m = S.dmg;
    this.beams.length = 0; this.bolts.length = 0;
    p.shotT -= dt; p.subT -= dt; p.mT -= dt;
    const nose = p.y - 34;
    switch (p.color) {
      case 'gold': {
        if (p.shotT <= 0) {
          p.shotT = 0.075;
          const n = [3, 5, 7, 9, 11, 13][L - 1], spread = [0.12, 0.26, 0.42, 0.58, 0.74, 0.9][L - 1];
          for (let i = 0; i < n; i++) {
            const k = n > 1 ? i / (n - 1) - 0.5 : 0, a = -PI / 2 + k * spread;
            this.pb.push({ k: 'vulcan', spr: L >= 5 ? 'vulcan2' : 'vulcan', x: p.x + k * 14, y: nose + Math.abs(k) * 10, vx: Math.cos(a) * 1000, vy: Math.sin(a) * 1000, dmg: 1.05 * m, r: 5, rot: a + PI / 2 });
          }
          this.sfx('shot');
        }
        break;
      }
      case 'blue': {
        const w = [10, 14, 18, 22, 26, 32][L - 1];
        this.beam(p.x, nose + 6, -PI / 2, w, (46 + 16 * L) * m, dt, 'blue');
        if (L >= 3) { const a = L >= 5 ? 0.22 : 0.14; this.beam(p.x - 12, nose + 14, -PI / 2 - a, 7, 14 * L * m * 0.5, dt, 'blue'); this.beam(p.x + 12, nose + 14, -PI / 2 + a, 7, 14 * L * m * 0.5, dt, 'blue'); }
        if (p.shotT <= 0) { p.shotT = 0.1; this.sfx('shot'); }
        break;
      }
      case 'green': {
        if (p.shotT <= 0) {
          p.shotT = 0.1;
          const xs = L >= 3 ? [-10, -4, 4, 10] : [-5, 5];
          for (const dx of xs) this.pb.push({ k: 'shot', spr: 'shot', x: p.x + dx, y: nose, vx: 0, vy: -950, dmg: 0.9 * m, r: 4, rot: 0 });
          this.sfx('shot');
        }
        if (p.mT <= 0) {
          p.mT = [0.42, 0.36, 0.34, 0.32, 0.3, 0.27][L - 1];
          const n = [2, 2, 3, 4, 4, 6][L - 1];
          for (let i = 0; i < n; i++) {
            const sd = i % 2 ? 1 : -1, a = -PI / 2 + sd * (0.6 + (i >> 1) * 0.35);
            this.pb.push({ k: 'missile', x: p.x + sd * 16, y: p.y - 4, vx: Math.cos(a) * 260, vy: Math.sin(a) * 260, sp: 260, dmg: 6.2 * m, r: 6, rot: a + PI / 2, t: 0, target: null });
          }
        }
        break;
      }
      case 'purple': {
        const maxN = [1, 2, 2, 3, 3, 4][L - 1];
        const cands = this.enemies.filter((e) => e.alive && e.t >= 0 && !e.inv && e.y > -10 && e.y < p.y + 30 && e.x > -10 && e.x < this.W + 10);
        cands.sort((a, b) => ((a.x - p.x) ** 2 + (a.y - p.y) ** 2) - ((b.x - p.x) ** 2 + (b.y - p.y) ** 2));
        const tg = cands.slice(0, maxN);
        const dps = (44 + 13 * L) * m / (1 + 0.3 * Math.max(0, tg.length - 1));
        for (const e of tg) { this.bolts.push({ x0: p.x, y0: nose, x1: e.x, y1: e.y, w: 2 + L * 0.6 }); this.damage(e, dps * dt); if (Math.random() < dt * 20) this.spark(e.x + rand(-8, 8), e.y + rand(-8, 8), 'purple'); }
        if (!tg.length) this.bolts.push({ x0: p.x, y0: nose, x1: p.x + Math.sin(p.t * 9) * 16, y1: nose - 260, w: 2 + L * 0.5, idle: true });
        if (p.shotT <= 0) { p.shotT = 0.12; if (tg.length) this.sfx('lock'); }
        break;
      }
    }
    // 副武器
    if (S.id === 'falcon' && p.subT <= 0) {
      p.subT = [0.9, 0.8, 0.7, 0.6, 0.52, 0.45][L - 1];
      for (const sd of [-1, 1]) this.pb.push({ k: 'rocket', x: p.x + sd * 18, y: p.y + 2, vx: 0, vy: -140, sp: 140, dmg: 6 * m, r: 6, rot: 0, t: 0, splash: 3 * m });
    } else if (S.id === 'dragon' && p.subT <= 0) {
      p.subT = 0.13;
      for (const [ox, oy] of p.opts) { this.pb.push({ k: 'shot', spr: 'opt', x: ox, y: oy - 12, vx: 0, vy: -950, dmg: (0.55 + L * 0.08) * m, r: 4, rot: 0 }); if (L >= 4) for (const a of [-0.12, 0.12]) this.pb.push({ k: 'shot', spr: 'opt', x: ox, y: oy - 12, vx: Math.sin(a) * 950, vy: -Math.cos(a) * 950, dmg: 0.45 * m, r: 4, rot: a }); }
    } else if (S.id === 'titan' && p.subT <= 0) {
      p.subT = [0.5, 0.46, 0.42, 0.4, 0.37, 0.34][L - 1];
      const angs = L >= 4 ? [0.12, 0.3] : [0.14];
      for (const sd of [-1, 1]) for (const a0 of angs) { const a = -PI / 2 + sd * a0; this.pb.push({ k: 'shell', spr: 'shell', x: p.x + sd * 22, y: p.y - 14, vx: Math.cos(a) * 720, vy: Math.sin(a) * 720, dmg: 2.4 * m, r: 5, rot: 0 }); }
    }
  }

  // 光束射线检测：命中最近的敌人为止
  beam(x0, y0, ang, w, dps, dt, col) {
    const dx = Math.cos(ang), dy = Math.sin(ang);
    let best = null, bt = 1600;
    for (const e of this.enemies) {
      if (!e.alive || e.t < 0 || e.y < -e.hh) continue;
      const rects = e.hitRects || [[0, 0, e.hw, e.hh]];
      for (const [ox, oy, hw, hh] of rects) {
        const cx = e.x + ox - x0, cy = e.y + oy - y0;
        const t = cx * dx + cy * dy;
        if (t <= 0 || t >= bt) continue;
        const perp = Math.abs(cx * dy - cy * dx);
        const ext = Math.abs(dy) > 0.9 ? hw : Math.max(hw, hh);
        if (perp < ext + w * 0.5) { bt = Math.max(0, t - (Math.abs(dy) > 0.9 ? hh * 0.8 : 0)); best = e; }
      }
    }
    if (best) { if (!best.inv) this.damage(best, dps * dt); if (Math.random() < dt * 25) this.spark(x0 + dx * bt + rand(-w / 2, w / 2), y0 + dy * bt, 'cyan'); }
    this.beams.push({ x0, y0, ang, w, len: bt, hit: !!best, col });
  }

  updateEnemies(dt) {
    const p = this.player;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      e.t += dt;
      if (e.t < 0) continue;
      e.flash = Math.max(0, e.flash - dt);
      if (e.parent) {
        const par = e.parent;
        if (!par.alive) { e.alive = false; continue; }
        if (par.partPos) { const [px, py] = par.partPos(e); e.x = par.x + px; e.y = par.y + py; }
        else { e.x = par.x + e.ox; e.y = par.y + e.oy; }
        e.inv = par.inv && !par.dying ? true : false;
        if (par.dying) continue;
      }
      if (e.dying) continue;
      e.ai(e, this, dt);
      // 进入屏幕判定与离屏回收
      const m = Math.max(e.hw, e.hh) + 30;
      const on = e.x > -m && e.x < this.W + m && e.y > -m && e.y < this.H + m;
      if (on && e.y > -e.hh * 0.5) e.entered = true;
      if (!e.boss && !e.parent && e.entered && !on) e.alive = false;
      if (!e.boss && !e.parent && (e.y > this.H + 400 || e.t > 60)) e.alive = false;
      // 机体碰撞
      if (p.alive && p.inv <= 0 && !e.boss && !e.parent && !e.ground && e.layer === 1 && (e.bodyHit || !e.big) && !e.inv) {
        if (Math.abs(p.x - e.x) < e.hw * 0.55 + 3 && Math.abs(p.y - e.y) < e.hh * 0.55 + 3) { this.playerDie('body:' + e.kind); this.damage(e, 30); }
      }
      if (e.hp < e.maxHp * 0.4 && (e.big || e.boss) && Math.random() < dt * 6) this.fxAdd({ k: 'smoke', x: e.x + rand(-e.hw, e.hw) * 0.6, y: e.y + rand(-e.hh, e.hh) * 0.6, vx: 0, vy: this.scrollSpeed + 30, life: 1, size: 12, grow: 1.6, rot: 0 });
    }
    // 定期清理
    if (this.enemies.length > 60 || Math.random() < 0.05) this.enemies = this.enemies.filter((e) => e.alive);
  }

  updateBullets(dt) {
    const W = this.W, H = this.H, p = this.player;
    // 玩家子弹
    const pb = this.pb;
    for (let i = pb.length - 1; i >= 0; i--) {
      const b = pb[i];
      if (b.k === 'missile') {
        b.t += dt;
        if (!b.target || !b.target.alive || b.target.inv) {
          b.target = null; let bd = 1e12;
          for (const e of this.enemies) { if (!e.alive || e.t < 0 || e.inv || e.y < -10 || e.y > H) continue; const d = (e.x - b.x) ** 2 + (e.y - b.y) ** 2; if (d < bd) { bd = d; b.target = e; } }
        }
        b.sp = Math.min(760, b.sp + 900 * dt);
        let a = Math.atan2(b.vy, b.vx);
        if (b.target && b.t > 0.1) { const want = Math.atan2(b.target.y - b.y, b.target.x - b.x); let d = ((want - a + PI) % TAU + TAU) % TAU - PI; a += clamp(d, -9 * dt, 9 * dt); }
        else a += clamp((((-PI / 2 - a + PI) % TAU + TAU) % TAU - PI), -3 * dt, 3 * dt);
        b.vx = Math.cos(a) * b.sp; b.vy = Math.sin(a) * b.sp; b.rot = a + PI / 2;
        if (Math.random() < dt * 30) this.fxAdd({ k: 'glow', spr: 'green', x: b.x - b.vx * 0.012, y: b.y - b.vy * 0.012, vx: 0, vy: 0, life: 0.2, size: 9 });
        if (b.t > 2.6) { pb.splice(i, 1); continue; }
      } else if (b.k === 'rocket') {
        b.t += dt; b.sp = Math.min(900, b.sp + 1500 * dt); b.vy = -b.sp;
        if (Math.random() < dt * 40) this.fxAdd({ k: 'glow', spr: 'orange', x: b.x, y: b.y + 14, vx: 0, vy: 60, life: 0.18, size: 10 });
      }
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.y < -40 || b.y > H + 40 || b.x < -40 || b.x > W + 40) { pb.splice(i, 1); continue; }
      for (let j = this.enemies.length - 1; j >= 0; j--) {
        const e = this.enemies[j];
        if (!e.alive || e.t < 0 || e.dying || e.y < -e.hh + 4) continue;
        if (this.hitTest(e, b.x, b.y, b.r)) {
          if (e.inv) { this.spark(b.x, b.y, 'white'); }
          else {
            this.damage(e, b.dmg);
            this.spark(b.x, b.y - 4, b.k === 'missile' ? 'green' : b.k === 'shell' ? 'purple' : 'gold');
            this.sfx('hit');
            if (b.splash) { this.explode(b.x, b.y, 0.6); for (const o of this.enemies) if (o !== e && o.alive && !o.inv && o.t >= 0 && Math.abs(o.x - b.x) < 36 + o.hw && Math.abs(o.y - b.y) < 36 + o.hh) this.damage(o, b.splash); }
            if (b.k === 'missile') this.fxAdd({ k: 'glow', spr: 'green', x: b.x, y: b.y, vx: 0, vy: 0, life: 0.2, size: 26 });
          }
          pb.splice(i, 1);
          break;
        }
      }
    }
    // 敌方子弹
    const eb = this.eb;
    const pr = this.ship.hit;
    const canHit = p.alive && p.inv <= 0 && this.state !== 'clear';
    for (let i = eb.length - 1; i >= 0; i--) {
      const b = eb[i], o = b.o;
      b.t += dt;
      if (o.acc) { const s = Math.hypot(b.vx, b.vy), ns = clamp(s + o.acc * dt, 30, 420); b.vx *= ns / s; b.vy *= ns / s; }
      if (o.curve) { const c = Math.cos(o.curve * dt), s = Math.sin(o.curve * dt); const vx = b.vx * c - b.vy * s; b.vy = b.vx * s + b.vy * c; b.vx = vx; }
      b.bx += b.vx * dt; b.by += b.vy * dt;
      if (o.wave) { const off = o.wave.amp * Math.sin(b.t * o.wave.f + (o.wave.ph || 0)); b.x = b.bx + b.px * off; b.y = b.by + b.py * off; }
      else { b.x = b.bx; b.y = b.by; }
      if (o.split && b.t >= o.split.t) {
        eb.splice(i, 1);
        const s = o.split;
        const off = Math.atan2(p.y - b.y, p.x - b.x);
        for (let k = 0; k < s.n; k++) this.shoot(b.x, b.y, off + (k * TAU) / s.n, s.spd / this.bs, s.type, s.wave ? { wave: s.wave } : {});
        this.fxAdd({ k: 'glow', spr: 'red', x: b.x, y: b.y, vx: 0, vy: 0, life: 0.2, size: 30 });
        continue;
      }
      if (b.x < -30 || b.x > W + 30 || b.y < -40 || b.y > H + 30 || b.t > 14) { eb.splice(i, 1); continue; }
      if (canHit) {
        const dx = b.x - p.x, dy = b.y - p.y, rr = b.r + pr;
        if (dx * dx + dy * dy < rr * rr) { eb.splice(i, 1); this.playerDie('bullet:' + b.type); break; }
      }
    }
  }

  updateLasers(dt) {
    const p = this.player;
    for (let i = this.lasers.length - 1; i >= 0; i--) {
      const L = this.lasers[i];
      L.t += dt;
      if (L.owner) {
        if (!L.owner.alive || L.owner.dying) { this.lasers.splice(i, 1); continue; }
        L.x = L.owner.x + L.ox; L.y = L.owner.y + L.oy;
      }
      const firing = L.t > L.warn;
      if (firing) {
        if (!L.fired) { L.fired = true; this.sfx('elaser'); this.shake(3); }
        L.ang += L.sweep * dt;
      }
      if (L.t > L.warn + L.dur) { this.lasers.splice(i, 1); continue; }
      if (firing && L.t > L.warn + 0.08 && L.t < L.warn + L.dur - 0.1 && p.alive && p.inv <= 0) {
        const dx = p.x - L.x, dy = p.y - L.y, cx = Math.cos(L.ang), cy = Math.sin(L.ang);
        const t = dx * cx + dy * cy;
        if (t > 0 && Math.abs(dx * cy - dy * cx) < L.w * 0.38 + this.ship.hit) { this.playerDie('laser'); break; }
      }
    }
  }

  updateItems(dt) {
    const p = this.player, W = this.W, H = this.H;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.t += dt;
      if (it.kind === 'medal') { it.vy = Math.min(90, it.vy + 120 * dt); }
      else {
        // 在屏幕内来回飘荡约 10 秒
        it.vx += Math.sin(it.t * 1.7 + i) * 18 * dt;
        const sp = Math.hypot(it.vx, it.vy); if (sp > 110) { it.vx *= 110 / sp; it.vy *= 110 / sp; }
        if (it.x < 22 && it.vx < 0) it.vx = -it.vx; if (it.x > W - 22 && it.vx > 0) it.vx = -it.vx;
        if (it.y < 70 && it.vy < 0) it.vy = -it.vy; if (it.y > H - 60 && it.vy > 0) it.vy = -it.vy;
      }
      if (this.state === 'clear' && p.alive) { const a = Math.atan2(p.y - it.y, p.x - it.x); it.vx = Math.cos(a) * 500; it.vy = Math.sin(a) * 500; }
      it.x += it.vx * dt; it.y += it.vy * dt;
      if (it.t > it.life || it.y > H + 30) { this.items.splice(i, 1); continue; }
      if (p.alive && Math.abs(it.x - p.x) < 28 && Math.abs(it.y - p.y) < 32) { this.pickup(it); this.items.splice(i, 1); }
    }
  }
  pickup(it) {
    const p = this.player;
    if (it.kind === 'weapon') {
      const C = WEAPON_COLORS[it.color];
      if (it.color === p.color) {
        if (p.level < MAXLV) { p.level++; this.text(p.x, p.y - 50, p.level === MAXLV ? 'MAX POWER!' : 'POWER UP', C.light, 16); this.sfx('power'); }
        else { this.score += 10000; this.text(p.x, p.y - 50, '10000', C.light, 16); this.sfx('pickup'); }
      } else {
        p.color = it.color;
        this.text(p.x, p.y - 50, WEAPON_NAMES[it.color], C.light, 16); this.sfx('power');
      }
      for (let k = 0; k < 10; k++) { const a = (k * TAU) / 10; this.fxAdd({ k: 'glow', spr: it.color === 'gold' ? 'gold' : it.color, x: p.x, y: p.y, vx: Math.cos(a) * 160, vy: Math.sin(a) * 160, life: 0.35, size: 14, drag: 3 }); }
      this.score += 500;
    } else if (it.kind === 'bomb') {
      if (p.bombs < 7) p.bombs++; else this.score += 5000;
      this.text(p.x, p.y - 50, 'BOMB +1', '#ffb080', 15); this.sfx('pickup');
    } else if (it.kind === 'medal') {
      const v = 1000 + this.stageIdx * 500; this.score += v; this.text(it.x, it.y - 10, String(v), '#ffe070', 12); this.sfx('medal');
    } else if (it.kind === 'oneup') {
      p.lives++; this.text(p.x, p.y - 50, '1UP!', '#8fffb0', 18); this.sfx('oneup');
    }
  }

  updateBomb(dt) {
    const B = this.bombFx; if (!B) return;
    B.t += dt;
    const m = this.ship.dmg;
    this.eb.length = 0; this.lasers.length = 0;
    const onScreen = (e) => e.alive && e.t >= 0 && e.y > -e.hh && e.y < this.H + e.hh && e.x > -e.hw && e.x < this.W + e.hw;
    const bossK = (e) => (e.boss || e.parent || e.mid ? 0.35 : 1);
    if (B.type === 'falcon') {
      if (tick(B, 'tk', 0.1, dt)) for (const e of this.enemies) if (onScreen(e)) this.damage(e, 28 * m * bossK(e));
      if (B.t < 1.4 && tick(B, 'ex', 0.07, dt)) { const a = rand(0, TAU), r = B.t * 300; this.explode(B.x + Math.cos(a) * r, B.y + Math.sin(a) * r * 0.8, 1.6); }
    } else if (B.type === 'dragon') {
      if (tick(B, 'tk', 0.12, dt) && B.t < 1.9) {
        const tg = this.enemies.filter(onScreen);
        const e = tg.length ? pick(tg) : null;
        const x = e ? e.x : rand(40, this.W - 40), y = e ? e.y : rand(80, this.H * 0.6);
        B.bolts.push({ x, y, t: 0, seed: Math.random() * 1000 });
        this.explode(x, y, 1.4); this.shake(6);
        for (const o of this.enemies) if (onScreen(o) && Math.hypot(o.x - x, o.y - y) < 90 + o.hw) this.damage(o, 48 * m * bossK(o));
        this.sfx('boomS');
      }
      if (tick(B, 'tk2', 0.2, dt)) for (const e of this.enemies) if (onScreen(e)) this.damage(e, 6 * m * bossK(e));
      for (const b of B.bolts) b.t += dt;
    } else {
      B.x = this.player.x;
      const w = 150;
      if (tick(B, 'tk', 0.1, dt)) for (const e of this.enemies) if (onScreen(e)) { const inBeam = Math.abs(e.x - B.x) < w / 2 + e.hw && e.y < this.player.y; this.damage(e, (inBeam ? 30 : 5) * m * bossK(e)); if (inBeam && Math.random() < 0.5) this.explode(e.x + rand(-20, 20), e.y + rand(-20, 20), 0.8); }
      this.shake(3);
    }
    if (B.t > B.dur) this.bombFx = null;
  }

  updateFx(dt) {
    const fx = this.fx;
    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i];
      f.life -= dt; f.age = (f.age || 0) + dt;
      if (f.life <= 0) { fx[i] = fx[fx.length - 1]; fx.pop(); continue; }
      if (f.drag) { const k = Math.max(0, 1 - f.drag * dt); f.vx *= k; f.vy *= k; }
      f.x += f.vx * dt; f.y += f.vy * dt;
      if (f.grow) f.size += f.size * f.grow * dt;
      if (f.vr) f.rot += f.vr * dt;
    }
    for (let i = this.texts.length - 1; i >= 0; i--) { const t = this.texts[i]; t.life -= dt; t.y -= 40 * dt; if (t.life <= 0) this.texts.splice(i, 1); }
  }

  // ---------- 绘制 ----------
  draw(ctx) {
    const W = this.W, H = this.H;
    ctx.save();
    if (this.shakeV > 0) ctx.translate(rand(-1, 1) * this.shakeV, rand(-1, 1) * this.shakeV);
    this.bg.draw(ctx, H);
    // 地面单位
    for (const e of this.enemies) if (e.alive && e.t >= 0 && e.layer === 0) this.drawEnemy(ctx, e);
    // 尾迹（水面）
    for (const f of this.fx) if (f.k === 'wake') { ctx.globalAlpha = Math.min(1, f.life) * 0.5; ctx.fillStyle = '#e8f6ff'; ctx.beginPath(); ctx.arc(f.x, f.y, f.size, 0, TAU); ctx.fill(); }
    ctx.globalAlpha = 1;
    // 空中单位投影
    if (this.bg.shadow) {
      ctx.globalAlpha = 0.28;
      for (const e of this.enemies) {
        if (!e.alive || e.t < 0 || e.layer === 0 || e.shadow === false || e.parent) continue;
        const sp = ART.enemy[e.spr + '_s']; if (!sp) continue;
        this.drawSprite(ctx, sp, e.x + 22 + e.hw * 0.15, e.y + 36, e.spr === 'boss4' ? e.spinA : e.rot, 0.8 * (e.sc || 1));
      }
      const p = this.player;
      if (p.alive) this.drawSprite(ctx, ART.ships[this.ship.id].shadow, p.x + 26, p.y + 44, 0, 0.7);
      ctx.globalAlpha = 1;
    }
    // 空中单位
    for (const e of this.enemies) if (e.alive && e.t >= 0 && e.layer >= 1) this.drawEnemy(ctx, e);
    // 烟雾
    for (const f of this.fx) if (f.k === 'smoke') { ctx.globalAlpha = Math.min(1, f.life * 1.2) * (f.light ? 0.5 : 0.8); const sp = f.light ? ART.smokeL : ART.smoke; ctx.drawImage(sp.c, f.x - f.size, f.y - f.size, f.size * 2, f.size * 2); }
    ctx.globalAlpha = 1;
    this.bg.drawOverlay(ctx);
    // 玩家子弹
    ctx.globalCompositeOperation = 'lighter';
    this.drawBeams(ctx);
    this.drawBolts(ctx);
    ctx.globalCompositeOperation = 'source-over';
    for (const b of this.pb) {
      if (b.k === 'missile') this.drawSprite(ctx, ART.pmissile, b.x, b.y, b.rot, 1);
      else if (b.k === 'rocket') { this.drawSprite(ctx, ART.rocket, b.x, b.y, 0, 1); ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(ART.flame.c, b.x - 3, b.y + 10, 6, 18 * Math.min(1, b.t * 3)); ctx.globalCompositeOperation = 'source-over'; }
    }
    ctx.globalCompositeOperation = 'lighter';
    for (const b of this.pb) {
      if (b.spr) { const sp = ART.pb[b.spr]; if (b.rot) this.drawSprite(ctx, sp, b.x, b.y, b.rot, 1); else ctx.drawImage(sp.c, b.x - sp.w / 2, b.y - sp.h / 2, sp.w, sp.h); }
    }
    ctx.globalCompositeOperation = 'source-over';
    this.drawPlayer(ctx);
    // 爆炸与光效
    for (const f of this.fx) if (f.k === 'debris') { ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.rot); ctx.fillStyle = '#2a2622'; ctx.fillRect(-f.size, -f.size * 0.6, f.size * 2, f.size * 1.2); ctx.restore(); }
    ctx.globalCompositeOperation = 'lighter';
    for (const f of this.fx) {
      if (f.k === 'glow') { const a = Math.min(1, f.life * 4); ctx.globalAlpha = a; const sp = ART.glow[f.spr]; ctx.drawImage(sp.c, f.x - f.size, f.y - f.size, f.size * 2, f.size * 2); }
      else if (f.k === 'spark') { ctx.globalAlpha = Math.min(1, f.life * 5); ctx.strokeStyle = '#ffe9a0'; ctx.lineWidth = f.size; ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x - f.vx * 0.03, f.y - f.vy * 0.03); ctx.stroke(); }
      else if (f.k === 'ring') { const r = f.size + f.grow2 * (1 - f.life / 0.45); ctx.globalAlpha = f.life / 0.45; ctx.strokeStyle = '#ffd7a0'; ctx.lineWidth = 4 * (f.life / 0.45) + 1; ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, TAU); ctx.stroke(); }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    this.drawBombFx(ctx);
    // 敌方激光
    this.drawLasers(ctx);
    // 敌方子弹
    for (const b of this.eb) {
      const sp = ART.eb[b.type] || ART.eb.o;
      if (b.type === 'rice' || b.type === 'riceB') this.drawSprite(ctx, sp, b.x, b.y, Math.atan2(b.vy, b.vx) + PI / 2, 1);
      else ctx.drawImage(sp.c, b.x - sp.w / 2, b.y - sp.h / 2, sp.w, sp.h);
    }
    // 道具
    this.drawItems(ctx);
    // 飘字
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const t of this.texts) {
      ctx.globalAlpha = Math.min(1, t.life * 2);
      ctx.font = `900 ${t.size}px Orbitron, "PingFang SC", "Microsoft YaHei", "WenQuanYi Zen Hei", sans-serif`;
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.strokeText(t.s, t.x, t.y); ctx.fillStyle = t.col; ctx.fillText(t.s, t.x, t.y);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    if (this.flash > 0) { ctx.fillStyle = `rgba(255,250,235,${Math.min(0.85, this.flash)})`; ctx.fillRect(0, 0, W, H); }
    if (!this.demo) drawHUD(ctx, this);
  }

  drawSprite(ctx, sp, x, y, rot, sc = 1) {
    const w = sp.w * sc, h = sp.h * sc;
    if (!rot) { ctx.drawImage(sp.c, x - w / 2, y - h / 2, w, h); return; }
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.drawImage(sp.c, -w / 2, -h / 2, w, h); ctx.restore();
  }

  drawEnemy(ctx, e) {
    const sp = ART.enemy[e.spr];
    const rot = e.spr === 'boss4' ? e.spinA : e.rot;
    const sc = e.sc || 1;
    if (e.parent && e.tur !== undefined) {
      // 炮塔：底座 + 旋转炮管
      this.drawSprite(ctx, sp, e.x, e.y, e.tur + PI / 2, sc);
    } else if (sp) this.drawSprite(ctx, sp, e.x, e.y, rot, sc);
    if (e.tspr) this.drawSprite(ctx, ART.enemy[e.tspr], e.x, e.y, e.tur + PI / 2, 1);
    if (e.rotor) { ctx.globalAlpha = 0.9; this.drawSprite(ctx, ART.rotor, e.x, e.y + 0, e.t * 30, 1); ctx.globalAlpha = 1; }
    if (e.kind === 'boss4') {
      const pulse = 0.7 + Math.sin(e.t * 6) * 0.3;
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = pulse; this.drawSprite(ctx, ART.enemy.boss4core, e.x, e.y, 0, (1 + e.phase * 0.2) * e.sc); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
    if (e.kind === 'boss5' || e.kind === 'boss1' || e.kind === 'boss2') {
      const pulse = 0.6 + Math.sin(e.t * 5) * 0.3;
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = pulse;
      const oy = (e.kind === 'boss5' ? 20 : e.kind === 'boss2' ? -5 : 0) * (e.sc || 1);
      this.drawSprite(ctx, ART.enemy.core, e.x, e.y + oy, 0, (e.kind === 'boss5' ? 1 + e.phase * 0.25 : 0.7) * (e.sc || 1));
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
    if (e.big || e.boss) {
      // 引擎尾焰
      if (e.kind === 'bomber' || e.kind === 'cruiser' || e.kind === 'boss2' || e.kind === 'boss5' || e.kind === 'gunship' || e.kind === 'carrier') {
        const f = 0.8 + Math.random() * 0.3;
        ctx.globalCompositeOperation = 'lighter';
        const pts = { bomber: [[-18, -44], [18, -44], [-32, -40], [32, -40]], cruiser: [[-60, -52], [60, -52]], boss2: [[-52, -40], [52, -40], [-80, -35], [80, -35]], boss5: [[-40, -110], [40, -110], [-80, -100], [80, -100], [-120, -92], [120, -92]], gunship: [[-5, -38], [5, -38]], carrier: [[-16, -20], [16, -20], [-28, -20], [28, -20]] }[e.kind];
        const flip = e.kind === 'bomber' || e.kind === 'gunship' || e.kind === 'carrier';
        for (const [px, py] of pts) {
          const ks = e.sc || 1;
          let x = px * ks, y = py * ks;
          if (flip) { const c = Math.cos(e.rot), s = Math.sin(e.rot); const lx = px, ly = -py; x = lx * c - ly * s; y = lx * s + ly * c; this.drawSprite(ctx, ART.flame, e.x + x, e.y + y, e.rot + PI, 0.55 * f); }
          else { ctx.save(); ctx.translate(e.x + x, e.y + y); ctx.rotate(PI); ctx.drawImage(ART.flame.c, -5, -2, 10, 30 * f); ctx.restore(); }
        }
        ctx.globalCompositeOperation = 'source-over';
      }
    }
    if (e.flash > 0 && sp) {
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.55;
      if (e.parent && e.tur !== undefined) this.drawSprite(ctx, sp, e.x, e.y, e.tur + PI / 2, sc); else this.drawSprite(ctx, sp, e.x, e.y, rot, sc);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
  }

  drawPlayer(ctx) {
    const p = this.player;
    if (!p.alive) return;
    if (p.inv > 0 && p.enterT <= 0 && Math.floor(p.t * 16) % 2 === 0 && !this.bombFx) ctx.globalAlpha = 0.45;
    const S = ART.ships[this.ship.id];
    const fi = clamp(Math.round(p.bank * 2) + 2, 0, 4);
    const sp = S.frames[fi];
    const fl = ART[this.ship.flame];
    // 尾焰
    ctx.globalCompositeOperation = 'lighter';
    const boost = clamp(-p.vy / 300, -0.4, 0.6);
    for (const e of S.spec.engines) for (const sx of [-1, 1]) {
      const kx = sx * (sx * p.bank > 0 ? 1 - 0.32 * Math.abs(p.bank) : 1 - 0.1 * Math.abs(p.bank));
      const f = (0.9 + Math.random() * 0.25 + boost) * (1 + 0.1 * Math.sin(p.t * 50));
      const w = e[2] * 3.4, h = 34 * f;
      ctx.drawImage(fl.c, p.x + e[0] * kx - w / 2, p.y + e[1] + e[2] * 0.6, w, h);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(sp.c, p.x - sp.w / 2, p.y - sp.h / 2, sp.w, sp.h);
    // 僚机
    if (this.ship.id === 'dragon') for (const [ox, oy] of p.opts) {
      ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(ART.bflame.c, ox - 4, oy + 8, 8, 18 + Math.random() * 6); ctx.globalCompositeOperation = 'source-over';
      this.drawSprite(ctx, ART.option, ox, oy, 0, 1);
    }
    // 判定点
    ctx.globalCompositeOperation = 'lighter';
    const pulse = 0.6 + Math.sin(p.t * 10) * 0.3;
    ctx.globalAlpha = pulse;
    ctx.drawImage(ART.glow.pink.c, p.x - 7, p.y - 7, 14, 14);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    if (p.inv > 0 && p.enterT <= 0) {
      ctx.strokeStyle = `rgba(120,220,255,${0.35 + 0.2 * Math.sin(p.t * 12)})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, p.y, 38, 0, TAU); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  drawBeams(ctx) {
    const t = this.player.t;
    for (const b of this.beams) {
      ctx.save(); ctx.translate(b.x0, b.y0); ctx.rotate(b.ang + PI / 2);
      const L = b.len, w = b.w * (0.92 + Math.sin(t * 60) * 0.08);
      let g = ctx.createLinearGradient(-w, 0, w, 0);
      g.addColorStop(0, 'rgba(0,80,255,0)'); g.addColorStop(0.3, 'rgba(40,140,255,.55)'); g.addColorStop(0.5, 'rgba(160,230,255,.9)'); g.addColorStop(0.7, 'rgba(40,140,255,.55)'); g.addColorStop(1, 'rgba(0,80,255,0)');
      ctx.fillStyle = g; ctx.fillRect(-w, -L, w * 2, L);
      g = ctx.createLinearGradient(-w * 0.3, 0, w * 0.3, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.fillRect(-w * 0.3, -L, w * 0.6, L);
      // 能量环
      ctx.strokeStyle = 'rgba(150,220,255,.6)'; ctx.lineWidth = 2;
      for (let y = -((t * 900) % 60); y > -L; y -= 60) { ctx.beginPath(); ctx.ellipse(0, y, w * 0.8, 3, 0, 0, TAU); ctx.stroke(); }
      ctx.drawImage(ART.glow.cyan.c, -w * 1.6, -w * 1.6, w * 3.2, w * 3.2);
      if (b.hit) ctx.drawImage(ART.glow.white.c, -w * 2, -L - w * 2, w * 4, w * 4);
      ctx.restore();
    }
  }

  drawBolts(ctx) {
    const t = this.player.t;
    for (const b of this.bolts) {
      // 锁链闪电：贝塞尔主干 + 随机抖动折线
      const mx = (b.x0 + b.x1) / 2 + Math.sin(t * 7) * 30, my = Math.min(b.y0, b.y1) - 40;
      const pts = [];
      for (let i = 0; i <= 14; i++) {
        const u = i / 14, a = (1 - u) * (1 - u), bq = 2 * (1 - u) * u, c = u * u;
        const x = a * b.x0 + bq * mx + c * b.x1, y = a * b.y0 + bq * (b.idle ? (b.y0 + b.y1) / 2 : my) + c * b.y1;
        const j = i === 0 || i === 14 ? 0 : 7;
        pts.push([x + rand(-j, j), y + rand(-j, j)]);
      }
      for (const [lw, col] of [[b.w * 5, 'rgba(150,60,255,.25)'], [b.w * 2.2, 'rgba(190,110,255,.7)'], [b.w * 0.8, 'rgba(255,240,255,1)']]) {
        ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath();
        pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke();
      }
      ctx.drawImage(ART.glow.purple.c, b.x0 - 18, b.y0 - 18, 36, 36);
      if (!b.idle) ctx.drawImage(ART.glow.purple.c, b.x1 - 26, b.y1 - 26, 52, 52);
    }
  }

  drawLasers(ctx) {
    for (const L of this.lasers) {
      ctx.save(); ctx.translate(L.x, L.y); ctx.rotate(L.ang - PI / 2);
      if (L.t < L.warn) {
        const k = L.t / L.warn;
        ctx.globalAlpha = 0.35 + 0.5 * (Math.floor(L.t * 14) % 2);
        ctx.strokeStyle = '#ff3a6a'; ctx.lineWidth = 1 + k * 2; ctx.setLineDash([14, 8]);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, L.len); ctx.stroke(); ctx.setLineDash([]);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'lighter';
        const r = 8 + k * 26;
        ctx.drawImage(ART.glow.pink.c, -r, -r, r * 2, r * 2);
      } else {
        const lt = L.t - L.warn;
        const k = Math.min(1, lt / 0.08) * Math.min(1, (L.dur - lt) / 0.15);
        const w = L.w * k * (0.9 + Math.random() * 0.2);
        ctx.globalCompositeOperation = 'lighter';
        let g = ctx.createLinearGradient(-w, 0, w, 0);
        g.addColorStop(0, 'rgba(255,0,90,0)'); g.addColorStop(0.25, 'rgba(255,40,120,.6)'); g.addColorStop(0.5, 'rgba(255,200,230,1)'); g.addColorStop(0.75, 'rgba(255,40,120,.6)'); g.addColorStop(1, 'rgba(255,0,90,0)');
        ctx.fillStyle = g; ctx.fillRect(-w, 0, w * 2, L.len);
        ctx.fillStyle = 'rgba(255,255,255,.95)'; ctx.fillRect(-w * 0.18, 0, w * 0.36, L.len);
        const r = w * 2.2;
        ctx.drawImage(ART.glow.pink.c, -r, -r, r * 2, r * 2);
      }
      ctx.restore();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  drawItems(ctx) {
    for (const it of this.items) {
      if (it.life - it.t < 3 && Math.floor(it.t * 10) % 2 === 0) continue;
      const sp = it.kind === 'weapon' ? ART.items[it.color] : ART.items[it.kind];
      if (it.kind === 'weapon') {
        const C = WEAPON_COLORS[it.color];
        ctx.globalCompositeOperation = 'lighter';
        const r = 26 + Math.sin(it.t * 6) * 4;
        ctx.globalAlpha = 0.7; ctx.drawImage(ART.glow[it.color === 'gold' ? 'gold' : it.color].c, it.x - r, it.y - r, r * 2, r * 2);
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = C.light; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.6;
        ctx.beginPath(); ctx.arc(it.x, it.y, 20 + ((it.t * 30) % 12), 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
        const s = 1 + Math.sin(it.t * 5) * 0.06;
        this.drawSprite(ctx, sp, it.x, it.y, Math.sin(it.t * 2) * 0.25, s);
      } else if (it.kind === 'medal') {
        const sx = Math.abs(Math.cos(it.t * 5));
        ctx.save(); ctx.translate(it.x, it.y); ctx.scale(Math.max(0.15, sx), 1); ctx.drawImage(sp.c, -sp.w / 2, -sp.h / 2, sp.w, sp.h); ctx.restore();
      } else this.drawSprite(ctx, sp, it.x, it.y, 0, 1 + Math.sin(it.t * 5) * 0.06);
    }
  }

  drawBombFx(ctx) {
    const B = this.bombFx; if (!B) return;
    const t = B.t;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    if (B.type === 'falcon') {
      const r = 40 + t * 520, a = Math.max(0, 1 - t / B.dur);
      const g = ctx.createRadialGradient(B.x, B.y, r * 0.2, B.x, B.y, r);
      g.addColorStop(0, `rgba(255,255,220,${0.5 * a})`); g.addColorStop(0.6, `rgba(255,150,40,${0.45 * a})`); g.addColorStop(1, 'rgba(255,60,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(B.x, B.y, r, 0, TAU); ctx.fill();
      ctx.strokeStyle = `rgba(255,230,180,${a})`; ctx.lineWidth = 10 * a + 2; ctx.beginPath(); ctx.arc(B.x, B.y, r * 0.9, 0, TAU); ctx.stroke();
      ctx.lineWidth = 4 * a + 1; ctx.beginPath(); ctx.arc(B.x, B.y, r * 0.6, 0, TAU); ctx.stroke();
    } else if (B.type === 'dragon') {
      ctx.fillStyle = `rgba(40,120,255,${0.18 * Math.max(0, 1 - t / B.dur)})`; ctx.fillRect(0, 0, this.W, this.H);
      for (const b of B.bolts) {
        if (b.t > 0.35) continue;
        const a = 1 - b.t / 0.35;
        const pts = []; let x = b.x + rand(-40, 40);
        for (let y = -10; y < b.y; y += 24) { pts.push([x, y]); x += rand(-22, 22); x = lerp(x, b.x, 0.15); }
        pts.push([b.x, b.y]);
        for (const [lw, col] of [[16, `rgba(60,140,255,${0.35 * a})`], [6, `rgba(150,220,255,${0.8 * a})`], [2, `rgba(255,255,255,${a})`]]) {
          ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke();
        }
        ctx.globalAlpha = a; ctx.drawImage(ART.glow.cyan.c, b.x - 60, b.y - 60, 120, 120); ctx.globalAlpha = 1;
      }
    } else {
      const k = Math.min(1, t / 0.2) * Math.min(1, (B.dur - t) / 0.3);
      const w = 75 * k * (0.92 + Math.random() * 0.12), x = B.x, y = this.player.y - 30;
      const g = ctx.createLinearGradient(x - w, 0, x + w, 0);
      g.addColorStop(0, 'rgba(120,40,255,0)'); g.addColorStop(0.3, 'rgba(160,90,255,.6)'); g.addColorStop(0.5, 'rgba(255,240,255,1)'); g.addColorStop(0.7, 'rgba(160,90,255,.6)'); g.addColorStop(1, 'rgba(120,40,255,0)');
      ctx.fillStyle = g; ctx.fillRect(x - w, -20, w * 2, y + 20);
      ctx.drawImage(ART.glow.purple.c, x - w * 1.5, y - w * 1.5, w * 3, w * 3);
      ctx.strokeStyle = 'rgba(255,220,255,.6)'; ctx.lineWidth = 3;
      for (let yy = y - ((t * 1400) % 80); yy > 0; yy -= 80) { ctx.beginPath(); ctx.ellipse(x, yy, w * 0.9, 6, 0, 0, TAU); ctx.stroke(); }
    }
    ctx.restore();
  }
}
