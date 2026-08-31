import { describe, it, expect } from 'vitest';
import { axisLockVertex, ANGLE_SNAP_TOL_DEG } from '../drawLength';

describe('axisLockVertex — straight-line assist (complaint A)', () => {
  it('exports the 15° tolerance', () => {
    expect(ANGLE_SNAP_TOL_DEG).toBe(15);
  });

  it('locks a near-horizontal run to the previous y', () => {
    // From (1,1), a 3.0 × 0.15 candidate is 2.9° off level — well inside 15°.
    const { vertex, axis } = axisLockVertex({ x: 1, y: 1 }, { x: 4, y: 1.15 });
    expect(axis).toBe('horizontal');
    expect(vertex.y).toBe(1); // snapped onto the axis (was 1.15, a slant)
    expect(vertex.x).toBe(4); // magnitude along the run is preserved
  });

  it('locks a near-vertical run to the previous x', () => {
    const { vertex, axis } = axisLockVertex({ x: 1, y: 1 }, { x: 1.15, y: 4 });
    expect(axis).toBe('vertical');
    expect(vertex.x).toBe(1);
    expect(vertex.y).toBe(4);
  });

  it('leaves a deliberate 45° diagonal free', () => {
    const candidate = { x: 3, y: 3 };
    const { vertex, axis } = axisLockVertex({ x: 0, y: 0 }, candidate);
    expect(axis).toBe('none');
    expect(vertex).toEqual(candidate);
  });

  it('returns the candidate unchanged when freed (Shift held)', () => {
    const candidate = { x: 4, y: 1.15 };
    const { vertex, axis } = axisLockVertex({ x: 1, y: 1 }, candidate, { freed: true });
    expect(axis).toBe('none');
    expect(vertex).toEqual(candidate);
  });

  it('returns the candidate unchanged when there is no previous vertex', () => {
    const candidate = { x: 4, y: 1.15 };
    const { vertex, axis } = axisLockVertex(null, candidate);
    expect(axis).toBe('none');
    expect(vertex).toEqual(candidate);
  });

  it('locks a run just inside the tolerance and frees one just outside', () => {
    // ~14° off level (tan 14° ≈ 0.249): locks.
    const inside = axisLockVertex({ x: 0, y: 0 }, { x: 4, y: 0.99 });
    expect(inside.axis).toBe('horizontal');
    // ~20° off level (tan 20° ≈ 0.364): stays free.
    const outside = axisLockVertex({ x: 0, y: 0 }, { x: 4, y: 1.45 });
    expect(outside.axis).toBe('none');
  });

  it('rounds locked coordinates to 4 dp', () => {
    const { vertex } = axisLockVertex(
      { x: 0.10005, y: 2.20003 },
      { x: 3.33339, y: 2.30007 },
    );
    // horizontal lock → y from prev (rounded), x from candidate (rounded)
    expect(vertex.y).toBe(2.2); // 2.20003 → 2.2000
    expect(vertex.x).toBe(3.3334); // 3.33339 → 3.3334
  });
});
