import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import path from 'path';
import { readdir } from 'node:fs/promises';
import { firstPicturePreload } from './tools/firstPicturePreload';

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
    firstPicturePreload(),
    {
      name: 'defer-walk-collision-math',
      enforce: 'pre',
      resolveId(source, importer) {
        if (source === 'three' && importer?.replace(/\\/g, '/').includes('/node_modules/three-mesh-bvh/')) {
          return path.resolve(__dirname, 'src/walk/threeCollision.ts');
        }
      },
    },
    react(),
    ...(sentryEnabled
      ? [
          sentryVitePlugin({
            org: process.env.SENTRY_ORG,
            project: process.env.SENTRY_PROJECT,
            authToken: process.env.SENTRY_AUTH_TOKEN,
            sourcemaps: {
              assets: ['./dist/**/*.{js,map}'],
              filesToDeleteAfterUpload: ['./dist/**/*.map'],
            },
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
    {
      name: 'no-public-source-maps',
      apply: 'build',
      // Sentry's writeBundle upload/deletion completes before closeBundle.
      // Its deletion failures are non-fatal, so fail this build if any map remains.
      async closeBundle() {
        const files = await readdir(path.resolve(__dirname, 'dist'), { recursive: true });
        if (files.some((file) => file.endsWith('.map'))) {
          throw new Error('Public source maps remain in dist; refusing to publish this build.');
        }
      },
    },
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
    __SHOWCASE_READ_ONLY__: JSON.stringify(
      process.env.VERCEL_ENV === 'preview' || /^(1|true)$/i.test(process.env.DEMO_ONLY?.trim() ?? ''),
    ),
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
    sourcemap: sentryEnabled ? 'hidden' : false,
    rollupOptions: {
      // Two HTML shells, one app: index.html (designer.ppwellness.co) and
      // olb.html (onelivebuild.com: One Live Build icons, card and
      // data-brand="olb"). middleware.ts picks the shell by host.
      input: {
        main: path.resolve(__dirname, 'index.html'),
        olb: path.resolve(__dirname, 'olb.html'),
      },
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
      // Perf (2026-09-07): the app shipped as ONE ~900 KB chunk. Splitting the
      // stable vendors out lets the browser fetch them in parallel and keep
      // them cached across our own releases (the app chunk changes every
      // deploy; react/konva do not).
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          const path = id.replace(/\\/g, '/');
          if (/\/node_modules\/(react|react-dom|scheduler)\//.test(path)) return 'vendor-react';
          if (/\/node_modules\/(konva|react-konva)\//.test(path)) return 'vendor-konva';
          // Walk-only helpers must not grow the first-picture Three dependency.
          if (/\/three\/examples\/jsm\/controls\/PointerLockControls\.js$/.test(path)) return 'walk-controls';
          if (/\/node_modules\/three\/src\//.test(path)) return 'walk-animation';
          // 3D Mode (2026-09-17): three rides in its own chunk, pulled in by
          // the lazy ThreeStage the first time a 3D view opens — the 2D
          // designer's first paint never carries it.
          if (/\/node_modules\/three\//.test(path)) return 'vendor-three';
          if (/\/node_modules\/react-router/.test(path)) return 'vendor-router';
          if (/\/node_modules\/@sentry/.test(path)) return 'vendor-sentry';
          return undefined;
        },
      },
    },
  },
});
