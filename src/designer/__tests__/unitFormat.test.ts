import { describe, it, expect } from 'vitest';
import { formatLengthForUnit, chipVisibleAt } from '../unitFormat';

describe('formatLengthForUnit', () => {
  it('is byte-identical to the old hardcoded formatter at 0.5 m and 0.25 m', () => {
    expect(formatLengthForUnit(3.5, 0.5)).toBe('3.50 m');
    expect(formatLengthForUnit(3.25, 0.25)).toBe('3.25 m');
    expect(formatLengthForUnit(12.34, 0.5)).toBe('12.34 m');
  });

  it('renders whole centimetres for sub-metre lengths at fine units', () => {
    expect(formatLengthForUnit(0.03, 0.01)).toBe('3 cm');
    expect(formatLengthForUnit(0.47, 0.1)).toBe('47 cm');
  });

  it('caps cm output below 1 m so the plate cannot overflow', () => {
    // 1 m and up falls through to metres even at the finest unit, so the
    // longest cm string is "99 cm".
    expect(formatLengthForUnit(1.5, 0.01)).toBe('1.50 m');
    expect(formatLengthForUnit(0.99, 0.01)).toBe('99 cm');
  });

  it('drops to one decimal at coarse units', () => {
    expect(formatLengthForUnit(40, 10)).toBe('40.0 m');
    expect(formatLengthForUnit(7.25, 1)).toBe('7.3 m');
  });
});

describe('chipVisibleAt', () => {
  it('keeps the old 5 cm floor at the default unit', () => {
    expect(chipVisibleAt(0.04, 0.5)).toBe(false);
    expect(chipVisibleAt(0.3, 0.5)).toBe(true);
  });

  it('lets fine units show the short segments they exist to draw', () => {
    // The old hardcoded > 0.05 hid this entirely.
    expect(chipVisibleAt(0.03, 0.01)).toBe(true);
  });
});
