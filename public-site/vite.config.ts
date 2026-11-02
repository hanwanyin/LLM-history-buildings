import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
export default defineConfig({
  root: path.resolve('public-site'),
  base: '/LLM-history-buildings/',
  publicDir: path.resolve('work/pages-public'),
  plugins: [react()],
  define: { __PAGES_MIRROR__: 'true', __PAGES_BASE__: JSON.stringify('/LLM-history-buildings/') },
  build: { outDir: path.resolve('outputs/github-pages'), emptyOutDir: true, chunkSizeWarningLimit: 1200 },
});
