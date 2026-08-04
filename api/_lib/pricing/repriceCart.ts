/**
 * Server-side cart re-pricing — Phase 0 money-path (IMPL-1 defect 2).
 *
 * Before this module the PayPal + Stripe order-creation endpoints charged
 * whatever `unitAmount` the CLIENT sent (price-tamper + unit-conversion
 * bugs went straight to the payment rail). Every checkout now re-prices
 * each line item server-side:
 *
 *   • MARKETPLACE items (numeric Neon `products.id` sent as a numeric
 *     string) → priced from the products table (`price_minor`, `currency`,
 *     `status`). Unknown or non-active ids → 400. Currency mismatch with
 *     the request currency → 400 (marketplace carts are single-currency).
 *
 *   • DESIGNER-RAIL items (string catalog ids / SKUs) → priced from the
 *     bundled seed catalog (`src/data/products.json`, same import pattern
 *     as api/products.ts seed-imagery enrichment). Catalog prices are
 *     MAJOR units in the catalog's native currency → canonical minor =
 *     round(value × 100). When the request currency differs from the
 *     catalog currency we convert with the server fallback FX rates; the
 *     client uses LIVE FX, so a small drift tolerance (FX_TOLERANCE_PCT)
 *     accepts the client amount when it is within tolerance of the server
 *     conversion. Beyond tolerance (or any same-currency mismatch) the
 *     SERVER price wins and `priceAdjusted` is flagged in the result.
 *
 * Wire contract note: `unitAmount` is MINOR units for ALL currencies
 * (MUR included — cents-of-MUR, matching the Neon `price_minor`
 * convention). See toPaypalAmount / buildLineItems.
 *
 * SECURITY (review P0, 2026-08-04): every repriced line's `currency` is
 * OVERWRITTEN with the request currency. Before this, a tampered client
 * could send a per-line `currency` differing from the request currency
 * — the server computed `unitAmount` in the REQUEST currency but the
 * Stripe rail (buildLineItems) charged in the CLIENT-supplied line
 * currency, letting USD-priced goods be bought as the same number of
 * MUR (~1/45 the price). A line-vs-request currency mismatch is treated
 * as tampering: the amount and currency are normalised server-side and
 * `priceAdjusted` is flagged.
 */

import { inArray } from 'drizzle-orm';
import { getDb, schema } from '../../_db/client.js';
import { FALLBACK_RATES_USD } from '../../../src/lib/fx.js';
import type { CartLineItemPayload, Currency } from '../orderTypes.js';
import productsSeed from '../../../src/data/products.json' with { type: 'json' };

/** Relative FX drift accepted between the client's live rate and the
 *  server fallback rate before the server price overrides the client. */
export const FX_TOLERANCE_PCT = 0.03;

interface SeedProduct {
  id: string;
  sku: string;
  price: { value: number; currency: string };
}

interface SeedCatalogShape {
  products: SeedProduct[];
}

let seedById: Map<string, SeedProduct> | null = null;
let seedBySku: Map<string, SeedProduct> | null = null;

function buildSeedLookups(): { byId: Map<string, SeedProduct>; bySku: Map<string, SeedProduct> } {
  if (seedById && seedBySku) return { byId: seedById, bySku: seedBySku };
  const byId = new Map<string, SeedProduct>();
  const bySku = new Map<string, SeedProduct>();
  for (const p of (productsSeed as SeedCatalogShape).products) {
    if (p.id) byId.set(p.id.toLowerCase(), p);
    if (p.sku) bySku.set(p.sku.toUpperCase(), p);
  }
  seedById = byId;
  seedBySku = bySku;
  return { byId, bySku };
}

/** Convert a MINOR amount between currencies using the server fallback
 *  rates (1 USD = rates[X] X). Kept local so re-pricing never depends on
 *  browser FX cache state. */
export function convertMinorFallback(minor: number, from: Currency, to: Currency): number {
  if (from === to) return Math.round(minor);
  const rFrom = FALLBACK_RATES_USD[from];
  const rTo = FALLBACK_RATES_USD[to];
  if (!rFrom || !rTo) return Math.round(minor);
  return Math.round((minor / rFrom) * rTo);
}

export interface MarketplacePriceRow {
  priceMinor: number;
  currency: string;
  status: string;
  /** Real catalog SKU from the products table — attached to repriced
   *  lines so the capture-side order_items recorder (which looks
   *  products up by SKU) matches marketplace purchases too. */
  sku?: string;
}

export type MarketplaceLookup = (ids: number[]) => Promise<Map<number, MarketplacePriceRow>>;

export async function defaultMarketplaceLookup(
  ids: number[],
): Promise<Map<number, MarketplacePriceRow>> {
  const out = new Map<number, MarketplacePriceRow>();
  if (ids.length === 0) return out;
  const db = getDb();
  const rows = await db
    .select({
      id: schema.products.id,
      priceMinor: schema.products.priceMinor,
      currency: schema.products.currency,
      status: schema.products.status,
      sku: schema.products.sku,
    })
    .from(schema.products)
    .where(inArray(schema.products.id, ids));
  for (const r of rows) {
    out.set(Number(r.id), {
      priceMinor: Number(r.priceMinor),
      currency: String(r.currency).toUpperCase(),
      status: String(r.status),
      sku: typeof r.sku === 'string' && r.sku.trim().length > 0 ? r.sku : undefined,
    });
  }
  return out;
}

/** A repriced line: server-authoritative unitAmount + resolved SKU
 *  (used downstream so PayPal items / order_items carry the REAL
 *  catalog SKU instead of the raw client productId). */
export type RepricedCartLine = CartLineItemPayload;

export type RepriceResult =
  | { ok: true; cart: RepricedCartLine[]; priceAdjusted: boolean }
  | { ok: false; status: 400 | 500; error: string };

export type Repricer = (
  cart: CartLineItemPayload[],
  currency: Currency,
) => Promise<RepriceResult>;

const NUMERIC_ID_RE = /^\d+$/;

export async function repriceCart(
  cart: CartLineItemPayload[],
  requestCurrency: Currency,
  marketplaceLookup: MarketplaceLookup = defaultMarketplaceLookup,
): Promise<RepriceResult> {
  const numericIds = Array.from(
    new Set(
      cart
        .filter((li) => NUMERIC_ID_RE.test(li.productId ?? ''))
        .map((li) => Number(li.productId)),
    ),
  );

  let marketplaceRows: Map<number, MarketplacePriceRow>;
  try {
    marketplaceRows = await marketplaceLookup(numericIds);
  } catch {
    // Fail CLOSED — if we cannot verify marketplace prices we must not
    // charge client-supplied amounts.
    return { ok: false, status: 500, error: 'Pricing service unavailable. Please retry.' };
  }

  const { byId, bySku } = buildSeedLookups();
  const out: RepricedCartLine[] = [];
  let priceAdjusted = false;

  for (const li of cart) {
    const pid = (li.productId ?? '').trim();

    // P0 currency-tamper guard: the per-line currency is NEVER trusted.
    // All lines are charged in the request currency; a mismatch flags
    // the cart as adjusted so the client must re-confirm.
    if (li.currency !== requestCurrency) priceAdjusted = true;

    if (NUMERIC_ID_RE.test(pid)) {
      // ---- Marketplace item (Neon products table) ----
      const row = marketplaceRows.get(Number(pid));
      if (!row) {
        return { ok: false, status: 400, error: `Unknown product id: ${pid}` };
      }
      if (row.status !== 'active') {
        return { ok: false, status: 400, error: `Product ${pid} is not available.` };
      }
      if (row.currency !== requestCurrency) {
        return { ok: false, status: 400, error: `Product ${pid} currency mismatch.` };
      }
      const serverMinor = row.priceMinor;
      if (li.unitAmount !== serverMinor) priceAdjusted = true;
      // Attach the REAL catalog SKU so the order_items recorder (SKU
      // lookup) matches marketplace purchases — without this the whole
      // order_items → payouts → referrals → merchant-email pipeline
      // no-ops on the marketplace rail (review P1). Always assigned —
      // a client-forged sku must never survive re-pricing.
      out.push({
        ...li,
        unitAmount: serverMinor,
        currency: requestCurrency,
        sku: row.sku,
      });
      continue;
    }

    // ---- Designer-rail item (bundled seed catalog) ----
    const seed = byId.get(pid.toLowerCase()) ?? bySku.get(pid.toUpperCase());
    if (!seed) {
      return { ok: false, status: 400, error: `Unknown catalog item: ${pid}` };
    }
    const nativeCurrency = String(seed.price.currency).toUpperCase() as Currency;
    const nativeMinor = Math.round(seed.price.value * 100);
    let serverMinor: number;
    if (nativeCurrency === requestCurrency) {
      serverMinor = nativeMinor;
      if (li.unitAmount !== serverMinor) priceAdjusted = true;
    } else {
      serverMinor = convertMinorFallback(nativeMinor, nativeCurrency, requestCurrency);
      const drift = Math.abs(li.unitAmount - serverMinor) / Math.max(serverMinor, 1);
      if (drift <= FX_TOLERANCE_PCT) {
        // Client priced with live FX inside tolerance — accept it.
        serverMinor = li.unitAmount;
      } else {
        priceAdjusted = true;
      }
    }
    out.push({ ...li, unitAmount: serverMinor, currency: requestCurrency, sku: seed.sku });
  }

  return { ok: true, cart: out, priceAdjusted };
}
