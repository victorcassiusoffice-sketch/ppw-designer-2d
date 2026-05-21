import { describe, it, expect } from 'vitest';
import { computeRoomStats } from '../useRoomStats';
import { cursorForMode, labelForMode, DESIGNER_MODES } from '../useDesignerMode';

describe('DT-15 / computeRoomStats', () => {
  it('sums priceMur across items', () => {
    const s = computeRoomStats({
      items: [
        { productId: 'a', priceMur: 1000 },
        { productId: 'b', priceMur: 2500 },
      ],
      roomWidthMm: 5000,
      roomDepthMm: 4000,
    });
    expect(s.totalValueMur).toBe(3500);
    expect(s.itemCount).toBe(2);
    expect(s.floorAreaM2).toBe(20);
  });
  it('zero items', () => {
    const s = computeRoomStats({ items: [], roomWidthMm: 3000, roomDepthMm: 3000 });
    expect(s.totalValueMur).toBe(0);
    expect(s.itemCount).toBe(0);
    expect(s.floorAreaM2).toBe(9);
  });
});

describe('DT-15 / cursorForMode + labelForMode', () => {
  it('exposes all 6 modes per spec (Tweak 02 adds Floor between Wall and Paint)', () => {
    expect(DESIGNER_MODES).toEqual(['move', 'wall', 'floor', 'paint', 'inspect', 'buy']);
  });
  it('wall cursor is crosshair (M2)', () => {
    expect(cursorForMode('wall')).toBe('crosshair');
  });
  it('floor cursor is crosshair (Tweak 02 — paint-zone gesture)', () => {
    expect(cursorForMode('floor')).toBe('crosshair');
  });
  it('paint cursor is crosshair (Tweak 03 — promoted from stub)', () => {
    expect(cursorForMode('paint')).toBe('crosshair');
  });
  it('inspect cursor is help', () => {
    expect(cursorForMode('inspect')).toBe('help');
  });
  it('labels are sentence case', () => {
    expect(labelForMode('move')).toBe('Move');
    expect(labelForMode('wall')).toBe('Wall');
    expect(labelForMode('floor')).toBe('Floor');
    expect(labelForMode('paint')).toBe('Paint');
  });
});
