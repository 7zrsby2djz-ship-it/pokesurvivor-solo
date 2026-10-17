import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {harness,root} from './hunt-harness.mjs';
const h=await harness(),{G,start,cards,memory,prompts,summaries}=h,checks=[];
const eq=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
function boss(index=0) {const e=G.Hunt.spawn(G.Game.player,index);e.x=80;e.y=0;G.EnemyMgr.rebuildGrid();return e;}
function lethal(e) {e.hurt(1e100);}

for(const mode of ['classic','expedition','guardian']) {
  const p=start(mode); const before=G.DB.save.tickets.t1;
  G.Hunt.update(1,p,839);assert.equal(G.EnemyMgr.all().length,0);
  G.Hunt.update(.1,p,840);let e=G.EnemyMgr.all()[0];assert.equal(e.hunt.index,0);
  G.Hunt.update(.1,p,1200);assert.equal(G.EnemyMgr.all().length,1);
  e.hp=e.maxHp*.75+10;e.shield=100;e.shieldT=8;e.hurt(50);assert.equal(G.Hunt.run.tickets,0);
  e.shield=0;e.hurt(10);assert.equal(G.DB.save.tickets.t1,before+1);
  e.hp=e.maxHp; e.hurt(10); assert.equal(G.Hunt.run.tickets,1);
  e.hp=e.maxHp*.25+10;G.Hunt.tickArmor(e,1);e.hurt(10);
  assert.equal(G.Hunt.run.tickets,3);assert.equal(e.dead,false);
  const shinies=G.DB.save.stats.shinies;lethal(e);lethal(e);e.die();
  assert.equal(G.DB.save.stats.shinies,shinies+1);assert.equal(G.Hunt.run.rewards.length,1);
  assert.equal(G.Hunt.run.tickets,3);
  for(let index=1;index<4;index++) {
    G.Hunt.update(9,p,1200);e=G.EnemyMgr.all().find(x=>!x.dead);assert.equal(e.hunt.index,index);
    lethal(e);
  }
  assert.equal(G.Hunt.run.kills,4);assert.equal(G.Hunt.run.tickets,12);
  assert.equal(G.DB.save.tickets.t1,before+12);
  for(const receipt of G.Hunt.run.rewards) {assert.ok(G.DB.save.owned[receipt.dex]);assert.ok(G.DB.save.shiny[receipt.dex]);}
  G.Hunt.update(100,p,99999);assert.equal(G.Hunt.run.next,4);
  G.Hunt.prompt(p);G.Hunt.prompt(p);assert.equal(prompts.at(-1).kind,'hunt-clear');
  const q=prompts.pop();q.cb('continue');assert.equal(G.Game.state,'playing');
  G.Hunt.prompt(p);assert.equal(prompts.length,0);
  const total=G.DB.save.tickets.t1;G.Game.quit();G.Game.quit();assert.equal(G.DB.save.tickets.t1,total);
  assert.equal(summaries.at(-1).caught.filter(c=>c.source==='hunt').length,4);
}
checks.push('all three modes: timed sequence, shield/HP gates, healing, multi-threshold/lethal claims, permanent reward once, final choice/settlement once');

let p=start();G.Rift.inArena=true;G.Hunt.update(10,p,1200);assert.equal(G.Hunt.run.next,0);G.Rift.inArena=false;
const oldBoss=new G.Enemy({dex:25,hp:10,spd:1,dmg:1,xp:0,behavior:'chase'},0,0,{hp:1,spd:1,dmg:1},true);G.EnemyMgr.add(oldBoss);
G.Hunt.update(10,p,1200);assert.equal(G.Hunt.run.next,0);oldBoss.dead=true;G.Hunt.update(1,p,1200);assert.equal(G.Hunt.run.next,1);
let e=G.EnemyMgr.all().find(x=>x.hunt);e.hp=e.maxHp*.75;G.Hunt.onDamage(e);const tickets=G.DB.save.tickets.t1;
G.EnemyMgr.stash();G.Rift.inArena=true;G.Hunt.update(30,p,1200);G.EnemyMgr.restore();G.Rift.inArena=false;
G.Hunt.onDamage(e);assert.equal(G.DB.save.tickets.t1,tickets);assert.equal(G.Hunt.run.next,1);
p=start('guardian');G.Guardian.state.warning=8;G.Hunt.update(1,p,1200);assert.equal(G.Hunt.run.next,0);G.Guardian.state.warning=null;G.Hunt.update(1,p,1200);assert.equal(G.Hunt.run.next,1);
checks.push('rift delay/stash preserves receipts; existing boss and guardian warning serialize arrivals');
p=start();e=boss();p.x=0;p.y=0;e.x=120;e.y=0;e.hunt.state='approach';e.hunt.t=0;G.Hunt.move(e,.01,p,120,-1,0,70);
assert.equal(e.hunt.state,'warning');assert.ok(G.Hazards.count>0);
G.EnemyMgr.stash();G.Hazards.clear();G.EnemyMgr.restore();
assert.equal(e.hunt.state,'approach');assert.equal(e.hunt.dangerous,false);assert.ok(e.hunt.t>=2);
for(let i=0;i<60;i++)G.Hunt.move(e,1/60,p,120,-1,0,70);assert.equal(e.hunt.dangerous,false);
e.hunt.state='attack';e.hunt.dangerous=true;e.hunt.move='charge';G.EnemyMgr.stash();G.EnemyMgr.restore();
assert.equal(e.hunt.dangerous,false);assert.notEqual(e.hunt.state,'attack');
checks.push('rift return restarts a mid-telegraph/mid-attack hunt boss from a full approach, never dangerous without a fresh warning');

p=start();e=boss();e.x=0;e.y=0;e.hunt.dangerous=true;p.x=0;p.y=0;p.invuln=0;p.attackInvuln=1;
const hp=p.hp;p.hurt(50);eq(p.hp,hp);G.Hunt.contact(e,p);assert.ok(p.hp<hp);const hitHp=p.hp;
G.Hunt.damage(p,.2);eq(p.hp,hitHp);p.invuln=0;G.Hunt.contact(e,p);eq(p.hp,hitHp);
e.hunt.contactCd=0;p.invuln=0;G.Hunt.sweptContact(p,-100,0,100,0);assert.ok(p.hp<hitHp);
p=start('expedition');e=boss();e.hunt.dangerous=true;G.Expedition.run.shield=0;G.Expedition.dash(p);const dashHp=p.hp;
G.Hunt.contact(e,p);eq(p.hp,dashHp);G.Hunt.damage(p,.5);eq(p.hp,dashHp);
G.Expedition.run.evadeT=0;p.invuln=1.2;G.Hunt.damage(p,.9);eq(p.hp,dashHp);
p.invuln=0;p.hp=1;p.item='focussash';G.Hunt.damage(p,.9);assert.equal(p.hp,1);assert.equal(p.dead,false);assert.equal(p.invuln,1.2);
p.item=null;p.invuln=0;G.Expedition.run.relics=['phoenix'];G.Hunt.damage(p,.9);assert.equal(p.dead,false);assert.equal(p.invuln,2);
checks.push('automatic dash still protects normal contact; hunt swept contact pierces it, respects hit grace/manual dodge/Focus Sash/Phoenix');

p=start();e=boss();p.x=0;p.y=0;e.x=100;e.y=0;const original=p.hp;
for(let i=0;i<3;i++)G.Hazards.add({hunt:true,sourceId:e.id,percent:.15,damageScale:1,kind:'zone',x:0,y:0,r:80,delay:.1,color:'#fff'});
p.attackInvuln=.3;G.Hazards.update(.2);eq(p.hp,original-p.maxHp*.15);
p.invuln=0;G.Hazards.clear();G.Hazards.add({hunt:true,sourceId:e.id,percent:.15,kind:'zone',x:0,y:0,r:80,delay:.1,color:'#fff'});e.dead=true;
const after=p.hp;G.Hazards.update(.2);eq(p.hp,after);assert.equal(G.Hazards.count,0);
checks.push('overlapping hunt hazards cause one hit; source death cancels pending strikes');

p=start();e=boss();e.hp=e.maxHp*.5;e.shield=0;e.x=0;e.y=0;const support=new G.Enemy({dex:113,hp:10,spd:0,dmg:0,xp:0,behavior:'healer'},0,0,{hp:1,spd:1,dmg:1});G.EnemyMgr.add(support);G.EnemyMgr.rebuildGrid();
support.healAround();support.healAround();eq(e.hp,e.maxHp*.505);support.castShields();eq(e.shield,e.maxHp*.03);e.shield=0;support.castShields();eq(e.shield,0);
e.applySlow(.95,9);eq(e.slow,.45);
e.hp=e.maxHp;e.shield=0;e.poison=8;e.poisonT=999;e.poisonTick=0;e.hunt.rawWindow=0;
for(let i=0;i<600;i++){e.update(1/60,p);G.Hazards.clear();}
assert.ok(e.hp>e.maxHp*.9,`Poison did ${1-e.hp/e.maxHp} damage in 10s`);
checks.push('hunt-only poison limit, capped slow, shared support healing/shield cooldown prevent stacking runaway sustain');

p=start();e=boss();e.hunt.state='approach';e.hunt.t=0;G.Hunt.move(e,.01,p,80,1,0,70);
assert.equal(e.hunt.state,'warning');assert.equal(e.hunt.dangerous,false);assert.ok(G.Hazards.count>0);
G.Hunt.move(e,1.2,p,80,1,0,70);assert.equal(e.hunt.dangerous,true);
G.Hunt.move(e,.7,p,80,1,0,70);assert.equal(e.hunt.state,'recover');assert.equal(e.hunt.dangerous,false);
const L=e.maxHp*.02,raw=L*10;e.hunt.rawWindow=0;const one=G.Hunt.incoming(e,raw);
e.hunt.rawWindow=0;let many=0;for(let i=0;i<100;i++)many+=G.Hunt.incoming(e,raw/100);eq(one,many);assert.ok(one<raw&&one>L);
G.Hunt.tickArmor(e,1);eq(G.Hunt.incoming(e,100),100);
checks.push('visible warning → dangerous attack → safe recovery; aggregate logarithmic armor cannot be bypassed with many small hits');

for(let i=0;i<4;i++){
  const pool=G.Hunt.rewardPool(i);assert.ok(pool.length);
  for(const {rarity,list}of pool){assert.ok(i===0||i===1&&rarity>=3||i===2&&rarity===4||i===3&&rarity===5);assert.ok(list.every(m=>G.Sprites.hasShiny(m.dex)));}
  for(let k=0;k<100;k++){const dex=G.Hunt.rollReward(i);assert.ok(pool.some(p=>p.list.some(m=>m.dex===dex)));}
}
p=start();const save=G.DB.save,dex=G.DEX.find(m=>m.rarity===5&&G.Sprites.hasShiny(m.dex)&&!save.owned[m.dex]).dex;
const first=G.Hunt.grantShiny(dex);assert.equal(first.isNew,true);assert.equal(first.resonance,null);assert.ok(save.owned[dex]&&save.shiny[dex]);
const before=save.coins;const duplicate=G.Hunt.grantShiny(dex);assert.equal(duplicate.refund,900);assert.equal(duplicate.resonance.after,1);assert.equal(save.coins,before+900);
save.resonance.ranks[dex]=5;const capped=G.Hunt.grantShiny(dex);assert.equal(capped.resonance.after,5);assert.equal(capped.resonance.essence,9);
const normalDex=G.DEX.find(m=>m.rarity===4&&G.Sprites.hasShiny(m.dex)&&!save.owned[m.dex]).dex;G.DB.grant(normalDex,'test');
const normal=G.Hunt.grantShiny(normalDex);assert.equal(normal.isNew,true);assert.equal(normal.refund,0);assert.equal(normal.resonance.after,1);
const pity=JSON.stringify(save.pity);G.Hunt.grantShiny(normalDex);assert.equal(JSON.stringify(save.pity),pity);
const backup=G.DB.exportSave(),parsed=G.DB.parseBackup(backup);assert.ok(parsed.shiny[dex]);assert.equal(parsed.resonance.ranks[dex],5);
h.load('core/db');await G.DB.ready();assert.ok(G.DB.save.shiny[dex]);assert.equal(G.DB.save.resonance.ranks[dex],5);
checks.push('four nonempty forced-shiny rarity pools; true collection unlock, normal-first/duplicate/capped resonance, refunds, unchanged pity and reload/import');

p=start();h.failStorage(true);e=boss();lethal(e);assert.equal(G.Hunt.run.retrySave,true);const awarded=G.DB.save.stats.shinies;
h.failStorage(false);G.Hunt.update(4,p,840);assert.equal(G.Hunt.run.retrySave,false);assert.equal(G.DB.save.stats.shinies,awarded);
const saved=JSON.parse(memory.get('ps.save.solo'));assert.equal(saved.stats.shinies,awarded);
checks.push('storage failure retains one in-memory receipt, retries persistence without duplicating rewards');

p=start();p.atkMul=1.4;p.cdMul=.76;p.dmgReduce=.16;cards(p,'atk',40);cards(p,'cd',10);cards(p,'hp',60);cards(p,'def',12);cards(p,'rgn',40);
eq(p.atkMul,1.4*3.8);eq(p.cdMul,.76/1.8);assert.equal(p.maxHp,86+342);eq(p.regenFlat,12);eq(p.reduction,1-.84*.7);
p.buffs.def={n:8,amount:.2};eq(p.reduction,.7);
const maxAtk=p.atkMul;G.Growth.apply(p,'atk');eq(p.atkMul,maxAtk);
for(const id of ['atk','hp','def','rgn','spd','xp']){
 const f=G.Growth.curve[id];let last=Infinity;
 for(let n=0;n<G.Growth.caps[id];n++){const delta=f(n+1)-f(n);assert.ok(delta>=0);if(id!=='hp')assert.ok(delta<=last+1e-8);last=delta;}
}
assert.match(G.Growth.describe(p,'atk'),/0.0%/);assert.ok(G.Enemies.scale(1e12).hp<19);assert.ok(G.Enemies.scale(1e12).dmg<4);
checks.push('growth preserves other multipliers, obeys caps/monotonic diminishing returns, composes armor safely and bounds endless enemy inflation');

// Exercise the actual run scheduler/legacy spawner once, beyond 20 minutes.
p=start();G.Game.debugTime(1201);for(let i=0;i<4;i++) {G.Spawner.update(.001,p,1201);const b=G.EnemyMgr.all().find(e=>e.boss&&!e.dead);assert.ok(b);assert.ok(b.def.at<=720);b.dead=true;}
G.Spawner.update(.001,p,1201);assert.ok(!G.EnemyMgr.all().some(e=>e.boss&&!e.dead));
G.Hunt.update(.01,p,1201);assert.equal(G.EnemyMgr.all().filter(e=>e.boss&&!e.dead).length,1);
for(const b of G.Hunt.TIERS)for(const anim of ['Idle','Walk','Attack','Hurt','Faint'])assert.ok(fs.existsSync(path.join(root,'assets/pokemon',String(b.dex),anim+'.png')));
checks.push('legacy 3/6/9/12-minute bosses remain serialized; old 15-minute slot is replaced; all four boss sprite sets exist');
// Every move family still executes against the new enemy; use real casting,
// projectiles and fields (terrain/rendering stubbed by the shared fixture).
for(const def of G.Moves.ALL) {
  p=start();p.moves=[];p.slots=[];p.addMove(def.id);p.cast=()=>{};p.aim=0;
  e=boss();e.hp=1e9;p.target=e;
  for(let i=0;i<120;i++) {
    p.x=0;p.y=0;p.aim=0;p.target=e;G.Hunt.tickArmor(e,1/60);G.EnemyMgr.rebuildGrid();
    G.Combat.tick(1/60,p,i/60);G.Projectiles.update(1/60,p,G.EnemyMgr.all());G.Combat.resolve(1/60,p,i/60);G.Combat.updateFields(1/60);
  }
  assert.ok(Number.isFinite(e.hp)&&e.hp<=1e9,def.id);assert.ok(Number.isFinite(p.x),def.id);
}
checks.push(`all ${G.Moves.ALL.length} moves / ${new Set(G.Moves.ALL.map(m=>m.kind)).size} combat families execute against hunt armor without invalid damage`);

p=start();e=boss();const t=e.hunt.t;G.Game.togglePause();G.Game.testFrame(1000);eq(e.hunt.t,t);G.Game.togglePause();
G.Game.testFrame(1017);assert.ok(e.hunt.t<t);
checks.push('actual game loop pauses hunt AI and resumes; shared update integration executes');

console.log(JSON.stringify({ok:true,checks,networkRequests:0,limitation:'deterministic VM mechanics, not browser rendering/touch or human full-run win-rate validation'},null,2));
