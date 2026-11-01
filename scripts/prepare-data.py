"""Read the six supplied files without changing them; preserve raw rows and provenance."""
import csv, json, hashlib, pathlib, datetime, sys
import openpyxl
root = pathlib.Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else pathlib.Path(__file__).resolve().parents[2]
out = pathlib.Path(__file__).resolve().parents[1] / 'data'
out.mkdir(exist_ok=True)
stamp = datetime.datetime.now(datetime.timezone.utc).isoformat()
dims = ['历史价值敏感性', '活动利用敏感性', '开发建设敏感性', '环境污染敏感性', '舆论传播敏感性']
data = {k: [] for k in ['sources','heritage_sites','indicators','scores','dimension_scores','data_issues']}
sites, indicators = {}, {}
def dump(v): return json.dumps(v, ensure_ascii=False, separators=(',', ':'), default=str)
def uid(*v): return hashlib.sha256('|'.join(map(str,v)).encode()).hexdigest()[:24]
def score(v, allow_zero=False):
    if v is None or str(v).strip() in ('', 'null', 'None', 'nan'): return None
    n = float(v)
    if not ((0 if allow_zero else 1) <= n <= 5): raise ValueError(f'Invalid score: {v}')
    return n
def source(file, kind, rows, count):
    p=root/file; sid=uid(file)
    data['sources'].append(dict(id=sid, filename=file, sha256=hashlib.sha256(p.read_bytes()).hexdigest(), rows=rows, imported_rows=count, kind=kind, size=p.stat().st_size, object_key=None, imported_at=stamp))
    return sid
def issue(kind, description, site_id=None, source_id=None, row_number=None, raw=None):
    data['data_issues'].append(dict(id=uid(kind, site_id, source_id, row_number),kind=kind, description=description, site_id=site_id, source_id=source_id, row_number=row_number, raw=dump(raw) if raw else None))
filename='heritage_sites_with_scores_new.csv'
rows=list(csv.DictReader((root/filename).open(encoding='utf-8-sig',newline='')))
sid=source(filename,'文物档案与综合评分',len(rows),0)
mapping={'name':'文物名称_x','district':'区','address':'地址','level':'保护等级','type':'类型','age':'年代','material':'建造材料','structure':'结构','condition':'保存状态','opening':'开放状态','tourism':'是否是旅游景点','core_area':'是否在城市核心区'}
for rownum, r in enumerate(rows,2):
    id=r['序号'].strip()
    if id=='序号' or not id:
        issue('重复表头','CSV中出现一行重复表头，保留原始行，未作为文物导入。',source_id=sid,row_number=rownum,raw=r);continue
    if id not in sites:
        base={k:r[v] for k,v in mapping.items()}
        lon,lat=(float(r['wgs_lon']) if r['wgs_lon'] else None,float(r['wgs_lat']) if r['wgs_lat'] else None)
        if lon is not None and not(-180<=lon<=180 and lat is not None and -90<=lat<=90):raise ValueError(f'Invalid coordinates {id}')
        sites[id]=dict(id=id,**base,longitude=lon,latitude=lat,raw=dump(r),revision=1,updated_at=stamp)
    else:
        for k,v in mapping.items():
            if sites[id][k]!=r[v]:raise ValueError(f'Conflicting site field {id}/{k}')
    if r['评价维度'] not in dims:raise ValueError(f'Unknown dimension at row {rownum}')
    value=score(r['敏感性评分'],True)
    if value==0:issue('综合评分越界',f'{sites[id]["name"]}的{r["评价维度"]}原始分值为0，保留原值并标注待核查，不参与1—5分均值。',id,sid,rownum,r)
    data['dimension_scores'].append(dict(id=uid(id,r['评价维度']),site_id=id,dimension=r['评价维度'],score=value,confidence=r['置信度'],evidence=r['证据'],reasoning=r['推理依据'],missing=r['缺失信息'],source_id=sid,row_number=rownum,raw=dump(r)))
data['sources'][0]['imported_rows']=len(data['dimension_scores'])
data['heritage_sites']=list(sites.values())
scored_sites=set()
for dim in dims:
    filename=dim+'.xlsx';w=openpyxl.load_workbook(root/filename,read_only=True,data_only=True)
    count=0;start=len(data['scores']);sid=uid(filename)
    for sheet in w:
        values=list(sheet.values)
        if not values: continue
        headers=values[0]
        for rownum, values_row in enumerate(values[1:],2):
            if not any(v is not None and v!='' for v in values_row):continue
            count+=1;r=dict(zip(headers,values_row));id=str(r['序号']).strip()
            if id not in sites:raise ValueError(f'Unknown site {id}')
            if r['文物名称']!=sites[id]['name']:
                issue('名称差异',f'Excel名称“{r["文物名称"]}”与CSV名称“{sites[id]["name"]}”不同；按序号关联。',id,sid,rownum,r)
            key=(r['一级评价维度'],r['三级评价指标']);iid=uid(*key)
            if key not in indicators:
                indicators[key]=dict(id=iid,dimension=key[0],category=r['二级评价维度'],name=key[1],position=len(indicators)+1)
            data['scores'].append(dict(id=uid(id,iid),site_id=id,indicator_id=iid,score=score(r['敏感性评分']),confidence=r['置信度'] or '',evidence=r['证据'] or '',reasoning=r['推理依据'] or '',missing=r['缺失信息'] or '',source_id=sid,sheet=sheet.title,row_number=rownum,raw=dump(r)))
            scored_sites.add(id)
    source(filename,dim,count,len(data['scores'])-start)
for id in sorted(set(sites)-scored_sites):issue('缺少明细',f'{sites[id]["name"]}有CSV综合评分，但5份Excel中没有三级指标明细。',id)
data['indicators']=list(indicators.values())
for table in ['scores','dimension_scores']:
    ids=[r['id'] for r in data[table]]
    assert len(ids)==len(set(ids)), f'Duplicate keys in {table}'
audit=dict(created_at=stamp,counts={k:len(v) for k,v in data.items()},null_scores=sum(s['score'] is None for s in data['scores']),sites_with_detail=len(scored_sites),missing_detail_ids=sorted(set(sites)-scored_sites),sources=data['sources'],issues=data['data_issues'],method='CSV综合评分与Excel明细评分分别保留；不把空分值替换为0；地图使用CSV的wgs_lon/wgs_lat，不转换或混用坐标系。')
(out/'seed.json').write_text(dump(data),encoding='utf-8')
(out/'data-audit.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({k:audit[k] for k in ['counts','null_scores','sites_with_detail','missing_detail_ids']},ensure_ascii=False,indent=2))
