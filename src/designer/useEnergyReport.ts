/**
 * useEnergyReport — the whole-plan energy balance as React state (eco /
 * solar 2026-09-04).
 *
 * One memo over `property.rooms`: every room on every level (outdoors and
 * roof included) through `energyReport` with the Mauritius sun figures.
 * Cheap enough to run on each room change — a few hundred items at most.
 */
import { useMemo } from 'react';
import { usePropertyStore, type Property } from '../store/propertyStore';
import { getProductById } from '../data/products';
import { MAURITIUS_SOLAR } from '../data/mauritiusSolar';
import { energyReport, type EnergyReport } from './energy';

/** Pure: the report for a property, with the readout's default sun case. */
export function energyReportForProperty(property: Pick<Property, 'rooms'>): EnergyReport {
  const sun = MAURITIUS_SOLAR.default;
  return energyReport({
    rooms: property.rooms,
    productById: getProductById,
    pshHoursPerDay: sun.poaKwhM2DayAnnual,
    performanceRatio: sun.performanceRatio,
    defaultPanelWp: MAURITIUS_SOLAR.defaultPanelWp,
  });
}

export function useEnergyReport(): EnergyReport {
  const rooms = usePropertyStore((s) => s.property.rooms);
  return useMemo(() => energyReportForProperty({ rooms }), [rooms]);
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
