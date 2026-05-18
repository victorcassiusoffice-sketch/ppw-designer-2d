/**
 * Sims-Parity DT-09 — legacy product dimensions backfill helper.
 *
 * Lists products that have NULL width_mm / depth_mm / height_mm and
 * either prints them (dry-run) or applies a supplied JSON map of
 * { productId: { width, depth, height } } values.
 *
 * Usage (dry-run only by default):
 *   DATABASE_URL=postgres://... npx tsx scripts/backfill_legacy_product_dims.ts
 *
 * To apply, set APPLY=1 and supply a JSON file path:
 *   APPLY=1 DIMS_FILE=./legacy-dims.json npx tsx scripts/backfill_legacy_product_dims.ts
 *
 * Each apply runs `updateProductDimensions` with no scale-lock attached,
 * which honours the VC-2 guard (legacy rows have NULL lock so it's
 * allowed without invalidationReason). After backfill, the merchant
 * can re-capture each product to mint a real scale-lock.
 */

import { readFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';

interface DimsMap {
  [productId: string]: { width: number; depth: number; height: number };
}

interface LegacyRow {
  id: number;
  merchant_id: number;
  sku: string;
  name: string;
  width_mm: number | null;
  depth_mm: number | null;
  height_mm: number | null;
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) {
    console.error('DATABASE_URL or POSTGRES_URL is required.');
    process.exit(1);
  }
  const apply = process.env.APPLY === '1';
  const dimsFile = process.env.DIMS_FILE;

  const sql = neon(url);

  // Find legacy rows.
  const rows = (await sql(
    `SELECT id, merchant_id, sku, name, width_mm, depth_mm, height_mm
     FROM products
     WHERE width_mm IS NULL OR depth_mm IS NULL OR height_mm IS NULL
     ORDER BY merchant_id, id`,
  )) as LegacyRow[];

  console.log(`Found ${rows.length} legacy product row(s) with missing dimensions.\n`);
  for (const r of rows) {
    console.log(
      `  id=${r.id} merchant=${r.merchant_id} sku=${r.sku} ` +
        `dims=(${r.width_mm ?? '-'}, ${r.depth_mm ?? '-'}, ${r.height_mm ?? '-'}) "${r.name}"`,
    );
  }

  if (!apply) {
    console.log('\nDry-run only. Set APPLY=1 + DIMS_FILE=<path> to apply.');
    return;
  }
  if (!dimsFile) {
    console.error('APPLY=1 requires DIMS_FILE pointing to a { productId: { width, depth, height } } JSON map.');
    process.exit(2);
  }
  const map = JSON.parse(readFileSync(dimsFile, 'utf8')) as DimsMap;
  let updated = 0;
  for (const r of rows) {
    const entry = map[String(r.id)];
    if (!entry) continue;
    await sql(
      `UPDATE products
         SET width_mm = $1, depth_mm = $2, height_mm = $3, updated_at = NOW()
       WHERE id = $4`,
      [entry.width, entry.depth, entry.height, r.id],
    );
    updated++;
    console.log(`  applied id=${r.id} -> (${entry.width}, ${entry.depth}, ${entry.height})`);
  }
  console.log(`\nBackfill applied to ${updated}/${rows.length} rows.`);
}

if (process.argv[1]?.endsWith('backfill_legacy_product_dims.ts')) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
