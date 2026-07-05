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
- WordCram 题库导入脚本会通过 DeepSeek 本地批量富化生成句子翻译和 token 释义，再将富化后的自然段 upsert 到 `Passage`，并按 lemma upsert 到 `LexiconEntry`；用户阅读状态、生词主记录和上下文仍按 `passageId` 与 lemma 结算。
- 考研英语二标准化 Markdown 当前保存在 `真题题库/kaoyan-english-ii/articles/`，已按 `Text 1-4` 自然段接入默认导入白名单；`Passage` schema 不变，仍沿用 `examType + year + paper + questionType + textIndex + paragraphIndex` 自然键，并保留每段来源 URL。
- 前端“纸本文献感”视觉重构不新增字段、不新增表，也不改变现有唯一约束和结算逻辑；阅读页宽屏正文居中、左侧本篇已选列表、右侧固定 Live Note 旁批轨、普通顶部标题栏和全局认证弹窗都只调整前端布局与本地状态。手机端 Live Note 弹窗位置和开关状态只保存在 React 组件状态中，不写入 `ReadingAttempt`、`VocabularyEntry`、APK `localStorage` 或任何后端存储。生词本未登录弹窗的关闭行为只改变前端弹窗状态，不新增持久化字段。列表 `×` 删除按 lemma 更新当前段落临时标记集合，登录后标题栏显示的账号邮箱继续来自现有 `User.email`，页面仍消费当前 `Passage`、`LexiconEntry`、`ReadingAttempt`、`VocabularyEntry` 和 `VocabularyContext` 数据。
- 顶部标题栏取消吸顶、当前页面导航深色背景和白色文字状态、标题下方使用说明文案调整以及阅读段落卡片头部删除重复操作说明只改变前端渲染文本与布局类，不新增数据库表、字段、迁移、唯一约束或持久化状态。
- Web 顶部“下载手机版 APK”入口只渲染指向 `/downloads/wordgod.apk` 的静态链接，并由 `frontend/public/downloads/wordgod.apk` 承载 APK 文件；仓库根目录 `wordgod.apk` 仅作为 GitHub 首页一级下载入口，与 Web 静态 APK 同步自同一 release APK。两处下载文件都不写入 `User`、`ReadingAttempt`、`VocabularyEntry`、APK `localStorage` 或后端数据库，也不新增数据库表、字段、迁移、唯一约束或本地存储键。
- 阅读页“登录后继续”弹窗关闭按钮只改变前端本地弹窗状态，不写入 `ReadingAttempt`、不结算 `VocabularyEntry`，也不新增数据库表、字段、迁移或唯一约束。
- 忘记密码验证码发送前的未注册邮箱检查只读取现有 `User.email`，未命中时不写入 `EmailVerificationCode`，不新增数据库表、字段、迁移或唯一约束。
- 本机开发 CORS 兼容只调整 API 启动中间件，不新增数据库字段、表、迁移或持久化状态。
- 内存模式题库扩展为运行时读取 `content-cache/wordcram-article-passages.json`，或从英语一 WordCram articles 与英语二标准化 articles Markdown 重新抽取；Prisma 模式以 `examType = kaoyan`、`questionType = reading` 和允许来源域名白名单为准，当前白名单包含 `wordcram.com.cn`、`jixun.iqihang.com`、`kaoyan.eol.cn`、`zhenti.burningvocabulary.cn`，避免旧题库或非阅读数据混入随机阅读。
- `词库/ecdict.md` 是 ECDICT Markdown 词典资料，不新增表、字段、迁移或唯一约束；`content:import-ecdict` 会按 lemma 批量 upsert 到现有 `LexiconEntry` 表，阅读接口优先使用该表补全 token 词性和中文释义，不改变 `Passage` 表持久化内容。
- Live Note 通过 DeepSeek Chat Completions API 做运行时翻译，不新增表、字段或迁移；翻译成功结果只保存在后端进程内缓存中，不写回 `Passage.sentences` 或 `Passage.tokens`，数据库仍以 DeepSeek 内容批量富化导入结果为持久化来源。
- `content:create-translation-batch` 与 `content:import-translation-batch` 切换为 DeepSeek 本地 JSONL 队列和逐条调用后，仍只写入既有 `Passage` 与 `LexiconEntry` 表；缓存文件、输出文件和导入错误记录都属于 `content-cache/` 临时产物，不新增 Prisma schema、迁移或唯一约束。
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

# 2026-05-27 Android APK 本地存储说明

- 离线 Android APK 不新增 Prisma 表、字段、迁移、唯一约束或后端数据库依赖；APK 运行态只使用 WebView 的 `localStorage`。
- 本地存储键为 `wordgod.mobile.runtime.v1`，顶层包含 `schemaVersion`、`attempts` 和 `vocabularyEntries`。
- `attempts` 按 `passageId` 保存当前段落临时选择：`selectedTokenIds` 与 `completedAt`。同步标记时会过滤无效 token，并对 token id 去重。
- `vocabularyEntries` 按 lemma 保存本机生词本：`lemma`、`surface`、`partOfSpeech`、`definitionCn`、`markCount`、`lastMarkedAt` 和 `contexts`。
- APK 结算时同一段同一 lemma 只保存一次；不同段重复标记累计 `markCount`，并把最新上下文插入 `contexts` 前端，最多保留最近三条。
- `schemaVersion` 不匹配或本地 JSON 损坏时，APK 会回退空状态，不迁移到后端 memory JSON，也不写入 PostgreSQL。
- 离线题库资源、瘦身词典和句子译文打包在前端构建产物中，不属于数据库持久化状态；完整 `词库/ecdict.md` 不进入 APK。
- 手机端单词详情弹窗的坐标、开关状态和紧凑字号属于前端呈现层，不改变 `wordgod.mobile.runtime.v1` 的 schema，不新增本地存储键，也不触发迁移。
- 移动端标题栏移除“本机离线”状态 chip 只影响 React 渲染分支，不改变默认本机用户、`wordgod.mobile.runtime.v1` 的 schema、后端数据库表或结算逻辑。
- APK 的 mobile runtime 内部不展示“下载手机版 APK”自下载入口；该条件渲染只影响 React 壳层，不改变默认本机用户、`wordgod.mobile.runtime.v1` schema、离线题库资源、后端数据库表或结算逻辑。
- 手机端把“下一篇”动作区排到本篇已选列表下方只改变前端 DOM 顺序和 grid 布局类，不新增本地存储键，不改变 `ReadingAttempt`、`VocabularyEntry`、`wordgod.mobile.runtime.v1` schema 或任何后端数据库约束。
- 手机端和桌面端移除“下一篇”成功后的“已沉淀...”提示只改变前端状态消息渲染，不新增本地存储键，不改变 `ReadingAttempt`、`VocabularyEntry`、`wordgod.mobile.runtime.v1` schema 或任何后端数据库约束。
- 生词本列表次数徽标固定尺寸和移动端紧凑卡片只改变前端 CSS 类、flex 布局和响应式字号，不改变 `VocabularyEntry.markCount`、排序逻辑、APK 本地存储 schema 或任何后端数据库约束。
- 手机端 Live Note 弹窗外点击关闭只改变 React 组件状态和浏览器事件监听，不新增本地存储键，不写入 `ReadingAttempt`、`VocabularyEntry`、APK `localStorage` 或后端数据库。
- 手机端单词详情弹窗隐藏“翻译暂不可用，请稍后重试。”占位译文只改变前端条件渲染，不修改离线资源、`wordgod.mobile.runtime.v1` schema、后端数据库或结算记录。
