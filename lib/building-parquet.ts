import { parquetReadObjects } from 'hyparquet';
import { compressors } from 'hyparquet-compressors';
import { assetUrl } from './client-data';

// Building footprints and their four source risk values are published as
// spatially tiled GeoParquet. The map decodes only the tiles under the current
// view, so zooming in shows complete cleaned-SHP footprints instead of the
// pixels of a raster overview. See scripts/prepare-building-parquet.py.

export type BuildingTile = [count: number, bytes: number];

export type BuildingManifest = {
  schema: string;
  tile_zoom: number;
  crs: string;
  source_crs: string;
  source: { file: string; risk_file: string; buildings: number; tiles: number; bytes: number };
  fields: Record<string, string>;
  hazards: Record<string, { field: 'b' | 'k' | 'u' | 'w'; limit: number }>;
  statistics: Record<string, { count: number; missing: number; min: number; max: number; mean: number; zero: number }>;
  overviews: Record<string, { file: string; coordinates: [number, number][]; cell_m: number; source: string }>;
  tile_index: Record<string, BuildingTile>;
};

export type BuildingProperties = {
  building_id: string;
  height: number | null;
  site_id: string | null;
  heritage_name: string | null;
  risk_bendi_raw: number | null;
  risk_kaifa_raw: number | null;
  risk_huodong_raw: number | null;
  risk_weihuapin_raw: number | null;
  risk_match: 'geometry_verified' | 'unmatched';
};

export type BuildingFeature = {
  type: 'Feature';
  geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: number[][][] | number[][][][] };
  properties: BuildingProperties;
};

const manifestCache = new Map<string, Promise<BuildingManifest>>();
const tileCache = new Map<string, Promise<BuildingFeature[]>>();
const CACHE_LIMIT = 48;
const MAX_TILES = 24;

export function loadBuildingManifest(): Promise<BuildingManifest> {
  const key = assetUrl('buildings/manifest.json');
  const cached = manifestCache.get(key);
  if (cached) return cached;
  const request = fetch(key).then(async response => {
    if (!response.ok) throw Error('建筑 GeoParquet 清单加载失败');
    return (await response.json()) as BuildingManifest;
  }).catch(error => { manifestCache.delete(key); throw error; });
  manifestCache.set(key, request);
  return request;
}

function tileX(lon: number, z: number) { return Math.floor(((lon + 180) / 360) * 2 ** z); }
function tileY(lat: number, z: number) {
  const rad = (Math.max(-85.0511, Math.min(85.0511, lat)) * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** z);
}

export function buildingTilesForBounds(manifest: BuildingManifest, bounds: [[number, number], [number, number]]): string[] {
  const z = manifest.tile_zoom;
  const [west, south] = bounds[0];
  const [east, north] = bounds[1];
  const keys: string[] = [];
  const x0 = tileX(west, z), x1 = tileX(east, z);
  const y0 = tileY(north, z), y1 = tileY(south, z);
  for (let x = x0; x <= x1; x++) {
    for (let y = y0; y <= y1; y++) {
      const key = `${x}/${y}`;
      if (manifest.tile_index[key]) keys.push(key);
    }
  }
  return keys;
}

function decodeWkb(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 0;
  const point = () => {
    const x = view.getFloat64(offset, true);
    const y = view.getFloat64(offset + 8, true);
    offset += 16;
    return [x, y];
  };
  const ring = () => {
    const n = view.getUint32(offset, true);
    offset += 4;
    const coordinates: number[][] = [];
    for (let i = 0; i < n; i++) coordinates.push(point());
    return coordinates;
  };
  const polygon = () => {
    const n = view.getUint32(offset, true);
    offset += 4;
    const rings: number[][][] = [];
    for (let i = 0; i < n; i++) rings.push(ring());
    return rings;
  };
  const read = (): { type: 'Polygon' | 'MultiPolygon'; coordinates: number[][][] | number[][][][] } => {
    if (view.getUint8(offset++) !== 1) throw Error('仅支持小端 WKB');
    const raw = view.getUint32(offset, true);
    offset += 4;
    const type = raw >= 1000 ? raw - 1000 : raw;
    if (type === 3) return { type: 'Polygon', coordinates: polygon() };
    if (type === 6) {
      const n = view.getUint32(offset, true);
      offset += 4;
      const polygons: number[][][][] = [];
      for (let i = 0; i < n; i++) {
        if (view.getUint8(offset++) !== 1) throw Error('仅支持小端 WKB');
        const inner = view.getUint32(offset, true);
        offset += 4;
        if ((inner >= 1000 ? inner - 1000 : inner) !== 3) throw Error('MultiPolygon 仅支持面对象');
        polygons.push(polygon());
      }
      return { type: 'MultiPolygon', coordinates: polygons };
    }
    throw Error('不支持的 WKB 几何类型 ' + type);
  };
  return read();
}

function numberOrNull(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

async function readTile(manifest: BuildingManifest, key: string): Promise<BuildingFeature[]> {
  const [x, y] = key.split('/');
  const url = assetUrl(`buildings/tiles/${manifest.tile_zoom}/${x}/${y}.parquet`);
  const response = await fetch(url);
  if (!response.ok) throw Error('建筑 GeoParquet 分块加载失败');
  const buffer = await response.arrayBuffer();
  const file = { byteLength: buffer.byteLength, slice: (start: number, end: number) => buffer.slice(start, end) };
  const rows = await parquetReadObjects({ file, columns: ['i', 'h', 's', 'n', 'b', 'k', 'u', 'w', 'g'], compressors, utf8: false });
  return rows.map(row => {
    const risk = [row.b, row.k, row.u, row.w].map(numberOrNull) as [number | null, number | null, number | null, number | null];
    const site = typeof row.s === 'string' && row.s ? row.s : null;
    const name = typeof row.n === 'string' && row.n ? row.n : null;
    return {
      type: 'Feature' as const,
      geometry: decodeWkb(row.g as Uint8Array),
      properties: {
        building_id: 'c' + row.i,
        height: numberOrNull(row.h),
        site_id: site,
        heritage_name: name,
        risk_bendi_raw: risk[0],
        risk_kaifa_raw: risk[1],
        risk_huodong_raw: risk[2],
        risk_weihuapin_raw: risk[3],
        risk_match: risk.every(value => value === null) ? 'unmatched' as const : 'geometry_verified' as const,
      },
    };
  });
}

function loadTile(manifest: BuildingManifest, key: string) {
  const cacheKey = `${manifest.tile_zoom}/${key}`;
  const cached = tileCache.get(cacheKey);
  if (cached) { tileCache.delete(cacheKey); tileCache.set(cacheKey, cached); return cached; }
  const request = readTile(manifest, key).catch(error => { tileCache.delete(cacheKey); throw error; });
  tileCache.set(cacheKey, request);
  while (tileCache.size > CACHE_LIMIT) tileCache.delete(tileCache.keys().next().value!);
  return request;
}

/** All buildings whose GeoParquet tile intersects the given WGS84 bounds. */
export async function loadBuildings(manifest: BuildingManifest, bounds: [[number, number], [number, number]], signal?: AbortSignal) {
  const keys = buildingTilesForBounds(manifest, bounds).slice(0, MAX_TILES);
  if (!keys.length) return [] as BuildingFeature[];
  const tiles = await Promise.all(keys.map(key => loadTile(manifest, key).catch(error => {
    if (!(error instanceof Error)) throw error;
    console.warn('建筑分块读取失败', key, error.message);
    return [] as BuildingFeature[];
  })));
  signal?.throwIfAborted();
  const seen = new Set<string>();
  const features: BuildingFeature[] = [];
  for (const tile of tiles) {
    for (const feature of tile) {
      if (seen.has(feature.properties.building_id)) continue;
      seen.add(feature.properties.building_id);
      features.push(feature);
    }
  }
  return features;
}

export function buildingCollection(features: BuildingFeature[]) {
  return { type: 'FeatureCollection' as const, features };
}
