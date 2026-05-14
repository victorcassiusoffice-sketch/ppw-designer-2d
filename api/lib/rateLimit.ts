/**
 * api/lib/rateLimit.ts
 *
 * Upstash Redis (KV) sliding-window rate limiter. Free-tier safe.
 *
 * Configuration:
 *   - KV_REST_API_URL    (set in Vercel)
 *   - KV_REST_API_TOKEN  (set in Vercel)
 *
 * If either is missing the limiter degrades open (allow) and logs
 * a warning — we don't want a Redis outage to take signups down.
 *
 * Default policy:
 *   merchantSignupLimiter  → 3 requests / IP / 10 min (sliding window)
 *
 * Usage in a Vercel handler:
 *   const verdict = await merchantSignupLimiter.check(getClientIp(req));
 *   if (!verdict.success) {
 *     res.setHeader('Retry-After', String(verdict.retryAfterSec));
 *     res.status(429).json({ error: 'Too many requests.' });
 *     return;
 *   }
 */

import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';

type Verdict = {
  success: boolean;
  remaining: number;
  retryAfterSec: number;
  limit: number;
  reason?: 'no-redis' | 'redis-error' | 'limited';
};

function buildRedis(): Redis | null {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    // eslint-disable-next-line no-console
    console.warn('[rate-limit] KV_REST_API_URL/TOKEN not set — limiter disabled (allowing all).');
    return null;
  }
  return new Redis({ url, token });
}

const redisSingleton = buildRedis();

/** Build a limiter with a sliding-window policy + namespaced prefix. */
export function buildLimiter(
  prefix: string,
  limit: number,
  windowSec: number,
): {
  check: (key: string) => Promise<Verdict>;
} {
  let rl: Ratelimit | null = null;
  if (redisSingleton) {
    rl = new Ratelimit({
      redis: redisSingleton,
      limiter: Ratelimit.slidingWindow(limit, `${windowSec} s`),
      prefix: `ratelimit:${prefix}`,
      analytics: false,
    });
  }

  return {
    async check(key: string): Promise<Verdict> {
      if (!rl) {
        return { success: true, remaining: limit, retryAfterSec: 0, limit, reason: 'no-redis' };
      }
      try {
        const r = await rl.limit(key);
        return {
          success: r.success,
          remaining: r.remaining,
          retryAfterSec: r.success ? 0 : Math.max(1, Math.ceil((r.reset - Date.now()) / 1000)),
          limit,
          reason: r.success ? undefined : 'limited',
        };
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[rate-limit] redis error — failing open', err);
        return { success: true, remaining: limit, retryAfterSec: 0, limit, reason: 'redis-error' };
      }
    },
  };
}

/** 3 signups / IP / 10 minutes. */
export const merchantSignupLimiter = buildLimiter('merchant-signup', 3, 600);

/** Extract the real client IP behind Vercel's edge. */
export function getClientIp(req: { headers: Record<string, string | string[] | undefined> }): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) return fwd.split(',')[0].trim();
  if (Array.isArray(fwd) && fwd.length > 0) return String(fwd[0]).split(',')[0].trim();
  const real = req.headers['x-real-ip'];
  if (typeof real === 'string' && real.length > 0) return real;
  return 'unknown';
}
