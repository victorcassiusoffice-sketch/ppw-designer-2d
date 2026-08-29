/**
 * Top-down art → footprint mapping (2026-08-24).
 *
 * THE ASPECT BUG this fixes: the canvas drew every product image with
 * `width = footprintWidthPx, height = footprintHeightPx` — i.e. the
 * source art was STRETCHED to the footprint rect no matter what shape
 * the art actually was. Correct-aspect top-down renders (canvas ratio ==
 * length:width) were fine, but perspective photos, square placeholders
 * and any merchant-supplied image were distorted: the real dimension
 * effectively applied to one axis only.
 *
 * The fix: contain-fit. The art keeps its TRUE aspect, scaled to fit
 * inside the footprint and centred. If the art's orientation disagrees
 * with the footprint (portrait art on a landscape footprint), it is
 * rotated 90° first so the long axes align. When the aspect already
 * matches the footprint (within 2%), it snaps to an exact fill so
 * properly-authored art stays edge-to-edge with no hairline gaps.
 */

export interface ImageFit {
  /** Extra art rotation (0 or 90°) applied on top of the item rotation. */
  rotationDeg: 0 | 90;
  /** Drawn size of the image BEFORE its own rotation (image axes). */
  drawW: number;
  drawH: number;
}

/** Relative aspect tolerance treated as "authored to match" → exact fill. */
export const FILL_SNAP_TOLERANCE = 0.02;

export function fitImageToFootprint(
  imgW: number,
  imgH: number,
  footW: number,
  footH: number,
): ImageFit {
  if (imgW <= 0 || imgH <= 0 || footW <= 0 || footH <= 0) {
    return { rotationDeg: 0, drawW: footW, drawH: footH };
  }
  // Align long axes: portrait art on a landscape footprint (or the
  // reverse) turns 90° so the product's long side runs the right way.
  // Square-ish art (within the snap tolerance of 1:1) never rotates.
  const imgAspect = imgW / imgH;
  const footAspect = footW / footH;
  const imgSquare = Math.abs(imgAspect - 1) <= FILL_SNAP_TOLERANCE;
  const rotate = !imgSquare && imgAspect >= 1 !== footAspect >= 1;

  // Post-rotation extents of the art at scale 1.
  const effW = rotate ? imgH : imgW;
  const effH = rotate ? imgW : imgH;

  // Authored-to-match art → exact fill (avoids 1px background slivers).
  if (Math.abs(effW / effH - footAspect) / footAspect <= FILL_SNAP_TOLERANCE) {
    return {
      rotationDeg: rotate ? 90 : 0,
      drawW: rotate ? footH : footW,
      drawH: rotate ? footW : footH,
    };
  }

  // Contain: preserve the art's aspect, fit inside the footprint.
  const scale = Math.min(footW / effW, footH / effH);
  return {
    rotationDeg: rotate ? 90 : 0,
    drawW: imgW * scale,
    drawH: imgH * scale,
  };
}

/* ------------------------------------------------------------------ */
/* Content-aware plan (2026-08-29, WP-B)                                */
/* ------------------------------------------------------------------ */

/**
 * Relative aspect mismatch up to which content is STRETCHED to fill the
 * footprint. 0.35 absorbs the demo art (console table 2.67:1 on a 3:1
 * footprint = 11 %; shelf 4.4:1 on 4:1 = 10 %) while a square placeholder
 * on a 3:1 footprint (67 %) still keeps its true shape.
 */
export const FILL_TOLERANCE = 0.35;

export type ImageFitMode = 'fill' | 'contain-back';

export interface ImageFitPlanInput {
  /** Content-box size in source pixels (see imageContent.ts). */
  contentW: number;
  contentH: number;
  /** Footprint rect in canvas units, at item rotation 0 (top = back edge). */
  footW: number;
  footH: number;
  /** Max relative aspect mismatch for a stretch-fill (default FILL_TOLERANCE). */
  fillTolerance?: number;
  /** 'auto' (default) picks by tolerance; 'fill' / 'contain-back' force. */
  mode?: 'auto' | ImageFitMode;
}

export interface ImageFitPlan {
  /** Extra art rotation, applied about the drawn box's centre. */
  rotationDeg: 0 | 90;
  /** Drawn size of the (cropped) content in IMAGE axes, before rotation. */
  drawW: number;
  drawH: number;
  /**
   * Top-left of the art's FOOTPRINT-AXIS bounding box, relative to the
   * footprint rect's top-left, in footprint units. The box measures
   * drawW x drawH at 0°, drawH x drawW at 90°.
   */
  offsetX: number;
  offsetY: number;
  mode: ImageFitMode;
}

/**
 * Plan how a measured content box maps onto a footprint.
 *
 * 1. Align long axes (as `fitImageToFootprint`): rotate 90° when the
 *    content's orientation disagrees with the footprint's; square-ish
 *    content (within FILL_SNAP_TOLERANCE of 1:1) never rotates.
 * 2. Compare the post-rotation content aspect with the footprint aspect,
 *    relative to the footprint: |c − f| / f.
 *    - mismatch <= fillTolerance (or mode 'fill') → stretch to fill the
 *      footprint exactly; offsets are 0.
 *    - otherwise (or mode 'contain-back') → contain at the true aspect,
 *      ANCHORED TO THE BACK EDGE (footprint top, offsetY = 0) and centred
 *      horizontally. Never centred vertically: the art must touch the wall
 *      the item is flush against, so a shallow table on a deep footprint
 *      leaves its slack at the FRONT. (When the contain is height-limited
 *      the art spans the full depth and touches both edges.)
 *
 * Offset convention — offsetX/offsetY locate the top-left of the art's
 * bounding box AS IT APPEARS in footprint axes (post-rotation extents),
 * relative to the footprint top-left, before any item rotation. Apply the
 * 90° art rotation about the centre of that box.
 *
 * Worked example (rotation 0): content 100x100 on footprint 300x100 →
 *   contain-back, drawW = drawH = 100, offsetX = 100, offsetY = 0.
 *   Konva: <Image crop=… x={100} y={0} width={100} height={100} />
 *   or centred form: x={offsetX + drawW/2} y={offsetY + drawH/2}
 *   offsetX={drawW/2} offsetY={drawH/2} rotation={0}.
 *
 * Worked example (rotation 90): content 100x500 (portrait) on footprint
 *   300x100 → rotate; post-rotation aspect 5:1 vs 3:1 = 67 % → contain-
 *   back with scale 0.6: drawW = 60, drawH = 300 (image axes); the box in
 *   footprint axes is 300 wide x 60 deep at offsetX = 0, offsetY = 0.
 *   Konva (centred form works for both angles):
 *     boxW = rotationDeg === 90 ? drawH : drawW;   // 300
 *     boxH = rotationDeg === 90 ? drawW : drawH;   // 60
 *     <Image crop=… x={offsetX + boxW/2} y={offsetY + boxH/2}
 *       width={drawW} height={drawH}
 *       offsetX={drawW/2} offsetY={drawH/2} rotation={90} />
 *   (Node-origin form: x = offsetX + drawH, y = offsetY, rotation 90.)
 *
 * The footprint top is the back edge at item rotation 0 because
 * `front_edge` defaults to 'bottom' (wallAwarePlacement.ts) — the item
 * rotation, not this plan, turns that edge toward the wall.
 */
export function planImageFit(input: ImageFitPlanInput): ImageFitPlan {
  const { contentW, contentH, footW, footH } = input;
  const fillTolerance = input.fillTolerance ?? FILL_TOLERANCE;
  const mode = input.mode ?? 'auto';

  if (!(contentW > 0) || !(contentH > 0) || !(footW > 0) || !(footH > 0)) {
    return { rotationDeg: 0, drawW: footW, drawH: footH, offsetX: 0, offsetY: 0, mode: 'fill' };
  }

  const contentAspect = contentW / contentH;
  const footAspect = footW / footH;
  const contentSquare = Math.abs(contentAspect - 1) <= FILL_SNAP_TOLERANCE;
  const rotate = !contentSquare && contentAspect >= 1 !== footAspect >= 1;
  const rotationDeg: 0 | 90 = rotate ? 90 : 0;

  // Post-rotation extents in footprint axes.
  const effW = rotate ? contentH : contentW;
  const effH = rotate ? contentW : contentH;
  const mismatch = Math.abs(effW / effH - footAspect) / footAspect;

  const fill = mode === 'fill' || (mode === 'auto' && mismatch <= fillTolerance);
  if (fill) {
    return {
      rotationDeg,
      drawW: rotate ? footH : footW,
      drawH: rotate ? footW : footH,
      offsetX: 0,
      offsetY: 0,
      mode: 'fill',
    };
  }

  const scale = Math.min(footW / effW, footH / effH);
  const boxW = effW * scale;
  return {
    rotationDeg,
    drawW: contentW * scale,
    drawH: contentH * scale,
    offsetX: (footW - boxW) / 2,
    offsetY: 0,
    mode: 'contain-back',
  };
}
