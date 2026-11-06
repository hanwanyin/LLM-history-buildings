import fs from 'node:fs';import assert from 'node:assert/strict';
const root='public/research/';const m=JSON.parse(fs.readFileSync(root+'manifest.json'));const indicators=JSON.parse(fs.readFileSync(root+'indicators.json'));const graph=JSON.parse(fs.readFileSync(root+'knowledge_graph.json','utf8'));
assert.equal(m.documents.length,41);assert.ok(m.documents.every(d=>d.verified&&d.file_hash===d.current_sha256));assert.equal(m.summary.fused_nodes,graph.nodes.length);assert.equal(m.summary.fused_edges,graph.edges.length);assert.equal(indicators.length,551);const docs=new Map(m.documents.map(d=>[d.doc_id,d]));const nodes=new Set(graph.nodes.map(n=>n.id));
for(const e of graph.edges){assert.ok(nodes.has(e.source)&&nodes.has(e.target));assert.ok(e.evidence.length);}
for(const i of indicators){assert.ok(docs.has(i.doc_id));assert.ok(i.page>=1&&i.page<=docs.get(i.doc_id).pages);assert.ok(i.quote&&i.claim_id);assert.match(i.status,/候选/);assert.ok(!i.source.includes('\\'));}
assert.ok(!JSON.stringify(graph).includes('file:///'));
console.log({passed:true,documents:m.documents.length,nodes:nodes.size,relations:graph.edges.length,candidates:indicators.length});
