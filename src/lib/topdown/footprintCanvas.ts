/**
 * Deterministic footprint-canvas math for the top-down product pipeline.
 *
 * The WD-2D findings (docs/WD-2D-TOPDOWN-FINDINGS-2026-07-10.md §5) showed
 * the ratio-accuracy weak link was NOT the grid math (which scales by
 * physical mm) but the IMAGE: a 1:1 square with arbitrary padding and no
 * guaranteed bounding box, stretched into a non-square footprint.
 *
 * The fix is a deterministic post-process, independent of whatever the
 * generator produced: normalise every top-down onto a fixed
 * centimetres-per-pixel transparent canvas whose pixel dimensions ARE the
 * product's real footprint. At a fixed `PX_PER_CM`, a 60×40 cm bench →
 * a 600×400 px transparent PNG in which the product fills the frame. The
 * designer then places it 1:1 by footprint with zero guesswork.
 *
 * This module is PURE (no I/O, no sharp) so the scale contract is unit
 * tested in isolation. The raster executor lives in `normalizeFootprint.ts`.
 */

/**
 * Fixed scale of the normalised canvas. 10 px per centimetre keeps a
 * typical gym footprint (≤ ~300 cm) comfortably under 3000 px per side
 * while giving enough resolution for the designer thumbnail + on-canvas
 * placement. Do NOT change without re-baking every normalised asset — the
 * value is baked into the pixel dimensions of stored PNGs.
 */
export const PX_PER_CM = 10;

/** Guard rails — reject absurd footprints before they hit the rasteriser. */
export const MIN_DIM_CM = 1;
export const MAX_DIM_CM = 1500; // 15 m — larger than any single product

export interface FootprintCanvas {
  /** Canvas width in px = widthCm * PX_PER_CM (X axis / product width). */
  wPx: number;
  /** Canvas height in px = depthCm * PX_PER_CM (Z/Y axis / product depth). */
  hPx: number;
  widthCm: number;
  depthCm: number;
  pxPerCm: number;
}

export class FootprintError extends Error {}

/**
 * Compute the exact-footprint canvas in pixels for a product's real
 * top-down width × depth (centimetres). Width maps to the canvas X axis,
 * depth to the canvas Y axis — i.e. the canvas IS the floor footprint seen
 * from directly above.
 */
export function footprintCanvasPx(widthCm: number, depthCm: number, pxPerCm = PX_PER_CM): FootprintCanvas {
  for (const [label, v] of [
    ['widthCm', widthCm],
    ['depthCm', depthCm],
  ] as const) {
    if (!Number.isFinite(v) || v < MIN_DIM_CM || v > MAX_DIM_CM) {
      throw new FootprintError(`${label} ${v} outside [${MIN_DIM_CM}, ${MAX_DIM_CM}] cm`);
    }
  }
  return {
    wPx: Math.max(1, Math.round(widthCm * pxPerCm)),
    hPx: Math.max(1, Math.round(depthCm * pxPerCm)),
    widthCm,
    depthCm,
    pxPerCm,
  };
}

export interface Box {
  width: number;
  height: number;
}
export interface FitResult {
  /** Scaled size that fits inside the box preserving aspect. */
  width: number;
  height: number;
  /** Top-left offset to centre the scaled content inside the box. */
  offsetX: number;
  offsetY: number;
  scale: number;
}

/**
 * Contain `src` inside `box` preserving `src`'s aspect ratio, centred.
 * Used to place the alpha-trimmed product silhouette inside the exact
 * footprint canvas without distorting the product's own proportions — it
 * touches at least two opposite edges ("fills the frame") while staying
 * to-scale in its dominant dimension.
 */
export function containFit(src: Box, box: Box): FitResult {
  if (src.width <= 0 || src.height <= 0 || box.width <= 0 || box.height <= 0) {
    throw new FootprintError('containFit requires positive dimensions');
  }
  const scale = Math.min(box.width / src.width, box.height / src.height);
  const width = Math.max(1, Math.round(src.width * scale));
  const height = Math.max(1, Math.round(src.height * scale));
  return {
    width,
    height,
    offsetX: Math.round((box.width - width) / 2),
    offsetY: Math.round((box.height - height) / 2),
    scale,
  };
}

/** Supported gen4_image generation ratios (superset kept intentionally small). */
export const GEN4_IMAGE_RATIOS = [
  '1024:1024', // square (default — the normaliser fixes exact aspect)
  '1440:1080', // 4:3 landscape
  '1080:1440', // 3:4 portrait
  '1920:1080', // 16:9 landscape
  '1080:1920', // 9:16 portrait
] as const;
export type Gen4ImageRatio = (typeof GEN4_IMAGE_RATIOS)[number];

/**
 * Pick the generation ratio whose aspect is nearest the real footprint
 * aspect (width/depth). Only reduces pre-trim distortion; the normaliser
 * guarantees exact final scale regardless of this choice. Square default.
 */
export function nearestGenRatio(widthCm: number, depthCm: number): Gen4ImageRatio {
  if (!Number.isFinite(widthCm) || !Number.isFinite(depthCm) || widthCm <= 0 || depthCm <= 0) {
    return '1024:1024';
  }
  const target = widthCm / depthCm;
  let best: Gen4ImageRatio = '1024:1024';
  let bestErr = Infinity;
  for (const r of GEN4_IMAGE_RATIOS) {
    const [w, h] = r.split(':').map(Number);
    const err = Math.abs(Math.log(w / h) - Math.log(target)); // log-space = symmetric
    if (err < bestErr) {
      bestErr = err;
      best = r;
    }
  }
  return best;
}

/** Runway image models usable for the top-down generator. */
export type RunwayImageModel = 'gen4_image' | 'gemini_image3_pro';

/**
 * RECOMMENDED model, from the 2026-07-10 validation batch
 * (docs/WD-2D-TOPDOWN-FINDINGS-2026-07-10.md + the test-batch report):
 * `gen4_image` reference-conditioning PRESERVES the reference photo's
 * viewpoint, so it kept side/front elevations instead of re-projecting to a
 * true overhead (~1/4 usable). `gemini_image3_pro` obeyed the overhead
 * instruction far more reliably (a spin bike went side-view → genuine plan
 * view). It costs ~20 cr/img vs 8, but catalog art is one-time + high-leverage.
 * The shipped DEFAULT stays `gen4_image` — flipping to the paid tier is a
 * Vic cost-tier decision (money-path gate), surfaced in the report.
 */
export const RECOMMENDED_TOPDOWN_MODEL: RunwayImageModel = 'gemini_image3_pro';

/** Approx credits per 1080p/2K image by model — for est-cost gating. */
export const MODEL_CREDIT_COST: Record<RunwayImageModel, number> = {
  gen4_image: 8,
  gemini_image3_pro: 20,
};

/**
 * gemini_image3_pro takes a DIFFERENT ratio enum than gen4 (NOT the gen4
 * pixel set). `1248:832` (landscape) + `832:1248` (portrait) are probed-good
 * 3:2 pairs; the normaliser fixes the exact final aspect regardless, so a
 * coarse landscape/portrait split is sufficient.
 */
export const GEMINI_IMAGE_RATIOS = ['1248:832', '832:1248'] as const;
export type GeminiImageRatio = (typeof GEMINI_IMAGE_RATIOS)[number];

/** Ratio string appropriate to the chosen model + footprint aspect. */
export function nearestRatioForModel(
  model: RunwayImageModel,
  widthCm: number,
  depthCm: number,
): Gen4ImageRatio | GeminiImageRatio {
  if (model === 'gemini_image3_pro') {
    return widthCm >= depthCm ? '1248:832' : '832:1248';
  }
  return nearestGenRatio(widthCm, depthCm);
}
