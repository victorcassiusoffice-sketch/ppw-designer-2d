/**
 * Runtime schema validation for the bundled seed catalogs (DESIGNER-EXPANSION P2).
 *
 * `products.schema.ts` is a compile-time TypeScript contract; JSON imported with
 * `as unknown as ProductCatalog` is NOT runtime-checked. This module adds a zod
 * mirror so the seeded airplane + car catalogs (and the wellness catalog) can be
 * asserted schema-valid in tests, and so any future hand-edit to a seed JSON
 * fails loudly rather than shipping a malformed row.
 *
 * The category enum is injected per domain so each catalog validates against its
 * own category space (wellness SKUs vs aviation monuments vs car options).
 */
import { z } from 'zod';
import {
  WELLNESS_CATEGORIES,
  AIRPLANE_CATEGORIES,
  CAR_CATEGORIES,
} from './products.schema';
import type { DomainCategory } from './products.schema';

const CURRENCIES = ['MUR', 'USD', 'EUR', 'GBP'] as const;
const REGIONS = ['MU', 'global', 'EU', 'UK', 'US', 'ME', 'APAC'] as const;
const DESIGNER_STATUSES = [
  'Not Started',
  'In Progress',
  'Blocked',
  'Done',
] as const;
const DOMAINS = ['wellness-room', 'airplane', 'car'] as const;

const DimensionsSchema = z.object({
  length: z.number(),
  width: z.number(),
  height: z.number(),
});

const PriceSchema = z.object({
  value: z.number(),
  currency: z.enum(CURRENCIES),
});

/** Build a product schema bound to a domain's category tuple. */
export function productSchemaFor(
  categories: readonly [DomainCategory, ...DomainCategory[]],
) {
  return z
    .object({
      id: z.string().min(1),
      sku: z.string().min(1),
      name: z.string().min(1),
      category: z.enum(categories as [string, ...string[]]),
      supplier: z.string(),
      dimensions_cm: DimensionsSchema,
      weight_kg: z.number(),
      price: PriceSchema,
      commission_pct: z.number().min(0).max(1),
      shopify_ready: z.boolean(),
      image_url: z.string(),
      designer_status: z.enum(DESIGNER_STATUSES),
      delivery_regions: z.array(z.enum(REGIONS)),
      notes: z.string(),
      // optional / additive fields
      photo_image_url: z.string().optional(),
      thumbnail_svg: z.string().optional(),
      source_url: z.string().optional(),
      topdown_image_url: z.string().optional(),
      mesh_url: z.string().optional(),
      eco_certified: z.boolean().optional(),
      domain: z.enum(DOMAINS).optional(),
      provenance: z.enum(['seed', 'merchant-api', 'manual']).optional(),
      mock: z.boolean().optional(),
    })
    .strict();
}

/** Build a catalog schema bound to a domain's category tuple. */
export function catalogSchemaFor(
  categories: readonly [DomainCategory, ...DomainCategory[]],
) {
  return z.object({
    version: z.string().min(1),
    generated_at: z.string().min(1),
    generated_by: z.string().min(1),
    products: z.array(productSchemaFor(categories)).min(1),
  });
}

export const WellnessCatalogSchema = catalogSchemaFor(
  WELLNESS_CATEGORIES as unknown as [DomainCategory, ...DomainCategory[]],
);
export const AirplaneCatalogSchema = catalogSchemaFor(
  AIRPLANE_CATEGORIES as unknown as [DomainCategory, ...DomainCategory[]],
);
export const CarCatalogSchema = catalogSchemaFor(
  CAR_CATEGORIES as unknown as [DomainCategory, ...DomainCategory[]],
);
