"""Import supplied extraction outputs; never mark model candidates as reviewed."""
import json,hashlib,re
from pathlib import Path
root=Path('/Volumes/T9/rag_workbench');src=root/'runs/human_activity_expanded_20261031/output';out=Path('public/research');out.mkdir(exist_ok=True)
def clean(x):
 if isinstance(x,dict):return {k:(str(v).replace('\\','/').split('/')[-1] if k in ('source','root') and isinstance(v,str) else clean(v)) for k,v in x.items()}
 if isinstance(x,list):return [clean(v) for v in x]
 return x
report=json.loads((src/'ingestion_report.json').read_text());docs=[]
for d in report['documents']:
 p=root/'RAG_datasource'/d['filename'];sha=hashlib.sha256(p.read_bytes()).hexdigest() if p.exists() else None
 docs.append({**clean(d),'current_sha256':sha,'verified':sha==d['file_hash']})
if not all(d['verified'] for d in docs):raise SystemExit('Source hash mismatch: rerun extraction and review before importing')
if {p.name for p in (root/'RAG_datasource').glob('*.pdf')}!={d['filename'] for d in docs}:raise SystemExit('Source inventory differs from extraction: process missing/new documents first')
summary=json.loads((src/'completion_summary.json').read_text());ind=clean(json.loads((src/'indicators.json').read_text()))
(out/'manifest.json').write_text(json.dumps({'summary':summary,'documents':docs,'candidates':len(ind),'scope':'41 provided documents; extracted candidates require review'},ensure_ascii=False))
(out/'indicators.json').write_text(json.dumps(ind,ensure_ascii=False))
graph=clean(json.loads((src/'knowledge_graph.json').read_text()))
(out/'knowledge_graph.json').write_text(json.dumps(graph,ensure_ascii=False,separators=(',',':')))
for name in ['knowledge_graph.html','evidence_browser.html','topic_graph.html']:
 s=(src/name).read_text();s=re.sub(r'D:\\\\课题\\\\十四五文物资源\\\\rag_workbench\\\\RAG_datasource\\\\','',s)
 if name=='knowledge_graph.html':
  s=s.replace("el('h2',n.label,$('detail'));","el('h2',n.label,$('detail'));const criteriaButton=el('button','基于此实体查找候选指标标准',$('detail'));criteriaButton.addEventListener('click',()=>parent.postMessage({type:'herisk-graph-criteria',label:n.label},'*'));")
 (out/name).write_text(s)
# Keep the supplied prototype available, with its simulation notices intact.
(out/'reference-workbench.html').write_text((root/'index.html').read_text())
print(json.dumps({'documents':len(docs),'verified':sum(d['verified'] for d in docs),'candidates':len(ind)},ensure_ascii=False))
