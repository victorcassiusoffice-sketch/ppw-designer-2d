import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import path from 'path';
import { readdir } from 'node:fs/promises';
import { firstPicturePreload } from './tools/firstPicturePreload';
import { studioEntry } from './tools/link/studioEntry';

// Sentry source-map upload runs only when an auth token is present
// (so local builds don't try to publish). SENTRY_AUTH_TOKEN +
// SENTRY_ORG + SENTRY_PROJECT are set in Vercel.
const sentryEnabled =
  !!process.env.SENTRY_AUTH_TOKEN &&
  !!process.env.SENTRY_ORG &&
  !!process.env.SENTRY_PROJECT;

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  publicDir: mode === 'olb-studio' ? false : 'public',
  plugins: [
    studioEntry(mode === 'olb-studio'),
    firstPicturePreload(),
    {
      name: 'render-product-model-manifests',
      enforce: 'pre',
      apply: 'build',
      transform(source, id) {
        if (!/\/src\/data\/product(?:Models|ModelCandidates)\.json$/.test(id)) return;
        // The renderer uses the source SKU for merchant aliases. The generation
        // reports stay in the source manifests for the offline product engine.
        const code = JSON.stringify(JSON.parse(source), (key, value) => {
          if (key !== 'source') return value;
          return typeof value?.sku === 'string' ? { sku: value.sku } : undefined;
        });
        return { code, map: null };
      },
    },
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
    {
      name: 'site-local-providers',
      configureServer(server) {
        server.middlewares.use('/api/site', async (req, res) => {
          const { handleSiteRequest } = await import('./api/_lib/site/handler');
          const originalUrl = `/api/site${req.url ?? ''}`;
          const segments = (req.url ?? '').split('?')[0].split('/').filter(Boolean);
          const adapter = {
            setHeader: (name: string, value: string) => {
              res.setHeader(name, value);
            },
            status: (code: number) => {
              res.statusCode = code;
              return adapter;
            },
            end: (payload?: string) => {
              res.end(payload);
            },
            json: (body: unknown) => {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(body));
            },
          };
          await handleSiteRequest(
            segments,
            { method: req.method, url: originalUrl, headers: req.headers },
            adapter,
          );
        });
      },
    },
    ...(sentryEnabled
      ? [
          sentryVitePlugin({
            org: process.env.SENTRY_ORG,
            project: process.env.SENTRY_PROJECT,
            authToken: process.env.SENTRY_AUTH_TOKEN,
            sourcemaps: {
              assets: [mode === 'olb-studio' ? './dist/assets/studio/**/*.{js,map}' : mode === 'olb-plumbing' ? './dist/assets/plumbing/**/*.{js,map}' : './dist/**/*.{js,map}'],
              filesToDeleteAfterUpload: [mode === 'olb-studio' ? './dist/assets/studio/**/*.map' : mode === 'olb-plumbing' ? './dist/assets/plumbing/**/*.map' : './dist/**/*.map'],
            },
            telemetry: false,
            // OMS Wave 1.10 â€” tag deploys with the Vercel commit SHA so
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
  // V-RENDER-3 (2026-05-27) â€” visible build-stamp so Vic can confirm the
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
    // VITE_TEST_HOOKS (preview-only) â†’ compiled to a literal boolean so the
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
    emptyOutDir: mode !== 'olb-studio',
    sourcemap: sentryEnabled ? 'hidden' : false,
    rollupOptions: {
      // Two HTML shells, one app: index.html (designer.ppwellness.co) and
      // olb.html (onelivebuild.com: One Live Build icons, card and
      // data-brand="olb"). middleware.ts picks the shell by host.
      input: mode === 'olb-studio' ? { studio: path.resolve(__dirname, 'src/main.tsx') } : {
        main: path.resolve(__dirname, 'index.html'),
        olb: path.resolve(__dirname, 'olb.html'),
      },
      // jsPDF references canvg + dompurify as OPTIONAL deps for its
      // SVG-to-PDF rendering. We never use those code paths (we render
      // SVG -> PNG ourselves before calling addImage), so mark them
      // external and Rollup will drop them.
      // V-RENDER-4 (2026-05-27) â€” html2canvas REMOVED from this list: it
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
        ...(mode === 'olb-studio' ? {
          entryFileNames: 'assets/studio/[name]-[hash].js',
          chunkFileNames: 'assets/studio/[name]-[hash].js',
          assetFileNames: 'assets/studio/[name]-[hash][extname]',
        } : {}),
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          const path = id.replace(/\\/g, '/');
          if (/\/node_modules\/(react|react-dom|scheduler)\//.test(path)) return 'vendor-react';
          if (/\/node_modules\/(konva|react-konva)\//.test(path)) return 'vendor-konva';
          // Ambient occlusion starts after the first full frame on supported devices.
          if (/\/three\/examples\/jsm\/(?:postprocessing|shaders)\//.test(path) || path.endsWith('/math/SimplexNoise.js')) return 'natural-effects';
          // Walk-only helpers must not grow the first-picture Three dependency.
          if (/\/three\/examples\/jsm\/controls\/PointerLockControls\.js$/.test(path)) return 'walk-controls';
          if (/\/node_modules\/three\/src\//.test(path)) return 'walk-animation';
          // 3D Mode (2026-09-17): three rides in its own chunk, pulled in by
          // the lazy ThreeStage the first time a 3D view opens â€” the 2D
          // designer's first paint never carries it.
          if (/\/node_modules\/three\//.test(path)) return 'vendor-three';
          if (/\/node_modules\/react-router/.test(path)) return 'vendor-router';
          if (/\/node_modules\/@sentry/.test(path)) return 'vendor-sentry';
          return undefined;
        },
      },
    },
  },
}));
