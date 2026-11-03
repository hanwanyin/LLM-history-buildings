import type { StyleSpecification, LayerSpecification } from 'maplibre-gl';

// An allowlist of vector layers: the basemap never renders a building footprint.
// OpenMapTiles schema, served by the public OpenFreeMap instance.
const source = 'openmaptiles';
const name = ['coalesce', ['get', 'name:zh'], ['get', 'name'], ['get', 'name:nonlatin'], ['get', 'name:latin']];
const font = ['Noto Sans Regular'];
export const baseLayers = [
  { id:'base-background', type:'background', paint:{'background-color':'#f2f4ef'} },
  { id:'base-green', type:'fill', source, 'source-layer':'landcover', filter:['in',['get','class'],['literal',['wood','grass','scrub']]], paint:{'fill-color':'#e2eadb','fill-opacity':.75} },
  { id:'base-park', type:'fill', source, 'source-layer':'park', paint:{'fill-color':'#dfe9d7','fill-opacity':.65} },
  { id:'base-water', type:'fill', source, 'source-layer':'water', paint:{'fill-color':'#c4dfe5'} },
  { id:'base-waterway', type:'line', source, 'source-layer':'waterway', paint:{'line-color':'#b8d8df','line-width':['interpolate',['linear'],['zoom'],8,.5,14,2,19,7]} },
  { id:'base-road-casing', type:'line', source, 'source-layer':'transportation', minzoom:7, filter:['in',['get','class'],['literal',['motorway','trunk','primary','secondary','tertiary','minor','service']]], layout:{'line-cap':'round','line-join':'round'}, paint:{'line-color':'#d2d9d1','line-width':['interpolate',['linear'],['zoom'],7,.5,12,2,16,7,20,24]} },
  { id:'base-road', type:'line', source, 'source-layer':'transportation', minzoom:7, filter:['in',['get','class'],['literal',['motorway','trunk','primary','secondary','tertiary','minor','service']]], layout:{'line-cap':'round','line-join':'round'}, paint:{'line-color':'#fff','line-width':['interpolate',['linear'],['zoom'],7,.3,12,1,16,5.5,20,22]} },
  { id:'base-path', type:'line', source, 'source-layer':'transportation', minzoom:14, filter:['in',['get','class'],['literal',['path','track']]], paint:{'line-color':'#c7cfbe','line-width':['interpolate',['linear'],['zoom'],14,.7,19,2],'line-dasharray':[2,2]} },
  { id:'base-rail', type:'line', source, 'source-layer':'transportation', minzoom:10, filter:['in',['get','class'],['literal',['rail','transit']]], paint:{'line-color':'#b3bdb7','line-width':['interpolate',['linear'],['zoom'],10,.5,18,2],'line-dasharray':[3,2]} },
  { id:'base-admin-boundary', type:'line', source, 'source-layer':'boundary', minzoom:7, filter:['in',['get','admin_level'],['literal',[4,6]]], paint:{'line-color':'#7e9486','line-width':['interpolate',['linear'],['zoom'],7,.8,11,1.4,16,2],'line-opacity':.8} },
  { id:'base-road-label', type:'symbol', source, 'source-layer':'transportation_name', minzoom:12, layout:{'symbol-placement':'line','text-field':name,'text-font':font,'text-size':['interpolate',['linear'],['zoom'],12,10,18,13],'text-max-angle':30}, paint:{'text-color':'#69796e','text-halo-color':'#fff','text-halo-width':1.5} },
  { id:'base-water-label', type:'symbol', source, 'source-layer':'water_name', layout:{'text-field':name,'text-font':font,'text-size':12}, paint:{'text-color':'#6498a4','text-halo-color':'#edf5f5','text-halo-width':1} },
  { id:'base-place-label', type:'symbol', source, 'source-layer':'place', filter:['in',['get','class'],['literal',['city','town','village','suburb','quarter','neighbourhood']]], layout:{'text-field':name,'text-font':font,'text-size':['interpolate',['linear'],['zoom'],7,11,13,14,18,16],'text-padding':12}, paint:{'text-color':'#6c7c70','text-halo-color':'#f2f4ef','text-halo-width':2} },
] as LayerSpecification[];

export function createMapStyle(archiveUrl:string,theme:'light'|'dark'='light'):StyleSpecification {
  const themed=baseLayers.map(layer=>{const next=JSON.parse(JSON.stringify(layer));if(theme==='dark'&&darkPaint[layer.id])Object.assign(next.paint,darkPaint[layer.id]);return next as LayerSpecification;});
  const geometry=themed.filter(l=>l.type!=='symbol');
  const labels=themed.filter(l=>l.type==='symbol');
  return {
    version:8,
    glyphs:'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sources:{
      openmaptiles:{type:'vector',url:'https://tiles.openfreemap.org/planet',attribution:'<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> · © <a href="https://openmaptiles.org" target="_blank" rel="noopener">OpenMapTiles</a> · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'},
      buildings:{type:'vector',url:`pmtiles://${archiveUrl}`,attribution:'建筑轮廓：用户提供的上海建筑 SHP'},
    },
    layers:[...geometry,
      {id:'building-fill',type:'fill',source:'buildings','source-layer':'buildings',minzoom:14,paint:{'fill-color':theme==='dark'?'#70827a':'#9eaead','fill-opacity':.55}},
      {id:'building-outline',type:'line',source:'buildings','source-layer':'buildings',minzoom:14,paint:{'line-color':theme==='dark'?'#adbbac':'#7c8d87','line-width':.6,'line-opacity':.8}},
      ...labels],
  };
}

type OpacityProperty='fill-opacity'|'line-opacity'|'text-opacity'|'icon-opacity';
export function baseOpacityUpdates(opacity:number):Array<{id:string;property:OpacityProperty;value:number}> {
  const keys:Record<string,OpacityProperty[]>={fill:['fill-opacity'],line:['line-opacity'],symbol:['text-opacity','icon-opacity']};
  return baseLayers.flatMap(layer=>(keys[layer.type]||[]).map(property=>({id:layer.id,property,value:opacity*Number((layer.paint as Record<string,unknown>)?.[property]??1)})));
}

const darkPaint:Record<string,Record<string,string>>={
 'base-admin-boundary':{'line-color':'#9ab5a6'},
 'base-background':{'background-color':'#192422'},'base-green':{'fill-color':'#25362e'},'base-park':{'fill-color':'#26372f'},'base-water':{'fill-color':'#111a1b'},'base-waterway':{'line-color':'#41605d'},'base-road-casing':{'line-color':'#273b37'},'base-road':{'line-color':'#526860'},'base-path':{'line-color':'#4b5e55'},'base-rail':{'line-color':'#69796c'},'base-road-label':{'text-color':'#a8b7ad','text-halo-color':'#192422'},'base-water-label':{'text-color':'#789c98','text-halo-color':'#182627'},'base-place-label':{'text-color':'#d2d6bf','text-halo-color':'#192422'}
};
export function themePaintUpdates(theme:'light'|'dark'):{id:string;property:string;value:any}[]{return baseLayers.flatMap(layer=>Object.entries((theme==='dark'?darkPaint[layer.id]:layer.paint)||{}).filter(([key])=>key.endsWith('-color')).map(([property,value])=>({id:layer.id,property,value}))).concat([{id:'building-fill',property:'fill-color',value:theme==='dark'?'#70827a':'#9eaead'},{id:'building-outline',property:'line-color',value:theme==='dark'?'#adbbac':'#7c8d87'}]);}
