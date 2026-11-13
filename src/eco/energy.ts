import type { EnergyReport } from '../designer/energy';
import { MAURITIUS_SOLAR } from '../data/mauritiusSolar';
import { places } from './places';
export function annualPower(
  report: Pick<EnergyReport, 'totalWp' | 'loadWhDay' | 'batteryKwh'>,
  placeName?: string,
) {
  const place = places.find((p) => p.name === placeName);
  const specific = place?.yieldKwh ?? MAURITIUS_SOLAR.default.yieldKwhPerKwpYear;
  const generated = (report.totalWp / 1000) * specific,
    used = (report.loadWhDay / 1000) * 365;
  return {
    generated,
    used,
    storage: report.batteryKwh,
    covered: used > 0 ? Math.min(100, (100 * generated) / used) : null,
    specific,
    source: place?.source ?? MAURITIUS_SOLAR.sourceUrl,
    name: place?.name ?? 'Tamarin reference',
  };
}
