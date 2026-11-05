import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { cleanHeritageRecords } from './clean-heritage-records.mjs';

try {
  await fs.access('public/buildings/manifest.json');
} catch {
  throw Error('public/buildings is missing: run `/usr/bin/python3 scripts/prepare-building-parquet.py` first.');
}

// One public record per heritage object (763), then the reproducible web assets.
const cleaned = await cleanHeritageRecords();
if (cleaned.after !== 763) throw Error('Unexpected heritage object count after cleaning: ' + cleaned.after);
const manifest = JSON.parse(await fs.readFile('work/pages-public/snapshot/manifest.json', 'utf8'));
if (manifest.site_count !== 763 || manifest.score_count !== 20250) throw Error('Unexpected public snapshot counts; inspect before publication.');
const temporary = (file) => !path.basename(file).startsWith('._') && path.basename(file) !== '.DS_Store';

await fs.mkdir('work/pages-public/maplibre', { recursive: true });
for (const [from, to] of [
  ['node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs', 'maplibre/worker.mjs'],
  ['node_modules/maplibre-gl/LICENSE.txt', 'maplibre/LICENSE.txt'],
  ['public/favicon.svg', 'favicon.svg'],
]) await fs.copyFile(from, 'work/pages-public/' + to);

for (const directory of ['clean-buildings', 'risk-atlas', 'buildings']) {
  const target = path.join('work/pages-public', directory);
  await fs.rm(target, { recursive: true, force: true });
  await fs.cp(path.join('public', directory), target, { recursive: true, filter: temporary });
}
await fs.writeFile('work/pages-public/.nojekyll', '');

const build = spawnSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--config', 'public-site/vite.config.ts'], { stdio: 'inherit' });
if (build.status !== 0) process.exit(build.status || 1);
// exFAT writes AppleDouble sidecars next to every file; never publish them.
const walk = async (dir) => {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(file);
    else if (entry.name.startsWith('._') || entry.name === '.DS_Store') await fs.rm(file, { force: true });
  }
};
await walk('outputs/github-pages');
console.log('GitHub Pages build ready: outputs/github-pages');
