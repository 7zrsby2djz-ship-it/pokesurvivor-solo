/* Solo expeditions: additive run rules. No network, no changes to collections. */
G.Expedition = (() => {
  const DIFFICULTIES = [
    { id: 'calm', name: '悠遊', desc: '敵人傷害 −25%、生命 −15%；金幣 ×0.85', hp: .85, dmg: .75, rate: .9, reward: .85 },
    { id: 'normal', name: '冒險', desc: '標準強度，適合探索不同流派；金幣 ×1', hp: 1, dmg: 1, rate: 1, reward: 1 },
    { id: 'wild', name: '極限', desc: '敵人生命 +25%、傷害 +20%、數量 +15%；金幣 ×1.5', hp: 1.25, dmg: 1.2, rate: 1.15, reward: 1.5 }
  ];
  const STYLES = [
    { id: 'vanguard', name: '守望者', icon: 'shield', color: '#8cc9ff', desc: '最大生命 +25%，開場護盾 20%。閃避後獲得 4 秒、15% 減傷。', apply(p) { p.addMaxHp(Math.round(p.maxHp * .25)); } },
    { id: 'ranger', name: '疾行者', icon: 'boot', color: '#8ee9be', desc: '速度 +10%、拾取範圍 +25%。閃避冷卻從 6 秒縮短為 4.5 秒。', apply(p) { p.spdMul *= 1.1; p.magnet *= 1.25; } },
    { id: 'scholar', name: '研習者', icon: 'book', color: '#d0b0ff', desc: '經驗 +20%，額外 2 次升級重選。閃避後 4 秒內攻擊 +15%。', apply(p) { p.xpMul *= 1.2; p.extraRerolls = 2; } }
  ];
  // Unique per run. Timed effects live here so pause freezes every cooldown.
  const RELICS = [
    { id: 'echo', name: '回聲鈴', icon: 'bond', tag: '招式連攜', color: '#e6a7ed', desc: '每 4 秒輪流以 45% 威力施放一個未啟用的攻擊招式。環繞、陷阱、砲台與足跡不參與。多學招式就多一種選擇。' },
    { id: 'frost', name: '霜行靴', icon: 'boot', tag: '閃避控制', color: '#97eaff', desc: '閃避時使周圍敵人減速 60%，持續 2.5 秒；閃避冷卻再縮短 1 秒。' },
    { id: 'spark', name: '雷鳴印記', icon: 'fist', tag: '閃避爆發', color: '#ffe391', desc: '閃避後釋放半徑 110 的衝擊波，造成相當於基礎威力 25 的傷害並擊退。' },
    { id: 'vampire', name: '生命芽', icon: 'sprout', tag: '擊倒續航', color: '#9ce8a2', desc: '每擊倒 8 名敵人恢復 4% 最大生命；每次擊倒首領額外恢復 15%。' },
    { id: 'ward', name: '潮汐護符', icon: 'shield', tag: '護盾循環', color: '#a4ceff', desc: '立即獲得 18% 最大生命的護盾，每 20 秒補滿。護盾優先抵銷傷害。' },
    { id: 'momentum', name: '狩獵節拍', icon: 'fist', tag: '連殺流派', color: '#ffb695', desc: '8 秒內持續擊倒敵人可維持連殺。每 5 連殺提升 8% 攻擊，最多 +32%；中斷後歸零。' },
    { id: 'prism', name: '共鳴稜鏡', icon: 'book', tag: '多屬性', color: '#c5b1ff', desc: '每學會一種不同屬性的招式，攻擊提升 6%，最多 +30%。包含未啟用的招式。' },
    { id: 'bloom', name: '森之心', icon: 'heart', tag: '穩定成長', color: '#a2e6b9', desc: '最大生命 +30、每秒回復 +0.6。每次升級再恢復 8% 最大生命。', apply(p) { p.addMaxHp(30); p.regenFlat += .6; } },
    { id: 'magnet', name: '尋寶羅盤', icon: 'magnet', tag: '探索收益', color: '#f4d784', desc: '拾取範圍 +60%；每擊倒 10 名敵人得到 5 枚金幣。取得時吸取場上全部經驗與掉落物。', apply(p) { p.magnet *= 1.6; G.Pickups.pullAll(); } },
    { id: 'glass', name: '烈焰誓約', icon: 'fist', tag: '高風險', color: '#ff9f95', desc: '攻擊 +30%，最大生命降低 15%。適合搭配閃避、控制與護盾。', apply(p) { p.atkMul *= 1.3; p.maxHp = Math.max(1, Math.round(p.maxHp * .85)); p.hp = Math.min(p.hp, p.maxHp); } },
    { id: 'phoenix', name: '不屈羽毛', icon: 'heart', tag: '一次救援', color: '#ffd39d', desc: '本局首次承受致命傷時保留 40% 生命，獲得 2 秒無敵並擊退附近敵人。' },
    { id: 'tempo', name: '疾風沙漏', icon: 'clock', tag: '快速施法', color: '#b5d9ff', desc: '所有招式冷卻縮短 15%，速度提升 5%。', apply(p) { p.cdMul *= .85; p.spdMul *= 1.05; } }
  ];
  const SUPPLIES = [90, 240, 420, 600];
  const SYNERGIES = [
    { id: 'storm', name: '霜雷奔流', pair: ['frost', 'spark'], color: '#a4e5ff', desc: '閃避衝擊波威力 25 → 60、範圍 110 → 165；冰霜減速範圍也擴大。' },
    { id: 'choir', name: '萬象合奏', pair: ['echo', 'prism'], color: '#d5b8ff', desc: '回聲間隔 4 → 2.8 秒，每次最多施放兩個不同的備用攻擊招式。' },
    { id: 'garden', name: '不息花園', pair: ['vampire', 'bloom'], color: '#acf2ae', desc: '直接治療溢出的生命轉成護盾，最多儲存最大生命的 30%。' },
    { id: 'phoenixward', name: '涅槃之盾', pair: ['ward', 'phoenix'], color: '#ffd2a2', desc: '護盾補滿週期 20 → 12 秒；不屈羽毛救援後立刻補滿 35% 生命護盾。' },
    { id: 'berserk', name: '破釜狂潮', pair: ['momentum', 'glass'], color: '#ffad99', desc: '維持至少 15 連殺時獲得 18% 額外減傷，並使近戰士氣累積加倍。' },
    { id: 'treasure', name: '疾風尋寶', pair: ['magnet', 'tempo'], color: '#f3dda1', desc: '每 20 連殺自動吸取場上掉落物，並使閃避立刻恢復。' }
  ];
  const MASTERY = [0, 25, 70, 145, 260, 420];
  const CONTRACTS = [
    { at: 35, id: 'hunt', name: '掃清前路', goal: 18, duration: 100, unit: '擊倒' },
    { at: 250, id: 'travel', name: '探勘地形', goal: 1800, duration: 90, unit: '步距' },
    { at: 440, id: 'hunt', name: '突破包圍', goal: 38, duration: 100, unit: '擊倒' }
  ];
  let run = null;
  const active = () => !!run;
  const has = id => !!run && run.relics.includes(id);
  const synergy = id => !!run && run.synergies.includes(id);
  function mastery(save, dex) {
    const xp = save?.stats?.['expXP_' + dex] || 0;
    let rank = 0;
    MASTERY.forEach((n, i) => { if (xp >= n) rank = i; });
    return { xp, rank, next: MASTERY[rank + 1] || null, base: MASTERY[rank],
      name: ['初行', '熟手', '探索者', '開拓者', '征服者', '大師'][rank],
      wins: save?.stats?.['expWins_' + dex] || 0, best: save?.stats?.['expBest_' + dex] || 0 };
  }

  function start(p, options = {}) {
    run = null;
    if (G.Guardian) G.Guardian.reset();
    if (!G.SOLO || options.mode === 'classic') return;
    const style = STYLES.find(s => s.id === options.style) || STYLES[0];
    const difficulty = DIFFICULTIES.find(d => d.id === options.difficulty) || DIFFICULTIES[1];
    const rank = mastery(G.DB?.save, p.dex).rank;
    run = { style, difficulty, relics: [], synergies: [], supply: 0, bonusSupplies: 0, lastSupply: 'timed',
      relicRerolls: 1 + Math.min(2, rank), focus: RELICS.some(r => r.id === options.focus) ? options.focus : '',
      contractIndex: 0, contract: null, contracts: 0, bravery: 0, braveryT: 0, breakouts: 0,
      dashCd: 0, dashT: 0, evadeT: 0, dashAngle: 0, stanceT: 0, shield: 0, wardT: 20, echoT: 4, echoIndex: 0,
      combo: 0, comboT: 0, bestCombo: 0, killCount: 0, phoenixUsed: false,
      finalDown: false, cleared: false, continued: false, rewarded: false, settled: false,
      x: p.x, y: p.y, time: 0 };
    style.apply(p);
    if (style.id === 'vanguard') run.shield = Math.ceil(p.maxHp * .2);
    p.coinMul *= difficulty.reward;
    // The original sparse, durable enemies made the first choices arrive late.
    p.xpMul *= 1.45;
    p.regenFlat += .25;
    p.magnet *= 1.15;
    if (G.ExpeditionTrials) G.ExpeditionTrials.reset();
    if (G.DashEvolution) G.DashEvolution.start();
    if (G.Bounties) G.Bounties.start(options);
    if (G.Ultimate) G.Ultimate.start(p, options);
    if (G.Guardian) G.Guardian.start(options);
  }

  function dash(p) {
    if (!run || !p || p.dead || run.dashCd > 0 || run.dashT > 0 || G.Game.state !== 'playing') return false;
    const [x, y] = G.Input.axis();
    run.dashAngle = x || y ? Math.atan2(y, x) : p.moveAngle;
    run.dashT = .22;
    run.evadeT = .32;
    run.dashCd = dashCooldown();
    run.stanceT = 4;
    p.invuln = Math.max(p.invuln, .32);
    p.slowT = 0;
    G.FX.ring(p.x, p.y, 4, 42, run.style.color, .28, 3);
    G.Audio.sfx('select');
    if (has('frost')) for (const e of G.EnemyMgr.queryCircle(p.x, p.y, synergy('storm') ? 165 : 120)) e.applySlow(.6, 2.5);
    if (has('spark')) pulse(p, (synergy('storm') ? 60 : 25) * p.atk, synergy('storm') ? 165 : 110, '#ffe391');
    if (G.DashEvolution) G.DashEvolution.onDash(p);
    return true;
  }

  function resetDash() { if (run) { run.dashCd = 0; G.DashEvolution?.refill(); } }

  function dashCooldown() { return (run?.style.id === 'ranger' ? 4.5 : 6) - (has('frost') ? 1 : 0) + (G.DashEvolution?.cooldownBonus || 0); }
  // Player.update still performs wall collisions; short substeps prevent tunneling.
  function motion(p, dt) {
    if (!run || run.dashT <= 0) return false;
    const step = Math.min(dt, run.dashT);
    const distance = Math.min(620, p.baseSpd * 4) * step * (G.DashEvolution?.distanceMul || 1);
    const n = Math.max(1, Math.ceil(distance / 4));
    for (let i = 0; i < n; i++) {
      p.x += Math.cos(run.dashAngle) * distance / n;
      p.y += Math.sin(run.dashAngle) * distance / n;
      G.World.collide(p);
    }
    run.dashT = Math.max(0, run.dashT - dt);
    if (!run.dashT) G.DashEvolution?.land(p);
    p.moveAngle = run.dashAngle;
    p.walking = true;
    p.svx = p.svy = 0;
    return true;
  }

  function pulse(p, damage, radius, color) {
    G.FX.ring(p.x, p.y, 5, radius, color, .4, 4);
    for (const e of G.EnemyMgr.queryCircle(p.x, p.y, radius)) {
      if (!e.dead) e.hurt(damage, color, e.x - p.x, e.y - p.y, 180);
    }
  }

  function attackMul(p) {
    if (!run) return 1;
    let bonus = run.style.id === 'scholar' && run.stanceT > 0 ? .15 : 0;
    if (has('momentum')) bonus += Math.min(4, Math.floor(run.combo / 5)) * .08;
    if (has('prism')) bonus += Math.min(5, new Set(p.moves.map(m => m.type)).size) * .06;
    return 1 + bonus;
  }

  function absorb(p, damage) {
    if (!run) return damage;
    if (run.style.id === 'vanguard' && run.stanceT > 0) damage *= .85;
    if (synergy('berserk') && run.combo >= 15) damage *= .82;
    const blocked = Math.min(run.shield, damage);
    run.shield -= blocked;
    if (blocked > 0) G.FX.ring(p.x, p.y, p.r, p.r + 18, '#a4ceff', .2, 3);
    return damage - blocked;
  }

  function rescue(p) {
    if (!has('phoenix') || run.phoenixUsed || p.hp > 0) return false;
    run.phoenixUsed = true;
    p.hp = Math.max(1, p.maxHp * .4);
    p.invuln = 2;
    if (synergy('phoenixward')) run.shield = p.maxHp * .35;
    pulse(p, 0, 150, '#ffd39d');
    G.Spawner.say('不屈羽毛發動！', 2.6, true);
    return true;
  }

  function onKill(p, enemy) {
    if (!run || p.dead) return;
    run.killCount++;
    run.combo++; run.comboT = 8;
    run.bestCombo = Math.max(run.bestCombo, run.combo);
    if (run.combo % 10 === 0) G.FX.dmgText(p.x, p.y - p.bodyH - 24, run.combo + ' 連殺！', '#ffe2a1', true);
    if (has('vampire')) {
      if (run.killCount % 8 === 0) p.heal(p.maxHp * .04);
      if (enemy.boss) p.heal(p.maxHp * .15);
    }
    if (has('magnet') && run.killCount % 10 === 0) p.coins += 5;
    if (synergy('treasure') && run.combo % 20 === 0) { resetDash(); G.Pickups.pullAll(); }
    if (run.contract?.id === 'hunt' && !G.Rift.inArena) run.contract.progress++;
    if (enemy.expeditionFinal) run.finalDown = true;
    if (G.ExpeditionTrials) G.ExpeditionTrials.onKill(p, enemy);
    if (G.Guardian) G.Guardian.onKill(enemy);
  }

  function onLevel(p, count) { if (has('bloom') && count > 0) p.heal(p.maxHp * .08 * count); }

  function onHeal(p, overflow) {
    if (synergy('garden') && overflow > 0) run.shield = Math.max(run.shield, Math.min(p.maxHp * .3, run.shield + overflow));
  }

  function meleeHit(p, hits) {
    if (!run || !hits || p.dead) return;
    run.braveryT = 4;
    run.bravery += Math.min(30, hits * 10) * (synergy('berserk') && run.combo >= 15 ? 2 : 1);
    if (run.bravery >= 100) {
      run.bravery -= 100; run.breakouts++;
      p.invuln = Math.max(p.invuln, .5);
      p.heal(p.maxHp * .08);
      pulse(p, 35 * p.atk, 125, '#ffcd8f');
      G.FX.dmgText(p.x, p.y - p.bodyH - 20, '勇氣爆發！', '#ffda9a', true);
      G.Audio.sfx('levelup');
    }
  }

  function choices() {
    const pool = RELICS.filter(r => !has(r.id)).slice();
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    // Help a build come together: offer a missing synergy partner when possible.
    const missing = SYNERGIES.flatMap(s => has(s.pair[0]) !== has(s.pair[1]) ? s.pair.filter(id => !has(id)) : []);
    const desired = !run?.relics.length && run?.focus ? run.focus : G.U.pick(missing);
    const at = pool.findIndex(r => r.id === desired);
    if (at > 0) pool.unshift(pool.splice(at, 1)[0]);
    return pool.slice(0, 3);
  }

  function reroll() {
    if (!run || run.relicRerolls <= 0 || G.Game.state !== 'expedition') return null;
    run.relicRerolls--;
    G.Audio.sfx('select');
    return choices();
  }

  function take(id, p) {
    const relic = RELICS.find(r => r.id === id);
    if (!run || !relic || has(id)) return false;
    run.relics.push(id);
    G.Progress?.event('relic');
    if (relic.apply) relic.apply(p);
    if (id === 'ward') { run.shield = Math.max(run.shield, p.maxHp * .18); run.wardT = 20; }
    p.heal(p.maxHp * .12);
    G.Audio.sfx('legend');
    G.Spawner.say('獲得遺物：' + relic.name, 2.8, true);
    for (const s of SYNERGIES) if (!synergy(s.id) && s.pair.every(has)) {
      run.synergies.push(s.id);
      G.Progress?.event('synergy', { id: s.id });
      G.FX.ring(p.x, p.y, 10, 180, s.color, .9, 5);
      G.Spawner.say('共鳴覺醒！' + s.name, 3.5, true);
      G.Audio.sfx('legend');
    }
    return true;
  }

  function update(dt, p, time) {
    if (!run || p.dead) return;
    run.time = time;
    if (G.Ultimate) G.Ultimate.update(dt, p);
    if (G.Guardian) G.Guardian.update(dt, p);
    run.dashCd = Math.max(0, run.dashCd - dt);
    G.DashEvolution?.update(dt, p);
    G.Bounties?.update(p);
    run.evadeT = Math.max(0, run.evadeT - dt);
    run.stanceT = Math.max(0, run.stanceT - dt);
    run.comboT -= dt;
    if (run.comboT <= 0) run.combo = 0;
    run.braveryT -= dt;
    if (run.braveryT <= 0) run.bravery = Math.max(0, run.bravery - dt * 5);
    if (has('ward') && (run.wardT -= dt) <= 0) { run.wardT = synergy('phoenixward') ? 12 : 20; run.shield = Math.max(run.shield, p.maxHp * .18); }
    if (has('echo') && (run.echoT -= dt) <= 0) {
      run.echoT = synergy('choir') ? 2.8 : 4;
      const group = p.activeGroup();
      const pool = p.moves.filter(m => m !== run.ultimate?.move && !group.includes(m) && ['projectile', 'melee', 'beam', 'nova', 'boomerang', 'chain', 'meteor', 'cone'].includes(m.kind));
      for (let i = 0; i < Math.min(pool.length, synergy('choir') ? 2 : 1); i++) G.Combat.assist(p, pool[run.echoIndex++ % pool.length], .45);
    }
    const distance = Math.hypot(p.x - run.x, p.y - run.y);
    run.x = p.x; run.y = p.y;
    // Rift teleports are not walking; suspend side objectives inside the arena.
    if (G.Rift.inArena) return;
    if (G.ExpeditionTrials) G.ExpeditionTrials.update(dt, p, time);
    const c = run.contract;
    if (c) {
      c.left -= dt;
      if (c.id === 'travel' && distance < 80) c.progress += distance;
      if (c.progress >= c.goal) {
        run.contracts++;
        G.Progress?.event('contract');
        G.Game.awardTickets(1);
        p.coins += 65;
        p.heal(p.maxHp * .2);
        G.Game.awardXp(p.xpNext * .5 / p.xpMul);
        G.Pickups.pullAll();
        run.contract = null;
        G.Spawner.say('委託完成！招募券 +1 · 金幣 +65 · 回復 20%', 3, true);
      } else if (c.left <= 0) {
        run.contract = null;
        G.Spawner.say('委託時間結束，下次再挑戰。', 2.5, true);
      }
    }
    const next = CONTRACTS[run.contractIndex];
    if (!run.contract && next && time >= next.at) {
      run.contractIndex++;
      run.contract = { ...next, left: next.duration, progress: 0 };
      G.Spawner.say('途中委託：' + next.name, 2.5, true);
    }
  }

  // Called after ordinary choices; never overlaps level-up, items or rift scenes.
  function prompt(p) {
    if (!run || p.dead || G.Game.state !== 'playing' || G.Rift.inArena) return;
    if (G.Guardian?.prompt(p)) return;
    if (G.DashEvolution?.prompt(p)) return;
    if (run.bonusSupplies > 0 || (run.supply < SUPPLIES.length && run.time >= SUPPLIES[run.supply])) {
      run.lastSupply = run.bonusSupplies > 0 ? 'trial' : 'timed';
      if (run.bonusSupplies > 0) run.bonusSupplies--; else run.supply++;
      const list = choices();
      if (list.length) G.Game.expeditionChoice('supply', list, id => take(id, p));
      return;
    }
    if (run.finalDown && !run.cleared) {
      run.cleared = true;
      if (!run.rewarded) {
        run.rewarded = true;
        p.coins += 300;
        G.Game.awardTickets(2);
      }
      G.Game.expeditionChoice('clear', [], action => {
        if (action === 'continue') run.continued = true;
        else G.Game.quit();
      });
      return;
    }
    if (G.ExpeditionTrials) G.ExpeditionTrials.prompt(p, run.time);
  }

  function settle(save) {
    if (!run || run.settled) return null;
    run.settled = true;
    const trials = G.ExpeditionTrials?.state;
    const score = Math.round((run.killCount * 8 + run.contracts * 300 + run.bestCombo * 3 + run.synergies.length * 500 + (trials?.wins || 0) * 500 + (run.cleared ? 2500 : 0) + run.time) * run.difficulty.reward);
    save.stats.expeditions = (save.stats.expeditions || 0) + 1;
    save.stats.expeditionWins = (save.stats.expeditionWins || 0) + (run.cleared ? 1 : 0);
    save.stats.expeditionBest = Math.max(save.stats.expeditionBest || 0, score);
    const dex = G.Game.player.dex, before = mastery(save, dex);
    const xp = Math.floor(run.time / 45) + Math.floor(run.killCount / 12) + run.contracts * 3 + (trials?.wins || 0) * 6 + (run.cleared ? 12 : 0);
    save.stats['expXP_' + dex] = before.xp + xp;
    save.stats['expWins_' + dex] = before.wins + (run.cleared ? 1 : 0);
    save.stats['expBest_' + dex] = Math.max(before.best, score);
    for (const id of run.relics) save.stats['relic_' + id] = (save.stats['relic_' + id] || 0) + 1;
    for (const id of run.synergies) save.stats['synergy_' + id] = (save.stats['synergy_' + id] || 0) + 1;
    const after = mastery(save, dex), masteryBonus = (after.rank - before.rank) * 120;
    return { dodge: G.DashEvolution?.snapshot() || null, bounties: G.Bounties?.snapshot() || null, guardian: G.Guardian?.snapshot() || null, cleared: run.cleared, style: run.style.name, difficulty: run.difficulty.name,
      contracts: run.contracts, combo: run.bestCombo, score, trials: trials?.wins || 0,
      eliteKills: trials?.elites || 0, breakouts: run.breakouts,
      ultimate: run.ultimate ? { name: run.ultimate.move.name, casts: run.ultimate.casts, kills: run.ultimate.kills, best: run.ultimate.best } : null, mastery: after, masteryXp: xp, masteryBonus,
      synergies: run.synergies.map(id => SYNERGIES.find(s => s.id === id).name),
      relics: run.relics.map(id => RELICS.find(r => r.id === id).name) };
  }

  function scaleEnemy(e, time, boss = false) {
    if (!run) return;
    // Front-load build decisions without weakening the expedition's later threats.
    const opening = !boss && time < 150 ? .78 + time / 150 * .22 : 1;
    e.hp = e.maxHp = Math.max(1, Math.round(e.maxHp * run.difficulty.hp * opening));
    e.dmg *= run.difficulty.dmg;
  }

  return { DIFFICULTIES, STYLES, RELICS, SUPPLIES, SYNERGIES, mastery, synergy, start, dash, resetDash, motion, dashCooldown, attackMul, absorb, rescue,
    onKill, onLevel, onHeal, meleeHit, choices, reroll, take, update, prompt, settle, scaleEnemy,
    reset() { run = null; if (G.Guardian) G.Guardian.reset(); }, get active() { return active(); }, get run() { return run; },
    get evading() { return !!run && run.evadeT > 0; },
    get rate() { return run ? run.difficulty.rate * (G.ExpeditionTrials?.rate || 1) : 1; } };
})();
