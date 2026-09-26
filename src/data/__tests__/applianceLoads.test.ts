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
      // A row with no terms is a category-only fallback and must say which.
      if (r.match.length === 0) expect(r.category, `${r.key} has no terms and no category`).toBeDefined();
      expect(r.ratedW).toBeGreaterThanOrEqual(0);
      expect(r.avgW).toBeGreaterThanOrEqual(0);
      expect(r.avgW).toBeLessThanOrEqual(Math.max(r.ratedW, 1) * 1.5);
      expect(r.standbyW).toBeGreaterThanOrEqual(0);
      expect(r.hoursPerDay).toBeGreaterThanOrEqual(0);
      expect(r.hoursPerDay).toBeLessThanOrEqual(24);
      expect(r.source.length).toBeGreaterThan(20);
      for (const t of r.match) expect(t).toBe(t.toLowerCase());
      for (const t of r.exclude ?? []) expect(t).toBe(t.toLowerCase());
    }
  });

  it('the connected rower / bike rows sit before their bare self-powered siblings (order matters)', () => {
    const idx = (k: string) => APPLIANCE_LOADS.findIndex((r) => r.key === k);
    expect(idx('rower-connected')).toBeGreaterThanOrEqual(0);
    expect(idx('rower-connected')).toBeLessThan(idx('rower'));
    expect(idx('indoor-bike-connected')).toBeLessThan(idx('indoor-bike'));
    expect(idx('treadmill-commercial')).toBeLessThan(idx('treadmill'));
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
      // E-02 (2026-09-20): the RW900 has a 22-inch HD touchscreen — a
      // connected rower (Hydrow-class draw), not a Concept2-class 0 W one.
      ['k1-nordictrack-rw900', 'consumer', 35],
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

/**
 * Electrics fix (2026-09-20, audit E-02 / E-05): EVERY product in the seed,
 * row by row — the reference key the matcher lands on and the watts the
 * balance will use. Generated by running `findApplianceLoad` over the seed,
 * then hand-checked against the K1 cardio spec sheets: the two NordicTrack /
 * ProForm home treadmills 350 W, the Vision T600 / T600E commercial ones
 * 700 W, the Tour de France + Schwinn 700IC connected bikes 60 W, the X16
 * elliptical 100 W, the RW900 a connected rower (35 W avg / 210 W rated),
 * every strength item 0 W, the demo lamps ~10 W, plants 0 W. Both directions
 * are enforced: a new seed product must be added here, and a row here must
 * still exist in the seed.
 */
describe('the whole seed, row by row (2026-09-20)', () => {
  const EXPECTED: Record<string, [key: string | null, avgW: number]> = {
    'k1-nordictrack-2450': ['treadmill', 350],
    'k1-nordictrack-tour-de-france': ['indoor-bike-connected', 60],
    'k1-nordictrack-gx10': ['indoor-bike', 0],
    'k1-schwinn-700ic': ['indoor-bike-connected', 60],
    'k1-proform-carbon-tl': ['treadmill', 350],
    'k1-nordictrack-x16': ['elliptical', 100],
    'k1-nordictrack-rw900': ['rower-connected', 35],
    'k1-vision-t600-03': ['treadmill-commercial', 700],
    'k1-vision-t600e-02': ['treadmill-commercial', 700],
    'k1-matrix-mg-glute': ['strength-equipment', 0],
    'k1-matrix-versa-adabd': ['strength-equipment', 0],
    'k1-vision-smith': ['strength-equipment', 0],
    'k1-bowflex-xtreme-2se': ['strength-equipment', 0],
    'k1-bench-adjustable-fid': ['strength-equipment', 0],
    'k1-floor-eva-combat': ['accessory', 0],
    'k1-floor-eva-kids': ['accessory', 0],
    'k1-floor-gym-interlock': [null, 0],
    'k1-floor-ifit-vinyl': ['accessory', 0],
    'k1-floor-rubber-interlock': [null, 0],
    'k1-floor-outdoor-rubber-1m': [null, 0],
    'k1-floor-outdoor-rubber-50': [null, 0],
    'k1-floor-epdm-roll': [null, 0],
    'demo-console-table': ['accessory', 0],
    'demo-wall-shelf': ['accessory', 0],
    'demo-wall-mirror': ['accessory', 0],
    'demo-aroma-diffuser': ['diffuser', 15],
    'demo-potted-plant': ['plant', 0],
    'demo-floor-lamp': ['lamp', 10],
    'demo-pendant-light': ['pendant', 10],
    'demo-wall-sconce': ['sconce', 9],
    'demo-garden-tree': ['plant', 0],
    'demo-hedge': ['plant', 0],
    'demo-outdoor-bench': ['strength-equipment', 0],
    // Solar gear carries explicit roles + ratings; the name table is not consulted for its watts.
    'emcar-jinko-475': [null, 0],
    'emcar-victron-175': [null, 0],
    'emcar-sunpower-flex-100': [null, 0],
    'emcar-victron-multiplus-12-3000': [null, 0],
    'emcar-victron-phoenix-12-1200': [null, 0],
    'emcar-victron-superpack-12-100': [null, 0],
    'emcar-victron-agm-200': [null, 0],
    'emcar-victron-mppt-100-30': [null, 0],
    // A water tank stores water, not power: explicit energy_role 'none', no row, 0 W.
    'duraco-water-tank-1000': [null, 0],
  };

  it('every seed product lands on the expected row with the expected watts', () => {
    const products = getAllProducts();
    for (const p of products) {
      const want = EXPECTED[p.id];
      expect(want, `seed product ${p.id} is not in the expected table — add it`).toBeDefined();
      const row = findApplianceLoad(p);
      expect(row?.key ?? null, `${p.id} (${p.name}) row`).toBe(want[0]);
      expect(productPowerW(p), `${p.id} (${p.name}) watts`).toBe(want[1]);
    }
    for (const id of Object.keys(EXPECTED)) {
      expect(products.some((p) => p.id === id), `${id} is expected but no longer in the seed`).toBe(true);
    }
  });

  it('the K1 cardio rows carry the sourced figures (nothing invented)', () => {
    const rowerConnected = APPLIANCE_LOADS.find((r) => r.key === 'rower-connected')!;
    expect(rowerConnected.avgW).toBe(35);
    expect(rowerConnected.ratedW).toBe(210);
    expect(rowerConnected.source).toMatch(/Hydrow/);
    expect(rowerConnected.match).toEqual(expect.arrayContaining(['rw900', 'rw700', 'rw600', 'touchscreen', 'ifit rower']));
    const bikeConnected = APPLIANCE_LOADS.find((r) => r.key === 'indoor-bike-connected')!;
    expect(bikeConnected.avgW).toBe(60);
    expect(bikeConnected.match).toEqual(expect.arrayContaining(['touchscreen', 'ifit', 'indoor bike', 'tour de france']));
  });
});

describe('name-table false hits (2026-09-20, E-05)', () => {
  it('a lighting product reaches the lighting rows before a bare furniture term', () => {
    expect(key('Ceramic Table Lamp', 'lighting')).toBe('lamp');
    expect(findApplianceLoad(P('Ceramic Table Lamp', 'lighting'))!.avgW).toBe(10);
    // …and a lighting product with an unknown name is still one LED bulb.
    expect(key('Nordic Glow', 'lighting')).toBe('lighting-generic');
  });

  it('furniture named after the appliance it holds is 0 W', () => {
    expect(key('Aurum Low TV Cabinet', 'furniture')).toBe('furniture');
    expect(findApplianceLoad(P('Aurum Low TV Cabinet', 'furniture'))!.avgW).toBe(0);
    expect(key('TV Stand Oak', 'furniture')).toBe('furniture');
    expect(key('Samsung TV Unit', 'furniture')).toBe('furniture');
    expect(key('Lamp Table', 'furniture')).toBe('accessory');
    // The television itself still is one.
    expect(key('Samsung 55 inch TV', 'appliance')).toBe('tv');
    expect(key('55-inch Flat Screen TV')).toBe('tv');
  });

  it('flooring named after the machine it goes under is 0 W', () => {
    expect(key('Treadmill Mat', 'flooring')).toBe('accessory');
    expect(findApplianceLoad(P('Treadmill Mat', 'flooring'))!.avgW).toBe(0);
    expect(key('iFIT Vinyl Equipment Mat 36"×72"', 'flooring')).toBe('accessory');
  });

  it('exclusion terms veto a row even outside the passive categories', () => {
    expect(key('Treadmill Cover', 'fitness')).toBeNull();
    expect(key('Treadmill Mat', 'fitness')).toBe('accessory');
    // Whichever 0 W row a "TV Bench" lands on, it is not the television.
    expect(key('TV Bench', 'other')).not.toBe('tv');
    expect(findApplianceLoad(P('TV Bench', 'other'))!.avgW).toBe(0);
  });

  it('the shared connected terms do not cross families', () => {
    expect(key('NordicTrack RW900 Rower', 'fitness')).toBe('rower-connected');
    expect(key('Peloton Bike+ touchscreen', 'fitness')).toBe('indoor-bike-connected');
    expect(key('Hydrow Wave Rower', 'fitness')).toBe('rower-connected');
    // GX 10 stays as it is: the seed notes give no mains draw for it.
    expect(key('NordicTrack GX 10 Recumbent Bike', 'fitness')).toBe('indoor-bike');
    expect(findApplianceLoad(P('NordicTrack GX 10 Recumbent Bike', 'fitness'))!.avgW).toBe(0);
  });

  it('a clearly electrical decor / furniture item still counts', () => {
    expect(key('Aroma Diffuser', 'decor')).toBe('diffuser');
    expect(key('Massage Chair Osaki', 'furniture')).toBe('massage-chair');
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
