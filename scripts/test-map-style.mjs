import assert from 'node:assert/strict';
import {createMapStyle, baseLayers, baseOpacityUpdates} from '../lib/map-style.ts';
const style=createMapStyle();
const allowed=new Set(['landcover','park','water','waterway','transportation','transportation_name','water_name','place','boundary']);
for(const layer of baseLayers){
  assert.notEqual(layer.type,'raster','Raster imagery can contain inseparable building blocks');
  assert.notEqual(layer.type,'fill-extrusion','Basemap must not contain 3D buildings');
  if(layer.source)assert.ok(allowed.has(layer['source-layer']),layer.id);
}
assert.equal(style.sources.buildings,undefined,'building footprints come from GeoParquet tiles, not the basemap');
assert.ok(style.layers.every(l=>l.id!=='building-fill'&&l.id!=='building-outline'));
assert.ok(baseOpacityUpdates(0).every(l=>l.value===0&&!l.id.startsWith('building')));
assert.ok(baseOpacityUpdates(.5).every(l=>l.value>=0&&l.value<=.5));
console.log('Passed: no basemap buildings or raster tiles; footprints are added from cleaned-SHP GeoParquet by the map component.');
