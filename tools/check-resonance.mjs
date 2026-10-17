// Real DB, gacha and player progression in isolated memory, never player saves.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const memory = new Map(), noop = () => {};
const math = Object.create(Math); math.random = () => .999;
const G = { SOLO:true, T:s=>s, Settings:{get:()=>false},
  Sprites:{ Animator:class {},bodyRadius:()=>12,bodyHeight:()=>24,hasShiny:()=>true },
  Weather:{speedFor:()=>1},World:{liquidEffect:()=>({})} };
const ctx = vm.createContext({ G,window:{G}, Math:math,Date,console,setTimeout,clearTimeout,
  document:{addEventListener:noop},addEventListener:noop,dispatchEvent:noop,CustomEvent:class {},
  navigator:{onLine:true},localStorage:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)} });
const load = name => vm.runInContext(fs.readFileSync(path.join(root,'js',name+'.js'),'utf8'),ctx,{filename:name});
for (const p of ['core/util','data/pokedex','data/sprites-meta','data/types','data/upgrades','systems/resonance','core/db','systems/growth','entities/player','systems/gacha','ui/resonance-ui']) load(p);
await G.DB.ready();
const s=G.DB.save,R=G.Resonance,checks=[];
s.tickets.t1=100;s.coins=500;
const first=G.Gacha.pull(s,1)[0], dex=first.dex;
assert.equal(first.rarity,5);assert.equal(first.isNew,true);assert.equal(first.resonance,null);assert.equal(R.rank(s,dex),0);
const second=G.Gacha.pull(s,1)[0];
assert.equal(second.refund,300);assert.equal(second.resonance.after,1);assert.equal(s.coins,800);assert.equal(s.resonance.essence,3);
const ten=G.Gacha.pull(s,10);
assert.deepEqual(Array.from(ten.slice(0,4),r=>r.resonance.after),[2,3,4,5]);
assert.ok(ten.slice(4).every(r=>r.resonance.capped&&r.resonance.essence===9));
assert.equal(R.rank(s,dex),5);assert.equal(s.resonance.essence,69);assert.equal(s.tickets.t1,88);
checks.push('real single/ten pulls: first acquisition, coins, sequential ranks, cap and overflow');

// First shiny of a previously owned species gives both unlock and growth.
s.resonance.ranks[dex]=1;G.Gacha.debugForceShiny(1);
const shiny=G.Gacha.pull(s,1)[0];
assert.equal(shiny.shiny,true);assert.equal(shiny.isNew,true);assert.equal(shiny.resonance.after,2);assert.equal(shiny.refund,0);
G.Gacha.debugForceShiny(1);const shinyAgain=G.Gacha.pull(s,1)[0];
assert.equal(shinyAgain.refund,900);assert.equal(shinyAgain.resonance.after,3);
assert.ok(G.ResonanceUI.reward(shinyAgain).includes('冷卻 −5% 解鎖'));
const freshSave=JSON.parse(JSON.stringify(s));freshSave.owned={};freshSave.shiny={};freshSave.resonance={ranks:{},essence:0};
G.Gacha.debugForceShiny(1);const freshShiny=G.Gacha.pull(freshSave,1)[0];
assert.equal(freshShiny.isNew,true);assert.equal(freshShiny.resonance,null);assert.equal(R.rank(freshSave,freshShiny.dex),0);
checks.push('normal/shiny share growth; first shiny keeps unlock; first-ever species remains +0');

math.random=()=>.97;const epic=G.Gacha.pull(s,1)[0];
assert.equal(epic.rarity,4);assert.equal(epic.resonance,null);
assert.equal(G.Gacha.pull(s,1)[0].resonance.essence,1);
math.random=()=>.1;const common=G.Gacha.pull(s,1)[0];
const commonDupe=G.Gacha.pull(s,1)[0];assert.equal(commonDupe.refund,15);assert.equal(commonDupe.resonance,null);
const unchanged=JSON.stringify(s);
for (const args of [[-1,1],[0,1],[2,1],[10,999],[1,1,'t10']]) assert.equal(G.Gacha.pull(s,...args),null);
assert.equal(JSON.stringify(s),unchanged);
s.pity[1]=69;assert.equal(G.Gacha.pull(s,1)[0].rarity,5);assert.equal(s.pity[1],0);
const guarantee=G.Gacha.pull(s,10);assert.ok(guarantee.some(x=>x.rarity>=4));
checks.push('epic/common refunds, invalid draws cannot spend, existing 70-pull and ten-pull guarantees');

const target=G.DEX.find(p=>p.rarity===5&&G.SPRITE_META[p.dex]&&!s.owned[p.dex]);
s.resonance.essence=119;assert.equal(R.exchange(s,target.dex),null);
s.resonance.essence=120;const tickets=JSON.stringify(s.tickets),pity=JSON.stringify(s.pity),coins=s.coins;
assert.equal(R.exchange(s,target.dex).kind,'recruit');assert.equal(s.resonance.essence,0);assert.equal(R.rank(s,target.dex),0);
assert.equal(s.owned[target.dex].from,'resonance');assert.equal(s.shiny[target.dex],undefined);
s.resonance.essence=36;assert.equal(R.exchange(s,target.dex).next,1);assert.equal(R.exchange(s,target.dex),null);
s.resonance.ranks[target.dex]=5;s.resonance.essence=999;assert.equal(R.exchange(s,target.dex),null);assert.equal(s.resonance.essence,999);
assert.equal(JSON.stringify(s.tickets),tickets);assert.equal(JSON.stringify(s.pity),pity);assert.equal(s.coins,coins);
checks.push('targeted recruit/grow spends exact essence, no overspend, capped purchase or gacha feedback loop');

s.partner=target.dex;const base=G.DEX_BY[target.dex];
const boosted=new G.Player(base,{hp:20,atkMul:1.3});
assert.equal(boosted.maxHp,Math.round((base.hp+20)*1.15));assert.equal(boosted.hp,boosted.maxHp);
assert.equal(boosted.atk,base.atk*1.2*1.3);assert.equal(boosted.cdMul,.95);assert.equal(boosted.spdMul,1.05);
const guardian=new G.Player(base,{},false,false);assert.equal(guardian.baseAtk,base.atk);assert.equal(guardian.maxHp,base.hp);
const noRank=new G.Player(G.DEX_BY[common.dex]);assert.equal(noRank.baseAtk,G.DEX_BY[common.dex].atk);
checks.push('actual Player receives combat bonuses; guardian actor avoids applying owner growth twice');

G.DB.commit(true);const backup=G.DB.exportSave();const loaded=G.DB.parseBackup(backup);
assert.equal(loaded.resonance.ranks[target.dex],5);assert.equal(loaded.resonance.essence,999);
G.DB.importSave(backup);assert.equal(G.DB.save.resonance.essence,999);
load('core/db');await G.DB.ready();assert.equal(G.DB.save.resonance.ranks[target.dex],5);assert.equal(G.DB.save.resonance.essence,999);
const legacy=JSON.parse(backup);delete legacy.save.resonance;
const migrated=G.DB.parseBackup(JSON.stringify(legacy));assert.equal(migrated.resonance.essence,0);assert.equal(Object.keys(migrated.resonance.ranks).length,0);
assert.equal(migrated.coins,legacy.save.coins);assert.equal(migrated.partner,legacy.save.partner);
for (const bad of [{ranks:{[target.dex]:6},essence:0},{ranks:{},essence:-1},{ranks:{},essence:1.5},{ranks:[],essence:0}]) {
  const doc=JSON.parse(backup);doc.save.resonance=bad;const before=G.DB.exportSave();
  assert.throws(()=>G.DB.importSave(JSON.stringify(doc)));assert.equal(G.DB.exportSave().split('"save":')[1],before.split('"save":')[1]);
}
const newer=JSON.parse(backup).save,older=JSON.parse(backup).save;
newer.updated=2;older.updated=1;newer.resonance.essence=0;older.resonance.essence=99;
older.resonance.ranks[dex]=5;newer.resonance.ranks[dex]=1;
const merged=G.DB.merge(newer,older);assert.equal(merged.resonance.essence,0);assert.equal(merged.resonance.ranks[dex],5);
assert.equal(JSON.stringify(G.DB.merge(merged,older)),JSON.stringify(merged));
checks.push('reload/export/import, old-save migration, malformed rejection and idempotent merge without restoring spent essence');

for (const dex of [172,25,26,232,220,221,473,467]) {
  assert.ok(G.DEX_BY[dex]&&G.SPRITE_META[dex]);
  for (const animation of ['Idle','Walk','Shoot','Hurt','Faint']) assert.ok(fs.existsSync(path.join(root,'assets/pokemon',String(dex),animation+'.png')),`${dex}/${animation}`);
}
checks.push('both new evolution families and pursuers have local animation assets');
console.log(JSON.stringify({ok:true,checks,networkRequests:0,limitation:'VM mechanics and source assets, not browser/touch or live saves'},null,2));
