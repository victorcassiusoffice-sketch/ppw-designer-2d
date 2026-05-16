/**
 * Customer identity — email-based, localStorage-cached.
 *
 * The Designer surface is anonymous-friendly: no forced Clerk sign-in
 * gate. To support cloud-save (M1.C.6 → `/api/designs`) and the lead
 * funnel (M1.C.7 → `/api/leads`), we cache the customer email on the
 * device the first time they enter one. Subsequent Save / Request-Quote
 * presses reuse it silently.
 *
 * Clerk is intentionally NOT wired here — `ClerkProvider` currently
 * only wraps the `/admin` route, and adding it to `/designer` is a
 * larger scaffold change. Email-based identity is the documented MVP
 * per `VIC-DECISIONS-QUEUE.md` V3.1-A decision.
 */

const CUSTOMER_EMAIL_KEY = 'ppw_customer_email_v1';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** True if the string looks like a valid email — light client-side check only. */
export function isLikelyEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

/** Read the cached customer email (lowercased, trimmed) or null. */
export function getCachedCustomerEmail(): string | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const v = window.localStorage.getItem(CUSTOMER_EMAIL_KEY);
    if (!v) return null;
    const trimmed = v.trim().toLowerCase();
    return isLikelyEmail(trimmed) ? trimmed : null;
  } catch {
    return null;
  }
}

/** Persist the customer email. Returns the normalised value, or null on bad input. */
export function setCachedCustomerEmail(value: string): string | null {
  const trimmed = value.trim().toLowerCase();
  if (!isLikelyEmail(trimmed)) return null;
  if (typeof window === 'undefined' || !window.localStorage) return trimmed;
  try {
    window.localStorage.setItem(CUSTOMER_EMAIL_KEY, trimmed);
  } catch {
    // localStorage may be quota-full or disabled (private mode). Don't
    // throw — the email is still good for this session.
  }
  return trimmed;
}

/** Clear the cached email (used by tests + future "sign out" affordance). */
export function clearCachedCustomerEmail(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.removeItem(CUSTOMER_EMAIL_KEY);
  } catch {
    // ignore
  }
}

/**
 * Prompt the user for an email (with the cached value as default) and
 * persist on success. Returns the email or null if the user cancelled
 * or entered an invalid value.
 *
 * Uses `window.prompt` to match the existing Save-as flow in
 * `TopBar.tsx`. A richer modal can replace this without changing the
 * call sites.
 */
export function promptForCustomerEmail(
  reason = 'Enter your email to continue',
): string | null {
  if (typeof window === 'undefined') return null;
  const cached = getCachedCustomerEmail();
  const raw = window.prompt(reason, cached ?? '');
  if (!raw) return null;
  return setCachedCustomerEmail(raw);
}
