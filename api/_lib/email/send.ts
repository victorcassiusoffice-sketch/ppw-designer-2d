/**
 * V4 M9.A.send.1-4 — shared Resend email transport with dedup + budget + audit.
 *
 * sendEmail({to, template, subject, html, payload, merchantId, dedupKey?})
 *   1. Compute dedup-key (if not provided) from (template, recipient, payload)
 *      via `computeDedupKey` (M9.A.send.2).
 *   2. KV check `email:dedup:<key>`: if cached, return `{ok:true, code:'dedup_hit',
 *      id: cached}` — NO Resend call, NO audit row. The first send's id is
 *      authoritative for the 7-day TTL.
 *   3. KV budget INCR `email:budget:<merchantId|"system">:<UTC-date>` with 86400s
 *      EXPIRE on first increment. Over 100/day → return
 *      `{ok:false, code:'rate_limit'}` and write `email.failed` audit row.
 *      System bucket is separate from per-merchant buckets so ops emails
 *      can't starve merchant traffic and vice-versa.
 *   4. Resend send with 3× exponential backoff (100ms / 200ms / 400ms) on
 *      transient errors. Each retry preserves the dedup-key, so the FIRST
 *      successful attempt also locks the dedup cache.
 *   5. Audit `email.sent` on success, `email.failed` on final failure.
 *      Audit payload redacts the HTML body (just the template name +
 *      recipient + dedup key + first 5 payload-keys for forensics).
 *
 * Env:
 *   - RESEND_API_KEY     — if absent, degrades to log-only dry-run (existing
 *                          merchantEmails.ts pattern); returns `{ok:true,
 *                          loggedOnly:true}`. Lets tests + local dev exercise
 *                          the whole flow without a Resend account.
 *   - KV_REST_API_URL    — if absent, dedup + budget degrade open (allow
 *   - KV_REST_API_TOKEN    the send; no caching). Same fail-open posture
 *                          as `rateLimit.ts` — we don't want a KV outage
 *                          to silence customer emails.
 *
 * Reset hooks for tests at the bottom (`_resetForTests`).
 */

import { drizzleAuditWriter } from '../auditLog.js';

import { computeDedupKey } from './dedupKey.js';

export const FROM_EMAIL = 'Peak Performance Wellness Marketplace <victor@ppwellness.co>';
export const REPLY_TO_EMAIL = 'victor@ppwellness.co';
export const BUDGET_LIMIT_PER_DAY = 100;
export const DEDUP_TTL_SECONDS = 7 * 24 * 3600;
export const MAX_SEND_ATTEMPTS = 3;

export interface SendArgs {
  to: string;
  subject: string;
  html: string;
  template: string;
  /** Arbitrary metadata that participates in the auto-computed dedupKey + lands in audit_log. */
  payload?: unknown;
  /** Per-merchant budget bucket key; omit for system emails (e.g. ops alerts). */
  merchantId?: number;
  /** Explicit dedupKey — overrides the auto-computed one (rare: only when caller has a stronger identifier). */
  dedupKey?: string;
  replyTo?: string;
}

export type SendCode = 'rate_limit' | 'dedup_hit' | 'resend_error' | 'no_client';

export interface SendResult {
  ok: boolean;
  id?: string;
  loggedOnly?: boolean;
  code?: SendCode;
  error?: string;
  dedupKey: string;
}

interface ResendClient {
  emails: {
    send(args: {
      from: string;
      to: string;
      subject: string;
      html: string;
      replyTo?: string;
    }): Promise<{ data: { id: string } | null; error: { message: string } | null }>;
  };
}

interface MinimalRedis {
  get<T = unknown>(key: string): Promise<T | null>;
  set(key: string, value: string, opts?: { ex?: number }): Promise<unknown>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<unknown>;
}

let _resend: ResendClient | null = null;
let _redis: MinimalRedis | null = null;
let _resendResolved = false;
let _redisResolved = false;

async function getResend(): Promise<ResendClient | null> {
  if (_resendResolved) return _resend;
  _resendResolved = true;
  const key = process.env.RESEND_API_KEY;
  if (!key || key.trim().length === 0) return null;
  const mod = await import('resend');
  const Ctor = (mod as { Resend: new (apiKey: string) => ResendClient }).Resend;
  _resend = new Ctor(key);
  return _resend;
}

async function getRedis(): Promise<MinimalRedis | null> {
  if (_redisResolved) return _redis;
  _redisResolved = true;
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  const { Redis } = await import('@upstash/redis');
  _redis = new Redis({ url, token }) as unknown as MinimalRedis;
  return _redis;
}

/** Test hooks. */
export function _resetForTests(): void {
  _resend = null;
  _redis = null;
  _resendResolved = false;
  _redisResolved = false;
}

/** Test hooks — inject mock clients. */
export function _setForTests(opts: { resend?: ResendClient | null; redis?: MinimalRedis | null }): void {
  if ('resend' in opts) {
    _resend = opts.resend ?? null;
    _resendResolved = true;
  }
  if ('redis' in opts) {
    _redis = opts.redis ?? null;
    _redisResolved = true;
  }
}

function utcDateStamp(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10); // YYYY-MM-DD
}

function budgetKey(merchantId: number | undefined, now: Date = new Date()): string {
  return `email:budget:${merchantId ?? 'system'}:${utcDateStamp(now)}`;
}

function dedupCacheKey(key: string): string {
  return `email:dedup:${key}`;
}

function isTransient(error: string | undefined | null): boolean {
  if (!error) return false;
  return /timeout|network|EAI_AGAIN|ETIMEDOUT|ECONNRESET|503|502|504|rate.?limit/i.test(error);
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Recipient-friendly audit payload — never includes the full HTML body. */
function buildAuditPayload(args: SendArgs, dedupKey: string, extra: Record<string, unknown>): Record<string, unknown> {
  const payloadKeys =
    args.payload && typeof args.payload === 'object'
      ? Object.keys(args.payload as Record<string, unknown>).slice(0, 5)
      : [];
  return {
    template: args.template,
    to: args.to,
    dedupKey,
    merchantId: args.merchantId,
    payloadKeys,
    ...extra,
  };
}

export async function sendEmail(args: SendArgs): Promise<SendResult> {
  const dedupKey = args.dedupKey ?? computeDedupKey(args.template, args.to, args.payload);
  const audit = drizzleAuditWriter();

  const redis = await getRedis();
  if (redis) {
    // M9.A.send.1 — dedup gate.
    const cached = await redis.get<string>(dedupCacheKey(dedupKey));
    if (cached) {
      return { ok: true, id: String(cached), code: 'dedup_hit', dedupKey };
    }

    // M9.A.send.3 — per-merchant budget.
    const bk = budgetKey(args.merchantId);
    const count = await redis.incr(bk);
    if (count === 1) {
      await redis.expire(bk, 86400);
    }
    if (count > BUDGET_LIMIT_PER_DAY) {
      try {
        await audit.record({
          actorEmail: 'system:email',
          action: 'email.failed',
          targetType: 'email',
          targetId: dedupKey,
          payload: buildAuditPayload(args, dedupKey, { code: 'rate_limit', count }),
        });
      } catch {
        // audit row failure must not change the rate-limit verdict
      }
      return {
        ok: false,
        code: 'rate_limit',
        error: `email budget exceeded (${BUDGET_LIMIT_PER_DAY}/day for ${args.merchantId ?? 'system'})`,
        dedupKey,
      };
    }
  }

  const client = await getResend();
  if (!client) {
    // Dry-run fallback — matches existing merchantEmails.ts pattern.
    // eslint-disable-next-line no-console
    console.log('[email/send] dry-run', { to: args.to, subject: args.subject, template: args.template, dedupKey });
    return { ok: true, loggedOnly: true, code: 'no_client', dedupKey };
  }

  let lastError: string | null = null;
  for (let attempt = 1; attempt <= MAX_SEND_ATTEMPTS; attempt++) {
    try {
      const result = await client.emails.send({
        from: FROM_EMAIL,
        to: args.to,
        subject: args.subject,
        html: args.html,
        replyTo: args.replyTo ?? REPLY_TO_EMAIL,
      });
      if (result.data?.id) {
        if (redis) {
          await redis.set(dedupCacheKey(dedupKey), result.data.id, { ex: DEDUP_TTL_SECONDS });
        }
        try {
          await audit.record({
            actorEmail: 'system:email',
            action: 'email.sent',
            targetType: 'email',
            targetId: result.data.id,
            payload: buildAuditPayload(args, dedupKey, { attempts: attempt }),
          });
        } catch {
          // Audit failure must not swallow the successful send.
        }
        return { ok: true, id: result.data.id, dedupKey };
      }
      lastError = result.error?.message ?? 'resend returned no id';
      if (!isTransient(lastError)) break;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      if (!isTransient(lastError)) break;
    }
    if (attempt < MAX_SEND_ATTEMPTS) {
      await sleep(100 * Math.pow(2, attempt - 1));
    }
  }

  try {
    await audit.record({
      actorEmail: 'system:email',
      action: 'email.failed',
      targetType: 'email',
      targetId: dedupKey,
      payload: buildAuditPayload(args, dedupKey, { code: 'resend_error', error: lastError, attempts: MAX_SEND_ATTEMPTS }),
    });
  } catch {
    // ignore
  }
  return { ok: false, code: 'resend_error', error: lastError ?? 'resend failed', dedupKey };
}
