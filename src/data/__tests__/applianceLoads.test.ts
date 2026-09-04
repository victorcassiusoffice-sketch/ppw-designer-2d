/**
 * applianceLoads — the fallback wattage table. What matters is not the
 * individual figures (those are sourced and cited in the file) but that the
 * MATCHER routes every seeded product to the right row: order-sensitive
 * rows resolve correctly, self-powered gear reads 0 W, and the broad terms
 * that were dropped stay dropped (a pool TABLE is not a 2 kW pump).
 */
import { describe, it, expect } from 'vitest';
import { APPLIANCE_LOADS, findApplianceLoad, type ApplianceLoad } from '../applianceLoads';
import { getAllProducts } from '../products';
import { energyRoleOf, productPowerW } from '../../designer/energy';
import type { ProductCategory } from '../products.schema';

const P = (name: string, category: ProductCategory = 'other') => ({ name, category });
const key = (name: string, category: ProductCategory = 'other'): string | null =>
  findApplianceLoad(P(name, category))?.key ?? null;

describe('table shape', () => {
  it('every row is complete, non-negative and cites a source', () => {
    expect(APPLIANCE_LOADS.length).toBeGreaterThan(30);
    const seen = new Set<string>();
    for (const r of APPLIANCE_LOADS) {
      expect(seen.has(r.key), `duplicate key ${r.key}`).toBe(false);
      seen.add(r.key);
      expect(r.match.length).toBeGreaterThan(0);
      expect(r.ratedW).toBeGreaterThanOrEqual(0);
      expect(r.avgW).toBeGreaterThanOrEqual(0);
      expect(r.avgW).toBeLessThanOrEqual(Math.max(r.ratedW, 1) * 1.5);
      expect(r.standbyW).toBeGreaterThanOrEqual(0);
      expect(r.hoursPerDay).toBeGreaterThanOrEqual(0);
      expect(r.hoursPerDay).toBeLessThanOrEqual(24);
      expect(r.source.length).toBeGreaterThan(20);
      for (const t of r.match) expect(t).toBe(t.toLowerCase());
    }
  });
});

describe('order-sensitive matches', () => {
  it('a commercial treadmill outranks the home row, which outranks nothing', () => {
    expect(key('Vision Fitness T600-03 Treadmill', 'fitness')).toBe('treadmill-commercial');
    expect(key('NordicTrack Commercial 2450 Treadmill', 'fitness')).toBe('treadmill');
    expect(key('ProForm Carbon TL Treadmill', 'fitness')).toBe('treadmill');
  });

  it('specific rows beat their broad siblings', () => {
    expect(key('Mini Fridge 90 L')).toBe('mini-fridge');
    expect(key('Samsung French Door Refrigerator')).toBe('refrigerator');
    expect(key('Variable Speed Pool Pump')).toBe('pool-pump-variable');
    expect(key('Hayward Pool Pump 1.5 hp')).toBe('pool-pump');
    expect(key('Harvia Sauna Heater 6 kW', 'sauna')).toBe('sauna-heater');
    expect(key('2-Person Infrared Sauna', 'sauna')).toBe('sauna-infrared');
    expect(key('Hydrow Wave Connected Rower', 'fitness')).toBe('rower-connected');
    expect(key('Concept2 RowErg', 'fitness')).toBe('rower');
    expect(key('Self-Powered Elliptical', 'fitness')).toBe('elliptical-self-powered');
    expect(key('NordicTrack X16 Elliptical', 'fitness')).toBe('elliptical');
  });

  it('self-powered and mechanical gear is explicitly 0 W', () => {
    for (const n of ['Concept2 RowErg', 'Keiser M3i Spin Bike', 'Vision Fitness Smith Machine', 'Adjustable FID Weight Bench', 'EVA Combat Sport Mat', 'Potted Fiddle-Leaf Fig']) {
      const row = findApplianceLoad(P(n, 'fitness'));
      expect(row, n).not.toBeNull();
      expect(row!.avgW, n).toBe(0);
    }
  });

  it('the dropped broad terms cannot mis-hit ordinary furniture', () => {
    expect(key('Slate Pool Table')).not.toBe('pool-pump');
    expect(key('55-inch Flat Screen TV')).toBe('tv');
    expect(key('Oak Wall Unit')).not.toBe('air-conditioner');
  });

  it('returns null for something with no row', () => {
    expect(key('Hand-Thrown Ceramic Vase')).toBeNull();
  });
});

describe('the seeded catalog reads sensibly through the table', () => {
  const bySku = (id: string) => getAllProducts().find((p) => p.id === id)!;

  it('classifies the seed the way a customer would expect', () => {
    const expectations: Array<[string, 'consumer' | 'none' | 'generator' | 'storage' | 'inverter', number?]> = [
      ['k1-nordictrack-2450', 'consumer', 350],
      ['k1-vision-t600-03', 'consumer', 700],
      ['k1-nordictrack-x16', 'consumer', 100],
      ['k1-nordictrack-rw900', 'none'],
      ['k1-vision-smith', 'none'],
      ['k1-bench-adjustable-fid', 'none'],
      ['demo-floor-lamp', 'consumer', 10],
      ['demo-aroma-diffuser', 'consumer', 15],
      ['demo-potted-plant', 'none'],
      ['k1-floor-eva-combat', 'none'],
      ['emcar-jinko-475', 'generator'],
      ['emcar-victron-agm-200', 'storage'],
      ['emcar-victron-multiplus-12-3000', 'inverter'],
      ['emcar-victron-mppt-100-30', 'none'],
    ];
    for (const [id, role, watts] of expectations) {
      const p = bySku(id);
      expect(p, id).toBeTruthy();
      expect(energyRoleOf(p), id).toBe(role);
      if (watts !== undefined) expect(productPowerW(p), id).toBe(watts);
    }
  });

  it('no seeded product is silently given a wild wattage', () => {
    for (const p of getAllProducts()) {
      const w = productPowerW(p);
      expect(w, p.id).toBeGreaterThanOrEqual(0);
      expect(w, p.id).toBeLessThanOrEqual(8000);
    }
  });
});

describe('a custom table still drives the matcher (injection point for tests)', () => {
  it('uses the passed table, not the module one', () => {
    const table: ApplianceLoad[] = [
      { key: 'only', match: ['widget'], ratedW: 5, avgW: 5, standbyW: 0, hoursPerDay: 1, source: 'test fixture row for the injection point' },
    ];
    expect(findApplianceLoad(P('Blue Widget'), table)?.key).toBe('only');
    expect(findApplianceLoad(P('NordicTrack Treadmill'), table)).toBeNull();
  });
});
