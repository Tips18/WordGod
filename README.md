# WordGod

我不是词神是一个面向考研英语备考用户的词汇检测工具。产品不负责教用户背单词，而是通过历年真题段落阅读，帮助用户识别自己“背过但不熟”的词，并把这些词沉淀到生词本中持续复习。

## 仓库结构

- `frontend/`：React + Vite 前端应用，承载阅读检测、登录注册和生词本页面。
- `backend/`：NestJS API 服务，提供认证、阅读结算、生词本聚合、Prisma/PostgreSQL 存储和内部内容导入命令。
- `packages/contracts/`：前后端共享 DTO、领域类型和常量。
- `docs/`：产品文档、技术设计、编码规范和迭代记录。
- `词库/`：考研英语一/二真题 Markdown 资料与来源索引，当前覆盖 2017-2023 年可复用公开来源，2024-2026 年缺失来源记录在 `kaoyan-english-missing-sources.md`。

## 开发约束

- 每次编码前先通读 `docs/business/PRD.md`、`docs/technical/ARCHITECTURE.md`、`docs/technical/DATABASE.md`。
- 每次修改代码后同步更新 README、产品文档和技术文档。
- 每个函数必须包含总结式注释，避免无语义的空洞注释。

## 启动方式

当前仓库使用 `pnpm workspace` 管理。若本机未安装 `pnpm`，先执行：

```powershell
corepack prepare pnpm@10.11.0 --activate
```

安装依赖：

```powershell
corepack pnpm install
corepack pnpm --filter backend prisma:generate
```

启动前后端：

```powershell
corepack pnpm dev:backend
corepack pnpm dev:frontend
```

后端会读取仓库根目录 `.env`。未设置 `WORD_GOD_STORE` 或设置为 `memory` 时使用内置考研英语种子段落，适合无数据库本地演示和测试；只有显式设置 `WORD_GOD_STORE=prisma` 时才使用 PostgreSQL，此时需先准备 `DATABASE_URL` 并执行迁移。

```powershell
$env:WORD_GOD_STORE="prisma"
corepack pnpm --filter backend prisma:migrate:dev
$env:WORD_GOD_STORE="memory"; corepack pnpm dev:backend
```

前端默认请求 `http://localhost:3000`，后端默认允许 `http://localhost:5173` 与 `http://127.0.0.1:5173` 携带登录 Cookie 访问。若使用其他前端地址，设置 `CORS_ALLOWED_ORIGINS`，多个来源用英文逗号分隔。首页若无法连接 API，会显示加载错误而不是一直停留在“正在载入真题段落...”。

## 测试命令

```powershell
corepack pnpm test
corepack pnpm --filter backend test:e2e
```

浏览器端 Playwright 用例已写入仓库，首次运行前需要先安装 Chromium：

```powershell
corepack pnpm --filter frontend exec playwright install chromium
corepack pnpm test:e2e
```

## 内容命令

```powershell
corepack pnpm --filter backend content:crawl
corepack pnpm --filter backend content:normalize
corepack pnpm --filter backend content:translate
corepack pnpm --filter backend content:ingest
corepack pnpm --filter backend content:extract-word-bank
corepack pnpm --filter backend content:create-translation-batch
corepack pnpm --filter backend content:import-translation-batch
corepack pnpm --filter backend content:import-word-bank
```

`词库/kaoyan-english-source-index.md` 记录了题库资料的来源与转换状态；新增真题资料前先确认来源允许复用，不要把禁止批量抓取或授权不明的内容放入仓库。`extract-word-bank` 会从每篇 Text 随机抽取一个正文段并写入 `content-cache/word-bank-extracted-passages.json`；OpenAI Batch 命令需要 `OPENAI_API_KEY`，会生成 JSONL 输入、Batch 元数据、输出和导入错误记录，最终把富化后的段落与词典词条写入 PostgreSQL。
