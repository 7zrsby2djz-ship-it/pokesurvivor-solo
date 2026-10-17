/* Choose a dodge identity at Lv.6; its second stage awakens at Lv.14. */
G.DashEvolution = (() => {
  const PATHS = [
    { id: 'gale', name: '疾風連步', evolved: '三連疾風', icon: 'sprout', color: '#9ce9d8', tag: '機動 · 儲存次數', bonus: .8,
      desc: '儲存 2 次閃避，逐次充能；位移距離 +15%。每次充能比原本多 0.8 秒。',
      upgrade: 'Lv.14：可儲存 3 次，位移距離 +25%。' },
    { id: 'frost', name: '霜環步', evolved: '極寒霜環', icon: 'shield', color: '#a1dcff', tag: '控場 · 留出空間', bonus: .5,
      desc: '落點冰環減速周圍敵人 65%，持續 3 秒，並造成少量冰傷。冷卻 +0.5 秒。',
      upgrade: 'Lv.14：冰環擴大，減速 85%，持續 4 秒。' },
    { id: 'thunder', name: '雷襲步', evolved: '奔雷破陣', icon: 'fist', color: '#ffe294', tag: '進攻 · 落點爆發', bonus: 1,
      desc: '閃避結束時在落點釋放雷擊，傷害並擊退周圍敵人。冷卻 +1 秒。',
      upgrade: 'Lv.14：雷擊範圍與傷害增加，命中至少 3 名敵人時大絕冷卻減少 2 秒。' },
    { id: 'ward', name: '守護步', evolved: '不屈守護', icon: 'heart', color: '#c2ebb0', tag: '防守 · 保護夥伴', bonus: 1,
      desc: '閃避時補足相當於最大生命 15% 的護盾，並治療附近守護夥伴 8%。冷卻 +1 秒。',
      upgrade: 'Lv.14：護盾提高至 25%，自身回復 4%，夥伴回復 14%。' }
  ];
  const state = () => G.Expedition.run?.dodge;
  const form = () => PATHS.find(p => p.id === state()?.id);
  const capacity = () => state()?.id === 'gale' ? state().rank + 1 : 1;
  const name = () => form() ? state().rank === 2 ? form().evolved : form().name : '基礎閃避';
  function start() {
    G.Expedition.run.dodge = { id: '', rank: 0, offered: false, uses: 0, charges: 0, recharge: 0, landing: false };
  }
  function choose(id) {
    const s = state(), def = PATHS.find(p => p.id === id), r = G.Expedition.run;
    if (!s || s.id || !def) return false;
    s.id = id; s.rank = 1;
    if (id === 'gale') { s.charges = r.dashCd > 0 ? 0 : 2; s.recharge = r.dashCd; }
    G.Progress?.event('dashEvolution', { id });
    G.Spawner.say('閃避進化：' + def.name + '！Lv.14 再次覺醒。', 3, true);
    G.Audio.sfx('legend'); return true;
  }
  function prompt(p) {
    const s = state();
    if (!s || s.offered || p.level < 6 || p.dead || G.Rift.inArena || G.Game.state !== 'playing') return false;
    s.offered = true;
    G.Game.expeditionChoice('dash', PATHS, choose); return true;
  }
  function onDash(p) {
    const s = state(), r = G.Expedition.run;
    if (!s) return;
    s.uses++; s.landing = true;
    G.Progress?.event('dash');
    if (s.id === 'gale') {
      s.charges = Math.max(0, s.charges - 1);
      if (s.recharge <= 0) s.recharge = G.Expedition.dashCooldown();
      r.dashCd = s.charges > 0 ? 0 : s.recharge;
    }
    if (s.id === 'ward') {
      r.shield = Math.max(r.shield, p.maxHp * (s.rank === 2 ? .25 : .15));
      if (s.rank === 2) p.heal(p.maxHp * .04);
      const pet = G.Guardian?.actor();
      if (pet && Math.hypot(pet.x - p.x, pet.y - p.y) <= 220) {
        pet.heal(pet.maxHp * (s.rank === 2 ? .14 : .08)); pet.invuln = Math.max(pet.invuln, 1);
      }
      G.FX.ring(p.x, p.y, 8, 100, form().color, .5, 3);
    }
  }
  function land(p) {
    const s = state(), def = form();
    if (!s?.landing) return;
    s.landing = false;
    if (!def || !['frost', 'thunder'].includes(s.id) || p.dead) return;
    const ice = s.id === 'frost', high = s.rank === 2;
    const radius = ice ? high ? 175 : 130 : high ? 170 : 115;
    const damage = (ice ? high ? 35 : 20 : high ? 100 : 60) * p.atk;
    const type = ice ? 'ice' : 'electric';
    G.FX.ring(p.x, p.y, 5, radius, def.color, .45, 4);
    G.FX.burst(p.x, p.y - 8, def.color, 14, 130);
    let hits = 0;
    for (const e of G.EnemyMgr.queryCircle(p.x, p.y, radius)) {
      if (e.dead || Math.hypot(e.x - p.x, e.y - p.y) > radius + (e.r || 0)) continue;
      const amount = damage * G.Types.mult(type, e.types || []) * G.Weather.mult(type);
      e.hurt(amount, def.color, e.x - p.x, e.y - p.y, ice ? 25 : 140);
      p.dmgDealt += amount; p.onDealt(amount); hits++;
      if (ice) e.applySlow(high ? .85 : .65, high ? 4 : 3);
    }
    if (!ice && high && hits >= 3 && rUltimate()) rUltimate().cd = Math.max(0, rUltimate().cd - 2);
  }
  const rUltimate = () => G.Expedition.run?.ultimate;
  function refill() {
    const s = state();
    if (s?.id === 'gale') { s.charges = capacity(); s.recharge = 0; }
  }
  function update(dt, p) {
    const s = state(), r = G.Expedition.run;
    if (!s || p.dead || G.Game.state !== 'playing') return;
    if (s.id && s.rank === 1 && p.level >= 14) {
      s.rank = 2;
      if (s.id === 'gale') s.charges = Math.min(capacity(), s.charges + 1);
      G.Spawner.say('閃避再次覺醒：' + name() + '！', 3.5, true);
      G.FX.ring(p.x, p.y, 6, 140, form().color, .8, 4); G.Audio.sfx('legend');
    }
    if (s.id !== 'gale') return;
    if (s.charges < capacity()) {
      s.recharge = Math.max(0, s.recharge - dt);
      if (s.recharge <= 0) { s.charges++; s.recharge = s.charges < capacity() ? G.Expedition.dashCooldown() : 0; }
    } else s.recharge = 0;
    r.dashCd = s.charges > 0 ? 0 : s.recharge;
  }
  function snapshot() {
    const s = state();
    return s ? { name: name(), uses: s.uses, rank: s.rank, id: s.id } : null;
  }
  return { PATHS, state, form, name, capacity, start, choose, prompt, onDash, land, refill, update, snapshot,
    get distanceMul() { return state()?.id === 'gale' ? state().rank === 2 ? 1.25 : 1.15 : 1; },
    get cooldownBonus() { return form()?.bonus || 0; } };
})();
