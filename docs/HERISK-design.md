# HERISK · 文垣智评

文物风险评估计算工作台。保留菱形徽标、深绿/暖白双主题、金色强调、标题下版权、中英文切换与平台名片弹窗。

## 计算工作流

仅保留计算端：数据管理 → 本体评价 → 建筑群风险计算 → 渗流分析与范围识别 → 成果核验与发布。顶部是唯一导航区，列出五个计算模块，以及档案、指标、证据、专家复核、建筑地图、数据统计、知识库、架构和计算口径。上传/Agent 由数据管理进入；移除重复侧边栏以及品牌栏里的重复首页/知识库入口。小屏顶部导航横向滚动，保留所有模块入口。无规划展示应用端。

## 首页

顶部六项全库统计：文物档案、指标评分、明细覆盖、缺失评分、建筑几何关联、专家复核。详细统计可展开查看五维均值和数据质量。

下方左侧为大幅上海建筑地图，右侧为接近正方形的知识图谱。统一搜索文物名称、行政区、地址或编号；两个视图共享检索范围与选中对象。图谱文物/建筑节点定位地图，地图点位/建筑轮廓同步更新图谱。分类节点同步筛选关联档案。档案页只呈现记录，不再重复放置图谱。

同一轮廓匹配多个档案时提供列表选择。未关联文物的普通 SHP 建筑只显示实际建筑 ID、原始高度字段和来源，不生成虚构文物属性或风险。候选关联与已确认关联明确区分。

## 数据口径

763 处文物对象（767 条源点位记录，4 条重复点位已合并）、20,250 条 Excel 指标记录、27 项指标、五个维度、6 份来源。数据使用当前数据库或标有日期的公开快照，不硬编码复核结果。地图为 CSV 原始敏感性分值：4—5 高、3 中、1—2 低；空值和0分不转换为低风险。Excel 均值排除空值，保留原值及专家修正。

建筑群风险、网络渗流需接入经过验证的模型及输入；目前提供输入检查与计算请求草稿，不生成虚假计算结果。GitHub Pages 为公开快照，上传、审核与数据库写入由云端提供。

## 视觉与交互

浅色：纸白 #fcfcf7、背景 #e9ede5、墨绿 #243a32、森林绿 #22473d、金 #a18c56。
深色：底色 #0e1714、面板 #17211d、字色 #e4e6da、次级 #9ca99f、金 #cbb882。
字体使用本地 Arial/Helvetica 与中文无衬线字体。桌面以紧凑统计和地图/图谱并列为主，小屏纵向排列。图谱支持缩放、拖动、展开画布、证据详情及导出；弹窗支持 Esc 和焦点管理。

## Five-hazard inputs (2026-11-04)
Building-group and percolation modules now consume user-supplied `五类风险_绘图数据` via reproducible `scripts/prepare-risk-atlas.py` derivatives. The 1,570,932 cleaned building records are counted once in 500 m EPSG:32651 cells by interior representative point, with finite-value equal-building means and maxima. The 763 cleaned heritage objects retain their source IDs and raw values; 22 sentiment gaps remain null. IDs are not silently joined to earlier SHP IDs. Existing vulnerability scores remain separate.

Eight nearest-neighbour EPSG:3857 web raster previews are explicitly display-only; development imagery is the provided IDW + 300 m Gaussian field, not raw risk. Full-population statistics and cell analysis use source GeoParquet, not raster pixels. Source checksums and definitions are downloadable. Threshold connected components support four/eight-neighbour adjacency, minimum cell count and GeoJSON export with parameters; they are exploratory regions, not validated percolation, contagion probabilities, intervention zones or legal protection extents. Sentiment has no building surface and is point-only. Dark/light themes and English/Chinese labels share these distinctions.

## Cleaned footprint / Parquet revision
The building-risk map now renders vector footprints from `全部建筑地块_含文物属性_SHP.zip`, with four original risk attributes from GeoParquet. It no longer renders a raster or default grid on that page. Geometry-verified matching is mandatory because SHP `id` is non-unique and source rows changed. Unmatched values stay missing (grey); development raw zeros are preserved. PMTiles contains zooms 10–16; higher zoom overzooms vectors rather than pixels. City-level view below zoom 10 shows boundary and heritage points.

`prepare-clean-buildings.py` records SHA-256 provenance, geometry linkage counts and named one-to-many heritage associations; `prepare-risk-atlas.py` recomputes exploratory cells from the same cleaned geometry and matched risks, and `prepare-building-parquet.py` writes the GeoParquet tiles that the map decodes. The `outside_points` notes are published as source observations, not instructions to delete heritage records. Unresolved source names remain in the audit. Previous spatial records stay in D1; a versioned clean baseline takes precedence, and subsequent administrator corrections use optimistic revision checks starting at 1000. Existing scores and reviews are unchanged.
