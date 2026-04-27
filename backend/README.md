# Backend

后端使用 `NestJS + Prisma + PostgreSQL schema`，当前为了让项目在无数据库环境下也能直接启动，默认注入了带种子数据的 `InMemoryAppStore`。Prisma schema 和 `PrismaService` 已写入仓库，用于后续切换到真实 PostgreSQL。

## 已实现接口

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout`
- `GET /reading/passages/random`
- `PUT /reading/attempts/:passageId`
- `POST /reading/attempts/:passageId/complete`
- `GET /vocabulary`
- `GET /vocabulary/:lemma`

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
```

## 内容管线产物

执行内容命令后，会在仓库根目录生成 `content-cache/`：

- `raw-sources.json`
- `normalized-passages.json`
- `translated-passages.json`
- `ingested-passages.json`
- `ingested-lexicon.json`

