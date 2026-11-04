import {effectiveSpatial} from './clean-spatial';
import { env } from 'cloudflare:workers';
import { summarize, type ScoreRecord } from './assessment';
export function database() { if (!env.DB) throw new Error('DB binding unavailable'); return env.DB; }
export function json(data: unknown, status=200) { return Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}}); }
export class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }
export function identity(req: Request) {
  const id = req.headers.get('oai-authenticated-user-id');
  const email = req.headers.get('oai-authenticated-user-email')?.trim().toLowerCase();
  const admins=(env.ADMIN_EMAILS || '').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
  return { signedIn:!!id, admin:!!id && !!email && admins.includes(email), id, email };
}
export async function serviceAuth(req: Request) {
  const token=req.headers.get('Authorization')?.replace(/^Bearer /,'') || '';
  if (!env.ADMIN_IMPORT_TOKEN || !token) return false;
  const hash=async(s:string)=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));
  const [a,b]=await Promise.all([hash(token),hash(env.ADMIN_IMPORT_TOKEN)]);let diff=0;
  for(let i=0;i<a.length;i++)diff|=a[i]^b[i];return diff===0;
}
export async function authorize(req: Request, allowService=false) {
  if(allowService && await serviceAuth(req))return 'import-service';
  const user=identity(req);if(!user.admin)throw new HttpError(403,'仅管理员可以修改数据，请使用管理员账号登录。');
  const origin=req.headers.get('Origin');
  if(!['GET','HEAD'].includes(req.method)&&origin!==new URL(req.url).origin)throw new HttpError(403,'请求来源无效，请从本站提交。');
  return user.id!;
}
export async function body(req: Request, limit=1024*1024) {
  if(!req.headers.get('Content-Type')?.includes('application/json'))throw new HttpError(415,'请提交JSON数据。');
  if(Number(req.headers.get('Content-Length')||0)>limit)throw new HttpError(413,'请求内容过大。');
  const text=await req.text();if(new TextEncoder().encode(text).length>limit)throw new HttpError(413,'请求内容过大。');
  try{return JSON.parse(text);}catch{throw new HttpError(400,'JSON格式错误。');}
}
export function textValue(value: unknown,max=2000,required=false) {
  if(typeof value!=='string' || value.length>max || (required&&!value.trim()))throw new HttpError(400,'文本内容为空或超出长度限制。');
  return value.trim();
}
export const scoreQuery=`SELECT s.id,s.site_id,s.indicator_id,s.score,s.confidence,s.evidence,s.reasoning,s.missing,s.source_id,s.sheet,s.row_number,
  i.name AS indicator,i.dimension,i.category,i.position, f.filename,
  r.score AS expert_score,r.note AS review_note,r.created_at AS reviewed_at,COALESCE(c.revision,0) AS review_revision
  FROM scores s JOIN indicators i ON s.indicator_id=i.id JOIN sources f ON s.source_id=f.id
  LEFT JOIN current_reviews c ON c.score_id=s.id LEFT JOIN reviews r ON r.id=c.review_id`;
export async function siteDetail(id: string) {
  const db=database();
  const site=await db.prepare('SELECT * FROM heritage_sites WHERE id=?').bind(id).first();
  if(!site)throw new HttpError(404,'未找到该文物。');
  const result=await db.batch([
    db.prepare(scoreQuery+' WHERE s.site_id=? ORDER BY i.position').bind(id),
    db.prepare('SELECT d.id,d.dimension,d.score,d.confidence,d.evidence,d.reasoning,d.missing,d.row_number,f.filename FROM dimension_scores d JOIN sources f ON d.source_id=f.id WHERE d.site_id=?').bind(id),
    db.prepare('SELECT id,created_at FROM assessment_runs WHERE site_id=? ORDER BY created_at DESC LIMIT 20').bind(id),
    db.prepare('SELECT id,kind,description FROM data_issues WHERE site_id=?').bind(id),
    db.prepare('SELECT r.id,r.score,r.note,r.created_at,i.name AS indicator FROM reviews r JOIN scores s ON s.id=r.score_id JOIN indicators i ON i.id=s.indicator_id WHERE s.site_id=? ORDER BY r.created_at DESC LIMIT 50').bind(id),
    db.prepare('SELECT * FROM spatial_matches WHERE site_id=?').bind(id),
    db.prepare("SELECT id,site_id,title,kind,filename,source_url,publisher,published_at,locator,content,extraction_note,created_at,reviewed_at,review_note FROM knowledge_documents WHERE site_id=? AND status='approved' ORDER BY reviewed_at DESC").bind(id)
  ]);
  const {raw,...profile}=site;
  return {site:profile,scores:result[0].results,dimensions:result[1].results,runs:result[2].results,issues:result[3].results,reviews:result[4].results,spatial:effectiveSpatial(id,result[5].results[0]||null),supplements:result[6].results,summary:summarize(result[0].results as ScoreRecord[])};
}
export async function handleError(error: unknown) {
  if(error instanceof HttpError)return json({error:error.message},error.status);
  console.error(error instanceof Error ? error.message : 'Unknown API error');
  return json({error:'服务暂时不可用，请稍后重试。数据不会因刷新而丢失。'},500);
}
