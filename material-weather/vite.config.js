import { defineConfig } from 'vite';

// Tauri expects a fixed dev-server port (see src-tauri/tauri.conf.json -> build.devUrl)
export default defineConfig({
  clearScreen: false,
  server: {
    host: '127.0.0.1',
    port: 1420,
    strictPort: true,
    watch: { ignored: ['**/src-tauri/**'] },
  },
  build: {
    target: process.env.TAURI_ENV_PLATFORM === 'windows' ? 'chrome105' : 'safari13',
    minify: 'esbuild',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
  },
});
