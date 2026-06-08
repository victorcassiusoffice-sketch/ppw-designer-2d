/**
 * Flooring calculator unit tests (P3-2 flooring arm).
 */
import { describe, it, expect } from 'vitest';
import { calculateFloor, FLOOR_CALC_DEFAULT_WASTE_PCT } from '../floorCalculator';
import { findFloorMaterialById } from '../../data/floorMaterials';

describe('calculateFloor', () => {
  it('returns area + waste only when no material is chosen', () => {
    const r = calculateFloor({ areaM2: 20 });
    expect(r.area_m2).toBe(20);
    expect(r.waste_pct).toBe(FLOOR_CALC_DEFAULT_WASTE_PCT);
    expect(r.effective_area_m2).toBeCloseTo(22, 5); // 20 × 1.10
    expect(r.units_needed).toBe(0);
    expect(r.material).toBeUndefined();
    expect(r.total_price_mur).toBeUndefined();
  });

  it('computes units + price for a 1 m² tile (EVA combat, MUR 850/tile)', () => {
    // 20 m² × 1.10 waste = 22 m² ; 1 m²/tile → 22 tiles × 850 = MUR 18,700
    const r = calculateFloor({ areaM2: 20, materialId: 'eva-combat' });
    expect(r.coverage_m2_per_unit).toBe(1);
    expect(r.units_needed).toBe(22);
    expect(r.unit).toBe('tile');
    expect(r.total_price_mur).toBe(22 * 850);
  });

  it('rounds units UP for a 0.25 m² tile (rubber composite, MUR 500/tile)', () => {
    // 10 m² × 1.10 = 11 m² ; 0.25 m²/tile → 44 tiles
    const r = calculateFloor({ areaM2: 10, materialId: 'rubber-composite' });
    expect(r.units_needed).toBe(44);
    expect(r.total_price_mur).toBe(44 * 500);
  });

  it('honours a custom waste percentage (clamped 0–50)', () => {
    const r0 = calculateFloor({ areaM2: 10, materialId: 'eva-combat', wastePct: 0 });
    expect(r0.units_needed).toBe(10); // exactly 10 m²
    const rHi = calculateFloor({ areaM2: 10, materialId: 'eva-combat', wastePct: 999 });
    expect(rHi.waste_pct).toBe(50); // clamped
    expect(rHi.units_needed).toBe(15); // 10 × 1.5
  });

  it('handles a roll material (EPDM 12.5 m²/roll)', () => {
    // 20 m² × 1.10 = 22 m² ; 12.5 m²/roll → ceil(1.76) = 2 rolls
    const r = calculateFloor({ areaM2: 20, materialId: 'epdm-roll' });
    expect(r.unit).toBe('roll');
    expect(r.units_needed).toBe(2);
    expect(r.total_price_mur).toBe(2 * 13500);
  });

  it('zero / negative area yields zero units', () => {
    expect(calculateFloor({ areaM2: 0, materialId: 'eva-combat' }).units_needed).toBe(0);
    expect(calculateFloor({ areaM2: -5, materialId: 'eva-combat' }).units_needed).toBe(0);
  });

  it('unknown material id falls back to area-only', () => {
    const r = calculateFloor({ areaM2: 20, materialId: 'does-not-exist' });
    expect(r.material).toBeUndefined();
    expect(r.units_needed).toBe(0);
  });

  it('every floor material resolves by id', () => {
    for (const m of ['gym-interlock', 'eva-combat', 'rubber-composite', 'outdoor-1m', 'outdoor-50', 'epdm-roll']) {
      expect(findFloorMaterialById(m)).toBeDefined();
    }
  });
});
