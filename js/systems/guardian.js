/* Protect a rescued companion until it can fight beside you. Solo, run-local. */
G.Guardian = (() => {
  const LINES = [
    { id: 'flame', stages: [4, 5, 6], times: [85, 205], color: '#ffa569', icon: 'fist',
      name: '尾焰的約定', tag: '火力型 · 兩次進化', desc: '小火龍 → 火恐龍 → 噴火龍。成長後以扇形火焰清群，定期爆發熱風。',
      move: 'flamethrower', power: 3.8, interval: 1.05, boss: 248, bossName: '岩鎧追獵者', behavior: 'chase', special: 'fire' },
    { id: 'wings', stages: [10, 11, 12], times: [55, 175], color: '#c4b3ff', icon: 'sprout',
      name: '破繭的勇氣', tag: '支援型 · 最快成長', desc: '綠毛蟲 → 鐵甲蛹 → 巴大蝶。追蹤念力減速敵人；每 10 秒為附近的你回復 9% 生命，夥伴回復 15%。',
      move: 'confusion', power: 3.2, interval: .9, specialInterval: 10, boss: 169, bossName: '夜翼追獵者', behavior: 'charger', special: 'poison' },
    { id: 'tide', stages: [129, 130], times: [240], color: '#83cfff', icon: 'shield',
      name: '逆流成龍', tag: '爆發型 · 耐心換取巨變', desc: '鯉魚王 → 暴鯉龍。需要守護較久，進化後以高壓水炮貫穿敵群，定期掀起震退浪潮。',
      move: 'hydro-pump', power: 6.2, interval: 1.55, boss: 405, bossName: '雷牙追獵者', behavior: 'ranged', special: 'electric' },
    { id: 'spark', stages: [172, 25, 26], times: [75, 195], color: '#ffe580', icon: 'type:electric',
      name: '小小電光', tag: '連鎖型 · 分散敵群', desc: '皮丘 → 皮卡丘 → 雷丘。十萬伏特在敵人間跳躍並減速；每 10 秒以放電擊退身旁敵人。單體傷害較低，擅長對付分散敵群。',
      move: 'thunderbolt', power: 3.3, interval: 1.1, specialInterval: 10, boss: 232, bossName: '重踏追獵者', behavior: 'chase', special: 'ground' },
    { id: 'frost', stages: [220, 221, 473], times: [95, 220], color: '#a6e6f5', icon: 'shield',
      name: '雪地裡的依靠', tag: '防護型 · 冰凍陣線', desc: '小山豬 → 長毛豬 → 象牙豬。冰凍光束貫穿並減速；每 12 秒震退近敵，為附近的你補至 12% 生命護盾、夥伴補至 15%。護盾不累加。',
      move: 'ice-beam', power: 3.5, interval: 1.2, boss: 467, bossName: '熔焰追獵者', behavior: 'ranged', special: 'fire' }
  ];
  let s = null;
  const mature = () => !!s?.pet && s.stage === s.line.stages.length - 1;
  const actor = () => s?.pet && !s.pet.dead && !G.Rift.inArena ? s.pet : null;
  function start(options) {
    s = options.mode === 'guardian' && G.SOLO ? { elapsed: 0, chest: null, opened: false, offered: false,
      pet: null, line: null, stage: 0, growth: 0, downs: 0, revives: 0, revive: 0, recallCd: 0,
      attackCd: 0, specialCd: 10, shots: 0, shield: 0, stuck: 0, wasRift: false,
      maturedAt: null, grace: 30, warning: null, boss: null, bossSkill: 5, bossPhase: 1,
      bossDefeated: false, rewarded: false, continued: false, breather: 0 } : null;
    if (s) G.Sprites.preload(LINES.flatMap(l => [...l.stages, l.boss]));
  }

  function safePoint(p, radius = 70, body = 14) {
    for (let i = 0; i < 16; i++) {
      const a = (p.moveAngle || 0) + i * Math.PI / 8;
      const x = p.x + Math.cos(a) * radius, y = p.y + Math.sin(a) * radius;
      if (G.World.isFree(x, y, body) && !G.World.isLiquid(x, y)) return { x, y };
    }
    return { x: p.x, y: p.y };
  }

  function makePet(dex, p, old = null) {
    const perks = G.Upgrades.perks(G.DB.upgradesOf(dex));
    const pet = new G.Player(G.DEX_BY[dex], perks, false, false);
    Object.assign(pet, old ? { x: old.x, y: old.y } : safePoint(p, 45, pet.r));
    pet.maxHp = Math.round(120 + pet.maxHp * (1 + s.stage * .35));
    pet.hp = pet.maxHp; pet.invuln = 2;
    pet.hurt = (damage, type) => hurt(damage, type);
    pet.heal = amount => { pet.hp = Math.min(pet.maxHp, pet.hp + amount); };
    pet.onDealt = damage => p.onDealt(damage);
    Object.defineProperty(pet, 'atk', { get: () => p.atk });
    // Beam/cone attacks and projectiles contribute to the same run statistics.
    Object.defineProperty(pet, 'dmgDealt', { get: () => p.dmgDealt, set: value => { p.dmgDealt = value; } });
    return pet;
  }

  function recruit(id, p) {
    if (!s || s.pet || !s.opened) return false;
    const line = LINES.find(l => l.id === id);
    if (!line) return false;
    s.line = line; s.pet = makePet(line.stages[0], p); s.pet.tag = '守護中的夥伴'; s.pet.tagColor = line.color;
    G.Spawner.say(`${s.pet.mon.name} 躲到你的身邊了。一起撐到進化！`, 3.5, true);
    G.Progress?.event('guardianRecruit');
    G.Audio.sfx('legend'); return true;
  }

  function hurt(damage, type) {
    const pet = actor(), p = G.Game.player;
    if (!pet || pet.invuln > 0 || !p || p.dead || G.Game.state !== 'playing') return;
    const nearby = Math.hypot(pet.x - p.x, pet.y - p.y) <= 100;
    const mult = type ? G.Types.mult(type, pet.mon.types) : 1;
    const raw = Math.max(1, damage * mult * (1 - pet.reduction) * (nearby ? .5 : .85));
    const absorbed = Math.min(s.shield, raw); s.shield -= absorbed;
    const taken = raw - absorbed;
    pet.hp = Math.max(0, pet.hp - taken); pet.invuln = .8; pet.flash = .15;
    G.FX.dmgText(pet.x, pet.y - pet.bodyH - 12, '-' + Math.round(taken), '#ff9c9c');
    if (!pet.hp) {
      pet.dead = true; s.downs++; s.revive = 0; pet.anim.play('Faint', { hold: true });
      G.Spawner.say(`${pet.mon.name} 倒下了！靠近守住 3 秒救援，或按 G 召回身邊。`, 4, true);
    }
  }

  function recall(p) {
    if (!s?.pet || s.recallCd > 0 || p.dead || G.Rift.inArena || G.Game.state !== 'playing') return false;
    const pet = s.pet;
    Object.assign(pet, safePoint(p, 35, pet.r)); pet._vx = pet._vy = 0;
    if (!pet.dead) { pet.heal(pet.maxHp * .18); pet.invuln = Math.max(pet.invuln, 1.5); }
    s.recallCd = 14;
    G.FX.ring(pet.x, pet.y, 5, 60, s.line.color, .5, 4); G.Audio.sfx('select'); return true;
  }

  function evolve(p) {
    const before = s.pet;
    G.Progress?.event('guardianEvolution');
    s.stage++; s.pet = makePet(s.line.stages[s.stage], p, before);
    s.pet.tagColor = s.line.color;
    G.FX.ring(s.pet.x, s.pet.y, 5, 130, s.line.color, 1, 5);
    G.FX.burst(s.pet.x, s.pet.y - 20, '#fff2bf', 32, 160); G.Audio.sfx('legend');
    if (mature()) {
      s.maturedAt = s.elapsed; s.grace = 30; s.pet.tag = '並肩作戰';
      const move = G.Moves.instance(s.line.move, 3);
      if (s.line.id === 'wings') { move.slow = .4; move.pierce = 2; }
      // Short cone formerly lost most hits by distance 180. Keep a fan, with
      // enough flight time to cover the guardian's fighting position.
      if (s.line.id === 'flame') { move.life *= 1.65; move.arc = .72; }
      if (s.line.id === 'spark') move.slow = .35;
      s.pet.moves = [move]; s.pet.slots = [[move]]; s.pet.active = 0;
      G.Spawner.say(`${s.pet.mon.name} 已經能保護你了！先享受並肩作戰的力量。`, 4, true);
    } else {
      s.pet.tag = '成長中的夥伴';
      G.Spawner.say(`${before.mon.name} 進化成 ${s.pet.mon.name}！再守護一段路。`, 3.5, true);
    }
  }

  function targetFor(enemy, player) {
    const pet = actor();
    if (!pet || enemy.boss || enemy.behavior === 'thief') return player;
    const d = Math.hypot(enemy.x - pet.x, enemy.y - pet.y);
    return d < 240 && d < Math.hypot(enemy.x - player.x, enemy.y - player.y) * 1.15 && (enemy.id % 3 === 0 || d < 45) ? pet : player;
  }

  function follow(dt, p) {
    const pet = s.pet, distance = Math.hypot(pet.x - p.x, pet.y - p.y);
    const target = { x: p.x - Math.cos(p.moveAngle) * 48, y: p.y - Math.sin(p.moveAngle) * 48 };
    const route = G.Path.dirFor(pet, p);
    const moved = G.GuardianSteering.advance(pet, target, Math.min(440, Math.max(120, p.spd * (distance > 110 ? 1.5 : 1.12))), dt, route);
    s.stuck = distance > 120 && moved < dt * 12 ? s.stuck + dt : 0;
    if (distance > 650 || s.stuck > 4) { Object.assign(pet, safePoint(p, 45, pet.r)); pet._vx = pet._vy = 0; s.stuck = 0; }
    pet.anim.dir = G.Sprites.dirFromAngle(pet.moveAngle); pet.anim.loop(moved > .05 ? 'Walk' : 'Idle');
  }

  function fight(dt, p) {
    const pet = s.pet;
    s.attackCd -= dt; s.specialCd -= dt;
    const targets = G.EnemyMgr.queryCircle(pet.x, pet.y, 380).filter(e => !e.dead);
    targets.sort((a, b) => Math.hypot(a.x - pet.x, a.y - pet.y) - Math.hypot(b.x - pet.x, b.y - pet.y));
    pet.target = targets[0] || null;
    if (pet.target) {
      pet.aim = Math.atan2(pet.target.y - pet.y, pet.target.x - pet.x);
      if (s.attackCd <= 0 && G.Combat.assist(pet, pet.moves[0], s.line.power)) {
        s.attackCd = s.line.interval * Math.max(.5, pet.cdMul); s.shots++;
        pet.anim.dir = G.Sprites.dirFromAngle(pet.aim); pet.anim.play('Shoot');
      }
    }
    if (s.specialCd > 0) return;
    s.specialCd = s.line.specialInterval || 12;
    if (s.line.id === 'wings') {
      if (Math.hypot(p.x - pet.x, p.y - pet.y) < 220) { p.heal(p.maxHp * .09); pet.heal(pet.maxHp * .15); }
      G.FX.ring(pet.x, pet.y, 8, 150, '#a4edc1', .6, 4);
    } else if (s.line.id === 'flame') G.Combat.assist(pet, G.Moves.instance('heat-wave', 3), 3.5);
    else if (s.line.id === 'tide') {
      // Preserve the existing neutral wave damage; record it alongside beams.
      G.FX.ring(pet.x, pet.y, 8, 170, '#88d6ff', .55, 5);
      for (const e of G.EnemyMgr.queryCircle(pet.x, pet.y, 170)) {
        if (e.dead) continue;
        const damage = 70 * p.atk;
        e.hurt(damage, '#88d6ff', e.x - pet.x, e.y - pet.y, 180); e.applySlow(.5, 2);
        p.dmgDealt += damage; p.onDealt(damage);
      }
    } else if (s.line.id === 'spark') {
      const wave = Object.assign(G.Moves.instance('discharge', 1), { radius: 150, dmg: 30, slow: .55, knock: 120 });
      G.Combat.assist(pet, wave, 1);
    } else if (s.line.id === 'frost') {
      const wave = Object.assign(G.Moves.instance('powder-snow', 1), { radius: 150, dmg: 25, slow: .65, knock: 150 });
      G.Combat.assist(pet, wave, 1);
      if (Math.hypot(p.x - pet.x, p.y - pet.y) < 220) {
        if (G.Expedition?.run) G.Expedition.run.shield = Math.max(G.Expedition.run.shield, p.maxHp * .12);
        s.shield = Math.max(s.shield, pet.maxHp * .15);
        G.FX.ring(p.x, p.y, 10, 65, s.line.color, .6, 4);
      }
    }
  }

  function bossTick(dt, p) {
    if (!mature() || s.bossDefeated) return;
    if (s.grace > 0) { s.grace = Math.max(0, s.grace - dt); return; }
    if (!s.boss) {
      if (G.EnemyMgr.bossAlive()) return;
      if (s.warning === null) { s.warning = 8; G.Spawner.say('追獵者察覺了進化的力量……8 秒後迎戰！', 4, true); }
      else s.warning -= dt;
      if (s.warning <= 0) { s.boss = G.Spawner.guardianBoss(p, G.Game.st.time, s.line); s.warning = null; }
      return;
    }
    if (s.boss.dead) return;
    if (s.boss.hp <= s.boss.maxHp * .5 && s.bossPhase === 1) {
      s.bossPhase = 2; s.boss.spd *= 1.12; s.bossSkill = 1;
      G.Spawner.say('追獵者進入狂怒！留意你與夥伴腳下的預警圈。', 3, true);
    }
    s.bossSkill -= dt;
    if (s.bossSkill > 0) return;
    s.bossSkill = s.bossPhase === 2 ? 4.5 : 7;
    const points = [p, s.pet];
    if (s.bossPhase === 2) points.push({ x: p.x + Math.cos(p.moveAngle) * 65, y: p.y + Math.sin(p.moveAngle) * 65 });
    for (const point of points) G.Hazards.add({ kind: 'zone', x: point.x, y: point.y, r: 45,
      delay: 1.45, dmg: s.boss.dmg * .65, type: s.line.special, color: s.line.color });
  }

  function update(dt, p) {
    if (!s || p.dead || G.Game.state !== 'playing') return;
    if (G.Rift.inArena) { s.wasRift = true; return; }
    if (s.wasRift) { if (s.pet) Object.assign(s.pet, safePoint(p, 45, s.pet.r)); s.wasRift = false; }
    s.elapsed += dt; s.recallCd = Math.max(0, s.recallCd - dt); s.breather = Math.max(0, s.breather - dt);
    if (!s.opened) {
      if (s.elapsed < 60) return;
      if (!s.chest) { const point = safePoint(p, 130); s.chest = { ...point, type: 'bigchest', r: 14, open: 0 }; G.Spawner.say('發現守護寶箱！靠近停留 3 秒，救出一位夥伴。', 4, true); }
      const d = Math.hypot(p.x - s.chest.x, p.y - s.chest.y);
      if (d > 800) Object.assign(s.chest, safePoint(p, 130));
      if (d < p.r + 48) s.chest.open += dt; else s.chest.open = Math.max(0, s.chest.open - dt);
      if (s.chest.open >= 3) { s.chest = null; s.opened = true; G.Audio.sfx('legend'); }
      return;
    }
    const pet = s.pet;
    if (!pet) return;
    pet.anim.update(dt); pet.invuln = Math.max(0, pet.invuln - dt); pet.flash = Math.max(0, pet.flash - dt);
    if (pet.dead) {
      const close = Math.hypot(p.x - pet.x, p.y - pet.y) <= p.r + pet.r + 35;
      s.revive = close ? s.revive + dt : Math.max(0, s.revive - dt);
      if (s.revive >= 3) { pet.dead = false; pet.hp = pet.maxHp * .6; pet.invuln = 3; s.revive = 0; s.revives++; pet.anim.play('Idle'); G.Spawner.say('救援成功！我們再一起走。', 2.5, true); }
      bossTick(dt, p); return;
    }
    follow(dt, p);
    const near = Math.hypot(pet.x - p.x, pet.y - p.y) < 220;
    if (near) pet.heal((pet.maxHp * .003 + pet.regenFlat) * dt);
    for (const e of G.EnemyMgr.queryCircle(pet.x, pet.y, pet.r + 45)) {
      if (e.dead || e.behavior === 'thief' || Math.hypot(e.x - pet.x, e.y - pet.y) > e.r + pet.r) continue;
      if (e.hunt) { G.Hunt.contact(e, pet, true); continue; }
      if (e.touchCd > 0) continue;
      e.touchCd = .55; hurt(e.dmg, e.atkType);
    }
    if (pet.dead) return;
    if (!mature() && near) { s.growth += dt; if (s.growth >= s.line.times[s.stage]) evolve(p); }
    if (mature()) { fight(dt, p); bossTick(dt, p); }
  }

  function onKill(enemy) {
    if (!s || enemy !== s.boss || s.bossDefeated) return;
    s.bossDefeated = true; s.breather = 20;
    G.Spawner.say(s.pet.dead ? '追獵者倒下了！救起夥伴，一起回家。' : '我們做到了！可以結伴回營了。', 4, true);
  }

  function prompt(p) {
    if (!s || p.dead || G.Game.state !== 'playing' || G.Rift.inArena) return false;
    if (s.opened && !s.pet && !s.offered) {
      s.offered = true; G.Game.expeditionChoice('guardian', LINES, id => recruit(id, p)); return true;
    }
    if (!s.bossDefeated || s.pet.dead || s.rewarded) return false;
    s.rewarded = true;
    p.coins += 250; G.Game.awardTickets(3);
    for (const dex of s.line.stages) G.DB.grant(dex, 'guardian');
    const stats = G.DB.save.stats;
    stats.guardianBonds = (stats.guardianBonds || 0) + 1;
    stats['guardianBond_' + s.line.id] = (stats['guardianBond_' + s.line.id] || 0) + 1;
    G.Progress?.event('guardianWin');
    G.Bounties?.update(p);
    G.DB.commit(true);
    G.Game.expeditionChoice('guardian-clear', [{ id: 'extract' }, { id: 'continue' }], id => {
      if (id === 'continue') s.continued = true; else G.Game.quit();
    }); return true;
  }

  function snapshot() {
    return s ? { family: s.line?.name || '', name: s.pet?.mon.name || '', stage: s.stage,
      mature: mature(), completed: s.rewarded, growth: Math.floor(s.growth), downs: s.downs,
      revives: s.revives, attacks: s.shots, dex: s.pet?.dex || 0 } : null;
  }
  function drawables() {
    if (!s || G.Rift.inArena) return [];
    const out = [];
    if (s.chest) out.push({ y: s.chest.y, draw(ctx) {
      G.World.drawProp(ctx, s.chest, performance.now() / 1000);
      G.Icons.draw(ctx, 'heart', s.chest.x - 8, s.chest.y - 62, 16);
    } });
    if (s.pet) out.push({ y: s.pet.y, draw(ctx) {
      const pet = s.pet; pet.draw(ctx);
      ctx.save();
      const width = 46, y = pet.y - pet.bodyH - 20;
      ctx.fillStyle = '#111c2b'; ctx.fillRect(pet.x - width / 2, y, width, 4);
      ctx.fillStyle = pet.dead ? '#ffd596' : s.line.color; ctx.fillRect(pet.x - width / 2, y, width * (pet.dead ? s.revive / 3 : pet.hp / pet.maxHp), 4);
      ctx.restore();
    } });
    return out;
  }
  return { LINES, start, recruit, hurt, recall, targetFor, update, onKill, prompt, mature, actor, snapshot, drawables,
    get state() { return s; }, get active() { return !!s; },
    get blocksBoss() { return !!s && (s.warning !== null || (s.boss && !s.boss.dead) || s.breather > 0); },
    reset() { s = null; } };
})();
