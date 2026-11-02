/** Preserve the main entry's diagnostics without its unrelated shop FX bootstrap. */
export function startPlumbingDiagnostics() {
  if (__TEST_HOOKS__) {
    import('../../lib/testHooks')
      .then((m) => m.installTestHooks())
      .catch(() => { /* preview-only convenience; ignore load failures */ });
  }

  if (import.meta.env.DEV) {
    import('../../lib/geomBridge')
      .then((m) => m.installGeomBridge())
      .catch(() => { /* dev-only convenience; ignore load failures */ });
  }

  if (import.meta.env.VITE_SENTRY_DSN) {
    const initSentry = () => import('@sentry/react').then((Sentry) => {
      Sentry.init({
        dsn: import.meta.env.VITE_SENTRY_DSN as string,
        environment:
          (import.meta.env.VITE_SENTRY_ENVIRONMENT as string | undefined) ??
          (import.meta.env.MODE as string),
        release:
          (import.meta.env.VITE_SENTRY_RELEASE as string | undefined) ??
          (import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA as string | undefined),
        tracesSampleRate: 0,
        replaysSessionSampleRate: 0,
        replaysOnErrorSampleRate: 0,
      });
    });
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(() => void initSentry(), { timeout: 4000 });
    } else {
      window.setTimeout(() => void initSentry(), 1500);
    }
  }
}
