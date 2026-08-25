/**
 * Slot a generated top-down render into the catalog (2026-08-24).
 *
 * Companion to the aspect fix in `src/designer/imageFit.ts`: the canvas
 * now contain-fits art, so this script NEVER grossly distorts the model's
 * output the way a blind `fit:'fill'` did (that force-stretch was half of
 * the "art looks stretched" complaint — see docs/TOPDOWN-IMAGE-WORKFLOW-
 * 2026-08-24.md).
 *
 * Per image: flood-key the border-connected white/near-white background to
 * transparent → trim to the product silhouette → compare the silhouette
 * aspect with the product's REAL length:width →
 *   • within CONFORM_TOLERANCE (5%): conform exactly to the footprint
 *     canvas (length×width at PX_PER_CM) — minor model error absorbed;
 *   • beyond it: PAD to the footprint canvas (art keeps its true aspect,
 *     centred on transparency) and WARN — regenerate for a better match.
 * Then write public/products/topdown/<id>.png and update products.json
 * (topdown_image_url + front_edge).
 *
 * Usage:
 *   node scripts/slot-topdown.mjs --product <id> --file <render.png|jpg>
 *        [--front-edge bottom|top|left|right] [--rotate 90] [--dry-run]
 *
 * Pure local raster work — no network, no API keys, no spend.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import sharp from 'sharp';

const PX_PER_CM = 10;
const CONFORM_TOLERANCE = 0.05;

function parseArgs(argv) {
  const out = { frontEdge: 'bottom', rotate: 0, dryRun: false, whiteThreshold: 235 };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--product') out.product = argv[++i];
    else if (a === '--file') out.file = argv[++i];
    else if (a === '--front-edge') out.frontEdge = argv[++i];
    else if (a === '--rotate') out.rotate = Number(argv[++i]);
    else if (a === '--dry-run') out.dryRun = true;
    // Batch fix (2026-08-25): AI renders often sit on a NEAR-white studio
    // slab with soft gradients (RGB ~215-247) that the default 235 key
    // can't flood through — the canvas then shows an opaque white plate
    // around the product. Lower for those renders, e.g. 215.
    else if (a === '--white-threshold') out.whiteThreshold = Number(argv[++i]);
    // For UNIFORM texture swatches (flooring rolls/mats) stretching is
    // invisible — force the exact footprint fill even beyond the 5%
    // tolerance instead of padding with transparent bars.
    else if (a === '--force-conform') out.forceConform = true;
    else throw new Error(`Unknown arg: ${a}`);
  }
  if (!out.product || !out.file) {
    throw new Error('Required: --product <id> --file <image>');
  }
  if (!['bottom', 'top', 'left', 'right'].includes(out.frontEdge)) {
    throw new Error(`Bad --front-edge: ${out.frontEdge}`);
  }
  return out;
}

/** Border-connected near-white flood fill → alpha 0 (same key as
 * scripts/normalize-topdown-batch.mjs — white PARTS of the product survive). */
function floodFillBackground(data, width, height, whiteThreshold = 235) {
  const isBg = (idx) => {
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    const min = Math.min(r, g, b);
    const max = Math.max(r, g, b);
    // Grey-tolerance scales with the threshold: a lowered threshold is
    // asking to punch through soft studio shadows, which are grey-ish.
    return min >= whiteThreshold && max - min <= (whiteThreshold < 235 ? 20 : 12);
  };
  const visited = new Uint8Array(width * height);
  const queue = [];
  const push = (x, y) => {
    const p = y * width + x;
    if (visited[p]) return;
    visited[p] = 1;
    const idx = p * 4;
    if (isBg(idx)) {
      data[idx + 3] = 0;
      queue.push(p);
    }
  };
  for (let x = 0; x < width; x++) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    push(0, y);
    push(width - 1, y);
  }
  while (queue.length) {
    const p = queue.pop();
    const x = p % width;
    const y = (p / width) | 0;
    if (x > 0) push(x - 1, y);
    if (x < width - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < height - 1) push(x, y + 1);
  }
}

const args = parseArgs(process.argv);
const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..');
const productsPath = path.join(repoRoot, 'src', 'data', 'products.json');
const catalog = JSON.parse(await readFile(productsPath, 'utf8'));
const product = catalog.products.find((p) => p.id === args.product);
if (!product) throw new Error(`Unknown product id: ${args.product}`);

const lengthCm = product.dimensions_cm.length;
const widthCm = product.dimensions_cm.width;
const footAspect = lengthCm / widthCm;

// 1 — load (+ optional pre-rotate so LENGTH runs left↔right), flood-key.
let img = sharp(await readFile(args.file)).ensureAlpha();
if (args.rotate) img = img.rotate(args.rotate);
const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
floodFillBackground(data, info.width, info.height, args.whiteThreshold);

// 2 — trim to the silhouette.
const keyed = sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png();
const trimmed = await sharp(await keyed.toBuffer()).trim().toBuffer({ resolveWithObject: true });
let artW = trimmed.info.width;
let artH = trimmed.info.height;
let artBuf = trimmed.data;

// Auto-align: portrait silhouette on a landscape footprint (or reverse) → 90°.
if (artW >= artH !== footAspect >= 1 && Math.abs(artW / artH - 1) > 0.02) {
  artBuf = await sharp(artBuf).rotate(90).toBuffer();
  [artW, artH] = [artH, artW];
}

// 3 — conform or pad onto the exact footprint canvas.
const canvasW = Math.round(lengthCm * PX_PER_CM);
const canvasH = Math.round(widthCm * PX_PER_CM);
const artAspect = artW / artH;
const aspectError = Math.abs(artAspect - footAspect) / footAspect;
const mode = args.forceConform || aspectError <= CONFORM_TOLERANCE ? 'conform' : 'pad';
const finalPng = await sharp(artBuf)
  .resize(canvasW, canvasH, {
    fit: mode === 'conform' ? 'fill' : 'contain',
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .png()
  .toBuffer();

const outRel = `/products/topdown/${product.id}.png`;
const outAbs = path.join(repoRoot, 'public', 'products', 'topdown', `${product.id}.png`);

console.log(`product        ${product.id} (${lengthCm}×${widthCm} cm, aspect ${footAspect.toFixed(2)})`);
console.log(`silhouette     ${artW}×${artH} px (aspect ${artAspect.toFixed(2)}, error ${(aspectError * 100).toFixed(1)}%)`);
console.log(`mode           ${mode}${mode === 'pad' ? '  ⚠ aspect off — art padded, consider regenerating' : ''}`);
console.log(`out            ${outRel} (${canvasW}×${canvasH} px) front_edge=${args.frontEdge}`);

if (args.dryRun) {
  console.log('dry-run — nothing written');
} else {
  await writeFile(outAbs, finalPng);
  product.topdown_image_url = outRel;
  product.front_edge = args.frontEdge;
  await writeFile(productsPath, JSON.stringify(catalog, null, 2) + '\n');
  console.log('written + products.json updated');
}
