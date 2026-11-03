export type EntityKind = 'building' | 'site' | 'district' | 'level' | 'type' | 'attribute' | 'indicator' | 'dimension' | 'source';
export type RelationKind = 'spatial' | 'district' | 'level' | 'type' | 'attribute' | 'score' | 'dimension' | 'source';
export type GraphNode = { id: string; label: string; kind: EntityKind; siteId?: string; scoreId?: string; documentId?: string; field?: string; value?: string; score?: number | null; district?: string; buildingId?: string };
export type GraphEdge = { id: string; source: string; target: string; label: string; kind: RelationKind; siteId?: string; field?: string; scoreId?: string; documentId?: string };
export type KnowledgeGraph = { nodes: GraphNode[]; edges: GraphEdge[] };
export type GraphPoint = { x: number; y: number };
export type ArchiveSite = { id: string; name: string; district: string; level?: string; type?: string; address?: string; [key: string]: any };
export type SiteGraphDetail = { site: ArchiveSite; scores: Record<string, any>[]; dimensions: Record<string, any>[]; [key: string]: any };
export const entityStyles: Record<EntityKind, { label: string; color: string }> = {
  building: { label: '建筑轮廓', color: '#b39256' },
  site: { label: '文物', color: '#287c70' }, district: { label: '行政区', color: '#668ca7' },
  level: { label: '保护等级', color: '#b68b4d' }, type: { label: '文物类型', color: '#8c78a5' },
  attribute: { label: '档案属性', color: '#789369' }, indicator: { label: '评价指标', color: '#508f9d' },
  dimension: { label: '评价维度', color: '#bd7881' }, source: { label: '来源文件', color: '#8d8b6a' },
};
export const relationLabels: Record<RelationKind, string> = { spatial:'建筑空间关联', district:'位于行政区', level:'保护等级', type:'文物类型', attribute:'档案属性', score:'评价指标', dimension:'归属维度', source:'来源文件' };
const fields = [['district','位于','district'],['level','保护等级','level'],['type','文物类型','type']] as const;
const siteNode = (site: ArchiveSite): GraphNode => ({ id:'site:'+site.id, label:site.name, kind:'site', siteId:site.id, district:site.district });
export function buildCatalogGraph(sites: ArchiveSite[]): KnowledgeGraph {
  const nodes = new Map<string, GraphNode>(), edges: GraphEdge[] = [];
  for (const site of sites) {
    const from = siteNode(site); nodes.set(from.id, from);
    for (const [field,label,kind] of fields) {
      const value = String(site[field] || '').trim(); if (!value) continue;
      const id = kind+':'+value;
      nodes.set(id,{ id, label:value, kind });
      edges.push({ id:`${from.id}:${field}`, source:from.id, target:id, label, kind, siteId:site.id, field });
    }
  }
  return { nodes:[...nodes.values()], edges };
}
export function buildSiteGraph(detail: SiteGraphDetail): KnowledgeGraph {
  const graph = buildCatalogGraph([detail.site]), nodes = new Map(graph.nodes.map(node=>[node.id,node]));
  const from = 'site:'+detail.site.id;
  for (const [field,label] of [['age','年代'],['material','材料'],['structure','结构'],['condition','保存状态']]) {
    const value = String(detail.site[field] || '').trim(); if (!value) continue;
    const id = `attribute:${detail.site.id}:${field}`;
    nodes.set(id,{ id, label:label+' · '+value, kind:'attribute', field, value, siteId:detail.site.id });
    graph.edges.push({ id:from+':'+field, source:from, target:id, label, kind:'attribute', siteId:detail.site.id, field });
  }
  for (const score of detail.scores) {
    const indicator='indicator:'+score.indicator_id, dimension='dimension:'+score.dimension, source='source:'+score.filename;
    nodes.set(indicator,{ id:indicator, label:score.indicator, kind:'indicator', siteId:detail.site.id, scoreId:score.id, score:score.score });
    nodes.set(dimension,{ id:dimension, label:score.dimension, kind:'dimension' });
    nodes.set(source,{ id:source, label:score.filename, kind:'source' });
    graph.edges.push(
      { id:score.id+':score', source:from, target:indicator, label:'评价指标', kind:'score', siteId:detail.site.id, scoreId:score.id },
      { id:score.id+':dimension', source:indicator, target:dimension, label:'归属维度', kind:'dimension', siteId:detail.site.id, scoreId:score.id },
      { id:score.id+':source', source:indicator, target:source, label:'记录于', kind:'source', siteId:detail.site.id, scoreId:score.id },
    );
  }
  for(const doc of detail.supplements||[]){
    const id='document:'+doc.id;nodes.set(id,{id,label:doc.title,kind:'source',siteId:detail.site.id,documentId:doc.id});
    graph.edges.push({id:from+':document:'+doc.id,source:from,target:id,label:'补充资料',kind:'source',siteId:detail.site.id,documentId:doc.id});
  }
  const match=detail.spatial;
  if(match?.building_id){
    const id='building:'+match.building_id;
    nodes.set(id,{id,label:'SHP '+match.building_id,kind:'building',siteId:detail.site.id,buildingId:String(match.building_id)});
    const label=match.status==='confirmed'?'已确认建筑关联':match.status==='inside'?'面内几何关联':'候选建筑关联（待核查）';
    graph.edges.push({id:from+':building',source:from,target:id,label,kind:'spatial',siteId:detail.site.id});
  }
  const csv = detail.dimensions[0]?.filename;
  if (csv) {
    const id='source:'+csv; nodes.set(id,{ id, label:csv, kind:'source' });
    graph.edges.push({ id:from+':source', source:from, target:id, label:'档案来源', kind:'source', siteId:detail.site.id });
  }
  return { nodes:[...nodes.values()], edges:graph.edges };
}
export function graphDegrees(graph: KnowledgeGraph) {
  const degrees = new Map(graph.nodes.map(node=>[node.id,0]));
  for (const edge of graph.edges) { degrees.set(edge.source,(degrees.get(edge.source)||0)+1); degrees.set(edge.target,(degrees.get(edge.target)||0)+1); }
  return degrees;
}
export function filterGraph(graph: KnowledgeGraph, query='', relation: RelationKind | ''='', focus: string | null=null): KnowledgeGraph {
  let edges = graph.edges.filter(edge=>!relation||edge.kind===relation);
  let nodes = graph.nodes;
  if (relation) { const ids=new Set(edges.flatMap(edge=>[edge.source,edge.target])); nodes=nodes.filter(node=>ids.has(node.id)); }
  if (focus) {
    edges=edges.filter(edge=>edge.source===focus||edge.target===focus);
    const ids=new Set([focus,...edges.flatMap(edge=>[edge.source,edge.target])]); nodes=nodes.filter(node=>ids.has(node.id));
  }
  const term=query.trim().toLowerCase();
  if (term) {
    const matches=new Set(nodes.filter(node=>[node.label,node.siteId||''].join(' ').toLowerCase().includes(term)).map(node=>node.id));
    edges=edges.filter(edge=>matches.has(edge.source)||matches.has(edge.target));
    const ids=new Set([...matches,...edges.flatMap(edge=>[edge.source,edge.target])]); nodes=nodes.filter(node=>ids.has(node.id));
  }
  return { nodes, edges };
}
function hash(text: string) { let h=2166136261; for (const char of text) h=Math.imul(h^char.charCodeAt(0),16777619); return h>>>0; }
// Deterministic force relaxation with a spatial grid keeps 820 entities responsive.
// It represents links in the records, not geographic distance or risk magnitude.
export function layoutGraph(graph: KnowledgeGraph): Map<string, GraphPoint> {
  const degree=graphDegrees(graph), small=graph.nodes.length<120;
  const groups=[...new Set(graph.nodes.filter(n=>n.kind==='site').map(n=>n.district||''))].sort();
  const points=graph.nodes.map((node,index)=>{
    const phase=hash(node.id)/4294967296*Math.PI*2;
    const group=groups.indexOf(node.kind==='district'?node.label:(node.district||'')), groupPhase=group/Math.max(1,groups.length)*Math.PI*2;
    const spread=35+(hash(node.id+'r')%100);
    const x=small?Math.cos(phase)*(70+index%6*33):node.kind==='site'?Math.cos(groupPhase)*270+Math.cos(phase)*spread:node.kind==='district'?Math.cos(groupPhase)*270:Math.cos(phase)*170;
    const y=small?Math.sin(phase)*(70+index%6*33):node.kind==='site'?Math.sin(groupPhase)*210+Math.sin(phase)*spread:node.kind==='district'?Math.sin(groupPhase)*210:Math.sin(phase)*130;
    return {node,x,y,anchorX:x,anchorY:y,vx:0,vy:0};
  });
  const indexes=new Map(points.map((point,index)=>[point.node.id,index]));
  const links=graph.edges.map(edge=>[indexes.get(edge.source)!,indexes.get(edge.target)!]);
  const cellSize=small?85:30;
  for(let tick=0;tick<160;tick++) {
    const alpha=1-tick/180, grid=new Map<string,number[]>();
    for(let i=0;i<points.length;i++){const p=points[i],key=Math.floor(p.x/cellSize)+','+Math.floor(p.y/cellSize);const cell=grid.get(key)||[];cell.push(i);grid.set(key,cell);}
    for(let i=0;i<points.length;i++) {
      const a=points[i],cx=Math.floor(a.x/cellSize),cy=Math.floor(a.y/cellSize);
      for(let ox=-1;ox<=1;ox++)for(let oy=-1;oy<=1;oy++)for(const j of grid.get((cx+ox)+','+(cy+oy))||[]) {
        if(j<=i)continue;const b=points[j];let dx=b.x-a.x,dy=b.y-a.y;
        if(Math.abs(dx)+Math.abs(dy)<.01)dx=.1;
        const square=dx*dx+dy*dy, distance=Math.sqrt(square), min=small?60:15;
        if(distance>cellSize*1.5)continue;
        const force=Math.min(6, (small?500:32)/Math.max(square,1)+(distance<min?(min-distance)*.15:0))*alpha;
        a.vx-=dx/distance*force;a.vy-=dy/distance*force;b.vx+=dx/distance*force;b.vy+=dy/distance*force;
      }
    }
    for(const [i,j] of links){const a=points[i],b=points[j],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1;const target=small?115:60;const f=(d-target)*.035*alpha;const da=degree.get(a.node.id)||1,db=degree.get(b.node.id)||1;a.vx+=dx/d*f/Math.sqrt(da);a.vy+=dy/d*f/Math.sqrt(da);b.vx-=dx/d*f/Math.sqrt(db);b.vy-=dy/d*f/Math.sqrt(db);}
    for(const p of points){const anchor=!small&&(p.node.kind==='site'||p.node.kind==='district')?.04:0;p.vx=(p.vx-p.x*.0015+(p.anchorX-p.x)*anchor)*.72;p.vy=(p.vy-p.y*.0015+(p.anchorY-p.y)*anchor)*.72;p.x+=Math.max(-8,Math.min(8,p.vx));p.y+=Math.max(-8,Math.min(8,p.vy));}
  }
  return new Map(points.map(point=>[point.node.id,{x:point.x,y:point.y}]));
}

export function buildFootprintGraph(building:{building_id:string;height?:number|null}):KnowledgeGraph {
 const id='building:'+building.building_id;
 const nodes:GraphNode[]=[{id,label:'SHP '+building.building_id,kind:'building',buildingId:building.building_id},{id:'source:shp',label:'上海建筑.zip',kind:'source'}];
 const edges:GraphEdge[]=[{id:id+':source',source:id,target:'source:shp',label:'建筑轮廓来源',kind:'source'}];
 if(typeof building.height==='number'&&Number.isFinite(building.height)){
  nodes.push({id:id+':height',label:'SHP height = '+building.height,kind:'attribute'});
  edges.push({id:id+':height',source:id,target:id+':height',label:'原始高度字段',kind:'attribute'});
 }
 return {nodes,edges};
}
