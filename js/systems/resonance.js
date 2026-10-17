/* Permanent, species-specific duplicate growth. Normal/shiny share one rank.
 * Pure save operations: caller commits once after the whole draw/exchange.
 * No historical copies are inferred from an old save's total pull counter. */
G.Resonance = (() => {
  const MAX = 5;
  const COST = { 4: { grow: 12, recruit: 40 }, 5: { grow: 36, recruit: 120 } };
  const eligible = dex => [4, 5].includes(G.DEX_BY[dex]?.rarity);
  const rank = (save, dex) => eligible(dex) && save?.owned?.[dex]
    ? Math.min(MAX, Math.max(0, Math.floor(Number(save.resonance?.ranks?.[dex]) || 0))) : 0;
  function normalize(save) {
    const old = save.resonance;
    const ranks = {};
    if (old?.ranks && typeof old.ranks === 'object') for (const dex of Object.keys(old.ranks)) {
      if (/^\d+$/.test(dex) && eligible(dex) && save.owned?.[dex]) ranks[dex] = rank(save, dex);
    }
    save.resonance = { ranks, essence: Number.isSafeInteger(old?.essence) && old.essence >= 0 ? Math.min(1e12, old.essence) : 0 };
    return save.resonance;
  }
  function valid(save) {
    const r = save.resonance;
    if (r == null) return true;
    if (typeof r !== 'object' || Array.isArray(r) || !Number.isSafeInteger(r.essence) || r.essence < 0 || r.essence > 1e12
      || !r.ranks || typeof r.ranks !== 'object' || Array.isArray(r.ranks)) return false;
    return Object.entries(r.ranks).every(([dex, n]) => /^\d+$/.test(dex) && eligible(dex) && save.owned?.[dex]
      && Number.isInteger(n) && n >= 0 && n <= MAX);
  }
  function bonus(save, dex) {
    const n = rank(save, dex);
    return { rank: n, atk: 1 + n * .04, hp: 1 + n * .03, cd: n >= 3 ? .95 : 1, spd: n >= 5 ? 1.05 : 1 };
  }
  function reward(save, dex) {
    if (!eligible(dex) || !save.owned?.[dex]) return null;
    const r = normalize(save), before = rank(save, dex), after = Math.min(MAX, before + 1);
    const essence = (G.DEX_BY[dex].rarity === 5 ? 3 : 1) * (before === MAX ? 3 : 1);
    r.ranks[dex] = after; r.essence = Math.min(1e12, r.essence + essence);
    return { before, after, essence, capped: before === MAX };
  }
  function offer(save, dex) {
    if (!eligible(dex) || !G.SPRITE_META[dex]) return null;
    const owned = !!save.owned?.[dex], n = rank(save, dex);
    if (owned && n >= MAX) return null;
    const kind = owned ? 'grow' : 'recruit', cost = COST[G.DEX_BY[dex].rarity][kind];
    return { kind, cost, next: owned ? n + 1 : 0, affordable: (save.resonance?.essence || 0) >= cost };
  }
  function exchange(save, dex) {
    const o = offer(save, dex);
    if (!o?.affordable) return null;
    const r = normalize(save);
    r.essence -= o.cost;
    if (o.kind === 'grow') r.ranks[dex] = o.next;
    else save.owned[dex] = { at: Date.now(), from: 'resonance' };
    // Spending essence is not a gacha draw: no gold, essence refund or pity change.
    return o;
  }
  function summary(save, dex) {
    const b = bonus(save, dex);
    if (!b.rank) return '每階攻擊 +4%、生命 +3%；+3 冷卻縮短 5%，+5 移速 +5%。';
    return `攻擊 +${b.rank * 4}% · 生命 +${b.rank * 3}%${b.rank >= 3 ? ' · 冷卻 −5%' : ''}${b.rank >= 5 ? ' · 移速 +5%' : ''}`;
  }
  return { MAX, COST, eligible, rank, normalize, valid, bonus, reward, offer, exchange, summary };
})();
