// GitHub keeps the complete local artwork in verified archive parts. No download.
// Sites/source exports already contain assets/, so their builds take the fast path.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
export function restoreAssets(force=false) {
  const manifestPath=path.join(root,'tools/assets-manifest.json');
  if (!force && fs.existsSync(path.join(root,'assets/pokemon/150/Idle.png')) && fs.existsSync(path.join(root,'assets/fonts/OFL.txt'))) return;
  const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
  const parts=manifest.parts.map(p=>{
    const b=fs.readFileSync(path.join(root,p.path));
    if(b.length!==p.bytes||digest(b)!==p.sha256)throw Error('Artwork archive part failed verification: '+p.path);
    return b;
  });
  const archive=Buffer.concat(parts);
  if(digest(archive)!==manifest.sha256)throw Error('Artwork archive SHA-256 mismatch');
  const tar=zlib.gunzipSync(archive);let count=0;
  for(let offset=0;offset+512<=tar.length;){
    const header=tar.subarray(offset,offset+512);if(header.every(b=>b===0))break;
    const field=(a,b)=>header.subarray(a,b).toString('utf8').replace(/\0.*$/s,'');
    const name=field(0,100),prefix=field(345,500),relative=prefix?prefix+'/'+name:name;
    const size=parseInt(field(124,136).trim()||'0',8),type=field(156,157);
    if(!Number.isSafeInteger(size)||size<0||!relative.startsWith('assets/')||relative.split('/').includes('..')||relative.includes('\\'))throw Error('Invalid artwork archive entry');
    const target=path.join(root,relative);offset+=512;
    if(offset+size>tar.length)throw Error('Truncated artwork archive');
    if(type==='5')fs.mkdirSync(target,{recursive:true});
    else if(type==='0'||type==='') {fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,tar.subarray(offset,offset+size));count++;}
    else throw Error('Unsupported artwork archive entry: '+type);
    offset+=Math.ceil(size/512)*512;
  }
  if(count!==manifest.files)throw Error('Artwork file count mismatch');
  console.log(`Restored ${count} verified local artwork files.`);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))restoreAssets(process.argv.includes('--force'));
