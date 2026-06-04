/**
 * P0-2 — seed-imagery enrichment for the live products API.
 *
 * The live `products` rows (Neon) shipped with `placehold.co` images and
 * NULL descriptions. The bundled seed catalog (`src/data/products.json`)
 * carries, per K1 SKU, a real committed top-down PNG
 * (`public/products/topdown/<id>.png`, deployed as a static asset) and a
 * real description in `notes`.
 *
 * Rather than mutate the prod DB (Neon single-branch — no prod/preview
 * isolation), we enrich the API RESPONSE: when a row's image is a
 * placeholder and the bundled seed has a matching SKU with a top-down
 * asset, substitute the real asset + description. Deterministic SKU-exact
 * join, self-healing, reversible (it's code). If the DB is later backfilled
 * with real imagery, the placeholder test fails and the DB value wins.
 *
 * Tests: `api/__tests__/seedImagery.test.ts`.
 */

const PLACEHOLDER_RE = /placehold\.co/i;

export interface SeedImageryEntry {
  topdown: string | null;
  description: string | null;
}

export interface SeedProductLike {
  sku?: string | null;
  topdown_image_url?: string | null;
  notes?: string | null;
}

/** Build a SKU(upper) → {topdown, description} lookup from the seed catalog. */
export function buildSeedImageryMap(seedProducts: SeedProductLike[]): Map<string, SeedImageryEntry> {
  const map = new Map<string, SeedImageryEntry>();
  for (const p of seedProducts) {
    if (!p.sku) continue;
    const topdown = p.topdown_image_url?.trim() || null;
    const description = p.notes?.trim() || null;
    if (!topdown && !description) continue;
    map.set(p.sku.toUpperCase(), { topdown, description });
  }
  return map;
}

/** True when a row's image is absent or a placehold.co placeholder. */
export function isPlaceholderImage(imageUrl: string | null | undefined): boolean {
  return !imageUrl || PLACEHOLDER_RE.test(imageUrl);
}

export interface EnrichableRow {
  sku: string | null;
  imageUrl: string | null;
  description: string | null;
}

/**
 * Return a new array where rows with placeholder images / null descriptions
 * are enriched from the seed map on exact SKU match. Non-matching rows and
 * rows that already carry real data are returned unchanged.
 */
export function enrichImagery<T extends EnrichableRow>(
  rows: T[],
  map: Map<string, SeedImageryEntry>,
): T[] {
  return rows.map((row) => {
    const entry = map.get(String(row.sku ?? '').toUpperCase());
    if (!entry) return row;
    const imageUrl =
      isPlaceholderImage(row.imageUrl) && entry.topdown ? entry.topdown : row.imageUrl;
    const description =
      (!row.description || row.description.trim() === '') && entry.description
        ? entry.description
        : row.description;
    if (imageUrl === row.imageUrl && description === row.description) return row;
    return { ...row, imageUrl, description };
  });
}
