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

import { renderDesignSaved, renderOrderConfirmed } from './templates.js';
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
export interface OrderLike {
  ppwOrderId: string;
  customerEmail: string | null;
  totalMinor: number;
  currency: string;
  /**
   * Optional per-merchant breakdown. M9.A.2 V1 ships with a single
   * placeholder row when this is omitted (the multi-merchant
   * order_items JOIN is a V2 enhancement once order_items
   * population stabilises).
   */
  merchantBreakdown?: Array<{ merchantName: string; itemCount: number; subtotalMur: number }>;
  /** Optional explicit greeting name; defaults to email-prefix proxy. */
  customerName?: string;
}

/**
 * M9.A.2 — fire the order-confirmed email after a successful PayPal
 * capture. Returns the same DispatchResult shape as the design-saved
 * dispatcher; never re-throws. The PayPal capture itself is the
 * authoritative outcome — the email is a courtesy.
 */
export async function dispatchOrderConfirmedEmail(order: OrderLike): Promise<DispatchResult> {
  if (!order.customerEmail || order.customerEmail.trim().length === 0) {
    return { fired: false, skippedReason: 'no_customer_email' };
  }
  try {
    const totalMur = order.currency === 'MUR' ? order.totalMinor : Math.round(order.totalMinor / 100);
    const breakdown =
      order.merchantBreakdown && order.merchantBreakdown.length > 0
        ? order.merchantBreakdown
        : [
            {
              merchantName: 'Peak Performance Wellness Marketplace',
              itemCount: 1,
              subtotalMur: totalMur,
            },
          ];
    const tpl = renderOrderConfirmed({
      customerName: order.customerName ?? deriveGreetingName(order.customerEmail),
      orderRef: order.ppwOrderId,
      totalMur,
      currency: order.currency,
      trackingUrl: `https://designer.ppwellness.co/order/track/${encodeURIComponent(order.ppwOrderId)}`,
      merchantBreakdown: breakdown,
    });
    const send = await sendEmail({
      to: order.customerEmail,
      subject: tpl.subject,
      html: tpl.html,
      template: 'order-confirmed',
      payload: {
        ppwOrderId: order.ppwOrderId,
        totalMinor: order.totalMinor,
        currency: order.currency,
        merchantCount: breakdown.length,
      },
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
