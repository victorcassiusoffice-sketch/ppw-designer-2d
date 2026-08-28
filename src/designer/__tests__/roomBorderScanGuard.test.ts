/**
 * Tripwire for the e2e gold pixel-scan.
 *
 * `roomOrigin()` in the multi-room e2e specs establishes the coordinate frame
 * for every synthetic click by scanning the first Konva canvas for the
 * leftmost/topmost pixel satisfying `isRoomBorderPixel` — i.e. by assuming GOLD
 * appears nowhere on the plan except a room's outer wall.
 *
 * That assumption is about to come under pressure: floor materials fill room
 * polygons, and door symbols draw gold leaves and swing arcs. If any catalog
 * colour ever lands inside the gold tolerance band, the scan latches onto a
 * floor instead of a wall and the specs keep passing while asserting against a
 * silently wrong coordinate frame.
 *
 * The primary defence is `src/lib/geomBridge.ts`, which moves the coordinate
 * basis off colour entirely. This test defends the FALLBACK path, and — more
 * usefully — fails loudly the moment someone adds a warm swatch to a catalog,
 * pointing at the real consequence rather than letting it surface as a
 * baffling off-by-hundreds-of-pixels e2e failure weeks later.
 */
import { describe, it, expect } from 'vitest';
import {
  isRoomBorderPixel,
  ROOM_BORDER_SCAN,
  WALL_GOLD,
  WALL_GOLD_BRIGHT,
  DOOR_LEAF,
} from '../blueprintTheme';
import { ECO_FLOORING_CATALOG, ECO_PAINT_PALETTE } from '../../data/paintPalette';
import { FLOOR_MATERIALS } from '../../data/floorMaterials';

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '').trim();
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

describe('ROOM_BORDER_SCAN guard', () => {
  it('matches both gold wall tones (the scan still finds a wall)', () => {
    for (const gold of [WALL_GOLD, WALL_GOLD_BRIGHT]) {
      const [r, g, b] = hexToRgb(gold);
      expect(isRoomBorderPixel(r, g, b), `${gold} should match the wall scan`).toBe(true);
    }
  });

  it('does NOT match any flooring material — a floor fill must never be mistaken for a wall', () => {
    const offenders: string[] = [];
    for (const m of ECO_FLOORING_CATALOG) {
      const [r, g, b] = hexToRgb(m.hex);
      if (isRoomBorderPixel(r, g, b)) offenders.push(`${m.id} (${m.hex})`);
    }
    for (const m of FLOOR_MATERIALS) {
      const [r, g, b] = hexToRgb(m.hex);
      if (isRoomBorderPixel(r, g, b)) offenders.push(`${m.id} (${m.hex})`);
    }
    expect(
      offenders,
      `These floor colours fall inside the gold wall-scan band `
        + `(r>${ROOM_BORDER_SCAN.rMin}, ${ROOM_BORDER_SCAN.gMin}<=g<=${ROOM_BORDER_SCAN.gMax}, `
        + `b<${ROOM_BORDER_SCAN.bMax}). The e2e roomOrigin() fallback would scan the FLOOR `
        + `instead of the wall and silently shift every click coordinate. Either pick a colour `
        + `outside the band, or delete the pixel-scan fallback now that geomBridge exists.`,
    ).toEqual([]);
  });

  it('does NOT match the door symbol colours', () => {
    // A gold-toned leaf or swing arc would be picked up as "the leftmost wall"
    // by the e2e origin fallback, silently shifting every click coordinate.
    const [lr, lg, lb] = hexToRgb(DOOR_LEAF);
    expect(isRoomBorderPixel(lr, lg, lb), `${DOOR_LEAF} must stay outside the wall band`).toBe(false);
    // DOOR_ARC is the same hue at lower alpha; check its solid form too.
    expect(isRoomBorderPixel(242, 228, 206)).toBe(false);
  });

  it('does NOT match any paint swatch', () => {
    const offenders = ECO_PAINT_PALETTE.filter((p) => {
      const [r, g, b] = hexToRgb(p.hex);
      return isRoomBorderPixel(r, g, b);
    }).map((p) => `${p.id} (${p.hex})`);
    expect(offenders, 'Paint swatches must stay outside the gold wall-scan band').toEqual([]);
  });
});
