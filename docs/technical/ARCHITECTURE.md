# 系统架构

## 总体结构

项目采用前后端分离的 `pnpm workspace` 单仓结构：

- `frontend/`：阅读检测、登录注册和生词本 UI。
- `backend/`：REST API、认证、阅读结算、生词本聚合、内容管线和可切换应用存储。
- `packages/contracts/`：共享 DTO 和领域类型。
- `词库/`：离线真题 Markdown 资料、来源索引和缺失来源记录，作为内容运营输入资料，不直接作为运行时数据库。

## 模块边界

### 前端

- 路由：`/`、`/auth`、`/vocabulary`、`/vocabulary/:lemma`
- 主要状态：当前段落全文、当前选中 token、当前临时标记集合、登录状态、生词列表。
- 视觉系统：V1 前端采用以 `#E6DCCA`、`#FED8B6`、`#FFCFAB`、`#FFC2B0` 为主的暖色纸本文献风格。阅读页以完整段落面板为主，词汇详情以旁批式信息面板承载；认证页、生词本列表和详情页复用同一套纸张面板、细线分隔、暖色状态标签和主按钮样式。

### 后端

- `auth`：注册、登录、登出、当前会话识别。
- `reading`：随机段落、临时标记同步、完成结算、下一段分发。
- `vocabulary`：生词本列表和详情。
- `content`：白名单抓取、标准化、翻译、词库抽取、OpenAI Batch 富化和入库命令。
- `store`：通过 `AppStore` 抽象隔离内存存储与 Prisma/PostgreSQL 存储。
- `prisma`：提供 PostgreSQL schema、Prisma Client 生命周期封装和真实数据库访问基础。
- `app-bootstrap`：统一挂载 CORS、Cookie 解析和全局校验管道，避免生产入口与 e2e 测试配置漂移。

## 数据流

1. 用户请求随机段落。
2. 后端返回段落元数据、token 列表、句子列表、译文和当前用户已标记状态。
3. 前端以 `passage.content` 渲染完整英文正文，并将可匹配 token 的词渲染为可点击标记按钮。
4. 用户本地切换 token 标记，并同步到 `reading_attempts`。
5. 用户完成当前段落后，后端结算并更新 `vocabulary_entries` 与 `vocabulary_contexts`。
6. 前端请求生词本并展示排序结果。

## 当前实现说明

- API 通过 `WORD_GOD_STORE` 选择存储实现：只有显式设置 `prisma` 时使用 PostgreSQL，未设置或设置为 `memory` 时使用 `InMemoryAppStore` 和种子题库。
- 内存模式的种子题库使用来自 `词库/` 来源的真实考研英语长段落，并为正文单词生成可点击 token。
- `backend/src/store/prisma-app.store.ts` 已实现认证、阅读、生词本和内容基础数据的 Prisma 访问，业务服务只依赖 `AppStore` 注入令牌。
- 前端通过 `packages/contracts/` 共享 DTO 与领域类型，避免重复定义接口结构。
- 前端视觉重构只改变现有页面结构和样式，不改变共享 DTO、路由语义或后端 API 合约。
- 后端默认允许 `localhost:5173`、`127.0.0.1:5173`、`localhost:4173`、`127.0.0.1:4173` 跨源携带 Cookie 访问，其他前端源通过 `CORS_ALLOWED_ORIGINS` 扩展。
- 阅读页初始接口失败时优先渲染错误态，避免无数据且已失败的查询被误判为仍在加载。
- `词库/` 当前覆盖 2017-2023 考研英语一/二资料；2024-2026 未找到允许复用来源时只记录缺失原因，不保存授权不明内容。
- 词库导入流程会从每篇 Text 抽取一个正文段，写入 `content-cache/word-bank-extracted-passages.json`，再通过 OpenAI Batch 生成句子翻译和 token 释义，最后 upsert 到 PostgreSQL 的 `Passage` 与 `LexiconEntry`。
