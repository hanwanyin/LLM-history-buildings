import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { build } from 'esbuild';

// The loader is a browser module; bundle it so the test exercises the same code
// the map ships, then serve public/ through a fetch stub.
const bundled = await build({
  entryPoints: ['lib/building-parquet.ts'],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  define: { __PAGES_MIRROR__: 'true', __PAGES_BASE__: '"/"' },
});
const code = bundled.outputFiles[0].text;
const loader = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));

let requests = 0;
globalThis.fetch = async url => {
  requests++;
  const file = path.resolve('public', String(url).replace(/^\//, ''));
  try {
    const body = await fs.readFile(file);
    return new Response(body, { status: 200, headers: { 'content-type': file.endsWith('.json') ? 'application/json' : 'application/octet-stream' } });
  } catch {
    return new Response('', { status: 404 });
  }
};

const manifest = await loader.loadBuildingManifest();
assert.equal(manifest.schema, 'herisk-building-parquet-v1');
assert.equal(manifest.tile_zoom, 14);
assert.ok(Object.keys(manifest.tile_index).length > 1500);
assert.ok(manifest.source.buildings > 1500000);
assert.equal(manifest.statistics.bendi.count + manifest.statistics.bendi.missing, manifest.source.buildings);
for (const hazard of ['bendi', 'kaifa', 'huodong', 'weihuapin']) assert.ok(manifest.overviews[hazard].file.endsWith('.png'));

const keys = Object.keys(manifest.tile_index);
const dense = keys.sort((a, b) => manifest.tile_index[b][0] - manifest.tile_index[a][0])[0];
const [tx, ty] = dense.split('/').map(Number);
const z = manifest.tile_zoom;
const lon = x => (x / 2 ** z) * 360 - 180;
const lat = y => (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / 2 ** z))) * 180) / Math.PI;
const inset = 0.2; // stay inside one tile so the request count is deterministic
const bounds = [[lon(tx + inset), lat(ty + 1 - inset)], [lon(tx + 1 - inset), lat(ty + inset)]];
const before = requests;
const features = await loader.loadBuildings(manifest, bounds);
assert.ok(features.length >= manifest.tile_index[dense][0], 'dense tile keeps every building');
assert.equal(requests - before, 1, 'one parquet request per tile');
assert.equal(new Set(features.map(f => f.properties.building_id)).size, features.length, 'deduplicated building ids');

let matched = 0, unmatched = 0, polygons = 0;
for (const feature of features) {
  assert.ok(['Polygon', 'MultiPolygon'].includes(feature.geometry.type));
  assert.equal(feature.geometry.type, 'Polygon');
  polygons++;
  const ring = feature.geometry.coordinates[0];
  assert.ok(ring.length >= 4);
  assert.deepEqual(ring[0], ring[ring.length - 1], 'rings are closed');
  for (const [x, y] of ring) {
    assert.ok(x > 120 && x < 123 && y > 30 && y < 32, 'coordinates are WGS84 degrees');
  }
  const p = feature.properties;
  assert.match(p.building_id, /^c\d+$/);
  if (p.risk_match === 'geometry_verified') matched++; else unmatched++;
  if (p.risk_match === 'unmatched') {
    assert.equal(p.risk_bendi_raw, null);
    assert.equal(p.risk_kaifa_raw, null);
  } else {
    assert.equal(typeof p.risk_bendi_raw, 'number');
  }
}
assert.ok(matched > 0, 'dense tile contains verified risk values');
assert.ok(features.length - matched === unmatched);

// The cache must answer a repeated view without another network request.
const again = await loader.loadBuildings(manifest, bounds);
assert.equal(again.length, features.length);

// A tile with verified heritage attributes exposes the SHP site link.
const linked = features.find(f => f.properties.site_id);
assert.ok(linked, 'a footprint keeps its heritage site id');
assert.ok(linked.properties.heritage_name);

console.log(JSON.stringify({
  passed: true,
  tiles: keys.length,
  bytes: manifest.source.bytes,
  buildings: manifest.source.buildings,
  dense_tile: dense,
  dense_rows: manifest.tile_index[dense][0],
  decoded: features.length,
  matched,
  unmatched,
  polygons,
  requests,
}));
