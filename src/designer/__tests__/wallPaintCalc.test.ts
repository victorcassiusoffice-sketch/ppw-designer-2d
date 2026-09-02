import { describe, expect, it } from 'vitest';
import {
  deriveWallPaintOrders,
  edgeLengthM,
  openingFaceAreaM2,
  paintableEdgeAreaM2,
  tinsForLitres,
} from '../wallPaintCalc';
import { WALL_PAINTS, findWallPaintById } from '../../data/wallPaints';
import type { Opening } from '../openings';

const ROOM_POLY = [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 4 }, { x: 0, y: 4 }];
const door = (edgeIndex: number, widthM = 0.838): Opening => ({
  id: `d${edgeIndex}`,
  edgeIndex,
  offsetM: 1,
  widthM,
  kind: 'door',
  flipFacing: false,
  flipHand: false,
});
const window_ = (edgeIndex: number, widthM = 1.2): Opening => ({
  id: `w${edgeIndex}`,
  edgeIndex,
  offsetM: 2,
  widthM,
  kind: 'window',
  flipFacing: false,
  flipHand: false,
});

describe('wall paint measurement', () => {
  it('edge length reads the polygon', () => {
    expect(edgeLengthM(ROOM_POLY, 0)).toBeCloseTo(5);
    expect(edgeLengthM(ROOM_POLY, 1)).toBeCloseTo(4);
    expect(edgeLengthM(ROOM_POLY, 3)).toBeCloseTo(4);
  });

  it('a door removes width × 2.04 m; a window width × 1.2 m; capped at wall height', () => {
    expect(openingFaceAreaM2(door(0), 2.6)).toBeCloseTo(0.838 * 2.04, 6);
    expect(openingFaceAreaM2(window_(0), 2.6)).toBeCloseTo(1.2 * 1.2, 6);
    // A 1.8 m wall cannot lose a 2.04 m-tall door area.
    expect(openingFaceAreaM2(door(0), 1.8)).toBeCloseTo(0.838 * 1.8, 6);
  });

  it('paintable edge area = length × height − its own openings only', () => {
    const room = { polygon: ROOM_POLY, openings: [door(0), window_(1)] };
    expect(paintableEdgeAreaM2(room, 0, 2.6)).toBeCloseTo(5 * 2.6 - 0.838 * 2.04, 6);
    expect(paintableEdgeAreaM2(room, 1, 2.6)).toBeCloseTo(4 * 2.6 - 1.2 * 1.2, 6);
    // Edge 2 has no openings.
    expect(paintableEdgeAreaM2(room, 2, 2.6)).toBeCloseTo(5 * 2.6, 6);
  });

  it('a wall of doors never quotes negative', () => {
    const room = { polygon: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }], openings: [door(0, 0.9), door(0, 0.9)] };
    expect(paintableEdgeAreaM2(room, 0, 2.0)).toBe(0);
  });

  it('tin fill buys the cheapest whole-tin combination', () => {
    const tins = [
      { sizeL: 1, priceMur: 315 },
      { sizeL: 5, priceMur: 1390 },
      { sizeL: 18, priceMur: 4590 },
    ];
    // 1.2 L → 2×1 L (630), NOT one 5 L (1390).
    expect(tinsForLitres(1.2, tins)).toMatchObject({ totalMur: 630, boughtLitres: 2 });
    // 4.5 L → one 5 L (1390) beats 5×1 L (1575).
    expect(tinsForLitres(4.5, tins)).toMatchObject({ totalMur: 1390, boughtLitres: 5 });
    // 20 L → 18 + 2×1 (5220) beats 18+5 (5980) and 4×5+... variants.
    const f = tinsForLitres(20, tins);
    expect(f.totalMur).toBe(4590 + 2 * 315);
    expect(f.boughtLitres).toBe(20);
    // Zero litres buys nothing.
    expect(tinsForLitres(0, tins).totalMur).toBe(0);
  });

  it('deriveWallPaintOrders: area × coats ÷ coverage → litres → tins, per paint', () => {
    const paint = WALL_PAINTS[0];
    const property = {
      wallHeightM: 2.6,
      rooms: [
        {
          id: 'r1',
          name: 'Room 1',
          polygon: ROOM_POLY,
          openings: [door(0)],
          wallPaint: [
            { edgeIndex: 0, paintId: paint.id },
            { edgeIndex: 2, paintId: paint.id },
          ],
        },
      ],
      walls: [{ a: { x: 6, y: 1 }, b: { x: 8, y: 1 }, paintId: paint.id }],
    };
    const orders = deriveWallPaintOrders(property);
    expect(orders).toHaveLength(1);
    const o = orders[0];
    const expectedArea = (5 * 2.6 - 0.838 * 2.04) + 5 * 2.6 + 2 * 2.6;
    expect(o.areaM2).toBeCloseTo(expectedArea, 6);
    const expectedLitres =
      Math.ceil(((expectedArea * paint.recommended_coats) / paint.coverage_m2_per_l) * 10) / 10;
    expect(o.litres).toBeCloseTo(expectedLitres, 6);
    expect(o.fill.boughtLitres).toBeGreaterThanOrEqual(o.litres);
    expect(o.fill.totalMur).toBeGreaterThan(0);
    expect(o.perRoom.map((p) => p.roomId).sort()).toEqual(['r1', 'walls']);
  });

  it('two paints aggregate into two orders; unknown paint ids are dropped', () => {
    const a = WALL_PAINTS[0].id;
    const b = WALL_PAINTS[1].id;
    const property = {
      wallHeightM: 2.6,
      rooms: [
        {
          id: 'r1', name: 'Room 1', polygon: ROOM_POLY, openings: [],
          wallPaint: [
            { edgeIndex: 0, paintId: a },
            { edgeIndex: 1, paintId: b },
            { edgeIndex: 2, paintId: 'nope' },
          ],
        },
      ],
    };
    const orders = deriveWallPaintOrders(property);
    expect(orders.map((o) => o.paintId).sort()).toEqual([a, b].sort());
  });

  it('no wall height (legacy property, none set) → no orders', () => {
    const property = {
      rooms: [{ id: 'r1', name: 'R', polygon: ROOM_POLY, wallPaint: [{ edgeIndex: 0, paintId: WALL_PAINTS[0].id }] }],
    };
    expect(deriveWallPaintOrders(property)).toEqual([]);
    expect(deriveWallPaintOrders(property, 2.6)).toHaveLength(1);
  });

  it('every catalog paint resolves and has purchasable tins', () => {
    for (const p of WALL_PAINTS) {
      expect(findWallPaintById(p.id)).toBe(p);
      expect(p.tins.length).toBeGreaterThan(0);
      expect(p.coverage_m2_per_l).toBeGreaterThan(0);
      for (const t of p.tins) {
        expect(t.sizeL).toBeGreaterThan(0);
        expect(t.priceMur).toBeGreaterThan(0);
      }
    }
    expect(WALL_PAINTS).toHaveLength(5);
  });
});
