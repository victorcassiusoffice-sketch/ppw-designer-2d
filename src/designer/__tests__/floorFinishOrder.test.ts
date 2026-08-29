/**
 * Whole-room floor finish → purchase line (Vic 2026-08-29: "adding the floor
 * … does not calculate the cost and the cart is unaffected").
 *
 * Before this, `roomFloorOrders` returned [] for a room on the finish path,
 * so the cart, checkout and cost badge all read Rs 0 for a floor the plan
 * clearly showed. These pin the contract: a finish is an order.
 */
import { describe, expect, it } from 'vitest';
import { roomFloorOrders, wholeRoomFinishOrder } from '../floorTiles';
import { deriveFloorLines } from '../../store/cartStore';
import type { Property } from '../../store/propertyStore';

const ROOM_5x4 = [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 4 }, { x: 0, y: 4 }];

describe('whole-room floor finish pricing', () => {
  it('a bare room orders nothing', () => {
    expect(roomFloorOrders({ polygon: ROOM_5x4 })).toEqual([]);
    expect(roomFloorOrders({ polygon: ROOM_5x4, floorFinish: null })).toEqual([]);
  });

  it('a tileable finish orders the tiles a full-room paint would (1 x 1 m mats on 5 x 4 = 20)', () => {
    const lines = roomFloorOrders({ polygon: ROOM_5x4, floorFinish: { materialId: 'eva-combat' } });
    expect(lines).toHaveLength(1);
    expect(lines[0].materialId).toBe('eva-combat');
    // 20 whole tiles, no cut tiles, no waste on an exact fit.
    expect(lines[0].order.wholeTiles).toBe(20);
    expect(lines[0].order.cutTiles).toBe(0);
    expect(lines[0].order.unitsToOrder).toBe(20);
    expect(lines[0].order.coveredM2).toBe(20);
  });

  it('a 0.92 m tile on 5 x 4 needs cut tiles + the offcut allowance', () => {
    const [line] = roomFloorOrders({ polygon: ROOM_5x4, floorFinish: { materialId: 'gym-interlock' } });
    // 6 x 5 lattice = 30 tiles touch the room; the last column/row are cut.
    expect(line.order.wholeTiles + line.order.cutTiles).toBe(30);
    expect(line.order.cutTiles).toBeGreaterThan(0);
    expect(line.order.unitsToOrder).toBe(
      line.order.wholeTiles + line.order.cutTiles + Math.ceil(line.order.cutTiles * 0.1),
    );
  });

  it('a roll (no tile size) is ordered by area + 10 % waste in whole rolls', () => {
    const line = wholeRoomFinishOrder({ polygon: ROOM_5x4, floorFinish: { materialId: 'epdm-roll' } });
    expect(line).not.toBeNull();
    // 20 m² x 1.1 = 22 m² / 12.5 m² per roll → 2 rolls.
    expect(line!.order.unitsToOrder).toBe(2);
    expect(line!.order.coveredM2).toBe(20);
  });

  it('legacy eco ids resolve through the same map the renderer uses', () => {
    const [line] = roomFloorOrders({ polygon: ROOM_5x4, floorFinish: { materialId: 'k1-eva-combat-mat' } });
    expect(line.materialId).toBe('eva-combat');
    expect(line.order.unitsToOrder).toBe(20);
  });

  it('painted tiles still win over a finish (the two are mutually exclusive per room)', () => {
    const zone = {
      materialId: 'rubber-composite',
      tileWm: 0.5,
      tileHm: 0.5,
      originM: { x: 0, y: 0 },
      runs: [0, 0, 2],
    };
    const lines = roomFloorOrders({ polygon: ROOM_5x4, floorTiles: [zone], floorFinish: { materialId: 'eva-combat' } });
    expect(lines).toHaveLength(1);
    expect(lines[0].materialId).toBe('rubber-composite');
  });

  it('the cart derives a priced line from a finish', () => {
    const property: Property = {
      id: 'p',
      name: 'P',
      activeRoomId: 'r1',
      rooms: [{ id: 'r1', name: 'Studio', polygon: ROOM_5x4, placedItems: [], floorFinish: { materialId: 'eva-combat' } }],
    };
    const fx = { base: 'MUR', rates: { MUR: 1, USD: 1, EUR: 1, GBP: 1 }, fetchedAt: 0 } as unknown as Parameters<typeof deriveFloorLines>[1];
    const lines = deriveFloorLines(property, fx, 'MUR');
    expect(lines).toHaveLength(1);
    expect(lines[0].unitsToOrder).toBe(20);
    expect(lines[0].lineTotalDisplay).toBe(20 * 850);
  });
});
