/** Raster derivatives of the existing repository-owned PPW favicon, with an opaque maskable canvas. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import sharp from 'sharp';

const root = resolve(import.meta.dirname, '..');
const original = readFileSync(resolve(root, 'public/ppw-favicon.svg'));
const target = resolve(root, 'public/brand/ppw');
const check = process.argv.includes('--check');
if (!check) mkdirSync(target, { recursive: true });
const outputs = [];
for (const edge of [192, 512]) {
  const file = resolve(target, `icon-${edge}.png`);
  const bytes = await sharp(original, { density: edge * 72 / 64 }).resize(edge, edge).flatten({ background: '#0F766E' }).png().toBuffer();
  if (check) {
    if (!bytes.equals(readFileSync(file))) throw new Error(`Stale icon: ${file}`);
  } else writeFileSync(file, bytes);
  outputs.push({ edge, bytes: bytes.length });
}
console.log(JSON.stringify({ source: 'public/ppw-favicon.svg', sourceSha256: createHash('sha256').update(original).digest('hex'), sharp: sharp.versions.sharp, outputs }));
