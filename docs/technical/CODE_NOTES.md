# 开发备注

## 约束说明

- 使用 `corepack pnpm` 执行依赖安装与脚本，避免环境里缺少全局 `pnpm`。
- 当前目录最初只有 PRD 文档，项目代码、规则文档和技术文档均由本仓库生成。
- 内容抓取优先按白名单来源实现，并提供人工导入回退。

## 计划实现顺序

1. 工作区和文档骨架
2. 共享 contracts 与后端
3. 前端主流程
4. 内容管线
5. 测试、验收与文档同步

## 当前实现补充

- 前端行为测试位于 `frontend/src/app.behavior.spec.tsx`。
- 后端单元测试位于 `backend/src/**/*.spec.ts`，接口级 e2e 位于 `backend/test/app.e2e-spec.ts`。
- 浏览器级 Playwright 用例位于 `frontend/e2e/app.e2e.spec.ts`，运行前需要先安装 Chromium。
- 内容命令执行后会在仓库根目录生成 `content-cache/` 产物，便于检查抓取、规范化和入库结果。
- API 启动配置集中在 `backend/src/app-bootstrap.ts`，新增中间件或全局管道时需要让 `main.ts` 和 e2e 测试共用该配置。
- 本地前端地址变更时，使用 `CORS_ALLOWED_ORIGINS` 追加允许来源，避免浏览器跨端口请求阅读接口时被 CORS 拦截。
- `词库/` 保存可复用公开来源转换出的 Markdown 真题资料；来源、授权说明和缺失年份检查结果分别记录在 `词库/kaoyan-english-source-index.md` 与 `词库/kaoyan-english-missing-sources.md`。
