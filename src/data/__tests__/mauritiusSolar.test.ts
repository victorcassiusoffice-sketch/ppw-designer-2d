/**
 * mauritiusSolar — the PVGIS figures the readout runs on. Pins the internal
 * consistency of the sourced numbers (a typo in one monthly value would
 * silently skew every quote) rather than re-fetching PVGIS.
 */
import { describe, it, expect } from 'vitest';
import {
  MAURITIUS_SOLAR,
  MU_GHI_KWH_M2_DAY_ANNUAL,
  MU_GHI_KWH_M2_DAY_MONTHLY,
  MU_SOLAR_FLAT,
  MU_SOLAR_NORTH_20,
  MU_SOLAR_PVGIS_OPTIMAL,
} from '../mauritiusSolar';
import { annualGenerationKwh, dailyGenerationWh } from '../../designer/solarCalc';

const CASES = [MU_SOLAR_NORTH_20, MU_SOLAR_PVGIS_OPTIMAL, MU_SOLAR_FLAT];

describe('mauritiusSolar — PVGIS 5.3 SARAH3 figures', () => {
  it('every case has twelve monthly values whose mean matches the annual figure', () => {
    for (const c of CASES) {
      expect(c.poaKwhM2DayMonthly).toHaveLength(12);
      expect(c.yieldKwhPerKwpDayMonthly).toHaveLength(12);
      const meanPoa = c.poaKwhM2DayMonthly.reduce((a, b) => a + b, 0) / 12;
      expect(Math.abs(meanPoa - c.poaKwhM2DayAnnual)).toBeLessThan(0.05);
      const meanYield = c.yieldKwhPerKwpDayMonthly.reduce((a, b) => a + b, 0) / 12;
      expect(Math.abs(meanYield * 365.25 - c.yieldKwhPerKwpYear)).toBeLessThan(15);
    }
    expect(MU_GHI_KWH_M2_DAY_MONTHLY).toHaveLength(12);
    expect(Math.abs(MU_GHI_KWH_M2_DAY_MONTHLY.reduce((a, b) => a + b, 0) / 12 - MU_GHI_KWH_M2_DAY_ANNUAL)).toBeLessThan(0.05);
  });

  it('performance ratio is delivered energy over irradiation, ~0.77 in the tropics', () => {
    for (const c of CASES) {
      expect(Math.abs(c.yieldKwhPerKwpYear / c.poaKwhM2Year - c.performanceRatio)).toBeLessThan(0.002);
      expect(c.performanceRatio).toBeGreaterThan(0.7);
      expect(c.performanceRatio).toBeLessThan(0.85);
    }
  });

  it('the readout default (20° north) reproduces PVGIS within 1 % through solarCalc', () => {
    const c = MAURITIUS_SOLAR.default;
    // 1 kWp × 5.17 × 0.775 = 4006 Wh/day vs PVGIS E_d 4.01 kWh/day
    expect(dailyGenerationWh({ wp: 1000, pshHoursPerDay: c.poaKwhM2DayAnnual, performanceRatio: c.performanceRatio })).toBeCloseTo(4006.8, 0);
    const annual = annualGenerationKwh(1000, c.poaKwhM2DayMonthly, c.performanceRatio);
    expect(Math.abs(annual - c.yieldKwhPerKwpYear) / c.yieldKwhPerKwpYear).toBeLessThan(0.01);
  });

  it('north 20° beats flat and the PVGIS "optimal" at this horizon-shaded point', () => {
    expect(MU_SOLAR_NORTH_20.yieldKwhPerKwpYear).toBeGreaterThan(MU_SOLAR_PVGIS_OPTIMAL.yieldKwhPerKwpYear);
    expect(MU_SOLAR_NORTH_20.yieldKwhPerKwpYear).toBeGreaterThan(MU_SOLAR_FLAT.yieldKwhPerKwpYear);
    expect(MAURITIUS_SOLAR.defaultPanelWp).toBe(450);
  });
});
