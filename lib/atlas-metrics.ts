export type Grade='all'|'high'|'medium'|'low'|'missing';
export const atlasDimensions=[
 {id:'历史价值敏感性',zh:'本底塑造',en:'Heritage value'},
 {id:'开发建设敏感性',zh:'开发建设',en:'Development'},
 {id:'活动利用敏感性',zh:'活动利用',en:'Use & activity'},
 {id:'环境污染敏感性',zh:'污染安全',en:'Pollution'},
 {id:'舆论传播敏感性',zh:'舆论引导',en:'Public discourse'},
];
export const validScore=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>=1&&value<=5;
export function scoreGrade(value:unknown):Exclude<Grade,'all'>{return !validScore(value)?'missing':value>=4?'high':value>=3?'medium':'low';}
export function dimensionScoreMap(rows:Array<{site_id:string;dimension:string;score:unknown}>,dimension:string):Record<string,number|null>{return Object.fromEntries(rows.filter(r=>r.dimension===dimension).map(r=>[r.site_id,validScore(r.score)?r.score:null]));}
export const riskColors={high:'#bf6279',medium:'#c6a85d',low:'#4e95a5',missing:'#81908e'};
