import { describe, expect, it } from 'vitest';
import {
  deriveWallPaintOrders,
  edgeLengthM,
  litresForArea,
  openingFaceAreaM2,
  paintableEdgeAreaM2,
  tinsForLitres,
  wallPaintBreakdown,
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
    // Net litres for the breakdown, and the ordered litres rounded ONCE from
    // the exact need + the 10 % contingency (audit 2026-09-14, R4-06 / #3).
    const expectedNet =
      Math.ceil(((expectedArea * paint.recommended_coats) / paint.coverage_m2_per_l) * 10 - 1e-9) / 10;
    expect(o.netLitres).toBeCloseTo(expectedNet, 6);
    expect(o.wastePct).toBe(10);
    const exact = (expectedArea * 1.1 * paint.recommended_coats) / paint.coverage_m2_per_l;
    expect(o.litres).toBeCloseTo(Math.ceil(exact * 10 - 1e-9) / 10, 6);
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
    expect(WALL_PAINTS.length).toBeGreaterThanOrEqual(5);
    for (const id of ['permoglaze-matt-emulsion', 'permoglaze-soft-feel', 'permoglaze-xtreme-white', 'permoglaze-aquashield', 'permoglaze-anti-fungus']) {
      expect(findWallPaintById(id)?.featured, id).toBe(true);
    }
    expect(new Set(WALL_PAINTS.map((p) => p.id)).size).toBe(WALL_PAINTS.length);
  });
});

describe('wall paint tints (2026-09-14) — one tin serves one colour', () => {
  const paint = WALL_PAINTS[0];

  it('the same product in two tints is two orders; the base colour is a third', () => {
    const property = {
      wallHeightM: 2.7,
      rooms: [
        {
          id: 'r1', name: 'Room 1', polygon: ROOM_POLY, openings: [],
          wallPaint: [
            { edgeIndex: 0, paintId: paint.id, colourHex: '#C9553F', colourName: 'Coral' },
            { edgeIndex: 1, paintId: paint.id, colourHex: '#c9553f' }, // same tint, lower-case
            { edgeIndex: 2, paintId: paint.id, colourHex: '#8FA68A', colourName: 'Sage' },
            { edgeIndex: 3, paintId: paint.id },
          ],
        },
      ],
    };
    const orders = deriveWallPaintOrders(property);
    expect(orders).toHaveLength(3);
    const coral = orders.find((o) => o.colourHex === '#C9553F')!;
    expect(coral.colourName).toBe('Coral');
    expect(coral.areaM2).toBeCloseTo(5 * 2.7 + 4 * 2.7, 6);
    expect(coral.renderHex).toBe('#C9553F');
    const base = orders.find((o) => !o.colourHex)!;
    expect(base.renderHex).toBe(paint.hex);
    expect(base.key).toBe(`${paint.id}|`);
    // Every order fills its own tins — no sharing across colours.
    for (const o of orders) expect(o.fill.boughtLitres).toBeGreaterThanOrEqual(o.litres);
    expect(orders.every((o) => o.surplusLitres >= 0)).toBe(true);
  });

  it('a bad tint hex falls back to the base colour rather than making a new order', () => {
    const property = {
      wallHeightM: 2.7,
      rooms: [
        {
          id: 'r1', name: 'Room 1', polygon: ROOM_POLY,
          wallPaint: [
            { edgeIndex: 0, paintId: paint.id, colourHex: 'red' },
            { edgeIndex: 1, paintId: paint.id },
          ],
        },
      ],
    };
    const orders = deriveWallPaintOrders(property);
    expect(orders).toHaveLength(1);
    expect(orders[0].colourHex).toBeUndefined();
  });

  it('litresForArea rounds UP to 0.1 L and never returns a negative or NaN', () => {
    expect(litresForArea(30.69, 2, 9)).toBeCloseTo(6.9, 9);
    expect(litresForArea(9, 1, 9)).toBe(1);
    expect(litresForArea(0, 2, 9)).toBe(0);
    expect(litresForArea(10, 2, 0)).toBe(0);
    expect(litresForArea(0.01, 2, 9)).toBeCloseTo(0.1, 9);
  });

  it('the breakdown lists every painted face as length × height − openings', () => {
    const property = {
      wallHeightM: 2.7,
      rooms: [
        {
          id: 'r1', name: 'Room 1', polygon: ROOM_POLY, openings: [door(0), window_(0)],
          wallPaint: [
            { edgeIndex: 2, paintId: paint.id },
            { edgeIndex: 0, paintId: paint.id, colourHex: '#C9553F', colourName: 'Coral' },
          ],
        },
      ],
      walls: [{ id: 'fw', a: { x: 6, y: 1 }, b: { x: 8, y: 1 }, paintId: paint.id }],
    };
    const rows = wallPaintBreakdown(property);
    expect(rows.map((r) => r.wallLabel)).toEqual(['Wall 1', 'Wall 3', 'Free wall 1']);
    const w1 = rows[0];
    expect(w1.lengthM).toBeCloseTo(5, 6);
    expect(w1.heightM).toBe(2.7);
    expect(w1.grossM2).toBeCloseTo(13.5, 6);
    expect(w1.openingCount).toBe(2);
    expect(w1.openingsM2).toBeCloseTo(0.838 * 2.04 + 1.2 * 1.2, 6);
    expect(w1.areaM2).toBeCloseTo(13.5 - (0.838 * 2.04 + 1.2 * 1.2), 6);
    expect(w1.colourName).toBe('Coral');
    expect(w1.key).toBe(`${paint.id}|#C9553F`);
    expect(rows[2]).toMatchObject({ kind: 'free', wallId: 'fw', areaM2: 2 * 2.7, openingsM2: 0 });
    // Rows sum to the orders, per key.
    const orders = deriveWallPaintOrders(property);
    for (const o of orders) {
      const sum = rows.filter((r) => r.key === o.key).reduce((a, r) => a + r.areaM2, 0);
      expect(sum).toBeCloseTo(o.areaM2, 6);
    }
  });

  it('tin fill edge cases: tiny jobs, single tin size, equal-price tins, big jobs', () => {
    expect(tinsForLitres(0.05, [{ sizeL: 1, priceMur: 100 }])).toMatchObject({ totalMur: 100, boughtLitres: 1 });
    expect(tinsForLitres(7, [{ sizeL: 5, priceMur: 500 }])).toMatchObject({ totalMur: 1000, boughtLitres: 10 });
    // Two tins, same price: same money buys MORE paint (audit R4-13).
    const f = tinsForLitres(1, [{ sizeL: 1, priceMur: 100 }, { sizeL: 5, priceMur: 100 }]);
    expect(f.boughtLitres).toBe(5);
    expect(f.tins).toHaveLength(1);
    const big = tinsForLitres(450, WALL_PAINTS[0].tins);
    expect(big.boughtLitres).toBeGreaterThanOrEqual(450);
    expect(big.tins[0].sizeL).toBe(20);
  });
});

describe('wall paint audit fixes (2026-09-14, review round 2)', () => {
  const paint = WALL_PAINTS[0];

  it('litres are rounded once: a 5.04 m wall at 3 coats + 10 % needs 5.0 L, not 5.1 L', () => {
    // 5.04 × 2.7 = 13.608 m² × 3 ÷ 9 × 1.1 = 4.99 L → 5.0 L → one 5 L tin.
    const property = {
      wallHeightM: 2.7,
      rooms: [{ id: 'r1', name: 'R', polygon: [{ x: 0, y: 0 }, { x: 5.04, y: 0 }, { x: 5.04, y: 4 }, { x: 0, y: 4 }], wallPaint: [{ edgeIndex: 0, paintId: paint.id }] }],
    };
    const [o] = deriveWallPaintOrders(property);
    expect(o.coats).toBe(3);
    expect(o.litres).toBeCloseTo(5.0, 9);
    expect(o.fill.tins).toEqual([{ sizeL: 5, priceMur: 816.5, count: 1 }]);
  });

  it('the tin fill credits a 0.75 L pack with 0.75 L, never more', () => {
    const f = tinsForLitres(1.6, [{ sizeL: 0.75, priceMur: 100 }, { sizeL: 5, priceMur: 1000 }]);
    expect(f.boughtLitres).toBeGreaterThanOrEqual(1.6);
    expect(f.tins).toEqual([{ sizeL: 0.75, priceMur: 100, count: 3 }]);
    const g = tinsForLitres(0.8, [{ sizeL: 0.75, priceMur: 100 }]);
    expect(g.boughtLitres).toBe(1.5);
  });

  it('a tint stored on a white-only line is priced as the white, one order', () => {
    const xw = findWallPaintById('permoglaze-xtreme-white')!;
    const property = {
      wallHeightM: 2.7,
      rooms: [{ id: 'r1', name: 'R', polygon: ROOM_POLY, wallPaint: [{ edgeIndex: 0, paintId: xw.id, colourHex: '#123456' }, { edgeIndex: 2, paintId: xw.id }] }],
    };
    const orders = deriveWallPaintOrders(property);
    expect(orders).toHaveLength(1);
    expect(orders[0].colourHex).toBeUndefined();
    expect(orders[0].wastePct).toBe(10);
    expect(wallPaintBreakdown(property).every((r) => !r.colourHex)).toBe(true);
  });

  it('bare plaster adds one primer order per brand, one coat at the primer coverage', () => {
    const property = {
      wallHeightM: 2.7,
      wallPaintPrimer: true,
      rooms: [{ id: 'r1', name: 'R', polygon: ROOM_POLY, wallPaint: [{ edgeIndex: 0, paintId: paint.id }, { edgeIndex: 1, paintId: 'permoglaze-soft-feel', colourHex: '#C9553F' }] }],
    };
    const orders = deriveWallPaintOrders(property);
    const primer = orders.filter((o) => o.isPrimer);
    expect(primer).toHaveLength(1);
    expect(primer[0].paintId).toBe('permoglaze-aqua-prime');
    expect(primer[0].coats).toBe(1);
    expect(primer[0].areaM2).toBeCloseTo((5 + 4) * 2.7, 6);
    expect(primer[0].wastePct).toBe(10);
    expect(primer[0].fill.totalMur).toBeGreaterThan(0);
    // The primer sorts last and never appears without the flag.
    expect(orders[orders.length - 1].isPrimer).toBe(true);
    expect(deriveWallPaintOrders({ ...property, wallPaintPrimer: false }).some((o) => o.isPrimer)).toBe(false);
  });

  it('a free wall painted on both faces doubles the area and says so', () => {
    const property = {
      wallHeightM: 2.7,
      rooms: [],
      walls: [{ id: 'fw', a: { x: 0, y: 0 }, b: { x: 3, y: 0 }, paintId: paint.id, paintFaces: 2 }],
    };
    const [row] = wallPaintBreakdown(property);
    expect(row.faces).toBe(2);
    expect(row.grossM2).toBeCloseTo(8.1, 6);
    expect(row.areaM2).toBeCloseTo(16.2, 6);
    expect(deriveWallPaintOrders(property)[0].areaM2).toBeCloseTo(16.2, 6);
  });
});
