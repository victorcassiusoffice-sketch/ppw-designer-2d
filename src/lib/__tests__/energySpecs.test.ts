/**
 * energySpecs — the merchant-page scrape. Snippets modelled on the real
 * pages the 2026-09-04 research pass read (LONGi / JA Solar datasheets,
 * Huawei SUN2000 + LUNA2000, Victron MultiPlus, a NordicTrack treadmill, a
 * sauna heater, an LED lamp).
 */
import { describe, it, expect } from 'vitest';
import { extractEnergySpecs, htmlToText } from '../energySpecs';

describe('htmlToText', () => {
  it('strips scripts, styles and tags; decodes entities; keeps line breaks', () => {
    const t = htmlToText('<html><style>p{}</style><script>x()</script><p>Rated&nbsp;power</p><br><td>450&#160;W</td></html>');
    expect(t).toContain('Rated power');
    expect(t).toContain('450');
    expect(t).not.toContain('x()');
    expect(t).not.toContain('<');
  });
});

describe('extractEnergySpecs — solar panels', () => {
  it('reads Wp from a panel datasheet', () => {
    const r = extractEnergySpecs('LONGi Hi-MO 6 Explorer LR5-54HTH-450M. Maximum Power (Pmax) 450 Wp. Module efficiency 23.0 %. Dimensions 1722×1134×30 mm. Weight 21.5 kg. 25 year warranty.');
    expect(r.pvWp).toBe(450);
    expect(r.powerW).toBeUndefined();
    expect(r.evidence[0]).toMatch(/pvWp/);
  });
  it('reads "Rated power 455 W" as a panel when the words say panel', () => {
    const r = extractEnergySpecs('JA Solar DeepBlue 4.0 Pro mono half-cut module. Rated Power (Pmax) 455 W, open-circuit voltage 41.2 V. Rs 9,500.');
    expect(r.pvWp).toBe(455);
  });
  it('ignores a Wp outside the plausible module range', () => {
    const r = extractEnergySpecs('System size 5000 Wp array of panels.');
    expect(r.pvWp).toBeUndefined();
  });
});

describe('extractEnergySpecs — batteries', () => {
  it('reads kWh', () => {
    const r = extractEnergySpecs('Huawei LUNA2000-5-S0 battery module, usable energy 5 kWh, LiFePO4, 10 year warranty.');
    expect(r.batteryWh).toBe(5000);
  });
  it('reads V × Ah', () => {
    const r = extractEnergySpecs('Pylontech US5000 lithium battery 48V 100Ah for Victron systems.');
    expect(r.batteryWh).toBe(4800);
  });
  it('does not mistake a daily yield for storage', () => {
    const r = extractEnergySpecs('This 3 kW system generates about 12 kWh per day in Mauritius.');
    expect(r.batteryWh).toBeUndefined();
    expect(r.inverterW).toBeUndefined();
  });
});

describe('extractEnergySpecs — inverters', () => {
  it('reads kW with inverter context', () => {
    const r = extractEnergySpecs('Huawei SUN2000-5KTL-L1 single-phase hybrid inverter, rated AC output 5 kW, max efficiency 98.4 %.');
    expect(r.inverterW).toBe(5000);
    expect(r.powerW).toBeUndefined();
  });
  it('reads VA', () => {
    const r = extractEnergySpecs('Victron MultiPlus-II 48/3000/35-32 inverter/charger 3000VA, 2400 W continuous.');
    expect(r.inverterW).toBe(3000);
  });
});

describe('extractEnergySpecs — appliances', () => {
  it('reads a kW motor', () => {
    const r = extractEnergySpecs('NordicTrack Commercial 2450 treadmill. Motor: 3.6 CHP. Power consumption 1.5 kW. Weight 138 kg. Rs 150,000.');
    expect(r.powerW).toBe(1500);
    expect(r.pvWp).toBeUndefined();
  });
  it('converts horsepower when nothing better is on the page', () => {
    const r = extractEnergySpecs('ProForm Carbon TL treadmill with 2.75 CHP motor.');
    expect(r.powerW).toBe(Math.round(2.75 * 746));
    expect(r.evidence[0]).toMatch(/hp × 746/);
  });
  it('reads small wattages (a lamp)', () => {
    const r = extractEnergySpecs('Arc floor lamp, 12 W LED, warm white, 160 cm tall.');
    expect(r.powerW).toBe(12);
  });
  it('reads a sauna heater', () => {
    const r = extractEnergySpecs('Harvia electric sauna heater 6 kW, 400 V, for rooms 5–9 m³.');
    expect(r.powerW).toBe(6000);
  });
  it('returns nothing for a plant', () => {
    const r = extractEnergySpecs('Potted fiddle-leaf fig, 90 cm, ceramic pot. Rs 1,800.');
    expect(r).toEqual({ evidence: [] });
  });
});
