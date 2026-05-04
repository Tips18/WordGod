# 迭代记录

## 2026-04-26

- 根据 PRD 初始化项目单仓结构。
- 锁定 V1 范围为考研英语题库、阅读检测、生词本和登录闭环。
- 技术栈确定为 React + Vite、NestJS + Prisma、PostgreSQL。
- 实现阅读检测页、登录注册页、生词本列表页和详情页。
- 实现认证接口、随机段落分发、标记同步、完成结算和生词本接口。
- 实现白名单内容抓取、规范化、翻译占位和入库命令。
- 补充前端行为测试、后端单元测试、后端 e2e 测试和 Playwright 浏览器测试脚本。
- 修复首页段落加载失败时一直显示“正在载入真题段落...”的问题，并补充前端错误态回归测试。
- 后端统一启动配置中启用本地前端开发源 CORS，确保阅读页能跨端口携带 Cookie 请求 API。

## 2026-04-28

- 将 `词库/` 目录纳入仓库，保存 2017-2023 考研英语一/二真题 Markdown 资料。
- 补充题库来源索引与 2024-2026 缺失来源记录，明确只接收允许复用的公开来源内容。

## 2026-05-04

- 拉取并对齐远端 `main` 的强制更新，保留本地未提交的阅读服务与 TypeScript 配置改动。
- 修复后端开发启动构建路径：`dev:backend` 先构建 `packages/contracts`，后端从 `packages/contracts/dist` 解析共享包，并将 contracts 与后端增量缓存写入各自 `dist/`，确保清理输出目录后仍能生成 `backend/dist/main.js`。
- 将本地后端运行模式切换到 Prisma/PostgreSQL，使用远程 `wordgod` 数据库完成 schema 同步、迁移状态标记和题库数据导入验证。
- 从现有考研英语一/二资料抽取并写入 56 篇阅读段落，同时同步 token 词条到 `LexiconEntry`；后端随机段落接口已验证可从 PostgreSQL 返回真实段落。
- 检查词典文件状态：仓库当前没有 `词库/ecdict.md` 实体文件，阅读词义优先使用数据库 `LexiconEntry`，缺失时仍保留代码中的 ECDICT Markdown 回退路径。
- 合并本轮后端构建修复到本地 `main`，并通过 `corepack pnpm test` 验证 contracts、后端 Jest 和前端 Vitest 测试。
