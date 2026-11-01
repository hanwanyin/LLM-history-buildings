import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
// Credentials arrive only on stdin. No secrets are written to disk or logged.
if(process.stdin.isTTY)process.stdin.setRawMode(true);
process.stdout.write('Ready for import JSON on stdin (input is hidden).\n');
const config=await new Promise((resolve,reject)=>{let s='';process.stdin.setEncoding('utf8');const onData=chunk=>{s+=chunk;if(s.includes('\n')){process.stdin.off('data',onData);if(process.stdin.isTTY)process.stdin.setRawMode(false);process.stdin.pause();try{resolve(JSON.parse(s.trim()));}catch(e){reject(e);}}};process.stdin.on('data',onData);});
const origin=new URL(config.url).origin;
if(!origin.startsWith('https://')&&!['http://localhost:5173','http://127.0.0.1:5173'].includes(origin))throw Error('Import requires HTTPS or local development.');
const payload=await fs.readFile(config.seed_path||'data/seed.json','utf8');const seed=JSON.parse(payload);const dataset=createHash('sha256').update(payload).digest('hex').slice(0,20);
const headers={'Authorization':`Bearer ${config.token}`,...(config.bypass?{'OAI-Sites-Authorization':`Bearer ${config.bypass}`}:{})};
async function request(route,body,extra={}){for(let attempt=0;attempt<4;attempt++){const response=await fetch(origin+route,{method:'POST',headers:{...headers,...extra},body,signal:AbortSignal.timeout(60000)});const data=await response.json().catch(()=>({error:'Invalid server response'}));if(response.ok)return data;if(![429,500,502,503,504].includes(response.status)||attempt===3)throw Error(`${route}: ${response.status} ${data.error||'Request failed'}`);await new Promise(r=>setTimeout(r,1500*(attempt+1)));}}
for(const table of ['sources','heritage_sites','indicators','scores','dimension_scores','data_issues','spatial_matches']){
  const rows=seed[table];if(!rows?.length)continue;const chunks=[];for(let offset=0;offset<rows.length;offset+=80)chunks.push({table,chunk_id:`${dataset}:${table}:${offset}`,rows:rows.slice(offset,offset+80)});
  let cursor=0,done=0;await Promise.all(Array.from({length:Math.min(3,chunks.length)},async()=>{while(cursor<chunks.length){const chunk=chunks[cursor++];await request('/api/import',JSON.stringify(chunk),{'Content-Type':'application/json'});done++;if(done%25===0)console.log(`${table}: ${done}/${chunks.length} batches`);}}));
  console.log(`${table}: ${rows.length} rows imported and acknowledged`);
}
for(const source of seed.sources||[]){const bytes=await fs.readFile(path.join(config.source_dir||'..',source.filename));await request('/api/source-files/'+source.id,bytes,{'Content-Type':'application/octet-stream'});console.log(`Archived original: ${source.filename}`);}
const res=await fetch(origin+'/api/bootstrap',{headers:config.bypass?{'OAI-Sites-Authorization':`Bearer ${config.bypass}`}:{}});const check=await res.json();
for(const [key,table]of [['sites','heritage_sites'],['scores','scores'],['indicators','indicators'],['sources','sources']])if(seed[table]&&check.stats[key]!==seed[table].length)throw Error(`Reconciliation failed: ${key}`);
console.log(JSON.stringify({complete:true,stats:check.stats}));
