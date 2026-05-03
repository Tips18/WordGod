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
- 本地前端地址变更时，`localhost`、`127.0.0.1` 和 `::1` 会按 host 自动放行任意端口；非本机地址仍需使用 `CORS_ALLOWED_ORIGINS` 追加允许来源，避免浏览器跨端口请求阅读接口时被 CORS 拦截。
- 认证入口会统一规整邮箱，`PrismaAppStore` 的邮箱查询保持大小写不敏感；认证回归测试覆盖注册邮箱含大小写/首尾空格后仍可用正常邮箱登录。
- 登录请求的 `rememberLogin` 缺省为 `true`；后端单测覆盖 30 天默认会话、24 小时短会话和 refresh Cookie Max-Age，e2e 覆盖仅携带 refresh Cookie 时 `/auth/me` 可恢复用户并补发 access Cookie。
- `AppShell` 的行为测试需要先模拟 `/auth/me` 响应，再模拟当前路由自己的接口；已登录导航状态应显示禁用的“已登录”按钮而不是 `/auth` 链接。
- `词库/` 保存可复用公开来源转换出的 Markdown 真题资料；来源、授权说明和缺失年份检查结果分别记录在 `词库/kaoyan-english-source-index.md` 与 `词库/kaoyan-english-missing-sources.md`。
- `词库/ecdict.md` 由 MIT 开源 ECDICT 全量 CSV 转换生成，可通过 `content:import-ecdict` 导入现有 `LexiconEntry`；真题抽取脚本按 `kaoyan-english-YYYY-english-i|ii.md` 白名单读取，不会处理该文件。
- 阅读接口通过 `backend/src/reading/ecdict-dictionary.service.ts` 优先查询 `LexiconEntry`，再回退懒加载 ECDICT Markdown，并按 token lemma 或表面词补全词性和中文释义；测试可用 `ECDICT_MARKDOWN_PATH` 指向临时 Markdown。
