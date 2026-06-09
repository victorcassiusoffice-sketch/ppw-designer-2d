/**
 * apply-real-images.mjs (2026-06-09) — fold the downloaded real product
 * photos into the catalog data:
 *   • src/data/products.json  → set `photo_image_url` on each matching K1
 *                               product (by slug = product id).
 *   • products-prod.json      → set `imageUrl` to the real photo path and
 *                               backfill `description` from the bundled
 *                               `notes` (matched by SKU), so the Neon DB
 *                               seed is correct for any future re-seed.
 *
 * Idempotent. Reads scripts/real-image-manifest.json. Dev tooling only.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const MANIFEST = path.resolve('scripts/real-image-manifest.json');
const BUNDLED = path.resolve('src/data/products.json');
const PROD = path.resolve('products-prod.json');

const manifest = JSON.parse(await readFile(MANIFEST, 'utf8'));
const bundled = JSON.parse(await readFile(BUNDLED, 'utf8'));
const prod = JSON.parse(await readFile(PROD, 'utf8'));

const bySlug = new Map(manifest.products.filter((p) => p.imageFile).map((p) => [p.slug, `/${p.imageFile}`]));

// Patch bundled (id === slug).
let bundledPatched = 0;
const slugToSku = new Map();
const slugToNotes = new Map();
for (const p of bundled.products) {
  slugToSku.set(p.id, p.sku);
  slugToNotes.set(p.id, p.notes);
  const img = bySlug.get(p.id);
  if (img && p.photo_image_url !== img) {
    p.photo_image_url = img;
    bundledPatched++;
  }
}

// Patch prod seed (match by SKU via the bundled slug→sku map).
const skuToImg = new Map();
const skuToNotes = new Map();
for (const [slug, img] of bySlug) {
  const sku = slugToSku.get(slug);
  if (sku) {
    skuToImg.set(sku, img);
    skuToNotes.set(sku, slugToNotes.get(slug));
  }
}
let prodPatched = 0;
for (const p of prod.products) {
  const img = skuToImg.get(p.sku);
  if (img) {
    if (p.imageUrl !== img) prodPatched++;
    p.imageUrl = img;
    if ((p.description === null || p.description === undefined || p.description === '') && skuToNotes.get(p.sku)) {
      p.description = skuToNotes.get(p.sku);
    }
  }
}

await writeFile(BUNDLED, JSON.stringify(bundled, null, 2) + '\n');
await writeFile(PROD, JSON.stringify(prod) + '\n');

console.log(`bundled products.json: ${bundledPatched} photo_image_url set`);
console.log(`products-prod.json: ${prodPatched} imageUrl set`);
console.log('photos mapped:', [...bySlug.keys()].length);
