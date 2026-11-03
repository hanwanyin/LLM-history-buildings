# HERISK · 文垣智评

## 知识库与平台结构

HERISK 知识库以文物资源为核心组织单元，将基础档案、空间位置、评价指标、原始证据和补充资料建立可追溯的关联。它既保存资料本身，也记录资料如何支持某一项判断：来自哪个文件或网页、位于哪一行或哪一段、何时获取、是否经过审核。知识图谱是这些关联的可视化表达，知识库则是保存、检索和维护证据的基础。

## 知识如何生成与更新

平台首先归档 Excel、CSV 和建筑空间数据，保留原文件、校验值与行号；随后以文物编号连接档案、五维评价和建筑候选，保留缺失值及来源差异；再组织“文物—属性—指标—证据—来源”关系，形成可检索的知识库和可交互图谱。新增文件与检索 Agent 发现的资料先进入待审核区，由管理员核对内容、来源及文物关联后公开入库。补充资料不会自动替代原始评分，也不会把名称相似或空间近邻当作已证实的历史关系。

1. **资料接入** — 原始表格、SHP 建筑、个人上传与权威来源检索。
2. **知识组织** — 文物编号关联、来源定位、缺失标识与关系图谱。
3. **评价与核验** — 五维指标、原始证据、专家修正与补充资料审核。
4. **规划响应支持** — 定位重点对象、追溯判断依据、导出档案用于研究讨论。

## 如何支持规划响应

平台将历史价值、活动利用、开发建设、环境污染和舆论传播五个敏感性维度与证据链连接，用于识别资料缺口、确定核查重点，并为保护、利用和规划讨论提供依据。“规划响应”是基于证据开展研判的工作方向；当前评分是描述性评价，不自动生成法定保护范围、建设许可结论或规划审批意见。

## 当前功能范围

当前 Agent 已接入上海博物馆官方检索和 Crossref 学术元数据检索。它执行查询、来源记录和去重，不是覆盖全网的政府资料搜索，也不自动推断事实或生成新分值。原始中文资料保持原文，英文界面翻译操作与分类名称。

---

# Heritage Resilience & Intervention Spatial Knowledge platform · HERISK

## Knowledge base & platform structure

HERISK organizes information around heritage assets, connecting archive records, spatial locations, assessment indicators, original evidence and supplementary sources. It preserves both the material and its provenance: which file or webpage supports a statement, where the evidence appears, when it was retrieved and whether it has been reviewed. The knowledge graph visualizes these relationships; the knowledge base supports their storage, retrieval and maintenance.

## How knowledge is generated and updated

The workflow begins by archiving Excel, CSV and building geometry data with original files, checksums and row references. Heritage identifiers then connect profiles, five assessment dimensions and candidate building matches, while preserving missing values and discrepancies. Asset–attribute–indicator–evidence–source relationships form the searchable knowledge base and interactive graph. Uploaded files and sources discovered by the retrieval agent enter a review queue. An administrator verifies the material, provenance and asset association before publication. Supplementary material does not overwrite source scores; a similar name or nearby footprint does not establish a historical relationship.

1. **Source intake** — Original tables, SHP buildings, user uploads and authoritative-source discovery.
2. **Knowledge organization** — Heritage identifiers, source locations, missing-data flags and graph relationships.
3. **Assessment & review** — Five dimensions, original evidence, expert corrections and source review.
4. **Planning support** — Identify assets for attention, trace the evidence and export research records.

## How it supports planning

The platform connects evidence to five sensitivity dimensions: historical value, use and activity, development and construction, environmental pollution, and public communication. These links help identify information gaps, prioritize verification and support conservation, reuse and planning discussions. Planning response is an evidence-informed research workflow: current descriptive assessments do not automatically define statutory protection boundaries, grant construction permission or constitute planning approval.

## Current capabilities

The retrieval agent currently uses Shanghai Museum’s official search and Crossref scholarly metadata. It queries sources, records provenance and removes duplicates. It is not a comprehensive government web search and does not infer facts or generate new scores. Original Chinese records remain in their source language; controls and classification labels are available in English.
