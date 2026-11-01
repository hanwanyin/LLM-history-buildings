"""Spatial candidates are not claims about the identity of a heritage building."""
import json, pathlib, datetime, collections, hashlib
from osgeo import ogr
from shapely.geometry import shape, Point, mapping
from shapely.ops import transform
from pyproj import Transformer
root=pathlib.Path(__file__).resolve().parents[1]
data=json.loads((root/'data/seed.json').read_text())
ds=ogr.Open(str(root/'data/building-source/shanghai.shp'));layer=ds.GetLayer(0)
forward=Transformer.from_crs(4326,32651,always_xy=True).transform
reverse=Transformer.from_crs(32651,4326,always_xy=True).transform
matches=[];diagnostics=collections.Counter();stamp=datetime.datetime.now(datetime.timezone.utc).isoformat()
for site in data['heritage_sites']:
    lon,lat=site['longitude'],site['latitude'];point=Point(*forward(lon,lat))
    layer.SetSpatialFilterRect(lon-.002,lat-.002,lon+.002,lat+.002);candidates=[]
    for f in layer:
        raw=f.GetGeometryRef()
        if raw is None:continue
        polygon=shape(json.loads(raw.ExportToJson()))
        if not polygon.is_valid:polygon=polygon.buffer(0)
        if polygon.is_empty:continue
        metric=transform(forward,polygon);distance=metric.distance(point)
        if distance>120:continue
        inside=metric.covers(point);anchor=point if inside else metric.representative_point()
        ax,ay=reverse(anchor.x,anchor.y)
        candidates.append(dict(building_id=str(f.GetFID()),height=f.GetField('Height'),distance_m=round(distance,2),inside=inside,longitude=ax,latitude=ay,geometry=mapping(polygon)))
    candidates.sort(key=lambda c:(c['distance_m'],int(c['building_id'])))
    if candidates:
        chosen=candidates[0];status='inside' if chosen['inside'] else 'candidate';diagnostics[status]+=1
        if sum(c['inside'] for c in candidates)>1:status='overlap';diagnostics['overlapping_footprints']+=1
        candidates=candidates[:3]
        item=dict(site_id=site['id'],building_id=chosen['building_id'],status=status,original_lon=lon,original_lat=lat,longitude=chosen['longitude'],latitude=chosen['latitude'],distance_m=chosen['distance_m'],height=chosen['height'],geometry=json.dumps(chosen['geometry'],separators=(',',':')),candidates=json.dumps(candidates,separators=(',',':')),revision=1,updated_at=stamp)
    else:
        diagnostics['unmatched']+=1
        item=dict(site_id=site['id'],building_id=None,status='unmatched',original_lon=lon,original_lat=lat,longitude=lon,latitude=lat,distance_m=None,height=None,geometry=None,candidates='[]',revision=1,updated_at=stamp)
    matches.append(item)
    if len(matches)%100==0:print(f'Matched {len(matches)}/{len(data["heritage_sites"])}',flush=True)
layer.SetSpatialFilter(None)
audit=dict(source='上海建筑.zip / shanghai.shp',source_crs='EPSG:4326',distance_crs='EPSG:32651',building_count=layer.GetFeatureCount(),stats=dict(diagnostics),threshold_m=120,created_at=stamp,method='保留CSV的wgs_lon/wgs_lat为原始点。点在面内记录inside；否则120米内最近建筑作为待核查候选，显示锚点为面内点。仅几何关联，未核验建筑名称身份；遗址、墓葬、桥梁等不一定有建筑面。shanghai51N与shanghai是同一数据的不同投影，未重复导入。',zip_sha256=hashlib.sha256((root.parent/'上海建筑.zip').read_bytes()).hexdigest())
(root/'data/spatial-seed.json').write_text(json.dumps({'spatial_matches':matches},ensure_ascii=False,separators=(',',':')))
(root/'data/spatial-audit.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2))
assert len(matches)==767
assert all(m['status']=='unmatched' or shape(json.loads(m['geometry'])).covers(Point(m['longitude'],m['latitude'])) for m in matches)
print(json.dumps(audit,ensure_ascii=False,indent=2))
