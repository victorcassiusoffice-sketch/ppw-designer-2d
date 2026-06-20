/**
 * Catalog loader + access helpers.
 *
 * Week 1: ships the hand-curated seed products bundled at build-time
 * from products.json. Week 2: 6 products, region filter helpers added.
 * Week 3 will replace this with the xlsx -> JSON build step (see
 * scripts/import-inventory.ts).
 */

import catalogJson from './products.json';
import airplaneJson from './products.airplane.json';
import carJson from './products.car.json';
import { getApiProductFromCache } from './apiCatalogAdapter';
import { DEFAULT_DOMAIN } from '../lib/domain';
import type { DomainId } from '../lib/domain';
import type {
  Product,
  AirplaneProduct,
  CarProduct,
  AnyDomainProduct,
  ProductCatalog,
  AirplaneCatalog,
  CarCatalog,
  ProductCategory,
  AirplaneCategory,
  CarCategory,
  DomainCategory,
  Region,
} from './products.schema';

const catalog = catalogJson as unknown as ProductCatalog;
const airplaneCatalog = airplaneJson as unknown as AirplaneCatalog;
const carCatalog = carJson as unknown as CarCatalog;

/** The bundled catalog for a domain. Defaults preserve wellness behaviour. */
function catalogFor(domain: DomainId): ProductCatalog | AirplaneCatalog | CarCatalog {
  switch (domain) {
    case 'airplane':
      return airplaneCatalog;
    case 'car':
      return carCatalog;
    case 'wellness-room':
    default:
      return catalog;
  }
}

/**
 * The product catalog for a domain. No-arg + `'wellness-room'` return the
 * original wellness catalog unchanged, so every existing call site is intact.
 */
export function getCatalog(): ProductCatalog;
export function getCatalog(domain: 'wellness-room'): ProductCatalog;
export function getCatalog(domain: 'airplane'): AirplaneCatalog;
export function getCatalog(domain: 'car'): CarCatalog;
export function getCatalog(
  domain: DomainId = DEFAULT_DOMAIN,
): ProductCatalog | AirplaneCatalog | CarCatalog {
  return catalogFor(domain);
}

/** All products for a domain. No-arg defaults to wellness (unchanged). */
export function getAllProducts(): Product[];
export function getAllProducts(domain: 'wellness-room'): Product[];
export function getAllProducts(domain: 'airplane'): AirplaneProduct[];
export function getAllProducts(domain: 'car'): CarProduct[];
// Domain-generic accessor (DESIGNER-EXPANSION P4): a call site holding a
// `DomainId` variable (e.g. the active-domain UI) gets the widened union.
// Listed after the literal overloads so a literal still resolves to its
// narrow per-domain product type.
export function getAllProducts(domain: DomainId): AnyDomainProduct[];
export function getAllProducts(domain: DomainId = DEFAULT_DOMAIN): AnyDomainProduct[] {
  return catalogFor(domain).products;
}

export function getProductById(id: string): Product | undefined {
  const bundled = catalog.products.find((p) => p.id === id);
  if (bundled) return bundled;
  return getApiProductFromCache(id);
}

/** Products in a domain's category. Category type is checked per domain. */
export function getProductsByCategory(
  domain: 'wellness-room',
  category: ProductCategory,
): Product[];
export function getProductsByCategory(
  domain: 'airplane',
  category: AirplaneCategory,
): AirplaneProduct[];
export function getProductsByCategory(
  domain: 'car',
  category: CarCategory,
): CarProduct[];
export function getProductsByCategory(
  domain: DomainId,
  category: DomainCategory,
): AnyDomainProduct[] {
  return (catalogFor(domain).products as AnyDomainProduct[]).filter(
    (p) => p.category === category,
  );
}

export function getCategories(): ProductCategory[] {
  return Array.from(new Set(catalog.products.map((p) => p.category)));
}

export function searchProducts(query: string): Product[] {
  const q = query.trim().toLowerCase();
  if (!q) return catalog.products;
  return catalog.products.filter((p) => {
    return (
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      p.supplier.toLowerCase().includes(q) ||
      p.notes.toLowerCase().includes(q)
    );
  });
}

/**
 * Friendly label for a category — used in palette filter chips.
 */
export const CATEGORY_LABELS: Record<ProductCategory, string> = {
  'ice-bath': 'Ice Bath',
  'sleep-pod': 'Sleep Pod',
  'ergo-chair': 'Ergo Chair',
  plant: 'Plant',
  'eco-office-kit': 'Eco Office Kit',
  // PCF-1 (K1) — merchant-API category labels.
  massage: 'Massage',
  sauna: 'Sauna',
  fitness: 'Fitness',
  // Wellness-Designer-App (e/h) — Tweak 05 macro-category alignment.
  flooring: 'Flooring',
  walls: 'Walls',
  decor: 'Decor',
  other: 'Other',
};

/**
 * Friendly buyer-facing region groupings used by the palette filter.
 * Each grouping maps to a set of schema-level Region codes; a product
 * is shown if its `delivery_regions` intersects the active group.
 */
export type RegionGroup =
  | 'Mauritius'
  | 'Africa'
  | 'Europe'
  | 'North America'
  | 'Asia-Pacific'
  | 'Worldwide';

export const REGION_GROUPS: RegionGroup[] = [
  'Mauritius',
  'Africa',
  'Europe',
  'North America',
  'Asia-Pacific',
  'Worldwide',
];

export const REGION_GROUP_TO_CODES: Record<RegionGroup, Region[]> = {
  Mauritius: ['MU', 'global'],
  Africa: ['MU', 'global'],
  Europe: ['EU', 'UK', 'global'],
  'North America': ['US', 'global'],
  'Asia-Pacific': ['APAC', 'ME', 'global'],
  Worldwide: ['global'],
};

/** Filter products visible from a given buyer region. */
export function filterByRegion(products: Product[], group: RegionGroup): Product[] {
  const codes = new Set(REGION_GROUP_TO_CODES[group]);
  return products.filter((p) => p.delivery_regions.some((r) => codes.has(r)));
}

/**
 * Faint footprint fill colours per category — used by the canvas
 * placed-item renderer. Stroke darkens slightly on selection.
 */
export const CATEGORY_FILL: Record<ProductCategory, { fill: string; stroke: string }> = {
  'ice-bath':       { fill: '#5EEAD4', stroke: '#0F766E' },
  'sleep-pod':      { fill: '#E9EDEF', stroke: '#3B4A52' },
  'ergo-chair':     { fill: '#94A3B8', stroke: '#0E1B1F' },
  plant:            { fill: '#84A98C', stroke: '#3A5A40' },
  'eco-office-kit': { fill: '#D4B896', stroke: '#7C5E3C' },
  // PCF-1 — V4-AU-1 gold tint for merchant-supplied SKUs so they're
  // visually distinct from the bundled DEMO seeds.
  massage:          { fill: '#E9DCC2', stroke: '#C0A67E' },
  sauna:            { fill: '#DAA060', stroke: '#7A4F1F' },
  fitness:          { fill: '#C0C0C0', stroke: '#404040' },
  // Wellness-Designer-App (e/h) — Tweak 05 macro fills. Warm earth
  // tones for flooring; cool grey-blue for walls; sage for decor.
  flooring:         { fill: '#D7C3A0', stroke: '#7C5E3C' },
  walls:            { fill: '#C8D0D8', stroke: '#3B4A52' },
  decor:            { fill: '#B6C8B0', stroke: '#5A7A60' },
  other:            { fill: '#F5EFE6', stroke: '#C0A67E' },
};

/**
 * SVG placeholder thumbnails. Real product photography lands Week 3.
 */
export function thumbnailFor(category: ProductCategory): string {
  switch (category) {
    case 'ice-bath':
      return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect x="6" y="20" width="52" height="34" rx="6" fill="#5EEAD4" stroke="#0F766E" stroke-width="2"/>
        <path d="M14 30 Q22 24 32 30 T54 30" stroke="#0F766E" stroke-width="2" fill="none" stroke-linecap="round"/>
        <path d="M14 38 Q22 32 32 38 T54 38" stroke="#0F766E" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.6"/>
        <circle cx="50" cy="14" r="3" fill="#0F766E"/>
      </svg>`;
    case 'sleep-pod':
      return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M8 44 Q8 16 32 16 Q56 16 56 44 L56 52 L8 52 Z" fill="#E9EDEF" stroke="#3B4A52" stroke-width="2"/>
        <rect x="18" y="40" width="28" height="6" rx="2" fill="#84A98C"/>
        <circle cx="48" cy="30" r="2" fill="#0F766E"/>
      </svg>`;
    case 'ergo-chair':
      return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect x="20" y="10" width="24" height="26" rx="4" fill="#3B4A52" stroke="#0E1B1F" stroke-width="2"/>
        <rect x="16" y="34" width="32" height="10" rx="3" fill="#3B4A52" stroke="#0E1B1F" stroke-width="2"/>
        <line x1="32" y1="44" x2="32" y2="54" stroke="#0E1B1F" stroke-width="3"/>
        <path d="M20 54 L44 54" stroke="#0E1B1F" stroke-width="3" stroke-linecap="round"/>
      </svg>`;
    case 'plant':
      return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M32 50 L32 14" stroke="#84A98C" stroke-width="3" stroke-linecap="round"/>
        <path d="M32 30 Q22 18 18 26 Q20 30 32 30" fill="#84A98C"/>
        <path d="M32 24 Q44 14 48 22 Q46 28 32 24" fill="#84A98C"/>
        <path d="M32 38 Q24 30 22 36 Q24 40 32 38" fill="#84A98C"/>
        <rect x="22" y="48" width="20" height="10" rx="2" fill="#3B4A52"/>
      </svg>`;
    case 'eco-office-kit':
      return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect x="6" y="28" width="52" height="6" rx="1" fill="#C4CBCD" stroke="#3B4A52" stroke-width="2"/>
        <rect x="10" y="34" width="3" height="18" fill="#3B4A52"/>
        <rect x="51" y="34" width="3" height="18" fill="#3B4A52"/>
        <rect x="22" y="14" width="20" height="14" rx="1" fill="#0E1B1F" stroke="#3B4A52" stroke-width="2"/>
        <rect x="20" y="22" width="24" height="6" rx="1" fill="#84A98C"/>
      </svg>`;
    // PCF-1 (K1) — V4-AU-1 gold thumbs for merchant-API categories.
    case 'massage':
      return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect x="14" y="20" width="36" height="24" rx="6" fill="#E9DCC2" stroke="#C0A67E" stroke-width="2"/>
        <rect x="20" y="14" width="24" height="10" rx="3" fill="#C0A67E"/>
        <rect x="22" y="44" width="20" height="8" rx="2" fill="#C0A67E"/>
      </svg>`;
    case 'sauna':
      return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect x="10" y="12" width="44" height="44" rx="6" fill="#DAA060" stroke="#7A4F1F" stroke-width="2"/>
        <rect x="20" y="22" width="24" height="4" rx="1" fill="#7A4F1F" opacity="0.6"/>
        <rect x="20" y="30" width="24" height="4" rx="1" fill="#7A4F1F" opacity="0.6"/>
        <rect x="20" y="38" width="24" height="4" rx="1" fill="#7A4F1F" opacity="0.6"/>
      </svg>`;
    case 'fitness':
      return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect x="10" y="26" width="44" height="14" rx="3" fill="#C0C0C0" stroke="#404040" stroke-width="2"/>
        <circle cx="18" cy="33" r="4" fill="#404040"/>
        <circle cx="46" cy="33" r="4" fill="#404040"/>
        <rect x="22" y="18" width="20" height="6" rx="1" fill="#0E0E10"/>
      </svg>`;
    case 'flooring':
      return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect x="8" y="8" width="48" height="48" rx="2" fill="#D7C3A0" stroke="#7C5E3C" stroke-width="2"/>
        <line x1="8" y1="20" x2="56" y2="20" stroke="#7C5E3C" stroke-width="1.2" opacity="0.5"/>
        <line x1="8" y1="32" x2="56" y2="32" stroke="#7C5E3C" stroke-width="1.2" opacity="0.5"/>
        <line x1="8" y1="44" x2="56" y2="44" stroke="#7C5E3C" stroke-width="1.2" opacity="0.5"/>
        <line x1="20" y1="8" x2="20" y2="56" stroke="#7C5E3C" stroke-width="1.2" opacity="0.3"/>
        <line x1="32" y1="8" x2="32" y2="56" stroke="#7C5E3C" stroke-width="1.2" opacity="0.3"/>
        <line x1="44" y1="8" x2="44" y2="56" stroke="#7C5E3C" stroke-width="1.2" opacity="0.3"/>
      </svg>`;
    case 'walls':
      return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect x="6" y="10" width="52" height="44" fill="#C8D0D8" stroke="#3B4A52" stroke-width="2"/>
        <rect x="12" y="16" width="10" height="14" fill="none" stroke="#3B4A52" stroke-width="1.2" opacity="0.5"/>
        <rect x="26" y="16" width="10" height="14" fill="none" stroke="#3B4A52" stroke-width="1.2" opacity="0.5"/>
        <rect x="40" y="16" width="10" height="14" fill="none" stroke="#3B4A52" stroke-width="1.2" opacity="0.5"/>
      </svg>`;
    case 'decor':
      return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <circle cx="32" cy="32" r="20" fill="#B6C8B0" stroke="#5A7A60" stroke-width="2"/>
        <path d="M32 14 L36 28 L50 28 L38 36 L42 50 L32 42 L22 50 L26 36 L14 28 L28 28 Z" fill="#5A7A60" opacity="0.4"/>
      </svg>`;
    case 'other':
      return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect x="12" y="12" width="40" height="40" rx="4" fill="#F5EFE6" stroke="#C0A67E" stroke-width="2"/>
        <text x="32" y="40" text-anchor="middle" font-family="sans-serif" font-size="22" fill="#C0A67E">★</text>
      </svg>`;
  }
}

/**
 * CATALOG / DETAIL image (2026-06-09) — resolve the best image to show a
 * customer in the left-panel catalog tile, the hover detail card and the
 * product detail panel. Preference order:
 *   1. `photo_image_url`   — the REAL manufacturer/retailer product photo
 *                            (studio shot on white) downloaded into
 *                            `/public/products/photos/`. This is what a
 *                            shopper expects to see.
 *   2. `topdown_image_url` — the generated top-down render (fallback when
 *                            no real photo could be sourced — see
 *                            `scripts/real-image-manifest.json`).
 *   3. `image_url`         — merchant-supplied URL (often a placeholder).
 *   4. SVG thumbnail        — `thumbnailFor(category)` as a `data:` URI;
 *                            never returns an empty string.
 */
export function productImageUrl(p: Product): string {
  if (p.photo_image_url) return p.photo_image_url;
  if (p.topdown_image_url) return p.topdown_image_url;
  if (p.image_url) return p.image_url;
  return `data:image/svg+xml;utf8,${encodeURIComponent(thumbnailFor(p.category))}`;
}

/**
 * ON-CANVAS FOOTPRINT image — what the Konva placed-item renders inside its
 * floor-plan footprint box. Here a TOP-DOWN render reads correctly (a
 * rotated item turns the image, not a perspective photo), so top-down wins
 * over the perspective product photo. Preference order:
 *   topdown_image_url → photo_image_url → image_url → SVG.
 * Mirrors `productImageUrl`'s never-empty guarantee.
 */
export function productTopDownUrl(p: Product): string {
  if (p.topdown_image_url) return p.topdown_image_url;
  if (p.photo_image_url) return p.photo_image_url;
  if (p.image_url) return p.image_url;
  return `data:image/svg+xml;utf8,${encodeURIComponent(thumbnailFor(p.category))}`;
}
