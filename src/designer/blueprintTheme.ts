/**
 * Blueprint theme — the single source of truth for the Designer's dark
 * architectural canvas (Vic 2026-08-25, complaints 4 + 5).
 *
 * Target look: `Design/Designer.jpeg` — a premium dark architectural
 * blueprint. Deep desaturated navy ground, thick amber walls that read as
 * the primary structure, thin cool grid lines, and uppercase letter-spaced
 * labels. Mapped onto the PPW brand so gold stays the accent it already is
 * everywhere else in the product.
 *
 * SCOPE: the CANVAS and the build-mode TOOLBAR only. The rest of the app
 * chrome (TopBar, cart, shop, checkout) keeps the existing cream/navy brand
 * register — see `01-Staff/rules/…` visual-register discipline: two
 * registers, never blended by accident.
 *
 * Every consumer imports from here. Nothing re-declares these hexes — that
 * is what let the old canvas drift into five different greys.
 */

// ---------------------------------------------------------------------------
// Core palette (the §4 token table).
// ---------------------------------------------------------------------------

/** Stage background OUTSIDE the room. Replaces the cream `bg-ppw-mist`. */
export const CANVAS_GROUND = '#152430';
/** Room polygon interior. Replaces `#FAF7F1`. */
export const ROOM_FILL = '#1D3140';
/** Room outline + interior walls. Replaces the `#0E1B1F` stroke. */
export const WALL_GOLD = '#E8A33D';
/** Selected / hover wall, selection outlines, rotate handle. Replaces cyan. */
export const WALL_GOLD_BRIGHT = '#FFBB58';
/** Grid lines. */
export const GRID_LINE = '#2B4254';
/** On-canvas text (product names, room labels). */
export const LABEL_TEXT = '#E9EDEF';
/** Measurement chip background (paired with MEASURE_BG_OPACITY). */
export const MEASURE_BG = '#0E1B1F';
export const MEASURE_BG_OPACITY = 0.85;
/** Measurement numbers. */
export const MEASURE_TEXT = '#FFBB58';

// ---------------------------------------------------------------------------
// Derived / structural constants.
// ---------------------------------------------------------------------------

/** Wall stroke, in canvas px at scale 1. The reference reads THICK. */
export const WALL_STROKE_PX = 10;
/** Inner hairline that gives the wall its drafted edge. */
export const WALL_INNER_STROKE_PX = 1;
export const WALL_INNER_STROKE = 'rgba(255,187,88,0.35)';

export const GRID_MAJOR_WIDTH_PX = 1;
export const GRID_MINOR_WIDTH_PX = 0.5;
export const GRID_MAJOR_OPACITY = 0.9;
export const GRID_MINOR_OPACITY = 0.5;

/** Ghost placement preview — gold dashed when valid, red when blocked. */
export const GHOST_VALID_FILL = 'rgba(232,163,61,0.28)';
export const GHOST_VALID_STROKE = WALL_GOLD_BRIGHT;
export const GHOST_INVALID = '#E05252';
export const GHOST_INVALID_FILL = 'rgba(224,82,82,0.32)';

/** Secondary on-canvas text (SKU/size sublabels under a product name). */
export const LABEL_TEXT_MUTED = 'rgba(233,237,239,0.62)';

/** Dock / build-toolbar chrome — the dark half of the two registers. */
export const DOCK_BG = '#101C26';
export const DOCK_BG_RAISED = '#1B2C3A';
export const DOCK_BORDER = '#2B4254';
export const DOCK_TEXT = '#E9EDEF';
export const DOCK_TEXT_MUTED = 'rgba(233,237,239,0.62)';
export const DOCK_ACCENT = WALL_GOLD_BRIGHT;

// ---------------------------------------------------------------------------
// Measurement legibility (complaint 3).
// ---------------------------------------------------------------------------

/**
 * Minimum on-SCREEN size of a live measurement number, in CSS px.
 *
 * Konva text inside a scaled Stage shrinks with the viewport scale, which
 * is why the old `fontSize={11}` was unreadable at anything below 100 %
 * zoom. Everything that renders a measurement divides by the scale so the
 * number stays this many px on screen at every zoom level.
 */
export const MEASURE_MIN_SCREEN_PX = 16;

/**
 * Convert the on-screen measurement size into the Konva-space fontSize for
 * a given viewport scale.
 *
 *   rendered px = fontSize * scale   →   fontSize = target / scale
 *
 * Guarded against a zero/negative/NaN scale (a Stage can report scale 0
 * for one frame during a ResizeObserver race) so the chip never collapses
 * or explodes. The result is what Konva is given; the number the user SEES
 * is always `MEASURE_MIN_SCREEN_PX`.
 */
export function measureFontSize(scale: number, targetPx = MEASURE_MIN_SCREEN_PX): number {
  if (!Number.isFinite(scale) || scale <= 0) return targetPx;
  return targetPx / scale;
}

/**
 * Scale-independent chip geometry. Same reasoning as `measureFontSize` —
 * padding and corner radius are authored in screen px and divided by the
 * viewport scale so the chip keeps its proportions at every zoom.
 */
export function measureChipMetrics(scale: number, targetPx = MEASURE_MIN_SCREEN_PX) {
  const font = measureFontSize(scale, targetPx);
  return {
    fontSize: font,
    /** Half-width of the chip in Konva units — fits "12.34 m". */
    halfWidth: font * 2.5,
    height: font * 1.6,
    cornerRadius: font * 0.28,
    padY: font * 0.28,
  };
}

// ---------------------------------------------------------------------------
// e2e support.
// ---------------------------------------------------------------------------

/**
 * Room-border predicate for the Playwright canvas pixel-scan.
 *
 * `tests/e2e/wall-aware-placement.spec.ts` locates the room by scanning the
 * first Konva canvas for its border colour. Before the reskin that was a
 * DARK stroke; it is now GOLD on a dark ground. The spec imports THIS
 * function so the tolerance lives next to the colour it tracks and can
 * never drift into a second hardcoded copy.
 *
 * Tolerance is wide enough for canvas antialiasing on the 10 px stroke and
 * for both gold tones (WALL_GOLD `#E8A33D` and WALL_GOLD_BRIGHT `#FFBB58`),
 * and narrow enough to exclude the ground `#152430`, the room fill
 * `#1D3140` and the grid `#2B4254`.
 */
export const ROOM_BORDER_SCAN = {
  rMin: 200,
  gMin: 120,
  gMax: 190,
  bMax: 90,
  /**
   * Inward nudge from the scanned minimum, in canvas px: the stroke is
   * CENTRED on the polygon path, so the outermost gold pixel sits half a
   * stroke outside the true wall line.
   */
  inset: WALL_STROKE_PX / 2,
} as const;

export function isRoomBorderPixel(r: number, g: number, b: number): boolean {
  return (
    r > ROOM_BORDER_SCAN.rMin
    && g >= ROOM_BORDER_SCAN.gMin
    && g <= ROOM_BORDER_SCAN.gMax
    && b < ROOM_BORDER_SCAN.bMax
  );
}
