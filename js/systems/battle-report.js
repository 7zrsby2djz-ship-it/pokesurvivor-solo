/* Local, factual run report. No network, rewards, persistence or combat changes. */
G.BattleReport = (() => {
  let run = null;
  const valid = p => run && !run.closed && run.player === p;
  const groupKey = group => group.map(m => m.id).sort().join('|');

  function start(player) {
    run = player ? { player, elapsed: 0, clean: 0, bestClean: 0, hits: 0,
      switches: 0, alternateTime: 0, groups: new Map(), closed: false, result: null } : null;
  }

  function update(dt, player) {
    if (!valid(player) || player.dead || !Number.isFinite(dt) || dt <= 0) return;
    run.elapsed += dt;
    run.clean += dt;
    run.bestClean = Math.max(run.bestClean, run.clean);
    if (player.slots.length > 1 && !player.hasItem('choiceband')) run.alternateTime += dt;
    const group = player.activeGroup();
    if (!group.length) return;
    const key = groupKey(group);
    let entry = run.groups.get(key);
    if (!entry) {
      entry = { ids: group.map(m => m.id), names: group.map(m => m.name), seconds: 0 };
      run.groups.set(key, entry);
    }
    entry.seconds += dt;
  }

  // Called only AFTER Player.setActive accepted an explicit input switch.
  function manualSwitch(player) {
    if (valid(player) && !player.dead) run.switches++;
  }

  // A hit that passed invulnerability and did damage after defense/shields.
  // Includes a lethal hit saved by Focus Sash/Phoenix; excludes Life Orb cost.
  function hit(player) {
    if (!valid(player)) return;
    run.hits++;
    run.clean = 0;
  }

  function finish(player) {
    if (!run || run.player !== player) return null;
    if (run.closed) return run.result;
    const groups = [...run.groups.values()].sort((a, b) => b.seconds - a.seconds);
    const top = groups[0];
    const dominant = top ? { ids: [...top.ids], names: [...top.names],
      seconds: top.seconds, share: run.elapsed ? top.seconds / run.elapsed : 0 } : null;
    let hint;
    if (run.elapsed < 15) {
      hint = { id: 'short-run', text: '這局觀察時間較短。下一局先熟悉移動與攻擊範圍，再試一項新選擇。' };
    } else if (run.alternateTime >= 15 && run.switches === 0) {
      hint = { id: 'try-switch', text: '這局有一段時間能切換招式，但沒有手動切招。下一局試為另一組招式指定用途，例如清怪或保持距離。' };
    } else if (run.hits >= 3 && run.bestClean < 15) {
      hint = { id: 'leave-space', text: '這局有多次受擊，未受擊的連續時間較短。下一局試著先留一條退路，再靠近攻擊。' };
    } else if (run.alternateTime >= 15 && dominant && dominant.share >= .85) {
      hint = { id: 'try-second-role', text: '這局大部分時間使用同一組招式。下一局可以試著讓另一組負責不同情境，觀察操作是否更順手。' };
    } else {
      hint = { id: 'one-experiment', text: '下一局只改一個選擇，例如一個招式或一張升級卡，觀察手感差異。' };
    }
    run.result = { version: 1, elapsed: run.elapsed, switches: run.switches,
      hits: run.hits, bestClean: run.bestClean, dominant, hint };
    run.closed = true;
    return run.result;
  }

  return { start, update, manualSwitch, hit, finish };
})();
