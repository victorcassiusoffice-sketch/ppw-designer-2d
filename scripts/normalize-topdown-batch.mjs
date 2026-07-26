/**
 * Footprint-exact normaliser for OpenArt top-down renders (out-of-band batch).
 *
 * The OpenArt (Nano Banana Pro) image2image render is a plain-background
 * top-down of the real product. This script turns it into the catalog asset
 * the designer canvas needs: a transparent PNG whose pixel dimensions ARE the
 * product's real footprint at PX_PER_CM, so placement is to-scale on the
 * 0.5 m grid regardless of what the model returned (WD-2D findings §5).
 *
 * Pipeline per image: flood-key the border-connected white background to
 * transparent → trim to the silhouette bbox → resize that bbox to the exact
 * footprint canvas (widthCm × depthCm × PX_PER_CM).
 *
 * ⚠ AXIS CONVENTION (2026-07-26 fix — this was getting items drawn stretched
 * sideways). The Konva canvas draws a placed item at rotation 0 as
 * LENGTH along X (screen width) and WIDTH along Y (screen depth):
 *   RoomCanvas.tsx:1415  unrotatedWPx = dimensions_cm.LENGTH * pxPerMetre
 *   RoomCanvas.tsx:1416  unrotatedHPx = dimensions_cm.WIDTH  * pxPerMetre
 *   geometry.ts rotatedFootprint() → { w: lengthM, h: widthM } at 0°/180°
 * So a catalog top-down MUST be LANDSCAPE: the product's LENGTH runs left↔right.
 * Therefore the output canvas is (length × width), NOT (width × length) —
 * pass `lengthCm` + `widthCm` and let this script map them to X/Y.
 * If the source render is portrait (product running top↔bottom), set
 * `rotateDeg: 90` so it is turned to lie lengthwise before normalising.
 *
 * Usage:
 *   node scripts/normalize-topdown-batch.mjs <manifest.json>
 * Manifest: [{ "src": "<raw.png>", "out": "<dest.png>",
 *              "lengthCm": 205, "widthCm": 95, "rotateDeg": 90 }]
 *
 * Pure local raster work — no network, no API keys, no spend.
 */
import { readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const PX_PER_CM = 10;

/**
 * Border-connected near-white flood fill → alpha 0. Only clears background
 * reachable from the frame edge, so white PARTS of the product survive.
 */
function floodFillBackground(data, width, height, whiteThreshold = 235) {
  const isBg = (idx) => {
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    const min = Math.min(r, g, b);
    const max = Math.max(r, g, b);
    return min >= whiteThreshold && max - min <= 12;
  };
  const visited = new Uint8Array(width * height);
  const stack = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const p = y * width + x;
    if (visited[p]) return;
    if (!isBg(p * 4)) return;
    visited[p] = 1;
    stack.push(p);
  };
  for (let x = 0; x < width; x++) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    push(0, y);
    push(width - 1, y);
  }
  while (stack.length) {
    const p = stack.pop();
    data[p * 4 + 3] = 0;
    const x = p % width;
    const y = (p / width) | 0;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }
}

async function normalize({ src, out, lengthCm, widthCm, rotateDeg = 0 }) {
  if (!Number.isFinite(lengthCm) || !Number.isFinite(widthCm)) {
    throw new Error('lengthCm + widthCm are required (canvas maps length→X, width→Y)');
  }
  const input = await readFile(src);
  // Rotate FIRST (on the opaque source) so a portrait render is laid down
  // lengthwise before the background key + trim run.
  const oriented = rotateDeg ? await sharp(input).rotate(rotateDeg, { background: '#ffffff' }).png().toBuffer() : input;
  const { data, info } = await sharp(oriented).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  floodFillBackground(data, info.width, info.height);
  const keyed = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toBuffer();

  // Canvas convention: X = LENGTH, Y = WIDTH (see header).
  const wPx = Math.max(1, Math.round(lengthCm * PX_PER_CM));
  const hPx = Math.max(1, Math.round(widthCm * PX_PER_CM));

  const buffer = await sharp(keyed)
    .ensureAlpha()
    .trim({ threshold: 10 })
    .resize(wPx, hPx, { fit: 'fill', kernel: 'lanczos3' })
    .png({ compressionLevel: 9 })
    .toBuffer();

  await writeFile(out, buffer);
  const meta = await sharp(buffer).metadata();
  return { out, wPx, hPx, actual: `${meta.width}x${meta.height}`, bytes: buffer.length };
}

const manifestPath = process.argv[2];
if (!manifestPath) {
  console.error('usage: node scripts/normalize-topdown-batch.mjs <manifest.json>');
  process.exit(1);
}
const jobs = JSON.parse(await readFile(manifestPath, 'utf8'));
let ok = 0;
for (const job of jobs) {
  try {
    const r = await normalize(job);
    console.log(
      `✓ ${r.out}  ${r.actual}px  (L${job.lengthCm}×W${job.widthCm}cm, rot ${job.rotateDeg ?? 0}°)  ${(r.bytes / 1024).toFixed(0)}kB`,
    );
    ok++;
  } catch (err) {
    console.error(`✗ ${job.src}: ${err instanceof Error ? err.message : err}`);
  }
}
console.log(`\n${ok}/${jobs.length} normalised.`);
