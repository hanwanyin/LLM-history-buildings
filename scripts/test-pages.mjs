import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import ts from 'typescript';
const origin = process.env.PAGES_TEST_ORIGIN || 'http://127.0.0.1:4173';
const base = origin + '/LLM-history-buildings/';
const originalFetch = globalThis.fetch;
const requests = [];
globalThis.fetch = (url, options) => {
  const absolute = new URL(url, origin);
  assert.equal(absolute.origin, origin, 'Read-only operations must stay on the Pages origin');
  assert.ok(absolute.pathname.startsWith('/LLM-history-buildings/'), 'All assets must honor the project base path');
  requests.push(absolute.href);
  return originalFetch(absolute, options);
};
async function moduleFrom(file, prefix = '') {
  const source = await fs.readFile(file, 'utf8');
  const js = ts.transpileModule(prefix + source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  return import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
}
const client = await moduleFrom('lib/client-data.ts', 'const __PAGES_MIRROR__=true; const __PAGES_BASE__="/LLM-history-buildings/";\n');
const boot = await client.api('bootstrap');
assert.equal(boot.mapScores.length, 763 * 5);
assert.equal(new Set(boot.mapScores.map(row => row.site_id + '|' + row.dimension)).size, 763 * 5);
assert.equal(boot.stats.sites, 763); assert.equal(boot.stats.scores, 20250); assert.equal(boot.heritage_cleaning.duplicates_removed, 4); assert.equal(boot.user.admin, false); assert.ok(boot.snapshot.exported_at);
const detail = await client.api('sites/G-1');
assert.equal(detail.scores.length, 27);
for (const row of detail.dimensions) assert.equal(boot.mapScores.find(score => score.site_id === 'G-1' && score.dimension === row.dimension).score, row.score);
assert.deepEqual(await client.api('map/match/G-1'), detail.spatial);
const missingDetail = await client.api('sites/' + boot.sites.find(row => row.detail_count === 0).id);
assert.equal(missingDetail.scores.length, 0); assert.equal(missingDetail.dimensions.length, 5);
for (const route of ['reviews', 'assessments', 'sites/G-1', 'spatial-confirm']) await assert.rejects(client.api(route, { method: 'POST' }), /公开浏览版/);
const empty = await client.api('evidence'); assert.equal(empty.total, 0);
const evidence = await client.api('evidence?site=G-1'); assert.equal(evidence.total, 27);
const search = await client.api('evidence?q=' + encodeURIComponent('故居 历史'));
assert.ok(search.total > 0);
const percent = await client.api('evidence?q=%25');
assert.ok(percent.total < boot.stats.scores, 'Percent must be treated literally, not as an SQL wildcard');
const sources = await client.api('sources');
for (const source of sources.sources) {
  const response = await fetch(client.sourceDownloadUrl(source.id, source.filename));
  assert.equal(response.status, 200);
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.equal(createHash('sha256').update(bytes).digest('hex'), source.sha256);
}
// Building footprints ship as spatially tiled GeoParquet decoded in the browser.
const buildings = await (await fetch(base + 'buildings/manifest.json')).json();
assert.equal(buildings.schema, 'herisk-building-parquet-v1');
assert.equal(buildings.tile_zoom, 14);
assert.equal(buildings.source.buildings, 1570932);
assert.ok(Object.keys(buildings.tile_index).length > 1500);
for (const hazard of ['bendi','kaifa','huodong','weihuapin']) {
  const overview = buildings.overviews[hazard];
  const response = await fetch(base + 'buildings/' + overview.file);
  assert.equal(response.status, 200, 'parquet-derived ' + hazard + ' overview');
  assert.equal(overview.coordinates.length, 4);
}
const dense = Object.keys(buildings.tile_index).sort((a, b) => buildings.tile_index[b][0] - buildings.tile_index[a][0])[0];
const tileResponse = await fetch(base + 'buildings/tiles/14/' + dense + '.parquet');
assert.equal(tileResponse.status, 200);
const tileBytes = Buffer.from(await tileResponse.arrayBuffer());
assert.equal(tileBytes.subarray(0, 4).toString('latin1'), 'PAR1', 'tile is a real Parquet file');
assert.equal(tileBytes.subarray(tileBytes.length - 4).toString('latin1'), 'PAR1');
assert.equal(tileBytes.length, buildings.tile_index[dense][1]);
const atlas = await (await fetch(base + 'risk-atlas/manifest.json')).json();
assert.equal(atlas.point_count, 763);
assert.equal(atlas.raw_point_records, 767);
assert.equal(atlas.rasters, undefined, 'no TIF-derived raster remains on the risk page');
assert.equal(requests.some(url => url.includes('map/archive')), false, 'the PMTiles mirror is gone');
assert.equal(requests.some(url => url.includes('/api/')), false);
console.log(JSON.stringify({ passed:true, stats:boot.stats, checks:'project path; no old backend reads; read-only writes rejected; 6 source checksums; evidence; missing scores; GeoParquet tiles; parquet-derived overviews', requests:requests.length }));
