/* Run-only diminishing returns. Apply ratios/deltas so permanent upgrades,
 * resonance, items and expedition bonuses keep their original contribution. */
G.Growth = (() => {
  const curve = {
    atk: n => 1 + .14 * n / (1 + n / 40),
    hp: n => Math.floor(480 * n / (n + 24)),
    def: n => .5 * n / (n + 8),
    rgn: n => 18 * n / (n + 20),
    cd: n => 1 / (1 + .08 * n),
    spd: n => 1 + .07 * n / (1 + n / 12),
    xp: n => 1 + .12 * n / (1 + n / 12)
  };
  const caps = { atk: 40, hp: 60, def: 12, rgn: 40, cd: 10, spd: 8, xp: 8 };
  const fields = { atk: 'atkMul', cd: 'cdMul', spd: 'spdMul', xp: 'xpMul' };
  function next(p, id) {
    const n = Math.min(caps[id], p.statsTaken[id] || 0);
    return { before: curve[id](n), after: curve[id](Math.min(caps[id], n + 1)) };
  }
  function apply(p, id) {
    const { before, after } = next(p, id);
    if (fields[id]) p[fields[id]] *= after / before;
    else if (id === 'hp') p.addMaxHp(after - before);
    else if (id === 'rgn') p.regenFlat += after - before;
    else if (id === 'def') p.growthDefense = after;
  }
  function reduction(p) {
    const base = G.U.clamp(p.dmgReduce || 0, 0, .7);
    const run = p.growthDefense || 0;
    const buff = G.U.clamp(p.buffs.def.n * p.buffs.def.amount, 0, .65);
    return Math.min(.7, 1 - (1 - base) * (1 - run) * (1 - buff));
  }
  function describe(p, id) {
    if (!curve[id]) return null;
    const { before, after } = next(p, id);
    const pct = n => (n * 100).toFixed(1);
    if (id === 'hp') return `最大生命 +${after - before} 並回復等量生命。累計 +${after}，後續增益逐步遞減。`;
    if (id === 'rgn') return `每秒回復 +${(after - before).toFixed(2)}。本局卡片累計 ${after.toFixed(2)}/秒。`;
    if (id === 'def') return `護甲減傷 ${pct(before)}% → ${pct(after)}%。與永久強化、技能減傷分層計算，總減傷上限 70%。`;
    if (id === 'cd') return `目前冷卻再縮短 ${pct(1 - after / before)}%。本局反應卡累計縮短 ${pct(1 - after)}%。`;
    const label = { atk: '所有招式傷害', spd: '移動速度', xp: '經驗獲得' }[id];
    return `${label} +${pct(after / before - 1)}%。本局同類卡累計 +${pct(after - 1)}%，後續增益逐步遞減。`;
  }
  return { curve, caps, apply, describe, reduction };
})();
