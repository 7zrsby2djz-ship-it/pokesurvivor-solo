/* Repeatable once per expedition. Tickets are banked immediately, including on defeat. */
G.Bounties = (() => {
  const TASKS = [
    { id: 'time', name: '站穩腳步', desc: '本局生存 3 分鐘', goal: 180, tickets: 1, value: (p, r) => r.time, time: true },
    { id: 'kills', name: '百戰磨練', desc: '本局擊倒 100 名敵人', goal: 100, tickets: 1, value: (p, r) => r.killCount },
    { id: 'level', name: '成長突破', desc: '本局達到 Lv.10', goal: 10, tickets: 1, value: p => p.level },
    { id: 'dash', name: '步法訓練', desc: '本局成功閃避 12 次', goal: 12, tickets: 1, value: () => G.DashEvolution.state()?.uses || 0 },
    { id: 'ultimate', name: '一擊破陣', desc: '單次大絕擊倒至少 8 名敵人', goal: 8, tickets: 2, value: (p, r) => r.ultimate?.best || 0 },
    { id: 'relic', name: '遺物研究', desc: '本局取得 3 件遺物', goal: 3, tickets: 1, value: (p, r) => r.relics.length },
    { id: 'contract', name: '可靠的冒險者', desc: '本局完成 2 件途中委託', goal: 2, tickets: 2, value: (p, r) => r.contracts },
    { id: 'synergy', name: '流派成形', desc: '本局啟動 1 組遺物共鳴', goal: 1, tickets: 2, value: (p, r) => r.synergies.length },
    { id: 'trial', name: '勇敢赴約', desc: '本局成功完成 1 次岔路挑戰', goal: 1, tickets: 2, value: () => G.ExpeditionTrials.state.wins },
    { id: 'guardianEvo', name: '見證蛻變', desc: '守護夥伴完成第一次進化', goal: 1, tickets: 1, guardian: true, value: () => G.Guardian.state?.stage || 0 },
    { id: 'guardianWin', name: '一起回家', desc: '擊敗追獵者並救回守護夥伴', goal: 1, tickets: 2, guardian: true, value: () => G.Guardian.state?.rewarded ? 1 : 0 }
  ];
  const state = () => G.Expedition.run?.bounties;
  function start(options) {
    G.Expedition.run.bounties = { claimed: [], tickets: 0, guardian: options.mode === 'guardian' };
  }
  function list(p = G.Game.player) {
    const s = state(), r = G.Expedition.run;
    return TASKS.filter(t => !t.guardian || s?.guardian).map(t => ({ ...t,
      progress: s && p ? Math.min(t.goal, Math.floor(t.value(p, r))) : 0, claimed: !!s?.claimed.includes(t.id) }));
  }
  function update(p) {
    const s = state();
    if (!s || p.dead || G.Game.state !== 'playing') return;
    const completed = list(p).filter(t => !t.claimed && t.progress >= t.goal);
    if (!completed.length) return;
    let tickets = 0;
    for (const t of completed) {
      s.claimed.push(t.id); s.tickets += t.tickets; tickets += t.tickets;
      G.Progress?.event('bounty', { id: t.id });
    }
    G.Game.awardTickets(tickets);
    G.Spawner.say(`${completed[0].name}${completed.length > 1 ? '等 ' + completed.length + ' 件懸賞' : '完成'}！招募券 +${tickets}，已收進背包。`, 3.4, true);
    G.Audio.sfx('confirm');
  }
  function snapshot() { const s = state(); return s ? { completed: s.claimed.length, tickets: s.tickets, total: list().length } : null; }
  return { TASKS, start, state, list, update, snapshot };
})();
