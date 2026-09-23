import { describe, expect, it } from 'vitest';
import { formatWallHeightM } from '../../designer/wallHeight';

describe('formatWallHeightM', () => {
  it('shows one decimal for the 0.1 m steps and keeps a real hundredth', () => {
    expect(formatWallHeightM(2.7)).toBe('2.7');
    expect(formatWallHeightM(2.8)).toBe('2.8');
    expect(formatWallHeightM(2.75)).toBe('2.75');
    expect(formatWallHeightM(4)).toBe('4');
  });
});
