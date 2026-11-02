import { describe, expect, it } from 'vitest';
import { WalkFrameMeasurement } from '../frameMeasurement';

describe('opt-in fixed-window frame evidence', () => {
  it('retains the first completion and long active stalls without the historical HUD filters', () => {
    const sample = new WalkFrameMeasurement(1000, 1000, true);
    sample.rendered(1020); sample.rendered(1040); sample.rendered(1540); sample.rendered(1560);
    const result = sample.finish(2000, 'deadline')!;
    expect(result.intervals.map(i => i.durationMs)).toEqual([20, 20, 500, 20]);
    expect(result.intervals[0].start).toBe('armed');
    expect(result.completedFrames).toBe(4);
    expect(result.completedFramesPerActiveSecond).toBe(4);
    expect(result.low1CompletedIntervalFps).toBe(2);
    expect(result.unrenderedActiveTails).toEqual([{ startAt: 1560, endAt: 2000, durationMs: 440 }]);
  });

  it('ends at the fixed deadline even when the next render arrives late', () => {
    const sample = new WalkFrameMeasurement(100, 1000, true);
    sample.rendered(120);
    const result = sample.rendered(1600)!;
    expect(result).toMatchObject({ finishedAt: 1100, observedMs: 1000, activeMs: 1000, reason: 'deadline', completedFrames: 1 });
    expect(result.unrenderedActiveTails).toEqual([{ startAt: 120, endAt: 1100, durationMs: 980 }]);
    expect(sample.finish(1700, 'disposed')).toBeNull();
    expect(sample.rendered(1800)).toBeNull();
  });

  it('records focus and visibility pauses separately and never charges their gaps to active frame intervals', () => {
    const sample = new WalkFrameMeasurement(1000, 1000, true);
    sample.rendered(1020);
    sample.transition(1050, false, 'blur'); sample.transition(1100, false, 'hidden');
    sample.rendered(1200); // An inactive call is not a completed active frame.
    sample.transition(1450, true, 'visible'); sample.transition(1460, true, 'focus'); sample.rendered(1470);
    sample.rendered(1500);
    const result = sample.finish(2000, 'deadline')!;
    expect(result).toMatchObject({ activeMs: 600, pausedMs: 400, completedFrames: 3 });
    expect(result.intervals.map(i => [i.durationMs, i.start])).toEqual([[20, 'armed'], [20, 'resumed'], [30, 'frame']]);
    expect(result.pauses).toEqual([{ startAt: 1050, endAt: 1450, reason: 'blur' }]);
    expect(result.transitions.map(t => t.reason)).toEqual(['armed', 'blur', 'hidden', 'visible', 'focus']);
  });

  it('preserves a partial disposal window and its paused tail without pretending the deadline completed', () => {
    const sample = new WalkFrameMeasurement(0, 1000, false);
    sample.transition(100, true, 'focus'); sample.rendered(120); sample.transition(150, false, 'hidden');
    const result = sample.finish(400, 'disposed')!;
    expect(result).toMatchObject({ requestedMs: 1000, observedMs: 400, activeMs: 50, pausedMs: 350, reason: 'disposed' });
    expect(result.pauses).toEqual([{ startAt: 0, endAt: 100, reason: 'armed while paused' }, { startAt: 150, endAt: 400, reason: 'hidden' }]);
    expect(sample.transition(500, true, 'visible')).toBeNull();
  });

  it('reports a bounded recording overflow explicitly instead of dropping early samples', () => {
    const sample = new WalkFrameMeasurement(0, 120000, true);
    for (let n = 1; n <= 36000; n++) expect(sample.rendered(n)).toBeNull();
    const result = sample.rendered(36001)!;
    expect(result).toMatchObject({ reason: 'record-limit', completedFrames: 36000, finishedAt: 36001 });
    expect(result.intervals[0].completedAt).toBe(1);
  });
});
