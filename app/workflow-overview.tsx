'use client';
import {useEffect,useState} from 'react';
import {assetUrl} from '../lib/client-data';
import {useLocale} from '../lib/i18n';
import {ArrowUpRight} from 'lucide-react';
type Row=Record<string,any>;

const STEPS=[
 {page:'compute',num:'01',zh:'地图与图谱工作台',en:'Map & graph workspace',
  zhDesc:'全域地图、文物知识图谱与统计入口；先确定评价对象与所在位置。',enDesc:'Citywide map, heritage graph and statistics; choose the object under review.'},
 {page:'sources',num:'02',zh:'数据管理',en:'Data management',
  zhDesc:'原始数据核查、资料批次、全文献知识图谱，并从图谱形成候选指标与标准草案。',enDesc:'Source checks, intake batches, the document graph and criteria drafts derived from it.'},
 {page:'assessment',num:'03',zh:'本体评价',en:'Asset assessment',
  zhDesc:'27 项正式指标、五维评分、规则试算与 RAG 证据检索，保留原始分值。',enDesc:'27 formal indicators, five dimensions, rule trials and RAG evidence retrieval.'},
 {page:'group-risk',num:'04',zh:'参考空间评价',en:'Spatial assessment',
  zhDesc:'建筑群四类风险与阈值连通范围识别，两种子流程共用同一套建筑面。',enDesc:'Building-group hazards and threshold-connected extents on the same footprints.'},
 {page:'review',num:'05',zh:'专家复核',en:'Expert review',
  zhDesc:'对缺失或低置信度指标打分、填写依据，导出复核结果与发布核验。',enDesc:'Score missing or low-confidence indicators, record rationale, export the review.'},
] as const;

export function WorkflowOverview({boot,onNavigate,localCount=0}:{boot:Row;onNavigate:(p:string)=>void;localCount?:number}){
 const {locale}=useLocale(),en=locale==='en',tr=(a:string,b:string)=>en?b:a;
 const [research,setResearch]=useState<Row|null>(null);
 useEffect(()=>{const c=new AbortController();fetch(assetUrl('research/manifest.json'),{signal:c.signal}).then(r=>r.ok?r.json():null).then(d=>{if(d)setResearch(d);}).catch(()=>{});return()=>c.abort();},[]);
 const facts:string[]=[
  `${Number(boot.stats.sites).toLocaleString()} ${tr('处文物','objects')}`,
  research?`${research.summary.documents} ${tr('份资料','documents')} · ${Number(research.candidates).toLocaleString()} ${tr('条候选指标','candidate records')}`:tr('资料图谱与标准草案','Document graph & criteria'),
  `${boot.stats.indicators} ${tr('项指标','indicators')} · ${Number(boot.stats.scores).toLocaleString()} ${tr('条明细','records')}`,
  tr('四类建筑风险 · 500 米阈值连通','Four hazards · 500 m threshold regions'),
  `${Number(boot.stats.detailed_sites).toLocaleString()} ${tr('处有明细','with detail')}${localCount?` · ${localCount} ${tr('条本机复核','local reviews')}`:''}`,
 ];
 return <section className="workflow-overview" aria-label={tr('平台板块与评价流程','Platform modules and workflow')}>
  <div className="workflow-head"><div><div className="eyebrow">HERISK / WORKFLOW</div><h2>{tr('平台板块与评价流程','Platform modules and workflow')}</h2><p>{tr('数据管理 → 本体评价 → 参考空间评价 → 专家复核；地图与图谱工作台统一定位对象、串联全部证据。','Data → asset assessment → spatial assessment → expert review, with the map & graph workspace as the shared entry point.')}</p></div><span className="badge">{tr('五个板块','Five modules')}</span></div>
  <ol className="workflow-steps">{STEPS.map((step,index)=>{
   const active=step.page==='compute';
   return <li key={step.page} className={active?'active':''}>
    <button onClick={()=>onNavigate(step.page)} aria-label={`${step.num} ${en?step.en:step.zh}`}>
     <span className="workflow-num">{step.num}</span>
     <strong>{en?step.en:step.zh}</strong>
     <small>{en?step.enDesc:step.zhDesc}</small>
     <em>{facts[index]}</em>
     <ArrowUpRight size={13}/>
    </button>
   </li>;
  })}</ol>
 </section>;
}
