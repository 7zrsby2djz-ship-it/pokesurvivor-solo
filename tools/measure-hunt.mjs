// Actual Move/Player/Combat/Projectile damage; 60 Hz stationary target benchmark.
// This measures attack throughput, not survival odds or full-run difficulty.
import {harness} from './hunt-harness.mjs';
const {G,start,cards,setSeed}=await harness();
const results=[];
for (const mode of ['classic','expedition','guardian']) for (const setup of [
  {name:'early single',attack:6,cd:3,moves:['quick-attack'],evolved:false},
  {name:'late single',attack:12,cd:6,moves:['quick-attack'],evolved:true},
  {name:'late fusion',attack:16,cd:8,moves:['quick-attack','flamethrower','thunderbolt'],evolved:true},
  {name:'maximum fusion',attack:40,cd:10,moves:['quick-attack','flamethrower','thunderbolt','swords-dance'],evolved:true}
]) {
  const p=start(mode); p.atkMul*=1.4; p.cdMul*=.76; p.cast=()=>{};
  cards(p,'atk',setup.attack);cards(p,'cd',setup.cd);
  p.moves=[];p.slots=[];p.active=0;
  const moves=setup.moves.map(id=>{if(!G.Moves.BY_ID[id])throw Error(id);const m=G.Moves.instance(id,1);while(m.lvl<5)G.Moves.levelUp(m);if(setup.evolved&&G.Moves.evoInfo(m,{atk:40,cd:10,spd:8,def:12,hp:60,xp:8,rgn:40,mag:6})?.ready)G.Moves.evolve(m);return m;});
  p.moves=moves;p.slots=[moves];p.target=null;
  const e=new G.Enemy({dex:150,hp:1e9,spd:0,dmg:0,xp:0,behavior:'chase'},80,0,{hp:1,spd:1,dmg:1},true);
  e.types=['normal'];e.r=32;e.poison=0;G.EnemyMgr.add(e);setSeed(147);
  for(let f=0;f<3600;f++){
    p.x=e.x-80;p.y=e.y;p.aim=0;p.target=e;
    G.EnemyMgr.rebuildGrid(); G.Combat.tick(1/60,p,f/60);G.Projectiles.update(1/60,p,G.EnemyMgr.all());G.Combat.resolve(1/60,p,f/60);G.Combat.updateFields(1/60);
  }
  const dps=(e.maxHp-e.hp)/60;
  const armored=[];
  for (const tier of G.Hunt.TIERS) {
    G.EnemyMgr.clear();G.Projectiles.clear();G.Combat.clearFields();p.buffs.atk={n:0,t:0,amount:0};
    const target=new G.Enemy({dex:tier.dex,hp:1e9,spd:0,dmg:0,xp:0,behavior:'chase'},80,0,{hp:1,spd:1,dmg:1},true);
    // Keep the boss's final armor limit and type table, without death/loot/AI.
    target.maxHp=tier.hp;target.hp=1e9;target.r=32;target.hunt={damageWindow:0,rawWindow:0,claims:7};
    for(const m of moves)m.t=0;G.EnemyMgr.add(target);setSeed(147);
    for(let f=0;f<3600;f++){
      p.x=target.x-80;p.y=target.y;p.aim=0;p.target=target;
      G.Hunt.tickArmor(target,1/60);G.EnemyMgr.rebuildGrid();G.Combat.tick(1/60,p,f/60);
      G.Projectiles.update(1/60,p,G.EnemyMgr.all());G.Combat.resolve(1/60,p,f/60);G.Combat.updateFields(1/60);
    }
    const actual=(1e9-target.hp)/60;
    armored.push({dex:tier.dex,dps:Math.round(actual),seconds:Math.round(tier.hp/actual)});
  }
  results.push({mode,build:setup.name,attackCards:setup.attack,atk:+p.atk.toFixed(2),dps:Math.round(dps),armoredBosses:armored});
}
console.log(JSON.stringify({conditions:'60s, 60Hz, Pikachu, max permanent attack/CD, neutral stationary target, perfect repeated hits, no DoT ticks/guardian assist; movement reduces real DPS',results},null,2));
