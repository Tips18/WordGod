# 迭代记录

## 2026-04-26

- 根据 PRD 初始化项目单仓结构。
- 锁定 V1 范围为考研英语题库、阅读检测、生词本和登录闭环。
- 技术栈确定为 React + Vite、NestJS + Prisma、PostgreSQL。
- 实现阅读检测页、登录注册页、生词本列表页和详情页。
- 实现认证接口、随机段落分发、标记同步、完成结算和生词本接口。
- 实现白名单内容抓取、规范化、翻译占位和入库命令。
- 补充前端行为测试、后端单元测试、后端 e2e 测试和 Playwright 浏览器测试脚本。
- 修复首页段落加载失败时一直显示“正在载入真题段落...”的问题，并补充前端错误态回归测试。
- 后端统一启动配置中启用本地前端开发源 CORS，确保阅读页能跨端口携带 Cookie 请求 API。

## 2026-04-28

- 将 `词库/` 目录纳入仓库，保存 2017-2023 考研英语一/二真题 Markdown 资料。
- 补充题库来源索引与 2024-2026 缺失来源记录，明确只接收允许复用的公开来源内容。

## 2026-05-04

- 拉取并对齐远端 `main` 的强制更新，保留本地未提交的阅读服务与 TypeScript 配置改动。
- 修复后端开发启动构建路径：`dev:backend` 先构建 `packages/contracts`，后端从 `packages/contracts/dist` 解析共享包，并将 contracts 与后端增量缓存写入各自 `dist/`，确保清理输出目录后仍能生成 `backend/dist/main.js`。
- 将本地后端运行模式切换到 Prisma/PostgreSQL，使用远程 `wordgod` 数据库完成 schema 同步、迁移状态标记和题库数据导入验证。
- 从现有考研英语一/二资料抽取并写入 56 篇阅读段落，同时同步 token 词条到 `LexiconEntry`；后端随机段落接口已验证可从 PostgreSQL 返回真实段落。
- 检查词典文件状态：仓库当前没有 `词库/ecdict.md` 实体文件，阅读词义优先使用数据库 `LexiconEntry`，缺失时仍保留代码中的 ECDICT Markdown 回退路径。
- 合并本轮后端构建修复到本地 `main`，并通过 `corepack pnpm test` 验证 contracts、后端 Jest 和前端 Vitest 测试。

## 2026-05-08

- 阅读页新增本篇已选生词列表：宽屏显示在正文左侧旁批轨，窄屏显示在正文下方、Live Note 之前。
- 本篇已选列表按 lemma 去重展示词面，并在每个词后提供 `×` 删除按钮；点击后会取消本篇该词的临时标记。
- 补充前端行为测试，覆盖列表展示、列表删除、重复 lemma 去重和宽屏旁批布局。

## 2026-05-15

- 将阅读题库来源切换为 `真题题库/wordcram-kaoyan/articles/` 的 WordCram 考研英语一文章资料。
- 题库抽取从“每篇 Text 抽一段”改为“每个英文自然段一条 Passage”，首页随机展示自然段级内容。
- `Passage` 新增 `textIndex` 与 `paragraphIndex`，唯一约束切换为自然段级唯一键，支持同一 Text 下多个自然段幂等入库。
- 内存模式优先读取 `content-cache/wordcram-article-passages.json`，并在缓存缺失时直接从 WordCram articles 抽取 1998-2026 英语一自然段。
- 新增考研英语二标准化文章资料，输出到 `真题题库/kaoyan-english-ii/articles/` 与 `index.json`，覆盖 2010、2013-2026 年。
- 英语二资料来源限定为启航公开文件、中国教育在线公开 HTML 与 BurningVocabulary 公开 PDF viewer，不纳入答案解析、登录、付费、下载次数或复制限制流程；2011、2012 缺少本轮选定公开来源正文，记录为失败项。

## 2026-05-17

- 将考研英语二 `Text 1-4` 自然段接入同一题库抽取、缓存、内存种子和 Prisma 随机阅读白名单。
- 英语二 `Section I Use of English` 完形段落继续保留在标准化 Markdown 中，但不进入首页随机阅读和数据库 Passage 导入集合。
- `content-cache/wordcram-article-passages.json` 重新抽取为 1021 条自然段，其中英语一 654 条、英语二 367 条。

## 2026-05-27

- 新增 Capacitor Android 工程，App 名称为 `WordGod`，包名为 `com.wordgod.app`，用于封装现有 React/Vite 前端为离线 APK。
- 前端新增 mobile runtime 本地数据层，APK 模式移除登录/注册/验证码/退出入口，使用本机默认用户保存阅读标记、生词本和最近三条上下文；Web 模式继续使用 REST API。
- 新增移动端离线资源生成脚本，默认从 1021 条考研英语一/二阅读自然段生成 APK 资源，并只抽取题库实际用到的 ECDICT 词条。
- 移动端资源生成加入严格译文校验；当前仓库缺少真实 `mobile-sentence-translations.json`，因此只能通过显式 placeholder 命令产出可安装验证包。
- Android Manifest 移除 `INTERNET` 权限，release 构建读取 git 忽略的本地 keystore 配置并输出签名 APK。

## 2026-05-30

- 手机版阅读页将 Live Note 从桌面右侧旁批改为点击词面后贴近该词出现的可关闭弹窗，弹窗展示词性、释义、原句和句子译文。
- 手机端标题栏、阅读正文 token、本篇已选列表和单词详情弹窗字号整体收紧，降低 360px 到 390px 宽屏幕上的换行、溢出和遮挡风险。
- 该改动只影响前端组件状态与 CSS，不改变 REST DTO、APK 本地存储 schema、后端数据库表或结算逻辑。

## 2026-06-01

- 移除 mobile runtime 顶部“本机离线”状态 chip，标题栏保留“阅读检测”和“生词本”两个页面入口。
- 本机默认用户、离线阅读标记、生词本、本地存储 schema 和 Web REST 认证流程保持不变。
- 手机版阅读页将“下一篇”动作区移动到“本篇已选”列表下方；桌面端仍通过 grid 把动作区放在正文列，结算逻辑和存储结构不变。
- 移除“下一篇”成功后的“已沉淀...”提示，成功结算后直接展示下一段；失败提示仍保留在动作区。
- 手机版 Live Note 单词详情弹窗支持点击弹窗外区域关闭；该行为只影响前端组件状态，不改变本地存储或结算逻辑。
- 手机版 Live Note 单词详情弹窗不再显示“翻译暂不可用，请稍后重试。”占位译文；真实译文可用时仍正常展示。
- 生词本列表的标记次数徽标改为固定小尺寸，长词义仅在左侧文本区域换行，不再拉伸或挤压徽标。

## 2026-06-16

- Web 顶部标题栏新增“下载手机版 APK”按钮，指向前端静态资源 `/downloads/wordgod.apk`。
- 静态下载文件由 `android/app/build/outputs/apk/release/app-release.apk` 同步到 `frontend/public/downloads/wordgod.apk`，便于随前端部署直接下载。
- APK 的 mobile runtime 内部不展示自下载入口；该变更只影响 Web 壳层导航和静态资源，不改变 APK 本地离线运行、认证隐藏规则或学习数据存储。

## 2026-07-05

- 将当前 Android release APK 同步到仓库根目录 `wordgod.apk`，作为 GitHub 仓库首页一级下载入口。
- 保留 `frontend/public/downloads/wordgod.apk` 作为 Web 静态下载文件；根目录 APK 与 Web 静态 APK 应来自同一 release APK。
- 该变更只调整仓库发布入口，不改变 APK 本地离线运行、Web 导航下载路径、认证隐藏规则或学习数据存储。
- 重新整理 GitHub 仓库目录：根目录只保留 `wordgod.apk` 和 `project/`，所有源码、文档、Android 工程、题库和词库资源归入 `project/`。
- 后续开发命令、文档相对路径和内部脚本均以 `project/` 为项目根目录；该调整不改变运行时逻辑、数据库 schema、APK 本地存储或 Web 下载路径。
