import { defineConfig } from '@playwright/test';

/**
 * `playwrightConfig` 配置前端浏览器端到端测试。
 */
export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    headless: true,
  },
  webServer: {
    command: 'corepack pnpm exec vite --host 127.0.0.1 --port 4173 --strictPort',
    port: 4173,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
