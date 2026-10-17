/* Species battle habits (戰鬥習性) — pilot for six Pokémon, three shared rules.
 * Only the run's main player; guardian pets, echoes and assists never trigger.
 * Pure gameplay texture: no permanent stats, no save data, no new currency.
 *
 *   stride  蓄電步   walk 240 units → next real attack also fires a small spark
 *   shell   縮殼反拍 stand still 0.75s → first step pushes nearby normal enemies away
 *   spore   孢子退路 a grass attack leaves a short slowing ring under your feet
 *
 * Bosses (legacy, hunt, rift legendary) are never pushed or slowed.
 * Simulation dt only: pause and menus freeze everything. Entering or leaving a
 * rift clears charge/ready/zone but keeps cooldowns (no farming by teleport).
 */
G.SpeciesHabits = (() => {
  const HABITS = {
    stride: { name: '蓄電步', short: '電', color: '#ffd23f', walk: 240, cd: 6, power: .35,
      desc: '正常走路累積 240 距離後充滿；下一次攻擊額外射出一顆小電球（冷卻 6 秒）。' },
    shell: { name: '縮殼反拍', short: '殼', color: '#7fc8ff', stand: .75, cd: 8, radius: 70, knock: 140, max: 8,
      desc: '不移動站穩 0.75 秒；再起步時推開身邊一般敵人（冷卻 8 秒，首領不受影響）。' },
    spore: { name: '孢子退路', short: '孢', color: '#9be36d', cd: 8, radius: 64, dur: 2, slow: .25, max: 8,
      desc: '草系攻擊後在腳下留下 2 秒緩速圈，讓一般敵人慢 25%（冷卻 8 秒，首領不受影響）。' }
  };
  const BY_DEX = { 25: 'stride', 26: 'stride', 7: 'shell', 8: 'shell', 1: 'spore', 2: 'spore' };
  let s = null;

  const habitOf = dex => HABITS[BY_DEX[dex]] ? BY_DEX[dex] : null;
  const normalFoe = e => e && !e.dead && !e.boss && !e.legend && !e.hunt;
  const mine = p => !!s && p === s.player && !p.remote && !p.dead;
  const damaging = m => m && m.kind !== 'buff' && m.kind !== 'orbit';

  function start(p) {
    const id = p && habitOf(p.dex);
    s = id ? { id, def: HABITS[id], player: p, cd: 0, walked: 0, ready: false, stand: 0, primed: false,
      zone: null, inArena: !!G.Rift?.inArena, lastX: p.x, lastY: p.y, uses: 0 } : null;
  }

  // Player.update: `moved` is the real displacement of NORMAL movement after
  // wall collision; `input` is whether a direction is held.
  function move(p, moved, input, dt) {
    if (!mine(p)) return;
    const displaced = Math.hypot(p.x - s.lastX, p.y - s.lastY) > .01;
    s.lastX = p.x; s.lastY = p.y;
    if (s.id === 'stride') {
      if (s.cd > 0 || s.ready || !input || !(moved > 0)) return;
      s.walked = Math.min(s.def.walk, s.walked + moved);
      if (s.walked >= s.def.walk) {
        s.ready = true;
        G.FX.ring(p.x, p.y, p.r, p.r * 2.6, s.def.color, .25, 2);
        G.Audio.sfx('select');
      }
    } else if (s.id === 'shell') {
      if (s.primed && input && moved > 0) { shellBreak(p); return; }
      if (s.cd > 0 || s.primed) return;
      if (!input && !displaced) {
        s.stand += dt;
        if (s.stand >= s.def.stand) {
          s.primed = true; s.stand = 0;
          G.FX.ring(p.x, p.y, p.r * 2.2, p.r * 1.2, s.def.color, .3, 3);
          G.Audio.sfx('select');
        }
      } else s.stand = 0;
    }
  }

  function shellBreak(p) {
    s.primed = false; s.cd = s.def.cd; s.uses++;
    const foes = G.EnemyMgr.queryCircle(p.x, p.y, s.def.radius).filter(normalFoe)
      .map(e => [G.U.dist2(p.x, p.y, e.x, e.y), e]).sort((a, b) => a[0] - b[0] || a[1].id - b[1].id)
      .slice(0, s.def.max).map(x => x[1]);
    for (const e of foes) {
      const [nx, ny] = G.U.norm(e.x - p.x || 1e-3, e.y - p.y);
      e.kx += nx * s.def.knock; e.ky += ny * s.def.knock;
    }
    G.FX.ring(p.x, p.y, p.r, s.def.radius, s.def.color, .32, 4);
    G.FX.burst(p.x, p.y - p.bodyH * .4, s.def.color, 10, 160);
    G.Camera.kick(.18);
    G.Audio.sfx('shot', { kind: 'nova', type: 'water' });
  }

  // Combat.tickMove: a real primary cast, after target/cooldown validation.
  function onCast(p, m) {
    if (!mine(p) || !damaging(m)) return;
    if (s.id === 'stride' && s.ready && s.cd <= 0) {
      const base = G.Moves.instance('thunder-shock', 1);
      const lvl = G.U.clamp(m.lvl | 0 || 1, 1, base.def.maxLvl || 1);
      const spark = Object.assign(G.Moves.instance('thunder-shock', lvl), { count: 1, pierce: 0, habit: true });
      // assist() returns false when nothing is in range: keep the charge.
      if (G.Combat.assist(p, spark, s.def.power)) {
        s.ready = false; s.walked = 0; s.cd = s.def.cd; s.uses++;
      }
    } else if (s.id === 'spore' && m.type === 'grass' && s.cd <= 0) {
      s.zone = { x: p.x, y: p.y, t: s.def.dur };
      s.cd = s.def.cd; s.uses++;
      G.FX.ring(p.x, p.y, 8, s.def.radius, s.def.color, .35, 3);
    }
  }

  function update(dt, p) {
    if (!s || s.player !== p) return;
    const arena = !!G.Rift?.inArena;
    if (arena !== s.inArena) {           // teleport: drop transient state, keep cooldown
      s.inArena = arena; s.zone = null; s.ready = false; s.walked = 0; s.primed = false; s.stand = 0;
      s.lastX = p.x; s.lastY = p.y;
    }
    if (p.dead) { s.zone = null; return; }
    if (s.cd > 0) s.cd = Math.max(0, s.cd - dt);
    const z = s.zone;
    if (z) {
      z.t -= dt;
      if (z.t <= 0) s.zone = null;
      else {
        const foes = G.EnemyMgr.queryCircle(z.x, z.y, s.def.radius).filter(normalFoe)
          .map(e => [G.U.dist2(z.x, z.y, e.x, e.y), e]).sort((a, b) => a[0] - b[0] || a[1].id - b[1].id).slice(0, s.def.max);
        for (const [, e] of foes) e.applySlow(s.def.slow, .25);
      }
    }
  }

  function drawGround(ctx) {
    const z = s?.zone;
    if (!z) return;
    const k = Math.min(1, z.t / .3), t = performance.now() / 1000;
    ctx.save();
    ctx.globalAlpha = .18 * k; ctx.fillStyle = s.def.color;
    ctx.beginPath(); ctx.ellipse(z.x, z.y, s.def.radius, s.def.radius * .75, 0, 0, 6.2832); ctx.fill();
    ctx.globalAlpha = .55 * k; ctx.strokeStyle = s.def.color; ctx.lineWidth = 2; ctx.setLineDash([6, 5]); ctx.lineDashOffset = -t * 20;
    ctx.beginPath(); ctx.ellipse(z.x, z.y, s.def.radius, s.def.radius * .75, 0, 0, 6.2832); ctx.stroke();
    ctx.restore();
  }

  /** HUD chip: { name, short, color, frac (0..1 charge), ready, cd }. */
  function view(p) {
    if (!s || s.player !== p) return null;
    const d = s.def;
    let frac = 0, ready = false, label = '';
    if (s.cd > 0) { frac = 1 - s.cd / d.cd; label = Math.ceil(s.cd) + 's'; }
    else if (s.id === 'stride') { ready = s.ready; frac = s.walked / d.walk; label = ready ? '就緒' : '走動充電'; }
    else if (s.id === 'shell') { ready = s.primed; frac = s.primed ? 1 : s.stand / d.stand; label = ready ? '起步反拍' : '停步蓄力'; }
    else { ready = true; frac = 1; label = '草招觸發'; }
    return { name: d.name, short: d.short, color: d.color, frac, ready, cooling: s.cd > 0, label, zone: !!s.zone };
  }

  return { HABITS, BY_DEX, habitOf, start, move, onCast, update, drawGround, view,
    get state() { return s; } };
})();
