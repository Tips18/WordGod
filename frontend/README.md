# Frontend

前端使用 `React + Vite + TypeScript + React Router + TanStack Query + Tailwind CSS v4`，提供以下页面：

- `/`：阅读检测页，支持单词标记、信息卡展示、游客登录弹窗拦截和继续下一篇。
- 全局认证弹窗：由顶部标题栏“登录 / 注册”、阅读拦截和生词本未登录拦截打开，登录模式默认勾选“30天内记住登录”；阅读拦截弹窗和生词本未登录弹窗可关闭，关闭后停留在当前页面。
- `/vocabulary`：生词本列表页。
- `/vocabulary/:lemma`：生词详情页。

## 主要命令

```powershell
corepack pnpm --filter frontend dev
corepack pnpm --filter frontend test
corepack pnpm --filter frontend build
corepack pnpm --filter frontend test:e2e
```

## 说明

- Vite 从仓库根目录 `.env` 读取 `VITE_API_BASE_URL`，默认开发页是 `http://localhost:5173`；未设置 API 地址时才回退到 `http://localhost:3000`。
- 顶部标题栏不随滚动吸顶，只保留“阅读检测”和“生词本”两个可见页面入口；登录后显示账号邮箱和“退出登录”按钮。
- 阅读页左侧“本篇已选”和右侧 Live Note 旁批面板不使用投影，只保留轻量纸面底色和细边框。
- 全局登录表单和阅读页登录弹窗都会把“30天内记住登录”的选择传给 `POST /auth/login`；注册模式不发送该字段。阅读页点击“下一篇”触发的登录弹窗提供右上角关闭按钮，受保护页面触发的登录弹窗关闭后不会因同一次接口错误反复弹出。
- 忘记密码发送验证码时，后端会对未注册邮箱返回“邮箱未注册，请先注册”，表单直接展示该错误并保持可编辑状态。
- Playwright 用例已经写入 `e2e/`，首次运行前需要安装浏览器：

```powershell
corepack pnpm --filter frontend exec playwright install chromium
```
## 2026-05-20 邮箱验证码认证更新

- 全局认证弹窗和阅读拦截弹窗的 `AuthFormCard` 现在提供密码登录、验证码登录、注册和忘记密码四种模式。
- 验证码登录会调用 `POST /auth/email-codes` 发送登录验证码，再调用 `POST /auth/login/email-code` 完成登录。
- 注册模式会先发送注册验证码，提交时把 `emailCode` 传给 `POST /auth/register`。
- 忘记密码模式会发送重置密码验证码，提交时把 `emailCode` 和 `newPassword` 传给 `POST /auth/password/reset`。
- 未注册邮箱不会进入忘记密码验证码倒计时，而是显示后端返回的未注册提示。
- 验证码发送按钮保留 60 秒倒计时，登录和重置密码仍会提交“30天内记住登录”的选择。
