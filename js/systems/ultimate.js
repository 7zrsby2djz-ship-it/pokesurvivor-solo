/* A manual fifth move slot for solo expeditions. No timers outside game time. */
G.Ultimate = (() => {
  const FORMS = {
    impact: { name: '震地破陣', cd: 32, pulses: 1, desc: '一次重擊震開整圈敵人，最適合被包圍時突圍。' },
    whirlwind: { name: '迴旋風暴', cd: 30, pulses: 3, desc: '連續三圈斬擊，風暴跟隨移動，可沿著怪群掃過。' },
    reaper: { name: '噬群狂襲', cd: 34, pulses: 2, desc: '兩波收割周圍敵人，依命中數回復最多 12% 生命。' }
  };
  const state = () => G.Expedition.run?.ultimate;
  const is = m => !!m && state()?.move === m;
  const form = m => FORMS[['vine-whip', 'wing-attack', 'metal-claw'].includes(m.id) ? 'whirlwind' :
    ['bite', 'bug-bite', 'lick'].includes(m.id) ? 'reaper' : 'impact'];
  const pool = mon => G.Moves.poolFor(mon).filter(id => G.Moves.BY_ID[id].kind === 'melee');
  function defaultMove(mon) {
    const list = pool(mon), starter = G.startMoveOf(mon.dex);
    return list.includes(starter) ? starter : list.find(id => mon.types.includes(G.Moves.BY_ID[id].type)) || list[0];
  }
  function cooldown(p, m = state()?.move) {
    if (!m) return 0;
    // Normal attack CD upgrades help, but a crowd clear always remains a long CD.
    const moveCd = m.cd / m.def.cd;
    return Math.max(20, form(m).cd * Math.max(.65, p.cdMul * moveCd));
  }

  function start(p, options = {}) {
    if (!G.Expedition.active) return;
    const id = pool(p.mon).includes(options.ultimate) ? options.ultimate : defaultMove(p.mon);
    const normalSlots = Math.max(1, p.slots.length);
    let m = p.moves.find(m => m.id === id);
    if (!m) { m = G.Moves.instance(id); p.moves.push(m); }
    p.slots = p.slots.map(slot => slot.filter(x => x !== m)).filter(slot => slot.length);
    p.active = Math.min(p.active, Math.max(0, p.slots.length - 1));
    G.Expedition.run.ultimate = { move: m, cd: 0, totalCd: 0, casts: 0, kills: 0, best: 0, cast: null };
    // A converted starter must never leave its Pokémon without an automatic attack.
    const replacements = G.Moves.poolFor(p.mon).filter(id => {
      const d = G.Moves.BY_ID[id]; return d.kind !== 'melee' && d.kind !== 'buff';
    }).sort((a, b) => Number(p.mon.types.includes(G.Moves.BY_ID[b].type)) - Number(p.mon.types.includes(G.Moves.BY_ID[a].type)));
    while (p.slots.length < normalSlots) {
      const next = replacements.find(id => !p.hasMove(id));
      if (!next || !p.addMove(next)) break;
    }
    p.active = 0;
  }

  // During pause, exchange a learned melee move with the fifth slot. Instances
  // (levels/evolution) are retained; changing the slot cannot bypass cooldown.
  function swap(p, id) {
    const u = state();
    if (!u || G.Game.state !== 'paused' || u.cast) return false;
    const m = p.moves.find(m => m.id === id && m.kind === 'melee' && !is(m));
    const slot = p.slots.find(slot => slot.includes(m));
    if (!m || !slot) return false;
    slot[slot.indexOf(m)] = u.move;
    u.move = m;
    u.cd = Math.max(u.cd, cooldown(p));
    u.totalCd = u.cd;
    G.Projectiles.clearOrbs(p);
    return true;
  }

  function fire(p) {
    const u = state();
    if (!u || !p || p.dead || G.Game.state !== 'playing' || u.cd > 0 || u.cast) return false;
    const m = u.move, f = form(m), r = G.Expedition.run;
    u.cd = u.totalCd = cooldown(p);
    u.casts++;
    G.Progress?.event('ultimate');
    const combo = r.stanceT > 0;
    u.cast = { form: f, move: m, left: f.pulses, timer: 0, hits: new Set(), kills: 0,
      radius: Math.min(245, 135 + m.radius * .85) * (combo ? 1.2 : 1), damage: m.dmg * p.atk * 8,
      color: G.U.TYPE_COLOR[m.type] || '#ffd788' };
    p.invuln = Math.max(p.invuln, .9);
    r.evadeT = Math.max(r.evadeT, .9);
    p.slowT = 0;
    p.anim.play('Attack', { speed: 1.4 });
    G.Audio.sfx('legend');
    G.Camera.kick(7);
    G.FX.dmgText(p.x, p.y - p.bodyH - 24, (combo ? '閃避連攜！' : '') + f.name, '#ffe8a6', true);
    strike(p, u.cast);
    return true;
  }

  function strike(p, cast) {
    const { move: m, form: f, radius, color } = cast;
    G.FX.ring(p.x, p.y, 8, radius, color, .48, 6);
    G.FX.ring(p.x, p.y, radius * .3, radius, '#fff2ce', .32, 2);
    G.FX.burst(p.x, p.y - p.bodyH * .3, color, 28, 230);
    for (let i = 0; i < 4; i++) G.FX.slash(p.x, p.y, i * Math.PI / 2, radius * .82, Math.PI, color, G.VFX.forMove(m));
    for (const e of G.EnemyMgr.queryCircle(p.x, p.y, radius)) {
      if (e.dead) continue;
      cast.hits.add(e);
      // Breakthrough damage always reaches the crowd; elemental advantage still helps.
      const mult = Math.max(.5, G.Types.mult(m.type, e.types || ['normal'])) * G.Weather.mult(m.type);
      let damage = (cast.damage * mult + e.maxHp * (e.boss ? 0 : e.expElite ? .2 : .65)) / f.pulses;
      if (e.boss) damage = Math.min(damage, e.maxHp * .16 / f.pulses);
      const before = e.hp;
      e.hurt(damage, color, e.x - p.x, e.y - p.y, cast.left === 1 ? 210 : 30);
      if (!e.dead && !e.boss && !e.expElite && e.hp <= e.maxHp * .3) e.hurt(e.hp + (e.shield || 0) + 1, color);
      const dealt = Math.max(0, before - Math.max(0, e.hp));
      p.dmgDealt += dealt;
      if (dealt > 0) p.onDealt(dealt);
      if (e.dead) cast.kills++;
    }
    cast.left--;
    cast.timer = cast.left ? .22 : .12; // let normal enemy/drop accounting finish first
  }

  function finish(p, cast) {
    const u = state(), r = G.Expedition.run;
    u.kills += cast.kills;
    u.best = Math.max(u.best, cast.kills);
    G.Expedition.meleeHit(p, cast.hits.size);
    if (cast.form === FORMS.reaper) p.heal(p.maxHp * Math.min(.12, cast.hits.size * .015));
    if (cast.kills >= 8) {
      p.heal(p.maxHp * .12);
      G.Expedition.resetDash();
      G.Pickups.pullAll();
      G.FX.dmgText(p.x, p.y - p.bodyH - 30, `一擊破陣 ${cast.kills}！閃避就緒`, '#ffe28a', true);
    } else if (cast.kills) G.FX.dmgText(p.x, p.y - p.bodyH - 28, `大絕清除 ${cast.kills}`, '#ffe3b2', true);
    u.cast = null;
  }

  function update(dt, p) {
    const u = state();
    if (!u || p.dead || G.Game.state !== 'playing') return;
    const previous = u.cd;
    u.cd = Math.max(0, u.cd - dt);
    if (previous > 0 && !u.cd) G.FX.dmgText(p.x, p.y - p.bodyH - 24, '大絕就緒 · F', '#ffe19a', true);
    const c = u.cast;
    if (!c) return;
    c.timer -= dt;
    if (c.timer <= 0) { if (c.left) strike(p, c); else finish(p, c); }
  }

  return { FORMS, state, is, form, pool, defaultMove, cooldown, start, swap, fire, update };
})();
