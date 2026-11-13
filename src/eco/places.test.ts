import { describe, it, expect } from 'vitest';
import { annualPower } from './energy';
import { parseProgramme } from './programme';
import { places } from './places';
import { rain, rainReference } from './water';
const example = {
  sites: [
    {
      id: 'a',
      name: 'Example meadow',
      kind: 'wall',
      lanes: ['water'],
      state: 'planned',
      lat: -20.2,
      lon: 57.6,
      place: 'Example north',
      note: '',
    },
    {
      id: 'b',
      name: 'Example ridge',
      kind: 'test panel',
      lanes: ['materials'],
      state: 'observing',
      lat: -20.1,
      lon: 57.55,
      place: 'Example west',
      note: '',
    },
  ],
};
describe('local programme and district energy', () => {
  it('accepts two invented pins, rejects invalid data or duplicates atomically', () => {
    expect(parseProgramme(JSON.stringify(example))).toEqual(example.sites);
    for (const x of [{ lat: 92 }, { lon: null }, { id: 'b' }, { lanes: 'water' }])
      expect(() =>
        parseProgramme(
          JSON.stringify({ sites: [{ ...example.sites[0], ...x }, example.sites[1]] }),
        ),
      ).toThrow();
  });
  it('does not keep unrelated fields from private files', () => {
    expect(
      parseProgramme(JSON.stringify([{ ...example.sites[0], extra: 'discard' }]))[0],
    ).not.toHaveProperty('extra');
  });
  it('uses the selected regional yield, never counts storage as production, and handles zero demand', () => {
    const a = annualPower({ totalWp: 2000, loadWhDay: 10000, batteryKwh: 5 }, 'Moka');
    expect(a.generated).toBeCloseTo(2775.62);
    expect(a.used).toBe(3650);
    expect(a.covered).toBeCloseTo(76.04, 1);
    expect(
      annualPower({ totalWp: 2000, loadWhDay: 0, batteryKwh: 0 }, 'Rodrigues').covered,
    ).toBeNull();
    expect(places).toHaveLength(10);
    for (const p of places) expect(rain[p.region]).toHaveLength(12);
    expect(rainReference('Rodrigues').label).toContain('1971');
  });
});
