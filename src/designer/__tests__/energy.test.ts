/**
 * energy — product roles + the whole-plan balance (eco / solar 2026-09-04).
 *
 * Sun figures are passed in explicitly (5 PSH, PR 0.8 → 1 Wp = 4 Wh/day) so
 * every number here is hand-checkable; the Mauritius constants have their
 * own test.
 */
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_HOURS_PER_DAY,
  energyReport,
  energyRoleOf,
  energyStatusLabel,
  isRoofProduct,
  itemHoursPerDay,
  itemPowerOn,
  productHoursPerDay,
  productPowerW,
  type EnergyProduct,
  type EnergyRoom,
} from '../energy';
import type { ApplianceLoad } from '../../data/applianceLoads';

const TABLE: ApplianceLoad[] = [
  { key: 'treadmill', match: ['treadmill'], ratedW: 2000, avgW: 700, standbyW: 3, hoursPerDay: 1, source: 'test' },
  { key: 'led-lamp', match: ['lamp'], category: 'lighting', ratedW: 12, avgW: 10, standbyW: 0, hoursPerDay: 5, source: 'test' },
  { key: 'rower', match: ['rower'], ratedW: 0, avgW: 0, standbyW: 0, hoursPerDay: 1, source: 'test' },
  { key: 'sauna-any', match: [], category: 'sauna', ratedW: 4500, avgW: 3000, standbyW: 0, hoursPerDay: 1, source: 'test' },
];

const P: Record<string, EnergyProduct> = {
  panel: { name: 'LONGi 450', category: 'solar', pv_wp: 450, placement: 'roof' },
  battery: { name: 'LUNA 5', category: 'solar', battery_kwh: 5 },
  inverter: { name: 'SUN2000 5K', category: 'solar', inverter_kw: 5 },
  treadmill: { name: 'NordicTrack Commercial 2450 Treadmill', category: 'fitness' },
  explicit: { name: 'Big chiller', category: 'other', power_w: 1000, duty_hours_per_day: 3 },
  lamp: { name: 'Arc Floor Lamp', category: 'lighting', emits_light: true },
  rower: { name: 'RW900 Rower', category: 'fitness' },
  sauna: { name: 'Cedar cabin', category: 'sauna' },
  plant: { name: 'Fiddle-leaf fig', category: 'plant' },
  forced: { name: 'Odd thing', category: 'other', power_w: 500, energy_role: 'none' },
};

describe('roles + figures', () => {
  it('classifies by explicit role, then ratings, then the reference table', () => {
    expect(energyRoleOf(P.panel, TABLE)).toBe('generator');
    expect(energyRoleOf(P.battery, TABLE)).toBe('storage');
    expect(energyRoleOf(P.inverter, TABLE)).toBe('inverter');
    expect(energyRoleOf(P.explicit, TABLE)).toBe('consumer');
    expect(energyRoleOf(P.treadmill, TABLE)).toBe('consumer');
    expect(energyRoleOf(P.sauna, TABLE)).toBe('consumer');
    expect(energyRoleOf(P.rower, TABLE)).toBe('none');
    expect(energyRoleOf(P.plant, TABLE)).toBe('none');
    expect(energyRoleOf(P.forced, TABLE)).toBe('none');
  });
  it('watts: explicit power_w wins, else the reference average, else 0', () => {
    expect(productPowerW(P.explicit, TABLE)).toBe(1000);
    expect(productPowerW(P.treadmill, TABLE)).toBe(700);
    expect(productPowerW(P.sauna, TABLE)).toBe(3000);
    expect(productPowerW(P.plant, TABLE)).toBe(0);
  });
  it('hours: explicit, else reference, else the 2 h default; item override wins and clamps to 24', () => {
    expect(productHoursPerDay(P.explicit, TABLE)).toBe(3);
    expect(productHoursPerDay(P.lamp, TABLE)).toBe(5);
    expect(productHoursPerDay(P.plant, TABLE)).toBe(DEFAULT_HOURS_PER_DAY);
    expect(itemHoursPerDay({ hoursPerDay: 8 }, P.treadmill, TABLE)).toBe(8);
    expect(itemHoursPerDay({ hoursPerDay: 40 }, P.treadmill, TABLE)).toBe(24);
    expect(itemHoursPerDay({}, P.treadmill, TABLE)).toBe(1);
  });
  it('switches: powerOn false is off; a light obeys lightOn too', () => {
    expect(itemPowerOn({}, P.treadmill)).toBe(true);
    expect(itemPowerOn({ powerOn: false }, P.treadmill)).toBe(false);
    expect(itemPowerOn({ lightOn: false }, P.lamp)).toBe(false);
    expect(itemPowerOn({ lightOn: false }, P.treadmill)).toBe(true);
  });
  it('roof products are explicit placement or a rated panel in the solar category', () => {
    expect(isRoofProduct(P.panel)).toBe(true);
    expect(isRoofProduct({ category: 'solar', pv_wp: 400 })).toBe(true);
    expect(isRoofProduct(P.battery)).toBe(false);
    expect(isRoofProduct(P.treadmill)).toBe(false);
  });
});

function room(id: string, items: Array<[string, string, Partial<EnergyRoom['placedItems'][number]>?]>, extra: Partial<EnergyRoom> = {}): EnergyRoom {
  return {
    id,
    name: id,
    placedItems: items.map(([instanceId, productId, o]) => ({ instanceId, productId, ...(o ?? {}) })),
    ...extra,
  };
}

const SUN = { pshHoursPerDay: 5, performanceRatio: 0.8 };
const lookup = (id: string) => P[id];

describe('energyReport', () => {
  it('sums generation and load across rooms, levels and outdoors', () => {
    const rooms = [
      room('gym', [['t1', 'treadmill'], ['l1', 'lamp']]),
      room('outdoors', [['s1', 'sauna']], { kind: 'outdoor' }),
      room('roof', [['p1', 'panel'], ['p2', 'panel'], ['p3', 'panel']], { kind: 'roof', levelId: 'roof' }),
    ];
    const r = energyReport({ rooms, productById: lookup, ...SUN, table: TABLE });
    expect(r.panelCount).toBe(3);
    expect(r.totalWp).toBe(1350);
    expect(r.panelsOffRoof).toBe(0);
    // 1350 × 5 × 0.8 = 5400 Wh
    expect(r.generationWhDay).toBe(5400);
    // treadmill 700 × 1 + lamp 10 × 5 + sauna 3000 × 1 = 3750 Wh
    expect(r.loadWhDay).toBe(3750);
    expect(r.peakLoadW).toBe(3710);
    expect(r.netWhDay).toBe(1650);
    expect(r.coveragePct).toBe(144);
    expect(r.status).toBe('covered');
    expect(r.panelsToCover).toBe(0);
    expect(r.consumers.map((c) => c.roomName)).toEqual(['gym', 'gym', 'Outdoors']);
    expect(r.consumers[0].referenceKey).toBe('treadmill');
    expect(energyStatusLabel(r)).toBe('Surplus');
  });

  it('reports a shortfall with the panels needed to close it', () => {
    const rooms = [room('gym', [['s1', 'sauna'], ['t1', 'treadmill']]), room('roof', [['p1', 'panel']], { kind: 'roof' })];
    const r = energyReport({ rooms, productById: lookup, ...SUN, table: TABLE });
    expect(r.generationWhDay).toBe(1800);
    expect(r.loadWhDay).toBe(3700);
    expect(r.netWhDay).toBe(-1900);
    expect(r.coveragePct).toBe(49);
    expect(r.status).toBe('short');
    // 1900 / 1800 per panel → 2 more panels of the plan's 450 Wp
    expect(r.coverPanelWp).toBe(450);
    expect(r.panelsToCover).toBe(2);
    expect(energyStatusLabel(r)).toBe('49% covered');
  });

  it('counts panels placed off the roof but flags them; uses the default panel when there are none', () => {
    const rooms = [room('gym', [['p1', 'panel'], ['t1', 'treadmill']])];
    const r = energyReport({ rooms, productById: lookup, ...SUN, table: TABLE, defaultPanelWp: 400 });
    expect(r.panelsOffRoof).toBe(1);
    expect(r.coverPanelWp).toBe(450);
    const none = energyReport({ rooms: [room('gym', [['t1', 'treadmill']])], productById: lookup, ...SUN, table: TABLE, defaultPanelWp: 400 });
    expect(none.coverPanelWp).toBe(400);
    expect(none.panelsToCover).toBe(1); // 700 Wh / 1600 per 400 Wp panel
    expect(none.status).toBe('short');
  });

  it('honours per-item switches and hour overrides', () => {
    const rooms = [room('gym', [['t1', 'treadmill', { powerOn: false }], ['l1', 'lamp', { lightOn: false }], ['e1', 'explicit', { hoursPerDay: 1 }]])];
    const r = energyReport({ rooms, productById: lookup, ...SUN, table: TABLE });
    expect(r.consumers.map((c) => c.whDay)).toEqual([0, 0, 1000]);
    expect(r.peakLoadW).toBe(1000);
    expect(r.loadWhDay).toBe(1000);
  });

  it('battery autonomy and inverter check', () => {
    const rooms = [
      room('gym', [['e1', 'explicit']]), // 1000 W × 3 h = 3000 Wh, peak 1000 W
      room('plant', [['b1', 'battery'], ['i1', 'inverter']]),
    ];
    const r = energyReport({ rooms, productById: lookup, ...SUN, table: TABLE });
    expect(r.batteryKwh).toBe(5);
    // 5 kWh × 0.9 = 4500 Wh usable; 3000 Wh/day = 125 W avg → 36 h
    expect(r.batteryAutonomyHours).toBe(36);
    expect(r.inverterKw).toBe(5);
    expect(r.inverterOk).toBe(true);
    const weak = energyReport({ rooms: [room('gym', [['s1', 'sauna'], ['i1', 'inverter']])], productById: lookup, ...SUN, table: TABLE });
    expect(weak.inverterOk).toBe(true);
    expect(weak.peakLoadW).toBe(3000);
  });

  it('is "none" on an empty plan and "covered" with panels and no load', () => {
    expect(energyReport({ rooms: [], productById: lookup, ...SUN, table: TABLE }).status).toBe('none');
    const r = energyReport({ rooms: [room('roof', [['p1', 'panel']], { kind: 'roof' })], productById: lookup, ...SUN, table: TABLE });
    expect(r.status).toBe('covered');
    expect(r.coveragePct).toBe(100);
    expect(energyStatusLabel({ status: 'none', netWhDay: 0, coveragePct: 0 })).toBe('No power use yet');
  });

  it('ignores unknown products', () => {
    const r = energyReport({ rooms: [room('gym', [['x', 'ghost']])], productById: lookup, ...SUN, table: TABLE });
    expect(r.consumers).toEqual([]);
    expect(r.status).toBe('none');
  });
});
