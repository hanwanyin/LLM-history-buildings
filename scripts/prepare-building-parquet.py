"""Building footprints and risk values as web GeoParquet tiles.

The group-risk map used to zoom from a GeoTIFF overview into a PMTiles archive.
Both are replaced here by spatially tiled GeoParquet decoded in the browser:
every footprint keeps its cleaned SHP geometry and its four source risk values,
so zooming in shows complete building polygons instead of raster cells.

Outputs (public/buildings/):
  manifest.json             tile index, field dictionary, statistics
  tiles/{z}/{x}/{y}.parquet one EPSG:4326 GeoParquet tile per Web Mercator tile
  overview-{hazard}.png     low-zoom surface aggregated from the same values
"""
import json, sys, time
from pathlib import Path
import numpy as np
import shapely
import pyarrow as pa
import pyarrow.parquet as pq
import pyogrio
from pyproj import Transformer
from PIL import Image

ROOT = Path('.')
SRC = ROOT / 'work/clean-buildings/clean-risk.fgb'
OUT = ROOT / 'public/buildings'
TILE_Z = 14
HAZARDS = [('bendi', 'risk_bendi_raw'), ('kaifa', 'risk_kaifa_raw'), ('huodong', 'risk_huodong_raw'), ('weihuapin', 'risk_weihuapin_raw')]
COLS = ['building_id', 'height', 'heritage_name', 'site_id'] + [c for _, c in HAZARDS]
LIMITS = {'bendi': 1.0, 'kaifa': 1.2, 'huodong': 80000.0, 'weihuapin': 20.0}
PALETTE = np.array([[49, 132, 132], [220, 210, 138], [191, 70, 78]], float)
MERC = 20037508.342789244
sample = '--sample' in sys.argv
if '--out' in sys.argv:
    OUT = Path(sys.argv[sys.argv.index('--out') + 1])

if sample:
    n = int(sys.argv[sys.argv.index('--sample') + 1])
    frame = pyogrio.read_dataframe(SRC, columns=COLS, max_features=n)
else:
    frame = pyogrio.read_dataframe(SRC, columns=COLS)
print('rows', len(frame), flush=True)

geom = frame.geometry.to_numpy()
cent = shapely.centroid(geom)
utm_x = shapely.get_x(cent)
utm_y = shapely.get_y(cent)
if sample:  # keep the sample compact so the test build stays fast
    frame = frame.iloc[np.argsort(utm_x)[: len(frame)]]

# WGS84 geometry for the browser; the source stays EPSG:32651.
t0 = time.time()
_to_wgs = Transformer.from_crs(32651, 4326, always_xy=True)


def utm_to_wgs(coords):
    x, y = _to_wgs.transform(coords[:, 0], coords[:, 1])
    return np.column_stack([x, y])


frame = frame.set_geometry(shapely.transform(geom, utm_to_wgs)).set_crs(4326, allow_override=True)
print('projected', round(time.time() - t0, 1), 's', flush=True)
wgs = frame.geometry.to_numpy()
wkb = shapely.to_wkb(wgs, byte_order=1)
lon = shapely.get_x(shapely.centroid(wgs))
lat = shapely.get_y(shapely.centroid(wgs))


def tile_of(lon, lat, z=TILE_Z):
    size = 2 ** z
    x = np.floor((np.asarray(lon, dtype=float) + 180.0) / 360.0 * size).astype(np.int64)
    rad = np.radians(np.asarray(lat, dtype=float))
    y = np.floor((1.0 - np.log(np.tan(rad) + 1.0 / np.cos(rad)) / np.pi) / 2.0 * size).astype(np.int64)
    return np.clip(x, 0, size - 1), np.clip(y, 0, size - 1)


tx, ty = tile_of(lon, lat)
bounds = shapely.bounds(wgs)
bx0, by0, bx1, by1 = (bounds[:, 0], bounds[:, 1], bounds[:, 2], bounds[:, 3])
ex0, ey0 = tile_of(bx0, by1)
ex1, ey1 = tile_of(bx1, by0)
single = (ex0 == ex1) & (ey0 == ey1)
print('features spanning several tiles', int((~single).sum()), flush=True)

tiles = {}
for i in np.flatnonzero(single):
    tiles.setdefault((int(tx[i]), int(ty[i])), []).append(int(i))
for i in np.flatnonzero(~single):
    for gx in range(int(ex0[i]), int(ex1[i]) + 1):
        for gy in range(int(ey0[i]), int(ey1[i]) + 1):
            tiles.setdefault((gx, gy), []).append(int(i))
print('tiles', len(tiles), flush=True)

b_id = np.array([int(str(v)[1:]) if str(v).startswith('c') else int(float(v)) for v in frame['building_id']], dtype=np.int64)
height = frame['height'].to_numpy(dtype=float)
site = frame['site_id'].fillna('').astype(str).to_numpy(dtype=object).astype(str)
hname = frame['heritage_name'].fillna('').astype(str).to_numpy(dtype=object).astype(str)
risk = {key: frame[col].to_numpy(dtype=float) for key, col in HAZARDS}

tiles_dir = OUT / 'tiles' / str(TILE_Z)
tiles_dir.mkdir(parents=True, exist_ok=True)
manifest_tiles = []
total = 0
for index, ((gx, gy), rows) in enumerate(sorted(tiles.items())):
    rows = np.array(rows, dtype=np.int64)
    table = pa.table({
        'i': pa.array(b_id[rows], pa.int32()),
        'h': pa.array(height[rows], pa.float32()),
        's': pa.array(site[rows], pa.string()),
        'n': pa.array(hname[rows], pa.string()),
        'b': pa.array(risk['bendi'][rows], pa.float32()),
        'k': pa.array(risk['kaifa'][rows], pa.float32()),
        'u': pa.array(risk['huodong'][rows], pa.float32()),
        'w': pa.array(risk['weihuapin'][rows], pa.float32()),
        'g': pa.array([bytes(v) for v in wkb[rows]], pa.binary()),
    })
    directory = tiles_dir / str(gx)
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / f'{gy}.parquet'
    pq.write_table(table, path, compression='zstd', compression_level=9, row_group_size=8192, store_schema=False)
    size = path.stat().st_size
    total += size
    manifest_tiles.append((gx, gy, len(rows), size))
    if index % 200 == 0:
        print('  tile', index, '/', len(tiles), flush=True)

# Low-zoom surface from the same building values, on a Web Mercator grid.
def mercator(lon, lat):
    x = np.asarray(lon, dtype=float) * MERC / 180.0
    y = np.log(np.tan((90.0 + np.asarray(lat, dtype=float)) * np.pi / 360.0)) * MERC / np.pi
    return x, y


mx, my = mercator(lon, lat)
cell = 128.0
gx = np.floor(mx / cell).astype(np.int64)
gy = np.floor(my / cell).astype(np.int64)
minx, maxx = int(gx.min()) - 8, int(gx.max()) + 8
miny, maxy = int(gy.min()) - 8, int(gy.max()) + 8
w, h = maxx - minx + 1, maxy - miny + 1
print('overview grid', w, h, flush=True)
cx = (gx - minx).astype(np.int64)
cy = (gy - miny).astype(np.int64)
ncell = w * h
count = np.bincount(cy * w + cx, minlength=ncell).astype(np.float64).reshape(h, w)


def blur(a, sigma):
    radius = max(1, int(round(sigma * 3)))
    kernel = np.exp(-0.5 * (np.arange(-radius, radius + 1) / sigma) ** 2)
    kernel /= kernel.sum()
    out = np.apply_along_axis(lambda row: np.convolve(row, kernel, mode='same'), 1, a)
    return np.apply_along_axis(lambda col: np.convolve(col, kernel, mode='same'), 0, out)


weight = blur(count, 1.4)
overviews = {}
for key, _ in HAZARDS:
    values = risk[key]
    valid = np.isfinite(values)
    sums = np.bincount((cy[valid]) * w + cx[valid], weights=values[valid], minlength=ncell).reshape(h, w)
    means = np.divide(sums, count, out=np.zeros_like(sums), where=count > 0)
    smooth = blur(means * (count > 0), 1.4)
    with np.errstate(invalid='ignore', divide='ignore'):
        smooth = np.where(weight > 0.08, smooth / weight, np.nan)
    limit, low = LIMITS[key], (0.25 if key == 'weihuapin' else 0.0)
    ratio = np.log1p(np.maximum(smooth, 0)) / np.log1p(limit) if key == 'huodong' else (smooth - low) / (limit - low)
    ratio = np.clip(np.where(np.isfinite(ratio), ratio, 0), 0, 1)
    color = np.stack([np.interp(ratio, [0, 0.5, 1], PALETTE[:, k]) for k in range(3)], axis=-1)
    alpha = np.where(np.isfinite(smooth) & (weight > 0.12), 225, 0)
    Image.fromarray(np.dstack([color, alpha]).astype('uint8')).save(OUT / f'overview-{key}.png', optimize=True)
    merc = Transformer.from_crs(3857, 4326, always_xy=True)
    corners = [list(merc.transform(minx * cell, maxy * cell)), list(merc.transform(maxx * cell, maxy * cell)),
               list(merc.transform(maxx * cell, miny * cell)), list(merc.transform(minx * cell, miny * cell))]
    overviews[key] = {'file': f'overview-{key}.png', 'coordinates': corners, 'cell_m': cell,
                      'source': 'parquet building values (equal-building mean, gaussian 1.4 cells)'}

stats = {}
for key, _ in HAZARDS:
    values = risk[key]
    valid = np.isfinite(values)
    stats[key] = {'count': int(valid.sum()), 'missing': int((~valid).sum()), 'min': float(values[valid].min()),
                  'max': float(values[valid].max()), 'mean': float(values[valid].mean()), 'zero': int((values == 0).sum())}

manifest = {
    'schema': 'herisk-building-parquet-v1',
    'tile_zoom': TILE_Z,
    'crs': 'EPSG:4326',
    'source_crs': 'EPSG:32651',
    'source': {'file': '全部建筑地块_含文物属性_SHP.zip', 'risk_file': '建筑风险_四类共享几何.parquet',
               'buildings': int(len(frame)), 'tiles': len(tiles), 'bytes': int(total)},
    'fields': {'i': 'clean SHP building index (c + i)', 'h': 'height m', 's': 'heritage site id', 'n': 'heritage name on the SHP attribute',
               'b': '本底塑造 risk_bendi_raw', 'k': '开发建设 risk_kaifa_raw', 'u': '活动利用 risk_huodong_raw', 'w': '危化品 risk_weihuapin_raw',
               'g': 'WKB polygon, EPSG:4326'},
    'hazards': {'bendi': {'field': 'b', 'limit': LIMITS['bendi']}, 'kaifa': {'field': 'k', 'limit': LIMITS['kaifa']},
                'huodong': {'field': 'u', 'limit': LIMITS['huodong']}, 'weihuapin': {'field': 'w', 'limit': LIMITS['weihuapin']}},
    'statistics': stats,
    'overviews': overviews,
    'tile_index': {f'{gx}/{gy}': [n, size] for gx, gy, n, size in manifest_tiles},
}
(OUT / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, separators=(',', ':')))
print(json.dumps({'tiles': len(tiles), 'bytes': total, 'rows': len(frame), 'overview': [w, h]}), flush=True)
