/**
 * useEnergyReport — the whole-plan energy balance as React state (eco /
 * solar 2026-09-04).
 *
 * One memo over `property.rooms` AND the merchant-catalog generation: every
 * room on every level (outdoors and roof included) through `energyReport`
 * with the Mauritius sun figures. Cheap enough to run on each change — a few
 * hundred items at most.
 *
 * Electrics fix (2026-09-20, audit E-01): on production every merchant
 * product is an `m-<dbId>` id resolved through `apiCatalogAdapter`'s module
 * cache, which fills ASYNCHRONOUSLY after the plan has loaded and then bumps
 * `useCatalogStore`. This memo used to depend on `rooms` only, so a reloaded
 * plan of K1 treadmills read "⚡ 0 Wh" (chip "Surplus" beside a panel that
 * later showed 440 Wh; with no panels the chip never appeared at all). The
 * catalog version is now a dependency, exactly as RoomCanvas / RoomView3D
 * already do for drawing the same items.
 */
import { useMemo } from 'react';
import { usePropertyStore, type Property } from '../store/propertyStore';
import { useCatalogStore } from '../store/catalogStore';
import { getAllProducts, getProductById } from '../data/products';
import type { Product } from '../data/products.schema';
import { MAURITIUS_SOLAR } from '../data/mauritiusSolar';
import { energyReport, isRoofProduct, type EnergyReport } from './energy';
import { panelFootprintM2 } from './solarCalc';
import { roofAreaM2 } from './roof';

export interface CoverPanel {
  /** Wp the "add N panels" hint counts in. */
  wp: number;
  /** Its footprint, m2 (0 = unknown). */
  areaM2: number;
}

/**
 * The panel the "add N × … Wp" hint should name when the plan has none yet:
 * the catalog's LARGEST roof product, so the hint names something the
 * customer can actually pick from the Eco tab (audit E-06 — the old constant
 * said 450 Wp and the catalog sells 475 / 175 / 100). Falls back to the
 * `MAURITIUS_SOLAR` reference figures when the catalog has no roof product.
 */
export function coverPanelFromCatalog(products: readonly Product[]): CoverPanel {
  let best: Product | null = null;
  for (const p of products) {
    if (!isRoofProduct(p)) continue;
    const wp = typeof p.pv_wp === 'number' && Number.isFinite(p.pv_wp) ? p.pv_wp : 0;
    if (wp <= 0) continue;
    if (!best || wp > (best.pv_wp ?? 0)) best = p;
  }
  if (!best) return { wp: MAURITIUS_SOLAR.defaultPanelWp, areaM2: MAURITIUS_SOLAR.defaultPanelAreaM2 };
  const area = panelFootprintM2(best.dimensions_cm);
  return { wp: best.pv_wp as number, areaM2: area > 0 ? area : MAURITIUS_SOLAR.defaultPanelAreaM2 };
}

/** The catalog's cover panel right now (seed + any active merchant demo). */
export function defaultCoverPanel(): CoverPanel {
  return coverPanelFromCatalog(getAllProducts());
}

/** Pure: the report for a property, with the readout's default sun case. */
export function energyReportForProperty(property: Pick<Property, 'rooms'>): EnergyReport {
  const sun = MAURITIUS_SOLAR.default;
  const cover = defaultCoverPanel();
  return energyReport({
    rooms: property.rooms,
    productById: getProductById,
    pshHoursPerDay: sun.poaKwhM2DayAnnual,
    performanceRatio: sun.performanceRatio,
    defaultPanelWp: cover.wp,
    roofAreaM2: roofAreaM2(property),
    coverPanelAreaM2: cover.areaM2,
  });
}

export function useEnergyReport(): EnergyReport {
  const rooms = usePropertyStore((s) => s.property.rooms);
  // The merchant catalog's generation: `m-<id>` products resolve only once
  // it has bumped, so the balance must be re-derived then (E-01).
  const catalogVersion = useCatalogStore((s) => s.version);
  // `catalogVersion` is not read inside the memo: it is the generation of
  // the module cache `getProductById` reads, so it is a real dependency the
  // rule cannot see (same pattern as RoomView3D's solids memo).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => energyReportForProperty({ rooms }), [rooms, catalogVersion]);
}

/** Traffic-light colour for the status dot (paper-theme safe, ≥ 4.5:1 on ink). */
export function energyDotColour(status: EnergyReport['status']): string {
  switch (status) {
    case 'covered':
      return '#79C7AD';
    case 'partial':
      return '#E8B84A';
    case 'short':
      return '#E07A62';
    default:
      return '#B9B3A6';
  }
}
