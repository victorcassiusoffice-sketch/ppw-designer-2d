/**
 * solarCalc — the PV arithmetic behind the energy readout. Round numbers so
 * every expectation is checkable by hand: 1 kWp x 5 PSH x PR 0.8 = 4 kWh.
 */
import { describe, it, expect } from 'vitest';
import {
  annualBillEffect,
  annualGenerationKwh,
  batteryAutonomyHours,
  batteryKwhForAutonomy,
  coveragePct,
  dailyGenerationWh,
  dailyLoadWh,
  formatW,
  formatWh,
  inverterCoversPeak,
  monthlyGenerationWh,
  panelsToCover,
} from '../solarCalc';

describe('dailyGenerationWh', () => {
  it('Wp x PSH x PR', () => {
    expect(dailyGenerationWh({ wp: 1000, pshHoursPerDay: 5, performanceRatio: 0.8 })).toBe(4000);
    expect(dailyGenerationWh({ wp: 450, pshHoursPerDay: 5.2, performanceRatio: 0.78 })).toBeCloseTo(1825.2, 1);
  });
  it('is NaN-safe and never negative; PR is clamped to 0..1', () => {
    expect(dailyGenerationWh({ wp: NaN, pshHoursPerDay: 5, performanceRatio: 0.8 })).toBe(0);
    expect(dailyGenerationWh({ wp: -5, pshHoursPerDay: 5, performanceRatio: 0.8 })).toBe(0);
    expect(dailyGenerationWh({ wp: 1000, pshHoursPerDay: 5, performanceRatio: 1.7 })).toBe(5000);
  });
});

describe('dailyLoadWh', () => {
  it('W x hours, hours clamped to a day', () => {
    expect(dailyLoadWh(750, 2)).toBe(1500);
    expect(dailyLoadWh(100, 30)).toBe(2400);
    expect(dailyLoadWh(0, 5)).toBe(0);
  });
});

describe('monthly + annual', () => {
  const psh = [6, 6, 5.5, 5, 4.5, 4, 4, 4.5, 5, 5.5, 6, 6];
  it('one daily figure per month', () => {
    const m = monthlyGenerationWh(1000, psh, 0.8);
    expect(m).toHaveLength(12);
    expect(m[0]).toBe(4800);
    expect(m[5]).toBe(3200);
  });
  it('annual kWh = mean daily x 365.25', () => {
    // mean PSH = 5.1667 -> 4133.3 Wh/day -> 1509.7 kWh/yr
    expect(annualGenerationKwh(1000, psh, 0.8)).toBeCloseTo(1509.7, 0);
    expect(annualGenerationKwh(1000, [], 0.8)).toBe(0);
  });
});

describe('panelsToCover', () => {
  it('whole panels, rounded up; zero when covered', () => {
    // 450 Wp x 5 x 0.8 = 1800 Wh per panel
    expect(panelsToCover(1800, 450, 5, 0.8)).toBe(1);
    expect(panelsToCover(1801, 450, 5, 0.8)).toBe(2);
    expect(panelsToCover(0, 450, 5, 0.8)).toBe(0);
    expect(panelsToCover(-100, 450, 5, 0.8)).toBe(0);
    expect(panelsToCover(500, 0, 5, 0.8)).toBe(0);
  });
});

describe('coveragePct', () => {
  it('generation over load, capped at 999, 100 for no load', () => {
    expect(coveragePct(4000, 8000)).toBe(50);
    expect(coveragePct(8000, 4000)).toBe(200);
    expect(coveragePct(1e9, 1)).toBe(999);
    expect(coveragePct(500, 0)).toBe(100);
    expect(coveragePct(0, 0)).toBe(0);
  });
});

describe('battery + inverter', () => {
  it('autonomy hours at average load', () => {
    // 10 kWh x 0.9 DoD = 9000 Wh usable; 2400 Wh/day = 100 W avg -> 90 h
    expect(batteryAutonomyHours(10, 0.9, 2400)).toBe(90);
    expect(batteryAutonomyHours(0, 0.9, 2400)).toBe(0);
    expect(batteryAutonomyHours(10, 0.9, 0)).toBe(0);
  });
  it('battery for N nights of the night share', () => {
    // 6000 Wh/day, 50 % at night, 1 night, DoD 0.8 -> 3000 / 0.8 = 3.75 kWh
    expect(batteryKwhForAutonomy(6000, 0.5, 1, 0.8)).toBe(3.8);
    expect(batteryKwhForAutonomy(0, 0.5, 1, 0.8)).toBe(0);
  });
  it('inverter must carry the simultaneous peak', () => {
    expect(inverterCoversPeak(5, 4800)).toBe(true);
    expect(inverterCoversPeak(3, 4800)).toBe(false);
    expect(inverterCoversPeak(0, 0)).toBe(true);
    expect(inverterCoversPeak(0, 10)).toBe(false);
  });
});

describe('annualBillEffect', () => {
  it('self-consumption is worth the import rate, the rest the export rate', () => {
    const r = annualBillEffect({ generationWhDay: 6000, loadWhDay: 4000, importRatePerKwh: 10, exportRatePerKwh: 2 });
    expect(r.selfConsumedKwhYear).toBeCloseTo(1461, 0);
    expect(r.exportedKwhYear).toBeCloseTo(730.5, 0);
    expect(r.savedPerYear).toBeCloseTo(14610, 0);
    expect(r.exportedPerYear).toBeCloseTo(1461, 0);
  });
});

describe('formatters', () => {
  it('Wh and W read as short chip text', () => {
    expect(formatWh(950)).toBe('950 Wh');
    expect(formatWh(12345)).toBe('12.3 kWh');
    expect(formatW(750)).toBe('750 W');
    expect(formatW(1500)).toBe('1.5 kW');
    expect(formatW(12000)).toBe('12 kW');
    expect(formatWh(NaN)).toBe('0 Wh');
  });
});
