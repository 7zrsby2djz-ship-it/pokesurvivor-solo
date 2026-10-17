/* Shared late-game boss hunt: classic, expedition and guardian.
 * Times are earliest arrivals; existing bosses/rifts/pursuers have priority.
 * Runtime receipts live on each enemy; permanent rewards use the existing DB.
 * No new currency or save schema, and no restoration of unfinished runs. */
G.Hunt = (() => {
  const TIERS = [
    { at: 840, dex: 248, hp: 60000, contact: .12, color: '#ffb65c', moves: ['slam', 'charge', 'rain'], reward: '全稀有度異色' },
    { at: 960, dex: 376, hp: 95000, contact: .15, color: '#81d8ff', moves: ['cross', 'charge', 'slam'], reward: '三星以上異色' },
    { at: 1080, dex: 384, hp: 150000, contact: .18, color: '#91ebbc', moves: ['rain', 'charge', 'cross'], reward: '四星異色' },
    { at: 1200, dex: 150, hp: 220000, contact: .20, color: '#d7a1ff', moves: ['cross', 'rain', 'slam', 'charge'], reward: '五星異色' }
  ];
  const THRESHOLDS = [.75, .5, .25];
  let run = null;
  function reset(options = null) {
    run = options && G.SOLO ? { mode: options.mode || 'expedition', next: 0, kills: 0, tickets: 0,
      rewards: [], breather: 0, finalPending: false, finalShown: false, retrySave: false, retryT: 0 } : null;
    if (run) G.Sprites.preload(TIERS.map(b => b.dex));
  }
  function persist(ok) {
    if (!run || ok !== false) return;
    run.retrySave = true; run.retryT = 2;
    G.UI?.toast('儲存暫時失敗，戰利品仍在本局，正在重試。請勿關閉分頁。');
  }
  function update(dt, p, t) {
    if (!run || !p || p.dead) return;
    if (run.retrySave && (run.retryT -= dt) <= 0) {
      run.retryT = 3; run.retrySave = G.DB.commit() === false;
    }
    if (G.Rift.inArena) return;
    run.breather = Math.max(0, run.breather - dt);
    const tier = TIERS[run.next];
    if (!tier || t < tier.at || run.breather || G.EnemyMgr.bossAlive() || G.Guardian?.blocksBoss) return;
    spawn(p, run.next++);
  }
  function spawn(p, index) {
    const b = TIERS[index], difficulty = G.Expedition?.run?.difficulty;
    const hp = Math.round(b.hp * (difficulty?.hp || 1));
    const angle = Math.random() * Math.PI * 2, distance = G.Camera.outerRadius() + 50;
    const e = new G.Enemy({ dex: b.dex, hp, dmg: 0, spd: 70 + index * 5, xp: 1600 + index * 400, behavior: 'chase' },
      p.x + Math.cos(angle) * distance, p.y + Math.sin(angle) * distance, { hp: 1, dmg: 1, spd: 1 }, true);
    e.hunt = { index, claims: 0, paid: false, step: 0, state: 'approach', t: 2.4,
      contactCd: 0, petCd: 0, healCd: 0, shieldCd: 0, dangerous: false,
      damageScale: difficulty?.dmg || 1, damageWindow: 0, rawWindow: 0, label: '靠近中 · 準備迎戰' };
    // Larger art, bounded collision radius compatible with the spatial grid.
    e.scale = Math.max(e.scale, 2);
    e.anim = new G.Sprites.Animator(e.dex, e.scale);
    e.bodyH = G.Sprites.bodyHeight(e.dex, e.scale);
    e.r = Math.min(42, Math.max(28, G.Sprites.bodyRadius(e.dex, e.scale)));
    G.EnemyMgr.add(e);
    G.Spawner.say(`後期狩獵 ${index + 1}/4 · ${e.name}！75／50／25% 生命各送招募券`, 5, true);
    G.Audio.sfx('boss'); G.Camera.kick(.8);
    return e;
  }
  // Rift stash clears every hazard. A boss that was mid-warning/attack must not
  // come back already dangerous: restart from a full approach so the next
  // attack always shows its complete telegraph first.
  function resume(e) {
    const h = e?.hunt;
    if (!h || e.dead) return;
    h.state = 'approach'; h.t = 2.4; h.dangerous = false; h.move = null;
    h.contactCd = Math.max(h.contactCd, .9); h.petCd = Math.max(h.petCd, .9);
    h.rawWindow = 0; h.damageWindow = 0; h.label = '重新現身 · 準備迎戰';
    e.anim?.play?.('Walk');
  }
  function onDamage(e) {
    if (!run || !e.hunt) return;
    for (let i = 0; i < THRESHOLDS.length; i++) {
      const bit = 1 << i;
      if (e.hp > e.maxHp * THRESHOLDS[i] || e.hunt.claims & bit) continue;
      // Claim before awarding: a lethal/multi-hit attack cannot pay twice.
      e.hunt.claims |= bit; run.tickets++;
      const saved = G.Game.awardTickets(1); persist(saved);
      G.Spawner.say(`狩獵階段完成 · ${Math.round(THRESHOLDS[i] * 100)}% · 招募券 +1（${saved === false ? '待儲存，請勿關閉分頁' : '立即入帳'}）`, 3, true);
      G.FX.dmgText(e.x, e.y - e.bodyH - 12 - i * 18, '招募券 +1', '#ffe07a', true);
    }
  }
  // Per-second aggregate armor, shared by every hit/DoT/companion. Individual
  // small hits cannot bypass it. Below 2% max HP/s damage is unchanged; excess
  // has logarithmic returns, keeping weak builds viable and burst builds ahead.
  function incoming(e, amount) {
    const h = e.hunt, limit = e.maxHp * .02;
    const effective = raw => Math.min(raw, limit) + limit * .25 * Math.log1p(Math.max(0, raw - limit) / limit);
    const before = h.rawWindow || 0;
    h.rawWindow = before + Math.max(0, amount);
    return effective(h.rawWindow) - effective(before);
  }
  function tickArmor(e, dt) {
    e.hunt.damageWindow += dt;
    if (e.hunt.damageWindow >= 1) { e.hunt.damageWindow %= 1; e.hunt.rawWindow = 0; }
  }
  function rewardPool(index) {
    const rates = G.Gacha.RATES.filter(([r]) => index === 0 || index === 1 && r >= 3 || index === 2 && r === 4 || index === 3 && r === 5);
    return rates.map(([rarity, weight]) => ({ rarity, weight,
      list: G.DEX.filter(m => m.rarity === rarity && G.SPRITE_META[m.dex] && G.Sprites.hasShiny(m.dex)) })).filter(p => p.list.length);
  }
  function rollReward(index) {
    const pools = rewardPool(index);
    if (!pools.length) throw new Error('Hunt shiny reward pool is empty');
    let roll = Math.random() * pools.reduce((n, p) => n + p.weight, 0), selected = pools.at(-1);
    for (const p of pools) { roll -= p.weight; if (roll <= 0) { selected = p; break; } }
    return G.U.pick(selected.list).dex;
  }
  function grantShiny(dex) {
    const save = G.DB.save, ownedBefore = !!save.owned[dex];
    const isNew = G.DB.grantShiny(dex, 'hunt');
    const resonance = ownedBefore ? G.Resonance.reward(save, dex) : null;
    const refund = isNew ? 0 : G.Gacha.REFUND[G.DEX_BY[dex].rarity] * 3;
    save.coins += refund; save.stats.coinsEarned += refund; save.stats.shinies++;
    const receipt = { dex, isNew, refund, resonance, source: 'hunt', saved: G.DB.commit() !== false };
    persist(receipt.saved);
    return receipt;
  }
  function onDeath(e) {
    if (!run || !e.hunt || e.hunt.paid) return;
    e.hp = 0; onDamage(e); e.hunt.paid = true; e.hunt.dangerous = false;
    const receipt = grantShiny(rollReward(e.hunt.index));
    run.rewards.push(receipt); run.kills++; run.breather = 8;
    G.Game.recordHuntReward(receipt);
    G.Spawner.say(`狩獵成功！異色 ${G.DEX_BY[receipt.dex].name} ${receipt.isNew ? '加入永久收藏' : `重複補償 +${receipt.refund} 金幣`}${receipt.resonance ? ` · 共鳴 +${receipt.resonance.after}／精華 +${receipt.resonance.essence}` : ''}${receipt.saved ? '' : ' · 待儲存，請勿關閉分頁'}`, 6, true);
    G.Audio.sfx('shinyGet');
    if (e.hunt.index === 3) run.finalPending = true;
  }
  function prompt(p) {
    if (!run?.finalPending || run.finalShown || p.dead || G.Game.state !== 'playing') return;
    run.finalShown = true;
    G.Game.expeditionChoice('hunt-clear', [], id => { if (id === 'extract') G.Game.quit(); });
  }
  // Damage only bypasses attack-generated dash protection. Real invulnerability
  // (damage grace, manual dash, burst, ultimate, Focus Sash, Phoenix) still wins.
  function damage(p, percent, scale = 1) {
    if (!p || p.dead || p.invuln > 0 || G.Expedition?.evading) return false;
    p.hurt(p.maxHp * percent * scale, null, { pierceAttack: true });
    return true;
  }
  function contact(e, p, pet = false) {
    const h = e.hunt, key = pet ? 'petCd' : 'contactCd';
    if (!h || e.dead || !h.dangerous || h[key] > 0) return;
    const percent = TIERS[h.index].contact;
    if (pet) { h[key] = .9; p.hurt(p.maxHp * percent * h.damageScale); }
    else if (damage(p, percent, h.damageScale)) h[key] = .9;
  }
  function sweptContact(p, sx, sy, tx, ty) {
    const vx = tx - sx, vy = ty - sy, len2 = vx * vx + vy * vy;
    for (const e of G.EnemyMgr.all()) {
      if (!e.hunt?.dangerous || e.dead) continue;
      const k = len2 ? G.U.clamp(((e.x - sx) * vx + (e.y - sy) * vy) / len2, 0, 1) : 0;
      if (G.U.dist2(e.x, e.y, sx + vx * k, sy + vy * k) <= (e.r + p.r) ** 2) contact(e, p);
    }
  }
  function hazard(e, data) {
    const h = e.hunt, b = TIERS[h.index];
    return G.Hazards.add(Object.assign({ hunt: true, sourceId: e.id, percent: b.contact * 1.3,
      damageScale: h.damageScale, type: e.atkType, color: b.color, dmg: 0, delay: 1.1 }, data));
  }
  function warn(e, p) {
    const h = e.hunt, b = TIERS[h.index];
    h.move = b.moves[h.step++ % b.moves.length]; h.state = 'warning'; h.dangerous = false;
    h.t = e.hp <= e.maxHp * .25 ? .95 : 1.15;
    h.dx = p.x - e.x; h.dy = p.y - e.y;
    const d = Math.hypot(h.dx, h.dy) || 1; h.dx /= d; h.dy /= d;
    const angle = Math.atan2(h.dy, h.dx), delay = h.t;
    h.label = { slam: '震地預警 · 離開圓圈', charge: '衝鋒預警 · 側移避開', rain: '落點鎖定 · 持續移動', cross: '交叉光束 · 移向空隙' }[h.move];
    e.anim.play('Charge');
    if (h.move === 'slam') hazard(e, { kind: 'zone', x: e.x, y: e.y, r: 100, delay });
    if (h.move === 'charge') hazard(e, { kind: 'beam', x: e.x, y: e.y, angle, len: 245, w: e.r * 2, delay });
    if (h.move === 'cross') for (const a of [angle, angle + Math.PI / 2, angle - Math.PI / 2])
      hazard(e, { kind: 'beam', x: e.x, y: e.y, angle: a, len: 440, w: 38, delay });
    if (h.move === 'rain') {
      hazard(e, { kind: 'zone', x: p.x, y: p.y, r: 64, delay });
      for (const sign of [-1, 1]) hazard(e, { kind: 'zone', x: p.x - h.dy * 125 * sign, y: p.y + h.dx * 125 * sign, r: 54, delay: delay + .3 });
    }
  }
  function move(e, dt, p, dist, dx, dy, spd) {
    const h = e.hunt;
    for (const key of ['contactCd', 'petCd', 'healCd', 'shieldCd']) h[key] = Math.max(0, h[key] - dt);
    h.t -= dt;
    if (h.state === 'warning' && h.t <= 0) {
      h.state = 'attack'; h.t = .65; h.dangerous = true; h.label = '危險核心 · 自動衝刺無法免傷'; e.anim.play('Attack');
    } else if (h.state === 'attack' && h.t <= 0) {
      h.state = 'recover'; h.t = 1.5; h.dangerous = false; h.label = '破綻 · 放心貼近輸出';
    } else if (h.state === 'recover' && h.t <= 0) {
      h.state = 'approach'; h.t = e.hp <= e.maxHp * .5 ? 1.2 : 1.8; h.label = '重新蓄勢';
    } else if (h.state === 'approach' && h.t <= 0 && dist < 460) warn(e, p);
    if (h.state === 'attack' && h.move === 'charge') return [h.dx * 375, h.dy * 375, 'Walk'];
    if (h.state === 'approach' && dist > 80) return [dx * spd, dy * spd, 'Walk'];
    return [0, 0, 'Idle'];
  }
  function draw(ctx) {
    if (!run) return;
    for (const e of G.EnemyMgr.all()) {
      if (!e.hunt || e.dead) continue;
      ctx.save(); ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
      ctx.strokeStyle = e.hunt.dangerous ? '#ff425c' : e.hunt.state === 'warning' ? '#ffcf70' : '#81e7bf';
      ctx.fillStyle = ctx.strokeStyle; ctx.globalAlpha = .16; ctx.fill(); ctx.globalAlpha = .9; ctx.lineWidth = 3; ctx.stroke(); ctx.restore();
    }
  }
  function info() {
    if (!run) return '';
    const b = TIERS[run.next];
    const live = G.EnemyMgr.all().find(e => e.hunt && !e.dead);
    if (live) return `後期狩獵 ${run.kills}/4 · 階段招募券 ${run.tickets}/12 · 交戰中：${live.name} ${Math.max(0, live.hp / live.maxHp * 100).toFixed(0)}%${run.retrySave ? ' · 儲存重試中，請勿關閉分頁' : ''}`;
    return `後期狩獵 ${run.kills}/4 · 階段招募券 ${run.tickets}/12${b ? ` · 下一場 ${G.U.mmss(b.at)} 起` : ''}${run.retrySave ? ' · 儲存重試中，請勿關閉分頁' : ''}`;
  }
  return { TIERS, THRESHOLDS, reset, update, spawn, resume, onDamage, onDeath, incoming, tickArmor, rewardPool, rollReward, grantShiny,
    prompt, damage, contact, sweptContact, move, draw, info, get run() { return run; }, get active() { return !!run; } };
})();
