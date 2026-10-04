import { describe, expect, it } from 'vitest';
import { planDaylight, planShadowPoints, planWindowLight } from '../planDaylight';

describe('illustrative plan daylight preserves physical coordinates', () => {
  it('scales the studio shadow with the actual level height, without scaling the room', () => {
    const low = planDaylight(null, 2), high = planDaylight(null, 4);
    expect(high.offset.x).toBe(low.offset.x * 2);
    expect(high.offset.y).toBe(low.offset.y * 2);
    const a = { x: 1, y: 2 }, b = { x: 5, y: 2 };
    expect(planShadowPoints(a, b, low.offset, 100)).toEqual([100, 200, 500, 200, 590, 310, 190, 310]);
    expect(a).toEqual({ x: 1, y: 2 }); expect(b).toEqual({ x: 5, y: 2 });
  });
  it('tracks sunrise and sunset direction and suppresses sunlight at night', () => {
    expect(planDaylight(9, 2.7, 280).offset.x).toBeLessThan(0);
    expect(planDaylight(16, 2.7, 280).offset.x).toBeGreaterThan(0);
    expect(planDaylight(0, 2.7, 280).strength).toBe(0);
  });
  it('keeps low-sun illustration bounded and invalid-height fallback finite', () => {
    const sunset = planDaylight(17, 8, 280);
    expect(Math.hypot(sunset.offset.x, sunset.offset.y)).toBeLessThanOrEqual(3.000001);
    expect(planDaylight(null, NaN)).toEqual(planDaylight(null, 2.7));
  });
  it('projects the actual sill/head into a north-window sun patch and rejects a window facing away', () => {
    const light = planDaylight(null, 2.7);
    const a = { x: 1, y: 0 }, b = { x: 2.2, y: 0 };
    const patch = planWindowLight(a, b, { x: 0, y: 1 }, 0.9, 2.1, light, 2.7)!;
    expect(patch[0].x).toBeCloseTo(1 + 0.9 * 0.45);
    expect(patch[0].y).toBeCloseTo(0.9 * 0.55);
    expect(patch[2].x).toBeCloseTo(2.2 + 2.1 * 0.45);
    expect(patch[2].y).toBeCloseTo(2.1 * 0.55);
    expect(planWindowLight(a, b, { x: 0, y: -1 }, 0.9, 2.1, light, 2.7)).toBeNull();
    expect(planWindowLight(a, b, { x: 0, y: 1 }, 0.9, 2.1, planDaylight(0, 2.7, 280), 2.7)).toBeNull();
    expect(a).toEqual({ x: 1, y: 0 }); expect(b).toEqual({ x: 2.2, y: 0 });
  });
});
