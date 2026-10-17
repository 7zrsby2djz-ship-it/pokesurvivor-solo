// Focused archival check. No requests, browser session, or game/save mutations.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const exists = p => fs.existsSync(path.join(root, p));
const errors = [];
let spriteRefs = 0, assets = 0;
const ctx = { G: {} };
vm.runInNewContext(read('js/data/sprites-meta.js'), ctx);
for (const [dex, m] of Object.entries(ctx.G.SPRITE_META)) {
  for (const anim of Object.keys(m.a)) {
    for (const shiny of [false, true]) {
      if (shiny && (!m.sh || (m.sm || []).includes(anim))) continue;
      const p = `assets/pokemon/${dex}/${shiny ? 's/' : ''}${anim}.png`;
      spriteRefs++;
      if (!exists(p) || !exists('dist/' + p)) errors.push('Missing sprite: ' + p);
    }
  }
}
function walk(p) {
  for (const d of fs.readdirSync(path.join(root, p), { withFileTypes: true })) {
    const f = p + '/' + d.name;
    if (d.isDirectory()) walk(f);
    else {
      assets++;
      if (!exists('dist/' + f)) { errors.push('Missing deployed asset: ' + f); continue; }
      const digest = p => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, p))).digest('hex');
      if (digest(f) !== digest('dist/' + f)) errors.push('Asset differs: ' + f);
    }
  }
}
walk('assets');
for (const page of ['dev.html', 'index.html', 'dist/index.html']) {
  const html = read(page), dir = path.dirname(page);
  const refs = [...html.matchAll(/<(?:script|link|img)\b[^>]*\b(?:src|href)="([^"]+)"/g)].map(m => m[1]);
  for (const ref of refs) {
    if (/^https?:\/\//.test(ref)) {
      if (!html.includes(`rel="canonical" href="${ref}"`)) errors.push('External page resource: ' + ref);
    } else if (!ref.startsWith('data:') && !ref.startsWith('#') && !exists(path.join(dir, ref.split(/[?#]/)[0]))) errors.push('Missing page resource: ' + page + ': ' + ref);
  }
}
for (const f of ['LICENSE', 'CREDITS.md', 'assets/fonts/OFL.txt', 'js/core/audio.js', 'js/data/music.js']) if (!exists(f)) errors.push('Missing credits/audio: ' + f);
const config = { G: {} };
vm.runInNewContext(read('js/core/firebase-config.js'), config);
if (config.G.SOLO !== true || config.G.FIREBASE_CONFIG !== null) errors.push('Cloud configuration enabled');
if (!/if \(G\.SOLO\)[\s\S]*beginLocal\('solo',/.test(read('js/core/db.js'))) errors.push('Solo save startup missing');
new vm.Script(read('dist/js/game.bundle.js'));
if (read('js/app.min.js') !== read('dist/js/game.bundle.js')) errors.push('Legacy entry uses a different game');
const result = { ok: !errors.length, spriteRefs, localAssets: assets, requiredExternalResources: 0, networkRequestsMadeByCheck: 0, saveKey: 'ps.save.solo', errors };
console.log(JSON.stringify(result, null, 2));
if (errors.length) process.exitCode = 1;
