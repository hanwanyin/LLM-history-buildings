# GitHub Pages 公开浏览版

目标网址：https://hanwanyin.github.io/LLM-history-buildings/

原管理站：https://heritage-sensitivity-han-2026.wanyinhan98.chatgpt.site/

浏览版在 GitHub Pages 上托管文物档案、评分、证据、原始文件和 SHP 建筑图层，日常浏览不请求原管理站的数据库接口。道路、水系和地名底图仍由 OpenFreeMap 提供（无建筑块），网络不可用时可能缺失底图。

这是公开数据的发布快照，不提供在线写入。页首显示数据导出时间；修改档案、保存专家复核、确认建筑关联仍需进入原管理站。管理站的网络限制没有因发布本镜像而改变。GitHub Pages 在不同国内网络的速度和可达性也可能不同。

## 更新数据和发布

需要 Node.js 24、项目依赖、本机已有的 GitHub 登录，以及能访问原管理站的网络。脚本只读取原站的公开接口，保持空值、原始分值、公开复核历史和来源信息，不导出管理令牌、身份信息或审计表。数据与导出文件不进入 main 分支。

1. `npm run pages:export`：读取 767 处档案、评分、建筑关联与来源；校验 6 个原始文件 SHA-256；将本地 `data/shanghai-buildings.pmtiles` 切成 1 MB 分块。
2. `npm run pages:build`：生成 `outputs/github-pages/`。
3. `npm run pages:preview`：本地预览；运行 `node scripts/test-pages.mjs` 验证。
4. 将本次源代码提交并推送至 main。
5. `node scripts/publish-pages.mjs`：发布产物至 gh-pages 分支，并在首次发布时启用 Pages。使用本机 Git 凭据助手，不打印、存盘或嵌入令牌。不会强制推送。
6. 等待仓库 Pages 构建成功，再验证线上首页、数据和建筑分块。

如网络需要，可在执行命令的环境中提供 `HTTPS_PROXY` 与 Node.js 的 `NODE_USE_ENV_PROXY=1`，不要把代理账号或令牌提交至仓库。脚本不自动修改系统代理。

`.heritage-pages.json` 记录来源代码提交与数据版本。`main` 保存源代码；`gh-pages` 只保存可公开发布的构建产物。代码变更后需重新构建；管理站数据变更后需重新导出、构建和发布，当前不自动同步。

完整 SHP 数据量约 158 MB，分块按需加载并校验 SHA-256，浏览器最多保留约 12 MB 的分块缓存。相邻视图可以复用缓存，不要求静态服务器支持 Range 请求。
