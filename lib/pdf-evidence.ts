export type PdfEvidence={id:string;doc_id:string;source_name:string;pdf_sha256:string;page:number;quote:string;kind?:string;condition?:string;verification:string;status:string;claim_ids:string[];chunk_uids:string[];concepts:string[]};
export type EvidenceCorpus={source:string;documents:number;matched_claims:number;excluded_claims:number;unique_excerpts:number;records:PdfEvidence[]};
export type IndicatorEvidencePlan={fields:string[];terms:string[];question:string;needs:string};
const plan=(fields:string,terms:string,question:string,needs:string):IndicatorEvidencePlan=>({fields:fields.split(' '),terms:terms.split('|'),question,needs});
// Explicit retrieval vocabulary, not approved score rules. It must never assign a score.
const plans:Record<string,IndicatorEvidencePlan>={
 '历史事件/人物关联':plan('name type structure','历史事件|历史人物|人物关联|事件关联|historical association|associated person','哪些资料可以支持对象的事件、人物或纪念关联？','对象专属档案、人物事件出处及关联部位'),
 '物质要素独特性':plan('material structure type','稀缺|独特|代表性|authenticity|uniqueness|rarity','哪些物质要素及工艺具有不可替代性？','同类建筑比较、工艺调查及保留程度'),
 '年代':plan('age','年代|建造年代|dating|age of|period of construction','建造、改建和维修年代是否有文献证明？','建造年代出处、历次改扩建记录'),
 '文保等级':plan('level type','文物保护单位|保护等级|保护级别|designation|listed building','保护认定及其管理要求如何与对象对应？','公布名录、批次及保护对象范围'),
 '原真性不可恢复性':plan('material condition structure','原真性|真实性|不可逆|authenticity|irreversib','哪些原有材料或工艺在扰动后难以恢复？','原有与替换构件清单、修缮记录'),
 '系统完整性':plan('structure condition','完整性|整体性|integrity|wholeness','本体、附属构件与环境联系是否完整？','构件缺失、环境变更与调查图'),
 '开放状态':plan('opening tourism','开放|游客|参观|visitor|tourism','开放方式可能形成哪些人类活动压力？','开放时间、人数和管理方式'),
 '可进入程度':plan('opening structure','可进入|进入|accessibility|access|visitor access','人流能进入哪些空间，进入是否受控？','通道、限制区域、进入记录'),
 '游览空间承载性':plan('opening structure tourism','承载量|游客密度|拥挤|carrying capacity|crowding|visitor density','空间容量与客流压力应如何核查？','可游览面积、峰值客流、通行宽度与疏散条件'),
 '本体可接触性':plan('opening material structure','触摸|接触|踩踏|touch|trampling|physical contact','游客接触本体是否形成损伤途径？','可接触部位、隔离设施与行为观察'),
 '材料磨损敏感性':plan('material condition opening','磨损|磨蚀|踩踏|abrasion|wear|trampling','材料磨损机理是否适用于当前构件？','材料检测、磨损部位、接触强度'),
 '空间封闭性':plan('structure opening','封闭|通风|室内|ventilation|indoor|enclosed','空间封闭及通风如何影响扰动积累？','空间体积、通风方式与温湿度监测'),
 '微环境敏感材料':plan('material condition','湿度|微环境|温湿度|microclimate|relative humidity|hygroscopic','材料是否对温湿度变化敏感？','材料组成、波动幅度与持续时间'),
 '活动类型复杂性':plan('opening tourism type','活动|商业|旅游|commercial|tourism|visitor behaviour','多种利用活动是否叠加干扰？','实际活动清单、频率、使用强度'),
 '年代久远程度':plan('age condition','老化|劣化|古建筑|aging|deterioration|historic structure','年代与实际劣化是否得到分别核查？','建造年代、维修加固和现状检测'),
 '结构类型':plan('structure material condition','木结构|砌体|砖木|结构|masonry|timber|structural','结构体系如何响应振动和变形？','受力体系、基础形式、裂缝和结构检测'),
 '建筑体量与结构刚度':plan('structure material','刚度|自振|振动|stiffness|vibration|frequency','体量、刚度与外部振动是否匹配？','高度、体量、模态及现场振动测量'),
 '空间格局关联性':plan('structure address','空间格局|街巷|历史环境|setting|urban fabric|spatial','哪些空间联系可能受建设活动扰动？','街巷、院落、周边建筑与工程位置'),
 '历史风貌依赖性':plan('structure address type','风貌|景观|视廊|landscape|visual impact|setting','环境和视线变化是否影响对象特征？','视线分析、周边高度与风貌调查'),
 '材料类型':plan('material condition','材料|污染|腐蚀|material|pollutant|corrosion','污染侵蚀机理是否匹配对象材料？','材料组成、表面处理及污染暴露'),
 '外立面/外露构件暴露程度':plan('material structure address','暴露|外立面|沉降|exposure|facade|deposition','外露部位承受何种环境污染？','构件朝向、遮蔽、暴露面积与污染监测'),
 '装饰复杂度':plan('material structure','装饰|雕刻|积尘|ornament|carving|soiling','复杂装饰是否增加积尘及清理难度？','装饰构件、细部几何、积尘与病害调查'),
 '水分敏感材料或构件':plan('material condition structure','水分|潮湿|湿度|盐|moisture|damp|humidity|salt','水湿作用是否可能诱发材料损伤？','含水率、渗漏、排水及盐害检测'),
 '红色文化属性':plan('name type structure','革命|红色文化|革命文物|commemorative building|memorial building','纪念或教育属性有哪些可核验依据？','对象专属认定与事件档案；传播数据另行核查'),
 '名人故居属性':plan('name type structure','名人故居|人物|former residence|famous person','故居认定及人物关联有何直接资料？','居住事实、年代、公布名录和专门档案'),
 '城市地标性':plan('name type address','地标|城市形象|landmark|city image','地标认知是否有调查或公布资料支持？','城市认知调查与对象专属传播资料'),
 '视觉识别性':plan('structure material type','视觉|识别|景观|visual|recognition|landmark','外观识别特征是否有图像或调查支撑？','影像资料、识别调查与传播样本'),
};
export function evidencePlan(indicator:string):IndicatorEvidencePlan{return plans[indicator]||plan('name type material structure',indicator,'检索与该指标直接相关的文献依据。','指标定义、对象调查与审核通过的评分锚点');}
export const fieldLabels:Record<string,[string,string]>={name:['文物名称','Asset name'],type:['文物类型','Asset type'],material:['材料','Material'],structure:['结构','Structure'],condition:['保存状态','Condition'],opening:['开放情况','Access'],tourism:['旅游利用','Tourism'],age:['年代','Age'],level:['保护等级','Designation'],address:['地址','Address']};
const materialWords:Record<string,string[]>={'木':['木','timber','wood'],'砖':['砖','brick','masonry'],'石':['石','stone'],'混凝土':['混凝土','concrete'],'金属':['金属','metal'],'土':['土','earthen','earth']};
// Indicators whose literature coverage is thin fall back to dimension-level
// context. The UI labels these as related context, never as asset-specific
// evidence, and they never influence a score.
const contextFallback:Record<string,string[]>={
 '历史事件/人物关联':['历史','事件','人物','event','person','history','commemorat','memorial','heritage'],
 '物质要素独特性':['独特性','authenticity','significance','value','heritage','historic building'],
 '红色文化属性':['纪念','革命','教育','interpretation','education','cultural','heritage','commemorat'],
 '名人故居属性':['故居','人物','person','historic building','domestic','heritage'],
 '城市地标性':['地标','城市','landmark','icon','image','perception','tourism','city'],
 '视觉识别性':['视觉','识别','visual','image','perception','landmark'],
 '材料磨损敏感性':['磨损','abrasion','wear','trampling','erosion','scratch','material'],
};

export function retrievePdfEvidence(records:PdfEvidence[],indicator:string,site:Record<string,any>,query='',limit=12){
 const config=evidencePlan(indicator);
 const materials=Object.entries(materialWords).filter(([word])=>String(site.material||'').includes(word)).flatMap(([,aliases])=>aliases);
 const contextTerms:Record<string,string[]>={
  '游览空间承载性':['visitor','touris','crowd','游客','游览','参观'],
  '材料类型':['pollut','corrosion','degradation','weathering','污染','腐蚀','劣化','侵蚀'],
  '年代':['建造','建筑','文物','construction','building','heritage','monument'],
  '开放状态':['游客','参观','开放','visitor','touris','access'],
  '可进入程度':['游客','参观','进入','visitor','touris','access']
 };
 const required=query.trim()?[]:(contextTerms[indicator]||[]);
 const rank=(terms:string[])=>{
  const candidates=records.map(r=>{const text=[r.quote,...r.concepts].join(' ').toLowerCase(),matched=terms.filter(t=>text.includes(t)),assetMention=String(site.name||'').length>2&&text.includes(String(site.name).toLowerCase()),materialMatches=materials.filter(t=>text.includes(t));return {...r,matched_terms:matched,material_matches:materialMatches,asset_mentioned:assetMention,rank:matched.length*3+materialMatches.length+Number(assetMention)*12+(evidenceSourcePriority(r))};}).filter(r=>r.matched_terms.length>0&&(!required.length||required.some(t=>[r.quote,r.source_name,...r.concepts].join(' ').toLowerCase().includes(t)))).sort((a,b)=>b.rank-a.rank||a.id.localeCompare(b.id));
  // Diversity is explicit, not a fabricated semantic similarity/confidence score.
  const first:typeof candidates=[],rest:typeof candidates=[],seen=new Set<string>();for(const c of candidates){if(seen.has(c.doc_id))rest.push(c);else{seen.add(c.doc_id);first.push(c);}}
  return {candidates,first,rest,seen};
 };
 let terms=query.trim()?query.trim().toLowerCase().split(/\s+/):config.terms.map(t=>t.toLowerCase());
 let run=rank(terms),fallback=false;
 if(!run.candidates.length&&!query.trim()){
  const fb=(contextFallback[indicator]||[]).map(t=>t.toLowerCase());
  if(fb.length){terms=fb;run=rank(fb);fallback=run.candidates.length>0;}
 }
 return {terms,total:run.candidates.length,documents:run.seen.size,results:[...run.first,...run.rest].slice(0,limit),fallback};
}

function evidenceSourcePriority(r:PdfEvidence){return /规范|导则|评估方法/.test(r.source_name)?5:0;}
