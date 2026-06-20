/**
 * Product schema for the Wellness Room Designer.
 *
 * Mirrors the 16-column CAT1-INVENTORY sheet inside
 * `06-Roadmap/email-blast-master/PPW-Email-Blast-Master.xlsx`.
 *
 * Column order (Week 1 reference — Cowork 2026-05-11):
 *   1.  SKU
 *   2.  Product Name              -> name
 *   3.  Category                  -> category
 *   4.  Supplier                  -> supplier
 *   5.  Length (cm)               -> dimensions_cm.length
 *   6.  Width (cm)                -> dimensions_cm.width
 *   7.  Height (cm)               -> dimensions_cm.height
 *   8.  Weight (kg)               -> weight_kg
 *   9.  Price                     -> price.value
 *   10. Commission %              -> commission_pct
 *   11. Currency                  -> price.currency
 *   12. Shopify-ready (Y/N)       -> shopify_ready
 *   13. Image URL                 -> image_url
 *   14. Designer-integration Stat -> designer_status
 *   15. Delivery Regions          -> delivery_regions[]
 *   16. Notes                     -> notes
 *
 * The xlsx -> json importer in scripts/import-inventory.ts (Week 2)
 * will write directly to this schema. Do not reshape lightly.
 */

import type { DomainId } from '../lib/domain';

/**
 * Wellness-room product categories. The original single-domain enum.
 * Declared as a `const` tuple (was a hand-written union) so a runtime
 * validator can iterate the literals; the derived `ProductCategory` type
 * is byte-for-byte the same union as before.
 */
export const WELLNESS_CATEGORIES = [
  'ice-bath',
  'sleep-pod',
  'ergo-chair',
  'plant',
  'eco-office-kit',
  // PCF-1 (K1 meeting 2026-05-19) — categories surfaced from merchant API.
  // Sourced from migration 0004 product_status / agent category enums.
  'massage',
  'sauna',
  'fitness',
  // Wellness-Designer-App (e) — engineering plumbing for the Flooring
  // macro tab. Products tagged 'flooring' (via merchant signup or seed)
  // land in the Flooring tab via PRODUCT_TO_MACRO. Data side is
  // Vic-decision #WDA-5 gated — schema is ready when SKUs arrive.
  'flooring',
  'walls',
  'decor',
  'other',
] as const;
export type ProductCategory = (typeof WELLNESS_CATEGORIES)[number];

/**
 * Airplane-cabin categories (DESIGNER-EXPANSION P2). The airplane domain
 * lays out a fuselage section; these are the kinds of monument a cabin
 * holds. MOCK catalog only until a real aviation-interior merchant signs.
 */
export const AIRPLANE_CATEGORIES = [
  'seat',
  'galley',
  'lavatory',
  'overhead-bin',
  'lighting',
  'panel',
  'monument',
] as const;
export type AirplaneCategory = (typeof AIRPLANE_CATEGORIES)[number];

/**
 * Car-configurator categories (DESIGNER-EXPANSION P2). The car domain is a
 * stepper build flow; these are the option groups a buyer steps through.
 * MOCK catalog only until a real automotive merchant signs.
 */
export const CAR_CATEGORIES = [
  'model',
  'trim',
  'paint',
  'wheel',
  'seat',
  'infotainment',
  'package',
] as const;
export type CarCategory = (typeof CAR_CATEGORIES)[number];

/** Any category across every domain — the widened category space. */
export type DomainCategory = ProductCategory | AirplaneCategory | CarCategory;

export type DesignerStatus = 'Not Started' | 'In Progress' | 'Blocked' | 'Done';

export type Currency = 'MUR' | 'USD' | 'EUR' | 'GBP';

export type Region = 'MU' | 'global' | 'EU' | 'UK' | 'US' | 'ME' | 'APAC';

export interface Dimensions {
  /** Footprint length, centimetres (X axis on the floor). */
  length: number;
  /** Footprint width, centimetres (Z axis on the floor). */
  width: number;
  /** Object height, centimetres (Y axis). */
  height: number;
}

export interface Price {
  value: number;
  currency: Currency;
}

/**
 * A catalog product, parametrised by its domain's category space.
 *
 * `ProductOf<ProductCategory>` is the wellness product and is exported below
 * as `Product` — structurally identical to the pre-expansion interface, so
 * every existing wellness consumer compiles unchanged. Airplane + car use
 * `ProductOf<AirplaneCategory>` / `ProductOf<CarCategory>`. The P2 fields at
 * the bottom (`domain`, `provenance`, `mock`) are all optional and additive.
 */
export interface ProductOf<C extends DomainCategory = ProductCategory> {
  /** Stable identifier, kebab-or-numeric. Matches xlsx SKU. */
  id: string;
  sku: string;
  name: string;
  category: C;
  supplier: string;
  /** All footprint measurements in centimetres. */
  dimensions_cm: Dimensions;
  weight_kg: number;
  price: Price;
  /** 0–1 (i.e. 0.15 = 15%) — commission paid to PPW on sale. */
  commission_pct: number;
  shopify_ready: boolean;
  image_url: string;
  /**
   * Real product PHOTO (2026-06-09) — manufacturer/retailer studio shot,
   * downloaded into `/public/products/photos/<slug>.<ext>` (never hotlinked,
   * so it's reliable). Highest-priority image when present. Sourced by
   * `scripts/fetch-real-images.mjs`; provenance + any "representative
   * variant" flags live in `scripts/real-image-manifest.json`. Falls back to
   * `topdown_image_url` (the generated top-down render) when absent.
   */
  photo_image_url?: string;
  /** Inline SVG snippet used for Week 1 placeholder thumbnails. */
  thumbnail_svg?: string;
  designer_status: DesignerStatus;
  delivery_regions: Region[];
  notes: string;
  /** Source URL — provenance for the dimensions / price. */
  source_url?: string;
  /**
   * Tweak 01 (Phase B) — top-down PNG (`/public/products/k1/<sku>.png`
   * convention, transparent 1:1 512×512 per the brief). Optional; when
   * absent the grey-box thumbnail fallback renders. Asset bake is a
   * Media Dept job — see `media-dept/top-down-product-image-prompt-rd-2026-05-21.md`.
   */
  topdown_image_url?: string;
  /**
   * Tweak 06 (Phase B) — scalable 3D asset (glTF 2.0 / `.glb`). Babylon
   * lazy-loads via SceneLoader.AppendAsync when present; falls back to
   * procedural textured box. Generation is Vic-money-gated (Image
   * Blaster + Fal.ai); ship the column-shape now so the persistence
   * layer is ready when the assets land.
   */
  mesh_url?: string;
  /**
   * Tweak 02 / 03 (Phase C) — Sustainability eco-bar v1 filter. When
   * `true` the product passes the eco-only catalog filter (paints +
   * flooring + panels are eco-only by brief mandate; furniture +
   * cardio gear are eco-tagged once Sustainability Dept charter is
   * signed off). `undefined` is treated as `false` by the filter so
   * a missing flag never sneaks into the eco-only view.
   */
  eco_certified?: boolean;
  /**
   * DESIGNER-EXPANSION P2 — the domain this product belongs to. Absent on
   * the wellness seed (treated as `wellness-room` by the loader) so the
   * existing catalog stays byte-for-byte unchanged; airplane + car seeds
   * set it explicitly.
   */
  domain?: DomainId;
  /**
   * DESIGNER-EXPANSION P2 — where the row came from. The airplane + car
   * catalogs are hand-seeded MOCK data (`'seed'`); real merchant rows arrive
   * as `'merchant-api'` once a domain merchant is Vic-approved.
   */
  provenance?: 'seed' | 'merchant-api' | 'manual';
  /** DESIGNER-EXPANSION P2 — explicit mock flag for the seeded catalogs. */
  mock?: boolean;
}

/** The wellness product — unchanged shape, the default `Product`. */
export type Product = ProductOf<ProductCategory>;
/** An airplane-cabin product (MOCK seed in P2). */
export type AirplaneProduct = ProductOf<AirplaneCategory>;
/** A car-configurator product (MOCK seed in P2). */
export type CarProduct = ProductOf<CarCategory>;
/** A product from any domain — useful where the domain is dynamic. */
export type AnyDomainProduct = Product | AirplaneProduct | CarProduct;

/**
 * A product catalog, parametrised by domain category space.
 * `ProductCatalog` (wellness) keeps its original shape.
 */
export interface ProductCatalogOf<C extends DomainCategory = ProductCategory> {
  version: string;
  generated_at: string;
  generated_by: string;
  products: ProductOf<C>[];
}

export type ProductCatalog = ProductCatalogOf<ProductCategory>;
export type AirplaneCatalog = ProductCatalogOf<AirplaneCategory>;
export type CarCatalog = ProductCatalogOf<CarCategory>;

/**
 * Convenience: returns the bounding box in *pixels* given a metre-to-pixel
 * scale factor. RoomCanvas uses 100 px / metre by default.
 */
export function dimsToPx(
  d: Dimensions,
  pxPerMetre: number,
): { wPx: number; dPx: number } {
  return {
    wPx: (d.length / 100) * pxPerMetre,
    dPx: (d.width / 100) * pxPerMetre,
  };
}
