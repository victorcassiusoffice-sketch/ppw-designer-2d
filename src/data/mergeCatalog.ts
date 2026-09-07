/**
 * The one catalog blend every product surface renders.
 *
 * Live `/api/products` rows FIRST (the adapter already enriches them by SKU
 * with the real photo + description), then the bundled seed, deduplicated by
 * SKU. The 14 K1 fitness SKUs exist in BOTH sources; without the dedupe the
 * phone strip showed every one of them twice (verify pass 2026-09-07 — the
 * desktop dock and the old palette deduped, SimsBottomToolbar did not).
 * Bundled-only products (flooring, the demo ranges, Emcar) have no API twin
 * and pass straight through, in seed order.
 *
 * Consequence worth knowing for tests: on a DEPLOYED build a K1 product
 * renders under its merchant id (`m-6`…), not the bundled `k1-*` id, because
 * the API row wins the dedupe. Locate cards by name when the build may have
 * an API (`tests/e2e/multiroom-helpers.dockCard`).
 */
import type { Product } from './products.schema';
import { getAllProducts } from './products';

export function mergeCatalog(
  apiProducts: readonly Product[],
  bundled: readonly Product[] = getAllProducts(),
): Product[] {
  const seen = new Set<string>();
  const out: Product[] = [];
  for (const p of [...apiProducts, ...bundled]) {
    const key = p.sku || p.id;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}
