import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {buildCatalogGraph,buildSiteGraph,filterGraph,graphDegrees,layoutGraph} from '../lib/knowledge-graph.ts';
const read=async name=>JSON.parse(await fs.readFile('work/pages-public/snapshot/'+name+'.json','utf8'));
const boot=await read('bootstrap'),detail=await read('sites/G-2');
const graph=buildCatalogGraph(boot.sites),ids=new Set(graph.nodes.map(node=>node.id));
assert.equal(graph.nodes.filter(node=>node.kind==='site').length,767);
assert.equal(ids.size,graph.nodes.length);
assert.equal(graph.edges.length,767*3);
for(const edge of graph.edges){
  assert.ok(ids.has(edge.source)&&ids.has(edge.target));
  const site=boot.sites.find(site=>site.id===edge.siteId),target=graph.nodes.find(node=>node.id===edge.target);
  assert.equal(target.label,site[edge.field]);
  assert.equal(edge.source,'site:'+site.id);
}
assert.equal(graphDegrees(graph).get('district:黄浦'),boot.sites.filter(site=>site.district==='黄浦').length);
assert.ok(ids.has('district:黄浦')&&ids.has('district:黄浦区'),'Source spellings must not be silently merged');
const siteGraph=buildSiteGraph(detail);
assert.equal(siteGraph.nodes.filter(node=>node.kind==='indicator').length,27);
assert.equal(siteGraph.nodes.filter(node=>node.kind==='source').length,6);
for(const edge of siteGraph.edges.filter(edge=>edge.scoreId)){
 const score=detail.scores.find(score=>score.id===edge.scoreId);assert.ok(score?.filename&&score.sheet&&score.row_number>0);
 assert.equal(edge.siteId,detail.site.id);
}
for(const score of detail.scores){const node=siteGraph.nodes.find(node=>node.scoreId===score.id);assert.equal(node.score,score.score);}
const missingSite=boot.sites.find(site=>site.detail_count===0);const missing=buildSiteGraph(await read('sites/'+missingSite.id));
assert.equal(missing.nodes.filter(node=>node.kind==='indicator').length,0,'Never fabricate missing indicators');
const query=filterGraph(graph,'豫园');assert.ok(query.nodes.some(node=>node.label==='豫园'));
assert.ok(query.nodes.every(node=>node.kind==='site'||query.edges.some(edge=>edge.target===node.id)));
assert.equal(filterGraph(graph,'a-nonexistent-entity-9381').nodes.length,0);
const districts=filterGraph(graph,'','district');assert.ok(districts.edges.every(edge=>edge.kind==='district'));
const focused=filterGraph(graph,'','','district:黄浦');assert.ok(focused.edges.every(edge=>edge.target==='district:黄浦'));
const layout=layoutGraph(graph),again=layoutGraph(graph);assert.equal(layout.size,graph.nodes.length);assert.deepEqual(layout,again);
for(const point of layout.values())assert.ok(Number.isFinite(point.x)&&Number.isFinite(point.y));
const stripped=buildCatalogGraph([{id:'test',name:'未提供档案',district:'',type:null,level:null}]);assert.equal(stripped.edges.length,0);
console.log(JSON.stringify({passed:true,catalog:{nodes:graph.nodes.length,edges:graph.edges.length},site:{nodes:siteGraph.nodes.length,edges:siteGraph.edges.length},checks:'all relationships match source fields; provenance references; missing values; source spellings; search/filter/neighborhood; stable finite layout'}));
