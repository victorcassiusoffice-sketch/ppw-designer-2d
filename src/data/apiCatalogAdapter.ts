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
 * Real-image enrichment. Since 2026-07-26 (WD directive 2) the live
 * `/api/products` contract is: `imageUrl` = shop-facing product PHOTO,
 * `topdownImageUrl` = designer-canvas plan asset. The bundled seed remains
 * the belt-and-braces source for both, matched by SKU, so designer products
 * keep their exact-footprint top-downs WITHOUT needing a DB re-seed.
 * Imported from the JSON directly (not via products.ts) to avoid an import
 * cycle.
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
  /** Designer-canvas plan asset (photo/top-down split, 2026-07-26). */
  topdownImageUrl?: string | null;
  region: string | null;
  /** Eco / solar (2026-09-04, migration 0029) — on the wire only when ENERGY_DB_COLUMNS=1. */
  powerW?: number | null;
  dutyHoursPerDay?: number | string | null;
  pvWp?: number | null;
  batteryWh?: number | null;
  inverterW?: number | null;
  energyRole?: string | null;
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

/**
 * Map a merchant-API category string onto the Designer's `ProductCategory`.
 * Every value that IS a `ProductCategory` passes through; the DB-only
 * agent categories (tables, beds, storage, seating, plants) and anything
 * unknown collapse to `other`.
 *
 * Sims world (2026-08-29): `lighting`, `decor`, `flooring` and `walls`
 * now pass through. Before this they were folded into `other`, which
 * meant a merchant lamp never lit and a merchant floor mat collided with
 * equipment (the flooring layer band keys off `category === 'flooring'`).
 */
export function normaliseCategory(raw: string): ProductCategory {
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
    case 'flooring':
    case 'walls':
    case 'decor':
    case 'lighting':
    case 'solar':
      return c as ProductCategory;
    case 'tables':
    case 'beds':
    case 'storage':
    case 'seating':
    case 'plants':
      return 'other';
    default:
      return 'other';
  }
}

/**
 * Designer-behaviour fields the `/api/products` wire shape does not carry
 * (the DB row has no placement / lighting / outdoor columns). They ride on
 * the bundled seed and are copied across by SKU so a merchant row for a
 * seeded SKU behaves exactly like the seed on the canvas.
 *
 * Parity fix (2026-08-29): until now the SKU merge carried only supplier,
 * commission_pct, photo_image_url, topdown_image_url and notes — so an
 * API-served wall shelf lost `placement: 'wall'`, a console lost
 * `is_surface`, and every item lost `front_edge`. Those plus the new
 * lighting / outdoor / plan-symbol fields are now merged.
 */
const SEED_BEHAVIOUR_FIELDS = [
  'placement',
  'is_surface',
  'front_edge',
  'mount_height_cm',
  'emits_light',
  'light_radius_m',
  'outdoor',
  'plan_symbol',
  'thumbnail_svg',
  // Eco / solar (2026-09-04): a seeded panel / inverter / battery served by
  // the API keeps its ratings; a merchant row's own DB values win below.
  'power_w',
  'duty_hours_per_day',
  'pv_wp',
  'battery_kwh',
  'inverter_kw',
  'energy_role',
] as const satisfies readonly (keyof Product)[];

type SeedBehaviourField = (typeof SEED_BEHAVIOUR_FIELDS)[number];

/** Only the seed's DEFINED behaviour fields — never writes `undefined` keys. */
function seedBehaviour(seed: Product | undefined): Partial<Pick<Product, SeedBehaviourField>> {
  const out: Partial<Pick<Product, SeedBehaviourField>> = {};
  if (!seed) return out;
  for (const key of SEED_BEHAVIOUR_FIELDS) {
    const v = seed[key];
    if (v !== undefined) (out as Record<string, unknown>)[key] = v;
  }
  return out;
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
    // Real product photo + generated top-down. Bundled seed wins (exact
    // committed assets); the API's topdownImageUrl covers non-seed merchant
    // products once generated. `productImageUrl` prefers the photo
    // (catalog/detail); `productTopDownUrl` prefers the top-down (canvas).
    photo_image_url: seed?.photo_image_url,
    topdown_image_url: seed?.topdown_image_url ?? api.topdownImageUrl ?? undefined,
    designer_status: 'Done',
    delivery_regions: normaliseRegion(api.region),
    // Prefer the live DB description; fall back to the curated bundled notes
    // so the detail panel is never blank.
    notes: api.description?.trim() || seed?.notes || '',
    ...seedBehaviour(seed),
    ...apiEnergyFields(api),
  };
}

/** Positive finite number or undefined (the wire carries null / numeric strings). */
function posNum(v: unknown): number | undefined {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : undefined;
}

/**
 * Eco / solar (2026-09-04): the DB row's energy figures → Product fields.
 * DB units are W / Wh; the Product schema keeps kWh / kW for batteries and
 * inverters (what the shop labels say). Only DEFINED keys are written so a
 * row without the 0029 columns leaves the seed's values in place.
 */
function apiEnergyFields(
  api: ApiProductSummary,
): Partial<Pick<Product, 'power_w' | 'duty_hours_per_day' | 'pv_wp' | 'battery_kwh' | 'inverter_kw' | 'energy_role'>> {
  const out: Partial<Pick<Product, 'power_w' | 'duty_hours_per_day' | 'pv_wp' | 'battery_kwh' | 'inverter_kw' | 'energy_role'>> = {};
  const powerW = posNum(api.powerW);
  const hours = posNum(api.dutyHoursPerDay);
  const pvWp = posNum(api.pvWp);
  const batteryWh = posNum(api.batteryWh);
  const inverterW = posNum(api.inverterW);
  if (powerW !== undefined) out.power_w = Math.round(powerW);
  if (hours !== undefined) out.duty_hours_per_day = Math.min(24, hours);
  if (pvWp !== undefined) out.pv_wp = Math.round(pvWp);
  if (batteryWh !== undefined) out.battery_kwh = Math.round(batteryWh / 10) / 100;
  if (inverterW !== undefined) out.inverter_kw = Math.round(inverterW / 10) / 100;
  const role = api.energyRole;
  if (role === 'consumer' || role === 'generator' || role === 'storage' || role === 'inverter' || role === 'none') {
    out.energy_role = role;
  }
  return out;
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
