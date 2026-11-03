export const platformModules={
 compute:[
  {page:'sources',zh:'数据管理',en:'Data management',status:'ready'},
  {page:'assessment',zh:'本体评价',en:'Asset assessment',status:'ready'},
  {page:'group-risk',zh:'建筑群风险计算',en:'Building-group risk',status:'model'},
  {page:'propagation',zh:'渗流分析与范围识别',en:'Percolation & extents',status:'model'},
  {page:'results',zh:'成果核验与发布',en:'Review & publication',status:'partial'},
 ],

} as const;
export const originalTools=[
 {page:'catalog',zh:'文物档案',en:'Heritage records'},
 {page:'indicators',zh:'指标体系',en:'Indicators'},
 {page:'evidence',zh:'证据检索',en:'Evidence search'},
 {page:'review',zh:'专家复核',en:'Expert review'},
 {page:'sources',zh:'上传 / Agent',en:'Upload / agent'},
 {page:'map',zh:'建筑地图',en:'Building map'},
 {page:'statistics',zh:'数据统计',en:'Statistics'},
 {page:'knowledge',zh:'知识库结构',en:'Knowledge base'},
 {page:'architecture',zh:'平台架构',en:'Architecture'},
] as const;
