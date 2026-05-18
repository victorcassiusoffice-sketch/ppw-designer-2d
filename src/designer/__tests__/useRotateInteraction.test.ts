import { describe, it, expect } from 'vitest';
import { cycleRotation, nudgeRotation, snapRotationDeg, ROTATION_STEP_DEG } from '../useRotateInteraction';
import { toggleSelection, singleSelect, clearSelection, marqueeSelect, groupTranslate, MARQUEE_TOUCH_DISABLED } from '../useMultiSelect';

describe('DT-16 / cycleRotation', () => {
  it('cycles 0 → 90 → 180 → 270 → 0 clockwise', () => {
    expect(cycleRotation(0, true)).toBe(90);
    expect(cycleRotation(90, true)).toBe(180);
    expect(cycleRotation(180, true)).toBe(270);
    expect(cycleRotation(270, true)).toBe(0);
  });
  it('cycles counter-clockwise', () => {
    expect(cycleRotation(0, false)).toBe(270);
  });
  it('normalises off-axis rotations', () => {
    expect(cycleRotation(45, true)).toBe(180); // 45 → 90, +90 → 180
  });
});

describe('DT-16 / nudgeRotation (R key)', () => {
  it('15° CW step (R)', () => {
    expect(nudgeRotation(30, true)).toBe(45);
  });
  it('15° CCW step (Shift+R)', () => {
    expect(nudgeRotation(45, false)).toBe(30);
  });
  it('wraps around 360', () => {
    // 355 + 15 = 370 → mod 360 = 10 → snap to nearest 15° = 15.
    expect(nudgeRotation(355, true)).toBe(15);
  });
  it('freeFloat skips snap', () => {
    expect(nudgeRotation(7.5, true, true)).toBe(22.5);
  });
});

describe('DT-16 / snapRotationDeg', () => {
  it('snaps to nearest 15°', () => {
    expect(snapRotationDeg(22, false)).toBe(15);
    expect(snapRotationDeg(23, false)).toBe(30);
  });
  it('freeFloat passes through', () => {
    expect(snapRotationDeg(22, true)).toBe(22);
  });
  it('exposes the locked step', () => {
    expect(ROTATION_STEP_DEG).toBe(15);
  });
});

describe('DT-16 / multi-select', () => {
  it('toggleSelection adds + removes', () => {
    let s = new Set<string>();
    s = toggleSelection(s, 'a');
    expect(s.has('a')).toBe(true);
    s = toggleSelection(s, 'a');
    expect(s.has('a')).toBe(false);
  });

  it('singleSelect replaces selection with the one id', () => {
    expect([...singleSelect('x')]).toEqual(['x']);
  });

  it('clearSelection empties', () => {
    expect(clearSelection().size).toBe(0);
  });

  it('marqueeSelect requires fully-inside semantics', () => {
    const marquee = { xMm: 0, yMm: 0, widthMm: 1000, depthMm: 1000 };
    const items = [
      { id: 'inside', rect: { xMm: 100, yMm: 100, widthMm: 200, depthMm: 200 } },
      { id: 'overlap', rect: { xMm: 900, yMm: 900, widthMm: 300, depthMm: 300 } },
      { id: 'outside', rect: { xMm: 2000, yMm: 2000, widthMm: 100, depthMm: 100 } },
    ];
    const sel = marqueeSelect(marquee, items);
    expect([...sel]).toEqual(['inside']);
  });

  it('groupTranslate moves all items uniformly', () => {
    const out = groupTranslate(
      [{ id: 'a', xMm: 100, yMm: 200 }, { id: 'b', xMm: 300, yMm: 400 }],
      50,
      -25,
    );
    expect(out).toEqual([
      { id: 'a', xMm: 150, yMm: 175 },
      { id: 'b', xMm: 350, yMm: 375 },
    ]);
  });

  it('MARQUEE_TOUCH_DISABLED honours mobile policy', () => {
    expect(MARQUEE_TOUCH_DISABLED).toBe(true);
  });
});
