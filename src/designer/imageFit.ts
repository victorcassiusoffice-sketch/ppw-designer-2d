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
