import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import path from 'path';

// Sentry source-map upload runs only when an auth token is present
// (so local builds don't try to publish). SENTRY_AUTH_TOKEN +
// SENTRY_ORG + SENTRY_PROJECT are set in Vercel.
const sentryEnabled =
  !!process.env.SENTRY_AUTH_TOKEN &&
  !!process.env.SENTRY_ORG &&
  !!process.env.SENTRY_PROJECT;

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    ...(sentryEnabled
      ? [
          sentryVitePlugin({
            org: process.env.SENTRY_ORG,
            project: process.env.SENTRY_PROJECT,
            authToken: process.env.SENTRY_AUTH_TOKEN,
            sourcemaps: { assets: ['./dist/**/*.{js,map}'] },
            telemetry: false,
          }),
        ]
      : []),
  ],
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
