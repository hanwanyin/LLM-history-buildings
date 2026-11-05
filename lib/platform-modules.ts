export const platformModules={
 compute:[
  {page:'sources',zh:'数据管理',en:'Data management',status:'ready'},
  {page:'assessment',zh:'本体评价',en:'Asset assessment',status:'ready'},
  {page:'group-risk',zh:'参考空间评价',en:'Spatial assessment',status:'partial'},
  {page:'review',zh:'专家复核',en:'Expert review',status:'ready'},
 ],

} as const;
export const originalTools=[
 {page:'assessment-lab',zh:'规则配置与RAG调试',en:'Rules & RAG workbench'},
 {page:'catalog',zh:'文物档案',en:'Heritage records'},
 {page:'indicators',zh:'指标体系',en:'Indicators'},
 {page:'evidence',zh:'证据检索',en:'Evidence search'},
 {page:'results',zh:'成果核验与发布',en:'Results & publication'},
 {page:'research',zh:'资料图谱与指标标准',en:'Document graph & criteria'},
 {page:'map',zh:'建筑地图',en:'Building map'},
 {page:'statistics',zh:'数据统计',en:'Statistics'},
 {page:'knowledge',zh:'知识库结构',en:'Knowledge base'},
 {page:'architecture',zh:'平台架构',en:'Architecture'},
 {page:'method',zh:'计算口径与说明',en:'Methods & definitions'},
] as const;
