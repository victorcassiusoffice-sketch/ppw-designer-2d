/**
 * Phase 5 — top-down product image backfill.
 *
 * Iterates `src/data/products.json`, and for every product missing a
 * `topdown_image_url` generates one with Fal.ai FLUX.1 [schnell], downloads
 * the result into `public/products/topdown/<id>.png`, and writes the
 * `/products/topdown/<id>.png` path back into the catalog. Baking to a
 * static asset (rather than storing the ephemeral Fal URL) keeps the
 * thumbnails working after the Fal-hosted URL expires.
 *
 * Dry-run by default — lists what WOULD be generated, no network, no write:
 *   npx tsx scripts/backfill-topdown-images.ts
 *
 * Apply (needs the Fal key — server side only, NEVER echoed):
 *   APPLY=1 FAL_KEY=*** npx tsx scripts/backfill-topdown-images.ts
 *
 * Options:
 *   LIMIT=5   cap how many are generated this run (default 5 — free-tier safe)
 *   ENDPOINT  override the Fal endpoint (e.g. a self-hosted proxy)
 *
 * Vic Protocol: free tier only, no paid flags; the key is read from env
 * and never logged. Rate-limited to 5/min by generateTopDownImage.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { generateTopDownImage, FAL_FLUX_SCHNELL_ENDPOINT } from '../src/lib/generateTopDownImage';
import type { Product, ProductCatalog } from '../src/data/products.schema';

const CATALOG_PATH = resolve(process.cwd(), 'src/data/products.json');
const PUBLIC_DIR = resolve(process.cwd(), 'public/products/topdown');

async function main(): Promise<void> {
  const apply = process.env.APPLY === '1';
  const limit = Number(process.env.LIMIT ?? '5');
  const apiKey = process.env.FAL_KEY;
  const endpoint = process.env.ENDPOINT ?? FAL_FLUX_SCHNELL_ENDPOINT;

  const catalog = JSON.parse(readFileSync(CATALOG_PATH, 'utf8')) as ProductCatalog;
  const missing = catalog.products.filter((p) => !p.topdown_image_url);

  console.log(`Catalog: ${catalog.products.length} products, ${missing.length} missing a top-down image.`);

  if (missing.length === 0) {
    console.log('Nothing to do.');
    return;
  }

  if (!apply) {
    console.log('\nDRY RUN (set APPLY=1 FAL_KEY=*** to generate):');
    for (const p of missing.slice(0, limit)) {
      console.log(`  • ${p.id}  (${p.category})  — ${p.name}`);
    }
    if (missing.length > limit) console.log(`  …and ${missing.length - limit} more (raise LIMIT).`);
    return;
  }

  if (!apiKey) {
    console.error('APPLY=1 requires FAL_KEY in the environment. Aborting (no key, no call).');
    process.exit(1);
  }

  mkdirSync(PUBLIC_DIR, { recursive: true });
  let done = 0;
  for (const p of missing.slice(0, limit)) {
    process.stdout.write(`Generating top-down for ${p.id}… `);
    const url = await generateTopDownImage(p, { apiKey, endpoint });
    // generateTopDownImage falls back to the original image on any error;
    // if it didn't actually produce a new asset, skip writing.
    if (!url || url === p.image_url) {
      console.log('skipped (generation failed / fell back).');
      continue;
    }
    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.log(`download HTTP ${res.status} — skipped.`);
        continue;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      const fileRel = `/products/topdown/${p.id}.png`;
      writeFileSync(resolve(PUBLIC_DIR, `${p.id}.png`), buf);
      patchCatalogTopdown(catalog, p.id, fileRel);
      done += 1;
      console.log('ok →', fileRel);
    } catch (err) {
      console.log('error:', err instanceof Error ? err.message : String(err));
    }
  }

  if (done > 0) {
    writeFileSync(CATALOG_PATH, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
    console.log(`\nWrote ${done} topdown_image_url paths into ${CATALOG_PATH}.`);
  } else {
    console.log('\nNo assets generated — catalog unchanged.');
  }
}

function patchCatalogTopdown(catalog: ProductCatalog, id: string, url: string): void {
  const target = catalog.products.find((p: Product) => p.id === id);
  if (target) target.topdown_image_url = url;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
