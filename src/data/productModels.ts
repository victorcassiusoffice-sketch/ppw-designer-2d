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
import candidatesJson from './productModelCandidates.json';
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
  /** Reviewed supplier import takes precedence over a procedural utility preview. */
  preferMesh?: boolean;
  /**
   * A lighter copy for phones (about 5,000 triangles, 512 px textures), written by the product
   * engine (2026-11). `productModelFor` serves it on a phone-class screen; absent → the one body.
   */
  phoneUrl?: string;
}

const manifest: Record<string, ProductModelEntry> = manifestJson as Record<string, ProductModelEntry>;

/**
 * Test candidates (product engine, 2026-11): one body per tool, keyed tool → product id, kept
 * only while Victor compares them. `?bodies=<tool>` on any designer URL shows that tool's bodies
 * instead of the catalogue's. Empty in normal times.
 */
const candidates = candidatesJson as Record<string, Record<string, ProductModelEntry>>;

function candidateVariant(): string | null {
  if (typeof window === 'undefined' || !window.location) return null;
  try {
    const wanted = new URLSearchParams(window.location.search).get('bodies');
    return wanted && candidates[wanted] ? wanted : null;
  } catch {
    return null;
  }
}

/** A phone-class screen: narrow and touch-first. The phone copy exists for exactly this. */
export function wantsPhoneBody(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  try {
    return window.matchMedia('(max-width: 760px) and (pointer: coarse)').matches;
  } catch {
    return false;
  }
}

/** The body to fetch for an entry on this device: the phone copy when there is one and the screen is a phone. */
export function bodyUrlFor(entry: ProductModelEntry, phone: boolean = wantsPhoneBody()): string {
  return phone && entry.phoneUrl ? entry.phoneUrl : entry.url;
}

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
for (const [id, entry] of Object.entries(manifest)) {
  if (typeof entry.source?.sku === 'string') seedIdBySku.set(entry.source.sku, id);
}

/** The body for a product, or undefined → the shaded box. */
export function productModelFor(p: Pick<Product, 'id' | 'mesh_url'> & { sku?: string }): ProductModelEntry | undefined {
  if (p.mesh_url) return { url: p.mesh_url, modelFront: '+z', lengthAxis: 'auto', preferMesh: true };
  const variant = candidateVariant();
  const table = variant ? candidates[variant] : null;
  const seedId = p.sku ? seedIdBySku.get(p.sku) : undefined;
  if (table) {
    const candidate = table[p.id] ?? (seedId ? table[seedId] : undefined);
    if (candidate) return candidate;
  }
  const byId = manifest[p.id];
  if (byId) return byId;
  return seedId ? manifest[seedId] : undefined;
}

/** Ids that have a body — for reports and tests. */
export function productIdsWithModels(): string[] {
  return Object.keys(manifest);
}
