import type {Geometry} from 'geojson';
export type WorkspaceSite={id:string;name:string;address?:string;district?:string;building_id?:string|number|null;[key:string]:any};
export type FootprintFocus={building_id:string;longitude:number;latitude:number;height?:number|null;geometry:Geometry};
export function searchWorkspaceSites<T extends WorkspaceSite>(sites:T[],query:string,district=''):T[]{
 const terms=query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
 return sites.filter(site=>(!district||site.district===district)&&terms.every(term=>[site.id,site.name,site.address,site.district].join(' ').toLocaleLowerCase().includes(term)));
}
export function footprintAssets<T extends Record<string,any>>(sites:T[],buildingId:string|number):T[]{return sites.filter(site=>site.building_ids?.includes(String(buildingId)) || site.building_id!==null&&site.building_id!==undefined&&String(site.building_id)===String(buildingId));}
