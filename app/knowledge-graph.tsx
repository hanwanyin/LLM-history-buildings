'use client';
import { Localized, LocaleProvider, LanguageSwitch, useLocale, translateUI, brand } from '../lib/i18n';
import { useEffect, useMemo, useRef, useState, useId } from 'react';
import { Search, RotateCcw, Maximize2, Plus, Minus, ArrowUpRight, ArrowLeft, Download, Network, FileText, X, LoaderCircle } from 'lucide-react';
import { api, sourceDownloadUrl, knowledgeDownloadUrl } from '../lib/client-data';
import { buildCatalogGraph, buildSiteGraph, filterGraph, graphDegrees, layoutGraph, entityStyles, relationLabels, type ArchiveSite, type SiteGraphDetail, type GraphPoint, type GraphNode, type GraphEdge, type RelationKind } from '../lib/knowledge-graph';
import './knowledge-graph.css';
type Selection = { type:'node'|'edge'; id:string } | null;
type View = { x:number; y:number; k:number };
const cut = (value:string,length=11)=>value.length>length?value.slice(0,length)+'…':value;
const number = (value:number)=>value.toLocaleString('zh-CN');
const date = (value:string)=>new Date(value).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false});
export default function KnowledgeGraph({sites,onOpenSite,onSources}:{sites:ArchiveSite[];onOpenSite:(id:string,scoreId?:string)=>void;onSources:()=>void}) {
  const [query,setQuery]=useState(''),[relation,setRelation]=useState<RelationKind|''>(''),[focus,setFocus]=useState<string|null>(null);
  const [siteId,setSiteId]=useState<string|null>(null),[detail,setDetail]=useState<SiteGraphDetail|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState(''),[retry,setRetry]=useState(0);
  const [selection,setSelection]=useState<Selection>(null),[hover,setHover]=useState<Selection>(null),[evidenceDetail,setEvidenceDetail]=useState<SiteGraphDetail|null>(null),[evidenceError,setEvidenceError]=useState('');
  const [expanded,setExpanded]=useState(false);
  const shellRef=useRef<HTMLElement>(null);
  const [view,setView]=useState<View>({x:500,y:310,k:1}),[labels,setLabels]=useState(false),[listPage,setListPage]=useState(0);
  const svgRef=useRef<SVGSVGElement>(null),drag=useRef<{pointer:number;start:GraphPoint;view:View;node?:string;edge?:string;position?:GraphPoint;moved:boolean}|null>(null);
  useEffect(()=>{if(!expanded)return;const previous=document.activeElement as HTMLElement|null,oldOverflow=document.body.style.overflow;document.body.style.overflow='hidden';shellRef.current?.querySelector<HTMLButtonElement>('[data-collapse]')?.focus();const key=(event:KeyboardEvent)=>{if(event.key==='Escape')setExpanded(false);if(event.key==='Tab'){const controls=Array.from(shellRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input,select,a[href],[tabindex="0"]')||[]).filter(element=>element.getClientRects().length);const first=controls[0],last=controls[controls.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}};document.addEventListener('keydown',key);return()=>{document.body.style.overflow=oldOverflow;document.removeEventListener('keydown',key);previous?.focus();};},[expanded]);
  const patternId='graph-dots-'+useId().replace(/:/g,'');
  const graph=useMemo(()=>detail?buildSiteGraph(detail):buildCatalogGraph(sites),[sites,detail]);
  const visible=useMemo(()=>filterGraph(graph,query,relation,focus),[graph,query,relation,focus]);
  const degrees=useMemo(()=>graphDegrees(graph),[graph]);
  const nodeMap=useMemo(()=>new Map(graph.nodes.map(node=>[node.id,node])),[graph]);
  const initialPositions=useMemo(()=>layoutGraph(graph),[graph]);
  const [positions,setPositions]=useState<Map<string,GraphPoint>>(new Map());
  const selectedNode=selection?.type==='node'?nodeMap.get(selection.id):undefined;
  const selectedEdge=selection?.type==='edge'?graph.edges.find(edge=>edge.id===selection.id):undefined;
  const associatedEdge=selectedEdge||(selectedNode?.scoreId?graph.edges.find(edge=>edge.scoreId===selectedNode.scoreId&&edge.kind==='score'):selectedNode?.documentId?graph.edges.find(edge=>edge.documentId===selectedNode.documentId):undefined);
  const proof=detail?.site.id===associatedEdge?.siteId?detail:evidenceDetail;
  const supplementary=associatedEdge?.documentId?proof?.supplements?.find((document:Record<string,any>)=>document.id===associatedEdge.documentId):undefined;
  const score=associatedEdge?.scoreId?proof?.scores.find(row=>row.id===associatedEdge.scoreId):undefined;
  useEffect(()=>{
    if(!siteId){setDetail(null);setLoading(false);setError('');return;}
    const controller=new AbortController();setLoading(true);setError('');setDetail(null);
    api('sites/'+encodeURIComponent(siteId),{signal:controller.signal}).then(data=>{setDetail(data as SiteGraphDetail);setSelection({type:'node',id:'site:'+siteId});}).catch(e=>{if(e.name!=='AbortError')setError(e.message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
  },[siteId,retry]);
  useEffect(()=>{
    setEvidenceDetail(null);setEvidenceError('');
    if(!associatedEdge?.siteId||detail?.site.id===associatedEdge.siteId)return;
    const controller=new AbortController();api('sites/'+encodeURIComponent(associatedEdge.siteId),{signal:controller.signal}).then(data=>setEvidenceDetail(data as SiteGraphDetail)).catch(e=>{if(e.name!=='AbortError')setEvidenceError(e.message);});
    return()=>controller.abort();
  },[associatedEdge?.siteId,detail,retry]);
  const fit=(points=positions)=>{
    const values=visible.nodes.map(node=>points.get(node.id)).filter((point):point is GraphPoint=>!!point);
    if(!values.length){setView({x:500,y:310,k:1});return;}
    const xs=values.map(point=>point.x),ys=values.map(point=>point.y),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
    const k=Math.min(1.65,800/Math.max(150,maxX-minX),460/Math.max(150,maxY-minY));
    setView({x:500-(minX+maxX)/2*k,y:310-(minY+maxY)/2*k,k});
  };
  useEffect(()=>{setPositions(new Map(initialPositions));fit(initialPositions);},[initialPositions]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(()=>{fit(positions);setListPage(0);},[query,relation,focus]); // eslint-disable-line react-hooks/exhaustive-deps
  const svgPoint=(clientX:number,clientY:number):GraphPoint=>{const matrix=svgRef.current?.getScreenCTM();if(!matrix)return{x:500,y:310};const point=new DOMPoint(clientX,clientY).matrixTransform(matrix.inverse());return{x:point.x,y:point.y};};
  const zoom=(factor:number,center:GraphPoint={x:500,y:310})=>setView(previous=>{const k=Math.max(.25,Math.min(5,previous.k*factor)),ratio=k/previous.k;return{k,x:center.x-(center.x-previous.x)*ratio,y:center.y-(center.y-previous.y)*ratio};});
  useEffect(()=>{const svg=svgRef.current;if(!svg)return;const wheel=(event:WheelEvent)=>{event.preventDefault();zoom(Math.exp(-event.deltaY*.0015),svgPoint(event.clientX,event.clientY));};svg.addEventListener('wheel',wheel,{passive:false});return()=>svg.removeEventListener('wheel',wheel);},[]);
  function chooseNode(node:GraphNode){
    setSelection({type:'node',id:node.id});setListPage(0);setQuery('');
    if(node.kind==='site'&&!detail){setFocus(null);setRelation('');setSiteId(node.siteId!);}
    else if(!detail)setFocus(node.id);
  }
  function chooseEdge(edge:GraphEdge){setSelection({type:'edge',id:edge.id});setListPage(0);}
  function fullGraph(){setSiteId(null);setDetail(null);setSelection(null);setHover(null);setFocus(null);setRelation('');setQuery('');setError('');setListPage(0);}
  function exportGraph(){const data={scope:detail?.site.name||'全市文物',exported_at:new Date().toISOString(),note:'关系来自档案字段及评分来源；空间布局不表达地理距离。同类关联不等同于历史人物、事件或因果关系。',...visible};const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='上海文物知识图谱.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  const connected=selectedNode?visible.edges.filter(edge=>edge.source===selectedNode.id||edge.target===selectedNode.id):[];
  const entities=useMemo(()=>[...visible.nodes].sort((a,b)=>(degrees.get(b.id)||0)-(degrees.get(a.id)||0)||a.id.localeCompare(b.id)),[visible.nodes,degrees]);
  const activeId=hover?.type==='node'?hover.id:selectedNode?.id;
  const adjacentIds=useMemo(()=>new Set(activeId?[activeId,...visible.edges.filter(edge=>edge.source===activeId||edge.target===activeId).flatMap(edge=>[edge.source,edge.target])]:[]),[activeId,visible.edges]);
  const activeEdge=hover?.type==='edge'?hover.id:selectedEdge?.id;
  const visibleKinds=[...new Set(visible.nodes.map(node=>node.kind))];
  const globalDegreeLabels=new Set(entities.filter(node=>node.kind!=='site').slice(0,10).map(node=>node.id));
  function pointerDown(event:React.PointerEvent<SVGSVGElement>){
    if(event.button!==0||drag.current)return;
    const target=event.target as Element,node=target.closest('[data-node]')?.getAttribute('data-node')||undefined,edge=target.closest('[data-edge]')?.getAttribute('data-edge')||undefined;
    drag.current={pointer:event.pointerId,start:svgPoint(event.clientX,event.clientY),view,node,edge,position:node?positions.get(node):undefined,moved:false};event.currentTarget.setPointerCapture(event.pointerId);
  }
  function pointerMove(event:React.PointerEvent<SVGSVGElement>){const gesture=drag.current;if(!gesture||gesture.pointer!==event.pointerId)return;const point=svgPoint(event.clientX,event.clientY),dx=point.x-gesture.start.x,dy=point.y-gesture.start.y;if(Math.hypot(dx,dy)>4)gesture.moved=true;if(!gesture.moved)return;if(gesture.node&&gesture.position){const position={x:gesture.position.x+dx/gesture.view.k,y:gesture.position.y+dy/gesture.view.k};setPositions(previous=>{const next=new Map(previous);next.set(gesture.node!,position);return next;});}else setView({...gesture.view,x:gesture.view.x+dx,y:gesture.view.y+dy});}
  function pointerUp(event:React.PointerEvent<SVGSVGElement>){const gesture=drag.current;if(!gesture||gesture.pointer!==event.pointerId)return;drag.current=null;if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);if(gesture.moved)return;if(gesture.node){const node=nodeMap.get(gesture.node);if(node)chooseNode(node);}else if(gesture.edge){const edge=visible.edges.find(edge=>edge.id===gesture.edge);if(edge)chooseEdge(edge);}else setSelection(null);}
  const editFilter=(value:string)=>{setQuery(value);setFocus(null);setSelection(null);};
  return <Localized><section ref={shellRef} className={'kg-shell '+(expanded?'kg-expanded':'')} role={expanded?'dialog':undefined} aria-modal={expanded?true:undefined} aria-label="文物知识图谱">
    <div className="kg-heading"><div><span className="kg-eyebrow"><Network size={15}/> ARCHIVE CONNECTIONS</span><h2>文物知识图谱</h2><p>从一处文物，追溯档案属性、评价依据与来源文件。</p></div><div className="kg-heading-actions"><button data-collapse onClick={()=>setExpanded(value=>!value)}>{expanded?<X size={15}/>:<Maximize2 size={15}/>} {expanded?'收起图谱':'展开画布'}</button><button onClick={exportGraph}><Download size={15}/>导出关系</button></div></div>
    <div className="kg-toolbar"><label className="search-field"><Search size={16}/><input aria-label="搜索图谱实体" placeholder="搜索文物、编号、行政区或指标" value={query} onChange={event=>editFilter(event.target.value)}/>{query&&<button className="icon-button" aria-label="清除图谱搜索" onClick={()=>editFilter('')}><X size={13}/></button>}</label><select aria-label="图谱关系类型" value={relation} onChange={event=>{setRelation(event.target.value as RelationKind|'');setSelection(null);setFocus(null);}}><option value="">全部关系</option>{[...new Set(graph.edges.map(edge=>edge.kind))].map(kind=><option value={kind} key={kind}>{relationLabels[kind]}</option>)}</select><button onClick={fullGraph}><Network size={14}/>显示全图</button><button onClick={()=>{setPositions(new Map(initialPositions));fit(initialPositions);}}><RotateCcw size={14}/>重置视图</button><strong className="kg-count">{number(visible.nodes.length)} 个实体<span>·</span>{number(visible.edges.length)} 条关系</strong></div>
    <div className="kg-context"><span>{detail?<><button className="text-link" onClick={fullGraph}><ArrowLeft size={13}/>全市文物</button><span> / </span><strong>{detail.site.name}</strong></>:focus?<><button className="text-link" onClick={fullGraph}>全市文物</button><span> / </span><strong>{nodeMap.get(focus)?.label}的直接关联</strong></>:<><strong>{number(sites.length)} 处文物</strong> · 按原始档案字段关联，行政区名称保留原文</>}</span><small>{detail?'评分连线可查看原文及来源行号':'同类关联不等同于已证实的历史联系'}</small></div>
    <div className="kg-body">
      <div className="kg-stage">
        <div className="kg-instructions">点击文物展开档案 · 点击连线查看依据 · 拖动节点或空白 · 滚轮缩放</div>
        <svg ref={svgRef} className="kg-canvas" viewBox="0 0 1000 620" role="group" aria-label="可拖动缩放的知识图谱；也可使用右侧实体与关系列表" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={()=>{drag.current=null;}}>
          <defs><pattern id={patternId} width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".7" fill="#b9ccc3" opacity=".5"/></pattern></defs><rect width="1000" height="620" fill={`url(#${patternId})`}/>
          <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
            {visible.edges.map(edge=>{const a=positions.get(edge.source),b=positions.get(edge.target);if(!a||!b)return null;const highlighted=edge.id===activeEdge,connectedToActive=!activeId||edge.source===activeId||edge.target===activeId;return <g key={edge.id} data-edge={edge.id} onPointerEnter={()=>{if(!drag.current)setHover({type:'edge',id:edge.id});}} onPointerLeave={()=>setHover(null)}><line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={highlighted?'#186f62':'#9eb8b0'} strokeWidth={highlighted?2.4:.85} opacity={highlighted?1:connectedToActive?(activeId?.65:detail?.4:.18):.06}/><line className="kg-edge-hit" x1={a.x} y1={a.y} x2={b.x} y2={b.y}><title>{nodeMap.get(edge.source)?.label} — {edge.label} → {nodeMap.get(edge.target)?.label}</title></line>{(highlighted||visible.edges.length<=12)&&<text className="kg-edge-label" x={(a.x+b.x)/2} y={(a.y+b.y)/2-5} textAnchor="middle">{edge.label}</text>}</g>;})}
            {visible.nodes.map(node=>{const point=positions.get(node.id);if(!point)return null;const selected=node.id===selectedNode?.id,active=node.id===activeId,radius=node.kind==='site'?(detail?12:4):detail?8:6+Math.min(5,Math.log2((degrees.get(node.id)||1)+1));const showLabel=labels||!!detail||active||globalDegreeLabels.has(node.id)||visible.nodes.length<35;const right=point.x>=0;return <g key={node.id} data-node={node.id} className="kg-node" role="button" tabIndex={visible.nodes.length<100?0:-1} aria-label={`${entityStyles[node.kind].label}：${node.label}${node.siteId?'（'+node.siteId+'）':''}`} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();chooseNode(node);}}} onPointerEnter={()=>{if(!drag.current)setHover({type:'node',id:node.id});}} onPointerLeave={()=>setHover(null)} opacity={!activeId||adjacentIds.has(node.id)?1:.24} transform={`translate(${point.x},${point.y})`}><title>{node.label} · {degrees.get(node.id)||0} 条直接关系{node.kind==='indicator'?' · 原始评分 '+(node.score??'缺失'):''}</title>{(selected||active)&&<circle r={radius+5} fill="none" stroke={entityStyles[node.kind].color} strokeWidth="1.5" opacity=".55"/>}<circle r={radius} fill={node.kind==='indicator'&&node.score===null?'#fff':entityStyles[node.kind].color} stroke={node.kind==='indicator'&&node.score===null?entityStyles[node.kind].color:'#fff'} strokeWidth="1.5"/>{showLabel&&<text className={'kg-node-label '+(selected?'selected':'')} x={right?radius+5:-radius-5} y="4" textAnchor={right?'start':'end'}>{cut(node.label,detail?12:10)}</text>}</g>;})}
          </g>
        </svg>
        {!visible.nodes.length&&!loading&&<div className="kg-empty"><Search size={26}/><strong>未找到匹配实体</strong><p>可尝试“豫园”“G-2”“黄浦”，或返回全图。</p><button onClick={fullGraph}>显示全图</button></div>}
        {loading&&<div className="kg-empty kg-loading" role="status"><LoaderCircle size={27}/><strong>正在展开文物的档案与评分关系…</strong></div>}
        {error&&<div className="kg-load-error" role="alert">{error}<button onClick={()=>setRetry(value=>value+1)}>重试</button><button onClick={fullGraph}>返回全图</button></div>}
        <div className="kg-zoom"><button aria-label="放大知识图谱" onClick={()=>zoom(1.25)}><Plus size={17}/></button><span>{Math.round(view.k*100)}%</span><button aria-label="缩小知识图谱" onClick={()=>zoom(.8)}><Minus size={17}/></button><button aria-label="适配知识图谱视图" onClick={()=>fit()}><Maximize2 size={16}/></button></div>
        <div className="kg-legend">{visibleKinds.map(kind=><span key={kind}><i style={{background:entityStyles[kind].color}}/>{entityStyles[kind].label}</span>)}<label><input type="checkbox" checked={labels} onChange={event=>setLabels(event.target.checked)}/>全部标签</label></div>
      </div>
      <aside className="kg-inspector" aria-label="图谱实体与关系详情" aria-live="polite">
        {selectedEdge?<><span className="kg-inspector-kicker">关系依据</span><h3>{selectedEdge.label}</h3><div className="kg-triple"><strong>{nodeMap.get(selectedEdge.source)?.label}</strong><span>↓ {selectedEdge.label}</span><strong>{nodeMap.get(selectedEdge.target)?.label}</strong></div></>:selectedNode?<><span className="kg-inspector-kicker" style={{color:entityStyles[selectedNode.kind].color}}>{entityStyles[selectedNode.kind].label}</span><h3>{selectedNode.label}</h3><p className="kg-muted">{number(degrees.get(selectedNode.id)||0)} 条直接关系{selectedNode.siteId?' · '+selectedNode.siteId:''}</p>{selectedNode.kind==='site'&&detail&&<><p className="kg-muted">{detail.site.address||'地址未提供'}</p><button className="primary kg-open" onClick={()=>onOpenSite(detail.site.id)}>打开评价档案<ArrowUpRight size={14}/></button></>}</>:<><span className="kg-inspector-kicker">EXPLORE THE ARCHIVE</span><h3>{query?'匹配实体及直接关联':'高连接实体'}</h3><p className="kg-muted">点击分类查看相连文物，点击文物展开档案与评分依据。</p></>}
        {associatedEdge&&<div className="kg-proof">{evidenceError?<p role="alert">{evidenceError}<button onClick={()=>setRetry(value=>value+1)}>重试</button></p>:!proof?<p className="kg-muted" role="status">正在读取来源依据…</p>:supplementary?<><h4>已审核补充资料</h4><blockquote data-original>{supplementary.content}</blockquote><p>{supplementary.extraction_note}</p><div className="kg-citation"><FileText size={15}/><span>{supplementary.publisher||supplementary.filename}<small>{supplementary.locator}</small></span></div><h4>审核依据</h4><p data-original>{supplementary.review_note}</p>{supplementary.source_url&&<a className="button" href={supplementary.source_url} target="_blank" rel="noreferrer">打开原始来源<ArrowUpRight size={13}/></a>}{supplementary.filename&&<a className="button" href={knowledgeDownloadUrl(supplementary.id)} download>下载来源文件<Download size={13}/></a>}</>:score?<><div className="kg-score"><div><small>原始分值</small><strong>{score.score??'缺失'}</strong></div><div><small>原始置信度</small><strong>{score.confidence||'未标注'}</strong></div></div>{score.expert_score!==null&&score.expert_score!==undefined&&<p>专家修正：{score.expert_score} 分（原始值保留）</p>}<h4>原文证据</h4><blockquote>{score.evidence||'原始文件未提供证据文本。'}</blockquote><h4>推理依据</h4><p>{score.reasoning||'未提供'}</p>{score.missing&&score.missing!=='无'&&<><h4>缺失信息</h4><p>{score.missing}</p></>}<div className="kg-citation"><FileText size={15}/><span>{score.filename}<small>{score.sheet} · 第 {score.row_number} 行</small></span></div><a className="button" href={sourceDownloadUrl(score.source_id,score.filename)} download>下载来源文件<Download size={13}/></a><button className="text-link kg-open" onClick={()=>onOpenSite(proof.site.id,score.id)}>打开该指标的完整档案<ArrowUpRight size={13}/></button></>:<><h4>当前档案记录</h4><blockquote>{associatedEdge.field?`${selectedEdge?.label||selectedNode?.label}：${proof.site[associatedEdge.field]||'未提供'}`:proof.site.name}</blockquote><p className="kg-muted">档案编号 {proof.site.id} · 版本 {proof.site.revision}<br/>更新时间 {date(proof.site.updated_at)}</p>{proof.dimensions[0]&&<div className="kg-citation"><FileText size={15}/><span>{proof.dimensions[0].filename}<small>原始 CSV 第 {proof.dimensions[0].row_number} 行</small></span></div>}{proof.site.revision>1&&<p className="kg-muted">当前档案经过修改；原文件是初始来源，字段以此版本档案为准。</p>}<button className="text-link" onClick={onSources}>查看来源文件<ArrowUpRight size={13}/></button><button className="text-link kg-open" onClick={()=>onOpenSite(proof.site.id)}>打开完整档案<ArrowUpRight size={13}/></button></>}</div>}
        {selectedNode&&connected.length>0&&<><h4 className="kg-list-heading">直接关联 <span>{connected.length}</span></h4><div className="kg-entity-list">{connected.slice(listPage*12,(listPage+1)*12).map(edge=>{const other=nodeMap.get(edge.source===selectedNode.id?edge.target:edge.source)!;return <button key={edge.id} onClick={()=>chooseEdge(edge)}><i style={{background:entityStyles[other.kind].color}}/><span><strong>{other.label}</strong><small>{edge.label} · 点击查看依据</small></span><ArrowUpRight size={13}/></button>;})}</div><GraphPager page={listPage} count={connected.length} onChange={setListPage}/></>}
        {!selectedNode&&!selectedEdge&&<><div className="kg-entity-list">{entities.slice(listPage*12,(listPage+1)*12).map(node=><button key={node.id} onClick={()=>chooseNode(node)}><i style={{background:entityStyles[node.kind].color}}/><span><strong>{node.label}</strong><small>{entityStyles[node.kind].label} · {degrees.get(node.id)||0} 条关系</small></span><ArrowUpRight size={13}/></button>)}</div><GraphPager page={listPage} count={entities.length} onChange={setListPage}/></>}
        {(selectedNode||selectedEdge)&&<button className="text-link kg-back-list" onClick={()=>{setSelection(null);setListPage(0);}}>返回实体列表</button>}
      </aside>
    </div>
    <div className="kg-footnote">关系依据为已发布档案和 Excel 原始记录；缺失评分保持为空。节点位置仅用于阅读关系，不表示地理位置、保护范围或风险高低。</div>
  </section></Localized>;
}
function GraphPager({page,count,onChange}:{page:number;count:number;onChange:(page:number)=>void}){if(count<=12)return null;return <Localized><div className="kg-pager"><button disabled={page===0} onClick={()=>onChange(page-1)}>上一页</button><span>{page+1} / {Math.ceil(count/12)}</span><button disabled={(page+1)*12>=count} onClick={()=>onChange(page+1)}>下一页</button></div></Localized>;}
