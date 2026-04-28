# 系统架构

## 总体结构

项目采用前后端分离的 `pnpm workspace` 单仓结构：

- `frontend/`：阅读检测、登录注册和生词本 UI。
- `backend/`：REST API、认证、阅读结算、生词本聚合和内容管线。
- `packages/contracts/`：共享 DTO 和领域类型。
- `词库/`：离线真题 Markdown 资料、来源索引和缺失来源记录，作为内容运营输入资料，不直接作为运行时数据库。

## 模块边界

### 前端

- 路由：`/`、`/auth`、`/vocabulary`、`/vocabulary/:lemma`
- 主要状态：当前段落、当前选中 token、当前临时标记集合、登录状态、生词列表。

### 后端

- `auth`：注册、登录、登出、当前会话识别。
- `reading`：随机段落、临时标记同步、完成结算、下一段分发。
- `vocabulary`：生词本列表和详情。
- `content`：白名单抓取、标准化、翻译、入库命令。
- `prisma`：提供 PostgreSQL schema 与 Prisma Client 生命周期封装。
- `app-bootstrap`：统一挂载 CORS、Cookie 解析和全局校验管道，避免生产入口与 e2e 测试配置漂移。

## 数据流

1. 用户请求随机段落。
2. 后端返回段落元数据、token 列表、句子列表、译文和当前用户已标记状态。
3. 用户本地切换 token 标记，并同步到 `reading_attempts`。
4. 用户完成当前段落后，后端结算并更新 `vocabulary_entries` 与 `vocabulary_contexts`。
5. 前端请求生词本并展示排序结果。

## 当前实现说明

- 为了让仓库在无数据库环境下也能直接运行，API 当前默认注入 `InMemoryAppStore` 和种子题库。
- `backend/prisma/schema.prisma` 与 `backend/src/prisma/prisma.service.ts` 已准备完毕，后续切换真实 PostgreSQL 时可直接替换存储实现。
- 前端通过 `packages/contracts/` 共享 DTO 与领域类型，避免重复定义接口结构。
- 后端默认允许 `localhost:5173`、`127.0.0.1:5173`、`localhost:4173`、`127.0.0.1:4173` 跨源携带 Cookie 访问，其他前端源通过 `CORS_ALLOWED_ORIGINS` 扩展。
- 阅读页初始接口失败时优先渲染错误态，避免无数据且已失败的查询被误判为仍在加载。
- `词库/` 当前覆盖 2017-2023 考研英语一/二资料；2024-2026 未找到允许复用来源时只记录缺失原因，不保存授权不明内容。
