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
if {p.name for p in (root/'RAG_datasource').glob('*.pdf') if not p.name.startswith('._')}!={d['filename'] for d in docs}:raise SystemExit('Source inventory differs from extraction: process missing/new documents first')
summary=json.loads((src/'completion_summary.json').read_text());ind=clean(json.loads((src/'indicators.json').read_text()))
(out/'manifest.json').write_text(json.dumps({'summary':summary,'documents':docs,'candidates':len(ind),'scope':'41 provided documents; extracted candidates require review'},ensure_ascii=False))
(out/'indicators.json').write_text(json.dumps(ind,ensure_ascii=False))
graph=clean(json.loads((src/'knowledge_graph.json').read_text()))
(out/'knowledge_graph.json').write_text(json.dumps(graph,ensure_ascii=False,separators=(',',':')))
print(json.dumps({'documents':len(docs),'verified':sum(d['verified'] for d in docs),'candidates':len(ind)},ensure_ascii=False))
