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
// Layout mirrors the supplied viewer: the six largest components sit on a
// fixed grid and relax with a small force model, every remaining component is
// placed on a peripheral spiral so no entity is dropped.
export function layoutDocumentGraph(graph:Pick<DocumentGraph,'nodes'|'edges'>):Map<string,Point>{
 const index=indexDocumentGraph({...graph,documents:[]}),seen=new Set<string>(),groups:DocumentNode[][]=[];
 for(const n of graph.nodes){if(seen.has(n.id))continue;const pending=[n.id],group:DocumentNode[]=[];seen.add(n.id);while(pending.length){const id=pending.pop()!;group.push(index.nodes.get(id)!);for(const e of index.adjacent.get(id)||[]){const next=e.source===id?e.target:e.source;if(!seen.has(next)){seen.add(next);pending.push(next);}}}groups.push(group);}
 groups.sort((a,b)=>b.length-a.length);
 const positions=new Map<string,Point>(),centers=[[365,230],[635,230],[365,450],[635,450],[500,340],[200,340]];
 groups.forEach((group,gi)=>{
  group.sort((a,b)=>(index.adjacent.get(b.id)?.length||0)-(index.adjacent.get(a.id)?.length||0));
  if(gi<6){
   const [cx,cy]=centers[gi],n=group.length;
   const points=group.map((node,i)=>({id:node.id,x:100*Math.cos(i*2.39996)*Math.sqrt(i/Math.max(1,n)),y:100*Math.sin(i*2.39996)*Math.sqrt(i/Math.max(1,n)),vx:0,vy:0}));
   const lookup=new Map(points.map(p=>[p.id,p])),local=graph.edges.filter(e=>lookup.has(e.source)&&lookup.has(e.target));
   for(let t=0;t<180;t++){
    for(const p of points){p.vx-=p.x*.008;p.vy-=p.y*.008;}
    for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){const a=points[i],b=points[j],dx=a.x-b.x,dy=a.y-b.y,f=25/(dx*dx+dy*dy+2);a.vx+=dx*f;a.vy+=dy*f;b.vx-=dx*f;b.vy-=dy*f;}
    for(const e of local){const a=lookup.get(e.source)!,b=lookup.get(e.target)!;const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1,f=(d-25)*.035;a.vx+=dx/d*f;a.vy+=dy/d*f;b.vx-=dx/d*f;b.vy-=dy/d*f;}
    for(const p of points){p.x+=Math.max(-4,Math.min(4,p.vx));p.y+=Math.max(-4,Math.min(4,p.vy));p.vx*=.6;p.vy*=.6;}
   }
   const mx=Math.max(1,...points.map(p=>Math.abs(p.x))),my=Math.max(1,...points.map(p=>Math.abs(p.y)));
   points.forEach(p=>positions.set(p.id,{x:cx+p.x*(gi<4?108:58)/mx,y:cy+p.y*(gi<4?96:58)/my}));
  }else{
   const k=gi-6,total=Math.max(1,groups.length-6),radius=Math.sqrt(.83+.17*(k+.5)/total),angle=k*2.39996323;
   const cx=500+465*radius*Math.cos(angle),cy=340+300*radius*Math.sin(angle),r=Math.min(5,.7*Math.sqrt(group.length));
   group.forEach((node,i)=>positions.set(node.id,{x:cx+r*Math.sqrt(i/Math.max(1,group.length))*Math.cos(i*2.39996),y:cy+r*Math.sqrt(i/Math.max(1,group.length))*Math.sin(i*2.39996)}));
  }
 });
 const xs=[...positions.values()].map(p=>p.x),ys=[...positions.values()].map(p=>p.y);
 const xmin=Math.min(...xs),xmax=Math.max(...xs),ymin=Math.min(...ys),ymax=Math.max(...ys);
 const scale=Math.min(760/Math.max(1,xmax-xmin),500/Math.max(1,ymax-ymin));
 for(const [id,p] of positions)positions.set(id,{x:500+(p.x-(xmin+xmax)/2)*scale,y:340+(p.y-(ymin+ymax)/2)*scale});
 return positions;
}
