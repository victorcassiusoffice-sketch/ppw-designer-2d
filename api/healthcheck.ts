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
import { Redis } from '@upstash/redis';

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
    const redisUrl = process.env.KV_REST_API_URL?.trim();
    const redisToken = process.env.KV_REST_API_TOKEN?.trim();
    studioAccessStorage = { configured: !!redisUrl && !!redisToken, reachable: false };
    if (redisUrl && redisToken) {
      try {
        const redis = new Redis({ url: redisUrl, token: redisToken, retry: { retries: 0 }, signal: AbortSignal.timeout(2000) });
        studioAccessStorage.reachable = await redis.ping() === 'PONG';
      } catch { /* Readiness is reported, without leaking configuration. */ }
    }
  }

  res.status(200);
  res.json({
    ok: true,
    service: 'ppw-designer-2d',
    env: process.env.VERCEL_ENV ?? 'unknown',
    commit: process.env.VERCEL_GIT_COMMIT_SHA ?? 'unknown',
    // Boolean only — confirms SENTRY_DSN is wired without exposing the value.
    // Vic can curl this to verify server-error capture is live in prod.
    sentryConfigured: isSentryConfigured(),
    ...(studioAccessStorage ? { studioAccessStorage } : {}),
    timestamp: new Date().toISOString(),
  });
}

export default withSentry(healthcheck);
