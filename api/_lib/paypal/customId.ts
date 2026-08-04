/**
 * PayPal `custom_id` pack/unpack — Phase 0 money-path (2026-08-04).
 *
 * PayPal echoes the purchase-unit `custom_id` back on capture responses
 * AND on PAYMENT.CAPTURE.* webhook resources. We pack BOTH the PPW
 * order ref and the buyer email (collected at checkout) into it so:
 *   1. the capture recorder can persist the checkout email instead of ''
 *      (defect 5, IMPL-1), and
 *   2. the webhook can resolve the PPW order ref for capture events
 *      (capture resources don't carry purchase_units[].reference_id).
 *
 * Wire format: `<orderRef>|<email>` truncated to PayPal's 127-char cap.
 * The order ref never contains '|'; the split is on the FIRST pipe so a
 * (pathological) pipe inside an email survives.
 */

export const PAYPAL_CUSTOM_ID_MAX = 127;

export function buildPaypalCustomId(orderRef: string, email?: string): string {
  const safeRef = (orderRef ?? '').trim();
  const safeEmail = (email ?? '').trim();
  const packed = safeEmail ? `${safeRef}|${safeEmail}` : safeRef;
  return packed.slice(0, PAYPAL_CUSTOM_ID_MAX);
}

export interface ParsedPaypalCustomId {
  orderRef: string | null;
  email: string | null;
}

export function parsePaypalCustomId(raw: string | null | undefined): ParsedPaypalCustomId {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return { orderRef: null, email: null };
  }
  const s = raw.trim();
  const pipe = s.indexOf('|');
  if (pipe === -1) return { orderRef: s, email: null };
  const orderRef = s.slice(0, pipe).trim();
  const email = s.slice(pipe + 1).trim();
  return {
    orderRef: orderRef.length > 0 ? orderRef : null,
    email: email.length > 0 ? email : null,
  };
}
