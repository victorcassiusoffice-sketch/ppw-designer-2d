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
    include: [
      'src/**/__tests__/**/*.test.{ts,tsx}',
      'src/**/*.test.{ts,tsx}',
      'api/**/__tests__/**/*.test.ts',
    ],
  },
});
