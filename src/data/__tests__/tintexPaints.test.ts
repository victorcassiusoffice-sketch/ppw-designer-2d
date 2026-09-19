import { describe, expect, it } from 'vitest';
import { TINTEX_BRAND, TINTEX_BRAND_ID, TINTEX_PAINTS } from '../tintexPaints';
import { TINTEX_CARD_CODES, ralToPaintColour, tintexCardFrom } from '../tintexColours';
import ralClassic from '../ralClassic.json';
import {
  FINISH_PBR,
  PAINT_BRANDS,
  PAINT_COLOURS,
  brandHasColourChart,
  brandsWithPaints,
  coloursForPaint,
  findWallPaintById,
  finishOfPaint,
  hexLightness,
  isPaintTintable,
  loadPaintColourChart,
  paintsForBrand,
  primerForBrand,
  resolveWallColourHex,
  tinsForPaintColour,
} from '../wallPaints';

const IDS = ['tintex-vip-satin', 'tintex-mastertop', 'tintex-cashmere', 'tintex-true-white-matt', 'tintex-trade-pro'];

describe('TintEX wall paints (2026-09-19)', () => {
  it('five lines, loaded under the TintEX brand, every one sourced', () => {
    expect(TINTEX_PAINTS.map((p) => p.id)).toEqual(IDS);
    expect(PAINT_BRANDS.some((b) => b.id === TINTEX_BRAND_ID)).toBe(true);
    expect(brandsWithPaints().map((b) => b.id)).toEqual(['sofap', 'tintex']);
    expect(paintsForBrand('tintex')).toHaveLength(5);
    expect(primerForBrand('tintex')).toBeUndefined();
    for (const p of TINTEX_PAINTS) {
      expect(p.brandId).toBe('tintex');
      expect(p.brand).toBe('TintEX');
      expect(p.source_urls?.length ?? 0, p.id).toBeGreaterThanOrEqual(2);
      expect(p.source_urls?.some((u) => u.includes('web.archive.org/web/2021')), `${p.id} prices come from the 2021 shop capture`).toBe(true);
      expect(p.coats_source, p.id).toBeTruthy();
      expect(p.coverage_source, p.id).toBeTruthy();
      expect(findWallPaintById(p.id)).toBe(p);
    }
  });

  it('prices are the 2021 shop capture, flagged as such, VAT unstated', () => {
    for (const p of TINTEX_PAINTS) {
      expect(p.priced_at, p.id).toMatch(/^2021-(09-19|11-27)$/);
      expect(p.vat_inclusive, `${p.id}: the source never states VAT`).toBeUndefined();
      expect(p.price_note, p.id).toMatch(/Wayback/);
      // Tins ascend in size and in price.
      const sizes = p.tins.map((t) => t.sizeL);
      expect(sizes).toEqual([...sizes].sort((a, b) => a - b));
      const prices = p.tins.map((t) => t.priceMur);
      expect(prices).toEqual([...prices].sort((a, b) => a - b));
      // (No per-litre monotonic check: TintEX's own list had the 2.5 L VIP
      // Satin dearer per litre than the 1 L — kept as captured.)
    }
    const vip = findWallPaintById('tintex-vip-satin')!;
    expect(vip.tins).toEqual([
      { sizeL: 1, priceMur: 242 },
      { sizeL: 2.5, priceMur: 662 },
      { sizeL: 5, priceMur: 1076 },
      { sizeL: 20, priceMur: 4227 },
    ]);
    expect(findWallPaintById('tintex-true-white-matt')!.tins[0]).toEqual({ sizeL: 1, priceMur: 161 });
    expect(findWallPaintById('tintex-trade-pro')!.tins).toEqual([
      { sizeL: 5, priceMur: 374 },
      { sizeL: 20, priceMur: 1380 },
    ]);
  });

  it('tint bands: Pastel → Mid-basic → Dark, each dearer than the last per size; Trade Pro is white only', () => {
    for (const p of TINTEX_PAINTS) {
      if (p.id === 'tintex-trade-pro') {
        expect(isPaintTintable(p)).toBe(false);
        expect(p.tintBases).toBeUndefined();
        expect(coloursForPaint(p)).toEqual([]);
        continue;
      }
      const bases = p.tintBases!;
      expect(bases.map((b) => b.id)).toEqual(['pastel', 'medium', 'basic']);
      expect(bases.map((b) => b.minLightness)).toEqual([72, 45, 0]);
      for (let i = 1; i < bases.length; i++) {
        for (const t of bases[i].tins) {
          const paler = bases[i - 1].tins.find((x) => x.sizeL === t.sizeL)!;
          expect(t.priceMur, `${p.id} ${bases[i].id} ${t.sizeL} L`).toBeGreaterThan(paler.priceMur);
        }
      }
    }
    // A pale RAL shade prices on Pastel, a deep one on Dark (estimated from depth: TintEX names no base per colour).
    const vip = findWallPaintById('tintex-vip-satin')!;
    expect(tinsForPaintColour(vip)).toMatchObject({ tins: vip.tins, baseEstimated: false });
    const pale = tinsForPaintColour(vip, '#F1ECE1'); // a pale cream
    expect(pale.base?.id).toBe('pastel');
    expect(pale.tins[0].priceMur).toBe(258);
    const deep = tinsForPaintColour(vip, '#3E3B32'); // a deep olive
    expect(deep.base?.id).toBe('basic');
    expect(deep.tins[0].priceMur).toBe(437);
    // Mastertop's 1 L White was captured above its Pastel — kept as captured, and said so.
    const mt = findWallPaintById('tintex-mastertop')!;
    expect(mt.tins[0].priceMur).toBe(362.6);
    expect(mt.tintBases![0].tins[0].priceMur).toBe(345);
    expect(mt.price_note).toMatch(/362\.60/);
  });

  it('finishes carry TintEX’s own words into the 3D stage: satin / silk / silk / matt / matt', () => {
    expect(TINTEX_PAINTS.map((p) => p.finish)).toEqual(['satin', 'silk', 'silk', 'matt', 'matt']);
    expect(finishOfPaint('tintex-vip-satin')).toBe('satin');
    expect(FINISH_PBR.satin.sheen).toBeGreaterThan(FINISH_PBR.silk.sheen);
    expect(FINISH_PBR.silk.sheen).toBeGreaterThan(FINISH_PBR.matt.sheen);
    expect(FINISH_PBR.matt.sheen).toBe(0);
    expect(FINISH_PBR.satin.roughness).toBeLessThan(FINISH_PBR.matt.roughness);
  });

  it('coverage: quoted where TintEX publishes a yield, flagged as an estimate where it does not', () => {
    const vip = findWallPaintById('tintex-vip-satin')!;
    expect(vip).toMatchObject({ coverage_m2_per_l: 11, coverage_low_m2_per_l: 10, coverage_high_m2_per_l: 12, recommended_coats: 2 });
    expect(vip.coverage_estimated).toBeUndefined();
    expect(findWallPaintById('tintex-mastertop')).toMatchObject({ coverage_m2_per_l: 12, coverage_low_m2_per_l: 11, coverage_high_m2_per_l: 13 });
    expect(findWallPaintById('tintex-true-white-matt')).toMatchObject({ coverage_m2_per_l: 8.5, coverage_low_m2_per_l: 8, coverage_high_m2_per_l: 9 });
    const cashmere = findWallPaintById('tintex-cashmere')!;
    expect(cashmere.coverage_estimated).toBe(true);
    expect(cashmere.coverage_source).toMatch(/^ESTIMATED/);
    const trade = findWallPaintById('tintex-trade-pro')!;
    expect(trade.coverage_estimated).toBe(true);
    expect(trade).toMatchObject({ coverage_m2_per_l: 7, coverage_low_m2_per_l: 6, coverage_high_m2_per_l: 8 });
    for (const p of TINTEX_PAINTS) {
      expect(p.coverage_low_m2_per_l ?? 0, p.id).toBeLessThanOrEqual(p.coverage_m2_per_l);
      expect(p.coverage_high_m2_per_l ?? 99, p.id).toBeGreaterThanOrEqual(p.coverage_m2_per_l);
    }
  });

  it('colours: a 24-shade RAL Classic card on the tintable lines, the whole 216-shade deck on demand, hex marked representative', async () => {
    expect(ralClassic).toHaveLength(216);
    expect(new Set((ralClassic as Array<{ code: string }>).map((r) => r.code)).size).toBe(216);
    const card = tintexCardFrom(ralClassic as Array<{ code: string; name: string; hex: string }>);
    expect(card).toHaveLength(TINTEX_CARD_CODES.length);
    expect(card.length).toBe(24);
    expect(card.every((c) => c.brandId === 'tintex' && c.hexOrigin === 'representative' && c.collection === 'RAL Classic' && /^#[0-9A-F]{6}$/.test(c.hex))).toBe(true);
    expect(card.map((c) => c.code)).toEqual(TINTEX_CARD_CODES);
    // The card is in PAINT_COLOURS, after the Sofap shades, and reaches every tintable line.
    expect(PAINT_COLOURS.filter((c) => c.brandId === 'tintex')).toEqual(card);
    expect(coloursForPaint(findWallPaintById('tintex-vip-satin')!)).toEqual(card);
    expect(coloursForPaint(findWallPaintById('permoglaze-matt-emulsion')!).every((c) => c.brandId === 'sofap')).toBe(true);
    // Most of the card is pale — a wellness room's whites, creams, greys and soft greens.
    expect(card.filter((c) => hexLightness(c.hex) >= 72).length).toBeGreaterThanOrEqual(14);
    // The deck.
    expect(brandHasColourChart('tintex')).toBe(true);
    const deck = await loadPaintColourChart('tintex');
    expect(deck).toHaveLength(216);
    expect(new Set(deck.map((c) => c.id)).size).toBe(216);
    expect(deck.every((c) => c.brandId === 'tintex' && /^RAL \d{4}$/.test(c.code ?? '') && /^#[0-9A-F]{6}$/.test(c.hex))).toBe(true);
    const pureWhite = (ralClassic as Array<{ code: string; name: string; hex: string }>).find((r) => r.code === 'RAL 9010')!;
    expect(deck.find((c) => c.code === 'RAL 9010')).toMatchObject({ id: 'ral-9010', name: 'Pure white', hex: pureWhite.hex.toUpperCase() });
    expect(hexLightness(pureWhite.hex)).toBeGreaterThan(95);
    expect(ralToPaintColour({ code: 'RAL 3000', name: 'Flame red', hex: '#a72920' })).toMatchObject({ id: 'ral-3000', hex: '#A72920', hexOrigin: 'representative' });
    // A RAL tint renders on the wall; a tint on white-only Trade Pro renders as its white.
    expect(resolveWallColourHex('tintex-vip-satin', '#a72920')).toBe('#A72920');
    expect(resolveWallColourHex('tintex-trade-pro', '#a72920')).toBe(findWallPaintById('tintex-trade-pro')!.hex);
  });

  it('the brand names its chart and colour system', () => {
    expect(TINTEX_BRAND).toMatchObject({ id: 'tintex', name: 'TintEX', country: 'MU', chartName: 'RAL Classic' });
    expect(TINTEX_BRAND.colourSystem).toMatch(/RAL K7/);
    expect(TINTEX_BRAND.website).toBe('https://tintexpaint.com');
  });
});
