# 数据库设计

## 核心表

### User

- `id`
- `email`
- `passwordHash`
- `createdAt`
- `updatedAt`

### AuthSession

- `id`
- `userId`
- `refreshTokenHash`
- `expiresAt`
- `createdAt`

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
- 词库导入脚本会将富化后的段落 upsert 到 `Passage`，并按 lemma upsert 到 `LexiconEntry`；用户阅读状态、生词主记录和上下文仍按现有唯一约束结算。
