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
            // OMS Wave 1.10 — tag deploys with the Vercel commit SHA so
            // error frames link back to the exact build.
            release: {
              name:
                process.env.VERCEL_GIT_COMMIT_SHA ??
                process.env.SENTRY_RELEASE ??
                undefined,
            },
          }),
        ]
      : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // V-RENDER-3 (2026-05-27) — visible build-stamp so Vic can confirm the
  // new bundle actually landed on his iPhone after the cache-header fix.
  // Vercel sets VERCEL_GIT_COMMIT_SHA at build; local falls back to a
  // timestamp. Surfaced bottom-left in App.tsx.
  define: {
    __APP_BUILD__: JSON.stringify(
      process.env.VERCEL_GIT_COMMIT_SHA
        ? process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7)
        : `dev-${new Date().toISOString().slice(0, 16).replace('T', ' ')}`,
    ),
    // VITE_TEST_HOOKS (preview-only) → compiled to a literal boolean so the
    // window.__designer test-hook dynamic import is dead-code-eliminated from
    // the PRODUCTION bundle (true only for a `VITE_TEST_HOOKS=1` preview build).
    __TEST_HOOKS__: JSON.stringify(
      process.env.VITE_TEST_HOOKS === '1' || process.env.VITE_TEST_HOOKS === 'true',
    ),
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
      // jsPDF references canvg + dompurify as OPTIONAL deps for its
      // SVG-to-PDF rendering. We never use those code paths (we render
      // SVG -> PNG ourselves before calling addImage), so mark them
      // external and Rollup will drop them.
      // V-RENDER-4 (2026-05-27) — html2canvas REMOVED from this list: it
      // is now a real dependency used by the "Capture full screen" button
      // (dynamically imported in RoomCanvas, so it stays in its own lazy
      // chunk and out of the main bundle). Leaving it external here would
      // emit an unresolvable bare import and break the runtime.
      external: [
        'canvg',
        'dompurify',
        /^core-js\//,
      ],
    },
  },
});
