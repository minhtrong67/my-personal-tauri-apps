import { defineConfig } from 'vite';

export default defineConfig({
  clearScreen: false,
  server: { port: 1420, strictPort: true, watch: { ignored: ['**/src-tauri/**'] } },
  build: { target: 'es2021', minify: 'esbuild', sourcemap: false, chunkSizeWarningLimit: 600 },
});
