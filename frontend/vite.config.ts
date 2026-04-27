import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * `viteConfig` 配置前端构建、测试和共享包解析。
 */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@word-god/contracts': fileURLToPath(new URL('../packages/contracts/src/index.ts', import.meta.url)),
    },
  },
});
