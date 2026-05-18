/**
 * Sims-Parity DT-07 — typed-vs-measured dimension reconciliation.
 *
 * The merchant types nominal W×D×H. The calibration step yields an
 * approximate measured W (derived from the silhouette bbox via the
 * pixelsPerMm scale). If |typed − measured| / measured ≥ 15% the UI
 * surfaces a reconciliation modal that demands either an
 * `overrideReason` string or a return to the camera step.
 *
 * Pure-fn for testability.
 */

export const DIM_DELTA_PCT_THRESHOLD = 0.15;

export type DimensionUnit = 'mm' | 'cm' | 'm';

export function toMm(value: number, unit: DimensionUnit): number {
  switch (unit) {
    case 'mm':
      return value;
    case 'cm':
      return value * 10;
    case 'm':
      return value * 1000;
  }
}

export function fromMm(valueMm: number, unit: DimensionUnit): number {
  switch (unit) {
    case 'mm':
      return valueMm;
    case 'cm':
      return valueMm / 10;
    case 'm':
      return valueMm / 1000;
  }
}

export interface ReconcileInput {
  /** Nominal value the merchant typed, already converted to mm. */
  typedMm: number;
  /** Measured value derived from calibration, in mm. */
  measuredMm: number;
  /** Optional override reason — if present + non-empty, accepts the delta. */
  overrideReason?: string;
}

export interface ReconcileVerdict {
  /** Signed delta (typed − measured) / measured. */
  deltaPct: number;
  /** True if |deltaPct| ≥ DIM_DELTA_PCT_THRESHOLD and no override. */
  flagged: boolean;
  /** True if accept-as-typed is allowed (no flag OR has override). */
  accepted: boolean;
}

/**
 * Verdict for a single dimension axis (width / depth / height).
 */
export function reconcileDimension(input: ReconcileInput): ReconcileVerdict {
  if (!Number.isFinite(input.typedMm) || !Number.isFinite(input.measuredMm) || input.measuredMm === 0) {
    return { deltaPct: NaN, flagged: false, accepted: true };
  }
  const deltaPct = (input.typedMm - input.measuredMm) / input.measuredMm;
  const overridden = typeof input.overrideReason === 'string' && input.overrideReason.trim().length > 0;
  const flagged = Math.abs(deltaPct) >= DIM_DELTA_PCT_THRESHOLD && !overridden;
  return { deltaPct, flagged, accepted: !flagged };
}

export interface ReconcileTrioInput {
  width: ReconcileInput;
  depth?: ReconcileInput;
  height?: ReconcileInput;
}

/**
 * Reconcile up to three axes. Only `width` is required because v1
 * corner-tap derives measured width from the silhouette bbox;
 * depth / height are typed-only at v1 (DT-20 v2 adds depth+height
 * from auto-pose).
 */
export function reconcileDimensions(input: ReconcileTrioInput): {
  width: ReconcileVerdict;
  depth?: ReconcileVerdict;
  height?: ReconcileVerdict;
  /** True if any axis is flagged. */
  anyFlagged: boolean;
  /** Worst absolute deltaPct across all axes (NaN-safe). */
  worstDeltaPct: number;
} {
  const w = reconcileDimension(input.width);
  const d = input.depth ? reconcileDimension(input.depth) : undefined;
  const h = input.height ? reconcileDimension(input.height) : undefined;
  const flags = [w.flagged, d?.flagged, h?.flagged];
  const deltas = [w.deltaPct, d?.deltaPct, h?.deltaPct]
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
    .map(Math.abs);
  return {
    width: w,
    depth: d,
    height: h,
    anyFlagged: flags.some(Boolean),
    worstDeltaPct: deltas.length > 0 ? Math.max(...deltas) : 0,
  };
}
