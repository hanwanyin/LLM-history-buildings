import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';
const js=ts.transpileModule(fs.readFileSync('lib/risk-regions.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {connectedRiskRegions,regionGeoJSON,regionOutlines}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const c=(x,y,v)=>({x,y,n:2,mean:[v],max:[v],ring:[[x,y],[x+1,y],[x+1,y+1],[x,y+1],[x,y]]});
const cells=[c(0,0,0),c(1,0,2),c(2,1,2),c(5,5,null)];
assert.equal(connectedRiskRegions(cells,0,1).length,2);
assert.equal(connectedRiskRegions(cells,0,1,1,true).length,1);
assert.equal(connectedRiskRegions(cells,0,1,2,false).length,0);
assert.equal(connectedRiskRegions(cells,0,0).flat().length,3); // real zero included, missing excluded
assert.equal(regionGeoJSON(connectedRiskRegions(cells,0,1,1,true)).features[0].properties.grid_area_km2,.5);
const dir='public/risk-atlas/';const manifest=JSON.parse(fs.readFileSync(dir+'manifest.json'));const all=JSON.parse(fs.readFileSync(dir+'cells.json'));const points=JSON.parse(fs.readFileSync(dir+'points.json'));
assert.equal(all.reduce((n,c)=>n+c.n,0),1484693);assert.equal(all.length,manifest.cell_count);assert.equal(points.length,767);assert.equal(new Set(points.map(p=>p.id)).size,767);assert.equal(points.filter(p=>p.risk_yulun_0_100===null).length,22);
for(const p of points)if(p.risk_yulun_0_100!==null)assert.ok(Math.abs(p.risk_yulun_0_100-(100-p.sentiment_score_0_100))<1e-8);
assert.equal(manifest.statistics.risk_kaifa_smooth_sample.missing,73);
for(const r of Object.values(manifest.rasters)){assert.ok(fs.existsSync(dir+r.file));assert.equal(r.source_crs,'EPSG:32651');assert.ok(r.coordinates.every(([x,y])=>x>120&&x<124&&y>29&&y<33));}
const real=connectedRiskRegions(all,0,.7,3);assert.ok(real.length>0);assert.ok(real.flat().every(c=>c.mean[0]>=.7));
console.log(JSON.stringify({passed:true,cells:all.length,buildings:1484693,points:points.length,regions:real.length}));

assert.equal(regionOutlines([[c(0,0,1),c(1,0,1)]]).features[0].geometry.coordinates.length,6);
