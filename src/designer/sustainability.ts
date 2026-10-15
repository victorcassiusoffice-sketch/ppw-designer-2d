/** Evidence-led screening, not an assembly simulation, LCA certification or design approval.
 * SI units throughout. Missing inputs remain null rather than becoming a green score.
 * Research, scope and primary sources: docs/SUSTAINABILITY-RESEARCH-2026-10-15.md.
 */
export type ScreeningStatus = 'screened' | 'needs-data' | 'invalid';
const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const positive = (value: unknown): value is number => finite(value) && value > 0;
const nonnegative = (value: unknown): value is number => finite(value) && value >= 0;
const evidence = (value?: string): boolean => Boolean(value?.trim());
const bounded = (value: unknown, low: number, high: number): value is number =>
  finite(value) && value >= low && value <= high;

export interface HygrothermalInput {
  airTemperatureC?: number;
  relativeHumidityPct?: number;
  surfaceTemperatureC?: number;
  materialName?: string;
  exposureHours?: number;
  mouldThreshold?: { surfaceRhPct: number; minimumExposureHours: number; source: string };
  drying?: {
    initialMoisturePct: number;
    targetMoisturePct: number;
    /** Percentage points of moisture content per day, not percent of the remaining water. */
    percentagePointsPerDay: number;
    source: string;
    /** An assessor must confirm the test rate matches material, thickness and site conditions. */
    conditionsMatch: boolean;
  };
}
export interface HygrothermalResult {
  status: ScreeningStatus;
  dewPointC: number | null;
  surfaceRhPct: number | null;
  condensation: 'possible' | 'not-at-entered-conditions' | 'unknown';
  mouldReview: 'threshold-exceeded' | 'below-entered-threshold' | 'needs-evidence';
  dryingDays: number | null;
  warnings: string[];
}

/** WMO water-vapour Magnus approximation as documented by Vaisala AWS810.
 * This tropical screening implementation deliberately limits temperatures to 0–60°C.
 * Surface RH assumes the same vapour pressure as the entered adjacent air.
 * Supersaturation is reported as condensation; RH is capped at 100%.
 */
export function screenHygrothermal(input: HygrothermalInput): HygrothermalResult {
  const out: HygrothermalResult = {
    status: 'needs-data',
    dewPointC: null,
    surfaceRhPct: null,
    condensation: 'unknown',
    mouldReview: 'needs-evidence',
    dryingDays: null,
    warnings: [
      'A single condition cannot establish mould safety or interstitial condensation. Use local hourly climate, assembly layers, rain and material test data for professional review.',
    ],
  };
  const { airTemperatureC: t, relativeHumidityPct: rh, surfaceTemperatureC: ts } = input;
  const climatePresent = t != null && rh != null;
  if (climatePresent && (!bounded(t, 0, 60) || !bounded(rh, Number.MIN_VALUE, 100))) {
    out.status = 'invalid';
    out.warnings.push(
      'Enter air temperature from 0 to 60°C and relative humidity greater than 0 and at most 100%.',
    );
  } else if (climatePresent && finite(t) && finite(rh)) {
    const gamma = Math.log(rh) - Math.log(100) + (17.62 * t) / (243.12 + t);
    out.dewPointC = (243.12 * gamma) / (17.62 - gamma);
    if (ts != null && !bounded(ts, 0, 60)) {
      out.status = 'invalid';
      out.warnings.push('Enter surface temperature from 0 to 60°C for this water-vapour screen.');
    } else if (finite(ts)) {
      const ratio = rh * Math.exp((17.62 * t) / (243.12 + t) - (17.62 * ts) / (243.12 + ts));
      out.surfaceRhPct = Math.min(100, ratio);
      out.condensation = ts <= out.dewPointC + 1e-10 ? 'possible' : 'not-at-entered-conditions';
      out.status = 'screened';
      if (ratio >= 80)
        out.warnings.push(
          'Elevated surface humidity requires moisture review; 80% RH is a review trigger, not a universal material threshold or an ASHRAE compliance test.',
        );
    } else out.warnings.push('Measure or model the surface temperature to screen condensation.');
  } else
    out.warnings.push(
      'Enter measured air temperature and relative humidity. No Mauritius-wide default climate is assumed.',
    );

  const threshold = input.mouldThreshold;
  if (
    threshold &&
    (!bounded(threshold.surfaceRhPct, Number.MIN_VALUE, 100) ||
      !positive(threshold.minimumExposureHours))
  ) {
    out.status = 'invalid';
    out.warnings.push(
      'Material threshold needs valid surface RH and a positive exposure duration.',
    );
  } else if (input.exposureHours != null && !nonnegative(input.exposureHours)) {
    out.status = 'invalid';
    out.warnings.push('Exposure duration must be a finite nonnegative number of hours.');
  } else if (
    threshold &&
    evidence(threshold.source) &&
    out.surfaceRhPct != null &&
    nonnegative(input.exposureHours)
  ) {
    out.mouldReview =
      out.surfaceRhPct >= threshold.surfaceRhPct &&
      input.exposureHours >= threshold.minimumExposureHours
        ? 'threshold-exceeded'
        : 'below-entered-threshold';
    out.warnings.push(
      'Comparison uses the entered material test threshold and duration only; below threshold does not demonstrate absence of mould.',
    );
  } else
    out.warnings.push(
      'A sourced material-specific threshold and exposure history are required for a material threshold comparison.',
    );

  const d = input.drying;
  if (d) {
    if (
      !nonnegative(d.initialMoisturePct) ||
      !nonnegative(d.targetMoisturePct) ||
      !positive(d.percentagePointsPerDay)
    ) {
      out.status = 'invalid';
      out.warnings.push(
        'Drying needs nonnegative moisture readings and a positive measured percentage-point rate.',
      );
    } else if (!evidence(d.source) || !d.conditionsMatch) {
      out.warnings.push(
        'Drying time is withheld until a sourced test rate matches this material, thickness, moisture basis and site conditions.',
      );
    } else {
      out.dryingDays =
        Math.max(0, d.initialMoisturePct - d.targetMoisturePct) / d.percentagePointsPerDay;
      if (!finite(out.dryingDays)) {
        out.dryingDays = null;
        out.status = 'invalid';
        out.warnings.push('Drying projection exceeds finite numeric bounds.');
      }
      out.warnings.push(
        'Drying is a constant-rate planning projection only. Verify changing rates, rain rewetting, equilibrium moisture and enclosure readiness on site.',
      );
    }
  }
  return out;
}

export type CarbonUnit = 'kg' | 'm' | 'm2' | 'm3' | 'L' | 'item';
export interface CarbonDeclaration {
  kgCo2ePerUnit: number;
  unit: CarbonUnit;
  /** Exact declared life-cycle scope, e.g. A1-A3. Module D must remain separate. */
  boundary: string;
  source: string;
}
export interface CarbonConversion {
  densityKgM3?: number;
  thicknessM?: number;
  massKgPerItem?: number;
  areaM2PerItem?: number;
  volumeM3PerItem?: number;
  source: string;
}
export interface ComponentCarbonInput {
  id: string;
  quantity: number;
  unit: CarbonUnit;
  declaration?: CarbonDeclaration;
  conversion?: CarbonConversion;
}
export interface ComponentCarbonResult {
  id: string;
  status: ScreeningStatus;
  kgCo2e: number | null;
  declaredQuantity: number | null;
  boundary: string | null;
  warnings: string[];
}
const carbonUnits: readonly string[] = ['kg', 'm', 'm2', 'm3', 'L', 'item'];

/** Only dimensionally justified conversions; no generic density, thickness or per-item mass. */
export function convertCarbonQuantity(
  quantity: number,
  from: CarbonUnit,
  to: CarbonUnit,
  conversion?: CarbonConversion,
): number | null {
  if (!nonnegative(quantity) || !carbonUnits.includes(from) || !carbonUnits.includes(to))
    return null;
  if (from === to) return quantity;
  // SI volume scaling needs no material assumption or supplier density.
  if (from === 'L' && to === 'm3') return quantity / 1000;
  if (from === 'm3' && to === 'L') return finite(quantity * 1000) ? quantity * 1000 : null;
  if (!conversion || !evidence(conversion.source)) return null;
  const c = conversion;
  // Keep exactly one explicit conversion path. Conflicting alternative attributes are not averaged.
  const factor: Partial<Record<CarbonUnit, Partial<Record<CarbonUnit, number>>>> = {
    kg: {},
    m: {},
    m2: {},
    m3: {},
    L: {},
    item: {},
  };
  const pair = (a: CarbonUnit, b: CarbonUnit, value?: number) => {
    if (positive(value)) {
      factor[a]![b] = value;
      factor[b]![a] = 1 / value;
    }
  };
  pair('m3', 'kg', c.densityKgM3);
  if (positive(c.densityKgM3)) pair('L', 'kg', c.densityKgM3 / 1000);
  pair('m2', 'm3', c.thicknessM);
  pair('item', 'kg', c.massKgPerItem);
  pair('item', 'm2', c.areaM2PerItem);
  pair('item', 'm3', c.volumeM3PerItem);
  const direct = factor[from]?.[to];
  if (direct != null) return Number.isFinite(quantity * direct) ? quantity * direct : null;
  // Area to mass (and reverse) is the only inferred two-step geometry conversion.
  if (from === 'm2' && to === 'kg' && positive(c.thicknessM) && positive(c.densityKgM3)) {
    const result = quantity * c.thicknessM * c.densityKgM3;
    return Number.isFinite(result) ? result : null;
  }
  if (from === 'kg' && to === 'm2' && positive(c.thicknessM) && positive(c.densityKgM3)) {
    const result = quantity / c.thicknessM / c.densityKgM3;
    return Number.isFinite(result) ? result : null;
  }
  return null;
}

export function calculateComponentCarbon(input: ComponentCarbonInput): ComponentCarbonResult {
  const result: ComponentCarbonResult = {
    id: input.id,
    status: 'needs-data',
    kgCo2e: null,
    declaredQuantity: null,
    boundary: null,
    warnings: [],
  };
  if (!nonnegative(input.quantity) || !carbonUnits.includes(input.unit)) {
    return {
      ...result,
      status: 'invalid',
      warnings: ['Quantity must be finite and nonnegative, with an explicit supported unit.'],
    };
  }
  const d = input.declaration;
  if (!d || !evidence(d.source) || !evidence(d.boundary)) {
    return {
      ...result,
      warnings: [
        'Attach a product declaration, declared unit, GWP factor and exact life-cycle boundary. Missing carbon is unknown, not zero.',
      ],
    };
  }
  if (!finite(d.kgCo2ePerUnit) || !carbonUnits.includes(d.unit)) {
    return {
      ...result,
      status: 'invalid',
      warnings: ['Carbon factor and declared unit must be valid.'],
    };
  }
  const quantity = convertCarbonQuantity(input.quantity, input.unit, d.unit, input.conversion);
  if (quantity == null)
    return {
      ...result,
      warnings: [
        'Units differ. Add sourced conversion dimensions or mass; a metre of wall is not automatically a square metre or kilogram.',
      ],
    };
  const total = quantity * d.kgCo2ePerUnit;
  if (!finite(total))
    return {
      ...result,
      status: 'invalid',
      warnings: ['Carbon calculation exceeds finite numeric bounds.'],
    };
  return {
    ...result,
    status: 'screened',
    kgCo2e: total,
    declaredQuantity: quantity,
    boundary: d.boundary.trim(),
    warnings: [
      'Result covers only the entered declaration scope. Check declared service life, EPD validity, product equivalence and replacements before comparison.',
      ...(d.kgCo2ePerUnit < 0
        ? [
            'A negative declared factor may include biogenic storage. It does not establish permanent removal or whole-life carbon negativity.',
          ]
        : []),
    ],
  };
}

export interface ComponentCarbonSummary {
  componentCount: number;
  coveredComponentCount: number;
  coveragePct: number;
  totalsByBoundary: Record<string, number>;
  /** Withheld if any component is unknown or life-cycle scopes differ. */
  completeComparableTotalKgCo2e: number | null;
  warnings: string[];
}
export function summarizeComponentCarbon(
  results: readonly ComponentCarbonResult[],
): ComponentCarbonSummary {
  const totalsByBoundary: Record<string, number> = Object.create(null) as Record<string, number>;
  let covered = 0;
  const ids = new Set<string>();
  let duplicate = false;
  for (const r of results) {
    if (ids.has(r.id)) duplicate = true;
    ids.add(r.id);
    if (r.status === 'screened' && finite(r.kgCo2e) && r.boundary) {
      totalsByBoundary[r.boundary] = (totalsByBoundary[r.boundary] ?? 0) + r.kgCo2e;
      covered++;
    }
  }
  const overflow = Object.values(totalsByBoundary).some((value) => !finite(value));
  if (duplicate || overflow) {
    // Do not expose doubled or infinite subtotals even when the overall total is withheld.
    for (const key of Object.keys(totalsByBoundary)) delete totalsByBoundary[key];
  }
  const scopes = Object.keys(totalsByBoundary);
  const sum = scopes.length === 1 ? totalsByBoundary[scopes[0]] : null;
  return {
    componentCount: results.length,
    coveredComponentCount: covered,
    coveragePct: results.length ? (100 * covered) / results.length : 0,
    totalsByBoundary,
    completeComparableTotalKgCo2e:
      !duplicate && !overflow && covered === results.length && results.length > 0 && finite(sum)
        ? sum
        : null,
    warnings: [
      'Coverage counts component records, not their mass, area, cost or environmental importance. Scope totals are subtotals, not whole-life totals.',
      ...(scopes.length > 1
        ? ['Life-cycle boundaries differ; no combined total is reported.']
        : []),
      ...(duplicate
        ? [
            'Duplicate component IDs prevent a complete total. Remove duplicate records before reporting.',
          ]
        : []),
      ...(overflow ? ['Carbon subtotals exceed finite numeric bounds and are withheld.'] : []),
    ],
  };
}

export type MaterialOrigin = 'mauritius-made' | 'import-candidate' | 'local-research' | 'unknown';
export interface MaterialSourceCandidate {
  id: string;
  name: string;
  materialFamilies: string[];
  origin: MaterialOrigin;
  evidenceUrl?: string;
  evidenceDate?: string;
  evidenceNote: string;
  /** Not inferred from a catalogue or local manufacture. */
  confirmedDeliveryDate?: string;
  deliveryEvidence?: string;
  /** Engineering equivalence must be confirmed externally; never inferred from the family name. */
  approvedUses?: string[];
}
export interface MaterialSourceRequest {
  materialFamily: string;
  intendedUse?: string;
  neededBy?: string;
}
export interface MaterialSourceMatch extends MaterialSourceCandidate {
  availability: 'delivery-confirmed' | 'catalogue-only' | 'research-only' | 'unverified';
  timing: 'on-time' | 'late' | 'unknown';
  useMatch: 'documented' | 'needs-review';
  warnings: string[];
}
const validDate = (value?: string): value is string => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const t = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === value;
};
export function matchMaterialSources(
  request: MaterialSourceRequest,
  candidates: readonly MaterialSourceCandidate[],
): MaterialSourceMatch[] {
  const family = request.materialFamily.trim().toLocaleLowerCase();
  if (!family) return [];
  return candidates
    .filter((c) => c.materialFamilies.some((f) => f.toLocaleLowerCase() === family))
    .map<MaterialSourceMatch>((c) => {
      const hasEvidence = evidence(c.evidenceUrl);
      const confirmed =
        c.origin !== 'local-research' &&
        hasEvidence &&
        validDate(c.confirmedDeliveryDate) &&
        evidence(c.deliveryEvidence);
      const availability: MaterialSourceMatch['availability'] =
        c.origin === 'local-research'
          ? 'research-only'
          : confirmed
            ? 'delivery-confirmed'
            : hasEvidence && c.origin !== 'unknown'
              ? 'catalogue-only'
              : 'unverified';
      return {
        ...c,
        availability,
        timing:
          confirmed && validDate(request.neededBy)
            ? c.confirmedDeliveryDate! <= request.neededBy
              ? 'on-time'
              : 'late'
            : 'unknown',
        useMatch:
          request.intendedUse && hasEvidence && c.approvedUses?.includes(request.intendedUse)
            ? 'documented'
            : 'needs-review',
        warnings: [
          'Local manufacture does not prove local feedstock, lower carbon, structural equivalence, current stock or suitability.',
          ...(availability === 'research-only'
            ? [
                'Research or growing potential is not a purchasable construction product. Obtain permits, test evidence and a supplier quotation.',
              ]
            : []),
          ...(!confirmed
            ? ['Obtain a supplier-confirmed delivery date and capacity for this project.']
            : []),
        ],
      };
    })
    .sort((a, b) => {
      const priority = {
        'delivery-confirmed': 0,
        'catalogue-only': 1,
        'research-only': 2,
        unverified: 3,
      };
      return priority[a.availability] - priority[b.availability] || a.name.localeCompare(b.name);
    });
}

export type SurfaceTechnologyKind = 'moss' | 'piezo' | 'traffic-turbine';
export interface SurfaceTechnologyInput {
  id: string;
  name: string;
  kind: SurfaceTechnologyKind;
  /** Installed footprint/treated facade area; use the same area definition when comparing options. */
  areaM2: number;
  exposure?: 'windward' | 'leeward' | 'sheltered' | 'unknown';
  annualActivations?: number;
  trafficSource?: string;
  /** Delivered electrical joules per measured step or vehicle pass, after device losses. */
  joulesPerActivation?: number;
  yieldSource?: string;
  annualAuxiliaryKwh?: number;
  auxiliarySource?: string;
  embodiedCarbonKgCo2e?: number;
  carbonBoundary?: string;
  carbonSource?: string;
  gridKgCo2ePerKwh?: number;
  gridSource?: string;
  annualOtherOperatingKgCo2e?: number;
  operatingCarbonSource?: string;
  /** Additional vehicle emissions attributable to the installation; zero also needs evidence. */
  annualVehiclePenaltyKgCo2e?: number;
  vehiclePenaltySource?: string;
  serviceLifeYears?: number;
  lifetimeSource?: string;
}
export interface SurfaceTechnologyResult {
  id: string;
  name: string;
  kind: SurfaceTechnologyKind;
  status: ScreeningStatus;
  annualGrossKwh: number | null;
  annualNetElectricalKwh: number | null;
  energyKwhPerM2Year: number | null;
  embodiedKgCo2ePerM2: number | null;
  annualNetAvoidedKgCo2e: number | null;
  carbonPaybackYears: number | null;
  /** A separate rank per directly comparable metric; no fabricated composite eco score. */
  energyRank: number | null;
  warnings: string[];
}

export function screenSurfaceTechnology(input: SurfaceTechnologyInput): SurfaceTechnologyResult {
  const out: SurfaceTechnologyResult = {
    id: input.id,
    name: input.name,
    kind: input.kind,
    status: 'needs-data',
    annualGrossKwh: null,
    annualNetElectricalKwh: null,
    energyKwhPerM2Year: null,
    embodiedKgCo2ePerM2: null,
    annualNetAvoidedKgCo2e: null,
    carbonPaybackYears: null,
    energyRank: null,
    warnings: [],
  };
  if (!positive(input.areaM2))
    return {
      ...out,
      status: 'invalid',
      warnings: ['Installed area must be finite and greater than zero.'],
    };
  const positiveInputs = [input.serviceLifeYears];
  const nonnegativeInputs = [
    input.annualActivations,
    input.joulesPerActivation,
    input.annualAuxiliaryKwh,
    input.gridKgCo2ePerKwh,
    input.annualOtherOperatingKgCo2e,
    input.annualVehiclePenaltyKgCo2e,
  ];
  if (
    positiveInputs.some((n) => n != null && !positive(n)) ||
    nonnegativeInputs.some((n) => n != null && !nonnegative(n)) ||
    (input.embodiedCarbonKgCo2e != null && !finite(input.embodiedCarbonKgCo2e))
  ) {
    return {
      ...out,
      status: 'invalid',
      warnings: [
        'Energy, traffic and operating emissions must be finite and nonnegative; service life must be positive.',
      ],
    };
  }
  if (input.kind === 'moss') {
    out.annualGrossKwh = 0;
    out.warnings.push(
      'Moss is not an electricity generator. Cooling, filtration and carbon storage need separate measured assessments; no sequestration credit is assigned.',
    );
    if (input.exposure === 'windward')
      out.warnings.push(
        'Windward: assess driving rain, salt spray, cyclone anchorage, moisture retention and species tolerance. No yield multiplier is assumed.',
      );
    else if (input.exposure === 'leeward' || input.exposure === 'sheltered')
      out.warnings.push(
        'Leeward/sheltered: assess irrigation, shading, heat, airflow and drying. Shelter does not establish moss survival or lower carbon.',
      );
    else
      out.warnings.push(
        'Map facade exposure and measure wind, rain, shade and irrigation demand before choosing moss species or system.',
      );
  } else if (
    nonnegative(input.annualActivations) &&
    nonnegative(input.joulesPerActivation) &&
    evidence(input.trafficSource) &&
    evidence(input.yieldSource)
  ) {
    out.annualGrossKwh = (input.annualActivations * input.joulesPerActivation) / 3_600_000;
    out.warnings.push(
      'Annual output is an extrapolation from entered activation count and delivered joules per activation; validate local trials, occupancy and uptime.',
    );
  } else
    out.warnings.push(
      'Enter a sourced count of actual tile steps or vehicle passes and measured delivered joules per event. Traffic volume alone does not establish energy yield.',
    );
  if (input.kind === 'piezo')
    out.warnings.push(
      'Use the chosen piezoelectric device test. Pavegen uses an electromagnetic mechanism; its marketing yield must not be substituted for a piezo product.',
    );
  if (input.kind === 'traffic-turbine')
    out.warnings.push(
      'Vehicle wakes originate partly from propulsion energy. Assess changed vehicle drag and emissions, road safety, turbulence and turbine setbacks; gross output is not proof of net renewable benefit.',
    );
  if (
    out.annualGrossKwh != null &&
    nonnegative(input.annualAuxiliaryKwh) &&
    evidence(input.auxiliarySource)
  ) {
    out.annualNetElectricalKwh = out.annualGrossKwh - input.annualAuxiliaryKwh;
    out.energyKwhPerM2Year = out.annualNetElectricalKwh / input.areaM2;
    out.status = 'screened';
  } else
    out.warnings.push(
      'Enter auxiliary electricity with evidence, including a justified zero, to calculate net electrical output.',
    );
  if (
    finite(input.embodiedCarbonKgCo2e) &&
    evidence(input.carbonSource) &&
    evidence(input.carbonBoundary)
  ) {
    out.embodiedKgCo2ePerM2 = input.embodiedCarbonKgCo2e / input.areaM2;
    out.warnings.push(
      `Embodied intensity covers ${input.carbonBoundary}; compare equivalent boundaries and assembly service lives.`,
    );
  }
  const vehicleKnown =
    input.kind !== 'traffic-turbine' ||
    (nonnegative(input.annualVehiclePenaltyKgCo2e) && evidence(input.vehiclePenaltySource));
  if (
    out.annualNetElectricalKwh != null &&
    nonnegative(input.gridKgCo2ePerKwh) &&
    evidence(input.gridSource) &&
    nonnegative(input.annualOtherOperatingKgCo2e) &&
    evidence(input.operatingCarbonSource) &&
    vehicleKnown
  ) {
    out.annualNetAvoidedKgCo2e =
      out.annualNetElectricalKwh * input.gridKgCo2ePerKwh -
      input.annualOtherOperatingKgCo2e -
      (input.kind === 'traffic-turbine' ? input.annualVehiclePenaltyKgCo2e! : 0);
    if (
      out.annualNetAvoidedKgCo2e > 0 &&
      nonnegative(input.embodiedCarbonKgCo2e) &&
      out.embodiedKgCo2ePerM2 != null &&
      positive(input.serviceLifeYears) &&
      evidence(input.lifetimeSource)
    ) {
      const payback = input.embodiedCarbonKgCo2e / out.annualNetAvoidedKgCo2e;
      if (payback <= input.serviceLifeYears) out.carbonPaybackYears = payback;
      else
        out.warnings.push(
          'Calculated carbon repayment exceeds the declared service life; no within-life payback is reported.',
        );
    }
  } else
    out.warnings.push(
      'Carbon benefit needs sourced grid displacement and non-electric operating emissions; traffic turbines also need a vehicle-emissions penalty assessment.',
    );
  if (input.embodiedCarbonKgCo2e != null && input.embodiedCarbonKgCo2e < 0)
    out.warnings.push(
      'A negative embodied factor does not prove permanent removal; carbon payback is withheld.',
    );
  if (
    [
      out.annualGrossKwh,
      out.annualNetElectricalKwh,
      out.energyKwhPerM2Year,
      out.embodiedKgCo2ePerM2,
      out.annualNetAvoidedKgCo2e,
      out.carbonPaybackYears,
    ].some((n) => n != null && !finite(n))
  )
    return {
      ...out,
      status: 'invalid',
      annualGrossKwh: null,
      annualNetElectricalKwh: null,
      energyKwhPerM2Year: null,
      embodiedKgCo2ePerM2: null,
      annualNetAvoidedKgCo2e: null,
      carbonPaybackYears: null,
      warnings: [...out.warnings, 'Calculation exceeds finite numeric bounds.'],
    };
  return out;
}

/** Ranks net electrical output per installed m² only, keeping all other metrics visible.
 * Moss cannot win an electricity-generation ranking; do not mistake this for ecological suitability.
 */
export function rankSurfaceTechnologies(
  inputs: readonly SurfaceTechnologyInput[],
): SurfaceTechnologyResult[] {
  const results = inputs.map(screenSurfaceTechnology);
  const comparable = results
    .filter((r) => r.status === 'screened' && r.kind !== 'moss' && r.energyKwhPerM2Year != null)
    .sort((a, b) => b.energyKwhPerM2Year! - a.energyKwhPerM2Year! || a.name.localeCompare(b.name));
  let rank = 0;
  comparable.forEach((r, index) => {
    if (!index || r.energyKwhPerM2Year !== comparable[index - 1].energyKwhPerM2Year)
      rank = index + 1;
    r.energyRank = rank;
  });
  return results;
}

export interface WindEnergyBoundInput {
  airDensityKgM3: number;
  sweptAreaM2: number;
  bins: readonly { speedMps: number; hours: number }[];
  source: string;
}
/** Integrate kinetic energy through the swept area. This is an available-energy upper bound,
 * not delivered output or an AEP model. Do not cube a mean speed or use car speed as wake speed.
 */
export function windKineticEnergyUpperBoundKwh(input: WindEnergyBoundInput): number | null {
  if (
    !positive(input.airDensityKgM3) ||
    !positive(input.sweptAreaM2) ||
    !evidence(input.source) ||
    !input.bins.length ||
    input.bins.length > 8784 ||
    input.bins.some((b) => !nonnegative(b.speedMps) || !nonnegative(b.hours)) ||
    input.bins.reduce((sum, b) => sum + b.hours, 0) > 8784
  )
    return null;
  const energy = input.bins.reduce(
    (sum, b) =>
      sum + (0.5 * input.airDensityKgM3 * input.sweptAreaM2 * b.speedMps ** 3 * b.hours) / 1000,
    0,
  );
  return finite(energy) ? energy : null;
}
