/**
 * Sims-Parity DT-11 — placed-item shadow geometry + crop math.
 *
 * Pure functions consumed by `PlacedItem.tsx` (Konva.Image) to compute:
 *   • shadowGeometry() — picks GL1.04 (behind) vs GL1.04b (offset
 *     below) ellipse based on `photo_alpha_clean`.
 *   • cropRect() — translates a `silhouette_bbox_px` into a
 *     Konva crop config; absent bbox → null (render full photo).
 *
 * Spec source: MASTER-BUILD-PLAN.md §2 DT-11, MASTER-DATA-FLOW.md §5.
 */

export interface PlacedItemModel {
  /** Item position in canvas px. */
  xPx: number;
  yPx: number;
  /** Physical dimensions in mm. */
  widthMm: number;
  depthMm: number;
  heightMm: number;
  /** Canvas pixels-per-mm scale (room scale, not per-product). */
  pxPerMm: number;
  /** V-GAME-INT-1: alpha_clean=true → GL1.04 behind path; false → GL1.04b synthetic offset path. */
  photoAlphaClean: boolean;
  /** V-GAME-INT-2 / GL1.01b: optional silhouette bbox in source-image px. */
  silhouetteBboxPx?: { x: number; y: number; width: number; height: number };
  /** Source image natural dimensions in px (for bbox crop scaling). */
  imageNaturalWidthPx?: number;
  imageNaturalHeightPx?: number;
}

export interface ShadowGeometry {
  path: 'GL1.04' | 'GL1.04b';
  centreXPx: number;
  centreYPx: number;
  radiusXPx: number;
  radiusYPx: number;
  opacity: number;
  blur: number;
  offsetXPx: number;
  offsetYPx: number;
  fillRgb: string;
}

/**
 * Compute the ground-shadow ellipse for a placed item.
 *
 * Path A (alpha_clean=true / GL1.04): ellipse drawn BEHIND item;
 *   transparent photo overlays cleanly.
 *   radiusX = widthMm * 1.05 * pxPerMm / 2 (so the px-diameter
 *           sweeps width * 1.05 — i.e. 5% wider than footprint).
 *   radiusY = depthMm * 0.4 * pxPerMm / 2.
 *   blur 6, opacity 0.18, offset (2, 1).
 *
 * Path B (alpha_clean=false / GL1.04b synthetic): ellipse drawn BELOW
 *   the photo's bottom edge.
 *   Y offset from bottom = heightMm * 0.04 * pxPerMm.
 *   radiusX same; radiusY = depthMm * 0.4 * 0.6 * pxPerMm / 2
 *   (shorter ellipse — reads as "ground projection cast forward").
 *   blur 6, opacity 0.18.
 */
export function shadowGeometry(item: PlacedItemModel): ShadowGeometry {
  const wPx = item.widthMm * item.pxPerMm;
  const dPx = item.depthMm * item.pxPerMm;
  const hPx = item.heightMm * item.pxPerMm;

  // Common tokens (locked by spec).
  const opacity = 0.18;
  const blur = 6;
  const fillRgb = 'rgb(14, 14, 16)'; // V4-AU-1 ink

  if (item.photoAlphaClean) {
    // GL1.04 — behind, classic drop shadow.
    return {
      path: 'GL1.04',
      centreXPx: item.xPx + wPx / 2,
      centreYPx: item.yPx + dPx / 2,
      radiusXPx: (wPx * 1.05) / 2,
      radiusYPx: (dPx * 0.4) / 2,
      opacity,
      blur,
      offsetXPx: 2,
      offsetYPx: 1,
      fillRgb,
    };
  }
  // GL1.04b — synthetic offset-below.
  return {
    path: 'GL1.04b',
    centreXPx: item.xPx + wPx / 2,
    centreYPx: item.yPx + dPx + hPx * 0.04,
    radiusXPx: (wPx * 1.05) / 2,
    radiusYPx: (dPx * 0.4 * 0.6) / 2,
    opacity,
    blur,
    offsetXPx: 0,
    offsetYPx: 0,
    fillRgb,
  };
}

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * GL1.01b crop-on-render. When silhouette_bbox_px is present, the
 * Konva.Image is cropped to the silhouette before being sized to
 * the room-scale footprint. v1 no-bbox path returns null and the
 * renderer falls back to the full photo (known degradation, accepted).
 *
 * The crop is in source-image px directly — Konva.Image.crop
 * accepts source-pixel coords.
 */
export function cropRect(item: PlacedItemModel): CropRect | null {
  if (!item.silhouetteBboxPx) return null;
  const { x, y, width, height } = item.silhouetteBboxPx;
  // Defensive: clamp to image bounds if available.
  if (item.imageNaturalWidthPx && item.imageNaturalHeightPx) {
    const cx = Math.max(0, Math.min(x, item.imageNaturalWidthPx - 1));
    const cy = Math.max(0, Math.min(y, item.imageNaturalHeightPx - 1));
    const cw = Math.max(1, Math.min(width, item.imageNaturalWidthPx - cx));
    const ch = Math.max(1, Math.min(height, item.imageNaturalHeightPx - cy));
    return { x: cx, y: cy, width: cw, height: ch };
  }
  return { x, y, width, height };
}

/**
 * Wood-grain alignment: the floor pattern's longest axis should align
 * with the room's longest axis. Returns a Konva rotation in degrees
 * for the wood-plank texture.
 */
export function woodGrainRotationDeg(roomWidthMm: number, roomDepthMm: number): number {
  return roomWidthMm >= roomDepthMm ? 0 : 90;
}
