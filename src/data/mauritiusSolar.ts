/**
 * Mauritius solar resource (eco / solar 2026-09-04).
 *
 * SOURCED VALUES — PVGIS 5.3 (European Commission JRC), fetched 2026-09-04
 * for Tamarin, Mauritius (20.33°S 57.37°E): radiation database
 * PVGIS-SARAH3 (satellite, 2005–2023), meteo ERA5, DEM-calculated horizon,
 * crystalline-silicon module, 1 kWp, 14 % system loss (PVGIS default:
 * cables, inverter, soiling, mismatch — temperature and angular losses are
 * modelled on top of that).
 *
 *   https://re.jrc.ec.europa.eu/api/v5_3/PVcalc?lat=-20.33&lon=57.37&peakpower=1&loss=14&angle=20&aspect=180&outputformat=json
 *   https://re.jrc.ec.europa.eu/api/v5_3/PVcalc?lat=-20.33&lon=57.37&peakpower=1&loss=14&optimalangles=1&outputformat=json
 *   https://re.jrc.ec.europa.eu/api/v5_3/PVcalc?lat=-20.33&lon=57.37&peakpower=1&loss=14&angle=0&aspect=0&outputformat=json
 *   https://re.jrc.ec.europa.eu/api/v5_3/MRcalc?lat=-20.33&lon=57.37&horirrad=1&outputformat=json
 *
 * (PVGIS 5.2 refuses the point as "over the sea" — the coast is 300 m away;
 * 5.3's SARAH3 grid covers it. Azimuth in PVGIS: 0 = south, ±180 = north.)
 *
 * The readout uses the 20° NORTH-facing case — the Mauritian convention for
 * a tilt frame on a flat concrete slab (tilt ≈ latitude, facing the equator).
 * PVGIS's own "optimal" is 16° at −139° (the Tamarin mountains shade the
 * west, so it leans east) and yields 1.5 % LESS than 20° north here; a flat
 * 0° array yields 4 % less. All three are recorded so the panel can say so.
 *
 * How the numbers feed `designer/solarCalc.ts`:
 *   generation Wh/day = Wp × PSH × PR
 *   PSH = plane-of-array irradiation H(i)_d (kWh/m²/day ≡ hours of 1 kW/m²)
 *   PR  = E_y / H(i)_y — PVGIS's delivered energy over its irradiation, so
 *         every loss PVGIS models (temperature, angle, spectrum, the 14 %)
 *         is inside one ratio: 1462.16 / 1885.83 = 0.775.
 */

export interface SolarCase {
  /** Human label for the panel footer. */
  label: string;
  tiltDeg: number;
  /** Compass facing in words. */
  facing: string;
  /** Plane-of-array irradiation, kWh/m²/day, Jan → Dec. */
  poaKwhM2DayMonthly: readonly number[];
  /** Annual mean of the above. */
  poaKwhM2DayAnnual: number;
  /** PVGIS delivered energy per kWp, kWh/kWp/day, Jan → Dec (14 % loss). */
  yieldKwhPerKwpDayMonthly: readonly number[];
  /** PVGIS annual delivered energy per kWp, kWh/kWp/year. */
  yieldKwhPerKwpYear: number;
  /** PVGIS annual plane-of-array irradiation, kWh/m²/year. */
  poaKwhM2Year: number;
  /** E_y / H(i)_y. */
  performanceRatio: number;
}

/** 20° tilt, facing north (PVGIS aspect 180 → reported −179). */
export const MU_SOLAR_NORTH_20: SolarCase = {
  label: '20° tilt, facing north',
  tiltDeg: 20,
  facing: 'north',
  poaKwhM2DayMonthly: [5.55, 5.57, 5.41, 5.14, 4.68, 4.28, 4.35, 4.72, 5.4, 5.63, 5.56, 5.74],
  poaKwhM2DayAnnual: 5.17,
  yieldKwhPerKwpDayMonthly: [4.22, 4.24, 4.13, 3.99, 3.68, 3.42, 3.48, 3.75, 4.25, 4.37, 4.22, 4.35],
  yieldKwhPerKwpYear: 1462.16,
  poaKwhM2Year: 1885.83,
  performanceRatio: 0.775,
};

/** PVGIS optimal fixed angles for the point (horizon-shaded to the west). */
export const MU_SOLAR_PVGIS_OPTIMAL: SolarCase = {
  label: '16° tilt, PVGIS optimal facing (north-north-east)',
  tiltDeg: 16,
  facing: 'north-north-east',
  poaKwhM2DayMonthly: [5.69, 5.63, 5.36, 4.96, 4.43, 3.99, 4.08, 4.52, 5.26, 5.63, 5.7, 5.96],
  poaKwhM2DayAnnual: 5.1,
  yieldKwhPerKwpDayMonthly: [4.33, 4.29, 4.08, 3.84, 3.48, 3.17, 3.25, 3.58, 4.14, 4.37, 4.32, 4.52],
  yieldKwhPerKwpYear: 1440.29,
  poaKwhM2Year: 1860.48,
  performanceRatio: 0.774,
};

/** Flat on the slab, no tilt frame. */
export const MU_SOLAR_FLAT: SolarCase = {
  label: 'flat on the slab (0°)',
  tiltDeg: 0,
  facing: 'up',
  poaKwhM2DayMonthly: [5.92, 5.7, 5.22, 4.63, 3.95, 3.52, 3.66, 4.19, 5.09, 5.65, 5.85, 6.22],
  poaKwhM2DayAnnual: 4.96,
  yieldKwhPerKwpDayMonthly: [4.51, 4.35, 3.99, 3.59, 3.09, 2.78, 2.9, 3.32, 4.01, 4.39, 4.45, 4.72],
  yieldKwhPerKwpYear: 1401.36,
  poaKwhM2Year: 1811.57,
  performanceRatio: 0.773,
};

/** Global horizontal irradiation (MRcalc, monthly means 2005–2023 ÷ days), kWh/m²/day. */
export const MU_GHI_KWH_M2_DAY_MONTHLY: readonly number[] = [5.92, 5.65, 5.22, 4.63, 3.95, 3.52, 3.66, 4.19, 5.09, 5.65, 5.85, 6.22];
export const MU_GHI_KWH_M2_DAY_ANNUAL = 4.96;

export const MAURITIUS_SOLAR = {
  location: 'Tamarin, Mauritius (20.33°S 57.37°E)',
  source: 'PVGIS 5.3 · PVGIS-SARAH3 2005–2023 · ERA5 · c-Si · 14 % system loss',
  sourceUrl: 'https://re.jrc.ec.europa.eu/pvg_tools/en/',
  fetchedOn: '2026-09-04',
  /** The case the readout assumes. */
  default: MU_SOLAR_NORTH_20,
  cases: [MU_SOLAR_NORTH_20, MU_SOLAR_PVGIS_OPTIMAL, MU_SOLAR_FLAT] as const,
  /** The panel Wp the "add N panels" hint counts in when the plan has none yet. */
  defaultPanelWp: 450,
} as const;
