/**
 * api/_lib/withApi.ts — V4 W0.D.4 (CQ §05.1)
 *
 * Composable HOF that wraps a Vercel handler with the standard cross-cutting
 * concerns in a single, opt-in package:
 *
 *   • Sentry capture (via existing withSentry)
 *   • Rate limit (caller passes a limiter; HOF runs the check)
 *   • Admin auth (Clerk Bearer → AuthorisedAdmin)
 *   • Idempotency-Key replay/conflict (KV-backed; degrades open in dev)
 *   • Zod body validation
 *
 * All failure paths emit the same shape:
 *
 *   { ok: false, code, message, requestId, details? }
 *
 * Successful handlers retain full control of the response (status + JSON).
 * Idempotency storage wraps `res.json` so the captured payload is cached
 * automatically when an Idempotency-Key is present.
 *
 * Roll-out is opt-in over Wave 0.D / 0.5 per V4-CQ-2 (CLOSED). Existing
 * handlers continue to work unchanged; new endpoints choose to consume this.
 */

import type { ZodSchema } from 'zod';
import { withSentry, type MinReq, type MinRes } from './sentry.js';
import {
  authoriseAdminRequest,
  type AuthorisedAdmin,
} from './adminAuth.js';
import {
  checkIdempotency as defaultCheckIdempotency,
  storeIdempotency as defaultStoreIdempotency,
  extractIdempotencyKey,
  hashBody,
  type CachedResult,
} from './idempotency.js';

export type WithApiErrorCode =
  | 'validation_error'
  | 'rate_limited'
  | 'unauthorized'
  | 'forbidden'
  | 'idempotency_conflict'
  | 'method_not_allowed'
  | 'internal_error';

export interface WithApiErrorBody {
  ok: false;
  code: WithApiErrorCode;
  message: string;
  requestId: string;
  details?: unknown;
}

export interface WithApiAdminDeps {
  verify: (token: string) => Promise<{ sub?: string; email?: string } | null>;
  lookupAdmin: (clerkUserId: string) => Promise<{ role: 'super_admin' | 'reviewer' } | null>;
}

export interface RateLimitConfig {
  /** A limiter built via `buildLimiter()` or any object with the same shape. */
  check: (key: string) => Promise<{ success: boolean; retryAfterSec: number; limit: number }>;
  /** Extract the rate-limit key from the request (typically the client IP). */
  keyFn: (req: MinReq) => string;
}

export interface IdempotencyDeps {
  check?: typeof defaultCheckIdempotency;
  store?: typeof defaultStoreIdempotency;
}

export interface IdempotencyConfig {
  /** Endpoint name used as the KV key namespace (e.g. 'merchant-signup'). */
  endpoint: string;
  /** Override the KV-backed check/store for tests. */
  deps?: IdempotencyDeps;
}

export interface WithApiOptions<TBody> {
  /** 'admin' wires Clerk Bearer verification; 'public' (default) skips auth. */
  auth?: 'admin' | 'public';
  /** Required when `auth === 'admin'`. Inject for tests. */
  adminDeps?: WithApiAdminDeps;
  /** Optional Zod schema for the request body. Parsed result lands in ctx.body. */
  schema?: ZodSchema<TBody>;
  /** Enable Idempotency-Key replay/conflict semantics on POST/PUT/PATCH/DELETE. */
  idempotency?: IdempotencyConfig;
  /** Enable a rate-limit check before any other work. */
  rateLimit?: RateLimitConfig;
  /** Restrict to a method (or set). Mismatches emit 405. */
  method?: string | readonly string[];
}

export interface WithApiContext<TBody> {
  req: MinReq;
  res: MinRes;
  /** Validated body when `schema` is set; raw `req.body` otherwise. */
  body: TBody;
  /** Stable per-invocation id surfaced as `x-request-id`. */
  requestId: string;
  /** Present when `auth: 'admin'` succeeded; null for public endpoints. */
  admin: AuthorisedAdmin | null;
}

export type WithApiHandler<TBody> = (ctx: WithApiContext<TBody>) => Promise<void> | void;

function genRequestId(): string {
  return `req_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

function isStateChangingMethod(method: string | undefined): boolean {
  if (!method) return false;
  const upper = method.toUpperCase();
  return upper === 'POST' || upper === 'PUT' || upper === 'PATCH' || upper === 'DELETE';
}

function sendError(
  res: MinRes,
  requestId: string,
  status: number,
  code: WithApiErrorCode,
  message: string,
  details?: unknown,
): void {
  const body: WithApiErrorBody = { ok: false, code, message, requestId };
  if (details !== undefined) body.details = details;
  res.status(status).json(body);
}

/**
 * Wrap a handler with the cross-cutting concerns selected in `options`.
 * Returns a Vercel-compatible handler.
 */
export function withApi<TBody = unknown>(
  options: WithApiOptions<TBody>,
  handler: WithApiHandler<TBody>,
): (req: MinReq, res: MinRes) => Promise<void> | void {
  return withSentry(async (req: MinReq, res: MinRes): Promise<void> => {
    const requestId = genRequestId();
    res.setHeader('x-request-id', requestId);

    // 0. Method gate
    if (options.method) {
      const allowed = (Array.isArray(options.method) ? options.method : [options.method]).map((m) =>
        m.toUpperCase(),
      );
      const got = (req.method ?? 'GET').toUpperCase();
      if (!allowed.includes(got)) {
        res.setHeader('Allow', allowed.join(', '));
        sendError(res, requestId, 405, 'method_not_allowed', `Method ${got} not allowed.`);
        return;
      }
    }

    // 1. Rate limit (run first so abusive callers don't even pay for auth)
    if (options.rateLimit) {
      const key = options.rateLimit.keyFn(req);
      const verdict = await options.rateLimit.check(key);
      if (!verdict.success) {
        res.setHeader('Retry-After', String(Math.max(1, verdict.retryAfterSec)));
        sendError(res, requestId, 429, 'rate_limited', 'Too many requests.');
        return;
      }
    }

    // 2. Auth
    let admin: AuthorisedAdmin | null = null;
    if (options.auth === 'admin') {
      if (!options.adminDeps) {
        sendError(res, requestId, 500, 'internal_error', 'Admin auth not configured.');
        return;
      }
      const result = await authoriseAdminRequest(req.headers, options.adminDeps);
      if (!result.ok) {
        const code: WithApiErrorCode =
          result.status === 401
            ? 'unauthorized'
            : result.status === 403
              ? 'forbidden'
              : 'internal_error';
        sendError(res, requestId, result.status, code, result.error);
        return;
      }
      admin = result.admin;
    }

    // 3. Idempotency check (replay or conflict bail out early)
    const idempotency = options.idempotency;
    const wantsIdempotency = idempotency && isStateChangingMethod(req.method);
    const idempotencyKey = wantsIdempotency ? extractIdempotencyKey(req.headers) : null;
    const idempotencyBodyHash = idempotencyKey ? hashBody(req.body) : null;
    if (idempotency && idempotencyKey && idempotencyBodyHash !== null) {
      const checkFn = idempotency.deps?.check ?? defaultCheckIdempotency;
      const verdict = await checkFn(idempotency.endpoint, idempotencyKey, idempotencyBodyHash);
      if (verdict.kind === 'conflict') {
        sendError(
          res,
          requestId,
          409,
          'idempotency_conflict',
          'Idempotency-Key reused with a different request body.',
        );
        return;
      }
      if (verdict.kind === 'replay') {
        res.status(verdict.cached.status).json(verdict.cached.body);
        return;
      }
    }

    // 4. Zod validation
    let body: TBody;
    if (options.schema) {
      const parsed = options.schema.safeParse(req.body);
      if (!parsed.success) {
        sendError(
          res,
          requestId,
          400,
          'validation_error',
          'Request body failed validation.',
          parsed.error.flatten(),
        );
        return;
      }
      body = parsed.data;
    } else {
      body = req.body as TBody;
    }

    // 5. Wrap res so idempotency captures the response payload
    let captured: CachedResult | null = null;
    let proxyRes: MinRes = res;
    if (idempotency && idempotencyKey && idempotencyBodyHash !== null) {
      let status = 200;
      const originalStatus = res.status.bind(res);
      const originalJson = res.json.bind(res);
      proxyRes = {
        setHeader: res.setHeader.bind(res),
        end: res.end.bind(res),
        status(code: number) {
          status = code;
          originalStatus(code);
          return proxyRes;
        },
        json(payload: unknown) {
          captured = { status, body: payload, bodyHash: hashBody(payload) };
          originalJson(payload);
        },
      };
    }

    // 6. Handler
    await handler({ req, res: proxyRes, body, requestId, admin });

    // 7. Persist idempotency payload (best-effort; never throws to caller)
    if (idempotency && idempotencyKey && captured) {
      try {
        const storeFn = idempotency.deps?.store ?? defaultStoreIdempotency;
        await storeFn(idempotency.endpoint, idempotencyKey, captured);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[withApi] idempotency store failed', err);
      }
    }
  });
}
