import { env } from 'cloudflare:workers';
import { database, json, identity, authorize, body, textValue, siteDetail, scoreQuery, HttpError, handleError } from '../../../lib/server';
export const dynamic='force-dynamic';
function path(req:Request){return new URL(req.url).pathname.replace(/^\/api\//,'').split('/').map(decodeURIComponent);}
export async function GET(req:Request){try{
  const [kind,id,action]=path(req);const db=database();const url=new URL(req.url);
  if(kind==='bootstrap'){
    const results=await db.batch([
      db.prepare(`SELECT (SELECT COUNT(*) FROM heritage_sites) AS sites,(SELECT COUNT(*) FROM scores) AS scores,(SELECT COUNT(*) FROM indicators) AS indicators,(SELECT COUNT(*) FROM sources) AS sources,(SELECT COUNT(*) FROM scores WHERE score IS NULL) AS missing,(SELECT COUNT(*) FROM current_reviews) AS reviewed,(SELECT COUNT(*) FROM data_issues) AS issues,(SELECT COUNT(DISTINCT site_id) FROM scores) AS detailed_sites,(SELECT COUNT(*) FROM assessment_runs) AS runs`),
      db.prepare(`SELECT h.id,h.name,h.district,h.address,h.level,h.type,h.longitude,h.latitude,m.longitude AS map_lon,m.latitude AS map_lat,m.status AS match_status,m.distance_m,m.building_id,COUNT(s.id) AS detail_count,COUNT(CASE WHEN s.score IS NULL AND s.id IS NOT NULL THEN 1 END) AS missing_count FROM heritage_sites h LEFT JOIN scores s ON s.site_id=h.id LEFT JOIN spatial_matches m ON m.site_id=h.id GROUP BY h.id ORDER BY h.id`),
      db.prepare('SELECT * FROM indicators ORDER BY position'),
      db.prepare('SELECT district,COUNT(*) AS count FROM heritage_sites GROUP BY district ORDER BY count DESC'),
      db.prepare(`SELECT i.dimension,COUNT(*) AS total,COUNT(s.score) AS valid,AVG(s.score) AS average,SUM(CASE WHEN s.confidence='低' THEN 1 ELSE 0 END) AS low FROM scores s JOIN indicators i ON i.id=s.indicator_id GROUP BY i.dimension`)
    ]);
    const user=identity(req);return json({stats:results[0].results[0],sites:results[1].results,indicators:results[2].results,districts:results[3].results,dimensions:results[4].results,user:{signedIn:user.signedIn,admin:user.admin,email:user.signedIn?user.email:null},storage:'Cloudflare D1'});
  }
  if(kind==='map'&&id==='archive')return await mapArchive(req);
  if(kind==='map'&&id==='match'&&action){const r=await db.prepare('SELECT * FROM spatial_matches WHERE site_id=?').bind(action).first();if(!r)throw new HttpError(404,'该文物尚未完成建筑匹配。');return json(r);}
  if(kind==='sites'&&id)return json(await siteDetail(id));
  if(kind==='sources'&&id&&action==='download'){
    const source=await db.prepare('SELECT * FROM sources WHERE id=?').bind(id).first<{filename:string;object_key:string}>();
    if(!source?.object_key || !env.BUCKET)throw new HttpError(404,'原始文件暂不可下载。');
    const object=await env.BUCKET.get(source.object_key);if(!object)throw new HttpError(404,'原始文件不存在。');
    return new Response(object.body,{headers:{'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(source.filename)}`,'X-Content-Type-Options':'nosniff'}});
  }
  if(kind==='sources'){
    const r=await db.batch([db.prepare('SELECT * FROM sources ORDER BY imported_at,filename'),db.prepare('SELECT id,site_id,source_id,row_number,kind,description FROM data_issues ORDER BY kind,site_id')]);return json({sources:r[0].results,issues:r[1].results});
  }
  if(kind==='evidence'){
    const q=(url.searchParams.get('q')||'').trim().slice(0,100);const siteId=url.searchParams.get('site')||'';
    if(!q&&!siteId)return json({results:[],total:0});
    const terms=q.split(/\s+/).filter(Boolean).slice(0,6);const where:string[]=[];const args:unknown[]=[];
    if(siteId){where.push('s.site_id=?');args.push(siteId);}
    for(const term of terms){where.push("(s.evidence LIKE ? ESCAPE '\\' OR s.reasoning LIKE ? ESCAPE '\\' OR i.name LIKE ? ESCAPE '\\' OR h.name LIKE ? ESCAPE '\\')");const value='%'+term.replace(/[\\%_]/g,'\\$&')+'%';args.push(value,value,value,value);}
    const from=' FROM scores s JOIN indicators i ON s.indicator_id=i.id JOIN heritage_sites h ON s.site_id=h.id JOIN sources f ON s.source_id=f.id WHERE '+where.join(' AND ');
    const r=await db.batch([db.prepare('SELECT s.id,s.site_id,s.score,s.confidence,s.evidence,s.reasoning,s.missing,s.sheet,s.row_number,h.name AS site_name,i.name AS indicator,i.dimension,f.filename'+from+' ORDER BY h.id,i.position LIMIT 100').bind(...args),db.prepare('SELECT COUNT(*) AS count'+from).bind(...args)]);
    return json({results:r[0].results,total:(r[1].results[0] as {count:number}).count,method:'关键词检索，多个关键词以空格分隔；结果为原始Excel证据，不生成新的LLM结论。'});
  }
  if(kind==='assessments'&&id){const r=await db.prepare('SELECT id,site_id,snapshot,created_at FROM assessment_runs WHERE id=?').bind(id).first<{snapshot:string}>();if(!r)throw new HttpError(404,'评价记录不存在。');return json({...r,snapshot:JSON.parse(r.snapshot)});}
  if(kind==='audit'){await authorize(req);const r=await db.prepare('SELECT id,action,site_id,details,created_at FROM audit_logs ORDER BY created_at DESC LIMIT 100').all();return json(r.results);}
  throw new HttpError(404,'接口不存在。');
}catch(e){return handleError(e);}}

export async function PATCH(req:Request){try{
  const actor=await authorize(req);const [kind,id]=path(req);if(kind!=='sites'||!id)throw new HttpError(404,'接口不存在。');
  const input=await body(req,30000);const fields=['name','district','address','level','type','age','material','structure','condition','opening','tourism','core_area'];
  if(!Number.isInteger(input.revision)||input.revision<1)throw new HttpError(400,'缺少版本信息，请刷新后重试。');
  const values=fields.map(k=>textValue(input[k],2000,['name','district'].includes(k)));const now=new Date().toISOString();const db=database();
  const r=await db.batch([
    db.prepare(`UPDATE heritage_sites SET ${fields.map(k=>k+'=?').join(',')},revision=revision+1,updated_at=? WHERE id=? AND revision=? RETURNING id`).bind(...values,now,id,input.revision),
    db.prepare('INSERT INTO audit_logs (id,action,site_id,actor,details,created_at) SELECT ?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM heritage_sites WHERE id=? AND revision=? AND updated_at=?)').bind(crypto.randomUUID(),'修改文物档案',id,actor,JSON.stringify(Object.fromEntries(fields.map((k,i)=>[k,values[i]]))),now,id,input.revision+1,now)
  ]);
  if(!r[0].results.length)throw new HttpError(409,'档案已被更新，请刷新后重新编辑。');return json({saved:true});
}catch(e){return handleError(e);}}

export async function POST(req:Request){try{
  const [kind,id]=path(req);const db=database();
  if(kind==='map-upload'){await authorize(req,true);return await uploadMap(req,id);}
  if(kind==='import'){await authorize(req,true);return await importBatch(req);}
  if(kind==='source-files'){
    await authorize(req,true);const source=await db.prepare('SELECT * FROM sources WHERE id=?').bind(id||'').first<{filename:string;sha256:string;size:number}>();
    if(!source||!env.BUCKET)throw new HttpError(404,'文件来源不存在。');
    if(source.size>10*1024*1024)throw new HttpError(413,'文件超过10MB限制。');const bytes=await req.arrayBuffer();
    if(bytes.byteLength!==source.size)throw new HttpError(400,'文件大小与登记信息不一致。');
    const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(b=>b.toString(16).padStart(2,'0')).join('');
    if(digest!==source.sha256)throw new HttpError(400,'文件校验不一致，已拒绝保存。');
    const key=`sources/${source.sha256}/${source.filename}`;await env.BUCKET.put(key,bytes);await db.prepare('UPDATE sources SET object_key=? WHERE id=?').bind(key,id).run();return json({saved:true});
  }
  const actor=await authorize(req);const input=await body(req,30000);const now=new Date().toISOString();
  if(kind==='spatial-confirm'){
    const siteId=textValue(input.site_id,100,true),buildingId=textValue(input.building_id,100,true),note=textValue(input.note,2000,true);
    if(!Number.isInteger(input.revision)||input.revision<1)throw new HttpError(400,'版本信息无效。');
    const old=await db.prepare('SELECT candidates FROM spatial_matches WHERE site_id=?').bind(siteId).first<{candidates:string}>();if(!old)throw new HttpError(404,'空间匹配记录不存在。');
    const c=JSON.parse(old.candidates).find((x:{building_id:string})=>x.building_id===buildingId);if(!c)throw new HttpError(400,'请选择已登记的候选建筑。');
    const r=await db.batch([db.prepare("UPDATE spatial_matches SET building_id=?,status='confirmed',longitude=?,latitude=?,distance_m=?,height=?,geometry=?,revision=revision+1,updated_at=? WHERE site_id=? AND revision=? RETURNING site_id").bind(buildingId,c.longitude,c.latitude,c.distance_m,c.height,JSON.stringify(c.geometry),now,siteId,input.revision),db.prepare('INSERT INTO audit_logs (id,action,site_id,actor,details,created_at) SELECT ?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM spatial_matches WHERE site_id=? AND revision=? AND updated_at=?)').bind(crypto.randomUUID(),'确认建筑关联',siteId,actor,JSON.stringify({building_id:buildingId,note}),now,siteId,input.revision+1,now)]);
    if(!r[0].results.length)throw new HttpError(409,'建筑关联已有更新，请刷新后重试。');return json({saved:true});
  }
  if(kind==='reviews'){
    const scoreId=textValue(input.score_id,100,true);const note=textValue(input.note,4000,true);
    if(!Number.isInteger(input.score)||input.score<1||input.score>5||!Number.isInteger(input.revision)||input.revision<0)throw new HttpError(400,'复核分值必须是1—5的整数，并带有当前版本号。');
    const existing=await db.prepare('SELECT site_id FROM scores WHERE id=?').bind(scoreId).first<{site_id:string}>();if(!existing)throw new HttpError(404,'评分记录不存在。');
    const rid=crypto.randomUUID();
    const r=await db.batch([
      db.prepare('INSERT INTO reviews (id,score_id,score,note,reviewer,created_at) SELECT ?,?,?,?,?,? WHERE COALESCE((SELECT revision FROM current_reviews WHERE score_id=?),0)=?').bind(rid,scoreId,input.score,note,actor,now,scoreId,input.revision),
      db.prepare('INSERT INTO current_reviews (score_id,review_id,revision) SELECT ?,?,? WHERE EXISTS (SELECT 1 FROM reviews WHERE id=?) ON CONFLICT(score_id) DO UPDATE SET review_id=excluded.review_id,revision=excluded.revision').bind(scoreId,rid,input.revision+1,rid),
      db.prepare('INSERT INTO audit_logs (id,action,site_id,actor,details,created_at) SELECT ?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM reviews WHERE id=?)').bind(crypto.randomUUID(),'专家复核',existing.site_id,actor,JSON.stringify({score_id:scoreId,score:input.score,note}),now,rid)
    ]);
    if(r[0].meta.changes!==1)throw new HttpError(409,'该指标已有新的复核，请刷新后重试。');return json({saved:true,id:rid});
  }
  if(kind==='assessments'){
    const sid=textValue(input.site_id,100,true);const detail=await siteDetail(sid);if(!detail.scores.length)throw new HttpError(422,'该文物缺少明细，无法生成明细评价快照。');
    const rid=crypto.randomUUID();const snapshot={...detail,generated_at:now};delete (snapshot as Record<string,unknown>).runs;
    await db.batch([db.prepare('INSERT INTO assessment_runs (id,site_id,snapshot,created_at,created_by) VALUES (?,?,?,?,?)').bind(rid,sid,JSON.stringify(snapshot),now,actor),db.prepare('INSERT INTO audit_logs (id,action,site_id,actor,details,created_at) VALUES (?,?,?,?,?,?)').bind(crypto.randomUUID(),'保存评价快照',sid,actor,JSON.stringify({run_id:rid,summary:detail.summary}),now)]);
    return json({saved:true,id:rid,summary:detail.summary});
  }
  throw new HttpError(404,'接口不存在。');
}catch(e){return handleError(e);}}

const importColumns:Record<string,string[]>={
  sources:['id','filename','sha256','rows','imported_rows','kind','size','object_key','imported_at'],
  heritage_sites:['id','name','district','address','level','type','age','material','structure','condition','opening','tourism','core_area','longitude','latitude','raw','revision','updated_at'],
  indicators:['id','dimension','category','name','position'],
  scores:['id','site_id','indicator_id','score','confidence','evidence','reasoning','missing','source_id','sheet','row_number','raw'],
  dimension_scores:['id','site_id','dimension','score','confidence','evidence','reasoning','missing','source_id','row_number','raw'],
  data_issues:['id','site_id','source_id','row_number','kind','description','raw'],
  spatial_matches:['site_id','building_id','status','original_lon','original_lat','longitude','latitude','distance_m','height','geometry','candidates','revision','updated_at']
};
async function importBatch(req:Request){
  const input=await body(req,2*1024*1024);const columns=importColumns[input.table];
  if(!columns||!Array.isArray(input.rows)||input.rows.length<1||input.rows.length>80)throw new HttpError(400,'导入表或批次大小无效，每批1—80条。');
  const chunkId=textValue(input.chunk_id,160,true);const canonical=JSON.stringify({table:input.table,rows:input.rows});
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical)))).map(b=>b.toString(16).padStart(2,'0')).join('');
  const db=database();const prior=await db.prepare('SELECT digest,rows FROM import_chunks WHERE id=?').bind(chunkId).first<{digest:string;rows:number}>();
  if(prior){if(prior.digest!==digest)throw new HttpError(409,'该批次编号已对应另一份数据。');return json({saved:true,already_imported:true,rows:prior.rows});}
  const statements=input.rows.map((row:Record<string,unknown>)=>{
    if(!row||typeof row!=='object'||columns.some(k=>!(k in row))||Object.keys(row).some(k=>!columns.includes(k)))throw new HttpError(400,'导入字段不匹配。');
    for(const value of Object.values(row))if(value!==null&&!['string','number'].includes(typeof value))throw new HttpError(400,'导入值类型不匹配。');
    if('score'in row&&row.score!==null&&(typeof row.score!=='number'||!Number.isFinite(row.score)||row.score<(input.table==='dimension_scores'?0:1)||row.score>5))throw new HttpError(400,'评分值超出允许范围。');
    return db.prepare(`INSERT INTO ${input.table} (${columns.join(',')}) VALUES (${columns.map(()=>'?').join(',')})`).bind(...columns.map(k=>row[k]));
  });
  statements.push(db.prepare('INSERT INTO import_chunks (id,digest,rows,created_at) VALUES (?,?,?,?)').bind(chunkId,digest,input.rows.length,new Date().toISOString()));
  try{await db.batch(statements);}catch(e){const prior=await db.prepare('SELECT digest FROM import_chunks WHERE id=?').bind(chunkId).first<{digest:string}>();if(prior?.digest===digest)return json({saved:true,already_imported:true,rows:input.rows.length});throw e;}
  return json({saved:true,rows:input.rows.length});
}

const archiveKey='maps/shanghai-buildings.pmtiles';
async function mapArchive(req:Request){
  if(!env.BUCKET)throw new HttpError(503,'建筑地图暂不可用。');
  const head=await env.BUCKET.head(archiveKey);if(!head)throw new HttpError(503,'建筑底图正在归档，请稍后刷新。');
  const headers=new Headers({'Accept-Ranges':'bytes','Content-Type':'application/octet-stream','ETag':head.httpEtag,'Cache-Control':'public, max-age=86400','X-Content-Type-Options':'nosniff'});
  if(req.method==='HEAD'){headers.set('Content-Length',String(head.size));return new Response(null,{headers});}
  const range=req.headers.get('Range');
  if(range){const m=/^bytes=(\d+)-(\d*)$/.exec(range);if(!m)return new Response(null,{status:416,headers:{'Content-Range':`bytes */${head.size}`}});
    const offset=Number(m[1]),end=m[2]?Math.min(Number(m[2]),head.size-1):head.size-1;
    if(!Number.isSafeInteger(offset)||offset<0||offset>=head.size||end<offset||end-offset+1>8*1024*1024)return new Response(null,{status:416,headers:{'Content-Range':`bytes */${head.size}`}});
    const obj=await env.BUCKET.get(archiveKey,{range:{offset,length:end-offset+1}});if(!obj)throw new HttpError(404,'建筑地图不存在。');headers.set('Content-Range',`bytes ${offset}-${end}/${head.size}`);headers.set('Content-Length',String(end-offset+1));return new Response(obj.body,{status:206,headers});
  }
  const obj=await env.BUCKET.get(archiveKey);headers.set('Content-Length',String(head.size));return new Response(obj!.body,{headers});
}
export async function HEAD(req:Request){try{const [kind,id]=path(req);if(kind==='map'&&id==='archive')return await mapArchive(req);return new Response(null,{status:404});}catch(e){return handleError(e);}}
async function uploadMap(req:Request,action:string){
  if(!env.BUCKET)throw new HttpError(503,'文件存储暂不可用。');
  if(action==='start'){const upload=await env.BUCKET.createMultipartUpload(archiveKey,{httpMetadata:{contentType:'application/octet-stream'}});return json({upload_id:upload.uploadId});}
  if(action==='part'){const uploadId=req.headers.get('X-Upload-Id')||'';const part=Number(req.headers.get('X-Part-Number'));if(!uploadId||!Number.isInteger(part)||part<1||part>200)throw new HttpError(400,'分片信息无效。');const bytes=await req.arrayBuffer();if(bytes.byteLength>8*1024*1024)throw new HttpError(413,'分片过大。');const upload=env.BUCKET.resumeMultipartUpload(archiveKey,uploadId);return json(await upload.uploadPart(part,bytes));}
  if(action==='complete'){const input=await body(req,30000);if(typeof input.upload_id!=='string'||!Array.isArray(input.parts)||input.parts.length>200)throw new HttpError(400,'分片清单无效。');const object=await env.BUCKET.resumeMultipartUpload(archiveKey,input.upload_id).complete(input.parts);return json({saved:true,size:object.size,etag:object.etag});}
  if(action==='abort'){const input=await body(req,3000);await env.BUCKET.resumeMultipartUpload(archiveKey,textValue(input.upload_id,2000,true)).abort();return json({aborted:true});}
  throw new HttpError(404,'上传操作不存在。');
}
