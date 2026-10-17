import assert from 'node:assert/strict';
import { harness } from './hunt-harness.mjs';

const h = await harness(), { G, start, summaries } = h;
const checks = [];
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
function twoMoves(p) { p.addMove(p.hasMove('tackle') ? 'quick-attack' : 'tackle'); }
function tick(p, dt) { G.BattleReport.update(dt, p); }

for (const mode of ['classic', 'expedition', 'guardian']) {
  const p = start(mode);
  twoMoves(p);
  tick(p, 30);
  p.setActive(0, true);
  tick(p, 10);
  G.Game.quit();
  const r = summaries.at(-1).battleReport;
  assert.equal(r.switches, 1);
  near(r.elapsed, 40);
  assert.equal(r.dominant.share, .75);
  assert.equal(r.hits, 0);
  G.Game.quit();
  assert.equal(summaries.at(-1).battleReport, r);
}
checks.push('real start/settlement in all three solo modes, one result and reset on replay');

let p = start();
twoMoves(p); // Automatic new-move selection must NOT count.
p.setActive(-1, true);
p.setActive(p.active, true);
p.item = 'choiceband';
p.cycle(1, true); // Rejected by the real item.
tick(p, 20);
let r = G.BattleReport.finish(p);
assert.equal(r.switches, 0);
assert.notEqual(r.hint.id, 'try-switch'); // Never recommend a forbidden switch.
checks.push('automatic/same/invalid/Choice Band switches excluded; no impossible switch advice');

p = start();
twoMoves(p);
p.cycle(1, true);
assert.equal(G.BattleReport.finish(p).switches, 1);
p = start();
twoMoves(p);
G.Input.tap = key => key === 'digit1';
G.Game.testFrame(17);
G.Input.tap = () => false;
assert.equal(G.BattleReport.finish(p).switches, 1);
checks.push('cycle and actual keyboard frame tag manual input at the accepted switch');

p = start();
twoMoves(p);
tick(p, 20);
p.bonds = 1;
p.fuse([p.moves[0], p.moves[1]]);
tick(p, 10);
r = G.BattleReport.finish(p);
assert.equal(r.switches, 0);
assert.equal(r.dominant.ids.length, 1);
near(r.dominant.share, 2 / 3);
assert.equal(r.hint.id, 'try-switch');
// No retained references to later move-name mutations.
const name = r.dominant.names[0];
p.moves.find(m => m.id === r.dominant.ids[0]).name = 'changed';
assert.equal(r.dominant.names[0], name);
checks.push('fusion/slot reindex does not rewrite historical groups or fabricate manual switches');

p = start('expedition');
G.Expedition.run.shield = 999;
tick(p, 10);
p.hurt(10); // Completely absorbed.
p.invuln = 0;
G.Expedition.run.shield = 0;
p.attackInvuln = 1;
p.hurt(10); // Automatic-dash invulnerability.
p.hurt(10, null, { pierceAttack: true }); // Boss-style piercing hit.
p.hurt(10, null, { pierceAttack: true }); // Hit grace still blocks this.
tick(p, 5);
r = G.BattleReport.finish(p);
assert.equal(r.hits, 1);
near(r.bestClean, 10);
checks.push('real defense/shield/invulnerability ordering, piercing hit and hit grace observed without changing damage');

p = start();
p.hp = 1;
p.item = 'focussash';
tick(p, 3);
p.hurt(1e6);
assert.equal(p.dead, false);
assert.equal(G.BattleReport.finish(p).hits, 1);
p = start();
p.item = 'lifeorb';
p.cast(p.activeMove());
assert.equal(G.BattleReport.finish(p).hits, 0);
checks.push('Focus Sash saved hit counts once; voluntary Life Orb cost is not a hit');

p = start();
const pet = new G.Player(p.mon, {}, false, false);
G.BattleReport.manualSwitch(pet);
G.BattleReport.hit(pet);
tick(pet, 100);
tick(p, NaN);
tick(p, -1);
tick(p, 12);
r = G.BattleReport.finish(p);
near(r.elapsed, 12);
assert.equal(r.hits, 0);
assert.equal(r.switches, 0);
assert.equal(r.hint.id, 'short-run');
G.BattleReport.hit(p);
tick(p, 100);
assert.equal(G.BattleReport.finish(p), r);
near(r.elapsed, 12);
checks.push('other actors/invalid dt/post-settlement events excluded; short runs make no diagnosis');

p = start();
tick(p, 7);
G.Game.togglePause();
G.Game.testFrame(1000);
G.Game.testFrame(2000);
G.Game.togglePause();
G.Game.testFrame(2016);
r = G.BattleReport.finish(p);
near(r.elapsed, 7.016);
p = start();
G.RunUI.showLevelUp = () => {};
G.Game.debugLevelUp();
G.Game.testFrame(2032);
assert.equal(G.Game.state, 'levelup');
G.Game.testFrame(3032);
G.Game.testFrame(4032);
r = G.BattleReport.finish(p);
near(r.elapsed, .016);
p = start();
tick(p, 7);
p.dead = true;
G.Game.testFrame(4048);
near(G.BattleReport.finish(p).elapsed, 7);
checks.push('actual frame excludes pause, level-up selection and post-death animation time');

p = start();
const before = JSON.stringify(G.DB.save);
twoMoves(p);
tick(p, 25);
G.BattleReport.hit(p);
G.BattleReport.finish(p);
assert.equal(JSON.stringify(G.DB.save), before);
G.BattleReport.start(null);
assert.equal(G.BattleReport.finish(p), null);
checks.push('report has no permanent save/reward writes and can be disabled for legacy coop');

// Small DOM stand-in verifies text insertion and replacement, not pixel layout.
function element(tag) {
  return { tag, style: {}, dataset: {}, children: [], textContent: '', classList: { toggle() {} },
    set innerHTML(value) { this.html = value; this.children = []; },
    get innerHTML() { return this.html || ''; },
    appendChild(child) { this.children.push(child); return child; } };
}
const nodes = Object.fromEntries(['over-title', 'over-stats', 'btn-again', 'btn-rematch'].map(k => [k, element('div')]));
G.UI.$ = id => nodes[id] || null;
G.UI.show = () => {};
G.ExpeditionUI.summary = () => {};
h.ctx.document.createElement = element;
h.load('ui/run-ui');
const show = report => G.RunUI.showOver({ dead: false, time: 20, level: 1, kills: 0, bosses: 0,
  coins: 0, breakdown: '', moves: [], battleReport: report }, () => {});
const safeReport = { elapsed: 20, switches: 0, hits: 0, bestClean: 20,
  dominant: { names: ['<img src=x onerror=alert(1)>'], share: 1 }, hint: { text: '提示' } };
show(safeReport);
assert.equal(nodes['over-stats'].children.length, 1);
assert.ok(nodes['over-stats'].children[0].children[1].textContent.includes('<img'));
assert.ok(nodes['over-stats'].children[0].children.every(el => !el.innerHTML));
show(safeReport);
assert.equal(nodes['over-stats'].children.length, 1);
show(null);
assert.equal(nodes['over-stats'].children.length, 0);
checks.push('result UI inserts literal text safely, replaces previous report and tolerates missing report');

console.log(JSON.stringify({ ok: true, checks, networkRequests: 0,
  limitation: 'VM mechanics and DOM semantics only; browser/mobile visual QA and usability not performed' }, null, 2));
