import { describe, expect, it } from 'vitest';
import { gestureRotation, normaliseRotation, pointerAngle, rotationDetent, rotationDelta } from '../rotationGesture';

describe('Sims rotation input contract', () => {
  it('offers exactly eight clockwise snap stops and wraps in either direction', () => {
    expect(Array.from({ length: 9 }, (_, n) => gestureRotation(0, -90, -90 + n * 45)))
      .toEqual([0, 45, 90, 135, 180, 225, 270, 315, 0]);
    expect(rotationDetent(-45)).toBe(315);
  });
  it('a held modifier gives whole-degree precision without a 45-degree jump', () => {
    expect(gestureRotation(45, 0, 17.4, true)).toBe(62);
    expect(gestureRotation(45, 0, 17.4)).toBe(45);
  });
  it('uses the pointer-down offset so picking up a turned item does not reset its angle', () => {
    const angle = pointerAngle({ x: 180, y: 120 }, { x: 120, y: 120 });
    expect(gestureRotation(135, angle, angle)).toBe(135);
    expect(gestureRotation(135, angle, 45)).toBe(180);
  });
  it('crosses the angle seam continuously, independent of screen position', () => {
    expect(rotationDelta(179, -179)).toBe(2);
    expect(gestureRotation(90, 179, -179, true)).toBe(92);
    expect(normaliseRotation(-721)).toBe(359);
  });
});
