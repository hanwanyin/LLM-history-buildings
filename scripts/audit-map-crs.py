"""Read-only comparison of the supplied projections and generated map tiles."""
import json, pathlib, datetime, shapefile
from osgeo import ogr, osr
from shapely.geometry import shape
from shapely.ops import transform, unary_union
from pyproj import Transformer

ogr.UseExceptions()
root = pathlib.Path(__file__).resolve().parents[1]
folder = root / 'data/building-source'
def reader(name):
    return shapefile.Reader(shp=str(folder / (name+'.shp')), shx=str(folder / (name+'.shx')))
wgs, utm = reader('shanghai'), reader('shanghai51N')
forward = Transformer.from_crs(4326, 32651, always_xy=True).transform
mercator = Transformer.from_crs(4326, 3857, always_xy=True).transform
ids = sorted(set([int(i*(len(wgs)-1)/99) for i in range(100)] + [723549, 450750]))
projection_errors = []
tile_errors = []
tiles = ogr.Open(str(root / 'data/shanghai-buildings.pmtiles'))
layer = tiles.GetLayer()
reference = osr.SpatialReference(); reference.ImportFromEPSG(3857)
assert layer.GetSpatialRef().IsSame(reference)
for fid in ids:
    original = shape(wgs.shape(fid).__geo_interface__)
    projected = shape(utm.shape(fid).__geo_interface__)
    projection_errors.append(transform(forward, original).hausdorff_distance(projected))
    metric = transform(mercator, original)
    layer.SetSpatialFilterRect(*metric.buffer(1).bounds)
    parts = [shape(json.loads(f.GetGeometryRef().ExportToJson())) for f in layer if str(f.GetField('building_id')) == str(fid)]
    if not parts:
        raise AssertionError(f'Building {fid} missing from generated tiles')
    tile_errors.append(metric.hausdorff_distance(unary_union(parts)))
result = {
    'checked_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'source_wgs84':'EPSG:4326', 'source_projected':'EPSG:32651', 'rendered_tiles':'EPSG:3857',
    'sample_count':len(ids), 'sample_fids':ids, 'feature_count':len(wgs),
    'source_projection_max_error_m':max(projection_errors),
    'source_to_tile_max_hausdorff_mercator_m':max(tile_errors),
    'source_to_tile_mean_hausdorff_mercator_m':sum(tile_errors)/len(tile_errors),
    'interpretation':'两份SHP投影转换一致，生成瓦片与源几何一致至瓦片量化精度。未发现投影或轴顺序错误；不证明源坐标绝对精度，也不证明SHP与OSM建筑采集时间或轮廓一致。',
    'basemap_change':'采用OpenFreeMap道路、水系、地名矢量底图，不渲染building图层；建筑轮廓仅显示用户SHP。没有施加经验性GCJ-02偏移。',
}
assert max(projection_errors)<.001
assert max(tile_errors)<.5
(root / 'data/coordinate-audit.json').write_text(json.dumps(result, ensure_ascii=False, indent=2))
print(json.dumps({k:v for k,v in result.items() if k!='sample_fids'},ensure_ascii=False,indent=2))
