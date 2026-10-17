// Switch links (切招連攜): real casts through Combat.tick, real hits on enemies.
import assert from 'node:assert/strict';
import {harness} from './hunt-harness.mjs';
const h=await harness(),{G,start}=h,checks=[];
let clock=100;
const setTime=t=>{clock=t;G.Game.debugTime(t);};

function fresh(ids,mode='classic'){
  const p=start(mode);p.moves=[];p.slots=[];p.active=0;
  for(const id of ids)p.addMove(id);
  p.setActive(0);p.x=0;p.y=0;p.aim=0;p.cdMul=1;
  G.SwitchLink.start(p);setTime(100);return p;
}
function mob(x=40,y=0,hp=1e6){const e=new G.Enemy({dex:19,hp,spd:0,dmg:0,xp:1,behavior:'chase'},x,y,{hp:1,spd:1,dmg:1},false);G.EnemyMgr.add(e);G.EnemyMgr.rebuildGrid();return e;}
// Fire the active group once (every move ready), at simulation time `t`.
function fire(p,t,target){
  setTime(t);for(const m of p.activeGroup())m.t=0;
  p.target=target;p.aim=Math.atan2(target.y-p.y,target.x-p.x);G.EnemyMgr.rebuildGrid();
  G.Combat.tick(0,p,t);
}
const peek=p=>G.SwitchLink.view(p);

// 1. Backsweep: dash hit → manual switch to melee → next melee is a full circle.
{
  const p=fresh(['quick-attack','tackle']);const front=mob(60,0);
  fire(p,100,front);assert.ok(front.hp<front.maxHp,'dash connected');
  assert.equal(peek(p).target,1);assert.equal(peek(p).offerName,'回身掃擊');
  setTime(101);p.setActive(1,true);assert.equal(peek(p).ready,true);assert.equal(peek(p).id,'backsweep');
  // An enemy directly behind the player: a normal frontal tackle cannot reach it.
  const behind=mob(p.x-30,p.y),ahead=mob(p.x+30,p.y);const hpB=behind.hp;
  fire(p,101.5,ahead);assert.ok(behind.hp<hpB,'360° backsweep hit the enemy behind');
  assert.equal(peek(p).ready,false);assert.ok(peek(p).cooldown>7);
  // Next tackle is back to the normal arc: the enemy behind is safe.
  const hp2=behind.hp;fire(p,102,ahead);assert.equal(behind.hp,hp2,'only one cast is modified');
  // Original move instance was never mutated.
  assert.equal(p.slots[1][0].arc,G.Moves.instance('tackle',1).arc);
}
checks.push('backsweep: real dash hit + manual switch arms; next real melee is 360° once; original move untouched; slot hint shown');

// 2. Breach: melee hit → switch to ranged → only the FIRST projectile gets +1 pierce.
{
  const p=fresh(['tackle','hyper-voice']);const e=mob(30,0);
  fire(p,100,e);setTime(100.5);p.setActive(1,true);assert.equal(peek(p).id,'breach');
  const before=new Set(G.Projectiles.all());fire(p,101,e);
  const spawned=G.Projectiles.all().filter(x=>!before.has(x));
  const base=G.Moves.instance('hyper-voice',1).pierce|0;
  assert.ok(spawned.length>=3);
  assert.equal(spawned.filter(x=>x.pierce===base+1).length,1,'exactly one projectile got the extra pierce');
  assert.equal(spawned.filter(x=>x.pierce===base).length,spawned.length-1);
}
checks.push('breach: melee hit + switch to nova/projectile/cone; exactly one projectile per cast gets +1 pierce');

// 3. Windows, cancellation and cooldown.
{
  let p=fresh(['quick-attack','tackle']);let e=mob(60,0);
  fire(p,100,e);setTime(102.5);p.setActive(1,true);assert.equal(peek(p).ready,false,'switch after 2s does not arm');
  p=fresh(['quick-attack','tackle']);e=mob(60,0);fire(p,100,e);setTime(101);p.setActive(1,true);
  setTime(104.5);assert.equal(peek(p).ready,false,'armed window expires after 3s');
  p=fresh(['quick-attack','tackle']);e=mob(60,0);fire(p,100,e);setTime(101);p.setActive(1,false);
  assert.equal(peek(p).ready,false,'automatic switch never arms');
  p=fresh(['quick-attack','tackle','ember']);e=mob(60,0);fire(p,100,e);setTime(100.5);p.setActive(2,true);
  assert.equal(peek(p).ready,false,'dash → ranged is not a recipe');
  p=fresh(['quick-attack','tackle']);e=mob(60,0);fire(p,100,e);setTime(100.5);p.setActive(1,true);
  p.addMove('ember');assert.equal(peek(p).ready,false,'learning a move cancels the armed link');
  // Cooldown: after consuming at 101, a new source at 103 cannot arm until 109.
  p=fresh(['quick-attack','tackle']);e=mob(60,0);fire(p,100,e);setTime(100.5);p.setActive(1,true);
  fire(p,101,mob(30,0));p.setActive(0,true);fire(p,103,mob(60,0));setTime(103.5);p.setActive(1,true);
  assert.equal(peek(p).ready,false,'shared 8s cooldown');
  p.setActive(0,true);fire(p,109.2,mob(60,0));setTime(109.5);p.setActive(1,true);assert.equal(peek(p).ready,true,'available again after cooldown');
}
checks.push('2s source window, 3s cast window, automatic/learned/non-recipe switches never arm, shared 8s cooldown');

// 4. Non-sources: misses, echo/guardian assists, choice band, pause.
{
  let p=fresh(['quick-attack','tackle']);fire(p,100,{x:60,y:0,dead:false,hurt(){} });
  setTime(100.5);p.setActive(1,true);assert.equal(peek(p).ready,false,'a dash that hit nothing is no source');
  p=fresh(['quick-attack','tackle']);let e=mob(40,0);p.target=e;G.Combat.assist(p,p.slots[0][0],.45);
  assert.ok(e.hp<e.maxHp);setTime(100.5);p.setActive(1,true);assert.equal(peek(p).ready,false,'echo/guardian assist is no source');
  p=fresh(['quick-attack','tackle']);e=mob(60,0);fire(p,100,e);p.item='choiceband';setTime(100.5);p.setActive(1,true);
  assert.equal(p.active,0);assert.equal(peek(p).target,-1,'choice band: no hint, no switch');
  p.item=null;
  // Simulation time does not advance while paused: still within the window afterwards.
  p=fresh(['quick-attack','tackle']);e=mob(60,0);fire(p,100,e);G.Game.togglePause();
  G.Game.testFrame(1000);G.Game.testFrame(6000);G.Game.togglePause();
  p.setActive(1,true);assert.equal(peek(p).ready,true,'pause does not expire the window');
}
checks.push('misses, echo/guardian assists and choice band never trigger; pause does not consume the window');

// 5. Fusion groups compare by sorted ids, and every mode starts a fresh state.
{
  for(const mode of ['classic','expedition','guardian']){
    const p=fresh(['quick-attack','tackle'],mode);const e=mob(60,0);
    if(p.slots.length<2)continue;
    const dashSlot=p.slots.findIndex(g=>g.some(m=>m.kind==='dash'));const meleeSlot=p.slots.findIndex(g=>g.some(m=>m.kind==='melee'));
    if(dashSlot<0||meleeSlot<0)continue;
    p.setActive(dashSlot);fire(p,100,e);setTime(100.5);p.setActive(meleeSlot,true);
    assert.equal(peek(p).id,'backsweep',mode);
  }
}
checks.push('works through startRun in classic / expedition / guardian (when both kinds sit in normal slots)');

// 6. Damage per hit is unchanged (no multiplier): same single target, linked vs normal.
{
  let p=fresh(['quick-attack','tackle']);fire(p,100,mob(60,0));setTime(100.5);p.setActive(1,true);let e=mob(p.x+30,p.y);
  let hp=e.hp;fire(p,101,e);const linked=hp-e.hp;
  p=fresh(['quick-attack','tackle']);p.setActive(1,true);e=mob(p.x+30,p.y);hp=e.hp;fire(p,101,e);const normal=hp-e.hp;
  assert.ok(linked>0&&Math.abs(linked-normal)<1e-6,`${linked} vs ${normal}`);
}
checks.push('a single target in range takes identical damage with or without the link (shape only, no multiplier)');

console.log(JSON.stringify({ok:true,checks,networkRequests:0,limitation:'VM mechanics with real Combat/Enemy/Projectile; feel and discoverability need human play'},null,2));
