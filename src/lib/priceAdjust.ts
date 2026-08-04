/**
 * Review P1 (2026-08-04) — surface server-side price adjustments.
 *
 * The checkout endpoints (/api/createPaypalOrder, /api/create-checkout-
 * session) return `priceAdjusted: true` when the server's authoritative
 * re-pricing changed any cart line (stale marketplace price, FX drift
 * beyond tolerance, or tampering). Before this helper existed the flag
 * dead-ended — the client hard-redirected to the payment page and the
 * buyer was silently charged a different total than the one displayed.
 *
 * Every checkout client MUST call this before redirecting when the flag
 * is set. Returns true to proceed, false to abort back to the cart.
 * In non-browser/test environments (no window.confirm) it proceeds —
 * the server price is the correct price; the prompt is disclosure.
 */
export function confirmAdjustedPrices(): boolean {
  if (typeof window === 'undefined' || typeof window.confirm !== 'function') {
    return true;
  }
  return window.confirm(
    'Prices were updated on the server since your cart was priced. ' +
      'Your final total may differ from the amount displayed. Continue to payment?',
  );
}
