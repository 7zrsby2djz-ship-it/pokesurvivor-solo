/* Optional field trials and readable elite variants; isolated from classic runs. */
G.ExpeditionTrials = (() => {
  const TIMES = [125, 305, 485];
  const AFFIXES = [
    { id: 'swift', name: '疾行', color: '#d2a6ff', desc: '移動更快，適合用減速拉開距離' },
    { id: 'ward', name: '鐵壁', color: '#95cfff', desc: '週期恢復護盾，集中火力破盾' },
    { id: 'volatile', name: '轟雷', color: '#ffc681', desc: '在你腳下標記爆破區，看到圓圈就移動' }
  ];
  let state;
  function reset() { state = { index: 0, active: null, wins: 0, elites: 0, rest: 0 }; }
  reset();

  function decorate(e, time, force = false) {
    if (!G.Expedition.active || e.boss || (!force && e.shiny) || e.behavior === 'thief' || e.expElite) return e;
    if (!force && (time < 80 || Math.random() > .045 || G.EnemyMgr.all().filter(x => x.expElite && !x.dead).length >= 3)) return e;
    const affix = G.U.pick(AFFIXES);
    e.expElite = affix.id;
    e.expEliteCd = 5;
    e.maxHp = e.hp = Math.round(e.maxHp * 1.8);
    e.dmg *= 1.1; e.xp = Math.round(e.xp * 2.5);
    if (affix.id === 'swift') e.spd *= 1.35;
    if (affix.id === 'ward') { e.shield = e.maxHp * .3; e.shieldT = 9999; }
    return e;
  }

  function start(kind, p) {
    const tier = state.index;
    if (kind === 'camp') {
      p.heal(p.maxHp * .3);
      G.Expedition.run.relicRerolls++;
      state.rest = 18;
      G.Spawner.say('營地整備：回復 30% · 遺物重選 +1 · 短暫減少敵人', 3, true);
      return;
    }
    const token = 'trial-' + tier;
    const goal = kind === 'hunt' ? 16 + tier * 8 : 2;
    state.active = { kind, token, progress: 0, goal, left: kind === 'hunt' ? 45 : 65,
      name: kind === 'hunt' ? '獵場突圍' : '菁英討伐' };
    if (kind === 'hunt') G.Spawner.burst(6 + tier * 2);
    else {
      let count = 0;
      for (let i = 0; i < 12 && count < goal; i++) {
        const e = G.Spawner.expeditionChampion();
        if (e) { decorate(e, G.Expedition.run.time, true); e.expTrial = token; count++; }
      }
      // A crowded/walled spawn ring may not fit both: never ask for missing targets.
      if (count) state.active.goal = count;
      else { state.active = null; start('camp', p); return; }
    }
    G.Spawner.say('挑戰開始：' + state.active.name, 3, true);
  }

  function prompt(p, time) {
    if (state.active || G.Expedition.run.cleared || G.EnemyMgr.bossAlive() || state.index >= TIMES.length || time < TIMES[state.index]) return;
    state.index++;
    const goal = 16 + state.index * 8;
    const options = [
      { id: 'hunt', name: '獵場突圍', tag: '高密度戰鬥', color: '#ffb997', icon: 'fist', desc: `45 秒內擊倒 ${goal} 名敵人。期間普通敵人出現速度 +65%。成功：2 張招募券、120 基礎金幣、額外遺物與熟練度。` },
      { id: 'champions', name: '菁英討伐', tag: '精準獵殺', color: '#d4b4ff', icon: 'crown', desc: '65 秒內擊倒兩名帶「討伐」標記的菁英。成功：2 張招募券、120 基礎金幣、額外遺物與熟練度。小心特殊能力！' },
      { id: 'camp', name: '紮營整備', tag: '穩健選擇', color: '#a8e9c1', icon: 'sprout', desc: '回復 30% 生命、遺物重選 +1；18 秒內普通敵人出現速度降低 45%。養精蓄銳，準備下次首領戰。' }
    ];
    G.Game.expeditionChoice('trial', options, id => start(id, p));
  }

  function onKill(p, e) {
    if (e.expElite) {
      state.elites++; p.coins += 18;
      G.FX.dmgText(e.x, e.y - e.bodyH - 14, '菁英 +18', '#ffe2a3');
      if (state.elites % 5 === 0) {
        G.Game.awardTickets(1);
        G.Spawner.say('菁英獵手：額外招募券 +1！', 2.8, true);
      }
    }
    const t = state.active;
    if (t && !G.Rift.inArena && (t.kind === 'hunt' || e.expTrial === t.token)) t.progress++;
  }

  function update(dt, p) {
    if (!G.Expedition.active || p.dead || G.Rift.inArena) return;
    state.rest = Math.max(0, state.rest - dt);
    for (const e of G.EnemyMgr.all()) {
      if (!e.expElite || e.dead) continue;
      e.expEliteCd -= dt;
      if (e.expEliteCd > 0) continue;
      e.expEliteCd = e.expElite === 'ward' ? 10 : 7;
      if (e.expElite === 'ward') { e.shield = Math.max(e.shield, e.maxHp * .2); e.shieldT = 9999; }
      if (e.expElite === 'volatile' && G.U.dist2(p.x, p.y, e.x, e.y) < 300 * 300) {
        G.Hazards.add({ kind: 'zone', x: p.x, y: p.y, r: 40, delay: 1.2,
          dmg: e.dmg * .65, type: e.atkType, color: '#ffc681' });
      }
    }
    const t = state.active;
    if (!t) return;
    t.left -= dt;
    if (t.progress >= t.goal) {
      state.wins++; state.active = null; state.rest = 12;
      G.Progress?.event('trial');
      G.Game.awardTickets(2);
      p.coins += 120; p.heal(p.maxHp * .18);
      G.Expedition.run.bonusSupplies++;
      G.Pickups.pullAll();
      G.Spawner.say('挑戰成功！招募券 +2 · 額外遺物補給已送達', 3.2, true);
    } else if (t.left <= 0) {
      state.active = null;
      G.Spawner.say('挑戰結束。已取得的戰利品保留。', 2.8, true);
    }
  }

  function drawEnemy(ctx, e) {
    if (!G.Expedition.active || !e.expElite || e.dead) return;
    const a = AFFIXES.find(a => a.id === e.expElite);
    ctx.save();
    ctx.strokeStyle = a.color; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.ellipse(e.x, e.y, e.r * 1.7, e.r * .75, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.font = '700 7px "Microsoft JhengHei",sans-serif';
    ctx.textAlign = 'center'; ctx.lineWidth = 2.5; ctx.strokeStyle = '#08121b';
    const label = (e.expTrial === state.active?.token ? '討伐 · ' : '') + a.name + '菁英';
    ctx.strokeText(label, e.x, e.y - e.bodyH - 17);
    ctx.fillStyle = a.color; ctx.fillText(label, e.x, e.y - e.bodyH - 17);
    ctx.restore();
  }

  return { AFFIXES, reset, decorate, start, prompt, onKill, update, drawEnemy,
    get state() { return state; }, get rate() { return state.active?.kind === 'hunt' ? 1.65 : state.rest > 0 ? .55 : 1; } };
})();
