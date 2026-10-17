/* ============ missions.js — plantillas de misiones diarias y semanales ============
 * Cada día salen 3 diarias y cada semana 2 semanales (hora de España), con
 * objetivos y tipos sorteados. Se completan jugando y el premio se recoge en
 * la pantalla de Misiones. La lógica está en systems/progress.js.
 *
 *   ev      evento que la hace avanzar (ver G.Progress.event)
 *   match   (datos, parámetro) -> ¿cuenta este evento?
 *   value   datos -> cuánto vale; con mode 'max' se queda el mayor, con
 *           'add' (por defecto) se suma (1 si no hay value)
 *   param   'type': sortea un tipo Pokémon para la misión
 */
G.MissionDefs = (() => {
  const T = t => G.U.TYPE_NAME[t];
  const min = d => Math.floor(d.time / 60);

  const daily = [
    { id: 'kill', ev: 'kill', goals: [300, 500, 800], reward: { t1: 2, coins: 150 },
      text: n => `Derrota a ${n} Pokémon` },
    { id: 'killType', ev: 'kill', param: 'type', goals: [30, 50, 80], reward: { t1: 2, coins: 200 },
      match: (d, t) => d.types.includes(t), text: (n, t) => `Derrota a ${n} Pokémon de tipo ${T(t)}` },
    { id: 'survive', ev: 'runEnd', mode: 'max', value: min, goals: [5, 7, 9], reward: { t1: 3, coins: 200 },
      text: n => `Aguanta ${n} minutos en una run` },
    { id: 'level', ev: 'runEnd', mode: 'max', value: d => d.level, goals: [8, 12, 15], reward: { t1: 2, coins: 200 },
      text: n => `Llega al nivel ${n} en una run` },
    { id: 'boss', ev: 'kill', match: d => d.boss, goals: [1, 2], reward: { t1: 3, coins: 250 },
      text: n => (n === 1 ? 'Derrota a un jefe' : `Derrota a ${n} jefes`) },
    { id: 'chest', ev: 'chest', goals: [1, 2], reward: { t1: 2, coins: 200 },
      text: n => (n === 1 ? 'Abre un cofre con candado' : `Abre ${n} cofres con candado`) },
    { id: 'coins', ev: 'runEnd', value: d => d.coins, goals: [100, 200, 300], reward: { t1: 2, coins: 150 },
      text: n => `Recoge ${n} monedas en tus runs` },
    { id: 'playType', ev: 'runEnd', param: 'type', mode: 'max', value: min, goals: [3], reward: { t1: 3, coins: 200 },
      match: (d, t) => d.types.includes(t), text: (n, t) => `Aguanta ${n} minutos con un Pokémon de tipo ${T(t)}` },
    { id: 'item', ev: 'item', goals: [1], reward: { t1: 2, coins: 150 },
      text: () => 'Encuentra un objeto equipable' },
    { id: 'evolve', ev: 'evolve', goals: [1], reward: { t1: 3, coins: 250 },
      text: () => 'Evoluciona un movimiento' }
  ];

  const weekly = [
    { id: 'wkill', ev: 'kill', goals: [4000, 6000], reward: { t10: 1, coins: 800 },
      text: n => `Derrota a ${n.toLocaleString('zh-TW')} Pokémon` },
    { id: 'wrift', ev: 'rift', goals: [1, 2], reward: { t10: 1, coins: 1000 },
      text: n => (n === 1 ? 'Gana una pelea en una grieta' : `Gana ${n} peleas en grietas`) },
    { id: 'wboss', ev: 'kill', match: d => d.boss, goals: [4, 6], reward: { t10: 1, coins: 900 },
      text: n => `Derrota a ${n} jefes` },
    { id: 'wsurvive', ev: 'runEnd', mode: 'max', value: min, goals: [12, 15], reward: { t10: 1, coins: 1000 },
      text: n => `Aguanta ${n} minutos en una run` },
    { id: 'wevolve', ev: 'evolve', goals: [3, 5], reward: { t10: 1, coins: 900 },
      text: n => `Evoluciona ${n} movimientos` },
    { id: 'wdaily', ev: 'missionDone', match: d => d.daily, goals: [8, 12], reward: { t10: 1, coins: 800 },
      text: n => `Completa ${n} misiones diarias` }
  ];

  // Solo additions use existing mission persistence and reward claiming.
  if (G.SOLO) {
    daily.push(
      { id: 's_dash', ev: 'dash', goals: [12, 18], reward: { t1: 3, coins: 150 }, text: n => `成功施放 ${n} 次閃避` },
      { id: 's_bounty', ev: 'bounty', goals: [3, 5], reward: { t1: 4, coins: 200 }, text: n => `完成 ${n} 件每局懸賞` },
      { id: 's_relic', ev: 'relic', goals: [3, 5], reward: { t1: 3, coins: 200 }, text: n => `取得 ${n} 件遠征遺物` },
      { id: 's_contract', ev: 'contract', goals: [2, 3], reward: { t1: 3, coins: 200 }, text: n => `完成 ${n} 件途中委託` },
      { id: 's_ultimate', ev: 'ultimate', goals: [5, 8], reward: { t1: 3, coins: 150 }, text: n => `施放 ${n} 次覺醒大絕` },
      { id: 's_guardian', ev: 'guardianRecruit', goals: [1], reward: { t1: 3, coins: 200 }, text: () => '從守護寶箱救出 1 位夥伴' },
      { id: 's_synergy', ev: 'synergy', goals: [1], reward: { t1: 4, coins: 250 }, text: () => '啟動 1 組遺物共鳴' },
      { id: 's_guardian_win', ev: 'guardianWin', goals: [1], reward: { t1: 5, coins: 300 }, text: () => '擊敗追獵者並救回守護夥伴' }
    );
    weekly.push(
      { id: 'w_s_bounty', ev: 'bounty', goals: [20], reward: { t10: 1, coins: 800 }, text: n => `完成 ${n} 件每局懸賞` },
      { id: 'w_s_contract', ev: 'contract', goals: [8], reward: { t10: 1, coins: 900 }, text: n => `完成 ${n} 件途中委託` },
      { id: 'w_s_guardian', ev: 'guardianWin', goals: [3], reward: { t10: 1, coins: 1000 }, text: n => `救回 ${n} 位守護夥伴` },
      { id: 'w_s_dash', ev: 'dashEvolution', goals: [3], reward: { t10: 1, coins: 800 }, text: n => `在 ${n} 局冒險中進化閃避` }
    );
  }

  const BY = {};
  for (const m of daily.concat(weekly)) BY[m.id] = m;

  return { daily, weekly, BY };
})();
