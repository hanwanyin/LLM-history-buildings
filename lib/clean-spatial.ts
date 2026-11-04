import baseline from '../data/clean-spatial.json';
type Row=Record<string,any>;
export function effectiveSpatial(id:string,persisted:Row|null|undefined):Row|null {
 const source=(baseline as Record<string,Row>)[id];
 if(!source)return persisted||null;
 // Previous-SHP overrides remain in storage but cannot override the new geometry version.
 if(persisted&&persisted.revision>1000&&String(persisted.building_id||'').startsWith('c'))return {...source,...persisted,building_ids:[persisted.building_id]};
 return source;
}
export function cleanBootstrapSite(site:Row):Row{const s=effectiveSpatial(site.id,{...site,revision:site.match_revision,status:site.match_status,longitude:site.map_lon,latitude:site.map_lat});return s?{...site,map_lon:s.longitude,map_lat:s.latitude,match_status:s.status,distance_m:s.distance_m,building_id:s.building_id,building_ids:s.building_ids,spatial_source:s.source,check_note:s.check_note}:site;}
