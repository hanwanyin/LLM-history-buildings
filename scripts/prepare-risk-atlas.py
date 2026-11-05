"""Reproducible web derivatives; source GeoParquet/GeoTIFFs remain unchanged.

Cells are counted from the cleaned SHP geometry that the map draws, so the
analysis grid and the building layer can never drift apart. Point indicators
come from the supplied risk parquet, restricted to the 763 cleaned heritage
objects.
"""
import json, hashlib, shutil
from pathlib import Path
import numpy as np
import pyarrow.parquet as pq
import pyogrio
import shapely
from pyproj import Transformer
src=Path('../五类风险_绘图数据'); out=Path('public/risk-atlas');out.mkdir(parents=True,exist_ok=True)
fields=['risk_bendi_raw','risk_kaifa_raw','risk_huodong_raw','risk_weihuapin_raw','risk_kaifa_idw','risk_kaifa_smooth_sample']
# The cleaned heritage-site layer (763 objects) drops four duplicate point records.
# Each repeats an object that is already listed under its own stable ID.
DROPPED={'S-3':'S-1 黄炎培故居','S-11':'G-30 圣三一基督教堂','S-159':'G-29 上海工部局宰牲场旧址','S-252':'S-2 太平天国烈士墓'}
def dump(name,obj):
 (out/name).write_text(json.dumps(obj,ensure_ascii=False,separators=(',',':'),allow_nan=False))
def finite(x):return float(x) if x is not None and np.isfinite(x) else None

# 500 m cells from the cleaned geometry and its geometry-verified risk values.
clean=pyogrio.read_dataframe('work/clean-buildings/clean-risk.fgb',columns=fields)
rp=shapely.point_on_surface(clean.geometry.to_numpy())
keys,inv=np.unique(np.stack([np.floor(shapely.get_x(rp)/500),np.floor(shapely.get_y(rp)/500)],axis=1).astype(int),axis=0,return_inverse=True)
n=len(keys);counts=np.bincount(inv);means=[];maxima=[];stats={}
for f in fields:
 a=clean[f].to_numpy(dtype=float);valid=np.isfinite(a);vc=np.bincount(inv[valid],minlength=n);s=np.bincount(inv[valid],weights=a[valid],minlength=n)
 mean=np.divide(s,vc,out=np.full(n,np.nan),where=vc>0);mx=np.full(n,np.nan);tmp=np.full(n,-np.inf);np.maximum.at(tmp,inv[valid],a[valid]);mx[vc>0]=tmp[vc>0]
 means.append(mean);maxima.append(mx)
 stats[f]={'count':int(valid.sum()),'missing':int((~valid).sum()),'min':finite(a[valid].min()),'max':finite(a[valid].max()),'mean':finite(a[valid].mean()),'zero':int((a==0).sum())}
trans=Transformer.from_crs(32651,4326,always_xy=True)
cells=[]
for i,(gx,gy) in enumerate(keys):
 ring=[[round(v,6) for v in trans.transform(xx*500,yy*500)] for xx,yy in [(gx,gy),(gx+1,gy),(gx+1,gy+1),(gx,gy+1),(gx,gy)]]
 cells.append({'x':int(gx),'y':int(gy),'n':int(counts[i]),'mean':[finite(a[i]) for a in means],'max':[finite(a[i]) for a in maxima],'ring':ring})
dump('cells.json',cells)

# Heritage point indicators, restricted to the cleaned 763 objects.
points=[]
for r in pq.read_table(src/'文物点风险_含舆论反向值.parquet').drop(['geometry']).to_pylist():
 if r['序号'] in DROPPED: continue
 points.append({'id':r['序号'],'name':r['文物名称'],'district':r['区'],'lng':r['wgs_lon'],'lat':r['wgs_lat'],'bd_id':r['bd_id'],**{k:finite(r.get(k)) for k in fields+['risk_yulun_0_100','sentiment_score_0_100','weibo_n']}})
dump('points.json',points)

# Exact supplied boundary, simplified by 10 m only for web display.
import geopandas as gpd
boundary=gpd.read_file(src/'上海市域边界.gpkg').to_crs(32651);boundary.geometry=boundary.geometry.simplify(10,preserve_topology=True)
(out/'boundary.geojson').write_text(boundary.to_crs(4326).to_json(drop_id=True))

# Map anchors: the cleaned building chosen for each heritage object.
spatial=json.loads(Path('data/clean-spatial.json').read_text())
links={k:{f:v[f] for f in ['longitude','latitude','building_ids','status','check_note']} for k,v in spatial.items() if k not in DROPPED}
(out.parent/'clean-buildings/point-links.json').write_text(json.dumps(links,ensure_ascii=False,separators=(',',':')))

flags=np.array(pq.read_table(src/'建筑风险_四类共享几何.parquet',columns=['kaifa_idw_flag'])['kaifa_idw_flag'])
audit=json.loads((src/'导出核查.json').read_text())
assert sum(c['n'] for c in cells)==len(clean)
assert len(points)==763 and sum(p['risk_yulun_0_100'] is None for p in points)==22
assert len(links)==763
clean_audit=json.loads(Path('public/clean-buildings/manifest.json').read_text())
manifest={'schema':'herisk-risk-atlas-v1','crs':'EPSG:32651','web_crs':'EPSG:3857','cell_size_m':500,'cell_count':n,'building_count':len(clean),'point_count':len(points),'raw_point_records':len(points)+len(DROPPED),'deduplicated_records':DROPPED,'fields':fields,'statistics':stats,'idw_flags':{str(i):int((flags==i).sum()) for i in range(3)},'audit':audit,'geometry_source':'全部建筑地块_含文物属性_SHP.zip','clean_geometry_audit':clean_audit,'statistics_scope':'cleaned geometry with geometry-verified Parquet values; unmatched values excluded, not zero','sources':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in src.iterdir() if p.is_file() and not p.name.startswith('.')},'aggregation':'Each building counted once by its internal representative point. Equal-weight mean and maximum of finite source values in 500 m UTM cells. Missing values excluded, zeros retained.'}
dump('manifest.json',manifest)
shutil.copy(src/'数据说明.md',out/'source-notes.md');shutil.copy(src/'导出核查.json',out/'source-audit.json')
print(json.dumps({'cells':n,'buildings':len(clean),'points':len(points),'links':len(links)},ensure_ascii=False))
