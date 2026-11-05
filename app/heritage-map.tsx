'use client';
import { Localized, LocaleProvider, LanguageSwitch, useLocale, translateUI, brand } from '../lib/i18n';
import { useEffect, useRef, useState } from 'react';
import type { Map as LibreMap, GeoJSONSource } from 'maplibre-gl';
import { createMapStyle, baseOpacityUpdates, themePaintUpdates } from '../lib/map-style';
import 'maplibre-gl/dist/maplibre-gl.css';
import { api, assetUrl } from '../lib/client-data';
import { loadBuildingManifest, loadBuildings, buildingCollection, type BuildingManifest } from '../lib/building-parquet';
import { MapPin, ArrowUpRight, RotateCcw } from 'lucide-react';
import {useTheme} from '../lib/theme';
import {riskColors,scoreGrade} from '../lib/atlas-metrics';
import {footprintAssets,type FootprintFocus} from '../lib/workspace-focus';
type Row=Record<string,any>;
const EMPTY_BUILDINGS={type:'FeatureCollection' as const,features:[]};
const BUILDING_MIN_ZOOM=14;
const emptyScores:Record<string,number|null>={};
const matchLabels:Record<string,string>={inside:'原始点在建筑面内',candidate:'近邻建筑候选 · 待核查',overlap:'落在重叠建筑面 · 待核查',unmatched:'120米内未找到建筑',confirmed:'管理员已确认关联',source:'清理后SHP属性关联'};
export default function HeritageMap({sites,onSelect,selectedId,admin=false,onUpdated,explorer=false,riskScores=emptyScores,colorByScore=false,resetKey=0,linkedSites,onSelectBuilding,focusedBuilding,focusRevision=0}:{sites:Row[];onSelect:(id:string)=>void;selectedId?:string;admin?:boolean;onUpdated?:()=>void;explorer?:boolean;riskScores?:Record<string,number|null>;colorByScore?:boolean;resetKey?:number;linkedSites?:Row[];onSelectBuilding?:(building:FootprintFocus)=>void;focusedBuilding?:FootprintFocus|null;focusRevision?:number}){
  const {theme}=useTheme();
  const [showLabels,setShowLabels]=useState(false),[showBoundaries,setShowBoundaries]=useState(true);
  const {locale}=useLocale(),localeRef=useRef(locale);localeRef.current=locale;
  const el=useRef<HTMLDivElement>(null),mapRef=useRef<LibreMap|null>(null),sitesRef=useRef(sites),openRef=useRef(onSelect),selectRef=useRef<(id:string)=>void>(()=>{});
  const [ready,setReady]=useState(false),[error,setError]=useState(''),[mapError,setMapError]=useState(''),[picked,setPicked]=useState<Row|null>(null),[match,setMatch]=useState<Row|null>(null),[zoom,setZoom]=useState(10),[showBuildings,setShowBuildings]=useState(true),[showOriginal,setShowOriginal]=useState(false),[opacity,setOpacity]=useState(.8),[base,setBase]=useState(true),[candidate,setCandidate]=useState(''),[note,setNote]=useState(''),[saving,setSaving]=useState(false);
  const pending=useRef<AbortController|null>(null);
  const linkedRef=useRef(linkedSites||sites),buildingRef=useRef(onSelectBuilding);linkedRef.current=linkedSites||sites;buildingRef.current=onSelectBuilding;
  sitesRef.current=sites;openRef.current=onSelect;
  useEffect(()=>{let alive=true;let resize:ResizeObserver|undefined;
    (async()=>{const lib=await import('maplibre-gl');if(!alive||!el.current)return;
      lib.setWorkerUrl(assetUrl('maplibre/worker.mjs'));
      const map=new lib.Map({container:el.current,center:[121.47,31.15],zoom:explorer?8.4:10,minZoom:4,maxZoom:20,attributionControl:{compact:true},style:createMapStyle(theme)});
      mapRef.current=map;map.addControl(new lib.NavigationControl({showCompass:true}),explorer?'bottom-right':'top-right');map.addControl(new lib.ScaleControl({unit:'metric'}),'bottom-left');
      map.on('error',e=>{if(!alive)return;if((e as unknown as {sourceId?:string}).sourceId==='openmaptiles')setMapError('开源底图暂未加载，可继续查看建筑和文物图层。');else if((e as unknown as {sourceId?:string}).sourceId==='buildings')setMapError('建筑图层正在加载或暂不可用，请稍后重试。');});
      map.on('zoomend',()=>{if(alive)setZoom(map.getZoom());});
      map.on('load',()=>{if(!alive)return;
        const empty:any={type:'FeatureCollection',features:[]};
        for(const id of ['heritage','originals','selected-building','selected-line'])map.addSource(id,{type:'geojson',data:empty});
        map.addSource('buildings',{type:'geojson',data:empty});
        map.addLayer({id:'building-fill',type:'fill',source:'buildings',minzoom:BUILDING_MIN_ZOOM,paint:{'fill-color':theme==='dark'?'#70827a':'#9eaead','fill-opacity':.55}},'base-road-label');
        map.addLayer({id:'building-outline',type:'line',source:'buildings',minzoom:BUILDING_MIN_ZOOM,paint:{'line-color':theme==='dark'?'#adbbac':'#7c8d87','line-width':.6,'line-opacity':.8}},'base-road-label');
        map.addLayer({id:'selected-building-fill',type:'fill',source:'selected-building',paint:{'fill-color':'#139681','fill-opacity':.48}},'base-road-label');
        map.addLayer({id:'selected-building-line',type:'line',source:'selected-building',paint:{'line-color':'#05705f','line-width':2.2}},'base-road-label');
        map.addLayer({id:'originals',type:'circle',source:'originals',layout:{visibility:'none'},paint:{'circle-radius':4,'circle-color':'#667389','circle-stroke-color':'#fff','circle-stroke-width':1}});
        map.addLayer({id:'selected-line',type:'line',source:'selected-line',paint:{'line-color':'#a57745','line-width':1.5,'line-dasharray':[3,3]}});
        map.addLayer({id:'heritage',type:'circle',source:'heritage',paint:{'circle-radius':['interpolate',['linear'],['zoom'],9,3.7,16,7],'circle-color':['match',['get','status'],'inside','#166c62','confirmed','#166c62','source','#166c62','candidate','#b78339','overlap','#b78339','#7b8698'],'circle-stroke-color':'#fff','circle-stroke-width':1.3}});
        map.addLayer({id:'heritage-labels',type:'symbol',source:'heritage',minzoom:12,layout:{visibility:'none','text-field':['get','name'],'text-font':['Noto Sans Regular'],'text-size':11,'text-offset':[0,1.4],'text-anchor':'top'},paint:{'text-color':'#687b70','text-halo-color':'#f7f8f2','text-halo-width':1.5}});
        map.on('mouseenter','heritage',()=>{map.getCanvas().style.cursor='pointer';});map.on('mouseleave','heritage',()=>{map.getCanvas().style.cursor='';});
        map.on('click','heritage',e=>{const id=e.features?.[0]?.properties?.id;if(id){if(explorer)openRef.current(String(id));else selectRef.current(String(id));}});
        map.on('click','building-fill',e=>{if(map.queryRenderedFeatures(e.point,{layers:['heritage']}).length)return;const feature=e.features?.[0],p=feature?.properties;if(!feature||p?.building_id==null)return;
          if(explorer){
            const matches=footprintAssets(linkedRef.current,String(p.building_id));
            if(matches.length===1){openRef.current(matches[0].id);return;}
            if(matches.length>1){const menu=document.createElement('div');const title=document.createElement('strong');title.textContent=localeRef.current==='en'?'Choose an associated heritage record':'该建筑关联多处文物，请选择';menu.appendChild(title);const popup=new lib.Popup().setLngLat(e.lngLat).setDOMContent(menu).addTo(map);for(const site of matches){const button=document.createElement('button');button.textContent=site.name+' · '+site.id;button.style.cssText='display:block;margin-top:8px;white-space:normal';button.addEventListener('click',()=>{openRef.current(site.id);popup.remove();});menu.appendChild(button);}return;}
            if(buildingRef.current){buildingRef.current({building_id:String(p.building_id),longitude:e.lngLat.lng,latitude:e.lngLat.lat,height:typeof p.height==='number'?p.height:null,geometry:feature.geometry});return;}
          }
          const content=document.createElement('div');const title=document.createElement('strong');title.textContent=(localeRef.current==='en'?'Building footprint · SHP ':'建筑轮廓 · SHP ')+String(p?.building_id??'');const small=document.createElement('p');small.textContent=localeRef.current==='en'?'Source: 全部建筑地块_含文物属性_SHP.zip. Footprints do not define heritage protection boundaries.':'来源：全部建筑地块_含文物属性_SHP.zip；建筑面不等于文物保护范围。';content.appendChild(title);content.appendChild(small);new lib.Popup().setLngLat(e.lngLat).setDOMContent(content).addTo(map);});
        setReady(true);
      });
      resize=new ResizeObserver(()=>map.resize());resize.observe(el.current);
    })().catch(e=>{if(alive)setError('地图初始化失败：'+e.message);});
    return()=>{alive=false;resize?.disconnect();pending.current?.abort();mapRef.current?.remove();mapRef.current=null;};
  },[]);
  useEffect(()=>{const map=mapRef.current;if(!ready||!map)return;let alive=true,timer:any=null,controller:AbortController|null=null,manifest:BuildingManifest|null=null;
    // Footprints come from the cleaned-SHP GeoParquet tiles under the view only.
    const load=async()=>{controller?.abort();controller=new AbortController();const source=map.getSource('buildings') as GeoJSONSource|undefined;if(!source)return;
      if(map.getZoom()<BUILDING_MIN_ZOOM){source.setData(EMPTY_BUILDINGS as any);return;}
      const b=map.getBounds();
      try{manifest??=await loadBuildingManifest();const features=await loadBuildings(manifest,[[b.getWest(),b.getSouth()],[b.getEast(),b.getNorth()]],controller.signal);if(!alive||controller.signal.aborted)return;source.setData(buildingCollection(features) as any);}
      catch(e){if((e as Error).name!=='AbortError')setMapError('建筑 GeoParquet 分块暂未加载，请放大地图后重试。');}};
    const schedule=()=>{clearTimeout(timer);timer=setTimeout(load,140);};
    map.on('moveend',schedule);map.on('zoomend',schedule);load();
    return()=>{alive=false;clearTimeout(timer);controller?.abort();map.off('moveend',schedule);map.off('zoomend',schedule);};},[ready]);
  useEffect(()=>{const map=mapRef.current;if(!ready||!map)return;
    const valid=sites.filter(s=>Number.isFinite(s.longitude)&&Number.isFinite(s.latitude));
    (map.getSource('heritage') as GeoJSONSource).setData({type:'FeatureCollection',features:valid.map(s=>({type:'Feature',geometry:{type:'Point',coordinates:[s.map_lon??s.longitude,s.map_lat??s.latitude]},properties:{id:s.id,status:s.match_status||'unmatched',name:s.name,risk:riskColors[scoreGrade(riskScores[s.id])]}}))});
    (map.getSource('originals') as GeoJSONSource).setData({type:'FeatureCollection',features:valid.map(s=>({type:'Feature',geometry:{type:'Point',coordinates:[s.longitude,s.latitude]},properties:{id:s.id}}))});
    if(!explorer&&selectedId)selectRef.current(selectedId);else if(!selectedId&&valid.length&&(explorer||valid.length<30)){const xs=valid.map(s=>s.map_lon??s.longitude),ys=valid.map(s=>s.map_lat??s.latitude);map.fitBounds([[Math.min(...xs),Math.min(...ys)],[Math.max(...xs),Math.max(...ys)]],{padding:explorer?{top:110,bottom:80,left:25,right:25}:60,maxZoom:valid.length<30?16:9,duration:500});}
  },[ready,sites,selectedId,riskScores,resetKey]);
  useEffect(()=>{if(ready&&explorer&&selectedId)selectRef.current(selectedId);if(ready&&explorer&&!selectedId){setMatch(null);setPicked(null);pending.current?.abort();(mapRef.current?.getSource('selected-building') as GeoJSONSource)?.setData({type:'FeatureCollection',features:[]});(mapRef.current?.getSource('selected-line') as GeoJSONSource)?.setData({type:'FeatureCollection',features:[]});}},[ready,selectedId,focusRevision,focusedBuilding]);
  useEffect(()=>{const map=mapRef.current;if(!ready||!map||!focusedBuilding)return;pending.current?.abort();(map.getSource('selected-building') as GeoJSONSource)?.setData({type:'Feature',geometry:focusedBuilding.geometry,properties:{}});map.flyTo({center:[focusedBuilding.longitude,focusedBuilding.latitude],zoom:18,duration:700});},[ready,focusedBuilding,focusRevision]);
  useEffect(()=>{if(ready&&explorer)mapRef.current?.setPaintProperty('heritage','circle-color',colorByScore?['get','risk']:'#4e8d7e');},[ready,colorByScore,explorer]);
  useEffect(()=>{if(ready)mapRef.current?.setLayoutProperty('heritage-labels','visibility',showLabels?'visible':'none');},[ready,showLabels]);
  useEffect(()=>{if(!ready)return;for(const update of themePaintUpdates(theme))mapRef.current?.setPaintProperty(update.id,update.property as any,update.value);mapRef.current?.setPaintProperty('heritage-labels','text-color',theme==='dark'?'#d5dfce':'#405b4d');mapRef.current?.setPaintProperty('heritage-labels','text-halo-color',theme==='dark'?'#172522':'#f7f8f2');},[theme,ready]);
  selectRef.current=async(id:string)=>{const map=mapRef.current;if(!map)return;const site=sitesRef.current.find(s=>s.id===id);if(!site)return;pending.current?.abort();const ctrl=new AbortController();pending.current=ctrl;setPicked(site);setMatch(null);setNote('');setCandidate('');(map.getSource('selected-building') as GeoJSONSource)?.setData({type:'FeatureCollection',features:[]});(map.getSource('selected-line') as GeoJSONSource)?.setData({type:'FeatureCollection',features:[]});map.flyTo({center:[site.map_lon??site.longitude,site.map_lat??site.latitude],zoom:18,duration:700});
    try{const d=await api('map/match/'+encodeURIComponent(id),{signal:ctrl.signal});setMatch(d);setCandidate(d.building_id||'');if(d.geometry){(map.getSource('selected-building') as GeoJSONSource).setData({type:'Feature',geometry:JSON.parse(d.geometry),properties:{}});(map.getSource('selected-line') as GeoJSONSource).setData({type:'Feature',geometry:{type:'LineString',coordinates:[[d.original_lon,d.original_lat],[d.longitude,d.latitude]]},properties:{}});}}catch(e){if((e as Error).name!=='AbortError')setMapError((e as Error).message);}
  };
  useEffect(()=>{if(ready)for(const id of ['building-fill','building-outline','selected-building-fill','selected-building-line'])mapRef.current?.setLayoutProperty(id,'visibility',showBuildings?'visible':'none');},[showBuildings,ready]);
  useEffect(()=>{if(ready)mapRef.current?.setLayoutProperty('base-admin-boundary','visibility',showBoundaries?'visible':'none');},[ready,showBoundaries]);
  useEffect(()=>{if(ready)mapRef.current?.setLayoutProperty('originals','visibility',showOriginal?'visible':'none');},[showOriginal,ready]);
  useEffect(()=>{if(ready)for(const update of baseOpacityUpdates(base?opacity:0))mapRef.current?.setPaintProperty(update.id,update.property,update.value);},[opacity,base,ready]);
  async function confirmMatch(){if(!picked||!match)return;setSaving(true);try{const r=await fetch('/api/spatial-confirm',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({site_id:picked.id,building_id:candidate,revision:match.revision,note})});const d=await r.json() as Row;if(!r.ok)throw Error(d.error);setMapError('建筑关联已保存。');onUpdated?.();selectRef.current(picked.id);}catch(e){setMapError((e as Error).message);}finally{setSaving(false);}}
  useEffect(()=>{if(!ready)return;const names:any=['coalesce',['get',locale==='en'?'name:en':'name:zh'],['get','name'],['get','name:latin']];for(const id of ['base-road-label','base-water-label','base-place-label'])mapRef.current?.setLayoutProperty(id,'text-field',names);},[locale,ready]);
  const candidates:Row[]=match?JSON.parse(match.candidates):[];
  return <Localized><div className={"heritage-map-wrapper "+(explorer?"atlas-map-engine":"")}><div className="map-layer-toolbar"><label><input type="checkbox" checked={base} onChange={e=>setBase(e.target.checked)}/>道路水系底图（无建筑）</label><label className="opacity-label">透明度<input aria-label="底图透明度" type="range" min="0" max="1" step=".1" value={opacity} onChange={e=>setOpacity(Number(e.target.value))}/></label><label><input type="checkbox" checked={showBuildings} onChange={e=>setShowBuildings(e.target.checked)}/>SHP 建筑</label><label><input type="checkbox" checked={showOriginal} onChange={e=>setShowOriginal(e.target.checked)}/>原始点位</label>{explorer&&<label><input type="checkbox" checked={showBoundaries} onChange={e=>setShowBoundaries(e.target.checked)}/>{locale==='en'?'Boundaries':'边界线'}</label>}{explorer&&<label><input type="checkbox" checked={showLabels} onChange={e=>setShowLabels(e.target.checked)}/>{locale==='en'?'Asset labels':'文物标签'}</label>}<button className="text-link" onClick={()=>{mapRef.current?.flyTo({center:[121.47,31.23],zoom:10,duration:600});setPicked(null);setMatch(null);}}><RotateCcw size={13}/>上海全域</button></div><div ref={el} className="heritage-map-canvas" aria-label="可缩放的上海文物与建筑地图" data-focused-site={selectedId||''} data-focused-building={focusedBuilding?.building_id||match?.building_id||''} data-zoom={zoom.toFixed(1)}/>{error&&<div className="alert">{error}</div>}<div className="geographic-legend"><span><i className="green-dot"/>面内关联 / 已确认</span><span><i className="amber-dot"/>近邻候选，待核查</span><span><i className="grey-dot"/>未匹配</span><small>{zoom<14?'放大至14级显示157万建筑轮廓':`当前缩放 ${zoom.toFixed(0)} 级`}</small></div>{mapError&&<div className="map-warning">{mapError}<button className="text-link" onClick={()=>setMapError('')}>关闭</button></div>}{picked&&!explorer&&<div className="map-selection"><div className="map-selection-head"><div><strong><MapPin size={16}/>{picked.name}</strong><small>{picked.id} · {picked.district} · {picked.address}</small></div><button className="text-link" onClick={()=>openRef.current(picked.id)}>查看档案<ArrowUpRight size={14}/></button></div>{match?<><p><span className={'badge '+(['inside','confirmed','source'].includes(match.status)?'green':'amber')}>{matchLabels[match.status]||match.status}</span>{match.building_id&&<span>建筑 SHP {match.building_id} · 原始点距建筑面 {Number(match.distance_m).toFixed(1)} 米</span>}</p><p>{match.check_note && `检查表备注：${match.check_note}`}</p><small className="muted">{match.status==='candidate'?'显示点已放到候选建筑内部；几何近邻不能证明建筑身份，请结合地址和资料复核。':match.status==='unmatched'?'保留原始点位。遗址、桥梁、墓葬等可能没有对应建筑面。':'保留原始坐标；清理后属性关联可包含多个建筑面，不等同于文物保护范围。'}</small>{admin&&candidates.length>0&&<details className="spatial-review"><summary>管理员核查建筑关联</summary><label>选择预计算候选<select aria-label="候选建筑" value={candidate} onChange={e=>{setCandidate(e.target.value);const c=candidates.find(c=>c.building_id===e.target.value);if(c)(mapRef.current?.getSource('selected-building') as GeoJSONSource)?.setData({type:'Feature',geometry:c.geometry,properties:{}});}}>{candidates.map(c=><option key={c.building_id} value={c.building_id}>SHP {c.building_id} · 距离 {c.distance_m} 米</option>)}</select></label><label>确认依据<input aria-label="建筑关联确认依据" value={note} onChange={e=>setNote(e.target.value)} placeholder="例如：依据现场照片、档案位置核对" maxLength={2000}/></label><button className="primary" disabled={!note.trim()||saving} onClick={confirmMatch}>{saving?'正在保存…':'确认建筑关联'}</button></details>}</>:<p className="muted">正在读取建筑关联…</p>}</div>}<div className="map-source-note">底图不含建筑块；建筑轮廓仅来自全部建筑地块_含文物属性_SHP.zip。WGS84 经纬度统一投影显示。 <a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noreferrer">报告底图问题</a></div></div></Localized>;
}
