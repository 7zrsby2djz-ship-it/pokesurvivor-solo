// Focused, deterministic mechanics check. Real Player/Moves/Combat/DB in a VM;
// browser rendering/audio/world services are small stubs. No network or real saves.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const memory = new Map(), shots = [], prompts = [], announcements = [];
const noop = () => {};
let seed = 147, wall = Infinity, enemies = [], axis = [1, 0], levels = 0, bankedTickets = 0;
const math = Object.create(Math);
math.random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const G = { SOLO: true, T: s => s, Settings: { get: () => false },
  Sprites: { Animator: class { update() {} loop() {} play() {} }, bodyRadius: () => 12, bodyHeight: () => 24, hasShiny: () => false, dirFromAngle: () => 0, preload: noop },
  FX: new Proxy({}, { get: () => noop }), Audio: { sfx: noop },
  Path: { dirFor: () => null },
  World: { isWall: () => false, isFree: () => true, projectileBlock: () => false, collide: p => { p.x = Math.min(p.x, wall); }, isLiquid: () => false, liquidEffect: () => ({}), nearestBreakable: () => null, propsInCircle: () => [] },
  Weather: { speedFor: () => 1, mult: () => 1 }, Camera: { kick: noop, sees: () => true },
  Coop: { active: false }, Input: { axis: () => axis }, Rift: { inArena: false },
  Projectiles: { clearOrbs: noop, nearest: () => enemies[0], spawn: p => shots.push(p) },
  EnemyMgr: { all: () => enemies, queryCircle: () => enemies, bossAlive: () => false }, Pickups: { pullAll: noop },
  Spawner: { say: s => announcements.push(s), burst: noop, expeditionChampion: () => null }, VFX: { forMove: () => ({}) },
  Game: { st: { time: 0 }, state: 'playing', awardXp: n => { levels += G.Game.player.gainXp(n); },
    awardTickets: n => { G.Game.player.t1 += n; bankedTickets += n; },
    expeditionChoice: (kind, list, cb) => { G.Game.state = 'expedition'; prompts.push({ kind, list, cb }); },
    quit: () => { G.Game.state = 'over'; } }
};
const ctx = vm.createContext({ G, Math: math, window: { G }, document: { addEventListener: noop, hidden: false },
  addEventListener: noop, dispatchEvent: noop, CustomEvent: class {}, navigator: { onLine: true },
  localStorage: { getItem: k => memory.get(k) || null, setItem: (k,v) => memory.set(k,v), removeItem: k => memory.delete(k) },
  performance: { now: () => 100000 }, Date, console, setTimeout, clearTimeout });
const load = p => vm.runInContext(fs.readFileSync(path.join(root, p), 'utf8'), ctx, { filename: p });
for (const p of ['core/util', 'data/pokedex', 'data/moves', 'data/types', 'data/starters', 'data/upgrades', 'systems/growth', 'entities/player', 'systems/combat', 'systems/levelup', 'systems/expedition', 'systems/expedition-trials', 'systems/ultimate', 'systems/hazards', 'core/db', 'systems/guardian-steering', 'systems/guardian', 'ui/guardian-ui']) load('js/' + p + '.js');
const E = G.Expedition;
function player(options = {}) {
  G.Game.state = 'playing'; G.Rift.inArena = false; enemies = []; wall = Infinity;
  const p = new G.Player(G.DEX_BY[4]); G.Game.player = p;
  p.addMove(G.startMoveOf(4)); E.start(p, options); return p;
}
function choice(index = 0) {
  const q = prompts.shift(); assert.ok(q); G.Game.state = 'playing';
  q.cb(q.kind === 'supply' ? q.list[index].id : index === 0 ? 'extract' : 'continue');
  return q;
}
const checks = [];

let p = player({ mode: 'classic' });
assert.equal(E.active, false); assert.equal(p.xpMul, 1); assert.equal(E.dash(p), false);
assert.equal(p.maxHp, G.DEX_BY[4].hp); checks.push('classic mode retains original stats and rules');

p = player({ style: 'ranger', difficulty: 'wild' });
assert.equal(E.dashCooldown(), 4.5); assert.equal(p.coinMul, 1.5);
const boss = { hp: 100, maxHp: 100, dmg: 10 }; E.scaleEnemy(boss, 720, true);
assert.equal(boss.hp, 125); assert.equal(boss.dmg, 12);
assert.equal(E.dash(p), true); assert.equal(E.dash(p), false);
wall = 20; for (let i = 0; i < 8; i++) E.motion(p, 1 / 30);
assert.ok(p.x > 0 && p.x <= 20); assert.equal(E.run.dashT, 0);
assert.ok(p.invuln > 0); checks.push('difficulty, dash cooldown, invulnerability, wall collision');

p = player({ style: 'vanguard' });
const before = p.hp; p.hurt(10);
assert.equal(p.hp, before); assert.ok(E.run.shield < p.maxHp * .2);
E.take('ward', p); E.run.shield = 0;
E.update(19, p, 19); assert.equal(E.run.shield, 0);
E.update(1, p, 20); assert.ok(E.run.shield > 0);
E.take('phoenix', p); E.run.shield = 0; p.invuln = 0; p.hurt(99999);
assert.equal(p.dead, false); assert.equal(E.run.phoenixUsed, true);
p.invuln = 0; p.hurt(99999); assert.equal(p.dead, true);
checks.push('shield absorption/regeneration and exactly one lethal rescue');

p = player({ style: 'scholar' });
assert.equal(p.extraRerolls, 2);
const offered = G.LevelUp.offer(p); assert.equal(offered.length, 3);
assert.ok(offered.some(c => ['new','up'].includes(c.type) && G.Moves.BY_ID[c.key.split(':')[1]].kind !== 'buff'));
assert.equal(new Set(offered.map(c => c.key)).size, 3);
E.take('bloom', p); p.hp = 10; p.gainXp(p.xpNext / p.xpMul + .1);
assert.equal(p.level, 2); assert.ok(p.hp > 10);
E.take('momentum', p); const attack = p.atk;
for (let i = 0; i < 10; i++) E.onKill(p, {});
assert.ok(p.atk > attack); E.update(8.1, p, 8.1); assert.equal(p.atk, attack);
checks.push('offensive opening choice, level healing and combo expiry');

p = player();
const projectileId = Object.keys(G.Moves.BY_ID).find(id => G.Moves.BY_ID[id].kind === 'projectile' && !p.hasMove(id));
p.addMove(projectileId); const m = p.moves.at(-1); p.setActive(0); p.target = { x: 30, y: 0 };
E.take('echo', p); const cooldown = m.t, originalDamage = m.dmg;
E.update(4, p, 4);
assert.ok(shots.length > 0); assert.equal(shots[0].dmg, originalDamage * .45 * p.atk);
assert.equal(m.t, cooldown); assert.equal(m.dmg, originalDamage);
checks.push('echo casts real projectiles without altering learned move or cooldown');

p = player(); prompts.length = 0;
for (const time of E.SUPPLIES) {
  E.update(.1, p, time); G.Game.state = 'levelup'; E.prompt(p); assert.equal(prompts.length, 0);
  G.Game.state = 'playing'; E.prompt(p); const q = prompts[0];
  assert.equal(q.kind, 'supply'); assert.equal(new Set(q.list.map(x => x.id)).size, 3);
  assert.ok(q.list.every(x => !E.run.relics.includes(x.id)));
  choice();
}
assert.equal(E.run.relics.length, 4); assert.equal(new Set(E.run.relics).size, 4);
checks.push('four unique relic drafts wait for existing modal choices');

p = player(); E.update(.1, p, 35);
for (let i = 0; i < 18; i++) E.onKill(p, {});
E.update(.1, p, 36); assert.equal(E.run.contracts, 1); assert.equal(p.coins, 65);
E.update(.1, p, 250); assert.equal(E.run.contract.id, 'travel');
G.Rift.inArena = true; const left = E.run.contract.left; p.x += 9000;
E.update(10, p, 260); assert.equal(E.run.contract.left, left); assert.equal(E.run.contract.progress, 0);
G.Rift.inArena = false;
for (let i = 0; i < 61; i++) { p.x += 30; E.update(.1, p, 260 + i / 10); }
assert.equal(E.run.contracts, 2);
E.update(.1, p, 440); E.update(101, p, 541); assert.equal(E.run.contract, null);
checks.push('kill/travel contracts, timeout and rift teleport isolation');

p = player(); prompts.length = 0; E.run.supply = 4; E.run.time = 735;
const beforeFinalTickets = bankedTickets;
E.onKill(p, { boss: true, expeditionFinal: true }); E.prompt(p);
assert.equal(prompts[0].kind, 'clear'); assert.equal(p.coins, 300); assert.equal(p.t1, 2);
choice(1); E.prompt(p); assert.equal(prompts.length, 0); assert.equal(p.coins, 300);
const save = { coins: 123, owned: { 4: { from: 'starter' } }, stats: {} };
const result = E.settle(save); assert.equal(result.cleared, true); assert.equal(save.stats.expeditionWins, 1);
assert.equal(E.settle(save), null); assert.equal(save.coins, 123); assert.equal(save.owned[4].from, 'starter');
assert.equal(bankedTickets, beforeFinalTickets + 2); checks.push('final boss reward and settlement cannot be duplicated');

// Existing v3 imports migrate additively; the collection and upgrades survive.
const old = { format: 'pokesurvivor-solo', version: 1, save: { v: 3, name: '訓練家', coins: 4321,
  owned: { 4: { at: 1, from: 'starter' } }, partner: 4, pupg: { 4: { hp: 2 } }, stats: { runs: 9 }, pupgDone: true } };
const migrated = G.DB.parseBackup(JSON.stringify(old));
assert.equal(migrated.coins, 4321); assert.equal(migrated.partner, 4); assert.equal(migrated.pupg[4].hp, 2);
assert.equal(migrated.stats.runs, 9); assert.equal(migrated.stats.expeditionWins, 0);
old.save.stats.expeditionWins = 5;
assert.equal(G.DB.parseBackup(JSON.stringify(old)).stats.expeditionWins, 5);
checks.push('old and new save backups preserve progression and expedition records');

// 0.3: new combinations, actual melee/hazard hooks, risk selection and mastery.
p = player({ focus: 'frost' });
assert.equal(E.choices()[0].id, 'frost'); E.take('frost', p);
assert.ok(E.choices().some(r => r.id === 'spark'));
E.take('spark', p); assert.equal(E.synergy('storm'), true);
let shock = 0, slow = 0;
enemies = [{ x: 10, y: 0, hurt: d => { shock += d; }, applySlow: n => { slow = n; } }];
E.dash(p); assert.equal(shock, 60 * p.atk); assert.equal(slow, .6);
G.Game.state = 'expedition'; const rerolls = E.run.relicRerolls;
assert.equal(E.reroll().length, 3); assert.equal(E.run.relicRerolls, rerolls - 1);
assert.equal(E.reroll(), null); checks.push('research focus, guaranteed pair, storm synergy and limited rerolls');

p = player(); E.take('bloom', p); E.take('vampire', p);
E.run.shield = 0; p.hp = p.maxHp; p.heal(999);
assert.equal(E.run.shield, p.maxHp * .3);
E.take('phoenix', p); E.take('ward', p); E.run.shield = 0; p.invuln = 0; p.hurt(99999);
assert.equal(E.run.shield, p.maxHp * .35); assert.equal(p.dead, false);
checks.push('healing overflow cap and revived synergy shield');

p = player(); E.take('echo', p); E.take('prism', p); shots.length = 0;
const projectileIds = Object.keys(G.Moves.BY_ID).filter(id => G.Moves.BY_ID[id].kind === 'projectile' && !p.hasMove(id)).slice(0, 2);
projectileIds.forEach(id => p.addMove(id)); p.setActive(0); p.target = { x: 30, y: 0 };
E.update(4, p, 4);
const expectedShots = p.moves.filter(m => !p.activeGroup().includes(m) && !G.Ultimate.is(m)).reduce((sum, m) => sum + Math.max(1, m.count | 0), 0);
assert.equal(shots.length, expectedShots); assert.equal(E.run.echoT, 2.8);
checks.push('choir casts two distinct backup moves');

p = player(); p.hp = 10; p.aim = 0;
const meleeId = Object.keys(G.Moves.BY_ID).find(id => G.Moves.BY_ID[id].kind === 'melee');
const melee = G.Moves.instance(meleeId, 1);
enemies = [{ x: 8, y: 0, r: 8, types: ['normal'], hurt: noop, applySlow: noop, applyBurn: noop, applyPoison: noop }];
p.target = enemies[0];
for (let i = 0; i < 10; i++) G.Combat.assist(p, melee, 1);
assert.equal(E.run.breakouts, 1); assert.equal(E.run.bravery, 0); assert.ok(p.hp > 10); assert.ok(p.invuln >= .5);
enemies = []; p.invuln = 0; E.run.shield = 0; G.Hazards.clear(); E.dash(p);
const hpBeforeHazard = p.hp;
G.Hazards.add({ kind: 'zone', x: p.x, y: p.y, r: 40, delay: 0, dmg: 20, type: 'normal' });
G.Hazards.update(.1); assert.equal(p.hp, hpBeforeHazard);
E.update(.4, p, .4); G.Hazards.clear();
G.Hazards.add({ kind: 'zone', x: p.x, y: p.y, r: 40, delay: 0, dmg: 1, type: 'normal' });
G.Hazards.update(.1); assert.ok(p.hp < hpBeforeHazard);
checks.push('real melee hook triggers courage; real hazard respects dash window then hurts');

p = player(); const T = G.ExpeditionTrials; prompts.length = 0;
T.prompt(p, 125); assert.equal(prompts[0].kind, 'trial');
const trial = prompts.shift(); G.Game.state = 'playing'; trial.cb('hunt');
assert.equal(T.rate, 1.65);
for (let i = 0; i < T.state.active.goal; i++) E.onKill(p, {});
T.update(.1, p); assert.equal(T.state.wins, 1); assert.equal(E.run.bonusSupplies, 1);
E.prompt(p); assert.equal(prompts[0].kind, 'supply'); choice();
assert.equal(E.run.bonusSupplies, 0); assert.equal(E.run.relics.length, 1);
T.prompt(p, 305); prompts.shift(); G.Game.state = 'playing';
T.start('champions', p); assert.equal(T.state.active, null); assert.ok(T.state.rest > 0);
checks.push('trial success supplies one bonus relic; impossible champion spawn safely becomes camp');

p = player(); const champion = { hp: 100, maxHp: 100, dmg: 10, spd: 100, xp: 5, x: 0, y: 0 };
T.decorate(champion, 200, true); assert.ok(champion.expElite); assert.equal(champion.hp, 180);
const ticketBefore = bankedTickets;
for (let i = 0; i < 5; i++) E.onKill(p, champion);
assert.equal(T.state.elites, 5); assert.equal(bankedTickets, ticketBefore + 1);
const meta = { stats: { expXP_4: 24 } }; E.run.time = 90; E.take('frost', p); E.take('spark', p);
const ending = E.settle(meta);
assert.equal(ending.mastery.rank, 1); assert.equal(ending.masteryBonus, 120);
assert.equal(meta.stats.relic_frost, 1); assert.equal(meta.stats.synergy_storm, 1);
assert.equal(E.settle(meta), null);
checks.push('elite payout, permanent discovery, partner mastery and once-only promotion reward');

// 0.4: overlapping investments, an independent fifth move and manual crowd control.
const legacy = JSON.parse(JSON.stringify(old));
legacy.save.pupg = { 4: { hp: 2, atk: 1 }, 7: { hp: 3 }, 25: { atk: 2 } };
legacy.save.upgrades = { hp: 2 }; // historical account copy, never charge/refund twice
const unified = G.DB.parseBackup(JSON.stringify(legacy));
assert.equal(unified.upgrades.hp, 3); assert.equal(unified.upgrades.atk, 2);
assert.equal(unified.sharedUpgradeRefund, 220); assert.equal(unified.coins, 4541);
assert.deepEqual(JSON.parse(JSON.stringify(unified.pupg)), legacy.save.pupg);
assert.equal(G.Upgrades.globalize(unified), 0); assert.equal(unified.coins, 4541);
const reload = G.DB.parseBackup(JSON.stringify({ ...old, save: unified }));
assert.equal(reload.coins, 4541); assert.equal(reload.sharedUpgradeVersion, 1);
await G.DB.ready(); G.DB.importSave(JSON.stringify({ ...old, save: unified }));
assert.equal(G.DB.upgradesOf(4), G.DB.upgradesOf(7));
G.DB.upgradesOf(4).spd = 2; assert.equal(G.DB.upgradesOf(9999).spd, 2);
assert.equal(G.Upgrades.perks(G.DB.upgradesOf(4)).hp, 24);
assert.equal(G.DB.save.owned[4].from, 'starter');
checks.push('global upgrade maxima, exact duplicate refund, legacy copy, reload/import and future partners');

const U = G.Ultimate;
for (const dex of [1, 4, 10, 19, 66, 81, 92, 197]) {
  E.reset(); const pl = new G.Player(G.DEX_BY[dex]); G.Game.player = pl; G.Game.state = 'playing';
  pl.addMove(G.startMoveOf(dex)); E.start(pl);
  assert.ok(U.state().move.kind === 'melee'); assert.equal(pl.slots.length, 1);
  assert.ok(pl.activeGroup().some(m => m.kind !== 'buff'));
  assert.equal(pl.slots.flat().includes(U.state().move), false);
  assert.equal(pl.moves.filter(m => m === U.state().move).length, 1);
}
p = player();
while (p.slots.length < 4) p.addMove(G.Moves.poolFor(p.mon).find(id => !p.hasMove(id)));
assert.equal(p.moves.length, 5); assert.equal(p.slots.length, 4);
G.Moves.levelUp(U.state().move); assert.equal(U.state().move.lvl, 2);
const oldUltimate = U.state().move;
p = player({ mode: 'classic' }); assert.equal(U.state(), undefined); assert.equal(U.fire(p), false);
checks.push('melee/ranged starters retain an automatic attack; independent upgradable fifth slot; classic isolation');

function foe(hp = 100, extra = {}) {
  return { x: 12, y: 0, hp, maxHp: hp, types: ['normal'], dead: false, ...extra,
    hurt(n) { this.hp -= Math.max(1, Math.round(n)); if (this.hp <= 0) this.dead = true; } };
}
p = player(); p.hp = 20; E.dash(p);
enemies = Array.from({ length: 12 }, () => foe());
const chief = foe(1000, { boss: true }), elite = foe(1500, { expElite: 'ward' }); enemies.push(chief, elite);
assert.equal(U.fire(p), true); assert.equal(U.fire(p), false);
assert.ok(U.state().cast.radius > 186); assert.ok(p.invuln >= .9);
assert.ok(enemies.slice(0, 12).every(e => e.dead)); assert.ok(chief.hp >= 840); assert.ok(!elite.dead);
const cd = U.state().cd; G.Game.state = 'paused'; U.update(60, p);
assert.equal(U.state().cd, cd); assert.equal(U.fire(p), false);
G.Game.state = 'playing'; U.update(.2, p);
assert.equal(U.state().kills, 12); assert.equal(U.state().best, 12); assert.equal(E.run.dashCd, 0); assert.ok(p.hp > 20);
U.update(100, p); assert.equal(U.state().cd, 0);
p.cdMul = .01; assert.equal(U.cooldown(p), 20.8);
checks.push('manual crowd clear, boss/elite survival, dash combination, kill reward, pause and cooldown bounds');

p = player(); p.addMove('vine-whip'); G.Game.state = 'paused';
const original = U.state().move, next = p.moves.find(m => m.id === 'vine-whip');
G.Moves.levelUp(next); assert.equal(U.swap(p, 'vine-whip'), true);
assert.equal(U.state().move, next); assert.equal(next.lvl, 2); assert.ok(p.slots.flat().includes(original));
assert.ok(!p.slots.flat().includes(next)); assert.ok(U.state().cd >= 20);
G.Game.state = 'playing'; U.update(40, p); enemies = [foe(10000, { boss: true })];
assert.equal(U.fire(p), true); const firstHp = enemies[0].hp;
U.update(.23, p); assert.ok(enemies[0].hp < firstHp);
G.Game.state = 'paused'; const frozenHp = enemies[0].hp; U.update(60, p); assert.equal(enemies[0].hp, frozenHp);
G.Game.state = 'playing'; U.update(.23, p); U.update(.13, p);
assert.equal(U.state().cast, null); assert.ok(enemies[0].hp >= 8398);
G.Game.state = 'paused'; assert.equal(U.swap(p, original.id), true); assert.ok(U.state().cd >= 20);
p = player(); p.addMove('bite'); G.Game.state = 'paused'; U.swap(p, 'bite');
G.Game.state = 'playing'; U.update(40, p); p.hp = 10; enemies = [foe(1000, { expElite: 'ward' })];
U.fire(p); U.update(.23, p); U.update(.13, p); assert.ok(p.hp > 10);
checks.push('pause swaps preserve levels and slots, cannot reset CD, whirlwind pulses freeze, reaper healing');

// 0.5: protect -> evolve -> hunt -> return, with the actual player/moves/save code.
const H = G.Guardian;
p = player({ mode: 'guardian' }); prompts.length = 0;
H.update(59, p); assert.equal(H.state.chest, null);
H.update(1, p); assert.ok(H.state.chest); assert.equal(H.prompt(p), false);
Object.assign(p, { x: H.state.chest.x, y: H.state.chest.y });
H.update(3, p); assert.equal(H.state.opened, true);
G.Game.state = 'levelup'; assert.equal(H.prompt(p), false);
G.Game.state = 'playing'; E.prompt(p); assert.equal(prompts[0].kind, 'guardian');
const rescueChoice = prompts.shift(); G.Game.state = 'playing'; rescueChoice.cb('wings');
assert.equal(H.state.pet.dex, 10); assert.equal(H.state.pet.moves.length, 0);
assert.equal(H.recruit('flame', p), false); assert.equal(H.prompt(p), false);
H.update(54, p); assert.equal(H.state.stage, 0); assert.equal(H.state.shots, 0);
H.update(1, p); assert.equal(H.state.pet.dex, 11); assert.equal(H.state.pet.moves.length, 0);
const growth = H.state.growth, elapsed = H.state.elapsed;
G.Game.state = 'paused'; H.update(90, p); assert.equal(H.state.growth, growth);
G.Game.state = 'playing'; G.Rift.inArena = true; H.update(90, p);
assert.equal(H.state.elapsed, elapsed); assert.equal(H.actor(), null);
p.x = 2000; G.Rift.inArena = false; H.update(.01, p);
assert.ok(Math.hypot(H.actor().x - p.x, H.actor().y - p.y) < 100);
H.state.pet.x = p.x + 350; H.update(.001, p);
assert.ok(H.state.growth < growth + .02); // cannot leave the child behind to farm growth
checks.push('guardian chest/choice once, no juvenile attacks, first evolution, pause/rift/nearby-only growth');

let pet = H.state.pet; pet.invuln = 0; H.hurt(99999);
assert.equal(pet.dead, true); assert.equal(p.dead, false);
const frozenGrowth = H.state.growth;
pet.x = p.x + 500; H.update(1, p); assert.equal(H.state.growth, frozenGrowth);
assert.equal(H.recall(p), true); assert.equal(H.recall(p), false);
H.update(1, p); assert.equal(pet.dead, true);
H.update(2, p); assert.equal(pet.dead, false); assert.equal(H.state.revives, 1);
assert.equal(pet.hp, pet.maxHp * .6); assert.equal(H.state.growth, frozenGrowth);
const walker = { x: 0, y: 0 }; wall = 12;
G.GuardianSteering.advance(walker, { x: 120, y: 0 }, 300, .5, null);
assert.ok(walker.x > 0 && walker.x <= wall); wall = Infinity;
assert.equal(H.targetFor({ id: 3, x: pet.x, y: pet.y, boss: true }, p), p);
assert.equal(H.targetFor({ id: 3, x: pet.x, y: pet.y }, p), pet);
// Real hazard and hostile projectile collision hooks hurt the companion.
G.Hazards.clear(); E.run.shield = 9999; pet.invuln = 0;
let hp = pet.hp;
G.Hazards.add({ kind: 'zone', x: pet.x, y: pet.y, r: 20, delay: .1, dmg: 10 });
G.Hazards.update(.11); assert.ok(pet.hp < hp);
pet.x = p.x + 80; pet.invuln = 0; hp = pet.hp;
const hostile = [{ x: pet.x, y: pet.y, r: 3, dmg: 10, friendly: false }];
G.Projectiles.all = () => hostile; G.Combat.resolve(.01, p, 200);
assert.ok(pet.hp < hp); assert.equal(hostile.length, 0);
checks.push('downed rescue/recall cooldown, collision-safe steering, enemy targeting, hazard/projectile damage');

for (const line of H.LINES) {
  p = player({ mode: 'guardian' }); H.state.opened = true; H.recruit(line.id, p);
  for (let i = 0; i < line.times.length; i++) { H.state.growth = line.times[i] - .01; H.update(.02, p); }
  assert.equal(H.mature(), true); assert.equal(H.state.pet.dex, line.stages.at(-1));
  assert.equal(H.state.pet.moves.length, 1);
  const child = H.state.pet;
  const target = foe(10000, { x: child.x + 50, y: child.y, r: 12, bodyH: 24,
    applySlow: noop, applyBurn: noop, applyPoison: noop });
  enemies = [target]; shots.length = 0; H.state.attackCd = 0;
  const damageBefore = p.dmgDealt; H.update(.1, p);
  assert.equal(H.state.shots, 1);
  assert.ok(target.hp < 10000 || shots.length > 0);
  if (target.hp < 10000) assert.ok(p.dmgDealt > damageBefore);
  assert.ok(G.GuardianUI.choice('guardian', H.LINES).includes('我會保護你'));
}
checks.push('all five final forms cast actual attacks and reuse local species/move data');

// Controlled boss clock: allow a power moment, wait for other bosses, warn, then hunt.
enemies = []; let otherBoss = true, spawned = 0;
G.EnemyMgr.bossAlive = () => otherBoss;
G.Spawner.guardianBoss = () => { spawned++; return foe(5000, { boss: true, spd: 50, dmg: 40 }); };
H.state.grace = 1; H.update(1, p); assert.equal(spawned, 0);
H.update(1, p); assert.equal(H.state.warning, null);
otherBoss = false; H.update(.01, p); assert.equal(H.state.warning, 8); assert.ok(H.blocksBoss);
H.update(7, p); assert.equal(spawned, 0);
H.update(1, p); assert.equal(spawned, 1); assert.ok(H.blocksBoss);
H.state.boss.hp = 2000; H.update(.1, p); assert.equal(H.state.bossPhase, 2);
assert.ok(H.state.boss.spd > 50);
pet = H.state.pet; pet.invuln = 0; H.hurt(99999);
H.state.boss.dead = true; E.onKill(p, H.state.boss);
assert.equal(H.prompt(p), false); // winning never abandons a downed companion
H.recall(p); H.update(3, p); assert.equal(pet.dead, false);
prompts.length = 0; const coinsBefore = p.coins, ticketsBefore = bankedTickets;
assert.equal(H.prompt(p), true); assert.equal(prompts[0].kind, 'guardian-clear');
assert.equal(p.coins, coinsBefore + 250); assert.equal(bankedTickets, ticketsBefore + 3);
for (const dex of H.state.line.stages) assert.ok(G.DB.save.owned[dex]);
const completedChoice = prompts.shift(); G.Game.state = 'playing'; completedChoice.cb('continue');
assert.equal(H.prompt(p), false); assert.equal(p.coins, coinsBefore + 250);
assert.equal(G.DB.save.stats.guardianBonds, 1); assert.equal(H.snapshot().completed, true);
assert.ok(G.GuardianUI.choice('guardian-clear', []).includes('已加入收藏'));
const guardianSave = G.DB.parseBackup(JSON.stringify({ format: 'pokesurvivor-solo', version: 1, save: G.DB.save }));
assert.equal(guardianSave.stats.guardianBonds, 1); assert.ok(guardianSave.owned[H.state.line.stages.at(-1)]);
const guardianResult = E.settle(guardianSave); assert.equal(guardianResult.guardian.completed, true);
player({ mode: 'classic' }); assert.equal(H.active, false); assert.equal(H.actor(), null);
checks.push('evolution grace/boss warning/enrage, rescue before reward, collection/save/settlement and classic reset');

{
// v0.6: load after legacy checks so their intentionally partial fixtures stay stable.
load('js/systems/dash-evolution.js'); load('js/systems/bounties.js');
const D = G.DashEvolution, B = G.Bounties;
p = player(); prompts.length = 0;
p.level = 5; assert.equal(D.prompt(p), false);
p.level = 6; assert.equal(D.prompt(p), true);
const dashChoice = prompts.shift(); assert.equal(dashChoice.kind, 'dash'); assert.equal(dashChoice.list.length, 4);
G.Game.state = 'playing'; dashChoice.cb('gale'); assert.equal(D.choose('frost'), false);
assert.equal(D.prompt(p), false); assert.equal(D.capacity(), 2);
assert.equal(E.dash(p), true); assert.equal(E.dash(p), false); E.motion(p, .3);
assert.equal(E.dash(p), true); E.motion(p, .3); assert.equal(E.dash(p), false);
G.Game.state = 'paused'; D.update(20, p); assert.equal(D.state().charges, 0);
G.Game.state = 'playing'; D.update(E.dashCooldown(), p); assert.equal(D.state().charges, 1);
p.level = 14; D.update(.01, p); assert.equal(D.capacity(), 3); assert.equal(D.state().rank, 2);
E.resetDash(); assert.equal(D.state().charges, 3); assert.equal(E.run.dashCd, 0);
checks.push('Lv.6 four-way choice, one-time selection, gale charges, overlap guard, paused recharge, Lv.14 awakening and refill');

p = player(); D.choose('frost'); E.dash(p);
let frostSlow = null;
enemies = [foe(1000, { x: p.x + 160, applySlow: (factor, seconds) => { frostSlow = [factor, seconds]; } })];
E.motion(p, .3); assert.ok(enemies[0].hp < 1000); assert.deepEqual(frostSlow, [.65, 3]);
const frostHp = enemies[0].hp; D.land(p); assert.equal(enemies[0].hp, frostHp);
p = player(); D.choose('thunder'); p.level = 14; D.update(.01, p); E.dash(p);
enemies = Array.from({ length: 3 }, () => foe(1000, { x: p.x + 160 }));
U.state().cd = 10; E.motion(p, .3); assert.equal(U.state().cd, 8);
assert.ok(enemies.every(e => e.hp < 1000));
p = player({ mode: 'guardian' }); H.state.opened = true; H.recruit('flame', p);
pet = H.actor(); pet.x = p.x; pet.y = p.y; pet.hp = pet.maxHp / 2;
D.choose('ward'); p.level = 14; D.update(.01, p); p.hp = p.maxHp / 2; E.run.shield = 0;
const petBeforeWard = pet.hp; E.dash(p);
assert.equal(E.run.shield, p.maxHp * .25); assert.ok(p.hp > p.maxHp / 2); assert.ok(pet.hp > petBeforeWard);
E.motion(p, .3); E.resetDash(); E.dash(p); assert.equal(E.run.shield, p.maxHp * .25);
checks.push('frost damage/slow only once on landing, awakened thunder ultimate reduction, ward non-stacking shield and companion healing');

p = player(); const bountyBefore = bankedTickets;
E.run.time = 180; E.run.killCount = 100; p.level = 10; D.state().uses = 12;
U.state().best = 8; E.run.relics = ['ward', 'phoenix', 'frost']; E.run.contracts = 2;
E.run.synergies = ['phoenixward']; G.ExpeditionTrials.state.wins = 1;
B.update(p); assert.equal(bankedTickets, bountyBefore + 13); assert.equal(B.snapshot().completed, 9);
B.update(p); assert.equal(bankedTickets, bountyBefore + 13);
p = player({ mode: 'guardian' }); H.state.opened = true; H.recruit('tide', p);
H.state.stage = 1; H.state.bossDefeated = true; prompts.length = 0;
const guardianBountyBefore = bankedTickets;
H.prompt(p); assert.equal(B.state().tickets, 3); assert.equal(bankedTickets, guardianBountyBefore + 6);
assert.equal(G.Game.state, 'expedition'); // extra bounty banked before extraction modal
p = player({ mode: 'classic' }); assert.equal(B.state(), undefined); assert.equal(D.state(), undefined);
checks.push('nine repeatable bounties total 13 tickets once per run; guardian adds 3 before extraction; classic remains isolated');

G.Ranking = { periodIds: () => ({ d: '2026-10-15', w: '2026-W42' }) };
G.AchDefs = { LIST: [] }; G.Icons = { html: () => '' };
ctx.document.getElementById = () => ({ classList: { contains: () => true, add: noop, remove: noop } });
ctx.setTimeout = () => 0;
load('js/data/missions.js'); load('js/systems/progress.js');
const legacyMission = { id: 'kill', goal: 300, prog: 71, claimed: false, told: false };
G.DB.save.missions = { day: '2026-10-15', week: '2026-W42', rerolled: true,
  daily: [legacyMission, { id: 'coins', goal: 100, prog: 100, claimed: true }, { id: 'boss', goal: 1, prog: 0 }],
  weekly: [{ id: 'wboss', goal: 4, prog: 2 }, { id: 'wdaily', goal: 8, prog: 0 }] };
G.Progress.ensure(G.DB.save);
const M = G.DB.save.missions;
assert.equal(M.daily.length, 5); assert.equal(M.weekly.length, 3); assert.equal(M.rerolled, true);
assert.equal(M.daily[0], legacyMission); assert.equal(legacyMission.prog, 71); assert.equal(M.daily[1].claimed, true);
assert.equal(new Set(M.daily.map(m => m.id)).size, 5);
const sameMissions = JSON.stringify(M); G.Progress.ensure(G.DB.save); assert.equal(JSON.stringify(M), sameMissions);
M.daily[4] = { id: 's_dash', goal: 12, prog: 11, claimed: false, told: false };
p = player(); E.dash(p); assert.equal(M.daily[4].prog, 12);
const ticketsClaimBefore = G.DB.save.tickets.t1;
assert.equal(G.Progress.claim(M.daily[4]), true); assert.equal(G.DB.save.tickets.t1, ticketsClaimBefore + 3);
assert.equal(G.Progress.claim(M.daily[4]), false);
assert.equal(M.weekly.find(m => m.id === 'wdaily').prog, 1);
const migrated = G.DB.parseBackup(JSON.stringify({ format: 'pokesurvivor-solo', version: 1, save: G.DB.save }));
assert.equal(migrated.missions.daily[4].claimed, true);
checks.push('existing mission progress/claims/reroll survive 5+3 expansion, no duplicates, real dash event and exactly-once ticket claim persist');

}

// 0.7 guardian roles: real specials and damage paths, in addition to all-form casting above.
{
function matureGuardian(id) {
  const pl = player({ mode: 'guardian' }); H.state.opened = true; H.recruit(id,pl);
  for (const time of H.state.line.times) { H.state.growth=time; H.update(.001,pl); }
  H.state.grace=999; H.state.specialCd=0; return pl;
}
p = matureGuardian('frost'); pet=H.state.pet;
p.hp=p.maxHp/2; E.run.shield=0; H.update(.01,p);
assert.equal(E.run.shield,p.maxHp*.12); assert.equal(H.state.shield,pet.maxHp*.15);
const petShield=H.state.shield; H.state.specialCd=0; H.update(.01,p);
assert.equal(H.state.shield,petShield); assert.equal(E.run.shield,p.maxHp*.12);
E.run.shield=p.maxHp*.4; H.state.specialCd=0; H.update(.01,p);assert.equal(E.run.shield,p.maxHp*.4);
pet.invuln=0; const petHp=pet.hp; H.hurt(10);assert.equal(pet.hp,petHp);assert.ok(H.state.shield<petShield);
H.state.specialCd=5;G.Game.state='paused';H.update(12,p);assert.equal(H.state.specialCd,5);
G.Game.state='playing';G.Rift.inArena=true;H.update(12,p);assert.equal(H.state.specialCd,5);G.Rift.inArena=false;
checks.push('ice guardian shields absorb damage, top up without stacking or shrinking stronger shields, and pause in menus/rifts');

p = matureGuardian('wings');pet=H.state.pet; pet.x=p.x;pet.y=p.y;p.hp=p.maxHp/2;pet.hp=pet.maxHp/2;
const beforeHeal=p.hp;H.update(.01,p);assert.equal(p.hp,beforeHeal+p.maxHp*.09);assert.equal(H.state.specialCd,10);
H.state.specialCd=0;pet.x=p.x+350;const outOfRangeHp=p.hp;H.update(.001,p);assert.equal(p.hp,outOfRangeHp);
checks.push('butterfly heals 9% each 10 seconds only while nearby');

p = matureGuardian('spark');pet=H.state.pet;let slowed=0;
enemies=[0,1,2].map(i=>foe(10000,{id:101+i,x:pet.x+60+i*25,y:pet.y,r:12,bodyH:24,applySlow:()=>slowed++,applyBurn:noop,applyPoison:noop}));
H.update(.01,p);assert.ok(enemies.every(e=>e.hp<10000));assert.ok(slowed>=3);
const choiceHtml=G.GuardianUI.choice('guardian',H.LINES);
assert.equal((choiceHtml.match(/data-choice=/g)||[]).length,5);
checks.push('electric guardian chains and slows multiple targets; choice UI offers five families');
}

console.log(JSON.stringify({ ok: true, checks, levelUpsFromContracts: levels, networkRequests: 0,
  limitation: 'VM mechanics integration; no real browser, touch or full-run balance validation.' }, null, 2));
