"""Publish traceable excerpts from the supplied, hash-verified PDF extraction batch.
No inferred building facts, scores, or LLM calls are generated here.
"""
import json, hashlib, re, unicodedata
from pathlib import Path
root=Path('/Volumes/T9/rag_workbench')
src=root/'runs/human_activity_expanded_20261031/output'
out=Path('public/research');(out/'pages').mkdir(exist_ok=True)
manifest=json.loads((out/'manifest.json').read_text());documents={d['doc_id']:d for d in manifest['documents']}
normalize=lambda s:re.sub(r'\s+','',unicodedata.normalize('NFKC',s or '')).replace('\u00ad','')
pages={}
for docid,d in documents.items():
 pdf=root/'RAG_datasource'/d['filename']
 if hashlib.sha256(pdf.read_bytes()).hexdigest()!=d['file_hash']:raise SystemExit('PDF changed: '+d['filename'])
 cache=src/'page_cache'/f"{docid}-{d['file_hash']}.json"
 pages[docid]=json.loads(cache.read_text())['texts']
records={};excluded=[];source_pages={}
claims=json.loads((src/'claims.json').read_text())
for c in claims:
 docid=c['doc_id'];page=c['page'];quote=c.get('quote') or ''
 if docid not in pages or not isinstance(page,int) or page<1 or page>len(pages[docid]):excluded.append({'claim_id':c['id'],'reason':'page_missing'});continue
 text=pages[docid][page-1]
 if not normalize(quote) or normalize(quote) not in normalize(text):excluded.append({'claim_id':c['id'],'reason':'quote_not_matched_to_page'});continue
 key=hashlib.sha256(f'{docid}:{page}:{quote}'.encode()).hexdigest()[:24]
 if key not in records:records[key]={'id':key,'doc_id':docid,'source_name':documents[docid]['filename'],'pdf_sha256':documents[docid]['file_hash'],'page':page,'quote':quote,'kind':c.get('kind'),'condition':c.get('condition'),'verification':'exact_after_whitespace_and_unicode_normalization','status':'candidate_requires_expert_review','claim_ids':[],'chunk_uids':[],'concepts':[]}
 r=records[key]
 for field,value in [('claim_ids',c['id']),('chunk_uids',c['chunk_uid']),('concepts',c['source']),('concepts',c['target'])]:
  if value not in r[field]:r[field].append(value)
 source_pages.setdefault(docid,{})[str(page)]=text
for docid,ps in source_pages.items():
 d=documents[docid]
 (out/'pages'/f'{docid}.json').write_text(json.dumps({'doc_id':docid,'source_name':d['filename'],'pdf_sha256':d['file_hash'],'page_numbering':'physical_pdf_pages','pages':ps},ensure_ascii=False,separators=(',',':')))
result={'schema':'herisk-pdf-evidence-v1','source':'RAG_datasource','documents':len(documents),'input_claims':len(claims),'matched_claims':len(claims)-len(excluded),'excluded_claims':len(excluded),'unique_excerpts':len(records),'verification':'PDF file hashes match the extraction manifest; quotations match the cached physical page after whitespace and Unicode normalization. Semantic applicability requires expert review.','records':list(records.values())}
(out/'evidence.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':')))
(out/'evidence-verification.json').write_text(json.dumps({k:v for k,v in result.items() if k!='records'}|{'excluded':excluded},ensure_ascii=False,indent=2))
print(json.dumps({k:v for k,v in result.items() if k not in ('records','verification')},ensure_ascii=False))
