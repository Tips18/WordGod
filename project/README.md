# WordGod

我不是词神是一个面向考研英语备考用户的词汇检测工具。产品不负责教用户背单词，而是通过历年真题段落阅读，帮助用户识别自己“背过但不熟”的词，并把这些词沉淀到生词本中持续复习。

## 手机版下载

Android 手机用户可直接下载离线版安装包：[下载 WordGod APK](https://github.com/Tips18/WordGod/raw/main/wordgod.apk)

- 仓库一级位置：`wordgod.apk`
- 项目源码位置：`project/`
- Web 静态资源位置：`project/frontend/public/downloads/wordgod.apk`（项目内相对路径：`frontend/public/downloads/wordgod.apk`）
- 当前文件大小：约 5.6 MB
- SHA256：`99C4BE8CAC2A863C6C3DEB215A0406C9F09F963B87BD2A2B280CA10625539F28`
- 说明：APK 为本地离线模式，不依赖 Nest 后端，也不申请 Android `INTERNET` 权限。

## 仓库结构

GitHub 仓库根目录只保留 `wordgod.apk` 和 `project/`。除 `wordgod.apk` 外，以下路径均为 `project/` 内的相对路径。

- `wordgod.apk`：仓库根目录一级 Android 安装包，供 GitHub 仓库首页直接下载。
- `project/`：项目源码、文档、Android 工程、题库和词库资源的统一目录；开发命令均在该目录内执行。
- `frontend/`：React + Vite 前端应用，承载阅读检测、生词本和全局登录注册弹窗。
- `frontend/public/downloads/wordgod.apk`：Web 页面顶部“下载手机版 APK”按钮使用的静态 APK 文件。
- `backend/`：NestJS API 服务，提供认证、阅读结算、生词本聚合、Prisma/PostgreSQL 存储和内部内容导入命令。
- `packages/contracts/`：前后端共享 DTO、领域类型和常量。
- `android/`：Capacitor 生成的 Android 工程，用于封装 WordGod 离线 APK。
- `scripts/build-mobile-assets.mjs`：移动端离线题库资源生成脚本，从 1021 条考研英语一/二阅读自然段生成 Vite 可导入资源。
- `docs/`：产品文档、技术设计、编码规范和迭代记录。
- `真题题库/wordcram-kaoyan/articles/`：WordCram 公开在线测试页转换出的考研英语一文章题库，当前覆盖 1998-2026 年；每篇 Text 下的英文自然段是首页和数据库的最小阅读单位。
- `真题题库/kaoyan-english-ii/articles/`：从启航公开文件、中国教育在线公开 HTML、BurningVocabulary 公开 PDF viewer 标准化出的考研英语二文章资料，当前生成 2010、2013-2026 年 Markdown；运行时和入库流程只接入 `Text 1-4` 自然段，`Section I Use of English` 完形段落不进入随机阅读题库，2011、2012 因本轮选定来源未找到可标准化正文而记录在索引失败项中。
- `词库/`：保留 ECDICT 等词典资料；`ecdict.md` 可通过内容命令导入 `LexiconEntry`，但不作为真题题库导入输入。

## 开发约束

- 从仓库根目录进入开发时，先切换到 `project/`，再按下列文档和命令执行。
- 每次编码前先通读 `docs/business/PRD.md`、`docs/technical/ARCHITECTURE.md`、`docs/technical/DATABASE.md`。
- 每次修改代码后同步更新 README、产品文档和技术文档。
- 每个函数必须包含总结式注释，避免无语义的空洞注释。

## 前端视觉方向

V1 前端采用“纸本文献感”的阅读优先设计。界面围绕 `#E6DCCA`、`#FED8B6`、`#FFCFAB`、`#FFC2B0` 四个暖色组织，首页突出完整真题段落，词汇详情以旁批式信息面板呈现。阅读页在 `1280px` 及以上宽度使用正文居中的三列布局，本篇已选列表位于正文左侧并按 lemma 去重展示已选词面，每个词后的 `×` 按钮可从本篇标记中移除该词；Live Note 位于正文右侧空白并随滚动保持可见。两个旁批面板不使用投影，只保留轻量纸面底色和细边框。窄屏和 APK 移动端时，本篇已选列表回到正文下方，“下一篇”动作区排在本篇已选列表下方，继续成功后直接切到下一段，不在按钮旁展示“已沉淀...”提示；Live Note 改为点击词面后出现在词附近的可关闭弹窗，用户可点右上角 `×` 或点击弹窗外区域收起；弹窗只在真实译文可用时显示译文行，不展示“翻译暂不可用，请稍后重试。”占位提示；手机端标题、正文 token、已选列表和弹窗字号整体收紧，避免文本挤出屏幕或遮挡阅读。该视觉方向只服务现有阅读检测、登录认证和生词本流程，不扩展新的考试类型或内容后台。

顶部标题栏采用普通文档流纸张面板，不随滚动吸顶，页面入口保留“阅读检测”和“生词本”，Web 模式额外提供“下载手机版 APK”静态下载操作，当前页面对应入口使用深色背景和白色文字提示；标题下方展示使用说明“阅读历年真题段落，点击生词展示词义并标记为生词”，阅读段落卡片头部不再重复展示操作说明。导航会先通过 `/auth/me` 恢复当前登录态；当 access Cookie 已失效但 refresh Cookie 仍有效时，后端会补发 access Cookie。游客显示“登录 / 注册”按钮并打开全局认证弹窗，已登录用户显示账号邮箱和“退出登录”按钮。阅读拦截、生词本未登录拦截和顶部入口都复用同一套登录/注册/验证码登录/重置密码表单；“下一篇”触发的阅读拦截弹窗和生词本未登录弹窗都允许用户关闭，关闭后留在当前页面。完成认证后应用壳层会直接接收返回用户并刷新导航，无需整页刷新。

生词本页进入后直接展示词条列表，不再展示单独的 Priority List 说明卡片。列表仍按标记次数倒序展示；移动端词卡使用更紧凑的内边距、词面字号、释义字号和次数徽标尺寸，较宽屏再恢复桌面尺寸。每条词卡右侧的次数徽标保持固定小尺寸，不随词义长短变大；较长词义只在左侧文本区换行，避免挤压计数状态。

## 启动方式

项目代码位于仓库根目录的 `project/` 中。克隆仓库后先进入项目目录：

```powershell
Set-Location .\project
```

项目使用 `pnpm workspace` 管理。若本机未安装 `pnpm`，先执行：

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

Vite 前端默认运行在 `http://localhost:5173`，后端按项目根目录 `.env` 中的 `PORT` 运行；当前本地配置为 `3001`。`http://localhost:3000` 只有在另有服务监听时才可访问，默认开发入口不是 3000。

`dev:backend` 会先构建 `packages/contracts`，后端 TypeScript 再从 `packages/contracts/dist` 解析共享类型和常量，避免把共享包源码编进 `backend/dist` 导致 Nest 找不到 `dist/main.js`。contracts 和后端的增量构建缓存都写入各自 `dist/`，清理输出目录后会完整重建。

后端会读取项目根目录 `.env`。未设置 `WORD_GOD_STORE` 或设置为 `memory` 时使用内存题库，启动时优先读取 `content-cache/wordcram-article-passages.json` 中已抽取的考研英语一/二自然段；缓存不存在或仍只有英语一旧数据时，会从 `真题题库/wordcram-kaoyan/articles/` 与 `真题题库/kaoyan-english-ii/articles/` 同步抽取 1021 条 `Text 1-4` 自然段，避免本地题库退化为少量兜底样例。memory 模式会把用户、刷新会话、邮箱验证码、生词本和阅读临时状态写入 `.dev-data/memory-store.json`，因此后端重启后本地注册账号仍可登录；可用 `WORD_GOD_MEMORY_STORE_PATH` 覆盖该路径。只有显式设置 `WORD_GOD_STORE=prisma` 时才使用 PostgreSQL，此时需先准备 `DATABASE_URL` 并执行迁移。首页正文以 `passage.content` 渲染完整英文自然段，token 只负责单词点击标记。

邮箱密码认证会在注册和登录时统一将邮箱去除首尾空格并转为小写，并拒绝空邮箱、格式不合法邮箱和空密码，避免接口缺字段导致 500 或写入空账号。Prisma/PostgreSQL 模式下邮箱查找使用大小写不敏感匹配，已注册账号即使登录输入的邮箱大小写与注册时不同，也应能直接登录。登录表单默认勾选“30天内记住登录”，会签发 30 天刷新会话 Cookie；取消勾选时签发 24 小时刷新会话 Cookie。注册后自动登录仍沿用 30 天刷新会话。

忘记密码发送验证码前会检查邮箱是否已注册；未注册邮箱返回“邮箱未注册，请先注册”，不会进入发送成功倒计时，避免用户等待一封不会投递的重置密码邮件。

阅读页 Live Note 的原句翻译由后端在返回段落前运行时补齐。配置 `DEEPSEEK_API_KEY` 后，后端会通过 DeepSeek Chat Completions API 为占位译文段落生成真实中文句子翻译，并用 `DEEPSEEK_TRANSLATION_MODEL` 指定模型，默认值为 `deepseek-v4-flash`。未配置 API Key、请求超时或 DeepSeek 返回失败时，阅读流程继续可用，桌面翻译区会显示“翻译暂不可用，请稍后重试。”，手机端单词详情弹窗会省略该占位译文行，不会再把“自动翻译：英文原文”或“待富化”内容伪装成真实译文。运行时翻译只做进程内缓存，不写回 PostgreSQL，也不新增数据库迁移。用户选中词时显示的词性和中文释义来自后端返回的 token；后端在 Prisma 模式下优先查询 `LexiconEntry`，查不到时懒加载 `词库/ecdict.md` 并按 lemma 或表面词匹配 ECDICT 词条，仍匹配不到时保留原释义。可用 `ECDICT_MARKDOWN_PATH` 指向替代 Markdown 文件。

```powershell
$env:WORD_GOD_STORE="prisma"
corepack pnpm --filter backend prisma:migrate:dev
$env:WORD_GOD_MEMORY_STORE_PATH="D:\word-god-memory-store.json"
$env:WORD_GOD_STORE="memory"; corepack pnpm dev:backend
```

前端 Vite 配置会从项目根目录 `.env` 读取 `VITE_API_BASE_URL`，未设置时才回退到 `http://localhost:3000`。当前本地 `.env` 可将前端 API 指向 `http://localhost:3001`；后端默认允许 `localhost`、`127.0.0.1`、`::1` 本机开发源以任意端口携带登录 Cookie 访问，因此 Vite 在 `5173` 被占用后自动切到 `5174` 等端口时首页仍可请求 API。若使用非本机前端地址，设置 `CORS_ALLOWED_ORIGINS`，多个来源用英文逗号分隔。首页若无法连接 API，会显示加载错误而不是一直停留在“正在载入真题段落...”。

## Android 离线 APK

Android APK 使用 Capacitor 封装现有 React/Vite 前端。App 名称为 `WordGod`，包名为 `com.wordgod.app`。APK 构建时设置 `VITE_WORD_GOD_RUNTIME=mobile`，前端会改走本地离线客户端：不请求 Nest 后端，不展示登录/注册/退出入口，也不在标题栏展示“本机离线”状态 chip，使用本机默认用户保存阅读临时状态、生词本、标记次数和最近三条上下文。移动端阅读页会隐藏桌面 Live Note 旁批，改用贴近被点词的可关闭单词详情弹窗展示词性、释义、原句和译文，并压缩窄屏字号。Android Manifest 已移除 `INTERNET` 权限。

GitHub 仓库首页一级安装包为根目录 `wordgod.apk`；Web 端标题栏的“下载手机版 APK”按钮指向 `/downloads/wordgod.apk`，对应仓库文件为 `project/frontend/public/downloads/wordgod.apk`（项目内相对路径：`frontend/public/downloads/wordgod.apk`）。两个 APK 文件当前都由 `project/android/app/build/outputs/apk/release/app-release.apk` 同步而来，应保持内容一致。Web 下载入口只在 Web runtime 显示，APK 的 mobile runtime 内部不展示自下载入口。

构建前需要 JDK 21、Android SDK Platform 36、Build Tools 36 和 Platform Tools。当前 Windows 中文路径构建依赖 `android.overridePathCheck=true`；`android/build.gradle` 同时配置了 Aliyun Maven 镜像作为 Google Maven/Maven Central 访问不稳定时的兜底。

严格移动端资源构建要求 `content-cache/mobile-sentence-translations.json` 提供真实中文句子译文；缺失或出现“自动翻译”“待补齐”“暂不可用”等占位内容时会失败。当前仓库尚未包含该真实译文缓存，因此只能用显式 placeholder 命令产出可安装 APK，内容验收前必须补齐缓存后改用严格命令。

```powershell
# 严格资源构建，要求真实译文缓存
corepack pnpm android:debug
corepack pnpm android:release

# 临时打包路径，资源内缺失译文仍为“翻译暂不可用，请稍后重试。”，手机端弹窗会隐藏该占位行
corepack pnpm android:debug:placeholder
corepack pnpm android:release:placeholder
```

Release 签名使用本地 keystore。签名文件和密码文件位于 git 忽略路径，不应提交：

```text
android/keystores/wordgod-release.jks
android/keystore.properties
```

如需重新生成本地签名材料，先删除上述两个文件，再运行本地 keystore 生成命令或使用 Android Studio/`keytool` 生成 `wordgod` alias，并在 `android/keystore.properties` 写入：

```properties
storeFile=keystores/wordgod-release.jks
storePassword=...
keyAlias=wordgod
keyPassword=...
```

构建产物路径：

```text
android/app/build/outputs/apk/debug/app-debug.apk
android/app/build/outputs/apk/release/app-release.apk
```

## 测试命令

```powershell
corepack pnpm test
corepack pnpm --filter @word-god/contracts build
corepack pnpm --filter backend exec eslint "{src,apps,libs,test}/**/*.ts"
corepack pnpm --filter backend test:e2e
```

后端全量 ESLint 依赖 `packages/contracts/dist` 中的共享类型，独立运行前需要先构建 contracts；ESLint 应保持 0 error、0 warning。格式化问题通过 Prettier 统一处理，e2e 测试中的 HTTP server 访问需要保留显式类型，避免 `any` 重新进入 lint 输出。

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
corepack pnpm --filter backend content:import-ecdict
```

`真题题库/wordcram-kaoyan/articles/` 和 `真题题库/kaoyan-english-ii/articles/` 是当前阅读题库默认输入来源；新增真题资料前先确认来源允许复用，不要把禁止批量抓取或授权不明的内容放入仓库。英语二接入只处理 `Text 1-4`，不导入 `Section I Use of English`，也不新增前台考试类型筛选。`词库/ecdict.md` 来自 MIT 开源 ECDICT 全量 CSV 转换，`content:import-ecdict` 会按 lemma 批量 upsert 到 PostgreSQL 的 `LexiconEntry`，不写入 `Passage`，也不扩展考试题库范围。`extract-word-bank` 会将每个 Text 下按空行分隔的英文自然段写入 `content-cache/wordcram-article-passages.json`，并把缺失 Text 等问题写入 `content-cache/wordcram-article-warnings.json`；题库批量富化使用 DeepSeek 本地 JSONL 队列，`content:create-translation-batch` 生成 `deepseek-translation-batch-input.jsonl` 和元数据，`content:import-translation-batch` 需要 `DEEPSEEK_API_KEY` 并会逐条调用 DeepSeek Chat Completions 补齐缺失输出，输出、导入错误记录和幂等入库结果都写入 `content-cache/`。传入 `--skip-download` 时不会调用 DeepSeek，只读取已有输出并导入 PostgreSQL。

## 2026-05-20 邮箱验证码认证更新

- 认证模块现在支持邮箱验证码注册、邮箱验证码登录和邮箱验证码重置密码，同时保留邮箱密码登录。
- 新增接口：`POST /auth/email-codes`、`POST /auth/login/email-code`、`POST /auth/password/reset`。
- 忘记密码发送验证码时，未注册邮箱会返回明确错误，不会静默返回成功。
- 配置 `SMTP_HOST`、`SMTP_PORT`、`SMTP_USER`、`SMTP_PASS`、`SMTP_FROM`、`SMTP_SECURE` 后会通过 SMTP 真实发送验证码邮件；缺少 SMTP 配置时开发环境回退到 console sender。
- Prisma 模式新增 `EmailVerificationCode` 表；使用 PostgreSQL 前需要执行 `corepack pnpm --filter backend prisma:generate` 和迁移命令。

## 2026-05-24 内存模式持久化更新

- `WORD_GOD_STORE=memory` 现在默认使用 `.dev-data/memory-store.json` 保存运行态数据，后端重启后保留本地注册用户、刷新会话、邮箱验证码、生词本和阅读临时状态。
- `.dev-data/` 已加入忽略列表；如需改到其他位置，设置 `WORD_GOD_MEMORY_STORE_PATH`。
