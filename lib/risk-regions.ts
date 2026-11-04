export type RiskCell={x:number;y:number;n:number;mean:(number|null)[];max:(number|null)[];ring:number[][]};
export function connectedRiskRegions(cells:RiskCell[],field:number,threshold:number,minimum=1,diagonal=false,metric:'mean'|'max'='mean'){
 const eligible=new Map(cells.filter(c=>c[metric][field]!==null&&Number.isFinite(c[metric][field])&&c[metric][field]!>=threshold).map(c=>[`${c.x},${c.y}`,c]));
 const regions:RiskCell[][]=[];const directions=diagonal?[[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]:[[1,0],[-1,0],[0,1],[0,-1]];
 while(eligible.size){const root=eligible.values().next().value!;eligible.delete(`${root.x},${root.y}`);const region=[root];for(let i=0;i<region.length;i++){const c=region[i];for(const [dx,dy] of directions){const key=`${c.x+dx},${c.y+dy}`,next=eligible.get(key);if(next){eligible.delete(key);region.push(next);}}}if(region.length>=minimum)regions.push(region);}
 return regions.sort((a,b)=>b.length-a.length);
}
export function regionGeoJSON(regions:RiskCell[][],metadata:Record<string,unknown>={}){return {type:'FeatureCollection' as const,metadata:{...metadata,method:'threshold-connected-500m-cells',status:'exploratory_not_percolation',area_definition:'Full 500m cells; not building footprint or statutory protection area'},features:regions.map((r,i)=>({type:'Feature' as const,properties:{region:i+1,cells:r.length,buildings:r.reduce((s,c)=>s+c.n,0),grid_area_km2:r.length*.25},geometry:{type:'MultiPolygon' as const,coordinates:r.map(c=>[c.ring])}}))};}
