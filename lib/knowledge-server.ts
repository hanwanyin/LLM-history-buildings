import { env } from 'cloudflare:workers';
import { database,json,authorize,body,textValue,HttpError } from './server';
import { extractDocument,uploadLimit } from './document-extract';
import { discover,providerNames,readLimited,type ResearchProvider } from './research-providers';
export const publicKnowledgeColumns='id,site_id,title,kind,filename,mime,size,sha256,source_url,publisher,published_at,locator,content,extraction_note,status,created_at,reviewed_at,review_note,revision';
const digest=async(bytes:Uint8Array)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes as BufferSource))).map(b=>b.toString(16).padStart(2,'0')).join('');
const hash=(text:string)=>digest(new TextEncoder().encode(text));
async function checkSite(siteId:unknown){const id=typeof siteId==='string'&&siteId.trim()?textValue(siteId,100,true):null;if(id&&!await database().prepare('SELECT id FROM heritage_sites WHERE id=?').bind(id).first())throw new HttpError(400,'文物编号不存在。');return id;}
async function listPublished(){return(await database().prepare(`SELECT ${publicKnowledgeColumns} FROM knowledge_documents WHERE status='approved' ORDER BY reviewed_at DESC LIMIT 500`).all()).results;}
export async function knowledgeGet(req:Request,action:string,id?:string){const db=database();
 if(action==='published')return json({documents:await listPublished()});
 if(action==='capabilities')return json({upload:true,providers:Object.entries(providerNames).map(([id,name])=>({id,name})),review_required:true,upload_limit:uploadLimit});
 if(action==='download'&&id){const record=await db.prepare('SELECT filename,object_key,status FROM knowledge_documents WHERE id=?').bind(id).first<{filename:string;object_key:string;status:string}>();if(!record)throw new HttpError(404,'资料不存在。');if(record.status!=='approved')await authorize(req);if(!record.object_key||!env.BUCKET)throw new HttpError(404,'此资料没有上传附件。');const object=await env.BUCKET.get(record.object_key);if(!object)throw new HttpError(404,'附件不存在。');return new Response(object.body,{headers:{'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(record.filename)}`,'Cache-Control':record.status==='approved'?'public, max-age=60':'private, no-store','X-Content-Type-Options':'nosniff'}});}
 await authorize(req);
 if(action==='queue'){const results=await db.batch([db.prepare(`SELECT ${publicKnowledgeColumns} FROM knowledge_documents ORDER BY created_at DESC LIMIT 200`),db.prepare('SELECT id,site_id,query,providers,status,steps,result_ids,created_at,finished_at FROM research_jobs ORDER BY created_at DESC LIMIT 15')]);return json({documents:results[0].results,jobs:results[1].results.map((job:any)=>({...job,steps:JSON.parse(job.steps),result_ids:JSON.parse(job.result_ids)}))});}
 throw new HttpError(404,'知识库接口不存在。');
}
export async function knowledgePost(req:Request,action:string,id?:string){const actor=await authorize(req),db=database(),now=new Date().toISOString();
 if(action==='upload'){
  if(!env.BUCKET)throw new HttpError(503,'文件存储暂不可用。');
  if(!req.headers.get('Content-Type')?.startsWith('multipart/form-data'))throw new HttpError(415,'请使用文件上传表单。');
  let bytes:Uint8Array;try{bytes=await readLimited(new Response(req.body),uploadLimit+65536);}catch{throw new HttpError(413,'上传内容不得超过10MB。');}
  const form=await new Response(bytes as BodyInit,{headers:{'Content-Type':req.headers.get('Content-Type')!}}).formData();const file=form.get('file');if(!file||typeof file==='string')throw new HttpError(400,'请选择文件。');
  const filename=file.name.replace(/[\\/\r\n\x00-\x1f]/g,'_').slice(0,180);const title=textValue(form.get('title')||filename,300,true),siteId=await checkSite(form.get('site_id')),sourceURL=textValue(form.get('source_url')||'',2000),excerpt=textValue(form.get('excerpt')||'',60000);
  if(sourceURL){try{const u=new URL(sourceURL);if(u.protocol!=='https:'||u.username||u.password)throw Error();}catch{throw new HttpError(400,'来源链接必须为有效的 HTTPS 网址。');}}
  const raw=new Uint8Array(await file.arrayBuffer());let extracted;try{extracted=extractDocument(filename,raw,excerpt);}catch(e){throw new HttpError(400,(e as Error).message);}
  const sha=await digest(raw),fingerprint=await hash('upload|'+(siteId||'')+'|'+sha);const prior=await db.prepare('SELECT id,status FROM knowledge_documents WHERE fingerprint=?').bind(fingerprint).first();if(prior)return json({saved:true,duplicate:true,...prior});
  const did=crypto.randomUUID(),key='knowledge/'+did+'/'+sha;await env.BUCKET.put(key,raw,{httpMetadata:{contentType:'application/octet-stream'}});
  try{await db.batch([db.prepare('INSERT INTO knowledge_documents (id,site_id,title,kind,filename,mime,size,sha256,object_key,source_url,publisher,locator,content,extraction_note,fingerprint,status,created_by,created_at,revision) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)').bind(did,siteId,title,'upload',filename,file.type||'application/octet-stream',raw.length,sha,key,sourceURL||null,'用户上传',extracted.locator,extracted.content,extracted.extraction_note,fingerprint,'pending',actor,now),db.prepare('INSERT INTO audit_logs (id,action,site_id,actor,details,created_at) VALUES (?,?,?,?,?,?)').bind(crypto.randomUUID(),'上传待核验资料',siteId,actor,JSON.stringify({document_id:did,sha256:sha}),now)]);}catch(e){await env.BUCKET.delete(key);const existing=await db.prepare('SELECT id,status FROM knowledge_documents WHERE fingerprint=?').bind(fingerprint).first();if(existing)return json({saved:true,duplicate:true,...existing});throw e;}
  return json({saved:true,id:did,status:'pending',...extracted});
 }
 const input=await body(req,10000);
 if(action==='review'&&id){const status=input.status;if(!['approved','rejected','pending'].includes(status)||!Number.isInteger(input.revision))throw new HttpError(400,'审核状态或版本无效。');const note=textValue(input.note,4000,true),siteId=await checkSite(input.site_id);
  const r=await db.batch([db.prepare('UPDATE knowledge_documents SET status=?,site_id=?,review_note=?,reviewed_by=?,reviewed_at=?,revision=revision+1 WHERE id=? AND revision=? RETURNING id').bind(status,siteId,note,actor,now,id,input.revision),db.prepare('INSERT INTO audit_logs (id,action,site_id,actor,details,created_at) SELECT ?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM knowledge_documents WHERE id=? AND revision=? AND reviewed_at=?)').bind(crypto.randomUUID(),'审核补充资料',siteId,actor,JSON.stringify({document_id:id,status,note}),now,id,input.revision+1,now)]);
  if(!r[0].results.length)throw new HttpError(409,'资料已经更新，请刷新后重新审核。');return json({saved:true,status});
 }
 if(action==='research'){
  const query=textValue(input.query,120,true),siteId=await checkSite(input.site_id),jobId=textValue(input.request_id,100,true);if(!/^[a-zA-Z0-9-]{16,100}$/.test(jobId))throw new HttpError(400,'任务编号无效。');
  const providers=Array.isArray(input.providers)?[...new Set(input.providers)].filter(p=>p==='museum'||p==='crossref') as ResearchProvider[]:[];if(!providers.length||providers.length!==input.providers.length)throw new HttpError(400,'请选择已接入的检索源。');
  const prior=await db.prepare('SELECT * FROM research_jobs WHERE id=?').bind(jobId).first<any>();if(prior){if(prior.actor!==actor||prior.query!==query||prior.site_id!==siteId||prior.providers!==JSON.stringify(providers))throw new HttpError(409,'任务编号已被使用。');return json({job_id:prior.id,status:prior.status,steps:JSON.parse(prior.steps),result_ids:JSON.parse(prior.result_ids),reused:true});}
  const recent=await db.prepare("SELECT id FROM research_jobs WHERE actor=? AND created_at>? LIMIT 1").bind(actor,new Date(Date.now()-10000).toISOString()).first();if(recent)throw new HttpError(429,'请等待10秒后再启动新的检索任务。');
  const cached=await db.prepare("SELECT * FROM research_jobs WHERE query=? AND COALESCE(site_id,'')=? AND providers=? AND status='complete' AND created_at>? ORDER BY created_at DESC LIMIT 1").bind(query,siteId||'',JSON.stringify(providers),new Date(Date.now()-600000).toISOString()).first<any>();if(cached)return json({job_id:cached.id,status:cached.status,steps:JSON.parse(cached.steps),result_ids:JSON.parse(cached.result_ids),reused:true});
  await db.prepare('INSERT INTO research_jobs (id,site_id,query,providers,status,steps,result_ids,actor,created_at) VALUES (?,?,?,?,?,?,?,?,?)').bind(jobId,siteId,query,JSON.stringify(providers),'running','[]','[]',actor,now).run();
  const steps:any[]=[],ids:string[]=[];
  for(const provider of providers){try{const results=await discover(provider,query);let added=0,duplicates=0;for(const item of results){const fingerprint=await hash('agent|'+(siteId||'')+'|'+item.source_url);const did=crypto.randomUUID();const result=await db.prepare('INSERT OR IGNORE INTO knowledge_documents (id,site_id,title,kind,source_url,publisher,published_at,locator,content,extraction_note,fingerprint,status,created_by,created_at,revision) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)').bind(did,siteId,item.title,'agent',item.source_url,item.publisher,item.published_at,item.locator,item.content,item.extraction_note,fingerprint,'pending',actor,now).run();if(result.meta.changes){added++;ids.push(did);}else duplicates++;}steps.push({provider,status:'complete',found:results.length,added,duplicates,message:results.length?'检索完成，新增内容待审核。':'未找到结果，没有生成替代内容。'});}catch(e){steps.push({provider,status:'failed',message:(e as Error).name==='TimeoutError'?'来源服务超时，未取得资料。':(e as Error).message});}}
  const status=steps.every(s=>s.status==='failed')?'failed':steps.some(s=>s.status==='failed')?'partial':'complete';
  await db.batch([db.prepare('UPDATE research_jobs SET status=?,steps=?,result_ids=?,finished_at=? WHERE id=?').bind(status,JSON.stringify(steps),JSON.stringify(ids),new Date().toISOString(),jobId),db.prepare('INSERT INTO audit_logs (id,action,site_id,actor,details,created_at) VALUES (?,?,?,?,?,?)').bind(crypto.randomUUID(),'资料检索 Agent',siteId,actor,JSON.stringify({job_id:jobId,query,providers,status,count:ids.length}),now)]);
  return json({job_id:jobId,status,steps,result_ids:ids});
 }
 throw new HttpError(404,'知识库操作不存在。');
}
