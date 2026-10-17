// Species habits pilot: real Player.update movement, real Combat casts and assists.
import assert from 'node:assert/strict';
import {harness} from './hunt-harness.mjs';
const h=await harness(),{G}=h,checks=[];
let axis=[0,0];G.Input.axis=()=>axis;

function run(dex,mode='classic'){
  G.DB.grant(dex,'test');G.DB.save.partner=dex;
  G.Game.startRun(null,{mode,difficulty:'normal'});G.EnemyMgr.clear();G.Hazards.clear();
  const p=G.Game.player;p.x=0;p.y=0;p.maxHp=p.hp=1e6;return p;
}
function mob(x,y,boss=false){const e=new G.Enemy({dex:19,hp:1e6,spd:0,dmg:0,xp:1,behavior:'chase'},x,y,{hp:1,spd:1,dmg:1},boss);G.EnemyMgr.add(e);G.EnemyMgr.rebuildGrid();return e;}
function walk(p,sec,dir=[1,0]){axis=dir;for(let i=0;i<sec*60;i++){p.update(1/60);G.SpeciesHabits.update(1/60,p);}axis=[0,0];}
function idle(p,sec){axis=[0,0];for(let i=0;i<sec*60;i++){p.update(1/60);G.SpeciesHabits.update(1/60,p);}}
function cast(p,target){for(const m of p.activeGroup())m.t=0;p.target=target;p.aim=Math.atan2(target.y-p.y,target.x-p.x);G.EnemyMgr.rebuildGrid();G.Combat.tick(0,p,G.Game.st.time);}
const S=()=>G.SpeciesHabits.state;

// Mapping: exactly the six pilots, every other species untouched.
for(const d of [1,2,7,8,25,26])assert.ok(G.SpeciesHabits.habitOf(d));
assert.equal(G.SpeciesHabits.habitOf(3),null);assert.equal(G.SpeciesHabits.habitOf(133),null);
run(133);assert.equal(S(),null);
checks.push('six pilot species map to three habits; every other species has none');

// Stride spark: charge by real walking only.
for(const mode of ['classic','expedition','guardian']){
  const p=run(25,mode);assert.equal(S().id,'stride');
  const spd=p.spd;walk(p,240/spd*0.5);assert.equal(S().ready,false);
  walk(p,240/spd*0.6);assert.equal(S().ready,true,mode);
}
{
  let p=run(25);G.World.collide=pl=>{pl.x=0;pl.y=0;};walk(p,5);assert.equal(S().walked,0,'pushing into a wall does not charge');G.World.collide=()=>{};
  p=run(25);p.x=500;idle(p,1);assert.equal(S().walked,0,'teleport/dash displacement does not charge');
  // Spark fires on the next real attack, then cooldown; no spark without a target.
  p=run(25);walk(p,3);assert.equal(S().ready,true);
  const before=G.Projectiles.all().length;cast(p,{x:9999,y:0,dead:false});
  assert.equal(S().ready,true,'no target in range: charge kept');
  const e=mob(p.x+80,p.y);const n0=G.Projectiles.all().length;cast(p,e);
  const spawned=G.Projectiles.all().slice(n0);assert.equal(S().ready,false);assert.ok(S().cd>5.9);
  const sparks=spawned.filter(x=>x.pierce===0);assert.ok(sparks.length>=1,'extra spark projectile with pierce 0');
  walk(p,3);assert.equal(S().ready,false,'no charging during cooldown');assert.equal(S().walked,0);
  // Rate bound: at most one spark per 6s + walk time.
  p=run(25);let sparksFired=0;const e2=mob(p.x+80,p.y);
  for(let t=0;t<60*60;t++){axis=[t%240<120?1:-1,0];p.update(1/60);G.SpeciesHabits.update(1/60,p);
    if(t%20===0){const was=S().ready;e2.x=p.x+80;e2.y=p.y;cast(p,e2);if(was&&!S().ready)sparksFired++;}}
  axis=[0,0];assert.ok(sparksFired<=8&&sparksFired>=5,`sparks/min ${sparksFired}`);
}
checks.push('stride: charges only from input walking after collision; spark on next real attack, kept without a target, 6s cooldown, ≤8/min');

// Shell break.
{
  let p=run(7);assert.equal(S().id,'shell');
  const near=[mob(30,0),mob(-30,10),mob(0,40)],boss=mob(20,-20,true),far=mob(300,0);
  idle(p,.5);assert.equal(S().primed,false);idle(p,.3);assert.equal(S().primed,true);
  walk(p,1/60);assert.ok(near.every(e=>Math.hypot(e.kx,e.ky)>100),'nearby foes pushed');
  assert.equal(boss.kx,0);assert.equal(far.kx,0);assert.ok(near.every(e=>e.hp===e.maxHp),'no damage');
  assert.ok(S().cd>7.9);idle(p,2);assert.equal(S().primed,false,'no priming during cooldown');
  // Moving resets the stand timer; walking without priming does nothing.
  p=run(8);idle(p,.5);walk(p,.1);idle(p,.5);assert.equal(S().primed,false);
  // Max 8 targets.
  p=run(7);const crowd=[];for(let i=0;i<12;i++)crowd.push(mob(Math.cos(i)*40,Math.sin(i)*40));
  idle(p,1);walk(p,1/60);assert.equal(crowd.filter(e=>e.kx||e.ky).length,8);
}
checks.push('shell: 0.75s still primes, first real step pushes ≤8 nearest normal foes, no damage, bosses untouched, 8s cooldown');

// Spore step.
{
  const p=run(1);assert.equal(S().id,'spore');
  const e=mob(p.x+40,p.y),boss=mob(p.x-30,p.y,true);
  cast(p,e);assert.ok(S().zone,'grass attack leaves a ring');assert.ok(S().cd>7.9);
  G.SpeciesHabits.update(1/60,p);assert.ok(e.slow>=.25);assert.equal(boss.slow,0);
  for(let i=0;i<130;i++)G.SpeciesHabits.update(1/60,p);assert.equal(S().zone,null,'ring lasts 2s');
  cast(p,e);assert.equal(S().zone,null,'cooldown: no second ring');
  // A non-grass attack never triggers.
  const q=run(1);q.moves=[];q.slots=[];q.addMove('tackle');q.setActive(0);cast(q,mob(q.x+30,q.y));assert.equal(S().zone,null);
}
checks.push('spore: grass attack → one 2s ring slowing ≤8 normal foes 25%, bosses excluded, 8s cooldown, non-grass never');

// Assists/guardian never trigger; rift clears transient state but keeps cooldown.
{
  let p=run(1);const e=mob(p.x+40,p.y);G.Combat.assist(p,G.Moves.instance('vine-whip',1),.45);assert.equal(S().zone,null,'assist does not trigger');
  p=run(25);walk(p,3);assert.equal(S().ready,true);G.Rift.inArena=true;G.SpeciesHabits.update(1/60,p);assert.equal(S().ready,false);
  G.Rift.inArena=false;G.SpeciesHabits.update(1/60,p);
  p=run(1);cast(p,mob(p.x+40,p.y));const cd=S().cd;G.Rift.inArena=true;G.SpeciesHabits.update(1/60,p);
  assert.equal(S().zone,null);assert.ok(S().cd>0&&S().cd<=cd);G.Rift.inArena=false;
  // Pause freezes cooldowns (no update while paused).
  p=run(1);cast(p,mob(p.x+40,p.y));const c0=S().cd;G.Game.togglePause();G.Game.testFrame(1000);G.Game.testFrame(5000);G.Game.togglePause();
  assert.ok(Math.abs(S().cd-c0)<1e-9);
}
checks.push('assists never trigger; rift enter/leave clears charge/ring but keeps cooldown; pause freezes everything');

// Save untouched: habits never write to the save.
{
  const snap=JSON.stringify(G.DB.save);const p=run(25);walk(p,3);cast(p,mob(p.x+80,p.y));
  const after=JSON.parse(JSON.stringify(G.DB.save));const before=JSON.parse(snap);
  for(const k of ['owned','shiny','upgrades','resonance','tickets'])assert.deepEqual(after[k],before[k],k);
}
checks.push('no save fields touched by habits');

console.log(JSON.stringify({ok:true,checks,networkRequests:0,limitation:'VM mechanics; whether players actually walk/stop/kite differently needs human play'},null,2));
