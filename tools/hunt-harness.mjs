// Shared deterministic VM fixture: real combat, enemies, saves and run lifecycle.
// Rendering, input, terrain/audio are stubbed; never connects to live user data.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export async function harness() {
  const memory = new Map(), prompts = [], summaries = [], banners = [], noop = () => {};
  let seed = 147, storageFails = false;
  const math = Object.create(Math); math.random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const G = { SOLO:true, LIFT:10, BIOME_MUSIC:['test'], T:s=>s, Settings:{get:()=>false,sample:noop},SettingsUI:{isOpen:false},
    Sprites:{PX:2, Animator:class {update(){} loop(){} play(){} busy(){return false;} progress(){return 1;}}, bodyRadius:()=>12,bodyHeight:()=>24,animMeta:()=>null,hasShiny:d=>!!G.SPRITE_META[d]?.sh,hovers:()=>false,dirFromAngle:()=>0,preload:noop},
    FX:new Proxy({}, {get:()=>noop}),Audio:{sfx:noop,music:noop},Camera:{kick:noop,sees:()=>true,outerRadius:()=>300,follow:noop},
    World:{isWall:()=>false,isFree:()=>true,projectileBlock:()=>false,isLiquid:()=>false,liquidEffect:()=>({}),propsInCircle:()=>[],nearestBreakable:()=>null,collide:noop,reset:noop,setBiome:noop,update:noop,biomeName:()=>''},
    Weather:{speedFor:()=>1,mult:()=>1,reset:noop,update:noop},Coop:{active:false,isHost:false,scaleHp:()=>1,scaleRate:()=>1},Rift:{inArena:false,reset:noop,update:noop},
    Input:{axis:()=>[0,0],tap:()=>false,endFrame:noop},Path:{dirFor:()=>null,clear:noop,update:noop},Events:{reset:noop,update:noop,bag:()=>null},
    Pickups:{clear:noop,drop:noop,dropXp:noop,pullAll:noop,update:noop},VFX:{forMove:()=>({}),forType:()=>({})},
    UI:{tick:noop,hideAll:noop,hide:noop,chrome:noop,toast:noop,isOpen:()=>false},Touch:{reset:noop},Progress:{event:noop,kill:noop,checkAch:noop},
    Guard:{start:noop,flag:noop,end:()=>true,tick:noop},Ranking:{runStarted:noop},Social:{},Interact:{update:noop},
    RunUI:{showOver:r=>summaries.push(r),showPause:noop},ExpeditionUI:{keys:()=>false,showChoice:(kind,list,cb)=>prompts.push({kind,list,cb})}
  };
  const ctx = vm.createContext({G,window:{G},Math:math,Date,console,setTimeout,clearTimeout,performance:{now:()=>100000},
    document:{addEventListener:noop},addEventListener:noop,dispatchEvent:noop,CustomEvent:class{},navigator:{onLine:true},
    localStorage:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>{if(storageFails)throw Error('quota');memory.set(k,v);},removeItem:k=>memory.delete(k)} });
  const load = name => vm.runInContext(fs.readFileSync(path.join(root,'js',name+'.js'),'utf8'),ctx,{filename:name});
  for (const name of ['core/util','data/pokedex','data/sprites-meta','data/types','data/moves','data/starters','data/upgrades','data/items','data/enemies','systems/resonance','systems/growth','systems/battle-report','systems/switch-link','systems/species-habits','core/db','entities/player','entities/enemy','entities/projectile','systems/combat','systems/levelup','systems/spawner','systems/expedition','systems/expedition-trials','systems/ultimate','systems/dash-evolution','systems/bounties','systems/guardian-steering','systems/guardian','systems/gacha','systems/hazards','systems/hunt','game']) load(name);
  // Only the test context receives the private step. Production exports unchanged.
  const game = fs.readFileSync(path.join(root,'js/game.js'),'utf8').replace('init, startRun, everyone, levelXp, flash, offerBond,','init, startRun, everyone, levelXp, flash, offerBond, testStep: update, testFrame: frame,');
  vm.runInContext(game.replace("if (pl && state !== 'ui') render(); else Backdrop.render(ctx, w, h, dpr, dt);", ""),ctx);
  await G.DB.ready(); G.DB.save.partner=25; G.DB.grant(25,'test');
  G.Spawner.say = s => banners.push(s);
  function start(mode='classic',difficulty='normal') {G.Game.startRun(null,{mode,difficulty});G.EnemyMgr.clear();G.Hazards.clear();return G.Game.player;}
  function cards(p,id,n) {for(let i=0;i<n;i++){G.Growth.apply(p,id);p.statsTaken[id]=(p.statsTaken[id]||0)+1;}}
  return {G,ctx,memory,prompts,summaries,banners,load,start,cards,setSeed:n=>{seed=n;},failStorage:b=>{storageFails=b;}};
}
