import fs from 'node:fs';
import assert from 'node:assert/strict';
import {evidencePlan,retrievePdfEvidence} from '../lib/pdf-evidence.ts';
import {indexDocumentGraph,filterDocumentGraph,layoutDocumentGraph} from '../lib/document-graph.ts';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const corpus=read('public/research/evidence.json'),manifest=read('public/research/manifest.json'),graph=read('public/research/knowledge_graph.json');
const docs=new Map(manifest.documents.map(d=>[d.doc_id,d]));
const norm=s=>s.normalize('NFKC').replace(/\s/g,'').replace(/\u00ad/g,'');
const pages=new Map();
assert.equal(corpus.unique_excerpts,corpus.records.length);assert.equal(corpus.matched_claims+corpus.excluded_claims,corpus.input_claims);
for(const e of corpus.records){const d=docs.get(e.doc_id);assert.ok(d);assert.equal(e.pdf_sha256,d.file_hash);assert.equal(e.source_name,d.filename);assert.ok(e.page>=1&&e.page<=d.pages);if(!pages.has(e.doc_id))pages.set(e.doc_id,read('public/research/pages/'+e.doc_id+'.json'));assert.ok(norm(pages.get(e.doc_id).pages[e.page]).includes(norm(e.quote)),e.id);assert.ok(e.claim_ids.length&&e.chunk_uids.length);assert.equal(e.status,'candidate_requires_expert_review');}
const boot=read('work/pages-public/snapshot/bootstrap.json'),site=read('work/pages-public/snapshot/sites/G-1.json').site;
const coverage=boot.indicators.map(i=>{assert.ok(evidencePlan(i.name).fields.length);const r=retrievePdfEvidence(corpus.records,i.name,site);for(const e of r.results){assert.ok(e.matched_terms.length);assert.ok(e.matched_terms.every(t=>[e.quote,...e.concepts].join(' ').toLowerCase().includes(t)));assert.equal(e.asset_mentioned,[e.quote,...e.concepts].join(' ').toLowerCase().includes(site.name.toLowerCase()));}return {indicator:i.name,matches:r.total};});
assert.equal(retrievePdfEvidence(corpus.records,'结构类型',site,'zz_nonexistent_123456').total,0);
const index=indexDocumentGraph(graph),focus=graph.nodes.reduce((a,b)=>index.adjacent.get(a.id).length>index.adjacent.get(b.id).length?a:b).id;
const local=filterDocumentGraph(graph,'','','',focus);assert.ok(local.edges.length);assert.ok(local.edges.every(e=>e.source===focus||e.target===focus));
for(const scope of [graph,local,filterDocumentGraph(graph,'游客','','',null),filterDocumentGraph(graph,'','',manifest.documents[0].doc_id,null)]){const ids=new Set(scope.nodes.map(n=>n.id));assert.ok(scope.edges.every(e=>ids.has(e.source)&&ids.has(e.target)));const positions=layoutDocumentGraph(scope);assert.equal(positions.size,scope.nodes.length);assert.ok([...positions.values()].every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));}
assert.equal(graph.nodes.length,8833);assert.equal(graph.edges.length,5083);
console.log(JSON.stringify({passed:true,pdfs:pages.size,excerpts:corpus.records.length,claims:corpus.matched_claims,coverage},null,2));
const visitorMatches=retrievePdfEvidence(corpus.records,'游览空间承载性',site,'',500).results;
assert.ok(!visitorMatches.some(e=>e.quote.startsWith('Material failure is the loss of load-carrying capacity')),'Structural capacity must not be cited as visitor capacity');
const assoc=retrievePdfEvidence(corpus.records,'历史事件/人物关联',site);
assert.ok(assoc.fallback,'indicators without direct provisions must be labelled as context fallback');
assert.ok(assoc.results.length>0,'a fallback keeps the chain populated instead of an empty panel');
assert.ok(assoc.results.every(e=>e.matched_terms.length));
assert.equal(retrievePdfEvidence(corpus.records,'历史事件/人物关联',site,'zz_nonexistent_123456').total,0,'an explicit query must never fall back');
