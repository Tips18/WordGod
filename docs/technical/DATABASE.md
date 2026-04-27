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
- `VocabularyContext` 只保留最近三条记录，结算时按时间裁剪。

## 当前仓库状态

- Prisma schema 位于 `backend/prisma/schema.prisma`，数据源固定为 PostgreSQL。
- 当前 API 运行态默认使用内存存储，以便在本地无数据库时也能直接启动和跑测试。
- 真实数据库接入时，需要用 Prisma repository 替换当前 `InMemoryAppStore` 提供者。
