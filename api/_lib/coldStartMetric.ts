/**
 * OMS Wave 4.12 — lambda cold-start budget tracking.
 *
 * Records each invocation's wall-clock startup time to a KV-backed
 * rolling window (last 100 samples per endpoint). The /api/admin/stats
 * endpoint surfaces the p95 so Vic can spot regressions before they
 * page him via Sentry.
 *
 * Alert threshold: p95 > 2000 ms — surface via Sentry captureMessage
 * at level=warning so the existing Sentry rules pick it up. Free-tier:
 * no Sentry custom metric usage, only message capture.
 */

import { Redis } from '@upstash/redis';
import { captureMessage } from './sentry.js';

const WINDOW_SIZE = 100;
const P95_ALERT_MS = 2000;

let _redis: Redis | null = null;
function getRedis(): Redis | null {
  if (_redis) return _redis;
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  _redis = new Redis({ url, token });
  return _redis;
}

/**
 * Record a sample. Best-effort; never throws.
 */
export async function recordColdStart(endpoint: string, ms: number): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    const key = `cold:${endpoint}`;
    await redis.lpush(key, String(ms));
    await redis.ltrim(key, 0, WINDOW_SIZE - 1);
    // Compute p95 on every push so we only alert when warranted.
    const samples = (await redis.lrange(key, 0, WINDOW_SIZE - 1)) as string[];
    if (samples.length >= 20) {
      const sorted = samples.map(Number).sort((a, b) => a - b);
      const p95 = sorted[Math.floor(sorted.length * 0.95)]!;
      if (p95 > P95_ALERT_MS) {
        captureMessage(
          `[cold-start] ${endpoint} p95 ${Math.round(p95)}ms > ${P95_ALERT_MS}ms over ${
            samples.length
          } samples`,
          'warning',
        );
      }
    }
  } catch {
    // Metric collection is best-effort. Never block the request.
  }
}

/**
 * Get a p95 reading for an endpoint. Used by /api/admin/stats.
 */
export async function getColdStartP95(endpoint: string): Promise<number | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    const samples = (await redis.lrange(`cold:${endpoint}`, 0, WINDOW_SIZE - 1)) as string[];
    if (samples.length < 5) return null;
    const sorted = samples.map(Number).sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length * 0.95)] ?? null;
  } catch {
    return null;
  }
}
