export const DEMO_NOTICE = 'Demo only — orders, payments, quote requests and email submissions are disabled.';

const SESSION_KEY = 'ppw_showcase_read_only';
let demoSession = false;

/** UI safeguard; API deployment policy is the independent security boundary. */
export function isShowcaseReadOnly(): boolean {
  if (typeof __SHOWCASE_READ_ONLY__ !== 'undefined' && __SHOWCASE_READ_ONLY__) return true;
  if (typeof window === 'undefined') return false;
  const path = (window.location?.pathname ?? '/').replace(/\/+$/, '') || '/';
  const demoRoute = /^\/(?:demo|studio)(?:\/|$)/.test(path)
    || /^\/embed\/designer(?:\/|$)/.test(path)
    || /^\/pitch(?:\/|$)/.test(path)
    || !!new URLSearchParams(window.location?.search ?? '').get('demo');
  // Keep checkout read-only after navigating away from an explicit demo route.
  demoSession ||= demoRoute;
  try {
    if (demoSession) window.sessionStorage.setItem(SESSION_KEY, '1');
    demoSession ||= window.sessionStorage.getItem(SESSION_KEY) === '1';
  } catch {
    // The in-memory flag still protects navigation when browser storage is blocked.
  }
  return demoSession;
}

export function assertShowcaseWritable(): void {
  if (isShowcaseReadOnly()) throw new Error(DEMO_NOTICE);
}
