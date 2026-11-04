import fs from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
const manifest = JSON.parse(await fs.readFile('work/pages-public/snapshot/manifest.json', 'utf8'));
if (manifest.site_count !== 767 || manifest.score_count !== 20304) throw Error('Unexpected public snapshot counts; inspect before publication.');
await fs.mkdir('work/pages-public/maplibre', { recursive: true });
for (const [from, to] of [
  ['node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs', 'maplibre/worker.mjs'],
  ['node_modules/maplibre-gl/LICENSE.txt', 'maplibre/LICENSE.txt'],
  ['public/favicon.svg', 'favicon.svg'],
]) await fs.copyFile(from, 'work/pages-public/' + to);
await fs.cp('public/clean-buildings', 'work/pages-public/clean-buildings', {recursive:true});
await fs.cp('public/risk-atlas', 'work/pages-public/risk-atlas', {recursive:true});
await fs.writeFile('work/pages-public/.nojekyll', '');
const build = spawnSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--config', 'public-site/vite.config.ts'], { stdio: 'inherit' });
if (build.status !== 0) process.exit(build.status || 1);
console.log('GitHub Pages build ready: outputs/github-pages');
