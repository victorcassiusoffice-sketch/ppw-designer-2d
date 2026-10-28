// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startPlumbingDiagnostics } from './plumbingStartup';

const hooks = vi.hoisted(() => ({ sentry: vi.fn(), preview: vi.fn(), geometry: vi.fn() }));
vi.mock('@sentry/react', () => ({ init: hooks.sentry }));
vi.mock('../../lib/testHooks', () => ({ installTestHooks: hooks.preview }));
vi.mock('../../lib/geomBridge', () => ({ installGeomBridge: hooks.geometry }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.stubGlobal('__TEST_HOOKS__', false);
  vi.stubGlobal('requestIdleCallback', undefined);
  vi.stubEnv('DEV', false);
  vi.stubEnv('MODE', 'production');
  vi.stubEnv('VITE_SENTRY_DSN', '');
  vi.stubEnv('VITE_SENTRY_ENVIRONMENT', undefined);
  vi.stubEnv('VITE_SENTRY_RELEASE', undefined);
  vi.stubEnv('VITE_VERCEL_GIT_COMMIT_SHA', undefined);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('isolated pitch diagnostics parity', () => {
  it('does no diagnostics work when the existing flags and DSN are absent', async () => {
    startPlumbingDiagnostics();
    await vi.runAllTimersAsync();
    await vi.dynamicImportSettled();
    expect(hooks.sentry).not.toHaveBeenCalled();
    expect(hooks.preview).not.toHaveBeenCalled();
    expect(hooks.geometry).not.toHaveBeenCalled();
  });

  it('preserves idle scheduling, explicit environment/release and zero traces/replays', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', 'https://example.invalid/1');
    vi.stubEnv('VITE_SENTRY_ENVIRONMENT', 'preview');
    vi.stubEnv('VITE_SENTRY_RELEASE', 'reviewed-head');
    let idle!: IdleRequestCallback;
    const requestIdle = vi.fn((callback: IdleRequestCallback) => { idle = callback; return 1; });
    vi.stubGlobal('requestIdleCallback', requestIdle);
    startPlumbingDiagnostics();
    expect(requestIdle).toHaveBeenCalledWith(expect.any(Function), { timeout: 4000 });
    expect(hooks.sentry).not.toHaveBeenCalled();
    idle({ didTimeout: false, timeRemaining: () => 10 });
    await vi.dynamicImportSettled();
    expect(hooks.sentry).toHaveBeenCalledWith({ dsn: 'https://example.invalid/1', environment: 'preview', release: 'reviewed-head', tracesSampleRate: 0, replaysSessionSampleRate: 0, replaysOnErrorSampleRate: 0 });
  });

  it('keeps the 1500ms timer fallback and existing mode/commit fallbacks', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', 'https://example.invalid/1');
    vi.stubEnv('VITE_VERCEL_GIT_COMMIT_SHA', 'fallback-head');
    startPlumbingDiagnostics();
    await vi.advanceTimersByTimeAsync(1499);
    expect(hooks.sentry).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await vi.dynamicImportSettled();
    expect(hooks.sentry).toHaveBeenCalledWith(expect.objectContaining({ environment: 'production', release: 'fallback-head', tracesSampleRate: 0, replaysSessionSampleRate: 0, replaysOnErrorSampleRate: 0 }));
  });

  it('retains the separate preview and development hook gates', async () => {
    vi.stubGlobal('__TEST_HOOKS__', true);
    startPlumbingDiagnostics();
    await vi.dynamicImportSettled();
    expect(hooks.preview).toHaveBeenCalledTimes(1);
    expect(hooks.geometry).not.toHaveBeenCalled();
    vi.stubGlobal('__TEST_HOOKS__', false);
    vi.stubEnv('DEV', true);
    startPlumbingDiagnostics();
    await vi.dynamicImportSettled();
    expect(hooks.preview).toHaveBeenCalledTimes(1);
    expect(hooks.geometry).toHaveBeenCalledTimes(1);
  });
});
