/**
 * Domain-scoped pricing + merchant attribution (DESIGNER-EXPANSION P6).
 *
 * PPW's commercial model is REFERRAL-COMMISSION (memory `merchant_commission_model`):
 * the merchant sells, fulfils and invoices; PPW earns an attribution % and
 * routes the buyer OUT to the merchant — there is NEVER a PPW checkout for these
 * designs. This module generalises that across domains as PURE functions:
 *
 *   - `priceDesign(domain, items)` — subtotal + per-line commission from each
 *     product's `commission_pct` (falling back to the domain merchant's default
 *     rate). The wellness path sums exactly as the cart does today.
 *   - `buildMerchantHandoffUrl(domain, design)` — the route-out URL to the
 *     domain's merchant storefront, carrying `?ref=ppw` (+ a domain tag) for
 *     attribution. No new endpoint, no PPW cart.
 *
 * FIREWALL: this file imports NOTHING from the cart / stripe / paypal / orders
 * modules and adds no serverless function. Airplane + car merchants are MOCK
 * config (real signup is Vic-gated). The live K1 `/api/k1/redirect` flow is
 * untouched — this is the additive, multi-domain attribution layer above it.
 */
import { getAllProducts, getProductById } from '../../data/products';
import type { AnyDomainProduct, Currency } from '../../data/products.schema';
import type { DomainId } from '../domain';

/** A merchant a domain's designs route out to. MOCK for airplane/car. */
export interface DomainMerchant {
  id: string;
  label: string;
  domain: DomainId;
  /** External storefront the buyer is routed to (route-out, never PPW checkout). */
  storefrontUrl: string;
  /** Fallback commission rate (0–1) for products lacking a per-line rate. */
  defaultCommissionPct: number;
}

const DOMAIN_MERCHANTS: Record<DomainId, DomainMerchant> = {
  'wellness-room': {
    id: 'k1-sport',
    label: 'K1 Sport',
    domain: 'wellness-room',
    storefrontUrl: 'https://k1-sport.com',
    defaultCommissionPct: 0.05, // 5% — K1 launch rate (merchant_commission_model)
  },
  airplane: {
    id: 'mock-aviation-interiors',
    label: 'Mock Aviation Interiors',
    domain: 'airplane',
    storefrontUrl: 'https://example-aviation-interiors.test',
    defaultCommissionPct: 0.05,
  },
  car: {
    id: 'mock-auto-configurator',
    label: 'Mock Auto Configurator',
    domain: 'car',
    storefrontUrl: 'https://example-auto.test',
    defaultCommissionPct: 0.05,
  },
};

/** The merchant a domain's designs route out to. */
export function getDomainMerchant(domain: DomainId): DomainMerchant {
  return DOMAIN_MERCHANTS[domain];
}

/** One line in a design to be priced. */
export interface PriceLineInput {
  productId: string;
  quantity?: number;
}

export interface PricedLine {
  productId: string;
  name: string;
  unitPrice: number;
  currency: Currency;
  quantity: number;
  lineTotal: number;
  /** Effective commission rate applied (0–1). */
  commissionPct: number;
  /** Commission PPW earns on this line, in the line currency. */
  commissionAmount: number;
}

export interface DesignPricing {
  domain: DomainId;
  merchantId: string;
  lines: PricedLine[];
  /** Subtotal in the design currency (pre-FX; the cart handles display FX). */
  subtotal: number;
  /** Total commission PPW earns across all lines. */
  totalCommission: number;
  /** The currency the subtotal is expressed in (first line's currency). */
  currency: Currency;
}

/**
 * Look up a product within a domain. Wellness uses `getProductById` (incl. the
 * merchant-API cache) so it matches the cart's lookup exactly; airplane + car
 * read their bundled mock catalog.
 */
function findDomainProduct(domain: DomainId, id: string): AnyDomainProduct | undefined {
  if (domain === 'wellness-room') return getProductById(id);
  return getAllProducts(domain).find((p) => p.id === id);
}

/**
 * Price a design's items for a domain. Pure + deterministic. Per-line
 * commission uses the product's own `commission_pct`, falling back to the
 * domain merchant's default rate when a product carries none.
 *
 * Wellness totals equal the cart's pre-FX subtotal (Σ price.value × qty), so
 * the live wellness experience is unaffected.
 */
export function priceDesign(domain: DomainId, items: PriceLineInput[]): DesignPricing {
  const merchant = getDomainMerchant(domain);
  const lines: PricedLine[] = [];

  for (const item of items) {
    const product = findDomainProduct(domain, item.productId);
    if (!product) continue; // unknown id → skip (cart does the same)
    const quantity = Math.max(1, Math.floor(item.quantity ?? 1));
    const unitPrice = product.price.value;
    const lineTotal = unitPrice * quantity;
    const commissionPct =
      product.commission_pct > 0 ? product.commission_pct : merchant.defaultCommissionPct;
    lines.push({
      productId: product.id,
      name: product.name,
      unitPrice,
      currency: product.price.currency,
      quantity,
      lineTotal,
      commissionPct,
      commissionAmount: round2(lineTotal * commissionPct),
    });
  }

  const subtotal = round2(lines.reduce((acc, l) => acc + l.lineTotal, 0));
  const totalCommission = round2(lines.reduce((acc, l) => acc + l.commissionAmount, 0));
  const currency: Currency = lines[0]?.currency ?? 'MUR';

  return { domain, merchantId: merchant.id, lines, subtotal, totalCommission, currency };
}

/** Round to 2 dp without float drift. */
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export interface MerchantHandoffInput {
  /** A stable id for the design being handed off (session / saved-design id). */
  designId: string;
  /** Optional single product focus (e.g. a "buy this" click). */
  productId?: string;
}

/**
 * Build the route-OUT URL to a domain merchant's storefront, carrying the
 * `?ref=ppw` attribution param (+ a `domain` tag + the design id). This is a
 * referral hand-off — the buyer leaves PPW; there is no PPW checkout. Pure +
 * tested; never points at an internal checkout/cart route.
 */
export function buildMerchantHandoffUrl(
  domain: DomainId,
  handoff: MerchantHandoffInput,
): string {
  const merchant = getDomainMerchant(domain);
  const url = new URL(merchant.storefrontUrl);
  url.searchParams.set('ref', 'ppw');
  url.searchParams.set('domain', domain);
  url.searchParams.set('design', handoff.designId);
  if (handoff.productId) url.searchParams.set('product', handoff.productId);
  return url.toString();
}
