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

import { initSentry, withSentry, isSentryConfigured } from './_lib/sentry.js';
import { neon } from '@neondatabase/serverless';

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

  // Optional read-only connectivity check. Never echo provider URLs, tokens,
  // raw exception messages or database contents in this public health route.
  let studioAccessStorage: { configured: boolean; reachable: boolean } | undefined;
  if (url.includes('studioAccess=1') || req.query?.studioAccess === '1') {
    const databaseUrl = [process.env.DATABASE_URL, process.env.POSTGRES_URL, process.env.POSTGRES_DATABASE_URL, process.env.POSTGRES_PRISMA_URL].map((value) => value?.trim()).find(Boolean);
    studioAccessStorage = { configured: !!databaseUrl, reachable: false };
    if (databaseUrl) {
      try {
        const rows = await neon(databaseUrl)('SELECT 1 AS ready', [], { fetchOptions: { signal: AbortSignal.timeout(2000) } });
        studioAccessStorage.reachable = rows[0]?.ready === 1;
      } catch { /* Readiness is reported, without leaking configuration. */ }
    }
  }

  res.status(200);
  res.json({
    ok: true,
    service: 'ppw-designer-2d',
    env: process.env.VERCEL_ENV ?? 'unknown',
    commit: process.env.VERCEL_GIT_COMMIT_SHA ?? 'unknown',
    sentryConfigured: isSentryConfigured(),
    ...(studioAccessStorage ? { studioAccessStorage } : {}),
    timestamp: new Date().toISOString(),
  });
}

export default withSentry(healthcheck);
