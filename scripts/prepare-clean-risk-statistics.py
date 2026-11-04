"""Refresh analysis cells from the same cleaned building vectors displayed on the map."""
import json,numpy as np,pyogrio,shapely
from pathlib import Path
from pyproj import Transformer
p=Path('public/risk-atlas');manifest=json.loads((p/'manifest.json').read_text());fields=manifest['fields'];f=pyogrio.read_dataframe('work/clean-buildings/clean-risk.fgb',columns=fields);rp=shapely.point_on_surface(f.geometry.to_numpy());keys,inv=np.unique(np.stack([np.floor(shapely.get_x(rp)/500),np.floor(shapely.get_y(rp)/500)],axis=1).astype(int),axis=0,return_inverse=True);n=len(keys);count=np.bincount(inv);means=[];maxima=[]
for name in fields:
 a=f[name].to_numpy(dtype=float);valid=np.isfinite(a);vc=np.bincount(inv[valid],minlength=n);s=np.bincount(inv[valid],weights=a[valid],minlength=n);mean=np.divide(s,vc,out=np.full(n,np.nan),where=vc>0);mx=np.full(n,np.nan);tmp=np.full(n,-np.inf);np.maximum.at(tmp,inv[valid],a[valid]);mx[vc>0]=tmp[vc>0];means.append(mean);maxima.append(mx)
 manifest['statistics'][name]={'count':int(valid.sum()),'missing':int((~valid).sum()),'min':float(a[valid].min()),'max':float(a[valid].max()),'mean':float(a[valid].mean()),'zero':int((a==0).sum())}
t=Transformer.from_crs(32651,4326,always_xy=True);cells=[]
def clean(v):return float(v) if np.isfinite(v) else None
for i,(x,y) in enumerate(keys):
 ring=[[round(v,6) for v in t.transform(xx*500,yy*500)] for xx,yy in [(x,y),(x+1,y),(x+1,y+1),(x,y+1),(x,y)]]
 cells.append({'x':int(x),'y':int(y),'n':int(count[i]),'mean':[clean(a[i]) for a in means],'max':[clean(a[i]) for a in maxima],'ring':ring})
manifest['building_count']=len(f);manifest['cell_count']=n;manifest['geometry_source']='全部建筑地块_含文物属性_SHP.zip';manifest['statistics_scope']='cleaned geometry with geometry-verified Parquet values; unmatched values excluded, not zero';manifest['clean_geometry_audit']=json.loads(Path('public/clean-buildings/manifest.json').read_text())
(p/'cells.json').write_text(json.dumps(cells,separators=(',',':'),allow_nan=False));(p/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,separators=(',',':'),allow_nan=False))
spatial=json.loads(Path('data/clean-spatial.json').read_text());Path('public/clean-buildings/point-links.json').write_text(json.dumps({k:{f:v[f] for f in ['longitude','latitude','building_ids','status','check_note']} for k,v in spatial.items()},ensure_ascii=False,separators=(',',':')))
print({'building_count':len(f),'cells':n,'risk_missing':manifest['statistics'][fields[0]]['missing']})
