/** Reproducible local screenshot derivatives; keeps the original capture unchanged. */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import sharp from 'sharp';

const root = resolve(import.meta.dirname, '..');
const source = resolve(root, 'public/showcase/plumbing-workspace.jpg');
const original = readFileSync(source);
const metadata = await sharp(original).metadata();
if (metadata.width !== 1280 || metadata.height !== 720) throw new Error('Original capture dimensions changed');
sharp.concurrency(1);
const outputs = [];
for (const width of [384, 672, 960]) {
  const file = `public/showcase/plumbing-workspace-${width}.webp`;
  const data = await sharp(original).resize({ width, withoutEnlargement: true }).webp({ quality: 86, effort: 6 }).toBuffer();
  if (process.argv.includes('--check')) {
    if (!data.equals(readFileSync(resolve(root, file)))) throw new Error(`Stale derivative: ${file}`);
  } else {
    writeFileSync(resolve(root, file), data);
  }
  outputs.push({ file, width, bytes: data.length });
}
console.log(JSON.stringify({ sourceSha256: createHash('sha256').update(original).digest('hex'), sourceBytes: original.length, sharp: sharp.versions.sharp, webp: sharp.versions.webp, outputs }));
