# HERISK · 文垣智评

本次以用户给出的深浅两版地图工作台、平台名片为设计依据：菱形徽标、暖白/深绿底色、金色强调，紧凑页首与标题下版权信息。平台全称为 **Heritage Resilience & Intervention Spatial Knowledge platform**。Slogan：**Mapping heritage risk contagion for urban resilience — 迹察风险，城铸韧性。**

## 界面结构

- 左栏：767 处真实文物资源、名称/地址/编号检索、行政区筛选、可滚动目录、工作台入口。
- 中栏：上海可缩放地图，五维原始敏感性着色，等级筛选、边界线、SHP 建筑、原始点位、文物标签与视图重置。
- 右栏：默认显示平台名片与操作路径；选择文物后显示五维评分、原文证据、CSV 行号、建筑候选和完整档案入口。
- 顶部：品牌名片、规划知识库、主题切换、中英文切换、导航。平台名片以模态弹窗打开，支持 Esc、关闭按钮和背景点击关闭；键盘焦点保留在弹窗内。

深浅两版切换会同时更新地图底图颜色与其他模块界面，主题保存在当前浏览器。版权署名采用用户参考图提供的机构文字。原数据、来源与管理权限保持独立。

## 数据与能力边界

地图颜色来自 CSV 中保留的五维原始分值：高敏感性为4—5，中为3，低为1—2；空值和原始0分保持待核查，不转换为低风险。“本底塑造、开发建设、活动利用、污染安全、舆论引导”分别对应历史价值、开发建设、活动利用、环境污染、舆论传播敏感性，不能据此直接推断韧性或危害传播概率。

用户提供的 LLM 平台简介收录于名片的“平台愿景”。现有版本已具备档案、评分、证据图谱、来源检索、文件上传与人工审核；尚未接入经过验证的 LLM 推理、跨建筑危害传播和自动干预分区模型。综合风险入口明确标示待接入，不绘制虚构的风险圈或法定保护范围。

## 色彩与字体

浅色：纸白 `#fcfcf7`、背景 `#e9ede5`、墨绿 `#243a32`、森林绿 `#22473d`、哑金 `#a18c56`。
深色：底色 `#0e1714`、面板 `#17211d`、字色 `#e4e6da`、次级字色 `#9ca99f`、金色 `#cbb882`。
HERISK 字标和关键数字使用 Arial/Helvetica 粗体，中文使用设备原生中文无衬线字体；数据标识使用等宽字体。所有字体本地可用，避免增加外部字体请求。

## Computation-first information architecture (2026-11-03)

The default page is now the heritage risk assessment and computation workspace. Two persistent workspace controls expose the computation and application modules. A second navigation row keeps original records/graph, indicators, evidence, expert review, uploads/Agent, building map, statistics, knowledge structure and architecture visible. The sidebar also lists both sets of five modules.

- Computation: data management → asset assessment → building-group risk → percolation and extent identification → verification and publication.
- Application: city risk atlas → asset profiles → building-group diagnostics → knowledge and strategies → planning feedback and output.
- Architecture page includes all five layers from the supplied diagram, including shared services, model readiness and the data/knowledge foundation.
- Existing calculations summarize imported scores. Group risk, percolation and RAG strategy generation remain explicitly pending validated models and inputs. Their screens expose input readiness and exportable request drafts; they never produce fabricated risk results.
- Feedback drafts can be exported and uploaded for source review; export alone does not submit a cloud job or execute recalculation.
