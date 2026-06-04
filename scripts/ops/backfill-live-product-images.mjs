/**
 * P0-2 — backfill REAL top-down imagery + descriptions onto the LIVE products.
 *
 * The live `/api/products` rows (Neon `products` table) shipped with
 * `placehold.co` images and NULL descriptions. The bundled seed catalog
 * (`src/data/products.json`) already carries, per K1 SKU, a real committed
 * top-down PNG (`public/products/topdown/<id>.png`) + a real description in
 * `notes`. This script joins live⇄seed on EXACT SKU and UPDATEs the matching
 * live rows so the catalog stops reading as unfinished.
 *
 * SAFETY:
 *   • Join is SKU-EXACT (not fuzzy) → the image always belongs to that product.
 *   • Only UPDATEs `image_url` / `description`. No schema change, no delete.
 *   • Only touches rows whose current image is a placeholder (idempotent).
 *   • DRY-RUN by default. Prints the exact plan. APPLY=1 to execute.
 *
 * Neon single-branch caveat (api-deploy-topology.md): this writes PROD data.
 * The write is non-destructive (placeholder → real asset). Reversible.
 *
 * Usage:
 *   node scripts/ops/backfill-live-product-images.mjs            # dry-run
 *   APPLY=1 node scripts/ops/backfill-live-product-images.mjs    # execute
 *
 * Connection string resolves the same way as api/db/client.ts:
 *   DATABASE_URL || POSTGRES_URL || POSTGRES_DATABASE_URL || POSTGRES_URL_NON_POOLING
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { neon } from '@neondatabase/serverless';

const CONN =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_DATABASE_URL ||
  process.env.POSTGRES_URL_NON_POOLING;

if (!CONN) {
  console.error('No connection string in env (DATABASE_URL / POSTGRES_URL / …). Aborting.');
  process.exit(1);
}

const apply = process.env.APPLY === '1';
const PLACEHOLDER_RE = /placehold\.co/i;

function loadSeedBySku() {
  const catalog = JSON.parse(
    readFileSync(resolve(process.cwd(), 'src/data/products.json'), 'utf8'),
  );
  const bySku = new Map();
  for (const p of catalog.products) {
    if (!p.sku) continue;
    bySku.set(p.sku.toUpperCase(), {
      topdown: p.topdown_image_url || null,
      notes: (p.notes || '').trim() || null,
      name: p.name,
    });
  }
  return bySku;
}

async function main() {
  const sql = neon(CONN);
  const seed = loadSeedBySku();

  const rows = await sql`
    SELECT id, sku, name, image_url, description
    FROM products
    ORDER BY id
  `;

  const plan = [];
  const skipped = [];
  for (const r of rows) {
    const match = seed.get(String(r.sku || '').toUpperCase());
    const hasPlaceholder = !r.image_url || PLACEHOLDER_RE.test(r.image_url);
    const needsDesc = !r.description || r.description.trim() === '';
    if (!match || !match.topdown) {
      skipped.push({ id: r.id, sku: r.sku, why: 'no seed/topdown match' });
      continue;
    }
    const newImg = hasPlaceholder ? match.topdown : r.image_url;
    const newDesc = needsDesc ? match.notes : r.description;
    if (newImg === r.image_url && newDesc === r.description) {
      skipped.push({ id: r.id, sku: r.sku, why: 'already real' });
      continue;
    }
    plan.push({ id: r.id, sku: r.sku, name: r.name, newImg, newDesc });
  }

  console.log(`Live products: ${rows.length}. To update: ${plan.length}. Skipped: ${skipped.length}.\n`);
  for (const p of plan) {
    console.log(`  #${p.id} ${p.sku.padEnd(18)} → ${p.newImg}${p.newDesc ? '  + description' : ''}`);
  }
  if (skipped.length) {
    console.log('\nSkipped:');
    for (const s of skipped) console.log(`  #${s.id} ${String(s.sku).padEnd(18)} (${s.why})`);
  }

  if (!apply) {
    console.log('\nDRY RUN — set APPLY=1 to write. No DB changes made.');
    return;
  }

  let n = 0;
  for (const p of plan) {
    await sql`
      UPDATE products
      SET image_url = ${p.newImg},
          description = ${p.newDesc},
          updated_at = now()
      WHERE id = ${p.id}
    `;
    n += 1;
  }
  console.log(`\nApplied ${n} updates to live products.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
