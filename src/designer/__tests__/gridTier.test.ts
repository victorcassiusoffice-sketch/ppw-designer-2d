import { describe, it, expect } from 'vitest';
import {
  chooseGridTier,
  MIN_GRID_PX,
  MAX_GRID_LINES_PER_AXIS,
  MAJOR_FOR_MINOR,
  CANDIDATES,
} from '../gridTier';
import { SNAP_UNIT_ORDER, PRECISION_STEP_M } from '../../store/designerUIStore';

describe('chooseGridTier', () => {
  it('returns today exact grid at the default unit', () => {
    // (a) The regression that matters most: at 0.5 m / 100 px / scale 1 the
    // drawn grid must be unchanged from before this module existed, or every
    // pixel-diff spec and the 900 px gold span assertion shift.
    expect(chooseGridTier(0.5, 100, 1, 20)).toEqual({ minorStepM: 0.5, majorStepM: 1 });
  });

  it('never draws a sub-legible grid', () => {
    // (b) At 1 cm the drawn tier steps up until it is >= MIN_GRID_PX wide.
    const tier = chooseGridTier(0.01, 100, 1, 20);
    expect(tier.minorStepM * 100 * 1).toBeGreaterThanOrEqual(MIN_GRID_PX);
    // Specifically the 0.1 m tier: 1 cm would be 1 px, 10 cm is 10 px.
    expect(tier.minorStepM).toBe(0.1);
    expect(tier.majorStepM).toBe(0.5);
  });

  it('never exceeds the per-axis line cap, at any unit or zoom', () => {
    // (c) The cap is only computable because spanM is a parameter.
    for (const unit of SNAP_UNIT_ORDER) {
      for (const scale of [0.3, 1, 3]) {
        const tier = chooseGridTier(PRECISION_STEP_M[unit], 100, scale, 50);
        if (tier.minorStepM === 0) continue;
        const perAxis = 50 / tier.minorStepM + 1;
        expect(perAxis).toBeLessThanOrEqual(MAX_GRID_LINES_PER_AXIS);
      }
    }
  });

  it('the drawn grid is never finer than the snap step', () => {
    for (const unit of SNAP_UNIT_ORDER) {
      const step = PRECISION_STEP_M[unit];
      const tier = chooseGridTier(step, 100, 1, 20);
      if (tier.minorStepM === 0) continue;
      expect(tier.minorStepM).toBeGreaterThanOrEqual(step - 1e-9);
    }
  });

  it('majors come from the explicit table, never derived', () => {
    // A "smallest candidate >= minor * 5" rule would turn a 0.5 m minor into
    // a 10 m major, removing every major line inside a normal room.
    for (const c of CANDIDATES) {
      expect(MAJOR_FOR_MINOR[c]).toBeGreaterThan(c);
    }
    expect(MAJOR_FOR_MINOR[0.5]).toBe(1);
    expect(MAJOR_FOR_MINOR[0.1]).toBe(0.5);
  });

  it('gives up rather than drawing something illegible', () => {
    // Zoomed far out, even 10 m is under the pixel floor.
    expect(chooseGridTier(0.01, 1, 0.1, 20)).toEqual({ minorStepM: 0, majorStepM: 0 });
  });

  it('zooming in unlocks a finer tier', () => {
    const out = chooseGridTier(0.01, 100, 1, 20);
    const inn = chooseGridTier(0.01, 100, 3, 20);
    expect(inn.minorStepM).toBeLessThanOrEqual(out.minorStepM);
  });
});
