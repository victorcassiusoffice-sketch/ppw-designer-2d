/** Measured foundation takeoff, not load-bearing, soil or reinforcement design.
 * All rectangles use their centre in plan metres. Elevations are relative to
 * the ground finished-floor datum, independent of the floor currently selected.
 */
import {
  estimateRebar,
  estimateVolumeMix,
  type MaterialsSettings,
  type RebarTakeoff,
  type VolumeMix,
} from './materials/index.js';

export type FoundationKind = 'slab' | 'strip' | 'pad';
export type FoundationRebar = MaterialsSettings['roof']['rebar'];
export interface FoundationExcavation {
  /** Measured vertical-sided estimating envelope, not a safe excavation design. */
  depthM: number;
  topElevationM: number;
  marginM: number;
  /** Design preview stage only, never evidence of completed site work. */
  stage: 'excavated' | 'filled';
}
export interface FoundationElement {
  id: string;
  name: string;
  kind: FoundationKind;
  x: number;
  y: number;
  lengthM: number;
  widthM: number;
  depthM: number;
  topElevationM: number;
  rebar: FoundationRebar;
  excavation?: FoundationExcavation;
}
export interface FoundationModel {
  version: 1;
  enabled: boolean;
  elements: FoundationElement[];
  concreteProductId?: 'premix-classics' | 'premix-pro';
}
export const EMPTY_FOUNDATION: FoundationModel = { version: 1, enabled: false, elements: [] };
export const FOUNDATION_ELEMENT_LIMIT = 100;
export const FOUNDATION_KINDS: { id: FoundationKind; label: string }[] = [
  { id: 'slab', label: 'Slab / raft' },
  { id: 'strip', label: 'Strip footing' },
  { id: 'pad', label: 'Pad footing' },
];
export function defaultFoundationRebar(): FoundationRebar {
  // Disabled illustrative inputs, never a recommended reinforcement schedule.
  return {
    enabled: false,
    diameterMm: 10,
    spacingMm: 200,
    layers: 1,
    coverMm: 50,
    stockLengthM: 6,
    lapLengthM: 0,
    wastePct: 5,
  };
}
const record = (v: unknown): Record<string, unknown> | null =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
const n = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const key = (v: unknown): v is string =>
  typeof v === 'string' && v.trim().length > 0 && v.length <= 128;

/** Invalid entities are rejected, never clamped into a different physical size. */
export function normaliseFoundation(value: unknown): FoundationModel | undefined {
  const raw = record(value);
  if (
    !raw ||
    raw.version !== 1 ||
    typeof raw.enabled !== 'boolean' ||
    !Array.isArray(raw.elements) ||
    raw.elements.length > FOUNDATION_ELEMENT_LIMIT
  )
    return undefined;
  const seen = new Set<string>();
  if (
    raw.concreteProductId !== undefined &&
    raw.concreteProductId !== 'premix-classics' &&
    raw.concreteProductId !== 'premix-pro'
  )
    return undefined;
  const elements: FoundationElement[] = [];
  for (const value of raw.elements) {
    const e = record(value),
      r = record(e?.rebar);
    if (
      !e ||
      !key(e.id) ||
      seen.has(e.id) ||
      !key(e.name) ||
      !FOUNDATION_KINDS.some((k) => k.id === e.kind) ||
      !n(e.x, -10000, 10000) ||
      !n(e.y, -10000, 10000) ||
      !n(e.lengthM, 0.1, 1000) ||
      !n(e.widthM, 0.1, 1000) ||
      !n(e.depthM, 0.01, 10) ||
      !n(e.topElevationM, -30, 10) ||
      !r ||
      typeof r.enabled !== 'boolean' ||
      !n(r.diameterMm, 4, 50) ||
      !n(r.spacingMm, 10, 2000) ||
      !n(r.layers, 1, 10) ||
      !Number.isInteger(r.layers) ||
      !n(r.coverMm, 0, 300) ||
      !n(r.stockLengthM, 0.5, 30) ||
      !n(r.lapLengthM, 0, 10) ||
      r.lapLengthM >= r.stockLengthM ||
      !n(r.wastePct, 0, 100)
    )
      return undefined;
    const rebar: FoundationRebar = {
      enabled: r.enabled,
      diameterMm: r.diameterMm,
      spacingMm: r.spacingMm,
      layers: r.layers,
      coverMm: r.coverMm,
      stockLengthM: r.stockLengthM,
      lapLengthM: r.lapLengthM,
      wastePct: r.wastePct,
    };
    let excavation: FoundationExcavation | undefined;
    if (e.excavation !== undefined) {
      const ex = record(e.excavation);
      if (
        !ex ||
        !n(ex.depthM, 0.01, 30) ||
        !n(ex.topElevationM, -30, 10) ||
        !n(ex.marginM, 0, 20) ||
        (ex.stage !== 'excavated' && ex.stage !== 'filled') ||
        e.topElevationM > ex.topElevationM + 1e-8 ||
        e.topElevationM - e.depthM < ex.topElevationM - ex.depthM - 1e-8
      )
        return undefined;
      excavation = {
        depthM: ex.depthM,
        topElevationM: ex.topElevationM,
        marginM: ex.marginM,
        stage: ex.stage,
      };
    }
    if (
      rebar.enabled &&
      ((2 * rebar.coverMm) / 1000 + (rebar.layers * 2 * rebar.diameterMm) / 1000 > e.depthM ||
        (2 * rebar.coverMm) / 1000 + rebar.diameterMm / 1000 >= Math.min(e.lengthM, e.widthM))
    )
      return undefined;
    elements.push({
      id: e.id,
      name: e.name.trim(),
      kind: e.kind as FoundationKind,
      x: e.x,
      y: e.y,
      lengthM: e.lengthM,
      widthM: e.widthM,
      depthM: e.depthM,
      topElevationM: e.topElevationM,
      rebar,
      ...(excavation ? { excavation } : {}),
    });
    seen.add(e.id);
  }
  return {
    version: 1,
    enabled: raw.enabled,
    elements,
    ...(raw.concreteProductId
      ? { concreteProductId: raw.concreteProductId as FoundationModel['concreteProductId'] }
      : {}),
  };
}

export function foundationElementBounds(e: FoundationElement) {
  return {
    minX: e.x - e.lengthM / 2,
    maxX: e.x + e.lengthM / 2,
    minY: e.y - e.widthM / 2,
    maxY: e.y + e.widthM / 2,
    minElevationM: e.topElevationM - e.depthM,
    maxElevationM: e.topElevationM,
  };
}
export type FoundationBox = ReturnType<typeof foundationElementBounds>;
export const foundationIsFilled = (e: FoundationElement) =>
  !e.excavation || e.excavation.stage === 'filled';
export function foundationExcavationBounds(e: FoundationElement): FoundationBox | null {
  if (!e.excavation) return null;
  const b = foundationElementBounds(e),
    ex = e.excavation;
  return {
    minX: b.minX - ex.marginM,
    maxX: b.maxX + ex.marginM,
    minY: b.minY - ex.marginM,
    maxY: b.maxY + ex.marginM,
    minElevationM: ex.topElevationM - ex.depthM,
    maxElevationM: ex.topElevationM,
  };
}
export function foundationBounds(model?: FoundationModel) {
  if (!model?.enabled || !model.elements.length) return null;
  const b = model.elements.map((e) => foundationExcavationBounds(e) ?? foundationElementBounds(e));
  return {
    minX: Math.min(...b.map((e) => e.minX)),
    maxX: Math.max(...b.map((e) => e.maxX)),
    minY: Math.min(...b.map((e) => e.minY)),
    maxY: Math.max(...b.map((e) => e.maxY)),
    minElevationM: Math.min(...b.map((e) => e.minElevationM)),
    maxElevationM: Math.max(...b.map((e) => e.maxElevationM)),
  };
}
/** Exact union of axis-aligned boxes. Z and X sweeps integrate merged Y spans.
 * Slabs crossing strip/pad footings are consequently counted once, including
 * elements that overlap in plan but occupy different depth intervals.
 */
export function foundationVolumeM3(model?: FoundationModel): number {
  if (!model?.enabled) return 0;
  return foundationBoxUnionVolumeM3(
    model.elements.filter(foundationIsFilled).map(foundationElementBounds),
  );
}
export function foundationBoxUnionVolumeM3(boxes: FoundationBox[]): number {
  const zs = [...new Set(boxes.flatMap((b) => [b.minElevationM, b.maxElevationM]))].sort(
    (a, b) => a - b,
  );
  let volume = 0;
  for (let z = 1; z < zs.length; z++) {
    const middleZ = (zs[z - 1] + zs[z]) / 2;
    const layer = boxes.filter((b) => b.minElevationM < middleZ && b.maxElevationM > middleZ);
    const xs = [...new Set(layer.flatMap((b) => [b.minX, b.maxX]))].sort((a, b) => a - b);
    let area = 0;
    for (let x = 1; x < xs.length; x++) {
      const middleX = (xs[x - 1] + xs[x]) / 2;
      const intervals = layer
        .filter((b) => b.minX < middleX && b.maxX > middleX)
        .map((b) => [b.minY, b.maxY])
        .sort((a, b) => a[0] - b[0]);
      let length = 0,
        end = -Infinity;
      for (const [a, b] of intervals) {
        length += Math.max(0, b - Math.max(a, end));
        end = Math.max(end, b);
      }
      area += (xs[x] - xs[x - 1]) * length;
    }
    volume += area * (zs[z] - zs[z - 1]);
  }
  return Math.max(0, volume);
}
function overlaps(a: FoundationElement, b: FoundationElement): boolean {
  const x = foundationElementBounds(a),
    y = foundationElementBounds(b);
  return (
    Math.min(x.maxX, y.maxX) > Math.max(x.minX, y.minX) + 1e-8 &&
    Math.min(x.maxY, y.maxY) > Math.max(x.minY, y.minY) + 1e-8 &&
    Math.min(x.maxElevationM, y.maxElevationM) > Math.max(x.minElevationM, y.minElevationM) + 1e-8
  );
}
export function estimateFoundation(
  model: FoundationModel,
  concrete: VolumeMix & { supply: 'ready-mix' | 'site-mix' },
) {
  const checked = normaliseFoundation(model);
  if (!checked) throw new RangeError('Foundation dimensions or reinforcement inputs are invalid.');
  const elements = checked.enabled ? checked.elements : [];
  const filled = elements.filter(foundationIsFilled);
  const volumeM3 = foundationVolumeM3(checked);
  const sumElementVolumeM3 = filled.reduce((sum, e) => sum + e.lengthM * e.widthM * e.depthM, 0);
  const plannedConcreteVolumeM3 = foundationBoxUnionVolumeM3(elements.map(foundationElementBounds));
  const pendingConcreteM3 = Math.max(0, plannedConcreteVolumeM3 - volumeM3);
  const concreteComplete = elements.every(foundationIsFilled);
  const holes = elements.flatMap((e) => {
    const b = foundationExcavationBounds(e);
    return b ? [b] : [];
  });
  const excavationVolumeM3 = foundationBoxUnionVolumeM3(holes);
  const filledExcavationM3 = Math.max(
    0,
    excavationVolumeM3 +
      volumeM3 -
      foundationBoxUnionVolumeM3([...holes, ...filled.map(foundationElementBounds)]),
  );
  const remainingExcavationM3 = Math.max(0, excavationVolumeM3 - filledExcavationM3);
  const warnings: string[] = [];
  const rebar: { elementId: string; takeoff: RebarTakeoff }[] = [];
  const reinforced = filled.filter((e) => e.rebar.enabled);
  if (!concreteComplete)
    warnings.push(
      'Excavation preview: planned concrete and its reinforcement are not yet included in the filled-design takeoff. Use Add concrete when the design is ready. This is not a record of site completion.',
    );
  if (holes.length)
    warnings.push(
      'Excavation is a vertical-sided measured envelope. Temporary support, batter slopes, soil bulking, disposal, groundwater, blinding and backfill specifications require separate review. Remaining void is not an order for fill.',
    );
  const overlappingSteel = reinforced.some((a, i) =>
    reinforced.slice(i + 1).some((b) => overlaps(a, b)),
  );
  if (overlappingSteel)
    warnings.push(
      'Reinforced elements overlap. Reinforcement totals are withheld until the engineer separates the schedules; concrete overlap is still counted once.',
    );
  else
    for (const element of reinforced)
      rebar.push({
        elementId: element.id,
        takeoff: estimateRebar(element.lengthM, element.widthM, element.rebar),
      });
  if (sumElementVolumeM3 - volumeM3 > 1e-7)
    warnings.push('Overlapping concrete volumes are counted once.');
  if (reinforced.length)
    warnings.push(
      'Straight two-direction mesh only. Links, starters, hooks, anchorage and support chairs need the engineer’s bending schedule. Stock bars are allocated per run; offcuts are not assumed reusable.',
    );
  const mixed = estimateVolumeMix(volumeM3, concrete);
  return {
    volumeM3,
    plannedConcreteVolumeM3,
    pendingConcreteM3,
    concreteComplete,
    excavationVolumeM3,
    filledExcavationM3,
    remainingExcavationM3,
    sumElementVolumeM3,
    overlapM3: Math.max(0, sumElementVolumeM3 - volumeM3),
    concreteOrderM3: mixed.wetM3,
    mix: concrete.supply === 'site-mix' ? mixed : null,
    rebar,
    rebarComplete: !overlappingSteel,
    rebarMassKg: rebar.reduce((sum, r) => sum + r.takeoff.massKg, 0),
    rebarStockBars: rebar.reduce((sum, r) => sum + r.takeoff.bars, 0),
    warnings,
  };
}
