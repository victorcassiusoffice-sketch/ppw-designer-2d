/**
 * Sims-Parity DT-01 — canonical Product Zod schema.
 *
 * The on-wire / agent-intent contract spanning all three pipelines:
 *   • Konva Layer 1 render (DT-11) — reads dimensions_mm.{width,depth},
 *     photo_front_url, photo_alpha_clean, capture_scale_lock_id.
 *   • Babylon Layer 2 render (DT-22, DT-25) — reads dimensions_mm.height
 *     in addition, plus optional use_gltf for hero meshes.
 *   • Capture pipeline (DT-08, DT-09) — writes photo_*_url + dimensions_mm
 *     + photo_alpha_clean + capture_scale_lock_id via add_product intent.
 *
 * This is the CONTRACT schema (string-UUID ids, snake_case keys) per
 * `MASTER-BUILD-PLAN.md` §1. It runs in parallel with the existing
 * Drizzle row shape (BIGINT ids, camelCase fields in `api/db/schema.ts`).
 * Adapter functions for row↔contract translation live in future DTs
 * (DT-09 add_product intent + catalog feed serialiser).
 *
 * The existing seed-catalog TypeScript interface at `src/data/products.schema.ts`
 * is a SEPARATE concern — it ships the bundled fixture catalog for Konva
 * Phase 0 work and does not collide with this canonical Zod schema.
 */

import { z } from 'zod';
import { DimensionsMmSchema } from '../capture/types';

export const PRODUCT_CATEGORIES = [
  'seating',
  'tables',
  'beds',
  'lighting',
  'storage',
  'decor',
  'plants',
  'sauna',
  'massage',
  'other',
] as const;
export type ProductCategoryV4 = (typeof PRODUCT_CATEGORIES)[number];

export const ProductVariantSchema = z.object({
  color: z.string(),
  color_label: z.string(),
  photo_url: z.string().url().optional(),
});
export type ProductVariant = z.infer<typeof ProductVariantSchema>;

export const ProductSchema = z.object({
  id: z.string().uuid(),
  merchant_id: z.string().uuid(),
  slug: z.string(),
  name: z.string().min(2).max(120),
  description: z.string().max(2000),
  price_mur: z.number().int().positive(),
  category: z.enum(PRODUCT_CATEGORIES),

  // === Capture-derived contract (REQUIRED on add_product after CAP.08 / DT-09) ===
  photo_front_url: z.string().url(),
  photo_side_url: z.string().url().optional(),
  photo_back_url: z.string().url().optional(),
  dimensions_mm: DimensionsMmSchema,
  // DT-01 additions:
  photo_alpha_clean: z.boolean().default(false),
  capture_scale_lock_id: z.string().uuid().optional(),

  // === Variants (DT-14 GL1.08 swatch row) ===
  variants: z.array(ProductVariantSchema).default([]),

  // === Lifecycle ===
  retired_at: z.string().datetime().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type Product = z.infer<typeof ProductSchema>;
