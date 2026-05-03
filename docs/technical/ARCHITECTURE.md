# 系统架构

## 总体结构

项目采用前后端分离的 `pnpm workspace` 单仓结构：

- `frontend/`：阅读检测、登录注册和生词本 UI。
- `backend/`：REST API、认证、阅读结算、生词本聚合、内容管线和可切换应用存储。
- `packages/contracts/`：共享 DTO 和领域类型。
- `词库/`：离线真题 Markdown 资料、来源索引和缺失来源记录，作为内容运营输入资料，不直接作为运行时数据库；`ecdict.md` 是 ECDICT 全量英汉词典的 Markdown 资料，可导入 `LexiconEntry`，但不参与真题题库导入。

## 模块边界

### 前端

- 路由：`/`、`/auth`、`/vocabulary`、`/vocabulary/:lemma`
- 主要状态：当前段落全文、当前选中 token、当前临时标记集合、登录状态、生词列表。
- 视觉系统：V1 前端采用以 `#E6DCCA`、`#FED8B6`、`#FFCFAB`、`#FFC2B0` 为主的暖色纸本文献风格。阅读页以完整段落面板为主，词汇详情以旁批式信息面板承载；认证页、生词本列表和详情页复用同一套纸张面板、细线分隔、暖色状态标签和主按钮样式。

### 后端

- `auth`：注册、登录、登出、当前会话识别和刷新会话恢复；登录默认写入 30 天刷新会话，取消“30天内记住登录”时写入 24 小时刷新会话。
- `reading`：随机段落、ECDICT token 释义补全、运行时原句翻译、临时标记同步、完成结算、下一段分发。
- `vocabulary`：生词本列表和详情。
- `content`：白名单抓取、标准化、翻译、词库抽取、ECDICT 词典导入、OpenAI Batch 富化和入库命令。
- `store`：通过 `AppStore` 抽象隔离内存存储与 Prisma/PostgreSQL 存储。
- `prisma`：提供 PostgreSQL schema、Prisma Client 生命周期封装和真实数据库访问基础。
- `app-bootstrap`：统一挂载 CORS、Cookie 解析和全局校验管道，允许本机开发源按 host 放行任意端口，避免生产入口与 e2e 测试配置漂移。

## 数据流

1. 用户请求随机段落。
2. 后端在返回前检查句子译文；遇到占位译文时通过 OpenAI Responses API 运行时补齐真实中文翻译，再优先查 `LexiconEntry` 补全 token 词性和中文释义，数据库无匹配时回退 `词库/ecdict.md`，最后返回段落元数据、token 列表、句子列表、译文和当前用户已标记状态。
3. 前端以 `passage.content` 渲染完整英文正文，并将可匹配 token 的词渲染为可点击标记按钮。
4. 用户本地切换 token 标记，并同步到 `reading_attempts`。
5. 用户完成当前段落后，后端结算并更新 `vocabulary_entries` 与 `vocabulary_contexts`。
6. 前端请求生词本并展示排序结果。

## 当前实现说明

- API 通过 `WORD_GOD_STORE` 选择存储实现：只有显式设置 `prisma` 时使用 PostgreSQL，未设置或设置为 `memory` 时使用 `InMemoryAppStore` 和种子题库。
- 内存模式的种子题库启动时优先读取 `content-cache/word-bank-extracted-passages.json` 的抽取结果；缓存不存在或仍是旧规模样例时，从 `词库/` 中 2017-2023 考研英语一/二 Markdown 同步抽取每篇 Text 的一个正文段，并为正文单词生成可点击 token。仅在仓库词库不可用时退回两篇硬编码兜底段落。
- `backend/src/store/prisma-app.store.ts` 已实现认证、阅读、生词本和内容基础数据的 Prisma 访问，业务服务只依赖 `AppStore` 注入令牌。
- `backend/src/auth/auth.service.ts` 在注册和登录入口统一规整邮箱为 `trim().toLowerCase()`；`PrismaAppStore.findUserByEmail` 使用大小写不敏感查询，保持 PostgreSQL 模式与内存模式在已注册账号登录上的行为一致。登录请求的 `rememberLogin` 缺省为 `true`，决定刷新会话和 refresh Cookie 使用 30 天或 24 小时有效期。
- `backend/src/reading/passage-translator.ts` 负责 Live Note 的运行时句子翻译：配置 `OPENAI_API_KEY` 时调用 Responses API；成功结果按 `passage.id + passage.content` 做进程内缓存；缺少配置或请求失败时返回“翻译暂不可用，请稍后重试。”，不阻断阅读流程。
- `backend/src/reading/ecdict-dictionary.service.ts` 负责优先查询已入库 `LexiconEntry`，并在无匹配时懒加载 `词库/ecdict.md` 或 `ECDICT_MARKDOWN_PATH` 指定文件；阅读接口和完成结算都会使用补全后的 token，词典不可用时保留原 token 数据。
- 前端通过 `packages/contracts/` 共享 DTO 与领域类型，避免重复定义接口结构。
- `frontend/src/App.tsx` 在应用壳层加载时调用 `/auth/me` 恢复登录态；后端会在 access Cookie 失效但 refresh Cookie 有效时补发 access Cookie。导航在游客状态显示 `/auth` 链接，在已登录状态显示禁用的“已登录”按钮作为状态提示。
- `frontend/src/components/auth-form-card.tsx` 在登录模式显示默认勾选的“30天内记住登录”复选框，独立登录页和阅读拦截弹窗都会把选择写入 `POST /auth/login` 请求体；注册模式不发送该字段。
- 前端视觉重构只改变现有页面结构和样式，不改变共享 DTO、路由语义或后端 API 合约。
- 后端代码质量基线要求 `src/` 与 `test/` 范围内全量 ESLint 无 error 和 warning；格式化统一由 Prettier 处理，e2e 测试的 supertest server 入口需显式类型化。
- 后端默认允许 `localhost`、`127.0.0.1`、`::1` 本机开发源跨源携带 Cookie 访问，不限制 Vite 实际端口；非本机前端源通过 `CORS_ALLOWED_ORIGINS` 扩展。
- 阅读页初始接口失败时优先渲染错误态，避免无数据且已失败的查询被误判为仍在加载。
- `词库/` 当前覆盖 2017-2023 考研英语一/二资料；2024-2026 未找到允许复用来源时只记录缺失原因，不保存授权不明内容。
- `词库/ecdict.md` 由 MIT 开源 ECDICT CSV 转换生成，`content:import-ecdict` 会将其批量 upsert 到 `LexiconEntry`；现有真题词库扫描通过 `kaoyan-english-YYYY-english-i|ii.md` 文件名白名单排除该文件。
- 词库导入流程会从每篇 Text 抽取一个正文段，写入 `content-cache/word-bank-extracted-passages.json`，再通过 OpenAI Batch 生成句子翻译和 token 释义，最后 upsert 到 PostgreSQL 的 `Passage` 与 `LexiconEntry`。
