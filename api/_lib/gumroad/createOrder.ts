/**
 * Gumroad interim rail — create-order endpoint core (2026-08-04).
 *
 * POST /api/gumroad/create-order  (folded into api/orders.ts — 12-fn cap)
 *   body: same shape as /api/createPaypalOrder ({ cart, customer,
 *         currency, successUrl, cancelUrl, orderId })
 *   200:  { orderRef, checkoutUrl, usdMinor, fxRateUsed, fxIndicative,
 *           fxDisclosure, priceAdjusted }
 *   400:  validation / pricing error
 *   503:  Gumroad env unset OR orders enum not migrated (0028)
 *
 * Flow (per the verified 2026-08-04 Gumroad capability brief):
 *   1. Re-price the cart server-side (repriceCart — client amounts are
 *      advisory, server price is authoritative).
 *   2. Convert the cart-currency total to USD minor units using the
 *      server fallback FX table (src/lib/fx.ts FALLBACK_RATES_USD — the
 *      same rates repriceCart uses). The rate is INDICATIVE and is
 *      disclosed in the response; Gumroad checkout always charges USD.
 *   3. Write a PENDING orders row (rail 'gumroad', status 'pending')
 *      keyed by the orderRef, with the expected USD total + a compact
 *      cart snapshot in raw_payload (the Ping webhook verifies the paid
 *      amount against it and rebuilds order_items from it — same
 *      {s,q,u} shape the Stripe recorder uses).
 *   4. Return the PWYW checkout URL: `?price=<usd>&wanted=true` pre-fills
 *      the exact total and jumps to the payment form; `order_ref=<ref>`
 *      rides along as a passthrough param and comes back in the Ping's
 *      `url_params` dict. The buyer CAN lower the PWYW price to the
 *      product minimum — the webhook marks such orders 'underpaid' and
 *      does not fulfil.
 *
 * There is NO product-create/price API on Gumroad (v2 products POST/PUT
 * return 404 by design) — PWYW pre-fill is the only dynamic-total lever.
 */

import { sql } from 'drizzle-orm';
import { getDb } from '../../_db/client.js';
import { FALLBACK_RATES_USD } from '../../../src/lib/fx.js';
import { repriceCart, type Repricer } from '../pricing/repriceCart.js';
import { validatePaypalRequest, type ValidatedPaypalRequest } from '../paypal/createOrder.js';
import { readGumroadEnv, GumroadNotConfiguredError, type GumroadEnv } from './env.js';
import type { Currency } from '../orderTypes.js';

export const GUMROAD_FX_DISCLOSURE =
  'Gumroad checkout charges in USD. The USD total shown was converted from your cart currency at an indicative rate — your card statement will show the USD amount.';

/** Gumroad PWYW minimum we document for the Designer Order product ($1). */
export const GUMROAD_MIN_USD_MINOR = 100;

/** Convert a MINOR-unit total in `currency` to USD minor units using the
 *  server fallback rates (1 USD = FALLBACK_RATES_USD[X] X). Indicative —
 *  the response discloses the rate used. */
export function convertMinorToUsd(
  totalMinor: number,
  currency: Currency,
): { usdMinor: number; rateUsed: number } {
  const rate = FALLBACK_RATES_USD[currency];
  if (!rate || rate <= 0) return { usdMinor: Math.round(totalMinor), rateUsed: 1 };
  return { usdMinor: Math.round(totalMinor / rate), rateUsed: rate };
}

/** Build the PWYW checkout URL: price pre-fill + straight-to-payment-form
 *  + order_ref passthrough (returned in the Ping's url_params). */
export function buildGumroadCheckoutUrl(args: {
  productUrl: string;
  usdMinor: number;
  orderRef: string;
  email?: string;
}): string {
  const url = new URL(args.productUrl);
  url.searchParams.set('price', (args.usdMinor / 100).toFixed(2));
  url.searchParams.set('wanted', 'true');
  url.searchParams.set('order_ref', args.orderRef);
  if (args.email) url.searchParams.set('email', args.email);
  return url.toString();
}

/** Compact cart snapshot stored in raw_payload — same {s,q,u} shape the
 *  Stripe recorder writes to metadata.cart, so the Ping handler reuses
 *  buildCaptureShapeFromCartMeta + recordOrderItemsForOrder unchanged. */
export function buildCartMeta(
  cart: ValidatedPaypalRequest['cart'],
): Array<{ s: string; q: number; u: number }> {
  return cart.map((li) => ({
    s: li.sku ?? li.productId,
    q: li.quantity,
    u: li.unitAmount,
  }));
}

export interface PendingGumroadOrderArgs {
  orderRef: string;
  customerEmail: string;
  currency: Currency;
  totalMinor: number;
  expectedUsdMinor: number;
  fxRateUsed: number;
  cartMeta: Array<{ s: string; q: number; u: number }>;
}

export type PendingOrderWriter = (
  args: PendingGumroadOrderArgs,
) => Promise<{ ok: boolean; error?: string; notMigrated?: boolean }>;

/**
 * Insert the pending orders row. Idempotent on ppw_order_id; a re-POST
 * with the same ref refreshes the snapshot ONLY while the order is still
 * pending (a captured order is never downgraded).
 *
 * Fails GRACEFULLY when migration 0028 hasn't been applied — the enum
 * value 'gumroad' won't exist and Postgres raises "invalid input value
 * for enum payment_rail"; we surface that as notMigrated → 503.
 */
export async function writePendingGumroadOrder(
  args: PendingGumroadOrderArgs,
): Promise<{ ok: boolean; error?: string; notMigrated?: boolean }> {
  try {
    const db = getDb();
    const rawPayload = JSON.stringify({
      source: 'gumroad-create-order',
      expectedUsdMinor: args.expectedUsdMinor,
      fxRateUsed: args.fxRateUsed,
      fxIndicative: true,
      cart: args.cartMeta,
    });
    await db.execute(sql`
      INSERT INTO orders (ppw_order_id, customer_email, currency, total_minor, payment_rail, payment_status, raw_payload)
      VALUES (${args.orderRef}, ${args.customerEmail}, ${args.currency}, ${args.totalMinor}, ${'gumroad'}, ${'pending'}, ${rawPayload}::jsonb)
      ON CONFLICT (ppw_order_id) DO UPDATE
        SET total_minor = EXCLUDED.total_minor,
            currency = EXCLUDED.currency,
            raw_payload = EXCLUDED.raw_payload,
            updated_at = NOW()
        WHERE orders.payment_status = 'pending'
          AND orders.payment_rail = 'gumroad'
    `);
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message.slice(0, 200) : 'DB write failed';
    if (/invalid input value for enum/i.test(message)) {
      return { ok: false, notMigrated: true, error: message };
    }
    return { ok: false, error: message };
  }
}

export interface GumroadCreateDeps {
  repricer?: Repricer;
  writer?: PendingOrderWriter;
  env?: NodeJS.ProcessEnv;
}

export type GumroadCreateResult =
  | {
      status: 200;
      orderRef: string;
      checkoutUrl: string;
      usdMinor: number;
      fxRateUsed: number;
      fxIndicative: true;
      fxDisclosure: string;
      priceAdjusted: boolean;
    }
  | { status: 400 | 500 | 503; error: string };

export async function processGumroadCreateRequest(
  payload: unknown,
  deps: GumroadCreateDeps = {},
): Promise<GumroadCreateResult> {
  const repricer = deps.repricer ?? repriceCart;
  const writer = deps.writer ?? writePendingGumroadOrder;

  // Same wire contract as the PayPal rail — one client payload shape
  // works for every rail behind the seam.
  const v = validatePaypalRequest(payload);
  if (!v.ok) return { status: 400, error: v.error };

  let gum: GumroadEnv;
  try {
    gum = readGumroadEnv(deps.env ?? process.env);
  } catch (err) {
    const msg =
      err instanceof GumroadNotConfiguredError
        ? err.message
        : 'Gumroad rail not configured';
    return { status: 503, error: msg };
  }

  // Server-side re-pricing — client amounts are advisory.
  const rp = await repricer(v.data.cart, v.data.currency);
  if (!rp.ok) return { status: rp.status, error: rp.error };
  v.data.cart = rp.cart;

  const totalMinor = rp.cart.reduce((sum, li) => sum + li.unitAmount * li.quantity, 0);
  if (totalMinor <= 0) return { status: 400, error: 'Cart total must be positive.' };

  const { usdMinor, rateUsed } = convertMinorToUsd(totalMinor, v.data.currency);
  if (usdMinor < GUMROAD_MIN_USD_MINOR) {
    return {
      status: 400,
      error: `Order total is below the Gumroad checkout minimum (USD ${(GUMROAD_MIN_USD_MINOR / 100).toFixed(2)}).`,
    };
  }

  const write = await writer({
    orderRef: v.data.orderId,
    customerEmail: v.data.customer.email,
    currency: v.data.currency,
    totalMinor,
    expectedUsdMinor: usdMinor,
    fxRateUsed: rateUsed,
    cartMeta: buildCartMeta(rp.cart),
  });
  if (!write.ok) {
    if (write.notMigrated) {
      return {
        status: 503,
        error: 'Gumroad rail not migrated — apply api/_db/migrations/0028_gumroad_rail.sql first.',
      };
    }
    // Fail CLOSED — never send the buyer to checkout without a pending
    // row (the Ping handler rejects unknown order refs).
    return { status: 500, error: 'Could not record the pending order. Please retry.' };
  }

  const checkoutUrl = buildGumroadCheckoutUrl({
    productUrl: gum.productUrl,
    usdMinor,
    orderRef: v.data.orderId,
    email: v.data.customer.email,
  });

  return {
    status: 200,
    orderRef: v.data.orderId,
    checkoutUrl,
    usdMinor,
    fxRateUsed: rateUsed,
    fxIndicative: true,
    fxDisclosure: GUMROAD_FX_DISCLOSURE,
    priceAdjusted: rp.priceAdjusted,
  };
}
