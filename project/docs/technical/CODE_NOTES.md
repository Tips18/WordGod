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
- `frontend/vite.config.ts` 的 `envDir` 指向仓库根目录，确保 `corepack pnpm --filter frontend dev` 能读取根目录 `.env` 中的 `VITE_API_BASE_URL`；后端跑在 `PORT=3001` 时，浏览器端不再回退请求 `localhost:3000`。
- 认证入口会先校验邮箱格式和非空密码，再统一规整邮箱；`PrismaAppStore` 的邮箱查询保持大小写不敏感。认证回归测试覆盖注册邮箱含大小写/首尾空格后仍可用正常邮箱登录，以及空邮箱、空密码和缺失邮箱不会创建账号或触发 TypeError。
- 登录请求的 `rememberLogin` 缺省为 `true`；后端单测覆盖 30 天默认会话、24 小时短会话和 refresh Cookie Max-Age，e2e 覆盖仅携带 refresh Cookie 时 `/auth/me` 可恢复用户并补发 access Cookie。
- `AppShell` 的行为测试需要先模拟 `/auth/me` 响应，再模拟当前路由自己的接口；已登录导航状态应显示“退出登录”按钮而不是 `/auth` 链接，独立登录页完成认证后也需要立即刷新该导航状态。
- `AppShell` 顶部标题栏保持普通文档流布局，不使用 `sticky`、`top-4` 或 `z-40`；行为测试覆盖该 header 不再吸顶。
- 阅读页“下一篇”触发的登录拦截弹窗在 `frontend/src/pages/reading-page.tsx` 内部维护开关状态，关闭按钮使用 `aria-label="关闭登录弹窗"`，行为测试覆盖关闭后弹窗消失且仍停留在阅读页。
- `真题题库/wordcram-kaoyan/articles/` 保存 WordCram 公开在线测试页转换出的考研英语一文章资料；真题抽取脚本按 `YYYY-kaoyan-english-i-articles.md` 白名单读取，并把 Text 缺失等问题写入 `content-cache/wordcram-article-warnings.json`。
- `真题题库/temp/build_english_ii_articles.py` 负责生成 `真题题库/kaoyan-english-ii/articles/` 与 `index.json`；脚本按年份优先选择 BurningVocabulary 公开 PDF viewer、EOL 公开 HTML、启航公开文件，输出格式与英语一 Markdown 保持一致，并由 `真题题库/temp/test_build_english_ii_articles.py` 覆盖公开 PDF URL 解析和自然段保留逻辑。
- `词库/ecdict.md` 由 MIT 开源 ECDICT 全量 CSV 转换生成，可通过 `content:import-ecdict` 导入现有 `LexiconEntry`；真题抽取脚本不会处理该文件。
- 阅读接口通过 `backend/src/reading/ecdict-dictionary.service.ts` 优先查询 `LexiconEntry`，再回退懒加载 ECDICT Markdown，并按 token lemma 或表面词补全词性和中文释义；测试可用 `ECDICT_MARKDOWN_PATH` 指向临时 Markdown。
- 阅读页本篇已选列表由前端从 `selectedTokenIds` 与 token 数据派生，按 lemma 去重展示词面；列表 `×` 删除按钮会按 lemma 更新当前段落本地标记集合，不新增接口或持久化字段。
- `Passage` 新增 `textIndex` 与 `paragraphIndex` 表达同一 Text 下的自然段维度；`passageIndex` 暂等同于 `textIndex` 以兼容既有前端和结算语义。

# 2026-05-20 邮箱验证码认证实现备注

- `backend/src/auth/email-code.service.ts` 是验证码生命周期的唯一业务入口，测试覆盖发送、重发限制、过期、错误、尝试次数、消费和复用失败。
- `backend/src/auth/email-sender.ts` 定义发送器接口；`SmtpEmailSender` 使用 `nodemailer` 通过 SMTP 真实发送验证码邮件，`ConsoleEmailSender` 只在 SMTP 配置缺失时输出日志。
- `backend/src/auth/auth.service.ts` 通过 `EmailCodeService` 校验 `register`、`login`、`reset-password` 三类验证码，再复用原会话签发逻辑。
- `frontend/src/app.behavior.spec.tsx` 覆盖独立认证页的验证码登录、验证码注册和验证码重置密码请求体，确保现有表单入口不再悬空。
- `backend/src/auth/auth.service.spec.ts` 覆盖未注册邮箱请求忘记密码验证码时返回“邮箱未注册，请先注册”，防止接口静默成功但不投递邮件。
- 新增或修改认证函数时仍需保持总结式注释，并同步更新 contracts、内存存储、Prisma 存储和文档。

# 2026-05-24 内存模式持久化实现备注

- `backend/src/store/in-memory-app.store.ts` 支持第二个构造参数 `{ persistencePath }`；传入路径时会在构造阶段读取 JSON 快照，并在运行态写操作后同步保存。
- `backend/src/app.module.ts` 仅在 `WORD_GOD_STORE` 未设置或等于 `memory` 时传入默认持久化文件 `.dev-data/memory-store.json`；`WORD_GOD_MEMORY_STORE_PATH` 可覆盖该路径。
- `backend/src/store/in-memory-app.store.spec.ts` 覆盖保存用户后新建 store 实例仍能恢复该用户，防止本地注册账号在后端重启后丢失。
