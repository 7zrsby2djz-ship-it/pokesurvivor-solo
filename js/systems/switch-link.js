/* Switch links (切招連攜): two one-shot recipes that reward a well-timed
 * manual move switch. No damage multiplier, no invulnerability, no cooldown
 * reset; only the shape/pierce of the NEXT real cast changes.
 *
 *   回身掃擊  primary dash hit  → switch to a melee group  → next melee is 360°
 *   破陣穿透  primary melee hit → switch to a ranged group → first projectile +1 pierce
 *
 * Sources: only the local main player's own synchronous dash/melee cast that
 * really lowered enemy HP or shield. Echo/guardian assists, ultimates, ghosts,
 * DoT and items never count (Combat only opens a cast context in tickMove).
 * Time is simulation time, so pause / level-up menus never expire a window.
 */
G.SwitchLinkCore = (() => {
  const SOURCE_WINDOW = 2, CAST_WINDOW = 3, COOLDOWN = 8;
  const ranged = kind => ['projectile', 'nova', 'cone'].includes(kind);
  const validTime = at => Number.isFinite(at) && at >= 0;
  const keyOf = group => group.map(m => m.id).sort().join('|');
  // Which recipe a switch from a `sourceKind` hit into `toGroup` would arm.
  const recipeFor = (sourceKind, toGroup) => sourceKind === 'dash' && toGroup.some(m => m.kind === 'melee') ? 'backsweep'
    : sourceKind === 'melee' && toGroup.some(m => ranged(m.kind)) ? 'breach' : null;

  function create() {
    let source = null, gate = null, availableAt = 0;
    function reset() { source = gate = null; availableAt = 0; }
    function cancel() { source = gate = null; } // addMove/fusion/automatic selection
    function noteHit({ origin, kind, groupKey, at, damaged }) {
      if (origin !== 'primary' || !damaged || !['dash', 'melee'].includes(kind) || !groupKey || !validTime(at)) return false;
      const fresh = !source || source.kind !== kind || source.groupKey !== groupKey;
      source = { kind, groupKey, at };
      return fresh;
    }
    function manualSwitch({ fromKey, toGroup, at }) {
      const toKey = keyOf(toGroup);
      if (!fromKey || !toKey || fromKey === toKey || !validTime(at)) return null;
      gate = null; // Every accepted switch cancels the previous offer.
      if (at < availableAt || !source || source.groupKey !== fromKey || at < source.at || at - source.at > SOURCE_WINDOW) return null;
      const id = recipeFor(source.kind, toGroup);
      if (!id) return null;
      gate = { id, toKey, armedAt: at, until: at + CAST_WINDOW };
      return id;
    }
    // Call AFTER real target/cooldown validation, immediately before run().
    function takeCast({ groupKey, kind, at, origin }) {
      if (origin !== 'primary' || !validTime(at) || !gate) return null;
      if (at > gate.until || groupKey !== gate.toKey) { gate = null; return null; }
      if (at < gate.armedAt || at < availableAt) return null;
      if (!(gate.id === 'backsweep' ? kind === 'melee' : ranged(kind))) return null;
      const modifier = gate.id === 'backsweep'
        ? { id: 'backsweep', arc: 6.2832 }
        : { id: 'breach', firstProjectilePierce: 1 };
      availableAt = at + COOLDOWN;
      source = gate = null;
      return modifier;
    }
    function peek(at) {
      if (gate && at > gate.until) gate = null;
      const offer = source && at >= source.at && at - source.at <= SOURCE_WINDOW && at >= availableAt
        ? { kind: source.kind, groupKey: source.groupKey, left: SOURCE_WINDOW - (at - source.at) } : null;
      return { ready: !!gate && at >= gate.armedAt && at <= gate.until,
        id: gate?.id || null, left: gate ? Math.max(0, gate.until - at) : 0,
        cooldown: Math.max(0, availableAt - at), offer };
    }
    return { reset, cancel, noteHit, manualSwitch, takeCast, peek };
  }
  return { create, keyOf, recipeFor, ranged, SOURCE_WINDOW, CAST_WINDOW, COOLDOWN };
})();

G.SwitchLink = (() => {
  const Core = G.SwitchLinkCore;
  const NAMES = { backsweep: '回身掃擊', breach: '破陣穿透' };
  const COLORS = { backsweep: '#ffd166', breach: '#7fe0ff' };
  let player = null, core = null;
  const now = () => G.Game?.st?.time ?? 0;
  const primary = p => !!core && p === player && !p.remote && !p.dead;

  function start(p) { player = p || null; core = p ? Core.create() : null; stats.used = 0; }
  function cancel(p) { if (core && (!p || p === player)) core.cancel(); }

  /** Player.setActive accepted an explicit input switch. */
  function manualSwitch(p, fromKey) {
    if (!primary(p)) return null;
    const id = core.manualSwitch({ fromKey, toGroup: p.activeGroup(), at: now() });
    if (id) {
      G.FX.ring(p.x, p.y, p.r, p.r * 3, COLORS[id], .28, 3);
      G.Audio.sfx('select');
    }
    return id;
  }

  /** Combat.tickMove, after target/cooldown checks: maybe a one-cast modified copy. */
  function cast(p, m, at) {
    if (!primary(p)) return null;
    const mod = core.takeCast({ origin: 'primary', groupKey: Core.keyOf(p.activeGroup()), kind: m.kind, at });
    if (!mod) return null;
    G.FX.dmgText(p.x, p.y - p.bodyH - 20, NAMES[mod.id] + '！', COLORS[mod.id], true);
    G.Camera.kick(.15);
    G.Progress?.event?.('switchLink');
    stats.used++;
    return mod.id === 'backsweep' ? Object.assign({}, m, { arc: mod.arc, link: mod.id })
      : Object.assign({}, m, { linkPierce: mod.firstProjectilePierce, link: mod.id });
  }

  /** A tracked primary dash/melee hit that really lowered HP or shield. */
  function noteHit(p, m, at) {
    if (!primary(p)) return;
    core.noteHit({ origin: 'primary', kind: m.kind, groupKey: Core.keyOf(p.activeGroup()), at, damaged: true });
  }

  /** For the HUD: which slot would arm a recipe right now, and what is armed. */
  function view(p) {
    if (!primary(p)) return null;
    const v = core.peek(now());
    let target = -1, recipe = null;
    if (v.offer && !p.hasItem('choiceband')) {
      p.slots.forEach((g, i) => {
        if (target >= 0 || i === p.active || !g.length || Core.keyOf(g) === v.offer.groupKey) return;
        const id = Core.recipeFor(v.offer.kind, g);
        if (id) { target = i; recipe = id; }
      });
    }
    return { ready: v.ready, id: v.id, name: v.id ? NAMES[v.id] : '', color: v.id ? COLORS[v.id] : '',
      left: v.left, cooldown: v.cooldown, target, offerName: recipe ? NAMES[recipe] : '', offerColor: recipe ? COLORS[recipe] : '',
      offerLeft: v.offer?.left || 0 };
  }

  const stats = { used: 0 };
  return { start, cancel, manualSwitch, cast, noteHit, view, NAMES, COLORS,
    get stats() { return stats; }, resetStats() { stats.used = 0; } };
})();
