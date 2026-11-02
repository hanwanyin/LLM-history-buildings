import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

// Export only the existing public API. No administrative credentials or raw
// identity/audit tables are included in the public mirror.
const origin = process.env.PAGES_SOURCE_ORIGIN || 'https://heritage-sensitivity-han-2026.wanyinhan98.chatgpt.site';
if (new URL(origin).protocol !== 'https:') throw Error('The source must use HTTPS.');
const output = path.resolve('work/pages-public');
const staging = path.resolve('work/pages-export');
await fs.rm(staging, { recursive: true, force: true });
await fs.mkdir(path.join(staging, 'snapshot/sites'), { recursive: true });
await fs.mkdir(path.join(staging, 'snapshot/assessments'), { recursive: true });
await fs.mkdir(path.join(staging, 'originals'), { recursive: true });
async function request(route, binary = false) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const response = await fetch(origin + '/api/' + route, { signal: AbortSignal.timeout(45000) });
      if (!response.ok) throw Error(`Public source ${route}: HTTP ${response.status}`);
      return binary ? Buffer.from(await response.arrayBuffer()) : await response.json();
    } catch (error) {
      if (attempt === 4) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }
}
const write = (file, data) => fs.writeFile(path.join(staging, file), JSON.stringify(data));
const [boot, sources] = await Promise.all([request('bootstrap'), request('sources')]);
if (boot.stats.sites !== boot.sites.length || sources.sources.length !== boot.stats.sources) throw Error('Source counts disagree.');
boot.user = { signedIn: false, admin: false, email: null };
boot.storage = 'GitHub Pages public snapshot';
boot.snapshot = { exported_at: new Date().toISOString(), source_origin: origin, readonly: true };
const details = new Array(boot.sites.length);
let cursor = 0, completed = 0;
await Promise.all(Array.from({ length: 5 }, async () => {
  while (cursor < boot.sites.length) {
    const index = cursor++, site = boot.sites[index];
    if (!/^[A-Za-z0-9_-]+$/.test(site.id)) throw Error('Invalid site id.');
    const detail = await request('sites/' + encodeURIComponent(site.id));
    if (detail.site.id !== site.id || detail.scores.length !== site.detail_count) throw Error(`Source mismatch: ${site.id}`);
    details[index] = detail;
    await write(`snapshot/sites/${site.id}.json`, detail);
    for (const run of detail.runs) {
      if (!/^[A-Za-z0-9_-]+$/.test(run.id)) throw Error('Invalid assessment id.');
      await write(`snapshot/assessments/${run.id}.json`, await request('assessments/' + run.id));
    }
    if (++completed % 100 === 0) console.log(`Public records: ${completed}/${boot.sites.length}`);
  }
}));
const evidence = details.flatMap(detail => detail.scores.map(score => ({
  id: score.id, site_id: detail.site.id, site_name: detail.site.name,
  score: score.score, confidence: score.confidence, evidence: score.evidence,
  reasoning: score.reasoning, missing: score.missing, sheet: score.sheet,
  row_number: score.row_number, indicator: score.indicator,
  dimension: score.dimension, filename: score.filename,
})));
if (evidence.length !== boot.stats.scores || evidence.filter(row => row.score === null).length !== boot.stats.missing) throw Error('Score reconciliation failed.');
const after = await request('bootstrap');
if (JSON.stringify(after.stats) !== JSON.stringify(boot.stats) || JSON.stringify(after.sites) !== JSON.stringify(boot.sites)) throw Error('Source changed during export; run again.');
for (const source of sources.sources) {
  const data = await request(`sources/${encodeURIComponent(source.id)}/download`, true);
  if (data.length !== source.size || createHash('sha256').update(data).digest('hex') !== source.sha256) throw Error(`Original checksum mismatch: ${source.filename}`);
  const filename = path.basename(source.filename);
  if (filename !== source.filename) throw Error('Unsafe source filename.');
  source.mirror_path = 'originals/' + filename;
  await fs.writeFile(path.join(staging, source.mirror_path), data);
}
// Small static shards work on GitHub Pages without HTTP Range support or files
// above GitHub's 100 MB limit. Their ordered concatenation is the original archive.
const archive = await fs.readFile('data/shanghai-buildings.pmtiles');
const size = 1024 * 1024;
const digest = createHash('sha256').update(archive).digest('hex');
const directory = `map/${digest.slice(0, 16)}`;
await fs.mkdir(path.join(staging, directory), { recursive: true });
const shards = [];
for (let start = 0; start < archive.length; start += size) {
  const bytes = archive.subarray(start, Math.min(start + size, archive.length));
  const file = `${directory}/${String(shards.length).padStart(4, '0')}.bin`;
  await fs.writeFile(path.join(staging, file), bytes);
  shards.push({ file, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
}
await write('map/archive.json', { version: 1, bytes: archive.length, chunk_size: size, sha256: digest, shards });
const knowledge=await request('knowledge/published');
await fs.mkdir(path.join(staging,'knowledge-files'),{recursive:true});
for(const doc of knowledge.documents){if(doc.filename){const bytes=await request('knowledge/download/'+encodeURIComponent(doc.id),true);if(createHash('sha256').update(bytes).digest('hex')!==doc.sha256)throw Error('Supplement checksum mismatch');await fs.writeFile(path.join(staging,'knowledge-files',doc.id),bytes);}}
await write('snapshot/knowledge.json',knowledge);
await write('snapshot/bootstrap.json', boot);
await write('snapshot/sources.json', sources);
await write('snapshot/evidence.json', evidence);
await write('snapshot/manifest.json', { ...boot.snapshot, stats: boot.stats, buildings_sha256: digest, building_archive_bytes: archive.length, site_count: details.length, score_count: evidence.length });
await fs.rm(output, { recursive: true, force: true });
await fs.rename(staging, output);
console.log(JSON.stringify({ output, stats: boot.stats, exported_at: boot.snapshot.exported_at, shards: shards.length, archive_sha256: digest }));
