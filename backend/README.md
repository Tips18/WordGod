# Backend

后端使用 `NestJS + Prisma + PostgreSQL schema`。业务服务通过 `AppStore` 抽象访问数据，只有显式设置 `WORD_GOD_STORE=prisma` 时使用 `PrismaAppStore` 连接 PostgreSQL；未设置或设置为 `memory` 时使用带考研英语真实长段落种子题库的 `InMemoryAppStore`，便于无数据库演示和测试。

## 已实现接口

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`
- `GET /reading/passages/random`
- `PUT /reading/attempts/:passageId`
- `POST /reading/attempts/:passageId/complete`
- `GET /vocabulary`
- `GET /vocabulary/:lemma`

认证接口会把邮箱统一规整为去除首尾空格的小写格式；Prisma 模式下邮箱查找为大小写不敏感匹配，避免注册过的账号因登录输入大小写不同而被判定为不存在。登录请求的 `rememberLogin` 缺省为 `true` 并签发 30 天刷新会话；传入 `false` 时签发 24 小时短刷新会话。`GET /auth/me` 会在 access Cookie 失效但 refresh Cookie 有效时恢复用户并补发 access Cookie。

## 主要命令

```powershell
corepack pnpm --filter backend start:dev
corepack pnpm --filter backend test
corepack pnpm --filter backend test:e2e
corepack pnpm --filter backend build
corepack pnpm --filter backend prisma:generate
corepack pnpm --filter backend content:crawl
corepack pnpm --filter backend content:normalize
corepack pnpm --filter backend content:translate
corepack pnpm --filter backend content:ingest
corepack pnpm --filter backend content:extract-word-bank
corepack pnpm --filter backend content:create-translation-batch
corepack pnpm --filter backend content:import-translation-batch
corepack pnpm --filter backend content:import-word-bank
corepack pnpm --filter backend content:import-ecdict
```

## 存储模式

PostgreSQL 模式用于真实数据运行和词库入库：

```powershell
$env:WORD_GOD_STORE="prisma"
corepack pnpm --filter backend prisma:migrate:dev
corepack pnpm --filter backend start:dev
```

内存模式用于本地快速查看接口和跑测试，不依赖数据库：

```powershell
$env:WORD_GOD_STORE="memory"
corepack pnpm --filter backend start:dev
```

## 内容管线产物

执行内容命令后，会在仓库根目录生成 `content-cache/`：

- `raw-sources.json`
- `normalized-passages.json`
- `translated-passages.json`
- `ingested-passages.json`
- `ingested-lexicon.json`
- `word-bank-extracted-passages.json`
- `openai-translation-batch-input.jsonl`
- `openai-translation-batch.json`
- `openai-translation-batch-output.jsonl`
- `openai-translation-import-errors.json`

`content:create-translation-batch` 和 `content:import-translation-batch` 需要 `OPENAI_API_KEY`。Batch 输出会先经过 schema 校验，无法解析的行会写入导入错误记录；成功富化的段落按稳定段落 id upsert 到 PostgreSQL，同时按 lemma upsert 词典词条。`content:import-ecdict` 会读取 `ECDICT_MARKDOWN_PATH` 或默认 `词库/ecdict.md`，将 ECDICT 全量词条批量 upsert 到 `LexiconEntry`。
