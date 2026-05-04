# WordGod

我不是词神是一个面向考研英语备考用户的词汇检测工具。产品不负责教用户背单词，而是通过历年真题段落阅读，帮助用户识别自己“背过但不熟”的词，并把这些词沉淀到生词本中持续复习。

## 仓库结构

- `frontend/`：React + Vite 前端应用，承载阅读检测、登录注册和生词本页面。
- `backend/`：NestJS API 服务，提供认证、阅读结算、生词本聚合、Prisma/PostgreSQL 存储和内部内容导入命令。
- `packages/contracts/`：前后端共享 DTO、领域类型和常量。
- `docs/`：产品文档、技术设计、编码规范和迭代记录。
- `词库/`：考研英语一/二真题 Markdown 资料与来源索引，当前覆盖 2017-2023 年可复用公开来源，2024-2026 年缺失来源记录在 `kaoyan-english-missing-sources.md`；`ecdict.md` 是 ECDICT 转换出的 MIT 英汉词典资料，可通过内容命令导入 `LexiconEntry`，但不作为真题题库导入输入。

## 开发约束

- 每次编码前先通读 `docs/business/PRD.md`、`docs/technical/ARCHITECTURE.md`、`docs/technical/DATABASE.md`。
- 每次修改代码后同步更新 README、产品文档和技术文档。
- 每个函数必须包含总结式注释，避免无语义的空洞注释。

## 前端视觉方向

V1 前端采用“纸本文献感”的阅读优先设计。界面围绕 `#E6DCCA`、`#FED8B6`、`#FFCFAB`、`#FFC2B0` 四个暖色组织，首页突出完整真题段落，词汇详情以旁批式信息面板呈现。阅读页在 `1280px` 及以上宽度使用正文居中的三列布局，Live Note 位于正文右侧空白并随滚动保持可见；窄屏仍回到正文下方，避免遮挡阅读和操作。该视觉方向只服务现有阅读检测、登录认证和生词本流程，不扩展新的考试类型或内容后台。

顶部导航会先通过 `/auth/me` 恢复当前登录态；当 access Cookie 已失效但 refresh Cookie 仍有效时，后端会补发 access Cookie。游客显示“登录 / 注册”入口，已登录用户显示“退出登录”按钮。

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

`dev:backend` 会先构建 `packages/contracts`，后端 TypeScript 再从 `packages/contracts/dist` 解析共享类型和常量，避免把共享包源码编进 `backend/dist` 导致 Nest 找不到 `dist/main.js`。contracts 和后端的增量构建缓存都写入各自 `dist/`，清理输出目录后会完整重建。

后端会读取仓库根目录 `.env`。未设置 `WORD_GOD_STORE` 或设置为 `memory` 时使用内存题库，启动时优先读取 `content-cache/word-bank-extracted-passages.json` 中已抽取的 2017-2023 考研英语一/二 Text 段落；缓存不存在时会从 `词库/` Markdown 同步抽取每篇 Text 的一个正文段，避免本地题库退化为少量兜底样例。只有显式设置 `WORD_GOD_STORE=prisma` 时才使用 PostgreSQL，此时需先准备 `DATABASE_URL` 并执行迁移。首页正文以 `passage.content` 渲染完整英文段落，token 只负责单词点击标记。

邮箱密码认证会在注册和登录时统一将邮箱去除首尾空格并转为小写。Prisma/PostgreSQL 模式下邮箱查找使用大小写不敏感匹配，已注册账号即使登录输入的邮箱大小写与注册时不同，也应能直接登录。登录表单默认勾选“30天内记住登录”，会签发 30 天刷新会话 Cookie；取消勾选时签发 24 小时刷新会话 Cookie。注册后自动登录仍沿用 30 天刷新会话。

阅读页 Live Note 的原句翻译由后端在返回段落前运行时补齐。配置 `OPENAI_API_KEY` 后，后端会通过 OpenAI Responses API 为占位译文段落生成真实中文句子翻译，并用 `OPENAI_TRANSLATION_MODEL` 指定模型，默认值为 `gpt-5-mini`。未配置 API Key、请求超时或 OpenAI 返回失败时，阅读流程继续可用，翻译区会显示“翻译暂不可用，请稍后重试。”，不会再把“自动翻译：英文原文”或“待富化”内容伪装成真实译文。运行时翻译只做进程内缓存，不写回 PostgreSQL，也不新增数据库迁移。用户选中词时显示的词性和中文释义来自后端返回的 token；后端在 Prisma 模式下优先查询 `LexiconEntry`，查不到时懒加载 `词库/ecdict.md` 并按 lemma 或表面词匹配 ECDICT 词条，仍匹配不到时保留原释义。可用 `ECDICT_MARKDOWN_PATH` 指向替代 Markdown 文件。

```powershell
$env:WORD_GOD_STORE="prisma"
corepack pnpm --filter backend prisma:migrate:dev
$env:WORD_GOD_STORE="memory"; corepack pnpm dev:backend
```

前端默认请求 `http://localhost:3000`，后端默认允许 `localhost`、`127.0.0.1`、`::1` 本机开发源以任意端口携带登录 Cookie 访问，因此 Vite 在 `5173` 被占用后自动切到 `5174` 等端口时首页仍可请求 API。若使用非本机前端地址，设置 `CORS_ALLOWED_ORIGINS`，多个来源用英文逗号分隔。首页若无法连接 API，会显示加载错误而不是一直停留在“正在载入真题段落...”。

## 测试命令

```powershell
corepack pnpm test
corepack pnpm --filter backend exec eslint "{src,apps,libs,test}/**/*.ts"
corepack pnpm --filter backend test:e2e
```

后端全量 ESLint 应保持 0 error、0 warning；格式化问题通过 Prettier 统一处理，e2e 测试中的 HTTP server 访问需要保留显式类型，避免 `any` 重新进入 lint 输出。

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

`词库/kaoyan-english-source-index.md` 记录了题库资料的来源与转换状态；新增真题资料前先确认来源允许复用，不要把禁止批量抓取或授权不明的内容放入仓库。`词库/ecdict.md` 来自 MIT 开源 ECDICT 全量 CSV 转换，`content:import-ecdict` 会按 lemma 批量 upsert 到 PostgreSQL 的 `LexiconEntry`，不写入 `Passage`，也不扩展考试题库范围；现有 `extract-word-bank` 与内存种子题库扫描只匹配 `kaoyan-english-YYYY-english-i|ii.md`。`extract-word-bank` 会从每篇 Text 随机抽取一个正文段并写入 `content-cache/word-bank-extracted-passages.json`；OpenAI Batch 命令需要 `OPENAI_API_KEY`，会生成 JSONL 输入、Batch 元数据、输出和导入错误记录，最终把富化后的段落与词典词条写入 PostgreSQL。
