"""Clean SHP baseline plus geometry-verified GeoParquet risk association."""
import json,hashlib,datetime,collections
from pathlib import Path
import numpy as np, pandas as pd,pyogrio,pyarrow.parquet as pq,shapely
from pyproj import Transformer
root=Path('.');work=root/'work/clean-buildings';out=root/'public/clean-buildings';out.mkdir(exist_ok=True)
f=pyogrio.read_dataframe(work/'clean.shp',columns=['id','Height','序号','文物名','name']);print('loaded clean',len(f),flush=True)
g=f.geometry.to_numpy();rgdf=pq.read_table('../五类风险_绘图数据/建筑风险_四类共享几何.parquet');rg=shapely.from_wkb(rgdf['geometry'].to_numpy());rid=rgdf['bd_id'].to_numpy().astype(int)
# No blind id join: require interior location and area agreement for each association.
cent=shapely.centroid(g);rc=shapely.centroid(rg);a=shapely.area(g);ra=shapely.area(rg)
d=shapely.distance(cent[rid],rc);agree=(d<.05)&(np.abs(a[rid]-ra)/np.maximum(ra,1)<.005)
match=np.full(len(f),-1,dtype=int);match[rid[agree]]=np.flatnonzero(agree)
print('row+geometry verified',int(agree.sum()),'remaining',int((~agree).sum()),flush=True)
# Locate unchanged geometry after deletions/reordering. Do not infer risk for changed shapes.
tree=shapely.STRtree(cent)
remaining=np.flatnonzero(~agree)
pairs=tree.query(rc[remaining],predicate='dwithin',distance=.05)
rj=remaining[pairs[0]];ci=pairs[1]
area_ok=np.abs(a[ci]-ra[rj])/np.maximum(ra[rj],1)<.005
rj=rj[area_ok];ci=ci[area_ok]
overlap=shapely.area(shapely.intersection(g[ci],rg[rj]))/np.maximum(np.maximum(a[ci],ra[rj]),1)
rj=rj[overlap>.99];ci=ci[overlap>.99]
counts=np.bincount(rj,minlength=len(rg));unique=counts[rj]==1
match[ci[unique]]=rj[unique]
print('all geometry matches',int((match>=0).sum()),flush=True)
fields=['risk_bendi_raw','risk_kaifa_raw','risk_huodong_raw','risk_weihuapin_raw','risk_kaifa_idw','risk_kaifa_smooth_sample']
base=pd.DataFrame({'building_id':['c'+str(i) for i in range(len(f))],'source_id':f.id,'height':f.Height,'heritage_id':f['序号'].fillna(''),'heritage_name':f['文物名'].fillna(''),'risk_bd_id':np.where(match>=0,rid[np.maximum(match,0)],-1)})
for name in fields:
 values=np.array(rgdf[name],dtype=float);base[name]=np.where(match>=0,values[np.maximum(match,0)],np.nan)
base['risk_match']=np.where(match>=0,'geometry_verified','unmatched')
# Resolve named heritage attributes against current catalog; retain explicit one-to-many relations.
boot=json.loads((root/'work/pages-public/snapshot/bootstrap.json').read_text());sites=boot['sites'];sid={s['id']:s for s in sites};names=collections.defaultdict(list)
for s in sites:names[s['name']].append(s['id'])
links=collections.defaultdict(list);unresolved=[];canonical=[]
for i,row in f[f['序号'].notna()].iterrows():
 code=row['序号'];name=row['文物名'];target=code if code in sid and sid[code]['name']==name else names.get(name,[])[0] if len(names.get(name,[]))==1 else None
 if target:links[target].append(int(i));canonical.append((int(i),target))
 else:unresolved.append({'building_id':'c'+str(i),'source_heritage_id':code,'name':name})
base['site_id']=''
for i,target in canonical:base.loc[i,'site_id']=target
import geopandas as gp
vg=gp.GeoDataFrame(base,geometry=f.geometry,crs=f.crs)
vg.to_file(work/'clean-risk.fgb',driver='FlatGeobuf');print('wrote vector',flush=True)
forward=Transformer.from_crs(4326,32651,always_xy=True).transform;reverse=Transformer.from_crs(32651,4326,always_xy=True).transform
notes=json.loads((work/'outside-check.json').read_text());noteBy={r['name'].split('_',1)[0]:r for r in notes};spatial={};alltree=shapely.STRtree(g);summary=collections.Counter()
def geo(geom):return json.loads(gp.GeoSeries([geom],crs=32651).to_crs(4326).to_json())['features'][0]['geometry']
for s in sites:
 p=shapely.Point(*forward(s['longitude'],s['latitude']));indices=links.get(s['id'],[]);named=bool(indices);note=noteBy.get(s['id'],{}).get('note','')
 if not indices and not any(t in note for t in ['非建筑','遗址点','墓地点','公园遗址']):indices=[int(i) for i in alltree.query(p,predicate='intersects')]
 indices=sorted(indices,key=lambda i:shapely.distance(g[i],p));candidates=[]
 for i in indices:
  shape=g[i];anchor=p if shape.covers(p) else shape.representative_point();lon,lat=reverse(anchor.x,anchor.y)
  candidates.append(dict(building_id='c'+str(i),height=float(f.Height.iloc[i]),distance_m=round(shape.distance(p),3),longitude=lon,latitude=lat,geometry=geo(shape)))
 chosen=candidates[0] if candidates else None
 status='source' if named else 'inside' if len(candidates)==1 else 'overlap' if candidates else 'unmatched';summary[status]+=1
 geom=geo(shapely.union_all(g[indices])) if indices else None
 spatial[s['id']]={'site_id':s['id'],'building_id':chosen['building_id'] if chosen else None,'building_ids':[c['building_id'] for c in candidates],'status':status,'original_lon':s['longitude'],'original_lat':s['latitude'],'longitude':chosen['longitude'] if chosen else s['longitude'],'latitude':chosen['latitude'] if chosen else s['latitude'],'distance_m':chosen['distance_m'] if chosen else None,'height':chosen['height'] if chosen else None,'geometry':json.dumps(geom,separators=(',',':')) if geom else None,'candidates':json.dumps(candidates,separators=(',',':')),'revision':1000,'updated_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'source':'clean-shp-2026-11-04','check_note':note}
(root/'data/clean-spatial.json').write_text(json.dumps(spatial,ensure_ascii=False,separators=(',',':')))
(out/'outside-check.json').write_text(json.dumps(notes,ensure_ascii=False,separators=(',',':')))
(out/'unresolved-heritage.json').write_text(json.dumps(unresolved,ensure_ascii=False,separators=(',',':')))
audit={'source':'全部建筑地块_含文物属性_SHP.zip','source_crs':'EPSG:32651','web_crs':'EPSG:3857','building_count':len(f),'risk_matched_buildings':int((match>=0).sum()),'risk_unmatched_buildings':int((match<0).sum()),'risk_source_count':len(rid),'risk_source_matched':int(len(np.unique(match[match>=0]))),'risk_join':'source row index checked by centroid within 0.05 m and area difference <0.5%; moved rows require >99% overlap; changed/unmatched shapes retain null risk','source_attribute_polygons':int(f['序号'].notna().sum()),'named_heritage_sites':len(links),'unresolved_attribute_polygons':len(unresolved),'site_matches':dict(summary),'outside_check_rows':len(notes),'outside_check_noted':sum(bool(r['note']) for r in notes),'source_sha256':hashlib.sha256(Path('../全部建筑地块_含文物属性_SHP.zip').read_bytes()).hexdigest(),'risk_sha256':hashlib.sha256(Path('../五类风险_绘图数据/建筑风险_四类共享几何.parquet').read_bytes()).hexdigest(),'check_sha256':hashlib.sha256(Path('../outside_points检查.xlsx').read_bytes()).hexdigest()}
(out/'manifest.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2));print(json.dumps(audit,ensure_ascii=False),flush=True)
