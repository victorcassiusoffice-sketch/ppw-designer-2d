/**
 * Designer 3-Bug Fix (2026-05-28) — Bug 2 regression: "items refuse to fit
 * even when the room is big enough".
 *
 * Root cause was the mobile "+ Add to room" path placing every item at the
 * SAME room centre, so the second item always overlapped the first and was
 * rejected. `findFreeSlot` relocates to the nearest open grid slot instead.
 */
import { describe, it, expect } from 'vitest';
import {
  findFreeSlot,
  rectToPolygon,
  isRectInsidePolygon,
  collidesWithAny,
  type PlacedRect,
} from '../geometry';

const ROOM = rectToPolygon({ lengthM: 5, widthM: 4 });

describe('findFreeSlot (Bug 2 — items must fit when there is space)', () => {
  it('returns the preferred slot when it is free', () => {
    const slot = findFreeSlot({ preferredX: 1.5, preferredY: 1.5, w: 1.5, h: 0.65, others: [], polygon: ROOM });
    expect(slot).toEqual({ x: 1.5, y: 1.5 });
  });

  it('relocates the 2nd centre-placed item to a free, non-overlapping, in-bounds slot', () => {
    const w = 1.5;
    const h = 0.65;
    // First item lands at the preferred (room-centre) slot.
    const first = findFreeSlot({ preferredX: 2, preferredY: 1.5, w, h, others: [], polygon: ROOM });
    expect(first).not.toBeNull();
    const firstRect: PlacedRect = { x: first!.x, y: first!.y, w, h };

    // Second item with the SAME preferred point must NOT be rejected — it
    // relocates to a distinct slot that fits and does not overlap the first.
    const second = findFreeSlot({
      preferredX: 2,
      preferredY: 1.5,
      w,
      h,
      others: [{ ...firstRect, instanceId: 'i1' }],
      polygon: ROOM,
    });
    expect(second).not.toBeNull();
    const secondRect: PlacedRect = { x: second!.x, y: second!.y, w, h };

    expect(second).not.toEqual(first);
    expect(isRectInsidePolygon(secondRect, ROOM)).toBe(true);
    expect(collidesWithAny(secondRect, [{ ...firstRect }])).toBe(false);
  });

  it('places a 200×90 cm treadmill inside a 5×4 m room (bbox within bounds)', () => {
    // 200 cm × 90 cm → 2.0 m × 0.9 m footprint.
    const slot = findFreeSlot({ preferredX: 1.5, preferredY: 1.5, w: 2.0, h: 0.9, others: [], polygon: ROOM });
    expect(slot).not.toBeNull();
    expect(isRectInsidePolygon({ x: slot!.x, y: slot!.y, w: 2.0, h: 0.9 }, ROOM)).toBe(true);
  });

  it('returns null only when the footprint genuinely cannot fit the room', () => {
    // 6 m wide footprint cannot fit a 5 m room — honest "won't fit".
    const slot = findFreeSlot({ preferredX: 0, preferredY: 0, w: 6, h: 1, others: [], polygon: ROOM });
    expect(slot).toBeNull();
  });
});
