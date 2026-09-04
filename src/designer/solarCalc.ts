/**
 * solarCalc — the PV sizing arithmetic (eco / solar 2026-09-04).
 *
 * Vic: "take a solar panel, calculate the output and sun in Mauritius …
 * show if the solar panel is sufficiently providing enough power for the
 * current electrical products … how much energy is surplus or lacking".
 *
 * The textbook rooftop model (NREL PVWatts / IEC 61724 "performance
 * ratio" form), kept deliberately simple because the customer is laying
 * out a room, not commissioning a plant:
 *
 *   daily generation Wh  = sum of panel Wp x PSH x PR
 *   daily load Wh        = sum of appliance W x hours-per-day
 *   net                  = generation - load        (+ surplus, - shortfall)
 *
 * PSH = peak-sun-hours (kWh/m2/day of plane-of-array irradiation — one
 * "hour" of 1000 W/m2 sun); PR = performance ratio, the lump of every loss
 * between the module nameplate and the socket (cell temperature, soiling,
 * wiring, inverter, mismatch). Mauritius figures live in
 * `data/mauritiusSolar.ts` with their sources; this module is pure maths
 * over whatever inputs it is handed, so it is unit-testable with round
 * numbers.
 *
 * Units: watts, watt-hours, hours, kWh only where the name says so.
 */

export interface GenerationInput {
  /** Total installed PV, watt-peak (STC). */
  wp: number;
  /** Peak sun hours per day for the array's plane. */
  pshHoursPerDay: number;
  /** Performance ratio 0..1. */
  performanceRatio: number;
}

/** Daily AC energy from an array, watt-hours. Never negative; NaN-safe. */
export function dailyGenerationWh(input: GenerationInput): number {
  const wp = finitePositive(input.wp);
  const psh = finitePositive(input.pshHoursPerDay);
  const pr = clamp01(input.performanceRatio);
  return round1(wp * psh * pr);
}

/** Daily energy of ONE appliance, watt-hours. */
export function dailyLoadWh(powerW: number, hoursPerDay: number): number {
  return round1(finitePositive(powerW) * clamp(finitePositive(hoursPerDay), 0, 24));
}

/** Twelve daily-generation figures (Wh/day), one per month, Jan to Dec. */
export function monthlyGenerationWh(
  wp: number,
  pshMonthly: readonly number[],
  performanceRatio: number,
): number[] {
  return pshMonthly.map((psh) => dailyGenerationWh({ wp, pshHoursPerDay: psh, performanceRatio }));
}

/** Annual AC energy, kWh, from the monthly daily figures (365.25 days). */
export function annualGenerationKwh(
  wp: number,
  pshMonthly: readonly number[],
  performanceRatio: number,
): number {
  const daily = monthlyGenerationWh(wp, pshMonthly, performanceRatio);
  if (daily.length === 0) return 0;
  const avg = daily.reduce((a, b) => a + b, 0) / daily.length;
  return round1((avg * 365.25) / 1000);
}

/**
 * How many MORE panels of `panelWp` cover a `shortfallWh` daily gap. Zero
 * when there is no gap; whole panels, rounded up.
 */
export function panelsToCover(
  shortfallWh: number,
  panelWp: number,
  pshHoursPerDay: number,
  performanceRatio: number,
): number {
  const gap = finitePositive(shortfallWh);
  if (gap <= 0) return 0;
  const perPanel = dailyGenerationWh({ wp: panelWp, pshHoursPerDay, performanceRatio });
  if (perPanel <= 0) return 0;
  return Math.ceil(gap / perPanel - 1e-9);
}

/**
 * Coverage of the load by generation, as a percentage capped at 999 (a
 * plan with ten panels and one lamp is "covered", not a division blow-up).
 * A zero load with any generation is 100 %; zero and zero is 0 %.
 */
export function coveragePct(generationWh: number, loadWh: number): number {
  const g = finitePositive(generationWh);
  const l = finitePositive(loadWh);
  if (l <= 0) return g > 0 ? 100 : 0;
  return Math.min(999, Math.round((g / l) * 100));
}

/**
 * Battery hours of autonomy at the AVERAGE load: usable kWh (capacity x
 * depth-of-discharge) / (daily load / 24). Zero when there is no load or
 * no battery.
 */
export function batteryAutonomyHours(
  batteryKwh: number,
  depthOfDischarge: number,
  dailyLoadWh: number,
): number {
  const usableWh = finitePositive(batteryKwh) * 1000 * clamp01(depthOfDischarge);
  const avgW = finitePositive(dailyLoadWh) / 24;
  if (usableWh <= 0 || avgW <= 0) return 0;
  return round1(usableWh / avgW);
}

/**
 * Battery needed for `nights` nights of the NIGHT share of the load
 * (`nightFraction` of daily Wh happens after sunset), kWh, allowing for
 * depth-of-discharge. Zero when there is no load.
 */
export function batteryKwhForAutonomy(
  dailyLoadWh: number,
  nightFraction: number,
  nights: number,
  depthOfDischarge: number,
): number {
  const load = finitePositive(dailyLoadWh) * clamp01(nightFraction) * finitePositive(nights);
  const dod = clamp01(depthOfDischarge);
  if (load <= 0 || dod <= 0) return 0;
  return round1(load / dod / 1000);
}

/**
 * Does the inverter carry the PEAK load (every consumer switched on at
 * once)? `inverterKw` 0 = no inverter, which is only "ok" when there is
 * nothing to power.
 */
export function inverterCoversPeak(inverterKw: number, peakLoadW: number): boolean {
  const inv = finitePositive(inverterKw) * 1000;
  const peak = finitePositive(peakLoadW);
  if (peak <= 0) return true;
  return inv >= peak;
}

/**
 * Money at the meter for a year: energy the panels displace is worth the
 * import tariff; what they export is worth the export rate (often lower or
 * zero). Both in the tariff's currency. Simplified: self-consumption is
 * min(generation, load) per day.
 */
export function annualBillEffect(input: {
  generationWhDay: number;
  loadWhDay: number;
  importRatePerKwh: number;
  exportRatePerKwh: number;
}): { savedPerYear: number; exportedPerYear: number; selfConsumedKwhYear: number; exportedKwhYear: number } {
  const g = finitePositive(input.generationWhDay);
  const l = finitePositive(input.loadWhDay);
  const self = Math.min(g, l);
  const exp = Math.max(0, g - l);
  const selfKwh = (self * 365.25) / 1000;
  const expKwh = (exp * 365.25) / 1000;
  return {
    savedPerYear: round1(selfKwh * finitePositive(input.importRatePerKwh)),
    exportedPerYear: round1(expKwh * finitePositive(input.exportRatePerKwh)),
    selfConsumedKwhYear: round1(selfKwh),
    exportedKwhYear: round1(expKwh),
  };
}

/** Format watt-hours as a short "x.x kWh" / "nnn Wh" string for chips. */
export function formatWh(wh: number): string {
  const v = finitePositive(wh);
  if (v >= 1000) return `${(v / 1000).toFixed(1)} kWh`;
  return `${Math.round(v)} Wh`;
}

/** Format watts as "1.5 kW" / "750 W". */
export function formatW(w: number): string {
  const v = finitePositive(w);
  if (v >= 1000) return `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)} kW`;
  return `${Math.round(v)} W`;
}

function finitePositive(n: number): number {
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function clamp01(n: number): number {
  return clamp(Number.isFinite(n) ? n : 0, 0, 1);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
