/**
 * Raster normaliser for the top-down pipeline (SERVER / SCRIPT ONLY).
 *
 * Turns whatever the generator produced (or a merchant's own uploaded
 * photo) into a footprint-EXACT transparent PNG whose pixel dimensions are
 * the product's real width × depth at `PX_PER_CM`. This is the reliable
 * ratio path (findings §5): placement is to-scale on the 0.5 m grid
 * regardless of the image the model returned.
 *
 * Pipeline:
 *   1. Background key → transparent. Default = a border-connected near-white
 *      flood fill (`floodFillBackground`): only removes the background that
 *      touches the frame edge, so white PARTS of the product are preserved.
 *      Pure sharp + a raw-buffer BFS — no native onnx model, so it runs in a
 *      Vercel serverless function and never segfaults a script host. imgly is
 *      available as an opt-in heavier alternative.
 *   2. sharp `.trim()` → strip the transparent border to the silhouette bbox.
 *   3. sharp `.resize(wPx, hPx, { fit: 'fill' })` → force that bbox to the
 *      EXACT footprint canvas. The declared W×D (mandatory at listing,
 *      guarded by the HMAC scale-lock) is the trusted source, so the image
 *      conforms to it — the footprint box is correct by construction and
 *      `cropRect()` no longer needs the square fallback.
 *
 * This module imports `sharp` and MUST NOT be pulled into the client bundle.
 * Pure geometry lives in `footprintCanvas.ts`.
 */

import sharp from 'sharp';
import { footprintCanvasPx, type FootprintCanvas } from './footprintCanvas.js';

export type BgMethod = 'flood' | 'imgly' | 'none';

export interface NormalizeOptions {
  /** Background-removal method. Default 'flood' (border-connected white key). */
  bgMethod?: BgMethod;
  /** White threshold 0–255 for the flood key: pixels with every channel ≥ this (and near-grey) are background. */
  whiteThreshold?: number;
  pxPerCm?: number;
}

export interface NormalizeResult {
  /** Footprint-exact transparent PNG bytes. */
  buffer: Buffer;
  canvas: FootprintCanvas;
  /** Silhouette bbox on the normalised canvas — full-bleed by construction. */
  silhouetteBboxPx: { x: number; y: number; width: number; height: number };
  bgMethod: BgMethod;
}

/**
 * Border-connected near-white flood fill. Sets alpha=0 on every background
 * pixel reachable from the frame edge through near-white/near-grey pixels,
 * leaving interior product detail (incl. white product parts) opaque.
 * Mutates `data` (RGBA, 4 channels) in place.
 */
export function floodFillBackground(
  data: Uint8Array | Buffer,
  width: number,
  height: number,
  whiteThreshold = 235,
): void {
  const isBg = (idx: number): boolean => {
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    // Near-white AND near-neutral (low channel spread) → studio background.
    const min = Math.min(r, g, b);
    const max = Math.max(r, g, b);
    return min >= whiteThreshold && max - min <= 12;
  };
  const visited = new Uint8Array(width * height);
  // Stack-based flood fill seeded from all four edges.
  const stack: number[] = [];
  const push = (x: number, y: number): void => {
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
    const p = stack.pop()!;
    data[p * 4 + 3] = 0; // clear alpha
    const x = p % width;
    const y = (p / width) | 0;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }
}

async function removeBackgroundImgly(input: Buffer): Promise<Buffer> {
  const { removeBackground } = await import('@imgly/background-removal-node');
  const blob = await removeBackground(new Blob([new Uint8Array(input)], { type: 'image/png' }));
  return Buffer.from(await blob.arrayBuffer());
}

/**
 * Normalise a source image (Runway output OR a merchant photo) onto the
 * exact footprint canvas. Returns the PNG bytes for the caller to persist.
 */
export async function normalizeToFootprint(
  input: Buffer,
  widthCm: number,
  depthCm: number,
  opts: NormalizeOptions = {},
): Promise<NormalizeResult> {
  const canvas = footprintCanvasPx(widthCm, depthCm, opts.pxPerCm);
  const method: BgMethod = opts.bgMethod ?? 'flood';

  let keyed: Buffer;
  if (method === 'imgly') {
    try {
      keyed = await removeBackgroundImgly(input);
    } catch {
      keyed = await floodKeyToPng(input, opts.whiteThreshold);
    }
  } else if (method === 'flood') {
    keyed = await floodKeyToPng(input, opts.whiteThreshold);
  } else {
    keyed = input;
  }

  const buffer = await sharp(keyed)
    .ensureAlpha()
    .trim({ threshold: 10 }) // strip the now-transparent / uniform border
    .resize(canvas.wPx, canvas.hPx, { fit: 'fill', kernel: 'lanczos3' })
    .png({ compressionLevel: 9 })
    .toBuffer();

  return {
    buffer,
    canvas,
    silhouetteBboxPx: { x: 0, y: 0, width: canvas.wPx, height: canvas.hPx },
    bgMethod: method,
  };
}

/** Decode → flood-key the background to transparent → re-encode PNG. */
async function floodKeyToPng(input: Buffer, whiteThreshold?: number): Promise<Buffer> {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  floodFillBackground(data, info.width, info.height, whiteThreshold);
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toBuffer();
}
