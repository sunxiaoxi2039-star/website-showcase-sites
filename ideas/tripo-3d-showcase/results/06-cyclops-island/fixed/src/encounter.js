// encounter.js — mission stages, hero / crew / Polyphemus simulation, combat timing and reset.
import * as THREE from 'three';
import { groundY, CAVE_MOUTH, GIANT_BED, JETTY_ZONE, HERO_START, SUPPLY_SPOTS } from './world.js';
import { buildHero, buildGiant, heroPose, giantPose, applyPose, makeRig } from './actors.js';

export const TUNING = {
  health: 3, stamina: 100, walk: 2.35, sprint: 4.15, giantRun: 3.4, attackRange: 3.6, windup: 1.12, slamRadius: 2.45,
  dodgeTime: .34, dodgeCost: 24, dodgeCooldown: 1.25, dodgeSpeed: 7.4, immunity: 1.15, boardTime: 11, jettyRadius: 2.7,
  sprintDrain: 25, regenMove: 13, regenRest: 26, takeRange: 1.05, waveSpeed: 5.2, waveMax: 8.5, waveWidth: .5,
  heroR: .28, crewR: .24, giantR: .72, recovery: .85, attackCooldown: .55,
};
const T = TUNING;
export const STAGES = [
  null,
  { kicker: 'The first footsteps', title: 'Follow the sandy path', text: 'Lead your crew to the cave. Keep an eye on the sleeping giant’s suspicion.' },
  { kicker: 'The shepherd’s larder', title: 'Take the supplies', text: 'Step close and press E to take each of the three stores. Any theft will wake him.' },
  { kicker: 'The wine-dark sea', title: 'Hold the jetty', text: 'Stay inside the jetty circle while the crew board. Leaving pauses the boarding.' },
];

export function createEncounter({ scene, world, nav, fx, audio }) {
  const E = { mode: 'tripo' };

  // ---------------- actors ----------------
  function makeActor(name, fig, r) {
    const root = new THREE.Group(); root.add(fig.root); scene.add(root);
    return { name, fig, rig: null, root, pos: new THREE.Vector3(), r, facing: 0, phase: Math.random() * 6, seed: Math.random() * 10, moveBlend: 0, runBlend: 0, state: 'idle', stateT: 0, hurt: 0, path: null, speedNow: 0 };
  }
  const hero = makeActor('Odysseus', buildHero(0), T.heroR);
  const crew = [1, 2, 3].map(i => makeActor('Crew ' + i, buildHero(i), T.crewR));
  crew.forEach((c, i) => { c.offset = [[-.62, -.75], [.62, -.8], [0, -1.45]][i]; c.stuck = 0; c.repath = 0; c.phase = i * 2.1; });
  const giant = makeActor('Polyphemus', buildGiant(), T.giantR);
  E.hero = hero; E.crew = crew; E.giant = giant;

  // ---------------- props: supplies and jetty zone ----------------
  const supplies = SUPPLY_SPOTS.map((s, i) => {
    const g = new THREE.Group();
    if (i === 0) { const pts = [[0, 0], [.07, .02], [.1, .12], [.07, .24], [.04, .28], [.055, .31]].map(([x, y]) => new THREE.Vector2(x, y)); g.add(new THREE.Mesh(new THREE.LatheGeometry(pts, 12), new THREE.MeshStandardMaterial({ color: '#b86a3c', roughness: .7 }))); }
    if (i === 1) { const w = new THREE.Mesh(new THREE.CylinderGeometry(.14, .14, .09, 16), new THREE.MeshStandardMaterial({ color: '#e7c872', roughness: .6 })); w.position.y = .05; g.add(w); const w2 = w.clone(); w2.position.set(.08, .14, .02); w2.scale.setScalar(.8); g.add(w2); }
    if (i === 2) { const s2 = new THREE.Mesh(new THREE.SphereGeometry(.14, 12, 10).scale(1, 1.2, .9), new THREE.MeshStandardMaterial({ color: '#8a6a44', roughness: .9 })); s2.position.y = .15; g.add(s2); }
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    const ring = new THREE.Mesh(new THREE.RingGeometry(.28, .34, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffd98a', transparent: true, opacity: .8, depthWrite: false }));
    ring.position.y = .03; g.add(ring);
    g.position.set(s.x, groundY(s.x, s.y), s.y); scene.add(g);
    return { g, ring, x: s.x, z: s.y, taken: false };
  });
  const zone = new THREE.Group(); scene.add(zone);
  zone.position.set(JETTY_ZONE.x, groundY(JETTY_ZONE.x, JETTY_ZONE.z) + .05, JETTY_ZONE.z);
  const zRing = new THREE.Mesh(new THREE.RingGeometry(T.jettyRadius - .06, T.jettyRadius, 72).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#f4ead2', transparent: true, opacity: .85, depthWrite: false, depthTest: false }));
  const zFill = new THREE.Mesh(new THREE.CircleGeometry(T.jettyRadius, 72).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#7fd6c8', transparent: true, opacity: .12, depthWrite: false, depthTest: false }));
  let zArc = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: '#ffd35a', transparent: true, opacity: .95, depthWrite: false, depthTest: false }));
  [zFill, zRing, zArc].forEach((m, i) => { m.renderOrder = 5 + i; zone.add(m); });
  let lastArc = -1;
  const setArc = k => { const q = Math.round(k * 120); if (q === lastArc) return; lastArc = q; zArc.geometry.dispose(); zArc.geometry = new THREE.RingGeometry(T.jettyRadius + .04, T.jettyRadius + .2, 72, 1, Math.PI / 2, -Math.max(.001, k) * Math.PI * 2).rotateX(-Math.PI / 2); };

  // ---------------- state ----------------
  let G;
  const deck = [[.25, .52, .9], [-.25, .52, .3], [.2, .52, -.4], [0, .52, -1.0]];
  function reset() {
    G = { stage: 1, health: T.health, stamina: T.stamina, immune: 0, dodgeT: 0, dodgeCd: 0, dodgeDir: new THREE.Vector2(), knock: new THREE.Vector2(), knockT: 0,
      suspicion: 0, taken: 0, boardT: 0, boarded: 0, inZone: false, result: null, resultT: 0, time: 0, hits: 0, dodges: 0, slams: 0, waves: 0, earlyWake: false,
      sprinting: false, clickSprint: false, message: null, messageT: 0, nearSupply: -1, events: [] };
    hero.pos.set(HERO_START.x, 0, HERO_START.y); hero.facing = Math.PI; hero.state = 'idle'; hero.stateT = 0; hero.hurt = 0; hero.path = null; hero.root.visible = true;
    crew.forEach(c => { c.pos.set(hero.pos.x + c.offset[0], 0, hero.pos.z - c.offset[1]); c.facing = Math.PI; c.state = 'idle'; c.boarded = false; c.path = null; c.hurt = 0; });
    giant.pos.set(GIANT_BED.x, 0, GIANT_BED.y); giant.facing = -2.5; giant.state = 'sleeping'; giant.stateT = 0; giant.path = null; giant.repath = 0; giant.cool = 0; giant.count = 0; giant.charged = false; giant.lock = new THREE.Vector2(); giant.moveBlend = 0;
    supplies.forEach(s => { s.taken = false; s.g.visible = true; });
    E.waves?.forEach(w => fx.endWave(w.fx)); E.waves = [];
    fx.reset(); setArc(0); zone.visible = false;
    for (const a of [hero, ...crew, giant]) { a.root.position.set(a.pos.x, groundY(a.pos.x, a.pos.z), a.pos.z); a.root.rotation.set(0, a.facing, 0); }
  }
  E.reset = reset;
  reset();

  const say = (text, dur = 2.6) => { G.message = text; G.messageT = dur; };
  const setState = (a, s) => { if (a.state !== s) { a.state = s; a.stateT = 0; } };
  const turnTo = (a, dx, dz, dt, rate = 12) => { if (Math.abs(dx) + Math.abs(dz) < 1e-4) return; const tgt = Math.atan2(dx, dz); let d = tgt - a.facing; d = Math.atan2(Math.sin(d), Math.cos(d)); a.facing += d * Math.min(1, rate * dt); };
  const dist2 = (a, x, z) => Math.hypot(a.pos.x - x, a.pos.z - z);
  const giantAwake = () => !['sleeping'].includes(giant.state);

  function wake(early) {
    if (giant.state !== 'sleeping') return;
    setState(giant, 'waking'); G.earlyWake = early; audio.roar(); fx.shake = Math.max(fx.shake, .25);
    say(early ? 'Polyphemus stirs — your noise has woken him!' : 'The theft wakes Polyphemus!', 3);
  }

  function damage(fromX, fromZ) {
    if (G.immune > 0 || G.dodgeT > 0 || G.result) return false;
    G.health--; G.hits++; G.immune = T.immunity; hero.hurt = 1;
    let dx = hero.pos.x - fromX, dz = hero.pos.z - fromZ;
    if (Math.hypot(dx, dz) < .05) { dx = hero.pos.x - giant.pos.x; dz = hero.pos.z - giant.pos.z; }   // dead-centre hit: push away from the giant
    const l = Math.hypot(dx, dz) || 1;
    G.knock.set(dx / l, dz / l); G.knockT = .26;
    fx.hurt(hero.pos.x, groundY(hero.pos.x, hero.pos.z), hero.pos.z); audio.hurt(); fx.shake = Math.max(fx.shake, .35);
    G.events.push('hurt');
    if (G.health <= 0) { G.result = 'defeated'; G.resultT = 0; setState(hero, 'fallen'); setState(giant, 'terminal'); fx.hideTelegraph(); audio.lose(); }
    return true;
  }

  // ---------------- commands from input ----------------
  E.setPath = (x, z) => { if (G.result) return false; const p = nav.findPath(hero.pos.x, hero.pos.z, x, z, hero.r); hero.path = p && p.length ? p : null; G.clickSprint = giantAwake(); return !!hero.path; };
  E.dodge = (dir) => {
    if (G.result || G.dodgeCd > 0 || G.dodgeT > 0 || G.stamina < T.dodgeCost) { if (G.stamina < T.dodgeCost && !G.result) say('Too tired to dodge', 1.2); return; }
    let dx = dir?.x || 0, dz = dir?.y || 0;
    if (Math.hypot(dx, dz) < .1) { dx = Math.sin(hero.facing); dz = Math.cos(hero.facing); }
    const l = Math.hypot(dx, dz); G.dodgeDir.set(dx / l, dz / l); G.dodgeT = T.dodgeTime; G.dodgeCd = T.dodgeCooldown; G.stamina -= T.dodgeCost; G.dodges++;
    hero.facing = Math.atan2(dx, dz); setState(hero, 'dodge'); hero.path = null; audio.whoosh();
  };
  E.take = () => {
    if (G.result || G.nearSupply < 0) return;
    const s = supplies[G.nearSupply]; s.taken = true; s.g.visible = false; G.taken++;
    fx.pickup(s.x, groundY(s.x, s.z), s.z); audio.pickup(); setState(hero, 'take');
    if (G.stage === 1) G.stage = 2;
    wake(false);
    if (G.taken === 3) { G.stage = 3; zone.visible = true; say('Supplies secured — run for the ship!', 3); }
    else say(`Supplies ${G.taken} / 3`, 1.6);
  };

  // ---------------- per-frame update ----------------
  E.update = (dt, t, input) => {
    G.time += G.result ? 0 : dt;
    G.messageT = Math.max(0, G.messageT - dt);
    G.immune = Math.max(0, G.immune - dt); G.dodgeCd = Math.max(0, G.dodgeCd - dt);
    hero.hurt = Math.max(0, hero.hurt - dt * 2.5);
    for (const a of [hero, ...crew, giant]) a.stateT += dt;

    // ----- hero -----
    let vx = 0, vz = 0, moving = false, sprint = false;
    if (G.result === 'escaped') { /* aboard */ }
    else if (G.result === 'defeated') { G.resultT += dt; if (G.resultT > 2.6) { reset(); say('The myth begins again…', 2.2); return; } }
    else if (G.dodgeT > 0) {
      G.dodgeT -= dt;
      nav.move(hero.pos, G.dodgeDir.x * T.dodgeSpeed * dt, G.dodgeDir.y * T.dodgeSpeed * dt, hero.r);
      fx.trail(hero.pos.x, groundY(hero.pos.x, hero.pos.z), hero.pos.z);
      if (G.dodgeT <= 0) { nav.clamp(hero.pos, hero.r); setState(hero, 'idle'); }
    } else if (G.knockT > 0) {
      G.knockT -= dt; nav.move(hero.pos, G.knock.x * 5.5 * dt, G.knock.y * 5.5 * dt, hero.r);
    } else if (hero.state !== 'take' || hero.stateT > .45) {
      if (hero.state === 'take') setState(hero, 'idle');
      if (input.move.lengthSq() > .01) { hero.path = null; vx = input.move.x; vz = input.move.y; moving = true; sprint = input.sprint; }
      else if (hero.path) {
        const [px, pz] = hero.path[0], dx = px - hero.pos.x, dz = pz - hero.pos.z, d = Math.hypot(dx, dz);
        if (d < .12) { hero.path.shift(); if (!hero.path.length) hero.path = null; }
        else { vx = dx / d; vz = dz / d; moving = true; sprint = input.sprint || (G.clickSprint && giantAwake()); }
      }
      if (sprint && G.stamina <= 1) sprint = false;
      if (G.sprinting && G.stamina < 12 && !input.sprint) sprint = false;
      const sp = sprint ? T.sprint : T.walk;
      if (moving) { const before = hero.pos.clone(); nav.move(hero.pos, vx * sp * dt, vz * sp * dt, hero.r); turnTo(hero, vx, vz, dt); const moved = hero.pos.distanceTo(before); hero.speedNow = dt > 0 ? moved / dt : 0; if (moved < .002 && hero.path) hero.path = null; }
      else hero.speedNow = 0;
    }
    G.sprinting = sprint && moving;
    G.stamina = Math.min(T.stamina, Math.max(0, G.stamina + (G.sprinting ? -T.sprintDrain : moving ? T.regenMove : T.regenRest) * dt * (G.dodgeT > 0 ? 0 : 1)));
    if (G.dodgeT <= 0 && G.knockT <= 0 && !G.result && hero.state !== 'take') setState(hero, 'idle');

    // ----- stage logic -----
    const dGiant = dist2(hero, giant.pos.x, giant.pos.z);
    if (!G.result) {
      if (giant.state === 'sleeping') {
        const near = Math.max(0, 6.2 - dist2(hero, GIANT_BED.x, GIANT_BED.y)) * 7.5, noise = G.sprinting && dGiant < 10 ? 22 : 0;
        G.suspicion = Math.min(100, Math.max(0, G.suspicion + (near + noise - (near + noise > 0 ? 0 : 7)) * dt));
        if (G.suspicion >= 100) wake(true);
      }
      if (G.stage === 1 && dist2(hero, CAVE_MOUTH.x, CAVE_MOUTH.y) < 2.2) { G.stage = 2; say('Inside the cave — take the stores', 2.4); }
      G.nearSupply = -1; let nearD = T.takeRange;
      supplies.forEach((s, i) => { const sd = dist2(hero, s.x, s.z); if (!s.taken && sd < nearD) { G.nearSupply = i; nearD = sd; } s.ring.material.opacity = .5 + .4 * Math.sin(t * 4 + i); s.g.rotation.y = Math.sin(t + i) * .1; });
      if (G.stage === 3) {
        G.inZone = dist2(hero, JETTY_ZONE.x, JETTY_ZONE.z) <= T.jettyRadius;
        if (G.inZone) G.boardT = Math.min(T.boardTime, G.boardT + dt);
        const want = Math.min(3, Math.floor(G.boardT / (T.boardTime / 4)));
        while (G.boarded < want) { const c = crew[G.boarded]; c.boarding = true; c.path = null; G.boarded++; say(`${c.name} is aboard`, 1.4); }
        setArc(G.boardT / T.boardTime);
        zFill.material.opacity = G.inZone ? .2 + .06 * Math.sin(t * 5) : .1;
        if (G.boardT >= T.boardTime) {
          G.result = 'escaped'; G.resultT = 0; hero.path = null; setState(giant, 'terminal'); fx.hideTelegraph();
          E.waves.forEach(w => fx.endWave(w.fx)); E.waves = []; audio.win(); say('You escaped Polyphemus!', 4);
        }
      }
    }

    // ----- giant -----
    const gs = giant.state;
    let gMoving = false;
    if (gs === 'sleeping') { if (Math.random() < dt * 1.4) fx.zzz(giant.pos.x, groundY(giant.pos.x, giant.pos.z) + 2.1, giant.pos.z); }
    else if (gs === 'waking') { if (giant.stateT > 1.6) setState(giant, 'chasing'); turnTo(giant, hero.pos.x - giant.pos.x, hero.pos.z - giant.pos.z, dt, 2); }
    else if (gs === 'chasing') {
      giant.cool = Math.max(0, giant.cool - dt);
      if (dGiant <= T.attackRange && giant.cool <= 0) {
        giant.count++; giant.charged = giant.count % 3 === 0; giant.lock.set(hero.pos.x, hero.pos.z);   // target locked at windup start
        setState(giant, 'windup'); fx.showTelegraph(giant.lock.x, giant.lock.y, T.slamRadius, giant.charged); audio.windup(giant.charged);
        if (giant.charged) say('Charged slam — watch the shockwave!', 1.6);
      } else if (dGiant > 1.4) {
        giant.repath -= dt;
        if (giant.repath <= 0) { giant.path = nav.findPath(giant.pos.x, giant.pos.z, hero.pos.x, hero.pos.z, giant.r); giant.repath = .35; }
        let tx = hero.pos.x, tz = hero.pos.z;
        if (giant.path && giant.path.length) { if (Math.hypot(giant.path[0][0] - giant.pos.x, giant.path[0][1] - giant.pos.z) < .3 && giant.path.length > 1) giant.path.shift(); [tx, tz] = giant.path[0]; }
        const dx = tx - giant.pos.x, dz = tz - giant.pos.z, d = Math.hypot(dx, dz) || 1;
        nav.move(giant.pos, dx / d * T.giantRun * dt, dz / d * T.giantRun * dt, giant.r); turnTo(giant, dx, dz, dt, 6); gMoving = true;
      }
    } else if (gs === 'windup') {
      turnTo(giant, giant.lock.x - giant.pos.x, giant.lock.y - giant.pos.z, dt, 8);
      fx.telegraphProgress(giant.stateT / T.windup, t);
      if (giant.stateT >= T.windup) {
        setState(giant, 'impact'); fx.hideTelegraph(); G.slams++;
        fx.impact(giant.lock.x, giant.lock.y, T.slamRadius, giant.charged); audio.thud(giant.charged);
        if (!G.result && dist2(hero, giant.lock.x, giant.lock.y) <= T.slamRadius + hero.r * .5) damage(giant.lock.x, giant.lock.y);
        if (giant.charged) { E.waves.push({ x: giant.lock.x, z: giant.lock.y, r: .4, hit: false, fx: fx.spawnWave(giant.lock.x, giant.lock.y) }); G.waves++; }
      }
    } else if (gs === 'impact') { if (giant.stateT > .22) setState(giant, 'recovery'); }
    else if (gs === 'recovery') { if (giant.stateT > T.recovery) { setState(giant, 'chasing'); giant.cool = T.attackCooldown; giant.repath = 0; } }
    else if (gs === 'terminal') { turnTo(giant, hero.pos.x - giant.pos.x, hero.pos.z - giant.pos.z, dt, 3); }
    giant.speedNow = gMoving ? T.giantRun : 0;

    // ----- shockwaves: damage follows the moving ring edge -----
    for (const w of E.waves) {
      w.r += T.waveSpeed * dt;
      const alpha = Math.max(0, 1 - (w.r / T.waveMax) ** 3);
      fx.setWave(w.fx, w.r, T.waveWidth, alpha);
      const d = dist2(hero, w.x, w.z);
      if (!w.hit && !G.result && Math.abs(d - w.r) < T.waveWidth * .5 + hero.r * .6) { if (damage(w.x, w.z)) w.hit = true; }
      if (w.r > T.waveMax) w.done = true;
    }
    E.waves = E.waves.filter(w => { if (w.done) fx.endWave(w.fx); return !w.done; });

    // ----- crew -----
    const hf = hero.facing, cf = Math.cos(hf), sf = Math.sin(hf);
    crew.forEach((c, i) => {
      let moved = 0, dx = 0, dz = 0;
      if (c.boarded) {
        const p = new THREE.Vector3(...deck[i]).applyMatrix4(world.ship.matrixWorld); c.pos.copy(p);
        c.facing = world.ship.rotation.y + (i - 1) * .6; setState(c, G.result === 'escaped' ? 'cheer' : 'idle');
        c.root.position.copy(p); c.speedNow = 0; return;
      }
      let tx, tz;
      if (c.boarding) { const end = [-3.2, 11.25]; tx = end[0]; tz = end[1]; if (dist2(c, tx, tz) < .35) { c.boarded = true; return; } }
      else { tx = hero.pos.x + c.offset[0] * cf + c.offset[1] * sf; tz = hero.pos.z - c.offset[0] * sf + c.offset[1] * cf; if (G.result === 'escaped') { tx = hero.pos.x; tz = hero.pos.z; } }
      const d = dist2(c, tx, tz);
      c.repath -= dt;
      if ((d > 4.5 || c.stuck > .5) && c.repath <= 0) { c.path = nav.findPath(c.pos.x, c.pos.z, tx, tz, c.r); c.repath = .8; c.stuck = 0; }
      if (c.path && c.path.length) { const [px, pz] = c.path[0]; if (Math.hypot(px - c.pos.x, pz - c.pos.z) < .2) c.path.shift(); if (c.path.length) { tx = c.path[0][0]; tz = c.path[0][1]; } else c.path = null; }
      dx = tx - c.pos.x; dz = tz - c.pos.z; const dd = Math.hypot(dx, dz);
      if (dd > .3 || c.boarding) {
        const sp = Math.min(c.boarding ? T.sprint * .9 : (G.sprinting ? T.sprint : T.walk) * 1.08, dd * 3 + .5) * (1 + .06 * Math.sin(t * .7 + i * 2));
        const before = c.pos.clone(); nav.move(c.pos, dx / dd * sp * dt, dz / dd * sp * dt, c.r); moved = c.pos.distanceTo(before);
        if (moved < sp * dt * .25) c.stuck += dt; else c.stuck = 0;
        turnTo(c, dx, dz, dt, 9);
      }
      c.speedNow = dt > 0 ? moved / dt : 0;
      // keep a little space from the hero and each other
      for (const o of [hero, ...crew]) { if (o === c || o.boarded) continue; const sx = c.pos.x - o.pos.x, sz = c.pos.z - o.pos.z, sd = Math.hypot(sx, sz); if (sd < .42 && sd > 1e-3) nav.move(c.pos, sx / sd * (.42 - sd) * .5, sz / sd * (.42 - sd) * .5, c.r); }
    });

    // hero aboard after escape
    if (G.result === 'escaped') { const p = new THREE.Vector3(...deck[3]).applyMatrix4(world.ship.matrixWorld); hero.pos.copy(p); hero.facing = world.ship.rotation.y; setState(hero, 'cheer'); hero.speedNow = 0; }

    // ----- animation and transforms -----
    for (const a of [hero, ...crew, giant]) animate(a, dt, t);
  };

  // ---------------- animation ----------------
  function animate(a, dt, t) {
    const isGiant = a === giant;
    const nominalWalk = isGiant ? T.giantRun : T.walk;
    const mv = Math.min(1, a.speedNow / (nominalWalk * .6));
    a.moveBlend += (mv - a.moveBlend) * Math.min(1, dt * 10);
    a.runBlend += ((isGiant ? 1 : Math.min(1, Math.max(0, (a.speedNow - T.walk) / (T.sprint - T.walk)))) - a.runBlend) * Math.min(1, dt * 8);
    // stride phase advances with distance travelled → no foot sliding
    const stride = isGiant ? 2.1 : (.62 + .35 * a.runBlend);
    a.phase += a.speedNow * dt / stride * Math.PI;
    const pose = isGiant ? giantPose(a, t) : heroPose(a, t);
    applyPose(a.fig, pose, dt, isGiant && ['impact'].includes(a.state) ? 40 : 14);
    if (a.fig.J.cape) a.fig.J.cape.rotation.x = -.15 - a.moveBlend * (.5 + .4 * a.runBlend) - Math.sin(t * 6 + a.seed) * .06;
    const y = a.boarded || (a === hero && G.result === 'escaped') ? a.pos.y : groundY(a.pos.x, a.pos.z);
    a.root.position.set(a.pos.x, y, a.pos.z); a.root.rotation.y = a.facing;
    // hurt flash via emissive
    const flash = a.hurt > 0 || (a === hero && G.immune > 0 && Math.sin(t * 30) > 0);
    if (a._flash !== flash) { a._flash = flash; a.fig.root.traverse(o => { if (o.isMesh && o.material.emissive) { if (flash) { o.userData.em = o.userData.em || o.material; o.material = o.material.clone(); o.material.emissive.set('#8a1a10'); } else if (o.userData.em) { o.material.dispose(); o.material = o.userData.em; } } }); }
    // imported rig
    if (a.rig) driveRig(a, dt, t);
  }

  function driveRig(a, dt, t) {
    const rig = a.rig, isGiant = a === giant, o = rig.object;
    if (rig.animated) {
      let clip = 'idle', ts = 1, once = false;
      if (isGiant) {
        if (a.state === 'sleeping') clip = 'sleep';
        else if (a.state === 'waking') { clip = 'wake'; once = true; }
        else if (a.state === 'windup' || a.state === 'impact') {
          clip = 'attack'; once = true;
          // align the clip's strike moment (≈62 % of the clip) with the gameplay impact at the end of the windup
          const c = rig.clips.attack; if (c) ts = (c.duration * .62) / T.windup;
        } else if (a.state === 'recovery') clip = 'idle';
        else if (a.state === 'terminal') clip = rig.actions.cheer ? 'cheer' : 'idle';
        else if (a.speedNow > .1) { clip = 'run'; ts = a.speedNow / T.giantRun; }
      } else {
        if (a.state === 'dodge') { clip = rig.actions.dodge ? 'dodge' : 'run'; once = !!rig.actions.dodge; if (rig.clips.dodge) ts = rig.clips.dodge.duration / T.dodgeTime; }
        else if (a.state === 'fallen') { clip = 'die'; once = true; }
        else if (a.state === 'cheer') clip = rig.actions.cheer ? 'cheer' : 'idle';
        else if (a.speedNow > T.walk * 1.15) { clip = 'run'; ts = a.speedNow / T.sprint; }
        else if (a.speedNow > .2) { clip = 'walk'; ts = a.speedNow / T.walk; }
      }
      rig.play(clip, .18, Math.max(.3, Math.min(2.5, ts)), once);
      rig.mixer.update(dt);
      o.rotation.x = a.state === 'dodge' && !rig.actions.dodge ? Math.min(1, a.stateT / T.dodgeTime) * Math.PI * 2 : 0;
    } else {
      // static import: gameplay-driven sway only (reported as static, not animated)
      o.position.y = Math.abs(Math.sin(a.phase)) * .04 * a.moveBlend * (isGiant ? 3 : 1);
      o.rotation.x = a.state === 'dodge' ? Math.min(1, a.stateT / T.dodgeTime) * Math.PI * 2 : a.moveBlend * .08;
      o.rotation.z = Math.sin(a.phase) * .05 * a.moveBlend;
      if (isGiant) { if (a.state === 'sleeping') o.rotation.x = -.25; if (a.state === 'windup') o.rotation.x = -.18 * Math.min(1, a.stateT / T.windup); if (a.state === 'impact') o.rotation.x = .25; }
    }
  }

  // ---------------- model replacement ----------------
  E.setCharacterModel = (slot, gltf, height) => {
    const targets = slot === 'odysseus' ? [hero, ...crew] : [giant];
    for (const a of targets) { if (a.rig) { a.root.remove(a.rig.object); a.rig.mixer?.stopAllAction(); a.rig = null; } }
    if (!gltf) { E.applyMode(); return null; }
    let info = null;
    for (const a of targets) {
      const rig = makeRig(gltf.scene, gltf.animations, height * (a === hero ? 1 : 1));
      a.rig = rig; a.root.add(rig.object); if (rig.mixer) rig.mixer.timeScale = 1; rig.mixer?.setTime(a.seed);   // independent phases
      info = rig;
    }
    E.applyMode();
    return info;
  };
  E.applyMode = () => { for (const a of [hero, ...crew, giant]) { const useImp = E.mode === 'tripo' && a.rig; a.fig.root.visible = !useImp; if (a.rig) a.rig.object.visible = !!useImp; } };

  E.state = () => G;
  E.stageInfo = () => STAGES[G.stage];
  E.targetPoint = () => G.stage === 3 ? [JETTY_ZONE.x, JETTY_ZONE.z, 'Hold the jetty', 'The Greek ship'] : G.stage === 2 ? [1.75, -8.4, 'Take the supplies', 'The shepherd’s larder'] : [CAVE_MOUTH.x, CAVE_MOUTH.y, 'Your destination', 'The Cyclops’ Cave'];
  // test hooks (used by the automated acceptance checks)
  E._debug = { supplies, zone, G: () => G, setHero: (x, z) => { hero.pos.set(x, 0, z); nav.clamp(hero.pos, hero.r); hero.path = null; }, setGiant: (x, z) => { giant.pos.set(x, 0, z); }, wake };
  return E;
}
