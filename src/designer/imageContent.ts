/**
 * Content-box detection for top-down product art (2026-08-29, WP-B).
 *
 * WHY: `fitImageToFootprint` maps the WHOLE bitmap onto the footprint, so
 * any margin baked into the art (the 1024x1024 demo JPEGs carry ~35 %
 * white slab around a 3:1 table) becomes empty floor inside the footprint
 * and the item visibly fails to touch the wall it is flush against. K1
 * PNGs are footprint-exact RGBA and need no correction. Measuring the
 * tight content box at runtime lets the canvas crop to the object first
 * (see `planImageFit` in ./imageFit.ts) regardless of how the art was
 * authored.
 *
 * Two signals decide "content": alpha above a threshold, and (for opaque
 * JPEG-style art) "not near-white". The DOM wrapper auto-picks: an image
 * with real transparency is trusted on alpha alone so white PARTS of a
 * product (a white treadmill deck touching the PNG edge) are never keyed
 * away; an opaque image falls back to the white key.
 *
 * `contentBoxForImage` needs a real 2D canvas — jsdom/node cannot run it.
 * Tests cover the pure `contentBoxFromRGBA` with synthetic pixel arrays.
 */
import { planImageFit, type ImageFitPlan, type ImageFitPlanInput } from './imageFit';

/** Tight bounding box of content pixels, in the pixel space it was measured in. */
export interface ContentBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ContentBoxOptions {
  /** A pixel is content when its alpha is STRICTLY above this (default 8). */
  alphaThreshold?: number;
  /** Also treat near-white opaque pixels as background (default true). */
  whiteKey?: boolean;
  /** Near-white: r, g, b all >= whiteMin (default 236)... */
  whiteMin?: number;
  /** ...and max(r,g,b) - min(r,g,b) <= whiteSpread (default 14). */
  whiteSpread?: number;
  /**
   * Sample every Nth pixel on both axes (default 1 = every pixel). The
   * returned box is expanded by stride-1 on every side so it can only ever
   * be LOOSER than the true box, never crop content.
   */
  stride?: number;
}

export const DEFAULT_ALPHA_THRESHOLD = 8;
export const DEFAULT_WHITE_MIN = 236;
export const DEFAULT_WHITE_SPREAD = 14;
/** Long side the DOM wrapper samples at — plenty for a bbox, cheap to read. */
export const CONTENT_SAMPLE_MAX_PX = 512;

type PixelData = Uint8ClampedArray | Uint8Array;

function isNearWhite(r: number, g: number, b: number, whiteMin: number, whiteSpread: number): boolean {
  if (r < whiteMin || g < whiteMin || b < whiteMin) return false;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max - min <= whiteSpread;
}

/**
 * Tight bounding box of "content" pixels in an RGBA buffer.
 * Content = alpha > alphaThreshold AND (when whiteKey) not near-white.
 * Returns the full image box when nothing qualifies or inputs are degenerate.
 */
export function contentBoxFromRGBA(
  data: PixelData,
  width: number,
  height: number,
  opts: ContentBoxOptions = {},
): ContentBox {
  const full: ContentBox = { x: 0, y: 0, w: Math.max(0, width), h: Math.max(0, height) };
  if (!(width > 0) || !(height > 0) || data.length < width * height * 4) return full;

  const alphaThreshold = opts.alphaThreshold ?? DEFAULT_ALPHA_THRESHOLD;
  const whiteKey = opts.whiteKey ?? true;
  const whiteMin = opts.whiteMin ?? DEFAULT_WHITE_MIN;
  const whiteSpread = opts.whiteSpread ?? DEFAULT_WHITE_SPREAD;
  const stride = Math.max(1, Math.floor(opts.stride ?? 1));

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += stride) {
    const row = y * width;
    for (let x = 0; x < width; x += stride) {
      const i = (row + x) * 4;
      if (data[i + 3] <= alphaThreshold) continue;
      if (whiteKey && isNearWhite(data[i], data[i + 1], data[i + 2], whiteMin, whiteSpread)) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < 0) return full;

  // Coarse sampling can miss up to stride-1 pixels beyond each sampled
  // extreme; widen conservatively so the crop never eats content.
  const slack = stride - 1;
  const x0 = Math.max(0, minX - slack);
  const y0 = Math.max(0, minY - slack);
  const x1 = Math.min(width, maxX + 1 + slack);
  const y1 = Math.min(height, maxY + 1 + slack);
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** True when any pixel is not fully opaque (a real alpha channel in use). */
export function hasTransparency(data: PixelData): boolean {
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 255) return true;
  }
  return false;
}

/** True when the box covers the whole image (nothing to crop). */
export function isFullBox(box: ContentBox, width: number, height: number): boolean {
  return box.x === 0 && box.y === 0 && box.w === width && box.h === height;
}

// Keyed by img.src: the same URL always yields the same pixels, and a
// PlacedItem re-renders far more often than its art changes.
const boxCache = new Map<string, ContentBox>();

/** Test / HMR hook — drop every cached measurement. */
export function resetContentBoxCache(): void {
  boxCache.clear();
}

/**
 * Measure a loaded image's content box in NATURAL pixels via an offscreen
 * canvas (downscaled to <= CONTENT_SAMPLE_MAX_PX on the long side, box
 * scaled back and rounded outward). Returns the full natural box on any
 * failure: not yet loaded, tainted canvas, no 2D context, zero size.
 *
 * `opts.whiteKey` defaults to "only when the image has NO transparency"
 * — see the module comment. Not runnable under jsdom (no real canvas).
 */
export function contentBoxForImage(img: HTMLImageElement, opts: ContentBoxOptions = {}): ContentBox {
  const natW = img.naturalWidth;
  const natH = img.naturalHeight;
  const full: ContentBox = { x: 0, y: 0, w: natW, h: natH };
  if (!(natW > 0) || !(natH > 0)) return full;
  // A half-decoded image draws nothing → an all-clear read would cache a
  // bogus full box for the life of the page. Measure only once complete.
  if (!img.complete) return full;

  const key = img.currentSrc || img.src;
  if (key) {
    const hit = boxCache.get(key);
    if (hit) return hit;
  }

  let out = full;
  try {
    const scale = Math.min(1, CONTENT_SAMPLE_MAX_PX / Math.max(natW, natH));
    const sw = Math.max(1, Math.round(natW * scale));
    const sh = Math.max(1, Math.round(natH * scale));
    const canvas = document.createElement('canvas');
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (ctx) {
      ctx.clearRect(0, 0, sw, sh);
      ctx.drawImage(img, 0, 0, sw, sh);
      // Throws SecurityError on a cross-origin image without CORS.
      const { data } = ctx.getImageData(0, 0, sw, sh);
      const whiteKey = opts.whiteKey ?? !hasTransparency(data);
      const box = contentBoxFromRGBA(data, sw, sh, { ...opts, whiteKey });
      if (!isFullBox(box, sw, sh)) {
        // Round outward when mapping back so downscale blur never trims.
        const inv = 1 / scale;
        const x0 = Math.max(0, Math.floor(box.x * inv));
        const y0 = Math.max(0, Math.floor(box.y * inv));
        const x1 = Math.min(natW, Math.ceil((box.x + box.w) * inv));
        const y1 = Math.min(natH, Math.ceil((box.y + box.h) * inv));
        out = { x: x0, y: y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) };
      }
    }
  } catch {
    out = full;
  }

  if (key) boxCache.set(key, out);
  return out;
}

export interface ImageContentFit {
  /** Source-pixel crop to hand to the renderer (Konva `crop`). */
  crop: ContentBox;
  /** How to draw that crop inside the footprint — see `planImageFit`. */
  fit: ImageFitPlan;
}

/**
 * One-call integration point for the canvas: measure the content box of a
 * loaded image, then plan its placement in a footW x footH footprint.
 *
 * Konva wiring (footprint-local coords, `<Group>` at the item's AABB):
 *   const { crop, fit } = fitImageContentToFootprint(image, wPx, hPx);
 *   const boxW = fit.rotationDeg === 90 ? fit.drawH : fit.drawW;
 *   const boxH = fit.rotationDeg === 90 ? fit.drawW : fit.drawH;
 *   <KonvaImage image={image}
 *     crop={{ x: crop.x, y: crop.y, width: crop.w, height: crop.h }}
 *     x={fit.offsetX + boxW / 2} y={fit.offsetY + boxH / 2}
 *     width={fit.drawW} height={fit.drawH}
 *     offsetX={fit.drawW / 2} offsetY={fit.drawH / 2}
 *     rotation={fit.rotationDeg} />
 */
export function fitImageContentToFootprint(
  img: HTMLImageElement,
  footW: number,
  footH: number,
  opts: Pick<ImageFitPlanInput, 'fillTolerance' | 'mode'> & { content?: ContentBoxOptions } = {},
): ImageContentFit {
  const crop = contentBoxForImage(img, opts.content);
  const fit = planImageFit({
    contentW: crop.w,
    contentH: crop.h,
    footW,
    footH,
    fillTolerance: opts.fillTolerance,
    mode: opts.mode,
  });
  return { crop, fit };
}
