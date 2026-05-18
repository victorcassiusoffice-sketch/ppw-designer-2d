/**
 * Sims-Parity DT-07 — reconcileDimensions pure-fn tests.
 *
 * Exit criterion (MASTER-BUILD-PLAN.md §2 DT-07):
 *   "800 mm typed + 640 mm measured → reconciliation modal opens · override reason captured · submit allowed"
 *
 * Verdict for 800/640: deltaPct = (800-640)/640 = +0.25 → flagged.
 * With overrideReason set → flagged: false, accepted: true.
 */

import { describe, it, expect } from 'vitest';
import {
  DIM_DELTA_PCT_THRESHOLD,
  fromMm,
  reconcileDimension,
  reconcileDimensions,
  toMm,
} from '../reconcileDimensions';

describe('DT-07 / unit conversions', () => {
  it('toMm and fromMm round-trip', () => {
    expect(toMm(50, 'cm')).toBe(500);
    expect(toMm(0.5, 'm')).toBe(500);
    expect(toMm(800, 'mm')).toBe(800);
    expect(fromMm(800, 'cm')).toBe(80);
    expect(fromMm(800, 'm')).toBe(0.8);
  });
});

describe('DT-07 / reconcileDimension', () => {
  it('flags exit-criteria case (800 typed vs 640 measured)', () => {
    const v = reconcileDimension({ typedMm: 800, measuredMm: 640 });
    expect(v.deltaPct).toBeCloseTo(0.25, 4);
    expect(v.flagged).toBe(true);
    expect(v.accepted).toBe(false);
  });

  it('accepts exit-criteria case with overrideReason', () => {
    const v = reconcileDimension({
      typedMm: 800, measuredMm: 640, overrideReason: 'tape-measured',
    });
    expect(v.flagged).toBe(false);
    expect(v.accepted).toBe(true);
  });

  it('passes a 5% delta unflagged', () => {
    const v = reconcileDimension({ typedMm: 100, measuredMm: 105 });
    expect(v.flagged).toBe(false);
    expect(v.accepted).toBe(true);
  });

  it('flags at the threshold boundary 15%', () => {
    const v = reconcileDimension({ typedMm: 115, measuredMm: 100 });
    expect(v.flagged).toBe(true);
  });

  it('does not flag exactly below threshold (14.9%)', () => {
    const v = reconcileDimension({ typedMm: 114.9, measuredMm: 100 });
    expect(v.flagged).toBe(false);
  });

  it('handles negative delta (typed smaller than measured)', () => {
    const v = reconcileDimension({ typedMm: 700, measuredMm: 1000 });
    expect(v.deltaPct).toBeCloseTo(-0.3, 4);
    expect(v.flagged).toBe(true);
  });

  it('returns NaN for zero measured (graceful)', () => {
    const v = reconcileDimension({ typedMm: 100, measuredMm: 0 });
    expect(Number.isNaN(v.deltaPct)).toBe(true);
    expect(v.flagged).toBe(false);
    expect(v.accepted).toBe(true);
  });

  it('whitespace-only overrideReason is treated as none', () => {
    const v = reconcileDimension({
      typedMm: 800, measuredMm: 640, overrideReason: '   ',
    });
    expect(v.flagged).toBe(true);
  });
});

describe('DT-07 / reconcileDimensions (trio)', () => {
  it('worstDeltaPct picks the largest absolute delta', () => {
    const r = reconcileDimensions({
      width: { typedMm: 800, measuredMm: 640 },
      depth: { typedMm: 600, measuredMm: 605 },
    });
    expect(r.anyFlagged).toBe(true);
    expect(r.worstDeltaPct).toBeCloseTo(0.25, 4);
  });

  it('reports anyFlagged=false when all axes pass', () => {
    const r = reconcileDimensions({
      width: { typedMm: 100, measuredMm: 105 },
    });
    expect(r.anyFlagged).toBe(false);
  });

  it('DIM_DELTA_PCT_THRESHOLD equals 0.15 (spec)', () => {
    expect(DIM_DELTA_PCT_THRESHOLD).toBe(0.15);
  });
});
