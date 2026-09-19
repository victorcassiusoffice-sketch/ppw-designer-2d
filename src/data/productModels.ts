/**
 * productModels — which 3D body a product wears in 3D Mode (2026-09-17).
 *
 * Two sources, in order: the product's own `mesh_url` (catalog column that
 * was waiting since Tweak 06), else this manifest, keyed by product id. The
 * manifest is written by `scripts/gen-3d-models.mjs` (Fal image-to-3D,
 * Vic-money-gated) and by hand for the CC0 bodies. Every body is fitted to
 * the catalog's `dimensions_cm` exactly by `designer/fitToSize.ts`, so an
 * entry only needs to say WHERE the model is and, when the generator's
 * output is not the glTF default, which way it faces.
 */
import manifestJson from './productModels.json';
import catalogJson from './products.json';
import type { Product } from './products.schema';

export interface ProductModelEntry {
  /** Served path (public/) or absolute URL to a .glb / .gltf. */
  url: string;
  /** Which way the model's front faces in its own frame. glTF default: +z. */
  modelFront?: '+z' | '-z' | '+x' | '-x';
  /** Which model axis runs along the product's LENGTH. 'auto' = by aspect. */
  lengthAxis?: 'x' | 'z' | 'auto';
  /** Which model axis points up: '+y' (glTF default) or, for a flat product built from a photo as an upright slab, the photo face ('-z' for Hunyuan3D). */
  modelUp?: '+y' | '+z' | '-z';
  /** Where it came from (provenance; never rendered). */
  source?: Record<string, unknown>;
  /** Licence note for bundled third-party bodies (e.g. "CC0 — Kenney Furniture Kit"). */
  licence?: string;
}

const manifest: Record<string, ProductModelEntry> = manifestJson as Record<string, ProductModelEntry>;

/**
 * The manifest is keyed by SEED ids, but on the deployed designer the K1
 * range arrives from the catalog API and is namespaced `m-<apiId>`
 * (apiCatalogAdapter), with the seed twin hidden by SKU (mergeCatalog). A
 * body belongs to the PRODUCT, not to the row that happened to deliver it —
 * so the second key is the SKU (Vic 2026-09-17: "the 2d models when going
 * into the 3d mode just come up as a box" — every K1 machine on production).
 */
const seedIdBySku = new Map<string, string>(
  ((catalogJson as unknown as { products: Array<{ id: string; sku: string }> }).products ?? []).map((p) => [p.sku, p.id]),
);

/** The body for a product, or undefined → the shaded box. */
export function productModelFor(p: Pick<Product, 'id' | 'mesh_url'> & { sku?: string }): ProductModelEntry | undefined {
  if (p.mesh_url) return { url: p.mesh_url, modelFront: '+z', lengthAxis: 'auto' };
  const byId = manifest[p.id];
  if (byId) return byId;
  if (!p.sku) return undefined;
  const seedId = seedIdBySku.get(p.sku);
  return seedId ? manifest[seedId] : undefined;
}

/** Ids that have a body — for reports and tests. */
export function productIdsWithModels(): string[] {
  return Object.keys(manifest);
}
