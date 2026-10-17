/* ============ upgrades.js — mejoras permanentes entre runs ============
 * Se compran con Pokémonedas en el menú. `per` es lo que da cada nivel.
 */
G.Upgrades = (() => {
  const LIST = [
    { id: 'hp',     icon: 'heart', name: 'Vitalidad',      unit: '+8 vida',            max: 10, base: 60,  grow: 1.35 },
    { id: 'atk',    icon: 'fist', name: 'Fuerza',         unit: '+4% daño',           max: 10, base: 80,  grow: 1.38 },
    { id: 'spd',    icon: 'boot', name: 'Zancada',        unit: '+3% velocidad',      max: 8,  base: 70,  grow: 1.4 },
    { id: 'cd',     icon: 'clock', name: 'Reflejos',       unit: '-3% recarga',        max: 8,  base: 90,  grow: 1.42 },
    { id: 'def',    icon: 'shield', name: 'Coraza',         unit: '+2% defensa',        max: 8,  base: 80,  grow: 1.4 },
    { id: 'regen',  icon: 'sprout', name: 'Síntesis',       unit: '+0.2 vida/s',        max: 5,  base: 120, grow: 1.5 },
    { id: 'magnet', icon: 'magnet', name: 'Imán',           unit: '+12% recogida',      max: 6,  base: 50,  grow: 1.4 },
    { id: 'xp',     icon: 'book', name: 'Sabiduría',      unit: '+5% experiencia',    max: 8,  base: 100, grow: 1.42 },
    { id: 'coins',  icon: 'coin', name: 'Fortuna',        unit: '+8% Pokémonedas',    max: 8,  base: 120, grow: 1.45 },
    { id: 'moves',  icon: 'cards', name: 'Repertorio',     unit: 'Empiezas con 2 movimientos', max: 1, base: 1500, grow: 1 }
  ];
  const BY = {};
  for (const u of LIST) BY[u.id] = u;

  function cost(id, lvl) {
    const u = BY[id];
    return Math.round(u.base * Math.pow(u.grow, lvl) / 10) * 10;
  }

  /** Niveles comprados -> modificadores para G.Player. */
  function perks(levels = {}) {
    const L = id => levels[id] || 0;
    return {
      hp: L('hp') * 8,
      atkMul: 1 + L('atk') * 0.04,
      spdMul: 1 + L('spd') * 0.03,
      cdMul: 1 - L('cd') * 0.03,
      dmgReduce: L('def') * 0.02,
      regen: L('regen') * 0.2,
      magnetMul: 1 + L('magnet') * 0.12,
      xpMul: 1 + L('xp') * 0.05,
      coinMul: 1 + L('coins') * 0.08,
      startMoves: 1 + L('moves')
    };
  }

  // One-time solo migration. Legacy account upgrades are a historical copy,
  // not another purchase: only per-Pokémon duplicate costs are refunded.
  function globalize(save) {
    if (save.sharedUpgradeVersion === 1) return 0;
    const level = (value, max) => Number.isFinite(value) ? Math.min(max, Math.max(0, Math.floor(value))) : 0;
    const spent = (id, n) => { let total = 0; for (let i = 0; i < n; i++) total += cost(id, i); return total; };
    const global = {}, legacy = save.upgrades || {};
    let refund = 0;
    for (const u of LIST) {
      const levels = Object.values(save.pupg || {}).map(v => level(v?.[u.id], u.max));
      const best = Math.max(0, ...levels);
      global[u.id] = Math.max(best, level(legacy[u.id], u.max));
      refund += levels.reduce((sum, n) => sum + spent(u.id, n), 0) - spent(u.id, best);
    }
    save.upgrades = global;
    save.coins += refund;
    save.sharedUpgradeVersion = 1;
    save.sharedUpgradeRefund = refund;
    return refund;
  }

  return { LIST, BY, cost, perks, globalize };
})();
