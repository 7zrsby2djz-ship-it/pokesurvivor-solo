// Deterministic collision benchmark, not a win-rate or player telemetry claim.
// Real guardian, move, projectile and hit code; stationary neutral dummies,
// open arena, fixed owner attack 1, no upgrades / DoT ticks / knockback movement.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const noop = () => {};
let enemies = [], seed = 147;
const math = Object.create(Math);
math.random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const G = { SOLO: true, T: s => s,
  Sprites: { Animator: class { update() {} loop() {} play() {} }, bodyRadius: () => 12, bodyHeight: () => 24, hasShiny: () => false, dirFromAngle: () => 0, preload: noop },
  FX: new Proxy({}, { get: () => noop }), Audio: { sfx: noop },
  Path: { dirFor: () => null }, GuardianSteering: { advance: () => 0 },
  World: { isWall: () => false, isFree: () => true, projectileBlock: () => false, isLiquid: () => false, propsInCircle: () => [] },
  Weather: { speedFor: () => 1, mult: () => 1 }, Camera: { kick: noop, sees: () => true },
  Coop: { active: false }, Rift: { inArena: false }, VFX: { forMove: () => ({}) },
  EnemyMgr: { all: () => enemies, queryCircle: (x,y,r) => enemies.filter(e => !e.dead && Math.hypot(e.x-x,e.y-y) <= r+e.r), bossAlive: () => true },
  Spawner: { say: noop }, DB: { upgradesOf: () => ({}) }, Game: { state: 'playing' }
};
const ctx = vm.createContext({ G, window: { G }, Math: math, performance: { now: () => 1000 }, console });
for (const name of ['core/util', 'data/pokedex', 'data/types', 'data/moves', 'data/upgrades', 'entities/player', 'entities/projectile', 'systems/combat', 'systems/guardian'])
  vm.runInContext(fs.readFileSync(path.join(root, 'js', name+'.js'), 'utf8'), ctx, { filename: name });
const scenarios = {
  near: [[100,0]], edge: [[180,0]], far: [[250,0]],
  fan: [[110,-50],[125,-25],[130,0],[125,25],[110,50]],
  row: [[100,0],[140,0],[180,0],[220,0],[260,0]]
};
const results = [];
for (const line of G.Guardian.LINES) {
  const row = { id: line.id, matureSeconds: line.times.at(-1) };
  for (const [scenario, points] of Object.entries(scenarios)) {
    seed = 147; enemies = []; G.Projectiles.clear();
    const p = new G.Player(G.DEX_BY[4]); p.baseAtk = 1; G.Game.player = p;
    G.Guardian.start({ mode: 'guardian' }); G.Guardian.state.opened = true; G.Guardian.recruit(line.id,p);
    for (const t of line.times) { G.Guardian.state.growth = t; G.Guardian.update(.001,p); }
    const pet = G.Guardian.state.pet; pet.x = 0; pet.y = 0;
    G.Guardian.state.grace = 999; G.Guardian.state.attackCd = 0; G.Guardian.state.specialCd = 10;
    enemies = points.map(([x,y],i) => ({ id:i+1, x,y,r:12,bodyH:24,types:['normal'],hp:1e9,dmg:0,damage:0,
      cy() { return this.y; }, hurt(d) { this.damage+=d; this.hp-=d; }, applyBurn:noop,applyPoison:noop,applySlow:noop }));
    for (let frame=0;frame<1800;frame++) {
      G.Guardian.update(1/60,p); G.Projectiles.update(1/60,p,enemies); G.Combat.resolve(1/60,p,frame/60);
    }
    row[scenario] = Math.round(enemies.reduce((sum,e)=>sum+e.damage,0)/30*10)/10;
  }
  results.push(row);
}
console.log(JSON.stringify({ scenario: '30 s direct DPS; 60 Hz; attack 1; normal-type stationary dummies; no DoT ticks, movement or incoming damage', results },null,2));
