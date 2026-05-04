# 数据库设计

## 核心表

### User

- `id`
- `email`
- `passwordHash`
- `createdAt`
- `updatedAt`

运行时注册会将 `email` 规整为去除首尾空格的小写格式；登录查询在 Prisma/PostgreSQL 模式下使用大小写不敏感匹配，不新增字段或迁移。

### AuthSession

- `id`
- `userId`
- `refreshTokenHash`
- `expiresAt`
- `createdAt`

`expiresAt` 同时承载 30 天记住登录会话和 24 小时短会话，不区分新增字段；运行时根据登录请求的 `rememberLogin` 写入不同过期时间。

### Passage

- `id`
- `examType`
- `year`
- `paper`
- `questionType`
- `passageIndex`
- `title`
- `sourceUrl`
- `sourceDomain`
- `content`
- `sentences`
- `tokens`
- `publishedAt`

### LexiconEntry

- `id`
- `lemma`
- `surface`
- `partOfSpeech`
- `definitionCn`
- `inflections`

### ReadingAttempt

- `id`
- `userId`
- `passageId`
- `selectedTokens`
- `completedAt`

### VocabularyEntry

- `id`
- `userId`
- `lemma`
- `surface`
- `partOfSpeech`
- `definitionCn`
- `markCount`
- `lastMarkedAt`

### VocabularyContext

- `id`
- `vocabularyEntryId`
- `passageId`
- `sentenceText`
- `sentenceTranslation`
- `markedAt`

### CrawlJob

- `id`
- `sourceUrl`
- `sourceDomain`
- `status`
- `rawContent`
- `normalizedContent`
- `errorMessage`
- `createdAt`
- `updatedAt`

## 关键约束

- `VocabularyEntry` 使用 `userId + lemma` 唯一约束去重。
- `ReadingAttempt` 使用 `userId + passageId` 唯一约束保存当前段落临时状态。
- `Passage` 使用 `examType + year + paper + questionType + passageIndex` 唯一约束，防止同一试卷同一 Text 被重复导入。
- `VocabularyContext` 只保留最近三条记录，结算时按时间裁剪。

## 当前仓库状态

- Prisma schema 位于 `backend/prisma/schema.prisma`，数据源固定为 PostgreSQL。
- `backend/prisma/migrations/202604280001_add_passage_unique_key/` 新增了段落自然键唯一索引，导入脚本可按稳定段落 id 和自然键幂等更新题库内容。
- API 运行态通过 `WORD_GOD_STORE` 选择存储：只有显式设置 `prisma` 时使用 `PrismaAppStore` 连接 PostgreSQL，未设置或设置为 `memory` 时使用内存存储与真实长段落种子题库。
- 认证刷新会话继续使用现有 `AuthSession` 表；`rememberLogin` 只影响 `expiresAt` 和 refresh Cookie 的 Max-Age，不新增数据库表、字段、迁移或唯一约束。
- 词库导入脚本会将富化后的段落 upsert 到 `Passage`，并按 lemma upsert 到 `LexiconEntry`；用户阅读状态、生词主记录和上下文仍按现有唯一约束结算。
- 前端“纸本文献感”视觉重构不新增字段、不新增表，也不改变现有唯一约束和结算逻辑；阅读页宽屏正文居中和右侧固定 Live Note 旁批轨只调整前端布局，页面仍消费当前 `Passage`、`LexiconEntry`、`ReadingAttempt`、`VocabularyEntry` 和 `VocabularyContext` 数据。
- 本机开发 CORS 兼容只调整 API 启动中间件，不新增数据库字段、表、迁移或持久化状态。
- 内存模式题库扩展为运行时读取抽取缓存或 `词库/` Markdown，不新增数据库表或字段；Prisma 模式仍以 `Passage` 表中的入库结果为准。
- `词库/ecdict.md` 是 ECDICT Markdown 词典资料，不新增表、字段、迁移或唯一约束；`content:import-ecdict` 会按 lemma 批量 upsert 到现有 `LexiconEntry` 表，阅读接口优先使用该表补全 token 词性和中文释义，不改变 `Passage` 表持久化内容。
- Live Note 运行时翻译不新增表、字段或迁移；翻译成功结果只保存在后端进程内缓存中，不写回 `Passage.sentences` 或 `Passage.tokens`，数据库仍以内容导入结果为持久化来源。
- 后端 ESLint 基线清理只涉及 TypeScript 格式与测试类型标注，不新增迁移，也不改变任何数据库 schema 或约束。
- 后端启动构建配置只调整 TypeScript 输出目录、共享 contracts 解析和增量缓存位置，不新增迁移，也不改变任何数据库 schema、约束或持久化状态。
