import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Mirror the build-time __APP_BUILD__ define (vite.config.ts) so any
  // test that renders App.tsx resolves the global instead of throwing.
  define: {
    __APP_BUILD__: JSON.stringify('test'),
  },
  test: {
    globals: true,
    environment: 'node',
    // Stability (2026-07-05): with the default unbounded fork pool the
    // 133-file suite intermittently loses workers on Windows (tinypool
    // "unexpected exit" → exit 1 with every test passing). Capping the
    // pool keeps memory pressure bounded; wall-time impact is small
    // because collection, not execution, dominates.
    pool: 'forks',
    poolOptions: {
      forks: {
        maxForks: 4,
        minForks: 1,
      },
    },
    include: [
      'src/**/__tests__/**/*.test.{ts,tsx}',
      'src/**/*.test.{ts,tsx}',
      'api/**/__tests__/**/*.test.ts',
    ],
  },
});
