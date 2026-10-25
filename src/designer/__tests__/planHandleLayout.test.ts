import { describe, it, expect } from 'vitest';
import { planHandleLayout } from '../planHandleLayout';

describe('Plan rotation handle is screen-sized and clear of top chrome', () => {
  it('keeps a 44px target and 38px reach independent of plan zoom', () => {
    for (const scale of [0.15, 0.7, 1, 4]) {
      const h = planHandleLayout({ w: 60, h: 50, scale, left: 100, top: 150, width: 390 });
      expect(h.y * scale).toBe(-38);
      expect((h.radius * 2 + h.hitStrokeWidth) * scale).toBeCloseTo(44, 10);
    }
  });
  it('uses the free side near the top and flips away from the right edge', () => {
    expect(planHandleLayout({ w: 60, h: 50, scale: 1, left: 80, top: 30, width: 390 }).x).toBe(98);
    expect(planHandleLayout({ w: 60, h: 50, scale: 1, left: 290, top: 30, width: 390 }).x).toBe(-38);
  });
});
