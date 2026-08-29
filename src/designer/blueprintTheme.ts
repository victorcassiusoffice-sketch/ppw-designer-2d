/**
 * Blueprint theme — the single source of truth for the Designer's canvas
 * palette. Architectural PAPER register (Sims world, 2026-08-29, WP-E).
 *
 * Target look: the three reference plans in
 * `docs/sims-world-2026-08-29/00-FINDINGS.md` row 6 — a printed
 * architect's drawing. Warm cream paper outside the plot, paper-white room
 * floors, charcoal poche walls that cast a soft drop shadow, a grid so quiet
 * it is felt rather than seen, small-caps grey labels, thin dark door
 * symbols, warm pools of light under lamps and muted greenery outside the
 * house. This replaces the 2026-08-25 dark navy + gold blueprint.
 *
 * SCOPE: the CANVAS only. The build dock keeps the PPWellness Shop skin
 * (`DOCK_*` below, unchanged) and the rest of the app chrome (TopBar, cart,
 * shop, checkout) keeps the cream/navy brand register — two registers, never
 * blended by accident.
 *
 * Every consumer imports from here. Nothing re-declares these hexes — that
 * is what let the old canvas drift into five different greys.
 *
 * E2E CONTRACT: the Playwright origin fallback finds a room by scanning the
 * Konva canvas for wall pixels (`ROOM_BORDER_SCAN` / `isRoomBorderPixel`).
 * Walls are the ONLY near-black thing on the plan, so every floor material,
 * paint swatch, door highlight, ghost and label colour must keep at least
 * one RGB channel >= `ROOM_BORDER_SCAN.max` (50). `roomBorderScanGuard.test.ts`
 * enforces that for the catalogs; `blueprintTheme.test.ts` for the tokens.
 */

// ---------------------------------------------------------------------------
// Paper + plot.
// ---------------------------------------------------------------------------

/** Stage background OUTSIDE the plot — the paper the plan is printed on. */
export const CANVAS_GROUND = '#E7E2D8';
/** The land plot (site). A shade lighter than the paper so it reads as "yours". */
export const SITE_FILL = '#EFEAE0';
/** Plot boundary line. */
export const SITE_STROKE = '#A29C8F';
/** Garden / outdoor room fill — between the paper and the house floors. */
export const OUTDOOR_FILL = '#EDE9DE';

// ---------------------------------------------------------------------------
// Rooms.
// ---------------------------------------------------------------------------

/** Room polygon interior — paper white. */
export const ROOM_FILL = '#F8F5EE';
/**
 * Attached multi-room (2026-08-26) — every room renders on one canvas, so
 * the ACTIVE room (the one the TopBar L/W and DetailsPanel describe) needs
 * to read as focused without shouting. A slightly brighter floor plus a
 * darker label is enough; the walls stay identical so the plan still reads
 * as one continuous drawing rather than a set of cards.
 */
export const ROOM_FILL_ACTIVE = '#FDFBF6';
export const ROOM_LABEL_ACTIVE_OPACITY = 0.9;
export const ROOM_LABEL_INACTIVE_OPACITY = 0.5;

// ---------------------------------------------------------------------------
// Walls — charcoal poche with a soft drop shadow.
// ---------------------------------------------------------------------------

/** Wall ink: room outlines, interior walls, free walls, door leaves. */
export const WALL_INK = '#2A2926';
/** The storey below, shown through the paper while editing an upper level. */
export const WALL_INK_GHOST = 'rgba(42,41,38,0.28)';
/**
 * Drop shadow under the wall band. Konva `shadowColor` + `shadowBlur` +
 * `shadowOffset`; the offset is in layer px at scale 1 (light from top-left,
 * as on the reference plans).
 */
export const WALL_SHADOW = 'rgba(40,36,30,0.38)';
export const WALL_SHADOW_BLUR_PX = 14;
export const WALL_SHADOW_OFFSET = { x: 5, y: 7 } as const;

/** Wall stroke, in canvas px at scale 1 (= 0.1 m at 100 px/m). */
export const WALL_STROKE_PX = 10;
/** Inner hairline that gives the wall its drafted edge. Paper, near-invisible. */
export const WALL_INNER_STROKE_PX = 1;
export const WALL_INNER_STROKE = 'rgba(248,245,238,0.18)';

/**
 * @deprecated Gold is gone. Use `WALL_INK`. Kept as an alias so the 2026-08-25
 * importers keep compiling while they migrate.
 */
export const WALL_GOLD = WALL_INK;

// ---------------------------------------------------------------------------
// Selection + placement chrome — one muted teal accent.
// ---------------------------------------------------------------------------

/** Selected item outline, hover wall, live draw segment. */
export const SELECT_STROKE = '#3D8F79';
/** Corner + rotate handles. */
export const HANDLE_FILL = '#3D8F79';

/**
 * @deprecated Use `SELECT_STROKE` (outlines) or `HANDLE_FILL` (handles).
 * Alias kept for the 2026-08-25 importers.
 */
export const WALL_GOLD_BRIGHT = SELECT_STROKE;

/** Ghost placement preview — teal when valid, terracotta when blocked. */
export const GHOST_VALID_FILL = 'rgba(121,199,173,0.35)';
export const GHOST_VALID_STROKE = '#3D8F79';
export const GHOST_INVALID = '#C9553F';
export const GHOST_INVALID_FILL = 'rgba(201,85,63,0.30)';

// ---------------------------------------------------------------------------
// Grid — drawn in wall ink at very low opacity so it sits IN the paper.
// ---------------------------------------------------------------------------

/**
 * Grid line colour. Same ink as the walls; the opacities below are what keep
 * it quiet. Never draw it at full opacity — at 1.0 it would fall inside the
 * e2e wall-scan band.
 */
export const GRID_LINE = '#2A2926';
export const GRID_MAJOR_WIDTH_PX = 1;
export const GRID_MINOR_WIDTH_PX = 0.5;
export const GRID_MAJOR_OPACITY = 0.12;
export const GRID_MINOR_OPACITY = 0.06;

// ---------------------------------------------------------------------------
// Labels + dimensions.
// ---------------------------------------------------------------------------

/** On-canvas text (product names, room labels). Warm charcoal, not black. */
export const LABEL_TEXT = '#3A3835';
/** Secondary on-canvas text (SKU/size sublabels under a product name). */
export const LABEL_TEXT_MUTED = 'rgba(58,56,53,0.62)';
/** Paper halo behind a label that sits over a wall or a dark floor. */
export const LABEL_HALO = '#F8F5EE';
/** Dimension lines + their end ticks. */
export const DIM_LINE = '#8A857A';

/** Measurement chip: charcoal plate (paired with MEASURE_BG_OPACITY), paper numerals. */
export const MEASURE_BG = '#2A2926';
export const MEASURE_BG_OPACITY = 0.92;
export const MEASURE_TEXT = '#F8F5EE';

// ---------------------------------------------------------------------------
// Openings — doors, doorways and windows.
// ---------------------------------------------------------------------------

/**
 * Door symbols are drawn in WALL INK on purpose: on an architect's plan the
 * leaf is a thin dark line and the swing a light arc. That puts `DOOR_LEAF`
 * INSIDE the e2e wall-scan band — acceptable because a door symbol always
 * sits on the wall line, so it can never be further left/top than the wall
 * the scan is looking for. `DOOR_TARGET_WALL` (the highlight on the wall the
 * door tool is about to cut) is teal and stays outside the band.
 */
export const DOOR_LEAF = '#2A2926';
export const DOOR_ARC = 'rgba(42,41,38,0.5)';
export const DOOR_TARGET_WALL = '#3D8F79';

// ---------------------------------------------------------------------------
// Light, greenery, item shadows.
// ---------------------------------------------------------------------------

/** Radial glow under a lit lamp: warm core fading to nothing at the edge. */
export const LIGHT_GLOW_CORE = 'rgba(255,214,140,0.55)';
export const LIGHT_GLOW_EDGE = 'rgba(255,214,140,0)';
/** Trees, hedges, planters — muted sage so they never compete with the plan. */
export const GREENERY_FILL = '#8FA882';
export const GREENERY_STROKE = '#5E7A54';
/** Soft shadow under placed furniture so it sits ON the floor. */
export const ITEM_SHADOW = 'rgba(40,36,30,0.22)';

// ---------------------------------------------------------------------------
// Dock / build-toolbar chrome. Matched to the PPWellness Shop skin
// (src/styles/soft-shop.css) per Vic 2026-08-28 — warm off-white ground,
// near-white raised surfaces, hairline rims, dark warm ink, mint accent —
// so the designer menus read as the same product as the storefront.
// Deliberately untouched by the paper reskin.
// ---------------------------------------------------------------------------

export const DOCK_BG = '#efede8'; /* shop --sg ground */
export const DOCK_BG_RAISED = '#faf9f5'; /* shop --ss surface */
export const DOCK_BORDER = '#dcd9d0'; /* shop --rim */
export const DOCK_TEXT = '#37362f'; /* shop --ink */
export const DOCK_TEXT_MUTED = '#85826f'; /* shop --ink2 */
export const DOCK_ACCENT = '#79c7ad'; /* shop --mint-deep */

// ---------------------------------------------------------------------------
// Measurement legibility (complaint 3, 2026-08-25).
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
 * `tests/e2e/multiroom-helpers.ts` and `wall-aware-placement.spec.ts` locate
 * a room by scanning the first Konva canvas for the leftmost/topmost wall
 * pixel. Walls are now CHARCOAL (`WALL_INK` #2A2926) on paper, so the scan
 * looks for near-black: every channel below `max`, alpha above `minAlpha`.
 * The specs import THIS object and function so the tolerance lives next to
 * the colour it tracks and can never drift into a second hardcoded copy.
 *
 * INVARIANT (guarded by `roomBorderScanGuard.test.ts`): nothing else on the
 * plan may be near-black. Every floor material, paint swatch, door
 * highlight, ghost, handle and label colour keeps at least one channel >= 50.
 * Things that ARE wall ink (door leaves, the grid at <= 0.12 opacity, the
 * measurement plate at 0.92) either sit on the wall line or are composited
 * onto paper far above the threshold.
 */
export const ROOM_BORDER_SCAN = {
  /** Exclusive upper bound for each of r, g, b. */
  max: 50,
  /** Exclusive lower bound for alpha — skips antialiased fringe pixels. */
  minAlpha: 200,
  /**
   * Inward nudge from the scanned minimum, in canvas px: the stroke is
   * CENTRED on the polygon path, so the outermost ink pixel sits half a
   * stroke outside the true wall line.
   */
  inset: WALL_STROKE_PX / 2,
} as const;

export function isRoomBorderPixel(r: number, g: number, b: number): boolean {
  return r < ROOM_BORDER_SCAN.max && g < ROOM_BORDER_SCAN.max && b < ROOM_BORDER_SCAN.max;
}
