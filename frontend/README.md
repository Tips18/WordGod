# Frontend

前端使用 `React + Vite + TypeScript + React Router + TanStack Query + Tailwind CSS v4`，提供以下页面：

- `/`：阅读检测页，支持单词标记、信息卡展示、游客登录拦截和继续下一篇。
- `/auth`：独立登录/注册页。
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

- 默认 API 地址来自 `VITE_API_BASE_URL`，未设置时回退到 `http://localhost:3000`。
- Playwright 用例已经写入 `e2e/`，首次运行前需要安装浏览器：

```powershell
corepack pnpm --filter frontend exec playwright install chromium
```

