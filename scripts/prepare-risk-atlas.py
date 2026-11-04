"""Reproducible web derivatives; source GeoParquet/GeoTIFFs remain unchanged."""
import json, hashlib, math, shutil
from pathlib import Path
import numpy as np
import pyarrow.parquet as pq
import shapely
from pyproj import Transformer
import rasterio
from rasterio.warp import calculate_default_transform, reproject, Resampling
from PIL import Image
src=Path('../五类风险_绘图数据'); out=Path('public/risk-atlas');out.mkdir(parents=True,exist_ok=True)
fields=['risk_bendi_raw','risk_kaifa_raw','risk_huodong_raw','risk_weihuapin_raw','risk_kaifa_idw','risk_kaifa_smooth_sample']
def dump(name,obj):
 (out/name).write_text(json.dumps(obj,ensure_ascii=False,separators=(',',':'),allow_nan=False))
def finite(x):return float(x) if x is not None and np.isfinite(x) else None
frame=pq.read_table(src/'建筑风险_四类共享几何.parquet')
geom=shapely.from_wkb(frame['geometry'].to_numpy());rp=shapely.point_on_surface(geom)
x=np.floor(shapely.get_x(rp)/500).astype(int);y=np.floor(shapely.get_y(rp)/500).astype(int)
keys,inv=np.unique(np.stack([x,y],axis=1),axis=0,return_inverse=True);n=len(keys);counts=np.bincount(inv)
trans=Transformer.from_crs(32651,4326,always_xy=True)
cells=[]
means=[]; maxima=[];stats={}
for f in fields:
 a=np.array(frame[f],dtype=float);valid=np.isfinite(a);vc=np.bincount(inv[valid],minlength=n);s=np.bincount(inv[valid],weights=a[valid],minlength=n)
 mean=np.divide(s,vc,out=np.full(n,np.nan),where=vc>0);mx=np.full(n,-np.inf);np.maximum.at(mx,inv[valid],a[valid]);means.append(mean);maxima.append(mx)
 stats[f]={'count':int(valid.sum()),'missing':int((~valid).sum()),'min':finite(a[valid].min()),'max':finite(a[valid].max()),'mean':finite(a[valid].mean()),'zero':int((a==0).sum())}
for i,(gx,gy) in enumerate(keys):
 ring=[[round(v,6) for v in trans.transform(xx*500,yy*500)] for xx,yy in [(gx,gy),(gx+1,gy),(gx+1,gy+1),(gx,gy+1),(gx,gy)]]
 cells.append({'x':int(gx),'y':int(gy),'n':int(counts[i]),'mean':[finite(a[i]) for a in means],'max':[finite(a[i]) for a in maxima],'ring':ring})
dump('cells.json',cells)
points=[]
for r in pq.read_table(src/'文物点风险_含舆论反向值.parquet').drop(['geometry']).to_pylist():
 points.append({'id':r['序号'],'name':r['文物名称'],'district':r['区'],'lng':r['wgs_lon'],'lat':r['wgs_lat'],'bd_id':r['bd_id'],**{k:finite(r.get(k)) for k in fields+['risk_yulun_0_100','sentiment_score_0_100','weibo_n']}})
dump('points.json',points)
# Exact supplied boundary, simplified by 10 m only for web display.
import geopandas as gpd
boundary=gpd.read_file(src/'上海市域边界.gpkg').to_crs(32651);boundary.geometry=boundary.geometry.simplify(10,preserve_topology=True)
(out/'boundary.geojson').write_text(boundary.to_crs(4326).to_json(drop_id=True))
rasters={};colors=np.array([[49,132,132],[220,210,138],[191,70,78]],float)
for k,title,limit,log in [('bendi','本底塑造',1,False),('kaifa','开发建设_插值平滑',1.2,False),('huodong','活动利用_原始值',80000,True),('weihuapin','危化品_原始值',20,False)]:
 for scope,cn in [('all','全域'),('core','中心城区')]:
  path=src/'绘图栅格'/f'{title}_{cn}.tif'
  with rasterio.open(path) as ds:
   tf,w,h=calculate_default_transform(ds.crs,3857,ds.width,ds.height,*ds.bounds)
   scale=max(w,h)/2400;w=max(1,round(w/scale));h=max(1,round(h/scale));tf=tf*rasterio.Affine.scale(scale,scale)
   a=np.full((h,w),np.nan,np.float32)
   reproject(rasterio.band(ds,1),a,src_transform=ds.transform,src_crs=ds.crs,src_nodata=ds.nodata,dst_transform=tf,dst_crs=3857,dst_nodata=np.nan,resampling=Resampling.nearest)
   mask=np.isfinite(a);lo=.25 if k=='weihuapin' else 0
   v=np.log1p(np.maximum(a,0))/np.log1p(limit) if log else (a-lo)/(limit-lo)
   v=np.clip(np.nan_to_num(v),0,1);c=np.stack([np.interp(v,[0,.5,1],colors[:,j]) for j in range(3)],axis=-1)
   rgba=np.dstack([c,np.where(mask,230,0)]).astype('uint8');name=f'{k}-{scope}.png';Image.fromarray(rgba).save(out/name,optimize=True)
   merc=Transformer.from_crs(3857,4326,always_xy=True)
   corners=[merc.transform(*(tf*p)) for p in [(0,0),(w,0),(w,h),(0,h)]]
   rasters[f'{k}-{scope}']={'file':name,'coordinates':corners,'source':path.name,'source_crs':str(ds.crs),'source_resolution':list(ds.res),'display_size':[w,h],'resampling':'nearest'}
flags=np.array(frame['kaifa_idw_flag']);audit=json.loads((src/'导出核查.json').read_text())
assert sum(c['n'] for c in cells)==1484693
assert len(points)==767 and sum(p['risk_yulun_0_100'] is None for p in points)==22
assert stats['risk_kaifa_smooth_sample']['missing']==73
manifest={'schema':'herisk-risk-atlas-v1','crs':'EPSG:32651','web_crs':'EPSG:3857','cell_size_m':500,'cell_count':n,'building_count':frame.num_rows,'point_count':len(points),'fields':fields,'statistics':stats,'idw_flags':{str(i):int((flags==i).sum()) for i in range(3)},'rasters':rasters,'audit':audit,'sources':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in src.iterdir() if p.is_file() and not p.name.startswith('.')},'aggregation':'Each building counted once by its internal representative point. Equal-weight mean and maximum of finite source values in 500 m UTM cells. Missing values excluded, zeros retained.'}
dump('manifest.json',manifest)
shutil.copy(src/'数据说明.md',out/'source-notes.md');shutil.copy(src/'导出核查.json',out/'source-audit.json')
print(json.dumps({'cells':n,'buildings':frame.num_rows,'points':len(points),'size_mb':sum(p.stat().st_size for p in out.iterdir())/1e6}))
