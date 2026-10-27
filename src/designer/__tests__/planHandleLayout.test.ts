import { describe, it, expect } from 'vitest';
import { planHandleLayout } from '../planHandleLayout';

describe('Plan rotation handle is screen-sized and clear of top chrome', () => {
  it('keeps a 44px target and 38px reach independent of plan zoom', () => {
    for (const scale of [0.15, 0.7, 1, 4]) {
      const h = planHandleLayout({ w: 60, h: 50, scale, left: 100, top: 150, width: 390, height: 600 });
      expect(h.y * scale).toBe(-38);
      expect((h.radius * 2 + h.hitStrokeWidth) * scale).toBeCloseTo(44, 10);
    }
  });
  it('uses the free side near the top and flips away from the right edge', () => {
    expect(planHandleLayout({ w: 60, h: 50, scale: 1, left: 80, top: 30, width: 390, height: 600 }).x).toBe(98);
    expect(planHandleLayout({ w: 60, h: 50, scale: 1, left: 290, top: 30, width: 390, height: 600 }).x).toBe(-38);
  });
  it('keeps the complete target reachable when the item is behind the desktop toolbar', () => {
    // Reviewer reproduction: the chair centre was above the Plan viewport,
    // so the previous side-flipped handle hit Project hub instead of canvas.
    const input = { w: 59, h: 63, scale: 0.475, left: 584, top: -99, width: 1280, height: 470 };
    const handle = planHandleLayout(input);
    const hitRadius = (handle.radius + handle.hitStrokeWidth / 2) * input.scale;
    const y = input.top + handle.y * input.scale;
    expect(y - hitRadius).toBeGreaterThanOrEqual(2);
    expect(y + hitRadius).toBeLessThan(input.height);
    // Layout is chrome-only: no dimensions, scale or object position change.
    expect(input).toEqual({ w: 59, h: 63, scale: 0.475, left: 584, top: -99, width: 1280, height: 470 });
  });
  it('bounds all four edges at different zooms without reducing the 44px target', () => {
    for (const scale of [0.15, 0.7, 1, 4]) {
      for (const [width, height] of [[390, 540], [1280, 470]]) {
        for (const [left, top] of [[-200, -200], [width + 100, -100], [-100, height + 100], [width + 100, height + 100]]) {
          const handle = planHandleLayout({ w: 60, h: 50, scale, left, top, width, height });
          const x = left + handle.x * scale, y = top + handle.y * scale;
          expect(x).toBeGreaterThanOrEqual(24 - 1e-9);
          expect(x).toBeLessThanOrEqual(width - 24 + 1e-9);
          expect(y).toBeGreaterThanOrEqual(24 - 1e-9);
          expect(y).toBeLessThanOrEqual(height - 24 + 1e-9);
          expect((handle.radius * 2 + handle.hitStrokeWidth) * scale).toBeCloseTo(44, 10);
        }
      }
    }
  });
});
