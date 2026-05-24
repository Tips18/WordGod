# 数据库设计

## 核心表

### User

- `id`
- `email`
- `passwordHash`
- `createdAt`
- `updatedAt`

运行时注册会先拒绝空邮箱和格式不合法邮箱，再将 `email` 规整为去除首尾空格的小写格式；登录查询在 Prisma/PostgreSQL 模式下使用大小写不敏感匹配，不新增字段或迁移。

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
- `textIndex`
- `paragraphIndex`
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
- `Passage` 使用 `examType + year + paper + questionType + textIndex + paragraphIndex` 唯一约束，防止同一试卷同一 Text 的同一自然段被重复导入；`passageIndex` 暂保留为兼容字段，值等同于 `textIndex`。
- `VocabularyContext` 只保留最近三条记录，结算时按时间裁剪。

## 当前仓库状态

- Prisma schema 位于 `backend/prisma/schema.prisma`，数据源固定为 PostgreSQL。
- `backend/prisma/migrations/202604280001_add_passage_unique_key/` 新增了段落自然键唯一索引，导入脚本可按稳定段落 id 和自然键幂等更新题库内容。
- `backend/prisma/migrations/202605150001_add_passage_paragraph_key/` 新增 `textIndex` 与 `paragraphIndex`，并将 `Passage` 唯一索引切换为自然段级唯一键；迁移会把旧数据回填为 `textIndex = passageIndex`、`paragraphIndex = 1`。
- API 运行态通过 `WORD_GOD_STORE` 选择存储：只有显式设置 `prisma` 时使用 `PrismaAppStore` 连接 PostgreSQL，未设置或设置为 `memory` 时使用内存存储与真实长段落种子题库。memory 模式会把运行态数据写入 `.dev-data/memory-store.json`，该文件是本地开发数据快照，不属于 Prisma schema。
- 认证入参校验在服务层完成：空邮箱、格式不合法邮箱和空密码不会写入 `User` 或 `AuthSession`；该修复继续使用现有表结构，不新增数据库表、字段、迁移或唯一约束。
- 认证刷新会话继续使用现有 `AuthSession` 表；`rememberLogin` 只影响 `expiresAt` 和 refresh Cookie 的 Max-Age，不新增数据库表、字段、迁移或唯一约束。
- WordCram 题库导入脚本会将富化后的自然段 upsert 到 `Passage`，并按 lemma upsert 到 `LexiconEntry`；用户阅读状态、生词主记录和上下文仍按 `passageId` 与 lemma 结算。
- 考研英语二标准化 Markdown 当前保存在 `真题题库/kaoyan-english-ii/articles/`，已按 `Text 1-4` 自然段接入默认导入白名单；`Passage` schema 不变，仍沿用 `examType + year + paper + questionType + textIndex + paragraphIndex` 自然键，并保留每段来源 URL。
- 前端“纸本文献感”视觉重构不新增字段、不新增表，也不改变现有唯一约束和结算逻辑；阅读页宽屏正文居中、左侧本篇已选列表、右侧固定 Live Note 旁批轨、普通顶部标题栏和全局认证弹窗都只调整前端布局与本地状态。生词本未登录弹窗的关闭行为只改变前端弹窗状态，不新增持久化字段。列表 `×` 删除按 lemma 更新当前段落临时标记集合，登录后标题栏显示的账号邮箱继续来自现有 `User.email`，页面仍消费当前 `Passage`、`LexiconEntry`、`ReadingAttempt`、`VocabularyEntry` 和 `VocabularyContext` 数据。
- 顶部标题栏取消吸顶只移除前端 `sticky/top/z-index` 布局类，不新增数据库表、字段、迁移、唯一约束或持久化状态。
- 阅读页“登录后继续”弹窗关闭按钮只改变前端本地弹窗状态，不写入 `ReadingAttempt`、不结算 `VocabularyEntry`，也不新增数据库表、字段、迁移或唯一约束。
- 忘记密码验证码发送前的未注册邮箱检查只读取现有 `User.email`，未命中时不写入 `EmailVerificationCode`，不新增数据库表、字段、迁移或唯一约束。
- 本机开发 CORS 兼容只调整 API 启动中间件，不新增数据库字段、表、迁移或持久化状态。
- 内存模式题库扩展为运行时读取 `content-cache/wordcram-article-passages.json`，或从英语一 WordCram articles 与英语二标准化 articles Markdown 重新抽取；Prisma 模式以 `examType = kaoyan`、`questionType = reading` 和允许来源域名白名单为准，当前白名单包含 `wordcram.com.cn`、`jixun.iqihang.com`、`kaoyan.eol.cn`、`zhenti.burningvocabulary.cn`，避免旧题库或非阅读数据混入随机阅读。
- `词库/ecdict.md` 是 ECDICT Markdown 词典资料，不新增表、字段、迁移或唯一约束；`content:import-ecdict` 会按 lemma 批量 upsert 到现有 `LexiconEntry` 表，阅读接口优先使用该表补全 token 词性和中文释义，不改变 `Passage` 表持久化内容。
- Live Note 运行时翻译不新增表、字段或迁移；翻译成功结果只保存在后端进程内缓存中，不写回 `Passage.sentences` 或 `Passage.tokens`，数据库仍以内容导入结果为持久化来源。
- 后端 ESLint 基线清理只涉及 TypeScript 格式与测试类型标注，不新增迁移，也不改变任何数据库 schema 或约束。
- 后端启动构建配置只调整 TypeScript 输出目录、共享 contracts 解析和增量缓存位置，不新增迁移，也不改变任何数据库 schema、约束或持久化状态。
- 前端 Vite 根目录 `.env` 加载修复只影响浏览器请求 API 的地址选择，不新增数据库表、字段、迁移、唯一约束或持久化状态。
# 2026-05-20 邮箱验证码数据库更新

新增 `EmailVerificationCode` 表：

- `id`
- `email`
- `purpose`
- `codeHash`
- `expiresAt`
- `consumedAt`
- `attemptCount`
- `lastSentAt`
- `createdAt`

索引：

- `email + purpose + createdAt`：查找同邮箱同用途最新验证码。
- `expiresAt`：支持后续清理过期验证码。

验证码不保存明文，只保存 bcrypt 哈希。该表不关联 `User` 外键，因为注册验证码发生在用户创建前；登录和重置密码发送阶段也需要避免通过外键暴露账号是否存在。

# 2026-05-24 内存模式持久化说明

- memory 模式的 JSON 快照保存 `User`、`AuthSession`、`EmailVerificationCode`、`ReadingAttempt`、`VocabularyEntry`、`VocabularyContext`、`LexiconEntry` 和 `CrawlJob` 对应的内存记录，使本地后端重启后仍可识别已注册账号。
- 该快照不新增数据库表、字段、迁移或唯一约束；生产和真实数据运行仍以 Prisma/PostgreSQL 为准。
- 默认路径为 `.dev-data/memory-store.json`，可通过 `WORD_GOD_MEMORY_STORE_PATH` 覆盖。
