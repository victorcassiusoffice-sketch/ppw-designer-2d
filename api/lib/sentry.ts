/**
 * api/lib/sentry.ts
 *
 * Lambda-side Sentry wiring. Init is lazy + idempotent so that:
 *   - cold-start lambdas only pay setup cost once per container
 *   - missing SENTRY_DSN is a no-op rather than a crash
 *   - tests don't pollute Sentry with synthetic events
 *
 * Usage:
 *   import { initSentry, captureException, withSentry } from './lib/sentry.js';
 *   export default withSentry(handler);
 *
 * The wrapper catches synchronous throws + unhandled promise
 * rejections from the inner handler, reports them, then re-throws
 * so Vercel still returns its default 500 page (preserves error
 * visibility in Vercel logs as well).
 */

import * as Sentry from '@sentry/node';

let initialised = false;

export function initSentry(): typeof Sentry | null {
  if (initialised) return Sentry;
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    // Don't crash; in local dev the DSN is intentionally absent.
    // eslint-disable-next-line no-console
    console.warn('[sentry] SENTRY_DSN not set — Sentry is inert.');
    return null;
  }
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.VERCEL_ENV ?? 'development',
    release: process.env.SENTRY_RELEASE ?? process.env.VERCEL_GIT_COMMIT_SHA,
    // Free tier: keep volume controlled.
    tracesSampleRate: 0,
    sendDefaultPii: false,
  });
  initialised = true;
  return Sentry;
}

export function captureException(err: unknown, context?: Record<string, unknown>): void {
  const sentry = initSentry();
  if (!sentry) return;
  if (context) {
    sentry.withScope((scope) => {
      for (const [k, v] of Object.entries(context)) scope.setExtra(k, v);
      sentry.captureException(err);
    });
  } else {
    sentry.captureException(err);
  }
}

export function captureMessage(msg: string, level: Sentry.SeverityLevel = 'info'): void {
  const sentry = initSentry();
  if (!sentry) return;
  sentry.captureMessage(msg, level);
}

/**
 * Wrap a Vercel handler so any thrown error is reported to Sentry
 * before propagating. The wrapper deliberately re-throws so Vercel
 * preserves the 500 status + the stack trace in its own logs.
 */
type MinimalReq = { method?: string; url?: string; headers: Record<string, string | string[] | undefined> };
type MinimalRes = { setHeader(name: string, value: string): void; status(code: number): MinimalRes; end(payload?: string): void; json(body: unknown): void };
type Handler<Q extends MinimalReq, S extends MinimalRes> = (req: Q, res: S) => Promise<void> | void;

export function withSentry<Q extends MinimalReq, S extends MinimalRes>(handler: Handler<Q, S>): Handler<Q, S> {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (err) {
      captureException(err, {
        url: req.url,
        method: req.method,
      });
      // Re-throw so Vercel logs + returns its default 500.
      throw err;
    }
  };
}
