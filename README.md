# HERISK · 文垣智评

将原 `index.html` 演示工作台改造为有云端数据库、来源归档与管理员权限的应用。

- 网站：https://heritage-sensitivity-han-2026.wanyinhan98.chatgpt.site
- GitHub：https://github.com/hanwanyin/LLM-history-buildings
- 前端：React / Vinext；后端：Cloudflare Workers；数据库：D1；原始文件：R2。
- 所有人可浏览；管理员通过 ChatGPT 登录，服务器依据 `ADMIN_EMAILS` 白名单限制写入。
- 767 处文物、3,835 条 CSV 综合评分、20,304 条 Excel 明细、27 个指标、6 份来源文件。
- 数据库中保留原始行、来源工作表与行号。1,802 个空分值原样保留。15 处只有 CSV 评分；2 个 CSV 原值为 0，标注待核查。名称差异按编号关联并记录。
- 专家修正独立存储，不覆盖原始评分；编辑采用版本校验，评价快照保留当时数据。

## 使用

公开访问者可检索文物、查看五维评分与证据、下载原始数据和报告。管理员登录后，可以编辑档案、保存专家复核及评价快照。原始坐标采用 CSV 的 `wgs_lon/wgs_lat`，地图可同时查看原始点和建筑关联锚点，不推断保护范围或风险半径。

## 上海建筑地图

开源地图引擎 MapLibre GL 使用 OpenFreeMap / OpenMapTiles 矢量道路水系底图。自定义样式仅允许道路、轨道、水系、绿地及中文地名，不渲染 OSM 建筑块，不使用含建筑的栅格底图。建筑轮廓唯一来源为用户提供的 1,570,826 个建筑面。建筑切成 14—16 级 PMTiles 矢量瓦片，放大时按 HTTP Range 从 R2 加载，支持继续放大到20级。不会一次把全市157万建筑下载到浏览器。底图按当前视野从 OpenFreeMap 请求，保留 OpenFreeMap、OpenMapTiles、OpenStreetMap 来源署名。样式定义在 `lib/map-style.ts`，建筑图层与底图透明度独立控制。

`上海建筑.zip` 同时包含 EPSG:4326 的 `shanghai.shp` 和 EPSG:32651 的 `shanghai51N.shp`；本项目只导入前者，距离在 UTM 51N 下计算。136处原始点落在建筑面内（其中1处重叠），566处为120米内近邻候选，65处无候选。候选点显示到建筑内部但明确标注待核查，保留原始点位；管理员可从前三个候选中核查并确认，确认结果与理由留档。几何邻近不等于已验证的文物身份；开放遗址等可能不对应建筑。

准备地图需要 GDAL、Shapely、PyProj。将 `shanghai.*` 解压到忽略目录 `data/building-source/`，建立空间索引后运行 `python scripts/match-buildings.py`。生成PMTiles示例：

```sh
ogrinfo data/building-source/shanghai.shp -sql 'CREATE SPATIAL INDEX ON shanghai'
ogr2ogr -f PMTiles data/shanghai-buildings.pmtiles data/building-source/shanghai.shp -sql 'SELECT FID AS building_id, Height FROM shanghai' -nln buildings -dsco MINZOOM=14 -dsco MAXZOOM=16 -dsco MAX_SIZE=5000000 -dsco MAX_FEATURES=200000 -dsco SIMPLIFICATION=0 -dsco SIMPLIFICATION_MAX_ZOOM=0
```

追加本地迁移 `drizzle/0001_brief_agent_brand.sql` 后，用 `python scripts/seed-local.py data/spatial-seed.json` 导入匹配结果。生产环境运行同一个 `import-data.mjs`，stdin配置加 `seed_path: "data/spatial-seed.json"`；再运行 `node scripts/upload-map.mjs`，通过隐藏stdin提供 `url`、`token`（私有站点可附 `bypass`）。原始SHP及158MB瓦片不进入GitHub或Worker代码包，而存储在本地归档与R2地图对象中。

“证据检索”查询已导入原文；“数据与来源”新增真实检索 Agent（上海博物馆官方检索、Crossref 学术元数据）和文件上传。新增资料先进入私有待审区，经管理员核对来源、文物关联并填写审核理由后公开。文件上限10MB，支持 XLSX、CSV、DOCX、TXT、MD、JSON、PDF；PDF 须提供原文摘录和页码。没有接入大模型、向量服务和 PDF OCR，不生成新的 AI 分值。明细均值仅为描述统计；CSV 综合评分独立保留。

平台现名“HERISK · 文垣智评”，英文为 Heritage Resilience & Intervention Spatial Knowledge platform（HERISK）。页首切换中英文，操作界面与说明双语，原始证据和文物名称保留原文。知识库解释与平台结构见 `docs/HERISK-platform-and-knowledge-base.md`；公开站发布和资料同步方法见 `docs/github-pages.md`。

坐标复核结果见 `data/coordinate-audit.json`：抽样102个建筑，EPSG:4326转EPSG:32651与原始UTM文件一致；SHP转换为EPSG:3857瓦片后最大轮廓偏差为0.101米（Web Mercator平面单位，瓦片量化误差）。未发现轴顺序或投影错误。该检查不证明源文件的绝对定位精度或与OSM建筑采集时间、轮廓的一致性，未施加经验性GCJ-02平移。`scripts/audit-map-crs.py`可复核；需要将shanghai51N的shp/shx/prj解压到同一忽略目录。

## 数据与部署

源代码保存在 GitHub；Sites 在 Cloudflare 上托管实际后端、D1 和 R2。GitHub Pages 本身仅适合静态内容，不能代替这个后端。仅向 GitHub 推送不会自动更新 Sites，需要对同一版本构建并发布。

1. 安装 Node.js 22.13+ 以及 Python 3（`openpyxl` 用于只读解析 Excel）。
2. 运行 `npm ci`。
3. 将提供的 CSV 和 5 份 Excel 保存在同一目录，运行 `python scripts/prepare-data.py /absolute/source/directory`。这不会改动原文件，生成的 `data/seed.json` 默认不提交到 Git。
4. 首次本地运行先 `npm run build`，再执行下面的本地迁移命令和 `python scripts/seed-local.py`。不要对已有数据重复执行本地 seed。
5. 创建仅本地使用且不跟踪的 `.dev.vars`：`ADMIN_EMAILS=seedy@sites.test`，`ADMIN_IMPORT_TOKEN=local-test-only`。生产值必须通过部署平台的环境变量管理，不可放入浏览器或仓库。
6. 运行 `npm run dev -- --hostname 127.0.0.1 --port 5173`。本地登录入口 `/signin-with-chatgpt?return_to=/` 模拟开发身份；生产环境使用平台真实身份。

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_complete_pretty_boy.sql
```

生产导入使用 `node scripts/import-data.mjs`，通过隐藏的 stdin 输入 JSON，字段为 `url`、`token`、`source_dir`，私有站点可附加 `bypass`。token 必须匹配服务端 `ADMIN_IMPORT_TOKEN`。脚本将数据按顺序分批写入 D1、把原始文件归档到 R2，核对行数；相同批次重复执行不会重复写入。不同数据复用同一批次会被拒绝。现有记录不会被批量导入覆盖；新增数据应先审查，再制定增量导入或迁移方案。

生产密钥仅由平台管理；管理员白名单、导入密钥、个人令牌均不进入 GitHub。`data/data-audit.json` 记录来源校验和与导入核查结果。数据库迁移在 `drizzle/`；已应用迁移不可改写，结构变更追加新迁移。

## 验证

```sh
npx tsc --noEmit
node --experimental-strip-types scripts/test-assessment.mjs
node scripts/test-api.mjs
node scripts/test-knowledge-intake.mjs
node scripts/test-knowledge-graph.mjs
node --experimental-strip-types scripts/test-map-style.mjs
npm run build
```

`test-api.mjs` 固定使用本地预览，验证权限、空值、来源、写入持久化、并发版本冲突及不可变快照；会创建仅本地的测试复核记录。生产导入只读取原始 seed，不使用本地测试数据库。

## 上游运行环境说明

A clean full-stack starter running on [vinext](https://github.com/cloudflare/vinext), with optional Cloudflare D1 and Drizzle support.

## Prerequisites

- Node.js `>=22.13.0`
- Portable: Windows, macOS, or Linux; no Bash required
- Managed Linux: managed Linux runtime with Bash, `flock`, `curl`, `sha256sum`, and GNU `timeout`
- Git and `tar` (including Windows `tar.exe`) are required for publishing; portable publication does not require Bash

## Sites Lifecycle

The Sites initializer copies the shared starter and selects managed-linux only when `SITES_MANAGED_LINUX_CONTAINER=1`; otherwise it selects portable. It saves the selection only in ignored `.sites-runtime/execution-profile.json`. Both profiles copy/configure first, then use the plugin's separate `install-dependencies.mjs` step to measure installation independently. Edit source under `app/` and follow the Sites skill for installation, preview, builds, and publishing.

Run `node <plugin-root>/scripts/configure-execution-profile.mjs` only when the profile is unknown for the current checkout and environment. Profile changes do not alter tracked source or require reinstalling otherwise-valid dependencies; restart an existing preview to use the new selection. Do not commit or upload `.sites-runtime/`.

This starter does not use `wrangler.jsonc`.

Publish archives outside the source checkout or under its ignored `outputs/` directory. Local `.env*`, `.dev.vars*`, TypeScript build state, and tool runtime directories are ignored; keep the hosting manifest, migrations, and authored scripts in source control.

`install:ci` runs `npm ci` once against the shared lockfile, disables parent-workspace discovery, and includes required dev/optional dependencies despite production/omit settings. Sharp defaults to prebuilt binaries unless explicitly configured otherwise. Do not overlap installers.

- **Portable:** Preserve host HOME, npm cache, registry, proxy, temporary paths, retry/concurrency settings, and lifecycle-script policy. Use `--prefer-offline --no-audit --no-fund`.
- **Managed Linux:** Use the existing project-local HOME/cache/tmp setup and Linux install lock, tarball preflight, and timeout. Restore the image-seeded npm cache only when its lockfile hash matches; retain network fallback. Builds keep their existing timeout. These helpers are not invoked by the portable profile.

`scripts/sites-env.mjs` preserves the caller's HOME, npm cache, proxy, XDG, and temporary-directory configuration while defaulting Wrangler and Miniflare state to the checkout. If npm reports an unwritable cache, select a writable path with `npm_config_cache` for that install. The `dev` and `start` scripts also keep Wrangler logs inside the checkout. Generated `.sites-runtime/` and `.wrangler/` directories are disposable and ignored by Git.

On portable, `npm run dev` uses `vinext dev` with HMR, starting at port 5173. Vinext records the running server in ignored `.vinext/` state, rejects an ordinary duplicate launch, and recovers stale state after a stopped process; exactly simultaneous starts can race. Pass `--port <port>` or `--hostname <host>` after `npm run dev --` when needed; keep portable previews on loopback.

For managed Linux browser QA, follow the Sites skill's managed preview reference. The daemon runs the project's Vite dev script with `--host 0.0.0.0 --port 4173 --strictPort`; use the CLI's returned URL. The ignored local profile survives the daemon's cleared environment.

The portable profile simulates ChatGPT sign-in only for loopback development requests. Visit `/signin-with-chatgpt?return_to=/` to sign in as `local_seedy` (`seedy@sites.test`, display name `Seedy`) and `/signout-with-chatgpt?return_to=/` to sign out. The development cookie preserves that identity across server restarts. Mock auth is disabled in the managed-linux profile and is not included in production builds; hosted authentication remains dispatch-owned.

The Worker uses `vinext/server/fetch-handler`, including Vinext's config-aware image handling. After building, `npm start` runs that Worker locally through Wrangler on `127.0.0.1`, sharing `.wrangler/state` with dev preview and local D1 migrations; it does not deploy the site or simulate sign-in. Use the URL printed by the server. Pass `npm start -- --port <port>` to select a different built-preview port.

Local previews use Miniflare's placeholder `Request.cf` metadata without a network lookup. Set `CLOUDFLARE_CF_FETCH_ENABLED=true` to opt into fetching preview metadata; this setting does not change hosted request metadata.

Local tool usage metrics are disabled by default. Set `WRANGLER_SEND_METRICS=true` to opt in.

## Included Shape

- edit site code under `app/`
- `app/chatgpt-auth.ts` provides optional dispatch-owned ChatGPT sign-in helpers
- `.openai/hosting.json` declares optional Sites D1 and R2 bindings
- `vite.config.ts` simulates declared bindings for local development
- `worker/index.ts` is the production Worker entrypoint and preserves request-scoped connector bindings
- `scripts/vite/` contains the maintained Vite integrations and the vendored Sites plugin license
- `scripts/connector-preview/` contains the local connector preview Worker and session helpers
- the remaining `scripts/` files select execution profiles and run installation, development, and builds; the plugin's helpers orchestrate the Sites lifecycle
- `dist/` contains generated deployment output; `.vinext/`, `.wrangler/`, and `.sites-runtime/` contain ignored local tool state
- `db/index.ts` reads the D1 binding from the Cloudflare Worker environment
- `db/schema.ts` starts intentionally empty
- `@cloudflare/workers-types` provides Worker types; `cloudflare-env.d.ts` declares optional `DB`/`BUCKET` bindings—update these declarations if binding names change
- `examples/d1/` contains an optional D1 example surface
- `drizzle.config.ts` supports local migration generation when needed

## Workspace Auth Headers

Signed-in visitors receive both `oai-authenticated-user-id` and `oai-authenticated-user-email`. Private Sites require every visitor to sign in; public Sites may also have anonymous visitors, for whom neither header is present.

The user ID is stable for the same user on the same Site and different across Sites. Use it as the durable user key; use email and name for display or contact purposes.

SIWC-authenticated workspace sites may also receive `oai-authenticated-user-full-name` when the user's SIWC profile has a non-empty `name` claim. The full-name value is percent-encoded UTF-8 and is accompanied by `oai-authenticated-user-full-name-encoding: percent-encoded-utf-8`.

Treat the full name as optional and fall back to email when it is absent:

```tsx
import { headers } from "next/headers";

export default async function Home() {
  const requestHeaders = await headers();
  const userId = requestHeaders.get("oai-authenticated-user-id");
  const email = requestHeaders.get("oai-authenticated-user-email");
  const encodedFullName = requestHeaders.get("oai-authenticated-user-full-name");
  const fullName =
    encodedFullName &&
    requestHeaders.get("oai-authenticated-user-full-name-encoding") ===
      "percent-encoded-utf-8"
      ? decodeURIComponent(encodedFullName)
      : null;

  const displayName = fullName ?? email;
  // ...
}
```

## Optional Dispatch-Owned ChatGPT Sign-In

Import the ready-to-use helpers from `app/chatgpt-auth.ts` when the site needs optional or required ChatGPT sign-in:

- Use `getChatGPTUser()` for optional signed-in UI.
- Use the returned `userId` as the stable user key for user-owned records; do not use email as a durable identifier.
- Use `requireChatGPTUser(returnTo)` for server-rendered pages that should send anonymous visitors through Sign in with ChatGPT.
- In a Server Component, start sign-in with `<a href={chatGPTSignInPath(returnTo)} target="_top">`. The auth helper module is server-only; do not import it into a Client Component.
- Do not use `fetch`, XHR, a client-side router, or a framework link that can prefetch the sign-in route. SIWC must start as a top-level navigation.
- Never request the AuthAPI authorization endpoint directly. The dispatch-owned `/signin-with-chatgpt` route must start the SIWC flow.
- Use `chatGPTSignOutPath(returnTo)` for browser sign-out links or actions.
- Pass a same-origin relative `returnTo` path for the destination after sign-in or sign-out. The helper validates and safely encodes it.
- Mark protected pages with `export const dynamic = "force-dynamic"` because they depend on per-request identity headers.

Dispatch owns `/signin-with-chatgpt`, `/signout-with-chatgpt`, `/callback`, the OAuth cookies, and identity header injection. Do not implement app routes for those reserved paths. Routes that do not import and call the helper remain anonymous-compatible.

SIWC establishes identity only; it does not prove workspace membership. Use the Sites hosting platform's access policy controls for workspace-wide restrictions, or enforce explicit server-side membership or allowlist checks.

Use SIWC for account pages, user-specific dashboards, saved records, and write actions tied to the current ChatGPT user. Leave public content anonymous.

## Local D1 migrations

For a D1-backed local preview, generate SQL with `npm run db:generate`. Build once through the Sites skill's build entrypoint (or `npm run build` for standalone use) to generate `dist/server/wrangler.json`, rebuilding if bindings change. From the project root, apply each pending migration in order:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_example.sql
```

Replace the filename with the pending migration and `DB` with your D1 binding name if different. Use `.wrangler/state`, not `.wrangler/state/v3`; Wrangler adds the versioned directories. Do not replay migrations already applied locally. This updates only the preview database; publishing applies production migrations separately.

## Diagnostic Commands

- `npm run install:ci`: perform the one locked dependency install
- `npm run dev`: start the Vite/Vinext development server
- `npm run build`: build the deployable Sites artifact
- `npm run start`: preview the built Worker locally with D1/R2 support
- `npm run db:generate`: generate Drizzle migrations after schema changes

When using the Sites plugin, follow its skill instructions for installation, builds, and publishing. These npm commands remain available for standalone use.

The portable build runs Vinext directly without a host `timeout` command. The managed-linux build uses `scripts/build-verified.sh` and its existing `SITES_BUILD_TIMEOUT` setting.

## Learn More

- [vinext Documentation](https://github.com/cloudflare/vinext)
- [Drizzle D1 Guide](https://orm.drizzle.team/docs/get-started/d1-new)
