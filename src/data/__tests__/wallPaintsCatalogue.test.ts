import { describe, expect, it } from 'vitest';
import {
  PAINT_BRANDS,
  PAINT_COLOURS,
  WALL_PAINTS,
  brandsWithPaints,
  coloursForPaint,
  findPaintColourByHex,
  findWallPaintById,
  hexLightness,
  isPaintTintable,
  loadPaintColourChart,
  normalisePaintColourHex,
  normalisePaintColourName,
  paintsForBrand,
  resolveWallColourHex,
  tinsForPaintColour,
} from '../wallPaints';
import { SOFAP_A_LA_CARTE } from '../sofapColours';
import { tinsForLitres } from '../../designer/wallPaintCalc';

describe('wall-paint catalogue (2026-09-14)', () => {
  it('every product cites a seller date, VAT status and a datasheet coats source', () => {
    for (const p of WALL_PAINTS) {
      expect(p.priced_at, p.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(p.vat_inclusive, p.id).toBe(true);
      expect(p.coats_source, p.id).toBeTruthy();
      expect(p.coverage_low_m2_per_l ?? 0, p.id).toBeLessThanOrEqual(p.coverage_m2_per_l);
      expect(p.coverage_high_m2_per_l ?? 99, p.id).toBeGreaterThanOrEqual(p.coverage_m2_per_l);
      expect(p.tins.map((t) => t.sizeL)).toEqual([...p.tins.map((t) => t.sizeL)].sort((a, b) => a - b));
      for (const b of p.tintBases ?? []) {
        expect(b.tins.length, `${p.id} ${b.id}`).toBeGreaterThan(0);
        // A tint base never costs less than the ready-made white of the same size.
        for (const t of b.tins) {
          const white = p.tins.find((w) => w.sizeL === t.sizeL);
          if (white) expect(t.priceMur, `${p.id} ${b.id} ${t.sizeL} L`).toBeGreaterThanOrEqual(white.priceMur);
        }
      }
    }
  });

  it('brands: Sofap only for now, with products; helpers agree', () => {
    expect(PAINT_BRANDS.map((b) => b.id)).toContain('sofap');
    expect(brandsWithPaints().map((b) => b.id)).toEqual(['sofap']);
    expect(paintsForBrand('sofap')).toHaveLength(WALL_PAINTS.length);
    expect(paintsForBrand('nope')).toEqual([]);
  });

  it('Sofap colours: 72 official-hex à la carte shades, ids unique, all on the tintable lines', () => {
    expect(SOFAP_A_LA_CARTE).toHaveLength(72);
    expect(new Set(SOFAP_A_LA_CARTE.map((c) => c.id)).size).toBe(72);
    expect(SOFAP_A_LA_CARTE.every((c) => c.hexOrigin === 'official' && /^#[0-9A-F]{6}$/.test(c.hex))).toBe(true);
    expect(SOFAP_A_LA_CARTE.filter((c) => c.baseId).length).toBeGreaterThanOrEqual(20);
    expect(PAINT_COLOURS).toEqual(SOFAP_A_LA_CARTE);
    const matt = findWallPaintById('permoglaze-matt-emulsion')!;
    expect(coloursForPaint(matt)).toHaveLength(72);
    const xw = findWallPaintById('permoglaze-xtreme-white')!;
    expect(isPaintTintable(xw)).toBe(false);
    expect(coloursForPaint(xw)).toEqual([]);
  });

  it('the Colour Match chart loads on demand with 1,050 coded shades', async () => {
    const chart = await loadPaintColourChart('sofap');
    expect(chart).toHaveLength(1050);
    expect(chart.every((c) => /^#[0-9A-F]{6}$/.test(c.hex) && c.brandId === 'sofap')).toBe(true);
    expect(chart.filter((c) => c.code).length).toBeGreaterThan(1000);
    expect(new Set(chart.map((c) => c.id)).size).toBe(1050);
    expect(await loadPaintColourChart('nope')).toEqual([]);
  });

  it('tint validation and colour resolution', () => {
    expect(normalisePaintColourHex('#abc')).toBe('#AABBCC');
    expect(normalisePaintColourHex('C9553F')).toBe('#C9553F');
    expect(normalisePaintColourHex('red')).toBeUndefined();
    expect(normalisePaintColourHex(12)).toBeUndefined();
    expect(normalisePaintColourName('  Deep   Jungle ')).toBe('Deep Jungle');
    expect(normalisePaintColourName('')).toBeUndefined();
    expect(normalisePaintColourName('x'.repeat(100))).toHaveLength(80);
    expect(resolveWallColourHex('permoglaze-soft-feel', '#c9553f')).toBe('#C9553F');
    expect(resolveWallColourHex('permoglaze-soft-feel')).toBe(findWallPaintById('permoglaze-soft-feel')!.hex);
    expect(resolveWallColourHex('nope', 'zzz')).toBe('#EDE9DF');
    expect(hexLightness('#FFFFFF')).toBeCloseTo(100, 0);
    expect(hexLightness('#000000')).toBeCloseTo(0, 0);
    expect(hexLightness('#808080')).toBeGreaterThan(50);
    expect(hexLightness('nope')).toBe(100);
  });

  it('a tinted tin is priced on its base: named by Sofap, else estimated from the depth', () => {
    const matt = findWallPaintById('permoglaze-matt-emulsion')!;
    // Ready-made white.
    expect(tinsForPaintColour(matt)).toMatchObject({ tins: matt.tins, baseEstimated: false });
    // Morning Haze — Sofap's own Pastel base from the EP SKU.
    const haze = findPaintColourByHex(matt, '#EDEBDF')!;
    expect(haze.baseId).toBe('pastel');
    const pastel = tinsForPaintColour(matt, haze.hex);
    expect(pastel.base?.id).toBe('pastel');
    expect(pastel.baseEstimated).toBe(false);
    expect(pastel.tins[0].priceMur).toBe(235.75);
    // A custom deep colour: estimated Basic base.
    const deep = tinsForPaintColour(matt, '#2F3B2F');
    expect(deep.base?.id).toBe('basic');
    expect(deep.baseEstimated).toBe(true);
    // A custom mid colour: estimated Medium base.
    const mid = tinsForPaintColour(matt, '#8FA68A');
    expect(mid.base?.id).toBe('medium');
    // A white-only line ignores tints.
    const xw = findWallPaintById('permoglaze-xtreme-white')!;
    expect(tinsForPaintColour(xw, '#2F3B2F').tins).toBe(xw.tins);
    // A named base wins over the estimate.
    expect(tinsForPaintColour(matt, '#2F3B2F', 'pastel').base?.id).toBe('pastel');
  });

  it('the DP tin fill is exact and fast with five pack sizes on a huge job', () => {
    const five = [
      { sizeL: 1, priceMur: 100 },
      { sizeL: 2.5, priceMur: 230 },
      { sizeL: 5, priceMur: 440 },
      { sizeL: 10, priceMur: 860 },
      { sizeL: 20, priceMur: 1600 },
    ];
    const t0 = performance.now();
    const f = tinsForLitres(444.5, five);
    const ms = performance.now() - t0;
    expect(ms).toBeLessThan(200);
    expect(f.boughtLitres).toBeGreaterThanOrEqual(444.5);
    // Exact: never dearer than the obvious covers, and checked against a
    // bounded brute force over the two biggest sizes.
    expect(f.totalMur).toBeLessThanOrEqual(22 * 1600 + 440);
    expect(f.totalMur).toBeLessThanOrEqual(23 * 1600);
    let brute = Infinity;
    for (let n20 = 0; n20 <= 23; n20++) {
      for (let n10 = 0; n10 <= 45; n10++) {
        const rest = 444.5 - n20 * 20 - n10 * 10;
        const small = tinsForLitres(rest, five.slice(0, 3));
        const cost = n20 * 1600 + n10 * 860 + small.totalMur;
        if (cost < brute) brute = cost;
      }
    }
    expect(f.totalMur).toBe(brute);
    // Non-finite input buys nothing.
    expect(tinsForLitres(Number.NaN, five).tins).toEqual([]);
    expect(tinsForLitres(Number.POSITIVE_INFINITY, five).tins).toEqual([]);
  });
});
