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

export type ProductCategory =
  | 'ice-bath'
  | 'sleep-pod'
  | 'ergo-chair'
  | 'plant'
  | 'eco-office-kit';

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

export interface Product {
  /** Stable identifier, kebab-or-numeric. Matches xlsx SKU. */
  id: string;
  sku: string;
  name: string;
  category: ProductCategory;
  supplier: string;
  /** All footprint measurements in centimetres. */
  dimensions_cm: Dimensions;
  weight_kg: number;
  price: Price;
  /** 0–1 (i.e. 0.15 = 15%) — commission paid to PPW on sale. */
  commission_pct: number;
  shopify_ready: boolean;
  image_url: string;
  /** Inline SVG snippet used for Week 1 placeholder thumbnails. */
  thumbnail_svg?: string;
  designer_status: DesignerStatus;
  delivery_regions: Region[];
  notes: string;
  /** Source URL — provenance for the dimensions / price. */
  source_url?: string;
}

export interface ProductCatalog {
  version: string;
  generated_at: string;
  generated_by: string;
  products: Product[];
}

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
