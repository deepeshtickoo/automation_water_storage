import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// SINGLE=1 builds one self-contained index.html (used for the preview artifact).
export default defineConfig({
  server: { proxy: { '/api': process.env.WATER_API || 'http://127.0.0.1:3000' } },
  plugins: [react(), ...(process.env.SINGLE ? [viteSingleFile()] : [])],
  base: './',
  build: { outDir: process.env.SINGLE ? 'dist-single' : '../public', emptyOutDir: true, assetsInlineLimit: process.env.SINGLE ? 100000000 : 4096 },
});
