/**
 * OMS Wave 4.6 — Idempotency-Key middleware.
 *
 * Every state-changing endpoint should accept an `Idempotency-Key`
 * header. The helper stores the key in KV (Upstash) with a 24h TTL.
 * The second time the same key arrives within the window, the cached
 * response is replayed — 409 on a structural mismatch (different body
 * hash), 200 with cached payload on an exact replay.
 *
 * Degrades open: if KV is unconfigured (local dev / tests), the
 * middleware passes through so endpoints stay functional.
 */

import { createHash } from 'crypto';
import { Redis } from '@upstash/redis';

export interface CachedResult {
  status: number;
  body: unknown;
  bodyHash: string;
}

let _redis: Redis | null = null;
function getRedis(): Redis | null {
  if (_redis) return _redis;
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  _redis = new Redis({ url, token });
  return _redis;
}

export function hashBody(body: unknown): string {
  const json = typeof body === 'string' ? body : JSON.stringify(body ?? {});
  return createHash('sha256').update(json).digest('hex').slice(0, 32);
}

export async function checkIdempotency(
  endpoint: string,
  key: string,
  bodyHash: string,
): Promise<{ kind: 'fresh' } | { kind: 'replay'; cached: CachedResult } | { kind: 'conflict' }> {
  const redis = getRedis();
  if (!redis) return { kind: 'fresh' };
  const cacheKey = `idemp:${endpoint}:${key}`;
  const cached = (await redis.get(cacheKey)) as CachedResult | null;
  if (!cached) return { kind: 'fresh' };
  if (cached.bodyHash !== bodyHash) return { kind: 'conflict' };
  return { kind: 'replay', cached };
}

export async function storeIdempotency(
  endpoint: string,
  key: string,
  result: CachedResult,
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  const cacheKey = `idemp:${endpoint}:${key}`;
  // 24h TTL — matches the standard Stripe/PayPal idempotency window.
  await redis.set(cacheKey, result, { ex: 60 * 60 * 24 });
}

export function extractIdempotencyKey(
  headers: Record<string, string | string[] | undefined>,
): string | null {
  const raw = headers['idempotency-key'] ?? headers['Idempotency-Key'];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== 'string' || value.length < 8 || value.length > 256) return null;
  return value;
}
