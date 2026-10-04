import { describe, expect, it } from 'vitest';
import { planRoomLabelLayout } from '../planRoomLabel';

describe('readable plan labels at phone fit scale', () => {
  it('hides small unselected room names instead of covering the plan with text', () => {
    expect(planRoomLabelLayout(88, 76, 'Home office', false)).toBeNull();
    expect(planRoomLabelLayout(160, 42, 'Bathroom', false)).toBeNull();
    expect(planRoomLabelLayout(60, 35, 'Home office', true)).toBeNull();
  });
  it('keeps the selected room name compact and within its actual projected width', () => {
    const layout = planRoomLabelLayout(80, 55, 'An exceptionally long room name', true)!;
    expect(layout.fontPx).toBe(8);
    expect(layout.widthPx).toBeLessThanOrEqual(64);
    expect(layout.heightPx).toBeLessThan(12);
  });
  it('limits the desktop maximum and declines invalid or empty labels', () => {
    expect(planRoomLabelLayout(900, 700, 'Bedroom', false)?.fontPx).toBe(10);
    expect(planRoomLabelLayout(NaN, 700, 'Bedroom', true)).toBeNull();
    expect(planRoomLabelLayout(900, 700, '', true)).toBeNull();
  });
});
