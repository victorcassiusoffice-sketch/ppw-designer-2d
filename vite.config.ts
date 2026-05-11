import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    host: '127.0.0.1',
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      // jsPDF references html2canvas + canvg + dompurify as OPTIONAL
      // deps for SVG-to-PDF rendering. We never use those code paths
      // (we render SVG -> PNG ourselves before calling addImage), so
      // mark them external and Rollup will drop them.
      external: [
        'canvg',
        'html2canvas',
        'dompurify',
        /^core-js\//,
      ],
    },
  },
});
