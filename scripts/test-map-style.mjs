import assert from 'node:assert/strict';
import {createMapStyle, baseLayers, baseOpacityUpdates} from '../lib/map-style.ts';
const style=createMapStyle('https://example.com/api/map/archive');
const allowed=new Set(['landcover','park','water','waterway','transportation','transportation_name','water_name','place','boundary']);
for(const layer of baseLayers){
  assert.notEqual(layer.type,'raster','Raster imagery can contain inseparable building blocks');
  assert.notEqual(layer.type,'fill-extrusion','Basemap must not contain 3D buildings');
  if(layer.source)assert.ok(allowed.has(layer['source-layer']),layer.id);
}
assert.deepEqual(style.layers.filter(l=>l['source-layer']==='buildings').map(l=>l.source),['buildings','buildings']);
assert.equal(style.sources.buildings.url,'pmtiles://https://example.com/api/map/archive');
assert.ok(baseOpacityUpdates(0).every(l=>l.value===0&&!l.id.startsWith('building')));
assert.ok(baseOpacityUpdates(.5).every(l=>l.value>=0&&l.value<=.5));
console.log('Passed: no basemap buildings or raster tiles; SHP overlay and independent opacity preserved.');
