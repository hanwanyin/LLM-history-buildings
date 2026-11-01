import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import ts from 'typescript';
import { PMTiles } from 'pmtiles';
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
const { ShardedPMTilesSource } = await moduleFrom('lib/sharded-pmtiles.ts');
const boot = await client.api('bootstrap');
assert.equal(boot.stats.sites, 767); assert.equal(boot.user.admin, false); assert.ok(boot.snapshot.exported_at);
const detail = await client.api('sites/G-1');
assert.equal(detail.scores.length, 27);
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
const archive = await fs.readFile('data/shanghai-buildings.pmtiles');
const source = new ShardedPMTilesSource(base + 'map/archive.json', base);
for (const [offset, length] of [[0,16384],[1048570,100],[archive.length-1000,1000],[50000000,3000000]]) {
  const actual = await source.getBytes(offset, length);
  assert.deepEqual(Buffer.from(actual.data), archive.subarray(offset,offset+length));
}
await assert.rejects(source.getBytes(-1,1));
const controller = new AbortController(); controller.abort();
await assert.rejects(source.getBytes(0,100,controller.signal), { name:'AbortError' });
const pm = new PMTiles(source);
assert.equal((await pm.getHeader()).maxZoom,16);
for (const id of ['G-1','G-2','G-6']) {
  const item = boot.sites.find(site => site.id === id), z=16;
  const x=Math.floor(((item.map_lon??item.longitude)+180)/360*2**z);
  const y=Math.floor((1-Math.asinh(Math.tan((item.map_lat??item.latitude)*Math.PI/180))/Math.PI)/2*2**z);
  const tile=await pm.getZxy(z,x,y); assert.ok(tile?.data.byteLength>100, `SHP tile for ${id}`);
}
assert.equal(requests.some(url => url.includes('/api/')), false);
console.log(JSON.stringify({ passed:true, stats:boot.stats, checks:'project path; no old backend reads; read-only writes rejected; 6 source checksums; evidence; missing scores; PMTiles ranges/cancellation/SHP tiles', requests:requests.length }));
