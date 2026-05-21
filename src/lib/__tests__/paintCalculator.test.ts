/**
 * paintCalculator — Tweak 03 (Phase C) Vitest unit coverage.
 *
 * Per the brief: "m²-to-litre math is unit-tested (Playwright assertion
 *  + a Vitest unit test)." This file is the Vitest half; the Playwright
 *  assertion lives in the catch-all endpoint smoke test once an /api/calc
 *  test suite ships.
 */
import { describe, it, expect } from 'vitest';
import {
  calculatePaint,
  totalWallAreaM2,
  wallAreaM2,
  PAINT_CALC_DEFAULT_COATS,
  PAINT_CALC_DEFAULT_COVERAGE_M2_PER_LITRE,
} from '../paintCalculator';
import {
  DEFAULT_HEIGHT_MM,
  DEFAULT_THICKNESS_MM,
  type WallSegment,
} from '../../store/wallStore';
import { ECO_PAINT_PALETTE } from '../../data/paintPalette';

function makeWall(lengthMm: number, heightMm: number = DEFAULT_HEIGHT_MM): WallSegment {
  return {
    id: `w_${Math.random().toString(36).slice(2)}`,
    start: { x_mm: 0, y_mm: 0 },
    end: { x_mm: lengthMm, y_mm: 0 },
    thickness_mm: DEFAULT_THICKNESS_MM,
    height_mm: heightMm,
    type: 'full',
  };
}

describe('wallAreaM2', () => {
  it('computes area for a 1 m × DEFAULT_HEIGHT wall', () => {
    const w = makeWall(1000); // 1 m long
    expect(wallAreaM2(w)).toBeCloseTo(1 * (DEFAULT_HEIGHT_MM / 1000), 6);
  });

  it('handles a 5 m × 2.7 m wall (brief default)', () => {
    const w = makeWall(5000, 2700);
    expect(wallAreaM2(w)).toBeCloseTo(13.5, 6);
  });

  it('returns 0 for a zero-length wall', () => {
    expect(wallAreaM2(makeWall(0))).toBe(0);
  });
});

describe('totalWallAreaM2', () => {
  it('sums multiple walls', () => {
    const walls = [makeWall(1000), makeWall(2000), makeWall(3000)];
    const sum = totalWallAreaM2(walls);
    expect(sum).toBeCloseTo(6 * (DEFAULT_HEIGHT_MM / 1000), 6);
  });

  it('is 0 for an empty wall set', () => {
    expect(totalWallAreaM2([])).toBe(0);
  });
});

describe('calculatePaint — default 1 L per 10 m² per coat, 2 coats', () => {
  it('uses the brief defaults when no paintId supplied', () => {
    // 10 m² total area = 1 L per coat × 2 coats = 2 L
    // Build walls totalling exactly 10 m².
    // Wall length × height/1000 = area; default height = 2700.
    // Length needed: 10 / 2.7 m = 3.7037… m = 3703.7 mm
    const walls = [makeWall(3704)];
    const result = calculatePaint({ walls });
    expect(result.coats).toBe(PAINT_CALC_DEFAULT_COATS);
    expect(result.total_area_m2).toBeCloseTo(10.0008, 3);
    // 2 coats × ~10 m² ÷ 10 = 2 L
    expect(result.litres_total).toBe(3); // ceil(2.0016)
    expect(result.paint).toBeUndefined();
    expect(result.total_price_mur).toBeUndefined();
  });
});

describe('calculatePaint — with paintId resolves SKU + price', () => {
  it('uses palette coverage + price + default_coats', () => {
    const paint = ECO_PAINT_PALETTE[0]; // Cream Shell — 10 m²/L, 2 coats, 850 MUR/L
    // Build walls for 20 m² area.
    // length = 20 / 2.7 = 7407 mm
    const walls = [makeWall(7407)];
    const result = calculatePaint({ walls, paintId: paint.id });
    expect(result.paint?.id).toBe('cream-shell');
    expect(result.coats).toBe(paint.default_coats);
    expect(result.total_area_m2).toBeCloseTo(20.0, 1);
    // 20 m² × 2 coats / 10 = 4 L (exact on the test fixture).
    expect(result.litres_total).toBe(4);
    expect(result.total_price_mur).toBe(result.litres_total * paint.price_per_litre_mur);
  });

  it('honours coats override', () => {
    const paint = ECO_PAINT_PALETTE[0];
    const walls = [makeWall(7407)]; // ~20 m²
    const result = calculatePaint({ walls, paintId: paint.id, coats: 1 });
    expect(result.coats).toBe(1);
    // 20 m² × 1 / 10 = 2 L
    expect(result.litres_total).toBeGreaterThanOrEqual(2);
    expect(result.litres_total).toBeLessThanOrEqual(3);
  });
});

describe('calculatePaint — edge cases', () => {
  it('zero walls = zero area, zero litres', () => {
    const result = calculatePaint({ walls: [] });
    expect(result.total_area_m2).toBe(0);
    expect(result.litres_total).toBe(0);
  });

  it('unknown paintId falls back to brief defaults', () => {
    const walls = [makeWall(5000)];
    const result = calculatePaint({ walls, paintId: 'nonexistent-paint' });
    expect(result.paint).toBeUndefined();
    expect(result.total_price_mur).toBeUndefined();
    // Should still compute via defaults.
    expect(result.coats).toBe(PAINT_CALC_DEFAULT_COATS);
  });

  it('default coverage is 10 m²/L', () => {
    expect(PAINT_CALC_DEFAULT_COVERAGE_M2_PER_LITRE).toBe(10);
  });

  it('default coats is 2', () => {
    expect(PAINT_CALC_DEFAULT_COATS).toBe(2);
  });
});

describe('calculatePaint — brief acceptance round-trip', () => {
  it('20 m² + Cream Shell → ≥4 L → multiplies to a positive price', () => {
    const walls = [makeWall(7407)]; // ≈ 20 m²
    const result = calculatePaint({ walls, paintId: 'cream-shell' });
    expect(result.litres_total).toBeGreaterThanOrEqual(4);
    expect(result.total_price_mur).toBeGreaterThan(0);
  });
});
