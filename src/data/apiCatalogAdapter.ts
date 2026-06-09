/**
 * PCF-1 (K1 meeting 2026-05-19) — adapter that blends `/api/products`
 * (Neon-backed merchant catalog) into the bundled JSON seeds so the
 * Designer Catalog (`ProductPalette`) shows merchant-supplied SKUs.
 *
 * Until this PCF, Phase 8's TODO comment in `api/products.ts` said the
 * Designer Catalog read from hardcoded `products.json` only. The K1
 * meeting demonstrably needs merchant products visible — Vic seeded 5
 * via the `demo-supplier-cn` merchant and they were API-visible but
 * Designer-invisible. This adapter closes that gap.
 */

import type {
  Currency,
  Product,
  ProductCatalog,
  ProductCategory,
  Region,
} from './products.schema';
import catalogJson from './products.json';

/**
 * Real-image enrichment (2026-06-09) — the live `/api/products` rows carry
 * the generated top-down path as `imageUrl` and never the real product
 * PHOTO. We backfill the photo (and the bundled top-down) from the bundled
 * seed, matched by SKU, so merchant/DB products show the same real photos
 * as the bundled catalog WITHOUT needing a DB re-seed. Imported from the
 * JSON directly (not via products.ts) to avoid an import cycle.
 */
const _bundledBySku: Map<string, Product> = new Map(
  (catalogJson as unknown as ProductCatalog).products.map((p) => [p.sku, p]),
);

/** Wire shape from `/api/products`. Mirror of `ProductSummary`. */
export interface ApiProductSummary {
  id: number;
  sku: string;
  name: string;
  category: string;
  description: string | null;
  widthMm: number | null;
  depthMm: number | null;
  heightMm: number | null;
  weightG: number | null;
  priceMinor: number;
  currency: string;
  imageUrl: string | null;
  region: string | null;
}

export interface ApiProductsResponse {
  products: ApiProductSummary[];
  total: number;
  limit: number;
  offset: number;
  schemaMissing?: boolean;
}

const ALLOWED_CURRENCIES: readonly Currency[] = ['MUR', 'USD', 'EUR', 'GBP'];
const ALLOWED_REGIONS: readonly Region[] = ['MU', 'global', 'EU', 'UK', 'US', 'ME', 'APAC'];

function normaliseCategory(raw: string): ProductCategory {
  const c = raw.trim().toLowerCase();
  switch (c) {
    case 'ice-bath':
    case 'sleep-pod':
    case 'ergo-chair':
    case 'plant':
    case 'eco-office-kit':
    case 'massage':
    case 'sauna':
    case 'fitness':
      return c as ProductCategory;
    case 'tables':
    case 'beds':
    case 'lighting':
    case 'storage':
    case 'decor':
    case 'seating':
    case 'plants':
      return 'other';
    default:
      return 'other';
  }
}

function normaliseCurrency(raw: string): Currency {
  const c = raw.trim().toUpperCase();
  if ((ALLOWED_CURRENCIES as readonly string[]).includes(c)) return c as Currency;
  return 'MUR';
}

function normaliseRegion(raw: string | null): Region[] {
  if (!raw) return ['global'];
  const r = raw.trim().toUpperCase();
  if ((ALLOWED_REGIONS as readonly string[]).includes(r)) return [r as Region, 'global'];
  return ['global'];
}

/**
 * mm → cm conversion for the Designer footprint geometry.
 * Bundled Product uses `dimensions_cm { length, width, height }`;
 * API uses `widthMm, depthMm, heightMm`. The Designer canvas treats
 * `length` as the long horizontal axis (X) so we map API.width → length
 * to keep the Sims-Parity DT-09 width/depth/height contract consistent.
 */
export function apiProductToProduct(api: ApiProductSummary): Product {
  const widthCm = (api.widthMm ?? 600) / 10;
  const depthCm = (api.depthMm ?? 400) / 10;
  const heightCm = (api.heightMm ?? 800) / 10;
  // Real-image + description enrichment by SKU (see _bundledBySku above).
  const seed = _bundledBySku.get(api.sku);
  return {
    id: `m-${api.id}`, // namespace API ids so they never collide with seed ids
    sku: api.sku,
    name: api.name,
    category: normaliseCategory(api.category),
    supplier: seed?.supplier ?? 'Merchant via M9.B.1',
    dimensions_cm: {
      length: Math.max(1, Math.round(widthCm)),
      width: Math.max(1, Math.round(depthCm)),
      height: Math.max(1, Math.round(heightCm)),
    },
    weight_kg: (api.weightG ?? 0) / 1000,
    price: {
      value: (api.priceMinor ?? 0) / 100,
      currency: normaliseCurrency(api.currency ?? 'MUR'),
    },
    commission_pct: seed?.commission_pct ?? 0,
    shopify_ready: false,
    image_url: api.imageUrl ?? '',
    // Real product photo + generated top-down, pulled from the bundled
    // seed by SKU. `productImageUrl` prefers the photo (catalog/detail);
    // `productTopDownUrl` prefers the top-down (canvas footprint).
    photo_image_url: seed?.photo_image_url,
    topdown_image_url: seed?.topdown_image_url,
    designer_status: 'Done',
    delivery_regions: normaliseRegion(api.region),
    // Prefer the live DB description; fall back to the curated bundled notes
    // so the detail panel is never blank.
    notes: api.description?.trim() || seed?.notes || '',
  };
}

/**
 * Module-level cache of API-fetched products keyed by their `m-<dbId>`
 * pseudo-slug. Phase-0 fix: the FSM stores `pendingProductId` from the
 * card's `data-product-id`, which is the namespaced API id for merchant
 * rows. Without this cache, `getProductById` (which only reads bundled
 * JSON) returns null and placement is rejected with "Unknown product".
 *
 * The cache is monotonic-growing — newer calls overwrite older entries
 * by id, never delete. That matches the Designer's "fetch once on mount,
 * stay live for the session" model in ProductPalette.
 */
const _apiProductsCache: Map<string, Product> = new Map();

/** Read-only accessor for the API products cache, used by `getProductById`. */
export function getApiProductFromCache(id: string): Product | undefined {
  return _apiProductsCache.get(id);
}

/**
 * Fetch `/api/products` and adapt rows to the bundled `Product` shape.
 * Returns an empty list on any failure (network, schema-missing, etc.)
 * so the Designer Catalog degrades gracefully to bundled seeds only.
 */
export async function fetchApiProducts(
  fetchImpl: typeof globalThis.fetch = globalThis.fetch,
  url = '/api/products?limit=100',
): Promise<Product[]> {
  try {
    const res = await fetchImpl(url);
    if (!res.ok) return [];
    const json = (await res.json()) as ApiProductsResponse;
    if (!json.products || json.schemaMissing) return [];
    const adapted = json.products.map(apiProductToProduct);
    for (const p of adapted) _apiProductsCache.set(p.id, p);
    return adapted;
  } catch {
    return [];
  }
}
