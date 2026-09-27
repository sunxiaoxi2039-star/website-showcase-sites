// 抬头显示：分数、残机、炸弹、武器等级、BOSS 血条与关卡横幅
import { ART, WEAPON_COLORS } from './art.js';
import { LEVELS } from './levels.js';
import { fmtScore, fmtTime, clamp } from './util.js';

const NUM = 'Orbitron, "PingFang SC", "Microsoft YaHei", "WenQuanYi Zen Hei", sans-serif';
const CN = '"PingFang SC", "Microsoft YaHei", "Noto Sans SC", "WenQuanYi Zen Hei", sans-serif';
const WN = { blue: '贯穿激光', green: '追踪导弹', purple: '雷电锁链', gold: '雷霆散弹' };

function txt(ctx, s, x, y, font, col, align = 'left', stroke = true) {
  ctx.font = font; ctx.textAlign = align; ctx.textBaseline = 'middle';
  if (stroke) { ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.75)'; ctx.strokeText(s, x, y); }
  ctx.fillStyle = col; ctx.fillText(s, x, y);
}

export function drawHUD(ctx, G) {
  const W = G.W, H = G.H, p = G.player;
  if (!p) return;
  // 顶栏
  const g = ctx.createLinearGradient(0, 0, 0, 64);
  g.addColorStop(0, 'rgba(0,0,0,.6)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, 64);
  txt(ctx, '1P SCORE', 14, 14, `700 12px ${NUM}`, '#ffcf4a');
  txt(ctx, fmtScore(G.score), 14, 35, `900 22px ${NUM}`, '#ffffff');
  txt(ctx, 'HI-SCORE', W / 2 + 22, 14, `700 12px ${NUM}`, '#ff6a5a', 'center');
  txt(ctx, fmtScore(G.hiscore), W / 2 + 22, 35, `900 17px ${NUM}`, '#e8e8e8', 'center');
  // 武器指示
  const C = WEAPON_COLORS[p.color];
  const it = ART.items[p.color];
  ctx.drawImage(it.c, 10, 54, 30, 30);
  txt(ctx, WN[p.color], 44, 62, `700 15px ${CN}`, C.light);
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = i < p.level ? C.main : 'rgba(255,255,255,.15)';
    ctx.fillRect(44 + i * 13, 74, 11, 6);
    if (i < p.level) { ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(44 + i * 13, 74, 11, 1.5); }
  }
  if (p.level >= 6) txt(ctx, 'MAX', 124, 77, `900 11px ${NUM}`, '#fff');
  // 残机与炸弹
  const shipSp = ART.ships[G.ship.id].frames[2];
  for (let i = 0; i < Math.min(p.lives, 6); i++) ctx.drawImage(shipSp.c, 10 + i * 26, H - 66, 24, 30);
  const bsp = ART.items.bomb;
  for (let i = 0; i < Math.min(p.bombs, 7); i++) ctx.drawImage(bsp.c, 8 + i * 26, H - 34, 26, 26);
  // 关卡
  txt(ctx, `STAGE ${G.stageIdx + 1}`, W - 74, 14, `700 12px ${NUM}`, '#9fdcff', 'right');
  txt(ctx, LEVELS[G.stageIdx].name, W - 74, 35, `700 15px ${CN}`, '#dfefff', 'right');
  // BOSS / 中型舰血条
  const big = G.boss && G.boss.alive && !G.boss.dying ? G.boss : G.enemies.find((e) => e.mid && e.alive);
  if (big && big.t > 1) {
    const bw = W - 40, y = 94;
    const r = clamp(big.hp / big.maxHp, 0, 1);
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(20, y, bw, 10);
    const hg = ctx.createLinearGradient(20, 0, 20 + bw, 0);
    hg.addColorStop(0, '#ff2a2a'); hg.addColorStop(0.5, '#ff8a2a'); hg.addColorStop(1, '#ffe04a');
    ctx.fillStyle = hg; ctx.fillRect(21, y + 1, (bw - 2) * r, 8);
    ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 1; ctx.strokeRect(20.5, y + 0.5, bw - 1, 9);
    if (big.boss) for (const th of [0.33, 0.66]) { ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillRect(20 + bw * th, y, 2, 10); }
    txt(ctx, big.boss ? big.name : '大型战舰', 22, y + 22, `700 14px ${CN}`, '#ffd0c0');
    if (big.boss) txt(ctx, `PHASE ${big.phase + 1}/3`, W - 22, y + 22, `700 12px ${NUM}`, '#ffd0c0', 'right');
  }
  drawBanner(ctx, G);
}

function drawBanner(ctx, G) {
  const W = G.W, H = G.H, b = G.banner, t = b.t;
  if (b.kind === 'stage' && t < 3.6) {
    const a = Math.min(1, t * 3, (3.6 - t) * 2);
    ctx.globalAlpha = a;
    const y = H * 0.36;
    ctx.fillStyle = 'rgba(0,10,30,.45)'; ctx.fillRect(0, y - 58, W, 116);
    ctx.fillStyle = '#ffcf4a'; ctx.fillRect(0, y - 58, W * Math.min(1, t * 2), 2); ctx.fillRect(W - W * Math.min(1, t * 2), y + 56, W * Math.min(1, t * 2), 2);
    txt(ctx, `STAGE ${G.stageIdx + 1}`, W / 2, y - 22, `900 40px ${NUM}`, '#ffffff', 'center');
    txt(ctx, LEVELS[G.stageIdx].name, W / 2, y + 22, `900 26px ${CN}`, '#ffcf4a', 'center');
    txt(ctx, LEVELS[G.stageIdx].en, W / 2, y + 46, `700 11px ${NUM}`, '#9fdcff', 'center');
    ctx.globalAlpha = 1;
  } else if (b.kind === 'mid' && t < 2.4) {
    const a = Math.min(1, t * 4, (2.4 - t) * 3) * (0.6 + 0.4 * Math.abs(Math.sin(t * 8)));
    ctx.globalAlpha = a;
    txt(ctx, 'CAUTION', W / 2, H * 0.34, `900 30px ${NUM}`, '#ffcf4a', 'center');
    txt(ctx, '大型敌舰接近中', W / 2, H * 0.34 + 34, `900 18px ${CN}`, '#fff', 'center');
    ctx.globalAlpha = 1;
  } else if (b.kind === 'warning' && t < 3.8) {
    const a = Math.min(1, t * 3, (3.8 - t) * 2);
    ctx.globalAlpha = a * 0.25 * (0.5 + 0.5 * Math.sin(t * 9));
    ctx.fillStyle = '#ff0020'; ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = a;
    const y = H * 0.38;
    for (const yy of [y - 64, y + 50]) {
      ctx.save(); ctx.beginPath(); ctx.rect(0, yy, W, 14); ctx.clip();
      ctx.fillStyle = '#1a0000'; ctx.fillRect(0, yy, W, 14);
      ctx.fillStyle = '#ffcf1a';
      const off = (t * 80) % 28;
      for (let x = -28 + (yy > y ? -off : off); x < W + 28; x += 28) { ctx.beginPath(); ctx.moveTo(x, yy + 14); ctx.lineTo(x + 14, yy); ctx.lineTo(x + 24, yy); ctx.lineTo(x + 10, yy + 14); ctx.fill(); }
      ctx.restore();
    }
    ctx.fillStyle = 'rgba(40,0,0,.6)'; ctx.fillRect(0, y - 50, W, 100);
    const flick = Math.floor(t * 6) % 2 ? '#ff3040' : '#ffffff';
    txt(ctx, 'WARNING', W / 2, y - 12, `900 50px ${NUM}`, flick, 'center');
    txt(ctx, '巨型目标高速接近', W / 2, y + 30, `900 18px ${CN}`, '#ffd0d0', 'center');
    ctx.globalAlpha = 1;
  } else if (b.kind === 'clear' && G.state === 'clear') {
    const a = Math.min(1, t * 2, (7 - t) * 2);
    ctx.globalAlpha = a;
    const y = H * 0.32;
    ctx.fillStyle = 'rgba(0,10,30,.6)'; ctx.fillRect(0, y - 60, W, 230);
    txt(ctx, 'STAGE CLEAR', W / 2, y - 24, `900 38px ${NUM}`, '#ffcf4a', 'center');
    txt(ctx, `第 ${G.stageIdx + 1} 关 · ${LEVELS[G.stageIdx].name} 突破`, W / 2, y + 16, `700 17px ${CN}`, '#fff', 'center');
    const I = G.clearInfo;
    const rows = [['击坠数', String(I.kills)], ['关卡用时', fmtTime(I.time)], ['剩余炸弹奖励', String(I.bonusBomb)], ['无损通关奖励', I.bonusNoMiss ? String(I.bonusNoMiss) : '—']];
    rows.forEach((r, i) => {
      if (t < 0.8 + i * 0.35) return;
      txt(ctx, r[0], W / 2 - 150, y + 54 + i * 26, `700 15px ${CN}`, '#bfe6ff');
      txt(ctx, r[1], W / 2 + 150, y + 54 + i * 26, `900 16px ${NUM}`, '#ffffff', 'right');
    });
    ctx.globalAlpha = 1;
  }
}
