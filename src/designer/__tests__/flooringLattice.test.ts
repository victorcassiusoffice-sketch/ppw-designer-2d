import { describe, expect, it } from 'vitest';
import {
  adjacentTileSlots,
  fillLatticeInside,
  isFlooringProduct,
  snapToTileLattice,
  tileLatticeFor,
} from '../flooringLattice';

const ROOM = [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 4 }, { x: 0, y: 4 }];
const TILE = { lengthM: 0.92, widthM: 0.92 };

describe('flooring lattice (Sims-style tiles that fit tight)', () => {
  it('recognises flooring by category only', () => {
    expect(isFlooringProduct({ category: 'flooring' })).toBe(true);
    expect(isFlooringProduct({ category: 'fitness' })).toBe(false);
    expect(isFlooringProduct(undefined)).toBe(false);
  });

  it('with no tile yet, the lattice starts at the inner corner of the room', () => {
    const lat = tileLatticeFor({ productId: 't', fp: TILE, rotationDeg: 0, polygon: ROOM, items: [] });
    expect(lat).toEqual({ originX: 0.05, originY: 0.05, pitchW: 0.92, pitchH: 0.92 });
  });

  it('the first tile of the same product fixes the lattice origin', () => {
    const lat = tileLatticeFor({
      productId: 't',
      fp: TILE,
      rotationDeg: 0,
      polygon: ROOM,
      items: [{ productId: 'other', x: 1, y: 1 }, { productId: 't', x: 0.3, y: 0.7 }],
    });
    expect(lat.originX).toBe(0.3);
    expect(lat.originY).toBe(0.7);
  });

  it('a drop snaps to the nearest cell so neighbours butt up with no gap', () => {
    const lat = { originX: 0.05, originY: 0.05, pitchW: 0.92, pitchH: 0.92 };
    // Roughly one tile to the right of the origin → exactly 0.05 + 0.92.
    expect(snapToTileLattice(1.1, 0.2, lat)).toEqual({ x: 0.97, y: 0.05 });
    // A 0.5 m grid could never produce 0.97.
    expect((0.97 / 0.5) % 1).not.toBe(0);
  });

  it('duplicate slots are exactly one tile away: right, below, left, above', () => {
    expect(adjacentTileSlots({ x: 1, y: 1, w: 0.92, h: 0.92 })).toEqual([
      { x: 1.92, y: 1 },
      { x: 1, y: 1.92 },
      { x: 0.08, y: 1 },
      { x: 1, y: 0.08 },
    ]);
  });

  it('fill lays every whole cell inside the room and skips occupied ones', () => {
    const lat = { originX: 0.05, originY: 0.05, pitchW: 1, pitchH: 1 };
    // Inner 4.9 x 3.9 m fits 4 x 3 whole 1 m tiles.
    const all = fillLatticeInside({ lat, polygon: ROOM, others: [] });
    expect(all).toHaveLength(12);
    const withOne = fillLatticeInside({ lat, polygon: ROOM, others: [{ x: 0.05, y: 0.05, w: 1, h: 1 }] });
    expect(withOne).toHaveLength(11);
    expect(withOne.some((c) => c.x === 0.05 && c.y === 0.05)).toBe(false);
  });
});
