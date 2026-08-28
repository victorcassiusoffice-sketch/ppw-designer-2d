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
/**
 * Attached multi-room (2026-08-26) — every room renders on one canvas, so
 * the ACTIVE room (the one the TopBar L/W and DetailsPanel describe) needs
 * to read as focused without shouting. A slightly lifted floor plus a
 * brighter label is enough; the gold walls stay identical so the plan still
 * reads as one continuous drawing rather than a set of cards.
 */
export const ROOM_FILL_ACTIVE = '#234156';
export const ROOM_LABEL_ACTIVE_OPACITY = 0.9;
export const ROOM_LABEL_INACTIVE_OPACITY = 0.5;
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

/**
 * Openings (2026-08-28) — doors, doorways and windows.
 *
 * Deliberately PALE rather than gold. Two reasons: on a plan the door leaf and
 * its swing arc are annotation over the wall, so they should read as a lighter
 * weight than the structure; and gold-toned door symbols would fall inside
 * `ROOM_BORDER_SCAN`'s tolerance band, which the e2e origin fallback uses to
 * locate the leftmost WALL. `roomBorderScanGuard.test.ts` pins both colours
 * outside that band.
 */
export const DOOR_LEAF = '#F2E4CE';
export const DOOR_ARC = 'rgba(242,228,206,0.55)';
/** Highlight on the wall the door tool is about to cut. */
export const DOOR_TARGET_WALL = '#7FD4C1';

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

/**
 * Dock / build-toolbar chrome. Matched to the PPWellness Shop skin
 * (src/styles/soft-shop.css) per Vic 2026-08-28 — warm off-white ground,
 * near-white raised surfaces, hairline rims, dark warm ink, mint accent —
 * so the designer menus read as the same product as the storefront.
 */
export const DOCK_BG = '#efede8'; /* shop --sg ground */
export const DOCK_BG_RAISED = '#faf9f5'; /* shop --ss surface */
export const DOCK_BORDER = '#dcd9d0'; /* shop --rim */
export const DOCK_TEXT = '#37362f'; /* shop --ink */
export const DOCK_TEXT_MUTED = '#85826f'; /* shop --ink2 */
export const DOCK_ACCENT = '#79c7ad'; /* shop --mint-deep */

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
