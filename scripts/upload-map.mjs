import fs from 'node:fs/promises';
if(process.stdin.isTTY)process.stdin.setRawMode(true);
console.log('Ready for map upload JSON on stdin (input is hidden).');
const config=await new Promise((resolve,reject)=>{let s='';process.stdin.setEncoding('utf8');const fn=chunk=>{s+=chunk;if(s.includes('\n')){process.stdin.off('data',fn);if(process.stdin.isTTY)process.stdin.setRawMode(false);process.stdin.pause();try{resolve(JSON.parse(s.trim()));}catch(e){reject(e);}}};process.stdin.on('data',fn);});
const origin=new URL(config.url).origin;if(!origin.startsWith('https://')&&!origin.startsWith('http://127.0.0.1:'))throw Error('Invalid origin');
const headers={Authorization:`Bearer ${config.token}`,...(config.bypass?{'OAI-Sites-Authorization':`Bearer ${config.bypass}`}:{})};
async function post(action,body,extra={}){for(let i=0;i<4;i++){const r=await fetch(origin+'/api/map-upload/'+action,{method:'POST',headers:{...headers,...extra},body,signal:AbortSignal.timeout(60000)});const v=await r.json();if(r.ok)return v;if(i===3||r.status<500)throw Error(`${action}: ${r.status} ${v.error}`);}}
const handle=await fs.open(config.file||'data/shanghai-buildings.pmtiles');const stat=await handle.stat();
const upload=await post('start','{}',{'Content-Type':'application/json'});const parts=[];
try{let next=0,done=0;const chunkSize=8*1024*1024,total=Math.ceil(stat.size/chunkSize);await Promise.all(Array.from({length:Math.min(3,total)},async()=>{while(next<total){const index=next++,offset=index*chunkSize,buffer=Buffer.alloc(Math.min(chunkSize,stat.size-offset));await handle.read(buffer,0,buffer.length,offset);const part=await post('part',buffer,{'X-Upload-Id':upload.upload_id,'X-Part-Number':String(index+1),'Content-Type':'application/octet-stream'});parts[index]=part;done+=buffer.length;console.log(`Map archive: ${done}/${stat.size} bytes uploaded`);}}));
const result=await post('complete',JSON.stringify({upload_id:upload.upload_id,parts}),{'Content-Type':'application/json'});if(result.size!==stat.size)throw Error('Uploaded size mismatch');console.log(JSON.stringify({complete:true,size:result.size}));
}catch(e){await post('abort',JSON.stringify({upload_id:upload.upload_id}),{'Content-Type':'application/json'}).catch(()=>{});throw e;}finally{await handle.close();}
