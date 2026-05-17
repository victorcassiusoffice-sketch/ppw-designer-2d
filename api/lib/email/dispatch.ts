/**
 * V4 M9.A.1 + M9.A.2 — per-trigger email dispatch helpers.
 *
 * Each helper is a thin wrapper that:
 *   1. extracts the right payload from the trigger entity (design / order)
 *   2. calls the matching renderXxx() template
 *   3. fires sendEmail() with a consistent template-name slug for audit
 *   4. **never re-throws** — every caller is a success-path that must
 *      succeed regardless of email outcome (a saved design / a captured
 *      order is the authoritative outcome; the email is a courtesy).
 *
 * Splitting these out of orders.ts + paypal-router.ts keeps the wire
 * locations at <= 5 lines each and the per-trigger payload contract
 * unit-testable without spinning up the full handler.
 */

import { renderDesignSaved } from './templates.js';
import { sendEmail, type SendResult } from './send.js';

export interface DesignLike {
  id: number | string | bigint;
  name: string;
  customerEmail: string | null;
}

/**
 * Derive a friendly first-name proxy from the customer's email address.
 * `vic.cassius@gmail.com` → `Vic.cassius`. The greeting line uses this
 * verbatim — when Vic + a real customer list arrive we'll swap to a
 * stored display name. Until then, the email prefix is what we have.
 */
export function deriveGreetingName(email: string): string {
  const prefix = (email.split('@')[0] ?? '').trim();
  if (prefix.length === 0) return 'there';
  return prefix.charAt(0).toUpperCase() + prefix.slice(1);
}

export interface DispatchResult {
  fired: boolean;
  send?: SendResult;
  skippedReason?: 'no_customer_email' | 'caller_caught';
  error?: string;
}

/**
 * M9.A.1 — fire the design-saved email after a successful POST /api/designs.
 *
 * Returns `{fired: false, skippedReason: 'no_customer_email'}` for
 * anonymous-save designs (no customer email captured). Returns
 * `{fired: true, send}` for the happy path. Any exception inside is
 * caught + returned as `{fired: false, skippedReason: 'caller_caught',
 * error}` — caller decides whether to log or ignore.
 */
export async function dispatchDesignSavedEmail(design: DesignLike): Promise<DispatchResult> {
  if (!design.customerEmail || design.customerEmail.trim().length === 0) {
    return { fired: false, skippedReason: 'no_customer_email' };
  }
  try {
    const designIdNum = Number(design.id);
    const tpl = renderDesignSaved({
      customerName: deriveGreetingName(design.customerEmail),
      designName: design.name,
      designUrl: `https://designer.ppwellness.co/my-designs#${designIdNum}`,
    });
    const send = await sendEmail({
      to: design.customerEmail,
      subject: tpl.subject,
      html: tpl.html,
      template: 'design-saved',
      payload: { designId: designIdNum, designName: design.name },
    });
    return { fired: true, send };
  } catch (err) {
    return {
      fired: false,
      skippedReason: 'caller_caught',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
