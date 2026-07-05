# 系统架构

## 总体结构

项目采用前后端分离的 `pnpm workspace` 单仓结构：

- `frontend/`：阅读检测、生词本和全局认证弹窗 UI。
- `backend/`：REST API、认证、阅读结算、生词本聚合、内容管线和可切换应用存储。
- `packages/contracts/`：共享 DTO 和领域类型。
- `真题题库/wordcram-kaoyan/articles/`：WordCram 公开在线测试页转换出的考研英语一文章题库，作为阅读题库输入来源；每篇 Text 下按空行分隔的英文自然段是 `Passage` 最小单位。
- `真题题库/kaoyan-english-ii/articles/`：考研英语二标准化文章资料，来源为启航公开文件、中国教育在线公开 HTML 与 BurningVocabulary 公开 PDF viewer；格式与英语一文章库一致，运行时和导入流程只接入 `Text 1-4` 自然段，`Section I Use of English` 完形段落不进入随机阅读题库。
- `词库/`：保留 ECDICT 全量英汉词典 Markdown 资料，可导入 `LexiconEntry`，但不参与真题题库导入。

## 模块边界

### 前端

- 路由：`/`、`/vocabulary`、`/vocabulary/:lemma`；`/auth` 仅作为兼容入口重定向回阅读检测，不再作为可见页面。
- 主要状态：当前段落全文、当前选中 token、当前临时标记集合、登录状态、生词列表。
- 视觉系统：V1 前端采用以 `#E6DCCA`、`#FED8B6`、`#FFCFAB`、`#FFC2B0` 为主的暖色纸本文献风格。应用壳层使用普通文档流顶部标题栏，不随滚动吸顶，页面入口保留“阅读检测”和“生词本”，Web runtime 额外提供“下载手机版 APK”静态下载操作，并按 `location.pathname` 为当前页面入口切换深色背景和白色文字状态，标题下方渲染“阅读历年真题段落，点击生词展示词义并标记为生词”；阅读页以完整段落面板为主，段落卡片头部只保留试卷信息、段落标题和当前标记计数，不再重复渲染操作说明，`1280px` 及以上宽度使用正文居中的三列布局，本篇已选列表作为左侧旁批轨按 lemma 去重展示已选词面并提供 `×` 移除按钮，Live Note 作为右侧固定旁批轨承载词汇详情；手机端和 APK 模式下，“下一篇”动作区在 DOM 文档流中排在本篇已选列表后，再由桌面 grid 类放回正文列；继续成功时清空动作区状态消息并直接渲染下一段，错误时才复用该状态区展示失败原因；手机端和 APK 模式使用 `mobile-word-note` 弹窗状态替代桌面 Live Note 旁批，点击 token 后根据词面 `getBoundingClientRect()` 计算视口内坐标并显示可关闭详情弹窗，弹窗打开时用文档级 `pointerdown` 监听识别外部点击并关闭；弹窗渲染时会过滤“翻译暂不可用，请稍后重试。”占位译文，只保留英文原句和真实译文；生词本页直接渲染词条列表面板，不再渲染单独的 Priority List 说明卡片；生词本列表项在移动端默认使用更小的面板内边距、卡片内边距、词面字号、释义字号和固定尺寸次数徽标，`sm` 以上恢复桌面尺寸，长词义不参与徽标尺寸计算；认证弹窗、生词本列表和详情页复用同一套纸张面板、细线分隔、暖色状态标签和主按钮样式。

### 后端

- `auth`：注册、登录、登出、当前会话识别和刷新会话恢复；认证入口校验邮箱格式与非空密码，登录默认写入 30 天刷新会话，取消“30天内记住登录”时写入 24 小时刷新会话。
- `reading`：随机段落、ECDICT token 释义补全、运行时原句翻译、临时标记同步、完成结算、下一段分发。
- `vocabulary`：生词本列表和详情。
- `content`：白名单抓取、标准化、翻译、WordCram 文章自然段抽取、ECDICT 词典导入、DeepSeek 本地批量富化和入库命令。
- `store`：通过 `AppStore` 抽象隔离内存存储与 Prisma/PostgreSQL 存储；内存存储在应用运行时可写入本地 JSON 文件，用于保留本地开发账号和学习状态。
- `prisma`：提供 PostgreSQL schema、Prisma Client 生命周期封装和真实数据库访问基础。
- `app-bootstrap`：统一挂载 CORS、Cookie 解析和全局校验管道，允许本机开发源按 host 放行任意端口，避免生产入口与 e2e 测试配置漂移。

## 数据流

1. 用户请求随机段落。
2. 后端在返回前检查句子译文；遇到占位译文时通过 DeepSeek Chat Completions API 运行时补齐真实中文翻译，再优先查 `LexiconEntry` 补全 token 词性和中文释义，数据库无匹配时回退 `词库/ecdict.md`，最后返回段落元数据、token 列表、句子列表、译文和当前用户已标记状态。
3. 前端以 `passage.content` 渲染完整英文正文，并将可匹配 token 的词渲染为可点击标记按钮。
4. 用户本地切换 token 标记；本篇已选列表从 `selectedTokenIds` 和 token 数据派生，点击列表 `×` 会按 lemma 移除当前段落内对应标记，再同步到 `reading_attempts`。
5. 用户完成当前段落后，后端结算并更新 `vocabulary_entries` 与 `vocabulary_contexts`。
6. 前端请求生词本并展示排序结果。

## 当前实现说明

- API 通过 `WORD_GOD_STORE` 选择存储实现：只有显式设置 `prisma` 时使用 PostgreSQL，未设置或设置为 `memory` 时使用 `InMemoryAppStore` 和种子题库；应用启动会为 memory 模式启用 `.dev-data/memory-store.json`，也可通过 `WORD_GOD_MEMORY_STORE_PATH` 覆盖。
- 内存模式的种子题库启动时优先读取 `content-cache/wordcram-article-passages.json` 的抽取结果；缓存不存在或仍缺少英语二时，从 `真题题库/wordcram-kaoyan/articles/` 同步抽取 1998-2026 考研英语一 `Text 1-4` 自然段，并从 `真题题库/kaoyan-english-ii/articles/` 同步抽取 2010、2013-2026 考研英语二 `Text 1-4` 自然段，为正文单词生成可点击 token。仅在仓库题库不可用时退回两篇硬编码兜底段落。
- `InMemoryAppStore` 的持久化文件只保存运行态数据，包括用户、刷新会话、邮箱验证码、阅读临时状态、生词本、词典缓存和内容任务记录；题库段落继续由启动种子加载，避免把 1021 条默认阅读题库重复写入本地状态文件。
- `backend/src/store/prisma-app.store.ts` 已实现认证、阅读、生词本和内容基础数据的 Prisma 访问，业务服务只依赖 `AppStore` 注入令牌。
- `backend/src/auth/auth.service.ts` 在注册和登录入口统一校验邮箱和密码：邮箱必须是非空且格式合法的字符串，规整为 `trim().toLowerCase()` 后再查找或持久化；密码必须是非空字符串，避免空账号写入或缺字段触发 500。`PrismaAppStore.findUserByEmail` 使用大小写不敏感查询，保持 PostgreSQL 模式与内存模式在已注册账号登录上的行为一致。登录请求的 `rememberLogin` 缺省为 `true`，决定刷新会话和 refresh Cookie 使用 30 天或 24 小时有效期。
- `backend/src/reading/passage-translator.ts` 负责 Live Note 的运行时句子翻译：配置 `DEEPSEEK_API_KEY` 时调用 DeepSeek Chat Completions API；可通过 `DEEPSEEK_TRANSLATION_MODEL` 指定模型，默认值为 `deepseek-v4-flash`；成功结果按 `passage.id + passage.content` 做进程内缓存；缺少配置或请求失败时返回“翻译暂不可用，请稍后重试。”，不阻断阅读流程。
- `backend/src/reading/ecdict-dictionary.service.ts` 负责优先查询已入库 `LexiconEntry`，并在无匹配时懒加载 `词库/ecdict.md` 或 `ECDICT_MARKDOWN_PATH` 指定文件；阅读接口和完成结算都会使用补全后的 token，词典不可用时保留原 token 数据。
- 前端通过 `packages/contracts/` 共享 DTO 与领域类型，避免重复定义接口结构。
- 后端开发启动会先构建 `packages/contracts`，`backend/tsconfig.json` 再从 `packages/contracts/dist` 解析共享包；contracts 和后端的增量缓存都写入各自 `dist/`，确保清理输出目录后 Nest 仍能重新生成 `backend/dist/main.js`。
- `frontend/src/App.tsx` 在应用壳层加载时调用 `/auth/me` 恢复登录态；后端会在 access Cookie 失效但 refresh Cookie 有效时补发 access Cookie。全局认证弹窗和阅读拦截弹窗完成认证后会把返回用户传回应用壳层，导航在游客状态显示“登录 / 注册”弹窗按钮，在已登录状态立即显示账号邮箱和“退出登录”按钮。
- `frontend/src/App.tsx` 在 Web runtime 导航中渲染“下载手机版 APK”链接，固定指向 `/downloads/wordgod.apk` 并使用 `download="wordgod.apk"`；`frontend/public/downloads/wordgod.apk` 由当前 release APK 同步而来，mobile runtime 不渲染该链接。
- `frontend/src/App.tsx` 向受保护页面传递稳定的全局认证弹窗打开回调；生词本未登录错误触发弹窗后，关闭弹窗只清理壳层弹窗状态，不会因为 `VocabularyPage` 仍处于同一次 401 错误态而重新触发打开。
- `frontend/src/components/auth-form-card.tsx` 在登录模式显示默认勾选的“30天内记住登录”复选框，全局认证弹窗和阅读拦截弹窗都会把选择写入 `POST /auth/login` 请求体；注册模式不发送该字段。
- `frontend/src/pages/reading-page.tsx` 的阅读拦截弹窗维护在阅读页本地状态中，右上角关闭按钮只将该弹窗状态置为关闭，保留当前段落、本地标记和继续阅读流程。
- 前端视觉重构只改变现有页面结构和样式，不改变共享 DTO、路由语义或后端 API 合约。
- 阅读页宽屏旁批轨由 `frontend/src/App.tsx` 的阅读路由宽容器和 `frontend/src/pages/reading-page.tsx` 的三列布局共同实现；左侧本篇已选列表仅消费当前阅读状态并通过现有本地标记集合完成删除，不改变共享 DTO、后端 API、结算或生词本数据流。
- 后端代码质量基线要求 `src/` 与 `test/` 范围内全量 ESLint 无 error 和 warning；格式化统一由 Prettier 处理，e2e 测试的 supertest server 入口需显式类型化。
- 后端默认允许 `localhost`、`127.0.0.1`、`::1` 本机开发源跨源携带 Cookie 访问，不限制 Vite 实际端口；非本机前端源通过 `CORS_ALLOWED_ORIGINS` 扩展。
- `frontend/vite.config.ts` 通过 `envDir` 指向仓库根目录，使前端 dev server 和构建都读取同一份 `.env`；本地后端运行在 `PORT=3001` 时，前端会使用 `VITE_API_BASE_URL=http://localhost:3001`，不会错误回退到 `localhost:3000`。
- 阅读页初始接口失败时优先渲染错误态，避免无数据且已失败的查询被误判为仍在加载。
- `真题题库/wordcram-kaoyan/articles/` 当前覆盖 1998-2026 考研英语一公开文章题库；2022 文件缺失 Text 1 时抽取流程继续处理 Text 2-4，并把缺失情况写入警告缓存。
- `真题题库/kaoyan-english-ii/articles/` 当前覆盖 2010、2013-2026 考研英语二公开文章资料，每年文件包含 `Section I Use of English` 与 `Text 1-4`；`index.json` 记录来源类型、来源 URL、PDF viewer URL、段落数、词数和 2011/2012 缺源失败项，运行时只抽取 `Text 1-4`。
- `词库/ecdict.md` 由 MIT 开源 ECDICT CSV 转换生成，`content:import-ecdict` 会将其批量 upsert 到 `LexiconEntry`；真题抽取脚本只匹配 `YYYY-kaoyan-english-(i|ii)-articles.md`，不会处理词典文件。
- 题库导入流程会从英语一和英语二每篇 `Text 1-4` 抽取所有英文自然段，写入 `content-cache/wordcram-article-passages.json`，再通过 `content:create-translation-batch` 生成 DeepSeek 本地 JSONL 队列，通过 `content:import-translation-batch` 逐条调用 DeepSeek Chat Completions 生成句子翻译和 token 释义，最后以 `textIndex + paragraphIndex` 维度 upsert 到 PostgreSQL 的 `Passage` 与 `LexiconEntry`；这条批量富化链路支持按输出 `custom_id` 断点续跑，也可以用 `--skip-download` 只读取已有输出。

# 2026-05-20 邮箱验证码认证架构更新

- `auth` 模块新增 `EmailCodeService` 和 `EmailSender` 抽象。`EmailCodeService` 负责验证码生成、哈希存储、发送、频控、校验、尝试次数和消费作废；`SmtpEmailSender` 在 SMTP 配置完整时真实发送邮件，`ConsoleEmailSender` 作为缺少配置时的开发回退发送器。
- `AuthService` 继续负责用户创建、密码校验、密码重置和 access/refresh Cookie 签发；验证码注册、验证码登录和重置密码都在验证码校验成功后复用现有会话模型。
- `AuthService.sendEmailCode` 在 `reset-password` 用途下会先确认邮箱已注册；未注册邮箱返回明确业务错误，不创建验证码记录，也不调用邮件发送器。
- API 新增 `POST /auth/email-codes`、`POST /auth/login/email-code`、`POST /auth/password/reset`。已有 `POST /auth/register` 现在要求有效的 `register` 验证码。
- 存储边界通过 `AppStore` 扩展验证码记录读写方法，内存模式和 Prisma/PostgreSQL 模式保持一致行为。
- 前端 `AuthFormCard` 统一承载密码登录、验证码登录、注册和重置密码四种模式，全局认证弹窗与阅读拦截弹窗复用同一提交流程。

# 2026-05-24 内存模式持久化架构更新

- `backend/src/store/in-memory-app.store.ts` 新增可选 `persistencePath`，构造时读取 JSON 快照，写入用户、会话、验证码和学习状态时同步落盘。
- `backend/src/app.module.ts` 在 `WORD_GOD_STORE=memory` 分支传入默认持久化路径 `.dev-data/memory-store.json`；该路径属于本地开发数据，不参与版本管理。

# 2026-05-27 离线 Android APK 架构更新

- Android 交付通过 Capacitor 实现：`capacitor.config.ts` 固定 `appId = com.wordgod.app`、`appName = WordGod`、`webDir = frontend/dist`，Android 工程位于 `android/`。
- 移动端构建使用 `.env.mobile` 设置 `VITE_WORD_GOD_RUNTIME=mobile`。`frontend/src/api/client.ts` 在 Web 模式继续调用 REST API，在 mobile runtime 下懒加载 `frontend/src/api/mobile-local-client.ts` 和 `frontend/src/mobile/mobile-passages.generated.ts`。
- `MobileLocalClient` 复用 `packages/contracts` 的 DTO 形状，提供 `getRandomPassage`、`syncReadingAttempt`、`completeReadingAttempt`、`listVocabulary`、`getVocabularyDetail` 和 `getCurrentUser` 的本地实现；调用方页面不需要分叉数据结构。
- APK 内部固定返回本机默认用户，不呈现认证弹窗、注册、验证码、退出登录操作或标题栏“本机离线”状态标记；`ReadingPage` 和生词本页面继续走原有页面逻辑，但结算写入浏览器本地存储而非后端。
- `ReadingPage` 在 `VITE_WORD_GOD_RUNTIME=mobile` 或窄屏媒体查询命中时，把词汇详情从桌面右侧 Live Note 改为贴近被点击 token 的固定定位弹窗；弹窗只保存 React 本地状态，不进入 `MobileLocalClient`、`localStorage` 或 REST DTO。
- `scripts/build-mobile-assets.mjs` 从 `content-cache/wordcram-article-passages.json` 生成 1021 条离线段落资源，按实际出现在题库里的 lemma 从 `词库/ecdict.md` 抽取瘦身词典，避免把 150MB 级全量词典打入 APK。
- 移动端资源生成默认执行严格译文校验：句子译文为空、包含“自动翻译”、包含“待补齐”或包含“暂不可用”都会失败。只有显式传入 `--allow-placeholder-translations` 或设置 `WORD_GOD_ALLOW_PLACEHOLDER_TRANSLATIONS=1` 时才允许临时生成可打包资源。
- Android 工程移除 `INTERNET` 权限；当前没有引入 Capacitor 网络插件或后台服务，运行态只加载打包在 APK assets 中的 Web 资源。
- Release 签名由 `android/app/build.gradle` 读取 git 忽略的 `android/keystore.properties` 和本地 keystore；文件缺失时 release 构建会退回未签名配置，存在时输出本地签名的 `app-release.apk`。
- Windows 中文路径构建通过 `android.overridePathCheck=true` 放行；Android Maven 依赖解析优先尝试 Aliyun Google/Central 镜像，再回退官方 `google()` 与 `mavenCentral()`。
