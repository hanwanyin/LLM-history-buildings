import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {scoreGrade,dimensionScoreMap,atlasDimensions} from '../lib/atlas-metrics.ts';
import {createMapStyle,themePaintUpdates} from '../lib/map-style.ts';
assert.deepEqual([null,undefined,0,6,'5',NaN,1,2,3,4,5].map(scoreGrade),['missing','missing','missing','missing','missing','missing','low','low','medium','high','high']);
const boot=await(await fetch('http://127.0.0.1:5173/api/bootstrap')).json();
assert.equal(boot.mapScores.length,767*5);assert.equal(new Set(boot.mapScores.map(r=>r.site_id+'|'+r.dimension)).size,767*5);
for(const dim of atlasDimensions){const scores=dimensionScoreMap(boot.mapScores,dim.id);assert.equal(Object.keys(scores).length,767);}
for(const id of ['G-1','G-6','G-12']){const source=JSON.parse(await fs.readFile('work/pages-public/snapshot/sites/'+id+'.json','utf8'));for(const d of source.dimensions)assert.equal(boot.mapScores.find(r=>r.site_id===id&&r.dimension===d.dimension).score,d.score);}
const dark=createMapStyle('https://example.com/map','dark'),light=createMapStyle('https://example.com/map','light');
assert.equal(dark.sources.buildings.url,light.sources.buildings.url);assert.notDeepEqual(dark.layers[0].paint,light.layers[0].paint);
for(const t of ['dark','light'])assert.ok(themePaintUpdates(t).every(u=>dark.layers.some(l=>l.id===u.id)));
console.log('Passed: 3,835 source scores, 5 dimensions, null/zero safety, score provenance, independent basemap theme.');
