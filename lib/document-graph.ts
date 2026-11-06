export type Citation={source_name:string;page:number;doc_id:string;chunk_uid:string;quote?:string;claim_id?:string;kind?:string;condition?:string;conditions?:string[]};
export type DocumentNode={id:string;label:string;types:string[];aliases:string[];sources:Citation[]};
export type DocumentEdge={id:string;source:string;target:string;relation:string;evidence:Citation[]};
export type DocumentGraph={nodes:DocumentNode[];edges:DocumentEdge[];documents:{doc_id:string;source_name?:string;filename?:string;source?:string}[]};
export type Point={x:number;y:number};
export function indexDocumentGraph(graph:DocumentGraph){
 const nodes=new Map(graph.nodes.map(n=>[n.id,n])),adjacent=new Map<string,DocumentEdge[]>();
 for(const n of graph.nodes)adjacent.set(n.id,[]);
 for(const e of graph.edges){adjacent.get(e.source)?.push(e);if(e.target!==e.source)adjacent.get(e.target)?.push(e);}
 return {nodes,adjacent};
}
export function filterDocumentGraph(graph:DocumentGraph,query:string,type:string,doc:string,focus:string|null){
 const eligibleEdges=doc?graph.edges.filter(e=>e.evidence.some(v=>v.doc_id===doc)):graph.edges;
 if(focus){const edges=eligibleEdges.filter(e=>e.source===focus||e.target===focus),ids=new Set([focus,...edges.flatMap(e=>[e.source,e.target])]);return {nodes:graph.nodes.filter(n=>ids.has(n.id)),edges};}
 const q=query.trim().toLowerCase(),nodes=graph.nodes.filter(n=>(!q||[n.label,...n.aliases].some(s=>s.toLowerCase().includes(q)))&&(!type||n.types.includes(type))&&(!doc||n.sources.some(s=>s.doc_id===doc))),ids=new Set(nodes.map(n=>n.id));
 return {nodes,edges:eligibleEdges.filter(e=>ids.has(e.source)&&ids.has(e.target))};
}
// Deterministic layout of connected components. Distances are visual, never geographic.
export function layoutDocumentGraph(graph:Pick<DocumentGraph,'nodes'|'edges'>):Map<string,Point>{
 const index=indexDocumentGraph({...graph,documents:[]}),seen=new Set<string>(),groups:DocumentNode[][]=[];
 for(const n of graph.nodes){if(seen.has(n.id))continue;const pending=[n.id],group:DocumentNode[]=[];seen.add(n.id);while(pending.length){const id=pending.pop()!;group.push(index.nodes.get(id)!);for(const e of index.adjacent.get(id)||[]){const next=e.source===id?e.target:e.source;if(!seen.has(next)){seen.add(next);pending.push(next);}}}groups.push(group);}
 groups.sort((a,b)=>b.length-a.length);const positions=new Map<string,Point>();
 const main=groups.slice(0,6),centers=main.length===1?[[500,340]]:main.length<=3?[[280,340],[700,340],[500,120]]:[[300,210],[700,210],[300,470],[700,470],[500,340],[500,100]];
 groups.forEach((group,gi)=>{group.sort((a,b)=>(index.adjacent.get(b.id)?.length||0)-(index.adjacent.get(a.id)?.length||0));
  if(gi>=6){const angle=(gi-6)*2.39996323,r=Math.sqrt(.76+.24*(gi-5)/Math.max(1,groups.length-6));group.forEach((n,i)=>positions.set(n.id,{x:500+475*r*Math.cos(angle)+Math.cos(i*2.39996)*Math.sqrt(i)*1.2,y:340+315*r*Math.sin(angle)+Math.sin(i*2.39996)*Math.sqrt(i)*1.2}));return;}
  const points=group.map((n,i)=>({id:n.id,x:Math.cos(i*2.39996)*Math.sqrt(i+1)*12,y:Math.sin(i*2.39996)*Math.sqrt(i+1)*12,vx:0,vy:0})),lookup=new Map(points.map(n=>[n.id,n]));
  const edges=graph.edges.filter(e=>lookup.has(e.source)&&lookup.has(e.target));
  // Bound pairwise work; large filtered components use a stable spiral.
  if(points.length<=220)for(let t=0;t<100;t++){for(const p of points){p.vx-=p.x*.008;p.vy-=p.y*.008;}for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++){const a=points[i],b=points[j],dx=a.x-b.x,dy=a.y-b.y,f=30/(dx*dx+dy*dy+2);a.vx+=dx*f;a.vy+=dy*f;b.vx-=dx*f;b.vy-=dy*f;}for(const e of edges){const a=lookup.get(e.source)!,b=lookup.get(e.target)!,dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1,f=(d-30)*.03;a.vx+=dx/d*f;a.vy+=dy/d*f;b.vx-=dx/d*f;b.vy-=dy/d*f;}for(const p of points){p.x+=Math.max(-4,Math.min(4,p.vx));p.y+=Math.max(-4,Math.min(4,p.vy));p.vx*=.6;p.vy*=.6;}}
  const mx=Math.max(1,...points.map(p=>Math.abs(p.x))),my=Math.max(1,...points.map(p=>Math.abs(p.y))),[cx,cy]=centers[gi],rx=main.length===1?370:gi<4?165:70,ry=main.length===1?245:gi<4?125:55;
  points.forEach(p=>positions.set(p.id,{x:cx+p.x*rx/mx,y:cy+p.y*ry/my}));
 });return positions;
}
