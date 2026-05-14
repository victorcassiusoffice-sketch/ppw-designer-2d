/**
 * GET /api/healthcheck
 *
 * Liveness probe. Returns 200 with build metadata.
 *
 * Debug switches:
 *   ?testsentry=1   — throws a synthetic error. Used to verify
 *                     the Sentry SDK is actually receiving events
 *                     after a deploy. Returns 500.
 */

import { initSentry, withSentry } from './lib/sentry.js';

interface MinimalReq {
  method?: string;
  url?: string;
  query?: Record<string, string | string[] | undefined>;
  headers: Record<string, string | string[] | undefined>;
}
interface MinimalRes {
  setHeader(name: string, value: string): void;
  status(code: number): MinimalRes;
  end(payload?: string): void;
  json(body: unknown): void;
}

async function healthcheck(req: MinimalReq, res: MinimalRes): Promise<void> {
  initSentry();

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).end();
    return;
  }

  const url = req.url ?? '';
  const testSentry = url.includes('testsentry=1') || req.query?.testsentry === '1';
  if (testSentry) {
    // Synthetic crash so we can verify Sentry capture end-to-end.
    throw new Error('[healthcheck] synthetic Sentry test error');
  }

  res.status(200);
  res.json({
    ok: true,
    service: 'ppw-designer-2d',
    env: process.env.VERCEL_ENV ?? 'unknown',
    commit: process.env.VERCEL_GIT_COMMIT_SHA ?? 'unknown',
    timestamp: new Date().toISOString(),
  });
}

export default withSentry(healthcheck);
