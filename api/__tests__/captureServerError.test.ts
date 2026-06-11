/**
 * captureServerError — server 5xx capture proof (tracker: sentry-server-errors-uncaptured).
 *
 * The capture-PDF 500 never reached Sentry because the API layer captured
 * nothing server-side (`javascript-react` = 0 events/30d). These tests mock the
 * `@sentry/node` transport (NO real DSN, NO network) and prove two things:
 *
 *   1. DSN PRESENT  — an unhandled throw inside a catch-all router handler is
 *      captured AND flushed, then re-thrown so Vercel still returns its 500.
 *   2. DSN ABSENT   — init/capture/flush are a no-op; no transport call is made
 *      (so GATE-1 runs green with no real DSN, same mockability rule as the
 *      Wellness Assistant Anthropic wrapper).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';

// Hoisted so the vi.mock factory can reference it without a TDZ error.
const sentryMock = vi.hoisted(() => ({
  init: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  flush: vi.fn(async () => true),
  withScope: vi.fn((cb: (scope: { setExtra: (k: string, v: unknown) => void }) => void) =>
    cb({ setExtra: () => {} }),
  ),
}));

// Stub the SDK boundary — every method is a spy, nothing leaves the process.
vi.mock('@sentry/node', () => sentryMock);

type Req = { method?: string; url?: string; headers: Record<string, string | string[] | undefined> };
type Res = { setHeader(n: string, v: string): void; status(c: number): Res; end(p?: string): void; json(b: unknown): void };

const mkRes = (): Res & { statusCode: number | undefined } => {
  const res = {
    statusCode: undefined as number | undefined,
    setHeader() {},
    status(c: number) {
      res.statusCode = c;
      return res as unknown as Res;
    },
    end() {},
    json() {},
  };
  return res;
};

const ORIGINAL_DSN = process.env.SENTRY_DSN;

afterEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  if (ORIGINAL_DSN === undefined) delete process.env.SENTRY_DSN;
  else process.env.SENTRY_DSN = ORIGINAL_DSN;
});

describe('captureServerError — DSN present (capture fires)', () => {
  it('captures + flushes a router-thrown 5xx, then re-throws so the route still returns a 500', async () => {
    process.env.SENTRY_DSN = 'https://examplePublicKey@o0.ingest.sentry.io/0';
    vi.resetModules();
    const { withSentry } = await import('../lib/sentry.js');

    const boom = new Error('capture-pdf 500');
    // Stand in for the merchants-router central error path: a handler that
    // throws an unhandled error (e.g. the PDF generator blowing up).
    const wrapped = withSentry(async (_req: Req, _res: Res) => {
      throw boom;
    });

    // Re-throw IS how the 500 reaches the client (Vercel renders its default
    // 500 from the propagated throw) — so a rejection here proves the route
    // still 500s.
    await expect(
      wrapped({ headers: {}, method: 'GET', url: '/api/capture/reference-page.pdf' }, mkRes()),
    ).rejects.toThrow('capture-pdf 500');

    // The error was reported to Sentry...
    expect(sentryMock.captureException).toHaveBeenCalledTimes(1);
    expect(sentryMock.captureException).toHaveBeenCalledWith(boom);
    // ...and flushed before the (frozen) lambda could drop the event.
    expect(sentryMock.flush).toHaveBeenCalled();
  });

  it('captureServerError() directly captures + flushes when a DSN is set', async () => {
    process.env.SENTRY_DSN = 'https://examplePublicKey@o0.ingest.sentry.io/0';
    vi.resetModules();
    const { captureServerError } = await import('../lib/sentry.js');

    const err = new Error('direct boom');
    await expect(captureServerError(err, { url: '/x' })).resolves.toBeUndefined();
    expect(sentryMock.captureException).toHaveBeenCalledWith(err);
    expect(sentryMock.flush).toHaveBeenCalled();
  });
});

describe('captureServerError — DSN absent (no-op safety)', () => {
  it('makes no transport call and never throws when SENTRY_DSN is unset', async () => {
    delete process.env.SENTRY_DSN;
    vi.resetModules();
    const { captureServerError, initSentry } = await import('../lib/sentry.js');

    // init is inert without a DSN...
    expect(initSentry()).toBeNull();
    // ...and capturing is a safe no-op — no network, no throw.
    await expect(captureServerError(new Error('ignored'), { url: '/y' })).resolves.toBeUndefined();

    expect(sentryMock.init).not.toHaveBeenCalled();
    expect(sentryMock.captureException).not.toHaveBeenCalled();
    expect(sentryMock.flush).not.toHaveBeenCalled();
  });
});
