/**
 * alpha-pass-topdown.mjs — one-time / idempotent asset-processing script.
 *
 * Problem: the 22 baked top-down product PNGs in public/products/topdown/
 * were generated via Fal.ai FLUX with solid (white) backgrounds, so they
 * render as an ugly opaque square behind the product on the Konva canvas.
 *
 * Fix: run a local, free background-removal (alpha) pass over each PNG so
 * the background becomes transparent, then write the RGBA PNG back in place.
 *
 * Constraints honoured:
 *   - devDependency only (@imgly/background-removal-node). NOT imported at
 *     runtime — the app never loads this; this is a dev/asset script.
 *   - Local model only. No network paid API. No spend.
 *   - Idempotent: a PNG that already has an alpha channel (colorType 4/6)
 *     AND at least one fully/partly transparent pixel is skipped.
 *   - Safe: each source is backed up to <name>.png.bak before overwrite,
 *     so the pass is reversible. .bak files are gitignored / not committed.
 *
 * Run:  node scripts/alpha-pass-topdown.mjs
 *       node scripts/alpha-pass-topdown.mjs --force   (reprocess all)
 */
import { readFile, writeFile, readdir, copyFile, access } from 'node:fs/promises';
import { constants as FS } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { removeBackground } from '@imgly/background-removal-node';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.resolve(__dirname, '..', 'public', 'products', 'topdown');
const FORCE = process.argv.includes('--force');

/** Read PNG IHDR colour type (byte 25). 4 = gray+alpha, 6 = RGBA, 3 = palette. */
function pngColorType(buf) {
  // PNG signature (8) + IHDR length (4) + "IHDR" (4) → width/height → colorType at offset 25.
  if (buf.length < 26 || buf[0] !== 0x89 || buf[1] !== 0x50) return -1;
  return buf[25];
}

/** True if the PNG contains a tRNS chunk (palette / colour-key transparency). */
function hasTrnsChunk(buf) {
  let off = 8; // skip signature
  while (off + 12 <= buf.length) {
    const len = buf.readUInt32BE(off);
    const tag = buf.toString('ascii', off + 4, off + 8);
    if (tag === 'tRNS') return true;
    if (tag === 'IEND') break;
    off += 12 + len;
  }
  return false;
}

/**
 * Decide whether a PNG already carries usable transparency. imgly may emit
 * either a true alpha channel (colorType 4/6) OR an indexed/palette PNG
 * (colorType 3) with a tRNS chunk — both are real transparency that the
 * browser + Konva honour. We treat any of these as "already done" so the
 * pass is idempotent; --force reprocesses regardless.
 */
function hasAlpha(buf) {
  const ct = pngColorType(buf);
  if (ct === 4 || ct === 6) return true;
  if (ct === 3 && hasTrnsChunk(buf)) return true;
  return false;
}

async function main() {
  const entries = (await readdir(DIR)).filter((f) => f.toLowerCase().endsWith('.png'));
  if (entries.length === 0) {
    console.error(`No PNGs found in ${DIR}`);
    process.exit(1);
  }

  let processed = 0;
  let skipped = 0;
  let failed = 0;

  console.log(`Alpha pass over ${entries.length} PNG(s) in ${DIR}${FORCE ? ' (--force)' : ''}\n`);

  for (const name of entries) {
    const file = path.join(DIR, name);
    const before = await readFile(file);
    const beforeCt = pngColorType(before);

    if (!FORCE && hasAlpha(before)) {
      console.log(`  skip   ${name}  (already has alpha, colorType=${beforeCt}, ${before.length}b)`);
      skipped += 1;
      continue;
    }

    try {
      // Back up the original once (don't clobber an existing .bak).
      const bak = `${file}.bak`;
      try {
        await access(bak, FS.F_OK);
      } catch {
        await copyFile(file, bak);
      }

      // removeBackground accepts a file:// URL or Blob; returns a PNG Blob
      // with alpha. A bare Windows path (C:\...) is misread as a "c:"
      // protocol, so always pass a file:// URL.
      const blob = await removeBackground(pathToFileURL(file).href);
      const out = Buffer.from(await blob.arrayBuffer());
      const afterCt = pngColorType(out);

      if (!hasAlpha(out)) {
        throw new Error(`output PNG colorType=${afterCt} carries no transparency (no alpha channel, no tRNS)`);
      }

      await writeFile(file, out);
      console.log(
        `  done   ${name}  colorType ${beforeCt} -> ${afterCt}  ${before.length}b -> ${out.length}b`,
      );
      processed += 1;
    } catch (err) {
      console.error(`  FAIL   ${name}  ${err?.message ?? err}`);
      failed += 1;
    }
  }

  console.log(`\nprocessed=${processed} skipped=${skipped} failed=${failed} total=${entries.length}`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
