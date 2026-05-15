/**
 * OMS Wave 5.1/5.2/5.6 — Playwright config.
 *
 * Install (once Vic approves):
 *   npm install --save-dev @playwright/test
 *   npx playwright install --with-deps chromium
 *
 * Run:
 *   npx playwright test
 *
 * BASE_URL env points at the deploy under test. Defaults to production
 * domain; CI should override to the preview URL for the current PR.
 */

import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.PPW_E2E_BASE_URL ?? 'https://designer.ppwellness.co';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // SSO-protected preview deploys need this header.
    extraHTTPHeaders: process.env.VERCEL_PROTECTION_BYPASS
      ? { 'x-vercel-protection-bypass': process.env.VERCEL_PROTECTION_BYPASS }
      : undefined,
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
