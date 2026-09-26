export const DEMO_NOTICE = 'Demo only — orders, payments, quote requests and email submissions are disabled.';

const SESSION_KEY = 'ppw_showcase_read_only';
let demoSession = false;

/**
 * The URL families that never place an order: the designer-only Demo, its
 * embed, the standalone Studio and the two pitches (each with sub-routes).
 * `/designer?demo=<slug>` is deliberately NOT here — that is the meeting-pack
 * URL merchants already hold, and on production it keeps the cart, request-
 * quote, cloud save and the K1 link exactly as before (2026-09-26 decision).
 */
const READ_ONLY_ROUTE = /^\/(?:demo|studio|pitch)(?:\/|$)|^\/embed\/designer(?:\/|$)/;
/** The payment pages consult the sticky flag; they never set or clear it. */
const CHECKOUT_ROUTE = /^\/(?:marketplace\/)?checkout(?:\/|$)/;

function normalisePath(pathname: string | undefined): string {
  return (pathname ?? '/').replace(/\/+$/, '') || '/';
}

/** True for a path inside one of the read-only families. Query strings play no part. */
export function isShowcaseRoute(pathname: string): boolean {
  return READ_ONLY_ROUTE.test(normalisePath(pathname));
}

function remember(on: boolean): void {
  try {
    if (on) window.sessionStorage.setItem(SESSION_KEY, '1');
    else window.sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // The in-memory flag still protects navigation when browser storage is blocked.
  }
}

function recall(): boolean {
  try {
    return window.sessionStorage.getItem(SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * UI safeguard; API deployment policy is the independent security boundary.
 *
 * Three kinds of route:
 *  - a read-only route marks the tab (memory + sessionStorage) and returns true;
 *  - `/checkout` and `/marketplace/checkout` only CONSULT the mark, so a tab
 *    that came straight from the Demo, Studio or a pitch stays blocked;
 *  - every other route (`/designer`, `/products`, `/cart`, `/`, …) is the real
 *    product again and CLEARS the mark, so pitch → designer → checkout pays.
 */
export function isShowcaseReadOnly(): boolean {
  if (typeof __SHOWCASE_READ_ONLY__ !== 'undefined' && __SHOWCASE_READ_ONLY__) return true;
  if (typeof window === 'undefined') return false;
  const path = normalisePath(window.location?.pathname);
  if (READ_ONLY_ROUTE.test(path)) {
    demoSession = true;
    remember(true);
    return true;
  }
  if (CHECKOUT_ROUTE.test(path)) {
    if (!demoSession) demoSession = recall();
    return demoSession;
  }
  demoSession = false;
  remember(false);
  return false;
}

export function assertShowcaseWritable(): void {
  if (isShowcaseReadOnly()) throw new Error(DEMO_NOTICE);
}
