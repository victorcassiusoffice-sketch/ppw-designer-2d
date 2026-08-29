/**
 * Tripwire for the e2e wall pixel-scan.
 *
 * `roomOrigin()` in the multi-room e2e specs establishes the coordinate frame
 * for every synthetic click by scanning the first Konva canvas for the
 * leftmost/topmost pixel satisfying `isRoomBorderPixel` — i.e. by assuming
 * NEAR-BLACK (`WALL_INK`, every channel < `ROOM_BORDER_SCAN.max`) appears
 * nowhere on the plan except a wall.
 *
 * Paper theme (2026-08-29): walls went from gold to charcoal, so the hazard
 * flipped from "warm swatches" to "dark swatches". If a catalog floor or paint
 * colour lands inside the charcoal band, the scan can latch onto a fill
 * instead of a wall and the specs keep passing while asserting against a
 * silently wrong coordinate frame.
 *
 * The primary defence is `src/lib/geomBridge.ts`, which moves the coordinate
 * basis off colour entirely. This test defends the FALLBACK path, and — more
 * usefully — fails loudly the moment someone adds a near-black swatch to a
 * catalog, pointing at the real consequence rather than letting it surface as
 * a baffling off-by-hundreds-of-pixels e2e failure weeks later.
 */
import { describe, it, expect } from 'vitest';
import {
  isRoomBorderPixel,
  ROOM_BORDER_SCAN,
  WALL_INK,
  WALL_GOLD,
  DOOR_LEAF,
  DOOR_TARGET_WALL,
  GHOST_VALID_FILL,
  GHOST_VALID_STROKE,
  GHOST_INVALID,
  GHOST_INVALID_FILL,
  SELECT_STROKE,
  HANDLE_FILL,
} from '../blueprintTheme';
import { ECO_FLOORING_CATALOG, ECO_PAINT_PALETTE } from '../../data/paintPalette';
import { FLOOR_MATERIALS } from '../../data/floorMaterials';

/**
 * Catalog floors that already sit inside the charcoal band. They are K1's
 * black rubber / EVA gym mats — near-black IS the product. Quarantined, not
 * fixed, because `src/data/*` belongs to the catalog package (WP-D); the owner
 * should lift one channel to >= ROOM_BORDER_SCAN.max (e.g. #1A1A1A → #323232)
 * and then delete the id here — the "still dark" test below makes a stale
 * entry fail.
 *
 * Practical risk is low: a floor fill is clipped to its room polygon, so its
 * leftmost/topmost pixel is never further out than the wall stroke centred on
 * that same edge. The guard is kept strict anyway so the invariant stays
 * simple: "only walls are near-black".
 */
const KNOWN_DARK_FLOORS: ReadonlySet<string> = new Set(['k1-eva-combat-mat', 'k1-rubber-interlock']);

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '').trim();
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

/** Solid form of an `rgba()` token — what it would be at full opacity. */
function rgbaToRgb(str: string): [number, number, number] {
  const m = /rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,/.exec(str);
  if (!m) throw new Error(`not an rgba() string: ${str}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

const BAND = `(r, g, b all < ${ROOM_BORDER_SCAN.max})`;

describe('ROOM_BORDER_SCAN guard', () => {
  it('matches the wall ink (the scan still finds a wall)', () => {
    for (const ink of [WALL_INK, WALL_GOLD]) {
      const [r, g, b] = hexToRgb(ink);
      expect(isRoomBorderPixel(r, g, b), `${ink} should match the wall scan`).toBe(true);
    }
  });

  it('does NOT match any flooring material outside the quarantine — a floor fill must never be mistaken for a wall', () => {
    const offenders: string[] = [];
    for (const m of ECO_FLOORING_CATALOG) {
      if (KNOWN_DARK_FLOORS.has(m.id)) continue;
      const [r, g, b] = hexToRgb(m.hex);
      if (isRoomBorderPixel(r, g, b)) offenders.push(`${m.id} (${m.hex})`);
    }
    for (const m of FLOOR_MATERIALS) {
      const [r, g, b] = hexToRgb(m.hex);
      if (isRoomBorderPixel(r, g, b)) offenders.push(`${m.id} (${m.hex})`);
    }
    expect(
      offenders,
      `These floor colours fall inside the charcoal wall-scan band ${BAND}. The e2e `
        + `roomOrigin() fallback would scan the FLOOR instead of the wall and silently shift `
        + `every click coordinate. Lift at least one channel to >= ${ROOM_BORDER_SCAN.max}, or `
        + `delete the pixel-scan fallback now that geomBridge exists.`,
    ).toEqual([]);
  });

  it('the quarantined dark floors are still dark — delete an id from KNOWN_DARK_FLOORS once it is fixed', () => {
    for (const id of KNOWN_DARK_FLOORS) {
      const m = ECO_FLOORING_CATALOG.find((f) => f.id === id);
      expect(m, `${id} is no longer in ECO_FLOORING_CATALOG — drop it from the quarantine`).toBeDefined();
      const [r, g, b] = hexToRgb(m!.hex);
      expect(
        isRoomBorderPixel(r, g, b),
        `${id} (${m!.hex}) is outside the band now — drop it from KNOWN_DARK_FLOORS`,
      ).toBe(true);
    }
  });

  it('does NOT match the door highlight, ghost, selection or handle colours', () => {
    // DOOR_LEAF is deliberately wall ink now (a plan draws the leaf as a thin
    // dark line ON the wall), so it lives inside the band by design and can
    // never be further left/top than the wall it hangs from. What must stay
    // out are the things drawn OFF the wall line: the door tool's target
    // highlight, the placement ghost (which can hover anywhere, including
    // outside every room), the selection outline and the corner handles that
    // sit half outside a flush item's footprint.
    expect(DOOR_LEAF).toBe(WALL_INK);
    const solids: Array<[string, string]> = [
      ['DOOR_TARGET_WALL', DOOR_TARGET_WALL],
      ['GHOST_VALID_STROKE', GHOST_VALID_STROKE],
      ['GHOST_INVALID', GHOST_INVALID],
      ['SELECT_STROKE', SELECT_STROKE],
      ['HANDLE_FILL', HANDLE_FILL],
    ];
    for (const [name, hex] of solids) {
      const [r, g, b] = hexToRgb(hex);
      expect(isRoomBorderPixel(r, g, b), `${name} ${hex} must stay outside the wall band`).toBe(false);
    }
    // The ghost fills are translucent; their solid form must be clear too.
    for (const [name, token] of [['GHOST_VALID_FILL', GHOST_VALID_FILL], ['GHOST_INVALID_FILL', GHOST_INVALID_FILL]]) {
      const [r, g, b] = rgbaToRgb(token);
      expect(isRoomBorderPixel(r, g, b), `${name} ${token} must stay outside the wall band`).toBe(false);
    }
  });

  it('does NOT match any paint swatch', () => {
    const offenders = ECO_PAINT_PALETTE.filter((p) => {
      const [r, g, b] = hexToRgb(p.hex);
      return isRoomBorderPixel(r, g, b);
    }).map((p) => `${p.id} (${p.hex})`);
    expect(offenders, `Paint swatches must stay outside the charcoal wall-scan band ${BAND}`).toEqual([]);
  });
});
